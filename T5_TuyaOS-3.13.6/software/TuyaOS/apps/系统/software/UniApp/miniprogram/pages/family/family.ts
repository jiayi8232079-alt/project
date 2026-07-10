import { get, post } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { navigateBackOrHome, navigateToUserLogin } from '../../utils/identity';
import { resolvePublicUrl } from '../../utils/media-url';
import { mapWithConcurrency } from '../../utils/concurrency';

// 两次拉取之间的节流窗口；窗口内 onShow 跳过网络请求直接复用内存数据
const REFRESH_MIN_INTERVAL_MS = 2000;

// 家庭卡片上的预设头像映射（与编辑页保持一致）
const FAMILY_AVATAR_EMOJI_MAP: Record<string, string> = {
  home: '🏠',
  family: '👨‍👩‍👧‍👦',
  heart: '💕',
  hug: '🫂',
  sun: '☀️',
  tree: '🌳',
  star: '⭐',
  tea: '☕',
};

function resolveFamilyAvatar(raw: string | null | undefined): {
  avatarType: 'preset' | 'image' | 'default';
  avatarEmoji: string;
  avatarImage: string;
} {
  const v = String(raw ?? '').trim();
  if (!v) return { avatarType: 'default', avatarEmoji: '', avatarImage: '' };
  if (v.startsWith('preset:')) {
    const key = v.slice(7);
    return {
      avatarType: 'preset',
      avatarEmoji: FAMILY_AVATAR_EMOJI_MAP[key] || '',
      avatarImage: '',
    };
  }
  return {
    avatarType: 'image',
    avatarEmoji: '',
    avatarImage: resolvePublicUrl(v),
  };
}

Page({
  data: {
    families: [] as any[],
    loading: false,
    pageNeedsLogin: false,
  },

  _lastLoadAt: 0 as number,
  _loading: false as boolean,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true, families: [], loading: false });
      return;
    }
    if (this.data.pageNeedsLogin) {
      this.setData({ pageNeedsLogin: false });
    }
    const now = Date.now();
    if (
      !this._loading &&
      this.data.families.length > 0 &&
      now - this._lastLoadAt < REFRESH_MIN_INTERVAL_MS
    ) {
      return;
    }
    this.loadFamilies();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadFamilies() {
    if (this._loading) return;
    this._loading = true;
    // 已有数据时不再 setData({ loading: true }) 让列表整屏消失，减少闪烁
    const hasExisting = this.data.families.length > 0;
    if (!hasExisting) this.setData({ loading: true });
    try {
      const res: any = await get('/family');
      const families: any[] = Array.isArray(res) ? res : (res.items || []);
      // 限并发：N 个家庭就是 N 条 wx.request，叠加首页/tab-bar 已有请求容易爆 10 条上限。
      // 多家庭并不常见，4 条足够覆盖大多数场景而不至于让用户等串行。
      await mapWithConcurrency(families, 4, async (f: any) => {
        try {
          const members: any = await get(`/family/${f.familyGroupId}/members`);
          const list = Array.isArray(members) ? members : (members.items || []);
          list.forEach((m: any) => {
            const displayName = m.nickname || m.user?.nickname || '家人';
            m.initial = String(displayName).slice(0, 1);
          });
          f.members = list;
        } catch {
          f.members = [];
        }
        const avatar = resolveFamilyAvatar(f.familyGroup?.avatarUrl);
        f.avatarType = avatar.avatarType;
        f.avatarEmoji = avatar.avatarEmoji;
        f.avatarImage = avatar.avatarImage;
      });
      this._lastLoadAt = Date.now();
      this.setData({ families });
    } catch { /* ignore */ }
    finally {
      this._loading = false;
      if (this.data.loading) this.setData({ loading: false });
    }
  },

  createFamily() {
    wx.showModal({
      title: '创建家庭',
      editable: true,
      placeholderText: '请输入家庭名称（如：张家）',
      success: async (res) => {
        if (res.confirm && res.content?.trim()) {
          try {
            await post('/family', { name: res.content.trim() });
            wx.showToast({ title: '创建成功', icon: 'success' });
            this.loadFamilies();
          } catch (e: any) {
            wx.showToast({ title: e?.message || '创建失败', icon: 'none' });
          }
        }
      },
    });
  },

  joinFamily() {
    wx.navigateTo({ url: '/pages/family/join/join' });
  },

  goInvite(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/family/invite/invite?familyGroupId=${id}` });
  },

  goDashboard(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/family/dashboard/dashboard?familyGroupId=${id}` });
  },

  async goMemberDetail(e: any) {
    const stId = e.currentTarget.dataset.stid;
    const role = e.currentTarget.dataset.role;
    if (stId) {
      wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${stId}` });
      return;
    }

    // 兜底：guardian 行未关联档案时，尝试用当前账号的 relationship='self' 档案（与后台一致的 self→guardian 逻辑）
    if (role === 'guardian') {
      try {
        const list: any = await get('/users/me/service-targets');
        const targets: any[] = Array.isArray(list) ? list : (list?.items || []);
        const selfTarget = targets.find((t: any) => {
          const hp = t?.healthProfile;
          const hpObj = typeof hp === 'string' ? (() => { try { return JSON.parse(hp); } catch { return null; } })() : hp;
          return hpObj?.relationship === 'self' || t?.relationship === 'self';
        });
        if (selfTarget?.id) {
          wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${selfTarget.id}` });
          return;
        }
      } catch { /* ignore, fallthrough */ }
      wx.showModal({
        title: '本人档案尚未建立',
        content: '尚未填写本人健康档案，是否现在去添加？',
        confirmText: '去添加',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/health/add-member/add-member?relationship=self' });
          }
        },
      });
      return;
    }
    wx.showToast({ title: '该成员尚未关联健康档案', icon: 'none', duration: 2200 });
  },

  goAddElder(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/family/add-elder/add-elder?familyGroupId=${id}` });
  },

  goEditFamily(e: any) {
    const id = e.currentTarget.dataset.id;
    const role = e.currentTarget.dataset.role;
    if (role !== 'guardian') {
      wx.showToast({ title: '只有管理者可以修改家庭信息', icon: 'none' });
      return;
    }
    if (!id) return;
    wx.navigateTo({ url: `/pages/family/edit/edit?familyGroupId=${id}` });
  },
});
