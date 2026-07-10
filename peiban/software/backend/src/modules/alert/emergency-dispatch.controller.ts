import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AlertService } from './alert.service.js';
import { EscalateAlertDto } from './dto/update-alert.dto.js';

@ApiTags('应急升级')
@Controller('emergency-dispatch')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class EmergencyDispatchController {
  constructor(private readonly alertService: AlertService) {}

  @Post(':alertId/escalate')
  @ApiOperation({ summary: '将 SOS/跌倒等告警升级到社区、人工中台或应急外呼' })
  escalate(
    @Param('alertId', ParseIntPipe) alertId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body() dto: EscalateAlertDto,
  ) {
    return this.alertService.escalate(alertId, userId, role, dto);
  }
}
