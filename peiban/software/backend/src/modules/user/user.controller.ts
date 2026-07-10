import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { CreateServiceTargetDto } from './dto/create-service-target.dto.js';
import { UpdateServiceTargetDto } from './dto/update-service-target.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { normalizeCnPhone } from '../../common/utils/phone-utils.js';

@ApiTags('用户')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取用户列表' })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({
    name: 'customerOnly',
    required: false,
    description: '为 true 时仅返回小程序端客户（role=user）',
  })
  @ApiQuery({
    name: 'archiveStatus',
    required: false,
    description:
      '建档筛选：filled=仅已建档（至少一条服务对象）；empty=仅未建档；不传=全部',
  })
  findAll(
    @Query()
    query: PaginationDto & {
      keyword?: string;
      customerOnly?: string;
      archiveStatus?: string;
    },
  ) {
    return this.userService.findAll(query);
  }

  @Get('trash')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '获取回收站用户列表' })
  getDeletedUsers(@Query() query: PaginationDto & { keyword?: string }) {
    return this.userService.getDeletedUsers(query);
  }

  // --- me/ 路由必须在 :id 路由之前 ---

  private assertUserPrincipal(type: string) {
    if (type !== 'user') {
      throw new ForbiddenException('当前接口仅支持用户端访问');
    }
  }

  @Get('me/service-targets')
  @ApiOperation({ summary: '获取当前用户的服务对象列表' })
  getMyServiceTargetsGuarded(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
  ) {
    this.assertUserPrincipal(type);
    return this.userService.getServiceTargets(userId);
  }

  @Put('me')
  @ApiOperation({ summary: '当前用户更新自己的头像和昵称' })
  updateMyProfile(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() data: { nickname?: string; avatarUrl?: string },
  ) {
    this.assertUserPrincipal(type);
    return this.userService.updateUser(userId, data);
  }

  @Post('me/service-targets')
  @ApiOperation({ summary: '创建服务对象' })
  createServiceTarget(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: CreateServiceTargetDto,
  ) {
    this.assertUserPrincipal(type);
    return this.userService.createServiceTarget(userId, dto);
  }

  // --- service-targets 静态路由（具体路径须先于 :id）---

  @Get('service-targets')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({
    summary:
      '管理端：分页查询全库健康档案（每行一条 service_target）；可选 customerOnly 仅小程序客户账号',
  })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({
    name: 'customerOnly',
    required: false,
    description: '为 true 时仅返回所属用户为小程序客户（role=user）的档案',
  })
  findAllServiceTargetsDirectory(
    @Query()
    query: PaginationDto & { keyword?: string; customerOnly?: string },
  ) {
    return this.userService.findAllServiceTargetsDirectory(query);
  }

  @Get('service-targets/:id')
  @ApiOperation({ summary: '获取单个服务对象详情' })
  findServiceTarget(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.userService.findServiceTargetById(id, currentUserId, role);
  }

  @Get('service-targets/:id/history')
  @ApiOperation({ summary: '获取服务对象历史就诊记录' })
  getServiceTargetHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.userService.getServiceTargetHistory(id, currentUserId, role);
  }

  @Get('service-targets/:id/health-profile-html')
  @ApiOperation({ summary: '生成健康档案HTML（可打印/编辑）' })
  getHealthProfileHtml(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.userService.generateHealthProfileHtml(id, currentUserId, role);
  }

  @Put('service-targets/:id')
  @ApiOperation({ summary: '更新服务对象' })
  updateServiceTarget(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceTargetDto,
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.userService.updateServiceTarget(id, dto, currentUserId, role);
  }

  @Delete('service-targets/:id')
  @ApiOperation({ summary: '删除服务对象' })
  deleteServiceTarget(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.userService.deleteServiceTarget(id, currentUserId, role);
  }

  // --- :id 动态路由 ---

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取用户详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '更新用户信息' })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { nickname?: string; phone?: string; status?: boolean },
  ) {
    if (data?.phone !== undefined) {
      data.phone = normalizeCnPhone(data.phone, '客户手机号') ?? '';
    }
    return this.userService.updateUser(id, data);
  }

  @Put(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '修改用户角色（仅超级管理员）' })
  updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { role: string },
    @CurrentUser('id') operatorId: number,
    @CurrentUser('type') operatorType: string,
  ) {
    // 仅当操作者本身是 users 表中的用户时才检查自修改
    // 若操作者是 admin_users 表中的管理员（type='admin'），其 ID 与 users 表 ID 独立，
    // 不可做跨表比较，否则 ID 数字恰好相同时会误报"不能修改自己的角色"
    if (operatorType === 'user' && id === operatorId) {
      throw new ForbiddenException('不能修改自己的角色');
    }
    const allowedRoles = Object.values(UserRole);
    if (!allowedRoles.includes(data.role as UserRole)) {
      throw new ForbiddenException(`角色值无效，允许的值：${allowedRoles.join(', ')}`);
    }
    return this.userService.updateUser(id, { role: data.role as UserRole });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '软删除客户（移入回收站）' })
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUser(id);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '从回收站恢复客户' })
  restoreUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.restoreUser(id);
  }

  @Delete(':id/permanent')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '彻底删除客户（不可恢复）' })
  permanentDeleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.permanentDeleteUser(id);
  }

  @Get(':id/service-targets')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取用户的服务对象列表' })
  getServiceTargets(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.getServiceTargets(userId);
  }

  @Post(':id/service-targets')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '管理员为指定客户创建服务对象（健康档案）' })
  createServiceTargetForUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body() dto: CreateServiceTargetDto,
  ) {
    return this.userService.createServiceTarget(userId, dto);
  }
}
