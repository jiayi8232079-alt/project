<script setup lang="ts">
import { reactive, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getServiceTargetDirectoryList } from '@/api/customer'
import { formatDate } from '@/utils/format'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)

const genderLabelMap: Record<string, string> = {
  male: '男',
  female: '女',
  M: '男',
  F: '女',
}

function genderLabel(v?: string | null) {
  if (!v) return '—'
  return genderLabelMap[v] ?? v
}

const userRoleLabelMap: Record<string, string> = {
  user: '小程序',
  attendant: '陪诊员',
  admin: '管理员',
  operator: '运营',
  finance: '财务',
  customer_service: '客服',
  medical_consultant: '医疗顾问',
}

function ownerRoleLabel(role?: string | null) {
  if (!role) return '—'
  return userRoleLabelMap[role] ?? role
}

function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePageSize(value: unknown, fallback: number) {
  return Math.min(100, parsePositiveNumber(value, fallback))
}

const searchForm = reactive({
  keyword: String(route.query.keyword || ''),
  page: parsePositiveNumber(route.query.page, 1),
  pageSize: parsePageSize(route.query.pageSize, 50),
})

function buildQuery() {
  const query: Record<string, string> = {}
  if (searchForm.keyword) query.keyword = searchForm.keyword
  if (searchForm.page > 1) query.page = String(searchForm.page)
  if (searchForm.pageSize !== 50) query.pageSize = String(searchForm.pageSize)
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
  searchForm.page = parsePositiveNumber(query.page, 1)
  searchForm.pageSize = parsePageSize(query.pageSize, 50)
}

