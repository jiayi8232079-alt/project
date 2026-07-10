import { get, put } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';
import { getUserInfo } from '../../../utils/auth';

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

const TYPE_LABEL: Record<string, string> = {
  transport: '交通费',
  meal: '餐饮费',
  parking: '停车费',
  other: '其他',
};

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    loading: false,
    canApprove: false,
    activeTab: 'records',
    tabs: [
      { key: 'records', label: '费用记录' },
      { key: 'stats', label: '统计报表' },
    ],
    records: [] as any[],
    total: 0,
    page: 1,
    pageSize: 15,
    hasMore: true,
    filterStatus: '',
    statusOptions: [
      { label: '全部', value: '' },
      { label: '待审核', value: 'pending' },
      { label: '已通过', value: 'approved' },
      { label: '已驳回', value: 'rejected' },
    ],
    stats: null as any,
    statsLoaded: false,
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    const userInfo = getUserInfo();
    // 财务模块仅对 admin / finance 开放；operator / customer_service / medical_consultant 访问直接拒绝，避免后端返回 403 空页。
    if (!['admin', 'finance'].includes(userInfo?.role)) {
      wx.showToast({ title: '暂无财务模块权限', icon: 'none' });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.switchTab({ url: '/pages/mine/mine' });
      }, 500);
      return;
    }
    const canApprove = ['admin', 'finance'].includes(userInfo?.role);
    this.setData({ canApprove, records: [], page: 1, hasMore: true });
    this.loadRecords();
  },

  onPullDownRefresh() {
    this.setData({ records: [], page: 1, hasMore: true });
    this.loadRecords().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadMore();
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'stats' && !this.data.statsLoaded) this.loadStats();
  },

  onFilterStatus(e: any) {
    this.setData({ filterStatus: e.currentTarget.dataset.status, records: [], page: 1, hasMore: true });
    this.loadRecords();
  },

  async loadRecords() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: any = { page: this.data.page, pageSize: this.data.pageSize };
      if (this.data.filterStatus) params.status = this.data.filterStatus;
      const res: any = await get('/finance', params);
      const items = (res?.items || res?.data || []).map(mapRecord);
      this.setData({
        records: items,
        total: res?.total ?? items.length,
        hasMore: items.length === this.data.pageSize,
        loaded: true,
      });
    } catch (e) {
      console.error('加载费用记录失败', e);
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
      const params: any = { page: nextPage, pageSize: this.data.pageSize };
      if (this.data.filterStatus) params.status = this.data.filterStatus;
      const res: any = await get('/finance', params);
      const items = (res?.items || res?.data || []).map(mapRecord);
      this.setData({
        records: [...this.data.records, ...items],
        hasMore: items.length === this.data.pageSize,
      });
    } catch { /* */ } finally {
      this.setData({ loading: false });
    }
  },

  async loadStats() {
    try {
      const stats: any = await get('/finance/report');
      this.setData({ stats, statsLoaded: true });
    } catch (e) {
      console.error('加载统计失败', e);
      this.setData({ statsLoaded: true });
    }
  },

  async approveRecord(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '审核通过',
      content: '确认通过该费用报销？',
      editable: true,
      placeholderText: '审核备注（选填）',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await put(`/finance/${id}/approve`, { reviewNote: res.content || '' });
          wx.showToast({ title: '已通过', icon: 'success' });
          await this.loadRecords();
        } catch {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  async rejectRecord(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '审核驳回',
      content: '请填写驳回原因',
      editable: true,
      placeholderText: '驳回原因',
      success: async (res) => {
        if (!res.confirm) return;
        if (!res.content?.trim()) {
          wx.showToast({ title: '请填写驳回原因', icon: 'none' });
          return;
        }
        try {
          await put(`/finance/${id}/reject`, { reviewNote: res.content });
          wx.showToast({ title: '已驳回', icon: 'success' });
          await this.loadRecords();
        } catch {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
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

function mapRecord(r: any) {
  return {
    ...r,
    statusLabel: STATUS_LABEL[r.status] || r.status,
    typeLabel: TYPE_LABEL[r.type] || r.type || '费用',
    dateDisplay: r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    attendantName: r.attendant?.user ? (r.attendant.user.name || r.attendant.user.nickname || '陪诊员') : '陪诊员',
  };
}
