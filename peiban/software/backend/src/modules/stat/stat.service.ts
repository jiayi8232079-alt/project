import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Repository,
  type ObjectLiteral,
  type SelectQueryBuilder,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm';
import { StatDaily } from '../../entities/stat-daily.entity.js';
import { StatHourly } from '../../entities/stat-hourly.entity.js';
import { StatRealtime } from '../../entities/stat-realtime.entity.js';
import { Tenant } from '../../entities/tenant.entity.js';
import {
  getMetricDef,
  OVERVIEW_METRICS,
  STAT_METRICS,
  type StatMetricDef,
} from './stat-metrics.js';

export interface DailyStatRow {
  tenantId: number;
  statDate: string;
  metric: string;
  value: number;
  dimensions?: Record<string, unknown> | null;
}

export interface HourlyStatRow {
  tenantId: number;
  statHour: Date;
  metric: string;
  value: number;
  dimensions?: Record<string, unknown> | null;
}

export interface RealtimeStatRow {
  tenantId: number;
  metric: string;
  value: number;
  dimensions?: Record<string, unknown> | null;
}

export interface MetricQueryResult {
  metric: string;
  label: string;
  unit: string | null;
  aggregation: string;
  total: number;
  trend: { date: string; value: number }[];
  byTenant: { tenantId: number; tenantName: string; value: number }[];
}

