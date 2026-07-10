<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Clock, FirstAidKit, Tickets, View, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  getServiceTargetDetail,
  getServiceTargetHistory,
  getWeeklyReportsForUser,
} from '@/api/family'
import { getReminders } from '@/api/medication-reminder'
import { getOrderList } from '@/api/order'
import { formatDate, orderStatusMap } from '@/utils/format'

interface MemberLike {
  id?: number
  userId?: number | null
  role?: string
  relation?: string
  nickname?: string
  placeholderName?: string
  placeholderPhone?: string
  isElder?: boolean
  isPlaceholder?: boolean
  user?: { id?: number; nickname?: string; phone?: string } | null
  serviceTarget?: {
    id: number
    name?: string
    isTrust?: boolean
    delegatorRelation?: string
  } | null
}

// 解析 healthProfile 可能是字符串或对象
function parseHealthProfileRaw(raw: any): Record<string, any> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw as Record<string, any>
}

const props = defineProps<{
  member: MemberLike | null
  familyName?: string
}>()

const router = useRouter()
const activeTab = ref<'profile' | 'history' | 'reminders' | 'orders' | 'weekly'>('profile')

const serviceTarget = ref<any>(null)
const profileLoading = ref(false)

const history = ref<any[]>([])
const historyLoading = ref(false)

const reminders = ref<any[]>([])
const remindersLoading = ref(false)

const orders = ref<any[]>([])
const ordersLoading = ref(false)

const weeklyReports = ref<any[]>([])
const weeklyLoading = ref(false)

const MEDICAL_HISTORY_LABEL: Record<string, string> = {
  hypertension: '高血压',
  heart: '心脏病',
  cerebrovascular: '脑血管疾病',
  diabetes: '糖尿病',
  epilepsy: '癫痫',
  asthma: '哮喘/慢阻肺',
  mental: '精神类疾病',
  cancer: '癌症',
  other: '其他',
}
const RECENT_SYMPTOM_LABEL: Record<string, string> = {
  syncope: '晕厥/眩晕/跌倒',
  chest_pain: '胸痛/胸闷/心慌',
  dyspnea: '呼吸困难',
  fatigue: '乏力/疲劳',
  pain: '持续性疼痛',
  insomnia: '失眠/睡眠障碍',
  appetite_loss: '食欲下降',
  other: '其他',
}
const RELATIONSHIP_LABEL: Record<string, string> = {
  self: '本人',
  father: '父亲',
  mother: '母亲',
  parent: '父母',
  spouse: '配偶',
  child: '子女',
  sibling: '兄弟姐妹',
  other: '其他',
}
const GENDER_LABEL: Record<string, string> = {
  male: '男',
  female: '女',
}

const memberName = computed(() => {
  if (!props.member) return ''
  return (
    props.member.nickname
    || props.member.user?.nickname
    || props.member.placeholderName
    || '（未命名成员）'
  )
})

const memberPhone = computed(() => {
  if (!props.member) return ''
  return props.member.user?.phone || props.member.placeholderPhone || ''
})

const targetId = computed(() => props.member?.serviceTarget?.id || null)

const memberUserId = computed<number | null>(() => {
  const uid = props.member?.user?.id ?? props.member?.userId
  return uid != null ? Number(uid) : null
})

const healthProfile = computed(() => parseHealthProfileRaw(serviceTarget.value?.healthProfile))

// 是否是"本人档案"：guardian 成员 + 关联的档案 relationship === 'self'
const isSelfProfile = computed(() => {
  if (!props.member || props.member.role !== 'guardian') return false
  const hp = healthProfile.value
  return hp?.relationship === 'self'
})

function formatMedicalHistory(list: string[] | undefined) {
  if (!list?.length) return '无'
  const filtered = list.filter((v) => v && v !== 'none')
  if (!filtered.length) return '无'
  return filtered.map((v) => MEDICAL_HISTORY_LABEL[v] || v).join('、')
}

function formatRecentSymptoms(list: string[] | undefined, other?: string) {
  if (!list?.length) return '无明显症状'
  const filtered = list.filter((v) => v && v !== 'none')
  if (!filtered.length) return '无明显症状'
  const text = filtered.map((v) => RECENT_SYMPTOM_LABEL[v] || v).join('、')
  return other ? `${text}（${other}）` : text
}

