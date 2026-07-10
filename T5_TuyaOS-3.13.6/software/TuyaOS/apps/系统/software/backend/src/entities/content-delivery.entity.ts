import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum ContentDeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  PLAYED = 'played',
  APP_VIEWED = 'app_viewed',
  FAILED = 'failed',
  REVOKED = 'revoked',
}

@Entity('content_deliveries')
@Index(['contentId', 'status'])
@Index(['deviceId', 'createdAt'])
@Index(['familyId'])
export class ContentDelivery extends TenantAwareEntity {
  @Column({ name: 'content_id', type: 'int' })
  contentId: number;

  @Column({ name: 'device_id', type: 'int', nullable: true })
  deviceId: number | null;

  @Column({ name: 'family_id', type: 'int', nullable: true })
  familyId: number | null;

  @Column({ name: 'elder_id', type: 'int', nullable: true })
  elderId: number | null;

  @Column({
    type: 'enum',
    enum: ContentDeliveryStatus,
    default: ContentDeliveryStatus.QUEUED,
  })
  status: ContentDeliveryStatus;

  @Column({ name: 'status_at', type: 'datetime', nullable: true })
  statusAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;
}
