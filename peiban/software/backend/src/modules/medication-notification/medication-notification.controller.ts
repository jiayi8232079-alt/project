import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { MedicationNotificationService } from './medication-notification.service.js';
import { MedicationDigestService } from './medication-digest.service.js';
import {
  MedicationJobKind,
  MedicationJobStatus,
} from '../../entities/medication-notification-job.entity.js';

@ApiTags('用药推送任务')
@Controller('medication-notification-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
@ApiBearerAuth()
export class MedicationNotificationController {
  constructor(
    private readonly service: MedicationNotificationService,
    private readonly digestService: MedicationDigestService,
  ) {}

  @Get()
  @ApiOperation({ summary: '推送任务列表' })
  list(
    @Query('status') status?: string,
    @Query('kind') kind?: MedicationJobKind,
    @Query('reminderId') reminderId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedStatus = (status || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is MedicationJobStatus =>
        Object.values(MedicationJobStatus).includes(s as MedicationJobStatus),
      );
    return this.service.listJobs({
      status: parsedStatus.length > 0 ? parsedStatus : undefined,
      kind,
      reminderId: reminderId ? Number(reminderId) : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 30,
    });
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '手动重试推送任务' })
  retry(@Param('id', ParseIntPipe) id: number) {
    return this.service.retry(id);
  }

  @Post('digest/dispatch-now')
  @ApiOperation({ summary: '立即向所有家属推送一次"今日用药汇总"' })
  dispatchDigestNow() {
    return this.digestService.dispatchToday();
  }

  @Get('stats')
  @ApiOperation({ summary: '按 kind × channel 聚合的送达率统计' })
  stats(@Query('windowHours') windowHours?: string) {
    const hours = Number(windowHours) || 24;
    return this.service.stats(hours);
  }
}
