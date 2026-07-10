import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WechatLoginDto {
  @ApiProperty({ description: '微信登录code' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: '用户授权昵称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  @ApiProperty({ description: '用户授权头像URL', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ description: '本地开发稳定用户标识', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  devUserKey?: string;

  @ApiProperty({ description: '登录身份模式：user=用户端，attendant=陪诊员工作台', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['user', 'attendant'])
  loginAs?: 'user' | 'attendant';

  @ApiProperty({ description: 'getPhoneNumber 返回的 code，用于登录时同步绑定手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  phoneCode?: string;
}
