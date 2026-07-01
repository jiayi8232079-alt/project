---
name: stripe
description: Stripe 支付实战排障版 - 面向 PaymentIntent、SetupIntent、Checkout、Subscription、webhook、refund、dispute、reconciliation、idempotency、SCA/3DS、Connect、PCI、安全、测试和上线验证的海外支付接入。涉及 Stripe 收款、订阅、退款、回调、对账或生产排障时必须使用。
---

# Stripe 支付

首次自称：Stripe 支付（stripe，canonical slug: stripe）。

定位：把 Stripe 从“能收款”收敛为“金额单位不出错、支付状态可追踪、webhook 可验签幂等、订阅生命周期可恢复、退款争议可对账、Connect 资金路径可解释、上线可回滚”。先确认地区、币种、商户账户、支付方式、状态机、webhook、退款争议、对账和上线门禁，再进入实现。

## 平台核心对象

- 核心对象：PaymentIntent、SetupIntent、Checkout Session、Customer、PaymentMethod、Invoice、Subscription、Refund、Dispute、Charge、Balance Transaction、Payout、Connect Account。
- 一次性收款：优先 PaymentIntent；自建收银台配 Elements；托管收银台用 Checkout Session；不得用前端 success URL 代替支付事实。
- 保存支付方式：SetupIntent 用于先绑卡/钱包后扣款；Customer 与 PaymentMethod 必须服务端绑定、授权和审计。
- 订阅：Subscription、Price、Invoice、PaymentIntent、Customer 和 PaymentMethod 必须一起建模，权益以发票支付成功和订阅状态推进。
- Connect：明确 direct charge、destination charge、separate charges and transfers、application fee、transfer、payout 和平台/商户责任边界。
- 元数据：metadata 只放非敏感、稳定、可检索的业务索引，如业务订单号、用户内部 id、租户、环境、业务线和支付尝试号；不得放卡数据、证件、完整邮箱、电话、地址或密钥。
- webhook 重点：`payment_intent.succeeded/failed`、`payment_intent.requires_action`、`setup_intent.succeeded`、`checkout.session.completed/expired`、`invoice.paid/payment_failed`、`customer.subscription.*`、`charge.refunded`、`charge.dispute.*`。

## 适用范围

- 海外线上收款、订阅、退款、取消、捕获、争议、对账、风控、3DS、安全和上线排障。
- 新增或修改支付 API、前端收银台、webhook、订单状态机、支付数据库表、后台对账任务、Connect 分账或生产支付配置。
- 多币种、多地区、多商户、平台分账、订阅续费、支付失败恢复、支付事件审计和生产事故复盘。

## 不适用范围

- 只读学习支付平台、了解项目结构、仅识别依赖或 README 中提到 Stripe 但不改代码。
- 国内微信/支付宝支付专项；应使用对应国内支付技能。
- 纯 UI 收银台视觉设计，不涉及支付状态、金额、安全或 API 契约。
- 普通电商 checkout 页面，不接入真实 PSP、webhook、退款或对账。
- 未授权支付测试、卡测、盗刷、绕过风控、绕过 3DS、伪造支付回调或批量交易尝试。

## 铁律

1. 金额、币种、商品、税费、折扣、收款方和订单状态必须由服务端确认；客户端传参、redirect、success page 只能做展示。
2. amount 必须使用 Stripe 要求的 currency smallest unit；USD 10.00 写 1000，JPY 100 写 100；零小数币种、最小金额、折扣税费和四舍五入必须显式处理。
3. webhook 必须用原始 raw body 和 Stripe-Signature 验签；任何 JSON parser、bodyParser、middleware 改写 body 后再验签都视为高危。
4. webhook 至少一次投递，可能重复、延迟、乱序；必须按 event id 去重，按对象 id 和状态机幂等推进。
5. 每个写动作必须绑定业务订单号、Stripe 对象 id、Idempotency-Key、金额、币种、用户、环境、request id、审计日志和唯一约束。
6. 不存储卡号、CVC、磁道或未经授权的敏感支付数据；优先 Checkout/Elements/tokenization 降低 PCI 范围。
7. publishable key 只在前端；secret key、restricted key、webhook signing secret 只在服务端和密钥系统；日志、错误、截图和工单必须脱敏。
8. test mode 和 live mode 的 key、webhook endpoint、签名密钥、API version、产品/价格、Connect account 和回调域名必须分离。
9. 没有沙箱全链路、webhook 重放、重复请求、失败支付、退款/争议/对账和生产小额验证计划，不报告支付接入完成。
10. 生产 API version 必须显式锁定并记录变更窗口；升级 Stripe API version 前要跑支付、订阅、退款、争议、Connect、对账和 webhook 回归。

