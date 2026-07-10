import { OmitType } from '@nestjs/swagger';
import { CreateReminderDto } from './create-reminder.dto.js';

export class CreateMyReminderDto extends OmitType(CreateReminderDto, [
  'userId',
] as const) {}
