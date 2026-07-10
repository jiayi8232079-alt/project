import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';

/**
 * 慧诊通 AI 智能导诊会话
 * 每次用户提交导诊表单产生一条记录
 */
@Entity('triage_sessions')
export class TriageSession extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 关联的服务对象（患者），可为空（未建档时） */
  @Column({ name: 'patient_id', type: 'int', nullable: true })
  patientId: number | null;

  @ManyToOne(() => ServiceTarget, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: ServiceTarget | null;

  // ─── 用户原始输入 ───────────────────────────────────────

  /** 咨询人身份：self / child / relative / caregiver */
  @Column({ name: 'consultant_role', type: 'varchar', length: 32 })
  consultantRole: string;

  /** 患者年龄 */
  @Column({ name: 'patient_age', type: 'int' })
  patientAge: number;

  /** 患者性别 */
  @Column({ name: 'patient_gender', type: 'varchar', length: 16 })
  patientGender: string;

  /** 主要症状或问题（自由文本） */
  @Column({ name: 'main_symptom', type: 'text' })
  mainSymptom: string;

  /** 症状持续时间 */
  @Column({ name: 'symptom_duration', type: 'varchar', length: 64, nullable: true })
  symptomDuration: string | null;

  /** 当前严重程度：mild / moderate / severe */
  @Column({ name: 'severity_self', type: 'varchar', length: 32, nullable: true })
  severitySelf: string | null;

  /** 既往病史标签 JSON */
  @Column({ name: 'medical_history', type: 'json', nullable: true })
  medicalHistory: string[] | null;

  /** 当前用药 */
  @Column({ name: 'current_medication', type: 'text', nullable: true })
  currentMedication: string | null;

  /** 是否已有体检/检查结果 */
  @Column({ name: 'has_exam_result', type: 'tinyint', width: 1, default: 0 })
  hasExamResult: boolean;

  /** 患者所在城市 */
  @Column({ name: 'patient_city', type: 'varchar', length: 64, nullable: true })
  patientCity: string | null;

  /** 家属是否异地/海外 */
  @Column({ name: 'family_remote', type: 'tinyint', width: 1, default: 0 })
  familyRemote: boolean;

  /** 行动能力：normal / limited / bedridden */
  @Column({ type: 'varchar', length: 32, nullable: true })
  mobility: string | null;

  /** 是否独居 */
  @Column({ name: 'lives_alone', type: 'tinyint', width: 1, default: 0 })
  livesAlone: boolean;

  /** 就医目标：outpatient / checkup / expert / inpatient / care / unsure */
  @Column({ name: 'visit_goal', type: 'varchar', length: 32, nullable: true })
  visitGoal: string | null;

  /** 过敏史 */
  @Column({ name: 'allergy_info', type: 'text', nullable: true })
  allergyInfo: string | null;

  /** 是否近期出院 */
  @Column({ name: 'recently_discharged', type: 'tinyint', width: 1, default: 0 })
  recentlyDischarged: boolean;

  /** 完整原始输入 JSON（备份） */
  @Column({ name: 'raw_input', type: 'json', nullable: true })
  rawInput: Record<string, unknown> | null;

  // ─── AI / 规则输出 ──────────────────────────────────────

  /** 风险等级 R0-R3 */
  @Column({ name: 'risk_level', type: 'varchar', length: 8, nullable: true })
  riskLevel: string | null;

  /** 紧急程度 */
  @Column({ name: 'urgency_level', type: 'varchar', length: 32, nullable: true })
  urgencyLevel: string | null;

  /** 场景类型 */
  @Column({ name: 'scene_type', type: 'varchar', length: 64, nullable: true })
  sceneType: string | null;

  /** 推荐主科室 */
  @Column({ name: 'department_primary', type: 'varchar', length: 64, nullable: true })
  departmentPrimary: string | null;

  /** 推荐备选科室 */
  @Column({ name: 'department_secondary', type: 'json', nullable: true })
  departmentSecondary: string[] | null;

  /** 推荐服务路径 */
  @Column({ name: 'service_route', type: 'json', nullable: true })
  serviceRoute: string[] | null;

  /** 推荐产品 */
  @Column({ name: 'recommended_product', type: 'varchar', length: 128, nullable: true })
  recommendedProduct: string | null;

  /** 就医准备清单 */
  @Column({ name: 'prep_checklist', type: 'json', nullable: true })
  prepChecklist: string[] | null;

  /** 是否需要家属同步 */
  @Column({ name: 'family_sync_needed', type: 'tinyint', width: 1, default: 0 })
  familySyncNeeded: boolean;

  /** 是否需要转人工 */
  @Column({ name: 'escalate_to_human', type: 'tinyint', width: 1, default: 0 })
  escalateToHuman: boolean;

  /** 运营摘要 */
  @Column({ name: 'structured_summary', type: 'text', nullable: true })
  structuredSummary: string | null;

  /** 用户可读安全回复 */
  @Column({ name: 'safe_reply_text', type: 'text', nullable: true })
  safeReplyText: string | null;

  /** 完整 AI 输出 JSON */
  @Column({ name: 'final_json', type: 'json', nullable: true })
  finalJson: Record<string, unknown> | null;

  /** 使用的模型名称 */
  @Column({ name: 'model_name', type: 'varchar', length: 64, nullable: true })
  modelName: string | null;

  /** 命中的红旗规则 */
  @Column({ name: 'rule_hits', type: 'json', nullable: true })
  ruleHits: string[] | null;

  /** token 消耗 */
  @Column({ name: 'tokens_used', type: 'int', nullable: true })
  tokensUsed: number | null;

  /** 会话状态：pending / completed / escalated / converted */
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: string;

  /** 关联的订单 ID（转单后回填） */
  @Column({ name: 'converted_order_id', type: 'int', nullable: true })
  convertedOrderId: number | null;
}
