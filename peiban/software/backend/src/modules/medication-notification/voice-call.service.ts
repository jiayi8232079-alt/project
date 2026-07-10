import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';

export interface VoiceCallPayload {
  phone: string;
  /** 播报文案，供 TTS 合成 */
  text: string;
  /** 业务 ref，便于回执对账 */
  bizRef?: string;
}

export interface VoiceCallResult {
  success: boolean;
  provider: string;
  providerRef?: string;
  errorMessage?: string;
  stubbed?: boolean;
}

/**
 * 语音电话接口位。
 *
 * 为什么做成服务：HIGH 药品漏服连 SMS 都没送达时，必须打电话叫老人。
 * 真实接入成本较高（腾讯云 VMS / 阿里云 VoiceCall），这里提供：
 *   - 统一 `call()` API；
 *   - provider 可配（tencent / aliyun / stub）；
 *   - 未配置时走 stub（只写 log，返回 success=false, stubbed=true），
 *     让 worker 能把 job 标 DEAD 并在送达率看板体现"电话渠道不可用"，
 *     避免真付费发短信 / 订阅消息已送达时误触发。
 *
 * 当运营在系统配置里填好 `voice_call_provider=tencent` + 对应密钥后，
 * 此服务自动激活，无须重启。
 */
@Injectable()
export class VoiceCallService {
  private readonly logger = new Logger(VoiceCallService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
  ) {}

  async call(payload: VoiceCallPayload): Promise<VoiceCallResult> {
    const cfg = await this.loadConfig();
    if (!cfg.enabled || !cfg.provider || cfg.provider === 'stub') {
      this.logger.warn(
        `[voice_call stub] phone=${this.maskPhone(payload.phone)} reason=未配置 provider / 开关关闭`,
      );
      return {
        success: false,
        provider: 'stub',
        errorMessage: '语音电话渠道未接入',
        stubbed: true,
      };
    }
    if (cfg.provider === 'tencent') {
      return this.callTencent(payload, cfg);
    }
    if (cfg.provider === 'aliyun') {
      return this.callAliyun(payload, cfg);
    }
    return {
      success: false,
      provider: cfg.provider,
      errorMessage: `未知 provider: ${cfg.provider}`,
    };
  }

  /**
   * 腾讯云 VMS 语音模板发起通话。
   *
   * NOTE: 这里保留调用形态但不实装 SDK——生产上线时请：
   *   1) 申请腾讯云语音通知应用，获得 SdkAppId / TemplateId
   *   2) npm 安装 `tencentcloud-sdk-nodejs-vms`
   *   3) 把 this.logger.warn 替换为真实 SDK.SendTtsVoice 调用
   * 这样一次接入整个升级链即刻激活。
   */
  private async callTencent(
    payload: VoiceCallPayload,
    _cfg: VoiceCallConfig,
  ): Promise<VoiceCallResult> {
    this.logger.warn(
      `[voice_call tencent stub] phone=${this.maskPhone(payload.phone)} text=${payload.text.slice(0, 40)}...`,
    );
    return {
      success: false,
      provider: 'tencent',
      errorMessage: 'tencentcloud-sdk-nodejs-vms 尚未接入（见 docs/medication-strict.md）',
      stubbed: true,
    };
  }

  /** 阿里云 VoiceCall 接口预留位，同 tencent 策略。 */
  private async callAliyun(
    payload: VoiceCallPayload,
    _cfg: VoiceCallConfig,
  ): Promise<VoiceCallResult> {
    this.logger.warn(
      `[voice_call aliyun stub] phone=${this.maskPhone(payload.phone)} text=${payload.text.slice(0, 40)}...`,
    );
    return {
      success: false,
      provider: 'aliyun',
      errorMessage: '阿里云 VoiceCall SDK 尚未接入',
      stubbed: true,
    };
  }

  private async loadConfig(): Promise<VoiceCallConfig> {
    const rows = await this.configRepo
      .createQueryBuilder('c')
      .where('c.key IN (:...keys)', {
        keys: [
          'voice_call_enabled',
          'voice_call_provider',
          'voice_call_secret_id',
          'voice_call_secret_key',
          'voice_call_template_id',
          'voice_call_sign_name',
        ],
      })
      .getMany();
    const map = new Map(rows.map((r) => [r.key, (r.value || '').trim()]));
    const enabledRaw = (map.get('voice_call_enabled') || '').toLowerCase();
    const enabled = ['true', '1', 'yes', 'on'].includes(enabledRaw);
    return {
      enabled,
      provider: (map.get('voice_call_provider') || 'stub').toLowerCase(),
      secretId: map.get('voice_call_secret_id') || '',
      secretKey: map.get('voice_call_secret_key') || '',
      templateId: map.get('voice_call_template_id') || '',
      signName: map.get('voice_call_sign_name') || '',
    };
  }

  private maskPhone(raw: string): string {
    const cleaned = String(raw || '').replace(/\D/g, '');
    if (cleaned.length < 7) return cleaned;
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-4)}`;
  }
}

interface VoiceCallConfig {
  enabled: boolean;
  provider: string;
  secretId: string;
  secretKey: string;
  templateId: string;
  signName: string;
}
