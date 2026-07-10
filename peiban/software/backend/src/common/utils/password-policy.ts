import { BadRequestException } from '@nestjs/common';

/**
 * 管理后台密码策略：
 * - 长度 8-32 位
 * - 必须同时包含字母与数字
 * - 禁止常见弱密码
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'qwerty123',
  'abc12345',
  'a1234567',
  '12345678',
  '123456789',
  '1234567890',
  'admin123',
  'admin1234',
  'administrator',
  'qiaoguo123',
  'changeme',
  'changeme1',
  'welcome1',
  'iloveyou',
  'letmein1',
]);

export function assertAdminPasswordPolicy(pwd: unknown): string {
  const normalized = typeof pwd === 'string' ? pwd.trim() : '';
  if (!normalized) {
    throw new BadRequestException('请输入新密码');
  }
  if (normalized.length < 8) {
    throw new BadRequestException('密码至少 8 位，不符合安全策略');
  }
  if (normalized.length > 32) {
    throw new BadRequestException('密码长度不能超过 32 位');
  }
  if (!/[A-Za-z]/.test(normalized)) {
    throw new BadRequestException('密码必须包含至少 1 位字母');
  }
  if (!/[0-9]/.test(normalized)) {
    throw new BadRequestException('密码必须包含至少 1 位数字');
  }
  if (/\s/.test(normalized)) {
    throw new BadRequestException('密码不能包含空格等空白字符');
  }
  if (COMMON_WEAK_PASSWORDS.has(normalized.toLowerCase())) {
    throw new BadRequestException('密码过于常见，请使用更复杂的密码');
  }
  return normalized;
}
