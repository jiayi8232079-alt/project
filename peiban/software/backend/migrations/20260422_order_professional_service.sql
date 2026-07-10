-- 迁移说明：订单挂到"专业服务目录"
--
-- 背景：
--   系统已有 attendant.primaryRole / professionalRoles 和 professional_services 目录，
--   但订单仍只用 `service_type` 自由字符串，派单引擎拿不到"应由哪个角色接单"。
--   本迁移为 orders 表加 professional_service_id 外键，并配套索引。
--
-- 老数据：不变更，新字段可为 NULL。
-- 幂等：INFORMATION_SCHEMA 判断列存在性；可重复执行。

SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'professional_service_id');
SET @sql := IF(@exists = 0,
  'ALTER TABLE orders ADD COLUMN professional_service_id INT NULL COMMENT "专业服务目录 ID" AFTER service_type, ADD INDEX IDX_orders_professional_service (professional_service_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
