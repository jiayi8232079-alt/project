import { isLoggedIn, getUserInfo, setUserInfo, removeToken, redirectByIdentity } from '../../utils/auth';
import { goToCustomerService, preloadCustomerServiceConfig } from '../../utils/customerService';
import { ensureWechatIdentity, hasAttendantProfile, isAdminRole, setLoginMode, switchWechatIdentity } from '../../utils/identity';
import { get } from '../../utils/request';
import { getMiniProgramFeaturesCached, loadMiniProgramFeatures } from '../../utils/miniProgramFeatures';

Page({
  data: {
    statusBarHeight: 20,
    showAiTriage: true,
    showAiAdvisor: true,
    isLoggedIn: false,
    userInfo: null as any,
    avatarChar: '?',
    isAttendant: false,
    isAdmin: false,
    isAnnualMember: false,
    expireDateText: '',
    membershipNo: '',
    orderCount: 0,
    healthCount: 0,
    benefitCount: 0,
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const mp = getMiniProgramFeaturesCached();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      showAiTriage: mp.showAiTriage,
      showAiAdvisor: mp.showAiAdvisor,
    });
    void preloadCustomerServiceConfig();
  },

  async onShow() {
    void loadMiniProgramFeatures().then((f) => {
      this.setData({ showAiTriage: f.showAiTriage, showAiAdvisor: f.showAiAdvisor });
    });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    const loggedIn = isLoggedIn();
    if (loggedIn) {
      try {
        await ensureWechatIdentity('user');
      } catch (e) {
        console.log('切回用户身份失败，继续使用当前缓存', e);
      }
      this.refreshUserAndLoad();
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: null,
        avatarChar: '?',
        isAttendant: false,
        isAnnualMember: false,
        expireDateText: '',
        membershipNo: '',
        orderCount: 0,
        healthCount: 0,
      });
    }
  },

  /** 刷新用户信息并加载页面数据 */
  async refreshUserAndLoad() {
    // 第一步：立刻用本地缓存渲染，避免网络请求期间闪现"用户"
    const cached = getUserInfo();
    const cachedAnnualMember = cached?.isAnnualMember === true;
    if (cached) {
      this.setData({
        isLoggedIn: true,
        userInfo: cached,
        avatarChar: cached?.name?.[0] || cached?.nickname?.[0] || '?',
        isAttendant: hasAttendantProfile(cached),
        isAdmin: isAdminRole(cached),
        isAnnualMember: cachedAnnualMember,
      });
    }

    // 第二步：请求最新 profile，只更新角色等服务端字段，不覆盖本地昵称头像
    let userInfo = cached;
    try {
      const profile: any = await get('/auth/profile');
      if (profile && (profile.role || profile.id)) {
        userInfo = {
          ...userInfo,
          ...profile,
          // 关键：后端昵称/头像为空时保留本地值（用户授权过的）
          nickname: profile.nickname || userInfo?.nickname || '',
          avatarUrl: profile.avatarUrl || userInfo?.avatarUrl || '',
        };
        setUserInfo(userInfo);
      }
    } catch (e) {
      console.log('刷新用户信息失败，使用缓存', e);
    }

    this.setData({
      isLoggedIn: true,
      userInfo,
      avatarChar: userInfo?.name?.[0] || userInfo?.nickname?.[0] || '?',
      isAttendant: hasAttendantProfile(userInfo),
      isAdmin: isAdminRole(userInfo),
      isAnnualMember: userInfo?.isAnnualMember === true,
    });

    // 老人身份 → 直接跳转到大字体单屏端，不再停留在"我的"页
    if (redirectByIdentity()) return;

    this.loadMembership();
    this.loadStats();
  },

  /** 老人快速进入家庭：授权手机号 → 后端自动匹配占位档案 */
  async onBindElderPhone(e: any) {
    const phoneCode = e?.detail?.code;
    if (!phoneCode) {
      wx.showToast({ title: '授权取消', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '匹配中...', mask: true });
    try {
      const { post } = await import('../../utils/request');
      const res: any = await post('/auth/bind-wx-phone', { phoneCode });
      const cached = getUserInfo() || {};
      const next = { ...cached, phone: res?.phone, isElder: !!res?.isElder };
      setUserInfo(next);
      wx.hideLoading();
      if (res?.isElder) {
        wx.showToast({ title: '已进入家庭', icon: 'success' });
        setTimeout(() => redirectByIdentity(), 500);
      } else {
        wx.showToast({
          title: '暂未匹配到家庭，请让子女先创建老人档案',
          icon: 'none',
          duration: 2500,
        });
      }
    } catch (err: any) {
      wx.hideLoading();
      wx.showToast({ title: err?.message || '手机号获取失败', icon: 'none' });
    }
  },

  async loadStats() {
    try {
      const [ordersRes, targetsRes]: any[] = await Promise.all([
        get('/orders', { pageSize: 1, page: 1 }),
        get('/users/me/service-targets'),
      ]);
      this.setData({
        orderCount: ordersRes?.total ?? 0,
        healthCount: Array.isArray(targetsRes) ? targetsRes.length : (targetsRes?.items?.length ?? 0),
      });
    } catch (e) {
      console.log('加载统计失败', e);
    }
  },

  async loadMembership() {
    try {
      const res: any = await get('/membership/me');
      const isAnnualMember = res?.isAnnualMember === true;
      const expireDateText = res?.expireDate ? res.expireDate.slice(0, 10) : '';
      const membershipNo = res?.id ? 'NO. ' + String(res.id).padStart(6, '0') : '';
      // 同步更新本地缓存的会员状态，保证下次进入也是最新的
      const cached = getUserInfo();
      if (cached) {
        setUserInfo({ ...cached, isAnnualMember });
      }
      this.setData({ isAnnualMember, expireDateText, membershipNo });
    } catch (e) {
      // 接口偶发失败时保留当前会员态，避免头像主题在绿/金之间来回跳变
      console.log('加载会员信息失败，保留当前状态', e);
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goMembership() {
    wx.navigateTo({ url: '/pages/membership/membership' });
  },

  goOrders() {
    wx.switchTab({ url: '/pages/service/service' });
  },

  goHealth() {
    wx.switchTab({ url: '/pages/health/health' });
  },

  goMedicationReminder() {
    wx.navigateTo({ url: '/pages/medication-reminder/medication-reminder' });
  },

  goConsultBooking() {
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking' });
  },

  goFamily() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/family/family' });
  },

  goDevices() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/device/index/index' });
  },

  goWithKin() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/family/withkin/withkin' });
  },

  goAiDialog() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/ai/dialog-summary/dialog-summary' });
  },

  goWeeklyReport() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/health-weekly/health-weekly' });
  },

  goAiConsult() {
    if (!this.data.showAiAdvisor) {
      wx.showToast({ title: '该功能已关闭', icon: 'none' });
      return;
    }
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/ai-consult/ai-consult' });
  },

  goTriage() {
    if (!this.data.showAiTriage) {
      wx.showToast({ title: '该功能已关闭', icon: 'none' });
      return;
    }
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/triage/triage' });
  },

  goCustomerService() {
    goToCustomerService();
  },

  goComplaintList() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/complaint/list/list' });
  },

  goAdminDashboard() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    if (!this.data.isAdmin) {
      wx.showToast({ title: '暂无管理员权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
  },

  goWorkbench() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    // 总管理员通过「管理台」统一入口操作所有订单，不再经由此处切换为陪诊员身份
    if (this.data.isAdmin) {
      wx.showToast({ title: '请通过管理台进入', icon: 'none' });
      return;
    }
    if (!this.data.isAttendant) {
      wx.showToast({ title: '暂无陪诊员权限', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '切换中...' });
    switchWechatIdentity('attendant')
      .then(() => {
        wx.hideLoading();
        wx.navigateTo({ url: '/pages/workbench/workbench' });
      })
      .catch((e) => {
        wx.hideLoading();
        console.log('切换陪诊员身份失败', e);
        wx.showToast({ title: '进入工作台失败，请重试', icon: 'none' });
      });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          removeToken();
          wx.removeStorageSync('userInfo');
          setLoginMode('user');
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            avatarChar: '?',
            isAttendant: false,
            isAdmin: false,
            isAnnualMember: false,
            expireDateText: '',
            membershipNo: '',
            orderCount: 0,
            healthCount: 0,
            benefitCount: 0,
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      },
    });
  },
});
