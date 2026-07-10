import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import {
  DEFAULT_TENANT_CODE,
  DEFAULT_TENANT_ID,
  Tenant,
  TenantScopeType,
  TenantStatus,
  TenantType,
} from '../../entities/tenant.entity.js';
import { RequestContext } from '../../common/contexts/request-context.js';

export interface TenantTreeNode {
  id: number;
  code: string;
  name: string;
  type: TenantType;
  scopeType: TenantScopeType;
  depth: number;
  parentId: number | null;
  status: TenantStatus;
  regionCode: string | null;
  children: TenantTreeNode[];
}

export interface TenantBreadcrumb {
  id: number;
  name: string;
  code: string;
  scopeType: TenantScopeType;
}

/** 查询作用域：本租户 / 含子孙 / 指定下属（须 canAccess） */
export type TenantDataScope = 'self' | 'descendants' | 'tenant';

@Injectable()
export class TenantHierarchyService {
  private readonly logger = new Logger(TenantHierarchyService.name);
  private hierarchyColumnsReady = false;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  /** 子节点 path = parent.path + parent.id + '/' */
  buildChildPath(parent: Tenant): string {
    const base = parent.path.endsWith('/') ? parent.path : `${parent.path}/`;
    return `${base}${parent.id}/`;
  }

  /** 从 path 解析祖先 ID 列表（不含自身） */
  parseAncestorIds(path: string): number[] {
    return path
      .split('/')
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  /** 默认 scopeType：由计费 type 推导 */
  defaultScopeType(type: TenantType): TenantScopeType {
    switch (type) {
      case TenantType.PLATFORM:
        return TenantScopeType.PLATFORM;
      case TenantType.ENTERPRISE:
        return TenantScopeType.ENTERPRISE;
      case TenantType.PERSONAL:
        return TenantScopeType.SITE;
      case TenantType.COMMUNITY:
      default:
        return TenantScopeType.ORGANIZATION;
    }
  }

  descendantPathPrefix(tenant: Tenant): string {
    return `${tenant.path}${tenant.id}/`;
  }

  async getDescendantIds(
    tenantId: number,
    options?: { includeSelf?: boolean; activeOnly?: boolean },
  ): Promise<number[]> {
    const tenant = await this.requireTenant(tenantId);
    const prefix = this.descendantPathPrefix(tenant);
    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .where('t.path LIKE :prefix', { prefix: `${prefix}%` });
    if (options?.activeOnly !== false) {
      qb.andWhere('t.status = :status', { status: TenantStatus.ACTIVE });
    }
    const rows = await qb.getRawMany<{ id: number }>();
    const ids = rows.map((r) => Number(r.id));
    if (options?.includeSelf !== false) {
      if (!ids.includes(tenantId)) ids.unshift(tenantId);
    }
    return ids;
  }

  async getAncestorIds(
    tenantId: number,
    options?: { includeSelf?: boolean },
  ): Promise<number[]> {
    const tenant = await this.requireTenant(tenantId);
    const ids = this.parseAncestorIds(tenant.path);
    if (options?.includeSelf) ids.push(tenantId);
    return ids;
  }

  /**
   * viewer 是否可访问 target（读聚合 / 指定 tenant 查询）。
   * - admin（JWT tenantId=null）→ 允许
   * - 同租户 → 允许
   * - target 是 viewer 的子孙 → 允许
   */
  async canAccess(viewerTenantId: number | null, targetTenantId: number): Promise<boolean> {
    if (viewerTenantId == null) return true;
    if (viewerTenantId === targetTenantId) return true;
    const [viewer, target] = await Promise.all([
      this.requireTenant(viewerTenantId),
      this.requireTenant(targetTenantId),
    ]);
    const prefix = this.descendantPathPrefix(viewer);
    return target.path.startsWith(prefix);
  }

  async assertCanAccessAsync(
    viewerTenantId: number | null,
    targetTenantId: number,
  ): Promise<void> {
    const ok = await this.canAccess(viewerTenantId, targetTenantId);
    if (!ok) throw new ForbiddenException('无权访问该租户数据');
  }

  /** 解析 API scope → 可查询的 tenant_id 列表 */
  async resolveScopeTenantIds(options: {
    scope?: TenantDataScope;
    explicitTenantId?: number;
    viewerTenantId?: number | null;
  }): Promise<number[] | null> {
    const viewer =
      options.viewerTenantId !== undefined
        ? options.viewerTenantId
        : RequestContext.currentTenantId();

    if (viewer == null) {
      if (options.explicitTenantId) return [options.explicitTenantId];
      return null;
    }

    const scope = options.scope ?? 'self';

    if (scope === 'self') {
      return [viewer];
    }

    if (scope === 'descendants') {
      return this.getDescendantIds(viewer, { includeSelf: true });
    }

    if (scope === 'tenant') {
      const tid = options.explicitTenantId;
      if (!tid) throw new BadRequestException('scope=tenant 时必须传 tenantId');
      await this.assertCanAccessAsync(viewer, tid);
      return [tid];
    }

    return [viewer];
  }

  async getChildren(tenantId: number): Promise<Tenant[]> {
    await this.requireTenant(tenantId);
    return this.tenantRepo.find({
      where: { parentId: tenantId, status: TenantStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async getAncestors(tenantId: number): Promise<Tenant[]> {
    const ids = await this.getAncestorIds(tenantId);
    if (!ids.length) return [];
    const list = await this.tenantRepo.find({ where: { id: In(ids) } });
    const map = new Map(list.map((t) => [t.id, t]));
    return ids.map((id) => map.get(id)).filter((t): t is Tenant => !!t);
  }

  async getBreadcrumbs(tenantId: number): Promise<TenantBreadcrumb[]> {
    const ancestors = await this.getAncestors(tenantId);
    const self = await this.requireTenant(tenantId);
    return [...ancestors, self].map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      scopeType: t.scopeType,
    }));
  }

  /**
   * 当前用户可见的树（admin 看全平台子树；普通用户看自己为根的子树）。
   */
  async getTreeForViewer(viewerTenantId: number | null): Promise<TenantTreeNode[]> {
    const rootId = viewerTenantId ?? DEFAULT_TENANT_ID;
    const root = await this.requireTenant(rootId);
    return [await this.buildTreeNode(root)];
  }

  private async buildTreeNode(tenant: Tenant): Promise<TenantTreeNode> {
    const children = await this.tenantRepo.find({
      where: { parentId: tenant.id, status: TenantStatus.ACTIVE },
      order: { name: 'ASC' },
    });
    const childNodes = await Promise.all(children.map((c) => this.buildTreeNode(c)));
    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      type: tenant.type,
      scopeType: tenant.scopeType,
      depth: tenant.depth,
      parentId: tenant.parentId,
      status: tenant.status,
      regionCode: tenant.regionCode,
      children: childNodes,
    };
  }

  /** 新建租户时计算 path / depth */
  async computeHierarchyFields(parentId: number | null | undefined): Promise<{
    parentId: number | null;
    path: string;
    depth: number;
  }> {
    const effectiveParentId = parentId ?? DEFAULT_TENANT_ID;
    if (effectiveParentId === null) {
      return { parentId: null, path: '/', depth: 0 };
    }
    const parent = await this.requireTenant(effectiveParentId);
    return {
      parentId: parent.id,
      path: this.buildChildPath(parent),
      depth: parent.depth + 1,
    };
  }

  /**
   * 移动租户到新父节点，并递归更新所有后代的 path / depth。
   */
  async moveTenant(tenantId: number, newParentId: number): Promise<Tenant> {
    if (tenantId === DEFAULT_TENANT_ID) {
      throw new BadRequestException('默认平台租户不可移动');
    }
    if (tenantId === newParentId) {
      throw new BadRequestException('不能将租户移动到自身');
    }

    const tenant = await this.requireTenant(tenantId);
    const newParent = await this.requireTenant(newParentId);

    const newPrefix = this.descendantPathPrefix(newParent);
    if (newParent.path.startsWith(this.descendantPathPrefix(tenant))) {
      throw new BadRequestException('不能移动到自身或子孙节点下');
    }

    const oldPrefix = this.descendantPathPrefix(tenant);
    const newPath = this.buildChildPath(newParent);
    const depthDelta = newParent.depth + 1 - tenant.depth;

    return this.dataSource.transaction(async (manager) => {
      tenant.parentId = newParent.id;
      tenant.path = newPath;
      tenant.depth = newParent.depth + 1;
      await manager.save(Tenant, tenant);

      const descendants = await manager.find(Tenant, {
        where: { path: Like(`${oldPrefix}%`) },
      });
      for (const d of descendants) {
        if (d.id === tenant.id) continue;
        d.path = d.path.replace(oldPrefix, `${newPath}${tenant.id}/`);
        d.depth += depthDelta;
        await manager.save(Tenant, d);
      }

      this.logger.log(
        `tenant moved: id=${tenantId} parent=${newParentId} path=${newPath}`,
      );
      return tenant;
    });
  }

  /** 启动期：幂等补 tenants 树形列 */
  async ensureHierarchyColumns(): Promise<void> {
    if (this.hierarchyColumnsReady) return;
    const manager = this.dataSource.manager;
    const dbName = (this.dataSource.options as { database?: string }).database as string;
    const columns: { name: string; ddl: string }[] = [
      {
        name: 'path',
        ddl: `ADD COLUMN path VARCHAR(255) NOT NULL DEFAULT '/' COMMENT '物化路径' AFTER parent_id`,
      },
      {
        name: 'depth',
        ddl: `ADD COLUMN depth TINYINT NOT NULL DEFAULT 0 COMMENT '树深度' AFTER path`,
      },
      {
        name: 'scope_type',
        ddl: `ADD COLUMN scope_type ENUM('platform','government','enterprise','organization','site') NOT NULL DEFAULT 'organization' COMMENT '层级类型' AFTER depth`,
      },
      {
        name: 'region_code',
        ddl: `ADD COLUMN region_code VARCHAR(32) NULL COMMENT '行政区划码' AFTER scope_type`,
      },
      {
        name: 'org_chain',
        ddl: `ADD COLUMN org_chain VARCHAR(255) NULL COMMENT '组织链路 JSON' AFTER region_code`,
      },
    ];

    let failed = 0;
    for (const col of columns) {
      try {
        const rows = (await manager.query(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tenants' AND COLUMN_NAME = ? LIMIT 1`,
          [dbName, col.name],
        )) as unknown[];
        if (rows.length > 0) continue;
        await manager.query(`ALTER TABLE tenants ${col.ddl}`);
        this.logger.log(`ensureHierarchyColumns: tenants.${col.name} added`);
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `ensureHierarchyColumns: ${col.name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (failed === 0) {
      this.hierarchyColumnsReady = true;
      await this.rebuildPathsFromParentLinks();
    }
  }

  /** 按 parent_id 自顶向下重算 path（迁移/修复用） */
  async rebuildPathsFromParentLinks(): Promise<void> {
    const all = await this.tenantRepo.find({ order: { depth: 'ASC', id: 'ASC' } });
    const map = new Map(all.map((t) => [t.id, t]));

    const platform = map.get(DEFAULT_TENANT_ID);
    if (platform) {
      platform.path = '/';
      platform.depth = 0;
      platform.scopeType = TenantScopeType.PLATFORM;
      platform.parentId = null;
    }

    for (const t of all) {
      if (t.id === DEFAULT_TENANT_ID) continue;
      if (t.parentId == null) t.parentId = DEFAULT_TENANT_ID;
    }

    const queue: number[] = platform ? [DEFAULT_TENANT_ID] : [];
    const visited = new Set<number>();

    while (queue.length) {
      const pid = queue.shift()!;
      if (visited.has(pid)) continue;
      visited.add(pid);
      const parent = map.get(pid);
      if (!parent) continue;

      for (const child of all.filter((t) => t.parentId === pid)) {
        child.path = this.buildChildPath(parent);
        child.depth = parent.depth + 1;
        if (!child.scopeType) {
          child.scopeType = this.defaultScopeType(child.type);
        }
        queue.push(child.id);
      }
    }

    for (const t of all) {
      if (!t.scopeType) t.scopeType = this.defaultScopeType(t.type);
    }

    await this.tenantRepo.save(all);
    this.logger.log(`rebuildPathsFromParentLinks: ${all.length} tenants updated`);
  }

  /**
   * 示例租户树 seed（幂等）：平台 → 浙江民政 → 丽水民政 → 阳光养老院 → 莲都分院
   */
  async ensureHierarchySeed(): Promise<void> {
    await this.ensureHierarchyColumns();

    const seeds: {
      code: string;
      name: string;
      type: TenantType;
      scopeType: TenantScopeType;
      parentCode: string | null;
      regionCode?: string;
    }[] = [
      {
        code: 'zj-civil',
        name: '浙江省民政厅',
        type: TenantType.COMMUNITY,
        scopeType: TenantScopeType.GOVERNMENT,
        parentCode: DEFAULT_TENANT_CODE,
        regionCode: '33',
      },
      {
        code: 'lishui-civil',
        name: '丽水市民政局',
        type: TenantType.COMMUNITY,
        scopeType: TenantScopeType.GOVERNMENT,
        parentCode: 'zj-civil',
        regionCode: '3311',
      },
      {
        code: 'yangguang',
        name: '阳光养老院',
        type: TenantType.COMMUNITY,
        scopeType: TenantScopeType.ORGANIZATION,
        parentCode: 'lishui-civil',
      },
      {
        code: 'liandu-site',
        name: '阳光-莲都区分院',
        type: TenantType.COMMUNITY,
        scopeType: TenantScopeType.SITE,
        parentCode: 'yangguang',
      },
    ];

    const codeToId = new Map<string, number>();
    codeToId.set(DEFAULT_TENANT_CODE, DEFAULT_TENANT_ID);

    const defaultRow = await this.tenantRepo.findOne({ where: { id: DEFAULT_TENANT_ID } });
    if (defaultRow) {
      defaultRow.path = '/';
      defaultRow.depth = 0;
      defaultRow.scopeType = TenantScopeType.PLATFORM;
      await this.tenantRepo.save(defaultRow);
    }

    for (const s of seeds) {
      let row = await this.tenantRepo.findOne({ where: { code: s.code } });
      const parentId = s.parentCode ? codeToId.get(s.parentCode) : DEFAULT_TENANT_ID;
      if (!parentId) {
        this.logger.warn(`ensureHierarchySeed: parent ${s.parentCode} missing for ${s.code}`);
        continue;
      }
      const parent = await this.requireTenant(parentId);
      const path = this.buildChildPath(parent);
      const depth = parent.depth + 1;

      if (!row) {
        row = this.tenantRepo.create({
          code: s.code,
          name: s.name,
          type: s.type,
          scopeType: s.scopeType,
          status: TenantStatus.ACTIVE,
          parentId: parent.id,
          path,
          depth,
          regionCode: s.regionCode ?? null,
          dataCenter: parent.dataCenter,
        });
        row = await this.tenantRepo.save(row);
        this.logger.log(`hierarchy seed created: ${s.code} id=${row.id}`);
      } else {
        row.parentId = parent.id;
        row.path = path;
        row.depth = depth;
        row.scopeType = s.scopeType;
        row.regionCode = s.regionCode ?? row.regionCode;
        await this.tenantRepo.save(row);
      }
      codeToId.set(s.code, row.id);
    }

    await this.rebuildPathsFromParentLinks();
  }

  private async requireTenant(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`租户不存在：${id}`);
    return tenant;
  }
}
