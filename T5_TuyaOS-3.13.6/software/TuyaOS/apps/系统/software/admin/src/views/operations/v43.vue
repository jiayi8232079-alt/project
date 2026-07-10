<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ackAlert,
  createCommunityContent,
  createFamilyMessage,
  createFamilyTask,
  createHospitalPartnership,
  createServiceProvider,
  createVoiceprint,
  escalateAlert,
  falseAlarmAlert,
  getDeviceSettings,
  listAlerts,
  listCommunityContent,
  listContentDeliveries,
  listFamilyTasks,
  listHospitalPartnerships,
  listServiceProviders,
  listVoiceprints,
  mockAlert,
  mockContentDeliveryAck,
  mockFamilyTaskReceipt,
  publishCommunityContent,
  revokeCommunityContent,
  saveDeviceSettings,
  updateVoiceprintStatus,
} from '@/api/v43'

const activeTab = ref('alerts')
const loading = ref(false)

const alerts = ref<any[]>([])
const communityItems = ref<any[]>([])
const deliveries = ref<any[]>([])
const familyTasks = ref<any[]>([])
const voiceprints = ref<any[]>([])
const providers = ref<any[]>([])
const partnerships = ref<any[]>([])
const deviceSettingsResult = ref<any>(null)

const mockAlertForm = reactive({
  userId: 1,
  serviceTargetId: undefined as number | undefined,
  type: 'fall',
  deviceId: 1,
  deviceName: '陪伴机器人',
  targetName: '老人',
})

const deviceForm = reactive({
  deviceId: 1,
  volume: 70,
  speechRate: 1,
  screenBrightness: 80,
  sosHoldSeconds: 3,
  autoEscalation: 'family_then_community',
  communityContentEnabled: true,
  privacyVisibility: 'guardian_only',
  quietHours: [{ start: '21:00', end: '07:00' }],
})

const contentForm = reactive({
  title: '防诈骗提醒',
  body: '近期请注意陌生来电和转账请求。',
  voiceScript: '社区提醒您，近期请注意陌生来电和转账请求。',
  category: 'anti_fraud',
  priority: 'high',
  deviceIdsText: '1',
})

const familyForm = reactive({
  familyId: 1,
  elderId: 1,
  message: '爸，记得喝水。',
  taskTitle: '提醒喝水',
  taskType: 'drink_water',
  voiceprintMemberId: 1,
})

const providerForm = reactive({
  name: '安心家政',
  type: 'housekeeping',
  serviceAreaText: '杭州',
  catalogText: '[{"code":"cleaning","name":"保洁","price":199}]',
})

const hospitalForm = reactive({
  hospitalId: 1,
  hospitalName: '杭州市第一人民医院',
  partnershipType: 'follow_up',
  resourcesText: '[{"department":"老年医学科"}]',
})

function parseIds(text: string) {
  return text.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v))
}

