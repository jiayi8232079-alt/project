import { get, post, put, del } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';
import { getUserInfo } from '../../../utils/auth';
import { resolvePublicUrl } from '../../../utils/media-url';
import { renderHealthSignShareCover } from '../../../utils/share-cover';

const STATUS_LABEL: Record<string, string> = {
  pending_dispatch: '待派单',
  pending_accept: '待接单',
  pending_grab: '待抢单',
  pending_sign: '待签署',
  pending_service: '待服务',
  in_progress: '进行中',
  pending_review: '待回访',
  completed: '已完成',
  canceled: '已取消',
  emergency: '紧急',
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunded: '已退款',
};

const SETTLEMENT_LABEL: Record<string, string> = {
  pending: '待结算',
  settled: '已结算',
  partial: '部分结算',
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  attendant: '陪诊员',
  nutritionist: '营养师',
  rehabilitator: '康复师',
  nurse: '护士',
  caregiver: '居家护理员',
  maternal_care: '月嫂',
  psychologist: '心理咨询师',
};

function staffRoleLabel(role?: string | null): string {
  if (!role) return '服务人员';
  return STAFF_ROLE_LABELS[role] || '服务人员';
}

const STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  pending_dispatch: [
    { value: 'pending_accept', label: '→ 待接单' },
    { value: 'pending_grab', label: '→ 待抢单' },
    { value: 'canceled', label: '→ 取消订单' },
  ],
  pending_accept: [
    { value: 'pending_service', label: '→ 待服务' },
    { value: 'pending_dispatch', label: '→ 退回待派' },
    { value: 'canceled', label: '→ 取消订单' },
  ],
  pending_grab: [
    { value: 'pending_accept', label: '→ 指派' },
    { value: 'pending_sign', label: '→ 待签署' },
    { value: 'canceled', label: '→ 取消订单' },
  ],
  pending_sign: [
    { value: 'pending_service', label: '→ 待服务' },
    { value: 'canceled', label: '→ 取消订单' },
  ],
  pending_service: [
    { value: 'in_progress', label: '→ 进行中' },
    { value: 'canceled', label: '→ 取消订单' },
  ],
  in_progress: [
    { value: 'completed', label: '→ 已完成' },
    { value: 'pending_review', label: '→ 待回访' },
    { value: 'emergency', label: '→ 紧急' },
  ],
  pending_review: [
    { value: 'completed', label: '→ 已完成' },
    { value: 'in_progress', label: '→ 恢复进行' },
  ],
  emergency: [
    { value: 'completed', label: '→ 已完成' },
    { value: 'canceled', label: '→ 取消订单' },
    { value: 'in_progress', label: '→ 恢复进行' },
  ],
};

const TIMELINE_TYPE_LABEL: Record<string, string> = {
  text: '文字记录',
  image: '图片',
  audio_question: '问诊录音',
  audio_advice: '医嘱录音',
  file: '文件',
  node: '节点',
  service_start: '服务开始',
  service_end: '服务结束',
  emergency: '紧急',
  system: '系统',
  internal_note: '内部备注',
};

const ATTENDANT_FEE_OPTIONS = [
  { label: '青田半日', fee: 120 },
  { label: '青田全日', fee: 200 },
  { label: '温州丽水（全日）', fee: 240 },
  { label: '杭州上海（全日）', fee: 300 },
  { label: '北京（全日）', fee: 350 },
  { label: '自定义金额', fee: 0 },
];

const PAYMENT_METHOD_OPTIONS = [
  { label: '微信转账', value: 'wechat' },
  { label: '支付宝转账', value: 'alipay' },
  { label: '收款码转账', value: 'qr_transfer' },
  { label: '银行卡转账', value: 'bank_transfer' },
  { label: '现金', value: 'cash' },
  { label: '其他', value: 'other' },
];

function getPaymentMethodLabel(value: string): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label || '选择付款方式';
}

function genItemId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveAssetUrl(url?: string) {
  return resolvePublicUrl(url);
}

