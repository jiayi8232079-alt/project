import { get } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待派单', value: 'pending_dispatch' },
  { label: '待接单', value: 'pending_accept' },
  { label: '待抢单', value: 'pending_grab' },
  { label: '待签署', value: 'pending_sign' },
  { label: '待服务', value: 'pending_service' },
  { label: '进行中', value: 'in_progress' },
  { label: '紧急', value: 'emergency' },
  { label: '待回访', value: 'pending_review' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'canceled' },
];

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

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunded: '已退款',
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  attendant: '陪诊员',
  nutritionist: '营养师',
  rehabilitator: '康复师',
  nurse: '护士',
  caregiver: '居家护理员',
  maternal_care: '月嫂',
  psychologist: '心理咨询师',
};

function staffRoleLabel(role?: string | null): string {
  if (!role) return '服务人员';
  return STAFF_ROLE_LABELS[role] || '服务人员';
}

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    orders: [] as any[],
    total: 0,
    page: 1,
    pageSize: 15,
    hasMore: true,
    loading: false,
    filterStatus: '',
    searchKeyword: '',
    statusOptions: STATUS_OPTIONS,
    filterTitle: '',
  },

  _filterUserId: 0,
  _filterAttendantId: 0,
  _filterPaymentStatus: '',
  _filterSettlementStatus: '',

  onLoad(options: any) {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    if (options.status) {
      this.setData({ filterStatus: options.status });
    }
    if (options.paymentStatus) {
      this._filterPaymentStatus = options.paymentStatus;
      this.setData({ filterTitle: options.paymentStatus === 'unpaid' ? '待回款订单' : '订单管理' });
    }
    if (options.settlementStatus) {
      this._filterSettlementStatus = options.settlementStatus;
      this.setData({ filterTitle: options.settlementStatus === 'pending' ? '待结算订单' : '订单管理' });
    }
    if (options.userId) {
      this._filterUserId = parseInt(options.userId);
      this.setData({ filterTitle: '该客户订单' });
    }
    if (options.attendantId) {
      this._filterAttendantId = parseInt(options.attendantId);
      this.setData({ filterTitle: options.role ? `该${staffRoleLabel(options.role)}订单` : '该服务人员订单' });
    }
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    this.setData({ orders: [], page: 1, hasMore: true });
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.setData({ orders: [], page: 1, hasMore: true });
    this.loadOrders().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadOrders() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.filterStatus) params.status = this.data.filterStatus;
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;
      if (this._filterUserId) params.userId = this._filterUserId;
      if (this._filterAttendantId) params.attendantId = this._filterAttendantId;
      if (this._filterPaymentStatus) params.paymentStatus = this._filterPaymentStatus;
      if (this._filterSettlementStatus) params.settlementStatus = this._filterSettlementStatus;

      const res: any = await get('/orders', params);
      const items = (res?.items || res?.data || []).map(mapOrder);
      this.setData({
        orders: items,
        total: res?.total ?? items.length,
        hasMore: items.length === this.data.pageSize,
        loaded: true,
      });
    } catch (e) {
      console.error('加载订单失败', e);
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    const nextPage = this.data.page + 1;
    this.setData({ loading: true, page: nextPage });
    try {
      const params: any = {
        page: nextPage,
        pageSize: this.data.pageSize,
      };
      if (this.data.filterStatus) params.status = this.data.filterStatus;
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;
      if (this._filterUserId) params.userId = this._filterUserId;
      if (this._filterAttendantId) params.attendantId = this._filterAttendantId;
      if (this._filterPaymentStatus) params.paymentStatus = this._filterPaymentStatus;
      if (this._filterSettlementStatus) params.settlementStatus = this._filterSettlementStatus;
      const res: any = await get('/orders', params);
      const items = (res?.items || res?.data || []).map(mapOrder);
      this.setData({
        orders: [...this.data.orders, ...items],
        hasMore: items.length === this.data.pageSize,
      });
    } catch (e) {
      console.error('加载更多失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearch(e: any) {
    const keyword = e.detail.value || '';
    this.setData({ searchKeyword: keyword, orders: [], page: 1, hasMore: true });
    this.loadOrders();
  },

  onFilterStatus(e: any) {
    const status = e.currentTarget.dataset.status;
    this.setData({ filterStatus: status, orders: [], page: 1, hasMore: true });
    this.loadOrders();
  },

  goDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/admin/order-detail/order-detail?id=${id}` });
  },

  handleBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
    }
  },
});

function mapOrder(o: any) {
  const dateRaw = o.serviceTime || o.createdAt || '';
  const role = o?.attendant?.primaryRole || '';
  const staffRoleName = staffRoleLabel(role);
  return {
    ...o,
    statusLabel: STATUS_LABEL[o.status] || o.status,
    paymentLabel: PAYMENT_LABEL[o.paymentStatus] || '',
    dateDisplay: dateRaw ? String(dateRaw).slice(0, 10) : '',
    staffRoleLabel: staffRoleName,
    showStaffRoleTag: !!role && role !== 'attendant',
  };
}
