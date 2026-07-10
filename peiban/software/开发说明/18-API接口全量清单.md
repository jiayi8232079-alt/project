# 18 · API 接口全量清单

> 上层导航见 [`README.md`](./README.md)。本篇是**后端全部 REST 端点清单**，按业务域罗列（方法 + 完整路径 + 说明）。
> 提取自 `backend/src/modules/**/*.controller.ts`（40+ 控制器、约 290 个端点）。模块/前缀总览见 [`03-后端服务说明.md`](./03-后端服务说明.md)；AI/MCP 见 `08`。

**约定**：
- 基址：`https://api.qiaoguo.vip`（本地 `http://localhost:3000`），Swagger：`/api-docs`。
- 鉴权：除标注「公开」外均需 `Authorization: Bearer <JWT>`；标注「[admin]」表示需管理/运营/财务等角色（`RolesGuard`）。
- 全局限流默认 600/min/IP；`/auth/*` 单独收紧。

---

## 1. 鉴权 Auth（`/auth`）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/wechat-login` | 微信小程序登录（公开） |
| GET | `/auth/captcha` | 图形验证码（公开，防暴破） |
| POST | `/auth/send-sms-code` | App 下发短信验证码（公开） |
| POST | `/auth/phone-login` | App 手机号验证码登录（不存在自动注册，公开） |
| POST | `/auth/apple-login` | App Apple 登录（公开） |
| POST | `/auth/admin-login` | 管理后台登录（公开，限流 30/min） |
| POST | `/auth/attendant-login` | 陪诊员 Web 端登录（公开） |
| GET | `/auth/profile` | 当前用户信息 |
| POST | `/auth/bind-wx-phone` | 绑定微信手机号 |

## 2. 用户与服务对象 User（`/users`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/users` | 用户列表 [admin] |
| GET | `/users/trash` | 回收站用户 [admin] |
| GET | `/users/me/service-targets` | 我的服务对象列表 |
| PUT | `/users/me` | 更新自己头像/昵称 |
| POST | `/users/me/service-targets` | 创建服务对象 |
| GET | `/users/service-targets` | 服务对象列表 |
| GET | `/users/service-targets/:id` | 服务对象详情 |
| GET | `/users/service-targets/:id/history` | 历史就诊记录 |
| GET | `/users/service-targets/:id/health-profile-html` | 健康档案 HTML（可打印） |
| GET | `/users/service-targets/:id/health-profile-preview` | 健康档案 HTML 预览 |
| PUT | `/users/service-targets/:id` | 更新服务对象 |
| DELETE | `/users/service-targets/:id` | 删除服务对象 |
| GET | `/users/:id` | 用户详情 [admin] |
| PUT | `/users/:id` | 更新用户 [admin] |
| PUT | `/users/:id/role` | 修改用户角色（超管） |
| DELETE | `/users/:id` | 软删除客户（回收站） |
| POST | `/users/:id/restore` | 恢复客户 |
| DELETE | `/users/:id/permanent` | 彻底删除客户 |
| GET | `/users/:id/service-targets` | 某用户的服务对象 |
| POST | `/users/:id/service-targets` | 管理员为客户建档 |