Page({
  data: {
    statusBarHeight: 20,
    orderId: 0,
    order: null as any,
    loaded: false,
    activeTab: 'info',
    tabs: [
      { key: 'info', label: '基本信息' },
      { key: 'payment', label: '费用回款' },
      { key: 'timeline', label: '服务记录' },
      { key: 'actions', label: '操作' },
    ],
    dispatchDialogVisible: false,
    attendantList: [] as any[],
    selectedAttendantId: 0,
    dispatchLoading: false,
    currentUserRole: '',
    canDispatch: false,
    canEdit: false,
    timelineItems: [] as any[],
    timelineLoading: false,
    timelineLoaded: false,
    statusTransitions: [] as { value: string; label: string }[],
    addTimelineDialogVisible: false,
    addTimelineContent: '',
    addTimelineType: 'text',
    addTimelineVisibleToUser: true,
    confirmSceneCode: '',
    confirmNeedsSign: false,
    confirmSigned: false,
    isEscortOrder: false,
    feeEditVisible: false,
    feeEditSaving: false,
    feeEditForm: {
      baseFee: 0,
      attendantFeeType: '',
      attendantFee: 0,
      additionalServiceItems: [] as Array<{ id: string; name: string; amount: number; note: string }>,
      attendantExtraIncomeItems: [] as Array<{ id: string; name: string; amount: number; note: string }>,
      settlementStatus: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: '',
      settlementRemark: '',
    },
    feeEditAttendantFeeOptions: ATTENDANT_FEE_OPTIONS,
    feeEditComputedTotal: 0,
    feeEditComputedAttendantFee: 0,
    feeEditComputedTotalText: '¥0.00',
    feeEditComputedAttendantFeeText: '¥0.00',
    feeEditAddonTotalText: '¥0.00',
    feeEditAttendantFeeText: '¥0.00',
    feeEditPaymentMethodText: '选择付款方式',
  },

  onLoad(options: any) {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    if (options.id) {
      this.setData({ orderId: parseInt(options.id) });
    }
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    const userInfo = getUserInfo();
    const canDispatch = ['admin', 'operator', 'customer_service'].includes(userInfo?.role);
    const canEdit = ['admin', 'operator', 'finance'].includes(userInfo?.role);
    this.setData({ currentUserRole: userInfo?.role, canDispatch, canEdit });
    this.loadOrder();
  },

  onPullDownRefresh() {
    this.loadOrder().then(() => wx.stopPullDownRefresh());
  },

  async loadOrder() {
    if (!this.data.orderId) return;
    try {
      const order: any = await get(`/orders/${this.data.orderId}`);
      const transitions = STATUS_TRANSITIONS[order.status] || [];
      const staffRole = order?.attendant?.primaryRole || '';
      const staffRoleName = staffRoleLabel(staffRole);
      const isEscortOrder = order.serviceType === '陪诊服务' || (!staffRole || staffRole === 'attendant');
      this.setData({
        order: {
          ...order,
          statusLabel: STATUS_LABEL[order.status] || order.status,
          paymentLabel: PAYMENT_LABEL[order.paymentStatus] || '',
          settlementLabel: SETTLEMENT_LABEL[order.settlementStatus] || '',
          serviceTimeDisplay: fmtDate(order.serviceTime),
          serviceEndTimeDisplay: fmtDate(order.serviceEndTime),
          paymentPaidAtDisplay: fmtDate(order.paymentPaidAt),
          settledAtDisplay: fmtDate(order.settledAt),
          createdAtDisplay: fmtDateTime(order.createdAt),
          additionalServiceItems: order.additionalServiceItems || [],
          attendantExtraIncomeItems: order.attendantExtraIncomeItems || [],
          additionalTotal: (order.additionalServiceItems || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0),
          extraIncomeTotal: (order.attendantExtraIncomeItems || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0),
          staffRoleLabel: staffRoleName,
          staffRoleCode: staffRole,
          showStaffRoleTag: !!staffRole && staffRole !== 'attendant',
        },
        statusTransitions: transitions,
        loaded: true,
        isEscortOrder,
        confirmSigned: !!(order.serviceConfirmSignedAt && order.serviceConfirmSignatureUrl),
        confirmNeedsSign: order.serviceType === '陪诊服务' && order.status !== 'canceled' && !order.serviceConfirmSignedAt,
      });
      if (order.serviceType === '陪诊服务' && !order.serviceConfirmSignedAt) {
        this._prefetchConfirmScene();
      }
    } catch (e) {
      console.error('加载订单详情失败', e);
      this.setData({ loaded: true });
    }
  },

  async _prefetchConfirmScene() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}/service-confirm-scene`);
      if (res?.sceneCode) {
        this.setData({ confirmSceneCode: res.sceneCode });
      }
    } catch (e) {
      console.warn('预取确认单场景码失败', e);
    }
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'timeline' && !this.data.timelineLoaded) {
      this.loadTimeline();
    }
  },

  async loadTimeline() {
    if (!this.data.orderId) return;
    this.setData({ timelineLoading: true });
    try {
      const items: any[] = await get(`/timelines/order/${this.data.orderId}`, { includeInternal: true }) as any;
      const mapped = (Array.isArray(items) ? items : []).map((item: any) => ({
        ...item,
        typeLabel: TIMELINE_TYPE_LABEL[item.type] || item.type || '记录',
        timeDisplay: item.createdAt ? fmtDateTime(item.createdAt) : '',
        operatorName: item.operator?.realName || item.operator?.nickname || '',
        isVisible: item.visibleToUser !== false,
        images: getTimelineImages(item),
      }));
      this.setData({ timelineItems: mapped, timelineLoaded: true });
    } catch (e) {
      console.error('加载时间轴失败', e);
    } finally {
      this.setData({ timelineLoading: false });
    }
  },

  previewImage(e: any) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: [url] });
  },

  // ── 派单 ──
  async openDispatchDialog() {
    try {
      wx.showLoading({ title: '加载中...' });
      const orderRole = this.data.order?.staffRoleCode || '';
      const params: any = { status: 'active', pageSize: 50 };
      if (orderRole) params.primaryRole = orderRole;
      const res: any = await get('/attendants', params);
      const list = (res?.items || res?.data || res || []).map((a: any) => {
        const name = a.realName || (a.user ? (a.user.name || a.user.nickname || a.user.phone) : '') || `服务人员${a.id}`;
        const role = a.primaryRole || '';
        const roleName = staffRoleLabel(role);
        return {
          ...a,
          displayName: name,
          displayRoleLabel: roleName,
          showRoleTag: !!role && role !== 'attendant',
        };
      });
      wx.hideLoading();
      this.setData({ attendantList: list, dispatchDialogVisible: true });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '加载服务人员失败', icon: 'none' });
    }
  },

  selectAttendant(e: any) {
    this.setData({ selectedAttendantId: e.currentTarget.dataset.id });
  },

  closeDispatchDialog() {
    this.setData({ dispatchDialogVisible: false, selectedAttendantId: 0 });
  },

  async confirmDispatch() {
    if (!this.data.selectedAttendantId) {
      wx.showToast({ title: '请选择服务人员', icon: 'none' });
      return;
    }
    this.setData({ dispatchLoading: true });
    try {
      await put(`/orders/${this.data.orderId}/dispatch`, {
        attendantId: this.data.selectedAttendantId,
        attendantFee: 0,
      });
      this.setData({ dispatchDialogVisible: false, selectedAttendantId: 0 });
      wx.showToast({ title: '派单成功', icon: 'success' });
      await this.loadOrder();
    } catch (e) {
      wx.showToast({ title: '派单失败', icon: 'none' });
    } finally {
      this.setData({ dispatchLoading: false });
    }
  },

  // ── 代服务人员确认接单（后台许可接单） ──
  handleAdminConfirmAccept() {
    const order = this.data.order;
    if (!order || order.status !== 'pending_accept' || !order.attendant) return;
    const roleName = order.staffRoleLabel || '服务人员';
    const attName =
      order.attendant?.realName ||
      order.attendant?.user?.name ||
      order.attendant?.user?.nickname ||
      `该${roleName}`;
    wx.showModal({
      title: `代${roleName}确认接单`,
      content: `确认由后台代「${attName}」确认接单？\n订单将直接进入「待服务」，${roleName}无需再自行操作。`,
      confirmText: '确认许可',
      cancelText: '再想想',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '处理中...', mask: true });
          await put(`/orders/${this.data.orderId}/admin-confirm-accept`, {});
          wx.hideLoading();
          wx.showToast({ title: '已代确认接单', icon: 'success' });
          await this.loadOrder();
          if (this.data.timelineLoaded) {
            await this.loadTimeline();
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  // ── 付款/结算 ──
  async markPaid() {
    wx.showModal({
      title: '确认收款',
      content: '确认将此订单标记为已付款？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await put(`/orders/${this.data.orderId}`, { paymentStatus: 'paid', paymentPaidAt: new Date().toISOString() });
          wx.showToast({ title: '已标记付款', icon: 'success' });
          await this.loadOrder();
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  async markSettled() {
    wx.showModal({
      title: '确认结算',
      content: '确认将此订单标记为已结算？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await put(`/orders/${this.data.orderId}`, { settlementStatus: 'settled', settledAt: new Date().toISOString() });
          wx.showToast({ title: '已标记结算', icon: 'success' });
          await this.loadOrder();
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  // ── 状态变更 ──
  async changeStatus(e: any) {
    const newStatus = e.currentTarget.dataset.status;
    const label = STATUS_LABEL[newStatus] || newStatus;
    wx.showModal({
      title: '变更订单状态',
      content: `确认将订单状态变更为「${label}」？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await put(`/orders/${this.data.orderId}/status`, { status: newStatus });
          wx.showToast({ title: '状态已变更', icon: 'success' });
          await this.loadOrder();
        } catch (err: any) {
          wx.showToast({ title: err?.message || '变更失败', icon: 'none' });
        }
      },
    });
  },

  // ── 时间线管理 ──
  showAddTimelineDialog() {
    this.setData({ addTimelineDialogVisible: true, addTimelineContent: '', addTimelineType: 'text', addTimelineVisibleToUser: true });
  },

  closeAddTimelineDialog() {
    this.setData({ addTimelineDialogVisible: false });
  },

  onAddTimelineContentInput(e: any) { this.setData({ addTimelineContent: e.detail.value }); },
  onAddTimelineTypeChange(e: any) { this.setData({ addTimelineType: e.currentTarget.dataset.type }); },
  toggleTimelineVisibleToUser() { this.setData({ addTimelineVisibleToUser: !this.data.addTimelineVisibleToUser }); },

  async confirmAddTimeline() {
    const { addTimelineContent, addTimelineType, addTimelineVisibleToUser, orderId } = this.data;
    if (!addTimelineContent.trim()) { wx.showToast({ title: '请输入内容', icon: 'none' }); return; }
    try {
      await post('/timelines', {
        orderId,
        type: addTimelineType,
        content: addTimelineContent.trim(),
        visibleToUser: addTimelineVisibleToUser,
      });
      wx.showToast({ title: '已添加', icon: 'success' });
      this.setData({ addTimelineDialogVisible: false });
      await this.loadTimeline();
    } catch {
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  async toggleTimelineVisibility(e: any) {
    const { id, visible } = e.currentTarget.dataset;
    const newVisible = !visible;
    try {
      await put(`/timelines/${id}/visibility`, { visible: newVisible });
      wx.showToast({ title: newVisible ? '已设为可见' : '已设为隐藏', icon: 'success' });
      await this.loadTimeline();
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async deleteTimelineItem(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确认删除该时间轴记录？此操作不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await del(`/timelines/${id}`);
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadTimeline();
        } catch {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  // ── 备注编辑 ──
  editNotes() {
    const current = this.data.order?.notes || '';
    wx.showModal({
      title: '修改备注',
      editable: true,
      placeholderText: current || '输入备注信息',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await put(`/orders/${this.data.orderId}`, { notes: res.content || '' });
          wx.showToast({ title: '备注已更新', icon: 'success' });
          await this.loadOrder();
        } catch {
          wx.showToast({ title: '更新失败', icon: 'none' });
        }
      },
    });
  },

  // ── 辅助 ──
  copyOrderNo() {
    const no = this.data.order?.orderNumber;
    if (!no) return;
    wx.setClipboardData({ data: no });
  },

  callUser() {
    const phone = this.data.order?.user?.phone;
    if (!phone) { wx.showToast({ title: '无联系电话', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  callAttendant() {
    const phone = this.data.order?.attendant?.user?.phone;
    if (!phone) { wx.showToast({ title: '无联系电话', icon: 'none' }); return; }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  goServiceTimeline() {
    wx.navigateTo({ url: `/pages/workbench/service-timeline/service-timeline?orderId=${this.data.orderId}` });
  },

  onShareAppMessage() {
    const { order, confirmSceneCode } = this.data;
    if (!order || !confirmSceneCode) {
      return {
        title: '陪了个伴 - 陪诊服务',
        path: '/pages/index/index',
      };
    }
    const subjectName = order.serviceTarget?.name || '就诊人';
    const title = `请签署「${subjectName}」的陪诊服务确认单`;
    const path = `/pages/order/service-confirm/service-confirm?orderId=${order.id}&qrScene=${encodeURIComponent(confirmSceneCode)}`;
    const coverInput = {
      subjectName,
      statusText: '待签署',
      brandLine: '陪了个伴 · 陪诊服务',
      subtitle: '服务确认单签署',
      footerGuide: '请阅读条款并签署确认',
    };
    // 符合微信官方规范：同步返回基础分享信息，promise 字段异步补图
    const shareInfo: any = { title, path };
    shareInfo.promise = renderHealthSignShareCover(this, coverInput).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
  },

  handleBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.navigateTo({ url: '/pages/admin/orders/orders' });
    }
  },

  // ─── 批量费用与结算编辑 ──────────────────────────────────────

  openFeeEdit() {
    if (!this.data.canEdit) {
      wx.showToast({ title: '无编辑权限', icon: 'none' });
      return;
    }
    const order = this.data.order;
    if (!order) return;
    const attendantFeeType = order.attendantFeeType || '';
    const attendantFeeNum = Number(order.attendantFee || 0);
    const extraIncomeTotal = (order.attendantExtraIncomeItems || []).reduce(
      (s: number, it: any) => s + Number(it.amount || 0), 0,
    );
    const baseIncome = Math.max(attendantFeeNum - extraIncomeTotal, 0);

    const additionalServiceItems = (order.additionalServiceItems || []).map((it: any) => ({
      id: it.id || genItemId('addon'),
      name: it.name || '',
      amount: Number(it.amount || 0),
      note: it.note || '',
    }));
    const attendantExtraIncomeItems = (order.attendantExtraIncomeItems || []).map((it: any) => ({
      id: it.id || genItemId('income'),
      name: it.name || '',
      amount: Number(it.amount || 0),
      note: it.note || '',
    }));

    const form = {
      baseFee: Number(order.baseFee || 0),
      attendantFeeType,
      attendantFee: baseIncome,
      additionalServiceItems,
      attendantExtraIncomeItems,
      settlementStatus: order.settlementStatus || 'pending',
      paymentStatus: order.paymentStatus || 'unpaid',
      paymentMethod: order.paymentMethod || '',
      settlementRemark: order.settlementRemark || '',
    };

    this.setData({
      feeEditVisible: true,
      feeEditForm: form,
      feeEditPaymentMethodText: getPaymentMethodLabel(form.paymentMethod),
    });
    this.recalcFeeEdit(form);
  },

  closeFeeEdit() {
    this.setData({ feeEditVisible: false });
  },

  recalcFeeEdit(form?: any) {
    const f = form || this.data.feeEditForm;
    const addonTotal = (f.additionalServiceItems || []).reduce(
      (s: number, it: any) => s + Number(it.amount || 0), 0,
    );
    const incomeTotal = (f.attendantExtraIncomeItems || []).reduce(
      (s: number, it: any) => s + Number(it.amount || 0), 0,
    );
    const total = Number(f.baseFee || 0) + addonTotal;
    const attendantFeeTotal = Number(f.attendantFee || 0) + incomeTotal;
    this.setData({
      feeEditComputedTotal: total,
      feeEditComputedAttendantFee: attendantFeeTotal,
      feeEditComputedTotalText: `¥${total.toFixed(2)}`,
      feeEditComputedAttendantFeeText: `¥${attendantFeeTotal.toFixed(2)}`,
      feeEditAddonTotalText: `¥${addonTotal.toFixed(2)}`,
      feeEditAttendantFeeText: `¥${Number(f.attendantFee || 0).toFixed(2)}`,
    });
  },

  onFeeBaseFeeInput(e: any) {
    const v = parseFloat(e.detail.value) || 0;
    const form = { ...this.data.feeEditForm, baseFee: v };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  pickAttendantFeeType() {
    const opts = this.data.feeEditAttendantFeeOptions;
    wx.showActionSheet({
      itemList: opts.map((o: any) => (o.label === '自定义金额' ? '自定义金额' : `${o.label}（¥${o.fee}）`)),
      success: (res) => {
        const selected = opts[res.tapIndex];
        if (!selected) return;
        const isCustom = selected.label === '自定义金额';
        const form = {
          ...this.data.feeEditForm,
          attendantFeeType: selected.label,
          attendantFee: isCustom ? this.data.feeEditForm.attendantFee : selected.fee,
        };
        this.setData({ feeEditForm: form });
        this.recalcFeeEdit(form);
      },
    });
  },

  onFeeAttendantFeeInput(e: any) {
    const v = parseFloat(e.detail.value) || 0;
    const form = { ...this.data.feeEditForm, attendantFee: v };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  addAdditionalServiceItem() {
    const items = [...this.data.feeEditForm.additionalServiceItems, {
      id: genItemId('addon'), name: '', amount: 0, note: '',
    }];
    const form = { ...this.data.feeEditForm, additionalServiceItems: items };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  removeAdditionalServiceItem(e: any) {
    const idx = e.currentTarget.dataset.index;
    const items = [...this.data.feeEditForm.additionalServiceItems];
    items.splice(idx, 1);
    const form = { ...this.data.feeEditForm, additionalServiceItems: items };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  onAdditionalItemNameInput(e: any) {
    const { index } = e.currentTarget.dataset;
    const items = [...this.data.feeEditForm.additionalServiceItems];
    items[index] = { ...items[index], name: e.detail.value };
    const form = { ...this.data.feeEditForm, additionalServiceItems: items };
    this.setData({ feeEditForm: form });
  },

  onAdditionalItemAmountInput(e: any) {
    const { index } = e.currentTarget.dataset;
    const items = [...this.data.feeEditForm.additionalServiceItems];
    items[index] = { ...items[index], amount: parseFloat(e.detail.value) || 0 };
    const form = { ...this.data.feeEditForm, additionalServiceItems: items };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  onAdditionalItemNoteInput(e: any) {
    const { index } = e.currentTarget.dataset;
    const items = [...this.data.feeEditForm.additionalServiceItems];
    items[index] = { ...items[index], note: e.detail.value };
    const form = { ...this.data.feeEditForm, additionalServiceItems: items };
    this.setData({ feeEditForm: form });
  },

  addAttendantExtraIncomeItem() {
    const items = [...this.data.feeEditForm.attendantExtraIncomeItems, {
      id: genItemId('income'), name: '', amount: 0, note: '',
    }];
    const form = { ...this.data.feeEditForm, attendantExtraIncomeItems: items };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  removeAttendantExtraIncomeItem(e: any) {
    const idx = e.currentTarget.dataset.index;
    const items = [...this.data.feeEditForm.attendantExtraIncomeItems];
    items.splice(idx, 1);
    const form = { ...this.data.feeEditForm, attendantExtraIncomeItems: items };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  onIncomeItemNameInput(e: any) {
    const { index } = e.currentTarget.dataset;
    const items = [...this.data.feeEditForm.attendantExtraIncomeItems];
    items[index] = { ...items[index], name: e.detail.value };
    const form = { ...this.data.feeEditForm, attendantExtraIncomeItems: items };
    this.setData({ feeEditForm: form });
  },

  onIncomeItemAmountInput(e: any) {
    const { index } = e.currentTarget.dataset;
    const items = [...this.data.feeEditForm.attendantExtraIncomeItems];
    items[index] = { ...items[index], amount: parseFloat(e.detail.value) || 0 };
    const form = { ...this.data.feeEditForm, attendantExtraIncomeItems: items };
    this.setData({ feeEditForm: form });
    this.recalcFeeEdit(form);
  },

  onIncomeItemNoteInput(e: any) {
    const { index } = e.currentTarget.dataset;
    const items = [...this.data.feeEditForm.attendantExtraIncomeItems];
    items[index] = { ...items[index], note: e.detail.value };
    const form = { ...this.data.feeEditForm, attendantExtraIncomeItems: items };
    this.setData({ feeEditForm: form });
  },

  setSettlementStatus(e: any) {
    const v = e.currentTarget.dataset.value;
    const form = { ...this.data.feeEditForm, settlementStatus: v };
    this.setData({ feeEditForm: form });
  },

  setPaymentStatus(e: any) {
    const v = e.currentTarget.dataset.value;
    const newMethod = v === 'paid' ? this.data.feeEditForm.paymentMethod : '';
    const form = { ...this.data.feeEditForm, paymentStatus: v, paymentMethod: newMethod };
    this.setData({
      feeEditForm: form,
      feeEditPaymentMethodText: v === 'paid' ? getPaymentMethodLabel(newMethod) : '选择付款方式',
    });
  },

  pickPaymentMethod() {
    wx.showActionSheet({
      itemList: PAYMENT_METHOD_OPTIONS.map((o) => o.label),
      success: (res) => {
        const selected = PAYMENT_METHOD_OPTIONS[res.tapIndex];
        if (!selected) return;
        const form = { ...this.data.feeEditForm, paymentMethod: selected.value };
        this.setData({ feeEditForm: form, feeEditPaymentMethodText: selected.label });
      },
    });
  },

  onFeeRemarkInput(e: any) {
    const form = { ...this.data.feeEditForm, settlementRemark: e.detail.value };
    this.setData({ feeEditForm: form });
  },

  async handleFeeSave() {
    const f = this.data.feeEditForm;
    const addonTotal = (f.additionalServiceItems || []).reduce(
      (s: number, it: any) => s + Number(it.amount || 0), 0,
    );
    const incomeTotal = (f.attendantExtraIncomeItems || []).reduce(
      (s: number, it: any) => s + Number(it.amount || 0), 0,
    );
    const totalFee = Number(f.baseFee || 0) + addonTotal;
    const attendantFee = Number(f.attendantFee || 0) + incomeTotal;

    const payload: any = {
      baseFee: Number(f.baseFee || 0),
      totalFee,
      attendantFee,
      attendantFeeType: f.attendantFeeType || null,
      additionalServiceItems: f.additionalServiceItems
        .filter((it) => it.name.trim())
        .map((it) => ({ id: it.id, name: it.name.trim(), amount: Number(it.amount || 0), note: it.note?.trim() || '' })),
      attendantExtraIncomeItems: f.attendantExtraIncomeItems
        .filter((it) => it.name.trim())
        .map((it) => ({ id: it.id, name: it.name.trim(), amount: Number(it.amount || 0), note: it.note?.trim() || '' })),
      settlementStatus: f.settlementStatus || 'pending',
      paymentStatus: f.paymentStatus || 'unpaid',
      paymentMethod: f.paymentStatus === 'paid' ? (f.paymentMethod || null) : null,
      settlementRemark: f.settlementRemark?.trim() || null,
    };

    if (f.settlementStatus === 'settled' && this.data.order?.settlementStatus !== 'settled') {
      payload.settledAt = new Date().toISOString();
    } else if (f.settlementStatus === 'pending') {
      payload.settledAt = null;
    }

    this.setData({ feeEditSaving: true });
    try {
      await put(`/orders/admin/${this.data.orderId}`, payload);
      wx.showToast({ title: '费用已保存', icon: 'success' });
      this.setData({ feeEditVisible: false });
      await this.loadOrder();
    } catch (err) {
      console.error('保存费用失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ feeEditSaving: false });
    }
  },
});

function fmtDate(val: string | undefined): string {
  if (!val) return '-';
  return String(val).slice(0, 10);
}

function fmtDateTime(val: string | undefined): string {
  if (!val) return '-';
  return String(val).slice(0, 16).replace('T', ' ');
}

function getTimelineImages(item: any): string[] {
  const images = Array.isArray(item?.metadata?.images) ? item.metadata.images : [];
  return images.map((url: string) => resolveAssetUrl(String(url))).filter(Boolean);
}
