-- 迁移说明：对应 commit 77f0861
-- 如果使用 TypeORM synchronize: true，则无需手动执行，框架会自动同步
--
-- 兼容说明：不使用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`（部分环境会报 ERROR 1064），
-- 改用 INFORMATION_SCHEMA 判定，与 20260418_alert_assignee_and_logs.sql 一致。

SET @dbname = DATABASE();

-- 1. Order 表新增服务确认单签署人关系字段
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'service_confirm_signer_relation'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN service_confirm_signer_relation VARCHAR(32) NULL',
  'SELECT ''column service_confirm_signer_relation already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 小程序监控场景表新增场景类型字段（timeline=服务动态, sign=签署确认单）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'mp_monitor_scenes' AND COLUMN_NAME = 'scene_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE mp_monitor_scenes ADD COLUMN scene_type VARCHAR(16) NOT NULL DEFAULT ''timeline''',
  'SELECT ''column scene_type already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
