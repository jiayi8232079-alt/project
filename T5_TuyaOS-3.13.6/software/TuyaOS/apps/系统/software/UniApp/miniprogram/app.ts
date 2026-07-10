import { preloadCustomerServiceConfig } from './utils/customerService';
import { loadMiniProgramFeatures } from './utils/miniProgramFeatures';

App<IAppOption>({
  globalData: {
    userInfo: null,
  },
  onLaunch() {
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 外网 CDN 在国内/真机常慢或超时，会拖住首屏；延后加载且失败静默，避免误报「整卡」
    setTimeout(() => {
      wx.loadFontFace({
        global: true,
        family: 'Material Symbols Outlined',
        source:
          'url("https://cdn.jsdelivr.net/npm/@fontsource/material-symbols-outlined@5.2.37/files/material-symbols-outlined-latin-400-normal.woff2")',
        scopes: ['webview', 'native'],
        success: () => {},
        fail: () => {},
      });
    }, 2000);

    void preloadCustomerServiceConfig();
    void loadMiniProgramFeatures();
  },
});
