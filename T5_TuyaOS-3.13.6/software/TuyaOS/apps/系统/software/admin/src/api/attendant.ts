import { get, post, put, del } from './request'

export function getAttendantList(params: any) {
  return get('/attendants', params)
}

export function getAttendantDetail(id: number | string) {
  return get(`/attendants/${id}`)
}

export function getAvailableUsersForAttendant(params: any) {
  return get('/attendants/list/available-users', params)
}

export function createAttendant(data: { realName?: string; employeeId?: string; phone?: string; openid?: string; userId?: number }) {
  return post('/attendants', data)
}

export function updateAttendant(id: number, data: any) {
  return put(`/attendants/${id}`, data)
}

export function toggleAttendantStatus(id: number | string, status: 'active' | 'disabled') {
  return put(`/attendants/${id}/status`, { status })
}

export function deleteAttendant(id: number | string) {
  return del(`/attendants/${id}`)
}

export function getTrashedAttendants(params?: { keyword?: string; page?: number; pageSize?: number }) {
  return get('/attendants/trash/list', params)
}

export function restoreAttendant(id: number | string) {
  return put(`/attendants/trash/${id}/restore`, {})
}

export function hardDeleteAttendant(id: number | string) {
  return del(`/attendants/trash/${id}/hard`)
}

export function getAvailableAttendants(params: { date: string; period: string }) {
  return get('/attendants/available', params)
}

export function getScheduleList(params: { startDate: string; endDate: string }) {
  return get('/attendants/schedules/all', params)
}

export function getAttendantSchedules(id: number | string, params?: { startDate?: string; endDate?: string }) {
  return get(`/attendants/${id}/schedules`, params)
}

export function submitAttendantSchedules(
  id: number | string,
  data: { schedules: { date: string; period: string }[]; startDate?: string; endDate?: string },
) {
  return post(`/attendants/${id}/schedules`, data)
}

export function setAttendantCredentials(id: number | string, data: { username?: string; password?: string }) {
  return put(`/attendants/${id}/credentials`, data)
}

// ─── 多角色 / 专业资料 ───

export type ServiceStaffRole =
  | 'attendant'
  | 'nutritionist'
  | 'rehabilitator'
  | 'nurse'
  | 'caregiver'
  | 'maternal_care'
  | 'psychologist'

export interface StaffCertification {
  name: string
  number?: string
  issuedAt?: string
  expiry?: string | null
  imageUrl?: string
}

export interface ServiceStaffRoleConfig {
  role: ServiceStaffRole
  label: string
  defaultTitle: string
  icon: string
  themeColor: string
  themeColorDark: string
  tagline: string
  quickLinks: Array<{
    key: string
    label: string
    icon: string
    tone: 'primary' | 'success' | 'warning' | 'info'
  }>
  statsLabels: {
    todayTasks: string
    weekCompleted: string
    monthIncome: string
    rating: string
  }
  matchCategories: string[]
  serviceScope: string
}

export function listServiceStaffRoleConfigs() {
  return get<ServiceStaffRoleConfig[]>('/attendants/role-configs')
}

export function updateAttendantProfessionalProfile(
  id: number | string,
  data: {
    primaryRole?: ServiceStaffRole
    professionalRoles?: ServiceStaffRole[]
    specialties?: string[]
    certifications?: StaffCertification[]
    title?: string | null
    experienceYears?: number
  },
) {
  return put(`/attendants/${id}/professional-profile`, data)
}
