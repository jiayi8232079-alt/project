---
name: adyen
description: Adyen 支付实战技能 - 覆盖 Checkout Payments API、Sessions flow、Advanced flow、merchantAccount、amount minor units、resultCode/action/3DS、webhook HMAC、pspReference/merchantReference、idempotency、capture/refund/cancel、Adyen for Platforms、test/live、API key/client key、PCI、日志脱敏、对账和上线排障。
---

# Adyen 支付

首次自称：Adyen 支付（adyen）。

定位：把 Adyen 接入从“能弹出收银台”收敛为“金额和商户账户正确、3DS/action 闭环、webhook 可信、资金动作可审计、test/live 配置可复核、对账可闭环”。只要涉及 Adyen 收款、退款、捕获、取消、3DS、平台分账、回调、对账或生产排障，就按本技能执行。

## 适用范围

- 新增或修改 Adyen Checkout API、Sessions flow、Advanced flow、Drop-in、Components、支付方式配置、3DS、webhook、订单状态机、退款、捕获、取消、争议、对账、平台分账或上线配置。
- 排查 Adyen 支付失败、resultCode 异常、action 未处理、3DS 卡住、webhook 重复/验签失败、金额不一致、merchantAccount 错误、test/live 混用、capture/refund/cancel 失败。
- 设计多币种、多地区、多 merchantAccount、Adyen for Platforms、Marketplace、Balance Platform、split、seller onboarding、payout 和 reconciliation 方案。

## 不适用范围

- 只读学习项目、只识别依赖或 README 中出现 Adyen、仅解释支付概念但不改接口/状态/配置/测试。
- 国内微信/支付宝支付专项；应转对应支付技能。
- 纯 UI 视觉调整，不涉及金额、支付状态、密钥、API、webhook 或资金动作。
- 未授权交易、卡测、盗刷、绕过 3DS、伪造 webhook、规避风控或隐藏交易。

## 铁律

1. 支付成功不能由前端 success URL、redirect query、Drop-in 回调或 resultCode 单独决定；订单终态必须由服务端查询和已验签 webhook 共同约束。
2. 金额必须使用 Adyen 对应币种的 minor units；不要假设所有币种都是两位小数，JPY、BHD、ISK 等必须查表。
3. 每个请求必须明确 merchantAccount、reference/merchantReference、amount.value、amount.currency、countryCode、shopperReference/ shopperEmail 等业务必要字段；不能让前端传入最终金额或商户账户。
4. Checkout Sessions flow 和 Advanced flow 不能混写状态模型：Sessions 由 `/sessions` 创建 session，Advanced flow 由 `/payments` 与 `/payments/details` 驱动 action。
5. `resultCode` 只表示当前支付状态；`Authorised` 也不等于已入账，manual capture 下必须完成 capture 才能视为可结算。
6. `action` 出现时必须完整交给前端组件处理，并将 `/payments/details` 的结果回到服务端状态机；不能丢弃 3DS/redirect/voucher 动作。
7. webhook 默认至少一次投递，可能重复、乱序、延迟；必须验 HMAC、落原文、去重、幂等推进状态。
8. `pspReference` 是 Adyen 支付对象关键引用，`merchantReference` 是业务幂等和追踪引用；两者都要入库、索引、日志脱敏展示。
9. 所有 POST 写动作默认带 idempotency key，超时重试复用同一个 key；重复点击、重试任务和人工补偿不得产生重复扣款/重复退款。
10. API key 只在服务端；client key 可用于前端但必须绑定 allowed origins 和环境；HMAC key 只用于 webhook 验签；三类 key 不混用。
11. test 与 live 的 merchantAccount、API key、client key、HMAC key、endpoint prefix、webhook endpoint、allowed origins、支付方式配置必须分离。
12. 不存储完整 PAN、CVC、磁道或未授权敏感支付数据；日志、错误上报、埋点、工单、对账导出必须脱敏。

## 核心对象与字段

