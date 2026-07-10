import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AiConsultation } from '../../entities/ai-consultation.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { MedicationReminder } from '../../entities/medication-reminder.entity.js';
import { HealthWeeklyReport } from '../../entities/health-weekly-report.entity.js';
import { Order } from '../../entities/order.entity.js';
import { User } from '../../entities/user.entity.js';
import { SystemService } from '../system/system.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { retrieveAdvisorKnowledge } from './advisor-knowledge.js';
import { evaluateAdvisorRedFlags } from './advisor-red-flags.js';

type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | MultimodalContentPart[] };

const CONFIG_KEYS = {
  apiKey: 'ai_api_key',
  baseUrl: 'ai_base_url',
  model: 'ai_model',
  visionModel: 'ai_vision_model',
  /** 可选：读图与主对话不同厂商时使用（如对话 DeepSeek、读图 OpenAI） */
  visionApiKey: 'ai_vision_api_key',
  visionBaseUrl: 'ai_vision_base_url',
  systemPrompt: 'ai_system_prompt',
  enabled: 'ai_enabled',
  temperature: 'ai_temperature',
  maxTokens: 'ai_max_tokens',
} as const;

const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const REPORT_IMAGE_MAX_COUNT = 3;

function extractUrlsFromMaterialText(text: string): string[] {
  const raw = String(text || '');
  const set = new Set<string>();
  const stripTrail = (s: string) => s.replace(/[，。；、）\]\)'"」]+$/g, '');
  let m: RegExpExecArray | null;
  const abs = /https?:\/\/[^\s\n\];，。）\]'"」]+/gi;
  while ((m = abs.exec(raw))) set.add(stripTrail(m[0]));
  const rel = /(?:^|[\s\n])\/uploads\/[^\s\n\];，。）\]'"」]+/gi;
  while ((m = rel.exec(raw))) {
    const s = m[0].trim();
    set.add(stripTrail(s.startsWith('/uploads/') ? s : s));
  }
  return [...set];
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';
const DEFAULT_MODEL = 'qwen2.5:7b';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 2048;

const DEFAULT_SYSTEM_PROMPT = `你是「陪了个伴」的 AI 健康顾问，专为用户提供健康咨询与智能分诊导航服务。本平台主要服务海外华侨的国内父母，用户群体以中老年人为主。

## 你的能力
1. **症状分析**：根据用户描述提取关键症状，结合其健康档案（如有）进行综合分析
2. **科室推荐**：根据症状推荐最匹配的医院科室，并说明推荐理由
3. **紧急程度评估**：判断紧急程度 (low/medium/high/emergency)
4. **健康建议**：给出日常护理和注意事项
5. **追问引导**：信息不足时主动追问关键信息
6. **医嘱方言翻译**：如果用户使用方言或表达不清，你能理解并用普通话通俗解释
7. **情绪关怀**：识别用户焦虑、恐惧、孤独等情绪，用温暖语气给予安慰和鼓励
8. **排队时间估算**：根据科室和时段给出一般性排队等候建议

## 回复要求
- 使用通俗易懂的中文，语气温暖、专业、有耐心（用户多为老年人）
- 如果用户使用英语、日语、韩语或其他语言，请用对应语言回复，同时附上中文翻译
- 如果用户使用方言表达（如"脑壳疼"="头痛"、"肚子叫唤"="腹鸣"），请理解其含义并用普通话解释
- 当检测到用户表达焦虑、害怕、孤独时，先给予情感关怀再回答医学问题
- 如果用户提供的信息不够，优先追问症状持续时间、症状部位、伴随症状、诱因与加重/缓解因素等；**年龄、性别、既往史、过敏与用药等若已在系统消息中的「咨询对象健康档案」列出，视为已知，不要在 followUpQuestions 中重复追问**，除非为核实与用户口述的矛盾
- 严禁做出明确诊断，所有建议仅供参考
- 遇到紧急情况（如胸痛、呼吸困难、大量出血）需要**立即提醒用户拨打120急救电话**
- 每次回复末尾附上简短免责声明

## 结构化记忆 sessionFacts
- 每轮 JSON 中必须包含 sessionFacts 对象（字段可空字符串或空数组），用于跨轮连贯；用户**更正**时以最新说法为准。
- **symptomMergeMode** 为 append（默认，JSON 字符串取值 append）时：在**同一主诉**下延续并补充，勿随意丢弃已确认细节。
- **symptomMergeMode** 为 "replace" 时：用户已**切换为明显无关的新症状/新主诉**（见下节），本回合起 sessionFacts 应**聚焦新主诉**，symptoms 数组只列与新问题相关的词，旧话题的持续时间/部位等字段若无关联请置空或不再引用。
- sessionFacts 与下方「本场已提取的结构化要点」对齐更新。

## 对话形态（多轮问答）
- 系统消息中可能包含「该用户近期其他咨询记录」：**禁止**默认并入当前分析；仅当用户**明示**与历史相关（如「老毛病又犯了」「跟上次一样」）才可引用。**否则一律忽略**其中的旧症状，不得写进本轮 summary 或 sessionFacts.symptoms。
- **换话题**：若用户新开与本轮此前主诉**明显无关**的问题（例如前文在聊头痛、本条在聊胃痛，且用户未要求一并分析），必须设 **symptomMergeMode 为 replace（JSON 字符串）**，追问与结论只围绕新问题。
- 像真人医生助理一样：**先对话澄清，再给出分诊结论**。信息不足时设置 followUpQuestions（1-3 条）及 **followUpChoiceGroups**（见下）；用户常通过**点选选项**作答，也需兼容用户坚持打字。
- 每一轮：若仍需澄清，设置 followUpQuestions + followUpChoiceGroups；若已足够，二者均为空数组，并在本轮给出完整建议。
- **不要**生成「见医生时要问医生什么」类清单；preVisitQuestions 字段固定保留在 JSON 中但必须恒为 []。

## 回复格式
请始终以如下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "summary": "见下方分流规则",
  "extractedSymptoms": ["症状1", "症状2"],
  "recommendedDepartments": [
    {"name": "科室名称", "confidence": 0.9, "reason": "推荐理由"}
  ],
  "severityLevel": "low|medium|high|emergency",
  "symptomMergeMode": "append",
  "followUpQuestions": ["面向用户的追问句，如：症状大概持续多久了？具体在哪个部位？有无发热？最多3条；无需追问时为空数组"],
  "followUpChoiceGroups": [
    ["约30分钟内", "数小时", "断断续续好几天", "说不清楚"],
    ["前额/眉弓附近", "后脑勺", "太阳穴两侧", "整头游移说不清", "其他/我打字说明"]
  ],
  "preVisitQuestions": [],
  "preparationChecklist": ["就诊前需要准备的事项（2-5条）；仅当 followUpQuestions 为空且已能给出科室建议时填写，否则必须为空数组"],
  "waitTimeEstimate": "就诊排队时间估算（有把握时填写，否则空字符串）",
  "emotionalSupport": "情绪关怀（需要时填写，否则空字符串）",
  "sessionFacts": {
    "ageOrDemographics": "用户提及的年龄或人群，无则空字符串",
    "symptomDuration": "症状持续时间，无则空字符串",
    "mainLocation": "主要部位，无则空字符串",
    "symptoms": ["已从对话确认的症状，可无则[]"],
    "medicationMentioned": "提到的用药，无则空字符串",
    "allergyMentioned": "提到的过敏，无则空字符串",
    "otherNotes": "其他关键信息，无则空字符串"
  }
}

## followUpChoiceGroups（点击作答，必须遵守）
- 当 **followUpQuestions 非空** 时：**followUpChoiceGroups 必须为非空数组，且行数与 followUpQuestions 完全一致**；第 i 行是给第 i 条追问准备的 **3–6 个**简短中文选项（贴近常见答法），**每行最后一条建议为「其他 / 我打字说明」**，便于用户改用手写补充。
- 当 **followUpQuestions 为空** 时：**followUpChoiceGroups 必须为空数组（JSON 中写作 []）**。

## summary 与 followUpQuestions 分流规则（必须遵守）
1. **当 followUpQuestions 非空（仍需用户补充）**：summary 只写简短承上启下：肯定用户已说的、说明还要确认哪类信息（2-4 句即可）；**不要**展开长篇科室分析；recommendedDepartments 可暂为空数组，或仅在极高把握时给 1 个科室；preparationChecklist、waitTimeEstimate 必须为空数组或空字符串。
2. **当 followUpQuestions 为空（本回合应给出结论）**：summary 写完整的通俗分析、就医方向、注意事项，并含简短免责声明；给出 recommendedDepartments、preparationChecklist（如适用）、waitTimeEstimate（如适用）。
3. **紧急情形**（severityLevel 为 emergency 或 high）：summary 须明确提醒尽快就医/必要时拨打 120；追问只在没有关键信息且不影响立即就医提示时少量使用，否则 followUpQuestions 可为空。
4. **preVisitQuestions 必须恒为 []**，不要输出任何「问医生」条目。`;

@Injectable()
export class AiConsultationService {
  private readonly logger = new Logger(AiConsultationService.name);

  constructor(
    @InjectRepository(AiConsultation)
    private readonly consultRepo: Repository<AiConsultation>,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(HealthWeeklyReport)
    private readonly weeklyReportRepo: Repository<HealthWeeklyReport>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly systemService: SystemService,
    private readonly storageService: StorageService,
  ) {}

  private async getAiConfig() {
    const [
      apiKey,
      baseUrl,
      model,
      visionModel,
      visionApiKey,
      visionBaseUrl,
      systemPrompt,
      enabled,
      temperature,
      maxTokens,
    ] = await Promise.all([
      this.systemService.getConfig(CONFIG_KEYS.apiKey),
      this.systemService.getConfig(CONFIG_KEYS.baseUrl),
      this.systemService.getConfig(CONFIG_KEYS.model),
      this.systemService.getConfig(CONFIG_KEYS.visionModel),
      this.systemService.getConfig(CONFIG_KEYS.visionApiKey),
      this.systemService.getConfig(CONFIG_KEYS.visionBaseUrl),
      this.systemService.getConfig(CONFIG_KEYS.systemPrompt),
      this.systemService.getConfig(CONFIG_KEYS.enabled),
      this.systemService.getConfig(CONFIG_KEYS.temperature),
      this.systemService.getConfig(CONFIG_KEYS.maxTokens),
    ]);

    return {
      apiKey: apiKey || '',
      baseUrl: baseUrl || DEFAULT_BASE_URL,
      model: model || DEFAULT_MODEL,
      visionModel: (visionModel || '').trim(),
      visionApiKey: (visionApiKey || '').trim(),
      visionBaseUrl: (visionBaseUrl || '').trim(),
      systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
      enabled: enabled !== 'false',
      temperature: temperature ? Number(temperature) : DEFAULT_TEMPERATURE,
      maxTokens: maxTokens ? Number(maxTokens) : DEFAULT_MAX_TOKENS,
    };
  }

