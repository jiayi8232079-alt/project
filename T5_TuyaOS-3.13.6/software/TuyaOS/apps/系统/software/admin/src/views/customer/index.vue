<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCustomerList, deleteCustomer, createServiceTarget,
  getDeletedCustomers, restoreCustomer, permanentDeleteCustomer,
  getCustomerDetail, getServiceTargets, getCustomerOrders,
} from '@/api/customer'
import { formatDate, orderStatusMap } from '@/utils/format'
import { pcaTextArr } from 'element-china-area-data'

const ROLE_LABEL_MAP: Record<string, string> = {
  user: '普通客户',
  attendant: '陪诊员',
  admin: '超级管理员',
  operator: '运营',
  finance: '财务',
  customer_service: '客服',
  medical_consultant: '医疗顾问',
}
type ElTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'
const ROLE_TAG_TYPE: Record<string, ElTagType> = {
  user: 'info',
  attendant: 'success',
  admin: 'danger',
  operator: 'warning',
  finance: 'warning',
  customer_service: 'primary',
  medical_consultant: 'primary',
}
function getRoleLabel(role: string) {
  return ROLE_LABEL_MAP[role] || role || '未知'
}
function getRoleTagType(role: string): ElTagType {
  return ROLE_TAG_TYPE[role] ?? 'info'
}

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const quickViewVisible = ref(false)
const quickViewLoading = ref(false)
const quickViewTab = ref('info')
const quickCustomer = ref<any>(null)
const quickServiceTargets = ref<any[]>([])
const quickOrders = ref<any[]>([])

// ── 创建健康档案 ──
const profileDialogVisible = ref(false)
const profileSaving = ref(false)
const currentCustomer = ref<any>(null)
const profileForm = reactive({
  name: '',
  relationship: '' as string,
  gender: '' as string,
  age: undefined as number | undefined,
  phone: '',
  emergencyContact: '',
  emergencyPhone: '',
  homeRegion: [] as string[],
  homeAddressDetail: '',
  mainAppeal: '',
})

const relationshipOptions = [
  { label: '本人', value: 'self' },
  { label: '父亲', value: 'father' },
  { label: '母亲', value: 'mother' },
  { label: '配偶', value: 'spouse' },
  { label: '子女', value: 'child' },
  { label: '其他', value: 'other' },
]
const relationshipLabelMap = relationshipOptions.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})
const genderLabelMap: Record<string, string> = {
  male: '男',
  female: '女',
}
const ACTIVE_ORDER_STATUSES = new Set([
  'pending_dispatch',
  'pending_accept',
  'pending_grab',
  'pending_sign',
  'pending_service',
  'in_progress',
  'emergency',
])
const quickOrderSummary = computed(() => ({
  total: quickOrders.value.length,
  active: quickOrders.value.filter((item) => ACTIVE_ORDER_STATUSES.has(item.status)).length,
  finished: quickOrders.value.filter((item) => item.status === 'completed').length,
}))
function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const searchForm = reactive({
  keyword: String(route.query.keyword || ''),
  page: parsePositiveNumber(route.query.page, 1),
  pageSize: parsePositiveNumber(route.query.pageSize, 20),
  customerOnly: route.query.customerOnly === 'true',
})

// ── 回收站 ──
const trashVisible = ref(false)
const trashLoading = ref(false)
const trashData = ref<any[]>([])
const trashTotal = ref(0)
const trashKeyword = ref('')
const trashPage = ref(1)

async function openTrash() {
  trashVisible.value = true
  trashPage.value = 1
  trashKeyword.value = ''
  await loadTrash()
}

async function loadTrash() {
  trashLoading.value = true
  try {
    const params: any = { page: trashPage.value, pageSize: 20 }
    if (trashKeyword.value) params.keyword = trashKeyword.value
    const res = await getDeletedCustomers(params)
    trashData.value = res.items || []
    trashTotal.value = res.total || 0
  } catch {
    // handled by interceptor
  } finally {
    trashLoading.value = false
  }
}

