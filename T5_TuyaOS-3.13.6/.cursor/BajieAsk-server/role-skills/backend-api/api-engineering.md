---
name: api-engineering
description: API 设计实战排障技能 - REST/GraphQL/gRPC/Event API 边界、OpenAPI/Schema、契约兼容、状态码与错误模型、认证授权、分页过滤排序、幂等键、限流、Webhook、SSE/streaming、AI tool calling API、typed clients、契约测试、灰度发布和回滚证据。当新建或修改 API 路由、请求响应、鉴权边界、公开契约、SDK/客户端生成或事件回调时必须使用。
---

# API 工程

API 工程（api-engineering，兼容 slug: api）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

定位：把 API 从“能调通”收敛为“契约可验证、消费者可迁移、状态码可观测、失败可回滚”。先拿需求、消费者、版本、契约和线上证据，再设计 REST/GraphQL/gRPC/Event 边界；不凭记忆改公开契约。

## 快速总则

- API 是跨端契约，不是控制器函数；任何字段、状态码、错误 code、认证 scope、分页语义、事件 schema 改动都要查生产方、消费方、SDK、Mock、OpenAPI、网关、缓存、监控和发布回滚。
- 先定资源语义和失败语义，再写接口；REST 用资源和 HTTP 语义，GraphQL 用聚合和按需取数，gRPC 用强类型内网 RPC，Event/Webhook 用异步事实通知。
- OpenAPI/JSON Schema/Proto/GraphQL schema/AsyncAPI 是契约源；示例、Mock、typed clients、contract test 必须与真实响应同源或可校验。
- 新端点默认认证；资源 id、子资源 id、批量 id、GraphQL node id、事件订阅都要对象级授权，防 BOLA/IDOR。
- POST 创建、支付、扣减、状态流转、Webhook、AI tool action 必须有幂等键、重放防护、并发冲突处理和补偿查询。
- 破坏性变更必须版本化、双字段/双路由过渡、灰度、Deprecation/Sunset 或等价公告；内部 API 也要说明消费者和回滚点。
- 错误模型必须稳定：HTTP status、业务 code、Problem Details/type、字段级错误、request_id、重试语义不能漂移。
- 统一表示：id 格式、时间一律 ISO 8601/RFC 3339 + 时区、金额用最小货币单位或 decimal string、单位写入字段名/Schema、locale/language/currency 显式传递；枚举新增默认兼容，客户端必须容忍未知枚举。
- 证据不足先补证据；无法确认消费者时按公开破坏性变更处理，不硬删旧契约。

## 强制执行流程：需求 → 资源 → 契约 → 消费者 → 门禁

1. 需求拆解：先列业务目标、消费者、用户旅程、禁止项、读写频率、数据敏感级别、兼容范围、回滚要求和验收样本；缺消费者证据按公开 API 处理。
2. API 选型：必须说明 REST/GraphQL/gRPC/Event/Webhook/SSE 的选择理由；长耗时、最终一致、批量导入导出、回调结果默认评估 202 + operation resource 或事件化。
3. 资源建模：列资源、子资源、关系、动作、状态、所有者、权限边界；命令型动作优先转成资源状态流转，不能把控制器函数直接暴露成 API。
4. 状态机建模：涉及订单、任务、审批、支付、库存、AI tool action 时，必须列状态、事件、允许迁移、终态、非法迁移、补偿和并发冲突。
5. 契约草案：实现前产出 method/path 或 schema/operation、请求、响应、错误示例、分页/过滤/排序、权限 scope、幂等、限流和可观测字段。
6. 消费者对账：列前端、App、SDK、第三方、后台任务、BI、Webhook、Mock、文档和缓存使用矩阵；未确认消费者时不得删除或收紧契约。
7. 兼容判定：字段、枚举、错误、状态码、排序、分页、scope、limit/quota 任一变化都要判定兼容等级、迁移窗口、旧端策略和回滚点。
8. 契约门禁：OpenAPI/Schema/Proto/GraphQL/AsyncAPI 必须与 Mock、SDK、示例、contract test 和真实响应校验同源或可自动比对。
9. 测试交接：交给 tst 的最小包包括成功/边界/异常/权限/并发/重放/旧端/contract/灰度回滚场景。
10. 停止条件：无消费者清单、无契约草案、无错误模型、无权限边界、无兼容判定、无回滚点或安全边界不清时，不进入实现。

## 单技能开发闭环门禁

