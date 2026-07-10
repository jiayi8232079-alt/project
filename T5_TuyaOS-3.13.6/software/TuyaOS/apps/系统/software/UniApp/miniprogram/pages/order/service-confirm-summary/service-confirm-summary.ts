import { get } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const PAYMENT_STATUS_MAP: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunded: '已退款',
};

const SETTLEMENT_STATUS_MAP: Record<string, string> = {
  pending: '待结算',
  settled: '已结算',
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  qr_transfer: '扫码转账',
  bank_transfer: '银行转账',
  cash: '现金',
  other: '其他',
};

type SummaryRow = { label: string; value: string };
type FeeLine = { label: string; amount: string; note?: string };

function sanitizeDisplayField(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
}

function dash(v: string): string {
  return v || '—';
}

function formatServiceTime(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatGender(g: unknown): string {
  const raw = sanitizeDisplayField(g);
  if (!raw) return '';
  const s = raw.toLowerCase();
  if (s === 'male' || s === 'm') return '男';
  if (s === 'female' || s === 'f') return '女';
  if (raw === '男' || raw === '女') return raw;
  return raw;
}

function maskIdCard(v: unknown): string {
  const s = sanitizeDisplayField(v);
  if (!s) return '';
  if (s.length <= 8) return `${s[0] || '*'}****`;
  return `${s.slice(0, 4)}********${s.slice(-4)}`;
}

function maskPhone(v: unknown): string {
  const digits = sanitizeDisplayField(v).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

Page({
  data: {
    pageNeedsLogin: false,
    statusBarHeight: 20,
    orderId: '',
    loading: true,
    loadError: '',
    recipientRows: [] as SummaryRow[],
    serviceRows: [] as SummaryRow[],
    feeLines: [] as FeeLine[],
    feeTotal: '',
    feeFootRows: [] as SummaryRow[],
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    const orderId = String(options.orderId || options.id || '');
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      orderId,
    });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    const orderId = this.data.orderId;
    if (orderId) await this.loadOrder();
    else {
      this.setData({ loading: false, loadError: '缺少订单信息' });
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadOrder() {
    this.setData({ loading: true, loadError: '' });
    try {
      const id = this.data.orderId;
      const res: any = await get(`/orders/${id}`);
      let billRes: any = null;
      try {
        billRes = await get(`/orders/${id}/bill`);
      } catch {
        billRes = null;
      }

      const st = res.serviceTarget || {};
      const hpRaw = st.healthProfile;
      const hp =
        hpRaw && typeof hpRaw === 'object' && !Array.isArray(hpRaw)
          ? (hpRaw as Record<string, unknown>)
          : {};
      const addrFromHp = sanitizeDisplayField(hp.address || hp.residence);
      const address = sanitizeDisplayField(res.serviceAddress) || addrFromHp;
      const emergencyRelation = sanitizeDisplayField(hp.emergencyRelation || hp.relation);
      const callbackPhone = sanitizeDisplayField(res.callbackContactPhone);

      const ageStr =
        st.age != null && st.age !== '' ? `${st.age}` : '';

      const recipientRows: SummaryRow[] = [
        { label: '姓名', value: dash(sanitizeDisplayField(st.name)) },
        { label: '性别', value: dash(formatGender(st.gender)) },
        { label: '年龄', value: dash(ageStr) },
        { label: '证件号', value: dash(maskIdCard(st.idCard)) },
        {
          label: '联系电话',
          value: dash(maskPhone(st.phone || res.user?.phone)),
        },
        { label: '常住/服务地址', value: dash(address) },
        { label: '紧急联系人', value: dash(sanitizeDisplayField(st.emergencyContact)) },
        { label: '与就诊人关系', value: dash(emergencyRelation) },
        {
          label: '紧急联系电话',
          value: dash(maskPhone(st.emergencyPhone)),
        },
      ];
      if (callbackPhone) {
        recipientRows.push({ label: '客服回电号码', value: callbackPhone });
      }

      const hospital =
        sanitizeDisplayField(res.hospital) ||
        sanitizeDisplayField(res.hospitalDirectory?.name);
      const department = sanitizeDisplayField(res.department);
      const serviceTime =
        formatServiceTime(res.serviceTime) || sanitizeDisplayField(res.serviceTime);
      const serviceType = sanitizeDisplayField(res.serviceType) || '陪诊服务';
      const orderNo = String(res.orderNumber || res.orderNo || '').trim();
      const feeType = sanitizeDisplayField(res.attendantFeeType);
      const mainAppeal = sanitizeDisplayField(st.mainAppeal);
      const remark = sanitizeDisplayField(res.remark ?? res.notes);

      const att = res.attendant;
      let attendantLine = '待分配';
      if (res.needAttendant === false) {
        attendantLine = '不需要陪诊员';
      } else if (att && typeof att === 'object') {
        attendantLine =
          sanitizeDisplayField((att as any).name || (att as any).realName) || '—';
      }

      const signerName = sanitizeDisplayField(res.serviceConfirmSignerName);
      const signerRelation = sanitizeDisplayField(res.serviceConfirmSignerRelation);
      const isProxySign = !!signerRelation && signerRelation !== '本人';
      let signModeText = '';
      if (signerName || signerRelation) {
        signModeText = isProxySign
          ? `代签（${signerRelation || '非本人'}：${signerName || '—'}）`
          : `本人签署${signerName ? '（' + signerName + '）' : ''}`;
      }

      const serviceRows: SummaryRow[] = [
        { label: '订单编号', value: dash(orderNo) },
        { label: '服务类型', value: dash(serviceType) },
        { label: '服务费用类型', value: dash(feeType) },
        { label: '就诊时间', value: dash(serviceTime) },
        { label: '就诊医院', value: dash(hospital) },
        { label: '就诊科室', value: dash(department) },
        { label: '陪诊员', value: attendantLine },
        { label: '就医/陪诊诉求', value: dash(mainAppeal) },
        { label: '订单备注', value: dash(remark) },
        ...(signModeText ? [{ label: '签署方式', value: signModeText }] : []),
      ];

      let feeLines: FeeLine[] = [];
      let feeTotal = '';
      if (billRes && Array.isArray(billRes.items) && billRes.items.length > 0) {
        feeLines = billRes.items.map((i: any) => ({
          label: sanitizeDisplayField(i.label) || '项目',
          amount: String(i.amount ?? '0'),
          note: i.note ? sanitizeDisplayField(i.note) : '',
        }));
        feeTotal = String(billRes.totalAmount || '0.00');
      } else {
        const tf = Number(res.totalFee);
        const bf = Number(res.baseFee);
        const n = !Number.isNaN(tf) && tf > 0 ? tf : !Number.isNaN(bf) && bf > 0 ? bf : 0;
        if (n > 0) {
          feeLines = [{ label: '服务费', amount: n.toFixed(2) }];
          feeTotal = n.toFixed(2);
        } else {
          feeLines = [];
          feeTotal = '';
        }
      }

      const paymentText =
        PAYMENT_STATUS_MAP[String(res.paymentStatus || billRes?.order?.paymentStatus || '').trim()] ||
        '—';
      const settlementText =
        SETTLEMENT_STATUS_MAP[
          String(res.settlementStatus || billRes?.order?.settlementStatus || '').trim()
        ] || '待结算';
      const pmRaw = String(
        res.paymentMethod || billRes?.order?.paymentMethod || '',
      ).trim();
      const paymentMethodText = pmRaw ? PAYMENT_METHOD_MAP[pmRaw] || pmRaw : '—';

      const feeFootRows: SummaryRow[] = [
        { label: '结算状态', value: settlementText },
        { label: '付款状态', value: paymentText },
        { label: '付款方式', value: paymentMethodText },
      ];

      this.setData({
        recipientRows,
        serviceRows,
        feeLines,
        feeTotal,
        feeFootRows,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({
        loading: false,
        loadError: '加载失败，请返回重试',
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
