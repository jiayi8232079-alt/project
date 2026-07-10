<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listAlerts,
  acknowledgeAlert,
  closeAlert,
  scanMedicationMiss,
  scanFollowUpOverdue,
  assignAlert,
  listAlertLogs,
  appendAlertLog,
  listAssignableStaff,
} from '@/api/alert'

interface Alert {
  id: number
  userId: number
  serviceTargetId?: number
  orderId?: number
  category: string
  ruleCode: string
  ruleName?: string
  severity: 'high' | 'medium' | 'low'
  title: string
  summary?: string
  payload?: Record<string, unknown>
  status: 'new' | 'acknowledged' | 'closed' | 'ignored'
  triggeredAt: string
  acknowledgedAt?: string
  acknowledgedChannel?: 'family' | 'admin'
  acknowledgedNote?: string
  closedAt?: string
  assigneeId?: number | null
  assignedAt?: string | null
  assignee?: { id: number; username: string; realName?: string; role?: string } | null
  user?: { id: number; nickname?: string; phone?: string }
  serviceTarget?: { id: number; name: string }
  order?: { id: number; orderNumber: string }
}

interface StaffOption {
  id: number
  username: string
  realName?: string
  role?: string
  displayName: string
}

interface AlertLog {
  id: number
  actorType: 'admin' | 'user' | 'system'
  actorId?: number | null
  actorName?: string | null
  action: 'create' | 'assign' | 'comment' | 'acknowledge' | 'close' | 'reopen' | 'notify'
  note?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
}

const loading = ref(false)
const list = ref<Alert[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filterStatus = ref<string>('new')
const filterSeverity = ref<string>('')
const filterCategory = ref<string>('')

const detailVisible = ref(false)
const detail = ref<Alert | null>(null)
const processNote = ref('')

const staffList = ref<StaffOption[]>([])
const assigneeId = ref<number | null>(null)
const assignNote = ref('')
const logList = ref<AlertLog[]>([])
const logLoading = ref(false)
const newLogNote = ref('')

const CATEGORY_OPTIONS = [
  { label: '漏服预警', value: 'medication_miss' },
  { label: '复诊逾期', value: 'follow_up_overdue' },
  { label: '服务高危信号', value: 'timeline_keyword' },
  { label: '服务异常', value: 'service_exception' },
  { label: '人工预警', value: 'manual' },
] as const

function categoryLabel(c: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === c)?.label || c
}

function severityLabel(s: string) {
  return { high: '紧急', medium: '重要', low: '提醒' }[s as 'high' | 'medium' | 'low'] || '—'
}

function severityType(s: string): any {
  return { high: 'danger', medium: 'warning', low: 'success' }[s as 'high' | 'medium' | 'low'] || ''
}

function statusLabel(s: string) {
  return {
    new: '未处理',
    acknowledged: '已知悉',
    closed: '已关闭',
    ignored: '已忽略',
  }[s as 'new' | 'acknowledged' | 'closed' | 'ignored'] || s
}

function statusType(s: string): any {
  return {
    new: 'danger',
    acknowledged: 'warning',
    closed: 'info',
    ignored: 'info',
  }[s as 'new' | 'acknowledged' | 'closed' | 'ignored'] || ''
}

function triggeredAtDisplay(row: Alert) {
  if (!row.triggeredAt) return ''
  const d = new Date(row.triggeredAt)
  if (Number.isNaN(d.getTime())) return row.triggeredAt
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterSeverity.value) params.severity = filterSeverity.value
    if (filterCategory.value) params.category = filterCategory.value
    const res: any = await listAlerts(params)
    list.value = (res.items || []) as Alert[]
    total.value = res.total || 0
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filterStatus.value = 'new'
  filterSeverity.value = ''
  filterCategory.value = ''
  page.value = 1
  loadData()
}

const ROLE_LABEL: Record<string, string> = {
  admin: '超级管理员',
  operator: '运营',
  customer_service: '客服',
  medical_consultant: '医学顾问',
  attendant: '陪诊员',
  finance: '财务',
  user: '家属',
}

function staffLabel(s: StaffOption) {
  const roleTag = ROLE_LABEL[s.role || ''] || s.role || ''
  return roleTag ? `${s.displayName} · ${roleTag}` : s.displayName
}

const ACTION_META: Record<string, { label: string; color: string; icon?: string }> = {
  create: { label: '告警触发', color: '#f56c6c' },
  assign: { label: '指派', color: '#409eff' },
  comment: { label: '跟进', color: '#606266' },
  acknowledge: { label: '已知悉', color: '#e6a23c' },
  close: { label: '关闭', color: '#67c23a' },
  reopen: { label: '重新打开', color: '#909399' },
  notify: { label: '推送通知', color: '#8e44ad' },
}

