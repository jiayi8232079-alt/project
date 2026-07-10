import { get } from '../utils/request';
import { isLoggedIn } from '../utils/auth';

const MEDICATION_BADGE_TAB_INDEX = 3; // 在"我的"tab 显示红点
const BADGE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let badgeTimer: ReturnType<typeof setInterval> | null = null;
let badgeShowDebounce: ReturnType<typeof setTimeout> | null = null;
let lastBadgeRefreshAt = 0;

interface TabItem {
  pagePath: string;
  text: string;
  icon: string;
  iconPath: string;
  selectedIconPath: string;
  /** 右上角红点/角标，0 或 undefined 不显示 */
  badgeCount?: number;
  /** 是否只显示小红点（不显示数字） */
  badgeDot?: boolean;
}

const BASE_TABS: TabItem[] = [
  {
    pagePath: '/pages/index/index',
    text: '首页',
    icon: 'home',
    iconPath: '/images/tab-home.png',
    selectedIconPath: '/images/tab-home-active.png',
  },
  {
    pagePath: '/pages/service/service',
    text: '服务',
    icon: 'clinical_notes',
    iconPath: '/images/tab-service.png',
    selectedIconPath: '/images/tab-service-active.png',
  },
  {
    pagePath: '/pages/health/health',
    text: '健康',
    icon: 'favorite',
    iconPath: '/images/tab-health.png',
    selectedIconPath: '/images/tab-health-active.png',
  },
  {
    pagePath: '/pages/mine/mine',
    text: '我的',
    icon: 'person',
    iconPath: '/images/tab-mine.png',
    selectedIconPath: '/images/tab-mine-active.png',
  },
];

Component({
  data: {
    selected: 0,
    list: BASE_TABS.map((t) => ({ ...t })) as TabItem[],
    medicationBadge: 0,
    medicationHasMissed: false,
  },

  lifetimes: {
    attached() {
      this.refreshTabs();
      this.refreshMedicationBadge();
      badgeTimer = setInterval(
        () => this.refreshMedicationBadge(),
        BADGE_REFRESH_INTERVAL_MS,
      );
    },
    detached() {
      if (badgeTimer) {
        clearInterval(badgeTimer);
        badgeTimer = null;
      }
      if (badgeShowDebounce) {
        clearTimeout(badgeShowDebounce);
        badgeShowDebounce = null;
      }
    },
  },

  pageLifetimes: {
    show() {
      this.refreshTabs();
      // 每次切 tab 都打线上会叠延迟；短间隔内合并为一次（仍保留定时器兜底）
      this.scheduleMedicationBadgeRefresh();
    },
  },

  methods: {
    /** 切 tab 时防抖：2s 内多次 show 只触发一次拉角标，减轻线上 RTT 叠加 */
    scheduleMedicationBadgeRefresh() {
      const now = Date.now();
      if (now - lastBadgeRefreshAt < 2000) {
        if (!badgeShowDebounce) {
          badgeShowDebounce = setTimeout(() => {
            badgeShowDebounce = null;
            lastBadgeRefreshAt = Date.now();
            void this.refreshMedicationBadge();
          }, 2000 - (now - lastBadgeRefreshAt));
        }
        return;
      }
      lastBadgeRefreshAt = now;
      void this.refreshMedicationBadge();
    },

    refreshTabs() {
      const list: TabItem[] = BASE_TABS.map((t) => ({ ...t }));
      const count = Number((this as any).data.medicationBadge || 0);
      const hasMissed = Boolean((this as any).data.medicationHasMissed);
      if (count > 0) {
        const target = list[MEDICATION_BADGE_TAB_INDEX];
        if (target) {
          // 漏服时强调数字角标（用户能立刻看到漏几顿），仅有「待执行」时改成纯小红点
          // 不要让用户误以为「待 N 项」也是漏服紧急。
          if (hasMissed) {
            target.badgeCount = count;
            target.badgeDot = false;
          } else {
            target.badgeCount = undefined;
            target.badgeDot = true;
          }
        }
      }
      this.setData({ list });
    },

    async refreshMedicationBadge() {
      if (!isLoggedIn()) {
        if ((this as any).data.medicationBadge !== 0) {
          this.setData({ medicationBadge: 0, medicationHasMissed: false });
          this.refreshTabs();
        }
        return;
      }
      try {
        const today = this.toTodayString();
        // silent 避免 tab 切换时网络失败弹「网络连接失败」打扰用户；
        // 这是后台徽标刷新，本就允许静默失败。
        const res: any = await get(
          '/medication-executions',
          { startDate: today, endDate: today },
          { silent: true },
        );
        const items: any[] = Array.isArray(res?.items) ? res.items : [];
        let missed = 0;
        let pending = 0;
        for (const it of items) {
          if (it.status === 'missed') missed += 1;
          else if (it.status === 'pending') pending += 1;
        }
        const total = missed + pending;
        this.setData({
          medicationBadge: total,
          medicationHasMissed: missed > 0,
        });
        this.refreshTabs();
      } catch {
        // 静默失败：保留上次的红点状态，避免网络抖动时丢红点
      }
    },

    toTodayString(): string {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    switchTab(e: any) {
      const data = e.currentTarget.dataset;
      wx.switchTab({ url: data.path });
    },
  },
});
