import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  RealtimeEvent,
  RealtimePush,
  RealtimeRouting,
} from './realtime.types.js';

/**
 * 实时推送编排服务 —— 业务模块的唯一入口。
 *
 * 用法：
 *   constructor(private rt: RealtimeService) {}
 *   await this.rt.push({
 *     event: { type:'alert.fall', alertId:..., level:'critical', summary:'...', occurredAt:... },
 *     routing: { tenantId:..., serviceTargetIds:[42], broadcastToTenant: true }
 *   });
 *
 * 路由策略：
 * 1. 优先按 userIds / deviceIds / serviceTargetIds 精准推；
 * 2. broadcastToTenant=true 时额外发到 tenant:{id} room；
 * 3. 同一 socket 多 room 命中只会收到 1 次（socket.io 自动去重）。
 *
 * 失败/降级：
 * - 客户端离线 → socket.io 不会重投；持久化由调用方写 notification 表，
 *   客户端上线后用 REST API 拉历史；
 * - 本地无 Server 句柄（初始化失败 / 测试环境）→ 静默丢弃，业务不阻塞。
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  bindServer(server: Server): void {
    this.server = server;
  }

  isReady(): boolean {
    return this.server !== null;
  }

  /** 统一推送入口 */
  async push(push: RealtimePush): Promise<void> {
    if (!this.server) {
      this.logger.warn(
        `[RealtimeService] server 未就绪，丢弃事件 ${push.event.type}`,
      );
      return;
    }

    const rooms = this.resolveRooms(push.routing);
    if (rooms.length === 0) {
      this.logger.debug(`[RealtimeService] ${push.event.type} 无路由，跳过`);
      return;
    }

    this.server.to(rooms).emit('realtime:event', push.event);
    this.logger.debug(
      `推送 ${push.event.type} → rooms=${rooms.join(',')}`,
    );
  }

  /** 快捷方法：按 event 类型推断默认 routing */
  async pushAlert(event: RealtimeEvent & { type: `alert.${string}` }, routing: RealtimeRouting): Promise<void> {
    return this.push({ event, routing: { ...routing, broadcastToTenant: true } });
  }

  /** 快捷方法：设备 DP 变化只推订阅了该设备的客户端 */
  async pushDeviceEvent(
    event: RealtimeEvent & { deviceId?: number },
    tenantId: number,
  ): Promise<void> {
    if (!event.deviceId) {
      this.logger.warn(`pushDeviceEvent 缺少 deviceId，跳过 ${event.type}`);
      return;
    }
    return this.push({
      event,
      routing: { tenantId, deviceIds: [event.deviceId] },
    });
  }

  private resolveRooms(routing: RealtimeRouting): string[] {
    const rooms = new Set<string>();
    routing.userIds?.forEach((uid) => rooms.add(`user:${uid}`));
    routing.deviceIds?.forEach((did) => rooms.add(`device:${did}`));
    routing.serviceTargetIds?.forEach((stid) =>
      rooms.add(`service-target:${stid}`),
    );
    if (routing.broadcastToTenant && routing.tenantId) {
      rooms.add(`tenant:${routing.tenantId}`);
    }
    return Array.from(rooms);
  }
}
