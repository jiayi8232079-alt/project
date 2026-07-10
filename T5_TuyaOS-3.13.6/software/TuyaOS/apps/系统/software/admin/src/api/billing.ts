import { del, get, patch, post } from './request'

export interface SubscriptionPlan {
  id: number
  code: string
  name: string
  category: 'device' | 'ai' | 'institution' | 'addon'
  billingCycle: 'monthly' | 'yearly' | 'one_time'
  price: number
  trialDays: number
  benefits: Record<string, unknown> | null
  description: string | null
  active: boolean
}

export interface Subscription {
  id: number
  planId: number
  userId: number
  deviceId: number | null
  status: 'trialing' | 'active' | 'paused' | 'grace' | 'canceled' | 'expired'
  startedAt: string
  currentPeriodEnd: string | null
  nextChargeAt: string | null
  autoRenew: boolean
  canceledAt: string | null
  cancelReason: string | null
  unitPriceSnapshot: number
  plan?: SubscriptionPlan
  device?: { id: number; name: string; tuyaDeviceId: string }
}

export interface Invoice {
  id: number
  userId: number
  type: 'personal' | 'enterprise'
  status: 'requested' | 'issued' | 'rejected' | 'voided'
  amount: number
  title: string
  taxNumber: string | null
  emailTo: string | null
  invoiceNo: string | null
  invoiceUrl: string | null
  requestedAt: string
  issuedAt: string | null
  rejectReason: string | null
  items: unknown[] | null
}

export function listPlans(category?: string) {
  return get<SubscriptionPlan[]>('/billing/plans', { category })
}

export function listSubscriptions(params?: {
  status?: string
  page?: number
  pageSize?: number
}) {
  return get<{ items: Subscription[]; total: number; page: number; pageSize: number }>(
    '/billing/subscriptions',
    params,
  )
}

export function createSubscription(data: {
  planId: number
  deviceId?: number
  autoRenew?: boolean
}) {
  return post<Subscription>('/billing/subscriptions', data)
}

export function getSubscription(id: number) {
  return get<Subscription>(`/billing/subscriptions/${id}`)
}

export function renewSubscription(id: number) {
  return post<Subscription>(`/billing/subscriptions/${id}/renew`)
}

export function cancelSubscription(id: number, reason?: string) {
  return post<Subscription>(`/billing/subscriptions/${id}/cancel`, { reason })
}

export function getMonthlyUsage(year?: number, month?: number) {
  return get<{ year: number; month: number; usage: Record<string, number> }>(
    '/billing/usage',
    { year, month },
  )
}

export function listInvoices(params?: { page?: number; pageSize?: number }) {
  return get<{ items: Invoice[]; total: number; page: number; pageSize: number }>(
    '/billing/invoices',
    params,
  )
}

export function adminListInvoices(params?: {
  status?: string
  page?: number
  pageSize?: number
}) {
  return get<{ items: Invoice[]; total: number; page: number; pageSize: number }>(
    '/billing/invoices/admin/all',
    params,
  )
}

export function createInvoice(data: {
  type: 'personal' | 'enterprise'
  title: string
  amount: number
  taxNumber?: string
  emailTo?: string
  items?: unknown[]
}) {
  return post<Invoice>('/billing/invoices', data)
}

export function issueInvoice(id: number, data: { invoiceNo: string; invoiceUrl: string }) {
  return patch<Invoice>(`/billing/invoices/${id}/issue`, data)
}

export function rejectInvoice(id: number, reason: string) {
  return patch<Invoice>(`/billing/invoices/${id}/reject`, { reason })
}

// ─────────────── 用量计费（运营后台） ───────────────

export type UsageMetric =
  | 'ai_dialog_call'
  | 'ai_token'
  | 'video_minute'
  | 'device_active_day'
  | 'report_generated'

export const USAGE_METRIC_LABELS: Record<UsageMetric, string> = {
  ai_dialog_call: 'AI 对话次数',
  ai_token: 'AI Token',
  video_minute: '视频通话(分钟)',
  device_active_day: '设备活跃天',
  report_generated: '报告生成次数',
}

export interface UsageSummary {
  year: number
  month: number
  byMetric: Record<string, number>
  amountByMetric: Record<string, number>
  totalQuantity: number
  totalAmount: number
  totalRecords: number
}

export interface UsageRecord {
  id: number
  tenantId: number
  userId: number
  subscriptionId: number | null
  deviceId: number | null
  metric: UsageMetric
  quantity: number
  unitPrice: number
  occurredAt: string
  sessionId: number | null
}

export function getUsageSummary(year?: number, month?: number) {
  return get<UsageSummary>('/billing/usage/admin/summary', { year, month })
}

export function listUsageRecords(params?: {
  metric?: UsageMetric
  from?: string
  to?: string
  page?: number
  pageSize?: number
}) {
  return get<{ items: UsageRecord[]; total: number; page: number; pageSize: number }>(
    '/billing/usage/admin/records',
    params,
  )
}

// ─────────────── 分账规则（运营后台） ───────────────

export type RevenueShareType = 'percentage' | 'flat' | 'tier'
export type RevenueShareScope = 'subscription' | 'order' | 'addon'

export interface RevenueShareRule {
  id: number
  tenantId: number
  partnerTenantId: number
  type: RevenueShareType
  scope: RevenueShareScope
  rate: number
  flatAmount: number
  priority: number
  settings: Record<string, unknown> | null
  validFrom: string | null
  validUntil: string | null
  active: boolean
  description: string | null
  createdAt: string
}

export interface SaveRevenueShareRulePayload {
  tenantId?: number
  partnerTenantId?: number
  type?: RevenueShareType
  scope?: RevenueShareScope
  rate?: number
  flatAmount?: number
  priority?: number
  settings?: Record<string, unknown>
  validFrom?: string
  validUntil?: string
  active?: boolean
  description?: string
}

export function listRevenueRules(params?: {
  scope?: RevenueShareScope
  partnerTenantId?: number
  tenantId?: number
  active?: boolean
}) {
  return get<RevenueShareRule[]>('/billing/revenue-share/rules', params)
}

export function createRevenueRule(payload: SaveRevenueShareRulePayload) {
  return post<RevenueShareRule>('/billing/revenue-share/rules', payload)
}

export function updateRevenueRule(id: number, payload: SaveRevenueShareRulePayload) {
  return patch<RevenueShareRule>(`/billing/revenue-share/rules/${id}`, payload)
}

export function toggleRevenueRule(id: number) {
  return patch<RevenueShareRule>(`/billing/revenue-share/rules/${id}/toggle`)
}

export function removeRevenueRule(id: number) {
  return del<{ success: boolean }>(`/billing/revenue-share/rules/${id}`)
}
