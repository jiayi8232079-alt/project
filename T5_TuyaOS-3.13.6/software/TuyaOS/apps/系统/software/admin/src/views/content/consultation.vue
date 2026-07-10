<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getConsultations, getConsultationsByDate, getConsultationDateSummary, updateConsultationStatus } from '@/api/consultation'
import { formatLocalDate } from '@/utils/date'

interface Consultation {
  id: number
  userId: number
  consultType: string
  serviceInterest?: string
  consultCategory?: string
  consultSubType?: string
  name: string
  phone: string
  appointmentDate: string
  appointmentTime: string
  detail: string
  status: string
  user?: { nickname: string; phone: string }
  createdAt: string
}

const router = useRouter()
const route = useRoute()

const SERVICE_TO_ORDER: Record<string, string> = {
  checkup: '体检预约',
  expert: 'VIP医疗资源协调',
  escort: '门诊陪诊',
  consult: '门诊咨询',
  store: '到店预约',
  fetch: '代取报告',
}

const selectedDate = ref('')
const viewMode = ref<'date' | 'list'>('date')
const listData = ref<Consultation[]>([])
const dateSummary = ref<{ date: string; count: string }[]>([])
const loading = ref(false)
const filterStatus = ref('')
const filterService = ref('')
const highlightedConsultationId = ref<number | null>(null)
const dashboardNotice = ref('')
const syncingRouteState = ref(false)

function formatDateOnly(date: Date): string {
  return formatLocalDate(date)
}

const today = formatDateOnly(new Date())
const now = new Date()
const monthStart = formatDateOnly(new Date(now.getFullYear(), now.getMonth(), 1))
const monthEnd = formatDateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0))

async function loadByDate() {
  if (!selectedDate.value) return
  loading.value = true
  try {
    listData.value = (await getConsultationsByDate(selectedDate.value)) as Consultation[]
  } catch { listData.value = [] }
  finally { loading.value = false }
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await getConsultations({
      date: selectedDate.value || undefined,
      status: filterStatus.value || undefined,
      serviceInterest: filterService.value || undefined,
      page: 1,
      pageSize: 100,
    })
    listData.value = res.items || []
  } catch { listData.value = [] }
  finally { loading.value = false }
}

async function loadDateSummary() {
  try {
    dateSummary.value = (await getConsultationDateSummary(monthStart, monthEnd)) || []
  } catch { dateSummary.value = [] }
}

function consultTypeLabel(t: string) {
  return t === 'online' ? '线上咨询' : '到店咨询'
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: '未咨询',
    unconsulted: '未咨询',
    consulted: '已咨询',
    order_accepted: '已接单',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
  }
  return map[s] || s
}

function serviceInterestLabel(s?: string) {
  if (!s) return '—'
  return { checkup: '体检规划', expert: '专家匹配', escort: '陪诊服务', consult: '门诊咨询', store: '到店预约', fetch: '代取报告' }[s] || s
}
function consultCategoryLabel(row: Consultation) {
  return row.consultCategory || '—'
}
function consultSubTypeLabel(row: Consultation) {
  return row.consultSubType || '—'
}

function isOrderAccepted(row: Consultation) {
  return row.status === 'order_accepted'
}

async function setStatusConsulted(row: Consultation) {
  try {
    await updateConsultationStatus(row.id, 'consulted')
    ElMessage.success('已标记为已咨询')
    if (viewMode.value === 'date') loadByDate()
    else loadList()
  } catch { /* handled */ }
}

async function setStatusUnconsulted(row: Consultation) {
  try {
    await updateConsultationStatus(row.id, 'unconsulted')
    ElMessage.success('已标记为未咨询')
    if (viewMode.value === 'date') loadByDate()
    else loadList()
  } catch { /* handled */ }
}

function goCreateOrder(row: Consultation) {
  const serviceType = row.serviceInterest ? SERVICE_TO_ORDER[row.serviceInterest] : ''
  const params: Record<string, string> = { userId: String(row.userId), consultationId: String(row.id) }
  if (serviceType) params.serviceType = serviceType
  if (row.appointmentDate && row.appointmentTime) {
    params.serviceTime = `${row.appointmentDate}T${row.appointmentTime}:00`
  }
  if (row.detail && row.detail.length < 200) params.notes = row.detail
  const qs = new URLSearchParams(params).toString()
  router.push(`/service/orders/create?${qs}`)
}

function getQueryString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

async function applyRouteFilters() {
  const nextView = getQueryString(route.query.view) === 'list' ? 'list' : 'date'
  const nextStatus = getQueryString(route.query.status)
  const nextService = getQueryString(route.query.serviceInterest)
  const nextDate = getQueryString(route.query.date) || today
  const nextFocusId = Number(getQueryString(route.query.focusId) || 0)
  const fromDashboard = getQueryString(route.query.from) === 'dashboard'

  syncingRouteState.value = true
  viewMode.value = nextView
  filterStatus.value = nextStatus
  filterService.value = nextService
  selectedDate.value = nextDate
  highlightedConsultationId.value = Number.isFinite(nextFocusId) && nextFocusId > 0 ? nextFocusId : null
  dashboardNotice.value = fromDashboard
    ? `驾驶舱检测到新的预约咨询，已为你切换到${['pending', 'unconsulted'].includes(nextStatus) ? '待处理' : '对应'}列表。`
    : ''
  syncingRouteState.value = false

  await loadDateSummary()
  if (viewMode.value === 'date') await loadByDate()
  else await loadList()
}

