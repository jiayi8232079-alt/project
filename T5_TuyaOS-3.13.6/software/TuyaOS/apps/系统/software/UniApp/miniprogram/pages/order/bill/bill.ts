import { get } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';
import { resolvePublicUrl } from '../../../utils/media-url';

const SETTLEMENT_STATUS_MAP: Record<string, string> = {
  pending: '待结算',
  settled: '已结算',
};

const PAYMENT_STATUS_MAP: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunded: '已退款',
};

Page({
  data: {
    pageNeedsLogin: false,
    orderId: '',
    order: {} as any,
    billItems: [] as { label: string; amount: string }[],
    totalAmount: '0.00',
    receipts: [] as string[],
    loadError: '',
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
      this.loadBill();
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadBill() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}/bill`);
      const items = res.items || [];
      const total = items.reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
      this.setData({
        order: {
          ...(res.order || {}),
          settlementStatusText: SETTLEMENT_STATUS_MAP[res.order?.settlementStatus || ''] || '待结算',
          paymentStatusText: PAYMENT_STATUS_MAP[res.order?.paymentStatus || ''] || '未付款',
        },
        billItems: items,
        totalAmount: total.toFixed(2),
        receipts: (res.receipts || []).map((u: string) => resolvePublicUrl(u)),
        loadError: '',
      });
    } catch (e) {
      console.error('加载账单失败', e);
      this.setData({
        order: {},
        billItems: [],
        totalAmount: '0.00',
        receipts: [],
        loadError: '账单加载失败，请稍后重试',
      });
      wx.showToast({ title: '加载账单失败', icon: 'none' });
    }
  },

  onPreviewReceipt(e: any) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.receipts,
    });
  },
});
