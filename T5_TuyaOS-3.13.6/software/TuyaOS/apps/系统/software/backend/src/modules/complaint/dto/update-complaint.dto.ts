import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';
import {
  ComplaintPriority,
  ComplaintStatus,
} from '../../../entities/complaint.entity.js';

/** 管理员对工单的操作：指派 / 改优先级 / 状态变更 / 回复 / 内部备注 */
export class UpdateComplaintDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({ enum: ComplaintPriority })
  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @ApiPropertyOptional({ description: '指派处理人（管理员 ID）' })
  @IsOptional()
  @IsInt()
  handlerId?: number | null;

  @ApiPropertyOptional({ description: '处理结论（最终答复，对客户可见）' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  resolution?: string;

  @ApiPropertyOptional({ description: '内部备注（仅管理员可见）' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  internalNote?: string;

  @ApiPropertyOptional({ description: '本次回复（会追加到时间线）' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  reply?: string;
}

/** 用户侧补充追问/关闭 */
export class UserAppendComplaintDto {
  @ApiPropertyOptional({ description: '补充描述（会追加到时间线）' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  content?: string;

  @ApiPropertyOptional({
    description: '对处理结果评分（1-5），仅在工单已 resolved 时可用',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  rating?: number;

  @ApiPropertyOptional({ description: '用户主动关闭工单' })
  @IsOptional()
  close?: boolean;
}
