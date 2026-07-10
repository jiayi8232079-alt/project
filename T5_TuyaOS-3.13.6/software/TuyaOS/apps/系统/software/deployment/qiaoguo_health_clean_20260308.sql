-- MySQL dump 10.13  Distrib 9.4.0, for macos15.4 (arm64)
--
-- Host: 127.0.0.1    Database: qiaoguo_health
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `real_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','attendant','admin','operator','finance','customer_service','medical_consultant') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_2873882c38e8c07d98cb64f962` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attendants`
--

DROP TABLE IF EXISTS `attendants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `real_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile` text COLLATE utf8mb4_unicode_ci,
  `insurance_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `insurance_expiry` date DEFAULT NULL,
  `rating` decimal(2,1) NOT NULL DEFAULT '5.0',
  `total_orders` int NOT NULL DEFAULT '0',
  `status` enum('active','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_e3f47fe0ea94be3cc377596dbd` (`username`),
  KEY `FK_16bc15a552cca926c0cfd3643df` (`user_id`),
  CONSTRAINT `FK_16bc15a552cca926c0cfd3643df` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `consultations`
--

DROP TABLE IF EXISTS `consultations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consultations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `consult_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'online',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_time` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `service_interest` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '感兴趣的服务：checkup/expert/escort/consult/store/fetch',
  `consult_category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '咨询类型主分类（如：医疗资源协调/体检规划/陪诊服务）',
  `consult_sub_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '咨询类型子分类（如：专家匹配/门诊协调/住院协调）',
  PRIMARY KEY (`id`),
  KEY `FK_6b75097e3923dafb9362242037a` (`user_id`),
  CONSTRAINT `FK_6b75097e3923dafb9362242037a` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int DEFAULT NULL,
  `type` enum('health_profile','dispatch_confirmation','service_completion','service_report','expert_match') COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `service_target_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `archive_no` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_e218a8ca53f8f17427b07cb5ddf` (`order_id`),
  CONSTRAINT `FK_e218a8ca53f8f17427b07cb5ddf` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `finance_records`
--

DROP TABLE IF EXISTS `finance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` int DEFAULT NULL,
  `attendant_id` int DEFAULT NULL,
  `type` enum('transport','accommodation','medical','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proof_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewer_id` int DEFAULT NULL,
  `review_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proof_images` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_60d2f5031fc0f7ec5c864021ad4` (`order_id`),
  KEY `FK_051cc1b000cb6a77135440be716` (`attendant_id`),
  CONSTRAINT `FK_051cc1b000cb6a77135440be716` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`),
  CONSTRAINT `FK_60d2f5031fc0f7ec5c864021ad4` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `medication_reminders`
--

