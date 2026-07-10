import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SmsCodeEntry {
  code: string;
  expireAt: number;
  attempts: number;
}

/**
 * 短信验证码服务（App 手机号登录用）。
 *
 * - 进程内 Map 存储 phone => code/expireAt/attempts，TTL 5 分钟
 * - 同号 60s 重发间隔；单码最多校验 5 次
 * - 单实例部署足够；多实例需替换为 Redis（与 captcha.service 同策略）
 * - 真实短信通道未配置时（开发环境）由 send() 回显 devCode 便于联调
 */
@Injectable()
export class SmsCodeService {
  private readonly logger = new Logger(SmsCodeService.name);
  private readonly store = new Map<string, SmsCodeEntry>();
  private readonly lastSentAt = new Map<string, number>();
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly resendIntervalMs = 60 * 1000;
  private readonly maxAttempts = 5;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 1000);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expireAt <= now) this.store.delete(key);
    }
    for (const [key, ts] of this.lastSentAt.entries()) {
      if (now - ts > this.ttlMs) this.lastSentAt.delete(key);
    }
  }

  private isProd() {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /** 生成并下发验证码；非生产环境回显 devCode 便于无短信通道联调。 */
  async send(phone: string): Promise<{ sent: boolean; devCode?: string }> {
    const now = Date.now();
    const last = this.lastSentAt.get(phone) ?? 0;
    if (now - last < this.resendIntervalMs) {
      const wait = Math.ceil((this.resendIntervalMs - (now - last)) / 1000);
      throw new BadRequestException(`请 ${wait} 秒后再获取验证码`);
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.store.set(phone, { code, expireAt: now + this.ttlMs, attempts: 0 });
    this.lastSentAt.set(phone, now);

    await this.dispatch(phone, code);

    return this.isProd() ? { sent: true } : { sent: true, devCode: code };
  }

  /**
   * 校验验证码（一次性，成功即消费）。
   * 开发环境支持万能码 000000，便于无短信通道时联调。
   */
  verify(phone: string, code: string): boolean {
    const input = (code || '').trim();
    if (!this.isProd() && input === '000000') return true;

    const entry = this.store.get(phone);
    if (!entry) return false;
    if (entry.expireAt <= Date.now()) {
      this.store.delete(phone);
      return false;
    }
    entry.attempts += 1;
    if (entry.attempts > this.maxAttempts) {
      this.store.delete(phone);
      return false;
    }
    if (entry.code !== input) return false;
    this.store.delete(phone);
    return true;
  }

  /**
   * 真正下发短信的接入点。
   * - 未配置 SMS_PROVIDER 或为 'log'：仅记录日志（开发联调用 devCode）
   * - 配置了真实通道：在此填充 SDK 调用（阿里云 Dysmsapi / 腾讯云 SMS 等）
   *   需要的配置：SMS_PROVIDER / SMS_ACCESS_KEY_ID / SMS_ACCESS_KEY_SECRET /
   *               SMS_SIGN_NAME / SMS_TEMPLATE_CODE
   */
  private async dispatch(phone: string, code: string): Promise<void> {
    const provider = this.configService.get<string>('SMS_PROVIDER')?.trim();
    if (!provider || provider === 'log') {
      this.logger.log(`[SMS:log] 向 ${phone} 发送验证码 ${code}（未配置真实短信通道）`);
      return;
    }
    // TODO: 接入真实短信通道。未实现前回退日志，避免阻塞联调。
    this.logger.warn(`[SMS:${provider}] 短信通道未实现，回退日志：${phone} -> ${code}`);
  }
}
