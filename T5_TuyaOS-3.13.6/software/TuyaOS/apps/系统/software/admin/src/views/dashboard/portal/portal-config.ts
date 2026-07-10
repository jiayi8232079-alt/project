import { STAT_METRICS } from '@/api/portal-dashboard'

export type PortalKey = 'platform' | 'government' | 'community' | 'enterprise'

export interface PortalConfig {
  key: PortalKey
  title: string
  subtitle: string
  /** 默认数据作用域：政府/机构默认看下属汇总，平台看全量下属 */
  defaultScope: 'self' | 'descendants'
  /** 设为非空则展示「租户数」卡片 */
  tenantCountLabel?: string
  /** 顶部 KPI 卡片指标顺序 */
  kpiMetrics: string[]
  /** 趋势图可切换的指标 */
  trendMetrics: string[]
  /** 是否展示中国地图 */
  showMap: boolean
  mapMetric?: string
  /** 是否展示下属排行 */
  showRank: boolean
  rankMetric?: string
  rankTitle?: string
  /** 主题色 */
  accent: string
}

export const PORTAL_CONFIGS: Record<PortalKey, PortalConfig> = {
  platform: {
    key: 'platform',
    title: '平台总览',
    subtitle: '全平台租户 / 设备 / 订单 / 告警 / 收入',
    defaultScope: 'descendants',
    tenantCountLabel: '租户总数',
    kpiMetrics: [
      STAT_METRICS.DEVICES_COUNT,
      STAT_METRICS.DEVICES_ONLINE_RATE,
      STAT_METRICS.ORDERS_COUNT,
      STAT_METRICS.ORDERS_REVENUE,
      STAT_METRICS.ALERTS_COUNT,
      STAT_METRICS.DIALOG_SESSIONS,
      STAT_METRICS.SUBSCRIPTION_REVENUE,
    ],
    trendMetrics: [
      STAT_METRICS.ORDERS_COUNT,
      STAT_METRICS.ORDERS_REVENUE,
      STAT_METRICS.ALERTS_COUNT,
      STAT_METRICS.DIALOG_SESSIONS,
    ],
    showMap: true,
    mapMetric: STAT_METRICS.DEVICES_COUNT,
    showRank: true,
    rankMetric: STAT_METRICS.ORDERS_REVENUE,
    rankTitle: 'Top 租户（按营收）',
    accent: '#1677ff',
  },
  government: {
    key: 'government',
    title: '辖区监管大盘',
    subtitle: '辖区养老机构 / 居民 / 告警 / 处置汇总（只读）',
    defaultScope: 'descendants',
    tenantCountLabel: '下属机构',
    kpiMetrics: [
      STAT_METRICS.RESIDENTS_COUNT,
      STAT_METRICS.DEVICES_COUNT,
      STAT_METRICS.DEVICES_ONLINE_RATE,
      STAT_METRICS.FALL_EVENTS,
      STAT_METRICS.SOS_EVENTS,
      STAT_METRICS.ALERTS_COUNT,
      STAT_METRICS.ALERTS_HANDLED,
    ],
    trendMetrics: [
      STAT_METRICS.FALL_EVENTS,
      STAT_METRICS.SOS_EVENTS,
      STAT_METRICS.ALERTS_COUNT,
    ],
    showMap: true,
    mapMetric: STAT_METRICS.ALERTS_COUNT,
    showRank: true,
    rankMetric: STAT_METRICS.ALERTS_COUNT,
    rankTitle: '机构排行（按告警数）',
    accent: '#fa8c16',
  },
  community: {
    key: 'community',
    title: '机构 / 站点大盘',
    subtitle: '本院与下属站点的居民 / 设备 / 服务 / 告警',
    defaultScope: 'descendants',
    tenantCountLabel: '下属站点',
    kpiMetrics: [
      STAT_METRICS.RESIDENTS_COUNT,
      STAT_METRICS.DEVICES_COUNT,
      STAT_METRICS.DEVICES_ONLINE_RATE,
      STAT_METRICS.ORDERS_COUNT,
      STAT_METRICS.ALERTS_COUNT,
      STAT_METRICS.ATTENDANTS_ACTIVE,
      STAT_METRICS.SERVICE_SATISFACTION,
    ],
    trendMetrics: [
      STAT_METRICS.ORDERS_COUNT,
      STAT_METRICS.ALERTS_COUNT,
      STAT_METRICS.DIALOG_SESSIONS,
    ],
    showMap: false,
    showRank: true,
    rankMetric: STAT_METRICS.ORDERS_COUNT,
    rankTitle: '站点对比（按服务量）',
    accent: '#52c41a',
  },
  enterprise: {
    key: 'enterprise',
    title: '渠道业绩大盘',
    subtitle: '下属代理 / 客户的订阅 / 营收 / 业绩',
    defaultScope: 'descendants',
    tenantCountLabel: '签约客户',
    kpiMetrics: [
      STAT_METRICS.SUBSCRIPTION_ACTIVE,
      STAT_METRICS.SUBSCRIPTION_REVENUE,
      STAT_METRICS.ORDERS_REVENUE,
      STAT_METRICS.DEVICES_COUNT,
      STAT_METRICS.RESIDENTS_COUNT,
    ],
    trendMetrics: [
      STAT_METRICS.SUBSCRIPTION_REVENUE,
      STAT_METRICS.ORDERS_REVENUE,
    ],
    showMap: false,
    showRank: true,
    rankMetric: STAT_METRICS.SUBSCRIPTION_REVENUE,
    rankTitle: '代理 / 客户排行（按订阅营收）',
    accent: '#722ed1',
  },
}
