<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getDevice,
  getDeviceEvents,
  mockDeviceEvent,
  mockDeviceOnline,
  sendDp,
  sendSelfControl,
  type Device,
  type DeviceEventLog,
} from '@/api/device'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const loading = ref(false)
const device = ref<Device | null>(null)
const events = ref<DeviceEventLog[]>([])
const eventsLoading = ref(false)

async function fetchDevice() {
  loading.value = true
  try {
    const res = await getDevice(id)
    device.value = res.device
  } catch (e) {
    console.error(e)
    ElMessage.error('设备详情加载失败')
  } finally {
    loading.value = false
  }
}

async function fetchEvents() {
  eventsLoading.value = true
  try {
    const res = await getDeviceEvents(id, { page: 1, pageSize: 30 })
    events.value = res.items
  } catch (e) {
    console.error(e)
  } finally {
    eventsLoading.value = false
  }
}

async function reload() {
  await Promise.all([fetchDevice(), fetchEvents()])
}

async function quickDp(code: string, value: string, label: string) {
  try {
    await ElMessageBox.confirm(`确认下发 ${label} 指令？`, '提示', {
      type: 'warning',
    })
    await sendDp(id, { code, value })
    ElMessage.success(`已下发：${label}`)
    await fetchEvents()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('下发失败')
    }
  }
}

async function quickSelfControl(code: string, value: string, label: string) {
  try {
    await sendSelfControl(id, { code, value })
    ElMessage.success(`已触发：${label}`)
    await fetchEvents()
  } catch (e) {
    console.error(e)
    ElMessage.error('触发失败')
  }
}

async function triggerMockEvent(
  type: string,
  level: 'info' | 'warning' | 'critical',
  label: string,
  payload?: Record<string, unknown>,
) {
  try {
    await ElMessageBox.confirm(`模拟触发「${label}」事件？`, 'Mock 事件', {
      type: level === 'critical' ? 'error' : 'warning',
    })
    await mockDeviceEvent(id, { type, level, payload })
    ElMessage.success(`已入库：${label}`)
    await reload()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('触发失败')
  }
}

async function toggleOnline() {
  if (!device.value) return
  const next = !device.value.online
  try {
    await mockDeviceOnline(id, next)
    ElMessage.success(next ? '已模拟上线' : '已模拟离线')
    await reload()
  } catch {
    ElMessage.error('操作失败')
  }
}

function statusBadge(d: Device) {
  if (d.status === 'suspended' || d.status === 'decommissioned') {
    return { type: 'danger', text: d.status === 'suspended' ? '停用' : '退役' }
  }
  return d.online
    ? { type: 'success', text: '在线' }
    : { type: 'info', text: '离线' }
}

