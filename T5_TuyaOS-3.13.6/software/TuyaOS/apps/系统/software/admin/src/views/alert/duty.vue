<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  acknowledgeAlert,
  assignAlert,
  closeAlert,
  listAlerts,
  listAssignableStaff,
} from '@/api/alert'

interface DutyAlert {
  id: number
  title: string
  summary: string | null
  severity: 'low' | 'medium' | 'high'
  status: 'new' | 'acknowledged' | 'closed' | 'ignored'
  category: string
  ruleName: string | null
  triggeredAt: string
  assigneeId: number | null
  serviceTarget?: { id: number; name?: string } | null
}

interface Staff {
  id: number
  realName?: string
  username?: string
  name?: string
}

const statusTab = ref<'new' | 'acknowledged'>('new')
const severity = ref<'' | 'low' | 'medium' | 'high'>('')
const autoRefresh = ref(true)
const loading = ref(false)
const list = ref<DutyAlert[]>([])
const staff = ref<Staff[]>([])
let timer: ReturnType<typeof setInterval> | null = null

const assignVisible = ref(false)
const assignForm = reactive<{ id: number | null; assigneeId: number | null }>({
  id: null,
  assigneeId: null,
})

const SEVERITY: Record<DutyAlert['severity'], { text: string; type: 'danger' | 'warning' | 'info' }> = {
  high: { text: '高', type: 'danger' },
  medium: { text: '中', type: 'warning' },
  low: { text: '低', type: 'info' },
}
const CATEGORY_LABEL: Record<string, string> = {
  medication_miss: '漏服',
  follow_up_overdue: '复诊逾期',
  timeline_keyword: '关键词',
  service_exception: '服务异常',
  manual: '人工',
}

const openCount = computed(() => list.value.length)
const highCount = computed(() => list.value.filter((a) => a.severity === 'high').length)

async function load() {
  loading.value = true
  try {
    const res: any = await listAlerts({
      status: statusTab.value,
      severity: severity.value || undefined,
      page: 1,
      pageSize: 100,
    })
    const items: DutyAlert[] = Array.isArray(res) ? res : (res?.items ?? [])
    // 高优先在前，其次时间倒序
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 }
    list.value = items.sort((a, b) => {
      const r = (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0)
      if (r !== 0) return r
      return (b.triggeredAt || '').localeCompare(a.triggeredAt || '')
    })
  } finally {
    loading.value = false
  }
}

async function handleAck(row: DutyAlert) {
  try {
    const { value } = await ElMessageBox.prompt('确认知悉该告警？可填写备注', '确认告警', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPlaceholder: '备注（可选）',
    })
    await acknowledgeAlert(row.id, value || undefined)
    ElMessage.success('已确认')
    load()
  } catch {
    /* 取消 */
  }
}

async function handleClose(row: DutyAlert) {
  try {
    const { value } = await ElMessageBox.prompt('确认该告警已处置完成？', '处置完成', {
      confirmButtonText: '处置完成',
      cancelButtonText: '取消',
      inputPlaceholder: '处置说明（可选）',
    })
    await closeAlert(row.id, value || undefined)
    ElMessage.success('已处置')
    load()
  } catch {
    /* 取消 */
  }
}

function openAssign(row: DutyAlert) {
  assignForm.id = row.id
  assignForm.assigneeId = row.assigneeId ?? null
  assignVisible.value = true
}

async function submitAssign() {
  if (!assignForm.id || !assignForm.assigneeId) {
    ElMessage.warning('请选择处理人')
    return
  }
  await assignAlert(assignForm.id, { assigneeId: assignForm.assigneeId })
  ElMessage.success('已指派')
  assignVisible.value = false
  load()
}

function staffName(s: Staff) {
  return s.realName || s.name || s.username || `#${s.id}`
}

function setupTimer() {
  if (timer) clearInterval(timer)
  if (autoRefresh.value) timer = setInterval(load, 30_000)
}

onMounted(async () => {
  try {
    staff.value = (await listAssignableStaff()) as Staff[]
  } catch {
    staff.value = []
  }
  load()
  setupTimer()
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="duty">
    <div class="page-head">
      <div>
        <h2>告警值班台</h2>
        <span>实时待处置告警 · 确认 / 处置 / 指派</span>
      </div>
      <div class="head-stat">
        <el-statistic title="待处置" :value="openCount" />
        <el-statistic title="高危" :value="highCount" value-style="color:#f5222d" />
      </div>
    </div>

    <div class="toolbar">
      <el-radio-group v-model="statusTab" @change="load">
        <el-radio-button value="new">待确认</el-radio-button>
        <el-radio-button value="acknowledged">处理中</el-radio-button>
      </el-radio-group>
      <el-select v-model="severity" placeholder="全部严重度" clearable style="width: 150px" @change="load">
        <el-option label="高" value="high" />
        <el-option label="中" value="medium" />
        <el-option label="低" value="low" />
      </el-select>
      <el-switch v-model="autoRefresh" active-text="自动刷新" @change="setupTimer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <div v-loading="loading" class="alert-grid">
      <el-empty v-if="!loading && !list.length" description="当前无待处置告警" />
      <div
        v-for="a in list"
        :key="a.id"
        class="alert-card"
        :class="`sev-${a.severity}`"
      >
        <div class="alert-card__top">
          <el-tag :type="SEVERITY[a.severity].type" size="small" effect="dark">
            {{ SEVERITY[a.severity].text }}危
          </el-tag>
          <span class="cat">{{ CATEGORY_LABEL[a.category] || a.category }}</span>
          <span class="time">{{ a.triggeredAt }}</span>
        </div>
        <div class="alert-card__title">{{ a.title }}</div>
        <div class="alert-card__summary">{{ a.summary || '—' }}</div>
        <div class="alert-card__meta">
          <span>对象：{{ a.serviceTarget?.name || `#${a.serviceTarget?.id ?? '—'}` }}</span>
          <span v-if="a.assigneeId">已指派 #{{ a.assigneeId }}</span>
        </div>
        <div class="alert-card__actions">
          <el-button v-if="a.status === 'new'" size="small" type="primary" @click="handleAck(a)">
            确认
          </el-button>
          <el-button size="small" @click="openAssign(a)">指派</el-button>
          <el-button size="small" type="success" plain @click="handleClose(a)">处置完成</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="assignVisible" title="指派处理人" width="380px">
      <el-select v-model="assignForm.assigneeId" placeholder="选择处理人" style="width: 100%">
        <el-option
          v-for="s in staff"
          :key="s.id"
          :label="staffName(s)"
          :value="s.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">确认指派</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.duty {
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
.head-stat {
  display: flex;
  gap: 32px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.alert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  min-height: 120px;
}
.alert-card {
  background: #fff;
  border: 1px solid #eef2f7;
  border-left: 4px solid #cbd5e1;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.alert-card.sev-high {
  border-left-color: #f5222d;
  background: #fff7f7;
}
.alert-card.sev-medium {
  border-left-color: #faad14;
}
.alert-card.sev-low {
  border-left-color: #909399;
}
.alert-card__top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.alert-card__top .cat {
  font-size: 12px;
  color: #64748b;
}
.alert-card__top .time {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
}
.alert-card__title {
  font-weight: 700;
  color: #1e293b;
}
.alert-card__summary {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
}
.alert-card__meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #94a3b8;
}
.alert-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
</style>
