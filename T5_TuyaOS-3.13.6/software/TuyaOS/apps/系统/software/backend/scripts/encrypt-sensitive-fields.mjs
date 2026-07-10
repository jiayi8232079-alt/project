#!/usr/bin/env node
/**
 * 敏感字段明文 → 密文批量迁移脚本（幂等，可反复运行）
 *
 * 使用方式：
 *   1. 先保证环境变量 COLUMN_ENCRYPTION_KEY 已设置（与运行时保持一致）。
 *   2. 保证 DB_HOST / DB_USERNAME / DB_PASSWORD / DB_DATABASE 可连接到目标数据库。
 *   3. 建议先备份数据库：mysqldump ...
 *   4. 执行：node scripts/encrypt-sensitive-fields.mjs [--dry-run]
 *
 * 注意：
 *   - 脚本会跳过已是 `enc:` / `enc2:` 前缀的值，因此可以多次执行。
 *   - 脚本只处理历史明文数据。新数据由 TypeORM 列加密 transformer 自动加密。
 *   - 若出错，建议立刻结束进程并从备份恢复。
 */

import mysql from 'mysql2/promise';
import {
  createCipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 尝试加载 backend/.env 供本地脚本使用
function loadEnvFile() {
  const envPath = resolve(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    let v = t.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile();

const dryRun = process.argv.includes('--dry-run');

// ===== 加密：必须与 backend/src/common/utils/column-encryption.ts 完全一致 =====
const ALGO_GCM = 'aes-256-gcm';
const IV_LEN_GCM = 12;
const FALLBACK_KEY = 'qiaoguo-fallback-key';

function getSecret() {
  const secret = process.env.COLUMN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    console.warn('[warn] 未设置 COLUMN_ENCRYPTION_KEY/JWT_SECRET，使用内置兜底。生产请务必配置。');
    return FALLBACK_KEY;
  }
  return secret;
}

function deriveKey() {
  return scryptSync(getSecret(), 'qiaoguo-salt', 32);
}

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  const key = deriveKey();
  const iv = randomBytes(IV_LEN_GCM);
  const cipher = createCipheriv(ALGO_GCM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function isEncrypted(v) {
  if (!v || typeof v !== 'string') return false;
  return v.startsWith('enc:') || v.startsWith('enc2:');
}

// ===== 需要处理的 表.字段 清单 =====
const TARGETS = [
  // 注意 service_targets.idCard 是 camelCase，其余均为 snake_case
  { table: 'service_targets', columns: ['idCard', 'phone', 'emergency_contact', 'emergency_phone', 'home_address'] },
  { table: 'orders', columns: ['callback_contact_phone', 'service_confirm_signer_name'] },
  { table: 'complaints', columns: ['contact_phone'] },
  { table: 'attendants', columns: ['insurance_info'] },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'qiaoguo_health',
    charset: 'utf8mb4',
  });

  console.log(`\n==== 敏感字段加密迁移 (${dryRun ? 'DRY RUN' : 'LIVE'}) ====`);

  try {
    for (const target of TARGETS) {
      const [existsRows] = await conn.query(`SHOW TABLES LIKE ?`, [target.table]);
      if (existsRows.length === 0) {
        console.log(`[skip] 表 ${target.table} 不存在`);
        continue;
      }

      for (const col of target.columns) {
        const [colRows] = await conn.query(`SHOW COLUMNS FROM \`${target.table}\` LIKE ?`, [col]);
        if (colRows.length === 0) {
          console.log(`[skip] ${target.table}.${col} 不存在`);
          continue;
        }

        // 若列长度太小（如 32/64），先放大到 512，避免 GCM 密文写不下
        const colType = colRows[0].Type || '';
        const match = colType.match(/varchar\((\d+)\)/i);
        if (match && Number(match[1]) < 255) {
          if (dryRun) {
            console.log(`[dry] ALTER TABLE ${target.table} MODIFY ${col} VARCHAR(512) => 当前 ${colType}`);
          } else {
            console.log(`[alter] ${target.table}.${col} ${colType} => VARCHAR(512)`);
            await conn.query(`ALTER TABLE \`${target.table}\` MODIFY \`${col}\` VARCHAR(512) NULL`);
          }
        }

        // 读取所有非空且尚未加密的行
        const [rows] = await conn.query(
          `SELECT id, \`${col}\` AS val FROM \`${target.table}\` WHERE \`${col}\` IS NOT NULL AND \`${col}\` <> ''`,
        );
        let processed = 0;
        let skipped = 0;
        for (const r of rows) {
          if (isEncrypted(r.val)) {
            skipped += 1;
            continue;
          }
          const enc = encrypt(r.val);
          if (dryRun) {
            processed += 1;
            continue;
          }
          await conn.query(
            `UPDATE \`${target.table}\` SET \`${col}\` = ? WHERE id = ?`,
            [enc, r.id],
          );
          processed += 1;
        }
        console.log(
          `[ok] ${target.table}.${col} -> 加密 ${processed} 条 | 已是密文跳过 ${skipped} 条`,
        );
      }
    }
    console.log('\n全部完成。\n');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
