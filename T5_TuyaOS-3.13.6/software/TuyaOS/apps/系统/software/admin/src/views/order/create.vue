<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createOrder } from '@/api/order'
import {
  getCustomerDetail,
  getServiceTargetDirectoryList,
  getServiceTargets,
} from '@/api/customer'
import { getAttendantList, listServiceStaffRoleConfigs } from '@/api/attendant'
import type { ServiceStaffRole, ServiceStaffRoleConfig } from '@/api/attendant'
import { updateConsultationStatus } from '@/api/consultation'
import { getConfig } from '@/api/system'
import { listHospitals } from '@/api/hospital'
import { listProfessionalServices } from '@/api/professional-service'
import type {
  ProfessionalServiceItem,
  ProfessionalServiceCategory,
} from '@/api/professional-service'
import { LISHUI_OPTIONAL_ITEMS } from '@/constants/lishui-optional-items'

/**
 * 业务服务大类。
 * 与「服务类型字符串」解耦：大类决定表单显示哪些字段，最终保存到 order.serviceType
 * 的仍是具体服务名称或专业服务 code。
 */
type ServiceCategory = 'escort' | 'checkup' | 'professional' | 'medical_coord'

const SERVICE_CATEGORY_META: Record<
  ServiceCategory,
  { label: string; icon: string; color: string; description: string }
> = {
  escort: {
    label: '陪诊服务',
    icon: 'medical_services',
    color: '#4CAF50',
    description: '门诊陪诊、陪检陪查、VIP 专家就医陪同等',
  },
  checkup: {
    label: '体检预约',
    icon: 'monitor_heart',
    color: '#0EA5E9',
    description: '体检套餐预约与附加项目选择',
  },
  professional: {
    label: '专业服务',
    icon: 'health_and_safety',
    color: '#F97316',
    description: '营养咨询 / 康复指导 / 护理对接 / 心理支持 / 月嫂母婴',
  },
  medical_coord: {
    label: '医疗资源协调',
    icon: 'support_agent',
    color: '#6366F1',
    description: 'VIP 医疗资源协调、门诊咨询、到店接待、代取报告等',
  },
}

/** 医疗资源协调子选项（保留历史兼容） */
const MEDICAL_COORD_OPTIONS = [
  { label: 'VIP医疗资源协调', value: 'VIP医疗资源协调' },
  { label: '门诊咨询', value: '门诊咨询' },
  { label: '到店预约', value: '到店预约' },
  { label: '代取报告/药', value: '代取报告' },
] as const

/**
 * 服务类别 → 默认匹配的服务人员主角色。
 * 用于筛选派单候选人。
 */
const CATEGORY_TO_ROLE: Record<ProfessionalServiceCategory, ServiceStaffRole> = {
  nutrition: 'nutritionist',
  rehabilitation: 'rehabilitator',
  nursing: 'nurse',
  psychology: 'psychologist',
  maternal_child: 'maternal_care',
}

const route = useRoute()
const router = useRouter()
const saving = ref(false)

const archiveOptions = ref<any[]>([])
const serviceTargetOptions = ref<any[]>([])
const attendantOptions = ref<any[]>([])
const archiveLoading = ref(false)
/** 从名录点选时的展示文案，用于区分「仍绑定名录」与「已改成手填」 */
const hospitalDirectoryPickedLine = ref('')
let hospitalSearchRequestSeq = 0
/** 当前选中的健康档案行（含 owner，用于展示微信账号） */
const selectedArchive = ref<any>(null)

interface OptionalItem { id: string; name: string; price: number; unit?: string; status?: boolean }
interface CheckupPackage { id: string; name: string; gender: string; price: number; [k: string]: any }
interface CheckupRegion { id: string; name: string; hospital: string; packages: CheckupPackage[]; optionalItems?: OptionalItem[] }
interface AdditionalServiceItem { id: string; selection: string; customName: string; amount: number; note?: string }
interface AdditionalServiceOption { label: string; fee: number; status?: boolean }
interface AdditionalServiceOptionGroup { label: string; options: { label: string; value: string; fee: number }[] }
interface DepartmentOptionGroup { label: string; options: string[] }
const ORDER_RISK_OPTIONS = [
  { label: 'L1低风险', value: 'L1' },
  { label: 'L2中风险', value: 'L2' },
] as const
const checkupRegions = ref<CheckupRegion[]>([])
const escortPricingOptions = ref<AdditionalServiceOption[]>([])
const valueAddedServiceOptions = ref<AdditionalServiceOption[]>([])
const additionalServiceOptions = ref<AdditionalServiceOption[]>([])
const ADDITIONAL_CUSTOM_VALUE = '__custom__'
const HOT_DEPARTMENTS = [
  '内科',
  '外科',
  '全科医学科',
  '急诊科',
  '口腔科',
  '心内科',
  '神经内科',
  '呼吸内科',
  '消化内科',
  '骨科',
  '妇科',
  '产科',
  '儿科',
  '眼科',
  '耳鼻喉科',
  '皮肤科',
  '泌尿外科',
  '肿瘤科',
] as const
const COMMON_DEPARTMENTS = [
  '心血管内科',
  '内分泌科',
  '肾内科',
  '血液内科',
  '风湿免疫科',
  '感染科',
  '老年医学科',
  '精神心理科',
  '康复医学科',
  '疼痛科',
  '中医科',
  '中西医结合科',
  '普通外科',
  '胃肠外科',
  '肝胆外科',
  '甲状腺乳腺外科',
  '神经外科',
  '胸外科',
  '心胸外科',
  '血管外科',
  '烧伤整形科',
  '肛肠科',
  '脊柱外科',
  '关节外科',
  '手外科',
  '运动医学科',
  '妇产科',
  '生殖医学科',
  '儿童保健科',
  '新生儿科',
  '小儿外科',
  '小儿内科',
  '口腔正畸科',
  '口腔种植科',
  '口腔修复科',
  '口腔颌面外科',
  '眼底病科',
  '视光中心',
  '白内障科',
  '青光眼科',
  '耳科',
  '鼻科',
  '咽喉科',
  '头颈外科',
  '皮肤美容科',
  '男科',
  '肾病科',
  '肿瘤内科',
  '肿瘤放疗科',
  '介入科',
  '放射科',
  '超声科',
  '核医学科',
  '麻醉科',
  '病理科',
  '检验科',
  '体检中心',
  '预防保健科',
  '营养科',
  '药剂科',
  '门诊部',
  '住院部',
  '高压氧科',
  '职业病科',
  '医学影像科',
  '变态反应科',
  '临床心理科',
  '睡眠医学科',
  '疼痛门诊',
  '发热门诊',
  '互联网医院',
] as const

