<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createContent,
  listContent,
  playContent,
  updateContent,
} from '@/api/content'

const loading = ref(false)
const items = ref<any[]>([])
const filterCategory = ref('')

const CATEGORIES = [
  { value: 'xiqu', label: '戏曲' },
  { value: 'pingshu', label: '评书' },
  { value: 'song', label: '老歌' },
  { value: 'news', label: '新闻' },
  { value: 'health', label: '健康科普' },
  { value: 'drama', label: '广播剧' },
  { value: 'story', label: '故事' },
]

const form = reactive({
  category: 'xiqu',
  title: '',
  description: '',
  duration: '',
  audioUrl: '',
})

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
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

async function refresh() {
  items.value = (await listContent(filterCategory.value || undefined)) as any[]
}

async function submitCreate() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  await run(async () => {
    await createContent({
      category: form.category,
      title: form.title,
      description: form.description || undefined,
      duration: form.duration || undefined,
      audioUrl: form.audioUrl || undefined,
    })
    form.title = ''
    form.description = ''
    form.duration = ''
    form.audioUrl = ''
    await refresh()
  }, '内容已新增')
}

onMounted(async () => {
  loading.value = true
  try {
    await refresh()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-page" v-loading="loading">
    <div class="hero">
      <div>
        <p class="eyebrow">WithKin Content Library</p>
        <h1>内容点播库</h1>
        <p>管理戏曲、评书、老歌、新闻、健康科普等可由机器人播报的内容。</p>
      </div>
      <el-button type="primary" @click="refresh">刷新</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card header="新增内容">
          <el-form label-width="68px">
            <el-form-item label="分类">
              <el-select v-model="form.category" style="width: 100%">
                <el-option
                  v-for="c in CATEGORIES"
                  :key="c.value"
                  :label="c.label"
                  :value="c.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="标题">
              <el-input v-model="form.title" />
            </el-form-item>
            <el-form-item label="简介">
              <el-input v-model="form.description" />
            </el-form-item>
            <el-form-item label="时长">
              <el-input v-model="form.duration" placeholder="如 28 分钟" />
            </el-form-item>
            <el-form-item label="音频URL">
              <el-input v-model="form.audioUrl" />
            </el-form-item>
            <el-button type="primary" @click="submitCreate">新增</el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card header="内容列表">
          <el-form :inline="true">
            <el-form-item label="分类">
              <el-select
                v-model="filterCategory"
                clearable
                placeholder="全部"
                style="width: 160px"
                @change="refresh"
              >
                <el-option
                  v-for="c in CATEGORIES"
                  :key="c.value"
                  :label="c.label"
                  :value="c.value"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-table :data="items" height="460">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="分类" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ categoryLabel(row.category) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="duration" label="时长" width="100" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.active" type="success" size="small">上架</el-tag>
                <el-tag v-else type="info" size="small">下架</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button
                  size="small"
                  @click="run(async () => { await playContent(row.id); }, '已下发播放')"
                >
                  播放
                </el-button>
                <el-button
                  size="small"
                  :type="row.active ? 'warning' : 'success'"
                  @click="run(async () => { await updateContent(row.id, { active: !row.active }); await refresh() })"
                >
                  {{ row.active ? '下架' : '上架' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.content-page {
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
  background: linear-gradient(135deg, #3a2410, #8c5a2b);
  color: #fff;
  box-shadow: 0 18px 45px rgb(58 36 16 / 20%);

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
</style>
