<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { API_BASE_URL } from '@/config/api-base'
import { getToken } from '@/utils/auth'
import {
  createPrescription,
  getPrescriptions,
  getPrescription,
  approvePrescription,
  rejectPrescription,
  searchMedicineCatalog,
} from '@/api/medication-reminder'
import { get } from '@/api/request'
import { formatLocalDate } from '@/utils/date'

type Severity = 'high' | 'medium' | 'low'

interface PrescriptionItemForm {
  medicineName: string
  specification: string
  severity: Severity
  dosePerTime: number | null
  timesPerDay: number | null
  totalQuantity: number | null
  unit: string
  dosage: string
  instructions: string
}

function createEmptyItem(): PrescriptionItemForm {
  return {
    medicineName: '',
    specification: '',
    severity: 'medium',
    dosePerTime: 1,
    timesPerDay: 1,
    totalQuantity: null,
    unit: '片',
    dosage: '',
    instructions: '',
  }
}

const form = ref({
  userId: undefined as number | undefined,
  serviceTargetId: undefined as number | undefined,
  orderId: undefined as number | undefined,
  sourceImage: '',
  hospital: '',
  doctorName: '',
  department: '',
  issuedDate: formatLocalDate(new Date()) || '',
  note: '',
  startDate: formatLocalDate(new Date()) || '',
  replaceExisting: false,
  items: [createEmptyItem()],
})

const customerOptions = ref<any[]>([])
const serviceTargetOptions = ref<any[]>([])
const orderOptions = ref<any[]>([])

async function searchCustomer(q: string) {
  if (!q || q.length < 1) return
  try {
    const res: any = await get('/users', { keyword: q, page: 1, pageSize: 20 })
    customerOptions.value = (res.items || res || []).map((u: any) => ({
      value: u.id,
      label: `${u.nickname || u.phone || '用户'} (${u.phone || u.id})`,
    }))
  } catch {
    customerOptions.value = []
  }
}

async function onCustomerChange(userId: number) {
  form.value.serviceTargetId = undefined
  form.value.orderId = undefined
  if (!userId) {
    serviceTargetOptions.value = []
    orderOptions.value = []
    return
  }
  try {
    const [targets, orders] = await Promise.all([
      get(`/users/${userId}/service-targets`).catch(() => []),
      get('/orders', { userId, pageSize: 20 }).catch(() => ({ items: [] })),
    ])
    serviceTargetOptions.value = (targets || []).map((t: any) => ({
      value: t.id,
      label: `${t.name}（${t.relation || '本人'}）`,
    }))
    const orderList = (orders as any)?.items || orders || []
    orderOptions.value = orderList.map((o: any) => ({
      value: o.id,
      label: `#${o.orderNumber || o.id} · ${o.serviceType || ''}`,
    }))
  } catch {
    serviceTargetOptions.value = []
    orderOptions.value = []
  }
}

function addItem() {
  form.value.items.push(createEmptyItem())
}

function removeItem(index: number) {
  if (form.value.items.length <= 1) {
    ElMessage.warning('至少保留一条药品')
    return
  }
  form.value.items.splice(index, 1)
}

/** 预估某条药品的疗程天数，前端展示用 */
function itemDays(item: PrescriptionItemForm): number | null {
  const total = Number(item.totalQuantity || 0)
  const dose = Number(item.dosePerTime || 0)
  const freq = Number(item.timesPerDay || 0)
  if (!total || !dose || !freq) return null
  return Math.max(1, Math.ceil(total / (dose * freq)))
}

function itemEndDate(item: PrescriptionItemForm): string {
  const days = itemDays(item)
  if (!days || !form.value.startDate) return '—'
  const d = new Date(form.value.startDate)
  d.setDate(d.getDate() + days - 1)
  return formatLocalDate(d) || '—'
}

