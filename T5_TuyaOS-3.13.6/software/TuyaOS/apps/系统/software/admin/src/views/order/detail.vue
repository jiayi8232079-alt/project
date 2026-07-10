<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrderDetail, getOrderTimeline, getOrderTimelineShareToken, getOrderAttendantLiveLocation, getOrderWxaMonitorQrcode, getOrderWxaSignQrcode, updateTimelineVisibility, dispatchOrder, adminConfirmAcceptOrder, updateOrderStatus, getOrderReviews, updateOrder, createTimelineEntry, updateTimelineEntry, cancelOrder, getTimelineAttachmentBlob, updateTimelineTranscription, updateTimelineEventTime, submitOrderCompletion } from '@/api/order'
import { listHospitals } from '@/api/hospital'
import { post, put } from '@/api/request'
import { getAttendantList } from '@/api/attendant'
import { getRemindersByOrder, createReminder, updateReminder, deleteReminder } from '@/api/medication-reminder'
import { orderStatusMap, formatDate, formatMoney } from '@/utils/format'
import { getConfig } from '@/api/system'
import { addDays, formatLocalDate } from '@/utils/date'
import { API_BASE_URL } from '@/config/api-base'
import { fetchServiceConfirmHtml } from '@/api/document'
const COMPLETION_EDITABLE_DAYS = 2

const MINI_PROGRAM_APPID = (import.meta.env.VITE_MINI_PROGRAM_APPID as string | undefined)?.trim() || ''

const route = useRoute()
const router = useRouter()
const orderId = computed(() => route.params.id as string)
const activeTab = ref('info')
const toolsCollapse = ref<string[]>(['confirm', 'miniprogram'])
const loading = ref(false)
const order = ref<any>(null)

function serviceScheduleLabel(o: { serviceTime?: string | null; serviceEndTime?: string | null }) {
  if (!o?.serviceTime) return '—'
  const start = formatDate(o.serviceTime)
  if (!o?.serviceEndTime) return start
  return `${start} ～ ${formatDate(o.serviceEndTime)}`
}

const liveAttendantLoc = ref<{
  active: boolean
  latitude: number | null
  longitude: number | null
  updatedAt: string | null
} | null>(null)
let attendantLivePollTimer: ReturnType<typeof setInterval> | null = null
const monitorShareToken = ref('')
const refreshingMonitorToken = ref(false)
const wxaOfficialQrDataUrl = ref('')
const wxaOfficialQrLoading = ref(false)

const monitorMiniPathWithQuery = computed(() => {
  const t = monitorShareToken.value
  if (!t || !orderId.value) return ''
  return `pages/order/share-timeline/share-timeline?orderId=${orderId.value}&token=${encodeURIComponent(t)}`
})

const weixinMiniScheme = computed(() => {
  if (!MINI_PROGRAM_APPID || !monitorShareToken.value || !orderId.value) return ''
  const path = 'pages/order/share-timeline/share-timeline'
  const query = `orderId=${orderId.value}&token=${encodeURIComponent(monitorShareToken.value)}`
  return `weixin://dl/business/?appid=${MINI_PROGRAM_APPID}&path=${encodeURIComponent(path)}&query=${encodeURIComponent(query)}&env_version=release`
})
interface AdditionalServiceItem { id: string; selection: string; customName: string; amount: number; note?: string }
interface AttendantIncomeItemDraft { id: string; selection: string; customName: string; amount: number; note?: string }
interface CheckupOptionalItem { id: string; name: string; price: number }
interface AdditionalServiceOption { label: string; fee: number; status?: boolean }
interface AdditionalServiceOptionGroup { label: string; options: { label: string; value: string; fee: number }[] }
interface CompletionMedicationDraft { id: string; name: string; usage: string; reminderTime: string; startDate: string; endDate: string }
interface CompletionImageDraft { url: string }
interface CompletionFileDraft { url: string; name: string }
const ADDITIONAL_CUSTOM_VALUE = '__custom__'
const ATTENDANT_INCOME_CUSTOM_VALUE = '__attendant_income_custom__'
const ORDER_RISK_OPTIONS = [
  { label: 'L1低风险', value: 'L1' },
  { label: 'L2中风险', value: 'L2' },
] as const

const timelines = ref<any[]>([])
const timelineLoading = ref(false)
const timelinePreviewVisible = ref(false)
const timelinePreviewLoading = ref(false)
const timelinePreviewTitle = ref('')
const timelinePreviewMode = ref<'pdf' | 'docx' | 'fallback'>('pdf')
const timelinePreviewBlobUrl = ref('')
const timelinePreviewHint = ref('')
const timelinePreviewContainerRef = ref<HTMLDivElement | null>(null)
const editingTimelineTranscriptionId = ref<number | null>(null)
const timelineTranscriptionDraft = ref('')
const savingTimelineTranscription = ref(false)
// 业务时间修正：总管理员对内容型节点重置"发生时间"
const editingTimelineEventTimeId = ref<number | null>(null)
const timelineEventTimeDraft = ref<Date | string | null>(null)
const savingTimelineEventTime = ref(false)
const CONTENT_TIMELINE_TYPES = ['text', 'image', 'file', 'audio_question', 'audio_advice']
function isContentTimelineItem(item: any): boolean {
  return CONTENT_TIMELINE_TYPES.includes(String(item?.type || ''))
}

// 编辑内容型时间线条目（文本 + 图片/录音/文档增删 + 新上传）
type TimelineAttachmentItem = { url: string; name: string }
const editingTimelineEntryId = ref<number | null>(null)
const editingEntryDraft = ref<{
  content: string
  keepImages: string[]
  keepAudioFiles: TimelineAttachmentItem[]
  keepFiles: TimelineAttachmentItem[]
  newFiles: File[]
}>({
  content: '',
  keepImages: [],
  keepAudioFiles: [],
  keepFiles: [],
  newFiles: [],
})
const savingTimelineEntry = ref(false)
const timelineEntryFileInputRef = ref<HTMLInputElement | null>(null)
let docxPreviewModulePromise: Promise<typeof import('docx-preview')> | null = null

// ── 时间线发布面板 ──
const tlPublishForm = ref({
  type: 'text',
  content: '',
  files: [] as File[],
  visibleToUser: true,
  /** 可选：本条记录实际发生时间（补录）；不选则仅按发布时间排序 */
  eventTime: null as Date | string | null,
})
const tlPublishing = ref(false)
const tlFileInputRef = ref<HTMLInputElement | null>(null)

const TIMELINE_TYPES = [
  { value: 'text', label: '📝 文字记录' },
  { value: 'image', label: '📷 图片记录' },
  { value: 'audio_question', label: '🎙️ 问诊录音' },
  { value: 'audio_advice', label: '🎙️ 医嘱录音' },
  { value: 'file', label: '📄 上传文件' },
]

function onTlFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  tlPublishForm.value.files = Array.from(input.files || [])
}

function removeTlFile(idx: number) {
  tlPublishForm.value.files.splice(idx, 1)
}

async function publishTimeline() {
  const { type, content, files, visibleToUser, eventTime } = tlPublishForm.value
  if (!content && !files.length) {
    ElMessage.warning('请填写内容或上传附件')
    return
  }
  let eventTimeIso: string | undefined
  if (eventTime) {
    const d = eventTime instanceof Date ? eventTime : new Date(eventTime)
    if (!isNaN(d.getTime())) eventTimeIso = d.toISOString()
  }
  tlPublishing.value = true
  try {
    await createTimelineEntry({
      orderId: Number(orderId.value),
      type,
      content: content || undefined,
      files,
      visibleToUser,
      eventTime: eventTimeIso,
    })
    ElMessage.success(visibleToUser ? '发布成功，已同步到客户可见时间线' : '发布成功，仅内部可见')
    tlPublishForm.value = { type: 'text', content: '', files: [], visibleToUser: true, eventTime: null }
    if (tlFileInputRef.value) tlFileInputRef.value.value = ''
    await loadTimeline()
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally {
    tlPublishing.value = false
  }
}

/** 陪诊员费用选项（从服务定价管理动态加载，fallback 为内置默认值） */
const FALLBACK_FEE_OPTIONS = [
  { label: '青田半日', fee: 120 },
  { label: '青田全日', fee: 200 },
  { label: '温州丽水（全日）', fee: 240 },
  { label: '杭州上海（全日）', fee: 300 },
  { label: '北京（全日）', fee: 350 },
  { label: '自定义金额', fee: 0 },
]
const ATTENDANT_FEE_OPTIONS = ref<AdditionalServiceOption[]>([...FALLBACK_FEE_OPTIONS])
const VALUE_ADDED_SERVICE_OPTIONS = ref<AdditionalServiceOption[]>([
  { label: '夜间陪同 +200/晚', fee: 200, status: true },
  { label: '住宿陪同 +100/晚', fee: 100, status: true },
  { label: '次日续陪 +300/日', fee: 300, status: true },
  { label: '次日续陪·北京 +400/日', fee: 400, status: true },
])
const CUSTOMER_ADDITIONAL_FEE_OPTIONS = ref<AdditionalServiceOption[]>([])

function normalizeServiceOptions(raw: unknown): AdditionalServiceOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: any) => ({
      label: String(item?.label ?? item?.name ?? '').trim(),
      fee: Number(item?.fee ?? item?.price ?? 0),
      status: item?.status,
    }))
    .filter(item => item.label)
}

function looksLikeLegacyAttendantFeeOptions(items: AdditionalServiceOption[]) {
  return items.some(item =>
    item.label.includes('本地陪诊')
    || item.label.includes('跨城陪诊')
    || item.label.includes('增值'),
  )
}

async function loadAttendantFeeOptions() {
  try {
    const val = await getConfig('attendant_fee_pricing')
    if (val) {
      const items = normalizeServiceOptions(JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)))
      const active = items.filter(i => i.status !== false)
      if (active.length && !looksLikeLegacyAttendantFeeOptions(active)) {
        ATTENDANT_FEE_OPTIONS.value = [...active, { label: '自定义金额', fee: 0 }]
        return
      }
    }
  } catch {}
  ATTENDANT_FEE_OPTIONS.value = [...FALLBACK_FEE_OPTIONS]
}

async function loadValueAddedServiceOptions() {
  try {
    const val = await getConfig('value_added_service_pricing')
    if (val !== undefined && val !== null) {
      const items = normalizeServiceOptions(JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)))
      VALUE_ADDED_SERVICE_OPTIONS.value = items.filter(i => i.status !== false)
      return
    }
  } catch {}
}

async function loadCustomerAdditionalFeeOptions() {
  try {
    const val = await getConfig('customer_additional_fee_pricing')
    if (val !== undefined && val !== null) {
      const items = normalizeServiceOptions(JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)))
      CUSTOMER_ADDITIONAL_FEE_OPTIONS.value = items.filter(i => i.status !== false)
      return
    }
  } catch {}
}

function onFeeTypeChange(form: 'dispatch' | 'grab' | 'edit', val: string) {
  const opt = ATTENDANT_FEE_OPTIONS.value.find(o => o.label === val)
  if (opt) {
    if (form === 'dispatch') dispatchForm.value.attendantFee = opt.fee
    else if (form === 'grab') grabPoolForm.value.attendantFee = opt.fee
    else editForm.value.attendantFee = opt.fee
  }
}

function getDefaultAttendantFeeOption() {
  return ATTENDANT_FEE_OPTIONS.value.find(option => option.label !== '自定义金额')
    || FALLBACK_FEE_OPTIONS.find(option => option.label !== '自定义金额')
    || { label: '青田半日', fee: 120 }
}

function resolveFeeSelection(type?: string, fee?: number) {
  if (type === '自定义金额') {
    return { attendantFeeType: '自定义金额', attendantFee: typeof fee === 'number' ? fee : 0 }
  }
  const matched = ATTENDANT_FEE_OPTIONS.value.find(option => option.label === type)
  if (matched) {
    return { attendantFeeType: matched.label, attendantFee: matched.fee }
  }
  if (typeof fee === 'number' && fee >= 0) {
    return { attendantFeeType: '自定义金额', attendantFee: fee }
  }
  const fallback = getDefaultAttendantFeeOption()
  return { attendantFeeType: fallback.label, attendantFee: fallback.fee }
}

function resolveOrderAttendantBaseFee(type?: string, fee?: number, extraIncomeItems?: { amount?: number }[]) {
  const resolved = resolveFeeSelection(type, fee)
  if (resolved.attendantFeeType !== '自定义金额') return resolved
  const extraTotal = (Array.isArray(extraIncomeItems) ? extraIncomeItems : []).reduce(
    (sum, item) => sum + Number(item?.amount || 0),
    0,
  )
  return {
    attendantFeeType: resolved.attendantFeeType,
    attendantFee: Number(Math.max(Number(fee || 0) - extraTotal, 0).toFixed(2)),
  }
}

function normalizeRiskLevel(value?: string | null) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'L1' || normalized === 'L2' ? normalized : ''
}

function getRiskLevelLabel(value?: string | null) {
  const normalized = normalizeRiskLevel(value)
  return normalized ? `${normalized}${normalized === 'L1' ? '低风险' : '中风险'}` : ''
}

function getRiskLevelTagType(value?: string | null) {
  const normalized = normalizeRiskLevel(value)
  return normalized === 'L2' ? 'warning' : 'success'
}

const dispatchDialogVisible = ref(false)
const dispatchForm = ref({
  attendantId: undefined as number | undefined,
  attendantFee: 120 as number,
  attendantFeeType: '青田半日' as string,
})
const attendantOptions = ref<any[]>([])
const dispatchLoading = ref(false)

const grabPoolDialogVisible = ref(false)
const grabPoolForm = ref({
  attendantFee: 120 as number,
  attendantFeeType: '青田半日' as string,
})

const cancelDialogVisible = ref(false)
const cancelReason = ref('')

const reviews = ref<any[]>([])

const completionEditDialogVisible = ref(false)
const completionSaving = ref(false)
const completionImageUploading = ref(false)
const completionFileUploading = ref(false)
const completionImageInputRef = ref<HTMLInputElement | null>(null)
const completionFileInputRef = ref<HTMLInputElement | null>(null)
const completionForm = ref({
  diagnosisResult: '',
  doctorAdvice: '',
  summary: '',
  followUpDate: '',
  followUpNote: '',
  followUpHospital: '',
  followUpDepartment: '',
  medicationMode: '' as '' | 'none' | 'has',
  medications: [] as CompletionMedicationDraft[],
  images: [] as CompletionImageDraft[],
  files: [] as CompletionFileDraft[],
})

const orderReminders = ref<any[]>([])
const followUpReminders = ref<any[]>([])
const reminderDialogVisible = ref(false)
const reminderSaving = ref(false)
const editingReminderId = ref<number | null>(null)
const reminderForm = ref({
  medicineName: '', dosage: '', frequency: 'daily',
  reminderTimes: ['08:00'], startDate: '', endDate: '', instructions: '', channel: 'all', status: 'active',
})
const followUpDialogVisible = ref(false)
const followUpSaving = ref(false)
const editingFollowUpReminderId = ref<number | null>(null)
const followUpForm = ref({
  title: '复诊提醒',
  followUpDate: '',
  reminderTime: '09:00',
  hospital: '',
  department: '',
  instructions: '',
  channel: 'all',
  status: 'active',
})

const CHANNEL_LABEL: Record<string, string> = {
  mini_program: '小程序',
  all: '全部渠道',
}

const REMINDER_STATUS_META: Record<string, { label: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
  active: { label: '进行中', type: 'success' },
  paused: { label: '已暂停', type: 'warning' },
  completed: { label: '已完成', type: 'info' },
  cancelled: { label: '已取消', type: 'danger' },
}

function reminderStatusLabel(status: string) {
  return REMINDER_STATUS_META[status]?.label || status || '—'
}

function reminderStatusType(status: string) {
  return REMINDER_STATUS_META[status]?.type || 'info'
}

function reminderKindLabel(kind: 'medication' | 'follow_up') {
  return kind === 'follow_up' ? '复诊提醒' : '用药提醒'
}

function reminderKindTagType(kind: 'medication' | 'follow_up') {
  return kind === 'follow_up' ? 'success' : 'warning'
}

function formatReminderDateRange(item: any) {
  const start = String(item.startDate || '').split('T')[0]
  const end = String(item.endDate || '').split('T')[0]
  if (!start && !end) return '—'
  if (start && end && start !== end) return `${start} ~ ${end}`
  return start || end || '—'
}

function formatReminderTimes(item: any) {
  return Array.isArray(item.reminderTimes) && item.reminderTimes.length
    ? item.reminderTimes.join('、')
    : '—'
}

function reminderSourceLabel(item: any) {
  return item.orderId ? '订单同步' : '后台录入'
}

const activeOrderReminders = computed(() => orderReminders.value.filter(item => item.status === 'active'))
const activeFollowUpReminders = computed(() => followUpReminders.value.filter(item => item.status === 'active'))

const orderCustomerServiceTimelineItems = computed(() => {
  const medicationItems = orderReminders.value.map((item: any) => {
    const firstTime = Array.isArray(item.reminderTimes) && item.reminderTimes.length ? item.reminderTimes[0] : ''
    return {
      ...item,
      timelineKey: `medication-${item.id}`,
      reminderKind: 'medication' as const,
      title: item.medicineName || '用药提醒',
      summary: item.dosage || item.instructions || '按提醒时间跟进用药情况',
      whenText: `${String(item.startDate || '').split('T')[0] || '—'}${firstTime ? ` ${firstTime}` : ''}`,
      sortValue: new Date(`${String(item.startDate || '').split('T')[0] || ''} ${firstTime || '00:00'}`).getTime() || new Date(item.createdAt || 0).getTime(),
    }
  })

  const followUpItems = followUpReminders.value.map((item: any) => {
    const firstTime = Array.isArray(item.reminderTimes) && item.reminderTimes.length ? item.reminderTimes[0] : ''
    const clinicSummary = [item.followUpHospital, item.followUpDepartment]
      .map((value: any) => String(value || '').trim())
      .filter(Boolean)
      .join(' · ')
    return {
      ...item,
      timelineKey: `followup-${item.id}`,
      reminderKind: 'follow_up' as const,
      title: item.medicineName || '复诊提醒',
      summary: clinicSummary || item.instructions || '关注复诊时间与后续安排',
      whenText: `${String(item.startDate || '').split('T')[0] || '—'}${firstTime ? ` ${firstTime}` : ''}`,
      sortValue: new Date(`${String(item.startDate || '').split('T')[0] || ''} ${firstTime || '00:00'}`).getTime() || new Date(item.createdAt || 0).getTime(),
    }
  })

  return [...medicationItems, ...followUpItems].sort((a, b) => {
    const diff = (b.sortValue || 0) - (a.sortValue || 0)
    if (diff !== 0) return diff
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })
})

async function loadReminders() {
  try { orderReminders.value = (await getRemindersByOrder(orderId.value, { type: 'medication' })) as any[] || [] } catch { orderReminders.value = [] }
}

async function loadFollowUpReminders() {
  try { followUpReminders.value = (await getRemindersByOrder(orderId.value, { type: 'follow_up' })) as any[] || [] } catch { followUpReminders.value = [] }
}

function openReminderDialog() {
  editingReminderId.value = null
  const today = formatLocalDate(new Date()) || ''
  const nextWeek = formatLocalDate(addDays(new Date(), 7)) || ''
  reminderForm.value = { medicineName: '', dosage: '', frequency: 'daily', reminderTimes: ['08:00'], startDate: today, endDate: nextWeek, instructions: '', channel: 'all', status: 'active' }
  reminderDialogVisible.value = true
}

function openFollowUpDialog() {
  editingFollowUpReminderId.value = null
  const nextWeek = formatLocalDate(addDays(new Date(), 7)) || ''
  followUpForm.value = {
    title: '复诊提醒',
    followUpDate: nextWeek,
    reminderTime: '09:00',
    hospital: '',
    department: '',
    instructions: '',
    channel: 'all',
    status: 'active',
  }
  followUpDialogVisible.value = true
}

