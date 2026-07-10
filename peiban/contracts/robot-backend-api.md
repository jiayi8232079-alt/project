# 机器人 ↔ 后端 接口契约（Robot–Backend API Contract）

> 本文件是软硬件协作的**唯一接口事实来源**。任何通信改动：先改本文档 → 双方确认 → 再写代码。
> 维护人：@kane-c01（后端）、@jiayi8232079-alt（机器人）

## 0. 版本记录

| 版本 | 日期 | 变更 | 作者 |
| --- | --- | --- | --- |
| v0.1 | 2026-06-24 | 初稿，待双方补充 | - |
| v0.2 | 2026-07-07 | 明确 TuyaOS → 涂鸦云 → peiban MCP/REST/WS 最小接入边界 | Codex |
| v0.3 | 2026-07-07 | 补充涂鸦云自定义 MCP WebSocket 桥接模式 | Codex |

## 1. 通信方式

- 推荐调用链：TuyaOS 设备 → 涂鸦云设备通道 / DP / Pulsar / P2P → peiban 设备接入层 → MCP Tool Router / REST / WebSocket → peiban 业务模块。
- 设备上报：优先走涂鸦 DP / Pulsar；本地调试可走受信设备通道 HTTP(S)。
- 后端下发：优先走涂鸦设备通道；家属端、后台、处置端实时状态走 peiban WebSocket。
- MCP 工具调用：生产推荐走涂鸦云「自定义 MCP 服务」WebSocket 桥；本地调试或受信服务通道可直接 `POST /mcp`。
- 接入地址：
  - 测试环境：`待填`
  - 生产环境：`待填`

## 2. 设备认证

- 设备唯一标识：`tuyaDeviceId` / `deviceId`，以后端 `DeviceBinding` 绑定关系为准。
- 鉴权方式：`Authorization: Bearer <HMAC>` + `X-Device-Id` + `X-Request-Id` + `X-Session-Id`。
- HMAC 密钥来自后端安全配置，不能写入仓库；设备侧不保存用户 Token、涂鸦 Token 或 MCP 长期 Token。
- 后端必须按设备绑定关系注入 `userId`、`tenantId`、`serviceTargetId`，设备只能访问绑定家庭/老人相关数据。

## 3. 设备 → 后端（上行）

### 3.1 心跳 / 在线状态

```json
{
  "deviceId": "ROBOT-0001",
  "ts": 1719200000,
  "battery": 86,
  "status": "idle",
  "fw": "1.0.0"
}
```

`status` 枚举：`idle | working | charging | error | offline`

### 3.2 传感器 / 业务数据（按需定义）

```json
{
  "deviceId": "ROBOT-0001",
  "ts": 1719200000,
  "type": "vitals",
  "payload": {}
}
```

### 3.3 事件 / 告警

```json
{
  "deviceId": "ROBOT-0001",
  "ts": 1719200000,
  "event": "fall_detected",
  "level": "critical",
  "payload": {}
}
```

`level` 枚举：`info | warning | critical`

### 3.4 MCP 工具调用

涂鸦云自定义 MCP WebSocket 模式：

```text
涂鸦智能体 / 设备通道
  -> 涂鸦云自定义 MCP 服务（WebSocket）
  -> peiban_tuya_mcp_service.py（云服务器桥接进程）
  -> peiban 后端 POST /mcp
  -> peiban 业务 service
```

桥接进程职责：

- 使用涂鸦平台提供的 `TUYA_MCP_ENDPOINT`、`TUYA_MCP_ACCESS_ID`、`TUYA_MCP_ACCESS_SECRET` 主动连接涂鸦 MCP 网关。
- 对外向涂鸦智能体暴露 `peiban.*` MCP 工具。
- 从涂鸦请求 `meta` 或本地映射解析 `tuyaDeviceId`，转成 peiban 后端 `X-Device-Id`。
- 使用 `PEIBAN_MCP_HMAC_SECRET` 对 peiban `/mcp` 请求签名；该值应与后端 `AI_GATEWAY_HMAC_SECRET` 一致，不能等同或混用涂鸦 Access Secret。
- 不保存用户 Token，不直接访问数据库，不承载健康/订单/用药等业务事实。

