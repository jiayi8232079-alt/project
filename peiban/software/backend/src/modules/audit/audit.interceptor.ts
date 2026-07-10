import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service.js';

/** 仅记录这些方法的请求（GET/HEAD 一般不记录，避免噪音） */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 允许忽略的 path 前缀：健康检查、静态资源、公开分享链接等 */
const IGNORED_PATH_PREFIXES = [
  '/health',
  '/docs',
  '/favicon',
  '/public-',
  '/auth/captcha',
];

/**
 * 审计拦截器：
 * - 只记录 admin / attendant 身份的写入类请求（POST/PUT/PATCH/DELETE）
 * - 成功/失败都记录，结果携带状态码和耗时
 * - 敏感字段在 AuditLogService.sanitize 中统一脱敏
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const method = String(req?.method || '').toUpperCase();
    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    const pathOnly = String(req?.originalUrl || req?.url || '').split('?')[0];
    if (!pathOnly || IGNORED_PATH_PREFIXES.some((p) => pathOnly.startsWith(p))) {
      return next.handle();
    }

    const user = req?.user as
      | {
          id?: number;
          type?: string;
          role?: string;
          username?: string;
          nickname?: string;
        }
      | undefined;

    // 认证相关端点（登录、刷新等）始终记录，便于追踪登录失败/爆破尝试
    const isAuthEndpoint =
      pathOnly.startsWith('/auth/') &&
      (pathOnly.endsWith('/login') ||
        pathOnly.endsWith('/logout') ||
        pathOnly.endsWith('/refresh'));

    // 当前仅对管理员/陪诊员产生的写请求进行审计，匿名/普通用户的日常 CRUD 不记录
    const shouldAudit =
      isAuthEndpoint ||
      user?.type === 'admin' ||
      user?.role === 'admin' ||
      user?.role === 'operator' ||
      user?.role === 'attendant';

    if (!shouldAudit) {
      return next.handle();
    }

    const startAt = Date.now();
    const ip =
      req?.ip ||
      req?.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req?.connection?.remoteAddress ||
      null;
    const userAgent = req?.headers?.['user-agent'] || null;
    const summary = this.auditLogService.serializeSummary({
      params: req?.params,
      query: req?.query,
      body: req?.body,
    });

    const resourceFromPath = this.parseResourceFromPath(pathOnly);
    const actorName =
      user?.username ||
      user?.nickname ||
      (user?.id != null ? `#${user.id}` : null);

    return next.handle().pipe(
      tap({
        next: (payload) => {
          const res = context.switchToHttp().getResponse();
          const statusCode = Number(res?.statusCode) || 200;
          const resourceId = this.pickResourceId(
            resourceFromPath.resourceId,
            payload,
          );
          void this.auditLogService.create({
            actorType: user?.type === 'admin' ? 'admin' : 'user',
            actorId: user?.id ?? null,
            actorName: actorName ?? null,
            actorRole: user?.role ?? null,
            action: this.deriveAction(method, pathOnly),
            resourceType: resourceFromPath.resourceType,
            resourceId: resourceId,
            method,
            path: pathOnly.slice(0, 512),
            ip: typeof ip === 'string' ? ip : null,
            userAgent:
              typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
            statusCode,
            requestSummary: summary,
            durationMs: Date.now() - startAt,
          });
        },
        error: (err) => {
          const statusCode =
            err instanceof HttpException ? err.getStatus() : 500;
          const remark =
            err instanceof HttpException
              ? (err.message || '').slice(0, 512)
              : String(err?.message || err).slice(0, 512);
          void this.auditLogService.create({
            actorType: user?.type === 'admin' ? 'admin' : 'user',
            actorId: user?.id ?? null,
            actorName: actorName ?? null,
            actorRole: user?.role ?? null,
            action: this.deriveAction(method, pathOnly),
            resourceType: resourceFromPath.resourceType,
            resourceId: resourceFromPath.resourceId,
            method,
            path: pathOnly.slice(0, 512),
            ip: typeof ip === 'string' ? ip : null,
            userAgent:
              typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
            statusCode,
            requestSummary: summary,
            durationMs: Date.now() - startAt,
            remark,
          });
        },
      }),
    );
  }

  /** 从路径尝试推断 resourceType 与 resourceId：/orders/123 → { orders, 123 } */
  private parseResourceFromPath(path: string): {
    resourceType: string | null;
    resourceId: string | null;
  } {
    const clean = path.replace(/^\/+/, '');
    const segments = clean.split('/').filter(Boolean);
    if (segments.length === 0) return { resourceType: null, resourceId: null };
    const resourceType = segments[0];
    let resourceId: string | null = null;
    for (let i = 1; i < segments.length; i += 1) {
      const seg = segments[i];
      if (/^\d+$/.test(seg) || /^[0-9a-f-]{8,}$/i.test(seg)) {
        resourceId = seg;
        break;
      }
    }
    return { resourceType, resourceId };
  }

  /** 请求成功时，若响应体包含新建资源的 id，则用响应体的 id 覆盖 */
  private pickResourceId(existing: string | null, payload: any): string | null {
    if (existing) return existing;
    if (payload && typeof payload === 'object') {
      const id = payload.id ?? payload.data?.id;
      if (id != null) return String(id);
    }
    return null;
  }

  /** 从方法+路径推断动作标识，例如 PUT /orders/123 → order.update */
  private deriveAction(method: string, path: string): string {
    if (path.startsWith('/auth/') && method === 'POST') {
      if (path.endsWith('/login')) return 'auth.login';
      if (path.endsWith('/logout')) return 'auth.logout';
      if (path.endsWith('/refresh')) return 'auth.refresh';
    }
    const { resourceType } = this.parseResourceFromPath(path);
    const type = (resourceType || 'unknown').replace(/-/g, '_');
    const singular = type.endsWith('s') ? type.slice(0, -1) : type;
    switch (method) {
      case 'POST':
        return `${singular}.create`;
      case 'PUT':
      case 'PATCH':
        return `${singular}.update`;
      case 'DELETE':
        return `${singular}.delete`;
      default:
        return `${singular}.${method.toLowerCase()}`;
    }
  }
}
