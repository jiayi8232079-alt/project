import { get } from './request'

export interface AuditLogItem {
  id: number
  actorType: string
  actorId: number | null
  actorName: string | null
  actorRole: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  method: string | null
  path: string | null
  ip: string | null
  userAgent: string | null
  statusCode: number | null
  requestSummary: string | null
  durationMs: number | null
  remark: string | null
  createdAt: string
}

export interface AuditLogListParams {
  page?: number
  pageSize?: number
  actorType?: string
  actorId?: number | string
  action?: string
  resourceType?: string
  resourceId?: string
  from?: string
  to?: string
}

export interface AuditLogListResult {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}

export function listAuditLogsApi(params: AuditLogListParams) {
  return get<AuditLogListResult>('/audit-logs', params)
}
