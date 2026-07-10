import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class AddTenantUserDto {
  @ApiProperty({ description: '要加入租户的 users.id' })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiPropertyOptional({ description: '可选：分配 tenant_roles.id' })
  @IsOptional()
  @IsInt()
  @Min(1)
  roleId?: number;

  @ApiPropertyOptional({ description: '是否为租户 owner，默认 false' })
  @IsOptional()
  @IsBoolean()
  isOwner?: boolean;
}
