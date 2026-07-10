import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantStatus } from '../../../entities/tenant.entity.js';

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: '租户显示名称' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({ description: '数据中心标识' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  dataCenter?: string;

  @ApiPropertyOptional({ description: '主联系人姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactName?: string;

  @ApiPropertyOptional({ description: '主联系人电话' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @ApiPropertyOptional({ description: '白标/配额/功能扩展配置（整体覆盖）' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: TenantStatus,
    description: '生命周期状态变更',
  })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
