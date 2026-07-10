import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy.js';

/**
 * 请求级别的上下文 —— 跨 Nest middleware/guard/interceptor/service/subscriber 传递「当前用户」。
 *
 * 为什么用 AsyncLocalStorage 而非 request-scoped provider：
 * - TypeORM Subscriber 是 DataSource 单例，无法注入 request-scoped 服务；
 * - request-scoped provider 会让整条依赖链都退化为 request-scoped，性能成本高；
 * - ALS 是 Node 内置，零依赖，运行时开销可忽略。
 *
 * 用法：
 * - 在 RequestContextInterceptor 里 `RequestContext.run({ user }, () => next.handle())`；
 * - 业务代码用 `RequestContext.currentUser()` 拿当前用户（含 tenantId）；
 * - TenantSubscriber 也从这里拿 tenantId 自动注入到 insert。
 */
const storage = new AsyncLocalStorage<RequestContextStore>();

export interface RequestContextStore {
  user: AuthenticatedUser | null;
  /** 请求开始时间戳 ms，用于日志/审计 */
  startedAt: number;
  /** 可选：业务 traceId / requestId */
  requestId?: string;
}

export const RequestContext = {
  /**
   * 在指定 store 内执行 fn —— 通常由 RequestContextInterceptor 包住整个请求处理。
   * fn 内（包括异步链）所有调用 `RequestContext.currentUser()` 等都能拿到此 store。
   */
  run<T>(store: RequestContextStore, fn: () => T): T {
    return storage.run(store, fn);
  },

  /** 当前请求的 store；非请求上下文（系统任务/启动期）返回 undefined */
  getStore(): RequestContextStore | undefined {
    return storage.getStore();
  },

  /** 当前请求的 user（含 tenantId）；非请求上下文返回 null */
  currentUser(): AuthenticatedUser | null {
    return storage.getStore()?.user ?? null;
  },

  /**
   * 当前请求的 tenantId；非请求上下文或 admin 类型返回 null。
   * 业务代码若拿到 null，应当：
   * - admin 接口：跨租户访问（已通过 RolesGuard 鉴权）；
   * - 系统任务：用调用方传入的 tenantId，或视为「平台默认租户」。
   */
  currentTenantId(): number | null {
    return storage.getStore()?.user?.tenantId ?? null;
  },
};
