import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  IsInt,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimelineType } from '../../../common/enums/index.js';

export class CreateTimelineEntryDto {
  @ApiProperty({ description: '订单ID' })
  @IsNotEmpty()
  @IsInt()
  orderId: number;

  @ApiProperty({ description: '时间线类型', enum: TimelineType })
  @IsNotEmpty()
  @IsEnum(TimelineType)
  type: TimelineType;

  @ApiPropertyOptional({ description: '内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '元数据' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否对用户可见', default: false })
  @IsOptional()
  @IsBoolean()
  visibleToUser?: boolean;

  // 前端「发布后通知家属」开关；当前仅接收以通过白名单校验，家属通知逻辑后续需求再接入
  @ApiPropertyOptional({ description: '是否通知家属（预留字段，后端暂未使用）' })
  @IsOptional()
  @IsBoolean()
  notifyFamily?: boolean;

  /** 业务发生时间（补录时可指定；仅内容型类型会写入 event_time） */
  @ApiPropertyOptional({ description: '业务发生时间（ISO8601）' })
  @IsOptional()
  @IsDateString()
  eventTime?: string;
}
