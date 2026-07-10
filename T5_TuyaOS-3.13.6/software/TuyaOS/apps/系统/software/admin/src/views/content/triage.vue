<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TagProps } from 'element-plus'
import {
  getTriageList,
  getTriageDetail,
  getTriageStats,
  getTriageSessionMessages,
  postTriageSessionMessage,
  deleteTriageSession,
} from '@/api/triage'

type TagType = NonNullable<TagProps['type']>

const loading = ref(false)
const stats = ref({ total: 0, escalated: 0, converted: 0, todayCount: 0, conversionRate: '0%', riskDistribution: [] as any[] })

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

// 筛选
const filterRisk = ref('')
const filterStatus = ref('')
const filterEscalate = ref('')

// 详情弹窗
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)

/** 转人工留言 */
const chatMessages = ref<any[]>([])
const chatInput = ref('')
const chatSending = ref(false)
const chatScrollRef = ref<HTMLElement | null>(null)

let detailPollTimer: ReturnType<typeof setInterval> | null = null
let listPollTimer: ReturnType<typeof setInterval> | null = null
/** 详情内已见过的最大留言 id，用于判断用户新发留言并提示音 */
let lastSeenChatMessageId = 0
/** 列表页已见过的最大导诊 session id（新且转人工则提示） */
let listMaxSessionId = 0
let listPollPrimed = false

function playNotifyBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.07
    o.start()
    setTimeout(() => {
      o.stop()
      void ctx.close()
    }, 130)
  } catch {
    /* WebAudio 在部分环境下需用户交互后可用 */
  }
}

function stopDetailChatPoll() {
  if (detailPollTimer) clearInterval(detailPollTimer)
  detailPollTimer = null
}

function stopListPoll() {
  if (listPollTimer) clearInterval(listPollTimer)
  listPollTimer = null
}

async function scrollChatToBottom() {
  await nextTick()
  const el = chatScrollRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function loadChatMessages(isInitial = false) {
  const sid = detail.value?.id
  if (sid == null || !detail.value?.escalateToHuman) return
  try {
    const res: any = await getTriageSessionMessages(sid)
    const items: any[] = res.items || []
    const maxId = items.length ? Math.max(...items.map((m) => m.id)) : 0
    if (!isInitial && lastSeenChatMessageId > 0 && maxId > lastSeenChatMessageId) {
      const newcomers = items.filter((m) => m.id > lastSeenChatMessageId && m.sender === 'user')
      if (newcomers.length) playNotifyBeep()
    }
    lastSeenChatMessageId = maxId
    chatMessages.value = items
    await scrollChatToBottom()
  } catch {
    /* ignore */
  }
}

function startDetailChatPoll() {
  stopDetailChatPoll()
  if (!detail.value?.id || !detail.value?.escalateToHuman) return
  lastSeenChatMessageId = 0
  void loadChatMessages(true)
  detailPollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    void loadChatMessages(false)
  }, 5000)
}

async function sendStaffChat() {
  const text = chatInput.value.trim()
  const sid = detail.value?.id
  if (!text || sid == null) return
  chatSending.value = true
  try {
    await postTriageSessionMessage(sid, text)
    chatInput.value = ''
    await loadChatMessages(true)
    ElMessage.success('已发送')
  } catch {
    ElMessage.error('发送失败')
  } finally {
    chatSending.value = false
  }
}

const riskTagType = (level: string): TagType => {
  const map: Record<string, TagType> = { R0: 'success', R1: 'info', R2: 'warning', R3: 'danger' }
  return map[level] || 'info'
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    pending: '待处理', completed: '已完成', escalated: '已转人工', converted: '已转单',
  }
  return map[s] || s
}

const statusType = (s: string): TagType => {
  const map: Record<string, TagType> = {
    pending: 'info',
    completed: 'success',
    escalated: 'warning',
    converted: 'primary',
  }
  return map[s] || 'info'
}

async function loadStats() {
  try {
    const res: any = await getTriageStats()
    stats.value = res
  } catch { /* ignore */ }
}

