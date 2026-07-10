<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getReminderAudits,
  getExecutions,
  checkInMedication,
  getNotificationJobs,
  retryNotificationJob,
  dispatchFamilyDigestNow,
  getNotificationStats,
} from '@/api/medication-reminder'
import { getMedicationDosageDictionary } from '@/api/system'
import { get, post } from '@/api/request'
import { addDays, formatLocalDate } from '@/utils/date'

type Severity = 'high' | 'medium' | 'low'

interface Reminder {
  id: number; userId: number; serviceTargetId?: number; orderId?: number
  prescriptionId?: number
  medicineName: string; dosage: string; frequency: string
  severity: Severity
  reminderTimes: string[]; startDate: string; endDate: string
  instructions: string; status: string
  totalQuantity?: number; unit?: string; dosePerTime?: number; timesPerDay?: number
  user?: { id: number; nickname: string; phone: string }
  serviceTarget?: { id: number; name: string }
  order?: { id: number; orderNumber: string }
  createdAt: string
}

interface ExecutionLog {
  id: number; reminderId: number; scheduledDate: string; scheduledTime: string
  status: 'taken' | 'missed' | 'skipped' | 'pending'
  executedAt: string | null
  note: string | null
  reminder?: Reminder
  serviceTarget?: { id: number; name: string }
}

interface NotificationJob {
  id: number; reminderId: number; kind: string; channel: string; targetKind: string
  targetUserId: number | null; targetPhone: string | null; targetOpenid: string | null
  status: 'pending' | 'sending' | 'retrying' | 'success' | 'dead' | 'cancelled'
  attempts: number; maxAttempts: number
  scheduledAt: string; nextAttemptAt: string; sentAt: string | null
  lastError: string | null
  reminder?: Reminder
}

const activeTab = ref<'plan' | 'checkin' | 'jobs'>('plan')

// ═══════ Tab 1: 计划 ═══════
const loading = ref(false)
const list = ref<Reminder[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')
const filterSeverity = ref<'' | Severity>('')

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = ref({
  userId: undefined as number | undefined,
  serviceTargetId: undefined as number | undefined,
  orderId: undefined as number | undefined,
  medicineName: '',
  dosage: '',
  severity: 'medium' as Severity,
  dosePerTime: undefined as number | undefined,
  timesPerDay: undefined as number | undefined,
  totalQuantity: undefined as number | undefined,
  unit: '',
  frequency: 'daily',
  reminderTimes: ['08:00'],
  startDate: '',
  endDate: '',
  instructions: '',
  status: 'active',
})

const customerSearch = ref('')
const customerOptions = ref<any[]>([])
const serviceTargetOptions = ref<any[]>([])

const dosageOptions = ref<string[]>([])
const dosageFallback = ref('按医嘱')
async function loadDosageDictionary() {
  try {
    const res = await getMedicationDosageDictionary()
    dosageOptions.value = Array.isArray(res?.options) ? res.options : []
    dosageFallback.value = res?.fallback || '按医嘱'
  } catch {
    dosageOptions.value = []
  }
}
const isLegacyDosage = computed(() => {
  const d = (form.value.dosage || '').trim()
  if (!d) return false
  if (!dosageOptions.value.length) return false
  return !dosageOptions.value.includes(d)
})

// ─── 处方图 OCR ───────────────────────────────────────────
const ocrImage = ref('')
const ocrItems = ref<any[]>([])
const ocrLoading = ref(false)

async function ocrCustomUpload(options: any) {
  const file: File = options.file
  const formData = new FormData()
  formData.append('file', file)
  ocrLoading.value = true
  try {
    const uploadRes: any = await post('/documents/raw-upload', formData)
    const url = uploadRes?.url || uploadRes?.data?.url
    if (!url) throw new Error('上传失败，未返回文件地址')
    ocrImage.value = url
    const ocrRes: any = await post('/prescription-ocr/parse', { imageUrl: url })
    ocrItems.value = Array.isArray(ocrRes?.items) ? ocrRes.items : []
    if (ocrItems.value.length > 0) {
      applyOcrItem(ocrItems.value[0])
      ElMessage.success(
        ocrItems.value.length > 1
          ? `识别到 ${ocrItems.value.length} 种药品，已填入第一种，点击标签切换`
          : '已自动识别并填入药品信息',
      )
    } else {
      ElMessage.info('OCR 未识别到药品（功能未配置），图片已保存，请手动填写')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '上传或识别失败')
  } finally {
    ocrLoading.value = false
  }
}

function applyOcrItem(item: any) {
  if (!item) return
  if (item.medicineName) form.value.medicineName = item.medicineName
  if (item.severity) form.value.severity = item.severity as Severity
  if (item.defaultDosePerTime) form.value.dosePerTime = Number(item.defaultDosePerTime)
  if (item.defaultTimesPerDay) form.value.timesPerDay = Number(item.defaultTimesPerDay)
  if (item.defaultUnit) form.value.unit = item.defaultUnit
  if (item.instructions) form.value.instructions = item.instructions
  if (item.defaultTimesPerDay) applyDefaultTimes()
}

const SEVERITY_LABEL: Record<Severity, { label: string; type: 'danger' | 'warning' | 'info' }> = {
  high: { label: '高风险', type: 'danger' },
  medium: { label: '慢病', type: 'warning' },
  low: { label: '保健', type: 'info' },
}

function remainingDays(row: Reminder): number {
  if (!row.endDate) return 0
  const end = new Date(String(row.endDate).slice(0, 10))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((end.getTime() - today.getTime()) / (24 * 3600 * 1000))
  return Math.max(0, diff + 1)
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterStatus.value) params.status = filterStatus.value
    const res: any = await getReminders(params)
    let items: Reminder[] = res.items || []
    if (filterSeverity.value) {
      items = items.filter((x) => x.severity === filterSeverity.value)
    }
    list.value = items
    total.value = res.total || 0
  } catch { list.value = [] }
  finally { loading.value = false }
}

