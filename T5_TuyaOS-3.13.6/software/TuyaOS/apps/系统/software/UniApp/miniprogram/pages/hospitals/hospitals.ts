import { get } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { ensureUserPageAccess } from '../../utils/identity';
import { resolvePublicUrl } from '../../utils/media-url';
import { buildCityRowFromMap, parseHospitalsRegionsResponse } from '../../utils/hospital-regions';

function dialablePhone(raw: string): string {
  const s = (raw || '').trim().replace(/\s/g, '');
  if (!s) return '';
  if (s.startsWith('+')) {
    return '+' + s.slice(1).replace(/\D/g, '');
  }
  return s.replace(/\D/g, '');
}

/** 如 "0578-2285888 · 门诊"：优先取第一个含足够数字的片段 */
function dialableFromLabeledPhone(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const chunks = s.split(/\s*·\s*/);
  for (const c of chunks) {
    const d = dialablePhone(c);
    if (d.replace(/\D/g, '').length >= 5) return d;
  }
  const d = dialablePhone(s);
  return d.replace(/\D/g, '').length >= 5 ? d : '';
}

function mapHospitalRow(h: any) {
  const keys = h.keyDepartments ?? h.key_departments;
  const phones = h.phonesExtra ?? h.phones_extra;
  const phonesExtraParts = Array.isArray(phones)
    ? phones.map((x: any) => String(x))
    : phones != null && String(phones).trim()
      ? [String(phones)]
      : [];
  const rawImg = h.imageUrl ?? h.image_url ?? '';
  return {
    ...h,
    imageUrl: rawImg ? resolvePublicUrl(rawImg) : '',
    shortName: h.shortName ?? h.short_name ?? '',
    hospitalLevel: h.hospitalLevel ?? h.hospital_level ?? '',
    phoneMain: h.phoneMain ?? h.phone_main ?? '',
    keyDepartmentsText: Array.isArray(keys) ? keys.join('、') : '',
    phonesExtraText: phonesExtraParts.length ? phonesExtraParts.join(' · ') : '',
    phonesExtraParts,
    websiteUrl: h.websiteUrl ?? h.website_url ?? '',
    latitude: h.latitude ?? h.lat ?? null,
    longitude: h.longitude ?? h.lng ?? null,
    distanceKm: (() => {
      const d = h.distanceKm ?? h.distance_km;
      if (d == null || d === '') return null;
      const n = Number(d);
      if (!Number.isFinite(n)) return null;
      return Math.round(n * 10) / 10;
    })(),
  };
}

