import { get, post, put, del } from './request'

export type ProfessionalServiceCategory =
  | 'nutrition'
  | 'rehabilitation'
  | 'nursing'
  | 'psychology'
  | 'maternal_child'

export interface ProfessionalServiceSopStep {
  title: string
  description: string
  durationMin?: number
  checklistItems?: string[]
}

export interface ProfessionalServiceItem {
  id: number
  category: ProfessionalServiceCategory
  code: string
  name: string
  shortDesc: string
  detail: string | null
  icon: string
  coverImage: string | null
  targetGroups: string[]
  highlights: string[]
  durationHint: string | null
  priceDisplayText: string | null
  sopSteps: ProfessionalServiceSopStep[]
  enabled: boolean
  sortOrder: number
  source: 'builtin' | 'custom'
  createdAt: string
  updatedAt: string
}

export function listProfessionalServices(params?: Record<string, any>) {
  return get<{
    items: ProfessionalServiceItem[]
    total: number
    page: number
    pageSize: number
  }>('/professional-services', params)
}

export function getProfessionalService(id: number | string) {
  return get<ProfessionalServiceItem>(`/professional-services/${id}`)
}

export function createProfessionalService(data: Partial<ProfessionalServiceItem>) {
  return post<ProfessionalServiceItem>('/professional-services', data)
}

export function updateProfessionalService(
  id: number | string,
  data: Partial<ProfessionalServiceItem>,
) {
  return put<ProfessionalServiceItem>(`/professional-services/${id}`, data)
}

export function toggleProfessionalService(id: number | string) {
  return post<ProfessionalServiceItem>(`/professional-services/${id}/toggle`)
}

export function deleteProfessionalService(id: number | string) {
  return del(`/professional-services/${id}`)
}
