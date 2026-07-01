---
name: checkout-com
description: Checkout.com 支付实战排障版 - 面向 Payments API、Payment Sessions、Hosted Payments Page、Flow/Frames、tokens、3DS、webhooks、Cko-Idempotency-Key、refund/void/capture、disputes、reconciliation、安全、测试和上线验证的海外支付接入。涉及 Checkout.com 收款、退款、回调、对账或生产排障时必须使用。
---

# Checkout.com 支付

首次自称：Checkout.com 支付（checkout-com，兼容 slug: checkout-com）。

定位：把 Checkout.com 从“接口能扣款”收敛为“payment/session/token 边界清晰、webhook 状态可靠、3DS 与 APM 可回放、重复支付可防”。先确认地区、币种、商户账户、processing channel、支付方式、状态机、webhook、退款争议、对账和上线门禁，再进入实现。

## 平台核心对象

- 核心对象：Payment、Payment Session、Hosted Payment、Flow、Frames、source、token、customer、capture、void、refund、dispute、processing channel、reconciliation report、webhook event。
- 典型流程：Payments API、Payment Sessions、Hosted Payments Page、Flow/Frames、card tokenization、APM、3DS、capture/void/refund、disputes、reconciliation。
- Payments API 重点：服务端创建 payment，amount 使用币种最小单位，currency 使用 ISO 货币码，source 可以是 token、instrument、APM 或 full card details；除非 PCI 范围允许，不直接传原始卡数据。
- Payment Sessions/Flow 重点：服务端创建 session，客户端只用 session data 或 session id 挂载 Flow；返回页里的 `cko-session-id` 只用于查询/关联，不等同支付成功。
- Flow/Frames 重点：Flow 是可嵌入的预构建支付 UI；Frames 是自定义卡表单的 tokenization 方案；Full card details API 不生成 token，只有满足 PCI DSS SAQ D 等合规范围时才允许。
- Frames 重点：客户端用 public key 收集卡信息并生成 token；服务端用 token 作为 source 创建 payment；token 只能短期用于 source，不是支付终态，也不能长期当卡凭证。
- webhook 重点：payment approved/declined/captured/refunded/voided、3DS、APM、dispute、retry/bulk 相关事件；Hosted Page、Flow 或 redirect 支付结果仍以服务端查询和 webhook 为准；HPP 本身不直接发业务终态 webhook。
- 幂等要求：`Cko-Idempotency-Key` 绑定业务订单、金额、币种、操作、重试窗口和调用方；payment、capture、void、refund 都要能安全重试。
- 安全边界：secret key/OAuth client secret 只在服务端；public key 只用于客户端；卡数据优先 token/Frames/Flow；webhook 签名必须基于 raw body 和对应环境的 secret 验证；日志必须脱敏 key、token、卡号、CVC、客户身份和 webhook secret。
- 测试重点：Sandbox、test/live key 分离、test cards、3DS challenge/frictionless、APM、webhook retries、duplicate payment request、refund/void、dispute、reconciliation export、live processing channel。

## 适用范围

- 海外线上收款、订阅、退款、取消、捕获、争议、对账、风控、3DS、安全和上线排障。
- 新增或修改 Checkout.com 支付 API、Flow/Frames 收银台、webhook、订单状态机、支付数据库表、后台对账任务或生产支付配置。
- 多币种、多地区、多商户、processing channel 切换、平台分账、订阅续费、支付失败恢复和支付事件审计。

## 不适用范围

- 只读学习支付平台、了解项目结构、仅识别依赖或 README 中提到支付平台但不改代码。
- 国内微信/支付宝支付专项；应使用对应国内支付技能。
- 纯 UI 收银台视觉设计，不涉及支付状态、金额、安全或 API 契约。
- 普通电商 checkout 页面，不接入真实 PSP、webhook、退款或对账。
- 未授权的支付绕过、盗刷、风控规避、卡测、撞库或批量交易尝试。

## 铁律

