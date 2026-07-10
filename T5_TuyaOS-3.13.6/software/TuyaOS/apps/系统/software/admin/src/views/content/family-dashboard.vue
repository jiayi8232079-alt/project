<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getFamilyGroups, getFamilyMembers, getWeeklyReportsForUser, adminBindFamily } from '@/api/family'
import { getOrderList } from '@/api/order'
import {
  getExecutions,
  checkInMedication,
  getAdherence,
} from '@/api/medication-reminder'

interface GroupRow {
  id: number
  name: string
  inviteCode: string
  memberCount: number
  createdAt: string
  creator?: { nickname?: string; phone?: string }
}

interface MemberRow {
  id?: number
  userId?: number
  nickname: string
  phone: string
  role: string
  relation: string
  joinedAt: string
  user?: { nickname?: string; phone?: string; id?: number }
}

interface FollowUp {
  orderId: number
  date: string
  hospital: string
  department: string
  note: string
  patientName: string
  daysLeft: number
  urgent: boolean
}

interface MedItem {
  name: string
  usage: string
  reminderTime: string
  endDate: string
  patientName: string
  active: boolean
}

interface ReportItem {
  orderId: number
  summary: string
  serviceDate: string
  patientName: string
  hospital: string
}

const RELATION_MAP: Record<string, string> = {
  self: '本人', parent: '父母', spouse: '配偶', child: '子女', other: '其他',
}

const loading = ref(false)
const groups = ref<GroupRow[]>([])
const totalGroups = ref(0)
const page = ref(1)

const selectedGroup = ref<GroupRow | null>(null)
const members = ref<MemberRow[]>([])
const membersLoading = ref(false)

const selectedMember = ref<MemberRow | null>(null)
const dashboardLoading = ref(false)
const activeTab = ref('followUps')

const groupKeyword = ref('')
const memberKeyword = ref('')

const followUps = ref<FollowUp[]>([])
const medications = ref<MedItem[]>([])
const reports = ref<ReportItem[]>([])
const weeklyReports = ref<any[]>([])

interface TodayExecution {
  id: number
  reminderId: number
  scheduledDate: string
  scheduledTime: string
  status: 'taken' | 'missed' | 'skipped' | 'pending'
  executedAt: string | null
  reminder?: {
    medicineName: string
    severity: 'high' | 'medium' | 'low'
    dosage: string
  }
}
const todayExecutions = ref<TodayExecution[]>([])
const todayLoading = ref(false)
const adherence = ref<{ total: number; taken: number; missed: number; adherenceRate: number } | null>(null)

const SEVERITY_STYLE = {
  high: { label: '高风险', type: 'danger' as const },
  medium: { label: '慢病', type: 'warning' as const },
  low: { label: '保健', type: 'info' as const },
}

function execStatusType(s: string): any {
  return ({
    taken: 'success', missed: 'danger', skipped: 'info', pending: 'warning',
  } as Record<string, any>)[s] || 'info'
}
function execStatusLabel(s: string): string {
  return ({
    taken: '已服', missed: '漏服', skipped: '跳过', pending: '待打卡',
  } as Record<string, string>)[s] || s
}

const stats = computed(() => ({
  followUpCount: followUps.value.length,
  activeMedCount: medications.value.length,
  reportCount: reports.value.length,
  weeklyCount: weeklyReports.value.length,
}))

const upcomingFollowUpCount = computed(() => followUps.value.filter(f => f.daysLeft >= 0).length)

const filteredGroups = computed(() => {
  const kw = groupKeyword.value.trim().toLowerCase()
  if (!kw) return groups.value
  return groups.value.filter(g =>
    (g.name || '').toLowerCase().includes(kw) ||
    (g.inviteCode || '').toLowerCase().includes(kw) ||
    (g.creator?.nickname || '').toLowerCase().includes(kw) ||
    (g.creator?.phone || '').includes(kw),
  )
})

const filteredMembers = computed(() => {
  const kw = memberKeyword.value.trim().toLowerCase()
  if (!kw) return members.value
  return members.value.filter(m =>
    (m.nickname || '').toLowerCase().includes(kw) ||
    (m.phone || '').includes(kw) ||
    (RELATION_MAP[m.relation] || m.relation || '').toLowerCase().includes(kw),
  )
})

const nearFollowUp = computed(() => followUps.value.find(f => f.daysLeft >= 0 && f.daysLeft <= 3) || null)

