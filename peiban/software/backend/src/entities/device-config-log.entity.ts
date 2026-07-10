import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 配置下发回执状态。
 * - pending 待下发（已入队，未发涂鸦云）
 * - sent    已下发（已调涂鸦 OpenAPI；mock 阶段直接置 sent）
 * - acked   设备已确认执行
 * - failed  下发失败（含错误原因）
 */
export enum DeviceConfigStatus {
  PENDING = 'pending',
  SENT = 'sent',
  ACKED = 'acked',
  FAILED = 'failed',
}

/**
 * 设备配置变更审计（PRD §5.2.3）—— 每次把某个配置下发到某台设备记一条，
 * 用于「下发了什么 / 来源哪一层 / 成功与否」的全链路追溯与失败重试。
 */
@Entity('device_config_logs')
@Index('idx_device_config_logs_device', ['deviceId', 'createdAt'])
@Index('idx_device_config_logs_status', ['status'])
@Index('idx_device_config_logs_key', ['configKey'])
export class DeviceConfigLog extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int', comment: '目标设备 ID' })
  deviceId: number;

  @Column({
    name: 'config_key',
    type: 'varchar',
    length: 64,
    comment: '配置键',
  })
  configKey: string;

  @Column({
    name: 'config_value',
    type: 'text',
    comment: '下发的配置值快照',
  })
  configValue: string;

  @Column({
    name: 'source_tenant_id',
    type: 'int',
    comment: '配置实际来源租户（path 链上命中的那一层）',
  })
  sourceTenantId: number;

  @Column({
    type: 'enum',
    enum: DeviceConfigStatus,
    default: DeviceConfigStatus.PENDING,
    comment: '下发状态',
  })
  status: DeviceConfigStatus;

  @Column({
    name: 'ack_at',
    type: 'datetime',
    nullable: true,
    comment: '设备确认时间',
  })
  ackAt: Date | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '失败原因',
  })
  error: string | null;
}