- API 对象：Checkout `/sessions`、`/payments`、`/payments/details`、captures、refunds、cancels、paymentMethods、webhook notification。
- 业务对象：订单、支付单、支付事件、退款单、捕获单、取消单、争议单、对账流水、平台分账记录、人工补偿记录。
- 必填画像：merchantAccount、amount.value、amount.currency、reference/merchantReference、returnUrl、shopperLocale、countryCode、channel、paymentMethod、browserInfo、shopperIP、shopperReference。
- Adyen 引用：pspReference、originalReference、merchantReference、eventCode、success、reason、refusalReason、paymentMethod、additionalData、modificationPspReference。
- 资金动作：authorize、capture、cancel、refund、cancelOrRefund、partial capture、partial refund、dispute、chargeback、payout、split settlement。
- 状态建议：created、session_created、requires_action、received、pending、authorised、capturing、captured、cancelled、refused、error、refund_pending、refunded、partially_refunded、disputed、chargeback、settled。

## 强制流程

1. 锁定业务事实：国家/地区、币种、商品、税费、折扣、收款主体、merchantAccount、支付方式、capture 模式、退款窗口、争议责任、平台分账和合规边界。
2. 选集成形态：默认优先 Sessions flow 降低前端复杂度；需要自定义支付细节、partial payments、复杂 3DS 或特定 APM 时才选 Advanced flow。
3. 设计状态机：列出 resultCode、action、webhook eventCode、capture/refund/cancel/dispute 对业务状态的迁移表和非法迁移处理。
4. 设计幂等：为支付创建、capture、refund、cancel、平台 split、重放 webhook、人工补偿定义唯一约束、idempotency key、锁和重试规则。
5. 设计 webhook：保存 raw payload、校验 HMAC、按 eventCode/success/originalReference/pspReference 去重，异步推进业务状态，支持死信和重放。
6. 设计安全：服务端保存 API key，前端只拿 client key；密钥进 Secret Manager/环境变量；日志不落卡数据、完整 key、HMAC secret、身份证件或银行账号。
7. 实现最小闭环：先 payment session/payment、action/details、AUTHORISATION webhook、订单查询、capture 策略，再扩展 refund/cancel/platforms/reconciliation。
8. 验证矩阵：成功、失败、Refused、Error、Received/Pending、3DS challenge、redirect、取消、重复请求、超时重试、webhook 重放、退款、捕获、对账。
9. 上线门禁：live prefix、live API key、live client key、live HMAC、allowed origins、webhook endpoint、Customer Area 支付方式、告警、回滚和客服 SOP 全部复核。

## Sessions Flow 执行卡

- 服务端创建 `/sessions`：金额、币种、merchantAccount、reference、returnUrl、countryCode、shopperReference、shopperEmail 和 line items 必须由服务端生成。
- 前端只使用 session id/sessionData、client key 和 environment 初始化 Drop-in/Components；不能让前端决定金额或 merchantAccount。
- Sessions flow 的 `sessionData` 视为敏感会话材料，不写入前端日志、埋点、错误上报或工单截图。
- 自定义 pay button 时必须在 `beforeSubmit` 阶段禁用重复提交；失败后按明确状态恢复，不允许用户连点生成多个 session。
- 支付结束后前端 resultCode 只用于展示；服务端必须等待 webhook 或主动查询确认订单状态。
- 验证：session 过期、重复点击、刷新返回页、移动端浏览器、3DS、APM Pending、失败卡、取消支付、webhook 延迟。

## Drop-in 与 Components 执行卡

- Drop-in 适合快速覆盖多支付方式；Components 适合高度自定义布局、单支付方式细节控制或分步 checkout；不要为了视觉定制牺牲支付方式原生按钮和合规提示。
- 前端初始化必须绑定正确 environment、clientKey、session 或 paymentMethodsResponse；test/live、region、allowed origins 与服务端 endpoint 必须一致。
- React/Vue/SSR 场景只在浏览器端初始化一次 AdyenCheckout 和组件；重渲染、StrictMode、路由返回、弹窗重复挂载都要防止重复 mount 和重复 submit。
- Drop-in/Components 依赖浏览器能力；生产 checkout 必须 HTTPS，避免跨域 iframe 和移动 WebView；如果必须 iframe，同域承载并验证 redirect/3DS 回跳。
- 支付方式特有按钮如 PayPal、Klarna、Click to Pay 不要用自定义按钮替代；遵守组件提供的按钮、条款展示和事件回调。
- 引入 Adyen Web 资源优先使用 npm 包；若嵌入脚本和样式，版本、SRI、crossorigin、region URL、live endpoint region 必须成组复核。
- 验证：重复挂载、重复点击、浏览器后退、移动端 Safari/Chrome、广告拦截、密码管理器、cookie 策略、暗色模式、无障碍焦点和键盘提交。

