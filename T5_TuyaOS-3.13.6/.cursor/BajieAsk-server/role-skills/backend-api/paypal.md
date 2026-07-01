---
name: paypal
description: PayPal / Braintree 支付实战排障版 - 面向 PayPal Checkout、Orders API、authorizations/captures、Subscriptions、webhooks、Braintree Drop-in/Hosted Fields、vault、refunds、disputes、request-id 幂等、安全、测试和上线验证的海外支付接入。涉及 PayPal 或 Braintree 收款、订阅、退款、回调、争议或生产排障时必须使用。
---

# PayPal / Braintree 支付

首次自称：PayPal / Braintree 支付（paypal，兼容 slug: paypal）。

定位：把 PayPal/Braintree 从“跳转能付”收敛为“订单授权捕获清晰、webhook 与返回页不冲突、vault/订阅可恢复、退款争议可对账”。先确认地区、币种、商户账户、支付方式、状态机、webhook、退款争议、对账和上线门禁，再进入实现。

## 平台核心对象

- 核心对象：Order、Authorization、Capture、Subscription、Plan、Product、Webhook Event、Braintree Transaction、Customer、Payment Method Token、Dispute、Refund。
- 典型流程：PayPal Checkout Orders API、authorize/capture、Subscriptions、Braintree Drop-in、Hosted Fields、vault、退款/争议/对账。
- webhook 重点：`CHECKOUT.ORDER.APPROVED`、capture completed/denied/refunded、subscription activated/cancelled/payment failed、dispute created/updated、Braintree transaction/dispute events。
- 幂等要求：创建订单、捕获、退款、订阅变更使用 PayPal-Request-Id 或业务幂等键；前端 approve 回跳只能触发查询/确认，不替代 webhook 终态。
- 安全边界：客户端只持 client id/tokenization key；服务端保管 secret；Hosted Fields/Drop-in 降低 PCI；webhook 验签；禁止信任前端金额、币种、订单状态。
- 测试重点：Sandbox buyer/seller、负向金额/币种、授权后捕获、订阅续费失败、webhook simulator、Braintree test nonce、退款、dispute、go-live app 与 webhook。
- PayPal Orders：intent 只能按业务选 `CAPTURE` 或 `AUTHORIZE`；Order `APPROVED` 只是付款人批准，不是入账；最终要看 capture/authorization 及 webhook/查询结果。
- PayPal Payments：授权后捕获走 authorization id；捕获后退款走 capture id；void、reauthorize、partial capture、partial refund 都要独立建模。
- Braintree：客户端只拿 client token 或 tokenization key 生成 nonce/payment method token；服务端用 merchant id/public key/private key 创建交易、vault、退款、void 和订阅。
- Payer ID：`payer_id` 可作为 PayPal 账户标识和审计字段，不能替代用户身份认证、支付成功判定或业务订单归属校验。
- 生产上线：sandbox/live app、endpoint、webhook id、merchant account、currency、settlement、risk/3DS、日志和告警必须逐项切换检查。


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
8. PayPal/Braintree 的客户端 token、nonce、payer id、redirect token、success query 都不是服务端资金事实；只能作为后续服务端确认的输入。
9. 日志只允许记录脱敏后的 id、状态、金额、币种、request id、event id、debug id；禁止落 secret、private key、完整 PAN、CVC、access token、原始授权头。

## 快速总则