## 快速总则

- 先建状态机，再写接口：created、requires_payment_method、requires_confirmation、requires_action、processing、authorized、captured、paid、failed、cancelled、refunded、partially_refunded、disputed、chargeback、settled 都要有迁移规则。
- 先选集成形态：Checkout 降低 PCI 和前端复杂度；Elements 提升体验但增加 3DS、错误态、卡片更新和安全责任；移动端还要核对 SDK 与回调恢复。
- PaymentIntent 与订单不是一回事；一次订单可能有多次尝试、多次 PaymentIntent 或一次 PaymentIntent 多个状态事件。
- Customer/PaymentMethod 不是授权扣款凭证本身；保存和复用支付方式必须有用户授权、业务场景、SCA/mandate 和撤销路径。
- 所有 create/confirm/capture/cancel/refund/subscription update/transfer 默认幂等；不要把 Stripe SDK 重试当成业务幂等。
- 订单表、支付表、支付尝试表、事件表、退款表、争议表、对账表分清；不要把 Stripe 原始事件直接覆盖业务订单。
- 后台必须支持按业务订单号、Stripe id、event id、request id、Customer、Subscription、环境和时间窗口检索。
- 上线必须有灰度、监控、告警、人工补偿路径、密钥轮换方案、回滚点和客服 SOP。
- 任何支付结果必须能从三条线交叉解释：业务订单状态、Stripe 对象状态、资金流水/对账状态；三者不一致时进入差异队列，不做静默覆盖。

## 官方事实锚点

- PaymentIntent amount 是正整数，按币种最小单位提交；零小数币种不能再乘 100。
- client_secret 可被前端用于确认支付，但不能当作服务端鉴权凭证或支付成功凭证。
- Stripe webhook 签名校验依赖请求 raw body；框架中间件改写 body 会导致验签失败或绕过设计。
- API key 分 test/live 与 publishable/secret；webhook signing secret 是单独密钥，每个 endpoint 和环境都不同。
- Stripe 对幂等键按请求保存结果；业务仍要用订单号、对象 id、唯一约束和事件表防重复扣款/重复发货。

## 强制流程：需求到上线

1. 输入锁定：确认国家/地区、币种、零小数币种、商户主体、支付方式、收款账户、结算周期、税务、退款规则、争议责任和合规要求。
2. 集成形态：选择 PaymentIntent、SetupIntent、Checkout、Billing Subscription 或 Connect；说明为什么不用其他形态。
3. 对象映射：列业务订单、支付单、支付尝试、客户、支付方式、订阅、发票、退款单、争议、对账流水与 Stripe 对象的一一映射。
4. 金额设计：服务端计算 smallest unit amount、currency、tax、discount、shipping、fee、FX、rounding 和最小金额；禁止前端提交最终金额。
5. 状态机设计：列状态、事件、允许迁移、非法迁移、终态、重试、人工补偿、取消、超时关闭和回滚点。
6. 幂等与并发：定义每个写操作的 Idempotency-Key、唯一约束、锁/事务、重复点击、SDK/API 重试和旧请求覆盖策略。
7. webhook 设计：raw body 验签、event id 去重、原文落库、异步处理、乱序处理、失败重试、死信、重放和历史事件补偿。
8. 安全设计：key 边界、最小权限 restricted key、PCI 范围、日志脱敏、权限、审计、风险样本、客服可见字段。
9. 实现顺序：先支付创建、确认、webhook、订单更新和查询闭环；再扩展退款、订阅、争议、Connect、对账。
10. 验证交付：沙箱全链路、负向支付、3DS、webhook 重放、退款/争议/对账、生产配置检查、小额 live 验证和回滚演练。

