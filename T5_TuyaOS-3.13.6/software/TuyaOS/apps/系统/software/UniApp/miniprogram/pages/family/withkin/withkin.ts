import { get, post, put } from '../../../utils/request';

function extractList(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return value.items || value.list || value.records || value.rows || value.data || [];
}

Page({
  data: {
    loading: false,
    familyId: '1',
    elderId: '1',
    deviceId: '1',
    message: '爸，记得喝水。',
    taskTitle: '提醒喝水',
    volume: 70,
    brightness: 80,
    communityContentEnabled: true,
    communityContent: [] as any[],
    familyTasks: [] as any[],
    voiceprints: [] as any[],
  },

  onLoad() {
    void this.loadAll();
  },

  onPullDownRefresh() {
    void this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  onInput(e: any) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value } as any);
  },

  onVolumeChange(e: any) {
    this.setData({ volume: e.detail.value });
  },

  onBrightnessChange(e: any) {
    this.setData({ brightness: e.detail.value });
  },

  onCommunityToggle(e: any) {
    this.setData({ communityContentEnabled: e.detail.value });
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const familyId = this.data.familyId;
      const [content, tasks, voiceprints, settings]: any[] = await Promise.all([
        get('/community-content', undefined, { silent: true }).catch(() => []),
        get('/family/tasks', { familyId }, { silent: true }).catch(() => []),
        get(`/voiceprints/family/${familyId}`, undefined, { silent: true }).catch(() => []),
        get(`/device-settings/${this.data.deviceId}`, undefined, { silent: true }).catch(() => ({})),
      ]);
      this.setData({
        communityContent: extractList(content).slice(0, 6),
        familyTasks: extractList(tasks).slice(0, 6),
        voiceprints: extractList(voiceprints).slice(0, 6),
        volume: settings?.volume ?? this.data.volume,
        brightness: settings?.screenBrightness ?? this.data.brightness,
        communityContentEnabled: settings?.communityContentEnabled ?? this.data.communityContentEnabled,
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async sendMessage() {
    const message = this.data.message.trim();
    if (!message) {
      wx.showToast({ title: '请输入留言内容', icon: 'none' });
      return;
    }
    await post('/family/family-messages', {
      familyId: Number(this.data.familyId),
      elderId: Number(this.data.elderId),
      message,
    });
    wx.showToast({ title: '留言已发送', icon: 'success' });
  },

  async createTask() {
    await post('/family/tasks', {
      familyId: Number(this.data.familyId),
      elderId: Number(this.data.elderId),
      title: this.data.taskTitle || '家庭提醒',
      type: 'family_reminder',
      message: this.data.message,
    });
    wx.showToast({ title: '提醒已创建', icon: 'success' });
    void this.loadAll();
  },

  async saveDeviceSettings() {
    await put(`/device-settings/${this.data.deviceId}`, {
      volume: this.data.volume,
      screenBrightness: this.data.brightness,
      communityContentEnabled: this.data.communityContentEnabled,
      privacyVisibility: 'guardian_only',
    });
    wx.showToast({ title: '设备设置已下发', icon: 'success' });
  },
});
