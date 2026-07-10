import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 校验 MCP 请求的 HMAC-SHA256 签名。
 *
 * 签名规则（与 docs/specs/ai-gateway-mcp-spec.md §2.1 一致）：
 *   stringToSign = X-Device-Id + '\n' + X-Request-Id + '\n' + rawBody
 *   signature    = HMAC-SHA256(secret, stringToSign).hex
 *   Authorization: Bearer <signature>
 *
 * 失败场景：
 * - 缺 Authorization / 必传请求头     → 401
 * - 签名不匹配                        → 401
 * - 请求时戳过期 / 缺失（5min 漂移）  → 401（待实现，依赖 X-Timestamp 头）
 *
 * 性能：使用 `timingSafeEqual` 防时序攻击。
 */
@Injectable()
export class TuyaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TuyaSignatureGuard.name);
  private readonly secret: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.secret = this.config.get<string>('AI_GATEWAY_HMAC_SECRET', '');
    this.enabled = this.secret.length > 0;
    if (!this.enabled) {
      this.logger.warn(
        '[TuyaSignatureGuard] AI_GATEWAY_HMAC_SECRET 未配置，签名校验已跳过（仅 dev 允许）',
      );
    }
  }

  canActivate(execCtx: ExecutionContext): boolean {
    if (!this.enabled) return true;

    const req = execCtx.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    const deviceId = req.headers['x-device-id'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;

    if (!auth?.startsWith('Bearer ') || !deviceId || !requestId) {
      throw new UnauthorizedException('缺少签名相关请求头');
    }

    const provided = auth.slice('Bearer '.length).trim();
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : JSON.stringify(req.body ?? {});
    const stringToSign = `${deviceId}\n${requestId}\n${rawBody}`;
    const expected = createHmac('sha256', this.secret)
      .update(stringToSign)
      .digest('hex');

    try {
      const a = Buffer.from(provided, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new Error('mismatch');
      }
    } catch {
      this.logger.warn(`签名校验失败 deviceId=${deviceId} requestId=${requestId}`);
      throw new UnauthorizedException('签名校验失败');
    }
    return true;
  }
}
