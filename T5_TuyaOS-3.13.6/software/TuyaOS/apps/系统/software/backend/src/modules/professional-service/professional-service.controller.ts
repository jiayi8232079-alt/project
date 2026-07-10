import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import {
  ProfessionalServiceService,
  ProfessionalServiceUpsertDto,
} from './professional-service.service.js';
import { ProfessionalServiceCategory } from '../../entities/professional-service.entity.js';

class ProfessionalServiceUpdateDto {
  category?: ProfessionalServiceCategory;
  code?: string;
  name?: string;
  shortDesc?: string;
  detail?: string | null;
  icon?: string;
  coverImage?: string | null;
  targetGroups?: string[];
  highlights?: string[];
  durationHint?: string | null;
  priceDisplayText?: string | null;
  sopSteps?: ProfessionalServiceUpsertDto['sopSteps'];
  enabled?: boolean;
  sortOrder?: number;
}

@ApiTags('专业服务目录')
@Controller('professional-services')
export class ProfessionalServiceController {
  constructor(private readonly service: ProfessionalServiceService) {}

  // ─── 小程序端 / 公共（无需登录） ───

  @Get('public')
  @ApiOperation({ summary: '获取启用中的服务目录（小程序首页/服务页用）' })
  async listPublic(
    @Query('category') category?: ProfessionalServiceCategory,
  ) {
    const items = await this.service.listPublic({ category });
    return { items };
  }

  @Get('public/code/:code')
  @ApiOperation({ summary: '小程序获取服务详情（含 SOP）' })
  getPublicByCode(@Param('code') code: string) {
    return this.service.getPublicByCode(code);
  }

  // ─── 管理后台 ───

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '管理后台：服务目录列表' })
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: ProfessionalServiceCategory,
    @Query('enabled') enabled?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.listAdmin({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      category,
      enabled: enabled === undefined ? undefined : enabled === 'true',
      keyword,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '管理后台：服务详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '新增自定义服务' })
  create(@Body() dto: ProfessionalServiceUpsertDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '更新服务（含启用/禁用、排序）' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProfessionalServiceUpdateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '快捷切换启用/禁用' })
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleEnabled(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除自定义服务（内置不可删）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
