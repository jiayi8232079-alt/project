import { PartialType } from '@nestjs/swagger';
import { CreateServiceTargetDto } from './create-service-target.dto.js';

export class UpdateServiceTargetDto extends PartialType(
  CreateServiceTargetDto,
) {}
