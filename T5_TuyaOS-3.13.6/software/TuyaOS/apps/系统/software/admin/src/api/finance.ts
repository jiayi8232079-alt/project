import { get, put } from './request'

export function getFinanceRecords(params: any) {
  return get('/finance', params)
}

export function approveFinanceRecord(id: number, reviewNote?: string) {
  return put(`/finance/${id}/approve`, { reviewNote })
}

export function rejectFinanceRecord(id: number, reviewNote: string) {
  return put(`/finance/${id}/reject`, { reviewNote })
}

export function getFinanceReport(params?: { startDate?: string; endDate?: string }) {
  return get('/finance/report', params)
}