function handleReset() {
  filterStatus.value = ''
  filterSeverity.value = ''
  page.value = 1
  loadData()
}

async function searchCustomer(q: string) {
  if (!q || q.length < 1) return
  try {
    const res: any = await get('/users', { keyword: q, page: 1, pageSize: 20 })
    customerOptions.value = (res.items || res || []).map((u: any) => ({
      value: u.id, label: `${u.nickname || u.phone || '用户'} (${u.phone || u.id})`,
      ...u,
    }))
  } catch { customerOptions.value = [] }
}

async function onCustomerChange(userId: number) {
  form.value.serviceTargetId = undefined
  if (!userId) { serviceTargetOptions.value = []; return }
  try {
    const res: any = await get(`/users/${userId}/service-targets`)
    serviceTargetOptions.value = (res || []).map((t: any) => ({
      value: t.id, label: `${t.name}（${t.relation || '本人'}）`,
    }))
  } catch { serviceTargetOptions.value = [] }
}

function handleAdd() {
  editingId.value = null
  ocrImage.value = ''
  ocrItems.value = []
  const today = formatLocalDate(new Date()) || ''
  const nextWeek = formatLocalDate(addDays(new Date(), 7)) || ''
  form.value = {
    userId: undefined, serviceTargetId: undefined, orderId: undefined,
    medicineName: '', dosage: '', severity: 'medium',
    dosePerTime: undefined, timesPerDay: undefined,
    totalQuantity: undefined, unit: '',
    frequency: 'daily',
    reminderTimes: ['08:00'], startDate: today, endDate: nextWeek,
    instructions: '', status: 'active',
  }
  dialogVisible.value = true
}

function handleEdit(row: Reminder) {
  editingId.value = row.id
  ocrImage.value = ''
  ocrItems.value = []
  form.value = {
    userId: row.userId,
    serviceTargetId: row.serviceTargetId,
    orderId: row.orderId,
    medicineName: row.medicineName,
    dosage: row.dosage || '',
    severity: (row.severity as Severity) || 'medium',
    dosePerTime: row.dosePerTime ? Number(row.dosePerTime) : undefined,
    timesPerDay: row.timesPerDay ?? undefined,
    totalQuantity: row.totalQuantity ?? undefined,
    unit: row.unit || '',
    frequency: row.frequency || 'daily',
    reminderTimes: row.reminderTimes || ['08:00'],
    startDate: typeof row.startDate === 'string' ? row.startDate.split('T')[0] ?? '' : (row.startDate ?? ''),
    endDate: typeof row.endDate === 'string' ? row.endDate.split('T')[0] ?? '' : (row.endDate ?? ''),
    instructions: row.instructions || '',
    status: row.status || 'active',
  }
  if (row.user) {
    customerOptions.value = [{ value: row.user.id, label: `${row.user.nickname || row.user.phone || '用户'} (${row.user.phone || row.user.id})` }]
  }
  if (row.serviceTarget) {
    serviceTargetOptions.value = [{ value: row.serviceTarget.id, label: row.serviceTarget.name ?? '' }]
  }
  dialogVisible.value = true
}

