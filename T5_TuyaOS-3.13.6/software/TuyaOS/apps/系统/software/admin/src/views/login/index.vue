<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getCaptchaApi } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  captchaCode: '',
})

const captcha = reactive({
  required: false,
  token: '',
  svg: '',
  refreshing: false,
})

const lockedInfo = reactive({
  locked: false,
  seconds: 0,
  message: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaCode: [
    {
      validator: (_r, value, callback) => {
        if (captcha.required && !value) {
          callback(new Error('请输入图形验证码'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

async function refreshCaptcha() {
  captcha.refreshing = true
  try {
    const res = await getCaptchaApi()
    captcha.token = res.token
    captcha.svg = res.svg
    form.captchaCode = ''
  } catch {
    // 静默失败，用户可手动再次点击刷新
  } finally {
    captcha.refreshing = false
  }
}

function parseLoginError(err: any): {
  message: string
  captchaRequired?: boolean
  lockedSeconds?: number
} {
  const data = err?.response?.data
  const body =
    typeof data?.message === 'object' && data?.message !== null
      ? data.message
      : data || {}
  const message =
    typeof data?.message === 'string'
      ? data.message
      : body?.message || err?.message || '登录失败'
  return {
    message,
    captchaRequired: body?.captchaRequired === true,
    lockedSeconds: typeof body?.lockedSeconds === 'number' ? body.lockedSeconds : undefined,
  }
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login({
      username: form.username,
      password: form.password,
      captchaToken: captcha.required ? captcha.token : undefined,
      captchaCode: captcha.required ? form.captchaCode : undefined,
    })
    ElMessage.success('登录成功')
    router.push('/dashboard/index')
  } catch (e: any) {
    const parsed = parseLoginError(e)
    ElMessage.error(parsed.message)
    if (parsed.lockedSeconds && parsed.lockedSeconds > 0) {
      lockedInfo.locked = true
      lockedInfo.seconds = parsed.lockedSeconds
      lockedInfo.message = parsed.message
    }
    if (parsed.captchaRequired) {
      captcha.required = true
      await refreshCaptcha()
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 默认不显示验证码；当后端提示达到阈值时再请求
})
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="hover">
      <div class="login-header">
        <el-icon :size="48" color="#409EFF"><FirstAidKit /></el-icon>
        <h1 class="login-title">陪了个伴陪诊服务管理系统</h1>
        <p class="login-subtitle">专业温暖的陪诊服务管理平台</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入您的账号" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入您的密码" prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item v-if="captcha.required" prop="captchaCode">
          <div class="captcha-row">
            <el-input v-model="form.captchaCode" placeholder="请输入右侧验证码" prefix-icon="Key" maxlength="6" />
            <div
              class="captcha-svg"
              :class="{ 'captcha-svg--disabled': captcha.refreshing }"
              :title="captcha.refreshing ? '刷新中…' : '点击刷新验证码'"
              @click="refreshCaptcha"
              v-html="captcha.svg || '点击获取'"
            />
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
            立即登录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-footer">
        <p v-if="lockedInfo.locked" class="login-warning">{{ lockedInfo.message }}</p>
        <p v-else>首次登录？请联系系统管理员分配账号</p>
        <span>© 2024 陪了个伴陪诊服务 版权所有</span>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  // 极光网格背景（与全局液态玻璃一致）
  background:
    radial-gradient(560px circle at 90% -6%, rgba(85, 219, 245, 0.5), transparent 62%),
    radial-gradient(520px circle at 4% 6%, rgba(158, 140, 255, 0.46), transparent 60%),
    radial-gradient(620px circle at -8% 54%, rgba(95, 230, 198, 0.42), transparent 60%),
    radial-gradient(640px circle at 102% 58%, rgba(107, 176, 255, 0.5), transparent 60%),
    radial-gradient(560px circle at 78% 108%, rgba(201, 166, 255, 0.4), transparent 60%),
    linear-gradient(180deg, #e6f0ff 0%, #edebfd 46%, #fbfdff 100%);
}

.login-card {
  width: 400px;
  max-width: 90vw;
  padding: 32px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 24px;
  // 顶部受光高光 + 玻璃内描边 + 柔和漂浮阴影
  box-shadow:
    0 20px 48px rgba(30, 91, 158, 0.18),
    0 4px 12px rgba(30, 91, 158, 0.08),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.7),
    inset 0 0 0 1px rgba(255, 255, 255, 0.34);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 16px 0 8px;
}

.login-subtitle {
  font-size: 14px;
  color: #909399;
}

.login-btn {
  width: 100%;
}

.captcha-row {
  display: flex;
  width: 100%;
  gap: 12px;
  align-items: stretch;
}

.captcha-row .el-input {
  flex: 1;
}

.captcha-svg {
  width: 140px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: #909399;
  transition: border-color 0.2s;

  :deep(svg) {
    width: 100%;
    height: 100%;
  }

  &:hover {
    border-color: #409EFF;
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;

  p {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
  }

  .login-warning {
    color: #f56c6c;
    font-weight: 500;
  }

  span {
    font-size: 12px;
    color: #c0c4cc;
  }
}
</style>
