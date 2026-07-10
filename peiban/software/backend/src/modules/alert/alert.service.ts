import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual, Between, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  HealthAlert,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../../entities/health-alert.entity.js';
import { AlertRule } from '../../entities/alert-rule.entity.js';
import {
  AlertLog,
  AlertLogAction,
  AlertLogActorType,
} from '../../entities/alert-log.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import {
  MedicationExecutionLog,
  MedicationExecutionStatus,
} from '../../entities/medication-execution-log.entity.js';
import {
  MedicationReminder,
  ReminderStatus,
  ReminderType,
} from '../../entities/medication-reminder.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { User } from '../../entities/user.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { Order } from '../../entities/order.entity.js';
import { ServiceTimeline } from '../../entities/service-timeline.entity.js';
import { NotificationService } from '../notification/notification.service.js';
import { AlertRuleEngine } from './alert-rule.engine.js';
import { OrderStatus, UserRole } from '../../common/enums/index.js';
import { QueryAlertDto } from './dto/query-alert.dto.js';
import {
  AcknowledgeAlertDto,
  AppendAlertLogDto,
  AssignAlertDto,
  CloseAlertDto,
  EscalateAlertDto,
} from './dto/update-alert.dto.js';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto.js';

type CreateAlertInput = {
  userId: number;
  serviceTargetId?: number | null;
  orderId?: number | null;
  category: AlertCategory;
  ruleCode: string;
  ruleName?: string | null;
  severity: AlertSeverity;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  dedupKey?: string | null;
  suggestedActions?: HealthAlert['suggestedActions'];
  notifyFamily?: boolean;
  notifyAdmin?: boolean;
  cooldownMinutes?: number;
  triggeredAt?: Date;
};