async function saveReminder() {
  if (!reminderForm.value.medicineName) { ElMessage.warning('请输入药品名称'); return }
  reminderSaving.value = true
  try {
    const payload = {
      ...reminderForm.value,
      endDate: reminderForm.value.endDate || reminderForm.value.startDate,
      userId: order.value?.userId || order.value?.user?.id,
      serviceTargetId: order.value?.serviceTargetId || order.value?.serviceTarget?.id,
      orderId: Number(orderId.value),
    }
    if (editingReminderId.value) {
      await updateReminder(editingReminderId.value, payload)
    } else {
      const { status: _status, ...createPayload } = payload as any
      await createReminder(createPayload)
    }
    ElMessage.success(editingReminderId.value ? '用药提醒已更新' : '用药提醒已创建')
    reminderDialogVisible.value = false
    loadReminders()
    loadOrder()
  } catch { /* 错误由全局请求拦截器统一弹出 */ }
  finally { reminderSaving.value = false }
}

async function saveFollowUpReminder() {
  if (!followUpForm.value.title.trim()) { ElMessage.warning('请输入提醒标题'); return }
  if (!followUpForm.value.followUpDate) { ElMessage.warning('请选择复诊日期'); return }
  if (!followUpForm.value.hospital.trim()) { ElMessage.warning('请输入复诊医院'); return }
  if (!followUpForm.value.department.trim()) { ElMessage.warning('请输入复诊科室'); return }
  followUpSaving.value = true
  try {
    const payload = {
      medicineName: followUpForm.value.title.trim(),
      dosage: undefined,
      frequency: 'once',
      reminderTimes: [followUpForm.value.reminderTime || '09:00'],
      startDate: followUpForm.value.followUpDate,
      endDate: followUpForm.value.followUpDate,
      followUpHospital: followUpForm.value.hospital.trim(),
      followUpDepartment: followUpForm.value.department.trim(),
      instructions: followUpForm.value.instructions || undefined,
      channel: followUpForm.value.channel,
      status: followUpForm.value.status,
      reminderType: 'follow_up',
      userId: order.value?.userId || order.value?.user?.id,
      serviceTargetId: order.value?.serviceTargetId || order.value?.serviceTarget?.id,
      orderId: Number(orderId.value),
    }
    if (editingFollowUpReminderId.value) {
      await updateReminder(editingFollowUpReminderId.value, payload)
    } else {
      const { status: _status, ...createPayload } = payload as any
      await createReminder(createPayload)
    }
    ElMessage.success(editingFollowUpReminderId.value ? '复诊提醒已更新' : '复诊提醒已创建')
    followUpDialogVisible.value = false
    loadFollowUpReminders()
    loadOrder()
  } catch { /* 错误由全局请求拦截器统一弹出 */ }
  finally { followUpSaving.value = false }
}

function openEditReminder(row: any) {
  editingReminderId.value = row.id
  reminderForm.value = {
    medicineName: row.medicineName || '',
    dosage: row.dosage || '',
    frequency: row.frequency || 'daily',
    reminderTimes: Array.isArray(row.reminderTimes) && row.reminderTimes.length ? [...row.reminderTimes] : ['08:00'],
    startDate: typeof row.startDate === 'string' ? row.startDate.split('T')[0] || '' : '',
    endDate: typeof row.endDate === 'string' ? row.endDate.split('T')[0] || '' : '',
    instructions: row.instructions || '',
    channel: row.channel || 'all',
    status: row.status || 'active',
  }
  reminderDialogVisible.value = true
}

function openEditFollowUpReminder(row: any) {
  editingFollowUpReminderId.value = row.id
  followUpForm.value = {
    title: row.medicineName || '复诊提醒',
    followUpDate: typeof row.startDate === 'string' ? row.startDate.split('T')[0] || '' : '',
    reminderTime: Array.isArray(row.reminderTimes) && row.reminderTimes.length ? row.reminderTimes[0] : '09:00',
    hospital: row.followUpHospital || '',
    department: row.followUpDepartment || '',
    instructions: row.instructions || '',
    channel: row.channel || 'all',
    status: row.status || 'active',
  }
  followUpDialogVisible.value = true
}

async function handleDeleteReminder(id: number) {
  try {
    await ElMessageBox.confirm('确定删除此客户服务提醒？', '提示', { type: 'warning' })
    await deleteReminder(id)
    ElMessage.success('已删除')
    loadReminders()
    loadFollowUpReminders()
    loadOrder()
  } catch {}
}

function addTime() { reminderForm.value.reminderTimes.push('12:00') }
function removeTime(i: number) { reminderForm.value.reminderTimes.splice(i, 1) }


const timelineTypeIcons: Record<string, string> = {
  node: 'Location',
  image: 'Picture',
  text: 'ChatDotRound',
  service_start: 'VideoPlay',
  service_end: 'CircleCheck',
  status_change: 'Switch',
  system: 'Monitor',
}

function getTimelineAssetUrl(url?: string) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^\/https?:\/\//i.test(value)) return value.slice(1)
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`
  if (value.startsWith('uploads/')) return `${API_BASE_URL}/${value}`
  return value
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function looksLikeMojibake(value: string) {
  return (
    !containsCjk(value)
    && /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ�]/.test(value)
  )
}

function repairLatin1Utf8Mojibake(value: string) {
  try {
    let encoded = ''
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i)
      if (code > 0xff) return value
      encoded += `%${code.toString(16).padStart(2, '0')}`
    }
    return decodeURIComponent(encoded)
  } catch {
    return value
  }
}

function decodeTimelineFileName(name: string) {
  let decoded = name
  try {
    decoded = decodeURIComponent(name)
  } catch {
    decoded = name
  }
  if (!looksLikeMojibake(decoded)) return decoded
  const repaired = repairLatin1Utf8Mojibake(decoded)
  return containsCjk(repaired) ? repaired : decoded
}

function getTimelineImageUrls(item: any): string[] {
  const images = Array.isArray(item?.metadata?.images) ? item.metadata.images : []
  return images.map((url: string) => getTimelineAssetUrl(url)).filter(Boolean)
}

function getTimelineAudioUrls(item: any): string[] {
  const urls = new Set<string>()
  const metadata = item?.metadata || {}
  if (metadata.audioUrl) urls.add(String(metadata.audioUrl))
  if (Array.isArray(metadata.audioFiles)) {
    metadata.audioFiles.forEach((file: any) => {
      if (file?.url) urls.add(String(file.url))
    })
  }
  if ((item?.type === 'audio_question' || item?.type === 'audio_advice') && Array.isArray(metadata.files)) {
    metadata.files.forEach((file: any) => {
      if (typeof file === 'string') urls.add(file)
      else if (file?.url) urls.add(String(file.url))
    })
  }
  return Array.from(urls).map((url) => getTimelineAssetUrl(url)).filter(Boolean)
}

function getTimelineDocumentFiles(item: any): { url: string; name: string }[] {
  const metadata = item?.metadata || {}
  if (item?.type === 'audio_question' || item?.type === 'audio_advice') return []
  if (!Array.isArray(metadata.files)) return []
  return metadata.files.map((file: any) => {
    if (typeof file === 'string') {
      return {
        url: getTimelineAssetUrl(file),
        name: decodeTimelineFileName(file.split('/').pop() || '附件'),
      }
    }
    return {
      url: getTimelineAssetUrl(file?.url || ''),
      name: decodeTimelineFileName(file?.name || file?.url?.split('/').pop() || '附件'),
    }
  }).filter((file: { url: string; name: string }) => Boolean(file.url))
}

function isAudioTimelineItem(item: any) {
  return item?.type === 'audio_question' || item?.type === 'audio_advice'
}

function getTimelineTranscription(item: any) {
  const source =
    item?.metadata?.transcription && typeof item.metadata.transcription === 'object'
      ? item.metadata.transcription
      : {}
  const status = String(source.status || '').trim()
  const text = String(source.text || '').trim()
  const edited = source.edited === true
  const error = String(source.error || '').trim()

  if (status === 'processing') {
    return {
      text,
      error,
      edited,
      status,
      statusText: '转写中',
      tagType: 'primary',
      placeholder: '系统已提交腾讯云识别任务，通常 1-3 分钟内会返回结果。',
    }
  }

  if (status === 'failed') {
    return {
      text,
      error,
      edited,
      status,
      statusText: '转写失败',
      tagType: 'danger',
      placeholder: '自动转写失败，可直接手动补充或修改录音文字。',
    }
  }

  if (edited && text) {
    return {
      text,
      error,
      edited,
      status,
      statusText: '已修订',
      tagType: 'warning',
      placeholder: '暂无转写文字',
    }
  }

  if (status === 'success' && text) {
    return {
      text,
      error,
      edited,
      status,
      statusText: '已转写',
      tagType: 'success',
      placeholder: '暂无转写文字',
    }
  }

  return {
    text,
    error,
    edited,
    status,
    statusText: '待补充',
    tagType: 'info',
    placeholder: '当前还没有录音转写文字，可先手动补充，后续也可继续修改。',
  }
}

function getTimelineFileExtension(file: { url?: string; name?: string }) {
  const source = (file.name || file.url || '').split('?')[0] || ''
  const match = source.match(/\.([a-zA-Z0-9]+)$/)
  return match?.[1]?.toLowerCase() || ''
}

function revokeTimelinePreviewBlobUrl() {
  if (!timelinePreviewBlobUrl.value) return
  URL.revokeObjectURL(timelinePreviewBlobUrl.value)
  timelinePreviewBlobUrl.value = ''
}

function clearTimelinePreviewContainer() {
  if (timelinePreviewContainerRef.value) {
    timelinePreviewContainerRef.value.innerHTML = ''
  }
}

function resetTimelinePreviewState() {
  revokeTimelinePreviewBlobUrl()
  clearTimelinePreviewContainer()
  timelinePreviewLoading.value = false
  timelinePreviewTitle.value = ''
  timelinePreviewHint.value = ''
  timelinePreviewMode.value = 'pdf'
}

async function ensureDocxPreviewModule() {
  if (!docxPreviewModulePromise) {
    docxPreviewModulePromise = import('docx-preview')
  }
  return docxPreviewModulePromise
}

async function openTimelineDocument(file: { url: string; name: string }) {
  const ext = getTimelineFileExtension(file)
  timelinePreviewVisible.value = true
  timelinePreviewLoading.value = true
  timelinePreviewTitle.value = file.name || '附件预览'
  timelinePreviewHint.value = ''
  clearTimelinePreviewContainer()
  revokeTimelinePreviewBlobUrl()
  try {
    const blob = await getTimelineAttachmentBlob(file.url, file.name)
    timelinePreviewBlobUrl.value = URL.createObjectURL(blob)

    if (ext === 'pdf') {
      timelinePreviewMode.value = 'pdf'
      return
    }

    if (ext === 'docx') {
      timelinePreviewMode.value = 'docx'
      await nextTick()
      const container = timelinePreviewContainerRef.value
      if (!container) {
        throw new Error('预览容器初始化失败')
      }
      try {
        const { renderAsync } = await ensureDocxPreviewModule()
        container.innerHTML = ''
        await renderAsync(await blob.arrayBuffer(), container, undefined, {
          useBase64URL: true,
          breakPages: true,
        })
      } catch {
        timelinePreviewMode.value = 'fallback'
        timelinePreviewHint.value = '当前 Word 文档暂时无法直接渲染，已为你保留新窗口打开入口。'
      }
      return
    }

    timelinePreviewMode.value = 'fallback'
    timelinePreviewHint.value = ext === 'doc'
      ? '旧版 Word（.doc）浏览器兼容性有限，建议直接在新窗口打开。'
      : '当前文件格式暂不支持页面内嵌预览，可直接在新窗口打开。'
  } catch (err: any) {
    timelinePreviewVisible.value = false
    resetTimelinePreviewState()
    ElMessage.error(err?.message || '附件预览失败')
  } finally {
    timelinePreviewLoading.value = false
  }
}

function openTimelineDocumentInNewTab() {
  if (!timelinePreviewBlobUrl.value) return
  window.open(timelinePreviewBlobUrl.value, '_blank', 'noopener,noreferrer')
}

function handleTimelinePreviewClosed() {
  resetTimelinePreviewState()
}

function stopAttendantLivePoll() {
  if (attendantLivePollTimer) {
    clearInterval(attendantLivePollTimer)
    attendantLivePollTimer = null
  }
}

async function refreshAttendantLiveLocation() {
  if (!order.value) return
  const st = order.value.status
  if (st !== 'in_progress' && st !== 'emergency') return
  try {
    liveAttendantLoc.value = await getOrderAttendantLiveLocation(orderId.value)
  } catch {
    /* 保留上次结果 */
  }
}

function startAttendantLivePoll() {
  stopAttendantLivePoll()
  if (!order.value) return
  const st = order.value.status
  if (st !== 'in_progress' && st !== 'emergency') return
  void refreshAttendantLiveLocation()
  attendantLivePollTimer = setInterval(() => void refreshAttendantLiveLocation(), 12000)
}

async function loadMonitorShareToken(opts?: { silent?: boolean }) {
  monitorShareToken.value = ''
  refreshingMonitorToken.value = true
  try {
    const res: any = await getOrderTimelineShareToken(orderId.value)
    monitorShareToken.value = res?.token || ''
  } catch {
    monitorShareToken.value = ''
    if (!opts?.silent) {
      ElMessage.warning('生成小程序查看凭证失败，请稍后重试或点击重试')
    }
  } finally {
    refreshingMonitorToken.value = false
  }
}

async function copyMonitorLabel(label: string, text: string) {
  if (!text) {
    ElMessage.warning('暂无内容')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制${label}`)
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}

async function generateOfficialMiniQrcode() {
  wxaOfficialQrLoading.value = true
  try {
    const res: any = await getOrderWxaMonitorQrcode(orderId.value)
    const b64 = res?.imageBase64
    if (!b64) {
      ElMessage.error('未返回图片数据')
      return
    }
    wxaOfficialQrDataUrl.value = `data:image/png;base64,${b64}`
    ElMessage.success('已生成微信官方小程序码（再次生成会使上一张码失效）')
    void loadMonitorShareToken({ silent: true })
  } catch (e: any) {
    ElMessage.error(
      typeof e?.message === 'string'
        ? e.message
        : '生成失败：请检查后端 WECHAT_APPID/SECRET；未发正式版时可设 WECHAT_MP_QR_ENV_VERSION=trial',
    )
  } finally {
    wxaOfficialQrLoading.value = false
  }
}

const wxaSignQrLoading = ref(false)
const wxaSignQrDataUrl = ref('')

async function generateSignQrcode() {
  wxaSignQrLoading.value = true
  try {
    const res: any = await getOrderWxaSignQrcode(orderId.value)
    const b64 = res?.imageBase64
    if (!b64) {
      ElMessage.error('未返回图片数据')
      return
    }
    wxaSignQrDataUrl.value = `data:image/png;base64,${b64}`
    ElMessage.success('已生成签署专用二维码，客户扫码后可直接签署确认单')
  } catch (e: any) {
    ElMessage.error(
      typeof e?.message === 'string'
        ? e.message
        : '生成签署二维码失败',
    )
  } finally {
    wxaSignQrLoading.value = false
  }
}