- 先建支付状态机，再写接口：created、requires_action、authorized、captured、paid、failed、cancelled、refunded、partially_refunded、disputed、chargeback、settled 等状态要有明确迁移。
- 先选集成形态：托管页降低 PCI 和前端复杂度，自建组件提升体验但增加安全、3DS、错误态和合规责任。
- 所有创建/捕获/退款/订阅变更默认幂等；所有 webhook 默认至少一次投递，不能写成“只会来一次”。
- 订单表、支付表、事件表、退款表、争议表、对账表分清；不要把 PSP 原始事件直接覆盖业务订单。
- 前端必须覆盖 loading、requires action、取消、失败、超时、重复点击、返回页刷新、移动端和弱网。
- 后台必须支持按业务订单号、PSP id、event id、request id、用户和时间窗口检索。
- 上线必须有灰度、监控、告警、人工补偿路径和密钥轮换方案。
- PayPal amount 使用服务端订单快照重算，校验 `currency_code`、`value`、purchase unit、payee、invoice id/custom id，不接收前端直接传入最终金额。
- Braintree amount 同样由服务端决定；nonce 只能代表客户授权了某个支付方式，不能代表支付金额、币种、商户账户或权益。
- `PayPal-Request-Id`/业务幂等键要进入数据库唯一约束或去重表；网络超时后先查原请求结果，不能盲目重发新 id。
- 生产小额验证必须用真实 live app、真实 webhook、真实订单、真实退款/void 闭环；验证后标记测试订单并纳入对账排除或特殊分类。

## 支付硬门禁

- Orders 门禁：Order 创建前必须冻结服务端订单快照，包含 amount、currency、purchase unit、invoice/custom id、payee、shipping/tax/discount、环境和用户；Order id 只能绑定一个业务支付单。
- Capture 门禁：只允许服务端 capture；capture 前重新查询 Order/Authorization 状态、金额、币种、payee 和剩余可捕获金额；capture 后以 capture id/status/amount/seller protection/webhook 或查询确认入账候选。
- Authorize 门禁：AUTHORIZE intent 只能进入 authorized；履约、押金、延迟发货必须有 capture/void/reauthorize/过期策略；authorization id 与 capture id 必须分开入库。
- Vault 门禁：vault 必须有用户显式授权、用途说明、解绑路径、脱敏展示、card verification/3DS/AVS/CVV 策略和订阅迁移方案；nonce 不得长期保存或跨订单复用。
- Subscriptions 门禁：Product/Plan/Subscription/Agreement、账期、trial、setup fee、tax、outstanding balance、retry、suspend/cancel/activate 都要映射业务权益；价格或支付方式变更必须可追溯。
- Webhook 门禁：PayPal 与 Braintree webhook 分开验签、分开 event id 去重、分开原文留存；未验签、未知 webhook id、环境不匹配、重复 event、乱序事件都不能直接改订单终态。
- 金额货币门禁：所有金额用字符串或定点小数，按币种最小单位和 PayPal/Braintree 支持精度校验；禁止浮点累计、跨币种相加、前端金额覆盖、零元绕过和超额 capture/refund。
- 退款争议对账门禁：退款、void、dispute/chargeback、settlement、payout、fee、FX 都是独立资金事件；必须能从业务订单追到 capture/refund/dispute/payout，且差异进入队列。
- 风控门禁：记录 payer、email、国家、IP、设备、账单地址、shipping、seller protection、AVS/CVV/3DS、processor decline 和 velocity；只能做防欺诈，不协助规避平台规则。
- 沙箱到生产门禁：sandbox/live 的 base URL、app、client id、secret、webhook id、merchant id/account、Braintree environment、currency、3DS/fraud、Apple/Google Pay 域名必须逐项替换和核验。
- 发布验收门禁：真实 live 小额支付、capture/authorize、webhook、退款或 void、后台查询、对账标记、告警、日志脱敏、客服检索和回滚后 webhook 继续处理全部通过后，才可报告上线完成。

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
10. 上线后复核：抽查 live webhook 原文、capture/refund/dispute 报表、payout/settlement、日志脱敏和告警触发，确认没有 sandbox 配置残留。

## 场景执行卡

### 1. 一次性支付

- 证据：金额来源、币种、订单号、支付方式、用户、收款账户、成功/失败页、库存/权益发放时机。
- 动作：服务端创建支付对象；前端只确认或跳转；支付成功必须由服务端查询或 webhook 推进。
- 验证：成功、失败、取消、重复点击、刷新、移动端、3DS、webhook 延迟和订单超时关闭。
- PayPal Orders：创建 Order 时写入服务端生成的 purchase unit、invoice/custom id 和 payee；前端 approve 后只提交 order id 给服务端 capture/authorize。
- Capture 判定：Order capture 返回的 capture id、status、seller protection、金额币种与业务订单一致后，才进入 captured/paid 候选状态。
- Authorize 判定：Order authorize 返回 authorization id 后只进入 authorized；发货、履约或押金释放策略必须等捕获/void/过期规则。
- Payer ID：记录 `payer.payer_id`、email、name 只做审计和风控辅助；同一用户绑定 PayPal 账户要有显式授权和解绑路径。
- 失败兜底：approve 后 capture 超时、前端关闭、用户重复返回、HTTP 5xx、APPROVED 长时间未捕获，都要靠幂等查询和超时关闭任务收敛。

