import { get, patch } from './request'

export type ComplaintStatus =
  | 'pending'
  | 'processing'
  | 'resolved'
  | 'rejected'
  | 'closed'
export type ComplaintCategory =
  | 'service'
  | 'attendant'
  | 'dispatch'
  | 'payment'
  | 'report'
  | 'other'
export type ComplaintPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface ComplaintTimelineItem {
  at: string
  byType: 'user' | 'admin' | 'system'
  byId?: number | null
  byName?: string | null
  content: string
  type?: 'reply' | 'status' | 'note' | 'attach'
}

export interface ComplaintItem {
  id: number
  userId: number
  orderId: number | null
  attendantId: number | null
  category: ComplaintCategory
  subject: string
  description: string
  images: string[] | null
  contactPhone: string | null
  priority: ComplaintPriority
  status: ComplaintStatus
  handlerId: number | null
  resolution: string | null
  internalNote: string | null
  userRating: number | null
  timeline: ComplaintTimelineItem[] | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  user?: {
    id: number
    nickname?: string | null
    phone?: string | null
  } | null
  order?: {
    id: number
    orderNumber?: string
    status?: string
  } | null
  attendant?: {
    id: number
    realName?: string | null
  } | null
  handler?: {
    id: number
    username?: string
    realName?: string
  } | null
}

export interface ComplaintListResult {
  items: ComplaintItem[]
  total: number
  page: number
  pageSize: number
}

export interface ListComplaintParams {
  page?: number
  pageSize?: number
  status?: ComplaintStatus | ''
  category?: ComplaintCategory | ''
  priority?: ComplaintPriority | ''
  userId?: number | string
  orderId?: number | string
  handlerId?: number | string
  keyword?: string
}

export interface UpdateComplaintPayload {
  status?: ComplaintStatus
  priority?: ComplaintPriority
  handlerId?: number | null
  resolution?: string
  internalNote?: string
  reply?: string
}

export function listComplaintsApi(params: ListComplaintParams) {
  return get<ComplaintListResult>('/complaints', params)
}

export function getComplaintApi(id: number) {
  return get<ComplaintItem>(`/complaints/${id}`)
}

export function getComplaintStatsApi() {
  return get<{
    pending: number
    processing: number
    resolved: number
    rejected: number
    closed: number
  }>('/complaints/stats/overview')
}

export function updateComplaintApi(id: number, payload: UpdateComplaintPayload) {
  return patch<ComplaintItem>(`/complaints/${id}`, payload)
}
