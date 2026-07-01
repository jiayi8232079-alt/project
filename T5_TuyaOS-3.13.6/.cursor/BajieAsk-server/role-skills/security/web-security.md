---
name: web-security
description: Web Security实战排障版 - 覆盖授权范围、资产入口、威胁建模、证据闭环、OWASP Top 10 2021/2024、OWASP API Security、ASVS、认证授权、Session/Cookie、CSRF SameSite、XSS、CSP/Trusted Types、SQL/NoSQL/SSTI、SSRF 云元数据、RCE、文件上传、路径穿越、反序列化、CORS、JWT、OAuth/OIDC、BOLA/IDOR、GraphQL、WebSocket、供应链、secret scanning、日志取证、漏洞复现与修复验证。仅服务授权测试、防御、教育与 CTF；拒绝破坏、DoS、逃避检测、未授权利用和凭证窃取。
alwaysApply: false
---

# Web Security实战排障版

> 定位：把 Web/API/浏览器安全从漏洞名清单收敛成资产、入口、威胁、证据、复现、修复、回归、发布边界可复核的闭环。
> 铁律：只处理授权测试、防御、教育和 CTF；授权不清只做静态审计与防御建议。禁止批量扫描、DoS、绕过检测、持久化、凭证窃取、数据破坏、未授权利用或可直接滥用的攻击链。

## 快速总则：资产 / 入口 / 威胁 / 证据

1. 资产：先列域名、API、后台、管理端、WebView、对象存储、CDN、网关、SSO、第三方回调、环境、版本、账号角色、租户和授权边界。
2. 入口：按路由、中间件、认证守卫、GraphQL resolver、WebSocket 握手、文件处理、URL 拉取、模板渲染、SQL/NoSQL、日志、CI/CD 和发布配置追真实入口。
3. 威胁：先建 subject、tenant、object、action、data flow、trust boundary，再判断 OWASP Top 10 2021/2024、API Security、ASVS、供应链和浏览器风险。
4. 证据：每条结论绑定入口、条件、请求/响应摘要、代码/配置位置、日志/trace、影响对象、修复点和复验路径；未读不引，未跑不报。
5. 最小影响：生产默认不做高影响验证；复现样本要低权限、低数据量、可回滚、可脱敏。
6. 最小披露：Cookie、JWT、Authorization、session、client_secret、验证码、个人数据、admin key 只写类型、位置、掩码、哈希或指纹。
7. 修复闭环：证明旧路径被阻断、同类入口已查、正常业务仍可用、日志已脱敏、告警可见、灰度和回滚风险已说明。

## 场景执行卡

### 1. 资产、授权与威胁建模

- 输入：授权书、资产清单、账号角色、时间窗口、环境、禁止项、流量上限、数据脱敏要求、第三方边界。
- 动作：画出用户/租户/服务/第三方/云资源之间的信任边界，标出公网、内网、管理端、回调、上传、导出、对象存储、CI/CD 入口。
- 验证：授权缺口、生产影响、第三方数据、速率限制、测试账号隔离、审计日志留痕。
- 证据：资产编号、入口列表、角色矩阵、版本/平台/框架/运行环境差异、未覆盖范围。

### 2. 认证、授权、会话与租户隔离

- 输入：登录方式、MFA、Passkeys/WebAuthn、RBAC/ABAC、Session、Cookie、JWT、OAuth/OIDC、旧客户端、管理员入口。
- 动作：核认证状态、对象归属、tenant、role、scope、服务间身份、token 生命周期、撤销、刷新、登出失效、权限缓存。
- 验证：未登录、低权限、跨租户、角色切换、批量混入、旧 token、可信 header 清洗、Cookie SameSite/Secure/HttpOnly/Domain/Path。
- 证据：subject、tenant、object、action、decision、token claim 摘要、Cookie 属性、审计日志脱敏结果。

### 3. OWASP Top 10 2021/2024 与 API Security 基线

