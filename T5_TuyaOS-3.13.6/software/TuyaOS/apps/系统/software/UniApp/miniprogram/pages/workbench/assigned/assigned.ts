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
      const res: any = await get('/attendants/assigned-orders');
      const orders = (res.items || res || []).map((item: any) => {
        const fee = Number(item.attendantFee ?? item.totalFee ?? item.baseFee ?? 0);
        const riskLabel = attendantOrderRiskLabel(item);
        const riskBadgeClass = attendantOrderRiskBadgeClass(item);
        return {
          ...item,
          riskLabel,
          riskBadgeClass,
          statusText: '待确认',
          serviceTime: item.serviceTime ? this.formatTime(item.serviceTime, '') : '待定',
          hospital: item.hospital || item.hospitalName || '待确认医院',
          department: item.department || item.departmentName || '待确认科室',
          patientName: item.serviceTarget?.name || '***',
          patientGender: item.serviceTarget?.gender === 'male' ? '男' : item.serviceTarget?.gender === 'female' ? '女' : '',
          patientAge: item.serviceTarget?.age ? item.serviceTarget.age + '岁' : '',
          attendantIncome: fee > 0 ? fee.toFixed(2) : null,
          remark: item.notes || '',
        };
      });
      this.setData({ orders });
    } catch (e) {
      console.log('加载指派任务失败', e);
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadOrders();
  },

  viewHealthProfile(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
        wx.navigateTo({ url: `/pages/health-card/health-card?orderId=${id}&from=attendant` });
  },

  goSign(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/workbench/sign/sign?orderId=${id}` });
  },

  async onAccept(e: any) {
    const id = e.currentTarget.dataset.id;
    try {
      wx.showLoading({ title: '确认中...' });
      await put(`/orders/${id}/accept`);
      wx.hideLoading();
      wx.showToast({ title: '已接受任务', icon: 'success' });
      requestSubscribe(['attendantServiceReminder']).catch(() => {});
      setTimeout(() => {
        wx.navigateTo({ url: `/pages/workbench/service-timeline/service-timeline?orderId=${id}` });
      }, 300);
      this.loadOrders();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  onReject(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '拒绝任务',
      editable: true,
      placeholderText: '请填写拒绝原因',
      success: async (res) => {
        if (!res.confirm) return;
        const reason = (res.content || '').trim();
        if (!reason) {
          wx.showToast({ title: '请填写拒绝原因', icon: 'none' });
          return;
        }
        try {
          wx.showLoading({ title: '提交中...' });
          await put(`/orders/${id}/reject`, { reason });
          wx.hideLoading();
          wx.showToast({ title: '已拒绝任务', icon: 'success' });
          this.loadOrders();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败，请重试', icon: 'none' });
        }
      },
    });
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
});
