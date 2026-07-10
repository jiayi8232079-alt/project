import { get, put } from '../../../utils/request';
import { resolvePublicUrl } from '../../../utils/media-url';
import { getUserInfo, isLoggedIn } from '../../../utils/auth';
import { showStoreActions } from '../../../utils/storeInfo';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';
import { renderShareCoverToTempPath } from '../../../utils/share-cover';
import { getUserTranscriptionDisplay } from '../../../utils/timeline-transcription';

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

function buildStatusLabel(status: string, roleLabel: string): string {
  const L = roleLabel || '服务人员';
  const map: Record<string, string> = {
    pending_dispatch: '您的订单已提交',
    pending_accept: `等待${L}确认`,
    pending_grab: `等待${L}接单`,
    pending_sign: `${L}已接单`,
    pending_service: `${L}已就绪`,
    in_progress: '服务进行中',
    emergency: '紧急处置中',
    pending_review: '服务已结束',
    completed: '服务已完成',
    canceled: '订单已取消',
  };
  return map[status] || status;
}

function buildStatusDesc(status: string, roleLabel: string): string {
  const L = roleLabel || '服务人员';
  const map: Record<string, string> = {
    pending_dispatch: `系统正在为您寻找最合适的专业${L}`,
    pending_accept: `${L}确认中，请耐心等待`,
    pending_grab: `订单等待${L}接单中`,
    pending_sign: `${L}已接单，即将上岗为您服务`,
    pending_service: `${L}已就位，按约定时间开始服务`,
    in_progress: `${L}正在为您提供服务`,
    emergency: `${L}正在紧急处置中，请保持联系`,
    pending_review: '服务已结束，如愿意可补充评价',
    completed: '感谢您的信任，期待再次为您服务',
    canceled: '订单已取消',
  };
  return map[status] || '';
}

const SETTLEMENT_STATUS_MAP: Record<string, string> = {
  pending: '待结算',
  settled: '已结算',
};

const PAYMENT_STATUS_MAP: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunded: '已退款',
};

const STEP_MAP: Record<string, number> = {
  pending_dispatch: 0,
  pending_accept: 0,
  pending_grab: 0,
  pending_sign: 1,
  pending_service: 1,
  in_progress: 2,
  emergency: 2,
  pending_review: 3,
  completed: 3,
  canceled: -1,
};

const STEP_LABELS = ['已下单', '已派单', '服务中', '已完成'];
const PROGRESS_WIDTHS = [0, 33, 66, 100];

function orderIsLiveShare(order: any) {
  return order?.status === 'in_progress' || order?.status === 'emergency';
}

function buildOrderShareTitle(order: any) {
  const subject = String(order?.subjectName || '就诊人').trim() || '就诊人';
  const svc = String(order?.serviceType || '陪诊服务').trim() || '陪诊服务';
  const tag = orderIsLiveShare(order) ? '陪诊服务中' : '服务动态';
  let title = `${subject} · ${svc} · ${tag}`;
  if (title.length > 36) {
    const sub = subject.length > 8 ? `${subject.slice(0, 7)}…` : subject;
    title = `${sub} · ${svc} · ${tag}`;
  }
  return title;
}

function buildOrderShareStatusLine(order: any) {
  return orderIsLiveShare(order) ? '陪诊服务中' : '服务动态';
}

function formatServiceTime(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatServiceSchedule(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const a = formatServiceTime(start);
  if (!a) return '';
  const b = formatServiceTime(end);
  return b ? `${a} ～ ${b}` : a;
}

function resolveTimelineAssetUrl(url?: string) {
  return resolvePublicUrl(url);
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function looksLikeMojibake(value: string) {
  return (
    !containsCjk(value) &&
    /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ�]/.test(value)
  );
}

function repairLatin1Utf8Mojibake(value: string) {
  try {
    let encoded = '';
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code > 0xff) return value;
      encoded += `%${code.toString(16).padStart(2, '0')}`;
    }
    return decodeURIComponent(encoded);
  } catch {
    return value;
  }
}

function decodeTimelineFileName(name: string) {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }
  if (!looksLikeMojibake(decoded)) {
    return decoded;
  }
  const repaired = repairLatin1Utf8Mojibake(decoded);
  return containsCjk(repaired) ? repaired : decoded;
}

