import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectOrderDto {
  @ApiProperty({ description: '拒绝原因' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
