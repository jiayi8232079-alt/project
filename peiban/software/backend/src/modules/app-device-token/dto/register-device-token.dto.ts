import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PushPlatform, PushVendor } from '../../../entities/app-device-token.entity.js';

export class RegisterDeviceTokenDto {
  @ApiProperty({ enum: PushPlatform, example: PushPlatform.IOS })
  @IsEnum(PushPlatform)
  platform: PushPlatform;

  @ApiProperty({ enum: PushVendor, example: PushVendor.APNS })
  @IsEnum(PushVendor)
  vendor: PushVendor;

  @ApiProperty({ example: 'apns-or-fcm-token' })
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  token: string;

  @ApiProperty({ example: 'ios-device-uuid' })
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  deviceId: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}