## Advanced Flow 执行卡

- `/payments` 响应可能返回 `resultCode`、`action`、`pspReference`；有 action 时必须由前端处理并回传 `/payments/details`。
- `ChallengeShopper`、`IdentifyShopper`、`RedirectShopper` 不可当失败处理；它们表示需要 3DS/redirect 等下一步动作。
- `Received`、`Pending`、`PresentToShopper` 不是终态；应展示等待或凭证，同时等待 webhook。
- `Authorised` 表示授权成功；auto capture 与 manual capture 的业务发货/权益发放规则必须分开。
- `Refused`、`Error`、`Cancelled` 要记录 refusalReason/reason，但对用户展示要克制，避免泄漏风控细节。
- 验证：无 action 成功、有 action 成功、3DS challenge、redirect 回跳、details 重试、action 超时、重复 details、失败原因映射。

## 3DS 与 SCA 执行卡

- 3DS/SCA 不是前端弹窗问题，而是支付状态机问题；browserInfo、origin、returnUrl、shopperIP、账单/收货信息和 shopperReference 要从可信服务端上下文补齐。
- `IdentifyShopper`、`ChallengeShopper`、`RedirectShopper` 都要记录进入、回跳、details 提交和超时；中途关闭窗口不能直接改为支付失败，要等待 webhook 或查询确认。
- returnUrl 必须带业务可验证 nonce/state，回跳只用于恢复页面和触发查询，不直接授予权益。
- frictionless、challenge、redirect、issuer unavailable、exemption、out-of-scope、soft decline 要分别进入验证矩阵。
- 3DS 失败或拒绝时只展示可行动文案；不要把 issuer response、risk rule、liability shift 细节暴露给用户。
- 验证：3DS2 challenge、redirect、无挑战授权、soft decline 重试、移动端返回、跨域 iframe 禁用、浏览器刷新、webhook 先到和 details 后到。

## 金额、币种与商户账户

- `amount.value` 使用 minor units；GBP 10 是 1000，JPY 10 是 10，BHD 10 是 10000；特殊币种以 Adyen currency table 为准。
- 后端用 Decimal/整数分转换，禁止用浮点数直接计算金额；折扣、税费、运费、手续费、平台佣金要在服务端汇总后再转 minor units。
- merchantAccount 必须来自服务端配置和业务路由，不能从客户端请求透传；多商户场景要记录 company account、merchantAccount、store 和 region。
- 退款、捕获、取消的金额不能超过可操作余额；部分退款/部分捕获必须记录剩余可退/可捕获金额。
- 跨币种、FX、DCC、结算币种和交易币种分开入库；对账时不能只按订单展示币种比较。

## Webhook 处理

- 标准支付 webhook 至少覆盖 AUTHORISATION、CAPTURE、REFUND、CANCELLATION、OFFER_CLOSED、REFUND_FAILED、CAPTURE_FAILED、CHARGEBACK、CHARGEBACK_REVERSED、REPORT_AVAILABLE。
- HMAC 校验使用 Adyen 指定字段组合或官方库；标准 webhook 常见签名在 additionalData.hmacSignature，非标准 webhook 可能在 header。
- HMAC key 每个 endpoint 独立；test/live 独立；轮换期间要临时兼容新旧 key，避免队列中旧事件失败。
- webhook handler 先验签、落库、返回 Adyen 期望的成功响应，再异步处理业务；慢处理不要阻塞回执。
- webhook 原文落库要加访问控制和保留期；可落签名、事件摘要和脱敏字段，但不把 HMAC secret、完整卡数据或完整凭据写入日志。
- 去重键建议包含 eventCode、success、pspReference、originalReference、merchantReference、eventDate 或 Adyen event id；重复事件只补日志不重复改资金状态。
- 乱序处理：REFUND 可能早于本地 capture 状态更新，CAPTURE_FAILED 可能晚到；状态机必须允许待协调状态和后台补偿。
- 安全失败：验签失败、merchantAccount 不匹配、金额不匹配、未知 pspReference、环境不匹配时拒绝业务更新并告警。

## Capture、Refund、Cancel

