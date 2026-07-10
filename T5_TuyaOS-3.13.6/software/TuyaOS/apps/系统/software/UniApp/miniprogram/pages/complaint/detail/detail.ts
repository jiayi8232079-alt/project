import { get, post } from '../../../utils/request';
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

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#6366f1',
  resolved: '#10b981',
  rejected: '#ef4444',
  closed: '#9ca3af',
};

const CATEGORY_LABELS: Record<string, string> = {
  service: '服务质量',
  attendant: '陪诊员相关',
  dispatch: '派单/响应',
  payment: '支付/退款',
  report: '报告/资料',
  other: '其他',
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: '普通',
  high: '紧急',
  urgent: '非常紧急',
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
    id: '',
    complaint: null as any,
    timeline: [] as any[],
    newMessage: '',
    submitting: false,
    rating: 0,
    stars: [1, 2, 3, 4, 5],
    canReply: false,
    canRate: false,
    canClose: false,
  },

  onLoad(options: any) {
    const sys = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    const id = options?.id;
    if (!id) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }
    this.setData({ id: String(id) });
    setTimeout(() => this.setData({ loaded: true }), 60);
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    await this.loadDetail();
  },

  onPullDownRefresh() {
    this.loadDetail().finally(() => wx.stopPullDownRefresh());
  },

  async onRefresh() {
    this.setData({ refreshing: true });
    await this.loadDetail();
    this.setData({ refreshing: false });
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

  async loadDetail() {
    if (!this.data.id) return;
    this.setData({ loading: true });
    try {
      const res: any = await get(`/complaints/${this.data.id}`);
      const status = res?.status;
      const timeline = Array.isArray(res?.timeline) ? res.timeline : [];
      const decoratedTimeline = timeline
        .map((item: any) => {
          // 后端实体字段是 byType/byName；兼容老字段 from/fromName
          const from = item.byType || item.from || 'system';
          const byName = item.byName || item.fromName || '';
          const fromLabel =
            from === 'user'
              ? byName || '您'
              : from === 'admin'
              ? byName ? `客服 · ${byName}` : '客服'
              : from === 'system'
              ? '系统'
              : byName || from;
          return {
            ...item,
            from,
            byName,
            timeText: formatTime(item.at),
            fromLabel,
          };
        })
        .sort(
          (a: any, b: any) =>
            new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime(),
        );

      this.setData({
        complaint: {
          ...res,
          statusLabel: STATUS_LABELS[status] || status,
          statusColor: STATUS_COLORS[status] || '#6b7280',
          categoryLabel: CATEGORY_LABELS[res?.category] || res?.category,
          priorityLabel: PRIORITY_LABELS[res?.priority] || res?.priority,
          createdAtText: formatTime(res?.createdAt),
          updatedAtText: formatTime(res?.updatedAt),
          resolvedAtText: formatTime(res?.resolvedAt),
          closedAtText: formatTime(res?.closedAt),
        },
        timeline: decoratedTimeline,
        canReply: ['pending', 'processing', 'resolved'].includes(status),
        canRate: status === 'resolved' && !res?.userRating,
        canClose: ['pending', 'processing', 'resolved'].includes(status),
        rating: Number(res?.userRating || 0),
      });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onMessageInput(e: any) {
    this.setData({ newMessage: e.detail.value });
  },

  async sendMessage() {
    const content = (this.data.newMessage || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await post(`/complaints/${this.data.id}/append`, { content });
      this.setData({ newMessage: '' });
      await this.loadDetail();
      wx.showToast({ title: '已发送', icon: 'success' });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '发送失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onStarTap(e: any) {
    if (!this.data.canRate) return;
    const v = Number(e.currentTarget.dataset.v || 0);
    this.setData({ rating: v });
  },

  async submitRating() {
    if (!this.data.rating) {
      wx.showToast({ title: '请先点击星星评分', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await post(`/complaints/${this.data.id}/append`, {
        rating: this.data.rating,
      });
      await this.loadDetail();
      wx.showToast({ title: '感谢您的评价', icon: 'success' });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '评分失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  closeTicket() {
    wx.showModal({
      title: '确认关闭工单？',
      content: '关闭后将不再跟进，如仍有问题可重新提交。',
      confirmText: '确认关闭',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await post(`/complaints/${this.data.id}/append`, { close: true });
          await this.loadDetail();
          wx.showToast({ title: '工单已关闭', icon: 'success' });
        } catch (e: any) {
          wx.showToast({ title: e?.message || '关闭失败', icon: 'none' });
        }
      },
    });
  },

  previewImage(e: any) {
    const idx = Number(e.currentTarget.dataset.index || 0);
    const list = this.data.complaint?.images || [];
    if (!list[idx]) return;
    wx.previewImage({
      current: list[idx],
      urls: list,
    });
  },

  callCustomerService() {
    wx.makePhoneCall({ phoneNumber: '400-888-8888' });
  },
});
