import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

/**
 * 按日预聚合统计 —— 分层多租户大盘的核心数据源（PRD §4.2）。
 *
 * 设计要点：
 * 1. **不继承 `TenantAwareEntity`**：stat 表是「跨租户聚合查询」表，
 *    每行的 `tenantId` 指向「直接产生数据的最底层租户」（通常 site/organization），
 *    上级大盘通过 `WHERE tenant_id IN (子孙ID...)` + `SUM` 汇总，
 *    因此不能被 TenantSubscriber 自动注入当前请求租户，故显式建列。
 * 2. `(tenantId, statDate, metric)` 唯一 —— 聚合 cron 幂等 upsert（重跑不产生重复行）。
 * 3. `value` 用 decimal(20,4)：兼容计数（整数）与比率/金额（小数）。
 * 4. `dimensions` JSON：维度细分（如按性别/服务类型/严重度），明细钻取用。
 */
@Entity('stat_daily')
@Unique('uk_stat_daily', ['tenantId', 'statDate', 'metric'])
@Index('idx_stat_daily_metric_date', ['metric', 'statDate'])
@Index('idx_stat_daily_tenant_date', ['tenantId', 'statDate'])
export class StatDaily extends BaseEntity {
  @Column({
    name: 'tenant_id',
    type: 'int',
    comment: '直接产生数据的最底层租户 ID（上级按子孙 IN 汇总）',
  })
  tenantId: number;

  @Column({
    name: 'stat_date',
    type: 'date',
    comment: '统计日期（YYYY-MM-DD）',
  })
  statDate: string;

  @Column({
    type: 'varchar',
    length: 64,
    comment: '指标 key（见 stat-metrics.ts 指标清单）',
  })
  metric: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 4,
    default: 0,
    transformer: DecimalTransformer,
    comment: '指标值（计数取整、比率/金额取小数）',
  })
  value: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '维度细分（如 {gender:{male:10,female:8}}）',
  })
  dimensions: Record<string, unknown> | null;
}
