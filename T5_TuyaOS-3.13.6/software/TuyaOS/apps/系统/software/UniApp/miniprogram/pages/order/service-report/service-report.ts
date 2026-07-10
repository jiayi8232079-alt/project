import { get } from '../../../utils/request';
import { resolvePublicUrl } from '../../../utils/media-url';
import {
  resolveCompletionAssetUrl,
  normalizeCompletionFiles,
} from '../../../utils/completion';
import { renderServiceReportShareCover } from '../../../utils/share-cover';

type ReportSection = {
  iconKey: string;
  title: string;
  content: string;
  bullets?: string[];
  tone: 'primary' | 'info' | 'success' | 'warning' | 'accent' | 'muted';
};

function formatDate(v?: string | Date | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveTimelineAssetUrl(url?: string) {
  return resolvePublicUrl(url);
}

Page({
  data: {
    statusBarHeight: 20,
    orderId: '',
    loading: true,

    orderNumber: '',
    serviceType: '',
    serviceTime: '',
    hospital: '',
    department: '',
    patientName: '',
    patientAge: '',
    patientGender: '',
    attendantName: '',
    attendantPhone: '',
    duration: '',

    diagnosisResult: '',
    keyAdvice: '',
    summary: '',

    aiDiagnosis: '',
    aiKeyAdvice: '',
    aiSummary: '',
    aiHealthTips: [] as string[],
    aiDietaryAdvice: '',
    aiFollowUpReminder: '',
    aiReportSections: [] as ReportSection[],
    hasAiReport: false,

    followUpDate: '',
    followUpHospital: '',
    followUpDepartment: '',
    followUpNote: '',

    medications: [] as any[],
    images: [] as string[],
    files: [] as { url: string; name: string }[],

    timelineItems: [] as any[],

    /** 小程序码 base64（后端 /orders/:id/wxa-service-report-qrcode 返回，贴到分享封面右下角） */
    qrCodeBase64: '',
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      orderId: options.orderId || options.id || '',
    });
    if (this.data.orderId) {
      this.loadReport();
    }
  },

  goBack() {
    wx.navigateBack();
  },

  async loadReport() {
    this.setData({ loading: true });
    try {
      const [order, timelineRes] = await Promise.all([
        get(`/orders/${this.data.orderId}`) as Promise<any>,
        get(`/timelines/order/${this.data.orderId}/user`) as Promise<any>,
      ]);

      const completion = order.completionData || {};
      const target = order.serviceTarget || {};

      const medications = (Array.isArray(completion.medications) ? completion.medications : [])
        .filter((m: any) => m?.name);

      const images = (Array.isArray(completion.images) ? completion.images : [])
        .map((url: string) => resolveCompletionAssetUrl(url))
        .filter(Boolean);

      const files = normalizeCompletionFiles(completion.files);

      let duration = '';
      const tlItems = Array.isArray(timelineRes?.items || timelineRes) ? (timelineRes.items || timelineRes) : [];
      const startEntry = tlItems.find((i: any) => i.metadata?.toStatus === 'in_progress');
      const endEntry = tlItems.find((i: any) =>
        i.metadata?.toStatus === 'completed' || i.metadata?.toStatus === 'pending_review',
      );
      if (startEntry && endEntry) {
        duration = this.calcDuration(startEntry.createdAt, endEntry.createdAt);
      }

      const TYPE_LABEL: Record<string, string> = {
        node: '状态更新', text: '文字记录', image: '照片',
        service_start: '服务开始', service_end: '服务结束',
        audio_question: '问诊录音', audio_advice: '医嘱录音', file: '文件',
      };
      const keyTimeline = tlItems
        .filter((item: any) => item.type === 'node' || item.type === 'text' || item.type === 'image')
        .slice(0, 10)
        .map((item: any) => ({
          time: item.createdAt ? formatDate(item.createdAt) : '',
          label: TYPE_LABEL[item.type] || item.type,
          content: item.content || '',
        }));

      this.setData({
        orderNumber: order.orderNumber || '',
        serviceType: order.serviceType || '',
        serviceTime: formatDate(order.serviceTime),
        hospital: order.hospital || '',
        department: order.department || '',
        patientName: target.name || '',
        patientAge: target.age ? `${target.age}岁` : '',
        patientGender: target.gender === 'male' ? '男' : target.gender === 'female' ? '女' : '',
        attendantName: order.attendant?.realName || order.attendant?.name || '',
        attendantPhone: order.attendant?.phone || '',
        duration,

        diagnosisResult: String(completion.diagnosisResult || '').trim(),
        keyAdvice: String(completion.keyAdvice || '').trim(),
        summary: String(completion.summary || completion.doctorAdvice || '').trim(),

        aiDiagnosis: String(completion.aiDiagnosis || '').trim(),
        aiKeyAdvice: String(completion.aiKeyAdvice || '').trim(),
        aiSummary: String(completion.aiSummary || '').trim(),
        aiHealthTips: Array.isArray(completion.aiHealthTips) ? completion.aiHealthTips : [],
        aiDietaryAdvice: String(completion.aiDietaryAdvice || '').trim(),
        aiFollowUpReminder: String(completion.aiFollowUpReminder || '').trim(),
        aiReportSections: this.resolveReportSections(completion),
        hasAiReport: !!(
          completion.aiDiagnosis
          || completion.aiSummary
          || (Array.isArray(completion.aiReportSections) && completion.aiReportSections.length)
        ),

        followUpDate: String(completion.followUpDate || '').split('T')[0],
        followUpHospital: String(completion.followUpHospital || '').trim(),
        followUpDepartment: String(completion.followUpDepartment || '').trim(),
        followUpNote: String(completion.followUpNote || '').trim(),

        medications,
        images,
        files: files.map((f) => ({ url: resolveTimelineAssetUrl(f.url), name: f.name })),
        timelineItems: keyTimeline,
        loading: false,
      });

      this._prefetchQrCode();
    } catch (e) {
      console.error('加载服务报告失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 异步拉取小程序码 base64，贴到分享封面右下角。
   * 失败（未配置 WECHAT_APPID / 网络异常等）不影响主流程，封面退化为纯文字版。
   */
  _prefetchQrCode() {
    if (this.data.qrCodeBase64 || !this.data.orderId) return;
    get(`/orders/${this.data.orderId}/wxa-service-report-qrcode`)
      .then((resp: any) => {
        const b64 = String(resp?.imageBase64 || '').trim();
        if (b64) this.setData({ qrCodeBase64: b64 });
      })
      .catch(() => { /* 忽略：封面会自动降级为无 QR 版本 */ });
  },

  previewImage(e: any) {
    const { src, urls } = e.currentTarget.dataset;
    wx.previewImage({ current: src, urls });
  },

  openFile(e: any) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.downloadFile({
      url,
      success: (res) => {
        wx.openDocument({ filePath: res.tempFilePath, showMenu: true });
      },
      fail: () => wx.showToast({ title: '下载失败', icon: 'none' }),
    });
  },

  calcDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return '';
    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}分钟`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  },

  /**
   * 优先使用后端 completionData.aiReportSections；老订单（无 sections）时，
   * 从本地零散字段合成，保证渲染结果稳定、UI 不出现空白。
   */
  resolveReportSections(completion: any): ReportSection[] {
    const raw = Array.isArray(completion?.aiReportSections)
      ? completion.aiReportSections
      : [];
    if (raw.length) {
      return raw
        .map((it: any) => ({
          iconKey: String(it?.iconKey || 'article'),
          title: String(it?.title || '').trim(),
          content: String(it?.content || '').trim(),
          bullets: Array.isArray(it?.bullets)
            ? it.bullets.map((b: any) => String(b || '').trim()).filter(Boolean)
            : [],
          tone: (it?.tone as ReportSection['tone']) || 'primary',
        }))
        .filter((s: ReportSection) => s.title && (s.content || (s.bullets && s.bullets.length)));
    }
    // 前端降级合成（老订单兼容）
    const sections: ReportSection[] = [];
    const push = (
      iconKey: string,
      title: string,
      content: string | undefined,
      tone: ReportSection['tone'],
      bullets?: string[],
    ) => {
      const text = (content || '').trim();
      const bs = (bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
      if (!text && !bs.length) return;
      sections.push({ iconKey, title, content: text, tone, bullets: bs });
    };
    push('stethoscope', '就诊结果', completion?.aiDiagnosis, 'info');
    push('medication', '医嘱解读', completion?.aiKeyAdvice, 'primary');
    push('restaurant', '饮食调养', completion?.aiDietaryAdvice, 'success');
    const tips = Array.isArray(completion?.aiHealthTips)
      ? completion.aiHealthTips.map((t: any) => String(t || '').trim()).filter(Boolean)
      : [];
    if (tips.length) {
      push('tips_and_updates', '日常注意事项', '', 'warning', tips);
    }
    push('event_available', '复诊提醒', completion?.aiFollowUpReminder, 'accent');
    push('summarize', '陪诊服务总结', completion?.aiSummary, 'muted');
    return sections;
  },

  /**
   * 微信好友 / 群聊分享。使用自定义 Canvas 封面图（陪诊报告专属样式，带小程序码角标）。
   * 返回 promise 字段允许 canvas 异步绘制，不阻塞分享菜单弹出。
   */
  onShareAppMessage() {
    const orderId = this.data.orderId;
    const title = `${this.data.patientName || '家人'}的陪诊服务报告已出炉`;
    const path = `/pages/order/service-report/service-report?orderId=${orderId}`;
    const coverPromise = renderServiceReportShareCover(this, {
      subjectName: this.data.patientName || '家人',
      serviceType: this.data.serviceType || '陪诊服务',
      qrCodeBase64: this.data.qrCodeBase64 || '',
    }).catch(() => '');
    return {
      title,
      path,
      promise: Promise.resolve(coverPromise).then((imageUrl) =>
        imageUrl ? { title, path, imageUrl } : { title, path },
      ),
    } as any;
  },

  /**
   * 朋友圈分享（微信 7.0.15+ 支持）。朋友圈 API 是同步返回，不支持 promise；
   * 这里只返回标题与 query 即可，系统会自动抓取当前页面截图作为封面。
   */
  onShareTimeline() {
    const title = `${this.data.patientName || '家人'}的陪诊服务报告`;
    return {
      title,
      query: `orderId=${this.data.orderId}`,
    };
  },
});
