---
name: square
description: Square 支付实战排障版 - 面向 Web Payments SDK、Payments API、Orders API、Catalog、Customers、Locations、Terminal/Reader、idempotency key、refunds、cancel/complete、subscriptions/invoices、webhook signature、disputes、reconciliation、OAuth、多 location、amount minor units、sandbox/live、安全、测试和上线验证的海外支付接入。涉及 Square 收款、订单、退款、回调、对账或生产排障时必须使用。
---

# Square 支付

首次自称：Square 支付（square，兼容 slug: square）。

定位：把 Square 从“source_id 能扣款”收敛为“订单、商品、客户、location、支付、reader、幂等键、webhook 和对账一致，退款争议可追踪，多商户/OAuth 可上线”。先确认地区、币种、商户账户、支付方式、状态机、webhook、退款争议、对账和上线门禁，再进入实现。

## 平台核心对象

- 核心对象：Payment、Order、CatalogObject、Customer、Card、PaymentRefund、Invoice、Subscription、Location、Device、TerminalCheckout、TerminalRefund、Dispute、Webhook Event、OAuth token。
- 典型流程：Web Payments SDK、Payments API、Orders API、Catalog API、Customers API、Locations API、Cards on File、Refunds、Invoices/Subscriptions、Terminal API、Mobile Payments SDK/Reader、OAuth 多商户、webhooks、disputes/reconciliation。
- webhook 重点：payment.created/updated、refund.updated、order.updated、invoice、subscription、dispute、customer/card/location 相关事件；webhook 只推进幂等状态机。
- webhook signature：必须使用原始 body、通知 URL、签名密钥和 `x-square-hmacsha256-signature` 做常量时间校验；解析 JSON 后再验签是错误顺序。
- 幂等要求：创建 payment、order、refund、terminal checkout/refund、cancel/complete 必须带 idempotency key；可按 idempotency key 查询/取消异常支付路径。
- 金额要求：amount_money 使用货币最小单位，USD 是 cents；币种必须匹配收款 location/merchant，不能由前端传浮点金额。
- 安全边界：Web Payments SDK 生成 token/source_id，不接触卡号；access token 只在服务端；OAuth token 加密存储；webhook signature key 不落日志；多 location 权限最小化。
- 测试重点：Sandbox app/location、测试卡、Web Payments SDK、Orders+Payments 串联、Catalog item、Customer/Card on File、Terminal/Reader、refund、webhook、dispute、OAuth refresh、API version、生产 location 和 webhook subscription。


## 适用范围

- 海外线上收款、订阅、退款、取消、捕获、争议、对账、风控、3DS、安全和上线排障。
- 新增或修改支付 API、前端收银台、webhook、订单状态机、支付数据库表、后台对账任务或生产支付配置。
- 多币种、多地区、多商户、平台分账、订阅续费、支付失败恢复和支付事件审计。

## 不适用范围

- 只读学习支付平台、了解项目结构、仅识别依赖或 README 中提到支付平台但不改代码。
- 国内微信/支付宝支付专项；应使用对应国内支付技能。
- 纯 UI 收银台视觉设计，不涉及支付状态、金额、安全或 API 契约。
- 普通电商 checkout 页面，不接入真实 PSP、webhook、退款或对账。
- 未授权的支付绕过、盗刷、风控规避、卡测、撞库或批量交易尝试。

## 铁律

1. 金额、币种、商品、税费、折扣、收款方和订单状态必须由服务端确认；前端返回、redirect、success page 不能作为支付成功事实。
2. webhook 是支付终态事实源之一，但必须验签、幂等、去重、按状态机推进，并能处理乱序、重复和延迟。
3. 每个支付动作必须绑定业务订单号、PSP 对象 id、幂等键、金额、币种、用户、环境、request id 和审计日志。
4. 不存储卡号、CVC、磁道或未经授权的敏感支付数据；优先使用托管页、组件或 tokenization 降低 PCI 范围。
5. 退款、取消、捕获、订阅变更、争议处理和人工补偿必须可审计、可重试、可对账。
6. 测试环境和生产环境配置、密钥、webhook endpoint、API version、商户账户和回调域名必须分离。
7. 没有沙箱全链路、webhook 重放、重复请求、失败支付、退款和对账验证，不报告支付接入完成。

## 快速总则

### Square 单技能工程门禁

