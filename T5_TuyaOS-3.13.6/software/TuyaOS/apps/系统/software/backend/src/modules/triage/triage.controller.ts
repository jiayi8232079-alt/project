import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { TriageService } from './triage.service.js';
import { CreateTriageDto } from './dto/create-triage.dto.js';
import { CreateTriageFeedbackDto } from './dto/triage-feedback.dto.js';
import { PostTriageMessageDto } from './dto/post-triage-message.dto.js';
import { ConvertTriageOrderDto } from './dto/convert-triage-order.dto.js';

@ApiTags('AI 智能导诊')
@Controller('triage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  // ═══════════════════════════════════════════════════════
  //  C 端用户接口
  // ═══════════════════════════════════════════════════════

  @Post('start')
  @ApiOperation({ summary: '提交导诊表单，获取分流结果' })
  async startTriage(@Request() req: any, @Body() dto: CreateTriageDto) {
    return this.triageService.startTriage(req.user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: '我的导诊记录列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getMySessions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.triageService.getMySessions(
      req.user.id,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '导诊详情' })
  async getSessionDetail(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.triageService.getSessionDetail(req.user.id, id);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: '导诊人工沟通留言列表（须已转人工）' })
  async getSessionMessages(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (req.user.type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.triageService.listTriageMessagesForUser(req.user.id, id);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '用户发送人工沟通留言' })
  async postSessionMessage(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostTriageMessageDto,
  ) {
    if (req.user.type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.triageService.postTriageMessageFromUser(req.user.id, id, dto);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: '提交导诊反馈' })
  async submitFeedback(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTriageFeedbackDto,
  ) {
    return this.triageService.submitFeedback(req.user.id, id, dto);
  }

  @Post(':id/convert')
  @ApiOperation({
    summary:
      '一键转订单（约号状态、名录医院、回电号码；未约号仍将流入订单中心并由客服致电确认）',
  })
  async convertToOrder(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertTriageOrderDto,
  ) {
    return this.triageService.convertToOrder(req.user.id, id, dto);
  }

  // ═══════════════════════════════════════════════════════
  //  管理后台接口
  // ═══════════════════════════════════════════════════════

  @Get('admin/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '[管理] 导诊记录列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'riskLevel', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'escalateToHuman', required: false })
  async adminList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('status') status?: string,
    @Query('escalateToHuman') escalateToHuman?: string,
  ) {
    return this.triageService.adminList({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      riskLevel,
      status,
      escalateToHuman: escalateToHuman === 'true' ? true : escalateToHuman === 'false' ? false : undefined,
    });
  }

  @Get('admin/detail/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '[管理] 导诊详情（含反馈）' })
  async adminGetDetail(@Param('id', ParseIntPipe) id: number) {
    return this.triageService.adminGetDetail(id);
  }

  @Get('admin/sessions/:sessionId/messages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '[管理] 导诊会话留言列表' })
  async adminGetSessionMessages(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.triageService.listTriageMessagesAdmin(sessionId);
  }

  @Post('admin/sessions/:sessionId/messages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '[管理] 发送管家留言' })
  async adminPostSessionMessage(
    @Request() req: any,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: PostTriageMessageDto,
  ) {
    return this.triageService.postTriageMessageFromStaff(req.user.id, sessionId, dto);
  }

  @Delete('admin/sessions/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '[管理] 删除导诊记录（含留言与反馈）' })
  async adminDeleteSession(@Param('id', ParseIntPipe) id: number) {
    return this.triageService.adminDeleteSession(id);
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '[管理] 导诊统计' })
  async adminGetStats() {
    return this.triageService.adminGetStats();
  }
}
