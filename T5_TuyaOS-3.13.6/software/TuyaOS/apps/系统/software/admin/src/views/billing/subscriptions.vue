<template>
  <div class="subscriptions">
    <el-card>
      <template #header>
        <span>订阅管理</span>
      </template>

      <el-form :inline="true" class="filter-bar">
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px" @change="reload">
            <el-option label="试用中" value="trialing" />
            <el-option label="正常" value="active" />
            <el-option label="暂停" value="paused" />
            <el-option label="宽限" value="grace" />
            <el-option label="已取消" value="canceled" />
            <el-option label="已过期" value="expired" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="reload">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="套餐" min-width="180">
          <template #default="{ row }">
            <div>{{ row.plan?.name || '#' + row.planId }}</div>
            <div class="sub-info">
              <el-tag size="small">{{ planCategoryLabel(row.plan?.category) }}</el-tag>
              <el-tag size="small" type="info">{{ cycleLabel(row.plan?.billingCycle) }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="设备" width="160">
          <template #default="{ row }">{{ row.device?.name || (row.deviceId ? '#' + row.deviceId : '-') }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusColor(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unitPriceSnapshot" label="价格" width="100" />
        <el-table-column label="本期截止" width="170">
          <template #default="{ row }">{{ formatDateTime(row.currentPeriodEnd) }}</template>
        </el-table-column>
        <el-table-column label="下次扣费" width="170">
          <template #default="{ row }">{{ formatDateTime(row.nextChargeAt) || '-' }}</template>
        </el-table-column>
        <el-table-column label="自动续费" width="100">
          <template #default="{ row }">
            <el-tag :type="row.autoRenew ? 'success' : 'info'" size="small">
              {{ row.autoRenew ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="onRenew(row)" :disabled="row.status === 'canceled'">
              续费
            </el-button>
            <el-button size="small" link type="danger" @click="onCancel(row)" :disabled="row.status === 'canceled'">
              取消
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listSubscriptions,
  renewSubscription,
  cancelSubscription,
  type Subscription,
} from '@/api/billing'

const loading = ref(false)
const rows = ref<Subscription[]>([])
const total = ref(0)

const query = reactive({
  status: '',
  page: 1,
  pageSize: 20,
})

async function reload() {
  loading.value = true
  try {
    const res = await listSubscriptions({
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

async function onRenew(row: Subscription) {
  await ElMessageBox.confirm(`确定为订阅 #${row.id} 续费？`, '续费确认', { type: 'warning' })
  await renewSubscription(row.id)
  ElMessage.success('已续费')
  await reload()
}

async function onCancel(row: Subscription) {
  const { value: reason } = await ElMessageBox.prompt('请输入取消原因（可选）', '取消订阅', {
    confirmButtonText: '确定取消',
    cancelButtonText: '不取消',
    inputPlaceholder: '如：客户申请、欠费等',
  }).catch(() => ({ value: null }))
  if (reason === null) return
  await cancelSubscription(row.id, reason || undefined)
  ElMessage.success('已取消')
  await reload()
}

function planCategoryLabel(c?: string) {
  return { device: '设备订阅', ai: 'AI 用量', institution: '机构', addon: '增值包' }[c ?? ''] || c || '-'
}
function cycleLabel(c?: string) {
  return { monthly: '月付', yearly: '年付', one_time: '一次性' }[c ?? ''] || c || '-'
}
function statusLabel(s: string) {
  return {
    trialing: '试用中',
    active: '正常',
    paused: '暂停',
    grace: '宽限期',
    canceled: '已取消',
    expired: '已过期',
  }[s] || s
}
function statusColor(s: string): any {
  return {
    trialing: 'info',
    active: 'success',
    paused: 'warning',
    grace: 'warning',
    canceled: 'danger',
    expired: 'danger',
  }[s] || ''
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
.subscriptions .filter-bar {
  margin-bottom: 12px;
}
.subscriptions .pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.subscriptions .sub-info {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
</style>
