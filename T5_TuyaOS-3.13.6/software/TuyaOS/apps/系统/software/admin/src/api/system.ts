import { get, post, put, del } from './request'

export function getAllConfigs() {
  return get('/system/configs')
}

export function getConfig(key: string) {
  return get(`/system/configs/${key}`)
}

export function setConfig(key: string, value: string, description?: string) {
  return put(`/system/configs/${key}`, { value, description })
}

export function batchSetConfigs(configs: { key: string; value: string; description?: string }[]) {
  return put('/system/configs', configs)
}

export function deleteConfig(key: string) {
  return del(`/system/configs/${key}`)
}

export function testStorageConnection() {
  return post('/system/storage/test')
}

/**
 * 获取用药提醒剂量字典 + 兜底文案（公开接口，不需登录）
 * 返回：{ options: string[], fallback: string, maxLength: number }
 */
export function getMedicationDosageDictionary() {
  return get('/system/config/public/medication-dosage-dictionary') as Promise<{
    options: string[]
    fallback: string
    maxLength: number
  }>
}

export function testWechatWebhook(webhook: string, content?: string) {
  return post('/system/wechat/webhook/test', { webhook, content })
}

export function getAdminList() {
  return get('/system/admins')
}

export function createAdmin(data: { username: string; password: string; realName?: string; role?: string; phone?: string }) {
  return post('/system/admins', data)
}

export function updateAdminInfo(id: number, data: { realName?: string; role?: string; phone?: string; status?: boolean }) {
  return put(`/system/admins/${id}/info`, data)
}

export function resetAdminPassword(id: number, newPassword: string) {
  return put(`/system/admins/${id}/password`, { newPassword })
}

export function changeMyPassword(oldPassword: string, newPassword: string) {
  return put('/system/admins/change-password', { oldPassword, newPassword })
}

export function getAttendantAccounts() {
  return get('/system/attendants')
}

export function resetAttendantPassword(id: number, newPassword: string) {
  return put(`/system/attendants/${id}/password`, { newPassword })
}

export function setAttendantUsername(id: number, username: string) {
  return put(`/system/attendants/${id}/username`, { username })
}

