import { get } from '../../utils/request';
import { resolvePublicUrl } from '../../utils/media-url';
import { getUserInfo } from '../../utils/auth';
import { ensureAttendantPageAccess } from '../../utils/identity';
import { evaluateCompletionData } from '../../utils/completion';
import { requestSubscribe } from '../../utils/subscribe';

type RoleCode =
  | 'attendant' | 'nutritionist' | 'rehabilitator'
  | 'nurse' | 'caregiver' | 'maternal_care' | 'psychologist';

interface QuickLinkCfg {
  key: string;
  label: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'info';
}

interface RoleDisplayConfig {
  role: RoleCode;
  label: string;
  defaultTitle: string;
  icon: string;
  themeColor: string;
  themeColorDark: string;
  tagline: string;
  quickLinks: QuickLinkCfg[];
  statsLabels: {
    todayTasks: string;
    weekCompleted: string;
    monthIncome: string;
    rating: string;
  };
  serviceScope: string;
}

const FALLBACK_DISPLAY_CONFIG: RoleDisplayConfig = {
  role: 'attendant',
  label: '陪诊员',
  defaultTitle: '专业陪诊员',
  icon: 'medical_services',
  themeColor: '#4CAF50',
  themeColorDark: '#2E7D32',
  tagline: '今天也要温暖陪伴',
  quickLinks: [
    { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
    { key: 'expense', label: '费用报销', icon: 'receipt_long', tone: 'warning' },
    { key: 'grab', label: '抢单大厅', icon: 'shopping_cart_checkout', tone: 'primary' },
    { key: 'assigned', label: '指派任务', icon: 'assignment_ind', tone: 'info' },
  ],
  statsLabels: {
    todayTasks: '今日任务',
    weekCompleted: '本周完成',
    monthIncome: '本月收入',
    rating: '评分',
  },
  serviceScope: '门诊陪诊、陪检陪查、住院协助',
};

const STATUS_MAP: Record<string, string> = {
  pending_dispatch: '待派单',
  pending_accept: '待确认',
  pending_grab: '待抢单',
  pending_sign: '待签到',
  pending_service: '待服务',
  in_progress: '进行中',
  pending_review: '服务已结束',
  completed: '已完成',
  canceled: '已取消',
  emergency: '紧急',
};

// 给订单归组（按日期）
function groupOrdersByDate(orders: any[]): any[] {
  const today = dateStr(new Date());
  const tomorrow = dateStr(addDays(new Date(), 1));
  const yesterday = dateStr(addDays(new Date(), -1));

  const map: Record<string, any[]> = {};
  orders.forEach((o) => {
    const d = o.dateKey || today;
    if (!map[d]) map[d] = [];
    map[d].push(o);
  });

  return Object.entries(map)
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, items]) => {
      let label = date;
      if (date === today) label = `今天  ${formatMonthDay(date)}`;
      else if (date === tomorrow) label = `明天  ${formatMonthDay(date)}`;
      else if (date === yesterday) label = `昨天  ${formatMonthDay(date)}`;
      else label = formatMonthDay(date);
      return { dateLabel: label, count: items.length, orders: items, date };
    });
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatMonthDay(date: string): string {
  const [, m, d] = date.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
}

/** 抢单池 / 指派接口可能直接返回数组，也可能包在 items 里 */
function listFromAttendantOrdersResponse(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  return [];
}

