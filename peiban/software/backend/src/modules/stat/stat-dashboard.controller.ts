import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import type { TenantDataScope } from '../../common/utils/tenant-query.helper.js';
import { TenantHierarchyService } from '../tenant/tenant-hierarchy.service.js';
import { StatService } from './stat.service.js';
import { StatAggregatorService } from './stat-aggregator.service.js';
import { isKnownMetric, STAT_METRIC_DEFS } from './stat-metrics.js';
import {
  AggregateRunDto,
  DashboardQueryDto,
  MetricScopedQueryDto,
  OverviewQueryDto,
  RankQueryDto,
  RealtimeQueryDto,
} from './dto/stat-query.dto.js';

/**
 * 分层多租户数据大盘 API（PRD §8.3）。
 *
 * 数据隔离：所有查询先把请求用户的 scope 解析成「可见 tenant_id 列表」，
 * 再交给 StatService 做 `WHERE tenant_id IN (...)` 聚合：
 * - 普通租户用户 → 只能 self / 自己的 descendants / canAccess 通过的指定下属；
 * - 平台超管（tenantId=null）→ 不限租户（全量），可选 tenantId 钻取某子树。
 *
 * 与既有 `GET /dashboard/overview`（运营 KPI 工作台）并存，互不影响。
 */
@ApiTags('数据大盘')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.OPERATOR,
  UserRole.FINANCE,
  UserRole.CUSTOMER_SERVICE,
  UserRole.MEDICAL_CONSULTANT,
)
@Controller('dashboard')
export class StatDashboardController {
  constructor(
    private readonly statService: StatService,
    private readonly aggregator: StatAggregatorService,
    private readonly hierarchy: TenantHierarchyService,
  ) {}

  @Get('metrics-catalog')
  @ApiOperation({ summary: '指标字典（key/中文名/单位/聚合方式）' })
  metricsCatalog() {
    return Object.values(STAT_METRIC_DEFS);
  }