async function loadOrder() {
  loading.value = true
  stopAttendantLivePoll()
  try {
    order.value = await getOrderDetail(orderId.value)
    liveAttendantLoc.value = null
    wxaOfficialQrDataUrl.value = ''
    void loadMonitorShareToken({ silent: true })
    if (order.value?.status === 'in_progress' || order.value?.status === 'emergency') {
      startAttendantLivePoll()
    }
    syncToolsCollapse()
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally {
    loading.value = false
  }
}

// 订单载入后根据订单状态智能决定工具区默认展开项
function syncToolsCollapse() {
  const o = order.value
  if (!o) return
  const opened: string[] = []
  if (
    o.status !== 'canceled'
    && o.serviceType === '陪诊服务'
    && !o.serviceConfirmSignedAt
  ) {
    opened.push('confirm')
  }
  opened.push('miniprogram')
  if (o.status === 'in_progress' || o.status === 'emergency') {
    opened.push('livelocation')
  }
  toolsCollapse.value = opened
}

function getCompletionFileName(file: any) {
  if (!file) return '附件'
  const pickLastSegment = (value: string) => {
    const clean = String(value || '').split('?')[0] || ''
    return clean.split('/').pop() || '附件'
  }
  const raw = typeof file === 'string'
    ? pickLastSegment(String(file))
    : pickLastSegment(String(file.name || file.url || file.path || ''))
  return decodeTimelineFileName(raw)
}

const completionSummary = computed(() => {
  const raw = order.value?.completionData || {}
  const images = (Array.isArray(raw.images) ? raw.images : [])
    .map((url: string) => getTimelineAssetUrl(String(url)))
    .filter(Boolean)
  const files = (Array.isArray(raw.files) ? raw.files : [])
    .map((file: any) => {
      const url = typeof file === 'string'
        ? getTimelineAssetUrl(file)
        : getTimelineAssetUrl(file?.url || file?.path || '')
      return {
        url,
        name: getCompletionFileName(file),
      }
    })
    .filter((file: { url: string; name: string }) => Boolean(file.url))
  const medications = (Array.isArray(raw.medications) ? raw.medications : [])
    .map((item: any) => ({
      name: String(item?.name || '').trim(),
      usage: String(item?.usage || '').trim(),
      reminderTime: String(item?.reminderTime || '').trim(),
      startDate: String(item?.startDate || '').trim(),
      endDate: String(item?.endDate || '').trim(),
    }))
    .filter((item: any) => item.name || item.usage || item.reminderTime || item.startDate || item.endDate)
  const medicationMode = raw.medicationMode === 'has' || raw.medicationMode === 'none'
    ? raw.medicationMode
    : (medications.length ? 'has' : '')
  const diagnosisResult = String(raw.diagnosisResult || '').trim()
  const doctorAdvice = String(raw.doctorAdvice || '').trim()
  const summary = String(raw.summary || raw.doctorAdvice || '').trim()
  const followUpDate = String(raw.followUpDate || '').trim()
  const followUpNote = String(raw.followUpNote || '').trim()
  const followUpHospital = String(raw.followUpHospital || '').trim()
  const followUpDepartment = String(raw.followUpDepartment || '').trim()
  return {
    diagnosisResult,
    doctorAdvice,
    summary,
    followUpDate,
    followUpNote,
    followUpHospital,
    followUpDepartment,
    medicationMode,
    medications,
    images,
    files,
    hasData: !!(diagnosisResult || doctorAdvice || summary || followUpDate || followUpNote || followUpHospital || followUpDepartment || medications.length || images.length || files.length),
  }
})

function createCompletionMedicationDraft(partial: Partial<CompletionMedicationDraft> = {}): CompletionMedicationDraft {
  const today = formatLocalDate(new Date()) || ''
  return {
    id: partial.id || `completion_med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: partial.name || '',
    usage: partial.usage || '',
    reminderTime: partial.reminderTime || '08:00',
    startDate: partial.startDate || today,
    endDate: partial.endDate || partial.startDate || today,
  }
}

function syncCompletionFormFromOrder() {
  const raw = order.value?.completionData || {}
  const summary = completionSummary.value
  const rawDoctorAdvice = String(raw.doctorAdvice || '').trim()
  completionForm.value = {
    diagnosisResult: String(raw.diagnosisResult || '').trim(),
    doctorAdvice: rawDoctorAdvice && rawDoctorAdvice !== summary.summary ? rawDoctorAdvice : '',
    summary: summary.summary,
    followUpDate: summary.followUpDate,
    followUpNote: summary.followUpNote,
    followUpHospital: summary.followUpHospital,
    followUpDepartment: summary.followUpDepartment,
    medicationMode: (summary.medicationMode || '') as '' | 'none' | 'has',
    medications: summary.medications.map((item: any) => createCompletionMedicationDraft(item)),
    images: summary.images.map((url: string) => ({ url })),
    files: summary.files.map((file: CompletionFileDraft) => ({ url: file.url, name: file.name })),
  }
  if (completionForm.value.medicationMode === 'has' && !completionForm.value.medications.length) {
    completionForm.value.medications = [createCompletionMedicationDraft()]
  }
}

const completionDraftState = computed(() => {
  const summaryReady = !!completionForm.value.summary.trim()
  const proofReady = completionForm.value.images.length > 0 || completionForm.value.files.length > 0
  const medications = completionForm.value.medications
    .map(item => ({
      name: item.name.trim(),
      usage: item.usage.trim(),
      reminderTime: item.reminderTime.trim(),
      startDate: item.startDate.trim(),
      endDate: item.endDate.trim(),
    }))
    .filter(item => item.name || item.usage || item.reminderTime || item.startDate || item.endDate)
  const medicationReady =
    completionForm.value.medicationMode === 'none'
    || (
      completionForm.value.medicationMode === 'has'
      && medications.length > 0
      && medications.every(item =>
        item.name && item.usage && item.reminderTime && item.startDate && item.endDate,
      )
    )
  const missingItems: string[] = []
  if (!summaryReady) missingItems.push('服务总结')
  if (!proofReady) missingItems.push('报告单据凭证')
  if (!medicationReady) missingItems.push('用药提醒确认')
  const hasAnyInput = !!(
    completionForm.value.diagnosisResult.trim()
    || completionForm.value.doctorAdvice.trim()
    || completionForm.value.summary.trim()
    || completionForm.value.followUpDate
    || completionForm.value.followUpNote.trim()
    || completionForm.value.followUpHospital.trim()
    || completionForm.value.followUpDepartment.trim()
    || completionForm.value.medicationMode === 'none'
    || medications.length
    || completionForm.value.images.length
    || completionForm.value.files.length
  )
  return {
    summaryReady,
    proofReady,
    medicationReady,
    missingItems,
    readyCount: [summaryReady, proofReady, medicationReady].filter(Boolean).length,
    ready: summaryReady && proofReady && medicationReady,
    hasAnyInput,
  }
})

function openCompletionEditDialog() {
  syncCompletionFormFromOrder()
  completionEditDialogVisible.value = true
}

function handleCompletionMedicationModeChange(value: string | number | boolean | undefined) {
  const normalizedValue =
    value === 'none' || value === 'has' || value === ''
      ? value
      : ''
  completionForm.value.medicationMode = normalizedValue
  if (normalizedValue === 'none') {
    completionForm.value.medications = []
  } else if (normalizedValue === 'has' && !completionForm.value.medications.length) {
    completionForm.value.medications = [createCompletionMedicationDraft()]
  }
}

function addCompletionMedication() {
  if (completionForm.value.medicationMode !== 'has') {
    completionForm.value.medicationMode = 'has'
  }
  completionForm.value.medications.push(createCompletionMedicationDraft())
}

function removeCompletionMedication(index: number) {
  completionForm.value.medications.splice(index, 1)
}

function removeCompletionImage(index: number) {
  completionForm.value.images.splice(index, 1)
}

function removeCompletionFile(index: number) {
  completionForm.value.files.splice(index, 1)
}

async function uploadRawCompletionFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res: any = await post('/documents/raw-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const url = String(res?.url || '').trim()
  if (!url) throw new Error('上传失败')
  return url
}

async function handleCompletionImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input?.files || []).filter(file => file.type.startsWith('image/'))
  if (!files.length) {
    if (input) input.value = ''
    return
  }
  completionImageUploading.value = true
  try {
    const uploaded = await Promise.all(files.map(async (file) => ({
      url: await uploadRawCompletionFile(file),
    })))
    completionForm.value.images.push(...uploaded)
    ElMessage.success(`已上传 ${uploaded.length} 张图片`)
  } catch (err: any) {
    ElMessage.error(err?.message || '图片上传失败')
  } finally {
    completionImageUploading.value = false
    if (input) input.value = ''
  }
}

async function handleCompletionFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input?.files || [])
  if (!files.length) {
    if (input) input.value = ''
    return
  }
  completionFileUploading.value = true
  try {
    const uploaded = await Promise.all(files.map(async (file) => {
      const url = await uploadRawCompletionFile(file)
      return {
        url,
        name: file.name || decodeTimelineFileName(url.split('/').pop() || '附件'),
      }
    }))
    completionForm.value.files.push(...uploaded)
    ElMessage.success(`已上传 ${uploaded.length} 个附件`)
  } catch (err: any) {
    ElMessage.error(err?.message || '附件上传失败')
  } finally {
    completionFileUploading.value = false
    if (input) input.value = ''
  }
}

function buildCompletionPayload() {
  return {
    diagnosisResult: completionForm.value.diagnosisResult.trim(),
    doctorAdvice: completionForm.value.doctorAdvice.trim(),
    summary: completionForm.value.summary.trim(),
    followUpDate: completionForm.value.followUpDate,
    followUpNote: completionForm.value.followUpNote.trim(),
    followUpHospital: completionForm.value.followUpHospital.trim(),
    followUpDepartment: completionForm.value.followUpDepartment.trim(),
    medicationMode: completionForm.value.medicationMode,
    medications: completionForm.value.medications
      .map(item => ({
        name: item.name.trim(),
        usage: item.usage.trim(),
        reminderTime: item.reminderTime.trim(),
        startDate: item.startDate.trim(),
        endDate: item.endDate.trim(),
      }))
      .filter(item => item.name || item.usage || item.reminderTime || item.startDate || item.endDate),
    images: completionForm.value.images.map(item => item.url),
    files: completionForm.value.files.map(item => ({
      url: item.url,
      name: item.name.trim() || decodeTimelineFileName(item.url.split('/').pop() || '附件'),
    })),
  }
}

async function handleCompletionSave() {
  const payload = buildCompletionPayload()
  if (!completionDraftState.value.hasAnyInput) {
    ElMessage.warning('请至少补充一项服务结束资料')
    return
  }
  if (payload.followUpDate && (!payload.followUpHospital || !payload.followUpDepartment)) {
    ElMessage.warning('有复诊安排时，请补充医院和科室')
    return
  }
  if (!completionDraftState.value.ready && completionDraftState.value.missingItems.length) {
    try {
      await ElMessageBox.confirm(
        `当前还缺：${completionDraftState.value.missingItems.join('、')}。确认先保存当前内容吗？`,
        '资料暂未补齐',
        {
          type: 'warning',
          confirmButtonText: '先保存',
          cancelButtonText: '继续完善',
        },
      )
    } catch {
      return
    }
  }
  completionSaving.value = true
  try {
    await submitOrderCompletion(orderId.value, payload)
    ElMessage.success(completionDraftState.value.ready ? '服务结束汇总已保存并补齐' : '服务结束汇总已保存')
    completionEditDialogVisible.value = false
    await Promise.all([loadOrder(), loadReminders(), loadFollowUpReminders()])
  } catch (err: any) {
    ElMessage.error(err?.message || '服务结束汇总保存失败')
  } finally {
    completionSaving.value = false
  }
}

function openCompletionAttachment(file: { url: string }) {
  if (!file?.url) return
  window.open(getTimelineAssetUrl(file.url), '_blank', 'noopener,noreferrer')
}

async function loadTimeline() {
  timelineLoading.value = true
  try {
    const res = await getOrderTimeline(orderId.value, { includeInternal: true })
    timelines.value = Array.isArray(res) ? res : []
  } catch {
    timelines.value = []
  } finally {
    timelineLoading.value = false
  }
}

async function handleToggleVisibility(item: any) {
  try {
    await updateTimelineVisibility(item.id, !item.visibleToUser)
    item.visibleToUser = !item.visibleToUser
    ElMessage.success('已更新可见性')
  } catch {
    // handled by interceptor
  }
}

function startEditingTimelineTranscription(item: any) {
  const transcription = getTimelineTranscription(item)
  editingTimelineTranscriptionId.value = Number(item.id)
  timelineTranscriptionDraft.value = transcription.text || ''
}

function cancelEditingTimelineTranscription() {
  editingTimelineTranscriptionId.value = null
  timelineTranscriptionDraft.value = ''
}

async function saveTimelineTranscription(item: any) {
  const id = Number(item?.id || 0)
  const text = timelineTranscriptionDraft.value.trim()
  if (!id) return
  if (!text) {
    ElMessage.warning('请先填写转写文字')
    return
  }

  savingTimelineTranscription.value = true
  try {
    await updateTimelineTranscription(id, text)
    await loadTimeline()
    ElMessage.success('录音转写文字已保存')
    cancelEditingTimelineTranscription()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    savingTimelineTranscription.value = false
  }
}

function startEditingTimelineEventTime(item: any) {
  if (!isContentTimelineItem(item)) return
  editingTimelineEventTimeId.value = Number(item.id)
  const current = item.eventTime || item.createdAt
  timelineEventTimeDraft.value = current ? new Date(current) : new Date()
}

function cancelEditingTimelineEventTime() {
  editingTimelineEventTimeId.value = null
  timelineEventTimeDraft.value = null
}

async function saveTimelineEventTime(item: any) {
  const id = Number(item?.id || 0)
  const picked = timelineEventTimeDraft.value
  if (!id) return
  if (!picked) {
    ElMessage.warning('请选择业务时间')
    return
  }
  const dateObj = picked instanceof Date ? picked : new Date(picked)
  if (isNaN(dateObj.getTime())) {
    ElMessage.warning('业务时间格式无效')
    return
  }

  savingTimelineEventTime.value = true
  try {
    await updateTimelineEventTime(id, dateObj.toISOString())
    await loadTimeline()
    ElMessage.success('业务时间已更新')
    cancelEditingTimelineEventTime()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    savingTimelineEventTime.value = false
  }
}

// ── 编辑时间线条目（文本 + 附件） ──

function startEditingTimelineEntry(item: any) {
  if (!isContentTimelineItem(item)) return
  // 避免和转写 / 业务时间编辑冲突，先取消
  cancelEditingTimelineTranscription()
  cancelEditingTimelineEventTime()

  const metadata = (item?.metadata || {}) as any
  const rawImages: string[] = Array.isArray(metadata.images)
    ? metadata.images.map((u: any) => String(u || '')).filter(Boolean)
    : []

  const audioList: TimelineAttachmentItem[] = []
  if (Array.isArray(metadata.audioFiles)) {
    for (const f of metadata.audioFiles) {
      if (f?.url) {
        audioList.push({
          url: String(f.url),
          name: String(f.name || String(f.url).split('/').pop() || 'audio'),
        })
      }
    }
  } else if (metadata.audioUrl) {
    const url = String(metadata.audioUrl)
    audioList.push({ url, name: url.split('/').pop() || 'audio' })
  }

  const docList: TimelineAttachmentItem[] = []
  if (item.type !== 'audio_question' && item.type !== 'audio_advice' && Array.isArray(metadata.files)) {
    for (const f of metadata.files) {
      if (typeof f === 'string') {
        docList.push({ url: f, name: f.split('/').pop() || '附件' })
      } else if (f?.url) {
        docList.push({ url: String(f.url), name: String(f.name || '附件') })
      }
    }
  }

  editingTimelineEntryId.value = Number(item.id)
  editingEntryDraft.value = {
    content: String(item.content || ''),
    keepImages: rawImages,
    keepAudioFiles: audioList,
    keepFiles: docList,
    newFiles: [],
  }
}

function cancelEditingTimelineEntry() {
  editingTimelineEntryId.value = null
  editingEntryDraft.value = {
    content: '',
    keepImages: [],
    keepAudioFiles: [],
    keepFiles: [],
    newFiles: [],
  }
}

function removeDraftImage(idx: number) {
  editingEntryDraft.value.keepImages.splice(idx, 1)
}
function removeDraftAudio(idx: number) {
  editingEntryDraft.value.keepAudioFiles.splice(idx, 1)
}
function removeDraftFile(idx: number) {
  editingEntryDraft.value.keepFiles.splice(idx, 1)
}
function removeDraftNewFile(idx: number) {
  editingEntryDraft.value.newFiles.splice(idx, 1)
}

function triggerTimelineEntryFilePicker() {
  timelineEntryFileInputRef.value?.click()
}

function onTimelineEntryFilesPicked(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target?.files?.length) return
  for (const f of Array.from(target.files)) {
    editingEntryDraft.value.newFiles.push(f)
  }
  target.value = ''
}

async function saveTimelineEntry(item: any) {
  const id = Number(item?.id || 0)
  if (!id || savingTimelineEntry.value) return
  savingTimelineEntry.value = true
  try {
    await updateTimelineEntry(id, {
      content: editingEntryDraft.value.content,
      keepImageUrls: editingEntryDraft.value.keepImages,
      keepAudioFiles: editingEntryDraft.value.keepAudioFiles,
      keepFiles: editingEntryDraft.value.keepFiles,
      newFiles: editingEntryDraft.value.newFiles,
    })
    ElMessage.success('已保存')
    cancelEditingTimelineEntry()
    await loadTimeline()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingTimelineEntry.value = false
  }
}

function getTimelineAssetUrlSafe(u: string) {
  return getTimelineAssetUrl(u)
}

// 判断是否为"订单已完成"的状态节点：
// order.service.ts 里的 appendStatusTimeline 会把 toStatus 写进 metadata，
// 所以只要 type === 'node' && metadata.toStatus === 'completed' 就是"服务结束"的那一条。
function isCompletionTimelineItem(item: any): boolean {
  if (!item || item.type !== 'node') return false
  const toStatus = String(item?.metadata?.toStatus || '').toLowerCase()
  return toStatus === 'completed'
}

// 跳转到"服务结束汇总" Tab（和页面内"查看汇总"按钮行为一致）。
function jumpToCompletionSummary() {
  activeTab.value = 'completion'
}

async function openDispatchDialog() {
  // 若订单已有费用设置（如从抢单池指派），则预填；旧费用类型兼容为自定义金额
  const resolvedFee = resolveFeeSelection(order.value?.attendantFeeType, order.value?.attendantFee)
  dispatchForm.value = {
    attendantId: undefined,
    attendantFee: resolvedFee.attendantFee,
    attendantFeeType: resolvedFee.attendantFeeType,
  }
  dispatchDialogVisible.value = true
  try {
    const res = await getAttendantList({ page: 1, pageSize: 100, status: 'active' })
    attendantOptions.value = res.items || []
  } catch {
    attendantOptions.value = []
  }
}

async function handleDispatch() {
  if (!dispatchForm.value.attendantId) {
    ElMessage.warning('请选择陪诊员')
    return
  }
  const fee = dispatchForm.value.attendantFee
  if (fee == null || fee < 0 || (dispatchForm.value.attendantFeeType === '自定义金额' && fee === 0)) {
    ElMessage.warning('请选择或输入陪诊员费用')
    return
  }
  dispatchLoading.value = true
  try {
    await dispatchOrder(orderId.value, {
      attendantId: dispatchForm.value.attendantId,
      attendantFee: dispatchForm.value.attendantFee,
      attendantFeeType: dispatchForm.value.attendantFeeType,
    })
    ElMessage.success('派单成功')
    dispatchDialogVisible.value = false
    loadOrder()
  } catch {
    // handled by interceptor
  } finally {
    dispatchLoading.value = false
  }
}

async function handleToGrabPool() {
  const defaultFee = getDefaultAttendantFeeOption()
  grabPoolForm.value = {
    attendantFee: defaultFee?.fee ?? 120,
    attendantFeeType: defaultFee?.label ?? '青田半日',
  }
  grabPoolDialogVisible.value = true
}

async function confirmToGrabPool() {
  const fee = grabPoolForm.value.attendantFee
  if (fee == null || fee < 0 || (grabPoolForm.value.attendantFeeType === '自定义金额' && fee === 0)) {
    ElMessage.warning('请选择或输入陪诊员费用')
    return
  }
  try {
    await dispatchOrder(orderId.value, {
      toGrabPool: true,
      attendantFee: grabPoolForm.value.attendantFee,
      attendantFeeType: grabPoolForm.value.attendantFeeType,
    })
    ElMessage.success('已放入抢单池')
    grabPoolDialogVisible.value = false
    loadOrder()
  } catch {
    // handled by interceptor
  }
}

async function handleCancelOrder() {
  cancelDialogVisible.value = true
}

async function confirmCancel() {
  if (!cancelReason.value.trim()) {
    ElMessage.warning('请填写取消原因')
    return
  }
  try {
    await cancelOrder(orderId.value, { cancelReason: cancelReason.value })
    ElMessage.success('订单已取消')
    cancelDialogVisible.value = false
    cancelReason.value = ''
    loadOrder()
  } catch {
    // handled by interceptor
  }
}

async function loadReviews() {
  try {
    const res = await getOrderReviews(orderId.value)
    reviews.value = Array.isArray(res) ? res : []
  } catch {
    reviews.value = []
  }
}

function handleDownloadDoc(doc: any) {
  const url = doc.url?.startsWith('http') ? doc.url : `${API_BASE_URL}${doc.url}`
  const a = document.createElement('a')
  a.href = url
  a.download = doc.fileName || doc.file_name || 'document'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const serviceConfirmLoading = ref(false)
const serviceConfirmPreviewVisible = ref(false)
const serviceConfirmPreviewSrc = ref('')
const serviceConfirmBlobUrl = ref<string | null>(null)
const serviceConfirmIframeRef = ref<HTMLIFrameElement | null>(null)

function revokeServiceConfirmBlob() {
  if (serviceConfirmBlobUrl.value) {
    URL.revokeObjectURL(serviceConfirmBlobUrl.value)
    serviceConfirmBlobUrl.value = null
  }
}

function onServiceConfirmPreviewClosed() {
  revokeServiceConfirmBlob()
  serviceConfirmPreviewSrc.value = ''
}

/**
 * 在线预览：仅请求鉴权接口实时渲染 HTML（不落库），Blob URL 嵌 iframe。
 */
async function openServiceConfirmPreview() {
  if (!orderId.value) return
  serviceConfirmLoading.value = true
  try {
    const html = await fetchServiceConfirmHtml(orderId.value)
    revokeServiceConfirmBlob()
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    serviceConfirmBlobUrl.value = blobUrl
    serviceConfirmPreviewSrc.value = blobUrl
    serviceConfirmPreviewVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '预览加载失败')
  } finally {
    serviceConfirmLoading.value = false
  }
}

function openServiceConfirmPreviewInNewWindow() {
  const src = serviceConfirmPreviewSrc.value
  if (!src) return
  window.open(src, '_blank', 'noopener')
}

function printServiceConfirmIframe() {
  const w = serviceConfirmIframeRef.value?.contentWindow
  if (w) {
    try {
      w.focus()
      w.print()
    } catch {
      ElMessage.info('若无法直接打印，请使用「新窗口打开」后在浏览器中打印')
    }
  } else {
    ElMessage.warning('请待页面加载完成后再试')
  }
}


const serviceEditDialogVisible = ref(false)
const feeEditDialogVisible = ref(false)
const hospitalBindOptions = ref<any[]>([])
const hospitalBindSearchLoading = ref(false)
const editForm = ref({
  baseFee: undefined as number | undefined,
  attendantFee: undefined as number | undefined,
  attendantFeeType: '' as string,
  attendantExtraIncomeItems: [] as AttendantIncomeItemDraft[],
  hospital: '',
  department: '',
  serviceType: '',
  riskLevel: '' as '' | 'L1' | 'L2',
  serviceTime: '',
  serviceEndTime: null as string | Date | null,
  notes: '',
  checkupPackageName: '',
  checkupGender: '' as '' | 'male' | 'female',
  checkupOptionalItems: [] as CheckupOptionalItem[],
  additionalServiceItems: [] as AdditionalServiceItem[],
  needAttendant: true,
  hospitalBookingStatus: '' as '' | 'booked' | 'pending_cs',
  hospitalDirectoryId: null as number | null,
  callbackContactPhone: '',
  settlementStatus: 'pending' as string,
  paymentStatus: 'unpaid' as string,
  paymentMethod: '' as string,
  settlementRemark: '' as string,
})
const serviceEditSaving = ref(false)
const feeEditSaving = ref(false)

const editCheckupOptionalTotal = computed(() => editForm.value.checkupOptionalItems.reduce(
  (sum, item) => sum + Number(item.price || 0),
  0,
))

const editAdditionalServiceTotal = computed(() => editForm.value.additionalServiceItems.reduce(
  (sum, item) => sum + Number(item.amount || 0),
  0,
))

const editAttendantExtraIncomeTotal = computed(() => editForm.value.attendantExtraIncomeItems.reduce(
  (sum, item) => sum + Number(item.amount || 0),
  0,
))

const editComputedTotalFee = computed(
  () => Number(editForm.value.baseFee || 0) + editCheckupOptionalTotal.value + editAdditionalServiceTotal.value,
)

const editComputedAttendantFee = computed(
  () => Number(editForm.value.attendantFee || 0) + editAttendantExtraIncomeTotal.value,
)

function createAdditionalServiceItem(): AdditionalServiceItem {
  return {
    id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    selection: '',
    customName: '',
    amount: 0,
    note: '',
  }
}

function addAdditionalServiceItem() {
  editForm.value.additionalServiceItems.push(createAdditionalServiceItem())
}

function removeAdditionalServiceItem(index: number) {
  editForm.value.additionalServiceItems.splice(index, 1)
}

function createAttendantExtraIncomeItem(): AttendantIncomeItemDraft {
  return {
    id: `attendant_income_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    selection: '',
    customName: '',
    amount: 0,
    note: '',
  }
}

function addAttendantExtraIncomeItem() {
  editForm.value.attendantExtraIncomeItems.push(createAttendantExtraIncomeItem())
}

function addCustomAttendantExtraIncomeItem() {
  editForm.value.attendantExtraIncomeItems.push({
    ...createAttendantExtraIncomeItem(),
    selection: ATTENDANT_INCOME_CUSTOM_VALUE,
  })
}

function removeAttendantExtraIncomeItem(index: number) {
  editForm.value.attendantExtraIncomeItems.splice(index, 1)
}

const additionalServiceSelectGroups = computed<AdditionalServiceOptionGroup[]>(() => {
  const groups: AdditionalServiceOptionGroup[] = []
  if (VALUE_ADDED_SERVICE_OPTIONS.value.length) {
    groups.push({
      label: '增值服务',
      options: VALUE_ADDED_SERVICE_OPTIONS.value.map(item => ({ label: item.label, value: item.label, fee: item.fee })),
    })
  }
  if (CUSTOMER_ADDITIONAL_FEE_OPTIONS.value.length) {
    groups.push({
      label: '附加服务',
      options: CUSTOMER_ADDITIONAL_FEE_OPTIONS.value.map(item => ({ label: item.label, value: item.label, fee: item.fee })),
    })
  }
  groups.push({
    label: '其他',
    options: [{ label: '其他附加费用', value: ADDITIONAL_CUSTOM_VALUE, fee: 0 }],
  })
  return groups
})

function getCustomerAdditionalFeeOption(label?: string) {
  return [...VALUE_ADDED_SERVICE_OPTIONS.value, ...CUSTOMER_ADDITIONAL_FEE_OPTIONS.value]
    .find(item => item.label === label)
}

const attendantIncomeSelectGroups = computed<AdditionalServiceOptionGroup[]>(() => {
  const presetOptions = ATTENDANT_FEE_OPTIONS.value
    .filter(item => item.label !== '自定义金额')
    .map(item => ({ label: item.label, value: item.label, fee: item.fee }))
  return [
    {
      label: '陪诊员收入项',
      options: presetOptions,
    },
    {
      label: '其他',
      options: [{ label: '其他收入', value: ATTENDANT_INCOME_CUSTOM_VALUE, fee: 0 }],
    },
  ]
})

function getAttendantIncomeOption(label?: string) {
  return ATTENDANT_FEE_OPTIONS.value
    .filter(item => item.label !== '自定义金额')
    .find(item => item.label === label)
}

function toAdditionalServiceDraft(item: any): AdditionalServiceItem {
  const option = getCustomerAdditionalFeeOption(item?.name)
  return {
    id: item?.id || createAdditionalServiceItem().id,
    selection: option?.label || ADDITIONAL_CUSTOM_VALUE,
    customName: option ? '' : (item?.name || ''),
    amount: Number(item?.amount || 0),
    note: item?.note || '',
  }
}

function toAttendantIncomeDraft(item: any): AttendantIncomeItemDraft {
  const option = getAttendantIncomeOption(item?.name)
  return {
    id: item?.id || createAttendantExtraIncomeItem().id,
    selection: option?.label || ATTENDANT_INCOME_CUSTOM_VALUE,
    customName: option ? '' : (item?.name || ''),
    amount: Number(item?.amount || 0),
    note: item?.note || '',
  }
}

function handleAdditionalServiceSelectionChange(item: AdditionalServiceItem, value: string) {
  if (value === ADDITIONAL_CUSTOM_VALUE) {
    item.customName = ''
    item.amount = 0
    return
  }
  const option = getCustomerAdditionalFeeOption(value)
  item.customName = ''
  item.amount = Number(option?.fee || 0)
}

function handleAttendantIncomeSelectionChange(item: AttendantIncomeItemDraft, value: string) {
  if (value === ATTENDANT_INCOME_CUSTOM_VALUE) {
    item.customName = ''
    item.amount = 0
    return
  }
  const option = getAttendantIncomeOption(value)
  item.customName = ''
  item.amount = Number(option?.fee || 0)
}

function formatDirectoryHospitalLine(h: { name: string; city?: string; district?: string | null }) {
  const city = h.city || ''
  const dist = h.district ? String(h.district) : ''
  return dist ? `${h.name}（${city}${dist}）` : `${h.name}（${city}）`
}

function syncEditFormFromOrder() {
  if (!order.value) return
  const resolvedFee = resolveOrderAttendantBaseFee(
    order.value.attendantFeeType,
    order.value.attendantFee,
    order.value.attendantExtraIncomeItems,
  )
  const hb = order.value.hospitalBookingStatus
  editForm.value = {
    baseFee: order.value.baseFee ?? undefined,
    attendantFee: resolvedFee.attendantFee,
    attendantFeeType: resolvedFee.attendantFeeType,
    attendantExtraIncomeItems: Array.isArray(order.value.attendantExtraIncomeItems)
      ? order.value.attendantExtraIncomeItems.map((item: any) => toAttendantIncomeDraft(item))
      : [],
    hospital: order.value.hospital || '',
    department: order.value.department || '',
    serviceType: order.value.serviceType || '',
    riskLevel: normalizeRiskLevel(order.value.riskLevel) as '' | 'L1' | 'L2',
    serviceTime: order.value.serviceTime || '',
    serviceEndTime: order.value.serviceEndTime || null,
    notes: order.value.notes || '',
    checkupPackageName: order.value.checkupPackageName || '',
    checkupGender: (order.value.checkupGender || '') as '' | 'male' | 'female',
    checkupOptionalItems: Array.isArray(order.value.checkupOptionalItems)
      ? order.value.checkupOptionalItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
      }))
      : [],
    additionalServiceItems: Array.isArray(order.value.additionalServiceItems)
      ? order.value.additionalServiceItems.map((item: any) => toAdditionalServiceDraft(item))
      : [],
    needAttendant: order.value.needAttendant !== false,
    hospitalBookingStatus: hb === 'booked' || hb === 'pending_cs' ? hb : '',
    hospitalDirectoryId:
      order.value.hospitalDirectoryId != null && Number.isFinite(Number(order.value.hospitalDirectoryId))
        ? Number(order.value.hospitalDirectoryId)
        : null,
    callbackContactPhone: order.value.callbackContactPhone || '',
    settlementStatus: order.value.settlementStatus || 'pending',
    paymentStatus: order.value.paymentStatus || 'unpaid',
    paymentMethod: order.value.paymentMethod || '',
    settlementRemark: order.value.settlementRemark || '',
  }
}

