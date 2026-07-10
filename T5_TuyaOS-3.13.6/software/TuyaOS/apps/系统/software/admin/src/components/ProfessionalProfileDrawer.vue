<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listServiceStaffRoleConfigs,
  updateAttendantProfessionalProfile,
  type ServiceStaffRole,
  type ServiceStaffRoleConfig,
  type StaffCertification,
} from '@/api/attendant'

const props = defineProps<{
  modelValue: boolean
  attendantId: number | string | null
  initial?: {
    primaryRole?: ServiceStaffRole
    professionalRoles?: ServiceStaffRole[]
    specialties?: string[]
    certifications?: StaffCertification[] | null
    title?: string | null
    experienceYears?: number
    realName?: string
  }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const roleConfigs = ref<ServiceStaffRoleConfig[]>([])
const loadingConfigs = ref(false)

async function loadConfigs() {
  if (roleConfigs.value.length > 0) return
  loadingConfigs.value = true
  try {
    roleConfigs.value = await listServiceStaffRoleConfigs()
  } catch {
    roleConfigs.value = []
  } finally {
    loadingConfigs.value = false
  }
}

const form = ref({
  primaryRole: 'attendant' as ServiceStaffRole,
  professionalRoles: ['attendant'] as ServiceStaffRole[],
  specialtiesText: '',
  certifications: [] as StaffCertification[],
  title: '' as string | null,
  experienceYears: 0,
})

function resetForm() {
  const init = props.initial || {}
  form.value = {
    primaryRole: (init.primaryRole || 'attendant') as ServiceStaffRole,
    professionalRoles:
      init.professionalRoles && init.professionalRoles.length > 0
        ? [...init.professionalRoles]
        : [(init.primaryRole as ServiceStaffRole) || 'attendant'],
    specialtiesText: (init.specialties || []).join('，'),
    certifications: init.certifications ? init.certifications.map((c) => ({ ...c })) : [],
    title: init.title ?? '',
    experienceYears: Number(init.experienceYears) || 0,
  }
}

watch(
  () => [props.modelValue, props.initial],
  ([v]) => {
    if (v) {
      resetForm()
      loadConfigs()
    }
  },
  { immediate: true, deep: true },
)

function addCertification() {
  form.value.certifications.push({
    name: '',
    number: '',
    issuedAt: '',
    expiry: null,
    imageUrl: '',
  })
}

function removeCertification(idx: number) {
  form.value.certifications.splice(idx, 1)
}

const saving = ref(false)
async function handleSave() {
  if (!props.attendantId) return
  if (!form.value.primaryRole) {
    ElMessage.warning('请选择主角色')
    return
  }
  if (!form.value.professionalRoles.includes(form.value.primaryRole)) {
    form.value.professionalRoles = [
      form.value.primaryRole,
      ...form.value.professionalRoles,
    ]
  }
  const specialties = form.value.specialtiesText
    .split(/[,，;；\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const certifications = form.value.certifications
    .filter((c) => c.name && c.name.trim())
    .map((c) => ({
      name: c.name!.trim(),
      number: c.number?.trim() || undefined,
      issuedAt: c.issuedAt || undefined,
      expiry: c.expiry || null,
      imageUrl: c.imageUrl?.trim() || undefined,
    }))

  saving.value = true
  try {
    await updateAttendantProfessionalProfile(props.attendantId, {
      primaryRole: form.value.primaryRole,
      professionalRoles: form.value.professionalRoles,
      specialties,
      certifications,
      title: form.value.title?.trim() || null,
      experienceYears: form.value.experienceYears,
    })
    ElMessage.success('已保存')
    emit('saved')
    visible.value = false
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const currentPrimaryConfig = computed(() =>
  roleConfigs.value.find((c) => c.role === form.value.primaryRole),
)

onMounted(loadConfigs)
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="`编辑专业资料 · ${initial?.realName || ''}`"
    size="560px"
    direction="rtl"
    :close-on-click-modal="false"
  >
    <el-form label-width="100px" :model="form" v-loading="loadingConfigs">
      <el-form-item label="主角色" required>
        <el-select v-model="form.primaryRole" style="width: 100%;">
          <el-option
            v-for="cfg in roleConfigs"
            :key="cfg.role"
            :label="cfg.label"
            :value="cfg.role"
          />
        </el-select>
        <div v-if="currentPrimaryConfig" class="role-hint">
          <el-tag size="small" :style="{ backgroundColor: currentPrimaryConfig.themeColor, color: '#fff', borderColor: currentPrimaryConfig.themeColor }">
            {{ currentPrimaryConfig.label }}
          </el-tag>
          <span class="role-hint__scope">{{ currentPrimaryConfig.serviceScope }}</span>
        </div>
      </el-form-item>

      <el-form-item label="兼任角色">
        <el-select
          v-model="form.professionalRoles"
          multiple
          collapse-tags
          collapse-tags-tooltip
          style="width: 100%;"
          placeholder="可同时具备多个专业角色（订单按角色派单时命中任一即算候选）"
        >
          <el-option
            v-for="cfg in roleConfigs"
            :key="cfg.role"
            :label="cfg.label"
            :value="cfg.role"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="对外头衔">
        <el-input
          v-model="form.title"
          placeholder="如：注册营养师 / 高级康复治疗师。不填走主角色默认值"
        />
      </el-form-item>

      <el-form-item label="服务年限">
        <el-input-number v-model="form.experienceYears" :min="0" :max="50" />
        <span style="margin-left: 8px; color: #999;">家属看板展示用</span>
      </el-form-item>

      <el-form-item label="专长标签">
        <el-input
          v-model="form.specialtiesText"
          type="textarea"
          :rows="2"
          placeholder="用中英文逗号或换行分隔；如：糖尿病营养, 术后恢复, 脑卒中康复"
        />
      </el-form-item>

      <el-divider content-position="left">执业资格 / 持证</el-divider>

      <div v-for="(cert, idx) in form.certifications" :key="idx" class="cert-row">
        <div class="cert-row__head">
          <strong>证书 {{ idx + 1 }}</strong>
          <el-button size="small" type="danger" link @click="removeCertification(idx)">删除</el-button>
        </div>
        <el-input v-model="cert.name" placeholder="证书名称，如：护士执业证书" style="margin-bottom: 8px;" />
        <el-input v-model="cert.number" placeholder="证书编号（可选）" style="margin-bottom: 8px;" />
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <el-date-picker
            v-model="cert.issuedAt"
            type="date"
            placeholder="签发日期"
            value-format="YYYY-MM-DD"
            style="flex: 1;"
          />
          <el-date-picker
            v-model="cert.expiry"
            type="date"
            placeholder="到期日期（可空）"
            value-format="YYYY-MM-DD"
            style="flex: 1;"
          />
        </div>
        <el-input v-model="cert.imageUrl" placeholder="证书照片 URL（可选）" />
      </div>
      <el-button type="primary" plain @click="addCertification">+ 添加证书</el-button>
    </el-form>

    <template #footer>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style lang="scss" scoped>
.role-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;

  &__scope {
    color: #606266;
  }
}
.cert-row {
  padding: 12px;
  border: 1px solid #E7EAF1;
  border-radius: 6px;
  margin-bottom: 10px;
  background: #FAFBFC;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
}
</style>
