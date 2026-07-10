import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AMAP_TEXT = 'https://restapi.amap.com/v3/place/text';
const AMAP_DETAIL = 'https://restapi.amap.com/v3/place/detail';
const AMAP_GEOCODE = 'https://restapi.amap.com/v3/geocode/geo';

export type AmapHospitalPoi = {
  poiId: string;
  matchedName: string;
  address: string | null;
  phoneMain: string | null;
  phonesExtra: string[] | null;
  imageUrl: string | null;
  latitude: string | null;
  longitude: string | null;
  websiteUrl: string | null;
};

function splitTel(tel: string): { main: string | null; extra: string[] | null } {
  if (!tel?.trim()) return { main: null, extra: null };
  const parts = tel
    .split(/[;；,，|｜]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return { main: null, extra: null };
  return { main: parts[0], extra: parts.length > 1 ? parts.slice(1) : null };
}

function normName(s: string): string {
  return s.replace(/\s/g, '').toLowerCase();
}

@Injectable()
export class AmapPlacesService {
  private readonly logger = new Logger(AmapPlacesService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('AMAP_WEB_KEY')?.trim();
  }

  /**
   * 使用高德关键字搜索 + POI 详情（extensions=all）。
   * 请确保已阅读并遵守 https://lbs.amap.com 服务条款与配额限制。
   */
  async resolveHospitalPoi(input: {
    name: string;
    city: string;
    shortName?: string | null;
    district?: string | null;
  }): Promise<AmapHospitalPoi | null> {
    const key = this.config.get<string>('AMAP_WEB_KEY')?.trim();
    if (!key) return null;

    let pois = await this.placeTextSearch(input.name, input.city, key);
    if ((!pois || pois.length === 0) && input.shortName?.trim()) {
      pois = await this.placeTextSearch(input.shortName.trim(), input.city, key);
    }
    if (!pois || pois.length === 0) return null;

    const picked = this.pickBestPoi(pois, input.name, input.district);
    if (!picked?.id) return null;

    const detailPoi = await this.placeDetail(String(picked.id), key);
    const merged = detailPoi && detailPoi.id ? { ...picked, ...detailPoi } : picked;
    return this.parsePoi(merged);
  }

  private async amapGet(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, v);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(u.toString(), { signal: ctrl.signal });
      if (!res.ok) {
        throw new BadGatewayException(`高德地图服务异常（HTTP ${res.status}）`);
      }
      const json = (await res.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (!json || typeof json !== 'object') {
        throw new BadGatewayException('高德地图返回格式异常');
      }
      return json;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.warn(
        `高德请求失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('高德地图服务暂时不可用，请稍后重试');
    } finally {
      clearTimeout(t);
    }
  }

  private async placeTextSearch(keywords: string, city: string, key: string): Promise<any[]> {
    const data = await this.amapGet(AMAP_TEXT, {
      key,
      keywords,
      city: city || '',
      output: 'JSON',
      offset: '10',
      page: '1',
      extensions: 'all',
    });
    if (String(data.status) !== '1') {
      this.logger.warn(`place/text: ${data.info} (${data.infocode})`);
      return [];
    }
    const pois = data.pois;
    return Array.isArray(pois) ? pois : [];
  }

  /**
   * 按城市 + POI 类型分页检索（综合医院 / 专科医院等）。extensions=all。
   * 单关键字单次检索最多 100 页（offset 最大 25 → 至多约 2500 条）。
   */
  async searchMedicalFacilitiesPage(input: {
    city: string;
    page: number;
    offset?: number;
    /** 默认 090100|090200：综合医院、专科医院 */
    types?: string;
    /** 与 types 组合；可为空串仅按类型筛 */
    keywords?: string;
  }): Promise<{ pois: Record<string, unknown>[]; total: number; info?: string; infocode?: string }> {
    const key = this.config.get<string>('AMAP_WEB_KEY')?.trim();
    if (!key) {
      return { pois: [], total: 0, info: 'NO_KEY' };
    }
    const offset = Math.min(25, Math.max(1, input.offset ?? 25));
    const page = Math.max(1, Math.min(100, input.page));
    const types = (input.types ?? '090100|090200').trim();
    const keywords = input.keywords ?? '';

    const data = await this.amapGet(AMAP_TEXT, {
      key,
      keywords,
      types,
      city: input.city || '',
      output: 'JSON',
      offset: String(offset),
      page: String(page),
      extensions: 'all',
    });

    if (String(data.status) !== '1') {
      this.logger.warn(`place/text(page): ${data.info} (${data.infocode}) city=${input.city} page=${page}`);
      return {
        pois: [],
        total: 0,
        info: String(data.info ?? ''),
        infocode: data.infocode != null ? String(data.infocode) : undefined,
      };
    }

    const poisRaw = data.pois;
    const pois = Array.isArray(poisRaw) ? (poisRaw as Record<string, unknown>[]) : [];
    const total = Number.parseInt(String(data.count ?? '0'), 10) || 0;
    return { pois, total };
  }

  private async placeDetail(id: string, key: string): Promise<Record<string, unknown> | null> {
    const data = await this.amapGet(AMAP_DETAIL, {
      key,
      id,
      output: 'JSON',
      extensions: 'all',
    });
    if (String(data.status) !== '1') {
      this.logger.debug(`place/detail: ${data.info} (${data.infocode})`);
      return null;
    }
    const pois = data.pois;
    if (Array.isArray(pois) && pois[0] && typeof pois[0] === 'object') {
      return pois[0] as Record<string, unknown>;
    }
    return null;
  }

  private pickBestPoi(pois: any[], targetName: string, district: string | null | undefined): any | null {
    if (!pois.length) return null;
    const t = normName(targetName);
    const d = (district || '').replace(/县市区自治县$/g, '');

    let best = pois[0];
    let bestScore = -1;

    for (const p of pois) {
      const n = normName(String(p.name || ''));
      let score = 0;
      if (n && t && n === t) score += 5;
      else if (n.length >= 4 && t.includes(n)) score += 3;
      else if (n.length >= 4 && n.includes(t)) score += 2;
      else if (n.length >= 4 && t.includes(n.slice(0, Math.min(8, n.length)))) score += 1;

      const adname = String(p.adname || '');
      if (d && adname && (adname.includes(d) || d.includes(adname.replace(/县|区|市$/, '')))) {
        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    return best;
  }

  /** 将 place/text 或 place/detail 单条 POI 转为结构化字段 */
  parsePoi(poi: Record<string, unknown>): AmapHospitalPoi | null {
    const id = poi.id != null ? String(poi.id) : '';
    const name = String(poi.name || '').trim();
    if (!id || !name) return null;

    const telRaw = String(poi.tel || '').trim();
    const { main, extra } = splitTel(telRaw);

    let imageUrl: string | null = null;
    const photos = poi.photos;
    if (Array.isArray(photos)) {
      for (const ph of photos) {
        if (ph && typeof ph === 'object' && ph !== null) {
          const u = String((ph as { url?: string }).url || '').trim();
          if (u.startsWith('http')) {
            imageUrl = u;
            break;
          }
        }
      }
    }

    let latitude: string | null = null;
    let longitude: string | null = null;
    const loc = String(poi.location || '');
    if (loc.includes(',')) {
      const [lng, lat] = loc.split(',');
      const lngT = lng?.trim();
      const latT = lat?.trim();
      if (lngT && latT) {
        longitude = lngT;
        latitude = latT;
      }
    }

    const websiteRaw = String(poi.website || '').trim();
    const websiteUrl = websiteRaw || null;

    const address = String(poi.address || '').trim() || null;

    return {
      poiId: id,
      matchedName: name,
      address,
      phoneMain: main,
      phonesExtra: extra,
      imageUrl,
      latitude,
      longitude,
      websiteUrl,
    };
  }

  /**
   * 结构化地址 → GCJ-02 经纬度（与微信小程序 wx.openLocation 一致）
   */
  async geocodeAddress(input: {
    address: string;
    city?: string | null;
  }): Promise<{ lat: number; lng: number } | null> {
    const key = this.config.get<string>('AMAP_WEB_KEY')?.trim();
    const addr = (input.address || '').trim();
    if (!key || !addr) return null;

    const data = await this.amapGet(AMAP_GEOCODE, {
      key,
      address: addr,
      city: (input.city || '').trim(),
      output: 'JSON',
    });

    if (String(data.status) !== '1') {
      this.logger.warn(`geocode/geo: ${data.info} (${data.infocode})`);
      return null;
    }
    const geocodes = data.geocodes;
    if (!Array.isArray(geocodes) || !geocodes.length) return null;
    const loc = String((geocodes[0] as { location?: string }).location || '').trim();
    if (!loc.includes(',')) return null;
    const [lngStr, latStr] = loc.split(',');
    const lng = parseFloat(lngStr.trim());
    const lat = parseFloat(latStr.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }
}
