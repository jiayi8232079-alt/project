import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserService } from '../../user/user.service.js';
import { OrderService } from '../../order/order.service.js';
import { MedicationReminderService } from '../../medication-reminder/medication-reminder.service.js';
import { MedicationExecutionService } from '../../alert/medication-execution.service.js';
import { AlertService } from '../../alert/alert.service.js';
import { DeviceService } from '../../device/device.service.js';
import { DeviceContext } from './tool.interface.js';
import {
  ReminderStatus,
  ReminderType,
} from '../../../entities/medication-reminder.entity.js';
import {
  MedicationExecutionLog,
  MedicationExecutionStatus,
} from '../../../entities/medication-execution-log.entity.js';
import { OrderStatus } from '../../../common/enums/index.js';
import { HealthWeeklyReport } from '../../../entities/health-weekly-report.entity.js';
import {
  AlertSeverity,
  AlertStatus,
  HealthAlert,
} from '../../../entities/health-alert.entity.js';
import {
  DeviceEventLevel,
  DeviceEventType,
} from '../../../entities/device-event-log.entity.js';

type DeviceAlertType = 'fall' | 'sos' | 'vital_anomaly';
type ToolAlertType = DeviceAlertType | 'manual';
type McpAlertSeverity = 'info' | 'warn' | 'emergency';

@Injectable()
export class McpCompanionDataService {
  private readonly logger = new Logger(McpCompanionDataService.name);

  constructor(
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly medicationReminderService: MedicationReminderService,
    private readonly medicationExecutionService: MedicationExecutionService,
    private readonly alertService: AlertService,
    private readonly deviceService: DeviceService,
    @InjectRepository(HealthWeeklyReport)
    private readonly weeklyReportRepo: Repository<HealthWeeklyReport>,
    @InjectRepository(HealthAlert)
    private readonly alertRepo: Repository<HealthAlert>,
    @InjectRepository(MedicationExecutionLog)
    private readonly executionLogRepo: Repository<MedicationExecutionLog>,
  ) {}

  async getProfile(ctx: DeviceContext) {
    const targetId = ctx.serviceTargetId;
    if (targetId == null) {
      throw new Error('设备未绑定服务对象');
    }
    const target = await this.userService.findServiceTargetById(
      targetId,
      ctx.userId,
    );
    const hp = this.parseJsonRecord(target.healthProfile);
    const chronicTags = this.extractChronicTags(hp);
    const preferredCalls = this.extractPreferredCalls(hp);

    return {
      name: target.name,
      ageYears: target.age ?? hp.age ?? null,
      city: hp.city ?? hp.homeCity ?? null,
      chronicTags,
      preferredCalls,
    };
  }

  async getOrders(
    ctx: DeviceContext,
    args: { status?: string; limit?: number },
  ) {
    const targetId = ctx.serviceTargetId;
    if (targetId == null) {
      throw new Error('设备未绑定服务对象');
    }
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
    const statusFilter = this.mapMcpOrderStatus(args.status);
    const result = await this.orderService.findAll(
      {
        page: 1,
        pageSize: limit,
        serviceTargetId: targetId,
        status: statusFilter,
      },
      ctx.userId,
    );
    const rows = (result as { items?: unknown[] }).items ?? [];
    const orders = (rows as Array<Record<string, unknown>>).map((o) => ({
      id: String(o.id ?? o.orderNumber ?? ''),
      serviceName:
        (o.serviceName as string) ||
        (o.hospital as string) ||
        '陪诊服务',
      scheduledAt: (o.serviceTime as string) || (o.createdAt as string) || null,
      status: this.mapOrderStatusToMcp(o.status as string),
      attendantName:
        ((o.attendant as { name?: string } | undefined)?.name as string) ||
        null,
    }));
    return { orders };
  }

  async getMedicationPlan(
    ctx: DeviceContext,
    args: { date?: string },
  ) {
    const today = await this.getTodayMedicationReminders(ctx, args);
    return {
      plans: today.reminders.map((item) => ({
        id: item.reminderId,
        drugName: item.medicineName,
        dose: item.dosage,
        time: item.time,
        status: item.status,
        remindOnly: true,
      })),
      date: today.date,
    };
  }

