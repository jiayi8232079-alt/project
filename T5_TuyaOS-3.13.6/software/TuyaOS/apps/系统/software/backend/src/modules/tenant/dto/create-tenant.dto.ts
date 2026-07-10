import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { TenantScopeType, TenantType } from '../../../entities/tenant.entity.js';

export class CreateTenantDto {
  @ApiProperty({
    description: '租户唯一编码（用于二级域名/白标），仅允许小写字母、数字、短横线',
    example: 'sunshine-community',
  })
  @IsString()
  @IsNotEmpty({ message: 'code 不能为空' })
  @Length(2, 64)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code 仅允许小写字母、数字、短横线',
  })
  code: string;

  @ApiProperty({ description: '租户显示名称', example: '阳光社区' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @ApiProperty({ enum: TenantType, default: TenantType.COMMUNITY })
  @IsEnum(TenantType)
  type: TenantType;

  @ApiPropertyOptional({ description: '数据中心标识，默认 cn-east-1' })
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

  @ApiPropertyOptional({ description: '白标/配额/功能扩展配置' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '父租户 ID，默认挂到平台租户下' })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number;

  @ApiPropertyOptional({
    enum: TenantScopeType,
    description: '树层级类型，默认由 type 推导',
  })
  @IsOptional()
  @IsEnum(TenantScopeType)
  scopeType?: TenantScopeType;

  @ApiPropertyOptional({ description: '行政区划码（政府租户）' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  regionCode?: string;

  @ApiPropertyOptional({
    description: '可选：创建后立即指定一个 user 作为租户 owner',
  })
  @IsOptional()
  ownerUserId?: number;
}
