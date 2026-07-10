<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getFinanceRecords, approveFinanceRecord, rejectFinanceRecord } from '@/api/finance'
import { formatDate, formatMoney } from '@/utils/format'
import { API_BASE_URL } from '@/config/api-base'
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const detailVisible = ref(false)
const currentRecord = ref<any>(null)
function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const searchForm = reactive({
  keyword: String(route.query.keyword || ''),
  status: String(route.query.status || ''),
  page: parsePositiveNumber(route.query.page, 1),
  pageSize: parsePositiveNumber(route.query.pageSize, 20),
})

const reviewForm = reactive({
  reviewNote: '',
})

const financeStatusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
}

const financeTypeMap: Record<string, string> = {
  transport: '交通费',
  accommodation: '住宿费',
  medical: '医疗相关',
  other: '其他费用',
}

function getAssetUrl(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

function getProofImages(row: any) {
  const images = Array.isArray(row?.proofImages) && row.proofImages.length
    ? row.proofImages
    : row?.proofUrl
      ? [row.proofUrl]
      : []
  return images.map((item: string) => getAssetUrl(item))
}

function getFinanceTypeLabel(row: any) {
  return row?.typeLabel || financeTypeMap[row?.type] || row?.type || '—'
}

const currentProofImages = computed(() => getProofImages(currentRecord.value))
const currentRecordIndex = computed(() => tableData.value.findIndex((item) => item.id === currentRecord.value?.id))
const hasPreviousRecord = computed(() => currentRecordIndex.value > 0)
const hasNextRecord = computed(() => currentRecordIndex.value >= 0 && currentRecordIndex.value < tableData.value.length - 1)

function buildQuery() {
  const query: Record<string, string> = {}
  if (searchForm.keyword) query.keyword = searchForm.keyword
  if (searchForm.status) query.status = searchForm.status
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
  searchForm.page = parsePositiveNumber(query.page, 1)
  searchForm.pageSize = parsePositiveNumber(query.pageSize, 20)
}

async function loadData() {
  syncQuery()
  loading.value = true
  try {
    const params: any = { page: searchForm.page, pageSize: searchForm.pageSize }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.status) params.status = searchForm.status
    const res = await getFinanceRecords(params)
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
  searchForm.page = 1
  searchForm.pageSize = 20
  loadData()
}

function handlePageChange(page: number) {
  searchForm.page = page
  loadData()
}

function openDetail(row: any) {
  currentRecord.value = row
  reviewForm.reviewNote = row.reviewNote || ''
  detailVisible.value = true
}

function navigateDetail(offset: number) {
  if (currentRecordIndex.value < 0) return
  const nextRecord = tableData.value[currentRecordIndex.value + offset]
  if (nextRecord) {
    openDetail(nextRecord)
  }
}

function getNextPendingRecord(currentId?: number) {
  const currentIndex = tableData.value.findIndex((item) => item.id === currentId)
  if (currentIndex < 0) return null
  for (let i = currentIndex + 1; i < tableData.value.length; i += 1) {
    if (tableData.value[i]?.status === 'pending') return tableData.value[i]
  }
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if (tableData.value[i]?.status === 'pending') return tableData.value[i]
  }
  return null
}