- Square 支付必须先锁定 application、environment、location_id、currency、Orders API 是否参与、Web Payments SDK source_id 来源和 Payments API 状态机。
- amount_money 必须由服务端订单、税费、折扣、运费和币种规则计算，并转换为 minor units 整数；前端 source_id、success callback、redirect 都不能作为金额或成功事实。
- Web Payments SDK 只负责生成一次性 source_id；access token、OAuth refresh token、webhook signature key、refund/void 权限只能在服务端。
- 每次 create payment、refund、cancel、complete、order create/update 必须有 idempotency_key；幂等键要绑定业务动作和订单版本，不能全局复用。
- Orders API 与 Payments API 同用时，业务 order_id、Square order_id、payment_id、refund_id、location_id 必须落库并可检索；不能只存一个 payment_id。
- Catalog 参与定价时，CatalogObject、variation、tax、discount、modifier 与业务 SKU 要有映射；Catalog 不是唯一价格事实，服务端仍要校验订单版本。
- Customers API 只能保存业务必需的 customer_id/card_id 映射；不要把客户资料、卡信息或营销授权混成一个字段。
- Locations API 是收款、库存、履约、税费和对账边界；多 location 不能默认用 main location 偷懒。
- Terminal API/Reader 支付要区分设备配对、checkout 创建、设备端取消、buyer 取消、超时、delayed capture、terminal refund 和 POS 离线/弱网状态。
- webhook 必须验签、按 event_id 去重、保存原文、异步推进状态；payment/order/refund/dispute 事件乱序时按业务状态机兜底。
- 上线前必须完成 sandbox 全链路、生产 location 配置、生产小额支付、退款、webhook、后台检索、告警和对账样本。

### Square 低级错禁止

- 禁止把 Web Payments SDK 返回 token/source_id 当作已扣款。
- 禁止由前端传 amount_money、currency、location_id 或订单总价后直接创建 payment。
- 禁止缺 idempotency_key 发起 payment/refund，或把同一个 idempotency_key 用在不同金额/订单。
- 禁止把 decimal/float 金额直接传给 Square；必须转成 minor units 整数并做币种精度校验。
- 禁止 webhook 不验签、不去重、不存 raw body 就改订单；签名校验必须使用 Square 投递的原始 body。
- 禁止 sandbox application/location/access token/webhook 混到 production。
- 禁止把 OAuth access token 明文入库或打日志；refresh token 必须加密、轮换、可撤销。
- 禁止忽略 Square API version、location 时区、settlement/payout、fee、dispute、partial refund 对账差异。
- 禁止只测 Web Payments SDK 成功路径，不测失败、取消、重复点击、3DS/SCA、退款、争议和 webhook 延迟。
- 禁止只接 Payments API 不接 Orders/Catalog/Customers/Locations 影响评估；订单、商品、客户和 location 会影响履约、税费、报表和对账。

- 先建支付状态机，再写接口：created、requires_action、authorized、captured、paid、failed、cancelled、refunded、partially_refunded、disputed、chargeback、settled 等状态要有明确迁移。
- 先选集成形态：托管页降低 PCI 和前端复杂度，自建组件提升体验但增加安全、3DS、错误态和合规责任。
- 所有创建/捕获/退款/订阅变更默认幂等；所有 webhook 默认至少一次投递，不能写成“只会来一次”。
- 订单表、支付表、事件表、退款表、争议表、对账表分清；不要把 PSP 原始事件直接覆盖业务订单。
- 前端必须覆盖 loading、requires action、取消、失败、超时、重复点击、返回页刷新、移动端和弱网。
- 后台必须支持按业务订单号、PSP id、event id、request id、用户和时间窗口检索。
- 上线必须有灰度、监控、告警、人工补偿路径和密钥轮换方案。

## 强制流程：需求 → 状态机 → 集成形态 → 实现 → 验证

1. 输入锁定：确认国家/地区、币种、商户主体、支付方式、收款账户、结算周期、税务、退款规则、争议责任和合规要求。
2. 平台对象映射：列业务订单、支付单、退款单、订阅、客户、争议、对账流水与 PSP 对象的一一映射。
3. 状态机设计：列状态、事件、允许迁移、非法迁移、终态、重试、人工补偿和回滚点。
4. 幂等与并发：定义每个写操作的幂等键、唯一约束、锁/事务、重复点击、重试和旧请求覆盖策略。
5. webhook 设计：验签、event id 去重、原文落库、异步处理、乱序处理、失败重试、死信和重放工具。
6. 安全设计：密钥存储、前后端 key 边界、PCI 范围、日志脱敏、权限、审计和风控样本。
7. 实现：优先最小闭环；先支付创建、确认、webhook、订单更新，再扩展退款、订阅、争议、对账。
8. 验证：沙箱全链路、负向支付、3DS、webhook 重放、退款、争议、对账、生产配置检查和回滚演练。
9. 交付：输出环境、对象映射、状态机、验证证据、未覆盖风险和上线门禁。

