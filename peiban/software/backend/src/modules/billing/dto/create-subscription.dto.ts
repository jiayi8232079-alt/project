import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'subscription_plans.id' })
  @IsInt()
  @Min(1)
  planId: number;

  @ApiPropertyOptional({ description: '关联设备 ID（设备订阅必填）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deviceId?: number;

  @ApiPropertyOptional({ description: '是否开启自动续费，默认 true' })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
