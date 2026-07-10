<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  listHospitalDoctors,
  createHospitalDoctor,
  updateHospitalDoctor,
  deleteHospitalDoctor,
  batchHospitalDoctors,
} from '@/api/hospital'
import { get, post } from '@/api/request'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filters = ref({
  province: '' as string,
  city: '',
  keyword: '',
  includeInactive: false,
})

/** 后台列表接口附带：activeDoctorCount / doctorCount（本院医生启用数、总条数） */
function doctorActiveCount(row: any) {
  return Number(row?.activeDoctorCount ?? row?.active_doctor_count ?? 0)
}
function doctorTotalCount(row: any) {
  return Number(row?.doctorCount ?? row?.doctor_count ?? 0)
}

/** 浙江省地级市（筛选用） */
const ZHEJIANG_CITY_ALL = [
  '杭州市',
  '宁波市',
  '温州市',
  '嘉兴市',
  '湖州市',
  '绍兴市',
  '金华市',
  '衢州市',
  '舟山市',
  '台州市',
  '丽水市',
] as const

const dialogVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const imageUploading = ref(false)
const hospitalImageInputRef = ref<HTMLInputElement | null>(null)

const form = ref({
  name: '',
  shortName: '',
  province: '浙江省',
  city: '丽水市',
  district: '',
  address: '',
  phoneMain: '',
  phonesExtraText: '',
  hospitalLevel: '',
  ownershipType: '政府办',
  keyDepartmentsText: '',
  websiteUrl: '',
  imageUrl: '',
  sortWeight: 0,
  isActive: true,
  remark: '',
})

function resetForm() {
  editId.value = null
  form.value = {
    name: '',
    shortName: '',
    province: '浙江省',
    city: '丽水市',
    district: '',
    address: '',
    phoneMain: '',
    phonesExtraText: '',
    hospitalLevel: '',
    ownershipType: '政府办',
    keyDepartmentsText: '',
    websiteUrl: '',
    imageUrl: '',
    sortWeight: 0,
    isActive: true,
    remark: '',
  }
}

async function uploadHospitalImage(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const res: any = await post('/documents/raw-upload', fd)
  const url = String(res?.url || '').trim()
  if (!url) throw new Error('上传失败')
  return url
}

function triggerHospitalImagePick() {
  hospitalImageInputRef.value?.click()
}

async function onHospitalImageSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = [...(input.files ?? [])].find((f) => f.type.startsWith('image/'))
  if (!file) {
    if (input) input.value = ''
    return
  }
  imageUploading.value = true
  try {
    form.value.imageUrl = await uploadHospitalImage(file)
    ElMessage.success('图片已上传')
  } catch {
    ElMessage.error('图片上传失败')
  } finally {
    imageUploading.value = false
    if (input) input.value = ''
  }
}

