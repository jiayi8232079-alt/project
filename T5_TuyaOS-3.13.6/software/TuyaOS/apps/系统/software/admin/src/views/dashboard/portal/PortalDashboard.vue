<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import ChinaMap from '@/components/charts/ChinaMap.vue'
import TenantTreeSelect from '@/components/tenant/TenantTreeSelect.vue'
import {
  exportDashboard,
  getMetricRank,
  getMetricTrend,
  getPortalSummary,
  getRegionMap,
  runAggregate,
  type DashboardScope,
  type MetricResult,
  type OverviewResult,
  type RankResult,
  type RegionMapResult,
} from '@/api/portal-dashboard'
import type { PortalConfig } from './portal-config'

const props = defineProps<{ config: PortalConfig }>()

const router = useRouter()

const METRIC_LABELS: Record<string, string> = {
  residents_count: '居民数',
  devices_count: '设备总数',
  devices_online: '在线设备',
  devices_online_rate: '设备在线率',
  orders_count: '订单数',
  orders_revenue: '订单营收',
  fall_events: '跌倒事件',
  sos_events: 'SOS 事件',
  alerts_count: '告警总数',
  alerts_handled: '已处置告警',
  dialog_sessions: 'AI 对话',
  dialog_crisis: '危机对话',
  service_satisfaction: '服务满意度',
  subscription_active: '有效订阅',
  subscription_revenue: '订阅营收',
  pending_alerts: '待处理告警',
  attendants_active: '在岗护工',
}

const scope = ref<DashboardScope>(props.config.defaultScope)
const tenantId = ref<number | null>(null)
const range = ref<[string, string]>(defaultRange())

function openScreen() {
  router.push(tenantId.value ? `/screen/${tenantId.value}` : '/screen')
}

const summary = ref<OverviewResult | null>(null)
const rankData = ref<RankResult | null>(null)
const regionData = ref<RegionMapResult | null>(null)
const trendMetric = ref<string>(props.config.trendMetrics[0] ?? '')
const loading = ref(false)
const trendLoading = ref(false)

const trendEl = ref<HTMLDivElement | null>(null)
const trendChart = shallowRef<echarts.ECharts | null>(null)

function defaultRange(): [string, string] {
  const to = new Date()
  const from = new Date(to.getTime() - 29 * 24 * 3600 * 1000)
  return [fmt(from), fmt(to)]
}
function fmt(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const query = computed(() => ({
  scope: scope.value,
  tenantId: tenantId.value ?? undefined,
  from: range.value?.[0],
  to: range.value?.[1],
}))

const kpiCards = computed(() => {
  const cards: { key: string; label: string; value: number; unit: string | null }[] = []
  if (props.config.tenantCountLabel) {
    cards.push({
      key: '__tenant',
      label: props.config.tenantCountLabel,
      value: summary.value?.tenantCount ?? 0,
      unit: null,
    })
  }
  const map = new Map((summary.value?.kpis ?? []).map((k) => [k.metric, k]))
  for (const m of props.config.kpiMetrics) {
    const k = map.get(m)
    cards.push({
      key: m,
      label: k?.label ?? METRIC_LABELS[m] ?? m,
      value: k?.value ?? 0,
      unit: k?.unit ?? null,
    })
  }
  return cards
})

const hasNoData = computed(() => {
  const allZero = (summary.value?.kpis ?? []).every((k) => !k.value)
  return !!summary.value && allZero && !(summary.value.tenantCount > 0)
})

function formatValue(value: number, unit: string | null): string {
  if (unit === '%') return `${value}%`
  if (unit === '元') return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
  return value.toLocaleString('zh-CN')
}

async function loadSummary() {
  summary.value = await getPortalSummary(query.value)
}

async function loadRank() {
  if (!props.config.showRank || !props.config.rankMetric) return
  rankData.value = await getMetricRank(props.config.rankMetric, { ...query.value, limit: 10 })
}

async function loadRegion() {
  if (!props.config.showMap || !props.config.mapMetric) return
  regionData.value = await getRegionMap(props.config.mapMetric, query.value)
}

async function loadTrend() {
  trendLoading.value = true
  try {
    const res = await getMetricTrend(trendMetric.value, query.value)
    renderTrend(res)
  } finally {
    trendLoading.value = false
  }
}

function renderTrend(res: MetricResult) {
  if (!trendEl.value) return
  if (!trendChart.value) trendChart.value = echarts.init(trendEl.value)
  trendChart.value.setOption(
    {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 28, bottom: 36 },
      xAxis: {
        type: 'category',
        data: res.trend.map((p) => p.date.slice(5)),
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#94a3b8' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { color: '#94a3b8' },
      },
      series: [
        {
          name: res.label,
          type: 'line',
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.12, color: props.config.accent },
          lineStyle: { width: 2, color: props.config.accent },
          itemStyle: { color: props.config.accent },
          data: res.trend.map((p) => p.value),
        },
      ],
    },
    true,
  )
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadSummary(), loadRank(), loadRegion()])
    await nextTick()
    await loadTrend()
  } catch {
    // 单项失败已由全局拦截器提示
  } finally {
    loading.value = false
  }
}

