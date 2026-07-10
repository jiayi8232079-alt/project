# ai-gateway · MCP 对接规范（陪了个伴）

> 用途：定义涂鸦智能体（陪诊助手）→ ai-gateway 的接口契约。
> 协议：MCP over StreamableHTTP。
> 适用：`backend/src/modules/ai-gateway/` 实现 + 涂鸦智能体平台「工具集 → 自定义 MCP 服务」配置。

---

## 1. 端点

| 项 | 值 |
|---|---|
| Base URL | `https://api.your-domain.com/mcp` |
| 协议 | StreamableHTTP（POST + GET SSE） |
| 数据中心 | 中国区（上海）—— 与智能体一致，否则不可见 |
| 协议版本 | MCP 2024-11-05 |

---

## 2. 鉴权与请求头

| 头 | 必传 | 说明 |
|---|---|---|
| `Authorization` | 是 | `Bearer <hmac-sha256>`，签名规则见下 |
| `X-Tuya-Signature` | 是 | 涂鸦平台签名（透传校验） |
| `X-Device-Id` | 是 | 涂鸦设备 ID（用于 ai-gateway 反查 userId/tenantId） |
| `X-Tenant-Id` | 否 | 平台租户 ID；不传由 deviceId 反查 |
| `X-Request-Id` | 是 | UUIDv4，用于审计追溯（一次 LLM 调用一个） |
| `X-Session-Id` | 是 | 涂鸦会话 ID，多轮对话同一 ID |
| `Content-Type` | 是 | `application/json` |

### 2.1 HMAC 签名规则
```
secret = AI_GATEWAY_HMAC_SECRET（环境变量）
stringToSign = X-Device-Id + '\n' + X-Request-Id + '\n' + body (raw JSON)
signature = HMAC-SHA256(secret, stringToSign).hex
```

服务端必须在 5 分钟时钟漂移内验签，过期拒绝。

