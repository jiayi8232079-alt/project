import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipService } from './membership.service.js';
import { UpdateUserMembershipDto } from './dto/update-user-membership.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';

@ApiTags('会员')
@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // ========== 当前用户会员信息（小程序） ==========
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户会员信息' })
  getMyMembership(@CurrentUser('id') userId: number) {
    return this.membershipService.getUserMembership(userId);
  }

  // ========== 后台管理：查看指定用户会员信息 ==========
  @Get('users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取指定用户会员信息' })
  getUserMembership(@Param('userId', ParseIntPipe) userId: number) {
    return this.membershipService.getUserMembership(userId);
  }

  // ========== 后台管理：孝心年卡管理 ==========
  @Get('annual-members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有孝心年卡会员列表' })
  getAnnualCardMembers() {
    return this.membershipService.getAnnualCardMembers();
  }

  @Post('users/:userId/annual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '为用户开通孝心年卡' })
  grantAnnualCard(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser('id') operatorId: number,
    @Body('startDate') startDate?: string,
    @Body('expireDate') expireDate?: string,
  ) {
    return this.membershipService.grantAnnualCard(
      userId,
      startDate,
      expireDate,
      operatorId,
    );
  }

  @Delete('users/:userId/annual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取消用户孝心年卡' })
  revokeAnnualCard(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser('id') operatorId: number,
  ) {
    return this.membershipService.revokeAnnualCard(userId, operatorId);
  }

  // ========== 后台管理：通用会员调整 ==========
  @Put('users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '调整用户会员信息（开始/到期日期、储值）' })
  updateUserMembership(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser('id') operatorId: number,
    @Body() dto: UpdateUserMembershipDto,
  ) {
    return this.membershipService.updateUserMembership(userId, dto, operatorId);
  }
}
