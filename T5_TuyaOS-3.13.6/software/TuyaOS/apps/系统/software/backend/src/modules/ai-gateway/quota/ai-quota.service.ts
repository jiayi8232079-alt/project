import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service.js';
import { UsageMeterService } from '../../billing/usage-meter.service.js';
import { UsageMetric } from '../../../entities/usage-record.entity.js';
import { BIZ_ERROR_CODE } from '../dto/jsonrpc.dto.js';
import type { DeviceContext } from '../tools/tool.interface.js';

/**
 * AI 用量限额 / 计量 —— 防止单台设备无限调用 MCP 工具刷光平台额度。
 *
 * 策略（生产安全）：
 * 1. **每用户每日硬上限**（Redis 计数，始终生效，默认 1000 次/天，可配 AI_DAILY_CALL_CAP）
 *    —— 不依赖计费数据即可防刷，Redis 故障时 fail-open（放行）。
 * 2. **用量留痕**：每次工具调用写 usage_records（供"我的-用量"展示与后续按量计费）。
 *
 * 套餐月度配额强约束默认关闭（避免计费数据未铺时误伤），
 * 运营铺好套餐后置 AI_QUOTA_ENFORCED=true 再开（此处留扩展位）。
 */
@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);
  private readonly dailyCap: number;

  constructor(
    private readonly redis: RedisService,
    private readonly usageMeter: UsageMeterService,
    config: ConfigService,
  ) {
    this.dailyCap = Number(config.get<string>('AI_DAILY_CALL_CAP', '1000')) || 1000;
  }

  /** 工具调用前调用：超额抛错（被 MCP 控制器统一捕获为 E_RATE_LIMIT），否则记录用量。 */
  async checkAndCharge(ctx: DeviceContext): Promise<void> {
    const userId = ctx.userId;
    if (!userId) return; // 无归属用户（异常场景）不计费也不拦截

    // 1. 每日硬上限（Redis）
    const dayKey = `ai:quota:daily:${userId}:${this.today()}`;
    const count = await this.redis.incrWithExpire(dayKey, 90_000); // 25h 过期兜底
    if (count > this.dailyCap) {
      this.logger.warn(`AI 用量超日上限 user=${userId} count=${count}/${this.dailyCap}`);
      const err = new Error('本月用量已用完，可购买加油包或明日再试') as Error & {
        code?: string;
        userMessage?: string;
      };
      err.code = BIZ_ERROR_CODE.E_RATE_LIMIT;
      err.userMessage = '今天聊得有点多啦，咱们歇一歇，明天再聊好不好？';
      throw err;
    }

    // 2. 用量留痕（失败不阻塞工具调用）
    try {
      await this.usageMeter.record(userId, {
        metric: UsageMetric.AI_DIALOG_CALL,
        quantity: 1,
        deviceId: ctx.deviceId,
      });
    } catch (e) {
      this.logger.warn(
        `用量留痕失败 user=${userId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private today(): string {
    // 锁定北京时间日界
    const now = new Date();
    const bj = new Date(now.getTime() + 8 * 3600_000);
    return bj.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
