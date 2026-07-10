-- 迁移说明：用药提醒模板切换 + 剂量字典适配
--
-- 背景：
--   1) 旧模板 y2n2jnzZ7UYe_FZ79KUQMptjP8K0V01S7_8cTff-D4E 剂量字段是 short_thing7（≤ 5 字符，支持中文）；
--   2) 运营侧已经将「用药提醒」订阅消息模板切换到新模板
--      TfD0CMvPSadTePFKpbyQCTRRqmd6Jqe13QHHznb（「每日用药提醒」），
--      剂量字段变成了 character_string4（字母/数字/符号，32 字以内）。
--   3) 因此需要：
--      (a) 把 system_configs 里 mini_program_template_medication_reminder 更新到新模板 ID；
--      (b) 把 medication_dosage_dictionary 换成与 character_string4 兼容的方案 C 字典；
--      (c) medication_dosage_fallback 保持 "按医嘱" 不变。
--
-- 幂等性：用 ON DUPLICATE KEY UPDATE / UPDATE 语句，可安全重复执行。

INSERT INTO system_configs (`key`, `value`, `description`, `created_at`, `updated_at`)
VALUES
  ('mini_program_template_medication_reminder',
   'TfD0CMvPSadTePFKpbyQCTRRqmd6Jqe13QHHznb',
   '小程序订阅消息模板ID-每日用药提醒（剂量字段为 character_string4）',
   NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `description` = VALUES(`description`),
  `updated_at` = NOW();

-- 字典 v2：数字+中文单位组合，适配 character_string4 类型（实测通过）
-- 若运营已在 admin 后台自定义改过字典，本脚本会覆盖；如不想覆盖请改为 INSERT IGNORE。
UPDATE system_configs
SET `value` = '["1片/次","2片/次","1粒/次","3滴/次","5ml","10ml","1日3次","1日2次","按医嘱"]',
    `description` = '用药提醒订阅消息剂量字典（JSON 数组，每项 ≤ 20 字，用于 admin / 小程序下拉选择；适配 character_string4）',
    `updated_at` = NOW()
WHERE `key` = 'medication_dosage_dictionary';
