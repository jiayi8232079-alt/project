<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'
import { getConfig } from '@/api/system'
import { menuRoutes } from '@/router'
import { API_BASE_URL } from '@/config/api-base'
import { useUserStore } from '@/stores/user'
import { routeAllowedForRole } from '@/utils/permissions'
import { routeAllowedForScope, userScopeType } from '@/utils/portal'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const storeLogo = ref('')

const activeMenu = computed(() => String(route.meta?.activeMenu || route.path))

const currentRole = computed(
  () => ((userStore.userInfo as any)?.role as string) || '',
)

const currentScope = computed(() => userScopeType(userStore.userInfo))

const visibleMenus = computed(() =>
  menuRoutes.filter((item) => {
    if (item.meta?.hidden) return false
    if (!routeAllowedForRole(item, currentRole.value)) return false
    if (!routeAllowedForScope(item, currentScope.value)) return false
    // 含子节点的菜单：若子节点按 role/scope 过滤后为空则隐藏
    if (item.children?.length && !getVisibleChildren(item.children as any[]).length) {
      return false
    }
    return true
  }),
)

function getVisibleChildren(children: any[]) {
  return (children || []).filter((c: any) => {
    if (c.meta?.hidden) return false
    const hasComponent = !!(c.component || (c.components && Object.keys(c.components).length))
    if (c.redirect != null && !hasComponent) return false
    if (!routeAllowedForRole(c, currentRole.value)) return false
    if (!routeAllowedForScope(c, currentScope.value)) return false
    return true
  })
}

function resolvePath(parent: string, child: string) {
  if (child.startsWith('/')) return child
  return `${parent}/${child}`.replace(/\/+/g, '/')
}

function getSingleVisibleChild(menu: any) {
  const children = getVisibleChildren(menu?.children as any[])
  return children.length === 1 ? children[0] : null
}

function getSingleMenuPath(menu: any) {
  const child = getSingleVisibleChild(menu)
  return child ? resolvePath(menu.path, child.path) : menu.path
}

function getSingleMenuTitle(menu: any) {
  const child = getSingleVisibleChild(menu)
  return menu?.meta?.title || child?.meta?.title || ''
}

function handleMenuClick(item: any, path: string) {
  if (item?.meta?.external && item?.meta?.externalUrl) {
    window.open(item.meta.externalUrl, '_blank')
  } else {
    router.push(path)
  }
}

function toAssetUrl(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

async function loadStoreLogo() {
  try {
    const logo = await getConfig('store_logo')
    if (typeof logo === 'string' && logo.trim()) {
      storeLogo.value = toAssetUrl(logo.trim())
    }
  } catch {
    storeLogo.value = ''
  }
}

const iconMap: Record<string, string> = {
  DataAnalysis: 'DataAnalysis',
  TrendCharts: 'TrendCharts',
  Document: 'Document',
  User: 'User',
  Avatar: 'Avatar',
  Money: 'Money',
  Medal: 'Medal',
  Files: 'Document',
  Setting: 'Setting',
  FirstAidKit: 'FirstAidKit',
  House: 'House',
  ChatDotRound: 'ChatDotRound',
  Warning: 'Warning',
}

onMounted(loadStoreLogo)
</script>

<template>
  <div class="sidebar">
    <div class="sidebar__brand">
      <div class="brand-mark">
        <img v-if="storeLogo" :src="storeLogo" alt="Logo" class="brand-mark__image" />
        <el-icon v-else :size="16" color="#ffffff"><FirstAidKit /></el-icon>
      </div>
      <div class="brand-text">
        <span class="brand-text__title">陪了个伴</span>
        <small class="brand-text__sub">运营管理后台</small>
      </div>
    </div>

    <el-scrollbar class="sidebar__scroll">
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        :collapse-transition="false"
        unique-opened
      >
        <template v-for="menu in visibleMenus" :key="menu.path">
          <template v-if="getSingleVisibleChild(menu)">
            <el-menu-item
              :index="getSingleMenuPath(menu)"
              @click="handleMenuClick(getSingleVisibleChild(menu), getSingleMenuPath(menu))"
            >
              <el-icon><component :is="iconMap[menu.meta?.icon as string] || 'Folder'" /></el-icon>
              <span>{{ getSingleMenuTitle(menu) }}</span>
            </el-menu-item>
          </template>
          <el-sub-menu v-else :index="menu.path">
            <template #title>
              <el-icon><component :is="iconMap[menu.meta?.icon as string] || 'Folder'" /></el-icon>
              <span>{{ menu.meta?.title }}</span>
            </template>
            <el-menu-item
              v-for="child in getVisibleChildren(menu.children as any[])"
              :key="child.path"
              :index="resolvePath(menu.path, child.path)"
              @click="handleMenuClick(child, resolvePath(menu.path, child.path))"
            >
              {{ child.meta?.title }}
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>
    </el-scrollbar>

    <div class="sidebar__footer">
      <div class="sidebar__version">v2.0</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
}

