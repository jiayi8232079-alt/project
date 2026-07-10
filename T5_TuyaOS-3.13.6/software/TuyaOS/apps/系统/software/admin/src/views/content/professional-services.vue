<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createProfessionalService,
  deleteProfessionalService,
  listProfessionalServices,
  toggleProfessionalService,
  updateProfessionalService,
  type ProfessionalServiceCategory,
  type ProfessionalServiceItem,
  type ProfessionalServiceSopStep,
} from '@/api/professional-service'

const CATEGORY_LABEL: Record<ProfessionalServiceCategory, string> = {
  nutrition: '营养服务',
  rehabilitation: '康复指导',
  nursing: '护理对接',
  psychology: '心理支持',
  maternal_child: '母婴育护',
}

const CATEGORY_TAG: Record<ProfessionalServiceCategory, any> = {
  nutrition: 'success',
  rehabilitation: 'warning',
  nursing: 'primary',
  psychology: 'info',
  maternal_child: 'danger',
}

const loading = ref(false)
const list = ref<ProfessionalServiceItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterCategory = ref<ProfessionalServiceCategory | ''>('')
const filterEnabled = ref<'' | 'true' | 'false'>('')
const filterKeyword = ref('')

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterCategory.value) params.category = filterCategory.value
    if (filterEnabled.value !== '') params.enabled = filterEnabled.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await listProfessionalServices(params)
    list.value = res.items || []
    total.value = res.total || 0
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filterCategory.value = ''
  filterEnabled.value = ''
  filterKeyword.value = ''
  page.value = 1
  loadData()
}

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = ref({
  category: 'nutrition' as ProfessionalServiceCategory,
  code: '',
  name: '',
  shortDesc: '',
  detail: '',
  icon: 'medical_services',
  coverImage: '',
  targetGroupsText: '',
  highlightsText: '',
  durationHint: '',
  priceDisplayText: '',
  sopSteps: [] as ProfessionalServiceSopStep[],
  enabled: true,
  sortOrder: 999,
})

function openCreate() {
  editingId.value = null
  form.value = {
    category: 'nutrition',
    code: '',
    name: '',
    shortDesc: '',
    detail: '',
    icon: 'medical_services',
    coverImage: '',
    targetGroupsText: '',
    highlightsText: '',
    durationHint: '',
    priceDisplayText: '',
    sopSteps: [{ title: '', description: '', durationMin: undefined, checklistItems: [] }],
    enabled: true,
    sortOrder: 999,
  }
  dialogVisible.value = true
}

function openEdit(row: ProfessionalServiceItem) {
  editingId.value = row.id
  form.value = {
    category: row.category,
    code: row.code,
    name: row.name,
    shortDesc: row.shortDesc,
    detail: row.detail || '',
    icon: row.icon,
    coverImage: row.coverImage || '',
    targetGroupsText: (row.targetGroups || []).join(','),
    highlightsText: (row.highlights || []).join('\n'),
    durationHint: row.durationHint || '',
    priceDisplayText: row.priceDisplayText || '',
    sopSteps: (row.sopSteps || []).map((s) => ({
      title: s.title,
      description: s.description,
      durationMin: s.durationMin,
      checklistItems: s.checklistItems ? [...s.checklistItems] : [],
    })),
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  }
  dialogVisible.value = true
}

function addSopStep() {
  form.value.sopSteps.push({
    title: '',
    description: '',
    durationMin: undefined,
    checklistItems: [],
  })
}

function removeSopStep(index: number) {
  form.value.sopSteps.splice(index, 1)
}

function addChecklistItem(stepIndex: number) {
  const step = form.value.sopSteps[stepIndex]
  if (!step) return
  if (!step.checklistItems) step.checklistItems = []
  step.checklistItems.push('')
}

function removeChecklistItem(stepIndex: number, itemIndex: number) {
  const step = form.value.sopSteps[stepIndex]
  if (!step || !step.checklistItems) return
  step.checklistItems.splice(itemIndex, 1)
}

