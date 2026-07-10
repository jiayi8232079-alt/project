import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  MedicationNotificationJob,
  MedicationJobChannel,
  MedicationJobKind,
  MedicationJobStatus,
  MedicationJobTargetKind,
} from '../../entities/medication-notification-job.entity.js';
import {
  MedicationReminder,
  ReminderType,
} from '../../entities/medication-reminder.entity.js';
import { MedicationExecutionLog } from '../../entities/medication-execution-log.entity.js';
import { User } from '../../entities/user.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';

export interface EnqueueTarget {
  targetKind: MedicationJobTargetKind;
  targetUserId?: number | null;
  targetPhone?: string | null;
  targetOpenid?: string | null;
}

export interface EnqueuePlan {
  kind: MedicationJobKind;
  scheduledAt: Date;
  executionLogId?: number | null;
  reminder: MedicationReminder;
  channels: MedicationJobChannel[];
  targets: EnqueueTarget[];
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * 用药推送任务 "入队 + 取消" 中心。
 *
 * 只做队列操作，不做实际发送（发送由 MedicationNotificationWorker 消费）。
 * 这样设计便于：
 *   - 单测：入队逻辑 / 取消逻辑 / 升级链都可独立 mock
 *   - 隔离：worker 崩溃也不丢任务（入队写 DB）
 *   - 后台可视化：管理员能直接看 medication_notification_jobs 表
 */
@Injectable()
export class MedicationNotificationService {
  private readonly logger = new Logger(MedicationNotificationService.name);

  constructor(
    @InjectRepository(MedicationNotificationJob)
    private readonly jobRepo: Repository<MedicationNotificationJob>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    @InjectRepository(FamilyMember)
    private readonly familyRepo: Repository<FamilyMember>,
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
  ) {}

  /**
   * 按 plan 入队：对每个 (channel × target) 组合各生成一条 pending job。
   * 同一 (reminder, kind, executionLogId) 下已有非终结 job 时幂等跳过，避免重复推送。
   */
  async enqueue(plan: EnqueuePlan): Promise<MedicationNotificationJob[]> {
    const existing = await this.jobRepo.find({
      where: {
        reminderId: plan.reminder.id,
        kind: plan.kind,
        executionLogId: plan.executionLogId ?? undefined,
        status: In([
          MedicationJobStatus.PENDING,
          MedicationJobStatus.RETRYING,
          MedicationJobStatus.SENDING,
        ]),
      },
    });
    if (existing.length > 0) {
      return existing;
    }

    const maxAttempts = plan.maxAttempts ?? 3;
    const items: MedicationNotificationJob[] = [];
    for (const channel of plan.channels) {
      for (const target of plan.targets) {
        if (channel === MedicationJobChannel.MINI_PROGRAM && !target.targetOpenid) {
          continue;
        }
        if (channel === MedicationJobChannel.SMS && !target.targetPhone) {
          continue;
        }
        if (channel === MedicationJobChannel.VOICE_CALL && !target.targetPhone) {
          continue;
        }

        const job = this.jobRepo.create({
          reminderId: plan.reminder.id,
          executionLogId: plan.executionLogId ?? null,
          kind: plan.kind,
          channel,
          targetKind: target.targetKind,
          targetUserId: target.targetUserId ?? null,
          targetPhone: target.targetPhone ?? null,
          targetOpenid: target.targetOpenid ?? null,
          payload: plan.payload ?? null,
          status: MedicationJobStatus.PENDING,
          attempts: 0,
          maxAttempts,
          scheduledAt: plan.scheduledAt,
          nextAttemptAt: plan.scheduledAt,
        });
        items.push(job);
      }
    }

    if (items.length === 0) {
      this.logger.warn(
        `[notification enqueue] reminder=${plan.reminder.id} kind=${plan.kind} 无可发送目标，跳过`,
      );
      return [];
    }
    return this.jobRepo.save(items);
  }

