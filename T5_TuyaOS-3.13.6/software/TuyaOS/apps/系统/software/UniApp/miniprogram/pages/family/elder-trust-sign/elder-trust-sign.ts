import { BASE_URL } from '../../../config';
import { post } from '../../../utils/request';

Page({
  data: {
    statusBarHeight: 0,
    memberId: 0,
    subjectName: '',
    signerName: '',
    signerPhone: '',
    signerIdCard: '',
    hasSigned: false,
    submitting: false,
    step: 'info' as 'info' | 'sign',
    showAgreement: false,
  },

  canvas: null as any,
  ctx: null as any,
  lastX: 0,
  lastY: 0,
  drawing: false,
  _dpr: 1,

  onLoad(options: any) {
    const memberId = Number(options?.memberId || 0);
    const subjectName = decodeURIComponent(options?.subjectName || '') || '老人';
    const sys = wx.getWindowInfo();
    this.setData({
      memberId,
      subjectName,
      statusBarHeight: sys.statusBarHeight || 0,
    });
    if (!memberId) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
    }
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [field]: e.detail.value });
  },

  toggleAgreement() {
    this.setData({ showAgreement: !this.data.showAgreement });
  },

  goToSign() {
    const name = (this.data.signerName || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写您的姓名', icon: 'none' });
      return;
    }
    this.setData({ step: 'sign' }, () => {
      setTimeout(() => this.initCanvas(), 50);
    });
  },

  goBackToInfo() {
    this.setData({ step: 'info', hasSigned: false });
    this.canvas = null;
    this.ctx = null;
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#trustSignCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 1;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.canvas = canvas;
        this.ctx = ctx;
        this._dpr = dpr;
      });
  },

  onTouchStart(e: any) {
    if (!this.ctx) return;
    const t = e.touches[0];
    this.lastX = t.x;
    this.lastY = t.y;
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(t.x, t.y);
    if (!this.data.hasSigned) this.setData({ hasSigned: true });
  },

  onTouchMove(e: any) {
    if (!this.drawing || !this.ctx) return;
    const t = e.touches[0];
    const mx = (this.lastX + t.x) / 2;
    const my = (this.lastY + t.y) / 2;
    this.ctx.quadraticCurveTo(this.lastX, this.lastY, mx, my);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(mx, my);
    this.lastX = t.x;
    this.lastY = t.y;
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
    const dpr = this._dpr || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.setData({ hasSigned: false });
  },

  exportSignature(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) return reject(new Error('canvas not ready'));
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        success: (res) => {
          const token = wx.getStorageSync('token');
          if (!token) {
            reject(new Error('未登录'));
            return;
          }
          wx.uploadFile({
            url: `${BASE_URL}/documents/raw-upload`,
            filePath: res.tempFilePath,
            name: 'file',
            header: { Authorization: `Bearer ${token}` },
            success: (up) => {
              try {
                const data = JSON.parse(up.data || '{}');
                const url = data?.data?.url || data?.url;
                if (url) resolve(url);
                else reject(new Error('上传签名失败'));
              } catch (err) {
                reject(err);
              }
            },
            fail: reject,
          });
        },
        fail: reject,
      });
    });
  },

  async confirmSign() {
    if (!this.data.hasSigned) {
      wx.showToast({ title: '请先签名', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const signatureUrl = await this.exportSignature();
      await post(`/family/elders/${this.data.memberId}/trust-sign`, {
        signatureUrl,
        signerName: this.data.signerName,
        signerPhone: this.data.signerPhone || undefined,
        signerIdCard: this.data.signerIdCard || undefined,
        signerRelation: '子女',
      });
      wx.showToast({ title: '签署完成', icon: 'success' });
      setTimeout(() => {
        const pages = getCurrentPages();
        const delta = Math.min(2, pages.length - 1);
        if (delta > 0) wx.navigateBack({ delta });
        else wx.switchTab({ url: '/pages/mine/mine' });
      }, 1000);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '签署失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