- auto capture：AUTHORISATION 成功后仍要等 CAPTURE/CAPTURE_FAILED 或结算对账确认，不要把授权当财务完成。
- manual capture：发货/履约前确认授权窗口、部分捕获、重复捕获、超时过期和取消策略。
- cancel：只对未捕获授权有效；捕获后要走 refund 或 cancelOrRefund 的明确语义，不要混用。
- refund：独立退款单记录请求、处理中、成功、失败、部分退款、手续费、库存/权益回滚和客服操作人。
- reversal/cancelOrRefund 适合“不确定是否已捕获”的补偿场景；使用前要确认是否支持 split、平台场景和业务退款语义。
- 每个资金动作都要保存 request payload 摘要、idempotency key、pspReference/originalReference、modificationPspReference、金额、币种和结果 webhook。
- 验证：重复 capture、超额 capture、部分 capture 后 refund、重复 refund、超额 refund、cancel 后 webhook 延迟、refund failed 人工补偿。

## 争议与 Chargeback 执行卡

- 争议不是退款；chargeback 会影响资金、手续费、证据时限、客服话术和财务分录，必须独立建模。
- dispute webhook 要启用并保存 `pspReference` 争议引用与 `originalReference` 原支付引用；二者不能混当同一个支付对象。
- 状态至少覆盖 notification_of_chargeback、chargeback、information_supplied、chargeback_reversed、second_chargeback、prearbitration_won/lost、accepted、expired。
- 争议处理要记录 reason code、scheme、deadline、evidence package、责任归属、操作人、提交时间和结果。
- 退款、部分退款、部分争议和剩余可退余额要联动；已全额 chargeback 的交易不能再按普通退款处理。
- 验证：收到争议 webhook、证据提交截止、接受争议、成功抗辩、二次拒付、争议后退款拦截、报表扣款入账。

## Idempotency 与重试

- 所有 POST 写请求使用唯一 idempotency key，建议 UUID；同一次业务重试复用同一个 key，不要每次重试生成新 key。
- key 与业务动作绑定：pay、capture、refund、cancel、reversal、split、manual compensation 分开命名和存储；同一 key 不跨动作复用。
- Adyen idempotency key 有公司账户级作用域和保留窗口；多 region endpoint 不能假设跨 region 去重。
- 409/422、transient-error、503、网络超时要分开处理；只有明确可重试场景才用同 key 指数退避。
- 本地也要有唯一约束、锁和操作流水；不要把 Adyen 幂等当作唯一防线。

## Adyen for Platforms

- 先确认是新 Adyen for Platforms/Balance Platform 还是 classic platforms；不要混用 accountHolder/store/balanceAccount/merchantAccount 概念。
- 平台场景必须建模：平台 liable account、seller/accountHolder、balanceAccount、store、split instructions、commission、fees、chargeback 归属和 payout 周期。
- split 可以在支付请求中显式传，也可以通过 split configuration profile 自动应用；未配置 split 时资金和费用可能落到平台 liable balance account。
- seller onboarding、KYC、capabilities、payout eligibility 和账户冻结要进入业务状态，不要只记录支付成功。
- 平台 webhook 与支付 webhook 分开处理：account holder、balance account、transaction、transfer、payout、capability 事件要独立验签、去重和对账。
- 对账必须能按 merchantAccount、store、balanceAccount、seller、pspReference、transaction id、payout id 和报告日期回溯。

## Test、Live 与密钥边界

- test endpoint、live endpoint、live URL prefix、region-specific endpoint 要从 Customer Area 和配置中心读取；不要硬编码 demo prefix。
- live Checkout API 使用公司唯一 prefix 域名；Drop-in/Components 的 environment 与 live endpoint region 必须匹配。
- API key：服务端请求 Adyen API；client key：前端组件认证和 allowed origins；HMAC key：webhook 验签；管理 API key：只用于运维脚本。
- client key 有 test_/live_ 前缀但仍需按环境注入；live allowed origins 必须 HTTPS。
- 生产日志只允许记录 key hash、credential name、环境和权限角色，不允许打印完整 key、HMAC secret、sessionData、卡号或 CVC。
- go-live 前核对 API credential roles、Checkout webservice role、Merchant PAL webservice role、payment method activation、webhook HMAC、risk/3DS 配置和告警。

## PCI、日志与风控

