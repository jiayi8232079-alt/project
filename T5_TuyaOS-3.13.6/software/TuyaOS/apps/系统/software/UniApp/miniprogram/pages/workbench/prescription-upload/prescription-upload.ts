import { get, post } from '../../../utils/request';
import { getToken } from '../../../utils/auth';
import { ensureAttendantPageAccess } from '../../../utils/identity';
import { API_BASE_URL } from '../../../config/api-base';

type Severity = 'high' | 'medium' | 'low';

interface ItemRow {
  medicineName: string;
  specification: string;
  severity: Severity;
  dosePerTime: number;
  timesPerDay: number;
  totalQuantity: number;
  unit: string;
  dosage: string;
  instructions: string;
  /** 前端估算 endDate 仅供预览，后端实际以 startDate + 疗程天数为准 */
  endDatePreview: string;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  high: '高风险',
  medium: '慢病',
  low: '保健',
};

function emptyItem(): ItemRow {
  return {
    medicineName: '',
    specification: '',
    severity: 'medium',
    dosePerTime: 1,
    timesPerDay: 1,
    totalQuantity: 0,
    unit: '片',
    dosage: '',
    instructions: '',
    endDatePreview: '',
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

Page({
  data: {
    statusBarHeight: 20,
    orderId: '' as string | number,
    loading: false,
    submitting: false,
    uploading: false,
    ocrParsing: false,

    // 订单/客户上下文
    orderInfo: null as any,
    customerName: '',
    serviceTargetName: '',
    customerUserId: 0,
    serviceTargetId: 0,

    // 表单
    startDate: '',
    sourceImage: '',
    hospital: '',
    doctorName: '',
    department: '',
    note: '',
    items: [emptyItem()] as ItemRow[],

    severityOptions: [
      { value: 'high', label: SEVERITY_LABEL.high },
      { value: 'medium', label: SEVERITY_LABEL.medium },
      { value: 'low', label: SEVERITY_LABEL.low },
    ],
    severityIndex: [0, 0, 0], // 与 items 并行的 picker index 数组
  },

  async onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      orderId: options.orderId || '',
      startDate: formatDate(new Date()),
    });
    if (!(await ensureAttendantPageAccess())) return;
    if (options.orderId) {
      this.loadOrder(Number(options.orderId));
    }
    this.syncSeverityIndex();
  },

  async loadOrder(orderId: number) {
    this.setData({ loading: true });
    try {
      const res: any = await get(`/orders/${orderId}`);
      this.setData({
        orderInfo: res,
        customerUserId: res?.userId || 0,
        customerName: res?.user?.nickname || res?.user?.phone || '客户',
        serviceTargetId: res?.serviceTargetId || 0,
        serviceTargetName: res?.serviceTarget?.name || '',
        hospital: res?.hospital || '',
      });
    } catch (e) {
      console.warn('加载订单失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onItemInput(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`items[${index}].${field}`]: value });
    if (field === 'medicineName') {
      this.suggestByName(index, String(value || ''));
    }
    this.refreshItemPreview(index);
  },

  onItemNumberInput(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    const num = Number(e.detail.value || 0);
    this.setData({ [`items[${index}].${field}`]: num });
    this.refreshItemPreview(index);
  },

  onSeverityChange(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    const pickerIndex = Number(e.detail.value);
    const opt = (this.data.severityOptions[pickerIndex] as any)?.value as Severity;
    if (!opt) return;
    this.setData({
      [`items[${index}].severity`]: opt,
      [`severityIndex[${index}]`]: pickerIndex,
    });
  },

  onStartDateChange(e: any) {
    this.setData({ startDate: e.detail.value });
    this.data.items.forEach((_, i) => this.refreshItemPreview(i));
  },

  addItem() {
    const items = this.data.items.concat(emptyItem());
    this.setData({ items });
    this.syncSeverityIndex();
  },

  removeItem(e: any) {
    if (this.data.items.length <= 1) {
      wx.showToast({ title: '至少保留一条', icon: 'none' });
      return;
    }
    const idx = Number(e.currentTarget.dataset.index);
    const items = this.data.items.slice();
    items.splice(idx, 1);
    this.setData({ items });
    this.syncSeverityIndex();
  },

  syncSeverityIndex() {
    const severityIndex = this.data.items.map((item) => {
      return this.data.severityOptions.findIndex((o: any) => o.value === item.severity);
    });
    this.setData({ severityIndex: severityIndex.map((v) => (v < 0 ? 1 : v)) });
  },

  async suggestByName(index: number, keyword: string) {
    const kw = keyword.trim();
    if (!kw || kw.length < 2) return;
    try {
      const res: any = await get('/medicine-catalog/search', { q: kw, limit: 5 });
      const list = Array.isArray(res) ? res : [];
      const match = list.find((m: any) => m.name === kw) || list[0];
      if (!match) return;
      const current = this.data.items[index];
      const merged = {
        ...current,
        severity: (match.severity as Severity) || current.severity,
        specification: current.specification || match.specification || '',
        dosePerTime: Number(match.defaultDosePerTime) || current.dosePerTime,
        timesPerDay: Number(match.defaultTimesPerDay) || current.timesPerDay,
        unit: match.defaultUnit || current.unit,
        instructions: current.instructions || match.defaultInstructions || '',
      } as ItemRow;
      this.setData({ [`items[${index}]`]: merged });
      this.syncSeverityIndex();
      this.refreshItemPreview(index);
    } catch {
      // 字典接口失败时静默
    }
  },

  refreshItemPreview(index: number) {
    const item = this.data.items[index];
    if (!item) return;
    const total = Number(item.totalQuantity || 0);
    const dose = Number(item.dosePerTime || 0);
    const freq = Number(item.timesPerDay || 0);
    if (!total || !dose || !freq || !this.data.startDate) {
      this.setData({ [`items[${index}].endDatePreview`]: '' });
      return;
    }
    const days = Math.max(1, Math.ceil(total / (dose * freq)));
    const end = addDays(new Date(this.data.startDate), days - 1);
    this.setData({ [`items[${index}].endDatePreview`]: formatDate(end) });
  },

  async chooseCustomer() {
    const self = this;
    const result = await new Promise<any>((resolve) => {
      wx.showActionSheet({
        itemList: ['使用当前订单客户', '手动输入客户手机号'],
        success(r) { resolve(r.tapIndex); },
        fail() { resolve(-1); },
      });
    });
    if (result === 0 && !self.data.customerUserId) {
      wx.showToast({ title: '当前无订单上下文', icon: 'none' });
      return;
    }
    if (result === 1) {
      wx.showModal({
        title: '输入客户手机号',
        editable: true,
        placeholderText: '11 位手机号',
        async success(r) {
          if (r.confirm && r.content) {
            try {
              const res: any = await get('/users', { keyword: r.content.trim(), pageSize: 1 });
              const user = (res.items || [])[0];
              if (user) {
                self.setData({
                  customerUserId: user.id,
                  customerName: user.nickname || user.phone || '客户',
                });
              } else {
                wx.showToast({ title: '未找到该客户', icon: 'none' });
              }
            } catch {
              wx.showToast({ title: '查询失败', icon: 'none' });
            }
          }
        },
      });
    }
  },

  async chooseImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        self.uploadImage(file.tempFilePath);
      },
      fail() { /* 用户取消 */ },
    });
  },

  async uploadImage(filePath: string) {
    this.setData({ uploading: true });
    wx.uploadFile({
      url: `${API_BASE_URL}/documents/raw-upload`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${getToken() || ''}` },
      success: (res) => {
        try {
          const data = JSON.parse(res.data as string);
          const url = data?.data?.url || data?.url;
          if (url) {
            this.setData({ sourceImage: url });
            wx.showToast({ title: '已上传，正在识别…', icon: 'none' });
            this.runOcr(url);
          } else {
            wx.showToast({ title: data?.message || '上传失败', icon: 'none' });
          }
        } catch {
          wx.showToast({ title: '返回格式错误', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ uploading: false });
      },
    });
  },

  async runOcr(imageUrl: string) {
    this.setData({ ocrParsing: true });
    try {
      const res: any = await post('/prescription-ocr/parse', { imageUrl });
      const items: any[] = Array.isArray(res?.items) ? res.items : [];
      if (items.length > 0) {
        this.applyOcrItems(items);
      } else {
        wx.showToast({ title: 'OCR 未识别，请手动填写', icon: 'none', duration: 2000 });
      }
    } catch {
      // OCR 失败不阻断流程，继续手动填写
    } finally {
      this.setData({ ocrParsing: false });
    }
  },

  applyOcrItems(ocrList: any[]) {
    const newItems: ItemRow[] = ocrList.map((ocr: any) => ({
      medicineName: String(ocr.medicineName || ''),
      specification: String(ocr.specification || ''),
      severity: (ocr.severity as Severity) || 'medium',
      dosePerTime: Number(ocr.defaultDosePerTime || 1),
      timesPerDay: Number(ocr.defaultTimesPerDay || 1),
      totalQuantity: 0,
      unit: String(ocr.defaultUnit || '片'),
      dosage: String(ocr.dosage || ''),
      instructions: String(ocr.instructions || ''),
      endDatePreview: '',
    }));
    this.setData({ items: newItems });
    this.syncSeverityIndex();
    newItems.forEach((_, i) => this.refreshItemPreview(i));
    wx.showToast({
      title: `识别 ${ocrList.length} 种药品，请补填总药量`,
      icon: 'none',
      duration: 2500,
    });
  },

  removeImage() {
    this.setData({ sourceImage: '' });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.customerUserId) {
      wx.showToast({ title: '请选择客户', icon: 'none' });
      return;
    }
    for (const item of this.data.items) {
      if (!item.medicineName?.trim()) {
        wx.showToast({ title: '存在未填写药名', icon: 'none' });
        return;
      }
      if (!item.dosePerTime || !item.timesPerDay || !item.totalQuantity) {
        wx.showToast({ title: `${item.medicineName} 每次/每日/总量必填`, icon: 'none' });
        return;
      }
    }

    const TIMES_MAP: Record<number, string[]> = {
      1: ['08:00'],
      2: ['08:00', '20:00'],
      3: ['08:00', '14:00', '20:00'],
      4: ['08:00', '12:00', '17:00', '21:00'],
    };

    this.setData({ submitting: true });
    let successCount = 0;
    try {
      for (const item of this.data.items) {
        const timesPerDay = Number(item.timesPerDay);
        const reminderTimes = TIMES_MAP[timesPerDay] || ['08:00', '12:00', '18:00'];

        const total = Number(item.totalQuantity);
        const dose = Number(item.dosePerTime);
        let endDate: string | undefined;
        if (total && dose && timesPerDay && this.data.startDate) {
          const days = Math.max(1, Math.ceil(total / (dose * timesPerDay)));
          endDate = formatDate(addDays(new Date(this.data.startDate), days - 1));
        }

        await post('/medication-reminders', {
          userId: this.data.customerUserId,
          serviceTargetId: this.data.serviceTargetId || undefined,
          orderId: this.data.orderId ? Number(this.data.orderId) : undefined,
          medicineName: item.medicineName.trim(),
          specification: item.specification || undefined,
          severity: item.severity,
          dosePerTime: dose,
          timesPerDay,
          totalQuantity: total,
          unit: item.unit || '片',
          frequency: 'daily',
          reminderTimes,
          startDate: this.data.startDate,
          endDate,
          dosage: item.dosage || undefined,
          instructions: item.instructions || undefined,
        });
        successCount++;
      }
      wx.showToast({ title: `已创建 ${successCount} 条用药提醒`, icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
