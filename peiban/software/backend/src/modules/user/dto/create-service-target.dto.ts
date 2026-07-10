import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceTargetDto {
  @ApiProperty({ description: '服务对象姓名' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '身份证号' })
  @IsOptional()
  @IsString()
  idCard?: string;

  @ApiPropertyOptional({ description: '性别' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: '年龄' })
  @IsOptional()
  @IsInt()
  age?: number;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '紧急联系人' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ description: '紧急联系电话' })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional({ description: '家庭地址' })
  @IsOptional()
  @IsString()
  homeAddress?: string;

  @ApiPropertyOptional({ description: '健康档案' })
  @IsOptional()
  @IsObject()
  healthProfile?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '主要诉求' })
  @IsOptional()
  @IsString()
  mainAppeal?: string;

  @ApiPropertyOptional({ description: '签署图片URL' })
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @ApiPropertyOptional({
    description: '与本人关系: self, father, mother, parent, spouse, child, other',
  })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({ description: '特殊备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
