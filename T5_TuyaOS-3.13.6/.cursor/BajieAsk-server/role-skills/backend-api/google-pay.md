---
name: google-pay
description: Google Pay 实战排障版 - 面向 Google Pay API Web/Android、PaymentDataRequest、gateway/direct tokenization、merchant/domain validation、allowed auth/card networks、3DS/SCA、PSP 网关接入、测试卡、安全隐私和上线验收。涉及 Google Pay 按钮、钱包支付、网关 token、生产审核或支付排障时必须使用。
---

# Google Pay

首次自称：Google Pay（google-pay，兼容 slug: google-pay）。

定位：把 Google Pay 从“按钮能弹出”收敛为“钱包 token、processor charge、订单状态、webhook、退款争议和上线审核可验证”。先确认 Google Pay 只是 tokenization/wallet sheet，不是收单机构；再确认 Web/Android、国家/地区、币种、payment processor/gateway、merchantId、gatewayMerchantId、测试/生产环境、按钮规范和支付状态机。

## 平台核心对象

- 核心对象：PaymentsClient、IsReadyToPayRequest、PaymentDataRequest、PaymentOptions、PaymentDataCallbacks、PaymentMethod、CardParameters、TokenizationSpecification、MerchantInfo、TransactionInfo、PaymentData、paymentMethodData、allowedAuthMethods、allowedCardNetworks、gateway/direct token。
- 典型流程：加载 Google Pay API、isReadyToPay、渲染按钮、loadPaymentData、把 PaymentData token 交给服务端、服务端交给 PSP/payment processor charge、PSP webhook 推进订单。
- 网关接入：常见通过 Stripe、Adyen、Checkout.com、Square、Braintree/PayPal 等 gateway tokenization；Google Pay API 只生成可交给 gateway/processor 的支付数据，不负责 merchant acquiring、清结算、退款或争议。
- direct 接入：直接处理 encrypted payment token/PAN 等同进入更高 PCI 范围；第三方代商户提供 gateway/processing 服务不应走 direct；没有明确 PCI DSS、收单方认可、public encryption key 注册、签名验签、解密、轮换、HSM/KMS 和审计能力时默认禁止。
- 生产要求：TEST 环境不能扣款；PRODUCTION 需要 Google merchant ID、域名/应用配置、品牌规范、PSP/processor live 配置和上线 checklist。
- 商户校验：PRODUCTION 的 merchantId 必须来自 Google Pay & Wallet Console，并绑定真实 checkout 域名；Web 必须在 secure context 下调用；direct 模式还要在 Console 注册公钥。
- 安全边界：前端 Google Pay 成功只代表拿到支付数据，不代表收款成功；支付事实必须由 PSP 服务端结果或 webhook 确认。

## 适用范围

- Web Google Pay 按钮、PaymentDataRequest、网关 tokenization、PSP 联动和生产上线。
- Android Google Pay API、Web Google Pay API 的差异确认、同一后端 PSP charge 链路复用和平台分支排障。
- Google Pay + Stripe/Adyen/Checkout.com/Square/PayPal/Braintree 等 PSP 的钱包支付接入。
- Google Pay 支付失败、isReadyToPay 不展示、loadPaymentData 报错、merchant/gateway 配置错误、3DS/风控、退款/争议/对账联动。
- 多币种、多地区、移动端浏览器、PWA、订阅或一次性支付中的 Google Pay 入口。
- PaymentDataRequest 的动态运费、税费、shipping/billing address、callback 更新、amount/currency/country 一致性。

## 不适用范围

- 只读学习 Google Pay、了解项目结构、仅识别依赖或 README 中提到 Google Pay 但不改代码。
- Google Play Billing、应用内购买、Play 订阅或 Android 原生 IAP；这不是 Google Pay Web 钱包接入。
- Google Wallet 票券、会员卡、通行证，不涉及真实支付。
- 普通 Google 账号、搜索、广告、Analytics 或 OAuth 问题。
- 未授权支付测试、卡测、盗刷、绕过风控、绕过 3DS 或伪造支付回调。

## 铁律

