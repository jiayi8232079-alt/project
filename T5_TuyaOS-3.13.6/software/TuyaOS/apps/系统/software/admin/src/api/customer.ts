import { get, post, put, del } from './request'

/**
 * 管理端「客户列表」：默认返回全部系统用户（含小程序用户、客服、陪诊员、管理员等）。
 * 若需要只看小程序普通用户，在 params 里显式传 customerOnly: true。
 */
export function getCustomerList(params: any = {}) {
  return get('/users', params)
}

/** 仅小程序端客户（role=user），含列表接口附加的 OpenID / 家庭摘要等字段 */
export function getMiniProgramCustomerList(params: any = {}) {
  return get('/users', { customerOnly: true, ...params })
}

/** 管理端：分页服务对象目录（每行一条健康档案，含所属账号微信/家庭） */
export function getServiceTargetDirectoryList(params: any = {}) {
  return get('/users/service-targets', params)
}

export function getCustomerDetail(id: number) {
  return get(`/users/${id}`)
}

export function getServiceTargets(userId: number) {
  return get(`/users/${userId}/service-targets`)
}

export function getCustomerDocuments(userId: number) {
  return get(`/documents/customer/${userId}`)
}

export function createServiceTarget(userId: number, data: any) {
  return post(`/users/${userId}/service-targets`, data)
}

export function getCustomerOrders(userId: number) {
  return get('/orders', { userId })
}

export function updateCustomer(id: number, data: any) {
  return put(`/users/${id}`, data)
}

export function updateUserRole(id: number, role: string) {
  return put(`/users/${id}/role`, { role })
}

export function deleteCustomer(id: number) {
  return del(`/users/${id}`)
}

export function getDeletedCustomers(params?: any) {
  return get('/users/trash', params)
}

export function restoreCustomer(id: number) {
  return post(`/users/${id}/restore`, {})
}

export function permanentDeleteCustomer(id: number) {
  return del(`/users/${id}/permanent`)
}
