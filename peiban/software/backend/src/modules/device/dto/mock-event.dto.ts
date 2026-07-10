import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import {
  DeviceEventLevel,
  DeviceEventType,
} from '../../../entities/device-event-log.entity.js';

/**
 * mock 触发设备事件入库 —— 仅 admin / 测试环境用。
 *
 * 例：触发一次跌倒事件
 *   POST /devices/:id/mock-event
 *   { "type":"fall", "level":"critical", "payload":{"confidence":0.92} }
 */
export class MockEventDto {
  @ApiProperty({ enum: DeviceEventType })
  @IsEnum(DeviceEventType)
  type: DeviceEventType;

  @ApiPropertyOptional({ enum: DeviceEventLevel, default: DeviceEventLevel.INFO })
  @IsOptional()
  @IsEnum(DeviceEventLevel)
  level?: DeviceEventLevel;

  @ApiPropertyOptional({ description: '事件原始数据' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '幂等键（重复传相同 key 不会重复入库）' })
  @IsOptional()
  @IsString()
  dedupKey?: string;
}
