# 严格用药提醒 v1 · 部署说明

> 版本：2026-04-21
> 覆盖：服药处方批次化录入、严重度分级升级链、推送任务队列、家属每日汇总。

## 1. 架构一览

```
┌──────────────────┐   create    ┌────────────────────────┐
│ admin 处方批量页  │ ──────────▶│ MedicationPrescription │
└──────────────────┘             │  + MedicationReminder  │
                                 └───────────┬────────────┘
                                             │ cron 每 5 分钟
                                             ▼
                              ┌────────────────────────────┐
                              │ MedicationExecutionService │
                              │ - 生成当天 pending log     │
                              │ - FIRST_PUSH 入队          │
                              │ - 按 severity 驱动升级链   │
                              └─────────────┬──────────────┘
                                            │ enqueue
                                            ▼
                              ┌────────────────────────────┐
                              │ medication_notification_   │
                              │ jobs （物化队列）           │
                              └─────────────┬──────────────┘
                                            │ 每 30 秒
                                            ▼
                              ┌────────────────────────────┐
                              │ MedicationNotificationWorker│
                              │ - 指数退避重试              │
                              │ - mini_program → sms → voice │
                              │   渠道降级                  │
                              └────────────────────────────┘
```

## 2. 数据库变更（上线前必做）

先备份 `medication_reminders` 后再执行。

```bash
mysql -u root -p qiaoguo_health < backend/migrations/20260421_medication_strict_mode.sql
```

该迁移会：
- 新建 `medication_prescriptions` / `medication_reminder_audits` / `medication_notification_jobs` 三张表；
- 向 `medication_reminders` 扩展 `prescription_id / severity / dose_per_time / times_per_day / total_quantity / unit / miss_escalation_override` 七列（`ADD COLUMN IF NOT EXISTS` 幂等）；
- 预置 13 条与"严格用药"相关的 `system_configs` 配置键。

**所有语句幂等，可重复执行。**

## 3. 系统配置键（生产必须一条条检查）

| key | 默认值 | 作用 |
| --- | --- | --- |
| `medication_escalation_high_first_min` | `15` | HIGH 药到点后追推分钟 |
| `medication_escalation_high_missed_min` | `30` | HIGH 药标 missed 分钟 |
| `medication_escalation_high_admin_min` | `60` | HIGH 药升管理员分钟 |
| `medication_escalation_medium_first_min` | `30` | MEDIUM 药追推分钟 |
| `medication_escalation_medium_missed_min` | `60` | MEDIUM 药标 missed 分钟 |
| `medication_escalation_medium_admin_min` | `120` | MEDIUM 药升管理员分钟 |
| `medication_escalation_low_first_min` | `60` | LOW 药追推分钟 |
| `medication_escalation_low_missed_min` | `120` | LOW 药标 missed 分钟 |
| `medication_escalation_low_admin_enabled` | `false` | LOW 药是否升级管理员 |
| `medication_notification_worker_enabled` | `true` | 推送 worker 总开关 |
| `medication_notification_worker_batch` | `50` | worker 每次最多处理数 |
| `medication_family_digest_enabled` | `true` | 每日家属汇总开关 |
| `medication_family_digest_hour` | `20` | 每日汇总推送小时（0-23） |

所有默认值通过策略服务 30 秒缓存，修改后最晚 30 秒生效。

## 4. 短信 / 订阅消息模板

| 场景 | 短信模板键 | 小程序订阅消息 alias |
| --- | --- | --- |
| 到点首推 / 追推 / 升级家属 | `medication_reminder`（已有） | `medication_reminder`（已有） |
| 复诊 | `follow_up_reminder`（已有） | `follow_up_reminder`（已有） |
| 家属每日汇总 | 复用 `medication_reminder`（3 变量） | 复用 `medication_reminder` |
| 升级管理员 | 复用 `medication_reminder` 短信模板 | — |

上线前务必确认这些模板已在「系统配置 → 小程序订阅消息 / 短信通知」里配齐：否则入队的 job 会因模板缺失 DEAD。

## 5. 上线冷启动步骤

