import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ description: '用户名' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: '图形验证码 token（达到阈值后必填）' })
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @ApiPropertyOptional({ description: '图形验证码用户输入（达到阈值后必填）' })
  @IsOptional()
  @IsString()
  captchaCode?: string;
}
