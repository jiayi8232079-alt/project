---
name: apple-pay
description: Apple Pay / PassKit 支付实战技能，覆盖 Apple Pay JS、PKPaymentAuthorizationController、merchant validation、merchant ID、domain association、payment token、PSP tokenization、支付状态、退款、对账和回调边界；涉及 Apple Pay 钱包支付接入、调试或上线时使用。
---

# Apple Pay

首次自称：Apple Pay（apple-pay）。

定位：把 Apple Pay 从“按钮能弹出”收敛为“商户校验、支付 token、PSP 扣款、订单状态、回调、退款和对账可验证”。Apple Pay 是钱包支付入口和 tokenization 能力，不是 StoreKit/IAP，也不是收单、清结算或退款事实源。

## 适用范围

- Web Apple Pay JS、Safari ApplePaySession、merchant validation、domain association、Apple Pay button 和支付 sheet 排障。
- iOS / macOS PassKit 支付：PKPaymentRequest、PKPaymentAuthorizationController、PKPaymentAuthorizationViewController、merchant ID、entitlement、payment token。
- Apple Pay + Stripe、Adyen、Checkout.com、Square、PayPal/Braintree 或自有 PSP/acquirer 的 tokenization 和服务端 charge/capture/refund 链路。
- payment token、merchant session、网络 token、DPAN/FPAN、3DS/SCA、shipping/contact 回调、失败降级、测试/生产环境、上线验收。
- Apple Pay 支付后的订单状态、PSP webhook、退款、争议、对账和审计边界。

## 不适用范围

- StoreKit、In-App Purchase、订阅、App Store Server Notifications 或苹果内购审核。
- 普通 Apple 平台开发、SwiftUI/UIKit 页面、entitlement 泛问题但没有 Apple Pay 支付动作。
- Google Pay、Google Wallet、Apple Wallet 票券、会员卡、登机牌、门票和 .pkpass。
- 纯按钮样式、营销页视觉或只读学习 Apple Pay，没有接入、修改、调试、测试、上线动作。
- 未授权支付测试、卡测、盗刷、绕过风控、绕过 3DS 或伪造 PSP 回调。

## 铁律

1. Apple Pay authorization success 只代表拿到 payment token，不代表已收款；支付事实必须由 PSP/processor 服务端结果或 webhook 确认。
2. 金额、币种、订单号、库存、税费、运费、折扣和收款方以服务端订单快照为准；客户端 sheet 不可信。
3. merchant validation 必须服务端发起，不能把 merchant identity 证书、私钥、PSP secret 或支付 token 打到前端、日志、截图或错误体。
4. Web 生产必须完成 merchant ID、Apple Pay capability、domain association、HTTPS、Apple Pay JS 可用性和 PSP live 配置。
5. App 生产必须完成 merchant ID entitlement、bundle/team 绑定、sandbox/live 环境、支持网络和 PSP tokenization 映射。
6. payment token 只能作为 PSP charge/confirm 输入；业务 paid 状态由 PSP API 或 webhook 推进。
7. 退款、capture、void、dispute、settlement 和 reconciliation 归 PSP 或收单方对象；Apple Pay 只保留支付方式和 token 线索。
8. 没有 merchant validation、token 到 PSP、webhook、退款、失败降级和生产配置证据，不报告“Apple Pay 已接入完成”。

## 强制流程

1. 锁定平台：确认 Web/iOS/macOS、国家/地区、币种、商户主体、PSP/processor、merchant ID、域名、bundle id、环境和验收范围。
2. 建状态机：至少区分 created、wallet_ready、merchant_validated、authorized、token_received、processing、paid、failed、cancelled、refunded、disputed、settled。
3. 设计请求：PKPaymentRequest 或 ApplePaySession paymentRequest 的 countryCode、currencyCode、merchantCapabilities、supportedNetworks、lineItems、shipping/contact 字段必须来自服务端订单快照。
4. 商户校验：Web merchant validation URL 只由服务端请求 Apple；校验证书、域名、session 过期和错误码要有脱敏日志。
5. Token 交换：前端或 PassKit 回调只把 payment token 交给服务端；服务端校验订单、金额、币种、幂等键后调用 PSP。
6. PSP 支付：按 PSP 官方 Apple Pay tokenization 参数创建/确认/capture 支付，绑定业务订单号、用户、环境、request id 和幂等键。
7. 回调推进：PSP webhook 必须验签、去重、乱序处理、落事件表并按状态机推进；前端 success page 不能发权益。
8. 退款对账：退款、争议和 settlement 按 PSP 对象处理，保留 Apple Pay payment method、network、last4 或脱敏标识用于报表。
9. 验证交付：输出 sandbox、负向支付、取消、重复点击、webhook 重放、退款、生产配置和回滚证据。

