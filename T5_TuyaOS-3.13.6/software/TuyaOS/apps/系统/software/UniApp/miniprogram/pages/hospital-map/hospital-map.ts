import { get } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { ensureUserPageAccess } from '../../utils/identity';

/** 地图标点（与接口字段一致） */
type MarkerHospital = {
  id: number;
  name: string;
  shortName?: string | null;
  latitude: number;
  longitude: number;
  city?: string;
  district?: string | null;
  address?: string;
};

function clampRadiusKm(r: number): number {
  if (!Number.isFinite(r)) return 50;
  return Math.min(200, Math.max(3, r));
}

function scaleForRadiusKm(radiusKm: number): number {
  if (radiusKm <= 10) return 13;
  if (radiusKm <= 25) return 12;
  if (radiusKm <= 50) return 11;
  return 10;
}

Page({
  data: {
    mapHeightPx: 500,
    mapLat: 31.2304,
    mapLng: 121.4737,
    scale: 11,
    markers: [] as any[],
    showLocation: false,
    loading: true,
    selected: null as MarkerHospital | null,
    hospitals: [] as MarkerHospital[],
    emptyHint: '',
    usedNearbyScope: false,
    canRetryLocation: false,
    /** 供「重新定位」使用 */
    radiusKm: 50,
    filterProvince: '',
    filterCity: '',
    filterKeyword: '',
  },

  noop() {},

  async onLoad(query: Record<string, string | undefined>) {
    if (isLoggedIn() && !(await ensureUserPageAccess())) return;
    const sys = wx.getSystemInfoSync();
    const h = sys.windowHeight || 600;
    this.setData({ mapHeightPx: h });

    const province = query.province ? decodeURIComponent(query.province) : '';
    const city = query.city ? decodeURIComponent(query.city) : '';
    const keyword = query.keyword ? decodeURIComponent(query.keyword) : '';
    let radiusKm = query.radiusKm != null ? Number(query.radiusKm) : 50;
    radiusKm = clampRadiusKm(radiusKm);

    let userLat = query.userLat != null ? Number(query.userLat) : NaN;
    let userLng = query.userLng != null ? Number(query.userLng) : NaN;

    this.setData({
      radiusKm,
      filterProvince: province,
      filterCity: city,
      filterKeyword: keyword,
    });

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      userLat = NaN;
      userLng = NaN;
    }

    await this.loadMarkers(userLat, userLng, radiusKm, province, city, keyword);
  },

  async loadMarkers(
    lat: number,
    lng: number,
    radiusKm: number,
    province: string,
    city: string,
    keyword: string,
  ) {
    this.setData({ loading: true, emptyHint: '', canRetryLocation: false, selected: null });

    const params: Record<string, string | number> = {};
    if (keyword.trim()) params.keyword = keyword.trim();

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    let usedNearby = false;

    if (hasCoords) {
      params.latitude = lat;
      params.longitude = lng;
      params.radiusKm = clampRadiusKm(radiusKm);
      usedNearby = true;
    } else {
      if (province.trim()) params.province = province.trim();
      if (city.trim()) params.city = city.trim();
    }

    try {
      const list: any = await get('/hospitals/map-markers', params);
      const raw = Array.isArray(list) ? list : [];
      const hospitals: MarkerHospital[] = raw
        .map((x: any) => ({
          id: x.id,
          name: x.name ?? '',
          shortName: x.shortName ?? null,
          latitude: Number(x.latitude),
          longitude: Number(x.longitude),
          city: x.city,
          district: x.district ?? null,
          address: x.address ?? '',
        }))
        .filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));

      const markers = hospitals.map((h, idx) => ({
        id: idx,
        hospitalId: h.id,
        latitude: h.latitude,
        longitude: h.longitude,
        title: h.name.slice(0, 20),
        width: 28,
        height: 28,
      }));

      let mapLat = this.data.mapLat;
      let mapLng = this.data.mapLng;
      let scale = 11;

      if (hasCoords) {
        mapLat = lat;
        mapLng = lng;
        scale = scaleForRadiusKm(clampRadiusKm(radiusKm));
      } else if (hospitals.length > 0) {
        const latSum = hospitals.reduce((s, x) => s + x.latitude, 0);
        const lngSum = hospitals.reduce((s, x) => s + x.longitude, 0);
        mapLat = latSum / hospitals.length;
        mapLng = lngSum / hospitals.length;
        scale = hospitals.length === 1 ? 14 : 10;
      }

      let emptyHint = '';
      let canRetry = false;
      if (hospitals.length === 0) {
        if (usedNearby) {
          emptyHint = `当前位置约 ${clampRadiusKm(radiusKm)} km 内暂无带坐标的医院`;
          canRetry = true;
        } else if (!province && !city) {
          emptyHint = '请在「找医院」列表中选择省份、城市后，再打开地图查看标点';
          canRetry = true;
        } else {
          emptyHint = '该地区暂无可展示的地图标点';
        }
      }

      this.setData({
        hospitals,
        markers,
        mapLat,
        mapLng,
        scale,
        loading: false,
        usedNearbyScope: usedNearby,
        emptyHint,
        canRetryLocation: canRetry,
      });
    } catch (e) {
      console.error('地图标点加载失败', e);
      wx.showToast({ title: '标点加载失败', icon: 'none' });
      this.setData({
        loading: false,
        emptyHint: '加载失败，请稍后重试',
        canRetryLocation: true,
      });
    }
  },

  async retryLoadMarkers() {
    const { radiusKm, filterProvince, filterCity, filterKeyword } = this.data;
    await this.loadMarkers(NaN, NaN, radiusKm, filterProvince, filterCity, filterKeyword);
  },

  onMarkerTap(e: any) {
    const mkId = Number(e.detail?.markerId);
    if (Number.isNaN(mkId)) return;
    const markers = this.data.markers as any[];
    const m = markers.find((x) => x.id === mkId);
    if (!m?.hospitalId) return;
    const h = this.data.hospitals.find((x) => x.id === m.hospitalId);
    if (!h) return;
    this.setData({ selected: h });
  },

  closeSelected() {
    this.setData({ selected: null });
  },

  onRegionChange(_e: any) {
    // 保留：后续可做视野内聚合等
  },

  openLocationForSelected() {
    const h = this.data.selected;
    if (!h) return;
    wx.openLocation({
      latitude: h.latitude,
      longitude: h.longitude,
      name: h.name,
      address: [h.city, h.district, h.address].filter(Boolean).join(''),
      scale: 16,
      fail: () => wx.showToast({ title: '无法打开地图', icon: 'none' }),
    });
  },
});
