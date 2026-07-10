import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { Tenant } from './tenant.entity.js';
import { User } from './user.entity.js';
import { TenantRole } from './tenant-role.entity.js';

/**
 * 用户在租户内的成员关系 —— 一个用户可在多个租户下扮演不同角色。
 *
 * 关键决策：
 * - 与现有 `users.tenant_id`（Step 2 加，表示「主租户」）并存：
 *   主租户决定登录默认 JWT 的 tenantId；本表支持「切换租户」时按 user+tenant 查到对应角色。
 * - `roleId` 关联 `tenant_roles`；v1.0 允许为空（fallback 到 `users.role` 内置枚举）。
 * - `isOwner` 标记租户的「管理员/创建者」，关停/计费等高风险动作需要 owner 校验。
 * - `(tenantId, userId)` 联合唯一，禁止同一用户在同一租户下重复挂关系。
 */
@Entity('tenant_users')
@Index(['tenantId', 'userId'], { unique: true })
@Index(['userId'])
@Index(['roleId'])
export class TenantUser extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'int', comment: '所属租户' })
  tenantId: number;

  @ManyToOne(() => Tenant, (t) => t.tenantUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'user_id', type: 'int', comment: '关联 users.id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'role_id',
    type: 'int',
    nullable: true,
    comment: '关联 tenant_roles；null = 仅用 users.role 内置枚举',
  })
  roleId: number | null;

  @ManyToOne(() => TenantRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role: TenantRole | null;

  @Column({
    name: 'is_owner',
    type: 'boolean',
    default: false,
    comment: '是否租户管理员（关停/计费等高风险操作必备）',
  })
  isOwner: boolean;

  @Column({
    type: 'enum',
    enum: ['active', 'invited', 'disabled'],
    default: 'active',
    comment: '关系状态：active=正常, invited=已邀请未接受, disabled=已停用',
  })
  status: 'active' | 'invited' | 'disabled';

  @Column({
    name: 'joined_at',
    type: 'datetime',
    nullable: true,
    comment: '加入时间（接受邀请时回填）',
  })
  joinedAt: Date | null;
}
