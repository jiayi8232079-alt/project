import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class ListDialogSessionDto extends PaginationDto {
  @ApiPropertyOptional({ description: '按服务对象（老人）过滤' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceTargetId?: number;

  @ApiPropertyOptional({ description: '按设备过滤' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceId?: number;

  @ApiPropertyOptional({ description: '起始时间 ISO' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: '截止时间 ISO' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: ['pending', 'sampled', 'reviewed', 'flagged'],
    description: '质检状态',
  })
  @IsOptional()
  @IsEnum(['pending', 'sampled', 'reviewed', 'flagged'])
  qaStatus?: 'pending' | 'sampled' | 'reviewed' | 'flagged';

  @ApiPropertyOptional({ description: '仅含危机词的（crisisScore > 0）', type: Boolean })
  @IsOptional()
  hasCrisis?: string;
}
