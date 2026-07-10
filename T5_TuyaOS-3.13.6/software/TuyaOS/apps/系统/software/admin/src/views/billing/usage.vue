<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  USAGE_METRIC_LABELS,
  getUsageSummary,
  listUsageRecords,
  type UsageMetric,
  type UsageRecord,
  type UsageSummary,
} from '@/api/billing'

const month = ref<string>(defaultMonth())
const summary = ref<UsageSummary | null>(null)
const records = ref<UsageRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const metricFilter = ref<UsageMetric | ''>('')
const loading = ref(false)
const recordsLoading = ref(false)

const metricKeys = Object.keys(USAGE_METRIC_LABELS) as UsageMetric[]

function defaultMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`
}
function parseMonth() {
  const [y, m] = month.value.split('-')
  return { year: Number(y), month: Number(m) }
}

const cards = computed(() =>
  metricKeys.map((m) => ({
    metric: m,
    label: USAGE_METRIC_LABELS[m],
    quantity: summary.value?.byMetric?.[m] ?? 0,
    amount: summary.value?.amountByMetric?.[m] ?? 0,
  })),
)

async function loadSummary() {
  loading.value = true
  try {
    const { year, month: mm } = parseMonth()
    summary.value = await getUsageSummary(year, mm)
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  recordsLoading.value = true
  try {
    const { year, month: mm } = parseMonth()
    const from = `${year}-${`${mm}`.padStart(2, '0')}-01`
    const toDate = new Date(year, mm, 0)
    const to = `${year}-${`${mm}`.padStart(2, '0')}-${`${toDate.getDate()}`.padStart(2, '0')}`
    const res = await listUsageRecords({
      metric: metricFilter.value || undefined,
      from,
      to,
      page: page.value,
      pageSize: pageSize.value,
    })
    records.value = res.items
    total.value = res.total
  } finally {
    recordsLoading.value = false
  }
}

function reload() {
  page.value = 1
  loadSummary()
  loadRecords()
}

function onPageChange(p: number) {
  page.value = p
  loadRecords()
}

onMounted(() => {
  loadSummary()
  loadRecords()
})
</script>

<template>
  <div class="usage">
    <div class="page-head">
      <div>
        <h2>用量计费</h2>
        <span>AI 对话 / Token / 通话时长 / 设备活跃 等计量用量统计</span>
      </div>
      <div class="filters">
        <el-date-picker
          v-model="month"
          type="month"
          value-format="YYYY-MM"
          :clearable="false"
          @change="reload"
        />
        <el-button @click="reload">刷新</el-button>
      </div>
    </div>

    <div class="kpis" v-loading="loading">
      <div class="kpi total">
        <div class="kpi__label">本月计费金额</div>
        <div class="kpi__value">¥{{ (summary?.totalAmount ?? 0).toLocaleString('zh-CN') }}</div>
        <div class="kpi__sub">记录 {{ summary?.totalRecords ?? 0 }} 条</div>
      </div>
      <div v-for="c in cards" :key="c.metric" class="kpi">
        <div class="kpi__label">{{ c.label }}</div>
        <div class="kpi__value">{{ c.quantity.toLocaleString('zh-CN') }}</div>
        <div class="kpi__sub">¥{{ c.amount.toLocaleString('zh-CN') }}</div>
      </div>
    </div>

    <el-card shadow="never" class="card">
      <template #header>
        <div class="card-head">
          <span>用量明细</span>
          <el-select v-model="metricFilter" placeholder="全部指标" clearable size="small" style="width: 180px" @change="reload">
            <el-option v-for="m in metricKeys" :key="m" :label="USAGE_METRIC_LABELS[m]" :value="m" />
          </el-select>
        </div>
      </template>
      <el-table :data="records" v-loading="recordsLoading" size="small" border>
        <el-table-column prop="id" label="#" width="70" />
        <el-table-column label="指标" width="150">
          <template #default="{ row }">{{ USAGE_METRIC_LABELS[row.metric as UsageMetric] || row.metric }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="用量" width="120" align="right" />
        <el-table-column prop="unitPrice" label="单价" width="100" align="right" />
        <el-table-column prop="userId" label="用户ID" width="100" />
        <el-table-column prop="deviceId" label="设备ID" width="100">
          <template #default="{ row }">{{ row.deviceId ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="occurredAt" label="发生时间" min-width="180" />
      </el-table>
      <div class="pager">
        <el-pagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.usage {
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
.filters {
  display: flex;
  gap: 10px;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.kpi {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  padding: 16px 18px;
}
.kpi.total {
  border-left: 3px solid #1677ff;
}
.kpi__label {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.kpi__value {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}
.kpi__sub {
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
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
.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