DROP TABLE IF EXISTS `medication_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medication_reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `service_target_id` int DEFAULT NULL,
  `order_id` int DEFAULT NULL,
  `medicine_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '药品名称',
  `dosage` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用量/剂量',
  `frequency` enum('once','daily','weekly','custom') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'daily' COMMENT '提醒频率',
  `reminder_times` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '每日提醒时间点列表，如 ["08:00","12:00","18:00"]',
  `start_date` date NOT NULL COMMENT '开始日期',
  `end_date` date NOT NULL COMMENT '结束日期',
  `instructions` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用药说明/备注',
  `status` enum('active','paused','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `channel` enum('wechat_work','mini_program','all') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all' COMMENT '通知渠道',
  `last_notified_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL COMMENT '创建者（管理员ID）',
  PRIMARY KEY (`id`),
  KEY `FK_c314c64ba33df833e7d85911689` (`user_id`),
  KEY `FK_7781f7956d2a1fcba4dd0b9d1e2` (`service_target_id`),
  KEY `FK_6ef311be49f596c2effb279798b` (`order_id`),
  CONSTRAINT `FK_6ef311be49f596c2effb279798b` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_7781f7956d2a1fcba4dd0b9d1e2` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_c314c64ba33df833e7d85911689` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `membership_card_types`
--

DROP TABLE IF EXISTS `membership_card_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `membership_card_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `card_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_days` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `level_id` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `FK_e486f24870868f78d09ac55cefc` (`level_id`),
  CONSTRAINT `FK_e486f24870868f78d09ac55cefc` FOREIGN KEY (`level_id`) REFERENCES `membership_levels` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `membership_levels`
--

DROP TABLE IF EXISTS `membership_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `membership_levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `level_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_rate` decimal(5,2) NOT NULL DEFAULT '100.00',
  `min_recharge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `benefits` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `service_target_id` int NOT NULL,
  `attendant_id` int DEFAULT NULL,
  `status` enum('pending_dispatch','pending_accept','pending_grab','pending_sign','pending_service','in_progress','pending_review','completed','canceled','emergency') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_dispatch',
  `service_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_time` datetime DEFAULT NULL,
  `service_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hospital` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `base_fee` decimal(10,2) DEFAULT NULL,
  `total_fee` decimal(10,2) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `canceled_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sign_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completion_data` json DEFAULT NULL,
  `checkup_package_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `checkup_gender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `checkup_optional_items` json DEFAULT NULL,
  `need_attendant` tinyint NOT NULL DEFAULT '1',
  `attendant_fee` decimal(10,2) DEFAULT NULL,
  `attendant_fee_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendant_extra_income_items` json DEFAULT NULL,
  `additional_service_items` json DEFAULT NULL,
  `settlement_status` enum('pending','settled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payment_status` enum('unpaid','paid','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `payment_method` enum('wechat','alipay','qr_transfer','bank_transfer','cash','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_paid_at` datetime DEFAULT NULL,
  `settled_at` datetime DEFAULT NULL,
  `settlement_remark` text COLLATE utf8mb4_unicode_ci,
  `payment_reference` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_75eba1c6b1a66b09f2a97e6927` (`order_number`),
  KEY `FK_a922b820eeef29ac1c6800e826a` (`user_id`),
  KEY `FK_d959c3492de16a30802103eeb29` (`service_target_id`),
  KEY `FK_f21c645176ba85c9c3c79d9413c` (`attendant_id`),
  CONSTRAINT `FK_a922b820eeef29ac1c6800e826a` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK_d959c3492de16a30802103eeb29` FOREIGN KEY (`service_target_id`) REFERENCES `service_targets` (`id`),
  CONSTRAINT `FK_f21c645176ba85c9c3c79d9413c` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `user_id` int NOT NULL,
  `attendant_id` int DEFAULT NULL,
  `rating` tinyint NOT NULL COMMENT '1-5',
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `tags` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `FK_e4b0ed40bdd0f318108612c2851` (`order_id`),
  KEY `FK_728447781a30bc3fcfe5c2f1cdf` (`user_id`),
  KEY `FK_22f7ae09a3f957b1fbef945c99f` (`attendant_id`),
  CONSTRAINT `FK_22f7ae09a3f957b1fbef945c99f` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`),
  CONSTRAINT `FK_728447781a30bc3fcfe5c2f1cdf` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK_e4b0ed40bdd0f318108612c2851` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schedules`
--

DROP TABLE IF EXISTS `schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attendant_id` int NOT NULL,
  `date` date NOT NULL,
  `period` enum('morning','afternoon','full_day') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('available','booked') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_9f51698a7ffd7446bc1362d6797` (`attendant_id`),
  CONSTRAINT `FK_9f51698a7ffd7446bc1362d6797` FOREIGN KEY (`attendant_id`) REFERENCES `attendants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_targets`
--

DROP TABLE IF EXISTS `service_targets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_targets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idCard` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '加密存储',
  `gender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age` int DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_contact` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `health_profile` json DEFAULT NULL,
  `main_appeal` text COLLATE utf8mb4_unicode_ci,
  `signature_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wechat_group_webhook` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `FK_0ee70d9522652b6f3b7d33bb735` (`user_id`),
  CONSTRAINT `FK_0ee70d9522652b6f3b7d33bb735` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_timelines`
--

DROP TABLE IF EXISTS `service_timelines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_timelines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `operator_id` int DEFAULT NULL,
  `type` enum('text','image','audio_question','audio_advice','file','node','service_start','service_end','emergency') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `visible_to_user` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_d1dbe89cb1224b76950a91a6826` (`order_id`),
  CONSTRAINT `FK_d1dbe89cb1224b76950a91a6826` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_configs`
--

DROP TABLE IF EXISTS `system_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_5aff9a6d272a5cedf54d7aaf61` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_memberships`
--

DROP TABLE IF EXISTS `user_memberships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_memberships` (
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
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `openid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `union_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','attendant','admin','operator','finance','customer_service','medical_consultant') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `status` tinyint NOT NULL DEFAULT '1',
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_9c98f005249412c8333a3b2c59` (`openid`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-08 13:44:23

SET FOREIGN_KEY_CHECKS=0;

-- ==============================
-- Clean production seed data
-- Preserved: pricing, package, role and membership configuration
-- Removed: users, service targets, orders, finance records, timelines, documents,
--          schedules, consultations, reminders, reviews and any runtime/demo data.
-- Secrets such as webhook, COS key, enterprise WeCom app credentials are not exported.
-- Admin user rows are intentionally not exported. Create the first admin via env seed.
-- ==============================

INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('attendant_fee_pricing','[{"label":"青田半日","fee":120,"status":true},{"label":"青田全日","fee":200,"status":true},{"label":"温州丽水（全日）","fee":240,"status":true},{"label":"杭州上海（全日）","fee":300,"status":true},{"label":"北京（全日）","fee":350,"status":true}]','陪诊员费用定价配置',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('checkup_packages','[{"id":"region_lishui","name":"丽水","hospital":"丽水市中心医院国际健康管理中心","packages":[{"id":"ls_m_01","name":"青年男性基础套餐(菁英)","gender":"male","targetGroup":"适合30岁以下男士（普通）","price":720,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、AFP、CEA、CA199、萎缩性胃炎抗体","specialItems":"胸片（DR正侧位）、心电多项分析、肝胆脾双肾及输尿管彩超","notes":"提供营养早餐","status":true},{"id":"ls_m_02","name":"青年男性详细套餐(菁英)","gender":"male","targetGroup":"适合30岁以下男士（适合偏肥胖人群）","price":1065,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、AFP、CEA、CA199、甲状腺功能7项、C肽+胰岛素(空腹)、萎缩性胃炎抗体","specialItems":"胸片（DR正侧位）、心电多项分析、肝胆脾双肾及输尿管彩超","notes":"提供营养早餐","status":true},{"id":"ls_m_03","name":"精英男性基础套餐(尊享)","gender":"male","targetGroup":"适合31-45岁左右男士（普通）","price":1635,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、男性肿瘤标志物7项、甲状腺功能7项、叶酸、VB12、铁蛋白、萎缩性胃炎抗体","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超","notes":"提供营养早餐","status":true},{"id":"ls_m_04","name":"精英男性详细套餐(尊享)","gender":"male","targetGroup":"适合31-45岁左右男士（适合偏肥胖人群）","price":2280,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、男性肿瘤标志物7项、甲状腺功能7项、C肽+胰岛素(空腹)、同型半胱氨酸、血沉、C反应蛋白、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、心肌酶","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、前列腺彩超、C14检查、双能X线骨密度","notes":"提供营养早餐","status":true},{"id":"ls_m_05","name":"成功男士基础套餐（至尊）","gender":"male","targetGroup":"适合45岁以上男士","price":3338,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、男性肿瘤标志物12项、血电解质、甲状腺功能7项、同型半胱氨酸、血沉、C反应蛋白、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、心肌酶、骨质疏松监测","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、前列腺彩超、C14检查、脑血管超声、双能X线骨密度、冠心病风险筛查、动脉硬化","notes":"提供营养早餐","status":true},{"id":"ls_m_06","name":"成功男士全面套餐（至尊）","gender":"male","targetGroup":"适合45岁以上男士","price":4266,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂4项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、男性肿瘤标志物12项、血电解质、甲状腺功能7项、血沉、C反应蛋白、类风湿因子、心梗筛查、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、肺通气功能、乙肝三系、骨质疏松监测","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、颈椎锁动脉彩超、前列腺彩超、C13检查、脑血管超声、双能X线骨密度、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_f_01","name":"青年女性基础套餐(菁英)","gender":"female","targetGroup":"适合30岁以下女士（普通）","price":1091,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、AFP、CEA、CA199、萎缩性胃炎抗体、阴道分泌物检查","specialItems":"胸片（DR正侧位）、心电多项分析、肝胆脾双肾及输尿管彩超、乳超、阴超、TCT","notes":"提供营养早餐（未婚720/已婚1091）","status":true},{"id":"ls_f_02","name":"青年女性详细套餐(菁英)","gender":"female","targetGroup":"适合30岁以下女士（适合偏肥胖人群）","price":1436,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、AFP、CEA、CA199、甲状腺功能7项、C肽+胰岛素(空腹)、萎缩性胃炎抗体、阴道分泌物检查","specialItems":"胸片（DR正侧位）、心电多项分析、肝胆脾双肾及输尿管彩超、乳超、阴超、TCT","notes":"提供营养早餐","status":true},{"id":"ls_f_03","name":"白领女性基础套餐(尊享)","gender":"female","targetGroup":"适合31-45岁左右女士（普通）","price":2006,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、女性肿瘤标志物7项、甲状腺功能7项、叶酸、VB12、铁蛋白、糖化血红蛋白、萎缩性胃炎抗体、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、乳超、阴超、TCT","notes":"提供营养早餐","status":true},{"id":"ls_f_04","name":"白领女性详细套餐(尊享)","gender":"female","targetGroup":"适合31-45岁左右女士（适合偏肥胖人群）","price":2920,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、女性肿瘤标志物7项、甲状腺功能7项、C肽+胰岛素(空腹)、同型半胱氨酸、血沉、C反应蛋白、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、心肌酶、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、乳超、阴超、C14检查、双能X线骨密度、TCT、HPV E6/E7","notes":"提供营养早餐","status":true},{"id":"ls_f_05","name":"成功女士基础套餐（至尊）","gender":"female","targetGroup":"适合45岁以上女士","price":3848,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、C肽胰岛素、肾功能3项、糖化血红蛋白、女性肿瘤标志物12项、血电解质、甲状腺功能7项、同型半胱氨酸、血沉、C反应蛋白、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、心肌酶、骨质疏松监测、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、乳超、阴超、C14检查、脑血管超声、双能X线骨密度、冠心病风险筛查、TCT、HPV E6/E7","notes":"提供营养早餐","status":true},{"id":"ls_f_06","name":"成功女士全面套餐（至尊）","gender":"female","targetGroup":"适合45岁以上女士","price":4620,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、肾功能3项、血糖、糖化血红蛋白、C肽胰岛素、同型半胱氨酸、女性肿瘤标志物12项、血电解质、甲状腺功能7项、血沉、C反应蛋白、类风湿因子、心梗筛查、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、颈椎锁动脉彩超、乳超、阴超、C13检查、脑血管超声、双能X线骨密度、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_c_01","name":"儿童生长发育套餐","gender":"child","targetGroup":"适合儿童","price":1251,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、糖化血红蛋白、C肽胰岛素、乙肝三系、25羟维生素D、肾功能3项、AFP、CEA、CA199、微量元素10项、胰岛素样生长因子","specialItems":"胸片DR正位、心电多项分析、肝胆脾双肾及输尿管彩超、骨龄测定","notes":"提供营养早餐","status":true},{"id":"ls_m_07","name":"肺结节套餐（男）","gender":"male","targetGroup":"适合肺部结节、吸烟爱好人群","price":4023,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、男性肿瘤标志物12项、血电解质、甲状腺功能7项、心梗筛查、胃蛋白酶Ⅰ/Ⅱ、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）或靶扫描（大于5mm结节）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、前列腺彩超、双能X线骨密度、冠心病风险筛查、动脉硬化、中医红外线检测(空腹)、AI睡眠监测（第二天送回）","notes":"提供营养早餐","status":true},{"id":"ls_m_08","name":"疲劳人群套餐（男）","gender":"male","targetGroup":"适合工作压力大、经常熬夜、疲劳人群","price":4202,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、(尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、男性肿瘤标志物7项、甲状腺功能7项、心梗筛查、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、心脏彩超、前列腺彩超、C13检查、双能X线骨密度、MRI(头颅默认、颈椎、腰椎三选一)、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_m_09","name":"胃肠镜体检套餐（男）","gender":"male","targetGroup":"适合消化系统疾病筛查","price":5670,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、男性肿瘤标志物12项、血电解质、甲状腺功能7项、血沉、C反应蛋白、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈椎锁动脉彩超、前列腺B超、C13检查、脑血管超声、双能X线骨密度、无痛胃肠镜（含泻药）、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_m_10","name":"三高人群筛查套餐（男）","gender":"male","targetGroup":"适合高血压、高血脂、高血糖及饮酒爱好人群","price":5361,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、心梗筛查、男性肿瘤标志物7项、血电解质、血粘度、甲状腺功能7项、C反应蛋白、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、前列腺彩超、C13检查、脑血管超声、双能X线骨密度、头颈CTA+冠心病风险评估/胸痛三联症CTA+颈椎锁动脉彩超（二选一）、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_m_11","name":"肿瘤筛查套餐A（男）","gender":"male","targetGroup":"适合全身早期肿瘤详细筛查","price":7656,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、肾功能3项、血脂4项、血糖、男性肿瘤标志物12项、25羟维生素D3、血电解质、甲状腺功能7项、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、乙肝三系","specialItems":"心电多项分析、C13检查、双能X线骨密度、全身PET-CT、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_f_07","name":"备孕套餐（女）","gender":"female","targetGroup":"适合备孕女士","price":2993,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、AFP、CEA、CA199、C肽+胰岛素(空腹)、25羟维生素D3、甲状腺功能7项、叶酸、VB12、铁蛋白、TORCH、性激素7项、抗心磷脂抗体、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、乙肝三系、阴道分泌物检查","specialItems":"心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、乳超、阴超、中医红外线体质辨识(空腹)、TCT、HPV E6/E7","notes":"提供营养早餐","status":true},{"id":"ls_f_08","name":"肺结节套餐（女）","gender":"female","targetGroup":"适合肺部结节、吸烟爱好人群","price":4377,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、女性肿瘤标志物全套12项、血电解质、甲状腺功能7项、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）或靶扫描（大于5mm结节）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、乳超、阴超、双能X线骨密度、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_f_09","name":"疲劳人群套餐（女）","gender":"female","targetGroup":"适合工作压力大、经常熬夜人群","price":4556,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、女性肿瘤标志物7项、甲状腺功能7项、心梗筛查、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、心脏彩超、乳超、阴超、C13检查、双能X线骨密度、MRI(头颅默认、颈椎、腰椎三选一)、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_f_10","name":"三高人群筛查套餐（女）","gender":"female","targetGroup":"适合高血压、高血脂、高血糖及饮酒爱好人群","price":5750,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、心梗筛查、女性肿瘤标志物7项、血电解质、血粘度、甲状腺功能7项、C反应蛋白、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、乳超、阴超、C13检查、脑血管超声、双能X线骨密度、头颈CTA+冠心病风险评估/胸痛三联症CTA+颈椎锁动脉彩超（二选一）、动脉硬化、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_f_11","name":"胃肠镜体检套餐（女）","gender":"female","targetGroup":"适合消化系统疾病筛查","price":6048,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、女性肿瘤标志物7项、血电解质、甲状腺功能7项、血沉、C反应蛋白、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈椎锁动脉彩超、乳超、阴超、乳腺钼靶、C13检查、脑血管超声、双能X线骨密度、无痛胃肠镜（含泻药）、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_f_12","name":"肿瘤筛查套餐A（女）","gender":"female","targetGroup":"适合全身早期肿瘤详细筛查","price":7909,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、肾功能3项、血脂4项、血糖、女性肿瘤标志物12项、血电解质、甲状腺功能7项、25羟维生素D3、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、乙肝三系、阴道分泌物检查","specialItems":"心电多项分析、C13检查、双能X线骨密度、全身PET-CT、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_vip_m_01","name":"睡眠亚健康人群入住VIP套餐（男）","gender":"male","targetGroup":"适合工作压力大、经常熬夜、疲劳人群","price":5525,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准监测、大便常规+OB、肠道健康基因检测（粪便）、肝功能2号、血脂4项、血糖、肾功能3项、男性肿瘤标志物7项、甲状腺功能7项、心梗筛查、辅酶Q10、褪黑素、酒精代谢基因检测、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、心脏彩超、前列腺彩超、C13检查、双能X线骨密度、冠心病风险筛查、睡眠监测（第二天送回）、中医红外线体质辨识(空腹)、动脉硬化","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_m_02","name":"心脑血管筛查入住式VIP套餐（男）","gender":"male","targetGroup":"适合高血压、高血脂、高血糖及饮酒爱好人群","price":5486,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准监测、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、心梗筛查、男性肿瘤标志物7项、EB病毒抗体、血电解质、血粘度、甲状腺功能7项、叶酸、VB12、铁蛋白、C反应蛋白、抗O、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、前列腺彩超、C13检查、脑血管超声、双能X线骨密度、头颈CTA+冠心病风险评估/胸痛三联症CTA+颈椎锁动脉彩超（二选一）、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_m_03","name":"消化病筛查入住式VIP套餐（男）","gender":"male","targetGroup":"适合消化系统疾病筛查","price":5999,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、心梗筛查、男性肿瘤标志物12项、EB病毒抗体、血电解质、甲状腺功能7项、凝血功能、血沉、C反应蛋白、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、前列腺彩超、颈椎锁动脉彩超、C13检查、脑血管超声、双能X线骨密度、无痛胃肠镜（含泻药）、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_m_04","name":"肿瘤筛查入住式VIP套餐（男）","gender":"male","targetGroup":"早期肿瘤、心脑血管详细筛查","price":11155,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准监测、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、心梗筛查、男性肿瘤标志物12项、EB病毒抗体、血电解质、胃蛋白酶原（Ⅰ、Ⅱ）、甲状腺功能7项、凝血功能、血沉、C反应蛋白、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"心电多项分析、颈椎锁动脉彩超、脑血管超声、C13检查、双能X线骨密度、无痛胃肠镜（含泻药）、全身PET-CT、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_m_05","name":"PET-CT基因检测入住式VIP套餐（男）","gender":"male","targetGroup":"早期肿瘤、心脑血管详细筛查","price":27270,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、(尿液）膀胱癌精准监测、大便常规+OB、肠道健康基因检测（粪便）、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、男性肿瘤标志物全套、EB病毒抗体、血电解质、心梗筛查、甲状腺功能7项、凝血功能、胃蛋白酶原（Ⅰ、Ⅱ）、血沉、C反应蛋白、特定蛋白全套、辅酶Q10、褪黑素、酒精代谢基因检测、免疫细胞线粒体功能检测、早发冠心病风险基因检测、阿尔兹海默症筛查、认知障碍基因检测、同型半胱氨酸代谢通路检测、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"心电多项分析、甲状腺彩超、颈椎锁动脉彩超、脑血管超声、C13检查、双能X线骨密度、冠心病风险筛查、无痛胃肠镜（含泻药）、男性23种遗传性肿瘤基因检测、中医红外线体质辨识(空腹)、全身PET-CT、头MRI、腰MRI、颈MRI、头颈CTA、AI睡眠监测（第二天送回）","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_f_01","name":"睡眠亚健康人群入住VIP套餐（女）","gender":"female","targetGroup":"适合工作压力大、经常熬夜人群","price":5879,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肠道健康基因检测（粪便）、肝功能2号、血脂4项、血糖、肾功能3项、女性肿瘤标志物7项、甲状腺功能7项、心梗筛查、辅酶Q10、褪黑素、酒精代谢基因检测、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、心脏彩超、乳超、阴超、C13检查、双能X线骨密度、冠心病风险筛查、动脉硬化、AI睡眠监测（第二天送回）、中医红外线体质辨识(空腹)、TCT、HPV E6/E7","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_f_02","name":"心脑血管筛查入住式VIP套餐（女）","gender":"female","targetGroup":"适合高血压、高血脂、高血糖及饮酒爱好人群","price":5840,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、心梗筛查、女性肿瘤标志物7项、EB病毒抗体、血电解质、血粘度、甲状腺功能7项、叶酸、VB12、铁蛋白、C反应蛋白、抗O、类风湿因子、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、C13检查、脑血管超声、双能X线骨密度、动脉硬化、中医红外线体质辨识(空腹)、乳超、阴超、头颈CTA+冠心病风险评估/胸痛三联症CTA+颈椎锁动脉彩超（二选一）、AI睡眠监测（第二天送回）、TCT、HPV E6/E7","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_f_03","name":"消化病筛查入住式VIP套餐（女）","gender":"female","targetGroup":"适合消化系统疾病筛查","price":6670,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、心梗筛查、女性肿瘤标志物12项、EB病毒抗体、血电解质、甲状腺功能7项、凝血功能、血沉、C反应蛋白、特定蛋白全套、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、C13检查、脑血管超声、双能X线骨密度、无痛胃肠镜（含泻药）、冠心病风险筛查、动脉硬化、中医红外线体质辨识(空腹)、AI睡眠监测（第二天送回）、乳超、阴超、TCT、HPV E6/E7","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_f_04","name":"肿瘤筛查入住式VIP套餐（女）","gender":"female","targetGroup":"早期肿瘤、心脑血管详细筛查","price":12997,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、心梗筛查、女性肿瘤标志物12项、EB病毒抗体、血电解质、胃蛋白酶原（Ⅰ、Ⅱ）、甲状腺功能7项、凝血功能、血沉、C反应蛋白、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"心电多项分析、颈椎锁动脉彩超、脑血管超声、双能X线骨密度、C13检查、无痛胃肠镜（含泻药）、全身PET-CT、中医红外线体质辨识(空腹)、TCT、HPV E6/E7、AI睡眠监测（第二天送回）","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_vip_f_05","name":"PET-CT基因检测入住式VIP套餐（女）","gender":"female","targetGroup":"早期肿瘤、心脑血管详细筛查","price":27522,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、妇科检查、人体成分分析","labItems":"血常规、尿常规、(尿液）膀胱癌精准监测、大便常规+OB、肠道健康基因检测（粪便）、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、C肽+胰岛素（空腹）、同型半胱氨酸、女性肿瘤标志物全套、EB病毒抗体、血电解质、心梗筛查、甲状腺功能7项、凝血功能、胃蛋白酶原（Ⅰ、Ⅱ）、血沉、C反应蛋白、特定蛋白全套、辅酶Q10、褪黑素、酒精代谢基因检测、免疫细胞线粒体功能检测、早发冠心病风险基因检测、阿尔兹海默症筛查、认知障碍基因检测、同型半胱氨酸代谢通路检测、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"心电多项分析、甲状腺彩超、颈椎锁动脉彩超、脑血管超声、C13检查、双能X线骨密度、冠心病风险筛查、无痛胃肠镜（含泻药）、女性24种遗传性肿瘤基因检测、中医红外线体质辨识(空腹)、全身PET-CT、头MRI、腰MRI、颈MRI、头颈CTA、AI睡眠监测（第二天送回）、TCT、HPV E6/E7","notes":"提供三餐及住宿（一晚）、陪同检查","status":true},{"id":"ls_hq_m_01","name":"华侨菁英套餐（男）","gender":"male","targetGroup":"适合45岁以下男士","price":4492,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、男性肿瘤标志物12项、血电解质、甲状腺功能7项、血沉、C反应蛋白、类风湿因子、心梗筛查、胃蛋白酶原（Ⅰ、Ⅱ）、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、颈椎锁动脉彩超、前列腺彩超、C13检查、双能X线骨密度、脑血管超声、冠心病风险筛查、动脉硬化","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_hq_m_02","name":"华侨尊享PET-CT套餐（男）","gender":"male","targetGroup":"适合全身早期肿瘤详细筛查","price":9453,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、肾功能3项、血脂7项、血糖、糖化血红蛋白、同型半胱氨酸、男性肿瘤标志物12项、血电解质、甲状腺功能7项、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"心电多项分析、C13检查、双能X线骨密度、全身PET-CT、中医红外线体质辨识(空腹)","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_hq_m_03","name":"华侨至尊详细PET-CT套餐（男）","gender":"male","targetGroup":"早期肿瘤、胃肠镜详细筛查","price":11830,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、（尿液）膀胱癌精准监测、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、心梗筛查、男性肿瘤标志物12项、EB病毒抗体、血电解质、甲状腺功能7项、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"心电多项分析、颈椎锁动脉彩超、C13检查、双能X线骨密度、无痛胃肠镜（含泻药）、全身PET-CT、中医红外线体质辨识(空腹)","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_hq_f_01","name":"华侨菁英套餐（女）","gender":"female","targetGroup":"适合45岁以下女士","price":4742,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、女性肿瘤标志物12项、血电解质、甲状腺功能7项、血沉、C反应蛋白、类风湿因子、心梗筛查、胃蛋白酶原（Ⅰ、Ⅱ）、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、颈椎锁动脉彩超、C13检查、双能X线骨密度、脑血管超声、冠心病风险筛查、动脉硬化、乳超、阴超、TCT、HPV E6/E7","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_hq_f_02","name":"华侨尊享PET-CT套餐（女）","gender":"female","targetGroup":"适合全身早期肿瘤详细筛查","price":9705,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、肾功能3项、血脂7项、血糖、糖化血红蛋白、同型半胱氨酸、女性肿瘤标志物12项、血电解质、甲状腺功能7项、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"心电多项分析、C13检查、双能X线骨密度、全身PET-CT、中医红外线体质辨识(空腹)、TCT、HPV E6/E7","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_hq_f_03","name":"华侨至尊详细PET-CT套餐（女）","gender":"female","targetGroup":"早期肿瘤、胃肠镜详细筛查","price":12082,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、心梗筛查、女性肿瘤标志物12项、EB病毒抗体、血电解质、甲状腺功能7项、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"心电多项分析、颈椎锁动脉彩超、C13检查、双能X线骨密度、无痛胃肠镜（含泻药）、全身PET-CT、中医红外线体质辨识(空腹)、TCT、HPV E6/E7","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_m_01","name":"酒精代谢套餐（男）","gender":"male","targetGroup":"适合饮酒人群","price":4612,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、(尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、男性肿瘤标志物全套、EB病毒抗体、甲状腺功能7项、心梗筛查、酒精代谢基因检测、25羟维生素D3、血电解质、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、心脏彩超、前列腺彩超、C13检查、双能X线、冠心病风险筛查、动脉硬化、脑血管超声、AI睡眠监测（第二天送回）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_m_02","name":"肠道、膀胱癌筛查套餐（男）","gender":"male","targetGroup":"适合肠道、膀胱癌筛查","price":5023,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、(尿液）膀胱癌精准检测、大便常规+OB、无创肠癌早筛基因（大便)、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、心梗筛查、男性肿瘤标志物全套、EB病毒抗体、血电解质、胃蛋白酶原（Ⅰ、Ⅱ）、甲状腺功能7项、血沉、C反应蛋白、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、C13检查、前列腺B超、双能X线、冠心病风险筛查、动脉硬化","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_m_03","name":"免疫力筛查套餐（男）","gender":"male","targetGroup":"适合工作强度大，休息时间不足、免疫功能受损人群","price":6646,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、(尿液）膀胱癌精准检测、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、心梗筛查、男性肿瘤标志物全套、EB病毒抗体、血电解质、甲状腺功能7项、血沉、C反应蛋白、特定蛋白全套、淋巴细胞亚群、细胞因子12项、抗核抗体、凝血功能全套、微量元素、过敏原、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、颈椎锁动脉彩超、前列腺彩超、双能X线、C13检查、脑血管超声、冠心病风险筛查、动脉硬化、中医红外线体质辨识（空腹）","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_m_04","name":"体重管理套餐（男）","gender":"male","targetGroup":"适合体重管理人群","price":2527,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、血糖、肾功能3项、糖化血红蛋白、男性肿瘤标志物7项、铁蛋白、甲状腺功能7项、C肽+胰岛素(空腹)、同型半胱氨酸、血沉、C反应蛋白、25羟维生素D","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、前列腺彩超、颈动脉彩超、C14检查、双能X线骨密度、中医红外线体质辨识（空腹）","notes":"提供营养早餐","status":true},{"id":"ls_sp_f_01","name":"酒精代谢套餐（女）","gender":"female","targetGroup":"适合饮酒人群","price":4966,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂4项、血糖、肾功能3项、女性肿瘤标志物全套、EB病毒抗体、甲状腺功能7项、心梗筛查、酒精代谢基因检测、血电解质、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、心脏彩超、C13检查、双能X线、冠心病风险筛查、动脉硬化、脑血管超声、AI睡眠监测（第二天送回）、乳超、阴超、TCT、HPV E6/E7","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_f_02","name":"肠道、膀胱癌筛查套餐（女）","gender":"female","targetGroup":"适合肠道、膀胱癌筛查","price":5376,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、无创肠癌早筛基因（大便)、肝功能2号、血脂4项、血糖、肾功能3项、糖化血红蛋白、同型半胱氨酸、心梗筛查、女性肿瘤标志物全套、EB病毒抗体、血电解质、胃蛋白酶原（Ⅰ、Ⅱ）、甲状腺功能7项、血沉、C反应蛋白、特定蛋白全套、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、C13检查、双能X线、冠心病风险筛查、动脉硬化、乳超、阴超、TCT、HPV E6/E7","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_f_03","name":"免疫力筛查套餐（女）","gender":"female","targetGroup":"适合工作强度大，休息时间不足、免疫功能受损人群","price":7000,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、肾功能3项、血糖、糖化血红蛋白、同型半胱氨酸、心梗筛查、女性肿瘤标志物全套、EB病毒抗体、血电解质、甲状腺功能7项、血沉、C反应蛋白、特定蛋白全套、淋巴细胞亚群、细胞因子12项、抗核抗体、凝血功能全套、微量元素、过敏原、萎缩性胃炎抗体、角蛋白18（脂肪肝筛查）、骨质疏松监测、乙肝三系、肺通气功能、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、心脏彩超、颈椎锁动脉彩超、双能X线、C13检查、脑血管超声、冠心病风险筛查、动脉硬化、中医红外线体质辨识（空腹）、乳超、阴超、TCT、HPV E6/E7","notes":"提供营养早餐、陪同检查","status":true},{"id":"ls_sp_f_04","name":"体重管理套餐（女）","gender":"female","targetGroup":"适合体重管理人群","price":3082,"clinicalItems":"一般情况、内科、外科、眼科、五官科、口腔科、人体成分分析、妇科检查","labItems":"血常规、尿常规、大便常规+OB、肝功能2号、血脂7项、血糖、肾功能3项、糖化血红蛋白、女性肿瘤标志物7项、铁蛋白、甲状腺功能7项、C肽+胰岛素(空腹)、同型半胱氨酸、血沉、C反应蛋白、25羟维生素D、阴道分泌物检查","specialItems":"肺CT（低剂量）、心电多项分析、肝胆脾双肾及输尿管彩超、甲状腺彩超、颈动脉彩超、C14检查、双能X线骨密度、中医红外线体质辨识（空腹）、乳超、阴超、TCT、HPV E6/E7","notes":"提供营养早餐","status":true}],"optionalItems":[{"id":"opt_1","name":"动脉硬化筛查","price":80,"unit":"次","specimen":"特检","status":true},{"id":"opt_2","name":"冠心病风险筛查","price":200,"unit":"次","specimen":"特检","status":true},{"id":"opt_3","name":"心梗筛查","price":134,"unit":"次","specimen":"血","status":true},{"id":"opt_4","name":"肺癌七项抗体检测","price":450,"unit":"次","specimen":"血","status":true},{"id":"opt_5","name":"辅酶Q10精准检测","price":140,"unit":"次","specimen":"血","status":true},{"id":"opt_6","name":"褪黑色水平分析","price":200,"unit":"次","specimen":"血","status":true},{"id":"opt_7","name":"肠道健康基因检测","price":800,"unit":"次","specimen":"粪便","status":true},{"id":"opt_8","name":"酒精代谢基因（ADH1B/ALDH2）","price":365,"unit":"次","specimen":"血","status":true},{"id":"opt_9","name":"无创肠癌早筛基因检测","price":731,"unit":"次","specimen":"粪便","status":true},{"id":"opt_10","name":"HPV E6/E7","price":280,"unit":"次","specimen":"病理","status":true},{"id":"opt_11","name":"尿液膀胱癌筛查","price":155,"unit":"次","specimen":"尿液","status":true},{"id":"opt_12","name":"尿液膀胱癌精准检测","price":301,"unit":"次","specimen":"尿液","status":true},{"id":"opt_13","name":"中医红外线体质辨别","price":98,"unit":"次","specimen":"中医","status":true},{"id":"opt_14","name":"AI睡眠检测筛查","price":100,"unit":"次","specimen":"睡眠","status":true},{"id":"opt_15","name":"大自血治疗","price":380,"unit":"次","specimen":"血","status":true},{"id":"opt_16","name":"华常康®粪便DNA甲基化检测","price":780,"unit":"次","status":true},{"id":"opt_17","name":"同型半胱氨酸代谢通路检测","price":780,"unit":"次","status":true},{"id":"opt_18","name":"多种神经酰胺检测","price":450,"unit":"次","status":true},{"id":"opt_19","name":"氧化三甲胺代谢通路检测","price":400,"unit":"次","status":true},{"id":"opt_20","name":"遗传性肿瘤基因检测-女性套餐（24种）","price":8580,"unit":"次","status":true},{"id":"opt_21","name":"遗传性肿瘤基因检测-男性套餐（23种）","price":8580,"unit":"次","status":true},{"id":"opt_22","name":"单基因遗传病扩展性携带者筛查","price":2900,"unit":"次","status":true},{"id":"opt_23","name":"早发冠心病风险基因检测","price":660,"unit":"次","status":true},{"id":"opt_24","name":"认知障碍基因检测","price":2200,"unit":"次","status":true},{"id":"opt_25","name":"阿尔兹海默症筛查","price":560,"unit":"次","status":true},{"id":"opt_26","name":"遗传性肿瘤基因检测-男性套餐（10种）","price":5800,"unit":"次","status":true},{"id":"opt_27","name":"遗传性肿瘤基因检测-女性套餐（11种）","price":5800,"unit":"次","status":true},{"id":"opt_28","name":"遗传性乳腺癌/卵巢癌基因检测","price":3680,"unit":"次","status":true},{"id":"opt_29","name":"遗传性乳腺癌/卵巢癌BRCA1/2基因检测","price":4680,"unit":"次","status":true},{"id":"opt_30","name":"遗传性胃癌基因检测","price":4680,"unit":"次","status":true},{"id":"opt_31","name":"遗传性肾癌基因检测","price":4680,"unit":"次","status":true},{"id":"opt_32","name":"遗传性前列腺癌基因检测","price":4680,"unit":"次","status":true},{"id":"opt_33","name":"遗传性甲状腺癌基因检测","price":4680,"unit":"次","status":true},{"id":"opt_34","name":"遗传性甲状旁腺癌基因检测","price":5460,"unit":"次","status":true},{"id":"opt_35","name":"遗传性结直肠癌基因检测","price":4680,"unit":"次","status":true},{"id":"opt_36","name":"遗传性胰腺癌基因检测","price":4680,"unit":"次","status":true},{"id":"opt_37","name":"遗传性子宫内膜癌基因检测","price":3900,"unit":"次","status":true},{"id":"opt_38","name":"遗传性肾病基因检测","price":3900,"unit":"次","status":true}]}]','体检套餐配置',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('customer_service_url','https://work.weixin.qq.com/kfid/kfc3d0aa2b4c8406873','企业微信客服链接（小程序客服按钮跳转）',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('roles_config','[{"name":"超级管理员","code":"admin","description":"拥有所有权限","permissions":["order:view","order:dispatch","order:cancel","order:delete","customer:view","customer:edit","attendant:view","attendant:edit","attendant:schedule","finance:view","finance:approve","finance:pricing","content:view","content:edit","system:config","system:role"]},{"name":"运营主管","code":"operator","description":"管理订单和陪诊员","permissions":["order:view","order:dispatch","order:cancel","customer:view","attendant:view","attendant:edit","attendant:schedule","finance:view"]},{"name":"客服专员","code":"customer_service","description":"处理客户咨询和订单","permissions":["order:view","order:dispatch","customer:view","customer:edit"]},{"name":"财务人员","code":"finance","description":"管理财务相关","permissions":["finance:view","finance:approve","finance:pricing","order:view"]}]','角色权限配置',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('service_pricing','[{"name":"全日陪诊","price":699,"unit":"次","status":true},{"name":"检查陪同","price":299,"unit":"次","status":true},{"name":"出入院办理","price":499,"unit":"次","status":true},{"name":"跨市陪诊","price":1299,"unit":"次","status":true},{"name":"挂号服务（不陪诊）","price":50,"unit":"次","status":true}]','陪诊服务定价配置',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('value_added_service_pricing','[{"label":"夜间陪同 +200/晚","fee":200,"status":true},{"label":"住宿陪同 +100/晚","fee":100,"status":true},{"label":"次日续陪 +300/日","fee":300,"status":true},{"label":"次日续陪·北京 +400/日","fee":400,"status":true}]','增值服务配置',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_address','','门店地址',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_description','','门店简介',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_hours','','营业时间',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_latitude','','门店纬度',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_longitude','','门店经度',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_name','青田陪了个伴','门店名称',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_phone','17357867655','门店电话',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('store_wechat','','门店微信号',NOW(),NOW());
INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES ('customer_additional_fee_pricing','[]','客户附加收费项配置',NOW(),NOW());
INSERT INTO membership_levels (`level_name`,`discount_rate`,`min_recharge`,`benefits`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES ('普通会员',100.00,0.00,'基础服务',0,1,NOW(),NOW());
INSERT INTO membership_levels (`level_name`,`discount_rate`,`min_recharge`,`benefits`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES ('银卡会员',95.00,1000.00,'95折优惠',1,1,NOW(),NOW());
INSERT INTO membership_levels (`level_name`,`discount_rate`,`min_recharge`,`benefits`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES ('孝心年卡',100.00,0.00,'孝心年卡专属权益',1,1,NOW(),NOW());
INSERT INTO membership_levels (`level_name`,`discount_rate`,`min_recharge`,`benefits`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES ('金卡会员',90.00,5000.00,'9折优惠',2,1,NOW(),NOW());
INSERT INTO membership_levels (`level_name`,`discount_rate`,`min_recharge`,`benefits`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES ('钻石会员',85.00,10000.00,'85折优惠',3,1,NOW(),NOW());
INSERT INTO membership_card_types (`card_name`,`duration_days`,`price`,`level_id`,`description`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES ('年卡',365,2999.00,NULL,'全年会员权益',1,1,NOW(),NOW());

SET FOREIGN_KEY_CHECKS=1;
