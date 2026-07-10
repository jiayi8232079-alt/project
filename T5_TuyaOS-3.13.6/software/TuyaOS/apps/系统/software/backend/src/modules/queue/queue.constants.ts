/** bullmq 队列名常量 —— 集中管理避免字符串散落。 */
export const QUEUE_FALL = 'fall-event';
export const QUEUE_SOS = 'sos-event';
export const QUEUE_MEDICATION = 'medication-reminder';
export const QUEUE_AI_TOOL = 'ai-tool-call';

/** 关键设备事件入队的 payload。 */
export interface CriticalEventJob {
  deviceId: number;
  tenantId: number;
  userIds: number[];
  serviceTargetIds: number[];
  eventLogId: number | null;
  /** 设备事件级别（info/warning/critical），用 string 避免与实体枚举类型耦合 */
  level: string;
  summary: string;
  occurredAt: string;
}
