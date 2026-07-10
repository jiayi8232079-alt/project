<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCrisisWord,
  listCrisisWords,
  removeCrisisWord,
  toggleCrisisWord,
  updateCrisisWord,
  type CrisisAction,
  type CrisisSeverity,
  type CrisisWord,
} from '@/api/ai-config'

const loading = ref(false)
const list = ref<CrisisWord[]>([])
const filters = reactive<{ keyword: string; severity: CrisisSeverity | '' }>({
  keyword: '',
  severity: '',
})

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<{
  word: string
  category: string
  severity: CrisisSeverity
  action: CrisisAction
  enabled: boolean
  remark: string
}>({
  word: '',
  category: '',
  severity: 'high',
  action: 'create_alert',
  enabled: true,
  remark: '',
})

const SEVERITY: Record<CrisisSeverity, { text: string; type: 'danger' | 'warning' | 'info' }> = {
  high: { text: '高', type: 'danger' },
  medium: { text: '中', type: 'warning' },
  low: { text: '低', type: 'info' },
}
const ACTION_LABEL: Record<CrisisAction, string> = {
  notify_family: '通知家属',
  create_alert: '生成预警',
  escalate: '升级值班',
}

async function load() {
  loading.value = true
  try {
    list.value = await listCrisisWords({
      keyword: filters.keyword || undefined,
      severity: filters.severity || undefined,
    })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    word: '',
    category: '',
    severity: 'high',
    action: 'create_alert',
    enabled: true,
    remark: '',
  })
  dialogVisible.value = true
}

function openEdit(row: CrisisWord) {
  editingId.value = row.id
  Object.assign(form, {
    word: row.word,
    category: row.category ?? '',
    severity: row.severity,
    action: row.action,
    enabled: row.enabled,
    remark: row.remark ?? '',
  })
  dialogVisible.value = true
}

async function submit() {
  if (!form.word.trim()) {
    ElMessage.warning('请填写危机词')
    return
  }
  const payload = {
    word: form.word.trim(),
    category: form.category || undefined,
    severity: form.severity,
    action: form.action,
    enabled: form.enabled,
    remark: form.remark || undefined,
  }
  if (editingId.value) {
    await updateCrisisWord(editingId.value, payload)
    ElMessage.success('已更新')
  } else {
    await createCrisisWord(payload)
    ElMessage.success('已新增')
  }
  dialogVisible.value = false
  load()
}

async function handleToggle(row: CrisisWord) {
  await toggleCrisisWord(row.id)
  load()
}

async function handleDelete(row: CrisisWord) {
  try {
    await ElMessageBox.confirm(`确认删除危机词「${row.word}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  await removeCrisisWord(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<template>
  <div class="crisis">
    <div class="page-head">
      <div>
        <h2>危机词库</h2>
        <span>AI 对话实时匹配命中后，按严重度与动作触发处置（家属 / 预警 / 升级值班）</span>
      </div>
      <el-button type="primary" @click="openCreate">新增危机词</el-button>
    </div>

    <div class="toolbar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索危机词"
        clearable
        style="width: 220px"
        @keyup.enter="load"
        @clear="load"
      />
      <el-select v-model="filters.severity" placeholder="严重度" clearable style="width: 140px" @change="load">
        <el-option label="高" value="high" />
        <el-option label="中" value="medium" />
        <el-option label="低" value="low" />
      </el-select>
      <el-button @click="load">查询</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="word" label="危机词" min-width="160" />
      <el-table-column prop="category" label="分类" width="120">
        <template #default="{ row }">{{ row.category || '—' }}</template>
      </el-table-column>
      <el-table-column label="严重度" width="100">
        <template #default="{ row }">
          <el-tag :type="SEVERITY[row.severity as CrisisSeverity].type" size="small">
            {{ SEVERITY[row.severity as CrisisSeverity].text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处置动作" width="130">
        <template #default="{ row }">{{ ACTION_LABEL[row.action as CrisisAction] }}</template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="handleToggle(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && !list.length" description="暂无危机词，点击右上角新增" />

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑危机词' : '新增危机词'"
      width="480px"
    >
      <el-form label-width="84px">
        <el-form-item label="危机词" required>
          <el-input v-model="form.word" maxlength="64" placeholder="如：胸痛 / 不想活了 / 喘不上气" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.category" maxlength="32" placeholder="自杀 / 急病 / 暴力 / 走失" />
        </el-form-item>
        <el-form-item label="严重度">
          <el-radio-group v-model="form.severity">
            <el-radio-button value="high">高</el-radio-button>
            <el-radio-button value="medium">中</el-radio-button>
            <el-radio-button value="low">低</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处置">
          <el-select v-model="form.action" style="width: 100%">
            <el-option label="通知家属" value="notify_family" />
            <el-option label="生成预警" value="create_alert" />
            <el-option label="升级值班" value="escalate" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" maxlength="128" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.crisis {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.page-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
  color: #1e293b;
}
.page-head span {
  font-size: 13px;
  color: #94a3b8;
}
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
