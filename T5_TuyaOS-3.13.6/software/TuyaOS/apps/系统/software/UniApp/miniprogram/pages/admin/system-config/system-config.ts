import { get, put, post } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';
import { getUserInfo } from '../../../utils/auth';

const STORE_FIELDS = [
  { key: 'store_name', label: '门店名称', placeholder: '陪了个伴' },
  { key: 'store_phone', label: '门店电话', placeholder: '400-xxxx-xxxx' },
  { key: 'store_address', label: '门店地址', placeholder: '输入地址' },
  { key: 'store_hours', label: '营业时间', placeholder: '09:00-18:00' },
  { key: 'store_wechat', label: '微信号', placeholder: '微信号' },
  { key: 'store_description', label: '门店简介', placeholder: '一句话介绍' },
];

const NOTIFICATION_FIELDS = [
  { key: 'wechat_work_webhook', label: '企微群机器人 Webhook', placeholder: 'https://qyapi.weixin.qq.com/...' },
  { key: 'customer_service_url', label: '客服URL', placeholder: '企微客服链接' },
  { key: 'wechat_work_corpid', label: '企业微信 CorpId', placeholder: 'wxxxxxxx' },
];

const TEMPLATE_FIELDS = [
  { key: 'mini_program_template_medication_reminder', label: '用药提醒模板ID', placeholder: '' },
  { key: 'mini_program_template_order_service_reminder', label: '服务提醒模板ID', placeholder: '' },
  { key: 'mini_program_template_order_assign_notify', label: '派单通知模板ID', placeholder: '' },
  { key: 'mini_program_template_grab_pool_notify', label: '抢单通知模板ID', placeholder: '' },
  { key: 'mini_program_template_order_status_notify', label: '状态通知模板ID', placeholder: '' },
];

