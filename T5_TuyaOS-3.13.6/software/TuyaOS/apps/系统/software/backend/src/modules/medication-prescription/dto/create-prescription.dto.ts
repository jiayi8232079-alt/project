import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderSeverity } from '../../../entities/medication-reminder.entity.js';
import type { MedicationEscalationOverride } from '../../../entities/medication-reminder.entity.js';

export class PrescriptionItemDto {
  @ApiProperty({ description: '药品名称', example: '波立维（氯吡格雷）' })
  @IsString()
  medicineName: string;

  @ApiPropertyOptional({ description: '规格（展示用，如 75mg × 7片/盒）' })
  @IsOptional()
  @IsString()
  specification?: string;

  @ApiPropertyOptional({ description: '严重度，不填默认 MEDIUM', enum: ReminderSeverity })
  @IsOptional()
  @IsEnum(ReminderSeverity)
  severity?: ReminderSeverity;

  @ApiProperty({ description: '每次用量数值，如 1 / 0.5 / 2' })
  @IsNumber()
  @Min(0)
  dosePerTime: number;

  @ApiProperty({ description: '每日频次', example: 3 })
  @IsNumber()
  @Min(0)
  timesPerDay: number;

  @ApiProperty({ description: '总药量（与 unit 搭配）', example: 28 })
  @IsNumber()
  @Min(0)
  totalQuantity: number;

  @ApiProperty({ description: '单位', example: '片' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ description: '用法文案，覆盖 dosage（如"餐后口服"）' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: '用药说明 / 注意事项' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: '自定义提醒时间（HH:mm 数组），不填按 timesPerDay 生成默认时段',
    example: ['08:00', '20:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reminderTimes?: string[];

  @ApiPropertyOptional({ description: '升级策略覆盖（可选）' })
  @IsOptional()
  missEscalationOverride?: MedicationEscalationOverride;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: '处方归属用户 ID' })
  @IsNumber()
  userId: number;

  @ApiPropertyOptional({ description: '服务对象（老人）ID' })
  @IsOptional()
  @IsNumber()
  serviceTargetId?: number;

  @ApiPropertyOptional({ description: '关联陪诊订单 ID' })
  @IsOptional()
  @IsNumber()
  orderId?: number;

  @ApiPropertyOptional({ description: '处方原件照片 URL' })
  @IsOptional()
  @IsString()
  sourceImage?: string;

  @ApiPropertyOptional({ description: '开方医院' })
  @IsOptional()
  @IsString()
  hospital?: string;

  @ApiPropertyOptional({ description: '开方医生' })
  @IsOptional()
  @IsString()
  doctorName?: string;

  @ApiPropertyOptional({ description: '开方科室' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: '开方日期 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({ description: '处方备注' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: '统一的服药起始日期（YYYY-MM-DD）。每种药 endDate 将自动推算。',
    example: '2026-04-21',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '处方中的药品清单，至少 1 条', type: [PrescriptionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];

  @ApiPropertyOptional({ description: '是否允许覆盖同用户已存在的同药提醒（默认 false 仅新增）' })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
