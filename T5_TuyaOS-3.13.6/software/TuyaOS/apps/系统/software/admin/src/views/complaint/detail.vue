<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminList } from '@/api/system'
import {
  getComplaintApi,
  updateComplaintApi,
  type ComplaintCategory,
  type ComplaintItem,
  type ComplaintPriority,
  type ComplaintStatus,
} from '@/api/complaint'

const router = useRouter()
const route = useRoute()

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  service: '服务质量',
  attendant: '陪诊员相关',
  dispatch: '派单/响应',
  payment: '支付/退款',
  report: '报告/资料',
  other: '其他',
}

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  rejected: '已驳回',
  closed: '已关闭',
}

const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

const STATUS_TAG: Record<ComplaintStatus, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  pending: 'warning',
  processing: 'primary',
  resolved: 'success',
  rejected: 'danger',
  closed: 'info',
}

const PRIORITY_TAG: Record<ComplaintPriority, 'info' | 'warning' | 'success' | 'danger'> = {
  low: 'info',
  normal: 'success',
  high: 'warning',
  urgent: 'danger',
}

const complaint = ref<ComplaintItem | null>(null)
const loading = ref(false)
const submitting = ref(false)

const admins = ref<Array<{ id: number; username: string; realName: string }>>([])

const form = reactive<{
  priority: ComplaintPriority
  handlerId: number | null
  reply: string
  resolution: string
  internalNote: string
  status: ComplaintStatus | ''
}>({
  priority: 'normal',
  handlerId: null,
  reply: '',
  resolution: '',
  internalNote: '',
  status: '',
})

const canAdjust = computed(() => complaint.value?.status !== 'closed')
const previewImages = ref<string[]>([])
const previewVisible = ref(false)

async function loadDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    complaint.value = await getComplaintApi(id)
    const c = complaint.value
    if (c) {
      form.priority = c.priority
      form.handlerId = c.handlerId
      form.resolution = c.resolution || ''
      form.internalNote = c.internalNote || ''
      form.status = ''
      form.reply = ''
    }
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally {
    loading.value = false
  }
}

async function loadAdmins() {
  try {
    const res: any = await getAdminList()
    const list = Array.isArray(res) ? res : (res?.items || res?.data || [])
    admins.value = list.map((a: any) => ({
      id: a.id,
      username: a.username,
      realName: a.realName,
    }))
  } catch (e) {
    console.warn('load admins failed', e)
  }
}

function adminName(id: number | null | undefined) {
  if (!id) return '未指派'
  const hit = admins.value.find((a) => a.id === id)
  return hit ? hit.realName || hit.username : `客服#${id}`
}

function openPreview(idx: number) {
  const images = complaint.value?.images || []
  if (!images.length) return
  previewImages.value = [...images.slice(idx), ...images.slice(0, idx)]
  previewVisible.value = true
}

