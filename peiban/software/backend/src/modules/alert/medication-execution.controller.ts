import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { MedicationExecutionService } from './medication-execution.service.js';
import {
  CheckInMedicationDto,
  QueryMedicationExecutionDto,
} from './dto/check-in.dto.js';

@ApiTags('用药打卡')
@Controller('medication-executions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicationExecutionController {
  constructor(private readonly service: MedicationExecutionService) {}

  @Post('check-in')
  @ApiOperation({ summary: '用药打卡（记录一次执行，支持 taken/skipped/missed）' })
  checkIn(
    @Body() dto: CheckInMedicationDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.checkIn(dto, userId, role);
  }

  @Get()
  @ApiOperation({ summary: '查询用药执行日志' })
  list(
    @Query() dto: QueryMedicationExecutionDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.list(dto, userId, role);
  }

  @Get('adherence/:userId')
  @ApiOperation({ summary: '查询指定用户近 N 天用药依从率' })
  getAdherence(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('windowDays') windowDays: string,
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
  ) {
    const days = Number(windowDays) > 0 ? Number(windowDays) : 7;
    return this.service.getAdherenceStats(userId, days, currentUserId, role);
  }
}
