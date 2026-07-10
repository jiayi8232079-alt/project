<template>
  <div class="tenant-onboarding">
    <el-card>
      <template #header>
        <span>新租户开通向导</span>
      </template>

      <el-steps :active="step" finish-status="success" align-center>
        <el-step title="基本信息" />
        <el-step title="主联系人" />
        <el-step title="配额 / 白标" />
        <el-step title="确认创建" />
      </el-steps>

      <div class="wizard-body">
        <!-- Step 1：基本信息 -->
        <el-form v-show="step === 0" :model="form" label-width="120px" :rules="rules" ref="formRef">
          <el-form-item label="租户编码" prop="code">
            <el-input v-model="form.code" placeholder="如 sunshine-community（小写字母/数字/短横线）" />
            <div class="form-tip">用于二级域名、白标识别，2-64 字符，创建后不可改</div>
          </el-form-item>
          <el-form-item label="显示名称" prop="name">
            <el-input v-model="form.name" placeholder="如 阳光社区" />
          </el-form-item>
          <el-form-item label="租户类型" prop="type">
            <el-radio-group v-model="form.type">
              <el-radio value="community">社区/机构</el-radio>
              <el-radio value="enterprise">渠道企业</el-radio>
              <el-radio value="personal">个人</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="数据中心">
            <el-select v-model="form.dataCenter" style="width: 240px">
              <el-option label="中国-华东（cn-east-1）" value="cn-east-1" />
              <el-option label="中国-华北（cn-north-1）" value="cn-north-1" />
            </el-select>
            <div class="form-tip">需与涂鸦云数据中心一致，否则 MCP 服务不可见</div>
          </el-form-item>
        </el-form>

        <!-- Step 2：主联系人 -->
        <el-form v-show="step === 1" :model="form" label-width="120px">
          <el-form-item label="姓名">
            <el-input v-model="form.contactName" placeholder="主管理员姓名" />
          </el-form-item>
          <el-form-item label="电话">
            <el-input v-model="form.contactPhone" placeholder="11 位手机号" />
          </el-form-item>
          <el-form-item label="Owner UID">
            <el-input-number v-model="form.ownerUserId" :min="1" placeholder="可留空，先建租户再加成员" />
            <div class="form-tip">立即指定一个已注册的 user 作为租户管理员</div>
          </el-form-item>
        </el-form>

        <!-- Step 3：配额 / 白标 -->
        <el-form v-show="step === 2" :model="form.settings" label-width="120px">
          <el-form-item label="白标 Logo">
            <el-input v-model="brandingLogo" placeholder="https://..." />
          </el-form-item>
          <el-form-item label="主色调">
            <el-color-picker v-model="brandingColor" show-alpha />
          </el-form-item>
          <el-form-item label="设备数上限">
            <el-input-number v-model="quotaDevices" :min="0" placeholder="0 = 不限" />
          </el-form-item>
          <el-form-item label="居民数上限">
            <el-input-number v-model="quotaResidents" :min="0" placeholder="0 = 不限" />
          </el-form-item>
          <el-form-item label="启用 AI 顾问">
            <el-switch v-model="featAiAdvisor" />
          </el-form-item>
          <el-form-item label="启用跌倒雷达">
            <el-switch v-model="featFallRadar" />
          </el-form-item>
        </el-form>

        <!-- Step 4：确认 -->
        <div v-show="step === 3" class="confirm">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="租户编码">{{ form.code }}</el-descriptions-item>
            <el-descriptions-item label="名称">{{ form.name }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ form.type }}</el-descriptions-item>
            <el-descriptions-item label="数据中心">{{ form.dataCenter }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ form.contactName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ form.contactPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Owner">{{ form.ownerUserId ?? '稍后再加' }}</el-descriptions-item>
            <el-descriptions-item label="启用功能">
              <el-tag v-if="featAiAdvisor" size="small" style="margin-right:4px">AI顾问</el-tag>
              <el-tag v-if="featFallRadar" size="small" type="warning">跌倒雷达</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <div class="wizard-actions">
        <el-button v-if="step > 0" @click="step--">上一步</el-button>
        <el-button v-if="step < 3" type="primary" @click="nextStep">下一步</el-button>
        <el-button v-else type="primary" :loading="creating" @click="onSubmit">确认开通</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createTenant } from '@/api/tenant'

const router = useRouter()
const step = ref(0)
const creating = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  code: '',
  name: '',
  type: 'community' as 'community' | 'enterprise' | 'personal',
  dataCenter: 'cn-east-1',
  contactName: '',
  contactPhone: '',
  ownerUserId: undefined as number | undefined,
  settings: {} as Record<string, unknown>,
})

const brandingLogo = ref('')
const brandingColor = ref('#2F8F5B')
const quotaDevices = ref(0)
const quotaResidents = ref(0)
const featAiAdvisor = ref(true)
const featFallRadar = ref(false)

const rules: FormRules = {
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

const composedSettings = computed(() => ({
  branding: {
    logoUrl: brandingLogo.value || undefined,
    primaryColor: brandingColor.value || undefined,
  },
  quota: {
    maxDevices: quotaDevices.value || undefined,
    maxResidents: quotaResidents.value || undefined,
  },
  features: {
    aiAdvisor: featAiAdvisor.value,
    fallRadar: featFallRadar.value,
  },
}))

async function nextStep() {
  if (step.value === 0) {
    const ok = await formRef.value?.validate().catch(() => false)
    if (!ok) return
  }
  step.value++
}

async function onSubmit() {
  creating.value = true
  try {
    const tenant = await createTenant({
      code: form.code,
      name: form.name,
      type: form.type,
      dataCenter: form.dataCenter,
      contactName: form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      settings: composedSettings.value,
      ownerUserId: form.ownerUserId,
    })
    ElMessage.success(`租户 #${tenant.id} ${tenant.name} 已开通`)
    router.push('/tenant/list')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.tenant-onboarding .wizard-body {
  padding: 32px 24px;
  min-height: 300px;
}
.tenant-onboarding .form-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 2px;
}
.tenant-onboarding .wizard-actions {
  text-align: center;
  margin-top: 16px;
}
.tenant-onboarding .confirm {
  padding: 0 16px;
}
</style>
