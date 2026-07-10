import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BatchDoctorItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  titleLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  expertise?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  introduction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;

  @IsOptional()
  @IsInt()
  sortWeight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateHospitalDoctorDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  hospitalId: number;

  @ApiProperty({ example: '张明' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional({ example: '心血管内科' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({ example: '主任医师' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  titleLevel?: string;

  @ApiPropertyOptional({ example: '冠心病、心律失常的诊治' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  expertise?: string;

  @ApiPropertyOptional({ example: '长期从事心血管疾病临床诊疗与研究工作。' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  introduction?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  sortWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateHospitalDoctorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  titleLevel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  expertise?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  introduction?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  sortWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BatchHospitalDoctorsDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  hospitalId: number;

  /** 为 true 时先删除该院全部医生再写入（谨慎） */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  replace?: boolean;

  @ApiProperty({
    description: '医生条目列表',
    example: [
      {
        name: '李华',
        department: '消化内科',
        titleLevel: '副主任医师',
        expertise: '胃肠早癌筛查',
        introduction: '长期从事消化系统疾病诊疗与内镜治疗。',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchDoctorItemDto)
  items: BatchDoctorItemDto[];
}
