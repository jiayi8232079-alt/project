import { get, post } from '../../../utils/request';
import { goToCustomerService } from '../../../utils/customerService';

const CATEGORY_LABELS: Record<string, string> = {
  medication_miss: '漏服预警',
  follow_up_overdue: '复诊逾期',
  timeline_keyword: '服务高危信号',
  service_exception: '服务异常',
  manual: '人工预警',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: '紧急',
  medium: '重要',
  low: '提醒',
};

const STATUS_LABELS: Record<string, string> = {
  new: '未处理',
  acknowledged: '已知悉',
  closed: '已关闭',
  ignored: '已忽略',
};

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    statusBarHeight: 0,
    alertId: 0,
    alert: null as any,
    loading: true,
    submitting: false,
    noteDraft: '',
  },

  onLoad(options: any) {
    const sys = wx.getWindowInfo?.() || wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sys.statusBarHeight || 44,
      alertId: Number(options.id || 0),
    });
  },

  onShow() {
    if (this.data.alertId) this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res: any = await get(`/alerts/${this.data.alertId}`);
      if (!res || !res.id) {
        wx.showToast({ title: '预警不存在', icon: 'none' });
        return;
      }
      const alert = {
        ...res,
        categoryLabel: CATEGORY_LABELS[res.category] || '预警',
        severityLabel: SEVERITY_LABELS[res.severity] || '提醒',
        statusLabel: STATUS_LABELS[res.status] || '',
        targetName: res.serviceTarget?.name || res.user?.nickname || '家人',
        triggeredAtText: formatTime(res.triggeredAt),
        acknowledgedAtText: formatTime(res.acknowledgedAt),
        closedAtText: formatTime(res.closedAt),
        payloadEntries: res.payload && typeof res.payload === 'object'
          ? Object.entries(res.payload).map(([k, v]) => ({
              key: k,
              label: this.labelizeKey(k),
              value: this.valueToString(v),
            }))
          : [],
      };
      this.setData({ alert });
    } catch (e) {
      console.log('加载预警详情失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  labelizeKey(k: string): string {
    const map: Record<string, string> = {
      total: '应执行次数',
      taken: '已执行次数',
      missed: '漏服次数',
      adherenceRate: '执行率',
      windowDays: '统计窗口（天）',
      minAdherenceRate: '阈值',
      overdueDays: '逾期天数',
      originalDate: '原定日期',
      hospital: '医院',
      department: '科室',
      hits: '命中关键词',
      snippet: '相关片段',
      entryType: '条目类型',
    };
    return map[k] || k;
  },

  valueToString(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') {
      if (v > 0 && v < 1) return `${(v * 100).toFixed(0)}%`;
      return String(v);
    }
    if (Array.isArray(v)) return v.join('、');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  },

  onNoteInput(e: any) {
    this.setData({ noteDraft: e.detail.value });
  },

  async acknowledge() {
    if (this.data.submitting || !this.data.alertId) return;
    this.setData({ submitting: true });
    try {
      await post(`/alerts/${this.data.alertId}/acknowledge`, {
        note: this.data.noteDraft || undefined,
      });
      wx.showToast({ title: '已确认知悉', icon: 'success' });
      this.setData({ noteDraft: '' });
      this.loadDetail();
    } catch (e) {
      console.log('确认预警失败', e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async close() {
    if (this.data.submitting || !this.data.alertId) return;
    const ok = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '关闭预警',
        content: '确认已完成对应处置？关闭后预警不再出现在未处理列表。',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!ok) return;
    this.setData({ submitting: true });
    try {
      await post(`/alerts/${this.data.alertId}/close`, {
        note: this.data.noteDraft || undefined,
      });
      wx.showToast({ title: '已关闭', icon: 'success' });
      this.setData({ noteDraft: '' });
      this.loadDetail();
    } catch (e) {
      console.log('关闭预警失败', e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  onActionTap(e: any) {
    const action = e.currentTarget.dataset.action;
    const alert = this.data.alert;
    if (!action || !alert) return;
    switch (action) {
      case 'contact_service':
      case 'call_store':
        goToCustomerService();
        break;
      case 'view_medication':
        wx.navigateTo({ url: '/pages/medication-reminder/medication-reminder' });
        break;
      case 'view_timeline': {
        const orderId = alert.orderId;
        if (orderId) {
          wx.navigateTo({ url: `/pages/order/detail/detail?id=${orderId}` });
        }
        break;
      }
      case 'rebook_followup':
        wx.navigateTo({ url: '/pages/order/create/create?source=rebook_followup' });
        break;
      case 'upgrade_care_pack':
        wx.navigateTo({ url: '/pages/membership/membership' });
        break;
      case 'call_attendant': {
        const phone = alert.order?.attendantPhone;
        if (phone) {
          wx.makePhoneCall({ phoneNumber: String(phone) });
        } else {
          goToCustomerService();
        }
        break;
      }
      default:
        break;
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },
});