function buildDepartmentGroups(): DepartmentOptionGroup[] {
  const hot = Array.from(new Set(HOT_DEPARTMENTS)) as string[]
  const common = Array.from(new Set(COMMON_DEPARTMENTS.filter(item => !hot.includes(item)))) as string[]
  return [
    { label: '热门科室', options: hot },
    { label: '常见科室', options: common },
  ]
}

const departmentOptionGroups = buildDepartmentGroups()
const DEFAULT_ESCORT_PRICING_OPTIONS: AdditionalServiceOption[] = [
  { label: '本地陪诊·青田县城', fee: 488, status: true },
  { label: '跨城陪诊·丽水/温州周边', fee: 598, status: true },
  { label: '跨城陪诊·杭州/宁波方向', fee: 1280, status: true },
  { label: '跨城陪诊·上海', fee: 1580, status: true },
  { label: '跨城陪诊·北京/省外长途', fee: 2280, status: true },
]
const DEFAULT_VALUE_ADDED_SERVICE_OPTIONS: AdditionalServiceOption[] = [
  { label: '夜间陪同 +200/晚', fee: 200, status: true },
  { label: '住宿陪同 +100/晚', fee: 100, status: true },
  { label: '次日续陪 +300/日', fee: 300, status: true },
  { label: '次日续陪·北京 +400/日', fee: 400, status: true },
]

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

function looksLikeAttendantPayoutPricing(items: AdditionalServiceOption[]) {
  return items.some(item =>
    item.label.includes('青田半日')
    || item.label.includes('青田全日')
    || item.label.includes('温州丽水（全日）')
    || item.label.includes('杭州上海（全日）')
    || item.label.includes('北京（全日）'),
  )
}

const form = reactive({
  userId: undefined as number | undefined,
  serviceTargetId: undefined as number | undefined,
  /** 服务大类，驱动表单字段显示逻辑 */
  serviceCategory: 'escort' as ServiceCategory,
  /** 最终保存的服务类型文本（大类 + 子选择联动产生） */
  serviceType: '',
  /** 医疗资源协调下的子选项 */
  medicalCoordSubType: '',
  /** 专业服务目录项 ID（category === 'professional' 时必填） */
  professionalServiceId: undefined as number | undefined,
  riskLevel: '',
  escortServiceOption: '',
  serviceTime: '',
  serviceEndTime: null as string | Date | null,
  hospitalDirectoryId: null as number | null,
  hospital: '',
  department: '',
  hospitalBookingStatus: '' as '' | 'booked' | 'pending_cs',
  baseFee: undefined as number | undefined,
  totalFee: undefined as number | undefined,
  attendantId: undefined as number | undefined,
  needAttendant: true,
  /** 服务地址：专业服务多为上门，保存文本 */
  serviceAddress: '',
  notes: '',
  checkupPackageName: '',
  checkupGender: '' as '' | 'male' | 'female',
  checkupOptionalItemIds: [] as string[],
  additionalServiceItems: [] as AdditionalServiceItem[],
})

const professionalServiceOptions = ref<ProfessionalServiceItem[]>([])
const professionalServiceLoading = ref(false)
const roleConfigs = ref<ServiceStaffRoleConfig[]>([])

const selectedProfessionalService = computed<ProfessionalServiceItem | null>(() => {
  const id = form.professionalServiceId
  if (!id) return null
  return professionalServiceOptions.value.find(item => item.id === id) || null
})

/** 当前服务大类 → 建议匹配的服务人员主角色 */
const suggestedStaffRole = computed<ServiceStaffRole | null>(() => {
  if (form.serviceCategory === 'professional') {
    const cat = selectedProfessionalService.value?.category
    return cat ? CATEGORY_TO_ROLE[cat] ?? null : null
  }
  if (form.serviceCategory === 'escort') return 'attendant'
  return null
})

const suggestedRoleConfig = computed<ServiceStaffRoleConfig | null>(() => {
  const role = suggestedStaffRole.value
  if (!role) return null
  return roleConfigs.value.find(c => c.role === role) || null
})

/** 大类驱动的字段可见性 */
const showHospitalFields = computed(
  () => form.serviceCategory === 'escort' || form.serviceCategory === 'checkup',
)
const showEscortPricing = computed(() => form.serviceCategory === 'escort')
const showRiskLevel = computed(
  () => form.serviceCategory === 'escort' || form.serviceCategory === 'professional',
)
const showMedicalCoordSubType = computed(() => form.serviceCategory === 'medical_coord')
const showProfessionalSelect = computed(() => form.serviceCategory === 'professional')
const showServiceAddress = computed(
  () => form.serviceCategory === 'professional' || form.serviceCategory === 'medical_coord',
)
const needAttendantLabel = computed(() => {
  switch (form.serviceCategory) {
    case 'professional':
      return suggestedRoleConfig.value
        ? `是否指派${suggestedRoleConfig.value.label}`
        : '是否指派服务人员'
    case 'checkup':
      return '是否指派体检陪同人员'
    case 'medical_coord':
      return '是否指派协调人员'
    default:
      return '是否需要陪诊员'
  }
})
const attendantSelectLabel = computed(() => {
  if (form.serviceCategory === 'professional' && suggestedRoleConfig.value) {
    return `指派${suggestedRoleConfig.value.label}`
  }
  return '指派服务人员'
})

const rules = {
  serviceTargetId: [
    { required: true, message: '请选择健康档案（服务对象）', trigger: 'change' },
    {
      validator: (_: unknown, __: unknown, cb: (e?: Error) => void) => {
        if (!form.userId) cb(new Error('请从列表中选择一条健康档案'))
        else cb()
      },
      trigger: 'change',
    },
  ],
  serviceCategory: [{ required: true, message: '请选择服务大类', trigger: 'change' }],
  serviceTime: [{ required: true, message: '请选择服务开始时间', trigger: 'change' }],
  serviceEndTime: [
    {
      validator: (_: unknown, __: unknown, cb: (e?: Error) => void) => {
        if (!form.serviceEndTime) {
          cb()
          return
        }
        const start = form.serviceTime ? new Date(form.serviceTime as unknown as Date) : null
        const end = new Date(form.serviceEndTime as unknown as Date)
        if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          cb()
          return
        }
        if (end < start) cb(new Error('结束时间不能早于开始时间'))
        else cb()
      },
      trigger: 'change',
    },
  ],
}

