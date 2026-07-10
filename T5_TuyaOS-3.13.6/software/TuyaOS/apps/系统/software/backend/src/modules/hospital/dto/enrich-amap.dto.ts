import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class EnrichHospitalsAmapDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ids?: number[];

  /**
   * 按地级市筛选（如 丽水市、温州市），与 ids 互斥；优先使用 ids。
   * 搭配 limit、afterId 可分页，避免单次请求时间过长。
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  cities?: string[];

  /** 仅处理 id 大于该值的记录（用于分页批跑） */
  @IsOptional()
  @IsInt()
  @Min(0)
  afterId?: number;

  /** 本批次最多处理条数（1–200；按城市批量时可用较大值） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** 默认 true：仅在电话/图/地址等为空时写入 */
  @IsOptional()
  @IsBoolean()
  fillEmptyOnly?: boolean;

  /** 为 true 时用高德结果覆盖已有电话、图片等（请谨慎） */
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;

  /** 每条请求间隔毫秒，降低触发限流概率（100–3000） */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(3000)
  delayMs?: number;

  /**
   * 为 true 时仅尝试补/覆盖封面图（仍调用高德；一般不写入电话/地址等）
   */
  @IsOptional()
  @IsBoolean()
  imagesOnly?: boolean;

  /**
   * 为 true 时自动分批扫描「封面图为空」的医院并高德补图，直到扫完或达到 scanMaxBatches。
   * 与 ids/cities 互斥；单次 HTTP 可能较慢，请适当加大网关超时。
   */
  @IsOptional()
  @IsBoolean()
  scanAllMissingImages?: boolean;

  /** scanAllMissingImages 时每批最多条数仍受 limit 约束（建议 50–100） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  scanMaxBatches?: number;
}