  /**
   * 打卡成功后取消对应 log 的还未发送的升级任务（miss_1st / miss_2nd / escalate_* ）。
   * 用于「家属点了打卡，系统就别再叫了」的逻辑闭环。
   */
  async cancelPendingForLog(logId: number): Promise<number> {
    const result = await this.jobRepo
      .createQueryBuilder()
      .update(MedicationNotificationJob)
      .set({
        status: MedicationJobStatus.CANCELLED,
        lastError: '已打卡，取消后续升级',
      })
      .where('execution_log_id = :logId', { logId })
      .andWhere('status IN (:...active)', {
        active: [
          MedicationJobStatus.PENDING,
          MedicationJobStatus.RETRYING,
        ],
      })
      .execute();
    return result.affected || 0;
  }

  /**
   * reminder 暂停 / 删除 / 取消时调用，一次性取消所有待发任务。
   */
  async cancelPendingForReminder(reminderId: number): Promise<number> {
    const result = await this.jobRepo
      .createQueryBuilder()
      .update(MedicationNotificationJob)
      .set({
        status: MedicationJobStatus.CANCELLED,
        lastError: '提醒已暂停/取消',
      })
      .where('reminder_id = :reminderId', { reminderId })
      .andWhere('status IN (:...active)', {
        active: [
          MedicationJobStatus.PENDING,
          MedicationJobStatus.RETRYING,
        ],
      })
      .execute();
    return result.affected || 0;
  }

  /**
   * 根据 reminder 解析出所有可能的推送目标：
   *   - 服务对象（老人）自己的手机
   *   - 客户主账号（通常是家属）的手机 + openid
   *   - 家庭群里所有 guardian 的 openid + 手机
   */
  async resolveReminderTargets(
    reminder: MedicationReminder,
  ): Promise<{
    miniProgramTargets: EnqueueTarget[];
    smsTargets: EnqueueTarget[];
    voiceTargets: EnqueueTarget[];
  }> {
    const user = reminder.user
      ? reminder.user
      : await this.userRepo.findOne({ where: { id: reminder.userId } });
    const target = reminder.serviceTarget
      ? reminder.serviceTarget
      : reminder.serviceTargetId
        ? await this.targetRepo.findOne({
            where: { id: reminder.serviceTargetId },
          })
        : null;

    const miniProgramTargets: EnqueueTarget[] = [];
    const smsTargetsMap = new Map<string, EnqueueTarget>();

    if (user?.openid) {
      miniProgramTargets.push({
        targetKind: MedicationJobTargetKind.USER,
        targetUserId: user.id,
        targetOpenid: user.openid,
      });
    }
    if (user?.phone) {
      smsTargetsMap.set(user.phone, {
        targetKind: MedicationJobTargetKind.USER,
        targetUserId: user.id,
        targetPhone: user.phone,
      });
    }
    if (target?.phone) {
      smsTargetsMap.set(target.phone, {
        targetKind: MedicationJobTargetKind.SERVICE_TARGET,
        targetUserId: null,
        targetPhone: target.phone,
      });
    }

    const guardians = await this.findGuardians(reminder.userId);
    for (const g of guardians) {
      if (g.openid) {
        miniProgramTargets.push({
          targetKind: MedicationJobTargetKind.GUARDIAN,
          targetUserId: g.id,
          targetOpenid: g.openid,
        });
      }
      if (g.phone && !smsTargetsMap.has(g.phone)) {
        smsTargetsMap.set(g.phone, {
          targetKind: MedicationJobTargetKind.GUARDIAN,
          targetUserId: g.id,
          targetPhone: g.phone,
        });
      }
    }

    const smsTargets = Array.from(smsTargetsMap.values());
    return {
      miniProgramTargets,
      smsTargets,
      voiceTargets: smsTargets.map((t) => ({
        ...t,
        targetKind: t.targetKind,
      })),
    };
  }

