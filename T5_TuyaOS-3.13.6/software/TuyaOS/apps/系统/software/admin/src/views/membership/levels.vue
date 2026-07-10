<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAnnualCardMembers, updateUserMembership } from '@/api/membership'

const router = useRouter()
const loading = ref(false)
const list = ref<any[]>([])

const adjustDialogVisible = ref(false)
const adjustForm = ref({ userId: 0, nickname: '', startDate: '', expireDate: '', balanceDelta: 0 })
const adjustSaving = ref(false)

async function loadData() {
  loading.value = true
  try {
    list.value = await getAnnualCardMembers()
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function goDetail(row: any) {
  router.push(`/customer-center/customers/detail/${row.userId}`)
}

function openAdjust(row: any) {
  adjustForm.value = {
    userId: row.userId,
    nickname: row.nickname || row.phone || String(row.userId),
    startDate: row.startDate ? row.startDate.slice(0, 10) : '',
    expireDate: row.expireDate ? row.expireDate.slice(0, 10) : '',
    balanceDelta: 0,
  }
  adjustDialogVisible.value = true
}

async function handleSaveAdjust() {
  adjustSaving.value = true
  try {
    const payload: any = {}
    if (adjustForm.value.startDate) payload.startDate = adjustForm.value.startDate
    if (adjustForm.value.expireDate) payload.expireDate = adjustForm.value.expireDate
    if (adjustForm.value.balanceDelta !== 0) payload.balanceDelta = adjustForm.value.balanceDelta
    await updateUserMembership(adjustForm.value.userId, payload)
    ElMessage.success('调整成功')
    adjustDialogVisible.value = false
    loadData()
  } catch {} finally {
    adjustSaving.value = false
  }
}

function formatDate(d: string) {
  if (!d) return '—'
  return d.slice(0, 10)
}

onMounted(loadData)
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">年卡会员</h2>
        <p class="page-subtitle">查看年卡有效期与储值余额，支持行内快捷续期/充值，复杂变更跳转客户详情办理。</p>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 16px;"
      title="年卡会员统一管理"
      description="列表包含所有开通孝心年卡的客户；可行内续期/充值，或跳转客户详情办理开通、转赠等复杂变更。"
      show-icon
    />

    <el-table :data="list" highlight-current-row>
      <el-table-column label="用户ID" prop="userId" width="90" />
      <el-table-column label="昵称" prop="nickname" width="130">
        <template #default="{ row }">{{ row.nickname || '—' }}</template>
      </el-table-column>
      <el-table-column label="手机号" prop="phone" width="140">
        <template #default="{ row }">{{ row.phone || '—' }}</template>
      </el-table-column>
      <el-table-column label="开始日期" width="120">
        <template #default="{ row }">{{ formatDate(row.startDate) }}</template>
      </el-table-column>
      <el-table-column label="到期日期" width="120">
        <template #default="{ row }">{{ formatDate(row.expireDate) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isExpired ? 'danger' : 'success'" size="small">
            {{ row.isExpired ? '已过期' : '生效中' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="储值余额" width="110">
        <template #default="{ row }">¥{{ Number(row.balance || 0).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="goDetail(row)">客户详情</el-button>
          <el-button type="primary" link size="small" @click="openAdjust(row)">续期/充值</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && list.length === 0" description="暂无孝心年卡会员" />

    <el-dialog v-model="adjustDialogVisible" :title="`调整年卡 - ${adjustForm.nickname}`" width="440px">
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="adjustForm.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选填"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker
            v-model="adjustForm.expireDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选填"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="储值调整">
          <el-input-number
            v-model="adjustForm.balanceDelta"
            :precision="2"
            placeholder="正数充值，负数扣减"
            style="width: 100%;"
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px;">正数为充值，负数为扣减，0 表示不调整</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSaving" @click="handleSaveAdjust">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