- 实现前门禁：每个新增/修改接口必须先落一页契约说明，至少包含 method/path、输入 DTO、输出 DTO、错误码、权限、分页/过滤/排序、幂等、兼容性、验证样本和回滚点；没有这页契约，不允许直接写 controller。
- Controller 门禁：controller 只做协议适配、认证上下文、DTO 解析、错误映射和 response envelope；业务规则、状态机、权限判断、DB model 更新、第三方副作用不得堆在 controller 函数里。
- DTO 门禁：请求 DTO、响应 DTO、内部实体、DB model、事件 payload 必须分层；禁止把请求体直接绑定内部实体后保存，禁止把 DB model 原样返回给外部 API。
- 输入门禁：未知字段、重复字段、大小写差异、空对象、超大 body/header、content-type 不匹配、数组超限、嵌套深度、非法 enum、时区/金额/单位都要有固定处理策略和测试。
- 输出门禁：响应只返回契约字段；默认不暴露内部 id、审计字段、租户字段、权限字段、软删字段、实验字段、第三方原始错误和调试信息。
- 错误门禁：同一失败只能有一个稳定 HTTP status + 业务 code；message/detail 可变，客户端只能依赖 code、status、retryable 和字段级错误。
- 权限门禁：先认证，再租户隔离，再对象级授权，再字段级授权，再动作授权；批量、导出、搜索、缓存、异步任务和 webhook 补偿查询也要走同一权限链。
- 写入门禁：任何写接口必须回答“谁可写、可写哪些字段、写入前状态、写入后状态、并发冲突、幂等重放、失败补偿、审计日志、回滚策略”。
- 兼容门禁：旧客户端、SDK、Mock、OpenAPI、文档、网关缓存、监控分桶、告警阈值和灰度开关必须同步；只改服务端实现不算完成。
- 验收门禁：不能只测 happy path；最少覆盖成功、字段缺失/null/零值、非法字段、权限失败、对象越权、并发、重复请求、旧端 contract、SDK/Mock 和回滚验证。
- 证据门禁：完成前必须给出契约 diff、真实请求/响应样本、schema 校验或 contract test、错误样本、权限样本、灰度指标/日志 request_id、回滚开关或旧版本路径。

## 场景执行卡

### 1. 新增 REST / CRUD / BFF

- 证据：资源边界、消费者、读写频率、权限模型、缓存需求、平台差异（Web/App/第三方/后台任务）。
- 动作：URL 用名词复数；GET 只读，POST 创建，PUT 替换，PATCH 局部更新，DELETE 删除；列表默认分页；响应 DTO 不直接暴露 DB model。
- 契约：method/path、request/response、required/nullable、枚举、状态码、错误模型、OpenAPI operationId、示例和权限 scope。
- 验证：成功、参数错、401、403、404、409/412、空列表、超限、旧端兼容、typed client 生成。

### 2. 修改字段 / 状态码 / 错误码 / 响应结构

- 证据：旧字段使用者、缓存 key、SDK 生成物、Mock、埋点、告警、文档示例、线上请求样本。
- 动作：判定兼容或破坏；删除、改名、改类型、收紧必填、状态码语义变化默认破坏；优先双字段、版本化或迁移窗口。
- 契约：同步 OpenAPI/Schema/GraphQL/Proto、错误码表、示例、contract test、Mock、客户端解析。
- 验证：缺失/null、未知枚举、旧客户端、灰度回滚、错误分支、监控分桶。

### 2.1 字段新增 / 编辑 / 删除门禁

- 字段新增门禁：先判定字段归属、读写方向、默认值、nullable、是否敏感、是否只读、是否可被客户端写入、是否进入列表/详情/导出/搜索/缓存/事件/SDK；新增响应字段通常兼容，但新增请求必填字段、改变默认值、改变排序过滤结果都按破坏性变更处理。
- 字段编辑门禁：改名、改类型、改单位、改精度、改枚举、改 required/nullable、改空值语义、改只读/可写属性、改字段级权限、改脱敏规则、改错误码都必须列消费者、迁移窗口、双写/双读或双字段策略；不能只改后端 DTO。
- 字段删除门禁：删除前必须有 deprecated 使用统计、消费者确认、灰度开关、旧端回滚策略和 contract test；公开 API 字段删除默认走新版本或 Sunset，不允许用“没人用”替代证据。
- PATCH 语义门禁：必须区分字段缺失、显式 null、零值、空串、空数组、false；缺失通常表示不变，null 表示清空必须显式声明，0/false/空串是合法值还是拒绝值必须写入 Schema、验证规则和测试。
- PATCH 零值/空串验证：覆盖 number=0、boolean=false、string=""、array=[]、object={}、nullable=null、字段缺失、未知字段、重复字段和类型错误；不能用 truthy/falsy 判断覆盖合法零值。
- Mass Assignment 门禁：请求 DTO 必须白名单可写字段；role、is_admin、owner_id、tenant_id、status、created_at、updated_at、deleted_at、price、balance、quota、scope、权限/审计字段默认只读或服务端计算；未知字段默认拒绝或忽略必须在契约中固定。
- 只读字段门禁：响应可见不等于请求可写；只读字段必须在 OpenAPI/Schema/GraphQL input/output 中分离，服务端拒绝或忽略客户端提交，并记录字段级权限测试。
- DELETE 语义门禁：明确硬删除、软删除、撤销、取消、归档、禁用、解绑的业务差异；DELETE 是否幂等、重复删除返回 204/404/409、是否异步 202、是否可恢复、是否级联、是否保留审计和 PII 删除义务必须写清。
- 字段契约验证：字段级 contract test 至少覆盖 required/nullable/readOnly/writeOnly/default/enum/format/min/max/pattern/additionalProperties、缺失/null/零值/空串、旧客户端反序列化、Mock/SDK/真实响应一致性。

### 3. 认证授权 / 租户 / 对象所有权

- 证据：issuer、audience、scope、token 生命周期、租户边界、角色矩阵、网关可信头、服务间身份。
- 动作：验签、过期、撤销、scope；每个对象 id 做对象级授权；批量逐项验权；GraphQL resolver 级鉴权；内部接口最小权限。
- 契约：401/403/404 泄露边界明确；权限失败错误体稳定且带 request_id；审计日志字段明确。
- 验证：未登录、过期 token、跨租户、他人资源、批量混入无权资源、伪造 X-User-Id/X-Role。

### 4. 分页 / 过滤 / 排序 / 搜索 / 导出

