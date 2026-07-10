import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateReminderDto } from './create-reminder.dto.js';
import { ReminderStatus } from '../../../entities/medication-reminder.entity.js';

export class UpdateReminderDto extends PartialType(CreateReminderDto) {
  @ApiPropertyOptional({ description: '提醒状态', enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;
}