async function loadData() {
  syncQuery()
  loading.value = true
  try {
    const params: any = { page: searchForm.page, pageSize: searchForm.pageSize }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    const res = await getServiceTargetDirectoryList(params)
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

function handlePageChange(page: number) {
  searchForm.page = page
  loadData()
}

function handlePageSizeChange() {
  searchForm.page = 1
  loadData()
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
  <div class="page-container health-mgmt-page">
    <div class="page-header">
      <div class="page-header-titles">
        <h2 class="page-title">家庭成员目录（归档视图）</h2>
        <p class="page-subtitle">
          本页以档案为维度列出全部家庭成员，供批量查找使用。日常客户管理推荐使用
          <el-button type="primary" link style="padding:0" @click="router.push('/customer-center/customers')">「客户中心」</el-button>
          （客户 → 家庭 → 成员档案一体化入口），这里保留作为归档检索。
        </p>
      </div>
      <div class="page-header-actions">
        <el-button type="primary" @click="router.push('/customer-center/customers')">前往客户中心</el-button>
        <el-button plain @click="router.push('/service/orders/create')">创建订单</el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card archive-table-card">
      <template #header>
        <div class="table-card-toolbar">
          <div class="toolbar-left">
            <span class="card-section-title">全量健康档案</span>
            <el-tag v-if="total > 0" type="info" effect="plain" size="small" class="total-tag">
              本页数据 · 共 {{ total }} 条
            </el-tag>
          </div>
          <div class="toolbar-right">
            <el-input
              v-model="searchForm.keyword"
              placeholder="档案姓名 / 账号昵称 / 手机"
              clearable
              class="toolbar-search"
              @keyup.enter="handleSearch"
            />
            <el-button type="primary" @click="handleSearch">
              <el-icon><Search /></el-icon>查询
            </el-button>
          </div>
        </div>
      </template>

      <div class="table-scroll">
        <el-table
          :data="tableData"
          v-loading="loading"
          stripe
          border
          class="archive-table"
          row-key="id"
          table-layout="auto"
        >
          <el-table-column
            prop="name"
            label="家庭成员姓名"
            min-width="140"
            fixed="left"
            show-overflow-tooltip
            class-name="col-name"
          />
          <el-table-column label="性别" width="56" align="center">
            <template #default="{ row }">{{ genderLabel(row.gender) }}</template>
          </el-table-column>
          <el-table-column label="年龄" width="56" align="center">
            <template #default="{ row }">{{ row.age != null ? `${row.age}` : '—' }}</template>
          </el-table-column>
          <el-table-column label="本人电话" min-width="118" show-overflow-tooltip>
            <template #default="{ row }">{{ row.phone || '—' }}</template>
          </el-table-column>
          <el-table-column label="账号昵称" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.owner?.nickname || '—' }}</template>
          </el-table-column>
          <el-table-column label="账号手机" min-width="112" show-overflow-tooltip>
            <template #default="{ row }">{{ row.owner?.phone || '—' }}</template>
          </el-table-column>
          <el-table-column label="账号类型" min-width="96" align="center">
            <template #default="{ row }">
              <span class="role-pill">{{ ownerRoleLabel(row.owner?.role) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="用户 / 档案" min-width="132" align="left" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="id-inline">
                <span class="id-part">用户 {{ row.userId }}</span>
                <span class="id-sep" aria-hidden="true">·</span>
                <span class="id-part id-part--sub">档案 {{ row.id }}</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="所属家庭 / 成员" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-if="row.familyGroupsLabel">
                <el-tooltip
                  v-if="row.familyGroupsTooltip"
                  :content="row.familyGroupsTooltip"
                  placement="top"
                >
                  <el-button
                    type="primary"
                    link
                    size="small"
                    style="padding: 0; font-weight: 600;"
                    @click.stop="
                      router.push(
                        `/customer-center/customers/detail/${row.userId}?tab=families`,
                      )
                    "
                  >{{ row.familyGroupsLabel }}</el-button>
                </el-tooltip>
                <el-button
                  v-else
                  type="primary"
                  link
                  size="small"
                  style="padding: 0; font-weight: 600;"
                  @click.stop="
                    router.push(
                      `/customer-center/customers/detail/${row.userId}?tab=families`,
                    )
                  "
                >{{ row.familyGroupsLabel }}</el-button>
                <div v-if="row.familyMemberCount" style="font-size: 12px; color: #909399; margin-top: 2px;">
                  共 {{ row.familyMemberCount }} 位成员
                </div>
              </div>
              <span v-else style="color: #c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column label="订单" width="72" align="center">
            <template #default="{ row }">{{ row.ordersCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="158" align="left" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.createdAt" class="cell-datetime">{{ formatDate(row.createdAt) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="168" align="center">
            <template #default="{ row }">
              <div class="action-cell">
                <el-button
                  type="success"
                  link
                  size="small"
                  @click="
                    router.push(
                      `/service/orders/create?userId=${row.userId}&serviceTargetId=${row.id}`,
                    )
                  "
                >
                  创建订单
                </el-button>
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click="router.push(`/customer-center/customers/detail/${row.userId}`)"
                >
                  用户详情
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="searchForm.page"
          v-model:page-size="searchForm.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.health-mgmt-page {
  max-width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.page-header-titles {
  min-width: 0;
  flex: 1;
}
.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.55;
  max-width: 52rem;
}
.page-header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
  flex-wrap: wrap;
}

.table-card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar-search {
  width: min(320px, 100%);
}
.card-section-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}
.total-tag {
  font-weight: 500;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  margin: 0 -2px;
}
.archive-table-card :deep(.el-card__header) {
  padding: 14px 18px;
}
.archive-table-card :deep(.el-card__body) {
  padding: 12px 18px 18px;
}
.archive-table {
  min-width: 1100px;
}
.archive-table :deep(.el-table__header th.el-table__cell) {
  background: #f0f4fa !important;
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
}
.archive-table :deep(.el-table__cell) {
  padding: 9px 10px;
  font-size: 14px;
  vertical-align: middle;
}
.archive-table :deep(.el-table__cell .cell) {
  line-height: 1.45;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.archive-table :deep(.col-name .cell) {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  line-height: 1.45;
}

.id-inline {
  display: inline;
  font-size: 13px;
  white-space: nowrap;
}
.id-part {
  color: #303133;
}
.id-part--sub {
  color: #606266;
  font-weight: 500;
}
.id-sep {
  margin: 0 0.35em;
  color: #c0c4cc;
}

.role-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  background: #f4f4f5;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
  white-space: nowrap;
}

.cell-datetime {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-size: 13px;
}

.action-cell {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 10px;
  padding: 0;
}
.action-cell :deep(.el-button) {
  margin: 0;
  padding: 0 2px;
}

.pagination-wrapper {
  margin-top: 4px;
}
</style>
