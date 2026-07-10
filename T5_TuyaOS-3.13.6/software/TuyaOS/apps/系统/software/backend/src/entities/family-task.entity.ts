import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum FamilyTaskStatus {
  PENDING = 'pending',
  SENT = 'sent',
  BROADCASTED = 'broadcasted',
  RESPONDED = 'responded',
  CANCELLED = 'cancelled',
}

@Entity('family_tasks')
@Index(['familyId', 'status'])
@Index(['elderId', 'status'])
export class FamilyTask extends TenantAwareEntity {
  @Column({ name: 'family_id', type: 'int' })
  familyId: number;

  @Column({ name: 'elder_id', type: 'int', nullable: true })
  elderId: number | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'schedule_mode', type: 'varchar', length: 32, default: 'next_available' })
  scheduleMode: string;

  @Column({ name: 'remind_at', type: 'datetime', nullable: true })
  remindAt: Date | null;

  @Column({
    type: 'enum',
    enum: FamilyTaskStatus,
    default: FamilyTaskStatus.PENDING,
  })
  status: FamilyTaskStatus;

  @Column({ name: 'broadcasted_at', type: 'datetime', nullable: true })
  broadcastedAt: Date | null;

  @Column({ name: 'elder_response', type: 'text', nullable: true })
  elderResponse: string | null;
}