const formRef = ref<any>(null)

function toIsoWithLocalOffset(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const offsetHour = pad(Math.floor(abs / 60))
  const offsetMinute = pad(abs % 60)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offsetHour}:${offsetMinute}`
}

function archiveOptionLabel(row: any) {
  const nick = row?.owner?.nickname || '未命名账号'
  const phone = row?.owner?.phone || '无手机'
  const name = row?.name || '未命名档案'
  return `${name} · 档案#${row.id} · ${nick}（${phone}）`
}

async function loadArchiveCandidates(keyword?: string) {
  archiveLoading.value = true
  try {
    const res = await getServiceTargetDirectoryList({
      keyword: keyword?.trim() || undefined,
      page: 1,
      pageSize: 50,
    })
    archiveOptions.value = res.items || []
  } catch {
    archiveOptions.value = []
  } finally {
    archiveLoading.value = false
  }
}

function onArchiveSearch(query: string) {
  void loadArchiveCandidates(query || undefined)
}

function applyArchiveSelection(row: any | null) {
  if (!row) {
    selectedArchive.value = null
    form.userId = undefined
    form.serviceTargetId = undefined
    serviceTargetOptions.value = []
    form.notes = ''
    return
  }
  form.userId = row.userId
  form.serviceTargetId = row.id
  selectedArchive.value = row
}

function onArchivePick(serviceTargetId: number | undefined | null) {
  if (serviceTargetId == null || Number.isNaN(Number(serviceTargetId))) {
    applyArchiveSelection(null)
    return
  }
  const row = archiveOptions.value.find((r: any) => r.id === serviceTargetId)
  if (row) applyArchiveSelection(row)
}

async function loadAttendants() {
  try {
    const res = await getAttendantList({ page: 1, pageSize: 100 })
    attendantOptions.value = res.items || []
  } catch { /* ignored */ }
}

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
  form.additionalServiceItems.push(createAdditionalServiceItem())
}

function removeAdditionalServiceItem(index: number) {
  form.additionalServiceItems.splice(index, 1)
}

function getAdditionalServiceOption(label?: string) {
  return [...valueAddedServiceOptions.value, ...additionalServiceOptions.value].find(item => item.label === label)
}

function handleAdditionalServiceSelectionChange(item: AdditionalServiceItem, value: string) {
  if (value === ADDITIONAL_CUSTOM_VALUE) {
    item.customName = ''
    item.amount = 0
    return
  }
  const option = getAdditionalServiceOption(value)
  item.customName = ''
  item.amount = Number(option?.fee || 0)
}

function formatDirectoryHospitalLine(h: { name: string; city?: string; district?: string | null }) {
  const city = h.city || ''
  const dist = h.district ? String(h.district) : ''
  return dist ? `${h.name}（${city}${dist}）` : `${h.name}（${city}）`
}

function querySearchHospital(queryString: string, cb: (arg: { value: string; id: number }[]) => void) {
  const q = (queryString || '').trim()
  if (!q) {
    cb([])
    return
  }
  const seq = ++hospitalSearchRequestSeq
  listHospitals({ keyword: q, page: 1, pageSize: 30 })
    .then((res: any) => {
      if (seq !== hospitalSearchRequestSeq) return
      const items = (res.items || []).map((h: any) => ({
        value: formatDirectoryHospitalLine(h),
        id: Number(h.id),
      }))
      cb(items)
    })
    .catch(() => {
      if (seq !== hospitalSearchRequestSeq) return
      cb([])
    })
}

function onHospitalAutocompleteSelect(item: Record<string, any>) {
  form.hospitalDirectoryId = Number(item.id)
  form.hospital = String(item.value || '')
  hospitalDirectoryPickedLine.value = String(item.value || '')
}

function onHospitalAutocompleteClear() {
  form.hospitalDirectoryId = null
  hospitalDirectoryPickedLine.value = ''
}

function categoryLabel(cat: ProfessionalServiceCategory): string {
  const map: Record<ProfessionalServiceCategory, string> = {
    nutrition: '营养',
    rehabilitation: '康复',
    nursing: '护理',
    psychology: '心理',
    maternal_child: '母婴',
  }
  return map[cat] || cat
}

function categoryTagType(cat: ProfessionalServiceCategory): 'success' | 'warning' | 'primary' | 'info' | 'danger' {
  const map: Record<ProfessionalServiceCategory, 'success' | 'warning' | 'primary' | 'info' | 'danger'> = {
    nutrition: 'success',
    rehabilitation: 'warning',
    nursing: 'primary',
    psychology: 'info',
    maternal_child: 'danger',
  }
  return map[cat] || 'info'
}

