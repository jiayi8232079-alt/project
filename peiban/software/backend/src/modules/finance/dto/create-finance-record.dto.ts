import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceRecordType } from '../../../common/enums/index.js';

export class CreateFinanceRecordDto {
  @ApiPropertyOptional({ description: '订单ID（可选，通用报销可不填）' })
  @IsOptional()
  @IsInt()
  orderId?: number;

  @ApiProperty({ description: '费用类型', enum: FinanceRecordType })
  @IsNotEmpty()
  @IsEnum(FinanceRecordType)
  type: FinanceRecordType;

  @ApiProperty({ description: '金额（必须大于 0）' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '凭证URL（单张）' })
  @IsOptional()
  @IsString()
  proofUrl?: string;

  @ApiPropertyOptional({ description: '凭证URL列表（多张）' })
  @IsOptional()
  @IsArray()
  images?: string[];
}
