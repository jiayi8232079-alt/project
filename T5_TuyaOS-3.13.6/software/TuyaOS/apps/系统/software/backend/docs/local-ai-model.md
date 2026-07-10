# 本地 AI 模型开发

后端默认按 OpenAI 兼容接口访问本地模型：

```text
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=qwen2.5:7b
AI_API_KEY=local-dev
```

Ollama 示例：

```bash
ollama pull qwen2.5:7b
ollama serve
```

如果数据库 `system_configs` 已经有线上模型配置，执行：

```bash
mysql -h127.0.0.1 -uroot -p qiaoguo_health < backend/scripts/set-local-ai-config.sql
```

或者在管理后台的系统配置里把以下键改成本地值：

```text
ai_api_key=local-dev
ai_base_url=http://127.0.0.1:11434/v1
ai_model=qwen2.5:7b
```
