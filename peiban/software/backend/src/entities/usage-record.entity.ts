import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

/**
 * 用量计量类型 —— 决定计费维度与归集逻辑。
 */
export enum UsageMetric {
  /** AI 对话次数 */
  AI_DIALOG_CALL = 'ai_dialog_call',
  /** AI 累计 token */
  AI_TOKEN = 'ai_token',
  /** 视频通话分钟 */
  VIDEO_MINUTE = 'video_minute',
  /** 设备月度活跃天 */
  DEVICE_ACTIVE_DAY = 'device_active_day',
  /** 报告生成次数 */
  REPORT_GENERATED = 'report_generated',
}

/**
 * 用量记录 —— 按事件 / 按天滚动的细粒度计量。
 *
 * 使用模式：
 * - 实时事件触发（如 AI 对话结束）→ 写 1 条 `usage_records`；
 * - cron 按天/月聚合（如月度账单）→ 读 usage_records 汇总。
 *
 * 设计要点：
 * - `quantity` 用 decimal 兼容 token 等大数（>2^31）；
 * - `unitPrice` 快照本次记录单价，运营改价不回溯老数据；
 * - `subscriptionId` 关联到所属订阅（计算"超量用量包"用）；
 * - 索引按 `(tenantId, userId, metric, occurredAt)` 联合，对账查询走索引。
 */
@Entity('usage_records')
@Index(['userId', 'metric', 'occurredAt'])
@Index(['subscriptionId', 'occurredAt'])
@Index(['deviceId', 'occurredAt'])
@Index(['tenantId', 'metric', 'occurredAt'])
export class UsageRecord extends TenantAwareEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({
    name: 'subscription_id',
    type: 'int',
    nullable: true,
    comment: '关联订阅（套餐用量扣减用）',
  })
  subscriptionId: number | null;

  @Column({
    name: 'device_id',
    type: 'int',
    nullable: true,
    comment: '触发用量的设备',
  })
  deviceId: number | null;

  @Column({ type: 'enum', enum: UsageMetric })
  metric: UsageMetric;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
    transformer: DecimalTransformer,
    comment: '用量数值（token 等大数兼容）',
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: DecimalTransformer,
    comment: '单价快照（元/单位）',
  })
  unitPrice: number;

  @Column({
    name: 'occurred_at',
    type: 'datetime',
    comment: '用量发生时间',
  })
  occurredAt: Date;

  @Column({
    name: 'session_id',
    type: 'int',
    nullable: true,
    comment: '关联 ai_dialog_sessions.id（如适用）',
  })
  sessionId: number | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '扩展元数据（模型名 / 通话双方等）',
  })
  metadata: Record<string, unknown> | null;
}