/** 大盘日期范围归一化 */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class StatService {
  private readonly logger = new Logger(StatService.name);

  constructor(
    @InjectRepository(StatDaily)
    private readonly dailyRepo: Repository<StatDaily>,
    @InjectRepository(StatHourly)
    private readonly hourlyRepo: Repository<StatHourly>,
    @InjectRepository(StatRealtime)
    private readonly realtimeRepo: Repository<StatRealtime>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  // ─────────────── 写入（聚合 cron 调用，幂等 upsert） ───────────────

  async upsertDaily(rows: DailyStatRow[]): Promise<void> {
    if (!rows.length) return;
    // 分批 upsert，避免单条 SQL 过长
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((r) => ({
        tenantId: r.tenantId,
        statDate: r.statDate,
        metric: r.metric,
        value: r.value,
        dimensions: (r.dimensions ?? null) as Record<string, any> | null,
      }));
      // cast：TypeORM 对 JSON 列（Record<string,unknown>）的 DeepPartial 推导不完善，此处定向断言
      await this.dailyRepo.upsert(
        chunk as unknown as QueryDeepPartialEntity<StatDaily>[],
        {
          conflictPaths: ['tenantId', 'statDate', 'metric'],
          skipUpdateIfNoValuesChanged: false,
        },
      );
    }
  }

  async upsertHourly(rows: HourlyStatRow[]): Promise<void> {
    if (!rows.length) return;
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((r) => ({
        tenantId: r.tenantId,
        statHour: r.statHour,
        metric: r.metric,
        value: r.value,
        dimensions: (r.dimensions ?? null) as Record<string, any> | null,
      }));
      await this.hourlyRepo.upsert(
        chunk as unknown as QueryDeepPartialEntity<StatHourly>[],
        {
          conflictPaths: ['tenantId', 'statHour', 'metric'],
          skipUpdateIfNoValuesChanged: false,
        },
      );
    }
  }

  async upsertRealtime(rows: RealtimeStatRow[]): Promise<void> {
    if (!rows.length) return;
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((r) => ({
        tenantId: r.tenantId,
        metric: r.metric,
        value: r.value,
        dimensions: (r.dimensions ?? null) as Record<string, any> | null,
      }));
      await this.realtimeRepo.upsert(
        chunk as unknown as QueryDeepPartialEntity<StatRealtime>[],
        {
          conflictPaths: ['tenantId', 'metric'],
          skipUpdateIfNoValuesChanged: false,
        },
      );
    }
  }

  // ─────────────── 查询（大盘 API 调用） ───────────────

  /**
   * 单指标按 scope 聚合：总量 + 日趋势 + 各租户贡献。
   * @param allowedTenantIds null = 平台超管（不限租户，全量汇总）；[] = 无可见租户（空结果）。
   */
  async queryMetric(params: {
    metric: string;
    allowedTenantIds: number[] | null;
    from: Date;
    to: Date;
  }): Promise<MetricQueryResult> {
    const def = getMetricDef(params.metric);
    const aggFn =
      def?.aggregation === 'avg' || def?.aggregation === 'rate' ? 'AVG' : 'SUM';

    const fromStr = ymd(params.from);
    const toStr = ymd(params.to);

    const base = () => {
      const qb = this.dailyRepo
        .createQueryBuilder('s')
        .where('s.metric = :metric', { metric: params.metric })
        .andWhere('s.stat_date BETWEEN :from AND :to', {
          from: fromStr,
          to: toStr,
        });
      this.applyTenantIn(qb, 's', params.allowedTenantIds);
      return qb;
    };

    if (params.allowedTenantIds && params.allowedTenantIds.length === 0) {
      return this.emptyMetricResult(params.metric, def);
    }

    const [totalRow, trendRows, tenantRows] = await Promise.all([
      base()
        .select(`COALESCE(${aggFn}(s.value), 0)`, 'total')
        .getRawOne<{ total: string }>(),
      base()
        .select('s.stat_date', 'date')
        .addSelect(`COALESCE(${aggFn}(s.value), 0)`, 'value')
        .groupBy('s.stat_date')
        .orderBy('s.stat_date', 'ASC')
        .getRawMany<{ date: string; value: string }>(),
      base()
        .select('s.tenant_id', 'tenantId')
        .addSelect(`COALESCE(${aggFn}(s.value), 0)`, 'value')
        .groupBy('s.tenant_id')
        .orderBy('value', 'DESC')
        .limit(50)
        .getRawMany<{ tenantId: string; value: string }>(),
    ]);

    const tenantNameMap = await this.loadTenantNames(
      tenantRows.map((r) => Number(r.tenantId)),
    );

    return {
      metric: params.metric,
      label: def?.label ?? params.metric,
      unit: def?.unit ?? null,
      aggregation: def?.aggregation ?? 'sum',
      total: round2(Number(totalRow?.total ?? 0)),
      trend: trendRows.map((r) => ({
        date: normalizeDate(r.date),
        value: round2(Number(r.value ?? 0)),
      })),
      byTenant: tenantRows.map((r) => {
        const tid = Number(r.tenantId);
        return {
          tenantId: tid,
          tenantName: tenantNameMap.get(tid) ?? `租户#${tid}`,
          value: round2(Number(r.value ?? 0)),
        };
      }),
    };
  }

  /**
   * 大盘总览：一次性返回核心指标的区间汇总值（用于顶部 KPI 卡片）。
   */
  async overview(params: {
    allowedTenantIds: number[] | null;
    from: Date;
    to: Date;
    metrics?: string[];
  }): Promise<{
    range: { from: string; to: string };
    tenantCount: number;
    kpis: {
      metric: string;
      label: string;
      unit: string | null;
      value: number;
    }[];
  }> {
    const metrics = params.metrics?.length ? params.metrics : OVERVIEW_METRICS;
    const fromStr = ymd(params.from);
    const toStr = ymd(params.to);

    if (params.allowedTenantIds && params.allowedTenantIds.length === 0) {
      return {
        range: { from: fromStr, to: toStr },
        tenantCount: 0,
        kpis: metrics.map((m) => {
          const def = getMetricDef(m);
          return {
            metric: m,
            label: def?.label ?? m,
            unit: def?.unit ?? null,
            value: 0,
          };
        }),
      };
    }

    // 按指标聚合方式分别取 SUM / AVG
    const rows = await this.sumMetrics(
      metrics,
      params.allowedTenantIds,
      fromStr,
      toStr,
    );

    // 在线率特殊处理：用 online / count 重算（区间末值近似：取区间内 SUM(online)/SUM(count)）
    const onlineRate = await this.computeOnlineRate(
      params.allowedTenantIds,
      fromStr,
      toStr,
    );

    const kpis = metrics.map((m) => {
      const def = getMetricDef(m);
      let value = rows.get(m) ?? 0;
      if (m === STAT_METRICS.DEVICES_ONLINE_RATE && onlineRate != null) {
        value = onlineRate;
      }
      return {
        metric: m,
        label: def?.label ?? m,
        unit: def?.unit ?? null,
        value: round2(value),
      };
    });

    return {
      range: { from: fromStr, to: toStr },
      tenantCount:
        params.allowedTenantIds == null
          ? await this.tenantRepo.count()
          : params.allowedTenantIds.length,
      kpis,
    };
  }

  /**
   * 下属租户排行（按某指标在区间内的累计值）。
   */
  async rank(params: {
    metric: string;
    allowedTenantIds: number[] | null;
    from: Date;
    to: Date;
    limit?: number;
  }): Promise<{
    metric: string;
    label: string;
    items: {
      tenantId: number;
      tenantName: string;
      scopeType: string;
      value: number;
    }[];
  }> {
    const def = getMetricDef(params.metric);
    const aggFn =
      def?.aggregation === 'avg' || def?.aggregation === 'rate' ? 'AVG' : 'SUM';

    if (params.allowedTenantIds && params.allowedTenantIds.length === 0) {
      return {
        metric: params.metric,
        label: def?.label ?? params.metric,
        items: [],
      };
    }

    const qb = this.dailyRepo
      .createQueryBuilder('s')
      .select('s.tenant_id', 'tenantId')
      .addSelect(`COALESCE(${aggFn}(s.value), 0)`, 'value')
      .where('s.metric = :metric', { metric: params.metric })
      .andWhere('s.stat_date BETWEEN :from AND :to', {
        from: ymd(params.from),
        to: ymd(params.to),
      })
      .groupBy('s.tenant_id')
      .orderBy('value', 'DESC')
      .limit(params.limit ?? 20);
    this.applyTenantIn(qb, 's', params.allowedTenantIds);

    const rows = await qb.getRawMany<{ tenantId: string; value: string }>();
    const ids = rows.map((r) => Number(r.tenantId));
    const tenants = ids.length
      ? await this.tenantRepo.find({ where: { id: In(ids) } })
      : [];
    const map = new Map(tenants.map((t) => [t.id, t]));

    return {
      metric: params.metric,
      label: def?.label ?? params.metric,
      items: rows.map((r) => {
        const tid = Number(r.tenantId);
        const t = map.get(tid);
        return {
          tenantId: tid,
          tenantName: t?.name ?? `租户#${tid}`,
          scopeType: t?.scopeType ?? 'unknown',
          value: round2(Number(r.value ?? 0)),
        };
      }),
    };
  }

  /**
   * 地图分布：按租户 region_code（行政区划）聚合某指标。
   */
  async regionMap(params: {
    metric: string;
    allowedTenantIds: number[] | null;
    from: Date;
    to: Date;
  }): Promise<{
    metric: string;
    label: string;
    regions: { regionCode: string; value: number }[];
  }> {
    const def = getMetricDef(params.metric);
    const aggFn =
      def?.aggregation === 'avg' || def?.aggregation === 'rate' ? 'AVG' : 'SUM';

    if (params.allowedTenantIds && params.allowedTenantIds.length === 0) {
      return {
        metric: params.metric,
        label: def?.label ?? params.metric,
        regions: [],
      };
    }

    const qb = this.dailyRepo
      .createQueryBuilder('s')
      .innerJoin(Tenant, 't', 't.id = s.tenant_id')
      .select('t.region_code', 'regionCode')
      .addSelect(`COALESCE(${aggFn}(s.value), 0)`, 'value')
      .where('s.metric = :metric', { metric: params.metric })
      .andWhere('s.stat_date BETWEEN :from AND :to', {
        from: ymd(params.from),
        to: ymd(params.to),
      })
      .andWhere('t.region_code IS NOT NULL')
      .groupBy('t.region_code')
      .orderBy('value', 'DESC');
    this.applyTenantIn(qb, 's', params.allowedTenantIds);

    const rows = await qb.getRawMany<{
      regionCode: string | null;
      value: string;
    }>();
    return {
      metric: params.metric,
      label: def?.label ?? params.metric,
      regions: rows
        .filter((r) => r.regionCode)
        .map((r) => ({
          regionCode: r.regionCode as string,
          value: round2(Number(r.value ?? 0)),
        })),
    };
  }

  /**
   * 实时快照：返回 scope 下所有实时指标的当前聚合值。
   */
  async realtimeSnapshot(params: {
    allowedTenantIds: number[] | null;
    metrics?: string[];
  }): Promise<{
    updatedAt: string;
    metrics: {
      metric: string;
      label: string;
      unit: string | null;
      value: number;
    }[];
  }> {
    const metrics = params.metrics?.length
      ? params.metrics
      : [
          STAT_METRICS.DEVICES_ONLINE,
          STAT_METRICS.PENDING_ALERTS,
          STAT_METRICS.ATTENDANTS_ACTIVE,
        ];

    if (params.allowedTenantIds && params.allowedTenantIds.length === 0) {
      return {
        updatedAt: new Date().toISOString(),
        metrics: metrics.map((m) => {
          const def = getMetricDef(m);
          return {
            metric: m,
            label: def?.label ?? m,
            unit: def?.unit ?? null,
            value: 0,
          };
        }),
      };
    }

    const qb = this.realtimeRepo
      .createQueryBuilder('s')
      .select('s.metric', 'metric')
      .addSelect('COALESCE(SUM(s.value), 0)', 'value')
      .where('s.metric IN (:...metrics)', { metrics })
      .groupBy('s.metric');
    this.applyTenantIn(qb, 's', params.allowedTenantIds);

    const rows = await qb.getRawMany<{ metric: string; value: string }>();
    const valueMap = new Map(rows.map((r) => [r.metric, Number(r.value ?? 0)]));

    return {
      updatedAt: new Date().toISOString(),
      metrics: metrics.map((m) => {
        const def = getMetricDef(m);
        return {
          metric: m,
          label: def?.label ?? m,
          unit: def?.unit ?? null,
          value: round2(valueMap.get(m) ?? 0),
        };
      }),
    };
  }

  // ─────────────── 内部辅助 ───────────────

  private applyTenantIn<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    allowedTenantIds: number[] | null,
  ): void {
    if (allowedTenantIds == null) return; // 平台超管：不限租户
    if (allowedTenantIds.length === 1) {
      qb.andWhere(`${alias}.tenant_id = :__statTid`, {
        __statTid: allowedTenantIds[0],
      });
    } else {
      qb.andWhere(`${alias}.tenant_id IN (:...__statTids)`, {
        __statTids: allowedTenantIds,
      });
    }
  }

  private async sumMetrics(
    metrics: string[],
    allowedTenantIds: number[] | null,
    fromStr: string,
    toStr: string,
  ): Promise<Map<string, number>> {
    const qb = this.dailyRepo
      .createQueryBuilder('s')
      .select('s.metric', 'metric')
      .addSelect('COALESCE(SUM(s.value), 0)', 'sumValue')
      .addSelect('COALESCE(AVG(s.value), 0)', 'avgValue')
      .where('s.metric IN (:...metrics)', { metrics })
      .andWhere('s.stat_date BETWEEN :from AND :to', {
        from: fromStr,
        to: toStr,
      })
      .groupBy('s.metric');
    this.applyTenantIn(qb, 's', allowedTenantIds);

    const rows = await qb.getRawMany<{
      metric: string;
      sumValue: string;
      avgValue: string;
    }>();
    const map = new Map<string, number>();
    for (const r of rows) {
      const def = getMetricDef(r.metric);
      const useAvg = def?.aggregation === 'avg' || def?.aggregation === 'rate';
      map.set(r.metric, Number((useAvg ? r.avgValue : r.sumValue) ?? 0));
    }
    return map;
  }

  /** 在线率 = SUM(在线设备) / SUM(设备总数)（区间近似） */
  private async computeOnlineRate(
    allowedTenantIds: number[] | null,
    fromStr: string,
    toStr: string,
  ): Promise<number | null> {
    const qb = this.dailyRepo
      .createQueryBuilder('s')
      .select(
        `COALESCE(SUM(CASE WHEN s.metric = :online THEN s.value ELSE 0 END), 0)`,
        'online',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN s.metric = :count THEN s.value ELSE 0 END), 0)`,
        'total',
      )
      .where('s.metric IN (:...metrics)', {
        metrics: [STAT_METRICS.DEVICES_ONLINE, STAT_METRICS.DEVICES_COUNT],
      })
      .andWhere('s.stat_date BETWEEN :from AND :to', {
        from: fromStr,
        to: toStr,
      })
      .setParameters({
        online: STAT_METRICS.DEVICES_ONLINE,
        count: STAT_METRICS.DEVICES_COUNT,
      });
    this.applyTenantIn(qb, 's', allowedTenantIds);

    const row = await qb.getRawOne<{ online: string; total: string }>();
    const total = Number(row?.total ?? 0);
    const online = Number(row?.online ?? 0);
    if (!total) return null;
    return round2((online / total) * 100);
  }

  private async loadTenantNames(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
    if (!unique.length) return new Map();
    const tenants = await this.tenantRepo.find({ where: { id: In(unique) } });
    return new Map(tenants.map((t) => [t.id, t.name]));
  }

  private emptyMetricResult(
    metric: string,
    def?: StatMetricDef,
  ): MetricQueryResult {
    return {
      metric,
      label: def?.label ?? metric,
      unit: def?.unit ?? null,
      aggregation: def?.aggregation ?? 'sum',
      total: 0,
      trend: [],
      byTenant: [],
    };
  }
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** MySQL date 列在 mysql2 下可能返回 Date 或 'YYYY-MM-DD' 字符串，统一成字符串 */
function normalizeDate(d: string | Date): string {
  if (d instanceof Date) return ymd(d);
  // 已是 'YYYY-MM-DD' 或 'YYYY-MM-DDTHH...' → 截前 10 位
  return String(d).slice(0, 10);
}
