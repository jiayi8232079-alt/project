/**
 * 大盘指标清单（PRD §4.4）—— 单点定义，聚合 cron 与查询 API 共用，避免散落魔法字符串。
 */

export type StatFrequency = 'daily' | 'hourly' | 'realtime';

/** 指标聚合方式：sum=可跨租户累加；rate=比率（不可简单累加，需重算）；avg=均值 */
export type StatAggregation = 'sum' | 'rate' | 'avg';

export interface StatMetricDef {
  /** 指标 key（落库 metric 列） */
  key: string;
  /** 中文显示名 */
  label: string;
  /** 采集频率 */
  frequency: StatFrequency;
  /** 跨租户汇总方式 */
  aggregation: StatAggregation;
  /** 单位（用于前端展示，可空） */
  unit?: string;
}

export const STAT_METRICS = {
  RESIDENTS_COUNT: 'residents_count',
  DEVICES_COUNT: 'devices_count',
  DEVICES_ONLINE: 'devices_online',
  DEVICES_ONLINE_RATE: 'devices_online_rate',
  ORDERS_COUNT: 'orders_count',
  ORDERS_REVENUE: 'orders_revenue',
  FALL_EVENTS: 'fall_events',
  SOS_EVENTS: 'sos_events',
  ALERTS_COUNT: 'alerts_count',
  ALERTS_HANDLED: 'alerts_handled',
  DIALOG_SESSIONS: 'dialog_sessions',
  DIALOG_CRISIS: 'dialog_crisis',
  SERVICE_SATISFACTION: 'service_satisfaction',
  SUBSCRIPTION_ACTIVE: 'subscription_active',
  SUBSCRIPTION_REVENUE: 'subscription_revenue',
  PENDING_ALERTS: 'pending_alerts',
  ATTENDANTS_ACTIVE: 'attendants_active',
  COMPLAINTS_COUNT: 'complaints_count',
  COMPLAINTS_RESOLVED: 'complaints_resolved',
  TRIAGE_SESSIONS: 'triage_sessions',
  DEVICES_LOW_BATTERY: 'devices_low_battery',
  MEDICATION_ADHERENCE_RATE: 'medication_adherence_rate',
  ORDERS_COMPLETED: 'orders_completed',
  ATTENDANT_ORDERS: 'attendant_orders',
} as const;

export type StatMetricKey = (typeof STAT_METRICS)[keyof typeof STAT_METRICS];

