import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { Request } from 'express';
import type { JsonRpcRequest, JsonRpcResponse } from '../dto/jsonrpc.dto.js';

interface BreakerState {
  failures: number;
  openUntil: number;
}

/**
 * MCP 工具熔断拦截器（per-tool）。
 *
 * - 同一工具连续失败 >= failureThreshold 次 → 打开熔断 openMs 毫秒，
 *   期间该工具直接返回 E_CIRCUIT_OPEN（不打业务），保护下游与额度；
 * - 一次成功即重置；
 * - 失败判定：工具结果 isError=true 或 execute 抛异常。
 *
 * 仅对 tools/call 生效；initialize / tools/list 等放行。
 */
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CircuitBreakerInterceptor.name);
  private readonly states = new Map<string, BreakerState>();
  private readonly failureThreshold = 5;
  private readonly openMs = 30_000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<JsonRpcResponse> {
    const req = context.switchToHttp().getRequest<Request>();
    const body = req.body as JsonRpcRequest | undefined;
    const isToolCall = body?.method === 'tools/call';
    const toolName = isToolCall
      ? ((body?.params as { name?: string } | undefined)?.name ?? undefined)
      : undefined;

    if (!toolName) {
      return next.handle() as Observable<JsonRpcResponse>;
    }

    const now = Date.now();
    const state = this.states.get(toolName);
    if (state && state.openUntil > now) {
      const id = (body?.id ?? null) as string | number | null;
      this.logger.warn(`circuit open: tool=${toolName}`);
      return of(this.circuitOpenResponse(id, toolName));
    }

    return (next.handle() as Observable<JsonRpcResponse>).pipe(
      tap((resp) => {
        const result = (resp as { result?: { isError?: boolean } }).result;
        const isErr = !!result?.isError;
        if (isErr) this.recordFailure(toolName);
        else this.recordSuccess(toolName);
      }),
      catchError((err) => {
        this.recordFailure(toolName);
        throw err;
      }),
    );
  }

  private recordFailure(tool: string): void {
    const s = this.states.get(tool) ?? { failures: 0, openUntil: 0 };
    s.failures += 1;
    if (s.failures >= this.failureThreshold) {
      s.openUntil = Date.now() + this.openMs;
      s.failures = 0;
      this.logger.warn(`circuit trip: tool=${tool} open=${this.openMs}ms`);
    }
    this.states.set(tool, s);
  }

  private recordSuccess(tool: string): void {
    this.states.set(tool, { failures: 0, openUntil: 0 });
  }

  private circuitOpenResponse(
    id: string | number | null,
    tool: string,
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: (id ?? 0) as string | number,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: 'E_CIRCUIT_OPEN',
                message: `工具 ${tool} 暂时熔断`,
                retryable: true,
                userMessage: '这个功能刚才不太稳定，我缓一下再帮您试。',
              },
            }),
          },
        ],
        isError: true,
      },
    };
  }
}
