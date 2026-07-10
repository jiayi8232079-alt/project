<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAdminList, createAdmin, updateAdminInfo, resetAdminPassword, changeMyPassword,
  getAttendantAccounts, resetAttendantPassword, setAttendantUsername,
} from '@/api/system'
import { useUserStore } from '@/stores/user'

interface AdminItem {
  id: number; username: string; realName: string; role: string; phone: string; status: boolean; createdAt: string
}
interface AttendantItem {
  id: number; realName: string; username: string; phone: string; employeeId: string; status: string; createdAt: string
}

const adminRoleOptions = [
  { value: 'admin', label: '超级管理员' },
  { value: 'operator', label: '运营主管' },
  { value: 'finance', label: '财务人员' },
  { value: 'customer_service', label: '客服专员' },
  { value: 'medical_consultant', label: '医学顾问' },
]
const roleMap: Record<string, string> = Object.fromEntries(adminRoleOptions.map(r => [r.value, r.label]))

const userStore = useUserStore()
const currentAdminId = computed(() => {
  const id = (userStore.userInfo as any)?.id
  return typeof id === 'number' ? id : Number(id) || 0
})

const activeTab = ref('admin')
const loading = ref(false)

/* ─── 管理员 ─── */
const admins = ref<AdminItem[]>([])
const adminDialogVisible = ref(false)
const adminDialogTitle = ref('新建管理员')
const adminForm = ref({ id: 0, username: '', password: '', realName: '', role: 'operator', phone: '', status: true })
const adminSaving = ref(false)

const isEditingSelf = computed(() => adminForm.value.id !== 0 && adminForm.value.id === currentAdminId.value)
const activeSuperAdminCount = computed(
  () => admins.value.filter(a => a.role === 'admin' && a.status === true).length
)
const editingOriginalAdmin = computed(
  () => admins.value.find(a => a.id === adminForm.value.id) || null
)

async function loadAdmins() {
  loading.value = true
  try {
    const res = await getAdminList()
    admins.value = Array.isArray(res) ? res : (res as any)?.data ?? []
  } catch { admins.value = [] }
  finally { loading.value = false }
}

function openCreateAdmin() {
  adminDialogTitle.value = '新建管理员'
  // 新建默认为"运营主管"，避免无意创建过多超级管理员
  adminForm.value = { id: 0, username: '', password: '', realName: '', role: 'operator', phone: '', status: true }
  adminDialogVisible.value = true
}

function openEditAdmin(row: AdminItem) {
  adminDialogTitle.value = '编辑管理员'
  adminForm.value = { id: row.id, username: row.username, password: '', realName: row.realName || '', role: row.role, phone: row.phone || '', status: row.status }
  adminDialogVisible.value = true
}

