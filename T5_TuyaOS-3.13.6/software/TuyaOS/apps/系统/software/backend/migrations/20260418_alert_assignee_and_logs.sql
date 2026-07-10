-- 迁移说明：
-- 1) 健康告警加上「指派」字段，以便把告警分派给特定客服/健康管家跟进。
-- 2) 新增 alert_logs 表，记录每条告警从创建 → 指派 → 跟进 → 确认 → 关闭的完整时间线。
--
-- 开发环境 TypeORM synchronize=true 时会自动 ALTER；生产环境请手动执行一次本文件。
-- 所有语句均为幂等写法（IF NOT EXISTS / INFORMATION_SCHEMA 判定）。

-- ------------------------------------------------------------
-- 1. health_alerts 表：新增 assignee_id / assigned_by / assigned_at
-- ------------------------------------------------------------
SET @dbname = DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'health_alerts' AND COLUMN_NAME = 'assignee_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE health_alerts ADD COLUMN assignee_id INT NULL COMMENT ''指派到的 admin_user_id（客服/健康管家）'' AFTER closed_by',
  'SELECT ''column assignee_id already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'health_alerts' AND COLUMN_NAME = 'assigned_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE health_alerts ADD COLUMN assigned_by INT NULL COMMENT ''指派操作者 admin_user_id'' AFTER assignee_id',
  'SELECT ''column assigned_by already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'health_alerts' AND COLUMN_NAME = 'assigned_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE health_alerts ADD COLUMN assigned_at DATETIME NULL AFTER assigned_by',
  'SELECT ''column assigned_at already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 为 assignee_id 加索引，便于"我的待办"列表查询
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'health_alerts' AND INDEX_NAME = 'idx_health_alerts_assignee'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_health_alerts_assignee ON health_alerts(assignee_id, status)',
  'SELECT ''index idx_health_alerts_assignee already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. alert_logs 表：告警处理时间线
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_logs (
  id INT NOT NULL AUTO_INCREMENT,
  alert_id INT NOT NULL COMMENT '所属告警 ID',
  actor_type ENUM('admin', 'user', 'system') NOT NULL DEFAULT 'system' COMMENT '触发者身份',
  actor_id INT NULL COMMENT 'admin_user_id 或 user_id',
  actor_name VARCHAR(64) NULL COMMENT '触发者显示名快照',
  action ENUM('create', 'assign', 'comment', 'acknowledge', 'close', 'reopen', 'notify') NOT NULL COMMENT '动作类型',
  note TEXT NULL COMMENT '跟进文字 / 备注',
  payload JSON NULL COMMENT '结构化扩展字段',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_alert_logs_alert_created (alert_id, created_at),
  CONSTRAINT fk_alert_logs_alert_id FOREIGN KEY (alert_id) REFERENCES health_alerts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='健康告警处理日志';