- 用 OWASP Top 10 2021、OWASP API Security、ASVS 和 2024 相关专题做检查框架，不把标准名当结论。
- Broken Access Control：BOLA、IDOR、越权、管理接口、导出下载、批量接口、GraphQL resolver 和对象存储下载逐项验权。
- Injection：SQL、NoSQL、命令、SSTI/模板、LDAP、路径穿越、表达式注入；字段名、排序、过滤、聚合必须 allowlist。
- Security Misconfiguration：CORS、CSP、安全头、调试模式、默认账号、错误详情、云存储公开、依赖版本、网关头信任边界。
- Software and Data Integrity Failures：依赖、构建插件、CI/CD、SBOM、签名、provenance、AI 生成代码和 secret scanning 联动 devsecops。

### 4. CSRF、XSS、CSP、Trusted Types 与浏览器边界

- CSRF：所有自动携带 Cookie 的状态变更接口校验 Origin/Referer 与 CSRF token；SameSite 只是纵深防御。
- XSS：区分 Stored、Reflected、DOM、Markdown/富文本、模板注入；按 HTML、属性、URL、JS、CSS 上下文编码。
- CSP：先 Report-Only 收证据，再阻断；nonce/hash 优先，限制 strict-dynamic 风险，避免 unsafe-inline 和宽泛通配。
- Trusted Types：现代前端对 DOM XSS 高风险 sink 设策略，验证第三方 SDK、A/B、客服、支付脚本兼容。
- 安全头：HSTS、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、frame-ancestors、敏感响应 Cache-Control。

### 5. CORS、跨站 Cookie、SSO 与 OAuth/OIDC

- CORS：精确 Origin allowlist；禁止反射任意 Origin，禁止 credentials 搭配星号；CORS 不是授权。
- Cookie：核 SameSite=None 必须 Secure，第三方 Cookie 变化、CHIPS、Storage Partitioning、Safari ITP 对 SSO、嵌入页和 CSRF 的影响。
- OAuth/OIDC：校验 redirect_uri 精确匹配、state、nonce、PKCE、iss、aud、azp、jti、token 绑定、回调域名和开放重定向。
- JWT/JWK：固定 algorithms，校验 iss/aud/exp/nbf/iat/tenant/scope，kid allowlist，限制 JKU/X5U，JWKS 缓存和轮换有证据。

### 6. SSRF、URL 拉取、云元数据与 egress

- 入口：URL 预览、webhook、PDF/HTML 渲染、图片代理、导入、OAuth metadata、SSO discovery、存储同步、爬虫。
- 动作：校验 scheme、规范化 URL、解析后 IP、每跳重定向、DNS rebinding、IPv6、混淆 IP、URL parser 差异、超时、大小、响应类型。
- 防护：阻断云 metadata、内网网段和 link-local；配 egress allowlist、代理隔离、IMDSv2/云厂商 metadata 防护和告警。
- 证据：最终连接目标、DNS 解析链、重定向链、拦截日志、云环境差异、正常业务 allowlist。

### 7. 注入、SSTI、RCE、文件上传与反序列化

- SQL/NoSQL：值用 bind；动态表名、字段、排序、LIKE、IN、分页、聚合和 JSON 查询用 allowlist；过滤 $、.、操作符和类型混淆。
- SSTI/RCE：模板、表达式、插件、脚本、文件解析器、命令执行和反序列化 gadget 只给防御审计、低影响复现摘要和修复验证。
- 文件上传：扩展名、MIME、magic number、大小、尺寸、页数、压缩层级、重命名、私有桶、预签名 URL、下载鉴权、病毒扫描、内容转换。
- 路径穿越：规范化后校验根目录，阻断 ../、编码、软链、zip slip、对象存储 key 穿越。
- 反序列化：禁不可信对象反序列化；JSON/XML/YAML 关闭危险类型、XXE、任意 class；DTO allowlist 防 mass assignment。

