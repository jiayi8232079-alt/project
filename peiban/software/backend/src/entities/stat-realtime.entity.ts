import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

/**
 * 实时快照统计 —— 每 5 分钟刷新，每个 (租户, 指标) 只保留最新一条（PRD §4.2）。
 *
 * 用途：站点/机构首页的「当前在线设备数 / 待处理告警 / 当前值班护工」红点数字。
 * `updatedAt`（来自 BaseEntity）即「最后刷新时间」，前端判断数据新鲜度。
 */
@Entity('stat_realtime')
@Unique('uk_stat_realtime', ['tenantId', 'metric'])
@Index('idx_stat_realtime_metric', ['metric'])
export class StatRealtime extends BaseEntity {
  @Column({
    name: 'tenant_id',
    type: 'int',
    comment: '直接产生数据的最底层租户 ID',
  })
  tenantId: number;

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
    comment: '指标值（最新快照）',
  })
  value: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '维度细分',
  })
  dimensions: Record<string, unknown> | null;
}
