import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../contexts/request-context.js';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy.js';

/**
 * 把当前请求的 user（经 JwtAuthGuard 注入到 request.user）写入 AsyncLocalStorage，
 * 让后续 service/subscriber 在异步链路里都能拿到。
 *
 * 顺序约定：
 * - Nest 执行顺序：middleware → guard → **interceptor** → pipe → handler；
 * - 所以这个 interceptor 一定在 JwtAuthGuard 之后跑，request.user 已经赋值；
 * - 即便接口未挂 JwtAuthGuard（公开端点），user=null 也合法（subscriber 会回退到默认租户）。
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | null = req?.user ?? null;

    // requestId 优先用上游传入（如网关注入的 x-request-id），否则本地生成
    const requestId =
      req?.headers?.['x-request-id'] ||
      req?.headers?.['x-trace-id'] ||
      randomUUID();

    return new Observable((subscriber) => {
      RequestContext.run(
        { user, startedAt: Date.now(), requestId: String(requestId) },
        () => {
          const inner = next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });
          return () => inner.unsubscribe();
        },
      );
    });
  }
}
