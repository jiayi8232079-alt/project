import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

/**
 * App 下发 DP（数据点）/ 自控指令。
 *
 * - 普通 DP：如 `volume_set` / `mute` / `ptz_control`；
 * - 自控指令：如 `expr_happy` / `act_nod`（机器人非 DP 指令）；
 *
 * Controller 用 `dp` 和 `self-control` 两个不同端点区分，service 内部统一处理。
 */
export class SendDpDto {
  @ApiProperty({ description: 'DP 标识符或自控指令 code' })
  @IsString()
  @Length(1, 64)
  code: string;

  @ApiProperty({
    description: 'DP 值（bool/number 用字符串传，service 内 cast）',
    type: 'string',
  })
  @IsNotEmpty()
  value: string | number | boolean;

  @ApiPropertyOptional({
    description: '幂等键（操作类下发需带；防止重复点击下重单）',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  idempotencyKey?: string;
}
