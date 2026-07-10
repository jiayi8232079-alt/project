/**
 * 实时事件总线 —— 后端各业务模块发布事件 → realtime.service 转发给在线客户端。
 *
 * 设计原则：
 * 1. **强类型 event payload**：每个事件类型一个 interface，前端 TypeScript 也能复用；
 * 2. **粒度分层**：device.* / alert.* / ai.* / notification.* 四大类；
 * 3. **路由元数据**：每个事件附 routing.tenantId / userIds / deviceIds，
 *    RealtimeService 根据元数据决定推到哪些 socket room。
 */

/** 推送路由提示 —— 告诉 RealtimeService 这个事件应该推给谁 */
export interface RealtimeRouting {
  /** 必填：所属租户（用于跨租户隔离） */
  tenantId: number;
  /** 推给具体用户（家属端 App）—— 空数组表示不按 user 推 */
  userIds?: number[];
  /** 推给绑定了这些设备的所有用户（用于跌倒等设备维度事件） */
  deviceIds?: number[];
  /** 推给关注这些服务对象的所有人（家属圈群推） */
  serviceTargetIds?: number[];
  /** 推给租户内所有连接的成员（社区端值班大盘） */
  broadcastToTenant?: boolean;
}

export interface DeviceOnlineEvent {
  type: 'device.online' | 'device.offline';
  deviceId: number;
  tuyaDeviceId: string;
  occurredAt: string;
}

export interface DeviceDpChangedEvent {
  type: 'device.dp.changed';
  deviceId: number;
  dpCode: string;
  value: string;
  valueType: 'bool' | 'number' | 'string' | 'json' | 'enum';
  occurredAt: string;
}

export interface AlertEvent {
  type: 'alert.fall' | 'alert.sos' | 'alert.vital_anomaly' | 'alert.heartbeat';
  /** 告警唯一 ID（health_alerts.id 或 alert_logs.id） */
  alertId: number | null;
  deviceId?: number;
  serviceTargetId?: number;
  /** 告警严重度（info/warning/critical） */
  level: 'info' | 'warning' | 'critical';
  /** 业务摘要（家属 App 可直接展示） */
  summary: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
}

export interface NotificationEvent {
  type: 'notification.new';
  notificationId: number;
  channel: 'app_push' | 'sms' | 'wechat';
  title: string;
  content: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface AiDialogEvent {
  type: 'ai.dialog.new';
  sessionId: number;
  deviceId?: number;
  serviceTargetId?: number;
  direction: 'user' | 'assistant';
  text: string;
  crisisScore: number;
  createdAt: string;
}

export type RealtimeEvent =
  | DeviceOnlineEvent
  | DeviceDpChangedEvent
  | AlertEvent
  | NotificationEvent
  | AiDialogEvent;

export interface RealtimePush {
  event: RealtimeEvent;
  routing: RealtimeRouting;
}
