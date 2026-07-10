<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getConfig, setConfig } from '@/api/system'
import { LISHUI_OPTIONAL_ITEMS, type OptionalItem } from '@/constants/lishui-optional-items'
import Sortable from 'sortablejs'

type SortableEndEvent = {
  newIndex?: number
  oldIndex?: number
}

// ===== 拖拽排序工具 =====
function makeSortable(tableRef: any, list: any[], onEnd: () => void) {
  nextTick(() => {
    const el = tableRef?.value?.$el?.querySelector('.el-table__body tbody') as HTMLElement | null
    if (!el) return
    Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd({ newIndex, oldIndex }: SortableEndEvent) {
        if (newIndex === undefined || oldIndex === undefined || newIndex === oldIndex) return
        const moved = list.splice(oldIndex, 1)[0]
        list.splice(newIndex, 0, moved)
        onEnd()
      },
    })
  })
}

interface PricingItem { name: string; price: number; unit: string; status: boolean }

interface CheckupPackage {
  id: string; name: string; gender: string; targetGroup: string; price: number
  clinicalItems: string; labItems: string; specialItems: string; notes: string; status: boolean
}

interface CheckupRegion {
  id: string; name: string; hospital: string; packages: CheckupPackage[]; optionalItems?: OptionalItem[]
}

const activeCategory = ref('escort')
const loading = ref(false)

// ===== 表格 ref（用于拖拽排序） =====
const escortTableRef = ref()
const valueAddedTableRef = ref()
const attendantFeeTableRef = ref()
const customerAddonTableRef = ref()
const optionalTableRef = ref()


interface FeeOptionItem { label: string; fee: number; status: boolean }
interface AttendantFeeItem extends FeeOptionItem {}
interface ValueAddedServiceItem extends FeeOptionItem {}
interface CustomerAdditionalFeeItem extends FeeOptionItem {}

function cloneList<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function normalizeFeeOptionItems(raw: unknown): FeeOptionItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: any) => ({
      label: String(item?.label ?? item?.name ?? '').trim(),
      fee: Number(item?.fee ?? item?.price ?? 0),
      status: item?.status !== false,
    }))
    .filter(item => item.label)
}

function looksLikeLegacyMixedPricing(items: FeeOptionItem[]) {
  return items.some(item =>
    item.label.includes('增值')
    || item.label.includes('本地陪诊')
    || item.label.includes('跨城陪诊'),
  )
}

function looksLikeAttendantPayoutPricing(items: FeeOptionItem[]) {
  return items.some(item =>
    item.label.includes('青田半日')
    || item.label.includes('青田全日')
    || item.label.includes('温州丽水（全日）')
    || item.label.includes('杭州上海（全日）')
    || item.label.includes('北京（全日）'),
  )
}

function normalizeValueAddedLabel(label: string) {
  return label.replace(/^增值[·:：-]?\s*/, '').trim()
}

const DEFAULT_SERVICE_PRICING: PricingItem[] = [
  { name: '本地陪诊·青田县城', price: 488, unit: '次', status: true },
  { name: '跨城陪诊·丽水/温州周边', price: 598, unit: '次', status: true },
  { name: '跨城陪诊·杭州/宁波方向', price: 1280, unit: '次', status: true },
  { name: '跨城陪诊·上海', price: 1580, unit: '次', status: true },
  { name: '跨城陪诊·北京/省外长途', price: 2280, unit: '次', status: true },
]

const DEFAULT_ATTENDANT_FEES: AttendantFeeItem[] = [
  { label: '青田半日', fee: 120, status: true },
  { label: '青田全日', fee: 200, status: true },
  { label: '温州丽水（全日）', fee: 240, status: true },
  { label: '杭州上海（全日）', fee: 300, status: true },
  { label: '北京（全日）', fee: 350, status: true },
]

const valueAddedServiceItems = ref<ValueAddedServiceItem[]>([])
const valueAddedServiceDialogVisible = ref(false)
const valueAddedServiceEditIndex = ref(-1)
const valueAddedServiceForm = ref<ValueAddedServiceItem>({ label: '', fee: 0, status: true })

const DEFAULT_VALUE_ADDED_SERVICES: ValueAddedServiceItem[] = [
  { label: '夜间陪同 +200/晚', fee: 200, status: true },
  { label: '住宿陪同 +100/晚', fee: 100, status: true },
  { label: '次日续陪 +300/日', fee: 300, status: true },
  { label: '次日续陪·北京 +400/日', fee: 400, status: true },
]

const attendantFeeItems = ref<AttendantFeeItem[]>([])
const attendantFeeDialogVisible = ref(false)
const attendantFeeEditIndex = ref(-1)
const attendantFeeForm = ref<AttendantFeeItem>({ label: '', fee: 0, status: true })

const customerAdditionalFeeItems = ref<CustomerAdditionalFeeItem[]>([])
const customerAdditionalFeeDialogVisible = ref(false)
const customerAdditionalFeeEditIndex = ref(-1)
const customerAdditionalFeeForm = ref<CustomerAdditionalFeeItem>({ label: '', fee: 0, status: true })

const DEFAULT_CUSTOMER_ADDITIONAL_FEES: CustomerAdditionalFeeItem[] = []

async function loadValueAddedServices() {
  try {
    const val = await getConfig('value_added_service_pricing')
    if (val !== undefined && val !== null) {
      valueAddedServiceItems.value = normalizeFeeOptionItems(
        JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)),
      )
      return
    }
  } catch {}

  try {
    const legacyVal = await getConfig('attendant_fee_pricing')
    if (legacyVal) {
      const legacyItems = normalizeFeeOptionItems(
        JSON.parse(typeof legacyVal === 'string' ? legacyVal : JSON.stringify(legacyVal)),
      )
      const migrated = legacyItems
        .filter(item => item.label.includes('增值'))
        .map(item => ({ ...item, label: normalizeValueAddedLabel(item.label) }))
      if (migrated.length) {
        valueAddedServiceItems.value = migrated
        await saveValueAddedServices()
        return
      }
    }
  } catch {}

  valueAddedServiceItems.value = cloneList(DEFAULT_VALUE_ADDED_SERVICES)
  await saveValueAddedServices()
}

