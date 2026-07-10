import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Repository,
  SelectQueryBuilder,
  ObjectLiteral,
  QueryFailedError,
} from 'typeorm';
import { Hospital } from '../../entities/hospital.entity.js';
import { HospitalDoctor } from '../../entities/hospital-doctor.entity.js';
import { AmapPlacesService } from './amap-places.service.js';
import {
  CreateHospitalDoctorDto,
  UpdateHospitalDoctorDto,
  BatchHospitalDoctorsDto,
} from './dto/hospital-doctor.dto.js';
import type { EnrichHospitalsAmapDto } from './dto/enrich-amap.dto.js';
import {
  ImportZhejiangAmapDto,
  ZHEJIANG_PREFECTURE_CITIES,
} from './dto/import-zhejiang-amap.dto.js';
import {
  BEIJING_AMAP_CITIES,
  GUANGDONG_PREFECTURE_CITIES,
  ImportRegionAmapDto,
} from './dto/import-region-amap.dto.js';
import { PurgeAncillaryHospitalsDto } from './dto/purge-ancillary-hospitals.dto.js';
import { PurgeMissingImageHospitalsDto } from './dto/purge-missing-image.dto.js';
import { RestorePublicStomatologyDto } from './dto/restore-public-stomatology.dto.js';
import { buildHangzhouShanghaiSeed } from './seeds/hangzhou-shanghai.seed.js';
import { buildPublicStomatologyRestoreSeed } from './seeds/public-stomatology-restore.seed.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldSkipImportedPoiName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return true;
  if (/药店|药房|大药房|医药连锁|卫生站\(已停用\)|宠物医院|动物医院/.test(n)) return true;
  /** 眼镜零售 / 配镜 / 视光门店（名称含「医院」的保留，如眼视光医院） */
  if (!/医院/.test(n)) {
    if (
      /眼镜店|眼镜超市|眼镜商行|眼镜批发|眼镜城|配镜店|钟表眼镜|隐形眼镜|光学眼镜|宝岛眼镜|博士眼镜|亮视点/.test(n)
    ) {
      return true;
    }
    if (/验光配镜|配镜中心|视光中心|视力保健|视力康复中心|配眼镜/.test(n)) return true;
    /** 民营正骨、推拿整脊等小诊所（含「医院」的骨科/中医院等保留） */
    if (/正骨|整脊|推拿复位/.test(n)) return true;
  }
  return false;
}

/** 综合/专科检索中排除：社区卫生小站点、无「医院」字样的诊所/门诊部；口腔类仅保留公立/附属等形态（民营专科口腔一律排除） */
function isLikelyPublicHospitalOrDental(n: string): boolean {
  return (
    /公立|人民|附属|大学|解放军|武警|省口腔|市口腔|县口腔|区口腔|军医|部队/.test(n) ||
    /中心医院|人民医院|第一医院|第二医院|第三医院|第四医院|第五医院|中医院|妇幼保健|儿童医院/.test(n) ||
    /口腔医学|齿科医学/.test(n)
  );
}

function shouldSkipClinicOrPrivateDentalPoi(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return true;

  if (
    /社区卫生服务中心|社区卫生服务站|社区健康服务中心|社康中心|村卫生室|^卫生室|医务室$|卫生所$|社区卫生服务|一体化村卫生室/.test(
      n,
    )
  ) {
    return true;
  }

  if ((/诊所/.test(n) || /门诊部/.test(n)) && !/医院/.test(n)) return true;

  if (/正骨|整脊/.test(n) && !/医院/.test(n)) return true;

  if (/口腔|牙科|齿科/.test(n)) {
    if (isLikelyPublicHospitalOrDental(n)) return false;
    if (/民营|私立|合资|股份/.test(n)) return true;
    if (
      /瑞尔|拜博|牙博士|美奥|维乐|摩尔齿科|摩尔口腔|大众口腔|常春藤|同步齿科|友睦|赛德|极简|圣洁|博爱|优伢|斑马|麦芽|正夫|穗华|广大口腔|暨大穗华/.test(
        n,
      )
    ) {
      return true;
    }
    return true;
  }

  return false;
}

/**
 * 名称命中任一则视为需清理的非目标机构（医美、体检、SPA 等）。
 * 口腔类：不在此列表一刀切；见 DENTAL_SMALL_CLINIC_SQL，只删「诊所/门诊部/无医院字样」且非公立/附属/省市县区口腔专科医院形态。
 * 体检：独立体检机构规则在 where 中单独 OR。
 */
const ANCILLARY_HOSPITAL_NAME_LIKE_PATTERNS = [
  '%医美%',
  '%美容%',
  '%整形%',
  '%SPA%',
  '%spa%',
  '%美发%',
  '%美甲%',
  '%纹绣%',
  '%足疗%',
  '%汗蒸%',
  '%宠物医院%',
  '%动物医院%',
  '%医学美容%',
  '%医疗美容%',
  '%整形美容%',
  '%体检中心%',
  '%健康体检%',
  '%健诊中心%',
  '%美年%',
  '%爱康%',
  '%瑞慈%',
  '%慈铭%',
  '%美兆%',
  '%月子中心%',
  '%月子会所%',
] as const;

/**
 * 仅删除「小诊所形态」牙科相关：命中口腔/牙科/齿科，且（诊所|门诊部|工作室|名称不含「医院」），
 * 且不满足公立/大学附属/省市县区口腔院等保留形态（均作用于 h.name，与简称无关以避免误删）。
 */
const DENTAL_SMALL_CLINIC_SQL = `
(
  (
    h.name LIKE '%口腔%' OR h.name LIKE '%牙科%' OR h.name LIKE '%齿科%'
  )
  AND NOT (
    h.name LIKE '%附属%' OR
    h.name LIKE '%大学%' OR
    h.name LIKE '%省口腔%' OR
    h.name LIKE '%市口腔医院%' OR
    h.name LIKE '%县口腔医院%' OR
    h.name LIKE '%区口腔医院%' OR
    (
      h.name LIKE '%人民%' AND h.name LIKE '%医院%' AND (
        h.name LIKE '%口腔%' OR h.name LIKE '%牙科%' OR h.name LIKE '%齿科%'
      )
    ) OR
    (
      h.name LIKE '%中心医院%' AND (
        h.name LIKE '%口腔%' OR h.name LIKE '%牙科%' OR h.name LIKE '%齿科%'
      )
    ) OR
    (
      (h.name LIKE '%第一医院%' OR h.name LIKE '%第一人民%') AND (
        h.name LIKE '%口腔%' OR h.name LIKE '%牙科%' OR h.name LIKE '%齿科%'
      )
    ) OR
    (
      (h.name LIKE '%第二医院%' OR h.name LIKE '%第二人民%') AND (
        h.name LIKE '%口腔%' OR h.name LIKE '%牙科%' OR h.name LIKE '%齿科%'
      )
    ) OR
    (
      (h.name LIKE '%第三医院%' OR h.name LIKE '%第三人民%') AND (
        h.name LIKE '%口腔%' OR h.name LIKE '%牙科%' OR h.name LIKE '%齿科%'
      )
    )
  )
  AND (
    h.name LIKE '%诊所%' OR
    h.name LIKE '%门诊部%' OR
    h.name LIKE '%工作室%' OR
    h.name NOT LIKE '%医院%'
  )
)
`;

/**
 * 小程序「找医院」名册：排除药店、眼镜店、小诊所形态、社区卫生站、医美体检连锁、民营口腔门诊等；
 * 牙科小形态与后台 purge 规则一致（DENTAL_SMALL_CLINIC_SQL）。
 */
/** 民营正脊、推拿复位等小诊所：与 `findHospitalExcludedNameSql` 中三条分支一致，仅按主名称 `name` 判断 */
function orthopedicSmallClinicWhereSql(): string {
  return `(
    (h.name LIKE '%正骨%' AND h.name NOT LIKE '%医院%') OR
    (h.name LIKE '%整脊%' AND h.name NOT LIKE '%医院%') OR
    (h.name LIKE '%推拿复位%' AND h.name NOT LIKE '%医院%')
  )`;
}

function findHospitalExcludedNameSql(alias: string): string {
  const a = alias;
  const dentalSql = DENTAL_SMALL_CLINIC_SQL.trim().replace(/\bh\./g, `${a}.`);
  return `(
    ${a}.name LIKE '%药店%' OR
    ${a}.name LIKE '%大药房%' OR
    ${a}.name LIKE '%医药连锁%' OR
    ${a}.name LIKE '%眼镜店%' OR
    ${a}.name LIKE '%眼镜超市%' OR
    ${a}.name LIKE '%眼镜商行%' OR
    ${a}.name LIKE '%眼镜批发%' OR
    ${a}.name LIKE '%眼镜城%' OR
    ${a}.name LIKE '%配镜店%' OR
    ${a}.name LIKE '%钟表眼镜%' OR
    ${a}.name LIKE '%隐形眼镜%' OR
    ${a}.name LIKE '%光学眼镜%' OR
    (${a}.name LIKE '%宝岛眼镜%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%博士眼镜%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%亮视点%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%配镜中心%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%视光中心%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%视力保健%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%视力康复中心%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%验光配镜%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%配眼镜%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%正骨%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%整脊%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%推拿复位%' AND ${a}.name NOT LIKE '%医院%') OR
    ${a}.name LIKE '%宠物医院%' OR
    ${a}.name LIKE '%动物医院%' OR
    (${a}.name LIKE '%诊所%' AND ${a}.name NOT LIKE '%医院%') OR
    (${a}.name LIKE '%门诊部%' AND ${a}.name NOT LIKE '%医院%') OR
    ${a}.name LIKE '%社区卫生服务中心%' OR
    ${a}.name LIKE '%社区卫生服务站%' OR
    ${a}.name LIKE '%社康中心%' OR
    ${a}.name LIKE '%社区健康服务中心%' OR
    ${a}.name LIKE '%村卫生室%' OR
    (${a}.name LIKE '%卫生室%' AND ${a}.name NOT LIKE '%医院%') OR
    ${a}.name LIKE '%医美%' OR
    ${a}.name LIKE '%医学美容%' OR
    ${a}.name LIKE '%医疗美容%' OR
    (${a}.name LIKE '%整形%' AND ${a}.name NOT LIKE '%医院%') OR
    ${a}.name LIKE '%体检中心%' OR
    ${a}.name LIKE '%健康体检%' OR
    ${a}.name LIKE '%美年%' OR
    ${a}.name LIKE '%爱康国宾%' OR
    ${a}.name LIKE '%瑞慈%' OR
    ${a}.name LIKE '%慈铭%' OR
    ${a}.name LIKE '%月子中心%' OR
    ${a}.name LIKE '%月子会所%' OR
    ${dentalSql}
  )`;
}