## 3. 订单 Order（`/orders`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/orders/stats/dashboard` | 仪表板统计 |
| GET | `/orders/stats/trend` | 订单趋势 |
| GET | `/orders/stats/live-board` | 驾驶舱实时看板 |
| GET | `/orders/stats/income-trend` | 收入趋势 |
| POST | `/orders` | 创建订单（下单） |
| GET | `/orders` | 订单列表 |
| PUT | `/orders/:id` | 更新订单 |
| PUT | `/orders/admin/:id` | 管理员更新订单 |
| GET | `/orders/:id` | 订单详情 |
| GET | `/orders/:id/bill` | 账单 |
| GET | `/orders/:id/health-profile` | 服务对象健康档案（陪诊员脱敏视图） |
| POST | `/orders/:id/completion/ai-draft` | AI 草拟完成记录 |
| POST | `/orders/:id/completion/timeline-digest` | 时间线摘要 |
| POST | `/orders/:id/sop-progress` | 保存 SOP 打勾进度 |
| POST | `/orders/:id/completion` | 提交完成记录单 |
| GET | `/orders/:id/timeline-share-token` | 时间线分享 token |
| GET | `/orders/:id/wxa-monitor-qrcode` | 监控小程序码 |
| GET | `/orders/:id/wxa-service-report-qrcode` | 服务报告小程序码 |
| GET | `/orders/:id/attendant-live-location` | 陪诊员实时位置 |
| GET | `/orders/:id/service-confirm/status` | 服务确认单状态 |
| POST | `/orders/:id/service-confirm/sign` | 用户签署服务确认单 |
| GET | `/orders/:id/wxa-sign-qrcode` | 签署小程序码 |
| GET | `/orders/health-sign-qrcode/:serviceTargetId` | 健康档案签署小程序码 |
| GET | `/orders/health-sign-scene/:serviceTargetId` | 健康签署场景码 |
| GET | `/orders/:id/service-confirm-scene` | 服务确认场景码 |
| PUT | `/orders/:id/dispatch` | 派单（指派/放抢单池） |
| PUT | `/orders/:id/accept` | 陪诊员接单 |
| PUT | `/orders/:id/admin-confirm-accept` | 后台代确认接单 |
| PUT | `/orders/:id/reject` | 拒单 |
| PUT | `/orders/:id/grab` | 抢单 |
| PUT | `/orders/:id/cancel` | 取消订单 |
| PUT | `/orders/:id/start` | 开始服务打卡 |
| PUT | `/orders/:id/attendant-live-location` | 上报服务实时位置 |
| PUT | `/orders/:id/finish` | 结束服务打卡 |
| PUT | `/orders/:id/sign` | 签署派发确认单 |
| POST | `/orders/:id/review` | 提交评价 |
| GET | `/orders/:id/reviews` | 评价列表 |
| PUT | `/orders/:id/emergency` | 进入/解除紧急模式 |
| PUT | `/orders/:id/status` | 更新订单状态 |
| DELETE | `/orders/:id` | 删除订单 |
| GET | `/orders/...`（order-doc-preview） | 内嵌预览陪诊服务确认单 HTML（令牌限时） |

## 4. 公开分享 Public（`/public`，免登录）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/public/order-timeline` | 凭 token 看就诊人 + 可见时间线 |
| GET | `/public/mp-monitor-scene` | 小程序码 scene 解析为 orderId+token |
| GET | `/public/health-profile/:sceneCode` | 凭场景码读健康档案 |
| PUT | `/public/health-profile/:sceneCode` | 凭场景码存健康档案 |
| GET | `/public/service-confirm/:sceneCode/status` | 确认单状态 |
| POST | `/public/service-confirm/:sceneCode/sign` | 签署确认单 |
| POST | `/public/signature-upload` | 上传签名图片 |
| GET | `/public/family/by-invite-code/:code` | 按邀请码预览家庭 |

## 5. 服务时间线 Timeline（`/timelines`）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/timelines` | 添加记录（JSON） |
| POST | `/timelines/upload` | 发布（含附件 multipart） |
| GET | `/timelines/order/:orderId` | 订单时间线（管理视图） |
| GET | `/timelines/order/:orderId/user` | 用户视图（仅可见） |
| GET | `/timelines/attachment` | 预览附件 |
| PUT | `/timelines/batch/visibility` | 批量可见性 |
| PUT | `/timelines/:id/visibility` | 单条可见性 |
| PUT | `/timelines/:id/transcription` | 改录音转写 |
| PUT | `/timelines/:id/event-time` | 修正业务时间 |
| PUT | `/timelines/:id` | 编辑条目 |
| GET | `/timelines/:id` | 单条 |
| DELETE | `/timelines/:id` | 删除 |

