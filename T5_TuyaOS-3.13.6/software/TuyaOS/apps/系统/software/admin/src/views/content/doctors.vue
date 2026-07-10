<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listAllDoctors,
  listHospitals,
  getHospitalRegions,
  updateHospitalDoctor,
  deleteHospitalDoctor,
} from '@/api/hospital'

const router = useRouter()

const loading = ref(false)
const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filters = reactive({
  keyword: '' as string,
  province: '' as string,
  city: '' as string,
  hospitalId: null as number | null,
  includeInactive: false as boolean,
})

/** 省/市联动选项（仅启用医院涉及） */
const regionOptions = ref<{ province: string; cities: string[] }[]>([])
const provinceList = computed(() => regionOptions.value.map((r) => r.province))
const cityList = computed(() => {
  if (!filters.province) {
    const all = new Set<string>()
    regionOptions.value.forEach((r) => r.cities.forEach((c) => all.add(c)))
    return Array.from(all)
  }
  return regionOptions.value.find((r) => r.province === filters.province)?.cities ?? []
})

async function loadRegions() {
  try {
    const res: any = await getHospitalRegions()
    regionOptions.value = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : []
  } catch {
    regionOptions.value = []
  }
}

watch(
  () => filters.province,
  () => {
    if (filters.city && !cityList.value.includes(filters.city)) filters.city = ''
  },
)

/** 医院远程搜索（医院多达数千家，避免一次性加载） */
const hospitalOptions = ref<{ id: number; name: string; city?: string }[]>([])
const hospitalSearching = ref(false)
async function searchHospitals(keyword: string) {
  const kw = String(keyword || '').trim()
  if (!kw) {
    hospitalOptions.value = []
    return
  }
  hospitalSearching.value = true
  try {
    const res: any = await listHospitals({ keyword: kw, page: 1, pageSize: 30, includeInactive: true })
    const rows = Array.isArray(res?.items) ? res.items : []
    hospitalOptions.value = rows.map((h: any) => ({ id: h.id, name: h.name, city: h.city }))
  } catch {
    hospitalOptions.value = []
  } finally {
    hospitalSearching.value = false
  }
}

function selectedHospitalLabel(row: any) {
  const name = row?.hospitalName || '—'
  const city = row?.hospitalCity
  return city ? `${city} · ${name}` : name
}

async function load() {
  loading.value = true
  try {
    const res: any = await listAllDoctors({
      keyword: filters.keyword?.trim() || undefined,
      province: filters.province?.trim() || undefined,
      city: filters.city?.trim() || undefined,
      hospitalId: filters.hospitalId ?? undefined,
      page: page.value,
      pageSize: pageSize.value,
      includeInactive: filters.includeInactive,
    })
    items.value = Array.isArray(res?.items) ? res.items : []
    total.value = Number(res?.total) || 0
  } catch {
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.province = ''
  filters.city = ''
  filters.hospitalId = null
  filters.includeInactive = false
  hospitalOptions.value = []
  page.value = 1
  load()
}

/** 编辑医生（复用与医院维护弹窗一致的字段） */
const editVisible = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const editForm = reactive({
  name: '',
  department: '',
  titleLevel: '',
  expertise: '',
  introduction: '',
  sortWeight: 0,
  isActive: true,
})
const editingHospital = ref<{ id: number; name: string; city?: string } | null>(null)

function openEdit(row: any) {
  editingId.value = row.id
  editingHospital.value = {
    id: row.hospitalId,
    name: row.hospitalName || '',
    city: row.hospitalCity || '',
  }
  editForm.name = row.name || ''
  editForm.department = row.department || ''
  editForm.titleLevel = row.titleLevel || ''
  editForm.expertise = row.expertise || ''
  editForm.introduction = row.introduction || ''
  editForm.sortWeight = Number(row.sortWeight) || 0
  editForm.isActive = !!row.isActive
  editVisible.value = true
}

async function saveEdit() {
  if (!editingId.value) return
  if (!editForm.name?.trim()) {
    ElMessage.warning('请填写医生姓名')
    return
  }
  saving.value = true
  try {
    await updateHospitalDoctor(editingId.value, {
      name: editForm.name.trim(),
      department: editForm.department?.trim() || null,
      titleLevel: editForm.titleLevel?.trim() || null,
      expertise: editForm.expertise?.trim() || null,
      introduction: editForm.introduction?.trim() || null,
      sortWeight: Number(editForm.sortWeight) || 0,
      isActive: editForm.isActive,
    })
    ElMessage.success('已保存')
    editVisible.value = false
    await load()
  } catch {
    /* interceptor */
  } finally {
    saving.value = false
  }
}

async function removeRow(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除医生「${row.name}」（${row.hospitalName || '未知医院'}）？`,
      '删除',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteHospitalDoctor(row.id)
    ElMessage.success('已删除')
    await load()
  } catch {
    /* interceptor */
  }
}

/** 跳转到「医院与医生名录」并聚焦该院维护弹窗 */
function goHospitalMaintain(row: any) {
  router.push({
    path: '/service/hospitals',
    query: {
      focusHospitalId: row.hospitalId,
      focusHospitalName: row.hospitalName || '',
    },
  })
}

/** 快速切换启用/停用 */
async function toggleActive(row: any) {
  const next = !row.isActive
  const tipAction = next ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确定${tipAction}医生「${row.name}」？`, tipAction, {
      type: next ? 'info' : 'warning',
    })
  } catch {
    return
  }
  try {
    await updateHospitalDoctor(row.id, { isActive: next })
    ElMessage.success(`已${tipAction}`)
    row.isActive = next
  } catch {
    /* interceptor */
  }
}

function onQuery() {
  page.value = 1
  load()
}

