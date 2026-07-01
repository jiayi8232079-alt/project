---
name: backend-engineering
description: 后端工程实战排障版技能 - 面向后端服务入口、路由/中间件、连接池、超时/重试/熔断、事务/锁、队列、缓存、配置/密钥、容器运行、健康检查、日志/指标/trace、OpenTelemetry、Kubernetes probe、serverless/edge runtime、SBOM/供应链的实战定位、修复和交付验证。涉及后端服务、运行时、API 主链路、依赖治理、线上排障、发布回滚时必须使用。
alwaysApply: false
---

# 后端工程实战排障版

## 快速总则

1. 先锁现场：服务名、语言/框架版本、运行时、入口命令、端口、路由挂载、中间件顺序、环境变量、镜像 tag、部署版本、区域/租户、请求样本、trace_id/request_id。
2. 先证据后结论：日志、指标、trace、错误码、堆栈、连接池状态、DB/Redis/MQ 状态、Kubernetes Event、probe 结果、最近发布/配置/依赖变更必须能复核。
3. 先画边界：入口 Handler/API → Middleware → Service/Domain → Repository/Client → DB/Cache/MQ/Task → Container/Runtime → Observability/Deploy。
4. 先查调用方和消费方：改路由、字段、错误码、配置 key、队列 topic、缓存 key、任务名、健康检查路径前后都要全量追踪生产者和消费者。
5. 后端默认有外部依赖：DB、Redis、MQ、HTTP/gRPC、对象存储、配置中心、密钥系统、身份提供方、Service Mesh、云托管限制都可能是根因。
6. 所有外部 I/O 必须有超时、取消传播、连接池上限、失败分类；重试必须有退避、抖动、上限、幂等前提和熔断/隔离。
7. 写链路默认考虑事务、锁、幂等键、唯一约束、状态机、补偿、回调重放和队列重复投递；禁止事务内做 HTTP/RPC/MQ 等不受控 I/O。
8. 容器/平台不是透明层：CPU throttling、内存 OOM、DNS、时钟、文件系统只读、信号处理、graceful shutdown、Kubernetes probe、serverless 冷启动都要纳入证据。
9. 配置和密钥默认高危：缺失应拒绝启动；Secret 不进仓库、镜像、日志、trace；轮换、缓存、权限和回滚要有方案。
10. 完成必须交付证据：改动点、影响面、验证命令/结果、未验证项、上线/回滚/监控要求；未跑不报通过，未读不报覆盖。

## 场景执行卡

### 1. 服务入口、路由与中间件
- 先查：启动命令、main/app factory、路由注册、base path、反向代理、网关、HTTP/2/HTTP/3、gRPC gateway、中间件顺序、静态资源/管理端口。
- 必做：鉴权、租户、限流、CORS、body size、request_id、recover、错误映射放在正确层；入口只做协议转换和校验。
- 验证：旧路径、前缀、OPTIONS、异常体、超大 body、未登录/无权限、反向代理转发头、健康检查路径。

### 2. API 主链路与服务分层
- 先查：Handler、DTO/schema、Service、Repository/Client、调用方、响应消费方、错误码兼容、版本策略。
- 必做：协议字段与领域模型分离；业务错误和基础设施错误分类；生产不泄露堆栈、SQL、内部路径、依赖地址。
- 验证：正常、空值、越界、旧客户端、字段缺省、异常响应、幂等重复请求。

### 3. 认证授权、租户和资源归属
- 先查：JWT/OIDC/session、issuer/audience、JWK 轮换、token claim、角色、租户、资源 owner、批量操作、后台任务身份。
- 必做：服务端强制鉴权和逐资源授权；只鉴登录不等于授权；401/403/404 语义兼顾安全和契约。
- 验证：过期 token、旧 token、角色切换、跨租户、IDOR/BOLA、批量混入、Webhook 回放。

### 4. 配置、密钥、运行时差异和平台差异
- 先查：env、配置文件、配置中心、Secret Manager、Kubernetes Secret/ConfigMap、Docker env、CI/CD 注入、默认值、启动顺序。
- 必做：关键配置缺失拒绝启动；密钥按最小权限和轮换窗口管理；本地默认值不得进入生产；配置变更绑定发布和回滚。
- 验证：dev/staging/prod 差异、缺配置启动、Secret 轮换、配置漂移、旧容器滚动期间双版本兼容。

