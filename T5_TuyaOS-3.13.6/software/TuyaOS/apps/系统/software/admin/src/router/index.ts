import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getToken } from '@/utils/auth'
import { useUserStore } from '@/stores/user'
import { routeAllowedForRole } from '@/utils/permissions'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false })

const AppLayout = () => import('@/components/layouts/AppLayout.vue')

export const menuRoutes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    component: AppLayout,
    redirect: '/dashboard/index',
    meta: { icon: 'DataAnalysis' },
    children: [
      {
        path: 'index',
        name: 'Workbench',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'DataAnalysis' },
      },
    ],
  },
  {
    path: '/portal',
    component: AppLayout,
    redirect: '/portal/platform',
    meta: {
      title: '数据大盘',
      icon: 'TrendCharts',
      roles: ['admin', 'operator', 'finance', 'medical_consultant'],
    },
    children: [
      {
        path: 'platform',
        name: 'PortalPlatform',
        component: () => import('@/views/dashboard/portal/platform.vue'),
        meta: { title: '平台总览', scopeTypes: ['platform'] },
      },
      {
        path: 'government',
        name: 'PortalGovernment',
        component: () => import('@/views/dashboard/portal/government.vue'),
        meta: { title: '政府监管', scopeTypes: ['government'] },
      },
      {
        path: 'community',
        name: 'PortalCommunity',
        component: () => import('@/views/dashboard/portal/community.vue'),
        meta: { title: '机构 / 站点', scopeTypes: ['organization', 'site'] },
      },
      {
        path: 'enterprise',
        name: 'PortalEnterprise',
        component: () => import('@/views/dashboard/portal/enterprise.vue'),
        meta: { title: '渠道业绩', scopeTypes: ['enterprise'] },
      },
    ],
  },
  {
    path: '/customer-health',
    component: AppLayout,
    redirect: '/customer-health/index',
    meta: {
      title: '客户健康管理',
      icon: 'FirstAidKit',
      roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
    },
    children: [
      {
        path: 'index',
        name: 'CustomerHealthManagement',
        component: () => import('@/views/customer/wechat-directory.vue'),
        meta: { title: '客户健康管理' },
      },
    ],
  },
  {
    path: '/customer-center',
    component: AppLayout,
    redirect: '/customer-center/customers',
    meta: {
      title: '客户中心',
      icon: 'User',
      roles: ['admin', 'operator', 'customer_service', 'medical_consultant', 'finance'],
    },
    children: [
      {
        path: 'customers',
        name: 'CustomerCenterList',
        component: () => import('@/views/customer/index.vue'),
        meta: { title: '客户列表' },
      },
      {
        path: 'customers/detail/:id',
        name: 'CustomerCenterDetail',
        component: () => import('@/views/customer/detail.vue'),
        meta: { title: '客户详情', hidden: true, activeMenu: '/customer-center/customers' },
      },
      {
        path: 'reminders',
        name: 'CustomerCenterReminders',
        component: () => import('@/views/content/medication-reminder.vue'),
        meta: {
          title: '用药提醒',
          roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
        },
      },
      {
        path: 'prescriptions',
        name: 'CustomerCenterPrescriptions',
        component: () => import('@/views/content/prescription.vue'),
        meta: {
          title: '处方批量录入',
          roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
        },
      },
      {
        path: 'memberships',
        name: 'CustomerCenterMemberships',
        component: () => import('@/views/membership/levels.vue'),
        meta: {
          title: '年卡会员',
          roles: ['admin', 'operator', 'finance'],
        },
      },
    ],
  },
  {
    path: '/service',
    component: AppLayout,
    redirect: '/service/orders',
    meta: {
      title: '服务运营',
      icon: 'Document',
      roles: ['admin', 'operator', 'customer_service', 'finance'],
    },
    children: [
      {
        path: 'orders',
        name: 'ServiceOrders',
        component: () => import('@/views/order/index.vue'),
        meta: { title: '订单中心' },
      },
      {
        path: 'orders/detail/:id',
        name: 'ServiceOrderDetail',
        component: () => import('@/views/order/detail.vue'),
        meta: { title: '订单详情', hidden: true, activeMenu: '/service/orders' },
      },
      {
        path: 'orders/create',
        name: 'ServiceOrderCreate',
        component: () => import('@/views/order/create.vue'),
        meta: {
          title: '创建订单',
          hidden: true,
          activeMenu: '/service/orders',
          roles: ['admin', 'operator', 'customer_service'],
        },
      },
      {
        path: 'consultations',
        name: 'ServiceConsultations',
        component: () => import('@/views/content/consultation.vue'),
        meta: {
          title: '预约咨询（人工排期）',
          roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
        },
      },
      {
        path: 'hospitals',
        name: 'ServiceHospitals',
        component: () => import('@/views/content/hospitals.vue'),
        meta: {
          title: '医院与医生名录',
          roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
        },
      },
      {
        path: 'doctors',
        name: 'ServiceDoctors',
        component: () => import('@/views/content/doctors.vue'),
        meta: {
          title: '医生总名单',
          roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
        },
      },
      {
        path: 'professional-services',
        name: 'ServiceProfessionalCatalog',
        component: () => import('@/views/content/professional-services.vue'),
        meta: {
          title: '专业服务目录',
          roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
        },
      },
    ],
  },
  {
    path: '/intelligence',
    component: AppLayout,
    redirect: '/intelligence/ai-consultation',
    meta: {
      title: '智能服务',
      icon: 'ChatDotRound',
      roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
    },
    children: [
      {
        path: 'ai-consultation',
        name: 'IntelligenceAiConsultation',
        component: () => import('@/views/content/ai-consultation.vue'),
        meta: { title: 'AI 问诊对话' },
      },
      {
        path: 'triage',
        name: 'IntelligenceTriage',
        component: () => import('@/views/content/triage.vue'),
        meta: { title: 'AI 导诊工单' },
      },
      {
        path: 'drug-interaction',
        name: 'IntelligenceDrugInteraction',
        component: () => import('@/views/content/drug-interaction.vue'),
        meta: {
          title: '药物相互作用检测',
          roles: ['admin', 'operator', 'medical_consultant'],
        },
      },
      {
        path: 'ai-dialog-review',
        name: 'IntelligenceAiDialogReview',
        component: () => import('@/views/ai/dialog-review.vue'),
        meta: {
          title: 'AI 对话质检',
          roles: ['admin', 'operator', 'medical_consultant', 'customer_service'],
        },
      },
      {
        path: 'agent-config',
        name: 'IntelligenceAgentConfig',
        component: () => import('@/views/ai/agent-config.vue'),
        meta: {
          title: 'AI 智能体配置',
          roles: ['admin', 'operator', 'medical_consultant'],
        },
      },
      {
        path: 'crisis-words',
        name: 'IntelligenceCrisisWords',
        component: () => import('@/views/ai/crisis-words.vue'),
        meta: {
          title: '危机词库',
          roles: ['admin', 'operator', 'medical_consultant'],
        },
      },
    ],
  },
  {
    path: '/tenant',
    component: AppLayout,
    redirect: '/tenant/list',
    meta: {
      title: '租户管理',
      icon: 'OfficeBuilding',
      roles: ['admin'],
    },
    children: [
      {
        path: 'list',
        name: 'TenantList',
        component: () => import('@/views/tenant/index.vue'),
        meta: { title: '租户列表' },
      },
      {
        path: 'onboarding',
        name: 'TenantOnboarding',
        component: () => import('@/views/tenant/onboarding.vue'),
        meta: { title: '新租户开通' },
      },
    ],
  },
  {
    path: '/billing',
    component: AppLayout,
    redirect: '/billing/subscriptions',
    meta: {
      title: '订阅与发票',
      icon: 'CreditCard',
      roles: ['admin', 'finance'],
    },
    children: [
      {
        path: 'subscriptions',
        name: 'BillingSubscriptions',
        component: () => import('@/views/billing/subscriptions.vue'),
        meta: { title: '订阅管理' },
      },
      {
        path: 'invoices',
        name: 'BillingInvoices',
        component: () => import('@/views/billing/invoices.vue'),
        meta: { title: '发票管理' },
      },
      {
        path: 'usage',
        name: 'BillingUsage',
        component: () => import('@/views/billing/usage.vue'),
        meta: { title: '用量计费', roles: ['admin', 'finance', 'operator'] },
      },
      {
        path: 'revenue-share',
        name: 'BillingRevenueShare',
        component: () => import('@/views/billing/revenue-share.vue'),
        meta: { title: '分账规则', roles: ['admin', 'finance'] },
      },
    ],
  },
  {
    path: '/device',
    component: AppLayout,
    redirect: '/device/list',
    meta: {
      title: '设备 / 机器人',
      icon: 'Cpu',
      roles: ['admin', 'operator', 'customer_service'],
    },
    children: [
      {
        path: 'dashboard',
        name: 'DeviceDashboard',
        component: () => import('@/views/device/dashboard.vue'),
        meta: { title: '运维大盘' },
      },
      {
        path: 'list',
        name: 'DeviceList',
        component: () => import('@/views/device/index.vue'),
        meta: { title: '设备列表' },
      },
      {
        path: 'fall-events',
        name: 'DeviceFallEvents',
        component: () => import('@/views/device/fall-events.vue'),
        meta: { title: '安全事件流' },
      },
      {
        path: 'detail/:id',
        name: 'DeviceDetail',
        component: () => import('@/views/device/detail.vue'),
        meta: {
          title: '设备详情',
          hidden: true,
          activeMenu: '/device/list',
        },
      },
    ],
  },
  {
    path: '/alert-center',
    component: AppLayout,
    redirect: '/alert-center/alerts',
    meta: {
      title: '健康预警',
      icon: 'Warning',
      roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
    },
    children: [
      {
        path: 'duty',
        name: 'AlertCenterDuty',
        component: () => import('@/views/alert/duty.vue'),
        meta: { title: '值班台' },
      },
      {
        path: 'alerts',
        name: 'AlertCenterList',
        component: () => import('@/views/alert/index.vue'),
        meta: { title: '预警列表' },
      },
      {
        path: 'rules',
        name: 'AlertCenterRules',
        component: () => import('@/views/alert/rules.vue'),
        meta: {
          title: '规则配置',
          roles: ['admin', 'operator', 'medical_consultant'],
        },
      },
    ],
  },
  {
    path: '/v43-ops',
    component: AppLayout,
    redirect: '/v43-ops/center',
    meta: {
      title: 'V4.3 运营中台',
      icon: 'Connection',
      roles: ['admin', 'operator', 'customer_service', 'medical_consultant'],
    },
    children: [
      {
        path: 'center',
        name: 'V43OperationsCenter',
        component: () => import('@/views/operations/v43.vue'),
        meta: { title: '协同运营台' },
      },
      {
        path: 'companion',
        name: 'V43Companion',
        component: () => import('@/views/operations/companion.vue'),
        meta: { title: '长期记忆与人格' },
      },
      {
        path: 'content',
        name: 'V43Content',
        component: () => import('@/views/operations/content.vue'),
        meta: { title: '内容点播库' },
      },
    ],
  },
  {
    path: '/support',
    component: AppLayout,
    redirect: '/support/complaints',
    meta: {
      title: '客户关怀',
      icon: 'ChatLineRound',
      roles: ['admin', 'operator', 'customer_service'],
    },
    children: [
      {
        path: 'complaints',
        name: 'SupportComplaintList',
        component: () => import('@/views/complaint/index.vue'),
        meta: { title: '投诉工单' },
      },
      {
        path: 'complaints/detail/:id',
        name: 'SupportComplaintDetail',
        component: () => import('@/views/complaint/detail.vue'),
        meta: {
          title: '工单详情',
          hidden: true,
          activeMenu: '/support/complaints',
        },
      },
    ],
  },
  {
    path: '/dispatch',
    component: AppLayout,
    redirect: '/dispatch/attendants',
    meta: {
      title: '陪诊调度',
      icon: 'Avatar',
      roles: ['admin', 'operator', 'customer_service'],
    },
    children: [
      {
        path: 'attendants',
        name: 'DispatchAttendants',
        component: () => import('@/views/attendant/index.vue'),
        meta: { title: '陪诊员' },
      },
      {
        path: 'attendants/detail/:id',
        name: 'DispatchAttendantDetail',
        component: () => import('@/views/attendant/detail.vue'),
        meta: { title: '陪诊员详情', hidden: true, activeMenu: '/dispatch/attendants' },
      },
      {
        path: 'schedule',
        name: 'DispatchSchedule',
        component: () => import('@/views/attendant/schedule.vue'),
        meta: {
          title: '排班管理',
          roles: ['admin', 'operator'],
        },
      },
    ],
  },
  {
    path: '/finance',
    component: AppLayout,
    redirect: '/finance/review',
    meta: {
      title: '财务中心',
      icon: 'Money',
      roles: ['admin', 'operator', 'finance'],
    },
    children: [
      {
        path: 'review',
        name: 'FinanceReview',
        component: () => import('@/views/finance/settlement.vue'),
        meta: { title: '报销审核' },
      },
      {
        path: 'pricing',
        name: 'FinancePricing',
        component: () => import('@/views/finance/pricing.vue'),
        meta: {
          title: '服务定价',
          roles: ['admin', 'operator'],
        },
      },
      {
        path: 'settlement',
        name: 'FinanceSettlement',
        component: () => import('@/views/finance/order-settlement.vue'),
        meta: { title: '订单回款' },
      },
      {
        path: 'report',
        name: 'FinanceReport',
        component: () => import('@/views/finance/report.vue'),
        meta: { title: '财务报表' },
      },
    ],
  },
  {
    path: '/system',
    component: AppLayout,
    redirect: '/system/config',
    meta: {
      title: '系统设置',
      icon: 'Setting',
      roles: ['admin'],
    },
    children: [
      {
        path: 'config',
        name: 'SystemConfig',
        component: () => import('@/views/system/config.vue'),
        meta: { title: '系统配置' },
      },
      {
        path: 'admins',
        name: 'SystemAdmins',
        component: () => import('@/views/system/admin-users.vue'),
        meta: { title: '管理员账号' },
      },
      {
        path: 'audit-logs',
        name: 'SystemAuditLogs',
        component: () => import('@/views/system/audit-logs.vue'),
        meta: { title: '操作审计' },
      },
    ],
  },
]

