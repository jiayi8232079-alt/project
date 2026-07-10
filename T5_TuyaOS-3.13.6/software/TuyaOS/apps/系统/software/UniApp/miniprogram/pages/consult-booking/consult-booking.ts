import { goToCustomerService, preloadCustomerServiceConfig } from '../../utils/customerService';
import { getStoreInfo } from '../../utils/storeInfo';
import { isLoggedIn } from '../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../utils/identity';

const SERVICE_LABELS: Record<string, string> = {
  checkup: '体检规划', expert: '专家匹配', escort: '陪诊服务',
  consult: '门诊咨询', store: '到店预约', fetch: '代取报告',
};

const STORE_CONSULT_OPTIONS = ['医疗资源协调', '体检规划', '陪诊服务'];
const MEDICAL_COORDINATION_SUB_TYPES = ['专家匹配', '门诊协调', '住院协调'];

interface DateOption {
  date: string;
  week: string;
  day: string;
  isToday: boolean;
}

interface TimeOption {
  label: string;
  value: string;
  disabled: boolean;
  remaining?: number;
  booked?: number;
  capacity?: number;
}

interface TimeGroup {
  key: string;
  label: string;
  hint: string;
  items: TimeOption[];
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekLabel(d: Date) {
  const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return map[d.getDay()] || '';
}

function getTimeGroupMeta(time: string) {
  const hour = Number(String(time || '').split(':')[0] || 0);
  if (hour < 12) {
    return { key: 'morning', label: '上午时段', hint: '适合上午到店咨询' };
  }
  if (hour < 18) {
    return { key: 'afternoon', label: '下午时段', hint: '适合午后灵活安排' };
  }
  return { key: 'evening', label: '晚间时段', hint: '适合下班后到店沟通' };
}

function buildTimeGroups(list: TimeOption[]): TimeGroup[] {
  const order = ['morning', 'afternoon', 'evening'];
  const grouped = new Map<string, TimeGroup>();
  list.forEach((item) => {
    const meta = getTimeGroupMeta(item.value || item.label);
    if (!grouped.has(meta.key)) {
      grouped.set(meta.key, {
        key: meta.key,
        label: meta.label,
        hint: meta.hint,
        items: [],
      });
    }
    grouped.get(meta.key)!.items.push(item);
  });

  return order
    .map((key) => grouped.get(key))
    .filter((group): group is TimeGroup => group != null && group.items.length > 0);
}

Page({
  data: {
    serviceInterest: '',
    serviceInterestText: '专家匹配',
    activeMethod: 'online',
    storeName: '陪了个伴中心',
    storeAddress: '青田县鹤城街道总部办公区（具体地址请联系客服确认）',
    storePhone: '0578-0000 0000',
    consultCategoryOptions: STORE_CONSULT_OPTIONS,
    selectedCategory: STORE_CONSULT_OPTIONS[0],
    subTypeOptions: MEDICAL_COORDINATION_SUB_TYPES,
    selectedSubType: MEDICAL_COORDINATION_SUB_TYPES[0],
    dateOptions: [] as DateOption[],
    selectedDate: '',
    timeOptions: [] as TimeOption[],
    timeGroups: [] as TimeGroup[],
    selectedTime: '',
    name: '',
    phone: '',
    submitting: false,
    pageNeedsLogin: false,
  },

  async onLoad(options: any) {
    void preloadCustomerServiceConfig();
    const source = options.source || options.type || '';
    const dateOptions = this.buildDateOptions();
    this.setData({
      serviceInterest: source,
      serviceInterestText: SERVICE_LABELS[source] || '预约咨询',
      dateOptions,
      selectedDate: dateOptions[0]?.date || '',
    });
    void this.loadStoreInfo(true);
    this.loadSlotOptions(dateOptions[0]?.date || '');
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    if (this.data.activeMethod === 'store') {
      void this.loadStoreInfo(true);
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  buildDateOptions() {
    const list: DateOption[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      list.push({
        date: formatDate(d),
        week: getWeekLabel(d),
        day: `${d.getDate()}`,
        isToday: i === 0,
      });
    }
    return list;
  },

  async loadStoreInfo(forceRefresh = false) {
    try {
      const info = await getStoreInfo(forceRefresh);
      this.setData({
        storeName: info.name || '陪了个伴中心',
        storeAddress: info.address || '青田县鹤城街道总部办公区（具体地址请联系客服确认）',
        storePhone: info.phone || '0578-0000 0000',
      });
    } catch (e) {
      console.log('加载门店信息失败', e);
    }
  },

  onSwitchMethod(e: any) {
    const method = e.currentTarget.dataset.method;
    this.setData({ activeMethod: method });
  },

  onCategorySelect(e: any) {
    const selectedCategory = e.currentTarget.dataset.value;
    this.setData({
      selectedCategory,
      selectedSubType:
        selectedCategory === '医疗资源协调' ? this.data.subTypeOptions[0] : '',
    });
  },

  onSubTypeSelect(e: any) {
    this.setData({ selectedSubType: e.currentTarget.dataset.value });
  },

  onDateSelect(e: any) {
    const selectedDate = e.currentTarget.dataset.value;
    this.setData({ selectedDate });
    this.loadSlotOptions(selectedDate);
  },

  onTimeSelect(e: any) {
    const { value, disabled } = e.currentTarget.dataset;
    if (disabled) return;
    this.setData({ selectedTime: value });
  },

  async loadSlotOptions(date: string) {
    if (!date) return;
    try {
      const { get } = require('../../utils/request');
      const res = await get('/consultations/slot-options', { date });
      const list = (res?.slots || []).map((s: any) => ({
        label: s.time,
        value: s.time,
        disabled: Boolean(s.disabled),
        remaining: Number(s.remaining || 0),
        booked: Number(s.booked || 0),
        capacity: Number(s.capacity || 0),
      }));
      const firstAvailable = list.find((x: any) => !x.disabled)?.value || '';
      this.setData({
        timeOptions: list,
        timeGroups: buildTimeGroups(list),
        selectedTime: list.some((x: any) => x.value === this.data.selectedTime && !x.disabled)
          ? this.data.selectedTime
          : firstAvailable,
      });
    } catch (e) {
      console.error('加载号源时段失败', e);
      wx.showToast({ title: '加载时段失败', icon: 'none' });
    }
  },

  onStartWechat() {
    goToCustomerService();
  },

  onNameInput(e: any) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e: any) {
    this.setData({ phone: e.detail.value });
  },

  onStartCall() {
    wx.makePhoneCall({ phoneNumber: this.data.storePhone.replace(/[^0-9]/g, '') || '057800000000' });
  },

  async onSubmit() {
    const {
      name, phone, selectedDate, selectedTime,
      activeMethod, selectedCategory, selectedSubType,
    } = this.data;

    if (activeMethod !== 'store') {
      wx.showToast({ title: '线上咨询请直接选择咨询方式', icon: 'none' });
      return;
    }
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!phone.trim() || phone.length < 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!selectedDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    if (!selectedTime) {
      wx.showToast({ title: '请选择时段', icon: 'none' });
      return;
    }
    if (selectedCategory === '医疗资源协调' && !selectedSubType) {
      wx.showToast({ title: '请选择协调方向', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const { post } = require('../../utils/request');
      const payload: any = {
        type: 'store',
        name,
        phone,
        date: selectedDate,
        time: selectedTime,
        category: selectedCategory,
        subType: selectedCategory === '医疗资源协调' ? selectedSubType : '',
      };
      if (this.data.serviceInterest) payload.serviceInterest = this.data.serviceInterest;
      await post('/consultations', payload);
      wx.showToast({ title: '预约成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (e: any) {
      console.error('提交预约失败', e);
      wx.showToast({ title: e?.message || '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
