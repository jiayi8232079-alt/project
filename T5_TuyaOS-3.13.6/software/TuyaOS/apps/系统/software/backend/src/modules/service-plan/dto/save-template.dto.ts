import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServicePlanKind } from '../../../entities/service-plan-template.entity.js';

export class SaveTemplateDto {
  @ApiProperty({ description: '模板类型', enum: ServicePlanKind })
  @IsEnum(ServicePlanKind)
  kind: ServicePlanKind;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '适用人群/病情' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetConditions?: string[];

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ description: '结构化内容（任意 JSON 结构，因 kind 而异）' })
  content: unknown;

  @ApiPropertyOptional({ description: '标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '是否公共（仅管理员可设为 true）' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AttachPlanToOrderDto {
  @ApiProperty({ description: '方案类型', enum: ServicePlanKind })
  @IsEnum(ServicePlanKind)
  kind: ServicePlanKind;

  @ApiPropertyOptional({ description: '来源模板 ID（可选）' })
  @IsOptional()
  templateId?: number;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ description: '内容（任意 JSON 结构）' })
  content: unknown;
}
