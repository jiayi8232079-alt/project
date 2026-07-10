import { get } from '../../utils/request';
import { getUserInfo, isLoggedIn, setUserInfo } from '../../utils/auth';
import { goToCustomerService, preloadCustomerServiceConfig } from '../../utils/customerService';
import { ensureUserPageAccess } from '../../utils/identity';

Page({
  data: {
    statusBarHeight: 20,
    isAnnualMember: false,
  },

  async onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const cached = getUserInfo();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      isAnnualMember: cached?.isAnnualMember === true,
    });
    void preloadCustomerServiceConfig();
    if (isLoggedIn() && !(await ensureUserPageAccess())) return;
    void this.loadMembershipStatus();
  },

  async onShow() {
    if (isLoggedIn() && !(await ensureUserPageAccess())) return;
    void this.loadMembershipStatus();
  },

  async loadMembershipStatus() {
    if (!isLoggedIn()) {
      this.setData({ isAnnualMember: false });
      return;
    }
    try {
      const res: any = await get('/membership/me');
      const isAnnualMember = res?.isAnnualMember === true;
      const cached = getUserInfo();
      if (cached) {
        setUserInfo({ ...cached, isAnnualMember });
      }
      this.setData({ isAnnualMember });
    } catch (e) {
      console.log('加载会员状态失败，保留当前页面状态', e);
    }
  },

  goBack() {
    wx.navigateBack();
  },

  onContactService() {
    goToCustomerService();
  },
});