function getTimelineFileName(url?: string, name?: string) {
  const raw = name || (url ? String(url).split('/').pop() || '附件' : '附件');
  return decodeTimelineFileName(raw);
}

function getTimelineImages(item: any): string[] {
  const images = Array.isArray(item?.metadata?.images) ? item.metadata.images : [];
  return images
    .map((url: string) => resolveTimelineAssetUrl(String(url)))
    .filter(Boolean);
}

function getTimelineAudioUrls(item: any): string[] {
  const urls = new Set<string>();
  const metadata = item?.metadata || {};
  if (metadata.audioUrl) {
    urls.add(String(metadata.audioUrl));
  }
  if (Array.isArray(metadata.audioFiles)) {
    metadata.audioFiles.forEach((file: any) => {
      if (file?.url) urls.add(String(file.url));
    });
  }
  if ((item?.type === 'audio_question' || item?.type === 'audio_advice') && Array.isArray(metadata.files)) {
    metadata.files.forEach((file: any) => {
      if (typeof file === 'string') urls.add(file);
      else if (file?.url) urls.add(String(file.url));
    });
  }
  return Array.from(urls)
    .map((url) => resolveTimelineAssetUrl(url))
    .filter(Boolean);
}

function getTimelineDocumentFiles(item: any): { url: string; name: string }[] {
  const metadata = item?.metadata || {};
  if (item?.type === 'audio_question' || item?.type === 'audio_advice') {
    return [];
  }
  if (!Array.isArray(metadata.files)) {
    return [];
  }
  return metadata.files
    .map((file: any) => {
      const rawUrl = typeof file === 'string' ? file : String(file?.url || '');
      return {
        url: resolveTimelineAssetUrl(rawUrl),
        name: getTimelineFileName(rawUrl, typeof file === 'string' ? '' : file?.name),
      };
    })
    .filter((file: { url: string; name: string }) => Boolean(file.url));
}

const CANCEL_NEED_REASON = ['pending_sign', 'pending_service'];

/** 避免接口返回 null / 字符串 "null" 在界面上原样展示 */
function sanitizeDisplayField(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
}