async function loadList() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterRisk.value) params.riskLevel = filterRisk.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterEscalate.value) params.escalateToHuman = filterEscalate.value === 'true'
    const res: any = await getTriageList(params)
    list.value = res.items || []
    total.value = res.total || 0
  } catch {
    ElMessage.error('加载导诊记录失败')
  } finally {
    loading.value = false
  }
}

function onFilter() {
  page.value = 1
  loadList()
}

function onReset() {
  filterRisk.value = ''
  filterStatus.value = ''
  filterEscalate.value = ''
  page.value = 1
  loadList()
}

function handlePageChange(p: number) {
  page.value = p
  loadList()
}

async function viewDetail(row: any) {
  stopDetailChatPoll()
  chatMessages.value = []
  chatInput.value = ''
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res: any = await getTriageDetail(row.id)
    detail.value = res
    if (res.escalateToHuman) startDetailChatPoll()
  } catch {
    ElMessage.error('加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function removeTriageRow(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除导诊记录 #${row.id}？将同步删除关联的人工留言与反馈，已生成的订单不会删除。`,
      '删除导诊',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteTriageSession(row.id)
    ElMessage.success('已删除')
    if (detailVisible.value && detail.value?.id === row.id) {
      detailVisible.value = false
      onDetailClosed()
    }
    await loadList()
    await loadStats()
  } catch {
    /* 错误由 request 拦截器提示 */
  }
}

function onDetailClosed() {
  stopDetailChatPoll()
  detail.value = null
  chatMessages.value = []
  chatInput.value = ''
}

async function pollListEscalation() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  try {
    const res: any = await getTriageList({ page: 1, pageSize: 25 })
    const items: any[] = res.items || []
    if (!items.length) return
    const maxId = Math.max(...items.map((r: any) => r.id))
    if (!listPollPrimed) {
      listMaxSessionId = maxId
      listPollPrimed = true
      return
    }
    if (maxId > listMaxSessionId) {
      const newcomers = items.filter((r: any) => r.id > listMaxSessionId && r.escalateToHuman)
      if (newcomers.length) playNotifyBeep()
      listMaxSessionId = maxId
    }
  } catch {
    /* ignore */
  }
}

function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function getRiskCount(level: string) {
  const item = stats.value.riskDistribution.find((r: any) => r.riskLevel === level)
  return item ? Number(item.count) : 0
}

onMounted(() => {
  loadStats()
  loadList()
  listPollTimer = setInterval(pollListEscalation, 20000)
  void pollListEscalation()
})