const legacyRoutes: RouteRecordRaw[] = [
  { path: '/order', redirect: '/service/orders' },
  {
    path: '/order/list',
    redirect: (to) => ({ path: '/service/orders', query: to.query }),
  },
  {
    path: '/order/create',
    redirect: (to) => ({ path: '/service/orders/create', query: to.query }),
  },
  {
    path: '/order/detail/:id',
    redirect: (to) => ({ path: `/service/orders/detail/${to.params.id}`, query: to.query }),
  },
  { path: '/customer', redirect: '/customer-center/customers' },
  {
    path: '/customer/list',
    redirect: (to) => ({ path: '/customer-center/customers', query: to.query }),
  },
  {
    path: '/customer/detail/:id',
    redirect: (to) => ({ path: `/customer-center/customers/detail/${to.params.id}`, query: to.query }),
  },
  { path: '/attendant', redirect: '/dispatch/attendants' },
  {
    path: '/attendant/list',
    redirect: (to) => ({ path: '/dispatch/attendants', query: to.query }),
  },
  {
    path: '/attendant/detail/:id',
    redirect: (to) => ({ path: `/dispatch/attendants/detail/${to.params.id}`, query: to.query }),
  },
  { path: '/attendant/schedule', redirect: '/dispatch/schedule' },
  { path: '/membership', redirect: '/customer-center/memberships' },
  { path: '/membership/annual', redirect: '/customer-center/memberships' },
  { path: '/membership/renew', redirect: '/customer-center/memberships' },
  { path: '/customer-center/memberships/renewals', redirect: '/customer-center/memberships' },
  { path: '/customer-center/customers/wechat', redirect: '/customer-health/index' },
  { path: '/content', redirect: '/service/consultations' },
  { path: '/content/consultation', redirect: '/service/consultations' },
  { path: '/content/medication-reminder', redirect: '/customer-center/reminders' },
  { path: '/content/service-report', redirect: '/service/orders' },
  { path: '/content/expert', redirect: '/service/consultations' },
  { path: '/finance/expense-audit', redirect: '/finance/review' },
  { path: '/service/ai-consultation', redirect: '/intelligence/ai-consultation' },
  { path: '/service/triage', redirect: '/intelligence/triage' },
  { path: '/service/expert-matching', redirect: '/service/consultations' },
  { path: '/service/documents', redirect: '/service/orders' },
  { path: '/family', redirect: '/customer-center/customers' },
  { path: '/family/dashboard', redirect: '/customer-center/customers' },
  { path: '/family/groups', redirect: '/customer-center/customers' },
  { path: '/family/health-dashboard', redirect: '/customer-center/customers' },
  { path: '/system/role', redirect: '/system/admins' },
]

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    redirect: '/dashboard/index',
  },
  {
    path: '/screen/:tenantId?',
    name: 'Screen',
    component: () => import('@/views/screen/ScreenView.vue'),
    meta: {
      title: '可视化大屏',
      roles: ['admin', 'operator', 'finance', 'medical_consultant'],
    },
  },
  ...menuRoutes,
  ...legacyRoutes,
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard/index',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  NProgress.start()
  document.title = `${to.meta.title || ''} - 陪了个伴管理系统`

  const token = getToken()
  if (to.path === '/login') {
    token ? next('/dashboard/index') : next()
    return
  }
  if (!token) {
    next('/login')
    return
  }

  const userStore = useUserStore()
  if (!userStore.userInfo) {
    try {
      await userStore.fetchProfile()
    } catch {
      next('/login')
      return
    }
  }

  // 角色访问控制：匹配路由链上任一节点设置了 roles，则需命中
  const role = (userStore.userInfo as any)?.role as string | undefined
  // 找到需要鉴权的最深层次路由记录（父子 meta.roles 逐层校验）
  const matched = to.matched || []
  for (const record of matched) {
    if (!routeAllowedForRole(record, role)) {
      NProgress.done()
      ElMessage.warning('当前角色无权访问该页面')
      // 如果当前用户甚至没有 dashboard 权限就登出
      next({ path: '/dashboard/index' })
      return
    }
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
