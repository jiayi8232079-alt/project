import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import svgCaptcha from 'svg-captcha';

interface CaptchaEntry {
  code: string;
  expireAt: number;
}

/**
 * 图形验证码服务：
 * - 使用进程内 Map 存储 token => code/expireAt
 * - 目前仅供后台登录使用，TTL 短（5 分钟），过期自动清理
 * - 单实例部署足够使用；如需多实例可替换为 Redis 存储
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly store = new Map<string, CaptchaEntry>();
  private readonly ttlMs = 5 * 60 * 1000;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 1000);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expireAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 生成一次性图形验证码。
   * @returns { token, svg }：token 作为后续校验标识；svg 直接传给前端渲染
   */
  generate() {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true,
      background: '#f5f7fa',
      fontSize: 50,
      ignoreChars: '0oO1lI',
      width: 120,
      height: 42,
    });
    const token = randomUUID();
    this.store.set(token, {
      code: captcha.text.toLowerCase(),
      expireAt: Date.now() + this.ttlMs,
    });
    return { token, svg: captcha.data };
  }

  /**
   * 校验并消费一次验证码；无论成功失败都会删除 token（一次性）。
   */
  consume(token: string | undefined, code: string | undefined): boolean {
    if (!token || !code) return false;
    const entry = this.store.get(token);
    if (!entry) return false;
    this.store.delete(token);
    if (entry.expireAt <= Date.now()) return false;
    return entry.code === code.trim().toLowerCase();
  }
}
