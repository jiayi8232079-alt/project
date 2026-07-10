import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  BadRequestException,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AttendantService } from './attendant.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { CreateMyScheduleDto } from './dto/create-my-schedule.dto.js';
import { SetCredentialsDto } from './dto/set-credentials.dto.js';
import { ServiceStaffRole } from '../../entities/attendant.entity.js';

class UpdateProfessionalProfileDto {
  primaryRole?: ServiceStaffRole;
  professionalRoles?: ServiceStaffRole[];
  specialties?: string[];
  certifications?: {
    name: string;
    number?: string;
    issuedAt?: string;
    expiry?: string | null;
    imageUrl?: string;
  }[];
  title?: string | null;
  experienceYears?: number;
}
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { normalizeCnPhone } from '../../common/utils/phone-utils.js';

@ApiTags('陪诊员')
@Controller('attendants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendantController {
  constructor(private readonly attendantService: AttendantService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取陪诊员列表' })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query() query: PaginationDto & { keyword?: string; status?: string },
  ) {
    return this.attendantService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前陪诊员自己的档案' })
  getMe(@CurrentUser('id') userId: number) {
    return this.attendantService.findByUserId(userId);
  }

  @Get('me/workbench')
  @ApiOperation({ summary: '工作台聚合数据（按角色变装，供小程序工作台渲染）' })
  getMyWorkbench(@CurrentUser('id') userId: number) {
    return this.attendantService.getMyWorkbench(userId);
  }

  @Get('role-configs')
  @ApiOperation({ summary: '所有服务人员角色的配置（公开，供前端自描述用）' })
  listRoleConfigs() {
    return this.attendantService.listRoleConfigs();
  }

  @Get('me/stats')
  @ApiOperation({ summary: '获取当前陪诊员统计数据' })
  getMyStats(@CurrentUser('id') userId: number) {
    return this.attendantService.getMyStats(userId);
  }

  @Get('me/wallet')
  @ApiOperation({ summary: '获取当前陪诊员钱包/收入明细' })
  getMyWallet(@CurrentUser('id') userId: number) {
    return this.attendantService.getMyWallet(userId);
  }

  @Get('me/schedules')
  @ApiOperation({ summary: '获取当前陪诊员自己的排班' })
  getMySchedules(
    @CurrentUser('id') userId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendantService.getMySchedules(userId, startDate, endDate);
  }

  @Put('me/schedules')
  @ApiOperation({ summary: '陪诊员提交自己的排班' })
  submitMySchedules(
    @CurrentUser('id') userId: number,
    @Body()
    body:
      | CreateMyScheduleDto[]
      | { schedules?: Array<{ date: string; period?: string; slot?: string }>; startDate?: string; endDate?: string },
  ) {
    const list = Array.isArray(body) ? body : body?.schedules || [];
    const normalized = list.map((item: any) => {
      const periodRaw = item.period || item.slot;
      const periodMap: Record<string, string> = {
        morning: 'morning',
        afternoon: 'afternoon',
        full_day: 'full_day',
        allday: 'full_day',
      };
      const period = periodMap[periodRaw];
      if (!period || !item.date) {
        throw new BadRequestException('排班参数不正确');
      }
      return {
        date: item.date,
        period,
      };
    });
    const opts =
      !Array.isArray(body) && body?.startDate && body?.endDate
        ? { startDate: body.startDate, endDate: body.endDate }
        : undefined;
    return this.attendantService.submitMySchedules(userId, normalized as any, opts);
  }

  @Get('grab-orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT, UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取抢单池订单列表（陪诊员按角色过滤；后台看全部）' })
  getGrabOrders(
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.attendantService.getGrabOrders(userId, role);
  }

  @Get('assigned-orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT)
  @ApiOperation({ summary: '获取当前陪诊员待确认的指派任务' })
  getAssignedOrders(@CurrentUser('id') userId: number) {
    return this.attendantService.getAssignedOrders(userId);
  }

  @Get('available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取指定时间可用的陪诊员' })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'period', required: true })
  getAvailable(@Query('date') date: string, @Query('period') period: string) {
    return this.attendantService.getAvailable(date, period);
  }

  @Get('schedules/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '获取所有陪诊员排班（后台用）' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAllSchedules(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendantService.getAllSchedules(startDate, endDate);
  }

  @Get('list/available-users')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '获取可转为陪诊员的用户列表' })
  @ApiQuery({ name: 'keyword', required: false })
  getAvailableUsers(@Query() query: PaginationDto & { keyword?: string }) {
    return this.attendantService.getAvailableUsers(query);
  }

  @Get('trash/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '获取回收站陪诊员列表' })
  @ApiQuery({ name: 'keyword', required: false })
  findTrashed(@Query() query: PaginationDto & { keyword?: string }) {
    return this.attendantService.findTrashed(query);
  }

  @Put('trash/:id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '从回收站恢复陪诊员' })
  restoreAttendant(@Param('id', ParseIntPipe) id: number) {
    return this.attendantService.restoreAttendant(id);
  }

  @Delete('trash/:id/hard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '彻底删除陪诊员（不可恢复）' })
  hardDeleteAttendant(@Param('id', ParseIntPipe) id: number) {
    return this.attendantService.hardDeleteAttendant(id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取陪诊员详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.attendantService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '新增陪诊员' })
  create(
    @Body()
    data: {
      realName?: string;
      employeeId?: string;
      phone?: string;
      openid?: string;
      userId?: number;
    },
  ) {
    if (data?.phone !== undefined) {
      data.phone = normalizeCnPhone(data.phone, '陪诊员手机号') ?? '';
    }
    return this.attendantService.create(data);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '更新陪诊员信息' })
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    if (data && typeof data === 'object' && data.phone !== undefined) {
      data.phone = normalizeCnPhone(data.phone, '陪诊员手机号') ?? '';
    }
    return this.attendantService.update(id, data);
  }

  @Put(':id/professional-profile')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '更新服务人员专业资料（角色/专长/持证）' })
  updateProfessionalProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProfessionalProfileDto,
  ) {
    return this.attendantService.updateProfessionalProfile(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '软删除陪诊员（移入回收站）' })
  deleteAttendant(@Param('id', ParseIntPipe) id: number) {
    return this.attendantService.deleteAttendant(id);
  }

  @Put(':id/credentials')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '设置陪诊员登录账号和密码' })
  setCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetCredentialsDto,
  ) {
    return this.attendantService.setCredentials(id, dto);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '切换陪诊员状态' })
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: 'active' | 'disabled',
  ) {
    return this.attendantService.toggleStatus(id, status);
  }

  @Post(':id/schedules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '提交排班' })
  submitSchedules(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const isNewFormat = body && typeof body === 'object' && 'schedules' in body && Array.isArray(body.schedules);
    const schedules = isNewFormat
      ? body.schedules.map((s: any) => ({ date: s.date, period: s.period }))
      : (Array.isArray(body) ? body : []).map((s: any) => ({ date: s.date, period: s.period }));
    const opts = isNewFormat && body.startDate && body.endDate
      ? { startDate: body.startDate, endDate: body.endDate }
      : undefined;
    return this.attendantService.submitSchedules(id, schedules, opts);
  }

  @Get(':id/schedules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '获取陪诊员排班' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSchedules(
    @Param('id', ParseIntPipe) id: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendantService.getSchedules(id, startDate, endDate);
  }
}
