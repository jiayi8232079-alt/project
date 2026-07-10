import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { MedicationReminder } from './medication-reminder.entity.js';

export enum MedicationAuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  PAUSE = 'pause',
  RESUME = 'resume',
  COMPLETE = 'complete',
  CANCEL = 'cancel',
  DELETE = 'delete',
}

export enum MedicationAuditActorType {
  ADMIN = 'admin',
  USER = 'user',
  SYSTEM = 'system',
}

/**
 * 用药提醒审计日志。
 *
 * 药品属于高敏感数据，任何剂量 / 频次 / 时间的改动都可能影响老人健康。
 * 本表记录每一次修改的 diff，用于：
 *   - 出事故时回溯「最后一次是谁改的，改成了什么」；
 *   - 家属/运营互相不信任时给出客观证据；
 *   - 审计合规要求。
 */
@Entity('medication_reminder_audits')
@Index(['reminderId', 'createdAt'])
export class MedicationReminderAudit extends TenantAwareEntity {
  @Column({ name: 'reminder_id' })
  reminderId: number;

  @ManyToOne(() => MedicationReminder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reminder_id' })
  reminder: MedicationReminder;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: MedicationAuditActorType,
    default: MedicationAuditActorType.SYSTEM,
    comment: '操作方身份',
  })
  actorType: MedicationAuditActorType;

  @Column({
    name: 'actor_id',
    type: 'int',
    nullable: true,
    comment: 'admin_user_id 或 user_id；system 为空',
  })
  actorId: number | null;

  @Column({
    name: 'actor_name',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '操作方显示名快照',
  })
  actorName: string | null;

  @Column({
    type: 'enum',
    enum: MedicationAuditAction,
    comment: '动作',
  })
  action: MedicationAuditAction;

  @Column({
    name: 'diff_json',
    type: 'json',
    nullable: true,
    comment: '字段变更 diff：{ field: { from, to } } 形式',
  })
  diffJson: Record<string, { from: unknown; to: unknown }> | null;

  @Column({ type: 'text', nullable: true, comment: '备注 / 原因说明' })
  note: string | null;
}
