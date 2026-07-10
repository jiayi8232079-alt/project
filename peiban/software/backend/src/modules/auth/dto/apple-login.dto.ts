import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Apple 返回的 identityToken（JWT）' })
  @IsString()
  identityToken: string;

  @ApiPropertyOptional({ description: '首次登录 Apple 返回的姓名（拼接好的全名）' })
  @IsOptional()
  @IsString()
  fullName?: string;
}
