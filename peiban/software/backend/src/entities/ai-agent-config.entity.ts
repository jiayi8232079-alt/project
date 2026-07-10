import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * AI 智能体配置版本状态。
 * - draft     草稿（运营编辑中，可反复保存）
 * - published 已发布（当前生效，每租户至多一条）
 * - archived  历史版本（被新版本替换后归档，保留回溯）
 */
export enum AgentConfigStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/**
 * AI 智能体配置（按租户 + 版本）。
 *
 * 版本策略：
 * - 每租户维护一条 draft（可反复保存覆盖）；
 * - 发布时把 draft 置为 published，旧的 published 归档（archived）；
 * - version 单调递增，便于回溯/对比历史 Prompt。
 */
@Entity('ai_agent_configs')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'version'])
export class AiAgentConfig extends TenantAwareEntity {
  @Column({ length: 64, default: '陪诊助手', comment: '智能体名称' })
  name: string;

  @Column({ length: 64, default: 'DeepSeek', comment: '模型' })
  model: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true, comment: '系统 Prompt' })
  systemPrompt: string | null;

  @Column({ name: 'memory_rounds', type: 'int', default: 20, comment: '记忆消息轮数' })
  memoryRounds: number;

  @Column({ type: 'float', nullable: true, comment: '采样温度 0-2' })
  temperature: number | null;

  @Column({
    name: 'knowledge_base',
    type: 'text',
    nullable: true,
    comment: '知识库说明 / 引用（权威源）',
  })
  knowledgeBase: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '工具开关（设备自控 / 端侧 MCP / 自定义 MCP 等）',
  })
  tools: Record<string, unknown> | null;

  @Column({ type: 'int', default: 1, comment: '版本号（单调递增）' })
  version: number;

  @Column({
    type: 'enum',
    enum: AgentConfigStatus,
    default: AgentConfigStatus.DRAFT,
    comment: '版本状态',
  })
  status: AgentConfigStatus;

  @Column({ name: 'published_at', type: 'datetime', nullable: true, comment: '发布时间' })
  publishedAt: Date | null;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '版本备注' })
  remark: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true, comment: '操作者 admin_user_id' })
  createdBy: number | null;
}
