import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { ServiceCollaborationService } from './service-collaboration.service.js';
import {
  CreateHospitalPartnershipDto,
  CreateServiceProviderDto,
} from './dto/service-collaboration.dto.js';

@ApiTags('服务协同')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class ServiceCollaborationController {
  constructor(private readonly service: ServiceCollaborationService) {}

  @Post('service-providers')
  @ApiOperation({ summary: '新增生活服务商/合作企业' })
  createProvider(@Body() dto: CreateServiceProviderDto) {
    return this.service.createProvider(dto);
  }

  @Get('service-providers')
  @ApiOperation({ summary: '服务商列表' })
  listProviders() {
    return this.service.listProviders();
  }

  @Post('hospital-partnerships')
  @ApiOperation({ summary: '新增合作医院协议和资源' })
  createHospitalPartnership(@Body() dto: CreateHospitalPartnershipDto) {
    return this.service.createHospitalPartnership(dto);
  }

  @Get('hospital-partnerships')
  @ApiOperation({ summary: '合作医院资源列表（App/后台共用）' })
  listHospitalPartnerships() {
    return this.service.listHospitalPartnerships();
  }
}
