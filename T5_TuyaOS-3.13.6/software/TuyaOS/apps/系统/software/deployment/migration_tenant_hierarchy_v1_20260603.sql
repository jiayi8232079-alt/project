-- ============================================================
-- 数据库迁移：分层多租户树形结构 v1 —— 2026-06-03
-- 配套：PRD_分层多租户与三门户联动.md Phase 1
--
-- 改动：tenants 表增加 path / depth / scope_type / region_code / org_chain
-- 幂等：使用 INFORMATION_SCHEMA 检查列后再 ALTER
-- ============================================================

USE qiaoguo_health;

-- path
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'path'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN path VARCHAR(255) NOT NULL DEFAULT ''/'' COMMENT ''物化路径'' AFTER parent_id',
  'SELECT ''path exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- depth
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'depth'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN depth TINYINT NOT NULL DEFAULT 0 COMMENT ''树深度'' AFTER path',
  'SELECT ''depth exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- scope_type
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'scope_type'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN scope_type ENUM(''platform'',''government'',''enterprise'',''organization'',''site'') NOT NULL DEFAULT ''organization'' COMMENT ''层级类型'' AFTER depth',
  'SELECT ''scope_type exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- region_code
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'region_code'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN region_code VARCHAR(32) NULL COMMENT ''行政区划码'' AFTER scope_type',
  'SELECT ''region_code exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- org_chain
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'org_chain'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN org_chain VARCHAR(255) NULL COMMENT ''组织链路 JSON'' AFTER region_code',
  'SELECT ''org_chain exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 索引（忽略已存在错误，运维可手工跳过）
-- idx_tenants_path
SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND INDEX_NAME = 'idx_tenants_path'
);
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE tenants ADD INDEX idx_tenants_path (path)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND INDEX_NAME = 'idx_tenants_parent'
);
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE tenants ADD INDEX idx_tenants_parent (parent_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND INDEX_NAME = 'idx_tenants_scope'
);
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE tenants ADD INDEX idx_tenants_scope (scope_type)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND INDEX_NAME = 'idx_tenants_region'
);
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE tenants ADD INDEX idx_tenants_region (region_code)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 默认平台租户：path=/ depth=0 scope_type=platform
UPDATE tenants
SET path = '/', depth = 0, scope_type = 'platform'
WHERE id = 1;