@Injectable()
export class AlertService implements OnModuleInit {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(HealthAlert)
    private readonly alertRepo: Repository<HealthAlert>,
    @InjectRepository(AlertRule)
    private readonly ruleRepo: Repository<AlertRule>,
    @InjectRepository(AlertLog)
    private readonly alertLogRepo: Repository<AlertLog>,
    @InjectRepository(MedicationExecutionLog)
    private readonly executionLogRepo: Repository<MedicationExecutionLog>,
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMember)
    private readonly familyMemberRepo: Repository<FamilyMember>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    private readonly ruleEngine: AlertRuleEngine,
    private readonly notificationService: NotificationService,
  ) {}

  // ───────── 初始化：写入内置规则 ─────────
  async onModuleInit() {
    try {
      for (const def of this.ruleEngine.getBuiltInRules()) {
        const existing = await this.ruleRepo.findOne({
          where: { ruleCode: def.ruleCode },
        });
        if (!existing) {
          await this.ruleRepo.save(
            this.ruleRepo.create({
              ruleCode: def.ruleCode,
              name: def.name,
              category: def.category,
              severity: def.severity,
              enabled: true,
              condition: def.condition,
              description: def.description,
              cooldownMinutes: def.cooldownMinutes,
              notifyFamily: def.notifyFamily,
              notifyAdmin: def.notifyAdmin,
            }),
          );
          this.logger.log(`内置预警规则已初始化: ${def.ruleCode}`);
        }
      }
    } catch (err) {
      this.logger.error(
        `初始化预警规则失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ───────── 对外接口（家属端/管理端） ─────────

  async list(dto: QueryAlertDto, currentUserId?: number, role?: string) {
    const page = Math.max(1, Number(dto.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(dto.pageSize || 20)));

    const qb = this.alertRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.serviceTarget', 'st')
      .leftJoinAndSelect('a.user', 'u')
      .leftJoinAndSelect('a.order', 'o')
      .leftJoinAndSelect('a.assignee', 'assignee');

    if (dto.status) qb.andWhere('a.status = :status', { status: dto.status });
    if (dto.severity) qb.andWhere('a.severity = :sv', { sv: dto.severity });
    if (dto.category) qb.andWhere('a.category = :cg', { cg: dto.category });
    if (dto.userId) qb.andWhere('a.userId = :uid', { uid: dto.userId });
    if (dto.serviceTargetId)
      qb.andWhere('a.serviceTargetId = :tid', { tid: dto.serviceTargetId });
    if (dto.assigneeId)
      qb.andWhere('a.assigneeId = :asid', { asid: dto.assigneeId });

    // 家属端：只能看自己（或自己作为监护人的家庭对象）的预警
    if (role === UserRole.USER && currentUserId) {
      const guardedUserIds = await this.getGuardedUserIds(currentUserId);
      const userIds = Array.from(new Set([currentUserId, ...guardedUserIds]));
      qb.andWhere('a.userId IN (:...ids)', { ids: userIds });
    }

    qb.orderBy('a.triggeredAt', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findOne(id: number, currentUserId?: number, role?: string) {
    const alert = await this.alertRepo.findOne({
      where: { id },
      relations: ['serviceTarget', 'user', 'order', 'assignee'],
    });
    if (!alert) throw new NotFoundException('预警记录不存在');

    if (role === UserRole.USER && currentUserId) {
      await this.assertFamilyAccess(alert.userId, currentUserId);
    }
    return alert;
  }

  async listLogs(alertId: number, currentUserId: number, role: string) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('预警记录不存在');
    if (role === UserRole.USER) {
      await this.assertFamilyAccess(alert.userId, currentUserId);
    }
    return this.alertLogRepo.find({
      where: { alertId },
      order: { createdAt: 'ASC' },
    });
  }

  async assign(
    id: number,
    currentUserId: number,
    role: string,
    dto: AssignAlertDto,
  ) {
    const channel = this.resolveChannelByRole(role);
    if (channel !== 'admin') {
      throw new ForbiddenException('仅管理端可指派告警');
    }
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('预警记录不存在');

    const assignee = await this.adminUserRepo.findOne({
      where: { id: dto.assigneeId, status: true },
    });
    if (!assignee) throw new NotFoundException('被指派的处理人不存在或已禁用');

    const allowedRoles = new Set<string>([
      UserRole.ADMIN,
      UserRole.OPERATOR,
      UserRole.CUSTOMER_SERVICE,
      UserRole.MEDICAL_CONSULTANT,
    ]);
    if (!allowedRoles.has(assignee.role)) {
      throw new ForbiddenException('该用户角色无法处理告警');
    }

    alert.assigneeId = assignee.id;
    alert.assignedBy = currentUserId;
    alert.assignedAt = new Date();
    const saved = await this.alertRepo.save(alert);

    const operator = await this.adminUserRepo.findOne({
      where: { id: currentUserId },
    });
    await this.writeLog(alert.id, {
      actorType: AlertLogActorType.ADMIN,
      actorId: currentUserId,
      actorName: operator?.realName || operator?.username || null,
      action: AlertLogAction.ASSIGN,
      note: dto.note ?? null,
      payload: {
        assigneeId: assignee.id,
        assigneeName: assignee.realName || assignee.username,
        assigneeRole: assignee.role,
      },
    });

    return this.findOne(saved.id, currentUserId, role);
  }

  async appendLog(
    id: number,
    currentUserId: number,
    role: string,
    dto: AppendAlertLogDto,
  ) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('预警记录不存在');

    const channel = this.resolveChannelByRole(role);
    if (channel === 'family') {
      await this.assertFamilyAccess(alert.userId, currentUserId);
      return this.writeLog(alert.id, {
        actorType: AlertLogActorType.USER,
        actorId: currentUserId,
        actorName: await this.resolveUserName(currentUserId),
        action: AlertLogAction.COMMENT,
        note: dto.note,
        payload: null,
      });
    }

    const operator = await this.adminUserRepo.findOne({
      where: { id: currentUserId },
    });
    return this.writeLog(alert.id, {
      actorType: AlertLogActorType.ADMIN,
      actorId: currentUserId,
      actorName: operator?.realName || operator?.username || null,
      action: AlertLogAction.COMMENT,
      note: dto.note,
      payload: null,
    });
  }

  async countPending(userId: number) {
    const guardedUserIds = await this.getGuardedUserIds(userId);
    const userIds = Array.from(new Set([userId, ...guardedUserIds]));
    const items = await this.alertRepo.find({
      where: { userId: In(userIds), status: AlertStatus.NEW },
      order: { triggeredAt: 'DESC' },
      take: 20,
    });
    const highCount = items.filter((a) => a.severity === AlertSeverity.HIGH).length;
    const mediumCount = items.filter((a) => a.severity === AlertSeverity.MEDIUM).length;
    return {
      total: items.length,
      high: highCount,
      medium: mediumCount,
      latest: items.slice(0, 3),
    };
  }

  async acknowledge(
    id: number,
    currentUserId: number,
    role: string,
    dto: AcknowledgeAlertDto,
  ) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('预警记录不存在');
    const channel = this.resolveChannelByRole(role);
    if (channel === 'family') {
      await this.assertFamilyAccess(alert.userId, currentUserId);
    }
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = currentUserId;
    alert.acknowledgedChannel = channel;
    alert.acknowledgedNote = dto.note ?? null;
    const saved = await this.alertRepo.save(alert);

    await this.writeLog(saved.id, {
      actorType:
        channel === 'admin'
          ? AlertLogActorType.ADMIN
          : AlertLogActorType.USER,
      actorId: currentUserId,
      actorName: await this.resolveActorName(channel, currentUserId),
      action: AlertLogAction.ACKNOWLEDGE,
      note: dto.note ?? null,
      payload: null,
    });

    return saved;
  }

  async close(
    id: number,
    currentUserId: number,
    role: string,
    dto: CloseAlertDto,
  ) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('预警记录不存在');
    const channel = this.resolveChannelByRole(role);
    if (channel === 'family') {
      await this.assertFamilyAccess(alert.userId, currentUserId);
    }
    alert.status = AlertStatus.CLOSED;
    alert.closedAt = new Date();
    alert.closedBy = currentUserId;
    if (dto.note) alert.acknowledgedNote = dto.note;
    if (!alert.acknowledgedAt) {
      alert.acknowledgedAt = alert.closedAt;
      alert.acknowledgedBy = currentUserId;
      alert.acknowledgedChannel = channel;
    }
    const saved = await this.alertRepo.save(alert);

    await this.writeLog(saved.id, {
      actorType:
        channel === 'admin'
          ? AlertLogActorType.ADMIN
          : AlertLogActorType.USER,
      actorId: currentUserId,
      actorName: await this.resolveActorName(channel, currentUserId),
      action: AlertLogAction.CLOSE,
      note: dto.note ?? null,
      payload: null,
    });

    return saved;
  }

  async markFalseAlarm(
    id: number,
    currentUserId: number,
    role: string,
    dto: CloseAlertDto,
  ) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('预警记录不存在');
    const channel = this.resolveChannelByRole(role);
    if (channel === 'family') {
      await this.assertFamilyAccess(alert.userId, currentUserId);
    }

    alert.status = AlertStatus.IGNORED;
    alert.closedAt = new Date();
    alert.closedBy = currentUserId;
    alert.acknowledgedNote = dto.note ?? '已标记为误报';
    if (!alert.acknowledgedAt) {
      alert.acknowledgedAt = alert.closedAt;
      alert.acknowledgedBy = currentUserId;
      alert.acknowledgedChannel = channel;
    }
    const saved = await this.alertRepo.save(alert);

    await this.writeLog(saved.id, {
      actorType:
        channel === 'admin'
          ? AlertLogActorType.ADMIN
          : AlertLogActorType.USER,
      actorId: currentUserId,
      actorName: await this.resolveActorName(channel, currentUserId),
      action: AlertLogAction.CLOSE,
      note: dto.note ?? '已标记为误报',
      payload: { falseAlarm: true },
    });

    return saved;
  }

  async escalate(
    id: number,
    currentUserId: number,
    role: string,
    dto: EscalateAlertDto,
  ) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('预警记录不存在');
    const channel = this.resolveChannelByRole(role);
    if (channel === 'family') {
      await this.assertFamilyAccess(alert.userId, currentUserId);
    }

    const targetLabel = {
      community: '社区值班',
      manual: '人工中台',
      emergency_call: '应急外呼',
    }[dto.target];

    await this.writeLog(alert.id, {
      actorType:
        channel === 'admin'
          ? AlertLogActorType.ADMIN
          : AlertLogActorType.USER,
      actorId: currentUserId,
      actorName: await this.resolveActorName(channel, currentUserId),
      action: AlertLogAction.COMMENT,
      note: dto.note ?? `已升级到${targetLabel}`,
      payload: { escalationTarget: dto.target },
    });

    return this.findOne(id, currentUserId, role);
  }

  async listRules() {
    return this.ruleRepo.find({ order: { category: 'ASC', ruleCode: 'ASC' } });
  }

  async listAssignableStaff() {
    const staff = await this.adminUserRepo.find({
      where: {
        role: In([
          UserRole.ADMIN,
          UserRole.OPERATOR,
          UserRole.CUSTOMER_SERVICE,
          UserRole.MEDICAL_CONSULTANT,
        ]),
        status: true,
      },
      select: ['id', 'username', 'realName', 'role'],
      order: { role: 'ASC', username: 'ASC' },
    });
    return staff.map((s) => ({
      id: s.id,
      username: s.username,
      realName: s.realName,
      role: s.role,
      displayName: s.realName || s.username,
    }));
  }

  async updateRule(id: number, dto: UpdateAlertRuleDto) {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('规则不存在');
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  // ───────── 规则执行：定时任务 ─────────

  /**
   * 每小时扫描一次漏服率与复诊逾期。
   * 错开整点的分钟（17 分），避免与用药提醒/订单超时同时抢锁。
   */
  @Cron('0 17 * * * *')
  async runScheduledScan() {
    try {
      await this.scanMedicationMiss();
    } catch (err) {
      this.logger.error(
        `扫描漏服预警失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      await this.scanFollowUpOverdue();
    } catch (err) {
      this.logger.error(
        `扫描复诊逾期预警失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async scanMedicationMiss() {
    const rule = await this.ruleRepo.findOne({
      where: { ruleCode: 'medication_miss_rate_low' },
    });
    if (!rule || !rule.enabled) return;

    const condition = (rule.condition || {}) as Record<string, number>;
    const windowDays = Number(condition.windowDays ?? 7);
    const minAdherenceRate = Number(condition.minAdherenceRate ?? 0.7);
    const minScheduledCount = Number(condition.minScheduledCount ?? 3);

    const today = this.toLocalDateString(new Date());
    const startDate = this.toLocalDateString(
      new Date(Date.now() - windowDays * 24 * 3600 * 1000),
    );

    // 聚合：每个服务对象近 windowDays 内的计划 vs 已完成
    const rows = await this.executionLogRepo
      .createQueryBuilder('log')
      .select('log.service_target_id', 'serviceTargetId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN log.status = '${MedicationExecutionStatus.TAKEN}' THEN 1 ELSE 0 END)`,
        'taken',
      )
      .addSelect(
        `SUM(CASE WHEN log.status = '${MedicationExecutionStatus.MISSED}' THEN 1 ELSE 0 END)`,
        'missed',
      )
      .where('log.scheduled_date BETWEEN :start AND :end', {
        start: startDate,
        end: today,
      })
      .andWhere('log.service_target_id IS NOT NULL')
      .groupBy('log.service_target_id')
      .getRawMany<{
        serviceTargetId: number;
        total: string;
        taken: string;
        missed: string;
      }>();

    for (const row of rows) {
      const total = Number(row.total);
      const taken = Number(row.taken);
      if (total < minScheduledCount) continue;
      const adherenceRate = total > 0 ? taken / total : 1;
      if (adherenceRate >= minAdherenceRate) continue;

      const target = await this.targetRepo.findOne({
        where: { id: Number(row.serviceTargetId) },
      });
      if (!target) continue;

      const dedupKey = `medication_miss:${target.id}:${today}`;
      await this.createAlertWithCooldown(
        {
          userId: target.userId,
          serviceTargetId: target.id,
          category: AlertCategory.MEDICATION_MISS,
          ruleCode: rule.ruleCode,
          ruleName: rule.name,
          severity: rule.severity,
          title: `${target.name} 近 ${windowDays} 天用药执行率偏低`,
          summary: `近 ${windowDays} 天应服药 ${total} 次，实际执行 ${taken} 次（执行率 ${(adherenceRate * 100).toFixed(0)}%，低于阈值 ${(minAdherenceRate * 100).toFixed(0)}%）。建议立即联系家人确认用药情况，必要时调整用药计划。`,
          payload: {
            total,
            taken,
            missed: Number(row.missed || 0),
            adherenceRate,
            windowDays,
            minAdherenceRate,
          },
          dedupKey,
          suggestedActions: [
            { action: 'contact_service', label: '联系客服协助' },
            { action: 'view_medication', label: '查看用药详情' },
            { action: 'upgrade_care_pack', label: '升级居家照护包' },
          ],
          notifyFamily: rule.notifyFamily,
          notifyAdmin: rule.notifyAdmin,
          cooldownMinutes: rule.cooldownMinutes,
        },
      );
    }
  }

  async scanFollowUpOverdue() {
    const rule = await this.ruleRepo.findOne({
      where: { ruleCode: 'follow_up_overdue' },
    });
    if (!rule || !rule.enabled) return;

    const condition = (rule.condition || {}) as Record<string, number>;
    const graceDays = Number(condition.graceDays ?? 1);
    const maxOverdueDays = Number(condition.maxOverdueDays ?? 14);
    const today = this.toLocalDateString(new Date());

    // 候选：复诊类型，startDate 在 [today-maxOverdueDays, today-graceDays] 区间
    const latest = this.toLocalDateString(
      new Date(Date.now() - graceDays * 24 * 3600 * 1000),
    );
    const earliest = this.toLocalDateString(
      new Date(Date.now() - maxOverdueDays * 24 * 3600 * 1000),
    );

    const overdueReminders = await this.reminderRepo.find({
      where: {
        reminderType: ReminderType.FOLLOW_UP,
        status: In([ReminderStatus.ACTIVE, ReminderStatus.COMPLETED]),
        startDate: Between(earliest, latest),
      },
      relations: ['serviceTarget', 'user'],
    });

    for (const r of overdueReminders) {
      const overdueDays = this.diffDays(today, r.startDate);
      if (overdueDays < graceDays) continue;

      // 若 reminder 已关联 order 且订单已完成 → 视为已复诊，跳过
      if (r.orderId) {
        const order = await this.orderRepo.findOne({
          where: { id: r.orderId },
        });
        if (order && order.status === OrderStatus.COMPLETED) continue;
      }

      const patientName = r.serviceTarget?.name || r.user?.nickname || '家人';
      const dedupKey = `follow_up_overdue:${r.id}:${today}`;

      await this.createAlertWithCooldown({
        userId: r.userId,
        serviceTargetId: r.serviceTargetId || null,
        category: AlertCategory.FOLLOW_UP_OVERDUE,
        ruleCode: rule.ruleCode,
        ruleName: rule.name,
        severity: rule.severity,
        title: `${patientName} 复诊已逾期 ${overdueDays} 天`,
        summary: `${r.followUpHospital || '医院'} ${r.followUpDepartment || ''} 的复诊（原定 ${r.startDate}）已逾期 ${overdueDays} 天，建议尽快重新安排复诊。平台可协助预约。`,
        payload: {
          reminderId: r.id,
          originalDate: r.startDate,
          overdueDays,
          hospital: r.followUpHospital,
          department: r.followUpDepartment,
        },
        dedupKey,
        suggestedActions: [
          { action: 'rebook_followup', label: '一键重约复诊' },
          { action: 'contact_service', label: '联系客服协助' },
        ],
        notifyFamily: rule.notifyFamily,
        notifyAdmin: rule.notifyAdmin,
        cooldownMinutes: rule.cooldownMinutes,
      });
    }
  }

  // ───────── 事件触发：时间线关键词 ─────────

  async handleTimelineEntry(entry: ServiceTimeline) {
    const rule = await this.ruleRepo.findOne({
      where: { ruleCode: 'timeline_keyword_high_risk' },
    });
    if (!rule || !rule.enabled) return;

    const condition = (rule.condition || {}) as { keywords?: string[] };
    const keywords = Array.isArray(condition.keywords) ? condition.keywords : [];
    if (keywords.length === 0) return;

    // 将该时间线条目的文字/转写抽取出来
    const pieces: string[] = [];
    if (entry.content) pieces.push(String(entry.content));
    const meta = entry.metadata as Record<string, unknown> | undefined;
    if (meta) {
      const transcript = (meta as any).transcriptionText || (meta as any).transcription;
      if (typeof transcript === 'string') pieces.push(transcript);
      const summary = (meta as any).summary;
      if (typeof summary === 'string') pieces.push(summary);
    }
    const combined = pieces.join('\n');
    if (!combined.trim()) return;

    const hits = this.ruleEngine.matchKeywords(combined, keywords);
    if (hits.length === 0) return;

    const order = await this.orderRepo.findOne({
      where: { id: entry.orderId },
      relations: ['serviceTarget', 'user'],
    });
    if (!order) return;

    const patientName = order.serviceTarget?.name || '家人';
    const dedupKey = `timeline_kw:${entry.orderId}:${entry.id}`;

    await this.createAlertWithCooldown({
      userId: order.userId,
      serviceTargetId: order.serviceTargetId,
      orderId: order.id,
      category: AlertCategory.TIMELINE_KEYWORD,
      ruleCode: rule.ruleCode,
      ruleName: rule.name,
      severity: rule.severity,
      title: `${patientName} 服务过程检测到高危信号`,
      summary: `陪诊记录中出现 [${hits.join('、')}] 等关键词，请立即关注！订单：${order.orderNumber}。`,
      payload: {
        entryId: entry.id,
        entryType: entry.type,
        hits,
        snippet: combined.slice(0, 200),
      },
      dedupKey,
      suggestedActions: [
        { action: 'view_timeline', label: '查看服务时间线', payload: { orderId: order.id } },
        { action: 'call_store', label: '立即联系门店' },
        { action: 'call_attendant', label: '联系陪诊员' },
      ],
      notifyFamily: rule.notifyFamily,
      notifyAdmin: rule.notifyAdmin,
      cooldownMinutes: rule.cooldownMinutes,
    });
  }

  // ───────── 设备上行事件 → 健康预警 ─────────

  /**
   * 由 device 模块在收到 跌倒/SOS/体征异常 等 critical 事件时调用，
   * 生成一条家属可见的健康预警（带 30 分钟去抖 + 推送家属）。
   */
  async createCompanionFamilyNotify(input: {
    userId: number;
    serviceTargetId: number;
    deviceId: number;
    reason: string;
    severity: 'info' | 'warn' | 'emergency';
  }): Promise<HealthAlert | null> {
    const severityMap = {
      info: AlertSeverity.LOW,
      warn: AlertSeverity.MEDIUM,
      emergency: AlertSeverity.HIGH,
    } as const;
    const titleMap = {
      info: '家人关怀提醒',
      warn: '家人关注提醒',
      emergency: '紧急通知',
    } as const;
    const dedupKey = `companion_notify:${input.serviceTargetId}:${input.severity}:${input.reason.slice(0, 64)}`;
    return this.createAlertWithCooldown({
      userId: input.userId,
      serviceTargetId: input.serviceTargetId,
      category: AlertCategory.SERVICE_EXCEPTION,
      ruleCode: 'companion_notify_family',
      ruleName: '机器人通知家属',
      severity: severityMap[input.severity],
      title: titleMap[input.severity],
      summary: input.reason,
      payload: {
        source: 'mcp',
        deviceId: input.deviceId,
        severity: input.severity,
      },
      dedupKey,
      notifyFamily: true,
      cooldownMinutes: input.severity === 'emergency' ? 5 : 30,
    });
  }

  async createDeviceAlert(input: {
    userId: number;
    serviceTargetId?: number | null;
    type: 'fall' | 'sos' | 'vital_anomaly';
    deviceId: number;
    deviceName?: string | null;
    targetName?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<HealthAlert | null> {
    const meta = {
      fall: { rule: 'device_fall', title: '检测到跌倒', severity: AlertSeverity.HIGH },
      sos: { rule: 'device_sos', title: 'SOS 紧急求助', severity: AlertSeverity.HIGH },
      vital_anomaly: {
        rule: 'device_vital_anomaly',
        title: '体征异常',
        severity: AlertSeverity.MEDIUM,
      },
    }[input.type];
    if (!meta) return null;

    const who = input.targetName || input.deviceName || '家人';
    return this.createAlertWithCooldown({
      userId: input.userId,
      serviceTargetId: input.serviceTargetId ?? null,
      category: AlertCategory.SERVICE_EXCEPTION,
      ruleCode: meta.rule,
      ruleName: meta.title,
      severity: meta.severity,
      title: `${who} · ${meta.title}`,
      summary: `设备「${input.deviceName ?? '陪伴设备'}」上报${meta.title}，请尽快确认老人状况。`,
      payload: { deviceId: input.deviceId, type: input.type, ...(input.payload ?? {}) },
      dedupKey: `device:${input.type}:${input.deviceId}`,
      suggestedActions: [
        { action: 'call_attendant', label: '联系护工' },
        { action: 'call_store', label: '联系门店' },
      ],
      notifyFamily: true,
      cooldownMinutes: 30,
    });
  }

  // ───────── 创建（带幂等 + 冷却） ─────────

  private async createAlertWithCooldown(input: CreateAlertInput) {
    const dedupKey = input.dedupKey;
    const cooldownMinutes = input.cooldownMinutes ?? 1440;
    if (dedupKey && cooldownMinutes > 0) {
      const cooldownStart = new Date(
        Date.now() - cooldownMinutes * 60 * 1000,
      );
      const existing = await this.alertRepo.findOne({
        where: {
          dedupKey,
          triggeredAt: MoreThanOrEqual(cooldownStart),
        },
      });
      if (existing) {
        this.logger.debug(
          `预警已在冷却期内被抑制: ${input.ruleCode} ${dedupKey}`,
        );
        return existing;
      }
    }

    const alert = this.alertRepo.create({
      userId: input.userId,
      serviceTargetId: input.serviceTargetId ?? null,
      orderId: input.orderId ?? null,
      category: input.category,
      ruleCode: input.ruleCode,
      ruleName: input.ruleName ?? null,
      severity: input.severity,
      title: input.title,
      summary: input.summary ?? null,
      payload: input.payload ?? null,
      suggestedActions: input.suggestedActions ?? null,
      status: AlertStatus.NEW,
      triggeredAt: input.triggeredAt ?? new Date(),
      dedupKey: dedupKey ?? null,
      notificationSent: false,
    });
    const saved = await this.alertRepo.save(alert);

    await this.writeLog(saved.id, {
      actorType: AlertLogActorType.SYSTEM,
      actorId: null,
      actorName: null,
      action: AlertLogAction.CREATE,
      note: null,
      payload: {
        ruleCode: input.ruleCode,
        ruleName: input.ruleName ?? null,
        severity: input.severity,
        dedupKey: input.dedupKey ?? null,
      },
    }).catch(() => void 0);

    if (input.notifyFamily) {
      this.notifyFamily(saved).catch((err) => {
        this.logger.warn(
          `推送家属预警失败 [alert=${saved.id}]: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
    return saved;
  }

  private async notifyFamily(alert: HealthAlert) {
    // 推送家属监护人（同家庭组且角色为 guardian）
    const owner = await this.userRepo.findOne({
      where: { id: alert.userId },
    });
    const guardianUsers: User[] = [];
    if (owner?.openid) guardianUsers.push(owner);

    // 补充同家庭组内其他 guardian
    const myGroups = await this.familyMemberRepo.find({
      where: { userId: alert.userId },
    });
    const groupIds = myGroups.map((m) => m.familyGroupId);
    if (groupIds.length > 0) {
      const guardians = await this.familyMemberRepo.find({
        where: { familyGroupId: In(groupIds), role: 'guardian' },
      });
      const guardianUserIds = Array.from(
        new Set(
          guardians.map((g) => g.userId).filter((uid) => uid !== alert.userId),
        ),
      );
      if (guardianUserIds.length > 0) {
        const extraUsers = await this.userRepo.find({
          where: { id: In(guardianUserIds) },
        });
        for (const u of extraUsers) {
          if (u.openid) guardianUsers.push(u);
        }
      }
    }

    if (guardianUsers.length === 0) {
      this.logger.debug(
        `预警 [${alert.id}] 无可推送的家属 openid，跳过订阅消息发送`,
      );
      return;
    }

    const severityLabel =
      alert.severity === AlertSeverity.HIGH
        ? '紧急'
        : alert.severity === AlertSeverity.MEDIUM
          ? '重要'
          : '提醒';
    const page = `pages/family/dashboard/dashboard`;

    let sent = false;
    for (const u of guardianUsers) {
      const ok = await this.notificationService.sendMiniProgramSubscribeMessage(
        u.openid!,
        'health_alert_notify',
        {
          thing1: alert.title,
          thing2: (alert.summary || '').slice(0, 18) || '点击查看详情',
          phrase3: severityLabel,
          time4: this.formatDateTime(alert.triggeredAt),
          __page: page,
        },
      );
      if (ok) sent = true;
    }

    alert.notificationSent = sent;
    alert.notificationSentAt = sent ? new Date() : alert.notificationSentAt;
    await this.alertRepo.save(alert);

    if (sent) {
      await this.writeLog(alert.id, {
        actorType: AlertLogActorType.SYSTEM,
        actorId: null,
        actorName: null,
        action: AlertLogAction.NOTIFY,
        note: `已向 ${guardianUsers.length} 位家属推送订阅消息`,
        payload: { recipients: guardianUsers.length },
      }).catch(() => void 0);
    }
  }

  // ───────── 工具方法 ─────────

  private async writeLog(
    alertId: number,
    entry: {
      actorType: AlertLogActorType;
      actorId: number | null;
      actorName: string | null;
      action: AlertLogAction;
      note: string | null;
      payload: Record<string, unknown> | null;
    },
  ) {
    try {
      return await this.alertLogRepo.save(
        this.alertLogRepo.create({
          alertId,
          actorType: entry.actorType,
          actorId: entry.actorId,
          actorName: entry.actorName,
          action: entry.action,
          note: entry.note,
          payload: entry.payload,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `写入告警日志失败 [alert=${alertId}]: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async resolveActorName(
    channel: 'admin' | 'family',
    userId: number,
  ): Promise<string | null> {
    if (channel === 'admin') {
      const op = await this.adminUserRepo.findOne({ where: { id: userId } });
      return op?.realName || op?.username || null;
    }
    return this.resolveUserName(userId);
  }

  private async resolveUserName(userId: number): Promise<string | null> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    return u?.nickname || null;
  }

  private resolveChannelByRole(role?: string): 'family' | 'admin' {
    if (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT ||
      role === UserRole.FINANCE
    ) {
      return 'admin';
    }
    return 'family';
  }

  private async getGuardedUserIds(userId: number): Promise<number[]> {
    const myGuardianships = await this.familyMemberRepo.find({
      where: { userId, role: 'guardian' },
    });
    if (myGuardianships.length === 0) return [];
    const groupIds = myGuardianships.map((m) => m.familyGroupId);
    const allMembers = await this.familyMemberRepo.find({
      where: { familyGroupId: In(groupIds) },
    });
    return Array.from(
      new Set(
        allMembers
          .map((m) => m.userId)
          .filter((u): u is number => u !== null && u !== userId),
      ),
    );
  }

  private async assertFamilyAccess(alertUserId: number, currentUserId: number) {
    if (alertUserId === currentUserId) return;
    const guardedIds = await this.getGuardedUserIds(currentUserId);
    if (!guardedIds.includes(alertUserId)) {
      throw new ForbiddenException('无权查看该预警');
    }
  }

  private toLocalDateString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private diffDays(todayStr: string, targetStr: string): number {
    const a = new Date(`${todayStr}T00:00:00`);
    const b = new Date(`${targetStr}T00:00:00`);
    return Math.floor((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
  }

  private formatDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