### 8. GraphQL、WebSocket、SSE 与长连接

- GraphQL：入口认证不等于字段授权；resolver 按对象和字段验权，限制 depth、complexity、alias、batch、introspection、error detail 和 DataLoader 泄露。
- WebSocket：握手认证、Origin 校验、token 续期/撤销、频道订阅授权、租户隔离、消息 schema、重放、心跳、断线恢复和背压。
- SSE/streaming：鉴权、断线重连、last-event-id、缓存、敏感片段、日志脱敏和前端错误处理。
- 证据：握手摘要、订阅主题、subject/tenant/channel、消息类型、拒绝日志、限流和正常路径。

### 9. 日志取证、依赖供应链与发布验证

- 日志取证：Authorization、Cookie、Set-Cookie、JWT、password、验证码、PII、client_secret、API key 禁止明文落盘或进入 APM/trace/prompt。
- 证据保全：记录 request_id、trace_id、时间窗、环境、版本、账号角色、脱敏样本、保留周期和访问权限。
- 依赖/框架：按版本、启用模块、配置、运行环境、CVE/GHSA、补丁行为和可利用条件判定；不凭标题判命中。
- 供应链：SAST、DAST、SCA、SBOM、secret scanning、容器镜像、IaC、CI 权限和制品 provenance 交 devsecops 落门禁。
- 发布/回滚：评估安全头、CORS、Cookie、OAuth、JWT、网关、中间件、CDN、WAF、灰度、告警和回滚兼容。

### 10. 漏洞复现与修复验证

- 复现：只在授权范围内执行，优先最小、低影响、可回滚样本；生产环境默认不做破坏性验证。
- 旧证据：记录版本、环境、账号角色、入口、参数、响应摘要、日志和影响面。
- 修复：最小改动阻断根因，覆盖同类入口，不借安全修复做无关重构。
- 验证：原路径负向失败、正常路径成功、相邻路径失败、权限矩阵通过、日志脱敏、告警可见、发布回滚说明完整。

## 高频坑 / 防遗漏

### 高频坑

1. 只有登录校验，没有对象级授权，导致 BOLA/IDOR。
2. 只在前端隐藏按钮，后端接口仍可越权调用。
3. CORS allowlist 用后缀匹配，恶意相似域混入。
4. Cookie 改 SameSite=None 后漏 Secure 或漏 CSRF。
5. JWT 只验签名，不验 iss、aud、exp、nbf、tenant、kid allowlist。
6. OAuth/OIDC redirect_uri 使用通配，state/nonce/PKCE 缺失。
7. SSRF 只拦字符串 localhost，不校验解析后 IP、重定向链和云 metadata。
8. 文件上传只看扩展名，不看 MIME、magic number、存储权限和下载鉴权。
9. SQL ORM 仍拼接 order by、where 片段或 raw query。
10. GraphQL 只在入口验登录，resolver 和字段级对象未验权。
11. WebSocket 连接后不再校验订阅频道、租户和 token 撤销。
12. CSP 一上来阻断生产，第三方 SDK、支付、SSO 直接故障。
13. 日志记录完整 Cookie/JWT/Authorization，修复报告又泄露样本。
14. 依赖漏洞不核版本、启用模块和配置，误判命中或漏判。
15. 修复只改新入口，旧 API、后台任务、导出下载、移动端 WebView 未验证。

### 防遗漏清单

- 授权：是否有明确书面范围、账号角色、时间窗口、禁止项、脱敏和流量限制？
- 资产：域名、API、后台、GraphQL、WebSocket、对象存储、CDN、网关、回调、预发/生产是否列全？
- 数据：subject、tenant、object、action、scope、owner、缓存 key、channel 是否进入证据链？
- 输入：request body、query、header、cookie、文件、URL、webhook、队列消息、模板、第三方回调是否按不可信处理？
- 输出：浏览器上下文、API 响应、下载、日志、trace、APM、错误详情、缓存、第三方上报是否脱敏和授权？
- 版本：浏览器、Node/Java/PHP/Python/Ruby/.NET、框架、网关、CDN、WAF、容器镜像、云平台差异是否说明？
- 验证：漏洞复现、修复验证、正向回归、负向权限、日志脱敏、告警、发布或回滚风险是否都有证据？

