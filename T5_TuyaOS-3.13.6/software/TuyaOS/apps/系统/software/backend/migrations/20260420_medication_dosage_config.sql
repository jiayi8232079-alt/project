-- 迁移说明：用药提醒订阅消息剂量字典 & 兜底文案
--
-- 背景：
--   当前选用的小程序订阅消息「用药提醒」模板，剂量字段为 short_thing7，
--   微信官方限制 ≤ 5 个字符（汉字/字母/数字均按 1 字符计）。
--   为保证推送不被拦截，且便于运营统一维护可选剂量，新增如下两条系统配置：
--
--   1) medication_dosage_dictionary：剂量下拉字典（JSON 数组，每项 ≤ 5 字符）
--      admin 后台与小程序端创建用药提醒时，dosage 字段改为从此字典下拉选择。
--   2) medication_dosage_fallback：兜底文案（≤ 5 字符）
--      历史老数据剂量超出 5 字符或为空时，推送改用此兜底文案，避免订阅消息被
--      微信拦截（同时保证家属仍能收到通知）。
--
-- 幂等：INSERT IGNORE 在 key 已存在时跳过，不覆盖管理员自定义值。可重复执行。

INSERT IGNORE INTO system_configs (`key`, `value`, `description`, `created_at`, `updated_at`) VALUES
  ('medication_dosage_dictionary',
   '["1日3次","1日2次","1日1次","1次2粒","1次1片","3滴/次","5ml/次","按医嘱","遵医嘱"]',
   '用药提醒订阅消息剂量字典（JSON 数组，每项 ≤ 5 字符，用于 admin / 小程序下拉选择）',
   NOW(), NOW()),
  ('medication_dosage_fallback',
   '按医嘱',
   '用药提醒订阅消息剂量兜底文案（≤ 5 字符，历史老数据剂量超长或空值时使用）',
   NOW(), NOW());