### 5. DB、事务、锁和一致性
- 先查：事务边界、隔离级别、索引、唯一约束、外键/软删、状态机、旧数据、慢查询、锁等待、连接池。
- 必做：事务只包本地原子写；先落库再投递事件；金额用整数或 Decimal；幂等键和唯一约束兜底；锁有超时和释放路径。
- 验证：重复提交、并发扣减、死锁、锁超时、非法状态跳转、回滚失败、迁移前后兼容。

### 6. 连接池、超时、重试、熔断和限流
- 先查：HTTP/gRPC/DB/Redis/MQ 客户端配置、连接池上限、keepalive、DNS、TLS、取消传播、上下游 SLO。
- 必做：连接超时、读写超时、总超时分开；重试只对可重试且幂等错误；退避抖动和预算；核心依赖有熔断、限流、舱壁隔离。
- 验证：半开连接、下游 5xx/429、DNS 抖动、连接耗尽、重试风暴、熔断恢复、调用方取消。

### 7. Redis/缓存
- 先查：缓存模式、key 设计、TTL、序列化、标签基数、热点 key、穿透/击穿/雪崩、失效策略、权限边界。
- 必做：Cache-Aside 明确一致性窗口；TTL 抖动；互斥回源；负缓存；缓存 key 带租户/版本；故障时有降级或限流。
- 验证：hit/miss、Redis 故障、热点并发、过期风暴、旧 schema 反序列化、跨租户串数据。

### 8. MQ、队列、事件和后台任务
- 先查：topic/queue、消费组、投递语义、ACK 时机、DLQ、重试间隔、顺序键、任务调度、多实例、幂等键。
- 必做：消费者幂等；成功持久化后 ACK；失败分类进入重试或 DLQ；任务有锁、超时、告警、graceful shutdown。
- 验证：重复投递、乱序、积压、消费者重启、锁竞争、任务超时、DLQ 重放、部署期间信号终止。

### 9. 容器、Kubernetes、serverless 和 edge runtime
- 先查：镜像基础层、入口脚本、UID/GID、只读文件系统、资源限制、probe、HPA、PodDisruptionBudget、云函数限制、edge runtime API 限制。
- 必做：非 root、最小权限、SIGTERM 优雅停机、startup/readiness/liveness 分离；冷启动和连接复用；edge/serverless 不依赖本地持久文件或长连接假设。
- 验证：滚动更新、冷启动、OOMKilled、CPU throttling、探针误杀、DNS/证书、只读 FS、并发实例放大连接数。

### 10. 日志、指标、trace 和健康检查
- 先查：结构化日志字段、request_id/trace_id、OpenTelemetry SDK/Collector、采样、metrics 标签、告警、dashboard、探针路径。
- 必做：日志脱敏；trace 串联入口、DB、Cache、MQ、外部 HTTP/gRPC；metrics 覆盖 QPS、延迟、错误率、饱和度、积压；liveness 不查慢依赖，readiness 查关键就绪。
- 验证：异常请求可按 trace 定位、指标能触发告警、标签基数可控、Collector 故障不阻断主链路、probe 结果符合流量接入预期。

### 11. 发布、回滚、性能和供应链
- 先查：构建产物、lockfile、镜像 digest、SBOM、签名、CVE、迁移顺序、灰度策略、回滚兼容、profile/metrics baseline。
- 必做：迁移向前兼容；发布前冒烟；回滚不丢数据；依赖升级看 breaking changes、许可证、CVE、供应链攻击；性能优化先拿 profile 证据。
- 验证：构建可复现、CVE 命中版本、SBOM 生成、灰度指标、回滚演练、慢路径 profile、容量和连接池预算。

## 高频坑 / 防遗漏

