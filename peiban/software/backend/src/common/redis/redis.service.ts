import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 统一封装 —— 全应用共享一个连接，**优雅降级**。
 *
 * 设计原则：Redis 不可用时所有方法静默兜底（读返回 null / 去重放行 / 写忽略），
 * 保证后端在 Redis 故障时仍能工作（只是退化为无缓存），不抛错阻塞业务。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private healthy = false;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    this.client.on('ready', () => {
      this.healthy = true;
      this.logger.log('Redis 连接就绪');
    });
    this.client.on('error', (err) => {
      if (this.healthy) this.logger.warn(`Redis 连接异常：${err.message}`);
      this.healthy = false;
    });
  }

  get isHealthy(): boolean {
    return this.healthy;
  }

  /** 暴露原始客户端（如需 duplicate 给 socket.io adapter / bullmq） */
  get raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setex(key: string, ttlSec: number, value: string): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSec);
    } catch {
      /* 降级：忽略写入 */
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.client.set(key, value);
    } catch {
      /* 降级 */
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      /* 降级 */
    }
  }

  /**
   * 去重 / 互斥锁：首次在窗口内拿到返回 true，重复返回 false。
   * **fail-open**：Redis 故障时返回 true（按"首次"处理），
   * 避免把跌倒/SOS 这类关键事件因缓存故障而误丢。
   */
  async acquireOnce(key: string, ttlSec: number): Promise<boolean> {
    try {
      const res = await this.client.set(key, '1', 'EX', ttlSec, 'NX');
      return res === 'OK';
    } catch {
      return true;
    }
  }

  /**
   * 自增计数器（首次自动设过期）。用于按天/按窗口限额计数。
   * **fail-open**：Redis 故障返回 0（调用方据此放行，不因缓存故障拦死业务）。
   */
  async incrWithExpire(key: string, ttlSec: number): Promise<number> {
    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, ttlSec);
      return count;
    } catch {
      return 0;
    }
  }

  /** 按前缀批量删除（SCAN，非阻塞）。用于按用户清 JWT 缓存。 */
  async delByPattern(pattern: string): Promise<void> {
    try {
      const stream = this.client.scanStream({ match: pattern, count: 200 });
      for await (const keys of stream) {
        if ((keys as string[]).length) await this.client.del(...(keys as string[]));
      }
    } catch {
      /* 降级 */
    }
  }

  onModuleDestroy(): void {
    this.client.quit().catch(() => undefined);
  }
}