onUnmounted(() => {
  stopDetailChatPoll()
  stopListPoll()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">AI 导诊工单</h2>
        <p class="page-subtitle">按风险等级与转人工状态处理导诊会话，支持在详情里继续客服跟进。</p>
      </div>
    </div>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="page-alert"
      title="与预约、AI 问诊的区别"
      description="导诊会话含风险分级、是否转人工、是否已转订单；不是到店预约排期（见预约咨询），也不是通用聊天问诊记录（见 AI 问诊对话）。转人工后可在详情中与客户留言互动。"
    />

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总导诊数</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-value">{{ stats.todayCount }}</div>
          <div class="stat-label">今日导诊</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-value stat-value--warning">{{ stats.escalated }}</div>
          <div class="stat-label">转人工</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-value stat-value--success">{{ stats.converted }}</div>
          <div class="stat-label">已转单</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-value stat-value--accent">{{ stats.conversionRate }}</div>
          <div class="stat-label">转化率</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-card__tags">
            <el-tag type="success" size="small">R0: {{ getRiskCount('R0') }}</el-tag>
            <el-tag type="warning" size="small">R2: {{ getRiskCount('R2') }}</el-tag>
            <el-tag type="danger" size="small">R3: {{ getRiskCount('R3') }}</el-tag>
          </div>
          <div class="stat-label">风险分布</div>
        </div>
      </el-col>
    </el-row>

    <!-- 筛选 -->
    <el-card shadow="never" class="filter-bar">
      <el-form inline>
        <el-form-item label="风险等级">
          <el-select v-model="filterRisk" clearable placeholder="全部" style="width: 120px;">
            <el-option label="R0 低风险" value="R0" />
            <el-option label="R1 普通" value="R1" />
            <el-option label="R2 复杂" value="R2" />
            <el-option label="R3 高风险" value="R3" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterStatus" clearable placeholder="全部" style="width: 120px;">
            <el-option label="待处理" value="pending" />
            <el-option label="已完成" value="completed" />
            <el-option label="已转人工" value="escalated" />
            <el-option label="已转单" value="converted" />
          </el-select>
        </el-form-item>
        <el-form-item label="转人工">
          <el-select v-model="filterEscalate" clearable placeholder="全部" style="width: 100px;">
            <el-option label="是" value="true" />
            <el-option label="否" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onFilter">筛选</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="list" v-loading="loading" highlight-current-row>
        <el-table-column label="ID" width="70" prop="id" />
        <el-table-column label="用户" min-width="140">
          <template #default="{ row }">
            <div class="cell-user">
              <div class="cell-user__name">{{ row.user?.nickname || `用户${row.userId}` }}</div>
              <div class="cell-user__sub">{{ row.user?.phone || '' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="患者" min-width="120">
          <template #default="{ row }">
            <span>{{ row.patient?.name || '-' }}</span>
            <span class="cell-user__age">{{ row.patientAge }}岁</span>
          </template>
        </el-table-column>
        <el-table-column label="主诉" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.mainSymptom }}</template>
        </el-table-column>
        <el-table-column label="风险" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" size="small">{{ row.riskLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="科室" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.departmentPrimary || '-' }}</template>
        </el-table-column>
        <el-table-column label="推荐产品" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.recommendedProduct || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="转人工" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.escalateToHuman" type="warning" size="small">是</el-tag>
            <span v-else class="cell-muted">否</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button link type="danger" @click="removeTriageRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="导诊详情"
      width="820px"
      top="3vh"
      destroy-on-close
      @closed="onDetailClosed"
    >
      <div v-loading="detailLoading" class="dialog-scroll">
        <template v-if="detail">
          <!-- 风险等级 -->
          <div class="dialog-header">
            <el-tag :type="riskTagType(detail.riskLevel)" size="large" effect="dark" class="risk-tag-big">
              {{ detail.riskLevel }}
            </el-tag>
            <span class="dialog-header__urgency">{{ detail.urgencyLevel }}</span>
            <el-tag :type="statusType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          </div>

          <!-- 基本信息 -->
          <el-descriptions :column="2" border size="small" class="dialog-section">
            <el-descriptions-item label="咨询人身份">{{ detail.consultantRole }}</el-descriptions-item>
            <el-descriptions-item label="患者">{{ detail.patient?.name || '-' }}（{{ detail.patientAge }}岁 {{ detail.patientGender === 'male' ? '男' : '女' }}）</el-descriptions-item>
            <el-descriptions-item label="主诉" :span="2">{{ detail.mainSymptom }}</el-descriptions-item>
            <el-descriptions-item label="持续时间">{{ detail.symptomDuration || '-' }}</el-descriptions-item>
            <el-descriptions-item label="自评严重度">{{ detail.severitySelf || '-' }}</el-descriptions-item>
            <el-descriptions-item label="既往病史">{{ (detail.medicalHistory || []).join('、') || '-' }}</el-descriptions-item>
            <el-descriptions-item label="当前用药">{{ detail.currentMedication || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所在城市">{{ detail.patientCity || '-' }}</el-descriptions-item>
            <el-descriptions-item label="行动能力">{{ detail.mobility || '-' }}</el-descriptions-item>
            <el-descriptions-item label="家属异地">{{ detail.familyRemote ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="独居">{{ detail.livesAlone ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="就医目标">{{ detail.visitGoal || '-' }}</el-descriptions-item>
            <el-descriptions-item label="近期出院">{{ detail.recentlyDischarged ? '是' : '否' }}</el-descriptions-item>
          </el-descriptions>

          <!-- AI 输出 -->
          <el-descriptions :column="2" border size="small" title="AI 导诊结果" class="dialog-section">
            <el-descriptions-item label="场景类型">{{ detail.sceneType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="推荐主科室">{{ detail.departmentPrimary || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备选科室">{{ (detail.departmentSecondary || []).join('、') || '-' }}</el-descriptions-item>
            <el-descriptions-item label="推荐产品">{{ detail.recommendedProduct || '-' }}</el-descriptions-item>
            <el-descriptions-item label="服务路径" :span="2">
              <el-tag v-for="r in (detail.serviceRoute || [])" :key="r" size="small" class="route-tag">{{ r }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="就医准备" :span="2">
              {{ (detail.prepChecklist || []).join('、') || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="模型">{{ detail.modelName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Token">{{ detail.tokensUsed || '-' }}</el-descriptions-item>
          </el-descriptions>

          <!-- 红旗命中 -->
          <div v-if="detail.ruleHits?.length" class="hits-row">
            <span class="hits-row__label">红旗命中：</span>
            <el-tag v-for="h in detail.ruleHits" :key="h" type="danger" size="small" class="hits-row__tag">{{ h }}</el-tag>
          </div>

          <!-- 运营摘要 -->
          <div v-if="detail.structuredSummary" class="note-block note-block--warning">
            <div class="note-block__title">运营摘要</div>
            <div class="note-block__body">{{ detail.structuredSummary }}</div>
          </div>

          <!-- 用户回复 -->
          <div v-if="detail.safeReplyText" class="note-block note-block--success">
            <div class="note-block__title">用户端回复</div>
            <div class="note-block__body note-block__body--relaxed">{{ detail.safeReplyText }}</div>
          </div>

          <!-- 健康管家在线沟通 -->
          <el-card v-if="detail.escalateToHuman" shadow="never" class="chat-card">
            <template #header>
              <span class="chat-card__title">健康管家沟通</span>
              <span class="chat-card__meta">每 5 秒自动刷新；用户发来的新消息会提示音</span>
            </template>
            <el-alert
              type="info"
              :closable="false"
              show-icon
              class="chat-alert"
              title="沟通说明"
              description="管家仅提供就医协调与官方信息支持（如建议就诊方向、准备材料、医院公开联系方式等），不提供在线诊断或用药指导。急症请优先考虑120或就近急诊。"
            />
            <div ref="chatScrollRef" class="chat-window">
              <div v-if="!chatMessages.length" class="chat-window__empty">暂无留言，可直接发送问候与就医指引。</div>
              <div
                v-for="m in chatMessages"
                :key="m.id"
                class="chat-msg"
                :class="{ 'chat-msg--staff': m.sender === 'staff' }"
              >
                <div class="chat-msg__bubble" :class="{ 'chat-msg__bubble--staff': m.sender === 'staff' }">
                  {{ m.content }}
                </div>
                <div class="chat-msg__meta">
                  {{ m.sender === 'staff' ? '管家' : '用户' }} · {{ formatTime(m.createdAt) }}
                </div>
              </div>
            </div>
            <el-input
              v-model="chatInput"
              type="textarea"
              :rows="3"
              maxlength="4000"
              show-word-limit
              placeholder="回复用户：可提供就医准备、医院就诊提醒、公开电话口径等（避免诊断与处方表述）"
            />
            <div class="chat-send-bar">
              <el-button type="primary" :loading="chatSending" @click="sendStaffChat">发送</el-button>
            </div>
          </el-card>

          <!-- 反馈 -->
          <div v-if="detail.feedback" class="note-block note-block--info">
            <div class="note-block__title">反馈信息</div>
            <div class="note-block__body note-block__body--sm">
              人工接受：{{ detail.feedback.humanAccepted == null ? '-' : detail.feedback.humanAccepted ? '是' : '否' }}
              | 满意度：{{ detail.feedback.satisfaction || '-' }}
              | 实际服务：{{ detail.feedback.actualOrderType || '-' }}
              | 复购：{{ detail.feedback.followUpPurchased == null ? '-' : detail.feedback.followUpPurchased ? '是' : '否' }}
            </div>
            <div v-if="detail.feedback.remark" class="note-block__remark">备注：{{ detail.feedback.remark }}</div>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.page-alert {
  margin-bottom: $space-5;
}

.stats-row {
  margin-bottom: $space-6;
}

.stat-card {
  text-align: center;
  padding: $space-5;
  border-radius: $radius-lg;
  background: $card-bg;
  border: 1px solid $card-border;
  box-shadow: $card-shadow;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: $primary-200;
    box-shadow: $card-shadow-hover;
  }

  .stat-value {
    font-size: 26px;
    font-weight: 700;
    color: $text-primary;
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;

    &--warning { color: $warning; }
    &--success { color: $success; }
    &--accent { color: $primary-600; }
  }

  .stat-label {
    font-size: $font-sm;
    color: $text-tertiary;
    margin-top: 6px;
    font-weight: 500;
  }

  &__tags {
    display: flex;
    justify-content: center;
    gap: 6px;
  }
}

.filter-bar {
  margin-bottom: $space-4;
}

.table-card {
  :deep(.el-card__body) {
    padding: 0;
  }
  .el-table {
    border-radius: $radius-md $radius-md 0 0;
  }
}

.cell-user {
  &__name {
    font-weight: 500;
    color: $text-primary;
  }
  &__sub {
    color: $text-tertiary;
    font-size: $font-xs;
  }
  &__age {
    color: $text-tertiary;
    font-size: $font-xs;
    margin-left: 4px;
  }
}

.cell-muted {
  color: $text-disabled;
}

.pagination-bar {
  padding: $space-4 $space-5;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid $divider;
}

// ── 详情弹窗 ──
.dialog-scroll {
  max-height: 72vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-5;

  &__urgency {
    font-size: $font-lg;
    font-weight: 600;
    color: $text-primary;
  }
}

.risk-tag-big {
  font-size: $font-lg;
  padding: 8px 16px;
}

.dialog-section {
  margin-bottom: $space-5;
}

.route-tag {
  margin-right: 6px;
}

.hits-row {
  margin-bottom: $space-4;
  &__label {
    font-weight: 600;
    color: $danger;
    margin-right: $space-2;
  }
  &__tag {
    margin-right: 6px;
  }
}

// ── 高亮备注块（语义色） ──
.note-block {
  padding: $space-3 $space-4;
  border-radius: $radius-md;
  margin-bottom: $space-4;
  border: 1px solid transparent;

  &__title {
    font-weight: 600;
    font-size: $font-sm;
    margin-bottom: 4px;
  }
  &__body {
    font-size: $font-md;
    color: $text-primary;

    &--relaxed { line-height: 1.7; }
    &--sm { font-size: $font-sm; color: $text-secondary; }
  }
  &__remark {
    font-size: $font-sm;
    color: $text-tertiary;
    margin-top: 4px;
  }

  &--warning {
    background: rgba($warning, 0.08);
    border-color: rgba($warning, 0.2);
    .note-block__title { color: $warning; }
  }
  &--success {
    background: rgba($success, 0.08);
    border-color: rgba($success, 0.2);
    .note-block__title { color: $success; }
  }
  &--info {
    background: rgba($info, 0.06);
    border-color: rgba($info, 0.18);
    .note-block__title { color: $info; }
  }
}

// ── 健康管家聊天区 ──
.chat-card {
  margin-bottom: $space-4;

  &__title {
    font-weight: 600;
    color: $text-primary;
  }
  &__meta {
    font-size: $font-xs;
    color: $text-tertiary;
    margin-left: $space-2;
  }
}

.chat-alert {
  margin-bottom: $space-3;
}

.chat-window {
  max-height: 260px;
  overflow-y: auto;
  padding: $space-3;
  background: $bg-alt;
  border-radius: $radius-md;
  margin-bottom: $space-3;
  border: 1px solid $border-lighter;

  &__empty {
    color: $text-tertiary;
    font-size: $font-sm;
  }
}

.chat-msg {
  margin-bottom: $space-3;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  &--staff {
    align-items: flex-end;
  }

  &__bubble {
    max-width: 85%;
    padding: 8px 12px;
    border-radius: $radius-md;
    font-size: $font-md;
    line-height: 1.5;
    background: $card-bg;
    border: 1px solid $border-lighter;
    color: $text-primary;

    &--staff {
      background: rgba($primary-500, 0.1);
      border-color: rgba($primary-500, 0.3);
      color: $primary-700;
    }
  }

  &__meta {
    font-size: 11px;
    color: $text-disabled;
    margin-top: 4px;
  }
}

.chat-send-bar {
  margin-top: $space-3;
  display: flex;
  justify-content: flex-end;
}
</style>
