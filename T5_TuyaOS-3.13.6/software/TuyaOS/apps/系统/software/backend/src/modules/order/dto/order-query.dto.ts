import { IsOptional, IsString, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import {
  OrderStatus,
  PaymentStatus,
  SettlementStatus,
} from '../../../common/enums/index.js';

export class OrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键词（订单号/客户姓名）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '订单状态（可传单个状态或逗号分隔）' })
  @IsOptional()
  @IsString()
  status?: OrderStatus | string;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '陪诊员ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  attendantId?: number;

  @ApiPropertyOptional({ description: '客户ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: '服务对象 ID（按健康档案筛选）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceTargetId?: number;

  @ApiPropertyOptional({ description: '结算状态' })
  @IsOptional()
  @IsString()
  settlementStatus?: SettlementStatus | string;

  @ApiPropertyOptional({ description: '付款状态' })
  @IsOptional()
  @IsString()
  paymentStatus?: PaymentStatus | string;
}
