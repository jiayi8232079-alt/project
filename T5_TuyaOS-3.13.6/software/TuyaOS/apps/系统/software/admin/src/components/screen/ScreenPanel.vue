<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>()
</script>

<template>
  <section class="s-panel">
    <header v-if="title" class="s-panel__head">
      <span class="s-panel__bar"></span>
      <h3 class="s-panel__title">{{ title }}</h3>
      <span v-if="subtitle" class="s-panel__sub">{{ subtitle }}</span>
      <slot name="extra" />
    </header>
    <div class="s-panel__body">
      <slot />
    </div>
    <i class="s-panel__corner s-panel__corner--tl"></i>
    <i class="s-panel__corner s-panel__corner--tr"></i>
    <i class="s-panel__corner s-panel__corner--bl"></i>
    <i class="s-panel__corner s-panel__corner--br"></i>
  </section>
</template>

<style scoped lang="scss">
.s-panel {
  position: relative;
  background: linear-gradient(180deg, rgba(16, 42, 82, 0.55) 0%, rgba(9, 24, 51, 0.45) 100%);
  border: 1px solid rgba(64, 158, 255, 0.25);
  border-radius: 6px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow: inset 0 0 24px rgba(31, 120, 255, 0.08);
}
.s-panel__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.s-panel__bar {
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #5bd6ff, #1f78ff);
  border-radius: 2px;
}
.s-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #d7e8ff;
  letter-spacing: 1px;
}
.s-panel__sub {
  font-size: 12px;
  color: #6b8bbd;
}
.s-panel__body {
  flex: 1;
  min-height: 0;
}
.s-panel__corner {
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: #3fa9ff;
  border-style: solid;
  border-width: 0;
  &--tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
  &--tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
  &--bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
  &--br { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }
}
</style>
