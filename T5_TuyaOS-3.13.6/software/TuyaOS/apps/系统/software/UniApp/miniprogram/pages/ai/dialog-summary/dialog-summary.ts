import { get } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(start?: string, end?: string) {
  if (!start) return '';
  if (!end) return '进行中';
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return '';
  const min = Math.round((e - s) / 60_000);
  if (min < 1) return '不到 1 分钟';
  return `约 ${min} 分钟`;
}

Page({
  data: {
    statusBarHeight: 0,
    pageNeedsLogin: false,
    loading: false,
    refreshing: false,
    loaded: false,
    deviceId: 0,
    serviceTargetId: 0,
    filterName: '',
    sessions: [] as any[],
  },

  onLoad(options: any) {
    const sys = wx.getWindowInfo?.() || wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sys.statusBarHeight || 44,
      deviceId: Number(options?.deviceId || 0),
      serviceTargetId: Number(options?.serviceTargetId || 0),
      filterName: options?.name ? decodeURIComponent(options.name) : '',
    });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    this.loadSessions();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadSessions().finally(() => this.setData({ refreshing: false }));
  },

  async loadSessions() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: Record<string, string | number> = { pageSize: 50 };
      if (this.data.deviceId) params.deviceId = this.data.deviceId;
      if (this.data.serviceTargetId) params.serviceTargetId = this.data.serviceTargetId;
      const res: any = await get('/ai-dialogs', params);
      const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      const sessions = rawItems.map((s: any) => ({
        id: s.id,
        startedAtText: formatDate(s.startedAt),
        durationText: formatDuration(s.startedAt, s.endedAt),
        turns: s.totalTurns || 0,
        summary: s.summary || '本次对话暂无摘要',
        hasSummary: !!s.summary,
        hasCrisis: (s.crisisScore || 0) > 0,
        crisisWords: Array.isArray(s.crisisWords) ? s.crisisWords.join('、') : '',
      }));
      this.setData({ sessions, loaded: true });
    } catch (e) {
      console.log('加载对话摘要失败', e);
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  goDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/ai/dialog-detail/dialog-detail?id=${id}` });
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
});
