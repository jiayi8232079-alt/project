import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { TenantUser } from './tenant-user.entity.js';

/**
 * 租户类型 —— 决定路由/计费/白标策略。
 *
 * - `platform`  平台自营（即陪了个伴本体，默认 tenant_id=1）
 * - `community` 社区/机构（按床位或人数计费，自带值班/服务记录大盘）
 * - `enterprise` 渠道企业 B 端（CRM + 分销分账）
 * - `personal`  个人开通（自然人独立空间，预留 To-C 自助开通）
 */
export enum TenantType {
  PLATFORM = 'platform',
  COMMUNITY = 'community',
  ENTERPRISE = 'enterprise',
  PERSONAL = 'personal',
}

/**
 * 租户生命周期状态。
 *
 * - `active`    正常运营
 * - `suspended` 暂停（欠费/审核），数据保留但拒绝写入
 * - `disabled`  归档/退出，按 PIPL 走删除流程
 * - `pending`   注册待审核
 */
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DISABLED = 'disabled',
  PENDING = 'pending',
}

/**
 * 租户在监管/渠道树中的层级类型（与 `type` 计费维度正交）。
 * PRD：平台 → 政府/渠道 → 机构 → 站点。
 */
export enum TenantScopeType {
  PLATFORM = 'platform',
  GOVERNMENT = 'government',
  ENTERPRISE = 'enterprise',
  ORGANIZATION = 'organization',
  SITE = 'site',
}

/**
 * 平台默认租户 ID —— 历史数据全部归属此租户，保证单租户兼容模式。
 * 业务代码引用此常量而非裸数字，便于以后改 ID 不爆破调用方。
 */
export const DEFAULT_TENANT_ID = 1;
export const DEFAULT_TENANT_CODE = 'default';

/**
 * 租户主表 —— 多租户 SaaS 的隔离粒度。
 *
 * 关键决策：
 * 1. 起步「共享库 + tenant_id」模式（PRD §13），机构量级大后再考虑分库；
 * 2. `code` 全局唯一（用于二级域名/白标识别），与 `id` 并存方便外部引用；
 * 3. `dataCenter` 与涂鸦云数据中心一致（PRD §6.2.3 数据中心约束），
 *    防止 MCP 服务与智能体跨中心导致不可见；
 * 4. `parentId` 预留机构集团 → 分院的两层结构，v1.0 全部为 null。
 */
@Entity('tenants')
@Index(['type'])
@Index(['status'])
export class Tenant extends BaseEntity {
  @Column({ unique: true, length: 64, comment: '租户唯一编码（用于二级域名/白标）' })
  code: string;

  @Column({ length: 128, comment: '租户显示名称' })
  name: string;

  @Column({
    type: 'enum',
    enum: TenantType,
    default: TenantType.PLATFORM,
    comment: '租户类型，决定计费/白标/路由策略',
  })
  type: TenantType;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.ACTIVE,
    comment: '生命周期状态',
  })
  status: TenantStatus;

  @Column({
    name: 'data_center',
    type: 'varchar',
    length: 32,
    default: 'cn-east-1',
    comment: '所属数据中心（须与涂鸦云一致）',
  })
  dataCenter: string;

  @Column({
    name: 'parent_id',
    type: 'int',
    nullable: true,
    comment: '父租户 ID（树形结构）',
  })
  parentId: number | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 255,
    default: '/',
    comment: '物化路径，如 /1/3/12/；平台根为 /',
  })
  path: string;

  @Column({
    type: 'tinyint',
    default: 0,
    comment: '树深度，平台根=0',
  })
  depth: number;

  @Index()
  @Column({
    name: 'scope_type',
    type: 'enum',
    enum: TenantScopeType,
    default: TenantScopeType.ORGANIZATION,
    comment: '监管/渠道树层级类型',
  })
  scopeType: TenantScopeType;

  @Index()
  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '行政区划码（政府租户）',
  })
  regionCode: string | null;

  @Column({
    name: 'org_chain',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '组织链路 JSON 快照（展示用）',
  })
  orgChain: string | null;

  @Column({
    name: 'contact_name',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '主联系人',
  })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '主联系人电话',
  })
  contactPhone: string | null;

  /**
   * 白标 / 业务策略配置 —— 留 JSON 防止后续每加一个开关都迁表。
   * 推荐字段：
   * - `branding`: { logoUrl, primaryColor, footerText }
   * - `quota`:    { maxDevices, maxResidents, maxAdmins }
   * - `features`: { aiAdvisor: boolean, fallRadar: boolean, ... }
   */
  @Column({
    type: 'json',
    nullable: true,
    comment: '白标/配额/功能开关等扩展配置',
  })
  settings: Record<string, unknown> | null;

  @OneToMany(() => TenantUser, (tu) => tu.tenant)
  tenantUsers: TenantUser[];
}
