import { get, put } from '../../../utils/request';
import { ensureAttendantPageAccess } from '../../../utils/identity';
import {
  attendantOrderRiskBadgeClass,
  attendantOrderRiskLabel,
} from '../../../utils/order-risk';
import { requestSubscribe } from '../../../utils/subscribe';

Page({
  data: {
    orders: [] as any[],
    loading: false,
    refreshing: false,
  },

  onShow() {
    if (!ensureAttendantPageAccess()) return;
    this.loadOrders();
  },

  async loadOrders() {
    this.setData({ loading: true });
    try {
      const res: any = await get('/attendants/grab-orders');
      const orders = (res.items || res || []).map((item: any) => {
        const fee = Number(item.attendantFee ?? item.totalFee ?? item.baseFee ?? 0);
        const riskLabel = attendantOrderRiskLabel(item);
        const riskBadgeClass = attendantOrderRiskBadgeClass(item);
        return {
          ...item,
          riskLabel,
          riskBadgeClass,
          hospitalName: item.hospital || item.hospitalName || '待定',
          departmentName: item.department || item.departmentName || '待定',
          attendantIncome: fee > 0 ? fee.toFixed(2) : null,
          serviceTime: item.serviceTime ? this.formatTime(item.serviceTime, '') : '待定',
          createdAtText: this.formatRelativeTime(item.createdAt),
          patientName: item.serviceTarget?.name || '***',
          patientGender: item.serviceTarget?.gender === 'male' ? '男' : item.serviceTarget?.gender === 'female' ? '女' : '',
          patientAge: item.serviceTarget?.age ? item.serviceTarget.age + '岁' : '',
        };
      });
      this.setData({ orders });
    } catch (e) {
      console.log('加载可抢订单失败', e);
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadOrders();
  },

  goDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.orders.find((order: any) => String(order.id) === String(id));
    if (!item) return;
    wx.showModal({
      title: item.serviceType || '抢单预览',
      content:
        `风险等级：${item.riskLabel || '未标注'}\n` +
        `服务对象：${item.patientName || '***'} ${item.patientGender || ''} ${item.patientAge || ''}\n` +
        `服务时间：${item.serviceTime || '待定'}\n` +
        `医院科室：${item.hospitalName || '待定'} ${item.departmentName || ''}\n` +
        `预计收益：${item.attendantIncome ? `¥${item.attendantIncome}` : '待定'}\n\n` +
        '抢单成功后，才能进入服务详情与时间线页面。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  async handleGrab(e: any) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise<any>((resolve) => {
      wx.showModal({
        title: '确认抢单',
        content: '确定要抢这个订单吗？',
        success: resolve,
      });
    });
    if (!res.confirm) return;

    wx.showLoading({ title: '抢单中...' });
    try {
      await put(`/orders/${id}/grab`);
      wx.hideLoading();
      wx.showToast({ title: '抢单成功', icon: 'success' });
      requestSubscribe(['attendantServiceReminder']).catch(() => {});
      this.loadOrders();
    } catch (e) {
      wx.hideLoading();
      const message = (e as Error)?.message || '抢单失败，请重试';
      wx.showToast({ title: message, icon: 'none' });
      this.loadOrders();
    }
  },

  viewHealthProfile(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/health-card/health-card?orderId=${id}&from=attendant` });
  },

  formatTime(start: string, end: string): string {
    if (!start) return '待定';
    const s = new Date(start);
    const pad = (n: number) => String(n).padStart(2, '0');
    let text = `${s.getMonth() + 1}月${s.getDate()}日 ${pad(s.getHours())}:${pad(s.getMinutes())}`;
    if (end) {
      const e = new Date(end);
      text += ` - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
    }
    return text;
  },

  formatRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  },
});
