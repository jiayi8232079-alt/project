import { get } from '../../utils/request';

Page({
  data: {
    statusBarHeight: 20,
    subjectId: '',
    subject: {} as any,
    yearGroups: [] as any[],
    totalRecords: 0,
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    if (options.subjectId) {
      this.setData({ subjectId: options.subjectId });
      this.loadData();
    }
  },

  async loadData() {
    try {
      const [subject, records]: any[] = await Promise.all([
        get(`/users/service-targets/${this.data.subjectId}`),
        get(`/users/service-targets/${this.data.subjectId}/history`),
      ]);

      this.setData({ subject });

      const grouped = this.groupByYear(records || []);
      this.setData({
        yearGroups: grouped,
        totalRecords: (records || []).length,
      });
    } catch (e) {
      console.error('加载就诊记录失败', e);
      wx.showToast({ title: '加载就诊记录失败', icon: 'none' });
    }
  },

  groupByYear(records: any[]) {
    const map: Record<string, any[]> = {};
    records.forEach((r: any) => {
      const year = r.year || new Date(r.date).getFullYear().toString();
      if (!map[year]) map[year] = [];
      map[year].push(r);
    });
    return Object.entries(map)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([year, recs]) => ({
        year,
        records: recs.map((r, i) => ({
          ...r,
          isLatest: i === 0 && year === Object.keys(map).sort().reverse()[0],
          isLast: i === recs.length - 1,
        })),
      }));
  },

  goBack() {
    wx.navigateBack();
  },

  onRecordTap(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: '记录无关联订单', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/order/detail/detail?id=${id}` });
  },
});
