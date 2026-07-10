import { get, put } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';
import { getUserInfo } from '../../../utils/auth';

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '在职', value: 'active' },
  { label: '已停用', value: 'disabled' },
];

const STATUS_LABEL: Record<string, string> = {
  active: '在职',
  disabled: '已停用',
};

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    attendants: [] as any[],
    total: 0,
    page: 1,
    pageSize: 15,
    hasMore: true,
    loading: false,
    searchKeyword: '',
    filterStatus: '',
    statusOptions: STATUS_OPTIONS,
    canManage: false,
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    const userInfo = getUserInfo();
    const canManage = ['admin', 'operator'].includes(userInfo?.role);
    this.setData({ canManage, attendants: [], page: 1, hasMore: true });
    this.loadAttendants();
  },

  onPullDownRefresh() {
    this.setData({ attendants: [], page: 1, hasMore: true });
    this.loadAttendants().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadAttendants() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.filterStatus) params.status = this.data.filterStatus;
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;
      const res: any = await get('/attendants', params);
      const items = (res?.items || res?.data || []).map((a: any) => ({
        ...a,
        statusLabel: STATUS_LABEL[a.status] || a.status,
        displayName: a.user ? (a.user.name || a.user.nickname || a.user.phone || `陪诊员${a.id}`) : `陪诊员${a.id}`,
      }));
      this.setData({
        attendants: items,
        total: res?.total ?? items.length,
        hasMore: items.length === this.data.pageSize,
        loaded: true,
      });
    } catch (e) {
      console.error('加载陪诊员失败', e);
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
      const res: any = await get('/attendants', params);
      const items = (res?.items || res?.data || []).map((a: any) => ({
        ...a,
        statusLabel: STATUS_LABEL[a.status] || a.status,
        displayName: a.user ? (a.user.name || a.user.nickname || a.user.phone || `陪诊员${a.id}`) : `陪诊员${a.id}`,
      }));
      this.setData({
        attendants: [...this.data.attendants, ...items],
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
    this.setData({ searchKeyword: keyword, attendants: [], page: 1, hasMore: true });
    this.loadAttendants();
  },

  onFilterStatus(e: any) {
    const status = e.currentTarget.dataset.status;
    this.setData({ filterStatus: status, attendants: [], page: 1, hasMore: true });
    this.loadAttendants();
  },

  callAttendant(e: any) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) { wx.showToast({ title: '无联系电话', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  async toggleStatus(e: any) {
    const { id, status } = e.currentTarget.dataset;
    const newStatus = status === 'active' ? 'disabled' : 'active';
    const label = newStatus === 'active' ? '启用' : '停用';
    wx.showModal({
      title: `确认${label}`,
      content: `确认将该陪诊员${label}？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await put(`/attendants/${id}`, { status: newStatus });
          wx.showToast({ title: `已${label}`, icon: 'success' });
          const numId = Number(id);
          const list = this.data.attendants.map((a) => {
            if (Number(a.id) === numId) {
              return { ...a, status: newStatus, statusLabel: STATUS_LABEL[newStatus] };
            }
            return a;
          });
          this.setData({ attendants: list });
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  goOrders(e: any) {
    const attendantId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/admin/orders/orders?attendantId=${attendantId}` });
  },

  goWorkbenchView(e: any) {
    const { id, name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/workbench/workbench?attendantId=${id}&name=${encodeURIComponent(name || '')}`,
    });
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
