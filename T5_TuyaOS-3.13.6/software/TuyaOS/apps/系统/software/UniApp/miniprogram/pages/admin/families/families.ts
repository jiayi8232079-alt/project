import { get, put, post } from '../../../utils/request';
import { ensureAdminPageAccessFresh } from '../../../utils/identity';

interface FamilyMemberRow {
  /** family_members.id（主键），用于 PUT/POST 接口寻址 */
  memberId: number;
  /** 关联登录账号 ID，可能为空（占位老人） */
  userId: number;
  /** 当前显示的姓名（昵称 > 占位姓名 > user.nickname > "家人"） */
  nickname: string;
  initial: string;
  role: string;
  roleLabel: string;
  relation: string | null;
  isElder: boolean;
  /** 关联的健康档案 ID；为空则未关联 */
  linkedServiceTargetId: number | null;
}

interface FamilyGroupRow {
  id: number;
  name: string;
  memberCount: number;
  createdAt: string;
  dateDisplay: string;
  members: FamilyMemberRow[];
  /** 汇总：活跃用药 */
  totalActiveMeds: number;
  /** 汇总：待复诊 */
  totalFollowUps: number;
  /** 汇总：进行中服务 */
  activeServiceCount: number;
}

const ROLE_MAP: Record<string, string> = {
  guardian: '管理者',
  member: '成员',
};

function buildMember(m: any): FamilyMemberRow {
  const target = m.serviceTarget;
  const userNickname = m.user?.nickname;
  const display =
    String(m.nickname || '').trim() ||
    String(m.placeholderName || '').trim() ||
    String(target?.name || '').trim() ||
    String(userNickname || '').trim() ||
    '家人';
  return {
    memberId: Number(m.id || 0),
    userId: Number(m.userId || 0),
    nickname: display,
    initial: display.slice(0, 1) || '?',
    role: m.role || 'member',
    roleLabel: ROLE_MAP[m.role] || '成员',
    relation: m.relation || null,
    isElder: !!m.isElder,
    linkedServiceTargetId: m.linkedServiceTargetId ? Number(m.linkedServiceTargetId) : null,
  };
}

