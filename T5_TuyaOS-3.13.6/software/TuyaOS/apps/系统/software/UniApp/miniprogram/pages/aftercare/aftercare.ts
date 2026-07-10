import { get } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { requestSubscribe } from '../../utils/subscribe';

interface FollowUp {
  orderId: number;
  date: string;
  hospital: string;
  department: string;
  note: string;
  patientName: string;
  daysLeft: number;
  urgent: boolean;
}

interface MedItem {
  id: number;
  name: string;
  usage: string;
  reminderTime: string;
  endDate: string;
  patientName: string;
  daysLeft: number;
  active: boolean;
}

interface ReportItem {
  orderId: number;
  summary: string;
  serviceDate: string;
  patientName: string;
  hospital: string;
}

Page({
  data: {
    statusBarHeight: 0,
    tabIndex: 0,
    loading: true,
    followUps: [] as FollowUp[],
    nearFollowUp: null as FollowUp | null,
    medications: [] as MedItem[],
    activeMedCount: 0,
    reports: [] as ReportItem[],
    weeklyReports: [] as any[],
    stats: {
      followUpCount: 0,
      activeMedCount: 0,
      reportCount: 0,
      weeklyCount: 0,
    },
    showSubscribeGuide: false,
  },

  _subscribeDismissed: false,

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    if (!isLoggedIn()) return;
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    await Promise.all([
      this.loadRecentOrders(),
      this.loadWeeklyReports(),
    ]);
    const hasPendingFollowUp = this.data.followUps.some((f) => f.daysLeft >= 0);
    const hasActiveMed = this.data.activeMedCount > 0;
    this.setData({
      loading: false,
      showSubscribeGuide: (hasPendingFollowUp || hasActiveMed) && !this._subscribeDismissed,
    });
  },

  async loadRecentOrders() {
    try {
      const res: any = await get('/orders', {
        status: 'completed,pending_review',
        pageSize: 50,
        page: 1,
      });
      const orders: any[] = res?.items || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const followUps: FollowUp[] = [];
      const medications: MedItem[] = [];
      const reports: ReportItem[] = [];

      for (const order of orders) {
        const comp = order.completionData || {};
        const patientName = order.serviceTarget?.name || order.patientName || '';
        const hospital = order.hospital || '';

        if (comp.summary) {
          reports.push({
            orderId: order.id,
            summary: comp.summary,
            serviceDate: order.serviceTime ? new Date(order.serviceTime).toLocaleDateString('zh-CN') : '',
            patientName,
            hospital,
          });
        }

        if (comp.followUpDate) {
          const fDate = new Date(comp.followUpDate);
          const diff = Math.ceil((fDate.getTime() - today.getTime()) / 86400000);
          followUps.push({
            orderId: order.id,
            date: comp.followUpDate,
            hospital: comp.followUpHospital || hospital,
            department: comp.followUpDepartment || '',
            note: comp.followUpNote || '',
            patientName,
            daysLeft: diff,
            urgent: diff >= 0 && diff <= 3,
          });
        }

        const meds: any[] = comp.medications || [];
        for (const med of meds) {
          if (!med.name) continue;
          const endDate = med.endDate ? new Date(med.endDate) : null;
          const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : 999;
          medications.push({
            id: med.id || Date.now() + Math.random(),
            name: med.name,
            usage: med.usage || '',
            reminderTime: med.reminderTime || '',
            endDate: med.endDate || '',
            patientName,
            daysLeft,
            active: !endDate || daysLeft >= 0,
          });
        }
      }

      followUps.sort((a, b) => a.daysLeft - b.daysLeft);
      const activeMeds = medications.filter((m) => m.active);

      this.setData({
        followUps,
        nearFollowUp: followUps.find((f) => f.daysLeft >= 0) || null,
        medications: activeMeds.concat(medications.filter((m) => !m.active)).slice(0, 30),
        activeMedCount: activeMeds.length,
        reports: reports.slice(0, 20),
        'stats.followUpCount': followUps.filter((f) => f.daysLeft >= 0).length,
        'stats.activeMedCount': activeMeds.length,
        'stats.reportCount': reports.length,
      });
    } catch (e) {
      console.error('加载诊后数据失败', e);
    }
  },

  async loadWeeklyReports() {
    try {
      const res: any = await get('/ai-consultation/weekly-reports', { pageSize: 10 });
      const items = res?.items || res || [];
      this.setData({
        weeklyReports: items.slice(0, 10),
        'stats.weeklyCount': items.length,
      });
    } catch {
      this.setData({ weeklyReports: [] });
    }
  },

  switchTab(e: any) {
    this.setData({ tabIndex: Number(e.currentTarget.dataset.idx) });
  },

  goOrderDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order/detail/detail?id=${id}` });
  },

  goServiceReport(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order/service-report/service-report?orderId=${id}` });
  },

  goMedicationReminder() {
    wx.navigateTo({ url: '/pages/medication-reminder/medication-reminder' });
  },

  goDrugRisk() {
    wx.navigateTo({ url: '/pages/drug-risk/drug-risk' });
  },

  goWeeklyReport(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/health-weekly/health-weekly?reportId=${id}` });
  },

  async subscribeFollowUp() {
    await requestSubscribe(['followUpReminder', 'orderServiceReminder']);
    wx.showToast({ title: '已订阅复诊提醒', icon: 'success' });
  },

  async onSubscribeGuide() {
    const aliases: Parameters<typeof requestSubscribe>[0] = [];
    if (this.data.stats.followUpCount > 0) {
      aliases.push('followUpReminder', 'orderServiceReminder');
    }
    if (this.data.activeMedCount > 0) {
      aliases.push('medicationReminder');
    }
    if (aliases.length) {
      await requestSubscribe(aliases);
    }
    this._subscribeDismissed = true;
    this.setData({ showSubscribeGuide: false });
    wx.showToast({ title: '已开启提醒', icon: 'success' });
  },

  dismissSubscribeGuide() {
    this._subscribeDismissed = true;
    this.setData({ showSubscribeGuide: false });
  },

  goBack() {
    wx.navigateBack();
  },
});
