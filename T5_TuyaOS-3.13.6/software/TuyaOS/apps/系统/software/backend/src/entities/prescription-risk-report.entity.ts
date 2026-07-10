import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';
import { MedicationPrescription } from './medication-prescription.entity.js';

export enum RiskReportScope {
  /** 单张处方内部相互作用评估 */
  PRESCRIPTION = 'prescription',
  /** 服务对象当前所有活跃用药的整体评估（跨处方） */
  TARGET = 'target',
}

export enum RiskReportLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * 单条相互作用发现项。
 */
export interface DrugInteractionFinding {
  /** 涉及的两个药名（按用户处方原文） */
  drugA: string;
  drugB: string;
  severity: 'high' | 'medium' | 'low';
  mechanism: string;
  recommendation: string;
  /** 数据来源：规则库命中 / LLM 分析 */
  source: 'rule' | 'llm';
  /** 命中的规则ID（source=rule 时） */
  ruleId?: number;
  /** 证据等级（source=rule 且有时） */
  evidenceLevel?: 'A' | 'B' | 'C';
}

export interface RiskReportPayload {
  /** 被评估的药物列表（用于前端展示） */
  medicines: Array<{
    medicineName: string;
    reminderId?: number | null;
    prescriptionId?: number | null;
    dosage?: string | null;
    severity?: string | null;
  }>;
  findings: DrugInteractionFinding[];
  /** LLM 输出的整体建议（给家属 / 护理人员） */
  summary: string;
  /** 所用 LLM 模型名，调试用 */
  model?: string;
  tokensUsed?: number | null;
  /** 评估时是否因LLM不可用降级（仅跑规则库） */
  llmFallback?: boolean;
}

/**
 * 处方 / 服务对象用药风险评估报告（最新一份）。
 *
 * 设计：每个 scope + 主体 ID 只保留最新一条；重新评估时直接 upsert。
 */
@Entity('prescription_risk_reports')
@Index(['scope', 'prescriptionId'])
@Index(['scope', 'serviceTargetId'])
@Index(['userId'])
export class PrescriptionRiskReport extends TenantAwareEntity {
  @Column({ type: 'enum', enum: RiskReportScope, comment: '评估范围' })
  scope: RiskReportScope;

  @Column({ name: 'user_id', comment: '归属用户（家属）' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'service_target_id', type: 'int', nullable: true })
  serviceTargetId: number | null;

  @ManyToOne(() => ServiceTarget, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget | null;

  @Column({ name: 'prescription_id', type: 'int', nullable: true })
  prescriptionId: number | null;

  @ManyToOne(() => MedicationPrescription, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: MedicationPrescription | null;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskReportLevel,
    default: RiskReportLevel.NONE,
    comment: '整体风险等级（取最高）',
  })
  riskLevel: RiskReportLevel;

  @Column({ type: 'int', default: 0, comment: '发现的相互作用条数' })
  findingsCount: number;

  @Column({ type: 'json', comment: '完整评估结果（medicines + findings + summary）' })
  payload: RiskReportPayload;

  @Column({
    name: 'assessed_by',
    type: 'int',
    nullable: true,
    comment: '触发评估的 admin_user_id 或 user_id',
  })
  assessedBy: number | null;

  @Column({
    name: 'assessed_at',
    type: 'datetime',
    comment: '评估时间（便于直接排序而不看 createdAt）',
  })
  assessedAt: Date;
}
