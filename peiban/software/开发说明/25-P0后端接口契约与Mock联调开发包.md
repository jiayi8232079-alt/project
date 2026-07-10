# 25 · P0 后端接口契约与 Mock 联调开发包

> 上层导航见 [`README.md`](./README.md)。
> 本篇用于把 V4.3 第一轮开发直接落到后端接口、数据模型、mock 事件和端侧验收。当前优先级：先让 App、社区后台、B 端后台能用同一套 mock 数据跑通主链路。

**最近整理日期：** 2026-06-24  
**关联文档：** `18-API接口全量清单.md`、`23-后台与App功能落地清单.md`、`24-五AI并行开发分工与端侧边界.md`

---

## 0. 当前开发前提

当前工作树中 `backend/`、`admin/`、`UniApp/` 等源码目录处于 Git 删除状态，文件系统不可直接编辑真实工程代码。恢复或确认源码位置前，本篇先沉淀可执行契约，后续恢复 NestJS/Vue/UniApp 工程后按本篇补模块即可。

第一轮只做 P0/P1 中会阻塞联调的后端能力：

1. App 推送 token。
2. 设备设置。
3. 告警中心、视觉跌倒和 SOS 应急处置。
4. 社区内容发布与触达回执。
5. 家庭任务与家属投喂。
6. 声纹成员状态。
7. 生活服务商、服务目录、服务订单履约。
8. 合作医院资源展示。

---

## 1. 通用约定

### 1.1 权限边界

- App 用户只能访问自己家庭、自己绑定老人、自己被授权的设备和订单。
- 社区后台只能访问当前社区及下级网格/机构数据。
- B 端公司后台只能访问本企业服务目录、订单履约和结算数据。
- 平台后台可跨租户管理，但所有写操作必须落审计。

### 1.2 通用字段

所有新增表建议包含：

