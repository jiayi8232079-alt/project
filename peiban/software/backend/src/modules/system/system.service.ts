import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';

const WECHAT_WORK_BOT_WEBHOOK_KEY = 'wechat_work_bot_webhook';
const WECHAT_WORK_BOT_TIMEOUT_MS = 5000;
const ENV_CONFIG_FALLBACKS: Record<string, string> = {
  ai_api_key: 'AI_API_KEY',
  ai_base_url: 'AI_BASE_URL',
  ai_model: 'AI_MODEL',
  ai_vision_model: 'AI_VISION_MODEL',
  ai_vision_api_key: 'AI_VISION_API_KEY',
  ai_vision_base_url: 'AI_VISION_BASE_URL',
  ai_temperature: 'AI_TEMPERATURE',
  ai_max_tokens: 'AI_MAX_TOKENS',
  speech_api_key: 'SPEECH_API_KEY',
  speech_api_base: 'SPEECH_API_BASE',
  speech_model: 'SPEECH_MODEL',
};

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    private readonly configService: ConfigService,
  ) {}

  async getConfig(key: string): Promise<string | null> {
    const item = await this.configRepository.findOne({ where: { key } });
    if (item?.value != null && item.value !== '') return item.value;
    const envKey = ENV_CONFIG_FALLBACKS[key];
    return envKey ? (this.configService.get<string>(envKey) ?? null) : null;
  }

  async getConfigJson<T = any>(key: string): Promise<T | null> {
    const val = await this.getConfig(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }

  async setConfig(key: string, value: string, description?: string) {
    let item = await this.configRepository.findOne({ where: { key } });
    if (item) {
      item.value = value;
      if (description !== undefined) item.description = description;
    } else {
      item = this.configRepository.create({ key, value, description });
    }
    return this.configRepository.save(item);
  }

  async getAllConfigs() {
    return this.configRepository.find({ order: { key: 'ASC' } });
  }

  async deleteConfig(key: string) {
    const item = await this.configRepository.findOne({ where: { key } });
    if (item) await this.configRepository.remove(item);
    return { success: true };
  }

  async batchSetConfigs(
    configs: { key: string; value: string; description?: string }[],
  ) {
    const results = [];
    for (const c of configs) {
      results.push(await this.setConfig(c.key, c.value, c.description));
    }
    return results;
  }

  /* ─────────────── 后台管理员操作审计（P3-B/P3-E） ─────────────── */

  async auditResetAdminPassword(operatorId: number, target: AdminUser) {
    this.logger.warn(
      `[AdminAudit] op=${operatorId} action=resetAdminPassword target=${target.id}(${target.username}) role=${target.role}`,
    );
    await this.notifyAdminAudit(
      '【管理员密码被重置】',
      `操作者=${operatorId}，目标=${target.realName || target.username}（${target.role}）`,
    );
    return { message: '密码已重置' };
  }

  async auditResetAttendantPassword(operatorId: number, target: Attendant) {
    this.logger.warn(
      `[AdminAudit] op=${operatorId} action=resetAttendantPassword target=${target.id}(${target.username || target.phone})`,
    );
    await this.notifyAdminAudit(
      '【陪诊员密码被重置】',
      `操作者=${operatorId}，目标陪诊员=${target.realName || target.username || target.phone || ('ID ' + target.id)}`,
    );
    return { message: '密码已重置' };
  }

  async auditUpdateAdminInfo(
    operatorId: number,
    target: AdminUser,
    changes: Partial<Pick<AdminUser, 'role' | 'status' | 'realName' | 'phone'>>,
  ) {
    const diffs: string[] = [];
    if (changes.role !== undefined && changes.role !== target.role) {
      diffs.push(`role: ${target.role} -> ${changes.role}`);
    }
    if (changes.status !== undefined && changes.status !== target.status) {
      diffs.push(`status: ${target.status ? 'active' : 'disabled'} -> ${changes.status ? 'active' : 'disabled'}`);
    }
    if (changes.realName !== undefined && changes.realName !== target.realName) {
      diffs.push(`realName: ${target.realName || ''} -> ${changes.realName}`);
    }
    if (changes.phone !== undefined && changes.phone !== target.phone) {
      diffs.push(`phone: ${maskPhone(target.phone || '')} -> ${maskPhone(changes.phone || '')}`);
    }
    if (!diffs.length) return;

    this.logger.warn(
      `[AdminAudit] op=${operatorId} action=updateAdminInfo target=${target.id}(${target.username}) changes=[${diffs.join('; ')}]`,
    );

    // 角色/状态变更属于高敏感操作，单独推送企微
    if (diffs.some((d) => d.startsWith('role:') || d.startsWith('status:'))) {
      await this.notifyAdminAudit(
        '【管理员账号变更】',
        `操作者=${operatorId}，目标=${target.realName || target.username}\n变更：${diffs.join('；')}`,
      );
    }
  }

  async auditOrderFinanceChange(
    operatorId: number,
    orderId: number,
    orderNumber: string,
    diffs: string[],
  ) {
    if (!diffs.length) return;
    this.logger.warn(
      `[AdminAudit] op=${operatorId} action=updateOrderFinance order=${orderId}(${orderNumber}) changes=[${diffs.join('; ')}]`,
    );
  }

  private async notifyAdminAudit(title: string, body: string) {
    const webhook = await this.getConfig(WECHAT_WORK_BOT_WEBHOOK_KEY);
    if (!webhook) return; // 未配置则仅日志记录

    const trimmedWebhook = webhook.trim();
    if (!/^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=/i.test(trimmedWebhook)) {
      this.logger.warn(
        `[AdminAudit] wechat work webhook 配置非企微官方地址，跳过通知`,
      );
      return;
    }

    const content = `${title}\n${body}\n时间: ${new Date().toISOString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WECHAT_WORK_BOT_TIMEOUT_MS);
    try {
      const resp = await fetch(trimmedWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: content.slice(0, 1800) },
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        this.logger.warn(
          `[AdminAudit] wechat work webhook 请求非 2xx: ${resp.status}`,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[AdminAudit] wechat work webhook 异常: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
  return '***';
}