- 优先使用 Drop-in/Components/Sessions 降低 PCI 范围；自建卡表单、裸传卡数据或服务端接收 PAN/CVC 会扩大 PCI 责任。
- 禁止在 access log、debug log、analytics、Sentry、工单、截图、数据库原文中保存完整 PAN、CVC、身份证件、银行账号、完整 token 或完整密钥。
- 允许日志字段：订单号、merchantReference、pspReference、eventCode、resultCode、金额、币种、环境、支付方式类型、错误码、request id、脱敏卡 BIN/last4。
- 风控和 3DS 参数要可审计：shopperIP、billing/shipping、device/browserInfo、shopperEmail、shopperReference、returnUrl、origin。
- 不向用户暴露完整 refusalReason、issuer response、risk rule 或内部风控策略。

## Reporting、Reconciliation 与运营

- 业务支付单、Adyen payment、capture/refund/cancel modification、balance transaction、payout、fee、FX、dispute 和会计分录分层对账。
- 每日导入 Adyen reports，至少区分 Payment accounting report、Settlement details report、Received payment details、Dispute transaction details 和平台类 reports。
- Payment accounting report 用于支付生命周期、费用、状态变更和失败 capture/refund 排查；Settlement details report 用于 payout 批次、交易级结算、fee、FX、chargeback 和银行流水匹配。
- 对账关联键必须包含 company account、merchantAccount、pspReference、merchantReference、modification reference、originalReference、gross/net currency、bookingDate、payoutDate、journal type。
- 差异队列要区分：webhook 缺失、状态延迟、金额不一致、币种不一致、手续费/FX、重复导入、退款未入账、争议扣款、payout 失败。
- 自动下载 reports 要校验文件名、时间区、账号范围、列版本、重复导入和负数金额；报表 schema 变更要先落审计告警。
- 后台查询至少支持 merchantReference、pspReference、originalReference、modificationPspReference、用户、merchantAccount、金额、币种、时间窗口和环境。
- 监控：授权成功率、拒付率、3DS 成功率、webhook 延迟、验签失败、重复事件、capture/refund 失败、Pending 超时、对账差异、payout 异常。

## Live Rollout 门禁

- go-live 前逐项核对 test/live 双环境：merchantAccount、company account、API credential roles、client key、allowed origins、HMAC endpoint、webhook URL、payment methods、capture delay、risk/3DS、reports schedule。
- live endpoint 必须使用 Customer Area 分配的 prefix 和 region；Checkout API、PAL、checkoutshopper 资源、Drop-in/Components environment 和 region URL 要一致。
- 生产发布先灰度 merchantAccount、国家/币种、支付方式和流量；保留 test 环境回归链路，不把 live 配置覆盖 test。
- 发布窗口要准备：回滚配置、关闭支付方式、切换 capture delay、暂停退款任务、重放 webhook、人工对账和客服公告。
- 首日监控：AUTHORISATION 成功率、refusalReason 分布、3DS challenge 成功率、webhook 延迟、HMAC 失败、Pending 超时、capture/refund 失败、报表生成和 payout 批次。
- 上线后必须抽样从订单追到 Adyen Customer Area、webhook、API log、report、payout 和内部会计分录。

## 验证门禁

- manifest/配置层：确认 canonical slug、环境变量、merchantAccount、API version、live prefix、client key allowed origins、webhook endpoint 和 HMAC。
- API 层：Sessions 或 Advanced 主链路跑通，覆盖 resultCode/action/details、重复请求、超时重试和 idempotency header。
- webhook 层：验签成功/失败、重复事件、乱序事件、慢处理、5xx 重试、死信重放、未知 eventCode、金额不匹配。
- 资金层：授权、capture、cancel、full refund、partial refund、refund failed、capture failed、争议/chargeback 和人工补偿。
- 安全层：敏感日志扫描无完整 key、HMAC secret、PAN、CVC、sessionData；前端 bundle 不含 API key。
- 对账层：至少一笔成功支付、一笔退款、一笔手续费/FX 或平台 split 能从订单追到 Adyen report/payout。

## 输出要求

- 先给影响面：前端、后端、DB、webhook、后台、对账、密钥、配置、监控、发布。
- 再给对象映射：订单号、merchantReference、pspReference、originalReference、modificationPspReference、merchantAccount、amount、currency、eventCode。
- 再给状态机：resultCode、action、webhook、capture/refund/cancel/dispute 如何推进业务状态。
- 再给验证证据：命令、沙箱订单、pspReference、webhook event、日志、对账记录、敏感扫描和未覆盖项。
- 最后给上线风险：未覆盖币种、支付方式、3DS、平台 split、争议、对账、live 配置、告警或回滚。