- 证据：数据规模、索引能力、默认排序、游标稳定键、过滤字段、前端无限滚动/导出场景。
- 动作：limit/page_size 上限；排序/过滤白名单；cursor 包含稳定排序键和唯一 tie-breaker；大导出走异步任务。
- 契约：cursor/next_cursor、total 是否精确、非法过滤字段错误、部分成功结构、导出任务状态机。
- 验证：空页、末页、并发新增删除、非法排序、超大 page_size、导出失败重试。

### 5. 幂等 / 并发 / 状态机

- 证据：是否创建订单、支付、扣减、库存、配额、AI 外部动作、客户端超时重试或双击。
- 动作：Idempotency-Key 绑定用户、操作、参数摘要和过期窗口；服务端去重；共享资源原子更新/锁/版本号；非法跳转拒绝。
- 契约：重复请求返回同一结果；相同 key 参数不一致返回 409；409 表冲突，412 表前置条件失败；状态机列允许跳转和终态。
- 验证：并发、超时重试、乱序状态、终态重放、回滚后重试、外部副作用只执行一次。

### 6. Webhook / Event / 异步任务

- 证据：事件唯一 id、schema 版本、签名算法、原始 body、时间戳、重试策略、DLQ、补偿查询。
- 动作：验签、时间窗口、nonce/事件 id 去重；先落事件再处理；处理幂等；乱序不覆盖终态；失败可重试和主动查询。
- 契约：事件 schema、签名头、重放窗口、成功响应语义、幂等结果、订阅版本、AsyncAPI/事件目录。
- 验证：签名错、过期、重复、乱序、依赖超时、DLQ 回放、补偿回填。

### 7. 缓存 / ETag / 条件请求 / CDN

- 证据：公开/私有、用户/租户/语言相关性、缓存层级、更新频率、回滚后失效策略。
- 动作：可缓存 GET 定义 Cache-Control、ETag/Last-Modified、Vary；私有响应 private/no-store；变更接口触发失效。
- 契约：304 语义、弱/强 ETag、缓存 key、回源策略、权限切换行为。
- 验证：首次请求、If-None-Match、权限切换、数据更新、灰度回滚缓存污染。

### 8. 限流 / 配额 / 退避

- 证据：用户、IP、token、租户、operation、GraphQL complexity、Webhook 来源、登录/支付/AI 工具调用风险。
- 动作：按风险维度限流；GraphQL 深度/复杂度/批处理计费；返回 429 和 Retry-After；客户端退避不无限重试。
- 契约：窗口、额度、错误体、重试边界、幂等重试规则。
- 验证：单用户突增、多 token 绕过、批量请求、GraphQL batching、Retry-After 生效。

### 9. OpenAPI / Schema / SDK / Contract test

- 证据：OpenAPI 3.0/3.1、JSON Schema 方言、生成器版本、目标语言 typed clients、Mock/CI 链路。
- 动作：Schema 写清 required/nullable/format/additionalProperties/oneOf；operationId 稳定；真实响应跑 schema 校验；consumer-driven contract 入 CI。
- 契约：错误结构、分页结构、Problem Details、示例、SDK 包版本和弃用策略。
- 治理：契约变更进 CI 做 lint、breaking-change diff、operationId/tag/error code 唯一性检查；SDK semver、生成器版本、retry 默认策略和最低客户端版本必须记录。
- 验证：文档生成、Mock 调用、SDK 生成、旧客户端编译、真实响应校验。

### 10. GraphQL / gRPC / REST / Event 边界

- 证据：查询聚合需求、延迟、缓存、流式、客户端平台、内部/外部边界、治理工具。
- 动作：REST 承载资源 CRUD、缓存和幂等；GraphQL 承载聚合但限深度/复杂度/resolver 鉴权；gRPC 承载内网强类型 RPC 并设置 deadline/backpressure；Event 承载事实变更和最终一致。
- 契约：GraphQL 部分成功/errors/extensions；gRPC status code、deadline、proto 字段号只增不改；Event 版本和重放策略。
- 验证：复杂查询、越权字段、N+1、旧 proto 客户端、stream 取消、事件重复与乱序。

### 11. SSE / streaming / AI 工具调用 API

- 证据：是否需要 token streaming、增量 JSON、工具调用、取消、断线续传、计费、审计和安全拦截。
- 动作：定义 event 类型、chunk 顺序、done/error 事件、心跳、超时、取消、重连、usage 统计；tool call 参数 schema 严格校验，外部动作默认人工或策略门禁。
- 契约：流式错误不能只在连接断开表达；partial output、tool result、trace id、幂等 action id、速率限制和隐私脱敏写清。
- 验证：慢客户端、断线重连、模型拒答、工具失败、重复 tool call、客户端 SDK 对 streaming 的类型解析。

### 12. 上线 / 灰度 / 回滚 / 废弃迁移

- 证据：灰度范围、版本并存期、监控指标、告警阈值、feature flag、数据迁移、缓存失效。
- 动作：先低风险消费者；保留旧契约；记录 deprecated usage；异常可回滚旧路由/旧响应/旧认证/旧 SDK。
- 契约：Deprecation/Sunset 或内部公告、迁移指南、旧端下线条件、回滚后兼容声明。
- 验证：v1/v2 并存、旧客户端、灰度扩大、指标异常、回滚和缓存清理。

### 13. Public API / 开发者体验 / API Key

