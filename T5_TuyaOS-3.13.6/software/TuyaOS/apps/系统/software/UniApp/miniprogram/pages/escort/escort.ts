Page({
  data: {
    loaded: false,
    statusBarHeight: 20,
    services: [
      {
        id: 1,
        icon: 'explore',
        title: '全程引导陪同',
        desc: '从挂号到取药，专人一对一全程陪同，门诊检查无缝衔接，省去排队烦恼。',
      },
      {
        id: 2,
        icon: 'payments',
        title: '代办缴费取药',
        desc: '代替排队缴费、取药取报告，您只需安心候诊或在VIP休息室等待。',
      },
      {
        id: 3,
        icon: 'history_edu',
        title: '医嘱专业整理',
        desc: '详细记录医生诊断意见与用药方案，整理成清晰的电子版，复诊无忧。',
      },
      {
        id: 4,
        icon: 'assignment_turned_in',
        title: '诊后全程跟进',
        desc: '协助预约复诊、提醒用药时间、对接后续检查，持续跟踪健康恢复。',
      },
    ],
    crowds: [
      {
        id: 1,
        icon: 'flight_takeoff',
        iconColor: '#1A2B4C',
        avatarBg: '#E8EDF5',
        title: '异地就医患者',
        desc: '人生地不熟，对医院流程陌生。我们提供接送站、住宿安排建议及全程院内陪同。',
      },
      {
        id: 2,
        icon: 'business_center',
        iconColor: '#C5A059',
        avatarBg: '#F9F6F0',
        title: '忙碌职场白领',
        desc: '工作繁忙分身乏术，无法亲自陪伴父母就医。我们代替子女行孝，实时反馈就诊进度。',
      },
      {
        id: 3,
        icon: 'elderly',
        iconColor: '#166534',
        avatarBg: '#F0F9F4',
        title: '高龄独居长者',
        desc: '行动不便，听力或记忆力减退。专业陪诊师全程耐心协助，确保医患沟通准确无误。',
      },
    ],
    hospitals: [
      { icon: 'local_hospital', name: '协和医院' },
      { icon: 'cardiology', name: '瑞金医院' },
      { icon: 'health_and_safety', name: '华西医院' },
      { icon: 'medication_liquid', name: '中山医院' },
      { icon: 'shield_with_heart', name: '301医院' },
      { icon: 'ecg_heart', name: '北医三院' },
      { icon: 'medical_services', name: '长海医院' },
      { icon: 'clinical_notes', name: '湘雅医院' },
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
      title: '陪了个伴 · 陪诊服务 — 全程温情陪伴',
      path: '/pages/escort/escort',
    };
  },

  onBook() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=escort' });
  },
});