## 支付工程门禁

- 入口门禁：所有创建、确认、捕获、取消、退款、订阅变更、transfer 和 webhook 重放必须走服务端授权；前端只能拿到必要的 publishable key、client_secret 或跳转 URL。
- 订单门禁：创建 Stripe 对象前必须已有业务订单/支付尝试记录；金额、币种、商品快照、税费、折扣、用户和租户不可由前端最终决定。
- 状态门禁：只有状态机允许的事件能推进订单；非法迁移只记录告警和待处理，不覆盖终态。
- 并发门禁：重复点击、浏览器刷新、移动端恢复、SDK 重试、API 重试、webhook 重放、后台人工补偿必须共用同一套幂等键和唯一约束。
- 发货/开通门禁：一次性收款以 PaymentIntent/Charge 资金终态为准；订阅权益以 invoice paid、subscription 状态和业务规则共同判断；Checkout redirect 只作用户体验。
- 退款门禁：退款不反向抹掉原支付单；全额、部分、多次、失败、撤销和手续费影响必须能单独追踪。
- 争议门禁：dispute/chargeback 不按退款处理；要记录证据期限、资金冻结、会计影响、用户权益处理和通知责任人。
- Connect 门禁：每笔资金必须可解释平台、connected account、application fee、transfer、refund、dispute、payout 和负余额责任。
- 对账门禁：至少按业务订单、PaymentIntent/Charge、Balance Transaction、Payout、fee、FX、refund、dispute、环境和时区做分层核对。
- 发布门禁：test mode 完成矩阵后，live mode 只做授权账户、最小金额、小流量验证；记录订单号、Stripe id、event id、request id、退款/记账处理和回滚点。

## 写动作幂等矩阵

- PaymentIntent create：幂等键绑定业务订单号、支付尝试号、amount、currency、customer、environment；同订单金额或币种变化必须新建尝试或显式终止旧尝试。
- PaymentIntent confirm：幂等键绑定 PaymentIntent id 和尝试号；requires_action、processing、succeeded、failed 都要落库，不能把 confirm 请求成功等同付款成功。
- capture/cancel：幂等键绑定授权对象、业务动作和操作人；部分捕获、超时捕获、重复捕获和取消后捕获必须有拒绝或补偿证据。
- SetupIntent：幂等键绑定用户、Customer、保存场景和 PaymentMethod；成功只代表设置完成，后续扣款仍需 PaymentIntent/Invoice 与 SCA 处理。
- Checkout Session：幂等键绑定订单号、mode、line_items/price 快照、customer 和 expires_at；过期后重建必须关联旧 session，避免重复发货或重复订阅。
- Subscription/Billing：创建、升级、降级、取消、恢复、试用变更和卡更新分别有幂等键；权益变动必须等待 invoice/subscription webhook 和业务状态机确认。
- Refund：幂等键绑定退款单号、charge/payment_intent、amount、reason 和操作人；重复退款、部分退款、多次退款和失败重试必须落到退款表。
- Connect transfer/application fee：幂等键绑定平台订单、connected account、charge/transfer、金额、币种和业务分账批次；退款、争议和 transfer reversal 必须可反查。
- Webhook：先用 event id 去重，再按对象 id、事件类型、created 时间和业务状态机处理乱序；未知事件只落库不推进资金状态。
- 人工补偿：后台重放、手工改状态、客服退款、财务调账都必须写入 request id、操作者、原因、前后状态和审批证据。

## 场景执行卡

### 1. PaymentIntent 一次性支付

- 证据：订单号、amount smallest unit、currency、Customer、PaymentMethod、capture_method、payment_method_types、metadata、成功/失败页、库存/权益发放时机。
- 动作：服务端创建或复用 PaymentIntent；前端只用 client_secret 确认；服务端查询或 webhook 推进终态。
- 验证：成功、失败、取消、requires_action、processing、重复点击、刷新、移动端恢复、3DS、webhook 延迟和订单超时关闭。