### 2.2 鉴权失败响应
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "E_AUTH",
    "message": "签名校验失败或请求过期",
    "retryable": false
  }
}
```

---

## 3. 通用响应包络

所有 tool 响应统一使用以下结构：

```json
{
  "success": true,
  "data": { /* tool 专属数据 */ },
  "meta": {
    "requestId": "uuid",
    "durationMs": 123,
    "cached": false
  }
}
```

失败时：

```json
{
  "success": false,
  "error": {
    "code": "E_NOT_FOUND",
    "message": "未查到该订单",
    "retryable": false,
    "userMessage": "我没查到您说的这个订单，您再确认一下编号好吗？"
  },
  "meta": { "requestId": "uuid", "durationMs": 50 }
}
```

> `userMessage` 是给老人听的话；Agent 应优先用这一段而不是 `message`。

---

## 4. 错误码表

| 错误码 | HTTP | 含义 | retryable | Agent 行为 |
|---|---|---|---|---|
| `E_AUTH` | 401 | 鉴权失败 | false | 系统侧问题，向老人致歉并降级 |
| `E_PERMISSION` | 403 | 越权访问（如查他人数据） | false | 婉拒，"这个我能查的是您自己的" |
| `E_NOT_FOUND` | 404 | 资源不存在 | false | 用 userMessage 告诉老人 |
| `E_VALIDATION` | 400 | 参数错误 | false | 追问澄清 |
| `E_RATE_LIMIT` | 429 | 限流 | true（带 Retry-After） | "系统忙，稍后再试" |
| `E_TIMEOUT` | 504 | 上游超时 | true | "系统有点慢，您稍等" |
| `E_UPSTREAM` | 502/503 | 上游服务不可用 | true | "系统有点忙" |
| `E_BUSINESS` | 422 | 业务规则拒绝（如余额不足） | false | 用 userMessage |
| `E_INTERNAL` | 500 | 服务端异常 | true | "我帮您记一下，回头让客服联系您" |
| `E_CIRCUIT_OPEN` | 503 | 熔断器打开 | false | 进入"纯陪聊模式"（PRD §2.4） |

> Agent 收到 `E_CIRCUIT_OPEN` 时应停止后续工具调用并切到纯陪聊。

---

## 5. 工具清单（13 个）

### 5.1 查询类（只读）

#### `get_profile`
查询当前服务对象的基础档案与健康概况。

输入：
```json
{
  "targetId": "string"
}
```

输出：
```json
{
  "name": "张奶奶",
  "ageYears": 78,
  "city": "上海",
  "chronicTags": ["高血压", "糖尿病"],
  "preferredCalls": ["您闺女", "您儿子"]
}
```

#### `get_orders`
查询当前用户的订单列表。

输入：
```json
{
  "targetId": "string",
  "status": "pending|confirmed|in_service|completed|cancelled",
  "limit": 5
}
```

输出：
```json
{
  "orders": [
    {
      "id": "ORD-20260602-001",
      "serviceName": "陪诊（华山医院）",
      "scheduledAt": "2026-06-05T09:00:00+08:00",
      "status": "confirmed",
      "attendantName": "李护工"
    }
  ]
}
```

#### `get_medication_plan`
查询今日 / 近期用药计划。

输入：
```json
{
  "targetId": "string",
  "date": "2026-06-02"
}
```

输出：
```json
{
  "plans": [
    {
      "id": 12,
      "drugName": "氨氯地平",
      "dose": "5mg 一片",
      "time": "08:00",
      "withFood": false,
      "remindOnly": true
    }
  ]
}
```

#### `get_health_records`
查询血压 / 血糖 / 体征 / 周报。

输入：
```json
{
  "targetId": "string",
  "type": "blood_pressure|blood_glucose|weight|weekly_report",
  "range": "today|week|month"
}
```

#### `get_escort_report`
查询最近的陪诊报告与时间线。

输入：
```json
{
  "orderId": "string"
}
```

#### `get_weather`
查询天气（结合健康提示）。

输入：
```json
{
  "city": "string?"
}
```

#### `get_time`
查询当前时间。

输入：`{}`

### 5.2 操作类（写入，需二次确认）

#### `notify_family`
通知预绑定的家属/紧急联系人。

输入：
```json
{
  "targetId": "string",
  "reason": "string",
  "severity": "info|warn|emergency",
  "preferredContactIds": ["string"]
}
```

输出：
```json
{
  "sentCount": 2,
  "channels": ["app_push", "sms"],
  "notifiedAt": "2026-06-02T20:30:00+08:00"
}
```

> 接收方必须是**预先绑定的紧急联系人**，不接受口述电话号码。

#### `create_order`
代下平台陪诊/体检/上门服务订单。

输入：
```json
{
  "targetId": "string",
  "servicePlanCode": "string",
  "scheduledAt": "ISO 8601",
  "hospitalId": "string?",
  "remarks": "string?"
}
```

> 必须在 Agent 复述并得到老人明确"对/好/可以"确认后调用。

#### `cancel_order`
取消订单。

输入：
```json
{
  "orderId": "string",
  "reason": "string"
}
```

#### `record_medication_taken`
记录服药打卡（按老人主观反馈记录，**不判断是否补吃**）。

输入：
```json
{
  "planId": 12,
  "takenAt": "ISO 8601",
  "note": "string?"
}
```

#### `record_health_metric`
记录单次体征（血压/血糖等）。

输入：
```json
{
  "targetId": "string",
  "type": "blood_pressure",
  "values": { "systolic": 135, "diastolic": 85 },
  "measuredAt": "ISO 8601"
}
```

### 5.3 引导类

#### `guide_app_action`
告诉老人在 App 里某项操作怎么做（分步骤短句）。

输入：
```json
{
  "actionCode": "view_orders|book_service|view_report|invite_family"
}
```

输出：
```json
{
  "steps": [
    "您打开手机上的陪了个伴 App",
    "下面有个'我的'，您点一下",
    "再找到'我的订单'，您点开",
    "里面就能看到您今天的安排了"
  ]
}
```

---

## 6. 告警事件 Schema（device → realtime → 后端 alert）

> 这是从设备/雷达直推到后端 `alert` 模块的事件结构，**不经过 ai-gateway/MCP**（PRD §2.3 双链路安全线）。

```json
{
  "eventType": "alert.fall|alert.sos|alert.heartbeat_missed|alert.medication_missed",
  "tenantId": 1,
  "deviceId": "tuya-device-id",
  "targetId": "string",
  "severity": "info|warn|critical",
  "occurredAt": "ISO 8601",
  "source": "radar|button|monitor|firmware",
  "payload": {
    "confidence": 0.92,
    "snapshotUrl": "https://...",
    "extra": {}
  }
}
```

后端 `alert.service` 处理流程：
1. 写 `alert-log`
2. 评估规则（`alert-rule.engine`）→ 决定是否升级
3. 通过 `realtime` 推 App 家属端
4. 严重等级触发外呼 / 短信（由规则引擎决定，不由 LLM）

---

## 7. 幂等

| 工具 | 幂等键 | 规则 |
|---|---|---|
| `notify_family` | `requestId` + `targetId` + `severity` | 5 分钟内重复请求只通知一次 |
| `create_order` | `requestId` + `scheduledAt` + `servicePlanCode` | 5 分钟内重复请求返回同一订单 |
| `record_medication_taken` | `planId` + `takenAt（分钟粒度）` | 1 分钟内重复打卡只记一次 |

---

## 8. 限流

| 维度 | 限流 |
|---|---|
| 全局 | 1000 req/min |
| 单设备 | 60 req/min |
| 写操作单设备 | 10 req/min |
| `notify_family` 单设备 | 3 req/min（防误触骚扰家属） |
| `create_order` 单设备 | 5 req/min（防恶意刷单） |

超过返回 `E_RATE_LIMIT` + `Retry-After` 头。

---

## 9. 熔断

由 `CircuitBreakerInterceptor` 实现，每个 tool 独立计数：
- 滑动窗口 60s 内错误率 > 50%（最少 20 次调用）→ 熔断 30s
- 熔断期间返回 `E_CIRCUIT_OPEN`
- 30s 后半开，允许 1 次试探

Agent 收到 `E_CIRCUIT_OPEN` → 进入纯陪聊模式（参见 PRD §21.6 ③）。

---

## 10. 审计

所有 MCP 工具调用必须落 `audit_log`，字段：
```ts
{
  tenant_id, request_id, device_id, user_id, session_id,
  tool_name, args (JSON, 脱敏后), result_summary,
  success, error_code, duration_ms,
  created_at
}
```

涉及写操作或敏感数据查询的，`audit_log.severity = 'high'`，进运营审查队列。

---

## 11. 数据脱敏（`DesensitizeInterceptor`）

| 字段 | 脱敏规则 | 应用 |
|---|---|---|
| 手机号 | 中间四位 `*`：`138****1234` | 所有响应 |
| 身份证号 | 仅尾四位：`***********1234` | 所有响应 |
| 银行卡号 | 仅尾四位 | 所有响应 |
| 详细住址 | 仅到街道名 | 所有响应 |
| 姓名 | 首字 + `**`：`张**`（对家属角色保留全名） | 跨账号场景 |

---

## 12. 可观测指标

| 指标 | 类型 | 告警阈值 |
|---|---|---|
| `ai_gateway_request_total` | counter | 突降 50% |
| `ai_gateway_request_duration_ms` | histogram | P95 > 800ms |
| `ai_gateway_error_rate` | gauge | > 5% |
| `ai_gateway_tool_circuit_open` | gauge | > 0（任何工具熔断） |
| `ai_gateway_auth_failures` | counter | 突增 |

---

## 13. 配置项（环境变量）

```env
AI_GATEWAY_HMAC_SECRET=...                  # 与涂鸦平台同
AI_GATEWAY_PORT=8080
AI_GATEWAY_TIMEOUT_MS=2800                  # 比智能体侧的 3000ms 提前 200ms 返回
AI_GATEWAY_CIRCUIT_ERROR_RATE=0.5
AI_GATEWAY_CIRCUIT_MIN_REQUESTS=20
AI_GATEWAY_CIRCUIT_RESET_MS=30000
TUYA_SIGNATURE_KEY=...                      # 涂鸦平台配的签名密钥
```

---

## 14. 联调清单

- [ ] 涂鸦智能体平台「工具集」→「自定义 MCP」→ URL 指向你的公网地址
- [ ] HMAC 密钥两端同步
- [ ] 数据中心一致（中国区上海）
- [ ] 13 个 tool 全部用 MCP Inspector 本地连通
- [ ] 鉴权失败 / 越权 / 不存在 / 超时 4 类错误场景 Agent 行为正确
- [ ] 熔断触发 Agent 进入"纯陪聊"
- [ ] 审计日志可按 sessionId 检索全链路
- [ ] 限流头 Retry-After 生效
- [ ] 写操作幂等（重复请求返回同一结果）
