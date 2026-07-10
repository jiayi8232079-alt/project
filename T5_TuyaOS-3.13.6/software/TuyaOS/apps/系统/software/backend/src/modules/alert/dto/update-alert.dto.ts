import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AcknowledgeAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CloseAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssignAlertDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeId: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AppendAlertLogDto {
  @IsString()
  @MaxLength(2000)
  note: string;
}

export class MockDeviceAlertDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceTargetId?: number;

  @IsIn(['fall', 'sos', 'vital_anomaly'])
  type: 'fall' | 'sos' | 'vital_anomaly';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceId: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetName?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class EscalateAlertDto {
  @IsIn(['community', 'manual', 'emergency_call'])
  target: 'community' | 'manual' | 'emergency_call';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