### 2. SetupIntent 与保存支付方式

- 证据：保存目的、用户授权、Customer 归属、PaymentMethod 复用范围、off-session/on-session、mandate、撤销和换卡流程。
- 动作：SetupIntent 成功只表示支付方式已设置，不表示已扣款；后续扣款仍用 PaymentIntent/Invoice 并处理 SCA。
- 验证：绑卡成功、绑卡失败、3DS、删除支付方式、默认支付方式切换、off-session 失败和用户重新认证。
- SCA：on-session 让用户完成 3DS；off-session 失败必须转成需要用户重新认证的业务状态，不得循环重试或绕过认证。

### 3. Checkout Session

- 证据：mode payment/setup/subscription、line_items、price、success_url、cancel_url、customer、metadata、expires_at、promotion/tax/shipping。
- 动作：Checkout 托管页面结果必须通过 webhook 或服务端查询确认；success_url 到达不能发货或开通权益。
- 验证：completed、expired、cancel、重复打开、过期后重建、价格篡改防护、订阅 checkout 和移动端返回。

### 4. 授权与捕获

- 证据：manual capture、捕获窗口、部分捕获、取消、库存/发货/酒店押金等业务规则。
- 动作：授权成功不等于收款完成；capture/cancel/expired/failed 必须独立状态和幂等键。
- 验证：授权成功捕获、部分捕获、超时未捕获、取消授权、重复捕获、金额不一致和 webhook 补偿。

### 5. Billing Subscription

- 证据：Product、Price、trial、billing cycle、proration、tax、coupon、dunning、取消策略、升级降级、发票和权益规则。
- 动作：权益发放以 invoice paid 和 subscription 状态共同判断；不要只看 checkout completed 或 subscription created。
- 验证：试用开始/结束、续费成功、支付失败、卡更新、取消到期、立即取消、恢复、升级降级、欠费补缴和 webhook 乱序。

### 6. 退款、取消和补偿

- 证据：可退金额、charge/payment_intent、全额/部分退款、多次退款、手续费、跨币种、退款窗口、库存/权益回滚和客服权限。
- 动作：退款单独建表；发起、pending、succeeded、failed、cancelled 都要可查；失败不能直接改订单为已退款。
- 验证：全额、部分、多次退款、重复请求、超额退款、退款失败、charge.refunded、webhook 延迟和人工补偿。

### 7. Dispute、chargeback 和风控

- 证据：dispute 生命周期、reason、evidence due by、提交人、金额冻结、订单权益处理、通知和会计影响。
- 动作：争议不等同退款；独立记录证据、期限、结果、资金影响、用户限制和客服沟通。
- 验证：dispute created、warning、evidence submitted、won/lost、funds withdrawn/reinstated、通知和报表对齐。

### 8. Connect 平台分账

- 证据：平台模式、connected account、charge type、application_fee_amount、transfer_data、on_behalf_of、capabilities、KYC、payout 和负余额责任。
- 动作：每笔资金流必须能解释谁收款、谁承担手续费/争议/退款、何时打款、失败如何补偿。
- 验证：测试 connected account、destination charge、退款退费、争议扣款、transfer reversal、payout 失败、账户能力缺失和 live mode 配置。

### 9. Webhook 与事件处理

- 证据：endpoint、签名密钥、raw body 获取方式、事件类型、event id、对象 id、重试策略、幂等表、死信队列和重放入口。
- 动作：先验签和快速持久化，再异步推进业务状态；未知事件记录但不误改状态；返回 2xx 前只做必要轻量工作。
- 验证：签名错误、body 被 parser 改写、重复事件、乱序事件、缺字段、慢处理、5xx 重试、死信重放和历史事件补偿。

### 10. 对账与结算

- 证据：Balance Transaction、Payout、report、fee、FX、refund、dispute、tax、Connect account、时区、日切和时间区间。
- 动作：业务支付单、Stripe charge/payment、余额流水、打款流水分层对账；差异进入待处理队列。
- 验证：日切、手续费、部分退款、争议、打款失败、跨币种、重复导入、漏单、Connect 多账户和财务报表总额。