async function load() {
  loading.value = true
  try {
    const city = filters.value.city?.trim() || ''
    let province = filters.value.province?.trim() || ''
    if (city === '上海市') province = '上海市'
    else if (city && (ZHEJIANG_CITY_ALL as readonly string[]).includes(city)) {
      if (!province) province = '浙江省'
    }
    const res: any = await listHospitals({
      province: province || undefined,
      city: city || undefined,
      keyword: filters.value.keyword || undefined,
      page: page.value,
      pageSize: pageSize.value,
      includeInactive: filters.value.includeInactive,
    })
    items.value = res.items || []
    total.value = res.total || 0
  } catch {
    /* interceptor */
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: any) {
  editId.value = row.id
  form.value = {
    name: row.name || '',
    shortName: row.shortName || '',
    province: row.province || '浙江省',
    city: row.city || '',
    district: row.district || '',
    address: row.address || '',
    phoneMain: row.phoneMain || '',
    phonesExtraText: Array.isArray(row.phonesExtra) ? row.phonesExtra.join('\n') : '',
    hospitalLevel: row.hospitalLevel || '',
    ownershipType: row.ownershipType || '政府办',
    keyDepartmentsText: Array.isArray(row.keyDepartments) ? row.keyDepartments.join('、') : '',
    websiteUrl: row.websiteUrl || '',
    imageUrl: row.imageUrl || '',
    sortWeight: row.sortWeight ?? 0,
    isActive: !!row.isActive,
    remark: row.remark || '',
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.name?.trim() || !form.value.city?.trim() || !form.value.address?.trim()) {
    ElMessage.warning('请填写名称、地级市与地址')
    return
  }
  const phonesExtra = form.value.phonesExtraText
    .split(/[\n,，]/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const keyDepartments = form.value.keyDepartmentsText
    .split(/[、,，]/g)
    .map((s) => s.trim())
    .filter(Boolean)

  const payload: Record<string, unknown> = {
    name: form.value.name.trim(),
    shortName: form.value.shortName?.trim() || null,
    province: form.value.province.trim(),
    city: form.value.city.trim(),
    district: form.value.district?.trim() || null,
    address: form.value.address.trim(),
    phoneMain: form.value.phoneMain?.trim() || null,
    phonesExtra: phonesExtra.length ? phonesExtra : null,
    hospitalLevel: form.value.hospitalLevel?.trim() || null,
    ownershipType: form.value.ownershipType?.trim() || null,
    keyDepartments: keyDepartments.length ? keyDepartments : null,
    websiteUrl: form.value.websiteUrl?.trim() || null,
    imageUrl: form.value.imageUrl?.trim() || null,
    sortWeight: Number(form.value.sortWeight) || 0,
    isActive: form.value.isActive,
    remark: form.value.remark?.trim() || null,
    source: '后台维护',
  }

  saving.value = true
  try {
    if (editId.value != null) {
      await updateHospital(editId.value, payload)
      ElMessage.success('已保存')
    } else {
      await createHospital(payload)
      ElMessage.success('已创建')
    }
    dialogVisible.value = false
    await load()
  } catch {
    /* */
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？`, '删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteHospital(row.id)
    ElMessage.success('已删除')
    await load()
  } catch {
    /* */
  }
}

const doctorsDialogVisible = ref(false)
const doctorsLoading = ref(false)
const doctorHospital = ref<{ id: number; name: string } | null>(null)
const doctors = ref<any[]>([])
const doctorEditVisible = ref(false)
const doctorSaving = ref(false)
const doctorEditId = ref<number | null>(null)
const doctorForm = ref({
  name: '',
  department: '',
  titleLevel: '',
  expertise: '',
  introduction: '',
  sortWeight: 0,
  isActive: true,
})
const batchJson = ref('')
const batchReplace = ref(false)

async function openDoctors(row: any) {
  doctorHospital.value = { id: row.id, name: row.name || '' }
  doctorsDialogVisible.value = true
  await loadDoctors()
}

async function loadDoctors() {
  if (!doctorHospital.value) return
  doctorsLoading.value = true
  try {
    doctors.value = (await listHospitalDoctors(doctorHospital.value.id, true)) as any[]
  } catch {
    doctors.value = []
  } finally {
    doctorsLoading.value = false
  }
}

function resetDoctorForm() {
  doctorEditId.value = null
  doctorForm.value = {
    name: '',
    department: '',
    titleLevel: '',
    expertise: '',
    introduction: '',
    sortWeight: 0,
    isActive: true,
  }
}

function openAddDoctor() {
  resetDoctorForm()
  doctorEditVisible.value = true
}

function openEditDoctor(row: any) {
  doctorEditId.value = row.id
  doctorForm.value = {
    name: row.name || '',
    department: row.department || '',
    titleLevel: row.titleLevel || '',
    expertise: row.expertise || '',
    introduction: row.introduction || '',
    sortWeight: row.sortWeight ?? 0,
    isActive: !!row.isActive,
  }
  doctorEditVisible.value = true
}

async function saveDoctor() {
  if (!doctorHospital.value || !doctorForm.value.name?.trim()) {
    ElMessage.warning('请填写医生姓名')
    return
  }
  doctorSaving.value = true
  try {
    if (doctorEditId.value != null) {
      await updateHospitalDoctor(doctorEditId.value, {
        name: doctorForm.value.name.trim(),
        department: doctorForm.value.department?.trim() || null,
        titleLevel: doctorForm.value.titleLevel?.trim() || null,
        expertise: doctorForm.value.expertise?.trim() || null,
        introduction: doctorForm.value.introduction?.trim() || null,
        sortWeight: Number(doctorForm.value.sortWeight) || 0,
        isActive: doctorForm.value.isActive,
      })
      ElMessage.success('已保存')
    } else {
      await createHospitalDoctor({
        hospitalId: doctorHospital.value.id,
        name: doctorForm.value.name.trim(),
        department: doctorForm.value.department?.trim() || undefined,
        titleLevel: doctorForm.value.titleLevel?.trim() || undefined,
        expertise: doctorForm.value.expertise?.trim() || undefined,
        introduction: doctorForm.value.introduction?.trim() || undefined,
        sortWeight: Number(doctorForm.value.sortWeight) || 0,
        isActive: doctorForm.value.isActive,
      })
      ElMessage.success('已添加')
    }
    doctorEditVisible.value = false
    await loadDoctors()
  } catch {
    /* */
  } finally {
    doctorSaving.value = false
  }
}

async function removeDoctorRow(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除医生「${row.name}」？`, '删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteHospitalDoctor(row.id)
    ElMessage.success('已删除')
    await loadDoctors()
  } catch {
    /* */
  }
}

function onDoctorsDialogClosed() {
  doctorHospital.value = null
  doctors.value = []
  batchJson.value = ''
}

const doctorCsvInputRef = ref<HTMLInputElement | null>(null)

/** 表头别名：便于从官网整理的 Excel 导出后识别（ UTF-8 ） */
const DOCTOR_IMPORT_HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', '姓名'],
  department: ['department', '科室', '专业', '科室专业'],
  titlelevel: ['titlelevel', 'title_level', '职称', '职称级别'],
  expertise: ['expertise', '擅长', '擅长方向'],
  introduction: ['introduction', '简介', '医生简介', '介绍'],
  sortweight: ['sortweight', 'sort_weight', '排序', '排序权重'],
  isactive: ['isactive', 'is_active', '启用', '展示'],
}

function normalizeImportHeaderCell(s: string): string {
  return String(s || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function buildDoctorHeaderMap(headerRow: string[]): Record<string, number> {
  const cells = headerRow.map((h) => normalizeImportHeaderCell(h))
  const map: Record<string, number> = {}
  for (const [canonical, aliases] of Object.entries(DOCTOR_IMPORT_HEADER_ALIASES)) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      if (aliases.some((a) => normalizeImportHeaderCell(a) === c)) {
        map[canonical] = i
        break
      }
    }
  }
  return map
}

/** 简单 CSV（支持双引号字段）；或 Tab 分隔（Excel 粘贴常用） */
function parseDoctorTableRaw(text: string): string[][] {
  const raw = String(text || '').replace(/^\uFEFF/, '')
  const firstLine = (raw.split(/\r\n|\n|\r/).find((l) => l.trim()) || '').trim()
  const tabs = (firstLine.match(/\t/g) || []).length
  /** 分隔符 */
  const sep = tabs > 0 ? '\t' : ','
  const rows: string[][] = []
  if (sep === '\t') {
    for (const line of raw.split(/\r\n|\n|\r/)) {
      if (!line.trim()) continue
      rows.push(line.split('\t').map((c) => c.trim()))
    }
    return rows
  }
  let row: string[] = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (inQ) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQ = true
    } else if (c === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++
      row.push(cell.trim())
      cell = ''
      if (row.some((x) => x.length)) rows.push(row)
      row = []
    } else {
      cell += c
    }
  }
  row.push(cell.trim())
  if (row.some((x) => x.length)) rows.push(row)
  return rows
}

