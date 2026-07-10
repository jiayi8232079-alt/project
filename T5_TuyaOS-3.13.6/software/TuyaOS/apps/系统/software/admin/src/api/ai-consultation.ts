import { get, del } from './request'

export function getAiStats() {
  return get('/ai-consultation/admin/stats')
}

export function getAiSessions(params?: { page?: number; pageSize?: number }) {
  return get('/ai-consultation/admin/sessions', params)
}

export function getAiSessionDetail(sessionId: string) {
  return get(`/ai-consultation/admin/sessions/${sessionId}`)
}

export function getAiByUser(params?: { page?: number; pageSize?: number }) {
  return get('/ai-consultation/admin/by-user', params)
}

export function getAiUserMessages(userId: number, params?: { page?: number; pageSize?: number }) {
  return get(`/ai-consultation/admin/users/${userId}/messages`, params)
}

export function searchAiMessages(params?: { page?: number; pageSize?: number; userId?: number; keyword?: string }) {
  return get('/ai-consultation/admin/messages', params)
}

/** 删除某客户指定会话的全部问诊消息 */
export function deleteAdminUserSession(userId: number, sessionId: string) {
  return del(`/ai-consultation/admin/users/${userId}/sessions/${encodeURIComponent(sessionId)}`)
}