### 11. Test/live mode 与上线运维

- 证据：test/live key、webhook endpoint、API version、产品/价格、域名、3DS、风控、告警、日志、回滚和客服 SOP。
- 动作：先 test mode 全链路，再 live mode 小额真实支付；生产验证只用授权账户和最小金额，验证后按规则退款或记账。
- 验证：生产小额支付、退款、webhook、后台查询、告警触发、密钥轮换、API version 锁定、回滚路径和异常客服流程。

### 12. 元数据、观测和发布记录

- 证据：metadata 字段清单、敏感信息排除项、request id、Stripe-Request-Id、event id、trace id、环境、API version 和操作者。
- 动作：所有 Stripe 对象都写入可反查的业务索引；日志和指标只记录脱敏 id、状态、金额、币种、错误类别和延迟，不落 raw PII。
- 验证：能从订单号查到 Stripe 对象、webhook、退款、争议、Balance Transaction、Payout、后台操作和发布批次。

## 数据与状态门禁

- 支付表至少记录：business_order_id、stripe_payment_intent_id、stripe_charge_id、amount、currency、status、environment、customer_id、payment_method_id、idempotency_key、request_id。
- 事件表至少记录：stripe_event_id、event_type、object_id、api_version、environment、signature_verified、received_at、processed_at、process_status、raw payload 存储位置。
- 退款表至少记录：refund_id、payment_id、amount、currency、reason、status、operator、idempotency_key、failure_reason。
- 订阅表至少记录：subscription_id、customer_id、price_id、status、current_period、cancel_at_period_end、latest_invoice、entitlement_status。
- 争议表至少记录：dispute_id、charge_id、amount、currency、reason、status、evidence_due_by、funds_status、resolution。
- 对账表必须能关联业务订单、Stripe 对象、Balance Transaction、Payout、fee、FX、refund 和 dispute。

## 验证门禁

- 金额最小单位、零小数币种、最小金额、税费折扣、跨币种和四舍五入已测试。
- PaymentIntent/Checkout/SetupIntent/Subscription 至少覆盖当前实际使用路径；未使用路径说明原因。
- 沙箱支付成功、失败、取消、3DS、requires_action、重复点击、刷新、移动端和弱网已覆盖。
- webhook raw body 验签、event id 去重、乱序、重试、死信、重放和历史补偿已覆盖。
- Idempotency-Key、唯一约束、并发请求、SDK/API 重试、重复退款和重复发货已覆盖。
- Customer/PaymentMethod 绑定、解绑、默认支付方式、off-session 失败和用户重新认证已覆盖。
- refund、dispute/chargeback、Connect、对账和人工补偿至少有最小闭环。
- test/live mode、key 边界、webhook endpoint、API version、告警、日志脱敏和回滚已检查。
- 生产小额验证必须有金额、订单、event id、Stripe id、退款/记账处理和负责人记录。
- live mode 验证后必须读回 Dashboard/API/webhook/业务后台/对账任务五处证据；任一缺失都不能宣称真实发布闭环完成。

## 输出要求

- 先给支付影响面：前端、后端、DB、webhook、后台、对账、权限、监控、Connect 和发布。
- 再给状态机和对象映射，不用“支付成功”一句话代替。
- 再给改动点和验证证据：命令、沙箱订单、event id、Stripe id、request id、日志、截图或后台记录。
- 最后给剩余风险：未覆盖支付方式、地区、币种、订阅、争议、Connect、对账或生产配置。

## 安全边界

- 不帮助卡测、盗刷、绕过风控、绕过 3DS、绕过支付、伪造回调、隐藏交易或规避 Stripe 风控。
- 不输出真实 secret key、webhook signing secret、写权限密钥、商户 token、客户支付数据、完整卡号或 CVC。
- 不把支付成功建立在前端参数、redirect query、未验签 webhook、client_secret 或未确认的客户端状态上。
- 不在日志、错误、analytics、客服系统、截图或 issue 中写入 card、CVC、secret、authorization header、raw PII 或完整 webhook payload。
- 不为未授权商户、第三方账户或真实用户发起交易测试；live mode 只能做明确批准的小额验证。