## 输出要求

安全任务输出保持极简但可复核：

1. 结论：存在/不存在/部分覆盖/无法验证，附风险等级和证据等级。
2. 授权与范围：资产、环境、账号角色、允许动作、禁止项、未覆盖项。
3. 入口与证据：路径/接口/参数/代码或配置位置/请求响应摘要/日志或 trace；敏感值必须脱敏。
4. 威胁与影响：用户、租户、数据、权限、可利用条件、版本/平台/框架/运行环境差异。
5. 修复：最小代码/配置/流程改法，说明兼容、灰度、回滚和残余风险。
6. 测试：原漏洞复现、修复验证、正向/负向/边界/权限矩阵、已跑命令和结果；未跑写原因。
7. 取证：request_id、trace_id、时间窗、日志位置、保留周期、访问控制、脱敏方式。
8. 边界：需联动 api-design、devsecops、protocol-analysis、reverse-engineering、observability-sre、test-engineering、code-audit 时写触发原因。

## 约束

- 只服务授权测试、防御、教育与 CTF；未知授权范围不做主动扫描、爆破、fuzz、绕过、防护规避或高影响操作。
- 不提供批量扫描脚本、隐蔽绕过、持久化、凭证窃取、数据破坏、DoS、可直接复用的攻击链或未授权利用步骤。
- 不把工具扫描结果直接当结论；必须结合版本、配置、代码、路径、权限、可利用条件和日志证据。
- 不把安全头缺失夸大成高危；不把认证通过等同授权通过；不把 CORS 当授权；不把测试通过包装成可上线。
- 不输出完整 token、Cookie、JWT、session、secret、验证码、个人敏感数据或 admin key；截图、日志、请求摘要必须脱敏。
- 涉 API 契约找 api-design；涉供应链/CI/secret scanning 找 devsecops；涉抓包/协议证据找 protocol-analysis；涉二进制/客户端混合容器证据找 reverse-engineering；涉日志/告警/incident 找 observability-sre；涉回归矩阵找 test-engineering；最终改动由 code-audit 收口。

## 高频 Bug 反例库

- 反例 1：只鉴登录不鉴对象
  - 错法：用户登录后可传任意 orderId 查看他人订单。
  - 对法：服务端校验 subject、tenant、object、action，并在批量场景逐项校验。
  - 根因：认证和授权混淆。
- 反例 2：批量接口只验第一个 ID
  - 错法：批量导出混入他人 id 仍返回数据。
  - 对法：逐项验权，失败项拒绝或剔除并记录审计日志。
  - 根因：集合输入扩大对象级授权缺口。
- 反例 3：前端权限当安全边界
  - 错法：隐藏删除按钮，但 API 无权限校验。
  - 对法：后端 policy/middleware 强制授权，前端只做体验。
  - 根因：信任客户端。
- 反例 4：CORS 反射任意 Origin
  - 错法：请求什么 Origin 就返回什么，且允许 credentials。
  - 对法：精确 allowlist，敏感接口仍做认证授权和 CSRF 防护。
  - 根因：把跨域策略当鉴权。
- 反例 5：CSRF 只靠 SameSite
  - 错法：Cookie 自动携带的转账接口无 Origin/Referer 和 token。
  - 对法：SameSite、Origin/Referer、CSRF token 组合验证。
  - 根因：把浏览器默认策略当业务授权。
