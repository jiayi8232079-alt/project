Page({
  data: {
    loaded: false,
    statusBarHeight: 20,
    services: [
      {
        id: 1,
        icon: 'bed',
        title: '床位协调',
        desc: '在热门科室床位紧张时，启动绿色通道为您申请优先安排住院。',
        img: 'https://images.pexels.com/photos/3688261/pexels-photo-3688261.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        id: 2,
        icon: 'surgical',
        title: '手术安排',
        desc: '协助对接主刀专家团队、确认手术档期，提供术前准备全套指导。',
        img: 'https://images.pexels.com/photos/20081928/pexels-photo-20081928.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        id: 3,
        icon: 'monitor_heart',
        title: '术后关怀',
        desc: '安排术后探视与康复跟进，联络主治团队解答恢复期间的每一个疑虑。',
        img: 'https://images.pexels.com/photos/4173249/pexels-photo-4173249.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
    ],
    hospitals: [
      { icon: 'local_hospital', name: '协和医院' },
      { icon: 'cardiology', name: '阜外医院' },
      { icon: 'emergency', name: '华西医院' },
      { icon: 'health_and_safety', name: '瑞金医院' },
      { icon: 'medication', name: '中山医院' },
      { icon: 'clinical_notes', name: '湘雅医院' },
      { icon: 'ecg_heart', name: '301医院' },
      { icon: 'shield_with_heart', name: '长海医院' },
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
      title: '陪了个伴 · 住院协调 — 优先入院绿色通道',
      path: '/pages/inpatient/inpatient',
    };
  },

  onBook() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=inpatient' });
  },
});
