import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CaptchaService } from './captcha.service.js';
import { WechatLoginDto } from './dto/wechat-login.dto.js';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { AttendantLoginDto } from './dto/attendant-login.dto.js';
import { SendSmsCodeDto } from './dto/send-sms-code.dto.js';
import { PhoneLoginDto } from './dto/phone-login.dto.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Post('wechat-login')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: '微信小程序登录' })
  wechatLogin(@Body() dto: WechatLoginDto) {
    return this.authService.wechatLogin(dto);
  }

  @Get('captcha')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: '获取图形验证码（登录防暴破）' })
  getCaptcha() {
    return this.captchaService.generate();
  }

  @Post('send-sms-code')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'App 手机号登录：下发短信验证码' })
  sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.authService.sendSmsCode(dto.phone);
  }

  @Post('phone-login')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'App 手机号验证码登录（不存在则自动注册）' })
  phoneLogin(@Body() dto: PhoneLoginDto) {
    return this.authService.phoneLogin(dto);
  }

  @Post('apple-login')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'App 通过 Apple 登录' })
  appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto);
  }

  @Post('admin-login')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: '管理后台登录' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('attendant-login')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: '陪诊员 Web 端登录' })
  attendantLogin(@Body() dto: AttendantLoginDto) {
    return this.authService.attendantLogin(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  getProfile(@CurrentUser() user: { id: number; type: string; role?: string }) {
    return this.authService.getProfile(user.id, user.type, user.role);
  }

  @Post('bind-wx-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: '绑定微信手机号并自动认领老人占位记录',
  })
  bindWxPhone(
    @CurrentUser('id') userId: number,
    @Body() dto: { phoneCode: string },
  ) {
    return this.authService.bindWxPhone(userId, dto.phoneCode);
  }
}
