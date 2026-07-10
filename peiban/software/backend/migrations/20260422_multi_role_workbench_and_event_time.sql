-- 迁移说明：补齐 entity 已有、仓库缺少的 2 处列变更
--
-- 背景：
--   1) attendants 表多角色工作台（primary_role / professional_roles /
--      specialties / certifications / experience_years / title + 索引），
--      之前在开发环境靠 DB_SYNCHRONIZE=true 自动 ALTER，线上是手动补齐，
--      但仓库一直没把这段 ALTER 沉淀成 SQL；空库部署或其他环境部署会缺列。
--   2) service_timelines.event_time：总管理员后台「服务时间线」补录/修正
--      业务时间的字段，entity 已落 4 月 21 号，SQL 同样遗漏。
--
-- 幂等：全部通过 INFORMATION_SCHEMA 判定列是否已存在再 ALTER。
-- 已执行过的环境重复跑本文件都是 no-op，不会破坏老数据。

-- ============================================================
-- 1. attendants：多角色工作台 6 列
-- ============================================================

-- 1.1 primary_role
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND COLUMN_NAME = 'primary_role'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD COLUMN primary_role ENUM("attendant","nutritionist","rehabilitator","nurse","caregiver","maternal_care","psychologist") NOT NULL DEFAULT "attendant" COMMENT "主要专业角色（工作台变装依据）"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 professional_roles
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND COLUMN_NAME = 'professional_roles'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD COLUMN professional_roles TEXT NULL COMMENT "具备的所有角色（ServiceStaffRole[] JSON）"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.3 specialties
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND COLUMN_NAME = 'specialties'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD COLUMN specialties TEXT NULL COMMENT "专长标签（string[] JSON）"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.4 certifications
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND COLUMN_NAME = 'certifications'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD COLUMN certifications JSON NULL COMMENT "执业相关证书清单（StaffCertification[]）"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.5 experience_years
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND COLUMN_NAME = 'experience_years'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD COLUMN experience_years TINYINT NOT NULL DEFAULT 0 COMMENT "服务年限（展示用）"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.6 title
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND COLUMN_NAME = 'title'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD COLUMN title VARCHAR(64) NULL COMMENT "对外展示头衔，不填走 primaryRole 默认"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.7 IDX_attendants_primary_role 索引
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendants' AND INDEX_NAME = 'IDX_attendants_primary_role'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE attendants ADD INDEX IDX_attendants_primary_role (primary_role)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. service_timelines.event_time
-- ============================================================
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_timelines' AND COLUMN_NAME = 'event_time'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE service_timelines ADD COLUMN event_time DATETIME NULL COMMENT "节点业务发生时间，空则回退 created_at；仅允许修改内容型节点"',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
