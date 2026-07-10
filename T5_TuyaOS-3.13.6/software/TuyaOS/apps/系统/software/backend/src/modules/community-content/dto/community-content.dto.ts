import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CommunityContentPriority,
  CommunityContentStatus,
} from '../../../entities/community-content.entity.js';
import { ContentDeliveryStatus } from '../../../entities/content-delivery.entity.js';

export class CommunityContentTargetDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  communityId?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buildingIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  elderTags?: string[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  deviceIds?: number[];
}

export class CreateCommunityContentDto {
  @ApiProperty({ example: '防诈骗提醒' })
  @IsString()
  @MaxLength(128)
  title: string;

  @ApiProperty({ example: '近期请注意陌生来电。' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ example: '社区提醒您，近期请注意陌生来电。' })
  @IsOptional()
  @IsString()
  voiceScript?: string;

  @ApiProperty({ example: 'anti_fraud' })
  @IsString()
  @MaxLength(64)
  category: string;

  @ApiPropertyOptional({ enum: CommunityContentPriority })
  @IsOptional()
  @IsEnum(CommunityContentPriority)
  priority?: CommunityContentPriority;

  @ApiPropertyOptional({ type: CommunityContentTargetDto })
  @IsOptional()
  @IsObject()
  target?: CommunityContentTargetDto;

  @ApiPropertyOptional({ example: { playTimes: ['09:00', '18:00'] } })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, unknown>;
}

export class QueryCommunityContentDto {
  @IsOptional()
  @IsEnum(CommunityContentStatus)
  status?: CommunityContentStatus;
}

export class MockContentDeliveryAckDto {
  @ApiProperty({ enum: ContentDeliveryStatus })
  @IsEnum(ContentDeliveryStatus)
  status: ContentDeliveryStatus;

  @ApiPropertyOptional({ example: '设备离线' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  failureReason?: string;
}
