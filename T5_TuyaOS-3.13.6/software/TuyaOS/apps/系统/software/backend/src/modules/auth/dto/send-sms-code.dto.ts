import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SendSmsCodeDto {
  @ApiProperty({ description: '手机号（中国大陆）' })
  @IsString()
  @Length(11, 14)
  phone: string;
}
