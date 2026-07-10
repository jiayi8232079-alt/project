import { get, put } from '../../../utils/request';
import { ensureAttendantPageAccess } from '../../../utils/identity';

Page({
  data: {
    statusBarHeight: 20,
    monthTitle: '',
    calDays: [] as any[],
    selectedDate: '',
    selectedDateLabel: '',
    scheduleMap: {} as Record<string, boolean>,
    monthScheduledCount: 0,
    submitting: false,
    currentYear: 0,
    currentMonth: 0,
  },

  onLoad() {
    if (!ensureAttendantPageAccess()) return;
    const sysInfo = wx.getSystemInfoSync();
    const now = new Date();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth(),
    });
    this.buildMonth(now.getFullYear(), now.getMonth());
    this.loadMonthSchedule(now.getFullYear(), now.getMonth());

    const today = this.dateStr(now);
    this.setData({
      selectedDate: today,
      selectedDateLabel: this.formatDateLabel(today),
    });
  },

  buildMonth(year: number, month: number) {
    const title = `${year}年${month + 1}月`;
    const today = this.dateStr(new Date());

    // First day of month
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calDays: any[] = [];

    // Empty cells before month start
    for (let i = 0; i < firstDay; i++) {
      calDays.push({ key: `e${i}`, empty: true, num: '' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calDays.push({
        key: date,
        date,
        num: String(d),
        empty: false,
        isPast: date < today,
        isToday: date === today,
        isSelected: date === this.data.selectedDate,
        isScheduled: false,
      });
    }

    this.setData({
      monthTitle: title,
      calDays,
      currentYear: year,
      currentMonth: month,
    });
  },

  async loadMonthSchedule(year: number, month: number) {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res: any = await get('/attendants/me/schedules', { startDate, endDate });
      const items = res.items || res || [];

      const scheduleMap: Record<string, boolean> = { ...this.data.scheduleMap };
      const scheduledDates = new Set<string>();

      items.forEach((item: any) => {
        const rawDate = item.date;
        const date = typeof rawDate === 'string' ? rawDate.slice(0, 10) : this.dateStr(new Date(rawDate));
        const slotMap: Record<string, string> = {
          morning: 'morning',
          afternoon: 'afternoon',
          evening: 'evening',
          full_day: 'morning',
          allday: 'morning',
        };
        const slot = slotMap[item.period || item.slot] || item.period;
        if (date && slot) {
          scheduleMap[`${date}_${slot}`] = true;
          scheduledDates.add(date);
        }
      });

      // Update calDays isScheduled
      const calDays = this.data.calDays.map((d: any) => ({
        ...d,
        isScheduled: d.date ? scheduledDates.has(d.date) : false,
      }));

      this.setData({
        scheduleMap,
        calDays,
        monthScheduledCount: scheduledDates.size,
      });
    } catch (e) {
      console.log('加载排班数据失败', e);
    }
  },

  selectDay(e: any) {
    const { date, empty } = e.currentTarget.dataset;
    if (empty || !date) return;

    const calDays = this.data.calDays.map((d: any) => ({
      ...d,
      isSelected: d.date === date,
    }));

    this.setData({
      selectedDate: date,
      selectedDateLabel: this.formatDateLabel(date),
      calDays,
    });
  },

  toggleSlot(e: any) {
    const { slot } = e.currentTarget.dataset;
    const { selectedDate, scheduleMap } = this.data;
    if (!selectedDate) return;

    const key = `${selectedDate}_${slot}`;
    const updated = { ...scheduleMap, [key]: !scheduleMap[key] };

    // Recompute isScheduled for this date
    const hasAny = updated[`${selectedDate}_morning`] ||
      updated[`${selectedDate}_afternoon`] ||
      updated[`${selectedDate}_evening`];

    const calDays = this.data.calDays.map((d: any) => {
      if (d.date === selectedDate) return { ...d, isScheduled: !!hasAny };
      return d;
    });

    const scheduledDates = new Set(
      this.data.calDays
        .filter((d: any) => d.date && d.isScheduled && d.date !== selectedDate)
        .map((d: any) => d.date)
    );
    if (hasAny) scheduledDates.add(selectedDate);

    this.setData({
      scheduleMap: updated,
      calDays,
      monthScheduledCount: scheduledDates.size,
    });
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    this.buildMonth(currentYear, currentMonth);
    this.loadMonthSchedule(currentYear, currentMonth);
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    this.buildMonth(currentYear, currentMonth);
    this.loadMonthSchedule(currentYear, currentMonth);
  },

  async submitSchedule() {
    const { scheduleMap, currentYear, currentMonth } = this.data;
    const schedules: { date: string; period: string }[] = [];

    const today = this.dateStr(new Date());

    Object.keys(scheduleMap).forEach((key) => {
      if (!scheduleMap[key]) return;
      const parts = key.split('_');
      const slot = parts.pop()!;
      const date = parts.join('_');
      if (date >= today) {
        schedules.push({ date, period: slot });
      }
    });

    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    this.setData({ submitting: true });
    try {
      await put('/attendants/me/schedules', { schedules, startDate, endDate });
      wx.showToast({ title: '排班已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  dateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatDateLabel(date: string): string {
    if (!date) return '';
    const [, m, d] = date.split('-');
    return `${parseInt(m)}月${parseInt(d)}日`;
  },
});
