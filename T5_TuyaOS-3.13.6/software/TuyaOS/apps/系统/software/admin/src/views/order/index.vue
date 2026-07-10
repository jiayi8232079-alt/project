<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { getOrderList, getOrderDetail, getOrderTimeline, deleteOrder, updateOrderStatus } from '@/api/order'
import { getAttendantList } from '@/api/attendant'
import { orderStatusMap, formatDate, formatMoney } from '@/utils/format'
import { formatLocalDate } from '@/utils/date'
import { API_BASE_URL } from '@/config/api-base'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const attendantOptions = ref<any[]>([])
const quickViewVisible = ref(false)
const quickViewLoading = ref(false)
const quickTimelineLoading = ref(false)
const quickViewTab = ref('info')
const quickOrder = ref<any>(null)
const quickTimelines = ref<any[]>([])

function serviceScheduleLabel(o: { serviceTime?: string | null; serviceEndTime?: string | null }) {
  if (!o?.serviceTime) return '—'
  const start = formatDate(o.serviceTime)
  if (!o?.serviceEndTime) return start
  return `${start} ～ ${formatDate(o.serviceEndTime)}`
}

function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const searchForm = reactive({
  keyword: String(route.query.keyword || ''),
  status: (route.query.status as string) || '',
  paymentStatus: (route.query.paymentStatus as string) || '',
  settlementStatus: (route.query.settlementStatus as string) || '',
  attendantId: route.query.attendantId ? Number(route.query.attendantId) : undefined as number | undefined,
  dateRange: route.query.startDate && route.query.endDate
    ? [String(route.query.startDate), String(route.query.endDate)] as string[]
    : [] as string[],
  page: parsePositiveNumber(route.query.page, 1),
  pageSize: parsePositiveNumber(route.query.pageSize, 20),
})

const statusOptions = Object.entries(orderStatusMap).map(([value, { label }]) => ({ value, label }))

const paymentStatusOptions = [
  { value: 'unpaid', label: '未付款' },
  { value: 'paid', label: '已付款' },
  { value: 'refunded', label: '已退款' },
]

const settlementStatusOptions = [
  { value: 'pending', label: '待结算' },
  { value: 'settled', label: '已结算' },
]

const financeTypeLabelMap: Record<string, string> = {
  transport: '交通费',
  accommodation: '住宿费',
  medical: '医疗相关',
  other: '其他费用',
}
const timelineTypeLabelMap: Record<string, string> = {
  text: '文字',
  image: '图片',
  audio_question: '问诊录音',
  audio_advice: '医嘱录音',
  file: '文件',
  node: '节点',
  service_start: '服务开始',
  service_end: '服务结束',
  emergency: '紧急',
}

const unpaidCount = computed(() => tableData.value.filter(o => o.paymentStatus === 'unpaid' && o.totalFee).length)
const pendingSettleCount = computed(() => tableData.value.filter(o => o.settlementStatus !== 'settled' && o.paymentStatus === 'paid').length)
const currentPageRevenue = computed(() => {
  const sum = tableData.value
    .filter(o => o.paymentStatus === 'paid' && o.totalFee)
    .reduce((acc: number, o: any) => acc + (Number(o.totalFee) || 0), 0)
  return sum
})

function paymentStatusLabel(status: string) {
  if (status === 'paid') return '已付款'
  if (status === 'refunded') return '已退款'
  return '未付款'
}

function paymentStatusTagType(status: string): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'paid') return 'success'
  if (status === 'refunded') return 'danger'
  return 'warning'
}

function settlementStatusLabel(status: string) {
  return status === 'settled' ? '已结算' : '待结算'
}

function settlementStatusTagType(status: string): 'success' | 'info' {
  return status === 'settled' ? 'success' : 'info'
}

function paymentMethodLabel(method: string) {
  const map: Record<string, string> = {
    wechat: '微信转账',
    alipay: '支付宝转账',
    qr_transfer: '收款码转账',
    bank_transfer: '银行卡转账',
    cash: '现金',
    other: '其他',
  }
  return map[method] || method || '—'
}

function buildQuery() {
  const query: Record<string, string> = {}
  if (searchForm.keyword) query.keyword = searchForm.keyword
  if (searchForm.status) query.status = searchForm.status
  if (searchForm.paymentStatus) query.paymentStatus = searchForm.paymentStatus
  if (searchForm.settlementStatus) query.settlementStatus = searchForm.settlementStatus
  if (searchForm.attendantId) query.attendantId = String(searchForm.attendantId)
  if (searchForm.dateRange?.length === 2) {
    const [startDate, endDate] = searchForm.dateRange
    if (startDate && endDate) {
      query.startDate = startDate
      query.endDate = endDate
    }
  }
  if (searchForm.page > 1) query.page = String(searchForm.page)
  if (searchForm.pageSize !== 20) query.pageSize = String(searchForm.pageSize)
  return query
}

function syncQuery() {
  const nextQuery = buildQuery()
  const currentQuery = route.query as Record<string, string | undefined>
  const currentKeys = Object.keys(currentQuery).filter((key) => currentQuery[key] !== undefined)
  const nextKeys = Object.keys(nextQuery)
  if (
    currentKeys.length === nextKeys.length &&
    nextKeys.every((key) => String(currentQuery[key] || '') === String(nextQuery[key] || ''))
  ) {
    return
  }
  router.replace({ path: route.path, query: nextQuery })
}

