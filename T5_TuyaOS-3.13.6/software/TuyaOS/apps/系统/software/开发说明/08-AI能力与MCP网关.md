# 08 · AI 能力与 MCP 网关

> 上层导航见 [`README.md`](./README.md)。本篇回答：**系统有哪些 AI 能力、机器人智能体如何通过 MCP 调后端、安全/错误/脱敏怎么做**。
> 相关代码：`backend/src/modules/{ai-gateway,ai-dialog,ai-config,ai-consultation,triage,drug-interaction}`。
> 原始规格：`docs/specs/ai-gateway-mcp-spec.md`、`docs/prompts/companion-agent-system-prompt.zh.md`、`backend/docs/local-ai-model.md`。

---

## 1. AI 能力全景

| 能力 | 模块 | 形态 | 说明 |
|---|---|---|---|
| **AI 陪护对话** | 涂鸦智能体 + `ai-gateway` + `ai-dialog` | 机器人语音 | 老人语音陪聊；智能体经 MCP 调平台能力；对话全量留存 |
| **AI 问诊** | `ai-consultation` | 小程序/App | 症状描述 → AI 建议（非诊断） |
| **智能分诊** | `triage` | 小程序/App | 多轮问答 → 推荐科室/就医建议（会话+消息+反馈） |
| **药物相互作用** | `drug-interaction` | 多端 | 用药风险/冲突检测（规则库） |
| **处方 OCR** | `prescription-ocr` | 护工端 | 处方图片识别 → 结构化 |
| **智能体配置 / 质检** | `ai-config` + admin `ai/` | 后台 | Prompt/知识库/工具开关、危机词库、对话质检 |

模型：OpenAI 兼容协议，支持 DeepSeek / 豆包 / 本地 Ollama，可配置（见 `backend/docs/local-ai-model.md`、`backend/scripts/set-local-ai-config.sql`）。

---

## 2. MCP 网关（`ai-gateway`）

机器人侧 AI（涂鸦智能体）不直接连数据库，而是通过 **MCP over StreamableHTTP** 调用后端 `/mcp` 端点。

| 项 | 值 |
|---|---|
| 端点 | `POST /mcp`（JSON-RPC 2.0：initialize / tools/list / tools/call） |
| 协议 | MCP 2024-11-05，StreamableHTTP（POST + GET SSE） |
| 数据中心 | 中国区（上海），需与智能体一致 |
| 鉴权 | HMAC-SHA256 签名（`AI_GATEWAY_HMAC_SECRET`）+ 涂鸦签名 |
| 上下文 | `X-Device-Id` 反查 userId/tenantId/serviceTargetId |

### 2.1 请求头
`Authorization: Bearer <hmac>` · `X-Tuya-Signature` · `X-Device-Id`(必) · `X-Tenant-Id`(可) · `X-Request-Id`(必,UUID) · `X-Session-Id`(必,多轮同一) · `Content-Type: application/json`。

签名串：`stringToSign = X-Device-Id + '\n' + X-Request-Id + '\n' + body`；5 分钟时钟漂移内验签。

### 2.2 守卫与拦截器（管道）
```
TuyaSignatureGuard(验签) → DeviceContextGuard(deviceId→userId/tenantId/targetId)
  → 工具 execute（assertOwnTarget 越权校验）
  → DesensitizeInterceptor(脱敏) + CircuitBreakerInterceptor(熔断)
  → 落 ai_dialog_log + audit_log
```
**安全铁律**：工具内部**不信任 LLM 传入的 userId**，只信任 `DeviceContext`（来自 deviceId 反查）。

---

## 3. 13 个 MCP 工具

| 工具 | 类型 | 说明 |
|---|---|---|
| `get_profile` | 查询 | 服务对象档案与健康概况 |
| `get_orders` | 查询 | 订单列表 |
| `get_medication_plan` | 查询 | 今日/近期用药计划 |
| `get_health_records` | 查询 | 血压/血糖/体征/周报 |
| `get_escort_report` | 查询 | 陪诊报告与时间线 |
| `get_weather` | 查询 | 天气 + 健康提示 |
| `get_time` | 查询 | 时间/日期/节气 |
| `notify_family` | **操作** | 通知预绑定家属（不接受口述号码；3/min 限流） |
| `create_order` | **操作** | 代下单（**须老人明确确认**；5/min 限流） |
| `cancel_order` | **操作** | 取消订单 |
| `record_medication_taken` | **操作** | 服药打卡（按主观反馈记录） |
| `record_health_metric` | **操作** | 记录单次体征 |
| `guide_app_action` | 引导 | App 操作分步指引（短句） |

代码：`backend/src/modules/ai-gateway/tools/companion-tools.service.ts`。当前为 **mock 实现**，接真实业务 service 时逻辑不变。

---

## 4. 响应包络与错误码

