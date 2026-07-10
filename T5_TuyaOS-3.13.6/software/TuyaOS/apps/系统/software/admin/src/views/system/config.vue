<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getConfig, setConfig, batchSetConfigs, testStorageConnection } from '@/api/system'
import { getToken } from '@/utils/auth'
import { API_BASE_URL } from '@/config/api-base'

const activeTab = ref('store')
const loading = ref(false)
const storageSaving = ref(false)
const storageTesting = ref(false)
const asrSaving = ref(false)

const cancelRules = ref([
  { range: '服务开始前24小时以上', deduction: 0 },
  { range: '服务开始前2~24小时', deduction: 20 },
  { range: '服务开始前2小时内', deduction: 50 },
])
const slotRule = ref({
  startTime: '09:00',
  endTime: '17:00',
  intervalMinutes: 40,
  capacityPerSlot: 3,
})
const slotPreview = computed(() => {
  const toMinutes = (v: string) => {
    const parts = String(v).split(':').map(Number)
    const h = parts[0] ?? NaN
    const m = parts[1] ?? NaN
    if (Number.isNaN(h) || Number.isNaN(m)) return -1
    return h * 60 + m
  }
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const start = toMinutes(slotRule.value.startTime)
  const end = toMinutes(slotRule.value.endTime)
  const step = Number(slotRule.value.intervalMinutes || 0)
  if (start < 0 || end <= start || step <= 0) return []
  const list: string[] = []
  for (let t = start; t < end; t += step) list.push(fmt(t))
  return list
})

const corpId = ref('')
const customerServiceUrl = ref('')
const medicationReminderTemplateId = ref('')
const orderServiceReminderTemplateId = ref('')
const orderAssignNotifyTemplateId = ref('')
const grabPoolNotifyTemplateId = ref('')
const orderStatusNotifyTemplateId = ref('')
const attendantServiceReminderTemplateId = ref('')
const orderSignReminderTemplateId = ref('')
const orderPaymentReminderTemplateId = ref('')
const orderReviewInviteTemplateId = ref('')

const storeInfo = ref({
  name: '',
  phone: '',
  address: '',
  hours: '',
  wechat: '',
  latitude: '',
  longitude: '',
  description: '',
})

const storageConfig = ref({
  driver: 'local',
  cosSecretId: '',
  cosSecretKey: '',
  cosBucket: '',
  cosRegion: '',
  cosPathPrefix: '',
  cosCustomDomain: '',
  cosUseHttps: true,
})

const asrConfig = ref({
  enabled: false,
  secretId: '',
  secretKey: '',
  region: 'ap-guangzhou',
  engineModelType: '16k_zh',
})

const ocrConfig = ref({
  enabled: false,
  provider: 'tencentcloud',
  secretId: '',
  secretKey: '',
  region: 'ap-guangzhou',
})
const ocrSaving = ref(false)

const smsSaving = ref(false)
const smsConfig = ref({
  enabled: false,
  secretId: '',
  secretKey: '',
  sdkAppId: '',
  signName: '',
  templateMedicationReminder: '',
  templateFollowUpReminder: '',
  dailyLimitPerPhone: 10,
})

const aiConfig = ref({
  enabled: true,
  /** 小程序「我的」等入口是否展示智能导诊 */
  miniprogramShowAiTriage: true,
  /** 小程序是否展示 AI 健康顾问（周报独立配置，仍受 AI 大模型总开关影响） */
  miniprogramShowAiAdvisor: true,
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  visionModel: '',
  visionApiKey: '',
  visionBaseUrl: '',
  temperature: 0.3,
  maxTokens: 2048,
  systemPrompt: '',
})
const speechConfig = ref({
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  model: 'whisper-1',
})
const aiSaving = ref(false)

async function loadAiConfig() {
  const keys = [
    'ai_enabled',
    'miniprogram_show_ai_triage',
    'miniprogram_show_ai_advisor',
    'ai_api_key',
    'ai_base_url',
    'ai_model',
    'ai_vision_model',
    'ai_vision_api_key',
    'ai_vision_base_url',
    'ai_temperature',
    'ai_max_tokens',
    'ai_system_prompt',
  ]
  const results = await Promise.all(keys.map(k => getConfig(k).catch(() => null)))
  const [
    enabled,
    mpTriage,
    mpAdvisor,
    apiKey,
    baseUrl,
    model,
    visionModel,
    visionApiKey,
    visionBaseUrl,
    temp,
    maxTokens,
    prompt,
  ] = results
  if (enabled != null) aiConfig.value.enabled = enabled !== 'false'
  if (mpTriage != null) aiConfig.value.miniprogramShowAiTriage = mpTriage !== 'false' && mpTriage !== '0'
  if (mpAdvisor != null) aiConfig.value.miniprogramShowAiAdvisor = mpAdvisor !== 'false' && mpAdvisor !== '0'
  if (apiKey && typeof apiKey === 'string') aiConfig.value.apiKey = apiKey
  if (baseUrl && typeof baseUrl === 'string') aiConfig.value.baseUrl = baseUrl
  if (model && typeof model === 'string') aiConfig.value.model = model
  if (visionModel && typeof visionModel === 'string') aiConfig.value.visionModel = visionModel
  if (visionApiKey && typeof visionApiKey === 'string') aiConfig.value.visionApiKey = visionApiKey
  if (visionBaseUrl && typeof visionBaseUrl === 'string') aiConfig.value.visionBaseUrl = visionBaseUrl
  if (temp && typeof temp === 'string') aiConfig.value.temperature = Number(temp) || 0.3
  if (maxTokens && typeof maxTokens === 'string') aiConfig.value.maxTokens = Number(maxTokens) || 2048
  if (prompt && typeof prompt === 'string') aiConfig.value.systemPrompt = prompt

  const sk = ['speech_api_key', 'speech_api_base', 'speech_model']
  const sr = await Promise.all(sk.map(k => getConfig(k).catch(() => null)))
  if (sr[0] && typeof sr[0] === 'string') speechConfig.value.apiKey = sr[0]
  if (sr[1] && typeof sr[1] === 'string') speechConfig.value.apiBase = sr[1]
  if (sr[2] && typeof sr[2] === 'string') speechConfig.value.model = sr[2]
}

async function saveAiConfig() {
  aiSaving.value = true
  try {
    await batchSetConfigs([
      { key: 'ai_enabled', value: aiConfig.value.enabled ? 'true' : 'false', description: 'AI 问诊功能开关' },
      {
        key: 'miniprogram_show_ai_triage',
        value: aiConfig.value.miniprogramShowAiTriage ? 'true' : 'false',
        description: '小程序展示「AI 智能导诊」',
      },
      {
        key: 'miniprogram_show_ai_advisor',
        value: aiConfig.value.miniprogramShowAiAdvisor ? 'true' : 'false',
        description: '小程序展示「AI 健康顾问」',
      },
      { key: 'ai_api_key', value: aiConfig.value.apiKey.trim(), description: 'AI 大模型 API Key' },
      { key: 'ai_base_url', value: aiConfig.value.baseUrl.trim() || 'https://api.deepseek.com', description: 'AI API 地址' },
      { key: 'ai_model', value: aiConfig.value.model.trim() || 'deepseek-chat', description: 'AI 模型名称（文本对话）' },
      { key: 'ai_vision_model', value: aiConfig.value.visionModel.trim(), description: 'AI 视觉模型' },
      { key: 'ai_vision_api_key', value: aiConfig.value.visionApiKey.trim(), description: '健康材料读图专用 API Key' },
      { key: 'ai_vision_base_url', value: aiConfig.value.visionBaseUrl.trim(), description: '健康材料读图专用 API 根地址' },
      { key: 'ai_temperature', value: String(aiConfig.value.temperature), description: 'AI 温度参数' },
      { key: 'ai_max_tokens', value: String(aiConfig.value.maxTokens), description: 'AI 最大返回 token 数' },
      { key: 'ai_system_prompt', value: aiConfig.value.systemPrompt, description: 'AI 系统提示词' },
      { key: 'speech_api_key', value: speechConfig.value.apiKey.trim(), description: '语音转文字 API Key' },
      { key: 'speech_api_base', value: speechConfig.value.apiBase.trim() || 'https://api.openai.com/v1', description: '语音转文字 API 根地址' },
      { key: 'speech_model', value: speechConfig.value.model.trim() || 'whisper-1', description: '语音识别模型名' },
    ])
    ElMessage.success('AI 问诊配置已保存')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    aiSaving.value = false
  }
}