// ─── 上传处方照片 ───
const uploading = ref(false)
async function handleUploadFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.error('仅支持 jpg/png/webp 图片')
    input.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片不能超过 5MB')
    input.value = ''
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_BASE_URL}/documents/raw-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() || ''}` },
      body: fd,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || '上传失败')
    const url = data?.data?.url ?? data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.sourceImage = url
    ElMessage.success('处方照片已上传')
  } catch (err: any) {
    ElMessage.error(err?.message || '上传失败')
  } finally {
    uploading.value = false
    if (input) input.value = ''
  }
}

// ─── 保存 ───
const saving = ref(false)
async function handleSubmit() {
  if (!form.value.userId) { ElMessage.warning('请选择客户'); return }
  if (!form.value.startDate) { ElMessage.warning('请选择统一起始日'); return }
  if (form.value.items.length === 0) { ElMessage.warning('至少录入一种药'); return }
  for (const item of form.value.items) {
    if (!item.medicineName?.trim()) {
      ElMessage.warning('存在未填写药品名称的条目')
      return
    }
    if (!item.dosePerTime || !item.timesPerDay || !item.totalQuantity) {
      ElMessage.warning(`${item.medicineName} 的每次用量 / 每日频次 / 总药量必须填写`)
      return
    }
  }

  const payload = {
    userId: form.value.userId,
    serviceTargetId: form.value.serviceTargetId || undefined,
    orderId: form.value.orderId || undefined,
    sourceImage: form.value.sourceImage || undefined,
    hospital: form.value.hospital || undefined,
    doctorName: form.value.doctorName || undefined,
    department: form.value.department || undefined,
    issuedDate: form.value.issuedDate || undefined,
    note: form.value.note || undefined,
    startDate: form.value.startDate,
    replaceExisting: form.value.replaceExisting,
    items: form.value.items.map((i) => ({
      medicineName: i.medicineName.trim(),
      specification: i.specification || undefined,
      severity: i.severity,
      dosePerTime: Number(i.dosePerTime),
      timesPerDay: Number(i.timesPerDay),
      totalQuantity: Number(i.totalQuantity),
      unit: i.unit || '片',
      dosage: i.dosage || undefined,
      instructions: i.instructions || undefined,
    })),
  }

  saving.value = true
  try {
    const res: any = await createPrescription(payload)
    ElMessage.success(`已创建处方批次 #${res?.prescription?.id || ''}，新建 ${res?.reminders?.length || 0} 条提醒`)
    resetForm()
    await loadHistory()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function resetForm() {
  form.value = {
    userId: undefined,
    serviceTargetId: undefined,
    orderId: undefined,
    sourceImage: '',
    hospital: '',
    doctorName: '',
    department: '',
    issuedDate: formatLocalDate(new Date()) || '',
    note: '',
    startDate: formatLocalDate(new Date()) || '',
    replaceExisting: false,
    items: [createEmptyItem()],
  }
}

// ─── 处方批次列表（录入 + 审核 + 历史 共用） ───
type ReviewStatusFilter = 'pending_review' | 'approved' | 'rejected' | ''

const historyLoading = ref(false)
const historyList = ref<any[]>([])
const reviewStatusFilter = ref<ReviewStatusFilter>('pending_review')

async function loadHistory() {
  historyLoading.value = true
  try {
    const res: any = await getPrescriptions({
      reviewStatus: reviewStatusFilter.value || undefined,
      page: 1,
      pageSize: 30,
    })
    historyList.value = res.items || []
  } catch {
    historyList.value = []
  } finally {
    historyLoading.value = false
  }
}

watch(reviewStatusFilter, () => loadHistory())

const reviewStats = computed(() => {
  const s = { pending_review: 0, approved: 0, rejected: 0 }
  for (const p of historyList.value) {
    ;(s as any)[p.reviewStatus] = ((s as any)[p.reviewStatus] || 0) + 1
  }
  return s
})

// ─── 审核抽屉（含原件预览 + 药品可编辑 + 通过/驳回） ───
const reviewDrawerOpen = ref(false)
const reviewLoading = ref(false)
const reviewSaving = ref(false)
const reviewCurrent = ref<any | null>(null)
const reviewItems = ref<PrescriptionItemForm[]>([])
const reviewStartDate = ref('')
const reviewNote = ref('')
const rejectReason = ref('')

