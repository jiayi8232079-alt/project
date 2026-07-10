import { get, post } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

/** 当前默认涂鸦产品 PID（陪了个伴机器人）。真实接入后由配网回调返回，可覆盖。 */
const DEFAULT_PRODUCT_ID = 'hdmfmu2akvw4egia';

const DEVICE_TYPES = [
  { value: 'robot', label: '陪伴机器人', desc: '语音陪伴 / AI 对话 / 提醒' },
  { value: 'radar', label: '跌倒雷达', desc: '毫米波跌倒检测' },
];

Page({
  data: {
    statusBarHeight: 0,
    pageNeedsLogin: false,
    submitting: false,
    loadingTargets: false,
    deviceTypes: DEVICE_TYPES,
    targets: [] as any[],
    targetIndex: -1,
    form: {
      name: '',
      deviceType: 'robot',
      tuyaDeviceId: '',
    },
  },

  onLoad() {
    const sys = wx.getWindowInfo?.() || wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    this.loadTargets();
  },

  async loadTargets() {
    if (this.data.loadingTargets) return;
    this.setData({ loadingTargets: true });
    try {
      const res: any = await get('/users/me/service-targets');
      const list = Array.isArray(res) ? res : res?.items || [];
      const targets = list.map((t: any) => ({
        id: t.id,
        name: t.name || '家人',
      }));
      // 仅一位老人时默认选中，减少操作
      const targetIndex = targets.length === 1 ? 0 : this.data.targetIndex;
      this.setData({ targets, targetIndex });
    } catch (e) {
      console.log('加载服务对象失败', e);
    } finally {
      this.setData({ loadingTargets: false });
    }
  },

  onNameInput(e: any) {
    this.setData({ 'form.name': e.detail.value });
  },

  onDeviceIdInput(e: any) {
    this.setData({ 'form.tuyaDeviceId': (e.detail.value || '').trim() });
  },

  selectType(e: any) {
    const v = e.currentTarget.dataset.value;
    if (!v) return;
    this.setData({ 'form.deviceType': v });
  },

  onTargetChange(e: any) {
    this.setData({ targetIndex: Number(e.detail.value) });
  },

  scanDevice() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const code = (res.result || '').trim();
        if (code) {
          this.setData({ 'form.tuyaDeviceId': code });
          wx.showToast({ title: '已识别设备码', icon: 'none' });
        }
      },
      fail: () => {
        // 用户取消扫码不提示
      },
    });
  },

  /** mock 阶段：一键填入模拟设备号，便于无硬件联调 */
  useMockDevice() {
    const mockId = `mock_${Date.now().toString(36)}`;
    this.setData({ 'form.tuyaDeviceId': mockId });
    wx.showToast({ title: '已填入模拟设备', icon: 'none' });
  },

  goToFamily() {
    wx.navigateTo({ url: '/pages/family/family' });
  },

  validate(): string | null {
    const { form, targets, targetIndex } = this.data;
    if (!form.name.trim()) return '请填写设备名称';
    if (targetIndex < 0 || !targets[targetIndex]) return '请选择关联老人';
    if (!form.tuyaDeviceId.trim()) return '请扫码或填写设备识别码';
    if (form.tuyaDeviceId.trim().length < 3) return '设备识别码至少 3 位';
    return null;
  },

  async submit() {
    if (this.data.submitting) return;
    const err = this.validate();
    if (err) {
      wx.showToast({ title: err, icon: 'none' });
      return;
    }
    const { form, targets, targetIndex } = this.data;
    this.setData({ submitting: true });
    try {
      await post('/devices/bind', {
        tuyaDeviceId: form.tuyaDeviceId.trim(),
        productId: DEFAULT_PRODUCT_ID,
        name: form.name.trim(),
        type: form.deviceType,
        serviceTargetId: targets[targetIndex].id,
      });
      wx.showToast({ title: '绑定成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/device/index/index' });
      }, 700);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '绑定失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  goBack() {
    navigateBackOrHome();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },
});