const storeLogo = ref('')
const logoUploading = ref(false)

function toAssetUrl(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

async function handleLogoUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('请上传 PNG / JPG / WebP 格式的图片')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 2MB')
    return
  }
  logoUploading.value = true
  try {
    const token = getToken() || ''
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE_URL}/documents/raw-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || '上传失败')
    const url = data?.data?.url ?? data?.url
    if (!url) throw new Error('上传失败')
    storeLogo.value = url
    await setConfig('store_logo', url, '门店 Logo 图片路径')
    ElMessage.success('Logo 上传并保存成功')
  } catch (e: any) {
    ElMessage.error(e?.message || 'Logo 上传失败')
  } finally {
    logoUploading.value = false
    const input = (event.target as HTMLInputElement)
    if (input) input.value = ''
  }
}

async function removeLogo() {
  storeLogo.value = ''
  await setConfig('store_logo', '', '门店 Logo 图片路径')
  ElMessage.success('Logo 已移除')
}

async function loadConfigs() {
  loading.value = true
  try {
    const results = await Promise.all([
      getConfig('cancel_rules').catch(() => null),
      getConfig('consultation_slot_rule').catch(() => null),
      getConfig('customer_service_url').catch(() => null),
      getConfig('store_name').catch(() => null),
      getConfig('store_phone').catch(() => null),
      getConfig('store_address').catch(() => null),
      getConfig('store_hours').catch(() => null),
      getConfig('store_wechat').catch(() => null),
      getConfig('store_latitude').catch(() => null),
      getConfig('store_longitude').catch(() => null),
      getConfig('store_description').catch(() => null),
      getConfig('store_logo').catch(() => null),
      getConfig('mini_program_template_medication_reminder').catch(() => null),
      getConfig('mini_program_template_order_service_reminder').catch(() => null),
      getConfig('mini_program_template_order_assign_notify').catch(() => null),
      getConfig('mini_program_template_grab_pool_notify').catch(() => null),
      getConfig('mini_program_template_order_status_notify').catch(() => null),
      getConfig('mini_program_template_attendant_service_reminder').catch(() => null),
      getConfig('mini_program_template_order_sign_reminder').catch(() => null),
      getConfig('mini_program_template_order_payment_reminder').catch(() => null),
      getConfig('mini_program_template_order_review_invite').catch(() => null),
      getConfig('wechat_work_corpid').catch(() => null),
      getConfig('storage_driver').catch(() => null),
      getConfig('storage_cos_secret_id').catch(() => null),
      getConfig('storage_cos_secret_key').catch(() => null),
      getConfig('storage_cos_bucket').catch(() => null),
      getConfig('storage_cos_region').catch(() => null),
      getConfig('storage_cos_path_prefix').catch(() => null),
      getConfig('storage_cos_custom_domain').catch(() => null),
      getConfig('storage_cos_use_https').catch(() => null),
      getConfig('tencent_asr_enabled').catch(() => null),
      getConfig('tencent_asr_secret_id').catch(() => null),
      getConfig('tencent_asr_secret_key').catch(() => null),
      getConfig('tencent_asr_region').catch(() => null),
      getConfig('tencent_asr_engine_model_type').catch(() => null),
      getConfig('sms_enabled').catch(() => null),
      getConfig('tencent_sms_secret_id').catch(() => null),
      getConfig('tencent_sms_secret_key').catch(() => null),
      getConfig('tencent_sms_sdk_app_id').catch(() => null),
      getConfig('tencent_sms_sign_name').catch(() => null),
      getConfig('tencent_sms_template_medication_reminder').catch(() => null),
      getConfig('tencent_sms_template_follow_up_reminder').catch(() => null),
      getConfig('sms_daily_limit_per_phone').catch(() => null),
      getConfig('prescription_ocr_enabled').catch(() => null),
      getConfig('prescription_ocr_provider').catch(() => null),
      getConfig('prescription_ocr_secret_id').catch(() => null),
      getConfig('prescription_ocr_secret_key').catch(() => null),
      getConfig('prescription_ocr_region').catch(() => null),
    ])
    const [
      cancelVal, slotRuleVal,
      csVal,
      storeName, storePhone, storeAddr, storeHours, storeWechat, storeLat, storeLng, storeDesc,
      storeLogoVal,
      medicationTemplate, orderServiceTemplate,
      orderAssignTemplate, grabPoolTemplate, orderStatusTemplate,
      attendantServiceReminderTemplate, orderSignReminderTemplate,
      orderPaymentReminderTemplate, orderReviewInviteTemplate,
      corpIdVal,
      storageDriverVal, storageCosSecretIdVal, storageCosSecretKeyVal, storageCosBucketVal,
      storageCosRegionVal, storageCosPathPrefixVal, storageCosCustomDomainVal, storageCosUseHttpsVal,
      asrEnabledVal, asrSecretIdVal, asrSecretKeyVal, asrRegionVal, asrEngineModelTypeVal,
      smsEnabledVal, smsSecretIdVal, smsSecretKeyVal, smsSdkAppIdVal, smsSignNameVal,
      smsTplMedicationVal, smsTplFollowUpVal, smsDailyLimitVal,
      ocrEnabledVal, ocrProviderVal, ocrSecretIdVal, ocrSecretKeyVal, ocrRegionVal,
    ] = results

    if (cancelVal) {
      try { cancelRules.value = JSON.parse(typeof cancelVal === 'string' ? cancelVal : '') } catch { /* keep default */ }
    }
    if (slotRuleVal) {
      try {
        const parsed = JSON.parse(typeof slotRuleVal === 'string' ? slotRuleVal : '')
        slotRule.value = {
          startTime: parsed.startTime || '09:00',
          endTime: parsed.endTime || '17:00',
          intervalMinutes: Number(parsed.intervalMinutes || 40),
          capacityPerSlot: Number(parsed.capacityPerSlot || 3),
        }
      } catch {
        // keep defaults
      }
    }
    if (csVal && typeof csVal === 'string') customerServiceUrl.value = csVal
    if (storeName && typeof storeName === 'string') storeInfo.value.name = storeName
    if (storePhone && typeof storePhone === 'string') storeInfo.value.phone = storePhone
    if (storeAddr && typeof storeAddr === 'string') storeInfo.value.address = storeAddr
    if (storeHours && typeof storeHours === 'string') storeInfo.value.hours = storeHours
    if (storeWechat && typeof storeWechat === 'string') storeInfo.value.wechat = storeWechat
    if (storeLat && typeof storeLat === 'string') storeInfo.value.latitude = storeLat
    if (storeLng && typeof storeLng === 'string') storeInfo.value.longitude = storeLng
    if (storeDesc && typeof storeDesc === 'string') storeInfo.value.description = storeDesc
    if (storeLogoVal && typeof storeLogoVal === 'string') storeLogo.value = storeLogoVal
    if (medicationTemplate && typeof medicationTemplate === 'string') medicationReminderTemplateId.value = medicationTemplate
    if (orderServiceTemplate && typeof orderServiceTemplate === 'string') orderServiceReminderTemplateId.value = orderServiceTemplate
    if (orderAssignTemplate && typeof orderAssignTemplate === 'string') orderAssignNotifyTemplateId.value = orderAssignTemplate
    if (grabPoolTemplate && typeof grabPoolTemplate === 'string') grabPoolNotifyTemplateId.value = grabPoolTemplate
    if (orderStatusTemplate && typeof orderStatusTemplate === 'string') orderStatusNotifyTemplateId.value = orderStatusTemplate
    if (attendantServiceReminderTemplate && typeof attendantServiceReminderTemplate === 'string') attendantServiceReminderTemplateId.value = attendantServiceReminderTemplate
    if (orderSignReminderTemplate && typeof orderSignReminderTemplate === 'string') orderSignReminderTemplateId.value = orderSignReminderTemplate
    if (orderPaymentReminderTemplate && typeof orderPaymentReminderTemplate === 'string') orderPaymentReminderTemplateId.value = orderPaymentReminderTemplate
    if (orderReviewInviteTemplate && typeof orderReviewInviteTemplate === 'string') orderReviewInviteTemplateId.value = orderReviewInviteTemplate
    if (corpIdVal && typeof corpIdVal === 'string') corpId.value = corpIdVal
    if (storageDriverVal === 'cos') storageConfig.value.driver = 'cos'
    if (storageCosSecretIdVal && typeof storageCosSecretIdVal === 'string') storageConfig.value.cosSecretId = storageCosSecretIdVal
    if (storageCosSecretKeyVal && typeof storageCosSecretKeyVal === 'string') storageConfig.value.cosSecretKey = storageCosSecretKeyVal
    if (storageCosBucketVal && typeof storageCosBucketVal === 'string') storageConfig.value.cosBucket = storageCosBucketVal
    if (storageCosRegionVal && typeof storageCosRegionVal === 'string') storageConfig.value.cosRegion = storageCosRegionVal
    if (storageCosPathPrefixVal && typeof storageCosPathPrefixVal === 'string') storageConfig.value.cosPathPrefix = storageCosPathPrefixVal
    if (storageCosCustomDomainVal && typeof storageCosCustomDomainVal === 'string') storageConfig.value.cosCustomDomain = storageCosCustomDomainVal
    if (storageCosUseHttpsVal) storageConfig.value.cosUseHttps = storageCosUseHttpsVal !== 'false'
    if (asrEnabledVal) asrConfig.value.enabled = asrEnabledVal === 'true'
    if (asrSecretIdVal && typeof asrSecretIdVal === 'string') asrConfig.value.secretId = asrSecretIdVal
    if (asrSecretKeyVal && typeof asrSecretKeyVal === 'string') asrConfig.value.secretKey = asrSecretKeyVal
    if (asrRegionVal && typeof asrRegionVal === 'string') asrConfig.value.region = asrRegionVal
    if (asrEngineModelTypeVal && typeof asrEngineModelTypeVal === 'string') asrConfig.value.engineModelType = asrEngineModelTypeVal
    if (smsEnabledVal) smsConfig.value.enabled = smsEnabledVal === 'true'
    if (smsSecretIdVal && typeof smsSecretIdVal === 'string') smsConfig.value.secretId = smsSecretIdVal
    if (smsSecretKeyVal && typeof smsSecretKeyVal === 'string') smsConfig.value.secretKey = smsSecretKeyVal
    if (smsSdkAppIdVal && typeof smsSdkAppIdVal === 'string') smsConfig.value.sdkAppId = smsSdkAppIdVal
    if (smsSignNameVal && typeof smsSignNameVal === 'string') smsConfig.value.signName = smsSignNameVal
    if (smsTplMedicationVal && typeof smsTplMedicationVal === 'string') smsConfig.value.templateMedicationReminder = smsTplMedicationVal
    if (smsTplFollowUpVal && typeof smsTplFollowUpVal === 'string') smsConfig.value.templateFollowUpReminder = smsTplFollowUpVal
    if (smsDailyLimitVal && typeof smsDailyLimitVal === 'string') {
      const n = Number(smsDailyLimitVal)
      if (Number.isFinite(n) && n > 0) smsConfig.value.dailyLimitPerPhone = n
    }
    if (ocrEnabledVal) ocrConfig.value.enabled = ocrEnabledVal === 'true'
    if (ocrProviderVal && typeof ocrProviderVal === 'string') ocrConfig.value.provider = ocrProviderVal
    if (ocrSecretIdVal && typeof ocrSecretIdVal === 'string') ocrConfig.value.secretId = ocrSecretIdVal
    if (ocrSecretKeyVal && typeof ocrSecretKeyVal === 'string') ocrConfig.value.secretKey = ocrSecretKeyVal
    if (ocrRegionVal && typeof ocrRegionVal === 'string') ocrConfig.value.region = ocrRegionVal
  } catch { /* use defaults */ }
  finally { loading.value = false }
}

