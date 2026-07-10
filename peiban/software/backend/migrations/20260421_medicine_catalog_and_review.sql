-- 迁移说明：药品库 + 处方审核流
--
-- 1) 新建 medicine_catalog：药品字典表，陪诊员/运营录入处方时联想 + 默认带严重度
-- 2) medication_prescriptions 加 review_status / items_draft / reviewer_* 字段
-- 3) 预置少量常见药样本（可由运营在后台补全）
--
-- 全部幂等，可重复执行。

-- ============================================================
-- 1. medicine_catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS medicine_catalog (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL COMMENT '商品名/主名',
  generic_name VARCHAR(128) NULL COMMENT '通用名/学名',
  specification VARCHAR(128) NULL COMMENT '常见规格',
  severity ENUM('high','medium','low') NOT NULL DEFAULT 'medium' COMMENT '默认严重度',
  category VARCHAR(64) NULL COMMENT '分类：抗凝/降压/抗抑郁/维生素 等',
  default_times_per_day TINYINT NULL,
  default_dose_per_time DECIMAL(6,2) NULL,
  default_unit VARCHAR(16) NULL,
  default_instructions VARCHAR(255) NULL,
  warning_keywords JSON NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_medicine_name (name),
  KEY IDX_medicine_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='药品常用库，录入联想 + 默认严重度';

-- ============================================================
-- 2. medication_prescriptions 扩展字段
-- ============================================================
-- review_status
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'review_status');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN review_status ENUM("approved","pending_review","rejected") NOT NULL DEFAULT "approved" COMMENT "审核状态"',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- submitted_by_user_id
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'submitted_by_user_id');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN submitted_by_user_id INT NULL COMMENT "提交方 user_id"',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- submitted_by_role
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'submitted_by_role');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN submitted_by_role VARCHAR(32) NULL COMMENT "提交方角色"',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- items_draft
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'items_draft');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN items_draft JSON NULL COMMENT "陪诊员草稿"',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewer_id
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'reviewer_id');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN reviewer_id INT NULL COMMENT "审核人 admin_user_id"',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewed_at
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'reviewed_at');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN reviewed_at DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- review_note
SET @exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medication_prescriptions'
    AND COLUMN_NAME = 'review_note');
SET @sql := IF(@exists = 0,
  'ALTER TABLE medication_prescriptions ADD COLUMN review_note VARCHAR(512) NULL COMMENT "审核备注/驳回原因"',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. system_configs：处方 OCR + 语音电话 渠道的默认键
-- ============================================================
INSERT IGNORE INTO system_configs (`key`, `value`, `description`, `created_at`, `updated_at`) VALUES
  ('prescription_ocr_enabled',   'false',    '【处方 OCR】总开关，配齐秘钥后改 true', NOW(), NOW()),
  ('prescription_ocr_provider',  'disabled', '【处方 OCR】provider：tencent/baidu/disabled', NOW(), NOW()),
  ('prescription_ocr_secret_id', '',         '【处方 OCR】provider SecretId', NOW(), NOW()),
  ('prescription_ocr_secret_key','',         '【处方 OCR】provider SecretKey', NOW(), NOW()),
  ('prescription_ocr_region',    'ap-guangzhou', '【处方 OCR】Region', NOW(), NOW()),
  ('voice_call_enabled',         'false',    '【语音电话】总开关', NOW(), NOW()),
  ('voice_call_provider',        'stub',     '【语音电话】provider：tencent/aliyun/stub', NOW(), NOW()),
  ('voice_call_secret_id',       '',         '【语音电话】provider SecretId', NOW(), NOW()),
  ('voice_call_secret_key',      '',         '【语音电话】provider SecretKey', NOW(), NOW()),
  ('voice_call_template_id',     '',         '【语音电话】模板 ID', NOW(), NOW()),
  ('voice_call_sign_name',       '',         '【语音电话】呼叫签名', NOW(), NOW());

-- ============================================================
-- 4. 预置少量常见药（运营可在后台补全和修改）
-- ============================================================
INSERT IGNORE INTO medicine_catalog
  (name, generic_name, specification, severity, category,
   default_times_per_day, default_dose_per_time, default_unit, default_instructions, enabled)
VALUES
  ('波立维', '氯吡格雷', '75mg × 7 片/盒', 'high', '抗凝/抗血小板', 1, 1, '片', '餐后口服', 1),
  ('拜阿司匹林', '阿司匹林肠溶片', '100mg × 30 片/盒', 'high', '抗凝/抗血小板', 1, 1, '片', '餐后口服', 1),
  ('华法林钠片', '华法林', '3mg × 20 片/盒', 'high', '抗凝', 1, 1, '片', '固定时间服用', 1),
  ('敏使朗', '倍他司汀', '6mg × 100 片/瓶', 'medium', '眩晕/循环', 3, 1, '片', '餐后口服', 1),
  ('奇比特', '丁螺环酮', '5mg × 40 片/盒', 'high', '抗焦虑/精神类', 2, 2, '片', '餐后口服，禁酒', 1),
  ('苯甲酸氟伏沙明', '氟伏沙明', '50mg × 30 片/盒', 'high', '抗抑郁 SSRI', 1, 1, '片', '晚饭后服用', 1),
  ('二甲双胍', '二甲双胍', '500mg × 60 片/盒', 'medium', '降糖', 2, 1, '片', '餐中服用', 1),
  ('苯磺酸氨氯地平', '氨氯地平', '5mg × 7 片/盒', 'medium', '降压', 1, 1, '片', '晨起服用', 1),
  ('瑞舒伐他汀钙片', '瑞舒伐他汀', '10mg × 7 片/盒', 'medium', '降脂', 1, 1, '片', '晚饭后服用', 1),
  ('复合维生素B', '复合维生素B', '60 片/瓶', 'low', '维生素', 1, 1, '片', '餐后服用', 1);
