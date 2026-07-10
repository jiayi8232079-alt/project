import { get, post, del } from './request'

// 导诊记录列表
export function getTriageList(params?: {
  page?: number
  pageSize?: number
  riskLevel?: string
  status?: string
  escalateToHuman?: boolean
}) {
  return get('/triage/admin/list', params)
}

// 导诊详情（含反馈）
export function getTriageDetail(id: number) {
  return get(`/triage/admin/detail/${id}`)
}

// 导诊统计
export function getTriageStats() {
  return get('/triage/admin/stats')
}

/** 转人工会话留言 */
export function getTriageSessionMessages(sessionId: number) {
  return get(`/triage/admin/sessions/${sessionId}/messages`)
}

export function postTriageSessionMessage(sessionId: number, content: string) {
  return post(`/triage/admin/sessions/${sessionId}/messages`, { content })
}

/** 删除导诊记录（含留言与反馈） */
export function deleteTriageSession(id: number) {
  return del(`/triage/admin/sessions/${id}`)
}
