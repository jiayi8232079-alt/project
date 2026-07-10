<template>
  <div class="dialog-review">
    <el-card>
      <template #header>
        <div class="header">
          <span>AI 对话质检</span>
          <el-tag v-if="crisisCount > 0" type="danger">本页危机会话 {{ crisisCount }} 条</el-tag>
        </div>
      </template>

      <el-form :inline="true" class="filter-bar">
        <el-form-item label="服务对象">
          <el-input-number v-model="query.serviceTargetId" :min="1" placeholder="老人 ID" />
        </el-form-item>
        <el-form-item label="设备">
          <el-input-number v-model="query.deviceId" :min="1" placeholder="设备 ID" />
        </el-form-item>
        <el-form-item label="质检状态">
          <el-select v-model="query.qaStatus" clearable placeholder="全部" style="width: 140px">
            <el-option label="待抽" value="pending" />
            <el-option label="已抽" value="sampled" />
            <el-option label="已审" value="reviewed" />
            <el-option label="有问题" value="flagged" />
          </el-select>
        </el-form-item>
        <el-form-item label="仅含危机">
          <el-switch
            :model-value="query.hasCrisis === 'true'"
            @update:model-value="(v: any) => (query.hasCrisis = v ? 'true' : '')"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" v-loading="loading" stripe @row-click="onView">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="结束时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.endedAt) || '进行中' }}</template>
        </el-table-column>
        <el-table-column label="设备" width="80">
          <template #default="{ row }">{{ row.deviceId ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="老人" width="80">
          <template #default="{ row }">{{ row.serviceTargetId ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="totalTurns" label="轮次" width="80" />
        <el-table-column prop="totalTokens" label="Token" width="90" />
        <el-table-column label="危机评分" width="100">
          <template #default="{ row }">
            <el-tag
              v-if="row.crisisScore > 0"
              :type="row.crisisScore > 50 ? 'danger' : 'warning'"
              size="small"
            >{{ row.crisisScore }}</el-tag>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="质检" width="110">
          <template #default="{ row }">
            <el-tag :type="qaTagColor(row.qaStatus)" size="small">{{ qaLabel(row.qaStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="摘要" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click.stop="onView(row)">查看</el-button>
            <el-button size="small" link @click.stop="onMark(row, 'reviewed')">通过</el-button>
            <el-button size="small" link type="danger" @click.stop="onMark(row, 'flagged')">
              有问题
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          @current-change="reload"
          @size-change="reload"
        />
      </div>
    </el-card>

    <!-- 会话详情 -->
    <el-drawer v-model="detailVisible" :title="`会话 #${currentId} 详情`" size="640px">
      <div v-if="detailLoading" v-loading="detailLoading" style="min-height: 300px"></div>
      <div v-else>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="开始">{{ formatDateTime(currentSession?.startedAt) }}</el-descriptions-item>
          <el-descriptions-item label="结束">{{ formatDateTime(currentSession?.endedAt) || '进行中' }}</el-descriptions-item>
          <el-descriptions-item label="轮次">{{ currentSession?.totalTurns ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="Token">{{ currentSession?.totalTokens ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="危机评分">{{ currentSession?.crisisScore ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ qaLabel(currentSession?.qaStatus) }}</el-descriptions-item>
          <el-descriptions-item label="危机词" :span="2">
            <el-tag
              v-for="w in (currentSession?.crisisWords ?? [])"
              :key="w"
              type="danger"
              size="small"
              style="margin-right: 4px"
            >{{ w }}</el-tag>
            <span v-if="!currentSession?.crisisWords?.length">无</span>
          </el-descriptions-item>
          <el-descriptions-item label="摘要" :span="2">
            <span class="summary">{{ currentSession?.summary || '尚未生成' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>对话流水</el-divider>
        <div class="dialog-flow">
          <div
            v-for="log in logs"
            :key="log.id"
            :class="['msg', `msg-${log.direction}`]"
          >
            <div class="meta">
              <span class="dir">{{ directionLabel(log.direction) }}</span>
              <span class="time">{{ formatDateTime(log.createdAt) }}</span>
              <el-tag v-if="log.crisisWords?.length" type="danger" size="small">危机</el-tag>
              <el-tag v-if="log.toolCalls?.length" size="small">工具 ×{{ log.toolCalls.length }}</el-tag>
            </div>
            <div class="text">{{ log.text }}</div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listSessions,
  getSession,
  markQaStatus,
  type AiDialogSession,
  type AiDialogLog,
} from '@/api/ai-dialog'

const loading = ref(false)
const rows = ref<AiDialogSession[]>([])
const total = ref(0)

const query = reactive({
  page: 1,
  pageSize: 20,
  serviceTargetId: undefined as number | undefined,
  deviceId: undefined as number | undefined,
  qaStatus: '',
  hasCrisis: '',
})

const crisisCount = computed(() => rows.value.filter((r) => r.crisisScore > 0).length)

const detailVisible = ref(false)
const detailLoading = ref(false)
const currentId = ref<number>(0)
const currentSession = ref<AiDialogSession | null>(null)
const logs = ref<AiDialogLog[]>([])

async function reload() {
  loading.value = true
  try {
    const res = await listSessions({
      page: query.page,
      pageSize: query.pageSize,
      serviceTargetId: query.serviceTargetId,
      deviceId: query.deviceId,
      qaStatus: query.qaStatus || undefined,
      hasCrisis: query.hasCrisis || undefined,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function onView(row: AiDialogSession) {
  currentId.value = row.id
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res = await getSession(row.id)
    currentSession.value = res.session
    logs.value = res.logs
  } finally {
    detailLoading.value = false
  }
}

async function onMark(row: AiDialogSession, status: 'reviewed' | 'flagged') {
  const action = status === 'reviewed' ? '通过' : '标记为有问题'
  await ElMessageBox.confirm(`确定${action}会话 #${row.id}？`, '质检确认', { type: 'warning' })
  await markQaStatus(row.id, status)
  ElMessage.success('已更新')
  await reload()
}

function qaLabel(s?: string) {
  return { pending: '待抽', sampled: '已抽', reviewed: '已审', flagged: '有问题' }[s ?? ''] || s
}
function qaTagColor(s?: string): any {
  return { pending: '', sampled: 'info', reviewed: 'success', flagged: 'danger' }[s ?? ''] || ''
}
function directionLabel(d: string) {
  return { user: '用户', assistant: '助手', system: '系统', tool: '工具' }[d] || d
}
function formatDateTime(v?: string | null) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(reload)
</script>

<style scoped>
.dialog-review .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dialog-review .filter-bar {
  margin-bottom: 12px;
}
.dialog-review .pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.dialog-review .summary {
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
}
.dialog-review .dialog-flow {
  max-height: 60vh;
  overflow-y: auto;
}
.dialog-review .msg {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}
.dialog-review .msg-user {
  background: #e8f5e9;
}
.dialog-review .msg-assistant {
  background: #e3f2fd;
}
.dialog-review .msg-tool {
  background: #fff3e0;
  font-family: monospace;
  font-size: 12px;
}
.dialog-review .msg .meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.dialog-review .msg .text {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