## Square API 覆盖门禁

- Payments：确认 source_id 来源、amount_money minor units、currency、location_id、autocomplete、delay_duration、order_id、customer_id、app_fee_money、processing_fee、refund/cancel/complete 路径。
- Orders：确认业务订单号、Square order_id、line_items、taxes、discounts、service_charges、fulfillments、tenders、returns、state 与 payment 的绑定关系。
- Catalog：确认 catalog_object_id、item variation、modifier、tax、discount、version、location availability、库存联动和业务 SKU 映射；Catalog 版本变更要能重算订单。
- Customers：确认 customer_id、card_id、幂等创建、合并/重复客户、营销同意、隐私删除、Cards on File 授权和订阅/发票绑定。
- Locations：确认收款 location、currency、timezone、capabilities、status、main location 兜底、多 location 权限、报表和 payout 归属。
- Terminal/Reader：确认 device_id、checkout_id、reader pairing、设备端 buyer 行为、离线/超时、delayed capture、terminal refund、门店 location 和员工权限。
- Subscriptions/Invoices：确认 catalog plan/variation、customer、card、invoice、trial、billing cycle、tax、proration、失败重试、取消和权益状态。
- Webhooks：确认订阅事件、notification URL、signature key、raw body、event_id、merchant/location、API version、重试、死信和重放。
- Disputes/Reconciliation：确认 dispute evidence、deadline、状态、资金冻结/扣回、processing fee、payout、refund、settlement、报表导入和差异处理。

## 金额、环境和幂等

- 金额：所有入 Square 的 Money.amount 都是 minor units 整数；USD 12.34 写 1234，JPY 这种无小数币种不能乘 100，币种精度要按业务支持表校验。
- 服务端权威：订单总额由服务端按商品、税、折扣、运费、tip、fee、location 和币种计算；前端只提交 source_id、选择项和必要客户上下文。
- 幂等键：按业务动作生成，例如 order:create、payment:create、payment:complete、refund:create、terminal:checkout；键值绑定订单版本、金额、币种和 actor。
- 幂等冲突：同一 key 返回旧结果时必须校验金额、币种、order_id、location_id 和业务动作一致；不一致时阻断并告警。
- Sandbox/live：application id、access token、location、webhook subscription、signature key、SDK app id、OAuth redirect、API version、测试卡和回调域名必须成对隔离。
- 生产验收：生产小额支付必须同时验证 payment 查询、webhook 到达、订单发货/权益、退款、后台检索、日志脱敏、对账报表和告警。

## 场景执行卡

### 1. 一次性支付

- 证据：金额来源、币种、订单号、支付方式、用户、收款账户、成功/失败页、库存/权益发放时机。
- 动作：前端 Web Payments SDK 只生成 source_id；服务端用订单金额 minor units 创建 payment；支付成功必须由服务端查询或 webhook 推进。
- 验证：成功、失败、取消、重复点击、刷新、移动端、3DS、webhook 延迟和订单超时关闭。

### 1.5 Orders/Catalog/Customers/Locations 联动

- 证据：业务 SKU、Catalog item/variation、税费、折扣、modifier、customer_id、location_id、履约方式、库存和订单版本。
- 动作：先把业务订单映射为 Square Order，再把 payment 绑定 order_id；客户与卡保存要有授权、撤销和删除路径。
- 验证：Catalog 改价、商品下架、location 不可售、客户重复、卡失效、订单部分退款、履约取消和库存回滚。

### 2. 授权与捕获

- 证据：是否预授权、捕获窗口、部分捕获、取消、库存/发货/酒店押金等业务规则。
- 动作：授权成功不等于收款完成；捕获、取消、过期和失败必须独立状态。
- 验证：授权成功捕获、部分捕获、超时未捕获、取消授权、重复捕获和金额不一致。

### 3. 订阅与续费

- 证据：plan、price、trial、billing cycle、proration、失败重试、取消、升级降级、发票和税费。
- 动作：订阅状态以 invoice/payment/subscription webhook 推进；Catalog subscription plan 与 customer/card 绑定；权益发放与账单成功绑定。
- 验证：试用结束、续费成功、支付失败、卡更新、取消、恢复、升级降级、欠费和补缴。

### 4. 退款、取消和补偿

- 证据：可退金额、部分退款、手续费、跨币种、退款窗口、库存/权益回滚和客服权限。
- 动作：退款单独建表；发起、处理中、成功、失败都要可查；失败不能直接改订单为已退款；Terminal Interac 等线下退款要走对应 Terminal refund 路径。
- 验证：全额、部分、多次退款、重复请求、超额退款、退款失败、Terminal refund、webhook 延迟和人工补偿。