## 6. 陪诊员/护工 Attendant（`/attendants`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/attendants` | 列表 |
| GET | `/attendants/me` | 我的档案 |
| GET | `/attendants/me/workbench` | 我的工作台 |
| GET | `/attendants/role-configs` | 角色配置 |
| GET | `/attendants/me/stats` | 我的统计 |
| GET | `/attendants/me/wallet` | 我的钱包 |
| GET / PUT | `/attendants/me/schedules` | 我的排班（查/改） |
| GET | `/attendants/grab-orders` | 抢单池 |
| GET | `/attendants/assigned-orders` | 派给我的 |
| GET | `/attendants/available` | 可用陪诊员 |
| GET | `/attendants/schedules/all` | 全部排班 |
| GET | `/attendants/list/available-users` | 可选用户 |
| GET | `/attendants/trash/list` | 回收站 |
| PUT | `/attendants/trash/:id/restore` | 恢复 |
| DELETE | `/attendants/trash/:id/hard` | 彻底删除 |
| GET | `/attendants/:id` | 详情 |
| POST | `/attendants` | 新增 |
| PUT | `/attendants/:id` | 更新 |
| PUT | `/attendants/:id/professional-profile` | 专业档案 |
| PUT | `/attendants/:id/credentials` | 登录凭证 |
| PUT | `/attendants/:id/status` | 状态 |
| DELETE | `/attendants/:id` | 删除 |
| GET / POST | `/attendants/:id/schedules` | 排班（查/加） |

## 7. 服务计划 Service-Plan（`/service-plans`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | `/service-plans/templates` | 模板列表 / 新建 |
| GET / PUT / DELETE | `/service-plans/templates/:id` | 模板详情 / 更新 / 删除 |
| GET / POST | `/service-plans/order/:orderId` | 订单服务计划 / 添加项 |
| DELETE | `/service-plans/order/:orderId/items/:id` | 删除计划项 |

## 8. 专业服务目录 Professional-Service（`/professional-services`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/professional-services/public` | 启用服务目录（小程序） |
| GET | `/professional-services/public/code/:code` | 服务详情（含 SOP） |
| GET | `/professional-services` | 后台列表 |
| GET | `/professional-services/:id` | 后台详情 |
| POST | `/professional-services` | 新增 |
| PUT | `/professional-services/:id` | 更新 |
| POST | `/professional-services/:id/toggle` | 启停切换 |
| DELETE | `/professional-services/:id` | 删除 |

## 9. 文档/单据 Document（`/documents`）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/documents/upload` | 上传文档 |
| POST | `/documents/raw-upload` | 上传原始文件（不绑订单） |
| GET | `/documents` | 列表 |
| GET | `/documents/order/:orderId/service-confirm-html` | 确认单 HTML（iframe） |
| GET | `/documents/order/:orderId` | 订单文档 |
| GET | `/documents/customer/:userId` | 客户履约文档 |
| GET | `/documents/:id` | 详情 |
| DELETE | `/documents/:id` | 删除 |
| POST | `/documents/generate/health-profile/:serviceTargetId` | 生成健康小档案 |
| POST | `/documents/generate/service-confirm/:orderId` | 生成服务确认单 |
| POST | `/documents/generate/service-complete/:orderId` | 生成服务完成记录单 |
| POST | `/documents/order/:orderId/service-report` | 生成服务报告单 |

## 10. 用药 Medication
**提醒 `/medication-reminders`**：`POST /`(创建) · `POST /my`(本人创建) · `GET /`(列表) · `GET /my`(我的) · `GET /order/:orderId` · `GET /:id` · `PUT /:id` · `DELETE /:id` · `GET /:id/audits`(审计)
**打卡执行 `/medication-executions`**：`POST /check-in`(打卡) · `GET /`(列表) · `GET /adherence/:userId`(依从率)
**处方 `/medication-prescriptions`**：`POST /`(创建批次) · `GET /`(列表) · `GET /my` · `GET /:id` · `POST /:id/approve`(审核通过) · `POST /:id/reject`(驳回)
**通知任务 `/medication-notification-jobs`**：`GET /`(列表) · `POST /:id/retry`(重试) · `POST /digest/dispatch-now`(立即派发) · `GET /stats`
**药品库 `/medicine-catalog`**：`GET /search`(联想) · `GET /`(列表) · `GET /:id` · `POST /`(新建) · `PUT /:id` · `DELETE /:id`
**处方 OCR `/prescription-ocr`**：`POST /parse`(识别) · `POST /enrich-by-dictionary`(字典补全) · `GET /search-medicine`(药名联想)
**药物相互作用 `/drug-interactions`**：`POST /assess/prescription/:id` · `POST /assess/target/:id` · `GET /prescription/:id` · `GET /target/:id` · `GET /rules` · `POST /rules` · `PUT /rules/:id` · `DELETE /rules/:id`

