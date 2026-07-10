<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCustomerDetail, getServiceTargets, createServiceTarget, updateCustomer, getCustomerDocuments, updateUserRole } from '@/api/customer'
import { getOrderList, getHealthSignQrcode } from '@/api/order'
import { getUserMembership, updateUserMembership, grantAnnualCard, revokeAnnualCard } from '@/api/membership'
import { getReminders, createReminder, updateReminder, deleteReminder } from '@/api/medication-reminder'
import { getMedicationDosageDictionary } from '@/api/system'

import { get, put, del, post } from '@/api/request'
import { backfillFamilyMembers, getFamilyInviteQrcode, getWeeklyReportsForUser } from '@/api/family'
import { orderStatusMap, formatDate, formatMoney } from '@/utils/format'
import { API_BASE_URL } from '@/config/api-base'
import { pcaTextArr } from 'element-china-area-data'
import { useUserStore } from '@/stores/user'
import FamilyMemberProfile from './components/family-member-profile.vue'

const userStore = useUserStore()
const isSuperAdmin = computed(() => (userStore.userInfo as any)?.role === 'admin')
const PROFILE_DOC_CACHE_TTL = 20 * 60 * 1000
const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string
const activeTab = ref('orders')
const loading = ref(false)

const customer = ref<any>(null)
const serviceTargets = ref<any[]>([])
const orders = ref<any[]>([])
const reminders = ref<any[]>([])
const followUpReminders = ref<any[]>([])
const fulfillmentDocs = ref<any[]>([])

// ── 服务对象筛选 ──
// null = 全部；数字 = 选中的 serviceTargetId
const selectedTargetId = ref<number | null>(null)

const selectedTarget = computed(() =>
  selectedTargetId.value == null ? null : serviceTargets.value.find(t => t.id === selectedTargetId.value) || null
)

function selectTarget(id: number | null) {
  selectedTargetId.value = id
  if (activeTab.value === 'documents') return
  if (activeTab.value === 'families') return
  if (activeTab.value !== 'reminders') activeTab.value = 'orders'
}

// ── 按服务对象过滤 ──
const filteredOrders = computed(() => {
  if (selectedTargetId.value == null) return orders.value
  return orders.value.filter(o => o.serviceTargetId === selectedTargetId.value || o.serviceTarget?.id === selectedTargetId.value)
})

const filteredReminders = computed(() => {
  if (selectedTargetId.value == null) return reminders.value
  return reminders.value.filter(r => r.serviceTargetId === selectedTargetId.value || r.serviceTarget?.id === selectedTargetId.value)
})

const filteredFollowUpReminders = computed(() => {
  if (selectedTargetId.value == null) return followUpReminders.value
  return followUpReminders.value.filter(r => r.serviceTargetId === selectedTargetId.value || r.serviceTarget?.id === selectedTargetId.value)
})