- `id`
- `tenant_id`
- `family_id`
- `community_id`
- `enterprise_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

字段按业务可为空，不属于该端的数据不要强行填充。

### 1.3 状态枚举

告警状态：

- `new`
- `family_notified`
- `family_acknowledged`
- `community_accepted`
- `manual_escalated`
- `false_alarm`
- `closed`

触达状态：

- `queued`
- `sent`
- `delivered`
- `played`
- `app_viewed`
- `failed`
- `revoked`

服务订单状态：

- `pending_accept`
- `accepted`
- `assigned`
- `on_the_way`
- `in_service`
- `completed`
- `cancelled`
- `complained`

---

## 2. App 推送 Token

建议前缀：`/app/device-token`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| POST | `/app/device-token` | App | 登录后注册或刷新推送 token |
| DELETE | `/app/device-token/:id` | App | 退出登录、注销或设备失效时解绑 |
| GET | `/app/device-token/mine` | App | 查询当前账号已绑定推送设备 |

POST DTO：

```json
{
  "platform": "ios",
  "vendor": "apns",
  "token": "push-token",
  "deviceId": "phone-device-id",
  "appVersion": "1.0.0"
}
```

验收：

- 同一用户同一 `deviceId` 重复上报时更新旧 token。
- SOS/跌倒 mock 事件能查到监护人 token。

---

## 3. 设备设置

建议前缀：`/device-settings`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| GET | `/device-settings/:deviceId` | App/后台 | 获取设备当前设置和下发状态 |
| PUT | `/device-settings/:deviceId` | App/后台 | 保存并生成下发任务 |
| GET | `/device-settings/:deviceId/logs` | 后台 | 查看设置下发历史 |
| POST | `/device-settings/:deviceId/mock-ack` | 后台 | mock 设备回执 |

PUT DTO：

```json
{
  "quietHours": [{ "start": "21:00", "end": "07:00" }],
  "volume": 70,
  "speechRate": 1.0,
  "screenBrightness": 80,
  "sosHoldSeconds": 3,
  "autoEscalation": "family_then_community",
  "communityContentEnabled": true,
  "privacyVisibility": "guardian_only"
}
```

验收：

- App 和后台看到同一份设置。
- 修改后生成一条 `pending` 下发日志。
- mock ack 后日志变成 `success` 或 `failed`。

---

## 4. 告警、视觉跌倒和应急处置

建议前缀：`/alerts`、`/emergency-dispatch`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| GET | `/alerts` | App/后台/社区 | 告警列表，按端侧权限过滤 |
| GET | `/alerts/:id` | App/后台/社区 | 告警详情、时间线、处置记录 |
| POST | `/alerts/:id/ack` | App/社区/后台 | 接管告警 |
| POST | `/alerts/:id/close` | App/社区/后台 | 关闭告警 |
| POST | `/alerts/:id/false-alarm` | App/社区/后台 | 标记误报 |
| GET | `/alerts/fall-events` | 后台/社区 | 视觉跌倒事件列表 |
| POST | `/alerts/mock-event` | 后台 | 生成 SOS/跌倒/离线 mock 事件 |
| POST | `/emergency-dispatch/:alertId/escalate` | 后台/社区 | 升级到社区或人工中台 |

mock event DTO：

```json
{
  "type": "fall",
  "deviceId": "robot-001",
  "elderId": "elder-001",
  "severity": "critical",
  "source": "vision",
  "snapshotUrl": "https://example.com/fall.jpg",
  "occurredAt": "2026-06-24T21:00:00+08:00"
}
```

时间线事件：

- `created`
- `family_notified`
- `acknowledged`
- `community_escalated`
- `manual_escalated`
- `false_alarm`
- `closed`

验收：

- 后台创建跌倒 mock 后，App 告警中心能看到紧急事件。
- 30 秒无人接管时可升级社区。
- 社区后台接管后，App 其他家属能看到接管人和状态。
- 关闭或误报必须写入审计和时间线。

---

## 5. 社区内容与触达回执

建议前缀：`/community-content`、`/content-deliveries`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| POST | `/community-content` | 社区后台 | 新建草稿 |
| POST | `/community-content/:id/submit` | 社区后台 | 提交审核 |
| POST | `/community-content/:id/publish` | 社区后台/平台 | 发布并生成触达任务 |
| POST | `/community-content/:id/revoke` | 社区后台/平台 | 撤回内容 |
| GET | `/community-content` | 社区后台/App | 内容列表，按端过滤 |
| GET | `/community-content/:id` | 社区后台/App | 内容详情 |
| GET | `/content-deliveries` | 社区后台/平台 | 触达回执列表 |
| POST | `/content-deliveries/:id/mock-ack` | 后台 | mock 到达/播报/App 已查看 |

内容 DTO：

```json
{
  "title": "防诈骗提醒",
  "body": "近期请注意陌生来电。",
  "voiceScript": "社区提醒您，近期请注意陌生来电。",
  "category": "anti_fraud",
  "priority": "high",
  "target": {
    "communityId": "community-001",
    "buildingIds": ["building-1"],
    "elderTags": ["key_elder"]
  },
  "schedule": {
    "startAt": "2026-06-25T09:00:00+08:00",
    "endAt": "2026-06-30T18:00:00+08:00",
    "playTimes": ["09:00", "18:00"]
  }
}
```

验收：

- 社区后台发布一条通知。
- App 能看到该通知。
- 每个目标设备生成一条 delivery。
- mock 回执后社区后台能看见已下发、已播报、App 已查看。

---

## 6. 家庭任务与家属投喂

建议前缀：`/family/family-messages`、`/family/tasks`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| POST | `/family/family-messages` | App | 家属给老人留言或投喂内容 |
| GET | `/family/family-messages` | App | 家庭留言列表 |
| POST | `/family/tasks` | App | 创建喝水、吃药、复诊、家庭事项提醒 |
| PATCH | `/family/tasks/:id` | App | 更新任务 |
| POST | `/family/tasks/:id/cancel` | App | 取消任务 |
| POST | `/family/tasks/:id/mock-receipt` | 后台 | mock 设备播报/老人回应 |

任务 DTO：

```json
{
  "elderId": "elder-001",
  "title": "提醒喝水",
  "type": "drink_water",
  "message": "爸，记得喝水。",
  "scheduleMode": "next_recognized",
  "targetMemberVoiceprintId": "voiceprint-001",
  "remindAt": "2026-06-25T10:00:00+08:00"
}
```

验收：

- 家属创建任务后有投递状态。
- 设备 mock 播报后 App 可看到回执。
- 撤销任务后不再播报。

---

## 7. 声纹成员

建议前缀：`/voiceprints`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| GET | `/voiceprints/family/:familyId` | App/后台 | 家庭成员声纹状态 |
| POST | `/voiceprints` | App | 创建声纹录入记录 |
| PATCH | `/voiceprints/:id/status` | 后台/mock | 更新录入/识别状态 |
| POST | `/voiceprints/:id/revoke` | App/后台 | 撤回授权 |
| POST | `/voiceprints/:id/misrecognition` | App/后台 | 上报误识别纠正 |

状态：

- `not_started`
- `enrolling`
- `active`
- `low_confidence`
- `revoked`

验收：

- App 能看到每个家庭成员是否已录入声纹。
- 后台可筛选低置信度和撤回授权记录。
- 误识别上报后进入审查列表。

---

## 8. 生活服务商与履约

建议前缀：`/service-providers`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| GET | `/service-providers` | App/后台/B 端 | 服务商列表 |
| POST | `/service-providers` | 平台/B 端 | 新增服务商 |
| PATCH | `/service-providers/:id` | 平台/B 端 | 更新资质、区域、状态 |
| GET | `/service-providers/:id/catalog` | App/B 端 | 服务目录 |
| POST | `/service-providers/:id/catalog` | B 端 | 新增服务项目 |
| PATCH | `/service-orders/:id/provider-status` | B 端 | 更新履约节点 |
| POST | `/service-orders/:id/complaints` | App/后台 | 投诉售后 |

服务范围：

- 陪诊。
- 家政。
- 保洁。
- 维修。
- 助浴。
- 理发。
- 陪护。
- 康复。
- 代办代购。
- B 端公司合作服务。

验收：

- 后台配置一个家政服务商。
- App 能看到可预约服务。
- 用户下单后 B 端后台能接单并更新履约。
- 完成后 App 能评价或投诉。

---

## 9. 合作医院

建议前缀：`/hospital-partnerships`

| 方法 | 路径 | 使用端 | 说明 |
|---|---|---|---|
| GET | `/hospital-partnerships` | App/后台 | 合作医院资源列表 |
| POST | `/hospital-partnerships` | 平台/后台 | 新增合作协议 |
| PATCH | `/hospital-partnerships/:id` | 平台/后台 | 更新协议、展示状态 |
| GET | `/hospital-partnerships/:id/resources` | App/后台 | 科室、权益、随访配置 |
| POST | `/hospital-partnerships/:id/resources` | 后台 | 新增资源 |

验收：

- 只有 `active` 且协议未过期的医院在 App 展示。
- 医院资源能关联陪诊服务。
- App 侧明确展示“不替代诊疗”的合规说明。

---

## 10. 第一轮联调样本数据

至少准备：

- 1 个平台租户。
- 1 个社区租户。
- 1 个 B 端服务商租户。
- 1 个家庭。
- 1 位老人。
- 2 位家属。
- 1 台机器人设备。
- 1 条社区通知。
- 1 条 SOS mock 告警。
- 1 条视觉跌倒 mock 告警。
- 1 个家政服务商。
- 1 个陪诊服务商。
- 1 家合作医院。

---

## 11. 第一轮验收链路

1. 社区后台发布一条防诈骗通知。
2. App 通知中心看到通知。
3. 后台 mock 设备播报回执。
4. 社区后台看到触达统计。
5. 后台创建跌倒 mock 事件。
6. App 收到紧急告警并接管。
7. 30 秒无人接管时社区后台可升级处理。
8. App 创建一笔家政或陪诊订单。
9. B 端后台接单并推进履约节点。
10. App 看到订单进度并完成评价。

---

## 12. 代码实现顺序

恢复源码后建议按顺序实现：

1. 新增实体和迁移：token、settings、alerts、alert_timeline、community_content、content_delivery、family_task、voiceprint、service_provider、service_catalog、hospital_partnership。
2. 新增 DTO 和 service，先写单元测试或 e2e 测试。
3. 新增 controller，接入 JWT、角色、租户/家庭权限过滤。
4. 新增 mock 端点，支持端侧联调。
5. 回填 Swagger 和 `18-API接口全量清单.md`，将规划端点改为已落地端点。
6. App、社区后台、B 端后台按同一契约接入。

