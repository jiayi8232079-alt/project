import { get, put } from '../../../utils/request';
import { resolvePublicUrl } from '../../../utils/media-url';
import { BASE_URL } from '../../../config';

// 预设头像：preset:xxx → 对应 emoji
const PRESET_AVATARS: Array<{ key: string; emoji: string; label: string }> = [
  { key: 'home', emoji: '🏠', label: '家' },
  { key: 'family', emoji: '👨‍👩‍👧‍👦', label: '全家福' },
  { key: 'heart', emoji: '💕', label: '亲情' },
  { key: 'hug', emoji: '🫂', label: '拥抱' },
  { key: 'sun', emoji: '☀️', label: '阳光' },
  { key: 'tree', emoji: '🌳', label: '大树' },
  { key: 'star', emoji: '⭐', label: '星辰' },
  { key: 'tea', emoji: '☕', label: '惬意' },
];

Page({
  data: {
    familyGroupId: 0,
    name: '',
    originName: '',
    /** 头像类型：preset / image / default */
    avatarType: 'default' as 'preset' | 'image' | 'default',
    /** 当 avatarType === preset 时，存预设 key；image 时存完整 URL；default 时为空 */
    avatarValue: '',
    /** 用于显示的 emoji；为空表示非预设 */
    avatarEmoji: '',
    /** 用于显示的图片 URL；为空表示非图片 */
    avatarImage: '',
    /** 后端原始 avatar_url 值（preset:xxx 或 url），保存时提交 */
    avatarRaw: '' as string | null,
    presets: PRESET_AVATARS,
    uploading: false,
    saving: false,
    canEdit: true,
  },

  onLoad(options: any) {
    const id = Number(options?.familyGroupId || 0);
    if (!id) {
      wx.showToast({ title: '家庭参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ familyGroupId: id });
    this.loadFamily();
  },

  async loadFamily() {
    try {
      const res: any = await get('/family');
      const list: any[] = Array.isArray(res) ? res : res?.items || [];
      const target = list.find((m: any) =>
        Number(m?.familyGroupId) === this.data.familyGroupId || Number(m?.familyGroup?.id) === this.data.familyGroupId,
      );
      if (!target) {
        wx.showToast({ title: '家庭信息加载失败', icon: 'none' });
        return;
      }
      const fg = target.familyGroup || {};
      const isGuardian = target.role === 'guardian';
      this.setData({
        name: fg.name || '',
        originName: fg.name || '',
        canEdit: isGuardian,
      });
      this.applyAvatar(fg.avatarUrl || '');
    } catch (e: any) {
      wx.showToast({ title: e?.message || '加载失败', icon: 'none' });
    }
  },

  applyAvatar(raw: string | null) {
    const v = String(raw || '').trim();
    if (!v) {
      this.setData({ avatarType: 'default', avatarValue: '', avatarEmoji: '', avatarImage: '', avatarRaw: '' });
      return;
    }
    if (v.startsWith('preset:')) {
      const key = v.slice(7);
      const preset = PRESET_AVATARS.find((p) => p.key === key);
      this.setData({
        avatarType: 'preset',
        avatarValue: key,
        avatarEmoji: preset?.emoji || '',
        avatarImage: '',
        avatarRaw: v,
      });
      return;
    }
    this.setData({
      avatarType: 'image',
      avatarValue: v,
      avatarEmoji: '',
      avatarImage: resolvePublicUrl(v),
      avatarRaw: v,
    });
  },

  onNameInput(e: any) {
    this.setData({ name: e.detail.value });
  },

  pickPreset(e: any) {
    if (!this.data.canEdit) return;
    const key = e.currentTarget.dataset.key;
    const preset = PRESET_AVATARS.find((p) => p.key === key);
    if (!preset) return;
    this.setData({
      avatarType: 'preset',
      avatarValue: key,
      avatarEmoji: preset.emoji,
      avatarImage: '',
      avatarRaw: `preset:${key}`,
    });
  },

  clearAvatar() {
    if (!this.data.canEdit) return;
    this.setData({ avatarType: 'default', avatarValue: '', avatarEmoji: '', avatarImage: '', avatarRaw: '' });
  },

  chooseCustomImage() {
    if (!this.data.canEdit) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles?.[0];
        if (!file) return;
        this.uploadAvatar(file.tempFilePath);
      },
    });
  },

  async uploadAvatar(filePath: string) {
    this.setData({ uploading: true });
    try {
      const url: string = await new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');
        wx.uploadFile({
          url: `${BASE_URL}/documents/raw-upload`,
          filePath,
          name: 'file',
          header: { Authorization: token ? `Bearer ${token}` : '' },
          success(res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error('上传失败'));
              return;
            }
            try {
              const data = JSON.parse(res.data || '{}');
              const u = data?.data?.url || data?.url;
              if (!u) return reject(new Error('上传成功但未返回地址'));
              resolve(u);
            } catch (err) {
              reject(err as Error);
            }
          },
          fail: () => reject(new Error('上传失败')),
        });
      });
      this.setData({
        avatarType: 'image',
        avatarValue: url,
        avatarEmoji: '',
        avatarImage: resolvePublicUrl(url),
        avatarRaw: url,
      });
      wx.showToast({ title: '头像已上传', icon: 'success' });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '上传失败', icon: 'none' });
    } finally {
      this.setData({ uploading: false });
    }
  },

  async save() {
    if (!this.data.canEdit) {
      wx.showToast({ title: '只有管理者可以修改', icon: 'none' });
      return;
    }
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' });
      return;
    }
    if (name.length > 30) {
      wx.showToast({ title: '家庭名称最长 30 个字', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await put(`/family/${this.data.familyGroupId}`, {
        name,
        avatarUrl: this.data.avatarRaw || '',
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
