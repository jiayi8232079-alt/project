import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { sms as TencentSmsSdk } from 'tencentcloud-sdk-nodejs-sms';
import { SystemConfig } from '../../entities/system-config.entity.js';
import {
  SmsSendLog,
  SmsSendStatus,
} from '../../entities/sms-send-log.entity.js';

type TencentSmsClient = InstanceType<typeof TencentSmsSdk.v20210111.Client>;

/**
 * 业务层短信模板键；具体的腾讯云 TemplateId 由系统配置映射
 */
export type SmsTemplateKey = 'medication_reminder' | 'follow_up_reminder';

interface SmsRuntimeConfig {
  enabled: boolean;
  secretId?: string;
  secretKey?: string;
  sdkAppId?: string;
  signName?: string;
  templates: Partial<Record<SmsTemplateKey, string>>;
  dailyLimitPerPhone: number;
}

/**
 * 腾讯云短信服务封装。
 * 约定：本服务只做「单条发送 + 频控 + 日志」，不做多渠道聚合；
 * 聚合（小程序+短信 双发）在 NotificationService 完成。
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private smsClient: TencentSmsClient | null = null;
  private smsClientKey = '';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(SmsSendLog)
    private readonly logRepo: Repository<SmsSendLog>,
  ) {}

  /**
   * 发送短信。返回 true 表示腾讯云受理成功（Code=Ok）。
   * 任何失败/跳过都会写 sms_send_log，调用方无需 try/catch。
   */
  async sendSms(
    phone: string,
    templateKey: SmsTemplateKey,
    params: string[],
  ): Promise<boolean> {
    const safeParams = (params || []).map((p) => String(p ?? ''));
    const normalized = this.normalizePhone(phone);
    const cfg = await this.loadSmsConfig();

    if (!cfg.enabled) {
      await this.writeLog(
        normalized || String(phone || ''),
        templateKey,
        null,
        safeParams,
        'disabled',
        '短信总开关未开启',
      );
      return false;
    }

    const templateId = cfg.templates[templateKey];
    const missing: string[] = [];
    if (!normalized) missing.push('phone');
    if (!templateId) missing.push('templateId');
    if (!cfg.secretId) missing.push('secretId');
    if (!cfg.secretKey) missing.push('secretKey');
    if (!cfg.sdkAppId) missing.push('sdkAppId');
    if (!cfg.signName) missing.push('signName');
    if (missing.length > 0) {
      await this.writeLog(
        normalized || String(phone || ''),
        templateKey,
        templateId || null,
        safeParams,
        'no_phone',
        `缺少必填项: ${missing.join(',')}`,
      );
      return false;
    }

    const count = await this.getTodaySuccessCount(normalized!);
    if (count >= cfg.dailyLimitPerPhone) {
      await this.writeLog(
        normalized!,
        templateKey,
        templateId!,
        safeParams,
        'rate_limited',
        `已达每日上限 ${cfg.dailyLimitPerPhone}`,
      );
      this.logger.warn(
        `短信触发频控跳过 phone=${this.maskPhone(normalized!)} tpl=${templateKey} used=${count}/${cfg.dailyLimitPerPhone}`,
      );
      return false;
    }

    try {
      const client = this.getClient(cfg);
      const res = await client.SendSms({
        PhoneNumberSet: [`+86${normalized}`],
        SmsSdkAppId: cfg.sdkAppId!,
        SignName: cfg.signName!,
        TemplateId: templateId!,
        TemplateParamSet: safeParams,
      });

      const resultItem = (res?.SendStatusSet || [])[0];
      const ok = resultItem?.Code === 'Ok';
      await this.writeLog(
        normalized!,
        templateKey,
        templateId!,
        safeParams,
        ok ? 'success' : 'failed',
        ok ? null : resultItem?.Message || resultItem?.Code || '未知错误',
        resultItem?.SerialNo || null,
      );
      if (!ok) {
        this.logger.warn(
          `短信发送失败 phone=${this.maskPhone(normalized!)} tpl=${templateKey} code=${resultItem?.Code} msg=${resultItem?.Message}`,
        );
      } else {
        this.logger.log(
          `短信已受理 phone=${this.maskPhone(normalized!)} tpl=${templateKey} serial=${resultItem?.SerialNo || ''}`,
        );
      }
      return ok;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `短信发送异常 phone=${this.maskPhone(normalized!)} tpl=${templateKey}: ${msg}`,
      );
      await this.writeLog(
        normalized!,
        templateKey,
        templateId!,
        safeParams,
        'error',
        msg.slice(0, 500),
      );
      return false;
    }
  }

  /** 当日已成功条数（用于频控），按本地日起点计算 */
  private async getTodaySuccessCount(phone: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.logRepo.count({
      where: {
        phone,
        status: 'success',
        createdAt: MoreThanOrEqual(todayStart),
      },
    });
  }

  private async writeLog(
    phone: string,
    templateKey: string,
    templateId: string | null,
    params: string[],
    status: SmsSendStatus,
    errorMessage: string | null = null,
    tencentSerialNo: string | null = null,
  ): Promise<void> {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          phone: String(phone || '').slice(0, 20),
          templateKey: String(templateKey || '').slice(0, 64),
          templateId: templateId ? templateId.slice(0, 64) : null,
          params,
          status,
          errorMessage: errorMessage ? errorMessage.slice(0, 500) : null,
          tencentSerialNo: tencentSerialNo
            ? tencentSerialNo.slice(0, 64)
            : null,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `写短信日志失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** 腾讯云要求 E.164 格式；大陆号去除 +86 / 86 前缀，仅留 11 位 */
  private normalizePhone(raw: string): string | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    const cleaned = trimmed.replace(/^\+?86/, '').replace(/\D/g, '');
    if (!/^1\d{10}$/.test(cleaned)) return null;
    return cleaned;
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  /**
   * 懒加载并缓存腾讯云 SMS Client；密钥/AppId 变化时自动重建。
   */
  private getClient(cfg: SmsRuntimeConfig): TencentSmsClient {
    const key = `${cfg.secretId}|${cfg.secretKey}|${cfg.sdkAppId}`;
    if (this.smsClient && this.smsClientKey === key) {
      return this.smsClient;
    }
    this.smsClient = new TencentSmsSdk.v20210111.Client({
      credential: {
        secretId: cfg.secretId!,
        secretKey: cfg.secretKey!,
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: { reqMethod: 'POST', reqTimeout: 30 },
      },
    });
    this.smsClientKey = key;
    return this.smsClient;
  }

  private async loadSmsConfig(): Promise<SmsRuntimeConfig> {
    const [
      enabledRaw,
      secretId,
      secretKey,
      sdkAppId,
      signName,
      tplMedication,
      tplFollowUp,
      dailyLimitRaw,
    ] = await Promise.all([
      this.getDbConfig('sms_enabled'),
      this.getDbConfig('tencent_sms_secret_id'),
      this.getDbConfig('tencent_sms_secret_key'),
      this.getDbConfig('tencent_sms_sdk_app_id'),
      this.getDbConfig('tencent_sms_sign_name'),
      this.getDbConfig('tencent_sms_template_medication_reminder'),
      this.getDbConfig('tencent_sms_template_follow_up_reminder'),
      this.getDbConfig('sms_daily_limit_per_phone'),
    ]);

    const parsedLimit = Number(dailyLimitRaw);
    return {
      enabled:
        this.parseBoolean(enabledRaw) ??
        this.parseBoolean(this.getEnv('TENCENT_SMS_ENABLED')) ??
        false,
      secretId: secretId || this.getEnv('TENCENT_SMS_SECRET_ID'),
      secretKey: secretKey || this.getEnv('TENCENT_SMS_SECRET_KEY'),
      sdkAppId: sdkAppId || this.getEnv('TENCENT_SMS_SDK_APP_ID'),
      signName: signName || this.getEnv('TENCENT_SMS_SIGN_NAME'),
      templates: {
        medication_reminder:
          tplMedication ||
          this.getEnv('TENCENT_SMS_TEMPLATE_MEDICATION_REMINDER'),
        follow_up_reminder:
          tplFollowUp || this.getEnv('TENCENT_SMS_TEMPLATE_FOLLOW_UP_REMINDER'),
      },
      dailyLimitPerPhone:
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
    };
  }

  private async getDbConfig(key: string): Promise<string | undefined> {
    const cfg = await this.configRepo.findOne({ where: { key } });
    const v = (cfg?.value ?? '').toString().trim();
    return v || undefined;
  }

  private getEnv(key: string): string | undefined {
    const v = (this.configService.get<string>(key) ?? '').toString().trim();
    return v || undefined;
  }

  private parseBoolean(raw?: string): boolean | undefined {
    if (raw === undefined || raw === null) return undefined;
    const v = String(raw).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return undefined;
  }
}