function parseDoctorTableToItems(text: string): Record<string, unknown>[] {
  const matrix = parseDoctorTableRaw(text)
  if (matrix.length < 2) return []
  const headerRow = matrix[0]
  if (!headerRow) return []
  const hmap = buildDoctorHeaderMap(headerRow)
  if (hmap.name === undefined) {
    throw new Error('首行须含「姓名」或 name 列，可参考模板')
  }
  const items: Record<string, unknown>[] = []
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r]
    if (!cells) continue
    const name = String(cells[hmap.name] ?? '').trim()
    if (!name) continue
    const pick = (key: string) => {
      const idx = hmap[key]
      if (idx === undefined) return ''
      return String(cells[idx] ?? '').trim()
    }
    const dept = pick('department')
    const title = pick('titlelevel')
    const exp = pick('expertise')
    const intro = pick('introduction')
    let sortWeight: number | undefined
    const sw = pick('sortweight')
    if (sw) {
      const n = Number(sw)
      if (Number.isFinite(n)) sortWeight = n
    }
    let isActive = true
    const ia = pick('isactive')
    if (ia) {
      const v = ia.toLowerCase()
      if (v === '0' || v === 'false' || v === '否' || v === 'no') isActive = false
    }
    items.push({
      name,
      ...(dept ? { department: dept } : {}),
      ...(title ? { titleLevel: title } : {}),
      ...(exp ? { expertise: exp } : {}),
      ...(intro ? { introduction: intro } : {}),
      ...(sortWeight !== undefined ? { sortWeight } : {}),
      isActive,
    })
  }
  return items
}

