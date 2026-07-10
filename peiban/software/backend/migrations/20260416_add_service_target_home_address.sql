-- 迁移说明：对应 commit 9476760（2026-04-16）新增 service_target.home_address 字段
-- 如果使用 TypeORM synchronize: true，框架会自动同步。生产环境建议手动执行。
--
-- 注意：此迁移必须在 20260418_enlarge_encrypted_columns.sql 之前执行
--       因为后者会把 home_address 的列宽度从 255 扩展到 512。
--
-- 兼容说明：不使用 `ADD COLUMN IF NOT EXISTS`（部分 MySQL 环境 ERROR 1064），改用 INFORMATION_SCHEMA。

SET @dbname = DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'home_address'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN home_address VARCHAR(255) NULL',
  'SELECT ''column home_address already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