### 5. Webhook 与事件处理

- 证据：事件类型、签名方式、重试策略、事件 id、幂等表、死信队列和重放入口。
- 动作：先用 raw body、通知 URL、signature key 和签名头做常量时间验签，再落原文并异步推进业务状态；未知事件可记录但不误改状态。
- 验证：签名错误、重复事件、乱序事件、缺字段、慢处理、5xx 重试、死信重放和历史事件补偿。

### 6. 争议、拒付和风控

- 证据：dispute/chargeback 生命周期、证据提交窗口、通知人、金额冻结、订单权益处理和会计影响。
- 动作：争议不等同退款；独立状态记录证据、期限、结果、资金影响和用户限制。
- 验证：争议创建、证据提交、赢/输、反转、资金扣回、通知和报表对齐。

### 7. 对账与结算

- 证据：PSP balance/transaction/report、payout、fee、FX、refund、dispute、税费、商户账户和时间区间。
- 动作：业务支付单、PSP 交易、余额流水、打款流水分层对账；差异进入待处理队列。
- 验证：日切、时区、手续费、部分退款、争议、打款失败、跨币种和重复导入。

### 8. 上线与运维

- 证据：生产账号、域名、webhook、密钥、API version、风控/3DS、告警、日志、回滚和客服 SOP。
- 动作：先小流量灰度；监控支付成功率、失败原因、webhook 延迟、重复事件、退款失败和对账差异。
- 验证：生产小额支付、退款、webhook、后台查询、告警触发、密钥轮换和回滚路径。

### 9. Terminal/Reader 门店支付

- 证据：location、device_id、reader 类型、员工权限、POS 场景、网络条件、收据、delayed capture、退款渠道和门店对账。
- 动作：服务端创建 terminal checkout/refund，门店设备完成 buyer 交互；客户端只展示状态，不直接判定扣款完成。
- 验证：设备离线、buyer 取消、员工取消、超时、重复发起、reader 更换、门店 location 不一致、delayed capture、退款和 payout 对齐。

## 验证门禁

- 沙箱支付成功、失败、取消、3DS、重复点击、刷新和移动端已覆盖。
- Payments/Orders/Catalog/Customers/Locations 对象映射已落库或明确排除，排除原因可审计。
- amount_money minor units、币种精度、税费折扣、tip/service charge 和 location currency 已校验。
- Sandbox/live 的 application、token、location、webhook、signature key、API version 和回调域名已隔离。
- webhook 验签、去重、乱序、重试、死信和重放已覆盖。
- 幂等键、唯一约束、并发请求和重复退款已覆盖。
- 退款、Terminal refund、争议、对账和人工补偿至少有最小闭环。
- 生产配置、密钥、webhook endpoint、API version、告警和回滚已检查。

## 输出要求

- 先给支付影响面：前端、后端、DB、webhook、后台、对账、权限、监控和发布。
- 再给状态机和对象映射，不用“支付成功”一句话代替。
- 再给改动点和验证证据：命令、沙箱订单、event id、PSP id、日志、截图或后台记录。
- 最后给剩余风险：未覆盖支付方式、地区、币种、订阅、争议、对账或生产配置。

## 安全边界

- 不帮助卡测、盗刷、绕过风控、绕过 3DS、绕过支付、伪造回调或隐藏交易。
- 不输出真实 secret key、webhook secret、商户 token、客户支付数据或完整卡号。
- 不把支付成功建立在前端参数、redirect query、未验签 webhook 或未确认的客户端状态上。
- 不为未授权商户、第三方账户或真实用户发起交易测试。

## 反例库

- 前端 success URL 到达就发货：错误，必须由服务端支付查询或 webhook 终态推进。
- webhook 不验签直接改订单：高危，必须阻断。
- 没有幂等键就创建支付或退款：会导致重复扣款/重复退款。
- 只测成功卡，不测失败、3DS、取消、重复、退款和争议：不能上线。
- 把退款状态直接覆盖订单支付状态：会丢失部分退款和争议语义。
- 测试环境 webhook 复制到生产但密钥/API version/endpoint 不一致：上线风险。
- 对账只按订单金额，不对手续费、FX、退款、争议和 payout：财务不可闭环。
- Web Payments SDK token 返回就标记已支付：错误，source_id 只是支付来源，必须服务端 create payment 并等待终态。
- 前端传 location_id 和 amount_money：错误，location 与金额必须由服务端订单和商户配置决定。
- Orders API 建单后不绑定 payment：会造成 Square 订单、业务订单和支付单对不上。
- idempotency_key 按用户复用：用户第二笔不同订单会被 Square 当成重复请求。
- OAuth 多商户只存 access token：token 过期、撤销或 location 权限变化后无法恢复和审计。
- webhook 只处理 payment.updated：漏掉 refund、order、dispute、invoice/subscription 事件，退款和争议无法闭环。
- 只看 payment APPROVED：授权、捕获、取消、退款、部分退款和 dispute 没有独立业务状态。
- 生产只验证扣款不验证退款和 webhook：支付成功看似可用，售后和对账会断。

