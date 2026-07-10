import {
  Body,
  Controller,
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
import { UserRole } from '../../common/enums/index.js';
import { AiDialogService } from './ai-dialog.service.js';
import { AppendDialogLogDto } from './dto/append-log.dto.js';
import { ListDialogSessionDto } from './dto/list-dialog.dto.js';

@ApiTags('AI 对话留存')
@Controller('ai-dialogs')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class AiDialogController {
  constructor(private readonly aiDialogService: AiDialogService) {}

  @Get()
  @ApiOperation({ summary: '会话列表（按服务对象/设备/时间过滤）' })
  list(@Query() query: ListDialogSessionDto) {
    return this.aiDialogService.listSessions(query);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '会话详情（含完整 logs）' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.aiDialogService.getSessionDetail(id);
  }

  // ─────────────── 写入（ai-gateway 调用 / admin mock）───────────────

  @Post('logs')
  @ApiOperation({
    summary: '追加一条对话留存（ai-gateway 在工具调用后写入；admin 测试入口）',
  })
  append(@Body() dto: AppendDialogLogDto) {
    return this.aiDialogService.appendLog(dto);
  }

  @Post('sessions/:id/finish')
  @ApiOperation({ summary: '结束会话（VAD 静音超时 / 主动结束）' })
  finish(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { summary?: string },
  ) {
    return this.aiDialogService.finishSession(id, body?.summary);
  }

  // ─────────────── 质检（admin）───────────────

  @Patch('sessions/:id/qa-status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MEDICAL_CONSULTANT, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '质检：标记会话审核状态' })
  markQa(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'sampled' | 'reviewed' | 'flagged' },
  ) {
    return this.aiDialogService.markQaStatus(id, body.status);
  }
}
