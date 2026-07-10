import { IsOptional, IsNumber, IsInt, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserMembershipDto {
  @ApiPropertyOptional({
    description: '会员等级ID（管理员直接设置，通常使用专用开通/取消接口）',
  })
  @IsOptional()
  @IsNumber()
  @IsInt()
  levelId?: number;

  @ApiPropertyOptional({ description: '有效期开始' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '有效期结束' })
  @IsOptional()
  @IsDateString()
  expireDate?: string;

  @ApiPropertyOptional({ description: '储值余额调整（正数充值，负数扣减）' })
  @IsOptional()
  @IsNumber()
  balanceDelta?: number;
}
