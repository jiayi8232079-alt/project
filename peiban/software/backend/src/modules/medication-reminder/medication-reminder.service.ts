import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MedicationReminder,
  ReminderStatus,
  ReminderType,
  ReminderSeverity,
} from '../../entities/medication-reminder.entity.js';
import {
  MedicationReminderAudit,
  MedicationAuditAction,
  MedicationAuditActorType,
} from '../../entities/medication-reminder-audit.entity.js';
import { CreateReminderDto } from './dto/create-reminder.dto.js';
import { UpdateReminderDto } from './dto/update-reminder.dto.js';
import { UserRole } from '../../common/enums/index.js';
import { Order } from '../../entities/order.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { MedicationPolicyService } from './medication-policy.service.js';
import { MedicationNotificationService } from '../medication-notification/medication-notification.service.js';
import {
  MedicationJobChannel,
  MedicationJobKind,
} from '../../entities/medication-notification-job.entity.js';

export interface AuditActor {
  id?: number;
  role?: string;
  name?: string;
}

@Injectable()
export class MedicationReminderService {
  private readonly logger = new Logger(MedicationReminderService.name);

  constructor(
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(MedicationReminderAudit)
    private readonly auditRepo: Repository<MedicationReminderAudit>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    @InjectRepository(FamilyMember)
    private readonly familyMemberRepository: Repository<FamilyMember>,
    private readonly policyService: MedicationPolicyService,
    private readonly jobService: MedicationNotificationService,
  ) {}

  private static readonly AUDITED_FIELDS: Array<keyof MedicationReminder> = [
    'medicineName',
    'severity',
    'dosage',
    'dosePerTime',
    'timesPerDay',
    'totalQuantity',
    'unit',
    'frequency',
    'reminderTimes',
    'startDate',
    'endDate',
    'instructions',
    'status',
    'followUpHospital',
    'followUpDepartment',
    'missEscalationOverride',
  ];

  private resolveActorType(role?: string): MedicationAuditActorType {
    if (this.isAdminLikeRole(role)) return MedicationAuditActorType.ADMIN;
    if (!role) return MedicationAuditActorType.SYSTEM;
    return MedicationAuditActorType.USER;
  }

