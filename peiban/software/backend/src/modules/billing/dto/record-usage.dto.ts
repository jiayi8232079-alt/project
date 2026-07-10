import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UsageMetric } from '../../../entities/usage-record.entity.js';

export class RecordUsageDto {
  @ApiProperty({ enum: UsageMetric })
  @IsEnum(UsageMetric)
  metric: UsageMetric;

  @ApiProperty({ description: '用量数值' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: '关联订阅 id（用于扣减套餐余额）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subscriptionId?: number;

  @ApiPropertyOptional({ description: '触发用量的设备 id' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deviceId?: number;

  @ApiPropertyOptional({ description: '关联 ai_dialog_sessions.id' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionId?: number;

  @ApiPropertyOptional({ description: '发生时间（ISO；不传取当前）' })
  @IsOptional()
  @IsString()
  occurredAt?: string;
}
