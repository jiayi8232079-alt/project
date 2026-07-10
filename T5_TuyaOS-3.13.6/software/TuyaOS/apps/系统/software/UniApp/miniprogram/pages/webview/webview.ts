import { sanitizeWebviewUrl, showWebviewBlockedToast } from '../../utils/webview-guard';

Page({
  data: {
    url: '',
  },

  onLoad(options: any) {
    const rawUrl = options.url ? decodeURIComponent(options.url) : '';
    const safeUrl = sanitizeWebviewUrl(rawUrl);
    if (rawUrl && !safeUrl) {
      showWebviewBlockedToast();
      return;
    }
    const title = options.title ? decodeURIComponent(options.title) : '';
    this.setData({ url: safeUrl });
    if (title) wx.setNavigationBarTitle({ title });
  },
});