  async resolveAdminTargets(): Promise<EnqueueTarget[]> {
    const admins = await this.adminRepo
      .createQueryBuilder('a')
      .where('a.status = :active', { active: true })
      .andWhere('a.role IN (:...roles)', {
        roles: ['admin', 'customer_service', 'operator', 'medical_consultant'],
      })
      .getMany();
    const seen = new Set<string>();
    const targets: EnqueueTarget[] = [];
    for (const a of admins) {
      const phone = (a.phone || '').trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      targets.push({
        targetKind: MedicationJobTargetKind.ADMIN,
        targetUserId: null,
        targetPhone: phone,
      });
    }
    return targets;
  }

  private async findGuardians(userId: number): Promise<User[]> {
    const memberships = await this.familyRepo.find({
      where: { userId, role: 'guardian' },
    });
    if (memberships.length === 0) return [];
    const groupIds = Array.from(
      new Set(memberships.map((m) => m.familyGroupId)),
    );
    const siblings = await this.familyRepo.find({
      where: { familyGroupId: In(groupIds), role: 'guardian' },
    });
    const otherUserIds = Array.from(
      new Set(
        siblings
          .map((m) => m.userId)
          .filter((u): u is number => !!u && u !== userId),
      ),
    );
    if (otherUserIds.length === 0) return [];
    return this.userRepo.find({ where: { id: In(otherUserIds) } });
  }

  async listJobs(query: {
    status?: MedicationJobStatus[];
    reminderId?: number;
    kind?: MedicationJobKind;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 30));
    const qb = this.jobRepo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.reminder', 'reminder')
      .leftJoinAndSelect('reminder.user', 'user')
      .leftJoinAndSelect('reminder.serviceTarget', 'target');