// 进阶签署开关：后端 service-confirm 流程读此配置决定是否拼入家属授权书 / 风险告知两页
const ADVANCED_SIGN_FIELDS = [
  {
    key: 'advanced_sign_family_authorization',
    label: '家属远程授权书',
    description: '代签场景（签署人 ≠ 本人）时强制插入家属授权书页',
  },
  {
    key: 'advanced_sign_risk_disclosure',
    label: '风险强制告知',
    description: '所有服务确认单流程插入风险告知页，需用户勾选知悉后方可签署',
  },
];

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    saving: false,
    isAdmin: false,
    storeFields: STORE_FIELDS,
    notificationFields: NOTIFICATION_FIELDS,
    templateFields: TEMPLATE_FIELDS,
    advancedSignFields: ADVANCED_SIGN_FIELDS,
    storeValues: {} as Record<string, string>,
    notificationValues: {} as Record<string, string>,
    templateValues: {} as Record<string, string>,
    advancedSignValues: {} as Record<string, boolean>,
    customConfigs: [] as { key: string; value: string; description: string }[],
    activeSection: 'store',
    sections: [
      { key: 'store', label: '门店' },
      { key: 'notification', label: '通知' },
      { key: 'template', label: '模板' },
      { key: 'sign', label: '签署' },
      { key: 'advanced', label: '高级' },
    ],
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    const userInfo = getUserInfo();
    const isAdmin = userInfo?.role === 'admin';
    this.setData({ isAdmin });
    if (isAdmin) {
      this.loadConfigs();
    } else {
      // 仅 admin 可访问。其他角色（operator/finance/customer_service 等）直接拒绝并返回。
      wx.showToast({ title: '仅超级管理员可访问', icon: 'none' });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.switchTab({ url: '/pages/mine/mine' });
      }, 500);
    }
  },

  onPullDownRefresh() {
    this.loadConfigs().then(() => wx.stopPullDownRefresh());
  },

  async loadConfigs() {
    try {
      const configs: any[] = await get('/system/configs') as any;
      const all = Array.isArray(configs) ? configs : [];
      const map: Record<string, string> = {};
      all.forEach((c: any) => { map[c.key] = c.value || ''; });

      const storeValues: Record<string, string> = {};
      STORE_FIELDS.forEach(f => { storeValues[f.key] = map[f.key] || ''; });

      const notificationValues: Record<string, string> = {};
      NOTIFICATION_FIELDS.forEach(f => { notificationValues[f.key] = map[f.key] || ''; });

      const templateValues: Record<string, string> = {};
      TEMPLATE_FIELDS.forEach(f => { templateValues[f.key] = map[f.key] || ''; });

      const advancedSignValues: Record<string, boolean> = {};
      ADVANCED_SIGN_FIELDS.forEach(f => {
        advancedSignValues[f.key] = String(map[f.key] || '').toLowerCase() === 'true';
      });

      const knownKeys = new Set([
        ...STORE_FIELDS.map(f => f.key),
        ...NOTIFICATION_FIELDS.map(f => f.key),
        ...TEMPLATE_FIELDS.map(f => f.key),
        ...ADVANCED_SIGN_FIELDS.map(f => f.key),
      ]);
      const customConfigs = all
        .filter((c: any) => !knownKeys.has(c.key))
        .map((c: any) => ({ key: c.key, value: c.value || '', description: c.description || '' }));

      this.setData({
        storeValues,
        notificationValues,
        templateValues,
        advancedSignValues,
        customConfigs,
        loaded: true,
      });
    } catch (e) {
      console.error('加载配置失败', e);
      this.setData({ loaded: true });
    }
  },

  switchSection(e: any) {
    this.setData({ activeSection: e.currentTarget.dataset.section });
  },

  onStoreInput(e: any) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`storeValues.${key}`]: e.detail.value });
  },

  onNotificationInput(e: any) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`notificationValues.${key}`]: e.detail.value });
  },

  onTemplateInput(e: any) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`templateValues.${key}`]: e.detail.value });
  },

  onAdvancedSignToggle(e: any) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`advancedSignValues.${key}`]: !!e.detail.value });
  },

  onCustomInput(e: any) {
    const idx = e.currentTarget.dataset.index;
    const field = e.currentTarget.dataset.field;
    this.setData({ [`customConfigs[${idx}].${field}`]: e.detail.value });
  },

  addCustomConfig() {
    this.setData({
      customConfigs: [...this.data.customConfigs, { key: '', value: '', description: '' }],
    });
  },

  removeCustomConfig(e: any) {
    const idx = e.currentTarget.dataset.index;
    const configs = [...this.data.customConfigs];
    configs.splice(idx, 1);
    this.setData({ customConfigs: configs });
  },

  async saveAll() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const configs: { key: string; value: string; description?: string }[] = [];

      const addSection = (fields: typeof STORE_FIELDS, values: Record<string, string>) => {
        fields.forEach(f => { configs.push({ key: f.key, value: values[f.key] || '' }); });
      };

      addSection(STORE_FIELDS, this.data.storeValues);
      addSection(NOTIFICATION_FIELDS, this.data.notificationValues);
      addSection(TEMPLATE_FIELDS, this.data.templateValues);

      ADVANCED_SIGN_FIELDS.forEach(f => {
        configs.push({
          key: f.key,
          value: this.data.advancedSignValues[f.key] ? 'true' : 'false',
          description: f.description,
        });
      });

      this.data.customConfigs.forEach(c => {
        if (c.key.trim()) {
          configs.push({ key: c.key.trim(), value: c.value, description: c.description });
        }
      });

      await put('/system/configs', configs as any);
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async testWebhook() {
    const webhook = this.data.notificationValues['wechat_work_webhook'];
    if (!webhook) {
      wx.showToast({ title: '请先填写 Webhook 地址', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '测试中...' });
      await post('/system/wechat/webhook/test', { webhook, content: '【陪了个伴】小程序端测试消息' });
      wx.hideLoading();
      wx.showToast({ title: '发送成功', icon: 'success' });
    } catch (e: any) {
      wx.hideLoading();
      wx.showToast({ title: e?.message || '测试失败', icon: 'none' });
    }
  },

  handleBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
    }
  },
});
