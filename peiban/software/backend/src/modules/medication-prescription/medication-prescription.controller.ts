import {
  Controller,
  Get,
  Post,
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
import { MedicationPrescriptionService } from './medication-prescription.service.js';
import { CreatePrescriptionDto, PrescriptionItemDto } from './dto/create-prescription.dto.js';
import { PrescriptionReviewStatus } from '../../entities/medication-prescription.entity.js';

@ApiTags('处方批次')
@Controller('medication-prescriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicationPrescriptionController {
  constructor(private readonly service: MedicationPrescriptionService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.ATTENDANT,
  )
  @ApiOperation({ summary: '创建处方批次（陪诊员提交走待审；运营直接通过）' })
  create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.create(dto, { id: userId, role, name: nickname });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '处方批次列表（可按 reviewStatus 过滤）' })
  list(
    @Query('userId') userId?: string,
    @Query('serviceTargetId') serviceTargetId?: string,
    @Query('reviewStatus') reviewStatus?: PrescriptionReviewStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      userId: userId ? Number(userId) : undefined,
      serviceTargetId: serviceTargetId ? Number(serviceTargetId) : undefined,
      reviewStatus,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('my')
  @ApiOperation({ summary: '当前用户的处方批次列表' })
  listMy(@CurrentUser('id') userId: number) {
    return this.service.listByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '处方批次详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '运营审核通过，正式产生 reminder' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      items?: PrescriptionItemDto[];
      startDate?: string;
      reviewNote?: string;
    },
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.approve(id, { id: userId, role, name: nickname }, body);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '驳回处方' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.reject(
      id,
      { id: userId, role, name: nickname },
      String(body?.reason || ''),
    );
  }
}