- 改入口：查启动脚本、容器 CMD/ENTRYPOINT、进程管理、端口、路由前缀、网关、probe、反向代理转发头。
- 改中间件：查顺序、短路条件、异常处理、body 读取次数、流式响应、CORS、鉴权和限流互相影响。
- 改配置：查默认值、环境变量名、配置中心、Secret 注入、镜像变量、部署模板、回滚版本和配置漂移。
- 改连接池：查每实例连接数、HPA 最大副本、serverless 并发、数据库 max_connections、空闲回收、DNS/TLS keepalive。
- 改超时/重试：查调用方总预算、幂等性、退避抖动、熔断恢复、任务重试和队列重试是否叠加。
- 改事务/锁：查外部 I/O、隔离级别、死锁顺序、唯一约束、锁超时、补偿任务和状态机终态。
- 改缓存：查租户维度、TTL 抖动、热点 key、负缓存、旧 schema、删除/更新顺序和缓存预热。
- 改队列：查 ACK、DLQ、消费组、顺序键、重复消息、积压告警、重放脚本和消费者版本兼容。
- 改健康检查：查 startup/readiness/liveness 分工、超时时间、慢依赖、管理端口、网关健康路径和滚动更新行为。
- 改观测：查 trace_id 贯穿、日志脱敏、metrics 标签基数、采样率、Collector 出口、告警阈值和 dashboard。
- 改部署：查镜像 digest、资源 requests/limits、PDB、HPA、Secret、SBOM、签名、CVE、灰度和回滚。
- 改性能：先确定 baseline、profile、慢查询、连接池、锁等待、GC、CPU throttling；禁凭感觉调并发。

## 输出要求

1. 场景卡：命中的后端主场景和相邻场景。
2. 现场证据：运行时、平台差异、入口、路由/中间件、配置/密钥来源、依赖版本、复现样本、日志/指标/trace、DB/Redis/MQ/K8s 证据；缺失必须列明。
3. 影响层级：Handler、Middleware、Service、Repository、Client、DB、Cache、MQ、Task、Container、Deploy、Observability。
4. 风险点：鉴权授权、租户隔离、幂等、事务一致性、锁、并发、超时、重试、熔断、配置传播、连接池预算、消费方兼容、回滚、安全/供应链。
5. 验证方案：正常、边界、异常、权限、并发、依赖失败、回归、部署/回滚、观测告警；标明已验证/未验证和命令产出。
6. 交付证据：改动文件行号、配置/脚本/路由/迁移/监控改动、测试或构建输出、未覆盖原因、上线前检查项。
7. 联动技能：API 契约、DB、Web 安全、可观测性/SRE、发布、性能、云原生、DevSecOps、测试、审计是否已读取；未读取不能声称遵守。

## 约束

- 本技能只处理后端工程现场事实、链路排障和交付验证；不替代 api-design 的契约设计、db-design 的表/迁移设计、web-security 的专项安全审计。
- 未读入口、配置、依赖、调用方、消费方、部署和观测证据，不得下“已完成/已验证/可上线”结论。
- 证据不足先不改；连续两次修复无效必须停下复盘运行时、入口、配置、依赖和复现假设。
- 禁止为“架构更高级”无证据引入微服务、缓存、队列、service mesh、serverless、复杂中间件或全局重构。
- 外部输入默认不可信；鉴权、资源归属、租户隔离、批量逐项验权必须在服务端完成。
- 外部依赖必须有超时、取消传播、失败分类和隔离；重试必须受幂等、预算、退避、熔断约束。
- 事务内禁止外部 HTTP/RPC/MQ；跨资源一致性用 outbox、补偿、幂等和可观测重放，不用长事务幻想。
- 生产错误、日志、metrics、trace 不得泄露 Secret、token、Cookie、PII、SQL、内部路径和供应商凭据。
- 发布前必须有健康检查、监控告警、灰度/回滚、迁移兼容、配置/密钥和依赖故障预案。
- 涉测试/回归按 test-engineering 收口；任何代码改动完成前按 code-audit 收口。

## 高频 Bug 反例库

- 反例 1：配置默认值掩盖生产缺失
  - 错法：生产缺 DB_URL、SECRET_KEY、OIDC_ISSUER 时自动使用本地默认值启动。
  - 对法：关键配置启动期校验，生产缺失直接失败；默认值只允许本地并在日志标识。
  - 根因：把开发便利当生产容错，运行时配置来源和环境边界未被证据化。
- 反例 2：服务入口和实际容器命令不一致
  - 错法：只改本地 npm start 或 main 函数，线上 Docker ENTRYPOINT 仍跑旧 worker 或旧端口。
  - 对法：同时核对 Procfile、Dockerfile、K8s command/args、进程列表、端口和启动日志。
  - 根因：未确认真实运行入口，把源码入口误认为生产入口。
- 反例 3：中间件顺序导致鉴权绕过
  - 错法：路由先挂公开组，再挂 auth middleware，部分管理接口未经过鉴权。
  - 对法：按路由树核对中间件顺序，对敏感路由加服务端资源归属检查和测试。
  - 根因：只看单个 Handler，没验证路由注册、分组和短路逻辑。
