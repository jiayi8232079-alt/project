import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import {
  DEFAULT_TENANT_CODE,
  DEFAULT_TENANT_ID,
  Tenant,
  TenantScopeType,
  TenantStatus,
  TenantType,
} from '../../entities/tenant.entity.js';
import { TenantUser } from '../../entities/tenant-user.entity.js';
import { TenantRole } from '../../entities/tenant-role.entity.js';
import { TenantPermission } from '../../entities/tenant-permission.entity.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { ListTenantDto } from './dto/list-tenant.dto.js';
import { AddTenantUserDto } from './dto/add-tenant-user.dto.js';
import { TenantHierarchyService } from './tenant-hierarchy.service.js';

/**
 * 内置角色清单 —— 给每个新租户自动插入；与现有 UserRole 内置枚举对齐。
 * v1.0 只塞角色不挂权限点；细粒度权限挂接在 Wave1.x 完成。
 */
const BUILTIN_ROLES: { code: string; name: string; description: string }[] = [
  { code: 'owner', name: '租户管理员', description: '租户内最高权限，可改账号/计费/关停' },
  { code: 'operator', name: '运营', description: '日常运营、订单调度' },
  { code: 'finance', name: '财务', description: '结算、对账、发票' },
  { code: 'customer_service', name: '客服', description: '工单、投诉、回访' },
  { code: 'medical_consultant', name: '医疗顾问', description: 'AI 对话审核、用药复核' },
];

/**
 * 内置权限点占位 —— 给后续 device/ai-gateway/billing 模块占位。
 * v1.0 仅入库，TenantGuard 暂不消费这些点；细粒度授权放 Wave1.x。
 */
const BUILTIN_PERMISSIONS: {
  code: string;
  resource: string;
  action: string;
  name: string;
  description: string;
}[] = [
  // 租户自身管理
  { code: 'tenant:read', resource: 'tenant', action: 'read', name: '查看租户', description: '查看本租户基础信息' },
  { code: 'tenant:update', resource: 'tenant', action: 'update', name: '编辑租户', description: '编辑租户基础配置' },
  { code: 'tenant:member', resource: 'tenant', action: 'member', name: '成员管理', description: '邀请/移除/调整成员角色' },
  { code: 'tenant:tree', resource: 'tenant', action: 'tree', name: '查看租户树', description: '查看本租户及下属树形结构' },
  { code: 'tenant:move', resource: 'tenant', action: 'move', name: '移动租户', description: '调整租户在树中的父节点' },
  // device 模块预留
  { code: 'device:read', resource: 'device', action: 'read', name: '查看设备', description: '设备列表/状态/事件' },
  { code: 'device:bind', resource: 'device', action: 'bind', name: '设备绑定', description: '激活/绑定服务对象' },
  { code: 'device:control', resource: 'device', action: 'control', name: '设备控制', description: '远程指令/OTA' },
  // ai-gateway 预留
  { code: 'ai:dialog', resource: 'ai', action: 'dialog', name: 'AI 对话', description: '允许触发 AI 对话与查档案' },
  { code: 'ai:audit', resource: 'ai', action: 'audit', name: 'AI 审核', description: '查看 AI 对话留存与质检' },
  // 跌倒/告警
  { code: 'alert:read', resource: 'alert', action: 'read', name: '查看告警', description: '查看跌倒/SOS/紧急告警' },
  { code: 'alert:handle', resource: 'alert', action: 'handle', name: '处理告警', description: '确认告警/派单/出警' },
  // 计费
  { code: 'billing:read', resource: 'billing', action: 'read', name: '查看账单', description: '查看订阅与用量' },
  { code: 'billing:manage', resource: 'billing', action: 'manage', name: '管理订阅', description: '续费/退订/分账' },
];

/**
 * 33 张需要 tenant_id 列的业务表（与 deployment/migration_tenant_v1_20260603.sql 一致）。
 * 启动时 ensureTenantColumns 用此清单兜底补列，防止生产环境忘记执行 SQL。
 */
