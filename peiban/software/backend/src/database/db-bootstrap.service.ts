import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HospitalService } from '../modules/hospital/hospital.service.js';
import { SystemService } from '../modules/system/system.service.js';

/**
 * 首次部署：在空库上补充 system_configs 默认值 + 医院骨架名录（代码内种子，随仓库发布）。
 * 开启方式：环境变量 AUTO_BOOTSTRAP_DEFAULT_DATA=true
 *
 * 表结构：生产环境默认 synchronize=false，需先有一次可用表结构（见 DB_SYNCHRONIZE 说明）。
 */
@Injectable()
export class DbBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly hospitalService: HospitalService,
    private readonly systemService: SystemService,
  ) {}

  async onApplicationBootstrap() {
    const flag = this.configService
      .get<string>('AUTO_BOOTSTRAP_DEFAULT_DATA', '')
      ?.trim()
      .toLowerCase();
    if (flag !== 'true' && flag !== '1' && flag !== 'yes') {
      return;
    }

    this.logger.log(
      'AUTO_BOOTSTRAP_DEFAULT_DATA: writing missing system defaults and hospital seeds where applicable…',
    );

    try {
      await this.ensureSystemDefaults();
      await this.ensureHospitalSeeds();
      this.logger.log('AUTO_BOOTSTRAP_DEFAULT_DATA: done.');
    } catch (e) {
      this.logger.error(
        `AUTO_BOOTSTRAP_DEFAULT_DATA failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }

  private async ensureSystemDefaults() {
    const defaults: { key: string; value: string; description?: string }[] = [
      { key: 'store_name', value: '陪了个伴', description: '门店名称' },
      { key: 'ai_enabled', value: 'false', description: 'AI 问诊功能开关' },
      {
        key: 'miniprogram_show_ai_triage',
        value: 'true',
        description: '小程序展示「AI 智能导诊」入口（关则 C 端隐藏且接口拒绝）',
      },
      {
        key: 'miniprogram_show_ai_advisor',
        value: 'true',
        description: '小程序展示「AI 健康顾问」入口（关则 C 端隐藏且问诊相关接口拒绝；健康周报不受此键控制）',
      },
      {
        key: 'ai_base_url',
        value: 'http://127.0.0.1:11434/v1',
        description: 'AI API 地址',
      },
      { key: 'ai_model', value: 'qwen2.5:7b', description: 'AI 模型名称' },
      {
        key: 'ai_vision_model',
        value: '',
        description: 'AI 视觉模型（健康材料读图；留空则不附图像素）',
      },
      { key: 'ai_vision_api_key', value: '', description: '读图专用 API Key（留空则用 ai_api_key）' },
      { key: 'ai_vision_base_url', value: '', description: '读图专用 API 地址（留空则用 ai_base_url）' },
      { key: 'ai_temperature', value: '0.3', description: 'AI temperature' },
      { key: 'ai_max_tokens', value: '2048', description: 'AI max_tokens' },
      { key: 'ai_system_prompt', value: '', description: 'AI 系统提示词（可后台再填）' },
      {
        key: 'consultation_slot_rule',
        value: '[]',
        description: '号源规则 JSON（空数组表示未配置）',
      },
      { key: 'cancel_rules', value: '[]', description: '取消规则 JSON' },
    ];

    for (const row of defaults) {
      const existing = await this.systemService.getConfig(row.key);
      if (existing === null) {
        await this.systemService.setConfig(row.key, row.value, row.description);
        this.logger.log(`system_configs: inserted default key=${row.key}`);
      }
    }
  }

  private async ensureHospitalSeeds() {
    const merge =
      this.configService
        .get<string>('BOOTSTRAP_MERGE_HOSPITAL_SEEDS', '')
        ?.trim()
        .toLowerCase() === 'true';

    const count = await this.hospitalService.countHospitals();

    if (count === 0) {
      const r1 = await this.hospitalService.seedLishuiWenzhouIfEmpty();
      this.logger.log(
        `hospitals seed Lishui+Wenzhou (empty table): ${JSON.stringify(r1)}`,
      );
      const r2 = await this.hospitalService.seedHangzhouShanghaiAppend();
      this.logger.log(
        `hospitals seed Hangzhou+Shanghai (append): ${JSON.stringify(r2)}`,
      );
      return;
    }

    if (merge) {
      const r0 = await this.hospitalService.seedLishuiWenzhouAppend();
      this.logger.log(
        `hospitals seed Lishui+Wenzhou (merge): ${JSON.stringify(r0)}`,
      );
      const r2 = await this.hospitalService.seedHangzhouShanghaiAppend();
      this.logger.log(
        `hospitals seed Hangzhou+Shanghai (append): ${JSON.stringify(r2)}`,
      );
    } else {
      this.logger.log(
        `hospitals: skipped seeding (table already has ${count} rows). Set BOOTSTRAP_MERGE_HOSPITAL_SEEDS=true to merge missing skeleton rows.`,
      );
    }
  }
}
