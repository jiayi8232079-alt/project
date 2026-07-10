Page({
  data: {
    loaded: false,
    statusBarHeight: 20,
  },

  onLoad() {
    wx.getSystemInfo({
      success: (res) => {
        this.setData({ statusBarHeight: res.statusBarHeight });
      },
    });
    wx.nextTick(() => {
      this.setData({ loaded: true });
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goExpertMatch() {
    wx.navigateTo({ url: '/pages/expert-match/expert-match' });
  },

  goConsult() {
    wx.navigateTo({ url: '/pages/consult/consult' });
  },

  goInpatient() {
    wx.navigateTo({ url: '/pages/inpatient/inpatient' });
  },

  onShare() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' });
  },

  onBook() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=expert' });
  },
});
