import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum HospitalPartnershipStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

@Entity('hospital_partnerships')
@Index(['hospitalId', 'status'])
export class HospitalPartnership extends TenantAwareEntity {
  @Column({ name: 'hospital_id', type: 'int', nullable: true })
  hospitalId: number | null;

  @Column({ name: 'hospital_name', type: 'varchar', length: 128 })
  hospitalName: string;

  @Column({ name: 'partnership_type', type: 'varchar', length: 64 })
  partnershipType: string;

  @Column({
    type: 'enum',
    enum: HospitalPartnershipStatus,
    default: HospitalPartnershipStatus.ACTIVE,
  })
  status: HospitalPartnershipStatus;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil: Date | null;

  @Column({ type: 'json', nullable: true })
  resources: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  benefits: Record<string, unknown> | null;
}