1. 金额、币种、商品、税费、折扣、收款方和订单状态必须由服务端确认；前端返回、redirect、success page、`cko-session-id` 不能作为支付成功事实。
2. Checkout.com amount 默认按币种最小单位传递和存储；零小数币种、三位小数币种、折扣税费和汇率必须有明确换算规则，禁止用浮点金额直接入参。
3. webhook 是支付终态事实源之一，但必须使用原始请求体验签、幂等、去重、按状态机推进，并能处理乱序、重复和延迟。
4. 每个支付动作必须绑定业务订单号、PSP 对象 id、processing channel、幂等键、金额、币种、用户、环境、request id 和审计日志。
5. 不存储卡号、CVC、磁道或未经授权的敏感支付数据；优先使用 Hosted Payments Page、Flow、Frames 或 tokenization 降低 PCI 范围。
6. 退款、void、capture、订阅变更、争议处理和人工补偿必须可审计、可重试、可对账。
7. test/live 环境配置、secret key、public key、webhook secret、endpoint、API version、processing channel 和回调域名必须分离。
8. 没有沙箱全链路、webhook 重放、重复请求、失败支付、3DS、退款和对账验证，不报告支付接入完成。

## 快速总则

- 先建支付状态机，再写接口：created、requires_action、authorized、captured、paid、failed、cancelled、voided、refunded、partially_refunded、disputed、chargeback、settled 等状态要有明确迁移。
- 先选集成形态：Hosted Payments Page 最低集成成本，Flow 适合嵌入式多支付方式，Frames 适合自定义卡表单，Payments API full card details 只有 PCI 范围允许时才考虑。
- 服务端负责 create payment/session、query payment、capture、void、refund、dispute、reconciliation；客户端只负责收集 token/session action 和展示状态。
- 所有 payment/capture/void/refund/订阅变更默认幂等；所有 webhook 默认至少一次投递，不能写成“只会来一次”。
- 订单表、支付表、事件表、退款表、争议表、对账表分清；不要把 PSP 原始事件直接覆盖业务订单。
- API base URL 使用商户环境自己的 `{prefix}`；sandbox、production、OAuth token endpoint、API key、webhook secret 和 processing channel 必须成套切换。
- 处理 capture/refund/void 响应时不能只按旧状态码分支；重复完整 capture/refund/void 可能返回成功响应和既有 action id，部分重复或非法动作仍要识别 422。
- 前端必须覆盖 loading、requires action、取消、失败、超时、重复点击、返回页刷新、移动端和弱网。
- 后台必须支持按业务订单号、payment id、session id、action id、event id、request id、用户和时间窗口检索。
- 上线必须有灰度、监控、告警、人工补偿路径和密钥轮换方案。

## 强制流程：需求 → 状态机 → 集成形态 → 实现 → 验证

1. 输入锁定：确认国家/地区、币种、商户主体、支付方式、processing channel、收款账户、结算周期、税务、退款规则、争议责任和合规要求。
2. 平台对象映射：列业务订单、支付单、payment、session、source/token、refund、dispute、reconciliation line 与 PSP 对象的一一映射。
3. 状态机设计：列状态、事件、允许迁移、非法迁移、终态、重试、人工补偿和回滚点。
4. 幂等与并发：定义每个写操作的 `Cko-Idempotency-Key`、唯一约束、锁/事务、重复点击、重试和旧请求覆盖策略。
5. webhook 设计：验签、event id 去重、raw body 落库、异步处理、乱序处理、失败重试、死信和重放工具。
6. 安全设计：test/live key 存储、前后端 key 边界、PCI 范围、日志脱敏、权限、审计和风控样本。
7. 实现：优先最小闭环；先 session/payment 创建、3DS/redirect 处理、webhook、订单更新，再扩展退款、void、capture、争议、对账。
8. 验证：沙箱全链路、负向支付、3DS、webhook 重放、退款、争议、对账、生产配置检查和回滚演练。
9. 交付：输出环境、对象映射、状态机、验证证据、未覆盖风险和上线门禁。

## 场景执行卡

### 1. Payments API 一次性支付

- 证据：amount、currency、reference、source、payment_type、capture/capture_on、3ds、risk、processing_channel_id、success_url/failure_url、metadata、用户、库存/权益发放时机。
- 动作：服务端创建 payment；token/instrument/APM 作为 source；返回 action 时走 3DS/redirect；支付成功必须由服务端查询或 webhook 推进。
- 验证：成功、declined、取消、重复点击、刷新、移动端、3DS challenge/frictionless、risk decline、webhook 延迟、订单超时关闭和重复 create payment。

### 2. Payment Sessions、Hosted Page、Flow

- 证据：session 创建端、success/failure URL、`cko-session-id` 回传、客户可用支付方式、locale、billing/shipping、risk data、expires 和回调域名。
- 动作：服务端创建 session；客户端挂载 Flow 或跳转 Hosted Page；返回页用 session id 查询状态并展示，不直接发货；Flow webhook scope 使用当前 notifier 要求。
- 验证：session 过期、重复打开、后退刷新、APM pending、3DS、支付方式不可用、redirect 丢失、`cko-session-id` 与业务订单不匹配、notifier scope 缺失导致 webhook 不到达。

