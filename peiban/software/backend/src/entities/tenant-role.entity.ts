import { Entity, Column, Index, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { Tenant } from './tenant.entity.js';
import { TenantPermission } from './tenant-permission.entity.js';

/**
 * 租户内的角色定义 —— RBAC 的「角色」节点。
 *
 * 与现有 `UserRole` 枚举的关系：
 * - 现有 `UserRole`（admin/operator/finance/...）是「平台内置角色」的硬编码，
 *   v1.0 仍然生效，作用于 RolesGuard；
 * - 本表是「可由租户自定义的角色」，v1.0 主要做内置角色入库 + 留扩展点，
 *   细粒度权限切换在 Wave1.x 完成。
 *
 * 关键约定：
 * - `tenantId = null` 表示「平台预置角色」（所有租户共享，不可编辑）；
 * - `tenantId` 非空时表示该角色仅属于此租户，不跨租户。
 * - 同一租户内 `code` 唯一（联合唯一约束在 §SQL 迁移里加 UNIQUE INDEX）。
 */
@Entity('tenant_roles')
@Index(['tenantId', 'code'], { unique: true })
@Index(['isBuiltin'])
export class TenantRole extends BaseEntity {
  @Column({
    name: 'tenant_id',
    type: 'int',
    nullable: true,
    comment: 'null = 平台预置角色（全租户共享）',
  })
  tenantId: number | null;

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({ length: 64, comment: '角色编码（同租户内唯一）' })
  code: string;

  @Column({ length: 64, comment: '角色显示名' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '角色用途描述' })
  description: string | null;

  @Column({
    name: 'is_builtin',
    type: 'boolean',
    default: false,
    comment: '内置角色不可被租户管理员删除/改名',
  })
  isBuiltin: boolean;

  /**
   * 权限点关联 —— 多对多。
   * 注意：JoinTable 名 `tenant_role_permissions`，避免和未来可能加的
   * `role_permission_grants` 之类业务表撞名。
   */
  @ManyToMany(() => TenantPermission, (perm) => perm.roles, { cascade: false })
  @JoinTable({
    name: 'tenant_role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: TenantPermission[];
}
