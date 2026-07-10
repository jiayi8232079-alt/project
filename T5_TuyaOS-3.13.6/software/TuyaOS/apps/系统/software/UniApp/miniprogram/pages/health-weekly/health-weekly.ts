import { get, post } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { navigateBackOrHome, navigateToUserLogin } from '../../utils/identity';

Page({
  data: {
    reportId: 0,
    report: null as any,
    ai: {} as any,
    reports: [] as any[],
    loading: false,
    pageNeedsLogin: false,
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ reportId: Number(options.id) });
    }
  },

  onShow() {
    if (!isLoggedIn()) {
      this.setData({
        pageNeedsLogin: true,
        report: null,
        ai: {},
        reports: [],
        loading: false,
      });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (this.data.reportId) {
      this.loadReport(this.data.reportId);
    } else {
      this.loadReportList();
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadReport(id: number) {
    try {
      const res: any = await get(`/ai-consultation/weekly-reports/${id}`);
      this.setData({ report: res, ai: res.aiAnalysis || {} });
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadReportList() {
    this.setData({ loading: true });
    try {
      const res: any = await get('/ai-consultation/weekly-reports', { page: 1, pageSize: 20 });
      this.setData({ reports: res.items || [] });
    } catch { /* ignore */ }
    finally { this.setData({ loading: false }); }
  },

  viewReport(e: any) {
    const id = e.currentTarget.dataset.id;
    this.setData({ reportId: id });
    this.loadReport(id);
  },

  async generateReport() {
    wx.showLoading({ title: '生成中...' });
    try {
      const res: any = await post('/ai-consultation/weekly-reports/generate', {});
      wx.hideLoading();
      wx.showToast({ title: '生成成功', icon: 'success' });
      this.setData({ reportId: res.id });
      this.loadReport(res.id);
    } catch (e: any) {
      wx.hideLoading();
      wx.showToast({ title: e?.message || '生成失败', icon: 'none' });
    }
  },
});
