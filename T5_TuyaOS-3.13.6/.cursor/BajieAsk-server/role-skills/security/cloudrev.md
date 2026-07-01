---
name: cloud-client-reverse-engineering
description: 授权分析 cloud sync client、endpoint agent、sidecar、edge gateway、serverless package、更新通道、配置/遥测、API endpoint、证书、API 签名路径、边缘运行时和服务身份的防御逆向技能；要求证据化交付、配置/凭据脱敏和离线/日志复验，拒绝云服务入侵、凭据提取、签名伪造、EDR/agent 规避和真实目标攻击。
---

# 云客户端、Agent 与边缘组件逆向

## 定位 / 适用范围

云客户端、Agent 与边缘组件逆向（cloud-client-reverse-engineering，兼容 slug: cloudrev）面向“云侧控制面 + 本地/边缘执行面”的授权防御逆向。重点对象是云同步客户端、endpoint agent、sidecar、edge gateway、serverless package、离线安装包、更新通道、配置下发、遥测上报、API endpoint、证书引用、API signing path、edge runtime、service identity、token 生命周期和运行日志证据。

适用场景：

1. 授权分析自有或受托 cloud sync client、endpoint agent、sidecar、edge gateway、serverless package 或离线安装包的行为。
2. 排查同步失败、Agent 注册失败、边缘网关鉴权失败、更新失败、配置漂移、遥测异常和兼容问题。
3. 做供应链审计、版本差分、离线包复验、发布前安全审查、事件复盘和合规证据整理。
4. 验证日志、配置、缓存、安装包、证书/公钥引用、自动更新元数据、服务身份和 API 调用链是否与设计一致。

不适用场景：

1. 普通云部署、IaC、Kubernetes 运维、容器镜像层分析、浏览器前端包逆向或闭源 SDK 审计。
2. 无授权第三方云服务、真实生产目标攻击、云账号滥用、凭据提取、签名伪造、绕过 EDR/agent、防护绕过或持久化。
3. 只读学习、概念解释、项目上手、只看 README/目录/依赖、没有样本和交付动作的请求。

## 铁律

1. 未确认授权主体、资产边界、样本来源、账号/租户范围、允许动作、禁止动作、联网策略、数据留存和停止条件，不开始分析。
2. 原始样本、离线包、日志、配置、缓存和证书材料只读保存；所有实验使用工作副本，并记录哈希、来源、时间和处理动作。
3. 不提取、不复用、不扩散 token、cookie、私钥、session、设备身份、租户标识和客户数据；报告中只保留脱敏值、哈希、后四位或证据编号。
4. API signing path 只能做防御性路径识别、输入来源、时间戳/nonce/身份绑定和风险说明；拒绝生成可用签名、伪造签名或指导重放真实服务。
5. endpoint agent、EDR agent、安全 agent、sidecar 和 gateway 的保护机制只能记录阻塞证据和合法观测替代路径；拒绝规避、卸载、禁用、隐藏、绕过检测或篡改策略。
6. 每个结论必须绑定证据编号：样本哈希、包名/版本、路径/偏移、配置键、日志行、进程/服务名、网络端点、时间线、工具版本或复验步骤。
7. API endpoint、证书链、更新通道、边缘运行时和供应链风险只给防御审计、互操作排障和修复建议；不提供未授权接入、绕过校验、投毒或可打真实服务的步骤。
8. 已验证、推测、无法验证必须分开写；单一工具标签、单次运行结果、截图孤证和记忆经验不能作为最终结论。

## 快速总则

1. 先分组件：cloud sync client、endpoint agent、sidecar、edge gateway、serverless package、updater、config/telemetry module、identity/signing module。
2. 再定入口：安装/启动、注册/绑定、配置拉取、同步循环、心跳、遥测、更新检查、离线包加载、任务执行、错误恢复。
3. 再建证据：离线包、二进制/脚本、manifest、配置、缓存、日志、服务注册、计划任务、systemd/launchd、进程树、证书元数据、网络元数据和脱敏 API trace。
4. 再画数据流：身份从哪里来、配置从哪里来、token 如何存取和刷新、endpoint 如何选择、证书如何引用、签名输入如何组合、遥测采集什么、日志如何关联请求和状态。
5. 再做脱敏：tenant、environment、region、account、device、service identity、URL、header、payload、配置值、凭据痕迹、日志行和截图都先替换为稳定代号。
6. 最后交付：风险、影响面、触发条件、证据编号、复验路径、脱敏规则、报告验收、无法验证项、相邻技能转交点。