async function handleSave() {
  if (!form.value.code || !form.value.name || !form.value.shortDesc) {
    ElMessage.warning('请完整填写编码、名称与一句话介绍')
    return
  }
  const cleanedSop = (form.value.sopSteps || []).filter(
    (s) => s.title.trim() && s.description.trim(),
  )
  if (cleanedSop.length === 0) {
    ElMessage.warning('至少保留一条有效的 SOP 步骤')
    return
  }
  const payload: any = {
    category: form.value.category,
    code: form.value.code.trim(),
    name: form.value.name.trim(),
    shortDesc: form.value.shortDesc.trim(),
    detail: form.value.detail.trim() || null,
    icon: form.value.icon || 'medical_services',
    coverImage: form.value.coverImage.trim() || null,
    targetGroups: form.value.targetGroupsText
      .split(/[,，;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
    highlights: form.value.highlightsText
      .split(/[\n;；]/)
      .map((s) => s.trim())
      .filter(Boolean),
    durationHint: form.value.durationHint.trim() || null,
    priceDisplayText: form.value.priceDisplayText.trim() || null,
    sopSteps: cleanedSop.map((s) => ({
      title: s.title.trim(),
      description: s.description.trim(),
      durationMin: s.durationMin ? Number(s.durationMin) : undefined,
      checklistItems: (s.checklistItems || [])
        .map((x) => String(x).trim())
        .filter(Boolean),
    })),
    enabled: form.value.enabled,
    sortOrder: Number(form.value.sortOrder) || 999,
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateProfessionalService(editingId.value, payload)
    } else {
      await createProfessionalService(payload)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleToggle(row: ProfessionalServiceItem) {
  try {
    await toggleProfessionalService(row.id)
    ElMessage.success(row.enabled ? '已禁用' : '已启用')
    await loadData()
  } catch {
    /* noop */
  }
}

async function handleDelete(row: ProfessionalServiceItem) {
  if (row.source === 'builtin') {
    ElMessage.warning('内置服务不可删除，可改为禁用')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '提示', { type: 'warning' })
    await deleteProfessionalService(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch {
    /* noop */
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">专业服务目录</h2>
        <p class="page-subtitle">
          营养 / 康复 / 护理 / 心理支持 / 母婴育护 等非陪诊服务的商品化目录，
          用于小程序展示、客服报价与服务 SOP 执行。
        </p>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增服务
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
      title="当前平台不走线上支付"
      description="价格字段仅为展示文案，用户在小程序点击「咨询预约」后由客服跟进报价与下单。"
    />

    <el-card shadow="never" class="filter-bar">
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <el-select
          v-model="filterCategory"
          placeholder="分类"
          clearable
          style="width: 160px;"
          @change="() => { page = 1; loadData() }"
        >
          <el-option label="营养服务" value="nutrition" />
          <el-option label="康复指导" value="rehabilitation" />
          <el-option label="护理对接" value="nursing" />
          <el-option label="心理支持" value="psychology" />
          <el-option label="母婴育护" value="maternal_child" />
        </el-select>
        <el-select
          v-model="filterEnabled"
          placeholder="状态"
          clearable
          style="width: 140px;"
          @change="() => { page = 1; loadData() }"
        >
          <el-option label="启用" value="true" />
          <el-option label="禁用" value="false" />
        </el-select>
        <el-input
          v-model="filterKeyword"
          placeholder="名称 / code"
          clearable
          style="width: 220px;"
          @keyup.enter="() => { page = 1; loadData() }"
        />
        <el-button type="primary" @click="() => { page = 1; loadData() }">搜索</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card" style="margin-top: 12px;">
      <el-table :data="list" v-loading="loading" border stripe>
        <el-table-column type="index" width="50" />
        <el-table-column label="分类" width="110">
          <template #default="{ row }">
            <el-tag :type="CATEGORY_TAG[row.category as ProfessionalServiceCategory]" size="small">
              {{ CATEGORY_LABEL[row.category as ProfessionalServiceCategory] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <strong>{{ row.name }}</strong>
            <div style="font-size: 12px; color: #999;">{{ row.code }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="shortDesc" label="一句话介绍" min-width="240" show-overflow-tooltip />
        <el-table-column label="亮点" width="80">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ (row.highlights || []).length }} 条</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SOP" width="80">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="info">
              {{ (row.sopSteps || []).length }} 步
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="定价" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.priceDisplayText || '—' }}</template>
        </el-table-column>
        <el-table-column label="来源" width="80">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.source === 'builtin' ? 'success' : 'warning'"
              effect="plain"
            >
              {{ row.source === 'builtin' ? '内置' : '自定义' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sortOrder" width="70" />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="warning" plain @click="handleToggle(row)">
              {{ row.enabled ? '禁用' : '启用' }}
            </el-button>
            <el-button
              v-if="row.source === 'custom'"
              size="small"
              type="danger"
              plain
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑服务' : '新增服务'"
      width="760px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="分类" required>
              <el-select v-model="form.category" style="width: 100%;">
                <el-option label="营养服务" value="nutrition" />
                <el-option label="康复指导" value="rehabilitation" />
                <el-option label="护理对接" value="nursing" />
                <el-option label="心理支持" value="psychology" />
                <el-option label="母婴育护" value="maternal_child" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="编码 (code)" required>
              <el-input v-model="form.code" placeholder="nutrition_diabetes" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="服务名称" required>
          <el-input v-model="form.name" placeholder="如：糖尿病饮食管理" />
        </el-form-item>
        <el-form-item label="一句话介绍" required>
          <el-input
            v-model="form.shortDesc"
            placeholder="30-60 字吸引用户点击"
            maxlength="180"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="详细介绍">
          <el-input
            v-model="form.detail"
            type="textarea"
            :rows="3"
            placeholder="用户端服务详情页展示"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="图标 (Material)">
              <el-input v-model="form.icon" placeholder="如：restaurant / medical_services" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="封面图 URL">
              <el-input v-model="form.coverImage" placeholder="可选" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="适用人群">
          <el-input
            v-model="form.targetGroupsText"
            placeholder="多个标签用英文/中文逗号分隔，如：糖尿病患者,老年人"
          />
        </el-form-item>
        <el-form-item label="卖点亮点">
          <el-input
            v-model="form.highlightsText"
            type="textarea"
            :rows="3"
            placeholder="每行一条"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="周期说明">
              <el-input v-model="form.durationHint" placeholder="如：单次上门 / 7天周期" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="展示价格文案">
              <el-input v-model="form.priceDisplayText" placeholder="如：¥299 起 / 次" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="排序（越小越前）">
              <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="启用">
              <el-switch v-model="form.enabled" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">SOP 步骤（服务人员执行流程）</el-divider>
        <div v-for="(step, sIdx) in form.sopSteps" :key="sIdx" class="sop-step">
          <div class="sop-step__header">
            <strong>步骤 {{ sIdx + 1 }}</strong>
            <el-button size="small" type="danger" link @click="removeSopStep(sIdx)">删除</el-button>
          </div>
          <el-input v-model="step.title" placeholder="步骤标题，如：首次评估" style="margin-bottom: 8px;" />
          <el-input
            v-model="step.description"
            type="textarea"
            :rows="2"
            placeholder="步骤要做什么（对内 SOP）"
            style="margin-bottom: 8px;"
          />
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px;">
            <el-input-number
              v-model="step.durationMin"
              :min="1"
              :max="720"
              placeholder="用时(分钟)"
            />
            <el-button size="small" @click="addChecklistItem(sIdx)">+ 检查项</el-button>
          </div>
          <div v-if="step.checklistItems && step.checklistItems.length > 0" class="sop-step__checklist">
            <div
              v-for="(_, cIdx) in step.checklistItems"
              :key="cIdx"
              class="sop-step__checklist-item"
            >
              <el-input
                v-model="step.checklistItems![cIdx]"
                placeholder="检查项说明"
                size="small"
                style="flex: 1;"
              />
              <el-button size="small" type="danger" link @click="removeChecklistItem(sIdx, cIdx)">
                移除
              </el-button>
            </div>
          </div>
        </div>
        <el-button type="primary" plain @click="addSopStep">+ 添加 SOP 步骤</el-button>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.sop-step {
  padding: 16px;
  border: 1px solid #E7EAF1;
  border-radius: 8px;
  margin-bottom: 12px;
  background: #FAFBFC;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  &__checklist {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    background: #fff;
    border-radius: 6px;

    &-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}
</style>