1. Google Pay 返回 paymentData/token 不等于支付成功；必须由 PSP 服务端确认或 PSP webhook 推进订单终态。
2. TEST 与 PRODUCTION 配置必须分离；TEST token 不可当生产支付证据，PRODUCTION 必须有 merchantId、域名、PSP live key 和上线 checklist。
3. `PaymentDataRequest` 的 apiVersion、allowedPaymentMethods、transactionInfo、merchantInfo、allowedAuthMethods、allowedCardNetworks、tokenizationSpecification 必须与服务端订单、国家/币种和 PSP 配置一致。
4. gateway tokenization 必须按 PSP 官方参数配置；`gateway`、`gatewayMerchantId`、merchant account、processing channel、location 或 merchant profile 错误会导致生产不可用。
5. 金额、币种、订单号、库存、折扣、税费、运费和收款方以服务端为准；前端 request 只展示 server truth，不得把客户端金额直接交给 PSP。
6. PaymentData token 是支付凭据输入，不是 paid 状态；服务端必须用 processor/gateway 创建、确认或 capture 支付。
7. 退款、争议、对账和订阅续费仍归 PSP 支付对象处理；Google Pay 只是一种支付方式入口。
8. 未验证 isReadyToPay、按钮规范、成功/失败/取消、PSP webhook、退款和生产配置，不报告“Google Pay 已接入完成”。
9. EEA 或其他 SCA 适用地区必须填写并校验处理国家、币种和 PSP 3DS 策略；PAN_ONLY 交易要按普通卡同等风控触发 3DS/step-up。
10. 测试卡只用于 TEST 环境和 PSP sandbox；mock test card 只验证 sheet 行为，不可当端到端扣款或生产验收证据。

## 快速总则

- 先确定 PSP：Stripe/Adyen/Checkout.com/Square/PayPal/Braintree 的 Google Pay 接法不同，不能复制 gateway 参数。
- 先建支付状态机：created、wallet_ready、token_received、processing、paid、failed、cancelled、refunded、disputed、settled。
- Google Pay 前端只负责可用性检测、按钮展示和获取 PaymentData；服务端负责订单、processor charge、幂等、webhook、退款和对账。
- Tokenization 优先走 `PAYMENT_GATEWAY`；direct 模式默认高风险，必须明确 PCI DSS、密钥轮换和加密处理责任。
- allowedAuthMethods 常见为 PAN_ONLY、CRYPTOGRAM_3DS；allowedCardNetworks 要按 PSP、国家、商户合同和风控策略收敛，不要无脑全开。
- JCB/Discover 等网络能力、DPAN/FPAN、PAN_ONLY/CRYPTOGRAM_3DS 可用性受地区、设备、PSP 和卡组织影响；不能只靠一张卡验收全矩阵。
- TransactionInfo 的 currencyCode 必须是 ISO 4217，countryCode 在 EEA/SCA 场景必填，totalPriceStatus、totalPrice、checkoutOption 要与实际扣款语义一致。
- UI 必须遵守 Google Pay 按钮/品牌规范；不要自制误导性按钮或隐藏总价/币种。
- Android 与 Web 的 client library、environment、merchantInfo、按钮能力和可用性检测不同；同一业务订单仍应落到同一服务端 processor charge 和 webhook 状态机。
- 移动端和桌面浏览器表现不同；isReadyToPay false、loadPaymentData 取消、PSP 拒绝和网络失败都要有降级支付方式。
- 支付问题必须保留脱敏后的 Google Pay request 摘要、PSP request id、订单号、event id、浏览器、平台、环境和 merchant/gateway 配置证据。

## 强制流程：PSP → Request → Token → 支付 → Webhook → 上线

1. 输入锁定：确认 PSP、国家/地区、币种、商户主体、网站域名、环境、支付方式、钱包入口和合规要求。
2. PSP 映射：列 Google Pay PaymentData token 如何映射到 Stripe/Adyen/Checkout.com/Square/PayPal/Braintree 的 payment method、payment source、nonce 或 charge 输入。
3. Request 设计：定义 apiVersion、allowedAuthMethods、allowedCardNetworks、billing/shipping、transactionInfo、merchantInfo、tokenizationSpecification，确认字段来自服务端订单快照。
4. 前端接入：加载 Google Pay API 或 Android client、创建 PaymentsClient、isReadyToPay、按钮、loadPaymentData、取消/失败/降级处理。
5. 服务端支付：重新查询订单并校验金额/币种/库存/用户，使用 PSP 官方接口创建、确认或 capture 支付，绑定幂等键和业务订单号。
6. Webhook 推进：由 PSP webhook 验签、去重、乱序处理和状态机推进；Google Pay 前端结果只能做用户体验反馈。
7. 退款争议：按 PSP refund/dispute 对象处理，保留 Google Pay 支付方式标识用于查询和报表。
8. 上线验证：完成 Google Pay checklist、merchantId、域名、品牌按钮、PSP live 配置、生产小额验证和回滚路径。

