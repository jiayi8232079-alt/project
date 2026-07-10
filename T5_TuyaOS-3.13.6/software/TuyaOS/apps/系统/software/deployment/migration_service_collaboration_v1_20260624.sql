-- 服务商与合作医院协议：支撑陪诊、家政、B 端公司合作服务和医院资源展示
-- 执行库：qiaoguo_health

CREATE TABLE IF NOT EXISTS `service_providers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `name` varchar(128) NOT NULL,
  `type` varchar(64) NOT NULL,
  `status` enum('active', 'suspended') NOT NULL DEFAULT 'active',
  `service_area` json NULL,
  `catalog` json NULL,
  `credentials` json NULL,
  `settlement` json NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_service_providers_type_status` (`type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hospital_partnerships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离主键）',
  `hospital_id` int NULL,
  `hospital_name` varchar(128) NOT NULL,
  `partnership_type` varchar(64) NOT NULL,
  `status` enum('active', 'expired', 'suspended') NOT NULL DEFAULT 'active',
  `valid_until` datetime NULL,
  `resources` json NULL,
  `benefits` json NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_hospital_partnerships_hospital_status` (`hospital_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
