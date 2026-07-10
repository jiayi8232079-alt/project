<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAgentConfig,
  getAgentVersions,
  publishAgent,
  saveAgentDraft,
  type AgentConfig,
} from '@/api/ai-config'

const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const versionsVisible = ref(false)
const versions = ref<AgentConfig[]>([])
const published = ref<AgentConfig | null>(null)
const draftId = ref<number | null>(null)

const MODEL_OPTIONS = ['DeepSeek', '通义千问', '豆包', '文心一言', 'GPT-4o']

const form = reactive({
  name: '陪诊助手',
  model: 'DeepSeek',
  systemPrompt: '',
  memoryRounds: 20,
  temperature: 0.7,
  knowledgeBase: '',
  remark: '',
  tools: {
    deviceControl: true,
    endpointMcp: true,
    customMcp: true,
    faceTrack: false,
  } as Record<string, boolean>,
})

function applyConfig(cfg: AgentConfig) {
  form.name = cfg.name
  form.model = cfg.model
  form.systemPrompt = cfg.systemPrompt ?? ''
  form.memoryRounds = cfg.memoryRounds ?? 20
  form.temperature = cfg.temperature ?? 0.7
  form.knowledgeBase = cfg.knowledgeBase ?? ''
  form.remark = cfg.remark ?? ''
  const tools = (cfg.tools as Record<string, boolean>) || {}
  form.tools = {
    deviceControl: tools.deviceControl ?? true,
    endpointMcp: tools.endpointMcp ?? true,
    customMcp: tools.customMcp ?? true,
    faceTrack: tools.faceTrack ?? false,
  }
}

async function load() {
  loading.value = true
  try {
    const res = await getAgentConfig()
    applyConfig(res.working)
    published.value = res.published
    draftId.value = res.hasDraft ? (res.working.id ?? null) : null
  } finally {
    loading.value = false
  }
}

function payload() {
  return {
    name: form.name,
    model: form.model,
    systemPrompt: form.systemPrompt,
    memoryRounds: form.memoryRounds,
    temperature: form.temperature,
    knowledgeBase: form.knowledgeBase,
    remark: form.remark,
    tools: form.tools,
  }
}

async function handleSave() {
  saving.value = true
  try {
    const res = await saveAgentDraft(payload())
    draftId.value = res.id ?? null
    ElMessage.success('草稿已保存')
  } finally {
    saving.value = false
  }
}

async function handlePublish() {
  try {
    await ElMessageBox.confirm('发布后将立即对设备生效，旧版本归档。确认发布？', '发布确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  publishing.value = true
  try {
    const draft = await saveAgentDraft(payload())
    const pub = await publishAgent(draft.id as number)
    published.value = pub
    ElMessage.success(`已发布 v${pub.version}`)
    await load()
  } finally {
    publishing.value = false
  }
}

async function openVersions() {
  versions.value = await getAgentVersions()
  versionsVisible.value = true
}

const STATUS_LABEL: Record<string, { text: string; type: 'success' | 'info' | 'warning' }> = {
  published: { text: '已发布', type: 'success' },
  draft: { text: '草稿', type: 'warning' },
  archived: { text: '已归档', type: 'info' },
}

onMounted(load)
</script>

<template>
  <div class="agent-config" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>AI 智能体配置</h2>
        <span v-if="published">
          当前生效：<strong>v{{ published.version }}</strong> · {{ published.name }} ·
          {{ published.model }}
        </span>
        <span v-else class="muted">尚未发布任何版本</span>
      </div>
      <div class="actions">
        <el-button @click="openVersions">版本历史</el-button>
        <el-button :loading="saving" @click="handleSave">保存草稿</el-button>
        <el-button type="primary" :loading="publishing" @click="handlePublish">发布</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card shadow="never" class="card">
          <template #header><span>基础配置</span></template>
          <el-form label-width="110px">
            <el-form-item label="智能体名称">
              <el-input v-model="form.name" maxlength="64" />
            </el-form-item>
            <el-form-item label="模型">
              <el-select v-model="form.model" filterable allow-create style="width: 100%">
                <el-option v-for="m in MODEL_OPTIONS" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
            <el-form-item label="系统 Prompt">
              <el-input
                v-model="form.systemPrompt"
                type="textarea"
                :rows="10"
                placeholder="定义角色、语气、安全边界、医疗免责声明等"
              />
            </el-form-item>
            <el-form-item label="知识库">
              <el-input
                v-model="form.knowledgeBase"
                type="textarea"
                :rows="4"
                placeholder="陪诊流程 / 平台 FAQ / 健康科普（限权威源），可填引用说明"
              />
            </el-form-item>
            <el-form-item label="版本备注">
              <el-input v-model="form.remark" maxlength="255" placeholder="本次修改说明" />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card shadow="never" class="card">
          <template #header><span>对话参数</span></template>
          <el-form label-width="110px">
            <el-form-item label="记忆轮数">
              <el-input-number v-model="form.memoryRounds" :min="0" :max="100" />
            </el-form-item>
            <el-form-item label="采样温度">
              <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="card" style="margin-top: 16px">
          <template #header><span>工具集开关</span></template>
          <div class="tool-row">
            <span>设备自控（音量 / PTZ / 勿扰）</span>
            <el-switch v-model="form.tools.deviceControl" />
          </div>
          <div class="tool-row">
            <span>端侧 MCP（闹钟 / 提醒 / 计时）</span>
            <el-switch v-model="form.tools.endpointMcp" />
          </div>
          <div class="tool-row">
            <span>自定义 MCP（业务工具）</span>
            <el-switch v-model="form.tools.customMcp" />
          </div>
          <div class="tool-row">
            <span>人脸追踪</span>
            <el-switch v-model="form.tools.faceTrack" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-drawer v-model="versionsVisible" title="版本历史" size="640px">
      <el-table :data="versions" size="small">
        <el-table-column prop="version" label="版本" width="80">
          <template #default="{ row }">v{{ row.version }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_LABEL[row.status]?.type || 'info'">
              {{ STATUS_LABEL[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="model" label="模型" width="110" />
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        <el-table-column label="发布时间" width="170">
          <template #default="{ row }">{{ row.publishedAt || '—' }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.agent-config {
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
  color: #475569;
}
.page-head .muted {
  color: #94a3b8;
}
.card {
  border: 1px solid #eef2f7;
  border-radius: 12px;
}
.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px dashed #eef2f7;
  font-size: 14px;
  color: #334155;
}
.tool-row:last-child {
  border-bottom: none;
}
</style>