async function openReview(id: number) {
  reviewDrawerOpen.value = true
  reviewLoading.value = true
  reviewCurrent.value = null
  reviewItems.value = []
  reviewStartDate.value = ''
  reviewNote.value = ''
  rejectReason.value = ''
  try {
    const res: any = await getPrescription(id)
    reviewCurrent.value = res
    const draft = (res?.itemsDraft || {}) as any
    const items = Array.isArray(draft.items) ? draft.items : []
    reviewItems.value = items.map((i: any) => ({
      medicineName: String(i.medicineName || ''),
      specification: String(i.specification || ''),
      severity: (i.severity as Severity) || 'medium',
      dosePerTime: Number(i.dosePerTime) || 1,
      timesPerDay: Number(i.timesPerDay) || 1,
      totalQuantity: Number(i.totalQuantity) || 0,
      unit: String(i.unit || '片'),
      dosage: String(i.dosage || ''),
      instructions: String(i.instructions || ''),
    }))
    reviewStartDate.value = draft.startDate || res?.issuedDate || formatLocalDate(new Date()) || ''
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    reviewLoading.value = false
  }
}

async function handleApprove() {
  if (!reviewCurrent.value) return
  for (const item of reviewItems.value) {
    if (!item.medicineName?.trim()) {
      ElMessage.warning('存在未填写药品名称的条目')
      return
    }
    if (!item.dosePerTime || !item.timesPerDay || !item.totalQuantity) {
      ElMessage.warning(`${item.medicineName} 的每次用量 / 每日频次 / 总药量必须填写`)
      return
    }
  }
  reviewSaving.value = true
  try {
    await approvePrescription(reviewCurrent.value.id, {
      items: reviewItems.value.map((i) => ({
        medicineName: i.medicineName.trim(),
        specification: i.specification || undefined,
        severity: i.severity,
        dosePerTime: Number(i.dosePerTime),
        timesPerDay: Number(i.timesPerDay),
        totalQuantity: Number(i.totalQuantity),
        unit: i.unit || '片',
        dosage: i.dosage || undefined,
        instructions: i.instructions || undefined,
      })),
      startDate: reviewStartDate.value,
      reviewNote: reviewNote.value || undefined,
    })
    ElMessage.success('已通过，提醒已创建')
    reviewDrawerOpen.value = false
    await loadHistory()
  } catch (e: any) {
    ElMessage.error(e?.message || '审核失败')
  } finally {
    reviewSaving.value = false
  }
}

