import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { AlertCategory } from '../../entities/health-alert.entity.js';
import { AlertService } from './alert.service.js';
import { QueryAlertDto } from './dto/query-alert.dto.js';
import {
  AcknowledgeAlertDto,
  AppendAlertLogDto,
  AssignAlertDto,
  CloseAlertDto,
  MockDeviceAlertDto,
} from './dto/update-alert.dto.js';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto.js';

@ApiTags('健康预警')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @ApiOperation({ summary: '查询预警列表（家属端 + 管理端共用）' })
  list(
    @Query() dto: QueryAlertDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.list(dto, userId, role);
  }

  @Get('pending-count')
  @ApiOperation({ summary: '家属端：获取未处理预警数量（用于看板顶部横幅）' })
  pendingCount(@CurrentUser('id') userId: number) {
    return this.alertService.countPending(userId);
  }

  @Get('rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '获取规则列表（管理端）' })
  listRules() {
    return this.alertService.listRules();
  }

  @Put('rules/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '更新规则配置（开关/阈值/严重度/冷却）' })
  updateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertService.updateRule(id, dto);
  }

  @Get('admin/assignable-staff')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '获取可指派的处理人列表（管理端）' })
  listAssignableStaff() {
    return this.alertService.listAssignableStaff();
  }

  @Post('admin/scan/medication-miss')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '手动触发漏服预警扫描（调试用）' })
  async scanMedicationMiss() {
    await this.alertService.scanMedicationMiss();
    return { success: true };
  }

  @Post('admin/scan/follow-up-overdue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '手动触发复诊逾期扫描（调试用）' })
  async scanFollowUpOverdue() {
    await this.alertService.scanFollowUpOverdue();
    return { success: true };
  }

  @Get('fall-events')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '视觉跌倒事件列表（V4.3 兼容入口）' })
  listFallEvents(@Query() dto: QueryAlertDto, @CurrentUser('id') userId: number) {
    return this.alertService.list(
      { ...dto, category: AlertCategory.SERVICE_EXCEPTION },
      userId,
      UserRole.ADMIN,
    );
  }

  @Post('mock-event')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '生成 SOS/视觉跌倒/体征异常 mock 告警' })
  mockEvent(@Body() dto: MockDeviceAlertDto) {
    return this.alertService.createDeviceAlert(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '查看预警详情' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.findOne(id, userId, role);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: '确认预警（知悉）' })
  acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcknowledgeAlertDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.acknowledge(id, userId, role, dto);
  }

  @Post(':id/ack')
  @ApiOperation({ summary: '接管告警（V4.3 App/社区别名）' })
  ack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcknowledgeAlertDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.acknowledge(id, userId, role, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: '关闭预警（已处理）' })
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseAlertDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.close(id, userId, role, dto);
  }

  @Post(':id/false-alarm')
  @ApiOperation({ summary: '标记告警为误报' })
  falseAlarm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseAlertDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.markFalseAlarm(id, userId, role, dto);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '指派告警给客服/健康管家（管理端）' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAlertDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.assign(id, userId, role, dto);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: '获取告警处理日志（时间线）' })
  listLogs(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.listLogs(id, userId, role);
  }

  @Post(':id/logs')
  @ApiOperation({ summary: '追加跟进备注（家属端 / 管理端均可）' })
  appendLog(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AppendAlertLogDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.alertService.appendLog(id, userId, role, dto);
  }
}
