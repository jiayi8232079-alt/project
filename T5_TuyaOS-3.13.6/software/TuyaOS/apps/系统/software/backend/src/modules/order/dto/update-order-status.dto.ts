import { IsNotEmpty, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../../common/enums/index.js';

export class UpdateOrderStatusDto {
  @ApiProperty({ description: '目标状态', enum: OrderStatus })
  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ description: '取消原因' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;

  @ApiPropertyOptional({ description: '状态变更备注，会写入订单时间线' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
