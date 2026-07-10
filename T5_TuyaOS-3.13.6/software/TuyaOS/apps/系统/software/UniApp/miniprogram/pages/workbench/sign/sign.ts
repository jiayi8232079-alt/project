import { get, put } from '../../../utils/request';
import { BASE_URL } from '../../../config';
import { ensureAttendantPageAccess } from '../../../utils/identity';

Page({
  data: {
    orderId: '',
    order: {} as any,
    hasSigned: false,
    submitting: false,
    statusBarHeight: 0,
  },

  canvas: null as any,
  ctx: null as any,
  lastX: 0,
  lastY: 0,
  drawing: false,
  _dpr: 1 as number,
  _canvasInitRetry: 0,
  _canvasInitTimer: 0 as any,

  onLoad(options: any) {
    if (!ensureAttendantPageAccess()) return;
    const orderId = options.orderId || options.id || '';
    const { statusBarHeight } = wx.getSystemInfoSync();
    this.setData({ orderId, statusBarHeight: statusBarHeight || 0 });
  },

  handleBack() {
    wx.navigateBack();
  },

  onReady() {
    this._scheduleInitCanvas(100);
    if (this.data.orderId) {
      this.loadOrder();
    }
  },

  // 任何布局变化（如键盘弹起/收起、分屏等）后重新测量，保证 canvas 尺寸正确
  onResize() {
    this._scheduleInitCanvas(30);
  },

  _scheduleInitCanvas(delay = 100) {
    if (this._canvasInitTimer) {
      clearTimeout(this._canvasInitTimer);
    }
    this._canvasInitRetry = 0;
    this._canvasInitTimer = setTimeout(() => this.initCanvas(), delay);
  },

  async loadOrder() {
    try {
      const res: any = await get(`/orders/${this.data.orderId}`);
      const target = res.serviceTarget || {};
      const genderText =
        target.gender === 'male' ? '男' : target.gender === 'female' ? '女' : '';
      const order = {
        ...res,
        serviceTime: this.formatTime(res.serviceTime || res.serviceStartTime, res.serviceEndTime),
        patientName: target.name || res.subjectName || res.patientName || '—',
        patientGender: genderText || res.patientGender || '',
        patientAge: target.age ? `${target.age}岁` : (res.patientAge ? `${res.patientAge}岁` : ''),
        patientPhone: target.phone || res.patientPhone || '',
        orderNo: res.orderNumber || res.orderNo || res.id || '',
        hospitalName: res.hospital || res.hospitalName || '',
      };
      this.setData({ order });
    } catch (e) {
      console.log('加载订单信息失败', e);
    }
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#signCanvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (!res?.[0]) {
          if (this._canvasInitRetry++ < 8) {
            this._canvasInitTimer = setTimeout(() => this.initCanvas(), 120);
          }
          return;
        }
        const node = res[0];
        const width = node.width || 0;
        const height = node.height || 0;
        // 尺寸尚未就绪（布局还在进行中），稍后重试
        if ((width < 50 || height < 50) && this._canvasInitRetry < 8) {
          this._canvasInitRetry++;
          this._canvasInitTimer = setTimeout(() => this.initCanvas(), 120);
          return;
        }
        const canvas = node.node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || wx.getSystemInfoSync().pixelRatio || 1;
        const pxW = Math.round(width * dpr);
        const pxH = Math.round(height * dpr);
        if (this.canvas === canvas && canvas.width === pxW && canvas.height === pxH) {
          return;
        }
        canvas.width = pxW;
        canvas.height = pxH;
        ctx.scale(dpr, dpr);

        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        this.canvas = canvas;
        this.ctx = ctx;
        this._dpr = dpr;
        this._canvasInitRetry = 0;
      });
  },

  onTouchStart(e: any) {
    if (!this.ctx) return;
    const touch = e.touches[0];
    this.lastX = touch.x;
    this.lastY = touch.y;
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(touch.x, touch.y);
    if (!this.data.hasSigned) this.setData({ hasSigned: true });
  },

  onTouchMove(e: any) {
    if (!this.drawing || !this.ctx) return;
    const touch = e.touches[0];
    const midX = (this.lastX + touch.x) / 2;
    const midY = (this.lastY + touch.y) / 2;
    this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(midX, midY);
    this.lastX = touch.x;
    this.lastY = touch.y;
  },

  onTouchEnd() {
    if (!this.drawing || !this.ctx) {
      this.drawing = false;
      return;
    }
    this.ctx.lineTo(this.lastX, this.lastY);
    this.ctx.stroke();
    this.drawing = false;
  },

  clearSign() {
    if (!this.ctx || !this.canvas) return;
    const dpr = this._dpr || wx.getSystemInfoSync().pixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.setData({ hasSigned: false });
  },

  async submitSign() {
    if (!this.data.hasSigned) {
      wx.showToast({ title: '请先签名', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const signatureUrl = await this.exportSignature();

      await put(`/orders/${this.data.orderId}/sign`, {
        signUrl: signatureUrl,
      });

      wx.showToast({ title: '签署成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (e) {
      wx.showToast({ title: '签署失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  exportSignature(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) return reject(new Error('canvas not ready'));
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        success: (res) => {
          const token = wx.getStorageSync('token');
          wx.uploadFile({
            url: `${BASE_URL}/documents/raw-upload`,
            filePath: res.tempFilePath,
            name: 'file',
            header: { Authorization: token ? `Bearer ${token}` : '' },
            success(uploadRes) {
              const data = JSON.parse(uploadRes.data);
              resolve(data.data?.url || data.url || res.tempFilePath);
            },
            fail: reject,
          });
        },
        fail: reject,
      });
    });
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
});
