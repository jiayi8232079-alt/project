-- ============================================================
-- 数据库迁移：多租户 v1（Wave1 地基）—— 2026-06-03
-- 配套：PRD_陪护机器人二次开发.md §13、§9
--
-- 适用环境：生产 / staging（synchronize=false 不会自动建表/加列）
-- 推荐执行时机：业务低峰；本次涉及 ALTER TABLE 加列 + 建 5 张新表
--
-- 改动内容：
--   1) 新建 5 张租户底座表：tenants / tenant_users / tenant_roles
--      / tenant_permissions / tenant_role_permissions
--   2) 给 33 张业务表加 `tenant_id INT NOT NULL DEFAULT 1`（默认归属平台租户）
--   3) 给每张 tenant_id 列建索引 idx_<table>_tenant
--   4) 写入默认平台租户 tenant_id=1 + 5 个内置角色 + 12 个全局权限点
--
-- 安全性说明：
-- - MySQL 8.0 走 ONLINE DDL，对读写阻塞极小；
-- - 不加外键约束（应用层 TenantSubscriber 已保证写入正确）；
-- - 列默认值=1 → 老业务数据原地兼容（单租户模式）。
--
-- 幂等性：
-- - 主体语句直接 CREATE/ALTER，重复执行会因「重复列/重复表」失败；
-- - 末尾附「幂等执行包装」procedure，重跑场景可用之改写。
--
-- 回滚指引（紧急情况）：
--   见文末「ROLLBACK」章节：DROP 5 张新表 + ALTER 33 张业务表删 tenant_id 列。
-- ============================================================

USE qiaoguo_health;

-- ─────────────────────────────────────────────
-- ① 创建 5 张租户底座表
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id              INT NOT NULL AUTO_INCREMENT,
  code            VARCHAR(64)  NOT NULL COMMENT '租户唯一编码（用于二级域名/白标）',
  name            VARCHAR(128) NOT NULL COMMENT '租户显示名称',
  type            ENUM('platform','community','enterprise','personal') NOT NULL DEFAULT 'platform' COMMENT '租户类型',
  status          ENUM('active','suspended','disabled','pending') NOT NULL DEFAULT 'active' COMMENT '生命周期状态',
  data_center     VARCHAR(32) NOT NULL DEFAULT 'cn-east-1' COMMENT '所属数据中心（须与涂鸦云一致）',
  parent_id       INT NULL COMMENT '父租户 ID（机构集团 → 分院）',
  contact_name    VARCHAR(64)  NULL COMMENT '主联系人',
  contact_phone   VARCHAR(32)  NULL COMMENT '主联系人电话',
  settings        JSON         NULL COMMENT '白标/配额/功能开关',
  created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenants_code (code),
  KEY idx_tenants_type   (type),
  KEY idx_tenants_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='多租户主表';

