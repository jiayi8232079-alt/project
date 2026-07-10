<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { ref, computed, reactive } from 'vue'
import { useUserStore } from '@/stores/user'
import { getOrderList } from '@/api/order'
import { getCustomerList } from '@/api/customer'
import { getAttendantList } from '@/api/attendant'
import { formatDate, orderStatusMap } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const searchKeyword = ref('')
const searchVisible = ref(false)
const searchLoading = ref(false)
const searchResults = reactive({
  orders: [] as any[],
  customers: [] as any[],
  attendants: [] as any[],
})

const breadcrumb = computed(() => {
  const matched = route.matched.filter((r) => r.meta?.title)
  return matched.map((r) => ({ path: r.path, title: r.meta?.title }))
})

async function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  searchVisible.value = true
  searchLoading.value = true
  try {
    const [orders, customers, attendants] = await Promise.all([
      getOrderList({ keyword, page: 1, pageSize: 6 }).catch(() => ({ items: [] })),
      getCustomerList({ keyword, page: 1, pageSize: 6 }).catch(() => ({ items: [] })),
      getAttendantList({ keyword, page: 1, pageSize: 6 }).catch(() => ({ items: [] })),
    ])
    searchResults.orders = orders.items || []
    searchResults.customers = customers.items || []
    searchResults.attendants = attendants.items || []
  } finally {
    searchLoading.value = false
  }
}

function goTo(path: string) {
  searchVisible.value = false
  router.push(path)
}

function openOrderList() {
  goTo(`/service/orders?keyword=${encodeURIComponent(searchKeyword.value.trim())}`)
}

function openCustomerList() {
  goTo(`/customer-center/customers?keyword=${encodeURIComponent(searchKeyword.value.trim())}`)
}

function openAttendantList() {
  goTo(`/dispatch/attendants?keyword=${encodeURIComponent(searchKeyword.value.trim())}`)
}

function attendantStatusLabel(status?: string) {
  return status === 'active' ? '在职' : status === 'disabled' ? '已离职' : '休息中'
}

function handleLogout() {
  userStore.logout()
}
</script>

<template>
  <div class="navbar">
    <div class="navbar__left">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-for="item in breadcrumb" :key="item.path">
          {{ item.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="navbar__right">
      <div class="search-field">
        <el-icon class="search-field__icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          class="search-field__input"
          placeholder="搜索订单、客户、陪诊员..."
          @keyup.enter="handleSearch"
        />
        <span class="search-field__kbd">⏎</span>
      </div>

      <button class="icon-btn" title="通知">
        <el-icon :size="18"><Bell /></el-icon>
      </button>

      <el-dropdown trigger="click" @command="handleLogout">
        <div class="user-chip">
          <el-avatar :size="28" class="user-chip__avatar">{{ userStore.userName?.charAt(0) || '管' }}</el-avatar>
          <div class="user-chip__meta">
            <span class="user-chip__name">{{ userStore.userName || '管理员' }}</span>
            <span class="user-chip__role">超级管理员</span>
          </div>
          <el-icon class="user-chip__chevron"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-dialog v-model="searchVisible" title="全局搜索结果" width="960px">
      <div v-loading="searchLoading">
        <div class="search-dialog-keyword">
          关键词：<strong>{{ searchKeyword.trim() || '—' }}</strong>
        </div>

        <div class="search-dialog-grid">
          <el-card shadow="never">
            <template #header>
              <div class="search-card-header">
                <span>订单</span>
                <el-button link type="primary" size="small" @click="openOrderList">查看全部</el-button>
              </div>
            </template>
            <el-empty v-if="!searchResults.orders.length" description="无匹配订单" :image-size="60" />
            <div v-else class="search-card-list">
              <div
                v-for="item in searchResults.orders"
                :key="item.id"
                class="search-card-item"
              >
                <div class="search-item-title">{{ item.orderNumber }}</div>
                <div class="search-item-desc">
                  {{ item.serviceTarget?.name || item.user?.nickname || '—' }} · {{ item.serviceType || '服务类型待定' }}
                </div>
                <div class="search-item-footer">
                  <el-tag :type="(orderStatusMap[item.status]?.type as any) || 'info'" size="small">
                    {{ orderStatusMap[item.status]?.label || item.status }}
                  </el-tag>
                  <el-button link type="primary" size="small" @click="goTo(`/service/orders/detail/${item.id}`)">查看</el-button>
                </div>
              </div>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header>
              <div class="search-card-header">
                <span>客户</span>
                <el-button link type="primary" size="small" @click="openCustomerList">查看全部</el-button>
              </div>
            </template>
            <el-empty v-if="!searchResults.customers.length" description="无匹配客户" :image-size="60" />
            <div v-else class="search-card-list">
              <div
                v-for="item in searchResults.customers"
                :key="item.id"
                class="search-card-item"
              >
                <div class="search-item-title">{{ item.nickname || `客户 #${item.id}` }}</div>
                <div class="search-item-desc">{{ item.phone || '未填写手机号' }}</div>
                <div class="search-item-footer">
                  <span class="search-item-meta">
                    {{ item.createdAt ? formatDate(item.createdAt, 'YYYY-MM-DD') : '—' }}
                  </span>
                  <el-button link type="primary" size="small" @click="goTo(`/customer-center/customers/detail/${item.id}`)">查看</el-button>
                </div>
              </div>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header>
              <div class="search-card-header">
                <span>陪诊员</span>
                <el-button link type="primary" size="small" @click="openAttendantList">查看全部</el-button>
              </div>
            </template>
            <el-empty v-if="!searchResults.attendants.length" description="无匹配陪诊员" :image-size="60" />
            <div v-else class="search-card-list">
              <div
                v-for="item in searchResults.attendants"
                :key="item.id"
                class="search-card-item"
              >
                <div class="search-item-title">{{ item.realName || `陪诊员 #${item.id}` }}</div>
                <div class="search-item-desc">
                  {{ item.employeeId || '无工号' }} · {{ item.phone || '未填写手机号' }}
                </div>
                <div class="search-item-footer">
                  <el-tag :type="item.status === 'active' ? 'success' : 'info'" size="small">
                    {{ attendantStatusLabel(item.status) }}
                  </el-tag>
                  <el-button link type="primary" size="small" @click="goTo(`/dispatch/attendants/detail/${item.id}`)">查看</el-button>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables.scss' as *;

.navbar {
  width: 100%;
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
}

.navbar__left {
  min-width: 0;
  flex: 1;
}

.navbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

// ── 搜索字段（原生 input 方案，更可控） ──
.search-field {
  position: relative;
  width: 320px;
  height: 36px;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid $glass-border;
  border-radius: $radius-md;
  padding: 0 10px 0 32px;
  transition: all 0.15s ease;

  &:hover {
    border-color: $primary-200;
  }

  &:focus-within {
    background: rgba(255, 255, 255, 0.9);
    border-color: $primary;
    box-shadow: $focus-ring;
  }
}

.search-field__icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: $slate-400;
  font-size: 14px;
  pointer-events: none;
}

.search-field__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: $text-primary;
  padding: 0;
  font-family: inherit;

  &::placeholder {
    color: $text-placeholder;
  }
}

