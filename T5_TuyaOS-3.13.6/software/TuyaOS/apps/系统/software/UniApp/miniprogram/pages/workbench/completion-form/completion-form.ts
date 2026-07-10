import { get, post, put } from '../../../utils/request';
import { BASE_URL } from '../../../config';
import { ensureAttendantPageAccess } from '../../../utils/identity';
import {
  evaluateCompletionData,
  getCompletionFileName,
  normalizeCompletionFiles,
} from '../../../utils/completion';
import { requestSubscribe } from '../../../utils/subscribe';

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

const COMPLETION_IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;

function isCompletionProofImage(name: string, path: string): boolean {
  return COMPLETION_IMAGE_RE.test(name || '') || COMPLETION_IMAGE_RE.test(path || '');
}

function buildTimelineBreakdown(items: any[]): string {
  const LABEL: Record<string, string> = {
    text: '文字',
    image: '照片',
    node: '节点',
    audio_question: '问诊录音',
    audio_advice: '医嘱录音',
    file: '文件',
    internal_note: '内部备注',
    emergency: '紧急',
  };
  const counts: Record<string, number> = {};
  for (const i of items || []) {
    const k = i.type || 'other';
    counts[k] = (counts[k] || 0) + 1;
  }
  const parts = Object.keys(counts).map((k) => {
    const label = LABEL[k] || k;
    return `${label}${counts[k]}条`;
  });
  return parts.length ? parts.join('、') : '暂无';
}

/** 用状态节点上的 toStatus 估算服务时长（接口可能按时间降序，需按 createdAt 取最早开始、最晚结束） */
function computeDurationFromTimelineItems(items: any[], orderStatus: string): { start?: string; end?: string } {
  const withMeta = (items || []).filter((i) => i?.metadata?.toStatus);
  const starts = withMeta.filter((i) => i.metadata.toStatus === 'in_progress');
  let start: string | undefined;
  for (const s of starts) {
    const t = new Date(s.createdAt).getTime();
    if (!start || t < new Date(start).getTime()) start = s.createdAt;
  }
  const ends = withMeta.filter((i) =>
    ['completed', 'pending_review'].includes(String(i.metadata?.toStatus)),
  );
  let end: string | undefined;
  for (const e of ends) {
    const t = new Date(e.createdAt).getTime();
    if (!end || t > new Date(end).getTime()) end = e.createdAt;
  }
  if (!end && (orderStatus === 'in_progress' || orderStatus === 'emergency')) {
    end = new Date().toISOString();
  }
  return { start, end };
}

type UploadedFile = {
  name: string;
  path: string;
};

