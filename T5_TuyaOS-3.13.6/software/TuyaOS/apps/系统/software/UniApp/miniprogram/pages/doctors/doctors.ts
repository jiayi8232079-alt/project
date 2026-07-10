import { get } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { ensureUserPageAccess } from '../../utils/identity';
import { resolvePublicUrl } from '../../utils/media-url';

const FALLBACK_PROVINCE_OPTIONS = [
  { label: '全部', province: '' },
  { label: '浙江省', province: '浙江省' },
  { label: '上海市', province: '上海市' },
];

const FALLBACK_CITY_ROWS: Record<string, { label: string; city: string }[]> = {
  '': [{ label: '全部地区', city: '' }],
  浙江省: [
    { label: '全部', city: '' },
    { label: '杭州', city: '杭州市' },
    { label: '丽水', city: '丽水市' },
    { label: '温州', city: '温州市' },
  ],
  上海市: [{ label: '全部', city: '' }],
};

function fallbackCityMap(): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const p of Object.keys(FALLBACK_CITY_ROWS)) {
    if (!p) continue;
    m[p] = (FALLBACK_CITY_ROWS[p] || []).map((x) => x.city).filter(Boolean);
  }
  return m;
}

function cityChipLabel(city: string): string {
  if (!city) return '';
  return city.length > 1 && city.endsWith('市') ? city.slice(0, -1) : city;
}

function buildCityRowFromMap(
  province: string,
  cityMap: Record<string, string[]>,
): { label: string; city: string }[] {
  if (!province) return [{ label: '全部地区', city: '' }];
  const cities = cityMap[province] || [];
  if (!cities.length) return [{ label: '全部', city: '' }];
  return [
    { label: '全部', city: '' },
    ...cities.map((c) => ({ label: cityChipLabel(c), city: c })),
  ];
}

function normalizeRegionLabel(label?: string | null): string {
  const value = String(label || '').trim();
  if (!value || value === '全部' || value === '全部地区') return '';
  return value;
}

function buildRegionSummary(provinceLabel?: string, cityLabel?: string): string {
  const province = normalizeRegionLabel(provinceLabel);
  const city = normalizeRegionLabel(cityLabel);
  if (province && city) return `${province} · ${city}`;
  if (province) return province;
  return '全国';
}

function mapDoctorRow(d: any) {
  const hospitalCity = d.hospitalCity ?? d.hospital_city ?? '';
  const hospitalDistrict = d.hospitalDistrict ?? d.hospital_district ?? '';
  return {
    id: d.id,
    hospitalId: d.hospitalId ?? d.hospital_id,
    name: d.name ?? '',
    department: d.department ?? '',
    titleLevel: d.titleLevel ?? d.title_level ?? '',
    expertise: d.expertise ?? '',
    introduction: d.introduction ?? '',
    avatarUrl: resolvePublicUrl(d.avatarUrl ?? d.avatar_url ?? ''),
    hospitalName: d.hospitalName ?? d.hospital_name ?? '',
    hospitalCity,
    hospitalDistrict,
    hospitalRegionText: [hospitalCity, hospitalDistrict].filter(Boolean).join(' · '),
  };
}

