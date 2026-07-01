---
name: wallet-pass
description: Apple Wallet / Google Wallet pass 票券工程技能，覆盖 pkpass、issuer、class/object、签名、更新推送、撤销、核销、条码二维码和 pass 生命周期；涉及票券、会员卡、优惠券、登机牌或活动票开发时使用。
---

# Wallet Pass

Wallet Pass 负责 Apple Wallet 与 Google Wallet 的数字票券凭证工程。目标是把票券从“能打开”收敛为“类型正确、签名可信、生命周期闭环、更新可达、核销可追踪、撤销可验证”。

## 适用范围

- Apple Wallet passes、`.pkpass`、pass type identifier、team identifier、证书、manifest、签名、web service、push token、serial number。
- Google Wallet issuer、class、object、JWT save link、review、state、barcode、smart tap、issuer account 和 API 更新。
- 会员卡、优惠券、活动票、登机牌、交通票、门店卡、礼品卡、通用票券。
- 条码、二维码、Aztec、PDF417、NFC/Smart Tap、核销码、过期、暂停、撤销、补发、设备注册和更新推送。
- 票券后端、票券模板、字段映射、图片资源、品牌规范、国际化、审核、监控和客服可追溯。

## 不适用范围

- 站内余额、资金账户、充值、冻结、解冻、资金流水、账务对账；这些走 wallet-engineering。
- Apple Pay 或 Google Pay 支付、银行卡 token、支付授权、收单和退款；这些走对应支付技能。
- 普通用户“如何添加到钱包”的教程、客服答疑或纯营销说明。
- 只读概念学习、项目上手、仅识别 wallet 字样，没有票券实现、修改、调试、发布或审查动作。

## 铁律

1. pass 不是图片卡片；必须有明确类型、发行主体、唯一对象、生命周期、更新渠道和核销规则。
2. Apple pass 的签名、证书链、manifest hash、serial number、pass type identifier 和 team identifier 必须一致。
3. Google Wallet 的 issuer、class、object、state、review 状态和保存链接必须分层建模，不能把 class 当用户实例改。
4. 条码或二维码必须有过期、幂等、重放、防伪、离线策略和核销审计；不能只生成静态码就上线。
5. 更新推送要以设备注册、push token、对象版本和可重试队列为依据；前端刷新不能替代服务端更新。
6. 撤销、过期、退款、转让、补发和用户删除 pass 都要定义状态迁移和用户可见反馈。
7. 票券上所有个人信息、行程、会员等级、座位和订单号默认敏感；日志、截图和客服导出必须脱敏。
8. 未验证签名、保存、更新、核销、撤销、过期和异常重试，不报告 pass 链路完成。

## 强制流程

1. 识别票券类型：确认是会员卡、优惠券、登机牌、活动票、交通票还是通用票券，并记录平台、国家地区、语言和审核要求。
2. 建模主体：区分 issuer、class/template、object/pass instance、用户、订单、权益、核销点和设备注册。
3. 字段映射：列出展示字段、隐藏字段、条码 payload、序列号、状态、过期时间、地点、图片资源和后端来源。
4. 安全设计：确认签名证书、密钥存放、JWT 生成、短码/长码、重放窗口、离线核销和日志脱敏。
5. 生命周期：定义创建、保存、更新、暂停、过期、撤销、删除、补发、转让和退款后的状态变化。
6. 更新链路：设计 Apple web service / push、Google object update、失败重试、版本号、幂等和用户通知。
7. 核销链路：定义扫码设备、核销 API、幂等键、权限、离线同步、重复核销和人工冲正。
8. 验证发布：覆盖真机添加、不同钱包平台、签名校验、更新推送、撤销、核销、弱网、时区和审核证据。

## 场景执行卡

## 工程补强清单

- Apple PassKit Web Service 要覆盖设备注册、注销、按 pass type 查 serials、取最新 pass、update tag/version、APNs push、重试和鉴权失败。
- `.pkpass` 包要校验 pass.json 必填键、资源尺寸、manifest hash、signature、证书链、MIME、下载缓存和 iOS Console 错误。
- Google Wallet 要区分 issuer 权限、service account、class review、object state、save JWT claims、重复保存、撤销和过期同步。
- 条码/二维码要决定静态码、动态码或签名 payload；写清 HMAC/签名、过期窗口、离线回放、设备时钟漂移和跨门店权限。
- 发布前要有证书过期预警、旧 pass 更新失败、Google class 审核卡住、推送队列积压和撤销误伤恢复路径。
- 隐私字段分层：票面展示、hidden/back fields、barcode payload、客服导出和日志保留期分别列允许字段。

### Apple Wallet pkpass

- 查：pass type identifier、team identifier、证书有效期、WWDR、manifest、signature、serial number、webServiceURL 和 authenticationToken。
- 做：先生成稳定 pass.json 和资源，再生成 manifest hash 并签名；设备注册、更新和注销接口必须鉴权。
- 验：iOS 真机添加、签名失败、证书过期、资源缺失、push 更新、serial 重复和无 key 访问。

### Google Wallet

- 查：issuer ID、class ID、object ID、review 状态、service account、JWT claims、object state 和 barcode。
- 做：class 只放模板和公共规则，object 放用户实例；保存链接、API 更新和撤销使用同一对象状态。
- 验：save link、object 更新、class 审核、state 变化、账号权限、重复保存和过期展示。

### 核销与撤销

- 查：码值生成规则、核销点权限、订单状态、有效期、幂等键、设备 ID 和离线缓存。
- 做：核销必须原子化写入审计；撤销要同步钱包对象状态和后端权益状态。
- 验：重复扫码、过期扫码、撤销后扫码、离线回放、权限失败、跨门店核销和人工冲正。

## 低级错误清单

- 只生成卡面图或静态二维码，没有对象状态、签名、更新、撤销和核销审计。
- class/template 与 object/pass instance 混用，导致批量用户票券被错误更新。
- password、passkey、session pass、Apple Pay/Google Pay 支付按钮或站内余额任务误召本技能。
- 证书、JWT 私钥、authenticationToken、条码 payload 或个人信息进入日志、截图或客服导出。
- 只在桌面预览成功，未真机保存、更新、撤销、核销和过期验证。

## 输出要求

- 输出票券类型、平台差异、issuer/class/object 或 pass/serial 模型、字段映射、状态机、更新链路和核销链路。
- 明确证书、密钥、JWT、码值、个人信息和日志脱敏边界。
- 验证结果必须包含保存、更新、撤销、核销、过期和异常重试；未跑就写未验证。

## 反例

- 只说“做个钱包”但实际是余额、资金账户或流水。
- 只上传一张卡面图，没有签名、对象状态、核销和更新设计。
- 只做 Apple Pay/Google Pay 支付按钮。
- 仅 README、目录名、依赖出现 wallet/pass，没有明确票券动作。