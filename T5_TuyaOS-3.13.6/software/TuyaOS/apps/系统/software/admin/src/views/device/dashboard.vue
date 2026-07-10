<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'
import {
  getDeviceDashboardStats,
  listSafetyEvents,
  type DeviceDashboardStats,
  type DeviceEventLog,
} from '@/api/device'

const router = useRouter()
const loading = ref(false)
const stats = ref<DeviceDashboardStats | null>(null)
const safety = ref<DeviceEventLog[]>([])

const onlineEl = ref<HTMLDivElement | null>(null)
const onlineChart = shallowRef<echarts.ECharts | null>(null)

const batteryTotal = computed(() => {
  const b = stats.value?.batteryBuckets
  if (!b) return 0
  return b.high + b.medium + b.low + b.unknown
})

const EVENT_LABEL: Record<string, string> = {
  fall: '跌倒',
  sos: 'SOS 求助',
  vital_anomaly: '体征异常',
  low_battery: '低电量',
  offline: '掉线',
}
const LEVEL_TAG: Record<string, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
}

function renderOnlineChart() {
  if (!onlineEl.value || !stats.value) return
  if (!onlineChart.value) onlineChart.value = echarts.init(onlineEl.value)
  onlineChart.value.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['55%', '78%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{c}' },
        data: [
          { name: '在线', value: stats.value.onlineCount, itemStyle: { color: '#52c41a' } },
          { name: '离线', value: stats.value.offlineCount, itemStyle: { color: '#cbd5e1' } },
        ],
      },
    ],
  })
}

async function load() {
  loading.value = true
  try {
    const [s, ev] = await Promise.all([
      getDeviceDashboardStats(),
      listSafetyEvents({ page: 1, pageSize: 10 }),
    ])
    stats.value = s
    safety.value = ev.items
    await nextTick()
    renderOnlineChart()
  } finally {
    loading.value = false
  }
}

function resize() {
  onlineChart.value?.resize()
}

onMounted(() => {
  load()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  onlineChart.value?.dispose()
  onlineChart.value = null
})
</script>

<template>
  <div class="dev-dash" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>设备运维大盘</h2>
        <span>设备在线率 / 电量分布 / 近 7 日安全事件</span>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="kpi__label">设备总数</div><div class="kpi__value">{{ stats?.total ?? 0 }}</div></div>
      <div class="kpi"><div class="kpi__label">在线设备</div><div class="kpi__value">{{ stats?.onlineCount ?? 0 }}</div></div>
      <div class="kpi accent">
        <div class="kpi__label">在线率</div>
        <div class="kpi__value">{{ stats?.onlineRate ?? 0 }}%</div>
      </div>
      <div class="kpi"><div class="kpi__label">7日严重事件</div><div class="kpi__value">{{ stats?.criticalEvents7d ?? 0 }}</div></div>
      <div class="kpi danger">
        <div class="kpi__label">7日跌倒</div>
        <div class="kpi__value">{{ stats?.fallEvents7d ?? 0 }}</div>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="10">
        <el-card shadow="never" class="card">
          <template #header><span>在线 / 离线分布</span></template>
          <div ref="onlineEl" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="14">
        <el-card shadow="never" class="card">
          <template #header><span>电量分布（共 {{ batteryTotal }} 台）</span></template>
          <div class="battery">
            <div class="battery-row">
              <span class="b-label">充足 (&gt;50%)</span>
              <el-progress
                :percentage="batteryTotal ? Math.round(((stats?.batteryBuckets.high ?? 0) / batteryTotal) * 100) : 0"
                color="#52c41a"
              />
              <span class="b-count">{{ stats?.batteryBuckets.high ?? 0 }}</span>
            </div>
            <div class="battery-row">
              <span class="b-label">中等 (20-50%)</span>
              <el-progress
                :percentage="batteryTotal ? Math.round(((stats?.batteryBuckets.medium ?? 0) / batteryTotal) * 100) : 0"
                color="#faad14"
              />
              <span class="b-count">{{ stats?.batteryBuckets.medium ?? 0 }}</span>
            </div>
            <div class="battery-row">
              <span class="b-label">低电 (&lt;20%)</span>
              <el-progress
                :percentage="batteryTotal ? Math.round(((stats?.batteryBuckets.low ?? 0) / batteryTotal) * 100) : 0"
                color="#f5222d"
              />
              <span class="b-count">{{ stats?.batteryBuckets.low ?? 0 }}</span>
            </div>
            <div class="battery-row">
              <span class="b-label">未知</span>
              <el-progress
                :percentage="batteryTotal ? Math.round(((stats?.batteryBuckets.unknown ?? 0) / batteryTotal) * 100) : 0"
                color="#cbd5e1"
              />
              <span class="b-count">{{ stats?.batteryBuckets.unknown ?? 0 }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="card">
      <template #header>
        <div class="card-head">
          <span>近期安全事件</span>
          <el-button link type="primary" @click="router.push('/device/fall-events')">查看全部</el-button>
        </div>
      </template>
      <el-table :data="safety" size="small" border>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ EVENT_LABEL[row.type] || row.type }}</template>
        </el-table-column>
        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="LEVEL_TAG[row.level] || 'info'">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deviceName" label="设备" min-width="140">
          <template #default="{ row }">{{ row.deviceName || `#${row.deviceId}` }}</template>
        </el-table-column>
        <el-table-column prop="receivedAt" label="时间" min-width="180" />
      </el-table>
      <el-empty v-if="!loading && !safety.length" description="近期无安全事件" :image-size="80" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.dev-dash {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.page-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
  color: #1e293b;
}
.page-head span {
  font-size: 13px;
  color: #94a3b8;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.kpi {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  padding: 16px 18px;
}
.kpi.accent {
  border-left: 3px solid #1677ff;
}
.kpi.danger {
  border-left: 3px solid #f5222d;
}
.kpi__label {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.kpi__value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}
.card {
  border: 1px solid #eef2f7;
  border-radius: 12px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chart {
  height: 300px;
  width: 100%;
}
.battery {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 8px 0;
}
.battery-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.b-label {
  width: 110px;
  color: #475569;
  font-size: 13px;
  flex-shrink: 0;
}
.battery-row :deep(.el-progress) {
  flex: 1;
}
.b-count {
  width: 48px;
  text-align: right;
  font-weight: 600;
  color: #1e293b;
}
</style>
