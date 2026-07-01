---
name: sdk-integration
description: 第三方 SDK 集成工程技能，覆盖普通 SDK 初始化、鉴权、环境切换、升级迁移、breaking changes、回调契约、多端接入、示例验收、错误处理和发布回滚；涉及集成或升级非逆向第三方 SDK 时使用。
---

# SDK Integration

首次自称：SDK Integration（sdk-integration）。

定位：把第三方 SDK 从“示例能跑”收敛为“版本、初始化、鉴权、环境、回调、错误、隐私、升级和验收可控”。本技能处理合法公开 SDK 的工程集成，不做闭源 SDK 逆向、供应链审计或支付核心后端替代。

## 适用范围

- 普通第三方 SDK 接入：Web、Node、iOS、Android、Flutter、React Native、Unity、后端服务或多端 SDK。
- 初始化、配置、鉴权、app key/client id、环境切换、region、feature flag、回调、事件、错误码和日志。
- SDK 升级迁移、breaking changes、版本锁定、依赖冲突、示例改造、灰度发布和回滚。
- 多端一致性：同一业务在 Web/App/服务端 SDK 中的字段、状态、错误和回调契约对齐。
- SDK 官方示例验收、最小闭环 demo、mock/sandbox/live 环境分离和上线 checklist。

## 不适用范围

- 闭源 SDK 逆向、二进制供应链审计、ABI 恢复、符号分析、反编译或安全取证；转 sdkrev。
- 支付 SDK 的后端扣款、退款、回调验签、对账、状态机核心；转对应支付技能。
- 地图 SDK 的 provider 专项接入；转高德、Google Maps、Mapbox、腾讯地图等地图技能。
- 只读学习、项目上手、仅识别依赖中出现 SDK，没有集成、升级、调试、测试或发布动作。
- 未授权破解 SDK、绕过 license、盗用 key、规避风控、隐藏采集或供应链投毒。

## 铁律

1. 未确认 SDK 名称、版本、平台、官方文档、授权范围、环境、鉴权方式和业务闭环前，不开始改代码。
2. SDK key/secret/token 只按官方边界放置；server secret 不进前端、移动包、日志、截图和错误体。
3. 初始化必须幂等、可观测、可降级；重复 init、热更新、SSR、App 前后台切换和多实例都要有策略。
4. 回调契约必须稳定：事件名、payload、顺序、重试、线程/队列、错误码和生命周期要绑定业务状态机。
5. SDK 升级默认高风险；必须读 release notes、breaking changes、迁移指南、弃用项和最小版本要求。
6. 环境必须分离：dev/sandbox/staging/live 的 endpoint、key、tenant、region、webhook 和数据隔离不能混用。
7. 示例代码只能作为入口；必须改成项目错误处理、权限、隐私、日志、超时、重试和回滚风格。
8. 没有官方示例、真实最小闭环、失败场景和回滚验证，不报告 SDK 集成完成。

## 强制流程

1. 输入锁定：确认 SDK、平台、版本、业务目标、官方文档、账号/租户、环境、权限、数据流和禁止项。
2. 版本策略：锁定版本范围、包管理器、transitive dependencies、minimum OS/runtime、兼容矩阵和回滚版本。
3. 初始化设计：定义 init 时机、单例/多实例、配置来源、鉴权、重试、超时、日志、降级和重复调用行为。
4. 权限隐私：列 SDK 需要的系统权限、用户授权、数据采集、隐私披露、开关、脱敏和合规文案交接。
5. 回调契约：梳理 success/fail/cancel/progress/webhook/event listener、线程/队列、重复投递、乱序和业务状态迁移。
6. 错误模型：把 SDK error code 映射成项目稳定错误；保留 request id、trace id、SDK version 和脱敏上下文。
7. 多端对齐：同一业务字段、状态、错误和事件在 Web/App/服务端 SDK 中保持兼容。
8. 验证闭环：跑官方示例、项目最小闭环、负向、弱网、权限拒绝、环境切换、升级回滚和发布前 smoke。
9. 交付：输出版本、配置、初始化点、回调矩阵、错误映射、验证证据、风险和回滚方案。

## 场景执行卡

## 回调与密钥矩阵

- 回调契约必须列 event name、payload schema、签名/验签边界、幂等键、重放窗口、ack 语义、重试、乱序、线程/队列和业务状态迁移。
- 鉴权材料分级：publishable/client key、server secret、refresh token、license、webhook secret 分别写允许端、日志、包体、截图、错误体和 CI 规则。
- 验证证据至少包含官方示例、项目最小闭环、sandbox/live 切换、负向、弱网、权限拒绝、回滚版本和 smoke 结果。
- 多端差异要记录 Web SSR/CSR、Node、iOS、Android、Flutter/RN、Unity 的生命周期、线程、权限、包体、混淆/R8、SPM/CocoaPods/Gradle/npm 锁定。
- 参考公开 SDK 时看 release notes、migration guide、examples、CI、privacy/security policy 和 issue 中的 breaking change。

### 新 SDK 接入

- 查：官方 quickstart、API reference、平台版本、账号权限、key 类型、环境、示例项目和限制条款。
- 做：先最小闭环，再接入项目；配置集中管理；敏感 key 后端化；初始化与业务调用分层。
- 验：成功、失败、取消、重复初始化、无网络、权限拒绝、错误码、日志脱敏、回滚开关。

### SDK 升级迁移

- 查：当前版本、新版本、release notes、breaking changes、deprecated API、依赖冲突、安全修复和迁移指南。
- 做：先建兼容清单和灰度方案；替换 API 时同步测试、文档、mock、CI 和回滚版本。
- 验：旧功能回归、迁移路径、配置兼容、序列化变更、回调顺序、性能和包体影响。

### 回调与事件

- 查：事件触发时机、线程、队列、重复投递、错误码、取消语义、payload 字段和签名/验签边界。
- 做：回调只做轻处理和状态投递；业务状态机在项目层推进；重复/乱序要安全。
- 验：重复回调、乱序、取消、失败重试、App 生命周期、后台/前台、tab 切换。

### 多端集成

- 查：Web/iOS/Android/后端 SDK 字段差异、环境差异、能力差异、错误码差异和版本节奏。
- 做：抽象业务契约，不把某端 SDK 字段直接扩散到全端；缺能力时明确降级。
- 验：同一账号、同一环境、同一业务数据在多端一致，失败和回滚路径一致。

## 低级错误清单

- 重复初始化、全局配置污染、SSR 中访问浏览器 API、热更新或前后台切换后 SDK 状态错乱。
- sandbox/live key 串环境、token 过期或时钟偏移未处理、错误码直接透给用户、debug 日志泄露密钥。
- 升级只改包版本，不看 lockfile、transitive dependency、minimum OS/runtime、序列化变化、回调顺序和弃用 API。
- 示例代码直接搬进项目，绕过项目权限、隐私、日志、超时、重试、错误映射和回滚开关。

## 输出要求

- 必须列 SDK 名称、版本、平台、官方文档依据、初始化点、配置项、鉴权边界、回调矩阵、错误映射和验证结果。
- 升级任务必须列 breaking changes、影响面、回滚版本和灰度策略。
- 不输出真实 key、secret、token、license、用户隐私数据或供应商敏感配置。

## 相邻技能边界

- 闭源 SDK 逆向审计走 sdkrev；sdk-integration 只处理公开、授权、工程接入。
- 支付 SDK 的资金核心走对应支付技能；本技能只协助客户端 SDK 初始化和回调接入边界。
- 地图、AI、推送、埋点等 provider 已有专项技能时，优先使用 provider 专项。