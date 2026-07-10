import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  RevenueShareRuleType,
  RevenueShareScope,
} from '../../../entities/revenue-share-rule.entity.js';

export class CreateRevenueShareRuleDto {
  @IsInt()
  @Min(1)
  tenantId: number;

  @IsInt()
  @Min(1)
  partnerTenantId: number;

  @IsEnum(RevenueShareRuleType)
  type: RevenueShareRuleType;

  @IsEnum(RevenueShareScope)
  scope: RevenueShareScope;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRevenueShareRuleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  partnerTenantId?: number;

  @IsOptional()
  @IsEnum(RevenueShareRuleType)
  type?: RevenueShareRuleType;

  @IsOptional()
  @IsEnum(RevenueShareScope)
  scope?: RevenueShareScope;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
