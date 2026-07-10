-- 设备设置与下发日志：支撑 App/后台统一管理勿扰、音量、SOS 阈值等配置
-- 执行库：qiaoguo_health

CREATE TABLE IF NOT EXISTS `device_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `device_id` int NOT NULL,
  `quiet_hours` json NULL,
  `volume` tinyint NOT NULL DEFAULT 70,
  `speech_rate` decimal(4,2) NOT NULL DEFAULT 1.00,
  `screen_brightness` tinyint NOT NULL DEFAULT 80,
  `sos_hold_seconds` tinyint NOT NULL DEFAULT 3,
  `auto_escalation` enum('family_only', 'family_then_community', 'family_then_manual') NOT NULL DEFAULT 'family_then_community',
  `community_content_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `privacy_visibility` enum('guardian_only', 'family_members', 'community_duty') NOT NULL DEFAULT 'guardian_only',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_settings_device` (`device_id`),
  KEY `idx_device_settings_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `device_setting_dispatch_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `device_id` int NOT NULL,
  `setting_id` int NOT NULL,
  `status` enum('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  `payload` json NULL,
  `acked_at` datetime NULL,
  `failure_reason` varchar(255) NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_device_setting_dispatch_logs_device_created` (`device_id`, `created_at`),
  KEY `idx_device_setting_dispatch_logs_status` (`status`),
  KEY `idx_device_setting_dispatch_logs_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