## 11. 告警 Alert（`/alerts`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/alerts` | 预警列表（家属+管理共用） |
| GET | `/alerts/pending-count` | 未处理数量 |
| GET | `/alerts/rules` | 规则列表 [admin] |
| PUT | `/alerts/rules/:id` | 更新规则 [admin] |
| GET | `/alerts/admin/assignable-staff` | 可指派处理人 [admin] |
| POST | `/alerts/admin/scan/medication-miss` | 漏服扫描（调试） |
| POST | `/alerts/admin/scan/follow-up-overdue` | 复诊逾期扫描（调试） |
| GET | `/alerts/:id` | 详情 |
| POST | `/alerts/:id/acknowledge` | 确认（知悉） |
| POST | `/alerts/:id/close` | 关闭（已处理） |
| POST | `/alerts/:id/assign` | 指派 [admin] |
| GET | `/alerts/:id/logs` | 处理日志 |
| POST | `/alerts/:id/logs` | 追加跟进备注 |

## 12. 分诊/咨询/AI 问诊
**分诊 `/triage`**：`POST /start` · `GET /sessions` · `GET /sessions/:id` · `GET /sessions/:id/messages` · `POST /sessions/:id/messages` · `POST /:id/feedback` · `POST /:id/convert`(转化) · `GET /admin/list` · `GET /admin/detail/:id` · `GET|POST /admin/sessions/:sessionId/messages` · `DELETE /admin/sessions/:id` · `GET /admin/stats`
**咨询预约 `/consultations`**：`POST /`(申请) · `GET /slot-options`(号源) · `GET /me`(我的) · `GET /`(管理列表) · `GET /by-date` · `GET /date-summary` · `PUT /:id/status`
**AI 问诊 `/ai-consultation`**：`POST /chat`(问诊) · `GET /sessions` · `GET /sessions/:sessionId` · `DELETE /sessions/:sessionId` · `POST /check-medications`(用药交互) · `POST /dietary-advice`(饮食) · `POST /interpret-report`(材料解读/多模态) · `POST /clinic-handoff`(门诊摘要) · `POST /messages/:id/feedback` · `POST /transcribe`(语音转文字) · `GET /weekly-reports`(周报) · `GET /weekly-reports/:id` · `POST /weekly-reports/generate` · `GET /admin/stats|sessions|by-user|messages|weekly-reports`（管理）

## 13. 医院/医生 Hospital（`/hospitals`、`/third-party/hospitals`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/hospitals` | 医院名录（省/市筛选） |
| GET | `/hospitals/regions` | 启用省市 |
| GET | `/hospitals/doctor-directory` | 跨院本院医生检索 |
| GET | `/hospitals/nearby` | 附近医院（经纬度） |
| GET | `/hospitals/map-markers` | 地图标点 |
| GET | `/hospitals/lookup/:id` | 单条 |
| GET | `/hospitals/:id/doctors` | 某院医生 |
| GET | `/hospitals/:id/map-point` | 导航坐标 |
| GET/POST/PATCH/DELETE | `/hospitals/admin/doctors...` | 后台医生 CRUD/批量 [admin] |
| GET/POST/PATCH/DELETE | `/hospitals/admin...` | 后台医院 CRUD [admin] |
| POST | `/hospitals/admin/seed-* / import-* / purge-* / enrich-amap` | 数据维护（种子/导入/清理/高德补全）[admin] |
| GET | `/third-party/hospitals` | 第三方：医院列表 |
| GET | `/third-party/hospitals/doctors` | 第三方：医生列表 |