### 2. 授权与捕获

- 证据：是否预授权、捕获窗口、部分捕获、取消、库存/发货/酒店押金等业务规则。
- 动作：授权成功不等于收款完成；捕获、取消、过期和失败必须独立状态。
- 验证：授权成功捕获、部分捕获、超时未捕获、取消授权、重复捕获和金额不一致。
- Honor period/authorization period：记录授权时间、建议捕获窗口、过期时间、是否需要 reauthorize；超窗不能静默当作可捕获。
- 部分捕获：每次 capture 都要记录金额、币种、final capture 标记、剩余可捕获金额和履约关联；重复 capture 要靠 request id 和 capture id 去重。
- Void/reauthorize：void 只能关闭授权，不等于退款；reauthorize 要新老 authorization id 串联，避免后续捕获打到旧授权。
- Capture denied/pending：不要只按 HTTP 成功改已支付；pending/denied 要进入待确认或失败分支，并等待 webhook/查询补偿。
- 并发控制：同一 authorization 的 capture/void/reauthorize 必须串行化；final capture 后禁止再发部分捕获，除非平台明确返回可继续捕获。

### 3. 订阅与续费

- 证据：plan、price、trial、billing cycle、proration、失败重试、取消、升级降级、发票和税费。
- 动作：订阅状态以 invoice/payment/subscription webhook 推进；权益发放与账单成功绑定。
- 验证：试用结束、续费成功、支付失败、卡更新、取消、恢复、升级降级、欠费和补缴。
- PayPal Subscriptions：Product、Plan、Subscription、approval、activate/suspend/cancel/capture outstanding balance 要分别映射业务套餐和订阅实例。
- 失败恢复：跟踪 failed payments count、last failed payment、next retry、outstanding balance；欠费权益降级要可恢复，不要立即永久删除数据。
- 价格变更：升级降级、proration、trial、setup fee、税费和币种变更必须有用户确认、账单记录和 webhook 校验。
- Braintree Subscriptions：订阅依赖 vaulted payment method；payment method 更新、past due、canceled、charged successfully/unsuccessfully 都要更新业务状态。
- 订阅门禁：仅更新客户 Vault 里的支付方式不等于更新订阅扣款方式；必须确认 subscription 绑定的新 payment method token 已生效。

### 4. 退款、取消和补偿

- 证据：可退金额、部分退款、手续费、跨币种、退款窗口、库存/权益回滚和客服权限。
- 动作：退款单独建表；发起、处理中、成功、失败都要可查；失败不能直接改订单为已退款。
- 验证：全额、部分、多次退款、重复请求、超额退款、退款失败、webhook 延迟和人工补偿。
- PayPal 退款：以 capture id 发起 refund；记录 refund id、status、gross/net/fee、币种、原因、操作者、request id 和对应权益回滚。
- Braintree refund/void：Authorized、Submitted for Settlement、Settled 等状态对应 void/refund 路径不同，不能统一叫退款。
- 补偿单：PSP 成功但业务失败、业务成功但 webhook 延迟、重复退款拦截、人工调整都必须有补偿记录和审批痕迹。
- 退款幂等：同一业务退款单只能映射一个 PSP refund/void 尝试；超时重试先查原 request/refund/transaction 状态，禁止换新幂等键扩大退款。

### 5. Webhook 与事件处理