function actionMeta(a: string) {
  return ACTION_META[a] || { label: a, color: '#909399' }
}

function actorDisplay(log: AlertLog) {
  if (log.actorType === 'system') return '系统'
  if (log.actorType === 'admin') return log.actorName ? `管理员 · ${log.actorName}` : '管理员'
  return log.actorName ? `家属 · ${log.actorName}` : '家属'
}

function formatLogTime(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function ensureStaffList() {
  if (staffList.value.length > 0) return
  try {
    const res: any = await listAssignableStaff()
    staffList.value = Array.isArray(res) ? res : []
  } catch {
    staffList.value = []
  }
}

async function refreshLogs(id: number) {
  logLoading.value = true
  try {
    const res: any = await listAlertLogs(id)
    logList.value = (Array.isArray(res) ? res : []) as AlertLog[]
  } catch {
    logList.value = []
  } finally {
    logLoading.value = false
  }
}

async function openDetail(row: Alert) {
  detail.value = row
  processNote.value = row.acknowledgedNote || ''
  assigneeId.value = row.assigneeId ?? null
  assignNote.value = ''
  newLogNote.value = ''
  detailVisible.value = true
  await Promise.all([ensureStaffList(), refreshLogs(row.id)])
}

async function handleAssign() {
  const current = detail.value
  if (!current) return
  if (!assigneeId.value) {
    ElMessage.warning('请选择要指派的处理人')
    return
  }
  try {
    const updated: any = await assignAlert(current.id, {
      assigneeId: assigneeId.value,
      note: assignNote.value || undefined,
    })
    detail.value = { ...current, ...(updated || {}) }
    assignNote.value = ''
    ElMessage.success('已指派')
    await refreshLogs(current.id)
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '指派失败')
  }
}

async function handleAppendLog() {
  if (!detail.value) return
  const note = newLogNote.value.trim()
  if (!note) {
    ElMessage.warning('请输入跟进内容')
    return
  }
  try {
    await appendAlertLog(detail.value.id, note)
    newLogNote.value = ''
    ElMessage.success('已记录跟进')
    await refreshLogs(detail.value.id)
  } catch (e: any) {
    ElMessage.error(e?.message || '追加失败')
  }
}