- 证据：目标开发者、sandbox、portal/docs、API key/OAuth 应用、SDK 语言、SLA、支持渠道、changelog、弃用窗口。
- 动作：API key 可创建/轮换/吊销/分环境；quickstart、示例请求、Postman/Bruno collection、typed SDK、错误排障页与 changelog 同步；公开 API 默认 semver 或日期版本。
- 契约：认证方式、环境域名、rate limit、quota、SDK 版本、弃用策略、支持边界、兼容承诺。
- 验证：新开发者 30 分钟接入、key 轮换不中断、sandbox 与 production schema 一致、旧 SDK 仍可运行、文档示例可执行。

### 14. 批量 / 部分成功 / 异步长任务

- 证据：最大 items、事务边界、逐项权限、幂等粒度、耗时阈值、网关超时、结果保存期限、回调需求。
- 动作：批量接口定义 item-level status/error、错误聚合、事务/非事务边界；耗时导出/导入/批处理返回 202 + operation resource/Location。
- 契约：status、progress、result_url、expires_at、cancel、polling backoff、webhook 回调、部分成功语义；禁止用单个 200 掩盖部分失败。
- 验证：部分失败、全失败、重复提交、客户端超时后查询、取消、结果过期、回调失败补偿。

### 15. API 安全与滥用防护

- OWASP API 必查：BOLA/IDOR、对象属性级授权、Broken Auth、Mass Assignment、Excessive Data Exposure、SSRF、Unrestricted Resource Consumption、Unsafe Consumption of APIs。
- 认证：校验 issuer/audience/exp/nbf/scope/nonce/state；refresh token、session、API key、服务账号要有轮换、吊销、泄露响应和最小权限。
- 授权：对象级、字段级、resolver 级、批量逐项、租户级；tenant_id 来源必须可信，查询、缓存、搜索索引、导出、异步任务都要防跨租户。
- 反自动化：登录、注册、搜索、导出、优惠、短信、AI tool、公开查询要评估枚举、撞库、爬取、批量注册、凭证填充、封禁与申诉。
- SSRF/外部 URL：只允许 allowlist；阻断内网、metadata IP、DNS rebinding、跳转绕过、非预期协议和回连；记录解析后目标。
- CORS/CSRF：cookie API 必查 SameSite、CSRF token、Origin/Referer；凭证型 CORS 禁止通配 origin，预检缓存要可控。
- 文件上传：限制大小/数量/类型；MIME 与扩展名双校验；扫描恶意文件、压缩/图片炸弹；对象存储 ACL 最小化；下载鉴权；清理 EXIF/敏感元数据。
- 错误与日志：不同环境错误级别分离；禁止透传堆栈、SQL、内部路径、第三方 secret、GraphQL errors/extensions 敏感字段；日志字段红线和采样策略写清。
- 证据：威胁点、拒绝样本、限流维度、审计日志字段、request_id、告警/封禁信号和需 wsec 复核项。

### 16. 兼容性、错误码与性能预算门禁

- 默认破坏性变更：删除字段、改名、改类型、收紧 required/nullable、删除枚举、改变默认排序/分页语义、改变错误 code/status、收紧 scope、降低 limit/quota。
- 字段变更破坏性补充：请求新增必填、响应字段从缺失变 null、null 变缺失、零值默认被自动填充、空串被自动 trim/拒绝、未知字段处理方式变化、只读字段变可写、可写字段变只读、DELETE 从软删改硬删都按破坏性评估。
- 错误治理：业务 code 全局唯一且可废弃不可复用；错误体包含稳定 status/code/message/request_id；字段级错误结构化；retryable/user_action/log_level 明确。
- Problem Details：type/status 可标准化，detail/message 不作为客户端分支依据；第三方错误需映射为本域稳定 code。
- 分页过滤排序：声明 limit/page_size 上限、默认排序、唯一 tie-breaker、过滤/排序白名单、非法字段错误码；无稳定排序键禁止 cursor 分页。
- 性能预算：每个 API 声明 timeout、最大 body/header、最大 items、P95/P99 目标、限流维度、retryable code、retry budget、GraphQL depth/complexity 或导出阈值。
- Contract 最小矩阵：schema lint、breaking-change diff、真实响应 schema 校验、consumer-driven contract、Mock 校验、SDK 生成编译、至少一个旧客户端兼容验证。
- OpenAPI/SDK 发布门禁：operationId 稳定、生成器版本锁定、SDK semver、changelog、sandbox/production schema 一致、弃用窗口和回滚版本可用。

## 高频坑 / 防遗漏