## 14. 家庭 Family（`/family`）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/family` | 创建家庭 |
| GET | `/family` | 我的家庭 |
| GET | `/family/:id/members` | 成员列表 |
| GET | `/family/:id/invite-code` | 获取邀请码 |
| POST | `/family/:id/invite-code/refresh` | 刷新邀请码 |
| PUT | `/family/:id` | 更新家庭信息（guardian） |
| POST | `/family/join` | 邀请码加入 |
| POST | `/family/join-by-qr` | 扫码加入 |
| GET | `/family/.../health` `/medication` `/orders` | 查看家人健康/用药/订单 |
| PUT/DELETE | `/family/members/...` | 更新/移除成员、关联服务对象、同步健康数据 |
| POST/PUT/DELETE | `/family/.../elders...` | 家庭内加/编辑/移除老人、委托书签署 |
| GET | `/family/elder-home` | 老人端首页概览 |
| GET | `/family/.../customer-service` | 专属客服 |
| POST | `/family/.../invite-qrcode` | 邀请小程序码 |
| GET/POST/PUT | `/family/admin/...` | 管理端：家庭/成员/绑定/客服/回溯同步 [admin] |

> 家庭模块端点较多（约 30 个），上表按功能归组；精确签名见 `family.controller.ts`。

## 15. 客服/会员/财务
**投诉 `/complaints`**：`POST /`(提交) · `GET /mine`(我的) · `GET /`(管理列表) · `GET /stats/overview` · `GET /:id` · `POST /:id/append`(补充) · `PATCH /:id`(处理)
**会员 `/membership`**：`GET /me` · `GET /users/:userId` · `GET /annual-members`(年卡列表) · `POST /users/:userId/annual`(开通) · `DELETE /users/:userId/annual`(取消) · `PUT /users/:userId`(调整)
**财务 `/finance`**：`POST /`(提交报销) · `GET /`(列表) · `GET /report`(报表) · `PUT /:id/approve`(通过) · `PUT /:id/reject`(驳回)
**运营概览 `/dashboard`**：`GET /overview`(综合概览 KPI/评价/榜单)

## 16. 设备 Device（`/devices`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/devices/me/list` | 我的设备 |
| POST | `/devices/bind` | 绑定设备 |
| DELETE | `/devices/bindings/:bindingId` | 解绑（owner） |
| GET | `/devices` | 设备总列表 [admin] |
| GET | `/devices/stats/dashboard` | 运维大盘 [admin] |
| GET | `/devices/events/safety` | 安全事件流（跌倒/SOS/体征） [admin] |
| GET | `/devices/:id` | 设备详情（含 DP 快照） |
| GET | `/devices/:id/events` | 事件流水 [admin] |
| POST | `/devices/:id/dp` | 下发 DP（mock） |
| POST | `/devices/:id/self-control` | 下发自控指令（表情/动作，mock） |
| POST | `/devices/:id/ota/check` | 检查 OTA（mock） |
| POST | `/devices/:id/ota/upgrade` | 触发 OTA（mock） |
| POST | `/devices/:id/mock-event` | 模拟上行事件 [admin 联调] |
| POST | `/devices/:id/mock-online` | 模拟上下线 [admin 联调] |

## 17. 多租户 Tenant（`/tenants`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tenants/me/list` | 我加入的租户（切换用） |
| GET | `/tenants` | 租户列表 [admin] |
| POST | `/tenants` | 新建租户 [admin] |
| GET | `/tenants/roles` | 角色列表 [admin] |
| GET | `/tenants/permissions` | 权限点清单 [admin] |
| GET | `/tenants/tree` | 可见租户树 |
| GET | `/tenants/:id/descendants` `/ancestors` `/children` `/breadcrumbs` | 子孙/祖先/子级/面包屑 |
| POST | `/tenants/:id/move` | 移动租户层级 [admin] |
| GET | `/tenants/:id` | 详情 |
| PATCH | `/tenants/:id` | 更新 |
| DELETE | `/tenants/:id` | 软停 |
| GET | `/tenants/:id/members` | 成员 |
| POST | `/tenants/:id/members` | 加成员 |
| DELETE | `/tenants/:id/members/:userId` | 移除成员 |

