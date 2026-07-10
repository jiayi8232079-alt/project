<template>
  <div class="invoices">
    <el-card>
      <template #header>
        <span>发票管理</span>
      </template>

      <el-form :inline="true" class="filter-bar">
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px" @change="reload">
            <el-option label="申请中" value="requested" />
            <el-option label="已开" value="issued" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="已作废" value="voided" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="reload">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="userId" label="UID" width="80" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            {{ row.type === 'personal' ? '个人' : '企业' }}
          </template>
        </el-table-column>
        <el-table-column prop="title" label="抬头" min-width="180" show-overflow-tooltip />
        <el-table-column prop="taxNumber" label="税号" width="160" />
        <el-table-column prop="amount" label="金额（元）" width="120" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusColor(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.requestedAt) }}</template>
        </el-table-column>
        <el-table-column label="开票号">
          <template #default="{ row }">{{ row.invoiceNo || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'requested'" size="small" link @click="onIssue(row)">
              开票
            </el-button>
            <el-button
              v-if="row.status === 'requested'"
              size="small"
              link
              type="danger"
              @click="onReject(row)"
            >驳回</el-button>
            <el-button
              v-if="row.invoiceUrl"
              size="small"
              link
              @click="onDownload(row.invoiceUrl!)"
            >下载</el-button>
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

    <!-- 开票 Dialog -->
    <el-dialog v-model="issueVisible" title="开具发票" width="480px">
      <el-form :model="issueForm" label-width="100px">
        <el-form-item label="发票号" required>
          <el-input v-model="issueForm.invoiceNo" placeholder="电子发票号" />
        </el-form-item>
        <el-form-item label="发票 URL" required>
          <el-input v-model="issueForm.invoiceUrl" placeholder="PDF / OFD 链接" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="issueVisible = false">取消</el-button>
        <el-button type="primary" :loading="issuing" @click="onSubmitIssue">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  adminListInvoices,
  issueInvoice,
  rejectInvoice,
  type Invoice,
} from '@/api/billing'

const loading = ref(false)
const rows = ref<Invoice[]>([])
const total = ref(0)

const query = reactive({
  status: '',
  page: 1,
  pageSize: 20,
})

const issueVisible = ref(false)
const issuing = ref(false)
const issueForm = reactive({
  id: 0,
  invoiceNo: '',
  invoiceUrl: '',
})

async function reload() {
  loading.value = true
  try {
    const res = await adminListInvoices({
      status: query.status || undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onIssue(row: Invoice) {
  issueForm.id = row.id
  issueForm.invoiceNo = ''
  issueForm.invoiceUrl = ''
  issueVisible.value = true
}

async function onSubmitIssue() {
  if (!issueForm.invoiceNo || !issueForm.invoiceUrl) {
    ElMessage.warning('请填写发票号与 URL')
    return
  }
  issuing.value = true
  try {
    await issueInvoice(issueForm.id, {
      invoiceNo: issueForm.invoiceNo,
      invoiceUrl: issueForm.invoiceUrl,
    })
    ElMessage.success('已开票')
    issueVisible.value = false
    await reload()
  } finally {
    issuing.value = false
  }
}

async function onReject(row: Invoice) {
  const { value: reason } = await ElMessageBox.prompt('请输入驳回理由', '驳回开票', {
    confirmButtonText: '确认驳回',
  }).catch(() => ({ value: null }))
  if (!reason) return
  await rejectInvoice(row.id, reason)
  ElMessage.success('已驳回')
  await reload()
}

function onDownload(url: string) {
  window.open(url, '_blank')
}

function statusLabel(s: string) {
  return { requested: '申请中', issued: '已开', rejected: '已驳回', voided: '已作废' }[s] || s
}
function statusColor(s: string): any {
  return { requested: 'warning', issued: 'success', rejected: 'danger', voided: 'info' }[s] || ''
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
.invoices .filter-bar {
  margin-bottom: 12px;
}
.invoices .pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