### 3. Frames、source 和 token

- 证据：public key、token 生命周期、token 与订单绑定、cardholder/billing data、PCI 范围、浏览器错误态和服务端 source 入参。
- 动作：客户端通过 Frames 生成 token；服务端把 token 作为 source 创建 payment；token 只能短期使用，不能当长期卡凭证。
- 验证：token 过期、重复使用、错误 public key、test/live key 混用、卡表单校验失败、CSP/iframe/浏览器兼容、服务端日志是否泄露 token 或卡信息。

### 4. 3DS 与认证动作

- 证据：是否强制 3DS、SCA 地区、challenge/frictionless、redirect/action URL、成功/失败回传、超时和 abandon 处理。
- 动作：requires_action 独立状态；3DS 完成后服务端查询 payment 或等待 webhook；不能只靠浏览器回跳。
- 验证：challenge 成功、challenge 失败、frictionless、issuer timeout、用户关闭页面、重复回调、支付已授权但未捕获。

### 5. 授权、capture 和 void

- 证据：是否预授权、capture_on、捕获窗口、部分捕获、void 规则、库存/发货/酒店押金等业务规则。
- 动作：授权成功不等于收款完成；capture、void、过期和失败必须独立状态和幂等键。
- 验证：授权成功捕获、部分捕获、超时未捕获、void 授权、重复 capture/void、金额不一致和 webhook 乱序。

### 6. 退款和补偿

- 证据：可退金额、capture 状态、部分退款、手续费、跨币种、退款窗口、库存/权益回滚和客服权限。
- 动作：退款单独建表；发起、处理中、成功、失败都要可查；失败不能直接改订单为已退款。
- 验证：全额、部分、多次退款、重复请求、超额退款、退款失败、webhook 延迟和人工补偿。

### 7. Webhook 与事件处理

- 证据：事件类型、`Cko-Signature`、webhook secret、raw body、事件 id、幂等表、死信队列和重放入口。
- 动作：先用原始 body 验签和落库，再异步推进业务状态；按环境/商户/processing channel 选择正确 secret；未知事件可记录但不误改状态。
- 验证：签名错误、错环境 secret、body 被 JSON parser 改写、重复事件、乱序事件、缺字段、慢处理、5xx 重试、死信重放和历史事件补偿。

### 8. Risk、AVS 和风控决策

- 证据：risk 对象、device/network、billing/shipping、AVS/CVV 结果、fraud rule、risk score、3DS liability shift、拒绝原因和人工复核入口。
- 动作：把 risk decline、issuer decline、3DS failure、merchant manual review 分开入状态；AVS 需要 billing address 才能稳定参与校验；风控命中不能直接改成支付成功或业务取消。
- 验证：缺 billing address、AVS mismatch、CVV mismatch、risk rule decline、manual review、3DS frictionless/challenge 与 webhook 终态组合。

### 9. 争议、拒付和风控后处理

- 证据：dispute/chargeback 生命周期、证据提交窗口、通知人、金额冻结、订单权益处理和会计影响。
- 动作：争议不等同退款；独立状态记录证据、期限、结果、资金影响和用户限制。
- 验证：争议创建、证据提交、赢/输、反转、资金扣回、通知和报表对齐。

### 10. 对账与结算

- 证据：Checkout.com report、balance/transaction、payout、fee、FX、refund、dispute、税费、商户账户、processing channel 和时间区间。
- 动作：业务支付单、PSP 交易、余额流水、打款流水分层对账；差异进入待处理队列。
- 验证：日切、时区、手续费、部分退款、争议、打款失败、跨币种、重复导入和 reporting delay。

### 11. Sandbox/live rollout

- 证据：sandbox/live Dashboard、唯一 API base URL prefix、public/secret/OAuth key、webhook secret、webhook endpoint、processing channel、risk strategy、3DS 设置、域名 allowlist、告警和客服 SOP。
- 动作：先 sandbox 全链路，再 live 小额灰度；live 首单只开放最小支付方式和最小地区；发布包必须能快速关闭支付方式、切回旧 channel 或暂停发货。
- 验证：生产小额支付、退款、webhook、后台查询、告警触发、密钥轮换、错误 key/endpoint 注入演练和回滚路径。