/** 必须有对外电话；名称非药房/眼镜店/小诊所等（用于 list / nearby / 地图 / 区域汇总 / 医生目录所涉医院） */
function applyFindHospitalDirectoryFilters(qb: SelectQueryBuilder<ObjectLiteral>, alias = 'h') {
  qb.andWhere(`${alias}.phone_main IS NOT NULL AND TRIM(${alias}.phone_main) <> ''`);
  qb.andWhere(`NOT (${findHospitalExcludedNameSql(alias)})`);
}

function hospitalHasMainPhone(phone: string | null | undefined): boolean {
  return !!(phone && String(phone).trim());
}

/** 重复合并时保留「更完整」的一条：有电话 > 有封面图 > sort_weight > id 更小 */
function hospitalKeeperScore(h: {
  id: number;
  phoneMain?: string | null;
  imageUrl?: string | null;
  sortWeight?: number | null;
}): number {
  let s = 0;
  if (hospitalHasMainPhone(h.phoneMain)) s += 10_000_000;
  if (h.imageUrl?.trim()) s += 1_000_000;
  s += Number(h.sortWeight ?? 0) * 100;
  return s * 10_000 - h.id;
}

/** 同城去重：去掉全角/半角括号注释与空白，便于识别「同名」重复 POI */
function normalizeHospitalDedupeKey(name: string): string {
  let s = (name || '').trim();
  s = s.replace(/（[^）]*）/g, '');
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\s+/g, '');
  return s;
}

const ADDRESS_DEDUPE_MIN_LEN = 8;

/** 同地址去重：规整后完全一致视为同一 POI（过短地址不参与，避免误合并） */
function normalizeHospitalAddressDedupeKey(
  address: string | null | undefined,
  city?: string | null,
  district?: string | null,
): string {
  let s = (address || '').trim();
  if (!s) return '';
  s = s.replace(/（[^）]*）/g, '');
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/[\s\u3000]+/g, '');
  for (const p of [district, city].filter(Boolean).map(String)) {
    const px = p.replace(/[\s\u3000]+/g, '');
    if (px && s.startsWith(px)) {
      s = s.slice(px.length);
      break;
    }
  }
  return s.trim();
}

