import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, In } from 'typeorm';
import {
  MedicationPrescription,
  PrescriptionReviewStatus,
} from '../../entities/medication-prescription.entity.js';
import {
  MedicationReminder,
  ReminderFrequency,
  ReminderSeverity,
  ReminderStatus,
  ReminderType,
} from '../../entities/medication-reminder.entity.js';
import {
  MedicationReminderAudit,
  MedicationAuditAction,
  MedicationAuditActorType,
} from '../../entities/medication-reminder-audit.entity.js';
import { User } from '../../entities/user.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { Order } from '../../entities/order.entity.js';
import { UserRole } from '../../common/enums/index.js';
import { MedicationPolicyService } from '../medication-reminder/medication-policy.service.js';
import { MedicationNotificationService } from '../medication-notification/medication-notification.service.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  CreatePrescriptionDto,
  PrescriptionItemDto,
} from './dto/create-prescription.dto.js';

/**
 * 处方批次服务：一张处方 → 多条 MedicationReminder，事务落地。
 *
 * 职责：
 *  - 校验用户 / 服务对象 / 订单归属关系；
 *  - 为每味药自动计算 endDate / reminderTimes（未提供时），写入严重度与升级策略；
 *  - 全部 reminder 写入 audit 日志（动作 = create）；
 *  - replaceExisting=true 时，先把同 user+serviceTarget 的 active 同名药 cancelled，再新建。
 */
@Injectable()
export class MedicationPrescriptionService {
  private readonly logger = new Logger(MedicationPrescriptionService.name);

