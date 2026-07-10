<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listAuditLogsApi,
  type AuditLogItem,
  type AuditLogListParams,
} from '@/api/audit-log'

const ACTOR_TYPE_LABELS: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
  attendant: '陪诊员',
  system: '系统任务',
}

const METHOD_TAG_TYPE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  POST: 'success',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'danger',
  GET: 'info',
}

function statusTagType(code: number | null) {
  if (!code) return 'info'
  if (code >= 200 && code < 400) return 'success'
  if (code >= 400 && code < 500) return 'warning'
  return 'danger'
}

function formatDateRange(range: [string, string] | null): {
  from?: string
  to?: string
} {
  if (!range || !range[0] || !range[1]) return {}
  return { from: range[0], to: range[1] }
}

function prettyJson(raw: string | null) {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const filters = reactive<{
  actorType: string
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  range: [string, string] | null
}>({
  actorType: '',
  actorId: '',
  action: '',
  resourceType: '',
  resourceId: '',
  range: null,
})

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<AuditLogItem[]>([])
const loading = ref(false)

const detailVisible = ref(false)
const detailItem = ref<AuditLogItem | null>(null)

async function loadList() {
  loading.value = true
  try {
    const { from, to } = formatDateRange(filters.range)
    const params: AuditLogListParams = {
      page: page.value,
      pageSize: pageSize.value,
      actorType: filters.actorType || undefined,
      actorId: filters.actorId ? Number(filters.actorId) : undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      resourceId: filters.resourceId || undefined,
      from,
      to,
    }
    const res = await listAuditLogsApi(params)
    items.value = res.items || []
    total.value = res.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载审计日志失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  loadList()
}

function onReset() {
  filters.actorType = ''
  filters.actorId = ''
  filters.action = ''
  filters.resourceType = ''
  filters.resourceId = ''
  filters.range = null
  page.value = 1
  loadList()
}

function onPageChange(next: number) {
  page.value = next
  loadList()
}

function onPageSizeChange(next: number) {
  pageSize.value = next
  page.value = 1
  loadList()
}

function showDetail(row: AuditLogItem) {
  detailItem.value = row
  detailVisible.value = true
}

onMounted(() => {
  loadList()
})
</script>

<template>
  <div class="audit-logs-page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="操作人类型">
          <el-select
            v-model="filters.actorType"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option label="管理员" value="admin" />
            <el-option label="陪诊员" value="attendant" />
            <el-option label="用户" value="user" />
            <el-option label="系统" value="system" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人 ID">
          <el-input v-model="filters.actorId" placeholder="ID" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="动作">
          <el-input v-model="filters.action" placeholder="如 order.update" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="资源类型">
          <el-input v-model="filters.resourceType" placeholder="如 orders" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="资源 ID">
          <el-input v-model="filters.resourceId" placeholder="ID" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filters.range"
            type="daterange"
            start-placeholder="起始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="items" v-loading="loading" stripe border size="small" height="calc(100vh - 360px)">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="160">
          <template #default="{ row }">
            <div>
              <el-tag size="small" effect="plain">{{ ACTOR_TYPE_LABELS[row.actorType] || row.actorType }}</el-tag>
              <div class="cell-sub">{{ row.actorName || '—' }}{{ row.actorId ? `（#${row.actorId}）` : '' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" prop="actorRole" width="110">
          <template #default="{ row }">
            <span>{{ row.actorRole || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="动作" prop="action" width="180" />
        <el-table-column label="资源" width="170">
          <template #default="{ row }">
            <span>{{ row.resourceType || '—' }}</span>
            <span v-if="row.resourceId"> #{{ row.resourceId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="请求" min-width="280">
          <template #default="{ row }">
            <div class="method-row">
              <el-tag size="small" :type="METHOD_TAG_TYPE[row.method || ''] || 'info'">
                {{ row.method || '—' }}
              </el-tag>
              <span class="path-text">{{ row.path || '—' }}</span>
            </div>
            <div class="cell-sub">IP: {{ row.ip || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.statusCode)">
              {{ row.statusCode ?? '—' }}
            </el-tag>
            <div class="cell-sub">{{ row.durationMs != null ? `${row.durationMs} ms` : '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      title="审计日志详情"
      width="720px"
      destroy-on-close
    >
      <template v-if="detailItem">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="时间">{{ new Date(detailItem.createdAt).toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="操作人">
            {{ ACTOR_TYPE_LABELS[detailItem.actorType] || detailItem.actorType }} ·
            {{ detailItem.actorName || '—' }}
            {{ detailItem.actorId ? `#${detailItem.actorId}` : '' }}
          </el-descriptions-item>
          <el-descriptions-item label="角色">{{ detailItem.actorRole || '—' }}</el-descriptions-item>
          <el-descriptions-item label="动作">{{ detailItem.action }}</el-descriptions-item>
          <el-descriptions-item label="资源">
            {{ detailItem.resourceType || '—' }}
            <span v-if="detailItem.resourceId">#{{ detailItem.resourceId }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="请求">{{ detailItem.method }} {{ detailItem.path }}</el-descriptions-item>
          <el-descriptions-item label="来源 IP">{{ detailItem.ip || '—' }}</el-descriptions-item>
          <el-descriptions-item label="状态码 / 耗时">
            {{ detailItem.statusCode ?? '—' }} · {{ detailItem.durationMs ?? '—' }} ms
          </el-descriptions-item>
          <el-descriptions-item label="User-Agent" :span="2">
            <span class="mono">{{ detailItem.userAgent || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detailItem.remark || '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="json-block">
          <div class="json-title">请求摘要（已脱敏）</div>
          <pre>{{ prettyJson(detailItem.requestSummary) }}</pre>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.audit-logs-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-card :deep(.el-form-item) {
  margin-bottom: 8px;
}

.table-card {
  flex: 1;
}

.cell-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.method-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-text {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #303133;
  word-break: break-all;
}

.mono {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
}

.pagination {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.json-block {
  margin-top: 12px;

  .json-title {
    font-weight: 600;
    color: #606266;
    margin-bottom: 6px;
    font-size: 14px;
  }

  pre {
    max-height: 260px;
    overflow: auto;
    background: #f4f4f5;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
