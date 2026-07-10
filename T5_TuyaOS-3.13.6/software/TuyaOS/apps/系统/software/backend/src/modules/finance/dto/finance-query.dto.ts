import { IsOptional, IsString, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { FinanceRecordStatus } from '../../../common/enums/index.js';

export class FinanceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键词（描述）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '审核状态', enum: FinanceRecordStatus })
  @IsOptional()
  @IsEnum(FinanceRecordStatus)
  status?: FinanceRecordStatus;

  @ApiPropertyOptional({ description: '订单ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;
}