// ── 品牌区 ──
.sidebar__brand {
  height: $header-height;
  padding: 0 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  border-bottom: 1px solid $border-base;
}

.brand-mark {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px 0 rgba(46, 134, 240, 0.3);
}

.brand-mark__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #ffffff;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-text__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: $text-primary;
}

.brand-text__sub {
  font-size: 11px;
  color: $text-secondary;
  letter-spacing: 0.01em;
  margin-top: 2px;
  font-weight: 500;
}

// ── 滚动容器 ──
.sidebar__scroll {
  flex: 1;
  min-height: 0;
}

.sidebar-menu {
  width: 100%;
  border-right: none;
  background: transparent;
  padding: 10px 10px 16px;
}

// ── 一级菜单 / SubMenu 标题 ──
:deep(.el-sub-menu__title),
:deep(.el-menu-item) {
  height: 38px;
  line-height: 38px;
  margin: 2px 0;
  border-radius: 6px;
  font-weight: 500;
  font-size: 13px;
  color: $slate-600 !important;
  background: transparent !important;
  transition: all 0.15s ease;
  padding: 0 12px !important;
  letter-spacing: -0.005em;
  position: relative;
}

:deep(.el-sub-menu__title:hover),
:deep(.el-menu-item:hover) {
  background: $slate-100 !important;
  color: $text-primary !important;
}

// 一级激活态（主色条 + 淡青底）
:deep(.el-menu-item.is-active) {
  background: $primary-50 !important;
  color: $primary-dark !important;
  font-weight: 600;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: $primary;
  }

  .el-icon {
    color: $primary !important;
  }
}

:deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: $text-primary !important;
  font-weight: 600;

  .el-icon {
    color: $primary !important;
  }
}

// ── 二级菜单（子项） ──
:deep(.el-sub-menu .el-menu) {
  background: transparent !important;
  padding: 2px 0 6px !important;
}

:deep(.el-sub-menu .el-menu-item) {
  min-width: auto;
  padding-left: 40px !important;
  padding-right: 12px !important;
  height: 32px;
  line-height: 32px;
  font-size: 13px;
  margin: 1px 0;
  color: $slate-500 !important;
  font-weight: 500;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 22px;
    top: 50%;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: $slate-300;
    transform: translateY(-50%);
    transition: background 0.15s ease;
  }
}

:deep(.el-sub-menu .el-menu-item:hover) {
  color: $text-primary !important;

  &::after {
    background: $slate-500;
  }
}

:deep(.el-sub-menu .el-menu-item.is-active) {
  background: $primary-50 !important;
  color: $primary-dark !important;
  font-weight: 600;

  &::before {
    display: none;
  }

  &::after {
    background: $primary;
  }
}

// ── 图标 ──
:deep(.el-sub-menu__title .el-icon),
:deep(.el-menu-item > .el-icon) {
  color: $slate-400;
  font-size: 17px;
  margin-right: 10px;
  vertical-align: middle;
  transition: color 0.15s ease;
  width: 17px;
}

:deep(.el-sub-menu__title:hover .el-icon),
:deep(.el-menu-item:hover > .el-icon) {
  color: $text-primary;
}

:deep(.el-sub-menu__icon-arrow) {
  color: $slate-400;
  font-size: 12px;
  right: 12px;
}

// ── 底部版本号 ──
.sidebar__footer {
  padding: 10px 18px;
  border-top: 1px solid $border-base;
  flex-shrink: 0;
}

.sidebar__version {
  font-size: 11px;
  color: $text-tertiary;
  text-align: left;
  letter-spacing: 0.02em;
  font-weight: 500;
}

// ── 滚动条 ──
:deep(.el-scrollbar__bar.is-vertical) {
  width: 4px;
  right: 2px;
}

:deep(.el-scrollbar__thumb) {
  background: $slate-200;
  border-radius: 999px;

  &:hover {
    background: $slate-300;
  }
}
</style>
