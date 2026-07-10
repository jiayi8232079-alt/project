import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 设备在线状态历史 —— 每次上下线切换都追加一条。
 *
 * 用途：
 * - 后台运维大盘：在线率、断网时长分布、最长连续在线段；
 * - 跌倒/告警链路：跌倒事件前 N 分钟设备是否在线，可作为复盘依据；
 * - 客服话术：用户报修时可一眼看到「设备过去 24 小时离线 3 次」。
 *
 * 注意：
 * - 本表是追加（append-only），不更新；
 * - device.online 字段是冗余缓存，写本表时同步更新缓存；
 * - 数据增长较快，建议按月分表或 90 天滚动归档（v1.0 暂不做归档）。
 */
@Entity('device_online_histories')
@Index(['deviceId', 'changedAt'])
@Index(['tenantId', 'changedAt'])
export class DeviceOnlineHistory extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int' })
  deviceId: number;

  @Column({ type: 'boolean', comment: '当次切换后的状态（true=在线，false=离线）' })
  online: boolean;

  @Column({
    name: 'changed_at',
    type: 'datetime',
    comment: '状态切换时间（与上一条不同状态的间隔即「上次在线/离线时长」）',
  })
  changedAt: Date;

  @Column({
    name: 'source',
    type: 'varchar',
    length: 32,
    default: 'pulsar',
    comment: '来源（pulsar/heartbeat/manual/mock）',
  })
  source: string;
}
