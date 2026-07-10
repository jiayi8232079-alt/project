import { get } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const CATEGORY_LABELS: Record<string, string> = {
  medication_miss: '漏服预警',
  follow_up_overdue: '复诊逾期',
  timeline_keyword: '服务高危信号',
  service_exception: '服务异常',
  manual: '人工预警',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: '紧急',
  medium: '重要',
  low: '提醒',
};

const STATUS_LABELS: Record<string, string> = {
  new: '未处理',
  acknowledged: '已知悉',
  closed: '已关闭',
  ignored: '已忽略',
};

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

Page({
  data: {
    statusBarHeight: 0,
    pageNeedsLogin: false,
    activeTab: 'new' as 'new' | 'all',
    items: [] as any[],
    loading: false,
    refreshing: false,
  },

  onLoad() {
    const sys = wx.getWindowInfo?.() || wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    this.loadAlerts();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadAlerts().finally(() => this.setData({ refreshing: false }));
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab }, () => this.loadAlerts());
  },

  async loadAlerts() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: Record<string, string | number> = {
        pageSize: 50,
      };
      if (this.data.activeTab === 'new') params.status = 'new';
      const res: any = await get('/alerts', params);
      const rawItems = Array.isArray(res?.items) ? res.items : [];
      const items = rawItems.map((x: any) => ({
        ...x,
        categoryLabel: CATEGORY_LABELS[x.category] || '预警',
        severityLabel: SEVERITY_LABELS[x.severity] || '提醒',
        statusLabel: STATUS_LABELS[x.status] || '',
        targetName:
          x.serviceTarget?.name || x.user?.nickname || '家人',
        triggeredAtText: formatTime(x.triggeredAt),
      }));
      this.setData({ items });
    } catch (e) {
      console.log('加载预警失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  goBack() {
    navigateBackOrHome();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  goDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/alert/detail/detail?id=${id}` });
  },
});
