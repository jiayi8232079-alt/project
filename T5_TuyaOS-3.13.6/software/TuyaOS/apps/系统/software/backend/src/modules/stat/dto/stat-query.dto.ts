import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { TenantDataScope } from '../../../common/utils/tenant-query.helper.js';

const SCOPE_VALUES = ['self', 'descendants', 'tenant'] as const;

const coerceStr = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

/** 把 `?metrics=a,b` 或单个 `?metrics=a` 统一成 string[] */
const toStringArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => coerceStr(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number') {
    return [String(value)];
  }
  return undefined;
};

/** 大盘通用查询：作用域 + 日期范围 */
export class DashboardQueryDto {
  @ApiPropertyOptional({
    enum: SCOPE_VALUES,
    description:
      'self=仅本租户 / descendants=含所有下属 / tenant=指定下属（须传 tenantId）',
    default: 'self',
  })
  @IsOptional()
  @IsEnum(SCOPE_VALUES)
  scope?: TenantDataScope;

  @ApiPropertyOptional({ description: 'scope=tenant 时指定的下属租户 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantId?: number;

  @ApiPropertyOptional({ description: '起始日期 YYYY-MM-DD（默认近 30 天）' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: '结束日期 YYYY-MM-DD（默认今天）' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** region-map / export 等把 metric 作为查询参数（而非路径参数）的接口用 */
export class MetricScopedQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({ description: '指标 key，不传取默认' })
  @IsOptional()
  @IsString()
  metric?: string;
}

export class RankQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({
    description: '返回条数，默认 20，上限 100',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class RealtimeQueryDto {
  @ApiPropertyOptional({ enum: SCOPE_VALUES, default: 'self' })
  @IsOptional()
  @IsEnum(SCOPE_VALUES)
  scope?: TenantDataScope;

  @ApiPropertyOptional({ description: 'scope=tenant 时指定的下属租户 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantId?: number;

  @ApiPropertyOptional({
    description: '指标列表（逗号分隔或重复参数），不传取默认实时指标',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}

export class OverviewQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({
    description: '自定义 KPI 指标列表，不传取默认核心指标',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}

export class AggregateRunDto {
  @ApiPropertyOptional({
    enum: ['daily', 'hourly', 'realtime'],
    description: '聚合粒度，默认 daily',
    default: 'daily',
  })
  @IsOptional()
  @IsEnum(['daily', 'hourly', 'realtime'])
  granularity?: 'daily' | 'hourly' | 'realtime';

  @ApiPropertyOptional({
    description: 'daily 时指定聚合日期 YYYY-MM-DD（默认今天）',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
