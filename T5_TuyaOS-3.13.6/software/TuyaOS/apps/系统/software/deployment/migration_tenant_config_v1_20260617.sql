-- ============================================================
-- 数据库迁移：分层硬件同步（配置下发 + 跨层告警分发）v1 —— 2026-06-17
-- 配套：PRD_分层多租户与三门户联动.md Phase 3 §5
--
-- 新增 3 张表：tenant_settings / device_config_logs / alert_dispatch_rules
-- 幂等：CREATE TABLE IF NOT EXISTS
-- 开发环境 TypeORM synchronize=true 自动建表；本脚本用于生产（synchronize=false）
-- ============================================================

USE qiaoguo_health;

-- 层级配置项（沿 path 链就近生效）
CREATE TABLE IF NOT EXISTS tenant_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户层级',
  config_key VARCHAR(64) NOT NULL COMMENT '配置键',
  config_value TEXT NOT NULL COMMENT '配置值（标量或 JSON 字符串）',
  scope_type ENUM('platform','government','enterprise','organization','site') NOT NULL DEFAULT 'organization' COMMENT '写入方层级',
  target_device_id INT NULL DEFAULT NULL COMMENT '设备级覆盖时指向设备；NULL=租户层级通用',
  effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生效时间',
  created_by INT NULL COMMENT '操作者',
  remark VARCHAR(255) NULL COMMENT '备注',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_tenant_settings (tenant_id, config_key, target_device_id),
  KEY idx_tenant_settings_key (config_key),
  KEY idx_tenant_settings_scope (tenant_id, scope_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='层级配置项';

-- 设备配置下发回执
CREATE TABLE IF NOT EXISTS device_config_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '设备所属租户',
  device_id INT NOT NULL COMMENT '目标设备',
  config_key VARCHAR(64) NOT NULL COMMENT '配置键',
  config_value TEXT NOT NULL COMMENT '下发值快照',
  source_tenant_id INT NOT NULL COMMENT '配置来源租户（path 链命中层）',
  status ENUM('pending','sent','acked','failed') NOT NULL DEFAULT 'pending' COMMENT '下发状态',
  ack_at DATETIME NULL COMMENT '设备确认时间',
  error TEXT NULL COMMENT '失败原因',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_device_config_logs_device (device_id, created_at),
  KEY idx_device_config_logs_status (status),
  KEY idx_device_config_logs_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备配置下发回执';

-- 跨层告警分发规则
CREATE TABLE IF NOT EXISTS alert_dispatch_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '规则所属租户',
  event_type VARCHAR(32) NOT NULL COMMENT '事件类型 fall/sos/...',
  severity ENUM('low','medium','high') NOT NULL DEFAULT 'high' COMMENT '最低触发严重度',
  forward_to_levels JSON NOT NULL COMMENT '透传层级列表',
  notify_channels JSON NOT NULL COMMENT '通知通道列表',
  escalation JSON NULL COMMENT '升级策略',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  remark VARCHAR(128) NULL COMMENT '备注',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_alert_dispatch_tenant (tenant_id, enabled),
  KEY idx_alert_dispatch_event (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='跨层告警分发规则';

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS tenant_settings;
-- DROP TABLE IF EXISTS device_config_logs;
-- DROP TABLE IF EXISTS alert_dispatch_rules;
