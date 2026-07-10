import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMembershipLevelDto {
  @ApiProperty({ example: '银卡会员' })
  @IsString()
  levelName: string;

  @ApiPropertyOptional({ example: 95, description: '折扣率 95=95折' })
  @IsOptional()
  @IsNumber()
  discountRate?: number;

  @ApiPropertyOptional({ example: 1000, description: '升级最低充值' })
  @IsOptional()
  @IsNumber()
  minRecharge?: number;

  @ApiPropertyOptional({ description: '权益说明' })
  @IsOptional()
  @IsString()
  benefits?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
