<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getScheduleList, getAttendantList, submitAttendantSchedules } from '@/api/attendant'

const loading = ref(false)
const saving = ref(false)
const attendants = ref<any[]>([])
const rawSchedules = ref<any[]>([])
const weekOffset = ref(0)

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function getWeekRange(offset: number) {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1 + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    startDate: formatDateStr(monday),
    endDate: formatDateStr(sunday),
    label: `${formatDateStr(monday)} ~ ${formatDateStr(sunday)}`,
    dates: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return formatDateStr(d)
    }),
  }
}

function formatDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const currentWeekRange = computed(() => getWeekRange(weekOffset.value))

const scheduleData = computed(() => {
  const { dates } = currentWeekRange.value
  const rows: Array<{
    attendant: any
    attendantId: number
    slots: Array<{ am: boolean; pm: boolean }>
  }> = []
  for (const att of attendants.value) {
    const slots: Array<{ am: boolean; pm: boolean }> = dates.map(() => ({ am: false, pm: false }))
    for (const s of rawSchedules.value) {
      if (s.attendantId !== att.id && s.attendant?.id !== att.id) continue
      const dateStr = typeof s.date === 'string' ? s.date.split('T')[0] : s.date?.toISOString?.()?.split('T')[0]
      const idx = dateStr ? dates.indexOf(dateStr) : -1
      if (idx === -1) continue
      const period = s.period || ''
      const slot = slots[idx]
      if (!slot) continue
      if (period === 'morning') slot.am = true
      else if (period === 'afternoon') slot.pm = true
      else if (period === 'full_day') {
        slot.am = true
        slot.pm = true
      }
    }
    rows.push({ attendant: att, attendantId: att.id, slots })
  }
  return rows
})

async function loadSchedule() {
  loading.value = true
  try {
    const { startDate, endDate } = currentWeekRange.value
    const [attRes, schedRes] = await Promise.all([
      getAttendantList({ page: 1, pageSize: 100, status: 'active' }),
      getScheduleList({ startDate, endDate }),
    ])
    attendants.value = attRes.items || []
    rawSchedules.value = Array.isArray(schedRes) ? schedRes : []
  } catch {
    attendants.value = []
    rawSchedules.value = []
  } finally {
    loading.value = false
  }
}

const editableSlots = ref<Record<string, boolean>>({})

function slotKey(attendantId: number, dayIdx: number, period: 'am' | 'pm') {
  return `${attendantId}_${dayIdx}_${period}`
}

function toggleSlot(attendantId: number, dayIdx: number, period: 'am' | 'pm') {
  const key = slotKey(attendantId, dayIdx, period)
  editableSlots.value[key] = !editableSlots.value[key]
}

function getSlotValue(attendantId: number, dayIdx: number, period: 'am' | 'pm'): boolean {
  const key = slotKey(attendantId, dayIdx, period)
  if (key in editableSlots.value) return !!editableSlots.value[key]
  const row = scheduleData.value.find((r) => r.attendantId === attendantId)
  if (!row) return false
  return period === 'am' ? !!row.slots[dayIdx]?.am : !!row.slots[dayIdx]?.pm
}

function buildSlotsForAttendant(attendantId: number) {
  const row = scheduleData.value.find((r) => r.attendantId === attendantId)
  if (!row) return []
  const { dates } = currentWeekRange.value
  const result: { date: string; period: string }[] = []
  for (let i = 0; i < 7; i++) {
    const date = dates[i]
    if (!date) continue
    const am = slotKey(attendantId, i, 'am') in editableSlots.value ? !!editableSlots.value[slotKey(attendantId, i, 'am')] : !!row.slots[i]?.am
    const pm = slotKey(attendantId, i, 'pm') in editableSlots.value ? !!editableSlots.value[slotKey(attendantId, i, 'pm')] : !!row.slots[i]?.pm
    if (am) result.push({ date, period: 'morning' })
    if (pm) result.push({ date, period: 'afternoon' })
  }
  return result
}

function isSlotChecked(attendantId: number, dayIdx: number, period: 'am' | 'pm'): boolean {
  const key = slotKey(attendantId, dayIdx, period)
  if (key in editableSlots.value) return !!editableSlots.value[key]
  const row = scheduleData.value.find((r) => r.attendantId === attendantId)
  if (!row) return false
  return period === 'am' ? !!row.slots[dayIdx]?.am : !!row.slots[dayIdx]?.pm
}