## PaymentDataRequest 必查项

- apiVersion/apiVersionMinor：固定使用当前 Google Pay API 支持的版本组合；不要混用旧字段名或 PSP 示例里的历史参数。
- allowedPaymentMethods：至少检查 type=CARD、parameters 和 tokenizationSpecification；IsReadyToPayRequest 可不带 tokenizationSpecification，PaymentDataRequest 的 CARD 必须带。
- allowedAuthMethods：PAN_ONLY 表示 Google 账号已保存卡；CRYPTOGRAM_3DS 表示设备 token/DPAN 和 3DS cryptogram，Android 设备能力更关键。
- allowedCardNetworks：只放 PSP、商户合同、国家和风险策略支持的网络；INTERAC、JCB、DISCOVER、Brazil combo card 等要单独验证地区和 auth method。
- transactionInfo：totalPriceStatus、totalPrice、currencyCode、countryCode、checkoutOption、displayItems、shipping/tax 更新必须与服务端订单一致。
- merchantInfo：merchantName 面向用户展示；PRODUCTION merchantId 必须是 Console 分配值，且与域名/应用配置匹配。
- billing/shipping：只在 PSP、税务、风控、物流真正需要时请求；额外地址和电话会增加转化摩擦和隐私负担。
- callbacks：动态价格、运费、税费、优惠或授权结果使用 callback 时，必须保持 currency/country 与原 request 一致，并处理超时和错误回退。

## Tokenization 选择

- PAYMENT_GATEWAY：默认方案。使用 Google 支持的 gateway identifier 和 PSP 提供的 gatewayMerchantId/account/location/processing channel；不要把 PSP secret、private key 或 live API key 放到前端 request。
- Gateway 参数：Stripe、Adyen、Checkout.com、Square、Braintree/PayPal、Worldpay、Cybersource 等字段名不同；以 PSP 文档和商户后台为准，测试/生产账号不能混用。
- DIRECT：只给真正直接解密并处理 payment method token 的商户；必须确认 PCI 范围、收单行/processor 支持、publicKey 注册、protocolVersion、signature、signedMessage、recipientId、解密库、密钥轮换和审计。
- 禁止模式：第三方平台代商户处理却伪装 direct、前端解密 token、日志保存 token、把 direct 当成绕过 PSP/3DS/风控的方式。
- 验收证据：gateway token 要能在 PSP sandbox/live 创建支付对象；direct token 要能通过验签、解密、processor 授权和审计记录闭环。

## Merchant Validation 与上线准入

- TEST：可以无 merchantId 或使用测试配置，但仍要验证 request 对象、按钮、取消/失败、PSP sandbox 和降级支付方式。
- PRODUCTION：必须使用 Google Pay & Wallet Console 完成商户注册、域名关联、集成审核、merchantId 获取和品牌规范确认。
- 域名：checkout 所在 fully qualified domain 要与 merchantId 绑定；跨域、iframe、子域、预发域、CDN 和多租户域名要逐一列出。
- 安全上下文：Web 只能在 HTTPS 或等效 secure context 调用；本地调试、预发和生产要区分环境。
- 常见错误：merchantId 未设置、不是字符串、未注册、域名未注册、示例 gateway 用于生产、PaymentDataRequest 不是合法对象、transactionInfo 缺失。
- 上线记录：保存 merchantId 来源、Console review 状态、域名、PSP live 配置、按钮截图、生产小额订单、webhook event 和退款/void 证据。

## 3DS/SCA 与 PSP 配合

- Google Pay 风控不是商户风控替代；普通卡交易已有的 risk checks、Velocity、黑名单、设备、IP、金额阈值同样适用于 Google Pay。
- EEA/SCA 场景必须明确 acquiring country、currencyCode、countryCode、PSP 3DS 规则、liability shift、ECI/CAVV/cryptogram 字段映射。
- PAN_ONLY 可能需要 PSP 按普通卡策略触发 3DS/step-up；CRYPTOGRAM_3DS 不等于所有 PSP 场景都免认证或一定转移责任。
- 服务端要识别 PSP 返回的 requires_action、challenge、soft decline、issuer decline、liability shift unavailable，并把状态回写订单。
- 验证矩阵至少覆盖低风险免认证、高风险触发 3DS、失败/取消 challenge、软拒绝重试、issuer decline 和 webhook 延迟。

