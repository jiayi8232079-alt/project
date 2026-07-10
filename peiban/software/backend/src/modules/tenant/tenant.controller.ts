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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { TenantService } from './tenant.service.js';
import { TenantHierarchyService } from './tenant-hierarchy.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { ListTenantDto } from './dto/list-tenant.dto.js';
import { AddTenantUserDto } from './dto/add-tenant-user.dto.js';
import { MoveTenantDto } from './dto/move-tenant.dto.js';

/**
 * 租户管理 API（管理后台超管使用）。
 *
 * 路由分层：
 * - `GET /tenants`、`POST /tenants` 等管理操作 → 仅 `admin`（type=admin）。
 * - `GET /tenants/me/list` → 任意已登录用户均可，用于「切换租户」下拉。
 * - `GET /tenants/permissions` → admin 专属，查看平台权限点全集。
 */
@ApiTags('租户管理')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly hierarchyService: TenantHierarchyService,
  ) {}

  // ─────────────── 当前用户视角 ───────────────

  @Get('me/list')
  @ApiOperation({ summary: '当前登录用户加入的全部租户（用于切换租户）' })
  myTenants(@CurrentUser('id') userId: number) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.tenantService.listTenantsByUser(userId);
  }

  // ─────────────── 平台超管：租户 CRUD ───────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '租户列表（平台超管）' })
  list(@Query() query: ListTenantDto) {
    return this.tenantService.list(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '新建租户' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get('roles')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '查询租户角色列表（tenantId 可选，传 null 取平台预置）' })
  listRoles(@Query('tenantId') tenantIdRaw?: string) {
    const tenantId = tenantIdRaw && tenantIdRaw !== '' ? Number(tenantIdRaw) : undefined;
    return this.tenantService.listRoles(tenantId);
  }

  @Get('permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '查询平台全局权限点清单' })
  listPermissions() {
    return this.tenantService.listPermissions();
  }

  @Get('tree')
  @ApiOperation({ summary: '当前用户可见的租户树' })
  async getTree(@CurrentUser() user: AuthenticatedUser) {
    return this.hierarchyService.getTreeForViewer(user.tenantId);
  }

  @Get(':id/descendants')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '子孙租户 ID 列表' })
  async descendants(@Param('id', ParseIntPipe) id: number) {
    const ids = await this.hierarchyService.getDescendantIds(id, {
      includeSelf: true,
    });
    return { tenantId: id, ids };
  }

  @Get(':id/ancestors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '祖先租户链' })
  ancestors(@Param('id', ParseIntPipe) id: number) {
    return this.hierarchyService.getAncestors(id);
  }

  @Get(':id/children')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '直属子租户' })
  children(@Param('id', ParseIntPipe) id: number) {
    return this.hierarchyService.getChildren(id);
  }

  @Get(':id/breadcrumbs')
  @ApiOperation({ summary: '租户面包屑（根 → 当前）' })
  breadcrumbs(@Param('id', ParseIntPipe) id: number) {
    return this.hierarchyService.getBreadcrumbs(id);
  }

  @Post(':id/move')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '移动租户到新父节点' })
  move(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveTenantDto,
  ) {
    return this.hierarchyService.moveTenant(id, dto.newParentId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '租户详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新租户' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '停用租户（软停，不真删）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.remove(id).then(() => ({ message: '已停用' }));
  }

  // ─────────────── 成员管理 ───────────────

  @Get(':id/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '租户成员列表' })
  listMembers(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.listMembers(id);
  }

  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '加入租户成员' })
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddTenantUserDto,
  ) {
    return this.tenantService.addUser(id, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '移除租户成员' })
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.tenantService
      .removeUser(id, userId)
      .then(() => ({ message: '已移除' }));
  }
}
