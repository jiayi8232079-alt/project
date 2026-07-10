import { get, post, getPublic } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../utils/identity';
import { requestMedicationSubscribe } from '../../utils/subscribe';

const DEFAULT_REMINDER_TIME = '08:00';

const EXECUTION_LABELS: Record<string, string> = {
  taken: '已服药',
  missed: '漏服',
  skipped: '已跳过',
  pending: '待服药',
};

interface TodayDoseChip {
  time: string;
  status: 'taken' | 'missed' | 'skipped' | 'pending';
  statusLabel: string;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCreateForm() {
  const today = new Date();
  const end = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  return {
    medicineName: '',
    dosage: '',
    serviceTargetId: '',
    reminderTimes: [DEFAULT_REMINDER_TIME],
    startDate: formatDate(today),
    endDate: formatDate(end),
    instructions: '',
  };
}

Page({
  data: {
    statusBarHeight: 20,
    reminders: [] as any[],
    activeTab: 'active',
    refreshing: false,
    showCreatePanel: false,
    submitting: false,
    serviceTargets: [] as any[],
    selectedServiceTargetIndex: -1,
    timeDraft: DEFAULT_REMINDER_TIME,
    createForm: buildCreateForm(),
    pageNeedsLogin: false,
    // 剂量字典（由后端 system_configs 统一管理，运营可改）
    // -1 表示未选，picker 展示占位文案；>=0 表示选中 dosageOptions[i]
    dosageOptions: [] as string[],
    selectedDosageIndex: -1,
    dosageFallback: '按医嘱',
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    this.loadDosageDictionary();
  },

  async loadDosageDictionary() {
    try {
      const res = await getPublic<{
        options?: string[];
        fallback?: string;
      }>('/system/config/public/medication-dosage-dictionary');
      this.setData({
        dosageOptions: Array.isArray(res?.options) ? res!.options : [],
        dosageFallback: res?.fallback || '按医嘱',
      });
    } catch (e) {
      console.log('加载剂量字典失败', e);
      this.setData({ dosageOptions: [] });
    }
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    this.loadReminders();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadReminders() {
    try {
      const activeOnly = this.data.activeTab === 'active' ? 'true' : 'false';
      const [medicationRes, followUpRes] = await Promise.all([
        get('/medication-reminders/my', { activeOnly, type: 'medication' }),
        get('/medication-reminders/my', { activeOnly, type: 'follow_up' }),
      ]);
      const all = [
        ...(Array.isArray(medicationRes) ? medicationRes : []),
        ...(Array.isArray(followUpRes) ? followUpRes : []),
      ];

      const today = formatDate(new Date());
      let executionMap: Record<string, 'taken' | 'missed' | 'skipped' | 'pending'> = {};
      try {
        const executionRes: any = await get('/medication-executions', {
          startDate: today,
          endDate: today,
        });
        const execItems = Array.isArray(executionRes?.items) ? executionRes.items : [];
        for (const ex of execItems) {
          const key = `${ex.reminderId}_${ex.scheduledTime}`;
          executionMap[key] = ex.status;
        }
      } catch {
        /* ignore */
      }

      const mapped = all.map((r: any) => {
        const reminderType = r.reminderType || 'medication';
        const reminderTimes = Array.isArray(r.reminderTimes) ? r.reminderTimes : [];
        const startDateStr = (r.startDate || '').split('T')[0];
        const endDateStr = (r.endDate || '').split('T')[0];
        const activeToday =
          reminderType === 'medication' &&
          r.status === 'active' &&
          startDateStr <= today &&
          endDateStr >= today;
        const todayDoses: TodayDoseChip[] = activeToday
          ? reminderTimes.map((t: string) => {
              const key = `${r.id}_${t}`;
              const status = executionMap[key] || 'pending';
              return {
                time: t,
                status,
                statusLabel: EXECUTION_LABELS[status] || '待服药',
              };
            })
          : [];
        return {
          ...r,
          reminderType,
          notes: r.notes || r.instructions || '',
          reminderTimes,
          startDateStr,
          endDateStr,
          todayDoses,
        };
      }).sort((a: any, b: any) => {
        const aTime = new Date(a.startDate || a.createdAt || 0).getTime();
        const bTime = new Date(b.startDate || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      this.setData({ reminders: mapped, refreshing: false });
    } catch (e) {
      console.log('加载用药提醒失败', e);
      this.setData({ refreshing: false });
    }
  },

  async onDoseTap(e: any) {
    const reminderId = Number(e.currentTarget.dataset.reminderid);
    const time = String(e.currentTarget.dataset.time || '');
    const status = String(e.currentTarget.dataset.status || '');
    if (!reminderId || !time) return;

    const actions: Array<{ label: string; value: string }> = [];
    if (status !== 'taken') actions.push({ label: '已服药 ✓', value: 'taken' });
    if (status !== 'skipped') actions.push({ label: '不服用 / 跳过', value: 'skipped' });
    if (status !== 'missed') actions.push({ label: '已漏服', value: 'missed' });

    const result = await new Promise<number>((resolve) => {
      wx.showActionSheet({
        itemList: actions.map((a) => a.label),
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (result < 0 || !actions[result]) return;

    try {
      await post('/medication-executions/check-in', {
        reminderId,
        scheduledDate: formatDate(new Date()),
        scheduledTime: time,
        status: actions[result].value,
      });
      wx.showToast({ title: '已记录', icon: 'success' });
      // 严格模式：打卡成功顺势申请一次订阅，为下次推送累积授权
      requestMedicationSubscribe();
      this.loadReminders();
    } catch (err) {
      console.log('打卡失败', err);
    }
  },

  async loadServiceTargets() {
    try {
      const res: any = await get('/users/me/service-targets');
      const list = res?.items || res || [];
      const serviceTargets = Array.isArray(list) ? list : [];
      this.setData({
        serviceTargets,
        selectedServiceTargetIndex:
          this.data.selectedServiceTargetIndex >= serviceTargets.length
            ? -1
            : this.data.selectedServiceTargetIndex,
      });
    } catch (e) {
      console.log('加载服务对象失败', e);
    }
  },

  goBack() {
    wx.navigateBack();
  },

  async goAdd() {
    if (this.data.showCreatePanel) {
      this.closeCreatePanel();
      return;
    }
    await this.loadServiceTargets();
    if (!this.data.dosageOptions.length) {
      this.loadDosageDictionary();
    }
    this.setData({
      showCreatePanel: true,
      timeDraft: DEFAULT_REMINDER_TIME,
      createForm: buildCreateForm(),
      selectedServiceTargetIndex: -1,
      selectedDosageIndex: -1,
    });
  },

  closeCreatePanel() {
    if (this.data.submitting) return;
    this.setData({
      showCreatePanel: false,
      timeDraft: DEFAULT_REMINDER_TIME,
      createForm: buildCreateForm(),
      selectedServiceTargetIndex: -1,
      selectedDosageIndex: -1,
    });
  },

  onDosageChange(e: any) {
    const index = Number(e.detail.value);
    const options = this.data.dosageOptions || [];
    const value = options[index] || '';
    this.setData({
      selectedDosageIndex: index,
      'createForm.dosage': value,
    });
  },

  onCreateInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`createForm.${field}`]: e.detail.value });
  },

  onServiceTargetChange(e: any) {
    const index = Number(e.detail.value);
    const target = this.data.serviceTargets[index];
    this.setData({
      selectedServiceTargetIndex: index,
      'createForm.serviceTargetId': target?.id ? String(target.id) : '',
    });
  },

  onStartDateChange(e: any) {
    const startDate = e.detail.value;
    const endDate =
      this.data.createForm.endDate < startDate
        ? startDate
        : this.data.createForm.endDate;
    this.setData({
      'createForm.startDate': startDate,
      'createForm.endDate': endDate,
    });
  },

  onEndDateChange(e: any) {
    this.setData({ 'createForm.endDate': e.detail.value });
  },

  onTimeDraftChange(e: any) {
    this.setData({ timeDraft: e.detail.value });
  },

  addReminderTime() {
    const time = this.data.timeDraft;
    const times = this.data.createForm.reminderTimes || [];
    if (times.includes(time)) {
      wx.showToast({ title: '该时间已添加', icon: 'none' });
      return;
    }
    const sorted = [...times, time].sort();
    this.setData({ 'createForm.reminderTimes': sorted });
  },

  removeReminderTime(e: any) {
    const time = e.currentTarget.dataset.time;
    const times = (this.data.createForm.reminderTimes || []).filter(
      (t: string) => t !== time,
    );
    this.setData({
      'createForm.reminderTimes': times,
    });
  },

  async submitCreate() {
    if (this.data.submitting) return;
    const form = this.data.createForm;
    const medicineName = String(form.medicineName || '').trim();
    if (!medicineName) {
      wx.showToast({ title: '请输入药品名称', icon: 'none' });
      return;
    }
    if (!form.reminderTimes?.length) {
      wx.showToast({ title: '请至少添加一个提醒时间', icon: 'none' });
      return;
    }
    if (!form.startDate || !form.endDate) {
      wx.showToast({ title: '请选择开始和结束日期', icon: 'none' });
      return;
    }
    if (form.endDate < form.startDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' });
      return;
    }

    const payload: any = {
      medicineName,
      dosage: String(form.dosage || '').trim() || undefined,
      frequency: 'daily',
      reminderTimes: form.reminderTimes,
      startDate: form.startDate,
      endDate: form.endDate,
      instructions: String(form.instructions || '').trim() || undefined,
      channel: 'mini_program',
    };

    if (form.serviceTargetId) {
      payload.serviceTargetId = Number(form.serviceTargetId);
    }

    this.setData({ submitting: true });
    try {
      await post('/medication-reminders/my', payload);
      wx.showToast({ title: '提醒已添加', icon: 'success' });
      requestMedicationSubscribe();
      this.setData({
        activeTab: 'active',
        showCreatePanel: false,
        timeDraft: DEFAULT_REMINDER_TIME,
        createForm: buildCreateForm(),
        selectedServiceTargetIndex: -1,
      });
      this.loadReminders();
    } catch (e) {
      console.log('创建用药提醒失败', e);
      wx.showToast({ title: '创建失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  switchTab(e: any) {
    if (this.data.showCreatePanel) return;
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab }, () => {
      this.loadReminders();
    });
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadReminders();
  },

  goDrugRisk() {
    wx.navigateTo({ url: '/pages/drug-risk/drug-risk' });
  },
});