const customerServiceTimelineItems = computed(() => {
  const medicationItems = filteredReminders.value.map((item: any) => {
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

  const followUpItems = filteredFollowUpReminders.value.map((item: any) => {
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

const filteredFulfillmentDocs = computed(() => {
  if (selectedTargetId.value == null) return fulfillmentDocs.value
  return fulfillmentDocs.value.filter((doc) => {
    const targetId = doc.order?.serviceTargetId || doc.order?.serviceTarget?.id
    return targetId === selectedTargetId.value
  })
})

// ── 活跃订单统计（全量，用于侧边栏数字） ──
const activeOrders = computed(() => filteredOrders.value.filter(o => !['completed','canceled'].includes(o.status)))
const activeReminders = computed(() => filteredReminders.value.filter(r => r.status === 'active'))
const activeFollowUpReminders = computed(() => filteredFollowUpReminders.value.filter(r => r.status === 'active'))

// ── 预览 ──
const profilePreviewVisible = ref(false)
const profilePreviewUrl = ref('')
const profilePreviewTitle = ref('')
const healthProfileDocCache = reactive<Record<number, { url: string; fileName: string; fetchedAt: number }>>({})

// ── 会员 ──
const membership = ref<any>(null)
const membershipDialogVisible = ref(false)
const membershipForm = ref({ isAnnual: false, startDate: '', expireDate: '', balanceDelta: 0 })
const membershipSaving = ref(false)

// ── 角色管理 ──
const roleDialogVisible = ref(false)
const roleSaving = ref(false)
const roleForm = ref({ role: '' })

const roleOptions = [
  { value: 'user', label: '普通客户' },
  { value: 'admin', label: '超级管理员' },
  { value: 'operator', label: '运营人员' },
  { value: 'finance', label: '财务人员' },
  { value: 'customer_service', label: '客服人员' },
  { value: 'medical_consultant', label: '医疗顾问' },
  { value: 'attendant', label: '陪诊员' },
]

const roleLabel = computed(() => {
  const r = roleOptions.find(opt => opt.value === customer.value?.role)
  return r ? r.label : (customer.value?.role || '普通客户')
})

const isAdminRole = computed(() =>
  ['admin', 'operator', 'finance', 'customer_service', 'medical_consultant'].includes(customer.value?.role)
)

function openRoleDialog() {
  roleForm.value.role = customer.value?.role || 'user'
  roleDialogVisible.value = true
}

async function saveRole() {
  if (!roleForm.value.role) { return }
  roleSaving.value = true
  try {
    await updateUserRole(Number(customerId), roleForm.value.role)
    ElMessage.success('角色已更新')
    roleDialogVisible.value = false
    loadData()
  } catch {
    // 错误 Toast 由全局请求拦截器统一处理，此处不重复弹出
  } finally { roleSaving.value = false }
}

// ── 创建服务对象 ──
const profileDialogVisible = ref(false)
const profileSaving = ref(false)

// ── 编辑客户基本信息 ──
const editCustomerDialogVisible = ref(false)
const editCustomerSaving = ref(false)
const editCustomerForm = ref({ nickname: '', phone: '' })

// ── 健康档案全字段编辑 ──
const healthEditVisible = ref(false)
const healthEditSaving = ref(false)
const healthEditTargetId = ref<number | null>(null)
const healthEditTargetName = ref('')

// ── 服务对象基本信息编辑 ──
const basicEditVisible = ref(false)
const basicEditSaving = ref(false)
const basicEditTargetId = ref<number | null>(null)
const basicEditForm = reactive({
  name: '', idCard: '', idCardAge: undefined as number | undefined, idCardBirth: '',
  gender: '', phone: '', relationship: '',
})

function parseIdCardForAdmin(id: string): { birthDate: string; age: number; gender: string } | null {
  if (!/^\d{17}[\dX]$/i.test(id.trim())) return null
  const s = id.trim()
  const year = s.slice(6, 10), month = s.slice(10, 12), day = s.slice(12, 14)
  const birth = new Date(`${year}-${month}-${day}`)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  const genderCode = s.charAt(16)
  const gender = parseInt(genderCode, 10) % 2 === 1 ? 'male' : 'female'
  return { birthDate: `${year}-${month}-${day}`, age: Math.max(0, age), gender }
}

function onBasicIdCardInput(val: string) {
  basicEditForm.idCard = val
  const parsed = parseIdCardForAdmin(val)
  if (parsed) {
    basicEditForm.idCardAge = parsed.age
    basicEditForm.idCardBirth = parsed.birthDate
    basicEditForm.gender = parsed.gender
  } else {
    basicEditForm.idCardAge = undefined
    basicEditForm.idCardBirth = ''
  }
}

function openBasicEditDialog(target: any) {
  basicEditTargetId.value = target.id
  const hp = parseHealthProfile(target) || {}
  Object.assign(basicEditForm, {
    name: target.name || '',
    idCard: target.idCard || '',
    gender: target.gender || '',
    phone: target.phone || '',
    relationship: hp.relationship || target.relationship || '',
    idCardAge: target.age,
    idCardBirth: hp.birthDate || '',
  })
  basicEditVisible.value = true
}

async function saveBasicInfo() {
  if (!basicEditTargetId.value) return
  if (!basicEditForm.name?.trim()) { ElMessage.warning('请输入姓名'); return }
  if (!basicEditForm.idCard?.trim()) { ElMessage.warning('请输入身份证号'); return }
  if (!/^\d{17}[\dX]$/i.test(basicEditForm.idCard.trim())) { ElMessage.warning('请输入正确的18位身份证号'); return }
  if (!basicEditForm.phone?.trim()) { ElMessage.warning('请输入联系电话'); return }
  if (!basicEditForm.gender) { ElMessage.warning('请选择性别'); return }
  if (!basicEditForm.relationship) { ElMessage.warning('请选择与客户关系'); return }
  basicEditSaving.value = true
  try {
    const parsed = parseIdCardForAdmin(basicEditForm.idCard)
    const existTarget = serviceTargets.value.find(t => t.id === basicEditTargetId.value)
    const hp = parseHealthProfile(existTarget) || {}
    await put(`/users/service-targets/${basicEditTargetId.value}`, {
      name: basicEditForm.name.trim(),
      idCard: basicEditForm.idCard.trim(),
      gender: basicEditForm.gender,
      phone: basicEditForm.phone.trim(),
      age: parsed?.age,
      healthProfile: {
        ...hp,
        relationship: basicEditForm.relationship,
        relation: relationshipOptions.find(r => r.value === basicEditForm.relationship)?.label,
        ...(parsed ? { birthDate: parsed.birthDate } : {}),
      },
    })
    ElMessage.success('基本信息已保存')
    invalidateProfileDoc(basicEditTargetId.value)
    basicEditVisible.value = false
    loadData()
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally { basicEditSaving.value = false }
}

async function handleDeleteTarget(target: any) {
  try {
    await ElMessageBox.confirm(
      `确认删除家庭成员「${target.name}」？此操作将同步删除用户端的健康档案，且不可恢复。`,
      '删除家庭成员',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
  } catch { return }
  try {
    await del(`/users/service-targets/${target.id}`)
    ElMessage.success(`已删除家庭成员「${target.name}」`)
    invalidateProfileDoc(target.id)
    loadData()
  } catch {
    // 错误由全局请求拦截器统一弹出
  }
}

// ── 用药提醒 ──
const reminderDialogVisible = ref(false)
const reminderSaving = ref(false)
const editingReminderId = ref<number | null>(null)
const reminderForm = reactive({
  medicineName: '',
  dosage: '',
  instructions: '',
  reminderTimes: ['08:00'],
  startDate: '',
  endDate: '',
  frequency: 'daily',
  channel: 'all',
  status: 'active',
  serviceTargetId: undefined as number | undefined,
})

// ── 用药提醒剂量字典（来自 system_configs，由运营统一维护） ──
// 微信订阅消息「用药提醒」模板剂量字段是 short_thing7，硬限 5 字符，
// 所以管理员只能从字典下拉选择，避免手填超长导致推送被微信拒发。
const dosageOptions = ref<string[]>([])
const dosageFallback = ref('按医嘱')
const dosageMaxLength = ref(5)
async function loadDosageDictionary() {
  try {
    const res = await getMedicationDosageDictionary()
    dosageOptions.value = Array.isArray(res?.options) ? res.options : []
    dosageFallback.value = res?.fallback || '按医嘱'
    dosageMaxLength.value = res?.maxLength || 5
  } catch {
    // 接口异常时留空数组，下拉变不可用；hint 文案仍能提示用户
    dosageOptions.value = []
  }
}
// 当前编辑的 dosage 是否为老数据（不在字典白名单且非空）
const isLegacyDosage = computed(() => {
  const d = (reminderForm.dosage || '').trim()
  if (!d) return false
  if (!dosageOptions.value.length) return false
  return !dosageOptions.value.includes(d)
})

const followUpDialogVisible = ref(false)
const followUpSaving = ref(false)
const editingFollowUpReminderId = ref<number | null>(null)
const followUpForm = reactive({
  title: '复诊提醒',
  instructions: '',
  followUpDate: '',
  reminderTime: '09:00',
  hospital: '',
  department: '',
  channel: 'all',
  status: 'active',
  serviceTargetId: undefined as number | undefined,
})

const CHANNEL_LABEL: Record<string,string> = {
  mini_program: '小程序', all: '全部渠道',
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

function openReminderDialog() {
  editingReminderId.value = null
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  Object.assign(reminderForm, {
    medicineName: '', dosage: '', instructions: '', reminderTimes: ['08:00'],
    startDate: formatLocalDate(today), endDate: formatLocalDate(nextWeek), frequency: 'daily', channel: 'all', status: 'active',
    // 如果已选中某服务对象，自动预填
    serviceTargetId: selectedTargetId.value ?? undefined,
  })
  reminderDialogVisible.value = true
}

function addReminderTime() {
  if (reminderForm.reminderTimes.length < 6) reminderForm.reminderTimes.push('08:00')
}

function removeReminderTime(idx: number) {
  reminderForm.reminderTimes.splice(idx, 1)
}

async function handleCreateReminder() {
  if (!reminderForm.medicineName.trim()) { ElMessage.warning('请填写药品名称'); return }
  if (!reminderForm.startDate) { ElMessage.warning('请选择开始日期'); return }
  reminderSaving.value = true
  try {
    const payload = {
      userId: Number(customerId),
      medicineName: reminderForm.medicineName.trim(),
      dosage: reminderForm.dosage || undefined,
      instructions: reminderForm.instructions || undefined,
      frequency: reminderForm.frequency || 'daily',
      reminderTimes: reminderForm.reminderTimes.filter(Boolean),
      startDate: reminderForm.startDate,
      endDate: reminderForm.endDate || reminderForm.startDate,
      channel: reminderForm.channel,
      serviceTargetId: reminderForm.serviceTargetId || undefined,
    }
    if (editingReminderId.value) {
      await updateReminder(editingReminderId.value, {
        ...payload,
        status: reminderForm.status,
      })
    } else {
      await createReminder(payload)
    }
    ElMessage.success(editingReminderId.value ? '用药提醒已更新' : '用药提醒已创建')
    reminderDialogVisible.value = false
    loadReminders()
  } catch { ElMessage.error('创建失败') }
  finally { reminderSaving.value = false }
}

function openFollowUpDialog() {
  editingFollowUpReminderId.value = null
  Object.assign(followUpForm, {
    title: '复诊提醒',
    instructions: '',
    followUpDate: '',
    reminderTime: '09:00',
    hospital: '',
    department: '',
    channel: 'all',
    status: 'active',
    serviceTargetId: selectedTargetId.value ?? undefined,
  })
  followUpDialogVisible.value = true
}

async function handleCreateFollowUpReminder() {
  if (!followUpForm.title.trim()) { ElMessage.warning('请填写提醒标题'); return }
  if (!followUpForm.followUpDate) { ElMessage.warning('请选择复诊日期'); return }
  if (!followUpForm.hospital.trim()) { ElMessage.warning('请填写复诊医院'); return }
  if (!followUpForm.department.trim()) { ElMessage.warning('请填写复诊科室'); return }
  followUpSaving.value = true
  try {
    const payload = {
      userId: Number(customerId),
      medicineName: followUpForm.title.trim(),
      dosage: undefined,
      instructions: followUpForm.instructions || undefined,
      reminderTimes: [followUpForm.reminderTime || '09:00'],
      startDate: followUpForm.followUpDate,
      endDate: followUpForm.followUpDate,
      followUpHospital: followUpForm.hospital.trim(),
      followUpDepartment: followUpForm.department.trim(),
      channel: followUpForm.channel,
      status: followUpForm.status,
      serviceTargetId: followUpForm.serviceTargetId || undefined,
      frequency: 'once',
      reminderType: 'follow_up',
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
  } catch { ElMessage.error('创建失败') }
  finally { followUpSaving.value = false }
}

function openEditMedicationReminder(item: any) {
  editingReminderId.value = item.id
  Object.assign(reminderForm, {
    medicineName: item.medicineName || '',
    dosage: item.dosage || '',
    instructions: item.instructions || '',
    reminderTimes: Array.isArray(item.reminderTimes) && item.reminderTimes.length ? [...item.reminderTimes] : ['08:00'],
    startDate: typeof item.startDate === 'string' ? item.startDate.split('T')[0] || '' : '',
    endDate: typeof item.endDate === 'string' ? item.endDate.split('T')[0] || '' : '',
    frequency: item.frequency || 'daily',
    channel: item.channel || 'all',
    status: item.status || 'active',
    serviceTargetId: item.serviceTargetId || item.serviceTarget?.id || undefined,
  })
  reminderDialogVisible.value = true
}

function openEditFollowUpReminder(item: any) {
  editingFollowUpReminderId.value = item.id
  Object.assign(followUpForm, {
    title: item.medicineName || '复诊提醒',
    instructions: item.instructions || '',
    followUpDate: typeof item.startDate === 'string' ? item.startDate.split('T')[0] || '' : '',
    reminderTime: Array.isArray(item.reminderTimes) && item.reminderTimes.length ? item.reminderTimes[0] : '09:00',
    hospital: item.followUpHospital || '',
    department: item.followUpDepartment || '',
    channel: item.channel || 'all',
    status: item.status || 'active',
    serviceTargetId: item.serviceTargetId || item.serviceTarget?.id || undefined,
  })
  followUpDialogVisible.value = true
}

async function handleDeleteReminder(id: number) {
  try {
    await deleteReminder(id)
    ElMessage.success('已删除')
    loadReminders()
    loadFollowUpReminders()
  } catch { ElMessage.error('删除失败') }
}

async function loadReminders() {
  try {
    const res: any = await getReminders({ userId: Number(customerId), pageSize: 50, type: 'medication' })
    reminders.value = res.items || res || []
  } catch { reminders.value = [] }
}

async function loadFollowUpReminders() {
  try {
    const res: any = await getReminders({ userId: Number(customerId), pageSize: 50, type: 'follow_up' })
    followUpReminders.value = res.items || res || []
  } catch { followUpReminders.value = [] }
}

// ── 健康档案字段 ──
const medicalHistoryOptions = [
  { value: 'none', label: '无' }, { value: 'hypertension', label: '高血压' },
  { value: 'heart', label: '心脏病' }, { value: 'cerebrovascular', label: '脑血管疾病' },
  { value: 'diabetes', label: '糖尿病' }, { value: 'epilepsy', label: '癫痫' },
  { value: 'asthma', label: '哮喘/慢阻肺' }, { value: 'mental', label: '精神类疾病' },
  { value: 'cancer', label: '癌症' }, { value: 'other', label: '其他' },
]
const recentSymptomsOptions = [
  { value: 'none', label: '无明显症状' }, { value: 'syncope', label: '晕厥/眩晕/跌倒' },
  { value: 'chest_pain', label: '胸痛/胸闷/心慌' }, { value: 'dyspnea', label: '呼吸困难' },
  { value: 'fatigue', label: '乏力/疲劳' }, { value: 'pain', label: '持续性疼痛' },
  { value: 'insomnia', label: '失眠/睡眠障碍' }, { value: 'appetite_loss', label: '食欲下降' },
  { value: 'other', label: '其他' },
]
const bloodTypeOptions = ['A型', 'B型', 'AB型', 'O型', '不详']
const emergencyRelationOptions = ['配偶', '父母', '子女', '兄弟姐妹', '朋友', '护理人员', '其他']

/** 与文档模板 health-profile.ts 中「信息记录方式」一致 */
const fillMethodOptions = [
  { value: 'self', label: '本人自填' },
  { value: 'dictation', label: '本人口述代填' },
  { value: 'proxy', label: '家属代填' },
  { value: 'other', label: '其他' },
] as const
/** 与文档模板「行动能力」一致 */
const mobilityOptions = [
  { value: 'independent', label: '行动自如' },
  { value: 'mild_assist', label: '需轻度辅助' },
  { value: 'wheelchair', label: '需轮椅' },
  { value: 'bedridden', label: '卧床' },
] as const

const healthEditForm = reactive({
  fillMethod: 'self' as string,
  mobilityStatus: 'independent' as string,
  homeRegion: [] as string[],
  homeAddressDetail: '',
  bloodType: '', allergyStatus: 'none' as 'none' | 'has', allergies: '',
  medicalHistory: [] as string[], medicalHistoryOther: '',
  visionStatus: '', hearingStatus: '', recentSymptoms: [] as string[], recentSymptomsOther: '',
  chiefComplaint: '', emergencyContact: '', emergencyRelation: '', emergencyPhone: '',
  currentMedications: '', otherNotes: '',
})

function openHealthEditDialog(target: any) {
  const hp = parseHealthProfile(target) || {}
  healthEditTargetId.value = target.id
  healthEditTargetName.value = target.name
  const region = Array.isArray(hp.homeRegion) ? hp.homeRegion : []
  // 旧数据兼容：只有 target.homeAddress 而 healthProfile 里没拆分的省市区时，
  // 把原完整地址预填到"详细地址"字段，用户可在此基础上补选省/市/区。
  const fallbackDetail = !region.length && target.homeAddress ? String(target.homeAddress) : ''
  Object.assign(healthEditForm, {
    fillMethod: hp.fillMethod || 'self',
    mobilityStatus: hp.mobilityStatus || 'independent',
    homeRegion: region.slice(0, 3),
    homeAddressDetail: hp.homeAddressDetail || fallbackDetail,
    bloodType: hp.bloodType || '',
    allergyStatus: (hp.allergies && hp.allergies !== '无') ? 'has' : 'none',
    allergies: (hp.allergies && hp.allergies !== '无') ? hp.allergies : '',
    medicalHistory: hp.medicalHistory || [],
    medicalHistoryOther: hp.medicalHistoryOther || '',
    visionStatus: hp.visionStatus || '',
    hearingStatus: hp.hearingStatus || '',
    recentSymptoms: hp.recentSymptoms || [],
    recentSymptomsOther: hp.recentSymptomsOther || '',
    chiefComplaint: target.mainAppeal || '',
    emergencyContact: target.emergencyContact || '',
    emergencyRelation: hp.emergencyRelation || '',
    emergencyPhone: target.emergencyPhone || '',
    currentMedications: hp.currentMedications || hp.currentMedication || '',
    otherNotes: hp.otherHealthInfo || '',
  })
  healthEditVisible.value = true
}

async function saveHealthProfile() {
  if (!healthEditTargetId.value) return
  healthEditSaving.value = true
  try {
    const hp = parseHealthProfile(serviceTargets.value.find(t => t.id === healthEditTargetId.value)) || {}
    const regionArr = (healthEditForm.homeRegion || []).filter(Boolean)
    const detailAddr = (healthEditForm.homeAddressDetail || '').trim()
    const fullAddress = regionArr.length ? regionArr.join('') + (detailAddr ? ' ' + detailAddr : '') : detailAddr
    await put(`/users/service-targets/${healthEditTargetId.value}`, {
      emergencyContact: healthEditForm.emergencyContact,
      emergencyPhone: healthEditForm.emergencyPhone,
      mainAppeal: healthEditForm.chiefComplaint,
      homeAddress: fullAddress || undefined,
      signatureUrl: '',
      healthProfile: {
        ...hp,
        homeRegion: regionArr.length ? regionArr : undefined,
        homeAddressDetail: detailAddr || undefined,
        fillMethod: healthEditForm.fillMethod,
        mobilityStatus: healthEditForm.mobilityStatus,
        bloodType: healthEditForm.bloodType,
        allergies: healthEditForm.allergyStatus === 'none' ? '无' : (healthEditForm.allergies || ''),
        medicalHistory: healthEditForm.medicalHistory,
        medicalHistoryOther: healthEditForm.medicalHistoryOther,
        visionStatus: healthEditForm.visionStatus,
        hearingStatus: healthEditForm.hearingStatus,
        recentSymptoms: healthEditForm.recentSymptoms,
        recentSymptomsOther: healthEditForm.recentSymptomsOther,
        emergencyRelation: healthEditForm.emergencyRelation,
        currentMedication: healthEditForm.currentMedications,
        currentMedications: healthEditForm.currentMedications,
        otherHealthInfo: healthEditForm.otherNotes,
        signatureName: '',
        signedAt: '',
      },
    })
    ElMessage.success('健康档案已保存，已改为待用户在小程序签署')
    invalidateProfileDoc(healthEditTargetId.value)
    healthEditVisible.value = false
    loadData()
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally { healthEditSaving.value = false }
}

const MEDICAL_HISTORY_LABEL: Record<string, string> = {
  none: '无', hypertension: '高血压', heart: '心脏病', cerebrovascular: '脑血管疾病',
  diabetes: '糖尿病', epilepsy: '癫痫', asthma: '哮喘/慢阻肺',
  mental: '精神类疾病', cancer: '癌症', other: '其他',
}
const VISION_LABEL: Record<string, string> = { good: '正常', poor: '视力减退', blind: '严重视力障碍' }
const HEARING_LABEL: Record<string, string> = { good: '正常', poor: '听力减退', deaf: '严重听力障碍' }
const FILL_METHOD_LABEL: Record<string, string> = {
  self: '本人自填', dictation: '口述代填', proxy: '家属代填', other: '其他方式',
}
const MOBILITY_LABEL: Record<string, string> = {
  independent: '行动自如', mild_assist: '需轻度辅助', wheelchair: '需轮椅', bedridden: '卧床',
}

function profileLabel(target: any) {
  const hp = parseHealthProfile(target) || {}
  const items: string[] = []
  if (hp.fillMethod && hp.fillMethod !== 'self') items.push(FILL_METHOD_LABEL[hp.fillMethod] || '')
  if (hp.mobilityStatus && hp.mobilityStatus !== 'independent') items.push(MOBILITY_LABEL[hp.mobilityStatus] || '')
  if (hp.bloodType) items.push(hp.bloodType)
  if (hp.visionStatus && hp.visionStatus !== 'good') items.push(VISION_LABEL[hp.visionStatus] || '')
  if (hp.hearingStatus && hp.hearingStatus !== 'good') items.push(HEARING_LABEL[hp.hearingStatus] || '')
  if (hp.allergies && hp.allergies !== '无') items.push('有过敏')
  const hist: string[] = (hp.medicalHistory || []).filter((v: string) => v !== 'none')
  hist.forEach((v: string) => { if (MEDICAL_HISTORY_LABEL[v]) items.push(MEDICAL_HISTORY_LABEL[v]) })
  return items
}

function openEditCustomerDialog() {
  editCustomerForm.value = { nickname: customer.value?.nickname || '', phone: customer.value?.phone || '' }
  editCustomerDialogVisible.value = true
}

async function saveEditCustomer() {
  if (!editCustomerForm.value.nickname?.trim() && !editCustomerForm.value.phone?.trim()) {
    ElMessage.warning('请至少填写一项'); return
  }
  editCustomerSaving.value = true
  try {
    const payload: any = {}
    if (editCustomerForm.value.nickname?.trim()) payload.nickname = editCustomerForm.value.nickname.trim()
    if (editCustomerForm.value.phone?.trim()) payload.phone = editCustomerForm.value.phone.trim()
    await updateCustomer(Number(customerId), payload)
    ElMessage.success('保存成功')
    editCustomerDialogVisible.value = false
    loadData()
  } catch { /* handled by interceptor */ }
  finally { editCustomerSaving.value = false }
}

const profileForm = reactive({
  name: '', relationship: '' as string, gender: '' as string,
  idCard: '', idCardAge: undefined as number | undefined, idCardBirth: '',
  phone: '', emergencyContact: '', emergencyPhone: '', mainAppeal: '',
})

/** 解析18位身份证：返回 { birthDate, age, gender } 或 null */
function parseIdCard(id: string): { birthDate: string; age: number; gender: string } | null {
  if (!/^\d{17}[\dX]$/i.test(id.trim())) return null
  const s = id.trim()
  const year = s.slice(6, 10), month = s.slice(10, 12), day = s.slice(12, 14)
  const birth = new Date(`${year}-${month}-${day}`)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  const genderCode = s.charAt(16)
  const gender = parseInt(genderCode, 10) % 2 === 1 ? 'male' : 'female'
  return { birthDate: `${year}-${month}-${day}`, age: Math.max(0, age), gender }
}

function onIdCardInput(val: string) {
  profileForm.idCard = val
  const parsed = parseIdCard(val)
  if (parsed) {
    profileForm.idCardAge = parsed.age
    profileForm.idCardBirth = parsed.birthDate
    profileForm.gender = parsed.gender
  } else {
    profileForm.idCardAge = undefined
    profileForm.idCardBirth = ''
  }
}

const relationshipOptions = [
  { label: '本人', value: 'self' }, { label: '父亲', value: 'father' },
  { label: '母亲', value: 'mother' }, { label: '配偶', value: 'spouse' },
  { label: '子女', value: 'child' }, { label: '其他', value: 'other' },
]

async function loadData() {
  loading.value = true
  try {
    const [customerRes, targetsRes, ordersRes, memRes, docsRes] = await Promise.all([
      getCustomerDetail(Number(customerId)),
      getServiceTargets(Number(customerId)),
      getOrderList({ userId: Number(customerId), page: 1, pageSize: 100 }).catch(() => ({ items: [] })),
      getUserMembership(Number(customerId)).catch(() => null),
      getCustomerDocuments(Number(customerId)).catch(() => []),
    ])
    customer.value = customerRes
    serviceTargets.value = Array.isArray(targetsRes) ? targetsRes : []
    orders.value = ordersRes.items || []
    membership.value = memRes
    fulfillmentDocs.value = Array.isArray(docsRes) ? docsRes : []
  } catch { ElMessage.error('加载客户详情失败') }
  finally { loading.value = false }
}

function parseHealthProfile(target: any) {
  if (!target.healthProfile) return null
  try { return typeof target.healthProfile === 'string' ? JSON.parse(target.healthProfile) : target.healthProfile }
  catch { return null }
}

function hasUserSignature(target: any) {
  const hp = parseHealthProfile(target) || {}
  return !!(target?.signatureUrl || hp.signatureUrl || hp.signUrl)
}

function getUserSignatureName(target: any) {
  if (!hasUserSignature(target)) return ''
  const hp = parseHealthProfile(target) || {}
  return hp.signatureName || target?.name || ''
}

function getUserSignedAt(target: any) {
  if (!hasUserSignature(target)) return ''
  const hp = parseHealthProfile(target) || {}
  return hp.signedAt ? formatDate(hp.signedAt) : ''
}

const healthSignQrLoading = ref(false)
const healthSignQrTargetId = ref<number | null>(null)
const healthSignQrDataUrl = ref('')

async function generateHealthSignQrcode(targetId: number) {
  healthSignQrLoading.value = true
  healthSignQrTargetId.value = targetId
  try {
    const res: any = await getHealthSignQrcode(targetId)
    const b64 = res?.imageBase64
    if (!b64) {
      ElMessage.error('未返回图片数据')
      return
    }
    healthSignQrDataUrl.value = `data:image/png;base64,${b64}`
    ElMessage.success('已生成健康档案签署二维码，客户扫码后可直接进入签署页面')
  } catch (e: any) {
    ElMessage.error(typeof e?.message === 'string' ? e.message : '生成签署二维码失败')
  } finally {
    healthSignQrLoading.value = false
  }
}

function normalizeProfileDoc(target: any, res: any) {
  return {
    url: res.url?.startsWith('http') ? res.url : `${API_BASE_URL}${res.url}`,
    fileName: res.fileName || `健康档案 - ${target.name}`,
    fetchedAt: Date.now(),
  }
}

async function getProfileDoc(target: any, force = false) {
  const cached = healthProfileDocCache[target.id]
  const cacheExpired = !cached || (Date.now() - cached.fetchedAt > PROFILE_DOC_CACHE_TTL)
  if (cached && !force && !cacheExpired) return cached
  const res: any = await get(`/users/service-targets/${target.id}/health-profile-html`)
  const doc = normalizeProfileDoc(target, res)
  healthProfileDocCache[target.id] = doc
  return doc
}

function invalidateProfileDoc(targetId?: number) {
  if (typeof targetId === 'number') {
    delete healthProfileDocCache[targetId]
    return
  }
  Object.keys(healthProfileDocCache).forEach((key) => {
    delete healthProfileDocCache[Number(key)]
  })
}

async function handleViewProfile(target: any) {
  try {
    const doc = await getProfileDoc(target)
    profilePreviewUrl.value = doc.url
    profilePreviewTitle.value = doc.fileName
    profilePreviewVisible.value = true
  } catch { ElMessage.error('获取健康档案失败') }
}

async function handlePrintProfile(target: any) {
  try {
    const doc = await getProfileDoc(target)
    openPrintWindow(doc.url)
  } catch {
    ElMessage.error('获取健康档案失败')
  }
}

function openPrintWindow(url: string) {
  if (!url) return
  const w = window.open(url, '_blank')
  if (w) w.onload = () => setTimeout(() => w.print(), 500)
}
function openInNewWindow(url: string) {
  if (!url) return
  window.open(url, '_blank')
}

function docTypeLabel(type: string) {
  return {
    dispatch_confirmation: '派单确认书',
    service_completion: '服务完成确认书',
    service_report: '陪诊服务报告单',
    expert_match: '专家匹配报告',
  }[type] || type
}

function docTypeTagType(type: string) {
  if (type === 'service_report') return 'success'
  if (type === 'service_completion') return 'warning'
  if (type === 'dispatch_confirmation') return 'primary'
  return 'info'
}

function handlePreviewFulfillmentDoc(doc: any) {
  profilePreviewUrl.value = doc.url?.startsWith('http') ? doc.url : `${API_BASE_URL}${doc.url}`
  profilePreviewTitle.value = doc.fileName || '履约文档预览'
  profilePreviewVisible.value = true
}

function openMembershipDialog() {
  const m = membership.value
  membershipForm.value = {
    isAnnual: m?.isAnnualMember === true,
    startDate: m?.startDate ? (typeof m.startDate === 'string' ? m.startDate.slice(0, 10) : m.startDate) : '',
    expireDate: m?.expireDate ? (typeof m.expireDate === 'string' ? m.expireDate.slice(0, 10) : m.expireDate) : '',
    balanceDelta: 0,
  }
  membershipDialogVisible.value = true
}

async function saveMembership() {
  membershipSaving.value = true
  try {
    const wasAnnual = membership.value?.isAnnualMember === true
    const nowAnnual = membershipForm.value.isAnnual
    if (nowAnnual && !wasAnnual) {
      await grantAnnualCard(Number(customerId), {
        startDate: membershipForm.value.startDate || undefined,
        expireDate: membershipForm.value.expireDate || undefined,
      })
    } else if (!nowAnnual && wasAnnual) {
      await revokeAnnualCard(Number(customerId))
    } else {
      const payload: any = {}
      if (membershipForm.value.startDate) payload.startDate = membershipForm.value.startDate
      if (membershipForm.value.expireDate) payload.expireDate = membershipForm.value.expireDate
      if (membershipForm.value.balanceDelta !== 0) payload.balanceDelta = membershipForm.value.balanceDelta
      if (Object.keys(payload).length > 0) await updateUserMembership(Number(customerId), payload)
    }
    ElMessage.success('保存成功')
    membershipDialogVisible.value = false
    loadData()
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally { membershipSaving.value = false }
}

function openProfileDialog() {
  Object.assign(profileForm, { name: '', relationship: '', gender: '', idCard: '', idCardAge: undefined, idCardBirth: '', phone: customer.value?.phone || '', emergencyContact: '', emergencyPhone: '', mainAppeal: '' })
  profileDialogVisible.value = true
}

async function handleCreateProfile() {
  if (!profileForm.name?.trim()) { ElMessage.warning('请输入家庭成员姓名'); return }
  if (!profileForm.idCard?.trim()) { ElMessage.warning('请输入身份证号'); return }
  if (!/^\d{17}[\dX]$/i.test(profileForm.idCard.trim())) { ElMessage.warning('请输入正确的18位身份证号'); return }
  if (!profileForm.phone?.trim()) { ElMessage.warning('请输入联系电话'); return }
  if (!profileForm.gender) { ElMessage.warning('请选择性别'); return }
  if (!profileForm.relationship) { ElMessage.warning('请选择与客户关系'); return }
  profileSaving.value = true
  try {
    const parsed = parseIdCard(profileForm.idCard)
    await createServiceTarget(Number(customerId), {
      name: profileForm.name.trim(),
      idCard: profileForm.idCard.trim(),
      relationship: profileForm.relationship,
      gender: profileForm.gender,
      age: parsed?.age,
      phone: profileForm.phone.trim(),
      emergencyContact: profileForm.emergencyContact || undefined,
      emergencyPhone: profileForm.emergencyPhone || undefined,
      mainAppeal: profileForm.mainAppeal || undefined,
      healthProfile: {
        relation: relationshipOptions.find(r => r.value === profileForm.relationship)?.label,
        relationship: profileForm.relationship,
        fillMethod: 'self',
        mobilityStatus: 'independent',
        ...(parsed ? { birthDate: parsed.birthDate } : {}),
      },
    })
    ElMessage.success('家庭成员添加成功')
    invalidateProfileDoc()
    profileDialogVisible.value = false
    loadData()
  } catch { /* handled */ }
  finally { profileSaving.value = false }
}

// ── 家庭 Tab ──
const familiesLoading = ref(false)
const userFamilies = ref<any[]>([])
const assignCsDialogVisible = ref(false)
const assignCsForm = reactive<{ familyId: number | null; adminId: number | null }>({ familyId: null, adminId: null })
const adminOptions = ref<any[]>([])

// 成员档案抽屉（点击家庭成员行 → 打开档案）
const memberDrawerVisible = ref(false)
const selectedFamilyMember = ref<any>(null)
const selectedFamilyName = ref<string>('')

// 抽屉宽度响应式：大屏 1080px、中屏 75vw、窄屏 100%
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1600)
const memberDrawerSize = computed(() => {
  const w = windowWidth.value
  if (w >= 1600) return '1080px'
  if (w >= 1200) return '960px'
  if (w >= 900) return '75%'
  return '100%'
})

function _handleWindowResize() {
  windowWidth.value = window.innerWidth
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', _handleWindowResize)
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', _handleWindowResize)
  }
})

function openMemberDrawer(member: any, familyName: string) {
  selectedFamilyMember.value = member
  selectedFamilyName.value = familyName
  memberDrawerVisible.value = true
}

const drawerTarget = computed(() => {
  const tId = selectedFamilyMember.value?.serviceTarget?.id
  if (!tId) return null
  return serviceTargets.value.find((t: any) => t.id === tId) || null
})

const overviewActiveTab = ref<'followUps' | 'medications' | 'reports' | 'weekly'>('followUps')
const overviewWeeklyReports = ref<any[]>([])
const overviewWeeklyLoading = ref(false)

function formatDateOnly(t: string) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysLeftText(d: number) {
  if (d === 0) return '今天'
  if (d > 0) return `${d}天后`
  return '已过期'
}

const overviewDerived = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fups: any[] = []
  const meds: any[] = []
  const reps: any[] = []
  for (const order of orders.value) {
    const comp = order.completionData || {}
    const patientName = order.serviceTarget?.name || order.patientName || ''
    const hospital = order.hospital || ''
    if (comp.summary) {
      reps.push({
        orderId: order.id,
        summary: comp.summary,
        serviceDate: order.serviceTime ? formatDateOnly(order.serviceTime) : '',
        patientName,
        hospital,
      })
    }
    if (comp.followUpDate) {
      const fDate = new Date(comp.followUpDate)
      const diff = Math.ceil((fDate.getTime() - today.getTime()) / 86400000)
      fups.push({
        orderId: order.id,
        date: comp.followUpDate,
        hospital: comp.followUpHospital || hospital,
        department: comp.followUpDepartment || '',
        note: comp.followUpNote || '',
        patientName,
        daysLeft: diff,
        urgent: diff >= 0 && diff <= 3,
      })
    }
    const medList: any[] = comp.medications || []
    for (const med of medList) {
      if (!med.name) continue
      const endDate = med.endDate ? new Date(med.endDate) : null
      const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : 999
      meds.push({
        orderId: order.id,
        name: med.name,
        usage: med.usage || '',
        reminderTime: med.reminderTime || '',
        endDate: med.endDate || '',
        patientName,
        active: !endDate || daysLeft >= 0,
      })
    }
  }
  fups.sort((a, b) => {
    const aFuture = a.daysLeft >= 0
    const bFuture = b.daysLeft >= 0
    if (aFuture !== bFuture) return aFuture ? -1 : 1
    if (aFuture) return a.daysLeft - b.daysLeft
    return b.daysLeft - a.daysLeft
  })
  return { followUps: fups, medications: meds, reports: reps }
})

const overviewUpcomingFollowUpCount = computed(() =>
  overviewDerived.value.followUps.filter((f: any) => f.daysLeft >= 0).length,
)

const overviewNearFollowUp = computed(() =>
  overviewDerived.value.followUps.find((f: any) => f.daysLeft >= 0 && f.daysLeft <= 3) || null,
)

async function loadOverviewWeekly() {
  if (!customer.value?.id) return
  overviewWeeklyLoading.value = true
  try {
    const res: any = await getWeeklyReportsForUser(Number(customer.value.id), { pageSize: 10 })
    overviewWeeklyReports.value = res?.items || (Array.isArray(res) ? res : [])
  } catch {
    overviewWeeklyReports.value = []
  } finally {
    overviewWeeklyLoading.value = false
  }
}

const weeklyDetailVisible = ref(false)
const weeklyDetailData = ref<any>(null)

function openWeeklyDetail(row: any) {
  weeklyDetailData.value = row
  weeklyDetailVisible.value = true
}

// 家庭邀请二维码弹窗
const inviteQrDialogVisible = ref(false)
const inviteQrLoading = ref(false)
const inviteQrData = ref<{ imageBase64: string; inviteCode: string; familyName: string } | null>(null)
async function openFamilyInviteQrcode(fam: any) {
  inviteQrDialogVisible.value = true
  inviteQrData.value = null
  inviteQrLoading.value = true
  try {
    const res: any = await getFamilyInviteQrcode(fam.id)
    inviteQrData.value = {
      imageBase64: res.imageBase64,
      inviteCode: res.inviteCode || fam.inviteCode,
      familyName: res.familyName || fam.name,
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '生成邀请二维码失败')
    inviteQrDialogVisible.value = false
  } finally {
    inviteQrLoading.value = false
  }
}
function downloadInviteQrcode() {
  if (!inviteQrData.value) return
  const a = document.createElement('a')
  a.href = `data:image/png;base64,${inviteQrData.value.imageBase64}`
  a.download = `${inviteQrData.value.familyName || '家庭'}_邀请二维码.png`
  a.click()
}
async function copyInviteCode() {
  if (!inviteQrData.value?.inviteCode) return
  try {
    await navigator.clipboard.writeText(inviteQrData.value.inviteCode)
    ElMessage.success('已复制邀请码')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

// 家庭卡片头像（与小程序 `pages/family/family.ts` 中 preset 映射一致）
const FAMILY_AVATAR_PRESET_EMOJI: Record<string, string> = {
  home: '🏠',
  family: '👨‍👩‍👧‍👦',
  heart: '💕',
  hug: '🫂',
  sun: '☀️',
  tree: '🌳',
  star: '⭐',
  tea: '☕',
}

function resolveAdminPublicImageUrl(raw: string): string {
  const u = String(raw ?? '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('/')) {
    const base = API_BASE_URL.replace(/\/$/, '')
    return `${base}${u}`
  }
  return u
}

type FamilyCardAvatarView =
  | { kind: 'image'; src: string }
  | { kind: 'emoji'; emoji: string }
  | { kind: 'default' }

/** 解析家庭 avatarUrl：preset:xxx → emoji；否则为可展示的绝对图片地址 */
function familyCardAvatarView(fam: any): FamilyCardAvatarView {
  const raw = fam?.avatarUrl ?? fam?.avatar_url
  const v = String(raw ?? '').trim()
  if (!v) return { kind: 'default' }
  if (v.startsWith('preset:')) {
    const key = v.slice(7)
    const emoji = FAMILY_AVATAR_PRESET_EMOJI[key]
    return emoji ? { kind: 'emoji', emoji } : { kind: 'default' }
  }
  const src = resolveAdminPublicImageUrl(v)
  return src ? { kind: 'image', src } : { kind: 'default' }
}

// 管理员：一键回填家庭成员关联（仅 admin 可见；按钮会把全库的健康档案同步到家庭视图）
const backfillLoading = ref(false)
async function handleBackfillFamily() {
  try {
    await ElMessageBox.confirm(
      '将把全库的健康档案同步到各自客户的家庭成员视图中。\n • 「本人」关系档案会挂到客户自己的监护人身份下\n • 其他关系作为家庭成员（占位）\n操作幂等，可重复执行。',
      '一键回填家庭成员',
      { confirmButtonText: '开始回填', cancelButtonText: '取消', type: 'warning' },
    )
  } catch { return }
  backfillLoading.value = true
  try {
    const res: any = await backfillFamilyMembers()
    ElMessage.success(`回填完成：处理 ${res?.processed ?? '-'} 条档案，同步 ${res?.synced ?? '-'} 条到家庭`)
    loadUserFamilies()
  } catch (e: any) {
    ElMessage.error(e?.message || '回填失败')
  } finally {
    backfillLoading.value = false
  }
}

// 从客户的 serviceTargets 中找出 relationship === 'self' 的档案（用于管理者行的兜底关联）
const customerSelfTarget = computed(() => {
  return (
    serviceTargets.value.find((t: any) => {
      const hp = parseHealthProfile(t)
      return hp?.relationship === 'self'
    }) || null
  )
})

// 当 self 档案或家庭数据变化时，对家庭成员列表做一次"本人→管理者"兜底关联，
// 保证管理者行总能显示客户的 self 档案（与后端 self→guardian 逻辑一致）。
function normalizeUserFamilies() {
  const self = customerSelfTarget.value
  if (!self) return
  const cid = Number(customerId)
  let changed = false
  const next = userFamilies.value.map((fam: any) => {
    const members = Array.isArray(fam.members) ? fam.members.slice() : []
    const guardianIdx = members.findIndex(
      (m: any) => m?.role === 'guardian' && Number(m?.userId) === cid && !m?.serviceTarget,
    )
    if (guardianIdx < 0) return fam
    const g = members[guardianIdx]
    members[guardianIdx] = {
      ...g,
      serviceTarget: {
        id: self.id,
        name: self.name,
        age: self.age,
        gender: self.gender,
        phone: self.phone,
        isTrust: self.isTrust,
        trustDocUrl: self.trustDocUrl,
        delegatorRelation: self.delegatorRelation,
      },
    }
    changed = true
    return { ...fam, members }
  })
  if (changed) userFamilies.value = next
}

watch(customerSelfTarget, () => normalizeUserFamilies())

async function loadUserFamilies() {
  if (!customerId) return
  familiesLoading.value = true
  try {
    const res: any = await get(`/family/admin/by-user/${customerId}`)
    userFamilies.value = Array.isArray(res?.families) ? res.families : []
    // 加载后立刻做一次兜底关联（serviceTargets 可能先加载，也可能后加载，
    // 通过上方 watch 在两边都就绪时会再自动跑一次）
    normalizeUserFamilies()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载家庭失败')
    userFamilies.value = []
  } finally {
    familiesLoading.value = false
  }
}

function openAssignCsDialog(fam: any) {
  assignCsForm.familyId = fam.id
  assignCsForm.adminId = fam.assignedCs?.id || null
  assignCsDialogVisible.value = true
  loadAdminOptions()
}

async function loadAdminOptions() {
  if (adminOptions.value.length) return
  try {
    const res: any = await get('/admin-users', { pageSize: 200 })
    const items = Array.isArray(res) ? res : (res?.items || [])
    adminOptions.value = items.filter((a: any) => ['admin', 'customer_service', 'operator'].includes(a.role))
  } catch {
    adminOptions.value = []
  }
}

async function submitAssignCs() {
  if (!assignCsForm.familyId) return
  try {
    await post(`/family/admin/groups/${assignCsForm.familyId}/assign-cs`, {
      adminId: assignCsForm.adminId,
    })
    ElMessage.success('已保存专属客服')
    assignCsDialogVisible.value = false
    loadUserFamilies()
  } catch {
    // 错误由全局请求拦截器统一弹出
  }
}

function goToServiceTarget(targetId: number) {
  selectedTargetId.value = targetId
  activeTab.value = 'families'
  const card = document.querySelector('.customer-main')
  if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ behavior: 'smooth' })
}

onMounted(async () => {
  await loadData()
  loadReminders()
  loadFollowUpReminders()
  loadUserFamilies()
  loadDosageDictionary()
  loadOverviewWeekly()
  // 支持 URL query: /customer-center/customers/detail/:id?tab=families
  const presetTab = route.query?.tab
  if (typeof presetTab === 'string' && presetTab) {
    activeTab.value = presetTab === 'profiles' ? 'families' : presetTab
  }
})
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">客户详情</h2>
        <p class="page-subtitle">推荐按「身份信息 -> 家庭成员 -> 订单管理」顺序操作，避免遗漏关键步骤。</p>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" v-if="customer" @click="router.push(`/service/orders/create?userId=${customer.id}`)">创建订单</el-button>
        <el-button v-if="customer" @click="openProfileDialog">新增家庭成员</el-button>
        <el-button v-if="customer" @click="openMembershipDialog">会员调整</el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </div>

    <div class="page-guide" v-if="customer">
      <span class="page-guide__label">流程建议</span>
      <el-tag size="small" effect="plain">1 核对身份和会员</el-tag>
      <el-tag size="small" effect="plain">2 维护家庭成员</el-tag>
      <el-tag size="small" effect="plain">3 创建或跟进订单</el-tag>
      <el-tag size="small" effect="plain">4 同步客户服务记录</el-tag>
    </div>

    <div class="customer-layout" v-if="customer">

      <!-- ══ 左侧：客户概览卡 ══ -->
      <div class="customer-sidebar">

        <!-- 身份卡 + 会员信息合并 -->
        <el-card shadow="never" class="sidebar-card sidebar-identity">
          <div class="identity-avatar">{{ (customer.nickname || '?')[0] }}</div>
          <div class="identity-name">{{ customer.nickname || '—' }}</div>
          <div class="identity-phone">{{ customer.phone || '—' }}</div>
          <div class="identity-tags">
            <el-tag :type="membership?.isAnnualMember ? 'warning' : 'info'" size="small" effect="light">
              {{ membership?.isAnnualMember ? '孝心年卡' : '普通会员' }}
            </el-tag>
            <el-tag v-if="membership?.isAnnualMember && membership?.isExpired" type="danger" size="small" effect="light">已过期</el-tag>
            <el-tag :type="isAdminRole ? 'danger' : 'info'" size="small" effect="light">
              {{ roleLabel }}
            </el-tag>
          </div>

          <!-- 会员信息内嵌 -->
          <div class="identity-info-block">
            <div class="identity-info-row">
              <span class="identity-info-label">储值余额</span>
              <span class="identity-info-val identity-info-val--accent">
                ¥{{ membership?.balance != null ? Number(membership.balance).toFixed(2) : '0.00' }}
              </span>
            </div>
            <div class="identity-info-row" v-if="membership?.isAnnualMember">
              <span class="identity-info-label">年卡到期</span>
              <span class="identity-info-val">{{ membership?.expireDate ? membership.expireDate.slice(0, 10) : '永久' }}</span>
            </div>
            <div class="identity-info-row">
              <span class="identity-info-label">注册时间</span>
              <span class="identity-info-val">{{ customer.createdAt ? formatDate(customer.createdAt) : '—' }}</span>
            </div>
          </div>

          <div class="identity-actions">
            <el-button size="small" @click="openEditCustomerDialog">编辑信息</el-button>
            <el-button size="small" type="primary" @click="openMembershipDialog">会员调整</el-button>
            <el-button size="small" type="danger" plain @click="openRoleDialog">设置角色</el-button>
          </div>
        </el-card>

        <!-- 数据速览 -->
        <el-card shadow="never" class="sidebar-card">
          <div class="stat-grid">
            <div class="stat-item">
              <div class="stat-val">{{ orders.length }}</div>
              <div class="stat-label">历史订单</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" :class="activeOrders.length ? 'stat-val--active' : ''">{{ activeOrders.length }}</div>
              <div class="stat-label">进行中</div>
            </div>
            <div class="stat-item">
              <div class="stat-val">{{ serviceTargets.length }}</div>
              <div class="stat-label">家庭成员</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" :class="activeReminders.length ? 'stat-val--reminder' : ''">{{ activeReminders.length }}</div>
              <div class="stat-label">用药中</div>
            </div>
          </div>
        </el-card>

        <!-- 家庭成员快览（可点击筛选） -->
        <el-card shadow="never" class="sidebar-card">
          <div class="sidebar-section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>家庭成员</span>
            <el-button type="primary" link size="small" @click="openProfileDialog">+ 新增</el-button>
          </div>
          <div v-if="serviceTargets.length" class="target-list">
            <!-- 全部 -->
            <div
              class="target-chip"
              :class="{ 'target-chip--active': selectedTargetId === null }"
              style="cursor:pointer;"
              @click="selectTarget(null)"
            >
              <span class="target-chip-name">全部</span>
              <el-tag size="small" type="info" effect="plain">{{ orders.length }}单</el-tag>
            </div>
            <!-- 各家庭成员 -->
            <div
              v-for="t in serviceTargets" :key="t.id"
              class="target-chip"
              :class="{ 'target-chip--active': selectedTargetId === t.id }"
              style="cursor:pointer;"
              @click="selectTarget(t.id)"
            >
              <span class="target-chip-name">{{ t.name }}</span>
              <div style="display:flex;gap:4px;align-items:center;">
                <el-tag size="small" :type="hasUserSignature(t) ? 'success' : 'warning'" effect="plain">
                  {{ hasUserSignature(t) ? '已签署' : '未签署' }}
                </el-tag>
              </div>
            </div>
          </div>
          <div v-else style="color:#909399;font-size:13px;text-align:center;padding:8px 0;">暂无家庭成员</div>
        </el-card>
      </div>

      <!-- ══ 右侧：功能 Tab ══ -->
      <div class="customer-main">
        <el-tabs v-model="activeTab" type="border-card">

          <!-- ① 订单 -->
          <el-tab-pane name="orders">
            <template #label>
              <span>订单管理</span>
              <el-badge v-if="activeOrders.length" :value="activeOrders.length" type="danger" style="margin-left:6px;" />
            </template>

            <!-- 筛选提示条 -->
            <div v-if="selectedTarget" class="filter-hint filter-hint--primary">
              <el-icon><Filter /></el-icon>
              <span>正在查看 <strong>{{ selectedTarget.name }}</strong> 的订单</span>
              <el-button type="primary" link size="small" @click="selectTarget(null)">查看全部</el-button>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
              <el-tag type="info" effect="plain">全部 {{ filteredOrders.length }} 单</el-tag>
              <el-tag type="danger" effect="plain" v-if="activeOrders.length">进行中 {{ activeOrders.length }}</el-tag>
              <el-tag type="success" effect="plain">
                已完成 {{ filteredOrders.filter(o => o.status === 'completed').length }}
              </el-tag>
            </div>

            <el-table :data="filteredOrders" highlight-current-row v-if="filteredOrders.length" size="small">
              <el-table-column prop="orderNumber" label="订单号" min-width="160">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="router.push(`/service/orders/detail/${row.id}`)">
                    {{ row.orderNumber }}
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column label="家庭成员" width="90">
                <template #default="{ row }">{{ row.serviceTarget?.name || '—' }}</template>
              </el-table-column>
              <el-table-column prop="serviceType" label="服务类型" width="110" />
              <el-table-column label="服务时间" min-width="150">
                <template #default="{ row }">{{ row.serviceTime ? formatDate(row.serviceTime) : '—' }}</template>
              </el-table-column>
              <el-table-column label="陪诊员" width="90">
                <template #default="{ row }">{{ row.attendant?.realName || '—' }}</template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag :type="(orderStatusMap[row.status]?.type as any) || 'info'" size="small" effect="light">
                    {{ orderStatusMap[row.status]?.label || row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="费用" width="90">
                <template #default="{ row }">{{ row.totalFee ? formatMoney(row.totalFee) : '—' }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无订单记录" />
          </el-tab-pane>

          <!-- 健康概览（由订单 completionData 聚合而来） -->
          <el-tab-pane name="overview">
            <template #label>
              <span>健康概览</span>
              <el-badge
                v-if="overviewUpcomingFollowUpCount"
                :value="overviewUpcomingFollowUpCount"
                type="warning"
                style="margin-left:6px;" />
            </template>

            <div class="overview-stats">
              <div
                class="overview-stat-card"
                :class="{ 'overview-stat-card--warn': overviewUpcomingFollowUpCount > 0 }"
                @click="overviewActiveTab = 'followUps'"
              >
                <div class="overview-stat-num">{{ overviewDerived.followUps.length }}</div>
                <div class="overview-stat-label">待复诊</div>
              </div>
              <div class="overview-stat-card" @click="overviewActiveTab = 'medications'">
                <div class="overview-stat-num">{{ overviewDerived.medications.length }}</div>
                <div class="overview-stat-label">在用药品</div>
              </div>
              <div class="overview-stat-card" @click="overviewActiveTab = 'reports'">
                <div class="overview-stat-num">{{ overviewDerived.reports.length }}</div>
                <div class="overview-stat-label">服务报告</div>
              </div>
              <div class="overview-stat-card" @click="overviewActiveTab = 'weekly'">
                <div class="overview-stat-num">{{ overviewWeeklyReports.length }}</div>
                <div class="overview-stat-label">AI周报</div>
              </div>
            </div>

            <el-alert
              v-if="overviewNearFollowUp"
              type="warning"
              :closable="false"
              show-icon
              class="overview-urgent"
            >
              <template #title>
                <strong>{{ overviewNearFollowUp.patientName }}</strong>
                {{ daysLeftText(overviewNearFollowUp.daysLeft) }}需要复诊 —
                {{ overviewNearFollowUp.hospital }} {{ overviewNearFollowUp.department }}
              </template>
            </el-alert>

            <el-tabs v-model="overviewActiveTab">
              <el-tab-pane label="复诊安排" name="followUps">
                <el-table :data="overviewDerived.followUps" empty-text="暂无复诊安排" size="small">
                  <el-table-column label="复诊日期" width="130">
                    <template #default="{ row }">{{ formatDateOnly(row.date) }}</template>
                  </el-table-column>
                  <el-table-column label="服务对象" width="100" prop="patientName" />
                  <el-table-column label="医院 / 科室" min-width="180">
                    <template #default="{ row }">{{ row.hospital }} {{ row.department }}</template>
                  </el-table-column>
                  <el-table-column label="状态" width="110" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.daysLeft < 0 ? 'info' : row.urgent ? 'warning' : 'success'" size="small">
                        {{ daysLeftText(row.daysLeft) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="备注" prop="note" min-width="120" show-overflow-tooltip />
                  <el-table-column label="操作" width="90" align="center" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="router.push(`/service/orders/detail/${row.orderId}`)">查看</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="用药管理" name="medications">
                <el-table :data="overviewDerived.medications" empty-text="暂无用药记录" size="small">
                  <el-table-column label="药品名称" min-width="120" prop="name" />
                  <el-table-column label="用法用量" min-width="160" prop="usage" show-overflow-tooltip />
                  <el-table-column label="提醒时间" width="100" prop="reminderTime" />
                  <el-table-column label="截止日期" width="120">
                    <template #default="{ row }">{{ formatDateOnly(row.endDate) || '长期' }}</template>
                  </el-table-column>
                  <el-table-column label="服务对象" width="100" prop="patientName" />
                  <el-table-column label="状态" width="90" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.active ? 'success' : 'info'" size="small">
                        {{ row.active ? '服用中' : '已结束' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="90" align="center" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="router.push(`/service/orders/detail/${row.orderId}`)">查看</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="服务报告" name="reports">
                <el-table :data="overviewDerived.reports" empty-text="暂无服务报告" size="small">
                  <el-table-column label="服务对象" width="100" prop="patientName" />
                  <el-table-column label="医院" width="160" prop="hospital" show-overflow-tooltip />
                  <el-table-column label="服务日期" width="120" prop="serviceDate" />
                  <el-table-column label="总结" min-width="240" prop="summary" show-overflow-tooltip />
                  <el-table-column label="操作" width="90" align="center" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="router.push(`/service/orders/detail/${row.orderId}`)">查看</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="AI健康周报" name="weekly">
                <el-table
                  :data="overviewWeeklyReports"
                  v-loading="overviewWeeklyLoading"
                  empty-text="暂无健康周报"
                  size="small"
                >
                  <el-table-column label="标题" min-width="160">
                    <template #default="{ row }">{{ row.title || 'AI 健康周报' }}</template>
                  </el-table-column>
                  <el-table-column label="周期" width="220">
                    <template #default="{ row }">
                      {{ formatDateOnly(row.periodStart) }} ~ {{ formatDateOnly(row.periodEnd) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="摘要" min-width="200" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.summary || '-' }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="90" align="center" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="openWeeklyDetail(row)">查看详情</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>

          <!-- ② 履约文档 -->
          <el-tab-pane name="documents">
            <template #label>
              <span>履约文档</span>
              <el-badge v-if="fulfillmentDocs.length" :value="fulfillmentDocs.length" type="success" style="margin-left:6px;" />
            </template>

            <div v-if="selectedTarget" class="filter-hint filter-hint--success">
              <el-icon><Filter /></el-icon>
              <span>正在查看 <strong>{{ selectedTarget.name }}</strong> 的履约文档</span>
              <el-button type="success" link size="small" @click="selectTarget(null)">查看全部</el-button>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
              <el-tag type="info" effect="plain">全部 {{ filteredFulfillmentDocs.length }} 份</el-tag>
              <el-tag type="success" effect="plain">已归档 {{ filteredFulfillmentDocs.length }} 份</el-tag>
            </div>

            <el-table :data="filteredFulfillmentDocs" highlight-current-row size="small" v-if="filteredFulfillmentDocs.length">
              <el-table-column label="文档类型" width="140">
                <template #default="{ row }">
                  <el-tag :type="docTypeTagType(row.type) as any" size="small" effect="light">
                    {{ docTypeLabel(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="fileName" label="文件名" min-width="190" show-overflow-tooltip />
              <el-table-column label="关联订单" min-width="150">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="router.push(`/service/orders/detail/${row.orderId || row.order?.id}`)">
                    {{ row.order?.orderNumber || row.orderId || '—' }}
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column label="家庭成员" width="100">
                <template #default="{ row }">{{ row.order?.serviceTarget?.name || '—' }}</template>
              </el-table-column>
              <el-table-column label="服务时间" min-width="160">
                <template #default="{ row }">{{ row.order?.serviceTime ? formatDate(row.order.serviceTime) : '—' }}</template>
              </el-table-column>
              <el-table-column label="陪诊员" width="100">
                <template #default="{ row }">{{ row.order?.attendant?.realName || '—' }}</template>
              </el-table-column>
              <el-table-column label="生成时间" width="170">
                <template #default="{ row }">{{ row.createdAt ? formatDate(row.createdAt) : '—' }}</template>
              </el-table-column>
              <el-table-column label="操作" fixed="right" width="220">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="handlePreviewFulfillmentDoc(row)">预览</el-button>
                  <el-button type="success" link size="small" @click="openPrintWindow(row.url)">打印</el-button>
                  <el-button type="info" link size="small" @click="openInNewWindow(row.url)">打开</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else :description="selectedTarget ? `${selectedTarget.name} 暂无履约文档` : '暂无履约文档'">
              <div style="font-size:13px;color:#909399;">生成确认书、完成单或服务报告后，这里会自动按客户聚合展示。</div>
            </el-empty>
          </el-tab-pane>

          <!-- ③ 客户服务 -->
          <el-tab-pane name="reminders">
            <template #label>
              <span>客户服务</span>
              <el-badge v-if="activeReminders.length + activeFollowUpReminders.length" :value="activeReminders.length + activeFollowUpReminders.length" type="warning" style="margin-left:6px;" />
            </template>

            <div v-if="selectedTarget" class="filter-hint filter-hint--warning">
              <el-icon><Filter /></el-icon>
              <span>正在查看 <strong>{{ selectedTarget.name }}</strong> 的客户服务提醒</span>
              <el-button type="warning" link size="small" @click="selectTarget(null)">查看全部</el-button>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div style="display:flex;gap:8px;">
                <el-tag type="warning" effect="plain">用药 {{ activeReminders.length }}</el-tag>
                <el-tag type="success" effect="plain">复诊 {{ activeFollowUpReminders.length }}</el-tag>
                <el-tag type="info" effect="plain">全部 {{ filteredReminders.length + filteredFollowUpReminders.length }}</el-tag>
              </div>
              <div style="display:flex;gap:8px;">
                <el-button type="primary" size="small" @click="openReminderDialog">
                  <el-icon><Plus /></el-icon> 新建用药提醒
                </el-button>
                <el-button type="success" size="small" @click="openFollowUpDialog">
                  <el-icon><Plus /></el-icon> 新建复诊提醒
                </el-button>
              </div>
            </div>

            <el-alert
              :closable="false"
              type="info"
              show-icon
              style="margin-bottom:16px;"
            >
              <template #title>
                <span>本页时间轴是<strong>用药 / 复诊提醒</strong>（与服务结束汇总、后台新建提醒同步），<strong>不是</strong>订单里的陪诊过程图文时间线。</span>
              </template>
              <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#606266;">
                若要补录或修改陪诊当天的文字、图片、录音、文件，请到<strong>对应订单详情 →「服务时间线」</strong>选项卡，使用「补录时间线内容」或条目上的「编辑」。
              </div>
            </el-alert>

            <el-timeline v-if="customerServiceTimelineItems.length">
              <el-timeline-item
                v-for="item in customerServiceTimelineItems"
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
                        <el-tag v-if="item.serviceTarget?.name" size="small" effect="plain">{{ item.serviceTarget.name }}</el-tag>
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
                        @click="router.push(`/service/orders/detail/${item.orderId || item.order?.id}`)"
                      >查看订单</el-button>
                      <el-button
                        type="primary"
                        link
                        size="small"
                        @click="item.reminderKind === 'follow_up' ? openEditFollowUpReminder(item) : openEditMedicationReminder(item)"
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
            <el-empty v-else :description="selectedTarget ? `${selectedTarget.name} 暂无客户服务提醒` : '暂无客户服务提醒'">
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <el-button type="primary" @click="openReminderDialog"><el-icon><Plus /></el-icon> 新建用药提醒</el-button>
                <el-button type="success" @click="openFollowUpDialog"><el-icon><Plus /></el-icon> 新建复诊提醒</el-button>
              </div>
            </el-empty>
          </el-tab-pane>

          <!-- 家庭 & 成员档案（聚合） -->
          <el-tab-pane label="家庭 & 成员档案" name="families">
            <el-alert
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom:12px;"
              title="点击下方任一家庭成员，即可查看该成员的健康档案、就医记录、用药 / 复诊及相关订单。"
              description="该视图已聚合了原先分散在「客户健康管理」「家庭管理」中的全部功能。" />

            <div v-if="isSuperAdmin" style="margin-bottom:12px;display:flex;justify-content:flex-end;">
              <el-button
                size="small"
                type="warning"
                plain
                :loading="backfillLoading"
                @click="handleBackfillFamily"
              >
                一键回填家庭成员关联（管理员）
              </el-button>
            </div>

            <div v-if="familiesLoading" style="padding:16px;color:#909399;">加载中…</div>
            <el-empty v-else-if="!userFamilies.length" description="该客户未加入任何家庭" />
            <div v-else class="family-tab">
              <el-card
                v-for="fam in userFamilies"
                :key="fam.id"
                shadow="never"
                class="family-card"
                style="margin-bottom:16px;"
              >
                <template #header>
                  <div class="family-card__header">
                    <div class="family-card__header-main">
                      <template v-for="av in [familyCardAvatarView(fam)]" :key="`av-${fam.id}`">
                        <div class="family-card__avatar-wrap" aria-hidden="true">
                          <img
                            v-if="av.kind === 'image'"
                            :src="av.src"
                            class="family-card__avatar-img"
                            alt=""
                          />
                          <span v-else class="family-card__avatar-emoji">
                            {{ av.kind === 'emoji' ? av.emoji : '🏠' }}
                          </span>
                        </div>
                      </template>
                      <div class="family-card__header-titles">
                        <span class="family-card__name">{{ fam.name }}</span>
                        <el-tag size="small" style="margin-left:8px;" :type="fam.currentUserRole === 'guardian' ? 'success' : 'info'">
                          {{ fam.currentUserRole === 'guardian' ? '管理者' : '成员' }}
                        </el-tag>
                        <el-tag size="small" type="info" effect="plain" style="margin-left:6px;">邀请码 {{ fam.inviteCode }}</el-tag>
                        <el-tag size="small" type="info" effect="plain" style="margin-left:6px;">{{ fam.members?.length || 0 }} 位成员</el-tag>
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                      <el-button size="small" type="primary" link @click="openFamilyInviteQrcode(fam)">
                        <el-icon><Share /></el-icon> 邀请二维码
                      </el-button>
                      <el-button size="small" link @click="openAssignCsDialog(fam)">
                        {{ fam.assignedCs ? `专属客服：${fam.assignedCs.realName}` : '分配专属客服' }}
                      </el-button>
                    </div>
                  </div>
                </template>

                <el-table
                  :data="fam.members"
                  size="small"
                  class="family-members-table"
                  @row-click="(row: any) => openMemberDrawer(row, fam.name)"
                >
                  <el-table-column label="成员" min-width="180">
                    <template #default="{ row }">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <el-avatar :size="28">{{ (row.nickname || row.placeholderName || '?').slice(0,1) }}</el-avatar>
                        <div>
                          <div style="font-weight:500;">{{ row.nickname || row.placeholderName || '—' }}</div>
                          <div style="color:#909399;font-size:12px;">{{ row.user?.phone || row.placeholderPhone || '—' }}</div>
                        </div>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="关系" width="80">
                    <template #default="{ row }">
                      <el-tag size="small" :type="row.role === 'guardian' ? 'success' : 'info'">
                        {{ row.role === 'guardian' ? '管理者' : (row.isElder ? '老人' : '成员') }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                      <el-tag v-if="row.isPlaceholder" size="small" type="warning" effect="plain">待登录</el-tag>
                      <el-tag v-else size="small" type="success" effect="plain">已登录</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="健康档案" min-width="200">
                    <template #default="{ row }">
                      <div v-if="row.serviceTarget">
                        <span style="color:#1f2937;">{{ row.serviceTarget.name }}</span>
                        <el-tag
                          v-if="row.role === 'guardian' && Number(row.userId) === Number(customerId) && customerSelfTarget && row.serviceTarget.id === customerSelfTarget.id"
                          size="small"
                          type="primary"
                          effect="dark"
                          style="margin-left:4px;"
                        >本人档案</el-tag>
                        <el-tag v-if="row.serviceTarget.isTrust" size="small" type="success" effect="plain" style="margin-left:4px;">已委托</el-tag>
                        <el-tag v-else-if="row.serviceTarget.delegatorRelation === 'child'" size="small" type="danger" effect="plain" style="margin-left:4px;">待子女签署</el-tag>
                      </div>
                      <div v-else>
                        <span style="color:#bbb;">暂未建档</span>
                        <el-button
                          v-if="row.role === 'guardian' && Number(row.userId) === Number(customerId)"
                          size="small"
                          type="primary"
                          link
                          style="margin-left:6px;"
                          @click.stop="openProfileDialog"
                        >去建「本人」档案</el-button>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="加入时间" width="150">
                    <template #default="{ row }">
                      <span v-if="row.joinedAt">{{ formatDate(row.joinedAt) }}</span>
                      <span v-else style="color:#bbb;">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="130" align="center">
                    <template #default="{ row }">
                      <el-button size="small" type="primary" link @click.stop="openMemberDrawer(row, fam.name)">
                        查看档案
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </div>
          </el-tab-pane>

          <el-tab-pane label="账号信息" name="basic">
            <el-descriptions :column="2" border v-if="customer">
              <el-descriptions-item label="昵称">{{ customer.nickname || '—' }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ customer.phone || '—' }}</el-descriptions-item>
              <el-descriptions-item label="注册时间">{{ customer.createdAt ? formatDate(customer.createdAt) : '—' }}</el-descriptions-item>
              <el-descriptions-item label="会员类型">
                <el-tag :type="membership?.isAnnualMember ? 'warning' : 'info'" size="small">
                  {{ membership?.isAnnualMember ? '孝心年卡' : '普通会员' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="储值余额">¥{{ membership?.balance != null ? Number(membership.balance).toFixed(2) : '0.00' }}</el-descriptions-item>
              <el-descriptions-item label="年卡到期">{{ membership?.isAnnualMember && membership?.expireDate ? membership.expireDate.slice(0, 10) : '—' }}</el-descriptions-item>
            </el-descriptions>
            <div style="margin-top:12px;color:#909399;font-size:13px;">
              会员开通、续费、储值等操作已统一到左侧客户概览卡中的“会员调整”入口。
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;">
              <el-button type="primary" @click="openEditCustomerDialog"><el-icon><Edit /></el-icon> 修改信息</el-button>
            </div>
          </el-tab-pane>

        </el-tabs>
      </div>
    </div>

    <!-- ══ 弹窗 ══ -->

    <!-- 分配专属客服 -->
    <el-dialog v-model="assignCsDialogVisible" title="分配专属客服" width="420px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px;"
        title="为家庭指派专属客服后，家庭内老人端的「专属管家」会显示该客服的姓名与电话。" />
      <el-form label-width="80px">
        <el-form-item label="客服">
          <el-select v-model="assignCsForm.adminId" placeholder="选择客服账号" clearable style="width:100%;" filterable>
            <el-option v-for="a in adminOptions" :key="a.id" :label="`${a.realName || a.username}（${a.role}）`" :value="a.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignCsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssignCs">确定</el-button>
      </template>
    </el-dialog>

    <!-- 角色管理 -->
    <el-dialog v-model="roleDialogVisible" title="设置用户角色" width="400px">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom:16px;"
        title="修改角色后，该用户登录小程序将获得对应权限。管理员角色将拥有访问后台管理台的权限。" />
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="当前角色">
          <el-tag :type="isAdminRole ? 'danger' : 'info'" size="small">{{ roleLabel }}</el-tag>
        </el-form-item>
        <el-form-item label="设置为" required>
          <el-select v-model="roleForm.role" style="width:100%;">
            <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value">
              <span>{{ opt.label }}</span>
              <span style="float:right;color:#909399;font-size:12px;">{{ opt.value }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleSaving" @click="saveRole">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 会员调整 -->
    <el-dialog v-model="membershipDialogVisible" title="调整会员信息" width="460px">
      <el-form :model="membershipForm" label-width="110px">
        <el-form-item label="孝心年卡">
          <el-switch v-model="membershipForm.isAnnual" active-text="已开通" inactive-text="普通会员" />
        </el-form-item>
        <template v-if="membershipForm.isAnnual">
          <el-form-item label="开始日期">
            <el-date-picker v-model="membershipForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选填，默认今日" style="width:100%;" />
          </el-form-item>
          <el-form-item label="到期日期">
            <el-date-picker v-model="membershipForm.expireDate" type="date" value-format="YYYY-MM-DD" placeholder="选填，留空则永不过期" style="width:100%;" />
          </el-form-item>
        </template>
        <el-form-item label="储值调整">
          <el-input-number v-model="membershipForm.balanceDelta" :precision="2" placeholder="正数充值，负数扣减" style="width:100%;" />
          <div style="font-size:12px;color:#909399;margin-top:4px;">正数为充值，负数为扣减，0 表示不调整</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="membershipDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="membershipSaving" @click="saveMembership">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加家庭成员 -->
    <el-dialog v-model="profileDialogVisible" title="添加家庭成员" width="520px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom:12px;"
        title="添加后会自动加入该客户的家庭（若无家庭将自动创建默认家庭），「本人」关系的档案挂在客户自己的监护人身份上。" />
      <el-form :model="profileForm" label-width="110px">
        <el-form-item label="姓名" required>
          <el-input v-model="profileForm.name" placeholder="请输入家庭成员姓名（本人/父亲/母亲等）" />
        </el-form-item>
        <el-form-item label="与客户关系" required>
          <el-select v-model="profileForm.relationship" placeholder="请选择" style="width:100%;">
            <el-option v-for="opt in relationshipOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="身份证号" required>
          <el-input
            v-model="profileForm.idCard"
            placeholder="请输入18位身份证号"
            maxlength="18"
            @input="onIdCardInput(profileForm.idCard)"
          />
          <div v-if="profileForm.idCardAge !== undefined" style="margin-top:6px;color:#606266;font-size:13px;display:flex;gap:16px;">
            <span>年龄：<strong>{{ profileForm.idCardAge }}</strong> 岁</span>
            <span>出生：{{ profileForm.idCardBirth }}</span>
            <span>性别已自动识别</span>
          </div>
          <div v-else-if="profileForm.idCard.length === 18" style="margin-top:4px;color:#f56c6c;font-size:12px;">
            身份证号格式有误，请检查
          </div>
        </el-form-item>
        <el-form-item label="性别" required>
          <el-radio-group v-model="profileForm.gender">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
          <span style="margin-left:8px;color:#909399;font-size:12px;">（输入身份证后自动填充）</span>
        </el-form-item>
        <el-form-item label="联系电话" required>
          <el-input v-model="profileForm.phone" placeholder="请输入联系电话" maxlength="11" />
        </el-form-item>
        <el-form-item label="紧急联系人">
          <el-input v-model="profileForm.emergencyContact" placeholder="选填" />
        </el-form-item>
        <el-form-item label="紧急联系电话">
          <el-input v-model="profileForm.emergencyPhone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="主要诉求">
          <el-input v-model="profileForm.mainAppeal" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="profileSaving" @click="handleCreateProfile">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑客户信息 -->
    <el-dialog v-model="editCustomerDialogVisible" title="修改客户信息" width="400px">
      <el-form :model="editCustomerForm" label-width="80px">
        <el-form-item label="昵称">
          <el-input v-model="editCustomerForm.nickname" placeholder="请输入昵称" clearable />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="editCustomerForm.phone" placeholder="请输入手机号" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editCustomerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editCustomerSaving" @click="saveEditCustomer">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新建用药提醒 -->
    <el-dialog v-model="reminderDialogVisible" :title="editingReminderId ? '编辑用药提醒' : '新建用药提醒'" width="540px">
      <el-form :model="reminderForm" label-width="100px">
        <el-form-item label="药品名称" required>
          <el-input v-model="reminderForm.medicineName" placeholder="如：阿莫西林" />
        </el-form-item>
        <el-form-item label="剂量">
          <el-select
            v-model="reminderForm.dosage"
            :placeholder="dosageOptions.length ? '请选择剂量' : '字典加载失败，暂不可选'"
            :disabled="!dosageOptions.length"
            clearable
            style="width:100%;"
          >
            <el-option
              v-for="opt in dosageOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
          <el-alert
            v-if="isLegacyDosage"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top:6px;"
            :title="`当前剂量「${reminderForm.dosage}」不在字典内`"
            :description="`保存后，微信订阅消息推送将自动用兜底文案「${dosageFallback}」。请从下拉选择一个新值以彻底修复。`"
          />
        </el-form-item>
        <el-form-item label="用药说明">
          <el-input v-model="reminderForm.instructions" type="textarea" :rows="2" placeholder="如：饭后服用，避免空腹" />
        </el-form-item>
        <el-form-item label="家庭成员">
          <el-select v-model="reminderForm.serviceTargetId" placeholder="选填，不选则为本人" clearable style="width:100%;">
            <el-option v-for="t in serviceTargets" :key="t.id" :value="t.id" :label="t.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="提醒时间">
          <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
            <div v-for="(_, idx) in reminderForm.reminderTimes" :key="idx" style="display:flex;gap:8px;align-items:center;">
              <el-time-select
                v-model="reminderForm.reminderTimes[idx]"
                start="05:00" end="23:00" step="00:30"
                placeholder="选择时间" style="width:130px;"
              />
              <el-button link type="danger" @click="removeReminderTime(idx)" v-if="reminderForm.reminderTimes.length > 1">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <el-button link type="primary" @click="addReminderTime" v-if="reminderForm.reminderTimes.length < 6">
              <el-icon><Plus /></el-icon> 添加时间
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="开始日期" required>
          <el-date-picker v-model="reminderForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选择开始日期" style="width:180px;" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="reminderForm.endDate" type="date" value-format="YYYY-MM-DD" placeholder="不填为长期" style="width:180px;" />
        </el-form-item>
        <el-form-item label="推送渠道">
          <el-radio-group v-model="reminderForm.channel">
            <el-radio label="mini_program">小程序</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editingReminderId" label="提醒状态">
          <el-select v-model="reminderForm.status" style="width:100%;">
            <el-option label="进行中" value="active" />
            <el-option label="已暂停" value="paused" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reminderDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reminderSaving" @click="handleCreateReminder">{{ editingReminderId ? '保存修改' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 新建复诊提醒 -->
    <el-dialog v-model="followUpDialogVisible" :title="editingFollowUpReminderId ? '编辑复诊提醒' : '新建复诊提醒'" width="520px">
      <el-form :model="followUpForm" label-width="100px">
        <el-form-item label="提醒标题" required>
          <el-input v-model="followUpForm.title" placeholder="如：门诊复查 / 再次复诊" />
        </el-form-item>
        <el-form-item label="家庭成员">
          <el-select v-model="followUpForm.serviceTargetId" placeholder="选填，不选则为本人" clearable style="width:100%;">
            <el-option v-for="t in serviceTargets" :key="t.id" :value="t.id" :label="t.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="复诊日期" required>
          <el-date-picker v-model="followUpForm.followUpDate" type="date" value-format="YYYY-MM-DD" placeholder="选择复诊日期" style="width:180px;" />
        </el-form-item>
        <el-form-item label="提醒时间">
          <el-time-select
            v-model="followUpForm.reminderTime"
            start="06:00"
            end="22:00"
            step="00:30"
            placeholder="选择时间"
            style="width:130px;"
          />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="复诊医院" required>
              <el-input v-model="followUpForm.hospital" placeholder="请输入复诊医院" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="复诊科室" required>
              <el-input v-model="followUpForm.department" placeholder="请输入复诊科室" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注说明">
          <el-input v-model="followUpForm.instructions" type="textarea" :rows="3" placeholder="补充医生要求、复诊科室或注意事项" />
        </el-form-item>
        <el-form-item label="推送渠道">
          <el-radio-group v-model="followUpForm.channel">
            <el-radio label="mini_program">小程序</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editingFollowUpReminderId" label="提醒状态">
          <el-select v-model="followUpForm.status" style="width:100%;">
            <el-option label="进行中" value="active" />
            <el-option label="已暂停" value="paused" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followUpDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="followUpSaving" @click="handleCreateFollowUpReminder">{{ editingFollowUpReminderId ? '保存修改' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 健康档案全字段编辑 -->
    <el-dialog v-model="healthEditVisible" :title="`编辑健康档案 — ${healthEditTargetName}`" width="660px" destroy-on-close>
      <el-form :model="healthEditForm" label-width="90px" style="max-height:65vh;overflow-y:auto;padding-right:8px;">
        <el-divider content-position="left">紧急联系人</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系人姓名"><el-input v-model="healthEditForm.emergencyContact" placeholder="如：张三" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="与本人关系">
              <el-select v-model="healthEditForm.emergencyRelation" placeholder="请选择关系" style="width:100%">
                <el-option v-for="rel in emergencyRelationOptions" :key="rel" :label="rel" :value="rel" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话"><el-input v-model="healthEditForm.emergencyPhone" placeholder="手机号" /></el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">家庭地址</el-divider>
        <el-form-item label="省市区/县">
          <el-cascader
            v-model="healthEditForm.homeRegion"
            :options="(pcaTextArr as any)"
            :props="{ expandTrigger: 'hover', checkStrictly: false }"
            placeholder="请选择省/市/区县"
            clearable
            filterable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="healthEditForm.homeAddressDetail" placeholder="街道、门牌号等" />
        </el-form-item>
        <el-form-item label="信息记录方式">
          <el-radio-group v-model="healthEditForm.fillMethod">
            <el-radio-button v-for="opt in fillMethodOptions" :key="opt.value" :label="opt.value">{{ opt.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="行动能力">
          <el-radio-group v-model="healthEditForm.mobilityStatus">
            <el-radio-button v-for="opt in mobilityOptions" :key="opt.value" :label="opt.value">{{ opt.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-divider content-position="left">健康状况</el-divider>
        <el-form-item label="血型">
          <el-radio-group v-model="healthEditForm.bloodType">
            <el-radio-button v-for="bt in bloodTypeOptions" :key="bt" :label="bt">{{ bt }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="视力">
          <el-radio-group v-model="healthEditForm.visionStatus">
            <el-radio-button label="good">正常</el-radio-button>
            <el-radio-button label="poor">视力减退</el-radio-button>
            <el-radio-button label="blind">严重视力障碍</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="听力">
          <el-radio-group v-model="healthEditForm.hearingStatus">
            <el-radio-button label="good">正常</el-radio-button>
            <el-radio-button label="poor">听力减退</el-radio-button>
            <el-radio-button label="deaf">严重听力障碍</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="过敏史">
          <el-radio-group v-model="healthEditForm.allergyStatus" style="margin-bottom:8px;">
            <el-radio-button label="none">无</el-radio-button>
            <el-radio-button label="has">有</el-radio-button>
          </el-radio-group>
          <el-input v-if="healthEditForm.allergyStatus === 'has'" v-model="healthEditForm.allergies" type="textarea" :rows="2" placeholder="请描述过敏源" style="margin-top:8px;" />
        </el-form-item>
        <el-divider content-position="left">既往病史（可多选）</el-divider>
        <el-form-item label="病史">
          <el-checkbox-group v-model="healthEditForm.medicalHistory">
            <el-checkbox v-for="opt in medicalHistoryOptions" :key="opt.value" :label="opt.value">{{ opt.label }}</el-checkbox>
          </el-checkbox-group>
          <el-input v-if="healthEditForm.medicalHistory.includes('other')" v-model="healthEditForm.medicalHistoryOther" placeholder="请补充其他病史" style="margin-top:8px;" />
        </el-form-item>
        <el-divider content-position="left">近期状况（可多选）</el-divider>
        <el-form-item label="症状">
          <el-checkbox-group v-model="healthEditForm.recentSymptoms">
            <el-checkbox v-for="opt in recentSymptomsOptions" :key="opt.value" :label="opt.value">{{ opt.label }}</el-checkbox>
          </el-checkbox-group>
          <el-input v-if="healthEditForm.recentSymptoms.includes('other')" v-model="healthEditForm.recentSymptomsOther" placeholder="请描述其他近期症状" style="margin-top:8px;" />
        </el-form-item>
        <el-divider content-position="left">当前用药</el-divider>
        <el-form-item label="用药情况">
          <el-input v-model="healthEditForm.currentMedications" type="textarea" :rows="3"
            placeholder="如：拜阿司匹林 100mg 每日一次、氨氯地平 5mg 每日一次…（无则留空）" />
        </el-form-item>
        <el-divider content-position="left">就医诉求</el-divider>
        <el-form-item label="诉求描述">
          <el-input v-model="healthEditForm.chiefComplaint" type="textarea" :rows="3" placeholder="如：长期头痛需排查原因、糖尿病复查等" />
        </el-form-item>
        <el-divider content-position="left">其他说明</el-divider>
        <el-form-item label="其他说明">
          <el-input v-model="healthEditForm.otherNotes" type="textarea" :rows="3"
            placeholder="如：特殊服务需求、注意事项等（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="healthEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="healthEditSaving" @click="saveHealthProfile">保存并同步到小程序</el-button>
      </template>
    </el-dialog>

    <!-- 编辑家庭成员基本信息 -->
    <el-dialog v-model="basicEditVisible" title="编辑基本信息" width="520px" destroy-on-close>
      <el-form :model="basicEditForm" label-width="110px">
        <el-form-item label="姓名" required>
          <el-input v-model="basicEditForm.name" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="与客户关系" required>
          <el-select v-model="basicEditForm.relationship" placeholder="请选择" style="width:100%;">
            <el-option v-for="opt in relationshipOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="身份证号" required>
          <el-input
            v-model="basicEditForm.idCard"
            placeholder="请输入18位身份证号"
            maxlength="18"
            @input="onBasicIdCardInput(basicEditForm.idCard)"
          />
          <div v-if="basicEditForm.idCardAge !== undefined" style="margin-top:6px;color:#606266;font-size:13px;display:flex;gap:16px;">
            <span>出生：{{ basicEditForm.idCardBirth }}</span>
            <span>年龄：<strong>{{ basicEditForm.idCardAge }}</strong> 岁</span>
            <span style="color:#67c23a;">性别已自动识别</span>
          </div>
          <div v-else-if="basicEditForm.idCard.length === 18" style="margin-top:4px;color:#f56c6c;font-size:12px;">
            身份证号格式有误，请检查
          </div>
        </el-form-item>
        <el-form-item label="性别" required>
          <el-radio-group v-model="basicEditForm.gender">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
          <span style="margin-left:8px;color:#909399;font-size:12px;">（输入身份证后自动填充）</span>
        </el-form-item>
        <el-form-item label="联系电话" required>
          <el-input v-model="basicEditForm.phone" placeholder="请输入联系电话" maxlength="11" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="basicEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="basicEditSaving" @click="saveBasicInfo">保存</el-button>
      </template>
    </el-dialog>

    <!-- 健康档案预览 -->
    <el-dialog v-model="profilePreviewVisible" :title="profilePreviewTitle" width="90%" top="3vh" destroy-on-close>
      <div style="margin-bottom:12px;text-align:right;">
        <el-button type="primary" size="small" @click="openPrintWindow(profilePreviewUrl)"><el-icon><Printer /></el-icon> 打印</el-button>
        <el-button size="small" @click="openInNewWindow(profilePreviewUrl)"><el-icon><TopRight /></el-icon> 新窗口打开</el-button>
      </div>
      <iframe :src="profilePreviewUrl" style="width:100%;height:75vh;border:1px solid #e4e7ed;border-radius:4px;" />
    </el-dialog>

    <!-- 家庭成员档案抽屉（健康档案 / 就医记录 / 用药 / 订单） -->
    <el-drawer
      v-model="memberDrawerVisible"
      direction="rtl"
      :size="memberDrawerSize"
      :with-header="false"
      destroy-on-close
      class="member-profile-drawer"
    >
      <div v-if="drawerTarget" class="drawer-actions">
        <el-button size="small" @click="openBasicEditDialog(drawerTarget)"><el-icon><Edit /></el-icon> 编辑基本信息</el-button>
        <el-button size="small" type="primary" @click="openHealthEditDialog(drawerTarget)"><el-icon><Edit /></el-icon> 填写档案</el-button>
        <el-button size="small" type="info" @click="handleViewProfile(drawerTarget)"><el-icon><View /></el-icon> 查看文档</el-button>
        <el-button size="small" type="success" @click="handlePrintProfile(drawerTarget)"><el-icon><Printer /></el-icon> 打印</el-button>
        <el-button
          v-if="!hasUserSignature(drawerTarget)"
          size="small"
          type="warning"
          :loading="healthSignQrLoading && healthSignQrTargetId === drawerTarget.id"
          @click="generateHealthSignQrcode(drawerTarget.id)"
        ><el-icon><Document /></el-icon> 生成签署二维码</el-button>
        <el-button size="small" type="danger" @click="handleDeleteTarget(drawerTarget)"><el-icon><Delete /></el-icon> 删除</el-button>
      </div>
      <div
        v-if="drawerTarget && healthSignQrDataUrl && healthSignQrTargetId === drawerTarget.id"
        class="drawer-qrcode"
      >
        <p class="drawer-qrcode__hint">客户用微信扫码后可直接进入签署页面</p>
        <img :src="healthSignQrDataUrl" alt="健康档案签署二维码" />
      </div>
      <div
        v-else-if="selectedFamilyMember && !drawerTarget"
        class="drawer-actions drawer-actions--empty"
      >
        <span class="drawer-actions__tip">该成员尚未建立健康档案</span>
        <el-button size="small" type="primary" @click="openProfileDialog">新增档案</el-button>
      </div>
      <FamilyMemberProfile :member="selectedFamilyMember" :family-name="selectedFamilyName" />
    </el-drawer>

    <!-- 家庭邀请小程序码 -->
    <el-dialog
      v-model="inviteQrDialogVisible"
      :title="`邀请加入「${inviteQrData?.familyName || '家庭'}」`"
      width="420px"
      destroy-on-close
    >
      <div v-loading="inviteQrLoading" style="text-align:center;padding:8px 0 4px;">
        <template v-if="inviteQrData">
          <img
            :src="`data:image/png;base64,${inviteQrData.imageBase64}`"
            alt="家庭邀请二维码"
            style="width:240px;height:240px;border:1px solid #e4e7ed;border-radius:8px;"
          />
          <div style="margin-top:12px;font-size:13px;color:#606266;">
            客户家人用微信扫一扫后即可进入小程序加入家庭
          </div>
          <div style="margin-top:10px;">
            <span style="color:#909399;">邀请码：</span>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:600;color:#303133;">
              {{ inviteQrData.inviteCode }}
            </span>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="copyInviteCode" :disabled="!inviteQrData">复制邀请码</el-button>
        <el-button type="primary" @click="downloadInviteQrcode" :disabled="!inviteQrData">下载二维码</el-button>
      </template>
    </el-dialog>

    <!-- AI 健康周报详情 -->
    <el-dialog
      v-model="weeklyDetailVisible"
      :title="weeklyDetailData?.title || 'AI 健康周报'"
      width="720px"
      destroy-on-close
    >
      <div v-if="weeklyDetailData" class="weekly-detail">
        <el-descriptions :column="2" border size="small" label-width="90px">
          <el-descriptions-item label="周期" :span="2">
            {{ formatDateOnly(weeklyDetailData.periodStart) }}
            ~
            {{ formatDateOnly(weeklyDetailData.periodEnd) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="weeklyDetailData.createdAt" label="生成时间" :span="2">
            {{ formatDate(weeklyDetailData.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="weekly-detail__section">
          <div class="weekly-detail__section-title">摘要</div>
          <div class="weekly-detail__text">{{ weeklyDetailData.summary || '—' }}</div>
        </div>

        <div v-if="weeklyDetailData.content || weeklyDetailData.detail" class="weekly-detail__section">
          <div class="weekly-detail__section-title">详细分析</div>
          <div class="weekly-detail__text">{{ weeklyDetailData.content || weeklyDetailData.detail }}</div>
        </div>

        <div v-if="weeklyDetailData.suggestions || weeklyDetailData.advice" class="weekly-detail__section">
          <div class="weekly-detail__section-title">建议</div>
          <div class="weekly-detail__text">{{ weeklyDetailData.suggestions || weeklyDetailData.advice }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.overview-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.overview-stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #eef2f7;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
  }

  &--warn {
    border-color: #fcd34d;
    background: #fffbeb;
  }
}

.overview-stat-num {
  font-size: 26px;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.1;
}

.overview-stat-label {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
}

.overview-urgent {
  margin-bottom: 12px;
  border-radius: 10px;
}

.weekly-detail {
  &__section {
    margin-top: 14px;
  }

  &__section-title {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 6px;
  }

  &__text {
    font-size: 14px;
    line-height: 1.7;
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

@media (max-width: 900px) {
  .overview-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;

  &--empty {
    align-items: center;
    justify-content: space-between;
  }

  &__tip {
    color: #94a3b8;
    font-size: 13px;
  }
}

.drawer-qrcode {
  padding: 14px 18px;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;

  &__hint {
    font-size: 12px;
    color: #909399;
    margin: 0 0 8px;
  }

  img {
    width: 200px;
    height: 200px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: $space-3;
  margin-bottom: $space-3;
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
  font-size: $font-sm;
  color: $text-tertiary;
  line-height: 1.6;
}

.page-header__actions {
  display: flex;
  gap: $space-2;
  flex-wrap: wrap;
}

.page-guide {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2;
  margin-bottom: $space-3;
}

.page-guide__label {
  font-size: $font-xs;
  color: $text-tertiary;
  font-weight: 600;
}

.customer-layout {
  display: flex;
  gap: $space-4;
  align-items: flex-start;
}

.customer-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.customer-main {
  flex: 1;
  min-width: 0;
}

.sidebar-card {
  border-radius: $radius-md;
}

// 身份卡
.sidebar-identity {
  text-align: center;
}
.identity-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-600, $primary-400);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
}
.identity-name {
  font-size: 17px;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: 4px;
}
.identity-phone {
  font-size: $font-sm;
  color: $text-tertiary;
  margin-bottom: 10px;
}
.identity-tags {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.identity-info-block {
  width: 100%;
  background: $bg-alt;
  border-radius: $radius-md;
  padding: 10px 14px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.identity-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: $font-sm;
}
.identity-info-label {
  color: $text-tertiary;
}
.identity-info-val {
  color: $text-primary;
  font-weight: 500;

  &--accent {
    color: $primary-600;
    font-weight: 600;
  }
}
.identity-actions {
  display: flex;
  gap: $space-2;
  justify-content: center;
}

// 数据速览
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-2;
}
.stat-item {
  text-align: center;
  padding: 8px 4px;
  background: $bg-alt;
  border-radius: $radius-sm;
}
.stat-val {
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.stat-val--active {
  color: $danger;
}
.stat-val--reminder {
  color: $warning;
}
.stat-label {
  font-size: $font-xs;
  color: $text-tertiary;
  margin-top: 2px;
}

// KV 行
.sidebar-section-title {
  font-size: $font-sm;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 10px;
}
.sidebar-kv {
  display: flex;
  justify-content: space-between;
  font-size: $font-sm;
  color: $text-secondary;
  padding: 4px 0;
  border-bottom: 1px dashed $divider;
}
.sidebar-kv:last-child { border-bottom: none; }

// 服务对象列表
.target-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.target-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: $radius-sm;
  border: 1px solid transparent;
  transition: all 0.18s;
  margin-bottom: 2px;
}
.target-chip:hover {
  background: $bg-alt;
  border-color: $border-lighter;
}
.target-chip--active {
  background: rgba($primary-500, 0.08);
  border-color: $primary-500 !important;
}
.target-chip--active .target-chip-name {
  color: $primary-600;
  font-weight: 600;
}
.target-chip-name {
  font-size: $font-sm;
  color: $text-primary;
  font-weight: 500;
}

// 服务对象筛选提示条（原来三处内联 style）
.filter-hint {
  display: flex;
  align-items: center;
  gap: $space-2;
  margin-bottom: $space-3;
  padding: 8px 12px;
  border-radius: $radius-sm;
  font-size: $font-sm;

  .el-icon { flex-shrink: 0; }

  &--primary {
    background: rgba($primary-500, 0.08);
    border: 1px solid rgba($primary-500, 0.2);
    color: $primary-700;
    .el-icon { color: $primary-600; }
  }
  &--success {
    background: rgba($success, 0.08);
    border: 1px solid rgba($success, 0.2);
    color: darken($success, 12%);
    .el-icon { color: $success; }
  }
  &--warning {
    background: rgba($warning, 0.08);
    border: 1px solid rgba($warning, 0.2);
    color: darken($warning, 15%);
    .el-icon { color: $warning; }
  }
}

.customer-service-card {
  border-radius: $radius-lg;
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
  color: $text-primary;
  line-height: 1.4;
}

.customer-service-card__summary {
  margin-top: 4px;
  color: $text-secondary;
  line-height: 1.6;
  font-size: $font-sm;
}

.customer-service-card__actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.customer-service-card__meta {
  margin-top: $space-3;
  display: flex;
  gap: $space-2;
  flex-wrap: wrap;
}

.customer-service-card__meta-item {
  min-width: 150px;
  padding: 8px 10px;
  background: $bg-alt;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-service-card__meta-label {
  font-size: $font-xs;
  color: $text-tertiary;
  line-height: 1.2;
}

.customer-service-card__meta-value {
  font-size: $font-sm;
  font-weight: 600;
  color: $text-primary;
  line-height: 1.4;
}

.customer-service-card__note {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba($warning, 0.1);
  border-radius: 10px;
  color: darken($warning, 20%);
  line-height: 1.6;
  font-size: $font-sm;
}

// 健康档案描述列表
:deep(.hp-label) {
  width: 90px !important;
  min-width: 90px !important;
  white-space: nowrap;
}
.hp-text-wrap {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.6;
  max-height: 120px;
  overflow-y: auto;
}

// 家庭 Tab
.family-tab .family-card {
  border-radius: 10px;
  border: 1px solid #edf1f5;
}
.family-tab .family-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.family-tab .family-card__header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}
.family-tab .family-card__header-titles {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  min-width: 0;
}
.family-tab .family-card__avatar-wrap {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(46, 134, 240, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.family-tab .family-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.family-tab .family-card__avatar-emoji {
  font-size: 24px;
  line-height: 1;
}
.family-tab .family-card__name {
  font-weight: 600;
  font-size: 15px;
  color: $text-primary;
}
.family-tab :deep(.family-members-table .el-table__row) {
  cursor: pointer;
}
.family-tab :deep(.family-members-table .el-table__row:hover) {
  background: #f5f9ff !important;
}

@media (max-width: 900px) {
  .customer-layout {
    flex-direction: column;
  }
  .customer-sidebar {
    width: 100%;
  }
  .customer-service-card {
    max-width: 100%;
  }
  .customer-service-card__meta-item {
    min-width: calc(50% - 8px);
  }
}

/* ─────────── 家庭成员档案卡片（可展开/收起） ─────────── */
.profile-card :deep(.el-card__header) {
  padding: 12px 18px;
}

.profile-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.profile-card__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
  transition: color 0.2s ease;

  &:hover {
    color: #3b82f6;
  }
}

.profile-card__expand-ico {
  transition: transform 0.22s ease;
  color: #94a3b8;

  &.is-open {
    transform: rotate(90deg);
    color: #3b82f6;
  }
}

.profile-card__name {
  font-weight: 700;
  font-size: 15px;
  color: #1f2937;
}

.profile-card__chip-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-left: 4px;
}

.profile-card__chip-more {
  font-size: 12px;
  color: #94a3b8;
  padding: 2px 6px;
  background: #f1f5f9;
  border-radius: 4px;
}

.profile-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
