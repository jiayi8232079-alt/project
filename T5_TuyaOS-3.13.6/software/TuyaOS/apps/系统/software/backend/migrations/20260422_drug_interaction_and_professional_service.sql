-- 迁移说明：药物相互作用规则 + 处方风险报告 + 专业服务目录
--
-- 背景：
--   本轮发布新增 3 张表，entity 已定义但之前没有配套 SQL。生产环境
--   DB_SYNCHRONIZE=false 时必须手动执行本文件建表，否则启动 backend 会报
--   "Unknown column" 或 "Table doesn't exist"。
--
--   1) drug_interaction_rules：药物相互作用规则（内置 + 可运营补充）
--      DrugInteractionService.onApplicationBootstrap 会在首次启动时自动 seed
--      内置高风险规则（抗凝 + NSAID / 抗凝 + 抗抑郁 / 镇静类联用等）；
--      运营可在 admin 后台「内容管理 → 药物相互作用」补充 custom 规则。
--
--   2) prescription_risk_reports：处方 / 服务对象用药风险评估报告
--      每个 scope + 主体 ID 只保留最新一条，重新评估即 upsert。
--
--   3) professional_services：专业服务目录（营养/康复/护理/心理/母婴）
--      ProfessionalServiceService 启动时会 seed 内置目录；
--      admin 后台「内容管理 → 专业服务」可维护。
--
-- 幂等：全部 CREATE TABLE IF NOT EXISTS，可重复执行。

-- ============================================================
-- 1. drug_interaction_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS drug_interaction_rules (
  id INT NOT NULL AUTO_INCREMENT,
  drug_a VARCHAR(64) NOT NULL COMMENT '药物A（通用名）',
  drug_b VARCHAR(64) NOT NULL COMMENT '药物B（通用名）',
  drug_a_aliases TEXT NOT NULL COMMENT 'JSON：药物A别名列表',
  drug_b_aliases TEXT NOT NULL COMMENT 'JSON：药物B别名列表',
  severity ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  mechanism TEXT NOT NULL COMMENT '相互作用机制（通俗描述）',
  recommendation TEXT NOT NULL COMMENT '处理建议',
  evidence_level VARCHAR(8) NULL COMMENT '证据等级 A/B/C',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  source VARCHAR(32) NOT NULL DEFAULT 'builtin' COMMENT 'builtin/custom',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_drug_rule_severity (severity),
  KEY IDX_drug_rule_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='药物相互作用规则（内置 + 可扩展）';

-- ============================================================
-- 2. prescription_risk_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS prescription_risk_reports (
  id INT NOT NULL AUTO_INCREMENT,
  scope ENUM('prescription','target') NOT NULL COMMENT '评估范围',
  user_id INT NOT NULL COMMENT '归属用户（家属）',
  service_target_id INT NULL,
  prescription_id INT NULL,
  risk_level ENUM('none','low','medium','high') NOT NULL DEFAULT 'none' COMMENT '整体风险等级（取最高）',
  findings_count INT NOT NULL DEFAULT 0 COMMENT '发现的相互作用条数',
  payload JSON NOT NULL COMMENT '完整评估结果（medicines+findings+summary）',
  assessed_by INT NULL COMMENT '触发评估的 admin_user_id 或 user_id',
  assessed_at DATETIME NOT NULL COMMENT '评估时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_prr_scope_presc (scope, prescription_id),
  KEY IDX_prr_scope_target (scope, service_target_id),
  KEY IDX_prr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='处方/服务对象用药风险评估报告（最新一份）';

-- ============================================================
-- 3. professional_services
-- ============================================================
CREATE TABLE IF NOT EXISTS professional_services (
  id INT NOT NULL AUTO_INCREMENT,
  category ENUM('nutrition','rehabilitation','nursing','psychology','maternal_child') NOT NULL COMMENT '服务分类',
  code VARCHAR(64) NOT NULL COMMENT '服务编码（订单 serviceType 关联）',
  name VARCHAR(80) NOT NULL COMMENT '服务名称',
  short_desc VARCHAR(180) NOT NULL COMMENT '一句话介绍',
  detail TEXT NULL COMMENT '详细介绍',
  icon VARCHAR(40) NOT NULL DEFAULT 'medical_services' COMMENT 'Material Symbols 图标',
  cover_image VARCHAR(512) NULL COMMENT '封面图 URL',
  target_groups TEXT NOT NULL COMMENT 'JSON：适用人群标签',
  highlights TEXT NOT NULL COMMENT 'JSON：卖点 3~5 条',
  duration_hint VARCHAR(80) NULL COMMENT '周期/单次说明',
  price_display_text VARCHAR(80) NULL COMMENT '展示用定价文案',
  sop_steps JSON NOT NULL COMMENT 'SOP 步骤（JSON 数组）',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  source VARCHAR(32) NOT NULL DEFAULT 'builtin' COMMENT 'builtin/custom',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY UK_prof_service_code (code),
  KEY IDX_prof_service_category (category),
  KEY IDX_prof_service_enabled_sort (enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='专业服务目录（营养/康复/护理/心理支持/母婴育护）';