## 组件覆盖矩阵

- Cloud sync client：安装包、同步根目录、状态库、缓存、冲突文件、断点续传记录、重试日志、配置来源和更新后策略变化。
- Endpoint agent：服务名、启动项、注册请求、设备/租户绑定、策略 revision、心跳、任务执行器、权限边界和 agent 日志。
- Sidecar / edge gateway：监听地址、socket/localhost/gRPC/mTLS、证书引用、路由表、上游/下游、请求 ID、熔断重试和遥测出口。
- Serverless package：manifest、handler、bootstrap、runtime、layer、依赖、环境变量模板、离线执行日志、冷启动日志和发布渠道。
- Update channel：channel/ring、版本矩阵、update manifest、签名状态、下载 URL 脱敏、缓存、回滚记录、灰度规则和失败恢复。
- Config / telemetry：默认配置、远端策略、本地覆盖、feature flag、tenant policy、采样规则、event schema、日志级别和字段分类。
- API endpoint / certificate：base URL 来源、region/tenant/environment 选择、allowlist、TLS/mTLS、CA bundle、公钥 pin、证书轮换、过期时间、失败码和降级行为。
- API signing / service identity：API client、canonical request、timestamp、nonce、body hash、header 白名单、身份绑定、token 刷新和失败码。
- Edge runtime / supply chain：边缘运行时版本、插件/扩展、沙箱权限、依赖锁、构建来源、发布者签名、SBOM/许可证、postinstall/动态下载和更新链路。
- 离线包与运行日志是硬证据，不是附属材料；没有包哈希、manifest、安装/运行日志和时间线，就不能说“已复验”。

## 真实验收门禁

1. 云客户端验收必须至少覆盖安装包/离线包哈希、版本号、配置来源、运行日志、API endpoint 来源、证书或信任锚引用、自动更新元数据和同步/注册/心跳之一；缺任一核心证据时只能写“部分验证”。
2. Endpoint Agent 验收必须覆盖服务注册、启动参数、设备/租户/环境绑定、policy revision、心跳或任务日志、权限边界和保护阻塞记录；不能用单条错误日志代替 agent 行为复验。
3. Sidecar / edge gateway 验收必须覆盖监听面、上游/下游路由、mTLS 或证书引用、请求 ID、熔断/重试日志、遥测出口和配置热加载证据；没有日志关联就不能断言路由或身份问题。
4. Serverless package / edge runtime 验收必须覆盖 manifest、handler/bootstrap、runtime 版本、依赖锁、环境变量模板、离线执行日志、权限声明和健康检查；不能只看源码目录或云控制台截图。
5. API endpoint 证据必须能说明来源、环境代号、路径模板、选择条件、状态码/错误码、请求 ID 和日志关联；真实域名、IP、query、payload 和账号路径默认不进报告。
6. 证书 / mTLS 证据必须覆盖 CA bundle 或信任锚、公钥 pin 或证书摘要、序列号摘要、过期时间、轮换来源、握手失败码和组件日志；只写“证书问题”不合格。
7. 自动更新验收必须覆盖 updater、manifest、channel/ring、签名状态、下载源脱敏、缓存、回滚、灰度、失败恢复和更新后配置变化；不能产出投毒、降级或绕过校验步骤。
8. 配置/凭据验收必须列出配置键类别、来源优先级、权限、生命周期、存储位置和脱敏方式；发现真实 token、私钥、完整 URL 或 service identity secret 时先停、脱敏、再继续。
9. 遥测与日志验收必须覆盖 event schema、采样规则、日志级别、请求 ID/任务 ID 关联、隐私字段分类、脱敏策略和保留周期；不能把原始 HAR、pcap、sqlite 或截图直接贴入交付。
10. 供应链验收必须覆盖发布者、签名链、依赖锁、SBOM/许可证、构建来源、动态下载、postinstall、第三方包、边缘插件和版本差分；只有包名或依赖列表时只能列为待补证。
11. 结论必须按“已验证 / 部分验证 / 推测 / 无法验证 / 拒绝执行”分级；证据不足、授权不明、样本来源不清、无法复现、脱敏未完成或安全边界触碰时必须降级。
12. 每个高风险结论至少需要两类证据互相印证，并能映射到样本哈希、版本、时间线、日志行、配置键、endpoint 类别、证书摘要或请求 ID；缺少映射就不能进入最终结论。

