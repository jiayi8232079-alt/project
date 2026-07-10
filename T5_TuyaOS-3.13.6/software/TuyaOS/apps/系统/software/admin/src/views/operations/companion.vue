<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  confirmMemory,
  forgetMemory,
  getPersona,
  recallMemories,
  saveMemory,
  upsertPersona,
} from '@/api/companion'

const loading = ref(false)
const familyId = ref(1)

const SCOPES = [
  { value: 'member_identity', label: '成员身份' },
  { value: 'member_private', label: '个人私密' },
  { value: 'family_shared', label: '家庭共享' },
  { value: 'health_fact', label: '健康事实' },
  { value: 'robot_relation', label: '机器人关系' },
]

const memories = ref<any[]>([])
const persona = ref<any>(null)

const recallForm = reactive({
  scope: '' as string,
  memberId: undefined as number | undefined,
  keyword: '',
})

const saveForm = reactive({
  scope: 'family_shared',
  memberId: undefined as number | undefined,
  memoryKey: '',
  content: '',
  source: 'family_app',
})

const personaForm = reactive({
  nickname: '小伴',
  personality: 'warm',
  speechRate: 1,
  catchphrase: '',
})

function scopeLabel(value: string) {
  return SCOPES.find((s) => s.value === value)?.label ?? value
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

async function refreshMemories() {
  const params: Record<string, unknown> = { familyId: familyId.value }
  if (recallForm.scope) params.scope = recallForm.scope
  if (recallForm.memberId) params.memberId = recallForm.memberId
  if (recallForm.keyword) params.keyword = recallForm.keyword
  memories.value = (await recallMemories(params)) as any[]
}

async function loadPersona() {
  persona.value = await getPersona(familyId.value)
  personaForm.nickname = persona.value?.nickname ?? '小伴'
  personaForm.personality = persona.value?.personality ?? 'warm'
  personaForm.speechRate = Number(persona.value?.speechRate ?? 1)
  personaForm.catchphrase = persona.value?.catchphrase ?? ''
}

async function submitSave() {
  if (!saveForm.content.trim()) {
    ElMessage.warning('请填写记忆内容')
    return
  }
  await run(async () => {
    await saveMemory({
      familyId: familyId.value,
      scope: saveForm.scope,
      memberId: saveForm.memberId,
      memoryKey: saveForm.memoryKey || undefined,
      content: saveForm.content,
      source: saveForm.source,
    })
    saveForm.content = ''
    saveForm.memoryKey = ''
    await refreshMemories()
  }, '记忆已保存')
}

async function submitPersona() {
  await run(async () => {
    persona.value = await upsertPersona({
      familyId: familyId.value,
      nickname: personaForm.nickname,
      personality: personaForm.personality,
      speechRate: personaForm.speechRate,
      catchphrase: personaForm.catchphrase || undefined,
    })
  }, '人格已保存')
}

async function handleForget(row: any) {
  await ElMessageBox.confirm('确认遗忘（软删除）这条记忆吗？', '提示', { type: 'warning' })
  await run(async () => {
    await forgetMemory(row.id)
    await refreshMemories()
  }, '已遗忘该记忆')
}

async function handleConfirm(row: any) {
  await run(async () => {
    await confirmMemory(row.id)
    await refreshMemories()
  }, '已确认该记忆')
}

async function refreshAll() {
  await Promise.all([refreshMemories(), loadPersona()])
}

onMounted(async () => {
  await refreshAll()
})
</script>

<template>
  <div class="companion-page" v-loading="loading">
    <div class="hero">
      <div>
        <p class="eyebrow">WithKin Companion Memory</p>
        <h1>长期家庭记忆与人格</h1>
        <p>管理成员身份、个人私密、家庭共享、健康事实与机器人关系记忆，并配置机器人自适应人格。</p>
      </div>
      <div class="hero-actions">
        <el-input-number v-model="familyId" :min="1" />
        <el-button type="primary" @click="refreshAll">加载家庭</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card header="机器人人格">
          <el-form label-width="76px">
            <el-form-item label="昵称">
              <el-input v-model="personaForm.nickname" />
            </el-form-item>
            <el-form-item label="性格">
              <el-select v-model="personaForm.personality" style="width: 100%">
                <el-option label="温暖" value="warm" />
                <el-option label="活泼" value="lively" />
                <el-option label="沉稳" value="calm" />
              </el-select>
            </el-form-item>
            <el-form-item label="语速">
              <el-slider v-model="personaForm.speechRate" :min="0.5" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="口头禅">
              <el-input v-model="personaForm.catchphrase" placeholder="可选" />
            </el-form-item>
            <el-button type="primary" @click="submitPersona">保存人格</el-button>
          </el-form>
        </el-card>

        <el-card header="新增记忆" class="mt">
          <el-form label-width="76px">
            <el-form-item label="层级">
              <el-select v-model="saveForm.scope" style="width: 100%">
                <el-option v-for="s in SCOPES" :key="s.value" :label="s.label" :value="s.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="成员ID">
              <el-input-number v-model="saveForm.memberId" :min="1" />
            </el-form-item>
            <el-form-item label="语义键">
              <el-input v-model="saveForm.memoryKey" placeholder="可选，便于去重更新" />
            </el-form-item>
            <el-form-item label="内容">
              <el-input v-model="saveForm.content" type="textarea" :rows="3" />
            </el-form-item>
            <el-button type="primary" @click="submitSave">保存记忆</el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card header="记忆召回">
          <el-form :inline="true">
            <el-form-item label="层级">
              <el-select v-model="recallForm.scope" clearable placeholder="全部" style="width: 140px">
                <el-option v-for="s in SCOPES" :key="s.value" :label="s.label" :value="s.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="成员ID">
              <el-input-number v-model="recallForm.memberId" :min="1" />
            </el-form-item>
            <el-form-item label="关键词">
              <el-input v-model="recallForm.keyword" clearable />
            </el-form-item>
            <el-button type="primary" @click="refreshMemories">召回</el-button>
          </el-form>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="隐私：不指定成员ID 时不会返回任何个人私密记忆。"
            class="mb"
          />

          <el-table :data="memories" height="460">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="层级" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ scopeLabel(row.scope) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="memberId" label="成员" width="70" />
            <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.confirmedAt" type="success" size="small">已确认</el-tag>
                <el-tag v-else type="info" size="small">待确认</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="handleConfirm(row)">确认</el-button>
                <el-button size="small" type="danger" @click="handleForget(row)">遗忘</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.companion-page {
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
  background: linear-gradient(135deg, #2a1f4f, #6d4f8c);
  color: #fff;
  box-shadow: 0 18px 45px rgb(42 31 79 / 20%);

  h1 {
    margin: 4px 0 8px;
    font-size: 26px;
  }

  p {
    margin: 0;
    opacity: .84;
  }
}

.hero-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: .14em;
  font-size: 12px;
}

.mt {
  margin-top: 16px;
}

.mb {
  margin-bottom: 16px;
}
</style>
