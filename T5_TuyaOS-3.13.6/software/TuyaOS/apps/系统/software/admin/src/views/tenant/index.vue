<template>
  <div class="tenant-list">
    <el-row :gutter="16" class="tree-row">
      <el-col :span="7">
        <el-card v-loading="treeLoading">
          <template #header>租户树（层级）</template>
          <el-tree
            v-if="treeData.length"
            :data="treeData"
            node-key="id"
            default-expand-all
            highlight-current
            @node-click="onTreeNodeClick"
          />
          <el-empty v-else description="暂无树数据" />
        </el-card>
      </el-col>
      <el-col :span="17">
    <el-card>
      <template #header>
        <div class="header">
          <span>租户管理</span>
          <el-button type="primary" @click="onCreate">新建租户</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query" class="filter-bar">
        <el-form-item label="关键字">
          <el-input
            v-model="query.keyword"
            placeholder="名称 / code / 联系电话"
            clearable
            @change="reload"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" clearable placeholder="全部" @change="reload" style="width: 140px">
            <el-option label="平台" value="platform" />
            <el-option label="社区/机构" value="community" />
            <el-option label="渠道企业" value="enterprise" />
            <el-option label="个人" value="personal" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" @change="reload" style="width: 140px">
            <el-option label="正常" value="active" />
            <el-option label="暂停" value="suspended" />
            <el-option label="待审核" value="pending" />
            <el-option label="已停用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="reload">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="code" label="编码" width="180" />
        <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTagColor(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="层级" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ scopeLabel(row.scopeType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="depth" label="深度" width="60" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagColor(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dataCenter" label="数据中心" width="120" />
        <el-table-column prop="contactName" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="onEdit(row)">编辑</el-button>
            <el-button size="small" link @click="onMembers(row)">成员</el-button>
            <el-button size="small" type="danger" link @click="onDisable(row)" :disabled="row.id === 1">
              停用
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="reload"
          @size-change="reload"
        />
      </div>
    </el-card>
      </el-col>
    </el-row>

    <!-- 新建 / 编辑 -->
    <el-dialog v-model="editVisible" :title="editing?.id ? '编辑租户' : '新建租户'" width="560px">
      <el-form ref="formRef" :model="editForm" :rules="formRules" label-width="100px">
        <el-form-item label="编码" prop="code">
          <el-input
            v-model="editForm.code"
            placeholder="小写字母/数字/短横线，2-64 字"
            :disabled="!!editing?.id"
          />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="editForm.type" :disabled="!!editing?.id" style="width: 100%">
            <el-option label="社区/机构" value="community" />
            <el-option label="渠道企业" value="enterprise" />
            <el-option label="个人" value="personal" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!editing?.id" label="父租户">
          <el-select v-model="editForm.parentId" clearable placeholder="默认挂平台" style="width: 100%">
            <el-option
              v-for="p in parentOptions"
              :key="p.id"
              :label="`${p.name} (${scopeLabel(p.scopeType)})`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!editing?.id" label="层级类型">
          <el-select v-model="editForm.scopeType" clearable placeholder="自动推导" style="width: 100%">
            <el-option label="政府监管" value="government" />
            <el-option label="渠道企业" value="enterprise" />
            <el-option label="养老机构" value="organization" />
            <el-option label="社区站点" value="site" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!editing?.id" label="区划码">
          <el-input v-model="editForm.regionCode" placeholder="政府租户可填，如 3311" />
        </el-form-item>
        <el-form-item label="数据中心">
          <el-input v-model="editForm.dataCenter" placeholder="cn-east-1" />
        </el-form-item>
        <el-form-item label="主联系人">
          <el-input v-model="editForm.contactName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="editForm.contactPhone" />
        </el-form-item>
        <el-form-item v-if="!editing?.id" label="Owner 用户 ID">
          <el-input-number v-model="editForm.ownerUserId" :min="1" placeholder="可留空，后续在成员里添加" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 成员管理 -->
    <el-drawer v-model="membersVisible" title="租户成员" size="480px">
      <div v-if="membersLoading" v-loading="membersLoading" style="min-height: 200px"></div>
      <el-empty v-else-if="members.length === 0" description="暂无成员" />
      <el-table v-else :data="members" stripe size="small">
        <el-table-column prop="userId" label="UID" width="60" />
        <el-table-column label="用户" min-width="120">
          <template #default="{ row }">{{ row.user?.nickname || row.user?.phone || '#' + row.userId }}</template>
        </el-table-column>
        <el-table-column label="角色" width="120">
          <template #default="{ row }">{{ row.role?.name || '默认' }}</template>
        </el-table-column>
        <el-table-column label="Owner" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isOwner" type="warning" size="small">是</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="加入时间" width="160">
          <template #default="{ row }">{{ formatDateTime(row.joinedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  listTenants,
  createTenant,
  updateTenant,
  removeTenant,
  listTenantMembers,
  getTenantTree,
  type TenantRecord,
  type TenantTreeNode,
  type TenantUserRecord,
} from '@/api/tenant'

const treeLoading = ref(false)
const treeData = ref<{ id: number; label: string; children?: { id: number; label: string; children?: unknown[] }[] }[]>([])
const parentOptions = ref<{ id: number; name: string; scopeType?: string }[]>([])

const loading = ref(false)
const saving = ref(false)
const rows = ref<TenantRecord[]>([])
const total = ref(0)

const query = reactive({
  keyword: '',
  type: '',
  status: '',
  page: 1,
  pageSize: 20,
})

const editVisible = ref(false)
const editing = ref<TenantRecord | null>(null)
const editForm = reactive({
  code: '',
  name: '',
  type: 'community',
  dataCenter: 'cn-east-1',
  contactName: '',
  contactPhone: '',
  ownerUserId: undefined as number | undefined,
  parentId: undefined as number | undefined,
  scopeType: '' as string,
  regionCode: '',
})
const formRef = ref<FormInstance>()
const formRules: FormRules = {
  code: [
    { required: true, message: '请填写编码', trigger: 'blur' },
    {
      pattern: /^[a-z0-9-]{2,64}$/,
      message: '仅小写字母/数字/短横线，2-64 字',
      trigger: 'blur',
    },
  ],
  name: [{ required: true, message: '请填写名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

const membersVisible = ref(false)
const membersLoading = ref(false)
const members = ref<TenantUserRecord[]>([])

function mapTreeNodes(nodes: TenantTreeNode[]): { id: number; label: string; children?: ReturnType<typeof mapTreeNodes> }[] {
  return nodes.map((n) => ({
    id: n.id,
    label: `${n.name} · ${scopeLabel(n.scopeType)}`,
    children: n.children?.length ? mapTreeNodes(n.children) : undefined,
  }))
}

function flattenTree(nodes: TenantTreeNode[], acc: { id: number; name: string; scopeType?: string }[] = []) {
  for (const n of nodes) {
    acc.push({ id: n.id, name: n.name, scopeType: n.scopeType })
    if (n.children?.length) flattenTree(n.children, acc)
  }
  return acc
}

async function loadTree() {
  treeLoading.value = true
  try {
    const roots = await getTenantTree()
    treeData.value = mapTreeNodes(roots)
    parentOptions.value = flattenTree(roots)
  } finally {
    treeLoading.value = false
  }
}

function onTreeNodeClick(node: { id: number }) {
  query.keyword = ''
  void reload()
  const row = rows.value.find((r) => r.id === node.id)
  if (row) onEdit(row)
}

async function reload() {
  loading.value = true
  try {
    const res = await listTenants({
      keyword: query.keyword || undefined,
      type: query.type || undefined,
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

function onCreate() {
  editing.value = null
  Object.assign(editForm, {
    code: '',
    name: '',
    type: 'community',
    dataCenter: 'cn-east-1',
    contactName: '',
    contactPhone: '',
    ownerUserId: undefined,
    parentId: undefined,
    scopeType: '',
    regionCode: '',
  })
  editVisible.value = true
}

function onEdit(row: TenantRecord) {
  editing.value = row
  Object.assign(editForm, {
    code: row.code,
    name: row.name,
    type: row.type,
    dataCenter: row.dataCenter,
    contactName: row.contactName ?? '',
    contactPhone: row.contactPhone ?? '',
    ownerUserId: undefined,
  })
  editVisible.value = true
}

async function onSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editing.value?.id) {
      await updateTenant(editing.value.id, {
        name: editForm.name,
        dataCenter: editForm.dataCenter,
        contactName: editForm.contactName || null,
        contactPhone: editForm.contactPhone || null,
      })
      ElMessage.success('已更新')
    } else {
      await createTenant({
        code: editForm.code,
        name: editForm.name,
        type: editForm.type,
        dataCenter: editForm.dataCenter,
        contactName: editForm.contactName || undefined,
        contactPhone: editForm.contactPhone || undefined,
        ownerUserId: editForm.ownerUserId,
        parentId: editForm.parentId,
        scopeType: editForm.scopeType || undefined,
        regionCode: editForm.regionCode || undefined,
      })
      ElMessage.success('已创建')
    }
    editVisible.value = false
    await reload()
    await loadTree()
  } finally {
    saving.value = false
  }
}

async function onDisable(row: TenantRecord) {
  await ElMessageBox.confirm(`确定停用租户「${row.name}」？数据将保留但拒绝新建。`, '停用确认', {
    type: 'warning',
  })
  await removeTenant(row.id)
  ElMessage.success('已停用')
  await reload()
}

async function onMembers(row: TenantRecord) {
  editing.value = row
  membersVisible.value = true
  membersLoading.value = true
  try {
    members.value = await listTenantMembers(row.id)
  } finally {
    membersLoading.value = false
  }
}

function scopeLabel(s?: string) {
  return {
    platform: '平台',
    government: '政府',
    enterprise: '渠道',
    organization: '机构',
    site: '站点',
  }[s || ''] || s || '-'
}
function typeLabel(t: string) {
  return { platform: '平台', community: '社区/机构', enterprise: '渠道企业', personal: '个人' }[t] || t
}
function typeTagColor(t: string): any {
  return { platform: 'info', community: 'success', enterprise: 'warning', personal: '' }[t] || ''
}
function statusLabel(s: string) {
  return { active: '正常', suspended: '暂停', disabled: '已停用', pending: '待审核' }[s] || s
}
function statusTagColor(s: string): any {
  return { active: 'success', suspended: 'warning', disabled: 'danger', pending: 'info' }[s] || ''
}
function formatDateTime(v?: string | null) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  void reload()
  void loadTree()
})
</script>

<style scoped>
.tenant-list .tree-row {
  margin-bottom: 16px;
}
.tenant-list .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tenant-list .filter-bar {
  margin-bottom: 12px;
}
.tenant-list .pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