function eventTypeLabel(t: string) {
  return (
    {
      online: '上线',
      offline: '下线',
      dp_change: 'DP 变化',
      fall: '跌倒',
      sos: 'SOS',
      vital_anomaly: '体征异常',
      ai_dialog: 'AI 对话',
      fault: '故障',
      ota: 'OTA',
      play_reminder: '播报回执',
      other: '其它',
    }[t] ?? t
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
  <div class="device-detail" v-loading="loading">
    <el-page-header @back="router.back()" content="设备详情" />

    <div v-if="device" class="grid">
      <el-card shadow="never">
        <template #header>
          <div class="card-head">
            <span class="card-title">{{ device.name }}</span>
            <div class="head-actions">
              <el-tag :type="statusBadge(device).type as any">
                {{ statusBadge(device).text }}
              </el-tag>
              <el-button size="small" @click="toggleOnline">
                {{ device.online ? '模拟离线' : '模拟上线' }}
              </el-button>
            </div>
          </div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备 ID">
            {{ device.id }}
          </el-descriptions-item>
          <el-descriptions-item label="涂鸦 ID">
            {{ device.tuyaDeviceId }}
          </el-descriptions-item>
          <el-descriptions-item label="产品 PID">
            {{ device.productId }}
          </el-descriptions-item>
          <el-descriptions-item label="生命周期">
            {{ device.status }}
          </el-descriptions-item>
          <el-descriptions-item label="固件版本">
            {{ device.firmwareVersion ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="MAC">
            {{ device.mac ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="电量">
            {{ device.batteryPercent ?? '—' }}{{ device.batteryPercent !== null ? '%' : '' }}
          </el-descriptions-item>
          <el-descriptions-item label="最近在线">
            {{ formatTime(device.lastOnlineAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="租户 ID">
            {{ device.tenantId }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="card-title">Mock 安全事件（联调）</span>
        </template>
        <div class="actions">
          <el-button type="danger" @click="triggerMockEvent('fall', 'critical', '跌倒检测', { confidence: 0.92 })">
            模拟跌倒
          </el-button>
          <el-button type="danger" @click="triggerMockEvent('sos', 'critical', 'SOS 按键')">
            模拟 SOS
          </el-button>
          <el-button @click="triggerMockEvent('dp_change', 'warning', '低电量', { code: 'battery_percentage', value: '15' })">
            模拟低电量 DP
          </el-button>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="card-title">DP 快捷下发（运营测试）</span>
        </template>
        <div class="actions">
          <el-button @click="quickDp('volume_set', '60', '音量 60')">音量 60</el-button>
          <el-button @click="quickDp('volume_set', '20', '音量 20')">音量 20</el-button>
          <el-button @click="quickDp('mute', 'true', '关麦')">关麦</el-button>
          <el-button @click="quickDp('mute', 'false', '开麦')">开麦</el-button>
          <el-button @click="quickDp('ptz_control', 'up', '云台上')">云台 ↑</el-button>
          <el-button @click="quickDp('ptz_control', 'down', '云台下')">云台 ↓</el-button>
          <el-button @click="quickDp('ptz_control', 'left', '云台左')">云台 ←</el-button>
          <el-button @click="quickDp('ptz_control', 'right', '云台右')">云台 →</el-button>
          <el-button @click="quickDp('ptz_control', 'lens_return', '回正')">回正</el-button>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="card-title">自控指令 · 表情 / 动作 / 人脸追踪</span>
        </template>
        <div class="actions">
          <el-button @click="quickSelfControl('expr_happy', 'happy', '开心表情')">😄 开心</el-button>
          <el-button @click="quickSelfControl('expr_thinking', 'thinking', '思考表情')">🤔 思考</el-button>
          <el-button @click="quickSelfControl('expr_listening', 'listening', '聆听表情')">👂 聆听</el-button>
          <el-button @click="quickSelfControl('expr_sleepy', 'sleepy', '困了表情')">😴 困了</el-button>
          <el-button @click="quickSelfControl('expr_worried', 'worried', '担心表情')">😟 担心</el-button>
          <el-divider direction="vertical" />
          <el-button @click="quickSelfControl('act_nod', 'nod', '点头')">点头</el-button>
          <el-button @click="quickSelfControl('act_shake', 'shake', '摇头')">摇头</el-button>
          <el-divider direction="vertical" />
          <el-button @click="quickSelfControl('face_track_on', 'track_on', '开启追踪')">开启人脸追踪</el-button>
          <el-button @click="quickSelfControl('face_track_off', 'track_off', '关闭追踪')">关闭追踪</el-button>
        </div>
      </el-card>

      <el-card shadow="never" v-loading="eventsLoading">
        <template #header>
          <div class="card-head">
            <span class="card-title">事件流水</span>
            <el-button size="small" link @click="fetchEvents">刷新</el-button>
          </div>
        </template>
        <el-table v-if="events.length" :data="events" size="small" stripe>
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
          <el-table-column label="载荷" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.payload ? JSON.stringify(row.payload) : '—' }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无事件，可用上方 Mock 按钮触发" />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.device-detail {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title {
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
