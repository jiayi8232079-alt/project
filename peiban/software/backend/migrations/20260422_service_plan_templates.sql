-- 迁移说明：专业服务方案模板 + 订单挂载方案
--
-- 目标：给营养师/康复师/月嫂/居家护理员等职业提供"可复用的方案沉淀 + 订单挂载"能力，
--      一张 service_plan_templates 用 kind 区分类型（meal_plan / training_plan / care_log / other）。
--
-- 幂等：CREATE TABLE IF NOT EXISTS，可重复执行。

CREATE TABLE IF NOT EXISTS service_plan_templates (
  id INT NOT NULL AUTO_INCREMENT,
  kind ENUM('meal_plan','training_plan','care_log','other') NOT NULL COMMENT '模板类型',
  author_user_id INT NULL COMMENT '创建者',
  title VARCHAR(128) NOT NULL,
  cover_image VARCHAR(512) NULL,
  target_conditions JSON NULL COMMENT '适用病情/人群标签',
  summary TEXT NULL,
  content JSON NOT NULL COMMENT '结构化内容，因 kind 而异',
  tags JSON NULL,
  is_public TINYINT NOT NULL DEFAULT 0 COMMENT '是否公共模板',
  use_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_spt_kind_author (kind, author_user_id),
  KEY IDX_spt_kind_public (kind, is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='专业服务方案模板（食谱/训练/育护日志/其他）';

CREATE TABLE IF NOT EXISTS order_service_plans (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  kind ENUM('meal_plan','training_plan','care_log','other') NOT NULL,
  template_id INT NULL,
  title VARCHAR(128) NOT NULL,
  summary TEXT NULL,
  content JSON NOT NULL,
  attached_by_user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_osp_order_kind (order_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单挂载的具体服务方案';
