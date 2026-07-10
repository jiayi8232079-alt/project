import { IsArray, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceProviderDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(64)
  type: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceArea?: string[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  catalog?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settlement?: Record<string, unknown>;
}

export class CreateHospitalPartnershipDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hospitalId?: number;

  @IsString()
  @MaxLength(128)
  hospitalName: string;

  @IsString()
  @MaxLength(64)
  partnershipType: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  resources?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  benefits?: Record<string, unknown>;
}
