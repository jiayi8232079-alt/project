import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

/**
 * 按小时预聚合统计 —— 实时性要求高的指标（如设备在线率，PRD §4.2）。
 *
 * 与 `stat_daily` 同构，仅时间粒度为「整点小时」。
 * `(tenantId, statHour, metric)` 唯一，聚合 cron 幂等 upsert。
 */
@Entity('stat_hourly')
@Unique('uk_stat_hourly', ['tenantId', 'statHour', 'metric'])
@Index('idx_stat_hourly_metric_hour', ['metric', 'statHour'])
@Index('idx_stat_hourly_tenant_hour', ['tenantId', 'statHour'])
export class StatHourly extends BaseEntity {
  @Column({
    name: 'tenant_id',
    type: 'int',
    comment: '直接产生数据的最底层租户 ID',
  })
  tenantId: number;

  @Column({
    name: 'stat_hour',
    type: 'datetime',
    comment: '统计整点（如 2026-06-17 13:00:00）',
  })
  statHour: Date;

  @Column({
    type: 'varchar',
    length: 64,
    comment: '指标 key',
  })
  metric: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 4,
    default: 0,
    transformer: DecimalTransformer,
    comment: '指标值',
  })
  value: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '维度细分',
  })
  dimensions: Record<string, unknown> | null;
}
