import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { JsonRpcResponse } from '../dto/jsonrpc.dto.js';

// 身份证（18 位）放前面，避免被手机号规则误伤
const IDCARD_RE = /\b(\d{4})\d{10}(\w{4})\b/g;
const PHONE_RE = /\b(1[3-9]\d)\d{4}(\d{4})\b/g;
const SENSITIVE_KEYS = /(phone|mobile|tel|idcard|id_card|idno|id_number|id_card_no)/i;

/**
 * MCP 工具响应脱敏拦截器。
 *
 * 工具结果以 JSON 文本放在 result.content[].text 中：
 * - 解析后按「敏感字段名」整体脱敏（保留首尾）；
 * - 同时对任意字符串里的手机号 / 身份证号做正则掩码（兜底）。
 *
 * 注意：放在 CircuitBreakerInterceptor 之后（内层），熔断短路响应不经过此处（无敏感数据）。
 */
@Injectable()
export class DesensitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<JsonRpcResponse> {
    return (next.handle() as Observable<JsonRpcResponse>).pipe(
      map((resp) => {
        const result = (resp as { result?: { content?: unknown } }).result;
        const content = result?.content;
        if (Array.isArray(content)) {
          for (const item of content as Array<{ type?: string; text?: string }>) {
            if (item && item.type === 'text' && typeof item.text === 'string') {
              item.text = this.maskText(item.text);
            }
          }
        }
        return resp;
      }),
    );
  }

  private maskText(text: string): string {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(this.maskValue(obj));
    } catch {
      return this.maskString(text);
    }
  }

  private maskValue(value: unknown, key?: string): unknown {
    if (typeof value === 'string') {
      if (key && SENSITIVE_KEYS.test(key)) return this.maskFull(value);
      return this.maskString(value);
    }
    if (Array.isArray(value)) return value.map((v) => this.maskValue(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = this.maskValue(v, k);
      return out;
    }
    return value;
  }

  private maskString(s: string): string {
    return s
      .replace(IDCARD_RE, '$1**********$2')
      .replace(PHONE_RE, '$1****$2');
  }

  private maskFull(s: string): string {
    if (!s) return s;
    if (s.length <= 4) return '****';
    return `${s.slice(0, 2)}****${s.slice(-2)}`;
  }
}
