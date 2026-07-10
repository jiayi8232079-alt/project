# 07 · 移动 App 说明（Flutter）

> 上层导航见 [`README.md`](./README.md)。本篇回答：**App 有哪些功能/路由、目录怎么分层、数据如何来、适老化与实时如何做**。
> 代码位置：`mobile/`（Flutter / Dart 3.10 + go_router 17 + Provider 6 + Dio 5）。复用同一 NestJS 后端。

---

## 1. 定位

App 聚焦 **C 端三类人（老人 / 家属 / 下单用户）**；护工端与管理端**不进 App**（护工用小程序 workbench，管理用 Vue 后台），避免重复造端。
依据：C 端范围裁剪与 App↔小程序对照矩阵（已并入 [`13-功能清单与开发状态.md`](./13-功能清单与开发状态.md)）。

---

## 2. 目录结构

```
mobile/lib/
├── main.dart                       # 入口：装配 Provider / 启动鉴权 / 实时连接
└── src/
    ├── app.dart                    # QiaoguoApp：GoRouter 路由表 + 主题 + 适老化包裹
    ├── core/
    │   ├── config/                 # AppConfig（baseUrl，--dart-define 覆盖）
    │   ├── auth/                   # AuthController（JWT 持久化 + 状态）
    │   ├── network/                # ApiClient（Dio + 拦截器）
    │   ├── storage/                # TokenStore（flutter_secure_storage）
    │   ├── realtime/               # RealtimeService（socket_io_client）
    │   └── mock/                   # 本地 mock
    ├── data/
    │   ├── repositories/           # 9 个后端 Repository（见 §4）
    │   └── models/                 # 数据模型（app_order 等）
    ├── features/                   # 业务功能（见 §3）
    │   ├── shell/                  # AppShell（底部 5 tab）
    │   ├── home / services / orders / health / medication /
    │   ├── alerts / ai_dialog / family / membership / profile /
    │   └── device/                 # 设备：application/data/domain/presentation（含 widgets）
    ├── theme/                      # app_theme + accessibility_controller（适老化）
    └── shared/                     # 公共组件（widgets / glass 背景）
```

---

## 3. 路由表（GoRouter，`src/app.dart`）

| 路由 | 页面 | 数据源 |
|---|---|---|
| `/` | AppShell（首页/服务/订单/健康/我的 5 tab） | dashboard |
| `/login` | 登录（手机号验证码 + Apple） | `/auth/*` |
| `/devices` · `/device/:id` | 设备列表 / 控制面板 | **MockDeviceRepository**（待接真实） |
| `/orders` · `/orders/:id` | 订单列表 / 详情 | `/orders` |
| `/services/:code` · `/services/:code/book` | 服务详情 / 预约下单 | `/professional-services/*` `POST /orders` |
| `/health` · `/health/:id` | 健康首页 / 健康档案 | `/users/me/service-targets`、`/users/service-targets/:id` |
| `/medications` | 用药计划 + 打卡 | `/medication-reminders/my`、`/medication-executions/check-in` |
| `/alerts` · `/alerts/:id` | 告警中心 / 详情 | `/alerts` |
| `/ai-dialogs` · `/ai-dialogs/:id` | AI 对话历史 / 详情 | `/ai-dialogs` |
| `/family` · `/family/dashboard` · `/family/join` · `/family/add-elder` | 家庭 / 看护盘 / 加入 / 加长辈 | `/family`、`/public/family/by-invite-code/:code` |
| `/membership` | 会员 | `/membership/me` |
| `/profile/edit` · `/settings` · `/privacy` · `/about` | 资料编辑 / 设置 / 隐私 / 关于 | 后端/本地/静态 |

登录重定向：未登录强制 `/login`；已登录访问 `/login` 跳 `/`（`refreshListenable: auth`）。

---

## 4. 数据层（Repository，`main.dart` 注入）

通过 `MultiProvider` 注入 9 个后端 Repository + 1 个设备 mock：
`OrderRepository` · `MedicationRepository` · `AlertRepository` · `DialogRepository` · `ServiceTargetRepository` · `ServiceRepository` · `FamilyRepository` · `MembershipRepository` · `UserRepository`，外加 `MockDeviceRepository`（设备暂走 mock）。
全部依赖 `ApiClient`（Dio）+ `TokenStore`（secure_storage）。

---

## 5. 实时推送

`RealtimeService`（socket.io）随登录态自动连接 / 断开（监听 `AuthController`）：
- 告警事件 → 全局横幅 + 首页/告警页自动刷新。
- 对应后端 `realtime` 网关（事件类型见 `02 架构 §4.2`）。

---

## 6. 适老化（Accessibility）

- `AccessibilityController`：「老人模式」开关，全局 `textScale`（1.25×）放大字号、加粗、按钮加大。
- 主题 `buildAppTheme(elderlyMode: ...)`；全局浅蓝白渐变光晕背景（`shared/glass.dart` 的 `AppBackground`）。
- 设计基线：主字号 ≥18sp、按钮高 ≥56dp、主色暖绿 `0xFF2F8F5B`。

---

## 7. 运行

```bash
cd mobile
flutter pub get
flutter run                                              # 连 localhost:3000
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   # Android 模拟器
flutter run --dart-define=API_BASE_URL=http://<局域网IP>:3000  # 真机
```

---

## 8. 开发状态与缺口

**已通（真实后端）**：登录（手机号/Apple）、下单闭环（服务→预约→订单→取消/评价）、用药打卡、告警确认、AI 对话回看、家属看护盘、家庭闭环（建组/邀请码/加长辈）、健康档案、会员、设置/隐私/关于。已删除全局假数据。

**仍缺（多依赖外部）**：
- 设备真实接入（涂鸦 IoT App SDK：配网/DP/视频/OTA）—— 现为 mock。
- 支付（微信/Apple 内购）、推送（FCM/APNs）、通知中心列表。
- 健康子页：历史/周报/添加被服务人；分诊/AI 实时问诊；用药风险；投诉；医院/医生/专家匹配；电子健康卡/委托签署；通用 webview。

完整对照矩阵见 [`13-功能清单与开发状态.md`](./13-功能清单与开发状态.md)。
后端待补接口（App 侧）：`POST /auth/logout`、`/auth/delete-account`、`/app/device-token`（推送）。