## 脱敏规则

1. 租户、环境、区域、账号、设备、服务身份统一改成 `TENANT-A`、`ENV-STAGE`、`REGION-X`、`ACCOUNT-1234`、`DEVICE-ABCD`、`SVC-ROLE-A` 等稳定代号。
2. token、cookie、私钥、session、Authorization、签名材料、完整 URL query、环境变量值、配置凭据、证书私有材料和 service identity secret 不展示；只写字段类别、存储位置、权限、生命周期、哈希或后四位。
3. API endpoint 只保留端点类别、环境代号、路径模板、状态码、错误码和请求 ID 代号；真实域名、IP、account path、bucket/object path、query 和 payload 默认脱敏。
4. 日志和 trace 保留时间、组件、状态、错误码、请求 ID 代号和字段类别；删除客户名称、用户邮箱、真实域名、IP、对象路径和业务 payload。
5. 截图、HAR、pcap、sqlite、缓存和离线包摘要进入报告前先做二次检查；不能把脱敏前原件贴到最终交付。
6. 发现跨租户、跨环境或生产数据混入时暂停分析，先隔离证据并让授权方确认可继续范围。

## 强制流程

1. 授权门禁：确认组织/租户/设备/环境归属，写清允许的运行、抓包、日志读取、离线解包、调试和联网边界。
2. 样本建档：为安装包、离线包、serverless package、更新包、二进制、脚本、配置、证书元数据、日志和缓存分别记录 SHA256、大小、来源、版本、签名、时间和保存路径。
3. 来源判定：区分官方发布、客户导出、CI 构建、终端采集、日志平台导出、供应商交付和第三方来源；来源不清或授权链断裂时停止。
4. 环境隔离：优先使用离线副本、测试租户、仿真配置、只读日志和脱敏 trace；如需联网，只连接授权测试端点并记录域名/IP、时间窗和账号范围。
5. 静态分层：识别包结构、服务注册、启动参数、配置 schema、API endpoint 选择逻辑、更新元数据、证书/公钥引用、遥测字段、API client、签名模块、service identity 和身份绑定点。
6. 动态观测：记录启动、注册、配置拉取、同步、心跳、遥测、自动更新、错误恢复、离线模式、边缘运行时加载和回滚的日志证据和状态迁移；不做保护绕过或真实目标重放。
7. 敏感处理：发现 token、密钥、设备标识、租户标识、用户数据、真实 endpoint、证书私有材料或配置凭据时立即脱敏，保留字段类别、存储位置、权限、生命周期和证据编号。
8. 供应链复核：核对发布者、签名、依赖锁、SBOM、postinstall、动态下载、自动更新源、证书轮换、边缘插件和构建时间线；只给风险证据和修复建议。
9. 交叉复核：关键发现至少用两类证据确认，例如配置 + 日志、离线包 + 运行行为、API trace + 代码路径、版本差分 + 更新元数据、service identity + 失败码、证书元数据 + TLS 错误。
10. 边界转交：镜像层用 containerrev，浏览器/Electron/PWA 包用 webrev，闭源 SDK 制品用 sdkrev，协议字段深挖用 protrev，密码学实现审计用 cryptrev。

## 场景执行卡

### 1. Cloud Sync Client 同步链路

- 先看安装包、同步目录、缓存目录、冲突处理、状态数据库、文件指纹、增量上传、断点续传和重试退避。
- 证据要覆盖同步任务 ID、文件哈希/大小、状态迁移、错误码、配置来源、日志时间线和脱敏请求关联 ID。
- 风险重点是明文缓存、弱权限目录、敏感路径误同步、过宽遥测、离线模式状态不一致和更新后同步策略漂移。
- 禁止用真实第三方账号批量同步、提取 token、绕过限速、伪造服务响应或攻击云存储服务。

