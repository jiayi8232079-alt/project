<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TenantTreeSelect from '@/components/tenant/TenantTreeSelect.vue'
import {
  createRevenueRule,
  listRevenueRules,
  removeRevenueRule,
  toggleRevenueRule,
  updateRevenueRule,
  type RevenueShareRule,
  type RevenueShareScope,
  type RevenueShareType,
} from '@/api/billing'

const loading = ref(false)
const list = ref<RevenueShareRule[]>([])
const scopeFilter = ref<RevenueShareScope | ''>('')

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)

const TYPE_LABEL: Record<RevenueShareType, string> = {
  percentage: '百分比',
  flat: '固定金额',
  tier: '阶梯',
}
const SCOPE_LABEL: Record<RevenueShareScope, string> = {
  subscription: '订阅',
  order: '订单',
  addon: '增值服务',
}

const form = reactive<{
  tenantId: number | null
  partnerTenantId: number | null
  type: RevenueShareType
  scope: RevenueShareScope
  percent: number
  flatAmount: number
  priority: number
  tiersText: string
  active: boolean
  description: string
}>({
  tenantId: null,
  partnerTenantId: null,
  type: 'percentage',
  scope: 'subscription',
  percent: 20,
  flatAmount: 0,
  priority: 0,
  tiersText: '[\n  { "upTo": 10000, "rate": 0.1 },\n  { "upTo": null, "rate": 0.15 }\n]',
  active: true,
  description: '',
})

async function load() {
  loading.value = true
  try {
    list.value = await listRevenueRules({ scope: scopeFilter.value || undefined })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    tenantId: null,
    partnerTenantId: null,
    type: 'percentage',
    scope: 'subscription',
    percent: 20,
    flatAmount: 0,
    priority: 0,
    tiersText: '[\n  { "upTo": 10000, "rate": 0.1 },\n  { "upTo": null, "rate": 0.15 }\n]',
    active: true,
    description: '',
  })
  dialogVisible.value = true
}

function openEdit(row: RevenueShareRule) {
  editingId.value = row.id
  Object.assign(form, {
    tenantId: row.tenantId,
    partnerTenantId: row.partnerTenantId,
    type: row.type,
    scope: row.scope,
    percent: Math.round((row.rate || 0) * 1000) / 10,
    flatAmount: row.flatAmount || 0,
    priority: row.priority || 0,
    tiersText: JSON.stringify((row.settings as any)?.tiers ?? [], null, 2),
    active: row.active,
    description: row.description ?? '',
  })
  dialogVisible.value = true
}

async function submit() {
  if (!form.tenantId || !form.partnerTenantId) {
    ElMessage.warning('请选择客户租户与渠道租户')
    return
  }
  let settings: Record<string, unknown> | undefined
  if (form.type === 'tier') {
    try {
      settings = { tiers: JSON.parse(form.tiersText) }
    } catch {
      ElMessage.error('阶梯规则 JSON 格式错误')
      return
    }
  }
  const payload = {
    tenantId: form.tenantId,
    partnerTenantId: form.partnerTenantId,
    type: form.type,
    scope: form.scope,
    rate: form.type === 'percentage' ? Math.round((form.percent / 100) * 10000) / 10000 : 0,
    flatAmount: form.type === 'flat' ? form.flatAmount : 0,
    priority: form.priority,
    settings,
    active: form.active,
    description: form.description || undefined,
  }
  submitting.value = true
  try {
    if (editingId.value) {
      await updateRevenueRule(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createRevenueRule(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    load()
  } finally {
    submitting.value = false
  }
}

async function handleToggle(row: RevenueShareRule) {
  await toggleRevenueRule(row.id)
  load()
}

async function handleDelete(row: RevenueShareRule) {
  try {
    await ElMessageBox.confirm('确认删除该分账规则？', '删除确认', { type: 'warning' })
  } catch {
    return
  }
  await removeRevenueRule(row.id)
  ElMessage.success('已删除')
  load()
}

function rateDisplay(row: RevenueShareRule): string {
  if (row.type === 'percentage') return `${Math.round((row.rate || 0) * 1000) / 10}%`
  if (row.type === 'flat') return `¥${row.flatAmount}`
  return '阶梯'
}

onMounted(load)
</script>

<template>
  <div class="rev-share">
    <div class="page-head">
      <div>
        <h2>分账规则</h2>
        <span>渠道商（代理）按订阅 / 订单 / 增值服务抽佣的规则配置</span>
      </div>
      <el-button type="primary" @click="openCreate">新增规则</el-button>
    </div>

    <div class="toolbar">
      <el-select v-model="scopeFilter" placeholder="全部场景" clearable style="width: 160px" @change="load">
        <el-option label="订阅" value="subscription" />
        <el-option label="订单" value="order" />
        <el-option label="增值服务" value="addon" />
      </el-select>
      <el-button @click="load">查询</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="id" label="#" width="64" />
      <el-table-column label="客户租户" width="100">
        <template #default="{ row }">#{{ row.tenantId }}</template>
      </el-table-column>
      <el-table-column label="渠道租户" width="100">
        <template #default="{ row }">#{{ row.partnerTenantId }}</template>
      </el-table-column>
      <el-table-column label="场景" width="110">
        <template #default="{ row }">{{ SCOPE_LABEL[row.scope as RevenueShareScope] }}</template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ TYPE_LABEL[row.type as RevenueShareType] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分账" width="110" align="right">
        <template #default="{ row }">
          <strong>{{ rateDisplay(row) }}</strong>
        </template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="90" align="center" />
      <el-table-column prop="description" label="说明" show-overflow-tooltip />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch :model-value="row.active" @change="handleToggle(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && !list.length" description="暂无分账规则" />

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分账规则' : '新增分账规则'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="客户租户" required>
          <TenantTreeSelect v-model="form.tenantId" placeholder="产生订单/订阅的租户" width="100%" />
        </el-form-item>
        <el-form-item label="渠道租户" required>
          <TenantTreeSelect v-model="form.partnerTenantId" placeholder="拿分成的代理租户" width="100%" />
        </el-form-item>
        <el-form-item label="场景">
          <el-select v-model="form.scope" style="width: 100%">
            <el-option label="订阅" value="subscription" />
            <el-option label="订单" value="order" />
            <el-option label="增值服务" value="addon" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio-button value="percentage">百分比</el-radio-button>
            <el-radio-button value="flat">固定金额</el-radio-button>
            <el-radio-button value="tier">阶梯</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.type === 'percentage'" label="抽佣比例">
          <el-input-number v-model="form.percent" :min="0" :max="100" :step="1" />
          <span class="unit">%</span>
        </el-form-item>
        <el-form-item v-if="form.type === 'flat'" label="每笔金额">
          <el-input-number v-model="form.flatAmount" :min="0" :step="10" />
          <span class="unit">元</span>
        </el-form-item>
        <el-form-item v-if="form.type === 'tier'" label="阶梯规则">
          <el-input
            v-model="form.tiersText"
            type="textarea"
            :rows="6"
            placeholder='[{ "upTo": 10000, "rate": 0.1 }, { "upTo": null, "rate": 0.15 }]'
          />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" />
          <span class="hint">多条命中时取大值</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.active" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.rev-share {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.page-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
  color: #1e293b;
}
.page-head span {
  font-size: 13px;
  color: #94a3b8;
}
.toolbar {
  display: flex;
  gap: 10px;
}
.unit {
  margin-left: 8px;
  color: #64748b;
}
.hint {
  margin-left: 10px;
  color: #94a3b8;
  font-size: 12px;
}
</style>
