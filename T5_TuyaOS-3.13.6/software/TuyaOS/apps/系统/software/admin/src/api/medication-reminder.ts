import { get, post, put, del } from './request'

export function getReminders(params?: Record<string, any>) {
  return get('/medication-reminders', params)
}

export function getReminder(id: number | string) {
  return get(`/medication-reminders/${id}`)
}

export function createReminder(data: Record<string, any>) {
  return post('/medication-reminders', data)
}

export function updateReminder(id: number | string, data: Record<string, any>) {
  return put(`/medication-reminders/${id}`, data)
}

export function deleteReminder(id: number | string) {
  return del(`/medication-reminders/${id}`)
}

export function getRemindersByOrder(orderId: number | string, params?: Record<string, any>) {
  return get(`/medication-reminders/order/${orderId}`, params)
}

export function getReminderAudits(id: number | string) {
  return get(`/medication-reminders/${id}/audits`)
}

// ─── 处方批次 ────────────────────────────────────────────
export function createPrescription(data: Record<string, any>) {
  return post('/medication-prescriptions', data)
}

export function getPrescriptions(params?: Record<string, any>) {
  return get('/medication-prescriptions', params)
}

export function getPrescription(id: number | string) {
  return get(`/medication-prescriptions/${id}`)
}

export function approvePrescription(id: number | string, data?: Record<string, any>) {
  return post(`/medication-prescriptions/${id}/approve`, data || {})
}

export function rejectPrescription(id: number | string, reason: string) {
  return post(`/medication-prescriptions/${id}/reject`, { reason })
}

// ─── 药品字典 ────────────────────────────────────────────
export function searchMedicineCatalog(keyword: string, limit = 20) {
  return get('/medicine-catalog/search', { q: keyword, limit })
}

export function getMedicineCatalog(params?: Record<string, any>) {
  return get('/medicine-catalog', params)
}

export function createMedicine(data: Record<string, any>) {
  return post('/medicine-catalog', data)
}

export function updateMedicine(id: number | string, data: Record<string, any>) {
  return put(`/medicine-catalog/${id}`, data)
}

export function deleteMedicine(id: number | string) {
  return del(`/medicine-catalog/${id}`)
}

// ─── 用药打卡 ────────────────────────────────────────────
export function getExecutions(params: Record<string, any>) {
  return get('/medication-executions', params)
}

export function checkInMedication(data: Record<string, any>) {
  return post('/medication-executions/check-in', data)
}

export function getAdherence(userId: number | string, windowDays = 7) {
  return get(`/medication-executions/adherence/${userId}`, { windowDays })
}

// ─── 推送任务队列 ────────────────────────────────────────
export function getNotificationJobs(params?: Record<string, any>) {
  return get('/medication-notification-jobs', params)
}

export function retryNotificationJob(id: number | string) {
  return post(`/medication-notification-jobs/${id}/retry`)
}

export function dispatchFamilyDigestNow() {
  return post('/medication-notification-jobs/digest/dispatch-now')
}

export function getNotificationStats(windowHours = 24) {
  return get('/medication-notification-jobs/stats', { windowHours })
}