async function persistStorageConfig(showSuccess = true) {
  storageSaving.value = true
  try {
    await batchSetConfigs([
      { key: 'storage_driver', value: storageConfig.value.driver, description: '文件存储驱动：local | cos' },
      { key: 'storage_cos_secret_id', value: storageConfig.value.cosSecretId.trim(), description: '腾讯云 COS SecretId' },
      { key: 'storage_cos_secret_key', value: storageConfig.value.cosSecretKey.trim(), description: '腾讯云 COS SecretKey' },
      { key: 'storage_cos_bucket', value: storageConfig.value.cosBucket.trim(), description: '腾讯云 COS Bucket 名称' },
      { key: 'storage_cos_region', value: storageConfig.value.cosRegion.trim(), description: '腾讯云 COS 所属地域' },
      { key: 'storage_cos_path_prefix', value: storageConfig.value.cosPathPrefix.trim(), description: '腾讯云 COS 对象目录前缀' },
      { key: 'storage_cos_custom_domain', value: storageConfig.value.cosCustomDomain.trim(), description: '腾讯云 COS 自定义访问域名' },
      { key: 'storage_cos_use_https', value: storageConfig.value.cosUseHttps ? 'true' : 'false', description: '腾讯云 COS 是否使用 HTTPS 访问' },
    ])
    if (showSuccess) ElMessage.success('对象存储配置已保存')
    return true
  } catch {
    ElMessage.error('对象存储配置保存失败')
    return false
  } finally {
    storageSaving.value = false
  }
}

async function saveStorageConfig() {
  await persistStorageConfig(true)
}