async function saveValueAddedServices() {
  await setConfig('value_added_service_pricing', JSON.stringify(valueAddedServiceItems.value), '增值服务配置')
}

function handleValueAddedServiceAdd() {
  valueAddedServiceEditIndex.value = -1
  valueAddedServiceForm.value = { label: '', fee: 0, status: true }
  valueAddedServiceDialogVisible.value = true
}

function handleValueAddedServiceEdit(i: number) {
  const item = valueAddedServiceItems.value[i]
  valueAddedServiceEditIndex.value = i
  valueAddedServiceForm.value = item ? { ...item } : { label: '', fee: 0, status: true }
  valueAddedServiceDialogVisible.value = true
}

async function handleValueAddedServiceSave() {
  if (!valueAddedServiceForm.value.label.trim()) { ElMessage.warning('请输入增值服务名称'); return }
  const item: ValueAddedServiceItem = { ...valueAddedServiceForm.value }
  if (valueAddedServiceEditIndex.value >= 0) valueAddedServiceItems.value[valueAddedServiceEditIndex.value] = item
  else valueAddedServiceItems.value.push(item)
  await saveValueAddedServices()
  ElMessage.success('保存成功')
  valueAddedServiceDialogVisible.value = false
}

async function handleValueAddedServiceDelete(i: number) {
  try {
    await ElMessageBox.confirm('确定删除此增值服务？', '提示', { type: 'warning' })
    valueAddedServiceItems.value.splice(i, 1)
    await saveValueAddedServices()
    ElMessage.success('删除成功')
  } catch {}
}

async function handleValueAddedServiceStatusChange() { await saveValueAddedServices() }

async function handleResetValueAddedServices() {
  try {
    await ElMessageBox.confirm('将重置为系统默认的增值服务，确定？', '提示', { type: 'warning' })
    valueAddedServiceItems.value = cloneList(DEFAULT_VALUE_ADDED_SERVICES)
    await saveValueAddedServices()
    ElMessage.success('已重置为默认增值服务')
  } catch {}
}

async function loadAttendantFees() {
  try {
    const val = await getConfig('attendant_fee_pricing')
    if (val) {
      const parsed = normalizeFeeOptionItems(JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)))
      if (parsed.length && !looksLikeLegacyMixedPricing(parsed)) {
        attendantFeeItems.value = parsed
        return
      }
    }
  } catch {}
  attendantFeeItems.value = cloneList(DEFAULT_ATTENDANT_FEES)
}

async function saveAttendantFees() {
  await setConfig('attendant_fee_pricing', JSON.stringify(attendantFeeItems.value), '陪诊员费用定价配置')
}

async function loadCustomerAdditionalFees() {
  try {
    const val = await getConfig('customer_additional_fee_pricing')
    if (val !== undefined && val !== null) {
      customerAdditionalFeeItems.value = normalizeFeeOptionItems(
        JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)),
      )
      return
    }
  } catch {}
  customerAdditionalFeeItems.value = cloneList(DEFAULT_CUSTOMER_ADDITIONAL_FEES)
  await saveCustomerAdditionalFees()
}

async function saveCustomerAdditionalFees() {
  await setConfig('customer_additional_fee_pricing', JSON.stringify(customerAdditionalFeeItems.value), '客户附加收费项配置')
}

function handleCustomerAdditionalFeeAdd() {
  customerAdditionalFeeEditIndex.value = -1
  customerAdditionalFeeForm.value = { label: '', fee: 0, status: true }
  customerAdditionalFeeDialogVisible.value = true
}

function handleCustomerAdditionalFeeEdit(i: number) {
  const item = customerAdditionalFeeItems.value[i]
  customerAdditionalFeeEditIndex.value = i
  customerAdditionalFeeForm.value = item ? { ...item } : { label: '', fee: 0, status: true }
  customerAdditionalFeeDialogVisible.value = true
}

async function handleCustomerAdditionalFeeSave() {
  if (!customerAdditionalFeeForm.value.label.trim()) { ElMessage.warning('请输入收费项名称'); return }
  const item: CustomerAdditionalFeeItem = { ...customerAdditionalFeeForm.value }
  if (customerAdditionalFeeEditIndex.value >= 0) customerAdditionalFeeItems.value[customerAdditionalFeeEditIndex.value] = item
  else customerAdditionalFeeItems.value.push(item)
  await saveCustomerAdditionalFees()
  ElMessage.success('保存成功')
  customerAdditionalFeeDialogVisible.value = false
}

async function handleCustomerAdditionalFeeDelete(i: number) {
  try {
    await ElMessageBox.confirm('确定删除此收费项？', '提示', { type: 'warning' })
    customerAdditionalFeeItems.value.splice(i, 1)
    await saveCustomerAdditionalFees()
    ElMessage.success('删除成功')
  } catch {}
}

async function handleCustomerAdditionalFeeStatusChange() { await saveCustomerAdditionalFees() }

async function handleResetCustomerAdditionalFees() {
  try {
    await ElMessageBox.confirm('将重置为系统默认的客户附加收费项，确定？', '提示', { type: 'warning' })
    customerAdditionalFeeItems.value = cloneList(DEFAULT_CUSTOMER_ADDITIONAL_FEES)
    await saveCustomerAdditionalFees()
    ElMessage.success('已重置为默认收费项')
  } catch {}
}