function parseHospitalCoordinate(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function inferHospitalLevelFromName(name: string): string | null {
  const n = name || '';
  if (/三甲/.test(n)) return '三甲';
  if (/三乙/.test(n)) return '三乙';
  if (/三级甲等/.test(n)) return '三甲';
  if (/三级乙等/.test(n)) return '三乙';
  if (/二甲/.test(n)) return '二甲';
  if (/二乙/.test(n)) return '二乙';
  if (/三级(?!甲等|乙等)/.test(n)) return '三级';
  if (/二级(?!甲等|乙等)/.test(n)) return '二级';
  return null;
}

function seedRow(p: Partial<Hospital>): Partial<Hospital> {
  return {
    province: '浙江省',
    imageUrl: null,
    phonesExtra: null,
    latitude: null,
    longitude: null,
    source: '公开资料整理',
    remark: '院区、等级与电话请以医院官网及卫健公示为准',
    isActive: true,
    ...p,
  };
}

export type HospitalListQuery = {
  province?: string;
  city?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
};

export type DoctorDirectoryQuery = {
  province?: string;
  city?: string;
  hospitalId?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

/** 小程序：附近医院（球面距离，km） */
export type HospitalNearbyQuery = {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type HospitalMapMarkersQuery = {
  province?: string;
  city?: string;
  keyword?: string;
  /** 与 longitude 同时有效时，仅返回该点 radiusKm 范围内的标点 */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};

/** 丽水全市（含区县）+ 温州各县市区代表医院骨架；封面图请后台上传或填自有 CDN */
const LISHUI_WENZHOU_SEED: Partial<Hospital>[] = [
  seedRow({
    name: '丽水市中心医院',
    shortName: '丽水中心',
    city: '丽水市',
    district: '莲都区',
    address: '莲都区括苍路289号',
    phoneMain: '0578-2285777',
    phonesExtra: ['0578-2285888', '门诊'],
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['急诊医学科', '心血管内科', '多学科协作'],
    websiteUrl: 'http://www.lshospital.zj.cn',
    sortWeight: 100,
    remark: '等级与电话请以医院官网及卫健公示为准',
  }),
  seedRow({
    name: '丽水市人民医院',
    shortName: '丽水人民',
    city: '丽水市',
    district: '莲都区',
    address: '莲都区大众街15号（府前院区等请以官网为准）',
    phoneMain: '0578-2780030',
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['全科医学', '肿瘤诊疗中心'],
    sortWeight: 95,
    remark: '多院区，请以官方最新公告为准',
  }),
  seedRow({
    name: '丽水市中医院',
    shortName: '丽水中医院',
    city: '丽水市',
    district: '莲都区',
    address: '莲都区中山街800号附近（请以官网为准）',
    phoneMain: '0578-2289012',
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['中医内科', '骨伤科', '针灸推拿'],
    sortWeight: 88,
    remark: '地址电话请运营核对',
  }),
  seedRow({
    name: '丽水市第二人民医院',
    shortName: '丽水二院',
    city: '丽水市',
    district: '莲都区',
    address: '莲都区北苑路439号附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '三级',
    ownershipType: '政府办',
    keyDepartments: ['精神卫生', '综合门诊'],
    sortWeight: 72,
    remark: '具体服务范围与院区请以官网为准',
  }),
  seedRow({
    name: '龙泉市人民医院',
    shortName: '龙泉人民',
    city: '丽水市',
    district: '龙泉市',
    address: '龙泉市贤良路附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 42,
  }),
  seedRow({
    name: '青田县人民医院',
    shortName: '青田人民',
    city: '丽水市',
    district: '青田县',
    address: '青田县江南大道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 41,
  }),
  seedRow({
    name: '云和县人民医院',
    shortName: '云和人民',
    city: '丽水市',
    district: '云和县',
    address: '云和县城东路附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 40,
  }),
  seedRow({
    name: '庆元县人民医院',
    shortName: '庆元人民',
    city: '丽水市',
    district: '庆元县',
    address: '庆元县松源街道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 39,
  }),
  seedRow({
    name: '缙云县人民医院',
    shortName: '缙云人民',
    city: '丽水市',
    district: '缙云县',
    address: '缙云县紫微北路（请以官网为准）',
    phoneMain: '0578-3029091',
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 43,
  }),
  seedRow({
    name: '遂昌县人民医院',
    shortName: '遂昌人民',
    city: '丽水市',
    district: '遂昌县',
    address: '遂昌县妙高街道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 40,
  }),
  seedRow({
    name: '松阳县人民医院',
    shortName: '松阳人民',
    city: '丽水市',
    district: '松阳县',
    address: '松阳县西屏街道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 40,
  }),
  seedRow({
    name: '景宁畲族自治县人民医院',
    shortName: '景宁人民',
    city: '丽水市',
    district: '景宁畲族自治县',
    address: '景宁县红星街道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 38,
  }),
  seedRow({
    name: '温州医科大学附属第一医院（南白象院区）',
    shortName: '温医大附一新院',
    city: '温州市',
    district: '瓯海区',
    address: '瓯海区南白象街道上蔡村弘德路',
    phoneMain: '0577-55579999',
    phonesExtra: ['0577-55578037', '门诊'],
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['神经内科', '消化内科', '肝胆外科', '卒中中心'],
    websiteUrl: 'https://www.wzhospital.cn',
    sortWeight: 100,
    remark: '与公园路院区为同一法人不同院区',
  }),
  seedRow({
    name: '温州医科大学附属第一医院（公园路院区）',
    shortName: '温医大附一老院',
    city: '温州市',
    district: '鹿城区',
    address: '鹿城区府学巷2号',
    phoneMain: '0577-55579999',
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['门诊综合', '部分专科（详情请询医院）'],
    websiteUrl: 'https://www.wzhospital.cn',
    sortWeight: 99,
  }),
  seedRow({
    name: '温州医科大学附属第二医院、育英儿童医院（龙湾院区）',
    shortName: '温医大附二',
    city: '温州市',
    district: '龙湾区',
    address: '龙湾区温州大道东段（请以官网为准）',
    phoneMain: '0577-88002111',
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['儿童医学', '骨科', '妇产科'],
    sortWeight: 96,
    remark: '多院区，请核对院区与科室分布',
  }),
  seedRow({
    name: '温州市中心医院',
    shortName: '温州中心',
    city: '温州市',
    district: '鹿城区',
    address: '鹿城区大简巷32号（请以官网为准）',
    phoneMain: '0577-88070061',
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['综合急救', '卒中中心'],
    sortWeight: 90,
  }),
  seedRow({
    name: '温州市人民医院',
    shortName: '温州人民',
    city: '温州市',
    district: '鹿城区',
    address: '鹿城区仓后街57号等（多院区，请以官网为准）',
    phoneMain: '0577-88059181',
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['妇产科', '妇幼保健'],
    sortWeight: 85,
  }),
  seedRow({
    name: '温州市中医院',
    shortName: '温州中医院',
    city: '温州市',
    district: '鹿城区',
    address: '鹿城区信河街附近（多院区，请以官网为准）',
    phoneMain: null,
    hospitalLevel: '三甲',
    ownershipType: '政府办',
    keyDepartments: ['中医内科', '针灸推拿'],
    sortWeight: 82,
  }),
  seedRow({
    name: '温州市洞头区人民医院',
    shortName: '洞头人民',
    city: '温州市',
    district: '洞头区',
    address: '洞头区北岙街道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二级',
    ownershipType: '政府办',
    keyDepartments: ['区域综合'],
    sortWeight: 48,
  }),
  seedRow({
    name: '瑞安市人民医院',
    shortName: '瑞安人民',
    city: '温州市',
    district: '瑞安市',
    address: '瑞安市万松路附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '三乙',
    ownershipType: '政府办',
    keyDepartments: ['县域龙头综合'],
    sortWeight: 55,
  }),
  seedRow({
    name: '乐清市人民医院',
    shortName: '乐清人民',
    city: '温州市',
    district: '乐清市',
    address: '乐清市城南街道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '三乙',
    ownershipType: '政府办',
    keyDepartments: ['县域龙头综合'],
    sortWeight: 55,
  }),
  seedRow({
    name: '龙港市人民医院',
    shortName: '龙港人民',
    city: '温州市',
    district: '龙港市',
    address: '龙港市世纪大道附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二级',
    ownershipType: '政府办',
    keyDepartments: ['区域综合'],
    sortWeight: 50,
  }),
  seedRow({
    name: '永嘉县人民医院',
    shortName: '永嘉人民',
    city: '温州市',
    district: '永嘉县',
    address: '永嘉县上塘镇附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 44,
  }),
  seedRow({
    name: '平阳县人民医院',
    shortName: '平阳人民',
    city: '温州市',
    district: '平阳县',
    address: '平阳县昆阳镇附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 44,
  }),
  seedRow({
    name: '苍南县人民医院',
    shortName: '苍南人民',
    city: '温州市',
    district: '苍南县',
    address: '苍南县灵溪镇附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 44,
  }),
  seedRow({
    name: '文成县人民医院',
    shortName: '文成人民',
    city: '温州市',
    district: '文成县',
    address: '文成县大峃镇附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 42,
  }),
  seedRow({
    name: '泰顺县人民医院',
    shortName: '泰顺人民',
    city: '温州市',
    district: '泰顺县',
    address: '泰顺县罗阳镇附近（请以官网为准）',
    phoneMain: null,
    hospitalLevel: '二甲',
    ownershipType: '政府办',
    keyDepartments: ['县域综合救治'],
    sortWeight: 42,
  }),
];

const HANGZHOU_SHANGHAI_SEED = buildHangzhouShanghaiSeed(seedRow);
const PUBLIC_STOMATOLOGY_RESTORE_SEED = buildPublicStomatologyRestoreSeed(seedRow);

@Injectable()
export class HospitalService {
  private readonly logger = new Logger(HospitalService.name);

  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(HospitalDoctor)
    private readonly doctorRepo: Repository<HospitalDoctor>,
    private readonly amapPlaces: AmapPlacesService,
  ) {}

  private normalizePage(value: number | undefined, fallback = 1): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.floor(n);
  }

  private normalizePageSize(
    value: number | undefined,
    fallback: number,
    max: number,
  ): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(max, Math.max(1, Math.floor(n)));
  }

  /** 供首次部署引导：判断是否需要导入种子医院 */
  async countHospitals(): Promise<number> {
    return this.hospitalRepo.count();
  }

  async listForUser(query: HospitalListQuery) {
    const page = this.normalizePage(query.page, 1);
    const pageSize = this.normalizePageSize(query.pageSize, 20, 100);
    const qb = this.hospitalRepo
      .createQueryBuilder('h')
      .where('h.is_active = :active', { active: true });
    applyFindHospitalDirectoryFilters(qb, 'h');
    qb.orderBy('h.sort_weight', 'DESC').addOrderBy('h.id', 'ASC');

    if (query.province?.trim()) {
      qb.andWhere('h.province = :p', { p: query.province.trim() });
    }
    if (query.city?.trim()) {
      qb.andWhere('h.city = :c', { c: query.city.trim() });
    }
    if (query.keyword?.trim()) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere('(h.name LIKE :kw OR h.short_name LIKE :kw OR h.address LIKE :kw)', { kw });
    }

    const total = await qb.clone().getCount();
    const items = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { items, total, page, pageSize };
  }

  /** Haversine 公式（km），用于 MySQL 中排序与范围过滤；:ulat :ulng 由调用方 setParameter */
  private haversineKmExpr(tableAlias: string): string {
    return `(6371 * 2 * ASIN(SQRT(LEAST(1, GREATEST(0,
      POW(SIN((RADIANS(:ulat) - RADIANS(${tableAlias}.latitude)) / 2), 2) +
      COS(RADIANS(:ulat)) * COS(RADIANS(${tableAlias}.latitude)) *
      POW(SIN((RADIANS(:ulng) - RADIANS(${tableAlias}.longitude)) / 2), 2)
    )))))`;
  }

  private haversineKmJs(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, a))));
  }

  /**
   * 小程序：按用户经纬度检索周边医院（库内须有经纬度；无坐标医院不会出现在结果中）
   */
  async listNearbyForUser(query: HospitalNearbyQuery) {
    const lat = Number(query.latitude);
    const lng = Number(query.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('请提供有效经纬度');
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('经纬度超出范围');
    }

    const page = this.normalizePage(query.page, 1);
    const pageSize = this.normalizePageSize(query.pageSize, 20, 50);
    const radiusKm = Math.min(200, Math.max(3, query.radiusKm ?? 50));
    const dist = this.haversineKmExpr('h');

    const applyFilters = (qb: SelectQueryBuilder<Hospital>) => {
      qb.where('h.is_active = :active', { active: true });
      applyFindHospitalDirectoryFilters(qb as SelectQueryBuilder<ObjectLiteral>, 'h');
      qb.andWhere('h.latitude IS NOT NULL AND h.longitude IS NOT NULL');
      qb.andWhere(`${dist} <= :radiusKm`, { radiusKm });
      qb.setParameter('ulat', lat);
      qb.setParameter('ulng', lng);
      if (query.keyword?.trim()) {
        const kw = `%${query.keyword.trim()}%`;
        qb.andWhere('(h.name LIKE :kw OR h.short_name LIKE :kw OR h.address LIKE :kw)', { kw });
      }
    };

    const countQb = this.hospitalRepo.createQueryBuilder('h');
    applyFilters(countQb);
    const total = await countQb.getCount();

    const listQb = this.hospitalRepo.createQueryBuilder('h');
    applyFilters(listQb);
    listQb.orderBy(dist, 'ASC').skip((page - 1) * pageSize).take(pageSize);
    const rows = await listQb.getMany();

    const items = rows.map((h) => {
      const lat2 = parseFloat(String(h.latitude));
      const lng2 = parseFloat(String(h.longitude));
      const distanceKm =
        Number.isFinite(lat2) && Number.isFinite(lng2)
          ? Math.round(this.haversineKmJs(lat, lng, lat2, lng2) * 10) / 10
          : null;
      return Object.assign(h, { distanceKm });
    });

    return {
      items,
      total,
      page,
      pageSize,
      radiusKm,
      center: { latitude: lat, longitude: lng },
    };
  }

  /**
   * 小程序地图：带坐标的医院标点（轻量字段，最多 400 条）。
   * 传入 latitude + longitude 时按球面距离过滤（与附近列表规则一致），否则按省/市/关键词。
   */
  async listMapMarkersForUser(q: HospitalMapMarkersQuery) {
    const lat = q.latitude != null ? Number(q.latitude) : NaN;
    const lng = q.longitude != null ? Number(q.longitude) : NaN;
    const hasCenter =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    if (hasCenter) {
      const radiusKm = Math.min(200, Math.max(3, q.radiusKm != null && Number.isFinite(Number(q.radiusKm)) ? Number(q.radiusKm) : 50));
      const dist = this.haversineKmExpr('h');
      const qb = this.hospitalRepo
        .createQueryBuilder('h')
        .where('h.is_active = :a', { a: true });
      applyFindHospitalDirectoryFilters(qb as SelectQueryBuilder<ObjectLiteral>, 'h');
      qb.andWhere('h.latitude IS NOT NULL AND h.longitude IS NOT NULL')
        .andWhere(`${dist} <= :radiusKm`, { radiusKm })
        .setParameter('ulat', lat)
        .setParameter('ulng', lng);

      if (q.keyword?.trim()) {
        const kw = `%${q.keyword.trim()}%`;
        qb.andWhere('(h.name LIKE :kw OR h.short_name LIKE :kw OR h.address LIKE :kw)', { kw });
      }

      qb.orderBy(dist, 'ASC').addOrderBy('h.sort_weight', 'DESC').addOrderBy('h.id', 'ASC').take(400);
      const rows = await qb.getMany();

      return rows.map((h) => ({
        id: h.id,
        name: h.name,
        shortName: h.shortName,
        latitude: parseFloat(String(h.latitude)),
        longitude: parseFloat(String(h.longitude)),
        city: h.city,
        district: h.district,
        address: h.address,
      }));
    }

    const qb = this.hospitalRepo
      .createQueryBuilder('h')
      .where('h.is_active = :a', { a: true });
    applyFindHospitalDirectoryFilters(qb as SelectQueryBuilder<ObjectLiteral>, 'h');
    qb.andWhere('h.latitude IS NOT NULL AND h.longitude IS NOT NULL');

    if (q.province?.trim()) {
      qb.andWhere('h.province = :p', { p: q.province.trim() });
    }
    if (q.city?.trim()) {
      qb.andWhere('h.city = :c', { c: q.city.trim() });
    }
    if (q.keyword?.trim()) {
      const kw = `%${q.keyword.trim()}%`;
      qb.andWhere('(h.name LIKE :kw OR h.short_name LIKE :kw OR h.address LIKE :kw)', { kw });
    }

    qb.orderBy('h.sort_weight', 'DESC').addOrderBy('h.id', 'ASC').take(400);
    const rows = await qb.getMany();

    return rows.map((h) => ({
      id: h.id,
      name: h.name,
      shortName: h.shortName,
      latitude: parseFloat(String(h.latitude)),
      longitude: parseFloat(String(h.longitude)),
      city: h.city,
      district: h.district,
      address: h.address,
    }));
  }

  /**
   * 启用医院中出现的省、市去重列表（供小程序「找医院」动态生成筛选器）
   */
  async getActiveRegionFacets() {
    const facetQb = this.hospitalRepo
      .createQueryBuilder('h')
      .select('h.province', 'province')
      .addSelect('h.city', 'city')
      .where('h.is_active = :a', { a: true });
    applyFindHospitalDirectoryFilters(facetQb as SelectQueryBuilder<ObjectLiteral>, 'h');
    const raw = await facetQb
      .orderBy('h.province', 'ASC')
      .addOrderBy('h.city', 'ASC')
      .getRawMany();

    const provinceSet = new Set<string>();
    const citiesByProvince: Record<string, string[]> = {};
    for (const r of raw) {
      const p = String((r as { province?: string }).province || '').trim();
      const c = String((r as { city?: string }).city || '').trim();
      if (!p) continue;
      provinceSet.add(p);
      if (!c) continue;
      if (!citiesByProvince[p]) citiesByProvince[p] = [];
      if (!citiesByProvince[p].includes(c)) {
        citiesByProvince[p].push(c);
      }
    }

    const provincesSorted = [...provinceSet].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    /** 若库内存在浙江省，省列表置顶（找医院/医生筛选用同一接口） */
    const pinProvince = '浙江省';
    const provinces = provincesSorted.includes(pinProvince)
      ? [pinProvince, ...provincesSorted.filter((p) => p !== pinProvince)]
      : provincesSorted;
    for (const p of provinces) {
      const arr = citiesByProvince[p];
      if (arr?.length) {
        arr.sort((a, b) => a.localeCompare(b, 'zh-CN'));
      }
    }

    return { provinces, citiesByProvince };
  }

  async adminList(query: HospitalListQuery) {
    const page = this.normalizePage(query.page, 1);
    const pageSize = this.normalizePageSize(query.pageSize, 20, 100);
    const qb = this.hospitalRepo.createQueryBuilder('h').orderBy('h.city', 'ASC').addOrderBy('h.sort_weight', 'DESC');

    if (!query.includeInactive) {
      qb.andWhere('h.is_active = :a', { a: true });
    }
    if (query.province?.trim()) qb.andWhere('h.province = :p', { p: query.province.trim() });
    if (query.city?.trim()) qb.andWhere('h.city = :c', { c: query.city.trim() });
    if (query.keyword?.trim()) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere('(h.name LIKE :kw OR h.short_name LIKE :kw OR h.address LIKE :kw OR h.phone_main LIKE :kw)', {
        kw,
      });
    }

    const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    const ids = items.map((h) => h.id);
    const doctorStats = new Map<number, { active: number; total: number }>();
    if (ids.length) {
      const raw = await this.doctorRepo
        .createQueryBuilder('d')
        .select('d.hospital_id', 'hid')
        .addSelect('SUM(CASE WHEN d.is_active = 1 THEN 1 ELSE 0 END)', 'activeCnt')
        .addSelect('COUNT(*)', 'totalCnt')
        .where('d.hospital_id IN (:...ids)', { ids })
        .groupBy('d.hospital_id')
        .getRawMany();
      for (const r of raw as { hid: number; activeCnt: string; totalCnt: string }[]) {
        doctorStats.set(Number(r.hid), {
          active: Number(r.activeCnt) || 0,
          total: Number(r.totalCnt) || 0,
        });
      }
    }
    for (const h of items) {
      const s = doctorStats.get(h.id);
      const ext = h as Hospital & { activeDoctorCount: number; doctorCount: number };
      ext.activeDoctorCount = s?.active ?? 0;
      ext.doctorCount = s?.total ?? 0;
    }
    return { items, total, page, pageSize };
  }

  async adminCreate(dto: Partial<Hospital>) {
    const row = this.hospitalRepo.create(dto as Hospital);
    return this.hospitalRepo.save(row);
  }

  async adminUpdate(id: number, dto: Partial<Hospital>) {
    const row = await this.hospitalRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('医院不存在');
    Object.assign(row, dto);
    return this.hospitalRepo.save(row);
  }

  async adminDelete(id: number) {
    const row = await this.hospitalRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('医院不存在');
    await this.doctorRepo.delete({ hospitalId: id });
    await this.hospitalRepo.delete(id);
    return { ok: true };
  }

  /**
   * 按名称规则批量删除：医美/体检/SPA 等；口腔仅删小诊所形态（见 DENTAL_SMALL_CLINIC_SQL），保留附属/大学等公立口腔专科院命名。
   * 默认合并小程序「找医院」排除规则（眼镜店、无名医院字样的诊所等），并可按同城同名 / 同规整地址 / 同经纬度网格优先保留信息更全的重复 POI。
   */
  async adminPurgeAncillaryHospitals(dto: PurgeAncillaryHospitalsDto) {
    const dryRun = dto.dryRun === true;
    const previewLimit = Math.min(200, Math.max(1, dto.previewLimit ?? 30));
    const orthoOnly = dto.matchOrthopedicClinicsOnly === true;
    const includeDirectoryNoise = dto.includeDirectoryNoise !== false;
    const dedupePreferPhone = dto.dedupePreferPhone !== false;
    const dedupeSameAddress = dto.dedupeSameAddress !== false;
    const dedupeSameCoordinates = dto.dedupeSameCoordinates !== false;
    const removeAllWithoutMainPhone = dto.removeAllWithoutMainPhone === true;

    let whereSql: string;
    let params: Record<string, string>;

    if (orthoOnly) {
      params = {};
      whereSql = orthopedicSmallClinicWhereSql();
    } else {
      params = {
        exam: '%体检%',
        hosp: '%医院%',
      };
      const likeParts: string[] = [];
      ANCILLARY_HOSPITAL_NAME_LIKE_PATTERNS.forEach((pat, i) => {
        const kn = `n${i}`;
        const ks = `s${i}`;
        params[kn] = pat;
        params[ks] = pat;
        likeParts.push(
          `(h.name LIKE :${kn} OR (h.short_name IS NOT NULL AND h.short_name != '' AND h.short_name LIKE :${ks}))`,
        );
      });

      const nonDentalOrEmpty = likeParts.length
        ? `${likeParts.join(' OR ')}\n      OR `
        : '';
      const directoryClause = includeDirectoryNoise ? ` OR (${findHospitalExcludedNameSql('h')})` : '';
      whereSql = `(
      ${nonDentalOrEmpty}(h.name LIKE :exam AND h.name NOT LIKE :hosp)
      OR ${DENTAL_SMALL_CLINIC_SQL}
      ${directoryClause}
    )`;
    }

    const matches = await this.hospitalRepo
      .createQueryBuilder('h')
      .select(['h.id', 'h.name', 'h.city', 'h.district'])
      .where(whereSql, params)
      .orderBy('h.id', 'ASC')
      .getMany();

    const idSet = new Set(matches.map((r) => r.id));

    if (!orthoOnly) {
      const allForDedupe = await this.hospitalRepo.find({
        select: [
          'id',
          'name',
          'province',
          'city',
          'district',
          'address',
          'phoneMain',
          'sortWeight',
          'imageUrl',
          'latitude',
          'longitude',
        ],
        order: { id: 'ASC' },
      });
      if (dedupePreferPhone) {
        for (const id of this.collectDuplicatePreferPhoneHospitalIds(allForDedupe)) {
          idSet.add(id);
        }
      }
      if (dedupeSameAddress) {
        for (const id of this.collectDuplicateAddressHospitalIds(allForDedupe)) {
          idSet.add(id);
        }
      }
      if (dedupeSameCoordinates) {
        for (const id of this.collectDuplicateCoordinateHospitalIds(allForDedupe)) {
          idSet.add(id);
        }
      }

      if (removeAllWithoutMainPhone) {
        const noPhoneRows = await this.hospitalRepo
          .createQueryBuilder('h')
          .select(['h.id'])
          .where('(h.phone_main IS NULL OR TRIM(h.phone_main) = :empty)', { empty: '' })
          .getMany();
        for (const r of noPhoneRows) {
          idSet.add(Number(r.id));
        }
      }
    }

    const ids = [...idSet].sort((a, b) => a - b);
    const previewIds = ids.slice(0, previewLimit);
    const previewRows = previewIds.length
      ? await this.hospitalRepo.findBy({ id: In(previewIds) })
      : [];
    previewRows.sort((a, b) => a.id - b.id);
    const preview = previewRows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      district: r.district,
    }));

    if (!ids.length) {
      return {
        dryRun,
        matched: 0,
        deleted: 0,
        doctorsDeleted: 0,
        preview: [],
        message: '无匹配记录',
      };
    }

    if (dryRun) {
      return {
        dryRun: true,
        matched: ids.length,
        deleted: 0,
        doctorsDeleted: 0,
        preview,
        message: `dryRun：将删除 ${ids.length} 条机构及关联医生；请核对 preview 后传 dryRun=false 正式删除`,
      };
    }

    const CHUNK = 400;
    let doctorsDeleted = 0;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const docRes = await this.doctorRepo
        .createQueryBuilder()
        .delete()
        .from(HospitalDoctor)
        .where('hospital_id IN (:...slice)', { slice })
        .execute();
      doctorsDeleted += docRes.affected ?? 0;
      const hRes = await this.hospitalRepo
        .createQueryBuilder()
        .delete()
        .from(Hospital)
        .where('id IN (:...slice)', { slice })
        .execute();
      deleted += hRes.affected ?? 0;
    }

    return {
      dryRun: false,
      matched: ids.length,
      deleted,
      doctorsDeleted,
      preview,
      message: `已删除 ${deleted} 条机构，关联医生 ${doctorsDeleted} 条；请小程序/后台抽查名录`,
    };
  }

  /**
   * 硬删除「无封面图」医院（image_url 为空或仅空白）；同步删关联本院医生。
   */
  async adminPurgeHospitalsMissingImage(dto: PurgeMissingImageHospitalsDto) {
    const dryRun = dto.dryRun === true;
    const previewLimit = Math.min(200, Math.max(1, dto.previewLimit ?? 30));

    const matches = await this.hospitalRepo
      .createQueryBuilder('h')
      .select(['h.id', 'h.name', 'h.city', 'h.district'])
      .where('(h.image_url IS NULL OR TRIM(h.image_url) = :empty)', { empty: '' })
      .orderBy('h.id', 'ASC')
      .getMany();

    const ids = matches.map((r) => r.id);
    const preview = matches.slice(0, previewLimit).map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      district: r.district,
    }));

    if (!ids.length) {
      return {
        dryRun,
        matched: 0,
        deleted: 0,
        doctorsDeleted: 0,
        preview: [],
        message: '无缺少封面图的医院',
      };
    }

    if (dryRun) {
      return {
        dryRun: true,
        matched: ids.length,
        deleted: 0,
        doctorsDeleted: 0,
        preview,
        message: `dryRun：将删除 ${ids.length} 条无封面图机构及关联医生；确认后传 dryRun=false`,
      };
    }

    const CHUNK = 400;
    let doctorsDeleted = 0;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const docRes = await this.doctorRepo
        .createQueryBuilder()
        .delete()
        .from(HospitalDoctor)
        .where('hospital_id IN (:...slice)', { slice })
        .execute();
      doctorsDeleted += docRes.affected ?? 0;
      const hRes = await this.hospitalRepo
        .createQueryBuilder()
        .delete()
        .from(Hospital)
        .where('id IN (:...slice)', { slice })
        .execute();
      deleted += hRes.affected ?? 0;
    }

    return {
      dryRun: false,
      matched: ids.length,
      deleted,
      doctorsDeleted,
      preview,
      message: `已删除 ${deleted} 条无封面图机构，关联医生 ${doctorsDeleted} 条`,
    };
  }

  private collectDuplicatePreferPhoneHospitalIds(
    rows: Pick<
      Hospital,
      'id' | 'name' | 'province' | 'city' | 'phoneMain' | 'sortWeight' | 'imageUrl'
    >[],
  ): number[] {
    const byKey = new Map<
      string,
      Pick<
        Hospital,
        'id' | 'name' | 'province' | 'city' | 'phoneMain' | 'sortWeight' | 'imageUrl'
      >[]
    >();
    for (const h of rows) {
      const k = `${h.province}|${h.city}|${normalizeHospitalDedupeKey(h.name)}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(h);
    }
    const out: number[] = [];
    for (const list of byKey.values()) {
      if (list.length < 2) continue;
      const withPhone = list.filter((h) => hospitalHasMainPhone(h.phoneMain));
      const noPhone = list.filter((h) => !hospitalHasMainPhone(h.phoneMain));
      if (withPhone.length && noPhone.length) {
        out.push(...noPhone.map((h) => h.id));
        continue;
      }
      if (!withPhone.length && list.length > 1) {
        const sorted = [...list].sort((a, b) => hospitalKeeperScore(b) - hospitalKeeperScore(a));
        out.push(...sorted.slice(1).map((h) => h.id));
      }
    }
    return out;
  }

  /** 同一省市区划下、规整地址相同：保留 hospitalKeeperScore 最高的一条 */
  private collectDuplicateAddressHospitalIds(
    rows: Pick<
      Hospital,
      | 'id'
      | 'name'
      | 'province'
      | 'city'
      | 'district'
      | 'address'
      | 'phoneMain'
      | 'sortWeight'
      | 'imageUrl'
    >[],
  ): number[] {
    const byKey = new Map<string, Pick<Hospital, 'id' | 'phoneMain' | 'sortWeight' | 'imageUrl'>[]>();
    for (const h of rows) {
      const akey = normalizeHospitalAddressDedupeKey(h.address, h.city, h.district);
      if (!akey || akey.length < ADDRESS_DEDUPE_MIN_LEN) continue;
      const k = `${h.province}|${h.city}|${h.district ?? ''}|${akey}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push({
        id: h.id,
        phoneMain: h.phoneMain,
        sortWeight: h.sortWeight,
        imageUrl: h.imageUrl,
      });
    }
    const out: number[] = [];
    for (const list of byKey.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => hospitalKeeperScore(b) - hospitalKeeperScore(a));
      out.push(...sorted.slice(1).map((h) => h.id));
    }
    return out;
  }

  /**
   * 同一城市、经纬度取 4 位小数网格一致（约十余米级）：多为高德重复 POI，保留信息更全的一条。
   */
  private collectDuplicateCoordinateHospitalIds(
    rows: Pick<
      Hospital,
      'id' | 'city' | 'latitude' | 'longitude' | 'phoneMain' | 'sortWeight' | 'imageUrl'
    >[],
  ): number[] {
    const byKey = new Map<string, Pick<Hospital, 'id' | 'phoneMain' | 'sortWeight' | 'imageUrl'>[]>();
    for (const h of rows) {
      const lat = parseHospitalCoordinate(h.latitude);
      const lng = parseHospitalCoordinate(h.longitude);
      if (lat == null || lng == null) continue;
      const glat = Math.round(lat * 10_000) / 10_000;
      const glng = Math.round(lng * 10_000) / 10_000;
      const k = `${h.city}|${glat}|${glng}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push({
        id: h.id,
        phoneMain: h.phoneMain,
        sortWeight: h.sortWeight,
        imageUrl: h.imageUrl,
      });
    }
    const out: number[] = [];
    for (const list of byKey.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => hospitalKeeperScore(b) - hospitalKeeperScore(a));
      out.push(...sorted.slice(1).map((h) => h.id));
    }
    return out;
  }

  // ─── 本院医生（展示名录）────────────────────────────────

  private isDoctorDirectorySchemaUnavailable(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & {
        driverError?: { code?: string; message?: string; sqlMessage?: string };
      }
    ).driverError;
    const code = String(driverError?.code || '');
    const message = String(
      driverError?.sqlMessage || driverError?.message || error.message || '',
    );
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return true;
    return /hospital_doctors|unknown column|doesn't exist|no such table/i.test(message);
  }

  async listDoctorsForUser(hospitalId: number) {
    let h: Hospital | null;
    try {
      h = await this.hospitalRepo.findOne({ where: { id: hospitalId } });
    } catch (error) {
      if (this.isDoctorDirectorySchemaUnavailable(error)) {
        this.logger.warn(
          'hospital schema unavailable in listDoctorsForUser, fallback to empty list',
        );
        return [];
      }
      throw error;
    }
    if (!h || !h.isActive) throw new NotFoundException('医院不存在或已停用');
    let rows: HospitalDoctor[];
    try {
      rows = await this.doctorRepo.find({
        where: { hospitalId, isActive: true },
        order: { sortWeight: 'DESC', id: 'ASC' },
      });
    } catch (error) {
      if (this.isDoctorDirectorySchemaUnavailable(error)) {
        this.logger.warn(
          'hospital_doctors schema unavailable in listDoctorsForUser, fallback to empty list',
        );
        return [];
      }
      throw error;
    }
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      department: d.department,
      titleLevel: d.titleLevel,
      expertise: d.expertise,
      introduction: d.introduction,
      avatarUrl: d.avatarUrl,
    }));
  }

  /** 小程序：按 id 取单条启用医院（用于deeplink） */
  async getHospitalByIdForUser(id: number): Promise<Hospital> {
    const h = await this.hospitalRepo.findOne({ where: { id, isActive: true } });
    if (!h) throw new NotFoundException('医院不存在或已停用');
    return h;
  }

  /**
   * 小程序：跨医院检索本院医生，返回所属医院名称与城市（医生通过 hospitalId 关联医院）。
   * 注意：勿使用 getManyAndCount + join，部分 TypeORM/MySQL 组合会生成错误 COUNT SQL 导致 500。
   */
  async listDoctorDirectoryForUser(query: DoctorDirectoryQuery) {
    const page = this.normalizePage(query.page, 1);
    const pageSize = this.normalizePageSize(query.pageSize, 20, 50);

    const applyFilters = (qb: ReturnType<Repository<HospitalDoctor>['createQueryBuilder']>, loadH: boolean) => {
      if (loadH) {
        qb.innerJoinAndSelect('d.hospital', 'h');
      } else {
        qb.innerJoin('d.hospital', 'h');
      }
      qb.where('d.is_active = :da', { da: true }).andWhere('h.is_active = :ha', { ha: true });
      applyFindHospitalDirectoryFilters(qb as SelectQueryBuilder<ObjectLiteral>, 'h');
      if (query.province?.trim()) {
        qb.andWhere('h.province = :p', { p: query.province.trim() });
      }
      if (query.city?.trim()) {
        qb.andWhere('h.city = :c', { c: query.city.trim() });
      }
      if (query.hospitalId != null && Number.isFinite(query.hospitalId)) {
        qb.andWhere('d.hospital_id = :hid', { hid: query.hospitalId });
      }
      if (query.keyword?.trim()) {
        const kw = `%${query.keyword.trim()}%`;
        qb.andWhere(
          '(d.name LIKE :kw OR d.department LIKE :kw OR d.expertise LIKE :kw OR d.introduction LIKE :kw OR d.title_level LIKE :kw OR h.name LIKE :kw)',
          { kw },
        );
      }
    };

    let total = 0;
    try {
      total = await (() => {
        const qb = this.doctorRepo.createQueryBuilder('d');
        applyFilters(qb, false);
        return qb.getCount();
      })();
    } catch (error) {
      if (this.isDoctorDirectorySchemaUnavailable(error)) {
        this.logger.warn(
          'hospital_doctors schema unavailable in listDoctorDirectoryForUser (count), fallback to empty list',
        );
        return { items: [], total: 0, page, pageSize };
      }
      throw error;
    }

    const listQb = this.doctorRepo.createQueryBuilder('d');
    applyFilters(listQb, true);
    listQb.orderBy('d.sortWeight', 'DESC').addOrderBy('d.id', 'ASC');
    listQb.skip((page - 1) * pageSize).take(pageSize);
    let rows: HospitalDoctor[];
    try {
      rows = await listQb.getMany();
    } catch (error) {
      if (this.isDoctorDirectorySchemaUnavailable(error)) {
        this.logger.warn(
          'hospital_doctors schema unavailable in listDoctorDirectoryForUser (list), fallback to empty list',
        );
        return { items: [], total: 0, page, pageSize };
      }
      throw error;
    }

    const items = rows.map((d) => {
      const hosp = d.hospital;
      return {
        id: d.id,
        hospitalId: d.hospitalId,
        name: d.name,
        department: d.department,
        titleLevel: d.titleLevel,
        expertise: d.expertise,
        introduction: d.introduction,
        avatarUrl: d.avatarUrl,
        hospitalName: hosp?.name ?? '',
        hospitalCity: hosp?.city ?? '',
        hospitalDistrict: hosp?.district ?? null,
      };
    });

    return { items, total, page, pageSize };
  }

  /**
   * 供小程序 wx.openLocation：优先库内坐标；无则用高德地理编码（需配置 AMAP_WEB_KEY）
   */
  async getNavigationPointForUser(hospitalId: number) {
    const h = await this.hospitalRepo.findOne({ where: { id: hospitalId } });
    if (!h || !h.isActive) throw new NotFoundException('医院不存在或已停用');

    const addressLine =
      [h.city, h.district, h.address].filter(Boolean).join('') || (h.address || '');
    const fullAddress = [h.province, h.city, h.district, h.address].filter(Boolean).join('');

    let lat = h.latitude != null ? parseFloat(String(h.latitude)) : NaN;
    let lng = h.longitude != null ? parseFloat(String(h.longitude)) : NaN;
    let source: 'database' | 'geocode' = 'database';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (!this.amapPlaces.isConfigured()) {
        throw new BadRequestException('暂无地图坐标，请联系运营补全地址坐标或配置地图服务');
      }
      const geo = await this.amapPlaces.geocodeAddress({
        address: fullAddress || addressLine || h.name || '',
        city: h.city || '',
      });
      if (!geo) {
        throw new BadRequestException('无法根据地址解析位置，请稍后重试');
      }
      lat = geo.lat;
      lng = geo.lng;
      source = 'geocode';
    }

    return {
      latitude: lat,
      longitude: lng,
      name: h.name,
      address: addressLine || fullAddress,
      source,
    };
  }

  async adminListAllDoctors(query: {
    keyword?: string;
    hospitalId?: number;
    province?: string;
    city?: string;
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
  }) {
    const page = this.normalizePage(query.page, 1);
    const pageSize = this.normalizePageSize(query.pageSize, 20, 100);

    const applyFilters = (qb: ReturnType<Repository<HospitalDoctor>['createQueryBuilder']>, joinHospital: boolean) => {
      if (joinHospital) {
        qb.leftJoinAndSelect('d.hospital', 'h');
      } else {
        qb.leftJoin('d.hospital', 'h');
      }
      if (!query.includeInactive) {
        qb.where('d.is_active = :da', { da: true });
      }
      if (query.hospitalId != null && Number.isFinite(query.hospitalId)) {
        qb.andWhere('d.hospital_id = :hid', { hid: query.hospitalId });
      }
      if (query.province?.trim()) {
        qb.andWhere('h.province = :hp', { hp: query.province.trim() });
      }
      if (query.city?.trim()) {
        qb.andWhere('h.city = :hc', { hc: query.city.trim() });
      }
      if (query.keyword?.trim()) {
        const kw = `%${query.keyword.trim()}%`;
        qb.andWhere(
          '(d.name LIKE :kw OR d.department LIKE :kw OR d.title_level LIKE :kw OR d.expertise LIKE :kw OR d.introduction LIKE :kw OR h.name LIKE :kw)',
          { kw },
        );
      }
    };

    const countQb = this.doctorRepo.createQueryBuilder('d');
    applyFilters(countQb, false);
    const total = await countQb.getCount();

    const listQb = this.doctorRepo.createQueryBuilder('d');
    applyFilters(listQb, true);
    listQb.orderBy('d.sortWeight', 'DESC').addOrderBy('d.id', 'ASC');
    listQb.skip((page - 1) * pageSize).take(pageSize);
    const rows = await listQb.getMany();

    const items = rows.map((d) => ({
      id: d.id,
      hospitalId: d.hospitalId,
      name: d.name,
      department: d.department,
      titleLevel: d.titleLevel,
      expertise: d.expertise,
      introduction: d.introduction,
      avatarUrl: d.avatarUrl,
      sortWeight: d.sortWeight,
      isActive: d.isActive,
      source: d.source,
      hospitalName: (d.hospital as any)?.name ?? '',
      hospitalCity: (d.hospital as any)?.city ?? '',
    }));

    return { items, total, page, pageSize };
  }

  async adminListDoctors(hospitalId: number, includeInactive?: boolean) {
    await this.ensureHospitalExists(hospitalId);
    const qb = this.doctorRepo
      .createQueryBuilder('d')
      .where('d.hospital_id = :hid', { hid: hospitalId })
      .orderBy('d.sortWeight', 'DESC')
      .addOrderBy('d.id', 'ASC');
    if (!includeInactive) {
      qb.andWhere('d.is_active = :a', { a: true });
    }
    return qb.getMany();
  }

  private async ensureHospitalExists(hospitalId: number) {
    const ok = await this.hospitalRepo.exist({ where: { id: hospitalId } });
    if (!ok) throw new NotFoundException('医院不存在');
  }

  async adminCreateDoctor(dto: CreateHospitalDoctorDto) {
    await this.ensureHospitalExists(dto.hospitalId);
    const row = this.doctorRepo.create({
      hospitalId: dto.hospitalId,
      name: dto.name.trim(),
      department: dto.department?.trim() || null,
      titleLevel: dto.titleLevel?.trim() || null,
      expertise: dto.expertise?.trim() || null,
      introduction: dto.introduction?.trim() || null,
      avatarUrl: dto.avatarUrl?.trim() || null,
      sortWeight: dto.sortWeight ?? 0,
      isActive: dto.isActive !== false,
      source: '后台维护',
    });
    return this.doctorRepo.save(row);
  }

  async adminUpdateDoctor(id: number, dto: UpdateHospitalDoctorDto) {
    const row = await this.doctorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('医生记录不存在');
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.department !== undefined) row.department = dto.department?.trim() || null;
    if (dto.titleLevel !== undefined) row.titleLevel = dto.titleLevel?.trim() || null;
    if (dto.expertise !== undefined) row.expertise = dto.expertise?.trim() || null;
    if (dto.introduction !== undefined) row.introduction = dto.introduction?.trim() || null;
    if (dto.avatarUrl !== undefined) row.avatarUrl = dto.avatarUrl?.trim() || null;
    if (dto.sortWeight !== undefined) row.sortWeight = dto.sortWeight;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.doctorRepo.save(row);
  }

  async adminDeleteDoctor(id: number) {
    const res = await this.doctorRepo.delete(id);
    if (!res.affected) throw new NotFoundException('医生记录不存在');
    return { ok: true };
  }

  async adminBatchDoctors(dto: BatchHospitalDoctorsDto) {
    await this.ensureHospitalExists(dto.hospitalId);
    if (!Array.isArray(dto.items) || !dto.items.length) {
      throw new BadRequestException('items 不能为空');
    }
    if (dto.replace) {
      await this.doctorRepo.delete({ hospitalId: dto.hospitalId });
    }
    const entities = dto.items.map((it, idx) =>
      this.doctorRepo.create({
        hospitalId: dto.hospitalId,
        name: (it.name || '').trim(),
        department: it.department?.trim() || null,
        titleLevel: it.titleLevel?.trim() || null,
        expertise: it.expertise?.trim() || null,
        introduction: (it as any).introduction?.trim() || null,
        avatarUrl: (it as any).avatarUrl?.trim() || null,
        sortWeight: it.sortWeight ?? (dto.items.length - idx),
        isActive: it.isActive !== false,
        source: '批量导入',
      }),
    );
    const valid = entities.filter((e) => e.name.length > 0);
    if (!valid.length) throw new BadRequestException('没有有效的姓名');
    await this.doctorRepo.save(valid);
    return { inserted: valid.length, replaced: !!dto.replace };
  }

  /** 名称 + 地级市 + 区县 与种子去重；区县为空则只按 name+city 且 district IS NULL */
  private async seedKeyExists(name: string, city: string, district: string | null | undefined): Promise<boolean> {
    const qb = this.hospitalRepo
      .createQueryBuilder('h')
      .where('h.name = :name', { name })
      .andWhere('h.city = :city', { city });
    if (district == null || district === '') {
      qb.andWhere('h.district IS NULL');
    } else {
      qb.andWhere('h.district = :d', { d: district });
    }
    return qb.getExists();
  }

  /** 仅当表为空时写入丽水+温州种子数据，避免重复导入 */
  async seedLishuiWenzhouIfEmpty() {
    const n = await this.hospitalRepo.count();
    if (n > 0) {
      return { inserted: 0, skipped: true, message: '已有数据，未执行种子导入' };
    }
    const entities = LISHUI_WENZHOU_SEED.map((raw) =>
      this.hospitalRepo.create(raw as Partial<Hospital>),
    );
    await this.hospitalRepo.save(entities);
    return {
      inserted: entities.length,
      skipped: false,
      message: `已导入丽水全市县与温州各县市区共 ${entities.length} 条骨架数据，封面图与电话请后台核对`,
    };
  }

  /** 在已有数据时补齐种子名册中尚不存在的医院（按名称+市+区县） */
  async seedLishuiWenzhouAppend() {
    let inserted = 0;
    let skipped = 0;
    for (const raw of LISHUI_WENZHOU_SEED) {
      const name = raw.name as string;
      const city = raw.city as string;
      const district = raw.district ?? null;
      if (await this.seedKeyExists(name, city, district)) {
        skipped++;
        continue;
      }
      await this.hospitalRepo.save(this.hospitalRepo.create(raw as Partial<Hospital>));
      inserted++;
    }
    return {
      inserted,
      skipped,
      message: `本次新增 ${inserted} 条，已存在跳过 ${skipped} 条（按名称+市+区县）`,
    };
  }

  /** 补全杭州全市县 + 上海市代表医院骨架（按名称+市+区县去重） */
  async seedHangzhouShanghaiAppend() {
    let inserted = 0;
    let skipped = 0;
    for (const raw of HANGZHOU_SHANGHAI_SEED) {
      const name = raw.name as string;
      const city = raw.city as string;
      const district = raw.district ?? null;
      if (await this.seedKeyExists(name, city, district)) {
        skipped++;
        continue;
      }
      await this.hospitalRepo.save(this.hospitalRepo.create(raw as Partial<Hospital>));
      inserted++;
    }
    return {
      inserted,
      skipped,
      message: `杭州+上海骨架：新增 ${inserted} 条，跳过已存在 ${skipped} 条；请再执行「高德补全」写入电话与图片`,
    };
  }

  async seedZy91Doctors() {
    const { ZY91_DOCTORS } = await import('./seeds/zy91-doctors.seed.js');
    const hospital = await this.hospitalRepo.findOne({
      where: { name: '浙江大学医学院附属第一医院（庆春院区）' },
    }) ?? await this.hospitalRepo.findOne({
      where: { shortName: '浙大一院' },
    });
    if (!hospital) {
      return { inserted: 0, message: '未找到浙大一院，请先导入医院骨架数据' };
    }

    let inserted = 0;
    let skipped = 0;
    for (const doc of ZY91_DOCTORS) {
      const exists = await this.doctorRepo.findOne({
        where: { hospitalId: hospital.id, name: doc.name, department: doc.department },
      });
      if (exists) {
        skipped++;
        continue;
      }
      await this.doctorRepo.save(
        this.doctorRepo.create({
          hospitalId: hospital.id,
          name: doc.name,
          department: doc.department,
          titleLevel: doc.titleLevel,
          expertise: doc.expertise || null,
          introduction: (doc as any).introduction || null,
          avatarUrl: doc.avatarUrl || null,
          sortWeight: ZY91_DOCTORS.length - (inserted + skipped),
          isActive: true,
          source: '官网采集',
        }),
      );
      inserted++;
    }
    return {
      inserted,
      skipped,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      message: `浙大一院医生：新增 ${inserted} 条，跳过已存在 ${skipped} 条`,
    };
  }

  /**
   * 恢复误删的公立/大学附属口腔专科及各市口腔医院骨架；默认逐条高德匹配补全地址电话（需 AMAP_WEB_KEY）。
   */
  async adminRestorePublicStomatology(dto: RestorePublicStomatologyDto) {
    const dryRun = dto.dryRun === true;
    const useAmap = dto.useAmap !== false;

    let inserted = 0;
    let skipped = 0;
    let amapMatched = 0;
    const previewNames: string[] = [];

    for (const raw of PUBLIC_STOMATOLOGY_RESTORE_SEED) {
      const name = raw.name as string;
      const city = raw.city as string;
      const district = raw.district ?? null;
      if (await this.seedKeyExists(name, city, district)) {
        skipped++;
        continue;
      }
      if (dryRun) {
        inserted++;
        if (previewNames.length < 24) previewNames.push(name);
        continue;
      }

      const base = this.hospitalRepo.create({ ...raw } as Partial<Hospital>);
      if (useAmap && this.amapPlaces.isConfigured()) {
        try {
          const poi = await this.amapPlaces.resolveHospitalPoi({
            name,
            city,
            shortName: raw.shortName as string | null | undefined,
            district,
          });
          if (poi) {
            amapMatched++;
            if (poi.phoneMain) base.phoneMain = poi.phoneMain;
            if (poi.phonesExtra?.length) base.phonesExtra = poi.phonesExtra;
            if (poi.imageUrl) base.imageUrl = poi.imageUrl;
            if (poi.address) base.address = poi.address;
            if (poi.latitude && poi.longitude) {
              base.latitude = poi.latitude;
              base.longitude = poi.longitude;
            }
            if (poi.websiteUrl) base.websiteUrl = poi.websiteUrl;
            const tag = '恢复录入时参考高德 POI';
            const src = base.source || '';
            base.source = src.includes('高德') ? src : src ? `${src}；${tag}` : tag;
          }
        } catch {
          /* 单条高德失败仍保留骨架 */
        }
        await delay(380);
      }

      await this.hospitalRepo.save(base);
      inserted++;
    }

    return {
      inserted,
      skipped,
      amapMatched,
      dryRun,
      previewNames,
      message: dryRun
        ? `dryRun：将恢复 ${inserted} 条公立口腔专科，已存在跳过 ${skipped} 条；传 dryRun=false 执行`
        : `已恢复 ${inserted} 条，高德匹配写入字段 ${amapMatched} 条，跳过已存在 ${skipped} 条`,
    };
  }

  /**
   * 按浙江省地级市批量检索高德「综合医院 / 专科医院」POI 并入库（名称+市+区县去重）。
   * 导入时会过滤社区卫生站/诊所形态及非公营口腔专科。
   */
  async adminImportZhejiangFromAmap(dto: ImportZhejiangAmapDto) {
    if (!this.amapPlaces.isConfigured()) {
      throw new BadRequestException(
        '未配置环境变量 AMAP_WEB_KEY。请在高德开放平台申请 Web 服务 Key 并写入后端 .env。',
      );
    }

    const delayMs = Math.min(5000, Math.max(200, dto.delayMs ?? 450));
    const dryRun = !!dto.dryRun;
    const typesDefault = dto.types?.trim() || '090100|090200';

    const allowed = new Set<string>([...ZHEJIANG_PREFECTURE_CITIES]);
    let cities: string[];
    if (dto.cities?.length) {
      cities = [...new Set(dto.cities.map((c) => c.trim()).filter((c) => allowed.has(c)))];
      if (!cities.length) {
        throw new BadRequestException(
          `cities 须为浙江省地级市全名之一：${[...ZHEJIANG_PREFECTURE_CITIES].join('、')}`,
        );
      }
    } else {
      cities = [...ZHEJIANG_PREFECTURE_CITIES];
    }

    return this.importMedicalFacilitiesFromAmap({
      province: '浙江省',
      cities,
      delayMs,
      dryRun,
      typesDefault,
      sourceLabel: '高德地图 POI（浙江省批量检索）',
    });
  }

  /**
   * 北京市或广东省：按地级市批量检索高德「综合医院+专科医院」POI 入库。
   * 排除：社区卫生站/村卫生室等、名称无「医院」的诊所/门诊部；口腔/牙科/齿科仅保留公立/附属/人民等形态，民营连锁口腔不入库。
   */
  async adminImportRegionFromAmap(dto: ImportRegionAmapDto) {
    if (!this.amapPlaces.isConfigured()) {
      throw new BadRequestException(
        '未配置环境变量 AMAP_WEB_KEY。请在高德开放平台申请 Web 服务 Key 并写入后端 .env。',
      );
    }

    const delayMs = Math.min(5000, Math.max(200, dto.delayMs ?? 450));
    const dryRun = !!dto.dryRun;
    const typesDefault = dto.types?.trim() || '090100|090200';

    const allowed =
      dto.province === '北京市'
        ? new Set<string>([...BEIJING_AMAP_CITIES])
        : new Set<string>([...GUANGDONG_PREFECTURE_CITIES]);

    let cities: string[];
    if (dto.cities?.length) {
      cities = [...new Set(dto.cities.map((c) => c.trim()).filter((c) => allowed.has(c)))];
      if (!cities.length) {
        throw new BadRequestException(
          dto.province === '北京市'
            ? `cities 须包含「北京市」`
            : `cities 须为广东省地级市全名之一（如广州市、深圳市…共 ${GUANGDONG_PREFECTURE_CITIES.length} 个）`,
        );
      }
    } else {
      cities = [...allowed];
    }

    return this.importMedicalFacilitiesFromAmap({
      province: dto.province,
      cities,
      delayMs,
      dryRun,
      typesDefault,
      sourceLabel: `高德地图 POI（${dto.province}批量检索）`,
    });
  }

  private async importMedicalFacilitiesFromAmap(args: {
    province: string;
    cities: string[];
    delayMs: number;
    dryRun: boolean;
    typesDefault: string;
    sourceLabel: string;
  }) {
    const { province, cities, delayMs, dryRun, typesDefault, sourceLabel } = args;

    let inserted = 0;
    let skippedDup = 0;
    let skippedFilter = 0;
    let apiPages = 0;

    for (const city of cities) {
      let strategy: 'types' | 'keyword' = 'types';
      let page = 1;
      let exhausted = false;

      while (!exhausted && page <= 100) {
        const useTypes = strategy === 'types';
        const batch = await this.amapPlaces.searchMedicalFacilitiesPage({
          city,
          page,
          offset: 25,
          types: useTypes ? typesDefault : '',
          keywords: useTypes ? '' : '医院',
        });
        apiPages++;

        if (
          page === 1 &&
          strategy === 'types' &&
          batch.total === 0 &&
          batch.pois.length === 0 &&
          !batch.infocode
        ) {
          strategy = 'keyword';
          page = 1;
          await delay(delayMs);
          continue;
        }

        if (page === 1 && strategy === 'keyword' && batch.total === 0 && batch.pois.length === 0) {
          exhausted = true;
          break;
        }

        if (!batch.pois.length) {
          exhausted = true;
          break;
        }

        for (const raw of batch.pois) {
          const parsed = this.amapPlaces.parsePoi(raw);
          if (!parsed) {
            skippedFilter++;
            continue;
          }
          if (shouldSkipImportedPoiName(parsed.matchedName)) {
            skippedFilter++;
            continue;
          }
          if (shouldSkipClinicOrPrivateDentalPoi(parsed.matchedName)) {
            skippedFilter++;
            continue;
          }

          const adname = String(raw.adname ?? '').trim();
          const district = adname || null;
          if (await this.seedKeyExists(parsed.matchedName, city, district)) {
            skippedDup++;
            continue;
          }

          const address =
            (parsed.address && parsed.address.trim()) ||
            `${city}${district ?? ''}${parsed.matchedName}`.slice(0, 500);

          const row = this.hospitalRepo.create({
            province,
            city,
            district,
            name: parsed.matchedName,
            shortName: null,
            address,
            phoneMain: parsed.phoneMain,
            phonesExtra: parsed.phonesExtra,
            imageUrl: parsed.imageUrl,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            websiteUrl: parsed.websiteUrl,
            hospitalLevel: inferHospitalLevelFromName(parsed.matchedName),
            ownershipType: null,
            keyDepartments: null,
            sortWeight: 0,
            isActive: true,
            source: sourceLabel,
            remark: '名录来自高德开放数据；等级、院区与电话请以医院及卫健部门官方为准',
          } satisfies Partial<Hospital>);

          if (!dryRun) {
            await this.hospitalRepo.save(row);
          }
          inserted++;
        }

        const offset = 25;
        if (page * offset >= batch.total || batch.pois.length < offset) {
          exhausted = true;
        } else {
          page++;
        }

        await delay(delayMs);
      }

      await delay(delayMs);
    }

    return {
      province,
      cities,
      inserted,
      skippedDup,
      skippedFilter,
      apiPages,
      dryRun,
      message: dryRun
        ? `dryRun：${province} 估算可新增 ${inserted} 条（未写库），重复 ${skippedDup}，过滤 ${skippedFilter}，高德请求页 ${apiPages}`
        : `「${province}」已写入 ${inserted} 条，跳过已存在 ${skippedDup}，过滤/无效 ${skippedFilter}，高德请求页 ${apiPages}。可按需再调用 enrich-amap 补全字段`,
    };
  }

  /**
   * 调用高德开放平台官方 API 补全字段；需在服务端配置 AMAP_WEB_KEY（Web 服务类型），并自行合规使用。
   */
  async adminEnrichFromAmap(dto: EnrichHospitalsAmapDto) {
    if (!this.amapPlaces.isConfigured()) {
      throw new BadRequestException(
        '未配置环境变量 AMAP_WEB_KEY。请在高德开放平台申请 Web 服务 Key 并写入后端 .env（建议绑定服务器 IP）。',
      );
    }

    if (dto.scanAllMissingImages) {
      if ((dto.ids?.length ?? 0) > 0 || (dto.cities?.length ?? 0) > 0) {
        throw new BadRequestException('scanAllMissingImages 时不要传 ids 或 cities');
      }
      return this.adminEnrichScanAllMissingImages(dto);
    }

    const delayMs = Math.min(3000, Math.max(100, dto.delayMs ?? 400));
    const fillEmptyOnly = dto.fillEmptyOnly !== false;
    const overwrite = !!dto.overwrite;
    const imagesOnly = dto.imagesOnly === true;

    const defaultBatch = dto.cities?.length ? 200 : 15;
    const batchLimit = Math.min(200, Math.max(1, dto.limit ?? defaultBatch));

    let rows: Hospital[];
    if (dto.ids?.length) {
      const ids = [...new Set(dto.ids)].slice(0, 200);
      rows = await this.hospitalRepo.findBy({ id: In(ids) });
    } else if (dto.cities?.length) {
      const cityList = [...new Set(dto.cities.map((c) => c.trim()).filter(Boolean))];
      const qb = this.hospitalRepo
        .createQueryBuilder('h')
        .where('h.city IN (:...cities)', { cities: cityList })
        .orderBy('h.id', 'ASC');
      if (dto.afterId != null && dto.afterId > 0) {
        qb.andWhere('h.id > :afterId', { afterId: dto.afterId });
      }
      rows = await qb.take(batchLimit).getMany();
    } else {
      rows = await this.hospitalRepo.find({
        order: { id: 'ASC' },
        take: batchLimit,
      });
    }

    const details: Array<{
      id: number;
      status: string;
      matchedName?: string;
      reason?: string;
      message?: string;
    }> = [];

    for (const row of rows) {
      const needPhone = !imagesOnly && (overwrite || !row.phoneMain?.trim());
      const needImage = overwrite || !row.imageUrl?.trim();
      const needAddr = !imagesOnly && (overwrite || !row.address?.trim());
      const needCoords = !imagesOnly && (overwrite || !row.latitude || !row.longitude);
      const needWebsite = !imagesOnly && (overwrite || !row.websiteUrl?.trim());

      if (fillEmptyOnly) {
        if (imagesOnly) {
          if (!needImage) {
            details.push({ id: row.id, status: 'skipped', reason: '已有封面图' });
            await delay(delayMs);
            continue;
          }
        } else if (!needPhone && !needImage && !needAddr && !needCoords && !needWebsite) {
          details.push({ id: row.id, status: 'skipped', reason: '已有所需字段' });
          await delay(delayMs);
          continue;
        }
      }

      try {
        const poi = await this.amapPlaces.resolveHospitalPoi({
          name: row.name,
          city: row.city,
          shortName: row.shortName,
          district: row.district,
        });

        if (!poi) {
          details.push({ id: row.id, status: 'not_found', reason: '高德无匹配 POI' });
          await delay(delayMs);
          continue;
        }

        const patch: Partial<Hospital> = {};

        if (needPhone && poi.phoneMain) {
          patch.phoneMain = poi.phoneMain;
          if (poi.phonesExtra?.length) {
            patch.phonesExtra = poi.phonesExtra;
          }
        }

        if (needImage && poi.imageUrl) {
          patch.imageUrl = poi.imageUrl;
        }

        if (needAddr && poi.address) {
          patch.address = poi.address;
        }

        if (needCoords && poi.latitude && poi.longitude) {
          patch.latitude = poi.latitude;
          patch.longitude = poi.longitude;
        }

        if (needWebsite && poi.websiteUrl) {
          patch.websiteUrl = poi.websiteUrl;
        }

        const filledData =
          (needPhone && !!patch.phoneMain) ||
          (needImage && !!patch.imageUrl) ||
          (needAddr && !!patch.address) ||
          (needCoords && !!patch.latitude && !!patch.longitude) ||
          (needWebsite && !!patch.websiteUrl);

        if (!filledData) {
          details.push({
            id: row.id,
            status: 'no_applicable_field',
            matchedName: poi.matchedName,
            reason: '无可用字段写入（或 POI 无电话/图片/地址等）',
          });
        } else {
          const tag = '部分字段参考高德地图 POI，请与医院官方核对';
          const src = row.source || '';
          patch.source = src.includes('高德') ? src : src ? `${src}；${tag}` : tag;
          Object.assign(row, patch);
          await this.hospitalRepo.save(row);
          details.push({ id: row.id, status: 'ok', matchedName: poi.matchedName });
        }
      } catch (e) {
        details.push({
          id: row.id,
          status: 'error',
          message: (e as Error).message,
        });
      }

      await delay(delayMs);
    }

    const ok = details.filter((d) => d.status === 'ok').length;
    const lastIdInBatch = rows.length ? rows[rows.length - 1].id : 0;
    return {
      processed: rows.length,
      updated: ok,
      lastIdInBatch,
      details,
      message: `处理 ${rows.length} 条，成功写入 ${ok} 条；按城市批跑可传 afterId=${lastIdInBatch} 继续下一批`,
    };
  }

  /**
   * 分批拉取「无主图」医院，仅调高德写 image_url（内部复用 adminEnrichFromAmap）。
   */
  private async adminEnrichScanAllMissingImages(dto: EnrichHospitalsAmapDto) {
    const delayMs = Math.min(3000, Math.max(100, dto.delayMs ?? 400));
    const maxBatches = Math.min(2000, Math.max(1, dto.scanMaxBatches ?? 300));
    const batchLimit = Math.min(100, Math.max(1, dto.limit ?? 50));
    let afterId = dto.afterId != null && dto.afterId > 0 ? dto.afterId : 0;
    let batches = 0;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let lastId = afterId;

    while (batches < maxBatches) {
      const rows = await this.hospitalRepo
        .createQueryBuilder('h')
        .where('h.id > :afterId', { afterId })
        .andWhere('(h.image_url IS NULL OR TRIM(h.image_url) = :empty)', { empty: '' })
        .orderBy('h.id', 'ASC')
        .take(batchLimit)
        .getMany();
      if (!rows.length) break;

      const batchRes = await this.adminEnrichFromAmap({
        ids: rows.map((r) => r.id),
        scanAllMissingImages: false,
        imagesOnly: true,
        limit: batchLimit,
        delayMs,
        fillEmptyOnly: dto.fillEmptyOnly !== false,
        overwrite: !!dto.overwrite,
      });
      if ('scanAllMissingImages' in batchRes) {
        throw new BadRequestException('批量补图内部调用异常');
      }
      totalProcessed += batchRes.processed;
      totalUpdated += batchRes.updated;
      lastId = rows[rows.length - 1].id;
      afterId = lastId;
      batches++;
      if (rows.length < batchLimit) break;
    }

    return {
      scanAllMissingImages: true,
      batches,
      totalProcessed,
      totalUpdated,
      lastAfterId: lastId,
      message: `扫库补图：${batches} 批，处理 ${totalProcessed} 条，成功写入封面 ${totalUpdated} 条；若仍有缺图可传 afterId=${lastId} 增大 scanMaxBatches 继续`,
    };
  }
}
