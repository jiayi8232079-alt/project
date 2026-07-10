-- ============================================================
-- 数据库迁移：分层多租户数据汇总（stat 预聚合表）v1 —— 2026-06-17
-- 配套：PRD_分层多租户与三门户联动.md Phase 2 §4.2
--
-- 新增 3 张表：stat_daily / stat_hourly / stat_realtime
-- 幂等：CREATE TABLE IF NOT EXISTS（新表，无需列检查）
-- 注意：开发环境 TypeORM synchronize=true 会自动建表，本脚本用于生产环境（synchronize=false）
-- ============================================================

USE qiaoguo_health;

-- 按日聚合（运营指标）
CREATE TABLE IF NOT EXISTS stat_daily (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '直接产生数据的最底层租户 ID',
  stat_date DATE NOT NULL COMMENT '统计日期',
  metric VARCHAR(64) NOT NULL COMMENT '指标 key',
  value DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT '指标值',
  dimensions JSON NULL COMMENT '维度细分',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_stat_daily (tenant_id, stat_date, metric),
  KEY idx_stat_daily_metric_date (metric, stat_date),
  KEY idx_stat_daily_tenant_date (tenant_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='按日预聚合统计（分层大盘数据源）';

-- 按小时聚合（实时性高的指标，如设备在线率）
CREATE TABLE IF NOT EXISTS stat_hourly (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '直接产生数据的最底层租户 ID',
  stat_hour DATETIME NOT NULL COMMENT '统计整点',
  metric VARCHAR(64) NOT NULL COMMENT '指标 key',
  value DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT '指标值',
  dimensions JSON NULL COMMENT '维度细分',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_stat_hourly (tenant_id, stat_hour, metric),
  KEY idx_stat_hourly_metric_hour (metric, stat_hour),
  KEY idx_stat_hourly_tenant_hour (tenant_id, stat_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='按小时预聚合统计';

-- 实时快照（5min 刷新一次，每个 (租户,指标) 只保留最新一条）
CREATE TABLE IF NOT EXISTS stat_realtime (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '直接产生数据的最底层租户 ID',
  metric VARCHAR(64) NOT NULL COMMENT '指标 key',
  value DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT '指标值（最新快照）',
  dimensions JSON NULL COMMENT '维度细分',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_stat_realtime (tenant_id, metric),
  KEY idx_stat_realtime_metric (metric)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实时快照统计';

-- ============================================================
-- ROLLBACK（如需回滚，手动执行以下语句）
-- ============================================================
-- DROP TABLE IF EXISTS stat_daily;
-- DROP TABLE IF EXISTS stat_hourly;
-- DROP TABLE IF EXISTS stat_realtime;
