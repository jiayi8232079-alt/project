import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DeviceAutoEscalation,
  DevicePrivacyVisibility,
} from '../../../entities/device-setting.entity.js';

export class QuietHourRangeDto {
  @ApiProperty({ example: '21:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start: string;

  @ApiProperty({ example: '07:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end: string;
}

export class UpdateDeviceSettingsDto {
  @ApiPropertyOptional({ type: [QuietHourRangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuietHourRangeDto)
  quietHours?: QuietHourRangeDto[];

  @ApiProperty({ minimum: 0, maximum: 100, example: 70 })
  @IsInt()
  @Min(0)
  @Max(100)
  volume: number;

  @ApiProperty({ minimum: 0.5, maximum: 2, example: 1 })
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speechRate: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 80 })
  @IsInt()
  @Min(0)
  @Max(100)
  screenBrightness: number;

  @ApiProperty({ minimum: 1, maximum: 10, example: 3 })
  @IsInt()
  @Min(1)
  @Max(10)
  sosHoldSeconds: number;

  @ApiProperty({ enum: DeviceAutoEscalation })
  @IsEnum(DeviceAutoEscalation)
  autoEscalation: DeviceAutoEscalation;

  @ApiProperty({ example: true })
  @IsBoolean()
  communityContentEnabled: boolean;

  @ApiProperty({ enum: DevicePrivacyVisibility })
  @IsEnum(DevicePrivacyVisibility)
  privacyVisibility: DevicePrivacyVisibility;
}

export class MockDeviceSettingsAckDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiPropertyOptional({ example: 'device offline' })
  @IsOptional()
  @IsString()
  failureReason?: string;
}