## 18. 租户配置/告警派发（`/tenant-settings`、`/alert-dispatch`）
**租户配置 `/tenant-settings`（tenant-config）**：`GET /`(直接配置) · `GET /effective-all`(沿链生效) · `GET /devices/:id/effective`(设备生效) · `GET /device-logs/:deviceId`(下发历史) · `POST /device-logs/:logId/ack`(回执) · `GET /:key/effective` · `POST /`(新增/覆盖) · `POST /:key/push-to-devices`(下发子树设备) · `DELETE /:key`
**告警派发 `/alert-dispatch`**：`GET /rules` · `POST /rules` · `PATCH /rules/:id` · `DELETE /rules/:id` · `GET /incoming`(跨层告警流) · `GET /:alertId/plan`(分发计划)

## 19. 计费 Billing（`/billing`）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/billing/plans` | 套餐列表 |
| GET / POST | `/billing/subscriptions` | 我的订阅 / 创建 |
| GET | `/billing/subscriptions/:id` | 订阅详情 |
| POST | `/billing/subscriptions/:id/renew` | 续费 |
| POST | `/billing/subscriptions/:id/cancel` | 取消 |
| GET | `/billing/usage` | 本月用量 |
| POST | `/billing/usage/records` | 记录用量 [admin] |
| GET | `/billing/invoices` | 我的发票 |
| POST | `/billing/invoices` | 申请开票 |
| GET | `/billing/invoices/admin/all` | 所有发票 [admin/finance] |
| PATCH | `/billing/invoices/:id/issue` | 开票 [finance] |
| PATCH | `/billing/invoices/:id/reject` | 驳回 [finance] |
| GET | `/billing/usage/admin/summary` `/records` | 用量汇总/明细 [admin] |
| GET/POST/PATCH/DELETE | `/billing/revenue-share/rules...` | 分账规则 CRUD + toggle [admin/finance] |

## 20. AI / 统计 / 系统 / 审计
**MCP 网关 `/mcp`**：`POST /mcp`（JSON-RPC：initialize / tools/list / tools/call，详见 `08`）
**AI 对话留存 `/ai-dialogs`**：`GET /`(会话列表) · `GET /sessions/:id` · `POST /logs`(追加) · `POST /sessions/:id/finish` · `PATCH /sessions/:id/qa-status`(质检)
**AI 配置 `/ai-config`**：`GET /agent` · `GET /agent/versions` · `POST /agent`(存草稿) · `POST /agent/:id/publish` · `GET /crisis-words` · `POST /crisis-words` · `PATCH /crisis-words/:id` · `PATCH /crisis-words/:id/toggle` · `DELETE /crisis-words/:id`
**门户大盘 `/dashboard`（stat-dashboard）**：`GET /metrics-catalog`(指标字典) · `GET /summary`(KPI) · `GET /metric/:metric`(趋势) · `GET /rank/:metric`(排行) · `GET /region-map`(地图热力) · `GET /realtime`(实时快照) · `GET /breakdown/:dim`(构成) · `GET /export`(CSV) · `POST /aggregate/run`(手动聚合 [admin])
**系统 `/system`**：`GET /config/public/*`（客服 URL/小程序功能/门店信息/模板/用药剂量字典，公开） · `GET /configs` · `GET /configs/:key` · `POST /storage/test` · `POST /wechat/webhook/test` · `PUT /configs` · `PUT /configs/:key` · `DELETE /configs/:key` · `GET/POST /admins` · `PUT /admins/change-password` · `PUT /admins/:id/info` · `PUT /admins/:id/password` · `GET /attendants` · `PUT /attendants/:id/password|username`
**审计 `/audit-logs`**：`GET /`(查询操作审计，[admin])

