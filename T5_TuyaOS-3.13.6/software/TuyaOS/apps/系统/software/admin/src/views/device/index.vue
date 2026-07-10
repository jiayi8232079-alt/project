<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getDeviceDashboardStats,
  listDevices,
  type Device,
  type DeviceDashboardStats,
  type DeviceListQuery,
} from '@/api/device'

const router = useRouter()
const loading = ref(false)
const statsLoading = ref(false)
const list = ref<Device[]>([])
const total = ref(0)
const stats = ref<DeviceDashboardStats | null>(null)

const query = ref<DeviceListQuery>({
  keyword: '',
  online: undefined,
  page: 1,
  pageSize: 20,
})

const onlineOptions = [
  { label: '在线', value: 'true' as const },
  { label: '离线', value: 'false' as const },
]

async function fetchStats() {
  statsLoading.value = true
  try {
    stats.value = await getDeviceDashboardStats()
  } catch (e) {
    console.error(e)
  } finally {
    statsLoading.value = false
  }
}

async function fetchList() {
  loading.value = true
  try {
    const res = await listDevices(query.value)
    list.value = res.items
    total.value = res.total
  } catch (e) {
    console.error(e)
    ElMessage.error('设备列表加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.value.page = 1
  fetchList()
}

function onReset() {
  query.value = { keyword: '', online: undefined, page: 1, pageSize: 20 }
  fetchList()
}

function goDetail(row: Device) {
  router.push(`/device/detail/${row.id}`)
}

function formatTime(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  fetchStats()
  fetchList()
})
</script>

<template>
  <div class="device-page">
    <el-row :gutter="12" class="stats-row" v-loading="statsLoading">
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">设备总数</div>
          <div class="stat-value">{{ stats?.total ?? '—' }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">在线率（7 日缓存）</div>
          <div class="stat-value">{{ stats ? `${stats.onlineRate}%` : '—' }}</div>
          <div class="stat-sub">在线 {{ stats?.onlineCount ?? 0 }} / 离线 {{ stats?.offlineCount ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">7 日跌倒/SOS</div>
          <div class="stat-value danger">{{ stats?.fallEvents7d ?? '—' }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-label">7 日 critical 事件</div>
          <div class="stat-value">{{ stats?.criticalEvents7d ?? '—' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="stats" shadow="never" class="battery-card">
      <template #header>电量分布</template>
      <el-space wrap>
        <el-tag type="success">≥50%：{{ stats.batteryBuckets.high }}</el-tag>
        <el-tag type="warning">20–49%：{{ stats.batteryBuckets.medium }}</el-tag>
        <el-tag type="danger">&lt;20%：{{ stats.batteryBuckets.low }}</el-tag>
        <el-tag type="info">未知：{{ stats.batteryBuckets.unknown }}</el-tag>
      </el-space>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <span>设备列表</span>
          <el-button link type="primary" @click="router.push('/device/fall-events')">
            查看安全事件流 →
          </el-button>
        </div>
      </template>

      <el-form :inline="true" class="filter-bar">
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" placeholder="名称 / 涂鸦ID / MAC" clearable />
        </el-form-item>
        <el-form-item label="在线">
          <el-select v-model="query.online" clearable placeholder="全部" style="width: 120px">
            <el-option
              v-for="opt in onlineOptions"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" v-loading="loading" stripe @row-click="goDetail">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="tuyaDeviceId" label="涂鸦 ID" min-width="160" show-overflow-tooltip />
        <el-table-column label="在线" width="90">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'success' : 'info'" size="small">
              {{ row.online ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="电量" width="80">
          <template #default="{ row }">
            {{ row.batteryPercent ?? '—' }}{{ row.batteryPercent != null ? '%' : '' }}
          </template>
        </el-table-column>
        <el-table-column label="最近在线" width="170">
          <template #default="{ row }">{{ formatTime(row.lastOnlineAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="goDetail(row)">详情</el-button>
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
          @current-change="fetchList"
          @size-change="fetchList"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.device-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stats-row .stat-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.stats-row .stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-top: 4px;
}
.stats-row .stat-value.danger {
  color: var(--el-color-danger);
}
.stats-row .stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
