# 机器人 ↔ 后端 接口契约（Robot–Backend API Contract）

> 本文件是软硬件协作的**唯一接口事实来源**。任何通信改动：先改本文档 → 双方确认 → 再写代码。
> 维护人：@kane-c01（后端）、@jiayi8232079-alt（机器人）

## 0. 版本记录

| 版本 | 日期 | 变更 | 作者 |
| --- | --- | --- | --- |
| v0.1 | 2026-06-24 | 初稿，待双方补充 | - |

## 1. 通信方式（待确认）

- [ ] 设备上报：HTTP(S) REST / MQTT / WebSocket（推荐 MQTT 上报状态 + HTTP 调业务）
- [ ] 后端下发：MQTT 主题 / WebSocket 推送 / HTTP 长轮询
- 接入地址：
  - 测试环境：`待填`
  - 生产环境：`待填`

## 2. 设备认证

- 设备唯一标识：`deviceId`（建议用 SN 或 MAC）
- 鉴权方式（待确认）：设备密钥签名 / 一机一密 Token / mTLS
- 认证流程：`待填`

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