function resolveFinalServiceType(): string {
  const cat = form.serviceCategory
  if (cat === 'escort') return '陪诊服务'
  if (cat === 'checkup') return '体检预约'
  if (cat === 'medical_coord') return form.medicalCoordSubType
  if (cat === 'professional') {
    const svc = selectedProfessionalService.value
    return svc ? svc.code : ''
  }
  return ''
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  // 大类级别的必填校验
  if (form.serviceCategory === 'checkup') {
    if (!form.checkupPackageName) { ElMessage.warning('请选择体检套餐'); return }
    if (!form.checkupGender) { ElMessage.warning('请选择性别'); return }
  }
  if (form.serviceCategory === 'medical_coord' && !form.medicalCoordSubType) {
    ElMessage.warning('请选择具体的医疗协调服务项')
    return
  }
  if (form.serviceCategory === 'professional' && !form.professionalServiceId) {
    ElMessage.warning('请选择具体的专业服务项目')
    return
  }

  const finalServiceType = resolveFinalServiceType()
  if (!finalServiceType) { ElMessage.warning('未能确定服务类型'); return }
  form.serviceType = finalServiceType

  saving.value = true
  try {
    const payload: any = {
      userId: form.userId,
      serviceTargetId: form.serviceTargetId,
      serviceType: finalServiceType,
      serviceTime: toIsoWithLocalOffset(form.serviceTime),
    }
    if (form.serviceEndTime) {
      payload.serviceEndTime = toIsoWithLocalOffset(form.serviceEndTime)
    }
    if (form.riskLevel && showRiskLevel.value) payload.riskLevel = form.riskLevel
    if (form.serviceCategory === 'escort') {
      if (!form.escortServiceOption) { ElMessage.warning('请选择陪诊项目'); return }
      payload.attendantFeeType = form.escortServiceOption
    }
    if (form.serviceCategory === 'professional' && selectedProfessionalService.value) {
      payload.professionalServiceCode = selectedProfessionalService.value.code
      payload.professionalServiceCategory = selectedProfessionalService.value.category
    }
    if (showServiceAddress.value && form.serviceAddress.trim()) {
      payload.serviceAddress = form.serviceAddress.trim()
    }
    const hTrim = (form.hospital || '').trim()
    let dirId: number | null =
      form.hospitalDirectoryId != null && Number.isFinite(Number(form.hospitalDirectoryId))
        ? Number(form.hospitalDirectoryId)
        : null
    if (dirId != null) {
      const line = (hospitalDirectoryPickedLine.value || '').trim()
      if (line && hTrim && hTrim !== line) {
        dirId = null
      }
    }
    if (showHospitalFields.value) {
      if (dirId != null) payload.hospitalDirectoryId = dirId
      if (hTrim) payload.hospital = hTrim
      if (form.department) payload.department = form.department
      if (form.hospitalBookingStatus === 'booked' || form.hospitalBookingStatus === 'pending_cs') {
        payload.hospitalBookingStatus = form.hospitalBookingStatus
      }
    }
    if (form.baseFee !== undefined && form.baseFee !== null) payload.baseFee = form.baseFee
    payload.totalFee = computedTotalFee.value
    if (form.attendantId) payload.attendantId = form.attendantId
    if (form.needAttendant !== undefined) payload.needAttendant = form.needAttendant
    if (form.notes) payload.notes = form.notes
    payload.additionalServiceItems = form.additionalServiceItems
      .filter(item => (item.selection === ADDITIONAL_CUSTOM_VALUE ? item.customName.trim() : item.selection.trim()))
      .map(item => ({
        id: item.id,
        name: item.selection === ADDITIONAL_CUSTOM_VALUE ? item.customName.trim() : item.selection.trim(),
        amount: Number(item.amount || 0),
        note: item.note?.trim() || '',
      }))
    if (form.serviceCategory === 'checkup') {
      payload.checkupPackageName = form.checkupPackageName
      payload.checkupGender = form.checkupGender
      if (form.checkupOptionalItemIds?.length) {
        const items = availableOptionalItems.value.filter(o => form.checkupOptionalItemIds.includes(o.id))
        payload.checkupOptionalItems = items.map(o => ({ id: o.id, name: o.name, price: Number(o.price) }))
      }
    }

    const res = await createOrder(payload)
    const consultationId = route.query.consultationId
    if (consultationId) {
      try {
        await updateConsultationStatus(Number(consultationId), 'order_accepted')
      } catch { /* 标记失败不影响主流程 */ }
    }

    const successMessage = (() => {
      if (form.serviceCategory === 'escort') {
        return '订单创建成功。客户可在微信小程序「服务 → 订单详情」打开《陪诊服务确认单》阅读并手写签署，签署后后台订单详情会自动同步。如需纸质版，请在订单详情「单据打印」中生成预览。'
      }
      if (form.serviceCategory === 'professional' && suggestedRoleConfig.value) {
        return `订单创建成功。可在订单详情中将该订单指派给${suggestedRoleConfig.value.label}，服务人员工作台会按角色变装接单并执行相应 SOP。`
      }
      if (form.serviceCategory === 'checkup') {
        return '体检订单创建成功。可在订单详情中补充体检时间、项目结果与发票凭证。'
      }
      return '订单创建成功'
    })()
    ElMessage.success(successMessage)

    router.push(`/service/orders/detail/${res.id}`)
  } catch {
    ElMessage.error('创建失败')
  } finally {
    saving.value = false
  }
}

async function loadCheckupPackages() {
  try {
    const val = await getConfig('checkup_packages')
    if (val) {
      checkupRegions.value = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val))
      for (const r of checkupRegions.value) {
        if (r.hospital?.includes('丽水市中心医院') && (!r.optionalItems || r.optionalItems.length === 0)) {
          r.optionalItems = JSON.parse(JSON.stringify(LISHUI_OPTIONAL_ITEMS))
        }
        if (!r.optionalItems) r.optionalItems = []
      }
    } else checkupRegions.value = []
  } catch { checkupRegions.value = [] }
}

async function loadEscortPricing() {
  try {
    const val = await getConfig('service_pricing')
    if (val) {
      const items = normalizeServiceOptions(
        JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)),
      )
      if (!looksLikeAttendantPayoutPricing(items)) {
        escortPricingOptions.value = items.filter(item => item.status !== false && !item.label.includes('增值'))
        return
      }
    }
  } catch {}
  escortPricingOptions.value = DEFAULT_ESCORT_PRICING_OPTIONS.filter(item => item.status !== false)
}

async function loadValueAddedServiceOptions() {
  try {
    const val = await getConfig('value_added_service_pricing')
    if (val !== undefined && val !== null) {
      valueAddedServiceOptions.value = normalizeServiceOptions(
        JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)),
      ).filter(item => item.status !== false)
      return
    }
  } catch {}
  valueAddedServiceOptions.value = DEFAULT_VALUE_ADDED_SERVICE_OPTIONS.filter(item => item.status !== false)
}

async function loadAdditionalServiceOptions() {
  try {
    const val = await getConfig('customer_additional_fee_pricing')
    if (val !== undefined && val !== null) {
      additionalServiceOptions.value = normalizeServiceOptions(
        JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)),
      ).filter(item => item.status !== false)
      return
    }
  } catch {}
  additionalServiceOptions.value = []
}

async function loadProfessionalServices() {
  professionalServiceLoading.value = true
  try {
    const res: any = await listProfessionalServices({ enabled: true, pageSize: 200 })
    professionalServiceOptions.value = (res?.items || []).filter(
      (item: ProfessionalServiceItem) => item.enabled,
    )
  } catch {
    professionalServiceOptions.value = []
  } finally {
    professionalServiceLoading.value = false
  }
}

async function loadRoleConfigs() {
  try {
    const res = await listServiceStaffRoleConfigs()
    roleConfigs.value = Array.isArray(res) ? res : []
  } catch {
    roleConfigs.value = []
  }
}

