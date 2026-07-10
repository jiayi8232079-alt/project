import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveAgentConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  model?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  memoryRounds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsString()
  knowledgeBase?: string;

  @IsOptional()
  @IsObject()
  tools?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
