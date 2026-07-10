import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { SubscriptionService } from './subscription.service.js';
import { UsageMeterService } from './usage-meter.service.js';
import { InvoiceService } from './invoice.service.js';
import { RevenueShareService } from './revenue-share.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { ListSubscriptionDto } from './dto/list-subscription.dto.js';
import { RecordUsageDto } from './dto/record-usage.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import {
  CreateRevenueShareRuleDto,
  UpdateRevenueShareRuleDto,
} from './dto/save-revenue-share-rule.dto.js';
import { InvoiceStatus } from '../../entities/invoice.entity.js';
import {
  RevenueShareScope,
} from '../../entities/revenue-share-rule.entity.js';
import { UsageMetric } from '../../entities/usage-record.entity.js';

@ApiTags('计费 / 订阅 / 发票')
@Controller('billing')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageMeterService: UsageMeterService,
    private readonly invoiceService: InvoiceService,
    private readonly revenueShareService: RevenueShareService,
  ) {}

  // ─────────────── 套餐字典 ───────────────

  @Get('plans')
  @ApiOperation({ summary: '套餐列表（按 category 过滤）' })
  listPlans(@Query('category') category?: string) {
    return this.subscriptionService.listPlans(category);
  }

  // ─────────────── 订阅 ───────────────

  @Get('subscriptions')
  @ApiOperation({ summary: '我的订阅' })
  myList(@CurrentUser('id') userId: number, @Query() query: ListSubscriptionDto) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.subscriptionService.list(userId, query);
  }

  @Post('subscriptions')
  @ApiOperation({ summary: '创建订阅（v1.0 不接真实支付，仅入库）' })
  create(@CurrentUser('id') userId: number, @Body() dto: CreateSubscriptionDto) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.subscriptionService.create(userId, dto);
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: '订阅详情' })
  detail(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subscriptionService.findById(id, userId);
  }

  @Post('subscriptions/:id/renew')
  @ApiOperation({ summary: '续费当前订阅' })
  renew(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subscriptionService.renew(id, userId);
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: '取消订阅（保留数据，停止下次扣费）' })
  cancel(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ) {
    return this.subscriptionService.cancel(id, userId, body?.reason);
  }

  // ─────────────── 用量 ───────────────

  @Get('usage')
  @ApiOperation({ summary: '本月用量明细' })
  monthlyUsage(
    @CurrentUser('id') userId: number,
    @Query('year') yearRaw?: string,
    @Query('month') monthRaw?: string,
  ) {
    if (!userId) throw new ForbiddenException('需要登录');
    const now = new Date();
    const year = yearRaw ? Number(yearRaw) : now.getFullYear();
    const month = monthRaw ? Number(monthRaw) : now.getMonth() + 1;
    return this.usageMeterService.getMonthlyUsage(userId, year, month);
  }

  @Post('usage/records')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: '记录用量（系统内部用：admin 手工录入 / ai-gateway 自动调用）',
  })
  recordUsage(
    @CurrentUser('id') userId: number,
    @Body() dto: RecordUsageDto,
  ) {
    return this.usageMeterService.record(userId, dto);
  }

  // ─────────────── 发票 ───────────────

  @Get('invoices')
  @ApiOperation({ summary: '我的发票列表' })
  myInvoices(
    @CurrentUser('id') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.invoiceService.listForUser(
      userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post('invoices')
  @ApiOperation({ summary: '申请开票' })
  createInvoice(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateInvoiceDto,
  ) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.invoiceService.create(userId, dto);
  }

  @Get('invoices/admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '管理后台：所有发票' })
  adminInvoices(@Query() query: { status?: InvoiceStatus; page?: string; pageSize?: string }) {
    return this.invoiceService.listAll({
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Patch('invoices/:id/issue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '财务开票（回填发票号与 URL）' })
  issueInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { invoiceNo: string; invoiceUrl: string },
  ) {
    return this.invoiceService.issue(id, body);
  }

  @Patch('invoices/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '财务驳回开票' })
  rejectInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
  ) {
    return this.invoiceService.reject(id, body.reason);
  }

  // ─────────────── 用量计费（运营后台聚合） ───────────────

  @Get('usage/admin/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE)
  @ApiOperation({ summary: '运营后台：某月各指标用量汇总' })
  adminUsageSummary(
    @Query('year') yearRaw?: string,
    @Query('month') monthRaw?: string,
  ) {
    const now = new Date();
    const year = yearRaw ? Number(yearRaw) : now.getFullYear();
    const month = monthRaw ? Number(monthRaw) : now.getMonth() + 1;
    return this.usageMeterService.adminMonthlySummary(year, month);
  }

  @Get('usage/admin/records')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE)
  @ApiOperation({ summary: '运营后台：用量明细分页' })
  adminUsageRecords(
    @Query('metric') metric?: UsageMetric,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.usageMeterService.adminListRecords({
      metric,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  // ─────────────── 分账规则（运营后台 CRUD） ───────────────

  @Get('revenue-share/rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE)
  @ApiOperation({ summary: '分账规则列表' })
  listRevenueRules(
    @Query('scope') scope?: RevenueShareScope,
    @Query('partnerTenantId') partnerTenantId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('active') active?: string,
  ) {
    return this.revenueShareService.listRules({
      scope,
      partnerTenantId: partnerTenantId ? Number(partnerTenantId) : undefined,
      tenantId: tenantId ? Number(tenantId) : undefined,
      active: active === undefined ? undefined : active === 'true',
    });
  }

  @Post('revenue-share/rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE)
  @ApiOperation({ summary: '新增分账规则' })
  createRevenueRule(@Body() dto: CreateRevenueShareRuleDto) {
    return this.revenueShareService.createRule(dto);
  }

  @Patch('revenue-share/rules/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE)
  @ApiOperation({ summary: '更新分账规则' })
  updateRevenueRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRevenueShareRuleDto,
  ) {
    return this.revenueShareService.updateRule(id, dto);
  }

  @Patch('revenue-share/rules/:id/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE)
  @ApiOperation({ summary: '启用 / 停用分账规则' })
  toggleRevenueRule(@Param('id', ParseIntPipe) id: number) {
    return this.revenueShareService.toggleRule(id);
  }

  @Delete('revenue-share/rules/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '删除分账规则' })
  removeRevenueRule(@Param('id', ParseIntPipe) id: number) {
    return this.revenueShareService.removeRule(id);
  }
}
