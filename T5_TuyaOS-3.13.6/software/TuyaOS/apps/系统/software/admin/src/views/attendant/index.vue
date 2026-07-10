<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  getAttendantList, createAttendant, toggleAttendantStatus, deleteAttendant,
  getAvailableUsersForAttendant, getTrashedAttendants, restoreAttendant, hardDeleteAttendant,
  getAttendantDetail, getAttendantSchedules,
  listServiceStaffRoleConfigs,
  type ServiceStaffRole,
  type ServiceStaffRoleConfig,
} from '@/api/attendant'
import { getOrderList } from '@/api/order'
import { formatDate, orderStatusMap } from '@/utils/format'
import ProfessionalProfileDrawer from '@/components/ProfessionalProfileDrawer.vue'

const roleConfigs = ref<ServiceStaffRoleConfig[]>([])
async function loadRoleConfigs() {
  try {
    roleConfigs.value = await listServiceStaffRoleConfigs()
  } catch {
    roleConfigs.value = []
  }
}
function roleLabel(role?: string) {
  const cfg = roleConfigs.value.find((c) => c.role === role)
  return cfg?.label || (role ? role : '陪诊员')
}
function roleColor(role?: string) {
  const cfg = roleConfigs.value.find((c) => c.role === role)
  return cfg?.themeColor || '#4CAF50'
}

const profileDrawerVisible = ref(false)
const profileDrawerTargetId = ref<number | null>(null)
const profileDrawerInitial = ref<any>(null)
function openProfileDrawer(row: any) {
  profileDrawerTargetId.value = row.id
  profileDrawerInitial.value = {
    primaryRole: (row.primaryRole || 'attendant') as ServiceStaffRole,
    professionalRoles: row.professionalRoles || [row.primaryRole || 'attendant'],
    specialties: row.specialties || [],
    certifications: row.certifications || [],
    title: row.title || '',
    experienceYears: row.experienceYears || 0,
    realName: row.realName || '',
  }
  profileDrawerVisible.value = true
}

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const createLoading = ref(false)
const createFormRef = ref<FormInstance>()
const createMode = ref<'user' | 'new'>('user')
const availableUsers = ref<any[]>([])
const userSearchLoading = ref(false)
const quickViewVisible = ref(false)
const quickViewLoading = ref(false)
const quickViewTab = ref('info')
const quickAttendant = ref<any>(null)
const quickOrders = ref<any[]>([])
const quickSchedules = ref<any[]>([])

// 回收站相关
const trashDrawerVisible = ref(false)
const trashLoading = ref(false)
const trashData = ref<any[]>([])
const trashTotal = ref(0)
const trashKeyword = ref('')
const trashPage = ref(1)
const trashPageSize = ref(20)
function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const searchForm = reactive({
  keyword: String(route.query.keyword || ''),
  status: String(route.query.status || ''),
  primaryRole: String(route.query.primaryRole || ''),
  page: parsePositiveNumber(route.query.page, 1),
  pageSize: parsePositiveNumber(route.query.pageSize, 20),
})

const createForm = reactive({
  userId: undefined as number | undefined,
  realName: '',
  employeeId: '',
  phone: '',
  openid: '',
})
const schedulePeriodMap: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  full_day: '全天',
}
const quickStats = computed(() => ({
  totalOrders: Number(quickAttendant.value?.totalOrders ?? quickOrders.value.length ?? 0),
  completedOrders: quickOrders.value.filter((item) => item.status === 'completed').length,
  upcomingSchedules: quickSchedules.value.length,
}))

async function loadAvailableUsers(keyword?: string) {
  userSearchLoading.value = true
  try {
    const res: any = await getAvailableUsersForAttendant({ keyword: keyword || '', page: 1, pageSize: 50 })
    availableUsers.value = res.items || []
  } catch {
    availableUsers.value = []
  } finally {
    userSearchLoading.value = false
  }
}

watch(dialogVisible, (v) => {
  if (v) {
    createMode.value = 'user'
    createForm.userId = undefined
    createForm.realName = ''
    createForm.employeeId = ''
    createForm.phone = ''
    createForm.openid = ''
    loadAvailableUsers()
  }
})

watch(() => createForm.userId, (userId) => {
  if (createMode.value === 'user' && userId) {
    const u = availableUsers.value.find((x: any) => x.id === userId)
    if (u) {
      createForm.realName = u.nickname || ''
      createForm.phone = u.phone || ''
    }
  }
})