  async getTodayMedicationReminders(
    ctx: DeviceContext,
    args: { date?: string } = {},
  ) {
    const targetId = this.requireServiceTargetId(ctx);
    const date = this.normalizeDateArg(args.date);
    const reminders = await this.medicationReminderService.findAll({
      serviceTargetId: targetId,
      status: ReminderStatus.ACTIVE,
      type: ReminderType.MEDICATION,
      page: 1,
      pageSize: 100,
    });
    const rows = (reminders as { items?: unknown[] }).items ?? [];
    const executions = await this.executionLogRepo.find({
      where: {
        tenantId: ctx.tenantId,
        serviceTargetId: targetId,
        scheduledDate: date,
      },
    });
    const executionBySlot = new Map(
      executions.map((e) => [`${e.reminderId}|${e.scheduledTime}`, e]),
    );

    const items = (rows as Array<Record<string, unknown>>)
      .filter((r) => this.isReminderActiveOnDate(r, date))
      .flatMap((r) => {
        const times = (r.reminderTimes as string[] | undefined) ?? [];
        return times.map((time) => {
          const execution = executionBySlot.get(`${String(r.id)}|${time}`);
          return {
            reminderId: Number(r.id),
            medicineName: (r.medicineName as string) || '用药提醒',
            dosage: (r.dosage as string) || '',
            time,
            status: execution?.status ?? MedicationExecutionStatus.PENDING,
            executedAt: execution?.executedAt?.toISOString() ?? null,
            instructions: (r.instructions as string) || '',
            severity: (r.severity as string) || 'medium',
          };
        });
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    return {
      date,
      summary: this.summarizeMedicationExecutions(items),
      reminders: items,
    };
  }

  async getTodayHealthSummary(
    ctx: DeviceContext,
    args: { date?: string } = {},
  ) {
    const date = this.normalizeDateArg(args.date);
    const target = await this.loadBoundTarget(ctx);
    const [medication, weeklyReport, openAlerts] = await Promise.all([
      this.getTodayMedicationReminders(ctx, { date }),
      this.weeklyReportRepo.findOne({
        where: {
          tenantId: ctx.tenantId,
          serviceTargetId: target.id,
        },
        order: { weekEnd: 'DESC' },
      }),
      this.alertRepo.find({
        where: {
          tenantId: ctx.tenantId,
          serviceTargetId: target.id,
          status: In([AlertStatus.NEW, AlertStatus.ACKNOWLEDGED]),
        },
        order: { triggeredAt: 'DESC' },
        take: 5,
      }),
    ]);

    const highAlertCount = openAlerts.filter(
      (a) => a.severity === AlertSeverity.HIGH,
    ).length;

    return {
      date,
      elder: {
        id: target.id,
        name: target.name,
        ageYears: target.ageYears,
        city: target.city,
        chronicTags: target.chronicTags,
      },
      medication: medication.summary,
      alerts: {
        open: openAlerts.length,
        high: highAlertCount,
        latest: openAlerts.slice(0, 3).map((a) => ({
          id: a.id,
          title: a.title,
          severity: a.severity,
          status: a.status,
          triggeredAt: a.triggeredAt.toISOString(),
        })),
      },
      latestWeeklyReport: weeklyReport
        ? {
            weekStart: weeklyReport.weekStart,
            weekEnd: weeklyReport.weekEnd,
            healthSummary: weeklyReport.healthSummary,
            medicationStats: weeklyReport.medicationStats,
          }
        : null,
      tips: this.buildHealthTips({
        chronicTags: target.chronicTags,
        medicationPending: medication.summary.pending,
        highAlertCount,
      }),
    };
  }

  async createAlert(
    ctx: DeviceContext,
    args: {
      type?: string;
      severity?: string;
      title?: string;
      summary?: string;
      reason?: string;
      payload?: unknown;
    },
  ) {
    const target = await this.loadBoundTarget(ctx);
    const type = this.normalizeAlertType(args.type);
    const severity = this.normalizeMcpSeverity(args.severity);
    const reason =
      (args.summary || args.reason || args.title || '').trim() ||
      this.defaultAlertReason(type);
    const payload = this.sanitizePayload(args.payload);

    const alert =
      type === 'manual'
        ? await this.alertService.createCompanionFamilyNotify({
            userId: ctx.userId,
            serviceTargetId: target.id,
            deviceId: ctx.deviceId,
            reason,
            severity,
          })
        : await this.alertService.createDeviceAlert({
            userId: ctx.userId,
            serviceTargetId: target.id,
            type,
            deviceId: ctx.deviceId,
            targetName: target.name,
            payload: {
              source: 'mcp',
              mcpSeverity: severity,
              reason,
              ...(payload ?? {}),
            },
          });

    return {
      alertId: alert?.id ?? null,
      status: alert?.status ?? 'suppressed',
      severity: alert?.severity ?? severity,
      category: alert?.category ?? null,
      triggeredAt: alert?.triggeredAt?.toISOString() ?? null,
    };
  }

  async reportDeviceEvent(
    ctx: DeviceContext,
    args: {
      type?: string;
      level?: string;
      payload?: unknown;
      dedupKey?: string;
    },
  ) {
    const type = this.normalizeDeviceEventType(args.type);
    const level = this.normalizeDeviceEventLevel(args.level, type);
    const saved = await this.deviceService.recordEvent(ctx.deviceId, {
      type,
      level,
      payload: this.sanitizePayload(args.payload) ?? undefined,
      dedupKey:
        typeof args.dedupKey === 'string' && args.dedupKey.trim()
          ? args.dedupKey.trim().slice(0, 128)
          : undefined,
    });
    return {
      eventId: saved.id,
      deviceId: saved.deviceId,
      type: saved.type,
      level: saved.level,
      receivedAt: saved.receivedAt.toISOString(),
      forwardedToAlert: saved.forwardedToAlert,
    };
  }

  async getDeviceBindingStatus(ctx: DeviceContext) {
    const detail = await this.deviceService.findById(ctx.deviceId, ctx.userId);
    const binding =
      detail.bindings.find((b) => b.userId === ctx.userId) ??
      detail.bindings[0] ??
      null;
    return {
      device: {
        id: detail.device.id,
        tuyaDeviceId: detail.device.tuyaDeviceId,
        productId: detail.device.productId,
        name: detail.device.name,
        type: detail.device.type,
        status: detail.device.status,
        online: detail.device.online,
        batteryPercent: detail.device.batteryPercent,
        firmwareVersion: detail.device.firmwareVersion,
        lastHeartbeatAt: detail.device.lastHeartbeatAt?.toISOString() ?? null,
      },
      binding: binding
        ? {
            role: binding.role,
            serviceTargetId: binding.serviceTargetId,
            familyGroupId: binding.familyGroupId,
            boundAt: binding.boundAt.toISOString(),
          }
        : null,
    };
  }

  async recordMedicationTaken(
    ctx: DeviceContext,
    args: { planId: number; takenAt: string; note?: string },
  ) {
    const taken = new Date(args.takenAt);
    if (Number.isNaN(taken.getTime())) {
      throw new Error('takenAt 格式无效');
    }
    const scheduledDate = this.formatLocalDate(taken);
    const scheduledTime = `${String(taken.getHours()).padStart(2, '0')}:${String(taken.getMinutes()).padStart(2, '0')}`;
    const saved = await this.medicationExecutionService.checkIn(
      {
        reminderId: args.planId,
        scheduledDate,
        scheduledTime,
        status: MedicationExecutionStatus.TAKEN,
        note: args.note,
      },
      ctx.userId,
      'user',
    );
    return {
      recorded: true,
      logId: saved.id,
      reminderId: saved.reminderId,
      scheduledDate: saved.scheduledDate,
      scheduledTime: saved.scheduledTime,
    };
  }

  async notifyFamily(
    ctx: DeviceContext,
    args: {
      reason: string;
      severity: 'info' | 'warn' | 'emergency';
    },
  ) {
    const targetId = ctx.serviceTargetId;
    if (targetId == null) {
      throw new Error('设备未绑定服务对象');
    }
    const alert = await this.alertService.createCompanionFamilyNotify({
      userId: ctx.userId,
      serviceTargetId: targetId,
      deviceId: ctx.deviceId,
      reason: args.reason,
      severity: args.severity,
    });
    return {
      sentCount: alert ? 1 : 0,
      channels: ['app_push', 'realtime'],
      notifiedAt: new Date().toISOString(),
      alertId: alert?.id ?? null,
    };
  }

  private requireServiceTargetId(ctx: DeviceContext): number {
    if (ctx.serviceTargetId == null) {
      throw new Error('设备未绑定服务对象');
    }
    return ctx.serviceTargetId;
  }

  private async loadBoundTarget(ctx: DeviceContext): Promise<{
    id: number;
    name: string;
    ageYears: number | null;
    city: unknown;
    chronicTags: string[];
    preferredCalls: string[];
  }> {
    const targetId = this.requireServiceTargetId(ctx);
    const target = await this.userService.findServiceTargetById(
      targetId,
      ctx.userId,
    );
    const hp = this.parseJsonRecord(target.healthProfile);
    return {
      id: target.id,
      name: target.name,
      ageYears: target.age ?? (typeof hp.age === 'number' ? hp.age : null),
      city: hp.city ?? hp.homeCity ?? null,
      chronicTags: this.extractChronicTags(hp),
      preferredCalls: this.extractPreferredCalls(hp),
    };
  }

  private normalizeDateArg(date?: string): string {
    if (!date) return this.formatLocalDate(new Date());
    const trimmed = date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('date 格式无效，请使用 YYYY-MM-DD');
    }
    return trimmed;
  }

  private summarizeMedicationExecutions(
    items: Array<{ status: MedicationExecutionStatus }>,
  ) {
    const count = (status: MedicationExecutionStatus) =>
      items.filter((i) => i.status === status).length;
    return {
      total: items.length,
      taken: count(MedicationExecutionStatus.TAKEN),
      missed: count(MedicationExecutionStatus.MISSED),
      skipped: count(MedicationExecutionStatus.SKIPPED),
      pending: count(MedicationExecutionStatus.PENDING),
    };
  }

  private buildHealthTips(input: {
    chronicTags: string[];
    medicationPending: number;
    highAlertCount: number;
  }): string[] {
    const tips: string[] = [];
    if (input.medicationPending > 0) {
      tips.push(`今天还有 ${input.medicationPending} 次用药提醒待确认`);
    }
    if (input.highAlertCount > 0) {
      tips.push('当前有高优先级告警，请优先联系家属或值班人员确认');
    }
    if (
      input.chronicTags.some((tag) =>
        /高血压|血压|冠心病|心脏/.test(tag),
      )
    ) {
      tips.push('血压相关慢病用户请注意低盐饮食和按时测量');
    }
    if (
      input.chronicTags.some((tag) =>
        /糖尿病|血糖/.test(tag),
      )
    ) {
      tips.push('血糖相关慢病用户请关注餐前餐后记录和规律饮食');
    }
    return tips;
  }

  private normalizeAlertType(type?: string): ToolAlertType {
    const value = String(type || 'manual').trim();
    if (
      value === 'fall' ||
      value === 'sos' ||
      value === 'vital_anomaly' ||
      value === 'manual'
    ) {
      return value;
    }
    throw new Error('alert type 不支持');
  }

  private normalizeMcpSeverity(severity?: string): McpAlertSeverity {
    const value = String(severity || 'warn').trim();
    if (value === 'info' || value === 'warn' || value === 'emergency') {
      return value;
    }
    if (value === 'warning') return 'warn';
    if (value === 'critical') return 'emergency';
    throw new Error('alert severity 不支持');
  }

  private defaultAlertReason(type: ToolAlertType): string {
    const map: Record<ToolAlertType, string> = {
      fall: '设备检测到疑似跌倒',
      sos: '设备收到 SOS 求助',
      vital_anomaly: '设备上报体征异常',
      manual: '机器人请求家属关注',
    };
    return map[type];
  }

  private normalizeDeviceEventType(type?: string): DeviceEventType {
    const value = String(type || DeviceEventType.OTHER).trim();
    if (Object.values(DeviceEventType).includes(value as DeviceEventType)) {
      return value as DeviceEventType;
    }
    if (value === 'fall_detected') return DeviceEventType.FALL;
    if (value === 'sos_pressed') return DeviceEventType.SOS;
    throw new Error('device event type 不支持');
  }

  private normalizeDeviceEventLevel(
    level: string | undefined,
    type: DeviceEventType,
  ): DeviceEventLevel {
    const value = String(level || '').trim();
    if (Object.values(DeviceEventLevel).includes(value as DeviceEventLevel)) {
      return value as DeviceEventLevel;
    }
    if (
      type === DeviceEventType.FALL ||
      type === DeviceEventType.SOS ||
      type === DeviceEventType.VITAL_ANOMALY
    ) {
      return DeviceEventLevel.CRITICAL;
    }
    return DeviceEventLevel.INFO;
  }

  private sanitizePayload(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { value };
    }
    return this.sanitizeObject(value as Record<string, unknown>, 0);
  }

