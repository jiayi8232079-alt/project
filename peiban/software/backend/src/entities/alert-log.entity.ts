import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { HealthAlert } from './health-alert.entity.js';

export enum AlertLogActorType {
  ADMIN = 'admin',
  USER = 'user',
  SYSTEM = 'system',
}

export enum AlertLogAction {
  CREATE = 'create',
  ASSIGN = 'assign',
  COMMENT = 'comment',
  ACKNOWLEDGE = 'acknowledge',
  CLOSE = 'close',
  REOPEN = 'reopen',
  NOTIFY = 'notify',
}

@Entity('alert_logs')
@Index(['alertId', 'createdAt'])
export class AlertLog extends TenantAwareEntity {
  @Column({ name: 'alert_id', comment: '所属告警 ID' })
  alertId: number;

  @ManyToOne(() => HealthAlert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert: HealthAlert;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: AlertLogActorType,
    default: AlertLogActorType.SYSTEM,
    comment: '触发者身份：admin=管理员/客服 user=家属 system=系统',
  })
  actorType: AlertLogActorType;

  @Column({
    name: 'actor_id',
    type: 'int',
    nullable: true,
    comment: 'actor_type=admin 时是 admin_user_id，user 时是 user_id；system 为空',
  })
  actorId: number | null;

  @Column({
    name: 'actor_name',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '快照：触发者显示名（避免后续改名后日志失真）',
  })
  actorName: string | null;

  @Column({
    type: 'enum',
    enum: AlertLogAction,
    comment: '动作类型',
  })
  action: AlertLogAction;

  @Column({ type: 'text', nullable: true, comment: '跟进文字 / 备注' })
  note: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '结构化扩展字段（如 assignee_id、附件等）',
  })
  payload: Record<string, unknown> | null;
}