Page({
  data: {
    statusBarHeight: 20,
    provinceOptions: [{ label: '全部', province: '' }] as { label: string; province: string }[],
    /** 省 -> 库里出现过的市（来自 GET /hospitals/regions） */
    regionCitiesByProvince: {} as Record<string, string[]>,
    provinceIndex: 0,
    cityOptionsRow: [{ label: '全部地区', city: '' }] as { label: string; city: string }[],
    cityIndex: 0,
    showCityRow: false,
    keyword: '',
    items: [] as any[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loadingMore: false,
    listFinished: false,
    detailVisible: false,
    detail: null as any | null,
    detailDoctors: [] as any[],
    detailDoctorsLoading: false,
    pageLoaded: false,
  },

  async onLoad(options: Record<string, string | undefined>) {
    if (isLoggedIn() && !(await ensureUserPageAccess())) return;
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    await this.loadRegions();
    await this.loadPage(1, true);

    const hid = options?.openHospitalId;
    if (hid) {
      const id = Number(hid);
      if (Number.isFinite(id)) {
        try {
          const row: any = await get(`/hospitals/lookup/${id}`);
          const item = mapHospitalRow(row);
          await this.openDetailForHospital(item);
        } catch (e) {
          console.warn('打开指定医院失败', e);
        }
      }
    }

    this.setData({ pageLoaded: true });
  },

  /** 根据启用医院数据拉取省、市，动态生成筛选 chip */
  async loadRegions() {
    try {
      const res: any = await get('/hospitals/regions');
      const { provinceOptions, regionCitiesByProvince } = parseHospitalsRegionsResponse(res);

      let pIdx = this.data.provinceIndex;
      if (pIdx >= provinceOptions.length) pIdx = 0;

      const selP = provinceOptions[pIdx]?.province ?? '';
      const cityOptionsRow = selP
        ? buildCityRowFromMap(selP, regionCitiesByProvince)
        : [{ label: '全部地区', city: '' }];

      let cIdx = this.data.cityIndex;
      if (cIdx >= cityOptionsRow.length) cIdx = 0;

      this.setData({
        provinceOptions,
        regionCitiesByProvince,
        provinceIndex: pIdx,
        cityOptionsRow,
        cityIndex: cIdx,
        showCityRow: Boolean(selP) && cityOptionsRow.length > 1,
      });
    } catch (e) {
      console.warn('加载地区筛选失败', e);
      const { provinceOptions, regionCitiesByProvince } = parseHospitalsRegionsResponse(null);
      let pIdx = Math.min(this.data.provinceIndex, provinceOptions.length - 1);
      const selP = provinceOptions[pIdx]?.province ?? '';
      const cityOptionsRow = selP
        ? buildCityRowFromMap(selP, regionCitiesByProvince)
        : [{ label: '全部地区', city: '' }];
      let cIdx = Math.min(this.data.cityIndex, Math.max(0, cityOptionsRow.length - 1));
      this.setData({
        provinceOptions,
        regionCitiesByProvince,
        provinceIndex: pIdx,
        cityOptionsRow,
        cityIndex: cIdx,
        showCityRow: Boolean(selP) && cityOptionsRow.length > 1,
      });
    }
  },

  async onShow() {
    if (isLoggedIn() && !(await ensureUserPageAccess())) return;
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },

  openMap() {
    const kw = (this.data.keyword || '').trim();
    const q: string[] = [];
    const popts = this.data.provinceOptions || [];
    const pOpt = popts[this.data.provinceIndex];
    const row = this.data.cityOptionsRow || [];
    const cOpt = row[this.data.cityIndex];
    if (pOpt?.province) q.push(`province=${encodeURIComponent(String(pOpt.province))}`);
    if (cOpt?.city) q.push(`city=${encodeURIComponent(String(cOpt.city))}`);
    if (kw) q.push(`keyword=${encodeURIComponent(kw)}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    wx.navigateTo({ url: `/pages/hospital-map/hospital-map${qs}` });
  },

  onProvinceChipTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    const opts = this.data.provinceOptions || [];
    const p = opts[idx]?.province ?? '';
    const cmap = this.data.regionCitiesByProvince || {};
    const row = !p
      ? [{ label: '全部地区', city: '' }]
      : buildCityRowFromMap(p, cmap);
    this.setData({
      provinceIndex: idx,
      cityIndex: 0,
      cityOptionsRow: row,
      showCityRow: Boolean(p) && row.length > 1,
    });
    this.loadPage(1, true);
  },

  onCityChipTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    this.setData({ cityIndex: idx });
    this.loadPage(1, true);
  },

  onKeywordInput(e: any) {
    this.setData({ keyword: e.detail.value || '' });
  },

  onSearchConfirm() {
    this.loadPage(1, true);
  },

  async loadPage(page: number, replace: boolean) {
    if (this.data.loading || this.data.loadingMore) return;
    const isFirst = page === 1 || replace;
    if (isFirst) {
      this.setData({ loading: true, listFinished: false });
    } else {
      if (this.data.listFinished) return;
      this.setData({ loadingMore: true });
    }

    const params: Record<string, string | number> = {
      page,
      pageSize: this.data.pageSize,
    };
    const kw = (this.data.keyword || '').trim();
    if (kw) params.keyword = kw;

    const popts = this.data.provinceOptions || [];
    const pOpt = popts[this.data.provinceIndex] || popts[0] || { province: '', label: '全部' };
    const row = this.data.cityOptionsRow || [{ label: '全部地区', city: '' }];
    const cOpt = row[this.data.cityIndex] || row[0];
    if (pOpt.province) params.province = pOpt.province;
    if (cOpt?.city) params.city = cOpt.city;

    try {
      const res: any = await get('/hospitals', params);
      const raw = res?.items || [];
      const mapped = (Array.isArray(raw) ? raw : []).map(mapHospitalRow);
      const totalRaw = res?.total;
      const totalNum = totalRaw != null && totalRaw !== '' ? Number(totalRaw) : NaN;
      const prev = replace || isFirst ? [] : this.data.items;
      const items = prev.concat(mapped);
      let finished = false;
      if (!isFirst && mapped.length === 0) {
        finished = true;
      } else if (Number.isFinite(totalNum) && totalNum >= 0) {
        finished = items.length >= totalNum;
      } else {
        finished = mapped.length < this.data.pageSize;
      }
      this.setData({
        total: Number.isFinite(totalNum) ? totalNum : items.length,
        items,
        page,
        listFinished: finished,
        loading: false,
        loadingMore: false,
      });
    } catch (e) {
      console.log('医院列表加载失败', e);
      this.setData({ loading: false, loadingMore: false });
    }
  },

  /** 页面滚动触底（scroll-view 在无固定高度时可能不触发 bindscrolltolower） */
  onReachBottom() {
    if (this.data.detailVisible) return;
    this.onScrollToLower();
  },

  onScrollToLower() {
    if (this.data.listFinished || this.data.loading || this.data.loadingMore) return;
    const next = this.data.page + 1;
    this.loadPage(next, false);
  },

  async openDetailForHospital(item: any) {
    if (!item?.id) return;
    const id = item.id;
    this.setData({
      detailVisible: true,
      detail: item,
      detailDoctors: [],
      detailDoctorsLoading: true,
    });
    try {
      const list: any = await get(`/hospitals/${id}/doctors`);
      const arr = Array.isArray(list) ? list : [];
      this.setData({ detailDoctors: arr, detailDoctorsLoading: false });
    } catch {
      this.setData({ detailDoctors: [], detailDoctorsLoading: false });
    }
  },

  async openDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.items.find((x: any) => x.id === id);
    if (!item) return;
    await this.openDetailForHospital(item);
  },

  closeDetail() {
    this.setData({ detailVisible: false, detail: null, detailDoctors: [] });
  },

  noop() {},

  onDialPhone(e: any) {
    const raw = String(e.currentTarget?.dataset?.phone || '').trim();
    if (!raw) {
      wx.showToast({ title: '暂无公开电话', icon: 'none' });
      return;
    }
    const phone = dialableFromLabeledPhone(raw);
    if (!phone) {
      wx.showToast({ title: '无法识别号码', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => {
        wx.showToast({ title: '无法发起拨号', icon: 'none' });
      },
    });
  },

  onListCallPhone(e: any) {
    const raw = String(e.currentTarget.dataset.phone || '');
    const phone = dialablePhone(raw);
    if (!phone) {
      wx.showToast({ title: '暂无公开电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => {
        wx.showToast({ title: '无法发起拨号', icon: 'none' });
      },
    });
  },

  async onOpenLocation() {
    const d = this.data.detail;
    if (!d?.id) return;

    let lat = parseFloat(String(d.latitude ?? '').trim());
    let lng = parseFloat(String(d.longitude ?? '').trim());

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      wx.showLoading({ title: '正在打开地图…', mask: true });
      try {
        const pt: any = await get(`/hospitals/${d.id}/map-point`);
        lat = Number(pt?.latitude);
        lng = Number(pt?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          this.setData({ detail: { ...d, latitude: lat, longitude: lng } });
        }
      } catch (e: any) {
        wx.hideLoading();
        const msg = e?.message || '暂时无法打开地图';
        wx.showToast({ title: String(msg).slice(0, 36), icon: 'none', duration: 2800 });
        return;
      }
      wx.hideLoading();
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      wx.showToast({ title: '无法获取位置', icon: 'none' });
      return;
    }

    const address =
      [d.city, d.district, d.address].filter(Boolean).join('') || (d.address || '');
    wx.openLocation({
      latitude: lat,
      longitude: lng,
      name: String(d.name || '医院').slice(0, 100),
      address: String(address).slice(0, 200),
      scale: 17,
      fail: () => {
        wx.showToast({ title: '打开微信地图失败', icon: 'none' });
      },
    });
  },
});
