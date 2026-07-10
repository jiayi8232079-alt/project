import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCreateHospitalDto {
  @ApiProperty({ description: '医院名称' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ description: '简称' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shortName?: string | null;

  @ApiPropertyOptional({ description: '省，默认浙江省' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  province?: string;

  @ApiProperty({ description: '市' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  city: string;

  @ApiPropertyOptional({ description: '区县' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  district?: string | null;

  @ApiProperty({ description: '详细地址' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  address: string;

  @ApiPropertyOptional({ description: '主要电话' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneMain?: string | null;

  @ApiPropertyOptional({
    description: '附加电话列表',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  phonesExtra?: string[] | null;

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumberString()
  latitude?: string | null;

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumberString()
  longitude?: string | null;

  @ApiPropertyOptional({ description: '医院等级' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  hospitalLevel?: string | null;

  @ApiPropertyOptional({ description: '举办主体' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ownershipType?: string | null;

  @ApiPropertyOptional({
    description: '重点科室',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  keyDepartments?: string[] | null;

  @ApiPropertyOptional({ description: '官网' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  websiteUrl?: string | null;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortWeight?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '数据来源' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string | null;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string | null;
}

export class AdminUpdateHospitalDto {
  @ApiPropertyOptional({ description: '医院名称' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ description: '简称' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shortName?: string | null;

  @ApiPropertyOptional({ description: '省' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  province?: string;

  @ApiPropertyOptional({ description: '市' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  city?: string;

  @ApiPropertyOptional({ description: '区县' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  district?: string | null;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;

  @ApiPropertyOptional({ description: '主要电话' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneMain?: string | null;

  @ApiPropertyOptional({
    description: '附加电话列表',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  phonesExtra?: string[] | null;

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumberString()
  latitude?: string | null;

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumberString()
  longitude?: string | null;

  @ApiPropertyOptional({ description: '医院等级' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  hospitalLevel?: string | null;

  @ApiPropertyOptional({ description: '举办主体' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ownershipType?: string | null;

  @ApiPropertyOptional({
    description: '重点科室',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  keyDepartments?: string[] | null;

  @ApiPropertyOptional({ description: '官网' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  websiteUrl?: string | null;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortWeight?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '数据来源' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string | null;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string | null;
}