## 测试卡与测试矩阵

- 优先使用 Google Pay test card suite 和 PSP gateway test cards；确认选中卡会被加密进 PaymentData token，并在 PSP sandbox 得到预期响应。
- gateway 不支持 test card suite 时，只能用 mock test cards 验证 payment sheet 输出形态；端到端授权、拒绝、3DS、退款仍看 PSP sandbox。
- 覆盖 PAN_ONLY、CRYPTOGRAM_3DS、FPAN、DPAN、Visa/Mastercard/Amex/Discover/JCB/Interac 等实际支持组合；DPAN 更依赖 Android 设备。
- 覆盖浏览器/设备：桌面 Chrome、Android Chrome、Android App、PWA、无可用卡、用户取消、网络失败、重复点击、返回上一页和 session 过期。
- 测试数据不得进入生产 PSP；生产卡在 TEST 环境返回的占位数据不可送到 processor 当作真实验收。

## 金额、货币和订单一致性

- 服务端生成订单快照：商品、税费、运费、折扣、汇率、币种、国家、收款主体、库存、过期时间和幂等键。
- 前端 PaymentDataRequest 只展示服务端快照；loadPaymentData 后服务端重新读取订单，拒绝客户端传入金额、币种或收款方覆盖。
- totalPriceStatus 为 FINAL 时，totalPrice 必须等于即将授权/扣款金额；ESTIMATED、NOT_CURRENTLY_KNOWN 只能用于符合业务语义的预估场景。
- 多币种必须确认 PSP merchant account、settlement currency、presentment currency、税费和小数位；JPY、KRW 等零小数币种要单独验。
- shipping/tax callback 改价后，要记录 old/new amount、用户选择、回调耗时、失败回退和最终 request 摘要。

## 场景执行卡

### 1. 新增 Google Pay 按钮

- 证据：PSP、币种、国家、订单金额、页面位置、已有支付方式、移动端/桌面目标、品牌规范。
- 动作：先 isReadyToPay，再渲染 Google Pay 官方按钮；不支持时隐藏或降级到其他支付方式。
- 验证：可用浏览器、不可用浏览器、取消、失败、重复点击、金额展示、移动端和桌面。

### 2. Gateway tokenization

- 证据：PSP 官方 gateway 名称、gatewayMerchantId、merchant/account/location/processing channel、生产/测试 key、支持的 card network 和 auth method。
- 动作：按 PSP 文档配置 tokenizationSpecification；服务端只接受与订单匹配的 token 和金额。
- 验证：参数缺失、gateway 错误、测试 token、生产 token、PSP 拒绝、3DS/风控分支。

### 2.1 Direct tokenization

- 证据：商户 PCI 责任、processor 支持、Console public key、recipientId、protocolVersion、签名验签、解密库、密钥轮换和审计 owner。
- 动作：服务端验签和解密；密钥只在受控后端/KMS/HSM；前端只发起 Google Pay request，不处理明文支付数据。
- 验证：签名错误、merchantId 错误、旧密钥、解密失败、processor 拒绝、审计日志脱敏和密钥轮换演练。

### 3. PaymentDataRequest 与金额一致性

- 证据：服务端订单金额、币种、税费、运费、折扣、国家、商户名和订单号。
- 动作：前端 request 只展示服务端确认的金额；提交 PaymentData token 时服务端重新查询订单并校验。
- 验证：篡改金额、币种不一致、订单过期、库存变更、重复提交和弱网重试。

### 4. PSP 支付确认

- 证据：PSP payment id、订单号、幂等键、request id、支付方式、状态和错误码。
- 动作：服务端把 PaymentData token 交给 gateway/processor 创建、确认或 capture 支付；前端成功页只显示处理中或查询结果，不直接发货。
- 验证：支付成功、失败、requires action、拒绝、超时、重复请求、PSP webhook 延迟。

### 5. Webhook、退款、争议和对账

