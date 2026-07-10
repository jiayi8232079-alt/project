import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { SubscriptionPlan } from './subscription-plan.entity.js';
import { User } from './user.entity.js';
import { Device } from './device.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

export enum SubscriptionStatus {
  /** 试用中 */
  TRIALING = 'trialing',
  /** 正常运行 */
  ACTIVE = 'active',
  /** 已暂停（手动暂停/逾期未续 */
  PAUSED = 'paused',
  /** 宽限期（到期后 N 天保留数据） */
  GRACE = 'grace',
  /** 已停服 */
  CANCELED = 'canceled',
  /** 已过期未续 */
  EXPIRED = 'expired',
}

/**
 * 订阅记录 —— 一条订阅对应一个用户/机构购买的一个套餐实例。
 *
 * 设计要点：
 * - `deviceId` 可选：设备订阅时必填，绑定该订阅服务于哪台设备；
 * - `autoRenew` 默认 true：到期前 N 天系统尝试自动续费；
 * - `nextChargeAt` 由系统计算并打点续费；
 * - 历史扣费记录另立 `subscription_charges` 表（v1.0 不做，由 finance/usage_records 兜底）。
 */
@Entity('subscriptions')
@Index(['userId'])
@Index(['deviceId'])
@Index(['planId'])
@Index(['status'])
@Index(['nextChargeAt'])
@Index(['tenantId', 'status'])
export class Subscription extends TenantAwareEntity {
  @Column({ name: 'plan_id', type: 'int' })
  planId: number;

  @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'user_id', type: 'int', comment: '购买账号（家属或机构管理员）' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'device_id',
    type: 'int',
    nullable: true,
    comment: '关联设备（设备订阅必填；机构/AI 订阅可空）',
  })
  deviceId: number | null;

  @ManyToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'device_id' })
  device: Device | null;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.TRIALING })
  status: SubscriptionStatus;

  @Column({
    name: 'started_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '订阅生效起点',
  })
  startedAt: Date;

  @Column({
    name: 'current_period_end',
    type: 'datetime',
    nullable: true,
    comment: '当前付费周期结束时间',
  })
  currentPeriodEnd: Date | null;

  @Column({
    name: 'next_charge_at',
    type: 'datetime',
    nullable: true,
    comment: '下次扣费时间（cron 扫描用）',
  })
  nextChargeAt: Date | null;

  @Column({
    name: 'auto_renew',
    type: 'boolean',
    default: true,
    comment: '是否自动续费',
  })
  autoRenew: boolean;

  @Column({
    name: 'canceled_at',
    type: 'datetime',
    nullable: true,
    comment: '取消时间',
  })
  canceledAt: Date | null;

  @Column({
    name: 'cancel_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  cancelReason: string | null;

  @Column({
    name: 'unit_price_snapshot',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
    comment: '订阅时的套餐价格快照（套餐改价不影响存量）',
  })
  unitPriceSnapshot: number;
}