- 低级错硬禁：禁止 controller 函数化 API、请求体直绑内部实体、响应直返 DB model、把所有错误包 200、只测 happy path、只改生产方不改消费者、手改文档不改 OpenAPI、改 OpenAPI 不跑 SDK/Mock、删除字段不查旧端、状态码随异常类型漂移。
- 开发闭环：契约、实现、错误映射、权限、观测、Mock、SDK、contract test、灰度和回滚必须一起收口；少一项就把接口标为未完成。
- 契约一致：OpenAPI/Schema/Proto/GraphQL schema、真实响应、Mock、SDK、文档、错误示例必须一致。
- 消费者影响：前端、App、第三方、后台任务、BI、缓存预热、Webhook 接收方、typed clients 都要查。
- 状态码证据：2xx/4xx/5xx、409、412、422、429、304 必须有稳定语义和监控分桶。
- 兼容证据：新增可选字段通常兼容；删除/改名/改类型/收紧 required/nullable/状态码变化通常破坏。
- 字段新增证据：新增字段必须说明是否 readOnly/writeOnly、是否进入 PATCH/POST、默认值来源、旧端缺失处理、null/零值/空串语义和字段级权限。
- PATCH 证据：PATCH 必须有缺失/null/零值/空串/false/空数组的测试样本；任何把 0、false、空串误判为“未传”的实现都不能过门禁。
- DELETE 证据：DELETE 必须说明资源状态变化、重复调用结果、级联影响、异步任务、审计保留、缓存失效和回滚/恢复路径。
- 安全证据：BOLA/IDOR、批量逐项验权、GraphQL resolver 鉴权、网关 header trust、OAuth/OIDC scope 必须逐项确认。
- 幂等证据：Idempotency-Key、业务唯一键、去重表、事件 id、终态重放、外部副作用一致。
- 平台差异：浏览器 CORS/缓存、移动端旧版本、服务端 SDK 重试、gRPC HTTP/2、SSE 代理缓冲行为不同。
- 版本坑：OpenAPI 3.1/JSON Schema 2020-12、Proto3 optional、GraphQL non-null、SDK 生成器 nullable 行为要实测。
- 边缘治理：契约需声明 CORS、body/header 大小、timeout、proxy buffering、retry/circuit breaker、TLS/mTLS、WAF、路径重写、trusted proxy headers；网关行为变更按 API 兼容变更评估。
- 韧性契约：定义服务端 timeout、客户端 timeout、retryable status/code、Retry-After、指数退避、retry budget；非幂等请求只有具备 Idempotency-Key/业务去重后才允许自动重试。
- 隐私默认：响应只返回消费者需要字段；PII/敏感字段在 Schema 标注并脱敏日志/错误/trace；审计数据定义保留期；导出、删除、跨境/数据驻留需求需在 API 契约和权限模型中体现。
- 商业 API：plan/entitlement、quota unit、usage metering、账单 request_id、租户/项目/API key 绑定、超额降级和申诉/补偿查询要可审计；限流与计费口径必须一致。
- 可观测性：request_id/correlation_id、traceparent、结构化日志、RED 指标、审计日志、release marker 和告警阈值要交付。
- 回滚：只回滚代码不清缓存、不恢复旧 schema、不兼容旧 SDK，等于不可回滚。

## 输出要求

每次 API 设计或变更至少输出：

1. 场景卡：新增 REST、改契约、认证授权、分页、幂等、Webhook/Event、缓存、限流、OpenAPI/SDK、GraphQL/gRPC、SSE/AI、上线迁移、Public API、批量/长任务中的哪类。
2. 选型与资源模型：REST/GraphQL/gRPC/Event/Webhook/SSE 选择理由，资源/子资源/状态机/所有者/权限边界。
3. 证据：需求、消费者、当前版本、现有契约、请求/响应样本、日志 request_id、影响面来源；没有证据标“待确认”。
4. 契约：method/path 或 schema/operation、request、response、错误模型、状态码、分页/排序/过滤、认证 scope、示例。
5. 兼容：兼容/破坏判定、版本化策略、旧端迁移、typed clients/SDK 影响、Deprecation/Sunset 或替代机制。
6. 安全：认证授权、对象/字段级权限、租户隔离、反滥用、SSRF、CSRF/CORS、文件上传、敏感数据和错误泄露。
7. 性能预算：timeout、body/header/items 上限、P95/P99、限流维度、retry budget、GraphQL complexity 或导出阈值。
8. 验证：正常、边界、异常、权限、并发、重放、旧端、contract test、Mock/SDK、灰度回滚。
9. 联动：对应语言、be、db、gge、wsec、obs、rls、tst、aud 是否需要介入及原因。

## 约束

- 不在没有消费者和契约证据时修改公开 API；证据不足先补证据。
- 不在未完成资源模型、状态机、兼容判定、错误模型和回滚点时进入实现。
- 不直接返回数据库模型，不暴露密码 hash、内部枚举、堆栈、SQL、内部路径和密钥。
- 不把所有失败包成 200；HTTP 状态码要服务网关、监控、重试、缓存和客户端判断。
- 不用前端校验替代服务端校验；不以接口级鉴权替代对象级授权。
- 不把响应字段自动放进请求绑定；不允许客户端写只读字段、服务端计算字段、权限字段、租户字段、审计字段和状态机字段。
- 不用 PATCH 的字段缺失覆盖数据库现值；不把 null、0、false、空串、空数组混成同一种“空”；不靠框架默认 binding 决定字段语义。
- 不把 DELETE 当成“删掉一行”就结束；必须定义软删/硬删/取消/归档/禁用语义、重复请求结果、级联影响和审计保留。
- 不让 OpenAPI/Schema/Proto/GraphQL schema 成为落后文档；契约、实现、Mock、测试、SDK 必须同步。
- 不把幂等和重试留给客户端；服务端必须处理重复、乱序、超时和外部副作用。
- 不因“内部接口”跳过认证、审计、限流、deadline、回滚和废弃策略。
- 不把公开 API 的开发者体验、API key 生命周期、sandbox、changelog、SDK 发布、SLA 和支持边界视作“文档小事”；它们会影响兼容和回滚。
- 不越界实现：语言代码归对应语言技能，事务/索引归 db，协议深水区归 gge，安全验证归 wsec，观测告警归 obs，发布归 rls，测试矩阵归 tst，最终收口归 aud。

## 高频 Bug 反例库

