import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { InvoiceType } from '../../../entities/invoice.entity.js';

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceType })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiProperty({ description: '抬头名称' })
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiProperty({ description: '票面金额（元）' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: '纳税人识别号（企业票必填）' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  taxNumber?: string;

  @ApiPropertyOptional({ description: '收件邮箱' })
  @IsOptional()
  @IsString()
  @Length(0, 128)
  emailTo?: string;

  @ApiPropertyOptional({ description: '明细数组' })
  @IsOptional()
  @IsArray()
  items?: unknown[];
}