- 证据：事件类型、签名方式、重试策略、事件 id、幂等表、死信队列和重放入口。
- 动作：先验签和落原文，再异步推进业务状态；未知事件可记录但不误改状态。
- 验证：签名错误、重复事件、乱序事件、缺字段、慢处理、5xx 重试、死信重放和历史事件补偿。
- PayPal 验签：用 transmission id、transmission time、transmission sig、cert url、auth algo、webhook id 和原始 webhook event 做签名验证；失败只落安全日志，不推进订单。
- Braintree 验签：使用 webhook notification signature/payload 解析验签；invalid signature 必须拒绝，不能从 payload 手工解析后继续处理。
- 事件事实：记录 event id、event type、resource id、resource version、create time、transmission time、处理状态和错误；同一 event id 重放只能幂等返回。
- 乱序处理：capture completed 先于 order approved、refund 先于业务查询、subscription canceled 先于 payment failed 都要按 PSP 对象最新查询补偿。
- 重复回调：event id 唯一约束只是第一层；同一 capture/refund/subscription/dispute resource 的重复状态变更也要按状态机幂等，避免重复发货、重复退权益或重复通知。
- 验签细节：PayPal 必须使用当前环境 webhook id 和收到的 transmission headers 验证；Braintree 必须用 SDK/网关解析签名 payload，不能先 JSON parse 后自行信任字段。

### 6. 争议、拒付和风控

- 证据：dispute/chargeback 生命周期、证据提交窗口、通知人、金额冻结、订单权益处理和会计影响。
- 动作：争议不等同退款；独立状态记录证据、期限、结果、资金影响和用户限制。
- 验证：争议创建、证据提交、赢/输、反转、资金扣回、通知和报表对齐。
- PayPal dispute：记录 dispute id、reason、status、disputed amount、seller response due date、evidence、adjudication outcome 和资金影响。
- Braintree dispute：记录 received/open/won/lost/accepted 等状态、reply deadline、chargeback protection 和 transaction id。
- 风控边界：可以做速度限制、黑名单、设备/邮箱/国家风险评分；不能协助绕过 3DS、伪造 payer、卡测或规避平台风控。
- 风控动作：高风险只允许进入人工审核、延迟履约、要求 3DS/重新验证、限制退款权限或冻结权益；禁止为了通过率关闭验签、3DS、AVS/CVV 或平台风险规则。

### 7. 对账与结算

- 证据：PSP balance/transaction/report、payout、fee、FX、refund、dispute、税费、商户账户和时间区间。
- 动作：业务支付单、PSP 交易、余额流水、打款流水分层对账；差异进入待处理队列。
- 验证：日切、时区、手续费、部分退款、争议、打款失败、跨币种和重复导入。
- 对账维度：业务订单号、invoice/custom id、order id、authorization id、capture id、refund id、subscription id、Braintree transaction id、payout id 都要能串联。
- 金额维度：gross、fee、net、tax、shipping、FX、settlement currency、退款、争议冻结/扣回分开，不用单一订单金额硬对齐。
- 时间维度：授权时间、捕获时间、事件时间、结算时间、打款时间、业务入账时间分开；跨时区按 PSP 报表口径固化。
- 差异处理：长款、短款、重复事件、缺 webhook、手工退款、争议扣回、live 小额验证都进入可审计差异队列。
- 对账门禁：上线前至少准备订单级、资金流水级、payout/settlement 级三层对账口径；所有 manual adjustment 必须有原因、审批人和原始凭证。

### 8. 上线与运维

- 证据：生产账号、域名、webhook、密钥、API version、风控/3DS、告警、日志、回滚和客服 SOP。
- 动作：先小流量灰度；监控支付成功率、失败原因、webhook 延迟、重复事件、退款失败和对账差异。
- 验证：生产小额支付、退款、webhook、后台查询、告警触发、密钥轮换和回滚路径。
- Sandbox/live 切换：base URL、client id、secret、merchant id、webhook id、Braintree environment、merchant account id、Apple/Google Pay 配置都要成对检查。
- 生产小额验证：至少覆盖创建、批准、capture/authorize、webhook、退款或 void、后台查询、日志脱敏、对账标记和告警无误。
- 回滚策略：支付入口可降级关闭新支付，但 webhook 必须继续接收；已创建订单、授权、退款和争议不能因发布回滚丢处理。
- 发布证据：必须记录 live order/authorization/capture/refund 或 void id、webhook event id、后台订单号、对账标记、告警截图或日志索引、回滚开关位置；无证据不报完成。