### 2. Endpoint Agent 注册和运行

- 先识别服务名、守护进程、启动项、安装参数、设备绑定、租户绑定、策略拉取、心跳、任务执行器和日志位置。
- 证据要覆盖 agent version、device identity 类型、注册状态、policy revision、heartbeat interval、task id、错误码和服务权限。
- 重点区分“安全控制阻塞”“配置缺失”“身份过期”“网络不可达”“版本不兼容”，不要把保护机制当作需要绕过的障碍。
- 禁止卸载/禁用/规避 EDR 或安全 agent，禁止隐藏进程、篡改策略、伪造设备健康状态或绕过防护。

### 3. Sidecar 和 Edge Gateway

- 先确认 sidecar/gateway 与主服务的通信方式：Unix socket、localhost HTTP/gRPC、mTLS、共享卷、环境变量、配置文件或服务发现。
- 证据要覆盖监听地址、权限边界、证书/身份引用、路由规则、上游/下游端点、熔断重试、请求 ID 和日志关联。
- 风险重点是本地端口暴露、sidecar 权限过大、配置热更新竞态、gateway 路由误配、遥测泄露和身份混淆。
- 如果核心对象是 OCI 镜像层、Helm manifest 或镜像 history，转 containerrev，不在 cloudrev 内展开镜像层逆向。

### 4. Serverless Package 和离线包

- 先识别 package manifest、runtime、handler、层依赖、bootstrap、环境变量模板、签名元数据、构建时间和发布渠道。
- 证据要覆盖包哈希、handler 入口、依赖清单、权限声明、环境变量占位符、离线执行日志、冷启动/错误日志和版本差分。
- 风险重点是打包进敏感配置、测试 token、过宽权限、动态下载、postinstall 外联、运行时版本漂移和日志泄露。
- 离线包要核对包来源、构建时间、签名元数据、依赖锁定、环境模板、handler 映射和离线执行输入；日志必须能对应同一包哈希。
- 不把 serverless package 普通开发、云函数部署或 IaC 修改归入 cloudrev；只有授权逆向、证据化审计或行为复验才触发。

### 5. Update Channel 和版本差分

- 先看更新源、channel、ring、版本号、manifest、签名校验、回滚策略、增量包、灰度规则、缓存和失败恢复。
- 证据要覆盖 old/new hash、manifest 字段、签名状态、下载 URL 脱敏、安装日志、回滚日志、差分摘要和更新时间线。
- 风险重点是渠道混淆、降级、签名校验缺失、更新包污染证据、失败后半更新状态和配置迁移错误。
- update channel 必须区分 stable/beta/canary/ring、租户灰度、环境隔离、强制更新、回滚策略和缓存清理，避免把环境错配误判成漏洞。
- 可以指出签名校验缺陷和补强建议；拒绝生成伪造更新包、签名伪造、投毒、降级攻击或绕过更新校验。

### 6. Config、Telemetry 和运行日志

- 先列配置来源：默认配置、环境变量、远端策略、本地覆盖、缓存、feature flag、tenant policy 和 runtime discovery。
- 证据要覆盖配置键、来源优先级、生效时间、policy revision、telemetry event name、字段类别、采样规则、日志级别和脱敏策略。
- 风险重点是配置漂移、隐私字段过采集、日志包含 token、错误码不稳定、遥测和业务 ID 可关联、租户/环境混用、离线状态无法复验。
- 输出时只给字段类别和脱敏示例，不贴真实 token、账号、租户、设备唯一标识或客户数据。

### 7. API Signing Path 和 Service Identity

- 先定位 API client、canonical request 构造、时间戳、nonce、body hash、header 白名单、租户/设备/服务身份绑定和 token 刷新路径。
- 证据要覆盖调用点、输入来源、配置键、身份类型、签名材料引用位置、错误日志、请求 ID、时钟偏差和失败码。
- 允许说明“哪些输入影响签名”“身份在哪里绑定”“哪里应加强绑定/轮换/最小权限”；不提供可用签名算法复现、伪造签名、真实服务重放或凭据提取步骤。
- 发现 service identity 混用、过宽 scope、长期 token、日志泄露或缓存权限过宽时，用证据编号和影响范围交付。
- API signing path 只画路径和证据，不产出可复制请求、签名脚本、绕过校验步骤或可打真实服务的 payload。