const TENANT_AWARE_TABLES: string[] = [
  // 继承 TenantAwareEntity 的 28 张
  'users', 'service_targets', 'orders', 'order_service_plans', 'service_plan_templates',
  'attendants', 'family_groups', 'family_members', 'medication_reminders',
  'medication_execution_logs', 'medication_prescriptions', 'health_alerts',
  'alert_rules', 'alert_logs', 'triage_sessions', 'triage_session_messages',
  'triage_feedbacks', 'prescription_risk_reports', 'medication_reminder_audits',
  'health_weekly_reports', 'ai_consultations', 'complaints', 'consultations',
  'finance_records', 'membership_card_types', 'membership_levels', 'user_memberships',
  'professional_services',
  // 手动加 tenantId 的 5 张
  'documents', 'schedules', 'reviews', 'service_timelines', 'audit_logs',
];

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private tenantColumnsReady = false;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantUser)
    private readonly tenantUserRepo: Repository<TenantUser>,
    @InjectRepository(TenantRole)
    private readonly tenantRoleRepo: Repository<TenantRole>,
    @InjectRepository(TenantPermission)
    private readonly tenantPermissionRepo: Repository<TenantPermission>,
    private readonly dataSource: DataSource,
    private readonly hierarchyService: TenantHierarchyService,
  ) {}

  // ─────────────── 租户 CRUD ───────────────

  async list(query: ListTenantDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });

    const kw = query.keyword?.trim();
    if (kw) {
      const like = `%${kw}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('t.name LIKE :kw', { kw: like })
            .orWhere('t.code LIKE :kw', { kw: like })
            .orWhere('t.contact_phone LIKE :kw', { kw: like });
        }),
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findById(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租户不存在');
    return tenant;
  }

  async findByCode(code: string): Promise<Tenant | null> {
    if (!code) return null;
    return this.tenantRepo.findOne({ where: { code } });
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenantRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`租户编码已存在：${dto.code}`);
    }
    const hierarchy = await this.hierarchyService.computeHierarchyFields(dto.parentId);
    const scopeType =
      dto.scopeType ?? this.hierarchyService.defaultScopeType(dto.type);

    const tenant = this.tenantRepo.create({
      code: dto.code,
      name: dto.name,
      type: dto.type,
      scopeType,
      parentId: hierarchy.parentId,
      path: hierarchy.path,
      depth: hierarchy.depth,
      regionCode: dto.regionCode ?? null,
      dataCenter: dto.dataCenter || 'cn-east-1',
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      settings: dto.settings ?? null,
      status: TenantStatus.ACTIVE,
    });
    const saved = await this.tenantRepo.save(tenant);

    // 内置角色：新租户自动塞 5 个内置角色
    await this.ensureBuiltinRoles(saved.id);

    // 可选：绑定 owner
    if (dto.ownerUserId) {
      await this.addUser(saved.id, {
        userId: dto.ownerUserId,
        isOwner: true,
      });
    }

    this.logger.log(
      `tenant created: id=${saved.id} code=${saved.code} type=${saved.type}`,
    );
    return saved;
  }

  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findById(id);
    if (id === DEFAULT_TENANT_ID && dto.status && dto.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException('默认平台租户不允许停用');
    }
    Object.assign(tenant, {
      name: dto.name ?? tenant.name,
      dataCenter: dto.dataCenter ?? tenant.dataCenter,
      contactName: dto.contactName ?? tenant.contactName,
      contactPhone: dto.contactPhone ?? tenant.contactPhone,
      settings: dto.settings ?? tenant.settings,
      status: dto.status ?? tenant.status,
    });
    return this.tenantRepo.save(tenant);
  }

  async remove(id: number): Promise<void> {
    if (id === DEFAULT_TENANT_ID) {
      throw new BadRequestException('默认平台租户不允许删除');
    }
    const tenant = await this.findById(id);
    // v1.0 不真删，仅置为 disabled，保留历史数据可追溯
    tenant.status = TenantStatus.DISABLED;
    await this.tenantRepo.save(tenant);
    this.logger.warn(`tenant disabled: id=${id} code=${tenant.code}`);
  }

  // ─────────────── 成员（tenant_users）管理 ───────────────

  async listMembers(tenantId: number) {
    await this.findById(tenantId);
    return this.tenantUserRepo.find({
      where: { tenantId },
      relations: ['user', 'role'],
      order: { createdAt: 'ASC' },
    });
  }

  /** 查询某个 user 加入的所有租户（含主租户切换列表用） */
  async listTenantsByUser(userId: number) {
    return this.tenantUserRepo.find({
      where: { userId, status: 'active' as const },
      relations: ['tenant', 'role'],
    });
  }

  async addUser(tenantId: number, dto: AddTenantUserDto): Promise<TenantUser> {
    const tenant = await this.findById(tenantId);
    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException('租户当前状态不允许加入新成员');
    }

    // 唯一性：(tenantId, userId)
    const existing = await this.tenantUserRepo.findOne({
      where: { tenantId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('该用户已是租户成员');
    }

    // 校验角色归属
    if (dto.roleId) {
      const role = await this.tenantRoleRepo.findOne({
        where: { id: dto.roleId },
      });
      if (!role) throw new NotFoundException('角色不存在');
      if (role.tenantId && role.tenantId !== tenantId) {
        throw new BadRequestException('角色不属于当前租户');
      }
    }

    const row = this.tenantUserRepo.create({
      tenantId,
      userId: dto.userId,
      roleId: dto.roleId ?? null,
      isOwner: !!dto.isOwner,
      status: 'active',
      joinedAt: new Date(),
    });
    return this.tenantUserRepo.save(row);
  }

  async removeUser(tenantId: number, userId: number): Promise<void> {
    const row = await this.tenantUserRepo.findOne({
      where: { tenantId, userId },
    });
    if (!row) throw new NotFoundException('成员关系不存在');

    if (row.isOwner) {
      // 防呆：禁止移除最后一个 owner
      const ownerCount = await this.tenantUserRepo.count({
        where: { tenantId, isOwner: true, status: 'active' as const },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('不能移除租户最后一名管理员');
      }
    }
    await this.tenantUserRepo.delete(row.id);
  }

  // ─────────────── 角色 / 权限点（v1.0 仅初始化） ───────────────

  async listRoles(tenantId?: number) {
    if (tenantId !== undefined) await this.findById(tenantId);
    const where = tenantId !== undefined ? [{ tenantId }, { tenantId: null }] : undefined;
    return this.tenantRoleRepo.find({
      where: where as any,
      order: { isBuiltin: 'DESC', createdAt: 'ASC' },
    });
  }

  async listPermissions() {
    return this.tenantPermissionRepo.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  /**
   * 给指定租户补齐 5 个内置角色（幂等）。
   * 平台预置角色（tenantId=null）由 `ensurePlatformBuiltins` 维护，不在此处插入。
   */
  async ensureBuiltinRoles(tenantId: number): Promise<void> {
    const existing = await this.tenantRoleRepo.find({
      where: { tenantId },
      select: ['id', 'code'],
    });
    const existingCodes = new Set(existing.map((r) => r.code));

    const toInsert = BUILTIN_ROLES.filter((b) => !existingCodes.has(b.code)).map((b) =>
      this.tenantRoleRepo.create({
        tenantId,
        code: b.code,
        name: b.name,
        description: b.description,
        isBuiltin: true,
      }),
    );
    if (toInsert.length) {
      await this.tenantRoleRepo.save(toInsert);
      this.logger.log(
        `tenant#${tenantId} builtin roles ensured: +${toInsert.length}`,
      );
    }
  }

  /**
   * 启动时调用：确保「平台默认租户」与「全局权限点」存在（幂等）。
   * 与 db-bootstrap.service 的风格一致，可由后者调用。
   */
  async ensurePlatformBuiltins(): Promise<void> {
    // 1) 默认租户（兼容老数据归属）
    let defaultTenant = await this.tenantRepo.findOne({
      where: { id: DEFAULT_TENANT_ID },
    });
    if (!defaultTenant) {
      defaultTenant = this.tenantRepo.create({
        id: DEFAULT_TENANT_ID,
        code: DEFAULT_TENANT_CODE,
        name: '陪了个伴默认租户',
        type: TenantType.PLATFORM,
        scopeType: TenantScopeType.PLATFORM,
        path: '/',
        depth: 0,
        status: TenantStatus.ACTIVE,
        dataCenter: 'cn-east-1',
      });
      await this.tenantRepo.save(defaultTenant);
      this.logger.log(`默认平台租户已建：id=${DEFAULT_TENANT_ID}`);
    }

    // 2) 平台预置角色（tenantId=null）—— 让多租户共享一份只读角色
    const platformRoleExisting = await this.tenantRoleRepo.find({
      where: { tenantId: null as any },
      select: ['code'],
    });
    const platformRoleCodes = new Set(platformRoleExisting.map((r) => r.code));
    const platformInserts = BUILTIN_ROLES.filter(
      (b) => !platformRoleCodes.has(b.code),
    ).map((b) =>
      this.tenantRoleRepo.create({
        tenantId: null,
        code: b.code,
        name: b.name,
        description: `${b.description}（平台预置）`,
        isBuiltin: true,
      }),
    );
    if (platformInserts.length) {
      await this.tenantRoleRepo.save(platformInserts);
    }

    // 3) 给默认租户也塞一份内置角色（管理后台超管常用）
    await this.ensureBuiltinRoles(DEFAULT_TENANT_ID);

    // 4) 全局权限点
    const existPerm = await this.tenantPermissionRepo.find({
      select: ['code'],
    });
    const existPermCodes = new Set(existPerm.map((p) => p.code));
    const permInserts = BUILTIN_PERMISSIONS.filter(
      (p) => !existPermCodes.has(p.code),
    ).map((p) =>
      this.tenantPermissionRepo.create({
        code: p.code,
        resource: p.resource,
        action: p.action,
        name: p.name,
        description: p.description,
      }),
    );
    if (permInserts.length) {
      await this.tenantPermissionRepo.save(permInserts);
      this.logger.log(`平台权限点已建：+${permInserts.length}`);
    }
  }

  /**
   * 给业务模块复用的工具方法：批量预取一组 tenantId 的简要信息。
   * 用于列表渲染时减少 N+1。
   */
  async preloadTenants(ids: number[]): Promise<Map<number, Tenant>> {
    if (!ids.length) return new Map();
    const list = await this.tenantRepo.find({ where: { id: In(ids) } });
    return new Map(list.map((t) => [t.id, t]));
  }

  /**
   * 启动期兜底：给 33 张业务表幂等补 `tenant_id` 列 + 索引。
   *
   * 适用场景：
   * - 生产/staging（synchronize=false）忘记执行 migration_tenant_v1_20260603.sql；
   * - 老的 staging 库刚切到本分支，避免冷启崩在 INSERT 时报「Unknown column tenant_id」。
   *
   * 实现策略：
   * - 用 INFORMATION_SCHEMA 检查列存在与否，跳过已就位的表；
   * - 一律 `DEFAULT 1`（默认平台租户），让历史数据自动归属；
   * - 不阻塞启动：单表失败 warn 后继续，由运维事后排查；
   * - 失败不更新 `tenantColumnsReady`，下次启动再尝试。
   */
  async ensureTenantColumns(): Promise<void> {
    if (this.tenantColumnsReady) return;
    const manager = this.dataSource.manager;
    const dbName = (this.dataSource.options as any).database as string;
    let added = 0;
    let skipped = 0;
    let failed = 0;
    for (const table of TENANT_AWARE_TABLES) {
      try {
        const rows = (await manager.query(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id' LIMIT 1`,
          [dbName, table],
        )) as unknown[];
        if (rows.length > 0) {
          skipped += 1;
          continue;
        }
        const idx = `idx_${table}_tenant`.slice(0, 64);
        await manager.query(
          `ALTER TABLE \`${table}\`
             ADD COLUMN tenant_id INT NOT NULL DEFAULT ${DEFAULT_TENANT_ID}
                 COMMENT '所属租户' AFTER id,
             ADD INDEX \`${idx}\` (tenant_id)`,
        );
        added += 1;
        this.logger.log(`ensureTenantColumns: ${table} 已补 tenant_id 列`);
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `ensureTenantColumns: ${table} 失败（可能表尚未创建，跳过）: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (failed === 0) this.tenantColumnsReady = true;
    this.logger.log(
      `ensureTenantColumns 完成：added=${added} skipped=${skipped} failed=${failed}`,
    );
  }
}
