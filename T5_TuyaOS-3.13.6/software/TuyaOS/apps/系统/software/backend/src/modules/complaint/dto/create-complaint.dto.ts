import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { ComplaintCategory } from '../../../entities/complaint.entity.js';

export class CreateComplaintDto {
  @ApiProperty({ enum: ComplaintCategory })
  @IsEnum(ComplaintCategory)
  category: ComplaintCategory;

  @ApiProperty({ description: '标题', maxLength: 128 })
  @IsString()
  @Length(2, 128)
  subject: string;

  @ApiProperty({ description: '详细描述' })
  @IsString()
  @Length(5, 2000)
  description: string;

  @ApiPropertyOptional({ description: '相关订单 ID' })
  @IsOptional()
  @IsInt()
  orderId?: number;

  @ApiPropertyOptional({ description: '相关陪诊员 ID' })
  @IsOptional()
  @IsInt()
  attendantId?: number;

  @ApiPropertyOptional({
    description: '联系方式（默认使用账号手机）',
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({
    description: '附件图片 URL 数组，最多 9 张',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ValidateIf((_, v) => Array.isArray(v))
  images?: string[];
}