Page({
  data: {
    statusBarHeight: 20,
    loaded: false,
    loading: false,
    families: [] as FamilyGroupRow[],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: true,
    searchKeyword: '',
    refreshing: false,
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  async onShow() {
    const ok = await ensureAdminPageAccessFresh();
    if (!ok) return;
    this.setData({ families: [], page: 1, hasMore: true });
    this.loadFamilies();
  },

  onRefresh() {
    this.setData({ refreshing: true, families: [], page: 1, hasMore: true });
    this.loadFamilies().finally(() => this.setData({ refreshing: false }));
  },

  onScrollToLower() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadFamilies() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;

      const res: any = await get('/family/admin/groups', params);
      const items = res?.items || res?.data || [];
      const rows: FamilyGroupRow[] = items.map((f: any) => this.normalizeFamily(f));
      this.setData({
        families: rows,
        total: res?.total ?? rows.length,
        hasMore: items.length >= this.data.pageSize,
        loaded: true,
      });

      rows.forEach((_row, idx) => this.loadFamilySummary(idx));
    } catch {
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    const nextPage = this.data.page + 1;
    this.setData({ loading: true, page: nextPage });
    try {
      const params: any = {
        page: nextPage,
        pageSize: this.data.pageSize,
      };
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;

      const res: any = await get('/family/admin/groups', params);
      const items = res?.items || res?.data || [];
      const rows: FamilyGroupRow[] = items.map((f: any) => this.normalizeFamily(f));
      const startIdx = this.data.families.length;
      this.setData({
        families: [...this.data.families, ...rows],
        hasMore: items.length >= this.data.pageSize,
      });

      rows.forEach((_row, i) => this.loadFamilySummary(startIdx + i));
    } catch {
      this.setData({ page: this.data.page - 1 });
    } finally {
      this.setData({ loading: false });
    }
  },

  normalizeFamily(f: any): FamilyGroupRow {
    const membersRaw = Array.isArray(f.members) ? f.members : [];
    return {
      id: f.id || f.familyGroupId,
      name: f.name || f.familyGroup?.name || '未命名家庭',
      memberCount: f.memberCount ?? membersRaw.length ?? 0,
      createdAt: f.createdAt || '',
      dateDisplay: f.createdAt ? String(f.createdAt).slice(0, 10) : '',
      members: membersRaw.map(buildMember),
      totalActiveMeds: 0,
      totalFollowUps: 0,
      activeServiceCount: 0,
    };
  },

  async loadFamilySummary(idx: number) {
    const fam = this.data.families[idx];
    if (!fam?.id) return;
    try {
      // 改用管理员专用接口：不会因为当前管理员未加入家庭而 403
      const res: any = await get(`/family/admin/groups/${fam.id}/members`);
      const rawMembers = Array.isArray(res) ? res : (res.items || []);

      const members: FamilyMemberRow[] = rawMembers.map(buildMember);

      let totalActiveMeds = 0;
      let totalFollowUps = 0;
      let activeServiceCount = 0;

      // 仅对真实账号成员（userId 非空）拉用药/订单汇总；占位老人无登录账号，跳过。
      // 改用管理员专用接口，无需当前管理员是该家庭 guardian。
      const summaries = await Promise.all(
        rawMembers
          .filter((m: any) => Number(m.userId) > 0)
          .map(async (m: any) => {
            try {
              const [medsRes, ordersRes]: any = await Promise.all([
                get(`/family/admin/by-user/${m.userId}/medications`, undefined, { silent: true }).catch(() => []),
                get(`/family/admin/by-user/${m.userId}/orders`, { page: 1, pageSize: 3 }, { silent: true }).catch(() => ({ items: [] })),
              ]);
              return { medsRes, ordersRes };
            } catch {
              return { medsRes: [], ordersRes: { items: [] } };
            }
          }),
      );

      for (const { medsRes, ordersRes } of summaries) {
        const meds = Array.isArray(medsRes) ? medsRes : (medsRes?.items || []);
        const orders = ordersRes?.items || [];
        totalActiveMeds += meds.filter((med: any) => med.status === 'active').length;
        totalFollowUps += meds.filter((med: any) => med.reminderType === 'follow_up' && med.status === 'active').length;
        if (orders.some((o: any) => o.status === 'in_progress' || o.status === 'pending_service' || o.status === 'pending_sign')) {
          activeServiceCount++;
        }
      }

      this.setData({
        [`families[${idx}].members`]: members,
        [`families[${idx}].memberCount`]: members.length,
        [`families[${idx}].totalActiveMeds`]: totalActiveMeds,
        [`families[${idx}].totalFollowUps`]: totalFollowUps,
        [`families[${idx}].activeServiceCount`]: activeServiceCount,
      });
    } catch { /* ignore */ }
  },

  /** 重新拉取某个家庭的成员（编辑/绑定后局部刷新，避免整列表重载） */
  async refreshFamilyMembers(familyId: number) {
    const idx = this.data.families.findIndex((f) => f.id === familyId);
    if (idx < 0) return;
    await this.loadFamilySummary(idx);
  },

  onSearch(e: any) {
    const keyword = (e.detail.value || '').trim();
    this.setData({ searchKeyword: keyword, families: [], page: 1, hasMore: true });
    this.loadFamilies();
  },

  goDashboard(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/family/dashboard/dashboard?familyGroupId=${id}` });
  },

  /** 打开该成员关联的健康档案（管理员模式） */
  goHealthProfile(e: any) {
    const stId = Number(e.currentTarget.dataset.stid || 0);
    if (!stId) {
      wx.showToast({ title: '该成员尚未关联档案，请先「新建档案并绑定」', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/health-profile/health-profile?subjectId=${stId}&adminMode=1`,
    });
  },

  /** 编辑成员：弹底部 modal 收集昵称 + 关系 */
  async editMember(e: any) {
    const familyId = Number(e.currentTarget.dataset.fid || 0);
    const memberId = Number(e.currentTarget.dataset.mid || 0);
    if (!familyId || !memberId) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      return;
    }

    const fam = this.data.families.find((f) => f.id === familyId);
    const member = fam?.members.find((m) => m.memberId === memberId);
    if (!member) return;

    const nickRes = await new Promise<{ confirm: boolean; content: string }>(
      (resolve) => {
        wx.showModal({
          title: '修改成员昵称',
          editable: true,
          placeholderText: '例如：王奶奶 / 李爸',
          content: member.nickname || '',
          success: (r) => resolve({ confirm: !!r.confirm, content: r.content || '' }),
          fail: () => resolve({ confirm: false, content: '' }),
        });
      },
    );
    if (!nickRes.confirm) return;
    const nickname = nickRes.content.trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    try {
      await put(`/family/admin/groups/${familyId}/members/${memberId}`, {
        nickname,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      await this.refreshFamilyMembers(familyId);
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' });
    }
  },

  /** 新建健康档案并绑定到该成员 */
  async createAndBindTarget(e: any) {
    const familyId = Number(e.currentTarget.dataset.fid || 0);
    const memberId = Number(e.currentTarget.dataset.mid || 0);
    if (!familyId || !memberId) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      return;
    }

    const fam = this.data.families.find((f) => f.id === familyId);
    const member = fam?.members.find((m) => m.memberId === memberId);
    if (!member) return;

    if (member.linkedServiceTargetId) {
      wx.showToast({ title: '该成员已有档案，请直接编辑', icon: 'none' });
      return;
    }

    const ans = await new Promise<{ confirm: boolean; content: string }>(
      (resolve) => {
        wx.showModal({
          title: '新建档案并绑定',
          editable: true,
          placeholderText: '请输入老人姓名',
          content: member.nickname && member.nickname !== '家人' ? member.nickname : '',
          success: (r) => resolve({ confirm: !!r.confirm, content: r.content || '' }),
          fail: () => resolve({ confirm: false, content: '' }),
        });
      },
    );
    if (!ans.confirm) return;
    const name = ans.content.trim();
    if (!name) {
      wx.showToast({ title: '姓名不能为空', icon: 'none' });
      return;
    }

    try {
      const res: any = await post(
        `/family/admin/groups/${familyId}/members/${memberId}/create-and-bind-target`,
        {
          name,
          relationship: member.relation || undefined,
        },
      );
      const newId = res?.serviceTarget?.id || res?.member?.linkedServiceTargetId;
      wx.showToast({ title: '已创建并绑定', icon: 'success' });
      await this.refreshFamilyMembers(familyId);
      if (newId) {
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/health-profile/health-profile?subjectId=${newId}&adminMode=1`,
          });
        }, 600);
      }
    } catch (err: any) {
      wx.showToast({ title: err?.message || '创建失败', icon: 'none' });
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
