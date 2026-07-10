import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { DeviceBinding } from './device-binding.entity.js';

/**
 * 设备类型 —— 决定上报事件解析与 UI 展示。
 *
 * - `robot`  桌面陪护机器人（T5-E1 / Wukong AI）
 * - `radar`  毫米波跌倒雷达（涂鸦官方 SoC，免开发）
 * - `wearable`  穿戴（血压计/血糖仪等，预留）
 */
export enum DeviceType {
  ROBOT = 'robot',
  RADAR = 'radar',
  WEARABLE = 'wearable',
}

export enum DeviceLifecycleStatus {
  /** 已激活、可使用 */
  ACTIVE = 'active',
  /** 出厂待激活 */
  PENDING = 'pending',
  /** 临时停用（家属/运营操作） */
  SUSPENDED = 'suspended',
  /** 退役/RMA 退回 */
  DECOMMISSIONED = 'decommissioned',
}

/**
 * 设备主表 —— 一台物理设备一条记录。
 *
 * 关键决策：
 * 1. **主键用自增 number**（与现有项目一致），`tuya_device_id` 单独唯一存涂鸦云 ID；
 * 2. **mock 阶段** `tuya_device_id` 可以是任意字符串（如 `mock_xxx`），不接涂鸦时不阻塞；
 * 3. `online` 是缓存字段，真实在线状态以 `device_online_history` 最新一条为准；
 *    缓存的好处是 list 接口少 join 一次；
 * 4. `last_heartbeat_at` 由 Pulsar 消息更新（mock 阶段由 admin 手动触发或 cron 模拟）；
 * 5. `metadata` JSON 兜底各种产品差异化字段，避免每加一个新产品都改表。
 */
@Entity('devices')
@Index(['tuyaDeviceId'], { unique: true })
@Index(['productId'])
@Index(['type'])
@Index(['status'])
export class Device extends TenantAwareEntity {
  @Column({
    name: 'tuya_device_id',
    type: 'varchar',
    length: 64,
    comment: '涂鸦云分配的 deviceId（mock 阶段用 mock_xxx 占位）',
  })
  tuyaDeviceId: string;

  @Column({
    name: 'product_id',
    type: 'varchar',
    length: 64,
    comment: '涂鸦 PID（当前默认 hdmfmu2akvw4egia）',
  })
  productId: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
    default: DeviceType.ROBOT,
    comment: '设备类型',
  })
  type: DeviceType;

  @Column({
    type: 'enum',
    enum: DeviceLifecycleStatus,
    default: DeviceLifecycleStatus.PENDING,
    comment: '生命周期状态',
  })
  status: DeviceLifecycleStatus;

  @Column({ type: 'varchar', length: 128, comment: '展示名称（如「爷爷的陪伴机」）' })
  name: string;

  @Column({
    name: 'firmware_version',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '当前固件版本号 major.minor.patch',
  })
  firmwareVersion: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, comment: '设备 MAC' })
  mac: string | null;

  @Column({
    name: 'icon_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '设备型号头图（涂鸦平台或本地资源）',
  })
  iconUrl: string | null;

  @Column({
    type: 'boolean',
    default: false,
    comment: '在线状态缓存（真实状态以 device_online_history 最新一条为准）',
  })
  online: boolean;

  @Column({
    name: 'last_online_at',
    type: 'datetime',
    nullable: true,
    comment: '最后一次上线时间',
  })
  lastOnlineAt: Date | null;

  @Column({
    name: 'last_heartbeat_at',
    type: 'datetime',
    nullable: true,
    comment: '最后一次心跳（Pulsar 消息推到时更新）',
  })
  lastHeartbeatAt: Date | null;

  @Column({
    name: 'battery_percent',
    type: 'tinyint',
    nullable: true,
    comment: '电量百分比（0-100），由 DP 上报更新',
  })
  batteryPercent: number | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '扩展元数据（厂家、批次、屏幕分辨率、自定义产品信息等）',
  })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => DeviceBinding, (b) => b.device)
  bindings: DeviceBinding[];
}