function applyRouteQuery(query: Record<string, unknown>) {
  searchForm.keyword = String(query.keyword || '')
  searchForm.status = String(query.status || '')
  searchForm.paymentStatus = String(query.paymentStatus || '')
  searchForm.settlementStatus = String(query.settlementStatus || '')
  searchForm.attendantId = query.attendantId ? Number(query.attendantId) : undefined
  searchForm.dateRange = query.startDate && query.endDate
    ? [String(query.startDate), String(query.endDate)]
    : []
  searchForm.page = parsePositiveNumber(query.page, 1)
  searchForm.pageSize = parsePositiveNumber(query.pageSize, 20)
}

async function loadData() {
  syncQuery()
  loading.value = true
  try {
    const params: any = {
      page: searchForm.page,
      pageSize: searchForm.pageSize,
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.paymentStatus) params.paymentStatus = searchForm.paymentStatus
    if (searchForm.settlementStatus) params.settlementStatus = searchForm.settlementStatus
    if (searchForm.attendantId) params.attendantId = searchForm.attendantId
    if (searchForm.dateRange?.length === 2) {
      params.startDate = searchForm.dateRange[0]
      params.endDate = searchForm.dateRange[1]
    }
    const res = await getOrderList(params)
    tableData.value = res.items || []
    total.value = res.total || 0
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  searchForm.page = 1
  loadData()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.paymentStatus = ''
  searchForm.settlementStatus = ''
  searchForm.attendantId = undefined
  searchForm.dateRange = []
  handleSearch()
}

async function handleExport() {
  const data = tableData.value.map((o: any) => ({
    '订单号': o.orderNumber,
    '服务对象': o.serviceTarget?.name || '',
    '服务对象电话': o.serviceTarget?.phone || '',
    '客户手机': o.user?.phone || '',
    '导诊回电': o.callbackContactPhone || '',
    '约号状态': hospitalBookingLabel(o),
    '服务类型': o.serviceType || '',
    '就诊医院': o.hospital || '',
    '科室': o.department || '',
    '服务时间': serviceScheduleLabel(o),
    '服务人员': o.attendant?.realName || '',
    '服务人员角色': staffRoleLabel(o.attendant?.primaryRole),
    '费用': o.totalFee || 0,
    '付款状态': paymentStatusLabel(o.paymentStatus),
    '付款方式': paymentMethodLabel(o.paymentMethod),
    '付款时间': o.paymentPaidAt ? formatDate(o.paymentPaidAt) : '',
    '交易流水号': o.paymentReference || '',
    '结算状态': settlementStatusLabel(o.settlementStatus),
    '结算时间': o.settledAt ? formatDate(o.settledAt) : '',
    '财务备注': o.settlementRemark || '',
    '状态': orderStatusMap[o.status]?.label || o.status,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '订单列表')
  XLSX.writeFile(wb, `陪了个伴_订单列表_${formatLocalDate(new Date())}.xlsx`)
}

async function loadAttendants() {
  try {
    const res = await getAttendantList({ page: 1, pageSize: 100 })
    attendantOptions.value = res.items || []
  } catch { /* */ }
}

const STAFF_ROLE_LABELS: Record<string, string> = {
  attendant: '陪诊员',
  nutritionist: '营养师',
  rehabilitator: '康复师',
  nurse: '护士',
  caregiver: '居家护理员',
  maternal_care: '月嫂',
  psychologist: '心理咨询师',
}

function staffRoleLabel(role?: string | null): string {
  if (!role) return '服务人员'
  return STAFF_ROLE_LABELS[role] || '服务人员'
}

function staffLabelWithRole(attendant: any): string {
  if (!attendant) return ''
  const name = attendant.realName || attendant.user?.nickname || '—'
  const role = staffRoleLabel(attendant.primaryRole)
  if (attendant.primaryRole && attendant.primaryRole !== 'attendant') {
    return `${name}（${role}）`
  }
  return name
}

function handlePageChange(page: number) {
  searchForm.page = page
  loadData()
}

function getAssetUrl(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

function getFinanceTypeLabel(type?: string) {
  return financeTypeLabelMap[type || ''] || type || '—'
}

function hospitalBookingLabel(row: any) {
  const s = row?.hospitalBookingStatus
  if (s === 'booked') return '已自行约号'
  if (s === 'pending_cs') return '待协助约号'
  return '—'
}

function getFinanceProofImages(row: any) {
  const images = Array.isArray(row?.proofImages) && row.proofImages.length
    ? row.proofImages
    : row?.proofUrl
      ? [row.proofUrl]
      : []
  return images.map((item: string) => getAssetUrl(item))
}

async function openQuickView(row: any) {
  quickViewVisible.value = true
  quickViewLoading.value = true
  quickTimelineLoading.value = true
  quickViewTab.value = 'info'
  quickOrder.value = null
  quickTimelines.value = []
  try {
    const [detail, timeline] = await Promise.all([
      getOrderDetail(row.id),
      getOrderTimeline(row.id, { includeInternal: true }).catch(() => []),
    ])
    quickOrder.value = detail
    quickTimelines.value = Array.isArray(timeline) ? timeline : []
  } catch {
    ElMessage.error('加载订单快览失败')
  } finally {
    quickViewLoading.value = false
    quickTimelineLoading.value = false
  }
}

function handleDetail(row: any) {
  router.push(`/service/orders/detail/${row.id}`)
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除订单 ${row.orderNumber} 吗？删除后不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' },
    )
    await deleteOrder(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // cancelled or error
  }
}

// ── 修改状态 Dialog ──
const statusDialogVisible = ref(false)
const statusDialogRow = ref<any>(null)
const statusDialogTarget = ref('')
const statusDialogLoading = ref(false)
const statusDialogReason = ref('')

// 根据当前状态返回可操作的下一状态选项
const VALID_NEXT_STATUSES: Record<string, { value: string; label: string; type: string }[]> = {
  pending_service: [
    { value: 'in_progress', label: '服务中', type: 'success' },
    { value: 'canceled', label: '已取消', type: 'danger' },
  ],
  in_progress: [
    { value: 'pending_review', label: '服务已结束', type: 'warning' },
    { value: 'completed', label: '已完成', type: 'success' },
    { value: 'emergency', label: '紧急', type: 'danger' },
  ],
  pending_review: [
    { value: 'completed', label: '已完成', type: 'success' },
    { value: 'in_progress', label: '返回服务中', type: 'primary' },
  ],
  emergency: [
    { value: 'in_progress', label: '服务中（解除紧急）', type: 'success' },
    { value: 'completed', label: '已完成', type: 'success' },
    { value: 'canceled', label: '已取消', type: 'danger' },
  ],
  pending_dispatch: [{ value: 'canceled', label: '已取消', type: 'danger' }],
  pending_accept: [
    { value: 'pending_service', label: '待服务（后台确认接单）', type: 'primary' },
    { value: 'pending_dispatch', label: '退回待派单', type: 'warning' },
    { value: 'canceled', label: '已取消', type: 'danger' },
  ],
  pending_grab: [
    { value: 'canceled', label: '已取消', type: 'danger' },
  ],
  pending_sign: [
    { value: 'pending_service', label: '待服务（标记已签到）', type: 'primary' },
    { value: 'canceled', label: '已取消', type: 'danger' },
  ],
}

function getNextStatusOptions(currentStatus: string) {
  return VALID_NEXT_STATUSES[currentStatus] || []
}

function selectedStatusLabel() {
  return getNextStatusOptions(statusDialogRow.value?.status)
    .find(opt => opt.value === statusDialogTarget.value)?.label || '目标状态'
}

function openStatusChangeDialog(row: any) {
  const options = getNextStatusOptions(row.status)
  if (!options.length) {
    ElMessage.info('当前状态无可操作的状态变更')
    return
  }
  statusDialogRow.value = row
  statusDialogTarget.value = options[0]?.value || ''
  statusDialogReason.value = ''
  statusDialogVisible.value = true
}

async function submitStatusChange() {
  if (!statusDialogRow.value || !statusDialogTarget.value) return
  statusDialogLoading.value = true
  try {
    const remark = statusDialogReason.value.trim()
    const payload: { status: string; cancelReason?: string; remark?: string } = { status: statusDialogTarget.value }
    if (remark) {
      if (statusDialogTarget.value === 'canceled') {
        payload.cancelReason = remark
      } else {
        payload.remark = remark
      }
    }
    await updateOrderStatus(statusDialogRow.value.id, payload)
    statusDialogRow.value.status = statusDialogTarget.value
    if (statusDialogTarget.value === 'canceled' && remark) {
      statusDialogRow.value.cancelReason = remark
    }
    ElMessage.success('订单状态已更新')
    statusDialogVisible.value = false
    await loadData()
  } catch {
    // handled by interceptor
  } finally {
    statusDialogLoading.value = false
  }
}

function handleRowAction(cmd: string, row: any) {
  if (cmd === 'quick') openQuickView(row)
  else if (cmd === 'dispatch') handleDetail(row)
  else if (cmd === 'status') openStatusChangeDialog(row)
  else if (cmd === 'delete') handleDelete(row)
}

function filterUnpaid() {
  searchForm.paymentStatus = 'unpaid'
  searchForm.page = 1
  loadData()
}

function filterPendingSettle() {
  searchForm.paymentStatus = 'paid'
  searchForm.settlementStatus = 'pending'
  searchForm.page = 1
  loadData()
}

onMounted(() => {
  loadData()
  loadAttendants()
})

watch(
  () => route.query,
  (query) => {
    const nextQuery = buildQuery()
    const routeQuery = query as Record<string, string | undefined>
    const routeKeys = Object.keys(routeQuery).filter((key) => routeQuery[key] !== undefined)
    const nextKeys = Object.keys(nextQuery)
    if (
      routeKeys.length === nextKeys.length &&
      nextKeys.every((key) => String(routeQuery[key] || '') === String(nextQuery[key] || ''))
    ) {
      return
    }
    applyRouteQuery(query as Record<string, unknown>)
    loadData()
  },
)
</script>

<template>
  <div class="page-container order-page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">订单中心</h2>
        <p class="page-subtitle">服务订单全流程管理 · 派单 · 回款 · 结算</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>导出 Excel
        </el-button>
        <el-button type="primary" @click="router.push('/service/orders/create')">
          <el-icon><Plus /></el-icon>新建订单
        </el-button>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="stat-grid">
      <div class="stat-tile">
        <div class="stat-tile__icon stat-tile__icon--primary">
          <el-icon :size="20"><List /></el-icon>
        </div>
        <div class="stat-tile__body">
          <div class="stat-tile__value">{{ total }}</div>
          <div class="stat-tile__label">订单总数</div>
        </div>
      </div>
      <div
        class="stat-tile"
        :class="{ 'stat-tile--clickable': unpaidCount > 0 }"
        @click="unpaidCount > 0 && filterUnpaid()"
      >
        <div class="stat-tile__icon stat-tile__icon--warn">
          <el-icon :size="20"><Warning /></el-icon>
        </div>
        <div class="stat-tile__body">
          <div class="stat-tile__value">{{ unpaidCount }}</div>
          <div class="stat-tile__label">待收款</div>
        </div>
        <span v-if="unpaidCount > 0" class="stat-tile__dot" />
      </div>
      <div
        class="stat-tile"
        :class="{ 'stat-tile--clickable': pendingSettleCount > 0 }"
        @click="pendingSettleCount > 0 && filterPendingSettle()"
      >
        <div class="stat-tile__icon stat-tile__icon--info">
          <el-icon :size="20"><Clock /></el-icon>
        </div>
        <div class="stat-tile__body">
          <div class="stat-tile__value">{{ pendingSettleCount }}</div>
          <div class="stat-tile__label">待结算</div>
        </div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__icon stat-tile__icon--success">
          <el-icon :size="20"><Wallet /></el-icon>
        </div>
        <div class="stat-tile__body">
          <div class="stat-tile__value stat-tile__value--money">{{ formatMoney(currentPageRevenue) }}</div>
          <div class="stat-tile__label">当页已回款</div>
        </div>
      </div>
    </div>

    <!-- 主卡片：筛选 + 表格 合为一体 -->
    <div class="main-card">
      <!-- 筛选区 -->
      <div class="toolbar">
        <div class="toolbar__filters">
          <el-input
            v-model="searchForm.keyword"
            placeholder="订单号 / 客户姓名"
            clearable
            class="toolbar__search"
            @keyup.enter="handleSearch"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="searchForm.status" placeholder="订单状态" clearable class="toolbar__select">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-select v-model="searchForm.paymentStatus" placeholder="付款" clearable class="toolbar__select toolbar__select--narrow">
            <el-option v-for="s in paymentStatusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-select v-model="searchForm.settlementStatus" placeholder="结算" clearable class="toolbar__select toolbar__select--narrow">
            <el-option v-for="s in settlementStatusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-select v-model="searchForm.attendantId" placeholder="服务人员" clearable filterable class="toolbar__select">
            <el-option
              v-for="a in attendantOptions"
              :key="a.id"
              :label="staffLabelWithRole(a)"
              :value="a.id"
            />
          </el-select>
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="toolbar__date"
          />
        </div>
        <div class="toolbar__actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
      </div>

      <!-- 表格本体 -->
      <el-table
        :data="tableData"
        v-loading="loading"
        highlight-current-row
        class="order-table"
      >
        <el-table-column label="订单信息" min-width="260">
          <template #default="{ row }">
            <div class="cell-order">
              <div class="cell-order__number" @click="handleDetail(row)">{{ row.orderNumber }}</div>
              <div class="cell-order__meta">
                <el-tag size="small" effect="plain">{{ row.serviceType || '未定' }}</el-tag>
                <el-tag
                  v-if="row.hospitalBookingStatus === 'booked'"
                  size="small" type="success"
                >已约号</el-tag>
                <el-tag
                  v-else-if="row.hospitalBookingStatus === 'pending_cs'"
                  size="small" type="warning"
                >待协助约号</el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="服务对象" min-width="160">
          <template #default="{ row }">
            <div class="cell-target">
              <div class="cell-target__name">{{ row.serviceTarget?.name || '—' }}</div>
              <div class="cell-target__phone" v-if="row.serviceTarget?.phone">{{ row.serviceTarget.phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="服务时间" width="200">
          <template #default="{ row }">
            <div class="cell-time">
              <el-icon class="cell-time__icon"><Calendar /></el-icon>
              <span>{{ serviceScheduleLabel(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="服务人员" width="160">
          <template #default="{ row }">
            <span v-if="row.needAttendant === false" class="cell-muted">不需要</span>
            <template v-else-if="row.attendant?.realName">
              <span class="cell-attendant">{{ row.attendant.realName }}</span>
              <el-tag
                v-if="row.attendant?.primaryRole && row.attendant.primaryRole !== 'attendant'"
                size="small"
                effect="plain"
                class="cell-role-tag"
              >{{ staffRoleLabel(row.attendant.primaryRole) }}</el-tag>
            </template>
            <span v-else class="cell-muted cell-muted--alert">待分配</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="(orderStatusMap[row.status]?.type as any) || 'info'" size="small">
              {{ orderStatusMap[row.status]?.label || row.status }}
            </el-tag>
            <el-button
              v-if="getNextStatusOptions(row.status).length"
              link
              type="primary"
              size="small"
              class="status-change-link"
              @click="openStatusChangeDialog(row)"
            >
              修改
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            <div v-if="row.totalFee != null" class="cell-fee">
              <span class="cell-fee__amount">{{ formatMoney(row.totalFee) }}</span>
              <el-tag
                :type="paymentStatusTagType(row.paymentStatus)"
                size="small"
              >{{ paymentStatusLabel(row.paymentStatus) }}</el-tag>
            </div>
            <span v-else class="cell-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="120" align="center">
          <template #default="{ row }">
            <div class="cell-actions">
              <el-button link type="primary" @click="handleDetail(row)">详情</el-button>
              <el-dropdown trigger="click" @command="(cmd: string) => handleRowAction(cmd, row)">
                <button class="icon-action" title="更多">
                  <el-icon :size="14"><MoreFilled /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="quick">
                      <el-icon><View /></el-icon>快速预览
                    </el-dropdown-item>
                    <el-dropdown-item v-if="row.status === 'pending_dispatch'" command="dispatch">
                      <el-icon><Promotion /></el-icon>去派单
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="getNextStatusOptions(row.status).length"
                      command="status"
                    >
                      <el-icon><Switch /></el-icon>修改状态
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <el-icon color="#dc2626"><Delete /></el-icon>
                      <span style="color:#dc2626">删除订单</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页条 -->
      <div class="pagination-bar">
        <div class="pagination-bar__left">
          <span class="pagination-bar__info">
            第 {{ (searchForm.page - 1) * searchForm.pageSize + 1 }}–{{ Math.min(searchForm.page * searchForm.pageSize, total) }} 条，共 {{ total }} 条
          </span>
          <el-radio-group v-model="searchForm.pageSize" size="small" @change="() => { searchForm.page = 1; loadData() }">
            <el-radio-button :value="20">20 / 页</el-radio-button>
            <el-radio-button :value="50">50 / 页</el-radio-button>
            <el-radio-button :value="100">100 / 页</el-radio-button>
          </el-radio-group>
        </div>
        <el-pagination
          v-model:current-page="searchForm.page"
          :total="total"
          :page-size="searchForm.pageSize"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 修改状态 Dialog -->
    <el-dialog
      v-model="statusDialogVisible"
      title="修改订单状态"
      width="420px"
      destroy-on-close
    >
      <div v-if="statusDialogRow">
        <div style="margin-bottom:16px;">
          <span style="font-size:13px;color:#606266;">当前状态：</span>
          <el-tag :type="(orderStatusMap[statusDialogRow.status]?.type as any) || 'info'" size="small">
            {{ orderStatusMap[statusDialogRow.status]?.label || statusDialogRow.status }}
          </el-tag>
        </div>
        <el-form label-position="top">
          <el-form-item label="将状态修改为">
            <el-radio-group v-model="statusDialogTarget" style="display:flex;flex-direction:column;gap:10px;">
              <el-radio
                v-for="opt in getNextStatusOptions(statusDialogRow.status)"
                :key="opt.value"
                :value="opt.value"
              >
                <el-tag :type="(opt.type as any)" size="small" effect="plain">{{ opt.label }}</el-tag>
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="statusDialogTarget === 'canceled' ? '取消原因（选填）' : '变更备注（选填）'">
            <el-input
              v-model="statusDialogReason"
              type="textarea"
              :rows="3"
              :placeholder="`说明为什么修改为${selectedStatusLabel()}，便于时间线留痕`"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="statusDialogLoading" @click="submitStatusChange">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 快速预览抽屉 -->
    <el-drawer v-model="quickViewVisible" title="订单快览" size="48%" destroy-on-close>
      <div v-loading="quickViewLoading">
        <template v-if="quickOrder">
          <div class="quick-header">
            <div class="quick-header__meta">
              <div class="quick-order-number">{{ quickOrder.orderNumber }}</div>
              <div class="quick-tags">
                <el-tag :type="(orderStatusMap[quickOrder.status]?.type as any) || 'info'" size="small">
                  {{ orderStatusMap[quickOrder.status]?.label || quickOrder.status }}
                </el-tag>
                <el-tag size="small" type="primary">{{ quickOrder.serviceType || '服务类型待定' }}</el-tag>
                <el-tag
                  v-if="quickOrder.attendant?.primaryRole && quickOrder.attendant.primaryRole !== 'attendant'"
                  size="small"
                  type="success"
                >
                  {{ staffRoleLabel(quickOrder.attendant.primaryRole) }}
                </el-tag>
                <el-tag size="small" type="warning" v-if="quickOrder.needAttendant === false">无需服务人员</el-tag>
              </div>
            </div>
            <div class="quick-header__actions">
              <el-button size="small" @click="handleDetail(quickOrder)">完整详情</el-button>
              <el-button
                size="small"
                v-if="quickOrder.user?.id"
                @click="router.push(`/customer-center/customers/detail/${quickOrder.user.id}`)"
              >客户档案</el-button>
              <el-button
                size="small"
                v-if="quickOrder.attendant?.id"
                @click="router.push(`/dispatch/attendants/detail/${quickOrder.attendant.id}`)"
              >服务人员档案</el-button>
              <el-button
                type="primary"
                size="small"
                v-if="quickOrder.status === 'pending_dispatch'"
                @click="handleDetail(quickOrder)"
              >去派单</el-button>
            </div>
          </div>

          <div
            v-if="quickOrder.totalFee"
            class="payment-banner"
            :class="{
              'payment-banner--paid': quickOrder.paymentStatus === 'paid',
              'payment-banner--refunded': quickOrder.paymentStatus === 'refunded',
              'payment-banner--unpaid': !quickOrder.paymentStatus || quickOrder.paymentStatus === 'unpaid',
            }"
          >
            <div class="payment-banner__main">
              <span class="payment-banner__fee">{{ formatMoney(quickOrder.totalFee) }}</span>
              <el-tag
                :type="paymentStatusTagType(quickOrder.paymentStatus)"
                size="small"
              >
                {{ paymentStatusLabel(quickOrder.paymentStatus) }}
              </el-tag>
              <el-tag
                v-if="quickOrder.paymentStatus === 'paid'"
                :type="settlementStatusTagType(quickOrder.settlementStatus)"
                size="small"
              >
                {{ settlementStatusLabel(quickOrder.settlementStatus) }}
              </el-tag>
            </div>
            <div class="payment-banner__sub" v-if="quickOrder.paymentStatus === 'paid'">
              <span v-if="quickOrder.paymentMethod">{{ paymentMethodLabel(quickOrder.paymentMethod) }}</span>
              <span v-if="quickOrder.paymentPaidAt"> · 付款时间：{{ formatDate(quickOrder.paymentPaidAt) }}</span>
              <span v-if="quickOrder.paymentReference"> · 流水号：{{ quickOrder.paymentReference }}</span>
            </div>
            <div class="payment-banner__sub" v-if="quickOrder.settlementStatus === 'settled' && quickOrder.settledAt">
              <span>结算时间：{{ formatDate(quickOrder.settledAt) }}</span>
              <span v-if="quickOrder.settlementRemark"> · {{ quickOrder.settlementRemark }}</span>
            </div>
          </div>

          <el-tabs v-model="quickViewTab" style="margin-top: 16px;">
            <el-tab-pane label="基本信息" name="info">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="客户">
                  {{ quickOrder.user?.nickname || quickOrder.user?.phone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="服务对象">
                  {{ quickOrder.serviceTarget?.name || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="服务对象电话">
                  {{ quickOrder.serviceTarget?.phone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="客户手机">
                  {{ quickOrder.user?.phone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="导诊回电">
                  {{ quickOrder.callbackContactPhone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="约号状态">
                  {{ hospitalBookingLabel(quickOrder) }}
                </el-descriptions-item>
                <el-descriptions-item v-if="quickOrder.hospitalDirectory?.name" label="名录医院">
                  {{ quickOrder.hospitalDirectory.name }}（{{ quickOrder.hospitalDirectory.city }}）
                </el-descriptions-item>
                <el-descriptions-item label="服务时间">
                  {{ serviceScheduleLabel(quickOrder) }}
                </el-descriptions-item>
                <el-descriptions-item :label="quickOrder.attendant?.primaryRole && quickOrder.attendant.primaryRole !== 'attendant' ? staffRoleLabel(quickOrder.attendant.primaryRole) : '陪诊员'">
                  {{ quickOrder.needAttendant === false ? '不需要' : (quickOrder.attendant?.realName || '未分配') }}
                </el-descriptions-item>
                <el-descriptions-item label="就诊医院">
                  {{ quickOrder.hospital || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="就诊科室">
                  {{ quickOrder.department || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">
                  {{ quickOrder.createdAt ? formatDate(quickOrder.createdAt) : '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="备注" :span="2">
                  {{ quickOrder.notes || '—' }}
                </el-descriptions-item>
                <el-descriptions-item v-if="quickOrder.cancelReason" label="取消原因" :span="2">
                  {{ quickOrder.cancelReason }}
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>

            <el-tab-pane name="payment">
              <template #label>
                <span>费用与回款</span>
                <el-badge
                  v-if="quickOrder.totalFee && quickOrder.paymentStatus !== 'paid'"
                  value="待收"
                  type="danger"
                  style="margin-left: 6px;"
                />
              </template>
              <div class="payment-detail">
                <div class="payment-section">
                  <div class="payment-section__title">费用构成</div>
                  <div class="payment-breakdown">
                    <div class="payment-breakdown__row" v-if="quickOrder.baseFee">
                      <span>基础服务费</span>
                      <span class="amount">{{ formatMoney(quickOrder.baseFee) }}</span>
                    </div>
                    <template v-if="quickOrder.checkupOptionalItems?.length">
                      <div
                        class="payment-breakdown__row payment-breakdown__row--sub"
                        v-for="(opt, i) in quickOrder.checkupOptionalItems"
                        :key="i"
                      >
                        <span>{{ opt.name }}（附加项）</span>
                        <span class="amount">{{ formatMoney(opt.price) }}</span>
                      </div>
                    </template>
                    <template v-if="quickOrder.additionalServiceItems?.length">
                      <div
                        class="payment-breakdown__row payment-breakdown__row--sub"
                        v-for="(item, i) in quickOrder.additionalServiceItems"
                        :key="item.id || i"
                      >
                        <span>{{ item.name }}</span>
                        <span class="amount">{{ formatMoney(item.amount) }}</span>
                      </div>
                    </template>
                    <div class="payment-breakdown__row payment-breakdown__row--total">
                      <span>合计</span>
                      <span class="amount amount--total">{{ quickOrder.totalFee ? formatMoney(quickOrder.totalFee) : '—' }}</span>
                    </div>
                  </div>
                </div>

                <div class="payment-section" v-if="quickOrder.attendantFee != null">
                  <div class="payment-section__title">服务人员收入</div>
                  <div class="payment-breakdown">
                    <div class="payment-breakdown__row">
                      <span>{{ quickOrder.attendantFeeType || '基础收入' }}</span>
                      <span class="amount amount--attendant">{{ formatMoney(quickOrder.attendantFee) }}</span>
                    </div>
                    <template v-if="quickOrder.attendantExtraIncomeItems?.length">
                      <div
                        class="payment-breakdown__row payment-breakdown__row--sub"
                        v-for="(item, i) in quickOrder.attendantExtraIncomeItems"
                        :key="item.id || i"
                      >
                        <span>{{ item.name }}</span>
                        <span class="amount">{{ formatMoney(item.amount) }}</span>
                      </div>
                    </template>
                  </div>
                </div>

                <div class="payment-section">
                  <div class="payment-section__title">付款信息</div>
                  <el-descriptions :column="1" border size="small">
                    <el-descriptions-item label="付款状态">
                      <el-tag :type="paymentStatusTagType(quickOrder.paymentStatus)" size="small">
                        {{ paymentStatusLabel(quickOrder.paymentStatus) }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="付款方式">
                      {{ paymentMethodLabel(quickOrder.paymentMethod) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="付款时间">
                      {{ quickOrder.paymentPaidAt ? formatDate(quickOrder.paymentPaidAt) : '—' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="交易流水号">
                      {{ quickOrder.paymentReference || '—' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="结算状态">
                      <el-tag :type="settlementStatusTagType(quickOrder.settlementStatus)" size="small">
                        {{ settlementStatusLabel(quickOrder.settlementStatus) }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="结算时间">
                      {{ quickOrder.settledAt ? formatDate(quickOrder.settledAt) : '—' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="财务备注">
                      {{ quickOrder.settlementRemark || '—' }}
                    </el-descriptions-item>
                  </el-descriptions>
                </div>

                <div style="margin-top: 16px; text-align: center;">
                  <el-button type="primary" @click="handleDetail(quickOrder)">
                    <el-icon><Edit /></el-icon> 设置费用/回款
                  </el-button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`时间线 (${quickTimelines.length})`" name="timeline">
              <div v-loading="quickTimelineLoading">
                <el-timeline v-if="quickTimelines.length">
                  <el-timeline-item
                    v-for="item in quickTimelines"
                    :key="item.id"
                    :timestamp="formatDate(item.createdAt)"
                    placement="top"
                  >
                    <el-card shadow="never">
                      <div style="display:flex;justify-content:space-between;gap:8px;">
                        <div style="flex:1;min-width:0;">
                          <el-tag size="small" style="margin-right:8px;">
                            {{ timelineTypeLabelMap[item.type] || item.type }}
                          </el-tag>
                          <span v-if="item.operator?.nickname || item.operator?.realName" style="font-size:12px;color:var(--el-text-color-secondary);margin-right:8px;">
                            {{ item.operator?.nickname || item.operator?.realName }}
                          </span>
                          <span>{{ item.content || '—' }}</span>
                        </div>
                        <el-tag size="small" :type="item.visibleToUser ? 'success' : 'info'">
                          {{ item.visibleToUser ? '用户可见' : '内部' }}
                        </el-tag>
                      </div>
                    </el-card>
                  </el-timeline-item>
                </el-timeline>
                <el-empty v-else description="暂无时间线记录" />
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`费用记录 (${quickOrder.financeRecords?.length || 0})`" name="finance">
              <el-table v-if="quickOrder.financeRecords?.length" :data="quickOrder.financeRecords" stripe size="small">
                <el-table-column label="类型" width="120">
                  <template #default="{ row }">{{ getFinanceTypeLabel(row.type) }}</template>
                </el-table-column>
                <el-table-column label="金额" width="120">
                  <template #default="{ row }">{{ formatMoney(row.amount || 0) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'" size="small">
                      {{ row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已驳回' : '待审核' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="说明" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.description || '—' }}</template>
                </el-table-column>
                <el-table-column label="凭证" min-width="220">
                  <template #default="{ row }">
                    <div v-if="getFinanceProofImages(row).length" style="display:flex;gap:8px;flex-wrap:wrap;">
                      <el-image
                        v-for="(img, index) in getFinanceProofImages(row)"
                        :key="img + index"
                        :src="img"
                        :preview-src-list="getFinanceProofImages(row)"
                        fit="cover"
                        style="width:56px;height:56px;border-radius:6px;border:1px solid #e2e8f0;"
                      />
                    </div>
                    <span v-else style="color:var(--el-text-color-secondary);">无凭证</span>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无费用记录" />
            </el-tab-pane>
          </el-tabs>
        </template>
        <el-empty v-else description="请选择订单" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.order-page {
  max-width: 1700px;
}

// ── 页头 ──
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header__meta {
  min-width: 0;
}

// ── 统计磁贴 ──
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  background: $card-bg;
  border: 1px solid $card-border;
  border-radius: $radius-lg;
  padding: 18px 20px;
  box-shadow: $card-shadow;
  transition: all 0.18s ease;

  &--clickable {
    cursor: pointer;

    &:hover {
      border-color: $primary-200;
      box-shadow: $card-shadow-hover;
      transform: translateY(-1px);
    }
  }
}

.stat-tile__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: $radius-md;
  flex-shrink: 0;

  &--primary { background: $primary-50; color: $primary-dark; }
  &--warn { background: $warning-bg; color: $warning; }
  &--info { background: $info-bg; color: $info; }
  &--success { background: $success-bg; color: $success; }
}

.stat-tile__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.stat-tile__value {
  font-size: 26px;
  font-weight: 700;
  color: $text-primary;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;

  &--money { font-size: 22px; }
}

.stat-tile__label {
  font-size: 12px;
  color: $text-secondary;
  font-weight: 500;
}

.stat-tile__dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $danger;

  &::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: $danger;
    opacity: 0.3;
    animation: dot-pulse 2s infinite;
  }
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.6); opacity: 0; }
}

// ── 主卡片：筛选+表格合并 ──
.main-card {
  background: $card-bg;
  border: 1px solid $card-border;
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: $card-shadow;
}

// ── Toolbar 筛选栏 ──
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid $divider;
  background: $card-bg;
  flex-wrap: wrap;
}

.toolbar__filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.toolbar__search {
  width: 220px;
}

.toolbar__select {
  width: 140px;

  &--narrow {
    width: 110px;
  }
}

.toolbar__date {
  width: 260px;
}

.toolbar__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

// ── 表格 ──
.order-table {
  :deep(.el-table__header-wrapper th.el-table__cell) {
    background: $slate-50;
    color: $text-secondary;
    font-weight: 600;
    font-size: 12px;
    padding: 11px 0;
    letter-spacing: 0.01em;
    border-bottom: 1px solid $divider;
  }

  :deep(.el-table__body td.el-table__cell) {
    padding: 14px 0;
    color: $text-primary;
    border-bottom: 1px solid $divider;
  }

  :deep(.el-table__row:last-child td.el-table__cell) {
    border-bottom: none;
  }

  :deep(.el-table__row) {
    transition: background 0.15s ease;
  }

  :deep(.el-table__fixed-right::before),
  :deep(.el-table__fixed::before) {
    display: none;
  }
}

// ── 单元格 ──
.cell-order {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cell-order__number {
  font-size: 13px;
  font-weight: 600;
  color: $primary-dark;
  cursor: pointer;
  font-family: 'SF Mono', 'Consolas', 'Menlo', ui-monospace, monospace;
  letter-spacing: 0.2px;

  &:hover {
    color: $primary;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}

.cell-order__meta {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.cell-target {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cell-target__name {
  font-weight: 500;
  color: $text-primary;
  font-size: 13px;
}

.cell-target__phone {
  font-size: 12px;
  color: $text-tertiary;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.cell-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $text-regular;
}

.cell-time__icon {
  color: $slate-400;
  flex-shrink: 0;
}

.cell-attendant {
  font-weight: 500;
  color: $text-primary;
  font-size: 13px;
}

.cell-role-tag {
  margin-left: 6px;
  font-size: 11px;
  vertical-align: middle;
}

.cell-muted {
  color: $text-tertiary;
  font-size: 13px;

  &--alert {
    color: $warning;
    font-weight: 500;
  }
}

.status-change-link {
  display: block;
  margin: 4px auto 0;
}

.cell-fee {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.cell-fee__amount {
  font-weight: 600;
  color: $text-primary;
  font-size: 14px;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

// ── 操作列 ──
.cell-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.icon-action {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  color: $slate-500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: $slate-100;
    border-color: $border-base;
    color: $text-primary;
  }
}

// ── 分页条 ──
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-top: 1px solid $divider;
  background: $card-bg;
  flex-wrap: wrap;
}

.pagination-bar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.pagination-bar__info {
  font-size: 13px;
  color: $text-tertiary;
}

// ── 快速预览 ──
.quick-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.quick-header__meta {
  flex: 1;
}

.quick-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.quick-order-number {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: -0.01em;
  font-family: 'SF Mono', 'Consolas', ui-monospace, monospace;
}

.quick-tags {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.payment-banner {
  padding: 14px 18px;
  border-radius: $radius-lg;
  margin-bottom: 0;
  border: 1px solid;

  &--paid {
    background: $success-bg;
    border-color: $success-border;
  }

  &--refunded {
    background: $danger-bg;
    border-color: $danger-border;
  }

  &--unpaid {
    background: $warning-bg;
    border-color: $warning-border;
  }
}

.payment-banner__main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.payment-banner__fee {
  font-size: 22px;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.payment-banner__sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 6px;
}

.payment-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.payment-section__title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 10px;
  padding-left: 10px;
  border-left: 3px solid $primary;
}

.payment-breakdown {
  border: 1px solid $border-base;
  border-radius: $radius-md;
  overflow: hidden;
}

.payment-breakdown__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  font-size: 13px;
  color: $text-regular;
  border-bottom: 1px solid $divider;

  &:last-child {
    border-bottom: none;
  }

  &--sub {
    background: $slate-50;
    color: $text-secondary;
    padding-left: 24px;
    font-size: 12px;
  }

  &--total {
    background: $slate-50;
    font-weight: 600;
    color: $text-primary;
  }
}

.amount {
  font-weight: 600;
  color: $text-primary;
  font-variant-numeric: tabular-nums;

  &--total {
    font-size: 15px;
    color: $text-primary;
  }

  &--attendant {
    color: $primary-dark;
  }
}

@media (max-width: 1200px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 900px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar__actions {
    justify-content: flex-end;
  }
}
</style>
