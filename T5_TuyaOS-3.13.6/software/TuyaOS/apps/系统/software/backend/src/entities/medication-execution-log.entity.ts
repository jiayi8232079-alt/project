import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { MedicationReminder } from './medication-reminder.entity.js';
import { ServiceTarget } from './service-target.entity.js';

export enum MedicationExecutionStatus {
  TAKEN = 'taken',
  MISSED = 'missed',
  SKIPPED = 'skipped',
  PENDING = 'pending',
}

/**
 * 用药执行记录：用户/家属/陪诊员在每个时间点打卡。
 * 由风险预警引擎用于判断"近 7 天漏服率"。
 */
@Entity('medication_execution_logs')
@Index(['reminderId', 'scheduledDate'])
@Index(['serviceTargetId', 'scheduledDate'])
export class MedicationExecutionLog extends TenantAwareEntity {
  @Column({ name: 'reminder_id' })
  reminderId: number;

  @ManyToOne(() => MedicationReminder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reminder_id' })
  reminder: MedicationReminder;

  @Column({
    name: 'service_target_id',
    type: 'int',
    nullable: true,
  })
  serviceTargetId: number | null;

  @ManyToOne(() => ServiceTarget, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget | null;

  @Column({
    name: 'scheduled_date',
    type: 'date',
    comment: '计划服药日期',
  })
  scheduledDate: string;

  @Column({
    name: 'scheduled_time',
    type: 'varchar',
    length: 5,
    comment: '计划服药时间 HH:MM',
  })
  scheduledTime: string;

  @Column({
    type: 'enum',
    enum: MedicationExecutionStatus,
    default: MedicationExecutionStatus.PENDING,
  })
  status: MedicationExecutionStatus;

  @Column({ name: 'executed_at', type: 'datetime', nullable: true })
  executedAt: Date | null;

  @Column({ name: 'executed_by', type: 'int', nullable: true })
  executedBy: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
