import service, { get } from './request'

/** 与后端 stat-metrics.ts 对齐的指标 key */
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
} as const

export type StatMetricKey = (typeof STAT_METRICS)[keyof typeof STAT_METRICS]

export type DashboardScope = 'self' | 'descendants' | 'tenant'

export interface DashboardQuery {
  scope?: DashboardScope
  tenantId?: number
  from?: string
  to?: string
}

export interface MetricDef {
  key: string
  label: string
  frequency: 'daily' | 'hourly' | 'realtime'
  aggregation: 'sum' | 'rate' | 'avg'
  unit?: string
}

export interface OverviewKpi {
  metric: string
  label: string
  unit: string | null
  value: number
}

export interface OverviewResult {
  range: { from: string; to: string }
  tenantCount: number
  kpis: OverviewKpi[]
}

export interface MetricResult {
  metric: string
  label: string
  unit: string | null
  aggregation: string
  total: number
  trend: { date: string; value: number }[]
  byTenant: { tenantId: number; tenantName: string; value: number }[]
}

export interface RankResult {
  metric: string
  label: string
  items: { tenantId: number; tenantName: string; scopeType: string; value: number }[]
}

export interface RegionMapResult {
  metric: string
  label: string
  regions: { regionCode: string; value: number }[]
}

export interface RealtimeResult {
  updatedAt: string
  metrics: { metric: string; label: string; unit: string | null; value: number }[]
}

export type BreakdownDim =
  | 'orders_by_service_type'
  | 'alerts_by_severity'
  | 'residents_by_age'

export interface BreakdownResult {
  dim: string
  items: { name: string; value: number }[]
}

export function getBreakdown(dim: BreakdownDim, params?: DashboardQuery) {
  return get<BreakdownResult>(`/dashboard/breakdown/${dim}`, normalize(params))
}

export function getMetricsCatalog() {
  return get<MetricDef[]>('/dashboard/metrics-catalog')
}

export function getPortalSummary(params?: DashboardQuery & { metrics?: string[] }) {
  return get<OverviewResult>('/dashboard/summary', normalize(params))
}

export function getMetricTrend(metric: string, params?: DashboardQuery) {
  return get<MetricResult>(`/dashboard/metric/${metric}`, normalize(params))
}

export function getMetricRank(metric: string, params?: DashboardQuery & { limit?: number }) {
  return get<RankResult>(`/dashboard/rank/${metric}`, normalize(params))
}

export function getRegionMap(metric: string, params?: DashboardQuery) {
  return get<RegionMapResult>('/dashboard/region-map', { metric, ...normalize(params) })
}

export function getRealtimeSnapshot(params?: DashboardQuery & { metrics?: string[] }) {
  return get<RealtimeResult>('/dashboard/realtime', normalize(params))
}

/** 触发一次手动聚合（首次进入大盘且无数据时可调用） */
export function runAggregate(granularity: 'daily' | 'hourly' | 'realtime' = 'daily') {
  return service.post('/dashboard/aggregate/run', { granularity })
}

/** CSV 导出（带鉴权头，返回 Blob 供前端下载） */
export async function exportDashboard(params: DashboardQuery & { metric?: string }) {
  const res = await service.get('/dashboard/export', {
    params: normalize(params),
    responseType: 'blob',
  })
  return res as unknown as Blob
}

function normalize<T extends object>(params?: T): Record<string, unknown> {
  if (!params) return {}
  const out: Record<string, unknown> = {}
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    out[k] = Array.isArray(v) ? v.join(',') : v
  })
  return out
}