- 反例 6：XSS 只用正则过滤 script
  - 错法：富文本允许 SVG、事件属性、危险 URL scheme 和 Markdown HTML。
  - 对法：成熟 sanitizer allowlist，按上下文编码，CSP 和 Trusted Types 纵深。
  - 根因：输出上下文未建模。
- 反例 7：SQL 排序字段拼接
  - 错法：where 用 bind，但 order by 直接拼 query 参数。
  - 对法：字段和方向用 allowlist 映射。
  - 根因：只关注值注入，漏结构注入。
- 反例 8：SSRF 黑名单绕过
  - 错法：拦 127.0.0.1 字符串，放行重定向到云 metadata。
  - 对法：校验 scheme、解析后 IP、每跳重定向、DNS rebinding 和 egress allowlist。
  - 根因：未校验最终连接目标。
- 反例 9：上传公开可执行
  - 错法：用户可控文件名进入公开目录并可被脚本执行。
  - 对法：重命名、私有存储、不可执行域、下载鉴权、扫描转换。
  - 根因：上传、存储、访问链路割裂。
- 反例 10：JWT 算法和 kid 信任 header
  - 错法：按 token header 动态选择算法或远程 JKU/X5U。
  - 对法：固定 algorithms、issuer、audience、kid allowlist 与 JWKS 缓存。
  - 根因：把不可信 header 当信任配置。
- 反例 11：OAuth 缺 state/nonce/PKCE
  - 错法：授权码回调只换 token，不校验会话绑定。
  - 对法：state 防 CSRF，nonce 防 ID Token 重放，公共客户端用 PKCE。
  - 根因：登录态与授权响应未绑定。
- 反例 12：GraphQL resolver 裸奔
  - 错法：query 入口验登录后，字段 resolver 返回跨租户对象。
  - 对法：resolver 按对象和字段验权，限制深度、复杂度、批量和错误详情。
  - 根因：GraphQL 一次请求包含多个资源边界。
- 反例 13：WebSocket 订阅未验权
  - 错法：连接鉴权后客户端可订阅任意 tenant channel。
  - 对法：握手、订阅、消息发送和 token 撤销都校验 subject/tenant/channel。
  - 根因：把长连接认证当成持续授权。
- 反例 14：日志脱敏只改业务日志
  - 错法：网关、异常中间件、APM、trace baggage 仍记录 Authorization 和 Cookie。
  - 对法：入口、异常、访问日志、trace、第三方上报统一脱敏并验证样本。
  - 根因：只查应用代码不查观测链路。
- 反例 15：依赖漏洞只看 CVE 标题
  - 错法：看到 CVE/GHSA 就判高危或忽略 transitive dependency。
  - 对法：核版本、启用模块、配置、调用路径、补丁行为、SCA/SBOM 证据。
  - 根因：供应链风险需要可利用条件和制品证据。

## 提交前自检清单

- [ ] frontmatter 包含 name、description，H1 为 Web Security实战排障版。
- [ ] 行数 < 500。
- [ ] fenced code block 数量为 0。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 快速总则为 Web 安全领域定制的资产 / 入口 / 威胁 / 证据。
- [ ] 反例数量不少于 10，且编号可被 反例\s*\d+ 命中。
- [ ] 关键词无缺失：OWASP Top 10 2021、OWASP 2024、CSP、Trusted Types、OAuth、OIDC、JWT、session、CSRF SameSite、CORS、SSRF 云元数据、SSTI、模板注入、GraphQL、WebSocket、file upload、supply chain、secret scanning、日志取证。
- [ ] 已覆盖版本/平台/框架/运行环境差异、入口/复现/证据/验证路径、高频真实 bug、安全/权限/数据/兼容/发布或回滚风险。
- [ ] 未输出完整凭证、Cookie、JWT、session、secret、个人敏感数据或 admin key。
- [ ] 涉测试验证联动 test-engineering；最终改动按 code-audit 口径复核。

## 2024-2026 新坑速查

