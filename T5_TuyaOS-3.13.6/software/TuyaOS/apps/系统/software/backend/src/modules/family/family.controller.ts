import {
  Controller, Post, Get, Put, Delete,
  Body, Query, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FamilyService } from './family.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';

/** 不需要登录的家庭相关接口（邀请码预览） */
@ApiTags('家庭关系-公开')
@Controller('public/family')
export class PublicFamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Get('by-invite-code/:code')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: '按邀请码预览家庭信息（公开）' })
  findByInviteCode(@Param('code') code: string) {
    return this.familyService.findGroupByInviteCode(code);
  }
}

@ApiTags('家庭关系')
@Controller('family')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @ApiOperation({ summary: '创建家庭群组' })
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: { name: string },
  ) {
    return this.familyService.createFamily(userId, dto.name);
  }

  @Get()
  @ApiOperation({ summary: '我的家庭列表' })
  getMyFamilies(@CurrentUser('id') userId: number) {
    return this.familyService.getMyFamilies(userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: '家庭成员列表' })
  getMembers(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.getFamilyMembers(id, userId);
  }

  @Get(':id/invite-code')
  @ApiOperation({ summary: '获取邀请码' })
  getInviteCode(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.getInviteCode(id, userId);
  }

  @Post(':id/refresh-invite')
  @ApiOperation({ summary: '刷新邀请码' })
  refreshInvite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.refreshInviteCode(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新家庭信息（名称、头像）— 仅 guardian 可调' })
  updateFamilyInfo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() dto: { name?: string; avatarUrl?: string | null },
  ) {
    return this.familyService.updateFamilyInfo(id, userId, dto);
  }

  @Post('join')
  @ApiOperation({ summary: '通过邀请码加入家庭' })
  joinByInviteCode(
    @CurrentUser('id') userId: number,
    @Body() dto: { inviteCode: string; relation: string; nickname?: string },
  ) {
    return this.familyService.joinByInviteCode(userId, dto.inviteCode, dto.relation, dto.nickname);
  }

  @Post('join-by-scan')
  @ApiOperation({ summary: '扫码加入家庭' })
  joinByQrScan(
    @CurrentUser('id') userId: number,
    @Body() dto: { familyGroupId: number; relation: string; nickname?: string },
  ) {
    return this.familyService.joinByQrScan(userId, dto.familyGroupId, dto.relation, dto.nickname);
  }

  @Get('member/:userId/health')
  @ApiOperation({ summary: '查看家人健康数据' })
  getMemberHealth(
    @CurrentUser('id') guardianId: number,
    @Param('userId', ParseIntPipe) memberUserId: number,
  ) {
    return this.familyService.getFamilyMemberHealth(guardianId, memberUserId);
  }

  @Get('member/:userId/medications')
  @ApiOperation({ summary: '查看家人用药提醒' })
  getMemberMedications(
    @CurrentUser('id') guardianId: number,
    @Param('userId', ParseIntPipe) memberUserId: number,
  ) {
    return this.familyService.getFamilyMemberMedications(guardianId, memberUserId);
  }

  @Get('member/:userId/orders')
  @ApiOperation({ summary: '查看家人订单' })
  getMemberOrders(
    @CurrentUser('id') guardianId: number,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.familyService.getFamilyMemberOrders(guardianId, memberUserId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Put(':id/members/:memberId')
  @ApiOperation({ summary: '更新成员信息' })
  updateMember(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: { nickname?: string; permissions?: any; role?: string },
  ) {
    return this.familyService.updateMember(groupId, memberId, userId, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: '移除成员' })
  removeMember(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.removeMember(groupId, memberId, userId);
  }

  @Post(':id/members/:memberId/link')
  @ApiOperation({ summary: '关联成员到服务对象（打通两套数据）' })
  linkServiceTarget(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: { serviceTargetId: number },
  ) {
    return this.familyService.linkServiceTarget(userId, groupId, memberId, dto.serviceTargetId);
  }

  @Post('members/:memberId/sync')
  @ApiOperation({ summary: '同步家人健康数据到关联的服务对象' })
  syncLinkedData(
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.syncLinkedData(userId, memberId);
  }

  // ─── 老人托管 ─────────────────────────────────────────────

  @Post(':groupId/elders')
  @ApiOperation({ summary: '家庭内添加老人（子女代建）' })
  createElder(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser('id') userId: number,
    @Body()
    dto: {
      name: string;
      phone?: string;
      idCard?: string;
      gender?: string;
      age?: number;
      relation: string;
      homeAddress?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      healthProfile?: Record<string, unknown>;
      delegatorRelation: 'self' | 'child' | 'spouse' | 'other';
    },
  ) {
    return this.familyService.createElder(userId, groupId, dto);
  }

  @Put(':groupId/elders/:memberId')
  @ApiOperation({ summary: '编辑老人档案' })
  updateElder(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: any,
  ) {
    return this.familyService.updateElder(userId, groupId, memberId, dto);
  }

  @Delete(':groupId/elders/:memberId')
  @ApiOperation({ summary: '移除老人档案' })
  removeElder(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.removeElder(userId, groupId, memberId);
  }

  @Post('elders/:memberId/trust-sign')
  @ApiOperation({ summary: '子女签署《老人托管服务委托书》' })
  signElderTrust(
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser('id') userId: number,
    @Body()
    dto: {
      signatureUrl: string;
      signerName: string;
      signerPhone?: string;
      signerIdCard?: string;
      signerRelation?: string;
    },
  ) {
    return this.familyService.signElderTrust(userId, memberId, dto);
  }

  // ─── 老人端单屏主页 ────────────────────────────────────────

  @Get('elder/overview')
  @ApiOperation({ summary: '老人端首页一次性概览' })
  elderOverview(@CurrentUser('id') userId: number) {
    return this.familyService.getElderOverview(userId);
  }

  @Get('elder/butler')
  @ApiOperation({ summary: '获取老人的专属客服' })
  elderButler(@CurrentUser('id') userId: number) {
    return this.familyService.getElderButler(userId);
  }

  @Get(':id/invite-qrcode')
  @ApiOperation({ summary: '生成家庭邀请小程序码（Guardian）' })
  getInviteQrcode(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.familyService.getInviteQrcode(id, userId);
  }


  // ─── Admin ─────────────────────────────────────────────────

  @Get('admin/groups')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '所有家庭群组（管理员）' })
  adminGetGroups(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.familyService.adminGetAllGroups({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('admin/groups/:id/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '家庭成员列表（管理员，无需加入该家庭）' })
  adminGetMembers(@Param('id', ParseIntPipe) id: number) {
    return this.familyService.adminGetFamilyMembers(id);
  }

  @Put('admin/groups/:id/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '修改家庭成员信息（管理员，无需加入该家庭）' })
  adminUpdateMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: {
      nickname?: string;
      relation?: string;
      placeholderName?: string;
      isElder?: boolean;
      role?: 'guardian' | 'member';
      permissions?: any;
    },
  ) {
    return this.familyService.adminUpdateFamilyMember(id, memberId, dto);
  }

  @Post('admin/groups/:id/members/:memberId/create-and-bind-target')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '新建健康档案并绑定到该成员（管理员）' })
  adminCreateAndBindTarget(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: { name: string; gender?: string; age?: number; relationship?: string },
  ) {
    return this.familyService.adminCreateAndBindServiceTarget(id, memberId, dto);
  }

  @Post('admin/bind')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台手动绑定家庭关系' })
  adminBind(
    @Body() dto: { guardianUserId: number; memberUserId: number; relation: string; familyName: string },
  ) {
    return this.familyService.adminBindFamily(dto.guardianUserId, dto.memberUserId, dto.relation, dto.familyName);
  }

  @Get('admin/by-user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE, UserRole.OPERATOR)
  @ApiOperation({ summary: '按用户 ID 查询其参与的家庭及成员（含占位老人）' })
  adminGetUserFamilies(@Param('userId', ParseIntPipe) userId: number) {
    return this.familyService.adminGetUserFamilies(userId);
  }

  @Get('admin/by-user/:userId/medications')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：按用户 ID 查询其用药提醒（无需为家庭成员）' })
  adminGetMemberMedications(@Param('userId', ParseIntPipe) userId: number) {
    return this.familyService.adminGetMemberMedications(userId);
  }

  @Get('admin/by-user/:userId/orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：按用户 ID 查询其订单（无需为家庭成员）' })
  adminGetMemberOrders(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.familyService.adminGetMemberOrders(userId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post('admin/groups/:id/assign-cs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '为某家庭分配专属客服' })
  adminAssignCs(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { adminId: number | null },
  ) {
    return this.familyService.adminAssignCs(id, dto.adminId);
  }

  @Post('admin/backfill')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '手动触发：把所有健康档案回溯同步到家庭看板（幂等，仅管理员）' })
  adminBackfill() {
    return this.familyService.backfillFamilyMembersFromServiceTargets();
  }

  @Get('admin/groups/:id/invite-qrcode')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE, UserRole.OPERATOR)
  @ApiOperation({ summary: '后台生成家庭邀请小程序码（不限 guardian 身份）' })
  adminGetFamilyInviteQrcode(@Param('id', ParseIntPipe) id: number) {
    return this.familyService.getInviteQrcodeForAdmin(id);
  }
}