1. 跑 migration。
2. 在 admin 后台「用药提醒」看一眼老数据：所有老提醒默认 `severity=medium`，生产环境需要运营根据处方逐条调整 HIGH / LOW。
3. 首次部署后，到「用药提醒 → 推送任务监控」Tab 确认：
   - 表里能看到 `first_push` 任务入队；
   - 20 分钟内 `status=success` 的条数占比 > 90%；
   - `dead` 条目没有异常堆积。
4. 跑一次「立即推今日汇总」按钮，确认至少一条成功送达家属。
5. 把 24 小时内 `dead` 任务按 `kind` 分组分析，必要时手动点「重试」。

## 6. 回滚指南

- **短期回滚**：把 `medication_notification_worker_enabled=false`，worker 停止；`MedicationExecutionService.runScheduler` 里的升级链仍会入队任务但不发送。复诊提醒 / 过期 complete 不受影响。
- **彻底回滚**：
  - `medication_notification_worker_enabled=false`
  - `medication_family_digest_enabled=false`
  - 代码回滚到本次 release 之前的 commit
  - `medication_reminders` 新增列保留，不影响旧代码读写；新表 `medication_prescriptions` / `medication_reminder_audits` / `medication_notification_jobs` 独立，回滚后可保留以便再次上线

## 7. 第二阶段（已交付）

- **小程序批量订阅**：家属每次进用药中心 / 打卡 / 新建提醒都会自动触发一次 `wx.requestSubscribeMessage`，为一次性订阅持续累计授权条数（`utils/subscribe.ts::requestMedicationSubscribe`）。
- **tabBar 红点**：自定义 tabBar 每 5 分钟刷新一次今日打卡状态，未打卡或已漏服时在"我的"Tab 显示数字角标；打卡后自动消除。
- **后台送达率看板**：「推送任务监控」Tab 顶部新增按 kind × channel 聚合的送达率表，支持 1h / 6h / 24h / 7d 窗口切换，低于 95% 红色高亮。
- **药品常用库**：`medicine_catalog` 表，后台 `/customer-center` 下可新增"药品库"入口，供陪诊员录入时联想 + 自动带默认严重度 / 频次 / 单位。
- **处方审核流**：陪诊员小程序端提交的处方先入 `pending_review`，运营在「处方批量录入」页的"待审核"Tab 里复核；通过后才生成正式提醒。
- **陪诊员小程序上传**：`pages/workbench/prescription-upload/prescription-upload`，服务时间线底部新增"处方"按钮直达此页，拍照 → 表格录入 → 一键提交。
- **语音电话接口位**：`VoiceCallService` 抽象（tencent/aliyun/stub），未配置时 worker 自动把 voice 任务标 DEAD 并在送达率看板体现为渠道失败；配置完 `voice_call_*` 后自动激活。
- **处方 OCR 接口位**：`/prescription-ocr/parse` + `/prescription-ocr/enrich-by-dictionary`。未接入真实 OCR 时返回 stub；字典补全任何时候都可用（小程序端手填后自动带默认值）。

## 8. 需要手工接入的外部服务

| 模块 | 配置键 | 接入步骤 |
|---|---|---|
| 处方 OCR | `prescription_ocr_enabled=true` + `prescription_ocr_provider=tencent` + 一对 secret | `npm i tencentcloud-sdk-nodejs-ocr`，在 `PrescriptionOcrService.parse` 补上真实调用 |
| 语音电话 | `voice_call_enabled=true` + `voice_call_provider=tencent` + 一组 sdkAppId/secret/templateId | `npm i tencentcloud-sdk-nodejs-vms`，在 `VoiceCallService.callTencent` 补真实 SDK 调用 |
| 小程序长期订阅 | `mini_program_template_medication_reminder` | 在微信公众平台申请"一次性订阅 → 长期订阅"资质，替换模板 ID 即可一次授权无限推送 |

## 9. 已知限制 / 后续工作位

- 家属每日汇总目前复用 `medication_reminder` 订阅消息模板（语义妥协），建议申请独立的 `family_digest` 模板，完成后在配置 `mini_program_template_family_digest` 注入 templateId 即可。
- `medication_notification_jobs` 表长期会很大，建议部署后按季度做归档（`created_at < now() - 90 day` 搬到历史表）。
- 陪诊员端 OCR 按钮点击后若 provider=disabled 会提示"请手动录入"，暂不弹出 SDK 密钥申请链接——未来可加引导。
