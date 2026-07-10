import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { DeviceService } from './device.service.js';
import { BindDeviceDto } from './dto/bind-device.dto.js';
import { SendDpDto } from './dto/send-dp.dto.js';
import { ListDeviceDto } from './dto/list-device.dto.js';
import { MockEventDto } from './dto/mock-event.dto.js';

@ApiTags('设备管理')
@Controller('devices')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  // ─────────────── 用户视角 ───────────────

  @Get('me/list')
  @ApiOperation({ summary: '我的设备列表（按绑定关系过滤）' })
  myList(@CurrentUser('id') userId: number) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.deviceService.listMyDevices(userId);
  }

  @Post('bind')
  @ApiOperation({ summary: 'App 配网成功后绑定设备到当前账号' })
  bind(@CurrentUser('id') userId: number, @Body() dto: BindDeviceDto) {
    if (!userId) throw new ForbiddenException('需要登录');
    return this.deviceService.bind(userId, dto);
  }

  @Delete('bindings/:bindingId')
  @ApiOperation({ summary: '解绑设备（仅 owner 可执行）' })
  unbind(
    @CurrentUser('id') userId: number,
    @Param('bindingId', ParseIntPipe) bindingId: number,
  ) {
    return this.deviceService.unbind(userId, bindingId).then(() => ({ message: '已解绑' }));
  }

  // ─────────────── 管理后台（静态路由须在 :id 之前）───────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '设备总列表（admin / operator）' })
  list(@Query() query: ListDeviceDto) {
    return this.deviceService.list(query);
  }

  @Get('stats/dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '设备运维大盘统计' })
  dashboardStats() {
    return this.deviceService.getDashboardStats();
  }

  @Get('events/safety')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '安全事件流（跌倒/SOS/体征异常）' })
  safetyEvents(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: string,
    @Query('deviceId') deviceId?: number,
  ) {
    return this.deviceService.listSafetyEvents({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      type: type as any,
      deviceId: deviceId ? Number(deviceId) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '设备详情（含最新 DP snapshot）' })
  detail(
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // admin 跨租户视角下传 undefined 跳过用户校验；普通用户必须是绑定者
    return this.deviceService.findById(id, type === 'admin' ? undefined : userId);
  }

  @Get(':id/events')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '设备事件流水' })
  listEvents(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: string,
    @Query('level') level?: string,
  ) {
    return this.deviceService.listEvents(id, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      type: type as any,
      level: level as any,
    });
  }

  @Post(':id/dp')
  @ApiOperation({ summary: 'App 下发 DP（mock 阶段不实际下发）' })
  sendDp(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendDpDto,
  ) {
    return this.deviceService.sendDp(id, userId, dto);
  }

  @Post(':id/self-control')
  @ApiOperation({ summary: 'App 下发自控指令（如表情/动作；mock 阶段不实际下发）' })
  sendSelfControl(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendDpDto,
  ) {
    return this.deviceService.sendSelfControl(id, userId, dto);
  }

  @Post(':id/ota/check')
  @ApiOperation({ summary: '检查 OTA（mock 永远返回无更新）' })
  checkOta(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.deviceService.checkOta(id, userId);
  }

  @Post(':id/ota/upgrade')
  @ApiOperation({ summary: '触发 OTA 升级（mock 阶段不实际升级）' })
  triggerOta(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.deviceService.triggerOtaUpgrade(id, userId);
  }

  // ─────────────── 管理后台 / 测试辅助 ───────────────

  @Post(':id/mock-event')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'mock 触发设备上行事件（admin/operator）—— 用于本地联调；接涂鸦后此端点保留为测试入口',
  })
  mockEvent(@Param('id', ParseIntPipe) id: number, @Body() dto: MockEventDto) {
    return this.deviceService.recordEvent(id, dto);
  }

  @Post(':id/mock-online')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'mock 上下线切换' })
  mockOnline(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { online: boolean },
  ) {
    return this.deviceService
      .recordOnlineChange(id, !!body.online, 'admin_mock')
      .then(() => ({ online: !!body.online }));
  }
}
