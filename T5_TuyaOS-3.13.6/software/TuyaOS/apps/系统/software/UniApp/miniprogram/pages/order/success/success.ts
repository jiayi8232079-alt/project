import { getStoreInfo, callStore } from '../../../utils/storeInfo';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';
import { requestSubscribe } from '../../../utils/subscribe';

Page({
  data: {
    pageNeedsLogin: false,
    orderId: '',
    bookingId: '',
    serviceName: '',
    serviceTag: '到店服务',
    appointmentDate: '',
    appointmentTime: '',
    storeName: '陪了个伴',
    storeAddress: '',
    storePhone: '',
  },

  onLoad(options: any) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
    }
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    if (this.data.orderId) {
      this.loadOrderInfo();
    }
    requestSubscribe([
      'orderStatusNotify',
      'orderServiceReminder',
      'orderSignReminder',
    ]);
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadOrderInfo() {
    try {
      const { get } = require('../../../utils/request');
      const [res, storeInfo]: any[] = await Promise.all([
        get(`/orders/${this.data.orderId}`),
        getStoreInfo(),
      ]);
      const st = res.serviceTime ? new Date(res.serviceTime) : null;
      this.setData({
        bookingId: res.orderNumber || res.orderNo || '',
        serviceName: res.serviceType || '陪诊服务',
        appointmentDate: st ? st.toLocaleDateString('zh-CN') : '',
        appointmentTime: st ? `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}` : '',
        storeName: res.hospital || storeInfo.name || '陪了个伴',
        storeAddress: res.serviceAddress || res.address || storeInfo.address || '',
        storePhone: storeInfo.phone || '',
      });
    } catch (e) {
      console.error('加载订单信息失败', e);
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onSaveVoucher() {
    wx.showToast({ title: '凭证已保存', icon: 'success' });
  },

  async onViewMap() {
    const info = await getStoreInfo();
    const lat = parseFloat(info.latitude) || 0;
    const lng = parseFloat(info.longitude) || 0;
    wx.openLocation({
      latitude: lat,
      longitude: lng,
      name: this.data.storeName || info.name || '陪了个伴',
      address: this.data.storeAddress || info.address || '',
      scale: 18,
    });
  },

  onCallStore() {
    callStore();
  },
});