async function handleAggregate() {
  try {
    await runAggregate('daily')
    await runAggregate('realtime')
    ElMessage.success('已触发聚合，正在刷新数据')
    await loadAll()
  } catch {
    ElMessage.error('聚合触发失败')
  }
}

async function handleExport() {
  try {
    const blob = await exportDashboard(query.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.config.key}-overview-${range.value[0]}_${range.value[1]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('导出失败')
  }
}

function resize() {
  trendChart.value?.resize()
}

watch(trendMetric, loadTrend)
watch(
  () => props.config.key,
  () => {
    scope.value = props.config.defaultScope
    tenantId.value = null
    trendMetric.value = props.config.trendMetrics[0] ?? ''
    loadAll()
  },
)

onMounted(() => {
  loadAll()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  trendChart.value?.dispose()
  trendChart.value = null
})
</script>

<template>
  <div class="portal" v-loading="loading">
    <!-- 头部筛选 -->
    <div class="portal__head">
      <div class="portal__title">
        <h2>{{ config.title }}</h2>
        <span>{{ config.subtitle }}</span>
      </div>
      <div class="portal__filters">
        <el-radio-group v-model="scope" @change="loadAll">
          <el-radio-button value="self">本级</el-radio-button>
          <el-radio-button value="descendants">含下属</el-radio-button>
        </el-radio-group>
        <TenantTreeSelect v-model="tenantId" @change="loadAll" />
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="~"
          start-placeholder="开始"
          end-placeholder="结束"
          :clearable="false"
          @change="loadAll"
        />
        <el-button @click="loadAll">刷新</el-button>
        <el-button @click="handleExport">导出</el-button>
        <el-button type="primary" @click="openScreen">进入大屏</el-button>
      </div>
    </div>

    <el-alert
      v-if="hasNoData"
      type="info"
      :closable="false"
      show-icon
      class="portal__empty-tip"
    >
      <template #title>
        当前 scope 暂无聚合数据。统计大盘依赖每日聚合任务，可点击
        <el-link type="primary" :underline="false" @click="handleAggregate">立即聚合</el-link>
        生成最新数据。
      </template>
    </el-alert>

    <!-- KPI 卡片 -->
    <div class="portal__kpis">
      <div
        v-for="card in kpiCards"
        :key="card.key"
        class="kpi-card"
        :style="{ '--accent': config.accent }"
      >
        <div class="kpi-card__label">{{ card.label }}</div>
        <div class="kpi-card__value">{{ formatValue(card.value, card.unit) }}</div>
      </div>
    </div>

    <!-- 趋势 + 地图 -->
    <el-row :gutter="16" class="portal__row">
      <el-col :xs="24" :lg="config.showMap ? 14 : 24">
        <el-card shadow="never" class="portal__card">
          <template #header>
            <div class="card-head">
              <span>趋势分析</span>
              <el-select v-model="trendMetric" size="small" style="width: 160px">
                <el-option
                  v-for="m in config.trendMetrics"
                  :key="m"
                  :label="METRIC_LABELS[m] || m"
                  :value="m"
                />
              </el-select>
            </div>
          </template>
          <div v-loading="trendLoading" ref="trendEl" class="portal__trend"></div>
        </el-card>
      </el-col>
      <el-col v-if="config.showMap" :xs="24" :lg="10">
        <el-card shadow="never" class="portal__card">
          <template #header>
            <span>区域分布 · {{ regionData?.label || '设备' }}</span>
          </template>
          <ChinaMap :regions="regionData?.regions || []" :label="regionData?.label || '数值'" height="360px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 排行 -->
    <el-card v-if="config.showRank" shadow="never" class="portal__card">
      <template #header>
        <span>{{ config.rankTitle || '下属排行' }}</span>
      </template>
      <el-table :data="rankData?.items || []" size="small" :show-header="true">
        <el-table-column type="index" label="#" width="56" />
        <el-table-column prop="tenantName" label="租户" min-width="200" />
        <el-table-column prop="scopeType" label="层级" width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.scopeType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="value" label="数值" width="160" align="right">
          <template #default="{ row }">
            <strong>{{ row.value.toLocaleString('zh-CN') }}</strong>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!(rankData?.items || []).length" description="暂无下属数据" :image-size="80" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.portal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.portal__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.portal__title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}
.portal__title span {
  font-size: 13px;
  color: #94a3b8;
}
.portal__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.portal__empty-tip {
  margin: 0;
}
.portal__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.kpi-card {
  background: #fff;
  border: 1px solid #eef2f7;
  border-left: 3px solid var(--accent);
  border-radius: 10px;
  padding: 16px 18px;
}
.kpi-card__label {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.kpi-card__value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}
.portal__card {
  border: 1px solid #eef2f7;
  border-radius: 12px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.portal__trend {
  height: 360px;
  width: 100%;
}
.portal__row {
  width: 100%;
  margin: 0 !important;
}
</style>
