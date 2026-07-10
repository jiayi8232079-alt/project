import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PurgeMissingImageHospitalsDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  previewLimit?: number;
}