Page({
  data: {
    statusBarHeight: 20,
    currentTab: 0,
    attendantName: '',
    greeting: '',
    loaded: false,

    // Tab 0 - 工作台
    stats: {
      todayTasks: 0,
      weekCompleted: 0,
      rating: '5.0',
      monthIncome: '0.00',
      totalHours: 0,
      pendingCount: 0,
      inProgressCount: 0,
    },
    todaySchedule: [] as any[],

    // Tab 1 - 全部日程
    allScheduleGroups: [] as any[],
    allScheduleView: 'all',
    allScheduleRefreshing: false,
    allOrdersCache: [] as any[],

    // Tab 2 - 我的
    attendantInfo: {
      avatarUrl: '',
      title: '专业陪诊员',
      experienceYears: 1,
      totalOrders: 0,
      rating: '5.0',
      satisfactionRate: '99%',
    },

    // 当前陪诊员的 attendant 表 ID（用于精确过滤订单）
    myAttendantId: 0,

    /** 抢单池可抢数量、待确认指派数量（用于入口角标） */
    grabPoolCount: 0,
    assignedPendingCount: 0,
    workbenchTodoCount: 0,

    /** 管理员查看模式：传入 attendantId 参数时为 true */
    isAdminView: false,
    viewAttendantId: 0,

    /** 角色变装数据（由后端 /attendants/me/workbench 提供） */
    displayConfig: FALLBACK_DISPLAY_CONFIG as RoleDisplayConfig,
    roleLabel: FALLBACK_DISPLAY_CONFIG.label,
    roleTagline: FALLBACK_DISPLAY_CONFIG.tagline,
    roleThemeColor: FALLBACK_DISPLAY_CONFIG.themeColor,
    roleThemeColorDark: FALLBACK_DISPLAY_CONFIG.themeColorDark,
    roleStatsLabels: FALLBACK_DISPLAY_CONFIG.statsLabels,
    roleQuickLinks: FALLBACK_DISPLAY_CONFIG.quickLinks,
    specialties: [] as string[],
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    if (options.attendantId) {
      this.setData({
        isAdminView: true,
        viewAttendantId: parseInt(options.attendantId),
        attendantName: options.name ? decodeURIComponent(options.name) : '陪诊员',
      });
    }
  },

  onShow() {
    if (!ensureAttendantPageAccess()) return;
    const userInfo = getUserInfo();
    const hour = new Date().getHours();
    let greeting = '晚上好';
    if (hour < 12) greeting = '上午好';
    else if (hour < 18) greeting = '下午好';

    if (!this.data.isAdminView) {
      this.setData({
        attendantName: userInfo?.name || '陪诊员',
        greeting,
      });
    } else {
      this.setData({ greeting });
    }

    if (this.data.isAdminView) {
      const aid = this.data.viewAttendantId;
      this.setData({ myAttendantId: aid });
      this.loadAdminViewAttendantInfo(aid);
      this.loadTodaySchedule();
      this.loadAllSchedules();
    } else {
      if (this.data.myAttendantId) {
        this.loadStats();
        this.loadTodaySchedule();
      }
      // 优先拉角色变装+统计合并接口；失败则降级为老接口
      this.loadWorkbenchBundle();
      this.loadWorkbenchAlerts();
      requestSubscribe(['orderAssignNotify', 'grabPoolNotify']);
    }

    setTimeout(() => this.setData({ loaded: true }), 100);
  },

  async loadAdminViewAttendantInfo(attendantId: number) {
    try {
      const res: any = await get(`/attendants/${attendantId}`);
      const displayName = res.user?.name || res.user?.nickname || res.realName || res.name || `陪诊员${attendantId}`;
      this.setData({
        attendantName: displayName,
        attendantInfo: {
          avatarUrl: resolvePublicUrl(res.user?.avatarUrl || res.avatarUrl || ''),
          title: res.title || '专业陪诊员',
          experienceYears: res.experienceYears || 1,
          totalOrders: res.totalOrders || res.completedOrders || 0,
          rating: res.rating || '5.0',
          satisfactionRate: res.satisfactionRate || '99%',
        },
      });
    } catch (e) {
      console.log('加载陪诊员信息失败', e);
    }
  },

  // ── Tab 切换
  switchTab(e: any) {
    const tab = Number(e.currentTarget.dataset.tab);
    this.setData({ currentTab: tab });
    if (tab === 1) this.loadAllSchedules();
    if (tab === 0) this.loadWorkbenchAlerts();
  },

  switchToAllSchedules() {
    this.setData({ currentTab: 1 });
    this.loadAllSchedules();
  },

  setScheduleView(e: any) {
    const view = e.currentTarget.dataset.view;
    this.setData({ allScheduleView: view });
    this.filterAllSchedules(view);
  },

  onAllScheduleRefresh() {
    this.setData({ allScheduleRefreshing: true });
    this.loadAllSchedules().finally(() => {
      this.setData({ allScheduleRefreshing: false });
    });
  },

  // 构建带 attendantId 的订单查询参数（当 attendantId 可用时明确传入，防止权限漏洞）
  _orderParams(extra: Record<string, any> = {}): Record<string, any> {
    const aid = this.data.myAttendantId;
    return aid ? { attendantId: aid, ...extra } : extra;
  },

  /** 抢单大厅 / 指派任务角标：与抢单页、指派页数据源一致 */
  async loadWorkbenchAlerts() {
    let grabPoolCount = 0;
    let assignedPendingCount = 0;
    try {
      const grabRaw = await get('/attendants/grab-orders');
      grabPoolCount = listFromAttendantOrdersResponse(grabRaw).length;
    } catch (e) {
      console.log('抢单池角标', e);
    }
    try {
      const assignedRaw = await get('/attendants/assigned-orders');
      assignedPendingCount = listFromAttendantOrdersResponse(assignedRaw).length;
    } catch (e) {
      console.log('指派角标', e);
    }
    const workbenchTodoCount = grabPoolCount + assignedPendingCount;
    this.setData({ grabPoolCount, assignedPendingCount, workbenchTodoCount });
  },

  // ── 工作台数据
  async loadStats() {
    try {
      const res: any = await get('/attendants/me/stats');
      this.setData({
        stats: {
          todayTasks: res.todayTasks || 0,
          weekCompleted: res.weekCompleted || 0,
          rating: res.rating || '5.0',
          monthIncome: res.monthIncome ? Number(res.monthIncome).toFixed(2) : '0.00',
          totalHours: res.totalHours || 0,
          pendingCount: res.pendingTasks || 0,
          inProgressCount: res.inProgressCount || 0,
        },
      });
    } catch (e) {
      console.log('加载统计数据失败', e);
    }
  },

  async loadTodaySchedule() {
    try {
      const res: any = await get(
        '/orders',
        this._orderParams({ status: 'pending_sign,pending_service,in_progress,emergency' }),
      );
      const items = (res.items || res || []).map((item: any) => this.normalizeOrder(item));
      this.setData({ todaySchedule: items });
    } catch (e) {
      console.log('加载今日日程失败', e);
    }
  },

  // ── 全部日程数据
  async loadAllSchedules() {
    try {
      const res: any = await get('/orders', this._orderParams({ pageSize: 100 }));
      const raw = res.items || res || [];
      const orders = raw.map((item: any) => this.normalizeOrder(item));
      this.setData({ allOrdersCache: orders });
      this.filterAllSchedules(this.data.allScheduleView);
    } catch (e) {
      console.log('加载全部日程失败', e);
    }
  },

  filterAllSchedules(view: string) {
    let orders = this.data.allOrdersCache;
    if (view === 'pending') {
      orders = orders.filter((o: any) =>
        ['pending_accept', 'pending_sign', 'pending_service'].includes(o.status)
      );
    } else if (view === 'in_progress') {
      orders = orders.filter((o: any) => o.status === 'in_progress' || o.status === 'emergency');
    } else if (view === 'completed') {
      orders = orders.filter((o: any) => o.status === 'completed' || o.status === 'pending_review');
    } else if (view === 'canceled') {
      orders = orders.filter((o: any) => o.status === 'canceled');
    }
    const groups = groupOrdersByDate(orders);
    this.setData({ allScheduleGroups: groups });
  },

  // ── 我的数据
  async loadAttendantInfo() {
    try {
      const res: any = await get('/attendants/me');
      const attendantId = res.id || 0;
      this.setData({
        myAttendantId: attendantId,
        attendantInfo: {
          avatarUrl: resolvePublicUrl(res.avatarUrl || ''),
          title: res.title || '专业陪诊员',
          experienceYears: res.experienceYears || 1,
          totalOrders: res.totalOrders || res.completedOrders || 0,
          rating: res.rating || '5.0',
          satisfactionRate: res.satisfactionRate || '99%',
        },
        attendantName: res.realName || res.name || this.data.attendantName,
      });
      // 加载完陪诊员信息后重新加载依赖 attendantId 的数据
      this.loadStats();
      this.loadTodaySchedule();
    } catch (e) {
      console.log('加载陪诊员信息失败', e);
    }
  },

  /**
   * 聚合接口：一次返回角色变装 + 统计数据 + 档案。
   * 失败则降级走 /me 与 /me/stats 分离接口（老陪诊员体验不变）。
   */
  async loadWorkbenchBundle() {
    try {
      const res: any = await get('/attendants/me/workbench');
      if (!res) throw new Error('empty');
      const config: RoleDisplayConfig = res.displayConfig || FALLBACK_DISPLAY_CONFIG;
      const stats = res.stats || {};

      this.setData({
        myAttendantId: res.id || this.data.myAttendantId,
        attendantInfo: {
          avatarUrl: resolvePublicUrl(res.avatarUrl || ''),
          title: res.title || config.defaultTitle,
          experienceYears: Number(res.experienceYears) || 1,
          totalOrders: stats.totalOrders || 0,
          rating: String(res.rating ?? stats.rating ?? '5.0'),
          satisfactionRate: '99%',
        },
        attendantName: res.realName || this.data.attendantName,
        displayConfig: config,
        roleLabel: config.label,
        roleTagline: config.tagline,
        roleThemeColor: config.themeColor,
        roleThemeColorDark: config.themeColorDark,
        roleStatsLabels: config.statsLabels,
        roleQuickLinks: config.quickLinks,
        specialties: res.specialties || [],
        stats: {
          todayTasks: stats.todayTasks || 0,
          weekCompleted: stats.weekCompleted || 0,
          rating: String(stats.rating ?? '5.0'),
          monthIncome: stats.monthIncome ? Number(stats.monthIncome).toFixed(2) : '0.00',
          totalHours: stats.totalHours || 0,
          pendingCount: stats.pendingTasks || 0,
          inProgressCount: stats.inProgressCount || 0,
        },
      });
    } catch (e) {
      console.log('加载工作台聚合失败，降级为分离接口', e);
      this.loadAttendantInfo();
    }
  },

  onQuickLinkTap(e: any) {
    const key = e.currentTarget.dataset.key || '';
    const routeMap: Record<string, string> = {
      grab: '/pages/workbench/grab/grab',
      assigned: '/pages/workbench/assigned/assigned',
      schedule: '/pages/workbench/schedule/schedule',
      wallet: '/pages/workbench/wallet/wallet',
      expense: '/pages/workbench/expense/expense',
      // 专业角色方案模板库：食谱 / 训练 / 育护日志 共用同一页面，按 kind 区分
      meal_plan: '/pages/workbench/service-plan/service-plan?kind=meal_plan',
      training_plan: '/pages/workbench/service-plan/service-plan?kind=training_plan',
      care_log: '/pages/workbench/service-plan/service-plan?kind=care_log',
    };
    const url = routeMap[key];
    if (url) {
      wx.navigateTo({ url });
      return;
    }
    wx.showToast({
      title: this.data.displayConfig.label + '工作台：该工具正在研发',
      icon: 'none',
    });
  },

  // ── 订单归一化
  normalizeOrder(item: any): any {
    const serviceTime = item.serviceTime || item.serviceStartTime || '';
    const serviceDate = serviceTime ? new Date(serviceTime) : null;
    const completion = evaluateCompletionData(item.completionData);
    const isPendingReview = item.status === 'pending_review';
    const isCompleted = item.status === 'completed';
    const completionEntryVisible =
      item.status === 'in_progress' ||
      item.status === 'emergency' ||
      isPendingReview ||
      (!completion.ready && isCompleted);
    return {
      ...item,
      statusText: isPendingReview
        ? (completion.ready ? '服务已结束' : '待补资料')
        : (!completion.ready && isCompleted ? '资料未补' : (STATUS_MAP[item.status] || item.status)),
      time: serviceDate ? this.formatShortTime(serviceTime) : '--:--',
      dateKey: serviceDate ? dateStr(serviceDate) : dateStr(new Date()),
      patientName: item.serviceTarget?.name || item.patientName || '—',
      hospital: item.hospital || item.serviceTarget?.hospital || '',
      department: item.department || '',
      completionReady: completion.ready,
      completionEntryVisible,
      completionStatusText: completion.ready ? '完成资料已齐' : '资料待补',
      completionHint:
        item.status === 'in_progress' || item.status === 'emergency'
        ? (completion.ready
            ? '已补齐，可进入资料页最后确认并提交结束订单'
            : `还差：${completion.missingItems.join('、') || '完成资料'}`)
        : isPendingReview
          ? (completion.ready
              ? '服务已结束，如需要可继续补充资料或追加评价'
              : `服务已结束，但还差：${completion.missingItems.join('、') || '完成资料'}`)
          : `订单已完成，但还差：${completion.missingItems.join('、') || '完成资料'}`,
      completionActionText: completion.ready ? '查看资料' : '继续补填',
    };
  },

  // ── 导航
  goGrab() {
    wx.navigateTo({ url: '/pages/workbench/grab/grab' });
  },
  goAssigned() {
    wx.navigateTo({ url: '/pages/workbench/assigned/assigned' });
  },
  goSchedule() {
    wx.navigateTo({ url: '/pages/workbench/schedule/schedule' });
  },
  goWallet() {
    wx.navigateTo({ url: '/pages/workbench/wallet/wallet' });
  },
  goExpense() {
    wx.navigateTo({ url: '/pages/workbench/expense/expense' });
  },
  goOrderDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/workbench/service-timeline/service-timeline?orderId=${id}` });
  },
  goCompletionForm(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/workbench/completion-form/completion-form?orderId=${id}` });
  },
  goBack() {
    wx.navigateBack();
  },

  // ── 工具
  formatShortTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
});
