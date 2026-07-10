import { getPublic } from '../../../utils/request';

function safeDecodeScene(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const FAMILY_INVITE_RE = /^[A-Z0-9]{8}$/;

Page({
  onLoad(options: Record<string, string>) {
    const raw = options.scene;
    if (raw === undefined || raw === null || String(raw).length === 0) {
      wx.showModal({
        title: '无法打开',
        content: '请使用管理后台生成的微信官方小程序码扫码进入',
        showCancel: false,
      });
      return;
    }
    const code = safeDecodeScene(String(raw)).trim();
    if (!code) {
      wx.showModal({ title: '无法打开', content: '场景参数无效', showCancel: false });
      return;
    }
    // 家庭邀请：8 位大写字母数字（FamilyGroup.inviteCode 生成规则）
    if (FAMILY_INVITE_RE.test(code)) {
      wx.redirectTo({
        url: `/pages/family/join/join?inviteCode=${encodeURIComponent(code)}`,
      });
      return;
    }
    void this.resolveScene(code);
  },

  async resolveScene(code: string) {
    try {
      wx.showLoading({ title: '加载中…', mask: true });
      const pack: any = await getPublic('/public/mp-monitor-scene', { code });
      wx.hideLoading();
      const orderId = pack?.orderId;
      const token = pack?.token;
      const sceneType = pack?.sceneType || 'timeline';

      if (orderId == null) {
        wx.showModal({
          title: '无法打开',
          content: '服务器未返回有效订单信息',
          showCancel: false,
        });
        return;
      }

      if (sceneType === 'sign') {
        wx.redirectTo({
          url: `/pages/order/service-confirm/service-confirm?orderId=${orderId}&qrScene=${encodeURIComponent(code)}`,
        });
        return;
      }

      if (sceneType === 'health_sign') {
        const subjectId = orderId;
        wx.redirectTo({
          url: `/pages/health-profile/health-profile?subjectId=${subjectId}&qrScene=${encodeURIComponent(code)}`,
        });
        return;
      }

      if (sceneType === 'service_report') {
        wx.redirectTo({
          url: `/pages/order/service-report/service-report?orderId=${orderId}`,
        });
        return;
      }

      if (!token) {
        wx.showModal({
          title: '无法打开',
          content: '服务器未返回有效访问凭证',
          showCancel: false,
        });
        return;
      }
      wx.redirectTo({
        url: `/pages/order/share-timeline/share-timeline?orderId=${orderId}&token=${encodeURIComponent(String(token))}`,
      });
    } catch (e: any) {
      wx.hideLoading();
      wx.showModal({
        title: '无法打开',
        content: e?.message || '场景已失效，请让管理员重新生成小程序码',
        showCancel: false,
      });
    }
  },
});
