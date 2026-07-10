import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ConvertTriageOrderDto {
  @IsOptional()
  @IsEnum(['booked', 'pending_cs'])
  hospitalBookingStatus?: 'booked' | 'pending_cs';

  @ValidateIf((o) => o.hospitalBookingStatus === 'booked')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hospitalDirectoryId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  callbackContactPhone?: string;
}
