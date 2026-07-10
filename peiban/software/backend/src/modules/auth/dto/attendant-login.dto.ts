import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class AttendantLoginDto {
  @ApiProperty({ example: 'attendant001' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
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
