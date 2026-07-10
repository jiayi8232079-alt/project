-- App 推送 token：支撑 SOS/视觉跌倒杀后台强提醒
-- 执行库：qiaoguo_health

CREATE TABLE IF NOT EXISTS `app_device_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `user_id` int NOT NULL COMMENT '绑定的 App 用户',
  `platform` enum('ios', 'android', 'harmony', 'web', 'other') NOT NULL,
  `vendor` enum('apns', 'fcm', 'huawei', 'xiaomi', 'oppo', 'vivo', 'meizu', 'honor', 'other') NOT NULL,
  `token` varchar(512) NOT NULL,
  `device_id` varchar(128) NOT NULL COMMENT '手机侧设备标识，用于同一手机重复上报时更新 token',
  `app_version` varchar(32) NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `last_seen_at` datetime NOT NULL,
  `unregistered_at` datetime NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_device_tokens_user_device` (`user_id`, `device_id`),
  KEY `idx_app_device_tokens_user_active` (`user_id`, `active`),
  KEY `idx_app_device_tokens_tenant_active` (`tenant_id`, `active`),
  CONSTRAINT `fk_app_device_tokens_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
