-- 社区内容发布与触达回执：支撑社区后台通知、机器人播报、App 查看回执
-- 执行库：qiaoguo_health

CREATE TABLE IF NOT EXISTS `community_contents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `title` varchar(128) NOT NULL,
  `body` text NOT NULL,
  `voice_script` text NULL,
  `category` varchar(64) NOT NULL,
  `priority` enum('normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  `status` enum('draft', 'submitted', 'published', 'revoked') NOT NULL DEFAULT 'draft',
  `target` json NULL,
  `schedule` json NULL,
  `published_at` datetime NULL,
  `revoked_at` datetime NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_community_contents_status_created` (`status`, `created_at`),
  KEY `idx_community_contents_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `content_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `content_id` int NOT NULL,
  `device_id` int NULL,
  `family_id` int NULL,
  `elder_id` int NULL,
  `status` enum('queued', 'sent', 'delivered', 'played', 'app_viewed', 'failed', 'revoked') NOT NULL DEFAULT 'queued',
  `status_at` datetime NULL,
  `failure_reason` varchar(255) NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_content_deliveries_content_status` (`content_id`, `status`),
  KEY `idx_content_deliveries_device_created` (`device_id`, `created_at`),
  KEY `idx_content_deliveries_family` (`family_id`),
  CONSTRAINT `fk_content_deliveries_content`
    FOREIGN KEY (`content_id`) REFERENCES `community_contents` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
