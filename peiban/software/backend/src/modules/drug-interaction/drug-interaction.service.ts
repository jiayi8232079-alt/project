import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  DrugInteractionRule,
  DrugInteractionSeverity,
} from '../../entities/drug-interaction-rule.entity.js';
import {
  DrugInteractionFinding,
  PrescriptionRiskReport,
  RiskReportLevel,
  RiskReportPayload,
  RiskReportScope,
} from '../../entities/prescription-risk-report.entity.js';
import { MedicationPrescription } from '../../entities/medication-prescription.entity.js';
import {
  MedicationReminder,
  ReminderStatus,
  ReminderType,
} from '../../entities/medication-reminder.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { SystemService } from '../system/system.service.js';
import { BUILTIN_DRUG_INTERACTION_RULES } from './drug-interaction-rules.seed.js';
import { UserRole } from '../../common/enums/index.js';

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  temperature: number;
  maxTokens: number;
};

const CONFIG_KEYS = {
  apiKey: 'ai_api_key',
  baseUrl: 'ai_base_url',
  model: 'ai_model',
  enabled: 'ai_enabled',
  temperature: 'ai_temperature',
  maxTokens: 'ai_max_tokens',
} as const;

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';
const DEFAULT_MODEL = 'qwen2.5:7b';

const LLM_SYSTEM_PROMPT = `你是一位有经验的临床药师，负责为"陪了个伴"平台的家庭用户做用药组合安全性评估。

## 任务
接收用户正在服用的完整药物清单 + 服务对象健康档案，评估**除系统规则库已命中之外**的相互作用风险。

## 要求
- **不要重复**在 "alreadyFoundPairs" 中列出的已命中药物对。
- 发现的相互作用严重等级必须是以下之一：high / medium / low。
- 只保留**有明确证据**的组合，宁可少报不过度报。
- 描述要通俗易懂（给老人家属看的，不是医生），机制一两句说清，避免专业术语堆砌。
- 同一对药物只输出一次。
- 如果没有明显风险，findings 返回空数组。

## 严格 JSON 输出（不要 markdown 包裹）：
{
  "findings": [
    {
      "drugA": "与输入药名一致的文字",
      "drugB": "与输入药名一致的文字",
      "severity": "high|medium|low",
      "mechanism": "通俗解释为什么有风险（40字以内）",
      "recommendation": "给家属或护理人员的处理建议（40字以内）"
    }
  ],
  "summary": "整体用药安全性概述（80字以内），应提示家属该如何观察与何时就医"
}`;

