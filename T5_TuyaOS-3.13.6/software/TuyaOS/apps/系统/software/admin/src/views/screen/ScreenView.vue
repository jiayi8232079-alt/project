<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import autofit from 'autofit.js'
import ScreenPanel from '@/components/screen/ScreenPanel.vue'
import ScreenMap from '@/components/screen/ScreenMap.vue'
import { getTenantTree, type TenantTreeNode } from '@/api/tenant'
import {
  getPortalSummary,
  getMetricRank,
  getMetricTrend,
  getRegionMap,
  getBreakdown,
  type RankResult,
  type RegionMapResult,
} from '@/api/portal-dashboard'

const route = useRoute()
const router = useRouter()

const SCOPE_LABEL: Record<string, string> = {
  platform: '平台总览',
  government: '政府监管',
  organization: '机构',
  site: '站点 / 社区',
  enterprise: '渠道',
}

const SUMMARY_METRICS = [
  'residents_count',
  'devices_count',
  'devices_online',
  'devices_online_rate',
  'orders_count',
  'fall_events',
  'sos_events',
  'alerts_count',
  'pending_alerts',
  'dialog_sessions',
  'medication_adherence_rate',
  'service_satisfaction',
  'attendants_active',
  'complaints_count',
  'triage_sessions',
  'devices_low_battery',
  'orders_completed',
  'attendant_orders',
]

const tree = ref<TenantTreeNode[]>([])
const nodeMap = new Map<number, TenantTreeNode>()
const currentId = ref<number | null>(null)
const kpiMap = ref<Map<string, { label: string; unit: string | null; value: number }>>(new Map())
const rankData = ref<RankResult | null>(null)
const regionData = ref<RegionMapResult | null>(null)
const clock = ref(formatClock())
let clockTimer: ReturnType<typeof setInterval> | null = null

const ringEl = ref<HTMLDivElement | null>(null)
const barEl = ref<HTMLDivElement | null>(null)
const trendEl = ref<HTMLDivElement | null>(null)
const pieEl = ref<HTMLDivElement | null>(null)
const ringChart = shallowRef<echarts.ECharts | null>(null)
const barChart = shallowRef<echarts.ECharts | null>(null)
const trendChart = shallowRef<echarts.ECharts | null>(null)
const pieChart = shallowRef<echarts.ECharts | null>(null)

const currentNode = computed(() => (currentId.value ? nodeMap.get(currentId.value) ?? null : null))
const isLeaf = computed(() => (currentNode.value?.children?.length ?? 0) === 0)

const breadcrumb = computed(() => {
  const chain: TenantTreeNode[] = []
  let n = currentNode.value
  while (n) {
    chain.unshift(n)
    n = n.parentId ? nodeMap.get(n.parentId) ?? null : null
  }
  return chain
})

const mapAdcode = computed(() => {
  const code = currentNode.value?.regionCode
  if (!code) return '100000'
  return (String(code) + '000000').slice(0, 6)
})

const title = computed(() => currentNode.value?.name ?? '陪了个伴 · 全域监护大屏')
const scopeLabel = computed(() =>
  currentNode.value ? SCOPE_LABEL[currentNode.value.scopeType] ?? '' : '平台总览',
)

const kpiCards = computed(() => {
  const pick = (m: string, fallback: string, unit?: string) => {
    const k = kpiMap.value.get(m)
    return {
      key: m,
      label: k?.label ?? fallback,
      value: k?.value ?? 0,
      unit: k?.unit ?? unit ?? null,
    }
  }
  return [
    pick('residents_count', '居民总数'),
    pick('devices_count', '设备总数'),
    pick('devices_online_rate', '设备在线率', '%'),
    pick('pending_alerts', '待处理告警'),
    pick('fall_events', '跌倒事件'),
    pick('dialog_sessions', 'AI 陪伴对话'),
  ]
})

function formatClock(): string {
  const d = new Date()
  const p = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function formatValue(v: number, unit: string | null): string {
  if (unit === '%') return `${v}%`
  if (unit === '元') return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
  return v.toLocaleString('zh-CN')
}

function flatten(nodes: TenantTreeNode[]) {
  for (const n of nodes) {
    nodeMap.set(n.id, n)
    if (n.children?.length) flatten(n.children)
  }
}

function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - 29 * 24 * 3600 * 1000)
  const f = (d: Date) => {
    const p = (n: number) => `${n}`.padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  return { from: f(from), to: f(to) }
}

const query = computed(() => ({
  scope: 'descendants' as const,
  tenantId: currentId.value ?? undefined,
  ...defaultRange(),
}))

