import { ValueTransformer } from 'typeorm';

/**
 * TypeORM `@Column({ type:'decimal' })` 默认以字符串返回（mysql2 保留精度）。
 * 统一经这个 transformer 序列化为 number，避免前端 parseFloat / 累加出错。
 *
 * 选择 number 而非 string：金额展示在 1e13 以下完全安全（JS number 精度 2^53）。
 * 若以后有高精度场景，可以替换为 BigDecimal / string + 前端 BigNumber。
 */
export const DecimalTransformer: ValueTransformer = {
  to: (value: number | string | null | undefined): number | string | null => {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : Number(value);
  },
  from: (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  },
};