  @Get('summary')
  @ApiOperation({ summary: 'scope 总览 KPI（顶部卡片）' })
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewQueryDto,
  ) {
    const allowed = await this.resolveAllowed(
      user,
      query.scope,
      query.tenantId,
    );
    const { from, to } = resolveRange(query.from, query.to);
    return this.statService.overview({
      allowedTenantIds: allowed,
      from,
      to,
      metrics: query.metrics,
    });
  }

  @Get('metric/:metric')
  @ApiOperation({ summary: '单指标趋势 + 各租户贡献' })
  async metric(
    @CurrentUser() user: AuthenticatedUser,
    @Param('metric') metric: string,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertMetric(metric);
    const allowed = await this.resolveAllowed(
      user,
      query.scope,
      query.tenantId,
    );
    const { from, to } = resolveRange(query.from, query.to);
    return this.statService.queryMetric({
      metric,
      allowedTenantIds: allowed,
      from,
      to,
    });
  }

  @Get('rank/:metric')
  @ApiOperation({ summary: '下属租户排行（按指标累计值）' })
  async rank(
    @CurrentUser() user: AuthenticatedUser,
    @Param('metric') metric: string,
    @Query() query: RankQueryDto,
  ) {
    this.assertMetric(metric);
    const allowed = await this.resolveAllowed(
      user,
      query.scope,
      query.tenantId,
    );
    const { from, to } = resolveRange(query.from, query.to);
    return this.statService.rank({
      metric,
      allowedTenantIds: allowed,
      from,
      to,
      limit: query.limit,
    });
  }

  @Get('region-map')
  @ApiOperation({ summary: '按行政区划聚合（地图热力）' })
  async regionMap(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MetricScopedQueryDto,
  ) {
    const metric = query.metric || 'devices_count';
    this.assertMetric(metric);
    const allowed = await this.resolveAllowed(
      user,
      query.scope,
      query.tenantId,
    );
    const { from, to } = resolveRange(query.from, query.to);
    return this.statService.regionMap({
      metric,
      allowedTenantIds: allowed,
      from,
      to,
    });
  }

  @Get('realtime')
  @ApiOperation({ summary: '实时快照（在线设备 / 待处理告警 / 在岗护工）' })
  async realtime(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RealtimeQueryDto,
  ) {
    const allowed = await this.resolveAllowed(
      user,
      query.scope,
      query.tenantId,
    );
    return this.statService.realtimeSnapshot({
      allowedTenantIds: allowed,
      metrics: query.metrics,
    });
  }

  @Get('breakdown/:dim')
  @ApiOperation({
    summary:
      '维度构成（饼图）：orders_by_service_type / alerts_by_severity / residents_by_age',
  })
  async breakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dim') dim: string,
    @Query() query: DashboardQueryDto,
  ) {
    const allowed = await this.resolveAllowed(user, query.scope, query.tenantId);
    const { from, to } = resolveRange(query.from, query.to);
    let items: { name: string; value: number }[];
    switch (dim) {
      case 'orders_by_service_type':
        items = await this.aggregator.breakdownOrdersByServiceType(allowed, from, to);
        break;
      case 'alerts_by_severity':
        items = await this.aggregator.breakdownAlertsBySeverity(allowed, from, to);
        break;
      case 'residents_by_age':
        items = await this.aggregator.breakdownResidentsByAge(allowed);
        break;
      default:
        throw new BadRequestException(`未知维度：${dim}`);
    }
    return { dim, items };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: '导出 CSV（传 metric 导出各租户明细，否则导出总览）',
  })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MetricScopedQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const allowed = await this.resolveAllowed(
      user,
      query.scope,
      query.tenantId,
    );
    const { from, to } = resolveRange(query.from, query.to);
    const stamp = `${query.from ?? ''}_${query.to ?? ''}`;

    let csv: string;
    let filename: string;
    if (query.metric) {
      this.assertMetric(query.metric);
      const r = await this.statService.queryMetric({
        metric: query.metric,
        allowedTenantIds: allowed,
        from,
        to,
      });
      filename = `metric_${query.metric}${stamp}.csv`;
      csv = toCsv(
        ['租户ID', '租户名称', r.label],
        r.byTenant.map((b) => [b.tenantId, b.tenantName, b.value]),
      );
    } else {
      const o = await this.statService.overview({
        allowedTenantIds: allowed,
        from,
        to,
      });
      filename = `overview${stamp}.csv`;
      csv = toCsv(
        ['指标', '名称', '单位', '数值'],
        o.kpis.map((k) => [k.metric, k.label, k.unit ?? '', k.value]),
      );
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    // UTF-8 BOM 让 Excel 正确识别中文
    return `\uFEFF${csv}`;
  }

  @Post('aggregate/run')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '手动触发聚合（验证用，免等 cron）' })
  async runAggregate(@Body() dto: AggregateRunDto) {
    const granularity = dto.granularity ?? 'daily';
    if (granularity === 'hourly') {
      return this.aggregator.runHourly(new Date());
    }
    if (granularity === 'realtime') {
      return this.aggregator.runRealtime();
    }
    const date = dto.date ? new Date(dto.date) : new Date();
    return this.aggregator.runDaily(date);
  }

  // ─────────────── 内部 ───────────────

  private assertMetric(metric: string): void {
    if (!isKnownMetric(metric)) {
      throw new BadRequestException(`未知指标：${metric}`);
    }
  }

  /**
   * 解析当前用户 scope → 可见 tenant_id 列表。
   * 返回 null 表示「不限租户」（仅平台超管未指定 tenantId 时）。
   */
  private async resolveAllowed(
    user: AuthenticatedUser,
    scope: TenantDataScope | undefined,
    tenantId: number | undefined,
  ): Promise<number[] | null> {
    const viewer = user?.tenantId ?? null;
    const s = scope ?? 'self';

    if (viewer == null) {
      // 平台超管
      if (!tenantId) return null;
      if (s === 'descendants') {
        return this.hierarchy.getDescendantIds(tenantId, { includeSelf: true });
      }
      return [tenantId];
    }

    return this.hierarchy.resolveScopeTenantIds({
      scope: s,
      explicitTenantId: tenantId,
      viewerTenantId: viewer,
    });
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** 日期范围归一：默认近 30 天 */
function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 29 * 24 * 3600 * 1000);
  return { from: startOfDay(fromDate), to: endOfDay(toDate) };
}

function toCsv(
  headers: (string | number)[],
  rows: (string | number)[][],
): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const row of rows) lines.push(row.map(esc).join(','));
  return lines.join('\n');
}
