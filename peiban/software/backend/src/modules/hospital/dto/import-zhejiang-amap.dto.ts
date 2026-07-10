import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 浙江省 11 个地级市（高德 city 参数） */
export const ZHEJIANG_PREFECTURE_CITIES = [
  '杭州市',
  '宁波市',
  '温州市',
  '嘉兴市',
  '湖州市',
  '绍兴市',
  '金华市',
  '衢州市',
  '舟山市',
  '台州市',
  '丽水市',
] as const;

export class ImportZhejiangAmapDto {
  /**
   * 不传则默认 11 市全跑。传入必须为完整市名（含「市」），如 `杭州市`
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  cities?: string[];

  /** 请求间隔（毫秒），避免触发高德 QPS 限制 */
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(5000)
  delayMs?: number;

  /** 为 true 时只统计不写库 */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /**
   * POI 类型，默认综合医院+专科医院。可查阅高德 POI 分类编码自行扩展。
   * @example 090100|090200
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  types?: string;
}