async function searchHospitalsForOrderBind(query: string) {
  const q = (query || '').trim()
  const curDir = order.value?.hospitalDirectory
  if (!q) {
    hospitalBindOptions.value = curDir?.id ? [curDir] : []
    return
  }
  hospitalBindSearchLoading.value = true
  try {
    const res: any = await listHospitals({ keyword: q, page: 1, pageSize: 40 })
    const items: any[] = res.items || []
    if (curDir?.id && !items.some(h => h.id === curDir.id)) {
      hospitalBindOptions.value = [curDir, ...items]
    } else {
      hospitalBindOptions.value = items
    }
  } catch {
    hospitalBindOptions.value = curDir?.id ? [curDir] : []
  } finally {
    hospitalBindSearchLoading.value = false
  }
}

function onEditHospitalDirectoryChange(id: number | null | undefined) {
  if (id == null || id === undefined) return
  const h = hospitalBindOptions.value.find(x => x.id === id)
  if (h?.name) {
    editForm.value.hospital = formatDirectoryHospitalLine(h)
  }
}

function openServiceEditDialog() {
  if (!order.value) return
  syncEditFormFromOrder()
  hospitalBindOptions.value = order.value.hospitalDirectory?.id ? [order.value.hospitalDirectory] : []
  serviceEditDialogVisible.value = true
}

function openFeeEditDialog() {
  if (!order.value) return
  syncEditFormFromOrder()
  feeEditDialogVisible.value = true
}

const settlementDialogVisible = ref(false)
const settlementRemark = ref('')

function openSettlementDialog() {
  settlementRemark.value = order.value?.settlementRemark || ''
  settlementDialogVisible.value = true
}

async function confirmSettlement() {
  if (!order.value) return
  try {
    await put(`/orders/admin/${order.value.id}`, {
      settlementStatus: 'settled',
      settledAt: new Date().toISOString(),
      settlementRemark: settlementRemark.value || null,
    })
    ElMessage.success('已标记为已结算')
    settlementDialogVisible.value = false
    loadOrder()
  } catch {
    // 错误由全局请求拦截器统一弹出
  }
}

async function revertSettlement() {
  if (!order.value) return
  try {
    await ElMessageBox.confirm('确定要撤回结算状态吗？', '撤回结算', { type: 'warning' })
    await put(`/orders/admin/${order.value.id}`, {
      settlementStatus: 'pending',
      settledAt: null,
    })
    ElMessage.success('已撤回结算')
    loadOrder()
  } catch {
    // cancelled
  }
}

function buildAdditionalServicePayload(items: AdditionalServiceItem[]) {
  return items
    .filter(item => (item.selection === ADDITIONAL_CUSTOM_VALUE ? item.customName.trim() : item.selection.trim()))
    .map(item => ({
      id: item.id,
      name: item.selection === ADDITIONAL_CUSTOM_VALUE ? item.customName.trim() : item.selection.trim(),
      amount: Number(item.amount || 0),
      note: item.note?.trim() || '',
    }))
}

function buildAttendantIncomePayload(items: AttendantIncomeItemDraft[]) {
  return items
    .filter(item => (item.selection === ATTENDANT_INCOME_CUSTOM_VALUE ? item.customName.trim() : item.selection.trim()))
    .map(item => ({
      id: item.id,
      name: item.selection === ATTENDANT_INCOME_CUSTOM_VALUE ? item.customName.trim() : item.selection.trim(),
      amount: Number(item.amount || 0),
      note: item.note?.trim() || '',
    }))
}

function getAttendantBaseIncomeAmount(orderLike: any) {
  const total = Number(orderLike?.attendantFee || 0)
  const extraTotal = Array.isArray(orderLike?.attendantExtraIncomeItems)
    ? orderLike.attendantExtraIncomeItems.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
    : 0
  return Number(Math.max(total - extraTotal, 0).toFixed(2))
}

async function handleServiceSave() {
  serviceEditSaving.value = true
  try {
    const payload: any = {}
    const f = editForm.value
    payload.hospital = f.hospital?.trim() || null
    payload.department = f.department?.trim() || null
    payload.serviceType = f.serviceType?.trim() || null
    payload.riskLevel = f.riskLevel || null
    payload.serviceTime = f.serviceTime || null
    payload.serviceEndTime = f.serviceEndTime ? f.serviceEndTime : null
    payload.notes = f.notes ?? ''
    if (f.serviceType === '体检预约') {
      payload.checkupPackageName = f.checkupPackageName?.trim() || null
      payload.checkupGender = f.checkupGender || null
      payload.checkupOptionalItems = f.checkupOptionalItems
    } else {
      payload.checkupPackageName = null
      payload.checkupGender = null
      payload.checkupOptionalItems = []
    }
    if (f.needAttendant !== undefined) payload.needAttendant = f.needAttendant
    payload.hospitalBookingStatus = f.hospitalBookingStatus || null
    payload.hospitalDirectoryId =
      f.hospitalDirectoryId != null && Number.isFinite(f.hospitalDirectoryId) ? f.hospitalDirectoryId : null
    payload.callbackContactPhone = f.callbackContactPhone?.trim() ? f.callbackContactPhone.trim() : null
    await updateOrder(orderId.value, payload)
    ElMessage.success('服务信息已更新')
    serviceEditDialogVisible.value = false
    loadOrder()
  } catch { ElMessage.error('更新失败') }
  finally { serviceEditSaving.value = false }
}

async function handleFeeSave() {
  feeEditSaving.value = true
  try {
    const payload: any = {}
    const f = editForm.value
    payload.baseFee = f.baseFee !== undefined && f.baseFee !== null ? Number(f.baseFee) : null
    payload.totalFee = editComputedTotalFee.value
    payload.attendantFee = editComputedAttendantFee.value
    payload.attendantFeeType = f.attendantFeeType || null
    payload.attendantExtraIncomeItems = buildAttendantIncomePayload(f.attendantExtraIncomeItems)
    payload.additionalServiceItems = buildAdditionalServicePayload(f.additionalServiceItems)
    payload.settlementStatus = f.settlementStatus || 'pending'
    payload.paymentStatus = f.paymentStatus || 'unpaid'
    payload.paymentMethod = f.paymentStatus === 'paid' ? (f.paymentMethod || null) : null
    payload.settlementRemark = f.settlementRemark || null
    if (f.settlementStatus === 'settled' && order.value?.settlementStatus !== 'settled') {
      payload.settledAt = new Date().toISOString()
    } else if (f.settlementStatus === 'pending') {
      payload.settledAt = null
    }
    await updateOrder(orderId.value, payload)
    ElMessage.success('费用与结算已保存')
    feeEditDialogVisible.value = false
    loadOrder()
  } catch { ElMessage.error('更新失败') }
  finally { feeEditSaving.value = false }
}

// 待派单或待抢单时，后台均可指派陪诊员（待抢单时直接指定，订单从抢单池转为指派）
const canDispatch = computed(() => {
  const s = order.value?.status
  return (s === 'pending_dispatch' || s === 'pending_grab') && order.value?.needAttendant !== false
})
// 仅待派单时可放入抢单池；待抢单时只显示指派
const canToGrabPool = computed(() => order.value?.status === 'pending_dispatch' && order.value?.needAttendant !== false)
// 订单已指派陪诊员并处于待接单时，后台可代为确认接单（pending_accept → pending_service）
const canAdminConfirmAccept = computed(() => {
  const current = order.value
  if (!current) return false
  return current.status === 'pending_accept' && !!(current.attendantId || current.attendant?.id)
})
// 待签署时，后台可代为标记签署完成并进入待服务
const canMarkSignComplete = computed(() => order.value?.status === 'pending_sign')
const canCancel = computed(() => {
  const s = order.value?.status
  return ['pending_dispatch', 'pending_accept', 'pending_grab', 'pending_sign', 'pending_service'].includes(s)
})

// 待服务 → 服务中
const canStartService = computed(() => order.value?.status === 'pending_service')
// 服务中 / 紧急 → 服务已结束
const canEndService = computed(() => ['in_progress', 'emergency'].includes(order.value?.status))
// 服务已结束 → 已完成
const canCompleteOrder = computed(() => order.value?.status === 'pending_review')

async function handleStartService() {
  try {
    await ElMessageBox.confirm(
      '确认将订单状态改为「服务中」？此操作将实时同步到客户端。',
      '开始服务',
      { type: 'warning', confirmButtonText: '确认开始', cancelButtonText: '取消' },
    )
    await updateOrderStatus(orderId.value, { status: 'in_progress' })
    ElMessage.success('已标记为服务中，客户侧实时同步')
    await loadOrder()
    loadTimeline()
  } catch (e: unknown) {
    if (e !== 'cancel') { /* 错误由全局请求拦截器统一弹出 */ }
  }
}

async function handleEndService() {
  try {
    await ElMessageBox.confirm(
      '确认将订单标记为「服务已结束」？此操作将通知客户服务结束，可继续补充服务汇总后完成。',
      '结束服务',
      { type: 'warning', confirmButtonText: '确认结束', cancelButtonText: '取消' },
    )
    await updateOrderStatus(orderId.value, { status: 'pending_review' })
    ElMessage.success('已标记为服务已结束')
    await loadOrder()
    loadTimeline()
  } catch (e: unknown) {
    if (e !== 'cancel') { /* 错误由全局请求拦截器统一弹出 */ }
  }
}

async function handleCompleteOrder() {
  try {
    await ElMessageBox.confirm(
      '确认将订单标记为「已完成」？此操作不可逆，建议先确认服务汇总已填写完整。',
      '完成订单',
      { type: 'success', confirmButtonText: '确认完成', cancelButtonText: '取消' },
    )
    await updateOrderStatus(orderId.value, { status: 'completed' })
    ElMessage.success('订单已完成')
    await loadOrder()
    loadTimeline()
  } catch (e: unknown) {
    if (e !== 'cancel') { /* 错误由全局请求拦截器统一弹出 */ }
  }
}

async function handleMarkSignComplete() {
  try {
    await updateOrderStatus(orderId.value, { status: 'pending_service' })
    ElMessage.success('已标记为已签到，订单进入待服务')
    loadOrder()
  } catch { /* 错误由全局请求拦截器统一弹出 */ }
}

async function handleAdminConfirmAccept() {
  const attName =
    order.value?.attendant?.realName ||
    order.value?.attendant?.user?.name ||
    order.value?.attendant?.user?.nickname ||
    '该陪诊员'
  try {
    await ElMessageBox.confirm(
      `确认由后台代「${attName}」确认接单？\n订单将直接从「待接单」进入「待服务」，陪诊员无需再自行操作。`,
      '代陪诊员确认接单',
      { type: 'warning', confirmButtonText: '确认许可接单', cancelButtonText: '再想想' },
    )
    await adminConfirmAcceptOrder(orderId.value)
    ElMessage.success('已代陪诊员确认接单，订单进入待服务')
    await loadOrder()
    loadTimeline()
  } catch (e: unknown) {
    if (e !== 'cancel') { /* 错误由全局请求拦截器统一弹出 */ }
  }
}

const canSetEmergencyFromAdmin = computed(() => order.value?.status === 'in_progress')
const canClearEmergencyFromAdmin = computed(() => order.value?.status === 'emergency')

async function handleAdminSetEmergency() {
  try {
    await ElMessageBox.confirm(
      '确认将订单标记为「紧急」？系统将记录状态变更，请及时与陪诊员或客户协调处置。',
      '标记紧急',
      { type: 'warning', confirmButtonText: '确认标记', cancelButtonText: '取消' },
    )
    await updateOrderStatus(orderId.value, { status: 'emergency' })
    ElMessage.success('已标记为紧急')
    await loadOrder()
    loadTimeline()
  } catch (e: unknown) {
    if (e !== 'cancel') { /* 错误由全局请求拦截器统一弹出 */ }
  }
}