## 场景执行卡

## 缺口补强

- 核心对象必须映射清楚：ApplePaySession 事件、merchantSession、PKPaymentToken、PSP payment id、capture/refund id、webhook event id、业务订单号和幂等键要能互相追溯。
- Merchant validation 要检查域名文件、HTTPS、证书有效期、merchant session TTL、validation URL 来源、缓存策略和错误脱敏；不能把 session 原文写日志。
- Apple Pay JS / PassKit 回调要覆盖 shipping/contact/coupon、取消、超时、浏览器不支持、重复授权、后台切换和授权后未 capture。
- 上线必须有 feature flag、PSP payment method 开关、降级支付方式、domain/bundle 配置回滚和已授权未完成订单的补偿策略。
- Recurring、reload、merchant token、订阅或自动充值任务必须另列 token 生命周期、用户授权、后续扣款和取消路径。
- 观测至少记录 merchant validation 成功率、sheet cancel rate、PSP decline、webhook delay、refund failed、domain verification failed。

### Web Apple Pay JS

- 查：Safari/secure context、ApplePaySession.canMakePayments、merchant domain association 文件、merchant validation endpoint、session 过期、PSP gateway 参数。
- 做：按钮只在可用时展示；onvalidatemerchant 走服务端；onpaymentauthorized 只提交 token；失败、取消和超时必须降级到其他支付方式。
- 验：域名文件可访问、merchant session 返回、金额币种一致、PSP sandbox 扣款、webhook 终态、无敏感日志。

### iOS / macOS PassKit

- 查：entitlement、merchant ID、team/bundle、supportedNetworks、merchantCapabilities、shipping/contact delegate、sandbox Apple ID、PSP mobile token 参数。
- 做：PKPaymentRequest 由服务端订单快照驱动；authorization 回调里不直接发货，只提交 token 并等待服务端结果。
- 验：设备支持、取消、失败卡、重复授权、后台切换、PSP 回调、订单终态和回滚路径。

### PSP Tokenization

- 查：PSP 是否支持 Apple Pay、gateway merchant id、processing channel、3DS/SCA、capture 模式、refund API、webhook secret。
- 做：服务端重新查询订单；幂等键绑定订单、金额、币种、用户和操作；PSP 原始错误脱敏映射成稳定业务错误。
- 验：成功、拒付、3DS step-up、重复请求、webhook 重放、部分退款、对账报表。

## 反例库

- Apple Pay 授权成功就发货，未等 PSP 服务端确认或 webhook 终态。
- 客户端直接传金额、币种、运费或折扣给 PSP，服务端不复核订单快照。
- merchant session、payment token、PSP secret、证书路径或完整错误体进入前端、日志、截图或客服工单。
- sandbox 能弹 sheet 就宣布上线，未验证 live merchant ID、domain association、PSP live 配置和降级开关。
- 自绘 Apple Pay 按钮或在能力检测失败时仍展示，造成品牌合规和失败体验问题。

## 输出要求

- 必须说明 Apple Pay 平台、PSP、环境、merchant ID/domain/bundle、订单状态机、token 传递路径、webhook 和退款对账边界。
- 必须列出已验证、未验证和阻断项；生产上线前必须给出 sandbox/live 配置分离和回滚方式。
- 不输出真实证书、私钥、payment token、PSP key、merchant session 原文、完整带 key URL 或用户支付敏感信息。

## 相邻技能边界

- StoreKit/IAP、苹果订阅和 App Store 通知转 Apple 开发或支付内购专项，不归 apple-pay。
- PSP 特定后端支付细节优先转 Stripe、Adyen、Checkout.com、Square、PayPal 等对应支付技能。
- Apple Wallet pass、.pkpass、票券会员卡不是资金支付，不能用本技能替代。