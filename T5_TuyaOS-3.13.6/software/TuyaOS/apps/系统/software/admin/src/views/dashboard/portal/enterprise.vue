<script setup lang="ts">
import PortalDashboard from './PortalDashboard.vue'
import { PORTAL_CONFIGS } from './portal-config'
</script>

<template>
  <PortalDashboard :config="PORTAL_CONFIGS.enterprise" />
</template>
