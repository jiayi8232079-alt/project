import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator.js';

/**
 * 多租户网关 —— 在 JwtAuthGuard 之后执行，确保非 admin 的业务请求必有 tenantId。
 *
 * 校验规则：
 * 1. 若接口/类标了 `@SkipTenant()` → 直接放行（公开端点、admin 跨租户接口）；
 * 2. 未登录（request.user 为空）→ 放行（公开端点应自行用 JwtAuthGuard 兜底）；
 * 3. user.type='admin' → 放行（平台运营天然跨租户）；
 * 4. user.tenantId 为 null/undefined → 拒绝（401 重登才能拿到带 tenantId 的新 JWT）。
 *
 * 不挂全局，**只在 controller/method 显式 `@UseGuards(TenantGuard)`**：
 * - 控制爆破面：Step 4 仅落地能力，灰度由各业务模块自己开关；
 * - 后续 Step 5 改 4 个核心 service 时，会把 TenantGuard 加到对应 controller。
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    // 未登录请求由 JwtAuthGuard 负责拦截；这里不再二次否决，避免误伤公开端点
    if (!user) return true;

    if (user.type === 'admin') return true;

    if (user.tenantId == null) {
      this.logger.warn(
        `[TenantGuard] user#${user.id} 缺少 tenantId（可能是老 JWT），强制重新登录`,
      );
      throw new ForbiddenException({
        message: '会话已过期，请重新登录',
        code: 'TENANT_REQUIRED',
      });
    }

    return true;
  }
}