  private buildDiff(
    before: MedicationReminder | null,
    after: MedicationReminder,
  ): Record<string, { from: unknown; to: unknown }> | null {
    if (!before) return null;
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of MedicationReminderService.AUDITED_FIELDS) {
      const from = (before as any)[field];
      const to = (after as any)[field];
      if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
        diff[field as string] = { from, to };
      }
    }
    return Object.keys(diff).length === 0 ? null : diff;
  }

  private async writeAudit(params: {
    reminderId: number;
    action: MedicationAuditAction;
    actor?: AuditActor;
    before?: MedicationReminder | null;
    after?: MedicationReminder;
    note?: string | null;
  }): Promise<void> {
    const { reminderId, action, actor, before, after, note } = params;
    const diff =
      before && after ? this.buildDiff(before, after) : null;
    await this.auditRepo.save(
      this.auditRepo.create({
        reminderId,
        actorType: this.resolveActorType(actor?.role),
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        action,
        diffJson: diff,
        note: note ?? null,
      }),
    );
  }

  /**
   * 根据 dto 和 severity 默认策略，推导最终入库的字段：
   *  - reminderTimes 缺失 → 用 timesPerDay 生成默认时段
   *  - endDate 缺失 → 用 totalQuantity / dosePerTime / timesPerDay 推算
   */
  private async resolveScheduleFields(
    dto: Partial<CreateReminderDto> & {
      reminderTimes?: string[];
      endDate?: string;
      startDate?: string;
      timesPerDay?: number | null;
      totalQuantity?: number | null;
      dosePerTime?: number | null;
    },
    current?: MedicationReminder,
  ): Promise<{ reminderTimes?: string[]; endDate?: string }> {
    const result: { reminderTimes?: string[]; endDate?: string } = {};

    const hasTimes =
      Array.isArray(dto.reminderTimes) && dto.reminderTimes.length > 0;
    if (!hasTimes) {
      const freq =
        dto.timesPerDay !== undefined
          ? Number(dto.timesPerDay || 0)
          : current?.timesPerDay || 0;
      const generated = this.policyService.buildDefaultReminderTimes(freq);
      if (generated.length > 0 && !current?.reminderTimes?.length) {
        result.reminderTimes = generated;
      }
    }

    if (!dto.endDate) {
      const startDate = dto.startDate || current?.startDate;
      const total =
        dto.totalQuantity !== undefined
          ? Number(dto.totalQuantity)
          : current?.totalQuantity;
      const dose =
        dto.dosePerTime !== undefined
          ? Number(dto.dosePerTime)
          : current?.dosePerTime;
      const freq =
        dto.timesPerDay !== undefined
          ? Number(dto.timesPerDay)
          : current?.timesPerDay;
      if (startDate && total && dose && freq) {
        const computed = this.policyService.computeEndDate({
          startDate,
          totalQuantity: total,
          dosePerTime: dose,
          timesPerDay: freq,
        });
        if (computed) result.endDate = computed;
      }
    }

    return result;
  }

  private isAdminLikeRole(role?: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT
    );
  }

  private async resolveAttendantIdByUserId(userId: number): Promise<number> {
    const attendant = await this.attendantRepository.findOne({ where: { userId } });
    if (!attendant) {
      throw new BadRequestException('当前账号未绑定陪诊员身份');
    }
    return attendant.id;
  }

  private async assertOrderAccess(
    orderId: number,
    currentUserId: number,
    role: string,
  ): Promise<void> {
    if (this.isAdminLikeRole(role)) return;
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');

    if (role === UserRole.ATTENDANT) {
      const attendantId = await this.resolveAttendantIdByUserId(currentUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权访问该订单用药提醒');
      }
      return;
    }

    if (order.userId !== currentUserId) {
      throw new ForbiddenException('无权访问该订单用药提醒');
    }
  }

  private async assertReminderAccess(
    reminder: MedicationReminder,
    currentUserId: number,
    role: string,
  ): Promise<void> {
    if (this.isAdminLikeRole(role)) return;
    if (role === UserRole.ATTENDANT) {
      if (!reminder.orderId) {
        throw new ForbiddenException('无权访问该用药提醒');
      }
      await this.assertOrderAccess(reminder.orderId, currentUserId, role);
      return;
    }
    if (reminder.userId === currentUserId) return;

    const isGuardian = await this.isGuardianOf(currentUserId, reminder.userId);
    if (isGuardian) return;

    throw new ForbiddenException('无权访问该用药提醒');
  }

  private async isGuardianOf(guardianUserId: number, memberUserId: number): Promise<boolean> {
    const guardianMemberships = await this.familyMemberRepository.find({
      where: { userId: guardianUserId, role: 'guardian' },
    });
    for (const gm of guardianMemberships) {
      // 校验 guardian 的 viewMedication 权限位，与 FamilyService 保持一致
      if (gm.permissions?.viewMedication === false) continue;
      const target = await this.familyMemberRepository.findOne({
        where: { familyGroupId: gm.familyGroupId, userId: memberUserId },
      });
      if (target) return true;
    }
    return false;
  }

  private formatLocalDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private buildCompletionMedicationUsage(reminder: MedicationReminder): string {
    const dosage = String(reminder.dosage || '').trim();
    const instructions = String(reminder.instructions || '').trim();
    if (dosage && instructions) return `${dosage}；${instructions}`;
    return dosage || instructions || '';
  }

  private assertFollowUpReminderFields(reminder: {
    reminderType?: ReminderType;
    startDate?: string;
    followUpHospital?: string | null;
    followUpDepartment?: string | null;
  }) {
    if (
      reminder.reminderType === ReminderType.FOLLOW_UP &&
      reminder.startDate &&
      (!String(reminder.followUpHospital || '').trim() ||
        !String(reminder.followUpDepartment || '').trim())
    ) {
      throw new BadRequestException('复诊提醒请补充复诊医院和复诊科室');
    }
  }

  private async syncOrderCompletionData(orderId?: number | null) {
    if (!orderId) return;
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) return;

    const linkedReminders = await this.reminderRepo.find({
      where: {
        orderId,
        reminderType: In([ReminderType.MEDICATION, ReminderType.FOLLOW_UP]),
      },
      order: { createdAt: 'DESC' },
    });

    const medicationReminders = linkedReminders.filter(
      (item) => item.reminderType === ReminderType.MEDICATION,
    );
    const followUpReminders = linkedReminders.filter(
      (item) => item.reminderType === ReminderType.FOLLOW_UP,
    );
    const currentFollowUp =
      followUpReminders.find((item) => item.status !== ReminderStatus.CANCELLED) ||
      followUpReminders[0];

    const rawCompletion =
      (order as any).completionData && typeof (order as any).completionData === 'object'
        ? ((order as any).completionData as Record<string, unknown>)
        : {};

    (order as any).completionData = {
      ...rawCompletion,
      medicationMode: medicationReminders.length ? 'has' : 'none',
      medications: medicationReminders.map((item) => ({
        name: item.medicineName,
        usage: this.buildCompletionMedicationUsage(item),
        reminderTime: Array.isArray(item.reminderTimes) ? item.reminderTimes[0] || '' : '',
        startDate: item.startDate,
        endDate: item.endDate,
      })),
      followUpDate: currentFollowUp?.startDate || '',
      followUpNote: currentFollowUp?.instructions || '',
      followUpHospital: currentFollowUp?.followUpHospital || '',
      followUpDepartment: currentFollowUp?.followUpDepartment || '',
    };

    await this.orderRepository.save(order);
  }

  async create(
    dto: CreateReminderDto,
    createdBy?: number,
    actor?: AuditActor,
  ): Promise<MedicationReminder> {
    // 非管理员时校验 orderId 与调用者的关系，防止关联他人订单
    if (actor && actor.id != null && dto.orderId != null && !this.isAdminLikeRole(actor.role)) {
      await this.assertOrderAccess(dto.orderId, actor.id, actor.role ?? '');
    }
    const resolvedSchedule = await this.resolveScheduleFields(dto);
    const reminderTimes =
      (dto.reminderTimes && dto.reminderTimes.length > 0
        ? dto.reminderTimes
        : resolvedSchedule.reminderTimes) || [];
    if (reminderTimes.length === 0 && dto.reminderType !== ReminderType.FOLLOW_UP) {
      throw new BadRequestException(
        '请设置提醒时间，或同时填写"每日频次"让系统自动生成',
      );
    }

    const endDate = dto.endDate || resolvedSchedule.endDate;
    if (!endDate) {
      throw new BadRequestException(
        '请设置结束日期，或同时填写总药量/每次用量/每日频次让系统自动推算',
      );
    }
    if (endDate < dto.startDate) {
      throw new BadRequestException('结束日期不能早于开始日期');
    }

    const reminder = this.reminderRepo.create({
      ...dto,
      reminderTimes,
      endDate,
      severity: dto.severity || ReminderSeverity.MEDIUM,
      reminderType: dto.reminderType || ReminderType.MEDICATION,
      createdBy,
    });
    this.assertFollowUpReminderFields(reminder);
    const saved = await this.reminderRepo.save(reminder);
    await this.syncOrderCompletionData(saved.orderId);
    await this.writeAudit({
      reminderId: saved.id,
      action: MedicationAuditAction.CREATE,
      actor: actor || (createdBy ? { id: createdBy, role: 'admin' } : undefined),
      note: dto.prescriptionId
        ? `从处方批次 #${dto.prescriptionId} 创建`
        : '手工创建',
    });
    return saved;
  }

  async update(
    id: number,
    dto: UpdateReminderDto,
    actor?: AuditActor,
  ): Promise<MedicationReminder> {
    const reminder = await this.reminderRepo.findOne({ where: { id } });
    if (!reminder) throw new NotFoundException('提醒不存在');

    const before = { ...reminder } as MedicationReminder;

    const resolvedSchedule = await this.resolveScheduleFields(dto, reminder);
    const applied: Partial<MedicationReminder> = { ...dto } as any;
    if (!applied.reminderTimes && resolvedSchedule.reminderTimes) {
      applied.reminderTimes = resolvedSchedule.reminderTimes;
    }
    if (!applied.endDate && resolvedSchedule.endDate) {
      applied.endDate = resolvedSchedule.endDate;
    }

    Object.assign(reminder, applied);
    this.assertFollowUpReminderFields(reminder);
    if (reminder.endDate < reminder.startDate) {
      throw new BadRequestException('结束日期不能早于开始日期');
    }
    if (
      (reminder.reminderTimes || []).length === 0 &&
      reminder.reminderType !== ReminderType.FOLLOW_UP
    ) {
      throw new BadRequestException('提醒时间不能为空');
    }

    const saved = await this.reminderRepo.save(reminder);
    await this.syncOrderCompletionData(saved.orderId);

    let auditAction: MedicationAuditAction = MedicationAuditAction.UPDATE;
    if (
      before.status !== saved.status &&
      saved.status === ReminderStatus.PAUSED
    ) {
      auditAction = MedicationAuditAction.PAUSE;
    } else if (
      before.status !== saved.status &&
      saved.status === ReminderStatus.ACTIVE &&
      before.status === ReminderStatus.PAUSED
    ) {
      auditAction = MedicationAuditAction.RESUME;
    } else if (
      before.status !== saved.status &&
      saved.status === ReminderStatus.COMPLETED
    ) {
      auditAction = MedicationAuditAction.COMPLETE;
    } else if (
      before.status !== saved.status &&
      saved.status === ReminderStatus.CANCELLED
    ) {
      auditAction = MedicationAuditAction.CANCEL;
    }

    await this.writeAudit({
      reminderId: saved.id,
      action: auditAction,
      actor,
      before,
      after: saved,
    });

    if (saved.status !== ReminderStatus.ACTIVE) {
      const cancelled = await this.jobService.cancelPendingForReminder(saved.id);
      if (cancelled > 0) {
        this.logger.log(
          `[reminder status=${saved.status}] reminder=${saved.id} 已取消 ${cancelled} 条推送任务`,
        );
      }
    }
    return saved;
  }

  async remove(id: number, actor?: AuditActor) {
    const reminder = await this.reminderRepo.findOne({ where: { id } });
    if (!reminder) throw new NotFoundException('提醒不存在');
    const snapshot = { ...reminder } as MedicationReminder;
    const linkedOrderId = reminder.orderId;
    await this.jobService.cancelPendingForReminder(reminder.id);
    await this.reminderRepo.remove(reminder);
    await this.syncOrderCompletionData(linkedOrderId);
    await this.writeAudit({
      reminderId: snapshot.id,
      action: MedicationAuditAction.DELETE,
      actor,
      note: `已删除：${snapshot.medicineName}（severity=${snapshot.severity}）`,
    });
    return { success: true };
  }

  async listAudits(reminderId: number) {
    return this.auditRepo.find({
      where: { reminderId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async findAll(query: {
    userId?: number;
    serviceTargetId?: number;
    status?: ReminderStatus;
    type?: ReminderType;
    page?: number;
    pageSize?: number;
  }) {
    const {
      userId,
      serviceTargetId,
      status,
      type = ReminderType.MEDICATION,
    } = query;
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    const qb = this.reminderRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.serviceTarget', 'serviceTarget')
      .leftJoinAndSelect('r.order', 'order');

    if (userId) qb.andWhere('r.userId = :userId', { userId });
    if (serviceTargetId) qb.andWhere('r.serviceTargetId = :serviceTargetId', { serviceTargetId });
    if (status) qb.andWhere('r.status = :status', { status });
    if (type) qb.andWhere('r.reminderType = :type', { type });

    qb.orderBy('r.createdAt', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(
    id: number,
    currentUserId: number,
    role: string,
  ): Promise<MedicationReminder> {
    const reminder = await this.reminderRepo.findOne({
      where: { id },
      relations: ['user', 'serviceTarget', 'order'],
    });
    if (!reminder) throw new NotFoundException('提醒不存在');
    await this.assertReminderAccess(reminder, currentUserId, role);
    return reminder;
  }

  async findByUser(
    userId: number,
    activeOnly = true,
    type?: ReminderType,
  ): Promise<MedicationReminder[]> {
    const where: any = { userId };
    // 旧实现：未传 type 时默认 MEDICATION，前端首页要拿用药+复诊会被迫发两次。
    // 现在改为「未传 type 不限制 reminderType」，调用方可一次拉两类。
    if (type) where.reminderType = type;
    if (activeOnly) where.status = ReminderStatus.ACTIVE;
    return this.reminderRepo.find({
      where,
      relations: ['serviceTarget', 'order'],
      order: { createdAt: 'DESC' },
      // 接口未分页且为 onShow 高频拉取；老人长期累积可能上百条，
      // 全量返回带 relations 容易把单 payload 推到几十 KB。
      // 200 条足够覆盖任何真实老人场景；超过则提示前端走专门的分页接口。
      take: 200,
    });
  }

  async findByOrder(
    orderId: number,
    currentUserId: number,
    role: string,
    type?: ReminderType,
  ): Promise<MedicationReminder[]> {
    await this.assertOrderAccess(orderId, currentUserId, role);
    const where: any = { orderId };
    if (type) where.reminderType = type;
    return this.reminderRepo.find({
      where,
      relations: ['user', 'serviceTarget'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 每分钟触发：
   *  - 对 FOLLOW_UP 类型的到点提醒入队 medication_notification_jobs（FOLLOW_UP kind），
   *    由 MedicationNotificationWorker 消费，享受指数退避重试与渠道降级；
   *  - MEDICATION 类型的到点推送由 MedicationExecutionService 的 5 分钟扫描负责，
   *    这里不重复发送；
   *  - 最后跑一次过期自动 complete，写 audit。
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendReminders() {
    const now = new Date();
    const today = this.formatLocalDate(now);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const activeFollowUps = await this.reminderRepo.find({
      where: {
        status: ReminderStatus.ACTIVE,
        reminderType: ReminderType.FOLLOW_UP,
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['user', 'serviceTarget'],
    });

    for (const reminder of activeFollowUps) {
      if (!reminder.reminderTimes?.includes(currentTime)) continue;

      // lastNotifiedAt 做"同一分钟内不重复入队"的前置幂等；
      // enqueue 内部按 (reminderId, kind) 去重也兜底，两层保障。
      const lastNotified = reminder.lastNotifiedAt;
      if (lastNotified) {
        const diffMs = now.getTime() - new Date(lastNotified).getTime();
        if (diffMs < 55 * 1000) continue;
      }

      try {
        await this.enqueueFollowUpJobs(reminder, '今日', now);
        reminder.lastNotifiedAt = now;
        await this.reminderRepo.save(reminder);
      } catch (error) {
        this.logger.error(
          `复诊提醒入队失败 [ID=${reminder.id}]: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.autoCompleteExpiredReminders(today);
  }

  /**
   * 每天 09:00 跑一次：扫描所有「明日即将复诊」的 FOLLOW_UP 提醒，
   * 入队 FOLLOW_UP job（whenLabel='明日'）。
   */
  @Cron('0 0 9 * * *')
  async sendFollowUpPreReminders() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = this.formatLocalDate(tomorrow);

    const reminders = await this.reminderRepo.find({
      where: {
        reminderType: ReminderType.FOLLOW_UP,
        status: ReminderStatus.ACTIVE,
        startDate: tomorrowStr,
      },
      relations: ['user', 'serviceTarget'],
    });

    if (reminders.length === 0) {
      this.logger.debug('[复诊前一天提醒] 明日无待复诊记录');
      return;
    }

    let enqueued = 0;
    for (const reminder of reminders) {
      try {
        const count = await this.enqueueFollowUpJobs(reminder, '明日', now);
        if (count > 0) enqueued += 1;
      } catch (err) {
        this.logger.warn(
          `[复诊前一天提醒] 入队失败 [ID=${reminder.id}]: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(
      `[复诊前一天提醒] 共扫描 ${reminders.length} 条，入队 ${enqueued} 条`,
    );
  }

  /**
   * 复诊提醒入队：MINI_PROGRAM + SMS 双渠道入 medication_notification_jobs，
   * 由 worker 消费（支持重试、降级、审计）。
   *
   * 返回入队成功的 job 条数（0 表示没有可送达目标或幂等跳过）。
   */
  private async enqueueFollowUpJobs(
    reminder: MedicationReminder,
    whenLabel: '今日' | '明日',
    now: Date,
  ): Promise<number> {
    const { miniProgramTargets, smsTargets } =
      await this.jobService.resolveReminderTargets(reminder);
    if (miniProgramTargets.length === 0 && smsTargets.length === 0) {
      return 0;
    }

    const payload = this.buildFollowUpPayload(reminder, whenLabel, now);
    let count = 0;

    if (miniProgramTargets.length > 0) {
      const jobs = await this.jobService.enqueue({
        kind: MedicationJobKind.FOLLOW_UP,
        scheduledAt: now,
        reminder,
        channels: [MedicationJobChannel.MINI_PROGRAM],
        targets: miniProgramTargets,
        payload,
      });
      count += jobs.length;
    }

    if (smsTargets.length > 0) {
      const jobs = await this.jobService.enqueue({
        kind: MedicationJobKind.FOLLOW_UP,
        scheduledAt: now,
        reminder,
        channels: [MedicationJobChannel.SMS],
        targets: smsTargets,
        payload,
      });
      count += jobs.length;
    }

    return count;
  }

  /**
   * 复诊提醒 payload：
   *   - 同时塞 follow_up_reminder 与 medication_reminder 两套字段，
   *     这样无论微信小程序模板 alias 解析到哪一个，都能命中它期望的字段。
   *   - smsParams 保留 3 元素（患者 / 日期 / 医院科室）给 SMS worker。
   */
  private buildFollowUpPayload(
    reminder: MedicationReminder,
    whenLabel: '今日' | '明日',
    now: Date,
  ): Record<string, unknown> {
    const patient = this.truncate(
      reminder.serviceTarget?.name || reminder.user?.nickname || '家人',
      20,
    );
    const hospital = String(reminder.followUpHospital || '').trim();
    const department = String(reminder.followUpDepartment || '').trim();
    const hospitalDept =
      [hospital, department].filter(Boolean).join(' ').trim() || '医院复诊';
    const dateText = reminder.startDate || this.formatLocalDate(now);
    const displayDate = `${whenLabel}(${dateText})`;

    const page = reminder.orderId
      ? `pages/order/detail/detail?id=${reminder.orderId}`
      : `pages/family/dashboard/dashboard`;

    return {
      // follow_up_reminder 模板字段
      thing1: patient,
      thing2: this.truncate(hospitalDept, 20),
      time3: this.formatFollowUpDate(dateText),
      thing4: `${whenLabel}需复诊，请提前准备`,
      // medication_reminder 模板兜底字段（alias fallback 命中时使用）
      time2: this.formatFollowUpDate(dateText),
      thing3: this.truncate(`${whenLabel}复诊`, 20),
      character_string4: this.truncate(hospitalDept || '请按时复诊', 20),
      thing5: this.truncate(
        `${whenLabel}请按时前往医院复诊，${hospitalDept}`,
        20,
      ),
      __page: page,
      smsParams: [patient, displayDate, hospitalDept],
    };
  }

  private formatFollowUpDate(raw: string): string {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(
      String(raw || '').trim(),
    );
    if (!match) return '09:00:00';
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 09:00`;
  }

  private truncate(raw: string, maxLen: number): string {
    if (!raw) return '';
    return raw.length > maxLen ? raw.slice(0, maxLen) : raw;
  }

  private async autoCompleteExpiredReminders(today: string) {
    const expiring = await this.reminderRepo
      .createQueryBuilder('r')
      .where('r.status = :status AND r.end_date < :today', {
        status: ReminderStatus.ACTIVE,
        today,
      })
      .select(['r.id'])
      .getMany();
    if (expiring.length === 0) return;
    await this.reminderRepo
      .createQueryBuilder()
      .update(MedicationReminder)
      .set({ status: ReminderStatus.COMPLETED })
      .whereInIds(expiring.map((r) => r.id))
      .execute();
    for (const r of expiring) {
      await this.writeAudit({
        reminderId: r.id,
        action: MedicationAuditAction.COMPLETE,
        note: `系统自动：疗程截止日 < ${today}`,
      });
    }
  }
}
