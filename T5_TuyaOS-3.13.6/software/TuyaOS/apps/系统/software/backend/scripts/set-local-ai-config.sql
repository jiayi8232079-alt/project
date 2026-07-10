INSERT INTO system_configs (`key`, `value`, `description`)
VALUES
  ('ai_api_key', 'local-dev', 'AI API Key（本地开发）'),
  ('ai_base_url', 'http://127.0.0.1:11434/v1', 'AI API 地址（本地开发）'),
  ('ai_model', 'qwen2.5:7b', 'AI 模型名称（本地开发）'),
  ('ai_vision_model', '', 'AI 视觉模型（本地开发默认关闭）'),
  ('ai_vision_api_key', '', '读图专用 API Key（本地开发）'),
  ('ai_vision_base_url', '', '读图专用 API 地址（本地开发）'),
  ('ai_temperature', '0.3', 'AI temperature'),
  ('ai_max_tokens', '2048', 'AI max_tokens')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `description` = VALUES(`description`);
