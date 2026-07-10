import { get } from '../../../utils/request';
import { ensureAdminPageAccessFresh } from '../../../utils/identity';
import { getUserInfo } from '../../../utils/auth';

const STATUS_LABEL: Record<string, string> = {
  pending_dispatch: '待派单',
  pending_accept: '待接单',
  pending_grab: '待抢单',
  pending_sign: '待签署',
  pending_service: '待服务',
  in_progress: '进行中',
  pending_review: '待回访',
  completed: '已完成',
  canceled: '已取消',
  emergency: '紧急',
};

// 与后端各接口 @Roles(...) 保持对应；不在允许列表的角色将被隐藏相应入口。
// 只有 3 角色管理台核心接口允许的角色：admin / operator / customer_service
const FULL_ADMIN_ROLES = ['admin', 'operator', 'customer_service'];

interface AdminPermissions {
  // 订单相关（订单管理、统计、派单等）
  orders: boolean;
  // 客户/服务对象/家庭管理
  customers: boolean;
  // 陪诊员管理
  attendants: boolean;
  // 健康档案管理
  healthManage: boolean;
  // 家庭看板
  families: boolean;
  // 系统配置
  systemConfig: boolean;
  // 财务审批
  finance: boolean;
  // 能看到订单统计卡片（订单数据)
  statOrders: boolean;
  // 能看到客户统计卡片
  statCustomers: boolean;
  // 能看到陪诊员统计卡片
  statAttendants: boolean;
  // 能看到待回款/待结算
  statFinance: boolean;
}

function computePermissions(role: string | undefined): AdminPermissions {
  const isFullAdmin = FULL_ADMIN_ROLES.includes(role || '');
  const isFinance = role === 'finance';
  return {
    orders: isFullAdmin,
    customers: isFullAdmin,
    attendants: isFullAdmin,
    healthManage: isFullAdmin,
    families: isFullAdmin,
    systemConfig: role === 'admin',
    finance: role === 'admin' || isFinance,
    // stat 卡片点击会跳转至 orders/finance 页面，必须跟对应页面的访问权限保持一致，
    // 否则点击会触发 403。
    statOrders: isFullAdmin,
    statCustomers: isFullAdmin,
    statAttendants: isFullAdmin,
    statFinance: role === 'admin' || isFinance,
  };
}

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    userInfo: null as any,
    roleLabel: '',
    stats: null as any,
    recentOrders: [] as any[],
    permissions: computePermissions(''),
    hasAnyEntry: false,
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  async onShow() {
    const ok = await ensureAdminPageAccessFresh();
    if (!ok) return;
    const userInfo = getUserInfo();
    const permissions = computePermissions(userInfo?.role);
    const hasAnyEntry =
      permissions.orders ||
      permissions.customers ||
      permissions.attendants ||
      permissions.healthManage ||
      permissions.families ||
      permissions.systemConfig ||
      permissions.finance;
    this.setData({
      userInfo,
      roleLabel: roleDisplayName(userInfo?.role),
      permissions,
      hasAnyEntry,
    });
    this.loadData();
  },

  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  async loadData() {
    const perms = this.data.permissions;
    // 没有订单相关权限时直接跳过 /orders/* 请求，避免 403 打扰
    if (!perms.statOrders && !perms.orders) {
      this.setData({ loaded: true });
      return;
    }
    try {
      const tasks: Promise<any>[] = [];
      tasks.push(get('/orders/stats/dashboard').catch(() => null));
      if (perms.orders) {
        tasks.push(get('/orders', { pageSize: 5, page: 1 }).catch(() => null));
      }
      const [stats, ordersRes] = await Promise.all(tasks);
      const rawOrders = (ordersRes?.items || ordersRes?.data || []) as any[];
      const recentOrders = rawOrders.map((o: any) => ({
        ...o,
        dateDisplay: o.createdAt ? String(o.createdAt).slice(0, 10) : '',
        statusLabel: STATUS_LABEL[o.status] || o.status,
      }));
      this.setData({
        stats,
        recentOrders,
        loaded: true,
      });
    } catch (e) {
      console.error('加载管理台数据失败', e);
      this.setData({ loaded: true });
    }
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/admin/orders/orders' });
  },

  goOrdersWithFilter(e: any) {
    const status = e.currentTarget.dataset.status || '';
    wx.navigateTo({ url: `/pages/admin/orders/orders?status=${status}` });
  },

  goOrdersWithPaymentFilter(e: any) {
    // 只有订单权限者会跳到订单页；财务无订单权限，引导到财务模块。
    if (!this.data.permissions.orders) {
      wx.navigateTo({ url: '/pages/admin/finance/finance' });
      return;
    }
    const payment = e.currentTarget.dataset.payment || '';
    wx.navigateTo({ url: `/pages/admin/orders/orders?paymentStatus=${payment}` });
  },

  goOrdersWithSettlementFilter(e: any) {
    // 同上：财务点"待结算"时跳财务模块，其它角色跳订单过滤。
    if (!this.data.permissions.orders) {
      wx.navigateTo({ url: '/pages/admin/finance/finance' });
      return;
    }
    const settlement = e.currentTarget.dataset.settlement || '';
    wx.navigateTo({ url: `/pages/admin/orders/orders?settlementStatus=${settlement}` });
  },

  goCustomers() {
    wx.navigateTo({ url: '/pages/admin/customers/customers' });
  },

  goAttendants() {
    wx.navigateTo({ url: '/pages/admin/attendants/attendants' });
  },

  goOrderDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/admin/order-detail/order-detail?id=${id}` });
  },

  goHealthManage() {
    wx.navigateTo({ url: '/pages/admin/health-manage/health-manage' });
  },

  goFinance() {
    wx.navigateTo({ url: '/pages/admin/finance/finance' });
  },

  goFamilies() {
    wx.navigateTo({ url: '/pages/admin/families/families' });
  },

  goSystemConfig() {
    wx.navigateTo({ url: '/pages/admin/system-config/system-config' });
  },

  handleBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/mine/mine' });
    }
  },

  orderStatusLabel(status: string): string {
    return STATUS_LABEL[status] || status;
  },
});

function roleDisplayName(role: string): string {
  const map: Record<string, string> = {
    admin: '超级管理员',
    operator: '运营',
    finance: '财务',
    customer_service: '客服',
    medical_consultant: '医疗顾问',
  };
  return map[role] || role || '管理员';
}
