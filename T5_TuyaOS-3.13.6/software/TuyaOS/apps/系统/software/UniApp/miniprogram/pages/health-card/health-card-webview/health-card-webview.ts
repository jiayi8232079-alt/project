import { sanitizeWebviewUrl, showWebviewBlockedToast } from '../../../utils/webview-guard';

Page({
  data: {
    statusBarHeight: 20,
    url: '',
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    const rawUrl = options.url ? decodeURIComponent(options.url) : '';
    const safeUrl = sanitizeWebviewUrl(rawUrl);
    if (rawUrl && !safeUrl) {
      this.setData({ statusBarHeight: sysInfo.statusBarHeight });
      showWebviewBlockedToast();
      return;
    }
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      url: safeUrl,
    });
  },

  onMessage() {},

  goBack() {
    wx.navigateBack();
  },
});
