-- ============================================================
-- 数据库迁移：device + ai-dialog 模块新表（2026-06-03）
-- 配套：PRD_陪护机器人二次开发.md §7.2 + IMPLEMENTATION.md §2.2/§2.7
--
-- 适用环境：生产 / staging（synchronize=false 不会自动建表）
-- 推荐执行时机：业务低峰；先执行 migration_tenant_v1_20260603.sql，再执行本文件
--
-- 改动内容：
--   1) device 模块 5 张新表：
--      - devices                    设备主表
--      - device_bindings            设备↔用户↔服务对象绑定
--      - device_event_logs          设备上行事件流水
--      - device_dp_snapshots        最新 DP 状态快照
--      - device_online_histories    在线状态历史
--   2) ai-dialog 模块 2 张新表：
--      - ai_dialog_sessions         对话会话聚合
--      - ai_dialog_logs             单条消息留存
--
-- 所有新表都自带 `tenant_id INT NOT NULL DEFAULT 1` 列与索引。
-- ============================================================

USE qiaoguo_health;

-- ─────────────────────────────────────────────
-- ① devices —— 设备主表
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id                  INT NOT NULL AUTO_INCREMENT,
  tenant_id           INT NOT NULL DEFAULT 1 COMMENT '所属租户',
  tuya_device_id      VARCHAR(64)  NOT NULL COMMENT '涂鸦设备 ID（mock 阶段可任意）',
  product_id          VARCHAR(64)  NOT NULL COMMENT '涂鸦 PID',
  type                ENUM('robot','radar','wearable') NOT NULL DEFAULT 'robot',
  status              ENUM('active','pending','suspended','decommissioned') NOT NULL DEFAULT 'pending',
  name                VARCHAR(128) NOT NULL,
  firmware_version    VARCHAR(32)  NULL,
  mac                 VARCHAR(32)  NULL,
  icon_url            VARCHAR(255) NULL,
  online              TINYINT(1)   NOT NULL DEFAULT 0,
  last_online_at      DATETIME     NULL,
  last_heartbeat_at   DATETIME     NULL,
  battery_percent     TINYINT      NULL,
  metadata            JSON         NULL,
  created_at          DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_devices_tuya (tuya_device_id),
  KEY idx_devices_tenant     (tenant_id),
  KEY idx_devices_product    (product_id),
  KEY idx_devices_type       (type),
  KEY idx_devices_status     (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备主表';

-- ─────────────────────────────────────────────
-- ② device_bindings —— 设备↔用户↔服务对象 多方绑定
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_bindings (
  id                  INT NOT NULL AUTO_INCREMENT,
  tenant_id           INT NOT NULL DEFAULT 1,
  device_id           INT NOT NULL,
  user_id             INT NOT NULL COMMENT '操作账号（家属或老人本人）',
  service_target_id   INT NOT NULL COMMENT '服务对象（老人）',
  family_group_id     INT NULL COMMENT '所属家庭（可选）',
  role                ENUM('owner','co_manager','viewer') NOT NULL DEFAULT 'owner',
  bound_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unbound_at          DATETIME    NULL COMMENT '软删（非 null 视为已解绑）',
  created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_device_bindings_device_user (device_id, user_id),
  KEY idx_device_bindings_tenant      (tenant_id),
  KEY idx_device_bindings_user        (user_id),
  KEY idx_device_bindings_target      (service_target_id),
  KEY idx_device_bindings_family      (family_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备绑定关系';

-- ─────────────────────────────────────────────
-- ③ device_event_logs —— 设备上行事件流水
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_event_logs (
  id                      BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id               INT NOT NULL DEFAULT 1,
  device_id               INT NOT NULL,
  type                    ENUM('online','offline','dp_change','fall','sos','vital_anomaly','ai_dialog','fault','ota','play_reminder','other') NOT NULL DEFAULT 'other',
  level                   ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  payload                 JSON NULL,
  received_at             DATETIME NOT NULL,
  dedup_key               VARCHAR(128) NULL,
  forwarded_to_alert      TINYINT(1) NOT NULL DEFAULT 0,
  forwarded_to_realtime   TINYINT(1) NOT NULL DEFAULT 0,
  created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_device_event_dedup (dedup_key),
  KEY idx_dev_evt_device_recv (device_id, received_at),
  KEY idx_dev_evt_type_recv   (type, received_at),
  KEY idx_dev_evt_level_recv  (level, received_at),
  KEY idx_dev_evt_tenant_type (tenant_id, type, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备上行事件流水';

-- ─────────────────────────────────────────────
-- ④ device_dp_snapshots —— 最新 DP 状态快照（性能优化）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_dp_snapshots (
  id           INT NOT NULL AUTO_INCREMENT,
  tenant_id    INT NOT NULL DEFAULT 1,
  device_id    INT NOT NULL,
  dp_code      VARCHAR(64)  NOT NULL,
  value_type   ENUM('bool','number','string','json','enum') NOT NULL DEFAULT 'string',
  value        TEXT NOT NULL,
  reported_at  DATETIME NOT NULL,
  created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_device_dp (device_id, dp_code),
  KEY idx_device_dp_code (dp_code),
  KEY idx_device_dp_updated (updated_at),
  KEY idx_device_dp_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DP 最新状态快照';

-- ─────────────────────────────────────────────
-- ⑤ device_online_histories —— 在线状态历史
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_online_histories (
  id           BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id    INT NOT NULL DEFAULT 1,
  device_id    INT NOT NULL,
  online       TINYINT(1) NOT NULL,
  changed_at   DATETIME NOT NULL,
  source       VARCHAR(32) NOT NULL DEFAULT 'pulsar',
  created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_dev_online_dev_changed (device_id, changed_at),
  KEY idx_dev_online_tenant_changed (tenant_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备在线状态历史';

-- ─────────────────────────────────────────────
-- ⑥ ai_dialog_sessions —— 对话会话聚合
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_dialog_sessions (
  id                    INT NOT NULL AUTO_INCREMENT,
  tenant_id             INT NOT NULL DEFAULT 1,
  device_id             INT NULL,
  user_id               INT NULL,
  service_target_id     INT NULL,
  agent_id              VARCHAR(64) NULL,
  started_at            DATETIME NOT NULL,
  ended_at              DATETIME NULL,
  total_turns           INT NOT NULL DEFAULT 0,
  total_tokens          INT NOT NULL DEFAULT 0,
  summary               TEXT NULL,
  crisis_score          INT NOT NULL DEFAULT 0,
  crisis_words          JSON NULL,
  mcp_tool_calls_count  INT NOT NULL DEFAULT 0,
  qa_status             ENUM('pending','sampled','reviewed','flagged') NOT NULL DEFAULT 'pending',
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_ai_sess_device_start  (device_id, started_at),
  KEY idx_ai_sess_user_start    (user_id, started_at),
  KEY idx_ai_sess_target_start  (service_target_id, started_at),
  KEY idx_ai_sess_tenant_start  (tenant_id, started_at),
  KEY idx_ai_sess_crisis        (crisis_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 对话会话';

-- ─────────────────────────────────────────────
-- ⑦ ai_dialog_logs —— 单条消息留存
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_dialog_logs (
  id                  BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id           INT NOT NULL DEFAULT 1,
  session_id          INT NOT NULL,
  device_id           INT NULL,
  user_id             INT NULL,
  service_target_id   INT NULL,
  direction           ENUM('user','assistant','system','tool') NOT NULL,
  text                TEXT NOT NULL,
  audio_url           VARCHAR(255) NULL,
  emotion             ENUM('happy','neutral','sad','angry','anxious','unknown') NULL DEFAULT 'unknown',
  crisis_words        JSON NULL,
  tool_calls          JSON NULL,
  token_count         INT NULL,
  latency_ms          INT NULL,
  intent              VARCHAR(64) NULL,
  model_name          VARCHAR(64) NULL,
  created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_ai_log_session_created    (session_id, created_at),
  KEY idx_ai_log_device_created     (device_id, created_at),
  KEY idx_ai_log_target_created     (service_target_id, created_at),
  KEY idx_ai_log_tenant_created     (tenant_id, created_at),
  KEY idx_ai_log_direction_created  (direction, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 对话单条留存';

-- ============================================================
-- 验证
-- ============================================================
-- SHOW TABLES LIKE 'devices';
-- SHOW TABLES LIKE 'device_%';
-- SHOW TABLES LIKE 'ai_dialog_%';
-- SHOW COLUMNS FROM devices;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS ai_dialog_logs;
-- DROP TABLE IF EXISTS ai_dialog_sessions;
-- DROP TABLE IF EXISTS device_online_histories;
-- DROP TABLE IF EXISTS device_dp_snapshots;
-- DROP TABLE IF EXISTS device_event_logs;
-- DROP TABLE IF EXISTS device_bindings;
-- DROP TABLE IF EXISTS devices;
