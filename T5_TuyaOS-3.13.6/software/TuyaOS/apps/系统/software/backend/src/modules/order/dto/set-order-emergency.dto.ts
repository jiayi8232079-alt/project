import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetOrderEmergencyDto {
  @ApiProperty({ enum: ['activate', 'clear'], description: 'activate=进入紧急；clear=解除紧急恢复服务中' })
  @IsIn(['activate', 'clear'])
  action: 'activate' | 'clear';

  @ApiPropertyOptional({ enum: ['store', 'family'], description: '进入紧急时必填：联系门店或联系紧急联系人（家属）' })
  @IsOptional()
  @IsIn(['store', 'family'])
  channel?: 'store' | 'family';

  @ApiPropertyOptional({ description: '附加说明（可选）' })
  @IsOptional()
  @IsString()
  description?: string;
}
