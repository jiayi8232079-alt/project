import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CrisisAction, CrisisSeverity } from '../../../entities/crisis-word.entity.js';

export class CreateCrisisWordDto {
  @IsString()
  @MaxLength(64)
  word: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @IsOptional()
  @IsEnum(CrisisSeverity)
  severity?: CrisisSeverity;

  @IsOptional()
  @IsEnum(CrisisAction)
  action?: CrisisAction;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  remark?: string;
}

export class UpdateCrisisWordDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  word?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @IsOptional()
  @IsEnum(CrisisSeverity)
  severity?: CrisisSeverity;

  @IsOptional()
  @IsEnum(CrisisAction)
  action?: CrisisAction;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  remark?: string;
}

export class ListCrisisWordDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(CrisisSeverity)
  severity?: CrisisSeverity;
}