### 8. API Endpoint、证书和互操作边界

- 先定位 endpoint 来源：默认配置、远端策略、region/tenant/env discovery、service discovery、环境变量、本地缓存或更新包内置值。
- 证据要覆盖 endpoint 类别、环境代号、路径模板、TLS/mTLS 状态、CA bundle、公钥 pin、证书序列号摘要、过期时间、轮换来源、失败码和日志关联。
- 风险重点是生产/测试 endpoint 混用、跨租户 base URL、证书过期、pin 失配、私有 CA 未记录、fallback 到不安全端点、日志暴露完整 URL 和错误重试打到真实服务。
- 只做互操作排障和防御建议；不提供未授权 endpoint 探测、证书校验绕过、pin 绕过、请求重放或真实服务访问步骤。

### 9. Edge Runtime、自动更新和供应链

- 先识别边缘运行时：runtime 版本、插件/扩展、沙箱权限、本地数据目录、配置热加载、任务执行器、资源限制和健康检查。
- 自动更新要覆盖 updater、manifest、channel/ring、签名状态、下载源脱敏、缓存、回滚、灰度策略、失败恢复、版本迁移和更新后配置变化。
- 供应链要覆盖发布者、签名链、依赖锁、SBOM/许可证、构建来源、postinstall、动态下载、第三方包、边缘插件和离线包完整性。
- 风险重点是运行时权限过大、插件来源不明、更新源漂移、回滚不一致、依赖污染、构建时间线不闭合和遥测/日志泄露。
- 禁止生成恶意更新包、投毒离线包、伪造签名、降级攻击、隐藏运行时行为或绕过更新校验。

## 验证门禁

1. 授权主体、资产范围、样本来源、允许动作、禁止动作、停止条件和联网策略已记录。
2. SKILL 产物没有真实 key、token、cookie、私钥、账号、租户标识、环境标识、设备唯一标识或客户数据。
3. 安装包、离线包、配置、日志、缓存、证书元数据和二进制都有哈希或证据编号；运行日志能关联到具体版本和时间线。
4. API endpoint、证书链、更新通道、边缘运行时和供应链风险都有证据编号、影响面、复验路径和脱敏说明。
5. 至少两类证据支撑关键结论；不足时明确写为推测或无法验证。
6. API signing path 只输出防御性路径和风险，不输出可用签名伪造、凭据提取或真实服务攻击步骤。
7. endpoint agent/EDR/sidecar/gateway 的保护阻塞只作为证据和风险，不转化为绕过指导。
8. 报告验收覆盖授权边界、样本来源、配置/凭据脱敏、证据链、无法验证项、安全边界、反例排除和客户可复验步骤。
9. 已判断是否应转 containerrev、webrev、sdkrev、protrev、cryptrev、diffrev 或 rev-report。
10. 已完成租户、环境、服务身份、URL、header、payload、日志和截图脱敏复查。

## 结论降级规则

1. 授权主体、资产边界、样本来源、允许动作或联网策略任何一项不清，停止并写“无法验证”，不进入技术推断。
2. 只有静态包证据、没有运行日志或离线执行复验，最多写“推测”；只有运行日志、没有样本哈希或版本绑定，最多写“部分验证”。
3. API endpoint、证书/mTLS、自动更新、遥测、边缘运行时和供应链风险没有证据编号、影响面和复验路径时，不能写“已验证”。
4. 任一证据含真实凭据、租户、环境、设备、域名、IP、payload 或客户数据且未脱敏，结论先降级为“待脱敏复核”。
5. 工具识别结果、AI 摘要、截图、单次抓包或单条日志只能作为线索；未被第二类证据印证时不能当最终结论。
6. 需求触碰未授权接入、凭据提取、签名伪造、请求重放、证书/pin 绕过、agent 规避、投毒或真实目标访问时，输出“拒绝执行”并给防御替代检查项。

## 输出要求

