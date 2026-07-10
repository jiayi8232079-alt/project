import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AlertSeverity } from '../../../entities/health-alert.entity.js';

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownMinutes?: number;

  @IsOptional()
  @IsBoolean()
  notifyFamily?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyAdmin?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
