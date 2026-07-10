import { get, post, put } from '../../../utils/request';
import { parseTimelineTranscription } from '../../../utils/timeline-transcription';

import { BASE_URL } from '../../../config';
import { resolvePublicUrl } from '../../../utils/media-url';
import { ensureAttendantPageAccess } from '../../../utils/identity';
import { evaluateCompletionData } from '../../../utils/completion';
import { callStore as callStorePhone } from '../../../utils/storeInfo';

const STATUS_MAP: Record<string, string> = {
  pending_accept: '待接单',
  pending_sign: '待签到',
  pending_service: '待服务',
  in_progress: '进行中',
  emergency: '紧急处置',
  completed: '已完成',
  pending_review: '服务已结束',
  canceled: '已取消',
};

const NAV_TITLE_MAP: Record<string, string> = {
  pending_sign: '待签到',
  pending_service: '待服务',
  in_progress: '服务进行中',
  emergency: '紧急处置中',
  completed: '服务已完成',
  pending_review: '服务已结束',
  canceled: '已取消',
};

const TYPE_MAP: Record<string, string> = {
  text: '文字记录',
  image: '照片',
  node: '状态节点',
  audio_question: '问诊录音',
  audio_advice: '医嘱录音',
  file: '文件',
  internal_note: '内部备注',
};

const TIMELINE_TYPES = [
  { value: 'text', label: '文字记录' },
  { value: 'image', label: '照片' },
  { value: 'node', label: '状态节点' },
  { value: 'audio_question', label: '问诊录音' },
  { value: 'audio_advice', label: '医嘱录音' },
  { value: 'file', label: '文件' },
  { value: 'internal_note', label: '内部备注' },
];

/** 文字记录下可一键填入时间线的常用节点（可按需扩展） */
const TEXT_QUICK_PHRASES = [
  '到医院了',
  '接到患者了',
  '排队候诊中',
  '就诊/检查中',
  '取药或办手续中',
  '回程路上',
  '已送患者上车',
  '服务节点结束',
];

const AUDIO_MESSAGE_FILE_EXTENSIONS = ['mp3', 'm4a', 'wav', 'aac', 'amr'];
const ATTACHMENT_MESSAGE_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

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

/** 录音参数：完整（与 ai-consult 一致）；热重置时用极简参数规避部分真机编码/码率不兼容 */
const RECORDER_OPTIONS_FULL: WechatMiniprogram.RecorderManagerStartOption = {
  duration: 600000,
  sampleRate: 16000,
  numberOfChannels: 1,
  format: 'aac',
};
const RECORDER_OPTIONS_MINIMAL: WechatMiniprogram.RecorderManagerStartOption = {
  duration: 600000,
  format: 'aac',
};

