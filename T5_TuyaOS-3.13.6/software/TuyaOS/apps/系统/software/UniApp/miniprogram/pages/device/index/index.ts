import { get, del } from '../../../utils/request';
import { isLoggedIn, getUserInfo } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const TYPE_LABELS: Record<string, string> = {
  robot: '陪伴机器人',
  radar: '跌倒雷达',
  wearable: '健康穿戴',
};

const STATUS_LABELS: Record<string, string> = {
  active: '使用中',
  pending: '待激活',
  suspended: '已停用',
  decommissioned: '已退役',
};

function formatOnline(iso?: string) {
  if (!iso) return '从未上线';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚在线';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前在线`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前在线`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${pad(d.getDate())} 在线`;
}

Page({
  data: {
    statusBarHeight: 0,
    pageNeedsLogin: false,
    loading: false,
    refreshing: false,
    loaded: false,
    devices: [] as any[],
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
    this.loadDevices();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadDevices().finally(() => this.setData({ refreshing: false }));
  },

  async loadDevices() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res: any = await get('/devices/me/list');
      const list = Array.isArray(res) ? res : res?.items || [];
      const devices = list.map((d: any) => ({
        id: d.id,
        name: d.name || '陪伴设备',
        type: d.type,
        typeLabel: TYPE_LABELS[d.type] || '设备',
        online: !!d.online,
        statusLabel: STATUS_LABELS[d.status] || '',
        batteryPercent: typeof d.batteryPercent === 'number' ? d.batteryPercent : null,
        batteryLow: typeof d.batteryPercent === 'number' && d.batteryPercent < 20,
        onlineText: d.online ? '在线' : formatOnline(d.lastOnlineAt),
        firmwareVersion: d.firmwareVersion || '',
      }));
      this.setData({ devices, loaded: true });
    } catch (e) {
      console.log('加载设备失败', e);
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/device/bind/bind' });
  },

  onDeviceTap(e: any) {
    const id = e.currentTarget.dataset.id;
    const device = this.data.devices.find((d) => d.id === id);
    if (!device) return;
    wx.showActionSheet({
      itemList: ['查看 AI 对话摘要', '解绑设备'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: `/pages/ai/dialog-summary/dialog-summary?deviceId=${id}&name=${encodeURIComponent(device.name)}`,
          });
        } else if (res.tapIndex === 1) {
          this.confirmUnbind(id);
        }
      },
    });
  },

  async confirmUnbind(deviceId: number) {
    const ok = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '解绑设备',
        content: '解绑后将不再接收该设备的状态与告警，确定继续？',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!ok) return;
    try {
      const detail: any = await get(`/devices/${deviceId}`);
      const bindings = detail?.bindings || [];
      const myId = getUserInfo()?.id;
      const mine =
        bindings.find((b: any) => b.userId === myId) || bindings[0];
      if (!mine?.id) {
        wx.showToast({ title: '未找到绑定关系', icon: 'none' });
        return;
      }
      await del(`/devices/bindings/${mine.id}`);
      wx.showToast({ title: '已解绑', icon: 'success' });
      this.loadDevices();
    } catch (e: any) {
      wx.showToast({ title: e?.message || '解绑失败', icon: 'none' });
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
