<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Navbar from './Navbar.vue'
</script>

<template>
  <div class="layout-shell">
    <aside class="layout-aside">
      <Sidebar />
    </aside>
    <div class="layout-workspace">
      <header class="layout-header">
        <Navbar />
      </header>
      <main class="layout-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.layout-shell {
  display: flex;
  min-height: 100vh;
  background: transparent;
}

.layout-aside {
  width: $sidebar-width;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  align-self: stretch;
  min-height: 100vh;
  max-height: 100vh;
  background: $sidebar-bg;
  backdrop-filter: blur($glass-blur-strong) saturate($glass-saturate);
  -webkit-backdrop-filter: blur($glass-blur-strong) saturate($glass-saturate);
  border-right: 1px solid $glass-border;
  z-index: 20;
  overflow: hidden;
}

.layout-workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: transparent;
}

.layout-header {
  position: sticky;
  top: 0;
  z-index: 15;
  background: $glass-bg-strong;
  backdrop-filter: blur($glass-blur-strong) saturate($glass-saturate);
  -webkit-backdrop-filter: blur($glass-blur-strong) saturate($glass-saturate);
  border-bottom: 1px solid $glass-border;
  padding: 0;
  height: $header-height;
  display: flex;
  align-items: center;
}

.layout-main {
  flex: 1;
  background: transparent;
  padding: 20px 24px 28px;
  min-height: 0;
}

@media (max-width: 1100px) {
  .layout-main {
    padding: 16px 20px 24px;
  }
}
</style>
