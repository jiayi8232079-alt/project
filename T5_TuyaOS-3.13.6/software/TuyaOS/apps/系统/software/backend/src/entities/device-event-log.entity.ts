import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 设备事件类型 —— 与涂鸦 Pulsar 消息类型对齐 + 自定义业务事件。
 *
 * 重要事件单独立 enum 值，便于按类型快速查询；
 * 自由扩展的事件通过 `payload.subType` 区分。
 */
export enum DeviceEventType {
  /** 上下线 */
  ONLINE = 'online',
  OFFLINE = 'offline',
  /** DP 上报（普通业务数据点变化） */
  DP_CHANGE = 'dp_change',
  /** 安全链路：跌倒检测（雷达 / 机器人 IMU） */
  FALL = 'fall',
  /** 安全链路：一键 SOS（物理键） */
  SOS = 'sos',
  /** 安全链路：心率/体征异常（穿戴设备） */
  VITAL_ANOMALY = 'vital_anomaly',
  /** 对话/业务链路：AI 对话事件（语音录入/识别/回答） */
  AI_DIALOG = 'ai_dialog',
  /** 故障上报（DP fault 触发） */
  FAULT = 'fault',
  /** OTA 升级状态 */
  OTA = 'ota',
  /** 设备主动播报（提醒已播报回执） */
  PLAY_REMINDER = 'play_reminder',
  /** 其它/扩展 */
  OTHER = 'other',
}

/**
 * 事件级别 —— 用于 list 筛选与告警分流。
 *
 * - `info`     普通业务事件（DP 变化、上下线）
 * - `warning`  需要关注（电量低、轻度跌倒）
 * - `critical` 紧急（确诊跌倒、SOS、心率异常）—— 必走 alert 模块
 */
export enum DeviceEventLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * 设备上行事件流水 —— 所有涂鸦 Pulsar 消息 + 本地 mock 触发的事件都落这张表。
 *
 * 用途：
 * 1. 安全链路审计（跌倒/SOS 完整时间线）；
 * 2. 设备运维大盘（在线率/事件频次统计）；
 * 3. AI 对话归档的事件交叉印证（哪个 DP 触发了哪段对话）。
 *
 * 设计要点：
 * - `receivedAt` 与 `createdAt` 分开：`receivedAt` 是涂鸦云原始消息时间，
 *   `createdAt` 是落本地库时间，便于排查链路延迟；
 * - `dedupKey` 唯一索引（可选）防止 Pulsar 重投导致同一事件多次入库；
 * - `payload` 整 JSON 存原始消息体，永不丢源数据。
 */
@Entity('device_event_logs')
@Index(['deviceId', 'receivedAt'])
@Index(['type', 'receivedAt'])
@Index(['level', 'receivedAt'])
@Index(['tenantId', 'type', 'receivedAt'])
@Index(['dedupKey'], { unique: true, where: 'dedup_key IS NOT NULL' })
export class DeviceEventLog extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int' })
  deviceId: number;

  @Column({
    type: 'enum',
    enum: DeviceEventType,
    default: DeviceEventType.OTHER,
    comment: '事件类型',
  })
  type: DeviceEventType;

  @Column({
    type: 'enum',
    enum: DeviceEventLevel,
    default: DeviceEventLevel.INFO,
    comment: '事件级别（critical 必走 alert 流）',
  })
  level: DeviceEventLevel;

  @Column({
    type: 'json',
    nullable: true,
    comment: '原始消息体（Pulsar 原文）',
  })
  payload: Record<string, unknown> | null;

  @Column({
    name: 'received_at',
    type: 'datetime',
    comment: '涂鸦云原始消息时间（mock 时取当前）',
  })
  receivedAt: Date;

  @Column({
    name: 'dedup_key',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '幂等去重 key（一般取 Pulsar messageId）',
  })
  dedupKey: string | null;

  @Column({
    name: 'forwarded_to_alert',
    type: 'boolean',
    default: false,
    comment: '是否已转 alert 模块处理（critical 事件用）',
  })
  forwardedToAlert: boolean;

  @Column({
    name: 'forwarded_to_realtime',
    type: 'boolean',
    default: false,
    comment: '是否已通过 WebSocket 推给在线 App',
  })
  forwardedToRealtime: boolean;
}
