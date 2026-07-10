import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MedicationExecutionLog,
  MedicationExecutionStatus,
} from '../../entities/medication-execution-log.entity.js';
import {
  MedicationReminder,
  ReminderStatus,
  ReminderType,
  ReminderSeverity,
} from '../../entities/medication-reminder.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { Order } from '../../entities/order.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { UserRole, OrderStatus } from '../../common/enums/index.js';
import {
  CheckInMedicationDto,
  QueryMedicationExecutionDto,
} from './dto/check-in.dto.js';
import { MedicationNotificationService } from '../medication-notification/medication-notification.service.js';
import { MedicationNotificationWorker } from '../medication-notification/medication-notification.worker.js';
import { MedicationPolicyService } from '../medication-reminder/medication-policy.service.js';
import {
  MedicationJobChannel,
  MedicationJobKind,
  MedicationJobTargetKind,
} from '../../entities/medication-notification-job.entity.js';

/**
 * 用药打卡 / 执行日志服务
 *
 * 职责：
 * 1. 每 5 分钟生成当天尚未存在的计划服药记录（pending），同时为每条 pending 入队 FIRST_PUSH。
 * 2. 家属/本人/陪诊员对某次服药打卡（TAKEN / SKIPPED / MISSED），成功打卡会取消后续升级任务。
 * 3. 扫 pending / missed，按 reminder.severity 对应的阈值走"追推 → 标 missed → 家属升级 → 管理员升级"四级链。
 */
@Injectable()
export class MedicationExecutionService {
  private readonly logger = new Logger(MedicationExecutionService.name);

