/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `real_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','attendant','admin','operator','finance','customer_service','medical_consultant') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `failed_login_count` int NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `last_failed_login_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_2873882c38e8c07d98cb64f962` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ai_consultations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_target_id` int DEFAULT NULL,
  `role` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `parsed_result` json DEFAULT NULL,
  `tokens_used` int DEFAULT NULL,
  `feedback_helpful` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_b4957c73b7c7ff4de5be7e6c056` (`user_id`),
  CONSTRAINT `FK_b4957c73b7c7ff4de5be7e6c056` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `alert_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `rule_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('medication_miss','follow_up_overdue','timeline_keyword','service_exception','manual') COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `enabled` tinyint NOT NULL DEFAULT '1',
  `condition_json` json DEFAULT NULL COMMENT '规则参数（如 minAdherenceRate:0.7、overdueDays:1、keywords:[...]）',
  `description` text COLLATE utf8mb4_unicode_ci,
  `cooldown_minutes` int NOT NULL DEFAULT '1440' COMMENT '同一 dedup_key 的最小告警间隔（分钟），默认 24 小时',
  `notify_family` tinyint NOT NULL DEFAULT '1',
  `notify_admin` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_eff27ae3a955dc691b1cb6a179` (`rule_code`),
  KEY `IDX_4958ec2959cbb80068f26f1913` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `attendants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `real_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `insurance_expiry` date DEFAULT NULL,
  `rating` decimal(2,1) NOT NULL DEFAULT '5.0',
  `total_orders` int NOT NULL DEFAULT '0',
  `status` enum('active','disabled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failed_login_count` int NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `last_failed_login_at` datetime DEFAULT NULL,
  `insurance_info` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_e3f47fe0ea94be3cc377596dbd` (`username`),
  KEY `FK_16bc15a552cca926c0cfd3643df` (`user_id`),
  CONSTRAINT `FK_16bc15a552cca926c0cfd3643df` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `actor_id` int DEFAULT NULL,
  `actor_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_role` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `path` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_code` int DEFAULT NULL,
  `request_summary` text COLLATE utf8mb4_unicode_ci,
  `duration_ms` int DEFAULT NULL,
  `remark` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_3d04b6f2b05825501c1427f0d9` (`resource_type`,`resource_id`),
  KEY `IDX_99fca4a3a4a93c26a756c5aca5` (`action`,`created_at`),
  KEY `IDX_2e59b7796e77ebe73de37151c3` (`actor_type`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `complaints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `attendant_id` int DEFAULT NULL,
  `category` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `subject` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `images` json DEFAULT NULL,
  `contact_phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `handler_id` int DEFAULT NULL,
  `resolution` text COLLATE utf8mb4_unicode_ci,
  `internal_note` text COLLATE utf8mb4_unicode_ci,
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `user_rating` tinyint DEFAULT NULL,
  `timeline` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_250ea1d40f7a564243d77705e0` (`user_id`),
  KEY `IDX_01636cf3b02d98b3c59843fb54` (`order_id`),
  KEY `IDX_208ad761b4359509cd2f43da87` (`status`),
  KEY `FK_c6ddc575e61ab4e496a3fe053ad` (`attendant_id`),
  KEY `FK_373028949e6f258361a8531dde2` (`handler_id`),
  CONSTRAINT `FK_01636cf3b02d98b3c59843fb54a` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_250ea1d40f7a564243d77705e09` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_373028949e6f258361a8531dde2` FOREIGN KEY (`handler_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_c6ddc575e61ab4e496a3fe053ad` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `consultations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `consult_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'online',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_time` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `service_interest` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '感兴趣的服务：checkup/expert/escort/consult/store/fetch',
  `consult_category` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '咨询类型主分类（如：医疗资源协调/体检规划/陪诊服务）',
  `consult_sub_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '咨询类型子分类（如：专家匹配/门诊协调/住院协调）',
  PRIMARY KEY (`id`),
  KEY `FK_6b75097e3923dafb9362242037a` (`user_id`),
  CONSTRAINT `FK_6b75097e3923dafb9362242037a` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int DEFAULT NULL,
  `type` enum('health_profile','dispatch_confirmation','service_completion','service_report','expert_match') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `service_target_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `archive_no` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_e218a8ca53f8f17427b07cb5ddf` (`order_id`),
  CONSTRAINT `FK_e218a8ca53f8f17427b07cb5ddf` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `family_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invite_code` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int NOT NULL,
  `assigned_cs_admin_id` int DEFAULT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_ef43a3e79b11e3d433066a99eb` (`invite_code`),
  KEY `FK_21a8fe1d4021e33443e95174fa5` (`created_by`),
  CONSTRAINT `FK_21a8fe1d4021e33443e95174fa5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `family_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `family_group_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `role` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member',
  `relation` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `joined_at` datetime DEFAULT NULL,
  `linked_service_target_id` int DEFAULT NULL,
  `placeholder_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `placeholder_phone_encrypted` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `placeholder_phone_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `placeholder_id_card_encrypted` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_elder` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `FK_610cd7909580fea972f54f50108` (`family_group_id`),
  KEY `FK_081fe336d41be74c68b81e8b6d7` (`user_id`),
  CONSTRAINT `FK_081fe336d41be74c68b81e8b6d7` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK_610cd7909580fea972f54f50108` FOREIGN KEY (`family_group_id`) REFERENCES `family_groups` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `finance_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` int DEFAULT NULL,
  `attendant_id` int DEFAULT NULL,
  `type` enum('transport','accommodation','medical','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proof_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewer_id` int DEFAULT NULL,
  `review_note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proof_images` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_60d2f5031fc0f7ec5c864021ad4` (`order_id`),
  KEY `FK_051cc1b000cb6a77135440be716` (`attendant_id`),
  CONSTRAINT `FK_051cc1b000cb6a77135440be716` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`),
  CONSTRAINT `FK_60d2f5031fc0f7ec5c864021ad4` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `health_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL COMMENT '关联家属/主账号 user_id',
  `service_target_id` int DEFAULT NULL COMMENT '服务对象（老人/患者）',
  `order_id` int DEFAULT NULL COMMENT '关联订单（如关键词规则由时间线触发）',
  `category` enum('medication_miss','follow_up_overdue','timeline_keyword','service_exception','manual') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '告警分类',
  `rule_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '触发规则 code（如 medication_miss_rate_low）',
  `rule_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` enum('low','medium','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '预警标题（家属看板横幅）',
  `summary` text COLLATE utf8mb4_unicode_ci COMMENT '预警详细说明',
  `payload` json DEFAULT NULL COMMENT '命中时的上下文数据（如漏服天数、逾期天数、命中关键词等）',
  `suggested_actions` json DEFAULT NULL COMMENT '系统推荐家属可执行的动作（如 联系客服 / 升级月卡）',
  `status` enum('new','acknowledged','closed','ignored') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `triggered_at` datetime NOT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `acknowledged_by` int DEFAULT NULL COMMENT '确认者 user_id 或 admin_user_id（配合 channel 区分）',
  `acknowledged_channel` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'family / admin',
  `acknowledged_note` text COLLATE utf8mb4_unicode_ci,
  `closed_at` datetime DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  `dedup_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '幂等 key：同一规则+对象+时间窗只产生一条预警',
  `notification_sent` tinyint NOT NULL DEFAULT '0',
  `notification_sent_at` datetime DEFAULT NULL,
  `assignee_id` int DEFAULT NULL COMMENT '指派到的 admin_user_id（客服/健康管家）',
  `assigned_by` int DEFAULT NULL COMMENT '指派操作者 admin_user_id',
  `assigned_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_459b54394ba6a9601553a83dcd` (`severity`,`triggered_at`),
  KEY `IDX_1a2320dce2923cb7b7d57c4935` (`service_target_id`,`status`),
  KEY `IDX_65813b919900864e28df1f13ea` (`user_id`,`status`),
  KEY `FK_c530a1c28176fd8b06b55d3edd9` (`order_id`),
  KEY `FK_5fa91cd1a9991173406d8ceb3ce` (`assignee_id`),
  CONSTRAINT `FK_5fa91cd1a9991173406d8ceb3ce` FOREIGN KEY (`assignee_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_ae950a3abc6b07e0a05ef420f7c` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_c530a1c28176fd8b06b55d3edd9` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_e31c43670a95387e2d92f3469fc` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `alert_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `alert_id` int NOT NULL COMMENT '所属告警 ID',
  `actor_type` enum('admin','user','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system' COMMENT '触发者身份：admin=管理员/客服 user=家属 system=系统',
  `actor_id` int DEFAULT NULL COMMENT 'actor_type=admin 时是 admin_user_id，user 时是 user_id；system 为空',
  `actor_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '快照：触发者显示名（避免后续改名后日志失真）',
  `action` enum('create','assign','comment','acknowledge','close','reopen','notify') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '动作类型',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT '跟进文字 / 备注',
  `payload` json DEFAULT NULL COMMENT '结构化扩展字段（如 assignee_id、附件等）',
  PRIMARY KEY (`id`),
  KEY `IDX_6e64025fd927802ad1be8cd132` (`alert_id`,`created_at`),
  CONSTRAINT `FK_b94d11c174f92e91994785d7caa` FOREIGN KEY (`alert_id`) REFERENCES `health_alerts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `health_weekly_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `service_target_id` int DEFAULT NULL,
  `week_start` date NOT NULL,
  `week_end` date NOT NULL,
  `medication_stats` json DEFAULT NULL,
  `health_summary` text COLLATE utf8mb4_unicode_ci,
  `ai_analysis` json DEFAULT NULL,
  `raw_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_b9136b4bbeda8fb6fdf0a701ca0` (`user_id`),
  KEY `FK_39b27e6553ca07510f3cb3e7e22` (`service_target_id`),
  CONSTRAINT `FK_39b27e6553ca07510f3cb3e7e22` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`),
  CONSTRAINT `FK_b9136b4bbeda8fb6fdf0a701ca0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `hospital_doctors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `hospital_id` int NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title_level` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expertise` text COLLATE utf8mb4_unicode_ci,
  `sort_weight` int NOT NULL DEFAULT '0',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `introduction` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `IDX_a44bfeb25c5335ec833f12fd3d` (`hospital_id`,`sort_weight`),
  CONSTRAINT `FK_6719b7421c1a8ee35338a17aa21` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1884 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `hospitals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `short_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `province` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '浙江省',
  `city` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `district` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_main` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phones_extra` json DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `hospital_level` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ownership_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `key_departments` json DEFAULT NULL,
  `website_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_weight` int NOT NULL DEFAULT '0',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `source` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remark` text COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5430 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `medication_reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `service_target_id` int DEFAULT NULL,
  `order_id` int DEFAULT NULL,
  `medicine_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '药品名称',
  `dosage` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用量/剂量',
  `frequency` enum('once','daily','weekly','custom') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'daily' COMMENT '提醒频率',
  `reminder_times` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '每日提醒时间点列表，如 ["08:00","12:00","18:00"]',
  `start_date` date NOT NULL COMMENT '开始日期',
  `end_date` date NOT NULL COMMENT '结束日期',
  `instructions` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用药说明/备注',
  `status` enum('active','paused','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `channel` enum('wechat_work','mini_program','all') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all' COMMENT '通知渠道',
  `last_notified_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL COMMENT '创建者（管理员ID）',
  `reminder_type` enum('medication','follow_up') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medication' COMMENT '提醒类型',
  `follow_up_hospital` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '复诊医院',
  `follow_up_department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '复诊科室',
  PRIMARY KEY (`id`),
  KEY `FK_c314c64ba33df833e7d85911689` (`user_id`),
  KEY `FK_7781f7956d2a1fcba4dd0b9d1e2` (`service_target_id`),
  KEY `FK_6ef311be49f596c2effb279798b` (`order_id`),
  CONSTRAINT `FK_6ef311be49f596c2effb279798b` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_7781f7956d2a1fcba4dd0b9d1e2` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_c314c64ba33df833e7d85911689` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `medication_execution_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `reminder_id` int NOT NULL,
  `service_target_id` int DEFAULT NULL,
  `scheduled_date` date NOT NULL COMMENT '计划服药日期',
  `scheduled_time` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划服药时间 HH:MM',
  `status` enum('taken','missed','skipped','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `executed_at` datetime DEFAULT NULL,
  `executed_by` int DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `IDX_bfaeffe7386b81dd29ec02e9b3` (`service_target_id`,`scheduled_date`),
  KEY `IDX_1befef8e127944c21995cf996b` (`reminder_id`,`scheduled_date`),
  CONSTRAINT `FK_2da110c9c8a9c0450504703eb5e` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_77da6049fc8ccdbf19a49bbd9ec` FOREIGN KEY (`reminder_id`) REFERENCES `medication_reminders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `membership_card_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `card_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_days` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `level_id` int DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `FK_e486f24870868f78d09ac55cefc` (`level_id`),
  CONSTRAINT `FK_e486f24870868f78d09ac55cefc` FOREIGN KEY (`level_id`) REFERENCES `membership_levels` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `membership_levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `level_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_rate` decimal(5,2) NOT NULL DEFAULT '100.00',
  `min_recharge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `benefits` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `mp_monitor_scenes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` int NOT NULL,
  `token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `scene_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'timeline',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_92daf4e2da5fed75b979dcbbde` (`code`),
  KEY `IDX_dd652d02545b19467193f95a15` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `service_target_id` int NOT NULL,
  `attendant_id` int DEFAULT NULL,
  `status` enum('pending_dispatch','pending_accept','pending_grab','pending_sign','pending_service','in_progress','pending_review','completed','canceled','emergency') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_dispatch',
  `service_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_time` datetime DEFAULT NULL,
  `service_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hospital` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `base_fee` decimal(10,2) DEFAULT NULL,
  `total_fee` decimal(10,2) DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `cancel_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `canceled_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sign_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completion_data` json DEFAULT NULL,
  `checkup_package_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `checkup_gender` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `checkup_optional_items` json DEFAULT NULL,
  `need_attendant` tinyint NOT NULL DEFAULT '1',
  `attendant_fee` decimal(10,2) DEFAULT NULL,
  `attendant_fee_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `additional_service_items` json DEFAULT NULL,
  `settlement_status` enum('pending','settled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payment_status` enum('unpaid','paid','refunded') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `payment_method` enum('wechat','alipay','qr_transfer','bank_transfer','cash','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_paid_at` datetime DEFAULT NULL,
  `settled_at` datetime DEFAULT NULL,
  `settlement_remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `payment_reference` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendant_extra_income_items` json DEFAULT NULL,
  `risk_level` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendant_live_lat` double DEFAULT NULL,
  `attendant_live_lng` double DEFAULT NULL,
  `attendant_live_at` datetime DEFAULT NULL,
  `hospital_booking_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hospital_directory_id` int DEFAULT NULL,
  `service_confirm_signature_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_confirm_signed_at` datetime DEFAULT NULL,
  `service_end_time` datetime DEFAULT NULL,
  `service_confirm_signer_relation` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `callback_contact_phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_confirm_signer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_75eba1c6b1a66b09f2a97e6927` (`order_number`),
  KEY `FK_a922b820eeef29ac1c6800e826a` (`user_id`),
  KEY `FK_d959c3492de16a30802103eeb29` (`service_target_id`),
  KEY `FK_f21c645176ba85c9c3c79d9413c` (`attendant_id`),
  KEY `FK_7b1b769234daa9433dc54be7316` (`hospital_directory_id`),
  CONSTRAINT `FK_7b1b769234daa9433dc54be7316` FOREIGN KEY (`hospital_directory_id`) REFERENCES `hospitals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_a922b820eeef29ac1c6800e826a` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK_d959c3492de16a30802103eeb29` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`),
  CONSTRAINT `FK_f21c645176ba85c9c3c79d9413c` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `user_id` int NOT NULL,
  `attendant_id` int DEFAULT NULL,
  `rating` tinyint NOT NULL COMMENT '1-5',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `tags` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `FK_e4b0ed40bdd0f318108612c2851` (`order_id`),
  KEY `FK_728447781a30bc3fcfe5c2f1cdf` (`user_id`),
  KEY `FK_22f7ae09a3f957b1fbef945c99f` (`attendant_id`),
  CONSTRAINT `FK_22f7ae09a3f957b1fbef945c99f` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`),
  CONSTRAINT `FK_728447781a30bc3fcfe5c2f1cdf` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK_e4b0ed40bdd0f318108612c2851` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attendant_id` int NOT NULL,
  `date` date NOT NULL,
  `period` enum('morning','afternoon','full_day') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('available','booked') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_9f51698a7ffd7446bc1362d6797` (`attendant_id`),
  CONSTRAINT `FK_9f51698a7ffd7446bc1362d6797` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `service_targets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age` int DEFAULT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_contact` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `health_profile` json DEFAULT NULL,
  `main_appeal` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `signature_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idCard` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_address` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_trust` tinyint NOT NULL DEFAULT '0',
  `trust_doc_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trust_signed_at` datetime DEFAULT NULL,
  `delegator_relation` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trust_signer_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_0ee70d9522652b6f3b7d33bb735` (`user_id`),
  CONSTRAINT `FK_0ee70d9522652b6f3b7d33bb735` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `service_timelines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `operator_id` int DEFAULT NULL,
  `type` enum('text','image','audio_question','audio_advice','file','node','service_start','service_end','emergency') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `visible_to_user` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_d1dbe89cb1224b76950a91a6826` (`order_id`),
  CONSTRAINT `FK_d1dbe89cb1224b76950a91a6826` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_5aff9a6d272a5cedf54d7aaf61` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `triage_feedbacks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `session_id` int NOT NULL,
  `human_accepted` tinyint(1) DEFAULT NULL,
  `actual_order_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `satisfaction` int DEFAULT NULL,
  `follow_up_purchased` tinyint(1) DEFAULT NULL,
  `remark` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `REL_51a9b2ebec49398fea6e5fbf1e` (`session_id`),
  CONSTRAINT `FK_51a9b2ebec49398fea6e5fbf1e7` FOREIGN KEY (`session_id`) REFERENCES `triage_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `triage_session_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `session_id` int NOT NULL,
  `sender` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_0b057c14ec0a4d4ca14b094d1a` (`session_id`,`created_at`),
  CONSTRAINT `FK_fd7dc13f0f371f217f4ab85f676` FOREIGN KEY (`session_id`) REFERENCES `triage_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `triage_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `patient_id` int DEFAULT NULL,
  `consultant_role` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_age` int NOT NULL,
  `patient_gender` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `main_symptom` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `symptom_duration` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity_self` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medical_history` json DEFAULT NULL,
  `current_medication` text COLLATE utf8mb4_unicode_ci,
  `has_exam_result` tinyint(1) NOT NULL DEFAULT '0',
  `patient_city` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `family_remote` tinyint(1) NOT NULL DEFAULT '0',
  `mobility` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lives_alone` tinyint(1) NOT NULL DEFAULT '0',
  `visit_goal` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allergy_info` text COLLATE utf8mb4_unicode_ci,
  `recently_discharged` tinyint(1) NOT NULL DEFAULT '0',
  `raw_input` json DEFAULT NULL,
  `risk_level` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `urgency_level` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scene_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_primary` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_secondary` json DEFAULT NULL,
  `service_route` json DEFAULT NULL,
  `recommended_product` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prep_checklist` json DEFAULT NULL,
  `family_sync_needed` tinyint(1) NOT NULL DEFAULT '0',
  `escalate_to_human` tinyint(1) NOT NULL DEFAULT '0',
  `structured_summary` text COLLATE utf8mb4_unicode_ci,
  `safe_reply_text` text COLLATE utf8mb4_unicode_ci,
  `final_json` json DEFAULT NULL,
  `model_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rule_hits` json DEFAULT NULL,
  `tokens_used` int DEFAULT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `converted_order_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_3796564bc877c7978be3672701f` (`user_id`),
  KEY `FK_7af969d7196b269b3628099aa97` (`patient_id`),
  CONSTRAINT `FK_3796564bc877c7978be3672701f` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK_7af969d7196b269b3628099aa97` FOREIGN KEY (`patient_id`) REFERENCES `service_targets` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `user_memberships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `level_id` int DEFAULT NULL,
  `card_type_id` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `expire_date` date DEFAULT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_recharged` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_b369bfb0586d848e7f52f47d49` (`user_id`),
  KEY `FK_a85f6d5084f155c973515f584f1` (`level_id`),
  KEY `FK_26926134d4715c7d39fe806de4f` (`card_type_id`),
  CONSTRAINT `FK_26926134d4715c7d39fe806de4f` FOREIGN KEY (`card_type_id`) REFERENCES `membership_card_types` (`id`),
  CONSTRAINT `FK_a85f6d5084f155c973515f584f1` FOREIGN KEY (`level_id`) REFERENCES `membership_levels` (`id`),
  CONSTRAINT `FK_b369bfb0586d848e7f52f47d492` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `openid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `union_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','attendant','admin','operator','finance','customer_service','medical_consultant') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `status` tinyint NOT NULL DEFAULT '1',
  `deleted_at` datetime(6) DEFAULT NULL,
  `ui_mode` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_9c98f005249412c8333a3b2c59` (`openid`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
