import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum VoiceprintStatus {
  NOT_STARTED = 'not_started',
  ENROLLING = 'enrolling',
  ACTIVE = 'active',
  LOW_CONFIDENCE = 'low_confidence',
  REVOKED = 'revoked',
}

@Entity('voiceprint_profiles')
@Index(['familyId', 'memberId'], { unique: true })
@Index(['status'])
export class VoiceprintProfile extends TenantAwareEntity {
  @Column({ name: 'family_id', type: 'int' })
  familyId: number;

  @Column({ name: 'member_id', type: 'int' })
  memberId: number;

  @Column({
    type: 'enum',
    enum: VoiceprintStatus,
    default: VoiceprintStatus.NOT_STARTED,
  })
  status: VoiceprintStatus;

  @Column({ type: 'decimal', precision: 4, scale: 3, nullable: true })
  confidence: number | null;

  @Column({ name: 'enrolled_at', type: 'datetime', nullable: true })
  enrolledAt: Date | null;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'misrecognition_count', type: 'int', default: 0 })
  misrecognitionCount: number;
}