.search-field__kbd {
  font-size: 11px;
  color: $text-tertiary;
  background: $card-bg;
  border: 1px solid $border-base;
  border-radius: $radius-sm;
  padding: 1px 6px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  line-height: 1.4;
  pointer-events: none;
  margin-left: 8px;
}

// ── 图标按钮 ──
.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid $border-base;
  border-radius: $radius-md;
  color: $slate-500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: $slate-50;
    border-color: $border-strong;
    color: $text-primary;
  }
}

// ── 用户 Chip ──
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 3px 10px 3px 3px;
  border-radius: $radius-md;
  border: 1px solid transparent;
  transition: all 0.15s ease;

  &:hover {
    background: $slate-50;
    border-color: $border-base;
  }
}

.user-chip__avatar {
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px 0 rgba(46, 134, 240, 0.3);
}

.user-chip__meta {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  text-align: left;
}

.user-chip__name {
  font-size: 13px;
  color: $text-primary;
  font-weight: 600;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.005em;
}

.user-chip__role {
  font-size: 11px;
  color: $text-secondary;
  margin-top: 2px;
  font-weight: 500;
}

.user-chip__chevron {
  color: $slate-400;
  font-size: 12px;
  margin-left: -2px;
}

// ── Dialog 内样式 ──
.search-dialog-keyword {
  margin-bottom: 20px;
  color: $text-regular;
  font-size: 13px;
}

.search-dialog-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.search-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 13px;
}

.search-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-card-item {
  padding-bottom: 12px;
  border-bottom: 1px solid $divider;

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.search-item-title {
  font-weight: 600;
  color: $text-primary;
  word-break: break-all;
  font-size: 13px;
  letter-spacing: -0.005em;
}

.search-item-desc {
  margin-top: 4px;
  font-size: 12px;
  color: $text-secondary;
}

.search-item-footer {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.search-item-meta {
  font-size: 12px;
  color: $text-tertiary;
}

@media (max-width: 1100px) {
  .search-field {
    width: 240px;
  }

  .user-chip__meta {
    display: none;
  }
}

@media (max-width: 900px) {
  .navbar {
    padding: 0 16px;
    gap: 10px;
  }

  .search-field {
    width: 180px;
  }

  .search-field__kbd {
    display: none;
  }
}
</style>