Page({
  _livePollTimer: null as ReturnType<typeof setInterval> | null,
  /** 标记上一次 fetchAttendantLiveLocation 还在途，防止 12s 间隔下弱网堆叠 */
  _liveFetchInFlight: false as boolean,

  data: {
    statusBarHeight: 20,
    pageNeedsLogin: false,
    orderId: '',
    order: {} as any,
    timeline: [] as any[],
    timelineShareToken: '',
    /** 仅下单用户可分享服务动态给亲友 */
    canShareServiceTimeline: false,
    currentUserId: '',
    userRole: '',
    showCancelReason: false,
    cancelReason: '',
    stepIndex: 0,
    steps: [] as { label: string; state: string }[],
    progressWidth: 0,
    /** 评价邀请高亮（URL ?fromReview=1 时由订阅消息带来时展示） */
    showReviewPrompt: false,
    /** 陪诊员实时位置地图（进行中） */
    liveMapLat: 31.2304,
    liveMapLng: 121.4737,
    liveMapMarkers: [] as Array<{
      id: number;
      latitude: number;
      longitude: number;
      title?: string;
      width?: number;
      height?: number;
    }>,
    /** map 组件 polyline/circles 勿缺省为 undefined，否则部分基础库会 Array.from 报错 */
    mapPolyline: [] as unknown[],
    mapCircles: [] as unknown[],
    liveMapScale: 14,
    attendantLiveHint: '',
    serviceConfirmApplicable: false,
    serviceConfirmNeedsSign: false,
    serviceConfirmSigned: false,
    /** 陪诊单待签且仍处于「已下单」阶段：不展示匹配动画，先引导签署 */
    serviceConfirmBlockingMatch: false,
    serviceConfirmSubjectName: '',
  },

  onLoad(options: any) {
    const rawOid = options.id || options.orderId || '';
    const shareTok = String(options.token || '').trim();
    /** 朋友圈分享会落在当前页 path+query，带 token 时转公开页，避免未登录进详情失败 */
    if (shareTok && rawOid) {
      wx.redirectTo({
        url: `/pages/order/share-timeline/share-timeline?orderId=${rawOid}&token=${encodeURIComponent(shareTok)}`,
      });
      return;
    }
    const sysInfo = wx.getSystemInfoSync();
    const userInfo = getUserInfo();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    const fromReviewFlag =
      String(options.fromReview || '').trim() === '1' ||
      String(options.from || '').trim() === 'review';
    this.setData({
      orderId: rawOid,
      currentUserId: userInfo?.id ?? userInfo?._id ?? '',
      userRole: userInfo?.role || '',
      timelineShareToken: '',
      showReviewPrompt: fromReviewFlag,
    });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    const userInfo = getUserInfo();
    this.setData({
      currentUserId: userInfo?.id ?? userInfo?._id ?? '',
      userRole: userInfo?.role || '',
    });
    if (this.data.orderId) {
      this.loadDetail();
      this.loadTimeline();
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  onHide() {
    this.stopAttendantLivePoll();
  },

  onUnload() {
    this.stopAttendantLivePoll();
  },

  stopAttendantLivePoll() {
    if (this._livePollTimer) {
      clearInterval(this._livePollTimer);
      this._livePollTimer = null;
    }
  },

  startAttendantLivePoll() {
    this.stopAttendantLivePoll();
    const st = this.data.order?.status;
    if (st !== 'in_progress' && st !== 'emergency') return;
    void this.fetchAttendantLiveLocation();
    this._livePollTimer = setInterval(() => void this.fetchAttendantLiveLocation(), 12000);
  },

  async fetchAttendantLiveLocation() {
    const st = this.data.order?.status;
    if ((st !== 'in_progress' && st !== 'emergency') || !this.data.orderId) return;
    // 弱网下单次请求可能超过 12s 还没返回；不加这个 in-flight 锁会出现请求堆叠，
    // 不仅消耗带宽，也会让 setData 用「已过期的旧位置」覆盖「还没回来的新位置」。
    if (this._liveFetchInFlight) return;
    this._liveFetchInFlight = true;
    try {
      const res: any = await get(`/orders/${this.data.orderId}/attendant-live-location`);
      if (!res?.active) {
        this.setData({
          attendantLiveHint: '',
          liveMapMarkers: [],
          liveMapScale: 12,
        });
        return;
      }
      const roleName = (this.data.order as any)?.staffRoleLabel || '服务人员';
      if (res.latitude == null || res.longitude == null) {
        this.setData({
          attendantLiveHint: `${roleName}尚未上报位置，请稍候…`,
          liveMapMarkers: [],
          liveMapScale: 12,
        });
        return;
      }
      const lat = Number(res.latitude);
      const lng = Number(res.longitude);
      const t = res.updatedAt ? new Date(res.updatedAt) : null;
      const timeStr = t && !isNaN(t.getTime()) ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
      this.setData({
        liveMapLat: lat,
        liveMapLng: lng,
        liveMapScale: 15,
        liveMapMarkers: [
          {
            id: 1,
            latitude: lat,
            longitude: lng,
            title: roleName,
            width: 28,
            height: 28,
          },
        ],
        attendantLiveHint: timeStr ? `位置已于 ${timeStr} 更新（仅供参考）` : `${roleName}实时位置（仅供参考）`,
      });
    } catch {
      /* ignore */
    } finally {
      this._liveFetchInFlight = false;
    }
  },

  async prefetchTimelineShareToken(orderOwnerUserId?: number) {
    if (!this.data.orderId || this.data.timelineShareToken) return;
    const me = this.data.currentUserId;
    if (
      me == null ||
      String(me) === '' ||
      orderOwnerUserId == null ||
      String(orderOwnerUserId) !== String(me)
    ) {
      return;
    }
    try {
      const r: any = await get(`/orders/${this.data.orderId}/timeline-share-token`);
      if (r?.token) this.setData({ timelineShareToken: r.token });
    } catch {
      /* 仍可通过「分享」引导页再拉取 */
    }
  },

  async loadDetail() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}`);
      const status = res.status || '';
      const stepIndex = STEP_MAP[status] ?? 0;
      const steps = STEP_LABELS.map((label, i) => ({
        label,
        state: stepIndex >= 3
          ? 'done'
          : (i < stepIndex ? 'done' : (i === stepIndex ? 'current' : 'pending')),
      }));

      const attendantRaw = res.attendant;
      const attendant =
        attendantRaw && typeof attendantRaw === 'object'
          ? {
              ...attendantRaw,
              avatar: resolvePublicUrl(
                (attendantRaw as any).avatar || (attendantRaw as any).avatarUrl || '',
              ),
            }
          : attendantRaw;
      const staffRoleCode = (attendant as any)?.primaryRole || (attendantRaw as any)?.primaryRole || '';
      const staffRoleName = staffRoleLabel(staffRoleCode);
      this.setData({
        order: {
          ...res,
          hospital: sanitizeDisplayField(res.hospital),
          department: sanitizeDisplayField(res.department),
          ...(attendant ? { attendant } : {}),
          orderNo: res.orderNumber || res.orderNo,
          statusText: buildStatusLabel(status, staffRoleName),
          statusDesc: buildStatusDesc(status, staffRoleName),
          staffRoleLabel: staffRoleName,
          staffRoleCode,
          showStaffRoleTag: !!staffRoleCode && staffRoleCode !== 'attendant',
          serviceTime: formatServiceSchedule(res.serviceTime, res.serviceEndTime) || formatServiceTime(res.serviceTime) || res.serviceTime,
          subjectName: res.serviceTarget?.name || '—',
          remark: res.remark ?? res.notes ?? '',
          settlementStatusText: SETTLEMENT_STATUS_MAP[res.settlementStatus || ''] || '待结算',
          paymentStatusText: PAYMENT_STATUS_MAP[res.paymentStatus || ''] || '未付款',
          reportTime: res.updatedAt ? formatServiceTime(res.updatedAt) : '',
        },
        stepIndex,
        steps,
        progressWidth: PROGRESS_WIDTHS[Math.max(0, stepIndex)] || 0,
        canShareServiceTimeline: (() => {
          const ownerId = res.userId ?? res.user?.id;
          const me = this.data.currentUserId;
          return (
            ownerId != null &&
            me !== '' &&
            me != null &&
            String(ownerId) === String(me)
          );
        })(),
      });
      if (status === 'in_progress' || status === 'emergency') {
        this.startAttendantLivePoll();
      } else {
        this.stopAttendantLivePoll();
        this.setData({
          liveMapMarkers: [],
          attendantLiveHint: '',
          liveMapScale: 14,
        });
      }
      void this.prefetchTimelineShareToken(res.userId);
      void this.loadServiceConfirmMeta(res);
    } catch (e) {
      console.error('加载订单详情失败', e);
    }
  },

  async loadServiceConfirmMeta(orderRes?: any) {
    const res = orderRes || this.data.order;
    const st = res?.serviceType || '';
    const canceled = res?.status === 'canceled';
    if (st !== '陪诊服务' || canceled) {
      this.setData({
        serviceConfirmApplicable: false,
        serviceConfirmNeedsSign: false,
        serviceConfirmSigned: false,
        serviceConfirmBlockingMatch: false,
        serviceConfirmSubjectName: '',
      });
      return;
    }
    try {
      const r: any = await get(`/orders/${this.data.orderId}/service-confirm/status`);
      const status = res?.status || '';
      const stepIdx = STEP_MAP[status] ?? 0;
      // 只有在"陪诊员已接单，待签署"阶段才显示签署入口；
      // 刚下单（pending_dispatch / pending_accept / pending_grab）阶段不打扰用户
      const blocking = !!r.applicable && !!r.needsSign && stepIdx >= 1 && stepIdx < 3;
      this.setData({
        serviceConfirmApplicable: !!r.applicable,
        serviceConfirmNeedsSign: !!r.needsSign,
        serviceConfirmSigned: !!r.signed,
        serviceConfirmBlockingMatch: blocking,
        serviceConfirmSubjectName: r.subjectName || '',
      });
    } catch {
      this.setData({
        serviceConfirmApplicable: false,
        serviceConfirmNeedsSign: false,
        serviceConfirmSigned: false,
        serviceConfirmBlockingMatch: false,
        serviceConfirmSubjectName: '',
      });
    }
  },

  async loadTimeline() {
    try {
      const res: any = await get(`/timelines/order/${this.data.orderId}/user`);
      const TYPE_LABEL: Record<string, string> = {
        node: '状态更新',
        text: '文字记录',
        image: '照片',
        service_start: '服务开始',
        service_end: '服务结束',
        audio_question: '问诊录音',
        audio_advice: '医嘱录音',
        file: '文件',
      };
      const items = (res.items || res || []).map((item: any) => ({
        ...item,
        time: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
        title: TYPE_LABEL[item.type] || item.type || '动态',
        description: item.content || '',
        images: getTimelineImages(item),
        audioUrls: getTimelineAudioUrls(item),
        files: getTimelineDocumentFiles(item),
        transcriptionUser: getUserTranscriptionDisplay(item),
      }));
      this.setData({ timeline: items });
    } catch (e) {
      console.error('加载时间线失败', e);
    }
  },

  callAttendant() {
    const phone = (this.data.order.attendant?.phone || '').replace(/\D/g, '');
    if (phone && phone.length >= 11) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      const roleName = (this.data.order as any)?.staffRoleLabel || '服务人员';
      wx.showToast({ title: `暂无${roleName}电话`, icon: 'none' });
    }
  },

  previewImage(e: any) {
    const { src, urls } = e.currentTarget.dataset;
    wx.previewImage({ current: src, urls });
  },

  openTimelineFile(e: any) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    const fullUrl = resolveTimelineAssetUrl(url);
    if (!fullUrl) {
      wx.showToast({ title: '文件地址无效', icon: 'none' });
      return;
    }
    wx.downloadFile({
      url: fullUrl,
      success: (res) => {
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => wx.showToast({ title: '打开文件失败', icon: 'none' }),
        });
      },
      fail: () => wx.showToast({ title: '下载文件失败', icon: 'none' }),
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goBill() {
    wx.navigateTo({
      url: `/pages/order/bill/bill?orderId=${this.data.orderId}`,
    });
  },

  goServiceConfirm() {
    wx.navigateTo({
      url: `/pages/order/service-confirm/service-confirm?orderId=${this.data.orderId}`,
    });
  },

  onContactStore() {
    showStoreActions();
  },

  async prepareShareTimeline() {
    if (!this.data.orderId) return;
    const ownerId = this.data.order?.userId;
    const me = this.data.currentUserId;
    if (ownerId == null || String(ownerId) !== String(me)) {
      wx.showToast({ title: '仅下单用户可分享', icon: 'none' });
      return;
    }
    if (this.data.timelineShareToken) {
      wx.showModal({
        title: '分享服务动态',
        content:
          '请点击右上角「···」，选择「转发给朋友」或「分享到朋友圈」。链接含就诊人信息与服务进展，请勿转发给陌生人。',
        showCancel: false,
      });
      return;
    }
    try {
      wx.showLoading({ title: '准备分享…', mask: true });
      const res: any = await get(`/orders/${this.data.orderId}/timeline-share-token`);
      wx.hideLoading();
      const token = res?.token;
      if (!token) {
        wx.showToast({ title: '无法生成分享', icon: 'none' });
        return;
      }
      this.setData({ timelineShareToken: token });
      wx.showModal({
        title: '分享服务动态',
        content:
          '请点击右上角「···」，选择「转发给朋友」或「分享到朋友圈」。链接含就诊人信息与服务进展，请勿转发给陌生人。',
        showCancel: false,
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '生成分享失败', icon: 'none' });
    }
  },

  onShareAppMessage() {
    const { orderId, order, timelineShareToken } = this.data;
    if (!timelineShareToken || !orderId) {
      return { title: '陪了个伴 · 陪诊服务', path: '/pages/index/index' };
    }
    const title = buildOrderShareTitle(order);
    const path = `/pages/order/share-timeline/share-timeline?orderId=${orderId}&token=${encodeURIComponent(timelineShareToken)}`;
    const lines = {
      subjectName: String(order?.subjectName || '就诊人').trim() || '就诊人',
      serviceType: String(order?.serviceType || '陪诊服务').trim() || '陪诊服务',
      statusLine: buildOrderShareStatusLine(order),
    };
    // 符合微信官方规范：同步返回基础分享信息，promise 字段异步补图
    const shareInfo: any = { title, path };
    shareInfo.promise = renderShareCoverToTempPath(this, lines).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
  },

  onShareTimeline() {
    const { orderId, order, timelineShareToken } = this.data;
    if (!timelineShareToken || !orderId) {
      return { title: '陪了个伴 · 陪诊服务' };
    }
    const title = buildOrderShareTitle(order);
    const query = `orderId=${orderId}&token=${encodeURIComponent(timelineShareToken)}`;
    const lines = {
      subjectName: String(order?.subjectName || '就诊人').trim() || '就诊人',
      serviceType: String(order?.serviceType || '陪诊服务').trim() || '陪诊服务',
      statusLine: buildOrderShareStatusLine(order),
    };
    // 同上：同步返回基础信息，promise 字段异步补图
    const shareInfo: any = { title, query };
    shareInfo.promise = renderShareCoverToTempPath(this, lines).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
  },

  goReview() {
    const mode = (this.data as any)?.order?.reviewed ? 'view' : 'edit';
    wx.navigateTo({
      url: `/pages/order/review/review?orderId=${this.data.orderId}&mode=${mode}`,
    });
  },

  /** 评价页提交成功后回调，用于刷新订单详情里的 reviewed/reviewSummary */
  onReviewSubmitted(_orderId?: string | number) {
    this.setData({ showReviewPrompt: false });
    this.loadDetail();
  },

  goSign() {
    wx.navigateTo({
      url: `/pages/workbench/sign/sign?orderId=${this.data.orderId}`,
    });
  },

  goService() {
    wx.navigateTo({
      url: `/pages/workbench/service-timeline/service-timeline?orderId=${this.data.orderId}`,
    });
  },

  goServiceReport() {
    wx.navigateTo({
      url: `/pages/order/service-report/service-report?orderId=${this.data.orderId}`,
    });
  },

  onRebook() {
    const serviceType = this.data.order?.serviceType || '';
    const typeMap: Record<string, string> = {
      '陪诊服务': 'escort',
      '体检规划': 'checkup',
      '专家匹配': 'expert',
      '门诊咨询': 'consult',
      '到店预约': 'store',
      '代取报告': 'fetch',
    };
    const type = typeMap[serviceType] || 'escort';
    wx.navigateTo({
      url: `/pages/order/create/create?type=${encodeURIComponent(type)}`,
    });
  },

  onCancelOrder() {
    const status = this.data.order.status;
    if (CANCEL_NEED_REASON.includes(status)) {
      this.setData({ showCancelReason: true, cancelReason: '' });
      return;
    }
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      confirmColor: '#e53935',
      success: (res) => {
        if (res.confirm) this.doCancelOrder('');
      },
    });
  },

  onCancelReasonInput(e: any) {
    this.setData({ cancelReason: e.detail.value });
  },

  closeCancelReason() {
    this.setData({ showCancelReason: false });
  },

  confirmCancelWithReason() {
    if (!this.data.cancelReason.trim()) {
      wx.showToast({ title: '请填写取消原因', icon: 'none' });
      return;
    }
    this.setData({ showCancelReason: false });
    this.doCancelOrder(this.data.cancelReason);
  },

  _canceling: false,

  async doCancelOrder(reason: string) {
    if (this._canceling) return;
    this._canceling = true;
    try {
      wx.showLoading({ title: '取消中...' });
      await put(`/orders/${this.data.orderId}/cancel`, { cancelReason: reason });
      wx.hideLoading();
      wx.showToast({ title: '订单已取消', icon: 'success' });
      this.loadDetail();
      this.loadTimeline();
    } catch (e) {
      wx.hideLoading();
      console.error('取消订单失败', e);
      wx.showToast({ title: '取消失败，请重试', icon: 'none' });
    } finally {
      this._canceling = false;
    }
  },

  isMyAttendant(): boolean {
    const order = this.data.order;
    if (!order.attendant) return false;
    const attendantUserId = order.attendant.userId || order.attendant.user_id;
    return String(this.data.currentUserId) === String(attendantUserId);
  },
});

