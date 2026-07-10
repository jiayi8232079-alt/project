import { get, post, getPublic, postPublic } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';
import { requestSubscribe } from '../../../utils/subscribe';

const PAYMENT_METHOD_MAP: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  qr_transfer: '扫码转账',
  bank_transfer: '银行转账',
  cash: '现金',
  other: '其他',
};

const PAYMENT_STATUS_MAP: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunded: '已退款',
};

const SETTLEMENT_STATUS_MAP: Record<string, string> = {
  pending: '待结算',
  settled: '已结算',
};

function formatSignedAt(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  const h = `${d.getHours()}`.padStart(2, '0');
  const min = `${d.getMinutes()}`.padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function formatServiceTime(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sanitize(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
}

function dash(v: string): string { return v || '—'; }

function formatGender(g: unknown): string {
  const raw = sanitize(g);
  if (!raw) return '';
  const s = raw.toLowerCase();
  if (s === 'male' || s === 'm') return '男';
  if (s === 'female' || s === 'f') return '女';
  return raw;
}

type InfoRow = { label: string; value: string };
type FeeLine = { label: string; amount: string; note?: string };

const SIGNER_OPTIONS = [
  { label: '本人（服务对象）', value: '本人' },
  { label: '子女', value: '子女' },
  { label: '配偶', value: '配偶' },
  { label: '父母', value: '父母' },
  { label: '其他家属', value: '其他家属' },
];

Page({
  _qrScene: '' as string,
  // 缓存订单明细里的 serviceTarget（含 healthProfile），
  // 跳转签署页时作为"查看档案"的摘要数据源，避免签署页卡在"档案信息加载中…"
  _signProfileSnapshot: null as any,

  data: {
    pageNeedsLogin: false,
    isQrMode: false,
    statusBarHeight: 20,
    orderId: '',
    needsSign: false,
    signed: false,
    subjectName: '',
    orderNumber: '',
    signerName: '',
    signerRelation: '',
    isProxySign: false,
    signedAtText: '',
    loading: true,
    applicable: false,
    showSignerPicker: false,
    signerOptions: SIGNER_OPTIONS,
    selectedSignerIndex: -1,
    termsRead: false,
    showTerms: false,
    recipientRows: [] as InfoRow[],
    serviceRows: [] as InfoRow[],
    feeLines: [] as FeeLine[],
    feeTotal: '',
    feeFootRows: [] as InfoRow[],
    orderStatus: '' as string,
    signGateBlocked: false,
    signGateHint: '',
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    const qrScene = options.qrScene || '';
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      orderId: String(options.orderId || options.id || ''),
      isQrMode: !!qrScene,
    });
    this._qrScene = qrScene;
  },

  async onShow() {
    if (this.data.isQrMode) {
      await this.loadStatusByQr(this._qrScene);
      return;
    }
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    if (this.data.orderId) await this.loadStatus();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadStatus() {
    if (!this.data.orderId) return;
    this.setData({ loading: true });
    try {
      const orderId = this.data.orderId;
      const [statusRes, orderRes, billRes]: any[] = await Promise.all([
        get(`/orders/${orderId}/service-confirm/status`),
        get(`/orders/${orderId}`).catch(() => null),
        get(`/orders/${orderId}/bill`).catch(() => null),
      ]);
      this._applyStatus(statusRes);
      if (orderRes) this._applyOrderDetail(orderRes, billRes);
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadStatusByQr(sceneCode: string) {
    this.setData({ loading: true });
    try {
      const res: any = await getPublic(`/public/service-confirm/${sceneCode}/status`);
      this._applyStatus(res);
      if (res.orderDetail) this._applyOrderDetail(res.orderDetail, res.bill || null);
    } catch (e: any) {
      console.error(e);
      this.setData({ loading: false });
      wx.showModal({
        title: '无法访问',
        content: e?.message || '链接已失效或无效，请联系管理员重新发送',
        showCancel: false,
      });
    }
  },

  _applyStatus(res: any) {
    const applicable = !!res.applicable;
    const signedAtRaw = res.signedAt;
    this.setData({
      applicable,
      needsSign: !!res.needsSign,
      signed: !!res.signed,
      subjectName: res.subjectName || '',
      orderNumber: res.orderNumber != null ? String(res.orderNumber) : '',
      signerName: res.signerName || '',
      signerRelation: res.signerRelation || '',
      isProxySign: !!res.isProxySign,
      signedAtText: res.signed ? formatSignedAt(signedAtRaw) : '',
      loading: false,
    });
    if (!applicable) {
      wx.showToast({ title: '当前订单无需确认单', icon: 'none' });
    }
  },

  _applyOrderDetail(res: any, billRes: any) {
    const orderStatus = String(res?.status || '');
    // 仅在"陪诊员未接单"和"订单已结束/已取消"时关闭签署通道。
    // 陪诊员接单后（pending_sign / pending_service / in_progress / emergency）均允许用户补签
    const PRE_ACCEPT_STATUSES = ['pending_dispatch', 'pending_accept', 'pending_grab'];
    const TERMINAL_STATUSES = ['pending_review', 'completed', 'canceled'];
    const blocked =
      !this._qrScene
      && !!orderStatus
      && (PRE_ACCEPT_STATUSES.includes(orderStatus) || TERMINAL_STATUSES.includes(orderStatus));
    let gateHint = '';
    if (blocked) {
      if (PRE_ACCEPT_STATUSES.includes(orderStatus)) {
        gateHint = '陪诊员尚未接单，接单后方可签署';
      } else if (orderStatus === 'canceled') {
        gateHint = '订单已取消';
      } else if (['pending_review', 'completed'].includes(orderStatus)) {
        gateHint = '服务已结束，签署通道已关闭';
      } else {
        gateHint = '当前阶段暂不支持签署';
      }
    }
    this.setData({
      orderStatus,
      signGateBlocked: blocked,
      signGateHint: gateHint,
    });

    const st = res.serviceTarget || {};
    const hp = (st.healthProfile && typeof st.healthProfile === 'object' && !Array.isArray(st.healthProfile))
      ? st.healthProfile : {};
    // 缓存给签署页使用（跳转前通过 eventChannel 下发）
    this._signProfileSnapshot = {
      name: st.name || '',
      gender: st.gender || '',
      age: st.age || '',
      phone: st.phone || res.user?.phone || '',
      homeAddress: st.homeAddress || hp.address || hp.residence || '',
      idCard: st.idCard || '',
      emergencyContact: st.emergencyContact || '',
      emergencyRelation: hp.emergencyRelation || hp.relation || '',
      emergencyPhone: st.emergencyPhone || '',
      fillMethod: hp.fillMethod || 'self',
      mobilityStatus: hp.mobilityStatus || 'independent',
      bloodType: hp.bloodType || '',
      allergyStatus: (hp.allergies && hp.allergies !== '无') ? 'has' : 'none',
      allergies: (hp.allergies && hp.allergies !== '无') ? hp.allergies : '',
      medicalHistoryArr: Array.isArray(hp.medicalHistory) ? hp.medicalHistory : [],
      medicalHistoryOther: hp.medicalHistoryOther || '',
      visionStatus: hp.visionStatus || '',
      hearingStatus: hp.hearingStatus || '',
      recentSymptoms: Array.isArray(hp.recentSymptoms) ? hp.recentSymptoms : [],
      recentSymptomsOther: hp.recentSymptomsOther || '',
      currentMedication: hp.currentMedications || hp.currentMedication || '',
      chiefComplaint: st.mainAppeal || '',
      signerName: hp.signerName || '',
      signerRelation: hp.signerRelation || '',
    };

    const ageStr = st.age != null && st.age !== '' ? `${st.age}岁` : '';
    const genderStr = formatGender(st.gender);
    const emergencyRelation = sanitize(hp.emergencyRelation || hp.relation);
    const homeAddress = sanitize(st.homeAddress || hp.address || hp.residence);
    const callbackPhone = sanitize(res.callbackContactPhone);

    // ─── 一、服务接受方信息（含联络） ──────────────
    const recipientRows: InfoRow[] = [
      { label: '姓名', value: dash(sanitize(st.name)) },
      { label: '性别', value: dash(genderStr) },
      { label: '年龄', value: dash(ageStr) },
      { label: '证件号', value: dash(sanitize(st.idCard)) },
      { label: '联系电话', value: dash(sanitize(st.phone || res.user?.phone)) },
      { label: '家庭地址', value: dash(homeAddress) },
      { label: '紧急联系人', value: dash(sanitize(st.emergencyContact)) },
      { label: '与就诊人关系', value: dash(emergencyRelation) },
      { label: '紧急联系电话', value: dash(sanitize(st.emergencyPhone)) },
    ].filter(r => r.value !== '—');
    if (callbackPhone) {
      recipientRows.push({ label: '客服回电号码', value: callbackPhone });
    }

    // ─── 二、本次服务详情（履约执行） ──────────────
    const hospital = sanitize(res.hospital) || sanitize(res.hospitalDirectory?.name);
    const department = sanitize(res.department);
    const serviceTime = formatServiceTime(res.serviceTime) || sanitize(res.serviceTime);
    const serviceType = sanitize(res.serviceType) || '陪诊服务';
    const feeType = sanitize(res.attendantFeeType);
    const mainAppeal = sanitize(st.mainAppeal);
    const remark = sanitize(res.remark ?? res.notes);

    const att = res.attendant;
    let attendantLine = '待分配';
    if (res.needAttendant === false) {
      attendantLine = '不需要陪诊员';
    } else if (att && typeof att === 'object') {
      const attName = sanitize((att as any).name || (att as any).realName);
      const attPhone = sanitize((att as any).phone);
      attendantLine = attName ? (attPhone ? `${attName}（${attPhone}）` : attName) : '待分配';
    }

    const serviceRows: InfoRow[] = [
      { label: '服务类型', value: dash(serviceType) },
      { label: '服务费用类型', value: dash(feeType) },
      { label: '就诊时间', value: dash(serviceTime) },
      { label: '就诊医院', value: dash(hospital) },
      { label: '就诊科室', value: dash(department) },
      { label: '陪诊员', value: attendantLine },
      { label: '就医/陪诊诉求', value: dash(mainAppeal) },
      { label: '订单备注', value: dash(remark) },
    ].filter(r => r.value !== '—');

    // ─── 三、服务项目与费用 ──────────────
    let feeLines: FeeLine[] = [];
    let feeTotal = '';
    if (billRes && Array.isArray(billRes.items) && billRes.items.length > 0) {
      feeLines = billRes.items.map((i: any) => ({
        label: sanitize(i.label) || '项目',
        amount: String(i.amount ?? '0'),
        note: i.note ? sanitize(i.note) : '',
      }));
      feeTotal = String(billRes.totalAmount || '0.00');
    } else {
      const addItems = Array.isArray(res.additionalServiceItems) ? res.additionalServiceItems : [];
      const bf = Number(res.baseFee);
      if (!Number.isNaN(bf) && bf > 0) {
        feeLines.push({ label: '基础陪诊费', amount: bf.toFixed(2) });
      }
      for (const it of addItems) {
        const amt = Number((it as any)?.amount);
        if (!Number.isNaN(amt) && amt > 0) {
          feeLines.push({
            label: sanitize((it as any)?.name || (it as any)?.selection) || '附加项目',
            amount: amt.toFixed(2),
            note: sanitize((it as any)?.note),
          });
        }
      }
      const tf = Number(res.totalFee);
      if (!Number.isNaN(tf) && tf > 0) feeTotal = tf.toFixed(2);
      else if (feeLines.length > 0) {
        feeTotal = feeLines.reduce((s, l) => s + Number(l.amount || 0), 0).toFixed(2);
      }
    }

    const paymentText =
      PAYMENT_STATUS_MAP[String(res.paymentStatus || billRes?.order?.paymentStatus || '').trim()] || '—';
    const settlementText =
      SETTLEMENT_STATUS_MAP[String(res.settlementStatus || billRes?.order?.settlementStatus || '').trim()] ||
      '待结算';
    const pmRaw = String(res.paymentMethod || billRes?.order?.paymentMethod || '').trim();
    const paymentMethodText = pmRaw ? PAYMENT_METHOD_MAP[pmRaw] || pmRaw : '—';

    const feeFootRows: InfoRow[] = [
      { label: '结算状态', value: settlementText },
      { label: '付款状态', value: paymentText },
      { label: '付款方式', value: paymentMethodText },
    ];

    this.setData({ recipientRows, serviceRows, feeLines, feeTotal, feeFootRows });
  },

  toggleTermsRead() {
    this.setData({ termsRead: !this.data.termsRead });
  },

  showTermsPopup() {
    this.setData({ showTerms: true });
  },

  closeTerms() {
    this.setData({ showTerms: false });
  },

  confirmTerms() {
    this.setData({ showTerms: false, termsRead: true });
  },

  goSign() {
    if (!this.data.needsSign) return;
    if (this.data.signGateBlocked) {
      wx.showToast({ title: this.data.signGateHint || '当前阶段暂不可签署', icon: 'none' });
      return;
    }
    if (!this.data.termsRead) {
      wx.showToast({ title: '请先阅读并勾选《陪了个伴陪诊服务条款》', icon: 'none' });
      return;
    }
    this.setData({ showSignerPicker: true });
  },

  onSignerSelect(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    const option = SIGNER_OPTIONS[idx];
    if (!option) return;
    this.setData({
      showSignerPicker: false,
      selectedSignerIndex: idx,
    });
    const relation = option.value;
    const name = relation === '本人'
      ? (this.data.subjectName || '客户')
      : '';
    const signPageName = name || '签署人';
    const qrSceneParam = this._qrScene
      ? `&qrScene=${encodeURIComponent(this._qrScene)}`
      : '';
    const profileSnapshot = this._signProfileSnapshot;
    wx.navigateTo({
      url: `/pages/health-profile-sign/health-profile-sign?signName=${encodeURIComponent(signPageName)}${qrSceneParam}`,
      events: {
        signComplete: (data: { signUrl: string; signatureName?: string }) => {
          const finalName = data.signatureName || signPageName;
          void this.submitSign(data.signUrl, finalName, relation);
        },
      },
      success: (res) => {
        if (profileSnapshot) {
          res.eventChannel.emit('profileData', profileSnapshot);
        }
      },
    });
  },

  closeSignerPicker() {
    this.setData({ showSignerPicker: false });
  },

  openServiceSummary() {
    if (!this.data.orderId) return;
    wx.navigateTo({
      url: `/pages/order/service-confirm-summary/service-confirm-summary?orderId=${encodeURIComponent(this.data.orderId)}`,
    });
  },

  async submitSign(signatureUrl: string, signerName: string, signerRelation?: string) {
    wx.showLoading({ title: '提交中' });
    try {
      if (this._qrScene) {
        await postPublic(`/public/service-confirm/${this._qrScene}/sign`, {
          signatureUrl,
          signerName,
          signerRelation: signerRelation || undefined,
        });
      } else {
        await post(`/orders/${this.data.orderId}/service-confirm/sign`, {
          signatureUrl,
          signerName,
          signerRelation: signerRelation || undefined,
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '签署成功', icon: 'success' });
      if (!this._qrScene) {
        requestSubscribe([
          'orderServiceReminder',
          'orderPaymentReminder',
          'orderReviewInvite',
        ]).catch(() => {});
      }
      if (this._qrScene) {
        await this.loadStatusByQr(this._qrScene);
      } else {
        await this.loadStatus();
      }
    } catch {
      wx.hideLoading();
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