async function loadProfile() {
  if (!targetId.value) {
    serviceTarget.value = null
    return
  }
  profileLoading.value = true
  try {
    serviceTarget.value = await getServiceTargetDetail(targetId.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载健康档案失败')
    serviceTarget.value = null
  } finally {
    profileLoading.value = false
  }
}

async function loadHistory() {
  if (!targetId.value) {
    history.value = []
    return
  }
  historyLoading.value = true
  try {
    const res: any = await getServiceTargetHistory(targetId.value)
    history.value = Array.isArray(res) ? res : []
  } catch {
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

async function loadReminders() {
  if (!targetId.value) {
    reminders.value = []
    return
  }
  remindersLoading.value = true
  try {
    const res: any = await getReminders({ serviceTargetId: targetId.value, pageSize: 100 })
    reminders.value = res?.items || (Array.isArray(res) ? res : [])
  } catch {
    reminders.value = []
  } finally {
    remindersLoading.value = false
  }
}

async function loadOrders() {
  if (!targetId.value) {
    orders.value = []
    return
  }
  ordersLoading.value = true
  try {
    const res: any = await getOrderList({ serviceTargetId: targetId.value, pageSize: 50 })
    orders.value = res?.items || (Array.isArray(res) ? res : [])
  } catch {
    orders.value = []
  } finally {
    ordersLoading.value = false
  }
}

async function loadWeekly() {
  if (!memberUserId.value) {
    weeklyReports.value = []
    return
  }
  weeklyLoading.value = true
  try {
    const res: any = await getWeeklyReportsForUser(memberUserId.value, { pageSize: 10 })
    weeklyReports.value = res?.items || (Array.isArray(res) ? res : [])
  } catch {
    weeklyReports.value = []
  } finally {
    weeklyLoading.value = false
  }
}

function reloadAll() {
  if (!targetId.value) return
  loadProfile()
  if (activeTab.value === 'history') loadHistory()
  if (activeTab.value === 'reminders') loadReminders()
  if (activeTab.value === 'orders') loadOrders()
  if (activeTab.value === 'weekly') loadWeekly()
}

function handleTabChange(tab: string | number) {
  activeTab.value = tab as any
  if (tab === 'history' && !history.value.length) loadHistory()
  if (tab === 'reminders' && !reminders.value.length) loadReminders()
  if (tab === 'orders' && !orders.value.length) loadOrders()
  if (tab === 'weekly' && !weeklyReports.value.length) loadWeekly()
}

function goOrderDetail(orderId: number) {
  router.push(`/service/orders/detail/${orderId}`)
}

watch(
  () => props.member?.id,
  () => {
    activeTab.value = 'profile'
    serviceTarget.value = null
    history.value = []
    reminders.value = []
    orders.value = []
    weeklyReports.value = []
    if (targetId.value) loadProfile()
  },
  { immediate: true },
)

function reminderTypeText(type?: string) {
  if (type === 'follow_up') return '复诊提醒'
  return '用药提醒'
}

function reminderStatusType(status?: string) {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  if (status === 'completed') return 'info'
  return 'info'
}
</script>

<template>
  <div class="fm-profile">
    <el-empty v-if="!member" description="请从左侧选择一个家庭成员" :image-size="80" />

    <template v-else>
      <!-- 成员头部 -->
      <div class="fm-head">
        <el-avatar :size="52" class="fm-head__avatar">{{ memberName.slice(0, 1) }}</el-avatar>
        <div class="fm-head__info">
          <div class="fm-head__title">
            <span class="fm-head__name">{{ memberName }}</span>
            <el-tag size="small" :type="member.role === 'guardian' ? 'success' : 'info'">
              {{ member.role === 'guardian' ? '管理者' : (member.isElder ? '老人' : '成员') }}
            </el-tag>
            <el-tag v-if="member.isPlaceholder" size="small" type="warning" effect="plain">待登录</el-tag>
            <el-tag v-else size="small" type="success" effect="plain">已登录</el-tag>
          </div>
          <div class="fm-head__meta">
            <span v-if="memberPhone">{{ memberPhone }}</span>
            <span v-if="familyName">所属家庭：{{ familyName }}</span>
            <span v-if="member.serviceTarget">健康档案：{{ member.serviceTarget.name }}</span>
          </div>
        </div>
        <div class="fm-head__actions">
          <el-button size="small" :icon="Refresh" @click="reloadAll" :disabled="!targetId">刷新</el-button>
        </div>
      </div>

      <el-alert
        v-if="!targetId && member.role === 'guardian'"
        type="warning"
        :closable="false"
        show-icon
        style="margin:12px 0;"
        title="本人尚未建立健康档案"
        description="请点击上方「新增档案」按钮，创建关系为「本人」的档案，系统会自动挂到本家庭的管理者下。" />
      <el-alert
        v-else-if="!targetId"
        type="info"
        :closable="false"
        show-icon
        style="margin:12px 0;"
        title="该成员尚未建立健康档案"
        description="可以让客户在小程序「家庭健康 → 添加成员」或在客户详情页「新增家庭成员」中建档，建档后即可在此查看。" />

      <el-tabs v-else v-model="activeTab" class="fm-tabs" @tab-change="handleTabChange">
        <!-- ① 健康档案 -->
        <el-tab-pane name="profile">
          <template #label>
            <span><el-icon><FirstAidKit /></el-icon> 健康档案</span>
          </template>
          <div v-loading="profileLoading">
            <div v-if="serviceTarget" class="fm-profile-block">
              <div class="fm-profile-block__head">
                <div>
                  <span class="fm-profile-block__title">{{ serviceTarget.name }}</span>
                  <el-tag
                    v-if="isSelfProfile"
                    size="small"
                    type="primary"
                    effect="dark"
                    style="margin-left:8px;"
                  >本人档案</el-tag>
                  <el-tag
                    v-if="serviceTarget.isTrust"
                    size="small"
                    type="success"
                    effect="plain"
                    style="margin-left:8px;"
                  >已签署委托</el-tag>
                  <el-tag
                    v-else-if="serviceTarget.delegatorRelation === 'child'"
                    size="small"
                    type="danger"
                    effect="plain"
                    style="margin-left:8px;"
                  >待子女签署</el-tag>
                </div>
              </div>
              <el-descriptions
                :column="2"
                border
                size="small"
                class="fm-profile-desc"
                label-width="110px"
                :label-style="{ width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }"
              >
                <el-descriptions-item label="姓名">{{ serviceTarget.name || '—' }}</el-descriptions-item>
                <el-descriptions-item label="与客户关系">
                  {{ RELATIONSHIP_LABEL[healthProfile?.relationship] || RELATIONSHIP_LABEL[serviceTarget.relationship] || serviceTarget.relationship || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="性别">{{ GENDER_LABEL[serviceTarget.gender] || serviceTarget.gender || '—' }}</el-descriptions-item>
                <el-descriptions-item label="出生日期">{{ serviceTarget.birthDate ? String(serviceTarget.birthDate).slice(0, 10) : '—' }}</el-descriptions-item>
                <el-descriptions-item label="手机号">{{ serviceTarget.phone || '—' }}</el-descriptions-item>
                <el-descriptions-item label="身份证号">{{ serviceTarget.idCard || '—' }}</el-descriptions-item>
                <el-descriptions-item label="身高体重">
                  {{ healthProfile?.height ? healthProfile.height + 'cm' : '—' }} / {{ healthProfile?.weight ? healthProfile.weight + 'kg' : '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="血型">{{ healthProfile?.bloodType || '—' }}</el-descriptions-item>
                <el-descriptions-item label="家庭住址" :span="2">
                  <div class="hp-text-wrap">{{ serviceTarget.homeAddress || '—' }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="过敏史" :span="2">
                  <div class="hp-text-wrap">{{ healthProfile?.allergies || '无' }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="既往病史" :span="2">
                  <div class="hp-text-wrap">{{ formatMedicalHistory(healthProfile?.medicalHistory) }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="近期症状" :span="2">
                  <div class="hp-text-wrap">{{ formatRecentSymptoms(healthProfile?.recentSymptoms, healthProfile?.recentSymptomsOther) }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="当前用药" :span="2">
                  <div class="hp-text-wrap">{{ healthProfile?.currentMedications || healthProfile?.currentMedication || '无' }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="就医诉求" :span="2">
                  <div class="hp-text-wrap">{{ serviceTarget.mainAppeal || '—' }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="其他说明" :span="2">
                  <div class="hp-text-wrap">{{ healthProfile?.otherHealthInfo || '—' }}</div>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>
        </el-tab-pane>

        <!-- ② 就医记录 -->
        <el-tab-pane name="history">
          <template #label>
            <span><el-icon><Tickets /></el-icon> 就医记录 ({{ history.length }})</span>
          </template>
          <div v-loading="historyLoading" class="fm-history">
            <el-empty v-if="!history.length && !historyLoading" description="暂无就诊记录" :image-size="80" />
            <el-timeline v-else>
              <el-timeline-item
                v-for="rec in history"
                :key="rec.id"
                :timestamp="`${rec.dateShort || ''} ${rec.timeSlot || ''}`"
                placement="top"
              >
                <el-card shadow="never" class="fm-history__card">
                  <div class="fm-history__row">
                    <div class="fm-history__hospital">
                      <strong>{{ rec.hospital || '—' }}</strong>
                      <span v-if="rec.department" style="margin-left:8px;color:#666;">{{ rec.department }}</span>
                    </div>
                    <el-button size="small" type="primary" link :icon="View" @click="goOrderDetail(rec.id)">
                      查看订单
                    </el-button>
                  </div>
                  <div class="fm-history__meta">
                    <span>就诊医生：{{ rec.doctor || '—' }}</span>
                    <span>诊断：{{ rec.diagnosis || '—' }}</span>
                  </div>
                  <div v-if="rec.summary" class="fm-history__summary">{{ rec.summary }}</div>
                </el-card>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-tab-pane>

        <!-- ③ 用药与复诊 -->
        <el-tab-pane name="reminders">
          <template #label>
            <span><el-icon><Clock /></el-icon> 用药/复诊 ({{ reminders.length }})</span>
          </template>
          <div v-loading="remindersLoading">
            <el-empty v-if="!reminders.length && !remindersLoading" description="暂无提醒" :image-size="80" />
            <el-table v-else :data="reminders" size="small" border>
              <el-table-column label="类型" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.reminderType === 'follow_up' ? 'warning' : 'primary'" effect="plain">
                    {{ reminderTypeText(row.reminderType) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="名称 / 医院" min-width="180">
                <template #default="{ row }">
                  <div style="font-weight:500;">{{ row.medicineName || '—' }}</div>
                  <div v-if="row.followUpHospital" style="font-size:12px;color:#999;">
                    {{ row.followUpHospital }} {{ row.followUpDepartment || '' }}
                  </div>
                  <div v-else-if="row.dosage" style="font-size:12px;color:#999;">{{ row.dosage }}</div>
                </template>
              </el-table-column>
              <el-table-column label="开始 / 结束" width="180">
                <template #default="{ row }">
                  <div>{{ row.startDate ? String(row.startDate).slice(0, 10) : '—' }}</div>
                  <div style="font-size:12px;color:#999;">{{ row.endDate ? String(row.endDate).slice(0, 10) : '长期' }}</div>
                </template>
              </el-table-column>
              <el-table-column label="提醒时间" width="160">
                <template #default="{ row }">
                  <span>{{ Array.isArray(row.reminderTimes) ? row.reminderTimes.join(' / ') : '—' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="reminderStatusType(row.status)">
                    {{ row.status === 'active' ? '进行中' : (row.status === 'paused' ? '已暂停' : (row.status === 'completed' ? '已完成' : row.status)) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- ④ 相关订单 -->
        <el-tab-pane name="orders">
          <template #label>
            <span><el-icon><Document /></el-icon> 相关订单 ({{ orders.length }})</span>
          </template>
          <div v-loading="ordersLoading">
            <el-empty v-if="!orders.length && !ordersLoading" description="暂无订单" :image-size="80" />
            <el-table v-else :data="orders" size="small" border @row-click="(r: any) => goOrderDetail(r.id)" class="fm-orders-table">
              <el-table-column label="订单号" prop="orderNo" min-width="150" />
              <el-table-column label="服务时间" width="170">
                <template #default="{ row }">
                  <span>{{ row.serviceTime ? formatDate(row.serviceTime, 'YYYY-MM-DD HH:mm') : '—' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="医院 / 科室" min-width="180">
                <template #default="{ row }">
                  <div>{{ row.hospital || '—' }}</div>
                  <div v-if="row.department" style="font-size:12px;color:#999;">{{ row.department }}</div>
                </template>
              </el-table-column>
              <el-table-column label="陪诊员" width="110">
                <template #default="{ row }">{{ row.attendant?.realName || row.attendant?.name || '—' }}</template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag size="small" :type="(orderStatusMap[row.status]?.type as any) || 'info'">
                    {{ orderStatusMap[row.status]?.label || row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="90" align="center">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click.stop="goOrderDetail(row.id)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- ⑤ AI 健康周报 -->
        <el-tab-pane name="weekly">
          <template #label>
            <span><el-icon><DataLine /></el-icon> AI 周报 ({{ weeklyReports.length }})</span>
          </template>
          <el-empty
            v-if="!memberUserId"
            description="该成员未绑定登录账号，暂无 AI 健康周报"
            :image-size="80" />
          <div v-else v-loading="weeklyLoading">
            <el-empty
              v-if="!weeklyReports.length && !weeklyLoading"
              description="暂无健康周报"
              :image-size="80" />
            <el-table v-else :data="weeklyReports" size="small" border>
              <el-table-column label="标题" min-width="160">
                <template #default="{ row }">{{ row.title || 'AI 健康周报' }}</template>
              </el-table-column>
              <el-table-column label="周期" width="220">
                <template #default="{ row }">
                  {{ row.periodStart ? String(row.periodStart).slice(0, 10) : '—' }}
                  ~
                  {{ row.periodEnd ? String(row.periodEnd).slice(0, 10) : '—' }}
                </template>
              </el-table-column>
              <el-table-column label="摘要" min-width="200" show-overflow-tooltip>
                <template #default="{ row }">{{ row.summary || '-' }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.fm-profile {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.fm-head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 4px 14px;
  border-bottom: 1px solid #f2f3f5;

  &__avatar {
    background: linear-gradient(135deg, #3b82f6, #06b6d4);
    color: #fff;
    font-weight: 600;
    font-size: 18px;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__name {
    font-size: 17px;
    font-weight: 600;
    color: #1f2937;
  }

  &__meta {
    display: flex;
    gap: 16px;
    color: #6b7280;
    font-size: 13px;
    flex-wrap: wrap;
  }
}

.fm-tabs {
  margin-top: 12px;

  :deep(.el-tabs__item) {
    .el-icon {
      margin-right: 4px;
      vertical-align: -2px;
    }
  }
}

.fm-profile-block {
  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  &__title {
    font-weight: 600;
    font-size: 15px;
  }
}

.hp-text-wrap {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
  max-width: 100%;
  overflow-wrap: break-word;
}

.fm-profile-desc {
  :deep(.el-descriptions__label) {
    background: #f8fafc !important;
    color: #475569 !important;
    font-weight: 600 !important;
    vertical-align: top;
    padding-top: 10px !important;
  }

  :deep(.el-descriptions__content) {
    color: #1f2937;
    line-height: 1.65;
    padding: 10px 14px !important;
  }

  :deep(.el-descriptions__cell) {
    word-break: break-all;
  }
}

.fm-history {
  padding: 8px 4px;

  &__card {
    border: 1px solid #eef1f4;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  &__hospital {
    color: #1f2937;
  }

  &__meta {
    color: #6b7280;
    font-size: 13px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  &__summary {
    margin-top: 6px;
    padding: 8px 10px;
    background: #f8fafc;
    border-radius: 4px;
    color: #334155;
    font-size: 13px;
    line-height: 1.7;
  }
}

.fm-orders-table {
  :deep(.el-table__row) {
    cursor: pointer;
  }
}
</style>
