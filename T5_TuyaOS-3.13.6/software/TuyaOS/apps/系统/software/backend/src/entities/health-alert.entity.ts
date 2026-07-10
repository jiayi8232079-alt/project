import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';
import { Order } from './order.entity.js';
import { AdminUser } from './admin-user.entity.js';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AlertStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  CLOSED = 'closed',
  IGNORED = 'ignored',
}

export enum AlertCategory {
  MEDICATION_MISS = 'medication_miss',
  FOLLOW_UP_OVERDUE = 'follow_up_overdue',
  TIMELINE_KEYWORD = 'timeline_keyword',
  SERVICE_EXCEPTION = 'service_exception',
  MANUAL = 'manual',
}

@Entity('health_alerts')
@Index(['userId', 'status'])
@Index(['serviceTargetId', 'status'])
@Index(['severity', 'triggeredAt'])
export class HealthAlert extends TenantAwareEntity {
  @Column({ name: 'user_id', comment: '关联家属/主账号 user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'service_target_id',
    type: 'int',
    nullable: true,
    comment: '服务对象（老人/患者）',
  })
  serviceTargetId: number | null;

  @ManyToOne(() => ServiceTarget, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget | null;

  @Column({
    name: 'order_id',
    type: 'int',
    nullable: true,
    comment: '关联订单（如关键词规则由时间线触发）',
  })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({
    type: 'enum',
    enum: AlertCategory,
    comment: '告警分类',
  })
  category: AlertCategory;

  @Column({
    name: 'rule_code',
    type: 'varchar',
    length: 64,
    comment: '触发规则 code（如 medication_miss_rate_low）',
  })
  ruleCode: string;

  @Column({
    name: 'rule_name',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  ruleName: string | null;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 255, comment: '预警标题（家属看板横幅）' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '预警详细说明' })
  summary: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '命中时的上下文数据（如漏服天数、逾期天数、命中关键词等）',
  })
  payload: Record<string, unknown> | null;

  @Column({
    name: 'suggested_actions',
    type: 'json',
    nullable: true,
    comment: '系统推荐家属可执行的动作（如 联系客服 / 升级月卡）',
  })
  suggestedActions: { action: string; label: string; payload?: unknown }[] | null;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.NEW,
  })
  status: AlertStatus;

  @Column({ name: 'triggered_at', type: 'datetime' })
  triggeredAt: Date;

  @Column({
    name: 'acknowledged_at',
    type: 'datetime',
    nullable: true,
  })
  acknowledgedAt: Date | null;

  @Column({
    name: 'acknowledged_by',
    type: 'int',
    nullable: true,
    comment: '确认者 user_id 或 admin_user_id（配合 channel 区分）',
  })
  acknowledgedBy: number | null;

  @Column({
    name: 'acknowledged_channel',
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: 'family / admin',
  })
  acknowledgedChannel: 'family' | 'admin' | null;

  @Column({ name: 'acknowledged_note', type: 'text', nullable: true })
  acknowledgedNote: string | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by', type: 'int', nullable: true })
  closedBy: number | null;

  @Column({
    name: 'assignee_id',
    type: 'int',
    nullable: true,
    comment: '指派到的 admin_user_id（客服/健康管家）',
  })
  assigneeId: number | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: AdminUser | null;

  @Column({
    name: 'assigned_by',
    type: 'int',
    nullable: true,
    comment: '指派操作者 admin_user_id',
  })
  assignedBy: number | null;

  @Column({ name: 'assigned_at', type: 'datetime', nullable: true })
  assignedAt: Date | null;

  @Column({
    name: 'dedup_key',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '幂等 key：同一规则+对象+时间窗只产生一条预警',
  })
  dedupKey: string | null;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent: boolean;

  @Column({ name: 'notification_sent_at', type: 'datetime', nullable: true })
  notificationSentAt: Date | null;
}
