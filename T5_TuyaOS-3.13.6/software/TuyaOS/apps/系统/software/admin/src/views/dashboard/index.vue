<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, GaugeChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, GridComponent,
  LegendComponent, DataZoomComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { get } from '@/api/request'
import { getAttendantList, getScheduleList } from '@/api/attendant'
import { getConsultations } from '@/api/consultation'
import { getDashboardLiveBoard } from '@/api/order'
import { getReminders } from '@/api/medication-reminder'
import { getDashboardOverviewApi, type DashboardOverview } from '@/api/dashboard'
import { ORDER_STATUS_META, SERVICE_STAGES, type OrderStatusKey } from '@/constants/order-status'
import { formatLocalDate } from '@/utils/date'

echarts.use([
  LineChart, BarChart, GaugeChart,
  TitleComponent, TooltipComponent, GridComponent,
  LegendComponent, DataZoomComponent, CanvasRenderer
])

const router = useRouter()
const loading = ref(true)
const now = new Date()
const currentTime = ref(formatTime(now))
const todayDate = formatLocalDate(new Date())
const isFullscreen = ref(false)

// ── 定时刷新 ──
let refreshTimer: ReturnType<typeof setInterval>
let clockTimer: ReturnType<typeof setInterval>
let liveTimer: ReturnType<typeof setInterval>
let consultationTimer: ReturnType<typeof setInterval>

// ── 统计数据 ──
const stats = ref({
  todayOrders: 0, pendingTasks: 0,
  monthIncome: 0, activeAttendants: 0,
  totalOrders: 0, monthOrders: 0,
})

// ── 仪表板 Overview（升级版：环比/评价/业绩榜/审计） ──
const overview = ref<DashboardOverview | null>(null)

// ── 订单流程实时监控 ──
const ORDER_STEPS = (Object.keys(ORDER_STATUS_META) as OrderStatusKey[]).map((key) => ({
  key,
  label: ORDER_STATUS_META[key].label,
  color: ORDER_STATUS_META[key].color,
}))
const statusCounts = ref<Record<string, number>>({})

// 进行中订单（非终态）
const activeOrders = ref<any[]>([])

// ── 陪诊员本周日程 ──
const weekSchedule = ref<{ date: string; label: string; schedules: any[] }[]>([])
const attendantMap = ref<Record<number, string>>({})

// ── 今日用药提醒 ──
const todayReminders = ref<any[]>([])
const pendingConsultations = ref<any[]>([])
const pendingConsultationTotal = ref(0)
let consultationNotificationReady = false
let knownPendingConsultationIds = new Set<number>()
let consultationPolling = false

// ── 图表 ──
const trendChartRef = ref<HTMLElement>()
const statusChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let statusChart: echarts.ECharts | null = null

// 只展示进行中（非已完成/已取消）
const liveOrders = computed(() =>
  activeOrders.value.filter(o => !['completed', 'canceled'].includes(o.status))
)
const monitorOverview = computed(() => ({
  onTheWay: liveOrders.value.filter(o => ['pending_sign', 'pending_grab'].includes(o.status)).length,
  waitingService: liveOrders.value.filter(o => o.status === 'pending_service').length,
  inService: liveOrders.value.filter(o => o.status === 'in_progress').length,
  emergency: liveOrders.value.filter(o => o.status === 'emergency').length,
}))
const serviceBoardOrders = computed(() => {
  const priority: Record<string, number> = {
    emergency: 1,
    in_progress: 2,
    pending_service: 3,
    pending_sign: 4,
    pending_grab: 5,
    pending_accept: 6,
    pending_dispatch: 7,
    pending_review: 8,
  }
  return [...liveOrders.value]
    .sort((a, b) => {
      const pa = priority[a.status] ?? 99
      const pb = priority[b.status] ?? 99
      if (pa !== pb) return pa - pb
      const ta = new Date(a.serviceTime || a.createdAt || 0).getTime()
      const tb = new Date(b.serviceTime || b.createdAt || 0).getTime()
      return ta - tb
    })
    .slice(0, 10)
})

