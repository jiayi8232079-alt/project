import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 记忆层（对齐 V4.3 §8.5「一个家庭，多成员记忆」）：
 * - member_identity 成员身份记忆（称呼/关系/角色/权限）
 * - member_private  成员个人记忆（按成员严格隔离，默认不向其他成员公开）
 * - family_shared   家庭共享记忆（生日/家庭日程/共享留言/共同事件）
 * - health_fact     长辈健康事实（慢病/用药/体征/复诊/风险事件）
 * - robot_relation  机器人关系记忆（昵称/性格/口头禅/家庭默契，随换机迁移）
 */
export enum CompanionMemoryScope {
  MEMBER_IDENTITY = 'member_identity',
  MEMBER_PRIVATE = 'member_private',
  FAMILY_SHARED = 'family_shared',
  HEALTH_FACT = 'health_fact',
  ROBOT_RELATION = 'robot_relation',
}

export enum CompanionMemoryStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

@Entity('companion_memories')
@Index(['familyId', 'scope', 'status'])
@Index(['memberId', 'scope', 'status'])
@Index(['expiresAt'])
export class CompanionMemory extends TenantAwareEntity {
  @Column({ name: 'family_id', type: 'int' })
  familyId: number;

  /** 记忆归属成员；个人记忆按成员隔离，家庭共享记忆此字段可空 */
  @Column({ name: 'member_id', type: 'int', nullable: true })
  memberId: number | null;

  @Column({
    type: 'enum',
    enum: CompanionMemoryScope,
    default: CompanionMemoryScope.MEMBER_PRIVATE,
  })
  scope: CompanionMemoryScope;

  /** 可选的语义键，便于同类记忆去重/更新（如 favorite_food、bedtime） */
  @Column({ name: 'memory_key', type: 'varchar', length: 128, nullable: true })
  memoryKey: string | null;

  @Column({ type: 'text' })
  content: string;

  /** 记忆来源：conversation / family_app / community / system */
  @Column({ name: 'source', type: 'varchar', length: 64, default: 'conversation' })
  source: string;

  @Column({
    type: 'enum',
    enum: CompanionMemoryStatus,
    default: CompanionMemoryStatus.ACTIVE,
  })
  status: CompanionMemoryStatus;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'corrected_at', type: 'datetime', nullable: true })
  correctedAt: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;
}
