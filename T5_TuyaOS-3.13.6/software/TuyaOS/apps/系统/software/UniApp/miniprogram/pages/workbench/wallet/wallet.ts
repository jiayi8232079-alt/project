import { get } from '../../../utils/request';
import { ensureAttendantPageAccess } from '../../../utils/identity';

Page({
  data: {
    balance: '0.00',
    totalIncome: '0.00',
    pendingIncome: '0.00',
    orderCount: 0,
    transactions: [] as any[],
    expandedTransactionId: '',
  },

  onLoad() {
    if (!ensureAttendantPageAccess()) return;
    this.loadWallet();
  },

  onShow() {
    if (!ensureAttendantPageAccess()) return;
    this.loadWallet();
  },

  async loadWallet() {
    try {
      const res: any = await get('/attendants/me/wallet');
      this.setData({
        balance: res.balance || '0.00',
        totalIncome: res.totalIncome || '0.00',
        pendingIncome: res.pendingIncome || '0.00',
        orderCount: Number(res.orderCount || 0),
        transactions: res.transactions || [],
      });
    } catch (e) {
      console.error('加载钱包信息失败', e);
      wx.showToast({ title: '加载钱包失败', icon: 'none' });
    }
  },

  onWithdraw() {
    wx.showToast({ title: '提现功能开发中', icon: 'none' });
  },

  onToggleTransactionDetail(e: WechatMiniprogram.BaseEvent) {
    const { id } = e.currentTarget.dataset as { id?: string };
    if (!id) return;
    this.setData({
      expandedTransactionId: this.data.expandedTransactionId === id ? '' : id,
    });
  },
});