// ── 工具函数 ──
function formatTime(d: Date) {
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function getWeekDates() {
  const days: { date: string; label: string }[] = []
  const d = new Date()
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1
  for (let i = 0; i < 7; i++) {
    const t = new Date(d)
    t.setDate(d.getDate() - day + i)
    days.push({
      date: formatLocalDate(t),
      label: (['一','二','三','四','五','六','日'][i] as string),
    })
  }
  return days
}

function statusLabel(s: string) {
  return ORDER_STEPS.find(x => x.key === s)?.label ?? s
}
function statusTone(s: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (s === 'in_progress') return 'success'
  if (s === 'emergency') return 'danger'
  if (['pending_sign', 'pending_service', 'pending_grab'].includes(s)) return 'warning'
  return 'info'
}
function getStageIndex(status: string) {
  return ORDER_STATUS_META[status as OrderStatusKey]?.stageIndex ?? 0
}
function customerName(order: any) {
  return order.serviceTarget?.name || order.user?.nickname || `客户#${order.userId ?? '--'}`
}
function customerLocation(order: any) {
  const place = [order.hospital, order.department].filter(Boolean).join(' · ')
  return place || order.serviceAddress || '位置待补充'
}
function locationLabel(order: any) {
  if (order.status === 'emergency') return '异常处理中'
  if (order.status === 'in_progress') return '院内服务中'
  if (order.status === 'pending_service') return '已签到待服务'
  if (order.status === 'pending_sign') return '赶赴医院中'
  if (order.status === 'pending_grab') return '待接单'
  if (order.status === 'pending_accept') return '待陪诊员确认'
  if (order.status === 'pending_dispatch') return '待分配'
  return '服务收尾'
}
function formatServiceTime(value?: string) {
  if (!value) return '时间待定'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '时间待定'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}
function formatTimelineTime(value?: string | Date) {
  if (!value) return '--:--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}
function moneyYuan(v: number) {
  return `¥${Math.round((v || 0) / 100)}`
}
function deltaClass(v: number | null | undefined) {
  if (v == null) return 'delta-muted'
  if (v > 0) return 'delta-up'
  if (v < 0) return 'delta-down'
  return 'delta-flat'
}
function deltaText(v: number | null | undefined) {
  if (v == null) return '—'
  if (v === 0) return '持平'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v}%`
}
function formatRating(v: number | null | undefined) {
  if (v == null) return '--'
  return v.toFixed(2)
}
function consultationMethodLabel(type?: string) {
  return type === 'online' ? '线上咨询' : '到店咨询'
}
function consultationServiceLabel(serviceInterest?: string) {
  const labels: Record<string, string> = {
    checkup: '体检规划',
    expert: '专家匹配',
    escort: '陪诊服务',
    consult: '门诊咨询',
    store: '到店预约',
    fetch: '代取报告',
  }
  if (!serviceInterest) return '预约咨询'
  return labels[serviceInterest] || serviceInterest
}
function consultationQuery(item?: any) {
  const query: Record<string, string> = {
    view: 'list',
    status: 'unconsulted',
    from: 'dashboard',
  }
  if (item?.appointmentDate) query.date = String(item.appointmentDate)
  if (item?.serviceInterest) query.serviceInterest = String(item.serviceInterest)
  if (item?.id) query.focusId = String(item.id)
  return query
}
function openConsultationCenter(item?: any) {
  router.push({ path: '/service/consultations', query: consultationQuery(item) })
}
function notifyNewConsultations(items: any[], total: number) {
  if (!items.length) return
  const first = items[0]
  const title = items.length === 1 ? '收到新的预约咨询' : `收到 ${items.length} 条新的预约咨询`
  const message = items.length === 1
    ? `${first?.name || '客户'} · ${consultationServiceLabel(first?.serviceInterest)} · ${consultationMethodLabel(first?.consultType)}`
    : `最新一条：${first?.name || '客户'} · ${consultationServiceLabel(first?.serviceInterest)}，当前待处理共 ${total} 条`
  ElNotification({
    title,
    message,
    type: 'warning',
    duration: 9000,
    onClick: () => openConsultationCenter(first),
  })
}
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  document.body.style.overflow = isFullscreen.value ? 'hidden' : ''
}

// ── 加载数据 ──
async function loadDashboard() {
  try {
    const [dashStats, trendData, attendantsRes, remindersRes, overviewData] = await Promise.all([
      get('/orders/stats/dashboard').catch(() => ({})) as Promise<any>,
      get('/orders/stats/trend', { days: 7 }).catch(() => []) as Promise<any>,
      getAttendantList({ page: 1, pageSize: 50, status: 'active' }),
      getReminders({ page: 1, pageSize: 100, status: 'active' }).catch(() => ({ items: [] })) as Promise<any>,
      getDashboardOverviewApi().catch(() => null),
    ])

    overview.value = overviewData

    // 统计卡片
    stats.value = {
      todayOrders:      dashStats.todayOrders   ?? 0,
      pendingTasks:     dashStats.pendingOrders  ?? 0,
      monthIncome:      dashStats.monthIncome    ?? 0,
      activeAttendants: attendantsRes?.total     ?? 0,
      totalOrders:      dashStats.totalOrders    ?? 0,
      monthOrders:      dashStats.monthOrders    ?? 0,
    }

    // 各状态计数
    statusCounts.value = dashStats.statusCounts ?? {}

    // 陪诊员 id→name 映射
    attendantMap.value = Object.fromEntries(
      (attendantsRes?.items ?? []).map((a: any) => [a.id, a.realName || '陪诊员'])
    )

    // 进行中订单（抓取前30条活跃订单）
    await loadLiveOrders()

    // 今日用药提醒
    todayReminders.value = (remindersRes?.items ?? []).slice(0, 20)

    // 待处理预约咨询
    await loadPendingConsultations()

    // 本周日程
    await loadWeekSchedule()

    // 图表
    await nextTick()
    initTrendChart(Array.isArray(trendData) ? trendData : [])
    initStatusChart(dashStats?.statusCounts ?? {})
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadLiveOrders() {
  activeOrders.value = await getDashboardLiveBoard({ limit: 30 }).catch(() => []) as any[]
}

async function loadPendingConsultations() {
  if (consultationPolling) return
  consultationPolling = true
  const res: any = await getConsultations({
    status: 'unconsulted',
    page: 1,
    pageSize: 6,
  }).catch(() => ({ items: [], total: 0 }))
  try {
    const items = Array.isArray(res?.items) ? res.items : []
    const total = Number(res?.total ?? items.length ?? 0)
    const nextIds = new Set<number>(
      items
        .map((item: any) => Number(item?.id))
        .filter((id: number) => Number.isFinite(id) && id > 0),
    )

    if (consultationNotificationReady) {
      const freshItems = items.filter((item: any) => !knownPendingConsultationIds.has(Number(item?.id)))
      if (freshItems.length) {
        notifyNewConsultations(freshItems, total)
      }
    }

    knownPendingConsultationIds = nextIds
    consultationNotificationReady = true
    pendingConsultations.value = items
    pendingConsultationTotal.value = total
  } finally {
    consultationPolling = false
  }
}

async function loadWeekSchedule() {
  const dates = getWeekDates()
  const startDate = dates[0]!.date
  const endDate   = dates[6]!.date
  try {
    const rawSchedules: any[] = await getScheduleList({ startDate, endDate }) ?? []
    const dateStr = (s: any) => typeof s.date === 'string' ? s.date.slice(0, 10) : s.date?.toISOString?.().slice(0, 10)
    weekSchedule.value = dates.map(d => ({
      ...d,
      schedules: rawSchedules
        .filter((s: any) => dateStr(s) === d.date)
        .map((s: any) => ({
          ...s,
          attendantName: s.attendant?.realName ?? attendantMap.value[s.attendantId] ?? `陪诊员${s.attendantId}`,
        })),
    }))
  } catch {
    weekSchedule.value = dates.map(d => ({ ...d, schedules: [] }))
  }
}

// ── ECharts ──
function initTrendChart(data: { date: string; count: number; income: number }[]) {
  if (!trendChartRef.value) return
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)
  const days: string[] = []
  const orders: number[] = []
  const incomes: number[] = []
  if (data.length) {
    data.forEach(d => {
      days.push(d.date.slice(5))
      orders.push(d.count)
      incomes.push(Number(d.income || 0))
    })
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days.push(`${d.getMonth()+1}/${d.getDate()}`)
      orders.push(0); incomes.push(0)
    }
  }
  trendChart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#71717a' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['订单量', '收入(元)'], textStyle: { color: '#52525b' }, top: 4 },
    grid: { left: 48, right: 56, bottom: 26, top: 40 },
    xAxis: {
      type: 'category',
      data: days,
      axisLabel: { color: '#71717a' },
      axisLine: { lineStyle: { color: '#e4e4e7' } },
      axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: '订单', nameTextStyle: { color: '#a1a1aa', fontSize: 11 }, axisLabel: { color: '#71717a' }, splitLine: { lineStyle: { color: '#f4f4f5' } } },
      { type: 'value', name: '收入', nameTextStyle: { color: '#a1a1aa', fontSize: 11 }, axisLabel: { color: '#71717a', formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: '订单量', type: 'bar', data: orders, barWidth: 14, itemStyle: { color: '#2e86f0', borderRadius: [6,6,0,0] } },
      { name: '收入(元)', type: 'line', yAxisIndex: 1, data: incomes, smooth: true, lineStyle: { color: '#2bbfa6', width: 2 }, itemStyle: { color: '#2bbfa6' }, symbolSize: 6, areaStyle: { color: 'rgba(46,134,240,0.1)' } },
    ],
  }, true)
}

function initStatusChart(counts: Record<string, number>) {
  if (!statusChartRef.value) return
  if (!statusChart) statusChart = echarts.init(statusChartRef.value)
  const data = ORDER_STEPS
    .filter(s => (counts[s.key] ?? 0) > 0)
    .map(s => ({ name: s.label, value: counts[s.key] ?? 0, itemStyle: { color: s.color } }))
  if (!data.length) data.push({ name: '暂无数据', value: 1, itemStyle: { color: '#e4e4e7' } })
  statusChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['50%', '52%'],
      data,
      label: { color: '#52525b', fontSize: 11 },
      labelLine: { lineStyle: { color: '#d4d4d8' } },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.08)' } },
    }],
  }, true)
}

function handleResize() {
  trendChart?.resize()
  statusChart?.resize()
}

onMounted(async () => {
  await loadDashboard()
  window.addEventListener('resize', handleResize)
  refreshTimer = setInterval(loadDashboard, 30_000)   // 30秒自动刷新
  liveTimer = setInterval(loadLiveOrders, 10_000)      // 10秒拉取实时服务卡
  consultationTimer = setInterval(loadPendingConsultations, 15_000)
  clockTimer   = setInterval(() => { currentTime.value = formatTime(new Date()) }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.body.style.overflow = ''
  clearInterval(refreshTimer)
  clearInterval(liveTimer)
  clearInterval(consultationTimer)
  clearInterval(clockTimer)
  trendChart?.dispose()
  statusChart?.dispose()
})
</script>

<template>
  <div
    class="cockpit"
    :class="{ 'page-fullscreen': isFullscreen }"
    v-loading="loading"
  >

    <!-- ══ 顶栏 ══ -->
    <header class="cockpit-header">
      <div class="header-logo">运营工作台</div>
      <div class="header-meta">
        <div class="header-time">{{ currentTime }}</div>
        <div class="header-actions">
          <el-button size="small" @click="toggleFullscreen">
            <el-icon style="margin-right:4px;"><FullScreen /></el-icon>
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </el-button>
          <el-button size="small" @click="loadDashboard">
            <el-icon style="margin-right:4px;"><Refresh /></el-icon>刷新
          </el-button>
        </div>
      </div>
    </header>

    <!-- ══ 顶部 5 核心指标 ══ -->
    <section class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-body">
          <div class="kpi-label">今日新单</div>
          <div class="kpi-value">
            {{ stats.todayOrders }}<span class="kpi-unit">单</span>
          </div>
          <div class="kpi-delta" v-if="overview">
            <span :class="deltaClass(overview.kpis.ordersDoD)">
              {{ deltaText(overview.kpis.ordersDoD) }}
            </span>
            <span class="kpi-delta-label">vs 昨日 {{ overview.kpis.yesterdayOrders }} 单</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-body">
          <div class="kpi-label">待处理</div>
          <div class="kpi-value">
            {{ stats.pendingTasks }}<span class="kpi-unit">单</span>
          </div>
          <div class="kpi-delta" v-if="overview">
            <span class="delta-muted">应急 {{ overview.operations.emergencyNow }}</span>
            <span class="kpi-delta-label">未收款 {{ overview.operations.unpaidOrders }}</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-body">
          <div class="kpi-label">本月收入</div>
          <div class="kpi-value">
            {{ moneyYuan(stats.monthIncome) }}
          </div>
          <div class="kpi-delta" v-if="overview">
            <span :class="deltaClass(overview.kpis.incomeMoM)">
              {{ deltaText(overview.kpis.incomeMoM) }}
            </span>
            <span class="kpi-delta-label">vs 上月 {{ moneyYuan(overview.kpis.lastMonthIncome) }}</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-body">
          <div class="kpi-label">活跃陪诊员</div>
          <div class="kpi-value">
            {{ stats.activeAttendants }}<span class="kpi-unit">人</span>
          </div>
          <div class="kpi-delta" v-if="overview">
            <span class="delta-muted">近 30 天完成 {{ overview.operations.completedLast30 }}</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-body">
          <div class="kpi-label">累计订单</div>
          <div class="kpi-value">
            {{ stats.totalOrders }}<span class="kpi-unit">单</span>
          </div>
          <div class="kpi-delta" v-if="overview">
            <span class="delta-muted">近 24 小时 {{ overview.kpis.last24hCreatedOrders }} 单</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ 运营概览（评价 / 业绩 / 审计） ══ -->
    <section v-if="overview" class="overview-grid">
      <!-- 评价概况 -->
      <div class="panel overview-panel">
        <div class="panel-title">
          <span class="dot dot-purple"></span>
          近 30 天客户评价
          <span class="badge-count">{{ overview.reviews.last30Count }} 条</span>
        </div>
        <div class="rating-stats">
          <div class="rating-figure">
            <div class="rating-score">{{ formatRating(overview.reviews.avgRating) }}</div>
            <div class="rating-score-label">平均分</div>
          </div>
          <div class="rating-bars">
            <div class="rating-row">
              <span class="rating-row-label">好评率</span>
              <span class="rating-row-value">
                {{ overview.reviews.goodReviewRate != null ? `${overview.reviews.goodReviewRate}%` : '—' }}
              </span>
            </div>
            <div class="rating-row">
              <span class="rating-row-label">差评数（≤2 星）</span>
              <span class="rating-row-value" :class="{ 'warn': overview.reviews.lowRatingCount > 0 }">
                {{ overview.reviews.lowRatingCount }}
              </span>
            </div>
            <div class="rating-row">
              <span class="rating-row-label">评价总数</span>
              <span class="rating-row-value">{{ overview.reviews.last30Count }}</span>
            </div>
          </div>
        </div>
        <div v-if="overview.reviews.recentLow.length" class="low-review-list">
          <div class="low-review-title">最近差评</div>
          <div
            v-for="r in overview.reviews.recentLow"
            :key="r.id"
            class="low-review-item"
            @click="r.orderId && router.push(`/service/orders/detail/${r.orderId}`)"
          >
            <div class="low-review-head">
              <span class="low-review-rating">{{ '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) }}</span>
              <span class="low-review-order">{{ r.orderNumber || `#${r.orderId}` }}</span>
            </div>
            <div class="low-review-comment">{{ r.comment || '（无文字评价）' }}</div>
          </div>
        </div>
      </div>

      <!-- 陪诊员业绩 TOP 榜 -->
      <div class="panel overview-panel">
        <div class="panel-title">
          <span class="dot dot-green"></span>
          近 30 天陪诊员 TOP 5
        </div>
        <div v-if="overview.topAttendants.length" class="top-attendants">
          <div
            v-for="(a, idx) in overview.topAttendants"
            :key="a.attendantId"
            class="top-attendant-item"
            @click="router.push(`/dispatch/attendants/detail/${a.attendantId}`)"
          >
            <div class="top-rank" :class="`rank-${idx + 1}`">{{ idx + 1 }}</div>
            <el-avatar :size="34" :src="a.avatar || undefined">
              {{ (a.attendantName || '').slice(0, 1) }}
            </el-avatar>
            <div class="top-attendant-info">
              <div class="top-attendant-name">{{ a.attendantName }}</div>
              <div class="top-attendant-meta">
                <span>{{ a.orderCount }} 单</span>
                <span>{{ moneyYuan(a.totalFee) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-text">暂无数据</div>
      </div>

      <!-- 运维/审计告警 -->
      <div class="panel overview-panel">
        <div class="panel-title">
          <span class="dot dot-red"></span>
          运营 &amp; 安全告警
        </div>
        <div class="alert-grid">
          <div
            class="alert-cell"
            :class="{ 'alert-cell--warn': overview.operations.pendingFinanceRecords > 0 }"
            @click="router.push('/finance/review')"
          >
            <div class="alert-cell-value">{{ overview.operations.pendingFinanceRecords }}</div>
            <div class="alert-cell-label">待审核报销</div>
          </div>
          <div
            class="alert-cell"
            :class="{ 'alert-cell--warn': overview.operations.pendingSettlementOrders > 0 }"
            @click="router.push('/finance/settlement')"
          >
            <div class="alert-cell-value">{{ overview.operations.pendingSettlementOrders }}</div>
            <div class="alert-cell-label">待结算订单</div>
          </div>
          <div
            class="alert-cell"
            :class="{ 'alert-cell--danger': overview.operations.emergencyNow > 0 }"
            @click="router.push('/service/orders?status=emergency')"
          >
            <div class="alert-cell-value">{{ overview.operations.emergencyNow }}</div>
            <div class="alert-cell-label">紧急订单</div>
          </div>
          <div
            class="alert-cell"
            :class="{ 'alert-cell--danger': overview.audit.last24hLoginFailures >= 5 }"
            @click="router.push('/system/audit-logs')"
          >
            <div class="alert-cell-value">{{ overview.audit.last24hLoginFailures }}</div>
            <div class="alert-cell-label">24h 登录失败</div>
          </div>
          <div class="alert-cell" @click="router.push('/system/audit-logs')">
            <div class="alert-cell-value">{{ overview.audit.last24hAdminActions }}</div>
            <div class="alert-cell-label">24h 管理员操作</div>
          </div>
          <div
            class="alert-cell"
            :class="{ 'alert-cell--warn': overview.operations.unpaidOrders > 0 }"
            @click="router.push('/service/orders?paymentStatus=unpaid')"
          >
            <div class="alert-cell-value">{{ overview.operations.unpaidOrders }}</div>
            <div class="alert-cell-label">未收款订单</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ 陪诊员本周日程（全宽独立区域） ══ -->
    <section class="schedule-section">
      <div class="panel panel-schedule">
        <div class="panel-title">
          <span class="dot dot-yellow"></span>
          陪诊员本周日程
        </div>
        <div class="schedule-week schedule-week--spacious">
          <div
            class="schedule-day"
            v-for="day in weekSchedule"
            :key="day.date"
            :class="{ 'today': day.date === todayDate }"
          >
            <div class="day-header">
              <span class="day-label">周{{ day.label }}</span>
              <span class="day-date">{{ day.date.slice(5) }}</span>
              <span v-if="day.schedules.length" class="day-count">{{ day.schedules.length }}</span>
            </div>
            <div class="schedule-slots">
              <div
                class="slot-chip"
                v-for="(s, i) in day.schedules.slice(0, 6)"
                :key="i"
                :class="s.period"
              >
                <span class="slot-period">{{ s.period === 'morning' ? '上午' : s.period === 'afternoon' ? '下午' : '全天' }}</span>
                <span class="slot-name">{{ s.attendantName }}</span>
              </div>
              <div v-if="day.schedules.length > 6" class="slot-more">+{{ day.schedules.length - 6 }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ 中部 3 列布局 ══ -->
    <section class="main-grid">

      <!-- ─ 左列：实时订单流程监控 ─ -->
      <div class="panel panel-left">
        <div class="panel-title">
          <span class="dot dot-green"></span>
          陪诊订单实时监控
          <span class="badge-count">{{ liveOrders.length }} 单进行中</span>
        </div>

        <div class="monitor-overview">
          <div class="overview-item">
            <span class="overview-label">赶赴途中</span>
            <span class="overview-value">{{ monitorOverview.onTheWay }}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">已签到待服务</span>
            <span class="overview-value">{{ monitorOverview.waitingService }}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">院内服务中</span>
            <span class="overview-value">{{ monitorOverview.inService }}</span>
          </div>
          <div class="overview-item warning">
            <span class="overview-label">异常预警</span>
            <span class="overview-value">{{ monitorOverview.emergency }}</span>
          </div>
        </div>

        <div class="order-live-list">
          <div
            class="order-live-item"
            v-for="order in serviceBoardOrders"
            :key="order.id"
            @click="router.push(`/service/orders/detail/${order.id}`)"
          >
            <div class="order-head">
              <div class="order-customer">{{ customerName(order) }}</div>
              <el-tag :type="statusTone(order.status)" size="small">{{ statusLabel(order.status) }}</el-tag>
            </div>
            <div class="order-subline">
              <span class="order-no">{{ order.orderNumber }}</span>
              <span class="order-time">预约 {{ formatServiceTime(order.serviceTime) }}</span>
            </div>
            <div class="order-location">
              <span class="loc-dot"></span>
              <span class="loc-label">{{ locationLabel(order) }}</span>
              <span class="loc-place">{{ customerLocation(order) }}</span>
            </div>
            <div class="order-last-event">
              <span class="event-time">{{ formatTimelineTime(order.latestTimeline?.createdAt) }}</span>
              <span class="event-content">{{ order.latestTimeline?.content || '暂无最新节点' }}</span>
            </div>
            <div class="order-timeline">
              <div
                class="timeline-step"
                v-for="(stage, idx) in SERVICE_STAGES"
                :key="stage"
                :class="{
                  active: idx === getStageIndex(order.status),
                  done: idx < getStageIndex(order.status),
                }"
              >
                <span class="timeline-point"></span>
                <span class="timeline-label">{{ stage }}</span>
              </div>
            </div>
          </div>
          <el-empty v-if="!serviceBoardOrders.length" description="暂无进行中订单" :image-size="48" class="empty-dark" />
        </div>
      </div>

      <!-- ─ 中列：订单状态分布 + 近7天趋势 ─ -->
      <div class="panel panel-center">
        <div class="panel-title">
          <span class="dot dot-purple"></span>
          当前订单状态分布
        </div>
        <div ref="statusChartRef" class="chart-pie"></div>
        <div class="panel-title" style="margin-top:12px;">
          <span class="dot dot-blue"></span>
          近7天订单 & 收入
        </div>
        <div ref="trendChartRef" class="chart-trend chart-trend--compact"></div>
        <div class="revenue-summary">
          <span>本月 ¥{{ Math.round((stats.monthIncome || 0) / 100) }}</span>
        </div>
      </div>

      <!-- ─ 右列：预约咨询 + 用药提醒 + 快捷操作 ─ -->
      <div class="panel panel-right">
        <div class="panel-title">
          <span class="dot dot-yellow"></span>
          待处理预约咨询
          <span class="badge-count">{{ pendingConsultationTotal }} 条</span>
        </div>
        <div class="consultation-list">
          <div
            class="consultation-item"
            v-for="item in pendingConsultations"
            :key="item.id"
            @click="openConsultationCenter(item)"
          >
            <div class="consultation-item__head">
              <div class="consultation-item__name">{{ item.name || '未留名客户' }}</div>
              <el-tag size="small" type="warning" effect="dark">
                {{ consultationMethodLabel(item.consultType) }}
              </el-tag>
            </div>
            <div class="consultation-item__meta">
              <span>{{ consultationServiceLabel(item.serviceInterest) }}</span>
              <span>{{ item.consultCategory || '预约咨询' }}</span>
            </div>
            <div class="consultation-item__time">
              <span>{{ item.appointmentDate || '日期待定' }} {{ item.appointmentTime || '' }}</span>
              <span class="consultation-item__action">查看</span>
            </div>
          </div>
          <div v-if="!pendingConsultations.length" class="empty-text">暂无待处理预约咨询</div>
        </div>

        <!-- 用药提醒（匹配对应用户） -->
        <div class="panel-title" style="margin-top:12px;">
          <span class="dot dot-red"></span>
          用药提醒（按用户）
          <span class="badge-count">{{ todayReminders.length }} 条</span>
        </div>
        <div class="reminder-list">
          <div
            class="reminder-item"
            v-for="r in todayReminders.slice(0, 8)"
            :key="r.id"
          >
            <div class="reminder-icon">💊</div>
            <div class="reminder-body">
              <div class="reminder-user">{{ r.serviceTarget?.name || r.user?.nickname || r.user?.phone || '用户' }}</div>
              <div class="reminder-name">{{ r.medicineName || r.medicine_name || '药品' }}</div>
              <div class="reminder-meta">
                <span>{{ r.dosage }}</span>
                <span class="reminder-freq">{{ r.frequency }}</span>
                <span v-if="(r.reminderTimes || r.reminder_times)?.length" class="reminder-times">{{ Array.isArray(r.reminderTimes || r.reminder_times) ? (r.reminderTimes || r.reminder_times).join(' / ') : '' }}</span>
              </div>
            </div>
            <el-tag size="small" type="success" effect="dark">进行中</el-tag>
          </div>
          <div v-if="!todayReminders.length" class="empty-text">暂无活跃提醒</div>
        </div>

      </div>
    </section>

  </div>
</template>

<style scoped lang="scss">
// ═══════════════════════════════════════════════════════════════
// 运营工作台 · shadcn / Linear 浅色风
// ═══════════════════════════════════════════════════════════════
.cockpit {
  min-height: calc(100vh - 56px);
  background: transparent;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #09090b;

  * { box-sizing: border-box; }
}
.page-fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 3000;
  margin: 0;
  padding: 24px 28px;
  overflow: auto;
  background: #fafafa;
}

.cockpit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0;
  border-bottom: none;
  margin-bottom: 20px;
}
.header-logo {
  font-size: 22px;
  font-weight: 600;
  color: #09090b;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.header-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.header-time {
  font-size: 13px;
  font-weight: 500;
  color: #71717a;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

// ── KPI 卡片 ──
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.kpi-card {
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: default;
  box-shadow: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: #d4d4d8;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06);
  }
}
.kpi-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.kpi-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.1;
  color: #09090b;
  letter-spacing: -0.02em;
}
.kpi-unit {
  font-size: 13px;
  font-weight: 500;
  margin-left: 3px;
  color: #71717a;
}
.kpi-label {
  font-size: 12px;
  color: #71717a;
  font-weight: 500;
}
.kpi-delta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  margin-top: 2px;
  color: #71717a;
}
.kpi-delta-label {
  color: #a1a1aa;
  font-weight: 500;
}
.delta-up { color: #10b981; font-weight: 600; }
.delta-down { color: #dc2626; font-weight: 600; }
.delta-flat { color: #71717a; font-weight: 600; }
.delta-muted { color: #52525b; font-weight: 500; }

// ── 运营概览（升级版） ──
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.overview-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rating-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}
.rating-figure {
  text-align: center;
  padding: 12px 18px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 10px;
  min-width: 96px;
}
.rating-score {
  font-size: 26px;
  font-weight: 700;
  color: #92400e;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.rating-score-label {
  font-size: 11px;
  color: #a16207;
  margin-top: 4px;
  font-weight: 500;
}
.rating-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rating-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #52525b;
}
.rating-row-label { color: #71717a; }
.rating-row-value { font-weight: 600; color: #09090b; }
.rating-row-value.warn { color: #dc2626; }

.low-review-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}
.low-review-title {
  font-size: 12px;
  color: #71717a;
  font-weight: 600;
}
.low-review-item {
  padding: 8px 10px;
  background: #fef2f2;
  border-left: 3px solid #fecaca;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.18s ease;

  &:hover {
    border-left-color: #ef4444;
  }
}
.low-review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}
.low-review-rating { color: #f59e0b; letter-spacing: 1px; }
.low-review-order {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #91151c;
  font-weight: 500;
}
.low-review-comment {
  margin-top: 4px;
  font-size: 12px;
  color: #991b1b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-attendants {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.top-attendant-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fafafa;
  border: 1px solid #e4e4e7;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:hover {
    border-color: #2e86f0;
    background: rgba(46, 134, 240, 0.05);
  }
}
.top-rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #71717a;
  background: #e4e4e7;
  flex-shrink: 0;

  &.rank-1 { background: #fde68a; color: #92400e; }
  &.rank-2 { background: #e5e7eb; color: #374151; }
  &.rank-3 { background: #fed7aa; color: #9a3412; }
}
.top-attendant-info {
  flex: 1;
  min-width: 0;
}
.top-attendant-name {
  font-size: 13px;
  font-weight: 600;
  color: #09090b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.top-attendant-meta {
  display: flex;
  gap: 10px;
  margin-top: 2px;
  font-size: 11px;
  color: #71717a;
  font-variant-numeric: tabular-nums;
}

.alert-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.alert-cell {
  background: #fafafa;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:hover {
    border-color: #d4d4d8;
    background: #f4f4f5;
  }

  &--warn {
    background: #fffbeb;
    border-color: #fde68a;
    .alert-cell-value { color: #b45309; }
    .alert-cell-label { color: #92400e; }

    &:hover {
      border-color: #f59e0b;
    }
  }

  &--danger {
    background: #fef2f2;
    border-color: #fecaca;
    .alert-cell-value { color: #dc2626; }
    .alert-cell-label { color: #991b1b; }

    &:hover {
      border-color: #ef4444;
    }
  }
}
.alert-cell-value {
  font-size: 22px;
  line-height: 1;
  font-weight: 700;
  color: #09090b;
  letter-spacing: -0.02em;
}
.alert-cell-label {
  font-size: 11px;
  color: #71717a;
  font-weight: 500;
}

// ── 布局 ──
.schedule-section {
  margin-bottom: 16px;
}
.panel-schedule {
  min-width: 0;
}

.main-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr 0.9fr;
  gap: 16px;
  align-items: start;
}

// ── 面板 ──
.panel {
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  padding: 20px;
  box-shadow: none;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
  letter-spacing: -0.01em;
  margin-bottom: 14px;
}
.dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  &.dot-green  { background: #10b981; }
  &.dot-blue   { background: #3b82f6; }
  &.dot-yellow { background: #f59e0b; }
  &.dot-red    { background: #ef4444; }
  &.dot-purple { background: #2bbfa6; }
}
.badge-count {
  margin-left: auto;
  font-size: 11px;
  background: #f4f4f5;
  color: #52525b;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 500;
}

// ── Overview ──
.monitor-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.overview-item {
  border-radius: 8px;
  border: 1px solid #e4e4e7;
  background: #fafafa;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.overview-label {
  font-size: 11px;
  color: #71717a;
  font-weight: 500;
}
.overview-value {
  font-size: 22px;
  line-height: 1;
  font-weight: 600;
  color: #09090b;
  letter-spacing: -0.02em;
}
.overview-item.warning {
  background: #fef2f2;
  border-color: #fecaca;
  .overview-value { color: #dc2626; }
  .overview-label { color: #991b1b; }
}

// ── 订单实时卡片 ──
.order-live-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 544px;
  overflow-y: auto;
}
.order-live-item {
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: #c4b5fd;
    box-shadow: 0 1px 3px 0 rgb(94 106 210 / 0.08);
  }
}
.order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.order-customer {
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
  letter-spacing: -0.01em;
}
.order-subline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.order-no {
  color: #1f6fd6;
  font-weight: 500;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}
.order-time {
  color: #71717a;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.order-location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 8px;
}
.order-last-event {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 11px;
}
.event-time {
  color: #71717a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.event-content {
  color: #52525b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.loc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}
.loc-label {
  color: #10b981;
  white-space: nowrap;
  font-weight: 500;
}
.loc-place {
  color: #52525b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ── 订单阶段 timeline ──
.order-timeline {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}
.timeline-step {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.timeline-point {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid #e4e4e7;
  background: #ffffff;
  flex-shrink: 0;
}
.timeline-label {
  font-size: 10px;
  color: #a1a1aa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.timeline-step.done .timeline-point {
  border-color: #2e86f0;
  background: #2e86f0;
}
.timeline-step.done .timeline-label {
  color: #52525b;
}
.timeline-step.active .timeline-point {
  border-color: #2e86f0;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(46, 134, 240, 0.2);
}
.timeline-step.active .timeline-label {
  color: #09090b;
  font-weight: 600;
}

// ── 图表容器 ──
.chart-trend { height: 200px; }
.chart-trend--compact { height: 140px; }
.chart-pie   { height: 180px; }
.revenue-summary {
  margin-top: 4px;
  font-size: 12px;
  color: #71717a;
  font-weight: 500;
}

// ── 日程 ──
.schedule-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 0;
}
.schedule-week--spacious {
  min-height: 160px;
  gap: 10px;
  .schedule-day {
    min-height: 140px;
    padding: 10px 8px;
  }
  .day-header {
    margin-bottom: 8px;
  }
  .day-label { font-size: 12px; }
  .day-date { font-size: 11px; }
  .schedule-slots { gap: 4px; }
  .slot-chip {
    font-size: 11px;
    padding: 5px 8px;
  }
  .slot-period { font-size: 10px; }
  .slot-name { font-size: 11px; }
}
.schedule-day {
  background: #fafafa;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 6px 4px;
  min-height: 72px;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:hover {
    border-color: #d4d4d8;
    background: #f4f4f5;
  }

  &.today {
    border-color: #2e86f0;
    background: rgba(46, 134, 240, 0.06);
    .day-label { color: #1f6fd6; }
  }
}
.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 6px;
}
.day-label  { font-size: 12px; font-weight: 600; color: #09090b; letter-spacing: -0.005em; }
.day-date   { font-size: 11px; color: #71717a; font-variant-numeric: tabular-nums; }
.day-count  {
  font-size: 10px;
  background: #2e86f0;
  color: #fff;
  border-radius: 999px;
  padding: 1px 6px;
  margin-top: 4px;
  font-weight: 600;
}
.schedule-slots { display: flex; flex-direction: column; gap: 3px; }
.slot-chip {
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 10px;
  display: flex;
  flex-direction: column;
  line-height: 1.3;

  &.morning {
    background: #fffbeb;
    border-left: 2px solid #f59e0b;
  }
  &.afternoon {
    background: #eff6ff;
    border-left: 2px solid #3b82f6;
  }
  &.full_day {
    background: #f0fdf4;
    border-left: 2px solid #10b981;
  }
}
.slot-period { font-size: 10px; color: #71717a; font-weight: 500; }
.slot-name   { font-size: 11px; color: #09090b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.slot-more   { font-size: 10px; color: #71717a; text-align: center; font-weight: 500; }

// ── 咨询列表 ──
.consultation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 14px;
}
.consultation-item {
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: #fde68a;
    box-shadow: 0 1px 3px 0 rgb(245 158 11 / 0.08);
  }
}
.consultation-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.consultation-item__name {
  font-size: 13px;
  font-weight: 600;
  color: #09090b;
  letter-spacing: -0.005em;
}
.consultation-item__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11px;
  color: #71717a;
}
.consultation-item__time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
  color: #52525b;
  font-variant-numeric: tabular-nums;
}
.consultation-item__action {
  color: #1f6fd6;
  font-weight: 600;
}

// ── 提醒列表 ──
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.reminder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 10px 12px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: #d4d4d8;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.04);
  }
}
.reminder-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f4f5;
  border-radius: 6px;
}
.reminder-body { flex: 1; min-width: 0; }
.reminder-user {
  font-size: 11px;
  color: #71717a;
  margin-bottom: 2px;
  font-weight: 500;
}
.reminder-name {
  font-size: 13px;
  font-weight: 600;
  color: #09090b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.005em;
}
.reminder-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #71717a;
  margin-top: 2px;
}
.reminder-freq  { color: #1f6fd6; font-weight: 500; }
.reminder-times {
  color: #52525b;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.empty-text {
  text-align: center;
  color: #a1a1aa;
  font-size: 12px;
  padding: 20px;
}

// ── 滚动条（浅色） ──
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #e4e4e7;
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #d4d4d8;
}
</style>
