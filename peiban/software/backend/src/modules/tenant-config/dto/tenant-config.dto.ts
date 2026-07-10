import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { TenantScopeType } from '../../../entities/tenant.entity.js';
import { AlertSeverity } from '../../../entities/health-alert.entity.js';

/** 写入一条层级配置 */
export class SetTenantSettingDto {
  @ApiProperty({ description: '配置键，如 ai.prompt / device.volume_max' })
  @IsString()
  @Length(1, 64)
  configKey: string;

  @ApiProperty({ description: '配置值（标量或 JSON 字符串）' })
  @IsString()
  configValue: string;

  @ApiPropertyOptional({
    enum: TenantScopeType,
    description: '写入方层级（默认取租户自身）',
  })
  @IsOptional()
  @IsEnum(TenantScopeType)
  scopeType?: TenantScopeType;

  @ApiPropertyOptional({ description: '设备级覆盖时指向具体设备 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetDeviceId?: number;

  @ApiPropertyOptional({
    description: '平台超管操作时指定目标租户 ID（普通用户忽略）',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantId?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  remark?: string;
}

/** 平台超管操作时用于指定目标租户的通用查询 */
export class TenantScopedQueryDto {
  @ApiPropertyOptional({ description: '平台超管指定目标租户 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantId?: number;
}

export class CreateDispatchRuleDto {
  @ApiProperty({
    description: '事件类型：fall / sos / vital_anomaly / medication_miss 等',
  })
  @IsString()
  @Length(1, 32)
  eventType: string;

  @ApiPropertyOptional({ enum: AlertSeverity, description: '最低触发严重度' })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiProperty({
    description: "透传层级，如 ['site','organization','government','platform']",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  forwardToLevels: string[];

  @ApiProperty({
    description: "通知通道，如 ['app_push','sms','phone','wechat']",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  notifyChannels: string[];

  @ApiPropertyOptional({
    description: '升级策略 { initialTarget, escalateAfterSec, escalateTo }',
  })
  @IsOptional()
  @IsObject()
  escalation?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '平台超管指定目标租户 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 128)
  remark?: string;
}

export class UpdateDispatchRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 32)
  eventType?: string;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forwardToLevels?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyChannels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  escalation?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 128)
  remark?: string;
}

export class IncomingAlertQueryDto {
  @ApiPropertyOptional({
    enum: AlertSeverity,
    description: '最低严重度，默认 high',
  })
  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity;

  @ApiPropertyOptional({ description: '返回条数，默认 50' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: '平台超管指定目标租户子树' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenantId?: number;
}
