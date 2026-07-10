<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listAlertRules, updateAlertRule } from '@/api/alert'

interface AlertRule {
  id: number
  ruleCode: string
  name: string
  category: string
  severity: 'high' | 'medium' | 'low'
  enabled: boolean
  condition: Record<string, any> | null
  description?: string
  cooldownMinutes: number
  notifyFamily: boolean
  notifyAdmin: boolean
}

const rules = ref<AlertRule[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const editing = ref<AlertRule | null>(null)
const conditionText = ref('')

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    medication_miss: '漏服预警',
    follow_up_overdue: '复诊逾期',
    timeline_keyword: '服务高危信号',
    service_exception: '服务异常',
    manual: '人工预警',
  }
  return map[c] || c
}

function severityLabel(s: string) {
  return { high: '紧急', medium: '重要', low: '提醒' }[s as 'high' | 'medium' | 'low'] || s
}

function severityType(s: string): any {
  return { high: 'danger', medium: 'warning', low: 'success' }[s as 'high' | 'medium' | 'low'] || ''
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await listAlertRules()
    rules.value = Array.isArray(res) ? res : res?.items || []
  } catch {
    rules.value = []
  } finally {
    loading.value = false
  }
}

async function toggleEnabled(row: AlertRule) {
  try {
    await updateAlertRule(row.id, { enabled: !row.enabled })
    ElMessage.success(`已${row.enabled ? '停用' : '启用'}`)
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

function openEdit(row: AlertRule) {
  editing.value = { ...row }
  conditionText.value = row.condition ? JSON.stringify(row.condition, null, 2) : '{}'
  dialogVisible.value = true
}

async function saveEdit() {
  if (!editing.value) return
  let parsedCondition: Record<string, any> | null = null
  try {
    parsedCondition = conditionText.value.trim() ? JSON.parse(conditionText.value) : null
  } catch {
    ElMessage.error('条件 JSON 格式错误')
    return
  }
  try {
    await updateAlertRule(editing.value.id, {
      severity: editing.value.severity,
      cooldownMinutes: editing.value.cooldownMinutes,
      notifyFamily: editing.value.notifyFamily,
      notifyAdmin: editing.value.notifyAdmin,
      description: editing.value.description,
      condition: parsedCondition,
    })
    ElMessage.success('已保存')
    dialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

function renderCondition(row: AlertRule) {
  if (!row.condition) return '—'
  const c = row.condition as Record<string, any>
  if (row.ruleCode === 'medication_miss_rate_low') {
    return `近 ${c.windowDays || 7} 天执行率 < ${((c.minAdherenceRate || 0.7) * 100).toFixed(0)}%，应执行至少 ${c.minScheduledCount || 3} 次`
  }
  if (row.ruleCode === 'follow_up_overdue') {
    return `宽限 ${c.graceDays || 1} 天起，最大追溯 ${c.maxOverdueDays || 14} 天`
  }
  if (row.ruleCode === 'timeline_keyword_high_risk') {
    const keywords = Array.isArray(c.keywords) ? c.keywords : []
    const head = keywords.slice(0, 5).join('、')
    return `关键词：${head}${keywords.length > 5 ? ` 等 ${keywords.length} 个` : ''}`
  }
  return JSON.stringify(c)
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">预警规则配置</h2>
        <p class="page-subtitle">
          调整内置规则的阈值、严重度、通知偏好与冷却时间；更改实时生效。
        </p>
      </div>
      <div class="page-header__actions">
        <el-button @click="$router.push('/alert-center/alerts')">
          <el-icon><Back /></el-icon>返回预警列表
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="rules" v-loading="loading" border>
        <el-table-column label="规则" min-width="240">
          <template #default="{ row }">
            <div style="font-weight: 600;">{{ row.name }}</div>
            <div style="color: #999; font-size: 12px;">{{ row.ruleCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="140">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column label="严重度" width="100">
          <template #default="{ row }">
            <el-tag :type="severityType(row.severity)" size="small">
              {{ severityLabel(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="触发条件" min-width="280">
          <template #default="{ row }">{{ renderCondition(row) }}</template>
        </el-table-column>
        <el-table-column label="冷却（分钟）" width="120" align="center">
          <template #default="{ row }">{{ row.cooldownMinutes }}</template>
        </el-table-column>
        <el-table-column label="通知家属" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.notifyFamily" type="success" size="small">是</el-tag>
            <el-tag v-else type="info" size="small">否</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="通知后台" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.notifyAdmin" type="success" size="small">是</el-tag>
            <el-tag v-else type="info" size="small">否</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="toggleEnabled(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑规则" width="640px">
      <el-form v-if="editing" :model="editing" label-width="120px">
        <el-form-item label="规则名">
          <el-input :model-value="editing.name" disabled />
        </el-form-item>
        <el-form-item label="严重度">
          <el-select v-model="editing.severity" style="width: 100%;">
            <el-option label="紧急（high）" value="high" />
            <el-option label="重要（medium）" value="medium" />
            <el-option label="提醒（low）" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="冷却时间">
          <el-input-number
            v-model="editing.cooldownMinutes"
            :min="0"
            :max="10080"
            style="width: 100%;"
          />
          <div style="color: #999; font-size: 12px;">
            同一对象 + 规则，冷却期内不会重复触发。默认 1440 分钟 = 24 小时。
          </div>
        </el-form-item>
        <el-form-item label="通知家属">
          <el-switch v-model="editing.notifyFamily" />
        </el-form-item>
        <el-form-item label="通知后台">
          <el-switch v-model="editing.notifyAdmin" />
        </el-form-item>
        <el-form-item label="触发条件（JSON）">
          <el-input
            v-model="conditionText"
            type="textarea"
            :rows="8"
            placeholder='如：{"minAdherenceRate":0.7,"windowDays":7}'
            style="font-family: ui-monospace, Menlo, Consolas, monospace;"
          />
          <div style="color: #999; font-size: 12px;">
            支持字段：漏服规则 windowDays/minAdherenceRate/minScheduledCount；
            复诊逾期 graceDays/maxOverdueDays；关键词规则 keywords[]。
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editing.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