  constructor(
    @InjectRepository(MedicationExecutionLog)
    private readonly logRepo: Repository<MedicationExecutionLog>,
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(FamilyMember)
    private readonly familyMemberRepo: Repository<FamilyMember>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Attendant)
    private readonly attendantRepo: Repository<Attendant>,
    private readonly notificationService: MedicationNotificationService,
    private readonly policyService: MedicationPolicyService,
  ) {}

  // ───────── 打卡接口 ─────────

  async checkIn(
    dto: CheckInMedicationDto,
    currentUserId: number,
    role: string,
  ) {
    const reminder = await this.reminderRepo.findOne({
      where: { id: dto.reminderId },
    });
    if (!reminder) throw new NotFoundException('提醒不存在');
    if (reminder.reminderType !== ReminderType.MEDICATION) {
      throw new ForbiddenException('仅支持对用药提醒打卡');
    }
    await this.assertAccess(reminder.userId, currentUserId, role);

    let log = await this.logRepo.findOne({
      where: {
        reminderId: reminder.id,
        scheduledDate: dto.scheduledDate,
        scheduledTime: dto.scheduledTime,
      },
    });

    if (!log) {
      log = this.logRepo.create({
        reminderId: reminder.id,
        serviceTargetId: reminder.serviceTargetId || null,
        scheduledDate: dto.scheduledDate,
        scheduledTime: dto.scheduledTime,
      });
    }

    log.status = dto.status || MedicationExecutionStatus.TAKEN;
    log.executedAt = new Date();
    log.executedBy = currentUserId;
    log.note = dto.note || null;
    const saved = await this.logRepo.save(log);

    if (
      saved.status === MedicationExecutionStatus.TAKEN ||
      saved.status === MedicationExecutionStatus.SKIPPED
    ) {
      const cancelled = await this.notificationService.cancelPendingForLog(
        saved.id,
      );
      if (cancelled > 0) {
        this.logger.log(
          `[check-in] reminder=${reminder.id} log=${saved.id} 状态=${saved.status}，已取消 ${cancelled} 条升级任务`,
        );
      }
    }
    return saved;
  }

  async list(
    dto: QueryMedicationExecutionDto,
    currentUserId: number,
    role: string,
  ) {
    const where: Record<string, unknown> = {};
    if (dto.reminderId) where.reminderId = dto.reminderId;
    if (dto.serviceTargetId) where.serviceTargetId = dto.serviceTargetId;
    if (dto.startDate && dto.endDate) {
      where.scheduledDate = Between(dto.startDate, dto.endDate);
    } else if (dto.startDate) {
      where.scheduledDate = MoreThanOrEqual(dto.startDate);
    } else if (dto.endDate) {
      where.scheduledDate = LessThanOrEqual(dto.endDate);
    }

    // 家属端：限制只能看自己/家人相关的提醒
    if (role === UserRole.USER) {
      const guardedIds = await this.getGuardedUserIds(currentUserId);
      const userIds = Array.from(new Set([currentUserId, ...guardedIds]));
      const relatedReminders = await this.reminderRepo.find({
        where: { userId: In(userIds) },
        select: ['id'],
      });
      const reminderIds = relatedReminders.map((r) => r.id);
      if (reminderIds.length === 0) return { items: [] };
      where.reminderId = dto.reminderId
        ? dto.reminderId
        : In(reminderIds);
    }

    const items = await this.logRepo.find({
      where,
      relations: ['reminder', 'serviceTarget'],
      order: { scheduledDate: 'DESC', scheduledTime: 'DESC' },
      take: 200,
    });
    return { items };
  }

  async getAdherenceStats(
    userId: number,
    windowDays = 7,
    currentUserId?: number,
    role?: string,
  ) {
    // 普通用户和陪诊员都需要校验：用户只能看自己/家属，陪诊员只能看曾服务过的客户。
    // 管理端角色（admin/operator/customer_service/medical_consultant）放行。
    if (currentUserId && (role === UserRole.USER || role === UserRole.ATTENDANT)) {
      await this.assertAccess(userId, currentUserId, role);
    }
    const endDate = this.toLocalDateString(new Date());
    const startDate = this.toLocalDateString(
      new Date(Date.now() - windowDays * 24 * 3600 * 1000),
    );
    const reminders = await this.reminderRepo.find({
      where: { userId },
      select: ['id'],
    });
    const reminderIds = reminders.map((r) => r.id);
    if (reminderIds.length === 0) {
      return { total: 0, taken: 0, missed: 0, skipped: 0, adherenceRate: 1 };
    }
    const rows = await this.logRepo
      .createQueryBuilder('log')
      .select('log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('log.reminder_id IN (:...rids)', { rids: reminderIds })
      .andWhere('log.scheduled_date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('log.status')
      .getRawMany<{ status: MedicationExecutionStatus; count: string }>();

    const counts: Record<string, number> = { taken: 0, missed: 0, skipped: 0, pending: 0 };
    for (const row of rows) {
      counts[row.status] = Number(row.count || 0);
    }
    const total = counts.taken + counts.missed + counts.skipped + counts.pending;
    const adherenceRate = total > 0 ? counts.taken / total : 1;
    return {
      total,
      taken: counts.taken,
      missed: counts.missed,
      skipped: counts.skipped,
      pending: counts.pending,
      adherenceRate,
      startDate,
      endDate,
    };
  }

  // ───────── 定时任务 ─────────

  /**
   * 每 5 分钟扫描一次：
   * 1) 为当天所有 ACTIVE 提醒生成 pending 记录（去重），同时为每条 pending 入队 FIRST_PUSH；
   * 2) 扫 pending → 按 severity 阈值驱动整条升级链（miss_1st / miss_2nd+标 missed / escalate_admin）。
   *
   * 为什么不再沿用 120 分钟硬编码宽限：高风险药 15 分钟就该追推，120 分钟太晚。
   */
  @Cron('0 */5 * * * *')
  async runScheduler() {
    try {
      await this.generateTodayPendingAndEnqueue();
    } catch (err) {
      this.logger.error(
        `生成用药打卡记录失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      await this.runEscalationChain();
    } catch (err) {
      this.logger.error(
        `用药升级链执行失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 生成当天所有 ACTIVE 提醒的 pending 记录；每条 pending 入队一次 FIRST_PUSH。
   * 幂等：同日同 (reminder, scheduled_time) 的 log 仅创建一次；
   *       每条 log 对应的 FIRST_PUSH 靠 (reminderId, kind, executionLogId) 幂等。
   */
  async generateTodayPendingAndEnqueue() {
    const today = this.toLocalDateString(new Date());
    const reminders = await this.reminderRepo.find({
      where: {
        status: ReminderStatus.ACTIVE,
        reminderType: ReminderType.MEDICATION,
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['user', 'serviceTarget'],
    });

    for (const r of reminders) {
      const times = Array.isArray(r.reminderTimes) ? r.reminderTimes : [];
      if (times.length === 0) continue;

      const existing = await this.logRepo.find({
        where: { reminderId: r.id, scheduledDate: today },
      });
      const existingMap = new Map(existing.map((x) => [x.scheduledTime, x]));
      const toInsert = times
        .filter((t) => !existingMap.has(t))
        .map((t) =>
          this.logRepo.create({
            reminderId: r.id,
            serviceTargetId: r.serviceTargetId || null,
            scheduledDate: today,
            scheduledTime: t,
            status: MedicationExecutionStatus.PENDING,
          }),
        );
      const inserted = toInsert.length > 0 ? await this.logRepo.save(toInsert) : [];

      // 合并原有 + 新增的 pending log 做首推入队
      const allTodayLogs = [
        ...existing.filter((x) => x.status === MedicationExecutionStatus.PENDING),
        ...inserted,
      ];
      for (const log of allTodayLogs) {
        await this.enqueueFirstPush(r, log);
      }
    }
  }

  /**
   * 按 severity 驱动升级链，顺序：
   *   pending 且 now >= scheduled + firstFollowUpMinutes → MISS_1ST（家属小程序+短信）
   *   pending 且 now >= scheduled + markMissedMinutes → 标 missed + MISS_2ND
   *   missed 且 now >= scheduled + escalateAdminMinutes → ESCALATE_ADMIN
   *
   * 每次扫 48 小时窗口（确保凌晨老人漏服，白天第一次跑 scheduler 时还能捕捉到）。
   */
  async runEscalationChain() {
    const now = new Date();
    const windowStart = this.toLocalDateString(
      new Date(now.getTime() - 48 * 3600 * 1000),
    );
    const windowEnd = this.toLocalDateString(now);

    const pendingOrMissed = await this.logRepo.find({
      where: [
        {
          status: MedicationExecutionStatus.PENDING,
          scheduledDate: Between(windowStart, windowEnd),
        },
        {
          status: MedicationExecutionStatus.MISSED,
          scheduledDate: Between(windowStart, windowEnd),
        },
      ],
      relations: ['reminder', 'reminder.user', 'reminder.serviceTarget'],
      take: 500,
    });

    for (const log of pendingOrMissed) {
      const reminder = log.reminder;
      if (!reminder) continue;
      if (reminder.status !== ReminderStatus.ACTIVE) continue;

      const severity = (reminder.severity as ReminderSeverity) || ReminderSeverity.MEDIUM;
      const policy = await this.policyService.resolvePolicy(
        severity,
        reminder.missEscalationOverride || null,
      );
      if (policy.disabled) continue;

      const scheduledAt = this.computeScheduledAt(log);
      const minutesPast = (now.getTime() - scheduledAt.getTime()) / 60_000;
      if (minutesPast < policy.firstFollowUpMinutes) continue;

      if (log.status === MedicationExecutionStatus.PENDING) {
        if (minutesPast >= policy.firstFollowUpMinutes) {
          await this.enqueueMissFollowUp(
            reminder,
            log,
            MedicationJobKind.MISS_1ST,
          );
        }
        if (minutesPast >= policy.markMissedMinutes) {
          log.status = MedicationExecutionStatus.MISSED;
          await this.logRepo.save(log);
          await this.enqueueMissFollowUp(
            reminder,
            log,
            MedicationJobKind.MISS_2ND,
          );
          await this.enqueueEscalateFamily(reminder, log);
        }
      }

      if (
        log.status === MedicationExecutionStatus.MISSED &&
        policy.escalateAdminMinutes !== null &&
        minutesPast >= policy.escalateAdminMinutes
      ) {
        await this.enqueueEscalateAdmin(reminder, log);
      }
    }
  }

  private computeScheduledAt(log: MedicationExecutionLog): Date {
    const [y, m, d] = String(log.scheduledDate)
      .split('T')[0]
      .split('-')
      .map((x) => Number(x));
    const [hh, mm] = String(log.scheduledTime || '00:00')
      .split(':')
      .map((x) => Number(x));
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  }

  private async enqueueFirstPush(
    reminder: MedicationReminder,
    log: MedicationExecutionLog,
  ) {
    const scheduledAt = this.computeScheduledAt(log);
    const { miniProgramTargets, smsTargets } =
      await this.notificationService.resolveReminderTargets(reminder);
    if (miniProgramTargets.length === 0 && smsTargets.length === 0) return;

    const payload = this.buildPayload(
      reminder,
      MedicationJobKind.FIRST_PUSH,
      scheduledAt,
      log.id,
    );

    if (miniProgramTargets.length > 0) {
      await this.notificationService.enqueue({
        kind: MedicationJobKind.FIRST_PUSH,
        scheduledAt,
        executionLogId: log.id,
        reminder,
        channels: [MedicationJobChannel.MINI_PROGRAM],
        targets: miniProgramTargets,
        payload,
      });
    }
    if (smsTargets.length > 0) {
      await this.notificationService.enqueue({
        kind: MedicationJobKind.FIRST_PUSH,
        scheduledAt,
        executionLogId: log.id,
        reminder,
        channels: [MedicationJobChannel.SMS],
        targets: smsTargets,
        payload,
      });
    }
  }

  private async enqueueMissFollowUp(
    reminder: MedicationReminder,
    log: MedicationExecutionLog,
    kind: MedicationJobKind,
  ) {
    const now = new Date();
    const { miniProgramTargets, smsTargets } =
      await this.notificationService.resolveReminderTargets(reminder);
    const payload = this.buildPayload(
      reminder,
      kind,
      this.computeScheduledAt(log),
      log.id,
    );

    if (miniProgramTargets.length > 0) {
      await this.notificationService.enqueue({
        kind,
        scheduledAt: now,
        executionLogId: log.id,
        reminder,
        channels: [MedicationJobChannel.MINI_PROGRAM],
        targets: miniProgramTargets,
        payload,
      });
    }
    if (smsTargets.length > 0) {
      await this.notificationService.enqueue({
        kind,
        scheduledAt: now,
        executionLogId: log.id,
        reminder,
        channels: [MedicationJobChannel.SMS],
        targets: smsTargets,
        payload,
      });
    }
  }

  private async enqueueEscalateFamily(
    reminder: MedicationReminder,
    log: MedicationExecutionLog,
  ) {
    const now = new Date();
    const { miniProgramTargets, smsTargets } =
      await this.notificationService.resolveReminderTargets(reminder);
    const guardianMini = miniProgramTargets.filter(
      (t) => t.targetKind === MedicationJobTargetKind.GUARDIAN,
    );
    const guardianSms = smsTargets.filter(
      (t) => t.targetKind === MedicationJobTargetKind.GUARDIAN,
    );
    const targetsMini = guardianMini.length > 0 ? guardianMini : miniProgramTargets;
    const targetsSms = guardianSms.length > 0 ? guardianSms : smsTargets;
    const payload = this.buildPayload(
      reminder,
      MedicationJobKind.ESCALATE_FAMILY,
      this.computeScheduledAt(log),
      log.id,
    );

    if (targetsMini.length > 0) {
      await this.notificationService.enqueue({
        kind: MedicationJobKind.ESCALATE_FAMILY,
        scheduledAt: now,
        executionLogId: log.id,
        reminder,
        channels: [MedicationJobChannel.MINI_PROGRAM],
        targets: targetsMini,
        payload,
      });
    }
    if (targetsSms.length > 0) {
      await this.notificationService.enqueue({
        kind: MedicationJobKind.ESCALATE_FAMILY,
        scheduledAt: now,
        executionLogId: log.id,
        reminder,
        channels: [MedicationJobChannel.SMS],
        targets: targetsSms,
        payload,
      });
    }
  }

  private async enqueueEscalateAdmin(
    reminder: MedicationReminder,
    log: MedicationExecutionLog,
  ) {
    const now = new Date();
    const adminTargets = await this.notificationService.resolveAdminTargets();
    if (adminTargets.length === 0) {
      this.logger.warn(
        `[escalate_admin] 无可用管理员电话，无法升级 reminder=${reminder.id} log=${log.id}`,
      );
      return;
    }
    const payload = this.buildPayload(
      reminder,
      MedicationJobKind.ESCALATE_ADMIN,
      this.computeScheduledAt(log),
      log.id,
    );
    await this.notificationService.enqueue({
      kind: MedicationJobKind.ESCALATE_ADMIN,
      scheduledAt: now,
      executionLogId: log.id,
      reminder,
      channels: [MedicationJobChannel.SMS],
      targets: adminTargets,
      payload,
      maxAttempts: 2,
    });
  }

  private buildPayload(
    reminder: MedicationReminder,
    kind: MedicationJobKind,
    scheduledAt: Date,
    logId?: number | null,
  ): Record<string, unknown> {
    const patientName =
      reminder.serviceTarget?.name || reminder.user?.nickname || '家人';
    const timeText = this.formatTimeText(scheduledAt);
    // pageTarget 需要带上 execution log id，家属点击推送后才能直接定位到"具体那次打卡"
    // 而不是只打开"今日用药"列表。为 FIRST_PUSH 之外的追推/升级推送尤为关键。
    const query = logId ? `logId=${logId}` : 'type=today';
    return MedicationNotificationWorker.buildMedicationPayload({
      patientName,
      medicineName: reminder.medicineName,
      dosage: reminder.dosage || '',
      instructions: reminder.instructions || '',
      kind,
      timeText,
      pageTarget: `pages/family/medication/medication?${query}`,
    });
  }

  private formatTimeText(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // ───────── 工具 ─────────

  private async assertAccess(
    reminderUserId: number,
    currentUserId: number,
    role: string,
  ) {
    if (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT
    ) {
      return;
    }
    if (role === UserRole.ATTENDANT) {
      const allowed = await this.assertAttendantHasOrderWithUser(
        currentUserId,
        reminderUserId,
      );
      if (!allowed) {
        throw new ForbiddenException(
          '无权访问该客户的用药数据：仅可查看你曾服务过的客户',
        );
      }
      return;
    }
    if (reminderUserId === currentUserId) return;
    const guarded = await this.getGuardedUserIds(currentUserId);
    if (!guarded.includes(reminderUserId)) {
      throw new ForbiddenException('无权操作该用药提醒');
    }
  }

  /**
   * 陪诊员限权：仅当陪诊员历史上服务过 reminderUserId（任意非取消订单）时才放行。
   *
   * 不限制时间窗：服务过即默认信任。如需收紧到"近 90 天" 等规则，
   * 在 where 子句加 createdAt 区间即可。
   */
  private async assertAttendantHasOrderWithUser(
    attendantUserId: number,
    customerUserId: number,
  ): Promise<boolean> {
    const attendant = await this.attendantRepo.findOne({
      where: { userId: attendantUserId },
      select: ['id', 'userId'],
    });
    if (!attendant) return false;
    const count = await this.orderRepo.count({
      where: {
        attendantId: attendant.id,
        userId: customerUserId,
      },
    });
    return count > 0;
  }

  private async getGuardedUserIds(userId: number): Promise<number[]> {
    const my = await this.familyMemberRepo.find({
      where: { userId, role: 'guardian' },
    });
    if (my.length === 0) return [];
    const groupIds = my.map((m) => m.familyGroupId);
    const all = await this.familyMemberRepo.find({
      where: { familyGroupId: In(groupIds) },
    });
    return Array.from(
      new Set(
        all
          .map((m) => m.userId)
          .filter((u): u is number => u !== null && u !== userId),
      ),
    );
  }

  private toLocalDateString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