function downloadDoctorImportTemplate() {
  const header =
    'name,department,titleLevel,expertise,introduction,sortWeight,isActive\n' +
    '示例医生,心内科,主任医师,冠心病介入,长期从事心血管疾病诊疗工作,100,1\n'
  const blob = new Blob(['\uFEFF' + header], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '本院医生导入模板.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function triggerDoctorCsvPick() {
  doctorCsvInputRef.value?.click()
}

async function onDoctorCsvChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !doctorHospital.value) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const text = String(reader.result || '')
      const items = parseDoctorTableToItems(text)
      await runBatchWithItems(items as any[])
    } catch (e: any) {
      ElMessage.error(e?.message || '文件解析失败')
    }
  }
  reader.onerror = () => ElMessage.error('读取文件失败')
  reader.readAsText(file, 'UTF-8')
}

function normalizeDoctorBatchItem(raw: any) {
  const name = String(raw?.name ?? '').trim()
  return {
    name,
    department:
      raw?.department != null && String(raw.department).trim()
        ? String(raw.department).trim()
        : undefined,
    titleLevel:
      raw?.titleLevel != null && String(raw.titleLevel).trim()
        ? String(raw.titleLevel).trim()
        : undefined,
    expertise:
      raw?.expertise != null && String(raw.expertise).trim()
        ? String(raw.expertise).trim()
        : undefined,
    introduction:
      raw?.introduction != null && String(raw.introduction).trim()
        ? String(raw.introduction).trim()
        : undefined,
    sortWeight:
      raw?.sortWeight != null && Number.isFinite(Number(raw.sortWeight))
        ? Number(raw.sortWeight)
        : undefined,
    isActive: raw?.isActive === false || raw?.isActive === 0 ? false : true,
  }
}

async function runBatchWithItems(rawItems: any[]) {
  if (!doctorHospital.value) return
  const items = rawItems.map(normalizeDoctorBatchItem).filter((x) => x.name.length > 0)
  if (!items.length) {
    ElMessage.warning('没有有效记录（至少需要姓名）')
    return
  }
  try {
    if (batchReplace.value) {
      await ElMessageBox.confirm(
        '将先删除该院全部医生记录再导入，不可恢复。是否继续？',
        '覆盖导入',
        { type: 'warning' },
      )
    }
    await batchHospitalDoctors({
      hospitalId: doctorHospital.value.id,
      replace: batchReplace.value,
      items,
    })
    ElMessage.success(`已导入 ${items.length} 条`)
    batchJson.value = ''
    await loadDoctors()
  } catch {
    /* */
  }
}