## 真实验收反例库

- 验收说“已接 Square”，但只跑 cnon:card-nonce-ok：不通过；必须补失败卡、重复 token、重复点击、refund、webhook、后台检索和对账。
- 验收只看前端弹窗 success：不通过；必须有 payment_id、order_id、状态查询或 webhook event_id 证据。
- 验收金额用 12.34 直接传 API：不通过；必须证明传入 amount_money.amount 是 1234 这类 minor units 整数。
- 验收只用 sandbox token 测生产域名：不通过；必须区分 sandbox/live app、location、token、webhook 和 signature key。
- 验收 webhook 用解析后的 JSON 重新序列化再验签：不通过；必须使用 Square 投递的 raw body。
- 验收只保存 payment_id：不通过；必须能按业务订单号、Square order_id、payment_id、refund_id、event_id、location_id 检索。
- 验收多 location 默认 main：不通过；必须证明当前订单使用的 location 可收款、币种匹配、可履约、可对账。
- 验收退款只改业务订单状态：不通过；必须有 Refund/PaymentRefund 对象、退款 webhook、库存/权益回滚和对账记录。
- 验收争议用退款流程处理：不通过；dispute 要有独立状态、证据提交窗口、资金影响和通知 owner。
- 验收订阅只建 plan：不通过；必须覆盖 customer/card、invoice/payment webhook、失败重试、取消、升级降级和权益变更。
- 验收 Terminal 只创 checkout：不通过；必须覆盖设备端取消、超时、reader/location 错配、Terminal refund 和门店 payout。
- 验收 Catalog 只存商品名：不通过；必须处理 variation、tax、discount、modifier、版本和 location availability。
- 验收 Customers 只按 email 查重：不通过；必须处理重复客户、合并、删除、营销授权和 Cards on File 授权。
- 验收对账只比订单总额：不通过；必须覆盖 fee、tip、refund、partial refund、dispute、payout、时区和重复导入。
- 验收没有生产小额支付和退款计划：不通过；上线前必须给出生产最小闭环、监控、告警和回滚证据。

## 自检清单

- 是否确认国家、币种、商户、支付方式、收款账户和合规边界？
- 是否有业务订单与 PSP 对象映射？
- 是否有状态机、幂等键、唯一约束和 webhook 去重？
- 是否验签、脱敏、隔离测试/生产密钥？
- 是否覆盖退款、争议、对账、监控、告警和人工补偿？
- 是否跑过沙箱全链路和上线前生产小额验证计划？
- 是否覆盖 Square 专有对象：application、location_id、source_id、order_id、payment_id、refund_id、dispute_id、idempotency_key、webhook signature？
- 是否覆盖 Payments、Orders、Catalog、Customers、Locations、Terminal/Reader、Subscriptions、Refunds、Disputes、Reconciliation？
- 是否验证 Web Payments SDK、Payments API、Orders API、Refunds、OAuth、多 location、API version、sandbox/live 和生产 webhook endpoint 没有环境串用？

## 相邻技能边界

- API 工程 / api-engineering（api）：接口契约、状态码、幂等和 webhook API 设计；支付技能负责 PSP 语义和支付状态机。
- 数据库工程 / database-engineering（db）：支付/退款/事件/对账表设计和事务；支付技能负责字段语义和资金状态。
- Web 安全 / web-security（wsec）：鉴权、XSS、CSRF、密钥和权限专项；支付安全命中时联动。
- 测试验证 / test-engineering（tst）：测试矩阵和 CI gate；支付上线前必须联动测试验证。
- 代码审计 / code-audit（aud）：代码审计和安全审计；支付核心链路默认联动。
- 可观测性 / observability（obs）：日志、指标、trace、告警；支付生产监控联动。
- 法务合规 / legal-counsel（law）：合规、隐私、税务、地区限制、争议规则；跨境支付和订阅条款联动。
- 发布部署 / release-engineering（rls）：发布、灰度、回滚和生产验证；支付上线联动。