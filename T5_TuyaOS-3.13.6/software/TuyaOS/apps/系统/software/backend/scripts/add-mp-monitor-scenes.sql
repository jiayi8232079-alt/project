-- 管理端「小程序码」短 scene 与服务动态 token 映射表（可与 TypeORM synchronize 二选一）
CREATE TABLE IF NOT EXISTS `mp_monitor_scenes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `order_id` int NOT NULL,
  `token` text NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_mp_monitor_scenes_code` (`code`),
  KEY `IDX_mp_monitor_scenes_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
