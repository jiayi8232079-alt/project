import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 设备 DP（Data Point）最新状态快照 —— 性能优化表。
 *
 * 为什么需要：
 * - 设备详情页要展示「当前音量/电量/勿扰/在线」等多个 DP 的最新值；
 * - 如果每次都去 `device_event_logs` 倒序取，IO 成本高；
 * - 本表维护「每台设备×每个 dp_code」的唯一最新行，单点 lookup 即得。
 *
 * 维护策略（service 层）：
 * - DP 上报事件入库后，**UPSERT** 本表 `(device_id, dp_code)` 唯一行；
 * - mock 阶段：admin 手动触发 DP 时同步 upsert；
 * - 真实接涂鸦时：Pulsar 订阅器消费 DP 事件后 upsert。
 *
 * 数据类型：
 * - `valueType` 标识 value 是 bool/number/string/json，业务端按类型解析；
 * - `value` 统一存字符串便于通用 upsert，JSON 类直接 JSON.stringify。
 */
@Entity('device_dp_snapshots')
@Index(['deviceId', 'dpCode'], { unique: true })
@Index(['dpCode'])
@Index(['updatedAt'])
export class DeviceDpSnapshot extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int' })
  deviceId: number;

  @Column({
    name: 'dp_code',
    type: 'varchar',
    length: 64,
    comment: 'DP 标识符（如 volume_set / battery_percentage / sos）',
  })
  dpCode: string;

  @Column({
    name: 'value_type',
    type: 'enum',
    enum: ['bool', 'number', 'string', 'json', 'enum'],
    default: 'string',
    comment: '值类型，业务端据此 cast',
  })
  valueType: 'bool' | 'number' | 'string' | 'json' | 'enum';

  @Column({
    type: 'text',
    comment: '原始值（统一字符串存储；json 类型为 JSON.stringify 结果）',
  })
  value: string;

  @Column({
    name: 'reported_at',
    type: 'datetime',
    comment: '设备上报时间（消息时间，mock 取当前）',
  })
  reportedAt: Date;
}
