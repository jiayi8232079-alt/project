Page({
  data: {
    type: 'agreement',
    title: '用户服务协议',
    statusBarHeight: 20,
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    const type = options.type || 'agreement';
    this.setData({
      type,
      title: type === 'privacy' ? '隐私政策' : '用户服务协议',
      statusBarHeight: sysInfo.statusBarHeight,
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
