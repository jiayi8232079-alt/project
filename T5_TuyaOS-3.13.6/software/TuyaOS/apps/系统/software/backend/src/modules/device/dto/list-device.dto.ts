import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { DeviceLifecycleStatus, DeviceType } from '../../../entities/device.entity.js';

export class ListDeviceDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键字（匹配 name / tuyaDeviceId / mac）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  keyword?: string;

  @ApiPropertyOptional({ enum: DeviceType })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;

  @ApiPropertyOptional({ enum: DeviceLifecycleStatus })
  @IsOptional()
  @IsEnum(DeviceLifecycleStatus)
  status?: DeviceLifecycleStatus;

  @ApiPropertyOptional({ description: '是否在线 true/false（按 device.online 缓存过滤）' })
  @IsOptional()
  @IsBooleanString()
  online?: string;
}