### 12. 运维与生产排障

- 证据：request id、payment id、session id、action id、event id、reference、processing channel、response code、scheme response、Dashboard transaction events 和日志 trace。
- 动作：先按对象链路定位，再按 Checkout.com/Dashboard 事件、webhook、业务状态机和 DB 状态对齐；不要靠客服截图直接改账。
- 验证：同一订单跨 API 响应、webhook、Dashboard、对账报表和业务后台一致；不一致时进入差异队列。

## Checkout.com 专项检查

- API endpoint：sandbox 和 production base URL 必须来自对应环境，不要硬编码旧公共域或把 sandbox prefix 用到 live。
- Key 边界：public key 只在 Flow/Frames/客户端；secret key 或 OAuth 只在服务端；日志和错误上报不能输出完整 key。
- Amount：持久化使用整数 minor units；展示层格式化；退款和 capture 必须校验不超过已授权/已捕获/可退金额。
- Currency：currency 必须为三字母 ISO 货币码；业务币种、结算币种、展示币种和 report 币种必须分列，不能用一个 string 混写。
- Source/token：source 类型、token 生命周期、instrument 复用、APM pending 和 customer 绑定要落表，不能只存前端临时状态。
- Processing channel：多商户、多地区、多渠道必须显式记录和校验，避免生产流量打到错误 channel。
- Idempotency：同一业务操作重试复用同一 key；不同金额、币种、订单或操作不能复用旧 key；首个请求超时后必须用同 key 查询/重试，不能新建 payment 猜测。
- Webhook raw body：框架中间件不能先解析再验签；必须保留原始字节串，并用常量时间比较签名结果；验签失败只记录脱敏摘要，不打印 secret、完整 signature 或完整 payload。
- 3DS：requires_action 不能当失败；认证结果、payment 状态和 capture 策略必须合并判断。
- Redirect：success/failure URL 只负责前端展示和主动查询；权益发放必须等服务端确认。
- Reconciliation：payment、refund、chargeback、fee、FX、payout、adjustment 分层入账，差异要有 owner 和 SLA。

## API 字段门禁

- Payments API：amount、currency、reference、source、capture、capture_on、3ds、risk、processing_channel_id、success_url、failure_url、metadata 必须逐项确认来源、默认值、可空规则和日志脱敏策略。
- Amount/currency：amount 为整数 minor units；零小数和三位小数币种要有测试样例；不得在 API 入参、DB 或对账逻辑中使用浮点金额。
- Source：token、instrument、APM、card source 的字段边界不同；full card details 只允许在合规批准后使用，并要有 PCI 责任说明。
- 3DS：`3ds.enabled`、challenge preference、SCA 地区、MIT/recurring、liability shift、issuer timeout 和 abandon 都必须进状态机。
- Capture/void/refund：capture 只能基于可捕获授权，void 只能基于未捕获授权，refund 只能基于已捕获金额；部分金额、重复请求和已完成动作要有独立分支。
- Risk：risk data 要从服务端可信来源合并，device/browser/IP/billing/shipping 缺失要降级或阻断；不要让客户端直接决定 risk outcome。
- Webhook：事件 id、payment id、action id、reference、event type、created time、processing channel 和 raw body hash 必须落库，业务推进必须幂等。

## 验证门禁

- 沙箱支付成功、declined、取消、3DS、重复点击、刷新和移动端已覆盖。
- Payment Sessions/Flow 返回 `cko-session-id` 后，服务端查询与 webhook 终态已覆盖。
- Frames token、source token 过期、test/live key 混用和 token 泄露检查已覆盖。
- webhook 签名、raw body、去重、乱序、重试、死信和重放已覆盖。
- 幂等键、唯一约束、并发请求、重复 capture/void/refund 已覆盖。
- amount/currency minor units、零小数币种、三位小数币种、部分 capture/refund 和超额动作已覆盖。
- risk data、AVS/CVV、3DS liability、风控拒绝和人工复核路径已覆盖。
- 退款、争议、对账和人工补偿至少有最小闭环。
- 生产配置、unique base URL prefix、processing channel、key、webhook endpoint、API version、notifier scope、告警和回滚已检查。

## 输出要求

- 先给支付影响面：前端、后端、DB、webhook、后台、对账、权限、监控和发布。
- 再给状态机和对象映射，不用“支付成功”一句话代替。
- 再给改动点和验证证据：命令、沙箱订单、payment id、session id、event id、request id、日志、截图或后台记录。
- 最后给剩余风险：未覆盖支付方式、地区、币种、订阅、争议、对账或生产配置。

