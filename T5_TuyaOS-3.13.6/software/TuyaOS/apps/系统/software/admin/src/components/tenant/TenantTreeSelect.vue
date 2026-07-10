<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getTenantTree, type TenantTreeNode } from '@/api/tenant'

const props = withDefaults(
  defineProps<{
    modelValue?: number | null
    placeholder?: string
    clearable?: boolean
    width?: string
  }>(),
  {
    modelValue: null,
    placeholder: '全部（当前作用域）',
    clearable: true,
    width: '260px',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
  (e: 'change', value: number | null): void
}>()

const tree = ref<TenantTreeNode[]>([])
const loading = ref(false)

const SCOPE_LABEL: Record<string, string> = {
  platform: '平台',
  government: '政府',
  enterprise: '企业',
  organization: '机构',
  site: '站点',
}

async function load() {
  loading.value = true
  try {
    tree.value = await getTenantTree()
  } catch {
    tree.value = []
  } finally {
    loading.value = false
  }
}

function handleChange(val: number | null) {
  emit('update:modelValue', val ?? null)
  emit('change', val ?? null)
}

onMounted(load)
</script>

<template>
  <el-tree-select
    :model-value="props.modelValue ?? undefined"
    :data="tree"
    :props="{ label: 'name', children: 'children' }"
    node-key="id"
    check-strictly
    :render-after-expand="false"
    :clearable="clearable"
    :loading="loading"
    :placeholder="placeholder"
    :style="{ width }"
    filterable
    @update:model-value="handleChange"
  >
    <template #default="{ data }">
      <span class="tenant-node">
        <el-tag size="small" type="info" effect="plain" class="tenant-node__tag">
          {{ SCOPE_LABEL[(data as TenantTreeNode).scopeType] || (data as TenantTreeNode).scopeType }}
        </el-tag>
        <span>{{ (data as TenantTreeNode).name }}</span>
      </span>
    </template>
  </el-tree-select>
</template>

<style scoped lang="scss">
.tenant-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tenant-node__tag {
  transform: scale(0.9);
}
</style>
