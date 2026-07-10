-- ============================================================
-- 数据库迁移：AI 智能体配置 + 危机词库 v1 —— 2026-06-17
-- 配套：admin「AI 智能体配置 / 危机词库」运营视图（Wave2 2A）
--
-- 新增 2 张表：ai_agent_configs / crisis_words
-- 幂等：CREATE TABLE IF NOT EXISTS（新表）
-- 注意：开发环境 TypeORM synchronize=true 会自动建表；本脚本用于生产（synchronize=false）。
-- 回滚见文件末尾 ROLLBACK 段。
-- ============================================================

USE qiaoguo_health;

-- AI 智能体配置（按租户 + 版本；draft 反复覆盖，publish 时旧版本归档）
CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离）',
  name VARCHAR(64) NOT NULL DEFAULT '陪诊助手' COMMENT '智能体名称',
  model VARCHAR(64) NOT NULL DEFAULT 'DeepSeek' COMMENT '模型',
  system_prompt TEXT NULL COMMENT '系统 Prompt',
  memory_rounds INT NOT NULL DEFAULT 20 COMMENT '记忆消息轮数',
  temperature FLOAT NULL COMMENT '采样温度 0-2',
  knowledge_base TEXT NULL COMMENT '知识库说明 / 引用',
  tools JSON NULL COMMENT '工具开关',
  version INT NOT NULL DEFAULT 1 COMMENT '版本号（单调递增）',
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft' COMMENT '版本状态',
  published_at DATETIME NULL COMMENT '发布时间',
  remark VARCHAR(255) NULL COMMENT '版本备注',
  created_by INT NULL COMMENT '操作者 admin_user_id',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_agent_tenant_status (tenant_id, status),
  KEY idx_agent_tenant_version (tenant_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 智能体配置（带版本）';

-- 危机词库（按租户，可热更新）
CREATE TABLE IF NOT EXISTS crisis_words (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '所属租户 ID（多租户隔离）',
  word VARCHAR(64) NOT NULL COMMENT '危机词 / 短语',
  category VARCHAR(32) NULL COMMENT '分类（自杀 / 急病 / 暴力 / 走失 等）',
  severity ENUM('low','medium','high') NOT NULL DEFAULT 'medium' COMMENT '严重度',
  action ENUM('notify_family','create_alert','escalate') NOT NULL DEFAULT 'create_alert' COMMENT '命中后处置动作',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  remark VARCHAR(128) NULL COMMENT '备注',
  created_by INT NULL COMMENT '操作者 admin_user_id',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_crisis_tenant_enabled (tenant_id, enabled),
  KEY idx_crisis_tenant_word (tenant_id, word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='危机词库（可热更新）';

-- ============================================================
-- ROLLBACK（如需回退，手动执行）
-- DROP TABLE IF EXISTS crisis_words;
-- DROP TABLE IF EXISTS ai_agent_configs;
-- ============================================================