## 安全边界

- 不帮助卡测、盗刷、绕过风控、绕过 3DS、绕过支付、伪造回调或隐藏交易。
- 不输出真实 secret key、webhook secret、商户 token、客户支付数据或完整卡号。
- 不把支付成功建立在前端参数、redirect query、`cko-session-id`、未验签 webhook 或未确认的客户端状态上。
- 不为未授权商户、第三方账户或真实用户发起交易测试。
- 不把 Checkout.com test/live key、OAuth client secret、webhook secret、token、customer PII 写进技能文档、日志、工单或最终回复。

## 反例库

- 前端 success URL 到达就发货：错误，必须由服务端支付查询或 webhook 终态推进。
- 看到 `cko-session-id` 就认为 paid：错误，session id 只能用于查询和关联。
- webhook 不验签直接改订单：高危，必须阻断。
- webhook 先 `JSON.parse` 再验签：容易失败或被绕过，必须使用 raw body。
- amount 用浮点元/美元直接传入：错误，必须使用币种最小单位整数。
- 没有 `Cko-Idempotency-Key` 就创建 payment、capture、void 或 refund：会导致重复扣款/重复操作。
- 同一个幂等键跨订单、跨金额、跨币种复用：会制造难以解释的旧响应。
- Flow/Frames 前端 token 直接写业务支付成功：错误，token 只是 source，不是 payment 终态。
- 把 public key 放服务端当 secret 或把 secret key 放前端：严重密钥泄露。
- test key、live key、sandbox endpoint、production endpoint 混用：会导致真实扣款失败或测试流量进生产。
- 使用固定公共 API 域名或旧 endpoint，不使用商户自己的 `{prefix}`：环境排障会失真。
- 忽略 processing channel：多商户/多地区容易入错账。
- 3DS challenge 失败或超时不落状态：会造成订单永久 pending。
- 把 requires_action 当 declined：会误杀可恢复支付。
- risk decline、issuer decline、3DS failure 都写成 payment failed：后续优化和客服追踪会失真。
- 授权成功就发货但业务要求 capture 后发货：资金风险。
- 把 void、refund、chargeback 都覆盖成订单 failed：财务和客服不可追踪。
- 重复完整 capture/refund/void 返回成功响应就再次发放权益：错误，应按 action id 和业务状态机去重。
- 退款未校验可退余额、币种和 capture 状态：会导致超额退款或错误补偿。
- 只测成功卡，不测 declined、3DS、取消、重复、退款、void、dispute 和对账：不能上线。
- 对账只按订单金额，不对手续费、FX、退款、争议和 payout：财务不可闭环。
- live 首单没有灰度、告警和关闭开关：生产事故无法止血。
- 日志打印完整 Authorization、token、卡 BIN+后四位以外信息、CVC 或 webhook secret：合规风险。

## 自检清单

- 是否确认国家、币种、商户、支付方式、processing channel、收款账户和合规边界？
- 是否有业务订单与 payment/session/source/refund/dispute/report line 映射？
- 是否有状态机、幂等键、唯一约束和 webhook 去重？
- 是否按 raw body 验签、脱敏、隔离 test/live key？
- 是否覆盖 Payment Sessions、Flow/Frames、source/token、3DS、capture/void/refund、dispute 和 reconciliation？
- 是否跑过沙箱全链路、webhook 重放和上线前生产小额验证计划？

## 相邻技能边界

- API 工程 / api-engineering（api）：接口契约、状态码、幂等和 webhook API 设计；支付技能负责 PSP 语义和支付状态机。
- 数据库工程 / database-engineering（db）：支付/退款/事件/对账表设计和事务；支付技能负责字段语义和资金状态。
- Web 安全 / web-security（wsec）：鉴权、XSS、CSRF、密钥和权限专项；支付安全命中时联动。
- 测试验证 / test-engineering（tst）：测试矩阵和 CI gate；支付上线前必须联动测试验证。
- 代码审计 / code-audit（aud）：代码审计和安全审计；支付核心链路默认联动。
- 可观测性 / observability（obs）：日志、指标、trace、告警；支付生产监控联动。
- 法务合规 / legal-counsel（law）：合规、隐私、税务、地区限制、争议规则；跨境支付和订阅条款联动。
- 发布部署 / release-engineering（rls）：发布、灰度、回滚和生产验证；支付上线联动。