  constructor(
    @InjectRepository(MedicationPrescription)
    private readonly prescriptionRepo: Repository<MedicationPrescription>,
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(MedicationReminderAudit)
    private readonly auditRepo: Repository<MedicationReminderAudit>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ServiceTarget)
    private readonly serviceTargetRepo: Repository<ServiceTarget>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly policyService: MedicationPolicyService,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly medicationNotificationService: MedicationNotificationService,
  ) {}

  async create(
    dto: CreatePrescriptionDto,
    operator: { id: number; role: string; name?: string },
  ): Promise<{
    prescription: MedicationPrescription;
    reminders: MedicationReminder[];
  }> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('用户不存在');

    if (dto.serviceTargetId) {
      const target = await this.serviceTargetRepo.findOne({
        where: { id: dto.serviceTargetId },
      });
      if (!target) throw new NotFoundException('服务对象不存在');
      if (target.userId !== dto.userId) {
        throw new BadRequestException('服务对象不属于该用户');
      }
    }

    if (dto.orderId) {
      const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
      if (!order) throw new NotFoundException('订单不存在');
      if (order.userId !== dto.userId && !this.isAdminLikeRole(operator.role)) {
        throw new ForbiddenException('订单不属于该用户');
      }
    }

    const normalizedItems = dto.items.map((item) => this.normalizeItem(item));
    for (const item of normalizedItems) {
      if (!item.medicineName?.trim()) {
        throw new BadRequestException('存在未填写药品名称的条目');
      }
      if (item.totalQuantity <= 0 || item.timesPerDay <= 0 || item.dosePerTime <= 0) {
        throw new BadRequestException(
          `${item.medicineName}：总药量 / 每次用量 / 每日频次必须 > 0`,
        );
      }
    }

    // 陪诊员提交的处方先走待审队列：保留 itemsDraft 供运营二审，不立即建 reminder。
    const needsReview = operator.role === UserRole.ATTENDANT;
    const reviewStatus = needsReview
      ? PrescriptionReviewStatus.PENDING_REVIEW
      : PrescriptionReviewStatus.APPROVED;

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const prescriptionRepo = manager.getRepository(MedicationPrescription);

      const prescription = prescriptionRepo.create({
        userId: dto.userId,
        serviceTargetId: dto.serviceTargetId ?? null,
        orderId: dto.orderId ?? null,
        sourceImage: dto.sourceImage ?? null,
        hospital: dto.hospital ?? null,
        doctorName: dto.doctorName ?? null,
        department: dto.department ?? null,
        issuedDate: dto.issuedDate ?? null,
        note: dto.note ?? null,
        createdBy: this.isAdminLikeRole(operator.role) ? operator.id : null,
        submittedByUserId: operator.id,
        submittedByRole: operator.role,
        reviewStatus,
        itemsDraft: needsReview
          ? {
              replaceExisting: dto.replaceExisting ?? false,
              startDate: dto.startDate,
              items: normalizedItems,
            }
          : null,
      } as Partial<MedicationPrescription>);
      const savedPrescription = await prescriptionRepo.save(prescription);

      if (needsReview) {
        // 待审处方：不写 medication_reminders，直接返回；
        // 运营在后台点"通过"会走 approve() 统一把 itemsDraft 搬到正式提醒。
        return { prescription: savedPrescription, reminders: [] as MedicationReminder[] };
      }

      const reminders = await this.materializeReminders(manager, {
        prescription: savedPrescription,
        items: normalizedItems,
        startDate: dto.startDate,
        replaceExisting: dto.replaceExisting ?? false,
        operator,
      });
      return { prescription: savedPrescription, reminders };
    });

    // 事务提交后再发通知（网络 IO 不阻塞事务 & 失败不回滚业务数据）。
    // PENDING_REVIEW：兜底提醒运营尽快到后台审核，避免"看不到就漏审"。
    if (needsReview) {
      this.notifyAdminsOnPending(result.prescription).catch((err) => {
        this.logger.warn(
          `[prescription#${result.prescription.id}] 通知运营审核失败: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    return result;
  }

  /**
   * 把 items 真实写入 medication_reminders，并写审计。公共方法供 create(approved) 与 approve() 共用。
   */
  private async materializeReminders(
    manager: EntityManager,
    params: {
      prescription: MedicationPrescription;
      items: PrescriptionItemDto[];
      startDate: string;
      replaceExisting: boolean;
      operator: { id: number; role: string; name?: string };
    },
  ): Promise<MedicationReminder[]> {
    const reminderRepo = manager.getRepository(MedicationReminder);
    const auditRepo = manager.getRepository(MedicationReminderAudit);
    const { prescription, items, startDate, replaceExisting, operator } = params;
    const reminders: MedicationReminder[] = [];

    for (const item of items) {
      if (replaceExisting) {
        await this.cancelExistingSameName(manager, {
          userId: prescription.userId,
          serviceTargetId: prescription.serviceTargetId ?? null,
          medicineName: item.medicineName.trim(),
          operator,
        });
      }

      const severity = item.severity || ReminderSeverity.MEDIUM;
      const reminderTimes =
        item.reminderTimes && item.reminderTimes.length > 0
          ? item.reminderTimes
          : this.policyService.buildDefaultReminderTimes(item.timesPerDay);
      if (reminderTimes.length === 0) {
        throw new BadRequestException(
          `${item.medicineName}：无法生成提醒时间（每日频次或自定义时间均为空）`,
        );
      }

      const endDate =
        this.policyService.computeEndDate({
          startDate,
          totalQuantity: item.totalQuantity,
          dosePerTime: item.dosePerTime,
          timesPerDay: item.timesPerDay,
        }) || startDate;

      const reminder = reminderRepo.create({
        userId: prescription.userId,
        serviceTargetId: prescription.serviceTargetId ?? undefined,
        orderId: prescription.orderId ?? undefined,
        prescriptionId: prescription.id,
        medicineName: item.medicineName.trim(),
        reminderType: ReminderType.MEDICATION,
        severity,
        dosage: item.dosage?.trim() || '',
        dosePerTime: item.dosePerTime,
        timesPerDay: item.timesPerDay,
        totalQuantity: item.totalQuantity,
        unit: item.unit?.trim() || null,
        frequency: ReminderFrequency.DAILY,
        reminderTimes,
        startDate,
        endDate,
        instructions: item.instructions?.trim() || '',
        status: ReminderStatus.ACTIVE,
        missEscalationOverride: item.missEscalationOverride ?? null,
        createdBy: this.isAdminLikeRole(operator.role) ? operator.id : undefined,
      } as Partial<MedicationReminder>);
      const saved = (await reminderRepo.save(
        reminder as MedicationReminder,
      )) as MedicationReminder;
      reminders.push(saved);

      await auditRepo.save(
        auditRepo.create({
          reminderId: saved.id,
          actorType: this.resolveActorType(operator.role),
          actorId: operator.id,
          actorName: operator.name || null,
          action: MedicationAuditAction.CREATE,
          diffJson: null,
          note: `通过处方批次 #${prescription.id} 创建`,
        }),
      );
    }

    return reminders;
  }

  async approve(
    id: number,
    operator: { id: number; role: string; name?: string },
    overrides?: {
      items?: PrescriptionItemDto[];
      startDate?: string;
      reviewNote?: string;
    },
  ): Promise<{
    prescription: MedicationPrescription;
    reminders: MedicationReminder[];
  }> {
    if (!this.isAdminLikeRole(operator.role)) {
      throw new ForbiddenException('仅运营/客服/药师可审核处方');
    }
    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const prescriptionRepo = manager.getRepository(MedicationPrescription);
      const prescription = await prescriptionRepo.findOne({ where: { id } });
      if (!prescription) throw new NotFoundException('处方不存在');
      if (prescription.reviewStatus === PrescriptionReviewStatus.APPROVED) {
        throw new BadRequestException('处方已通过审核，无需再次审核');
      }

      const draft = (prescription.itemsDraft as any) || {};
      const items: PrescriptionItemDto[] =
        (overrides?.items && overrides.items.length > 0 ? overrides.items : draft.items || []).map(
          (i: any) => this.normalizeItem(i),
        );
      const startDate = overrides?.startDate || draft.startDate || prescription.issuedDate;
      const replaceExisting = Boolean(draft.replaceExisting);

      if (!startDate) {
        throw new BadRequestException('审核失败：缺少服药起始日');
      }
      if (items.length === 0) {
        throw new BadRequestException('审核失败：药品清单为空');
      }

      const reminders = await this.materializeReminders(manager, {
        prescription,
        items,
        startDate,
        replaceExisting,
        operator,
      });

      prescription.reviewStatus = PrescriptionReviewStatus.APPROVED;
      prescription.reviewerId = operator.id;
      prescription.reviewedAt = new Date();
      prescription.reviewNote = overrides?.reviewNote || null;
      // 已物化为 reminders 的 draft 清空，避免后台误点"再次通过"
      prescription.itemsDraft = null;
      await prescriptionRepo.save(prescription);

      return { prescription, reminders };
    });

    // 事务提交后推送家属"处方已就绪"。
    // 对于 startDate 在未来几天之后的处方，家属此刻就能看到"共生成 N 条提醒"，
    // 不必等到首次服药时间点才收到 FIRST_PUSH。
    if (result.reminders.length > 0) {
      this.notifyFamilyOnApprove(result.prescription, result.reminders).catch(
        (err) => {
          this.logger.warn(
            `[prescription#${result.prescription.id}] 通知家属处方就绪失败: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        },
      );
    }

    return result;
  }

  async reject(
    id: number,
    operator: { id: number; role: string; name?: string },
    reason: string,
  ): Promise<MedicationPrescription> {
    if (!this.isAdminLikeRole(operator.role)) {
      throw new ForbiddenException('仅运营/客服/药师可审核处方');
    }
    const prescription = await this.prescriptionRepo.findOne({ where: { id } });
    if (!prescription) throw new NotFoundException('处方不存在');
    if (prescription.reviewStatus === PrescriptionReviewStatus.APPROVED) {
      throw new BadRequestException('已通过的处方不能驳回，请使用取消提醒');
    }
    prescription.reviewStatus = PrescriptionReviewStatus.REJECTED;
    prescription.reviewerId = operator.id;
    prescription.reviewedAt = new Date();
    prescription.reviewNote = (reason || '').slice(0, 500) || '未填驳回原因';
    return this.prescriptionRepo.save(prescription);
  }

  async findOne(id: number): Promise<MedicationPrescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id },
      relations: ['user', 'serviceTarget', 'order', 'reminders'],
    });
    if (!prescription) throw new NotFoundException('处方不存在');
    return prescription;
  }

  async listByUser(userId: number): Promise<MedicationPrescription[]> {
    return this.prescriptionRepo.find({
      where: { userId },
      relations: ['serviceTarget', 'reminders'],
      order: { issuedDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async list(query: {
    userId?: number;
    serviceTargetId?: number;
    reviewStatus?: PrescriptionReviewStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.serviceTarget', 'serviceTarget')
      .leftJoinAndSelect('p.order', 'order')
      .loadRelationCountAndMap('p.reminderCount', 'p.reminders');

    if (query.userId) qb.andWhere('p.userId = :userId', { userId: query.userId });
    if (query.serviceTargetId) {
      qb.andWhere('p.serviceTargetId = :stid', { stid: query.serviceTargetId });
    }
    if (query.reviewStatus) {
      qb.andWhere('p.reviewStatus = :rs', { rs: query.reviewStatus });
    }

    qb.orderBy('p.reviewStatus', 'ASC')
      .addOrderBy('p.createdAt', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  private normalizeItem(item: PrescriptionItemDto): PrescriptionItemDto {
    return {
      ...item,
      medicineName: String(item.medicineName || '').trim(),
      unit: String(item.unit || '').trim(),
      dosage: item.dosage ? String(item.dosage).trim() : undefined,
      instructions: item.instructions
        ? String(item.instructions).trim()
        : undefined,
      severity: item.severity || ReminderSeverity.MEDIUM,
    };
  }

  private async cancelExistingSameName(
    manager: EntityManager,
    params: {
      userId: number;
      serviceTargetId: number | null;
      medicineName: string;
      operator: { id: number; role: string; name?: string };
    },
  ) {
    const reminderRepo = manager.getRepository(MedicationReminder);
    const auditRepo = manager.getRepository(MedicationReminderAudit);
    const existing = await reminderRepo.find({
      where: {
        userId: params.userId,
        serviceTargetId: params.serviceTargetId ?? undefined,
        medicineName: params.medicineName,
        status: In([ReminderStatus.ACTIVE, ReminderStatus.PAUSED]),
        reminderType: ReminderType.MEDICATION,
      },
    });
    if (existing.length === 0) return;
    await reminderRepo.update(
      { id: In(existing.map((e: MedicationReminder) => e.id)) },
      { status: ReminderStatus.CANCELLED },
    );
    for (const old of existing) {
      await auditRepo.save(
        auditRepo.create({
          reminderId: old.id,
          actorType: this.resolveActorType(params.operator.role),
          actorId: params.operator.id,
          actorName: params.operator.name || null,
          action: MedicationAuditAction.CANCEL,
          diffJson: {
            status: { from: old.status, to: ReminderStatus.CANCELLED },
          },
          note: '被新处方同名药自动取消',
        }),
      );
    }
  }

  private isAdminLikeRole(role?: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT
    );
  }

  private resolveActorType(role?: string): MedicationAuditActorType {
    if (this.isAdminLikeRole(role)) return MedicationAuditActorType.ADMIN;
    if (!role) return MedicationAuditActorType.SYSTEM;
    return MedicationAuditActorType.USER;
  }

  /**
   * 陪诊员提交处方后，主动通知在岗运营/客服/药师：有处方需要审核。
   *
   * 为什么不入 medication_notification_jobs：
   *   - 该表字段 reminder_id NOT NULL，此时处方还没物化 reminder；
   *   - NotificationService.notifyAdminsPrescriptionPendingReview 直接走短信通道，
   *     拿到目标手机号就发，失败记录在 sms_send_log，语义上更贴近"通知管理员"。
   *
   * 目标手机号来源：AdminUser 表中 status=active 且角色属于运营/客服/药师/admin。
   */
  private async notifyAdminsOnPending(
    prescription: MedicationPrescription,
  ): Promise<void> {
    const [serviceTarget, user] = await Promise.all([
      prescription.serviceTargetId
        ? this.serviceTargetRepo.findOne({
            where: { id: prescription.serviceTargetId },
          })
        : Promise.resolve(null),
      this.userRepo.findOne({ where: { id: prescription.userId } }),
    ]);
    const targetName =
      serviceTarget?.name || user?.nickname || `用户#${prescription.userId}`;

    const sent = await this.notificationService.notifyAdminsPrescriptionPendingReview(
      targetName,
      prescription.id,
      prescription.doctorName || '',
      async () => {
        const adminTargets =
          await this.medicationNotificationService.resolveAdminTargets();
        return adminTargets
          .map((t) => t.targetPhone || '')
          .filter((phone) => phone.length > 0);
      },
    );
    this.logger.log(
      `[prescription#${prescription.id}] 已通知 ${sent} 位运营审核（PENDING_REVIEW）`,
    );
  }

  /**
   * 处方审核通过后，给家属（主账号 + 家庭群里的 guardian）推"处方已就绪"。
   *
   * 复用 MedicationNotificationService.resolveReminderTargets：
   *   - 任取一条 reminder 作为 "关系载体"，函数内部会展开 user + 家庭群 guardian 的 openid；
   *   - 避免这里再自行查 FamilyMember，保证"推送目标集"与用药提醒保持一致。
   *
   * 药品摘要只展示前 2 个药名 + "等"，留出微信 thing3.DATA 20 字余量。
   */
  private async notifyFamilyOnApprove(
    prescription: MedicationPrescription,
    reminders: MedicationReminder[],
  ): Promise<void> {
    const representative = reminders[0];
    if (!representative) return;

    const serviceTarget = prescription.serviceTargetId
      ? await this.serviceTargetRepo.findOne({
          where: { id: prescription.serviceTargetId },
        })
      : null;
    const user = await this.userRepo.findOne({
      where: { id: prescription.userId },
    });
    const targetName =
      serviceTarget?.name || user?.nickname || '家人';

    const uniqueNames = Array.from(
      new Set(reminders.map((r) => (r.medicineName || '').trim()).filter(Boolean)),
    );
    const medicineSummary =
      uniqueNames.length <= 2
        ? uniqueNames.join('、')
        : `${uniqueNames.slice(0, 2).join('、')}等`;

    const { miniProgramTargets } =
      await this.medicationNotificationService.resolveReminderTargets(
        representative,
      );
    if (miniProgramTargets.length === 0) {
      this.logger.debug(
        `[prescription#${prescription.id}] 无可用家属 openid，跳过就绪通知`,
      );
      return;
    }

    const uniqueOpenids = new Set<string>();
    let notified = 0;
    for (const target of miniProgramTargets) {
      const openid = target.targetOpenid;
      if (!openid || uniqueOpenids.has(openid)) continue;
      uniqueOpenids.add(openid);
      const ok = await this.notificationService.notifyFamilyPrescriptionReady(
        openid,
        targetName,
        medicineSummary,
        reminders.length,
        prescription.id,
      );
      if (ok) notified += 1;
    }
    this.logger.log(
      `[prescription#${prescription.id}] 处方就绪推送完成：${notified}/${uniqueOpenids.size}`,
    );
  }
}
