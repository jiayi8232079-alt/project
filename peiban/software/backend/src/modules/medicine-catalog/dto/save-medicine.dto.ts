import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderSeverity } from '../../../entities/medication-reminder.entity.js';

export class SaveMedicineDto {
  @ApiProperty({ description: '主名' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '通用名/学名' })
  @IsOptional()
  @IsString()
  genericName?: string;

  @ApiPropertyOptional({ description: '常见规格' })
  @IsOptional()
  @IsString()
  specification?: string;

  @ApiPropertyOptional({ description: '默认严重度', enum: ReminderSeverity })
  @IsOptional()
  @IsEnum(ReminderSeverity)
  severity?: ReminderSeverity;

  @ApiPropertyOptional({ description: '分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '默认每日频次' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(8)
  defaultTimesPerDay?: number;

  @ApiPropertyOptional({ description: '默认每次用量' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDosePerTime?: number;

  @ApiPropertyOptional({ description: '默认单位' })
  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @ApiPropertyOptional({ description: '默认用药说明' })
  @IsOptional()
  @IsString()
  defaultInstructions?: string;

  @ApiPropertyOptional({ description: '风险关键词数组' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warningKeywords?: string[];

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  enabled?: number;
}