async function handleAdminClearEmergency() {
  try {
    await ElMessageBox.confirm(
      '确认解除紧急状态，恢复为「服务进行中」？',
      '解除紧急',
      { type: 'warning', confirmButtonText: '确认解除', cancelButtonText: '取消' },
    )
    await updateOrderStatus(orderId.value, { status: 'in_progress' })
    ElMessage.success('已恢复为服务进行中')
    await loadOrder()
    loadTimeline()
  } catch (e: unknown) {
    if (e !== 'cancel') { /* 错误由全局请求拦截器统一弹出 */ }
  }
}

function openCustomerDetail() {
  const userId = order.value?.user?.id || order.value?.userId
  if (userId) router.push(`/customer-center/customers/detail/${userId}`)
}

function openAttendantDetail() {
  const attendantId = order.value?.attendant?.id || order.value?.attendantId
  if (attendantId) router.push(`/dispatch/attendants/detail/${attendantId}`)
}

const controlNotice = computed(() => {
  const current = order.value
  if (!current) return ''
  if (current.status === 'pending_dispatch') {
    return current.needAttendant === false
      ? '当前订单无需陪诊员，可先补充服务信息与费用设置。'
      : '当前处于待派单阶段，请先指派陪诊员或放入抢单池。'
  }
  if (current.status === 'pending_accept') return '已派单，等待陪诊员确认接单；如需直接推进，可由后台代为确认接单。'
  if (current.status === 'pending_grab') return '当前订单在抢单池中，等待陪诊员抢单或后台直接指定。'
  if (current.status === 'pending_sign') return '陪诊员已接单，下一步应完成现场签到。'
  if (current.status === 'pending_service') return '已完成签到，下一步可开始正式服务。'
  if (current.status === 'in_progress') return '服务进行中，请在时间线持续补录关键节点与附件。'
  if (current.status === 'pending_review') return '这是历史遗留的服务已结束状态，当前可直接按已完结订单核对服务结束汇总与费用。'
  if (current.status === 'completed') return '订单已完结，用户评价为可选项，优先查看服务结束汇总、用药提醒和财务信息。'
  if (current.status === 'canceled') return '订单已取消，请确认取消原因和后续客户沟通。'
  if (current.status === 'emergency') return '订单当前处于紧急状态，请优先查看时间线和异常记录。'
  return ''
})

function reloadAll() {
  loadOrder()
  loadTimeline()
  loadReviews()
  loadReminders()
  loadFollowUpReminders()
  loadAttendantFeeOptions()
  loadValueAddedServiceOptions()
  loadCustomerAdditionalFeeOptions()
}

onMounted(reloadAll)

watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) reloadAll()
})

