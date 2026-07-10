import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReminderFrequency,
  ReminderChannel,
  ReminderType,
  ReminderSeverity,
} from '../../../entities/medication-reminder.entity.js';
import type { MedicationEscalationOverride } from '../../../entities/medication-reminder.entity.js';

export class CreateReminderDto {
  @ApiProperty({ description: '用户ID' })
  @IsNumber()
  userId: number;

  @ApiPropertyOptional({ description: '服务对象ID' })
  @IsOptional()
  @IsNumber()
  serviceTargetId?: number;

  @ApiPropertyOptional({ description: '关联订单ID' })
  @IsOptional()
  @IsNumber()
  orderId?: number;

  @ApiPropertyOptional({ description: '所属处方批次 ID' })
  @IsOptional()
  @IsNumber()
  prescriptionId?: number;

  @ApiProperty({ description: '药品名称' })
  @IsString()
  medicineName: string;

  @ApiPropertyOptional({ description: '提醒类型', enum: ReminderType, default: ReminderType.MEDICATION })
  @IsOptional()
  @IsEnum(ReminderType)
  reminderType?: ReminderType;

  @ApiPropertyOptional({
    description: '药品严重度分级，决定漏服升级阈值',
    enum: ReminderSeverity,
    default: ReminderSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ReminderSeverity)
  severity?: ReminderSeverity;

  @ApiPropertyOptional({ description: '用量/剂量文案（展示用）' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: '每次用量数值（1/0.5/2 等）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dosePerTime?: number;

  @ApiPropertyOptional({ description: '每日频次' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timesPerDay?: number;

  @ApiPropertyOptional({ description: '总药量' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  @ApiPropertyOptional({ description: '单位，片/粒/瓶/支/ml 等' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: '复诊医院' })
  @IsOptional()
  @IsString()
  followUpHospital?: string;

  @ApiPropertyOptional({ description: '复诊科室' })
  @IsOptional()
  @IsString()
  followUpDepartment?: string;

  @ApiProperty({ description: '提醒频率', enum: ReminderFrequency })
  @IsEnum(ReminderFrequency)
  frequency: ReminderFrequency;

  @ApiPropertyOptional({
    description:
      '提醒时间点列表。省略且给了 timesPerDay 时，后端按默认餐后时段生成',
    example: ['08:00', '12:00', '18:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reminderTimes?: string[];

  @ApiProperty({ description: '开始日期' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description:
      '结束日期。省略且给了 totalQuantity+dosePerTime+timesPerDay 时，后端自动按"疗程天数"推算',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '用药说明/备注' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: '通知渠道', enum: ReminderChannel })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;

  @ApiPropertyOptional({ description: '升级策略覆盖（漏服追推/升级阈值）' })
  @IsOptional()
  missEscalationOverride?: MedicationEscalationOverride;
}
