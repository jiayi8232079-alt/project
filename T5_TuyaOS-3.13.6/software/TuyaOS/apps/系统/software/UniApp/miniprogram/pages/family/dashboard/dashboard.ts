import { get } from '../../../utils/request';
import { requestMedicationSubscribe } from '../../../utils/subscribe';
import { mapWithConcurrency } from '../../../utils/concurrency';

interface MemberCard {
  memberId: number;
  userId: number | null;
  serviceTargetId: number | null;
  role: string;
  isPlaceholder: boolean;
  initial: string;
  nickname: string;
  relation: string;
  relationLabel: string;
  infoLine: string;
  activeMedCount: number;
  followUpCount: number;
  orderCount: number;
  activeOrder: any;
  activeOrderStatusText: string;
  latestMedNames: string[];
  todayTotal: number;
  todayTaken: number;
  todayMissed: number;
  todayPending: number;
  todayHint: string;
  todayHasMissed: boolean;
}

interface AlertSummary {
  total: number;
  high: number;
  medium: number;
  latest: Array<{
    id: number;
    title: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

const RELATION_MAP: Record<string, string> = {
  father: '父亲', mother: '母亲', parent: '父母', spouse: '配偶', child: '子女', sibling: '兄弟姐妹',
};

// 两次 loadDashboard 之间的节流窗口；窗口内 onShow 跳过重复拉取，减少白闪
const REFRESH_MIN_INTERVAL_MS = 2000;

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    pending_dispatch: '待派单', pending_accept: '待接单',
    pending_grab: '待抢单', pending_sign: '陪诊员已接单',
    pending_service: '待服务', in_progress: '服务中',
    completed: '已完成', pending_review: '待评价',
    canceled: '已取消', emergency: '紧急',
  };
  return m[s] || s;
}

