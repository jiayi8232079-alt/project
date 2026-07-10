import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum ServiceProviderStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Entity('service_providers')
@Index(['type', 'status'])
export class ServiceProvider extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({
    type: 'enum',
    enum: ServiceProviderStatus,
    default: ServiceProviderStatus.ACTIVE,
  })
  status: ServiceProviderStatus;

  @Column({ name: 'service_area', type: 'json', nullable: true })
  serviceArea: string[] | null;

  @Column({ type: 'json', nullable: true })
  catalog: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  credentials: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  settlement: Record<string, unknown> | null;
}
