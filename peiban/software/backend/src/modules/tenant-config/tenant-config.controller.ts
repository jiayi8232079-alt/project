import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { TenantSettingsService } from './tenant-settings.service.js';
import { DeviceConfigService } from './device-config.service.js';
import {
  SetTenantSettingDto,
  TenantScopedQueryDto,
} from './dto/tenant-config.dto.js';

/**
 * 分层配置下发 API（PRD §8.4）。
 *
 * 路由独立用 `tenant-settings` 前缀（设备级生效配置放 `tenant-settings/devices/:id/effective`），
 * 避免与 device 模块的 `/devices` 前缀冲突。
 */
@ApiTags('分层配置下发')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
@Controller('tenant-settings')
export class TenantConfigController {
  constructor(
    private readonly settingsService: TenantSettingsService,
    private readonly deviceConfigService: DeviceConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: '当前/指定租户的直接配置列表' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: TenantScopedQueryDto,
  ) {
    return this.settingsService.list(this.requireTenantId(user, q.tenantId));
  }

  @Get('effective-all')
  @ApiOperation({ summary: '某租户全部 key 的生效值（沿 path 链合并）' })
  effectiveAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: TenantScopedQueryDto,
  ) {
    return this.settingsService.getEffectiveAll(
      this.requireTenantId(user, q.tenantId),
    );
  }

  @Get('devices/:id/effective')
  @ApiOperation({ summary: '单设备生效配置（设备级覆盖 > 租户链）' })
  deviceEffective(@Param('id', ParseIntPipe) id: number) {
    return this.settingsService.getDeviceEffective(id);
  }

  @Get('device-logs/:deviceId')
  @ApiOperation({ summary: '某设备的配置下发历史' })
  deviceLogs(@Param('deviceId', ParseIntPipe) deviceId: number) {
    return this.deviceConfigService.listByDevice(deviceId);
  }

  @Post('device-logs/:logId/ack')
  @ApiOperation({ summary: '设备回执：配置已执行' })
  ack(@Param('logId', ParseIntPipe) logId: number) {
    return this.deviceConfigService.ack(logId);
  }

  @Get(':key/effective')
  @ApiOperation({ summary: '某 key 的生效值（沿 path 链就近优先）' })
  effective(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Query() q: TenantScopedQueryDto,
  ) {
    return this.settingsService.getEffective(
      this.requireTenantId(user, q.tenantId),
      key,
    );
  }

  @Post()
  @ApiOperation({ summary: '新增/覆盖配置' })
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetTenantSettingDto,
  ) {
    return this.settingsService.set({
      tenantId: this.requireTenantId(user, dto.tenantId),
      configKey: dto.configKey,
      configValue: dto.configValue,
      scopeType: dto.scopeType,
      targetDeviceId: dto.targetDeviceId ?? null,
      createdBy: user?.id ?? null,
      remark: dto.remark ?? null,
    });
  }

  @Post(':key/push-to-devices')
  @ApiOperation({ summary: '把该 key 下发到本租户子树下所有设备' })
  push(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Query() q: TenantScopedQueryDto,
  ) {
    return this.deviceConfigService.pushToDevices(
      this.requireTenantId(user, q.tenantId),
      key,
    );
  }

  @Delete(':key')
  @ApiOperation({ summary: '删除配置（回退到上级生效值）' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Query() q: TenantScopedQueryDto & { targetDeviceId?: string },
  ) {
    const targetDeviceId = q.targetDeviceId ? Number(q.targetDeviceId) : null;
    await this.settingsService.remove(
      this.requireTenantId(user, q.tenantId),
      key,
      targetDeviceId,
    );
    return { message: '已删除' };
  }

  /** 平台超管(tenantId=null)须显式指定目标租户；租户用户用自身 tenantId */
  private requireTenantId(user: AuthenticatedUser, explicit?: number): number {
    const tid = explicit ?? user?.tenantId ?? null;
    if (tid == null) {
      throw new BadRequestException('平台超管需通过 tenantId 指定目标租户');
    }
    return tid;
  }
}
