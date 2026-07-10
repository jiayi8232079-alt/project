import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

@Entity('family_messages')
@Index(['familyId', 'createdAt'])
@Index(['elderId', 'createdAt'])
export class FamilyMessage extends TenantAwareEntity {
  @Column({ name: 'family_id', type: 'int' })
  familyId: number;

  @Column({ name: 'elder_id', type: 'int', nullable: true })
  elderId: number | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'broadcast_mode', type: 'varchar', length: 32, default: 'next_available' })
  broadcastMode: string;

  @Column({ name: 'broadcasted_at', type: 'datetime', nullable: true })
  broadcastedAt: Date | null;
}