/** 按每日频次自动生成餐后时段（仅本地计算，后端入库时同样会回退兜底） */
function applyDefaultTimes() {
  const n = Number(form.value.timesPerDay || 0)
  if (n <= 0) {
    ElMessage.warning('请先填写"每日频次"')
    return
  }
  const map: Record<number, string[]> = {
    1: ['08:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '17:00', '21:00'],
  }
  form.value.reminderTimes = map[n] ? [...map[n]] : ['08:00', '12:00', '18:00']
  ElMessage.success(`已按 ${n} 次/日生成默认时段`)
}

/** 前端预览"按疗程算结束日" */
function applyAutoEndDate() {
  const total = Number(form.value.totalQuantity || 0)
  const dose = Number(form.value.dosePerTime || 0)
  const freq = Number(form.value.timesPerDay || 0)
  if (!total || !dose || !freq || !form.value.startDate) {
    ElMessage.warning('请先填写总药量 / 每次用量 / 每日频次 / 开始日期')
    return
  }
  const days = Math.max(1, Math.ceil(total / (dose * freq)))
  const start = new Date(form.value.startDate)
  start.setDate(start.getDate() + days - 1)
  form.value.endDate = formatLocalDate(start) || form.value.endDate
  ElMessage.success(`疗程 ${days} 天，已自动填入结束日期`)
}

async function handleSave() {
  if (!form.value.userId) { ElMessage.warning('请选择客户'); return }
  if (!form.value.medicineName) { ElMessage.warning('请输入药品名称'); return }
  if (!form.value.reminderTimes.length) { ElMessage.warning('请设置提醒时间'); return }

  saving.value = true
  try {
    const data = { ...form.value } as any
    if (!data.totalQuantity) delete data.totalQuantity
    if (!data.dosePerTime) delete data.dosePerTime
    if (!data.timesPerDay) delete data.timesPerDay
    if (!data.unit) delete data.unit
    if (editingId.value) {
      await updateReminder(editingId.value, data)
    } else {
      delete data.status
      await createReminder(data)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally { saving.value = false }
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定删除此用药提醒？删除后会同步取消该药所有未发送的推送任务', '提示', { type: 'warning' })
    await deleteReminder(id)
    ElMessage.success('删除成功')
    await loadData()
  } catch {}
}

async function handleStatusToggle(row: Reminder) {
  const newStatus = row.status === 'active' ? 'paused' : 'active'
  await updateReminder(row.id, { status: newStatus })
  ElMessage.success(newStatus === 'active' ? '已启用' : '已暂停，推送队列已清空')
  await loadData()
}

function addReminderTime() { form.value.reminderTimes.push('12:00') }
function removeReminderTime(index: number) { form.value.reminderTimes.splice(index, 1) }

function statusLabel(s: string) {
  return { active: '进行中', paused: '已暂停', completed: '已完成', cancelled: '已取消' }[s] || s
}
function statusType(s: string): any {
  return { active: 'success', paused: 'warning', completed: 'info', cancelled: 'danger' }[s] || 'info'
}
function frequencyLabel(f: string) {
  return { once: '仅一次', daily: '每天', weekly: '每周', custom: '自定义' }[f] || f
}

// 审计抽屉
const auditDrawerOpen = ref(false)
const auditList = ref<any[]>([])
const auditLoading = ref(false)
const auditReminderId = ref<number | null>(null)
async function openAudit(row: Reminder) {
  auditDrawerOpen.value = true
  auditReminderId.value = row.id
  auditLoading.value = true
  try {
    const res: any = await getReminderAudits(row.id)
    auditList.value = Array.isArray(res) ? res : []
  } catch { auditList.value = [] }
  finally { auditLoading.value = false }
}
function auditActionLabel(action: string): string {
  return ({
    create: '创建', update: '修改', pause: '暂停', resume: '启用',
    complete: '完成', cancel: '取消', delete: '删除',
  } as Record<string, string>)[action] || action
}

// ═══════ Tab 2: 今日打卡看板 ═══════
const checkInLoading = ref(false)
const checkInDate = ref(formatLocalDate(new Date()) || '')
const checkInItems = ref<ExecutionLog[]>([])
const checkInFilterStatus = ref<string>('')

const checkInGrouped = computed(() => {
  const groups = new Map<string, { targetName: string; items: ExecutionLog[] }>()
  for (const item of checkInItems.value) {
    if (checkInFilterStatus.value && item.status !== checkInFilterStatus.value) continue
    const reminder = item.reminder
    const key = reminder
      ? `${reminder.user?.nickname || reminder.user?.phone || '客户'}｜${reminder.serviceTarget?.name || '本人'}`
      : `提醒 #${item.reminderId}`
    const entry = groups.get(key) || { targetName: key, items: [] }
    entry.items.push(item)
    groups.set(key, entry)
  }
  return Array.from(groups.values()).sort((a, b) => a.targetName.localeCompare(b.targetName))
})

const checkInStats = computed(() => {
  const s = { taken: 0, missed: 0, pending: 0, skipped: 0 }
  for (const it of checkInItems.value) {
    ;(s as any)[it.status] = (s as any)[it.status] + 1
  }
  return s
})

async function loadCheckIn() {
  checkInLoading.value = true
  try {
    const res: any = await getExecutions({
      startDate: checkInDate.value,
      endDate: checkInDate.value,
    })
    checkInItems.value = res.items || []
  } catch {
    checkInItems.value = []
  } finally {
    checkInLoading.value = false
  }
}

async function manualCheckIn(item: ExecutionLog, status: 'taken' | 'skipped' | 'missed') {
  try {
    await checkInMedication({
      reminderId: item.reminderId,
      scheduledDate: String(item.scheduledDate).split('T')[0],
      scheduledTime: item.scheduledTime,
      status,
    })
    ElMessage.success('已代打卡')
    await loadCheckIn()
  } catch (e: any) {
    ElMessage.error(e?.message || '打卡失败')
  }
}

function logStatusLabel(s: string): string {
  return ({
    taken: '已服', missed: '漏服', skipped: '跳过', pending: '待打卡',
  } as Record<string, string>)[s] || s
}
function logStatusType(s: string): any {
  return ({
    taken: 'success', missed: 'danger', skipped: 'info', pending: 'warning',
  } as Record<string, any>)[s] || 'info'
}

// ═══════ Tab 3: 推送任务监控 ═══════
const jobLoading = ref(false)
const jobs = ref<NotificationJob[]>([])
const jobTotal = ref(0)
const jobPage = ref(1)
const jobPageSize = ref(30)
const jobFilterStatus = ref<string[]>(['dead', 'retrying', 'pending'])
const jobFilterKind = ref<string>('')
const statsWindowHours = ref<number>(24)

interface NotificationStats {
  windowHours: number
  generatedAt: string
  totals: {
    total: number; success: number; dead: number; retrying: number
    pending: number; sending: number; cancelled: number
  }
  byKind: Array<{
    kind: string; channel: string; total: number; success: number
    dead: number; retrying: number; pending: number; sending: number
    cancelled: number; deliveryRate: number
  }>
}
const notificationStats = ref<NotificationStats | null>(null)

async function loadStats() {
  try {
    const res: any = await getNotificationStats(statsWindowHours.value)
    notificationStats.value = res as NotificationStats
  } catch {
    notificationStats.value = null
  }
}

const overallDeliveryRate = computed(() => {
  const s = notificationStats.value
  if (!s) return 0
  const resolved = s.totals.success + s.totals.dead
  return resolved > 0 ? s.totals.success / resolved : 0
})

async function loadJobs() {
  jobLoading.value = true
  try {
    const res: any = await getNotificationJobs({
      status: jobFilterStatus.value.length > 0 ? jobFilterStatus.value.join(',') : undefined,
      kind: jobFilterKind.value || undefined,
      page: jobPage.value,
      pageSize: jobPageSize.value,
    })
    jobs.value = res.items || []
    jobTotal.value = res.total || 0
  } catch {
    jobs.value = []
  } finally {
    jobLoading.value = false
  }
}

async function handleRetryJob(row: NotificationJob) {
  try {
    await retryNotificationJob(row.id)
    ElMessage.success('已重新入队')
    await loadJobs()
  } catch (e: any) {
    ElMessage.error(e?.message || '重试失败')
  }
}

async function handleDispatchDigest() {
  try {
    await ElMessageBox.confirm('立即向所有家属推送一次"今日用药汇总"？（运维用）', '确认', { type: 'warning' })
    const res: any = await dispatchFamilyDigestNow()
    ElNotification.success({
      title: '已触发',
      message: `用户数 ${res?.users ?? 0}，入队任务 ${res?.enqueued ?? 0}`,
    })
    await loadJobs()
  } catch {}
}

const KIND_LABELS: Record<string, string> = {
  first_push: '到点首推',
  miss_1st: '追推',
  miss_2nd: '再次漏服',
  escalate_family: '升级家属',
  escalate_admin: '升级管理员',
  family_digest: '家属汇总',
  follow_up: '复诊提醒',
}
const CHANNEL_LABELS: Record<string, string> = {
  mini_program: '小程序',
  sms: '短信',
  voice_call: '电话',
  in_app: '站内',
}
const JOB_STATUS_LABELS: Record<string, string> = {
  pending: '待发',
  sending: '发送中',
  retrying: '重试中',
  success: '成功',
  dead: '已失败',
  cancelled: '已取消',
}
function jobStatusType(s: string): any {
  return ({
    pending: 'info', sending: 'warning', retrying: 'warning',
    success: 'success', dead: 'danger', cancelled: '',
  } as Record<string, any>)[s] || ''
}

// ═══════ Tab 切换时拉数据 + 轮询 ═══════
let checkInTimer: ReturnType<typeof setInterval> | null = null
let jobTimer: ReturnType<typeof setInterval> | null = null

watch(activeTab, (v) => {
  if (checkInTimer) { clearInterval(checkInTimer); checkInTimer = null }
  if (jobTimer) { clearInterval(jobTimer); jobTimer = null }
  if (v === 'checkin') {
    loadCheckIn()
    checkInTimer = setInterval(() => loadCheckIn(), 15 * 1000)
  } else if (v === 'jobs') {
    loadJobs()
    loadStats()
    jobTimer = setInterval(() => {
      loadJobs()
      loadStats()
    }, 20 * 1000)
  }
})

onMounted(() => {
  loadData()
  loadDosageDictionary()
})
onUnmounted(() => {
  if (checkInTimer) clearInterval(checkInTimer)
  if (jobTimer) clearInterval(jobTimer)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">用药提醒（严格模式）</h2>
        <p class="page-subtitle">三档严重度分级 + 到点未打卡自动升级 + 推送任务可重试可降级。</p>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新建提醒</el-button>
        <el-button @click="$router.push('/customer-center/prescriptions')">
          <el-icon><Document /></el-icon>处方批量录入
        </el-button>
      </div>
    </div>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
      title="药品是关乎生命的严肃场景，请按严重度正确分级；HIGH 级 15 分钟未打卡即升级家属、30 分钟标 missed、60 分钟升级管理员"
      description="分级阈值可在「系统配置 → 严格用药」里调整，任何字段修改都会留审计记录。"
    />

    <el-tabs v-model="activeTab">
      <!-- ═══ Tab 1: 提醒计划 ═══ -->
      <el-tab-pane label="提醒计划" name="plan">
        <el-card shadow="never" class="filter-bar">
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 140px;" @change="() => { page = 1; loadData() }">
              <el-option label="进行中" value="active" />
              <el-option label="已暂停" value="paused" />
              <el-option label="已完成" value="completed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-select v-model="filterSeverity" placeholder="严重度" clearable style="width: 140px;" @change="() => { page = 1; loadData() }">
              <el-option label="高风险" value="high" />
              <el-option label="慢病" value="medium" />
              <el-option label="保健" value="low" />
            </el-select>
            <el-button @click="handleReset">重置</el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="table-card">
          <el-table :data="list" v-loading="loading" highlight-current-row>
            <el-table-column type="index" label="#" width="50" />
            <el-table-column label="客户" min-width="140">
              <template #default="{ row }">
                <div>{{ row.user?.nickname || row.user?.phone || '—' }}</div>
                <div style="font-size: 12px; color: #999;">{{ row.serviceTarget?.name ? `服务对象: ${row.serviceTarget.name}` : '' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="药品" min-width="170">
              <template #default="{ row }">
                <div>{{ row.medicineName }}</div>
                <div style="font-size: 12px; color: #999;">
                  <el-tag :type="SEVERITY_LABEL[(row.severity || 'medium') as keyof typeof SEVERITY_LABEL].type" size="small" effect="plain">
                    {{ SEVERITY_LABEL[(row.severity || 'medium') as keyof typeof SEVERITY_LABEL].label }}
                  </el-tag>
                  <span v-if="row.dosage" style="margin-left: 6px;">{{ row.dosage }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="用量 / 疗程" width="150">
              <template #default="{ row }">
                <div v-if="row.dosePerTime && row.timesPerDay">
                  {{ row.dosePerTime }}{{ row.unit || '' }} × {{ row.timesPerDay }}次/日
                </div>
                <div v-if="row.totalQuantity" style="font-size: 12px; color: #999;">
                  总量 {{ row.totalQuantity }}{{ row.unit || '' }}
                </div>
                <div v-if="row.status === 'active'" style="font-size: 12px;">
                  剩余 <b>{{ remainingDays(row) }}</b> 天
                </div>
              </template>
            </el-table-column>
            <el-table-column label="提醒时间" min-width="140">
              <template #default="{ row }">
                <el-tag v-for="t in row.reminderTimes" :key="t" size="small" type="info" style="margin: 2px;">{{ t }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="日期范围" min-width="160">
              <template #default="{ row }">
                {{ (row.startDate || '').split('T')[0] }} ~ {{ (row.endDate || '').split('T')[0] }}
              </template>
            </el-table-column>
            <el-table-column label="来源" width="110">
              <template #default="{ row }">
                <el-tag v-if="row.prescriptionId" type="primary" size="small" effect="plain">
                  处方 #{{ row.prescriptionId }}
                </el-tag>
                <span v-else style="color: #999;">手工</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="230" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'active' || row.status === 'paused'" type="warning" link size="small" @click="handleStatusToggle(row)">
                  {{ row.status === 'active' ? '暂停' : '启用' }}
                </el-button>
                <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
                <el-button type="info" link size="small" @click="openAudit(row)">审计</el-button>
                <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 16px; text-align: right;">
            <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
              layout="total, prev, pager, next" @current-change="loadData" />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ═══ Tab 2: 今日打卡看板 ═══ -->
      <el-tab-pane label="今日打卡看板" name="checkin">
        <el-card shadow="never" class="filter-bar">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <el-date-picker
              v-model="checkInDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="日期"
              style="width: 160px;"
              @change="loadCheckIn"
            />
            <el-select v-model="checkInFilterStatus" placeholder="状态筛选" clearable style="width: 140px;">
              <el-option label="已服" value="taken" />
              <el-option label="漏服" value="missed" />
              <el-option label="跳过" value="skipped" />
              <el-option label="待打卡" value="pending" />
            </el-select>
            <el-button @click="loadCheckIn">刷新</el-button>
            <div style="flex: 1;"></div>
            <el-tag type="success" effect="plain" size="default">已服 {{ checkInStats.taken }}</el-tag>
            <el-tag type="danger" effect="plain" size="default">漏服 {{ checkInStats.missed }}</el-tag>
            <el-tag type="info" effect="plain" size="default">跳过 {{ checkInStats.skipped }}</el-tag>
            <el-tag type="warning" effect="plain" size="default">待打卡 {{ checkInStats.pending }}</el-tag>
          </div>
        </el-card>

        <el-empty v-if="!checkInLoading && checkInGrouped.length === 0" description="今天没有用药记录" />
        <div v-loading="checkInLoading">
          <el-card v-for="group in checkInGrouped" :key="group.targetName" shadow="never" style="margin-bottom: 12px;">
            <div style="font-weight: 600; margin-bottom: 8px;">{{ group.targetName }}</div>
            <el-table :data="group.items" size="small">
              <el-table-column label="时间" width="90" prop="scheduledTime" />
              <el-table-column label="药品" min-width="150">
                <template #default="{ row }">
                  <div>{{ row.reminder?.medicineName || '—' }}</div>
                  <div style="font-size: 12px; color: #999;">
                    {{ row.reminder?.dosage || '' }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="严重度" width="90">
                <template #default="{ row }">
                  <el-tag :type="SEVERITY_LABEL[(row.reminder?.severity as Severity) || 'medium'].type" size="small" effect="plain">
                    {{ SEVERITY_LABEL[(row.reminder?.severity as Severity) || 'medium'].label }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="logStatusType(row.status)" size="small">{{ logStatusLabel(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="实际打卡时间" width="170">
                <template #default="{ row }">
                  <span v-if="row.executedAt">{{ row.executedAt.replace('T', ' ').slice(0, 16) }}</span>
                  <span v-else style="color: #999;">—</span>
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ row.note || '' }}</template>
              </el-table-column>
              <el-table-column label="代打卡" width="210" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="success" link @click="manualCheckIn(row, 'taken')">已服</el-button>
                  <el-button size="small" type="info" link @click="manualCheckIn(row, 'skipped')">跳过</el-button>
                  <el-button size="small" type="danger" link @click="manualCheckIn(row, 'missed')">漏服</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ═══ Tab 3: 推送任务监控 ═══ -->
      <el-tab-pane label="推送任务监控" name="jobs">
        <!-- 送达率看板 -->
        <el-card shadow="never" style="margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <span style="font-weight: 600;">送达率看板</span>
            <el-select v-model="statsWindowHours" size="small" style="width: 110px;" @change="loadStats">
              <el-option :label="'近 1 小时'" :value="1" />
              <el-option :label="'近 6 小时'" :value="6" />
              <el-option :label="'近 24 小时'" :value="24" />
              <el-option :label="'近 7 天'" :value="168" />
            </el-select>
            <span v-if="notificationStats" style="font-size: 12px; color: #999;">
              统计时间 {{ (notificationStats.generatedAt || '').replace('T', ' ').slice(0, 16) }}
            </span>
          </div>
          <div v-if="notificationStats" style="display: flex; gap: 16px; flex-wrap: wrap;">
            <div class="stat-pill">
              <div class="stat-pill__label">总任务</div>
              <div class="stat-pill__value">{{ notificationStats.totals.total }}</div>
            </div>
            <div class="stat-pill stat-pill--success">
              <div class="stat-pill__label">成功</div>
              <div class="stat-pill__value">{{ notificationStats.totals.success }}</div>
            </div>
            <div class="stat-pill stat-pill--danger">
              <div class="stat-pill__label">彻底失败</div>
              <div class="stat-pill__value">{{ notificationStats.totals.dead }}</div>
            </div>
            <div class="stat-pill stat-pill--warning">
              <div class="stat-pill__label">重试中</div>
              <div class="stat-pill__value">{{ notificationStats.totals.retrying }}</div>
            </div>
            <div class="stat-pill">
              <div class="stat-pill__label">待发</div>
              <div class="stat-pill__value">{{ notificationStats.totals.pending }}</div>
            </div>
            <div
              class="stat-pill"
              :class="{
                'stat-pill--success': overallDeliveryRate >= 0.95,
                'stat-pill--warning': overallDeliveryRate >= 0.8 && overallDeliveryRate < 0.95,
                'stat-pill--danger': overallDeliveryRate < 0.8,
              }"
            >
              <div class="stat-pill__label">总体送达率</div>
              <div class="stat-pill__value">{{ (overallDeliveryRate * 100).toFixed(1) }}%</div>
            </div>
          </div>

          <el-table
            v-if="notificationStats && notificationStats.byKind.length > 0"
            :data="notificationStats.byKind"
            size="small"
            style="margin-top: 10px;"
          >
            <el-table-column label="类型 / 渠道" min-width="180">
              <template #default="{ row }">
                {{ KIND_LABELS[row.kind] || row.kind }} / {{ CHANNEL_LABELS[row.channel] || row.channel }}
              </template>
            </el-table-column>
            <el-table-column label="总任务" width="90" prop="total" />
            <el-table-column label="成功" width="80" prop="success" />
            <el-table-column label="失败" width="80" prop="dead" />
            <el-table-column label="重试" width="80" prop="retrying" />
            <el-table-column label="待发" width="80" prop="pending" />
            <el-table-column label="送达率" width="140">
              <template #default="{ row }">
                <el-progress
                  :percentage="Math.round(row.deliveryRate * 100)"
                  :stroke-width="10"
                  :status="row.deliveryRate >= 0.95 ? 'success' : row.deliveryRate >= 0.8 ? 'warning' : 'exception'"
                />
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else-if="notificationStats" description="时间窗口内无任务" :image-size="60" />
        </el-card>

        <el-card shadow="never" class="filter-bar">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <el-select v-model="jobFilterStatus" multiple collapse-tags placeholder="状态" clearable style="width: 260px;">
              <el-option label="待发" value="pending" />
              <el-option label="发送中" value="sending" />
              <el-option label="重试中" value="retrying" />
              <el-option label="成功" value="success" />
              <el-option label="失败" value="dead" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-select v-model="jobFilterKind" placeholder="类型" clearable style="width: 160px;">
              <el-option v-for="(label, key) in KIND_LABELS" :key="key" :label="label" :value="key" />
            </el-select>
            <el-button @click="() => { loadJobs(); loadStats() }">刷新</el-button>
            <div style="flex: 1;"></div>
            <el-button type="primary" @click="handleDispatchDigest">
              <el-icon><Bell /></el-icon>立即推今日汇总
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="table-card">
          <el-table :data="jobs" v-loading="jobLoading" size="small">
            <el-table-column label="任务" min-width="180">
              <template #default="{ row }">
                <div>{{ KIND_LABELS[row.kind] || row.kind }} / {{ CHANNEL_LABELS[row.channel] || row.channel }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ row.reminder?.medicineName || '—' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="服药人" min-width="120">
              <template #default="{ row }">
                {{ row.reminder?.serviceTarget?.name || row.reminder?.user?.nickname || '—' }}
              </template>
            </el-table-column>
            <el-table-column label="目标" min-width="150">
              <template #default="{ row }">
                <div v-if="row.targetPhone">手机 {{ row.targetPhone }}</div>
                <div v-else-if="row.targetOpenid" style="font-size: 12px;">微信 openid</div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="jobStatusType(row.status)" size="small">
                  {{ JOB_STATUS_LABELS[row.status] || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="尝试次数" width="90">
              <template #default="{ row }">{{ row.attempts }}/{{ row.maxAttempts }}</template>
            </el-table-column>
            <el-table-column label="计划/下次" width="160">
              <template #default="{ row }">
                <div style="font-size: 12px;">计划 {{ (row.scheduledAt || '').replace('T', ' ').slice(0, 16) }}</div>
                <div style="font-size: 12px; color: #999;">下次 {{ (row.nextAttemptAt || '').replace('T', ' ').slice(0, 16) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="最后错误" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.lastError" style="color: #e6a23c;">{{ row.lastError }}</span>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="['dead', 'retrying', 'cancelled'].includes(row.status)"
                  size="small"
                  type="primary"
                  link
                  @click="handleRetryJob(row)"
                >重试</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 16px; text-align: right;">
            <el-pagination
              v-model:current-page="jobPage"
              v-model:page-size="jobPageSize"
              :total="jobTotal"
              layout="total, prev, pager, next"
              @current-change="loadJobs"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑用药提醒' : '新建用药提醒'" width="720px">
      <el-form :model="form" label-width="110px">
        <!-- 处方图 OCR 识别（可选快捷填入） -->
        <el-form-item label="处方图识别">
          <div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <el-upload
                :http-request="ocrCustomUpload"
                :show-file-list="false"
                accept="image/*"
                :disabled="ocrLoading"
              >
                <el-button :loading="ocrLoading" size="small">
                  <el-icon><Camera /></el-icon>
                  {{ ocrLoading ? '识别中…' : (ocrImage ? '重新上传处方' : '上传处方图识别') }}
                </el-button>
              </el-upload>
              <el-image
                v-if="ocrImage"
                :src="ocrImage"
                style="width: 56px; height: 56px; border-radius: 4px; border: 1px solid #ddd; flex-shrink: 0;"
                fit="cover"
                :preview-src-list="[ocrImage]"
              />
            </div>
            <div
              v-if="ocrItems.length > 1"
              style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;"
            >
              <el-tag
                v-for="(item, idx) in ocrItems"
                :key="idx"
                :effect="form.medicineName === item.medicineName ? 'dark' : 'plain'"
                type="primary"
                style="cursor: pointer;"
                @click="applyOcrItem(item)"
              >
                {{ item.medicineName }}
              </el-tag>
              <span style="font-size: 12px; color: #909399;">点击切换要填入的药品</span>
            </div>
            <div style="margin-top: 6px; font-size: 12px; color: #c0c4cc;">
              上传处方照片后自动识别药品名、剂量等信息（OCR 未配置时仍可手动填写）
            </div>
          </div>
        </el-form-item>

        <el-form-item label="客户" required>
          <el-select v-model="form.userId" filterable remote :remote-method="searchCustomer"
            placeholder="输入客户姓名/手机号搜索" style="width: 100%;" @change="onCustomerChange">
            <el-option v-for="c in customerOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务对象">
          <el-select v-model="form.serviceTargetId" placeholder="选择服务对象（可选）" clearable style="width: 100%;">
            <el-option v-for="t in serviceTargetOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="药品名称" required><el-input v-model="form.medicineName" placeholder="如：波立维（氯吡格雷）" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="严重度" required>
              <el-radio-group v-model="form.severity">
                <el-radio-button label="high">高风险</el-radio-button>
                <el-radio-button label="medium">慢病</el-radio-button>
                <el-radio-button label="low">保健</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="每次用量">
              <el-input-number v-model="form.dosePerTime" :min="0" :step="0.5" :precision="2" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="每日频次">
              <el-input-number v-model="form.timesPerDay" :min="0" :max="8" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单位">
              <el-input v-model="form.unit" placeholder="片/粒/瓶/支/ml" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="总药量">
              <el-input-number v-model="form.totalQuantity" :min="0" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="剂量（文案）">
              <el-select
                v-model="form.dosage"
                :placeholder="dosageOptions.length ? '选择剂量文案（展示用）' : '字典未配置'"
                :disabled="!dosageOptions.length"
                clearable
                style="width:100%;"
              >
                <el-option v-for="opt in dosageOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
              <el-alert
                v-if="isLegacyDosage"
                type="warning"
                :closable="false"
                show-icon
                style="margin-top:6px;"
                :title="`当前剂量「${form.dosage}」不在字典`"
                :description="`微信推送将走兜底文案「${dosageFallback}」`"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="提醒时间" required>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
            <div v-for="(_, index) in form.reminderTimes" :key="index" style="display: flex; align-items: center; gap: 4px;">
              <el-time-select v-model="form.reminderTimes[index]" start="06:00" end="22:00" step="00:30" placeholder="时间" style="width: 120px;" />
              <el-button v-if="form.reminderTimes.length > 1" type="danger" link @click="removeReminderTime(index)"><el-icon><Delete /></el-icon></el-button>
            </div>
            <el-button type="primary" link @click="addReminderTime"><el-icon><Plus /></el-icon>添加时间</el-button>
            <el-button type="info" link @click="applyDefaultTimes">按频次自动生成</el-button>
          </div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="10">
            <el-form-item label="开始日期" required>
              <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="结束日期" required>
              <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="" style="margin-top: 4px;">
              <el-button type="info" link @click="applyAutoEndDate">按疗程算</el-button>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="用药说明">
          <el-input v-model="form.instructions" type="textarea" :rows="2" placeholder="详细说明 / 饮食禁忌（≤ 20 字最佳）" />
        </el-form-item>
        <el-form-item v-if="editingId" label="状态">
          <el-select v-model="form.status" style="width: 100%;">
            <el-option label="进行中" value="active" />
            <el-option label="已暂停" value="paused" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 审计抽屉 -->
    <el-drawer v-model="auditDrawerOpen" title="用药提醒审计" size="560px">
      <el-empty v-if="!auditLoading && auditList.length === 0" description="暂无审计记录" />
      <el-timeline v-loading="auditLoading">
        <el-timeline-item
          v-for="a in auditList"
          :key="a.id"
          :timestamp="(a.createdAt || '').replace('T', ' ').slice(0, 19)"
          placement="top"
        >
          <div>
            <el-tag size="small">{{ auditActionLabel(a.action) }}</el-tag>
            <span style="margin-left: 8px;">
              {{ a.actorType === 'admin' ? (a.actorName || '运营') : a.actorType === 'user' ? (a.actorName || '用户') : '系统' }}
            </span>
          </div>
          <div v-if="a.note" style="margin-top: 4px; color: #666;">{{ a.note }}</div>
          <div
            v-if="a.diffJson && Object.keys(a.diffJson).length > 0"
            style="margin-top: 6px; background: #f8f8f8; padding: 8px; border-radius: 4px; font-size: 12px; line-height: 1.6;"
          >
            <div v-for="(v, k) in a.diffJson" :key="String(k)">
              <b>{{ k }}</b>：
              <span style="color: #f56c6c;">{{ JSON.stringify(v.from) }}</span>
              →
              <span style="color: #67c23a;">{{ JSON.stringify(v.to) }}</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>

<style scoped>
.filter-bar {
  margin-bottom: 12px;
}
.table-card {
  margin-bottom: 16px;
}

.stat-pill {
  min-width: 120px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #f5f6fa;
  border: 1px solid #e4e7ed;

  &--success {
    background: rgba(103, 194, 58, 0.12);
    border-color: rgba(103, 194, 58, 0.3);
  }
  &--warning {
    background: rgba(230, 162, 60, 0.12);
    border-color: rgba(230, 162, 60, 0.3);
  }
  &--danger {
    background: rgba(245, 108, 108, 0.12);
    border-color: rgba(245, 108, 108, 0.3);
  }
}
.stat-pill__label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-pill__value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
</style>
