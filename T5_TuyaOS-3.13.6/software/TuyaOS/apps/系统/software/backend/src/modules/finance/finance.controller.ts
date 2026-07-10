import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { FinanceService } from './finance.service.js';
import { CreateFinanceRecordDto } from './dto/create-finance-record.dto.js';
import { FinanceQueryDto } from './dto/finance-query.dto.js';
import { FinanceReportQueryDto } from './dto/finance-report-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { AttendantService } from '../attendant/attendant.service.js';

@ApiTags('财务')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly attendantService: AttendantService,
  ) {}

  @Post()
  @ApiOperation({ summary: '提交费用报销' })
  @ApiResponse({ status: 201, description: '提交成功' })
  async create(
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body() dto: CreateFinanceRecordDto,
  ) {
    let attendantId: number;
    if (role === UserRole.ATTENDANT) {
      const attendant = await this.attendantService.findByUserId(userId);
      attendantId = attendant.id;
    } else {
      throw new UnauthorizedException('仅陪诊员可提交费用报销');
    }
    return this.financeService.create(attendantId, dto);
  }

  @Get()
  @ApiOperation({ summary: '获取费用记录列表（支持搜索筛选）' })
  @ApiResponse({ status: 200, description: '费用记录列表' })
  async findAll(
    @Query() query: FinanceQueryDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('type') type: string,
  ) {
    if (type === 'admin') {
      if (role !== UserRole.ADMIN && role !== UserRole.FINANCE) {
        throw new UnauthorizedException(
          '仅超级管理员与财务角色可查看财务记录',
        );
      }
      return this.financeService.findAll(query);
    }
    if (role === UserRole.ATTENDANT) {
      const attendant = await this.attendantService.findByUserId(userId);
      return this.financeService.findAll(query, attendant.id);
    }
    throw new UnauthorizedException('无权访问财务记录');
  }

  @Get('report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '获取财务统计报表' })
  @ApiResponse({ status: 200, description: '财务统计数据' })
  getReport(@Query() query: FinanceReportQueryDto) {
    return this.financeService.getStats(query.startDate, query.endDate);
  }

  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '审核通过' })
  @ApiResponse({ status: 200, description: '审核通过' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') reviewerId: number,
    @Body('reviewNote') reviewNote?: string,
  ) {
    return this.financeService.approve(id, reviewerId, reviewNote);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: '审核驳回' })
  @ApiResponse({ status: 200, description: '审核驳回' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') reviewerId: number,
    @Body('reviewNote') reviewNote: string,
  ) {
    return this.financeService.reject(id, reviewerId, reviewNote);
  }
}
