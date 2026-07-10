import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreateTriageDto {
  @ApiProperty({ description: '咨询人身份', example: 'child' })
  @IsString()
  @IsIn(['self', 'child', 'relative', 'caregiver'])
  consultantRole: string;

  @ApiProperty({ description: '患者年龄', example: 72 })
  @IsInt()
  @Min(0)
  @Max(150)
  patientAge: number;

  @ApiProperty({ description: '患者性别', example: 'female' })
  @IsString()
  @IsIn(['male', 'female', 'other'])
  patientGender: string;

  @ApiProperty({ description: '主要症状或问题', example: '胸闷气短，持续3天' })
  @IsString()
  mainSymptom: string;

  @ApiPropertyOptional({ description: '症状持续时间', example: '3天' })
  @IsOptional()
  @IsString()
  symptomDuration?: string;

  @ApiPropertyOptional({ description: '自评严重程度', example: 'moderate' })
  @IsOptional()
  @IsIn(['mild', 'moderate', 'severe'])
  severitySelf?: string;

  @ApiPropertyOptional({ description: '既往病史标签', example: ['hypertension', 'diabetes'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medicalHistory?: string[];

  @ApiPropertyOptional({ description: '当前用药' })
  @IsOptional()
  @IsString()
  currentMedication?: string;

  @ApiPropertyOptional({ description: '是否已有体检/检查结果' })
  @IsOptional()
  @IsBoolean()
  hasExamResult?: boolean;

  @ApiPropertyOptional({ description: '患者所在城市', example: '青田' })
  @IsOptional()
  @IsString()
  patientCity?: string;

  @ApiPropertyOptional({ description: '家属是否异地/海外' })
  @IsOptional()
  @IsBoolean()
  familyRemote?: boolean;

  @ApiPropertyOptional({ description: '行动能力', example: 'normal' })
  @IsOptional()
  @IsIn(['normal', 'limited', 'bedridden'])
  mobility?: string;

  @ApiPropertyOptional({ description: '是否独居' })
  @IsOptional()
  @IsBoolean()
  livesAlone?: boolean;

  @ApiPropertyOptional({ description: '就医目标', example: 'outpatient' })
  @IsOptional()
  @IsIn(['outpatient', 'checkup', 'expert', 'inpatient', 'care', 'unsure'])
  visitGoal?: string;

  @ApiPropertyOptional({ description: '过敏史' })
  @IsOptional()
  @IsString()
  allergyInfo?: string;

  @ApiPropertyOptional({ description: '是否近期出院' })
  @IsOptional()
  @IsBoolean()
  recentlyDischarged?: boolean;

  @ApiPropertyOptional({ description: '关联服务对象 ID' })
  @IsOptional()
  @IsInt()
  serviceTargetId?: number;
}
