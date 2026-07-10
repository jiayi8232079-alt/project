import { get, put } from '../../utils/request';
import { isLoggedIn, getUserInfo, redirectByIdentity } from '../../utils/auth';
import {
  ensureWechatIdentity,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../utils/identity';
import { showStoreActions } from '../../utils/storeInfo';
import { goToCustomerService, preloadCustomerServiceConfig } from '../../utils/customerService';

function formatServiceTime(v: string | Date | null | undefined): string {
  if (!v) return '待定';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_MAP: Record<string, string> = {
  pending_dispatch: '待安排',
  pending_accept: '待确认',
  pending_grab: '待抢单',
  pending_sign: '陪诊员已接单',
  pending_service: '待服务',
  in_progress: '进行中',
  emergency: '紧急处置中',
  pending_review: '服务已结束',
  completed: '已完成',
  canceled: '已取消',
};

const SERVICE_INTEREST_MAP: Record<string, string> = {
  checkup: '体检规划',
  expert: '专家匹配',
  escort: '陪诊服务',
  consult: '门诊咨询',
  store: '到店预约',
  fetch: '代取报告',
};

const ORDER_SERVICE_TYPE_MAP: Record<string, string> = {
  escort: 'escort',
  checkup: 'checkup',
  expert: 'expert',
  consult: 'consult',
  store: 'store',
  fetch: 'fetch',
  '陪诊服务': 'escort',
  '体检规划': 'checkup',
  '专家匹配': 'expert',
  '门诊咨询': 'consult',
  '到店预约': 'store',
  '代取报告': 'fetch',
};

const CONSULT_STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  unconsulted: '待咨询',
  consulted: '已咨询',
  order_accepted: '已转为订单',
  cancelled: '已取消',
};

const CONSULT_FETCH_PAGE_SIZE = 200;
const CONSULT_FETCH_MAX_PAGES = 3;

function mapConsultationToCard(c: any) {
  const isCompleted = c.status === 'consulted' || c.status === 'order_accepted';
  const isCanceled = c.status === 'cancelled';
  return {
    id: `c-${c.id}`,
    recordType: 'consultation',
    consultationId: c.id,
    serviceInterestKey: c.serviceInterest || '',
    serviceType: SERVICE_INTEREST_MAP[c.serviceInterest] || c.serviceInterest || '预约咨询',
    status: isCanceled ? 'canceled' : (isCompleted ? 'completed' : 'pending_service'),
    statusText: CONSULT_STATUS_MAP[c.status] || c.status,
    serviceTime: c.appointmentDate && c.appointmentTime
      ? `${c.appointmentDate} ${c.appointmentTime}`
      : c.appointmentDate || '待定',
    hospital: '待确认',
    serviceTargetName: c.name,
    name: c.name,
    phone: c.phone,
  };
}

Page({
  data: {
    statusBarHeight: 20,
    currentTab: 'all',
    orders: [] as any[],
    consultCardsCache: [] as any[],
    loading: false,
    loadError: false,
    noMore: false,
    page: 1,
    pageSize: 10,
    pageNeedsLogin: false,
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    void preloadCustomerServiceConfig();
  },

  async onShow() {
    if (redirectByIdentity()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!isLoggedIn()) {
      this.setData({
        pageNeedsLogin: true,
        orders: [],
        consultCardsCache: [],
        loading: false,
        noMore: true,
        page: 1,
      });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    try {
      await ensureWechatIdentity('user');
    } catch (e) {
      console.log('服务页切回用户身份失败，继续检查缓存', e);
    }
    const activeUser = getUserInfo();
    const isStillAttendantMode = activeUser?.role === 'attendant';
    if (isStillAttendantMode) {
      this.setData({
        orders: [],
        consultCardsCache: [],
        loading: false,
        noMore: true,
        page: 1,
      });
      wx.showToast({ title: '当前仍是陪诊员身份，请先返回“我的”后重试', icon: 'none' });
      return;
    }
    this.resetAndLoad();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  switchTab(e: any) {
    if (this.data.pageNeedsLogin) return;
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    this.setData({ currentTab: tab });
    this.resetAndLoad();
  },

  resetAndLoad() {
    if (this.data.pageNeedsLogin) return;
    this.setData({ orders: [], consultCardsCache: [], page: 1, noMore: false, loadError: false });
    this.loadOrders();
  },

  mergeTabIncludesConsultations() {
    const t = this.data.currentTab;
    return t === 'all' || t === 'pending' || t === 'completed' || t === 'canceled';
  },

  async fetchAllConsultationCardsForTab() {
    const consultParams: any = { pageSize: CONSULT_FETCH_PAGE_SIZE };
    if (this.data.currentTab === 'pending') {
      consultParams.status = 'pending,unconsulted';
    } else if (this.data.currentTab === 'completed') {
      consultParams.status = 'consulted,order_accepted';
    } else if (this.data.currentTab === 'canceled') {
      consultParams.status = 'cancelled';
    }
    const raw: any[] = [];
    let page = 1;
    while (page <= CONSULT_FETCH_MAX_PAGES) {
      let res: any;
      try {
        res = await get('/consultations/me', { ...consultParams, page });
      } catch {
        break;
      }
      const items = res?.items || [];
      raw.push(...items);
      const total = Number(res?.total);
      if (items.length < CONSULT_FETCH_PAGE_SIZE) break;
      if (Number.isFinite(total) && raw.length >= total) break;
      page += 1;
    }
    return raw.map(mapConsultationToCard);
  },

  async loadOrders() {
    if (this.data.loading || this.data.noMore) return;
    this.setData({ loading: true });

    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.currentTab === 'pending') {
        params.status = 'pending_dispatch,pending_accept,pending_grab,pending_sign,pending_service,in_progress,emergency';
      } else if (this.data.currentTab === 'completed') {
        params.status = 'completed,pending_review';
      } else if (this.data.currentTab === 'canceled') {
        params.status = 'canceled';
      } else if (this.data.currentTab !== 'all') {
        params.status = this.data.currentTab;
      }

      const ordersRes: any = await get('/orders', params);
      const ordersItems = (ordersRes?.items || []).map((item: any) => ({
        ...item,
        recordType: 'order',
        statusText: STATUS_MAP[item.status] || item.status,
        serviceTime: formatServiceTime(item.serviceTime),
      }));

      let consultCards: any[] = [];
      const mergeConsult = this.mergeTabIncludesConsultations();
      if (mergeConsult) {
        if (this.data.page === 1) {
          consultCards = await this.fetchAllConsultationCardsForTab();
        } else {
          consultCards = this.data.consultCardsCache;
        }
      }

      const prevOrderCards =
        this.data.page === 1 ? [] : this.data.orders.filter((o: any) => o.recordType === 'order');
      const orderCards = [...prevOrderCards, ...ordersItems];
      const displayList = mergeConsult
        ? [...orderCards, ...consultCards].sort((a, b) => {
            const dateA = a.serviceTime || a.createdAt || '';
            const dateB = b.serviceTime || b.createdAt || '';
            return String(dateB).localeCompare(String(dateA));
          })
        : orderCards;

      this.setData({
        orders: displayList,
        consultCardsCache: mergeConsult && this.data.page === 1 ? consultCards : this.data.consultCardsCache,
        page: this.data.page + 1,
        noMore: ordersItems.length < this.data.pageSize,
      });
    } catch (e) {
      console.error('加载订单失败', e);
      if (this.data.page === 1) {
        this.setData({ loadError: true });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  loadMore() {
    this.loadOrders();
  },

  goDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.orders.find((o: any) => String(o.id) === String(id));
    if (!item) return;
    if (item.recordType === 'consultation') {
      const detail = `预约人：${item.name || '—'}\n电话：${item.phone || '—'}\n时间：${item.serviceTime || '—'}\n状态：${item.statusText || '—'}`;
      wx.showModal({
        title: item.serviceType || '预约咨询',
        content: `${detail}\n\n改期或取消请联系客服；也可自助发起新的预约。`,
        confirmText: '联系客服',
        cancelText: '再次预约',
        success: (res) => {
          if (res.confirm) goToCustomerService();
          if (res.cancel) {
            const src = (item.serviceInterestKey && String(item.serviceInterestKey)) || 'consult';
            wx.navigateTo({ url: `/pages/consult-booking/consult-booking?source=${encodeURIComponent(src)}` });
          }
        },
      });
      return;
    }
    wx.navigateTo({ url: `/pages/order/detail/detail?id=${item.id}` });
  },

  goHistory() {
    this.setData({ currentTab: 'completed' });
    this.resetAndLoad();
  },

  _cancelingId: '' as string,

  onCancelOrder(e: any) {
    const id = String(e.currentTarget.dataset.id);
    // showModal 是异步弹窗，必须在「调用 showModal 之前」就锁住该订单 id，
    // 否则用户在 modal 弹出动画期间快速连点同一行「取消」会重复进入 onCancelOrder。
    if (this._cancelingId === id) return;
    if (this._cancelingId) {
      // 如果其他订单的取消流程还卡在 modal 里，礼貌提示一下而不是吞掉点击。
      wx.showToast({ title: '请先完成上一笔取消操作', icon: 'none' });
      return;
    }
    this._cancelingId = id;
    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      confirmColor: '#e53935',
      success: async (res) => {
        if (!res.confirm) {
          this._cancelingId = '';
          return;
        }
        try {
          wx.showLoading({ title: '取消中...' });
          await put(`/orders/${id}/cancel`, { cancelReason: '用户主动取消' });
          wx.hideLoading();
          wx.showToast({ title: '取消成功', icon: 'success' });
          this.resetAndLoad();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '取消失败，请重试', icon: 'none' });
        } finally {
          this._cancelingId = '';
        }
      },
      fail: () => {
        this._cancelingId = '';
      },
    });
  },

  onContactStore() {
    showStoreActions();
  },

  onContactForConsultation() {
    goToCustomerService();
  },

  onRebook(e: any) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.orders.find((order: any) => String(order.id) === String(id));
    const type = ORDER_SERVICE_TYPE_MAP[item?.serviceType || ''] || 'escort';
    wx.navigateTo({ url: `/pages/order/create/create?type=${encodeURIComponent(type)}` });
  },

  onGoReview(e: any) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) return;
    const item = this.data.orders.find((o: any) => String(o.id) === id);
    const mode = item?.reviewed ? 'view' : 'edit';
    wx.navigateTo({
      url: `/pages/order/review/review?orderId=${id}&mode=${mode}`,
    });
  },

  /** 评价页提交成功后回调，刷新当前列表 */
  onReviewSubmitted() {
    this.resetAndLoad();
  },
});
