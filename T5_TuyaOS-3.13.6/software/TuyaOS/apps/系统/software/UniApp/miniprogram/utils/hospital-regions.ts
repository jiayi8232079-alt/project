/** 医院名录页 / 下单选医院共用的省市区数据（与 GET /hospitals/regions 解析一致） */

export const FALLBACK_PROVINCE_OPTIONS = [
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

export function fallbackCityMap(): Record<string, string[]> {
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

export function buildCityRowFromMap(
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

export function parseHospitalsRegionsResponse(res: any): {
  provinceOptions: { label: string; province: string }[];
  regionCitiesByProvince: Record<string, string[]>;
} {
  const provinces: string[] = Array.isArray(res?.provinces) ? res.provinces : [];
  const fromApi =
    res?.citiesByProvince && typeof res.citiesByProvince === 'object'
      ? (res.citiesByProvince as Record<string, string[]>)
      : {};

  if (provinces.length > 0) {
    const provinceOptions = [{ label: '全部', province: '' }, ...provinces.map((p) => ({ label: p, province: p }))];
    const regionCitiesByProvince: Record<string, string[]> = {};
    for (const p of provinces) {
      regionCitiesByProvince[p] = Array.isArray(fromApi[p]) ? [...fromApi[p]] : [];
    }
    return { provinceOptions, regionCitiesByProvince };
  }

  return {
    provinceOptions: FALLBACK_PROVINCE_OPTIONS,
    regionCitiesByProvince: fallbackCityMap(),
  };
}
