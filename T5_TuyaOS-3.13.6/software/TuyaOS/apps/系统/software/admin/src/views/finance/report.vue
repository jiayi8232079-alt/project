<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import * as XLSX from 'xlsx'
import { get } from '@/api/request'
import { getFinanceReport } from '@/api/finance'
import { getOrderList } from '@/api/order'
import { formatLocalDate } from '@/utils/date'

echarts.use([BarChart, LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const loading = ref(false)
const dateRange = ref<string[]>([])
const reportData = ref({
  totalAmount: 0,
  totalCount: 0,
  orderCount: 0,
  pendingAmount: 0,
  pendingCount: 0,
})
const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const avgPrice = computed(() => {
  if (!reportData.value.orderCount) return 0
  return reportData.value.totalAmount / reportData.value.orderCount
})

async function loadReport() {
  loading.value = true
  try {
    const params: any = {}
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }

    const [finRes, trendData] = await Promise.all([
      getFinanceReport(params).catch(() => ({})),
      get('/orders/stats/income-trend', { days: 30 }).catch(() => []) as Promise<any>,
    ])

    reportData.value = {
      totalAmount: finRes.totalAmount || 0,
      totalCount: finRes.totalCount || 0,
      orderCount: finRes.orderCount || 0,
      pendingAmount: finRes.pendingAmount || 0,
      pendingCount: finRes.pendingCount || 0,
    }

    await nextTick()
    initChart(Array.isArray(trendData) ? trendData : [])
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function handleReset() {
  dateRange.value = []
  loadReport()
}

function initChart(data: { date: string; income: number; orders: number }[]) {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)

  const days: string[] = []
  const incomeData: number[] = []
  const orderData: number[] = []

  if (data.length) {
    data.forEach(d => {
      const dt = new Date(d.date)
      days.push(`${dt.getMonth() + 1}/${dt.getDate()}`)
      incomeData.push(d.income)
      orderData.push(d.orders)
    })
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(`${d.getMonth() + 1}/${d.getDate()}`)
      incomeData.push(0)
      orderData.push(0)
    }
  }

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入(元)', '订单数'], bottom: 0 },
    grid: { left: 60, right: 40, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: days },
    yAxis: [
      { type: 'value', name: '元' },
      { type: 'value', name: '订单' },
    ],
    series: [
      { name: '收入(元)', type: 'bar', data: incomeData, itemStyle: { color: '#409EFF', borderRadius: [6, 6, 0, 0] } },
      { name: '订单数', type: 'line', yAxisIndex: 1, data: orderData, smooth: true, itemStyle: { color: '#667eea' }, lineStyle: { width: 3 } },
    ],
  })
}

async function handleExport() {
  try {
    const pageSize = 100
    let page = 1
    const orders: any[] = []
    while (true) {
      const ordersRes: any = await getOrderList({ page, pageSize })
      const batch = ordersRes.items || []
      orders.push(...batch)
      if (batch.length < pageSize) break
      page += 1
      if (page > 500) break
    }
    const data = orders.map((o: any) => ({
      '订单号': o.orderNumber,
      '服务对象': o.serviceTarget?.name || '',
      '服务类型': o.serviceType || '',
      '就诊医院': o.hospital || '',
      '科室': o.department || '',
      '基础费用': o.baseFee || 0,
      '总费用': o.totalFee || 0,
      '陪诊员': o.attendant?.realName || '',
      '状态': o.status,
      '创建时间': o.createdAt,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '财务报表')
    XLSX.writeFile(wb, `陪了个伴_财务报表_${formatLocalDate(new Date())}.xlsx`)
  } catch {
    // handled
  }
}

onMounted(() => {
  loadReport()
  window.addEventListener('resize', () => chart?.resize())
})

onUnmounted(() => {
  chart?.dispose()
})
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">财务报表</h2>
        <p class="page-subtitle">按时间范围查看收入与订单趋势，支持一键导出用于复盘与对账。</p>
      </div>
      <div class="page-header__actions">
        <el-button type="success" @click="handleExport"><el-icon><Download /></el-icon>导出 Excel</el-button>
      </div>
    </div>

    <el-card shadow="never" class="filter-bar">
      <el-form inline>
        <el-form-item label="时间范围">
          <el-date-picker v-model="dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadReport"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover"><el-statistic title="总收入" :value="reportData.totalAmount" :precision="2" prefix="¥" /></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><el-statistic title="总订单数" :value="reportData.orderCount" suffix="单" /></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><el-statistic title="平均客单价" :value="avgPrice" :precision="2" prefix="¥" /></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><el-statistic title="待结算金额" :value="reportData.pendingAmount" :precision="2" prefix="¥" /></el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top: 20px;">
      <template #header><span style="font-weight: 600;">收入趋势（近30日）</span></template>
      <div ref="chartRef" style="height: 320px;"></div>
    </el-card>
  </div>
</template>
