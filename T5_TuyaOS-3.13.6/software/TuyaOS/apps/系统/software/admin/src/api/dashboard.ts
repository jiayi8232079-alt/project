import { get } from './request'

export interface DashboardOverview {
  updatedAt: string
  kpis: {
    todayOrders: number
    yesterdayOrders: number
    ordersDoD: number | null
    todayIncome: number
    yesterdayIncome: number
    incomeDoD: number | null
    monthIncome: number
    lastMonthIncome: number
    incomeMoM: number | null
    activeAttendants: number
    last24hCreatedOrders: number
  }
  operations: {
    completedLast30: number
    canceledLast30: number
    emergencyNow: number
    unpaidOrders: number
    pendingSettlementOrders: number
    pendingFinanceRecords: number
  }
  reviews: {
    last30Count: number
    avgRating: number
    lowRatingCount: number
    goodReviewRate: number | null
    recentLow: Array<{
      id: number
      orderId: number
      orderNumber: string
      rating: number
      comment: string
      createdAt: string | null
    }>
  }
  topAttendants: Array<{
    attendantId: number
    attendantName: string
    avatar: string | null
    orderCount: number
    totalFee: number
  }>
  audit: {
    last24hAdminActions: number
    last24hLoginFailures: number
  }
}

export function getDashboardOverviewApi() {
  return get<DashboardOverview>('/dashboard/overview')
}