async function loadGroups() {
  loading.value = true
  try {
    const res: any = await getFamilyGroups({ page: page.value, pageSize: 100 })
    groups.value = res.items || []
    totalGroups.value = res.total || 0
  } catch {
    ElMessage.error('加载家庭列表失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
  loadGroups()
}

async function selectGroupRow(group: GroupRow) {
  selectedGroup.value = group
  selectedMember.value = null
  memberKeyword.value = ''
  clearDashboard()
  membersLoading.value = true
  try {
    const res: any = await getFamilyMembers(group.id)
    members.value = (Array.isArray(res) ? res : res.items || []).map((m: any) => ({
      ...m,
      userId: m.user?.id || m.userId,
      nickname: m.user?.nickname || m.nickname || '',
      phone: m.user?.phone || m.phone || '',
    }))
    if (members.value.length > 0) {
      const firstValid = members.value.find(m => m.userId) || members.value[0]
      if (firstValid) selectMemberRow(firstValid)
    }
  } catch {
    ElMessage.error('加载家庭成员失败')
  } finally {
    membersLoading.value = false
  }
}

let loadSeq = 0

async function selectMemberRow(member: MemberRow) {
  selectedMember.value = member
  activeTab.value = 'followUps'
  const seq = ++loadSeq
  if (!member.userId) {
    clearDashboard()
    dashboardLoading.value = false
    return
  }
  await loadMemberDashboard(member.userId, seq)
}

function clearDashboard() {
  followUps.value = []
  medications.value = []
  reports.value = []
  weeklyReports.value = []
  todayExecutions.value = []
  adherence.value = null
}

async function loadMemberDashboard(userId: number, seq: number) {
  dashboardLoading.value = true
  clearDashboard()
  try {
    await Promise.all([
      loadMemberOrders(userId),
      loadMemberWeekly(userId),
      loadTodayExecutions(userId),
      loadAdherenceStats(userId),
    ])
  } catch (e) {
    console.error('loadMemberDashboard error', e)
  } finally {
    if (seq === loadSeq) {
      dashboardLoading.value = false
    }
  }
}

async function loadTodayExecutions(userId: number) {
  todayLoading.value = true
  try {
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10)
    const res: any = await getExecutions({ startDate: dateStr, endDate: dateStr })
    const items: TodayExecution[] = (res?.items || []).filter((e: any) => {
      return e.reminder && e.reminder.userId === userId
    })
    todayExecutions.value = items
  } catch {
    todayExecutions.value = []
  } finally {
    todayLoading.value = false
  }
}

async function loadAdherenceStats(userId: number) {
  try {
    const res: any = await getAdherence(userId, 7)
    adherence.value = res || null
  } catch {
    adherence.value = null
  }
}

async function markExecutionStatus(
  row: TodayExecution,
  status: 'taken' | 'skipped' | 'missed',
) {
  try {
    await checkInMedication({
      reminderId: row.reminderId,
      scheduledDate: String(row.scheduledDate).split('T')[0],
      scheduledTime: row.scheduledTime,
      status,
    })
    ElMessage.success('已代打卡')
    if (selectedMember.value?.userId) {
      await loadTodayExecutions(selectedMember.value.userId)
      await loadAdherenceStats(selectedMember.value.userId)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '打卡失败')
  }
}

const todayStats = computed(() => {
  const s = { taken: 0, missed: 0, pending: 0, skipped: 0, total: 0 }
  for (const e of todayExecutions.value) {
    ;(s as any)[e.status] = (s as any)[e.status] + 1
    s.total += 1
  }
  return s
})

async function loadMemberOrders(userId: number) {
  try {
    const res: any = await getOrderList({
      userId,
      status: 'completed,pending_review',
      pageSize: 100,
      page: 1,
    })
    const orders: any[] = res?.items || []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const fups: FollowUp[] = []
    const meds: MedItem[] = []
    const reps: ReportItem[] = []

    for (const order of orders) {
      const comp = order.completionData || {}
      const patientName = order.serviceTarget?.name || order.patientName || ''
      const hospital = order.hospital || ''

      if (comp.summary) {
        reps.push({
          orderId: order.id,
          summary: comp.summary,
          serviceDate: order.serviceTime ? new Date(order.serviceTime).toLocaleDateString('zh-CN') : '',
          patientName,
          hospital,
        })
      }

      if (comp.followUpDate) {
        const fDate = new Date(comp.followUpDate)
        const diff = Math.ceil((fDate.getTime() - today.getTime()) / 86400000)
        fups.push({
          orderId: order.id,
          date: comp.followUpDate,
          hospital: comp.followUpHospital || hospital,
          department: comp.followUpDepartment || '',
          note: comp.followUpNote || '',
          patientName,
          daysLeft: diff,
          urgent: diff >= 0 && diff <= 3,
        })
      }

      const medList: any[] = comp.medications || []
      for (const med of medList) {
        if (!med.name) continue
        const endDate = med.endDate ? new Date(med.endDate) : null
        const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : 999
        meds.push({
          name: med.name,
          usage: med.usage || '',
          reminderTime: med.reminderTime || '',
          endDate: med.endDate || '',
          patientName,
          active: !endDate || daysLeft >= 0,
        })
      }
    }

    fups.sort((a, b) => {
      const aFuture = a.daysLeft >= 0
      const bFuture = b.daysLeft >= 0
      if (aFuture !== bFuture) return aFuture ? -1 : 1
      if (aFuture) return a.daysLeft - b.daysLeft
      return b.daysLeft - a.daysLeft
    })
    followUps.value = fups
    medications.value = meds
    reports.value = reps
  } catch (e) {
    console.error('加载订单数据失败', e)
  }
}

async function loadMemberWeekly(userId: number) {
  try {
    const res: any = await getWeeklyReportsForUser(userId, { pageSize: 10 })
    weeklyReports.value = res?.items || res || []
  } catch {
    weeklyReports.value = []
  }
}

function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function formatDateOnly(t: string) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysLeftText(d: number) {
  if (d === 0) return '今天'
  if (d > 0) return `${d}天后`
  return '已过期'
}

const bindVisible = ref(false)
const bindSaving = ref(false)
const bindForm = ref({ guardianUserId: '', memberUserId: '', relation: 'parent', familyName: '' })

function openBindDialog() {
  bindForm.value = { guardianUserId: '', memberUserId: '', relation: 'parent', familyName: '' }
  bindVisible.value = true
}

async function submitBind() {
  if (!bindForm.value.guardianUserId || !bindForm.value.memberUserId || !bindForm.value.familyName) {
    ElMessage.warning('请填写完整信息')
    return
  }
  bindSaving.value = true
  try {
    await adminBindFamily({
      guardianUserId: Number(bindForm.value.guardianUserId),
      memberUserId: Number(bindForm.value.memberUserId),
      relation: bindForm.value.relation,
      familyName: bindForm.value.familyName,
    })
    ElMessage.success('绑定成功')
    bindVisible.value = false
    await loadGroups()
  } catch (e: any) {
    ElMessage.error(e?.message || '绑定失败')
  } finally {
    bindSaving.value = false
  }
}

onMounted(loadGroups)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">家庭健康看板（归档视图）</h2>
        <p class="page-subtitle">选择家庭 → 选择成员 → 查看健康数据概览（复诊、用药、报告、周报）。</p>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="$router.push('/customer-center/customers')">前往客户中心</el-button>
        <el-button @click="openBindDialog">
          <el-icon><Plus /></el-icon>手动绑定家庭
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom:12px;"
      title="本页已合并至「客户中心 > 客户详情 > 家庭 & 成员档案」"
      description="进入客户详情即可在一处查看该客户名下全部家庭、家庭成员以及每位成员的健康档案、就医记录、用药复诊与相关订单。原家庭看板仅保留供归档检索。" />

    <div class="fhd-layout">
      <!-- 左侧：家庭 & 成员 -->
      <div class="fhd-sidebar">
        <el-card shadow="never" class="fhd-card">
          <template #header>
            <div class="fhd-card-head">
              <span class="fhd-card-title">家庭列表</span>
              <el-tag size="small">{{ totalGroups }}个</el-tag>
            </div>
          </template>
          <el-input
            v-model="groupKeyword"
            size="small"
            clearable
            placeholder="搜索家庭名称 / 邀请码 / 管理者"
            class="fhd-search"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div v-loading="loading">
            <div
              v-for="g in filteredGroups"
              :key="g.id"
              class="fhd-group-row"
              :class="{ 'fhd-group-row--active': selectedGroup?.id === g.id }"
              @click="selectGroupRow(g)"
            >
              <div class="fhd-group-name">{{ g.name }}</div>
              <div class="fhd-group-meta">
                <el-tag size="small" type="info">{{ g.inviteCode }}</el-tag>
                <span>{{ g.memberCount }}人</span>
              </div>
            </div>
            <el-empty
              v-if="filteredGroups.length === 0 && !loading"
              :description="groupKeyword ? '没有匹配的家庭' : '暂无家庭'"
              :image-size="60"
            />
          </div>
          <div class="fhd-pager" v-if="totalGroups > 100">
            <el-pagination
              small
              layout="prev, pager, next"
              :page-size="100"
              :total="totalGroups"
              v-model:current-page="page"
              @current-change="handlePageChange"
            />
          </div>
        </el-card>

        <el-card shadow="never" class="fhd-card" v-if="selectedGroup">
          <template #header>
            <div class="fhd-card-head">
              <span class="fhd-card-title">{{ selectedGroup.name }} · 成员</span>
              <el-tag size="small">{{ members.length }}人</el-tag>
            </div>
          </template>
          <el-input
            v-if="members.length > 3"
            v-model="memberKeyword"
            size="small"
            clearable
            placeholder="搜索昵称 / 关系 / 手机"
            class="fhd-search"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div v-loading="membersLoading">
            <div
              v-for="(m, idx) in filteredMembers"
              :key="m.id || `member-${idx}-${m.userId || m.nickname}`"
              class="fhd-member-row"
              :class="{ 'fhd-member-row--active': selectedMember === m }"
              @click="selectMemberRow(m)"
            >
              <div class="fhd-member-avatar">{{ (m.nickname || '?')[0] }}</div>
              <div class="fhd-member-info">
                <div class="fhd-member-name">{{ m.nickname || '-' }}</div>
                <div class="fhd-member-meta">
                  <el-tag size="small" :type="m.role === 'guardian' ? 'success' : 'info'">{{ m.role === 'guardian' ? '管理者' : '成员' }}</el-tag>
                  <span>{{ RELATION_MAP[m.relation] || m.relation }}</span>
                </div>
              </div>
            </div>
            <el-empty
              v-if="filteredMembers.length === 0 && !membersLoading"
              :description="memberKeyword ? '没有匹配的成员' : '暂无成员'"
              :image-size="50"
            />
          </div>
        </el-card>
      </div>

      <!-- 右侧：健康看板 -->
      <div class="fhd-main">
        <template v-if="!selectedMember">
          <el-card shadow="never" class="fhd-placeholder">
            <el-empty description="请先在左侧选择一个家庭成员" :image-size="80" />
          </el-card>
        </template>

        <template v-else>
          <!-- 概览统计 -->
          <div class="fhd-overview">
            <div class="fhd-overview-header">
              <div class="fhd-overview-who">
                <div class="fhd-big-avatar">{{ (selectedMember.nickname || '?')[0] }}</div>
                <div>
                  <div class="fhd-overview-name">{{ selectedMember.nickname }} 的健康看板</div>
                  <div class="fhd-overview-sub">{{ selectedGroup?.name }} · {{ RELATION_MAP[selectedMember.relation] || selectedMember.relation }}</div>
                </div>
              </div>
            </div>

            <div class="fhd-stats-grid" v-loading="dashboardLoading">
              <div class="fhd-stat-card" :class="{ 'fhd-stat-card--warn': upcomingFollowUpCount > 0 }" @click="activeTab = 'followUps'">
                <div class="fhd-stat-num">{{ stats.followUpCount }}</div>
                <div class="fhd-stat-label">待复诊</div>
              </div>
              <div class="fhd-stat-card" @click="activeTab = 'medications'">
                <div class="fhd-stat-num">{{ stats.activeMedCount }}</div>
                <div class="fhd-stat-label">在用药品</div>
              </div>
              <div class="fhd-stat-card" @click="activeTab = 'reports'">
                <div class="fhd-stat-num">{{ stats.reportCount }}</div>
                <div class="fhd-stat-label">服务报告</div>
              </div>
              <div class="fhd-stat-card" @click="activeTab = 'weekly'">
                <div class="fhd-stat-num">{{ stats.weeklyCount }}</div>
                <div class="fhd-stat-label">AI周报</div>
              </div>
            </div>

            <!-- 未绑定账号提醒 -->
            <el-alert
              v-if="!selectedMember.userId"
              type="info"
              :closable="false"
              show-icon
              class="fhd-urgent"
              title="该成员未绑定小程序账号，暂无健康数据"
              description="仅登录过陪了个伴小程序的家庭成员才会产生健康数据（复诊/用药/报告）。" />

            <!-- 紧急提醒 -->
            <el-alert
              v-if="nearFollowUp"
              type="warning"
              :closable="false"
              show-icon
              class="fhd-urgent"
            >
              <template #title>
                <strong>{{ nearFollowUp.patientName }}</strong> {{ daysLeftText(nearFollowUp.daysLeft) }}需要复诊 — {{ nearFollowUp.hospital }} {{ nearFollowUp.department }}
              </template>
            </el-alert>
          </div>

          <!-- Tab 面板 -->
          <el-card shadow="never" class="fhd-card fhd-tab-card">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="复诊安排" name="followUps">
                <el-table :data="followUps" v-loading="dashboardLoading" empty-text="暂无复诊安排">
                  <el-table-column label="复诊日期" width="130">
                    <template #default="{ row }">{{ formatDateOnly(row.date) }}</template>
                  </el-table-column>
                  <el-table-column label="服务对象" width="100" prop="patientName" />
                  <el-table-column label="医院 / 科室" min-width="180">
                    <template #default="{ row }">{{ row.hospital }} {{ row.department }}</template>
                  </el-table-column>
                  <el-table-column label="状态" width="110" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.daysLeft < 0 ? 'info' : row.urgent ? 'warning' : 'success'" size="small">
                        {{ daysLeftText(row.daysLeft) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="备注" prop="note" min-width="120" show-overflow-tooltip />
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="今日打卡" name="todayCheckIn">
                <div v-loading="todayLoading">
                  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
                    <el-tag type="success" effect="plain">今日已服 {{ todayStats.taken }} / {{ todayStats.total }}</el-tag>
                    <el-tag v-if="todayStats.missed > 0" type="danger" effect="plain">漏服 {{ todayStats.missed }}</el-tag>
                    <el-tag v-if="todayStats.pending > 0" type="warning" effect="plain">待打卡 {{ todayStats.pending }}</el-tag>
                    <el-tag v-if="todayStats.skipped > 0" type="info" effect="plain">跳过 {{ todayStats.skipped }}</el-tag>
                    <div style="flex:1;"></div>
                    <el-tag
                      v-if="adherence"
                      :type="adherence.adherenceRate < 0.7 ? 'danger' : adherence.adherenceRate < 0.9 ? 'warning' : 'success'"
                      effect="plain"
                    >
                      近 7 天依从率 {{ Math.round(adherence.adherenceRate * 100) }}%
                    </el-tag>
                  </div>
                  <el-alert
                    v-if="todayStats.missed > 0"
                    type="error"
                    :closable="false"
                    show-icon
                    style="margin-bottom: 10px;"
                    title="今日已有漏服，升级链会在达到阈值后自动通知家属与管理员"
                  />
                  <el-table :data="todayExecutions" empty-text="今日无用药计划">
                    <el-table-column label="时间" width="90" prop="scheduledTime" />
                    <el-table-column label="药品" min-width="150">
                      <template #default="{ row }">
                        <div>{{ row.reminder?.medicineName || '—' }}</div>
                        <div style="font-size:12px; color:#999;">{{ row.reminder?.dosage || '' }}</div>
                      </template>
                    </el-table-column>
                    <el-table-column label="严重度" width="90">
                      <template #default="{ row }">
                        <el-tag
                          :type="SEVERITY_STYLE[((row.reminder?.severity) || 'medium') as keyof typeof SEVERITY_STYLE].type"
                          size="small"
                          effect="plain"
                        >
                          {{ SEVERITY_STYLE[((row.reminder?.severity) || 'medium') as keyof typeof SEVERITY_STYLE].label }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="打卡状态" width="100">
                      <template #default="{ row }">
                        <el-tag :type="execStatusType(row.status)" size="small">{{ execStatusLabel(row.status) }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="实际打卡" width="160">
                      <template #default="{ row }">
                        <span v-if="row.executedAt">{{ (row.executedAt || '').replace('T', ' ').slice(0, 16) }}</span>
                        <span v-else style="color: #999;">—</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="代打卡" width="210">
                      <template #default="{ row }">
                        <el-button size="small" type="success" link @click="markExecutionStatus(row, 'taken')">已服</el-button>
                        <el-button size="small" type="info" link @click="markExecutionStatus(row, 'skipped')">跳过</el-button>
                        <el-button size="small" type="danger" link @click="markExecutionStatus(row, 'missed')">漏服</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </el-tab-pane>

              <el-tab-pane label="用药管理" name="medications">
                <el-table :data="medications" v-loading="dashboardLoading" empty-text="暂无用药记录">
                  <el-table-column label="药品名称" min-width="120" prop="name" />
                  <el-table-column label="用法用量" min-width="160" prop="usage" show-overflow-tooltip />
                  <el-table-column label="提醒时间" width="100" prop="reminderTime" />
                  <el-table-column label="截止日期" width="120">
                    <template #default="{ row }">{{ formatDateOnly(row.endDate) || '长期' }}</template>
                  </el-table-column>
                  <el-table-column label="服务对象" width="100" prop="patientName" />
                  <el-table-column label="状态" width="90" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '服用中' : '已结束' }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="服务报告" name="reports">
                <el-table :data="reports" v-loading="dashboardLoading" empty-text="暂无服务报告">
                  <el-table-column label="服务对象" width="100" prop="patientName" />
                  <el-table-column label="医院" width="160" prop="hospital" show-overflow-tooltip />
                  <el-table-column label="服务日期" width="120" prop="serviceDate" />
                  <el-table-column label="总结" min-width="240" prop="summary" show-overflow-tooltip />
                  <el-table-column label="操作" width="100" align="center">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="$router.push(`/service/orders/detail/${row.orderId}`)">查看</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="AI健康周报" name="weekly">
                <el-table :data="weeklyReports" v-loading="dashboardLoading" empty-text="暂无健康周报">
                  <el-table-column label="标题" min-width="160">
                    <template #default="{ row }">{{ row.title || 'AI 健康周报' }}</template>
                  </el-table-column>
                  <el-table-column label="周期" width="200">
                    <template #default="{ row }">{{ row.periodStart }} ~ {{ row.periodEnd }}</template>
                  </el-table-column>
                  <el-table-column label="摘要" min-width="200" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.summary || '-' }}</template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </template>
      </div>
    </div>

    <!-- 手动绑定家庭 -->
    <el-dialog v-model="bindVisible" title="手动绑定家庭关系" width="500px">
      <el-form label-width="120px">
        <el-form-item label="家庭名称">
          <el-input v-model="bindForm.familyName" placeholder="如：张家" />
        </el-form-item>
        <el-form-item label="管理者用户ID">
          <el-input v-model="bindForm.guardianUserId" placeholder="子女（或管理者）的用户 ID" />
        </el-form-item>
        <el-form-item label="成员用户ID">
          <el-input v-model="bindForm.memberUserId" placeholder="父母（或成员）的用户 ID" />
        </el-form-item>
        <el-form-item label="成员关系">
          <el-select v-model="bindForm.relation" style="width: 100%;">
            <el-option label="父母" value="parent" />
            <el-option label="配偶" value="spouse" />
            <el-option label="子女" value="child" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="bindSaving" @click="submitBind">确认绑定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.fhd-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.fhd-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fhd-main {
  flex: 1;
  min-width: 0;
}

.fhd-card {
  border-radius: 14px;
}

.fhd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fhd-card-title {
  font-weight: 700;
  font-size: 15px;
}

.fhd-search {
  margin-bottom: 10px;
}

.fhd-group-row {
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;
  &:hover { background: #f8fafc; }
  &--active { background: #eff6ff; border: 1px solid #3b82f6; }
}

.fhd-group-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
}

.fhd-group-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.fhd-member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  &:hover { background: #f8fafc; }
  &--active { background: #f0fdf4; border: 1px solid #22c55e; }
}

.fhd-member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.fhd-member-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
}

.fhd-member-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}

.fhd-placeholder {
  border-radius: 14px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fhd-overview {
  margin-bottom: 16px;
}

.fhd-overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.fhd-overview-who {
  display: flex;
  align-items: center;
  gap: 14px;
}

.fhd-big-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 20px;
}

.fhd-overview-name {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.fhd-overview-sub {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 2px;
}

.fhd-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.fhd-stat-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f1f5f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  &--warn {
    border-color: #fcd34d;
    background: #fffbeb;
  }
}

.fhd-stat-num {
  font-size: 28px;
  font-weight: 800;
  color: #1e293b;
}

.fhd-stat-label {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
}

.fhd-urgent {
  margin-bottom: 16px;
  border-radius: 10px;
}

.fhd-tab-card {
  border-radius: 14px;
}

.fhd-pager {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

@media (max-width: 900px) {
  .fhd-layout {
    flex-direction: column;
  }
  .fhd-sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .fhd-sidebar .fhd-card {
    flex: 1;
    min-width: 280px;
  }
  .fhd-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
