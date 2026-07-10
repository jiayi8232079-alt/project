import { del, get, patch, post } from './request'

export interface TenantRecord {
  id: number
  code: string
  name: string
  type: 'platform' | 'community' | 'enterprise' | 'personal'
  status: 'active' | 'suspended' | 'disabled' | 'pending'
  dataCenter: string
  parentId: number | null
  path?: string
  depth?: number
  scopeType?: 'platform' | 'government' | 'enterprise' | 'organization' | 'site'
  regionCode?: string | null
  contactName: string | null
  contactPhone: string | null
  settings: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface TenantUserRecord {
  id: number
  tenantId: number
  userId: number
  roleId: number | null
  isOwner: boolean
  status: 'active' | 'invited' | 'disabled'
  joinedAt: string | null
  createdAt: string
  user?: { id: number; nickname?: string; phone?: string }
  role?: { id: number; code: string; name: string }
}

export interface TenantRole {
  id: number
  tenantId: number | null
  code: string
  name: string
  description: string | null
  isBuiltin: boolean
}

export interface TenantPermission {
  id: number
  code: string
  resource: string
  action: string
  name: string
  description: string | null
}

export function listTenants(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
  status?: string
}) {
  return get<{ items: TenantRecord[]; total: number; page: number; pageSize: number }>(
    '/tenants',
    params,
  )
}

export function getTenant(id: number) {
  return get<TenantRecord>(`/tenants/${id}`)
}

export function createTenant(data: {
  code: string
  name: string
  type: string
  dataCenter?: string
  contactName?: string
  contactPhone?: string
  settings?: Record<string, unknown>
  ownerUserId?: number
  parentId?: number
  scopeType?: string
  regionCode?: string
}) {
  return post<TenantRecord>('/tenants', data)
}

export function updateTenant(id: number, data: Partial<TenantRecord>) {
  return patch<TenantRecord>(`/tenants/${id}`, data)
}

export function removeTenant(id: number) {
  return del<{ message: string }>(`/tenants/${id}`)
}

export function listTenantMembers(id: number) {
  return get<TenantUserRecord[]>(`/tenants/${id}/members`)
}

export function addTenantMember(
  tenantId: number,
  data: { userId: number; roleId?: number; isOwner?: boolean },
) {
  return post<TenantUserRecord>(`/tenants/${tenantId}/members`, data)
}

export function removeTenantMember(tenantId: number, userId: number) {
  return del<{ message: string }>(`/tenants/${tenantId}/members/${userId}`)
}

export function listTenantRoles(tenantId?: number) {
  return get<TenantRole[]>('/tenants/roles', { tenantId })
}

export function listTenantPermissions() {
  return get<TenantPermission[]>('/tenants/permissions')
}

export function listMyTenants() {
  return get<TenantUserRecord[]>('/tenants/me/list')
}

export interface TenantTreeNode {
  id: number
  code: string
  name: string
  type: TenantRecord['type']
  scopeType: NonNullable<TenantRecord['scopeType']>
  depth: number
  parentId: number | null
  status: TenantRecord['status']
  regionCode: string | null
  children: TenantTreeNode[]
}

export function getTenantTree() {
  return get<TenantTreeNode[]>('/tenants/tree')
}

export function moveTenant(id: number, newParentId: number) {
  return post<TenantRecord>(`/tenants/${id}/move`, { newParentId })
}
