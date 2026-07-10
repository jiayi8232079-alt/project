import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';

@Entity('ai_consultations')
export class AiConsultation extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId: string;

  @Column({ name: 'service_target_id', type: 'int', nullable: true })
  serviceTargetId: number | null;

  /** user | assistant */
  @Column({ type: 'varchar', length: 16 })
  role: string;

  @Column({ type: 'text' })
  content: string;

  /** AI 返回的结构化结果（仅 role=assistant 时有值） */
  @Column({ name: 'parsed_result', type: 'json', nullable: true })
  parsedResult: {
    extractedSymptoms?: string[];
    recommendedDepartments?: Array<{
      name: string;
      confidence: number;
      reason: string;
    }>;
    severityLevel?: string;
    followUpQuestions?: string[];
    summary?: string;
    preparationChecklist?: string[];
    sessionFacts?: Record<string, unknown>;
  } | null;

  /** 本次调用消耗的 token 数（可选） */
  @Column({ name: 'tokens_used', type: 'int', nullable: true })
  tokensUsed: number | null;

  /** 用户对助手该条回复的评价：null=未评，true=有用，false=没用 */
  @Column({ name: 'feedback_helpful', type: 'boolean', nullable: true })
  feedbackHelpful: boolean | null;
}
