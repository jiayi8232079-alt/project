import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  type ObjectLiteral,
  type SelectQueryBuilder,
} from 'typeorm';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { Device } from '../../entities/device.entity.js';
import { Order } from '../../entities/order.entity.js';
import { DeviceEventLog } from '../../entities/device-event-log.entity.js';
import { HealthAlert } from '../../entities/health-alert.entity.js';
import { AiDialogSession } from '../../entities/ai-dialog-session.entity.js';
import { Review } from '../../entities/review.entity.js';
import { Subscription } from '../../entities/subscription.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { Complaint } from '../../entities/complaint.entity.js';
import { TriageSession } from '../../entities/triage-session.entity.js';
import {
  MedicationExecutionLog,
  MedicationExecutionStatus,
} from '../../entities/medication-execution-log.entity.js';
import { OrderStatus, PaymentStatus } from '../../common/enums/index.js';
import {
  DailyStatRow,
  HourlyStatRow,
  RealtimeStatRow,
  StatService,
  ymd,
} from './stat.service.js';
import { STAT_METRICS } from './stat-metrics.js';

interface GroupedRow {
  tenantId: number;
  value: number;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfHour(d: Date): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    0,
    0,
    0,
  );
}

/**
 * 统计聚合器 —— 从各业务表按 tenant_id 分组聚合，写入 stat_daily/hourly/realtime。
 *
 * 设计：
 * - 每个指标一条 `GROUP BY tenant_id` 查询（命中 tenant_id 索引），N 个指标 = N 条 SQL，
 *   而不是「每个 site 一次循环」，避免站点多时 SQL 爆炸（PRD §4.5 性能要求）。
 * - 所有 upsert 幂等，cron 重跑/手动重跑不会产生重复行。
 * - cron 可由 `STAT_AGGREGATION_DISABLED=true` 关闭（多实例部署时只留一个实例跑）。
 */
@Injectable()
export class StatAggregatorService {
  private readonly logger = new Logger(StatAggregatorService.name);

