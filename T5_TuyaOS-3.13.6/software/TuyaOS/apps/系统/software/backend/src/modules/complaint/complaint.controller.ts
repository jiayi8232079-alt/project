import {
  Body,
  Controller,
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
import { ComplaintService } from './complaint.service.js';
import type { ListComplaintsQuery } from './complaint.service.js';
import { CreateComplaintDto } from './dto/create-complaint.dto.js';
import {
  UpdateComplaintDto,
  UserAppendComplaintDto,
} from './dto/update-complaint.dto.js';

@ApiTags('投诉工单')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  /**
   * 用户提交工单（小程序）
   */
  @Post()
  @ApiOperation({ summary: '用户提交投诉/申诉工单' })
  create(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: CreateComplaintDto,
  ) {
    if (type !== 'user') {
      throw new ForbiddenException('仅用户可提交工单');
    }
    return this.complaintService.createForUser(userId, dto);
  }

  /**
   * 当前用户自己的工单列表
   */
  @Get('mine')
  @ApiOperation({ summary: '我的工单列表' })
  listMine(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Query() query: ListComplaintsQuery,
  ) {
    if (type !== 'user') {
      throw new ForbiddenException('当前身份不支持该接口');
    }
    return this.complaintService.listMine(userId, query);
  }

  /**
   * 管理员列表
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '管理端工单列表' })
  listAll(@Query() query: ListComplaintsQuery) {
    return this.complaintService.list(query);
  }

  /**
   * 管理端统计
   */
  @Get('stats/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '工单状态统计' })
  stats() {
    return this.complaintService.statsOverview();
  }

  /**
   * 工单详情 —— 管理员可直接看；用户仅能看自己的
   */
  @Get(':id')
  @ApiOperation({ summary: '工单详情' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
  ) {
    if (type === 'admin') {
      return this.complaintService.findOne(id);
    }
    return this.complaintService.findOneForUser(id, userId);
  }

  /**
   * 用户追加补充 / 评分 / 关闭
   */
  @Post(':id/append')
  @ApiOperation({ summary: '用户侧补充/评分/关闭' })
  userAppend(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: UserAppendComplaintDto,
  ) {
    if (type !== 'user') {
      throw new ForbiddenException('仅用户可操作');
    }
    return this.complaintService.userAppend(id, userId, dto);
  }

  /**
   * 管理员处理：指派/更新状态/回复
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '管理员处理工单' })
  adminUpdate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @CurrentUser('username') username: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaintService.adminUpdate(
      id,
      adminId,
      username || `admin#${adminId}`,
      dto,
    );
  }
}
