import { get, put } from './request'

export function getConsultations(params?: Record<string, any>) {
  return get('/consultations', params)
}

export function getConsultationsByDate(date: string) {
  return get('/consultations/by-date', { date })
}

export function getConsultationDateSummary(startDate: string, endDate: string) {
  return get('/consultations/date-summary', { startDate, endDate })
}

export function updateConsultationStatus(id: number, status: string) {
  return put(`/consultations/${id}/status`, { status })
}