function setSlot(attendantId: number, dayIdx: number, period: 'am' | 'pm', value: boolean) {
  editableSlots.value[slotKey(attendantId, dayIdx, period)] = value
}

function onCellClick(attendantId: number, dayIdx: number, period: 'am' | 'pm') {
  const current = isSlotChecked(attendantId, dayIdx, period)
  setSlot(attendantId, dayIdx, period, !current)
}

async function saveAllSchedules() {
  saving.value = true
  try {
    const { startDate, endDate } = currentWeekRange.value
    for (const row of scheduleData.value) {
      const schedules = buildSlotsForAttendant(row.attendantId)
      await submitAttendantSchedules(row.attendantId, {
        schedules,
        startDate,
        endDate,
      })
    }
    editableSlots.value = {}
    await loadSchedule()
    ElMessage.success('排班已保存，已同步到陪诊员工作台')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function prevWeek() {
  weekOffset.value--
  loadSchedule()
}
function nextWeek() {
  weekOffset.value++
  loadSchedule()
}
function thisWeek() {
  weekOffset.value = 0
  loadSchedule()
}

onMounted(loadSchedule)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">排班管理</h2>
        <p class="page-subtitle">按周批量设置“上午/下午”可接单时段，保存后会同步到陪诊员工作台。</p>
      </div>
      <div class="page-header__actions">
        <el-tag type="info" effect="plain">当前周：{{ currentWeekRange.label }}</el-tag>
        <div class="week-actions">
          <el-button @click="prevWeek"><el-icon><ArrowLeft /></el-icon>上一周</el-button>
          <el-button @click="thisWeek">本周</el-button>
          <el-button @click="nextWeek">下一周<el-icon><ArrowRight /></el-icon></el-button>
        </div>
        <el-button type="primary" :loading="saving" @click="saveAllSchedules">保存排班</el-button>
      </div>
    </div>

    <div class="page-guide">
      <span class="page-guide__label">流程建议</span>
      <el-tag size="small" effect="plain">1 切换目标周次</el-tag>
      <el-tag size="small" effect="plain">2 点选可接单时段</el-tag>
      <el-tag size="small" effect="plain">3 保存并同步工作台</el-tag>
    </div>

    <el-card shadow="never" v-loading="loading">
      <p class="schedule-hint">点击单元格可切换排班，保存后同步到陪诊员工作台</p>
      <el-table :data="scheduleData" highlight-current-row border v-if="scheduleData.length">
        <el-table-column label="陪诊员" width="120" fixed>
          <template #default="{ row }">
            {{ row.attendant?.realName || '—' }}
          </template>
        </el-table-column>
        <el-table-column v-for="(day, idx) in weekDays" :key="day" :label="day" align="center">
          <el-table-column label="上午" width="70" align="center">
            <template #default="{ row }">
              <span
                class="slot-cell"
                :class="{ 'slot-cell--active': isSlotChecked(row.attendantId, idx, 'am') }"
                @click="onCellClick(row.attendantId, idx, 'am')"
              >
                {{ isSlotChecked(row.attendantId, idx, 'am') ? '可' : '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="下午" width="70" align="center">
            <template #default="{ row }">
              <span
                class="slot-cell"
                :class="{ 'slot-cell--active': isSlotChecked(row.attendantId, idx, 'pm') }"
                @click="onCellClick(row.attendantId, idx, 'pm')"
              >
                {{ isSlotChecked(row.attendantId, idx, 'pm') ? '可' : '—' }}
              </span>
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无在职陪诊员，请先在陪诊员列表中添加" />
    </el-card>
  </div>
</template>

<style scoped>
.page-header {
  align-items: flex-start;
}

.week-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.schedule-hint {
  margin-bottom: 16px;
  font-size: 13px;
  color: #909399;
}
.slot-cell {
  display: inline-block;
  min-width: 32px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}
.slot-cell:hover {
  background: #f5f7fa;
}
.slot-cell--active {
  background: #67c23a;
  color: #fff;
}
.slot-cell--active:hover {
  background: #5daf34;
}
</style>