Page({
  _recorderManager: null as any,
  _recordingTimer: null as any,
  _recordingSeconds: 0,
  /** 防连点：两次 start 会导致 operateRecorder:fail */
  _recordStarting: false,
  /** 为复位录音器调用 stop() 时忽略本次 onStop，避免误清空/误 Toast */
  _recordSuppressStopUi: false,
  /** onError / 占用后下次开始前先 stop + 延迟再 start */
  _recordNeedsWarmReset: false,
  _previewAudio: null as any,
  _timelineAudio: null as any,
  _attendantLocationTimer: null as ReturnType<typeof setInterval> | null,
  /** 本页仅提示一次定位权限问题，避免定时上报时反复 Toast */
  _locationDeniedHintShown: false,

  data: {
    statusBarHeight: 20,
    orderId: '',
    order: {} as any,
    timelines: [] as any[],
    publishContent: '',
    publishImages: [] as string[],
    publishFiles: [] as string[],
    publishType: 'text',
    textQuickPhrases: TEXT_QUICK_PHRASES,
    timelineTypes: TIMELINE_TYPES,
    publishing: false,
    notifyFamily: true,
    // 录音相关
    publishAudio: null as null | { path: string; name: string; durationText: string },
    isRecording: false,
    recordingTimeText: '00:00',
    audioPreviewPlaying: false,
    // 时间线音频播放
    playingAudioId: '',
    /** 正在编辑转写的时间线条目 id，0 表示未编辑 */
    transcriptionEditingId: 0,
    transcriptionDraft: '',
    transcriptionSaving: false,
    /** 履约中健康档案与紧急联系人（/orders/:id/health-profile） */
    attendantHealthBundle: {
      loaded: false,
      lines: [] as { label: string; value: string }[],
      emergencyContact: '',
      emergencyRelation: '',
      emergencyPhone: '',
      locked: false,
      error: false,
    },
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    const orderId = options.orderId || options.id || '';
    this.setData({ orderId });
  },

  onShow() {
    if (!ensureAttendantPageAccess()) return;
    if (this.data.orderId) {
      this.loadOrder();
      this.loadTimelines();
    }
  },

  onHide() {
    this.stopAttendantLocationPush();
  },

  onUnload() {
    this.stopAttendantLocationPush();
    if (this._recordingTimer) clearInterval(this._recordingTimer);
    if (this._recorderManager) { try { this._recorderManager.stop(); } catch (_) {} }
    if (this._previewAudio) { try { this._previewAudio.destroy(); } catch (_) {} }
    if (this._timelineAudio) { try { this._timelineAudio.destroy(); } catch (_) {} }
  },

  stopAttendantLocationPush() {
    if (this._attendantLocationTimer) {
      clearInterval(this._attendantLocationTimer);
      this._attendantLocationTimer = null;
    }
  },

  /**
   * 陪诊员侧定时上报 GCJ-02 坐标；需在 app.json 声明 requiredPrivateInfos: getLocation，
   * 并在微信公众平台配置用户隐私保护指引。
   */
  pushAttendantLocationOnce() {
    const orderId = this.data.orderId;
    const st = this.data.order?.status;
    if (!orderId || (st !== 'in_progress' && st !== 'emergency')) return;
    try { wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      success: async (loc) => {
        try {
          await put(
            `/orders/${orderId}/attendant-live-location`,
            { latitude: loc.latitude, longitude: loc.longitude },
            { silent: true },
          );
        } catch (e) {
          console.log('陪诊员上报位置失败', e);
        }
      },
      fail: (err) => {
        if (!this._locationDeniedHintShown) {
          this._locationDeniedHintShown = true;
          const msg = String((err as WechatMiniprogram.GeneralCallbackResult)?.errMsg || '');
          if (msg.includes('auth deny') || msg.includes('privacy') || msg.includes('permission')) {
            wx.showToast({
              title: '请允许位置权限，客户与后台才能看到实时位置',
              icon: 'none',
              duration: 3500,
            });
          }
        }
      },
    });
    } catch (_) { /* getLocation not available */ }
  },

  startAttendantLocationPush() {
    this.stopAttendantLocationPush();
    const st = this.data.order?.status;
    if (st !== 'in_progress' && st !== 'emergency') return;
    this._locationDeniedHintShown = false;
    void this.pushAttendantLocationOnce();
    this._attendantLocationTimer = setInterval(() => {
      void this.pushAttendantLocationOnce();
    }, 60000);
  },

  goBack() {
    wx.navigateBack();
  },

  async loadOrder() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}`);
      const serviceTime = res.serviceTime || res.serviceStartTime || '';
      const completion = evaluateCompletionData(res.completionData);
      const isPendingReview = res.status === 'pending_review';
      const isCompleted = res.status === 'completed';
      const statusText = isPendingReview
        ? (completion.ready ? '服务已结束' : '待补资料')
        : (!completion.ready && isCompleted ? '资料未补' : (STATUS_MAP[res.status] || res.status));
      const navTitle = isPendingReview
        ? (completion.ready ? '服务已结束' : '待补资料')
        : (!completion.ready && isCompleted ? '补录完成资料' : (NAV_TITLE_MAP[res.status] || '服务详情'));
      const isActiveService = res.status === 'in_progress' || res.status === 'emergency';
      const showCompletionCard =
        isActiveService || isPendingReview || (!completion.ready && isCompleted);
      const riskCode = String(res.riskLevelCode || res.riskLevel || '').toUpperCase();
      let riskBand = 'low';
      if (riskCode === 'R3') riskBand = 'high';
      else if (riskCode === 'R2' || riskCode === 'L2') riskBand = 'mid';
      else if (riskCode === 'R1') riskBand = 'mid';

      const sopProgress = ((res.completionData || {}) as any).sopProgress || {};
      const sopSteps: any[] = Array.isArray(res.professionalService?.sopSteps)
        ? res.professionalService.sopSteps.map((step: any, idx: number) => ({
            index: idx,
            title: step?.title || `步骤 ${idx + 1}`,
            description: step?.description || '',
            durationMin: step?.durationMin || null,
            checklistItems: step?.checklistItems || [],
            checked: !!sopProgress[idx]?.checked,
            checkedAt: sopProgress[idx]?.checkedAt || null,
          }))
        : [];
      const sopStepsTotal = sopSteps.length;
      const sopStepsDone = sopSteps.filter((s: any) => s.checked).length;
      const sopProgressPercent = sopStepsTotal > 0
        ? Math.round((sopStepsDone / sopStepsTotal) * 100)
        : 0;

      const order = {
        ...res,
        riskBand,
        statusText,
        navTitle,
        isActiveService,
        isCompleted: isCompleted || isPendingReview,
        showPendingCard: res.status === 'pending_sign' || res.status === 'pending_service',
        showAttendantCareBlock: [
          'pending_sign',
          'pending_accept',
          'pending_service',
          'in_progress',
          'emergency',
          'pending_review',
        ].includes(res.status),
        sopSteps,
        sopStepsTotal,
        sopStepsDone,
        sopProgressPercent,
        sopServiceName: res.professionalService?.name || '',
        sopServiceIcon: res.professionalService?.icon || 'medical_services',
        canStartService: res.status === 'pending_service',
        serviceTime: this.formatTime(serviceTime, res.serviceEndTime),
        serviceTimeFull: this.formatServiceTimeFull(serviceTime),
        patientName: res.serviceTarget?.name || res.patientName || '***',
        hospital: res.hospital || res.serviceTarget?.hospital || '',
        department: res.department || '',
        address: res.serviceAddress || res.address || res.serviceTarget?.address || '',
        completionReady: completion.ready,
        completionReadyCount: completion.readyCount,
        completionPendingCount: Math.max(0, 3 - completion.readyCount),
        completionMissingText: completion.missingItems.join('、'),
        completionChecklist: {
          summaryReady: completion.summaryReady,
          proofReady: completion.proofReady,
          medicationReady: completion.medicationReady,
        },
        showCompletionCard,
        completionCardTitle:
          isActiveService
            ? (completion.ready ? '资料已齐，可提交结束' : '结束前请补齐资料')
            : isPendingReview
              ? (completion.ready ? '服务已结束' : '完成资料待补')
              : '补录完成资料',
        completionCardSub:
          isActiveService
            ? (completion.ready ? '' : `进度 ${completion.readyCount}/3`)
            : isPendingReview
              ? (completion.ready ? '' : (completion.missingItems.length ? `缺：${completion.missingItems.join('、')}` : ''))
              : (completion.missingItems.length ? `缺：${completion.missingItems.join('、')}` : ''),
        completionCardBadge:
          isActiveService
            ? (completion.ready ? '可提交' : '待补')
            : isPendingReview
              ? (completion.ready ? '已结束' : '待补')
              : '补录',
        completionButtonText:
          isActiveService
            ? (completion.ready ? '确认并提交资料' : '去填写资料')
            : (completion.ready ? '查看资料' : '继续补填'),
      };
      this.setData({ order });
      if (isActiveService) {
        this.startAttendantLocationPush();
      } else {
        this.stopAttendantLocationPush();
      }
      await this.loadAttendantHealthProfile();
    } catch (e) {
      console.log('加载订单信息失败', e);
    }
  },

  async loadAttendantHealthProfile() {
    const st = this.data.order?.status;
    if (
      !this.data.orderId ||
      ![
        'pending_sign',
        'pending_accept',
        'pending_service',
        'in_progress',
        'emergency',
        'pending_review',
      ].includes(st)
    ) {
      this.setData({
        attendantHealthBundle: {
          loaded: false,
          lines: [],
          emergencyContact: '',
          emergencyRelation: '',
          emergencyPhone: '',
          locked: false,
          error: false,
        },
      });
      return;
    }
    try {
      const h: any = await get(`/orders/${this.data.orderId}/health-profile`);
      this.setData({
        attendantHealthBundle: {
          loaded: true,
          lines: Array.isArray(h.healthSummaryLines) ? h.healthSummaryLines : [],
          emergencyContact: h.emergencyContact || '',
          emergencyRelation: h.emergencyRelation || '',
          emergencyPhone: h.emergencyPhone || '',
          locked: !!h.healthSummaryLocked,
          error: false,
        },
      });
    } catch {
      this.setData({
        attendantHealthBundle: {
          loaded: true,
          lines: [],
          emergencyContact: '',
          emergencyRelation: '',
          emergencyPhone: '',
          locked: false,
          error: true,
        },
      });
    }
  },

  callPatient() {
    const phone = (this.data.order.serviceTarget?.phone || this.data.order.contactPhone || '').replace(/\D/g, '');
    if (phone && phone.length >= 7) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
    }
  },

  openFullHealthCard() {
    const id = this.data.orderId;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/health-card/health-card?orderId=${id}&from=attendant`,
    });
  },

  onRetryHealthProfile() {
    void this.loadAttendantHealthProfile();
  },

  /** 紧急联系人拨号号码：优先健康档案接口明文，其次订单上家属/服务对象电话 */
  getEmergencyDialNumber(): string {
    const norm = (s: string) => String(s || '').replace(/\D/g, '');
    const fromBundle = norm(this.data.attendantHealthBundle.emergencyPhone);
    if (fromBundle.length >= 7) return fromBundle;
    const o = this.data.order;
    const fallback =
      norm(o?.serviceTarget?.emergencyPhone) ||
      norm(o?.serviceTarget?.phone) ||
      norm(o?.familyPhone) ||
      '';
    return fallback.length >= 7 ? fallback : '';
  },

  async loadTimelines() {
    try {
      const res: any = await get(`/timelines/order/${this.data.orderId}`, { includeInternal: true });
      const timelines = (res.items || res || []).map((item: any) => ({
        ...item,
        typeLabel: TYPE_MAP[item.type] || item.type,
        images: getTimelineImages(item),
        audioUrls: getTimelineAudioUrls(item),
        files: getTimelineDocumentFiles(item),
        createdAtText: this.formatDateTime(item.createdAt),
        transcription: parseTimelineTranscription(item),
      }));
      this.setData({ timelines });
    } catch (e) {
      console.log('加载时间线失败', e);
    }
  },

  onPublishInput(e: any) {
    this.setData({ publishContent: e.detail.value });
  },

  insertQuickPhrase(e: any) {
    const phrase = e.currentTarget?.dataset?.phrase as string | undefined;
    if (!phrase) return;
    const max = 500;
    const cur = String(this.data.publishContent || '');
    const sep = cur.length === 0 ? '' : cur.endsWith('\n') ? '' : '\n';
    const next = `${cur}${sep}${phrase}`;
    if (next.length > max) {
      wx.showToast({ title: '内容已达上限，可先发布再记', icon: 'none' });
      return;
    }
    this.setData({ publishContent: next });
  },

  selectType(e: any) {
    const val = e.currentTarget.dataset.value;
    this.setData({ publishType: val });
    // 切换到非录音类型时，清除已选录音
    if (val !== 'audio_question' && val !== 'audio_advice') {
      this._stopPreviewAudio();
      this.setData({ publishAudio: null, isRecording: false, recordingTimeText: '00:00' });
      if (this._recordingTimer) { clearInterval(this._recordingTimer); this._recordingTimer = null; }
      if (this._recorderManager) { try { this._recorderManager.stop(); } catch (_) {} }
    }
  },

  /**
   * 切换 SOP 步骤的勾选状态。点击即本地即时反馈 + 后台持久化，
   * 保存失败时回滚并提示。
   */
  async toggleSopStep(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    const steps = (this.data.order?.sopSteps || []) as any[];
    const step = steps[idx];
    if (!step) return;
    const nextChecked = !step.checked;
    // 乐观更新：先改本地 UI
    const updatedSteps = steps.map((s: any, i: number) =>
      i === idx ? { ...s, checked: nextChecked, checkedAt: nextChecked ? new Date().toISOString() : null } : s,
    );
    const done = updatedSteps.filter((s: any) => s.checked).length;
    const percent = updatedSteps.length > 0 ? Math.round((done / updatedSteps.length) * 100) : 0;
    this.setData({
      'order.sopSteps': updatedSteps,
      'order.sopStepsDone': done,
      'order.sopProgressPercent': percent,
    });
    try {
      await post(`/orders/${this.data.orderId}/sop-progress`, {
        progress: [{ stepIndex: idx, checked: nextChecked }],
      });
    } catch (err) {
      // 失败回滚
      this.setData({
        'order.sopSteps': steps,
        'order.sopStepsDone': steps.filter((s: any) => s.checked).length,
        'order.sopProgressPercent': steps.length > 0
          ? Math.round((steps.filter((s: any) => s.checked).length / steps.length) * 100)
          : 0,
      });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  /**
   * 底部「处方」按钮：跳到处方上传页并带当前订单 ID，
   * 让陪诊员在服务过程中随时把处方拍下来进待审队列。
   */
  goPrescriptionUpload() {
    const orderId = this.data.orderId;
    wx.navigateTo({
      url: `/pages/workbench/prescription-upload/prescription-upload?orderId=${orderId || ''}`,
    });
  },

  /** 底部「录音」：已在问诊/医嘱类型则不切换；否则让用户选问诊或医嘱 */
  selectAudioTypeFromBottomBar() {
    const t = this.data.publishType;
    if (t === 'audio_question' || t === 'audio_advice') {
      this.selectType({ currentTarget: { dataset: { value: t } } } as any);
      return;
    }
    wx.showActionSheet({
      itemList: ['问诊录音', '医嘱录音'],
      success: (res) => {
        const val = res.tapIndex === 0 ? 'audio_question' : 'audio_advice';
        this.selectType({ currentTarget: { dataset: { value: val } } } as any);
      },
    });
  },

  // ── 录音 ──────────────────────────────────────────────
  /** 与 ai-consult 一致：先读授权状态，拒绝过则引导 openSetting，避免 authorize 静默失败 */
  ensureRecordAuth(cb: () => void) {
    wx.getSetting({
      success: (s) => {
        if (s.authSetting['scope.record']) {
          cb();
          return;
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => cb(),
          fail: () => {
            wx.showModal({
              title: '需要录音权限',
              content: '请在设置中开启麦克风，以便录制问诊/医嘱录音',
              confirmText: '去设置',
              success: (m) => {
                if (m.confirm) wx.openSetting({});
              },
            });
          },
        });
      },
    });
  },

  startRecording() {
    this.ensureRecordAuth(() => this._doStartRecording());
  },

  _ensureRecorderManager() {
    if (this._recorderManager) return;
    this._recorderManager = wx.getRecorderManager();
    this._recorderManager.onStop((res: any) => {
      clearInterval(this._recordingTimer);
      this._recordingTimer = null;
      const wasUiRecording = this.data.isRecording;
      const path = String(res.tempFilePath || '');
      if (this._recordSuppressStopUi) {
        this.setData({ isRecording: false, recordingTimeText: '00:00' });
        return;
      }
      const dur = Math.round((res.duration || 0) / 1000);
      const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '.aac';
      const name = `录音_${Date.now()}${ext}`;
      const patch: Record<string, unknown> = {
        isRecording: false,
        recordingTimeText: '00:00',
      };
      if (path) {
        patch.publishAudio = { path, name, durationText: this._fmtSec(dur) };
      } else if (wasUiRecording) {
        patch.publishAudio = null;
      }
      this.setData(patch as any);
      if (!path && wasUiRecording) {
        wx.showToast({ title: '未生成录音文件，请重试', icon: 'none' });
      }
    });
    this._recorderManager.onError((err: any) => {
      console.error('[service-timeline] RecorderManager error', err);
      clearInterval(this._recordingTimer);
      this._recordingTimer = null;
      this.setData({ isRecording: false, recordingTimeText: '00:00' });
      const msg = String(err?.errMsg || err?.message || '');
      if (msg.includes('permission') || msg.includes('auth') || msg.includes('authorize')) {
        wx.showToast({ title: '麦克风权限受限，请在设置中开启', icon: 'none' });
        return;
      }
      // 占用 / 系统拒绝音频流
      if (
        msg.includes('running')
        || msg.includes('busy')
        || msg.includes('NotReadable')
        || msg.includes('not readable')
        || msg.includes('interrupted')
        || msg.includes('中断')
      ) {
        this._recordNeedsWarmReset = true;
        wx.showToast({ title: '录音被占用，请稍后重试', icon: 'none' });
        return;
      }
      // 状态异常：尽快 stop 一次再 start，否则下次会一直 operateRecorder:fail
      if (
        msg.includes('operateRecorder:fail')
        || msg.includes('not start')
        || msg.includes('already')
        || msg.includes('正在录音')
      ) {
        this._recordNeedsWarmReset = true;
      }
      wx.showToast({ title: '录音失败，请重试', icon: 'none' });
    });
    if (typeof (this._recorderManager as any).onInterruptionBegin === 'function') {
      (this._recorderManager as any).onInterruptionBegin(() => {
        this._recordNeedsWarmReset = true;
        clearInterval(this._recordingTimer);
        this._recordingTimer = null;
        this.setData({ isRecording: false, recordingTimeText: '00:00' });
        wx.showToast({ title: '录音被中断，请重新开始', icon: 'none' });
      });
    }
  },

  _releaseRecordStartLock() {
    this._recordStarting = false;
  },

  _beginRecordingUiAfterNativeStart() {
    this._recordingSeconds = 0;
    this.setData({ isRecording: true, recordingTimeText: '00:00' });
    this._recordingTimer = setInterval(() => {
      this._recordingSeconds += 1;
      this.setData({ recordingTimeText: this._fmtSec(this._recordingSeconds) });
    }, 1000);
  },

  _doStartRecording() {
    if (this._recordStarting) return;
    if (this.data.isRecording) {
      wx.showToast({ title: '正在录音中', icon: 'none' });
      return;
    }
    this._recordStarting = true;

    // 与其它音频抢占会话时，RecorderManager 易报错；先停本地预览与时间线播放
    this._stopPreviewAudio();
    if (this._timelineAudio) {
      try {
        this._timelineAudio.stop();
        this._timelineAudio.destroy();
      } catch (_) {}
      this._timelineAudio = null;
    }
    this.setData({ playingAudioId: '', audioPreviewPlaying: false });

    this._ensureRecorderManager();

    const startWithOptions = (opts: WechatMiniprogram.RecorderManagerStartOption) => {
      try {
        this._recorderManager.start(opts);
      } catch (e) {
        console.error('[service-timeline] recorder.start failed', e);
        wx.showToast({ title: '无法开始录音，请重试', icon: 'none' });
        this._recordNeedsWarmReset = true;
        this._releaseRecordStartLock();
        return false;
      }
      return true;
    };

    const afterAudioTeardown = () => {
      const needReset = this._recordNeedsWarmReset;
      if (needReset) {
        this._recordNeedsWarmReset = false;
        this._recordSuppressStopUi = true;
        try {
          this._recorderManager.stop();
        } catch (_) {}
        setTimeout(() => {
          this._recordSuppressStopUi = false;
          // 热重置后用更保守的参数，减少部分 Android 机型编码失败
          if (!startWithOptions(RECORDER_OPTIONS_MINIMAL)) return;
          this._beginRecordingUiAfterNativeStart();
          this._releaseRecordStartLock();
        }, 160);
        return;
      }
      // 刚释放其它音频后极短延迟，降低部分真机上「连点 / 会话未释放」的失败率
      setTimeout(() => {
        if (!startWithOptions(RECORDER_OPTIONS_FULL)) return;
        this._beginRecordingUiAfterNativeStart();
        this._releaseRecordStartLock();
      }, 48);
    };

    afterAudioTeardown();
  },

  stopRecording() {
    if (this._recorderManager) this._recorderManager.stop();
  },

  showLocalFileGuide(e?: any) {
    const kind = e?.currentTarget?.dataset?.kind === 'audio' ? 'audio' : 'file';
    const content = kind === 'audio'
      ? '微信小程序暂不支持直接浏览手机本地音频文件。若要导入手机里的音频，请先发送到微信聊天或文件传输助手，再点“导入音频”；也可以直接点击“开始录音”。'
      : '微信小程序暂不支持直接浏览手机本地文档。若要导入手机里的附件，请先发送到微信聊天或文件传输助手，再点“导入附件”。';
    wx.showModal({
      title: '导入说明',
      content,
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  pickMessageFiles(options: {
    count: number;
    extensions: string[];
    kind: 'audio' | 'file';
    onSuccess: (files: any[]) => void;
  }) {
    wx.chooseMessageFile({
      count: options.count,
      type: 'file',
      extension: options.extensions,
      success: (res) => {
        const files = Array.isArray(res.tempFiles) ? res.tempFiles : [];
        if (!files.length) {
          wx.showToast({ title: '未选择文件', icon: 'none' });
          return;
        }
        options.onSuccess(files);
      },
      fail: (err: any) => {
        const errMsg = String(err?.errMsg || '');
        if (errMsg.includes('cancel')) return;
        this.showLocalFileGuide({ currentTarget: { dataset: { kind: options.kind } } });
      },
    });
  },

  chooseAudioFile() {
    this.pickMessageFiles({
      count: 1,
      extensions: AUDIO_MESSAGE_FILE_EXTENSIONS,
      kind: 'audio',
      onSuccess: (files) => {
        const file = files[0];
        const dur = file?.duration ? Math.round(file.duration / 1000) : 0;
        this.setData({
          publishAudio: {
            path: file.path,
            name: file.name || `录音_${Date.now()}`,
            durationText: dur ? this._fmtSec(dur) : '--',
          },
        });
      },
    });
  },

  removeAudio() {
    this._stopPreviewAudio();
    this.setData({ publishAudio: null, audioPreviewPlaying: false });
  },

  toggleAudioPreview() {
    const audio = this.data.publishAudio;
    if (!audio) return;
    if (!this._previewAudio) {
      this._previewAudio = wx.createInnerAudioContext();
      this._previewAudio.onEnded(() => { this.setData({ audioPreviewPlaying: false }); });
      this._previewAudio.onStop(() => { this.setData({ audioPreviewPlaying: false }); });
      this._previewAudio.onError(() => { this.setData({ audioPreviewPlaying: false }); });
    }
    if (this.data.audioPreviewPlaying) {
      this._previewAudio.pause();
      this.setData({ audioPreviewPlaying: false });
    } else {
      this._previewAudio.src = audio.path;
      this._previewAudio.play();
      this.setData({ audioPreviewPlaying: true });
    }
  },

  _stopPreviewAudio() {
    if (this._previewAudio) { try { this._previewAudio.stop(); } catch (_) {} }
  },

  // ── 时间线音频播放 ────────────────────────────────────
  playTimelineAudio(e: any) {
    const { url, itemId, idx } = e.currentTarget.dataset;
    const fullUrl = resolveTimelineAssetUrl(url);
    if (!fullUrl) {
      wx.showToast({ title: '录音地址无效', icon: 'none' });
      return;
    }
    const audioId = `${itemId}_${idx}`;

    if (this.data.playingAudioId === audioId) {
      if (this._timelineAudio) { try { this._timelineAudio.stop(); } catch (_) {} }
      this.setData({ playingAudioId: '' });
      return;
    }

    if (this._timelineAudio) { try { this._timelineAudio.stop(); this._timelineAudio.destroy(); } catch (_) {} }
    this._timelineAudio = wx.createInnerAudioContext();
    this._timelineAudio.src = fullUrl;
    this._timelineAudio.onPlay(() => this.setData({ playingAudioId: audioId }));
    this._timelineAudio.onEnded(() => this.setData({ playingAudioId: '' }));
    this._timelineAudio.onStop(() => this.setData({ playingAudioId: '' }));
    this._timelineAudio.onError((err: any) => {
      console.log('音频播放失败', err);
      this.setData({ playingAudioId: '' });
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
    this._timelineAudio.play();
  },

  _fmtSec(s: number): string {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  },

  chooseImage() {
    const remaining = 9 - this.data.publishImages.length;
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map((f: any) => f.tempFilePath);
        this.setData({
          publishImages: [...this.data.publishImages, ...newImages],
        });
      },
    });
  },

  chooseFile() {
    this.pickMessageFiles({
      count: 5,
      extensions: ATTACHMENT_MESSAGE_FILE_EXTENSIONS,
      kind: 'file',
      onSuccess: (tempFiles) => {
        const files = tempFiles.map((f: any) => f.path);
        this.setData({
          publishFiles: [...this.data.publishFiles, ...files].slice(0, 5),
        });
      },
    });
  },

  removeImage(e: any) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.publishImages];
    images.splice(index, 1);
    this.setData({ publishImages: images });
  },

  removeFile(e: any) {
    const index = e.currentTarget.dataset.index;
    const files = [...this.data.publishFiles];
    files.splice(index, 1);
    this.setData({ publishFiles: files });
  },

  previewImage(e: any) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({ current: url, urls });
  },

  startEditTranscription(e: any) {
    const id = Number(e?.currentTarget?.dataset?.id || 0);
    if (!id) return;
    const item = this.data.timelines.find((t: any) => Number(t.id) === id);
    const tx = item?.transcription;
    this.setData({
      transcriptionEditingId: id,
      transcriptionDraft: tx?.text ? String(tx.text) : '',
    });
  },

  cancelEditTranscription() {
    this.setData({ transcriptionEditingId: 0, transcriptionDraft: '' });
  },

  onTranscriptionDraftInput(e: any) {
    this.setData({ transcriptionDraft: e.detail.value });
  },

  async saveTranscription() {
    const id = this.data.transcriptionEditingId;
    if (!id) return;
    if (this.data.transcriptionSaving) return;
    this.setData({ transcriptionSaving: true });
    try {
      await put(`/timelines/${id}/transcription`, { text: this.data.transcriptionDraft || '' });
      wx.showToast({ title: '转写已保存', icon: 'success' });
      this.setData({ transcriptionEditingId: 0, transcriptionDraft: '' });
      await this.loadTimelines();
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ transcriptionSaving: false });
    }
  },

  openAttachment(e: any) {
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

  toggleNotifyFamily() {
    this.setData({ notifyFamily: !this.data.notifyFamily });
  },

  async submitTimeline() {
    const { publishContent, publishImages, publishFiles, publishType, orderId, publishAudio } = this.data;
    const isAudioType = publishType === 'audio_question' || publishType === 'audio_advice';

    if (!publishContent.trim() && publishImages.length === 0 && publishFiles.length === 0 && !publishAudio) {
      wx.showToast({ title: '请输入内容或添加附件', icon: 'none' });
      return;
    }
    if (isAudioType && !publishAudio) {
      wx.showToast({ title: '请先录音或选择音频文件', icon: 'none' });
      return;
    }

    this.setData({ publishing: true });
    try {
      let imageUrls: string[] = [];
      let fileUrls: string[] = [];
      if (publishImages.length > 0) {
        imageUrls = await this.uploadImages(publishImages);
      }
      if (publishFiles.length > 0) {
        fileUrls = await this.uploadImages(publishFiles);
      }
      if (publishAudio) {
        const audioUrls = await this.uploadImages([publishAudio.path]);
        fileUrls = [...fileUrls, ...audioUrls];
      }

      const requestTypeMap: Record<string, string> = {
        text: 'text',
        image: 'image',
        node: 'node',
        audio_question: 'audio_question',
        audio_advice: 'audio_advice',
        file: 'file',
        internal_note: 'text',
      };
      const timelineType = requestTypeMap[publishType] || 'text';
      const visibleToUser = publishType === 'internal_note' ? false : undefined;

      const shouldNotify = this.data.notifyFamily && publishType !== 'internal_note';
      await post('/timelines', {
        orderId: Number(orderId),
        type: timelineType,
        content: publishContent,
        metadata: {
          ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
          ...(fileUrls.length > 0 ? { files: fileUrls } : {}),
        },
        visibleToUser,
        notifyFamily: shouldNotify,
      });

      this._stopPreviewAudio();
      this.setData({
        publishContent: '',
        publishImages: [],
        publishFiles: [],
        publishType: 'text',
        publishAudio: null,
        audioPreviewPlaying: false,
      });
      wx.showToast({ title: '发布成功', icon: 'success' });
      this.loadTimelines();
    } catch (e) {
      wx.showToast({ title: '发布失败，请重试', icon: 'none' });
    } finally {
      this.setData({ publishing: false });
    }
  },

  async uploadImages(paths: string[]): Promise<string[]> {
    const urls: string[] = [];
    for (const path of paths) {
      try {
        const url: string = await new Promise((resolve, reject) => {
          const token = wx.getStorageSync('token');
          wx.uploadFile({
            url: `${BASE_URL}/documents/raw-upload`,
            filePath: path,
            name: 'file',
            header: { Authorization: token ? `Bearer ${token}` : '' },
            success(res) {
              const data = JSON.parse(res.data);
              resolve(data.data?.url || data.url);
            },
            fail: reject,
          });
        });
        urls.push(url);
      } catch (e) {
        console.log('上传图片失败', e);
      }
    }
    return urls;
  },

  async handleStartService() {
    const res = await new Promise<any>((resolve) => {
      wx.showModal({
        title: '服务开始',
        content: '确认开始服务打卡？',
        success: resolve,
      });
    });
    if (!res.confirm) return;

    wx.showLoading({ title: '打卡中...' });
    try {
      await put(`/orders/${this.data.orderId}/start`);
      wx.hideLoading();
      wx.showToast({ title: '已开始服务', icon: 'success' });
      this.loadOrder();
      this.loadTimelines();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '打卡失败', icon: 'none' });
    }
  },

  async handleFinishService() {
    const status = this.data.order.status;
    if (status !== 'in_progress' && status !== 'emergency') {
      wx.navigateTo({
        url: `/pages/workbench/completion-form/completion-form?orderId=${this.data.orderId}`,
      });
      return;
    }
    const ready = !!this.data.order.completionReady;
    const res = await new Promise<any>((resolve) => {
      wx.showModal({
        title: ready ? '确认完成资料' : '先补齐完成资料',
        content: ready
          ? '完成资料已经补齐。请前往完成资料页做最后确认，提交后系统才会结束当前订单。'
          : `当前还缺：${this.data.order.completionMissingText || '服务总结、报告单据凭证、用药提醒确认'}。请先填写完成资料，补齐后才能结束订单。`,
        confirmText: ready ? '去确认' : '去填写',
        confirmColor: ready ? '#2f9b42' : '#a16207',
        success: resolve,
      });
    });
    if (!res.confirm) return;
    wx.navigateTo({
      url: `/pages/workbench/completion-form/completion-form?orderId=${this.data.orderId}`,
    });
  },

  handleEmergency() {
    const st = this.data.order?.status;
    const oid = this.data.orderId;

    if (st === 'emergency') {
      wx.showActionSheet({
        itemList: ['退出紧急模式（恢复进行中）', '联系门店', '联系紧急联系人'],
        success: (sheet) => {
          if (sheet.tapIndex === 0) {
            wx.showModal({
              title: '退出紧急模式',
              content: '确认后订单将恢复为「服务进行中」，可继续正常履约与记录。',
              confirmText: '确认退出',
              cancelText: '取消',
              success: (m) => {
                if (!m.confirm) return;
                void put(`/orders/${oid}/emergency`, { action: 'clear' })
                  .then(() => {
                    wx.showToast({ title: '已恢复正常服务', icon: 'success' });
                    this.loadOrder();
                  })
                  .catch((e: any) =>
                    wx.showToast({ title: e?.message || '操作失败', icon: 'none' }),
                  );
              },
            });
            return;
          }
          if (sheet.tapIndex === 1) {
            void callStorePhone();
            return;
          }
          if (sheet.tapIndex === 2) {
            const phone = this.getEmergencyDialNumber();
            if (!phone) {
              wx.showToast({ title: '未登记紧急联系人电话', icon: 'none' });
              return;
            }
            wx.makePhoneCall({ phoneNumber: phone });
          }
        },
      });
      return;
    }

    if (st !== 'in_progress') return;

    wx.showModal({
      title: '进入紧急模式',
      content:
        '请确认确有紧急情况。下一步将选择联系门店或紧急联系人，选择后系统会通知后台并进入紧急模式。',
      confirmText: '确认',
      cancelText: '取消',
      success: (modal) => {
        if (!modal.confirm) return;
        wx.showActionSheet({
          itemList: ['联系门店', '联系紧急联系人'],
          success: (sheet) => {
            if (sheet.tapIndex === 0) {
              void put(`/orders/${oid}/emergency`, {
                action: 'activate',
                channel: 'store',
              })
                .then(() => {
                  wx.showToast({ title: '已进入紧急模式', icon: 'success' });
                  this.loadOrder();
                  void callStorePhone();
                })
                .catch((e: any) =>
                  wx.showToast({ title: e?.message || '进入紧急模式失败', icon: 'none' }),
                );
              return;
            }
            if (sheet.tapIndex === 1) {
              const phone = this.getEmergencyDialNumber();
              if (!phone) {
                wx.showToast({ title: '未登记紧急联系人电话，无法进入紧急流程', icon: 'none' });
                return;
              }
              void put(`/orders/${oid}/emergency`, {
                action: 'activate',
                channel: 'family',
              })
                .then(() => {
                  wx.showToast({ title: '已进入紧急模式', icon: 'success' });
                  this.loadOrder();
                  wx.makePhoneCall({ phoneNumber: phone });
                })
                .catch((e: any) =>
                  wx.showToast({ title: e?.message || '进入紧急模式失败', icon: 'none' }),
                );
            }
          },
        });
      },
    });
  },

  formatServiceTimeFull(start: string): string {
    if (!start) return '待定';
    const s = new Date(start);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${s.getMonth() + 1}月${s.getDate()}日\n${pad(s.getHours())}:${pad(s.getMinutes())}`;
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

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
});
