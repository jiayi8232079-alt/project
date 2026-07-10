import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PurgeAncillaryHospitalsDto {
  /** 仅返回将要删除的数量与示例 ID，不写库 */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /** 预览返回的名称示例条数（默认 30） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  previewLimit?: number;

  /** 与小程序「找医院」一致：顺带剔除眼镜店/无名医院字样的诊所/社康等（默认 true） */
  @IsOptional()
  @IsBoolean()
  includeDirectoryNoise?: boolean;

  /**
   * 同城同名（去掉括号内备注与空格后一致）时：删无 `phone_main` 的重复行；若都无路则只留 sort_weight 最高一条（默认 true）
   */
  @IsOptional()
  @IsBoolean()
  dedupePreferPhone?: boolean;

  /** 删除库内所有主电话为空的医院（慎用；默认 false） */
  @IsOptional()
  @IsBoolean()
  removeAllWithoutMainPhone?: boolean;

  /**
   * 同一省市区 + 规整后地址一致（长度≥8）的多条：保留信息更全的一条（默认 true）
   */
  @IsOptional()
  @IsBoolean()
  dedupeSameAddress?: boolean;

  /**
   * 同一城市 + 经纬度四位小数网格一致：保留信息更全的一条（默认 true）
   */
  @IsOptional()
  @IsBoolean()
  dedupeSameCoordinates?: boolean;

  /**
   * 仅删除名称含「正骨 / 整脊 / 推拿复位」且不含「医院」的机构（与导入跳过规则一致）；为 true 时忽略其它 ancillary/牙科/目录噪声条件，且不叠加同城去重扩展。
   */
  @IsOptional()
  @IsBoolean()
  matchOrthopedicClinicsOnly?: boolean;
}