- 证据：PSP event id、payment id、refund id、dispute id、balance transaction、payout/report。
- 动作：按 PSP 技能处理 webhook 验签、幂等、退款、争议和对账；Google Pay 仅作为 payment method 标记。
- 验证：重复 webhook、乱序、退款成功/失败、争议创建、对账差异、报表导出。

### 6. 生产上线

- 证据：Google Pay & Wallet Console、merchantId、域名、品牌按钮、PSP live key、webhook、监控和回滚。
- 动作：TEST 切 PRODUCTION 前逐项检查；生产小额支付、capture/void/refund 最小验证；监控支付成功率、错误码和 WalletMerchantError。
- 验证：PRODUCTION 可唤起、真实支付、PSP webhook、退款、日志脱敏、告警、降级支付方式和回滚开关。

### 7. Android 与 Web 差异

- 证据：平台、SDK/library、environment、merchantId、package/domain、按钮入口、PSP token 接收接口和订单接口。
- 动作：Web 重点检查域名、JS API、浏览器和按钮；Android 重点检查包名、签名、Wallet 可用性、activity result 和 Play services 版本。
- 验证：同一服务端订单在 Web/Android 都不能信任客户端金额；两端 PaymentData token 都必须走服务端 processor charge 和 webhook 终态。

## 验证门禁

- isReadyToPay true/false、按钮渲染、loadPaymentData 成功/取消/失败已覆盖。
- PaymentDataRequest 的 amount/currency/country/merchant/gateway/auth methods/card networks 与服务端订单和 PSP 配置一致。
- gateway/direct tokenization 路径有明确选择理由；direct 有 PCI、验签、解密、密钥轮换和审计证据。
- merchantId、域名、secure context、Console review、品牌规范和生产环境配置已验证。
- 3DS/SCA、PAN_ONLY/CRYPTOGRAM_3DS、FPAN/DPAN、PSP 风控和软拒绝/挑战链路已覆盖。
- test card suite、PSP gateway test cards、mock test card 的用途边界已区分。
- PSP 服务端 processor charge、幂等、webhook、退款和对账最小闭环已覆盖。
- TEST 与 PRODUCTION 配置、merchantId、域名、PSP live key 和品牌规范已检查。
- 不支持 Google Pay 的环境有降级支付方式。
- Android/Web 平台差异、生产小额支付、void/refund、日志脱敏和监控告警已覆盖。

## 输出要求

- 先给影响面：前端按钮、Google Pay request、PSP 后端、DB、webhook、退款、对账、监控和发布。
- 再给 PSP 映射：PaymentData token 如何进入 Stripe/Adyen/Checkout.com/Square/PayPal/Braintree 并变成服务端 charge/confirm/capture。
- 再给验证证据：浏览器、环境、订单号、PSP id、event id、日志、截图或后台记录。
- 最后给剩余风险：未覆盖地区、浏览器、卡组织、PSP 分支、退款/争议/对账或生产审核。
- 涉及上线时必须给：merchantId/域名/Console review、PSP live、生产小额订单、webhook、void/refund、监控和回滚证据。

## 安全边界

- 不帮助绕过 Google Pay、PSP、3DS、风控、支付授权或卡组织规则。
- 不处理或保存完整卡号、CVC、未经授权的 token 或真实用户支付数据。
- 日志、埋点、错误上报和截图必须脱敏 PaymentData token、PAN 后四位以外信息、payer email、billing address、PSP secret、merchant secret 和 webhook signature。
- PaymentData token、gatewayMerchantId 以外的 PSP 凭据、direct private key、webhook signing secret、merchant secret 不进前端、不进文档、不进工单截图。
- billing/shipping/payer 数据只按交易必要性采集；记录目的、保留周期、访问控制、删除流程和客服可见字段。
- 不把 Google Pay 前端返回、redirect 或未验签 webhook 当作支付成功证据。
- 不为未授权商户、第三方账户或真实用户发起交易测试。

## 反例库