## 反例库

- 前端传 amount=10 就按 10 美元扣款：错误，Stripe amount 是最小货币单位，USD 10.00 应为 1000。
- JPY 订单也乘以 100：错误，零小数币种会把金额放大 100 倍。
- success_url 到达就发货：错误，必须由服务端查询或 webhook 终态推进。
- webhook 先 JSON parse 再验签：高危，必须用 raw body 校验 Stripe-Signature。
- webhook 不验签直接改订单：高危，必须阻断。
- 用 invoice.paid 给一次性 PaymentIntent 发货，或只看 checkout.session.completed 开通订阅：对象语义错误。
- 没有 Idempotency-Key 就创建 PaymentIntent、Checkout Session、退款或 transfer：可能重复扣款、重复退款或重复分账。
- 只按 PaymentIntent id 幂等发货，不记录 event id：重复 webhook 可能重复发货。
- 把 test key、live key、CLI webhook secret 和 Dashboard endpoint secret 混用：验签和真实交易都会出事故。
- 前端暴露 secret key，服务端把 publishable key 当鉴权：key 边界错误。
- 把 Customer 当用户、把 PaymentMethod 当可永久扣款许可：授权、SCA 和撤销路径缺失。
- off-session 失败后后台无限重试扣款：错误，必须进入用户重新认证或支付方式更新流程。
- metadata 塞完整邮箱、手机号、地址、证件或密钥：错误，metadata 不是敏感数据存储。
- 把退款状态直接覆盖订单支付状态：会丢失部分退款、争议和原支付语义。
- 部分退款后把订单改成未支付：错误，支付状态、退款状态和履约状态要分开。
- 争议来了当退款处理：会漏证据窗口、资金冻结和 chargeback 会计影响。
- Connect 只记录平台订单不记录 connected account、application fee 和 transfer：资金路径不可解释。
- Connect 退款只退客户、不处理 application fee 或 transfer reversal：平台和商户账会不平。
- 对账只按订单金额，不对手续费、FX、退款、争议、Balance Transaction 和 payout：财务不可闭环。
- test mode 全绿就直接全量打开 live：错误，必须有小额真实验证、灰度、告警和回滚。
- 只测成功卡，不测失败、3DS、取消、重复、退款、争议和 webhook 重试：不能上线。

## 自检清单

- 是否确认国家、币种、零小数币种、商户、支付方式、收款账户和合规边界？
- 是否明确选择 PaymentIntent、SetupIntent、Checkout、Subscription 或 Connect，并说明取舍？
- 是否有业务订单与 Stripe 对象映射、状态机、幂等键、唯一约束和 webhook 去重？
- 是否用 raw body 验签，隔离 test/live 密钥，并完成日志脱敏？
- 是否覆盖 Customer/PaymentMethod、3DS/SCA、refund、dispute、Connect、对账、监控、告警和人工补偿？
- 是否跑过沙箱全链路、webhook 重放和上线前生产小额验证计划？

## 相邻技能边界

- API 工程 / api-engineering（api）：接口契约、状态码、幂等和 webhook API 设计；支付技能负责 Stripe 对象语义和资金状态机。
- 数据库工程 / database-engineering（db）：支付/退款/事件/对账表设计和事务；支付技能负责字段语义和资金状态。
- Web 安全 / web-security（wsec）：鉴权、XSS、CSRF、密钥和权限专项；支付安全命中时联动。
- 测试验证 / test-engineering（tst）：测试矩阵和 CI gate；支付上线前必须联动测试验证。
- 代码审计 / code-audit（aud）：代码审计和安全审计；支付核心链路默认联动。
- 可观测性 / observability（obs）：日志、指标、trace、告警；支付生产监控联动。
- 法务合规 / legal-counsel（law）：合规、隐私、税务、地区限制、争议规则；跨境支付和订阅条款联动。
- 发布部署 / release-engineering（rls）：发布、灰度、回滚和生产验证；支付上线联动。