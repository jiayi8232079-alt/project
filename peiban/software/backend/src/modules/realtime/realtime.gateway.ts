import { Inject, Logger, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { WsJwtGuard } from './auth/ws-jwt.guard.js';
import { RealtimeService } from './realtime.service.js';
import { RedisService } from '../../common/redis/redis.service.js';

/**
 * WebSocket Gateway —— socket.io 端点。
 *
 * Room 命名规则：
 * - `tenant:{id}`         租户广播（社区端值班台）
 * - `user:{id}`           单个用户（家属端 App）
 * - `device:{id}`         单个设备的所有订阅者（设备控制页）
 * - `service-target:{id}` 关注某个老人的家属群
 *
 * 客户端事件协议：
 * - 连接成功后自动 join `user:{userId}` 和 `tenant:{tenantId}`；
 * - 客户端可以 emit `subscribe:device` / `subscribe:service-target` 加额外 room；
 * - 服务端 emit `realtime:event`，payload 为 `RealtimeEvent`。
 *
 * 不设 namespace（用默认 `/`）便于前端最简连接；后续要分租户/产品时可改用 namespace。
 */
@WebSocketGateway({
  cors: { origin: '*' },
  // 浏览器/Flutter 双兼容；socket.io 自动适配
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsJwtGuard: WsJwtGuard,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.bindServer(server);
    // 异步挂载 adapter：createAdapter 会在 namespace 初始化时才 psubscribe，
    // 必须等 duplicate 连接 ready，否则 enableOfflineQueue=false 会直接抛错杀进程。
    void this.setupRedisAdapter(server);
    this.logger.log('RealtimeGateway 启动完成');
  }

  private async setupRedisAdapter(server: Server): Promise<void> {
    if (!this.redis.isHealthy) {
      this.logger.warn('Redis 未就绪，socket.io 使用单实例模式');
      return;
    }
    const pubClient = this.redis.raw.duplicate({ enableOfflineQueue: true });
    const subClient = this.redis.raw.duplicate({ enableOfflineQueue: true });
    try {
      await Promise.all([
        this.waitRedisReady(pubClient),
        this.waitRedisReady(subClient),
      ]);
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('socket.io Redis Adapter 已启用（多实例事件互通）');
    } catch (err) {
      pubClient.disconnect();
      subClient.disconnect();
      this.logger.warn(
        `Redis Adapter 启用失败，降级为单实例：${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private waitRedisReady(client: ReturnType<RedisService['raw']['duplicate']>): Promise<void> {
    if (client.status === 'ready') return Promise.resolve();
    return new Promise((resolve, reject) => {
      client.once('ready', () => resolve());
      client.once('error', (err) => reject(err));
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const ok = this.wsJwtGuard.attachUser(client);
    if (!ok) return; // attachUser 已经 disconnect

    const userId = client.data.userId as number;
    const tenantId = client.data.tenantId as number | null;
    await client.join(`user:${userId}`);
    if (tenantId) await client.join(`tenant:${tenantId}`);

    this.logger.log(
      `ws 连接 sid=${client.id} user=${userId} tenant=${tenantId ?? 'admin'}`,
    );
    client.emit('realtime:hello', {
      userId,
      tenantId,
      serverTime: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`ws 断开 sid=${client.id} user=${client.data?.userId}`);
  }

  /** 客户端订阅某台设备的实时事件 */
  @SubscribeMessage('subscribe:device')
  async subscribeDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { deviceId: number },
  ): Promise<{ ok: boolean }> {
    if (!body?.deviceId) return { ok: false };
    await client.join(`device:${body.deviceId}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:device')
  async unsubscribeDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { deviceId: number },
  ): Promise<{ ok: boolean }> {
    if (!body?.deviceId) return { ok: false };
    await client.leave(`device:${body.deviceId}`);
    return { ok: true };
  }

  @SubscribeMessage('subscribe:service-target')
  async subscribeServiceTarget(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { serviceTargetId: number },
  ): Promise<{ ok: boolean }> {
    if (!body?.serviceTargetId) return { ok: false };
    await client.join(`service-target:${body.serviceTargetId}`);
    return { ok: true };
  }
}
