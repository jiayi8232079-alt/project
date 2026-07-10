import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AiConsultationService } from './ai-consultation.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';

@ApiTags('AI 智能问诊')
@Controller('ai-consultation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiConsultationController {
  constructor(private readonly service: AiConsultationService) {}

  // ─── 用户端接口 ──────────────────────────────────────────────

  @Post('chat')
  @ApiOperation({ summary: '发送问诊消息' })
  chat(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: { message: string; sessionId?: string; serviceTargetId?: number },
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.chat(userId, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: '获取我的问诊会话列表' })
  getSessions(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.getSessions(userId, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: '获取某次问诊的完整对话' })
  getSessionMessages(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Param('sessionId') sessionId: string,
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.getSessionMessages(userId, sessionId);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: '删除我的某次问诊会话（该会话下全部消息）' })
  deleteMySession(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Param('sessionId') sessionId: string,
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.deleteSessionForUser(userId, sessionId);
  }

  @Post('check-medications')
  @ApiOperation({ summary: '用药交互作用检测' })
  checkMedications(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: { medications: string[]; serviceTargetId?: number },
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.checkMedicationInteractions(userId, dto);
  }

  @Post('dietary-advice')
  @ApiOperation({ summary: '智能饮食建议' })
  dietaryAdvice(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: { condition?: string; serviceTargetId?: number },
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.getDietaryAdvice(userId, dto);
  }

  @Post('interpret-report')
  @ApiOperation({
    summary: '健康材料智能解读（报告/药盒/图文等；配图建议在后台配置多模态「视觉模型」）',
  })
  interpretReport(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: { reportText: string; sessionId?: string; serviceTargetId?: number },
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.interpretReport(userId, dto);
  }

  @Post('clinic-handoff')
  @ApiOperation({ summary: '生成门诊用就诊信息摘要（病历式整理，非对话原文）' })
  clinicHandoff(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body() dto: { sessionId: string; serviceTargetId?: number },
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.generateClinicHandoffSummary(userId, dto);
  }

  @Post('messages/:id/feedback')
  @ApiOperation({ summary: '评价助手某条回复是否有用' })
  messageFeedback(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Param('id', ParseIntPipe) messageId: number,
    @Body() dto: { helpful: boolean },
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    return this.service.setMessageFeedback(userId, messageId, dto);
  }

  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '语音转文字（录音文件上传）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  transcribe(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (type !== 'user') throw new ForbiddenException('仅用户端可用');
    if (!file) throw new BadRequestException('请上传录音文件');
    return this.service.transcribeAudio(userId, file);
  }

  // ─── 管理端接口 ──────────────────────────────────────────────

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '问诊统计概览（管理员）' })
  getStats() {
    return this.service.getStats();
  }

  @Get('admin/sessions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '所有问诊会话列表（管理员）' })
  adminGetSessions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.adminGetSessions({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('admin/sessions/:sessionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '查看某次问诊完整对话（管理员）' })
  adminGetSessionDetail(@Param('sessionId') sessionId: string) {
    return this.service.adminGetSessionDetail(sessionId);
  }

  @Get('admin/by-user')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '按客户维度聚合问诊记录（管理员）' })
  adminGetByUser(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.adminGetByUser({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('admin/users/:userId/messages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '查看某客户的全部问诊消息（管理员）' })
  adminGetUserMessages(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.adminGetUserMessages(userId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
  }

  @Delete('admin/users/:userId/sessions/:sessionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '删除某客户指定会话的全部问诊消息（管理员）' })
  adminDeleteUserSession(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.adminDeleteUserSession(userId, decodeURIComponent(sessionId));
  }

  // ─── 健康周报接口 ──────────────────────────────────────────

  @Get('weekly-reports')
  @ApiOperation({ summary: '我的健康周报列表' })
  getWeeklyReports(
    @CurrentUser('id') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getWeeklyReports(userId, page ? Number(page) : 1, pageSize ? Number(pageSize) : 10);
  }

  @Get('weekly-reports/:id')
  @ApiOperation({ summary: '周报详情' })
  getWeeklyReportById(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getWeeklyReportById(id, userId);
  }

  @Post('weekly-reports/generate')
  @ApiOperation({ summary: '手动生成周报' })
  generateWeeklyReport(
    @CurrentUser('id') userId: number,
    @Body() dto: { serviceTargetId?: number },
  ) {
    return this.service.generateWeeklyReport(userId, dto.serviceTargetId);
  }

  @Get('admin/weekly-reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '所有健康周报（管理员）' })
  adminGetWeeklyReports(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.adminGetWeeklyReports({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('admin/messages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '问诊消息搜索（管理员）' })
  adminFindAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.adminFindAll({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      userId: userId ? Number(userId) : undefined,
      keyword,
    });
  }
}