export const STAT_METRIC_DEFS: Record<string, StatMetricDef> = {
  [STAT_METRICS.RESIDENTS_COUNT]: {
    key: STAT_METRICS.RESIDENTS_COUNT,
    label: '居民/服务对象数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '人',
  },
  [STAT_METRICS.DEVICES_COUNT]: {
    key: STAT_METRICS.DEVICES_COUNT,
    label: '设备总数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '台',
  },
  [STAT_METRICS.DEVICES_ONLINE]: {
    key: STAT_METRICS.DEVICES_ONLINE,
    label: '在线设备数',
    frequency: 'hourly',
    aggregation: 'sum',
    unit: '台',
  },
  [STAT_METRICS.DEVICES_ONLINE_RATE]: {
    key: STAT_METRICS.DEVICES_ONLINE_RATE,
    label: '设备在线率',
    frequency: 'hourly',
    aggregation: 'rate',
    unit: '%',
  },
  [STAT_METRICS.ORDERS_COUNT]: {
    key: STAT_METRICS.ORDERS_COUNT,
    label: '订单数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '单',
  },
  [STAT_METRICS.ORDERS_REVENUE]: {
    key: STAT_METRICS.ORDERS_REVENUE,
    label: '订单营收',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '元',
  },
  [STAT_METRICS.FALL_EVENTS]: {
    key: STAT_METRICS.FALL_EVENTS,
    label: '跌倒事件',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '次',
  },
  [STAT_METRICS.SOS_EVENTS]: {
    key: STAT_METRICS.SOS_EVENTS,
    label: 'SOS 事件',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '次',
  },
  [STAT_METRICS.ALERTS_COUNT]: {
    key: STAT_METRICS.ALERTS_COUNT,
    label: '告警总数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '条',
  },
  [STAT_METRICS.ALERTS_HANDLED]: {
    key: STAT_METRICS.ALERTS_HANDLED,
    label: '已处置告警',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '条',
  },
  [STAT_METRICS.DIALOG_SESSIONS]: {
    key: STAT_METRICS.DIALOG_SESSIONS,
    label: 'AI 对话会话数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '次',
  },
  [STAT_METRICS.DIALOG_CRISIS]: {
    key: STAT_METRICS.DIALOG_CRISIS,
    label: '危机对话数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '次',
  },
  [STAT_METRICS.SERVICE_SATISFACTION]: {
    key: STAT_METRICS.SERVICE_SATISFACTION,
    label: '服务满意度',
    frequency: 'daily',
    aggregation: 'avg',
    unit: '分',
  },
  [STAT_METRICS.SUBSCRIPTION_ACTIVE]: {
    key: STAT_METRICS.SUBSCRIPTION_ACTIVE,
    label: '有效订阅数',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '个',
  },
  [STAT_METRICS.SUBSCRIPTION_REVENUE]: {
    key: STAT_METRICS.SUBSCRIPTION_REVENUE,
    label: '订阅营收',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '元',
  },
  [STAT_METRICS.PENDING_ALERTS]: {
    key: STAT_METRICS.PENDING_ALERTS,
    label: '待处理告警',
    frequency: 'realtime',
    aggregation: 'sum',
    unit: '条',
  },
  [STAT_METRICS.ATTENDANTS_ACTIVE]: {
    key: STAT_METRICS.ATTENDANTS_ACTIVE,
    label: '在岗护工',
    frequency: 'realtime',
    aggregation: 'sum',
    unit: '人',
  },
  [STAT_METRICS.COMPLAINTS_COUNT]: {
    key: STAT_METRICS.COMPLAINTS_COUNT,
    label: '投诉工单',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '条',
  },
  [STAT_METRICS.COMPLAINTS_RESOLVED]: {
    key: STAT_METRICS.COMPLAINTS_RESOLVED,
    label: '已处理投诉',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '条',
  },
  [STAT_METRICS.TRIAGE_SESSIONS]: {
    key: STAT_METRICS.TRIAGE_SESSIONS,
    label: 'AI 导诊工单',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '次',
  },
  [STAT_METRICS.DEVICES_LOW_BATTERY]: {
    key: STAT_METRICS.DEVICES_LOW_BATTERY,
    label: '低电设备',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '台',
  },
  [STAT_METRICS.MEDICATION_ADHERENCE_RATE]: {
    key: STAT_METRICS.MEDICATION_ADHERENCE_RATE,
    label: '用药依从率',
    frequency: 'daily',
    aggregation: 'rate',
    unit: '%',
  },
  [STAT_METRICS.ORDERS_COMPLETED]: {
    key: STAT_METRICS.ORDERS_COMPLETED,
    label: '完成订单',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '单',
  },
  [STAT_METRICS.ATTENDANT_ORDERS]: {
    key: STAT_METRICS.ATTENDANT_ORDERS,
    label: '护工接单',
    frequency: 'daily',
    aggregation: 'sum',
    unit: '单',
  },
};

/** 大盘总览默认展示的核心指标顺序 */
export const OVERVIEW_METRICS: string[] = [
  STAT_METRICS.RESIDENTS_COUNT,
  STAT_METRICS.DEVICES_COUNT,
  STAT_METRICS.DEVICES_ONLINE_RATE,
  STAT_METRICS.ORDERS_COUNT,
  STAT_METRICS.ORDERS_REVENUE,
  STAT_METRICS.FALL_EVENTS,
  STAT_METRICS.SOS_EVENTS,
  STAT_METRICS.ALERTS_COUNT,
  STAT_METRICS.DIALOG_SESSIONS,
  STAT_METRICS.SUBSCRIPTION_REVENUE,
];

export function getMetricDef(metric: string): StatMetricDef | undefined {
  return STAT_METRIC_DEFS[metric];
}

export function isKnownMetric(metric: string): boolean {
  return metric in STAT_METRIC_DEFS;
}
