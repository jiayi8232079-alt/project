import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentService } from '../document/document.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, Not, IsNull, In, MoreThan } from 'typeorm';
import { Order } from '../../entities/order.entity.js';
import { Hospital } from '../../entities/hospital.entity.js';
import { Review } from '../../entities/review.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { ServiceTimeline } from '../../entities/service-timeline.entity.js';
import { User } from '../../entities/user.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { ProfessionalService } from '../../entities/professional-service.entity.js';
import {
  MedicationReminder,
  ReminderChannel,
  ReminderFrequency,
  ReminderStatus,
  ReminderType,
} from '../../entities/medication-reminder.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { DispatchOrderDto } from './dto/dispatch-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { SetOrderEmergencyDto } from './dto/set-order-emergency.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SettlementStatus,
  TimelineType,
  UserRole,
} from '../../common/enums/index.js';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { AiConsultationService } from '../ai-consultation/ai-consultation.service.js';
import {
  signOrderTimelineShareToken,
  verifyOrderTimelineShareToken,
  ORDER_TIMELINE_SHARE_TTL_SEC,
} from '../../common/utils/order-timeline-share-token.js';
import {
  displayOrderRiskLabel,
  ensureOrderRiskLevelColumn,
  normalizeOrderRiskLevel,
} from './order-risk-level.js';
import { randomBytes } from 'node:crypto';
import { MpMonitorScene } from '../../entities/mp-monitor-scene.entity.js';

