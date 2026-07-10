import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FamilyTaskStatus } from '../../../entities/family-task.entity.js';
import { VoiceprintStatus } from '../../../entities/voiceprint-profile.entity.js';

export class CreateFamilyMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  familyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  elderId?: number;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  broadcastMode?: string;
}

export class CreateFamilyTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  familyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  elderId?: number;

  @IsString()
  @MaxLength(128)
  title: string;

  @IsString()
  @MaxLength(64)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  scheduleMode?: string;

  @IsOptional()
  @IsString()
  remindAt?: string;
}

export class MockFamilyTaskReceiptDto {
  @IsEnum(FamilyTaskStatus)
  status: FamilyTaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  elderResponse?: string;
}

export class CreateVoiceprintDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  familyId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId: number;
}

export class UpdateVoiceprintStatusDto {
  @IsEnum(VoiceprintStatus)
  status: VoiceprintStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
