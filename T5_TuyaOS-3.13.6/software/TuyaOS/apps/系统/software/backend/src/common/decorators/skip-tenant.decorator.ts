import { SetMetadata } from '@nestjs/common';

/**
 * 跳过 TenantGuard 校验的标记 —— 用于：
 * - 公开端点（如健康检查、登录、注册、公共码扫描）；
 * - 平台超管的跨租户接口（如 `/tenants` 列表、`/admin/*`）；
 * - 系统任务触发的 HTTP 钩子。
 *
 * 用法：
 *   @SkipTenant()
 *   @Get('public/ping')
 *   ping() { return 'ok'; }
 *
 * 注意：跳过的是「tenantId 必填校验」，并不等于跳过认证；如需公开，仍需移除 JwtAuthGuard。
 */
export const SKIP_TENANT_KEY = 'skip-tenant';
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