async function handleRestore(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定将「${row.nickname || row.phone || 'ID:' + row.id}」从回收站恢复？`,
      '恢复确认',
      { type: 'info', confirmButtonText: '恢复', cancelButtonText: '取消' }
    )
    await restoreCustomer(row.id)
    ElMessage.success('已恢复')
    loadTrash()
    loadData()
  } catch (e: any) {
    if (e !== 'cancel' && e?.message !== 'cancel') ElMessage.error(e?.message || '恢复失败')
  }
}

async function handlePermanentDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `此操作将彻底删除「${row.nickname || row.phone || 'ID:' + row.id}」及其所有关联数据，不可恢复！确认继续？`,
      '⚠️ 彻底删除',
      { type: 'error', confirmButtonText: '彻底删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
    await permanentDeleteCustomer(row.id)
    ElMessage.success('已彻底删除')
    loadTrash()
  } catch (e: any) {
    if (e !== 'cancel' && e?.message !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

// ── 主列表 ──
function openProfileDialog(row: any) {
  currentCustomer.value = row
  Object.assign(profileForm, {
    name: '',
    relationship: '',
    gender: '',
    age: undefined,
    phone: row.phone || '',
    emergencyContact: '',
    emergencyPhone: '',
    homeRegion: [],
    homeAddressDetail: '',
    mainAppeal: '',
  })
  profileDialogVisible.value = true
}

async function handleCreateProfile() {
  if (!profileForm.name?.trim()) {
    ElMessage.warning('请输入家庭成员姓名')
    return
  }
  if (!currentCustomer.value) return
  profileSaving.value = true
  try {
    const regionArr = (profileForm.homeRegion || []).filter(Boolean)
    const detailAddr = (profileForm.homeAddressDetail || '').trim()
    const fullAddress = regionArr.length ? regionArr.join('') + (detailAddr ? ' ' + detailAddr : '') : detailAddr
    const hp: Record<string, any> = {}
    if (profileForm.relationship) {
      hp.relation = relationshipOptions.find(r => r.value === profileForm.relationship)?.label
      hp.relationship = profileForm.relationship
    }
    if (regionArr.length) hp.homeRegion = regionArr
    if (detailAddr) hp.homeAddressDetail = detailAddr
    await createServiceTarget(currentCustomer.value.id, {
      name: profileForm.name.trim(),
      relationship: profileForm.relationship || undefined,
      gender: profileForm.gender || undefined,
      age: profileForm.age,
      phone: profileForm.phone || undefined,
      emergencyContact: profileForm.emergencyContact || undefined,
      emergencyPhone: profileForm.emergencyPhone || undefined,
      homeAddress: fullAddress || undefined,
      mainAppeal: profileForm.mainAppeal || undefined,
      healthProfile: Object.keys(hp).length ? hp : undefined,
    })
    ElMessage.success('健康档案创建成功')
    profileDialogVisible.value = false
    loadData()
  } catch {
    // handled by interceptor
  } finally {
    profileSaving.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定将客户「${row.nickname || row.phone || '未命名'}」移入回收站？可在回收站中恢复或彻底删除。`,
      '移入回收站',
      { type: 'warning', confirmButtonText: '移入回收站', cancelButtonText: '取消' }
    )
    await deleteCustomer(row.id)
    ElMessage.success('已移入回收站')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
    }
  }
}