async function handleAcknowledge(row: Alert) {
  const target = row || detail.value
  if (!target) return
  try {
    await acknowledgeAlert(target.id, processNote.value || undefined)
    ElMessage.success('已标记为已知悉')
    if (detail.value?.id === target.id) {
      await refreshLogs(target.id)
    } else {
      detailVisible.value = false
    }
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleClose(row?: Alert) {
  const target = row || detail.value
  if (!target) return
  try {
    await ElMessageBox.confirm(
      '确认已完成对该预警的处置？关闭后将不再出现在未处理列表。',
      '关闭预警',
      { type: 'warning' },
    )
    await closeAlert(target.id, processNote.value || undefined)
    ElMessage.success('已关闭')
    if (detail.value?.id === target.id) {
      await refreshLogs(target.id)
    } else {
      detailVisible.value = false
    }
    await loadData()
  } catch (e: any) {
    if (e === 'cancel') return
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleScan() {
  try {
    await Promise.all([scanMedicationMiss(), scanFollowUpOverdue()])
    ElMessage.success('扫描完成，若有新预警将出现在列表')
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '扫描失败')
  }
}

const payloadEntries = computed(() => {
  const p = detail.value?.payload
  if (!p || typeof p !== 'object') return []
  const LABEL: Record<string, string> = {
    total: '应执行次数',
    taken: '已执行次数',
    missed: '漏服次数',
    adherenceRate: '执行率',
    windowDays: '统计窗口（天）',
    minAdherenceRate: '阈值',
    overdueDays: '逾期天数',
    originalDate: '原定日期',
    hospital: '医院',
    department: '科室',
    hits: '命中关键词',
    snippet: '相关片段',
    entryType: '条目类型',
  }
  return Object.entries(p).map(([k, v]) => ({
    key: k,
    label: LABEL[k] || k,
    value: (() => {
      if (v === null || v === undefined) return ''
      if (typeof v === 'number' && v > 0 && v < 1) return `${(v * 100).toFixed(0)}%`
      if (Array.isArray(v)) return v.join('、')
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    })(),
  }))
})

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">健康预警中心</h2>
        <p class="page-subtitle">
          规则引擎自动识别漏服、复诊逾期、陪诊过程中的高危信号；工单实时同步家属端。
        </p>
      </div>
      <div class="page-header__actions">
        <el-button @click="handleScan"><el-icon><Refresh /></el-icon>立即扫描</el-button>
      </div>
    </div>

    <el-card shadow="never" class="filter-bar">
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <el-select
          v-model="filterStatus"
          placeholder="状态"
          clearable
          style="width: 140px;"
          @change="() => { page = 1; loadData() }"
        >
          <el-option label="未处理" value="new" />
          <el-option label="已知悉" value="acknowledged" />
          <el-option label="已关闭" value="closed" />
        </el-select>
        <el-select
          v-model="filterSeverity"
          placeholder="严重度"
          clearable
          style="width: 140px;"
          @change="() => { page = 1; loadData() }"
        >
          <el-option label="紧急" value="high" />
          <el-option label="重要" value="medium" />
          <el-option label="提醒" value="low" />
        </el-select>
        <el-select
          v-model="filterCategory"
          placeholder="类别"
          clearable
          style="width: 180px;"
          @change="() => { page = 1; loadData() }"
        >
          <el-option
            v-for="o in CATEGORY_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-button @click="resetFilters">重置</el-button>
        <el-button
          type="primary"
          style="margin-left: auto;"
          @click="$router.push('/alert-center/rules')"
        >
          <el-icon><Setting /></el-icon>规则配置
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="list" v-loading="loading" highlight-current-row>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="严重度" width="90">
          <template #default="{ row }">
            <el-tag :type="severityType(row.severity)" size="small">
              {{ severityLabel(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="130">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column label="对象" min-width="150">
          <template #default="{ row }">
            <div>{{ row.serviceTarget?.name || row.user?.nickname || '—' }}</div>
            <div style="font-size: 12px; color: #999;">
              {{ row.user?.phone ? `家属: ${row.user.phone}` : '' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="预警标题" min-width="260" show-overflow-tooltip />
        <el-table-column label="关联订单" width="140">
          <template #default="{ row }">
            <el-link
              v-if="row.order"
              type="primary"
              @click="$router.push(`/service/orders/detail/${row.order.id}`)"
            >{{ row.order.orderNumber }}</el-link>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="触发时间" width="170">
          <template #default="{ row }">{{ triggeredAtDisplay(row) }}</template>
        </el-table-column>
        <el-table-column label="处理人" width="140">
          <template #default="{ row }">
            <span v-if="row.assignee">
              {{ row.assignee.realName || row.assignee.username }}
              <span style="color: #999;" v-if="row.assignee.role">
                ({{ ROLE_LABEL[row.assignee.role] || row.assignee.role }})
              </span>
            </span>
            <el-tag v-else size="small" type="info">未指派</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetail(row)">
              查看
            </el-button>
            <el-button
              v-if="row.status === 'new'"
              type="warning"
              link
              size="small"
              @click="handleAcknowledge(row)"
            >
              标记已知悉
            </el-button>
            <el-button
              v-if="row.status !== 'closed'"
              type="danger"
              link
              size="small"
              @click="handleClose(row)"
            >
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px; text-align: right;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" :title="'预警详情'" width="780px">
      <div v-if="detail" class="alert-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="严重度">
            <el-tag :type="severityType(detail.severity)" size="small">
              {{ severityLabel(detail.severity) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="类别">
            {{ categoryLabel(detail.category) }}
          </el-descriptions-item>
          <el-descriptions-item label="对象">
            {{ detail.serviceTarget?.name || detail.user?.nickname || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="家属">
            {{ detail.user?.nickname || '' }}
            <span v-if="detail.user?.phone" style="color: #999;">
              ({{ detail.user?.phone }})
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="关联订单">
            <el-link
              v-if="detail.order"
              type="primary"
              @click="$router.push(`/service/orders/detail/${detail.order.id}`)"
            >{{ detail.order.orderNumber }}</el-link>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="触发时间">
            {{ triggeredAtDisplay(detail) }}
          </el-descriptions-item>
          <el-descriptions-item label="规则" :span="2">
            <span>{{ detail.ruleName }}</span>
            <span style="color: #999; margin-left: 8px;">({{ detail.ruleCode }})</span>
          </el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">
            <div style="font-weight: 600;">{{ detail.title }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="说明" :span="2">
            {{ detail.summary }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="payloadEntries.length > 0" style="margin-top: 18px;">
          <div class="block-title">关键数据</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item
              v-for="entry in payloadEntries"
              :key="entry.key"
              :label="entry.label"
            >{{ entry.value }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="assign-block">
          <div class="block-title">指派处理人</div>
          <div class="assign-row">
            <el-select
              v-model="assigneeId"
              placeholder="选择客服 / 运营 / 医学顾问"
              filterable
              clearable
              style="width: 260px;"
            >
              <el-option
                v-for="s in staffList"
                :key="s.id"
                :value="s.id"
                :label="staffLabel(s)"
              />
            </el-select>
            <el-input
              v-model="assignNote"
              placeholder="指派备注（可选）"
              style="flex: 1;"
            />
            <el-button type="primary" @click="handleAssign">
              {{ detail.assigneeId ? '重新指派' : '指派' }}
            </el-button>
          </div>
          <div v-if="detail.assignee" class="assign-current">
            当前处理人：
            <span style="font-weight: 600;">
              {{ detail.assignee.realName || detail.assignee.username }}
            </span>
            <span v-if="detail.assignee.role" style="color: #999; margin-left: 6px;">
              ({{ ROLE_LABEL[detail.assignee.role] || detail.assignee.role }})
            </span>
            <span v-if="detail.assignedAt" style="color: #999; margin-left: 12px;">
              {{ formatLogTime(detail.assignedAt) }}
            </span>
          </div>
          <div v-else class="assign-current" style="color: #909399;">
            暂未指派
          </div>
        </div>

        <div class="log-block">
          <div class="block-title">
            处理时间线
            <span class="log-count">（共 {{ logList.length }} 条）</span>
          </div>
          <div v-loading="logLoading" class="log-timeline">
            <el-empty
              v-if="!logLoading && logList.length === 0"
              description="暂无日志"
              :image-size="80"
            />
            <el-timeline v-else>
              <el-timeline-item
                v-for="log in logList"
                :key="log.id"
                :color="actionMeta(log.action).color"
                :timestamp="formatLogTime(log.createdAt)"
              >
                <div class="log-header">
                  <el-tag
                    size="small"
                    :color="actionMeta(log.action).color"
                    effect="dark"
                    style="border: none;"
                  >{{ actionMeta(log.action).label }}</el-tag>
                  <span class="log-actor">{{ actorDisplay(log) }}</span>
                </div>
                <div v-if="log.note" class="log-note">{{ log.note }}</div>
                <div
                  v-if="log.action === 'assign' && log.payload"
                  class="log-extra"
                >
                  指派给：{{ (log.payload as any).assigneeName }}
                  <span v-if="(log.payload as any).assigneeRole" style="color: #999;">
                    ({{ ROLE_LABEL[(log.payload as any).assigneeRole] || (log.payload as any).assigneeRole }})
                  </span>
                </div>
                <div
                  v-else-if="log.action === 'notify' && log.payload"
                  class="log-extra"
                >
                  已推送至 {{ (log.payload as any).recipients }} 位家属
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
          <div class="log-input">
            <el-input
              v-model="newLogNote"
              type="textarea"
              :rows="2"
              placeholder="追加跟进备注（已联系家属 / 电话回访结果 / 下一步计划…）"
              maxlength="2000"
              show-word-limit
            />
            <el-button type="primary" @click="handleAppendLog">追加跟进</el-button>
          </div>
        </div>

        <div class="process-note">
          <div class="block-title">处置备注（关闭时写入）</div>
          <el-input
            v-model="processNote"
            type="textarea"
            :rows="3"
            placeholder="记录最终处置结果，作为关闭依据（会保存到预警主记录）"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭窗口</el-button>
        <el-button
          v-if="detail && detail.status === 'new'"
          type="warning"
          @click="handleAcknowledge(detail as any)"
        >标记已知悉</el-button>
        <el-button
          v-if="detail && detail.status !== 'closed'"
          type="primary"
          @click="handleClose(detail as any)"
        >关闭预警</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.alert-detail {
  color: #303133;
}

.block-title {
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-count {
  font-weight: 400;
  font-size: 12px;
  color: #909399;
}

.assign-block {
  margin-top: 22px;
  padding: 14px 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafbfc;
}

.assign-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.assign-current {
  margin-top: 10px;
  font-size: 13px;
  color: #606266;
}

.log-block {
  margin-top: 22px;
}

.log-timeline {
  max-height: 360px;
  overflow-y: auto;
  padding: 8px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafbfc;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}

.log-actor {
  color: #909399;
}

.log-note {
  font-size: 13px;
  color: #303133;
  white-space: pre-wrap;
  line-height: 1.6;
}

.log-extra {
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
}

.log-input {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.process-note {
  margin-top: 22px;
}
</style>
