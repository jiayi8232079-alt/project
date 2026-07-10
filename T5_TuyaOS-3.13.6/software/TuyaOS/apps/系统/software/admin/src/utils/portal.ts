import type { RouteRecordRaw } from 'vue-router'

/** 租户层级类型（与后端 TenantScopeType 对齐） */
export type ScopeType =
  | 'platform'
  | 'government'
  | 'enterprise'
  | 'organization'
  | 'site'

/**
 * 解析当前登录用户的租户层级类型。
 * - 平台超管（无 tenantId）→ platform，可见全部门户；
 * - 租户用户：优先 userInfo.scopeType，其次 tenant.scopeType，
 *   有 tenantId 但无 scopeType 时按机构兜底。
 */
export function userScopeType(userInfo: any): ScopeType {
  const explicit = userInfo?.scopeType || userInfo?.tenant?.scopeType
  if (explicit) return explicit as ScopeType
  if (userInfo?.tenantId == null) return 'platform'
  return 'organization'
}

/**
 * 路由是否对当前层级类型可见。
 * - 未声明 scopeTypes → 不限层级；
 * - 平台层级 → 可见全部（运营总后台需要俯视所有门户）；
 * - 否则需命中 scopeTypes。
 */
export function routeAllowedForScope(
  route: Pick<RouteRecordRaw, 'meta'> | undefined,
  scopeType: ScopeType,
): boolean {
  const scopes = (route?.meta as any)?.scopeTypes as ScopeType[] | undefined
  if (!scopes || !scopes.length) return true
  if (scopeType === 'platform') return true
  return scopes.includes(scopeType)
}

/** 按层级类型推导默认进入的门户首页路径 */
export function resolveHomePortal(scopeType: ScopeType): string {
  switch (scopeType) {
    case 'government':
      return '/portal/government'
    case 'enterprise':
      return '/portal/enterprise'
    case 'organization':
    case 'site':
      return '/portal/community'
    case 'platform':
    default:
      return '/portal/platform'
  }
}
