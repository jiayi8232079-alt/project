import { get } from '../../../utils/request';
import { ensureAdminPageAccess } from '../../../utils/identity';
import { renderHealthSignShareCover } from '../../../utils/share-cover';

const sceneCache = new Map<number, string>();

type ProfileFilter = 'all' | 'empty' | 'unsigned' | 'signed';

Page({
  data: {
    statusBarHeight: 20,
    searchKeyword: '',
    loaded: false,
    loading: false,
    targets: [] as any[],
    displayTargets: [] as any[],
    total: 0,
    page: 1,
    pageSize: 100,
    hasMore: true,
    activeFilter: 'all' as ProfileFilter,
    statusCounts: { all: 0, empty: 0, unsigned: 0, signed: 0 },
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
  },

  onShow() {
    if (!ensureAdminPageAccess()) return;
    this.setData({ targets: [], page: 1, hasMore: true });
    this.loadTargets();
  },

  onPullDownRefresh() {
    this.setData({ targets: [], page: 1, hasMore: true });
    this.loadTargets().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadTargets() {
    this.setData({ loading: true });
    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;

      const res: any = await get('/users/service-targets', params);
      const items = (res?.items || []).map((t: any) => ({
        ...t,
        hasSigned: !!(t.healthProfile?.signatureUrl || t.healthProfile?.signedAt),
        profileStatus: t.healthProfile ? (t.healthProfile.signatureUrl || t.healthProfile.signedAt ? 'signed' : 'unsigned') : 'empty',
        genderLabel: t.gender === 'male' ? '男' : t.gender === 'female' ? '女' : '',
        sceneCode: sceneCache.get(t.id) || '',
      }));
      this.setData({
        targets: items,
        total: res?.total || items.length,
        hasMore: items.length >= this.data.pageSize,
        loaded: true,
      });
      this._refreshDerived();
      this._prefetchSceneCodes(items);
    } catch (e) {
      console.error('加载健康档案列表失败', e);
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  _refreshDerived() {
    const all = this.data.targets;
    const counts = { all: all.length, empty: 0, unsigned: 0, signed: 0 };
    for (const t of all) {
      const s = t.profileStatus as ProfileFilter;
      if (s === 'empty' || s === 'unsigned' || s === 'signed') counts[s]++;
    }
    const filter = this.data.activeFilter;
    const displayTargets = filter === 'all' ? all : all.filter((t: any) => t.profileStatus === filter);
    this.setData({ statusCounts: counts, displayTargets });
  },

  onFilterTap(e: any) {
    const filter = e.currentTarget.dataset.filter as ProfileFilter;
    if (!filter || filter === this.data.activeFilter) return;
    this.setData({ activeFilter: filter });
    this._refreshDerived();
  },

  async loadMore() {
    this.setData({ page: this.data.page + 1, loading: true });
    try {
      const params: any = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      };
      if (this.data.searchKeyword) params.keyword = this.data.searchKeyword;

      const res: any = await get('/users/service-targets', params);
      const newItems = (res?.items || []).map((t: any) => ({
        ...t,
        hasSigned: !!(t.healthProfile?.signatureUrl || t.healthProfile?.signedAt),
        profileStatus: t.healthProfile ? (t.healthProfile.signatureUrl || t.healthProfile.signedAt ? 'signed' : 'unsigned') : 'empty',
        genderLabel: t.gender === 'male' ? '男' : t.gender === 'female' ? '女' : '',
        sceneCode: sceneCache.get(t.id) || '',
      }));
      this.setData({
        targets: [...this.data.targets, ...newItems],
        hasMore: newItems.length >= this.data.pageSize,
      });
      this._refreshDerived();
      this._prefetchSceneCodes(newItems);
    } catch {
      this.setData({ page: this.data.page - 1 });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearch(e: any) {
    const keyword = (e.detail.value || '').trim();
    this.setData({ searchKeyword: keyword, targets: [], page: 1, hasMore: true });
    this.loadTargets();
  },

  goEditProfile(e: any) {
    const subjectId = e.currentTarget.dataset.subjectid;
    wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${subjectId}&adminMode=1` });
  },

  async _prefetchSceneCodes(items: any[]) {
    const unsigned = items.filter(
      (t: any) => t.profileStatus !== 'signed' && !sceneCache.has(t.id),
    );
    if (!unsigned.length) return;

    // 限并发：原 Promise.allSettled 一次最多发起 unsigned.length 条；
    // 当列表 50+ 时容易把 wx.request 同时上限挤爆，改成最多 5 条同时跑。
    const tasks = unsigned.map((t: any) => async () => {
      try {
        const r: any = await get(`/orders/health-sign-scene/${t.id}`);
        return { id: t.id, sceneCode: r.sceneCode };
      } catch {
        return null;
      }
    });

    const fulfilled: Array<{ id: any; sceneCode: any }> = [];
    const POOL = 5;
    let cursor = 0;
    async function pump() {
      while (cursor < tasks.length) {
        const myTask = tasks[cursor++];
        const res = await myTask();
        if (res) fulfilled.push(res);
      }
    }
    await Promise.all(new Array(Math.min(POOL, tasks.length)).fill(0).map(() => pump()));

    let changed = false;
    const updated = [...this.data.targets];
    for (const { id, sceneCode } of fulfilled) {
      sceneCache.set(id, sceneCode);
      const idx = updated.findIndex((t: any) => t.id === id);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], sceneCode };
        changed = true;
      }
    }
    if (changed) {
      this.setData({ targets: updated });
      this._refreshDerived();
    }
  },

  onShareAppMessage(e: any) {
    const target = this.data.targets.find(
      (t: any) => t.id === Number(e?.target?.dataset?.subjectid),
    );
    if (!target || !target.sceneCode) {
      return {
        title: '陪了个伴 - 健康档案签署',
        path: '/pages/index/index',
      };
    }
    const title = `请为「${target.name}」填写并签署健康档案`;
    const path = `/pages/health-profile/health-profile?subjectId=${target.id}&qrScene=${encodeURIComponent(target.sceneCode)}`;
    const coverInput = {
      subjectName: target.name || '就诊人',
      statusText: target.profileStatus === 'empty' ? '待填写' : '待签署',
    };
    // 符合微信官方规范：同步返回基础分享信息，promise 字段异步补图
    const shareInfo: any = { title, path };
    shareInfo.promise = renderHealthSignShareCover(this, coverInput).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
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
