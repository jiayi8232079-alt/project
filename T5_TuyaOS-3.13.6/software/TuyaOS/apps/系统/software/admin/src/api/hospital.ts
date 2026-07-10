import { get, post, patch, del } from './request'

export function listHospitals(params?: {
  province?: string
  city?: string
  keyword?: string
  page?: number
  pageSize?: number
  includeInactive?: boolean
}) {
  return get('/hospitals/admin/list', params)
}

/** 与小程序一致：名录涉及的省、市（启用医院） */
export function getHospitalRegions() {
  return get('/hospitals/regions')
}

export function createHospital(data: Record<string, unknown>) {
  return post('/hospitals/admin', data)
}

export function updateHospital(id: number, data: Record<string, unknown>) {
  return patch(`/hospitals/admin/${id}`, data)
}

export function deleteHospital(id: number) {
  return del(`/hospitals/admin/${id}`)
}

export function seedLishuiWenzhouHospitals() {
  return post('/hospitals/admin/seed-lishui-wenzhou', {})
}

/** 按名称+市+区县去重，仅插入尚不存在的丽水/温州骨架医院 */
export function appendLishuiWenzhouHospitals() {
  return post('/hospitals/admin/seed-lishui-wenzhou-append', {})
}

export function appendHangzhouShanghaiHospitals() {
  return post('/hospitals/admin/seed-hangzhou-shanghai-append', {})
}

/** 高德 Web 服务补全电话/图片等；需后端配置 AMAP_WEB_KEY */
export function enrichHospitalsFromAmap(data: {
  ids?: number[]
  cities?: string[]
  afterId?: number
  limit?: number
  fillEmptyOnly?: boolean
  overwrite?: boolean
  delayMs?: number
}) {
  return post('/hospitals/admin/enrich-amap', data)
}

/** 高德按市检索综合/专科医院 POI，批量写入浙江省（去重）；仅管理员，耗时长 */
export function importZhejiangHospitalsFromAmap(data?: {
  cities?: string[]
  delayMs?: number
  dryRun?: boolean
  types?: string
}) {
  return post('/hospitals/admin/import-zhejiang-amap', data ?? {})
}

/** 按规则删除口腔/医美/体检/SPA 等机构；先 dryRun */
export function purgeAncillaryHospitals(data: { dryRun: boolean; previewLimit?: number }) {
  return post('/hospitals/admin/purge-ancillary', data)
}

/** 删除无封面图（image_url 为空）的医院及关联本院医生；先 dryRun */
export function purgeHospitalsMissingImage(data: { dryRun: boolean; previewLimit?: number }) {
  return post('/hospitals/admin/purge-missing-image', data)
}

/** 恢复误删的公立口腔专科骨架；默认高德逐条补全 */
export function restorePublicStomatology(data?: { dryRun?: boolean; useAmap?: boolean }) {
  return post('/hospitals/admin/restore-public-stomatology', data ?? {})
}

// ─── 全局医生管理 ─────────────────────────────────

export function listAllDoctors(params?: {
  keyword?: string
  hospitalId?: number
  province?: string
  city?: string
  page?: number
  pageSize?: number
  includeInactive?: boolean
}) {
  return get('/hospitals/admin/all-doctors', params)
}

// ─── 本院医生 ─────────────────────────────────────

export function listHospitalDoctors(hospitalId: number, includeInactive?: boolean) {
  return get('/hospitals/admin/doctors', {
    hospitalId,
    includeInactive: includeInactive ? 'true' : undefined,
  })
}

export function createHospitalDoctor(data: Record<string, unknown>) {
  return post('/hospitals/admin/doctors', data)
}

export function updateHospitalDoctor(id: number, data: Record<string, unknown>) {
  return patch(`/hospitals/admin/doctors/${id}`, data)
}

export function deleteHospitalDoctor(id: number) {
  return del(`/hospitals/admin/doctors/${id}`)
}

export function batchHospitalDoctors(data: {
  hospitalId: number
  replace?: boolean
  items: Array<{
    name: string
    department?: string
    titleLevel?: string
    expertise?: string
    introduction?: string
    sortWeight?: number
    isActive?: boolean
  }>
}) {
  return post('/hospitals/admin/doctors/batch', data)
}
