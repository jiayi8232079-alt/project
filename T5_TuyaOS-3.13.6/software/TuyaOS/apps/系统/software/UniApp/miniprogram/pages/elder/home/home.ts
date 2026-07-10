import { get, post } from '../../../utils/request';
import { getUserInfo, isLoggedIn, removeToken, setUserInfo } from '../../../utils/auth';
import { getMiniProgramFeaturesCached, loadMiniProgramFeatures } from '../../../utils/miniProgramFeatures';

interface Medication {
  id: number;
  name: string;
  dosage?: string;
  times?: string[];
  status?: string;
}

Page({
  data: {
    loading: true,
    showAiAdvisorCard: true,
    statusBarHeight: 20,
    today: '',
    userName: '',

    family: null as any,
    guardian: null as any,
    serviceTarget: null as any,
    butler: null as any,

    todayMedications: [] as Medication[],
    latestWeeklyReport: null as any,

    activeModal: '' as '' | 'weekly' | 'medication' | 'butler',

    weeklyLoading: false,
    weeklyContent: '',

    medCheckingId: 0,
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const mp = getMiniProgramFeaturesCached();
    this.setData({
      statusBarHeight: sys.statusBarHeight || 20,
      showAiAdvisorCard: mp.showAiAdvisor,
    });
    this.refreshToday();
  },

  onShow() {
    void loadMiniProgramFeatures().then((f) => {
      this.setData({ showAiAdvisorCard: f.showAiAdvisor });
    });
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const info = getUserInfo();
    // 非老人身份 → 切回普通页面
    if (info && info.isElder === false) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    this.setData({ userName: info?.nickname || '长辈' });
    this.loadOverview();
  },

  refreshToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const wkArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    this.setData({ today: `${y}年${m}月${day}日 · ${wkArr[d.getDay()]}` });
  },

  async loadOverview() {
    this.setData({ loading: true });
    try {
      const res: any = await get('/family/elder/overview');
      this.setData({
        family: res?.family || null,
        guardian: res?.guardian || null,
        serviceTarget: res?.serviceTarget || null,
        butler: res?.butler || null,
        todayMedications: Array.isArray(res?.todayMedications) ? res.todayMedications : [],
      });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // ═══ 四大卡片 ═══

  async openWeekly() {
    this.setData({ activeModal: 'weekly', weeklyLoading: true, weeklyContent: '' });
    try {
      const res: any = await get('/ai-consultation/weekly-reports', { page: 1, pageSize: 1 });
      const item = (res?.items || [])[0];
      this.setData({
        latestWeeklyReport: item || null,
        weeklyContent: item?.content || item?.summary || '暂无健康周报',
      });
    } catch {
      this.setData({ weeklyContent: '暂无健康周报' });
    } finally {
      this.setData({ weeklyLoading: false });
    }
  },

  openMedication() {
    this.setData({ activeModal: 'medication' });
  },

  openAiConsult() {
    if (!this.data.showAiAdvisorCard) {
      wx.showToast({ title: '该功能已关闭', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/ai-consult/ai-consult' });
  },

  openButler() {
    this.setData({ activeModal: 'butler' });
  },

  closeModal() {
    this.setData({ activeModal: '' });
  },

  // ═══ 专属管家动作 ═══

  callButler() {
    const phone = this.data.butler?.phone;
    if (!phone) {
      wx.showToast({ title: '暂无电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  // ═══ 用药打卡 ═══

  async checkInMedication(e: any) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id || this.data.medCheckingId) return;
    this.setData({ medCheckingId: id });

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    try {
      await post('/medication-executions/check-in', {
        reminderId: id,
        scheduledDate: `${y}-${m}-${d}`,
        scheduledTime: `${hh}:${mm}`,
        status: 'taken',
      });
      wx.showToast({ title: '已打卡', icon: 'success' });
    } catch (err: any) {
      wx.showToast({ title: err?.message || '打卡失败', icon: 'none' });
    } finally {
      this.setData({ medCheckingId: 0 });
    }
  },

  // ═══ 底部操作 ═══

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后可重新登录或切换账号',
      confirmText: '退出',
      confirmColor: '#E57373',
      success: (res) => {
        if (res.confirm) {
          removeToken();
          setUserInfo(null);
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },

  switchAccount() {
    wx.showModal({
      title: '切换账号',
      content: '将清除当前登录，前往登录页重新登录',
      confirmText: '切换',
      success: (res) => {
        if (res.confirm) {
          removeToken();
          setUserInfo(null);
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