## 反例库

- 把 `/sessions` 返回成功当作支付成功：错误，session 只是支付会话。
- 前端收到 `Authorised` 就发货：危险，必须结合 capture 策略和 webhook/查询确认。
- Sessions flow 又手写 `/payments/details` 主状态机：会把两种集成流状态混乱。
- React 组件每次渲染都 mount Drop-in：会产生重复支付方式实例和重复提交。
- SSR 阶段初始化 AdyenCheckout：浏览器 API 不存在，且容易泄露会话材料。
- 用 iframe 承载跨域 checkout 后做 redirect/3DS：回跳和挑战流程容易失败。
- 忽略 `action` 或不调用 `/payments/details`：3DS/redirect 支付会卡死。
- 把 `ChallengeShopper` 当失败：会误杀需要持卡人认证的正常交易。
- 把 `Received`、`Pending`、`PresentToShopper` 当失败：会误杀异步支付方式。
- 金额用元/美元传给 `amount.value`：会产生 100 倍或小数币种错误。
- 所有币种按两位小数：JPY、BHD、ISK 等会错账。
- merchantAccount 从客户端传入：可导致错商户入账或越权收款。
- webhook 不验 HMAC 直接改订单：高危，必须阻断。
- webhook 只按 pspReference 去重：不同 eventCode 或 modification 可能被误吞。
- HMAC key test/live 复用：环境隔离失败，轮换和排障都会失真。
- capture/refund/cancel 不带幂等：超时重试会重复资金动作。
- 重试时重新生成 idempotency key：等于放弃幂等保护。
- 用 refund 处理未捕获授权：应 cancel 或 reversal，否则资金语义错误。
- 退款直接覆盖订单为 refunded：会丢失部分退款、争议和多次退款语义。
- 争议当退款处理：会漏掉证据时限、手续费、chargeback reversal 和财务分录。
- test client key 配 live API key：前端能渲染但交易/3DS/allowed origins 失败。
- live endpoint 不带公司 prefix 或 region 不匹配：生产请求失败或不稳定。
- 把 API key 放进前端 bundle：严重泄密。
- 日志保存 sessionData、完整 key、PAN 或 CVC：违反安全和 PCI 边界。
- 平台 split 未配置时默认以为资金会到 seller：可能全部落入 liable account。
- 对账只按订单金额，不核 fee、FX、refund、chargeback、payout：财务无法闭环。
- 只看 webhook 不导入 reports：会漏结算、费用、FX、争议扣款和 payout 差异。
- live rollout 没有灰度和回滚点：支付方式配置或 HMAC 错误会直接影响全量收款。

## 自检清单

- 是否确认 merchantAccount、amount minor units、currency、countryCode、reference/merchantReference 和收款主体？
- Sessions 与 Advanced flow 是否只选一种主链路并完整处理 resultCode/action/details？
- `pspReference`、`merchantReference`、`originalReference`、`modificationPspReference` 是否入库并可检索？
- webhook 是否 HMAC 验签、raw 落库、去重、乱序处理、死信和重放？
- POST 写动作是否有 idempotency key、唯一约束、锁和超时重试策略？
- capture、refund、cancel 是否独立建模，支持部分金额、失败态和人工补偿？
- test/live 的 API key、client key、HMAC key、endpoint、allowed origins、merchantAccount 是否完全分离？
- 前端 bundle、日志、错误上报和数据库是否通过敏感信息扫描？
- Adyen for Platforms 是否明确 seller、balanceAccount、store、split、commission、fees、payout 和 KYC/capability？
- 对账是否能从业务订单追到 Adyen report、balance transaction、payout 和会计分录？

## 相邻技能边界

- API 设计：负责接口契约、状态码、幂等头、错误模型；本技能负责 Adyen 语义和资金状态。
- 数据库设计：负责表结构、索引、事务和迁移；本技能负责支付对象、事件、退款、对账字段含义。
- 测试工程：负责自动化测试矩阵和 CI gate；Adyen 上线前必须覆盖支付、webhook、资金动作和对账回归。
- 代码审计：负责改动审计、安全审计和漏改检查；支付核心链路默认需要审计。
- 发布工程：负责灰度、回滚和生产验证；技能只定义 Adyen 上线门禁。
- 法务合规：负责隐私、税务、订阅条款、争议政策和地区限制；跨境支付和平台业务必须联动。