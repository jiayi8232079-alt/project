import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 高德 place/text 的 city 参数：直辖市仅「北京市」 */
export const BEIJING_AMAP_CITIES = ['北京市'] as const;

/** 广东省地级市（含东莞、中山） */
export const GUANGDONG_PREFECTURE_CITIES = [
  '广州市',
  '深圳市',
  '珠海市',
  '汕头市',
  '佛山市',
  '韶关市',
  '湛江市',
  '肇庆市',
  '江门市',
  '茂名市',
  '惠州市',
  '梅州市',
  '汕尾市',
  '河源市',
  '阳江市',
  '清远市',
  '东莞市',
  '中山市',
  '潮州市',
  '揭阳市',
  '云浮市',
] as const;

export type ImportRegionProvince = '北京市' | '广东省';

export class ImportRegionAmapDto {
  @IsIn(['北京市', '广东省'])
  province!: ImportRegionProvince;

  /**
   * 不传则默认该省全部地级市；传入须为完整市名（含「市」），且属于该省列表。
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  cities?: string[];

  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(5000)
  delayMs?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  types?: string;
}