Page({
  data: {
    statusBarHeight: 0,
    familyGroupId: 0,
    familyName: '',
    members: [] as MemberCard[],
    loading: true,
    refreshing: false,
    totalMeds: 0,
    totalFollowUps: 0,
    totalOrders: 0,
    activeServiceCount: 0,
    alertSummary: null as AlertSummary | null,
    todayTotal: 0,
    todayTaken: 0,
    todayMissed: 0,
    todayPending: 0,
  },

  _lastLoadAt: 0 as number,
  _loading: false as boolean,

  onLoad(options: any) {
    const sysInfo = wx.getWindowInfo?.() || wx.getSystemInfoSync();
    this.setData({
      familyGroupId: Number(options.familyGroupId || 0),
      statusBarHeight: sysInfo.statusBarHeight || 44,
    });
  },

  onShow() {
    if (!this.data.familyGroupId) return;
    const now = Date.now();
    const skipDashboard =
      !this._loading &&
      this.data.members.length > 0 &&
      now - this._lastLoadAt < REFRESH_MIN_INTERVAL_MS;
    if (!skipDashboard) this.loadDashboard();
    this.loadAlertSummary();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    Promise.all([this.loadDashboard(), this.loadAlertSummary()]).finally(() =>
      this.setData({ refreshing: false }),
    );
  },

  async loadAlertSummary() {
    try {
      const res: any = await get('/alerts/pending-count');
      if (!res || typeof res !== 'object') return;
      this.setData({
        alertSummary: {
          total: Number(res.total || 0),
          high: Number(res.high || 0),
          medium: Number(res.medium || 0),
          latest: Array.isArray(res.latest)
            ? res.latest.map((x: any) => ({
                id: Number(x.id),
                title: String(x.title || ''),
                severity: x.severity || 'medium',
              }))
            : [],
        },
      });
    } catch {
      /* ignore */
    }
  },

  goAlertList() {
    wx.navigateTo({ url: '/pages/alert/list/list' });
  },

  goAlertDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/alert/detail/detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  async loadDashboard() {
    if (this._loading) return;
    this._loading = true;
    // 已有数据时不整屏进入 loading，避免在 onShow/返回时白闪
    const hasExisting = this.data.members.length > 0;
    if (!hasExisting) this.setData({ loading: true });
    try {
      const res: any = await get(`/family/${this.data.familyGroupId}/members`);
      const rawMembers: any[] = Array.isArray(res) ? res : (res.items || []);

      // 一次性并发拉取所有成员的用药 + 订单，避免成员数量线性放大的串行等待。
      // 微信 wx.request 同时最多 10 条；家庭成员 5 人时此处就会 10 条 + 其它请求叠加超限，
      // 用 mapWithConcurrency 限到一次最多 4 个家人同时拉（共 8 条 wx.request）。
      const memberDetails = await mapWithConcurrency(rawMembers, 4, async (m: any) => {
        if (!m.userId) {
          return { raw: m, meds: [] as any[], orders: [] as any[] };
        }
        const [medsRes, ordersRes]: any = await Promise.all([
          get(`/family/member/${m.userId}/medications`).catch(() => []),
          get(`/family/member/${m.userId}/orders`, { page: 1, pageSize: 5 }).catch(() => ({ items: [] })),
        ]);
        const meds = Array.isArray(medsRes) ? medsRes : (medsRes?.items || []);
        const orders = ordersRes?.items || [];
        return { raw: m, meds, orders };
      });

      // 今日用药执行记录（一次查询，涵盖当前账号有权限看到的所有家人）
      const todayStr = this.toTodayString();
      let executions: any[] = [];
      try {
        const execRes: any = await get('/medication-executions', {
          startDate: todayStr,
          endDate: todayStr,
        });
        executions = Array.isArray(execRes?.items) ? execRes.items : [];
      } catch {
        /* ignore */
      }
      const execByUser = new Map<number, { taken: number; missed: number; pending: number; skipped: number; total: number }>();
      for (const e of executions) {
        const userId = Number(e?.reminder?.userId || 0);
        if (!userId) continue;
        const slot = execByUser.get(userId) || { taken: 0, missed: 0, pending: 0, skipped: 0, total: 0 };
        (slot as any)[e.status] = ((slot as any)[e.status] || 0) + 1;
        slot.total += 1;
        execByUser.set(userId, slot);
      }

      const members: MemberCard[] = [];
      let totalMeds = 0;
      let totalFollowUps = 0;
      let totalOrders = 0;
      let activeServiceCount = 0;

      let todayTotalAgg = 0;
      let todayTakenAgg = 0;
      let todayMissedAgg = 0;
      let todayPendingAgg = 0;

      for (const detail of memberDetails) {
        // mapWithConcurrency 在 worker 抛错时会写入 undefined 占位；
        // 当前 worker 已用 .catch 兜底，理论上不会出现，加判断防御未来改动。
        if (!detail) continue;
        const { raw: m, meds, orders } = detail;
        const isPlaceholder = !m.userId;
        const st = m.serviceTarget || null;
        const nickname =
          (st?.name) ||
          m.nickname ||
          m.user?.nickname ||
          m.placeholderName ||
          '家人';
        const initial = String(nickname).slice(0, 1);
        const relation = m.relation || '';
        const relationLabel = m.isElder
          ? (isPlaceholder ? '待登录老人' : '老人')
          : (m.role === 'guardian' ? '管理者' : RELATION_MAP[relation] || '成员');

        const infoParts: string[] = [];
        if (st?.gender) infoParts.push(st.gender);
        if (st?.age != null) infoParts.push(`${st.age}岁`);
        const infoLine = infoParts.join(' · ');

        const activeMeds = meds.filter((med: any) => med.status === 'active');
        const followUps = meds.filter((med: any) => med.reminderType === 'follow_up' && med.status === 'active');
        const activeOrder = orders.find((o: any) =>
          o.status === 'in_progress' || o.status === 'pending_service' || o.status === 'pending_sign'
        ) || null;

        totalMeds += activeMeds.length;
        totalFollowUps += followUps.length;
        totalOrders += orders.length;
        if (activeOrder) activeServiceCount++;

        const stat = m.userId ? execByUser.get(Number(m.userId)) : undefined;
        const todayTotal = stat?.total || 0;
        const todayTaken = stat?.taken || 0;
        const todayMissed = stat?.missed || 0;
        const todayPending = stat?.pending || 0;
        const todayHint = todayTotal
          ? `今日 ${todayTaken}/${todayTotal} 已服${todayMissed > 0 ? `，${todayMissed} 漏服` : todayPending > 0 ? `，${todayPending} 待打卡` : ''}`
          : '';
        todayTotalAgg += todayTotal;
        todayTakenAgg += todayTaken;
        todayMissedAgg += todayMissed;
        todayPendingAgg += todayPending;

        members.push({
          memberId: m.id,
          userId: m.userId ?? null,
          serviceTargetId: (st?.id ?? m.linkedServiceTargetId) || null,
          role: m.role || '',
          isPlaceholder,
          initial,
          nickname,
          relation,
          relationLabel,
          infoLine,
          activeMedCount: activeMeds.length,
          followUpCount: followUps.length,
          orderCount: orders.length,
          activeOrder,
          activeOrderStatusText: activeOrder ? statusLabel(activeOrder.status) : '',
          latestMedNames: activeMeds.slice(0, 3).map((med: any) => med.medicineName),
          todayTotal,
          todayTaken,
          todayMissed,
          todayPending,
          todayHint,
          todayHasMissed: todayMissed > 0,
        });
      }

      this._lastLoadAt = Date.now();

      this.setData({
        members,
        totalMeds,
        totalFollowUps,
        totalOrders,
        activeServiceCount,
        todayTotal: todayTotalAgg,
        todayTaken: todayTakenAgg,
        todayMissed: todayMissedAgg,
        todayPending: todayPendingAgg,
      });
    } catch { /* ignore */ }
    finally {
      this._loading = false;
      if (this.data.loading) this.setData({ loading: false });
    }
  },

  async goDetail(e: any) {
    const stId = e.currentTarget.dataset.stid;
    const role = e.currentTarget.dataset.role;
    if (stId) {
      wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${stId}` });
      return;
    }

    // 兜底：guardian 行未关联档案时，尝试用当前账号名下 relationship='self' 的档案
    if (role === 'guardian') {
      try {
        const list: any = await get('/users/me/service-targets');
        const targets: any[] = Array.isArray(list) ? list : (list?.items || []);
        const selfTarget = targets.find((t: any) => {
          const hp = t?.healthProfile;
          const hpObj = typeof hp === 'string' ? (() => { try { return JSON.parse(hp); } catch { return null; } })() : hp;
          return hpObj?.relationship === 'self' || t?.relationship === 'self';
        });
        if (selfTarget?.id) {
          wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${selfTarget.id}` });
          return;
        }
      } catch { /* ignore */ }
      wx.showModal({
        title: '本人档案尚未建立',
        content: '尚未填写本人健康档案，是否现在去添加？',
        confirmText: '去添加',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/health/add-member/add-member?relationship=self' });
          }
        },
      });
      return;
    }

    wx.showToast({
      title: '该成员尚未关联健康档案',
      icon: 'none',
      duration: 2200,
    });
  },

  goWeeklyReport() {
    wx.navigateTo({ url: '/pages/health-weekly/health-weekly' });
  },

  goMedicationReminder() {
    // 用户点击进入用药中心时顺势申请一次订阅，为后续推送累积授权
    requestMedicationSubscribe();
    wx.navigateTo({ url: '/pages/medication-reminder/medication-reminder' });
  },

  toTodayString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
});
