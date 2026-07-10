import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { TriageSession } from './triage-session.entity.js';

/**
 * 导诊转人工后的双向留言（非实时诊疗，仅供就医协调沟通）
 */
@Entity('triage_session_messages')
@Index(['sessionId', 'createdAt'])
export class TriageSessionMessage extends TenantAwareEntity {
  @Column({ name: 'session_id' })
  sessionId: number;

  @ManyToOne(() => TriageSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: TriageSession;

  /** user=小程序用户 staff=后台客服 */
  @Column({ type: 'varchar', length: 16 })
  sender: 'user' | 'staff';

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'admin_user_id', type: 'int', nullable: true })
  adminUserId: number | null;
}