function handleAttendantFeeAdd() {
  attendantFeeEditIndex.value = -1
  attendantFeeForm.value = { label: '', fee: 0, status: true }
  attendantFeeDialogVisible.value = true
}
function handleAttendantFeeEdit(i: number) {
  const item = attendantFeeItems.value[i]
  attendantFeeEditIndex.value = i
  attendantFeeForm.value = item ? { ...item } : { label: '', fee: 0, status: true }
  attendantFeeDialogVisible.value = true
}
async function handleAttendantFeeSave() {
  if (!attendantFeeForm.value.label.trim()) { ElMessage.warning('请输入费用名称'); return }
  const item: AttendantFeeItem = { ...attendantFeeForm.value }
  if (attendantFeeEditIndex.value >= 0) attendantFeeItems.value[attendantFeeEditIndex.value] = item
  else attendantFeeItems.value.push(item)
  await saveAttendantFees()
  ElMessage.success('保存成功')
  attendantFeeDialogVisible.value = false
}
async function handleAttendantFeeDelete(i: number) {
  try {
    await ElMessageBox.confirm('确定删除此费用项目？', '提示', { type: 'warning' })
    attendantFeeItems.value.splice(i, 1)
    await saveAttendantFees()
    ElMessage.success('删除成功')
  } catch {}
}
async function handleAttendantFeeStatusChange() { await saveAttendantFees() }
async function handleResetAttendantFees() {
  try {
    await ElMessageBox.confirm('将重置为系统默认价格，确定？', '提示', { type: 'warning' })
    attendantFeeItems.value = cloneList(DEFAULT_ATTENDANT_FEES)
    await saveAttendantFees()
    ElMessage.success('已重置为默认价格')
  } catch {}
}

// ===== 陪诊服务定价 =====
const escortItems = ref<PricingItem[]>([])
const escortDialogVisible = ref(false)
const escortEditIndex = ref(-1)
const escortForm = ref<PricingItem>({ name: '', price: 0, unit: '次', status: true })

async function loadEscortPricing() {
  try {
    const val = await getConfig('service_pricing')
    if (val) {
      const normalized = normalizeFeeOptionItems(
        JSON.parse(typeof val === 'string' ? val : JSON.stringify(val)),
      )
      if (normalized.length && looksLikeAttendantPayoutPricing(normalized)) {
        escortItems.value = cloneList(DEFAULT_SERVICE_PRICING)
        await saveEscortPricing()
        return
      }
      const serviceItems = normalized.filter(item => !item.label.includes('增值'))
      if (serviceItems.length) {
        escortItems.value = serviceItems.map(item => ({
          name: item.label,
          price: item.fee,
          unit: '次',
          status: item.status !== false,
        }))
        return
      }
    }
    escortItems.value = cloneList(DEFAULT_SERVICE_PRICING)
    await saveEscortPricing()
  } catch { escortItems.value = cloneList(DEFAULT_SERVICE_PRICING) }
}

async function saveEscortPricing() {
  await setConfig('service_pricing', JSON.stringify(escortItems.value), '陪诊服务定价配置')
}

function handleEscortAdd() { escortEditIndex.value = -1; escortForm.value = { name: '', price: 0, unit: '次', status: true }; escortDialogVisible.value = true }
function handleEscortEdit(i: number) {
  const item = escortItems.value[i]
  escortEditIndex.value = i
  escortForm.value = item ? { name: item.name ?? '', price: item.price ?? 0, unit: item.unit ?? '次', status: item.status ?? true } : { name: '', price: 0, unit: '次', status: true }
  escortDialogVisible.value = true
}
async function handleEscortSave() {
  if (!escortForm.value.name) { ElMessage.warning('请输入服务名称'); return }
  const item = escortForm.value
  const fullItem: PricingItem = { name: item.name, price: item.price, unit: item.unit, status: item.status }
  if (escortEditIndex.value >= 0) escortItems.value[escortEditIndex.value] = fullItem
  else escortItems.value.push(fullItem)
  await saveEscortPricing(); ElMessage.success('保存成功'); escortDialogVisible.value = false
}
async function handleEscortDelete(i: number) {
  try { await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' }); escortItems.value.splice(i, 1); await saveEscortPricing(); ElMessage.success('删除成功') } catch {}
}
async function handleEscortStatusChange() { await saveEscortPricing() }
async function handleResetEscortPricing() {
  try {
    await ElMessageBox.confirm('将重置为系统默认的陪诊服务定价，确定？', '提示', { type: 'warning' })
    escortItems.value = cloneList(DEFAULT_SERVICE_PRICING)
    await saveEscortPricing()
    ElMessage.success('已重置为默认价格')
  } catch {}
}

// ===== 体检套餐管理 =====
const checkupRegions = ref<CheckupRegion[]>([])
const activeRegion = ref('')
const checkupDialogVisible = ref(false)
const checkupEditIndex = ref(-1)
const checkupForm = ref<CheckupPackage>({ id: '', name: '', gender: 'all', targetGroup: '', price: 0, clinicalItems: '', labItems: '', specialItems: '', notes: '', status: true })
const detailVisible = ref(false)
const detailPackage = ref<CheckupPackage | null>(null)
const regionDialogVisible = ref(false)
const regionForm = ref({ id: '', name: '', hospital: '' })
const regionEditMode = ref(false)
const checkupSubTab = ref<'packages' | 'optional'>('packages')
const optionalItemDialogVisible = ref(false)
const optionalItemEditIndex = ref(-1)
const optionalItemForm = ref<OptionalItem>({ id: '', name: '', price: 0, unit: '次', status: true })

async function loadCheckupPackages() {
  try {
    const val = await getConfig('checkup_packages')
    if (val) {
      checkupRegions.value = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val))
      // 为丽水市中心医院国际健康管理中心注入备选项目（若尚未有）
      let needsSave = false
      for (const r of checkupRegions.value) {
        if (r.hospital?.includes('丽水市中心医院') && (!r.optionalItems || r.optionalItems.length === 0)) {
          r.optionalItems = JSON.parse(JSON.stringify(LISHUI_OPTIONAL_ITEMS))
          needsSave = true
        }
        if (!r.optionalItems) r.optionalItems = []
      }
      if (needsSave) await saveCheckupPackages()
      const first = checkupRegions.value[0]
      if (first && !activeRegion.value) activeRegion.value = first.id
    }
    else checkupRegions.value = []
  } catch { checkupRegions.value = [] }
}