---

## 21. 非 REST 通道
- **WebSocket（realtime）**：socket.io，无 REST 前缀；事件 `device.online/offline`、`device.dp.changed`、`alert.fall/sos/vital_anomaly/heartbeat`、`notification.new`、`ai.dialog.new`（详见 `02 §4.2`）。
- **Notification**：无独立控制器，作为服务被各模块调用（企业微信机器人 + 小程序订阅消息）。

---

## 22. V4.3 待补 API 域（规划）

> 本节对齐 V4.3 商业计划书和 [`22-V4.3功能对齐与待开发缺口清单.md`](./22-V4.3功能对齐与待开发缺口清单.md)，用于提醒后续新增端点时同步回填。已落地接口列在 §22.1，其余仍是规划项。

### 22.1 V4.3 已落地接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/app/device-token` | App 登录后注册或刷新推送 token |
| GET | `/app/device-token/mine` | 查询当前账号已绑定的推送设备 |
| DELETE | `/app/device-token/:id` | 退出登录、注销或设备失效时解绑 token |
| GET | `/device-settings/:deviceId` | 获取设备当前设置和最近下发记录 |
| PUT | `/device-settings/:deviceId` | 保存设备设置并生成下发任务 |
| GET | `/device-settings/:deviceId/logs` | 查看设备设置下发历史 |
| POST | `/device-settings/:deviceId/logs/:logId/mock-ack` | mock 设备设置下发回执 |
| POST | `/alerts/:id/ack` | 接管告警（App/社区后台别名） |
| POST | `/alerts/:id/false-alarm` | 标记 SOS/跌倒等告警为误报 |
| GET | `/alerts/fall-events` | 视觉跌倒相关告警列表兼容入口 |
| POST | `/alerts/mock-event` | 生成 SOS/视觉跌倒/体征异常 mock 告警 |
| POST | `/emergency-dispatch/:alertId/escalate` | 将告警升级到社区、人工中台或应急外呼 |
| POST | `/community-content` | 新建社区内容草稿 |
| GET | `/community-content` | 社区内容列表 |
| POST | `/community-content/:id/publish` | 发布社区内容并生成触达任务 |
| POST | `/community-content/:id/revoke` | 撤回社区内容并撤回触达任务 |
| GET | `/content-deliveries` | 触达回执列表 |
| POST | `/content-deliveries/:id/mock-ack` | mock 内容到达、播报、App 查看或失败回执 |
| POST | `/family/family-messages` | 家属给老人留言或投喂内容 |
| GET | `/family/family-messages` | 家庭留言列表 |
| POST | `/family/tasks` | 创建喝水、吃药、复诊等家庭提醒任务 |
| GET | `/family/tasks` | 家庭任务列表 |
| POST | `/family/tasks/:id/cancel` | 取消家庭任务 |
| POST | `/family/tasks/:id/mock-receipt` | mock 家庭任务播报或老人回应回执 |
| POST | `/voiceprints` | 创建声纹录入记录 |
| GET | `/voiceprints/family/:familyId` | 查询家庭成员声纹状态 |
| POST | `/voiceprints/:id/status` | 更新声纹录入或识别状态 |
| POST | `/service-providers` | 新增生活服务商/合作企业 |
| GET | `/service-providers` | 服务商列表 |
| POST | `/hospital-partnerships` | 新增合作医院协议和资源 |
| GET | `/hospital-partnerships` | 合作医院资源列表 |

### 22.2 V4.3 待补 API 域

| API 域 | 建议前缀 | 关键能力 |
|---|---|---|
| 内容生态 | `/content-catalog` `/content-playback` | 戏曲/评书/健康宣教等授权内容目录、播放任务、版权来源和用量计费 |

> 本清单随代码演进；新增端点请同步回填。精确入参/出参以各 `*.controller.ts` + DTO + Swagger（`/api-docs`）为准。