async function loadTree() {
  tree.value = await getTenantTree()
  nodeMap.clear()
  flatten(tree.value)
  const routeId = Number(route.params.tenantId)
  if (routeId && nodeMap.has(routeId)) {
    currentId.value = routeId
  } else {
    const root = tree.value.find((n) => n.scopeType === 'platform') ?? tree.value[0]
    currentId.value = root?.id ?? null
  }
}

async function loadData() {
  if (!currentId.value) return
  const [summary, rank, region] = await Promise.all([
    getPortalSummary({ ...query.value, metrics: SUMMARY_METRICS }),
    getMetricRank('residents_count', { ...query.value, limit: 8 }).catch(() => null),
    getRegionMap('devices_count', query.value).catch(() => null),
  ])
  const m = new Map<string, { label: string; unit: string | null; value: number }>()
  for (const k of summary?.kpis ?? []) m.set(k.metric, { label: k.label, unit: k.unit, value: k.value })
  kpiMap.value = m
  rankData.value = rank
  regionData.value = region
  await nextTick()
  renderRing()
  renderBar()
  loadTrend()
  loadPie()
}

async function loadPie() {
  try {
    const res = await getBreakdown('residents_by_age', query.value)
    if (!pieEl.value) return
    if (!pieChart.value) pieChart.value = echarts.init(pieEl.value)
    const palette = ['#1f78ff', '#5bd6ff', '#27e1a6', '#ffd666', '#ff9f7a', '#9f7aff']
    pieChart.value.setOption(
      {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { color: '#8fb4e8', fontSize: 11 } },
        series: [
          {
            type: 'pie',
            radius: ['40%', '66%'],
            center: ['50%', '44%'],
            label: { color: '#cfe2ff', fontSize: 11, formatter: '{b}\n{c}' },
            data: (res.items || []).map((it, i) => ({
              name: it.name,
              value: it.value,
              itemStyle: { color: palette[i % palette.length] },
            })),
          },
        ],
      },
      true,
    )
  } catch {
    // 构成图失败不阻塞
  }
}

function renderRing() {
  if (!ringEl.value) return
  if (!ringChart.value) ringChart.value = echarts.init(ringEl.value)
  const total = kpiMap.value.get('devices_count')?.value ?? 0
  const online = kpiMap.value.get('devices_online')?.value ?? 0
  const offline = Math.max(0, total - online)
  ringChart.value.setOption(
    {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#8fb4e8' } },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: false,
          label: { show: true, color: '#d7e8ff', formatter: '{b}\n{c}' },
          data: [
            { name: '在线', value: online, itemStyle: { color: '#27e1a6' } },
            { name: '离线', value: offline, itemStyle: { color: '#33507f' } },
          ],
        },
      ],
    },
    true,
  )
}

function renderBar() {
  if (!barEl.value) return
  if (!barChart.value) barChart.value = echarts.init(barEl.value)
  const rows: { label: string; value: number }[] = [
    { label: '用药依从率', value: kpiMap.value.get('medication_adherence_rate')?.value ?? 0 },
    { label: '服务满意度', value: kpiMap.value.get('service_satisfaction')?.value ?? 0 },
    { label: '跌倒事件', value: kpiMap.value.get('fall_events')?.value ?? 0 },
    { label: 'SOS 求助', value: kpiMap.value.get('sos_events')?.value ?? 0 },
    { label: 'AI 陪伴', value: kpiMap.value.get('dialog_sessions')?.value ?? 0 },
  ]
  barChart.value.setOption(
    {
      grid: { left: 90, right: 24, top: 10, bottom: 10 },
      xAxis: { type: 'value', axisLabel: { color: '#6b8bbd' }, splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } } },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.label),
        axisLabel: { color: '#9fc3f0' },
        axisLine: { lineStyle: { color: '#33507f' } },
      },
      series: [
        {
          type: 'bar',
          barWidth: 12,
          itemStyle: {
            borderRadius: 6,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#1f78ff' },
              { offset: 1, color: '#5bd6ff' },
            ]),
          },
          data: rows.map((r) => r.value),
        },
      ],
    },
    true,
  )
}

async function loadTrend() {
  try {
    const res = await getMetricTrend('fall_events', query.value)
    if (!trendEl.value) return
    if (!trendChart.value) trendChart.value = echarts.init(trendEl.value)
    trendChart.value.setOption(
      {
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 16, top: 24, bottom: 28 },
        xAxis: {
          type: 'category',
          data: res.trend.map((p) => p.date.slice(5)),
          axisLabel: { color: '#6b8bbd' },
          axisLine: { lineStyle: { color: '#33507f' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#6b8bbd' },
          splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } },
        },
        series: [
          {
            name: res.label,
            type: 'line',
            smooth: true,
            showSymbol: false,
            lineStyle: { width: 2, color: '#5bd6ff' },
            areaStyle: { opacity: 0.18, color: '#1f78ff' },
            data: res.trend.map((p) => p.value),
          },
        ],
      },
      true,
    )
  } catch {
    // 趋势失败不阻塞
  }
}

