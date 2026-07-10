<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAttendantDetail, setAttendantCredentials, updateAttendant } from '@/api/attendant'
import { getOrderList, getOrderDetail, updateOrder } from '@/api/order'
import { orderStatusMap, formatDate, formatMoney } from '@/utils/format'
import { getToken } from '@/utils/auth'
import { API_BASE_URL } from '@/config/api-base'
const route = useRoute()
const router = useRouter()
const attendantId = route.params.id as string
const activeTab = ref('basic')

const loading = ref(false)
const attendant = ref<any>(null)

const orderLoading = ref(false)
const orders = ref<any[]>([])
const orderTotal = ref(0)
const orderPage = ref(1)
const orderPageSize = 10

const settlementDialogVisible = ref(false)
const settlementLoading = ref(false)
const settlementSaving = ref(false)
const settlementForm = ref<any>(null)

const credentialsDialogVisible = ref(false)
const credentialsForm = ref({ username: '', password: '' })
const credentialsSaving = ref(false)

const editForm = ref({ realName: '', employeeId: '', avatarUrl: '', phone: '' })
const basicSaving = ref(false)
const avatarUploading = ref(false)


const statusMap: Record<string, { label: string; type: string }> = {
  active: { label: '在职', type: 'success' },
  disabled: { label: '停用', type: 'danger' },
}

const settlementStatusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待结算', type: 'warning' },
  settled: { label: '已结算', type: 'success' },
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

const avatarDisplayUrl = computed(() => {
  const url = editForm.value.avatarUrl || attendant.value?.avatarUrl
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
})

function getAttendantIncome(row: any) {
  return Number(row?.attendantFee || 0)
}