function parsePriceDisplayToNumber(text?: string | null): number | undefined {
  if (!text) return undefined
  const match = String(text).match(/(\d{2,6})/)
  if (!match) return undefined
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * 按专业服务类别过滤候选服务人员。failure 静默降级到全部陪诊员。
 */
async function reloadAttendantsForCategory() {
  const role = suggestedStaffRole.value
  try {
    const params: any = { page: 1, pageSize: 100 }
    if (role && role !== 'attendant') params.primaryRole = role
    const res: any = await getAttendantList(params)
    attendantOptions.value = res?.items || []
  } catch {
    attendantOptions.value = []
  }
}

const additionalServiceSelectGroups = computed<AdditionalServiceOptionGroup[]>(() => {
  const groups: AdditionalServiceOptionGroup[] = []
  if (valueAddedServiceOptions.value.length) {
    groups.push({
      label: '增值服务',
      options: valueAddedServiceOptions.value.map(item => ({ label: item.label, value: item.label, fee: item.fee })),
    })
  }
  if (additionalServiceOptions.value.length) {
    groups.push({
      label: '附加服务',
      options: additionalServiceOptions.value.map(item => ({ label: item.label, value: item.label, fee: item.fee })),
    })
  }
  groups.push({
    label: '其他',
    options: [{ label: '其他附加费用', value: ADDITIONAL_CUSTOM_VALUE, fee: 0 }],
  })
  return groups
})

function checkupPackageOptions(): { label: string; value: string; pkg: CheckupPackage; region: CheckupRegion }[] {
  const gender = form.checkupGender
  const list: { label: string; value: string; pkg: CheckupPackage; region: CheckupRegion }[] = []
  for (const r of checkupRegions.value) {
    for (const p of r.packages || []) {
      if (!p.status) continue
      if (gender && p.gender !== 'all' && p.gender !== gender) continue
      const label = `${p.name}（${r.name} · ¥${Number(p.price).toLocaleString()}）`
      list.push({ label, value: p.name, pkg: p, region: r })
    }
  }
  return list
}

const selectedPackageInfo = computed(() => {
  const opts = checkupPackageOptions()
  return opts.find(o => o.value === form.checkupPackageName) ?? null
})

const availableOptionalItems = computed(() => {
  const info = selectedPackageInfo.value
  if (!info?.region?.optionalItems) return []
  return info.region.optionalItems.filter(o => o.status !== false)
})

const checkupOptionalTotal = computed(() => availableOptionalItems.value
  .filter(o => form.checkupOptionalItemIds.includes(o.id))
  .reduce((sum, item) => sum + Number(item.price || 0), 0))

const autoBaseFee = computed(() => {
  if (form.serviceCategory === 'checkup' && selectedPackageInfo.value) {
    return Number(selectedPackageInfo.value.pkg.price) || 0
  }
  if (form.serviceCategory === 'escort' && form.escortServiceOption) {
    const item = escortPricingOptions.value.find(p => p.label === form.escortServiceOption)
    if (item) return Number(item.fee) || 0
  }
  if (form.serviceCategory === 'professional' && selectedProfessionalService.value) {
    return parsePriceDisplayToNumber(selectedProfessionalService.value.priceDisplayText)
  }
  return undefined
})

const additionalServiceTotal = computed(() => form.additionalServiceItems.reduce(
  (sum, item) => sum + Number(item.amount || 0),
  0,
))

const computedTotalFee = computed(
  () => Number(form.baseFee || 0) + checkupOptionalTotal.value + additionalServiceTotal.value,
)

onMounted(async () => {
  void loadArchiveCandidates()
  loadAttendants()
  loadCheckupPackages()
  loadEscortPricing()
  loadValueAddedServiceOptions()
  loadAdditionalServiceOptions()
  loadProfessionalServices()
  loadRoleConfigs()
  const presetUserId = route.query.userId
  const presetTargetId = route.query.serviceTargetId as string | undefined
  const presetServiceType = route.query.serviceType as string
  const presetServiceTime = route.query.serviceTime as string
  const presetNotes = route.query.notes as string
  const presetCategory = route.query.serviceCategory as ServiceCategory | undefined
  const presetConsultationId = route.query.consultationId
  if (presetUserId) {
    const uid = Number(presetUserId)
    form.userId = uid
    let targets: any[] = []
    try {
      const res = await getServiceTargets(uid)
      targets = Array.isArray(res) ? res : []
      serviceTargetOptions.value = targets
    } catch {
      serviceTargetOptions.value = []
    }
    if (presetTargetId) {
      form.serviceTargetId = Number(presetTargetId)
    } else if (targets.length === 1) {
      form.serviceTargetId = targets[0].id
    }
    if (form.serviceTargetId) {
      try {
        const detail = await getCustomerDetail(uid)
        const t = targets.find((x: any) => x.id === form.serviceTargetId)
        selectedArchive.value = {
          id: form.serviceTargetId,
          name: t?.name,
          userId: uid,
          owner: {
            id: uid,
            nickname: detail.nickname,
            phone: detail.phone,
            openid: detail.openid,
            unionId: detail.unionId,
            role: detail.role,
          },
        }
        if (!archiveOptions.value.some((r: any) => r.id === form.serviceTargetId)) {
          archiveOptions.value = [selectedArchive.value, ...archiveOptions.value]
        }
      } catch {
        /* preset display best-effort */
      }
    }
  }
  if (presetCategory && SERVICE_CATEGORY_META[presetCategory]) {
    form.serviceCategory = presetCategory
  }
  if (presetServiceType) {
    if (['门诊陪诊', '检查陪同', '出入院办理', '陪诊服务'].includes(presetServiceType)) {
      form.serviceCategory = 'escort'
      form.serviceType = '陪诊服务'
    } else if (presetServiceType === '体检预约') {
      form.serviceCategory = 'checkup'
      form.serviceType = '体检预约'
    } else if (MEDICAL_COORD_OPTIONS.some(o => o.value === presetServiceType)) {
      form.serviceCategory = 'medical_coord'
      form.medicalCoordSubType = presetServiceType
      form.serviceType = presetServiceType
    } else {
      form.serviceType = presetServiceType
    }
  }
  if (presetServiceTime) {
    const parsed = new Date(presetServiceTime)
    form.serviceTime = isNaN(parsed.getTime()) ? presetServiceTime : (parsed as any)
  }
  // 仅当链接上显式带 notes= 时预填（如咨询转单）；不从健康档案同步 mainAppeal / 档案备注
  if (presetNotes) form.notes = presetNotes
})

watch(() => form.serviceCategory, (v, oldVal) => {
  if (v === oldVal) return
  form.baseFee = undefined
  form.serviceType = ''
  if (v !== 'escort') {
    form.escortServiceOption = ''
    form.riskLevel = ''
  }
  if (v !== 'checkup') {
    form.checkupPackageName = ''
    form.checkupGender = ''
    form.checkupOptionalItemIds = []
  }
  if (v !== 'medical_coord') form.medicalCoordSubType = ''
  if (v !== 'professional') form.professionalServiceId = undefined
  if (v !== 'escort' && v !== 'checkup') {
    form.hospital = ''
    form.department = ''
    form.hospitalDirectoryId = null
    form.hospitalBookingStatus = ''
    hospitalDirectoryPickedLine.value = ''
  }
  form.attendantId = undefined
  reloadAttendantsForCategory()
})
watch(
  () => form.professionalServiceId,
  () => {
    form.baseFee = undefined
    form.attendantId = undefined
    reloadAttendantsForCategory()
  },
)
watch(() => form.checkupGender, () => { form.checkupPackageName = ''; form.checkupOptionalItemIds = [] })
watch(() => form.checkupPackageName, () => { form.checkupOptionalItemIds = [] })

watch(autoBaseFee, (v) => {
  if (v !== undefined && v > 0) form.baseFee = v
}, { immediate: true })

watch(
  () => form.hospital,
  (v) => {
    if (form.hospitalDirectoryId == null) return
    const picked = (hospitalDirectoryPickedLine.value || '').trim()
    if (!picked) return
    if ((v || '').trim() !== picked) {
      form.hospitalDirectoryId = null
      hospitalDirectoryPickedLine.value = ''
    }
  },
)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">创建订单</h2>
        <p class="page-subtitle">支持陪诊 / 体检 / 专业服务（营养·康复·护理·心理·母婴） / 医疗资源协调四大类，按“客户 → 服务 → 费用派单”填写，表单会按类型自动收起不相关字段。</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="router.push('/service/orders')">返回列表</el-button>
        <el-button @click="router.back()">
          <el-icon><ArrowLeft /></el-icon> 返回上一页
        </el-button>
      </div>
    </div>

    <div class="page-guide">
      <span class="page-guide__label">流程建议</span>
      <el-tag size="small" effect="plain">1 选择健康档案</el-tag>
      <el-tag size="small" effect="plain">2 确认服务大类与时间</el-tag>
      <el-tag size="small" effect="plain">3 校验费用明细</el-tag>
      <el-tag size="small" effect="plain">4 指派服务人员（按角色）</el-tag>
    </div>

    <el-card shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="order-create-form">

        <el-divider content-position="left">客户信息</el-divider>

        <el-form-item label="健康档案" prop="serviceTargetId">
          <el-select
            v-model="form.serviceTargetId"
            filterable
            remote
            reserve-keyword
            :remote-method="onArchiveSearch"
            :loading="archiveLoading"
            placeholder="搜索服务对象姓名、账号昵称或手机号（整条健康档案）"
            style="width: 100%;"
            clearable
            @change="onArchivePick"
          >
            <el-option
              v-for="row in archiveOptions"
              :key="row.id"
              :label="archiveOptionLabel(row)"
              :value="row.id"
            />
          </el-select>
          <div v-if="selectedArchive?.owner" class="wechat-account-panel">
            <div class="wechat-account-title">所属微信账号</div>
            <div class="wechat-account-body">
              <span>昵称：<strong>{{ selectedArchive.owner.nickname || '—' }}</strong></span>
              <span class="sep">·</span>
              <span>手机：{{ selectedArchive.owner.phone || '—' }}</span>
              <template v-if="selectedArchive.owner.openid">
                <span class="sep">·</span>
                <span class="openid">OpenID：{{ selectedArchive.owner.openid }}</span>
              </template>
              <template v-if="selectedArchive.owner.unionId">
                <span class="sep">·</span>
                <span>UnionID：{{ selectedArchive.owner.unionId }}</span>
              </template>
            </div>
          </div>
        </el-form-item>

        <el-divider content-position="left">服务信息</el-divider>

        <el-form-item label="服务大类" prop="serviceCategory">
          <div class="category-grid">
            <label
              v-for="(meta, key) in SERVICE_CATEGORY_META"
              :key="key"
              class="category-card"
              :class="{ 'category-card--active': form.serviceCategory === key }"
              :style="form.serviceCategory === key ? { borderColor: meta.color, boxShadow: `0 0 0 4px ${meta.color}14` } : {}"
            >
              <input
                type="radio"
                name="serviceCategory"
                class="category-card__radio"
                :value="key"
                :checked="form.serviceCategory === key"
                @change="form.serviceCategory = key"
              />
              <span class="category-card__dot" :style="{ background: meta.color }"></span>
              <div class="category-card__body">
                <div class="category-card__title">{{ meta.label }}</div>
                <div class="category-card__desc">{{ meta.description }}</div>
              </div>
            </label>
          </div>
        </el-form-item>

        <el-form-item v-if="showEscortPricing" label="陪诊项目" required>
          <el-select
            v-model="form.escortServiceOption"
            placeholder="请选择陪诊项目（来自服务定价管理）"
            style="width: 100%;"
          >
            <el-option
              v-for="opt in escortPricingOptions"
              :key="opt.label"
              :label="`${opt.label}（¥${Number(opt.fee).toFixed(2)}）`"
              :value="opt.label"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="showProfessionalSelect" label="专业服务" required>
          <el-select
            v-model="form.professionalServiceId"
            filterable
            :loading="professionalServiceLoading"
            placeholder="请选择具体的专业服务项目（营养/康复/护理/心理/母婴）"
            style="width: 100%;"
          >
            <el-option
              v-for="opt in professionalServiceOptions"
              :key="opt.id"
              :label="`${opt.name}（${opt.priceDisplayText || '价格面议'}）`"
              :value="opt.id"
            >
              <span>{{ opt.name }}</span>
              <span class="option-tag" :data-cat="opt.category">{{ categoryLabel(opt.category) }}</span>
              <span class="option-hint">{{ opt.priceDisplayText || '价格面议' }}</span>
            </el-option>
          </el-select>
          <div v-if="selectedProfessionalService" class="professional-card">
            <div class="professional-card__title">
              {{ selectedProfessionalService.name }}
              <el-tag size="small" :type="categoryTagType(selectedProfessionalService.category)">
                {{ categoryLabel(selectedProfessionalService.category) }}
              </el-tag>
            </div>
            <div class="professional-card__desc">{{ selectedProfessionalService.shortDesc }}</div>
            <div class="professional-card__meta">
              <span v-if="selectedProfessionalService.durationHint">
                <el-icon><Clock /></el-icon> {{ selectedProfessionalService.durationHint }}
              </span>
              <span v-if="selectedProfessionalService.priceDisplayText">
                <el-icon><Money /></el-icon> {{ selectedProfessionalService.priceDisplayText }}
              </span>
              <span v-if="suggestedRoleConfig">
                <el-icon><User /></el-icon> 建议派单角色：{{ suggestedRoleConfig.label }}
              </span>
            </div>
            <div v-if="selectedProfessionalService.highlights?.length" class="professional-card__highlights">
              <el-tag
                v-for="h in selectedProfessionalService.highlights"
                :key="h"
                size="small"
                effect="plain"
              >{{ h }}</el-tag>
            </div>
          </div>
          <div v-else-if="!professionalServiceLoading && professionalServiceOptions.length === 0" style="font-size: 12px; color: #e6a23c; margin-top: 4px;">
            暂无启用的专业服务，可到「内容管理 → 专业服务目录」配置
          </div>
        </el-form-item>

        <el-form-item v-if="showMedicalCoordSubType" label="协调类型" required>
          <el-select
            v-model="form.medicalCoordSubType"
            placeholder="请选择医疗资源协调的具体服务项"
            style="width: 100%;"
          >
            <el-option
              v-for="opt in MEDICAL_COORD_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <template v-if="form.serviceCategory === 'checkup'">
          <el-form-item label="性别" required>
            <el-radio-group v-model="form.checkupGender">
              <el-radio value="male">男</el-radio>
              <el-radio value="female">女</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="套餐名称" required>
            <el-select
              v-model="form.checkupPackageName"
              placeholder="请选择体检套餐（来自体检套餐管理）"
              style="width: 100%;"
              filterable
            >
              <el-option
                v-for="opt in checkupPackageOptions()"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <div v-if="checkupPackageOptions().length === 0" style="font-size: 12px; color: #e6a23c; margin-top: 4px;">
              暂无可用套餐，请先在「财务管理 → 服务定价管理 → 体检套餐管理」中配置
            </div>
          </el-form-item>
          <el-form-item v-if="availableOptionalItems.length" label="附加备选项目">
            <el-checkbox-group v-model="form.checkupOptionalItemIds">
              <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; max-height: 200px; overflow-y: auto;">
                <el-checkbox
                  v-for="opt in availableOptionalItems"
                  :key="opt.id"
                  :value="opt.id"
                >
                  {{ opt.name }}（¥{{ Number(opt.price).toLocaleString() }}）
                </el-checkbox>
              </div>
            </el-checkbox-group>
            <div v-if="form.checkupOptionalItemIds.length" style="font-size: 12px; color: #409eff; margin-top: 6px;">
              已选 {{ form.checkupOptionalItemIds.length }} 项，附加费用 ¥{{ checkupOptionalTotal.toLocaleString() }}
            </div>
          </el-form-item>
        </template>

        <el-form-item label="服务开始时间" prop="serviceTime">
          <el-date-picker
            v-model="form.serviceTime"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="服务结束时间" prop="serviceEndTime">
          <el-date-picker
            v-model="form.serviceEndTime"
            type="datetime"
            placeholder="可选，不选则仅记录开始时间"
            style="width: 100%;"
            clearable
          />
        </el-form-item>

        <el-form-item v-if="showRiskLevel" label="风险等级">
          <el-select
            v-model="form.riskLevel"
            clearable
            placeholder="请选择风险等级（仅服务人员接单页可见）"
            style="width: 100%;"
          >
            <el-option
              v-for="option in ORDER_RISK_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 4px;">
            该标记仅用于提醒服务人员评估接单风险，客户端不会显示
          </div>
        </el-form-item>

        <el-form-item v-if="showServiceAddress" label="服务地址">
          <el-input
            v-model="form.serviceAddress"
            placeholder="上门服务填写客户家庭地址；门店/线上服务可留空"
            clearable
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px;">
            专业服务、上门护理等场景使用；陪诊/体检订单通常使用「就诊医院」而非此字段
          </div>
        </el-form-item>

        <template v-if="showHospitalFields">
          <el-form-item label="就诊医院">
            <el-autocomplete
              v-model="form.hospital"
              :fetch-suggestions="querySearchHospital"
              :trigger-on-focus="false"
              clearable
              placeholder="输入关键词搜索名录；未找到可直接输入完整医院名称"
              style="width: 100%;"
              @select="onHospitalAutocompleteSelect"
              @clear="onHospitalAutocompleteClear"
            />
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              从下拉选中会绑定医院名录；仅输入、不点选项则按手填保存（不关联名录）。修改已选文案将自动取消名录绑定。
            </div>
          </el-form-item>

          <el-form-item label="就诊科室">
            <el-select
              v-model="form.department"
              filterable
              clearable
              allow-create
              default-first-option
              placeholder="请选择或输入就诊科室"
              style="width: 100%;"
            >
              <el-option-group
                v-for="group in departmentOptionGroups"
                :key="group.label"
                :label="group.label"
              >
                <el-option
                  v-for="item in group.options"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-option-group>
            </el-select>
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              热门科室已置顶，也支持直接输入自定义科室名称
            </div>
          </el-form-item>

          <el-form-item label="约号状态">
            <el-select
              v-model="form.hospitalBookingStatus"
              placeholder="未设置（创建后可于订单详情补充）"
              clearable
              style="width: 100%;"
            >
              <el-option label="已自行约号" value="booked" />
              <el-option label="待客服协助约号" value="pending_cs" />
            </el-select>
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              与导诊、列表标签一致，便于陪诊与客服跟进挂号情况
            </div>
          </el-form-item>
        </template>

        <el-divider content-position="left">费用与派单（到店后补填）</el-divider>

        <el-form-item label="基础服务费">
          <el-input-number v-model="form.baseFee" :precision="2" :step="50" :min="0" placeholder="到店后填写" style="width: 100%;" />
          <div v-if="autoBaseFee !== undefined && autoBaseFee > 0" style="font-size: 12px; color: #67c23a; margin-top: 4px;">
            已根据套餐/服务定价自动计算基础服务费：¥{{ autoBaseFee.toLocaleString() }}
          </div>
        </el-form-item>

        <el-form-item v-if="form.serviceType === '体检预约' && checkupOptionalTotal > 0" label="体检附加项目">
          <div style="width: 100%; padding: 12px 14px; border-radius: 8px; background: #f0f9ff; color: #303133;">
            已选附加项目 {{ form.checkupOptionalItemIds.length }} 项，合计 ¥{{ checkupOptionalTotal.toFixed(2) }}
          </div>
        </el-form-item>

        <el-form-item label="附加服务项">
          <div class="additional-service-list">
            <div
              v-for="(item, index) in form.additionalServiceItems"
              :key="item.id"
              class="additional-service-item"
            >
              <div class="additional-service-item__toolbar">
                <el-tag size="small" type="info">附加项 {{ index + 1 }}</el-tag>
                <el-button type="danger" link @click="removeAdditionalServiceItem(index)">删除</el-button>
              </div>
              <div class="additional-service-item__grid">
                <div class="additional-service-item__field additional-service-item__field--wide">
                  <div class="additional-service-item__label">服务分类</div>
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
                  <div class="additional-service-item__label">服务名称</div>
                  <el-input
                    v-if="item.selection === ADDITIONAL_CUSTOM_VALUE"
                    v-model="item.customName"
                    placeholder="填写其他附加费用名称"
                  />
                  <el-input
                    v-else
                    :model-value="item.selection || '请先选择服务项'"
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
                附加服务合计：<strong style="color:#303133;">¥{{ additionalServiceTotal.toFixed(2) }}</strong>
              </span>
            </div>
            <div class="additional-service-tip">
              可从“增值服务”和“附加服务项”中直接选择；如现场有临时收费，也可选“其他附加费用”手动填写。
            </div>
          </div>
        </el-form-item>

        <el-form-item label="总费用">
          <div style="width: 100%; padding: 12px 14px; border-radius: 8px; background: #f5f7fa; color: #303133; font-weight: 600;">
            自动累计：基础服务费 ¥{{ Number(form.baseFee || 0).toFixed(2) }} + 体检附加项目 ¥{{ checkupOptionalTotal.toFixed(2) }} + 附加服务费 ¥{{ additionalServiceTotal.toFixed(2) }} = ¥{{ computedTotalFee.toFixed(2) }}
          </div>
        </el-form-item>

        <el-form-item :label="needAttendantLabel">
          <el-radio-group v-model="form.needAttendant">
            <el-radio :value="true">需要{{ suggestedRoleConfig?.label || '陪诊员' }}</el-radio>
            <el-radio :value="false">本次无需服务人员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.needAttendant" :label="attendantSelectLabel">
          <el-select v-model="form.attendantId" clearable placeholder="可选，创建后直接进入待签署" style="width: 100%;" filterable>
            <el-option
              v-for="a in attendantOptions"
              :key="a.id"
              :label="`${a.realName}（${a.phone || '—'}）`"
              :value="a.id"
            >
              <span>{{ a.realName }}</span>
              <span v-if="a.primaryRole && a.primaryRole !== 'attendant'" class="option-role-tag">
                {{ (roleConfigs.find(r => r.role === a.primaryRole)?.label) || a.primaryRole }}
              </span>
              <span class="option-hint">{{ a.phone || '—' }}</span>
            </el-option>
          </el-select>
          <div v-if="suggestedRoleConfig && form.serviceCategory === 'professional'" style="font-size: 12px; color: #909399; margin-top: 4px;">
            已按建议角色 <b>{{ suggestedRoleConfig.label }}</b> 过滤候选人（“{{ suggestedRoleConfig.serviceScope }}”）
          </div>
        </el-form-item>

        <el-form-item label="订单备注">
          <el-input
            v-model="form.notes"
            type="textarea"
            :rows="3"
            placeholder="仅后台填写，写入本订单；不会读取客户健康档案中的主诉或档案备注"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSubmit" size="large" style="width: 200px;">
            <el-icon><Check /></el-icon> 创建订单
          </el-button>
          <el-button @click="router.back()" size="large">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.order-create-form {
  max-width: 760px;
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

.additional-service-item__field--amount {
  width: 100%;
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

.wechat-account-panel {
  margin-top: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f0f7ff 0%, #f5f9fc 100%);
  border: 1px solid #d9e8ff;
}
.wechat-account-title {
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 6px;
}
.wechat-account-body {
  font-size: 13px;
  color: #303133;
  line-height: 1.55;
  word-break: break-all;
}
.wechat-account-body .sep {
  margin: 0 6px;
  color: #c0c4cc;
}
.wechat-account-body .openid {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
}

@media (max-width: 1200px) {
  .additional-service-item__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* 服务大类卡片 */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  width: 100%;
}

.category-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.category-card:hover {
  border-color: #c0c4cc;
}

.category-card--active {
  background: #fafbfd;
}

.category-card__radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.category-card__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
  box-shadow: 0 0 0 4px #ffffff inset, 0 0 0 2px currentColor inset;
}

.category-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.category-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.category-card__desc {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}

/* 专业服务卡片 */
.professional-card {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff8f1;
  border: 1px solid #fce3cc;
}

.professional-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.professional-card__desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.5;
}

.professional-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: #374151;
}

.professional-card__meta .el-icon {
  vertical-align: -2px;
  margin-right: 2px;
  color: #9ca3af;
}

.professional-card__highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.option-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 20px;
  background: #ecfdf5;
  color: #059669;
}

.option-tag[data-cat='rehabilitation'] {
  background: #fff7ed;
  color: #c2410c;
}

.option-tag[data-cat='nursing'] {
  background: #e0f2fe;
  color: #0284c7;
}

.option-tag[data-cat='psychology'] {
  background: #eef2ff;
  color: #4338ca;
}

.option-tag[data-cat='maternal_child'] {
  background: #fce7f3;
  color: #be185d;
}

.option-role-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  background: #eef2ff;
  color: #4338ca;
}

.option-hint {
  float: right;
  color: #9ca3af;
  font-size: 12px;
}
</style>