function onDrill(payload: { adcode: string; name: string }) {
  const node = currentNode.value
  if (!node?.children?.length) return
  const child = node.children.find((c) => {
    if (!c.regionCode) return c.name === payload.name
    return (String(c.regionCode) + '000000').slice(0, 6) === payload.adcode || c.name === payload.name
  })
  if (child) router.push(`/screen/${child.id}`)
}

function goTo(id: number) {
  if (id !== currentId.value) router.push(`/screen/${id}`)
}

function goRank(row: { tenantId: number }) {
  if (nodeMap.has(row.tenantId)) router.push(`/screen/${row.tenantId}`)
}

function exitScreen() {
  router.push('/portal/platform')
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}

function resizeAll() {
  ringChart.value?.resize()
  barChart.value?.resize()
  trendChart.value?.resize()
  pieChart.value?.resize()
}

watch(
  () => route.params.tenantId,
  (v) => {
    const id = Number(v)
    if (id && nodeMap.has(id)) {
      currentId.value = id
    }
  },
)

watch(currentId, () => loadData())

onMounted(async () => {
  try {
    autofit.init({ dh: 1080, dw: 1920, el: '#screen-root', resize: true }, false)
  } catch {
    /* autofit 容错 */
  }
  clockTimer = setInterval(() => (clock.value = formatClock()), 1000)
  window.addEventListener('resize', resizeAll)
  await loadTree()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener('resize', resizeAll)
  try {
    autofit.off()
  } catch {
    /* ignore */
  }
  ringChart.value?.dispose()
  barChart.value?.dispose()
  trendChart.value?.dispose()
  pieChart.value?.dispose()
})
</script>