async function saveAsrConfig() {
  asrSaving.value = true
  try {
    await batchSetConfigs([
      { key: 'tencent_asr_enabled', value: asrConfig.value.enabled ? 'true' : 'false', description: '腾讯云录音转写总开关' },
      { key: 'tencent_asr_secret_id', value: asrConfig.value.secretId.trim(), description: '腾讯云 ASR SecretId（留空则复用 COS）' },
      { key: 'tencent_asr_secret_key', value: asrConfig.value.secretKey.trim(), description: '腾讯云 ASR SecretKey（留空则复用 COS）' },
      { key: 'tencent_asr_region', value: asrConfig.value.region.trim(), description: '腾讯云 ASR 所属地域' },
      { key: 'tencent_asr_engine_model_type', value: asrConfig.value.engineModelType.trim(), description: '腾讯云 ASR 引擎模型' },
    ])
    ElMessage.success('录音转写配置已保存')
  } catch {
    ElMessage.error('录音转写配置保存失败')
  } finally {
    asrSaving.value = false
  }
}

async function saveOcrConfig() {
  ocrSaving.value = true
  try {
    await batchSetConfigs([
      { key: 'prescription_ocr_enabled', value: ocrConfig.value.enabled ? 'true' : 'false', description: '处方 OCR 总开关' },
      { key: 'prescription_ocr_provider', value: ocrConfig.value.provider.trim() || 'tencentcloud', description: '处方 OCR 服务商' },
      { key: 'prescription_ocr_secret_id', value: ocrConfig.value.secretId.trim(), description: '处方 OCR SecretId（可复用 COS）' },
      { key: 'prescription_ocr_secret_key', value: ocrConfig.value.secretKey.trim(), description: '处方 OCR SecretKey（可复用 COS）' },
      { key: 'prescription_ocr_region', value: ocrConfig.value.region.trim() || 'ap-guangzhou', description: '处方 OCR 地域' },
    ])
    ElMessage.success('处方 OCR 配置已保存')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    ocrSaving.value = false
  }
}

async function saveSmsConfig() {
  if (smsConfig.value.enabled) {
    const missing: string[] = []
    if (!smsConfig.value.secretId.trim()) missing.push('SecretId')
    if (!smsConfig.value.secretKey.trim()) missing.push('SecretKey')
    if (!smsConfig.value.sdkAppId.trim()) missing.push('SdkAppId')
    if (!smsConfig.value.signName.trim()) missing.push('签名')
    if (missing.length > 0) {
      ElMessage.warning(`开启短信通知前，请先填写：${missing.join('、')}`)
      return
    }
  }
  const limit = Number(smsConfig.value.dailyLimitPerPhone)
  if (!Number.isFinite(limit) || limit <= 0) {
    ElMessage.warning('每手机号每日上限必须是大于 0 的整数')
    return
  }
  smsSaving.value = true
  try {
    await batchSetConfigs([
      { key: 'sms_enabled', value: smsConfig.value.enabled ? 'true' : 'false', description: '短信通知总开关' },
      { key: 'tencent_sms_secret_id', value: smsConfig.value.secretId.trim(), description: '腾讯云短信 SecretId' },
      { key: 'tencent_sms_secret_key', value: smsConfig.value.secretKey.trim(), description: '腾讯云短信 SecretKey' },
      { key: 'tencent_sms_sdk_app_id', value: smsConfig.value.sdkAppId.trim(), description: '腾讯云短信应用 SdkAppId' },
      { key: 'tencent_sms_sign_name', value: smsConfig.value.signName.trim(), description: '腾讯云短信签名（已审核）' },
      { key: 'tencent_sms_template_medication_reminder', value: smsConfig.value.templateMedicationReminder.trim(), description: '腾讯云短信模板ID-用药提醒' },
      { key: 'tencent_sms_template_follow_up_reminder', value: smsConfig.value.templateFollowUpReminder.trim(), description: '腾讯云短信模板ID-复诊提醒' },
      { key: 'sms_daily_limit_per_phone', value: String(limit), description: '短信每手机号每日上限（条）' },
    ])
    ElMessage.success('短信通知配置已保存')
  } catch {
    ElMessage.error('短信通知配置保存失败')
  } finally {
    smsSaving.value = false
  }
}

async function handleTestStorage() {
  const saved = await persistStorageConfig(false)
  if (!saved) return
  storageTesting.value = true
  try {
    const res: any = await testStorageConnection()
    ElMessage.success(res?.message || '对象存储连接成功')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '对象存储连接失败')
  } finally {
    storageTesting.value = false
  }
}

async function saveCancelRules() {
  try {
    await setConfig('cancel_rules', JSON.stringify(cancelRules.value), '取消退款规则')
    ElMessage.success('取消规则保存成功')
  } catch { ElMessage.error('保存失败') }
}

