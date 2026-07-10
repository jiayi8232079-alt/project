import { Entity, Column, Index, ManyToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { TenantRole } from './tenant-role.entity.js';

/**
 * 权限点 —— RBAC 最小授权单元。
 *
 * 设计要点：
 * - `code` 全局唯一，格式 `<resource>:<action>`（如 `order:read` / `order:cancel`）；
 * - `resource` + `action` 是 `code` 的结构化拆分，便于按资源批量授权；
 * - 不分租户：权限点是「系统能力清单」，由平台维护；
 *   租户仅决定「把哪些权限点挂在哪个角色上」（见 tenant_role_permissions 关联表）。
 *
 * v1.0 仅建表 + 内置少量权限点占位（device/ai-gateway 模块所需），
 * 细粒度权限校验保留到 Wave1.x。
 */
@Entity('tenant_permissions')
@Index(['resource'])
export class TenantPermission extends BaseEntity {
  @Column({ unique: true, length: 64, comment: '权限编码，格式 resource:action' })
  code: string;

  @Column({ length: 64, comment: '资源名（order/device/tenant 等）' })
  resource: string;

  @Column({ length: 32, comment: '动作（read/write/delete/audit 等）' })
  action: string;

  @Column({ length: 128, comment: '权限显示名（中文）' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '权限描述' })
  description: string | null;

  @ManyToMany(() => TenantRole, (role) => role.permissions)
  roles: TenantRole[];
}
