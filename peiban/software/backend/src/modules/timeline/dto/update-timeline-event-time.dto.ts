import { IsNotEmpty, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTimelineEventTimeDto {
  /**
   * 节点业务时间，ISO8601 字符串。清空业务时间请走独立的 DELETE 接口（当前版本未实现）。
   */
  @ApiProperty({
    description: '节点业务时间（ISO8601）',
    example: '2026-04-20T14:30:00+08:00',
  })
  @IsNotEmpty()
  @IsISO8601()
  eventTime!: string;
}