async function saveSlotRule() {
  if (slotPreview.value.length === 0) {
    ElMessage.warning('号源规则无效，请检查开始/结束时间与间隔')
    return
  }
  if (slotRule.value.capacityPerSlot <= 0) {
    ElMessage.warning('每时段放号数必须大于0')
    return
  }
  try {
    await setConfig('consultation_slot_rule', JSON.stringify(slotRule.value), '预约号源规则')
    ElMessage.success('号源规则保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

async function saveCustomerServiceUrl() {
  try {
    await batchSetConfigs([
      {
        key: 'customer_service_url',
        value: customerServiceUrl.value.trim(),
        description: '企业微信客服链接（小程序原生客服会话）',
      },
      {
        key: 'wechat_work_corpid',
        value: corpId.value.trim(),
        description: '企业微信 CorpID（小程序客服会话）',
      },
    ])
    ElMessage.success('保存成功')
  } catch { ElMessage.error('保存失败') }
}

async function saveMiniProgramTemplates() {
  try {
    await batchSetConfigs([
      {
        key: 'mini_program_template_medication_reminder',
        value: medicationReminderTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-用药提醒',
      },
      {
        key: 'mini_program_template_order_service_reminder',
        value: orderServiceReminderTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-服务前提醒（客户）',
      },
      {
        key: 'mini_program_template_order_assign_notify',
        value: orderAssignNotifyTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-陪诊员派单通知',
      },
      {
        key: 'mini_program_template_grab_pool_notify',
        value: grabPoolNotifyTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-抢单通知',
      },
      {
        key: 'mini_program_template_order_status_notify',
        value: orderStatusNotifyTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-订单状态通知（推给客户）',
      },
      {
        key: 'mini_program_template_attendant_service_reminder',
        value: attendantServiceReminderTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-服务前提醒（陪诊员）',
      },
      {
        key: 'mini_program_template_order_sign_reminder',
        value: orderSignReminderTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-待签署催办',
      },
      {
        key: 'mini_program_template_order_payment_reminder',
        value: orderPaymentReminderTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-待支付催办',
      },
      {
        key: 'mini_program_template_order_review_invite',
        value: orderReviewInviteTemplateId.value.trim(),
        description: '小程序订阅消息模板ID-服务完成评价邀请',
      },
    ])
    ElMessage.success('模板配置保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

async function saveStoreInfo() {
  try {
    const s = storeInfo.value
    await batchSetConfigs([
      { key: 'store_name', value: s.name, description: '门店名称' },
      { key: 'store_phone', value: s.phone, description: '门店电话' },
      { key: 'store_address', value: s.address, description: '门店地址' },
      { key: 'store_hours', value: s.hours, description: '营业时间' },
      { key: 'store_wechat', value: s.wechat, description: '门店微信号' },
      { key: 'store_latitude', value: s.latitude, description: '门店纬度' },
      { key: 'store_longitude', value: s.longitude, description: '门店经度' },
      { key: 'store_description', value: s.description, description: '门店简介' },
    ])
    ElMessage.success('门店信息保存成功')
  } catch { ElMessage.error('保存失败') }
}

onMounted(() => {
  loadConfigs()
  loadAiConfig()
})
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">系统配置</h2>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="page-alert"
      title="按 Tab 分区维护"
      description="各 Tab 相互独立：门店展示、存储、客服、业务规则、AI 与语音等。修改后需在对应 Tab 内保存；密钥等敏感项建议限定管理员操作。"
    />

    <el-tabs v-model="activeTab" type="border-card">

      <!-- ① 门店信息 -->
      <el-tab-pane label="门店信息" name="store">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">门店基本信息</span>
            <span class="card-head-hint">填写后将自动同步至小程序「联系门店」及健康档案文件</span>
          </template>
          <el-form label-width="120px" class="form-narrow">

            <el-form-item label="门店 Logo">
              <div class="logo-uploader">
                <div class="logo-uploader__preview">
                  <template v-if="storeLogo">
                    <img :src="toAssetUrl(storeLogo)" alt="门店Logo" class="logo-uploader__img" />
                    <el-button
                      type="danger" size="small"
                      class="logo-uploader__remove"
                      @click="removeLogo"
                    >&#x2715;</el-button>
                  </template>
                  <template v-else>
                    <div class="logo-uploader__placeholder">
                      <span class="logo-uploader__placeholder-icon">&#x1F3E2;</span>
                      <span class="logo-uploader__placeholder-text">暂无Logo</span>
                    </div>
                  </template>
                </div>
                <div class="logo-uploader__action">
                  <label class="logo-uploader__btn" :class="{ 'is-loading': logoUploading }">
                    <span>{{ logoUploading ? '上传中...' : '上传 Logo' }}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      class="logo-uploader__input"
                      @change="handleLogoUpload"
                      :disabled="logoUploading"
                    />
                  </label>
                  <div class="logo-uploader__hint">
                    支持 PNG / JPG / SVG / WebP 格式，建议正方形，最大 2MB<br/>
                    <span class="logo-uploader__hint-accent">上传后将自动出现在健康信息小档案的文件头部</span>
                  </div>
                </div>
              </div>
            </el-form-item>

            <el-divider class="store-divider" />

            <el-form-item label="门店名称">
              <el-input v-model="storeInfo.name" placeholder="例如：陪了个伴管理中心" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="storeInfo.phone" placeholder="例如：0755-88888888 或 13800138000" />
              <div class="form-hint">小程序「联系门店」将直接拨打此号码</div>
            </el-form-item>
            <el-form-item label="门店地址">
              <el-input v-model="storeInfo.address" type="textarea" :rows="2" placeholder="例如：深圳市南山区科技园xx路xx号" />
            </el-form-item>
            <el-form-item label="营业时间">
              <el-input v-model="storeInfo.hours" placeholder="例如：周一至周六 09:00-18:00" />
            </el-form-item>
            <el-form-item label="门店微信号">
              <el-input v-model="storeInfo.wechat" placeholder="例如：QiaoGuoHealth（选填）" />
            </el-form-item>
            <el-form-item label="地图经度">
              <el-input v-model="storeInfo.longitude" placeholder="例如：113.9441（选填，用于地图导航）" />
            </el-form-item>
            <el-form-item label="地图纬度">
              <el-input v-model="storeInfo.latitude" placeholder="例如：22.5400（选填，用于地图导航）" />
            </el-form-item>
            <el-form-item label="门店简介">
              <el-input v-model="storeInfo.description" type="textarea" :rows="3" placeholder="一段简短的门店介绍（选填）" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveStoreInfo">保存门店信息</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="对象存储" name="storage">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">腾讯云对象存储</span>
            <span class="card-head-hint">文档、客户附件、时间线上传会自动走这里配置的存储驱动</span>
          </template>
          <el-form label-width="170px" class="form-wider">
            <el-form-item label="存储驱动">
              <el-radio-group v-model="storageConfig.driver">
                <el-radio value="local">本地存储</el-radio>
                <el-radio value="cos">腾讯云 COS</el-radio>
              </el-radio-group>
            </el-form-item>

            <template v-if="storageConfig.driver === 'cos'">
              <el-alert type="info" :closable="false" class="inline-alert">
                建议在腾讯云先创建好桶，并确认读写权限、跨地域和自定义域名配置。启用后，后台新上传的文件会直接写入你的 COS 桶。
              </el-alert>
              <el-form-item label="SecretId">
                <el-input v-model="storageConfig.cosSecretId" placeholder="请输入腾讯云 API 密钥 SecretId" />
              </el-form-item>
              <el-form-item label="SecretKey">
                <el-input v-model="storageConfig.cosSecretKey" type="password" show-password placeholder="请输入腾讯云 API 密钥 SecretKey" />
              </el-form-item>
              <el-form-item label="Bucket 名称">
                <el-input v-model="storageConfig.cosBucket" placeholder="例如：qiaoguo-1250000000" />
              </el-form-item>
              <el-form-item label="所属地域">
                <el-input v-model="storageConfig.cosRegion" placeholder="例如：ap-guangzhou" />
              </el-form-item>
              <el-form-item label="目录前缀">
                <el-input v-model="storageConfig.cosPathPrefix" placeholder="例如：prod/health-system（可留空）" />
              </el-form-item>
              <el-form-item label="自定义访问域名">
                <el-input v-model="storageConfig.cosCustomDomain" placeholder="例如：https://files.yourdomain.com（可留空）" />
              </el-form-item>
              <el-form-item label="访问协议">
                <el-switch v-model="storageConfig.cosUseHttps" active-text="HTTPS" inactive-text="HTTP" />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button type="primary" :loading="storageSaving" @click="saveStorageConfig">保存对象存储配置</el-button>
              <el-button :loading="storageTesting" @click="handleTestStorage">保存并测试连接</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="录音转写" name="asr">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">腾讯云录音转文字</span>
            <span class="card-head-hint">陪诊员上传问诊录音 / 医嘱录音后，系统会自动提交转写，并允许后续人工修订</span>
          </template>
          <el-form label-width="180px" class="form-wider">
            <el-form-item label="自动转写开关">
              <el-switch v-model="asrConfig.enabled" active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="SecretId">
              <el-input v-model="asrConfig.secretId" placeholder="可留空，默认复用 COS SecretId" />
            </el-form-item>
            <el-form-item label="SecretKey">
              <el-input v-model="asrConfig.secretKey" type="password" show-password placeholder="可留空，默认复用 COS SecretKey" />
            </el-form-item>
            <el-form-item label="所属地域">
              <el-input v-model="asrConfig.region" placeholder="例如：ap-guangzhou" />
            </el-form-item>
            <el-form-item label="引擎模型">
              <el-select v-model="asrConfig.engineModelType" style="width: 100%;">
                <el-option label="16k_zh（中文通用）" value="16k_zh" />
                <el-option label="16k_zh_large（中文大模型）" value="16k_zh_large" />
                <el-option label="16k_zh-PY（中英粤）" value="16k_zh-PY" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="asrSaving" @click="saveAsrConfig">保存录音转写配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="处方 OCR 识别" name="ocr">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">处方 OCR 识别（腾讯云）</span>
            <span class="card-head-hint">陪诊员上传处方图后，自动识别药品名称与剂量，免去手工录入</span>
          </template>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="inline-alert"
            title="申请步骤"
          >
            <template #default>
              <div class="form-hint form-hint--block">
                1. 登录 <a href="https://console.cloud.tencent.com/" target="_blank">腾讯云控制台</a>，搜索「<strong>通用文字识别</strong>」或「<strong>医疗 OCR</strong>」，开通服务；<br/>
                2. 推荐选择「<strong>通用文字识别（高精度版）</strong>」，可识别药名、剂量等文字；<br/>
                3. 前往 <a href="https://console.cloud.tencent.com/cam/capi" target="_blank">API 密钥管理</a> 获取 <strong>SecretId</strong> 和 <strong>SecretKey</strong>（可与 COS/ASR 共用一组）；<br/>
                4. 填写并保存后，需联系开发在 <code>prescription-ocr.service.ts</code> 接入腾讯云 OCR SDK（当前为 stub，SDK 代码待补）。
              </div>
            </template>
          </el-alert>
          <el-form label-width="160px" class="form-wider" style="margin-top: 12px;">
            <el-form-item label="OCR 识别开关">
              <el-switch v-model="ocrConfig.enabled" active-text="开启" inactive-text="关闭（手动录入）" />
            </el-form-item>
            <el-form-item label="服务商">
              <el-select v-model="ocrConfig.provider" style="width: 260px;">
                <el-option label="腾讯云 OCR" value="tencentcloud" />
                <el-option label="百度医疗 OCR（待接入）" value="baidu" />
                <el-option label="禁用" value="disabled" />
              </el-select>
            </el-form-item>
            <el-form-item label="SecretId">
              <el-input v-model="ocrConfig.secretId" placeholder="可留空，默认复用 COS SecretId" />
            </el-form-item>
            <el-form-item label="SecretKey">
              <el-input v-model="ocrConfig.secretKey" type="password" show-password placeholder="可留空，默认复用 COS SecretKey" />
            </el-form-item>
            <el-form-item label="所属地域">
              <el-input v-model="ocrConfig.region" placeholder="例如：ap-guangzhou" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="ocrSaving" @click="saveOcrConfig">保存处方 OCR 配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="企业微信客服链接" name="customer">
        <el-card shadow="never">
          <el-form label-width="180px" class="form-narrow">
            <el-form-item label="企业 ID（CorpID）">
              <el-input
                v-model="corpId"
                placeholder="请输入企业微信 CorpID，例如：ww1234567890abcdef"
              />
            </el-form-item>
            <el-form-item label="客服链接地址">
              <el-input
                v-model="customerServiceUrl"
                type="textarea"
                :rows="3"
                placeholder="请输入企业微信客服链接，例如：https://work.weixin.qq.com/kfid/xxx"
              />
            </el-form-item>
            <el-form-item>
              <div class="form-hint form-hint--block">
                小程序端会使用微信原生 <code>wx.openCustomerServiceChat</code> 打开客服会话，必须同时配置 CorpID 和客服链接。
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveCustomerServiceUrl">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="小程序订阅消息" name="mini-program">
        <el-card shadow="never">
          <el-form label-width="200px" class="form-wider">
            <el-divider content-position="left">推给客户</el-divider>
            <el-form-item label="用药提醒">
              <el-input v-model="medicationReminderTemplateId" placeholder="微信订阅消息模板ID" />
            </el-form-item>
            <el-form-item label="服务前提醒">
              <el-input v-model="orderServiceReminderTemplateId" placeholder="用于服务前 24h/12h/2h 提醒（客户）" />
            </el-form-item>
            <el-form-item label="订单状态通知">
              <el-input v-model="orderStatusNotifyTemplateId" placeholder="陪诊员接单/服务完成/订单取消等状态变化" />
            </el-form-item>
            <el-form-item label="待签署催办">
              <el-input v-model="orderSignReminderTemplateId" placeholder="服务前 6 小时仍未签署确认单时催办" />
            </el-form-item>
            <el-form-item label="待支付催办">
              <el-input v-model="orderPaymentReminderTemplateId" placeholder="服务完成后仍未结算时催办" />
            </el-form-item>
            <el-form-item label="评价邀请">
              <el-input v-model="orderReviewInviteTemplateId" placeholder="服务完成 1 小时后邀请评价" />
            </el-form-item>
            <el-divider content-position="left">推给陪诊员</el-divider>
            <el-form-item label="派单通知">
              <el-input v-model="orderAssignNotifyTemplateId" placeholder="后台指派陪诊员时推送" />
            </el-form-item>
            <el-form-item label="抢单通知">
              <el-input v-model="grabPoolNotifyTemplateId" placeholder="订单放入抢单池时推送给全体陪诊员" />
            </el-form-item>
            <el-form-item label="服务前提醒">
              <el-input v-model="attendantServiceReminderTemplateId" placeholder="服务前 24h/12h/2h 提醒陪诊员" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveMiniProgramTemplates">保存模板配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="业务规则" name="rules">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">业务规则配置</span>
            <span class="card-head-hint">统一维护咨询号源与取消退款规则</span>
          </template>

          <el-divider content-position="left">预约号源规则</el-divider>
          <el-form inline>
            <el-form-item label="开始">
              <el-time-picker v-model="slotRule.startTime" value-format="HH:mm" format="HH:mm" placeholder="09:00" class="time-picker-sm" />
            </el-form-item>
            <el-form-item label="结束">
              <el-time-picker v-model="slotRule.endTime" value-format="HH:mm" format="HH:mm" placeholder="17:00" class="time-picker-sm" />
            </el-form-item>
            <el-form-item label="间隔(分钟)">
              <el-input-number v-model="slotRule.intervalMinutes" :min="10" :max="120" :step="5" />
            </el-form-item>
            <el-form-item label="每时段放号">
              <el-input-number v-model="slotRule.capacityPerSlot" :min="1" :max="99" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSlotRule">保存号源规则</el-button>
            </el-form-item>
          </el-form>
          <div class="slot-preview">
            <span class="slot-preview__label">时段预览：</span>
            <el-tag v-for="s in slotPreview" :key="s" size="small" class="slot-preview__tag">{{ s }}</el-tag>
          </div>

          <el-divider content-position="left">取消退款规则</el-divider>
          <el-table :data="cancelRules" stripe>
            <el-table-column prop="range" label="取消时间点" />
            <el-table-column label="扣除比例 (%)" width="200">
              <template #default="{ row }">
                <el-input-number v-model="row.deduction" :min="0" :max="100" :step="5" />
              </template>
            </el-table-column>
          </el-table>
          <div class="rule-submit">
            <el-button type="primary" @click="saveCancelRules">保存取消规则</el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="AI 智能问诊" name="ai">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">AI 智能问诊配置</span>
            <span class="card-head-hint">配置大模型 API，为小程序用户提供智能健康问诊</span>
          </template>
          <el-form label-width="160px" class="form-narrow">
            <el-form-item label="功能开关">
              <el-switch v-model="aiConfig.enabled" active-text="开启" inactive-text="关闭" />
            </el-form-item>

            <el-divider content-position="left">小程序展示</el-divider>
            <el-form-item label="AI 智能导诊">
              <el-switch
                v-model="aiConfig.miniprogramShowAiTriage"
                active-text="展示入口"
                inactive-text="隐藏"
              />
              <div class="form-hint">关闭后，小程序不显示导诊入口，用户端导诊相关接口会拒绝</div>
            </el-form-item>
            <el-form-item label="AI 健康顾问">
              <el-switch
                v-model="aiConfig.miniprogramShowAiAdvisor"
                active-text="展示入口"
                inactive-text="隐藏"
              />
              <div class="form-hint">关闭后，小程序不显示顾问入口；问诊/读图/语音等顾问能力接口会拒绝（健康周报仍可在后台与周报页使用）</div>
            </el-form-item>

            <el-divider content-position="left">模型配置</el-divider>
            <el-form-item label="API Key">
              <el-input v-model="aiConfig.apiKey" type="password" show-password placeholder="sk-xxx" />
            </el-form-item>
            <el-form-item label="API 地址">
              <el-input v-model="aiConfig.baseUrl" placeholder="https://api.deepseek.com" />
            </el-form-item>
            <el-form-item label="模型名称">
              <el-input v-model="aiConfig.model" placeholder="deepseek-chat" />
            </el-form-item>
            <el-form-item label="视觉模型（可选）">
              <el-input v-model="aiConfig.visionModel" placeholder="留空=不读图；如 gpt-4o-mini" />
            </el-form-item>
            <el-divider content-position="left">健康材料读图（可选）</el-divider>
            <el-form-item label="读图 API Key">
              <el-input v-model="aiConfig.visionApiKey" type="password" show-password placeholder="留空=与上方 API Key 相同" />
            </el-form-item>
            <el-form-item label="读图 API 地址">
              <el-input v-model="aiConfig.visionBaseUrl" placeholder="留空=与上方 API 地址相同" />
            </el-form-item>
            <el-form-item label="Temperature">
              <el-slider v-model="aiConfig.temperature" :min="0" :max="1" :step="0.1" show-input class="temperature-slider" />
            </el-form-item>
            <el-form-item label="最大 Token 数">
              <el-input-number v-model="aiConfig.maxTokens" :min="256" :max="8192" :step="256" />
            </el-form-item>

            <el-divider content-position="left">语音转文字（小程序 AI 顾问）</el-divider>
            <el-form-item label="Speech API Key">
              <el-input v-model="speechConfig.apiKey" type="password" show-password placeholder="可与大模型相同或单独密钥" />
            </el-form-item>
            <el-form-item label="Speech API 根地址">
              <el-input v-model="speechConfig.apiBase" placeholder="https://api.openai.com/v1" />
            </el-form-item>
            <el-form-item label="Speech 模型">
              <el-input v-model="speechConfig.model" placeholder="whisper-1" />
            </el-form-item>

            <el-divider content-position="left">系统提示词（Prompt）</el-divider>
            <el-form-item label="">
              <el-input
                v-model="aiConfig.systemPrompt"
                type="textarea"
                :rows="10"
                placeholder="留空则使用内置的默认医疗分诊提示词"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="aiSaving" @click="saveAiConfig">保存 AI 配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="短信通知" name="sms">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">腾讯云短信（用药 / 复诊提醒）</span>
            <span class="card-head-hint">开启后，所有用药与复诊提醒将同时通过「小程序订阅消息」和「短信」两个渠道触达老人与家属</span>
          </template>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="inline-alert"
            title="上线前请务必完成以下准备"
          >
            <template #default>
              <div class="form-hint form-hint--block">
                1. 在腾讯云控制台「云短信」开通服务，<strong>申请签名</strong>（如「陪了个伴」）并等待审核通过；<br/>
                2. <strong>申请两个正文模板</strong>并等待审核通过：<br/>
                &nbsp;&nbsp;· 用药提醒：<code>提醒{1}该服药啦：{2}，用量{3}，请按时服用。</code>（变量：患者名/药名/剂量）<br/>
                &nbsp;&nbsp;· 复诊提醒：<code>{1}将于{2}复诊（{3}），请提前准备好病历和医保卡。</code>（变量：患者名/日期/医院科室）<br/>
                3. 创建应用获取 <strong>SdkAppId</strong>，API 密钥可复用 COS / ASR 同一组；<br/>
                4. 短信按条数计费（约 0.045 元/条），请打开「每手机号每日上限」保护避免误配置刷爆。
              </div>
            </template>
          </el-alert>

          <el-form label-width="160px" class="form-wider">
            <el-form-item label="短信总开关">
              <el-switch v-model="smsConfig.enabled" />
              <span class="form-hint" style="margin-left: 12px;">关闭后即使其他配置完整，也不会发送任何短信（只发小程序订阅消息）</span>
            </el-form-item>
            <el-form-item label="SecretId">
              <el-input v-model="smsConfig.secretId" placeholder="腾讯云访问密钥 SecretId（可复用 COS / ASR）" />
            </el-form-item>
            <el-form-item label="SecretKey">
              <el-input v-model="smsConfig.secretKey" type="password" show-password placeholder="腾讯云访问密钥 SecretKey" />
            </el-form-item>
            <el-form-item label="SdkAppId">
              <el-input v-model="smsConfig.sdkAppId" placeholder="如 1400123456（云短信 → 应用管理）" />
            </el-form-item>
            <el-form-item label="签名">
              <el-input v-model="smsConfig.signName" placeholder="已审核通过的签名内容，如 陪了个伴" />
              <div class="form-hint">签名会自动拼接在正文前（如「【陪了个伴】…」），这里只填签名文字本身，无需带方括号。</div>
            </el-form-item>

            <el-divider content-position="left">模板 ID</el-divider>
            <el-form-item label="用药提醒模板 ID">
              <el-input v-model="smsConfig.templateMedicationReminder" placeholder="腾讯云审核通过的用药提醒模板 ID" />
            </el-form-item>
            <el-form-item label="复诊提醒模板 ID">
              <el-input v-model="smsConfig.templateFollowUpReminder" placeholder="腾讯云审核通过的复诊提醒模板 ID" />
            </el-form-item>

            <el-divider content-position="left">成本保护</el-divider>
            <el-form-item label="每手机号每日上限">
              <el-input-number v-model="smsConfig.dailyLimitPerPhone" :min="1" :max="200" :step="1" />
              <div class="form-hint">
                默认 10 条/天/手机号。超过上限后，当次提醒只走小程序，短信跳过并写日志（可在数据库 <code>sms_send_logs</code> 表查看原因）。
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="smsSaving" @click="saveSmsConfig">保存短信通知配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="服务申请指南" name="guide">
        <el-card shadow="never">
          <template #header>
            <span class="card-head-title">第三方服务申请指南</span>
            <span class="card-head-hint">汇总本系统依赖的所有外部 API，方便随时查阅申请入口</span>
          </template>

          <el-descriptions title="① AI 大模型（智能问诊 / 健康顾问）" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">小程序「AI 智能导诊」「AI 健康顾问」「健康周报生成」</el-descriptions-item>
            <el-descriptions-item label="推荐服务商">DeepSeek（国内低延迟、低费用）；也可替换为 OpenAI、Claude、Qwen 等兼容 OpenAI API 的服务</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://platform.deepseek.com/" target="_blank">https://platform.deepseek.com/</a>（DeepSeek）</el-descriptions-item>
            <el-descriptions-item label="需要的凭证">API Key（sk-xxx）、API 地址、模型名称（deepseek-chat）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → AI 智能问诊 → API Key / API 地址 / 模型名称</el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="② 处方 OCR 识别（药品名称自动识别）" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">陪诊员拍处方照片后，自动识别药品名称与剂量，免手工录入</el-descriptions-item>
            <el-descriptions-item label="推荐服务商">腾讯云「通用文字识别（高精度版）」</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://console.cloud.tencent.com/ocr/overview" target="_blank">腾讯云 OCR 控制台</a></el-descriptions-item>
            <el-descriptions-item label="需要的凭证">SecretId、SecretKey（可与 COS 共用）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → 处方 OCR 识别</el-descriptions-item>
            <el-descriptions-item label="注意">
              配置填写后，还需开发在代码 <code>prescription-ocr.service.ts</code> 中接入 SDK（当前为 stub，需补全 SDK 调用代码）
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="③ 腾讯云 COS（文件对象存储）" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">陪诊员上传的图片、文件、时间线附件、处方照片等存储</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://console.cloud.tencent.com/cos" target="_blank">腾讯云 COS 控制台</a></el-descriptions-item>
            <el-descriptions-item label="需要的凭证">SecretId、SecretKey、Bucket 名称、所属地域（如 ap-guangzhou）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → 对象存储</el-descriptions-item>
            <el-descriptions-item label="注意">创建 Bucket 时需开放「公有读私有写」或配置 CDN 自定义域名方便图片访问</el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="④ 腾讯云 ASR（录音转文字）" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">陪诊员上传问诊录音、医嘱录音后，自动转成文字供后续查阅</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://console.cloud.tencent.com/asr" target="_blank">腾讯云 ASR 控制台</a></el-descriptions-item>
            <el-descriptions-item label="需要的凭证">SecretId、SecretKey（可与 COS 共用同一组 API 密钥）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → 录音转写</el-descriptions-item>
            <el-descriptions-item label="注意">推荐引擎：16k_zh（中文通用），若录音含粤语可选 16k_zh-PY</el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="⑤ 腾讯云 SMS（短信通知）" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">用药提醒、复诊提醒 SMS 短信，给老人手机发送</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://console.cloud.tencent.com/smsv2" target="_blank">腾讯云短信控制台</a></el-descriptions-item>
            <el-descriptions-item label="需要的凭证">SecretId / SecretKey（同 COS）、SdkAppId（创建应用后获得）、签名（如「陪了个伴」）、模板 ID（两个：用药/复诊）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → 短信通知</el-descriptions-item>
            <el-descriptions-item label="注意">签名和模板需提前申请审核（1~3 个工作日），模板示例：<br/>用药：<code>提醒{1}该服药啦：{2}，用量{3}，请按时服用。</code><br/>复诊：<code>{1}将于{2}复诊（{3}），请提前准备好病历和医保卡。</code></el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="⑥ 微信小程序订阅消息模板" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">用药提醒、派单通知、订单状态变化等推送给用户小程序</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://mp.weixin.qq.com/" target="_blank">微信公众平台</a> → 功能 → 订阅消息 → 选用模板</el-descriptions-item>
            <el-descriptions-item label="需要的凭证">各类消息的模板 ID（在「订阅消息」里选用后自动生成）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → 小程序订阅消息</el-descriptions-item>
            <el-descriptions-item label="需要配置的模板">用药提醒、服务前提醒（客户/陪诊员）、派单通知、抢单通知、订单状态通知、待签署催办、待支付催办、评价邀请（共 9 个）</el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="⑦ 企业微信客服" :column="1" border class="guide-desc">
            <el-descriptions-item label="用途">小程序「联系客服」按钮，使用企业微信原生客服会话</el-descriptions-item>
            <el-descriptions-item label="申请地址"><a href="https://work.weixin.qq.com/" target="_blank">企业微信官网</a> → 注册企业 → 客服 → 创建客服账号</el-descriptions-item>
            <el-descriptions-item label="需要的凭证">企业 CorpID、客服链接（格式：https://work.weixin.qq.com/kfid/xxx）</el-descriptions-item>
            <el-descriptions-item label="配置位置">系统配置 → 企业微信客服链接</el-descriptions-item>
          </el-descriptions>

        </el-card>
      </el-tab-pane>

      <el-tab-pane label="关于系统" name="about">
        <el-card shadow="never">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="系统名称">陪了个伴管理系统</el-descriptions-item>
            <el-descriptions-item label="当前版本">V1.0</el-descriptions-item>
            <el-descriptions-item label="技术栈">Vue3 + Element Plus + NestJS + MySQL</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.page-alert {
  margin-bottom: $space-4;
}

// 卡片头部：标题 + 灰色补充文字
.card-head-title {
  font-weight: 600;
  color: $text-primary;
}

.card-head-hint {
  color: $text-tertiary;
  font-size: $font-sm;
  margin-left: $space-2;
}

// 表单宽度
.form-narrow { max-width: 660px; }
.form-wider { max-width: 760px; }

// 表单辅助提示
.form-hint {
  color: $text-tertiary;
  font-size: $font-xs;
  margin-top: 4px;
  line-height: 1.6;

  &--block {
    font-size: $font-sm;
    line-height: 1.8;
  }
}

// 内嵌 Alert
.inline-alert {
  margin-bottom: $space-4;
}

// 时间选择器小号
.time-picker-sm {
  :deep(.el-input) { width: 120px; }
}

// 时段预览
.slot-preview {
  margin-top: $space-2;

  &__label {
    color: $text-secondary;
    font-size: $font-sm;
  }

  &__tag {
    margin: 2px 4px;
  }
}

.rule-submit {
  margin-top: $space-5;
}

// 温度滑块
.temperature-slider {
  :deep(.el-slider) { max-width: 400px; }
}

// ── Logo 上传块 ──
.logo-uploader {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;

  &__preview {
    position: relative;
    display: inline-block;
  }

  &__img {
    width: 88px;
    height: 88px;
    object-fit: contain;
    border: 1px solid rgba($primary-500, 0.25);
    border-radius: 10px;
    background: rgba($primary-500, 0.06);
    padding: 6px;
  }

  &__remove {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 22px;
    height: 22px;
    min-height: 22px;
    padding: 0;
    font-size: 11px;
    border-radius: 50%;
  }

  &__placeholder {
    width: 88px;
    height: 88px;
    border: 2px dashed rgba($primary-500, 0.35);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba($primary-500, 0.05);
    color: rgba($primary-600, 0.45);
    gap: 4px;
  }

  &__placeholder-icon { font-size: 28px; }
  &__placeholder-text { font-size: 11px; }

  &__action {
    flex: 1;
    min-width: 220px;
  }

  &__btn {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: $primary-600;
    color: #fff;
    padding: 7px 16px;
    border-radius: $radius-sm;
    font-size: $font-sm;
    font-weight: 500;
    transition: opacity 0.2s, background 0.2s;

    &:hover {
      background: $primary-700;
    }

    &.is-loading {
      opacity: 0.6;
      pointer-events: none;
    }
  }

  &__input { display: none; }

  &__hint {
    color: $text-tertiary;
    font-size: $font-xs;
    margin-top: 8px;
    line-height: 1.6;
  }

  &__hint-accent {
    color: $primary-600;
    font-weight: 500;
  }
}

.store-divider {
  margin: 8px 0 16px;
}

.guide-desc {
  margin-bottom: 8px;

  :deep(.el-descriptions__title) {
    font-size: 15px;
    font-weight: 600;
    color: $primary-700;
  }
  :deep(a) {
    color: $primary-600;
    text-decoration: underline;
  }
  :deep(code) {
    background: rgba($primary-500, 0.08);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 12px;
    color: #c44;
  }
}
</style>
