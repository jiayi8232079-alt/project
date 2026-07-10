import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export type QuietHourRange = {
  start: string;
  end: string;
};

export enum DeviceAutoEscalation {
  FAMILY_ONLY = 'family_only',
  FAMILY_THEN_COMMUNITY = 'family_then_community',
  FAMILY_THEN_MANUAL = 'family_then_manual',
}

export enum DevicePrivacyVisibility {
  GUARDIAN_ONLY = 'guardian_only',
  FAMILY_MEMBERS = 'family_members',
  COMMUNITY_DUTY = 'community_duty',
}

@Entity('device_settings')
@Index(['deviceId'], { unique: true })
export class DeviceSetting extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int' })
  deviceId: number;

  @Column({ name: 'quiet_hours', type: 'json', nullable: true })
  quietHours: QuietHourRange[] | null;

  @Column({ type: 'tinyint', default: 70 })
  volume: number;

  @Column({ name: 'speech_rate', type: 'decimal', precision: 4, scale: 2, default: 1 })
  speechRate: number;

  @Column({ name: 'screen_brightness', type: 'tinyint', default: 80 })
  screenBrightness: number;

  @Column({ name: 'sos_hold_seconds', type: 'tinyint', default: 3 })
  sosHoldSeconds: number;

  @Column({
    name: 'auto_escalation',
    type: 'enum',
    enum: DeviceAutoEscalation,
    default: DeviceAutoEscalation.FAMILY_THEN_COMMUNITY,
  })
  autoEscalation: DeviceAutoEscalation;

  @Column({ name: 'community_content_enabled', type: 'boolean', default: true })
  communityContentEnabled: boolean;

  @Column({
    name: 'privacy_visibility',
    type: 'enum',
    enum: DevicePrivacyVisibility,
    default: DevicePrivacyVisibility.GUARDIAN_ONLY,
  })
  privacyVisibility: DevicePrivacyVisibility;
}