- OWASP Top 10 2021 仍以 Broken Access Control、Injection、Security Misconfiguration、Software and Data Integrity Failures 为高频；2024 相关专题更强调 API、LLM/AI 生成代码、供应链和云原生配置证据。
- Chrome 第三方 Cookie 变化、CHIPS、Storage Partitioning、Safari ITP 会影响 SSO、嵌入页、跨站 Cookie、CSRF 和埋点。
- OAuth 2.0 Security BCP/RFC 9700 强化 PKCE、精确 redirect_uri、禁止隐式流程和开放重定向，旧 SPA 方案需复核。
- OWASP API Security 中 BOLA/IDOR 仍高频；GraphQL、批量、导出、对象存储下载都要测“别人的资源”。
- Next.js/边缘中间件/网关头处理存在绕过类风险；鉴权不要只放单层 middleware，危险 header 要在网关清理。
- JWT/JWK 风险集中在 alg confusion、kid/JKU/X5U、JWKS 缓存、issuer/audience 混淆和多租户 claim。
- SSRF 新坑集中在云 metadata、IPv6、DNS rebinding、重定向、URL parser 差异、PDF/HTML 渲染器、webhook 和 SSO discovery。
- CSP 与 Trusted Types 在现代前端更重要，但第三方 SDK、A/B、支付、客服脚本会带来兼容和发布回滚风险。
- GraphQL 风险集中在 resolver 对象级授权、query depth/complexity、alias/batch、introspection、错误详情和 DataLoader 跨租户缓存。
- WebSocket/SSE 风险集中在握手 Origin、token 撤销、频道授权、重连、消息 schema、日志脱敏和长连接限流。
- 对象存储预签名 URL、CDN 缓存、Service Worker、WebView、移动端内嵌浏览器会放大会话、CORS、缓存和下载鉴权问题。
- Passkeys/WebAuthn、MFA 恢复码、设备绑定和风险登录要验证降级、重放、账号恢复和客服绕过链路。
- DevSecOps 门禁应覆盖 SAST、DAST、SCA、SBOM、secret scanning、容器镜像、IaC、CI 权限和发布制品 provenance。
- AI 生成代码常漏鉴权、输入校验、日志脱敏、错误处理、测试证据；需按真实数据流审计。

## 与相邻技能的边界

- web-security 负责：Web/API/浏览器安全威胁建模、认证授权、会话 Cookie、CSRF、XSS、SQL/NoSQL/SSTI、SSRF、RCE、上传、路径穿越、反序列化、CORS、CSP、Trusted Types、JWT、OAuth/OIDC、BOLA/IDOR、GraphQL、WebSocket、日志取证、漏洞复现与修复验证口径。
- api-design 负责：API 契约、状态码、版本兼容、幂等、分页、限流、OpenAPI/SDK；web-security 只定义安全检查点、威胁和防护验证。
- devsecops 负责：SAST/DAST/SCA/SBOM、secret scanning、CI/CD 门禁、签名/provenance、容器/IaC、供应链和例外治理；web-security 提供 Web 风险样本和修复验证口径。
- protocol-analysis 负责：授权抓包、HTTP/2/3、TLS、WebSocket/gRPC/MQTT 协议证据、时序和兼容性；web-security 使用其协议证据判断漏洞和防护。
- reverse-engineering 负责：样本、二进制、APK/IPA、混合容器、私有格式和运行时观察；web-security 只接收其客户端证据并判断 Web 攻击面。
- observability-sre 负责：logs/metrics/traces、SLO、告警、incident、runbook、观测成本和多租户观测；web-security 只定义安全日志、取证、脱敏和告警需求。
- test-engineering 负责：测试策略、场景矩阵、自动化、CI 证据、回归和冒烟结论；web-security 提供风险样本、权限矩阵和验收口径。
- code-audit 负责：最终需求对账、影响面追踪、安全/质量复盘和修复复验收口；web-security 改动或安全修复完成后必须按其口径收口。