Page({
  data: {
    statusBarHeight: 20,
    orderId: '',
    order: {} as any,
    staffRoleLabel: '服务人员',
    orderStatus: '',
    pageTitle: '完成资料填写',
    pageSubtitle: '请先补齐必填资料，再结束当前订单',
    submitButtonText: '提交资料并结束服务',
    duration: '',
    timelineBreakdown: '',
    milestoneCount: 0,
    timelineDigest: '',
    timelineDigestLoading: false,
    aiSummaryLoading: false,
    medications: [] as any[],
    medicationMode: '' as '' | 'none' | 'has',
    followUpDate: '',
    followUpNote: '',
    followUpHospital: '',
    followUpDepartment: '',
    summary: '',
    uploadedFiles: [] as UploadedFile[],
    summaryReady: false,
    proofReady: false,
    medicationReady: false,
    requiredReadyCount: 0,
    progressWidth: 0,
    proofCount: 0,
    canFinish: false,
    missingItems: [] as string[],
    missingText: '',
    submitting: false,
    healthProfileStatus: '' as '' | 'empty' | 'partial' | 'complete',
    healthProfileStatusText: '',
    serviceTargetId: '',
  },

  onLoad(options: any) {
    if (!ensureAttendantPageAccess()) return;
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadOrder();
    }
  },

  onShow() {
    if (this.data.serviceTargetId) {
      this.checkHealthProfile(this.data.serviceTargetId);
    }
  },

  async loadOrder() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}`);
      const completion = res.completionData || {};
      const evaluation = evaluateCompletionData(completion);
      const staffRoleCode = res?.attendant?.primaryRole || '';
      const staffRoleName = staffRoleLabel(staffRoleCode);
      const order = {
        ...res,
        patientName: res.serviceTarget?.name || res.patientName || '',
        hospitalName: res.hospital || res.serviceTarget?.hospital || '',
        departmentName: res.department || '',
        staffRoleLabel: staffRoleName,
      };
      this.setData({
        order,
        staffRoleLabel: staffRoleName,
        orderStatus: res.status || '',
        pageTitle:
          res.status === 'in_progress' || res.status === 'emergency'
            ? '完成资料填写'
            : '服务结束汇总',
        pageSubtitle:
          res.status === 'in_progress' || res.status === 'emergency'
            ? '请先补齐必填资料，提交后才能结束当前订单'
            : '订单已结束，你仍可回来补充或修正本次服务资料',
        submitButtonText:
          res.status === 'in_progress' || res.status === 'emergency'
            ? '提交资料并结束服务'
            : '保存完成资料',
        summary: completion.summary || completion.doctorAdvice || '',
        followUpDate: completion.followUpDate || '',
        followUpNote: completion.followUpNote || '',
        followUpHospital: completion.followUpHospital || '',
        followUpDepartment: completion.followUpDepartment || '',
        medicationMode: evaluation.medicationMode,
        medications: evaluation.medications.map((item) => ({
          ...item,
          id: item.id || String(Date.now() + Math.random()),
        })),
        uploadedFiles: (() => {
          const fromFiles = normalizeCompletionFiles(completion.files).map((item) => ({
            name: item.name,
            path: item.url,
          }));
          const seen = new Set(fromFiles.map((f) => f.path));
          const fromImages = (Array.isArray(completion.images) ? completion.images : [])
            .map((url: any) => String(url || '').trim())
            .filter(Boolean)
            .filter((url: string) => !seen.has(url))
            .map((url: string) => {
              seen.add(url);
              return { path: url, name: '报告/单据照片' };
            });
          return [...fromFiles, ...fromImages];
        })(),
      }, () => this.refreshChecklist());

      const targetId = res.serviceTargetId || res.serviceTarget?.id || '';
      if (targetId) {
        this.setData({ serviceTargetId: String(targetId) });
        this.checkHealthProfile(String(targetId));
      }

      try {
        const tl: any = await get(`/timelines/order/${this.data.orderId}`, { includeInternal: true });
        const items: any[] = tl.items || tl || [];
        const { start, end } = computeDurationFromTimelineItems(items, res.status || '');
        const durationText = start && end ? this.calcDuration(start, end) : '';
        this.setData({
          milestoneCount: items.length,
          timelineBreakdown: buildTimelineBreakdown(items),
          duration: durationText,
        });
        void this.fetchTimelineDigest(items.length);
      } catch (_) {}
    } catch (e) {
      console.error('加载订单失败', e);
    }
  },

  async checkHealthProfile(targetId: string) {
    try {
      const res: any = await get(`/users/service-targets/${targetId}`);
      const hp = typeof res.healthProfile === 'string'
        ? JSON.parse(res.healthProfile || '{}')
        : (res.healthProfile || {});
      const hasCore = !!(hp.bloodType && hp.fillMethod && hp.mobilityStatus);
      const hasEmergency = !!(res.emergencyContact && res.emergencyPhone);
      const hasMedical = !!(hp.medicalHistory?.length);
      if (hasCore && hasEmergency && hasMedical) {
        this.setData({ healthProfileStatus: 'complete', healthProfileStatusText: '档案已完善' });
      } else if (hasCore || hasEmergency) {
        this.setData({ healthProfileStatus: 'partial', healthProfileStatusText: '档案部分缺失' });
      } else {
        this.setData({ healthProfileStatus: 'empty', healthProfileStatusText: '尚未建档' });
      }
    } catch {
      this.setData({ healthProfileStatus: '', healthProfileStatusText: '' });
    }
  },

  goProxyFillProfile() {
    if (!this.data.serviceTargetId) {
      wx.showToast({ title: '未找到服务对象信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/health-profile/health-profile?subjectId=${this.data.serviceTargetId}&proxyMode=1`,
    });
  },

  goBack() {
    wx.navigateBack();
  },

  /** 服务概况：轻量 AI 概括时间线（失败静默，界面显示说明文案） */
  async fetchTimelineDigest(milestoneCount?: number) {
    const n = milestoneCount ?? this.data.milestoneCount;
    if (!this.data.orderId || n <= 0) {
      this.setData({ timelineDigest: '', timelineDigestLoading: false });
      return;
    }
    this.setData({ timelineDigestLoading: true });
    try {
      const res: any = await post(
        `/orders/${this.data.orderId}/completion/timeline-digest`,
        {},
        { silent: true },
      );
      const text = String(res?.digest || '').trim();
      this.setData({ timelineDigest: text, timelineDigestLoading: false });
    } catch {
      this.setData({ timelineDigest: '', timelineDigestLoading: false });
    }
  },

  /** 本地相册或拍照：报告截图等（走 wx.chooseMedia，无需先发到聊天） */
  chooseProofFromLocal() {
    const remaining = 9 - this.data.uploadedFiles.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传 9 个凭证文件', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res: WechatMiniprogram.ChooseMediaSuccessCallbackResult) => {
        const temps = res.tempFiles || [];
        const newFiles = temps.map((f: WechatMiniprogram.MediaFile, i: number) => ({
          name: `报告凭证_${Date.now()}_${i + 1}.jpg`,
          path: f.tempFilePath,
        }));
        this.setData({ uploadedFiles: [...this.data.uploadedFiles, ...newFiles] }, () => this.refreshChecklist());
      },
      fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
        const msg = String(err?.errMsg || '');
        if (msg.includes('cancel')) return;
        wx.showToast({ title: '未选择图片', icon: 'none' });
      },
    });
  },

  /** 从微信会话导入：PDF / Word / Excel / 图片 等（含发到文件传输助手的文件） */
  chooseProofFile() {
    const remaining = 9 - this.data.uploadedFiles.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传 9 个凭证文件', icon: 'none' });
      return;
    }
    (wx as any).chooseMessageFile({
      count: remaining,
      type: 'file',
      extension: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx'],
      success: (res: any) => {
        const newFiles = res.tempFiles.map((f: any) => ({ name: f.name, path: f.path }));
        this.setData({ uploadedFiles: [...this.data.uploadedFiles, ...newFiles] }, () => this.refreshChecklist());
      },
      fail: (err: any) => {
        const msg = String(err?.errMsg || '');
        if (msg.includes('cancel')) return;
        wx.showToast({ title: '未选择文件', icon: 'none' });
      },
    });
  },

  removeFile(e: any) {
    const index = e.currentTarget.dataset.index;
    const files = [...this.data.uploadedFiles];
    files.splice(index, 1);
    this.setData({ uploadedFiles: files }, () => this.refreshChecklist());
  },

  // ── 用药记录
  onAddMed() {
    const meds = [...this.data.medications, this.createMedicationItem()];
    this.setData({ medicationMode: 'has', medications: meds }, () => this.refreshChecklist());
  },

  onRemoveMed(e: any) {
    const index = e.currentTarget.dataset.index;
    const meds = [...this.data.medications];
    meds.splice(index, 1);
    this.setData({ medications: meds }, () => this.refreshChecklist());
  },

  onMedInput(e: any) {
    const { index, field } = e.currentTarget.dataset;
    this.setData({ [`medications[${index}].${field}`]: e.detail.value }, () => this.refreshChecklist());
  },

  onMedTimeChange(e: any) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`medications[${index}].reminderTime`]: e.detail.value }, () => this.refreshChecklist());
  },

  onMedStartDateChange(e: any) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`medications[${index}].startDate`]: e.detail.value }, () => this.refreshChecklist());
  },

  onMedEndDateChange(e: any) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`medications[${index}].endDate`]: e.detail.value }, () => this.refreshChecklist());
  },

  onMedicationModeSelect(e: any) {
    const mode = e.currentTarget.dataset.mode as '' | 'none' | 'has';
    if (!mode || mode === this.data.medicationMode) return;
    const nextData: Record<string, any> = { medicationMode: mode };
    if (mode === 'none') {
      nextData.medications = [];
    } else if (mode === 'has' && this.data.medications.length === 0) {
      nextData.medications = [this.createMedicationItem()];
    }
    this.setData(nextData, () => this.refreshChecklist());
  },

  onFollowUpDateChange(e: any) {
    this.setData({ followUpDate: e.detail.value }, () => this.refreshChecklist());
  },

  onFollowUpHospitalInput(e: any) {
    this.setData({ followUpHospital: e.detail.value }, () => this.refreshChecklist());
  },

  onFollowUpDepartmentInput(e: any) {
    this.setData({ followUpDepartment: e.detail.value }, () => this.refreshChecklist());
  },

  onFollowUpNoteInput(e: any) {
    this.setData({ followUpNote: e.detail.value }, () => this.refreshChecklist());
  },

  clearFollowUp() {
    this.setData({
      followUpDate: '',
      followUpHospital: '',
      followUpDepartment: '',
      followUpNote: '',
    }, () => this.refreshChecklist());
  },

  onSummaryInput(e: any) {
    this.setData({ summary: e.detail.value }, () => this.refreshChecklist());
  },

  async draftAiSummary() {
    if (this.data.aiSummaryLoading) return;
    this.setData({ aiSummaryLoading: true });
    try {
      const res: any = await post(`/orders/${this.data.orderId}/completion/ai-draft`, {});
      const text = String(res?.summary || '').trim();
      if (!text) {
        wx.showToast({ title: '未生成内容，请稍后重试', icon: 'none' });
        return;
      }
      this.setData({ summary: text.slice(0, 500) }, () => this.refreshChecklist());
      wx.showToast({ title: '已填入草稿，请核对后提交', icon: 'none' });
    } catch (e: any) {
      wx.showToast({ title: e?.message || '生成失败', icon: 'none' });
    } finally {
      this.setData({ aiSummaryLoading: false });
    }
  },

  // ── 提交
  async onSubmit() {
    const payload = this.buildPayload();
    if (
      payload.followUpDate &&
      (!String(payload.followUpHospital || '').trim() || !String(payload.followUpDepartment || '').trim())
    ) {
      wx.showToast({
        title: '有复诊安排时，请补充医院和科室',
        icon: 'none',
      });
      return;
    }
    const evaluation = evaluateCompletionData(payload);
    if (!evaluation.ready) {
      wx.showToast({
        title: `请先补齐${evaluation.missingItems.join('、')}`,
        icon: 'none',
      });
      return;
    }

    this.setData({ submitting: true });
    try {
      const { imageUrls, fileItems } = await this.uploadCompletionProofs(this.data.uploadedFiles);
      const completionPayload = {
        summary: payload.summary.trim(),
        doctorAdvice: payload.summary.trim(),
        followUpDate: payload.followUpDate,
        followUpNote: payload.followUpNote,
        followUpHospital: String(payload.followUpHospital || '').trim(),
        followUpDepartment: String(payload.followUpDepartment || '').trim(),
        medicationMode: payload.medicationMode,
        medications:
          payload.medicationMode === 'has'
            ? payload.medications.map((item: any) => ({
                name: String(item.name || '').trim(),
                usage: String(item.usage || '').trim(),
                reminderTime: String(item.reminderTime || '').trim(),
                startDate: String(item.startDate || '').trim(),
                endDate: String(item.endDate || '').trim(),
              }))
            : [],
        images: imageUrls,
        files: fileItems,
      };

      await post(`/orders/${this.data.orderId}/completion`, completionPayload);

      if (this.data.orderStatus === 'in_progress' || this.data.orderStatus === 'emergency') {
        await put(`/orders/${this.data.orderId}/finish`);
      }

      if (completionPayload.followUpDate) {
        requestSubscribe(['followUpReminder', 'orderServiceReminder']).catch(() => {});
      }
      if (completionPayload.medicationMode === 'has' && completionPayload.medications.length > 0) {
        requestSubscribe(['medicationReminder']).catch(() => {});
      }

      wx.showToast({
        title:
          this.data.orderStatus === 'in_progress' || this.data.orderStatus === 'emergency'
            ? '资料已提交，订单已结束'
            : '保存成功',
        icon: 'success',
      });
      setTimeout(() => this.goAfterSubmit(), 1200);
    } catch (e) {
      console.error('提交记录单失败', e);
      wx.showToast({
        title: (e as Error)?.message || '提交失败，请重试',
        icon: 'none',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  buildPayload() {
    const images: string[] = [];
    const files: { url: string; name: string }[] = [];
    for (const item of this.data.uploadedFiles) {
      const name = item.name || getCompletionFileName(item.path);
      if (isCompletionProofImage(name, item.path)) {
        images.push(item.path);
      } else {
        files.push({ url: item.path, name });
      }
    }
    return {
      summary: this.data.summary,
      followUpDate: this.data.followUpDate,
      followUpNote: this.data.followUpNote,
      followUpHospital: this.data.followUpHospital,
      followUpDepartment: this.data.followUpDepartment,
      medicationMode: this.data.medicationMode,
      medications: this.data.medications,
      images,
      files,
    };
  },

  refreshChecklist() {
    const evaluation = evaluateCompletionData(this.buildPayload());
    this.setData({
      summaryReady: evaluation.summaryReady,
      proofReady: evaluation.proofReady,
      medicationReady: evaluation.medicationReady,
      requiredReadyCount: evaluation.readyCount,
      progressWidth: Math.round((evaluation.readyCount / 3) * 100),
      proofCount: evaluation.proofCount,
      canFinish: evaluation.ready,
      missingItems: evaluation.missingItems,
      missingText: evaluation.missingItems.join('、'),
    });
  },

  createMedicationItem() {
    const today = this._today();
    return {
      id: String(Date.now() + Math.random()),
      name: '',
      usage: '',
      reminderTime: '08:00',
      startDate: today,
      endDate: today,
    };
  },

  isRemoteAsset(path: string): boolean {
    const value = String(path || '').trim();
    if (!value) return false;
    if (/^https?:\/\/tmp\//i.test(value)) return false;
    if (/^(wxfile|wdfile|file|blob):/i.test(value)) return false;
    return /^https?:\/\//i.test(value) || value.startsWith('/');
  },

  async uploadCompletionProofs(items: UploadedFile[]): Promise<{
    imageUrls: string[];
    fileItems: { url: string; name: string }[];
  }> {
    const imageUrls: string[] = [];
    const fileItems: { url: string; name: string }[] = [];
    for (const item of items) {
      const name = item.name || getCompletionFileName(item.path);
      const isImg = isCompletionProofImage(name, item.path);
      if (this.isRemoteAsset(item.path)) {
        if (isImg) imageUrls.push(item.path);
        else fileItems.push({ url: item.path, name });
        continue;
      }
      const [url] = await this.uploadPaths([item.path]);
      if (isImg) imageUrls.push(url);
      else fileItems.push({ url, name });
    }
    return { imageUrls, fileItems };
  },

  goAfterSubmit() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({
      url: `/pages/workbench/service-timeline/service-timeline?orderId=${this.data.orderId}`,
    });
  },

  async uploadPaths(paths: string[]): Promise<string[]> {
    const urls: string[] = [];
    for (const path of paths) {
      const url: string = await new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');
        wx.uploadFile({
          url: `${BASE_URL}/documents/raw-upload`,
          filePath: path,
          name: 'file',
          header: { Authorization: token ? `Bearer ${token}` : '' },
          success(res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              let message = '上传失败';
              try {
                const parsed = JSON.parse(res.data || '{}');
                message = parsed?.message || parsed?.error || message;
              } catch {}
              reject(new Error(message));
              return;
            }
            try {
              const data = JSON.parse(res.data || '{}');
              if (data.code !== undefined && data.code !== 0 && data.code !== 200) {
                reject(new Error(data.message || '上传失败'));
                return;
              }
              const uploadedUrl = data.data?.url || data.url;
              if (!uploadedUrl) {
                reject(new Error('上传成功但未返回文件地址'));
                return;
              }
              resolve(uploadedUrl);
            } catch (error) {
              reject(error);
            }
          },
          fail() {
            reject(new Error('上传文件失败'));
          },
        });
      });
      urls.push(url);
    }
    return urls;
  },

  calcDuration(start: string, end: string): string {
    if (!start || !end) return '';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return '';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}小时${m > 0 ? m + '分' : ''}`;
    return `${m}分钟`;
  },

  _today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
});