onBeforeUnmount(() => {
  stopAttendantLivePoll()
  resetTimelinePreviewState()
  revokeServiceConfirmBlob()
})
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">
          订单详情 #{{ order?.orderNumber || orderId }}
          <template v-if="order">
            <el-tag
              class="page-title__tag"
              :type="(orderStatusMap[order.status]?.type as any) || 'info'"
            >
              {{ orderStatusMap[order.status]?.label || order.status }}
            </el-tag>
            <el-tag class="page-title__tag" type="info" effect="plain">
              {{ order.serviceType || '服务类型待定' }}
            </el-tag>
          </template>
        </h2>
      </div>
      <div class="page-header__actions">
        <el-button @click="router.push('/service/orders')">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="order-detail-tabs">
      <el-tab-pane label="履约控制台" name="info">
        <template v-if="order">
          <el-row :gutter="16" class="fc-top-grid">
            <!-- 订单概况 -->
            <el-col :xs="24" :md="8">
              <el-card shadow="never" class="fc-panel">
                <template #header><span class="fc-panel__head">订单概况</span></template>
                <div class="fc-panel__body">
                  <div class="kv-field">
                    <span class="kv-label">服务类型</span>
                    <span class="kv-value kv-value--strong">{{ order.serviceType || '—' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">服务时间</span>
                    <span class="kv-value">{{ serviceScheduleLabel(order) }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">创建时间</span>
                    <span class="kv-value">{{ order.createdAt ? formatDate(order.createdAt) : '—' }}</span>
                  </div>
                  <div v-if="order.hospitalDirectory?.name" class="kv-field">
                    <span class="kv-label">名录医院</span>
                    <span class="kv-value">
                      {{ order.hospitalDirectory.name }}
                      <span v-if="order.hospitalDirectory.city" class="kv-value--muted">（{{ order.hospitalDirectory.city }}）</span>
                    </span>
                  </div>
                </div>
              </el-card>
            </el-col>

            <!-- 客户与陪诊对象 -->
            <el-col :xs="24" :md="8">
              <el-card shadow="never" class="fc-panel">
                <template #header><span class="fc-panel__head">客户与陪诊对象</span></template>
                <div class="fc-panel__body">
                  <div class="kv-field">
                    <span class="kv-label">客户</span>
                    <span class="kv-value kv-value--strong">{{ order.user?.nickname || order.user?.phone || '—' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">客户手机</span>
                    <span class="kv-value">{{ order.user?.phone || '—' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">陪诊对象</span>
                    <span class="kv-value kv-value--strong">{{ order.serviceTarget?.name || '—' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">陪诊对象电话</span>
                    <span class="kv-value">{{ order.serviceTarget?.phone || '—' }}</span>
                  </div>
                  <div v-if="order.callbackContactPhone" class="kv-field">
                    <span class="kv-label">导诊下单回电</span>
                    <span class="kv-value kv-value--accent">{{ order.callbackContactPhone }}</span>
                  </div>
                  <div class="fc-panel__actions">
                    <el-button size="small" :disabled="!order.user?.id && !order.userId" @click="openCustomerDetail">客户详情</el-button>
                  </div>
                </div>
              </el-card>
            </el-col>

            <!-- 就诊与陪诊员 -->
            <el-col :xs="24" :md="8">
              <el-card shadow="never" class="fc-panel">
                <template #header><span class="fc-panel__head">就诊与陪诊员</span></template>
                <div class="fc-panel__body">
                  <div class="kv-field">
                    <span class="kv-label">就诊医院</span>
                    <span class="kv-value">{{ order.hospital || order.hospitalDirectory?.name || '—' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">就诊科室</span>
                    <span class="kv-value">{{ order.department || '—' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">是否需要陪诊员</span>
                    <span class="kv-value">{{ order.needAttendant !== false ? '需要' : '不需要' }}</span>
                  </div>
                  <div class="kv-field">
                    <span class="kv-label">当前陪诊员</span>
                    <span class="kv-value">{{ order.needAttendant === false ? '—' : (order.attendant?.realName || '未分配') }}</span>
                  </div>
                  <div v-if="order.hospitalBookingStatus" class="kv-field">
                    <span class="kv-label">约号状态</span>
                    <span class="kv-value">
                      <el-tag v-if="order.hospitalBookingStatus === 'booked'" size="small" type="success">已自行约号</el-tag>
                      <el-tag v-else-if="order.hospitalBookingStatus === 'pending_cs'" size="small" type="warning">待客服协助约号</el-tag>
                    </span>
                  </div>
                  <div class="fc-panel__actions">
                    <el-button size="small" :disabled="!order.attendant?.id && !order.attendantId" @click="openAttendantDetail">陪诊员详情</el-button>
                    <el-button
                      v-if="canSetEmergencyFromAdmin"
                      size="small"
                      type="danger"
                      plain
                      @click="handleAdminSetEmergency"
                    >标记紧急</el-button>
                    <el-button
                      v-if="canClearEmergencyFromAdmin"
                      size="small"
                      type="success"
                      plain
                      @click="handleAdminClearEmergency"
                    >解除紧急</el-button>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <!-- 工具区：确认单 / 小程序码 / 实时位置 -->
          <el-collapse v-model="toolsCollapse" class="fc-tools">
            <el-collapse-item
              v-if="order.status !== 'canceled' && order.serviceType === '陪诊服务'"
              name="confirm"
            >
              <template #title>
                <span class="fc-tool-title">陪诊服务确认单</span>
                <el-tag
                  v-if="!order.serviceConfirmSignedAt"
                  type="warning"
                  size="small"
                  effect="light"
                  class="fc-tool-title-badge"
                >
                  待签署 · 点此生成二维码
                </el-tag>
                <el-tag
                  v-else
                  type="success"
                  size="small"
                  effect="light"
                  class="fc-tool-title-badge"
                >
                  已签署
                </el-tag>
              </template>
              <p class="fc-tool-lead">
                按当前订单实时生成 A4 预览（含条款页）。预览窗口内可直接打印或另存 PDF。
              </p>
              <p v-if="order.serviceConfirmSignedAt" class="fc-tool-signed">
                客户已于 {{ formatDate(order.serviceConfirmSignedAt) }} 完成手写签署
                <template v-if="order.serviceConfirmSignerName">（签署人：{{ order.serviceConfirmSignerName }}<template v-if="order.serviceConfirmSignerRelation">，{{ order.serviceConfirmSignerRelation }}</template>）</template>，预览中会显示签名与签订日期。
              </p>
              <div class="fc-tool-row">
                <el-button
                  type="primary"
                  :loading="serviceConfirmLoading"
                  @click="openServiceConfirmPreview"
                >
                  在线预览
                </el-button>
                <el-button
                  v-if="!order.serviceConfirmSignedAt"
                  type="warning"
                  :loading="wxaSignQrLoading"
                  @click="generateSignQrcode"
                >
                  生成签署二维码
                </el-button>
              </div>
              <div v-if="wxaSignQrDataUrl && !order.serviceConfirmSignedAt" class="fc-tool-qr-wrap">
                <div style="flex:1;min-width:240px;">
                  <p class="fc-tool-lead">
                    客户用微信扫此二维码后可直接进入签署页面，选择签署人身份并完成手写签名。
                  </p>
                </div>
                <img :src="wxaSignQrDataUrl" alt="签署二维码" class="fc-tool-qr" />
              </div>
            </el-collapse-item>

            <el-collapse-item name="miniprogram" title="小程序 · 客户公开页">
              <div class="fc-tool-row" style="margin-bottom: 12px;">
                <el-button size="small" :loading="wxaOfficialQrLoading" type="primary" @click="generateOfficialMiniQrcode">
                  生成 / 刷新小程序码
                </el-button>
                <el-button size="small" :loading="refreshingMonitorToken" @click="loadMonitorShareToken()">
                  仅刷新路径凭证
                </el-button>
              </div>
              <p class="fc-tool-lead">
                使用微信服务器接口 <code>getwxacodeunlimit</code> 生成二维码（消耗微信额度）。请配置后端 <code>WECHAT_APPID</code>、<code>WECHAT_SECRET</code>；
                若小程序未发正式版，请在 <code>backend/.env</code> 增加 <code>WECHAT_MP_QR_ENV_VERSION=trial</code>。再次生成会使旧码失效。
              </p>
              <div class="fc-tool-qr-wrap">
                <div v-if="wxaOfficialQrDataUrl" style="text-align:center;">
                  <div class="fc-tool-qr-tip">用微信扫此图</div>
                  <img
                    :src="wxaOfficialQrDataUrl"
                    alt="微信官方小程序码"
                    class="fc-tool-qr"
                    style="width:240px;height:240px;"
                  />
                </div>
                <div v-else class="fc-tool-muted" style="font-size:13px;padding:16px 0;">
                  点击「生成 / 刷新小程序码」后在此显示二维码。
                </div>
                <div v-if="monitorMiniPathWithQuery" class="fc-tool-path-wrap">
                  <div class="kv-label" style="margin-bottom:6px;">备用：直接复制 path（太阳码工具用）</div>
                  <el-input type="textarea" :rows="2" readonly :model-value="monitorMiniPathWithQuery" />
                  <div class="fc-tool-row" style="margin-top:8px;">
                    <el-button size="small" @click="copyMonitorLabel('路径', monitorMiniPathWithQuery)">复制路径</el-button>
                    <el-button v-if="weixinMiniScheme" size="small" @click="copyMonitorLabel('微信链接', weixinMiniScheme)">
                      复制 URL Scheme
                    </el-button>
                  </div>
                </div>
              </div>
              <div v-if="!monitorMiniPathWithQuery" class="fc-tool-muted" style="margin-top:8px;font-size:13px;">
                路径凭证未就绪时可点「仅刷新路径凭证」。
              </div>
            </el-collapse-item>

            <el-collapse-item
              v-if="order.status === 'in_progress' || order.status === 'emergency'"
              name="livelocation"
              title="陪诊员实时位置"
            >
              <div class="fc-tool-row" style="margin-bottom: 12px;">
                <el-button size="small" @click="refreshAttendantLiveLocation">立即刷新</el-button>
              </div>
              <div
                v-if="liveAttendantLoc?.active && liveAttendantLoc.latitude != null && liveAttendantLoc.longitude != null"
                class="fc-tool-live-grid"
              >
                <div>纬度：{{ liveAttendantLoc.latitude }}</div>
                <div>经度：{{ liveAttendantLoc.longitude }}</div>
                <div class="fc-tool-live-grid__meta">
                  上报时间：{{ liveAttendantLoc.updatedAt ? formatDate(liveAttendantLoc.updatedAt) : '—' }}
                </div>
              </div>
              <div v-else-if="liveAttendantLoc?.active" class="fc-tool-muted">
                陪诊员尚未上报坐标，请稍后或督促陪诊员在工作台开启定位上报。
              </div>
              <div v-else class="fc-tool-muted">暂无位置状态或未开始轮询。</div>
            </el-collapse-item>
          </el-collapse>

          <el-alert
            v-if="controlNotice"
            :closable="false"
            type="info"
            show-icon
            style="margin-top: 16px;"
            :title="controlNotice"
          />

          <el-card shadow="never" class="fc-actions-card">
            <template #header><span class="fc-panel__head">履约操作</span></template>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
              <el-button type="primary" v-if="canDispatch" @click="openDispatchDialog">指派陪诊员</el-button>
              <el-button type="success" v-if="canToGrabPool" @click="handleToGrabPool">放入抢单池</el-button>
              <el-button type="primary" v-if="canAdminConfirmAccept" @click="handleAdminConfirmAccept">代陪诊员确认接单</el-button>
              <el-button type="success" v-if="canMarkSignComplete" @click="handleMarkSignComplete">标记已签到</el-button>
              <el-button type="success" v-if="canStartService" @click="handleStartService">
                <el-icon><VideoPlay /></el-icon>&nbsp;开始服务
              </el-button>
              <el-button type="warning" v-if="canEndService" @click="handleEndService">
                <el-icon><CircleCheck /></el-icon>&nbsp;标记服务结束
              </el-button>
              <el-button type="success" v-if="canCompleteOrder" @click="handleCompleteOrder">
                <el-icon><Select /></el-icon>&nbsp;标记已完成
              </el-button>
              <el-button type="danger" v-if="canCancel" @click="handleCancelOrder">取消订单</el-button>
            </div>
          </el-card>

          <el-row :gutter="16" style="margin-top: 16px;">
            <el-col :xs="24" :lg="12">
              <el-card shadow="never" style="height: 100%;">
                <template #header>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-weight: 600;">服务安排</span>
                    <el-button type="primary" link @click="openServiceEditDialog"><el-icon><Edit /></el-icon> 编辑服务信息</el-button>
                  </div>
                </template>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="服务类型">{{ order.serviceType || '—' }}</el-descriptions-item>
                  <el-descriptions-item label="风险等级">
                    <el-tag v-if="getRiskLevelLabel(order.riskLevel)" :type="getRiskLevelTagType(order.riskLevel)" effect="light">
                      {{ getRiskLevelLabel(order.riskLevel) }}
                    </el-tag>
                    <span v-else>—</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="服务时间">{{ serviceScheduleLabel(order) }}</el-descriptions-item>
                  <el-descriptions-item label="就诊医院">{{ order.hospital || '—' }}</el-descriptions-item>
                  <el-descriptions-item label="就诊科室">{{ order.department || '—' }}</el-descriptions-item>
                  <el-descriptions-item label="体检套餐" v-if="order.serviceType === '体检预约'">{{ order.checkupPackageName || '—' }}</el-descriptions-item>
                  <el-descriptions-item label="套餐性别" v-if="order.serviceType === '体检预约'">{{ order.checkupGender === 'male' ? '男' : order.checkupGender === 'female' ? '女' : '—' }}</el-descriptions-item>
                  <el-descriptions-item label="附加备选项目" v-if="order.serviceType === '体检预约' && order.checkupOptionalItems?.length">
                    <div v-for="(opt, i) in order.checkupOptionalItems" :key="i" style="font-size: 13px; margin-bottom: 4px;">
                      {{ opt.name }}（¥{{ Number(opt.price).toLocaleString() }}）
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="订单附加服务项" v-if="order.additionalServiceItems?.length">
                    <div v-for="(item, i) in order.additionalServiceItems" :key="item.id || i" style="font-size: 13px; margin-bottom: 4px;">
                      {{ item.name }}（¥{{ Number(item.amount).toLocaleString() }}）
                      <span v-if="item.note" style="color:#909399;"> - {{ item.note }}</span>
                    </div>
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-col>
            <el-col :xs="24" :lg="12">
              <el-card shadow="never" style="height: 100%;">
                <template #header>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-weight: 600;">费用与结算</span>
                    <el-button type="warning" link @click="openFeeEditDialog"><el-icon><Edit /></el-icon> 设置费用与结算</el-button>
                  </div>
                </template>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="基础服务费">{{ order.baseFee ? formatMoney(order.baseFee) : '—' }}</el-descriptions-item>
                  <el-descriptions-item label="总费用">{{ order.totalFee ? formatMoney(order.totalFee) : '—' }}</el-descriptions-item>
                  <el-descriptions-item label="陪诊员此单收入">
                    <span v-if="order.attendantFee != null" style="color: #67c23a; font-weight: 600;">{{ formatMoney(order.attendantFee) }}</span>
                    <span v-else>—</span>
                    <span v-if="order.attendantFeeType" style="color: #909399; font-size: 12px; margin-left: 4px;">（{{ order.attendantFeeType }}）</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="收入构成" v-if="order.attendantExtraIncomeItems?.length">
                    <div style="font-size: 13px; margin-bottom: 4px;">
                      {{ order.attendantFeeType || '基础收入' }}（¥{{ getAttendantBaseIncomeAmount(order).toFixed(2) }}）
                    </div>
                    <div v-for="(item, i) in order.attendantExtraIncomeItems" :key="item.id || i" style="font-size: 13px; margin-bottom: 4px;">
                      {{ item.name }}（¥{{ Number(item.amount).toLocaleString() }}）
                      <span v-if="item.note" style="color:#909399;"> - {{ item.note }}</span>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="结算状态">
                    <el-tag :type="order.settlementStatus === 'settled' ? 'success' : 'warning'" size="small">{{ order.settlementStatus === 'settled' ? '已结算' : '待结算' }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="付款状态">
                    <el-tag :type="order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'refunded' ? 'info' : 'danger'" size="small">{{ order.paymentStatus === 'paid' ? '已付款' : order.paymentStatus === 'refunded' ? '已退款' : '未付款' }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="付款方式">{{ order.paymentMethod === 'wechat' ? '微信转账' : order.paymentMethod === 'alipay' ? '支付宝转账' : order.paymentMethod === 'qr_transfer' ? '收款码转账' : order.paymentMethod === 'bank_transfer' ? '银行卡转账' : order.paymentMethod === 'cash' ? '现金' : order.paymentMethod === 'other' ? '其他' : '—' }}</el-descriptions-item>
                  <el-descriptions-item label="付款时间">{{ order.paymentPaidAt ? formatDate(order.paymentPaidAt) : '—' }}</el-descriptions-item>
                  <el-descriptions-item label="交易流水号">{{ order.paymentReference || '—' }}</el-descriptions-item>
                  <el-descriptions-item label="结算时间">{{ order.settledAt ? formatDate(order.settledAt) : '—' }}</el-descriptions-item>
                  <el-descriptions-item label="财务备注" :span="2">{{ order.settlementRemark || '—' }}</el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-col>
          </el-row>

          <el-card shadow="never" style="margin-top: 16px;">
            <template #header><span style="font-weight: 600;">客户备注与取消信息</span></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="客户备注">{{ order.notes || '—' }}</el-descriptions-item>
              <el-descriptions-item label="取消原因">{{ order.cancelReason || '—' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </template>
      </el-tab-pane>

      <el-tab-pane label="服务时间线" name="timeline">
        <!-- 发布面板 -->
        <el-card shadow="never" style="margin-bottom: 20px; border: 1px dashed #d9e8d4;">
          <template #header>
            <span style="font-weight:600;">📤 补录时间线内容</span>
            <span style="color:#909399;font-size:12px;margin-left:8px;">仅“客户可见”的内容才会同步到客户时间线与企业微信通知</span>
          </template>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom:12px;"
            title="与「客户详情 → 客户服务」不是同一条时间轴：这里记录陪诊过程图文/录音/文件；客户服务页展示的是用药与复诊提醒。"
          />
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <el-select v-model="tlPublishForm.type" style="width:160px;" size="default">
                <el-option v-for="t in TIMELINE_TYPES" :key="t.value" :value="t.value" :label="t.label" />
              </el-select>
              <el-switch v-model="tlPublishForm.visibleToUser" active-text="客户可见" inactive-text="仅内部" />
              <span style="color:#606266;font-size:13px;">业务发生时间（可选）：</span>
              <el-date-picker
                v-model="tlPublishForm.eventTime"
                type="datetime"
                placeholder="不选则按发布时间"
                clearable
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm:ss"
                style="width:220px;"
              />
            </div>
            <el-input
              v-model="tlPublishForm.content"
              type="textarea"
              :rows="3"
              placeholder="填写文字内容（图片/文件类型也可附加说明文字）"
            />
            <!-- 文件上传区 -->
            <div>
              <input
                ref="tlFileInputRef"
                type="file"
                multiple
                accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                style="display:none;"
                @change="onTlFileChange"
              />
              <el-button size="small" @click="tlFileInputRef?.click()">
                <el-icon><Paperclip /></el-icon> 添加附件（图片/录音/PDF）
              </el-button>
              <div v-if="tlPublishForm.files.length" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
                <el-tag
                  v-for="(f, idx) in tlPublishForm.files"
                  :key="idx"
                  closable
                  @close="removeTlFile(idx)"
                  size="small"
                >{{ f.name }}</el-tag>
              </div>
            </div>
            <div>
              <el-button type="primary" :loading="tlPublishing" @click="publishTimeline">发布</el-button>
            </div>
          </div>
        </el-card>

        <!-- 时间线列表 -->
        <div v-loading="timelineLoading">
          <el-timeline v-if="timelines.length">
            <el-timeline-item
              v-for="item in timelines"
              :key="item.id"
              :timestamp="formatDate(item.eventTime || item.createdAt) + (item.eventTime ? '（已补录业务时间）' : '')"
              placement="top"
            >
              <el-card shadow="never" style="margin-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap:8px;">
                  <div style="flex:1;min-width:0;">
                    <el-tag size="small" style="margin-right: 8px;">
                      {{ ({ text:'文字',image:'图片',audio_question:'问诊录音',audio_advice:'医嘱录音',file:'文件',node:'节点',service_start:'服务开始',service_end:'服务结束',emergency:'紧急' } as any)[item.type] || item.type }}
                    </el-tag>
                    <span v-if="item.operator?.nickname || item.operator?.realName" style="font-size:12px;color:#909399;margin-right:8px;">
                      {{ item.operator?.nickname || item.operator?.realName }}
                    </span>
                    <template v-if="editingTimelineEntryId === item.id">
                      <el-input
                        v-model="editingEntryDraft.content"
                        type="textarea"
                        :rows="3"
                        maxlength="3000"
                        show-word-limit
                        placeholder="文字内容（可留空）"
                        style="margin-top:6px;"
                      />
                    </template>
                    <span v-else>{{ item.content }}</span>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                    <el-switch
                      :model-value="item.visibleToUser"
                      active-text="用户可见"
                      inactive-text="内部"
                      size="small"
                      @change="handleToggleVisibility(item)"
                    />
                    <el-button
                      v-if="isContentTimelineItem(item) && editingTimelineEntryId !== item.id"
                      type="primary"
                      link
                      size="small"
                      @click="startEditingTimelineEntry(item)"
                    >
                      <el-icon><EditPen /></el-icon>
                      <span style="margin-left:2px;">编辑</span>
                    </el-button>
                  </div>
                </div>
                <!-- 编辑态：可删除的保留列表 + 新上传预览 + 添加/保存/取消 -->
                <template v-if="editingTimelineEntryId === item.id">
                  <div v-if="editingEntryDraft.keepImages.length > 0" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
                    <div
                      v-for="(img, idx) in editingEntryDraft.keepImages"
                      :key="`keep_img_${idx}`"
                      style="position:relative;width:120px;height:120px;"
                    >
                      <el-image
                        :src="getTimelineAssetUrlSafe(img)"
                        style="width:100%;height:100%;"
                        fit="cover"
                      />
                      <el-icon
                        style="position:absolute;top:-6px;right:-6px;background:#f56c6c;color:#fff;border-radius:50%;padding:2px;cursor:pointer;"
                        @click="removeDraftImage(idx)"
                      ><Close /></el-icon>
                    </div>
                  </div>
                  <div v-if="editingEntryDraft.keepAudioFiles.length > 0" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">
                    <div
                      v-for="(a, idx) in editingEntryDraft.keepAudioFiles"
                      :key="`keep_audio_${idx}`"
                      style="display:flex;align-items:center;gap:8px;"
                    >
                      <audio controls :src="getTimelineAssetUrlSafe(a.url)" style="flex:1;max-width:360px;" />
                      <el-button type="danger" link size="small" @click="removeDraftAudio(idx)">移除</el-button>
                    </div>
                  </div>
                  <div v-if="editingEntryDraft.keepFiles.length > 0" style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
                    <div
                      v-for="(f, idx) in editingEntryDraft.keepFiles"
                      :key="`keep_file_${idx}`"
                      style="display:flex;align-items:center;gap:8px;"
                    >
                      <span style="color:#606266;font-size:13px;">📄 {{ f.name }}</span>
                      <el-button type="danger" link size="small" @click="removeDraftFile(idx)">移除</el-button>
                    </div>
                  </div>
                  <div v-if="editingEntryDraft.newFiles.length > 0" style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
                    <div
                      v-for="(f, idx) in editingEntryDraft.newFiles"
                      :key="`new_file_${idx}`"
                      style="display:flex;align-items:center;gap:8px;"
                    >
                      <span style="color:#67c23a;font-size:13px;">+ {{ f.name }} ({{ Math.round(f.size / 1024) }} KB)</span>
                      <el-button type="danger" link size="small" @click="removeDraftNewFile(idx)">撤销</el-button>
                    </div>
                  </div>
                  <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <input
                      ref="timelineEntryFileInputRef"
                      type="file"
                      multiple
                      accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                      style="display:none;"
                      @change="onTimelineEntryFilesPicked"
                    />
                    <el-button size="small" @click="triggerTimelineEntryFilePicker">
                      <el-icon><Plus /></el-icon>
                      <span style="margin-left:2px;">添加附件</span>
                    </el-button>
                    <el-button size="small" @click="cancelEditingTimelineEntry">取消</el-button>
                    <el-button
                      type="primary"
                      size="small"
                      :loading="savingTimelineEntry"
                      @click="saveTimelineEntry(item)"
                    >保存</el-button>
                  </div>
                </template>
                <!-- 展示态（非编辑时显示） -->
                <!-- 图片 -->
                <div v-if="editingTimelineEntryId !== item.id && getTimelineImageUrls(item).length > 0" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
                  <el-image
                    v-for="(img, idx) in getTimelineImageUrls(item)"
                    :key="idx"
                    :src="img"
                    style="width: 120px; height: 120px;"
                    fit="cover"
                    :preview-src-list="getTimelineImageUrls(item)"
                  />
                </div>
                <!-- 录音 -->
                <div v-if="editingTimelineEntryId !== item.id && getTimelineAudioUrls(item).length > 0" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">
                  <audio
                    v-for="(audioUrl, ai) in getTimelineAudioUrls(item)"
                    :key="`${item.id}_audio_${ai}`"
                    controls
                    :src="audioUrl"
                    style="width:100%;max-width:360px;"
                  />
                </div>
                <div v-if="editingTimelineEntryId !== item.id && isAudioTimelineItem(item)" class="timeline-transcription">
                  <div class="timeline-transcription__head">
                    <div class="timeline-transcription__title">
                      <el-icon><ChatDotRound /></el-icon>
                      <span>录音转写</span>
                    </div>
                    <el-tag size="small" :type="getTimelineTranscription(item).tagType as any">
                      {{ getTimelineTranscription(item).statusText }}
                    </el-tag>
                  </div>

                  <div v-if="editingTimelineTranscriptionId === item.id" class="timeline-transcription__editor">
                    <el-input
                      v-model="timelineTranscriptionDraft"
                      type="textarea"
                      :rows="5"
                      maxlength="3000"
                      show-word-limit
                      placeholder="请输入录音转写文字"
                    />
                    <div class="timeline-transcription__actions">
                      <el-button @click="cancelEditingTimelineTranscription">取消</el-button>
                      <el-button type="primary" :loading="savingTimelineTranscription" @click="saveTimelineTranscription(item)">
                        保存文字
                      </el-button>
                    </div>
                  </div>

                  <div v-else class="timeline-transcription__body">
                    <div class="timeline-transcription__text">
                      {{ getTimelineTranscription(item).text || getTimelineTranscription(item).placeholder }}
                    </div>
                    <div v-if="getTimelineTranscription(item).error" class="timeline-transcription__error">
                      {{ getTimelineTranscription(item).error }}
                    </div>
                    <div class="timeline-transcription__actions">
                      <el-button type="primary" link @click="startEditingTimelineTranscription(item)">
                        {{ getTimelineTranscription(item).text ? '修改文字' : '补充文字' }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <!-- 文件附件 -->
                <div v-if="editingTimelineEntryId !== item.id && getTimelineDocumentFiles(item).length > 0" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
                  <el-button
                    v-for="(f, fi) in getTimelineDocumentFiles(item)"
                    :key="fi"
                    type="primary"
                    link
                    style="font-size:13px;"
                    @click="openTimelineDocument(f)"
                  >📄 预览 {{ f.name }}</el-button>
                </div>
                <!-- 业务时间编辑（仅内容型节点：text/image/file/audio_*，且不在内容编辑态时显示） -->
                <div v-if="isContentTimelineItem(item) && editingTimelineEntryId !== item.id" style="margin-top:10px;padding-top:8px;border-top:1px dashed #ebeef5;">
                  <div v-if="editingTimelineEventTimeId === item.id" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <span style="color:#606266;font-size:12px;">业务时间：</span>
                    <el-date-picker
                      v-model="timelineEventTimeDraft"
                      type="datetime"
                      placeholder="选择节点实际发生时间"
                      format="YYYY-MM-DD HH:mm"
                      value-format="YYYY-MM-DDTHH:mm:ssZ"
                      style="width:220px;"
                    />
                    <el-button size="small" @click="cancelEditingTimelineEventTime">取消</el-button>
                    <el-button type="primary" size="small" :loading="savingTimelineEventTime" @click="saveTimelineEventTime(item)">保存业务时间</el-button>
                  </div>
                  <div v-else style="display:flex;align-items:center;gap:8px;">
                    <el-button type="primary" link size="small" @click="startEditingTimelineEventTime(item)">
                      <el-icon><Clock /></el-icon>
                      <span style="margin-left:4px;">{{ item.eventTime ? '修改业务时间' : '补录业务时间' }}</span>
                    </el-button>
                    <span v-if="item.eventTime" style="color:#909399;font-size:12px;">当前业务时间：{{ formatDate(item.eventTime) }}；原记录创建于 {{ formatDate(item.createdAt) }}</span>
                  </div>
                </div>
                <!-- 服务完成节点：一键跳到服务结束汇总 Tab -->
                <div v-if="isCompletionTimelineItem(item)" style="margin-top:10px;padding-top:8px;border-top:1px dashed #ebeef5;">
                  <el-button type="success" link size="small" @click="jumpToCompletionSummary">
                    <el-icon><DocumentChecked /></el-icon>
                    <span style="margin-left:4px;">查看服务结束汇总 →</span>
                  </el-button>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无时间线记录">
            <template #image>
              <el-icon :size="60" color="#c0c4cc"><Clock /></el-icon>
            </template>
          </el-empty>
        </div>
      </el-tab-pane>


      <el-tab-pane label="费用记录" name="finance">
        <div v-if="order?.financeRecords?.length">
          <el-table :data="order.financeRecords" highlight-current-row>
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="remark" label="备注" />
          </el-table>
        </div>
        <el-empty v-else description="暂无费用记录" />
      </el-tab-pane>

      <el-tab-pane label="服务结束汇总" name="completion">
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight: 600;">服务结束汇总</span>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <el-button type="primary" link @click="openCompletionEditDialog"><el-icon><Edit /></el-icon> 编辑汇总</el-button>
                <el-tag size="small" type="success" v-if="completionSummary.hasData">已同步到订单</el-tag>
                <el-tag size="small" type="info" v-if="completionSummary.medicationMode === 'has'">
                  已同步用药提醒 {{ orderReminders.length }} 条
                </el-tag>
                <el-tag size="small" type="warning" v-else-if="completionSummary.medicationMode === 'none'">
                  本次无需用药提醒
                </el-tag>
                <el-tag size="small" type="primary" v-if="completionSummary.followUpDate">
                  已同步复诊提醒 {{ followUpReminders.length }} 条
                </el-tag>
              </div>
            </div>
          </template>
          <el-alert
            :closable="false"
            :type="order?.completionReadOnly ? 'warning' : 'info'"
            show-icon
            style="margin-bottom: 16px;"
            :title="order?.completionEditableUntil
              ? `陪诊员服务结束汇总可在 ${COMPLETION_EDITABLE_DAYS} 天内补充或修改，后台也可在这里继续补录。陪诊员修改截止：${formatDate(order.completionEditableUntil)}`
              : '后台可在这里补录或修正服务结束汇总，并同步用药提醒与复诊提醒。'"
          />
          <template v-if="completionSummary.hasData">
            <el-row :gutter="16">
              <el-col :xs="24" :lg="12">
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="诊断结果">
                    <div style="white-space: pre-wrap; line-height: 1.8; color: #606266;">
                      {{ completionSummary.diagnosisResult || '—' }}
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="医生嘱托">
                    <div style="white-space: pre-wrap; line-height: 1.8; color: #606266;">
                      {{ completionSummary.doctorAdvice || '—' }}
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="服务总结">
                    <div style="white-space: pre-wrap; line-height: 1.8; color: #303133;">
                      {{ completionSummary.summary || '—' }}
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="复诊日期">
                    {{ completionSummary.followUpDate || '—' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="复诊医院">
                    {{ completionSummary.followUpHospital || '—' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="复诊科室">
                    {{ completionSummary.followUpDepartment || '—' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="复诊备注">
                    <div style="white-space: pre-wrap; line-height: 1.8; color: #606266;">
                      {{ completionSummary.followUpNote || '—' }}
                    </div>
                  </el-descriptions-item>
                </el-descriptions>
              </el-col>
              <el-col :xs="24" :lg="12">
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="用药提醒确认">
                    <el-tag v-if="completionSummary.medicationMode === 'has'" type="success">需要同步用药提醒</el-tag>
                    <el-tag v-else-if="completionSummary.medicationMode === 'none'" type="info">无需用药提醒</el-tag>
                    <span v-else>—</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="同步结果">
                    {{ completionSummary.medicationMode === 'has' ? `后台已生成 ${orderReminders.length} 条提醒` : '—' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="复诊提醒同步">
                    {{ completionSummary.followUpDate ? `后台已生成 ${followUpReminders.length} 条复诊提醒` : '未设置复诊日期' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="附件数量">
                    {{ completionSummary.images.length + completionSummary.files.length }} 份
                  </el-descriptions-item>
                </el-descriptions>
              </el-col>
            </el-row>

            <div style="margin-top: 16px;" v-if="completionSummary.medications.length">
              <div style="font-weight: 600; margin-bottom: 10px;">用药记录</div>
              <el-table :data="completionSummary.medications" size="small" highlight-current-row>
                <el-table-column prop="name" label="药品名称" min-width="140" />
                <el-table-column prop="usage" label="用法用量" min-width="180" />
                <el-table-column prop="reminderTime" label="提醒时间" width="110" />
                <el-table-column label="起止日期" min-width="180">
                  <template #default="{ row }">{{ row.startDate || '—' }} ~ {{ row.endDate || '—' }}</template>
                </el-table-column>
              </el-table>
            </div>

            <div style="margin-top: 16px;" v-if="completionSummary.images.length">
              <div style="font-weight: 600; margin-bottom: 10px;">上传图片</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <el-image
                  v-for="(img, idx) in completionSummary.images"
                  :key="`completion-img-${idx}`"
                  :src="img"
                  style="width: 120px; height: 120px; border-radius: 8px;"
                  fit="cover"
                  :preview-src-list="completionSummary.images"
                />
              </div>
            </div>

            <div style="margin-top: 16px;" v-if="completionSummary.files.length">
              <div style="font-weight: 600; margin-bottom: 10px;">上传附件</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <el-button
                  v-for="(file, idx) in completionSummary.files"
                  :key="`completion-file-${idx}`"
                  type="primary"
                  link
                  @click="openCompletionAttachment(file)"
                >
                  📄 {{ file.name }}
                </el-button>
              </div>
            </div>
          </template>
          <el-empty v-else description="陪诊员暂未提交服务结束汇总">
            <el-button type="primary" @click="openCompletionEditDialog">后台补录汇总</el-button>
          </el-empty>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="客户服务" name="reminder">
        <el-alert
          :closable="false"
          type="info"
          show-icon
          style="margin-bottom: 16px;"
          title="这里统一管理订单关联的用药提醒和复诊提醒。陪诊员在服务结束汇总里填写复诊日期后，也会自动同步到这里。"
        />

        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <el-tag type="warning" effect="plain">用药 {{ activeOrderReminders.length }}</el-tag>
            <el-tag type="success" effect="plain">复诊 {{ activeFollowUpReminders.length }}</el-tag>
            <el-tag type="info" effect="plain">全部 {{ orderCustomerServiceTimelineItems.length }}</el-tag>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <el-button type="primary" size="small" @click="openReminderDialog"><el-icon><Plus /></el-icon> 新建用药提醒</el-button>
            <el-button type="success" size="small" @click="openFollowUpDialog"><el-icon><Plus /></el-icon> 新建复诊提醒</el-button>
          </div>
        </div>

        <el-timeline v-if="orderCustomerServiceTimelineItems.length">
          <el-timeline-item
            v-for="item in orderCustomerServiceTimelineItems"
            :key="item.timelineKey"
            :timestamp="item.whenText"
            placement="top"
            :type="item.reminderKind === 'follow_up' ? 'success' : 'warning'"
          >
            <el-card shadow="hover" class="customer-service-card">
              <div class="customer-service-card__head">
                <div class="customer-service-card__main">
                  <div class="customer-service-card__tags">
                    <el-tag :type="reminderKindTagType(item.reminderKind)" effect="dark" size="small">{{ reminderKindLabel(item.reminderKind) }}</el-tag>
                    <el-tag size="small" effect="plain" :type="reminderStatusType(item.status)">{{ reminderStatusLabel(item.status) }}</el-tag>
                    <el-tag size="small" effect="plain" type="info">{{ reminderSourceLabel(item) }}</el-tag>
                    <el-tag v-if="item.serviceTarget?.name || order?.serviceTarget?.name" size="small" effect="plain">{{ item.serviceTarget?.name || order?.serviceTarget?.name }}</el-tag>
                  </div>
                  <div class="customer-service-card__title">{{ item.title }}</div>
                  <div class="customer-service-card__summary">{{ item.summary || '—' }}</div>
                </div>
                <div class="customer-service-card__actions">
                  <el-button
                    v-if="item.orderId || item.order?.id"
                    type="primary"
                    link
                    size="small"
                    @click="activeTab = 'completion'"
                  >查看汇总</el-button>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    @click="item.reminderKind === 'follow_up' ? openEditFollowUpReminder(item) : openEditReminder(item)"
                  >编辑</el-button>
                  <el-button type="danger" link size="small" @click="handleDeleteReminder(item.id)">删除</el-button>
                </div>
              </div>

              <div class="customer-service-card__meta">
                <div class="customer-service-card__meta-item">
                  <span class="customer-service-card__meta-label">提醒时间</span>
                  <span class="customer-service-card__meta-value">{{ formatReminderTimes(item) }}</span>
                </div>
                <div class="customer-service-card__meta-item">
                  <span class="customer-service-card__meta-label">日期范围</span>
                  <span class="customer-service-card__meta-value">{{ formatReminderDateRange(item) }}</span>
                </div>
                <div class="customer-service-card__meta-item">
                  <span class="customer-service-card__meta-label">通知渠道</span>
                  <span class="customer-service-card__meta-value">{{ CHANNEL_LABEL[item.channel] || item.channel || '—' }}</span>
                </div>
                <div class="customer-service-card__meta-item">
                  <span class="customer-service-card__meta-label">录入时间</span>
                  <span class="customer-service-card__meta-value">{{ item.createdAt ? formatDate(item.createdAt) : '—' }}</span>
                </div>
              </div>

              <div v-if="item.instructions && item.instructions !== item.summary" class="customer-service-card__note">
                {{ item.instructions }}
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无客户服务提醒">
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <el-button type="primary" @click="openReminderDialog"><el-icon><Plus /></el-icon> 新建用药提醒</el-button>
            <el-button type="success" @click="openFollowUpDialog"><el-icon><Plus /></el-icon> 新建复诊提醒</el-button>
          </div>
        </el-empty>
      </el-tab-pane>

      <el-tab-pane label="用户评价" name="review">
        <div v-if="reviews.length">
          <div v-for="review in reviews" :key="review.id" style="margin-bottom: 20px; padding: 16px; background: #f5f7fa; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <el-rate :model-value="review.rating" disabled />
              <span style="color: #409EFF; font-weight: bold;">{{ review.rating }}.0 分</span>
            </div>
            <p style="color: #606266; line-height: 1.8;">{{ review.comment || review.content || '无评价内容' }}</p>
            <div v-if="review.tags" style="margin-top: 8px;">
              <el-tag v-for="tag in (typeof review.tags === 'string' ? JSON.parse(review.tags) : review.tags)" :key="tag" size="small" type="success" style="margin-right: 6px;">{{ tag }}</el-tag>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: #909399;">
              {{ review.user?.nickname || '用户' }} · {{ formatDate(review.createdAt) }}
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无评价" />
      </el-tab-pane>
    </el-tabs>

    <!-- 指派陪诊员对话框 -->
    <el-dialog v-model="dispatchDialogVisible" title="指派陪诊员" width="520px">
      <el-form label-width="110px">
        <el-form-item label="选择陪诊员">
          <el-select v-model="dispatchForm.attendantId" placeholder="请选择" filterable style="width: 100%">
            <el-option
              v-for="a in attendantOptions"
              :key="a.id"
              :label="`${a.realName}（${a.employeeId || a.phone}）`"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="陪诊员费用">
          <el-select
            v-model="dispatchForm.attendantFeeType"
            placeholder="选择费用类型"
            filterable
            style="width: 100%"
            @change="(v: string) => onFeeTypeChange('dispatch', v)"
          >
            <el-option
              v-for="o in ATTENDANT_FEE_OPTIONS"
              :key="o.label"
              :label="o.label === '自定义金额' ? o.label : `${o.label} — ¥${o.fee}`"
              :value="o.label"
            />
          </el-select>
          <el-input-number
            v-if="dispatchForm.attendantFeeType === '自定义金额'"
            v-model="dispatchForm.attendantFee"
            :min="0"
            :precision="2"
            style="width: 100%; margin-top: 8px;"
            placeholder="输入金额"
          />
          <div style="margin-top: 6px; font-size: 12px; color: #909399;">此单陪诊员收入：<strong style="color: #67c23a;">¥{{ dispatchForm.attendantFee }}</strong></div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dispatchDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dispatchLoading" @click="handleDispatch">确认指派</el-button>
      </template>
    </el-dialog>

    <!-- 放入抢单池对话框 -->
    <el-dialog v-model="grabPoolDialogVisible" title="放入抢单池" width="480px">
      <el-form label-width="110px">
        <el-form-item label="陪诊员费用">
          <el-select
            v-model="grabPoolForm.attendantFeeType"
            placeholder="选择费用类型"
            filterable
            style="width: 100%"
            @change="(v: string) => onFeeTypeChange('grab', v)"
          >
            <el-option
              v-for="o in ATTENDANT_FEE_OPTIONS"
              :key="o.label"
              :label="o.label === '自定义金额' ? o.label : `${o.label} — ¥${o.fee}`"
              :value="o.label"
            />
          </el-select>
          <el-input-number
            v-if="grabPoolForm.attendantFeeType === '自定义金额'"
            v-model="grabPoolForm.attendantFee"
            :min="0"
            :precision="2"
            style="width: 100%; margin-top: 8px;"
            placeholder="输入金额"
          />
          <div style="margin-top: 6px; font-size: 12px; color: #909399;">抢单成功后陪诊员此单收入：<strong style="color: #67c23a;">¥{{ grabPoolForm.attendantFee }}</strong></div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="grabPoolDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmToGrabPool">确认放入抢单池</el-button>
      </template>
    </el-dialog>

    <!-- 取消订单对话框 -->
    <el-dialog v-model="cancelDialogVisible" title="取消订单" width="500px">
      <el-form label-width="100px">
        <el-form-item label="取消原因">
          <el-input v-model="cancelReason" type="textarea" :rows="3" placeholder="请填写取消原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDialogVisible = false">返回</el-button>
        <el-button type="danger" @click="confirmCancel">确认取消</el-button>
      </template>
    </el-dialog>


    <!-- 用药提醒创建对话框 -->
    <el-dialog v-model="reminderDialogVisible" :title="editingReminderId ? '编辑用药提醒' : '新建用药提醒'" width="550px">
      <el-form :model="reminderForm" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="药品名称"><el-input v-model="reminderForm.medicineName" placeholder="如：阿莫西林" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="剂量"><el-input v-model="reminderForm.dosage" placeholder="如：0.5g 每日3次" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="用药说明"><el-input v-model="reminderForm.instructions" type="textarea" :rows="2" placeholder="饭后服用等说明" /></el-form-item>
        <el-form-item label="提醒时间">
          <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
            <div v-for="(t, i) in reminderForm.reminderTimes" :key="i" style="display: flex; align-items: center; gap: 4px;">
              <el-time-select v-model="reminderForm.reminderTimes[i]" start="06:00" end="22:00" step="00:30" style="width: 110px;" />
              <el-button v-if="reminderForm.reminderTimes.length > 1" type="danger" link @click="removeTime(i)"><el-icon><Delete /></el-icon></el-button>
            </div>
            <el-button type="primary" link @click="addTime"><el-icon><Plus /></el-icon></el-button>
          </div>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="开始日期"><el-date-picker v-model="reminderForm.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="结束日期"><el-date-picker v-model="reminderForm.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="频率"><el-select v-model="reminderForm.frequency" style="width:100%"><el-option label="每天" value="daily" /><el-option label="仅一次" value="once" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="通知渠道"><el-select v-model="reminderForm.channel" style="width:100%"><el-option label="小程序消息" value="mini_program" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="editingReminderId" label="提醒状态">
          <el-select v-model="reminderForm.status" style="width:100%">
            <el-option label="进行中" value="active" />
            <el-option label="已暂停" value="paused" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reminderDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reminderSaving" @click="saveReminder">{{ editingReminderId ? '保存修改' : '创建提醒' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="followUpDialogVisible" :title="editingFollowUpReminderId ? '编辑复诊提醒' : '新建复诊提醒'" width="520px">
      <el-form :model="followUpForm" label-width="90px">
        <el-form-item label="提醒标题">
          <el-input v-model="followUpForm.title" placeholder="如：门诊复查 / 专家复诊" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="复诊日期"><el-date-picker v-model="followUpForm.followUpDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="提醒时间"><el-time-select v-model="followUpForm.reminderTime" start="06:00" end="22:00" step="00:30" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="复诊医院"><el-input v-model="followUpForm.hospital" placeholder="请输入复诊医院" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="复诊科室"><el-input v-model="followUpForm.department" placeholder="请输入复诊科室" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="频率"><el-select model-value="once" disabled style="width:100%"><el-option label="仅一次" value="once" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="通知渠道"><el-select v-model="followUpForm.channel" style="width:100%"><el-option label="小程序消息" value="mini_program" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="editingFollowUpReminderId" label="提醒状态">
          <el-select v-model="followUpForm.status" style="width:100%">
            <el-option label="进行中" value="active" />
            <el-option label="已暂停" value="paused" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注说明">
          <el-input v-model="followUpForm.instructions" type="textarea" :rows="3" placeholder="补充科室、医生要求或复诊注意事项" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followUpDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="followUpSaving" @click="saveFollowUpReminder">{{ editingFollowUpReminderId ? '保存修改' : '创建提醒' }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑服务信息对话框 -->
    <el-dialog v-model="serviceEditDialogVisible" title="编辑服务信息" width="620px" destroy-on-close>
      <div style="margin-bottom: 14px; color: #606266; font-size: 13px; line-height: 1.7;">
        这里只调整服务安排相关内容，如服务类型、风险等级、医院、科室、时间和备注。费用请到“费用与结算”里单独设置。
      </div>
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="服务类型">
          <el-select v-model="editForm.serviceType" placeholder="请选择" clearable style="width: 100%;">
            <el-option label="陪诊服务" value="陪诊服务" />
            <el-option label="体检预约" value="体检预约" />
            <el-option label="VIP医疗资源协调" value="VIP医疗资源协调" />
            <el-option label="门诊咨询" value="门诊咨询" />
            <el-option label="到店预约" value="到店预约" />
            <el-option label="代取报告" value="代取报告" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="editForm.riskLevel" placeholder="请选择风险等级" clearable style="width: 100%;">
            <el-option
              v-for="option in ORDER_RISK_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <template v-if="editForm.serviceType === '体检预约'">
          <el-form-item label="套餐性别">
            <el-radio-group v-model="editForm.checkupGender">
              <el-radio value="male">男</el-radio>
              <el-radio value="female">女</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="套餐名称">
            <el-input v-model="editForm.checkupPackageName" placeholder="体检套餐名称" />
          </el-form-item>
        </template>
        <el-form-item label="约号状态">
          <el-select v-model="editForm.hospitalBookingStatus" placeholder="未设置" clearable style="width: 100%;">
            <el-option label="已自行约号" value="booked" />
            <el-option label="待客服协助约号" value="pending_cs" />
          </el-select>
        </el-form-item>
        <el-form-item label="名录医院">
          <el-select
            v-model="editForm.hospitalDirectoryId"
            filterable
            remote
            clearable
            reserve-keyword
            placeholder="输入关键词搜索并改绑名录医院"
            :remote-method="searchHospitalsForOrderBind"
            :loading="hospitalBindSearchLoading"
            style="width: 100%;"
            @change="onEditHospitalDirectoryChange"
          >
            <el-option
              v-for="h in hospitalBindOptions"
              :key="h.id"
              :label="`${h.name}（${h.city || ''}${h.district || ''}）`"
              :value="h.id"
            />
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 6px;">
            选择后会同步更新下方「就诊医院」展示文案，保存前仍可手动修改；清空即解绑名录（仅去掉关联，不删手写医院名）。
          </div>
        </el-form-item>
        <el-form-item label="导诊回电">
          <el-input v-model="editForm.callbackContactPhone" placeholder="客户预留、客服回访号码" maxlength="32" clearable />
        </el-form-item>
        <el-form-item label="就诊医院">
          <el-input v-model="editForm.hospital" placeholder="请输入或由上名录同步" />
        </el-form-item>
        <el-form-item label="就诊科室">
          <el-input v-model="editForm.department" placeholder="请输入就诊科室" />
        </el-form-item>
        <el-form-item label="服务开始时间">
          <el-date-picker v-model="editForm.serviceTime" type="datetime" placeholder="选择开始时间" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="服务结束时间">
          <el-date-picker
            v-model="editForm.serviceEndTime"
            type="datetime"
            placeholder="可选"
            style="width: 100%;"
            clearable
          />
        </el-form-item>
        <el-form-item label="是否需要陪诊员">
          <el-radio-group v-model="editForm.needAttendant">
            <el-radio :value="true">需要</el-radio>
            <el-radio :value="false">不需要</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serviceEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="serviceEditSaving" @click="handleServiceSave">保存服务信息</el-button>
      </template>
    </el-dialog>

    <!-- 设置费用对话框 -->
    <el-dialog v-model="feeEditDialogVisible" title="费用与结算" width="760px" destroy-on-close>
      <div style="margin-bottom: 14px; color: #606266; font-size: 13px; line-height: 1.7;">
        维护费用明细、陪诊员收入，以及订单的结算和付款状态。
      </div>
      <el-form :model="editForm" label-width="110px">
        <el-form-item label="基础服务费">
          <el-input-number v-model="editForm.baseFee" :precision="2" :step="50" :min="0" placeholder="请输入基础服务费" style="width: 100%;" />
        </el-form-item>
        <el-form-item v-if="editForm.serviceType === '体检预约' && editForm.checkupOptionalItems.length" label="体检附加项目">
          <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
            <div style="padding: 12px 14px; border-radius: 8px; background: #f0f9ff; color: #303133;">
              当前已选 {{ editForm.checkupOptionalItems.length }} 项，合计 ¥{{ editCheckupOptionalTotal.toFixed(2) }}
            </div>
            <div
              v-for="item in editForm.checkupOptionalItems"
              :key="item.id"
              style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #ebeef5;border-radius:8px;"
            >
              <span>{{ item.name }}</span>
              <strong>¥{{ Number(item.price || 0).toFixed(2) }}</strong>
            </div>
            <div style="font-size: 12px; color: #909399;">
              体检附加项目按原订单明细计费，如需调整项目内容，请先核对对应服务单。
            </div>
          </div>
        </el-form-item>
        <el-form-item label="附加服务项">
          <div class="additional-service-list">
            <div
              v-for="(item, index) in editForm.additionalServiceItems"
              :key="item.id"
              class="additional-service-item"
            >
              <div class="additional-service-item__toolbar">
                <el-tag size="small" type="info">附加项 {{ index + 1 }}</el-tag>
                <el-button type="danger" link @click="removeAdditionalServiceItem(index)">删除</el-button>
              </div>
              <div class="additional-service-item__grid">
                <div class="additional-service-item__field additional-service-item__field--wide">
                  <div class="additional-service-item__label">费用分类</div>
                  <el-select
                    v-model="item.selection"
                    placeholder="选择增值服务或附加服务"
                    style="width: 100%;"
                    @change="(value: string) => handleAdditionalServiceSelectionChange(item, value)"
                  >
                    <el-option-group
                      v-for="group in additionalServiceSelectGroups"
                      :key="group.label"
                      :label="group.label"
                    >
                      <el-option
                        v-for="option in group.options"
                        :key="option.value"
                        :label="option.value === ADDITIONAL_CUSTOM_VALUE ? option.label : `${option.label}（¥${Number(option.fee).toFixed(2)}）`"
                        :value="option.value"
                      />
                    </el-option-group>
                  </el-select>
                </div>
                <div class="additional-service-item__field additional-service-item__field--wide">
                  <div class="additional-service-item__label">费用名称</div>
                  <el-input
                    v-if="item.selection === ADDITIONAL_CUSTOM_VALUE"
                    v-model="item.customName"
                    placeholder="填写其他附加费用名称"
                  />
                  <el-input
                    v-else
                    :model-value="item.selection || '请先选择费用项'"
                    disabled
                  />
                </div>
                <div class="additional-service-item__field additional-service-item__field--amount">
                  <div class="additional-service-item__label">金额</div>
                  <el-input-number
                    v-model="item.amount"
                    :precision="2"
                    :step="10"
                    :min="0"
                    :disabled="item.selection !== ADDITIONAL_CUSTOM_VALUE"
                    style="width: 100%;"
                  />
                </div>
                <div class="additional-service-item__field">
                  <div class="additional-service-item__label">备注</div>
                  <el-input v-model="item.note" placeholder="备注说明（选填）" />
                </div>
              </div>
            </div>
            <div class="additional-service-footer">
              <el-button type="primary" link @click="addAdditionalServiceItem">
                <el-icon><Plus /></el-icon> 添加附加服务项
              </el-button>
              <span style="font-size: 13px; color: #909399;">
                附加服务合计：<strong style="color:#303133;">¥{{ editAdditionalServiceTotal.toFixed(2) }}</strong>
              </span>
            </div>
            <div class="additional-service-tip">
              可从预设费用项直接选择；如现场临时收费，也可选“其他附加费用”手动填写。
            </div>
          </div>
        </el-form-item>
        <el-form-item label="总费用">
          <div style="width: 100%; padding: 12px 14px; border-radius: 8px; background: #f5f7fa; color: #303133; font-weight: 600;">
            自动累计：基础服务费 ¥{{ Number(editForm.baseFee || 0).toFixed(2) }} + 体检附加项目 ¥{{ editCheckupOptionalTotal.toFixed(2) }} + 附加服务费 ¥{{ editAdditionalServiceTotal.toFixed(2) }} = ¥{{ editComputedTotalFee.toFixed(2) }}
          </div>
        </el-form-item>
        <el-form-item label="陪诊员此单收入">
          <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
            <el-select
              v-model="editForm.attendantFeeType"
              placeholder="选择费用类型"
              filterable
              style="width: 100%;"
              @change="(v: string) => onFeeTypeChange('edit', v)"
            >
              <el-option
                v-for="o in ATTENDANT_FEE_OPTIONS"
                :key="o.label"
                :label="o.label === '自定义金额' ? o.label : `${o.label} — ¥${o.fee}`"
                :value="o.label"
              />
            </el-select>
            <el-input-number
              v-if="editForm.attendantFeeType === '自定义金额'"
              v-model="editForm.attendantFee"
              :min="0"
              :precision="2"
              style="width: 100%;"
              placeholder="输入金额"
            />
            <div style="font-size: 12px; color: #909399;">
              基础收入：<strong style="color: #67c23a;">¥{{ Number(editForm.attendantFee || 0).toFixed(2) }}</strong>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="附加收入项">
          <div class="additional-service-list">
            <div
              v-for="(item, index) in editForm.attendantExtraIncomeItems"
              :key="item.id"
              class="additional-service-item"
            >
              <div class="additional-service-item__toolbar">
                <el-tag size="small" type="success">收入项 {{ index + 1 }}</el-tag>
                <el-button type="danger" link @click="removeAttendantExtraIncomeItem(index)">删除</el-button>
              </div>
              <div class="additional-service-item__grid">
                <div class="additional-service-item__field additional-service-item__field--wide">
                  <div class="additional-service-item__label">收入分类</div>
                  <el-select
                    v-model="item.selection"
                    placeholder="选择陪诊员附加收入项"
                    style="width: 100%;"
                    @change="(value: string) => handleAttendantIncomeSelectionChange(item, value)"
                  >
                    <el-option-group
                      v-for="group in attendantIncomeSelectGroups"
                      :key="group.label"
                      :label="group.label"
                    >
                      <el-option
                        v-for="option in group.options"
                        :key="option.value"
                        :label="option.value === ATTENDANT_INCOME_CUSTOM_VALUE ? option.label : `${option.label}（¥${Number(option.fee).toFixed(2)}）`"
                        :value="option.value"
                      />
                    </el-option-group>
                  </el-select>
                </div>
                <div class="additional-service-item__field additional-service-item__field--wide">
                  <div class="additional-service-item__label">收入名称</div>
                  <el-input
                    v-if="item.selection === ATTENDANT_INCOME_CUSTOM_VALUE"
                    v-model="item.customName"
                    placeholder="填写其他收入名称"
                  />
                  <el-input
                    v-else
                    :model-value="item.selection || '请先选择收入项'"
                    disabled
                  />
                </div>
                <div class="additional-service-item__field additional-service-item__field--amount">
                  <div class="additional-service-item__label">金额</div>
                  <el-input-number
                    v-model="item.amount"
                    :precision="2"
                    :step="10"
                    :min="0"
                    :disabled="item.selection !== ATTENDANT_INCOME_CUSTOM_VALUE"
                    style="width: 100%;"
                  />
                </div>
                <div class="additional-service-item__field">
                  <div class="additional-service-item__label">备注</div>
                  <el-input v-model="item.note" placeholder="备注说明（选填）" />
                </div>
              </div>
            </div>
            <div class="additional-service-footer">
              <div style="display: flex; align-items: center; gap: 12px;">
                <el-button type="primary" link @click="addAttendantExtraIncomeItem">
                  <el-icon><Plus /></el-icon> 添加附加收入项
                </el-button>
                <el-button type="warning" link @click="addCustomAttendantExtraIncomeItem">
                  其他收入
                </el-button>
              </div>
              <span style="font-size: 13px; color: #909399;">
                附加收入合计：<strong style="color:#303133;">¥{{ editAttendantExtraIncomeTotal.toFixed(2) }}</strong>
              </span>
            </div>
            <div class="additional-service-tip">
              附加收入项会一并计入陪诊员此单收入，可直接复用服务定价中的陪诊员费用，也可通过“其他收入”手动填写。
            </div>
          </div>
        </el-form-item>
        <el-form-item label="陪诊员总收入">
          <div style="width: 100%; padding: 12px 14px; border-radius: 8px; background: #f6ffed; color: #303133; font-weight: 600;">
            自动累计：基础收入 ¥{{ Number(editForm.attendantFee || 0).toFixed(2) }} + 附加收入 ¥{{ editAttendantExtraIncomeTotal.toFixed(2) }} = ¥{{ editComputedAttendantFee.toFixed(2) }}
          </div>
        </el-form-item>
        <el-divider content-position="left">结算与付款</el-divider>
        <el-form-item label="结算状态">
          <el-radio-group v-model="editForm.settlementStatus">
            <el-radio-button value="pending">待结算</el-radio-button>
            <el-radio-button value="settled">已结算</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="付款状态">
          <el-radio-group v-model="editForm.paymentStatus">
            <el-radio-button value="unpaid">未付款</el-radio-button>
            <el-radio-button value="paid">已付款</el-radio-button>
            <el-radio-button value="refunded">已退款</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editForm.paymentStatus === 'paid'" label="付款方式">
          <el-select v-model="editForm.paymentMethod" placeholder="选择付款方式" clearable style="width:100%;">
            <el-option label="微信转账" value="wechat" />
            <el-option label="支付宝转账" value="alipay" />
            <el-option label="收款码转账" value="qr_transfer" />
            <el-option label="银行卡转账" value="bank_transfer" />
            <el-option label="现金" value="cash" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="财务备注">
          <el-input v-model="editForm.settlementRemark" type="textarea" :rows="2" placeholder="财务备注（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feeEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="feeEditSaving" @click="handleFeeSave">保存费用与结算</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="completionEditDialogVisible" title="编辑服务结束汇总" width="860px" destroy-on-close>
      <div class="completion-editor">
        <el-alert
          :closable="false"
          type="info"
          show-icon
          :title="`后台可在这里补录或修正服务结束汇总；陪诊员端补齐时限已调整为 ${COMPLETION_EDITABLE_DAYS} 天。`"
        />

        <el-form label-width="110px" style="margin-top: 16px;">
          <el-form-item label="诊断结果">
            <el-input
              v-model="completionForm.diagnosisResult"
              type="textarea"
              :rows="2"
              maxlength="300"
              show-word-limit
              placeholder="可选：补充本次诊断结果"
            />
          </el-form-item>

          <el-form-item label="医生嘱托">
            <el-input
              v-model="completionForm.doctorAdvice"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
              placeholder="可选：补充医生嘱托或注意事项"
            />
          </el-form-item>

          <el-form-item label="服务总结">
            <el-input
              v-model="completionForm.summary"
              type="textarea"
              :rows="4"
              maxlength="1200"
              show-word-limit
              placeholder="请填写本次陪诊结果、医生建议和后续注意事项"
            />
          </el-form-item>

          <el-form-item label="复诊安排">
            <div class="completion-editor__follow-up">
              <el-date-picker
                v-model="completionForm.followUpDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="复诊日期"
                style="width: 220px;"
              />
              <el-input v-model="completionForm.followUpHospital" placeholder="复诊医院" />
              <el-input v-model="completionForm.followUpDepartment" placeholder="复诊科室" />
            </div>
          </el-form-item>

          <el-form-item label="复诊备注">
            <el-input
              v-model="completionForm.followUpNote"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
              placeholder="可选：补充复诊注意事项"
            />
          </el-form-item>

          <el-form-item label="用药提醒">
            <div class="completion-editor__medication">
              <div class="completion-editor__medication-toolbar">
                <el-radio-group
                  :model-value="completionForm.medicationMode"
                  @change="handleCompletionMedicationModeChange"
                >
                  <el-radio-button label="none">本次无需提醒</el-radio-button>
                  <el-radio-button label="has">需要登记提醒</el-radio-button>
                </el-radio-group>
                <el-button link @click="handleCompletionMedicationModeChange('')">重置</el-button>
              </div>

              <div v-if="completionForm.medicationMode === 'has'" class="completion-medication-list">
                <div
                  v-for="(item, index) in completionForm.medications"
                  :key="item.id"
                  class="completion-medication-item"
                >
                  <div class="completion-medication-item__toolbar">
                    <span>用药记录 {{ index + 1 }}</span>
                    <el-button type="danger" link @click="removeCompletionMedication(index)">删除</el-button>
                  </div>
                  <div class="completion-medication-item__grid">
                    <el-input v-model="item.name" placeholder="药品名称" />
                    <el-input v-model="item.usage" placeholder="用法用量" />
                    <el-time-picker
                      v-model="item.reminderTime"
                      value-format="HH:mm"
                      format="HH:mm"
                      placeholder="提醒时间"
                      style="width: 100%;"
                    />
                    <el-date-picker
                      v-model="item.startDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="开始日期"
                      style="width: 100%;"
                    />
                    <el-date-picker
                      v-model="item.endDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="结束日期"
                      style="width: 100%;"
                    />
                  </div>
                </div>
                <el-button type="primary" link @click="addCompletionMedication">
                  <el-icon><Plus /></el-icon> 添加用药记录
                </el-button>
              </div>

              <div v-else class="completion-editor__medication-hint">
                {{ completionForm.medicationMode === 'none' ? '已确认本次无需新增用药提醒。' : '请选择是否需要登记用药提醒。' }}
              </div>
            </div>
          </el-form-item>

          <el-form-item label="图片凭证">
            <div class="completion-upload-panel">
              <input
                ref="completionImageInputRef"
                type="file"
                accept="image/*"
                multiple
                style="display: none;"
                @change="handleCompletionImageUpload"
              />
              <div class="completion-upload-panel__toolbar">
                <el-button :loading="completionImageUploading" @click="completionImageInputRef?.click()">上传图片</el-button>
                <span class="completion-upload-panel__hint">至少上传 1 份，建议体检单、化验单、检查报告、处方或票据等凭证。</span>
              </div>
              <div v-if="completionForm.images.length" class="completion-upload-panel__images">
                <div
                  v-for="(item, index) in completionForm.images"
                  :key="`completion-image-${index}`"
                  class="completion-upload-panel__image"
                >
                  <el-image
                    :src="getTimelineAssetUrl(item.url)"
                    fit="cover"
                    :preview-src-list="completionForm.images.map(image => getTimelineAssetUrl(image.url))"
                  />
                  <div class="completion-upload-panel__image-actions">
                    <el-button type="danger" link @click="removeCompletionImage(index)">删除</el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="补充附件">
            <div class="completion-upload-panel">
              <input
                ref="completionFileInputRef"
                type="file"
                multiple
                style="display: none;"
                @change="handleCompletionFileUpload"
              />
              <div class="completion-upload-panel__toolbar">
                <el-button :loading="completionFileUploading" @click="completionFileInputRef?.click()">上传附件</el-button>
                <span class="completion-upload-panel__hint">可上传 PDF、Word、Excel 等补充材料。</span>
              </div>
              <div v-if="completionForm.files.length" class="completion-upload-panel__files">
                <div
                  v-for="(file, index) in completionForm.files"
                  :key="`completion-file-${index}`"
                  class="completion-upload-panel__file"
                >
                  <div class="completion-upload-panel__file-name">📄 {{ file.name }}</div>
                  <div class="completion-upload-panel__file-actions">
                    <el-button type="primary" link @click="openCompletionAttachment(file)">预览</el-button>
                    <el-button type="danger" link @click="removeCompletionFile(index)">删除</el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="补齐状态">
            <div class="completion-editor__status">
              <el-tag :type="completionDraftState.summaryReady ? 'success' : 'warning'">服务总结</el-tag>
              <el-tag :type="completionDraftState.proofReady ? 'success' : 'warning'">单据凭证</el-tag>
              <el-tag :type="completionDraftState.medicationReady ? 'success' : 'warning'">用药提醒</el-tag>
              <el-tag :type="completionDraftState.ready ? 'success' : 'info'">
                {{ completionDraftState.ready ? '必填资料已补齐' : `当前还缺：${completionDraftState.missingItems.join('、') || '待完善'}` }}
              </el-tag>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="completionEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="completionSaving" @click="handleCompletionSave">保存服务结束汇总</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="serviceConfirmPreviewVisible"
      title="陪诊服务确认单 · 在线预览"
      width="920px"
      top="4vh"
      destroy-on-close
      @closed="onServiceConfirmPreviewClosed"
    >
      <div class="service-confirm-preview">
        <iframe
          v-if="serviceConfirmPreviewSrc"
          ref="serviceConfirmIframeRef"
          :src="serviceConfirmPreviewSrc"
          class="service-confirm-preview__frame"
          title="陪诊服务确认单"
        />
        <div v-else class="service-confirm-preview__placeholder">加载中…</div>
      </div>
      <template #footer>
        <el-button @click="serviceConfirmPreviewVisible = false">关闭</el-button>
        <el-button
          :disabled="!serviceConfirmPreviewSrc"
          @click="openServiceConfirmPreviewInNewWindow"
        >
          新窗口打开
        </el-button>
        <el-button
          type="primary"
          :disabled="!serviceConfirmPreviewSrc"
          @click="printServiceConfirmIframe"
        >
          打印
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="timelinePreviewVisible"
      :title="`附件预览 · ${timelinePreviewTitle || '时间线附件'}`"
      width="1100px"
      top="4vh"
      destroy-on-close
      @closed="handleTimelinePreviewClosed"
    >
      <div v-loading="timelinePreviewLoading" class="timeline-preview">
        <iframe
          v-if="timelinePreviewMode === 'pdf' && timelinePreviewBlobUrl"
          :src="timelinePreviewBlobUrl"
          class="timeline-preview__frame"
        />
        <div
          v-else-if="timelinePreviewMode === 'docx'"
          ref="timelinePreviewContainerRef"
          class="timeline-preview__docx"
        ></div>
        <div v-else class="timeline-preview__fallback">
          <div class="timeline-preview__fallback-title">该附件已准备好</div>
          <div class="timeline-preview__fallback-desc">
            {{ timelinePreviewHint || '当前格式暂不支持页面内嵌预览，可直接在新窗口打开。' }}
          </div>
          <el-button type="primary" @click="openTimelineDocumentInNewTab">新窗口打开</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="timelinePreviewVisible = false">关闭</el-button>
        <el-button
          v-if="timelinePreviewBlobUrl"
          type="primary"
          @click="openTimelineDocumentInNewTab"
        >
          新窗口打开
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped lang="scss">
/* —— 订单详情 Tabs —— */
.order-detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

/* —— 页头状态标签 —— */
.page-title__tag {
  margin-left: 12px;
  vertical-align: middle;
  font-weight: 500;
}

/* —— 履约控制台：三栏登高齐 —— */
.fc-top-grid {
  align-items: stretch;
}
.fc-top-grid :deep(.el-col) {
  display: flex;
  margin-bottom: 16px;
}
.fc-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--el-border-color-light);
  background: #fff;
  transition: box-shadow 0.2s ease;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  }
}
.fc-panel :deep(.el-card__header) {
  padding: 14px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.fc-panel :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
}
.fc-panel__head {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  letter-spacing: 0.01em;
}
.fc-panel__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.fc-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

/* —— KV 字段令牌：label 在上,value 在下 —— */
.kv-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.kv-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.02em;
  line-height: 1.4;
}
.kv-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  line-height: 1.5;
  word-break: break-word;
}
.kv-value--strong {
  font-size: 15px;
  font-weight: 600;
}
.kv-value--big {
  font-size: 16px;
  font-weight: 700;
}
.kv-value--accent {
  color: var(--el-color-primary);
  font-weight: 600;
}
.kv-value--muted {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
.kv-row-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* —— 工具区 Collapse —— */
.fc-tools {
  margin-top: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}
.fc-tools :deep(.el-collapse-item__header) {
  padding: 0 18px;
  height: 52px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: #fafbfc;
}
.fc-tools :deep(.el-collapse-item__content) {
  padding: 16px 18px 20px;
  color: var(--el-text-color-regular);
}
.fc-tools :deep(.el-collapse-item:last-child .el-collapse-item__header) {
  border-bottom: none;
}
.fc-tools :deep(.el-collapse-item.is-active:last-child .el-collapse-item__header) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.fc-tool-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.fc-tool-title-badge {
  margin-left: 10px;
  font-weight: 500;
}

.fc-tool-lead {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
  margin: 0 0 12px;
}
.fc-tool-signed {
  font-size: 13px;
  color: var(--el-color-success);
  line-height: 1.7;
  margin: 0 0 12px;
}
.fc-tool-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.fc-tool-qr {
  width: 220px;
  height: 220px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}
.fc-tool-qr-wrap {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.fc-tool-qr-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  text-align: center;
}
.fc-tool-path-wrap {
  flex: 1;
  min-width: 260px;
}
.fc-tool-live-grid {
  font-size: 14px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}
.fc-tool-live-grid__meta {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.fc-tool-muted {
  color: var(--el-text-color-secondary);
}

/* —— 保留：服务结束汇总、确认单 legacy 类名兼容 —— */
.fc-doc-card {
  margin-top: 16px;
}
.fc-doc-card__lead {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
  margin: 0 0 12px;
}
.fc-doc-card__signed {
  font-size: 13px;
  color: var(--el-color-success);
  line-height: 1.7;
  margin: 0 0 12px;
}
.fc-doc-card__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.fc-mp-card {
  margin-top: 16px;
}
.fc-mp-card__header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.fc-actions-card {
  margin-top: 16px;
}

.additional-service-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.additional-service-item {
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  background: #fafbfd;
  padding: 14px 16px;
}

.additional-service-item__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.additional-service-item__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.3fr) 180px minmax(0, 1fr);
  gap: 12px;
}

.additional-service-item__field {
  min-width: 0;
}

.additional-service-item__label {
  margin-bottom: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1;
}

.additional-service-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.additional-service-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.completion-editor {
  padding-bottom: 4px;
}

.completion-editor__follow-up {
  width: 100%;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.completion-editor__medication {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.completion-editor__medication-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.completion-editor__medication-hint {
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.completion-medication-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.completion-medication-item {
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  background: #fafbfd;
  padding: 14px 16px;
}

.completion-medication-item__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.completion-medication-item__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.completion-upload-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.completion-upload-panel__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.completion-upload-panel__hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.completion-upload-panel__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.completion-upload-panel__image {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  padding: 10px;
}

.completion-upload-panel__image :deep(.el-image) {
  width: 100%;
  height: 140px;
  display: block;
  overflow: hidden;
  border-radius: 8px;
}

.completion-upload-panel__image-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.completion-upload-panel__files {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.completion-upload-panel__file {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  background: #fff;
}

.completion-upload-panel__file-name {
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
}

.completion-upload-panel__file-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.completion-editor__status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.service-confirm-preview {
  min-height: 72vh;
}

.service-confirm-preview__frame {
  width: 100%;
  height: 72vh;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
}

.service-confirm-preview__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72vh;
  color: #909399;
  font-size: 14px;
}

.timeline-preview {
  min-height: 70vh;
}

.timeline-preview__frame {
  width: 100%;
  height: 70vh;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
}

.timeline-preview__docx {
  min-height: 70vh;
  overflow: auto;
  padding: 24px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #f5f7fa;
}

.timeline-preview__docx :deep(.docx-wrapper) {
  padding: 0;
  background: transparent;
}

.timeline-preview__docx :deep(section.docx) {
  margin: 0 auto 24px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.12);
}

.timeline-preview__fallback {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.timeline-preview__fallback-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.timeline-preview__fallback-desc {
  max-width: 520px;
  color: #606266;
  line-height: 1.8;
}

.customer-service-card {
  border-radius: 12px;
  max-width: 860px;
}

.customer-service-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.customer-service-card__main {
  flex: 1;
  min-width: 220px;
}

.customer-service-card__tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.customer-service-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.4;
}

.customer-service-card__summary {
  margin-top: 4px;
  color: #4b5563;
  line-height: 1.6;
  font-size: 13px;
}

.customer-service-card__actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.customer-service-card__meta {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.customer-service-card__meta-item {
  min-width: 150px;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-service-card__meta-label {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.2;
}

.customer-service-card__meta-value {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.customer-service-card__note {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fff7ed;
  border-radius: 10px;
  color: #9a3412;
  line-height: 1.6;
  font-size: 13px;
}

.timeline-transcription {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f1f8f2 0%, #e8f5e9 100%);
  border: 1px solid rgba(46, 134, 240, 0.2);
}

.timeline-transcription__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.timeline-transcription__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #5b21b6;
}

.timeline-transcription__body,
.timeline-transcription__editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-transcription__text {
  white-space: pre-wrap;
  line-height: 1.7;
  color: #374151;
  font-size: 13px;
}

.timeline-transcription__error {
  color: #dc2626;
  font-size: 12px;
  line-height: 1.6;
}

.timeline-transcription__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 1200px) {
  .additional-service-item__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .completion-editor__follow-up {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .completion-medication-item__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customer-service-card {
    max-width: 100%;
  }

  .customer-service-card__meta-item {
    min-width: calc(50% - 8px);
  }
}

@media (max-width: 768px) {
  .completion-editor__follow-up,
  .completion-medication-item__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .completion-upload-panel__toolbar,
  .completion-medication-item__toolbar,
  .completion-editor__medication-toolbar {
    align-items: flex-start;
  }
}
</style>