  /** 运营关闭小程序「AI 健康顾问」时，问诊/读图/语音等 C 端接口拒绝（健康周报接口不在此列） */
  private async assertMiniprogramAiAdvisorEnabled() {
    const v = await this.systemService.getConfig('miniprogram_show_ai_advisor');
    if (v === 'false' || v === '0') {
      throw new BadRequestException('AI 健康顾问功能已关闭');
    }
  }

  /** 与小程序服务对象列表一致：显式 id 优先，否则取该用户**最新创建**的一条（createdAt DESC）。 */
  private async loadServiceTargetForConsultContext(
    userId: number,
    serviceTargetId?: number | string | null,
  ): Promise<ServiceTarget | null> {
    const n =
      serviceTargetId !== undefined && serviceTargetId !== null && serviceTargetId !== ''
        ? Number(serviceTargetId)
        : NaN;
    if (Number.isFinite(n) && n > 0) {
      const byId = await this.targetRepo.findOne({ where: { id: Math.floor(n), userId } });
      if (byId) return byId;
    }
    return this.targetRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  private ageFromBirthDateIso(birthDate: string): number | null {
    const s = String(birthDate).trim().slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (![y, mo, d].every((x) => Number.isFinite(x))) return null;
    const today = new Date();
    const ty = today.getFullYear();
    const tm = today.getMonth() + 1;
    const td = today.getDate();
    let age = ty - y;
    if (tm < mo || (tm === mo && td < d)) age--;
    if (age < 0 || age > 130) return null;
    return age;
  }

  private resolveEffectiveAgeForTarget(target: ServiceTarget): number | null {
    if (target.age != null && Number.isFinite(Number(target.age))) {
      const a = Number(target.age);
      if (a >= 0 && a <= 130) return Math.floor(a);
    }
    const hp: any = target.healthProfile || {};
    if (hp.birthDate) return this.ageFromBirthDateIso(String(hp.birthDate));
    return null;
  }

  private buildHealthContext(target: ServiceTarget): string {
    const hp: any = target.healthProfile || {};
    const parts: string[] = [];
    const consumed = new Set<string>();

    if (target.name) parts.push(`姓名：${target.name}`);
    if (target.gender) {
      parts.push(`性别：${target.gender === 'male' ? '男' : target.gender === 'female' ? '女' : target.gender}`);
    }

    const effAge = this.resolveEffectiveAgeForTarget(target);
    if (effAge != null) parts.push(`年龄：${effAge}岁`);

    if (hp.birthDate) {
      consumed.add('birthDate');
      parts.push(`出生日期：${hp.birthDate}`);
    }
    if (hp.relationship) {
      consumed.add('relationship');
      parts.push(`与账户持有人关系：${hp.relationship}`);
    }
    if (hp.remark) {
      consumed.add('remark');
      parts.push(`档案备注：${hp.remark}`);
    }

    if (hp.bloodType) {
      consumed.add('bloodType');
      parts.push(`血型：${hp.bloodType}`);
    }

    if (hp.allergies && hp.allergies !== '无') {
      consumed.add('allergies');
      parts.push(`过敏史：${hp.allergies}`);
    }

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
    const histArr = (hp.medicalHistory || []).filter((v: string) => v !== 'none');
    if (histArr.length) {
      consumed.add('medicalHistory');
      const labels = histArr.map((v: string) => historyLabels[v] || v);
      parts.push(`既往病史：${labels.join('、')}`);
      if (hp.medicalHistoryOther) {
        consumed.add('medicalHistoryOther');
        parts.push(`其他病史说明：${hp.medicalHistoryOther}`);
      }
    }

    if (hp.visionStatus && hp.visionStatus !== 'good') {
      consumed.add('visionStatus');
      parts.push(`视力：${hp.visionStatus === 'poor' ? '减退' : '障碍'}`);
    }
    if (hp.hearingStatus && hp.hearingStatus !== 'good') {
      consumed.add('hearingStatus');
      parts.push(`听力：${hp.hearingStatus === 'poor' ? '减退' : '障碍'}`);
    }

    const medStr = hp.currentMedication || hp.currentMedications;
    if (medStr) {
      consumed.add('currentMedication');
      consumed.add('currentMedications');
      parts.push(`当前用药：${medStr}`);
    }

    const recentLabels: Record<string, string> = {
      none: '无明显症状',
      syncope: '晕厥/眩晕/跌倒',
      chest_pain: '胸痛/胸闷/心慌',
      dyspnea: '呼吸困难',
      fatigue: '乏力/疲劳',
      pain: '持续性疼痛',
      insomnia: '失眠/睡眠障碍',
      appetite_loss: '食欲下降',
    };
    if (hp.recentSymptoms?.length) {
      consumed.add('recentSymptoms');
      const labels = (hp.recentSymptoms as string[]).map((v) => recentLabels[v] || v);
      parts.push(`近期全身症状：${labels.join('、')}`);
    }

    if (hp.emergencyRelation) {
      consumed.add('emergencyRelation');
      parts.push(`紧急联系人关系：${hp.emergencyRelation}`);
    }

    if (target.mainAppeal) parts.push(`档案主诉：${target.mainAppeal}`);
    if (hp.otherHealthInfo) {
      consumed.add('otherHealthInfo');
      parts.push(`其他健康信息：${hp.otherHealthInfo}`);
    }

    const sensitiveSkip = new Set([
      ...consumed,
      'signatureUrl',
      'signUrl',
      'signedAt',
      'signatureName',
      'idCard',
      'phone',
      'emergencyPhone',
    ]);
    const extraLines: string[] = [];
    for (const [k, v] of Object.entries(hp)) {
      if (sensitiveSkip.has(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        extraLines.push(`${k}：${String(v)}`);
        continue;
      }
      if (Array.isArray(v) && v.length && v.every((x) => ['string', 'number'].includes(typeof x))) {
        extraLines.push(`${k}：${(v as (string | number)[]).join('、')}`);
      }
    }
    if (extraLines.length) {
      parts.push(`档案其他字段：\n${extraLines.join('\n')}`);
    }

    if (!parts.length) return '';

    return (
      '\n\n【咨询对象健康档案（用户在本平台维护；分析时须完整纳入。若口述与档案明显冲突，以用户**最新口述**为准并温和核实）】\n' +
      `${parts.join('\n')}\n` +
      '【重要】档案已列信息视为已掌握：不要在 followUpQuestions 中重复索要年龄/性别/既往史/过敏/当前用药等，除非为核实矛盾；追问应聚焦症状细节与诊疗仍缺的信息。'
    );
  }

  private mergeSessionFacts(
    prev: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown> | undefined,
    symptomMode: 'append' | 'replace' = 'append',
  ): Record<string, unknown> {
    const p: Record<string, unknown> = { ...(prev || {}) };
    if (!incoming || typeof incoming !== 'object') return p;
    for (const [k, v] of Object.entries(incoming)) {
      if (v === undefined || v === null) continue;
      if (k === 'symptoms' && Array.isArray(v)) {
        const next = [...new Set((v as unknown[]).map(String).filter(Boolean))];
        if (symptomMode === 'replace') {
          p[k] = next;
        } else {
          const old = Array.isArray(p[k]) ? (p[k] as unknown[]) : [];
          p[k] = [...new Set([...old, ...next].map(String).filter(Boolean))];
        }
        continue;
      }
      if (typeof v === 'string' && v.trim() === '') continue;
      p[k] = v;
    }
    return p;
  }

  /** 保证与追问条数一致，便于小程序渲染点选项 */
  private normalizeFollowUpChoiceGroups(
    questions: string[],
    raw: unknown,
  ): string[][] {
    const n = questions.length;
    if (!n) return [];
    let rows: string[][] = [];
    if (Array.isArray(raw)) {
      rows = raw
        .filter((g) => Array.isArray(g))
        .map((g) =>
          (g as unknown[])
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .slice(0, 8),
        );
    }
    const fallback = ['暂不清楚', '需要想一想', '其他 / 我打字说明'];
    while (rows.length < n) {
      rows.push([...fallback]);
    }
    if (rows.length > n) {
      rows = rows.slice(0, n);
    }
    return rows.map((r) => (r.length ? r : [...fallback]));
  }

  private formatSessionFactsForSystem(facts: Record<string, unknown> | null | undefined): string {
    if (!facts || !Object.keys(facts).length) return '';
    const lines = Object.entries(facts)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        if (Array.isArray(v)) return `- ${k}：${(v as string[]).join('、')}`;
        return `- ${k}：${String(v)}`;
      });
    return lines.length ? lines.join('\n') : '';
  }

