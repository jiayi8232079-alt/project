<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOrderList, getOrderDetail, updateOrder } from '@/api/order'
import { formatDate, formatMoney, orderStatusMap } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const detailLoading = ref(false)
const savingStatus = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const detailVisible = ref(false)
const currentOrder = ref<any>(null)

const settlementStatusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待结算', type: 'warning' },
  settled: { label: '已结算', type: 'success' },
}

const paymentStatusMap: Record<string, { label: string; type: string }> = {
  unpaid: { label: '未付款', type: 'danger' },
  paid: { label: '已付款', type: 'success' },
  refunded: { label: '已退款', type: 'info' },
}

const paymentMethodMap: Record<string, string> = {
  wechat: '微信转账',
  alipay: '支付宝转账',
  qr_transfer: '收款码转账',
  bank_transfer: '银行卡转账',
  cash: '现金',
  other: '其他',
}

function toDateTimeInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const searchForm = reactive({
  keyword: String(route.query.keyword || ''),
  status: String(route.query.status || ''),
  settlementStatus: String(route.query.settlementStatus || ''),
  paymentStatus: String(route.query.paymentStatus || ''),
  page: parsePositiveNumber(route.query.page, 1),
  pageSize: parsePositiveNumber(route.query.pageSize, 20),
})

function buildQuery() {
  const query: Record<string, string> = {}
  if (searchForm.keyword) query.keyword = searchForm.keyword
  if (searchForm.status) query.status = searchForm.status
  if (searchForm.settlementStatus) query.settlementStatus = searchForm.settlementStatus
  if (searchForm.paymentStatus) query.paymentStatus = searchForm.paymentStatus
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
  searchForm.settlementStatus = String(query.settlementStatus || '')
  searchForm.paymentStatus = String(query.paymentStatus || '')
  searchForm.page = parsePositiveNumber(query.page, 1)
  searchForm.pageSize = parsePositiveNumber(query.pageSize, 20)
}

function getSettlementBreakdown(order: any) {
  return order?.settlementBreakdown || null
}

function getCheckupOptionalTotal(order: any) {
  const breakdown = getSettlementBreakdown(order)
  if (breakdown) return Number(breakdown.checkupOptionalTotal || 0)
  return Array.isArray(order?.checkupOptionalItems)
    ? order.checkupOptionalItems.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0)
    : 0
}

function getAdditionalServiceTotal(order: any) {
  const breakdown = getSettlementBreakdown(order)
  if (breakdown) return Number(breakdown.additionalServiceTotal || 0)
  return Array.isArray(order?.additionalServiceItems)
    ? order.additionalServiceItems.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)
    : 0
}

const currentSettlementItems = computed(() => {
  const items = currentOrder.value?.settlementBreakdown?.items
  return Array.isArray(items)
    ? items.map((item: any) => ({
      label: item.label || '费用项',
      amount: Number(item.amount || 0),
      note: item.note || '',
    }))
    : []
})
const currentSettlementTotal = computed(() => Number(currentOrder.value?.settlementBreakdown?.total || 0))

async function loadData() {
  syncQuery()
  loading.value = true
  try {
    const params: any = { page: searchForm.page, pageSize: searchForm.pageSize }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.settlementStatus) params.settlementStatus = searchForm.settlementStatus
    if (searchForm.paymentStatus) params.paymentStatus = searchForm.paymentStatus
    const res = await getOrderList(params)
    tableData.value = res.items || []
    total.value = res.total || 0
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
  searchForm.settlementStatus = ''
  searchForm.paymentStatus = ''
  searchForm.page = 1
  searchForm.pageSize = 20
  loadData()
}

function handlePageChange(page: number) {
  searchForm.page = page
  loadData()
}

async function openDetail(row: any) {
  detailVisible.value = true
  detailLoading.value = true
  currentOrder.value = null
  try {
    const detail = await getOrderDetail(row.id)
    currentOrder.value = {
      ...detail,
      paymentPaidAtInput: toDateTimeInputValue(detail.paymentPaidAt),
      paymentReferenceInput: detail.paymentReference || '',
      settledAtInput: toDateTimeInputValue(detail.settledAt),
      settlementRemarkInput: detail.settlementRemark || '',
    }
  } finally {
    detailLoading.value = false
  }
}

async function handleSaveSettlementStatus() {
  if (!currentOrder.value) return
  savingStatus.value = true
  try {
    await updateOrder(currentOrder.value.id, {
      settlementStatus: currentOrder.value.settlementStatus,
      paymentStatus: currentOrder.value.paymentStatus,
      paymentMethod: currentOrder.value.paymentStatus === 'unpaid' ? null : (currentOrder.value.paymentMethod || null),
      paymentPaidAt: currentOrder.value.paymentPaidAtInput || null,
      paymentReference: currentOrder.value.paymentReferenceInput || null,
      settledAt: currentOrder.value.settlementStatus === 'settled' ? (currentOrder.value.settledAtInput || null) : null,
      settlementRemark: currentOrder.value.settlementRemarkInput || null,
    })
    ElMessage.success('结算状态已更新')
    await Promise.all([openDetail(currentOrder.value), loadData()])
  } finally {
    savingStatus.value = false
  }
}

