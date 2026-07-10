import { Controller, Delete, Get, Param, ParseIntPipe, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AppDeviceTokenService } from './app-device-token.service.js';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto.js';

@ApiTags('App 推送 Token')
@Controller('app/device-token')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class AppDeviceTokenController {
  constructor(private readonly tokenService: AppDeviceTokenService) {}

  @Post()
  @ApiOperation({ summary: '注册或刷新当前 App 推送 token' })
  register(
    @CurrentUser('id') userId: number,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.tokenService.register(userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: '查询当前账号已绑定的推送设备' })
  listMine(@CurrentUser('id') userId: number) {
    return this.tokenService.listMine(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '解绑当前账号的推送 token' })
  async unregister(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tokenService.unregister(userId, id);
    return { message: '已解绑' };
  }
}