async function loadAttendant() {
  loading.value = true
  try {
    const data = await getAttendantDetail(attendantId)
    attendant.value = data
    editForm.value = {
      realName: data.realName ?? '',
      employeeId: data.employeeId ?? '',
      avatarUrl: data.avatarUrl ?? '',
      phone: data.phone ?? '',
    }
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally {
    loading.value = false
  }
}

async function onAvatarUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file || !file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  avatarUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const token = getToken()
    const res = await fetch(`${API_BASE_URL}/documents/raw-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || '上传失败')
    const url = data?.data?.url ?? data?.url
    if (!url) throw new Error('上传失败')
    editForm.value.avatarUrl = url
    await saveBasicInfo()
  } catch (err: any) {
    ElMessage.error(err?.message || '头像上传失败')
  } finally {
    avatarUploading.value = false
    if (input) input.value = ''
  }
}

async function removeAvatar() {
  editForm.value.avatarUrl = ''
  await saveBasicInfo()
}

async function saveBasicInfo() {
  basicSaving.value = true
  try {
    await updateAttendant(Number(attendantId), {
      realName: editForm.value.realName.trim() || undefined,
      employeeId: editForm.value.employeeId.trim() || undefined,
      avatarUrl: editForm.value.avatarUrl || undefined,
      phone: editForm.value.phone.trim() || undefined,
    })
    ElMessage.success('保存成功')
    loadAttendant()
  } catch {
    // handled by interceptor
  } finally {
    basicSaving.value = false
  }
}

async function loadOrders(page = 1) {
  orderLoading.value = true
  orderPage.value = page
  try {
    const res = await getOrderList({ attendantId, page, pageSize: orderPageSize })
    orders.value = res.items || []
    orderTotal.value = res.total || 0
  } catch {
    orders.value = []
  } finally {
    orderLoading.value = false
  }
}

async function openSettlementDialog(row: any) {
  settlementDialogVisible.value = true
  settlementLoading.value = true
  settlementForm.value = null
  try {
    const detail = await getOrderDetail(row.id)
    settlementForm.value = {
      id: detail.id,
      orderNumber: detail.orderNumber,
      serviceType: detail.serviceType,
      status: detail.status,
      attendantFee: Number(detail.attendantFee || 0),
      attendantFeeType: detail.attendantFeeType || '',
      settlementStatus: detail.settlementStatus || 'pending',
      paymentMethod: detail.paymentMethod || '',
      paymentPaidAtInput: toDateTimeInputValue(detail.paymentPaidAt),
      paymentReferenceInput: detail.paymentReference || '',
      settledAtInput: toDateTimeInputValue(detail.settledAt),
      settlementRemarkInput: detail.settlementRemark || '',
    }
  } catch {
    // 错误由全局请求拦截器统一弹出
    settlementDialogVisible.value = false
  } finally {
    settlementLoading.value = false
  }
}

async function saveSettlement() {
  if (!settlementForm.value) return
  if (settlementForm.value.settlementStatus === 'settled' && !settlementForm.value.paymentMethod) {
    ElMessage.warning('请先选择结算方式')
    return
  }
  settlementSaving.value = true
  try {
    await updateOrder(settlementForm.value.id, {
      settlementStatus: settlementForm.value.settlementStatus,
      paymentStatus: settlementForm.value.settlementStatus === 'settled' ? 'paid' : 'unpaid',
      paymentMethod: settlementForm.value.settlementStatus === 'settled'
        ? (settlementForm.value.paymentMethod || null)
        : null,
      paymentPaidAt: settlementForm.value.settlementStatus === 'settled'
        ? (settlementForm.value.paymentPaidAtInput || null)
        : null,
      paymentReference: settlementForm.value.settlementStatus === 'settled'
        ? (settlementForm.value.paymentReferenceInput || null)
        : null,
      settledAt: settlementForm.value.settlementStatus === 'settled'
        ? (settlementForm.value.settledAtInput || null)
        : null,
      settlementRemark: settlementForm.value.settlementRemarkInput || null,
    })
    ElMessage.success('结算状态已更新')
    settlementDialogVisible.value = false
    await loadOrders(orderPage.value)
  } catch {
    // handled by interceptor
  } finally {
    settlementSaving.value = false
  }
}

const reviews = computed(() => {
  if (!orders.value.length) return []
  return orders.value
    .filter((o: any) => o.reviews?.length)
    .flatMap((o: any) =>
      o.reviews.map((r: any) => ({
        ...r,
        content: r.content ?? r.comment ?? '',
        orderNumber: o.orderNumber,
      })),
    )
})

const stats = computed(() => {
  const total = orderTotal.value
  const completed = orders.value.filter((o: any) => o.status === 'completed').length
  const avgRating = attendant.value?.averageRating ?? '—'
  return { total, completed, avgRating }
})

function handleTabChange(tab: string | number) {
  if (String(tab) === 'orders' && !orders.value.length) {
    loadOrders()
  }
}

function openCredentialsDialog() {
  credentialsForm.value = { username: attendant.value?.username || '', password: '' }
  credentialsDialogVisible.value = true
}

async function saveCredentials() {
  if (!credentialsForm.value.username.trim()) {
    ElMessage.warning('请输入登录账号')
    return
  }
  if (!credentialsForm.value.password) {
    ElMessage.warning('请输入密码')
    return
  }
  credentialsSaving.value = true
  try {
    await setAttendantCredentials(attendantId, {
      username: credentialsForm.value.username.trim(),
      password: credentialsForm.value.password,
    })
    ElMessage.success('保存成功')
    credentialsDialogVisible.value = false
    loadAttendant()
  } catch {
    // handled by interceptor
  } finally {
    credentialsSaving.value = false
  }
}

onMounted(() => {
  loadAttendant()
  loadOrders()
})
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">陪诊员详情 #{{ attendant?.realName || attendantId }}</h2>
        <p class="page-subtitle">推荐按「基础资料 -> 接单历史 -> 排班配置」顺序维护，信息更完整。</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="router.push('/dispatch/attendants')">返回列表</el-button>
        <el-button v-if="attendant?.id" type="primary" @click="activeTab = 'orders'">查看接单历史</el-button>
      </div>
    </div>

    <div class="page-guide" v-if="attendant">
      <span class="page-guide__label">流程建议</span>
      <el-tag size="small" effect="plain">1 完善基础资料</el-tag>
      <el-tag size="small" effect="plain">2 检查接单明细</el-tag>
      <el-tag size="small" effect="plain">3 校验排班可用性</el-tag>
      <el-tag size="small" effect="plain">4 同步账号状态</el-tag>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <el-button @click="router.back()">返回上一页</el-button>
      <el-button v-if="attendant?.id" @click="activeTab = 'basic'">回到基础资料</el-button>
      <el-button v-if="attendant?.id" @click="activeTab = 'schedules'">查看排班</el-button>
    </div>

    <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
      <!-- 基本资料 -->
      <el-tab-pane label="基本资料" name="basic">
        <div v-if="attendant" class="basic-header">
          <div class="avatar-section">
            <div class="avatar-wrap">
              <el-avatar v-if="avatarDisplayUrl" :size="80" :src="avatarDisplayUrl" />
              <el-avatar v-else :size="80">{{ (editForm.realName || '陪')[0] }}</el-avatar>
            </div>
            <div class="avatar-actions">
              <label class="el-button el-button--primary el-button--small">
                <input type="file" accept="image/*" class="avatar-input" @change="onAvatarUpload" />
                {{ avatarUploading ? '上传中...' : '上传头像' }}
              </label>
              <el-button v-if="avatarDisplayUrl" type="danger" link size="small" @click="removeAvatar">移除</el-button>
            </div>
            <p class="avatar-hint">头像将同步到陪诊员工作台及客户订单详情</p>
          </div>
        </div>
        <el-descriptions :column="2" border v-if="attendant">
          <el-descriptions-item label="姓名">
            <el-input v-model="editForm.realName" placeholder="请输入姓名（同步到工作台及客户端）" clearable style="width: 200px;" />
          </el-descriptions-item>
          <el-descriptions-item label="工号">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-input v-model="editForm.employeeId" placeholder="请输入工号" clearable style="width: 200px;" />
              <el-button type="primary" size="small" :loading="basicSaving" @click="saveBasicInfo">保存</el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="手机号">
            <el-input v-model="editForm.phone" placeholder="11位手机号，同步到小程序订单详情拨号" clearable style="width: 200px;" maxlength="11" show-word-limit />
          </el-descriptions-item>
          <el-descriptions-item label="综合评分">
            <el-rate
              v-if="attendant.averageRating"
              :model-value="attendant.averageRating"
              disabled
              show-score
              score-template="{value} 分"
            />
            <span v-else>暂无评分</span>
          </el-descriptions-item>
          <el-descriptions-item label="接单总量">{{ attendant.totalOrders ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="登录账号">
            {{ attendant.username || '未设置' }}
            <el-button type="primary" link size="small" @click="openCredentialsDialog" style="margin-left: 8px;">
              {{ attendant.username ? '修改' : '设置' }}
            </el-button>
          </el-descriptions-item>
          <el-descriptions-item label="账号状态">
            <el-tag :type="(statusMap[attendant.status]?.type as any) || 'info'" size="small">
              {{ statusMap[attendant.status]?.label || attendant.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="保险信息">{{ attendant.insuranceInfo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="保险有效期">
            {{ attendant.insuranceExpiry ? formatDate(attendant.insuranceExpiry, 'YYYY-MM-DD') : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ attendant.createdAt ? formatDate(attendant.createdAt) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="最后更新">
            {{ attendant.updatedAt ? formatDate(attendant.updatedAt) : '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <!-- 接单历史 -->
      <el-tab-pane label="接单历史" name="orders">
        <el-table :data="orders" v-loading="orderLoading" highlight-current-row>
          <el-table-column label="订单号" width="180">
            <template #default="{ row }">
              <el-button type="primary" link @click="router.push(`/service/orders/detail/${row.id}`)">
                {{ row.orderNumber || row.id }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="客户" width="120">
            <template #default="{ row }">{{ row.user?.nickname || row.user?.phone || '—' }}</template>
          </el-table-column>
          <el-table-column prop="serviceType" label="服务类型" width="120" />
          <el-table-column label="服务时间" width="170">
            <template #default="{ row }">{{ row.serviceTime ? formatDate(row.serviceTime) : '—' }}</template>
          </el-table-column>
          <el-table-column label="金额" width="100">
            <template #default="{ row }">{{ formatMoney(row.totalFee || row.baseFee || 0) }}</template>
          </el-table-column>
          <el-table-column label="陪诊员收入" min-width="150">
            <template #default="{ row }">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="font-weight: 600; color: #67c23a;">
                  {{ row.attendantFee != null ? formatMoney(getAttendantIncome(row)) : '—' }}
                </span>
                <span v-if="row.attendantFeeType" style="font-size: 12px; color: #909399;">
                  {{ row.attendantFeeType }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="结算状态" width="110">
            <template #default="{ row }">
              <el-tag :type="(settlementStatusMap[row.settlementStatus]?.type as any) || 'info'" size="small">
                {{ settlementStatusMap[row.settlementStatus]?.label || '待结算' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="结算方式" width="130">
            <template #default="{ row }">
              {{ paymentMethodMap[row.paymentMethod] || '—' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="(orderStatusMap[row.status]?.type as any) || 'info'" size="small">
                {{ orderStatusMap[row.status]?.label || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ row.createdAt ? formatDate(row.createdAt) : '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button
                :type="row.settlementStatus === 'settled' ? 'success' : 'primary'"
                link
                @click="openSettlementDialog(row)"
              >
                {{ row.settlementStatus === 'settled' ? '已结算' : '去结算' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-wrapper" v-if="orderTotal > orderPageSize">
          <el-pagination
            v-model:current-page="orderPage"
            :total="orderTotal"
            :page-size="orderPageSize"
            layout="total, prev, pager, next"
            background
            @current-change="loadOrders"
          />
        </div>
        <el-empty v-if="!orderLoading && !orders.length" description="暂无接单记录" />
      </el-tab-pane>

      <!-- 用户评价 -->
      <el-tab-pane label="用户评价" name="reviews">
        <div v-if="reviews.length">
          <el-card
            v-for="(review, idx) in reviews"
            :key="review.id || idx"
            shadow="never"
            style="margin-bottom: 12px;"
          >
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <el-rate :model-value="review.rating" disabled />
                <p style="margin: 8px 0 4px; color: #303133;">{{ review.content || '用户未填写评价内容' }}</p>
                <span style="font-size: 12px; color: #909399;">
                  订单：{{ review.orderNumber || '—' }}
                </span>
              </div>
              <span style="font-size: 12px; color: #909399; white-space: nowrap; margin-left: 16px;">
                {{ review.createdAt ? formatDate(review.createdAt) : '' }}
              </span>
            </div>
          </el-card>
        </div>
        <el-empty v-else description="暂无评价" />
      </el-tab-pane>

      <!-- 绩效统计 -->
      <el-tab-pane label="绩效统计" name="performance">
        <el-row :gutter="20" v-if="attendant">
          <el-col :span="8">
            <el-card shadow="never" class="stat-card">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总订单数</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="never" class="stat-card">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成订单</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="never" class="stat-card">
              <div class="stat-value">{{ stats.avgRating }}</div>
              <div class="stat-label">平均评分</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" style="margin-top: 20px;" v-if="attendant">
          <template #header>
            <span>完成订单趋势</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="本月完成">
              {{ attendant.monthlyCompleted ?? '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="本月收入">
              {{ attendant.monthlyIncome != null ? formatMoney(attendant.monthlyIncome) : '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="好评率">
              {{ attendant.positiveRate != null ? `${attendant.positiveRate}%` : '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="投诉次数">
              {{ attendant.complaintCount ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-empty v-if="!attendant" description="暂无绩效数据" />
      </el-tab-pane>
    </el-tabs>

    <!-- 设置登录账号密码 -->
    <el-dialog v-model="credentialsDialogVisible" title="设置登录账号" width="400px">
      <el-form :model="credentialsForm" label-width="80px">
        <el-form-item label="登录账号">
          <el-input v-model="credentialsForm.username" placeholder="陪诊员登录用户名" />
        </el-form-item>
        <el-form-item label="登录密码">
          <el-input v-model="credentialsForm.password" type="password" placeholder="至少6位" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="credentialsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="credentialsSaving" @click="saveCredentials">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="settlementDialogVisible" title="订单结算" width="560px" destroy-on-close>
      <div v-loading="settlementLoading">
        <template v-if="settlementForm">
          <el-descriptions :column="2" border style="margin-bottom: 16px;">
            <el-descriptions-item label="订单号">{{ settlementForm.orderNumber || '—' }}</el-descriptions-item>
            <el-descriptions-item label="服务类型">{{ settlementForm.serviceType || '—' }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag :type="(orderStatusMap[settlementForm.status]?.type as any) || 'info'" size="small">
                {{ orderStatusMap[settlementForm.status]?.label || settlementForm.status || '—' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="陪诊员收入">
              <span style="font-weight: 600; color: #67c23a;">
                {{ settlementForm.attendantFee != null ? formatMoney(settlementForm.attendantFee) : '—' }}
              </span>
              <span v-if="settlementForm.attendantFeeType" style="font-size: 12px; color: #909399; margin-left: 6px;">
                （{{ settlementForm.attendantFeeType }}）
              </span>
            </el-descriptions-item>
          </el-descriptions>

          <el-form :model="settlementForm" label-width="92px">
            <el-form-item label="结算状态">
              <el-radio-group v-model="settlementForm.settlementStatus">
                <el-radio-button label="pending">待结算</el-radio-button>
                <el-radio-button label="settled">已结算</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="结算方式">
              <el-select
                v-model="settlementForm.paymentMethod"
                clearable
                placeholder="请选择结算方式"
                style="width: 100%;"
                :disabled="settlementForm.settlementStatus !== 'settled'"
              >
                <el-option
                  v-for="(label, value) in paymentMethodMap"
                  :key="value"
                  :label="label"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="付款时间">
              <el-date-picker
                v-model="settlementForm.paymentPaidAtInput"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm"
                placeholder="选择付款时间"
                style="width: 100%;"
                :disabled="settlementForm.settlementStatus !== 'settled'"
              />
            </el-form-item>
            <el-form-item label="结算时间">
              <el-date-picker
                v-model="settlementForm.settledAtInput"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm"
                placeholder="选择结算时间"
                style="width: 100%;"
                :disabled="settlementForm.settlementStatus !== 'settled'"
              />
            </el-form-item>
            <el-form-item label="交易流水号">
              <el-input
                v-model="settlementForm.paymentReferenceInput"
                placeholder="可填写微信/支付宝流水号"
                maxlength="128"
                :disabled="settlementForm.settlementStatus !== 'settled'"
              />
            </el-form-item>
            <el-form-item label="备注">
              <el-input
                v-model="settlementForm.settlementRemarkInput"
                type="textarea"
                :rows="3"
                placeholder="填写结算备注（选填）"
              />
            </el-form-item>
          </el-form>
        </template>
      </div>
      <template #footer>
        <el-button @click="settlementDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="settlementSaving" @click="saveSettlement">保存结算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.page-header__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-title {
  margin: 0;
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.6;
}

.page-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.page-guide {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.page-guide__label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.stat-card {
  text-align: center;
  padding: 20px 0;
}
.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}
.stat-label {
  margin-top: 8px;
  font-size: 14px;
  color: #909399;
}
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.basic-header {
  margin-bottom: 20px;
}
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.avatar-wrap {
  flex-shrink: 0;
}
.avatar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}
.avatar-actions label {
  cursor: pointer;
  margin: 0;
}
.avatar-hint {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
</style>