async function loadData() {
  syncQuery()
  loading.value = true
  try {
    const params: any = { page: searchForm.page, pageSize: searchForm.pageSize }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.customerOnly) params.customerOnly = true
    const res = await getCustomerList(params)
    tableData.value = res.items || []
    total.value = res.total || 0
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function buildQuery() {
  const query: Record<string, string> = {}
  if (searchForm.keyword) query.keyword = searchForm.keyword
  if (searchForm.page > 1) query.page = String(searchForm.page)
  if (searchForm.pageSize !== 20) query.pageSize = String(searchForm.pageSize)
  if (searchForm.customerOnly) query.customerOnly = 'true'
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
  searchForm.pageSize = parsePositiveNumber(query.pageSize, 20)
  searchForm.customerOnly = query.customerOnly === 'true'
}

function getRelationshipLabel(value?: string) {
  return relationshipLabelMap[value || ''] || value || '—'
}

function getGenderLabel(value?: string) {
  return genderLabelMap[value || ''] || '—'
}

async function openQuickView(row: any) {
  quickViewVisible.value = true
  quickViewLoading.value = true
  quickViewTab.value = 'info'
  quickCustomer.value = null
  quickServiceTargets.value = []
  quickOrders.value = []
  try {
    const [detail, serviceTargets, orderRes] = await Promise.all([
      getCustomerDetail(row.id),
      getServiceTargets(row.id).catch(() => []),
      getCustomerOrders(row.id).catch(() => ({ items: [] })),
    ])
    quickCustomer.value = detail
    quickServiceTargets.value = Array.isArray(serviceTargets) ? serviceTargets : []
    quickOrders.value = Array.isArray(orderRes?.items) ? orderRes.items.slice(0, 8) : []
  } catch {
    ElMessage.error('加载客户快览失败')
  } finally {
    quickViewLoading.value = false
  }
}

function handleSearch() {
  searchForm.page = 1
  loadData()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.page = 1
  searchForm.customerOnly = false
  loadData()
}

function handlePageChange(page: number) {
  searchForm.page = page
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
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">客户中心</h2>
        <p class="page-subtitle">
          本列表按<strong>登录账号</strong>展示全部系统用户（小程序、客服、陪诊员、管理员）；可开启"仅小程序用户"筛选。健康档案请到「客户健康管理」查看。
        </p>
      </div>
      <div class="page-header-actions">
        <el-button type="primary" plain @click="router.push('/customer-health/index')">客户健康管理</el-button>
        <el-button @click="openTrash">
          <el-icon><Delete /></el-icon> 回收站
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="filter-bar">
      <el-form inline>
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="姓名/手机号" clearable style="width: 220px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="仅小程序用户">
          <el-switch v-model="searchForm.customerOnly" @change="handleSearch" />
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
          <span class="table-card__title">客户列表 <el-tag size="small" type="info" effect="plain" style="margin-left:8px;">共 {{ total }} 条</el-tag></span>
        </div>
      </template>
      <el-table
        :data="tableData"
        v-loading="loading"
        highlight-current-row
        :header-cell-style="{ fontWeight: '600', color: '#475569', fontSize: '13px', background: '#f8fafc' }"
      >
        <el-table-column prop="id" label="ID" width="70" align="center">
          <template #default="{ row }">
            <span style="font-size:12px;color:#64748b;font-family:'SF Mono','Consolas',monospace;">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="客户信息" min-width="220">
          <template #default="{ row }">
            <div class="cell-customer">
              <div class="cell-customer__avatar">
                {{ (row.nickname || row.phone || '?').substring(0, 1) }}
              </div>
              <div class="cell-customer__info">
                <div class="cell-customer__name">{{ row.nickname || '未设置昵称' }}</div>
                <div class="cell-customer__phone">{{ row.phone || '—' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)" size="small" effect="light" round>
              {{ getRoleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="服务概况" width="200">
          <template #default="{ row }">
            <div class="cell-stats">
              <div class="cell-stats__item">
                <span class="cell-stats__num">{{ row.serviceTargets?.length ?? row.serviceTargetsCount ?? 0 }}</span>
                <span class="cell-stats__label">家庭成员</span>
              </div>
              <div class="cell-stats__divider" />
              <div class="cell-stats__item">
                <span class="cell-stats__num">{{ row.orders?.length ?? row.ordersCount ?? 0 }}</span>
                <span class="cell-stats__label">订单</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="家庭" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip v-if="row.familyGroupsTooltip" :content="row.familyGroupsTooltip" placement="top">
              <el-button
                v-if="row.familyGroupsLabel"
                type="primary"
                link
                size="small"
                style="padding:0;"
                @click.stop="router.push(`/customer-center/customers/detail/${row.id}?tab=families`)"
              >{{ row.familyGroupsLabel }}</el-button>
              <span v-else class="cell-muted">—</span>
            </el-tooltip>
            <span v-else class="cell-muted">{{ row.familyGroupsLabel || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">
            <span style="font-size:12px;color:#94a3b8;">{{ row.createdAt ? formatDate(row.createdAt) : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200" align="center">
          <template #default="{ row }">
            <div class="cell-actions">
              <el-button size="small" @click="openQuickView(row)" class="cell-actions__btn cell-actions__btn--default">
                <el-icon :size="13"><View /></el-icon>快览
              </el-button>
              <el-button size="small" type="primary" plain @click="router.push(`/customer-center/customers/detail/${row.id}`)" class="cell-actions__btn">
                详情
              </el-button>
              <el-dropdown trigger="click" @command="(cmd: string) => { if (cmd === 'order') router.push(`/service/orders/create?userId=${row.id}`); if (cmd === 'profile') openProfileDialog(row); if (cmd === 'delete') handleDelete(row) }">
                <el-button size="small" class="cell-actions__btn cell-actions__btn--more">
                  <el-icon :size="13"><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="order"><el-icon><Plus /></el-icon>创建订单</el-dropdown-item>
                    <el-dropdown-item command="profile"><el-icon><Document /></el-icon>添加家庭成员</el-dropdown-item>
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

    <!-- 回收站弹窗 -->
    <el-dialog v-model="trashVisible" title="🗑️ 回收站" width="780px" destroy-on-close>
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <el-input
          v-model="trashKeyword"
          placeholder="搜索姓名/手机号"
          clearable
          style="width:220px"
          @keyup.enter="loadTrash"
        />
        <el-button @click="loadTrash"><el-icon><Search /></el-icon>搜索</el-button>
        <el-text type="info" style="margin-left:auto; line-height:32px; font-size:12px;">
          回收站中的数据可恢复，彻底删除后不可找回
        </el-text>
      </div>
      <el-table :data="trashData" v-loading="trashLoading" stripe empty-text="回收站为空">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="nickname" label="昵称" width="120">
          <template #default="{ row }">{{ row.nickname || '—' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="140">
          <template #default="{ row }">{{ row.phone || '—' }}</template>
        </el-table-column>
        <el-table-column label="删除时间" width="170">
          <template #default="{ row }">{{ row.deletedAt ? formatDate(row.deletedAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button type="success" link size="small" @click="handleRestore(row)">
              <el-icon><RefreshLeft /></el-icon> 恢复
            </el-button>
            <el-button type="danger" link size="small" @click="handlePermanentDelete(row)">
              <el-icon><Delete /></el-icon> 彻底删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrapper" v-if="trashTotal > 20">
        <el-pagination
          v-model:current-page="trashPage"
          :total="trashTotal"
          :page-size="20"
          layout="total, prev, pager, next"
          background
          @current-change="(p) => { trashPage = p; loadTrash() }"
        />
      </div>
    </el-dialog>

    <!-- 添加家庭成员弹窗 -->
    <el-dialog v-model="profileDialogVisible" title="为该客户添加家庭成员" width="520px" @close="currentCustomer = null">
      <p v-if="currentCustomer" style="margin-bottom: 16px; color: #606266; font-size: 14px;">
        正在为 <strong>{{ currentCustomer.nickname || currentCustomer.phone || '该客户' }}</strong> 添加家庭成员并建立健康档案
      </p>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom:12px;"
        title="添加后会自动加入该客户的家庭。「本人」关系挂在客户自己的监护人身份上；其他关系作为家庭成员。" />
      <el-form :model="profileForm" label-width="100px">
        <el-form-item label="姓名" required>
          <el-input v-model="profileForm.name" placeholder="请输入家庭成员姓名（如本人、父亲、母亲等）" />
        </el-form-item>
        <el-form-item label="与客户关系">
          <el-select v-model="profileForm.relationship" placeholder="请选择" clearable style="width: 100%;">
            <el-option v-for="opt in relationshipOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="profileForm.gender" placeholder="选填" clearable style="width: 120px;">
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
          </el-select>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input-number v-model="profileForm.age" :min="0" :max="150" placeholder="选填" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="profileForm.phone" placeholder="选填，默认使用客户手机号" />
        </el-form-item>
        <el-form-item label="紧急联系人">
          <el-input v-model="profileForm.emergencyContact" placeholder="选填" />
        </el-form-item>
        <el-form-item label="紧急联系电话">
          <el-input v-model="profileForm.emergencyPhone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="省市区/县">
          <el-cascader
            v-model="profileForm.homeRegion"
            :options="(pcaTextArr as any)"
            :props="{ expandTrigger: 'hover' }"
            placeholder="选填，支持按拼音搜索"
            clearable
            filterable
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="profileForm.homeAddressDetail" placeholder="选填，街道、门牌号等" />
        </el-form-item>
        <el-form-item label="主要诉求">
          <el-input v-model="profileForm.mainAppeal" type="textarea" :rows="2" placeholder="选填，如本次就诊目的、病情摘要等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="profileSaving" @click="handleCreateProfile">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="quickViewVisible" title="客户快览" size="46%" destroy-on-close>
      <div v-loading="quickViewLoading">
        <template v-if="quickCustomer">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px;">
            <div>
              <div style="font-size:20px;font-weight:700;color:#303133;">
                {{ quickCustomer.nickname || quickCustomer.realName || quickCustomer.phone || `客户 #${quickCustomer.id}` }}
              </div>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                <el-tag size="small" type="info">手机号 {{ quickCustomer.phone || '未填写' }}</el-tag>
                <el-tag size="small" type="success">家庭成员 {{ quickServiceTargets.length }}</el-tag>
                <el-tag size="small" type="warning">最近订单 {{ quickOrderSummary.total }}</el-tag>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <el-button size="small" @click="router.push(`/customer-center/customers/detail/${quickCustomer.id}`)">完整详情</el-button>
              <el-button size="small" type="success" @click="router.push(`/service/orders/create?userId=${quickCustomer.id}`)">创建订单</el-button>
              <el-button size="small" type="warning" @click="openProfileDialog(quickCustomer)">添加家庭成员</el-button>
            </div>
          </div>

          <el-tabs v-model="quickViewTab" type="border-card">
            <el-tab-pane label="客户信息" name="info">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="昵称">
                  {{ quickCustomer.nickname || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="手机号">
                  {{ quickCustomer.phone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="注册时间">
                  {{ quickCustomer.createdAt ? formatDate(quickCustomer.createdAt) : '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="最近登录">
                  {{ quickCustomer.lastLoginAt ? formatDate(quickCustomer.lastLoginAt) : '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="家庭成员数">
                  {{ quickServiceTargets.length }}
                </el-descriptions-item>
                <el-descriptions-item label="最近订单数">
                  {{ quickOrderSummary.total }}
                </el-descriptions-item>
              </el-descriptions>

              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;">
                <el-card shadow="never">
                  <div style="font-size:12px;color:#909399;">进行中订单</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:700;color:#303133;">{{ quickOrderSummary.active }}</div>
                </el-card>
                <el-card shadow="never">
                  <div style="font-size:12px;color:#909399;">已完成订单</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:700;color:#303133;">{{ quickOrderSummary.finished }}</div>
                </el-card>
                <el-card shadow="never">
                  <div style="font-size:12px;color:#909399;">待补全档案</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:700;color:#303133;">
                    {{ quickServiceTargets.length ? 0 : 1 }}
                  </div>
                </el-card>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`家庭成员 (${quickServiceTargets.length})`" name="targets">
              <el-empty v-if="!quickServiceTargets.length" description="还没有家庭成员 / 健康档案" />
              <div v-else style="display:flex;flex-direction:column;gap:12px;">
                <el-card v-for="target in quickServiceTargets" :key="target.id" shadow="never">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                    <div>
                      <div style="font-size:16px;font-weight:600;color:#303133;">{{ target.name || '未命名家庭成员' }}</div>
                      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                        <el-tag size="small">{{ getRelationshipLabel(target.relationship) }}</el-tag>
                        <el-tag size="small" type="success">{{ getGenderLabel(target.gender) }}</el-tag>
                        <el-tag size="small" type="info">{{ target.age ? `${target.age} 岁` : '年龄未填' }}</el-tag>
                      </div>
                    </div>
                    <el-button size="small" @click="router.push(`/customer-center/customers/detail/${quickCustomer.id}`)">查看档案</el-button>
                  </div>
                  <div style="margin-top:12px;font-size:13px;color:#606266;line-height:1.7;">
                    <div>联系电话：{{ target.phone || quickCustomer.phone || '—' }}</div>
                    <div>紧急联系人：{{ target.emergencyContact || '—' }} / {{ target.emergencyPhone || '—' }}</div>
                    <div>家庭地址：{{ target.homeAddress || '—' }}</div>
                    <div>主要诉求：{{ target.mainAppeal || '—' }}</div>
                  </div>
                </el-card>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`最近订单 (${quickOrderSummary.total})`" name="orders">
              <el-empty v-if="!quickOrders.length" description="暂无订单记录" />
              <el-table v-else :data="quickOrders" stripe>
                <el-table-column prop="orderNumber" label="订单号" min-width="180" />
                <el-table-column label="家庭成员" min-width="100">
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
          </el-tabs>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.page-header {
  align-items: flex-start;
}
.page-subtitle {
  margin: 10px 0 0;
  max-width: 720px;
  font-size: 13px;
  line-height: 1.55;
  color: #94a3b8;
  font-weight: 400;
}
.page-header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}

.table-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;

  :deep(.el-card__header) {
    padding: 14px 20px;
    border-bottom: 1px solid #f1f5f9;
    background: #f8fafc;
  }
  :deep(.el-card__body) { padding: 0; }
  :deep(.el-table) {
    --el-table-border-color: #f1f5f9;
    --el-table-row-hover-bg-color: #f0f9ff;
    --el-table-current-row-bg-color: #eff6ff;
    font-size: 13px;
  }
  :deep(.el-table th.el-table__cell) {
    padding: 12px 0;
    border-bottom: 2px solid #e2e8f0;
  }
  :deep(.el-table td.el-table__cell) {
    padding: 14px 0;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
  }
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

.cell-customer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cell-customer__avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.cell-customer__name {
  font-weight: 500;
  color: #1e293b;
  font-size: 13px;
}
.cell-customer__phone {
  font-size: 12px;
  color: #94a3b8;
  font-family: 'SF Mono', 'Consolas', monospace;
  margin-top: 2px;
}
.cell-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cell-stats__item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.cell-stats__num {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}
.cell-stats__label {
  font-size: 11px;
  color: #94a3b8;
}
.cell-stats__divider {
  width: 1px;
  height: 16px;
  background: #e2e8f0;
}
.cell-muted {
  color: #cbd5e1;
  font-size: 13px;
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
    &:hover {
      background: #f1f5f9 !important;
      border-color: #cbd5e1 !important;
      color: #1e293b !important;
    }
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
