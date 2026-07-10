import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { ValueTransformer } from 'typeorm';

/**
 * 列加密工具。
 *
 * 格式版本：
 * - v1 (旧)：`enc:<ivHex>:<cipherHex>`（AES-256-CBC，无鉴权，仅用于读取历史数据）
 * - v2 (新)：`enc2:<ivHex>:<tagHex>:<cipherHex>`（AES-256-GCM，带鉴权标签）
 *
 * 新增数据一律使用 v2 写入；v1 仅在读取时兼容，便于迁移期过渡。
 *
 * 密钥来源（按优先级）：
 * 1. 环境变量 `COLUMN_ENCRYPTION_KEY`（强烈推荐，生产环境必须设置）
 * 2. 环境变量 `JWT_SECRET`（过渡兜底，稍后请单独设置独立密钥）
 * 3. 硬编码兜底串（仅本地开发；生产启动时会打印告警）
 */

const ALGO_CBC = 'aes-256-cbc';
const ALGO_GCM = 'aes-256-gcm';
const IV_LEN_CBC = 16;
const IV_LEN_GCM = 12;
const AUTH_TAG_LEN = 16;

const FALLBACK_KEY = 'qiaoguo-fallback-key';
let warnedAboutFallback = false;

function getSecret(): string {
  const secret = process.env.COLUMN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    // 生产环境绝对禁止用兜底密钥：等同于明文存储敏感字段，任何拿到代码仓库的人
    // 都能直接解密出全表手机号/紧急联系人。这里直接 throw 让进程启动失败，
    // 比"打印 warning + 静默走 FALLBACK"更安全。
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[column-encryption] 生产环境必须配置 COLUMN_ENCRYPTION_KEY 或 JWT_SECRET，已拒绝使用内置兜底密钥。',
      );
    }
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[column-encryption] 未配置 COLUMN_ENCRYPTION_KEY / JWT_SECRET，当前使用内置兜底密钥；切勿用于生产。',
      );
    }
    return FALLBACK_KEY;
  }
  return secret;
}

function deriveKey(): Buffer {
  return scryptSync(getSecret(), 'qiaoguo-salt', 32);
}

/** 新写入一律使用 GCM（v2） */
export function encrypt(plaintext: string): string {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext;
  }
  const key = deriveKey();
  const iv = randomBytes(IV_LEN_GCM);
  const cipher = createCipheriv(ALGO_GCM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** 解密：兼容读取 v1 (CBC) 和 v2 (GCM) 两种前缀 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;

  if (ciphertext.startsWith('enc2:')) {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return ciphertext;
    try {
      const key = deriveKey();
      const iv = Buffer.from(parts[1], 'hex');
      const tag = Buffer.from(parts[2], 'hex');
      const payload = Buffer.from(parts[3], 'hex');
      if (tag.length !== AUTH_TAG_LEN) return ciphertext;
      const decipher = createDecipheriv(ALGO_GCM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[column-encryption] GCM 解密失败，返回原始密文', err);
      return ciphertext;
    }
  }

  if (ciphertext.startsWith('enc:')) {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext;
    try {
      const key = deriveKey();
      const iv = Buffer.from(parts[1], 'hex');
      if (iv.length !== IV_LEN_CBC) return ciphertext;
      const payload = Buffer.from(parts[2], 'hex');
      const decipher = createDecipheriv(ALGO_CBC, key, iv);
      return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[column-encryption] CBC 解密失败，返回原始密文', err);
      return ciphertext;
    }
  }

  return ciphertext;
}

/** 用于需要「仅做等值查询」的字段：稳定 HMAC-SHA256，不可逆 */
export function deterministicHash(value: string | null | undefined): string | null {
  if (!value) return null;
  const secret = getSecret();
  return createHmac('sha256', `${secret}:hash-salt`).update(value).digest('hex');
}

/** 是否为加密后的值（v1/v2 任意） */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('enc:') || value.startsWith('enc2:');
}

/**
 * TypeORM 值转换器：写入时自动加密，读取时自动解密（兼容 v1/v2）。
 * 空值透传，避免把空字符串也写成一串密文。
 */
export const EncryptedColumnTransformer: ValueTransformer = {
  to: (value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return value ?? null;
    if (isEncrypted(value)) return value; // 防止对已加密内容二次加密
    return encrypt(value);
  },
  from: (value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return value ?? null;
    return decrypt(value);
  },
};
