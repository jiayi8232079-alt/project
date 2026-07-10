import { get, post } from '../../../utils/request';

Page({
  data: {
    familyGroupId: 0,
    inviteCode: '',
    familyName: '',
    qrCodeBase64: '',
    qrLoading: false,
    qrError: '',
  },

  onLoad(options: any) {
    this.setData({ familyGroupId: Number(options.familyGroupId || 0) });
    if (this.data.familyGroupId) this.loadInviteCode();
  },

  async loadInviteCode() {
    try {
      const res: any = await get(`/family/${this.data.familyGroupId}/invite-code`);
      this.setData({ inviteCode: res.inviteCode || '', familyName: res.name || '' });
      // 拉完邀请码后尝试预生成二维码（失败不影响邀请码使用）
      void this.loadQrCode(false);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '加载失败', icon: 'none' });
    }
  },

  async loadQrCode(interactive = true) {
    if (this.data.qrLoading) return;
    this.setData({ qrLoading: true, qrError: '' });
    try {
      const res: any = await get(`/family/${this.data.familyGroupId}/invite-qrcode`);
      const base64 = res?.imageBase64;
      if (!base64) throw new Error('服务器未返回二维码');
      this.setData({ qrCodeBase64: `data:image/png;base64,${base64}` });
    } catch (e: any) {
      const msg = e?.message || '生成二维码失败';
      this.setData({ qrCodeBase64: '', qrError: msg });
      if (interactive) wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ qrLoading: false });
    }
  },

  copyCode() {
    if (!this.data.inviteCode) return;
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  async refreshCode() {
    try {
      const res: any = await post(`/family/${this.data.familyGroupId}/refresh-invite`, {});
      this.setData({ inviteCode: res.inviteCode || '', qrCodeBase64: '' });
      wx.showToast({ title: '已刷新，二维码重新生成中', icon: 'success' });
      void this.loadQrCode(false);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '刷新失败', icon: 'none' });
    }
  },

  saveQrToAlbum() {
    const base64 = this.data.qrCodeBase64;
    if (!base64) {
      wx.showToast({ title: '二维码尚未加载', icon: 'none' });
      return;
    }
    const raw = base64.replace(/^data:image\/\w+;base64,/, '');
    const fs = wx.getFileSystemManager();
    const path = `${wx.env.USER_DATA_PATH}/family-invite-${this.data.familyGroupId}.png`;
    try {
      fs.writeFileSync(path, raw, 'base64');
    } catch {
      wx.showToast({ title: '写入失败', icon: 'none' });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (String(err.errMsg || '').includes('auth')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存到相册',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting({ });
            },
          });
        } else {
          wx.showToast({ title: err.errMsg || '保存失败', icon: 'none' });
        }
      },
    });
  },

  onShareAppMessage() {
    const name = this.data.familyName || '陪了个伴家庭';
    const code = this.data.inviteCode;
    return {
      title: `邀请你加入我的家庭：${name}`,
      path: `/pages/order/scene-launch/scene-launch?scene=${encodeURIComponent(code)}`,
    };
  },

  onShareTimeline() {
    const name = this.data.familyName || '陪了个伴家庭';
    const code = this.data.inviteCode;
    return {
      title: `加入我的家庭：${name} · ${code}`,
      query: `scene=${encodeURIComponent(code)}`,
    };
  },
});
