import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsInt, Min, Max } from 'class-validator';

export class CreateTriageFeedbackDto {
  @ApiPropertyOptional({ description: '人工是否接受推荐' })
  @IsOptional()
  @IsBoolean()
  humanAccepted?: boolean;

  @ApiPropertyOptional({ description: '实际下单服务类型' })
  @IsOptional()
  @IsString()
  actualOrderType?: string;

  @ApiPropertyOptional({ description: '用户满意度 1-5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  satisfaction?: number;

  @ApiPropertyOptional({ description: '后续是否复购' })
  @IsOptional()
  @IsBoolean()
  followUpPurchased?: boolean;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