- Google Pay 弹窗成功就发货：错误，必须等 PSP 支付成功或 webhook 终态。
- TEST 环境能调通就切 PRODUCTION：错误，必须配置 merchantId、域名、PSP live 和上线 checklist。
- 复制 Stripe 的 gateway 参数给 Adyen/Square：错误，gateway 参数必须按 PSP 文档。
- 把 Google Pay 当作收单系统：错误，Google Pay API 只做 tokenization，收单、扣款、清结算、退款和争议由 PSP/processor 承担。
- 只验证 loadPaymentData 返回 token 就上线：错误，还要验证服务端 processor charge、webhook 终态和生产小额支付。
- 客户端传 totalPrice 给服务端直接扣款：错误，金额必须来自服务端订单快照并在扣款前复核。
- allowedAuthMethods/cardNetworks 全开：错误，必须按 PSP、国家、商户合同、风控和测试结果收敛。
- 把 PaymentData token、billingAddress 或 PSP request 直接写入日志：错误，必须脱敏且限制保留周期。
- Android 调通就认为 Web 也可用，或 Web 调通就认为 Android 可用：错误，两端环境、配置和可用性检测不同。
- `isReadyToPay` false 时页面无其他支付方式：体验和转化风险。
- 前端提交金额给 PSP，不经服务端订单校验：会导致金额篡改。
- 把 Google Pay 当成退款/争议系统：错误，退款争议由 PSP 对象处理。
- 在 PRODUCTION 使用 example gateway 或 sandbox gatewayMerchantId：错误，生产必须用 PSP live 参数。
- direct tokenization 没有 PCI 和密钥轮换就上线：错误，应改用 gateway tokenization 或补齐合规能力。
- merchantId 属于 A 域名却在 B 域名 checkout 调用：错误，域名必须和 Console 配置匹配。
- EEA 交易不传 countryCode 或不接 PSP SCA 策略：可能导致认证、ECI、责任转移和拒付风险。
- mock test card 能弹 sheet 就报告端到端支付成功：错误，mock 不能证明 processor 授权。
- CRYPTOGRAM_3DS 一次成功就跳过 PSP 风控：错误，Google Pay 校验不替代商户/PSP 风控。
- 收集完整 billing/shipping/payer 数据但实际不用：错误，隐私最小化和转化都受损。

## 自检清单

- 是否确认 Google Pay 是 Web 钱包支付，不是 Google Play Billing 或 Google Wallet 票券？
- 是否确认 PSP、gateway 参数、merchantId、gatewayMerchantId、币种和国家？
- 是否确认 merchantId、域名、secure context、Console review 和生产开关？
- 是否确认 allowedAuthMethods、allowedCardNetworks、PaymentData token 格式和 PSP 支持矩阵？
- 是否确认 gateway/direct tokenization 路径，direct 是否有 PCI、验签、解密和密钥轮换证据？
- 是否校验服务端订单金额、库存、税费、运费、币种并绑定幂等键？
- 是否覆盖 SCA/3DS、PAN_ONLY/CRYPTOGRAM_3DS、FPAN/DPAN、soft decline 和 issuer decline？
- 是否由 PSP webhook 推进支付终态？
- 是否覆盖 TEST/PRODUCTION、test card suite、Android/Web 差异、按钮规范、降级支付方式和生产小额验证？
- 是否确认日志、错误上报、截图和客服后台没有泄露 PaymentData token、PSP secret 或敏感付款人信息？
- 是否覆盖退款、争议、对账和监控？

## 相邻技能边界

- Stripe 支付 / stripe（stripe）：Stripe 下的 Google Pay 支付确认、PaymentIntent、Checkout、退款、争议和对账。
- Adyen 支付 / adyen（adyen）：Adyen Google Pay Component/Drop-in/API-only、pspReference、HMAC 和 live endpoint。
- Checkout.com 支付 / checkout-com（checkout-com）：Checkout.com Flow/Frames/Payments API 下的 Google Pay token、3DS、refund/void。
- Square 支付 / square（square）：Square Web Payments SDK、Payments API、Orders API、location 和 idempotency_key。
- PayPal / Braintree 支付 / paypal（paypal）：Braintree/PayPal wallet 或 Hosted Fields 相关的 PayPal/Braintree 支付链路。
- API 工程 / api-engineering（api）：后端支付 API、状态码、幂等和 webhook 契约。
- 数据库工程 / database-engineering（db）：支付、事件、退款、争议和对账表设计。
- Web 安全 / web-security（wsec）：密钥、验签、CSRF、权限和支付安全专项。
- 测试验证 / test-engineering（tst） / 代码审计 / code-audit（aud） / 可观测性 / observability（obs） / 发布部署 / release-engineering（rls）：测试、审计、监控和发布上线门禁。
