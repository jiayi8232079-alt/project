import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';

export enum PushPlatform {
  IOS = 'ios',
  ANDROID = 'android',
  HARMONY = 'harmony',
  WEB = 'web',
  OTHER = 'other',
}

export enum PushVendor {
  APNS = 'apns',
  FCM = 'fcm',
  HUAWEI = 'huawei',
  XIAOMI = 'xiaomi',
  OPPO = 'oppo',
  VIVO = 'vivo',
  MEIZU = 'meizu',
  HONOR = 'honor',
  OTHER = 'other',
}

@Entity('app_device_tokens')
@Index(['userId', 'deviceId'], { unique: true })
@Index(['userId', 'active'])
@Index(['tenantId', 'active'])
export class AppDeviceToken extends TenantAwareEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: PushPlatform })
  platform: PushPlatform;

  @Column({ type: 'enum', enum: PushVendor })
  vendor: PushVendor;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({
    name: 'device_id',
    type: 'varchar',
    length: 128,
    comment: '手机侧设备标识，用于同一手机重复上报时更新 token',
  })
  deviceId: string;

  @Column({ name: 'app_version', type: 'varchar', length: 32, nullable: true })
  appVersion: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'last_seen_at', type: 'datetime' })
  lastSeenAt: Date;

  @Column({ name: 'unregistered_at', type: 'datetime', nullable: true })
  unregisteredAt: Date | null;
}