- 反例 1：只改生产方不改消费者。错法：后端字段改名，前端/App/SDK/Mock/文档仍读旧字段。对法：双字段过渡或升版本，搜全消费者，contract test 覆盖旧端。根因：API 是跨端契约，不是单服务变量。
- 反例 2：nullable/required 漂移。错法：以前字段缺失，现在返回 null，或可选字段改必填。对法：Schema 明确 required/nullable，旧端覆盖缺失和 null。根因：不同平台 typed clients 对缺失/null 分支不同。
- 反例 3：错误模型不稳定。错法：同一错误有时 400、有时 200+code、有时 500。对法：固定 HTTP status、业务 code、Problem Details/type、request_id。根因：监控、重试、降级依赖稳定失败语义。
- 反例 4：分页游标不稳定。错法：cursor 只含更新时间，并发新增导致重复或漏数据。对法：cursor 包含稳定排序键和唯一 tie-breaker。根因：分页是状态契约，不是 SQL limit 包装。
- 反例 5：幂等键未绑定参数。错法：相同 Idempotency-Key 参数变了仍返回旧结果。对法：key 绑定用户、操作、参数摘要和过期窗口，不一致返回 409。根因：幂等防重复，不应掩盖语义不同的请求。
- 反例 6：Webhook 只验签不防重放。错法：签名正确的旧请求可重复入账。对法：验原始 body、时间戳、nonce/事件 id、重放窗口和终态幂等。根因：签名证明来源，不证明新鲜性和一次性。
- 反例 7：信任客户端身份 header。错法：应用直接信 X-User-Id/X-Role。对法：边界层清洗外部同名头，应用只信可信上下文。根因：header 默认用户可控，除非可信边界已证明。
- 反例 8：OpenAPI 与真实返回不一致。错法：文档写 string，真实返回 number，Mock 还有不存在字段。对法：真实响应跑 Schema 校验，SDK/Mock/contract test 与 OpenAPI 同源。根因：文档漂移会把错误推迟到联调和线上。
- 反例 9：GraphQL 入口验权后 resolver 裸奔。错法：只在 query 入口验登录，字段级资源可越权读取。对法：resolver 按对象和字段验权，限制深度/复杂度。根因：GraphQL 一次请求内包含多资源边界。
- 反例 10：gRPC proto 字段号复用。错法：删除字段后复用 tag 给新语义。对法：字段号只增不改，删除后 reserved，旧客户端回归。根因：Protobuf wire format 依赖字段号而非字段名。
- 反例 11：SSE/streaming 只处理成功 chunk。错法：中途错误靠断连接表达，客户端无法区分完成、取消和失败。对法：定义 error/done/heartbeat、重连和取消语义。根因：流式 API 的失败也是契约事件。
- 反例 12：AI tool call 外部动作无幂等。错法：模型重复调用扣款/发券工具导致多次副作用。对法：tool action id、权限门禁、参数 schema、幂等和审计日志。根因：LLM 输出不等于可信用户意图，工具调用可能重试或被注入。
- 反例 13：缓存泄露私有响应。错法：带 Authorization 的用户数据被 CDN 共享缓存。对法：private/no-store 或正确 Vary，ETag 不跨权限复用。根因：缓存键缺少权限上下文会跨用户泄露。
- 反例 14：typed client 生成后静默破坏。错法：OpenAPI 3.1 nullable/oneOf 被旧生成器误解，客户端编译过但运行失败。对法：锁生成器版本，生成后跑真实 contract test。根因：契约工具链版本也是兼容边界。
- 反例 15：金额用 float。错法：API 返回 12.10，客户端浮点计算后账单误差。对法：金额用最小单位整数或 decimal string，并声明 currency。根因：金额是精度契约，不是展示数字。
- 反例 16：长任务同步阻塞。错法：导出接口长时间 200 等待，网关超时后客户端反复重试。对法：202 + operation resource + 查询/取消/结果过期。根因：耗时任务需要状态契约。
- 反例 17：公开 API key 不可轮换。错法：泄露后只能停全量服务。对法：key 支持分环境创建、双 key 轮换、吊销和审计。根因：凭证生命周期是 API 契约的一部分。
- 反例 18：未知枚举导致客户端崩溃。错法：服务端新增 enum，旧 typed client exhaustive switch 抛错。对法：Schema/SDK 明确 unknown fallback，新增枚举走兼容验证。根因：枚举扩展也是破坏面。
- 反例 19：Mass Assignment。错法：PATCH 用户资料直接绑定请求体，攻击者提交 role/is_admin。对法：请求 DTO 白名单字段，服务端忽略不可写属性。根因：对象属性级授权不等于对象级授权。
- 反例 20：SSRF 外部 URL。错法：预览接口直接抓取用户 URL。对法：allowlist、解析后 IP 检查、禁内网/metadata、限制跳转和协议。根因：URL 是不可信输入且 DNS/跳转可绕过。
- 反例 21：文件上传信任扩展名。错法：只看 .jpg 就入对象存储公开桶。对法：大小/类型双校验、扫描、私有 ACL、下载鉴权和元数据清理。根因：上传文件是高风险输入与分发面。
- 反例 22：错误 detail 被客户端解析。错法：客户端按 message 文案判断重试。对法：只解析稳定 code/retryable，message 可本地化。根因：文案和 detail 会变，不能作为契约分支。
- 反例 23：字段新增变相破坏旧端。错法：新增必填请求字段或响应字段从缺失变 null，旧 SDK 反序列化失败。对法：新增请求字段默认可选，响应字段声明 nullable/默认值，旧端 contract test 覆盖缺失和 null。根因：字段新增也会改变 typed clients 和客户端分支。
- 反例 24：PATCH 零值被吞。错法：用户把库存改成 0、开关改成 false、昵称改成空串，服务端用 truthy 判断后当作未传。对法：显式记录字段 present 状态，分别处理缺失/null/零值/空串。根因：局部更新的核心是“是否传入”而不是“值是否为真”。
- 反例 25：只读字段可写。错法：客户端提交 owner_id、tenant_id、created_at、status 并被 ORM 保存。对法：input DTO 与 output DTO 分离，只读字段服务端计算，提交只读字段返回字段级错误或固定忽略策略。根因：响应可见不代表请求可写。
- 反例 26：DELETE 语义漂移。错法：同一个 DELETE 有时硬删、有时软删、有时返回 200 body、有时 204，重复删除还触发级联。对法：契约写清删除类型、幂等结果、级联、审计、恢复和缓存失效。根因：删除是状态变更契约，不是数据库操作细节。
- 反例 27：controller 函数化 API。错法：/doUpdateStatus 里混权限、状态机、DB 更新、第三方调用和返回拼装。对法：先建资源/状态契约，controller 只适配协议，业务和副作用进服务边界并有幂等与审计。根因：函数暴露会绕过契约、权限和回滚治理。
- 反例 28：只测 happy path。错法：Postman 调通一次 200 就上线。对法：必须补字段边界、错误码、权限、对象越权、并发、重放、旧端和回滚样本。根因：API 事故多数发生在失败语义和兼容边界。
- 反例 29：错误码漂移。错法：参数错有时 400，有时 422，有时 500，有时业务 code 复用。对法：错误码表唯一、可废弃不可复用，异常统一映射，contract test 固定 status/code/retryable。根因：客户端、告警和重试都依赖稳定错误契约。
- 反例 30：过滤排序未白名单。错法：客户端传 sort=任意字段或 filter 直接拼查询。对法：过滤/排序字段白名单、非法字段返回稳定错误、索引能力和默认排序写入契约。根因：列表参数是查询能力暴露面，不是 SQL 透传。
- 反例 31：对象级授权漏在批量里。错法：单个详情验权，批量 ids、导出、搜索结果和异步任务只验登录。对法：批量逐项验权，结果结构声明无权项语义，后台任务保存授权上下文。根因：BOLA/IDOR 常从列表、导出和异步补偿绕过。
- 反例 32：Mock/SDK 与 OpenAPI 分叉。错法：Mock 手写字段，SDK 用旧 schema，真实接口又返回第三套结构。对法：同源生成或 CI diff，真实响应 schema 校验，SDK 编译和旧端 contract test 进门禁。根因：契约多源会把错误推迟到联调或线上。
- 反例 33：灰度不可回滚。错法：新字段/新错误码已被新端依赖，回滚服务端后旧端和新端都坏。对法：双读双写、feature flag、旧响应路径、缓存清理、SDK 版本钉住和回滚演练。根因：API 回滚必须同时照顾新旧消费者。
- 反例 34：请求体直绑内部实体。错法：JSON bind 到 ORM model 后 save，默认值、零值、只读字段和关联对象被外部输入覆盖。对法：input DTO 白名单、present 状态、服务端计算字段和字段级权限测试。根因：外部输入不可信，内部实体不是公开写契约。

