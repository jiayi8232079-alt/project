import { getPublic, post } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import { navigateToUserLogin } from '../../../utils/identity';

Page({
  data: {
    inviteCode: '',
    selectedRelation: '',
    nickname: '',
    relations: [
      { value: 'father', label: '父亲' },
      { value: 'mother', label: '母亲' },
      { value: 'spouse', label: '配偶' },
      { value: 'child', label: '子女' },
      { value: 'other', label: '其他' },
    ],
    canSubmit: false,
    previewFamily: null as any,
    previewLoading: false,
  },

  onLoad(options: any) {
    const raw = String(options?.inviteCode || '').toUpperCase().trim();
    if (raw && /^[A-Z0-9]{8}$/.test(raw)) {
      this.setData({ inviteCode: raw, canSubmit: true });
      this.loadFamilyPreview(raw);
    }
  },

  onCodeInput(e: any) {
    const code = (e.detail.value || '').toUpperCase();
    this.setData({ inviteCode: code, canSubmit: code.length === 8, previewFamily: null });
    if (code.length === 8) this.loadFamilyPreview(code);
  },

  async loadFamilyPreview(code: string) {
    this.setData({ previewLoading: true });
    try {
      const res: any = await getPublic(`/public/family/by-invite-code/${encodeURIComponent(code)}`);
      this.setData({ previewFamily: res || null });
    } catch {
      this.setData({ previewFamily: null });
    } finally {
      this.setData({ previewLoading: false });
    }
  },

  onNicknameInput(e: any) {
    this.setData({ nickname: e.detail.value });
  },

  selectRelation(e: any) {
    this.setData({ selectedRelation: e.currentTarget.dataset.value });
  },

  async submit() {
    if (!this.data.canSubmit) return;
    if (!this.data.selectedRelation) {
      wx.showToast({ title: '请选择与家庭创建者的关系', icon: 'none' });
      return;
    }
    if (!isLoggedIn()) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录后才能加入家庭',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) navigateToUserLogin();
        },
      });
      return;
    }
    try {
      await post('/family/join', {
        inviteCode: this.data.inviteCode,
        relation: this.data.selectedRelation,
        nickname: this.data.nickname || undefined,
      });
      wx.showToast({ title: '加入成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '加入失败', icon: 'none' });
    }
  },
});
