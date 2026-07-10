import type { FindOptionsWhere, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { RequestContext } from '../contexts/request-context.js';

/** 数据查询作用域（配套 PRD §8.1） */
export type TenantDataScope = 'self' | 'descendants' | 'tenant';

export interface ApplyTenantScopeOptions {
  scope?: TenantDataScope;
  /** scope=tenant 时指定的下属租户 ID（调用方须先 canAccess） */
  tenantId?: number;
  /** 由 TenantHierarchyService.resolveScopeTenantIds 解析出的 ID 列表 */
  allowedTenantIds?: number[];
  paramName?: string;
}

/**
 * 多租户查询辅助 —— 给业务 service 复用，避免每个 `where` 都手写 `tenantId`。
 *
 * 使用约定（PRD §13）：
 * - **写入侧**由 TenantSubscriber 自动注入 tenantId，业务无需关心；
 * - **查询侧**由业务 service 显式调用本 helper，过滤当前请求租户的数据。
 *   不做"全局透明过滤"是因为：
 *     - 部分 admin 跨租户列表必须看到所有数据，过滤反成噪声；
 *     - 显式调用更易在 PR review 时核对。
 *
 * 行为：
 * - 当前请求**有** tenantId（普通用户/陪诊员）→ 加 `WHERE tenant_id = ?`；
 * - 当前请求**无** tenantId（admin / 启动任务 / cron）→ 不加，由业务自己决定是否跨租户；
 *   admin 接口若需要按特定租户过滤，直接传 query 参数显式过滤即可。
 */

/** 给 QueryBuilder 加租户过滤 —— 返回同一个 qb 方便链式调用 */
export function applyTenantFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  options?: { paramName?: string },
): SelectQueryBuilder<T> {
  const tenantId = RequestContext.currentTenantId();
  if (tenantId == null) return qb;
  const param = options?.paramName ?? '__tenantId';
  return qb.andWhere(`${alias}.tenant_id = :${param}`, { [param]: tenantId });
}

/** 给 Repository.find / findOne 的 where 合并租户过滤 */
export function withTenantWhere<T extends ObjectLiteral>(
  where: FindOptionsWhere<T> | FindOptionsWhere<T>[] = {},
): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
  const tenantId = RequestContext.currentTenantId();
  if (tenantId == null) return where;
  if (Array.isArray(where)) {
    return where.map((w) => ({ ...(w as any), tenantId }) as FindOptionsWhere<T>);
  }
  return { ...(where as any), tenantId } as FindOptionsWhere<T>;
}

/**
 * 跨租户写入兜底（极少数业务用）：admin 接口主动给某个租户建数据时使用。
 * 业务 service 显式传 tenantId，绕过 RequestContext 兜底。
 *
 * 示例：
 *   const order = this.orderRepo.create(withTenantOverride(dto, targetTenantId));
 *   await this.orderRepo.save(order);
 */
export function withTenantOverride<T extends object>(payload: T, tenantId: number): T & { tenantId: number } {
  return { ...payload, tenantId };
}

/**
 * 按 scope 过滤租户数据（需配合 TenantHierarchyService.resolveScopeTenantIds）。
 *
 * - `self`（默认）：仅当前租户
 * - `descendants`：当前 + 所有子孙（allowedTenantIds 由 hierarchy 服务提供）
 * - `tenant`：指定 tenantId（须先 canAccess）
 * - admin（无 tenantId）且未传 allowedTenantIds → 不加过滤
 */
export function applyTenantScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  options?: ApplyTenantScopeOptions,
): SelectQueryBuilder<T> {
  const param = options?.paramName ?? '__tenantScope';
  const allowed = options?.allowedTenantIds;

  if (allowed != null) {
    if (allowed.length === 0) {
      return qb.andWhere('1 = 0');
    }
    if (allowed.length === 1) {
      return qb.andWhere(`${alias}.tenant_id = :${param}`, { [param]: allowed[0] });
    }
    return qb.andWhere(`${alias}.tenant_id IN (:...${param})`, { [param]: allowed });
  }

  const tenantId = RequestContext.currentTenantId();
  if (tenantId == null) return qb;

  const scope = options?.scope ?? 'self';
  if (scope === 'tenant' && options?.tenantId != null) {
    return qb.andWhere(`${alias}.tenant_id = :${param}`, {
      [param]: options.tenantId,
    });
  }

  return applyTenantFilter(qb, alias, { paramName: param });
}

/** Repository.find 的 scope 版 where */
export function withTenantScopeWhere<T extends ObjectLiteral>(
  where: FindOptionsWhere<T> | FindOptionsWhere<T>[] = {},
  allowedTenantIds?: number[],
): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
  if (allowedTenantIds == null) return withTenantWhere(where);
  if (allowedTenantIds.length === 0) {
    return { ...(Array.isArray(where) ? where[0] : where), tenantId: -1 } as FindOptionsWhere<T>;
  }
  const base = Array.isArray(where) ? where : [where];
  if (allowedTenantIds.length === 1) {
    const tid = allowedTenantIds[0];
    return base.map(
      (w) => ({ ...(w as any), tenantId: tid }) as FindOptionsWhere<T>,
    );
  }
  return base.flatMap((w) =>
    allowedTenantIds.map(
      (tid) => ({ ...(w as any), tenantId: tid }) as FindOptionsWhere<T>,
    ),
  );
}