async function loadData() {
  syncQuery()
  loading.value = true
  try {
    const params: any = { page: searchForm.page, pageSize: searchForm.pageSize }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.primaryRole) params.primaryRole = searchForm.primaryRole
    const res = await getAttendantList(params)
    const rawItems: any = res?.items
    const normalizedItems = Array.isArray(rawItems)
      ? rawItems
      : (rawItems && typeof rawItems === 'object'
        ? Object.values(rawItems)
        : (Array.isArray(res) ? res : []))
    tableData.value = normalizedItems as any[]
    total.value = Number(res?.total ?? tableData.value.length ?? 0)

    if (total.value > 0 && tableData.value.length === 0 && searchForm.page > 1) {
      searchForm.page = 1
      await loadData()
      return
    }
  } catch (err: any) {
    ElMessage.error('加载陪诊员列表失败：' + (err?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function buildQuery() {
  const query: Record<string, string> = {}
  if (searchForm.keyword) query.keyword = searchForm.keyword
  if (searchForm.status) query.status = searchForm.status
  if (searchForm.primaryRole) query.primaryRole = searchForm.primaryRole
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
  searchForm.primaryRole = String(query.primaryRole || '')
  searchForm.page = parsePositiveNumber(query.page, 1)
  searchForm.pageSize = parsePositiveNumber(query.pageSize, 20)
}

function handleSearch() {
  searchForm.page = 1
  loadData()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.primaryRole = ''
  searchForm.page = 1
  loadData()
}

function handlePageChange(page: number) {
  searchForm.page = page
  loadData()
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === 'active' ? 'disabled' : 'active'
  const label = newStatus === 'active' ? '激活' : '禁用'
  try {
    await toggleAttendantStatus(row.id, newStatus)
    row.status = newStatus
    if (quickAttendant.value?.id === row.id) {
      quickAttendant.value = { ...quickAttendant.value, status: newStatus }
    }
    ElMessage.success(`已${label}`)
    loadData()
  } catch {
    // handled by interceptor
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要将陪诊员「${row.realName || row.employeeId || row.id}」移入回收站吗？可在回收站中恢复。`,
      '移入回收站',
      { type: 'warning', confirmButtonText: '移入回收站', confirmButtonClass: 'el-button--warning' }
    )
  } catch {
    return
  }
  try {
    await deleteAttendant(row.id)
    ElMessage.success('已移入回收站')
    loadData()
  } catch {
    // handled by interceptor
  }
}

async function handleCreate() {
  const isUserMode = createMode.value === 'user'
  if (isUserMode && !createForm.userId) {
    ElMessage.warning('请选择用户')
    return
  }
  if (!isUserMode && (!createForm.realName?.trim() || !createForm.phone?.trim())) {
    ElMessage.warning('请填写姓名和手机号')
    return
  }

  createLoading.value = true
  try {
    const data: any = isUserMode
      ? { userId: createForm.userId, employeeId: createForm.employeeId || undefined }
      : { realName: createForm.realName, employeeId: createForm.employeeId, phone: createForm.phone }
    if (createForm.openid) data.openid = createForm.openid
    await createAttendant(data)
    ElMessage.success('创建成功')
    dialogVisible.value = false
    Object.assign(createForm, { userId: undefined, realName: '', employeeId: '', phone: '', openid: '' })
    loadData()
  } catch {
    // handled by interceptor
  } finally {
    createLoading.value = false
  }
}

function statusLabel(s: string) {
  return s === 'active' ? '在职' : s === 'disabled' ? '已离职' : '休息中'
}

function getSchedulePeriodLabel(period?: string) {
  return schedulePeriodMap[period || ''] || period || '未设置'
}

function getNextWeekRange() {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 7)
  const format = (value: Date) => {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return { startDate: format(start), endDate: format(end) }
}

async function openQuickView(row: any) {
  quickViewVisible.value = true
  quickViewLoading.value = true
  quickViewTab.value = 'info'
  quickAttendant.value = null
  quickOrders.value = []
  quickSchedules.value = []
  try {
    const range = getNextWeekRange()
    const [detail, orderRes, schedules] = await Promise.all([
      getAttendantDetail(row.id),
      getOrderList({ attendantId: row.id, page: 1, pageSize: 6 }).catch(() => ({ items: [] })),
      getAttendantSchedules(row.id, range).catch(() => []),
    ])
    quickAttendant.value = detail
    quickOrders.value = Array.isArray(orderRes?.items) ? orderRes.items : []
    quickSchedules.value = Array.isArray(schedules) ? schedules : []
  } catch {
    ElMessage.error('加载陪诊员快览失败')
  } finally {
    quickViewLoading.value = false
  }
}

// ── 回收站 ──
async function openTrash() {
  trashDrawerVisible.value = true
  trashPage.value = 1
  trashKeyword.value = ''
  await loadTrash()
}

async function loadTrash() {
  trashLoading.value = true
  try {
    const res: any = await getTrashedAttendants({
      keyword: trashKeyword.value || undefined,
      page: trashPage.value,
      pageSize: trashPageSize.value,
    })
    trashData.value = res?.items || []
    trashTotal.value = Number(res?.total ?? trashData.value.length)
  } catch {
    trashData.value = []
  } finally {
    trashLoading.value = false
  }
}

async function handleRestore(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要恢复陪诊员「${row.realName || row.id}」吗？恢复后将重新出现在陪诊员列表中。`,
      '恢复陪诊员',
      { type: 'info', confirmButtonText: '确认恢复' }
    )
  } catch {
    return
  }
  try {
    await restoreAttendant(row.id)
    ElMessage.success('已恢复')
    loadTrash()
    loadData()
  } catch {
    // handled by interceptor
  }
}

async function handleHardDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `此操作将永久删除陪诊员「${row.realName || row.id}」及其所有数据，无法恢复！请谨慎操作。`,
      '⚠️ 彻底删除',
      {
        type: 'error',
        confirmButtonText: '永久删除',
        confirmButtonClass: 'el-button--danger',
        cancelButtonText: '取消',
      }
    )
  } catch {
    return
  }
  try {
    await hardDeleteAttendant(row.id)
    ElMessage.success('已彻底删除')
    loadTrash()
  } catch {
    // handled by interceptor
  }
}

