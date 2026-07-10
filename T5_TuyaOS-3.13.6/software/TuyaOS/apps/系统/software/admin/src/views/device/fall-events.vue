<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listSafetyEvents, type DeviceEventLog } from '@/api/device'

const router = useRouter()
const loading = ref(false)
const rows = ref<DeviceEventLog[]>([])
const total = ref(0)

const query = reactive({
  page: 1,
  pageSize: 20,
  type: '',
  deviceId: undefined as number | undefined,
})

async function reload() {
  loading.value = true
  try {
    const res = await listSafetyEvents({
      page: query.page,
      pageSize: query.pageSize,
      type: query.type || undefined,
      deviceId: query.deviceId,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function eventTypeLabel(t: string) {
  return (
    { fall: '跌倒', sos: 'SOS', vital_anomaly: '体征异常' }[t] ?? t
  )
}

function levelTag(level: string): 'success' | 'warning' | 'danger' | 'info' {
  if (level === 'critical') return 'danger'
  if (level === 'warning') return 'warning'
  return 'info'
}

function formatTime(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(reload)
</script>

<template>
  <div class="fall-events">
    <el-page-header @back="router.push('/device/list')" content="安全事件流（跌倒 / SOS）" />

    <el-card>
      <el-form :inline="true" class="filter-bar">
        <el-form-item label="类型">
          <el-select v-model="query.type" clearable placeholder="全部" style="width: 140px">
            <el-option label="跌倒" value="fall" />
            <el-option label="SOS" value="sos" />
            <el-option label="体征异常" value="vital_anomaly" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备 ID">
          <el-input-number v-model="query.deviceId" :min="1" placeholder="可选" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.receivedAt) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ eventTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="levelTag(row.level)" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="设备" min-width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.deviceId"
              link
              type="primary"
              @click="router.push(`/device/detail/${row.deviceId}`)"
            >
              #{{ row.deviceId }} {{ row.deviceName ?? '' }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="载荷" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.payload ? JSON.stringify(row.payload) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="已转告警" width="100">
          <template #default="{ row }">
            <el-tag :type="row.forwardedToAlert ? 'success' : 'info'" size="small">
              {{ row.forwardedToAlert ? '是' : '否' }}
            </el-tag>
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

<style scoped>
.fall-events {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter-bar {
  margin-bottom: 12px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
