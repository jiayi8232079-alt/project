-- 2026-04-18: family_groups 增加头像字段
-- 允许存储：
--   1) 预设 emoji 标识，例如 'preset:home' / 'preset:heart' / 'preset:family' 等
--   2) 自定义图片 URL（相对或完整路径）
--   3) NULL：展示默认房子图标
--
-- 使用 AFTER created_by：UPGRADE_EXISTING_PROD 中本文件在 elder_trust 之前执行，旧库可能尚无
-- assigned_cs_admin_id；created_by 在原始 family_groups 表上必存在。
ALTER TABLE `family_groups`
  ADD COLUMN `avatar_url` VARCHAR(500) NULL DEFAULT NULL
  COMMENT '家庭头像：preset:xxx 或图片 URL；为空则显示默认'
  AFTER `created_by`;