function onPageChange(p: number) {
  page.value = p
  load()
}

onMounted(async () => {
  await loadRegions()
  await load()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">医生总名单</h2>
        <p class="page-subtitle">
          跨医院检索全部医生记录，支持按省/市、医院或关键字筛选。
          单家医院内大批量维护、CSV 导入请使用「医院与医生名录 → 维护」。
        </p>
      </div>
    </div>

    <el-card shadow="never" class="filter-bar">
      <div class="filter-row">
        <el-input
          v-model="filters.keyword"
          placeholder="姓名 / 科室 / 职称 / 擅长 / 医院"
          clearable
          style="width: 280px;"
          @keyup.enter="onQuery"
        />
        <el-select
          v-model="filters.province"
          placeholder="省"
          clearable
          filterable
          style="width: 160px;"
        >
          <el-option v-for="p in provinceList" :key="p" :label="p" :value="p" />
        </el-select>
        <el-select
          v-model="filters.city"
          placeholder="市"
          clearable
          filterable
          style="width: 160px;"
        >
          <el-option v-for="c in cityList" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select
          v-model="filters.hospitalId"
          placeholder="按医院搜索（输入名称关键字）"
          filterable
          remote
          clearable
          reserve-keyword
          :remote-method="searchHospitals"
          :loading="hospitalSearching"
          style="width: 280px;"
        >
          <el-option
            v-for="h in hospitalOptions"
            :key="h.id"
            :label="h.city ? `${h.city} · ${h.name}` : h.name"
            :value="h.id"
          />
        </el-select>
        <el-checkbox v-model="filters.includeInactive">含停用</el-checkbox>
        <el-button type="primary" @click="onQuery">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <el-button @click="resetFilters">
          <el-icon><Refresh /></el-icon>重置
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-card__header">
          <span class="table-card__title">
            医生列表
            <el-tag size="small" type="info" effect="plain" style="margin-left:8px;">
              共 {{ total }} 位
            </el-tag>
          </span>
          <el-button size="small" plain @click="load">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
      </template>

      <el-table
        :data="items"
        v-loading="loading"
        highlight-current-row
        :header-cell-style="{
          fontWeight: '600',
          color: '#475569',
          fontSize: '13px',
          background: '#f8fafc',
        }"
      >
        <el-table-column label="头像" width="64">
          <template #default="{ row }">
            <el-avatar
              v-if="row.avatarUrl"
              :src="row.avatarUrl"
              :size="36"
              shape="circle"
            />
            <el-avatar v-else :size="36" shape="circle" style="background: #e5e7eb; color: #64748b;">
              {{ (row.name || '?').slice(0, 1) }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" width="110" />
        <el-table-column prop="department" label="科室/专业" width="150" show-overflow-tooltip />
        <el-table-column prop="titleLevel" label="职称" width="110" show-overflow-tooltip />
        <el-table-column label="所属医院" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <div>
              <div style="font-weight: 500;">{{ selectedHospitalLabel(row) }}</div>
              <div style="color: #94a3b8; font-size: 12px;">
                医院 ID：{{ row.hospitalId }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="expertise" label="擅长" min-width="220" show-overflow-tooltip />
        <el-table-column prop="sortWeight" label="排序" width="72" />
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="toggleActive(row)">
              {{ row.isActive ? '停用' : '启用' }}
            </el-button>
            <el-button link type="primary" @click="goHospitalMaintain(row)">去医院维护</el-button>
            <el-button link type="danger" @click="removeRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <span class="pagination-info">共 {{ total }} 位医生</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="onPageChange"
          @size-change="(n: number) => { pageSize = n; page = 1; load() }"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="editVisible"
      title="编辑医生"
      width="520px"
      destroy-on-close
      append-to-body
    >
      <el-alert
        v-if="editingHospital"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
        :title="`所属医院：${editingHospital.city ? editingHospital.city + ' · ' : ''}${editingHospital.name || '—'}（ID ${editingHospital.id}）`"
        description="如需更换所属医院，请到「医院与医生名录 → 维护」中先删除再添加。"
      />
      <el-form label-width="100px">
        <el-form-item label="姓名" required>
          <el-input v-model="editForm.name" placeholder="与公示信息一致" />
        </el-form-item>
        <el-form-item label="科室/专业">
          <el-input v-model="editForm.department" placeholder="如 心血管内科" />
        </el-form-item>
        <el-form-item label="职称">
          <el-select
            v-model="editForm.titleLevel"
            clearable
            filterable
            allow-create
            placeholder="选择或留空"
            style="width: 100%;"
          >
            <el-option label="主任医师" value="主任医师" />
            <el-option label="副主任医师" value="副主任医师" />
            <el-option label="主治医师" value="主治医师" />
            <el-option label="住院医师" value="住院医师" />
            <el-option label="主任中医师" value="主任中医师" />
            <el-option label="副主任中医师" value="副主任中医师" />
          </el-select>
        </el-form-item>
        <el-form-item label="擅长">
          <el-input
            v-model="editForm.expertise"
            type="textarea"
            :rows="3"
            placeholder="诊治方向、病种等"
          />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="editForm.introduction"
            type="textarea"
            :rows="4"
            placeholder="医生简介、背景、研究方向等"
          />
        </el-form-item>
        <el-form-item label="排序权重">
          <el-input-number v-model="editForm.sortWeight" :min="0" :max="99999" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px;">越大越靠前</span>
        </el-form-item>
        <el-form-item label="启用展示">
          <el-switch v-model="editForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-header {
  padding: 4px 4px 0;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}
.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}
.filter-bar :deep(.el-card__body) {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.table-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}
.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
}
.pagination-info {
  color: #64748b;
  font-size: 13px;
}
</style>
