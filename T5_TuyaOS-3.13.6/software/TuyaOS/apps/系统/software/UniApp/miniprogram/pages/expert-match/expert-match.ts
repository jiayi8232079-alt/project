Page({
  data: {
    loaded: false,
    statusBarHeight: 20,
    advantages: [
      {
        id: 1,
        icon: 'diamond',
        title: '顶级资源',
        desc: '覆盖北上广深一线名院，为您打开稀缺医疗资源的大门。',
        img: 'https://images.pexels.com/photos/8376235/pexels-photo-8376235.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        id: 2,
        icon: 'sync_alt',
        title: '双向评估',
        desc: '医患双方深度匹配，不仅仅是看病，更是寻找最适合您的治疗方案。',
        img: 'https://images.pexels.com/photos/6129647/pexels-photo-6129647.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        id: 3,
        icon: 'assignment_turned_in',
        title: '报告详录',
        desc: '会诊结束后出具详细的咨询报告与后续康复指导计划。',
        img: 'https://images.pexels.com/photos/6129111/pexels-photo-6129111.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
    ],
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

  onShareAppMessage() {
    return {
      title: '陪了个伴 · 专家匹配 — 精准对接名医资源',
      path: '/pages/expert-match/expert-match',
    };
  },

  onShare() {},

  onBook() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=expert' });
  },
});
