import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class PhoneLoginDto {
  @ApiProperty({ description: '手机号（中国大陆）' })
  @IsString()
  @Length(11, 14)
  phone: string;

  @ApiProperty({ description: '短信验证码' })
  @IsString()
  @Length(4, 8)
  code: string;

  @ApiPropertyOptional({ description: '昵称（首次注册可选）' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  nickname?: string;
}
