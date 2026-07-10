import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { TriageSession } from './triage-session.entity.js';

/**
 * 导诊反馈表 — 用于人工复核 + 用户满意度 + 推荐准确率统计
 */
@Entity('triage_feedbacks')
export class TriageFeedback extends TenantAwareEntity {
  @Column({ name: 'session_id', type: 'int' })
  sessionId: number;

  @OneToOne(() => TriageSession)
  @JoinColumn({ name: 'session_id' })
  session: TriageSession;

  /** 人工是否接受 AI 推荐 */
  @Column({ name: 'human_accepted', type: 'tinyint', width: 1, nullable: true })
  humanAccepted: boolean | null;

  /** 实际下单的服务类型 */
  @Column({ name: 'actual_order_type', type: 'varchar', length: 64, nullable: true })
  actualOrderType: string | null;

  /** 用户满意度 1-5 */
  @Column({ type: 'int', nullable: true })
  satisfaction: number | null;

  /** 后续是否复购 */
  @Column({ name: 'follow_up_purchased', type: 'tinyint', width: 1, nullable: true })
  followUpPurchased: boolean | null;

  /** 备注 */
  @Column({ type: 'text', nullable: true })
  remark: string | null;
}
