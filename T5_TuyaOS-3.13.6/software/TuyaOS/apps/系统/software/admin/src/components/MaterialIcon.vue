<script setup lang="ts">
const props = defineProps<{
  name: string
  class?: string
}>()
</script>

<template>
  <span class="material-symbols-outlined" :class="props.class">{{ props.name }}</span>
</template>
