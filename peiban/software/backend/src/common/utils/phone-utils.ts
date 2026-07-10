import { BadRequestException } from '@nestjs/common';

const CN_MOBILE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 校验并标准化中国大陆手机号。
 * - 允许 null / 空字符串 / undefined：返回 null（表示"未填写"）
 * - 非空但格式错误：抛 BadRequestException
 */
export function normalizeCnPhone(
  raw: unknown,
  fieldLabel = '手机号',
): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const digitsOnly = str.replace(/[\s-]/g, '');
  if (!CN_MOBILE_REGEX.test(digitsOnly)) {
    throw new BadRequestException(
      `${fieldLabel}格式不正确，应为 1 开头的 11 位大陆手机号`,
    );
  }
  return digitsOnly;
}

export function isValidCnPhone(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const str = String(raw).trim().replace(/[\s-]/g, '');
  return CN_MOBILE_REGEX.test(str);
}
