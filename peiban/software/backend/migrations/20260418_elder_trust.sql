-- 迁移说明：老人托管模式
-- 1) family_members 支持"占位老人"（子女代建，老人暂无账号）
--    - user_id 允许为 NULL
--    - 新增 placeholder_name / placeholder_phone_encrypted / placeholder_phone_hash / placeholder_id_card_encrypted
--    - 新增 is_elder 标记
-- 2) service_targets 新增"委托协议"相关字段
--    - is_trust / trust_doc_url / trust_signed_at / delegator_relation / trust_signer_name
--    - phone_hash：用于老人登录时按手机号反向查找（等值查询用的稳定 HMAC）
-- 3) family_groups 新增 assigned_cs_admin_id（专属客服/健康管家指派）
--
-- 所有语句幂等写法，开发环境 TypeORM synchronize 也能兜底。

SET @dbname = DATABASE();

-- ------------------------------------------------------------
-- 1. family_members: user_id 允许为空 + 占位字段
-- ------------------------------------------------------------

-- 先把 user_id 改为可空
SET @col_nullable := (
  SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'user_id'
);
SET @sql := IF(@col_nullable = 'NO',
  'ALTER TABLE family_members MODIFY user_id INT NULL',
  'SELECT ''family_members.user_id already nullable'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- placeholder_name：占位老人姓名（明文，用于后台管理列表展示）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'placeholder_name'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE family_members ADD COLUMN placeholder_name VARCHAR(64) NULL COMMENT ''占位老人姓名（未登录时展示）'' AFTER linked_service_target_id',
  'SELECT ''placeholder_name already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- placeholder_phone_encrypted：占位老人手机号（加密）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'placeholder_phone_encrypted'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE family_members ADD COLUMN placeholder_phone_encrypted VARCHAR(255) NULL COMMENT ''占位老人手机号（列加密）'' AFTER placeholder_name',
  'SELECT ''placeholder_phone_encrypted already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- placeholder_phone_hash：占位手机号 HMAC（用于等值查询/登录自动认领）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'placeholder_phone_hash'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE family_members ADD COLUMN placeholder_phone_hash VARCHAR(64) NULL COMMENT ''占位手机号 HMAC（登录匹配）'' AFTER placeholder_phone_encrypted',
  'SELECT ''placeholder_phone_hash already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- placeholder_id_card_encrypted：占位老人身份证（加密，可选）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'placeholder_id_card_encrypted'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE family_members ADD COLUMN placeholder_id_card_encrypted VARCHAR(512) NULL COMMENT ''占位老人身份证（加密）'' AFTER placeholder_phone_hash',
  'SELECT ''placeholder_id_card_encrypted already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_elder：是否为老人（大字体单屏端用户）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND COLUMN_NAME = 'is_elder'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE family_members ADD COLUMN is_elder TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否为被照护老人'' AFTER placeholder_id_card_encrypted',
  'SELECT ''is_elder already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 为 placeholder_phone_hash 加索引，加速登录匹配
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_members' AND INDEX_NAME = 'idx_family_members_placeholder_phone_hash'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_family_members_placeholder_phone_hash ON family_members(placeholder_phone_hash)',
  'SELECT ''idx_family_members_placeholder_phone_hash already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. service_targets: 委托协议 + phone_hash
-- ------------------------------------------------------------

-- is_trust：是否已由子女签署委托协议
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'is_trust'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN is_trust TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否已签署托管/委托协议'' AFTER signature_url',
  'SELECT ''is_trust already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trust_doc_url：委托协议文档 URL
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'trust_doc_url'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN trust_doc_url VARCHAR(512) NULL COMMENT ''委托协议 HTML/PDF 文档 URL'' AFTER is_trust',
  'SELECT ''trust_doc_url already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trust_signed_at：委托协议签署时间
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'trust_signed_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN trust_signed_at DATETIME NULL COMMENT ''委托协议签署时间'' AFTER trust_doc_url',
  'SELECT ''trust_signed_at already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- delegator_relation：创建者身份（self=本人, child=子女, spouse=配偶, other=其他）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'delegator_relation'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN delegator_relation VARCHAR(32) NULL COMMENT ''创建者身份：self/child/spouse/other'' AFTER trust_signed_at',
  'SELECT ''delegator_relation already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trust_signer_name：代签人姓名（子女本人）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'trust_signer_name'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN trust_signer_name VARCHAR(64) NULL COMMENT ''委托协议签署人姓名'' AFTER delegator_relation',
  'SELECT ''trust_signer_name already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone_hash：老人手机号 HMAC（登录时等值查询用）
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND COLUMN_NAME = 'phone_hash'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE service_targets ADD COLUMN phone_hash VARCHAR(64) NULL COMMENT ''手机号 HMAC（等值查询）'' AFTER trust_signer_name',
  'SELECT ''phone_hash already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_targets' AND INDEX_NAME = 'idx_service_targets_phone_hash'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_service_targets_phone_hash ON service_targets(phone_hash)',
  'SELECT ''idx_service_targets_phone_hash already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3. family_groups: 专属客服/健康管家
-- ------------------------------------------------------------

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_groups' AND COLUMN_NAME = 'assigned_cs_admin_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE family_groups ADD COLUMN assigned_cs_admin_id INT NULL COMMENT ''专属客服 admin_user_id'' AFTER created_by',
  'SELECT ''assigned_cs_admin_id already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'family_groups' AND INDEX_NAME = 'idx_family_groups_assigned_cs'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_family_groups_assigned_cs ON family_groups(assigned_cs_admin_id)',
  'SELECT ''idx_family_groups_assigned_cs already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