    if (query.status && query.status.length > 0) {
      qb.andWhere('j.status IN (:...status)', { status: query.status });
    }
    if (query.reminderId) {
      qb.andWhere('j.reminderId = :rid', { rid: query.reminderId });
    }
    if (query.kind) {
      qb.andWhere('j.kind = :kind', { kind: query.kind });
    }
    if (query.fromDate) {
      qb.andWhere('j.scheduledAt >= :from', { from: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('j.scheduledAt <= :to', { to: query.toDate });
    }

    qb.orderBy('j.scheduledAt', 'DESC').addOrderBy('j.id', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async retry(id: number): Promise<MedicationNotificationJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new Error('任务不存在');
    job.status = MedicationJobStatus.PENDING;
    job.nextAttemptAt = new Date();
    job.lastError = null;
    return this.jobRepo.save(job);
  }

  /**
   * 送达率统计：按 kind × channel 聚合 windowHours 内的任务。
   * 返回每个组合的 total / success / dead / retrying / pending / cancelled
   * 以及"送达率"= success / (success + dead)（忽略待发/重试中进行的）。
   */
  async stats(windowHours: number = 24): Promise<{
    windowHours: number;
    generatedAt: string;
    totals: Record<string, number>;
    byKind: Array<{
      kind: string;
      channel: string;
      total: number;
      success: number;
      dead: number;
      retrying: number;
      pending: number;
      sending: number;
      cancelled: number;
      deliveryRate: number;
    }>;
  }> {
    const hours = Math.max(1, Math.min(720, windowHours || 24));
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const rows = await this.jobRepo
      .createQueryBuilder('j')
      .select('j.kind', 'kind')
      .addSelect('j.channel', 'channel')
      .addSelect('j.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('j.createdAt >= :since', { since })
      .groupBy('j.kind')
      .addGroupBy('j.channel')
      .addGroupBy('j.status')
      .getRawMany<{ kind: string; channel: string; status: string; count: string }>();

    const map = new Map<string, any>();
    const totals: Record<string, number> = {
      total: 0,
      success: 0,
      dead: 0,
      retrying: 0,
      pending: 0,
      sending: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      const key = `${r.kind}#${r.channel}`;
      const entry = map.get(key) || {
        kind: r.kind,
        channel: r.channel,
        total: 0,
        success: 0,
        dead: 0,
        retrying: 0,
        pending: 0,
        sending: 0,
        cancelled: 0,
      };
      const count = Number(r.count || 0);
      entry.total += count;
      if (entry[r.status] !== undefined) entry[r.status] += count;
      map.set(key, entry);
      totals.total += count;
      if (totals[r.status] !== undefined) totals[r.status] += count;
    }

    const byKind = Array.from(map.values()).map((e: any) => {
      const resolved = e.success + e.dead;
      const deliveryRate = resolved > 0 ? e.success / resolved : 0;
      return { ...e, deliveryRate };
    });
    byKind.sort((a, b) => b.total - a.total);

    return {
      windowHours: hours,
      generatedAt: new Date().toISOString(),
      totals,
      byKind,
    };
  }

  /**
   * 拣出一批"到点应发"的任务，标记为 SENDING 供 worker 消费。
   * 单条 UPDATE ... WHERE status=pending 的原子写法避免并发多 worker 扫到同一条。
   */
  async claimBatch(limit: number): Promise<MedicationNotificationJob[]> {
    const now = new Date();
    const candidates = await this.jobRepo.find({
      where: [
        {
          status: MedicationJobStatus.PENDING,
          nextAttemptAt: LessThanOrEqual(now),
        },
        {
          status: MedicationJobStatus.RETRYING,
          nextAttemptAt: LessThanOrEqual(now),
        },
      ],
      relations: ['reminder', 'reminder.user', 'reminder.serviceTarget'],
      order: { scheduledAt: 'ASC', id: 'ASC' },
      take: limit,
    });
    if (candidates.length === 0) return [];

    const claimed: MedicationNotificationJob[] = [];
    for (const job of candidates) {
      const res = await this.jobRepo
        .createQueryBuilder()
        .update(MedicationNotificationJob)
        .set({ status: MedicationJobStatus.SENDING })
        .where('id = :id', { id: job.id })
        .andWhere('status IN (:...active)', {
          active: [MedicationJobStatus.PENDING, MedicationJobStatus.RETRYING],
        })
        .execute();
      if ((res.affected || 0) > 0) {
        job.status = MedicationJobStatus.SENDING;
        claimed.push(job);
      }
    }
    return claimed;
  }

  async markSuccess(
    job: MedicationNotificationJob,
    providerRef?: string | null,
  ): Promise<void> {
    job.status = MedicationJobStatus.SUCCESS;
    job.sentAt = new Date();
    job.respondedAt = new Date();
    job.providerRef = providerRef ?? null;
    job.lastError = null;
    await this.jobRepo.save(job);
  }

  /**
   * 一次失败的回写：增加 attempts，按指数退避算 nextAttemptAt；
   * 达到 maxAttempts 则 DEAD（调用方负责触发渠道降级）。
   */
  async markFailure(
    job: MedicationNotificationJob,
    error: string,
  ): Promise<'retry' | 'dead'> {
    job.attempts += 1;
    job.lastError = (error || '').slice(0, 500);
    job.sentAt = new Date();
    if (job.attempts >= job.maxAttempts) {
      job.status = MedicationJobStatus.DEAD;
      await this.jobRepo.save(job);
      return 'dead';
    }
    job.status = MedicationJobStatus.RETRYING;
    job.nextAttemptAt = this.computeNextAttempt(job.attempts);
    await this.jobRepo.save(job);
    return 'retry';
  }

  private computeNextAttempt(attempts: number): Date {
    const steps = [30, 120, 600, 1800];
    const seconds = steps[Math.min(attempts - 1, steps.length - 1)] || 600;
    return new Date(Date.now() + seconds * 1000);
  }

  /**
   * 辅助方法：判断是不是用药提醒（不是复诊），用于 payload 生成差异化。
   */
  isMedicationReminder(reminder: MedicationReminder): boolean {
    return reminder.reminderType === ReminderType.MEDICATION;
  }
}