## 提交前自检清单

- [ ] 远端 raw 行数小于 500，fenced code block 数为 0。
- [ ] 必需章节齐全：快速总则、强制执行流程、单技能开发闭环门禁、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例不少于 10 条，每条能被“反例 数字”命中，并包含错法、对法、根因。
- [ ] 关键词覆盖：REST、GraphQL、gRPC、Event API、OpenAPI、Schema、Idempotency-Key、分页、过滤、排序、错误模型、状态码、认证授权、限流、Webhook、SSE、streaming、AI tool calling、typed clients、契约测试、兼容、证据、回滚。
- [ ] 增强关键词覆盖：API key、sandbox、changelog、semver、PII、RFC 3339、quota、operation resource、breaking-change diff、retry budget、CORS、mTLS、SLA。
- [ ] 已核对 API 选型理由、资源模型、状态机、错误码表、兼容判定和回滚点。
- [ ] 已核对消费者影响面、平台差异、版本坑、SDK/Mock/文档/监控/缓存/网关。
- [ ] 已核对字段新增/编辑/删除门禁：readOnly/writeOnly、required/nullable、默认值、字段级权限、旧端兼容、双字段/版本化、删除/Sunset。
- [ ] 已核对 PATCH 缺失/null/零值/空串/false/空数组/未知字段/只读字段/重复字段，并确认实现不靠 truthy/falsy 判断。
- [ ] 已核对 Mass Assignment：请求 DTO 白名单、只读字段拒绝或固定忽略、ORM/model bind 不直接吃外部请求体。
- [ ] 已核对 DELETE 语义：软删/硬删/取消/归档/禁用、重复删除、级联、审计保留、缓存失效、异步 202 和恢复/回滚路径。
- [ ] 已核对字段契约验证：OpenAPI/Schema/GraphQL input-output 分离、Mock/SDK/真实响应一致、旧客户端 contract test 覆盖字段边界。
- [ ] 已核对 BOLA/IDOR、对象/字段级授权、批量逐项验权、header trust、OAuth/OIDC scope、Mass Assignment、SSRF、CSRF/CORS、文件上传和反滥用。
- [ ] 已核对幂等、并发、状态机、Webhook 重放、外部副作用和补偿查询。
- [ ] 已给出 contract test、真实响应 Schema 校验、灰度指标、回滚证据。
- [ ] 已按风险联动 tst；完成前用 aud 收口。