async function saveCheckupPackages() {
  await setConfig('checkup_packages', JSON.stringify(checkupRegions.value), '体检套餐配置')
}

function currentRegion(): CheckupRegion | undefined { return checkupRegions.value.find(r => r.id === activeRegion.value) }

function handleAddRegion() { regionEditMode.value = false; regionForm.value = { id: '', name: '', hospital: '' }; regionDialogVisible.value = true }
function handleEditRegion() {
  const r = currentRegion(); if (!r) return
  regionEditMode.value = true; regionForm.value = { id: r.id, name: r.name, hospital: r.hospital }; regionDialogVisible.value = true
}
async function handleSaveRegion() {
  if (!regionForm.value.name) { ElMessage.warning('请输入城市名称'); return }
  if (regionEditMode.value) {
    const r = currentRegion(); if (r) { r.name = regionForm.value.name; r.hospital = regionForm.value.hospital }
  } else {
    const id = 'region_' + Date.now()
    const hospital = regionForm.value.hospital
    const optionalItems = hospital?.includes('丽水市中心医院') ? JSON.parse(JSON.stringify(LISHUI_OPTIONAL_ITEMS)) : []
    checkupRegions.value.push({ id, name: regionForm.value.name, hospital, packages: [], optionalItems })
    activeRegion.value = id
  }
  await saveCheckupPackages(); ElMessage.success('保存成功'); regionDialogVisible.value = false
}
async function handleDeleteRegion() {
  try {
    await ElMessageBox.confirm('删除该城市将同时删除所有套餐数据，确定？', '提示', { type: 'warning' })
    const idx = checkupRegions.value.findIndex(r => r.id === activeRegion.value)
    if (idx >= 0) checkupRegions.value.splice(idx, 1)
    activeRegion.value = checkupRegions.value[0]?.id || ''
    await saveCheckupPackages(); ElMessage.success('删除成功')
  } catch {}
}

function handleCheckupAdd() {
  checkupEditIndex.value = -1
  checkupForm.value = { id: 'pkg_' + Date.now(), name: '', gender: 'all', targetGroup: '', price: 0, clinicalItems: '', labItems: '', specialItems: '', notes: '', status: true }
  checkupDialogVisible.value = true
}
function handleCheckupEdit(i: number) {
  const r = currentRegion()
  if (!r) return
  const p = r.packages[i]
  checkupEditIndex.value = i
  checkupForm.value = p ? { id: p.id, name: p.name, gender: p.gender, targetGroup: p.targetGroup, price: p.price, clinicalItems: p.clinicalItems, labItems: p.labItems, specialItems: p.specialItems, notes: p.notes, status: p.status } : { id: '', name: '', gender: 'all', targetGroup: '', price: 0, clinicalItems: '', labItems: '', specialItems: '', notes: '', status: true }
  checkupDialogVisible.value = true
}
async function handleCheckupSave() {
  if (!checkupForm.value.name || !checkupForm.value.price) { ElMessage.warning('请填写套餐名称和价格'); return }
  const r = currentRegion(); if (!r) return
  const pkg = checkupForm.value
  const fullPkg: CheckupPackage = { id: pkg.id ?? '', name: pkg.name ?? '', gender: pkg.gender ?? 'all', targetGroup: pkg.targetGroup ?? '', price: pkg.price ?? 0, clinicalItems: pkg.clinicalItems ?? '', labItems: pkg.labItems ?? '', specialItems: pkg.specialItems ?? '', notes: pkg.notes ?? '', status: pkg.status ?? true }
  if (checkupEditIndex.value >= 0) r.packages[checkupEditIndex.value] = fullPkg
  else r.packages.push(fullPkg)
  await saveCheckupPackages(); ElMessage.success('保存成功'); checkupDialogVisible.value = false
}
async function handleCheckupDelete(i: number) {
  try {
    await ElMessageBox.confirm('确定删除此套餐？', '提示', { type: 'warning' })
    const r = currentRegion(); if (!r) return
    r.packages.splice(i, 1); await saveCheckupPackages(); ElMessage.success('删除成功')
  } catch {}
}
async function handleCheckupStatusChange() { await saveCheckupPackages() }

function showDetail(pkg: CheckupPackage) { detailPackage.value = pkg; detailVisible.value = true }

function optionalItemsList(): OptionalItem[] {
  const r = currentRegion()
  if (!r) return []
  if (!r.optionalItems) r.optionalItems = []
  return r.optionalItems
}

function handleOptionalItemAdd() {
  optionalItemEditIndex.value = -1
  optionalItemForm.value = { id: 'opt_' + Date.now(), name: '', price: 0, unit: '次', status: true }
  optionalItemDialogVisible.value = true
}

function handleOptionalItemEdit(i: number) {
  const list = optionalItemsList()
  const item = list[i]
  optionalItemEditIndex.value = i
  optionalItemForm.value = item ? { ...item } : { id: 'opt_' + Date.now(), name: '', price: 0, unit: '次', status: true }
  optionalItemDialogVisible.value = true
}

async function handleOptionalItemSave() {
  if (!optionalItemForm.value.name) { ElMessage.warning('请输入项目名称'); return }
  const r = currentRegion(); if (!r) return
  if (!r.optionalItems) r.optionalItems = []
  const item: OptionalItem = { ...optionalItemForm.value }
  if (optionalItemEditIndex.value >= 0) r.optionalItems[optionalItemEditIndex.value] = item
  else r.optionalItems.push(item)
  await saveCheckupPackages(); ElMessage.success('保存成功'); optionalItemDialogVisible.value = false
}

