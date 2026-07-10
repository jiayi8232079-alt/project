-- 迁移说明：短信通知（腾讯云 SMS）接入
-- 1) 新增 sms_send_logs 表：记录每次短信发送（含成功 / 失败 / 跳过 / 频控 / 异常等全部结果），
--    同时用于「每手机号每日上限」频控 count 查询。
-- 2) 在 system_configs 写入 8 个默认配置键，方便管理员在后台「系统配置 → 短信通知」页面直接填写。
--
-- 所有语句均为幂等写法（CREATE TABLE IF NOT EXISTS / INSERT IGNORE），可重复执行。
-- 开发环境 TypeORM synchronize=true 时会自动建表；生产环境请手动执行一次本文件。

-- ------------------------------------------------------------
-- 1. sms_send_logs 表：短信发送日志
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_send_logs (
  id INT NOT NULL AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL COMMENT '接收手机号（大陆 11 位，不含 +86）',
  template_key VARCHAR(64) NOT NULL COMMENT '业务模板键：medication_reminder / follow_up_reminder',
  template_id VARCHAR(64) NULL COMMENT '腾讯云模板 ID（发送时快照，便于对账）',
  params JSON NULL COMMENT '模板变量（TemplateParamSet）快照',
  status VARCHAR(32) NOT NULL COMMENT '发送状态：success / failed / rate_limited / disabled / no_phone / error',
  error_message VARCHAR(512) NULL COMMENT '错误信息或跳过原因',
  tencent_serial_no VARCHAR(64) NULL COMMENT '腾讯云返回的 SerialNo，用于官方后台追查',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_sms_send_logs_phone_created (phone, created_at),
  KEY IDX_sms_send_logs_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信发送日志（含频控 count 依赖）';

-- ------------------------------------------------------------
-- 2. system_configs：预置 8 个短信相关配置键（空值，由管理员在后台填写）
--    使用 INSERT IGNORE 保证幂等：若 key 已存在则不覆盖，避免误删管理员已填配置。
-- ------------------------------------------------------------
INSERT IGNORE INTO system_configs (`key`, `value`, `description`, `created_at`, `updated_at`) VALUES
  ('sms_enabled',                              'false', '短信通知总开关（true/false）',                    NOW(), NOW()),
  ('tencent_sms_secret_id',                    '',      '腾讯云短信 SecretId（可复用 COS / ASR 同组密钥）', NOW(), NOW()),
  ('tencent_sms_secret_key',                   '',      '腾讯云短信 SecretKey',                             NOW(), NOW()),
  ('tencent_sms_sdk_app_id',                   '',      '腾讯云短信应用 SdkAppId（如 1400xxxxxx）',         NOW(), NOW()),
  ('tencent_sms_sign_name',                    '',      '腾讯云短信签名（已审核通过的签名内容，不含方括号）', NOW(), NOW()),
  ('tencent_sms_template_medication_reminder', '',      '腾讯云短信模板ID-用药提醒',                        NOW(), NOW()),
  ('tencent_sms_template_follow_up_reminder',  '',      '腾讯云短信模板ID-复诊提醒',                        NOW(), NOW()),
  ('sms_daily_limit_per_phone',                '10',    '短信每手机号每日上限（条），防止误配置刷爆',        NOW(), NOW());