function formatTime(v: string | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

async function submitUpdate() {
  if (!complaint.value) return
  if (!form.reply && !form.status && !form.resolution && !form.internalNote &&
      form.priority === complaint.value.priority &&
      form.handlerId === complaint.value.handlerId) {
    ElMessage.warning('没有需要提交的变更')
    return
  }
  submitting.value = true
  try {
    const payload: Record<string, any> = {}
    if (form.reply && form.reply.trim()) payload.reply = form.reply.trim()
    if (form.resolution !== (complaint.value.resolution || '')) {
      payload.resolution = form.resolution
    }
    if (form.internalNote !== (complaint.value.internalNote || '')) {
      payload.internalNote = form.internalNote
    }
    if (form.priority !== complaint.value.priority) payload.priority = form.priority
    if (form.handlerId !== complaint.value.handlerId) payload.handlerId = form.handlerId
    if (form.status) payload.status = form.status

    const res = await updateComplaintApi(complaint.value.id, payload)
    complaint.value = res
    form.priority = res.priority
    form.handlerId = res.handlerId
    form.resolution = res.resolution || ''
    form.internalNote = res.internalNote || ''
    form.reply = ''
    form.status = ''
    ElMessage.success('已保存')
  } catch {
    // 错误由全局请求拦截器统一弹出
  } finally {
    submitting.value = false
  }
}

async function changeStatusQuick(target: ComplaintStatus) {
  if (!complaint.value) return
  if (target === complaint.value.status) return
  try {
    await ElMessageBox.confirm(
      `确认将工单切换为【${STATUS_LABELS[target]}】？`,
      '确认操作',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const res = await updateComplaintApi(complaint.value.id, { status: target })
    complaint.value = res
    ElMessage.success('状态已更新')
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

onMounted(async () => {
  await Promise.all([loadDetail(), loadAdmins()])
})
</script>

<template>
  <div class="complaint-detail" v-loading="loading">
    <el-page-header @back="router.back()" content="工单详情">
      <template #breadcrumb>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/support/complaints' }">投诉工单</el-breadcrumb-item>
          <el-breadcrumb-item>详情</el-breadcrumb-item>
        </el-breadcrumb>
      </template>
    </el-page-header>

    <template v-if="complaint">
      <el-card shadow="never" class="detail-card">
        <div class="detail-head">
          <div class="detail-title">
            <span>{{ complaint.subject }}</span>
            <el-tag :type="STATUS_TAG[complaint.status]" class="ml-8">
              {{ STATUS_LABELS[complaint.status] }}
            </el-tag>
            <el-tag
              :type="PRIORITY_TAG[complaint.priority]"
              effect="plain"
              class="ml-8"
            >
              优先级：{{ PRIORITY_LABELS[complaint.priority] }}
            </el-tag>
          </div>
          <div class="detail-actions">
            <el-button
              size="small"
              type="primary"
              :disabled="!canAdjust"
              @click="changeStatusQuick('processing')"
            >标记处理中</el-button>
            <el-button
              size="small"
              type="success"
              :disabled="!canAdjust"
              @click="changeStatusQuick('resolved')"
            >标记已解决</el-button>
            <el-button
              size="small"
              type="danger"
              :disabled="!canAdjust"
              @click="changeStatusQuick('rejected')"
            >驳回</el-button>
            <el-button
              size="small"
              :disabled="!canAdjust"
              @click="changeStatusQuick('closed')"
            >关闭</el-button>
          </div>
        </div>

        <el-descriptions :column="3" border size="small" class="detail-desc">
          <el-descriptions-item label="工单号">#{{ complaint.id }}</el-descriptions-item>
          <el-descriptions-item label="类别">{{ CATEGORY_LABELS[complaint.category] }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatTime(complaint.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="客户">
            {{ complaint.user?.nickname || '—' }}
            <span v-if="complaint.user?.phone" class="dim">（{{ complaint.user.phone }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ complaint.contactPhone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="处理人">{{ adminName(complaint.handlerId) }}</el-descriptions-item>
          <el-descriptions-item label="相关订单">
            <router-link
              v-if="complaint.orderId"
              :to="`/service/orders/detail/${complaint.orderId}`"
              class="link-primary"
            >{{ complaint.order?.orderNumber || `#${complaint.orderId}` }}</router-link>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="相关陪诊员">
            <router-link
              v-if="complaint.attendantId"
              :to="`/dispatch/attendants/detail/${complaint.attendantId}`"
              class="link-primary"
            >{{ complaint.attendant?.realName || `#${complaint.attendantId}` }}</router-link>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="解决时间">{{ formatTime(complaint.resolvedAt) }}</el-descriptions-item>
          <el-descriptions-item label="客户评分" :span="3">
            <template v-if="complaint.userRating">
              <span class="rating-stars">
                {{ '★'.repeat(complaint.userRating) + '☆'.repeat(5 - complaint.userRating) }}
              </span>
              <span class="dim">（客户对本次处理的评价）</span>
            </template>
            <span v-else class="dim">客户尚未评价</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <div class="detail-section-title">客户描述</div>
          <div class="detail-description">{{ complaint.description }}</div>
          <div v-if="complaint.images?.length" class="detail-images">
            <img
              v-for="(img, idx) in complaint.images"
              :key="idx"
              :src="img"
              class="detail-image"
              @click="openPreview(idx)"
            />
          </div>
        </div>
      </el-card>

      <!-- 时间线 -->
      <el-card shadow="never" class="detail-card">
        <div class="detail-section-title">工单跟进</div>
        <el-timeline v-if="(complaint.timeline || []).length">
          <el-timeline-item
            v-for="(t, idx) in complaint.timeline || []"
            :key="idx"
            :timestamp="formatTime(t.at)"
            :type="t.type === 'status' ? 'primary' : t.byType === 'admin' ? 'success' : 'info'"
          >
            <div class="timeline-entry">
              <span class="timeline-actor">
                <el-tag
                  size="small"
                  :type="t.byType === 'admin' ? 'success' : t.byType === 'user' ? 'warning' : 'info'"
                  effect="plain"
                >
                  {{ t.byType === 'admin' ? '客服' : t.byType === 'user' ? '客户' : '系统' }}
                </el-tag>
                <span class="timeline-name">{{ t.byName || '未具名' }}</span>
              </span>
              <div class="timeline-content">{{ t.content }}</div>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无跟进记录" :image-size="60" />
      </el-card>

      <!-- 处理表单 -->
      <el-card shadow="never" class="detail-card">
        <div class="detail-section-title">处理 / 回复</div>
        <el-form label-width="110px" :disabled="!canAdjust">
          <el-form-item label="优先级">
            <el-select v-model="form.priority" style="width: 180px">
              <el-option label="低" value="low" />
              <el-option label="普通" value="normal" />
              <el-option label="高" value="high" />
              <el-option label="紧急" value="urgent" />
            </el-select>
          </el-form-item>
          <el-form-item label="指派处理人">
            <el-select
              v-model="form.handlerId"
              clearable
              placeholder="请选择客服"
              style="width: 260px"
              filterable
            >
              <el-option
                v-for="a in admins"
                :key="a.id"
                :label="`${a.realName || a.username}（#${a.id}）`"
                :value="a.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="回复客户">
            <el-input
              v-model="form.reply"
              type="textarea"
              :rows="3"
              placeholder="回复内容会追加到跟进记录，客户可见"
              maxlength="2000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="处理结论">
            <el-input
              v-model="form.resolution"
              type="textarea"
              :rows="2"
              placeholder="最终处理结论（客户可见）"
              maxlength="2000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="内部备注">
            <el-input
              v-model="form.internalNote"
              type="textarea"
              :rows="2"
              placeholder="仅客服/管理员可见"
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="变更状态">
            <el-select v-model="form.status" clearable placeholder="保持不变" style="width: 180px">
              <el-option label="处理中" value="processing" />
              <el-option label="已解决" value="resolved" />
              <el-option label="已驳回" value="rejected" />
              <el-option label="已关闭" value="closed" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="submitting"
              :disabled="!canAdjust"
              @click="submitUpdate"
            >提交</el-button>
            <el-button @click="loadDetail">刷新</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-image-viewer
        v-if="previewVisible"
        :url-list="previewImages"
        @close="previewVisible = false"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.complaint-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-card {
  border-radius: 10px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #09090b;
}
.detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-desc { margin-bottom: 12px; }
.detail-section { margin-top: 12px; }
.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
  margin-bottom: 8px;
}
.detail-description {
  white-space: pre-wrap;
  background: #fafafa;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 12px;
  color: #303133;
  font-size: 13px;
  line-height: 1.6;
}
.detail-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.detail-image {
  width: 100%;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e4e4e7;
  cursor: zoom-in;
  transition: border-color 0.18s ease;

  &:hover { border-color: #5e6ad2; }
}

.timeline-entry { display: flex; flex-direction: column; gap: 4px; }
.timeline-actor { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.timeline-name { color: #52525b; font-weight: 500; }
.timeline-content {
  font-size: 13px;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-word;
}

.link-primary { color: #5e6ad2; }
.dim { color: #a1a1aa; margin-left: 4px; font-size: 12px; }
.rating-stars { color: #f59e0b; letter-spacing: 2px; font-size: 14px; }
.ml-8 { margin-left: 8px; }
</style>
