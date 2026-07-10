-- 家庭留言、家庭任务、声纹成员：支撑家属投喂、家庭提醒和声纹状态联调
-- 执行库：qiaoguo_health

CREATE TABLE IF NOT EXISTS `family_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `family_id` int NOT NULL,
  `elder_id` int NULL,
  `created_by` int NOT NULL,
  `message` text NOT NULL,
  `broadcast_mode` varchar(32) NOT NULL DEFAULT 'next_available',
  `broadcasted_at` datetime NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_family_messages_family_created` (`family_id`, `created_at`),
  KEY `idx_family_messages_elder_created` (`elder_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `family_id` int NOT NULL,
  `elder_id` int NULL,
  `created_by` int NOT NULL,
  `title` varchar(128) NOT NULL,
  `type` varchar(64) NOT NULL,
  `message` text NULL,
  `schedule_mode` varchar(32) NOT NULL DEFAULT 'next_available',
  `remind_at` datetime NULL,
  `status` enum('pending', 'sent', 'broadcasted', 'responded', 'cancelled') NOT NULL DEFAULT 'pending',
  `broadcasted_at` datetime NULL,
  `elder_response` text NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_family_tasks_family_status` (`family_id`, `status`),
  KEY `idx_family_tasks_elder_status` (`elder_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `voiceprint_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `family_id` int NOT NULL,
  `member_id` int NOT NULL,
  `status` enum('not_started', 'enrolling', 'active', 'low_confidence', 'revoked') NOT NULL DEFAULT 'not_started',
  `confidence` decimal(4,3) NULL,
  `enrolled_at` datetime NULL,
  `revoked_at` datetime NULL,
  `misrecognition_count` int NOT NULL DEFAULT 0,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_voiceprint_profiles_family_member` (`family_id`, `member_id`),
  KEY `idx_voiceprint_profiles_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