### 9. Braintree Tokenization 与 Vault

- 证据：使用 Drop-in、Hosted Fields、PayPal、Venmo、Apple Pay、Google Pay、3DS、vault、merchant account 和客户端平台。
- Client token：由服务端生成，包含客户端 SDK 初始化所需配置，可绑定 customer id；有效期和权限要受控，不写入静态前端配置。
- Tokenization key：只能授权一部分客户端 tokenization 能力；适合简单场景，不等于服务端 API key，不能拿来创建交易或退款。
- Nonce：一次性或短期支付方式凭证，只能由服务端结合订单金额、币种、merchant account 创建 transaction；禁止把 nonce 当可长期复用 token。
- Payment method token：vault 后的长期 token 要绑定 customer、授权来源、用途、撤销路径和脱敏展示；换卡/解绑要同步订阅和风控。
- Hosted Fields/Drop-in：前端不得接触完整卡号/CVC 以外的自定义收集路径；自建卡表单会扩大 PCI 范围，必须先确认合规能力。
- 验证：test nonce、3DS 成功/失败、processor declined、gateway rejected、settlement pending、void/refund、webhook parse 和订阅扣款。
- Vault 风险：存储前启用 card verification/AVS/CVV/3DS 策略；失败的验证、重复卡、过期卡、换卡和解绑都要同步客户、订阅和风控记录。

## 验证门禁

- 沙箱支付成功、失败、取消、3DS、重复点击、刷新和移动端已覆盖。
- webhook 验签、去重、乱序、重试、死信和重放已覆盖。
- 幂等键、唯一约束、并发请求和重复退款已覆盖。
- 退款、争议、对账和人工补偿至少有最小闭环。
- 生产配置、密钥、webhook endpoint、API version、告警和回滚已检查。
- PayPal Orders 已覆盖 CAPTURE 与 AUTHORIZE 分支、payer id 记录、authorization/capture/refund id 映射和 PayPal-Request-Id 重试。
- Braintree 已覆盖 client token/tokenization key 边界、nonce 到 transaction、vault token、subscription、webhook parse 和退款/void。
- 金额币种已证明全部来自服务端订单快照，且 capture/refund/subscription/outstanding balance 都有金额上限校验。
- 日志与监控已做敏感扫描：无 secret、private key、access token、完整卡号、CVC、原始授权头或客户支付敏感数据。
- live 小额验证计划已包括支付、webhook、退款/void、对账标记、客服可查和回滚后的 webhook 继续处理。
- webhook/return 双路径已证明不会重复发货、重复开通权益、重复退款或互相覆盖状态。
- sandbox/live 差异清单已逐项签字：endpoint、app、webhook id、merchant account、币种、风控、3DS、报表、告警、客服 SOP。

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
- 不把 PayPal access token、Braintree private key、merchant account、client token 或 tokenization key 写入仓库、截图、日志、工单或前端 bundle。
- 不为了排障打印原始 webhook 全量到应用日志；如需留存，必须加密/限权/脱敏，并有过期清理策略。

## 反例库