<template>
  <div id="screen-root" class="screen">
    <header class="screen__header">
      <div class="screen__side">
        <el-button text class="screen__btn" @click="exitScreen">退出大屏</el-button>
      </div>
      <div class="screen__title">
        <h1>{{ title }}</h1>
        <p>{{ scopeLabel }} · 全域适老化监护大屏</p>
      </div>
      <div class="screen__side screen__side--right">
        <span class="screen__clock">{{ clock }}</span>
        <el-button text class="screen__btn" @click="toggleFullscreen">全屏</el-button>
      </div>
    </header>

    <nav v-if="breadcrumb.length > 1" class="screen__bread">
      <template v-for="(b, i) in breadcrumb" :key="b.id">
        <span class="screen__crumb" :class="{ 'is-active': b.id === currentId }" @click="goTo(b.id)">
          {{ b.name }}
        </span>
        <span v-if="i < breadcrumb.length - 1" class="screen__crumb-sep">/</span>
      </template>
    </nav>

    <div class="screen__kpis">
      <div v-for="c in kpiCards" :key="c.key" class="screen__kpi">
        <div class="screen__kpi-val">{{ formatValue(c.value, c.unit) }}</div>
        <div class="screen__kpi-label">{{ c.label }}</div>
      </div>
    </div>

    <main class="screen__grid">
      <div class="screen__col screen__col--left">
        <ScreenPanel title="设备 / 机器人在线" class="screen__grow">
          <div ref="ringEl" class="screen__chart"></div>
        </ScreenPanel>
        <ScreenPanel title="适老化关键指标">
          <div ref="barEl" class="screen__chart screen__chart--sm"></div>
        </ScreenPanel>
        <ScreenPanel title="居民年龄构成">
          <div ref="pieEl" class="screen__chart screen__chart--sm"></div>
        </ScreenPanel>
      </div>

      <div class="screen__col screen__col--center">
        <ScreenPanel
          :title="isLeaf ? '本级区域分布' : '辖区分布（点击下钻）'"
          :subtitle="isLeaf ? '' : '点击地图区域进入下级'"
          class="screen__grow"
        >
          <ScreenMap
            :adcode="mapAdcode"
            :regions="regionData?.regions || []"
            :label="regionData?.label || '设备数'"
            @drill="onDrill"
          />
        </ScreenPanel>
        <ScreenPanel title="跌倒事件趋势（近 30 天）">
          <div ref="trendEl" class="screen__chart screen__chart--sm"></div>
        </ScreenPanel>
      </div>

      <div class="screen__col screen__col--right">
        <ScreenPanel :title="isLeaf ? '本站概览' : '下属机构排行（居民数）'" class="screen__grow">
          <ul class="screen__rank">
            <li
              v-for="(row, i) in rankData?.items || []"
              :key="row.tenantId"
              class="screen__rank-row"
              @click="goRank(row)"
            >
              <span class="screen__rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
              <span class="screen__rank-name">{{ row.tenantName }}</span>
              <span class="screen__rank-val">{{ row.value.toLocaleString('zh-CN') }}</span>
            </li>
            <li v-if="!(rankData?.items || []).length" class="screen__rank-empty">
              {{ isLeaf ? '叶级站点无下属数据' : '暂无下属数据' }}
            </li>
          </ul>
        </ScreenPanel>
        <ScreenPanel title="实时态势">
          <div class="screen__live">
            <div class="screen__live-row">
              <span>在岗护工</span><b>{{ kpiMap.get('attendants_active')?.value ?? 0 }}</b>
            </div>
            <div class="screen__live-row">
              <span>今日订单</span><b>{{ kpiMap.get('orders_count')?.value ?? 0 }}</b>
            </div>
            <div class="screen__live-row">
              <span>SOS 求助</span><b class="warn">{{ kpiMap.get('sos_events')?.value ?? 0 }}</b>
            </div>
            <div class="screen__live-row">
              <span>AI 导诊</span><b>{{ kpiMap.get('triage_sessions')?.value ?? 0 }}</b>
            </div>
            <div class="screen__live-row">
              <span>投诉工单</span><b>{{ kpiMap.get('complaints_count')?.value ?? 0 }}</b>
            </div>
            <div class="screen__live-row">
              <span>低电设备</span><b class="warn">{{ kpiMap.get('devices_low_battery')?.value ?? 0 }}</b>
            </div>
          </div>
        </ScreenPanel>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.screen {
  width: 1920px;
  height: 1080px;
  background: radial-gradient(circle at 50% 0%, #0b2350 0%, #051127 60%, #03081a 100%);
  color: #d7e8ff;
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}
.screen__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}
.screen__title {
  text-align: center;
  h1 {
    margin: 0;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 4px;
    background: linear-gradient(90deg, #8fd0ff, #fff, #8fd0ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #6b8bbd;
    letter-spacing: 2px;
  }
}
.screen__side {
  width: 260px;
  display: flex;
  align-items: center;
  gap: 12px;
  &--right { justify-content: flex-end; }
}
.screen__clock {
  font-size: 15px;
  color: #8fb4e8;
  font-variant-numeric: tabular-nums;
}
.screen__btn { color: #8fd0ff !important; }
.screen__bread {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.screen__crumb {
  cursor: pointer;
  color: #6b8bbd;
  &.is-active { color: #5bd6ff; font-weight: 600; }
  &:hover { color: #8fd0ff; }
}
.screen__crumb-sep { color: #33507f; }
.screen__kpis {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
.screen__kpi {
  background: linear-gradient(180deg, rgba(31, 120, 255, 0.18), rgba(9, 24, 51, 0.2));
  border: 1px solid rgba(64, 158, 255, 0.25);
  border-radius: 6px;
  padding: 12px 16px;
  text-align: center;
}
.screen__kpi-val {
  font-size: 30px;
  font-weight: 800;
  color: #5bd6ff;
  font-variant-numeric: tabular-nums;
}
.screen__kpi-label {
  margin-top: 4px;
  font-size: 13px;
  color: #8fb4e8;
}
.screen__grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1.6fr 1fr;
  gap: 16px;
  min-height: 0;
}
.screen__col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}
.screen__grow { flex: 1; min-height: 0; }
.screen__chart {
  width: 100%;
  height: 100%;
  min-height: 220px;
  &--sm { min-height: 180px; }
}
.screen__rank {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.screen__rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(31, 120, 255, 0.06);
  &:hover { background: rgba(31, 120, 255, 0.16); }
}
.screen__rank-no {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: #1b3766;
  color: #8fb4e8;
  &.top { background: linear-gradient(135deg, #1f78ff, #5bd6ff); color: #fff; }
}
.screen__rank-name { flex: 1; font-size: 14px; color: #cfe2ff; }
.screen__rank-val { font-size: 15px; font-weight: 700; color: #5bd6ff; }
.screen__rank-empty { color: #6b8bbd; text-align: center; padding: 24px 0; }
.screen__live {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.screen__live-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(31, 120, 255, 0.06);
  font-size: 14px;
  color: #9fc3f0;
  b { font-size: 20px; color: #5bd6ff; &.warn { color: #ff7a7a; } }
}
</style>