onMounted(() => {
  loadRoleConfigs()
  loadData()
})

watch(() => route.path, (path) => {
  if (path === '/dispatch/attendants') {
    loadData()
  }
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
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">陪诊调度</h2>
        <p class="page-subtitle">统一管理陪诊员状态、接单情况与排班信息</p>
      </div>
      <div class="page-header-actions">
        <el-button @click="openTrash">
          <el-icon><Delete /></el-icon>
          回收站
        </el-button>
        <el-button type="primary" @click="dialogVisible = true">
          <el-icon><Plus /></el-icon>
          新增陪诊员
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="filter-bar">
      <el-form inline>
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="工号/姓名/手机号" clearable style="width: 220px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="在职" value="active" />
            <el-option label="已离职" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.primaryRole" placeholder="全部角色" clearable style="width: 160px">
            <el-option
              v-for="cfg in roleConfigs"
              :key="cfg.role"
              :label="cfg.label"
              :value="cfg.role"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>查询</el-button>
        </el-form-item>
        <el-form-item>
          <el-button @click="handleReset"><el-icon><RefreshLeft /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-card__header">
          <span class="table-card__title">陪诊员列表 <el-tag size="small" type="info" effect="plain" style="margin-left:8px;">共 {{ total }} 条</el-tag></span>
        </div>
      </template>
      <el-table
        :data="tableData"
        v-loading="loading"
        highlight-current-row
        :header-cell-style="{ fontWeight: '600', color: '#475569', fontSize: '13px', background: '#f8fafc' }"
      >
        <el-table-column label="陪诊员信息" min-width="200">
          <template #default="{ row }">
            <div class="cell-attendant-info">
              <div class="cell-attendant-info__avatar">
                {{ (row.realName || '?').substring(0, 1) }}
              </div>
              <div class="cell-attendant-info__body">
                <div class="cell-attendant-info__name">{{ row.realName || '未命名' }}</div>
                <div class="cell-attendant-info__meta">
                  <span v-if="row.employeeId">工号 {{ row.employeeId }}</span>
                  <span v-if="row.phone"> · {{ row.phone }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small" effect="light" round>
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="180">
          <template #default="{ row }">
            <div class="role-cell">
              <el-tag
                size="small"
                effect="dark"
                :style="{ backgroundColor: roleColor(row.primaryRole), borderColor: roleColor(row.primaryRole) }"
              >
                {{ roleLabel(row.primaryRole) }}
              </el-tag>
              <div v-if="(row.specialties && row.specialties.length)" class="role-cell__specialties">
                <el-tag
                  v-for="tag in (row.specialties || []).slice(0, 2)"
                  :key="tag"
                  size="small"
                  effect="plain"
                  style="margin-left: 4px;"
                >{{ tag }}</el-tag>
                <span v-if="(row.specialties || []).length > 2" class="role-cell__more">+{{ row.specialties.length - 2 }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="业绩" width="200">
          <template #default="{ row }">
            <div class="cell-stats">
              <div class="cell-stats__item">
                <span class="cell-stats__num">{{ Number(row.rating ?? 5).toFixed(1) }}</span>
                <span class="cell-stats__label">评分</span>
              </div>
              <div class="cell-stats__divider" />
              <div class="cell-stats__item">
                <span class="cell-stats__num">{{ row.totalOrders ?? 0 }}</span>
                <span class="cell-stats__label">总单</span>
              </div>
              <div class="cell-stats__divider" />
              <div class="cell-stats__item">
                <span class="cell-stats__num cell-stats__num--green">¥{{ ((row.totalOrders ?? 0) * 150).toFixed(0) }}</span>
                <span class="cell-stats__label">收入</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <div class="cell-actions">
              <el-button size="small" @click="openQuickView(row)" class="cell-actions__btn cell-actions__btn--default">
                <el-icon :size="13"><View /></el-icon>快览
              </el-button>
              <el-button size="small" type="primary" plain @click="router.push(`/dispatch/attendants/detail/${row.id}`)" class="cell-actions__btn">
                详情
              </el-button>
              <el-dropdown trigger="click" @command="(cmd: string) => { if (cmd === 'toggle') handleToggleStatus(row); if (cmd === 'delete') handleDelete(row); if (cmd === 'profile') openProfileDrawer(row) }">
                <el-button size="small" class="cell-actions__btn cell-actions__btn--more">
                  <el-icon :size="13"><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="profile">
                      <el-icon><Edit /></el-icon>编辑角色与专业资料
                    </el-dropdown-item>
                    <el-dropdown-item command="toggle" divided>
                      <el-icon><Switch /></el-icon>{{ row.status === 'active' ? '禁用' : '激活' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <el-icon color="#ef4444"><Delete /></el-icon><span style="color:#ef4444">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrapper">
        <span class="pagination-info">共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="searchForm.page"
          :total="total"
          :page-size="searchForm.pageSize"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新增陪诊员弹窗 -->
    <el-dialog v-model="dialogVisible" title="新增陪诊员" width="600px">
      <el-form ref="createFormRef" :model="createForm" label-width="100px">
        <el-form-item label="创建方式">
          <el-radio-group v-model="createMode">
            <el-radio label="user">从现有用户</el-radio>
            <el-radio label="new">新建陪诊员</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="createMode === 'user'">
          <el-form-item label="选择用户" prop="userId">
            <el-select
              v-model="createForm.userId"
              placeholder="请选择用户（可搜索昵称/手机号）"
              filterable
              remote
              :remote-method="loadAvailableUsers"
              :loading="userSearchLoading"
              style="width: 100%"
              clearable
            >
              <el-option
                v-for="u in availableUsers"
                :key="u.id"
                :label="`${u.nickname || u.phone || '-'} (${u.phone || '-'})`"
                :value="u.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="工号">
            <el-input v-model="createForm.employeeId" placeholder="选填" />
          </el-form-item>
        </template>

        <template v-else>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            title="新建模式只适合从未登录过小程序的新陪诊员；如果对方已登录过，请改用“从现有用户”创建，避免同一微信生成两个用户。"
            style="margin-bottom: 16px;"
          />
          <el-form-item label="姓名" prop="realName">
            <el-input v-model="createForm.realName" placeholder="请输入姓名" />
          </el-form-item>
          <el-form-item label="工号">
            <el-input v-model="createForm.employeeId" placeholder="请输入工号" />
          </el-form-item>
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="createForm.phone" placeholder="请输入手机号" />
          </el-form-item>
          <el-form-item label="绑定微信">
            <el-input v-model="createForm.openid" placeholder="请输入微信OpenID（选填，已知时建议填写）" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 回收站抽屉 -->
    <el-drawer
      v-model="trashDrawerVisible"
      title="回收站"
      size="780px"
      :destroy-on-close="false"
    >
      <template #header>
        <div class="trash-drawer-header">
          <span class="trash-drawer-title">
            <el-icon style="color: #e6a23c; margin-right: 6px;"><Delete /></el-icon>
            回收站
          </span>
          <el-text type="info" size="small">已删除的陪诊员可在此恢复，或选择彻底删除</el-text>
        </div>
      </template>

      <div class="trash-toolbar">
        <el-input
          v-model="trashKeyword"
          placeholder="搜索姓名 / 工号 / 手机号"
          clearable
          style="width: 260px"
          @keyup.enter="loadTrash"
          @clear="loadTrash"
        >
          <template #append>
            <el-button :icon="'Search'" @click="loadTrash" />
          </template>
        </el-input>
        <el-text type="info" size="small" style="margin-left: auto;">共 {{ trashTotal }} 条记录</el-text>
      </div>

      <el-table :data="trashData" v-loading="trashLoading" stripe style="margin-top: 12px;">
        <el-table-column prop="employeeId" label="工号" width="90" />
        <el-table-column prop="realName" label="姓名" width="110" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="评分" width="70">
          <template #default="{ row }">{{ Number(row.rating ?? 5).toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="删除时间" width="160">
          <template #default="{ row }">
            {{ row.deletedAt ? new Date(row.deletedAt).toLocaleString('zh-CN') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="160">
          <template #default="{ row }">
            <el-button type="success" link size="small" @click="handleRestore(row)">
              <el-icon><RefreshRight /></el-icon>
              恢复
            </el-button>
            <el-button type="danger" link size="small" @click="handleHardDelete(row)">
              <el-icon><Delete /></el-icon>
              彻底删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" style="margin-top: 16px;">
        <el-pagination
          v-model:current-page="trashPage"
          :total="trashTotal"
          :page-size="trashPageSize"
          layout="total, prev, pager, next"
          background
          @current-change="loadTrash"
        />
      </div>

      <template #footer>
        <el-button @click="trashDrawerVisible = false">关闭</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="quickViewVisible" title="陪诊员快览" size="46%" destroy-on-close>
      <div v-loading="quickViewLoading">
        <template v-if="quickAttendant">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px;">
            <div>
              <div style="font-size:20px;font-weight:700;color:#303133;">
                {{ quickAttendant.realName || `陪诊员 #${quickAttendant.id}` }}
              </div>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                <el-tag :type="quickAttendant.status === 'active' ? 'success' : 'info'" size="small">
                  {{ statusLabel(quickAttendant.status) }}
                </el-tag>
                <el-tag size="small" type="info">工号 {{ quickAttendant.employeeId || '未设置' }}</el-tag>
                <el-tag size="small" type="warning">手机号 {{ quickAttendant.phone || '未填写' }}</el-tag>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <el-button size="small" @click="router.push(`/dispatch/attendants/detail/${quickAttendant.id}`)">完整详情</el-button>
              <el-button
                size="small"
                :type="quickAttendant.status === 'active' ? 'warning' : 'success'"
                @click="handleToggleStatus(quickAttendant)"
              >
                {{ quickAttendant.status === 'active' ? '禁用' : '激活' }}
              </el-button>
            </div>
          </div>

          <el-tabs v-model="quickViewTab" type="border-card">
            <el-tab-pane label="基本信息" name="info">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="姓名">
                  {{ quickAttendant.realName || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="工号">
                  {{ quickAttendant.employeeId || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="手机号">
                  {{ quickAttendant.phone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="登录账号">
                  {{ quickAttendant.username || '未设置' }}
                </el-descriptions-item>
                <el-descriptions-item label="综合评分">
                  {{ quickAttendant.averageRating || quickAttendant.rating || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">
                  {{ quickAttendant.createdAt ? formatDate(quickAttendant.createdAt) : '—' }}
                </el-descriptions-item>
              </el-descriptions>

              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;">
                <el-card shadow="never">
                  <div style="font-size:12px;color:#909399;">累计接单</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:700;color:#303133;">{{ quickStats.totalOrders }}</div>
                </el-card>
                <el-card shadow="never">
                  <div style="font-size:12px;color:#909399;">当前加载订单中已完成</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:700;color:#303133;">{{ quickStats.completedOrders }}</div>
                </el-card>
                <el-card shadow="never">
                  <div style="font-size:12px;color:#909399;">未来 7 天排班</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:700;color:#303133;">{{ quickStats.upcomingSchedules }}</div>
                </el-card>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`最近订单 (${quickOrders.length})`" name="orders">
              <el-empty v-if="!quickOrders.length" description="暂无订单记录" />
              <el-table v-else :data="quickOrders" stripe>
                <el-table-column prop="orderNumber" label="订单号" min-width="180" />
                <el-table-column label="客户" min-width="100">
                  <template #default="{ row }">
                    {{ row.user?.nickname || row.user?.phone || '—' }}
                  </template>
                </el-table-column>
                <el-table-column label="服务对象" min-width="100">
                  <template #default="{ row }">
                    {{ row.serviceTarget?.name || '—' }}
                  </template>
                </el-table-column>
                <el-table-column prop="serviceType" label="服务类型" min-width="120" />
                <el-table-column label="状态" width="110">
                  <template #default="{ row }">
                    <el-tag :type="(orderStatusMap[row.status]?.type as any) || 'info'" size="small">
                      {{ orderStatusMap[row.status]?.label || row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="服务时间" min-width="160">
                  <template #default="{ row }">
                    {{ row.serviceTime ? formatDate(row.serviceTime) : '—' }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="router.push(`/service/orders/detail/${row.id}`)">查看</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane :label="`近期排班 (${quickSchedules.length})`" name="schedules">
              <el-empty v-if="!quickSchedules.length" description="未来 7 天暂无排班" />
              <el-table v-else :data="quickSchedules" stripe>
                <el-table-column label="日期" min-width="140">
                  <template #default="{ row }">
                    {{ row.date ? formatDate(row.date, 'YYYY-MM-DD') : '—' }}
                  </template>
                </el-table-column>
                <el-table-column label="时段" min-width="100">
                  <template #default="{ row }">
                    {{ getSchedulePeriodLabel(row.period) }}
                  </template>
                </el-table-column>
                <el-table-column label="状态" min-width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'available' ? 'success' : 'info'" size="small">
                      {{ row.status === 'available' ? '可排班' : '已占用' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-drawer>

    <ProfessionalProfileDrawer
      v-model="profileDrawerVisible"
      :attendant-id="profileDrawerTargetId"
      :initial="profileDrawerInitial"
      @saved="loadData"
    />
  </div>
</template>

<style scoped lang="scss">
.page-header-actions {
  display: flex;
  gap: 10px;
}

.role-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__specialties {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    align-items: center;
  }

  &__more {
    font-size: 12px;
    color: #8A94A6;
    margin-left: 4px;
  }
}
.page-subtitle {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #94a3b8;
  font-weight: 400;
}
.trash-drawer-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.trash-drawer-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}
.trash-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  :deep(.el-card__header) { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; }
  :deep(.el-card__body) { padding: 0; }
  :deep(.el-table) {
    --el-table-border-color: #f1f5f9;
    --el-table-row-hover-bg-color: #f0f9ff;
    --el-table-current-row-bg-color: #eff6ff;
    font-size: 13px;
  }
  :deep(.el-table th.el-table__cell) { padding: 12px 0; border-bottom: 2px solid #e2e8f0; }
  :deep(.el-table td.el-table__cell) { padding: 14px 0; color: #334155; border-bottom: 1px solid #f1f5f9; }
}
.table-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.table-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
}

.cell-attendant-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cell-attendant-info__avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #22c55e, #10b981);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.cell-attendant-info__name {
  font-weight: 500;
  color: #1e293b;
  font-size: 13px;
}
.cell-attendant-info__meta {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
.cell-stats {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cell-stats__item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.cell-stats__num {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  &--green { color: #16a34a; }
}
.cell-stats__label {
  font-size: 11px;
  color: #94a3b8;
}
.cell-stats__divider {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
}
.cell-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.cell-actions__btn {
  border-radius: 6px !important;
  font-size: 12px !important;
  padding: 5px 10px !important;
  height: 28px !important;
  &--default {
    background: #f8fafc !important;
    border-color: #e2e8f0 !important;
    color: #475569 !important;
    &:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #1e293b !important; }
  }
  &--more {
    padding: 5px 6px !important;
    background: #f8fafc !important;
    border-color: #e2e8f0 !important;
    color: #64748b !important;
    &:hover { background: #f1f5f9 !important; color: #334155 !important; }
  }
}
.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}
.pagination-info {
  font-size: 12px;
  color: #94a3b8;
}
</style>