function getRowClassName({ row }: { row: Consultation }) {
  return highlightedConsultationId.value === row.id ? 'consultation-row--highlight' : ''
}

watch(selectedDate, () => {
  if (syncingRouteState.value) return
  if (viewMode.value === 'date') loadByDate()
  else loadList()
})

watch([viewMode, filterStatus, filterService], () => {
  if (syncingRouteState.value) return
  if (viewMode.value === 'date') loadByDate()
  else loadList()
})

watch(() => route.fullPath, () => {
  void applyRouteFilters()
})

onMounted(() => {
  void applyRouteFilters()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">预约咨询（人工排期）</h2>
        <p class="page-subtitle">处理客户预约、排期与转单动作，和 AI 问诊/导诊数据分开管理。</p>
      </div>
    </div>

    <el-card shadow="never">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 14px;"
        title="与 AI 问诊、导诊的区别"
        description="本页是客户提交的到店/线下面谈预约与排期，可转订单。另两个入口：「AI 问诊对话」为小程序里多轮聊天留痕；「AI 导诊工单」为症状分流、转人工与转订单会话，三者数据不互通。"
      />
      <div style="margin-bottom: 12px; color: #606266; font-size: 13px; line-height: 1.7;">
        处理预约记录与转单。号源与时段规则在「系统设置 → 业务规则」维护。
      </div>
      <el-alert
        v-if="dashboardNotice"
        :title="dashboardNotice"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom: 12px;"
      />
      <div class="toolbar">
        <el-radio-group v-model="viewMode">
          <el-radio-button value="date">按日期查看</el-radio-button>
          <el-radio-button value="list">全部列表</el-radio-button>
        </el-radio-group>

        <div class="toolbar-right">
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 160px; margin-right: 12px;"
          />
          <el-select v-if="viewMode === 'list'" v-model="filterService" placeholder="感兴趣服务" clearable style="width: 120px; margin-right: 8px;">
            <el-option label="体检规划" value="checkup" />
            <el-option label="专家匹配" value="expert" />
            <el-option label="陪诊服务" value="escort" />
            <el-option label="门诊咨询" value="consult" />
            <el-option label="到店预约" value="store" />
            <el-option label="代取报告" value="fetch" />
          </el-select>
          <el-select v-if="viewMode === 'list'" v-model="filterStatus" placeholder="状态" clearable style="width: 100px;">
            <el-option label="未咨询" value="unconsulted" />
            <el-option label="已咨询" value="consulted" />
            <el-option label="已接单" value="order_accepted" />
            <el-option label="待处理" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
          <el-button type="primary" @click="viewMode === 'date' ? loadByDate() : loadList()" style="margin-left: 12px;">
            刷新
          </el-button>
        </div>
      </div>

      <div v-if="viewMode === 'date'" class="date-hint">
        <span>本月有预约的日期：</span>
        <el-tag v-for="d in dateSummary" :key="d.date" size="small" type="info" style="margin: 2px 4px;">
          {{ d.date }} ({{ d.count }})
        </el-tag>
        <span v-if="!dateSummary.length" style="color: #999;">暂无</span>
      </div>

      <el-table
        :data="listData"
        v-loading="loading"
        highlight-current-row
        style="margin-top: 16px;"
        :row-class-name="getRowClassName"
      >
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="感兴趣服务" width="100">
          <template #default="{ row }">
            <el-tag type="warning" size="small">{{ serviceInterestLabel(row.serviceInterest) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="咨询类型" width="130">
          <template #default="{ row }">
            {{ consultCategoryLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="协调方向" width="120">
          <template #default="{ row }">
            {{ consultSubTypeLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="咨询方式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.consultType === 'online' ? 'primary' : 'success'" size="small">
              {{ consultTypeLabel(row.consultType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="客户姓名" width="120" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column label="预约时间" width="180">
          <template #default="{ row }">
            {{ row.appointmentDate }} {{ row.appointmentTime || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="咨询需求" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'order_accepted' ? 'success' : row.status === 'consulted' ? 'info' : row.status === 'pending' || row.status === 'unconsulted' ? 'warning' : 'info'"
              size="small"
            >
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="170">
          <template #default="{ row }">
            {{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="!isOrderAccepted(row)">
              <el-button type="warning" link size="small" @click="setStatusUnconsulted(row)">未咨询</el-button>
              <el-button type="primary" link size="small" @click="setStatusConsulted(row)">已咨询</el-button>
              <el-button type="primary" link size="small" @click="goCreateOrder(row)">转为订单</el-button>
            </template>
            <span v-else class="text-muted">已接单</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && listData.length === 0" description="该日期暂无预约" style="padding: 40px 0;" />
    </el-card>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.toolbar-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.date-hint {
  margin-top: 12px;
  font-size: 13px;
  color: #606266;
}
.text-muted {
  color: #909399;
  font-size: 13px;
}
.slot-rule-panel {
  margin-bottom: 14px;
  padding: 12px 12px 4px;
  background: #f8fafc;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
}
.slot-rule-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
}
.slot-preview {
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
}

:deep(.consultation-row--highlight td) {
  background: #fff7e6 !important;
}

:deep(.consultation-row--highlight:hover td) {
  background: #ffefc2 !important;
}
</style>
