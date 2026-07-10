import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class SetCredentialsDto {
  @ApiProperty({ example: 'attendant001', description: '登录账号（字母/数字/下划线，3-20 位）' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: '用户名只能包含字母、数字、下划线，且长度 3-20 位',
  })
  username?: string;

  @ApiProperty({
    example: 'Qg12345678',
    description: '登录密码（至少 8 位且同时包含字母与数字）',
  })
  @IsString()
  @IsOptional()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(32, { message: '密码长度不能超过 32 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*[0-9])\S+$/, {
    message: '密码必须同时包含字母和数字，且不含空格',
  })
  password?: string;
}