async function handleReject() {
  if (!reviewCurrent.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  try {
    await ElMessageBox.confirm('确认驳回该处方？驳回后不会产生提醒', '提示', { type: 'warning' })
  } catch { return }
  reviewSaving.value = true
  try {
    await rejectPrescription(reviewCurrent.value.id, reason)
    ElMessage.success('已驳回')
    reviewDrawerOpen.value = false
    await loadHistory()
  } catch (e: any) {
    ElMessage.error(e?.message || '驳回失败')
  } finally {
    reviewSaving.value = false
  }
}

function addReviewItem() {
  reviewItems.value.push(createEmptyItem())
}
function removeReviewItem(index: number) {
  if (reviewItems.value.length <= 1) {
    ElMessage.warning('至少保留一条药品')
    return
  }
  reviewItems.value.splice(index, 1)
}

function reviewItemDays(item: PrescriptionItemForm): number | null {
  const total = Number(item.totalQuantity || 0)
  const dose = Number(item.dosePerTime || 0)
  const freq = Number(item.timesPerDay || 0)
  if (!total || !dose || !freq) return null
  return Math.max(1, Math.ceil(total / (dose * freq)))
}

// ─── 药品联想（录入表单用） ───
async function queryMedicines(query: string) {
  if (!query) return []
  try {
    const res: any = await searchMedicineCatalog(query, 20)
    return Array.isArray(res) ? res : []
  } catch {
    return []
  }
}

async function applyMedicineSuggestion(index: number, keyword: string) {
  if (!keyword || keyword.length < 1) return
  const list = await queryMedicines(keyword)
  if (list.length === 0) return
  const match = list.find((m: any) => m.name === keyword) || list[0]
  if (!match) return
  const target = form.value.items[index]
  if (!target) return
  if (match.defaultSeverity || match.severity) target.severity = (match.severity || match.defaultSeverity) as Severity
  if (match.defaultTimesPerDay) target.timesPerDay = match.defaultTimesPerDay
  if (match.defaultDosePerTime) target.dosePerTime = Number(match.defaultDosePerTime)
  if (match.defaultUnit) target.unit = match.defaultUnit
  if (match.defaultInstructions && !target.instructions) target.instructions = match.defaultInstructions
  if (match.specification && !target.specification) target.specification = match.specification
}

onMounted(() => {
  loadHistory()
})

const SEVERITY_LABEL: Record<Severity, string> = {
  high: '高风险',
  medium: '慢病',
  low: '保健',
}

const totalItems = computed(() => form.value.items.length)
const longestCourse = computed(() => {
  const days = form.value.items.map(itemDays).filter((d): d is number => !!d)
  return days.length ? Math.max(...days) : 0
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">处方批量录入</h2>
        <p class="page-subtitle">一张处方含多种药时，在这里一次性录入；后端自动按"总量 / 每日用量"算结束日期、按严重度配推送。</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="resetForm">清空</el-button>
      </div>
    </div>

    <el-card shadow="never" style="margin-bottom: 16px;">
      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;">
        <el-form-item label="客户" required style="min-width: 280px; margin: 0;">
          <el-select
            v-model="form.userId"
            filterable
            remote
            :remote-method="searchCustomer"
            placeholder="搜索客户姓名/手机号"
            style="width: 100%;"
            @change="onCustomerChange"
          >
            <el-option v-for="c in customerOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务对象" style="min-width: 200px; margin: 0;">
          <el-select v-model="form.serviceTargetId" placeholder="可选" clearable style="width: 100%;">
            <el-option v-for="t in serviceTargetOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联订单" style="min-width: 220px; margin: 0;">
          <el-select v-model="form.orderId" placeholder="可选" clearable style="width: 100%;">
            <el-option v-for="o in orderOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="开方日期" style="margin: 0;">
          <el-date-picker v-model="form.issuedDate" type="date" value-format="YYYY-MM-DD" placeholder="开方日期" />
        </el-form-item>
        <el-form-item label="服药起始日" required style="margin: 0;">
          <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="起始日" />
        </el-form-item>
      </div>
      <el-row :gutter="16" style="margin-top: 12px;">
        <el-col :span="8">
          <el-form-item label="医院" style="margin: 0;">
            <el-input v-model="form.hospital" placeholder="如：温州一医" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="开方医生" style="margin: 0;">
            <el-input v-model="form.doctorName" placeholder="如：张三" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="科室" style="margin: 0;">
            <el-input v-model="form.department" placeholder="如：神经内科" />
          </el-form-item>
        </el-col>
      </el-row>

      <div style="display: flex; gap: 24px; margin-top: 16px; align-items: flex-start;">
        <div>
          <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #666;">处方照片（可选）</label>
          <div
            v-if="form.sourceImage"
            style="width: 180px; height: 130px; border: 1px solid #dcdfe6; border-radius: 6px; overflow: hidden; position: relative;"
          >
            <img :src="form.sourceImage" style="width: 100%; height: 100%; object-fit: cover;" />
            <el-button
              link
              type="danger"
              size="small"
              style="position: absolute; right: 4px; top: 4px; background: rgba(255,255,255,0.9);"
              @click="form.sourceImage = ''"
            >删除</el-button>
          </div>
          <label
            v-else
            style="display: flex; align-items: center; justify-content: center; width: 180px; height: 130px; border: 1px dashed #dcdfe6; border-radius: 6px; cursor: pointer; color: #999;"
          >
            <input type="file" accept="image/*" style="display: none;" @change="handleUploadFile" />
            <span v-if="uploading">上传中…</span>
            <span v-else>+ 点击上传处方照</span>
          </label>
          <div style="color: #c0c4cc; font-size: 12px; margin-top: 4px;">JPG/PNG/WebP ≤ 5MB</div>
        </div>
        <div style="flex: 1;">
          <el-form-item label="处方备注" style="margin: 0;">
            <el-input v-model="form.note" type="textarea" :rows="5" placeholder="注意事项、饮食禁忌等" />
          </el-form-item>
          <div style="margin-top: 8px;">
            <el-checkbox v-model="form.replaceExisting">
              覆盖该客户下同名在用药（将自动取消旧提醒并清空其推送队列）
            </el-checkbox>
          </div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-bottom: 16px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="font-weight: 600;">药品清单</div>
        <el-tag style="margin-left: 12px;">{{ totalItems }} 种药</el-tag>
        <el-tag v-if="longestCourse > 0" type="warning" style="margin-left: 8px;">
          最长疗程 ≈ {{ longestCourse }} 天
        </el-tag>
        <div style="flex: 1;"></div>
        <el-button type="primary" @click="addItem"><el-icon><Plus /></el-icon>新增一种药</el-button>
      </div>

      <el-table :data="form.items" size="small" border>
        <el-table-column label="#" type="index" width="40" />
        <el-table-column label="药品名称" min-width="180">
          <template #default="{ row, $index }">
            <el-input
              v-model="row.medicineName"
              placeholder="如：波立维（氯吡格雷）"
              @blur="applyMedicineSuggestion($index, row.medicineName)"
            />
          </template>
        </el-table-column>
        <el-table-column label="规格" min-width="130">
          <template #default="{ row }">
            <el-input v-model="row.specification" placeholder="如：75mg × 7 片/盒" />
          </template>
        </el-table-column>
        <el-table-column label="严重度" width="140">
          <template #default="{ row }">
            <el-select v-model="row.severity" size="small" style="width: 100%;">
              <el-option v-for="(label, key) in SEVERITY_LABEL" :key="key" :label="label" :value="key" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="每次用量" width="110">
          <template #default="{ row }">
            <el-input-number v-model="row.dosePerTime" size="small" :min="0" :step="0.5" :precision="2" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="单位" width="90">
          <template #default="{ row }">
            <el-input v-model="row.unit" size="small" placeholder="片/粒/ml" />
          </template>
        </el-table-column>
        <el-table-column label="每日频次" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.timesPerDay" size="small" :min="0" :max="8" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="总药量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.totalQuantity" size="small" :min="0" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="疗程预估" width="140">
          <template #default="{ row }">
            <span v-if="itemDays(row)">{{ itemDays(row) }} 天 / 止 {{ itemEndDate(row) }}</span>
            <span v-else style="color: #c0c4cc;">—</span>
          </template>
        </el-table-column>
        <el-table-column label="用法" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.dosage" size="small" placeholder="如：餐后口服" />
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.instructions" size="small" placeholder="如：避免与阿司匹林合用" />
          </template>
        </el-table-column>
        <el-table-column label="" width="70" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="removeItem($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px; text-align: right;">
        <el-button @click="resetForm">清空</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">
          <el-icon><Check /></el-icon>保存并一键建提醒
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="font-weight: 600;">处方批次</div>
        <el-radio-group v-model="reviewStatusFilter" size="small">
          <el-radio-button label="pending_review">
            待审核
            <el-badge v-if="reviewStats.pending_review > 0" :value="reviewStats.pending_review" type="warning" style="margin-left: 4px;" />
          </el-radio-button>
          <el-radio-button label="approved">已通过</el-radio-button>
          <el-radio-button label="rejected">已驳回</el-radio-button>
          <el-radio-button label="">全部</el-radio-button>
        </el-radio-group>
        <div style="flex: 1;"></div>
        <el-button size="small" @click="loadHistory">刷新</el-button>
      </div>

      <el-empty v-if="!historyLoading && historyList.length === 0" description="没有符合条件的处方" />

      <el-table :data="historyList" v-loading="historyLoading" size="small">
        <el-table-column label="ID" width="60" prop="id" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.reviewStatus === 'pending_review' ? 'warning' : row.reviewStatus === 'approved' ? 'success' : 'danger'"
            >
              {{ row.reviewStatus === 'pending_review' ? '待审核' : row.reviewStatus === 'approved' ? '已通过' : '已驳回' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交方" width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :type="row.submittedByRole === 'attendant' ? 'warning' : 'info'">
              {{ row.submittedByRole === 'attendant' ? '陪诊员' : row.submittedByRole || '运营' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="客户" min-width="140">
          <template #default="{ row }">
            {{ row.user?.nickname || row.user?.phone || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="服务对象" min-width="110">
          <template #default="{ row }">
            {{ row.serviceTarget?.name || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="医院/医生/科室" min-width="200">
          <template #default="{ row }">
            <div>{{ row.hospital || '—' }}</div>
            <div style="font-size: 12px; color: #999;">{{ row.department || '' }} {{ row.doctorName || '' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="开方日" width="110">
          <template #default="{ row }">{{ (row.issuedDate || '').split('T')[0] || '—' }}</template>
        </el-table-column>
        <el-table-column label="药品数" width="80">
          <template #default="{ row }">{{ row.reminderCount ?? row.reminders?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="提交时间" min-width="160">
          <template #default="{ row }">{{ (row.createdAt || '').replace('T', ' ').slice(0, 16) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.reviewStatus === 'pending_review'"
              size="small"
              type="primary"
              link
              @click="openReview(row.id)"
            >审核</el-button>
            <el-button
              v-else
              size="small"
              type="primary"
              link
              @click="openReview(row.id)"
            >查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 审核抽屉 -->
    <el-drawer v-model="reviewDrawerOpen" title="处方审核" size="860px">
      <div v-loading="reviewLoading">
        <template v-if="reviewCurrent">
          <el-descriptions :column="2" border size="small" style="margin-bottom: 16px;">
            <el-descriptions-item label="ID">{{ reviewCurrent.id }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="reviewCurrent.reviewStatus === 'pending_review' ? 'warning' : reviewCurrent.reviewStatus === 'approved' ? 'success' : 'danger'" size="small">
                {{ reviewCurrent.reviewStatus === 'pending_review' ? '待审核' : reviewCurrent.reviewStatus === 'approved' ? '已通过' : '已驳回' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="客户">{{ reviewCurrent.user?.nickname || reviewCurrent.user?.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="服务对象">{{ reviewCurrent.serviceTarget?.name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="医院">{{ reviewCurrent.hospital || '—' }}</el-descriptions-item>
            <el-descriptions-item label="开方医生">{{ reviewCurrent.doctorName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="科室">{{ reviewCurrent.department || '—' }}</el-descriptions-item>
            <el-descriptions-item label="开方日">{{ (reviewCurrent.issuedDate || '').split('T')[0] || '—' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="reviewCurrent.sourceImage" style="margin-bottom: 16px;">
            <div style="font-weight: 600; margin-bottom: 8px;">处方原件</div>
            <el-image
              :src="reviewCurrent.sourceImage"
              :preview-src-list="[reviewCurrent.sourceImage]"
              style="max-width: 100%; max-height: 240px; border: 1px solid #dcdfe6; border-radius: 6px;"
              fit="contain"
              preview-teleported
            />
          </div>
          <div v-else style="margin-bottom: 16px; color: #909399; font-size: 13px;">
            ⚠ 未上传处方原件，审核前请与陪诊员确认
          </div>

          <div v-if="reviewCurrent.note" style="margin-bottom: 16px;">
            <div style="font-weight: 600; margin-bottom: 4px;">陪诊员备注</div>
            <div style="background: #f8f8f8; padding: 8px; border-radius: 4px;">{{ reviewCurrent.note }}</div>
          </div>

          <div v-if="reviewCurrent.reviewStatus === 'pending_review'">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="font-weight: 600;">药品清单（可修改后通过）</div>
              <el-date-picker
                v-model="reviewStartDate"
                type="date"
                size="small"
                value-format="YYYY-MM-DD"
                placeholder="服药起始日"
                style="width: 160px;"
              />
              <el-button size="small" @click="addReviewItem"><el-icon><Plus /></el-icon>新增一种药</el-button>
            </div>
            <el-table :data="reviewItems" size="small" border>
              <el-table-column label="#" type="index" width="40" />
              <el-table-column label="药品" min-width="160">
                <template #default="{ row }">
                  <el-input v-model="row.medicineName" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="严重度" width="120">
                <template #default="{ row }">
                  <el-select v-model="row.severity" size="small" style="width:100%;">
                    <el-option label="高风险" value="high" />
                    <el-option label="慢病" value="medium" />
                    <el-option label="保健" value="low" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="每次" width="90">
                <template #default="{ row }">
                  <el-input-number v-model="row.dosePerTime" size="small" :min="0" :step="0.5" :precision="2" style="width:100%;" />
                </template>
              </el-table-column>
              <el-table-column label="单位" width="70">
                <template #default="{ row }">
                  <el-input v-model="row.unit" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="每日" width="80">
                <template #default="{ row }">
                  <el-input-number v-model="row.timesPerDay" size="small" :min="0" :max="8" style="width:100%;" />
                </template>
              </el-table-column>
              <el-table-column label="总量" width="80">
                <template #default="{ row }">
                  <el-input-number v-model="row.totalQuantity" size="small" :min="0" style="width:100%;" />
                </template>
              </el-table-column>
              <el-table-column label="疗程" width="80">
                <template #default="{ row }">
                  <span v-if="reviewItemDays(row)">{{ reviewItemDays(row) }} 天</span>
                  <span v-else style="color:#c0c4cc;">—</span>
                </template>
              </el-table-column>
              <el-table-column label="用法" min-width="120">
                <template #default="{ row }">
                  <el-input v-model="row.dosage" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="" width="70">
                <template #default="{ $index }">
                  <el-button type="danger" link size="small" @click="removeReviewItem($index)">删</el-button>
                </template>
              </el-table-column>
            </el-table>

            <div style="margin-top: 16px;">
              <div style="font-weight: 600; margin-bottom: 4px;">审核备注（可选）</div>
              <el-input v-model="reviewNote" placeholder="通过时的备注，如 已复核处方原件 相关" />
            </div>
            <div style="margin-top: 16px;">
              <div style="font-weight: 600; margin-bottom: 4px;">驳回原因（驳回时必填）</div>
              <el-input v-model="rejectReason" type="textarea" :rows="2" placeholder="如：原件模糊需重拍 / 用法与医嘱不符" />
            </div>
          </div>
          <div v-else>
            <div style="font-weight: 600; margin-bottom: 4px;">审核记录</div>
            <div style="background: #f8f8f8; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
              审核人 ID：{{ reviewCurrent.reviewerId || '—' }} ·
              {{ (reviewCurrent.reviewedAt || '').replace('T', ' ').slice(0, 16) }}
            </div>
            <div v-if="reviewCurrent.reviewNote" style="background: #f8f8f8; padding: 8px; border-radius: 4px;">
              {{ reviewCurrent.reviewNote }}
            </div>
          </div>
        </template>
      </div>

      <template v-if="reviewCurrent?.reviewStatus === 'pending_review'" #footer>
        <el-button @click="reviewDrawerOpen = false">取消</el-button>
        <el-button type="danger" :loading="reviewSaving" @click="handleReject">驳回</el-button>
        <el-button type="primary" :loading="reviewSaving" @click="handleApprove">通过并建立提醒</el-button>
      </template>
    </el-drawer>
  </div>
</template>
