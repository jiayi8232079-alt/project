import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TriageSession } from '../../entities/triage-session.entity.js';
import { TriageSessionMessage } from '../../entities/triage-session-message.entity.js';
import { TriageFeedback } from '../../entities/triage-feedback.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { Order } from '../../entities/order.entity.js';
import { User } from '../../entities/user.entity.js';
import { Hospital } from '../../entities/hospital.entity.js';
import { SystemService } from '../system/system.service.js';

import { CreateTriageDto } from './dto/create-triage.dto.js';
import { CreateTriageFeedbackDto } from './dto/triage-feedback.dto.js';
import { PostTriageMessageDto } from './dto/post-triage-message.dto.js';
import { ConvertTriageOrderDto } from './dto/convert-triage-order.dto.js';
import { evaluateRedFlags, RedFlagResult } from './triage-rule.engine.js';
import { inferSceneAndRoute } from './triage-route.mapper.js';
import { OrderStatus } from '../../common/enums/index.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

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

// ─── 导诊专用 System Prompt ──────────────────────────────

const TRIAGE_SYSTEM_PROMPT = `你是慧诊通的AI智能导诊与服务分流助手，不是医生，也不进行医学诊断。你的任务是根据用户提供的年龄、症状、既往病史、就医目标、家庭场景等信息，完成以下工作：
1. 识别主要问题与场景类型；
2. 输出推荐科室和就医准备事项；
3. 判断更适合进入哪条服务路径（电话评估、上门评估、门诊陪诊、体检规划、专家匹配、住院协调、7天包、30天包等）；
4. 生成用户可读文本与结构化JSON；
5. 若存在高风险迹象，仅提示尽快线下就医或转人工，不输出诊断结论或处方建议。

严禁输出确定性诊断、药物处方、夸大性承诺。

请始终以如下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "risk_level": "R0|R1|R2|R3",
  "urgency_level": "普通|尽快|建议立即线下就医",
  "department_primary": "推荐主科室",
  "department_secondary": ["备选科室1", "备选科室2"],
  "scene_type": "普通门诊型|体检筛查型|专家会诊型|住院手术型|术后恢复型|慢病长期管理型",
  "service_route": ["电话评估", "门诊陪诊"],
  "recommended_product": "推荐的服务产品",
  "prep_checklist": ["身份证/医保卡", "近期检查报告", "当前药物清单"],
  "family_sync_needed": true,
  "escalate_to_human": false,
  "structured_summary": "面向运营人员的简要摘要（50字以内）",
  "safe_reply_text": "面向用户的安全建议文本（200字以内，通俗易懂，温暖专业）"
}`;

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    @InjectRepository(TriageSession)
    private readonly sessionRepo: Repository<TriageSession>,
    @InjectRepository(TriageSessionMessage)
    private readonly triageMessageRepo: Repository<TriageSessionMessage>,
    @InjectRepository(TriageFeedback)
    private readonly feedbackRepo: Repository<TriageFeedback>,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    private readonly systemService: SystemService,
  ) {}

  /** 运营关闭小程序「智能导诊」时，C 端相关接口统一拒绝 */
  private async assertMiniprogramTriageEnabled() {
    const v = await this.systemService.getConfig('miniprogram_show_ai_triage');
    if (v === 'false' || v === '0') {
      throw new BadRequestException('智能导诊功能已关闭');
    }
  }

  // ─── AI 配置（复用现有 SystemConfig） ──────────────────

  private async getAiConfig() {
    const [apiKey, baseUrl, model, enabled, temperature, maxTokens] =
      await Promise.all([
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
      maxTokens: maxTokens ? Number(maxTokens) : 2048,
    };
  }

  private async callLlm(messages: ChatMessage[], config: Awaited<ReturnType<typeof this.getAiConfig>>) {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (error) {
      this.logger.error(
        `LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`LLM API error ${res.status}: ${text}`);
      throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
    }
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new BadRequestException('AI 服务返回格式异常，请稍后重试');
    }
    const choice = data.choices?.[0];
    if (!choice?.message?.content) {
      throw new BadRequestException('AI 返回结果为空');
    }
    return {
      content: choice.message.content as string,
      tokensUsed: data.usage?.total_tokens ?? null,
      model: data.model ?? config.model,
    };
  }

  private parseLlmJson(raw: string): Record<string, any> {
    try {
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      this.logger.warn('LLM JSON 解析失败，使用降级结果');
      return {};
    }
  }

  // ─── 构建健康档案上下文 ────────────────────────────────

  private buildPatientContext(dto: CreateTriageDto, target?: ServiceTarget | null): string {
    const parts: string[] = [];
    parts.push(`咨询人身份：${dto.consultantRole}`);
    parts.push(`患者年龄：${dto.patientAge}岁`);
    parts.push(`患者性别：${dto.patientGender === 'male' ? '男' : dto.patientGender === 'female' ? '女' : '其他'}`);
    parts.push(`主要症状：${dto.mainSymptom}`);
    if (dto.symptomDuration) parts.push(`持续时间：${dto.symptomDuration}`);
    if (dto.severitySelf) parts.push(`自评严重程度：${dto.severitySelf}`);
    if (dto.medicalHistory?.length) parts.push(`既往病史：${dto.medicalHistory.join('、')}`);
    if (dto.currentMedication) parts.push(`当前用药：${dto.currentMedication}`);
    if (dto.hasExamResult) parts.push('已有体检/检查结果');
    if (dto.patientCity) parts.push(`所在城市：${dto.patientCity}`);
    if (dto.familyRemote) parts.push('家属异地/海外');
    if (dto.mobility && dto.mobility !== 'normal') parts.push(`行动能力：${dto.mobility === 'limited' ? '行动不便' : '卧床'}`);
    if (dto.livesAlone) parts.push('独居');
    if (dto.visitGoal) parts.push(`就医目标：${dto.visitGoal}`);
    if (dto.allergyInfo) parts.push(`过敏史：${dto.allergyInfo}`);
    if (dto.recentlyDischarged) parts.push('近期出院');

    // 补充档案信息
    if (target) {
      const hp: any = target.healthProfile || {};
      if (hp.bloodType) parts.push(`血型：${hp.bloodType}`);
      if (hp.currentMedication && !dto.currentMedication) parts.push(`档案用药：${hp.currentMedication}`);
    }

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════
  //  核心：提交导诊
  // ═══════════════════════════════════════════════════════

  async startTriage(userId: number, dto: CreateTriageDto) {
    await this.assertMiniprogramTriageEnabled();
    // 1. 查找/验证服务对象
    let target: ServiceTarget | null = null;
    if (dto.serviceTargetId) {
      target = await this.targetRepo.findOne({ where: { id: dto.serviceTargetId, userId } });
    }

    // 2. 规则引擎优先
    const ruleResult: RedFlagResult = evaluateRedFlags({
      mainSymptom: dto.mainSymptom,
      patientAge: dto.patientAge,
      severitySelf: dto.severitySelf,
      medicalHistory: dto.medicalHistory,
      mobility: dto.mobility,
      recentlyDischarged: dto.recentlyDischarged,
      visitGoal: dto.visitGoal,
    });

    // 3. 服务路径推荐（规则层先算一版）
    const routeResult = inferSceneAndRoute({
      riskLevel: ruleResult.riskLevel,
      visitGoal: dto.visitGoal,
      patientAge: dto.patientAge,
      mobility: dto.mobility,
      familyRemote: dto.familyRemote,
      recentlyDischarged: dto.recentlyDischarged,
      medicalHistory: dto.medicalHistory,
      mainSymptom: dto.mainSymptom,
      ruleHits: ruleResult.matchedRules,
    });

    // 4. 如果 R3 红旗命中 → 跳过 LLM，直接返回
    if (ruleResult.riskLevel === 'R3') {
      const session = await this.saveSession(userId, dto, target, {
        riskLevel: 'R3',
        urgencyLevel: ruleResult.urgencyLevel,
        sceneType: routeResult.sceneType,
        departmentPrimary: null,
        departmentSecondary: null,
        serviceRoute: routeResult.serviceRoute,
        recommendedProduct: routeResult.recommendedProduct,
        prepChecklist: ['身份证/医保卡', '近期检查报告', '当前药物清单'],
        familySyncNeeded: dto.familyRemote ?? false,
        escalateToHuman: true,
        structuredSummary: `红旗命中：${ruleResult.matchedRules.join('、')}`,
        safeReplyText: ruleResult.safeReplyOverride!,
        finalJson: { ruleResult, routeResult },
        modelName: 'rule-engine',
        ruleHits: ruleResult.matchedRules,
        tokensUsed: 0,
        status: 'escalated',
      });

      // 通知健康管家
      this.notifyEscalation(session).catch((e) => this.logger.warn('通知失败', e));

      return this.formatResponse(session, true);
    }

    // 5. 调用 LLM
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) {
      throw new BadRequestException('AI 服务尚未配置，请联系管理员');
    }

    const patientContext = this.buildPatientContext(dto, target);
    const messages: ChatMessage[] = [
      { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
      { role: 'user', content: `请根据以下患者信息进行导诊分流：\n\n${patientContext}` },
    ];

    const llmResult = await this.callLlm(messages, config);
    const parsed = this.parseLlmJson(llmResult.content);

    // 合并规则层与 LLM 结果（规则层优先级更高）
    const finalRiskLevel = ruleResult.hit ? ruleResult.riskLevel : (parsed.risk_level || 'R1');
    const finalEscalate = ruleResult.escalateToHuman || parsed.escalate_to_human === true;
    const finalRoute = ruleResult.hit
      ? routeResult
      : inferSceneAndRoute({
          riskLevel: finalRiskLevel,
          visitGoal: dto.visitGoal,
          patientAge: dto.patientAge,
          mobility: dto.mobility,
          familyRemote: dto.familyRemote,
          recentlyDischarged: dto.recentlyDischarged,
          medicalHistory: dto.medicalHistory,
          mainSymptom: dto.mainSymptom,
          ruleHits: ruleResult.matchedRules,
        });

    const session = await this.saveSession(userId, dto, target, {
      riskLevel: finalRiskLevel,
      urgencyLevel: parsed.urgency_level || ruleResult.urgencyLevel,
      sceneType: parsed.scene_type || finalRoute.sceneType,
      departmentPrimary: parsed.department_primary || null,
      departmentSecondary: parsed.department_secondary || null,
      serviceRoute: parsed.service_route?.length ? parsed.service_route : finalRoute.serviceRoute,
      recommendedProduct: parsed.recommended_product || finalRoute.recommendedProduct,
      prepChecklist: parsed.prep_checklist || ['身份证/医保卡', '近期检查报告'],
      familySyncNeeded: parsed.family_sync_needed ?? (dto.familyRemote ?? false),
      escalateToHuman: finalEscalate,
      structuredSummary: parsed.structured_summary || null,
      safeReplyText: parsed.safe_reply_text || '根据您提供的信息，我们已为您生成导诊建议，请查看详情。',
      finalJson: { ruleResult, routeResult: finalRoute, llmParsed: parsed },
      modelName: llmResult.model,
      ruleHits: ruleResult.matchedRules,
      tokensUsed: llmResult.tokensUsed,
      status: finalEscalate ? 'escalated' : 'completed',
    });

    // R2 也通知
    if (finalEscalate) {
      this.notifyEscalation(session).catch((e) => this.logger.warn('通知失败', e));
    }

    // 自动写入服务对象档案
    if (target) {
      this.updateServiceTarget(target, dto, session).catch((e) =>
        this.logger.warn('更新服务对象失败', e),
      );
    }

    return this.formatResponse(session, true);
  }

  // ─── 保存会话 ──────────────────────────────────────────

  private async saveSession(
    userId: number,
    dto: CreateTriageDto,
    target: ServiceTarget | null,
    result: {
      riskLevel: string;
      urgencyLevel: string;
      sceneType: string;
      departmentPrimary: string | null;
      departmentSecondary: string[] | null;
      serviceRoute: string[];
      recommendedProduct: string;
      prepChecklist: string[];
      familySyncNeeded: boolean;
      escalateToHuman: boolean;
      structuredSummary: string | null;
      safeReplyText: string;
      finalJson: Record<string, unknown>;
      modelName: string;
      ruleHits: string[];
      tokensUsed: number | null;
      status: string;
    },
  ) {
    const session = this.sessionRepo.create({
      userId,
      patientId: target?.id ?? null,
      consultantRole: dto.consultantRole,
      patientAge: dto.patientAge,
      patientGender: dto.patientGender,
      mainSymptom: dto.mainSymptom,
      symptomDuration: dto.symptomDuration ?? null,
      severitySelf: dto.severitySelf ?? null,
      medicalHistory: dto.medicalHistory ?? null,
      currentMedication: dto.currentMedication ?? null,
      hasExamResult: dto.hasExamResult ?? false,
      patientCity: dto.patientCity ?? null,
      familyRemote: dto.familyRemote ?? false,
      mobility: dto.mobility ?? null,
      livesAlone: dto.livesAlone ?? false,
      visitGoal: dto.visitGoal ?? null,
      allergyInfo: dto.allergyInfo ?? null,
      recentlyDischarged: dto.recentlyDischarged ?? false,
      rawInput: dto as any,
      ...result,
    });
    return this.sessionRepo.save(session);
  }

  // ─── 格式化返回 ────────────────────────────────────────

  /**
   * C 端展示用；withInputSummary 带回用户当时填写项，便于历史回看与再次导诊预填（本人数据）
   */
  private formatResponse(session: TriageSession, withInputSummary = false) {
    const base = {
      id: session.id,
      riskLevel: session.riskLevel,
      urgencyLevel: session.urgencyLevel,
      sceneType: session.sceneType,
      departmentPrimary: session.departmentPrimary,
      departmentSecondary: session.departmentSecondary,
      serviceRoute: session.serviceRoute,
      recommendedProduct: session.recommendedProduct,
      prepChecklist: session.prepChecklist,
      familySyncNeeded: session.familySyncNeeded,
      escalateToHuman: session.escalateToHuman,
      structuredSummary: session.structuredSummary,
      safeReplyText: session.safeReplyText,
      ruleHits: session.ruleHits,
      status: session.status,
      createdAt: session.createdAt,
    };
    if (!withInputSummary) return base;
    return {
      ...base,
      mainSymptom: session.mainSymptom,
      patientAge: session.patientAge,
      patientGender: session.patientGender,
      consultantRole: session.consultantRole,
      visitGoal: session.visitGoal,
      symptomDuration: session.symptomDuration,
      severitySelf: session.severitySelf,
      medicalHistory: session.medicalHistory ?? [],
      currentMedication: session.currentMedication,
      patientCity: session.patientCity,
      familyRemote: session.familyRemote,
      mobility: session.mobility,
      livesAlone: session.livesAlone,
      hasExamResult: session.hasExamResult,
      allergyInfo: session.allergyInfo,
      recentlyDischarged: session.recentlyDischarged,
    };
  }

  // ─── 通知健康管家（R2/R3） ─────────────────────────────

  private async notifyEscalation(_session: TriageSession) {
    // Enterprise WeChat notification removed; escalation logging only
    this.logger.log(
      `导诊升级 [userId=${_session.userId}, risk=${_session.riskLevel}]`,
    );
  }

  // ─── 自动更新服务对象档案 ──────────────────────────────

  private async updateServiceTarget(target: ServiceTarget, dto: CreateTriageDto, session: TriageSession) {
    const hp: any = target.healthProfile || {};
    const updates: Record<string, any> = {};

    // 写入症状摘要
    if (dto.mainSymptom && !target.mainAppeal) {
      updates.mainAppeal = dto.mainSymptom;
    }

    // 补充既往病史
    if (dto.medicalHistory?.length && !hp.medicalHistory?.length) {
      updates.healthProfile = { ...hp, medicalHistory: dto.medicalHistory };
    }

    // 写入风险标签
    if (session.riskLevel) {
      updates.healthProfile = {
        ...(updates.healthProfile || hp),
        lastTriageRiskLevel: session.riskLevel,
        lastTriageDate: new Date().toISOString().slice(0, 10),
        lastTriageDepartment: session.departmentPrimary,
      };
    }

    if (Object.keys(updates).length) {
      await this.targetRepo.update(target.id, updates);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  一键转订单
  // ═══════════════════════════════════════════════════════

  async convertToOrder(userId: number, sessionId: number, dto?: ConvertTriageOrderDto) {
    await this.assertMiniprogramTriageEnabled();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('导诊记录不存在');
    if (session.convertedOrderId) {
      return { orderId: session.convertedOrderId, message: '已转单' };
    }
    if (!session.patientId) {
      throw new BadRequestException('请先选择陪诊服务对象后再一键下单');
    }

    const bookingStatus = dto?.hospitalBookingStatus ?? 'pending_cs';
    if (bookingStatus === 'booked' && (dto?.hospitalDirectoryId == null || !Number.isFinite(dto.hospitalDirectoryId))) {
      throw new BadRequestException('已约号时请从医院名录中选择就诊医院');
    }

    let hospitalLine = '';
    let hospitalDirectoryId: number | null = null;
    if (bookingStatus === 'booked' && dto?.hospitalDirectoryId) {
      const hid = Number(dto.hospitalDirectoryId);
      const hRow = await this.hospitalRepo.findOne({ where: { id: hid, isActive: true } });
      if (!hRow) throw new BadRequestException('所选医院不在名录或已停用，请重新选择');
      hospitalLine = hRow.district
        ? `${hRow.name}（${hRow.city}${hRow.district}）`
        : `${hRow.name}（${hRow.city}）`;
      hospitalDirectoryId = hRow.id;
    }

    const callbackPhone = dto?.callbackContactPhone?.trim() || null;
    if (!callbackPhone) {
      throw new BadRequestException('请填写联系电话，便于客服与您确认就诊安排');
    }

    let bookingNote = '';
    if (bookingStatus === 'booked' && hospitalLine) {
      bookingNote = `\n[约号] 用户已自行约号；就诊医院：${hospitalLine}`;
    } else {
      bookingNote =
        '\n[约号] 尚未确定就诊医院，将由客服协助预约；稍后致电与您确认（订单已进线，请留意来电）。';
    }
    const phoneNote = `\n回电号码：${callbackPhone}`;

    const orderNumber = `T${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const order = this.orderRepo.create({
      orderNumber,
      userId,
      serviceTargetId: session.patientId,
      status: OrderStatus.PENDING_DISPATCH,
      serviceType: session.recommendedProduct || '门诊陪诊',
      hospital: hospitalLine,
      hospitalBookingStatus: bookingStatus,
      hospitalDirectoryId,
      callbackContactPhone: callbackPhone,
      department: session.departmentPrimary || '',
      riskLevel: session.riskLevel,
      notes: `[导诊转单] ${session.structuredSummary || session.mainSymptom}${bookingNote}${phoneNote}`,
    });
    const saved = await this.orderRepo.save(order);

    session.convertedOrderId = saved.id;
    session.status = 'converted';
    await this.sessionRepo.save(session);

    return { orderId: saved.id, orderNumber: saved.orderNumber };
  }

  // ═══════════════════════════════════════════════════════
  //  查询接口
  // ═══════════════════════════════════════════════════════

  async getMySessions(userId: number, page = 1, pageSize = 20) {
    await this.assertMiniprogramTriageEnabled();
    const [items, total] = await this.sessionRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: items.map((s) => this.formatResponse(s, true)), total, page, pageSize };
  }

  async getSessionDetail(userId: number, sessionId: number) {
    await this.assertMiniprogramTriageEnabled();
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
      relations: ['patient'],
    });
    if (!session) throw new NotFoundException('导诊记录不存在');
    return this.formatResponse(session, true);
  }

  // ─── 反馈 ──────────────────────────────────────────────

  async submitFeedback(userId: number, sessionId: number, dto: CreateTriageFeedbackDto) {
    await this.assertMiniprogramTriageEnabled();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('导诊记录不存在');

    const existing = await this.feedbackRepo.findOne({ where: { sessionId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.feedbackRepo.save(existing);
    }

    return this.feedbackRepo.save(this.feedbackRepo.create({ sessionId, ...dto }));
  }

  // ═══════════════════════════════════════════════════════
  //  管理后台接口
  // ═══════════════════════════════════════════════════════

  async adminList(query: {
    page?: number;
    pageSize?: number;
    riskLevel?: string;
    status?: string;
    escalateToHuman?: boolean;
  }) {
    const { riskLevel, status, escalateToHuman } = query;
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    const qb = this.sessionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .leftJoinAndSelect('t.patient', 'patient')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (riskLevel) qb.andWhere('t.riskLevel = :riskLevel', { riskLevel });
    if (status) qb.andWhere('t.status = :status', { status });
    if (escalateToHuman !== undefined) qb.andWhere('t.escalateToHuman = :esc', { esc: escalateToHuman });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async adminGetDetail(sessionId: number) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['user', 'patient'],
    });
    if (!session) throw new NotFoundException('导诊记录不存在');

    const feedback = await this.feedbackRepo.findOne({ where: { sessionId } });
    return { ...session, feedback };
  }

  async adminGetStats() {
    const total = await this.sessionRepo.count();
    const escalated = await this.sessionRepo.count({ where: { escalateToHuman: true } });
    const converted = await this.sessionRepo.count({ where: { status: 'converted' } });

    const riskCounts = await this.sessionRepo
      .createQueryBuilder('t')
      .select('t.risk_level', 'riskLevel')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.risk_level')
      .getRawMany();

    const todayCount = await this.sessionRepo
      .createQueryBuilder('t')
      .where('DATE(t.created_at) = CURDATE()')
      .getCount();

    return {
      total,
      escalated,
      converted,
      todayCount,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) + '%' : '0%',
      riskDistribution: riskCounts,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  转人工留言（用户 / 后台）
  // ═══════════════════════════════════════════════════════

  private formatTriageMessage(m: TriageSessionMessage) {
    return {
      id: m.id,
      sessionId: m.sessionId,
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt,
    };
  }

  async listTriageMessagesForUser(userId: number, sessionId: number) {
    await this.assertMiniprogramTriageEnabled();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('导诊记录不存在');
    if (!session.escalateToHuman) {
      throw new BadRequestException('当前记录未开启人工沟通');
    }
    const rows = await this.triageMessageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { items: rows.map((m) => this.formatTriageMessage(m)) };
  }

  async postTriageMessageFromUser(userId: number, sessionId: number, dto: PostTriageMessageDto) {
    await this.assertMiniprogramTriageEnabled();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('导诊记录不存在');
    if (!session.escalateToHuman) throw new BadRequestException('当前记录未开启人工沟通');
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('内容不能为空');
    const row = this.triageMessageRepo.create({
      sessionId,
      sender: 'user',
      content,
      adminUserId: null,
    });
    const saved = await this.triageMessageRepo.save(row);
    return this.formatTriageMessage(saved);
  }

  async listTriageMessagesAdmin(sessionId: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('导诊记录不存在');
    const rows = await this.triageMessageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { items: rows.map((m) => this.formatTriageMessage(m)) };
  }

  /** 删除整条导诊（留言、反馈、主记录）；已转订单的订单本身不删 */
  async adminDeleteSession(sessionId: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('导诊记录不存在');
    await this.triageMessageRepo.delete({ sessionId });
    await this.feedbackRepo.delete({ sessionId });
    await this.sessionRepo.delete({ id: sessionId });
    return { ok: true };
  }

  async postTriageMessageFromStaff(adminId: number, sessionId: number, dto: PostTriageMessageDto) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('导诊记录不存在');
    if (!session.escalateToHuman) {
      throw new BadRequestException('该记录未转人工，无法发送管家消息');
    }
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('内容不能为空');
    const row = this.triageMessageRepo.create({
      sessionId,
      sender: 'staff',
      content,
      adminUserId: adminId,
    });
    const saved = await this.triageMessageRepo.save(row);
    return this.formatTriageMessage(saved);
  }
}
