import {
  Controller,
  ForbiddenException,
  Post,
  Get,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsultationService } from './consultation.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';

@ApiTags('预约咨询')
@Controller('consultations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  private assertUserPrincipal(type: string) {
    if (type !== 'user') {
      throw new ForbiddenException('当前接口仅支持用户端访问');
    }
  }

  @Post()
  @ApiOperation({ summary: '提交预约咨询申请' })
  create(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Body()
    dto: {
      type: string;
      serviceInterest?: string;
      category?: string;
      subType?: string;
      name: string;
      phone: string;
      date: string;
      time: string;
      detail?: string;
    },
  ) {
    this.assertUserPrincipal(type);
    return this.consultationService.create(userId, dto);
  }

  @Get('slot-options')
  @ApiOperation({ summary: '获取预约可用号源时段' })
  getSlotOptions(@Query('date') date?: string) {
    return this.consultationService.getSlotOptions(date || '');
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前用户的预约咨询列表（小程序用）' })
  getMyConsultations(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    this.assertUserPrincipal(type);
    return this.consultationService.findByUserId(userId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '预约咨询列表（管理员）' })
  findAll(
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('serviceInterest') serviceInterest?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.consultationService.findAll({
      date,
      status,
      serviceInterest,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
      excludeOrderAccepted: !status ? true : undefined,
    });
  }

  @Get('by-date')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '按日期获取预约列表' })
  findByDate(@Query('date') date: string) {
    return this.consultationService.findByDate(date);
  }

  @Get('date-summary')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '获取有预约的日期汇总' })
  getDateSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.consultationService.getDateSummary(startDate, endDate);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '更新预约咨询状态' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.consultationService.updateStatus(id, body.status);
  }
}
