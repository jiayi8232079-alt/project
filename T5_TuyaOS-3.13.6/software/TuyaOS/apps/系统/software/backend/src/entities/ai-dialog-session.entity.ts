import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { AiDialogLog } from './ai-dialog-log.entity.js';

/**
 * AI 对话会话 —— 一次完整的人机对话聚合记录（多条 log 的容器）。
 *
 * "会话"定义：
 * - 从用户唤醒/按键开始，到「VAD 静音 ≥ N 秒」或「主动结束」终止；
 * - 同一设备短时间多次唤醒视为不同会话（不合并）。
 *
 * 用途：
 * 1. **质检**：运营按 session 抽检 N 条对话；
 * 2. **计费**：按 session 聚合 token / 通话分钟；
 * 3. **复盘**：跌倒事件前的 session 是否提到不适？
 * 4. **APP 展示**：家属查看老人最近 7 天 AI 对话 → 列表按 session 显示摘要。
 *
 * 设计要点：
 * - `summary` 由 LLM 在会话结束时异步生成（避免占用首响时延）；
 * - `crisisScore` 是综合危机评分（0-100），命中危机词后由后端规则计算；
 * - `endedAt` 可空：会话进行中 / 异常中断的 session 也保留。
 */
@Entity('ai_dialog_sessions')
@Index(['deviceId', 'startedAt'])
@Index(['userId', 'startedAt'])
@Index(['serviceTargetId', 'startedAt'])
@Index(['tenantId', 'startedAt'])
@Index(['crisisScore'])
export class AiDialogSession extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int', nullable: true, comment: '触发设备（机器人）' })
  deviceId: number | null;

  @Column({ name: 'user_id', type: 'int', nullable: true, comment: '关联账号（家属或老人本人）' })
  userId: number | null;

  @Column({
    name: 'service_target_id',
    type: 'int',
    nullable: true,
    comment: '关联服务对象（老人）',
  })
  serviceTargetId: number | null;

  @Column({
    name: 'agent_id',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '涂鸦智能体 ID（多 Agent 时区分）',
  })
  agentId: string | null;

  @Column({
    name: 'started_at',
    type: 'datetime',
    comment: '会话开始时间（首条 user message）',
  })
  startedAt: Date;

  @Column({
    name: 'ended_at',
    type: 'datetime',
    nullable: true,
    comment: '会话结束时间（VAD 超时或主动结束）',
  })
  endedAt: Date | null;

  @Column({ name: 'total_turns', type: 'int', default: 0, comment: '消息总条数' })
  totalTurns: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0, comment: '累计 token 数（计费用）' })
  totalTokens: number;

  @Column({
    type: 'text',
    nullable: true,
    comment: '会话摘要（结束后由 LLM 生成）',
  })
  summary: string | null;

  @Column({
    name: 'crisis_score',
    type: 'int',
    default: 0,
    comment: '综合危机评分（0-100，越高越紧急）',
  })
  crisisScore: number;

  @Column({
    name: 'crisis_words',
    type: 'json',
    nullable: true,
    comment: '本次会话命中的危机词列表 string[]',
  })
  crisisWords: string[] | null;

  @Column({
    name: 'mcp_tool_calls_count',
    type: 'int',
    default: 0,
    comment: 'MCP 工具调用总次数（便于运维分析）',
  })
  mcpToolCallsCount: number;

  @Column({
    name: 'qa_status',
    type: 'enum',
    enum: ['pending', 'sampled', 'reviewed', 'flagged'],
    default: 'pending',
    comment: '质检状态：pending=未抽 sampled=已抽 reviewed=已审 flagged=有问题',
  })
  qaStatus: 'pending' | 'sampled' | 'reviewed' | 'flagged';

  @OneToMany(() => AiDialogLog, (log) => log.session)
  logs: AiDialogLog[];
}