function parseJsonArray(text: string) {
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function refreshAlerts() {
  alerts.value = (await listAlerts({ pageSize: 20 }) as any).items ?? []
}

async function refreshCommunity() {
  communityItems.value = await listCommunityContent() as any[]
  deliveries.value = await listContentDeliveries() as any[]
}

async function refreshFamily() {
  familyTasks.value = await listFamilyTasks(familyForm.familyId) as any[]
  voiceprints.value = await listVoiceprints(familyForm.familyId) as any[]
}

async function refreshServices() {
  providers.value = await listServiceProviders() as any[]
  partnerships.value = await listHospitalPartnerships() as any[]
}

async function refreshAll() {
  await Promise.all([refreshAlerts(), refreshCommunity(), refreshFamily(), refreshServices()])
}

async function run(action: () => Promise<unknown>, message = '操作成功') {
  loading.value = true
  try {
    await action()
    ElMessage.success(message)
  } finally {
    loading.value = false
  }
}

async function submitMockAlert() {
  await run(async () => {
    await mockAlert({ ...mockAlertForm, payload: { source: 'admin_mock' } })
    await refreshAlerts()
  }, 'mock 告警已创建')
}

async function submitDeviceSettings() {
  await run(async () => {
    deviceSettingsResult.value = await saveDeviceSettings(deviceForm.deviceId, { ...deviceForm })
  }, '设备设置已保存')
}

async function loadDeviceSettings() {
  await run(async () => {
    deviceSettingsResult.value = await getDeviceSettings(deviceForm.deviceId)
  }, '设备设置已加载')
}

async function submitCommunityContent() {
  await run(async () => {
    await createCommunityContent({
      title: contentForm.title,
      body: contentForm.body,
      voiceScript: contentForm.voiceScript,
      category: contentForm.category,
      priority: contentForm.priority,
      target: { deviceIds: parseIds(contentForm.deviceIdsText) },
    })
    await refreshCommunity()
  }, '社区内容草稿已创建')
}

async function submitFamilyMessage() {
  await run(async () => {
    await createFamilyMessage({
      familyId: familyForm.familyId,
      elderId: familyForm.elderId,
      message: familyForm.message,
    })
  }, '家庭留言已创建')
}

async function submitFamilyTask() {
  await run(async () => {
    await createFamilyTask({
      familyId: familyForm.familyId,
      elderId: familyForm.elderId,
      title: familyForm.taskTitle,
      type: familyForm.taskType,
      message: familyForm.message,
    })
    await refreshFamily()
  }, '家庭任务已创建')
}

async function submitVoiceprint() {
  await run(async () => {
    await createVoiceprint({ familyId: familyForm.familyId, memberId: familyForm.voiceprintMemberId })
    await refreshFamily()
  }, '声纹记录已创建')
}

async function submitProvider() {
  await run(async () => {
    await createServiceProvider({
      name: providerForm.name,
      type: providerForm.type,
      serviceArea: providerForm.serviceAreaText.split(',').map((v) => v.trim()).filter(Boolean),
      catalog: parseJsonArray(providerForm.catalogText),
    })
    await refreshServices()
  }, '服务商已创建')
}

async function submitHospitalPartnership() {
  await run(async () => {
    await createHospitalPartnership({
      hospitalId: hospitalForm.hospitalId,
      hospitalName: hospitalForm.hospitalName,
      partnershipType: hospitalForm.partnershipType,
      resources: parseJsonArray(hospitalForm.resourcesText),
    })
    await refreshServices()
  }, '合作医院资源已创建')
}

onMounted(async () => {
  await refreshAll()
})
</script>

<template>
  <div class="v43-page" v-loading="loading">
    <div class="hero">
      <div>
        <p class="eyebrow">V4.3 WithKin Operations</p>
        <h1>家庭 · 社区 · 服务协同中台</h1>
        <p>集中管理安全告警、设备设置、社区触达、家庭任务、声纹、服务商和合作医院。</p>
      </div>
      <el-button type="primary" @click="refreshAll">
        刷新全部
      </el-button>
    </div>

    <el-tabs v-model="activeTab" class="ops-tabs">
      <el-tab-pane label="告警处置" name="alerts">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-card header="生成安全 Mock">
              <el-form label-width="92px">
                <el-form-item label="用户ID"><el-input-number v-model="mockAlertForm.userId" :min="1" /></el-form-item>
                <el-form-item label="设备ID"><el-input-number v-model="mockAlertForm.deviceId" :min="1" /></el-form-item>
                <el-form-item label="类型">
                  <el-select v-model="mockAlertForm.type">
                    <el-option label="视觉跌倒" value="fall" />
                    <el-option label="SOS" value="sos" />
                    <el-option label="体征异常" value="vital_anomaly" />
                  </el-select>
                </el-form-item>
                <el-button type="danger" @click="submitMockAlert">生成告警</el-button>
              </el-form>
            </el-card>
          </el-col>
          <el-col :span="16">
            <el-card header="告警列表">
              <el-table :data="alerts" height="360">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="title" label="标题" min-width="180" />
                <el-table-column prop="severity" label="级别" width="90" />
                <el-table-column prop="status" label="状态" width="110" />
                <el-table-column label="操作" width="280">
                  <template #default="{ row }">
                    <el-button size="small" @click="run(async () => { await ackAlert(row.id, '后台接管'); await refreshAlerts() })">接管</el-button>
                    <el-button size="small" @click="run(async () => { await escalateAlert(row.id, 'community', '升级社区'); await refreshAlerts() })">升级</el-button>
                    <el-button size="small" type="warning" @click="run(async () => { await falseAlarmAlert(row.id, '误报'); await refreshAlerts() })">误报</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="设备设置" name="device">
        <el-card header="设备设置下发">
          <el-form :inline="true">
            <el-form-item label="设备ID"><el-input-number v-model="deviceForm.deviceId" :min="1" /></el-form-item>
            <el-form-item label="音量"><el-input-number v-model="deviceForm.volume" :min="0" :max="100" /></el-form-item>
            <el-form-item label="亮度"><el-input-number v-model="deviceForm.screenBrightness" :min="0" :max="100" /></el-form-item>
            <el-form-item label="SOS秒数"><el-input-number v-model="deviceForm.sosHoldSeconds" :min="1" :max="10" /></el-form-item>
            <el-form-item label="升级策略">
              <el-select v-model="deviceForm.autoEscalation" style="width: 190px">
                <el-option label="家属后社区" value="family_then_community" />
                <el-option label="仅家属" value="family_only" />
                <el-option label="家属后人工" value="family_then_manual" />
              </el-select>
            </el-form-item>
            <el-button @click="loadDeviceSettings">读取</el-button>
            <el-button type="primary" @click="submitDeviceSettings">保存并下发</el-button>
          </el-form>
          <pre class="json-preview">{{ JSON.stringify(deviceSettingsResult, null, 2) }}</pre>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="社区触达" name="community">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-card header="新建通知">
              <el-form label-width="80px">
                <el-form-item label="标题"><el-input v-model="contentForm.title" /></el-form-item>
                <el-form-item label="正文"><el-input v-model="contentForm.body" type="textarea" /></el-form-item>
                <el-form-item label="设备ID"><el-input v-model="contentForm.deviceIdsText" /></el-form-item>
                <el-button type="primary" @click="submitCommunityContent">保存草稿</el-button>
              </el-form>
            </el-card>
          </el-col>
          <el-col :span="16">
            <el-card header="内容与回执">
              <el-table :data="communityItems" height="220">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="title" label="标题" />
                <el-table-column prop="status" label="状态" width="110" />
                <el-table-column label="操作" width="170">
                  <template #default="{ row }">
                    <el-button size="small" @click="run(async () => { await publishCommunityContent(row.id); await refreshCommunity() })">发布</el-button>
                    <el-button size="small" @click="run(async () => { await revokeCommunityContent(row.id); await refreshCommunity() })">撤回</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-table :data="deliveries" height="180" class="mt">
                <el-table-column prop="id" label="回执ID" width="90" />
                <el-table-column prop="contentId" label="内容ID" width="90" />
                <el-table-column prop="deviceId" label="设备ID" width="90" />
                <el-table-column prop="status" label="状态" />
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button size="small" @click="run(async () => { await mockContentDeliveryAck(row.id, 'played'); await refreshCommunity() })">播报</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="家庭与声纹" name="family">
        <el-card header="家庭任务 / 投喂 / 声纹">
          <el-form :inline="true">
            <el-form-item label="家庭ID"><el-input-number v-model="familyForm.familyId" :min="1" /></el-form-item>
            <el-form-item label="老人ID"><el-input-number v-model="familyForm.elderId" :min="1" /></el-form-item>
            <el-form-item label="留言"><el-input v-model="familyForm.message" /></el-form-item>
            <el-button @click="submitFamilyMessage">创建留言</el-button>
            <el-button type="primary" @click="submitFamilyTask">创建任务</el-button>
            <el-button @click="submitVoiceprint">创建声纹</el-button>
            <el-button @click="refreshFamily">刷新</el-button>
          </el-form>
          <el-table :data="familyTasks" height="220">
            <el-table-column prop="id" label="任务ID" width="90" />
            <el-table-column prop="title" label="标题" />
            <el-table-column prop="status" label="状态" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" @click="run(async () => { await mockFamilyTaskReceipt(row.id, 'broadcasted', '已响应'); await refreshFamily() })">回执</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-table :data="voiceprints" height="180" class="mt">
            <el-table-column prop="id" label="声纹ID" width="90" />
            <el-table-column prop="memberId" label="成员ID" />
            <el-table-column prop="status" label="状态" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" @click="run(async () => { await updateVoiceprintStatus(row.id, 'active', 0.92); await refreshFamily() })">激活</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="服务与医院" name="services">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card header="服务商">
              <el-form label-width="80px">
                <el-form-item label="名称"><el-input v-model="providerForm.name" /></el-form-item>
                <el-form-item label="类型"><el-input v-model="providerForm.type" /></el-form-item>
                <el-form-item label="区域"><el-input v-model="providerForm.serviceAreaText" /></el-form-item>
                <el-button type="primary" @click="submitProvider">新增服务商</el-button>
              </el-form>
              <el-table :data="providers" height="220" class="mt">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="name" label="名称" />
                <el-table-column prop="type" label="类型" />
              </el-table>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card header="合作医院">
              <el-form label-width="80px">
                <el-form-item label="医院"><el-input v-model="hospitalForm.hospitalName" /></el-form-item>
                <el-form-item label="类型"><el-input v-model="hospitalForm.partnershipType" /></el-form-item>
                <el-button type="primary" @click="submitHospitalPartnership">新增合作</el-button>
              </el-form>
              <el-table :data="partnerships" height="220" class="mt">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="hospitalName" label="医院" />
                <el-table-column prop="partnershipType" label="合作类型" />
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.v43-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, #10233f, #1f6b6d);
  color: #fff;
  box-shadow: 0 18px 45px rgb(16 35 63 / 20%);

  h1 {
    margin: 4px 0 8px;
    font-size: 26px;
  }

  p {
    margin: 0;
    opacity: .84;
  }
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: .14em;
  font-size: 12px;
}

.ops-tabs {
  :deep(.el-tabs__content) {
    overflow: visible;
  }
}

.json-preview {
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  background: #0f172a;
  color: #dbeafe;
  max-height: 280px;
  overflow: auto;
}

.mt {
  margin-top: 16px;
}
</style>
