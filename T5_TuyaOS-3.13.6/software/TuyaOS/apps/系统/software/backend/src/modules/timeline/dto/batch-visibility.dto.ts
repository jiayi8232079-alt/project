import { IsNotEmpty, IsBoolean, IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchVisibilityDto {
  @ApiProperty({ description: '时间线记录ID列表', type: [Number] })
  @IsNotEmpty()
  @IsArray()
  @IsInt({ each: true })
  ids: number[];

  @ApiProperty({ description: '是否对用户可见' })
  @IsNotEmpty()
  @IsBoolean()
  visible: boolean;
}