@Injectable()
export class DrugInteractionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DrugInteractionService.name);

  constructor(
    @InjectRepository(DrugInteractionRule)
    private readonly ruleRepo: Repository<DrugInteractionRule>,
    @InjectRepository(PrescriptionRiskReport)
    private readonly reportRepo: Repository<PrescriptionRiskReport>,
    @InjectRepository(MedicationPrescription)
    private readonly prescriptionRepo: Repository<MedicationPrescription>,
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    private readonly systemService: SystemService,
  ) {}

  /**
   * 首次启动：写入内置规则（source=builtin）。
   * 已存在的 A+B 组合不会重复插入（按规范化药名判断）。
   */
  async onApplicationBootstrap() {
    try {
      const existing = await this.ruleRepo.find({ where: { source: 'builtin' } });
      const existingKeys = new Set(
        existing.map((r) => this.pairKey(r.drugA, r.drugB)),
      );

      const toInsert: DrugInteractionRule[] = [];
      for (const rule of BUILTIN_DRUG_INTERACTION_RULES) {
        const key = this.pairKey(rule.drugA, rule.drugB);
        if (existingKeys.has(key)) continue;
        const entity = this.ruleRepo.create({
          drugA: rule.drugA,
          drugB: rule.drugB,
          drugAAliases: rule.drugAAliases,
          drugBAliases: rule.drugBAliases,
          severity: rule.severity,
          mechanism: rule.mechanism,
          recommendation: rule.recommendation,
          evidenceLevel: rule.evidenceLevel,
          enabled: true,
          source: 'builtin',
        });
        toInsert.push(entity);
      }

      if (toInsert.length > 0) {
        await this.ruleRepo.save(toInsert);
        this.logger.log(
          `Drug interaction rules seeded: +${toInsert.length} (total builtin=${existing.length + toInsert.length})`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `drug-interaction seed skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ───────────────── 公共入口 ─────────────────

  async assessPrescription(
    prescriptionId: number,
    operator: { id: number; role: string },
  ): Promise<PrescriptionRiskReport> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: ['reminders', 'serviceTarget'],
    });
    if (!prescription) throw new NotFoundException('处方不存在');

    await this.assertPrescriptionAccess(prescription, operator);

    const medicines = (prescription.reminders || []).map((r) => ({
      medicineName: r.medicineName,
      reminderId: r.id,
      prescriptionId: prescription.id,
      dosage: r.dosage || null,
      severity: r.severity || null,
    }));

    if (medicines.length === 0) {
      throw new BadRequestException('处方下没有可评估的用药，无法检测相互作用');
    }

    const target = prescription.serviceTarget || null;
    const payload = await this.runAssessment(medicines, target);

    return this.upsertReport({
      scope: RiskReportScope.PRESCRIPTION,
      userId: prescription.userId,
      serviceTargetId: prescription.serviceTargetId,
      prescriptionId: prescription.id,
      assessedBy: operator.id,
      payload,
    });
  }

  async assessServiceTarget(
    serviceTargetId: number,
    operator: { id: number; role: string },
  ): Promise<PrescriptionRiskReport> {
    const target = await this.targetRepo.findOne({ where: { id: serviceTargetId } });
    if (!target) throw new NotFoundException('服务对象不存在');

    await this.assertTargetAccess(target, operator);

    const reminders = await this.reminderRepo.find({
      where: {
        serviceTargetId: target.id,
        reminderType: ReminderType.MEDICATION,
        status: ReminderStatus.ACTIVE,
      },
    });

    const dedupMap = new Map<string, typeof reminders[number]>();
    for (const r of reminders) {
      const key = this.normalizeMedName(r.medicineName);
      if (!dedupMap.has(key)) dedupMap.set(key, r);
    }
    const dedupedReminders = Array.from(dedupMap.values());

    const medicines = dedupedReminders.map((r) => ({
      medicineName: r.medicineName,
      reminderId: r.id,
      prescriptionId: r.prescriptionId ?? null,
      dosage: r.dosage || null,
      severity: r.severity || null,
    }));

    if (medicines.length === 0) {
      throw new BadRequestException('该服务对象当前没有正在服用的药物');
    }

    const payload = await this.runAssessment(medicines, target);

    return this.upsertReport({
      scope: RiskReportScope.TARGET,
      userId: target.userId,
      serviceTargetId: target.id,
      prescriptionId: null,
      assessedBy: operator.id,
      payload,
    });
  }

  async getLatestByPrescription(
    prescriptionId: number,
    operator: { id: number; role: string },
  ): Promise<PrescriptionRiskReport | null> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
    });
    if (!prescription) throw new NotFoundException('处方不存在');
    await this.assertPrescriptionAccess(prescription, operator);

    return this.reportRepo.findOne({
      where: {
        scope: RiskReportScope.PRESCRIPTION,
        prescriptionId,
      },
      order: { assessedAt: 'DESC' },
    });
  }

  async getLatestByTarget(
    serviceTargetId: number,
    operator: { id: number; role: string },
  ): Promise<PrescriptionRiskReport | null> {
    const target = await this.targetRepo.findOne({ where: { id: serviceTargetId } });
    if (!target) throw new NotFoundException('服务对象不存在');
    await this.assertTargetAccess(target, operator);

    return this.reportRepo.findOne({
      where: {
        scope: RiskReportScope.TARGET,
        serviceTargetId,
      },
      order: { assessedAt: 'DESC' },
    });
  }

  // ───────────────── 管理后台 CRUD 规则 ─────────────────

  async listRules(query?: {
    page?: number;
    pageSize?: number;
    severity?: DrugInteractionSeverity;
    enabled?: boolean;
    keyword?: string;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const qb = this.ruleRepo.createQueryBuilder('r');

    if (query?.severity) qb.andWhere('r.severity = :s', { s: query.severity });
    if (typeof query?.enabled === 'boolean')
      qb.andWhere('r.enabled = :e', { e: query.enabled });
    if (query?.keyword) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere('(r.drug_a LIKE :kw OR r.drug_b LIKE :kw)', { kw });
    }

    qb.orderBy('r.severity', 'ASC').addOrderBy('r.id', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async createRule(dto: {
    drugA: string;
    drugB: string;
    drugAAliases: string[];
    drugBAliases: string[];
    severity: DrugInteractionSeverity;
    mechanism: string;
    recommendation: string;
    evidenceLevel?: 'A' | 'B' | 'C' | null;
  }): Promise<DrugInteractionRule> {
    const entity = this.ruleRepo.create({
      drugA: dto.drugA.trim(),
      drugB: dto.drugB.trim(),
      drugAAliases: (dto.drugAAliases || []).map((s) => s.trim()).filter(Boolean),
      drugBAliases: (dto.drugBAliases || []).map((s) => s.trim()).filter(Boolean),
      severity: dto.severity,
      mechanism: dto.mechanism.trim(),
      recommendation: dto.recommendation.trim(),
      evidenceLevel: dto.evidenceLevel ?? null,
      enabled: true,
      source: 'custom',
    });
    return this.ruleRepo.save(entity);
  }

  async updateRule(
    id: number,
    dto: Partial<{
      drugA: string;
      drugB: string;
      drugAAliases: string[];
      drugBAliases: string[];
      severity: DrugInteractionSeverity;
      mechanism: string;
      recommendation: string;
      evidenceLevel: 'A' | 'B' | 'C' | null;
      enabled: boolean;
    }>,
  ): Promise<DrugInteractionRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('规则不存在');
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async deleteRule(id: number): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('规则不存在');
    if (rule.source === 'builtin') {
      throw new BadRequestException('内置规则不可删除，可将其设为禁用');
    }
    await this.ruleRepo.delete(id);
  }

  // ───────────────── 核心评估逻辑 ─────────────────

  private async runAssessment(
    medicines: RiskReportPayload['medicines'],
    target: ServiceTarget | null,
  ): Promise<RiskReportPayload> {
    const ruleFindings = await this.scanByRules(medicines);
    const alreadyFoundPairs = ruleFindings.map((f) => [f.drugA, f.drugB] as const);

    let llmFindings: DrugInteractionFinding[] = [];
    let llmSummary = '';
    let llmTokensUsed: number | null = null;
    let llmFallback = false;
    let llmModel: string | undefined;

    const llmConfig = await this.getLlmConfig();
    if (llmConfig.enabled && llmConfig.apiKey) {
      try {
        const result = await this.runLlm(medicines, target, alreadyFoundPairs, llmConfig);
        llmFindings = result.findings;
        llmSummary = result.summary;
        llmTokensUsed = result.tokensUsed;
        llmModel = llmConfig.model;
      } catch (e) {
        this.logger.warn(
          `LLM assessment failed, falling back to rules only: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        llmFallback = true;
      }
    } else {
      llmFallback = true;
    }

    const allFindings = this.mergeFindings(ruleFindings, llmFindings);
    const riskLevel = this.computeOverallRisk(allFindings);

    const finalSummary =
      llmSummary ||
      this.buildFallbackSummary(allFindings, riskLevel, target);

    return {
      medicines,
      findings: allFindings,
      summary: finalSummary,
      model: llmModel,
      tokensUsed: llmTokensUsed,
      llmFallback,
    };
  }

  private async scanByRules(
    medicines: RiskReportPayload['medicines'],
  ): Promise<DrugInteractionFinding[]> {
    const rules = await this.ruleRepo.find({ where: { enabled: true } });
    const findings: DrugInteractionFinding[] = [];

    const seen = new Set<string>();

    for (let i = 0; i < medicines.length; i++) {
      for (let j = i + 1; j < medicines.length; j++) {
        const a = medicines[i].medicineName;
        const b = medicines[j].medicineName;
        for (const rule of rules) {
          const match = this.matchRule(a, b, rule);
          if (!match) continue;
          const key = this.pairKey(a, b) + `#${rule.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          findings.push({
            drugA: a,
            drugB: b,
            severity: rule.severity,
            mechanism: rule.mechanism,
            recommendation: rule.recommendation,
            source: 'rule',
            ruleId: rule.id,
            evidenceLevel: rule.evidenceLevel ?? undefined,
          });
        }
      }
    }

    return findings;
  }

  private matchRule(
    medA: string,
    medB: string,
    rule: DrugInteractionRule,
  ): boolean {
    const aInA = this.medicineMatchesAliases(medA, rule.drugAAliases || []);
    const bInB = this.medicineMatchesAliases(medB, rule.drugBAliases || []);
    const aInB = this.medicineMatchesAliases(medA, rule.drugBAliases || []);
    const bInA = this.medicineMatchesAliases(medB, rule.drugAAliases || []);
    return (aInA && bInB) || (aInB && bInA);
  }

  private medicineMatchesAliases(medicineName: string, aliases: string[]): boolean {
    if (!medicineName || aliases.length === 0) return false;
    const m = medicineName.toLowerCase();
    for (const alias of aliases) {
      if (!alias) continue;
      if (m.includes(alias.toLowerCase())) return true;
    }
    return false;
  }

  private normalizeMedName(name: string): string {
    return (name || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  private pairKey(a: string, b: string): string {
    const [x, y] = [this.normalizeMedName(a), this.normalizeMedName(b)].sort();
    return `${x}|${y}`;
  }

  private mergeFindings(
    ruleFindings: DrugInteractionFinding[],
    llmFindings: DrugInteractionFinding[],
  ): DrugInteractionFinding[] {
    const out: DrugInteractionFinding[] = [...ruleFindings];
    const coveredPairs = new Set(out.map((f) => this.pairKey(f.drugA, f.drugB)));
    for (const f of llmFindings) {
      const key = this.pairKey(f.drugA, f.drugB);
      if (coveredPairs.has(key)) continue;
      coveredPairs.add(key);
      out.push(f);
    }
    const weight: Record<DrugInteractionFinding['severity'], number> = {
      high: 3,
      medium: 2,
      low: 1,
    };
    out.sort((a, b) => weight[b.severity] - weight[a.severity]);
    return out;
  }

  private computeOverallRisk(findings: DrugInteractionFinding[]): RiskReportLevel {
    if (findings.length === 0) return RiskReportLevel.NONE;
    if (findings.some((f) => f.severity === 'high')) return RiskReportLevel.HIGH;
    if (findings.some((f) => f.severity === 'medium')) return RiskReportLevel.MEDIUM;
    return RiskReportLevel.LOW;
  }

  private buildFallbackSummary(
    findings: DrugInteractionFinding[],
    level: RiskReportLevel,
    target: ServiceTarget | null,
  ): string {
    const who = target?.name ? `${target.name}的` : '当前';
    if (findings.length === 0) {
      return `${who}用药组合未命中已知高风险相互作用规则；建议定期复评。`;
    }
    const nameMap: Record<RiskReportLevel, string> = {
      [RiskReportLevel.HIGH]: '高风险',
      [RiskReportLevel.MEDIUM]: '中风险',
      [RiskReportLevel.LOW]: '低风险',
      [RiskReportLevel.NONE]: '无风险',
    };
    return `${who}用药组合经规则库比对共发现 ${findings.length} 条相互作用，整体${nameMap[level]}。建议家属留意异常征兆并及时告知医生。`;
  }

  // ───────────────── LLM 调用 ─────────────────

  private async getLlmConfig(): Promise<LlmConfig> {
    const [apiKey, baseUrl, model, enabled, temperature, maxTokens] = await Promise.all([
      this.systemService.getConfig(CONFIG_KEYS.apiKey),
      this.systemService.getConfig(CONFIG_KEYS.baseUrl),
      this.systemService.getConfig(CONFIG_KEYS.model),
      this.systemService.getConfig(CONFIG_KEYS.enabled),
      this.systemService.getConfig(CONFIG_KEYS.temperature),
      this.systemService.getConfig(CONFIG_KEYS.maxTokens),
    ]);
    return {
      apiKey: apiKey || '',
      baseUrl: baseUrl || DEFAULT_BASE_URL,
      model: model || DEFAULT_MODEL,
      enabled: enabled !== 'false',
      temperature: temperature ? Number(temperature) : 0.2,
      maxTokens: maxTokens ? Number(maxTokens) : 1500,
    };
  }

  private async runLlm(
    medicines: RiskReportPayload['medicines'],
    target: ServiceTarget | null,
    alreadyFoundPairs: ReadonlyArray<readonly [string, string]>,
    config: LlmConfig,
  ): Promise<{
    findings: DrugInteractionFinding[];
    summary: string;
    tokensUsed: number | null;
  }> {
    const userContext = this.buildTargetContext(target);
    const drugList = medicines.map((m, i) => {
      const extra = m.dosage ? `（${m.dosage}）` : '';
      return `${i + 1}. ${m.medicineName}${extra}`;
    });

    const userPayload = {
      medicines: medicines.map((m) => ({
        name: m.medicineName,
        dosage: m.dosage || '',
      })),
      patientContext: userContext,
      alreadyFoundPairs: alreadyFoundPairs.map(([a, b]) => ({ drugA: a, drugB: b })),
    };

    const userMessage = [
      `请评估以下药物清单的相互作用风险。`,
      ``,
      `# 药物清单（${medicines.length}味）`,
      ...drugList,
      ``,
      `# 服务对象信息`,
      userContext || '（未提供）',
      ``,
      `# 已通过规则库命中（不要重复）`,
      alreadyFoundPairs.length === 0
        ? '无'
        : alreadyFoundPairs.map(([a, b]) => `- ${a} + ${b}`).join('\n'),
      ``,
      `请基于以上信息，按要求的 JSON 结构输出分析结果。`,
      ``,
      `原始结构化数据：${JSON.stringify(userPayload)}`,
    ].join('\n');

    const messages = [
      { role: 'system' as const, content: LLM_SYSTEM_PROMPT },
      { role: 'user' as const, content: userMessage },
    ];

    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = JSON.stringify({
      model: config.model,
      messages,
      temperature: Math.min(0.3, config.temperature),
      max_tokens: config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM 返回结果为空');

    const parsed = this.parseLlmJson(content);
    const findings: DrugInteractionFinding[] = [];
    for (const raw of parsed.findings || []) {
      if (!raw || !raw.drugA || !raw.drugB) continue;
      const severity = this.normalizeSeverity(raw.severity);
      if (!severity) continue;
      findings.push({
        drugA: String(raw.drugA).trim(),
        drugB: String(raw.drugB).trim(),
        severity,
        mechanism: String(raw.mechanism || '').trim(),
        recommendation: String(raw.recommendation || '').trim(),
        source: 'llm',
      });
    }

    return {
      findings,
      summary: String(parsed.summary || '').trim(),
      tokensUsed: data?.usage?.total_tokens ?? null,
    };
  }

  private parseLlmJson(raw: string): { findings?: any[]; summary?: string } {
    const cleaned = String(raw).replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          /* noop */
        }
      }
      return {};
    }
  }

  private normalizeSeverity(s: any): 'high' | 'medium' | 'low' | null {
    const v = String(s || '').trim().toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') return v;
    if (v === '高' || v === '高风险') return 'high';
    if (v === '中' || v === '中风险') return 'medium';
    if (v === '低' || v === '低风险') return 'low';
    return null;
  }

  private buildTargetContext(target: ServiceTarget | null): string {
    if (!target) return '';
    const parts: string[] = [];
    if (target.name) parts.push(`姓名：${target.name}`);
    if (target.gender) {
      parts.push(
        `性别：${target.gender === 'male' ? '男' : target.gender === 'female' ? '女' : target.gender}`,
      );
    }
    if (target.age != null) parts.push(`年龄：${target.age}岁`);

    const hp: any = target.healthProfile || {};
    if (hp.allergies && hp.allergies !== '无') parts.push(`过敏史：${hp.allergies}`);

    const historyLabels: Record<string, string> = {
      hypertension: '高血压',
      heart: '心脏病',
      cerebrovascular: '脑血管疾病',
      diabetes: '糖尿病',
      epilepsy: '癫痫',
      asthma: '哮喘',
      mental: '精神疾病',
      cancer: '癌症',
      other: '其他',
    };
    const histArr = (hp.medicalHistory || []).filter(
      (v: string) => v && v !== 'none',
    );
    if (histArr.length) {
      parts.push(
        `既往病史：${histArr.map((v: string) => historyLabels[v] || v).join('、')}`,
      );
    }
    if (hp.medicalHistoryOther) parts.push(`其他病史：${hp.medicalHistoryOther}`);
    if (hp.currentMedications) parts.push(`其他在用药：${hp.currentMedications}`);

    return parts.join('；');
  }

  // ───────────────── 持久化 ─────────────────

  private async upsertReport(params: {
    scope: RiskReportScope;
    userId: number;
    serviceTargetId: number | null;
    prescriptionId: number | null;
    assessedBy: number | null;
    payload: RiskReportPayload;
  }): Promise<PrescriptionRiskReport> {
    const riskLevel = this.computeOverallRisk(params.payload.findings);
    const findingsCount = params.payload.findings.length;

    const where =
      params.scope === RiskReportScope.PRESCRIPTION
        ? { scope: params.scope, prescriptionId: params.prescriptionId ?? undefined }
        : {
            scope: params.scope,
            serviceTargetId: params.serviceTargetId ?? undefined,
          };

    const existing = await this.reportRepo.findOne({ where: where as any });

    if (existing) {
      existing.riskLevel = riskLevel;
      existing.findingsCount = findingsCount;
      existing.payload = params.payload;
      existing.userId = params.userId;
      existing.serviceTargetId = params.serviceTargetId;
      existing.prescriptionId = params.prescriptionId;
      existing.assessedBy = params.assessedBy;
      existing.assessedAt = new Date();
      return this.reportRepo.save(existing);
    }

    const entity = this.reportRepo.create({
      scope: params.scope,
      userId: params.userId,
      serviceTargetId: params.serviceTargetId,
      prescriptionId: params.prescriptionId,
      riskLevel,
      findingsCount,
      payload: params.payload,
      assessedBy: params.assessedBy,
      assessedAt: new Date(),
    });
    return this.reportRepo.save(entity);
  }

  // ───────────────── 权限 ─────────────────

  private isAdminLikeRole(role?: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT
    );
  }

  private async assertPrescriptionAccess(
    prescription: MedicationPrescription,
    operator: { id: number; role: string },
  ) {
    if (this.isAdminLikeRole(operator.role)) return;
    if (prescription.userId !== operator.id) {
      throw new ForbiddenException('无权访问该处方的用药风险评估');
    }
  }

  private async assertTargetAccess(
    target: ServiceTarget,
    operator: { id: number; role: string },
  ) {
    if (this.isAdminLikeRole(operator.role)) return;
    if (target.userId !== operator.id) {
      throw new ForbiddenException('无权访问该服务对象的用药风险评估');
    }
  }
}
