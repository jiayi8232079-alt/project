import { IsBoolean, IsOptional } from 'class-validator';

export class RestorePublicStomatologyDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /** 默认 true：对已配置 AMAP_WEB_KEY 时逐条高德匹配补全地址电话 */
  @IsOptional()
  @IsBoolean()
  useAmap?: boolean;
}
