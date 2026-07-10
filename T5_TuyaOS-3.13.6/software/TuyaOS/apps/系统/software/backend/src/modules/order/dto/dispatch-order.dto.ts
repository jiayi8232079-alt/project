import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DispatchOrderDto {
  @ApiPropertyOptional({
    description: '陪诊员ID（指派时必填，放入抢单池时不填）',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  attendantId?: number;

  @ApiPropertyOptional({ description: '是否放入抢单池', default: false })
  @IsOptional()
  @IsBoolean()
  toGrabPool?: boolean;

  @ApiProperty({ description: '陪诊员此单收入（元）', example: 488 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  attendantFee: number;

  @ApiPropertyOptional({
    description: '费用类型标签，如：本地陪诊·青田、跨城·杭州等',
  })
  @IsOptional()
  attendantFeeType?: string;
}
