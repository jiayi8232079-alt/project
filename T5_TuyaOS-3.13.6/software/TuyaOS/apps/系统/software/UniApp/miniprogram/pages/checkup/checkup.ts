Page({
  data: {
    loaded: false,
    statusBarHeight: 20,
    flowSteps: [
      { id: 1, num: '1', title: '深度访谈', desc: '专业顾问深入了解您的健康史。' },
      { id: 2, num: '2', title: '方案定制', desc: '资深医疗团队为您匹配专项筛查。' },
      { id: 3, num: '3', title: '预约协调', desc: '统筹顶尖机构，确保高效就医。' },
      { id: 4, num: '4', title: '陪同体检', desc: '全程金牌陪诊，提供尊享引导。' },
      { id: 5, num: '5', title: '专家解读', desc: '首席专家1对1为您剖析报告。' },
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
      title: '陪了个伴 · 体检规划 — 个性化深度定制',
      path: '/pages/checkup/checkup',
    };
  },

  onShare() {
    // 触发系统分享菜单无需额外操作，已通过 onShareAppMessage 启用
  },

  onBook() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=checkup' });
  },
});
