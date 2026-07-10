import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParseImageDto {
  @ApiProperty({
    description: '处方照片 URL（通常由 /documents/raw-upload 返回）',
  })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ description: '关联订单 ID（可选）' })
  @IsOptional()
  orderId?: number;
}