## 2024-2026 新坑速查

- OpenAPI 3.1 / JSON Schema 2020-12：nullable、type union、format、unevaluatedProperties、oneOf/anyOf 与旧生成器差异大；不确定就锁 3.0 或加转换和生成验证。
- OpenAPI 3.1.1 / typed clients：文档通过不代表 TypeScript/Swift/Kotlin/Java SDK 可用；生成后必须编译并跑真实响应 contract test。
- Problem Details RFC 9457：type/title/status/detail/instance 可复用，但业务 code、request_id、字段级错误要稳定扩展；不要让 detail 成为客户端解析来源。
- HTTP Semantics RFC 9110：GET/HEAD/PUT/DELETE 的安全和幂等语义影响缓存、重试和网关；GET 写数据、200 包失败都会污染平台行为。
- OAuth 2.1 / OIDC：授权码 + PKCE 是默认安全基线；校验 issuer、audience、exp、nbf、scope、nonce、state，回调 URI 精确匹配。
- OWASP API Security：BOLA/IDOR、Broken Auth、Excessive Data Exposure、SSRF、Unrestricted Resource Consumption 仍是 API 主线风险。
- GraphQL：defer/stream、subscription、batching、persisted query、federation 会放大鉴权、限流、N+1 和 schema 演进问题。
- gRPC / Protobuf：Proto3 optional、JSON transcoding、HTTP/2 代理、deadline、retry policy、stream backpressure、字段 reserved 必须写入契约。
- Webhook/Event：签名算法、原始 body、时间戳、nonce、事件 id、密钥轮换、乱序、DLQ replay 和补偿查询要成套。
- SSE/streaming：代理缓冲、心跳、取消、断线续传、partial JSON、usage 统计、error/done 事件和客户端超时都要定义。
- AI tool calling API：工具参数 schema、调用权限、幂等 action id、prompt injection 防护、审计日志、人工确认和速率限制是 API 契约的一部分。
- API gateway / header trust：网关注入身份、租户、IP、proto、trace header 前必须清洗外部同名头；应用要知道可信边界。
- ETag/CDN/304：用户相关响应需 private/no-store 或 Vary；ETag 不应泄露跨用户状态；304 也要重新遵守权限。
- Public API / Developer Experience：API key 生命周期、sandbox、portal、quickstart、SDK semver、changelog、SLA、支持边界和弃用窗口是公开契约的一部分。
- 批量与长任务：bulk API 要有 item-level status；长任务用 202 + operation resource/Location，定义查询、取消、结果过期和回调补偿。
- OWASP API 2024-2026：对象属性级授权、Mass Assignment、Unsafe Consumption、资源消耗、反自动化和租户隔离常与“普通参数校验”混在一起被漏审。
- API 安全边界：SSRF、文件上传、凭证型 CORS、CSRF、第三方错误透传、GraphQL errors/extensions 泄露需要独立样本验证。
- 隐私与数据最小化：PII 分类、字段脱敏、日志/trace 脱敏、审计保留期、删除/导出权和数据驻留要求必须进入契约风险。
- 商业 API：plan/entitlement、quota unit、usage metering、账单 request_id、租户/项目/API key 绑定影响限流、计费和审计一致性。

## 与相邻技能的边界

- 后端工程/backend-engineering（be）：负责控制器、中间件、服务实现、运行时配置、队列和健康检查；API 工程/api-engineering（api） 只定契约、状态码、幂等原则、消费者影响和回滚要求。
- 数据库工程/database-engineering（db）：负责表结构、索引、事务、迁移、锁和数据一致性；API 工程/api-engineering（api） 只提出分页键、状态机、幂等、字段兼容和 API 可见数据约束。
- GraphQL/gRPC/事件接口/graphql-grpc-events（gge）：负责 GraphQL resolver/DataLoader、gRPC/Proto、事件架构、DLQ/replay 的深水实现；API 工程/api-engineering（api） 负责 REST/GraphQL/gRPC/Event 选型边界和对外契约。
- Web 安全/web-security（wsec）：负责威胁建模、漏洞复现、CSRF/XSS/SSRF/注入、防护验证；API 工程/api-engineering（api） 负责认证授权契约、scope、BOLA/IDOR 检查点和安全状态码。
- 可观测性/observability（obs）：负责日志、指标、trace、SLO、告警、runbook；API 工程/api-engineering（api） 负责 request_id、错误分桶、审计字段、灰度指标和交付证据要求。
- 发布部署/release-engineering（rls）：负责 CI/CD、artifact、灰度、feature flag、回滚执行和发布门禁；API 工程/api-engineering（api） 负责版本化、Deprecation/Sunset、旧端并存和回滚契约。
- AI 工程/ai-engineering（aie）：负责模型、prompt、RAG、eval、tool use 安全和成本；API 工程/api-engineering（api） 负责 AI tool calling API、SSE/streaming 契约、工具参数 schema、幂等 action id 和客户端类型边界。
- 测试验证/test-engineering（tst）：负责测试矩阵、自动化、contract test 落地和回归证据；API 工程/api-engineering（api） 必须交付可测契约、样本、旧端兼容和灰度验证点。
- 代码审计/code-audit（aud）：负责完成前按需求、影响面、安全、回归和证据收口；API 工程/api-engineering（api） 在修改阶段不替代最终审计。