async function submitReview(action: 'approve' | 'reject') {
  if (!currentRecord.value) return
  if (action === 'reject' && !reviewForm.reviewNote.trim()) {
    ElMessage.warning('请输入驳回原因')
    return
  }

  submitting.value = true
  try {
    const nextPendingRecord = getNextPendingRecord(currentRecord.value.id)
    if (action === 'approve') {
      await approveFinanceRecord(currentRecord.value.id, reviewForm.reviewNote.trim() || undefined)
      ElMessage.success('已通过')
    } else {
      await rejectFinanceRecord(currentRecord.value.id, reviewForm.reviewNote.trim())
      ElMessage.success('已驳回')
    }
    await loadData()
    if (nextPendingRecord) {
      const refreshedRecord = tableData.value.find((item) => item.id === nextPendingRecord.id)
      if (refreshedRecord) {
        openDetail(refreshedRecord)
        return
      }
    }
    if (searchForm.status === 'pending') {
      const firstPending = tableData.value.find((item) => item.status === 'pending')
      if (firstPending) {
        openDetail(firstPending)
        return
      }
    }
    detailVisible.value = false
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
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
        <h2 class="page-title">报销审核</h2>
        <p class="page-subtitle">按“核对凭证 -> 填写审核意见 -> 批量处理待审核”顺序处理，效率更高。</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="router.push('/finance/order-settlement')">查看订单回款</el-button>
      </div>
    </div>

    <div class="page-guide">
      <span class="page-guide__label">流程建议</span>
      <el-tag size="small" effect="plain">1 先筛选待审核</el-tag>
      <el-tag size="small" effect="plain">2 查看凭证与说明</el-tag>
      <el-tag size="small" effect="plain">3 批量处理下一条</el-tag>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
      title="陪诊员报销单"
      description="处理交通/住宿等费用凭证的通过或驳回，与下方「订单回款」中的客户付款、订单结算状态无关；一笔订单可同时存在报销记录与订单财务信息。"
    />

    <el-card shadow="never" class="filter-bar">
      <el-form inline>
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.keyword"
            placeholder="订单号/陪诊员/客户/费用说明"
            clearable
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 130px">
            <el-option label="待审核" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
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
        <el-table-column label="订单号" min-width="180">
          <template #default="{ row }">{{ row.order?.orderNumber || row.orderId || '—' }}</template>
        </el-table-column>
        <el-table-column label="客户" width="120">
          <template #default="{ row }">{{ row.order?.serviceTarget?.name || row.order?.user?.nickname || '—' }}</template>
        </el-table-column>
        <el-table-column label="陪诊员" width="120">
          <template #default="{ row }">{{ row.attendant?.realName || '—' }}</template>
        </el-table-column>
        <el-table-column label="费用类型" width="130">
          <template #default="{ row }">{{ getFinanceTypeLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount || 0) }}</template>
        </el-table-column>
        <el-table-column label="凭证" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getProofImages(row).length ? 'success' : 'info'">
              {{ getProofImages(row).length ? `${getProofImages(row).length} 张` : '无' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="(financeStatusMap[row.status]?.type as any) || 'info'" size="small">
              {{ financeStatusMap[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ row.createdAt ? formatDate(row.createdAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="费用说明" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetail(row)">
              {{ row.status === 'pending' ? '详情审核' : '查看详情' }}
            </el-button>
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

    <el-dialog v-model="detailVisible" title="报销审核详情" width="860px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <span>报销审核详情</span>
          <div style="display:flex;gap:8px;">
            <el-button size="small" :disabled="!hasPreviousRecord" @click="navigateDetail(-1)">上一条</el-button>
            <el-button size="small" :disabled="!hasNextRecord" @click="navigateDetail(1)">下一条</el-button>
          </div>
        </div>
      </template>
      <template v-if="currentRecord">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">
            {{ currentRecord.order?.orderNumber || currentRecord.orderId || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户">
            {{ currentRecord.order?.serviceTarget?.name || currentRecord.order?.user?.nickname || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="陪诊员">
            {{ currentRecord.attendant?.realName || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="费用类型">
            {{ getFinanceTypeLabel(currentRecord) }}
          </el-descriptions-item>
          <el-descriptions-item label="金额">
            {{ formatMoney(currentRecord.amount || 0) }}
          </el-descriptions-item>
          <el-descriptions-item label="申请时间">
            {{ currentRecord.createdAt ? formatDate(currentRecord.createdAt) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="(financeStatusMap[currentRecord.status]?.type as any) || 'info'" size="small">
              {{ financeStatusMap[currentRecord.status]?.label || currentRecord.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="订单医院">
            {{ currentRecord.order?.hospital || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="费用说明" :span="2">
            {{ currentRecord.description || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="审核备注" :span="2">
            {{ currentRecord.reviewNote || '—' }}
          </el-descriptions-item>
        </el-descriptions>

        <div style="margin-top: 20px;">
          <div style="font-weight: 600; margin-bottom: 12px;">费用凭证</div>
          <div v-if="currentProofImages.length" style="display:flex;flex-wrap:wrap;gap:12px;">
            <el-image
              v-for="(img, index) in currentProofImages"
              :key="img + index"
              :src="img"
              :preview-src-list="currentProofImages"
              fit="cover"
              style="width: 128px; height: 128px; border-radius: 8px; border: 1px solid #ebeef5;"
            />
          </div>
          <el-empty v-else description="未上传凭证图片" :image-size="90" />
        </div>

        <div v-if="currentRecord.status === 'pending'" style="margin-top: 20px;">
          <el-form label-width="90px">
            <el-form-item label="审核备注">
              <el-input
                v-model="reviewForm.reviewNote"
                type="textarea"
                :rows="3"
                placeholder="通过可不填，驳回请填写原因"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
          </el-form>
        </div>
      </template>

      <template #footer>
        <el-button :disabled="!hasPreviousRecord" @click="navigateDetail(-1)">上一条</el-button>
        <el-button :disabled="!hasNextRecord" @click="navigateDetail(1)">下一条</el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
        <template v-if="currentRecord?.status === 'pending'">
          <el-button type="success" :loading="submitting" @click="submitReview('approve')">审核通过</el-button>
          <el-button type="danger" :loading="submitting" @click="submitReview('reject')">驳回</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>
