import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service.js';

/** 与 @nestjs/throttler 的 ThrottlerStorageRecord 同形（该类型未从包入口导出，这里本地声明） */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis 固定窗口限流存储 —— 让限流计数跨 PM2/K8s 多实例共享。
 *
 * 语义对齐 @nestjs/throttler v6：入参 ttl/blockDuration 为毫秒，
 * 返回 timeToExpire/timeToBlockExpire 为秒。
 *
 * **fail-open**：Redis 故障时返回"未触发"，绝不因缓存故障把全站请求拦死
 *（可用性优先；限流降级为单实例 throttler 的缺失，可接受）。
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    try {
      const client = this.redis.raw;
      const totalHits = await client.incr(redisKey);
      let pttl = await client.pttl(redisKey);
      // 首次或无过期（-1/-2）时设置窗口
      if (totalHits === 1 || pttl < 0) {
        await client.pexpire(redisKey, ttl);
        pttl = ttl;
      }
      const timeToExpire = Math.ceil(pttl / 1000);
      const isBlocked = totalHits > limit;
      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? timeToExpire : 0,
      };
    } catch {
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
