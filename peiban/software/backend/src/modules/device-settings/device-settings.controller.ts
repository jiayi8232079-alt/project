import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { DeviceSettingsService } from './device-settings.service.js';
import {
  MockDeviceSettingsAckDto,
  UpdateDeviceSettingsDto,
} from './dto/update-device-settings.dto.js';

@ApiTags('设备设置')
@Controller('device-settings')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class DeviceSettingsController {
  constructor(private readonly settingsService: DeviceSettingsService) {}

  @Get(':deviceId')
  @ApiOperation({ summary: '获取设备当前设置和最近下发记录' })
  getSettings(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('type') userType: string,
  ) {
    return this.settingsService.getSettings(deviceId, userId, userType);
  }

  @Put(':deviceId')
  @ApiOperation({ summary: '保存设备设置并生成下发任务' })
  saveSettings(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('type') userType: string,
    @Body() dto: UpdateDeviceSettingsDto,
  ) {
    return this.settingsService.saveSettings(deviceId, userId, userType, dto);
  }

  @Get(':deviceId/logs')
  @ApiOperation({ summary: '查看设备设置下发历史' })
  listLogs(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settingsService.listLogs(
      deviceId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post(':deviceId/logs/:logId/mock-ack')
  @ApiOperation({ summary: 'mock 设备设置下发回执' })
  mockAck(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Param('logId', ParseIntPipe) logId: number,
    @Body() dto: MockDeviceSettingsAckDto,
  ) {
    return this.settingsService.mockAck(deviceId, logId, dto);
  }
}
