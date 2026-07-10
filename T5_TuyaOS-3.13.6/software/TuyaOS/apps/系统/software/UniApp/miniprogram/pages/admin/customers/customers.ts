import { get } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    customers: [] as any[],
    total: 0,
    page: 1,
    pageSize: 15,
    hasMore: true,
    loading: false,
    searchKeyword: '',
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    this.setData({ customers: [], page: 1, hasMore: true });
    this.loadCustomers();
  },

  onPullDownRefresh() {
    this.setData({ customers: [], page: 1, hasMore: true });
    this.loadCustomers().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadCustomers() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        customerOnly: 'true',
      };
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;
      const res: any = await get('/users', params);
      const items = res?.items || res?.data || [];
      this.setData({
        customers: items,
        total: res?.total ?? items.length,
        hasMore: items.length === this.data.pageSize,
        loaded: true,
      });
    } catch (e) {
      console.error('加载客户失败', e);
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
        customerOnly: 'true',
      };
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;
      const res: any = await get('/users', params);
      const items = res?.items || res?.data || [];
      this.setData({
        customers: [...this.data.customers, ...items],
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
    this.setData({ searchKeyword: keyword, customers: [], page: 1, hasMore: true });
    this.loadCustomers();
  },

  goOrders(e: any) {
    const userId = e.currentTarget.dataset.userid;
    wx.navigateTo({ url: `/pages/admin/orders/orders?userId=${userId}` });
  },

  callCustomer(e: any) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) { wx.showToast({ title: '无联系电话', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone });
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
