import { post } from '../../../utils/request';
import { BASE_URL } from '../../../config';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const CATEGORY_OPTIONS = [
  { value: 'service', label: '服务质量' },
  { value: 'attendant', label: '陪诊员相关' },
  { value: 'dispatch', label: '派单/响应' },
  { value: 'payment', label: '支付/退款' },
  { value: 'report', label: '报告/资料' },
  { value: 'other', label: '其他' },
];

Page({
  data: {
    statusBarHeight: 0,
    pageNeedsLogin: false,
    loaded: false,
    orderId: '',
    orderSnapshot: null as any,
    categoryOptions: CATEGORY_OPTIONS,
    categoryIndex: 0,
    subject: '',
    description: '',
    contactPhone: '',
    images: [] as string[],
    uploading: false,
    submitting: false,
    agreement: true,
  },

  onLoad(options: any) {
    const sys = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    if (options.orderId) {
      this.setData({ orderId: String(options.orderId) });
    }
    if (options.attendantId) {
      this.setData({
        categoryIndex: CATEGORY_OPTIONS.findIndex((c) => c.value === 'attendant'),
      });
    }
    setTimeout(() => this.setData({ loaded: true }), 80);
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' }).catch(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      });
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },
  backFromGate() {
    navigateBackOrHome();
  },

  onCategoryChange(e: any) {
    this.setData({ categoryIndex: Number(e.detail.value) || 0 });
  },

  onSubjectInput(e: any) {
    this.setData({ subject: e.detail.value });
  },

  onDescInput(e: any) {
    this.setData({ description: e.detail.value });
  },

  onPhoneInput(e: any) {
    this.setData({ contactPhone: e.detail.value });
  },

  onAgreementChange(e: any) {
    this.setData({ agreement: e.detail.value });
  },

  chooseImages() {
    const remaining = 9 - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传 9 张图片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const paths = (res.tempFiles || []).map((f: any) => f.tempFilePath);
        if (!paths.length) return;
        this.setData({ uploading: true });
        try {
          const urls = await this.uploadPaths(paths);
          this.setData({
            images: [...this.data.images, ...urls].slice(0, 9),
          });
        } catch (e: any) {
          wx.showToast({
            title: e?.message || '上传失败',
            icon: 'none',
          });
        } finally {
          this.setData({ uploading: false });
        }
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '');
        if (!msg.includes('cancel')) {
          wx.showToast({ title: '未选择图片', icon: 'none' });
        }
      },
    });
  },

  removeImage(e: any) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
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
              reject(new Error('上传失败'));
              return;
            }
            try {
              const data = JSON.parse(res.data || '{}');
              if (
                data.code !== undefined &&
                data.code !== 0 &&
                data.code !== 200
              ) {
                reject(new Error(data.message || '上传失败'));
                return;
              }
              const uploadedUrl = data.data?.url || data.url;
              if (!uploadedUrl) {
                reject(new Error('上传成功但未返回文件地址'));
                return;
              }
              resolve(uploadedUrl);
            } catch (err) {
              reject(err as Error);
            }
          },
          fail(err) {
            reject(new Error(err?.errMsg || '上传失败'));
          },
        });
      });
      urls.push(url);
    }
    return urls;
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const subject = (this.data.subject || '').trim();
    const description = (this.data.description || '').trim();
    if (subject.length < 2) {
      wx.showToast({ title: '请填写标题（至少 2 字）', icon: 'none' });
      return;
    }
    if (description.length < 5) {
      wx.showToast({ title: '请补充描述（至少 5 字）', icon: 'none' });
      return;
    }
    if (!this.data.agreement) {
      wx.showToast({ title: '请勾选服务协议', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const category =
        CATEGORY_OPTIONS[this.data.categoryIndex]?.value || 'other';
      const payload: Record<string, any> = {
        category,
        subject,
        description,
        images: this.data.images,
      };
      if (this.data.orderId) {
        payload.orderId = Number(this.data.orderId);
      }
      if (this.data.contactPhone) {
        payload.contactPhone = this.data.contactPhone.trim();
      }
      await post('/complaints', payload);
      wx.showToast({ title: '提交成功，客服会尽快处理', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/complaint/list/list' });
      }, 800);
    } catch (e: any) {
      wx.showToast({
        title: e?.message || '提交失败',
        icon: 'none',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  previewImage(e: any) {
    const idx = Number(e.currentTarget.dataset.index || 0);
    const list = this.data.images;
    if (!list[idx]) return;
    wx.previewImage({
      current: list[idx],
      urls: list,
    });
  },
});
