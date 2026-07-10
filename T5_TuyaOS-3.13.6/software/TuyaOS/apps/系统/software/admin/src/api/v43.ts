import { get, post, put } from './request'

export function listAlerts(params?: Record<string, unknown>) {
  return get('/alerts', params)
}

export function ackAlert(id: number, note?: string) {
  return post(`/alerts/${id}/ack`, { note })
}

export function falseAlarmAlert(id: number, note?: string) {
  return post(`/alerts/${id}/false-alarm`, { note })
}

export function escalateAlert(id: number, target: string, note?: string) {
  return post(`/emergency-dispatch/${id}/escalate`, { target, note })
}

export function mockAlert(data: Record<string, unknown>) {
  return post('/alerts/mock-event', data)
}

export function getDeviceSettings(deviceId: number) {
  return get(`/device-settings/${deviceId}`)
}

export function saveDeviceSettings(deviceId: number, data: Record<string, unknown>) {
  return put(`/device-settings/${deviceId}`, data)
}

export function mockDeviceSettingsAck(deviceId: number, logId: number, success = true, failureReason?: string) {
  return post(`/device-settings/${deviceId}/logs/${logId}/mock-ack`, { success, failureReason })
}

export function listCommunityContent(params?: Record<string, unknown>) {
  return get('/community-content', params)
}

export function createCommunityContent(data: Record<string, unknown>) {
  return post('/community-content', data)
}

export function publishCommunityContent(id: number) {
  return post(`/community-content/${id}/publish`)
}

export function revokeCommunityContent(id: number) {
  return post(`/community-content/${id}/revoke`)
}

export function listContentDeliveries(contentId?: number) {
  return get('/content-deliveries', contentId ? { contentId } : undefined)
}

export function mockContentDeliveryAck(id: number, status: string, failureReason?: string) {
  return post(`/content-deliveries/${id}/mock-ack`, { status, failureReason })
}

export function createFamilyMessage(data: Record<string, unknown>) {
  return post('/family/family-messages', data)
}

export function createFamilyTask(data: Record<string, unknown>) {
  return post('/family/tasks', data)
}

export function listFamilyTasks(familyId: number) {
  return get('/family/tasks', { familyId })
}

export function mockFamilyTaskReceipt(id: number, status: string, elderResponse?: string) {
  return post(`/family/tasks/${id}/mock-receipt`, { status, elderResponse })
}

export function createVoiceprint(data: Record<string, unknown>) {
  return post('/voiceprints', data)
}

export function listVoiceprints(familyId: number) {
  return get(`/voiceprints/family/${familyId}`)
}

export function updateVoiceprintStatus(id: number, status: string, confidence?: number) {
  return post(`/voiceprints/${id}/status`, { status, confidence })
}

export function listServiceProviders() {
  return get('/service-providers')
}

export function createServiceProvider(data: Record<string, unknown>) {
  return post('/service-providers', data)
}

export function listHospitalPartnerships() {
  return get('/hospital-partnerships')
}

export function createHospitalPartnership(data: Record<string, unknown>) {
  return post('/hospital-partnerships', data)
}