- 前端 success URL 到达就发货：错误，必须由服务端支付查询或 webhook 终态推进。
- webhook 不验签直接改订单：高危，必须阻断。
- 没有幂等键就创建支付或退款：会导致重复扣款/重复退款。
- 只测成功卡，不测失败、3DS、取消、重复、退款和争议：不能上线。
- 把退款状态直接覆盖订单支付状态：会丢失部分退款和争议语义。
- 测试环境 webhook 复制到生产但密钥/API version/endpoint 不一致：上线风险。
- 对账只按订单金额，不对手续费、FX、退款、争议和 payout：财务不可闭环。
- PayPal Order `APPROVED` 就发货：错误；必须 capture/authorize 后结合 webhook 或查询确认资金状态。
- PayPal authorize 后直接记已支付：错误；授权不是捕获，可能过期、void、denied 或只部分捕获。
- 前端传 amount/currency 给 capture：错误；服务端必须按订单快照重算并校验 purchase unit。
- 用同一个 PayPal-Request-Id 处理不同业务订单：错误；会污染幂等结果，必须按业务动作唯一。
- 重试超时 capture 时换新 request id：风险；先查原 request/order/capture 状态，避免重复捕获。
- 把 payer id 当登录用户 id：错误；只能作为 PayPal 账户标识，仍需本系统用户鉴权和绑定关系。
- Braintree nonce 落库长期复用：错误；长期复用应 vault 成 payment method token，并提供撤销和脱敏展示。
- 把 tokenization key 当 server token：错误；客户端 tokenization 权限不能替代服务端 merchant credentials。
- Braintree transaction `authorized` 就履约：风险；要按业务确认是否需要 submitted for settlement/settled 或捕获策略。
- 订阅 webhook 只处理 activated/cancelled：不足；payment failed、past due、suspended、charged successfully/unsuccessfully 都会影响权益。
- 退款接口成功就立即退权益：风险；要记录 refund pending/completed/failed 和 webhook/查询补偿。
- 争议按退款处理：错误；dispute/chargeback 有证据期、资金冻结、赢输和会计影响。
- sandbox 账号测通后直接切 live：不足；live 需要小额真实支付、退款/void、webhook、告警和对账验证。
- 日志打印 PayPal access token 或 Braintree private key：事故；必须脱敏并轮换泄露密钥。
- webhook handler 先返回成功再异步验签：错误；验签失败必须拒绝或隔离，不能进入业务队列。
- 只按 event id 去重，不按 resource id 和业务状态去重：不足；平台重放、手工 resend 和乱序可能重复推进副作用。
- 以浮点数计算 10.10 + 0.20 后传给 PSP：错误；支付金额必须用字符串/定点小数和币种精度规则。
- Braintree vault 成功就给订阅续费：错误；还要确认 subscription 的 payment method token 已更新并通过后续扣款验证。
- live 小额验证订单没有从对账排除或标记：风险；会污染收入、退款率、争议率和运营报表。
- 发布回滚时关闭 webhook 路由：事故；回滚只能关闭新支付入口，不能丢已创建支付、退款、订阅和争议事件。

## 自检清单

- 是否确认国家、币种、商户、支付方式、收款账户和合规边界？
- 是否有业务订单与 PSP 对象映射？
- 是否有状态机、幂等键、唯一约束和 webhook 去重？
- 是否验签、脱敏、隔离测试/生产密钥？
- 是否覆盖退款、争议、对账、监控、告警和人工补偿？
- 是否跑过沙箱全链路和上线前生产小额验证计划？
- 是否区分 PayPal Order、Authorization、Capture、Refund、Subscription 和 Braintree Transaction/Payment Method Token？
- 是否证明 amount/currency/payee/merchant account 全部来自服务端，不由前端决定？
- 是否为 PayPal webhook 与 Braintree webhook 分别做了验签、原文留存、去重和重放？
- 是否检查 client token、tokenization key、server credentials、webhook id、sandbox/live 没有混用？
- 是否能按 payer id、order id、capture id、refund id、subscription id、Braintree transaction id 和 request id 查全链路？

## 相邻技能边界

- API 工程 / api-engineering（api）：接口契约、状态码、幂等和 webhook API 设计；支付技能负责 PSP 语义和支付状态机。
- 数据库工程 / database-engineering（db）：支付/退款/事件/对账表设计和事务；支付技能负责字段语义和资金状态。
- Web 安全 / web-security（wsec）：鉴权、XSS、CSRF、密钥和权限专项；支付安全命中时联动。
- 测试验证 / test-engineering（tst）：测试矩阵和 CI gate；支付上线前必须联动测试验证。
- 代码审计 / code-audit（aud）：代码审计和安全审计；支付核心链路默认联动。
- 可观测性 / observability（obs）：日志、指标、trace、告警；支付生产监控联动。
- 法务合规 / legal-counsel（law）：合规、隐私、税务、地区限制、争议规则；跨境支付和订阅条款联动。
- 发布部署 / release-engineering（rls）：发布、灰度、回滚和生产验证；支付上线联动。
