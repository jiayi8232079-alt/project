import { get, post, put } from './request'

export function listAlerts(params?: Record<string, any>) {
  return get('/alerts', params)
}

export function getAlert(id: number | string) {
  return get(`/alerts/${id}`)
}

export function acknowledgeAlert(id: number | string, note?: string) {
  return post(`/alerts/${id}/acknowledge`, { note })
}

export function closeAlert(id: number | string, note?: string) {
  return post(`/alerts/${id}/close`, { note })
}

export function listAlertRules() {
  return get('/alerts/rules')
}

export function updateAlertRule(id: number | string, data: Record<string, any>) {
  return put(`/alerts/rules/${id}`, data)
}

export function scanMedicationMiss() {
  return post('/alerts/admin/scan/medication-miss')
}

export function scanFollowUpOverdue() {
  return post('/alerts/admin/scan/follow-up-overdue')
}

export function assignAlert(
  id: number | string,
  data: { assigneeId: number; note?: string },
) {
  return post(`/alerts/${id}/assign`, data)
}

export function listAlertLogs(id: number | string) {
  return get(`/alerts/${id}/logs`)
}

export function appendAlertLog(id: number | string, note: string) {
  return post(`/alerts/${id}/logs`, { note })
}

export function listAssignableStaff() {
  return get('/alerts/admin/assignable-staff')
}
