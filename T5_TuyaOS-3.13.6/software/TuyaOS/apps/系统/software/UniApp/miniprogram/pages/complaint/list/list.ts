import { get } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  rejected: '已驳回',
  closed: '已关闭',
};

const CATEGORY_LABELS: Record<string, string> = {
  service: '服务质量',
  attendant: '陪诊员相关',
  dispatch: '派单/响应',
  payment: '支付/退款',
  report: '报告/资料',
  other: '其他',
};

function formatTime(t?: string) {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    statusBarHeight: 0,
    pageNeedsLogin: false,
    loaded: false,
    loading: false,
    refreshing: false,
    finished: false,
    items: [] as any[],
    page: 1,
    pageSize: 10,
    activeTab: '' as '' | 'pending' | 'processing' | 'resolved' | 'closed',
  },

  onLoad() {
    const sys = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    setTimeout(() => this.setData({ loaded: true }), 60);
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    this.resetAndLoad();
  },

  async onRefresh() {
    this.setData({ refreshing: true });
    await this.resetAndLoad();
    this.setData({ refreshing: false });
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading) return;
    this.loadMore();
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' }).catch(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      });
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async resetAndLoad() {
    this.setData({ page: 1, items: [], finished: false });
    await this.loadList();
  },

  async loadMore() {
    this.setData({ page: this.data.page + 1 });
    await this.loadList(true);
  },

  async loadList(append = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: Record<string, any> = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.activeTab) params.status = this.data.activeTab;
      const res: any = await get('/complaints/mine', params);
      const rawItems = res?.items || [];
      const items = rawItems.map((item: any) => ({
        ...item,
        statusLabel: STATUS_LABELS[item.status] || item.status,
        categoryLabel: CATEGORY_LABELS[item.category] || item.category,
        createdAtText: formatTime(item.createdAt),
        resolvedAtText: formatTime(item.resolvedAt),
      }));
      const merged = append ? [...this.data.items, ...items] : items;
      const total = Number(res?.total || merged.length);
      this.setData({
        items: merged,
        finished: merged.length >= total,
      });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onTabChange(e: any) {
    const tab = e.currentTarget.dataset.tab || '';
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    await this.resetAndLoad();
  },

  onItemTap(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/complaint/detail/detail?id=${id}` });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/complaint/create/create' });
  },
});
