import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

/**
 * WebSocket JWT 鉴权 —— 在 socket 连接时校验 query.token / auth.token。
 *
 * 连接示例（前端）：
 *   io('https://api.qiaoguo.com', {
 *     auth: { token: 'Bearer xxx' },     // 推荐
 *     // 或 query: { token: 'xxx' }
 *   })
 *
 * 校验通过后会把 user 信息挂在 socket.data：
 *   { userId, tenantId, role, type }
 *
 * 失败：抛 WsException → 客户端收到 connect_error，socket 断开。
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    return this.attachUser(client);
  }

  /** 也支持在 handleConnection 里手动调用：connectionAuth(socket) */
  attachUser(client: Socket): boolean {
    // 已经鉴权过的连接（reauth）直接放行
    if (client.data?.userId) return true;

    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`ws 连接缺少 token sid=${client.id}`);
      client.disconnect(true);
      return false;
    }

    try {
      const payload = this.jwtService.verify<{
        sub: number;
        role: string;
        type: 'user' | 'admin';
        tenantId?: number | null;
      }>(token);
      client.data = {
        ...(client.data ?? {}),
        userId: payload.sub,
        role: payload.role,
        type: payload.type,
        tenantId: payload.tenantId ?? null,
      };
      return true;
    } catch (err) {
      this.logger.warn(
        `ws 连接 token 校验失败 sid=${client.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.disconnect(true);
      return false;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken =
      (client.handshake.auth as { token?: string } | undefined)?.token;
    const queryToken =
      typeof client.handshake.query?.token === 'string'
        ? client.handshake.query.token
        : Array.isArray(client.handshake.query?.token)
        ? client.handshake.query.token[0]
        : null;
    const raw = authToken || queryToken;
    if (!raw) return null;
    return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw;
  }
}
