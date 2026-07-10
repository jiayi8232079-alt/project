Page({
  data: {
    loaded: false,
    statusBarHeight: 20,
    advantages: [
      {
        id: 1,
        icon: 'verified_user',
        title: '名医资源直达',
        desc: '深度链接北京协和、华山、301等顶级三甲医院主任级专家，打破信息壁垒。',
      },
      {
        id: 2,
        icon: 'assignment_turned_in',
        title: '专业病案解读',
        desc: '资深全科医生预先整理病历资料，精准匹配专科领域，提高面诊效率。',
      },
      {
        id: 3,
        icon: 'lock',
        title: '私密安全保护',
        desc: '严格遵循HIPAA标准，全流程隐私加密，专属诊室一对一私密面谈。',
      },
    ],
    departments: [
      { id: 1, icon: 'cardiology', name: '心血管内科', desc: '冠心病、高血压专家', iconBg: '#FEF2F2', iconColor: '#DC2626' },
      { id: 2, icon: 'science',    name: '肿瘤专科',   desc: '早期筛查、综合治疗', iconBg: '#F5F3FF', iconColor: '#7C3AED' },
      { id: 3, icon: 'neurology',  name: '神经内科',   desc: '脑血管病、帕金森',   iconBg: '#EFF6FF', iconColor: '#2563EB' },
      { id: 4, icon: 'child_care', name: '儿科专家',   desc: '生长发育、呼吸道',   iconBg: '#FFF7ED', iconColor: '#EA580C' },
    ],
    flowSteps: [
      {
        id: 1,
        num: '1',
        title: '线上预约',
        desc: '提交基本信息与咨询需求，专属管家15分钟内响应。',
        dotBg: '#1A2B4C',
        dotColor: '#FFFFFF',
        dotBorder: 'none',
      },
      {
        id: 2,
        num: '2',
        title: '资料预审',
        desc: '医疗团队整理既往病历，为您精准匹配专家领域。',
        dotBg: '#FFFFFF',
        dotColor: '#1A2B4C',
        dotBorder: '2rpx solid rgba(26,43,76,0.2)',
      },
      {
        id: 3,
        num: '3',
        title: '到店面谈',
        desc: '陪了个伴中心VIP诊室，面对面深度沟通咨询方案。',
        dotBg: '#FFFFFF',
        dotColor: '#1A2B4C',
        dotBorder: '2rpx solid rgba(26,43,76,0.2)',
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
      title: '陪了个伴 · 门诊咨询 — 快速解答疑惑',
      path: '/pages/consult/consult',
    };
  },

  onShare() {},

  onMoreDepts() {
    wx.showToast({ title: '更多科室开发中', icon: 'none' });
  },

  onBook() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=consult' });
  },
});