async function handleOptionalItemDelete(i: number) {
  try {
    await ElMessageBox.confirm('确定删除此备选项目？', '提示', { type: 'warning' })
    const r = currentRegion(); if (!r) return
    r.optionalItems?.splice(i, 1); await saveCheckupPackages(); ElMessage.success('删除成功')
  } catch {}
}

function handleImportLishuiOptionalItems() {
  const r = currentRegion(); if (!r) return
  if (!r.optionalItems) r.optionalItems = []
  const existingIds = new Set(r.optionalItems.map(o => o.id))
  for (const item of LISHUI_OPTIONAL_ITEMS) {
    if (!existingIds.has(item.id)) {
      r.optionalItems.push(JSON.parse(JSON.stringify(item)))
      existingIds.add(item.id)
    }
  }
  saveCheckupPackages().then(() => ElMessage.success('已导入丽水备选项目'))
}

function genderLabel(g: string) { return g === 'male' ? '男' : g === 'female' ? '女' : g === 'child' ? '儿童' : '通用' }
function genderTagType(g: string): any { return g === 'male' ? '' : g === 'female' ? 'danger' : g === 'child' ? 'warning' : 'info' }

// ===== 加载 =====
async function loadAll() {
  loading.value = true
  await Promise.all([
    loadEscortPricing(),
    loadValueAddedServices(),
    loadCheckupPackages(),
    loadAttendantFees(),
    loadCustomerAdditionalFees(),
  ])
  loading.value = false
  // 挂载拖拽排序
  makeSortable(escortTableRef, escortItems.value, saveEscortPricing)
  makeSortable(valueAddedTableRef, valueAddedServiceItems.value, saveValueAddedServices)
  makeSortable(attendantFeeTableRef, attendantFeeItems.value, saveAttendantFees)
  makeSortable(customerAddonTableRef, customerAdditionalFeeItems.value, saveCustomerAdditionalFees)
}

// Tab 切换时补充挂载（避免 Tab 未渲染时 DOM 不存在）
watch(activeCategory, (val) => {
  if (val === 'escort') makeSortable(escortTableRef, escortItems.value, saveEscortPricing)
  else if (val === 'valueAdded') makeSortable(valueAddedTableRef, valueAddedServiceItems.value, saveValueAddedServices)
  else if (val === 'attendantFee') makeSortable(attendantFeeTableRef, attendantFeeItems.value, saveAttendantFees)
  else if (val === 'customerAddon') makeSortable(customerAddonTableRef, customerAdditionalFeeItems.value, saveCustomerAdditionalFees)
  else if (val === 'checkup') {
    // 备选项目表格在子 tab 切换时挂载
    watch(checkupSubTab, (sub) => {
      if (sub === 'optional') {
        const r = currentRegion()
        if (r?.optionalItems) makeSortable(optionalTableRef, r.optionalItems, saveCheckupPackages)
      }
    }, { immediate: true })
  }
})

