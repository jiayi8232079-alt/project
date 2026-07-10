import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsNumber,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompanionMemoryScope } from '../../../entities/companion-memory.entity.js';

export class SaveMemoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  familyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId?: number;

  @IsEnum(CompanionMemoryScope)
  scope: CompanionMemoryScope;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  memoryKey?: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class RecallMemoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  familyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId?: number;

  @IsOptional()
  @IsEnum(CompanionMemoryScope)
  scope?: CompanionMemoryScope;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  keyword?: string;
}

export class CorrectMemoryDto {
  @IsString()
  @MaxLength(2000)
  content: string;
}

export class UpsertPersonaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  familyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  personality?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speechRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  catchphrase?: string;

  @IsOptional()
  @IsObject()
  traits?: Record<string, unknown>;
}