onMounted(loadData)

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
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">订单回款</h2>
        <p class="page-subtitle">统一维护订单收款、结算状态与财务备注，避免与报销审核混淆。</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="router.push('/finance/settlement')">查看报销审核</el-button>
      </div>
    </div>

    <div class="page-guide">
      <span class="page-guide__label">流程建议</span>
      <el-tag size="small" effect="plain">1 先筛选待结算/未付款</el-tag>
      <el-tag size="small" effect="plain">2 更新付款与结算信息</el-tag>
      <el-tag size="small" effect="plain">3 记录流水号与备注</el-tag>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
      title="订单维度的收款与结算"
      description="维护客户付款方式、付款时间、订单结算状态等；陪诊员上传的报销凭证请在「报销审核」中处理，避免与订单回款混淆。"
    />

    <el-card shadow="never" class="filter-bar">
      <el-form inline>
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.keyword"
            placeholder="订单号/客户/服务对象"
            clearable
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 130px">
            <el-option
              v-for="(meta, status) in orderStatusMap"
              :key="status"
              :label="meta.label"
              :value="status"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="结算">
          <el-select v-model="searchForm.settlementStatus" placeholder="全部" clearable style="width: 130px">
            <el-option
              v-for="(meta, status) in settlementStatusMap"
              :key="status"
              :label="meta.label"
              :value="status"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="付款">
          <el-select v-model="searchForm.paymentStatus" placeholder="全部" clearable style="width: 130px">
            <el-option
              v-for="(meta, status) in paymentStatusMap"
              :key="status"
              :label="meta.label"
              :value="status"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" highlight-current-row>
        <el-table-column prop="orderNumber" label="订单号" min-width="180" />
        <el-table-column label="客户" width="120">
          <template #default="{ row }">{{ row.user?.nickname || row.user?.phone || '—' }}</template>
        </el-table-column>
        <el-table-column label="服务对象" width="120">
          <template #default="{ row }">{{ row.serviceTarget?.name || '—' }}</template>
        </el-table-column>
        <el-table-column prop="serviceType" label="服务类型" width="120" />
        <el-table-column label="基础服务费" width="120">
          <template #default="{ row }">{{ row.baseFee ? formatMoney(row.baseFee) : '—' }}</template>
        </el-table-column>
        <el-table-column label="体检附加项目" width="130">
          <template #default="{ row }">{{ getCheckupOptionalTotal(row) ? formatMoney(getCheckupOptionalTotal(row)) : '—' }}</template>
        </el-table-column>
        <el-table-column label="附加服务费" width="120">
          <template #default="{ row }">{{ getAdditionalServiceTotal(row) ? formatMoney(getAdditionalServiceTotal(row)) : '—' }}</template>
        </el-table-column>
        <el-table-column label="总费用" width="120">
          <template #default="{ row }">{{ row.settlementBreakdown?.total ? formatMoney(row.settlementBreakdown.total) : (row.totalFee ? formatMoney(row.totalFee) : '—') }}</template>
        </el-table-column>
        <el-table-column label="结算状态" width="110">
          <template #default="{ row }">
            <el-tag :type="(settlementStatusMap[row.settlementStatus]?.type as any) || 'info'" size="small">
              {{ settlementStatusMap[row.settlementStatus]?.label || row.settlementStatus || '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="付款状态" width="110">
          <template #default="{ row }">
            <el-tag :type="(paymentStatusMap[row.paymentStatus]?.type as any) || 'info'" size="small">
              {{ paymentStatusMap[row.paymentStatus]?.label || row.paymentStatus || '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="付款方式" width="130">
          <template #default="{ row }">{{ paymentMethodMap[row.paymentMethod] || '—' }}</template>
        </el-table-column>
        <el-table-column label="付款时间" width="170">
          <template #default="{ row }">{{ row.paymentPaidAt ? formatDate(row.paymentPaidAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="(orderStatusMap[row.status]?.type as any) || 'info'" size="small">
              {{ orderStatusMap[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ row.createdAt ? formatDate(row.createdAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetail(row)">结算详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="searchForm.page"
          :total="total"
          :page-size="searchForm.pageSize"
          layout="total, prev, pager, next"
          background
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" title="订单结算详情" size="46%" destroy-on-close>
      <div v-loading="detailLoading">
        <template v-if="currentOrder">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订单号">{{ currentOrder.orderNumber || '—' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="(orderStatusMap[currentOrder.status]?.type as any) || 'info'" size="small">
                {{ orderStatusMap[currentOrder.status]?.label || currentOrder.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="客户">{{ currentOrder.user?.nickname || currentOrder.user?.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="服务对象">{{ currentOrder.serviceTarget?.name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="服务类型">{{ currentOrder.serviceType || '—' }}</el-descriptions-item>
            <el-descriptions-item label="服务时间">{{ currentOrder.serviceTime ? formatDate(currentOrder.serviceTime) : '—' }}</el-descriptions-item>
            <el-descriptions-item label="结算状态">
              <el-tag :type="(settlementStatusMap[currentOrder.settlementStatus]?.type as any) || 'info'" size="small">
                {{ settlementStatusMap[currentOrder.settlementStatus]?.label || currentOrder.settlementStatus || '—' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="付款状态">
              <el-tag :type="(paymentStatusMap[currentOrder.paymentStatus]?.type as any) || 'info'" size="small">
                {{ paymentStatusMap[currentOrder.paymentStatus]?.label || currentOrder.paymentStatus || '—' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="付款方式">
              {{ paymentMethodMap[currentOrder.paymentMethod] || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="付款时间">
              {{ currentOrder.paymentPaidAt ? formatDate(currentOrder.paymentPaidAt) : '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="交易流水号">
              {{ currentOrder.paymentReference || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="结算时间">
              {{ currentOrder.settledAt ? formatDate(currentOrder.settledAt) : '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="财务备注" :span="1">
              {{ currentOrder.settlementRemark || '—' }}
            </el-descriptions-item>
          </el-descriptions>

          <div style="margin-top: 16px; padding: 16px; border: 1px solid #ebeef5; border-radius: 10px; background: #fafafa;">
            <div style="font-weight: 600; margin-bottom: 12px;">结算处理</div>
            <el-row :gutter="12">
              <el-col :span="12">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">结算状态</div>
                <el-select v-model="currentOrder.settlementStatus" style="width: 100%;">
                  <el-option
                    v-for="(meta, status) in settlementStatusMap"
                    :key="status"
                    :label="meta.label"
                    :value="status"
                  />
                </el-select>
              </el-col>
              <el-col :span="12">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">付款状态</div>
                <el-select v-model="currentOrder.paymentStatus" style="width: 100%;">
                  <el-option
                    v-for="(meta, status) in paymentStatusMap"
                    :key="status"
                    :label="meta.label"
                    :value="status"
                  />
                </el-select>
              </el-col>
            </el-row>
            <el-row :gutter="12" style="margin-top: 12px;">
              <el-col :span="12">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">付款方式</div>
                <el-select v-model="currentOrder.paymentMethod" clearable placeholder="选择付款方式" style="width: 100%;">
                  <el-option
                    v-for="(label, value) in paymentMethodMap"
                    :key="value"
                    :label="label"
                    :value="value"
                  />
                </el-select>
              </el-col>
              <el-col :span="12">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">付款时间</div>
                <el-date-picker
                  v-model="currentOrder.paymentPaidAtInput"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm"
                  placeholder="选择付款时间"
                  style="width: 100%;"
                />
              </el-col>
            </el-row>
            <el-row :gutter="12" style="margin-top: 12px;">
              <el-col :span="12">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">交易流水号</div>
                <el-input
                  v-model="currentOrder.paymentReferenceInput"
                  maxlength="128"
                  placeholder="填写微信/支付宝/银行侧收款流水号"
                />
              </el-col>
              <el-col :span="12">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">结算时间</div>
                <el-date-picker
                  v-model="currentOrder.settledAtInput"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm"
                  placeholder="选择结算时间"
                  style="width: 100%;"
                />
              </el-col>
              <el-col :span="24" style="margin-top: 12px;">
                <div style="font-size: 12px; color: #909399; margin-bottom: 6px;">财务备注</div>
                <el-input
                  v-model="currentOrder.settlementRemarkInput"
                  maxlength="200"
                  show-word-limit
                  placeholder="记录收款方式补充说明、到账备注、线下收款说明"
                />
              </el-col>
            </el-row>
            <div style="margin-top: 12px; text-align: right;">
              <el-button type="primary" :loading="savingStatus" @click="handleSaveSettlementStatus">保存结算状态</el-button>
            </div>
          </div>

          <div style="margin-top: 20px;">
            <div style="font-weight: 600; margin-bottom: 12px;">客户费用构成</div>
            <el-table :data="currentSettlementItems" stripe>
              <el-table-column prop="label" label="费用项目" min-width="180" />
              <el-table-column label="金额" width="120">
                <template #default="{ row }">{{ formatMoney(row.amount || 0) }}</template>
              </el-table-column>
              <el-table-column prop="note" label="备注" min-width="180">
                <template #default="{ row }">{{ row.note || '—' }}</template>
              </el-table-column>
            </el-table>
            <div style="margin-top: 16px; text-align: right; font-size: 16px; font-weight: 700; color: #303133;">
              结算总额：{{ formatMoney(currentSettlementTotal || 0) }}
            </div>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>