  private sanitizeObject(
    input: Record<string, unknown>,
    depth: number,
  ): Record<string, unknown> {
    if (depth > 3) return { truncated: true };
    const out: Record<string, unknown> = {};
    const sensitiveKey =
      /(token|secret|authorization|password|phone|mobile|idcard|id_card|address|medical_record)/i;
    for (const [key, raw] of Object.entries(input).slice(0, 60)) {
      if (sensitiveKey.test(key)) {
        out[key] = '[redacted]';
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        out[key] = this.sanitizeObject(raw as Record<string, unknown>, depth + 1);
      } else if (typeof raw === 'string') {
        out[key] = raw.length > 512 ? `${raw.slice(0, 512)}...` : raw;
      } else {
        out[key] = raw;
      }
    }
    return out;
  }

  private parseJsonRecord(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return value as Record<string, unknown>;
  }

  private extractChronicTags(hp: Record<string, unknown>): string[] {
    const candidates = [
      hp.chronicDiseases,
      hp.chronicTags,
      hp.diseases,
      hp.chronic,
    ];
    for (const item of candidates) {
      if (Array.isArray(item)) {
        return item.map((v) => String(v)).filter(Boolean);
      }
      if (typeof item === 'string' && item.trim()) {
        return item
          .split(/[,，、]/)
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  private extractPreferredCalls(hp: Record<string, unknown>): string[] {
    const fromHp = hp.preferredCalls ?? hp.familyCalls;
    if (Array.isArray(fromHp)) {
      return fromHp.map((v) => String(v)).filter(Boolean);
    }
    const relationship = hp.relationship;
    if (typeof relationship === 'string' && relationship.trim()) {
      return [`您${relationship}`];
    }
    return [];
  }

  private mapMcpOrderStatus(status?: string): string | undefined {
    if (!status) return undefined;
    switch (status) {
      case 'pending':
        return [
          OrderStatus.PENDING_DISPATCH,
          OrderStatus.PENDING_ACCEPT,
          OrderStatus.PENDING_GRAB,
          OrderStatus.PENDING_SIGN,
        ].join(',');
      case 'confirmed':
        return OrderStatus.PENDING_SERVICE;
      case 'in_service':
        return OrderStatus.IN_PROGRESS;
      case 'completed':
        return OrderStatus.COMPLETED;
      case 'cancelled':
        return OrderStatus.CANCELED;
      default:
        return status;
    }
  }

  private mapOrderStatusToMcp(status?: string): string {
    if (!status) return 'pending';
    if (status === OrderStatus.COMPLETED) return 'completed';
    if (status === OrderStatus.CANCELED) return 'cancelled';
    if (status === OrderStatus.IN_PROGRESS) return 'in_service';
    if (
      status === OrderStatus.PENDING_SERVICE ||
      status === OrderStatus.PENDING_SIGN
    ) {
      return 'confirmed';
    }
    return 'pending';
  }

  private isReminderActiveOnDate(
    reminder: Record<string, unknown>,
    date: string,
  ): boolean {
    const start = String(reminder.startDate ?? '');
    const end = String(reminder.endDate ?? '');
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }

  private formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
