import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class MoveTenantDto {
  @ApiProperty({ description: '新的父租户 ID' })
  @IsInt()
  @Min(1)
  newParentId: number;
}
