import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { MedicationExecutionStatus } from '../../../entities/medication-execution-log.entity.js';

export class CheckInMedicationDto {
  @ApiProperty({ description: '提醒 ID' })
  @IsInt()
  @Min(1)
  reminderId: number;

  @ApiProperty({ description: '计划日期 YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  scheduledDate: string;

  @ApiProperty({ description: '计划时间 HH:MM' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  scheduledTime: string;

  @ApiProperty({
    description: '执行状态',
    enum: MedicationExecutionStatus,
    required: false,
    default: MedicationExecutionStatus.TAKEN,
  })
  @IsOptional()
  @IsEnum(MedicationExecutionStatus)
  status?: MedicationExecutionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class QueryMedicationExecutionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  reminderId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  serviceTargetId?: number;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
