import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 订单评价 DTO。
 * - rating 强制 1-5 整数，禁止前端发超限值污染陪诊员均分
 * - content 为正文，comment 为旧字段兼容（落库统一走 comment 列）
 * - tags 限量 6 条，单条 ≤ 32 字，防止被拉成无限大数组
 */
export class CreateReviewDto {
  @ApiProperty({ description: '评分（1-5 整数）', minimum: 1, maximum: 5 })
  @IsInt({ message: '评分必须是整数' })
  @Min(1, { message: '评分不得低于 1 分' })
  @Max(5, { message: '评分不得高于 5 分' })
  rating: number;

  @ApiPropertyOptional({ description: '评价正文（新）' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '评价内容不得超过 500 字' })
  content?: string;

  @ApiPropertyOptional({ description: '评价正文（旧字段，兼容）' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '评价内容不得超过 500 字' })
  comment?: string;

  @ApiPropertyOptional({ description: '评价标签', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: '标签必须是字符串' })
  @MaxLength(32, { each: true, message: '单个标签不得超过 32 字' })
  tags?: string[];
}