  constructor(
    private readonly statService: StatService,
    private readonly configService: ConfigService,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(DeviceEventLog)
    private readonly eventRepo: Repository<DeviceEventLog>,
    @InjectRepository(HealthAlert)
    private readonly alertRepo: Repository<HealthAlert>,
    @InjectRepository(AiDialogSession)
    private readonly dialogRepo: Repository<AiDialogSession>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Attendant)
    private readonly attendantRepo: Repository<Attendant>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(TriageSession)
    private readonly triageRepo: Repository<TriageSession>,
    @InjectRepository(MedicationExecutionLog)
    private readonly medExecRepo: Repository<MedicationExecutionLog>,
  ) {}

  private get disabled(): boolean {
    return (
      this.configService
        .get<string>('STAT_AGGREGATION_DISABLED', '')
        ?.trim()
        .toLowerCase() === 'true'
    );
  }

  // ─────────────── Cron 入口 ───────────────

  /** 每小时：刷新当天日聚合 + 写在线率小时快照 */
  @Cron(CronExpression.EVERY_HOUR, { name: 'stat-hourly' })
  async cronHourly(): Promise<void> {
    if (this.disabled) return;
    try {
      await this.runDaily(new Date());
      await this.runHourly(new Date());
    } catch (err) {
      this.logger.error(`cronHourly failed: ${msg(err)}`);
    }
  }

  /** 每日 02:00：固化昨天的日聚合（全天数据已落库） */
  @Cron('0 2 * * *', { name: 'stat-daily', timeZone: 'Asia/Shanghai' })
  async cronDaily(): Promise<void> {
    if (this.disabled) return;
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await this.runDaily(yesterday);
    } catch (err) {
      this.logger.error(`cronDaily failed: ${msg(err)}`);
    }
  }

  /** 每 5 分钟：刷新实时快照 */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'stat-realtime' })
  async cronRealtime(): Promise<void> {
    if (this.disabled) return;
    try {
      await this.runRealtime();
    } catch (err) {
      this.logger.error(`cronRealtime failed: ${msg(err)}`);
    }
  }

  // ─────────────── 可手动触发（admin / 测试） ───────────────

  /** 聚合指定日期的全部日指标 */
  async runDaily(date: Date): Promise<{ date: string; rows: number }> {
    const statDate = ymd(date);
    const from = startOfDay(date);
    const to = endOfDay(date);
    const rows: DailyStatRow[] = [];

    const push = (metric: string, grouped: GroupedRow[]) => {
      for (const g of grouped) {
        rows.push({ tenantId: g.tenantId, statDate, metric, value: g.value });
      }
    };

    // 快照型（当前总量，按当天打点）
    push(
      STAT_METRICS.RESIDENTS_COUNT,
      await this.countByTenant(this.targetRepo, 'st'),
    );
    push(
      STAT_METRICS.DEVICES_COUNT,
      await this.countByTenant(this.deviceRepo, 'd'),
    );
    push(STAT_METRICS.DEVICES_ONLINE, await this.sumOnlineDevices());
    push(
      STAT_METRICS.SUBSCRIPTION_ACTIVE,
      await this.activeSubscriptionCount(),
    );
    push(
      STAT_METRICS.SUBSCRIPTION_REVENUE,
      await this.activeSubscriptionRevenue(),
    );

    // 事件型（当天区间内）
    push(STAT_METRICS.ORDERS_COUNT, await this.ordersCount(from, to));
    push(STAT_METRICS.ORDERS_REVENUE, await this.ordersRevenue(from, to));
    push(
      STAT_METRICS.FALL_EVENTS,
      await this.deviceEventCount('fall', from, to),
    );
    push(STAT_METRICS.SOS_EVENTS, await this.deviceEventCount('sos', from, to));
    push(STAT_METRICS.ALERTS_COUNT, await this.alertsCount(from, to));
    push(STAT_METRICS.ALERTS_HANDLED, await this.alertsHandled(from, to));
    push(
      STAT_METRICS.DIALOG_SESSIONS,
      await this.dialogSessions(from, to, false),
    );
    push(STAT_METRICS.DIALOG_CRISIS, await this.dialogSessions(from, to, true));
    push(STAT_METRICS.SERVICE_SATISFACTION, await this.satisfaction(from, to));
    push(STAT_METRICS.COMPLAINTS_COUNT, await this.complaintsCount(from, to, false));
    push(STAT_METRICS.COMPLAINTS_RESOLVED, await this.complaintsCount(from, to, true));
    push(STAT_METRICS.TRIAGE_SESSIONS, await this.triageSessions(from, to));
    push(STAT_METRICS.DEVICES_LOW_BATTERY, await this.lowBatteryDevices());
    push(STAT_METRICS.ORDERS_COMPLETED, await this.ordersCompleted(from, to));
    push(STAT_METRICS.ATTENDANT_ORDERS, await this.attendantOrders(from, to));
    push(
      STAT_METRICS.MEDICATION_ADHERENCE_RATE,
      await this.medicationAdherence(from, to),
    );

    await this.statService.upsertDaily(rows);
    this.logger.log(`runDaily(${statDate}): upserted ${rows.length} stat rows`);
    return { date: statDate, rows: rows.length };
  }

  /** 写在线设备/在线率小时快照 */
  async runHourly(at: Date): Promise<{ hour: string; rows: number }> {
    const statHour = startOfHour(at);
    const rows: HourlyStatRow[] = [];

    const online = await this.sumOnlineDevices();
    const counts = await this.countByTenant(this.deviceRepo, 'd');
    const countMap = new Map(counts.map((c) => [c.tenantId, c.value]));

    for (const o of online) {
      rows.push({
        tenantId: o.tenantId,
        statHour,
        metric: STAT_METRICS.DEVICES_ONLINE,
        value: o.value,
      });
      const total = countMap.get(o.tenantId) ?? 0;
      rows.push({
        tenantId: o.tenantId,
        statHour,
        metric: STAT_METRICS.DEVICES_ONLINE_RATE,
        value: total ? Math.round((o.value / total) * 10000) / 100 : 0,
      });
    }

    await this.statService.upsertHourly(rows);
    this.logger.log(
      `runHourly(${ymd(statHour)} ${statHour.getHours()}:00): ${rows.length} rows`,
    );
    return { hour: statHour.toISOString(), rows: rows.length };
  }

  /** 刷新实时快照：在线设备 / 待处理告警 / 在岗护工 */
  async runRealtime(): Promise<{ rows: number }> {
    const rows: RealtimeStatRow[] = [];

    const online = await this.sumOnlineDevices();
    for (const o of online) {
      rows.push({
        tenantId: o.tenantId,
        metric: STAT_METRICS.DEVICES_ONLINE,
        value: o.value,
      });
    }
    const pending = await this.pendingAlerts();
    for (const p of pending) {
      rows.push({
        tenantId: p.tenantId,
        metric: STAT_METRICS.PENDING_ALERTS,
        value: p.value,
      });
    }
    const attendants = await this.activeAttendants();
    for (const a of attendants) {
      rows.push({
        tenantId: a.tenantId,
        metric: STAT_METRICS.ATTENDANTS_ACTIVE,
        value: a.value,
      });
    }

    await this.statService.upsertRealtime(rows);
    return { rows: rows.length };
  }

  // ─────────────── 各指标的 GROUP BY tenant_id 查询 ───────────────

  private async countByTenant(
    repo: Repository<{ tenantId: number }>,
    alias: string,
  ): Promise<GroupedRow[]> {
    const raw = await repo
      .createQueryBuilder(alias)
      .select(`${alias}.tenant_id`, 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .groupBy(`${alias}.tenant_id`)
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async sumOnlineDevices(): Promise<GroupedRow[]> {
    const raw = await this.deviceRepo
      .createQueryBuilder('d')
      .select('d.tenant_id', 'tenantId')
      .addSelect(
        'COALESCE(SUM(CASE WHEN d.online = 1 THEN 1 ELSE 0 END), 0)',
        'value',
      )
      .groupBy('d.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async ordersCount(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('o.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async ordersRevenue(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.tenant_id', 'tenantId')
      .addSelect('COALESCE(SUM(o.total_fee), 0)', 'value')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere('o.payment_status = :ps', { ps: PaymentStatus.PAID })
      .groupBy('o.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async deviceEventCount(
    type: 'fall' | 'sos',
    from: Date,
    to: Date,
  ): Promise<GroupedRow[]> {
    const raw = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('e.type = :type', { type })
      .andWhere('e.received_at BETWEEN :from AND :to', { from, to })
      .groupBy('e.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async alertsCount(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.alertRepo
      .createQueryBuilder('a')
      .select('a.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('a.triggered_at BETWEEN :from AND :to', { from, to })
      .groupBy('a.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async alertsHandled(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.alertRepo
      .createQueryBuilder('a')
      .select('a.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('a.triggered_at BETWEEN :from AND :to', { from, to })
      .andWhere('a.status IN (:...handled)', {
        handled: ['acknowledged', 'closed'],
      })
      .groupBy('a.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async dialogSessions(
    from: Date,
    to: Date,
    crisisOnly: boolean,
  ): Promise<GroupedRow[]> {
    const qb = this.dialogRepo
      .createQueryBuilder('s')
      .select('s.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('s.started_at BETWEEN :from AND :to', { from, to });
    if (crisisOnly) qb.andWhere('s.crisis_score > 0');
    const raw = await qb
      .groupBy('s.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async satisfaction(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.reviewRepo
      .createQueryBuilder('r')
      .select('r.tenant_id', 'tenantId')
      .addSelect('COALESCE(AVG(r.rating), 0)', 'value')
      .where('r.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('r.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async complaintsCount(
    from: Date,
    to: Date,
    resolvedOnly: boolean,
  ): Promise<GroupedRow[]> {
    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .select('c.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('c.created_at BETWEEN :from AND :to', { from, to });
    if (resolvedOnly) {
      qb.andWhere('c.status IN (:...done)', { done: ['resolved', 'closed'] });
    }
    const raw = await qb
      .groupBy('c.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async triageSessions(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.triageRepo
      .createQueryBuilder('t')
      .select('t.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('t.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('t.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async lowBatteryDevices(): Promise<GroupedRow[]> {
    const raw = await this.deviceRepo
      .createQueryBuilder('d')
      .select('d.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('d.battery_percent IS NOT NULL')
      .andWhere('d.battery_percent < 20')
      .groupBy('d.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async ordersCompleted(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere('o.status = :st', { st: OrderStatus.COMPLETED })
      .groupBy('o.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async attendantOrders(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere('o.attendant_id IS NOT NULL')
      .groupBy('o.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  /** 用药依从率 = taken / (taken + missed) * 100（按 tenant 计算后落 rate）。 */
  private async medicationAdherence(from: Date, to: Date): Promise<GroupedRow[]> {
    const raw = await this.medExecRepo
      .createQueryBuilder('m')
      .select('m.tenant_id', 'tenantId')
      .addSelect(
        `SUM(CASE WHEN m.status = :taken THEN 1 ELSE 0 END)`,
        'taken',
      )
      .addSelect(
        `SUM(CASE WHEN m.status IN (:...due) THEN 1 ELSE 0 END)`,
        'due',
      )
      .where('m.scheduled_date BETWEEN :from AND :to', { from, to })
      .setParameters({
        taken: MedicationExecutionStatus.TAKEN,
        due: [
          MedicationExecutionStatus.TAKEN,
          MedicationExecutionStatus.MISSED,
        ],
      })
      .groupBy('m.tenant_id')
      .getRawMany<{ tenantId: string; taken: string; due: string }>();

    return raw
      .map((r) => {
        const taken = Number(r.taken ?? 0);
        const due = Number(r.due ?? 0);
        const rate = due > 0 ? Math.round((taken / due) * 10000) / 100 : 0;
        return { tenantId: Number(r.tenantId), value: rate };
      })
      .filter((r) => Number.isFinite(r.tenantId) && r.tenantId > 0);
  }

  private async activeSubscriptionCount(): Promise<GroupedRow[]> {
    const raw = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('s.status IN (:...statuses)', {
        statuses: ['active', 'trialing', 'grace'],
      })
      .groupBy('s.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async activeSubscriptionRevenue(): Promise<GroupedRow[]> {
    const raw = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.tenant_id', 'tenantId')
      .addSelect('COALESCE(SUM(s.unit_price_snapshot), 0)', 'value')
      .where('s.status IN (:...statuses)', {
        statuses: ['active', 'trialing', 'grace'],
      })
      .groupBy('s.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async pendingAlerts(): Promise<GroupedRow[]> {
    const raw = await this.alertRepo
      .createQueryBuilder('a')
      .select('a.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('a.status = :s', { s: 'new' })
      .groupBy('a.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  private async activeAttendants(): Promise<GroupedRow[]> {
    const raw = await this.attendantRepo
      .createQueryBuilder('a')
      .select('a.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'value')
      .where('a.status = :s', { s: 'active' })
      .groupBy('a.tenant_id')
      .getRawMany<{ tenantId: string; value: string }>();
    return toGrouped(raw);
  }

  // ─────────────── 维度构成（饼图，按 scope 实时计算） ───────────────

  /** allowed=null（平台超管）→ 不限租户；[]→ 空结果；否则 tenant_id IN (...) */
  private applyAllowed<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    allowed: number[] | null,
  ): void {
    if (allowed == null) return;
    if (allowed.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere(`${alias}.tenant_id IN (:...__bdTids)`, { __bdTids: allowed });
  }

  /** 订单按服务类型构成 */
  async breakdownOrdersByServiceType(
    allowed: number[] | null,
    from: Date,
    to: Date,
  ): Promise<{ name: string; value: number }[]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select("COALESCE(NULLIF(o.service_type, ''), '其他')", 'name')
      .addSelect('COUNT(*)', 'value')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('name')
      .orderBy('value', 'DESC');
    this.applyAllowed(qb, 'o', allowed);
    const raw = await qb.getRawMany<{ name: string; value: string }>();
    return raw.map((r) => ({ name: r.name || '其他', value: Number(r.value || 0) }));
  }

  /** 告警按严重度构成 */
  async breakdownAlertsBySeverity(
    allowed: number[] | null,
    from: Date,
    to: Date,
  ): Promise<{ name: string; value: number }[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .select('a.severity', 'name')
      .addSelect('COUNT(*)', 'value')
      .where('a.triggered_at BETWEEN :from AND :to', { from, to })
      .groupBy('a.severity')
      .orderBy('value', 'DESC');
    this.applyAllowed(qb, 'a', allowed);
    const raw = await qb.getRawMany<{ name: string; value: string }>();
    const label: Record<string, string> = { high: '紧急', medium: '重要', low: '提醒' };
    return raw.map((r) => ({
      name: label[r.name] ?? r.name ?? '未知',
      value: Number(r.value || 0),
    }));
  }

  /** 居民按年龄段构成 */
  async breakdownResidentsByAge(
    allowed: number[] | null,
  ): Promise<{ name: string; value: number }[]> {
    const ageCase = `CASE
      WHEN st.age IS NULL THEN '未知'
      WHEN st.age < 60 THEN '60 以下'
      WHEN st.age < 70 THEN '60-69'
      WHEN st.age < 80 THEN '70-79'
      WHEN st.age < 90 THEN '80-89'
      ELSE '90+' END`;
    const qb = this.targetRepo
      .createQueryBuilder('st')
      .select(ageCase, 'name')
      .addSelect('COUNT(*)', 'value')
      .groupBy('name')
      .orderBy('value', 'DESC');
    this.applyAllowed(qb, 'st', allowed);
    const raw = await qb.getRawMany<{ name: string; value: string }>();
    return raw.map((r) => ({ name: r.name || '未知', value: Number(r.value || 0) }));
  }
}

function toGrouped(
  raw: { tenantId: string | number; value: string | number }[],
): GroupedRow[] {
  return raw
    .map((r) => ({
      tenantId: Number(r.tenantId),
      value: Number(r.value ?? 0),
    }))
    .filter((r) => Number.isFinite(r.tenantId) && r.tenantId > 0);
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