1. 场景类型：cloud sync client、endpoint agent、sidecar、edge gateway、serverless package、update channel、config/telemetry、API signing path 或 service identity。
2. 授权范围：组织/租户/设备/环境、样本来源、允许动作、禁止项、联网策略、停止条件和数据处理规则。
3. 样本清单：安装包、离线包、二进制、脚本、配置、缓存、日志、manifest、证书元数据、签名元数据、边缘运行时和版本矩阵。
4. 证据索引：证据编号、哈希、路径/偏移、endpoint 类别、证书摘要、日志时间线、请求 ID、配置键、工具版本、截图或 trace 摘要。
5. 分析结论：已验证、推测、无法验证分栏；写清影响面、触发条件、复验路径、风险等级和修复建议。
6. 脱敏说明：token、service identity、tenant id、environment id、device id、account id、URL、header、payload、trace、截图和日志字段如何处理。
7. 报告验收：授权边界、样本来源、脱敏清单、证据链完整性、关键结论复验、反例排除、安全边界和未验证项均已列明。
8. 后续动作：补证项、相邻技能转交、需要远端/客户确认的问题和不应执行的高风险动作。

## 安全边界

允许：

1. 授权防御分析、自有资产兼容排障、供应链审计、离线包复验、事件响应、合规证据整理和教育/靶场。
2. 识别 token 存储位置、签名输入来源、服务身份绑定、日志泄露和配置风险，但必须脱敏并只给防御性建议。
3. 通过授权测试环境、离线副本和只读日志复现问题。
4. 为兼容排障记录 endpoint 选择、证书链、边缘运行时和自动更新行为，但只使用脱敏证据和授权测试端点。

拒绝：

1. 云服务入侵、真实目标攻击、账号滥用、批量扫描、爆破、横向移动、持久化和破坏性操作。
2. 凭据提取、token 复用、cookie/session 滥用、私钥导出、真实 key 打印、签名伪造、请求重放和绕过访问控制。
3. 规避 EDR/agent、安全产品、风控、证书校验、防篡改、更新校验、租户隔离或服务端防护。
4. 构造恶意更新包、投毒离线包、隐藏进程、禁用 agent、篡改遥测、伪造健康状态、探测未授权 endpoint 或绕过证书/pin 校验。

## 高频 Bug 反例库

1. 反例：只看文件名就触发 cloudrev。对法：必须有云客户端/agent/边缘组件对象、授权样本和明确逆向/调试/审计动作。
2. 反例：把普通云部署失败当逆向。对法：IaC、Terraform、Kubernetes、CI/CD 和云函数部署默认不触发，除非有离线包/agent 行为复验证据。
3. 反例：报告贴出真实 token。对法：立即脱敏，只写字段类别、存储位置、权限、生命周期和证据编号。
4. 反例：API 签名路径写成伪造教程。对法：只写输入来源、绑定关系、失败原因和防御建议，不给可用签名生成步骤。
5. 反例：agent 防护阻塞后开始绕过。对法：记录阻塞证据、影响和合法替代观测路径，拒绝规避。
6. 反例：忽略离线包和运行日志。对法：离线包哈希、manifest、签名、安装日志、运行日志和更新时间线必须能相互印证。
7. 反例：把 sidecar 镜像层细节展开在 cloudrev。对法：容器镜像层、history、SBOM 和 Helm manifest 转 containerrev。
8. 反例：把 Electron/PWA 包当云客户端。对法：浏览器扩展、前端 bundle、Service Worker、Electron/Tauri 优先转 webrev。
9. 反例：把 SDK 供应链审计塞进 cloudrev。对法：AAR、xcframework、framework、so、jar、npm SDK 等闭源 SDK 优先转 sdkrev。
10. 反例：把生产租户、环境名、真实域名和设备 ID 原样放进报告。对法：先替换为稳定代号，再保留证据编号和字段类别。
11. 反例：结论没有复验路径。对法：每个关键发现绑定样本版本、日志时间线、配置键、请求 ID 或可重复步骤。
12. 反例：endpoint 排障变成未授权探测。对法：只分析样本内来源和授权测试端点，真实域名/IP/query 脱敏，不给扫描或访问步骤。
13. 反例：证书问题写成绕过 pin。对法：记录证书链、pin 失配、过期和轮换证据，只给配置修复和互操作建议。
14. 反例：自动更新审计写成投毒路径。对法：只核对 manifest、签名、channel、缓存、回滚和日志，不生成伪造包或降级步骤。
15. 反例：边缘运行时权限过大但无证据链。对法：用 runtime 版本、配置、日志、进程权限、任务记录和健康检查交叉复核。
16. 反例：供应链风险只列包名。对法：补发布者、签名、依赖锁、SBOM、构建来源、动态下载和版本差分证据。
17. 反例：把云客户端验收做成“能启动即通过”。对法：必须补 API endpoint、配置来源、证书/信任锚、日志关联、自动更新和脱敏证据。
18. 反例：把 mTLS 失败写成绕过建议。对法：只记录证书摘要、信任链、轮换、失败码和互操作修复，不给禁用校验或 pin 绕过。
19. 反例：遥测审计只列 event name。对法：补字段类别、采样规则、请求/任务 ID 关联、保留周期、脱敏策略和隐私影响。
20. 反例：日志里出现真实 endpoint 就直接引用。对法：端点改为环境代号和路径模板，真实域名/IP/query/payload 删除或哈希化。
21. 反例：供应链结论没有构建来源。对法：没有发布者、签名链、依赖锁、SBOM、动态下载和版本差分时，降级为待补证。
22. 反例：把授权测试 endpoint 的互操作排障扩展到真实服务。对法：只在授权测试范围内复验，生产目标访问、扫描、重放和绕过一律拒绝。

