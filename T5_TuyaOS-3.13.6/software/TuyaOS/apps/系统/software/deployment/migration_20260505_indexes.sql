-- ============================================================
-- 数据库迁移：高频查询表加索引（2026-05-05）
-- 配套：UPGRADE_20260505.md
--
-- 适用环境：生产 / staging（synchronize=false 不会自动建索引）
-- 推荐执行时机：业务低峰（如夜间 03:00-05:00）
--
-- 安全性说明：
-- - MySQL 5.7+/8.0 都支持 ALTER TABLE ... ADD INDEX；
-- - 8.0 默认走 ONLINE DDL，对读写阻塞极小；
-- - 5.7 在大表（>1000w 行）上可能锁表，请务必业务低峰执行。
--
-- 幂等性：
-- - 索引名固定（idx_xxx_yyy），重复执行会失败但不会破坏数据；
-- - 使用 INFORMATION_SCHEMA 检测后再执行的「兜底版本」见文末附录。
-- ============================================================

USE qiaoguo_health;

-- ─────────── orders（最高频，订单列表/陪诊员查询/cron 巡检） ───────────
ALTER TABLE orders ADD INDEX idx_orders_user_id (user_id);
ALTER TABLE orders ADD INDEX idx_orders_attendant_id (attendant_id);
ALTER TABLE orders ADD INDEX idx_orders_status_created (status, created_at);
ALTER TABLE orders ADD INDEX idx_orders_service_time (service_time);

-- ─────────── medication_reminders（首页/老人端 onShow 必拉） ───────────
ALTER TABLE medication_reminders ADD INDEX idx_med_user_status_type (user_id, status, reminder_type);
ALTER TABLE medication_reminders ADD INDEX idx_med_order_id (order_id);
ALTER TABLE medication_reminders ADD INDEX idx_med_prescription_id (prescription_id);

-- ─────────── service_targets（健康页/家庭面板/创建订单） ───────────
ALTER TABLE service_targets ADD INDEX idx_st_user_id (user_id);
ALTER TABLE service_targets ADD INDEX idx_st_phone_hash (phone_hash);

-- ─────────── family_members（家庭模块 3 维度反查） ───────────
ALTER TABLE family_members ADD INDEX idx_fm_user_id (user_id);
ALTER TABLE family_members ADD INDEX idx_fm_group_id (family_group_id);
ALTER TABLE family_members ADD INDEX idx_fm_placeholder_phone_hash (placeholder_phone_hash);

-- ─────────── users（手机号反查） ───────────
ALTER TABLE users ADD INDEX idx_users_phone (phone);

-- ============================================================
-- 验证：执行后跑一次确认所有索引就位
-- ============================================================
-- SHOW INDEX FROM orders;
-- SHOW INDEX FROM medication_reminders;
-- SHOW INDEX FROM service_targets;
-- SHOW INDEX FROM family_members;
-- SHOW INDEX FROM users;


-- ============================================================
-- 附录：幂等版本（如果某些索引已存在，本节可平替正文）
-- 适用于「不确定上次执行到哪一步」的回滚 / 重跑场景
-- ============================================================
-- DROP PROCEDURE IF EXISTS qg_add_index_if_missing;
-- DELIMITER $$
-- CREATE PROCEDURE qg_add_index_if_missing(
--   IN p_table VARCHAR(64),
--   IN p_index VARCHAR(64),
--   IN p_columns VARCHAR(255)
-- )
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
--      WHERE TABLE_SCHEMA = DATABASE()
--        AND TABLE_NAME = p_table
--        AND INDEX_NAME = p_index
--   ) THEN
--     SET @stmt = CONCAT('ALTER TABLE ', p_table, ' ADD INDEX ', p_index, ' (', p_columns, ')');
--     PREPARE q FROM @stmt;
--     EXECUTE q;
--     DEALLOCATE PREPARE q;
--   END IF;
-- END$$
-- DELIMITER ;
--
-- CALL qg_add_index_if_missing('orders', 'idx_orders_user_id', 'user_id');
-- CALL qg_add_index_if_missing('orders', 'idx_orders_attendant_id', 'attendant_id');
-- CALL qg_add_index_if_missing('orders', 'idx_orders_status_created', 'status, created_at');
-- CALL qg_add_index_if_missing('orders', 'idx_orders_service_time', 'service_time');
-- CALL qg_add_index_if_missing('medication_reminders', 'idx_med_user_status_type', 'user_id, status, reminder_type');
-- CALL qg_add_index_if_missing('medication_reminders', 'idx_med_order_id', 'order_id');
-- CALL qg_add_index_if_missing('medication_reminders', 'idx_med_prescription_id', 'prescription_id');
-- CALL qg_add_index_if_missing('service_targets', 'idx_st_user_id', 'user_id');
-- CALL qg_add_index_if_missing('service_targets', 'idx_st_phone_hash', 'phone_hash');
-- CALL qg_add_index_if_missing('family_members', 'idx_fm_user_id', 'user_id');
-- CALL qg_add_index_if_missing('family_members', 'idx_fm_group_id', 'family_group_id');
-- CALL qg_add_index_if_missing('family_members', 'idx_fm_placeholder_phone_hash', 'placeholder_phone_hash');
-- CALL qg_add_index_if_missing('users', 'idx_users_phone', 'phone');
--
-- DROP PROCEDURE qg_add_index_if_missing;
