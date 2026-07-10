<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  listComplaintsApi,
  getComplaintStatsApi,
  type ComplaintCategory,
  type ComplaintItem,
  type ComplaintListResult,
  type ComplaintPriority,
  type ComplaintStatus,
  type ListComplaintParams,
} from '@/api/complaint'

const router = useRouter()

const STATUS_OPTIONS: Array<{ value: ComplaintStatus; label: string }> = [
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'rejected', label: '已驳回' },
  { value: 'closed', label: '已关闭' },
]

const CATEGORY_OPTIONS: Array<{ value: ComplaintCategory; label: string }> = [
  { value: 'service', label: '服务质量' },
  { value: 'attendant', label: '陪诊员相关' },
  { value: 'dispatch', label: '派单/响应' },
  { value: 'payment', label: '支付/退款' },
  { value: 'report', label: '报告/资料' },
  { value: 'other', label: '其他' },
]

const PRIORITY_OPTIONS: Array<{ value: ComplaintPriority; label: string }> = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '普通' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

const STATUS_TAG: Record<ComplaintStatus, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  pending: 'warning',
  processing: 'primary',
  resolved: 'success',
  rejected: 'danger',
  closed: 'info',
}

const PRIORITY_TAG: Record<ComplaintPriority, 'info' | 'warning' | 'success' | 'danger'> = {
  low: 'info',
  normal: 'success',
  high: 'warning',
  urgent: 'danger',
}

function statusLabel(status: ComplaintStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}

function categoryLabel(cat: ComplaintCategory) {
  return CATEGORY_OPTIONS.find((s) => s.value === cat)?.label ?? cat
}

function priorityLabel(p: ComplaintPriority) {
  return PRIORITY_OPTIONS.find((s) => s.value === p)?.label ?? p
}

const filters = reactive<{
  status: ComplaintStatus | ''
  category: ComplaintCategory | ''
  priority: ComplaintPriority | ''
  keyword: string
}>({
  status: '',
  category: '',
  priority: '',
  keyword: '',
})

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<ComplaintItem[]>([])
const loading = ref(false)

const stats = ref({
  pending: 0,
  processing: 0,
  resolved: 0,
  rejected: 0,
  closed: 0,
})

async function loadStats() {
  try {
    stats.value = await getComplaintStatsApi()
  } catch (e: any) {
    console.warn('load complaint stats failed', e)
  }
}

async function loadList() {
  loading.value = true
  try {
    const params: ListComplaintParams = {
      page: page.value,
      pageSize: pageSize.value,
      status: filters.status || undefined,
      category: filters.category || undefined,
      priority: filters.priority || undefined,
      keyword: filters.keyword || undefined,
    }
    const res: ComplaintListResult = await listComplaintsApi(params)
    items.value = res.items || []
    total.value = res.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载工单失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  loadList()
}

function onReset() {
  filters.status = ''
  filters.category = ''
  filters.priority = ''
  filters.keyword = ''
  page.value = 1
  loadList()
}

function openDetail(row: ComplaintItem) {
  router.push(`/support/complaints/detail/${row.id}`)
}

function quickFilterStatus(status: ComplaintStatus) {
  filters.status = status
  page.value = 1
  loadList()
}

onMounted(async () => {
  await Promise.all([loadList(), loadStats()])
})
</script>

<template>
  <div class="complaint-list">
    <!-- 汇总卡片 -->
    <div class="stats-row">
      <div
        class="stats-card stats-pending"
        :class="{ active: filters.status === 'pending' }"
        @click="quickFilterStatus('pending')"
      >
        <div class="stats-value">{{ stats.pending }}</div>
        <div class="stats-label">待处理</div>
      </div>
      <div
        class="stats-card stats-processing"
        :class="{ active: filters.status === 'processing' }"
        @click="quickFilterStatus('processing')"
      >
        <div class="stats-value">{{ stats.processing }}</div>
        <div class="stats-label">处理中</div>
      </div>
      <div
        class="stats-card stats-resolved"
        :class="{ active: filters.status === 'resolved' }"
        @click="quickFilterStatus('resolved')"
      >
        <div class="stats-value">{{ stats.resolved }}</div>
        <div class="stats-label">已解决</div>
      </div>
      <div
        class="stats-card stats-rejected"
        :class="{ active: filters.status === 'rejected' }"
        @click="quickFilterStatus('rejected')"
      >
        <div class="stats-value">{{ stats.rejected }}</div>
        <div class="stats-label">已驳回</div>
      </div>
      <div
        class="stats-card stats-closed"
        :class="{ active: filters.status === 'closed' }"
        @click="quickFilterStatus('closed')"
      >
        <div class="stats-value">{{ stats.closed }}</div>
        <div class="stats-label">已关闭</div>
      </div>
    </div>

    <!-- 筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="opt in STATUS_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类别">
          <el-select
            v-model="filters.category"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="opt in CATEGORY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select
            v-model="filters.priority"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="opt in PRIORITY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            placeholder="标题/描述/客户信息"
            clearable
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="items" v-loading="loading" stripe border size="small">
        <el-table-column label="工单号" prop="id" width="80">
          <template #default="{ row }">#{{ row.id }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.status as ComplaintStatus]" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="PRIORITY_TAG[row.priority as ComplaintPriority]" size="small" effect="plain">
              {{ priorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="110">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column label="标题" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              {{ row.subject }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="客户" min-width="150">
          <template #default="{ row }">
            <div class="cell-user">{{ row.user?.nickname || '—' }}</div>
            <div class="cell-sub">{{ row.user?.phone || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="关联订单" min-width="140">
          <template #default="{ row }">
            <router-link
              v-if="row.orderId"
              :to="`/service/orders/detail/${row.orderId}`"
              class="link-primary"
            >
              {{ row.order?.orderNumber || `#${row.orderId}` }}
            </router-link>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="处理人" min-width="120">
          <template #default="{ row }">
            {{ row.handler?.realName || row.handler?.username || '未指派' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetail(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="(p: number) => { page = p; loadList() }"
          @size-change="(s: number) => { pageSize = s; page = 1; loadList() }"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.complaint-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.stats-card {
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease;

  &:hover { border-color: #5e6ad2; transform: translateY(-1px); }
  &.active { border-color: #5e6ad2; background: rgba(94,106,210,0.05); }

  .stats-value { font-size: 26px; font-weight: 700; line-height: 1; color: #09090b; }
  .stats-label { font-size: 12px; color: #71717a; }

  &.stats-pending .stats-value { color: #d97706; }
  &.stats-processing .stats-value { color: #5e6ad2; }
  &.stats-resolved .stats-value { color: #059669; }
  &.stats-rejected .stats-value { color: #dc2626; }
}

.filter-card :deep(.el-form-item) { margin-bottom: 8px; }

.cell-user { font-size: 13px; color: #09090b; }
.cell-sub { font-size: 12px; color: #71717a; margin-top: 2px; }
.link-primary { color: #5e6ad2; }

.pagination {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