- 反例 4：连接池按单实例估算
  - 错法：每个 Pod 配 100 个 DB 连接，HPA 到 30 副本后打满数据库 max_connections。
  - 对法：按副本上限、serverless 并发、后台任务和迁移脚本统一计算连接预算。
  - 根因：忽略平台扩缩容和多进程模型，连接池缺少全局容量约束。
- 反例 5：重试无退避和幂等前提
  - 错法：下游 5xx 立即循环重试 POST 创建订单，造成重复写和故障放大。
  - 对法：只对幂等操作或带幂等键请求重试，设置指数退避、抖动、上限、熔断和总预算。
  - 根因：把重试当可靠性万能药，未区分错误类型、幂等性和调用链 SLO。
- 反例 6：事务内调用外部服务
  - 错法：DB 事务未提交时调用支付、HTTP、MQ，超时后锁长时间占用且外部副作用不可回滚。
  - 对法：事务内只写本地状态和 outbox，提交后异步投递，失败由补偿和幂等重放处理。
  - 根因：混淆本地 ACID 和分布式副作用，事务边界设计错误。
- 反例 7：队列消费 ACK 过早
  - 错法：收到消息立即 ACK，再写 DB，写失败后消息丢失且无 DLQ。
  - 对法：业务持久化成功后 ACK；失败按可重试/不可重试分类进入重试或 DLQ；消费者幂等。
  - 根因：未理解消息投递语义和失败窗口，缺少重放证据。
- 反例 8：缓存 key 缺租户和版本
  - 错法：用 user:{id} 缓存资料，多租户或 schema 升级后串数据/反序列化失败。
  - 对法：key 包含租户、业务版本和必要权限维度，旧 schema 兼容或批量失效。
  - 根因：缓存被当作透明加速层，忽略权限边界和数据演进。
- 反例 9：Kubernetes liveness 查慢依赖
  - 错法：liveness 每次查询 DB/外部 HTTP，依赖抖动时 kubelet 反复杀 Pod。
  - 对法：liveness 只证明进程可恢复，readiness/startup 用短超时检查关键就绪。
  - 根因：混淆存活、启动和接流量语义，probe 设计未结合滚动更新。
- 反例 10：日志和 trace 泄露密钥
  - 错法：把 Authorization、Cookie、手机号、支付参数、连接串完整写入日志和 span attribute。
  - 对法：字段白名单、脱敏、采样控制、敏感 attribute 过滤和日志平台访问控制。
  - 根因：观测数据被当成内部安全区，未按生产数据治理处理。
- 反例 11：OpenTelemetry Collector 故障阻断主链路
  - 错法：同步导出 trace，Collector 慢或不可用时请求延迟暴涨。
  - 对法：异步批量导出、超时和丢弃策略，Collector 故障只降级观测不阻断业务。
  - 根因：把观测依赖放进请求关键路径，缺少 backpressure 和失败预算。
- 反例 12：serverless/edge runtime 依赖本地状态
  - 错法：在 /tmp 或进程内缓存保存会话、锁或队列 offset，实例回收后状态丢失。
  - 对法：状态放外部持久服务；冷启动、并发实例和 edge runtime API 限制单独验证。
  - 根因：沿用长驻容器假设，忽略无状态和运行时 API 差异。
- 反例 13：供应链只看直接依赖版本
  - 错法：升级框架后不检查传递依赖、镜像基础层、构建插件、许可证和签名。
  - 对法：生成 SBOM，扫描 CVE，核对 lockfile、镜像 digest、签名/SLSA provenance 和 breaking changes。
  - 根因：把依赖治理局限在 package.json/go.mod，忽略构建链和镜像层。

## 提交前自检清单