桥接脚本：

```text
TuyaOS/apps/tuyaos_demo_wukong_ai/scripts/peiban_tuya_mcp_service.py
```

本地调试或受信通道直接调用 peiban `/mcp` 时，请求头如下：

请求头：

```http
POST /mcp
Content-Type: application/json
X-Device-Id: <tuyaDeviceId>
X-Request-Id: <uuid>
X-Session-Id: <session-id>
Authorization: Bearer <hmac-signature>
```

查询今日健康摘要：

```json
{
  "jsonrpc": "2.0",
  "id": "health-1",
  "method": "tools/call",
  "params": {
    "name": "peiban.health.getTodaySummary",
    "arguments": {}
  }
}
```

查询今日用药提醒：

```json
{
  "jsonrpc": "2.0",
  "id": "medication-1",
  "method": "tools/call",
  "params": {
    "name": "peiban.medication.getTodayReminders",
    "arguments": {
      "date": "2026-07-07"
    }
  }
}
```

创建告警：

```json
{
  "jsonrpc": "2.0",
  "id": "alert-1",
  "method": "tools/call",
  "params": {
    "name": "peiban.alert.create",
    "arguments": {
      "type": "sos",
      "severity": "emergency",
      "reason": "用户按下 SOS"
    }
  }
}
```

已预留工具名：

- `peiban.elder.getProfile`
- `peiban.health.getTodaySummary`
- `peiban.medication.getTodayReminders`
- `peiban.alert.create`
- `peiban.device.reportEvent`
- `peiban.device.getBindingStatus`

安全约定：

- `targetId` 可选；若传入，必须等于当前设备绑定的 `serviceTargetId`。
- SOS、跌倒、生命体征异常等安全事件不能依赖 LLM 决策，生产链路应由 DP/Pulsar 事件直接触发后端设备/告警服务，MCP 只作为智能体补充入口。
- 支付、订单变更、档案修改等高风险闭环不能由设备端直接完成。

### 3.5 涂鸦云适配层预留

涂鸦相关逻辑应集中在设备接入层，不散落进业务模块：

- DP 状态同步：映射到 `DeviceDpSnapshot` / 设备状态。
- Pulsar 事件接收：映射到 `DeviceEventLog`，必要时触发 `AlertService`。
- 设备绑定关系：以后端 `DeviceBinding` 为权限事实。
- P2P 视频入口：只提供受控入口信息，视频流仍走涂鸦 P2P。
- OTA 状态：走涂鸦 OTA 通道，peiban 记录结果和展示。
- 智能体/设备通道消息：可调用 `/mcp` 或既有 REST API。

## 4. 后端 → 设备（下行）

### 4.1 指令下发

```json
{
  "cmdId": "uuid",
  "deviceId": "ROBOT-0001",
  "action": "speak",
  "params": {},
  "ts": 1719200000
}
```

`action` 示例：`speak | move | call | reboot`

### 4.2 指令回执（设备执行后回上行）

```json
{
  "cmdId": "uuid",
  "deviceId": "ROBOT-0001",
  "result": "ok",
  "msg": "",
  "ts": 1719200001
}
```

`result` 枚举：`ok | fail | timeout`

## 5. 字段与约定

- 时间戳 `ts`：Unix 秒（UTC）
- 字符串编码：UTF-8
- 枚举值统一小写下划线
- 所有上行消息必带 `deviceId` + `ts`

## 6. 错误码（待补充）

| code | 含义 | 处理建议 |
| --- | --- | --- |
| 0 | 成功 | - |
| 1001 | 认证失败 | 重新鉴权 |
| 1002 | 参数错误 | 检查 payload |

## 7. 待决问题（Open Questions）

- [ ] 上报频率（心跳间隔、数据上报节流）？
- [ ] 离线缓存与补传策略？
- [ ] OTA 固件升级走哪条通道？
- [ ] 涂鸦 OpenAPI、Pulsar、P2P、OTA 的正式应用配置与密钥管理方案。
- [ ] 生产环境 MCP 签名串格式、重放窗口、时钟偏差容忍范围。
