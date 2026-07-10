import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum DeviceSettingDispatchStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('device_setting_dispatch_logs')
@Index(['deviceId', 'createdAt'])
@Index(['status'])
export class DeviceSettingDispatchLog extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int' })
  deviceId: number;

  @Column({ name: 'setting_id', type: 'int' })
  settingId: number;

  @Column({
    type: 'enum',
    enum: DeviceSettingDispatchStatus,
    default: DeviceSettingDispatchStatus.PENDING,
  })
  status: DeviceSettingDispatchStatus;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ name: 'acked_at', type: 'datetime', nullable: true })
  ackedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;
}