Page({
  data: {
    statusBarHeight: 20,
    provinceOptions: [{ label: '全部', province: '' }] as { label: string; province: string }[],
    regionCitiesByProvince: {} as Record<string, string[]>,
    provinceIndex: 0,
    provinceLabel: '全部',
    cityOptionsRow: [{ label: '全部地区', city: '' }] as { label: string; city: string }[],
    cityIndex: 0,
    cityLabel: '全部地区',
    activeRegionText: '全国',
    showCityRow: false,
    keyword: '',
    items: [] as any[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loadingMore: false,
    listFinished: false,
    pageLoaded: false,
    showDetail: false,
    detailDoctor: null as any,
  },

  async onLoad() {
    if (isLoggedIn() && !(await ensureUserPageAccess())) return;
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    await this.loadRegions();
    await this.loadPage(1, true);
    this.setData({ pageLoaded: true });
  },

  async loadRegions() {
    try {
      const res: any = await get('/hospitals/regions');
      const provinces: string[] = Array.isArray(res?.provinces) ? res.provinces : [];
      const fromApi =
        res?.citiesByProvince && typeof res.citiesByProvince === 'object'
          ? (res.citiesByProvince as Record<string, string[]>)
          : {};

      let provinceOptions: { label: string; province: string }[];
      let regionCitiesByProvince: Record<string, string[]>;

      if (provinces.length > 0) {
        provinceOptions = [{ label: '全部', province: '' }, ...provinces.map((p) => ({ label: p, province: p }))];
        regionCitiesByProvince = {};
        for (const p of provinces) {
          const arr = Array.isArray(fromApi[p]) ? [...fromApi[p]] : [];
          regionCitiesByProvince[p] = arr;
        }
      } else {
        provinceOptions = FALLBACK_PROVINCE_OPTIONS;
        regionCitiesByProvince = fallbackCityMap();
      }

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
        provinceLabel: provinceOptions[pIdx]?.label || '全部',
        cityOptionsRow,
        cityIndex: cIdx,
        cityLabel: cityOptionsRow[cIdx]?.label || (selP ? '全部' : '全部地区'),
        activeRegionText: buildRegionSummary(
          provinceOptions[pIdx]?.label || '全部',
          cityOptionsRow[cIdx]?.label || (selP ? '全部' : '全部地区'),
        ),
        showCityRow: Boolean(selP) && cityOptionsRow.length > 1,
      });
    } catch (e) {
      console.warn('加载地区筛选失败', e);
      const provinceOptions = FALLBACK_PROVINCE_OPTIONS;
      const regionCitiesByProvince = fallbackCityMap();
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
        provinceLabel: provinceOptions[pIdx]?.label || '全部',
        cityOptionsRow,
        cityIndex: cIdx,
        cityLabel: cityOptionsRow[cIdx]?.label || (selP ? '全部' : '全部地区'),
        activeRegionText: buildRegionSummary(
          provinceOptions[pIdx]?.label || '全部',
          cityOptionsRow[cIdx]?.label || (selP ? '全部' : '全部地区'),
        ),
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

  onProvinceChipTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    const opts = this.data.provinceOptions || [];
    const p = opts[idx]?.province ?? '';
    const cmap = this.data.regionCitiesByProvince || {};
    const row = !p ? [{ label: '全部地区', city: '' }] : buildCityRowFromMap(p, cmap);
    const provinceLabel = opts[idx]?.label || '全部';
    const cityLabel = row[0]?.label || (p ? '全部' : '全部地区');
    this.setData({
      provinceIndex: idx,
      provinceLabel,
      cityIndex: 0,
      cityOptionsRow: row,
      cityLabel,
      activeRegionText: buildRegionSummary(provinceLabel, cityLabel),
      showCityRow: Boolean(p) && row.length > 1,
    });
    this.loadPage(1, true);
  },

  onCityChipTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    const row = this.data.cityOptionsRow || [{ label: '全部地区', city: '' }];
    const cityLabel = row[idx]?.label || row[0]?.label || '全部地区';
    this.setData({
      cityIndex: idx,
      cityLabel,
      activeRegionText: buildRegionSummary(this.data.provinceLabel, cityLabel),
    });
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

    const popts = this.data.provinceOptions || [];
    const pOpt = popts[this.data.provinceIndex] || popts[0] || { province: '', label: '全部' };
    const row = this.data.cityOptionsRow || [{ label: '全部地区', city: '' }];
    const cOpt = row[this.data.cityIndex] || row[0];
    const params: Record<string, string | number> = {
      page,
      pageSize: this.data.pageSize,
    };
    if (pOpt.province) params.province = pOpt.province;
    if (cOpt?.city) params.city = cOpt.city;
    const kw = (this.data.keyword || '').trim();
    if (kw) params.keyword = kw;

    try {
      const res: any = await get('/hospitals/doctor-directory', params);
      const raw = res?.items || [];
      const mapped = (Array.isArray(raw) ? raw : []).map(mapDoctorRow);
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
        items,
        total: Number.isFinite(totalNum) ? totalNum : items.length,
        page,
        listFinished: finished,
        loading: false,
        loadingMore: false,
      });
    } catch (e) {
      console.log('医生名录加载失败', e);
      this.setData({ loading: false, loadingMore: false });
    }
  },

  onReachBottom() {
    this.onScrollToLower();
  },

  onScrollToLower() {
    if (this.data.listFinished || this.data.loading || this.data.loadingMore) return;
    const next = this.data.page + 1;
    this.loadPage(next, false);
  },

  onDoctorTap(e: any) {
    const id = e.currentTarget.dataset.id;
    const doc = this.data.items.find((d: any) => d.id === id);
    if (!doc) return;
    this.setData({ showDetail: true, detailDoctor: doc });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  goHospitalFromDetail() {
    const hid = this.data.detailDoctor?.hospitalId;
    if (hid == null || hid === '') return;
    this.setData({ showDetail: false });
    wx.navigateTo({ url: `/pages/hospitals/hospitals?openHospitalId=${hid}` });
  },

  goHospital(e: any) {
    const hid = e.currentTarget.dataset.hid;
    if (hid == null || hid === '') return;
    wx.navigateTo({ url: `/pages/hospitals/hospitals?openHospitalId=${hid}` });
  },
});
