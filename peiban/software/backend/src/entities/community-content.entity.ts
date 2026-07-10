import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum CommunityContentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PUBLISHED = 'published',
  REVOKED = 'revoked',
}

export enum CommunityContentPriority {
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('community_contents')
@Index(['status', 'createdAt'])
@Index(['tenantId', 'status'])
export class CommunityContent extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'voice_script', type: 'text', nullable: true })
  voiceScript: string | null;

  @Column({ type: 'varchar', length: 64 })
  category: string;

  @Column({
    type: 'enum',
    enum: CommunityContentPriority,
    default: CommunityContentPriority.NORMAL,
  })
  priority: CommunityContentPriority;

  @Column({
    type: 'enum',
    enum: CommunityContentStatus,
    default: CommunityContentStatus.DRAFT,
  })
  status: CommunityContentStatus;

  @Column({ type: 'json', nullable: true })
  target: {
    communityId?: number;
    buildingIds?: string[];
    elderTags?: string[];
    deviceIds?: number[];
  } | null;

  @Column({ type: 'json', nullable: true })
  schedule: Record<string, unknown> | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date | null;
}
