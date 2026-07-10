<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAiStats, getAiByUser, getAiUserMessages, deleteAdminUserSession } from '@/api/ai-consultation'

const loading = ref(false)
const stats = ref({ totalSessions: 0, totalMessages: 0, totalTokens: 0, todayMessages: 0 })

const users = ref<any[]>([])
const userTotal = ref(0)
const userPage = ref(1)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailMessages = ref<any[]>([])
const detailUser = ref<any>(null)
const detailTotal = ref(0)
const detailPage = ref(1)

async function loadStats() {
  try {
    const res: any = await getAiStats()
    stats.value = res
  } catch { /* ignore */ }
}

async function loadUsers() {
  loading.value = true
  try {
    const res: any = await getAiByUser({ page: userPage.value, pageSize: 20 })
    users.value = res.items || []
    userTotal.value = res.total || 0
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

function handleUserPageChange(p: number) {
  userPage.value = p
  loadUsers()
}

async function viewUserDetail(row: any) {
  detailUser.value = row
  detailVisible.value = true
  detailPage.value = 1
  loadUserMessages()
}

async function loadUserMessages() {
  detailLoading.value = true
  try {
    const res: any = await getAiUserMessages(detailUser.value.userId, {
      page: detailPage.value,
      pageSize: 100,
    })
    detailMessages.value = res.items || []
    detailTotal.value = res.total || 0
  } catch {
    ElMessage.error('加载对话详情失败')
  } finally {
    detailLoading.value = false
  }
}

function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function formatDate(t: string) {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTimeOnly(t: string) {
  if (!t) return ''
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function groupMessagesByDate(messages: any[]) {
  const groups: { date: string; items: any[] }[] = []
  let lastDate = ''
  for (const msg of messages) {
    const date = formatDate(msg.createdAt)
    if (date !== lastDate) {
      groups.push({ date, items: [] })
      lastDate = date
    }
    const g = groups[groups.length - 1]
    if (g) g.items.push(msg)
  }
  return groups
}

/** 按会话分组，便于按会话删除 */
const groupedSessions = computed(() => {
  const messages = detailMessages.value as any[]
  const map = new Map<string, any[]>()
  for (const m of messages) {
    const sid = (m.sessionId && String(m.sessionId)) || 'unknown'
    if (!map.has(sid)) map.set(sid, [])
    map.get(sid)!.push(m)
  }
  return Array.from(map.entries())
    .map(([sessionId, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      const last = sorted[sorted.length - 1]
      const firstUser = sorted.find((x) => x.role === 'user')
      const raw = (firstUser?.content || sorted[0]?.content || '').replace(/\s+/g, ' ').trim()
      const preview = raw.length > 48 ? `${raw.slice(0, 48)}…` : raw
      return {
        sessionId,
        items: sorted,
        preview: preview || '（无预览）',
        messageCount: sorted.length,
        lastAt: last?.createdAt,
      }
    })
    .sort(
      (a, b) =>
        new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime(),
    )
})

async function deleteUserSession(sessionId: string) {
  const uid = detailUser.value?.userId
  if (!uid || sessionId === 'unknown') return
  try {
    await ElMessageBox.confirm(
      '确定删除该客户在此会话中的全部问诊记录？删除后不可恢复。',
      '删除会话',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteAdminUserSession(uid, sessionId)
    ElMessage.success('已删除该会话')
    await loadUserMessages()
    await loadStats()
    await loadUsers()
  } catch {
    /* ElMessage by interceptor */
  }
}

onMounted(() => {
  loadStats()
  loadUsers()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">AI 问诊对话</h2>
        <p class="page-subtitle">集中查看客户多轮问诊会话、消息量与 Token 消耗，便于客服复盘沟通质量。</p>
      </div>
    </div>
    <div class="ai-hint">
      <el-icon class="ai-hint__icon"><InfoFilled /></el-icon>
      <div class="ai-hint__body">
        <div class="ai-hint__title">与预约排期、导诊工单的区别</div>
        <div class="ai-hint__desc">此处为小程序「AI 问诊」多轮对话与 Token 统计，不等同于预约咨询排期，也不包含导诊分流工单。内容仅供内部客服参考，不构成诊疗依据；删除会话不可恢复，须合规操作。</div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="ai-stat-cards">
      <div class="ai-stat-card">
        <div class="ai-stat-card__icon ai-stat-card__icon--session">
          <el-icon :size="18"><ChatDotRound /></el-icon>
        </div>
        <div class="ai-stat-card__body">
          <div class="ai-stat-card__label">总会话数</div>
          <div class="ai-stat-card__value">{{ stats.totalSessions }}</div>
        </div>
      </div>
      <div class="ai-stat-card">
        <div class="ai-stat-card__icon ai-stat-card__icon--message">
          <el-icon :size="18"><Message /></el-icon>
        </div>
        <div class="ai-stat-card__body">
          <div class="ai-stat-card__label">总消息数</div>
          <div class="ai-stat-card__value">{{ stats.totalMessages }}</div>
        </div>
      </div>
      <div class="ai-stat-card">
        <div class="ai-stat-card__icon ai-stat-card__icon--today">
          <el-icon :size="18"><Calendar /></el-icon>
        </div>
        <div class="ai-stat-card__body">
          <div class="ai-stat-card__label">今日消息</div>
          <div class="ai-stat-card__value">{{ stats.todayMessages }}</div>
        </div>
      </div>
      <div class="ai-stat-card">
        <div class="ai-stat-card__icon ai-stat-card__icon--token">
          <el-icon :size="18"><DataLine /></el-icon>
        </div>
        <div class="ai-stat-card__body">
          <div class="ai-stat-card__label">总 Token 消耗</div>
          <div class="ai-stat-card__value">{{ stats.totalTokens.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <!-- 按客户聚合列表 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-card__header">
          <span class="table-card__title">客户问诊记录</span>
          <span class="table-card__hint">按客户聚合 · 点击行查看该客户全部对话</span>
        </div>
      </template>

      <el-table :data="users" v-loading="loading" highlight-current-row>
        <el-table-column label="客户" min-width="160">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-avatar :size="32" :src="row.avatarUrl" style="flex-shrink: 0;">
                {{ (row.nickname || '?')[0] }}
              </el-avatar>
              <div>
                <div style="font-weight: 500;">{{ row.nickname || '未设置昵称' }}</div>
                <div style="color: #909399; font-size: 12px;">{{ row.phone || '-' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="会话数" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.sessionCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消息数" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.messageCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Token 消耗" width="120" align="center">
          <template #default="{ row }">
            {{ Number(row.totalTokens || 0).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="首次咨询" width="120">
          <template #default="{ row }">
            {{ formatDate(row.firstMessageAt) }}
          </template>
        </el-table-column>
        <el-table-column label="最后活跃" width="170">
          <template #default="{ row }">
            {{ formatTime(row.lastMessageAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewUserDetail(row)">查看全部对话</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="userPage"
          :page-size="20"
          :total="userTotal"
          layout="prev, pager, next"
          @current-change="handleUserPageChange"
        />
      </div>
    </el-card>

    <!-- 客户全部对话详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="`${detailUser?.nickname || '客户'} 的全部问诊记录`"
      width="750px"
      top="3vh"
    >
      <div v-loading="detailLoading" style="max-height: 70vh; overflow-y: auto; padding: 0 8px;">
        <template v-for="sess in groupedSessions" :key="sess.sessionId">
          <div
            style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 20px 0 12px; padding: 10px 14px; background: #F5F7FA; border-radius: 8px; border: 1px solid #EBEEF5;"
          >
            <div style="flex: 1; min-width: 200px;">
              <el-tag size="small" type="info" effect="plain" style="font-family: monospace; max-width: 100%;">
                {{ sess.sessionId.length > 22 ? sess.sessionId.slice(0, 22) + '…' : sess.sessionId }}
              </el-tag>
              <span style="margin-left: 8px; color: #606266; font-size: 13px;">
                {{ sess.messageCount }} 条
              </span>
              <div style="color: #909399; font-size: 12px; margin-top: 6px; line-height: 1.4;">
                {{ sess.preview }}
              </div>
            </div>
            <el-button
              v-if="sess.sessionId !== 'unknown'"
              type="danger"
              size="small"
              plain
              @click="deleteUserSession(sess.sessionId)"
            >
              删除本会话
            </el-button>
          </div>

          <template v-for="group in groupMessagesByDate(sess.items)" :key="sess.sessionId + '-' + group.date">
            <div style="display: flex; align-items: center; gap: 12px; margin: 16px 0 12px;">
              <div style="flex: 1; height: 1px; background: #EBEEF5;"></div>
              <span style="color: #909399; font-size: 12px; flex-shrink: 0;">{{ group.date }}</span>
              <div style="flex: 1; height: 1px; background: #EBEEF5;"></div>
            </div>

            <div
              v-for="msg in group.items"
              :key="msg.id"
              style="margin-bottom: 16px;"
            >
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <el-tag :type="msg.role === 'user' ? 'primary' : 'success'" size="small">
                  {{ msg.role === 'user' ? '用户' : 'AI' }}
                </el-tag>
                <span style="color: #909399; font-size: 12px;">{{ formatTimeOnly(msg.createdAt) }}</span>
                <span v-if="msg.tokensUsed" style="color: #C0C4CC; font-size: 11px;">
                  ({{ msg.tokensUsed }} tokens)
                </span>
              </div>
              <div
                :style="{
                  background: msg.role === 'user' ? '#ECF5FF' : '#F0F9EB',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }"
              >
                {{ msg.content }}
              </div>
              <div v-if="msg.parsedResult?.recommendedDepartments?.length" style="margin-top: 8px;">
                <el-tag
                  v-for="dept in msg.parsedResult.recommendedDepartments"
                  :key="dept.name"
                  style="margin-right: 6px; margin-bottom: 4px;"
                  type="warning"
                  size="small"
                >
                  {{ dept.name }} ({{ Math.round(dept.confidence * 100) }}%)
                </el-tag>
              </div>
            </div>
          </template>
        </template>
        <el-empty v-if="!detailLoading && detailMessages.length === 0" description="暂无对话记录" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.ai-hint {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 18px;
  border-radius: $radius-lg;
  background: $primary-50;
  border: 1px solid $primary-100;
  margin-bottom: $space-5;
}

.ai-hint__icon {
  font-size: 18px;
  color: $primary-dark;
  margin-top: 2px;
  flex-shrink: 0;
}

.ai-hint__body {
  flex: 1;
  min-width: 0;
}

.ai-hint__title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 4px;
}

.ai-hint__desc {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.ai-stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: $space-5;
}

.ai-stat-card {
  background: $card-bg;
  border: 1px solid $card-border;
  border-radius: $radius-lg;
  padding: 20px 22px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: $card-shadow;
  transition: all 0.18s ease;

  &:hover {
    border-color: $primary-200;
    box-shadow: $card-shadow-hover;
    transform: translateY(-1px);
  }
}

.ai-stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: $radius-md;
  flex-shrink: 0;
  background: $primary-50;
  color: $primary-dark;

  &--session,
  &--message,
  &--today,
  &--token {
    background: $primary-50;
    color: $primary-dark;
  }
}

.ai-stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ai-stat-card__label {
  font-size: $font-sm;
  color: $text-tertiary;
  font-weight: 500;
}

.ai-stat-card__value {
  font-size: 26px;
  font-weight: 700;
  color: $text-primary;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.table-card__hint {
  font-size: $font-sm;
  color: $text-tertiary;
  font-weight: 400;
  margin-left: $space-2;
}
</style>
