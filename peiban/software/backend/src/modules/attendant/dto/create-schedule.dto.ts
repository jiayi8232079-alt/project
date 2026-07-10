import { IsNotEmpty, IsDateString, IsEnum, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ description: '陪诊员ID' })
  @IsNotEmpty()
  @IsInt()
  attendantId: number;

  @ApiProperty({ description: '日期' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({
    description: '时段',
    enum: ['morning', 'afternoon', 'full_day'],
  })
  @IsNotEmpty()
  @IsEnum(['morning', 'afternoon', 'full_day'])
  period: string;
}