CREATE TABLE IF NOT EXISTS tenant_roles (
  id            INT NOT NULL AUTO_INCREMENT,
  tenant_id     INT NULL COMMENT 'null = 平台预置角色（全租户共享）',
  code          VARCHAR(64)  NOT NULL COMMENT '角色编码（同租户内唯一）',
  name          VARCHAR(64)  NOT NULL COMMENT '角色显示名',
  description   TEXT NULL,
  is_builtin    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=内置角色不可改名/删除',
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_roles_tenant_code (tenant_id, code),
  KEY idx_tenant_roles_builtin (is_builtin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户内角色定义';

CREATE TABLE IF NOT EXISTS tenant_permissions (
  id            INT NOT NULL AUTO_INCREMENT,
  code          VARCHAR(64)  NOT NULL COMMENT '权限编码，格式 resource:action',
  resource      VARCHAR(64)  NOT NULL,
  action        VARCHAR(32)  NOT NULL,
  name          VARCHAR(128) NOT NULL,
  description   TEXT NULL,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_permissions_code (code),
  KEY idx_tenant_permissions_resource (resource)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局权限点字典';

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_trp_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色↔权限点多对多';

CREATE TABLE IF NOT EXISTS tenant_users (
  id          INT NOT NULL AUTO_INCREMENT,
  tenant_id   INT NOT NULL,
  user_id     INT NOT NULL COMMENT '关联 users.id',
  role_id     INT NULL COMMENT '关联 tenant_roles.id；NULL 用 users.role 内置枚举',
  is_owner    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=租户管理员',
  status      ENUM('active','invited','disabled') NOT NULL DEFAULT 'active',
  joined_at   DATETIME(6) NULL,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_users_tenant_user (tenant_id, user_id),
  KEY idx_tenant_users_user (user_id),
  KEY idx_tenant_users_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户↔用户↔角色关系';

-- ─────────────────────────────────────────────
-- ② 写入默认平台租户 + 5 个内置角色 + 12 个权限点
--    应用启动时 TenantModule.onApplicationBootstrap 也会幂等补齐
--    这里先在 SQL 层落库，让其它表的 DEFAULT 1 有所指
-- ─────────────────────────────────────────────

INSERT INTO tenants (id, code, name, type, status, data_center)
VALUES (1, 'default', '陪了个伴默认租户', 'platform', 'active', 'cn-east-1')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO tenant_roles (tenant_id, code, name, description, is_builtin) VALUES
  (NULL, 'owner',              '租户管理员', '租户内最高权限，可改账号/计费/关停（平台预置）', 1),
  (NULL, 'operator',            '运营',       '日常运营、订单调度（平台预置）',                       1),
  (NULL, 'finance',             '财务',       '结算、对账、发票（平台预置）',                         1),
  (NULL, 'customer_service',    '客服',       '工单、投诉、回访（平台预置）',                         1),
  (NULL, 'medical_consultant',  '医疗顾问',   'AI 对话审核、用药复核（平台预置）',                    1),
  (1,    'owner',              '租户管理员', '租户内最高权限，可改账号/计费/关停', 1),
  (1,    'operator',            '运营',       '日常运营、订单调度',                       1),
  (1,    'finance',             '财务',       '结算、对账、发票',                         1),
  (1,    'customer_service',    '客服',       '工单、投诉、回访',                         1),
  (1,    'medical_consultant',  '医疗顾问',   'AI 对话审核、用药复核',                    1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO tenant_permissions (code, resource, action, name, description) VALUES
  ('tenant:read',     'tenant',  'read',     '查看租户',   '查看本租户基础信息'),
  ('tenant:update',   'tenant',  'update',   '编辑租户',   '编辑租户基础配置'),
  ('tenant:member',   'tenant',  'member',   '成员管理',   '邀请/移除/调整成员角色'),
  ('device:read',     'device',  'read',     '查看设备',   '设备列表/状态/事件'),
  ('device:bind',     'device',  'bind',     '设备绑定',   '激活/绑定服务对象'),
  ('device:control',  'device',  'control',  '设备控制',   '远程指令/OTA'),
  ('ai:dialog',       'ai',      'dialog',   'AI 对话',    '允许触发 AI 对话与查档案'),
  ('ai:audit',        'ai',      'audit',    'AI 审核',    '查看 AI 对话留存与质检'),
  ('alert:read',      'alert',   'read',     '查看告警',   '查看跌倒/SOS/紧急告警'),
  ('alert:handle',    'alert',   'handle',   '处理告警',   '确认告警/派单/出警'),
  ('billing:read',    'billing', 'read',     '查看账单',   '查看订阅与用量'),
  ('billing:manage',  'billing', 'manage',   '管理订阅',   '续费/退订/分账')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ─────────────────────────────────────────────
-- ③ 给 33 张业务表加 tenant_id 列 + 单列索引
--    所有列默认 1，老数据自动归属默认租户
-- ─────────────────────────────────────────────

-- A. 28 个继承 TenantAwareEntity 的业务表 ───────────────
ALTER TABLE users                       ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_users_tenant (tenant_id);
ALTER TABLE service_targets             ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_service_targets_tenant (tenant_id);
ALTER TABLE orders                      ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_orders_tenant (tenant_id);
ALTER TABLE order_service_plans         ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_order_service_plans_tenant (tenant_id);
ALTER TABLE service_plan_templates      ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_service_plan_templates_tenant (tenant_id);
ALTER TABLE attendants                  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_attendants_tenant (tenant_id);
ALTER TABLE family_groups               ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_family_groups_tenant (tenant_id);
ALTER TABLE family_members              ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_family_members_tenant (tenant_id);
ALTER TABLE medication_reminders        ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_medication_reminders_tenant (tenant_id);
ALTER TABLE medication_execution_logs   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_med_exec_logs_tenant (tenant_id);
ALTER TABLE medication_prescriptions    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_med_prescriptions_tenant (tenant_id);
ALTER TABLE health_alerts               ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_health_alerts_tenant (tenant_id);
ALTER TABLE alert_rules                 ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_alert_rules_tenant (tenant_id);
ALTER TABLE alert_logs                  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_alert_logs_tenant (tenant_id);
ALTER TABLE triage_sessions             ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_triage_sessions_tenant (tenant_id);
ALTER TABLE triage_session_messages     ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_triage_session_msgs_tenant (tenant_id);
ALTER TABLE triage_feedbacks            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_triage_feedbacks_tenant (tenant_id);
ALTER TABLE prescription_risk_reports   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_pres_risk_reports_tenant (tenant_id);
ALTER TABLE medication_reminder_audits  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_med_remind_audits_tenant (tenant_id);
ALTER TABLE health_weekly_reports       ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_health_weekly_reports_tenant (tenant_id);
ALTER TABLE ai_consultations            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_ai_consultations_tenant (tenant_id);
ALTER TABLE complaints                  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_complaints_tenant (tenant_id);
ALTER TABLE consultations               ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_consultations_tenant (tenant_id);
ALTER TABLE finance_records             ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_finance_records_tenant (tenant_id);
ALTER TABLE membership_card_types       ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_membership_card_types_tenant (tenant_id);
ALTER TABLE membership_levels           ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_membership_levels_tenant (tenant_id);
ALTER TABLE user_memberships            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_user_memberships_tenant (tenant_id);
ALTER TABLE professional_services       ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_professional_services_tenant (tenant_id);

-- B. 5 个手动加 tenantId 的特殊业务表（无 BaseEntity 继承） ───────────────
ALTER TABLE documents          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_documents_tenant (tenant_id);
ALTER TABLE schedules          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_schedules_tenant (tenant_id);
ALTER TABLE reviews            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_reviews_tenant (tenant_id);
ALTER TABLE service_timelines  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_service_timelines_tenant (tenant_id);
ALTER TABLE audit_logs         ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户' AFTER id, ADD INDEX idx_audit_logs_tenant_created (tenant_id, created_at);

-- ─────────────────────────────────────────────
-- ④ 验证（手动跑一遍确认列就位）
-- ─────────────────────────────────────────────
-- SELECT COUNT(*) AS tenant_count FROM tenants;
-- SELECT COUNT(*) AS role_count   FROM tenant_roles WHERE is_builtin = 1;
-- SELECT COUNT(*) AS perm_count   FROM tenant_permissions;
-- SHOW COLUMNS FROM users LIKE 'tenant_id';
-- SHOW COLUMNS FROM orders LIKE 'tenant_id';

-- ============================================================
-- ROLLBACK（紧急回滚）
-- ============================================================
-- ALTER TABLE users                       DROP INDEX idx_users_tenant,                  DROP COLUMN tenant_id;
-- ALTER TABLE service_targets             DROP INDEX idx_service_targets_tenant,        DROP COLUMN tenant_id;
-- ALTER TABLE orders                      DROP INDEX idx_orders_tenant,                 DROP COLUMN tenant_id;
-- ALTER TABLE order_service_plans         DROP INDEX idx_order_service_plans_tenant,    DROP COLUMN tenant_id;
-- ALTER TABLE service_plan_templates      DROP INDEX idx_service_plan_templates_tenant, DROP COLUMN tenant_id;
-- ALTER TABLE attendants                  DROP INDEX idx_attendants_tenant,             DROP COLUMN tenant_id;
-- ALTER TABLE family_groups               DROP INDEX idx_family_groups_tenant,          DROP COLUMN tenant_id;
-- ALTER TABLE family_members              DROP INDEX idx_family_members_tenant,         DROP COLUMN tenant_id;
-- ALTER TABLE medication_reminders        DROP INDEX idx_medication_reminders_tenant,   DROP COLUMN tenant_id;
-- ALTER TABLE medication_execution_logs   DROP INDEX idx_med_exec_logs_tenant,          DROP COLUMN tenant_id;
-- ALTER TABLE medication_prescriptions    DROP INDEX idx_med_prescriptions_tenant,      DROP COLUMN tenant_id;
-- ALTER TABLE health_alerts               DROP INDEX idx_health_alerts_tenant,          DROP COLUMN tenant_id;
-- ALTER TABLE alert_rules                 DROP INDEX idx_alert_rules_tenant,            DROP COLUMN tenant_id;
-- ALTER TABLE alert_logs                  DROP INDEX idx_alert_logs_tenant,             DROP COLUMN tenant_id;
-- ALTER TABLE triage_sessions             DROP INDEX idx_triage_sessions_tenant,        DROP COLUMN tenant_id;
-- ALTER TABLE triage_session_messages     DROP INDEX idx_triage_session_msgs_tenant,    DROP COLUMN tenant_id;
-- ALTER TABLE triage_feedbacks            DROP INDEX idx_triage_feedbacks_tenant,       DROP COLUMN tenant_id;
-- ALTER TABLE prescription_risk_reports   DROP INDEX idx_pres_risk_reports_tenant,      DROP COLUMN tenant_id;
-- ALTER TABLE medication_reminder_audits  DROP INDEX idx_med_remind_audits_tenant,      DROP COLUMN tenant_id;
-- ALTER TABLE health_weekly_reports       DROP INDEX idx_health_weekly_reports_tenant,  DROP COLUMN tenant_id;
-- ALTER TABLE ai_consultations            DROP INDEX idx_ai_consultations_tenant,       DROP COLUMN tenant_id;
-- ALTER TABLE complaints                  DROP INDEX idx_complaints_tenant,             DROP COLUMN tenant_id;
-- ALTER TABLE consultations               DROP INDEX idx_consultations_tenant,          DROP COLUMN tenant_id;
-- ALTER TABLE finance_records             DROP INDEX idx_finance_records_tenant,        DROP COLUMN tenant_id;
-- ALTER TABLE membership_card_types       DROP INDEX idx_membership_card_types_tenant,  DROP COLUMN tenant_id;
-- ALTER TABLE membership_levels           DROP INDEX idx_membership_levels_tenant,      DROP COLUMN tenant_id;
-- ALTER TABLE user_memberships            DROP INDEX idx_user_memberships_tenant,       DROP COLUMN tenant_id;
-- ALTER TABLE professional_services       DROP INDEX idx_professional_services_tenant,  DROP COLUMN tenant_id;
-- ALTER TABLE documents          DROP INDEX idx_documents_tenant,         DROP COLUMN tenant_id;
-- ALTER TABLE schedules          DROP INDEX idx_schedules_tenant,         DROP COLUMN tenant_id;
-- ALTER TABLE reviews            DROP INDEX idx_reviews_tenant,           DROP COLUMN tenant_id;
-- ALTER TABLE service_timelines  DROP INDEX idx_service_timelines_tenant, DROP COLUMN tenant_id;
-- ALTER TABLE audit_logs         DROP INDEX idx_audit_logs_tenant_created,DROP COLUMN tenant_id;
-- DROP TABLE IF EXISTS tenant_role_permissions;
-- DROP TABLE IF EXISTS tenant_users;
-- DROP TABLE IF EXISTS tenant_permissions;
-- DROP TABLE IF EXISTS tenant_roles;
-- DROP TABLE IF EXISTS tenants;

-- ============================================================
-- 附录：幂等版本（适合"不知道上次执行到哪一步"的重跑场景）
-- ============================================================
-- DROP PROCEDURE IF EXISTS qg_add_tenant_column;
-- DELIMITER $$
-- CREATE PROCEDURE qg_add_tenant_column(IN p_table VARCHAR(64))
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
--      WHERE TABLE_SCHEMA = DATABASE()
--        AND TABLE_NAME = p_table
--        AND COLUMN_NAME = 'tenant_id'
--   ) THEN
--     SET @stmt = CONCAT(
--       'ALTER TABLE ', p_table,
--       ' ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT ''所属租户'' AFTER id,',
--       ' ADD INDEX idx_', p_table, '_tenant (tenant_id)'
--     );
--     PREPARE q FROM @stmt; EXECUTE q; DEALLOCATE PREPARE q;
--   END IF;
-- END$$
-- DELIMITER ;
--
-- CALL qg_add_tenant_column('users');
-- CALL qg_add_tenant_column('orders');
-- -- ... 把上面 33 张表都 CALL 一遍即可幂等执行
--
-- DROP PROCEDURE qg_add_tenant_column;
