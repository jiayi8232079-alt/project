import { get, post } from '../../../utils/request';
import { resolvePublicUrl } from '../../../utils/media-url';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const RATING_TEXTS = ['', '很不满意', '不满意', '一般', '满意', '非常满意'];
const QUICK_TAGS = ['准时到达', '态度亲切', '专业细致', '沟通顺畅', '耐心周到', '超出预期'];

Page({
  data: {
    pageNeedsLogin: false,
    loaded: false,
    orderId: '',
    staff: {} as any,
    rating: 0,
    ratingText: '',
    stars: [1, 2, 3, 4, 5],
    quickTags: QUICK_TAGS.map(t => ({ text: t, active: false })),
    comment: '',
    commentLength: 0,
    anonymous: false,
    submitting: false,
    /** 'edit' 可编辑提交；'view' 已提交只读 */
    mode: 'edit' as 'edit' | 'view',
    existingReview: null as any,
    reviewCreatedAtText: '',
  },

  onLoad(options: any) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
    }
    const rawMode = String(options.mode || '').toLowerCase();
    if (rawMode === 'view') {
      this.setData({ mode: 'view' });
    }
    setTimeout(() => this.setData({ loaded: true }), 100);
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    if (this.data.orderId) {
      this.loadOrderStaff();
      this.loadExistingReview();
    }
  },

  async loadExistingReview() {
    if (!this.data.orderId) return;
    try {
      const list: any = await get(`/orders/${this.data.orderId}/reviews`);
      const mine = Array.isArray(list) && list.length > 0 ? list[0] : null;
      if (!mine) {
        if (this.data.mode === 'view') {
          this.setData({ mode: 'edit' });
        }
        return;
      }
      const tags = Array.isArray(mine.tags) ? mine.tags : [];
      const quickTags = QUICK_TAGS.map((t) => ({
        text: t,
        active: tags.includes(t),
      }));
      const createdAt = mine.createdAt ? new Date(mine.createdAt) : null;
      const pad = (n: number) => String(n).padStart(2, '0');
      const createdAtText = createdAt
        ? `${createdAt.getFullYear()}-${pad(createdAt.getMonth() + 1)}-${pad(createdAt.getDate())} ${pad(createdAt.getHours())}:${pad(createdAt.getMinutes())}`
        : '';
      this.setData({
        mode: 'view',
        existingReview: mine,
        rating: Number(mine.rating) || 0,
        ratingText: RATING_TEXTS[Number(mine.rating) || 0] || '',
        quickTags,
        comment: mine.comment || '',
        commentLength: (mine.comment || '').length,
        reviewCreatedAtText: createdAtText,
      });
    } catch (e) {
      console.log('加载评价记录失败', e);
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadOrderStaff() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}`);
      const att = res.attendant || {};
      this.setData({
        staff: {
          name: att.name || att.realName || res.attendantName || '服务人员',
          avatar: resolvePublicUrl(att.avatar || att.avatarUrl || res.attendantAvatar || ''),
          title: att.title || '健康管家',
          badge: att.badge || '金牌',
          tags: att.tags || ['专业认证', '五星好评'],
          serviceDate: res.serviceTime
            ? new Date(res.serviceTime).toLocaleDateString('zh-CN')
            : '',
        },
      });
    } catch (e) {
      console.error('加载订单信息失败', e);
      this.setData({
        staff: {
          name: '服务人员',
          avatar: '',
          title: '健康管家',
          badge: '金牌',
          tags: ['专业认证'],
          serviceDate: '',
        },
      });
    }
  },

  onStarTap(e: any) {
    if (this.data.mode === 'view') return;
    const star = e.currentTarget.dataset.star;
    this.setData({
      rating: star,
      ratingText: RATING_TEXTS[star] || '',
    });
  },

  onTagTap(e: any) {
    if (this.data.mode === 'view') return;
    const tag = e.currentTarget.dataset.tag;
    const quickTags = this.data.quickTags.map((t: any) => ({
      ...t,
      active: t.text === tag ? !t.active : t.active,
    }));
    this.setData({ quickTags });
  },

  onCommentInput(e: any) {
    if (this.data.mode === 'view') return;
    const val = e.detail.value || '';
    this.setData({ comment: val, commentLength: val.length });
  },

  onAnonChange(e: any) {
    if (this.data.mode === 'view') return;
    this.setData({ anonymous: e.detail.value });
  },

  async onSubmit() {
    if (this.data.mode === 'view') return;
    if (!this.data.rating || this.data.submitting) return;
    this.setData({ submitting: true });

    try {
      const selectedTags = this.data.quickTags
        .filter((t: any) => t.active)
        .map((t: any) => t.text);

      await post(`/orders/${this.data.orderId}/review`, {
        rating: this.data.rating,
        tags: selectedTags,
        comment: this.data.comment,
        anonymous: this.data.anonymous,
      });

      wx.showToast({ title: '评价成功', icon: 'success' });
      const pages = getCurrentPages();
      const prev = pages.length >= 2 ? pages[pages.length - 2] : null;
      if (prev && typeof (prev as any).onReviewSubmitted === 'function') {
        try {
          (prev as any).onReviewSubmitted(this.data.orderId);
        } catch (err) {
          console.log('通知上一页刷新失败', err);
        }
      } else if (prev && typeof (prev as any).loadOrder === 'function') {
        try {
          (prev as any).loadOrder();
        } catch {}
      }
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      console.error('提交评价失败', e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  onBack() {
    wx.navigateBack();
  },
});
