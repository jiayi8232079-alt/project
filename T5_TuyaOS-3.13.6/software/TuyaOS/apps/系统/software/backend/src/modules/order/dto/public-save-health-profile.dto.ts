import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const SHORT_TEXT = 64;
const NORMAL_TEXT = 256;
const LONG_TEXT = 1024;
const MAX_TAGS = 30;

/**
 * `PUT /public/health-profile/:sceneCode` 的入参 DTO。
 *
 * 设计：
 * 1. 公开端点（无登录），ValidationPipe 的 `forbidNonWhitelisted` 会自动拒绝白名单外的字段，
 *    防止任意 key 写入 service_targets 或被嵌入 healthProfile JSON 列。
 * 2. 字符串长度全部受控，避免攻击者发 100MB 字符串撑爆 JSON 列。
 * 3. healthProfile 子对象用 nested DTO 强约束（subset），未列字段也会被拒。
 */
export class PublicHealthProfileSubsetDto {
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) homeRegion?: string;
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) homeAddressDetail?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) emergencyRelation?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) fillMethod?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) mobilityStatus?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) bloodType?: string;
  @IsOptional() @IsString() @MaxLength(LONG_TEXT) allergies?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(SHORT_TEXT, { each: true })
  medicalHistory?: string[];

  @IsOptional() @IsString() @MaxLength(LONG_TEXT) medicalHistoryOther?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) visionStatus?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) hearingStatus?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(SHORT_TEXT, { each: true })
  recentSymptoms?: string[];

  @IsOptional() @IsString() @MaxLength(LONG_TEXT) recentSymptomsOther?: string;
  @IsOptional() @IsString() @MaxLength(LONG_TEXT) currentMedication?: string;

  @IsOptional()
  @IsArray()
  @MaxLength(SHORT_TEXT, { each: true })
  currentMedications?: string[];

  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) signatureName?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) signedAt?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) signerName?: string;
  @IsOptional() @IsString() @MaxLength(SHORT_TEXT) signerRelation?: string;
}

export class PublicSaveHealthProfileDto {
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) idCard?: string;
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) emergencyContact?: string;
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) emergencyPhone?: string;
  @IsOptional() @IsString() @MaxLength(LONG_TEXT) mainAppeal?: string;
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) signatureUrl?: string;
  @IsOptional() @IsString() @MaxLength(NORMAL_TEXT) homeAddress?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PublicHealthProfileSubsetDto)
  healthProfile?: PublicHealthProfileSubsetDto;
}

export const PUBLIC_HEALTH_PROFILE_TAGS_MAX = MAX_TAGS;