onMounted(loadAll)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">服务定价管理</h2>
        <p class="page-subtitle">统一维护下单可选定价与附加项，变更后会直接影响新订单填写体验。</p>
      </div>
    </div>

    <el-tabs v-model="activeCategory" type="border-card">
      <!-- ===== 陪诊服务定价 ===== -->
      <el-tab-pane label="陪诊服务定价" name="escort">
        <div class="tab-toolbar">
          <span class="tab-toolbar__desc">下单时可选择的陪诊服务定价标准，修改后即时生效于新订单。</span>
          <div class="tab-toolbar__actions">
            <el-button type="warning" plain size="small" @click="handleResetEscortPricing">恢复默认</el-button>
            <el-button type="primary" @click="handleEscortAdd"><el-icon><Plus /></el-icon>新增定价项</el-button>
          </div>
        </div>
        <el-table ref="escortTableRef" :data="escortItems" v-loading="loading" stripe row-key="name">
          <el-table-column label="" width="40">
            <template #default><span class="drag-handle" title="拖拽排序"><el-icon><Rank /></el-icon></span></template>
          </el-table-column>
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="name" label="定价名称（下单下拉选项）" min-width="240" />
          <el-table-column label="金额（元）" width="160">
            <template #default="{ row }">
              <span class="cell-price cell-price--success">¥{{ Number(row.price).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.status" @change="handleEscortStatusChange" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ $index }">
              <el-button type="primary" link size="small" @click="handleEscortEdit($index)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleEscortDelete($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="tab-tip tab-tip--success">
          <strong>提示：</strong>状态"关闭"的定价项在新订单中不会显示，但历史订单数据不受影响。
        </div>
      </el-tab-pane>

      <el-tab-pane label="增值服务" name="valueAdded">
        <div class="tab-toolbar">
          <span class="tab-toolbar__desc">陪诊服务增值项单独维护，订单页"附加服务项"会直接读取这里给后台选择。</span>
          <div class="tab-toolbar__actions">
            <el-button type="warning" plain size="small" @click="handleResetValueAddedServices">恢复默认</el-button>
            <el-button type="primary" @click="handleValueAddedServiceAdd"><el-icon><Plus /></el-icon>新增增值项</el-button>
          </div>
        </div>
        <el-table ref="valueAddedTableRef" :data="valueAddedServiceItems" v-loading="loading" stripe row-key="label">
          <el-table-column label="" width="40">
            <template #default><span class="drag-handle" title="拖拽排序"><el-icon><Rank /></el-icon></span></template>
          </el-table-column>
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="label" label="增值服务名称（订单附加服务下拉选项）" min-width="280" />
          <el-table-column label="金额（元）" width="160">
            <template #default="{ row }">
              <span class="cell-price cell-price--success">¥{{ Number(row.fee).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.status" @change="handleValueAddedServiceStatusChange" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ $index }">
              <el-button type="primary" link size="small" @click="handleValueAddedServiceEdit($index)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleValueAddedServiceDelete($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="tab-tip tab-tip--success">
          <strong>提示：</strong>这里维护的是增值服务，后台在订单里可以与"附加服务项"一起选择，也可以继续手动录入其他费用。
        </div>
      </el-tab-pane>

      <el-tab-pane label="附加服务项" name="customerAddon">
        <div class="tab-toolbar">
          <span class="tab-toolbar__desc">除增值服务外，后台可额外维护"附加服务项"供订单页选择，例如加急协助、资料代办等。</span>
          <div class="tab-toolbar__actions">
            <el-button type="warning" plain size="small" @click="handleResetCustomerAdditionalFees">恢复默认</el-button>
            <el-button type="primary" @click="handleCustomerAdditionalFeeAdd"><el-icon><Plus /></el-icon>新增附加项</el-button>
          </div>
        </div>
        <el-table ref="customerAddonTableRef" :data="customerAdditionalFeeItems" v-loading="loading" stripe row-key="label">
          <el-table-column label="" width="40">
            <template #default><span class="drag-handle" title="拖拽排序"><el-icon><Rank /></el-icon></span></template>
          </el-table-column>
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="label" label="附加服务名称（订单附加服务下拉选项）" min-width="280" />
          <el-table-column label="金额（元）" width="160">
            <template #default="{ row }">
              <span class="cell-price cell-price--success">¥{{ Number(row.fee).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.status" @change="handleCustomerAdditionalFeeStatusChange" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ $index }">
              <el-button type="primary" link size="small" @click="handleCustomerAdditionalFeeEdit($index)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleCustomerAdditionalFeeDelete($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="tab-tip tab-tip--success">
          <strong>提示：</strong>订单页会把这里和"增值服务"合并展示；如果没有配置附加服务项，后台仍可在订单里手动填写"其他附加费用"。
        </div>
      </el-tab-pane>

      <!-- ===== 陪诊员费用 ===== -->
      <el-tab-pane label="陪诊员费用" name="attendantFee">
        <div class="tab-toolbar">
          <span class="tab-toolbar__desc">这里维护的是平台内部给陪诊员的派单费用，不对客户展示。</span>
          <div class="tab-toolbar__actions">
            <el-button type="warning" plain size="small" @click="handleResetAttendantFees">恢复默认</el-button>
            <el-button type="primary" @click="handleAttendantFeeAdd"><el-icon><Plus /></el-icon>新增费用项</el-button>
          </div>
        </div>
        <el-table ref="attendantFeeTableRef" :data="attendantFeeItems" v-loading="loading" stripe row-key="label">
          <el-table-column label="" width="40">
            <template #default><span class="drag-handle" title="拖拽排序"><el-icon><Rank /></el-icon></span></template>
          </el-table-column>
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="label" label="费用名称" />
          <el-table-column label="价格（元）" width="150">
            <template #default="{ row }"><span class="cell-price cell-price--primary">¥{{ Number(row.fee).toFixed(2) }}</span></template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }"><el-switch v-model="row.status" @change="handleAttendantFeeStatusChange" /></template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ $index }">
              <el-button type="primary" link size="small" @click="handleAttendantFeeEdit($index)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleAttendantFeeDelete($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="tab-tip tab-tip--primary">
          <strong>提示：</strong>派单、抢单池等场景会读取这里的费用选项，用于计算陪诊员此单收入。
        </div>
      </el-tab-pane>

      <!-- ===== 体检套餐管理 ===== -->
      <el-tab-pane label="体检套餐管理" name="checkup">
        <div class="region-select">
          <div class="region-select__main">
            <span class="region-select__label">城市/区域：</span>
            <el-radio-group v-model="activeRegion" size="default">
              <el-radio-button v-for="r in checkupRegions" :key="r.id" :value="r.id">{{ r.name }}</el-radio-button>
            </el-radio-group>
            <el-button type="primary" link @click="handleAddRegion"><el-icon><Plus /></el-icon>添加城市</el-button>
          </div>
          <div class="region-select__actions">
            <el-button v-if="currentRegion()" type="warning" size="small" @click="handleEditRegion">编辑城市</el-button>
            <el-button v-if="currentRegion()" type="danger" size="small" @click="handleDeleteRegion">删除城市</el-button>
          </div>
        </div>

        <div v-if="currentRegion()" class="region-banner">
          <el-icon><Hospital /></el-icon> <strong>{{ currentRegion()!.hospital || currentRegion()!.name }}</strong>
          <span>共 {{ currentRegion()!.packages.length }} 个套餐</span>
          <span v-if="optionalItemsList().length">· {{ optionalItemsList().length }} 个备选项目</span>
        </div>

        <el-radio-group v-model="checkupSubTab" size="small" class="checkup-subtabs">
          <el-radio-button value="packages">套餐列表</el-radio-button>
          <el-radio-button value="optional">备选项目</el-radio-button>
        </el-radio-group>

        <div v-if="checkupSubTab === 'packages'" class="checkup-actions">
          <el-button v-if="currentRegion()" type="primary" @click="handleCheckupAdd"><el-icon><Plus /></el-icon>新增套餐</el-button>
        </div>
        <div v-else class="checkup-actions">
          <el-button v-if="currentRegion()" type="primary" @click="handleOptionalItemAdd"><el-icon><Plus /></el-icon>新增备选项目</el-button>
          <el-button v-if="currentRegion()?.hospital?.includes('丽水市中心医院')" type="success" size="small" @click="handleImportLishuiOptionalItems">导入丽水备选项目</el-button>
        </div>

        <el-table v-if="currentRegion() && checkupSubTab === 'packages'" :data="currentRegion()!.packages" v-loading="loading" stripe>
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="name" label="套餐名称" min-width="180">
            <template #default="{ row }">
              <el-link type="primary" @click="showDetail(row)">{{ row.name }}</el-link>
            </template>
          </el-table-column>
          <el-table-column label="性别" width="80">
            <template #default="{ row }"><el-tag :type="genderTagType(row.gender)" size="small">{{ genderLabel(row.gender) }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="targetGroup" label="适合人群" min-width="150" show-overflow-tooltip />
          <el-table-column label="价格（元）" width="130">
            <template #default="{ row }"><span class="cell-price cell-price--warning">¥{{ Number(row.price).toLocaleString() }}</span></template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" width="120" show-overflow-tooltip />
          <el-table-column label="状态" width="80">
            <template #default="{ row }"><el-switch v-model="row.status" @change="handleCheckupStatusChange" size="small" /></template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row, $index }">
              <el-button type="info" link size="small" @click="showDetail(row)">详情</el-button>
              <el-button type="primary" link size="small" @click="handleCheckupEdit($index)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleCheckupDelete($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-table ref="optionalTableRef" v-else-if="currentRegion() && checkupSubTab === 'optional'" :data="optionalItemsList()" v-loading="loading" stripe>
          <el-table-column label="" width="40">
            <template #default><span class="drag-handle" title="拖拽排序"><el-icon><Rank /></el-icon></span></template>
          </el-table-column>
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="name" label="项目名称" min-width="200" />
          <el-table-column label="价格（元）" width="130">
            <template #default="{ row }"><span class="cell-price cell-price--warning">¥{{ Number(row.price).toLocaleString() }}</span></template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column prop="specimen" label="标本" width="100" show-overflow-tooltip />
          <el-table-column label="状态" width="80">
            <template #default="{ row }"><el-switch v-model="row.status" @change="saveCheckupPackages" size="small" /></template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ $index }">
              <el-button type="primary" link size="small" @click="handleOptionalItemEdit($index)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleOptionalItemDelete($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="请先添加城市/区域" />
      </el-tab-pane>
    </el-tabs>

    <!-- 陪诊服务定价编辑对话框 -->
    <el-dialog v-model="escortDialogVisible" :title="escortEditIndex >= 0 ? '编辑定价项' : '新增定价项'" width="500px">
      <el-form :model="escortForm" label-width="100px">
        <el-form-item label="服务名称"><el-input v-model="escortForm.name" placeholder="请输入服务名称" /></el-form-item>
        <el-form-item label="价格（元）"><el-input-number v-model="escortForm.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="计价单位"><el-input v-model="escortForm.unit" placeholder="次/天/小时" /></el-form-item>
        <el-form-item label="是否启用"><el-switch v-model="escortForm.status" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="escortDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEscortSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="valueAddedServiceDialogVisible" :title="valueAddedServiceEditIndex >= 0 ? '编辑增值服务' : '新增增值服务'" width="480px">
      <el-form :model="valueAddedServiceForm" label-width="100px">
        <el-form-item label="服务名称">
          <el-input v-model="valueAddedServiceForm.label" placeholder="如：夜间陪同 +200/晚" />
        </el-form-item>
        <el-form-item label="金额（元）">
          <el-input-number v-model="valueAddedServiceForm.fee" :min="0" :precision="2" :step="50" style="width:100%" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="valueAddedServiceForm.status" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="valueAddedServiceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleValueAddedServiceSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="customerAdditionalFeeDialogVisible" :title="customerAdditionalFeeEditIndex >= 0 ? '编辑附加服务项' : '新增附加服务项'" width="480px">
      <el-form :model="customerAdditionalFeeForm" label-width="100px">
        <el-form-item label="收费项名称">
          <el-input v-model="customerAdditionalFeeForm.label" placeholder="如：加急协助" />
        </el-form-item>
        <el-form-item label="金额（元）">
          <el-input-number v-model="customerAdditionalFeeForm.fee" :min="0" :precision="2" :step="50" style="width:100%" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="customerAdditionalFeeForm.status" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customerAdditionalFeeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCustomerAdditionalFeeSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 陪诊员费用编辑对话框 -->
    <el-dialog v-model="attendantFeeDialogVisible" :title="attendantFeeEditIndex >= 0 ? '编辑费用项' : '新增费用项'" width="480px">
      <el-form :model="attendantFeeForm" label-width="100px">
        <el-form-item label="费用名称">
          <el-input v-model="attendantFeeForm.label" placeholder="如：青田全日" />
        </el-form-item>
        <el-form-item label="金额（元）">
          <el-input-number v-model="attendantFeeForm.fee" :min="0" :precision="2" :step="20" style="width:100%" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="attendantFeeForm.status" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="attendantFeeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAttendantFeeSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 城市/区域编辑对话框 -->
    <el-dialog v-model="regionDialogVisible" :title="regionEditMode ? '编辑城市' : '添加城市'" width="500px">
      <el-form :model="regionForm" label-width="100px">
        <el-form-item label="城市名称"><el-input v-model="regionForm.name" placeholder="如：丽水" /></el-form-item>
        <el-form-item label="体检机构"><el-input v-model="regionForm.hospital" placeholder="如：丽水市中心医院国际健康管理中心" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="regionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRegion">保存</el-button>
      </template>
    </el-dialog>

    <!-- 体检套餐编辑对话框 -->
    <el-dialog v-model="checkupDialogVisible" :title="checkupEditIndex >= 0 ? '编辑体检套餐' : '新增体检套餐'" width="700px">
      <el-form :model="checkupForm" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="16"><el-form-item label="套餐名称"><el-input v-model="checkupForm.name" placeholder="如：青年男性基础套餐(菁英)" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="性别">
            <el-select v-model="checkupForm.gender" style="width: 100%;">
              <el-option label="男" value="male" /><el-option label="女" value="female" /><el-option label="儿童" value="child" /><el-option label="通用" value="all" />
            </el-select>
          </el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="适合人群"><el-input v-model="checkupForm.targetGroup" placeholder="如：适合30岁以下男士" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="价格（元）"><el-input-number v-model="checkupForm.price" :min="0" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="临床检查"><el-input v-model="checkupForm.clinicalItems" type="textarea" :rows="2" placeholder="一般情况、内科、外科、眼科..." /></el-form-item>
        <el-form-item label="检验项目"><el-input v-model="checkupForm.labItems" type="textarea" :rows="3" placeholder="血常规、尿常规..." /></el-form-item>
        <el-form-item label="特检项目"><el-input v-model="checkupForm.specialItems" type="textarea" :rows="3" placeholder="肺CT、心电图..." /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="备注"><el-input v-model="checkupForm.notes" placeholder="如：提供营养早餐" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="是否启用"><el-switch v-model="checkupForm.status" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="checkupDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCheckupSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 备选项目编辑对话框 -->
    <el-dialog v-model="optionalItemDialogVisible" :title="optionalItemEditIndex >= 0 ? '编辑备选项目' : '新增备选项目'" width="500px">
      <el-form :model="optionalItemForm" label-width="100px">
        <el-form-item label="项目名称"><el-input v-model="optionalItemForm.name" placeholder="如：动脉硬化筛查" /></el-form-item>
        <el-form-item label="价格（元）"><el-input-number v-model="optionalItemForm.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="optionalItemForm.unit" placeholder="次" /></el-form-item>
        <el-form-item label="标本"><el-input v-model="optionalItemForm.specimen" placeholder="如：血、粪便" /></el-form-item>
        <el-form-item label="是否启用"><el-switch v-model="optionalItemForm.status" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="optionalItemDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleOptionalItemSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 套餐详情对话框 -->
    <el-dialog v-model="detailVisible" :title="detailPackage?.name || '套餐详情'" width="700px">
      <template v-if="detailPackage">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="套餐名称">{{ detailPackage.name }}</el-descriptions-item>
          <el-descriptions-item label="价格"><span class="detail-price-tag">¥{{ Number(detailPackage.price).toLocaleString() }}</span></el-descriptions-item>
          <el-descriptions-item label="适合人群">{{ detailPackage.targetGroup }}</el-descriptions-item>
          <el-descriptions-item label="性别"><el-tag :type="genderTagType(detailPackage.gender)" size="small">{{ genderLabel(detailPackage.gender) }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detailPackage.notes || '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="detail-section detail-section--clinical">
          <h4 class="detail-section__title"><el-icon><FirstAidKit /></el-icon> 临床检查项目</h4>
          <p class="detail-section__body">{{ detailPackage.clinicalItems || '—' }}</p>
        </div>
        <div class="detail-section detail-section--lab">
          <h4 class="detail-section__title"><el-icon><Odometer /></el-icon> 检验项目</h4>
          <p class="detail-section__body">{{ detailPackage.labItems || '—' }}</p>
        </div>
        <div class="detail-section detail-section--special">
          <h4 class="detail-section__title"><el-icon><Monitor /></el-icon> 特检项目</h4>
          <p class="detail-section__body">{{ detailPackage.specialItems || '—' }}</p>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

// 顶部工具条（各 tab 的说明 + 按钮组）
.tab-toolbar {
  margin-bottom: $space-4;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $space-3;
  flex-wrap: wrap;

  &__desc {
    font-size: $font-sm;
    color: $text-tertiary;
  }

  &__actions {
    display: flex;
    gap: $space-2;
    flex-wrap: wrap;
  }
}

// 表格里的价格单元格
.cell-price {
  font-weight: 600;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: $text-primary;

  &--success { color: $success; }
  &--primary { color: $primary-600; }
  &--warning { color: $warning; }
  &--xl { font-size: 18px; font-weight: 700; }
}

// 底部提示条
.tab-tip {
  margin-top: $space-4;
  padding: 12px 16px;
  border-radius: $radius-md;
  font-size: $font-sm;
  line-height: 1.6;

  &--success {
    background: rgba($success, 0.1);
    color: darken($success, 15%);
  }
  &--primary {
    background: rgba($primary-500, 0.08);
    color: $primary-700;
  }
}

// 体检套餐 - 当前城市横幅
.region-banner {
  margin-bottom: $space-3;
  padding: 10px 16px;
  background: $bg-alt;
  border-radius: $radius-md;
  font-size: $font-sm;
  color: $text-secondary;
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-wrap: wrap;

  .el-icon { color: $primary-600; }
  strong { color: $text-primary; }
}

// 体检子 tab 区域
.checkup-subtabs {
  margin-bottom: $space-3;
}

.checkup-actions {
  display: flex;
  gap: $space-2;
  margin-bottom: $space-3;
}

// 城市选择行
.region-select {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $space-3;
  flex-wrap: wrap;
  margin-bottom: $space-4;

  &__main {
    display: flex;
    gap: $space-2;
    align-items: center;
    flex-wrap: wrap;

    .region-select__label {
      font-weight: 600;
      color: $text-primary;
    }
  }

  &__actions {
    display: flex;
    gap: $space-2;
  }
}

// 详情弹窗
.detail-price-tag {
  font-weight: 700;
  color: $warning;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.detail-section {
  margin-top: $space-3;

  &__title {
    margin-bottom: $space-2;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: $font-md;
    font-weight: 600;
  }

  &__body {
    font-size: $font-sm;
    line-height: 1.8;
    color: $text-secondary;
    padding: 12px;
    border-radius: $radius-md;
  }

  &--clinical {
    .detail-section__title { color: $primary-600; }
    .detail-section__body { background: $bg-alt; }
  }
  &--lab {
    .detail-section__title { color: $primary-600; }
    .detail-section__body { background: rgba($primary-500, 0.06); }
  }
  &--special {
    .detail-section__title { color: $warning; }
    .detail-section__body { background: rgba($warning, 0.08); }
  }
}

// 拖拽 UI
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: grab;
  opacity: 0.45;
  transition: opacity 0.15s;

  .el-icon { color: $text-disabled; }
}
.drag-handle:hover { opacity: 1; }
.drag-handle:active { cursor: grabbing; }
.sortable-ghost { opacity: 0.35; background: rgba($primary-500, 0.08) !important; }
.sortable-ghost td { background: rgba($primary-500, 0.08) !important; }
</style>
