import { get, post, put } from './request'

/** 召回记忆（recall）。不传 memberId 时不返回个人私密记忆。 */
export function recallMemories(params: Record<string, unknown>) {
  return get('/companion/memories', params)
}

/** 保存一条记忆（save，支持 memoryKey 去重更新） */
export function saveMemory(data: Record<string, unknown>) {
  return post('/companion/memories', data)
}

/** 纠正一条记忆内容（correct） */
export function correctMemory(id: number, content: string) {
  return post(`/companion/memories/${id}/correct`, { content })
}

/** 确认一条记忆为可信（confirm） */
export function confirmMemory(id: number) {
  return post(`/companion/memories/${id}/confirm`)
}

/** 遗忘（软删除）一条记忆（forget） */
export function forgetMemory(id: number) {
  return post(`/companion/memories/${id}/forget`)
}

/** 获取家庭机器人人格（get_persona） */
export function getPersona(familyId: number) {
  return get(`/companion/persona/${familyId}`)
}

/** 创建或更新家庭机器人人格（upsert_persona） */
export function upsertPersona(data: Record<string, unknown>) {
  return put('/companion/persona', data)
}
