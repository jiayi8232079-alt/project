import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContentItemDto {
  @IsString()
  @MaxLength(32)
  category: string;

  @IsString()
  @MaxLength(128)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  audioUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortWeight?: number;
}

export class QueryContentItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;
}

export class PlayContentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceId?: number;
}

export class UpdateContentItemDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