/**
 * 订单状态机。
 *
 * 主流程（happy path）：
 *   PENDING_DISPATCH → PENDING_ACCEPT → PENDING_SERVICE → IN_PROGRESS → COMPLETED
 *
 * 分支：
 *   - PENDING_DISPATCH → PENDING_GRAB → PENDING_SIGN → PENDING_SERVICE（抢单模式，暂未主链路使用）
 *   - IN_PROGRESS → PENDING_REVIEW：管理员 `PUT /orders/:id/status` 可显式挂起"待复核"态，
 *     常规完成链路会从 `finishOrder()` 直接走 IN_PROGRESS → COMPLETED，PENDING_REVIEW
 *     仅作为风控/争议留痕中间态存在（非死态，但普通流程不经过）。
 *   - IN_PROGRESS ↔ EMERGENCY：陪诊员/运营可进入或解除紧急处置。
 *
 * 任何状态转换都必须经过 validateTransition 校验，避免前端乱改状态。
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_DISPATCH]: [
    OrderStatus.PENDING_ACCEPT, // 指派后进入待确认，由陪诊员接受/拒绝
    OrderStatus.PENDING_GRAB,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PENDING_ACCEPT]: [
    OrderStatus.PENDING_SERVICE,
    OrderStatus.PENDING_DISPATCH,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PENDING_GRAB]: [
    OrderStatus.PENDING_ACCEPT, // 抢单池中的订单也允许后台改为定向指派
    OrderStatus.PENDING_SIGN,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PENDING_SIGN]: [
    OrderStatus.PENDING_SERVICE,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PENDING_SERVICE]: [
    OrderStatus.IN_PROGRESS,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.IN_PROGRESS]: [
    OrderStatus.COMPLETED,
    OrderStatus.PENDING_REVIEW,
    OrderStatus.EMERGENCY,
  ],
  [OrderStatus.PENDING_REVIEW]: [
    OrderStatus.COMPLETED,
    OrderStatus.IN_PROGRESS,
  ],
  [OrderStatus.EMERGENCY]: [
    OrderStatus.COMPLETED,
    OrderStatus.CANCELED,
    OrderStatus.IN_PROGRESS,
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELED]: [],
};

@Injectable()
export class OrderService {
  private static readonly SERVICE_REMINDER_HOURS = [24, 12, 2] as const;
  private static readonly COMPLETION_EDITABLE_DAYS = 2;
  private readonly logger = new Logger(OrderService.name);
  private riskLevelColumnReady = false;
  private mpAccessTokenCache: { token: string; expiresAtMs: number } | null = null;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ServiceTimeline)
    private readonly timelineRepository: Repository<ServiceTimeline>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    @InjectRepository(ServiceTarget)
    private readonly serviceTargetRepository: Repository<ServiceTarget>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(MedicationReminder)
    private readonly medicationReminderRepository: Repository<MedicationReminder>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    @InjectRepository(MpMonitorScene)
    private readonly mpMonitorSceneRepository: Repository<MpMonitorScene>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(FamilyMember)
    private readonly familyMemberRepository: Repository<FamilyMember>,
    @InjectRepository(ProfessionalService)
    private readonly professionalServiceRepository: Repository<ProfessionalService>,
    private readonly notificationService: NotificationService,
    private readonly storageService: StorageService,
    private readonly aiConsultationService: AiConsultationService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DocumentService))
    private readonly documentService: DocumentService,
  ) {}

  private async ensureRiskLevelColumnReady() {
    if (this.riskLevelColumnReady) return true;
    const ready = await ensureOrderRiskLevelColumn(this.orderRepository, this.logger);
    if (ready) {
      this.riskLevelColumnReady = true;
    }
    return ready;
  }

  /** 由 OrderModule.onApplicationBootstrap 调用，把列存在性检查放进冷启阶段。 */
  async ensureRiskLevelColumnReadyForBootstrap(): Promise<void> {
    const ok = await this.ensureRiskLevelColumnReady();
    if (!ok) {
      this.logger.warn(
        'ensureRiskLevelColumnReadyForBootstrap: failed at boot, will retry on first /orders.',
      );
    }
  }

  private attachRiskLevelMeta<T extends Order>(order: T): T & {
    riskLevel: string | null;
    riskLabel: string | null;
    riskLevelCode: string | null;
  } {
    const rawFromDb = String(
      (order as T & { riskLevel?: string | null }).riskLevel ?? '',
    ).trim();
    const riskLevel = normalizeOrderRiskLevel(rawFromDb);
    (order as T & { riskLevel: string | null }).riskLevel = riskLevel;
    (order as T & { riskLevelCode: string | null }).riskLevelCode = rawFromDb
      ? rawFromDb.toUpperCase()
      : null;
    (order as T & { riskLabel: string | null }).riskLabel =
      displayOrderRiskLabel(rawFromDb);
    return order as T & {
      riskLevel: string | null;
      riskLabel: string | null;
      riskLevelCode: string | null;
    };
  }

  /**
   * 删掉订单中仅管理端/陪诊员可见的内部字段，防止在 save() 返回内存对象时泄漏给普通用户。
   * 订单实体 `riskLevel` 虽有 `select:false`，但 repository.save() 返回的是内存对象，
   * 会把派单时设置的值一起吐回前端。
   */
  private stripInternalOrderFields<T>(order: T): T {
    if (!order || typeof order !== 'object') return order;
    const clone: any = Array.isArray(order) ? [...(order as any)] : { ...order };
    delete clone.riskLevel;
    delete clone.riskLevelCode;
    delete clone.riskLabel;
    return clone as T;
  }

  private getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.PENDING_DISPATCH]: '待派单',
      [OrderStatus.PENDING_ACCEPT]: '待接单',
      [OrderStatus.PENDING_GRAB]: '抢单中',
      [OrderStatus.PENDING_SIGN]: '待签到',
      [OrderStatus.PENDING_SERVICE]: '待服务',
      [OrderStatus.IN_PROGRESS]: '服务中',
      [OrderStatus.PENDING_REVIEW]: '服务已结束',
      [OrderStatus.COMPLETED]: '已完成',
      [OrderStatus.CANCELED]: '已取消',
      [OrderStatus.EMERGENCY]: '紧急',
    };
    return labels[status] || status;
  }

  private normalizeSettlementStatus(
    status?: string | SettlementStatus | null,
  ): SettlementStatus {
    return status === SettlementStatus.SETTLED
      ? SettlementStatus.SETTLED
      : SettlementStatus.PENDING;
  }

  private normalizePaymentStatus(
    status?: string | PaymentStatus | null,
  ): PaymentStatus {
    if (status === PaymentStatus.PAID) return PaymentStatus.PAID;
    if (status === PaymentStatus.REFUNDED) return PaymentStatus.REFUNDED;
    return PaymentStatus.UNPAID;
  }

  private normalizePaymentMethod(
    method?: string | PaymentMethod | null,
  ): PaymentMethod | null {
    if (!method) return null;
    const allowed = new Set(Object.values(PaymentMethod));
    return allowed.has(method as PaymentMethod)
      ? (method as PaymentMethod)
      : null;
  }

  private async appendStatusTimeline(params: {
    orderId: number;
    operatorId: number;
    fromStatus?: OrderStatus | null;
    toStatus: OrderStatus;
    note?: string;
    visibleToUser?: boolean;
  }) {
    const { orderId, operatorId, fromStatus, toStatus, note, visibleToUser } = params;
    const content = fromStatus
      ? `状态变更：${this.getStatusLabel(fromStatus)} → ${this.getStatusLabel(toStatus)}${note ? `（${note}）` : ''}`
      : `订单已创建，当前状态：${this.getStatusLabel(toStatus)}${note ? `（${note}）` : ''}`;

    await this.timelineRepository.save(
      this.timelineRepository.create({
        orderId,
        operatorId,
        type: TimelineType.NODE,
        content,
        visibleToUser: visibleToUser ?? true,
        metadata: {
          fromStatus: fromStatus || null,
          toStatus,
          note: note || '',
        },
      }),
    );
  }

  validateTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(`不允许从 "${from}" 转换到 "${to}"`);
    }
  }

  private async resolveAttendantIdByUserId(userId: number): Promise<number> {
    const attendant = await this.attendantRepository.findOne({
      where: { userId },
    });
    if (!attendant) {
      throw new BadRequestException('当前账号未绑定陪诊员身份');
    }
    return attendant.id;
  }

  private parseHealthProfile(
    value?: Record<string, unknown> | string | null,
  ): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value || '{}');
      } catch {
        return {};
      }
    }
    return value as Record<string, any>;
  }

  private normalizeCompletionImages(value?: unknown): string[] {
    return (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  private normalizeCompletionFiles(value?: unknown): { url: string; name: string }[] {
    const safeDecode = (input: string) => {
      try {
        return decodeURIComponent(input);
      } catch {
        return input;
      }
    };
    const seen = new Set<string>();
    return (Array.isArray(value) ? value : [])
      .map((item) => {
        if (typeof item === 'string') {
          const url = item.trim();
          const name = safeDecode(url.split('?')[0]?.split('/').pop() || '附件');
          return { url, name };
        }
        const url = String((item as any)?.url || (item as any)?.path || '').trim();
        const rawName = String((item as any)?.name || '').trim();
        const name =
          rawName ||
          safeDecode(url.split('?')[0]?.split('/').pop() || '附件');
        return { url, name };
      })
      .filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
  }

  private normalizeCompletionMedications(
    value?: unknown,
  ): {
    name: string;
    usage: string;
    reminderTime: string;
    startDate: string;
    endDate: string;
  }[] {
    return (Array.isArray(value) ? value : [])
      .map((item) => ({
        name: String((item as any)?.name || '').trim(),
        usage: String((item as any)?.usage || '').trim(),
        reminderTime: String((item as any)?.reminderTime || '').trim(),
        startDate: String((item as any)?.startDate || '').trim(),
        endDate: String((item as any)?.endDate || '').trim(),
      }))
      .filter(
        (item) =>
          item.name ||
          item.usage ||
          item.reminderTime ||
          item.startDate ||
          item.endDate,
      );
  }

  private normalizeCompletionPayload(body: {
    diagnosisResult?: string;
    doctorAdvice?: string;
    summary?: string;
    followUpDate?: string;
    followUpNote?: string;
    followUpHospital?: string;
    followUpDepartment?: string;
    medicationMode?: string;
    images?: unknown[];
    files?: unknown[];
    medications?: unknown[];
  }) {
    const diagnosisResult = String(body?.diagnosisResult || '').trim();
    const doctorAdvice = String(body?.doctorAdvice || '').trim();
    const summary = String(body?.summary || body?.doctorAdvice || '').trim();
    const medications = this.normalizeCompletionMedications(body?.medications);
    const medicationMode =
      body?.medicationMode === 'has' || body?.medicationMode === 'none'
        ? body.medicationMode
        : medications.length > 0
          ? 'has'
          : '';

    return {
      diagnosisResult,
      doctorAdvice: doctorAdvice || summary,
      summary,
      followUpDate: String(body?.followUpDate || '').trim(),
      followUpNote: String(body?.followUpNote || '').trim(),
      followUpHospital: String(body?.followUpHospital || '').trim(),
      followUpDepartment: String(body?.followUpDepartment || '').trim(),
      medicationMode,
      medications,
      images: this.normalizeCompletionImages(body?.images),
      files: this.normalizeCompletionFiles(body?.files),
    };
  }

  private assertFollowUpCompletionFields(normalized: {
    followUpDate?: string;
    followUpHospital?: string;
    followUpDepartment?: string;
  }) {
    if (
      normalized.followUpDate &&
      (!normalized.followUpHospital || !normalized.followUpDepartment)
    ) {
      throw new BadRequestException('已填写复诊日期时，请补充复诊医院和复诊科室');
    }
  }

  private getCompletionStatusTimeline(
    order?: Pick<Order, 'timelines'> | null,
    status: OrderStatus = OrderStatus.COMPLETED,
  ): ServiceTimeline | null {
    const timelines = Array.isArray(order?.timelines) ? order.timelines : [];
    const matched = timelines
      .filter((item) => item?.metadata?.toStatus === status)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    return matched[0] || null;
  }

  private getCompletionReadonlyMessage() {
    return `服务结束汇总已超过 ${OrderService.COMPLETION_EDITABLE_DAYS} 天修改时限，当前仅支持查看`;
  }

  private getCompletionEditableNotice() {
    return `陪诊员已确认本次服务完成，服务结束汇总可在 ${OrderService.COMPLETION_EDITABLE_DAYS} 天内补充或修改`;
  }

  private buildCompletionAccessMeta(
    order?: Pick<Order, 'status' | 'timelines'> | null,
  ) {
    const completedTimeline = this.getCompletionStatusTimeline(
      order,
      OrderStatus.COMPLETED,
    );
    const completedAt = completedTimeline?.createdAt
      ? new Date(completedTimeline.createdAt)
      : null;
    const editableUntil = completedAt
      ? new Date(
          completedAt.getTime() +
            OrderService.COMPLETION_EDITABLE_DAYS * 24 * 60 * 60 * 1000,
        )
      : null;
    const expired = !!editableUntil && Date.now() > editableUntil.getTime();
    const readOnly = order?.status === OrderStatus.COMPLETED && expired;

    return {
      completionCompletedAt: completedAt?.toISOString() || '',
      completionEditableUntil: editableUntil?.toISOString() || '',
      completionCanEdit: !readOnly,
      completionReadOnly: readOnly,
      completionReadonlyReason: readOnly ? this.getCompletionReadonlyMessage() : '',
    };
  }

  private async attachCompletionAccessMetaToOrders<T extends Order>(orders: T[]) {
    if (!orders.length) return orders as Array<
      T & ReturnType<OrderService['buildCompletionAccessMeta']>
    >;

    const timelines = await this.timelineRepository.find({
      where: {
        orderId: In(orders.map((item) => item.id)),
        type: TimelineType.NODE,
      },
      order: { createdAt: 'DESC' },
    });

    const completedTimelineMap = new Map<number, ServiceTimeline>();
    for (const timeline of timelines) {
      if (
        timeline?.metadata?.toStatus === OrderStatus.COMPLETED &&
        !completedTimelineMap.has(timeline.orderId)
      ) {
        completedTimelineMap.set(timeline.orderId, timeline);
      }
    }

    return orders.map((order) => {
      const result = order as T & ReturnType<OrderService['buildCompletionAccessMeta']>;
      Object.assign(
        result,
        this.buildCompletionAccessMeta({
          status: order.status,
          timelines: completedTimelineMap.has(order.id)
            ? [completedTimelineMap.get(order.id)!]
            : [],
        }),
      );
      return result;
    });
  }

  private evaluateCompletionPayload(payload?: Record<string, unknown> | null) {
    const normalized = this.normalizeCompletionPayload((payload || {}) as any);
    const summaryReady = !!normalized.summary;
    const proofReady =
      normalized.images.length > 0 || normalized.files.length > 0;
    const medicationReady =
      normalized.medicationMode === 'none' ||
      (normalized.medicationMode === 'has' &&
        normalized.medications.length > 0 &&
        normalized.medications.every(
          (item) =>
            !!(
              item.name &&
              item.usage &&
              item.reminderTime &&
              item.startDate &&
              item.endDate
            ),
        ));

    return {
      normalized,
      summaryReady,
      proofReady,
      medicationReady,
      ready: summaryReady && proofReady && medicationReady,
    };
  }

  private assertCompletionReady(payload?: Record<string, unknown> | null) {
    const evaluation = this.evaluateCompletionPayload(payload);
    this.assertFollowUpCompletionFields(evaluation.normalized);
    if (evaluation.ready) {
      return evaluation.normalized;
    }
    throw new BadRequestException(
      '请先补齐服务总结、报告单据凭证，并确认用药提醒信息后再结束订单',
    );
  }

  private async syncCompletionReminders(
    order: Order,
    completionData: Record<string, unknown> | null,
    operatorId: number,
  ) {
    const normalized = this.normalizeCompletionPayload((completionData || {}) as any);
    const existing = await this.medicationReminderRepository.find({
      where: {
        orderId: order.id,
        reminderType: ReminderType.MEDICATION,
      },
    });
    if (existing.length) {
      await this.medicationReminderRepository.remove(existing);
    }
    if (normalized.medicationMode !== 'has' || !normalized.medications.length) {
      return [];
    }

    const reminders = normalized.medications.map((item) =>
      this.medicationReminderRepository.create({
        userId: order.userId,
        serviceTargetId: order.serviceTargetId || undefined,
        orderId: order.id,
        medicineName: item.name,
        dosage: item.usage || '',
        frequency: ReminderFrequency.DAILY,
        reminderTimes: [item.reminderTime],
        startDate: item.startDate,
        endDate: item.endDate,
        instructions: item.usage || '',
        status: ReminderStatus.ACTIVE,
        channel: ReminderChannel.ALL,
        reminderType: ReminderType.MEDICATION,
        createdBy: operatorId,
      }),
    );
    return this.medicationReminderRepository.save(reminders);
  }

  private async syncFollowUpReminder(
    order: Order,
    completionData: Record<string, unknown> | null,
    operatorId: number,
  ) {
    const normalized = this.normalizeCompletionPayload((completionData || {}) as any);
    const existing = await this.medicationReminderRepository.find({
      where: {
        orderId: order.id,
        reminderType: ReminderType.FOLLOW_UP,
      },
    });
    if (existing.length) {
      await this.medicationReminderRepository.remove(existing);
    }

    if (!normalized.followUpDate) {
      return null;
    }

    this.assertFollowUpCompletionFields(normalized);

    const reminder = this.medicationReminderRepository.create({
      userId: order.userId,
      serviceTargetId: order.serviceTargetId || undefined,
      orderId: order.id,
      medicineName: '复诊提醒',
      dosage: '',
      frequency: ReminderFrequency.ONCE,
      reminderTimes: ['09:00'],
      startDate: normalized.followUpDate,
      endDate: normalized.followUpDate,
      instructions: normalized.followUpNote || '请按时复诊并提前准备相关资料',
      followUpHospital: normalized.followUpHospital || '',
      followUpDepartment: normalized.followUpDepartment || '',
      status: ReminderStatus.ACTIVE,
      channel: ReminderChannel.ALL,
      reminderType: ReminderType.FOLLOW_UP,
      createdBy: operatorId,
    });
    return this.medicationReminderRepository.save(reminder);
  }

  private maskName(name?: string | null): string {
    const v = (name || '').trim();
    if (!v) return '';
    const chars = Array.from(v);
    if (chars.length === 1) return `${chars[0]}*`;
    if (chars.length === 2) return `${chars[0]}*`;
    return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
  }

  private async resolveCompletionAssetUrl(url?: string | null): Promise<string> {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
      return await this.storageService.resolveUrl(raw);
    } catch {
      return raw;
    }
  }

  private async attachResolvedCompletionData<T extends Order>(order: T): Promise<T> {
    const raw = (order as any)?.completionData;
    if (!raw || typeof raw !== 'object') return order;

    const images = Array.isArray(raw.images)
      ? (await Promise.all(
          raw.images.map((item: any) =>
            this.resolveCompletionAssetUrl(String(item || '').trim()),
          ),
        )).filter(Boolean)
      : raw.images;

    const files = Array.isArray(raw.files)
      ? (await Promise.all(
          raw.files.map(async (item: any) => {
            if (typeof item === 'string') {
              return await this.resolveCompletionAssetUrl(item);
            }
            const source = String(item?.url || item?.path || '').trim();
            const resolved = await this.resolveCompletionAssetUrl(source);
            return {
              ...item,
              url: resolved || source,
              path: resolved || source,
            };
          }),
        )).filter(Boolean)
      : raw.files;

    (order as any).completionData = {
      ...raw,
      images,
      files,
    };

    return order;
  }

  /** 陪诊履约页「健康小档案」条目（结构化便于小程序展示） */
  private buildAttendantHealthSummaryLines(
    hp: Record<string, any>,
    target: ServiceTarget,
  ): { label: string; value: string }[] {
    const MED: Record<string, string> = {
      none: '无',
      hypertension: '高血压',
      heart: '心脏病',
      cerebrovascular: '脑血管疾病',
      diabetes: '糖尿病',
      epilepsy: '癫痫',
      asthma: '哮喘/慢阻肺',
      mental: '精神类疾病',
      cancer: '癌症',
      other: '其他',
    };
    const SYM: Record<string, string> = {
      none: '无明显症状',
      syncope: '晕厥/眩晕/跌倒',
      chest_pain: '胸痛/胸闷/心慌',
      dyspnea: '呼吸困难',
      fatigue: '乏力/疲劳',
      pain: '持续性疼痛',
      insomnia: '失眠/睡眠障碍',
      appetite_loss: '食欲下降',
    };
    const visionMap: Record<string, string> = {
      good: '正常',
      poor: '视力减退',
      blind: '严重视力障碍',
    };
    const hearingMap: Record<string, string> = {
      good: '正常',
      poor: '听力减退',
      deaf: '严重听力障碍',
    };
    const fillMethodMap: Record<string, string> = {
      self: '本人自填',
      dictation: '本人口述代填',
      proxy: '家属代填',
      other: '其他',
    };
    const mobilityMap: Record<string, string> = {
      independent: '行动自如',
      mild_assist: '需轻度辅助',
      wheelchair: '需轮椅',
      bedridden: '卧床',
    };
    const lines: { label: string; value: string }[] = [];
    const push = (label: string, value?: string | null) => {
      const v = String(value || '').trim();
      if (v) lines.push({ label, value: v });
    };
    const fm = String(hp.fillMethod || 'self').trim();
    const mb = String(hp.mobilityStatus || 'independent').trim();
    push('信息记录方式', fillMethodMap[fm] || fm);
    push('行动能力', mobilityMap[mb] || mb);
    push('血型', hp.bloodType);
    if (hp.allergyStatus === 'has') push('过敏', hp.allergies);
    else if (hp.allergyStatus === 'none') push('过敏', '无明确过敏记录');
    const mhArr = Array.isArray(hp.medicalHistoryArr)
      ? hp.medicalHistoryArr
      : Array.isArray(hp.medicalHistory)
        ? hp.medicalHistory
        : [];
    const mhFiltered = mhArr.filter((k: string) => k && k !== 'none');
    if (mhFiltered.length) {
      const text = mhFiltered.map((k: string) => MED[k] || k).join('、');
      push(
        '既往病史',
        hp.medicalHistoryOther ? `${text}；${hp.medicalHistoryOther}` : text,
      );
    } else if (hp.medicalHistoryOther) {
      push('既往病史', hp.medicalHistoryOther);
    }
    if (hp.visionStatus)
      push('视力', visionMap[hp.visionStatus] || hp.visionStatus);
    if (hp.hearingStatus)
      push('听力', hearingMap[hp.hearingStatus] || hp.hearingStatus);
    const rs = Array.isArray(hp.recentSymptoms) ? hp.recentSymptoms : [];
    const rsF = rs.filter((k: string) => k && k !== 'none');
    if (rsF.length) push('近期症状', rsF.map((k: string) => SYM[k] || k).join('、'));
    const med = hp.currentMedications || hp.currentMedication;
    push('当前用药', med);
    push('其他健康说明', hp.otherHealthInfo);
    push('主诉/关注', target.mainAppeal || hp.chiefComplaint);
    const er = String(hp.emergencyRelation || '').trim();
    if (er) push('与紧急联系人关系', er);
    return lines;
  }

  private maskPhone(phone?: string | null): string {
    const v = (phone || '').trim();
    if (!v) return '';
    const digits = v.replace(/\D/g, '');
    if (digits.length >= 11) {
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
    }
    if (digits.length >= 7) {
      return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
    }
    if (digits.length >= 2) {
      return `${digits[0]}***${digits[digits.length - 1]}`;
    }
    return `${digits}***`;
  }

  private maskIdCard(idCard?: string | null): string {
    const v = (idCard || '').trim();
    if (!v) return '';
    if (v.length <= 8) return `${v.slice(0, 2)}****${v.slice(-2)}`;
    return `${v.slice(0, 4)}**********${v.slice(-4)}`;
  }

  private isAdminLikeRole(role?: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.FINANCE ||
      role === UserRole.MEDICAL_CONSULTANT
    );
  }

  private async assertServiceTargetOwnership(
    serviceTargetId: number,
    targetUserId: number,
  ) {
    const serviceTarget = await this.serviceTargetRepository.findOne({
      where: { id: serviceTargetId },
    });
    if (!serviceTarget) {
      throw new BadRequestException('服务对象不存在');
    }
    if (serviceTarget.userId !== targetUserId) {
      throw new BadRequestException('服务对象不属于当前下单用户');
    }
  }

  private buildProvisionalOrderNumber(): string {
    return `TMP${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private buildFinalOrderNumber(order: Pick<Order, 'id' | 'createdAt'>): string {
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const y = createdAt.getFullYear();
    const m = String(createdAt.getMonth() + 1).padStart(2, '0');
    const d = String(createdAt.getDate()).padStart(2, '0');
    // 日期 8 位 + 订单 id 左补零 6 位（如 20260415000123）。
    // 早前用 4 位会在 id 突破 9999 后长度跳到 5 位，前端定宽列会错位。
    // 6 位可支撑到 999999 单同时仍保持等宽；
    // 真到那一天前后端可同时升 7 位，不影响已有数据（位数只增不减）。
    const idPart = String(order.id).padStart(6, '0');
    return `${y}${m}${d}${idPart}`;
  }

  private normalizeCheckupOptionalItems(
    items?: { id: string; name: string; price: number }[] | null,
  ) {
    return (Array.isArray(items) ? items : [])
      .filter(
        (item): item is { id: string; name: string; price: number } =>
          !!item &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .map((item, index) => ({
        id:
          item.id ||
          `checkup_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        name: item.name.trim(),
        price: Number(item.price || 0),
      }));
  }

  private normalizeAdditionalServiceItems(
    items?:
      | { id?: string; name?: string; amount?: number; note?: string }[]
      | null,
  ) {
    return (Array.isArray(items) ? items : [])
      .filter(
        (
          item,
        ): item is {
          id?: string;
          name?: string;
          amount?: number;
          note?: string;
        } =>
          !!item &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .map((item, index) => ({
        id:
          item.id ||
          `addon_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        name: String(item.name).trim(),
        amount: Number(item.amount || 0),
        note: item.note?.trim() || '',
      }));
  }

  private normalizeAttendantExtraIncomeItems(
    items?:
      | { id?: string; name?: string; amount?: number; note?: string }[]
      | null,
  ) {
    return (Array.isArray(items) ? items : [])
      .filter(
        (
          item,
        ): item is {
          id?: string;
          name?: string;
          amount?: number;
          note?: string;
        } =>
          !!item &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .map((item, index) => ({
        id:
          item.id ||
          `att_income_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        name: String(item.name).trim(),
        amount: Number(item.amount || 0),
        note: item.note?.trim() || '',
      }));
  }

  private calculateCheckupOptionalTotal(
    items?: { price?: number | null }[] | null,
  ) {
    return Number(
      (items || [])
        .reduce((sum, item) => sum + Number(item?.price || 0), 0)
        .toFixed(2),
    );
  }

  private calculateAdditionalServiceTotal(
    items?: { amount?: number | null }[] | null,
  ) {
    return Number(
      (items || [])
        .reduce((sum, item) => sum + Number(item?.amount || 0), 0)
        .toFixed(2),
    );
  }

  private calculateSettlementTotal(params: {
    baseFee?: number | null;
    checkupOptionalItems?: { price: number }[] | null;
    additionalServiceItems?: { amount: number }[] | null;
  }) {
    const baseFee = Number(params.baseFee || 0);
    const checkupOptionalTotal = this.calculateCheckupOptionalTotal(
      params.checkupOptionalItems,
    );
    const additionalServiceTotal = this.calculateAdditionalServiceTotal(
      params.additionalServiceItems,
    );
    return Number(
      (baseFee + checkupOptionalTotal + additionalServiceTotal).toFixed(2),
    );
  }

  private buildSettlementSummary(order: Order) {
    const items: {
      label: string;
      amount: string;
      category: string;
      note?: string;
    }[] = [];

    const baseFee = Number(order.baseFee || 0);
    if (baseFee > 0) {
      items.push({
        label: '基础服务费',
        amount: baseFee.toFixed(2),
        category: 'base',
      });
    }
    this.normalizeCheckupOptionalItems(order.checkupOptionalItems).forEach(
      (item) => {
        items.push({
          label: item.name,
          amount: Number(item.price || 0).toFixed(2),
          category: 'checkup_optional',
          note: '体检附加项目',
        });
      },
    );
    this.normalizeAdditionalServiceItems(order.additionalServiceItems).forEach(
      (item) => {
        items.push({
          label: item.name,
          amount: Number(item.amount || 0).toFixed(2),
          category: 'additional_service',
          note: item.note || '',
        });
      },
    );

    return {
      items,
      total: Number(
        items
          .reduce((sum, item) => sum + Number(item.amount || 0), 0)
          .toFixed(2),
      ),
      baseFee,
      checkupOptionalTotal: this.calculateCheckupOptionalTotal(
        order.checkupOptionalItems,
      ),
      additionalServiceTotal: this.calculateAdditionalServiceTotal(
        order.additionalServiceItems,
      ),
    };
  }

  private attachSettlementSummary<T extends Order>(order: T): T & {
    settlementBreakdown: ReturnType<OrderService['buildSettlementSummary']>;
  } {
    const settlementBreakdown = this.buildSettlementSummary(order);
    (order as T & {
      settlementBreakdown: ReturnType<OrderService['buildSettlementSummary']>;
    }).settlementBreakdown = settlementBreakdown;
    this.attachReviewSummary(order);
    return order as T & {
      settlementBreakdown: ReturnType<OrderService['buildSettlementSummary']>;
    };
  }

  /**
   * 将订单已有评价摘要挂到订单对象上，便于列表/详情统一使用。
   * - reviewed：订单是否已有评价
   * - reviewRating：客户端本人/任意一条评价的星级
   * - reviewSummary：精简评价信息，用于列表展示
   */
  private attachReviewSummary<T extends Order>(order: T): T {
    const reviews = (order.reviews as Review[] | undefined) ?? [];
    const reviewed = reviews.length > 0;
    const userReview =
      reviews.find((r) => order.userId && r.userId === order.userId) ||
      reviews[0];

    const anyOrder = order as unknown as {
      reviewed: boolean;
      reviewRating: number | null;
      reviewSummary:
        | {
            id: number;
            rating: number;
            comment: string;
            tags: string[];
            createdAt: string | null;
          }
        | null;
    };
    anyOrder.reviewed = reviewed;
    anyOrder.reviewRating = userReview ? userReview.rating : null;
    if (userReview) {
      const comment = (userReview.comment || '').trim();
      anyOrder.reviewSummary = {
        id: userReview.id,
        rating: userReview.rating,
        comment: comment.length > 80 ? `${comment.slice(0, 80)}…` : comment,
        tags: Array.isArray(userReview.tags) ? userReview.tags : [],
        createdAt: userReview.createdAt
          ? new Date(userReview.createdAt).toISOString()
          : null,
      };
    } else {
      anyOrder.reviewSummary = null;
    }
    return order;
  }

  private applySettlementFields(
    order: Order,
    payload: {
      baseFee?: number | null;
      totalFee?: number | null;
      checkupOptionalItems?: { id: string; name: string; price: number }[] | null;
      additionalServiceItems?: {
        id?: string;
        name?: string;
        amount?: number;
        note?: string;
      }[] | null;
      attendantExtraIncomeItems?: {
        id?: string;
        name?: string;
        amount?: number;
        note?: string;
      }[] | null;
      settlementStatus?: string | SettlementStatus | null;
      paymentStatus?: string | PaymentStatus | null;
      paymentMethod?: string | PaymentMethod | null;
      paymentPaidAt?: string | Date | null;
      paymentReference?: string | null;
      settledAt?: string | Date | null;
      settlementRemark?: string | null;
    },
  ) {
    if (payload.baseFee !== undefined) {
      order.baseFee =
        payload.baseFee == null ? (null as any) : Number(payload.baseFee);
    }
    if (payload.checkupOptionalItems !== undefined) {
      order.checkupOptionalItems = this.normalizeCheckupOptionalItems(
        payload.checkupOptionalItems,
      ) as any;
    }
    if (payload.additionalServiceItems !== undefined) {
      order.additionalServiceItems = this.normalizeAdditionalServiceItems(
        payload.additionalServiceItems,
      ) as any;
    }
    if (payload.attendantExtraIncomeItems !== undefined) {
      order.attendantExtraIncomeItems = this.normalizeAttendantExtraIncomeItems(
        payload.attendantExtraIncomeItems,
      ) as any;
    }
    if (payload.settlementStatus !== undefined) {
      order.settlementStatus = this.normalizeSettlementStatus(
        payload.settlementStatus,
      ) as any;
    }
    if (payload.paymentStatus !== undefined) {
      order.paymentStatus = this.normalizePaymentStatus(
        payload.paymentStatus,
      ) as any;
    }
    if (payload.paymentMethod !== undefined) {
      order.paymentMethod = this.normalizePaymentMethod(
        payload.paymentMethod,
      ) as any;
    }
    if (payload.paymentPaidAt !== undefined) {
      order.paymentPaidAt = payload.paymentPaidAt
        ? (new Date(payload.paymentPaidAt) as any)
        : null;
    }
    if (payload.paymentReference !== undefined) {
      order.paymentReference = payload.paymentReference?.trim() || null;
    }
    if (payload.settledAt !== undefined) {
      order.settledAt = payload.settledAt
        ? (new Date(payload.settledAt) as any)
        : null;
    }
    if (payload.settlementRemark !== undefined) {
      order.settlementRemark = payload.settlementRemark?.trim() || null;
    }

    const hasBreakdown =
      Number(order.baseFee || 0) > 0 ||
      (order.checkupOptionalItems?.length || 0) > 0 ||
      (order.additionalServiceItems?.length || 0) > 0;

    if (hasBreakdown) {
      order.totalFee = this.calculateSettlementTotal({
        baseFee: order.baseFee,
        checkupOptionalItems: order.checkupOptionalItems,
        additionalServiceItems: order.additionalServiceItems,
      }) as any;
    } else if (payload.totalFee !== undefined) {
      order.totalFee =
        payload.totalFee == null ? (null as any) : Number(payload.totalFee);
    }

    if (order.paymentStatus === PaymentStatus.PAID && !order.paymentPaidAt) {
      order.paymentPaidAt = new Date() as any;
    }
    if (order.settlementStatus === SettlementStatus.SETTLED && !order.settledAt) {
      order.settledAt = new Date() as any;
    }
    if (order.paymentStatus === PaymentStatus.UNPAID) {
      order.paymentMethod = null as any;
      order.paymentPaidAt = null as any;
      order.paymentReference = null as any;
    }
    if (order.settlementStatus === SettlementStatus.PENDING) {
      order.settledAt = null as any;
    }
  }

  private async assertOrderAccess(
    order: Order,
    currentUserId: number,
    role: string,
  ) {
    if (this.isAdminLikeRole(role)) return;
    if (role === UserRole.ATTENDANT) {
      const attendantId = await this.resolveAttendantIdByUserId(currentUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权访问该订单');
      }
      return;
    }
    if (order.userId !== currentUserId) {
      throw new ForbiddenException('无权访问该订单');
    }
  }

  private clearAttendantLiveFields(order: Order) {
    order.attendantLiveLat = null;
    order.attendantLiveLng = null;
    order.attendantLiveAt = null;
  }

  /** 陪诊员（或管理员代为）上报实时位置（GCJ-02），仅进行中订单 */
  async updateAttendantLiveLocation(
    orderId: number,
    operatorUserId: number,
    latitude: number,
    longitude: number,
    role?: string,
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('无效的定位坐标');
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('坐标超出有效范围');
    }
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const isAdmin = this.isAdminLikeRole(role);
    if (!isAdmin) {
      const attendantId = await this.resolveAttendantIdByUserId(operatorUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权操作此订单');
      }
    }
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.EMERGENCY
    ) {
      throw new BadRequestException('仅服务进行中或紧急处置阶段可上报位置');
    }
    order.attendantLiveLat = lat;
    order.attendantLiveLng = lng;
    order.attendantLiveAt = new Date();
    await this.orderRepository.save(order);
    return {
      ok: true,
      latitude: lat,
      longitude: lng,
      updatedAt: order.attendantLiveAt.toISOString(),
    };
  }

  /** 用户或陪诊员查看陪诊员最近位置 */
  async getAttendantLiveLocation(orderId: number, currentUserId: number, role: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    await this.assertOrderAccess(order, currentUserId, role);
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.EMERGENCY
    ) {
      return {
        active: false,
        latitude: null as number | null,
        longitude: null as number | null,
        updatedAt: null as string | null,
      };
    }
    if (order.attendantLiveLat == null || order.attendantLiveLng == null) {
      return {
        active: true,
        latitude: null,
        longitude: null,
        updatedAt: order.attendantLiveAt ? new Date(order.attendantLiveAt).toISOString() : null,
      };
    }
    return {
      active: true,
      latitude: Number(order.attendantLiveLat),
      longitude: Number(order.attendantLiveLng),
      updatedAt: order.attendantLiveAt ? new Date(order.attendantLiveAt).toISOString() : null,
    };
  }

  /** 与更新订单时名录展示格式一致（城市+区县+医院名） */
  private formatHospitalDirectoryLine(h: Pick<Hospital, 'name' | 'city' | 'district'>): string {
    if (h.district) {
      return `${h.name}（${h.city}${h.district}）`;
    }
    return `${h.name}（${h.city}）`;
  }

  private async applyHospitalFieldsOnCreate(
    order: Order,
    hospitalDirectoryId: number | undefined,
    dtoHospital: string | undefined,
    dtoDepartment: string | undefined,
  ) {
    if (hospitalDirectoryId != null && Number(hospitalDirectoryId) > 0) {
      const hid = Number(hospitalDirectoryId);
      const hRow = await this.hospitalRepository.findOne({
        where: { id: hid, isActive: true },
      });
      if (!hRow) {
        throw new BadRequestException('名录中未找到该医院或已停用');
      }
      order.hospitalDirectoryId = hRow.id;
      order.hospital = this.formatHospitalDirectoryLine(hRow);
    } else {
      order.hospitalDirectoryId = null;
      const h = dtoHospital == null ? '' : String(dtoHospital).trim();
      order.hospital = h;
    }
    const d = dtoDepartment == null ? '' : String(dtoDepartment).trim();
    order.department = d;
  }

  /**
   * 解析订单提交时的专业服务引用：
   *   - admin 后台传 professionalServiceCode（字符串）；
   *   - 新接入方（小程序/第三方）可传 professionalServiceId（数字）；
   * 任一存在时校验存在 + 启用，并返回 DB 实际使用的 id。
   */
  private async resolveProfessionalServiceId(dto: CreateOrderDto): Promise<number | null> {
    if (dto.professionalServiceId) {
      const ps = await this.professionalServiceRepository.findOne({
        where: { id: dto.professionalServiceId },
      });
      if (!ps) throw new BadRequestException('专业服务不存在');
      if (!ps.enabled) throw new BadRequestException('该专业服务已下架');
      return ps.id;
    }
    if (dto.professionalServiceCode) {
      const ps = await this.professionalServiceRepository.findOne({
        where: { code: dto.professionalServiceCode },
      });
      if (!ps) throw new BadRequestException('专业服务不存在');
      if (!ps.enabled) throw new BadRequestException('该专业服务已下架');
      return ps.id;
    }
    return null;
  }

  /**
   * 记录服务者对 SOP 步骤的打勾进度。
   *
   * 打勾数据结构存在 `order.completionData.sopProgress`：
   *   [{ stepIndex, checked, note?, checkedAt, checkedBy }]
   *
   * 为保持向前兼容，只往 completionData 里塞新的 key，不影响老的 summary/proof/medication 三项必填校验。
   */
  async saveSopProgress(
    orderId: number,
    operatorId: number,
    progress: Array<{ stepIndex: number; checked: boolean; note?: string }>,
  ): Promise<{ sopProgress: Record<string, unknown> }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const now = new Date().toISOString();
    const raw = (order.completionData as any) || {};
    const map = { ...(raw.sopProgress || {}) } as Record<string, unknown>;
    for (const item of progress || []) {
      const idx = Number(item.stepIndex);
      if (!Number.isFinite(idx) || idx < 0) continue;
      map[idx] = {
        checked: !!item.checked,
        note: item.note ? String(item.note).slice(0, 255) : '',
        checkedAt: item.checked ? now : null,
        checkedBy: operatorId,
      };
    }
    order.completionData = { ...raw, sopProgress: map } as Record<string, unknown>;
    await this.orderRepository.save(order);
    return { sopProgress: map };
  }

  async create(userId: number, dto: CreateOrderDto, isAdmin = false) {
    // 非管理员不允许预设价格和派单字段，防止用户端绕过定价与派单流程
    if (!isAdmin) {
      dto.attendantId = undefined;
      dto.totalFee = undefined;
      dto.baseFee = undefined;
    }
    await this.assertServiceTargetOwnership(dto.serviceTargetId, userId);
    if (dto.serviceEndTime) {
      const start = new Date(dto.serviceTime);
      const end = new Date(dto.serviceEndTime);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
        throw new BadRequestException('服务结束时间不能早于开始时间');
      }
    }
    const resolvedPsId = await this.resolveProfessionalServiceId(dto);
    const {
      userId: _ignore,
      hospitalDirectoryId,
      hospital: dtoHospital,
      department: dtoDepartment,
      professionalServiceCode: _psCode,
      professionalServiceCategory: _psCat,
      professionalServiceId: _psId,
      ...rest
    } = dto as any;
    // 用户端创建订单不再携带 riskLevel（已从 DTO 移除，ValidationPipe 会直接 400）。
    // 管理端需要设置风险等级请改走 PUT /orders/:id。
    const riskLevel = null;
    // 创建时若不需要陪诊员，直接进入待服务；若已指定陪诊员，进入待确认
    let status: OrderStatus;
    if (dto.needAttendant === false) {
      status = OrderStatus.PENDING_SERVICE;
    } else if (dto.attendantId) {
      status = OrderStatus.PENDING_ACCEPT;
    } else {
      status = OrderStatus.PENDING_DISPATCH;
    }
    const order = this.orderRepository.create({
      ...rest,
      riskLevel,
      userId,
      orderNumber: this.buildProvisionalOrderNumber(),
      status,
      professionalServiceId: resolvedPsId,
    } as Partial<Order>);
    this.applySettlementFields(order, {
      baseFee: dto.baseFee,
      totalFee: dto.totalFee,
      checkupOptionalItems: dto.checkupOptionalItems,
      additionalServiceItems: dto.additionalServiceItems as any,
    });
    await this.applyHospitalFieldsOnCreate(order, hospitalDirectoryId, dtoHospital, dtoDepartment);
    const saved = await this.orderRepository.save(order);
    saved.orderNumber = this.buildFinalOrderNumber(saved);
    await this.orderRepository.save(saved);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: userId,
      fromStatus: null,
      toStatus: saved.status,
      note: '订单创建',
    });
    return this.stripInternalOrderFields(saved);
  }

  async updateOrder(
    id: number,
    dto: UpdateOrderDto,
    operatorId?: number,
  ) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');

    const financeBefore = {
      baseFee: order.baseFee,
      totalFee: order.totalFee,
      attendantFee: order.attendantFee,
      paymentStatus: order.paymentStatus,
      settlementStatus: order.settlementStatus,
    };

    this.applySettlementFields(order, {
      baseFee: dto.baseFee,
      totalFee: dto.totalFee,
      checkupOptionalItems: dto.checkupOptionalItems,
      additionalServiceItems: dto.additionalServiceItems,
      attendantExtraIncomeItems: dto.attendantExtraIncomeItems,
      settlementStatus: dto.settlementStatus,
      paymentStatus: dto.paymentStatus,
      paymentMethod: dto.paymentMethod,
      paymentPaidAt: dto.paymentPaidAt,
      paymentReference: dto.paymentReference,
      settledAt: dto.settledAt,
      settlementRemark: dto.settlementRemark,
    });
    if (dto.attendantFee !== undefined) order.attendantFee = dto.attendantFee;
    if (dto.attendantFeeType !== undefined)
      order.attendantFeeType = dto.attendantFeeType;

    if (dto.hospitalBookingStatus !== undefined) {
      const v = dto.hospitalBookingStatus as 'booked' | 'pending_cs' | null | undefined;
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        order.hospitalBookingStatus = null;
      } else if (v === 'booked' || v === 'pending_cs') {
        order.hospitalBookingStatus = v;
      } else {
        throw new BadRequestException('约号状态仅支持 booked / pending_cs 或置空');
      }
    }

    if (dto.hospitalDirectoryId !== undefined) {
      if (dto.hospitalDirectoryId == null || dto.hospitalDirectoryId === 0) {
        order.hospitalDirectoryId = null;
      } else {
        const hid = Number(dto.hospitalDirectoryId);
        const hRow = await this.hospitalRepository.findOne({
          where: { id: hid, isActive: true },
        });
        if (!hRow) {
          throw new BadRequestException('名录中未找到该医院或已停用');
        }
        order.hospitalDirectoryId = hRow.id;
        order.hospital = this.formatHospitalDirectoryLine(hRow);
      }
    }

    if (dto.callbackContactPhone !== undefined) {
      const p = dto.callbackContactPhone == null ? '' : String(dto.callbackContactPhone).trim();
      order.callbackContactPhone = p || null;
    }

    if (dto.hospital !== undefined && dto.hospitalDirectoryId === undefined) order.hospital = dto.hospital;
    if (dto.department !== undefined) order.department = dto.department;
    if (dto.serviceType !== undefined) order.serviceType = dto.serviceType;
    if (dto.riskLevel !== undefined) {
      const ready = await this.ensureRiskLevelColumnReady();
      if (!ready) {
        throw new BadRequestException('风险等级字段初始化失败，请稍后重试');
      }
      const rawRiskLevel = dto.riskLevel == null ? '' : String(dto.riskLevel).trim();
      const normalizedRiskLevel = normalizeOrderRiskLevel(rawRiskLevel);
      if (rawRiskLevel && !normalizedRiskLevel) {
        throw new BadRequestException('风险等级仅支持 L1 或 L2');
      }
      order.riskLevel = normalizedRiskLevel;
    }
    if (dto.serviceTime !== undefined)
      order.serviceTime = dto.serviceTime as any;
    if (dto.serviceTime !== undefined && order.serviceEndTime) {
      const start = order.serviceTime ? new Date(order.serviceTime) : null;
      const end = new Date(order.serviceEndTime);
      if (
        start &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end < start
      ) {
        throw new BadRequestException('服务结束时间不能早于开始时间');
      }
    }
    if (dto.serviceEndTime !== undefined) {
      const raw = dto.serviceEndTime;
      if (raw === null || raw === '') {
        order.serviceEndTime = null;
      } else {
        const end = new Date(raw as string);
        if (Number.isNaN(end.getTime())) {
          throw new BadRequestException('服务结束时间格式无效');
        }
        const start = order.serviceTime ? new Date(order.serviceTime) : null;
        if (start && !Number.isNaN(start.getTime()) && end < start) {
          throw new BadRequestException('服务结束时间不能早于开始时间');
        }
        order.serviceEndTime = end as any;
      }
    }
    if (dto.serviceAddress !== undefined)
      order.serviceAddress = dto.serviceAddress;
    if (dto.notes !== undefined) order.notes = dto.notes;
    if (dto.checkupPackageName !== undefined)
      order.checkupPackageName = dto.checkupPackageName;
    if (dto.checkupGender !== undefined)
      order.checkupGender = dto.checkupGender;
    if (dto.needAttendant !== undefined)
      order.needAttendant = dto.needAttendant;
    const saved = await this.orderRepository.save(order);

    const financeDiffs: string[] = [];
    if (Number(financeBefore.baseFee ?? 0) !== Number(saved.baseFee ?? 0)) {
      financeDiffs.push(`baseFee: ${financeBefore.baseFee ?? 0} -> ${saved.baseFee ?? 0}`);
    }
    if (Number(financeBefore.totalFee ?? 0) !== Number(saved.totalFee ?? 0)) {
      financeDiffs.push(`totalFee: ${financeBefore.totalFee ?? 0} -> ${saved.totalFee ?? 0}`);
    }
    if (Number(financeBefore.attendantFee ?? 0) !== Number(saved.attendantFee ?? 0)) {
      financeDiffs.push(`attendantFee: ${financeBefore.attendantFee ?? 0} -> ${saved.attendantFee ?? 0}`);
    }
    if (financeBefore.paymentStatus !== saved.paymentStatus) {
      financeDiffs.push(`paymentStatus: ${financeBefore.paymentStatus} -> ${saved.paymentStatus}`);
    }
    if (financeBefore.settlementStatus !== saved.settlementStatus) {
      financeDiffs.push(`settlementStatus: ${financeBefore.settlementStatus} -> ${saved.settlementStatus}`);
    }
    if (financeDiffs.length > 0 && operatorId) {
      this.logger.warn(
        `[UpdateOrder] 操作者=${operatorId} 订单=${saved.id} 单号=${saved.orderNumber} 财务变更: ${financeDiffs.join('; ')}`,
      );
    }

    return saved;
  }

  async findAll(
    query: OrderQueryDto,
    userId?: number,
    attendantUserId?: number,
  ) {
    const canReadRiskLevel =
      (!userId || !!attendantUserId) && (await this.ensureRiskLevelColumnReady());
    const filterUserId = userId || query.userId;
    // 陪诊员只能查看分配给自己的订单，忽略外部传入的 attendantId。
    const selfAttendantId = attendantUserId
      ? await this.resolveAttendantIdByUserId(attendantUserId)
      : undefined;
    if (selfAttendantId && query.attendantId && query.attendantId !== selfAttendantId) {
      throw new BadRequestException('陪诊员仅可查看自己的订单');
    }

    const buildQuery = (withReviews: boolean) => {
      const qb = this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.user', 'user')
        .leftJoinAndSelect('order.serviceTarget', 'serviceTarget')
        .leftJoinAndSelect('order.hospitalDirectory', 'hospitalDirectory')
        .leftJoinAndSelect('order.attendant', 'attendant');
      if (withReviews) {
        qb.leftJoinAndSelect('order.reviews', 'reviews');
      }
      return qb;
    };

    const applyFilters = (
      qb: ReturnType<Repository<Order>['createQueryBuilder']>,
    ) => {
      if (filterUserId) {
        qb.andWhere('order.userId = :userId', { userId: filterUserId });
      }

      if (query.serviceTargetId) {
        qb.andWhere('order.serviceTargetId = :serviceTargetId', {
          serviceTargetId: query.serviceTargetId,
        });
      }

      if (selfAttendantId) {
        qb.andWhere('order.attendantId = :attendantId', {
          attendantId: selfAttendantId,
        });
      } else if (query.attendantId) {
        qb.andWhere('order.attendantId = :attendantId', {
          attendantId: query.attendantId,
        });
      }

      if (query.keyword) {
        qb.andWhere(
          new Brackets((sub) => {
            sub
              .where('order.orderNumber LIKE :keyword', {
                keyword: `%${query.keyword}%`,
              })
              .orWhere('serviceTarget.name LIKE :keyword', {
                keyword: `%${query.keyword}%`,
              });
          }),
        );
      }

      if (query.status) {
        const statuses = String(query.status)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        if (statuses.length > 1) {
          qb.andWhere('order.status IN (:...statuses)', { statuses });
        } else if (statuses.length === 1) {
          qb.andWhere('order.status = :status', { status: statuses[0] });
        }
      }

      if (query.startDate) {
        qb.andWhere('order.serviceTime >= :startDate', {
          startDate: `${query.startDate} 00:00:00`,
        });
      }

      if (query.endDate) {
        qb.andWhere('order.serviceTime <= :endDate', {
          endDate: `${query.endDate} 23:59:59`,
        });
      }

      if (query.settlementStatus) {
        qb.andWhere('order.settlementStatus = :settlementStatus', {
          settlementStatus: query.settlementStatus,
        });
      }

      if (query.paymentStatus) {
        qb.andWhere('order.paymentStatus = :paymentStatus', {
          paymentStatus: query.paymentStatus,
        });
      }
    };

    const total = await (() => {
      const countQb = buildQuery(false);
      applyFilters(countQb);
      return countQb.getCount();
    })();

    const listQb = buildQuery(true);
    applyFilters(listQb);
    if (canReadRiskLevel) {
      listQb.addSelect('order.riskLevel');
    }
    listQb
      .orderBy('order.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const items = await listQb.getMany();
    const itemsWithCompletionMeta =
      await this.attachCompletionAccessMetaToOrders(items);
    return {
      items: itemsWithCompletionMeta.map((item) =>
        this.attachSettlementSummary(
          canReadRiskLevel ? this.attachRiskLevelMeta(item) : item,
        ),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findOne(id: number, currentUserId?: number, role?: string) {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.serviceTarget', 'serviceTarget')
      .leftJoinAndSelect('order.hospitalDirectory', 'hospitalDirectory')
      .leftJoinAndSelect('order.attendant', 'attendant')
      .leftJoinAndSelect('attendant.user', 'attendantUser')
      .leftJoinAndSelect('order.professionalService', 'professionalService')
      .leftJoinAndSelect('order.timelines', 'timelines')
      .leftJoinAndSelect('order.documents', 'documents')
      .leftJoinAndSelect('order.financeRecords', 'financeRecords')
      .leftJoinAndSelect('order.reviews', 'reviews')
      .where('order.id = :id', { id });

    if (this.isAdminLikeRole(role) || role === UserRole.ATTENDANT) {
      const canReadRiskLevel = await this.ensureRiskLevelColumnReady();
      if (canReadRiskLevel) {
        qb.addSelect('order.riskLevel');
      }
    }

    const order = await qb.getOne();
    if (!order) throw new NotFoundException('订单不存在');
    if (currentUserId && role) {
      await this.assertOrderAccess(order, currentUserId, role);
    }
    // 陪诊员展示：优先使用后台设置的头像和姓名，同步到客户端
    if (order.attendant) {
      const att = order.attendant as any;
      const user = att.user;
      order.attendant = {
        ...att,
        name: att.realName || user?.nickname || '陪诊员',
        avatar: att.avatarUrl || user?.avatarUrl || '',
        phone: att.phone || user?.phone,
        rating: att.rating,
        serviceCount: att.totalOrders,
        title: att.employeeId ? `工号 ${att.employeeId}` : undefined,
      } as any;
    }
    await this.attachResolvedCompletionData(order);
    const orderWithRiskLevel =
      this.isAdminLikeRole(role) || role === UserRole.ATTENDANT
        ? this.attachRiskLevelMeta(order)
        : order;
    const result = this.attachSettlementSummary(orderWithRiskLevel) as Order & {
      riskLabel?: string | null;
      settlementBreakdown: ReturnType<OrderService['buildSettlementSummary']>;
      completionCompletedAt?: string;
      completionEditableUntil?: string;
      completionCanEdit?: boolean;
      completionReadOnly?: boolean;
      completionReadonlyReason?: string;
    };
    Object.assign(result, this.buildCompletionAccessMeta(order));
    return result;
  }

  async getMaskedHealthProfileForAttendant(
    orderId: number,
    operatorUserId: number,
    role?: string,
  ) {
    const isAdmin = this.isAdminLikeRole(role);
    const attendantId = isAdmin
      ? null
      : await this.resolveAttendantIdByUserId(operatorUserId);
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['serviceTarget'],
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (!order.serviceTarget) {
      throw new NotFoundException('服务对象不存在');
    }

    const isAssigned = !isAdmin && order.attendantId === attendantId;
    const activeRevealStatuses = new Set<OrderStatus>([
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.EMERGENCY,
    ]);

    const canView =
      isAdmin ||
      order.status === OrderStatus.PENDING_GRAB ||
      isAssigned;
    if (!canView) {
      throw new ForbiddenException('无权查看该用户健康档案');
    }

    const revealFull =
      isAdmin || (isAssigned && activeRevealStatuses.has(order.status));
    const target = order.serviceTarget;
    const hp = this.parseHealthProfile(target.healthProfile);
    const summaryLines = this.buildAttendantHealthSummaryLines(hp, target);

    if (revealFull) {
      return {
        id: target.id,
        maskedView: false,
        name: (target.name || '').trim(),
        gender: target.gender,
        age: target.age,
        phone: (target.phone || '').trim(),
        idCard: this.maskIdCard(target.idCard),
        emergencyContact: (target.emergencyContact || '').trim(),
        emergencyRelation: String(hp.emergencyRelation || '').trim(),
        emergencyPhone: (target.emergencyPhone || '').trim(),
        mainAppeal: target.mainAppeal,
        signatureUrl: target.signatureUrl,
        healthProfile: { ...hp },
        healthSummaryLines: summaryLines,
      };
    }

    return {
      id: target.id,
      maskedView: true,
      name: this.maskName(target.name),
      gender: target.gender,
      age: target.age,
      phone: this.maskPhone(target.phone),
      idCard: this.maskIdCard(target.idCard),
      emergencyContact: this.maskName(target.emergencyContact),
      emergencyRelation: hp.emergencyRelation ? '**' : '',
      emergencyPhone: this.maskPhone(target.emergencyPhone),
      mainAppeal: target.mainAppeal,
      signatureUrl: target.signatureUrl,
      healthProfile: {
        ...hp,
        signatureName: this.maskName(hp.signatureName || target.name || ''),
      },
      healthSummaryLines: [] as { label: string; value: string }[],
      healthSummaryLocked: true,
    };
  }

  async dispatch(id: number, dto: DispatchOrderDto, operatorId: number) {
    const order = await this.findOne(id);
    const prevStatus = order.status;

    if (dto.toGrabPool) {
      this.validateTransition(order.status, OrderStatus.PENDING_GRAB);
      order.status = OrderStatus.PENDING_GRAB;
      if (dto.attendantId == null) {
        order.attendantId = null as unknown as number;
      }
    } else {
      if (dto.attendantId == null) {
        throw new BadRequestException('指派陪诊员时请选择陪诊员');
      }
      order.attendantId = dto.attendantId;

      // 后台指派给具体陪诊员后，统一进入待确认（陪诊员可接受/拒绝）
      if (order.status === OrderStatus.PENDING_DISPATCH) {
        this.validateTransition(order.status, OrderStatus.PENDING_ACCEPT);
        order.status = OrderStatus.PENDING_ACCEPT;
      }
      // 已在抢单池中的订单若改为后台定向指派，也应先由陪诊员确认接单
      else if (order.status === OrderStatus.PENDING_GRAB) {
        this.validateTransition(order.status, OrderStatus.PENDING_ACCEPT);
        order.status = OrderStatus.PENDING_ACCEPT;
      } else {
        throw new BadRequestException(
          `当前订单状态 "${order.status}" 不支持指派操作`,
        );
      }
    }

    order.attendantFee =
      dto.attendantFee != null ? Number(dto.attendantFee) : null;
    order.attendantFeeType = dto.attendantFeeType ?? null;

    const saved = await this.orderRepository.save(order);
    if (prevStatus !== saved.status) {
      await this.appendStatusTimeline({
        orderId: saved.id,
        operatorId,
        fromStatus: prevStatus,
        toStatus: saved.status,
        note: dto.toGrabPool ? '放入抢单池' : '后台派单',
      });
    }

    // ── 推送通知 ──
    const orderFull = await this.findOne(saved.id);
    const svcType = orderFull.serviceType || '陪诊服务';
    const svcTime = orderFull.serviceTime
      ? new Date(orderFull.serviceTime).toLocaleString('zh-CN', { hour12: false })
      : '待定';
    const svcLocation = this.formatServiceLocation(orderFull);
    const targetName = this.formatTargetName(orderFull);

    if (dto.toGrabPool) {
      const allAttendants = await this.attendantRepository.find({
        where: { status: 'active' },
        relations: ['user'],
      });
      for (const att of allAttendants) {
        const openid = att.user?.openid;
        if (openid) {
          this.notificationService.notifyAttendantGrabPool(openid, saved.orderNumber, svcType, svcTime).catch(() => {});
        }
      }
    } else if (orderFull.attendant?.user?.openid) {
      this.notificationService.notifyAttendantOrderAssign(
        orderFull.attendant.user.openid,
        saved.orderNumber,
        svcType,
        svcTime,
        saved.id,
      ).catch(() => {});
    }

    return saved;
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    operatorId: number,
    role: string,
  ) {
    if (!this.isAdminLikeRole(role)) {
      throw new BadRequestException('当前账号无权通过通用接口修改订单状态');
    }
    const order = await this.findOne(id);
    const prevStatus = order.status;
    this.validateTransition(order.status, dto.status);
    const cancelReason = dto.cancelReason?.trim();
    const remark = dto.remark?.trim();
    const statusNote = cancelReason || remark || undefined;
    order.status = dto.status;
    if (dto.status === OrderStatus.CANCELED && cancelReason) {
      order.cancelReason = cancelReason;
    }
    const saved = await this.orderRepository.save(order);
    if (prevStatus !== saved.status) {
      await this.appendStatusTimeline({
        orderId: saved.id,
        operatorId,
        fromStatus: prevStatus,
        toStatus: saved.status,
        note: statusNote,
      });

      // 向客户推送关键状态变更通知
      const customerOpenid = order.user?.openid;
      if (customerOpenid) {
        const notifyMap: Partial<Record<OrderStatus, { statusText: string; remark: string }>> = {
          [OrderStatus.IN_PROGRESS]: {
            statusText: '服务进行中',
            remark: '服务人员已开始为您服务，请保持联系',
          },
          [OrderStatus.PENDING_REVIEW]: {
            statusText: '服务已结束',
            remark: '感谢您的信任，服务已结束，期待您的评价',
          },
          [OrderStatus.COMPLETED]: {
            statusText: '订单已完成',
            remark: '订单已完成，感谢选择陪了个伴管理服务',
          },
          [OrderStatus.CANCELED]: {
            statusText: '订单已取消',
            remark: cancelReason || '如有疑问请联系客服',
          },
        };
        const notifyConfig = notifyMap[dto.status];
        if (notifyConfig) {
          this.notificationService
            .notifyCustomerOrderStatus(
              customerOpenid,
              order.orderNumber,
              notifyConfig.statusText,
              notifyConfig.remark,
              saved.id,
            )
            .catch(() => {});
        }
      }

      // 服务已完成时额外发送评价邀请
      if (dto.status === OrderStatus.COMPLETED && order.user?.openid) {
        const svcType = order.serviceType || '陪诊服务';
        this.notificationService
          .notifyOrderReviewInvite(
            order.user.openid,
            order.orderNumber,
            svcType,
            '您的一句话对我们很重要，期待您的评价',
            saved.id,
          )
          .catch(() => {});
      }
    }
    return saved;
  }

  async acceptOrder(orderId: number, attendantUserId: number) {
    const order = await this.findOne(orderId);
    const prevStatus = order.status;
    const attendantId = await this.resolveAttendantIdByUserId(attendantUserId);
    if (order.status !== OrderStatus.PENDING_ACCEPT) {
      throw new BadRequestException('该订单当前状态不支持接单');
    }
    if (order.attendantId !== attendantId) {
      throw new BadRequestException('该订单未指派给您');
    }
    this.validateTransition(order.status, OrderStatus.PENDING_SERVICE);
    order.status = OrderStatus.PENDING_SERVICE;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: attendantUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: '陪诊员已确认接单',
      visibleToUser: true,
    });
    // 通知客户：陪诊员已确认接单
    const customerOpenid = order.user?.openid;
    if (customerOpenid) {
      const attName = (order.attendant as any)?.realName || '陪诊员';
      this.notificationService.notifyCustomerOrderStatus(
        customerOpenid,
        order.orderNumber,
        '陪诊员已确认接单',
        `${attName}已确认接单，服务即将开始，请留意后续安排`,
        saved.id,
      ).catch(() => {});
    }
    return saved;
  }

  /**
   * 后台代陪诊员确认接单：
   * 管理员/运营/客服在订单已指派但陪诊员尚未自行确认时，
   * 可直接许可接单，将订单从 PENDING_ACCEPT 推进至 PENDING_SERVICE。
   */
  async adminConfirmAccept(orderId: number, operatorId: number) {
    const order = await this.findOne(orderId);
    const prevStatus = order.status;
    if (order.status !== OrderStatus.PENDING_ACCEPT) {
      throw new BadRequestException(
        '仅「待接单」状态的订单可由后台代陪诊员确认接单',
      );
    }
    if (!order.attendantId) {
      throw new BadRequestException('该订单尚未指派陪诊员，无法代为确认接单');
    }
    this.validateTransition(order.status, OrderStatus.PENDING_SERVICE);
    order.status = OrderStatus.PENDING_SERVICE;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: '后台代陪诊员确认接单',
      visibleToUser: true,
    });

    const attName = (order.attendant as any)?.realName || '陪诊员';
    // 通知客户：陪诊员已确认接单（文案与陪诊员自行接单保持一致）
    const customerOpenid = order.user?.openid;
    if (customerOpenid) {
      this.notificationService
        .notifyCustomerOrderStatus(
          customerOpenid,
          order.orderNumber,
          '陪诊员已确认接单',
          `${attName}已确认接单，服务即将开始，请留意后续安排`,
          saved.id,
        )
        .catch(() => {});
    }
    // 通知陪诊员：订单已由后台代为确认，请按时到场服务
    const attendantOpenid = order.attendant?.user?.openid;
    if (attendantOpenid) {
      const svcType = order.serviceType || '陪诊服务';
      const svcTime = order.serviceTime
        ? new Date(order.serviceTime).toLocaleString('zh-CN', { hour12: false })
        : '待定';
      const targetName = this.formatTargetName(order);
      this.notificationService
        .notifyAttendantServiceReminder(
          attendantOpenid,
          svcType,
          targetName,
          svcTime,
          '后台已代为确认接单，请按时到场提供服务',
          saved.id,
        )
        .catch(() => {});
    }

    return saved;
  }

  async rejectOrder(orderId: number, attendantUserId: number, reason: string) {
    const order = await this.findOne(orderId);
    const prevStatus = order.status;
    const attendantId = await this.resolveAttendantIdByUserId(attendantUserId);
    if (order.status !== OrderStatus.PENDING_ACCEPT) {
      throw new BadRequestException('该订单当前状态不支持拒单');
    }
    if (order.attendantId !== attendantId) {
      throw new BadRequestException('该订单未指派给您');
    }
    this.validateTransition(order.status, OrderStatus.PENDING_DISPATCH);
    order.status = OrderStatus.PENDING_DISPATCH;
    order.attendantId = null as unknown as number;
    order.cancelReason = reason;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: attendantUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: reason || '陪诊员拒单',
      visibleToUser: false,
    });
    return saved;
  }

  async grabOrder(id: number, attendantUserId: number) {
    const attendantId = await this.resolveAttendantIdByUserId(attendantUserId);
    const updateResult = await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set({
        attendantId,
        status: OrderStatus.PENDING_SERVICE,
      })
      .where('id = :id', { id })
      .andWhere('status = :status', { status: OrderStatus.PENDING_GRAB })
      .execute();

    if (!updateResult.affected) {
      throw new BadRequestException('该订单已被其他陪诊员抢走或当前不可抢单');
    }

    const saved = await this.findOne(id);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: attendantUserId,
      fromStatus: OrderStatus.PENDING_GRAB,
      toStatus: saved.status,
      note: '陪诊员抢单成功，已确认接单',
      visibleToUser: true,
    });
    // 通知客户：陪诊员已抢单确认
    const customerOpenid = saved.user?.openid;
    if (customerOpenid) {
      const attUser = await this.attendantRepository.findOne({
        where: { id: attendantId },
        relations: ['user'],
      });
      const attName = attUser?.realName || '陪诊员';
      this.notificationService.notifyCustomerOrderStatus(
        customerOpenid,
        saved.orderNumber,
        '陪诊员已确认接单',
        `${attName}已抢单确认，正在赶赴现场签到`,
        saved.id,
      ).catch(() => {});
    }
    return saved;
  }

  async cancelOrder(
    id: number,
    currentUserId: number,
    cancelReason?: string,
    canceledBy?: string,
    role?: string,
  ) {
    const order = await this.findOne(id, currentUserId, role || UserRole.USER);
    const prevStatus = order.status;
    const freeCancelStatuses: OrderStatus[] = [
      OrderStatus.PENDING_DISPATCH,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_GRAB,
    ];
    const adminOnlyCancelStatuses: OrderStatus[] = [
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_SERVICE,
    ];
    const isAdmin = this.isAdminLikeRole(role);

    if (!isAdmin && order.userId !== currentUserId) {
      throw new ForbiddenException('仅客户本人可取消订单');
    }

    if (freeCancelStatuses.includes(order.status)) {
      // 客户可直接取消
    } else if (adminOnlyCancelStatuses.includes(order.status)) {
      if (!isAdmin) {
        throw new BadRequestException('待签署/待服务状态的订单仅支持后台取消');
      }
      if (!cancelReason) {
        throw new BadRequestException('当前状态取消订单需要提供取消原因');
      }
    } else {
      throw new BadRequestException('当前订单状态不允许取消');
    }

    this.validateTransition(order.status, OrderStatus.CANCELED);
    this.clearAttendantLiveFields(order);
    order.status = OrderStatus.CANCELED;
    if (cancelReason) order.cancelReason = cancelReason;
    if (canceledBy) order.canceledBy = canceledBy;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: currentUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: cancelReason || '订单取消',
      visibleToUser: true,
    });
    // 若有已分配陪诊员，通知其订单已取消
    const attOpenid = (order.attendant as any)?.user?.openid;
    if (attOpenid) {
      this.notificationService.notifyAttendantOrderAssign(
        attOpenid,
        order.orderNumber,
        order.serviceType || '陪诊服务',
        '订单已取消',
        saved.id,
      ).catch(() => {});
    }
    // 若为后台取消（非客户自己取消），通知客户
    if (isAdmin && order.user?.openid) {
      this.notificationService.notifyCustomerOrderStatus(
        order.user.openid,
        order.orderNumber,
        '订单已取消',
        cancelReason || '后台已取消此订单，如有疑问请联系客服',
        saved.id,
      ).catch(() => {});
    }
    return saved;
  }

  async startOrder(id: number, operatorUserId: number, role?: string) {
    const order = await this.findOne(id);
    const prevStatus = order.status;
    if (order.status !== OrderStatus.PENDING_SERVICE) {
      throw new BadRequestException('仅待服务状态的订单可以开始服务');
    }
    const isAdmin = this.isAdminLikeRole(role);
    if (!isAdmin) {
      const attendantId = await this.resolveAttendantIdByUserId(operatorUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权操作此订单');
      }
    }
    this.validateTransition(order.status, OrderStatus.IN_PROGRESS);
    this.clearAttendantLiveFields(order);
    order.status = OrderStatus.IN_PROGRESS;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: operatorUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: isAdmin ? '管理员开始服务' : '陪诊员开始服务',
    });
    return saved;
  }

  async finishOrder(id: number, operatorUserId: number, role?: string) {
    const order = await this.findOne(id);
    const prevStatus = order.status;
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.EMERGENCY
    ) {
      throw new BadRequestException('仅进行中或紧急处置中的订单可以结束服务');
    }
    const isAdmin = this.isAdminLikeRole(role);
    if (!isAdmin) {
      const attendantId = await this.resolveAttendantIdByUserId(operatorUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权操作此订单');
      }
    }
    this.validateTransition(order.status, OrderStatus.COMPLETED);
    this.clearAttendantLiveFields(order);
    order.status = OrderStatus.COMPLETED;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: operatorUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: isAdmin ? '管理员确认服务完成' : '陪诊员确认服务完成',
    });
    const customerOpenid = order.user?.openid;
    if (customerOpenid) {
      this.notificationService.notifyCustomerOrderStatus(
        customerOpenid,
        order.orderNumber,
        '服务已完成',
        '感谢您的信任，如愿意可随时补充评价',
        saved.id,
      ).catch(() => {});
    }
    return saved;
  }

  async signOrder(id: number, attendantUserId: number, signUrl: string) {
    const order = await this.findOne(id);
    const prevStatus = order.status;
    const attendantId = await this.resolveAttendantIdByUserId(attendantUserId);
    if (order.status !== OrderStatus.PENDING_SIGN) {
      throw new BadRequestException('仅待签到状态的订单可以签到');
    }
    if (order.attendantId !== attendantId) {
      throw new ForbiddenException('无权签到此订单');
    }
    this.validateTransition(order.status, OrderStatus.PENDING_SERVICE);
    order.status = OrderStatus.PENDING_SERVICE;
    order.signUrl = signUrl;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: attendantUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: '已完成签到',
    });
    return saved;
  }

  /**
   * 陪诊员（或管理员代为）：进入 / 解除紧急模式。进入前须在端上完成二次确认并选择联系门店或家属后再调用 activate。
   */
  async setEmergencyMode(
    id: number,
    operatorUserId: number,
    dto: SetOrderEmergencyDto,
    role?: string,
  ) {
    const order = await this.findOne(id);
    const isAdmin = this.isAdminLikeRole(role);
    if (!isAdmin) {
      const attendantId = await this.resolveAttendantIdByUserId(operatorUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权操作此订单');
      }
    }

    if (dto.action === 'clear') {
      if (order.status !== OrderStatus.EMERGENCY) {
        throw new BadRequestException('当前不在紧急模式，无需解除');
      }
      const prevStatus = order.status;
      this.validateTransition(order.status, OrderStatus.IN_PROGRESS);
      order.status = OrderStatus.IN_PROGRESS;
      const saved = await this.orderRepository.save(order);
      await this.appendStatusTimeline({
        orderId: saved.id,
        operatorId: operatorUserId,
        fromStatus: prevStatus,
        toStatus: saved.status,
        note:
          dto.description?.trim() ||
          (isAdmin
            ? '管理员解除紧急模式，恢复服务进行中'
            : '陪诊员解除紧急模式，恢复服务进行中'),
      });
      return {
        success: true,
        message: '已解除紧急模式',
        status: saved.status,
      };
    }

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException('仅「服务进行中」的订单可进入紧急模式');
    }
    if (dto.channel !== 'store' && dto.channel !== 'family') {
      throw new BadRequestException('进入紧急模式前请选择联系渠道：store（门店）或 family（紧急联系人）');
    }
    const channelText = dto.channel === 'store' ? '联系门店' : '联系紧急联系人（家属）';
    const actorPrefix = isAdmin ? '管理员' : '陪诊员';
    const desc =
      (dto.description && dto.description.trim()) ||
      `${actorPrefix}紧急：已选择${channelText}`;

    const prevStatus = order.status;
    this.validateTransition(order.status, OrderStatus.EMERGENCY);
    order.status = OrderStatus.EMERGENCY;
    const saved = await this.orderRepository.save(order);
    await this.appendStatusTimeline({
      orderId: saved.id,
      operatorId: operatorUserId,
      fromStatus: prevStatus,
      toStatus: saved.status,
      note: desc,
    });

    return {
      success: true,
      message: '已进入紧急模式',
      description: desc,
      status: saved.status,
    };
  }

  async createReview(
    orderId: number,
    userId: number,
    data: { rating: number; content?: string; comment?: string; tags?: string[] },
  ) {
    const order = await this.findOne(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('仅下单用户可评价该订单');
    }
    if (
      order.status !== OrderStatus.COMPLETED &&
      order.status !== OrderStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException('仅已完成或待审核的订单可以评价');
    }
    const existing = await this.reviewRepository.findOne({
      where: { orderId, userId },
    });
    if (existing) {
      throw new BadRequestException('您已经评价过该订单');
    }
    const review = this.reviewRepository.create({
      orderId,
      userId,
      attendantId: order.attendantId,
      rating: data.rating,
      comment: data.comment ?? data.content,
      tags: data.tags,
    });
    const saved = await this.reviewRepository.save(review);
    // 响应里同时带 content（新）和 comment（旧），两端过渡期都能用
    return {
      ...saved,
      content: saved.comment,
    };
  }

  async getBill(id: number, currentUserId: number, role: string) {
    const order = await this.findOne(id, currentUserId, role);
    const settlementBreakdown = this.buildSettlementSummary(order);
    return {
      order: {
        orderNo: order.orderNumber,
        serviceDate: order.serviceTime
          ? new Date(order.serviceTime).toLocaleDateString('zh-CN')
          : '',
        settlementStatus: order.settlementStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentPaidAt: order.paymentPaidAt,
        paymentReference: order.paymentReference,
        settledAt: order.settledAt,
        settlementRemark: order.settlementRemark,
      },
      items: settlementBreakdown.items,
      totalAmount: settlementBreakdown.total.toFixed(2),
      receipts: [],
    };
  }

  async submitCompletion(
    id: number,
    operatorUserId: number,
    role: string,
    body: {
      diagnosisResult?: string;
      doctorAdvice?: string;
      medications?: {
        name: string;
        usage: string;
        reminderTime?: string;
        startDate?: string;
        endDate?: string;
      }[];
      followUpDate?: string;
      followUpNote?: string;
      followUpHospital?: string;
      followUpDepartment?: string;
      summary?: string;
      medicationMode?: string;
      images?: string[];
      files?: { url?: string; path?: string; name?: string }[] | string[];
    },
  ) {
    const order = await this.findOne(id);
    const isAdmin = this.isAdminLikeRole(role);
    if (!isAdmin) {
      const attendantId = await this.resolveAttendantIdByUserId(operatorUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权操作此订单');
      }
    }
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.EMERGENCY &&
      order.status !== OrderStatus.PENDING_REVIEW &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException('当前订单状态不支持提交服务完成记录');
    }
    const completionAccess = this.buildCompletionAccessMeta(order);
    if (
      order.status === OrderStatus.COMPLETED &&
      !completionAccess.completionCanEdit &&
      !isAdmin
    ) {
      throw new BadRequestException(this.getCompletionReadonlyMessage());
    }
    const evaluation = this.evaluateCompletionPayload(body as Record<string, unknown>);
    this.assertFollowUpCompletionFields(evaluation.normalized);
    (order as any).completionData = evaluation.normalized;
    await this.orderRepository.save(order);
    await this.syncCompletionReminders(order, evaluation.normalized, operatorUserId);
    await this.syncFollowUpReminder(order, evaluation.normalized, operatorUserId);

    this.enrichCompletionWithAi(order).catch((e) =>
      this.logger.warn(`AI 报告生成失败 (order ${order.id}): ${e?.message}`),
    );

    return {
      success: true,
      readyToFinish: evaluation.ready,
      checklist: {
        summaryReady: evaluation.summaryReady,
        proofReady: evaluation.proofReady,
        medicationReady: evaluation.medicationReady,
      },
    };
  }

  /** 陪诊员完成资料页：按服务时间线生成服务总结草稿（需后台开启 AI） */
  async draftCompletionAiSummary(id: number, operatorUserId: number, role: string) {
    const order = await this.findOne(id, operatorUserId, role);
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.EMERGENCY &&
      order.status !== OrderStatus.PENDING_REVIEW &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException('当前订单状态不支持生成总结草稿');
    }
    const timelines = await this.timelineRepository.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });
    const out = await this.aiConsultationService.generateCompletionSummaryDraft(
      {
        serviceType: order.serviceType || undefined,
        hospital: order.hospital || undefined,
        department: order.department || undefined,
        patientName: order.serviceTarget?.name || undefined,
      },
      timelines,
    );
    if (!out?.summary) {
      throw new BadRequestException(
        '未能生成草稿：请确认后台已开启 AI 并配置密钥，或稍后重试；也可直接手写服务总结。',
      );
    }
    return { summary: out.summary };
  }

  /** 完成资料页·服务概况：轻量 AI 一句话概括时间线（token 少） */
  async draftCompletionTimelineDigest(id: number, operatorUserId: number, role: string) {
    const order = await this.findOne(id, operatorUserId, role);
    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.EMERGENCY &&
      order.status !== OrderStatus.PENDING_REVIEW &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException('当前订单状态不支持生成时间线概括');
    }
    const timelines = await this.timelineRepository.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });
    const out = await this.aiConsultationService.generateTimelineDigest(
      {
        hospital: order.hospital || undefined,
        department: order.department || undefined,
        patientName: order.serviceTarget?.name || undefined,
      },
      timelines,
    );
    if (!out?.digest) {
      throw new BadRequestException(
        '未能生成概括：请确认后台已开启 AI，或时间线缺少可用文字；可稍后重试。',
      );
    }
    return { digest: out.digest };
  }

  private async enrichCompletionWithAi(order: Order) {
    const fullOrder = await this.orderRepository.findOne({
      where: { id: order.id },
      relations: ['serviceTarget', 'attendant'],
    });
    if (!fullOrder) return;

    const timelines = await this.timelineRepository.find({
      where: { orderId: order.id },
      order: { createdAt: 'ASC' },
    });

    const aiResult = await this.aiConsultationService.generateServiceReport({
      orderNumber: fullOrder.orderNumber,
      serviceType: fullOrder.serviceType,
      serviceTime: fullOrder.serviceTime,
      hospital: fullOrder.hospital,
      department: fullOrder.department,
      serviceTarget: fullOrder.serviceTarget,
      attendant: fullOrder.attendant,
      completionData: fullOrder.completionData,
      timelines,
    });

    if (!aiResult) return;

    const existing = (fullOrder as any).completionData || {};
    (fullOrder as any).completionData = {
      ...existing,
      aiDiagnosis: aiResult.diagnosisResult || '',
      aiKeyAdvice: aiResult.keyAdvice || '',
      aiSummary: aiResult.summary || '',
      aiHealthTips: aiResult.healthTips || [],
      aiDietaryAdvice: aiResult.dietaryAdvice || '',
      aiFollowUpReminder: aiResult.followUpReminder || '',
      aiReportSections: Array.isArray((aiResult as any).sections)
        ? (aiResult as any).sections
        : [],
      aiGeneratedAt: new Date().toISOString(),
    };
    await this.orderRepository.save(fullOrder);

    this.pushServiceReportToFamily(fullOrder, aiResult.summary || '').catch(
      (err) => {
        this.logger.warn(
          `推送 AI 陪诊报告失败 (order ${fullOrder.id}): ${err?.message || err}`,
        );
      },
    );
  }

  /**
   * AI 报告生成完毕后主动推送订阅消息给家属（订单 owner + 同家庭组 guardian）。
   * 幂等：若当天同一单已推送过，通过 completionData.aiReportNotifiedAt 规避重复。
   */
  private async pushServiceReportToFamily(order: Order, aiSummary: string) {
    const alreadyNotifiedAt = (order.completionData as any)?.aiReportNotifiedAt;
    if (alreadyNotifiedAt) {
      return;
    }

    const recipients = await this.collectFamilyOpenids(order.userId);
    if (recipients.length === 0) {
      this.logger.debug(
        `[AI 报告推送] 订单 ${order.id} 没有可推送的 openid，跳过`,
      );
      return;
    }

    const targetName = order.serviceTarget?.name || '家人';
    let sent = 0;
    for (const openid of recipients) {
      const ok = await this.notificationService.notifyFamilyServiceReport(
        openid,
        order.orderNumber,
        targetName,
        aiSummary || '陪诊报告已生成，点击查看 AI 智能解读',
        order.id,
      );
      if (ok) sent += 1;
    }

    if (sent > 0) {
      const cd = (order.completionData as any) || {};
      cd.aiReportNotifiedAt = new Date().toISOString();
      cd.aiReportNotifiedCount = sent;
      (order as any).completionData = cd;
      await this.orderRepository.save(order);
    }
    this.logger.log(
      `[AI 报告推送] 订单 ${order.id} 已推送给 ${sent}/${recipients.length} 位家属`,
    );
  }

  /**
   * 汇总订单关联家属的 openid：
   * - 订单 owner（下单家属）
   * - 同家庭组内所有 guardian
   */
  private async collectFamilyOpenids(ownerId: number): Promise<string[]> {
    const openids = new Set<string>();

    const owner = await this.userRepository.findOne({
      where: { id: ownerId },
    });
    if (owner?.openid) openids.add(owner.openid);

    const memberships = await this.familyMemberRepository.find({
      where: { userId: ownerId },
    });
    const groupIds = memberships.map((m) => m.familyGroupId);
    if (groupIds.length > 0) {
      const guardians = await this.familyMemberRepository.find({
        where: { familyGroupId: In(groupIds), role: 'guardian' },
      });
      const guardianIds = Array.from(
        new Set(guardians.map((g) => g.userId).filter((u) => u !== ownerId)),
      );
      if (guardianIds.length > 0) {
        const guardianUsers = await this.userRepository.find({
          where: { id: In(guardianIds) },
        });
        for (const u of guardianUsers) {
          if (u.openid) openids.add(u.openid);
        }
      }
    }
    return Array.from(openids);
  }

  async getReviews(orderId: number, currentUserId: number, role: string) {
    await this.findOne(orderId, currentUserId, role);
    const rows = await this.reviewRepository.find({
      where: { orderId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    // 评价列表同时暴露 content（新）和 comment（旧），过渡期两端都能用
    return rows.map((r) => ({ ...r, content: r.comment }));
  }

  async deleteOrder(id: number, operatorId?: number) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');

    // 业务态防御：已支付/已结算/服务进行中的订单禁止物理删除
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        '该订单已支付，禁止直接删除。请先在财务中退款后再处理',
      );
    }
    if (order.settlementStatus === SettlementStatus.SETTLED) {
      throw new BadRequestException('该订单已结算给陪诊员，禁止删除');
    }
    const activeStatuses: OrderStatus[] = [
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.EMERGENCY,
    ];
    if (activeStatuses.includes(order.status)) {
      throw new BadRequestException(
        `订单处于「${order.status}」状态，不能直接删除。请先取消或完成订单`,
      );
    }

    this.logger.warn(
      `[DeleteOrder] 操作者=${operatorId ?? 'unknown'} 订单=${order.id} 单号=${order.orderNumber} 状态=${order.status} 支付=${order.paymentStatus} 结算=${order.settlementStatus} 总额=${order.totalFee}`,
    );

    const manager = this.orderRepository.manager;
    await manager.query('DELETE FROM service_timelines WHERE order_id = ?', [
      id,
    ]);
    await manager.query('DELETE FROM documents WHERE order_id = ?', [id]);
    await manager.query('DELETE FROM finance_records WHERE order_id = ?', [id]);
    await manager.query('DELETE FROM reviews WHERE order_id = ?', [id]);
    await this.orderRepository.remove(order);
    return { success: true };
  }

  /** 仪表盘统计内存缓存：避免短时间内重复跑全表聚合 SQL */
  private readonly dashboardCacheTtlMs = 10_000;
  private readonly dashboardCache = new Map<string, { expireAt: number; value: any }>();
  private async withDashboardCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.dashboardCache.get(key);
    if (hit && hit.expireAt > now) {
      return hit.value as T;
    }
    const value = await loader();
    this.dashboardCache.set(key, {
      value,
      expireAt: now + this.dashboardCacheTtlMs,
    });
    return value;
  }

  async getDashboardStats() {
    return this.withDashboardCache('dashboard:stats', () =>
      this._getDashboardStatsUncached(),
    );
  }

  private async _getDashboardStatsUncached() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalOrders = await this.orderRepository.count();
    const todayOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.created_at >= :start', { start: todayStart })
      .getCount();

    const monthOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.created_at >= :start', { start: monthStart })
      .getCount();

    const pendingOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', {
        statuses: [
          OrderStatus.PENDING_DISPATCH,
          OrderStatus.PENDING_ACCEPT,
          OrderStatus.PENDING_GRAB,
          OrderStatus.PENDING_SERVICE,
        ],
      })
      .getCount();

    const todayIncome = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_fee), 0)', 'total')
      .where('o.created_at >= :start', { start: todayStart })
      .getRawOne();

    const monthIncome = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_fee), 0)', 'total')
      .where('o.created_at >= :start', { start: monthStart })
      .getRawOne();

    const totalIncome = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_fee), 0)', 'total')
      .getRawOne();

    const statusCounts = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.status')
      .getRawMany();

    const inProgressOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.status = :s', { s: OrderStatus.IN_PROGRESS })
      .getCount();

    const unpaidOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.payment_status = :ps', { ps: 'unpaid' })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELED],
      })
      .getCount();

    const totalCustomers = await this.orderRepository
      .createQueryBuilder('o')
      .select('COUNT(DISTINCT o.user_id)', 'cnt')
      .getRawOne()
      .then((r: any) => Number(r?.cnt || 0));

    const totalAttendants = await this.attendantRepository.count({
      where: { status: 'active' },
    });

    return {
      totalOrders,
      todayOrders,
      monthOrders,
      pendingOrders,
      inProgressOrders,
      unpaidOrders,
      totalCustomers,
      totalAttendants,
      todayIncome: Number(todayIncome?.total || 0),
      monthIncome: Number(monthIncome?.total || 0),
      totalIncome: Number(totalIncome?.total || 0),
      statusCounts: statusCounts.reduce(
        (acc: Record<string, number>, row: any) => {
          acc[row.status] = Number(row.count);
          return acc;
        },
        {},
      ),
    };
  }

  async getDashboardLiveBoard(limit = 30) {
    const activeStatuses: OrderStatus[] = [
      OrderStatus.PENDING_DISPATCH,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_GRAB,
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.EMERGENCY,
    ];

    const orders = await this.orderRepository.find({
      where: { status: In(activeStatuses) },
      relations: ['user', 'serviceTarget', 'attendant'],
      order: {
        serviceTime: 'ASC',
        createdAt: 'DESC',
      },
      take: Math.min(Math.max(limit, 1), 100),
    });

    if (!orders.length) return [];

    const orderIds = orders.map((o) => o.id);
    const timelineRows = await this.timelineRepository.find({
      where: { orderId: In(orderIds) },
      order: { createdAt: 'DESC' },
    });
    const latestTimelineByOrder = new Map<number, ServiceTimeline>();
    timelineRows.forEach((row) => {
      if (!latestTimelineByOrder.has(row.orderId)) {
        latestTimelineByOrder.set(row.orderId, row);
      }
    });

    return orders.map((order) => {
      const latestTimeline = latestTimelineByOrder.get(order.id);
      return {
        ...order,
        currentLocation:
          [order.hospital, order.department].filter(Boolean).join(' · ') ||
          order.serviceAddress ||
          '',
        latestTimeline: latestTimeline
          ? {
              id: latestTimeline.id,
              content: latestTimeline.content,
              type: latestTimeline.type,
              createdAt: latestTimeline.createdAt,
            }
          : null,
      };
    });
  }

  async getOrderTrend(days: number) {
    const d = Math.min(Math.max(Math.floor(days) || 7, 1), 365);
    return this.withDashboardCache(`dashboard:orderTrend:${d}`, async () => {
      const result = await this.orderRepository
        .createQueryBuilder('o')
        .select('DATE(o.created_at)', 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(o.total_fee), 0)', 'income')
        .where('o.created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)', { days: d })
        .groupBy('DATE(o.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany();
      return result.map((r: any) => ({
        date: r.date,
        count: Number(r.count),
        income: Number(r.income),
      }));
    });
  }

  async getIncomeTrend(days: number) {
    const d = Math.min(Math.max(Math.floor(days) || 30, 1), 365);
    return this.withDashboardCache(`dashboard:incomeTrend:${d}`, async () => {
      const result = await this.orderRepository
        .createQueryBuilder('o')
        .select('DATE(o.created_at)', 'date')
        .addSelect('COALESCE(SUM(o.total_fee), 0)', 'income')
        .addSelect('COUNT(*)', 'orders')
        .where('o.created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)', { days: d })
        .groupBy('DATE(o.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany();
      return result.map((r: any) => ({
        date: r.date,
        income: Number(r.income),
        orders: Number(r.orders),
      }));
    });
  }

  /**
   * 服务前提醒：每10分钟扫描一次待服务订单，触发 24h / 12h / 2h 提醒。
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendServiceStartReminders() {
    const now = new Date();
    const maxAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const orders = await this.orderRepository.find({
      where: {
        status: Not(OrderStatus.CANCELED),
        serviceTime: Not(IsNull()),
      },
      relations: ['user', 'serviceTarget', 'attendant', 'attendant.user'],
    });

    for (const order of orders) {
      if (!order.serviceTime) continue;
      const serviceTime = new Date(order.serviceTime);
      if (serviceTime < now || serviceTime > maxAhead) continue;
      if (
        order.status !== OrderStatus.PENDING_SIGN &&
        order.status !== OrderStatus.PENDING_SERVICE &&
        order.status !== OrderStatus.PENDING_ACCEPT
      ) {
        continue;
      }

      const minutesLeft = Math.floor(
        (serviceTime.getTime() - now.getTime()) / 60000,
      );
      for (const hour of OrderService.SERVICE_REMINDER_HOURS) {
        const targetMinutes = hour * 60;
        const inWindow =
          minutesLeft <= targetMinutes && minutesLeft > targetMinutes - 10;
        if (!inWindow) continue;

        await this.deliverServiceReminder(order, hour, 'customer', now);
        await this.deliverServiceReminder(order, hour, 'attendant', now);
      }
    }
  }

  private async deliverServiceReminder(
    order: Order,
    hour: number,
    audience: 'customer' | 'attendant',
    now: Date,
  ) {
    const markerKey = `service_reminder_order_${order.id}_${hour}h_${audience}`;
    const alreadySent = await this.systemConfigRepository.findOne({
      where: { key: markerKey },
    });
    if (alreadySent) return;

    const delivered = await this.sendSingleServiceReminder(order, hour, audience).catch(
      () => false,
    );
    if (!delivered) return;

    await this.systemConfigRepository.save(
      this.systemConfigRepository.create({
        key: markerKey,
        value: now.toISOString(),
        description: `订单服务前提醒发送标记（${audience}）`,
      }),
    );
  }

  private async sendSingleServiceReminder(
    order: Order,
    hour: number,
    audience: 'customer' | 'attendant' = 'customer',
  ): Promise<boolean> {
    const serviceTimeText = this.formatServiceTime(order.serviceTime);
    const targetName = order.serviceTarget?.name || '客户';

    if (audience === 'customer') {
      const openid = order.user?.openid;
      if (!openid) return false;
      await this.notificationService.sendMiniProgramSubscribeMessage(
        openid,
        'order_service_reminder',
        {
          thing1: { value: order.serviceType || '陪诊服务' },
          thing2: { value: targetName },
          time3: { value: serviceTimeText },
          thing4: { value: `距离服务开始约${hour}小时` },
          __page: `/pages/order/detail/detail?id=${order.id}`,
        },
      );
      return true;
    }

    const attendantOpenid = (order.attendant as any)?.user?.openid;
    if (!attendantOpenid) return false;
    return (
      (await this.notificationService.notifyAttendantServiceReminder(
        attendantOpenid,
        order.serviceType || '陪诊服务',
        targetName,
        serviceTimeText,
        `距离服务开始约${hour}小时，请做好准备`,
        order.id,
      )) || false
    );
  }

  /**
   * 待签署催办：订单处于 pending_sign 且距离服务开始 ≤ 6h 时催用户签署。
   * 每 30 分钟扫描一次，幂等。
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendSignReminders() {
    const now = new Date();
    const maxAhead = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const orders = await this.orderRepository.find({
      where: {
        status: OrderStatus.PENDING_SIGN,
        serviceTime: Not(IsNull()),
      },
      relations: ['user'],
    });

    for (const order of orders) {
      if (!order.serviceTime) continue;
      const serviceTime = new Date(order.serviceTime);
      if (serviceTime < now || serviceTime > maxAhead) continue;

      const markerKey = `sign_reminder_order_${order.id}`;
      const alreadySent = await this.systemConfigRepository.findOne({
        where: { key: markerKey },
      });
      if (alreadySent) continue;

      const openid = order.user?.openid;
      if (!openid) continue;

      const delivered = await this.notificationService
        .notifyOrderSignReminder(
          openid,
          order.orderNumber,
          this.formatServiceTime(order.serviceTime),
          '服务即将开始，请尽快完成服务确认单签署',
          order.id,
        )
        .catch(() => false);
      if (!delivered) continue;

      await this.systemConfigRepository.save(
        this.systemConfigRepository.create({
          key: markerKey,
          value: now.toISOString(),
          description: '订单待签署催办发送标记',
        }),
      );
    }
  }

  /**
   * 待支付催办：订单已完成但支付状态仍为 unpaid，且完成后 ≥ 2h 时催客户结算。
   * 每小时扫描一次，最多发两次（首次 2h 后、二次 24h 后）。
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendPaymentReminders() {
    const now = new Date();
    const orders = await this.orderRepository.find({
      where: {
        status: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.UNPAID,
      },
      relations: ['user'],
      take: 500,
    });

    const stages = [
      { hour: 2, suffix: 'first' },
      { hour: 24, suffix: 'second' },
    ];

    for (const order of orders) {
      const completedAt = order.updatedAt ? new Date(order.updatedAt) : null;
      if (!completedAt) continue;
      const openid = order.user?.openid;
      if (!openid) continue;

      const hoursPassed = (now.getTime() - completedAt.getTime()) / (60 * 60 * 1000);

      for (const stage of stages) {
        if (hoursPassed < stage.hour) continue;
        const markerKey = `payment_reminder_order_${order.id}_${stage.suffix}`;
        const alreadySent = await this.systemConfigRepository.findOne({
          where: { key: markerKey },
        });
        if (alreadySent) continue;

        const amount = this.formatMoney(order.totalFee);
        const delivered = await this.notificationService
          .notifyOrderPaymentReminder(
            openid,
            order.orderNumber,
            amount,
            '服务已完成，请尽快完成订单结算',
            order.id,
          )
          .catch(() => false);
        if (!delivered) continue;

        await this.systemConfigRepository.save(
          this.systemConfigRepository.create({
            key: markerKey,
            value: now.toISOString(),
            description: '订单待支付催办发送标记',
          }),
        );
      }
    }
  }

  /**
   * 评价邀请：订单完成后 1h 发送一次评价邀请，如客户已提交评价则跳过。
   * 每 10 分钟扫描一次，幂等。
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendReviewInvites() {
    const now = new Date();
    const orders = await this.orderRepository.find({
      where: {
        status: OrderStatus.COMPLETED,
      },
      relations: ['user'],
      take: 500,
    });

    for (const order of orders) {
      const completedAt = order.updatedAt ? new Date(order.updatedAt) : null;
      if (!completedAt) continue;
      const hoursPassed = (now.getTime() - completedAt.getTime()) / (60 * 60 * 1000);
      if (hoursPassed < 1 || hoursPassed > 72) continue;

      const openid = order.user?.openid;
      if (!openid) continue;

      const markerKey = `review_invite_order_${order.id}`;
      const alreadySent = await this.systemConfigRepository.findOne({
        where: { key: markerKey },
      });
      if (alreadySent) continue;

      const existingReview = await this.reviewRepository.findOne({
        where: { orderId: order.id },
      });
      if (existingReview) {
        await this.systemConfigRepository.save(
          this.systemConfigRepository.create({
            key: markerKey,
            value: now.toISOString(),
            description: '订单评价邀请标记（已提交评价）',
          }),
        );
        continue;
      }

      const delivered = await this.notificationService
        .notifyOrderReviewInvite(
          openid,
          order.orderNumber,
          order.serviceType || '陪诊服务',
          '服务已完成，邀请您为本次服务评分',
          order.id,
        )
        .catch(() => false);
      if (!delivered) continue;

      await this.systemConfigRepository.save(
        this.systemConfigRepository.create({
          key: markerKey,
          value: now.toISOString(),
          description: '订单评价邀请发送标记',
        }),
      );
    }
  }

  private formatMoney(value?: number | string | null): string {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `¥${num.toFixed(2)}`;
  }

  private formatServiceTime(serviceTime?: Date | string | null): string {
    if (!serviceTime) return '待定';
    const d = new Date(serviceTime);
    if (isNaN(d.getTime())) return '待定';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private formatServiceLocation(
    order?: Pick<Order, 'serviceAddress' | 'hospital' | 'department'> | null,
  ): string {
    if (!order) return '待定';
    const primaryAddress = String(order.serviceAddress || '').trim();
    if (primaryAddress) return primaryAddress;
    const parts = [order.hospital, order.department]
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(' / ') : '待定';
  }

  private formatTargetName(
    order?: Pick<Order, 'serviceTarget' | 'user'> | null,
  ): string {
    const targetName = String(order?.serviceTarget?.name || '').trim();
    if (targetName) return targetName;
    const userName = String(order?.user?.nickname || '').trim();
    return userName || '待确认';
  }

  /**
   * 签发「服务动态」公开页令牌：下单用户（小程序 user）或管理端（type=admin）；
   * 验签逻辑与同用户分享一致，链接勿随意传播。
   */
  async issueTimelineShareToken(orderId: number, currentUserId: number, accountType: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (accountType === 'admin') {
      // 管理后台：用于生成监管/扫码链接，不要求订单归属
    } else if (accountType === 'user') {
      if (order.userId !== currentUserId) {
        throw new ForbiddenException('无权分享此订单');
      }
    } else {
      throw new ForbiddenException('请使用小程序用户或管理端账号生成分享');
    }
    const secret = this.configService.get<string>('JWT_SECRET')?.trim();
    if (!secret) {
      throw new BadRequestException('服务端未配置 JWT_SECRET，无法生成分享链接');
    }
    const token = signOrderTimelineShareToken(orderId, secret);
    const expSec = Math.floor(Date.now() / 1000) + ORDER_TIMELINE_SHARE_TTL_SEC;
    return {
      token,
      orderId,
      expiresAt: new Date(expSec * 1000).toISOString(),
    };
  }

  /** 公开：仅返回就诊人相关字段 + 用户可见时间线（需合法 token） */
  async getPublicOrderTimelinePack(orderId: number, token: string) {
    const secret = this.configService.get<string>('JWT_SECRET')?.trim();
    if (!secret) throw new ForbiddenException('分享暂不可用');
    if (!verifyOrderTimelineShareToken(token, secret, orderId)) {
      throw new ForbiddenException('链接无效或已过期');
    }
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['serviceTarget'],
    });
    if (!order) throw new NotFoundException('订单不存在');

    const rows = await this.timelineRepository.find({
      where: { orderId, visibleToUser: true },
      order: { createdAt: 'DESC' },
    });

    const items = rows.map((item) => ({
      id: item.id,
      type: item.type,
      content: item.content,
      createdAt: item.createdAt,
      metadata: item.metadata ?? null,
    }));

    const attendantLiveLocation =
      (order.status === OrderStatus.IN_PROGRESS ||
        order.status === OrderStatus.EMERGENCY) &&
      order.attendantLiveLat != null &&
      order.attendantLiveLng != null
        ? {
            latitude: Number(order.attendantLiveLat),
            longitude: Number(order.attendantLiveLng),
            updatedAt: order.attendantLiveAt
              ? new Date(order.attendantLiveAt).toISOString()
              : null,
          }
        : null;

    return {
      subjectName: order.serviceTarget?.name ?? '',
      serviceType: order.serviceType ?? '',
      serviceTime: order.serviceTime ?? null,
      hospital: order.hospital ?? '',
      department: order.department ?? '',
      /** 供分享页展示状态（进行中时可显示实时位置区块） */
      orderStatus: order.status,
      attendantLiveLocation,
      items,
    };
  }

  /** 扫码启动页：短 scene → 订单公开访问参数 */
  async resolveMpMonitorScene(code: string) {
    const row = await this.mpMonitorSceneRepository.findOne({
      where: { code: code.trim() },
    });
    if (!row) {
      throw new ForbiddenException('无效的场景码');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('该二维码已过期，请在后端重新生成');
    }
    return {
      orderId: row.orderId,
      token: row.token,
      sceneType: row.sceneType || 'timeline',
    };
  }

  /**
   * 管理端：生成签署专用小程序码（PNG base64）。
   * 用户扫码后直接进入服务确认单签署页面。
   */
  async getWxaSignQrcodeBase64(
    orderId: number,
    accountType: string,
  ): Promise<{ imageBase64: string }> {
    if (accountType !== 'admin') {
      throw new ForbiddenException('仅管理端可生成签署二维码');
    }
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.serviceType !== '陪诊服务') {
      throw new BadRequestException('当前订单类型无需签署');
    }
    if (order.serviceConfirmSignedAt) {
      throw new BadRequestException('该订单已完成签署');
    }

    let sceneCode = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomBytes(16).toString('hex');
      const clash = await this.mpMonitorSceneRepository.exist({
        where: { code: candidate },
      });
      if (!clash) {
        sceneCode = candidate;
        break;
      }
    }
    if (!sceneCode) {
      throw new BadRequestException('生成场景码失败，请重试');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await this.mpMonitorSceneRepository.delete({
      orderId,
      sceneType: 'sign',
    });
    await this.mpMonitorSceneRepository.save(
      this.mpMonitorSceneRepository.create({
        code: sceneCode,
        orderId,
        token: String(orderId),
        sceneType: 'sign',
        expiresAt,
      }),
    );

    const png = await this.downloadWxacodeUnlimitedPng(sceneCode);
    return { imageBase64: png.toString('base64') };
  }

  /**
   * 管理端：生成健康档案签署专用小程序码。
   * 用户扫码后直接进入健康档案页面完成签署。
   */
  async getWxaHealthSignQrcodeBase64(
    serviceTargetId: number,
    accountType: string,
  ): Promise<{ imageBase64: string }> {
    if (accountType !== 'admin') {
      throw new ForbiddenException('仅管理端可生成签署二维码');
    }

    let sceneCode = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomBytes(16).toString('hex');
      const clash = await this.mpMonitorSceneRepository.exist({
        where: { code: candidate },
      });
      if (!clash) {
        sceneCode = candidate;
        break;
      }
    }
    if (!sceneCode) {
      throw new BadRequestException('生成场景码失败，请重试');
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    await this.mpMonitorSceneRepository.save(
      this.mpMonitorSceneRepository.create({
        code: sceneCode,
        orderId: serviceTargetId,
        token: String(serviceTargetId),
        sceneType: 'health_sign',
        expiresAt,
      }),
    );

    const png = await this.downloadWxacodeUnlimitedPng(sceneCode);
    return { imageBase64: png.toString('base64') };
  }

  /**
   * 管理端：获取或创建 health_sign 场景码（不生成 QR 图片），用于微信转发分享。
   * 若已有未过期场景码则直接返回，否则新建。
   */
  async getOrCreateHealthSignSceneCode(
    serviceTargetId: number,
  ): Promise<{ sceneCode: string }> {
    const existing = await this.mpMonitorSceneRepository.findOne({
      where: {
        orderId: serviceTargetId,
        sceneType: 'health_sign' as any,
        expiresAt: MoreThan(new Date()),
      },
      order: { expiresAt: 'DESC' },
    });
    if (existing) return { sceneCode: existing.code };

    let sceneCode = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomBytes(16).toString('hex');
      const clash = await this.mpMonitorSceneRepository.exist({
        where: { code: candidate },
      });
      if (!clash) {
        sceneCode = candidate;
        break;
      }
    }
    if (!sceneCode) {
      throw new BadRequestException('生成场景码失败，请重试');
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await this.mpMonitorSceneRepository.save(
      this.mpMonitorSceneRepository.create({
        code: sceneCode,
        orderId: serviceTargetId,
        token: String(serviceTargetId),
        sceneType: 'health_sign',
        expiresAt,
      }),
    );
    return { sceneCode };
  }

  /**
   * 管理端：获取或创建 sign 场景码（服务确认单），用于微信转发分享。
   */
  async getOrCreateServiceConfirmSceneCode(
    orderId: number,
  ): Promise<{ sceneCode: string }> {
    const existing = await this.mpMonitorSceneRepository.findOne({
      where: {
        orderId,
        sceneType: 'sign' as any,
        expiresAt: MoreThan(new Date()),
      },
      order: { expiresAt: 'DESC' },
    });
    if (existing) return { sceneCode: existing.code };

    let sceneCode = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomBytes(16).toString('hex');
      const clash = await this.mpMonitorSceneRepository.exist({
        where: { code: candidate },
      });
      if (!clash) {
        sceneCode = candidate;
        break;
      }
    }
    if (!sceneCode) throw new BadRequestException('生成场景码失败，请重试');

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.mpMonitorSceneRepository.save(
      this.mpMonitorSceneRepository.create({
        code: sceneCode,
        orderId,
        token: String(orderId),
        sceneType: 'sign',
        expiresAt,
      }),
    );
    return { sceneCode };
  }

  /**
   * 公开接口通用：校验签名类场景码（sign / health_sign），合法则返回详情
   * 用于无登录态的签名图片上传等场景做最小凭证验证
   */
  async validateSignSceneCode(
    sceneCode: string,
  ): Promise<{ sceneType: 'sign' | 'health_sign'; orderId: number }> {
    const code = (sceneCode || '').trim();
    if (!code || code.length > 32) {
      throw new ForbiddenException('无效的场景码');
    }
    const row = await this.mpMonitorSceneRepository.findOne({
      where: { code },
    });
    if (!row) throw new ForbiddenException('无效的场景码');
    if (!['sign', 'health_sign'].includes(row.sceneType)) {
      throw new ForbiddenException('该场景码不支持签名操作');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('该二维码已过期，请在管理后台重新生成');
    }
    return {
      sceneType: row.sceneType as 'sign' | 'health_sign',
      orderId: row.orderId,
    };
  }

  /**
   * 公开接口：凭 sceneCode 读取服务确认单状态（无需登录）
   */
  async getPublicServiceConfirmStatus(sceneCode: string) {
    const row = await this.mpMonitorSceneRepository.findOne({
      where: { code: sceneCode.trim(), sceneType: 'sign' as any },
    });
    if (!row) throw new ForbiddenException('无效的场景码');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('该二维码已过期，请在管理后台重新生成');
    }
    return this.documentService.getServiceConfirmStatusPublic(row.orderId);
  }

  /**
   * 公开接口：凭 sceneCode 签署服务确认单（无需登录）
   */
  async signPublicServiceConfirm(
    sceneCode: string,
    body: { signatureUrl: string; signerName?: string; signerRelation?: string },
  ) {
    const row = await this.mpMonitorSceneRepository.findOne({
      where: { code: sceneCode.trim(), sceneType: 'sign' as any },
    });
    if (!row) throw new ForbiddenException('无效的场景码');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('该二维码已过期，请在管理后台重新生成');
    }
    return this.documentService.signServiceConfirmPublic(row.orderId, body);
  }

  /**
   * 公开接口：凭 sceneCode 读取健康档案（无需登录）
   */
  async getPublicHealthProfile(sceneCode: string) {
    const row = await this.mpMonitorSceneRepository.findOne({
      where: { code: sceneCode.trim(), sceneType: 'health_sign' },
    });
    if (!row) throw new ForbiddenException('无效的场景码');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('该二维码已过期，请在管理后台重新生成');
    }
    const serviceTargetId = row.orderId;
    const target = await this.serviceTargetRepository.findOne({
      where: { id: serviceTargetId },
    });
    if (!target) throw new NotFoundException('服务对象不存在');
    return target;
  }

  /**
   * 公开接口：凭 sceneCode 保存健康档案（无需登录）
   */
  async updatePublicHealthProfile(
    sceneCode: string,
    dto: Record<string, any>,
  ) {
    const row = await this.mpMonitorSceneRepository.findOne({
      where: { code: sceneCode.trim(), sceneType: 'health_sign' },
    });
    if (!row) throw new ForbiddenException('无效的场景码');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('该二维码已过期，请在管理后台重新生成');
    }
    const serviceTargetId = row.orderId;
    const target = await this.serviceTargetRepository.findOne({
      where: { id: serviceTargetId },
    });
    if (!target) throw new NotFoundException('服务对象不存在');

    const { healthProfile: incomingHP, ...rest } = dto;
    const existingHP = this.parseHealthProfile(
      target.healthProfile as Record<string, unknown> | string | null,
    );

    const safeFields = [
      'idCard',
      'emergencyContact',
      'emergencyPhone',
      'mainAppeal',
      'signatureUrl',
      'homeAddress',
    ];
    for (const key of safeFields) {
      if (rest[key] !== undefined) {
        (target as any)[key] = rest[key];
      }
    }

    // 仅允许档案页明确需要的 healthProfile 字段写入，防止客户端塞入任意键
    // 污染 JSON 列（例如内部状态字段）。白名单与 health-profile 页保存 payload 保持一致。
    const HEALTH_PROFILE_WHITELIST = [
      'homeRegion',
      'homeAddressDetail',
      'emergencyRelation',
      'fillMethod',
      'mobilityStatus',
      'bloodType',
      'allergies',
      'medicalHistory',
      'medicalHistoryOther',
      'visionStatus',
      'hearingStatus',
      'recentSymptoms',
      'recentSymptomsOther',
      'currentMedication',
      'currentMedications',
      'signatureName',
      'signedAt',
      'signerName',
      'signerRelation',
    ] as const;

    if (incomingHP && typeof incomingHP === 'object' && !Array.isArray(incomingHP)) {
      const filteredHP: Record<string, unknown> = {};
      for (const key of HEALTH_PROFILE_WHITELIST) {
        if ((incomingHP as Record<string, unknown>)[key] !== undefined) {
          filteredHP[key] = (incomingHP as Record<string, unknown>)[key];
        }
      }
      target.healthProfile = { ...existingHP, ...filteredHP };
    }
    if (rest.homeAddress) {
      target.healthProfile = { ...(target.healthProfile as any || {}), address: rest.homeAddress };
    }

    return this.serviceTargetRepository.save(target);
  }

  /**
   * 管理端：生成微信官方「无数量限制」小程序码（PNG base64）。
   * 需配置 WECHAT_APPID / WECHAT_SECRET，且小程序已发布对应页面；开发阶段可设 WECHAT_MP_QR_ENV_VERSION=trial。
   */
  async getWxaMonitorQrcodeBase64(
    orderId: number,
    accountType: string,
  ): Promise<{ imageBase64: string }> {
    if (accountType !== 'admin') {
      throw new ForbiddenException('仅管理端可生成小程序码');
    }
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const jwtSecret = this.configService.get<string>('JWT_SECRET')?.trim();
    if (!jwtSecret) {
      throw new BadRequestException('服务端未配置 JWT_SECRET');
    }
    const shareToken = signOrderTimelineShareToken(orderId, jwtSecret);
    const expiresAt = new Date(Date.now() + ORDER_TIMELINE_SHARE_TTL_SEC * 1000);

    let sceneCode = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomBytes(16).toString('hex');
      const clash = await this.mpMonitorSceneRepository.exist({
        where: { code: candidate },
      });
      if (!clash) {
        sceneCode = candidate;
        break;
      }
    }
    if (!sceneCode) {
      throw new BadRequestException('生成场景码失败，请重试');
    }

    await this.mpMonitorSceneRepository.delete({ orderId, sceneType: 'timeline' });
    await this.mpMonitorSceneRepository.save(
      this.mpMonitorSceneRepository.create({
        code: sceneCode,
        orderId,
        token: shareToken,
        sceneType: 'timeline',
        expiresAt,
      }),
    );

    const png = await this.downloadWxacodeUnlimitedPng(sceneCode);
    return { imageBase64: png.toString('base64') };
  }

  /**
   * 生成陪诊服务报告分享用小程序码。
   *
   * 权限：订单 owner / 家庭组成员 / 管理端均可调用（复用 findOne 的 assertOrderAccess）。
   * 生成的 sceneType = 'service_report'，扫码后由 scene-launch 路由进入 service-report 页。
   *
   * 同一订单 7 天内已生成的会复用，避免频繁消耗微信 QR 配额；前端拿到 base64 后
   * 可贴在 Canvas 分享封面右下角。
   */
  async getWxaServiceReportQrcodeBase64(
    orderId: number,
    currentUserId: number,
    role: string,
  ): Promise<{ imageBase64: string }> {
    // 复用 findOne 校验权限（非本人 / 非家属 / 非管理端会抛 Forbidden）
    await this.findOne(orderId, currentUserId, role);

    const existing = await this.mpMonitorSceneRepository.findOne({
      where: {
        orderId,
        sceneType: 'service_report' as any,
        expiresAt: MoreThan(new Date()),
      },
      order: { expiresAt: 'DESC' },
    });

    let sceneCode = existing?.code || '';
    if (!sceneCode) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = randomBytes(16).toString('hex');
        const clash = await this.mpMonitorSceneRepository.exist({
          where: { code: candidate },
        });
        if (!clash) {
          sceneCode = candidate;
          break;
        }
      }
      if (!sceneCode) {
        throw new BadRequestException('生成场景码失败，请重试');
      }
      await this.mpMonitorSceneRepository.save(
        this.mpMonitorSceneRepository.create({
          code: sceneCode,
          orderId,
          token: String(orderId),
          sceneType: 'service_report',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        }),
      );
    }

    const png = await this.downloadWxacodeUnlimitedPng(sceneCode);
    return { imageBase64: png.toString('base64') };
  }

  private async getWechatMiniAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.mpAccessTokenCache &&
      this.mpAccessTokenCache.expiresAtMs > now + 120_000
    ) {
      return this.mpAccessTokenCache.token;
    }
    const appid = this.configService.get<string>('WECHAT_APPID')?.trim();
    const secret = this.configService.get<string>('WECHAT_SECRET')?.trim();
    if (!appid || !secret) {
      throw new BadRequestException(
        '未配置 WECHAT_APPID / WECHAT_SECRET，无法调用微信生成小程序码',
      );
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
    let json: {
      access_token?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    };
    try {
      const res = await fetch(url);
      json = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        errcode?: number;
        errmsg?: string;
      };
    } catch (error) {
      this.logger.error(
        `get wx access_token failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('获取微信 access_token 失败，请稍后重试');
    }
    if (!json.access_token) {
      throw new BadRequestException(
        json.errmsg || '获取微信 access_token 失败，请检查 AppID 与 Secret 是否为同一个小程序',
      );
    }
    const ttlMs = (json.expires_in ?? 7200) * 1000;
    this.mpAccessTokenCache = {
      token: json.access_token,
      expiresAtMs: now + ttlMs,
    };
    return json.access_token;
  }

  private async downloadWxacodeUnlimitedPng(scene: string): Promise<Buffer> {
    const accessToken = await this.getWechatMiniAccessToken();
    const envRaw =
      this.configService.get<string>('WECHAT_MP_QR_ENV_VERSION')?.trim() ||
      'release';
    const env_version =
      envRaw === 'develop' || envRaw === 'trial' || envRaw === 'release'
        ? envRaw
        : 'release';
    const api = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`;
    const body = {
      scene,
      page: 'pages/order/scene-launch/scene-launch',
      check_path: false,
      env_version,
      width: 430,
    };
    let buf: Buffer;
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      buf = Buffer.from(await res.arrayBuffer());
    } catch (error) {
      this.logger.error(
        `download wxa code failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('生成小程序码失败，请稍后重试');
    }
    if (buf.length > 0 && buf[0] === 0x7b) {
      try {
        const err = JSON.parse(buf.toString('utf8')) as {
          errcode?: number;
          errmsg?: string;
        };
        throw new BadRequestException(
          err.errmsg ||
            `微信返回错误${err.errcode != null ? ` (${err.errcode})` : ''}`,
        );
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException('生成小程序码失败（微信接口异常）');
      }
    }
    if (buf.length < 100) {
      throw new BadRequestException('生成小程序码失败（响应过短）');
    }
    return buf;
  }

}
