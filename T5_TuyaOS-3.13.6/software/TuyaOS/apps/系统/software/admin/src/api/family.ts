import { get, post } from './request'

export function getFamilyGroups(params?: { page?: number; pageSize?: number }) {
  return get('/family/admin/groups', params)
}

export function adminBindFamily(data: { guardianUserId: number; memberUserId: number; relation: string; familyName: string }) {
  return post('/family/admin/bind', data)
}

export function getFamilyMembers(groupId: number) {
  return get(`/family/admin/groups/${groupId}/members`)
}

/** 按客户（user）查询其所在的全部家庭及成员（含 serviceTarget 摘要） */
export function getFamiliesByUser(userId: number | string) {
  return get(`/family/admin/by-user/${userId}`)
}

export function getMemberHealth(userId: number) {
  return get(`/family/member/${userId}/health`)
}

export function getMemberMedications(userId: number) {
  return get(`/family/member/${userId}/medications`)
}

export function getMemberOrders(userId: number, params?: { status?: string; page?: number; pageSize?: number }) {
  return get(`/family/member/${userId}/orders`, params)
}

export function getServiceTargets(userId: number) {
  return get('/users/service-targets', { userId })
}

export function getServiceTargetDetail(targetId: number) {
  return get(`/users/service-targets/${targetId}`)
}

/** 服务对象历史就诊记录（来自已完成订单） */
export function getServiceTargetHistory(targetId: number | string) {
  return get(`/users/service-targets/${targetId}/history`)
}

export function getWeeklyReportsForUser(userId: number, params?: { pageSize?: number }) {
  return get('/ai-consultation/weekly-reports', { userId, ...params })
}

/** 给家庭分配专属客服 */
export function assignFamilyCs(familyId: number, adminId: number | null) {
  return post(`/family/admin/groups/${familyId}/assign-cs`, { adminId })
}

/** 一键把全部健康档案（服务对象）回填到对应家庭的成员（仅管理员）。
 *  新规则下会把"本人档案"挂到 guardian 成员，其他关系作为独立家庭成员。幂等。 */
export function backfillFamilyMembers() {
  return post('/family/admin/backfill', {})
}

/** 后台生成某家庭的邀请小程序码（不限 guardian 身份，客服可直接获取分享给客户） */
export function getFamilyInviteQrcode(familyId: number) {
  return get(`/family/admin/groups/${familyId}/invite-qrcode`)
}
