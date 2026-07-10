import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('仪表板')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '运营工作台综合概览（KPI / 评价 / 陪诊员榜单）' })
  getOverview() {
    return this.dashboardService.getOverview();
  }
}