async function runBatchDoctors() {
  if (!doctorHospital.value) return
  let rawItems: any[]
  try {
    rawItems = JSON.parse(batchJson.value || '[]')
  } catch {
    ElMessage.error('JSON 格式不正确')
    return
  }
  if (!Array.isArray(rawItems) || !rawItems.length) {
    ElMessage.warning('请粘贴非空 JSON 数组，示例见下方说明')
    return
  }
  await runBatchWithItems(rawItems)
}

async function focusHospitalFromQuery() {
  const raw = route.query.focusHospitalId
  const idStr = Array.isArray(raw) ? raw[0] : raw
  const id = idStr ? Number(idStr) : NaN
  if (!Number.isFinite(id) || id <= 0) return

  const nameRaw = route.query.focusHospitalName
  const nameStr = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw
  let hospitalName = typeof nameStr === 'string' ? nameStr : ''

  if (!hospitalName) {
    try {
      const hospital: any = await get(`/hospitals/lookup/${id}`)
      hospitalName = hospital?.name || ''
    } catch {
      /* 部分医院停用后 lookup 会 404，允许以空名称继续打开 */
    }
  }

  try {
    await openDoctors({ id, name: hospitalName })
  } finally {
    router.replace({ path: route.path })
  }
}

onMounted(async () => {
  await load()
  await focusHospitalFromQuery()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">医院与医生名录</h2>
        <p class="page-subtitle">集中维护合作医院基础信息与旗下医生名单（跨医院检索请使用列表筛选）。</p>
      </div>
    </div>

    <el-card shadow="never" class="filter-bar">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
        <el-input v-model="filters.province" placeholder="省" clearable style="width: 120px;" />
        <el-select v-model="filters.city" placeholder="市" clearable style="width: 150px;">
          <el-option label="全部地级市" value="" />
          <el-option v-for="c in ZHEJIANG_CITY_ALL" :key="c" :label="c" :value="c" />
          <el-option label="上海市" value="上海市" />
        </el-select>
        <el-input v-model="filters.keyword" placeholder="名称/地址/电话" clearable style="width: 220px;" />
        <el-checkbox v-model="filters.includeInactive">含停用</el-checkbox>
        <el-button type="primary" @click="page = 1; load()"><el-icon><Search /></el-icon>查询</el-button>
        <el-button @click="openCreate"><el-icon><Plus /></el-icon>新增医院</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-card__header">
          <span class="table-card__title">医院列表 <el-tag size="small" type="info" effect="plain" style="margin-left:8px;">共 {{ total }} 条</el-tag></span>
        </div>
      </template>
      <el-table :data="items" v-loading="loading" highlight-current-row :header-cell-style="{ fontWeight: '600', color: '#475569', fontSize: '13px', background: '#f8fafc' }">
        <el-table-column label="图" width="56">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              fit="cover"
              style="width: 40px; height: 40px; border-radius: 4px;"
              :preview-src-list="[row.imageUrl]"
              preview-teleported
            />
            <span v-else style="color: #ccc;">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="city" label="市" width="100" />
        <el-table-column prop="district" label="区县" width="100" />
        <el-table-column prop="name" label="医院名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="hospitalLevel" label="等级" width="72" />
        <el-table-column prop="ownershipType" label="举办主体" width="88" />
        <el-table-column prop="phoneMain" label="电话" width="130" show-overflow-tooltip />
        <el-table-column label="重点科室" min-width="160">
          <template #default="{ row }">
            {{ Array.isArray(row.keyDepartments) ? row.keyDepartments.join('、') : '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="isActive" label="启用" width="64">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="本院医生" width="148" fixed="right">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <el-tag
                v-if="doctorActiveCount(row) === 0"
                type="warning"
                size="small"
              >
                未维护
              </el-tag>
              <el-tag v-else type="success" size="small">
                启用 {{ doctorActiveCount(row) }}
              </el-tag>
              <span
                v-if="doctorTotalCount(row) > doctorActiveCount(row)"
                style="font-size: 12px; color: #909399;"
              >含停用{{ doctorTotalCount(row) - doctorActiveCount(row) }}</span>
              <el-button link type="primary" @click="openDoctors(row)">维护</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <span class="pagination-info">共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑医院' : '新增医院'" width="560px" destroy-on-close @closed="resetForm">
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="全称" />
        </el-form-item>
        <el-form-item label="简称">
          <el-input v-model="form.shortName" />
        </el-form-item>
        <el-form-item label="省">
          <el-input v-model="form.province" />
        </el-form-item>
        <el-form-item label="市" required>
          <el-input v-model="form.city" placeholder="如 丽水市" />
        </el-form-item>
        <el-form-item label="区县">
          <el-input v-model="form.district" />
        </el-form-item>
        <el-form-item label="地址" required>
          <el-input v-model="form.address" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="主电话">
          <el-input v-model="form.phoneMain" />
        </el-form-item>
        <el-form-item label="其它电话">
          <el-input v-model="form.phonesExtraText" type="textarea" :rows="2" placeholder="每行一个，或逗号分隔" />
        </el-form-item>
        <el-form-item label="医院等级">
          <el-select v-model="form.hospitalLevel" clearable placeholder="选择" style="width: 100%;">
            <el-option label="三甲" value="三甲" />
            <el-option label="三乙" value="三乙" />
            <el-option label="三级" value="三级" />
            <el-option label="二甲" value="二甲" />
            <el-option label="二级" value="二级" />
            <el-option label="未定级" value="未定级" />
          </el-select>
        </el-form-item>
        <el-form-item label="举办主体">
          <el-select v-model="form.ownershipType" style="width: 100%;">
            <el-option label="政府办" value="政府办" />
            <el-option label="社会办" value="社会办" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="重点科室">
          <el-input v-model="form.keyDepartmentsText" placeholder="顿号或逗号分隔，如 心血管内科、急诊" />
        </el-form-item>
        <el-form-item label="官网">
          <el-input v-model="form.websiteUrl" />
        </el-form-item>
        <el-form-item label="封面图">
          <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
            <el-input v-model="form.imageUrl" placeholder="图片 URL，或点击下方上传" />
            <input
              ref="hospitalImageInputRef"
              type="file"
              accept="image/*"
              style="display: none;"
              @change="onHospitalImageSelected"
            >
            <el-button :loading="imageUploading" @click="triggerHospitalImagePick">上传图片</el-button>
          </div>
          <el-image
            v-if="form.imageUrl"
            :src="form.imageUrl"
            fit="contain"
            style="margin-top: 8px; max-width: 200px; max-height: 120px; border-radius: 6px;"
          />
        </el-form-item>
        <el-form-item label="排序权重">
          <el-input-number v-model="form.sortWeight" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="doctorsDialogVisible"
      :title="doctorHospital ? `本院医生 — ${doctorHospital.name}` : '本院医生'"
      width="880px"
      destroy-on-close
      append-to-body
      @closed="onDoctorsDialogClosed"
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
        title="导入说明（重要）"
        description="系统不会从医院官网自动抓取医生数据（避免版权与信息时效风险）。正确做法：在官网「专家介绍」等页面人工核对后，整理为表格再导入——可使用下方「下载 CSV 模板」或 JSON。支持 UTF-8 的 .csv，或从 Excel 复制为制表符分隔后粘贴到文本文件保存。"
      />
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
        title="字段说明"
        description="姓名、科室/专业、职称（如主任医师）、擅长、简介。表头支持英文（name, department, titleLevel, expertise, introduction, sortWeight, isActive）或中文（姓名、科室、职称、擅长、简介等）。"
      />
      <input
        ref="doctorCsvInputRef"
        type="file"
        accept=".csv,text/csv,.txt,text/plain"
        style="display: none"
        @change="onDoctorCsvChange"
      />
      <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
        <el-button type="primary" @click="openAddDoctor">新增医生</el-button>
        <el-button @click="loadDoctors">刷新列表</el-button>
      </div>
      <el-table :data="doctors" v-loading="doctorsLoading" stripe max-height="320">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="department" label="科室/专业" width="130" show-overflow-tooltip />
        <el-table-column prop="titleLevel" label="职称" width="110" show-overflow-tooltip />
        <el-table-column prop="expertise" label="擅长" min-width="200" show-overflow-tooltip />
        <el-table-column prop="introduction" label="简介" min-width="220" show-overflow-tooltip />
        <el-table-column prop="sortWeight" label="排序" width="72" />
        <el-table-column prop="isActive" label="展示" width="72">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDoctor(row)">编辑</el-button>
            <el-button link type="danger" @click="removeDoctorRow(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-divider>批量导入（推荐：CSV / Excel 导出 UTF-8）</el-divider>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
        <el-button type="primary" plain @click="downloadDoctorImportTemplate">下载 CSV 模板</el-button>
        <el-button @click="triggerDoctorCsvPick">选择 CSV 文件导入</el-button>
      </div>
      <p style="color: #909399; font-size: 12px; margin: 0 0 12px;">
        与下方选项配合：不勾选「清空」则在已有名单后<strong>追加</strong>；勾选则会先删光该院医生再写入。
      </p>
      <el-divider>批量导入（JSON 数组）</el-divider>
      <p style="color: #909399; font-size: 12px; margin: 0 0 8px;">
        示例：
        <code>[{&quot;name&quot;:&quot;张三&quot;,&quot;department&quot;:&quot;心内科&quot;,&quot;titleLevel&quot;:&quot;主任医师&quot;,&quot;expertise&quot;:&quot;冠心病介入&quot;,&quot;introduction&quot;:&quot;长期从事心血管疾病诊疗&quot;}]</code>
      </p>
      <el-input
        v-model="batchJson"
        type="textarea"
        :rows="4"
        placeholder='粘贴 JSON 数组，每项含 name（必填）及可选 department、titleLevel、expertise、introduction、sortWeight'
      />
      <div style="margin-top: 8px; display: flex; align-items: center; gap: 12px;">
        <el-checkbox v-model="batchReplace">导入前清空该院已有医生（谨慎）</el-checkbox>
        <el-button type="warning" @click="runBatchDoctors">执行批量导入</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="doctorEditVisible" :title="doctorEditId ? '编辑医生' : '新增医生'" width="480px" destroy-on-close append-to-body>
      <el-form label-width="100px">
        <el-form-item label="姓名" required>
          <el-input v-model="doctorForm.name" placeholder="与公示信息一致" />
        </el-form-item>
        <el-form-item label="科室/专业">
          <el-input v-model="doctorForm.department" placeholder="如 心血管内科" />
        </el-form-item>
        <el-form-item label="职称">
          <el-select v-model="doctorForm.titleLevel" clearable placeholder="选择或留空" filterable allow-create style="width: 100%;">
            <el-option label="主任医师" value="主任医师" />
            <el-option label="副主任医师" value="副主任医师" />
            <el-option label="主治医师" value="主治医师" />
            <el-option label="住院医师" value="住院医师" />
            <el-option label="主任中医师" value="主任中医师" />
            <el-option label="副主任中医师" value="副主任中医师" />
          </el-select>
        </el-form-item>
        <el-form-item label="擅长">
          <el-input v-model="doctorForm.expertise" type="textarea" :rows="3" placeholder="诊治方向、病种等" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="doctorForm.introduction" type="textarea" :rows="4" placeholder="医生简介、背景、研究方向等" />
        </el-form-item>
        <el-form-item label="排序权重">
          <el-input-number v-model="doctorForm.sortWeight" :min="0" :max="99999" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px;">越大越靠前</span>
        </el-form-item>
        <el-form-item label="启用展示">
          <el-switch v-model="doctorForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="doctorEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="doctorSaving" @click="saveDoctor">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
