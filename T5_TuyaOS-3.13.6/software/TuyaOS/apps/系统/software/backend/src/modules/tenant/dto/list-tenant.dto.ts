import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { TenantStatus, TenantType } from '../../../entities/tenant.entity.js';

export class ListTenantDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键字（匹配 name / code / contactPhone）' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional({ enum: TenantType })
  @IsOptional()
  @IsEnum(TenantType)
  type?: TenantType;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