成功：
```json
{ "success": true, "data": {...}, "meta": { "requestId", "durationMs", "cached" } }
```
失败（含给老人朗读的 `userMessage`）：
```json
{ "success": false, "error": { "code": "E_NOT_FOUND", "message": "...", "retryable": false, "userMessage": "我没查到您说的这个订单..." } }
```

| 错误码 | HTTP | 含义 | retryable | Agent 行为 |
|---|---|---|---|---|
| `E_AUTH` | 401 | 鉴权失败 | 否 | 致歉降级 |
| `E_PERMISSION` | 403 | 越权 | 否 | 婉拒「只能查您自己的」 |
| `E_NOT_FOUND` | 404 | 不存在 | 否 | 用 userMessage |
| `E_VALIDATION` | 400 | 参数错 | 否 | 追问澄清 |
| `E_RATE_LIMIT` | 429 | 限流 | 是 | 稍后再试 |
| `E_TIMEOUT` | 504 | 上游超时 | 是 | 请稍等 |
| `E_UPSTREAM` | 502/503 | 上游不可用 | 是 | 系统忙 |
| `E_BUSINESS` | 422 | 业务拒绝 | 否 | 用 userMessage |
| `E_INTERNAL` | 500 | 服务端异常 | 是 | 记录回访 |
| `E_CIRCUIT_OPEN` | 503 | 熔断 | 否 | **进入纯陪聊模式** |

---

## 5. 幂等 / 限流 / 熔断

- **幂等**：`notify_family`(requestId+targetId+severity, 5min) · `create_order`(requestId+scheduledAt+planCode, 5min) · `record_medication_taken`(planId+takenAt 分钟粒度, 1min)。
- **限流**：全局 1000/min；单设备 60/min；写操作 10/min；`notify_family` 3/min；`create_order` 5/min。
- **熔断**：`CircuitBreakerInterceptor` 每工具独立；60s 窗口错误率>50%（≥20 次）→ 熔断 30s → 半开试探；熔断期返回 `E_CIRCUIT_OPEN`，Agent 切纯陪聊。

---

## 6. AI 对话留存（`ai-dialog`）

- `ai_dialog_session`（会话，含 `crisisScore`/`qaStatus` 质检）+ `ai_dialog_log`（单条，含 `direction`/`emotion`/`crisis_words`/`tool_calls`）。
- API：`GET /ai-dialogs`（支持危机/质检筛选）、`GET /ai-dialogs/sessions/:id`、`POST /ai-dialogs/logs`、`finish`、`PATCH qa-status`。
- 合规：全量留存、可按 targetId/sessionId 检索；家属端看摘要（小程序 `ai/dialog-summary`、App `/ai-dialogs`）。

---

## 7. 脱敏（`DesensitizeInterceptor`）

| 字段 | 规则 |
|---|---|
| 手机号 | 中间四位 `*`（138****1234） |
| 身份证 | 仅尾四位 |
| 银行卡 | 仅尾四位 |
| 住址 | 仅到街道 |
| 姓名 | 首字 + `**`（家属角色保留全名） |

---

## 8. 审计与可观测

- 所有 MCP 调用落 `audit_log`：`tenant_id/request_id/device_id/user_id/session_id/tool_name/args(脱敏)/result_summary/success/error_code/duration_ms`；写操作/敏感查询 `severity=high` 进审查队列。
- 指标：`ai_gateway_request_total`、`_duration_ms`(P95>800ms)、`_error_rate`(>5%)、`_tool_circuit_open`、`_auth_failures`。

---

## 9. 配置项（环境变量）

```env
AI_GATEWAY_HMAC_SECRET=...        # 与涂鸦平台同
AI_GATEWAY_TIMEOUT_MS=2800        # 比智能体侧 3000ms 提前返回
AI_GATEWAY_CIRCUIT_ERROR_RATE=0.5
AI_GATEWAY_CIRCUIT_MIN_REQUESTS=20
AI_GATEWAY_CIRCUIT_RESET_MS=30000
TUYA_SIGNATURE_KEY=...
```

---

## 10. 告警双链路（与 AI 解耦，重要）

**跌倒 / SOS 不经 LLM / MCP**：设备/雷达 → 涂鸦云 →（规划 Pulsar）→ 后端 `device` → `alert` 规则引擎 → `realtime` 推家属 → 严重级短信/外呼（规则决定）。
即：**闲聊/查询走 AI；救命走规则引擎**。详见 [`09-设备与硬件接入.md`](./09-设备与硬件接入.md)。

---

## 11. 联调清单

涂鸦智能体「工具集→自定义 MCP」URL 指向公网 `/mcp`；HMAC 两端同步；数据中心一致；13 工具用 MCP Inspector 连通；4 类错误场景行为正确；熔断进纯陪聊；审计可按 sessionId 全链路检索；写操作幂等。
