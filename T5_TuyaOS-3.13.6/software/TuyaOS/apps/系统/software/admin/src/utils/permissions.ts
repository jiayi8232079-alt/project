import type { RouteRecordRaw } from 'vue-router'

export type AdminRole =
  | 'admin'
  | 'operator'
  | 'finance'
  | 'customer_service'
  | 'medical_consultant'

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: '超级管理员',
  operator: '运营主管',
  finance: '财务人员',
  customer_service: '客服专员',
  medical_consultant: '医学顾问',
}

/**
 * 菜单/路由 meta.roles 的使用约定：
 * - 未设置 roles：所有已登录管理端用户均可访问（同时不在下方受限列表）
 * - 设置 roles：只有命中角色的用户能访问
 * - admin 默认拥有所有路由访问权限（单独处理）
 */
export function routeAllowedForRole(
  route: Pick<RouteRecordRaw, 'meta'> | undefined,
  role: string | undefined,
): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const roles = (route?.meta as any)?.roles as string[] | undefined
  if (!roles || !roles.length) return true
  return roles.includes(role)
}

/**
 * 给定顶层菜单路由，过滤出当前角色能访问的子路由。
 * 若所有子路由均被过滤，则返回 null 表示顶层也不显示。
 */
export function filterMenuChildren(
  menu: RouteRecordRaw,
  role: string | undefined,
): RouteRecordRaw | null {
  const children = (menu.children || []).filter((c) => {
    if ((c.meta as any)?.hidden) return false
    const hasComponent = !!(c.component || (c.components && Object.keys(c.components).length))
    if (c.redirect != null && !hasComponent) return false
    return routeAllowedForRole(c, role)
  })
  if (!children.length) return null
  if (!routeAllowedForRole(menu, role)) return null
  return { ...menu, children }
}
