import { get } from '../../utils/request';
import { isLoggedIn, getUserInfo, redirectByIdentity } from '../../utils/auth';
import { ensureWechatIdentity, hasAttendantProfile } from '../../utils/identity';

/**
 * 首页服务与后台订单服务类型对应关系：
 * | 首页服务   | type    | 后台创建订单时可选服务类型                     |
 * |------------|---------|----------------------------------------------|
 * | 体检规划   | checkup | 体检预约                                      |
 * | 专家匹配   | expert  | VIP医疗资源协调                               |
 * | 陪诊服务   | escort  | 门诊陪诊、检查陪同、出入院办理                 |
 * | 门诊咨询   | consult | 门诊咨询（到店后面谈）                         |
 * | 到店预约   | store   | 到店预约（用户先到店，后台补全信息创建订单）   |
 * | 代取报告   | fetch   | 代取报告/药                                   |
 */
const QUICK_SERVICES = [
  { type: 'checkup', name: '体检规划', desc: '个性化方案定制', icon_sym: 'health_metrics' },
  { type: 'expert', name: '专家匹配', desc: '三甲名医预约', icon_sym: 'diversity_1' },
  { type: 'escort', name: '陪诊服务', desc: '全程专业陪同', icon_sym: 'blind' },
  { type: 'consult', name: '门诊咨询', desc: '快速解答疑惑', icon_sym: 'chat_bubble' },
  { type: 'store', name: '到店预约', desc: '到店后办理', icon_sym: 'storefront' },
  { type: 'fetch', name: '代取报告', desc: '代取报告/药品', icon_sym: 'local_shipping' },
];

Page({
  data: {
    pageLoaded: false,
    activeOrder: null as any,
    pendingCount: 0,
    isAttendant: false,
    userInfo: null as any,
    quickServices: QUICK_SERVICES,
    statusBarHeight: 20,
    medicationReminders: [] as any[],
  },

  onLoad() {
    wx.getSystemInfo({
      success: (res) => {
        this.setData({ statusBarHeight: res.statusBarHeight });
      },
    });
    wx.nextTick(() => {
      this.setData({ pageLoaded: true });
    });
  },

  async onShow() {
    // 老人身份（大字体单屏端）→ 不允许停留在标签页，强制 reLaunch
    if (redirectByIdentity()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    if (isLoggedIn()) {
      try {
        await ensureWechatIdentity('user');
      } catch (e) {
        console.log('首页切回用户身份失败，继续使用当前缓存', e);
      }
      const userInfo = getUserInfo();
      this.setData({
        isAttendant: hasAttendantProfile(userInfo),
        userInfo,
      });
      this.loadActiveOrder();
      this.loadPendingCount();
      this.loadMedicationReminders();
    } else {
      this.setData({
        activeOrder: null,
        pendingCount: 0,
        isAttendant: false,
        userInfo: null,
        medicationReminders: [],
      });
    }
  },

  async loadActiveOrder() {
    try {
      const res: any = await get('/orders', {
        status: 'in_progress',
        pageSize: 1,
        page: 1,
      });
      if (res.items && res.items.length > 0) {
        const order = res.items[0];
        this.setData({
          activeOrder: {
            id: order.id,
            statusText: this.getStatusText(order.status),
            serviceType: order.serviceType,
            hospital: order.hospital,
            department: order.department,
            serviceTime: order.serviceTime,
          },
        });
      } else {
        this.setData({ activeOrder: null });
      }
    } catch (e) {
      console.log('加载进行中订单失败', e);
    }
  },

  async loadPendingCount() {
    try {
      const res: any = await get('/orders', {
        // 不含 pending_grab：待抢单为陪诊池状态，用户侧待办以「待安排/待确认/待签到/待服务」为准
        status: 'pending_dispatch,pending_accept,pending_sign,pending_service',
        pageSize: 1,
        page: 1,
      });
      if (res.total !== undefined) {
        this.setData({ pendingCount: res.total });
      }
    } catch (e) {
      console.log('加载待服务数量失败', e);
    }
  },

  async loadMedicationReminders() {
    try {
      // 此前拆 medication / follow_up 各发一次共两条并发，合并为单次拉取后本地分类，
      // 减少 wx.request 并发数（首页冷启总并发本就紧张）。
      const res: any = await get('/medication-reminders/my');
      const list = Array.isArray(res) ? res : [];
      const reminders = list
        .filter((it: any) => {
          const t = it?.reminderType || it?.type;
          return t === 'medication' || t === 'follow_up' || !t;
        })
        .sort((a: any, b: any) => {
          const aTime = new Date(a.startDate || a.createdAt || 0).getTime();
          const bTime = new Date(b.startDate || b.createdAt || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 3);
      this.setData({ medicationReminders: reminders });
    } catch (e) {
      console.log('加载用药提醒失败', e);
    }
  },

  goReminders() {
    wx.navigateTo({ url: '/pages/medication-reminder/medication-reminder' });
  },

  goReminderDetail() {
    wx.navigateTo({ url: '/pages/medication-reminder/medication-reminder' });
  },

  getStatusText(status: string): string {
    const map: Record<string, string> = {
      pending_dispatch: '待安排',
      pending_accept: '待确认',
      pending_sign: '待签到',
      pending_service: '待服务',
      in_progress: '进行中',
      pending_review: '服务已结束',
      completed: '已完成',
      canceled: '已取消',
    };
    return map[status] || status;
  },

  goService(e: any) {
    const type = e.currentTarget.dataset.type;
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const detailPages: Record<string, string> = {
      checkup: '/pages/checkup/checkup',
      expert: '/pages/expert/expert',
      escort: '/pages/escort/escort',
      consult: '/pages/consult/consult',
    };
    if (detailPages[type]) {
      wx.navigateTo({ url: detailPages[type] });
      return;
    }
    if (type === 'store' || type === 'fetch') {
      wx.navigateTo({ url: `/pages/consult-booking/consult-booking?source=${type}` });
      return;
    }
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onHeroBtnTap() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/consult-booking/consult-booking?source=consult' });
  },

  goServicePage() {
    wx.switchTab({ url: '/pages/service/service' });
  },

  goCurrentOrder() {
    if (this.data.activeOrder) {
      wx.navigateTo({
        url: `/pages/order/detail/detail?id=${this.data.activeOrder.id}`,
      });
    } else {
      wx.switchTab({ url: '/pages/service/service' });
    }
  },

  goOrderDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order/detail/detail?id=${id}` });
  },

  goHealth() {
    wx.switchTab({ url: '/pages/health/health' });
  },

  goSearch() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' });
  },

  goMembership() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/membership/membership' });
  },

  goAiConsult() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/ai-consult/ai-consult' });
  },

  goHospitals() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/hospitals/hospitals' });
  },

  goDoctors() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/doctors/doctors' });
  },

  goProServices() {
    wx.navigateTo({ url: '/pages/pro-services/pro-services' });
  },
});
