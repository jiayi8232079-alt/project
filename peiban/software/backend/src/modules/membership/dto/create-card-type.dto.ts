import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMembershipCardTypeDto {
  @ApiProperty({ example: '月卡' })
  @IsString()
  cardName: string;

  @ApiProperty({ example: 30, description: '有效天数' })
  @IsNumber()
  @IsInt()
  durationDays: number;

  @ApiProperty({ example: 299 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ description: '关联等级ID' })
  @IsOptional()
  @IsNumber()
  @IsInt()
  levelId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