async function handleSaveAdmin() {
  const f = adminForm.value
  if (!f.username?.trim()) { ElMessage.warning('请输入用户名'); return }
  if (f.id === 0) {
    if (!f.password || f.password.length < 6) { ElMessage.warning('密码不能少于 6 位'); return }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(f.username.trim())) {
      ElMessage.warning('用户名只能包含字母、数字、下划线，且长度 3-20 位'); return
    }
  }

  // 编辑自己时的防御
  if (f.id !== 0 && f.id === currentAdminId.value) {
    const original = editingOriginalAdmin.value
    if (original && f.role !== original.role) {
      ElMessage.warning('不能修改自己的角色，请由其他超级管理员操作'); return
    }
    if (original && original.status && f.status === false) {
      ElMessage.warning('不能禁用自己的账号'); return
    }
  }

  // 最后一个启用中的超管保护
  if (f.id !== 0) {
    const original = editingOriginalAdmin.value
    const becomingInactive = original?.status && f.status === false
    const demoting = original?.role === 'admin' && f.role !== 'admin'
    if (original?.role === 'admin' && original.status && (becomingInactive || demoting)) {
      if (activeSuperAdminCount.value <= 1) {
        ElMessage.warning('系统必须至少保留一位启用中的超级管理员，不能禁用或降级该账号')
        return
      }
    }
  }

  // 新建/编辑为超管时增加二次确认
  const isGrantingSuperAdmin =
    f.role === 'admin' &&
    (f.id === 0 || editingOriginalAdmin.value?.role !== 'admin')
  if (isGrantingSuperAdmin) {
    try {
      await ElMessageBox.confirm(
        '即将授予"超级管理员"权限，该角色拥有完整后台权限，确认继续？',
        '高风险操作确认',
        { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' },
      )
    } catch { return }
  }

  adminSaving.value = true
  try {
    if (f.id === 0) {
      await createAdmin({ username: f.username.trim(), password: f.password, realName: f.realName, role: f.role, phone: f.phone })
      ElMessage.success('创建成功')
    } else {
      await updateAdminInfo(f.id, { realName: f.realName, role: f.role, phone: f.phone, status: f.status })
      ElMessage.success('更新成功')
    }
    adminDialogVisible.value = false
    await loadAdmins()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally { adminSaving.value = false }
}

/* ─── 重置密码（共用） ─── */
const pwdDialogVisible = ref(false)
const pwdTarget = ref<{ id: number; name: string; type: 'admin' | 'attendant' }>({ id: 0, name: '', type: 'admin' })
const pwdForm = ref({ newPassword: '', confirmPassword: '' })
const pwdLoading = ref(false)

function openResetPwd(id: number, name: string, type: 'admin' | 'attendant') {
  pwdTarget.value = { id, name, type }
  pwdForm.value = { newPassword: '', confirmPassword: '' }
  pwdDialogVisible.value = true
}

async function handleResetPwd() {
  const { newPassword, confirmPassword } = pwdForm.value
  if (!newPassword || newPassword.length < 6) { ElMessage.warning('新密码不能少于 6 位'); return }
  if (newPassword !== confirmPassword) { ElMessage.warning('两次密码不一致'); return }

  try {
    await ElMessageBox.confirm(`确定重置「${pwdTarget.value.name}」的密码？`, '确认', { type: 'warning' })
  } catch { return }

  pwdLoading.value = true
  try {
    if (pwdTarget.value.type === 'admin') {
      await resetAdminPassword(pwdTarget.value.id, newPassword)
    } else {
      await resetAttendantPassword(pwdTarget.value.id, newPassword)
    }
    ElMessage.success('密码已重置')
    pwdDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally { pwdLoading.value = false }
}

/* ─── 修改自己密码 ─── */
const selfDialogVisible = ref(false)
const selfForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const selfLoading = ref(false)

function openSelfDialog() {
  selfForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  selfDialogVisible.value = true
}

async function handleChangeSelf() {
  const { oldPassword, newPassword, confirmPassword } = selfForm.value
  if (!oldPassword) { ElMessage.warning('请输入旧密码'); return }
  if (!newPassword || newPassword.length < 6) { ElMessage.warning('新密码不能少于 6 位'); return }
  if (newPassword !== confirmPassword) { ElMessage.warning('两次密码不一致'); return }

  selfLoading.value = true
  try {
    await changeMyPassword(oldPassword, newPassword)
    ElMessage.success('密码修改成功，下次登录请使用新密码')
    selfDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally { selfLoading.value = false }
}

/* ─── 陪诊员 ─── */
const attendants = ref<AttendantItem[]>([])

async function loadAttendants() {
  loading.value = true
  try {
    const res = await getAttendantAccounts()
    attendants.value = Array.isArray(res) ? res : (res as any)?.data ?? []
  } catch { attendants.value = [] }
  finally { loading.value = false }
}

const usernameDialogVisible = ref(false)
const usernameTarget = ref<AttendantItem | null>(null)
const usernameForm = ref({ username: '' })
const usernameSaving = ref(false)

function openUsernameDialog(row: AttendantItem) {
  usernameTarget.value = row
  usernameForm.value = { username: row.username || '' }
  usernameDialogVisible.value = true
}

async function handleSaveUsername() {
  const u = usernameForm.value.username?.trim()
  if (!u) { ElMessage.warning('请输入用户名'); return }
  if (!usernameTarget.value) return

  usernameSaving.value = true
  try {
    await setAttendantUsername(usernameTarget.value.id, u)
    ElMessage.success('用户名设置成功')
    usernameDialogVisible.value = false
    await loadAttendants()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally { usernameSaving.value = false }
}

function handleTabChange(tab: string | number) {
  if (tab === 'admin') loadAdmins()
  else loadAttendants()
}

onMounted(loadAdmins)
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">账号管理</h2>
        <p class="page-subtitle">统一管理后台管理员和陪诊员的登录账号与密码。</p>
      </div>
      <div class="page-header__actions">
        <el-button @click="openSelfDialog"><el-icon><Lock /></el-icon>修改我的密码</el-button>
        <el-button v-if="activeTab === 'admin'" type="primary" @click="openCreateAdmin"><el-icon><Plus /></el-icon>新建管理员</el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- 管理员 Tab -->
        <el-tab-pane label="后台管理员" name="admin">
          <el-table :data="admins" highlight-current-row>
            <el-table-column prop="username" label="用户名" width="140" />
            <el-table-column prop="realName" label="姓名" width="120">
              <template #default="{ row }">{{ row.realName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="130">
              <template #default="{ row }">
                <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
                  {{ roleMap[row.role] || row.role }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="phone" label="手机号" width="140">
              <template #default="{ row }">{{ row.phone || '-' }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'danger'" size="small">{{ row.status ? '正常' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openEditAdmin(row)">编辑</el-button>
                <el-button
                  type="warning"
                  link
                  size="small"
                  :disabled="row.id === currentAdminId"
                  @click="openResetPwd(row.id, row.realName || row.username, 'admin')"
                >
                  重置密码
                </el-button>
                <el-tag v-if="row.id === currentAdminId" size="small" type="info" style="margin-left: 4px">当前登录</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 陪诊员 Tab -->
        <el-tab-pane label="陪诊员账号" name="attendant">
          <el-table :data="attendants" highlight-current-row>
            <el-table-column prop="realName" label="姓名" width="120" />
            <el-table-column prop="username" label="登录用户名" width="150">
              <template #default="{ row }">
                <span v-if="row.username">{{ row.username }}</span>
                <el-tag v-else type="warning" size="small">未设置</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="employeeId" label="工号" width="120">
              <template #default="{ row }">{{ row.employeeId || '-' }}</template>
            </el-table-column>
            <el-table-column prop="phone" label="手机号" width="140">
              <template #default="{ row }">{{ row.phone || '-' }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'active' ? '正常' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openUsernameDialog(row)">设置用户名</el-button>
                <el-button type="warning" link size="small" @click="openResetPwd(row.id, row.realName, 'attendant')">重置密码</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新建/编辑管理员 -->
    <el-dialog v-model="adminDialogVisible" :title="adminDialogTitle" width="500px" destroy-on-close>
      <el-form :model="adminForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="adminForm.username" placeholder="登录用户名" :disabled="adminForm.id !== 0" maxlength="32" />
        </el-form-item>
        <el-form-item v-if="adminForm.id === 0" label="密码">
          <el-input v-model="adminForm.password" type="password" show-password placeholder="至少 6 位" maxlength="32" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="adminForm.realName" placeholder="真实姓名" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="adminForm.role" style="width: 100%" :disabled="isEditingSelf">
            <el-option v-for="r in adminRoleOptions" :key="r.value" :value="r.value" :label="r.label" />
          </el-select>
          <div v-if="isEditingSelf" class="form-hint">不能修改自己的角色，请由其他超级管理员操作</div>
          <div v-else-if="adminForm.id === 0" class="form-hint">
            默认"运营主管"。"超级管理员"拥有完整权限，请谨慎选择。
          </div>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="adminForm.phone" placeholder="手机号" maxlength="11" />
        </el-form-item>
        <el-form-item v-if="adminForm.id !== 0" label="状态">
          <el-switch
            v-model="adminForm.status"
            active-text="正常"
            inactive-text="禁用"
            :disabled="isEditingSelf"
          />
          <div v-if="isEditingSelf" class="form-hint">不能禁用自己的账号</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adminDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adminSaving" @click="handleSaveAdmin">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码（管理员/陪诊员共用） -->
    <el-dialog v-model="pwdDialogVisible" title="重置密码" width="460px" destroy-on-close>
      <p style="margin-bottom: 16px; color: #909399;">
        正在重置「<strong>{{ pwdTarget.name }}</strong>」的密码
      </p>
      <el-form :model="pwdForm" label-width="100px">
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 6 位" maxlength="32" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入" maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="handleResetPwd">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 修改自己的密码 -->
    <el-dialog v-model="selfDialogVisible" title="修改我的密码" width="460px" destroy-on-close>
      <el-form :model="selfForm" label-width="100px">
        <el-form-item label="旧密码">
          <el-input v-model="selfForm.oldPassword" type="password" show-password placeholder="输入当前密码" maxlength="32" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="selfForm.newPassword" type="password" show-password placeholder="至少 6 位" maxlength="32" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="selfForm.confirmPassword" type="password" show-password placeholder="再次输入" maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="selfDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="selfLoading" @click="handleChangeSelf">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 设置陪诊员用户名 -->
    <el-dialog v-model="usernameDialogVisible" title="设置登录用户名" width="460px" destroy-on-close>
      <p style="margin-bottom: 16px; color: #909399;">
        为「<strong>{{ usernameTarget?.realName }}</strong>」设置 Web 端登录用户名
      </p>
      <el-form :model="usernameForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="usernameForm.username" placeholder="登录用户名" maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="usernameDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="usernameSaving" @click="handleSaveUsername">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.form-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin-top: 4px;
}
</style>
