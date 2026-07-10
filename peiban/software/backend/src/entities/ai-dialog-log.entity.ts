import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { AiDialogSession } from './ai-dialog-session.entity.js';

/**
 * 对话方向。
 */
export enum DialogDirection {
  /** 用户发出（ASR 识别结果，或文本输入） */
  USER = 'user',
  /** AI 助手回应（LLM 生成 + TTS 音频） */
  ASSISTANT = 'assistant',
  /** 系统提示词（保留用于检索/复盘，不一定展示给用户） */
  SYSTEM = 'system',
  /** 工具调用过程（toolCall 透传给业务记录，可视化用） */
  TOOL = 'tool',
}

/**
 * 情感识别结果 —— 来自涂鸦智能体的情感分析回调（v1.0 仅录用，UI 不强依赖）。
 */
export enum DialogEmotion {
  HAPPY = 'happy',
  NEUTRAL = 'neutral',
  SAD = 'sad',
  ANGRY = 'angry',
  ANXIOUS = 'anxious',
  /** 其它/无法识别 */
  UNKNOWN = 'unknown',
}

/**
 * AI 对话单条留存 —— 每一句话/每一次工具调用都是一行。
 *
 * 留存目的（PRD §12）：
 * 1. **合规审计**：医疗对话全量可追溯（PIPL + 算法备案）；
 * 2. **危机干预复盘**：触发危机词 → 后端规则升级时，可回看上下文；
 * 3. **质检**：运营按 sessionId 抽样审 + AI 自检覆盖；
 * 4. **优化**：分析 toolCalls 成功率，迭代 Prompt/工具描述。
 *
 * 设计要点：
 * - `text` 必填：即便是 audio 也存识别后的文本（音频原文走 audioUrl）；
 * - `audioUrl` 可空：仅在 audio 类型的 user 消息记录原始音频 URL（音频不长期保存原始流，仅短期 cache）；
 * - `toolCalls` JSON：assistant 这一轮发起的工具调用列表 + 入参 + 结果（脱敏后）；
 * - `crisisWords` JSON 数组：本条命中的危机词清单（如 ['胸痛','晕倒']）。
 */
@Entity('ai_dialog_logs')
@Index(['sessionId', 'createdAt'])
@Index(['deviceId', 'createdAt'])
@Index(['serviceTargetId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
@Index(['direction', 'createdAt'])
export class AiDialogLog extends TenantAwareEntity {
  @Column({ name: 'session_id', type: 'int' })
  sessionId: number;

  @ManyToOne(() => AiDialogSession, (s) => s.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: AiDialogSession;

  @Column({ name: 'device_id', type: 'int', nullable: true })
  deviceId: number | null;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'service_target_id', type: 'int', nullable: true })
  serviceTargetId: number | null;

  @Column({
    type: 'enum',
    enum: DialogDirection,
    comment: '消息方向（user/assistant/system/tool）',
  })
  direction: DialogDirection;

  @Column({ type: 'text', comment: '消息文本（assistant 端是 LLM 生成的回答）' })
  text: string;

  @Column({
    name: 'audio_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '原始音频 URL（极少保存，仅短期 cache）',
  })
  audioUrl: string | null;

  @Column({
    type: 'enum',
    enum: DialogEmotion,
    nullable: true,
    default: DialogEmotion.UNKNOWN,
    comment: '情感识别结果（智能体回调）',
  })
  emotion: DialogEmotion | null;

  @Column({
    name: 'crisis_words',
    type: 'json',
    nullable: true,
    comment: '本条命中的危机词列表',
  })
  crisisWords: string[] | null;

  @Column({
    name: 'tool_calls',
    type: 'json',
    nullable: true,
    comment: '本轮发起的 MCP 工具调用 [{name, args, result, durationMs, error?}]',
  })
  toolCalls: unknown[] | null;

  @Column({
    name: 'token_count',
    type: 'int',
    nullable: true,
    comment: 'LLM token 计数（计费用，仅 assistant 必填）',
  })
  tokenCount: number | null;

  @Column({
    name: 'latency_ms',
    type: 'int',
    nullable: true,
    comment: '端到端延迟毫秒（仅 assistant：从 user 消息到 TTS 完成）',
  })
  latencyMs: number | null;

  @Column({
    name: 'intent',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '识别到的意图（chat/order/medication/sos/...）',
  })
  intent: string | null;

  @Column({
    name: 'model_name',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '使用的 LLM 模型名（DeepSeek/Doubao/Qwen 等）',
  })
  modelName: string | null;
}
