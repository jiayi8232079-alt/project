import { IsNotEmpty, IsEnum, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DocumentType } from '../../../common/enums/index.js';

export class UploadDocumentDto {
  @ApiProperty({ description: '订单ID' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  orderId: number;

  @ApiProperty({ description: '文档类型', enum: DocumentType })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  type: DocumentType;
}
