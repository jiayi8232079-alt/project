import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { MedicineCatalog } from '../../entities/medicine-catalog.entity.js';
import { ReminderSeverity } from '../../entities/medication-reminder.entity.js';

export interface OcrParsedItem {
  medicineName: string;
  specification?: string;
  dosage?: string;
  instructions?: string;
  severity?: ReminderSeverity;
  defaultDosePerTime?: number;
  defaultTimesPerDay?: number;
  defaultUnit?: string;
  /** OCR 原始文本片段，前端需要时可展示"识别依据" */
  rawSnippet?: string;
}

export interface OcrParseResult {
  enabled: boolean;
  provider: string;
  hospital?: string;
  doctorName?: string;
  department?: string;
  issuedDate?: string;
  items: OcrParsedItem[];
  rawText?: string;
  stubbed?: boolean;
  errorMessage?: string;
}

/**
 * 处方 OCR：拍照 → 结构化药品清单。
 *
 * 落地策略：
 *  - 真实 OCR 接入（腾讯云 OCR / 百度医疗 OCR）由运营在 system_configs 里开启；
 *  - 未开启时仍然可调用本接口，返回 enabled=false + stubbed=true，
 *    同时把"药品名联想扫描"作为**退化方案**：
 *      对图片无法识别时，前端可继续手填，service 依然能按用户手填的
 *      药名去药品字典里匹配默认严重度/频次/单位。
 *  - 这样陪诊员在弱网/未开启 OCR 的情况下，至少还有"字典智能补全"托底。
 *
 * 字典增强（不需 OCR 即可用）：
 *  - `enrichByDictionary(rawItems)`: 输入 [{medicineName}] → 补全字典字段。
 *    小程序端在点"从药品库匹配"时调用，或 OCR stub 成功后自动调用。
 */
@Injectable()
export class PrescriptionOcrService {
  private readonly logger = new Logger(PrescriptionOcrService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(MedicineCatalog)
    private readonly medicineRepo: Repository<MedicineCatalog>,
  ) {}

  async parse(imageUrl: string): Promise<OcrParseResult> {
    const cfg = await this.loadConfig();
    if (!cfg.enabled || !cfg.provider || cfg.provider === 'disabled') {
      return {
        enabled: false,
        provider: 'disabled',
        items: [],
        stubbed: true,
        errorMessage: '处方 OCR 未接入，请手动录入药品',
      };
    }

    // 真实接入待补：根据 cfg.provider 调不同 SDK
    // 现在仅返回结构化的空壳，避免调用方报错。
    this.logger.warn(
      `[prescription-ocr stub] provider=${cfg.provider} imageUrl=${imageUrl} 未实装 SDK`,
    );
    return {
      enabled: true,
      provider: cfg.provider,
      items: [],
      stubbed: true,
      errorMessage: `${cfg.provider} OCR SDK 尚未接入（见 docs/medication-strict.md）`,
    };
  }

  /**
   * 药品字典补全：用已有 medicine_catalog 里的默认值把 items 填满。
   * 仅当 items[i].medicineName 能在字典里唯一命中时才 merge，否则保留原值。
   */
  async enrichByDictionary(items: OcrParsedItem[]): Promise<OcrParsedItem[]> {
    if (!items || items.length === 0) return [];
    const enriched: OcrParsedItem[] = [];
    for (const raw of items) {
      const name = String(raw?.medicineName || '').trim();
      if (!name) {
        enriched.push(raw);
        continue;
      }
      const match = await this.medicineRepo.findOne({
        where: [
          { name, enabled: 1 },
          { genericName: name, enabled: 1 },
        ],
      });
      if (!match) {
        enriched.push(raw);
        continue;
      }
      enriched.push({
        medicineName: name,
        specification: raw.specification || match.specification || undefined,
        severity: raw.severity || (match.severity as ReminderSeverity),
        defaultDosePerTime:
          raw.defaultDosePerTime ?? (Number(match.defaultDosePerTime ?? 0) || undefined),
        defaultTimesPerDay:
          raw.defaultTimesPerDay ?? match.defaultTimesPerDay ?? undefined,
        defaultUnit: raw.defaultUnit || match.defaultUnit || undefined,
        dosage: raw.dosage,
        instructions: raw.instructions || match.defaultInstructions || undefined,
        rawSnippet: raw.rawSnippet,
      });
    }
    return enriched;
  }

  /** 模糊搜索（供小程序输入补全时用） */
  async searchMedicine(keyword: string, limit = 10) {
    if (!keyword || keyword.length < 1) return [];
    return this.medicineRepo.find({
      where: [
        { name: Like(`%${keyword}%`), enabled: 1 },
        { genericName: Like(`%${keyword}%`), enabled: 1 },
      ],
      take: Math.min(50, limit),
      order: { severity: 'ASC' },
    });
  }

  private async loadConfig() {
    const rows = await this.configRepo
      .createQueryBuilder('c')
      .where('c.key IN (:...keys)', {
        keys: [
          'prescription_ocr_enabled',
          'prescription_ocr_provider',
          'prescription_ocr_secret_id',
          'prescription_ocr_secret_key',
          'prescription_ocr_region',
        ],
      })
      .getMany();
    const map = new Map(rows.map((r) => [r.key, (r.value || '').trim()]));
    const enabledRaw = (map.get('prescription_ocr_enabled') || '').toLowerCase();
    const enabled = ['true', '1', 'yes', 'on'].includes(enabledRaw);
    return {
      enabled,
      provider: (map.get('prescription_ocr_provider') || 'disabled').toLowerCase(),
      secretId: map.get('prescription_ocr_secret_id') || '',
      secretKey: map.get('prescription_ocr_secret_key') || '',
      region: map.get('prescription_ocr_region') || 'ap-guangzhou',
    };
  }
}