  /** 从对象存储读取用户上传的图片，转为 data URL 供多模态模型使用（最多 3 张）。 */
  private async loadMaterialImagesForVision(urls: string[]): Promise<MultimodalContentPart[]> {
    const out: MultimodalContentPart[] = [];
    const seen = new Set<string>();
    for (const u of urls) {
      if (out.length >= REPORT_IMAGE_MAX_COUNT) break;
      const key = u.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      try {
        const { body, contentType } = await this.storageService.readObject(key);
        if (!body?.length) continue;
        if (body.length > REPORT_IMAGE_MAX_BYTES) {
          this.logger.warn(`interpretReport: 跳过过大图片 ${key.slice(0, 96)}`);
          continue;
        }
        const mime = (contentType || 'image/jpeg').split(';')[0].trim().toLowerCase();
        if (!mime.startsWith('image/')) {
          this.logger.warn(`interpretReport: 跳过非图片文件 ${key.slice(0, 96)}`);
          continue;
        }
        const b64 = body.toString('base64');
        out.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' },
        });
      } catch (e) {
        this.logger.warn(
          `interpretReport: 无法读取图片 ${key.slice(0, 120)}：${(e as Error)?.message || e}`,
        );
      }
    }
    return out;
  }

  private async callLlm(
    messages: ChatMessage[],
    config: Awaited<ReturnType<typeof this.getAiConfig>>,
    opts?: { temperature?: number; maxTokens?: number; model?: string },
  ) {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = JSON.stringify({
      model: opts?.model ?? config.model,
      messages,
      temperature: opts?.temperature ?? config.temperature,
      max_tokens: opts?.maxTokens ?? config.maxTokens,
      response_format: { type: 'json_object' },
    });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };

    const maxRetries = 2;
    let lastError = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', headers, body });

        if (res.status === 429 || res.status >= 500) {
          lastError = `LLM API ${res.status}`;
          this.logger.warn(`LLM API ${res.status}, attempt ${attempt + 1}/${maxRetries + 1}`);
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          this.logger.error(`LLM API error ${res.status}: ${text}`);
          throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
        }

        const data: any = await res.json();
        const choice = data.choices?.[0];
        if (!choice?.message?.content) {
          throw new BadRequestException('AI 返回结果为空');
        }

        return {
          content: choice.message.content as string,
          tokensUsed: data.usage?.total_tokens ?? null,
        };
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        lastError = e?.message || 'fetch failed';
        this.logger.warn(`LLM fetch error attempt ${attempt + 1}: ${lastError}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }
    }

    this.logger.error(`LLM call failed after ${maxRetries + 1} attempts: ${lastError}`);
    throw new BadRequestException('AI 服务暂时不可用，请稍后重试');
  }

  private parseAiResponse(raw: string) {
    try {
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        summary: raw,
        extractedSymptoms: [],
        recommendedDepartments: [],
        severityLevel: 'low',
        followUpQuestions: [],
        materialType: 'unclear',
        imageReadable: false,
        abnormalItems: [],
        medicationHints: [],
        normalConclusion: '',
        recommendedActions: [],
        dietaryAdvice: '',
        limitations: '',
      };
    }
  }

  /**
   * 粗略估算中文+英文混合文本的 token 数。
   * 中文 ≈ 1.5 token/字，英文 ≈ 0.25 token/word，取经验系数 0.7 token/char。
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length * 0.7);
  }

  /**
   * 把较早的对话轮次压缩为一段简短摘要，保留关键症状与结论。
   * 这样即使对话很长，也不会把全量 40 条消息全部发给 LLM。
   */
  private compressOlderMessages(
    messages: Array<{ role: string; content: string; parsedResult?: any }>,
  ): string {
    if (!messages.length) return '';

    const userSnippets: string[] = [];
    let lastAssistantSummary = '';

    for (const m of messages) {
      if (m.role === 'user') {
        let text = (m.content || '').replace(/\s+/g, ' ').trim();
        if (text.length > 120) text = text.slice(0, 120) + '…';
        userSnippets.push(text);
      } else if (m.role === 'assistant') {
        const summary = m.parsedResult?.summary || m.content || '';
        let text = summary.replace(/\s+/g, ' ').trim();
        if (text.length > 200) text = text.slice(0, 200) + '…';
        lastAssistantSummary = text;
      }
    }

    const parts: string[] = [];
    if (userSnippets.length) {
      parts.push(`用户曾提到：${userSnippets.join('；')}`);
    }
    if (lastAssistantSummary) {
      parts.push(`顾问分析要点：${lastAssistantSummary}`);
    }
    return parts.join('\n');
  }

  /** 近期其他 session 的简明对话摘要，供当前轮次模型建立连贯语境（不含当前 sessionId） */
  private async buildCrossSessionRecap(userId: number, currentSessionId: string): Promise<string> {
    const rows = await this.consultRepo
      .createQueryBuilder('c')
      .select('c.session_id', 'sid')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.session_id != :cur', { cur: currentSessionId })
      .groupBy('c.session_id')
      .orderBy('MAX(c.created_at)', 'DESC')
      .limit(2)
      .getRawMany();

    if (!rows.length) return '';

    const maxTotalChars = 1600;
    const chunks: string[] = [];
    let total = 0;

    for (const r of rows) {
      const sid = String((r as { sid: string }).sid);
      const msgs = await this.consultRepo.find({
        where: { sessionId: sid, userId },
        order: { createdAt: 'ASC' },
        take: 12,
      });
      if (!msgs.length) continue;

      const lines: string[] = [`〔历史会话 ${sid.length > 18 ? sid.slice(0, 18) + '…' : sid}〕`];
      for (const m of msgs) {
        const roleLabel = m.role === 'user' ? '用户' : '顾问';
        let text = (m.content || '').replace(/\s+/g, ' ').trim();
        if (text.length > 160) text = text.slice(0, 160) + '…';
        lines.push(`${roleLabel}：${text}`);
      }
      const block = lines.join('\n');
      if (total + block.length > maxTotalChars) {
        if (chunks.length === 0 && block.length) {
          chunks.push(block.slice(0, maxTotalChars));
        }
        break;
      }
      chunks.push(block);
      total += block.length + 8;
    }

    if (!chunks.length) return '';

    return (
      '\n\n【该用户近期其他咨询记录（**独立历史会话**，与当前线程不同）】\n' +
      '**不得**把这些记录里的症状或结论默认当作当前用户正在问的问题。**仅当用户原文明说与历史相关时**才可引用；否则视为无关背景，忽略即可。\n' +
      chunks.join('\n\n────────\n')
    );
  }

  async chat(userId: number, dto: { message: string; sessionId?: string; serviceTargetId?: number }) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const config = await this.getAiConfig();
    if (!config.enabled) throw new BadRequestException('AI 问诊功能暂未开启');
    if (!config.apiKey) throw new BadRequestException('AI 服务尚未配置，请联系管理员');

    const sessionId = dto.sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const consultTarget = await this.loadServiceTargetForConsultContext(userId, dto.serviceTargetId);
    const healthContext = consultTarget ? this.buildHealthContext(consultTarget) : '';
    let resolvedTargetId: number | null = consultTarget?.id ?? null;
    if (resolvedTargetId == null && dto.serviceTargetId != null) {
      const n = Number(dto.serviceTargetId);
      if (Number.isFinite(n) && n > 0) resolvedTargetId = Math.floor(n);
    }

    const history = await this.consultRepo.find({
      where: { sessionId, userId },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    const priorUserTargetIds = [
      ...new Set(
        history
          .filter((h) => h.role === 'user' && h.serviceTargetId != null)
          .map((h) => Number(h.serviceTargetId)),
      ),
    ].filter((id) => Number.isFinite(id) && id > 0);

    const currentRoundTargetId = consultTarget?.id ?? resolvedTargetId;
    const switchedConsultSubject =
      currentRoundTargetId != null &&
      priorUserTargetIds.length > 0 &&
      priorUserTargetIds.some((id) => id !== currentRoundTargetId);

    const multiSubjectNotice = switchedConsultSubject
      ? '\n\n【咨询对象切换】用户在本会话中更换过「咨询对象」。上一段「咨询对象健康档案」**仅对应此刻选中的人**。更早的用户发言可能针对**其他家庭成员**，请勿把旧发言里的症状或 sessionFacts 里遗留的年龄等字段，与当前档案机械合并；应以**当前档案 + 本轮及后续用户发言**为主更新 sessionFacts，必要时用一句话向用户确认当前在讨论谁。'
      : '';

    const crossSessionRecap = await this.buildCrossSessionRecap(userId, sessionId);

    const revHist = [...history].reverse();
    const lastAssistant = revHist.find((h) => h.role === 'assistant');
    const rawFacts = lastAssistant?.parsedResult?.sessionFacts;
    const prevSessionFacts =
      rawFacts && typeof rawFacts === 'object' ? (rawFacts as Record<string, unknown>) : {};

    const priorUserLines = history
      .filter((h) => h.role === 'user')
      .map((h) => (h.content || '').trim())
      .filter(Boolean);
    const combinedUserText = [...priorUserLines, (dto.message || '').trim()].join('\n');
    const red = evaluateAdvisorRedFlags(combinedUserText);
    const knowledgeInject = retrieveAdvisorKnowledge(combinedUserText);
    const factsSystem = this.formatSessionFactsForSystem(prevSessionFacts);
    const factsBlock = factsSystem
      ? `\n\n【本场已提取的结构化要点（须在 JSON 的 sessionFacts 中延续并更新）】\n${factsSystem}`
      : '';

    const systemCore =
      config.systemPrompt +
      healthContext +
      multiSubjectNotice +
      knowledgeInject +
      crossSessionRecap +
      factsBlock;

    await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId,
        serviceTargetId: resolvedTargetId,
        role: 'user',
        content: dto.message,
      }),
    );

    if (red.hit && red.level) {
      const isEmer = red.level === 'emergency';
      const summary = isEmer
        ? `根据您描述的情况，涉及「${red.matched.join('、')}」等需高度警惕的表现，请**立即由家人陪同前往最近医院的急诊科，或拨打 120**，不要仅依赖线上咨询拖延。本平台 AI 不能替代急诊判断。\n\n*仅供就医参考，不构成诊断。*`
        : `根据您描述，存在「${red.matched.join('、')}」等情况，建议**尽快（数小时内）到附近医院门诊或急诊就诊**，由医生面诊评估；若加重请拨打 120。\n\n*仅供就医参考，不构成诊断。*`;

      const mergedFacts = this.mergeSessionFacts(prevSessionFacts, {
        redFlagHints: red.matched.join('、'),
        lastUserExcerpt: (dto.message || '').slice(0, 280),
      });

      const parsedRed: Record<string, unknown> = {
        summary,
        extractedSymptoms: [],
        recommendedDepartments: isEmer
          ? [{ name: '急诊科', confidence: 0.95, reason: '需排除危急情况' }]
          : [],
        severityLevel: isEmer ? 'emergency' : 'high',
        followUpQuestions: [],
        preVisitQuestions: [],
        preparationChecklist: isEmer
          ? ['立即由家属陪同就医或呼叫 120', '携带身份证、医保卡', '列出当前用药名称']
          : ['尽快安排到医院就诊', '携带近期检查资料与用药清单'],
        waitTimeEstimate: '',
        emotionalSupport: '',
        sessionFacts: mergedFacts,
      };

      const savedRed = await this.consultRepo.save(
        this.consultRepo.create({
          userId,
          sessionId,
          serviceTargetId: resolvedTargetId,
          role: 'assistant',
          content: summary,
          parsedResult: parsedRed as any,
          tokensUsed: null,
        }),
      );

      return {
        sessionId,
        messageId: savedRed.id,
        reply: summary,
        extractedSymptoms: [],
        recommendedDepartments: (parsedRed.recommendedDepartments as any[]) || [],
        severityLevel: parsedRed.severityLevel as string,
        followUpQuestions: [],
        followUpChoiceGroups: [],
        preVisitQuestions: [],
        preparationChecklist: (parsedRed.preparationChecklist as string[]) || [],
        waitTimeEstimate: '',
        emotionalSupport: '',
      };
    }

    // ── 滑动窗口：最近 RECENT_WINDOW 条保留完整对话，更早的压缩为摘要 ──
    const RECENT_WINDOW = 12;
    const TOKEN_BUDGET = 12000;

    let systemText = systemCore;
    const recentMessages: ChatMessage[] = [];

    if (history.length <= RECENT_WINDOW) {
      for (const h of history) {
        recentMessages.push({ role: h.role as 'user' | 'assistant', content: h.content });
      }
    } else {
      const olderPart = history.slice(0, history.length - RECENT_WINDOW);
      const recentPart = history.slice(history.length - RECENT_WINDOW);

      const compressed = this.compressOlderMessages(olderPart);
      if (compressed) {
        systemText +=
          `\n\n【本会话早期对话摘要（共 ${olderPart.length} 条，已压缩）】\n${compressed}`;
      }

      for (const h of recentPart) {
        recentMessages.push({ role: h.role as 'user' | 'assistant', content: h.content });
      }
    }

    const messages: ChatMessage[] = [{ role: 'system', content: systemText }];
    messages.push(...recentMessages);
    messages.push({ role: 'user', content: dto.message });

    // 粗略 token 估算；超预算时进一步裁剪中间对话
    const totalEstimate = messages.reduce(
      (sum, m) => sum + this.estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
      0,
    );
    if (totalEstimate > TOKEN_BUDGET && recentMessages.length > 4) {
      const excess = totalEstimate - TOKEN_BUDGET;
      let freed = 0;
      let dropCount = 0;
      for (let i = 0; i < recentMessages.length - 4 && freed < excess; i++) {
        freed += this.estimateTokens(
          typeof recentMessages[i].content === 'string'
            ? recentMessages[i].content as string
            : JSON.stringify(recentMessages[i].content),
        );
        dropCount++;
      }
      if (dropCount > 0) {
        messages.splice(1, dropCount);
      }
    }

    const llmResult = await this.callLlm(messages, config);
    const parsed = this.parseAiResponse(llmResult.content);
    parsed.preVisitQuestions = [];
    if ((parsed.followUpQuestions || []).length > 0) {
      parsed.preparationChecklist = [];
    }

    const fqs = Array.isArray(parsed.followUpQuestions)
      ? (parsed.followUpQuestions as unknown[]).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    parsed.followUpQuestions = fqs;
    parsed.followUpChoiceGroups =
      fqs.length > 0
        ? this.normalizeFollowUpChoiceGroups(fqs, parsed.followUpChoiceGroups)
        : [];

    const symptomMode = parsed.symptomMergeMode === 'replace' ? 'replace' : 'append';
    delete parsed.symptomMergeMode;

    parsed.sessionFacts = this.mergeSessionFacts(
      prevSessionFacts,
      parsed.sessionFacts as Record<string, unknown> | undefined,
      symptomMode,
    );

    const savedAsst = await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId,
        serviceTargetId: resolvedTargetId,
        role: 'assistant',
        content: parsed.summary || llmResult.content,
        parsedResult: parsed,
        tokensUsed: llmResult.tokensUsed,
      }),
    );

    return {
      sessionId,
      messageId: savedAsst.id,
      reply: parsed.summary || llmResult.content,
      extractedSymptoms: parsed.extractedSymptoms || [],
      recommendedDepartments: parsed.recommendedDepartments || [],
      severityLevel: parsed.severityLevel || 'low',
      followUpQuestions: parsed.followUpQuestions || [],
      followUpChoiceGroups: parsed.followUpChoiceGroups || [],
      preVisitQuestions: [],
      preparationChecklist: parsed.preparationChecklist || [],
      waitTimeEstimate: parsed.waitTimeEstimate || '',
      emotionalSupport: parsed.emotionalSupport || '',
    };
  }

  async setMessageFeedback(
    userId: number,
    messageId: number,
    dto: { helpful: boolean },
  ) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const row = await this.consultRepo.findOne({ where: { id: messageId, userId } });
    if (!row) throw new BadRequestException('消息不存在');
    if (row.role !== 'assistant') throw new BadRequestException('只能评价助手回复');
    row.feedbackHelpful = dto.helpful;
    await this.consultRepo.save(row);
    return { ok: true };
  }

  async transcribeAudio(userId: number, file: Express.Multer.File) {
    await this.assertMiniprogramAiAdvisorEnabled();
    void userId;
    const apiKey = await this.systemService.getConfig('speech_api_key');
    if (!apiKey?.trim()) {
      throw new BadRequestException('未配置语音转文字（speech_api_key），请使用键盘输入');
    }
    const base =
      (await this.systemService.getConfig('speech_api_base')) || 'https://api.openai.com/v1';
    const model = (await this.systemService.getConfig('speech_model')) || 'whisper-1';

    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, file.originalname || 'audio.m4a');
    form.append('model', model);

    const url = `${base.replace(/\/+$/, '')}/audio/transcriptions`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (error) {
      this.logger.warn(`transcribe network error: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('语音识别服务暂时不可用，请稍后重试');
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.warn(`transcribe ${res.status}: ${t}`);
      throw new BadRequestException('语音识别失败，请改用文字输入');
    }
    let data: any;
    try {
      data = await res.json();
    } catch (error) {
      this.logger.warn(
        `transcribe parse error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('语音识别服务返回异常，请稍后重试');
    }
    const text = (data.text || '').trim();
    if (!text) throw new BadRequestException('未识别到语音内容，请重试');
    return { text };
  }

  /**
   * 面向门诊医生的「就诊信息摘要」：由模型根据会话事实改写成病历式叙述，而非粘贴聊天原文。
   */
  async generateClinicHandoffSummary(
    userId: number,
    dto: { sessionId: string; serviceTargetId?: number },
  ) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const config = await this.getAiConfig();
    if (!config.enabled) throw new BadRequestException('AI 问诊功能暂未开启');
    if (!config.apiKey) throw new BadRequestException('AI 服务尚未配置，请联系管理员');

    const sessionId = dto.sessionId?.trim();
    if (!sessionId) throw new BadRequestException('缺少 sessionId');

    const rows = await this.consultRepo.find({
      where: { sessionId, userId },
      order: { createdAt: 'ASC' },
      take: 64,
    });
    if (!rows.length) throw new BadRequestException('暂无可整理的对话');

    let healthContext = '';
    let patientLine = '咨询对象：未关联健康档案';
    const handoffTarget = await this.loadServiceTargetForConsultContext(userId, dto.serviceTargetId);
    if (handoffTarget) {
      healthContext = this.buildHealthContext(handoffTarget);
      const g = handoffTarget.gender === 'male' ? '男' : handoffTarget.gender === 'female' ? '女' : '';
      const age = this.resolveEffectiveAgeForTarget(handoffTarget);
      patientLine = `咨询对象：${handoffTarget.name || '—'}${g ? ` · ${g}` : ''}${age != null ? ` · ${age}岁` : ''}`;
    }

    const userUtterances = rows
      .filter((r) => r.role === 'user')
      .map((r) => (r.content || '').trim())
      .filter(Boolean);
    const assistants = rows.filter((r) => r.role === 'assistant');
    const lastAsst = assistants[assistants.length - 1];
    const pr = lastAsst?.parsedResult;
    const rawFacts = pr?.sessionFacts;
    const factsBlock = this.formatSessionFactsForSystem(
      rawFacts && typeof rawFacts === 'object' ? (rawFacts as Record<string, unknown>) : undefined,
    );

    let asstHints = '';
    if (lastAsst) {
      const ex = (pr?.extractedSymptoms || []).join('、');
      const depts = (pr?.recommendedDepartments || [])
        .map((d: { name?: string; reason?: string }) => `${d.name || ''}${d.reason ? `（${d.reason}）` : ''}`)
        .join('；');
      const summ = (lastAsst.content || '').replace(/\s+/g, ' ').trim();
      const summShort = summ.length > 480 ? `${summ.slice(0, 480)}…` : summ;
      const prep = pr?.preparationChecklist?.length
        ? (pr.preparationChecklist as string[]).join('；')
        : '';
      asstHints = [
        '【顾问侧辅助信息（含系统自动提取的关键词与科室参考；均非体检/化验结论，摘要正文中不得写成「已证实」事实】',
        summShort ? `最近一轮顾问要点摘录：${summShort}` : '',
        ex ? `提取的症状关键词（待与家属原述核对）：${ex}` : '',
        depts ? `算法/顾问参考的分诊方向（仅供接诊参考）：${depts}` : '',
        pr?.severityLevel ? `线上风险标签（不等同于急诊分级）：${pr.severityLevel}` : '',
        prep ? `行前准备提示：${prep}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    const lastAdvisorTurns = assistants.slice(-4);
    const advisorTranscriptBlock =
      lastAdvisorTurns.length > 0
        ? `【顾问回复摘录（仅用于理解对话脉络；病情表述须以患者/家属原述及档案为准，不得视为检查结论）】\n${lastAdvisorTurns
            .map((m) => {
              const t = (m.content || '').replace(/\s+/g, ' ').trim();
              if (!t) return '';
              const short = t.length > 220 ? `${t.slice(0, 220)}…` : t;
              return `• ${short}`;
            })
            .filter(Boolean)
            .join('\n')}`
        : '';

    const userBlock = `【患者/家属原述（按时间顺序，为摘要的核心事实来源）】\n${userUtterances.map((u, i) => `${i + 1}. ${u}`).join('\n\n')}`;

    const systemPrompt = `你协助整理「线上预问诊材料」，供门诊医生**快速了解家属/患者已说了什么**，不是替代病史采集，更不是诊断。

## 工作流程（必须遵守）
1. **先通读**「患者/家属原述」全文，再结合健康档案、结构化要点与顾问摘录，理解到底有哪些**已明确陈述**的信息。
2. **再动笔**：主诉、现病史等段落只能概括「材料里真正出现过的内容」，用语前可加「据家属/患者在线上称……」式来源提示，避免写成无条件事实断言。
3. **信息不足时不要硬写**：宁可写「本次线上未说明……」「建议面诊补充询问……」，也禁止用通用模板套话冒充病史。
4. **顾问内容**：只能作为「对话脉络、待核实线索」，不得把顾问的推断、分诊建议直接写成患者已确诊或已排除某种疾病。
5. **冲突处理**：若口述与健康档案明显不一致，须在 conflictsOrUncertainties 中并列说明，不得在正文用单方面措辞掩盖。
6. **法律与安全**：不出现「确诊」「排除」「保证」「一定」等定论措辞；triageImpression 只能是分诊/就诊方向建议；不得编造体温、血压、化验值、影像学结论。

## 输出
只输出一个 JSON 对象，禁止 markdown、禁止代码围栏。

JSON 字段说明：
- evidenceBasis：2～4句，清楚说明「本摘要依据哪些材料（原述条数、档案有无、未做体格与检验等）」。
- informationGaps：字符串数组，列出**仍未掌握**、且对诊疗有意义的关键信息（如起病时间、诱因、伴随症状、用药名与剂量、过敏史未提及等）；若确实信息较全可写少量项写「其余待面诊体格检查与检验」。
- conflictsOrUncertainties：一段话，写明口述含糊、前后不一、或与档案冲突、需当面核实之处；没有则写「未见明确冲突；部分信息较简略，需面诊补充。」
- chiefComplaint / historyOfPresentIllness 等：书面语汇总，**忠实于材料**；缺则写「本次线上未提供」。
- triageImpression：分诊层面 1～2 句，避免诊断式结论。
- suggestedDepartments：至多 3 个，**若无把握可返回空数组**，不要为了填而填。
- urgencyLevel：**一般** | **今日尽快** | **紧急** | **信息不足，须由医生当面评估紧急程度**（材料不足时务必选最后一项并在 informationGaps 说明）。
- familyPreparedQuestions：家属可能想在门诊问的问题，最多 3 条，无则 []。
- clinicReminder：给接诊方一句可读提示，无则空字符串。

JSON 结构：
{
  "evidenceBasis": "",
  "informationGaps": [""],
  "conflictsOrUncertainties": "",
  "chiefComplaint": "",
  "historyOfPresentIllness": "",
  "pastHistoryMedications": "",
  "allergies": "",
  "reviewOfSystems": "",
  "labsAndImaging": "",
  "triageImpression": "",
  "suggestedDepartments": [],
  "urgencyLevel": "",
  "familyPreparedQuestions": [],
  "clinicReminder": ""
}`;

    const userPrompt = `${healthContext ? `${healthContext}\n` : ''}${factsBlock ? `【会话中已提取的结构化要点（须与原述交叉核对）】\n${factsBlock}\n\n` : ''}${asstHints ? `${asstHints}\n\n` : ''}${advisorTranscriptBlock ? `${advisorTranscriptBlock}\n\n` : ''}${userBlock}\n\n请先完成理解与前述核对，再输出完整 JSON。`;

    const llmResult = await this.callLlm(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      config,
      { temperature: Math.min(0.22, config.temperature), maxTokens: 1800 },
    );

    let structured: Record<string, unknown>;
    try {
      const cleaned = llmResult.content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      structured = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      this.logger.warn(`clinic-handoff JSON parse failed: ${llmResult.content?.slice(0, 200)}`);
      throw new BadRequestException('摘要生成异常，请稍后重试');
    }

    if (structured.informationGaps != null && !Array.isArray(structured.informationGaps)) {
      structured.informationGaps = [String(structured.informationGaps)];
    }
    if (!Array.isArray(structured.informationGaps)) structured.informationGaps = [];

    const dateStr = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const plainText = this.formatClinicHandoffPlainText(structured as any, patientLine, dateStr);

    return {
      patientLine,
      generatedAt: dateStr,
      structured,
      plainText,
      tokensUsed: llmResult.tokensUsed,
    };
  }

  private formatClinicHandoffPlainText(
    d: {
      evidenceBasis?: string;
      informationGaps?: string[];
      conflictsOrUncertainties?: string;
      chiefComplaint?: string;
      historyOfPresentIllness?: string;
      pastHistoryMedications?: string;
      allergies?: string;
      reviewOfSystems?: string;
      labsAndImaging?: string;
      triageImpression?: string;
      suggestedDepartments?: string[];
      urgencyLevel?: string;
      familyPreparedQuestions?: string[];
      clinicReminder?: string;
    },
    patientLine: string,
    dateStr: string,
  ): string {
    const sec = (title: string, body: string) => `【${title}】\n${(body || '').trim() || '—'}\n`;
    const gaps =
      Array.isArray(d.informationGaps) && d.informationGaps.length
        ? d.informationGaps.map(String).filter(Boolean).map((g, i) => `${i + 1}. ${g}`).join('\n')
        : '';
    const lines: string[] = [
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      '陪了个伴 · 就诊信息摘要（家属/患者线上预整理）',
      `整理时间：${dateStr}`,
      patientLine,
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
    ];
    lines.push(sec('摘要依据与范围', d.evidenceBasis || ''));
    lines.push(sec('信息缺口（线上未掌握或需面诊补充）', gaps || '—'));
    lines.push(sec('不确定、冲突或需当面核实之处', d.conflictsOrUncertainties || ''));
    lines.push(sec('主诉（据线上材料归纳）', d.chiefComplaint || ''));
    lines.push(sec('现病史（据线上材料归纳）', d.historyOfPresentIllness || ''));
    lines.push(sec('既往史与用药', d.pastHistoryMedications || ''));
    lines.push(sec('过敏史', d.allergies || ''));
    lines.push(sec('系统回顾', d.reviewOfSystems || ''));
    lines.push(sec('化验与检查（仅列材料中已出现者）', d.labsAndImaging || ''));
    lines.push(sec('分诊印象（非诊断、非医学证明）', d.triageImpression || ''));
    const deps = Array.isArray(d.suggestedDepartments)
      ? d.suggestedDepartments.map(String).filter(Boolean).join('、')
      : '';
    lines.push(sec('建议就诊科室（供分诊参考，可留空）', deps || '—'));
    lines.push(sec('紧急程度（线上判断有限）', d.urgencyLevel || '—'));
    const qs = Array.isArray(d.familyPreparedQuestions)
      ? d.familyPreparedQuestions.map(String).filter(Boolean)
      : [];
    lines.push(sec('家属希望在门诊澄清', qs.length ? qs.map((q, i) => `${i + 1}. ${q}`).join('\n') : '—'));
    if ((d.clinicReminder || '').trim()) lines.push(sec('门诊提示', d.clinicReminder!));
    lines.push('');
    lines.push('————————————————————————');
    lines.push('【重要声明（请接诊方与患者家属知悉）】');
    lines.push(
      '1. 本材料由互联网平台根据线上文字/语音咨询及用户填写的健康档案自动生成或辅助生成，未实施体格检查、实验室或影像学检查；不等同于医院官方病历。',
    );
    lines.push(
      '2. 内容可能存在转述偏差、遗漏或误解，不构成也不应被理解为「医学诊断」「治疗建议」或「预后判断」；不能替代具有资质的医务人员当面评估。',
    );
    lines.push(
      '3. 任何诊疗决策须以院内规范病历、医生面诊、检验检查及适用的法律法规为准。违者责任不在本摘要文本本身。',
    );
    lines.push('————————————————————————');
    return lines.join('\n');
  }

  async getSessions(userId: number, page = 1, pageSize = 20) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const qb = this.consultRepo
      .createQueryBuilder('c')
      .select('c.session_id', 'sessionId')
      .addSelect('c.service_target_id', 'serviceTargetId')
      .addSelect('MIN(c.content)', 'firstMessage')
      .addSelect('MAX(c.created_at)', 'lastMessageAt')
      .addSelect('COUNT(*)', 'messageCount')
      .where('c.user_id = :userId', { userId })
      .groupBy('c.session_id')
      .addGroupBy('c.service_target_id')
      .orderBy('MAX(c.created_at)', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const items = await qb.getRawMany();
    return { items, page, pageSize };
  }

  async getSessionMessages(userId: number, sessionId: string) {
    await this.assertMiniprogramAiAdvisorEnabled();
    return this.consultRepo.find({
      where: { sessionId, userId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 用户删除自己会话下的全部问诊消息 */
  async deleteSessionForUser(userId: number, sessionId: string) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const sid = sessionId?.trim();
    if (!sid) throw new BadRequestException('缺少会话标识');
    const result = await this.consultRepo.delete({ userId, sessionId: sid });
    if (!result.affected) throw new BadRequestException('会话不存在或已删除');
    return { deleted: result.affected };
  }

  /** 管理员删除指定用户某会话的全部消息（需 userId + sessionId 同时匹配） */
  async adminDeleteUserSession(userId: number, sessionId: string) {
    const sid = sessionId?.trim();
    if (!sid) throw new BadRequestException('缺少会话标识');
    const one = await this.consultRepo.findOne({ where: { userId, sessionId: sid } });
    if (!one) throw new BadRequestException('会话不存在');
    const result = await this.consultRepo.delete({ userId, sessionId: sid });
    return { deleted: result.affected || 0 };
  }

  async adminFindAll(query: { page?: number; pageSize?: number; userId?: number; keyword?: string }) {
    const { userId, keyword } = query;
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    const qb = this.consultRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (userId) qb.andWhere('c.userId = :userId', { userId });
    if (keyword) qb.andWhere('c.content LIKE :kw', { kw: `%${keyword}%` });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async adminGetSessions(query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    const qb = this.consultRepo
      .createQueryBuilder('c')
      .leftJoin('c.user', 'user')
      .select('c.session_id', 'sessionId')
      .addSelect('c.user_id', 'userId')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.phone', 'phone')
      .addSelect('MIN(c.content)', 'firstMessage')
      .addSelect('MAX(c.created_at)', 'lastMessageAt')
      .addSelect('COUNT(*)', 'messageCount')
      .addSelect('SUM(c.tokens_used)', 'totalTokens')
      .groupBy('c.session_id')
      .addGroupBy('c.user_id')
      .addGroupBy('user.nickname')
      .addGroupBy('user.phone')
      .orderBy('MAX(c.created_at)', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const items = await qb.getRawMany();
    const countQb = this.consultRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.session_id)', 'total');
    const countResult = await countQb.getRawOne();

    return { items, total: Number(countResult?.total || 0), page, pageSize };
  }

  /** 按客户维度聚合的问诊记录 */
  async adminGetByUser(query: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = query;
    const qb = this.consultRepo
      .createQueryBuilder('c')
      .leftJoin('c.user', 'user')
      .select('c.user_id', 'userId')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.phone', 'phone')
      .addSelect('user.avatar_url', 'avatarUrl')
      .addSelect('COUNT(DISTINCT c.session_id)', 'sessionCount')
      .addSelect('COUNT(*)', 'messageCount')
      .addSelect('SUM(c.tokens_used)', 'totalTokens')
      .addSelect('MIN(c.created_at)', 'firstMessageAt')
      .addSelect('MAX(c.created_at)', 'lastMessageAt')
      .groupBy('c.user_id')
      .addGroupBy('user.nickname')
      .addGroupBy('user.phone')
      .addGroupBy('user.avatar_url')
      .orderBy('MAX(c.created_at)', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const items = await qb.getRawMany();
    const countQb = this.consultRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.user_id)', 'total');
    const countResult = await countQb.getRawOne();

    return { items, total: Number(countResult?.total || 0), page, pageSize };
  }

  /** 获取某个客户的所有对话（跨会话，按时间排列） */
  async adminGetUserMessages(userId: number, query: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 50 } = query;
    const [items, total] = await this.consultRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async adminGetSessionDetail(sessionId: string) {
    return this.consultRepo.find({
      where: { sessionId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  // ─── A4: 健康材料解读（报告 / 药盒 / 图文等）────────────────

  async interpretReport(userId: number, dto: { reportText: string; sessionId?: string; serviceTargetId?: number }) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const config = await this.getAiConfig();
    if (!config.enabled) throw new BadRequestException('AI 问诊功能暂未开启');
    if (!config.apiKey) throw new BadRequestException('AI 服务尚未配置，请联系管理员');

    const effectiveConsultSession = dto.sessionId?.trim() || null;
    const sessionId =
      effectiveConsultSession || `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const rptTarget = await this.loadServiceTargetForConsultContext(userId, dto.serviceTargetId);
    const healthContext = rptTarget ? this.buildHealthContext(rptTarget) : '';
    let resolvedRptTargetId: number | null = rptTarget?.id ?? null;
    if (resolvedRptTargetId == null && dto.serviceTargetId != null) {
      const n = Number(dto.serviceTargetId);
      if (Number.isFinite(n) && n > 0) resolvedRptTargetId = Math.floor(n);
    }

    const sessionHistory = effectiveConsultSession
      ? await this.consultRepo.find({
          where: { sessionId: effectiveConsultSession, userId },
          order: { createdAt: 'ASC' },
          take: 40,
        })
      : [];

    const crossSessionRecap = await this.buildCrossSessionRecap(userId, sessionId);
    const knowledgeInject = retrieveAdvisorKnowledge(dto.reportText);

    let sessionDialogBlock = '';
    if (sessionHistory.length > 0) {
      const lines: string[] = [];
      for (const m of sessionHistory.slice(-24)) {
        const label = m.role === 'user' ? '用户' : '顾问';
        let t = (m.content || '').replace(/\s+/g, ' ').trim();
        if (t.length > 400) t = t.slice(0, 400) + '…';
        lines.push(`${label}：${t}`);
      }
      sessionDialogBlock =
        '\n\n【本会话中此前的咨询与回复（解读材料时请结合，尤其症状与用药）】\n' + lines.join('\n');
    }

    const revHist = [...sessionHistory].reverse();
    const lastAsstFacts = revHist.find((m) => m.role === 'assistant');
    const rawFacts = lastAsstFacts?.parsedResult?.sessionFacts;
    const factsSystem =
      rawFacts && typeof rawFacts === 'object'
        ? this.formatSessionFactsForSystem(rawFacts as Record<string, unknown>)
        : '';
    const factsBlock = factsSystem
      ? `\n\n【本场已提取的结构化要点（解读材料时请结合）】\n${factsSystem}`
      : '';

    const materialUrls = extractUrlsFromMaterialText(dto.reportText);
    let visionParts: MultimodalContentPart[] = [];
    if (config.visionModel && materialUrls.length) {
      visionParts = await this.loadMaterialImagesForVision(materialUrls);
    }

    const interpretSystem = `你是陪了个伴的 AI 助手，协助用户理解其提交的「健康相关材料」。

材料可能是：医学检验/检查报告、药盒或药品说明书、处方或病历片段、体检材料、与健康相关的其他图文。**禁止**默认把材料当成检验科化验单；禁止编造不存在的项目名、数值、参考范围或医院信息。

## 必须遵守
1. 先根据真实可见内容判断性质，在 JSON 的 materialType 中标注。药盒/说明书/处方**不得**用「异常指标」文风硬凑化验报告。
2. **imageReadable**：仅当你确实从图像/文字中读出有效信息时为 true。若图像未附入、无法解码、严重模糊、或与链接无关，必须为 false；summary 中说明原因，并建议用户改用「手动输入文字」或请管理员在后台配置「视觉模型」与当前同一兼容 OpenAI 的多模态模型名称。
3. **字段**：
   - lab_report：abnormalItems 仅列你真实读到的有临床提示的异常项；无则 []。
   - medication_packaging / prescription：abnormalItems 必须为 []；用 medicationHints 描述可见药名、规格、用法线索；不作诊断，提醒遵医嘱与药师。
   - non_health / general_image：abnormalItems 为 []，summary 简要说明并引导上传合适材料。
4. 结合健康档案与上文对话（若有）。用语通俗，减少焦虑；不作处方级剂量指导。末尾不要在 JSON 里写冗长免责声明。

${healthContext || '（当前无咨询对象档案摘要）'}
${crossSessionRecap}
${sessionDialogBlock}
${factsBlock}
${knowledgeInject}

请以 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "materialType": "lab_report|medication_packaging|prescription|other_health_doc|general_image|unclear|non_health",
  "imageReadable": true或false,
  "summary": "200字以内为主；若无法可靠读图则说明限制",
  "abnormalItems": [{"item": "", "value": "", "meaning": ""}],
  "medicationHints": [{"name": "", "usageNote": "", "caution": ""}],
  "normalConclusion": "检验报告类可概括正常项；其他类型多为空字符串",
  "recommendedActions": [],
  "recommendedDepartments": [{"name": "", "confidence": 0.0, "reason": ""}],
  "severityLevel": "low|medium|high",
  "dietaryAdvice": "与材料相关时简短填写，否则空字符串",
  "limitations": "可选：说明依据限制"
}`;

    await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId,
        serviceTargetId: resolvedRptTargetId,
        role: 'user',
        content: `【健康材料解读】\n${dto.reportText}`,
      }),
    );

    const userText = `用户提交的材料如下：\n---\n${dto.reportText}\n---`;
    const userMessage: ChatMessage =
      visionParts.length > 0
        ? { role: 'user', content: [{ type: 'text', text: userText }, ...visionParts] }
        : { role: 'user', content: userText };

    const messages: ChatMessage[] = [{ role: 'system', content: interpretSystem }, userMessage];
    const useVision = visionParts.length > 0 && !!config.visionModel;
    const llmConfig = useVision
      ? {
          ...config,
          apiKey: config.visionApiKey || config.apiKey,
          baseUrl: (config.visionBaseUrl || config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        }
      : config;
    const llmResult = await this.callLlm(messages, llmConfig, {
      ...(useVision ? { model: config.visionModel } : {}),
    });
    const parsed = this.parseAiResponse(llmResult.content);

    const savedAsst = await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId,
        serviceTargetId: resolvedRptTargetId,
        role: 'assistant',
        content: parsed.summary || llmResult.content,
        parsedResult: parsed,
        tokensUsed: llmResult.tokensUsed,
      }),
    );

    const explicitFalse = parsed.imageReadable === false || parsed.imageReadable === 'false';
    const imageReadable =
      !explicitFalse &&
      (visionParts.length > 0 || parsed.imageReadable === true || parsed.imageReadable === 'true');

    return {
      sessionId,
      messageId: savedAsst.id,
      summary: parsed.summary || '',
      abnormalItems: parsed.abnormalItems || [],
      normalConclusion: parsed.normalConclusion || '',
      recommendedActions: parsed.recommendedActions || [],
      recommendedDepartments: parsed.recommendedDepartments || [],
      severityLevel: parsed.severityLevel || 'low',
      dietaryAdvice: parsed.dietaryAdvice || '',
      materialType: parsed.materialType || 'unclear',
      medicationHints: parsed.medicationHints || [],
      limitations: typeof parsed.limitations === 'string' ? parsed.limitations : '',
      imageReadable,
    };
  }

  // ─── B1: 医嘱录音 AI 结构化提取 ─────────────────────────────

  async extractMedicalOrders(transcribedText: string): Promise<{
    medications?: Array<{ name: string; usage: string; frequency?: string }>;
    followUp?: { date?: string; hospital?: string; department?: string; note?: string };
    keyAdvice?: string;
    diagnosisHint?: string;
  } | null> {
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) return null;

    const prompt = `你是一位专业的医嘱识别助手。以下是医生与患者对话的录音转写文本，请从中提取结构化的医嘱信息。

录音转写内容：
${transcribedText}

请以 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "medications": [
    {"name": "药品名称", "usage": "用法用量（如：每日2次，每次1片，饭后服用）", "frequency": "频率"}
  ],
  "followUp": {
    "date": "复诊日期（如果提到，格式 YYYY-MM-DD，否则为空）",
    "hospital": "复诊医院（如果提到）",
    "department": "复诊科室（如果提到）",
    "note": "复诊相关说明"
  },
  "keyAdvice": "医嘱关键内容总结（100字以内，通俗易懂）",
  "diagnosisHint": "医生可能提到的诊断方向（不做确诊判断，仅记录医生的说法）"
}

注意：只提取录音中实际提到的内容，没有提到的字段留空或为空数组。`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是陪了个伴的 AI 医嘱提取助手，擅长从医患对话中提取结构化医嘱。' },
        { role: 'user', content: prompt },
      ];
      const result = await this.callLlm(messages, config);
      return this.parseAiResponse(result.content);
    } catch (e) {
      this.logger.warn(`AI 医嘱提取失败: ${(e as Error)?.message}`);
      return null;
    }
  }

  // ─── C3: 用药交互作用检测 ─────────────────────────────────

  async checkMedicationInteractions(userId: number, dto: { medications: string[]; serviceTargetId?: number }) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) throw new BadRequestException('AI 服务尚未配置');

    const medTarget = await this.loadServiceTargetForConsultContext(userId, dto.serviceTargetId);
    const healthContext = medTarget ? this.buildHealthContext(medTarget) : '';
    let resolvedMedTargetId: number | null = medTarget?.id ?? null;
    if (resolvedMedTargetId == null && dto.serviceTargetId != null) {
      const n = Number(dto.serviceTargetId);
      if (Number.isFinite(n) && n > 0) resolvedMedTargetId = Math.floor(n);
    }

    const prompt = `你是一位专业的药物安全顾问。请分析以下药物列表是否存在相互作用或禁忌搭配。
${healthContext}

用户当前服用的药物：${dto.medications.join('、')}

请以 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "safe": true或false,
  "summary": "整体安全性评估（100字以内）",
  "interactions": [
    {"drug1": "药物A", "drug2": "药物B", "level": "low|medium|high", "description": "交互作用说明"}
  ],
  "warnings": ["需要注意的事项"],
  "advice": "综合用药建议（100字以内）"
}

重要：用通俗语言解释，帮助患者理解。如果没有发现明显冲突，也请说明安全用药注意事项。`;

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是陪了个伴的 AI 药物安全顾问。' },
      { role: 'user', content: prompt },
    ];
    const result = await this.callLlm(messages, config);
    const parsed = this.parseAiResponse(result.content);

    const medSid = `med_${Date.now()}`;
    await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId: medSid,
        serviceTargetId: resolvedMedTargetId,
        role: 'user',
        content: `【用药冲突检测】${dto.medications.join('、')}`,
      }),
    );
    await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId: medSid,
        serviceTargetId: resolvedMedTargetId,
        role: 'assistant',
        content: parsed.summary || result.content,
        parsedResult: parsed,
        tokensUsed: result.tokensUsed,
      }),
    );

    return parsed;
  }

  // ─── C8: 智能饮食建议 ──────────────────────────────────────

  async getDietaryAdvice(userId: number, dto: { condition?: string; serviceTargetId?: number }) {
    await this.assertMiniprogramAiAdvisorEnabled();
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) throw new BadRequestException('AI 服务尚未配置');

    const dietTarget = await this.loadServiceTargetForConsultContext(userId, dto.serviceTargetId);
    const healthContext = dietTarget ? this.buildHealthContext(dietTarget) : '';
    let resolvedDietTargetId: number | null = dietTarget?.id ?? null;
    if (resolvedDietTargetId == null && dto.serviceTargetId != null) {
      const n = Number(dto.serviceTargetId);
      if (Number.isFinite(n) && n > 0) resolvedDietTargetId = Math.floor(n);
    }

    const userCondition = dto.condition ? `\n用户当前状况/需求：${dto.condition}` : '';

    const prompt = `你是一位专业的营养健康顾问。请根据用户的健康档案信息，提供个性化的饮食建议。
${healthContext}${userCondition}

请以 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "summary": "整体饮食建议概述（100字以内）",
  "recommended": [
    {"category": "分类（如：蛋白质/蔬菜/谷物）", "foods": ["推荐食物1", "推荐食物2"], "reason": "推荐理由"}
  ],
  "avoid": [
    {"food": "应避免的食物", "reason": "避免原因"}
  ],
  "mealPlan": "一日三餐建议（简要版）",
  "tips": ["饮食小贴士1", "饮食小贴士2"],
  "hydration": "每日饮水建议"
}

重要：结合用户的既往病史、过敏史和当前用药来给出建议，确保推荐安全合理。`;

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是陪了个伴的 AI 营养顾问。' },
      { role: 'user', content: prompt },
    ];
    const result = await this.callLlm(messages, config);
    const parsed = this.parseAiResponse(result.content);

    const dietSid = `diet_${Date.now()}`;
    await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId: dietSid,
        serviceTargetId: resolvedDietTargetId,
        role: 'user',
        content: `【智能饮食建议】${dto.condition || '综合建议'}`,
      }),
    );
    await this.consultRepo.save(
      this.consultRepo.create({
        userId,
        sessionId: dietSid,
        serviceTargetId: resolvedDietTargetId,
        role: 'assistant',
        content: parsed.summary || result.content,
        parsedResult: parsed,
        tokensUsed: result.tokensUsed,
      }),
    );

    return parsed;
  }

  // ─── 完成资料：根据时间线生成服务总结草稿 ─────────────────

  async generateCompletionSummaryDraft(
    meta: {
      serviceType?: string;
      hospital?: string;
      department?: string;
      patientName?: string;
    },
    timelines: Array<{
      type?: string;
      content?: string | null;
      createdAt?: Date | string;
      metadata?: Record<string, unknown> | null;
    }>,
  ): Promise<{ summary: string } | null> {
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) return null;

    const typeLabel: Record<string, string> = {
      text: '文字记录',
      image: '照片',
      node: '状态节点',
      audio_question: '问诊录音',
      audio_advice: '医嘱录音',
      file: '文件',
      internal_note: '内部备注',
      emergency: '紧急',
      service_start: '服务开始',
      service_end: '服务结束',
    };

    const sorted = [...timelines].sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
    const lines: string[] = [];
    for (const t of sorted.slice(-45)) {
      const label = typeLabel[t.type || ''] || t.type || '记录';
      let text = String(t.content || '').replace(/\s+/g, ' ').trim();
      if (t.type === 'node' && t.metadata && !text) {
        text = String((t.metadata as { note?: string }).note || '').trim();
      }
      if (!text) {
        if (t.type === 'audio_question' || t.type === 'audio_advice') {
          text = '（时间线中有录音，归纳时请结合上下文，勿臆测具体对话内容）';
        } else if (t.type === 'image') {
          text = '（照片类记录，详情以已上传图片为准）';
        } else if (t.type === 'file') {
          text = '（附件类记录）';
        } else {
          continue;
        }
      }
      if (text.length > 500) text = `${text.slice(0, 500)}…`;
      const ts = t.createdAt
        ? new Date(t.createdAt).toISOString().slice(0, 16).replace('T', ' ')
        : '';
      lines.push(`${ts} [${label}] ${text}`);
    }

    const headerParts = [
      `服务类型：${meta.serviceType || '陪诊'}`,
      `医院：${meta.hospital || '—'}`,
      `科室：${meta.department || '—'}`,
      `就诊人：${meta.patientName || '—'}`,
    ];

    const userPrompt = `你是陪诊服务记录撰写助手。根据以下「订单摘要」和「服务时间线」写一段给**客户阅读**的服务总结（不是医学诊断）。

${headerParts.join('\n')}

## 服务时间线（按时间排序，可能不完整）
${lines.length ? lines.join('\n') : '（暂无时间线文字记录；请根据订单信息写极简要说明，并提示陪诊员补充关键点。）'}

## 输出要求
请严格输出一个 JSON 对象（不要 markdown 代码块）：{"summary":"..."}。
- summary 在 360 字以内，分 2～4 句，口语化、客观；
- 只根据时间线中已有信息归纳：本次陪诊做了什么、医生主要意见或处理（**勿编造**化验数值、诊断病名或未出现的药名）；
- 写出客户后续需注意什么；若信息不足，如实说明「记录较简略」并列出 1～2 条建议补充点；
- 不要输出免责声明套话。`;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            '你只输出合法 JSON 对象，包含唯一键 summary，值为中文服务总结字符串。不要输出 markdown。',
        },
        { role: 'user', content: userPrompt },
      ];
      const result = await this.callLlm(messages, config, { temperature: 0.35, maxTokens: 900 });
      const parsed = this.parseAiResponse(result.content) as { summary?: string };
      const summary = String(parsed?.summary || '').trim();
      if (!summary) return null;
      return { summary: summary.slice(0, 500) };
    } catch (e) {
      this.logger.error('generateCompletionSummaryDraft failed', e);
      return null;
    }
  }

  /** 轻量：服务概况用，1～2 句概括时间线在「做了什么」层面的要点 */
  async generateTimelineDigest(
    meta: {
      hospital?: string;
      department?: string;
      patientName?: string;
    },
    timelines: Array<{
      type?: string;
      content?: string | null;
      createdAt?: Date | string;
      metadata?: Record<string, unknown> | null;
    }>,
  ): Promise<{ digest: string } | null> {
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) return null;

    const typeLabel: Record<string, string> = {
      text: '文字',
      image: '照片',
      node: '节点',
      audio_question: '问诊录音',
      audio_advice: '医嘱录音',
      file: '文件',
      internal_note: '内部备注',
      emergency: '紧急',
      service_start: '服务开始',
      service_end: '服务结束',
    };

    const sorted = [...timelines].sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
    const lines: string[] = [];
    for (const t of sorted.slice(-28)) {
      const label = typeLabel[t.type || ''] || t.type || '记录';
      let text = String(t.content || '').replace(/\s+/g, ' ').trim();
      if (t.type === 'node' && t.metadata && !text) {
        text = String((t.metadata as { note?: string }).note || '').trim();
      }
      if (!text) {
        if (t.type === 'audio_question' || t.type === 'audio_advice') text = '（有录音）';
        else if (t.type === 'image') text = '（有照片）';
        else if (t.type === 'file') text = '（有附件）';
        else continue;
      }
      if (text.length > 220) text = `${text.slice(0, 220)}…`;
      lines.push(`[${label}] ${text}`);
    }

    const header = `医院：${meta.hospital || '—'}；科室：${meta.department || '—'}；就诊人：${meta.patientName || '—'}`;
    const userPrompt = `你是陪诊服务记录的摘要助手。请根据下列「订单关键信息」和「服务时间线摘录」，用 **1～2 句中文**（总字数 **不超过 100 字**）概括：本次陪诊过程中主要做了哪些事、记录了哪些类型的动态。面向陪诊员与客户快速扫读，**不要**写成正式服务总结、不要医学诊断、不要医嘱解读。

${header}

## 时间线摘录（按时间顺序，可能不完整）
${lines.length ? lines.join('\n') : '（无可用摘录）'}

## 输出
只输出 JSON：{"digest":"..."}。digest 为概括正文。若几乎无文字信息，digest 可为：「时间线以图片或录音为主，文字较少。」`;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: '只输出合法 JSON，键 digest，值为中文字符串。不要 markdown。',
        },
        { role: 'user', content: userPrompt },
      ];
      const result = await this.callLlm(messages, config, { temperature: 0.25, maxTokens: 280 });
      const parsed = this.parseAiResponse(result.content) as { digest?: string };
      const digest = String(parsed?.digest || '').trim();
      if (!digest) return null;
      return { digest: digest.slice(0, 160) };
    } catch (e) {
      this.logger.error('generateTimelineDigest failed', e);
      return null;
    }
  }

  // ─── AI 陪诊报告生成 ──────────────────────────────────────

  async generateServiceReport(order: {
    orderNumber?: string;
    serviceType?: string;
    serviceTime?: string | Date;
    hospital?: string;
    department?: string;
    serviceTarget?: { name?: string; age?: number; gender?: string; healthProfile?: any };
    attendant?: { realName?: string; name?: string };
    completionData?: any;
    timelines?: Array<{ type?: string; content?: string; createdAt?: string | Date; visibleToUser?: boolean }>;
  }) {
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) return null;

    const completion = order.completionData || {};
    const target = order.serviceTarget || {};
    const hp: any = target.healthProfile || {};

    const contextParts: string[] = [];
    contextParts.push(`服务类型：${order.serviceType || '陪诊服务'}`);
    contextParts.push(`就诊医院：${order.hospital || '未知'}`);
    contextParts.push(`就诊科室：${order.department || '未知'}`);
    contextParts.push(`就诊人：${target.name || '未知'}，${target.gender === 'male' ? '男' : target.gender === 'female' ? '女' : ''}${target.age ? `，${target.age}岁` : ''}`);
    if (hp.allergies && hp.allergies !== '无') contextParts.push(`过敏史：${hp.allergies}`);

    const historyLabels: Record<string, string> = {
      hypertension: '高血压', heart: '心脏病', diabetes: '糖尿病',
      cerebrovascular: '脑血管疾病', epilepsy: '癫痫', asthma: '哮喘',
    };
    const histArr = (hp.medicalHistory || []).filter((v: string) => v !== 'none');
    if (histArr.length) contextParts.push(`既往病史：${histArr.map((v: string) => historyLabels[v] || v).join('、')}`);

    if (completion.summary) contextParts.push(`陪诊员总结：${completion.summary}`);
    if (completion.doctorAdvice) contextParts.push(`医嘱原文：${completion.doctorAdvice}`);

    const meds = Array.isArray(completion.medications) ? completion.medications : [];
    if (meds.length) {
      contextParts.push(`开药情况：${meds.map((m: any) => `${m.name}(${m.usage || ''})`).join('、')}`);
    }

    if (completion.followUpDate) {
      contextParts.push(`复诊安排：${completion.followUpDate} ${completion.followUpHospital || ''} ${completion.followUpDepartment || ''}`);
    }

    const tlEntries = (order.timelines || [])
      .filter((t) => t.visibleToUser !== false && t.content)
      .slice(0, 15)
      .map((t) => `[${t.type}] ${t.content}`)
      .join('\n');
    if (tlEntries) contextParts.push(`服务过程记录：\n${tlEntries}`);

    const reportPrompt = `你是一位专业的医疗陪诊报告撰写助手。请根据以下陪诊服务信息，生成一份结构化的陪诊服务报告。

## 服务信息
${contextParts.join('\n')}

## 要求
请以 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "diagnosisResult": "就诊结果总结（通俗易懂，100字以内）",
  "keyAdvice": "医嘱重点解读（将专业医嘱翻译成患者能理解的语言，150字以内）",
  "summary": "服务总结（完整的陪诊过程描述和健康建议，200字以内）",
  "healthTips": ["日常注意事项1", "日常注意事项2", "日常注意事项3"],
  "dietaryAdvice": "饮食建议（50字以内）",
  "followUpReminder": "复诊提醒（如有复诊安排则说明，否则给出一般性建议）"
}

重要：所有内容使用通俗易懂的中文，避免专业术语。末尾不需要免责声明。`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是陪了个伴的 AI 陪诊报告助手，负责将陪诊服务信息整理成结构化的专业报告。' },
        { role: 'user', content: reportPrompt },
      ];
      const result = await this.callLlm(messages, config);
      const parsed = this.parseAiResponse(result.content) || {};
      // 在 AI 文本报告基础上补一份结构化图文板块数据，
      // 小程序 / 家属端可以直接用它渲染图文卡片，避免前端再解析散文。
      const sections = this.composeEscortReportSections(parsed);
      return { ...parsed, sections };
    } catch (e) {
      this.logger.error('AI 报告生成失败', e);
      return null;
    }
  }

  /**
   * 从 AI 报告结果合成结构化图文板块（iconKey + 标题 + 段落/要点）。
   *
   * 约定与小程序 service-report 页面共用：
   *   - iconKey：material-symbols-outlined 图标名，前端按名渲染
   *   - tone：视觉色调枚举，前端用来映射卡片色系
   *   - bullets：可选的要点列表（如日常注意事项），前端做无序列表渲染
   */
  private composeEscortReportSections(aiResult: {
    diagnosisResult?: string;
    keyAdvice?: string;
    summary?: string;
    healthTips?: string[] | string;
    dietaryAdvice?: string;
    followUpReminder?: string;
  }): Array<{
    iconKey: string;
    title: string;
    content: string;
    bullets?: string[];
    tone: 'primary' | 'info' | 'success' | 'warning' | 'accent' | 'muted';
  }> {
    const sections: Array<{
      iconKey: string;
      title: string;
      content: string;
      bullets?: string[];
      tone: 'primary' | 'info' | 'success' | 'warning' | 'accent' | 'muted';
    }> = [];
    const push = (
      iconKey: string,
      title: string,
      content: string | undefined | null,
      tone:
        | 'primary'
        | 'info'
        | 'success'
        | 'warning'
        | 'accent'
        | 'muted',
      bullets?: string[],
    ) => {
      const text = (content || '').trim();
      const validBullets = (bullets || [])
        .map((b) => (b || '').trim())
        .filter(Boolean);
      if (!text && !validBullets.length) return;
      sections.push({ iconKey, title, content: text, tone, bullets: validBullets });
    };

    const tipsArr = Array.isArray(aiResult.healthTips)
      ? aiResult.healthTips
      : typeof aiResult.healthTips === 'string'
      ? aiResult.healthTips
          .split(/[\n;,，、]+/)
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

    push('stethoscope', '就诊结果', aiResult.diagnosisResult, 'info');
    push('medication', '医嘱解读', aiResult.keyAdvice, 'primary');
    push('restaurant', '饮食调养', aiResult.dietaryAdvice, 'success');
    push(
      'tips_and_updates',
      '日常注意事项',
      tipsArr.length ? '' : '建议继续关注身体情况，有不适及时就医。',
      'warning',
      tipsArr,
    );
    push('event_available', '复诊提醒', aiResult.followUpReminder, 'accent');
    push('summarize', '陪诊服务总结', aiResult.summary, 'muted');

    return sections;
  }

  async getStats() {
    const totalSessions = await this.consultRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.session_id)', 'count')
      .getRawOne();
    const totalMessages = await this.consultRepo.count();
    const totalTokens = await this.consultRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.tokens_used), 0)', 'total')
      .getRawOne();
    const todayMessages = await this.consultRepo
      .createQueryBuilder('c')
      .where('DATE(c.created_at) = CURDATE()')
      .getCount();

    return {
      totalSessions: Number(totalSessions?.count || 0),
      totalMessages,
      totalTokens: Number(totalTokens?.total || 0),
      todayMessages,
    };
  }

  // ─── C5: AI 健康周报 ──────────────────────────────────────

  @Cron('0 0 8 * * 1')
  async generateWeeklyReportsForAllUsers() {
    this.logger.log('开始生成 AI 健康周报...');
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) {
      this.logger.log('AI 未启用，跳过周报生成');
      return;
    }

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - 1);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const activeReminders = await this.reminderRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.user_id', 'userId')
      .where('r.status = :status', { status: 'active' })
      .getRawMany();

    const userIds = activeReminders.map((r: any) => Number(r.userId)).filter(Boolean);
    this.logger.log(`找到 ${userIds.length} 个活跃用药用户`);

    for (const userId of userIds) {
      try {
        await this.generateWeeklyReport(userId, undefined, fmt(weekStart), fmt(weekEnd));
      } catch (e) {
        this.logger.warn(`用户 ${userId} 周报生成失败: ${(e as Error)?.message}`);
      }
    }

    this.logger.log('AI 健康周报生成完毕');
  }

  async generateWeeklyReport(userId: number, serviceTargetId?: number, weekStartStr?: string, weekEndStr?: string) {
    const config = await this.getAiConfig();
    if (!config.enabled || !config.apiKey) throw new BadRequestException('AI 服务未配置');

    const now = new Date();
    const weekEnd = weekEndStr ? new Date(weekEndStr) : new Date(now.setDate(now.getDate() - 1));
    const weekStart = weekStartStr ? new Date(weekStartStr) : new Date(new Date(weekEnd).setDate(weekEnd.getDate() - 6));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const wsStr = fmt(weekStart);
    const weStr = fmt(weekEnd);

    const existing = await this.weeklyReportRepo.findOne({
      where: { userId, weekStart: wsStr, weekEnd: weStr, serviceTargetId: serviceTargetId ?? undefined } as any,
    });
    if (existing) return existing;

    const reminders = await this.reminderRepo.find({
      where: { userId },
      relations: ['serviceTarget'],
    });
    const activeReminders = reminders.filter((r) =>
      r.startDate <= weStr && r.endDate >= wsStr,
    );

    const totalDoses = activeReminders.reduce((sum, r) => {
      const times = Array.isArray(r.reminderTimes) ? r.reminderTimes.length : 1;
      return sum + times * 7;
    }, 0);

    const orders = await this.orderRepo.find({
      where: { userId },
      relations: ['serviceTarget'],
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const recentOrders = orders.filter((o) => {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      return d >= wsStr && d <= weStr;
    });

    const weeklyTarget = await this.loadServiceTargetForConsultContext(userId, serviceTargetId ?? null);
    const healthContext = weeklyTarget ? this.buildHealthContext(weeklyTarget) : '';

    const contextParts: string[] = [];
    contextParts.push(`统计周期：${wsStr} 至 ${weStr}`);
    contextParts.push(`活跃用药提醒数：${activeReminders.length}`);
    contextParts.push(`每周应服药总次数：${totalDoses}`);
    if (activeReminders.length) {
      contextParts.push(`用药清单：${activeReminders.map((r) => `${r.medicineName}(${r.dosage || '按医嘱'})`).join('、')}`);
    }
    if (recentOrders.length) {
      contextParts.push(`本周就诊：${recentOrders.map((o) => `${o.serviceType || '陪诊'} - ${o.hospital || ''} ${o.department || ''}`).join('；')}`);
    }

    const prompt = `你是陪了个伴的 AI 健康周报生成助手。请根据以下用户信息生成一份温暖、专业的健康周报。
${healthContext}

## 本周数据
${contextParts.join('\n')}

请以 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "greeting": "亲切的问候语（20字以内，如'本周您的健康表现不错！'）",
  "medicationSummary": "用药执行情况总结（50字以内）",
  "healthHighlights": ["本周健康亮点1", "健康亮点2"],
  "concerns": ["需要关注的健康问题（如有）"],
  "nextWeekAdvice": ["下周健康建议1", "建议2"],
  "dietTip": "本周饮食小贴士（30字以内）",
  "exerciseTip": "本周运动小建议（30字以内）",
  "emotionalNote": "一句温暖的关怀（30字以内，给老人力量和信心）"
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是陪了个伴的 AI 健康周报助手，语气温暖亲切，像家人一样关心用户。' },
      { role: 'user', content: prompt },
    ];

    const result = await this.callLlm(messages, config);
    const parsed = this.parseAiResponse(result.content);

    const report = await this.weeklyReportRepo.save(
      this.weeklyReportRepo.create({
        userId,
        serviceTargetId: serviceTargetId ?? weeklyTarget?.id ?? null,
        weekStart: wsStr,
        weekEnd: weStr,
        medicationStats: {
          total: totalDoses,
          taken: 0,
          missed: 0,
          adherenceRate: 0,
        },
        healthSummary: parsed.greeting
          ? `${parsed.greeting} ${parsed.medicationSummary || ''}`
          : result.content,
        aiAnalysis: parsed,
        rawData: {
          reminders: activeReminders.map((r) => ({ name: r.medicineName, dosage: r.dosage })),
          orders: recentOrders.map((o) => ({ type: o.serviceType, hospital: o.hospital })),
        },
      }),
    );

    return report;
  }

  async getWeeklyReports(userId: number, page = 1, pageSize = 10) {
    const [items, total] = await this.weeklyReportRepo.findAndCount({
      where: { userId },
      order: { weekEnd: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async getWeeklyReportById(id: number, userId: number) {
    const report = await this.weeklyReportRepo.findOne({
      where: { id, userId },
      relations: ['serviceTarget'],
    });
    if (!report) throw new BadRequestException('周报不存在');
    return report;
  }

  async adminGetWeeklyReports(query: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = query;
    const [items, total] = await this.weeklyReportRepo.findAndCount({
      relations: ['user', 'serviceTarget'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }
}
