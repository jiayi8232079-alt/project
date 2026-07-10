-- 迁移说明：用药提醒"严格模式"升级
--
-- 背景（见 PRD 严格用药提醒章节）：
--   原系统的用药提醒只有"到点推送 + 7 天依从率预警"，
--   单次漏服静默 120 分钟才标 missed、且不会立即升级通知任何人，
--   对抗凝 / 精神类 / 胰岛素等高风险药严重不安全。
--
-- 本迁移新增 3 张表 + 扩展 medication_reminders，支持：
--   1) 处方批次录入（一张处方多种药一次建）
--   2) 药品严重度分级 + 漏服升级策略可配
--   3) 每次修改留 audit
--   4) 物化的推送任务队列（失败重试 / 渠道降级 / 后台可视化）
--
-- 幂等：全部 CREATE TABLE IF NOT EXISTS + 动态 ADD COLUMN IF NOT EXISTS（通过 information_schema 兜底），
-- 可重复执行。开发环境 TypeORM synchronize=true 会自动建表，生产请手动执行一次本文件。

-- ============================================================
-- 1. medication_prescriptions：处方批次
-- ============================================================
CREATE TABLE IF NOT EXISTS medication_prescriptions (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '处方归属用户（通常是家属）',
  service_target_id INT NULL COMMENT '实际服药的服务对象（老人），null 表示 user 本人',
  order_id INT NULL COMMENT '来源陪诊订单（可选）',
  source_image VARCHAR(512) NULL COMMENT '处方原件照片 URL，便于复核',
  hospital VARCHAR(128) NULL COMMENT '开方医院',
  doctor_name VARCHAR(64) NULL COMMENT '开方医生',
  department VARCHAR(64) NULL COMMENT '开方科室',
  issued_date DATE NULL COMMENT '开方日期',
  note TEXT NULL COMMENT '处方备注：注意事项、饮食禁忌等',
  created_by INT NULL COMMENT '录入者 admin_user_id，null=用户自助',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_med_presc_user_target (user_id, service_target_id),
  KEY IDX_med_presc_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='处方批次：一张处方可挂多种药，作为 reminders 的聚合容器';

-- ============================================================
-- 2. medication_reminder_audits：用药提醒审计日志
-- ============================================================
CREATE TABLE IF NOT EXISTS medication_reminder_audits (
  id INT NOT NULL AUTO_INCREMENT,
  reminder_id INT NOT NULL,
  actor_type ENUM('admin','user','system') NOT NULL DEFAULT 'system' COMMENT '操作方身份',
  actor_id INT NULL COMMENT 'admin_user_id 或 user_id',
  actor_name VARCHAR(64) NULL COMMENT '操作方显示名快照',
  action ENUM('create','update','pause','resume','complete','cancel','delete') NOT NULL COMMENT '动作',
  diff_json JSON NULL COMMENT '字段变更 diff：{ field: { from, to } }',
  note TEXT NULL COMMENT '备注 / 原因说明',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_med_audit_reminder_time (reminder_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用药提醒审计日志：每次改动都留 diff 便于事故回溯';

-- ============================================================
-- 3. medication_notification_jobs：推送任务队列
-- ============================================================
CREATE TABLE IF NOT EXISTS medication_notification_jobs (
  id INT NOT NULL AUTO_INCREMENT,
  reminder_id INT NOT NULL,
  execution_log_id INT NULL COMMENT '关联某次打卡（升级链任务一定有）',
  kind ENUM(
    'first_push','miss_1st','miss_2nd',
    'escalate_family','escalate_admin','family_digest','follow_up'
  ) NOT NULL COMMENT '任务类型，决定文案与升级策略',
  channel ENUM('mini_program','sms','voice_call','in_app') NOT NULL COMMENT '发送渠道',
  target_kind ENUM('service_target','user','guardian','admin') NOT NULL COMMENT '目标身份',
  target_user_id INT NULL COMMENT '目标用户 ID',
  target_phone VARCHAR(20) NULL COMMENT 'SMS / 电话时使用',
  target_openid VARCHAR(128) NULL COMMENT 'mini_program 时使用',
  payload JSON NULL COMMENT '渠道特定 payload 快照（模板 ID / 变量 / 跳转等）',
  status ENUM(
    'pending','sending','retrying','success','dead','cancelled'
  ) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at DATETIME NOT NULL COMMENT '应执行时间',
  next_attempt_at DATETIME NOT NULL COMMENT '下一次 worker 处理时间',
  sent_at DATETIME NULL COMMENT '最后一次实际发送时间',
  responded_at DATETIME NULL COMMENT '渠道回执时间',
  provider_ref VARCHAR(128) NULL COMMENT '渠道流水号（腾讯云 SerialNo / 微信 msgid）',
  last_error VARCHAR(512) NULL COMMENT '最后一次失败原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_med_job_status_next (status, next_attempt_at),
  KEY IDX_med_job_reminder_kind (reminder_id, kind),
  KEY IDX_med_job_scheduled (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用药/复诊推送任务队列：失败重试 + 渠道降级 + 升级链物化';

-- ============================================================
-- 4. medication_reminders 扩展字段
-- ------------------------------------------------------------
--    幂等做法：通过 INFORMATION_SCHEMA 判断列是否已存在，
--    不存在才 ALTER，已存在直接跳过。可重复执行。
-- ============================================================
-- 4.1 prescription_id
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'prescription_id'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN prescription_id INT NULL COMMENT "来源处方批次" AFTER order_id, ADD INDEX IDX_med_reminder_prescription (prescription_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.2 severity
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'severity'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN severity ENUM("high","medium","low") NOT NULL DEFAULT "medium" COMMENT "药品严重度分级" AFTER reminder_type',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.3 dose_per_time
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'dose_per_time'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN dose_per_time DECIMAL(6,2) NULL COMMENT "每次用量数值" AFTER dosage',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.4 times_per_day
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'times_per_day'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN times_per_day TINYINT NULL COMMENT "每日频次" AFTER dose_per_time',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.5 total_quantity
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'total_quantity'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN total_quantity INT NULL COMMENT "总药量" AFTER times_per_day',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.6 unit
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'unit'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN unit VARCHAR(16) NULL COMMENT "单位：片/粒/瓶/支/ml" AFTER total_quantity',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.7 miss_escalation_override
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_reminders' AND COLUMN_NAME = 'miss_escalation_override'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE medication_reminders ADD COLUMN miss_escalation_override JSON NULL COMMENT "漏服升级策略覆盖" AFTER channel',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 5. system_configs：预置"严格用药"相关配置键
-- ============================================================
INSERT IGNORE INTO system_configs (`key`, `value`, `description`, `created_at`, `updated_at`) VALUES
  ('medication_escalation_high_first_min',      '15',  '【严格用药】HIGH 药到点后首次追推分钟数', NOW(), NOW()),
  ('medication_escalation_high_missed_min',     '30',  '【严格用药】HIGH 药到点后标 missed 分钟数', NOW(), NOW()),
  ('medication_escalation_high_admin_min',      '60',  '【严格用药】HIGH 药升级管理员分钟数（自到点）', NOW(), NOW()),
  ('medication_escalation_medium_first_min',    '30',  '【严格用药】MEDIUM 药到点后首次追推分钟数', NOW(), NOW()),
  ('medication_escalation_medium_missed_min',   '60',  '【严格用药】MEDIUM 药到点后标 missed 分钟数', NOW(), NOW()),
  ('medication_escalation_medium_admin_min',    '120', '【严格用药】MEDIUM 药升级管理员分钟数（自到点）', NOW(), NOW()),
  ('medication_escalation_low_first_min',       '60',  '【严格用药】LOW 药到点后首次追推分钟数', NOW(), NOW()),
  ('medication_escalation_low_missed_min',      '120', '【严格用药】LOW 药到点后标 missed 分钟数', NOW(), NOW()),
  ('medication_escalation_low_admin_enabled',   'false','【严格用药】LOW 药是否升级管理员（true/false）', NOW(), NOW()),
  ('medication_notification_worker_enabled',    'true','【严格用药】推送任务 worker 开关', NOW(), NOW()),
  ('medication_notification_worker_batch',      '50',  '【严格用药】worker 单次扫描最大任务数', NOW(), NOW()),
  ('medication_family_digest_enabled',          'true','【严格用药】家属每日 20:00 汇总开关', NOW(), NOW()),
  ('medication_family_digest_hour',             '20',  '【严格用药】家属每日汇总推送小时（0-23）', NOW(), NOW());