- [ ] 已确认运行时、入口命令、路由/中间件、配置/密钥来源、依赖版本和部署形态。
- [ ] 已全量追踪调用方、消费方、配置 key、缓存 key、队列 topic、任务名、健康检查路径。
- [ ] 已覆盖鉴权授权、租户隔离、错误映射、日志脱敏和生产错误不泄露内部细节。
- [ ] 已检查连接池预算、超时、取消传播、重试退避、熔断、限流和依赖失败路径。
- [ ] 已检查事务边界、锁、幂等、唯一约束、状态机、补偿和队列重复投递。
- [ ] 已检查缓存一致性、TTL、热点、穿透/击穿/雪崩、租户维度和旧 schema。
- [ ] 已检查容器非 root、资源限制、graceful shutdown、Kubernetes probe、serverless/edge runtime 差异。
- [ ] 已检查日志、指标、trace、OpenTelemetry、告警和健康检查是否能支撑排障。
- [ ] 已检查 SBOM、CVE、签名/来源、镜像 digest、Secret、灰度、回滚和迁移兼容。
- [ ] 已给出测试/构建/验证命令产出；未验证项已标明原因；代码改动已走 test-engineering 和 code-audit。

## 2024-2026 新坑速查

- OpenTelemetry 语义约定和 SDK/Collector 版本变化会影响 span name、attribute、metrics 名称和采样；升级前后要比对 dashboard/alert 查询。
- OTLP 默认协议、压缩、批量导出和 Collector pipeline 变化可能让 trace 丢失或延迟暴涨；业务线程不得同步等待导出。
- Kubernetes 1.28-1.34 周期内 sidecar containers、probe 行为、资源指标、gateway/service mesh 集成持续演进；不要用旧模板套新集群。
- Kubernetes startupProbe/readiness/liveness 配错会在滚动更新、冷启动、慢迁移时放大故障；探针要绑定真实接流量条件。
- HTTP/3、gRPC、proxy protocol、X-Forwarded-*、Forwarded headers 在网关/CDN/mesh 后语义不同；鉴权、限流和真实 IP 不能猜。
- serverless 和 edge runtime 常限制 TCP 长连接、本地文件、后台线程、执行时长、Node/Python 标准库；连接池和缓存策略要按平台重算。
- 容器基础镜像、distroless、非 root、只读文件系统会暴露写临时目录、CA 证书、字体/时区、shell 依赖问题。
- SBOM、SLSA provenance、Sigstore/cosign、npm/pypi token 生命周期和 2FA 政策变化让构建凭据、发布权限、依赖来源成为上线门槛。
- Redis/Kafka/DB 云托管默认 TLS、ACL、连接上限、空闲回收、跨 AZ 延迟和维护窗口会改变本地压测结论。
- AI/LLM、Webhook、支付回调、第三方 SaaS 更常见长尾超时和回放；幂等、签名校验、异步补偿必须落到后端主链路。
- eBPF/continuous profiling 更普及，但 profiling 证据必须和版本、流量、CPU throttling、GC、锁等待一起解释，不能单图下结论。
- 供应链投毒和 typosquatting 更频繁；新增构建插件、GitHub Action、Docker action、下载脚本时要审来源、权限和 pin 到 digest/commit。

## 与相邻技能的边界

- api-design：负责 API 契约、资源模型、状态码、版本、兼容和认证语义；backend-engineering 负责契约在路由/中间件/服务分层中的落地证据。
- db-design：负责表结构、迁移、索引、SQL、事务模型和数据一致性专项；backend-engineering 负责调用链事务边界、连接池、锁等待和运行时影响。
- web-security：负责漏洞专项、攻击面、BOLA/IDOR、注入、XSS/CSRF/SSRF 等安全审计；backend-engineering 负责默认安全基线和服务端鉴权落地。
- observability-sre：负责 SLO、告警、事件响应、容量和可观测平台；backend-engineering 负责代码链路日志/指标/trace/health 的埋点与排障证据。
- release-engineering：负责构建、部署、灰度、回滚和发布流程；backend-engineering 负责服务入口、配置、迁移兼容和运行时健康条件。
- perf-engineering：负责系统性压测、profile、容量模型和性能专项；backend-engineering 负责超时、连接池、锁、缓存、队列等性能风险的工程落地。
- cloud-native：负责 Kubernetes、容器、Service Mesh、云原生平台专项；backend-engineering 负责后端服务在这些平台上的运行时假设和健康检查证据。
- devsecops：负责 CI/CD 安全、SBOM、签名、凭据和供应链治理；backend-engineering 负责依赖/镜像/密钥变更对服务运行和交付的影响。
- test-engineering：负责测试矩阵、自动化、回归和验证可信度；backend-engineering 提供后端风险场景和复现证据。
- code-audit：负责最终需求对账、影响面、安全质量和证据收口；backend-engineering 完成修改后必须交由其复盘。