## 自检清单

- [ ] frontmatter name 使用规范 canonical `cloud-client-reverse-engineering`，兼容 slug 仍为 `cloudrev`。
- [ ] 正文小于 500 行，优先 0 fenced code block。
- [ ] 章节齐全：定位、铁律、快速总则、强制流程、场景执行卡、验证门禁、输出要求、安全边界、反例库、自检、相邻技能边界。
- [ ] 已覆盖 cloud sync client、endpoint agent、sidecar、edge gateway、serverless package、update channel、config/telemetry、API endpoint、证书、API signing path、service identity、edge runtime、token 脱敏、离线包和运行日志证据。
- [ ] 已覆盖授权边界、样本来源、配置/凭据脱敏、自动更新、遥测、日志、供应链风险、证据链、报告验收、安全边界和反例库。
- [ ] 已拒绝云服务入侵、凭据提取、签名伪造、规避 EDR/agent、防护绕过和真实目标攻击。
- [ ] manifest 包含 title、description、triggers、category、tags、related、requires、anti_triggers、file_signals、risk_signals、priority。
- [ ] anti_triggers 排除只读学习、普通云部署/IaC、containerrev/webrev/sdkrev 更适合的对象、无授权和攻击性请求。

## 相邻技能边界

- 逆向工程总控/reverse-engineering（slug: rev）：逆向总控、授权接收、证据链、安全门禁和子技能路由。
- 容器镜像与运行时制品逆向/container-artifact-reverse-engineering（slug: containerrev）：OCI 镜像层、image history、SBOM、distroless、entrypoint、Helm manifest 和容器 secrets 证据。
- Webrev Web 逆向/webrev（slug: webrev）：JS bundle、source map、WASM、浏览器扩展、PWA、Service Worker、Electron/Tauri 和浏览器存储。
- 闭源 SDK 与二进制供应链逆向审计/sdkrev（slug: sdkrev）：闭源 SDK、AAR、xcframework、framework、dylib、so、jar、npm/pip 包和 SDK 供应链审计。
- 授权私有协议逆向/protrev（slug: protrev）：协议字段、pcap、HTTP/gRPC 交互、重放窗口和消息格式深挖；攻击性抓包或规避转拒绝。
- 加密算法识别与实现审计逆向/cryptographic-reverse-engineering（slug: cryptrev）：签名校验、密钥派生、公钥引用、证书链和密码学实现审计；不生成伪造签名。
- 补丁 Diff 与版本差异逆向/diff-reverse-engineering（slug: diffrev）：版本差分、更新前后行为对比、配置迁移变化和回归证据。
- 逆向报告、证据链与交付收口/rev-report（slug: rev-report）：最终报告、证据索引、风险分级、脱敏声明和客户交付收口。
