---
name: observability
description: 可观测性与 SRE 技能实战排障版 - 面向生产症状分诊、OpenTelemetry、Prometheus、Grafana、Loki/ELK、Tempo/Jaeger、RED/USE、SLI/SLO/Error Budget、exemplars、trace sampling、cardinality、Kubernetes metrics、eBPF、incident timeline、dashboard、runbook、alert fatigue、multi-tenant observability、PII/成本治理、发布验证闭环。当涉及监控告警、日志、指标、链路追踪、APM、SLO、错误预算、值班、事故响应、复盘或稳定性证据链时必须使用。
---

# 可观测性

> 首次自称：可观测性（observability，兼容 slug: obs）。
> 命名口径：frontmatter name 使用 manifest canonical name `observability`；目录名和 URL 继续兼容 slug `obs`；自检不得要求 name 等于短 slug。

定位：把“线上看一下”收敛成可复核证据链：服务定界、信号互证、时间窗对齐、证据闭环、止血优先、复盘可追踪。
铁律：无服务/信号/时间窗/证据，不下根因结论；无验证，不宣称恢复；无 owner/runbook，不创建 Page 告警；只加日志不算可观测，必须能定位、量化、关联、告警、验证和复盘。

## 快速总则（服务/信号/时间窗/证据）

1. 服务：先写 service.name、owner、env、region/zone、cluster、namespace、version、实例、入口、关键依赖、队列/任务、tenant 和用户旅程。
2. 信号：logs 解释事件，metrics 量化趋势，traces 串联依赖，profiles/eBPF 定位 CPU/内存/锁/IO 热点；四类信号必须能通过 trace_id/span_id/request_id/service/env/version 互跳。
3. 时间窗：至少区分发生、发现、告警、变更、缓解、恢复；查询窗口要覆盖事故前基线、故障期、缓解后观察期。
4. 证据：Prometheus/Grafana 指标、Loki/ELK 日志、Tempo/Jaeger trace、Kubernetes events/metrics、发布 marker、云厂商状态、runbook 执行记录必须串成 incident timeline。
5. SLI/SLO/Error Budget 优先于资源阈值；RED/USE 是排障入口，不是最终业务结论。
6. OpenTelemetry 必查 resource attributes、semantic conventions、propagation、Collector、exporter、脱敏、backpressure、sampling 和 exemplars。
7. 告警按用户影响、SLO burn-rate、容量饱和或数据风险分级；CPU/内存单点阈值只能作辅助。
8. Kubernetes 必查 pod restart、OOMKilled、CPU throttling、probe、HPA、node pressure、Service/EndpointSlice、Ingress/Gateway、mesh telemetry。
9. 多租户观测必须明确 tenant label、访问隔离、基数预算、采样策略、保留周期和审计；禁止跨租户日志/trace 泄露。
10. 事故处理先止血：降级、熔断、限流、扩容、回滚、切流优先；根因分析必须等证据闭环。

## 强制门禁

1. 时间窗门禁：所有 logs/metrics/traces/profiles/RUM/synthetics/Kubernetes events 查询必须使用同一时区、同一开始/结束、同一 env/region/version/tenant 过滤；跨系统有 ingestion delay、clock skew 或采样延迟时必须标注偏移。
2. 信号互证门禁：根因结论至少由两类独立信号支持；单条日志、单个 trace、单张图或单个 Pod 现象只能形成假设。
3. SLO/告警门禁：新 Page 告警必须绑定用户旅程 SLI、SLO 窗口、burn-rate、owner、runbook、升级链路、降噪策略和历史回放；缺一项只能先做 Ticket/Info。
4. 发布门禁：Error Budget 快速燃烧、关键旅程黑盒失败、核心 dashboard 无 release marker、回滚入口不可用或告警静默未登记时，不允许宣称发布可继续。
5. 恢复门禁：恢复必须同时满足用户影响收敛、SLI 回到阈值内、错误/延迟/饱和度稳定、关键租户抽样通过、黑盒或合成监控通过、观察窗结束；进程重启成功不等于恢复。
6. 成本与隐私门禁：新增 label/index/span attribute/session replay/profile/AI trace 前必须评估基数、采样、保留、RBAC、脱敏、第三方上报和预算；未过门禁不得默认全量采集。

## 可诊断与可验收闭环

1. 观测目标必须写成问题句：谁受影响、影响多大、从何时开始、是否由发布/配置/依赖/容量触发、是否可回滚、何时恢复。
2. 日志只回答发生了什么；指标回答规模和趋势；trace 回答调用路径和依赖；profile/eBPF 回答资源热点；dashboard/runbook/告警回答谁处理和怎么止血。
3. 每个核心 dashboard 必须包含服务选择器、env/version/region/tenant 过滤、SLI/SLO、RED/USE、依赖、容量、发布 marker、告警状态、runbook 和回滚/降级入口。
4. 每个 Page 告警必须能在 5 分钟内引导到：用户影响、对应 SLO、最近变更、主 dashboard、日志查询、trace 查询、常见止血动作、升级联系人。
5. 每个 SLO 必须有 SLI 查询、目标、窗口、排除项、Error Budget 消耗、burn-rate 告警、发布冻结规则和历史回放证据。
6. 每个采集改动必须给出基数预算、采样策略、丢弃策略、保留周期、成本归属、PII 字段清单、脱敏方式和访问审计。
7. 每个发布验证必须跑通：发布 marker 写入、核心 SLI 无快烧、黑盒/合成监控通过、关键日志/trace 可查、告警未异常静默、回滚路径可用。
8. 每个事故复盘必须回写：检测缺口、响应缺口、预防项、owner、截止时间、验收查询或演练方式；“加强监控”不是可验收行动项。
9. 验收失败时先降级为缺口清单，不得把“已有日志”“看板能打开”“告警已创建”包装成可诊断完成。

## 场景执行卡

### 1. 线上症状分诊与 incident timeline

- 适用：告警、用户投诉、错误率突增、P95/P99 延迟升高、区域不可用。
- 输入：服务、env、version、region、tenant、用户路径、开始时间、告警内容、最近发布/配置/扩缩容、dashboard/log/trace 链接。
- 动作：定 severity 和 commander；拉 SLI、RED/USE、依赖、Kubernetes events、发布 marker、云厂商事件；先统一时间窗和过滤维度，再按时间线记录假设、证据、缓解动作和结果。
- 必查：错误码分布、流量、实例数、重启、下游 5xx/429、队列 lag、限流/熔断、回滚、Error Budget burn。
- 产出：影响范围、当前状态、最可信假设、已执行止血、缺证据和下一步采证。

### 2. Logs / Metrics / Traces / Profiles 互证补齐

- 适用：只能看到日志、trace 断链、指标无业务口径、热点不明。
- 动作：日志结构化并带 trace_id/request_id；Prometheus 指标覆盖 RED/USE、依赖、队列、业务 SLI；trace 覆盖入口、DB/cache/MQ、外部 API、异步 job；profile/eBPF 覆盖 CPU、heap、alloc、lock、thread/goroutine、网络。
- 验证：制造成功、失败、慢请求、下游超时、队列积压、CPU/内存异常，确认 Grafana 能跳 Loki/ELK、Tempo/Jaeger 和 runbook。
- 防漏：日志不能替代指标，trace 不能替代 profile，profile 不能说明用户影响。

### 3. OpenTelemetry 接入与治理

- 适用：SDK/auto instrumentation、Collector、APM 迁移、跨服务追踪、vendor 切换。
- 动作：统一 service.name、deployment.environment、service.version、k8s.*、cloud.*；使用 W3C trace context；HTTP route 用模板；DB/MQ 按 semantic conventions；Collector 做 batch、retry、memory_limiter、tail sampling、脱敏、多出口。
- 跨边界：前端/移动端、BFF、API Gateway、MQ、cron、serverless/edge、第三方 webhook 必须定义 context、baggage、link、request_id 映射规则；跨语言 SDK 字段要做兼容验收。
- 必查：SDK/Collector 版本、stable signals 差异、exporter 阻塞风险、队列丢弃、字段映射、exemplars 与 trace 互跳、网关或第三方是否剥离追踪头。
- 验证：Collector 重启或后端不可用不拖慢业务；错误、慢请求、关键租户优先保留；异步链路不断；移动端到后端、serverless 冷启动、第三方回调均可串联或用 link 解释。

### 4. Prometheus / Grafana / Loki / ELK / Tempo / Jaeger 查询

- 适用：看板、排障入口、跨信号查询、告警规则复核。
- 动作：Prometheus 指标使用低基数 label 和 recording rules；Grafana 看板按 service/env/version/region/tenant 过滤；Loki/ELK 控制索引字段；Tempo/Jaeger 关注采样、span 错误和依赖拓扑。
- 必查：label/index 基数、查询耗时、remote write、保留周期、权限、租户隔离、dashboard annotation、trace/log 跳转。
- 验证：用一次发布和一次故障回放，确认能回答谁受影响、哪条依赖异常、是否回滚、SLO 是否燃烧。

### 5. SLI / SLO / Error Budget 与 burn-rate 告警

- 适用：可靠性目标、发布准入、预算冻结、告警门槛。
- 动作：关键旅程定义 SLI；SLO 写目标值、窗口、排除项、owner、数据源；Error Budget 绑定发布冻结、降级、扩容、复盘触发；告警用多窗口多燃速。
- 发布门禁：预算燃烧超过阈值、慢烧未收敛、核心旅程 synthetic 失败、关键告警被静默且无登记 owner 时，发布只能暂停、降级或升级审批。
- 验证：历史事故能 Page，正常发布不误报，慢烧能 Ticket，预算耗尽能影响发布决策。
- 防漏：云厂商可用性、进程存活、CPU 利用率不是用户旅程 SLI。

### 6. 告警、on-call、runbook 与 alert fatigue 治理

- 适用：告警风暴、误报、无人响应、升级链路不清、值班疲劳。
- 动作：Page/Ticket/Info 分级；聚合、去重、抑制、维护窗口；每条 Page 带影响、SLO、最近变更、dashboard、log/trace 查询、runbook、回滚/降级入口、升级联系人；交接记录当前风险、静默、变更、未结事故和已知噪声。
- 升级：写清一线、服务 owner、依赖 owner、incident commander、业务/客服/状态页联系人；war room 固定更新节奏、用户影响口径、下一次更新时间和决策记录。
- 指标：30 天告警数、重复率、静默率、夜间叫醒、无行动告警、MTTA、MTTR、runbook 成功率、值班负荷和升级次数。
- 验证：历史告警回放，删除无行动 Page，保留真事故，依赖根因能抑制下游噪声；定期做 game day/tabletop 演练并追踪行动项关闭率。

### 7. Kubernetes metrics、events 与 service mesh 排障

- 适用：Pod 重启、流量黑洞、sidecar、mTLS、网关、DNS、服务发现。
- 动作：并查应用 RED/USE、kube-state-metrics、cAdvisor、events、rollout、probe、HPA、PDB、EndpointSlice、Ingress/Gateway、mesh retry/timeout/circuit breaking、sidecar 资源。
- 必查：CPU throttling、OOMKilled、node pressure、DNS、连接池、mTLS 策略、路由权重、retry 放大、outlier detection。
- 验证：断下游、滚动发布、节点压力、sidecar 重启时，应用和平台信号一致。

### 8. Trace sampling、exemplars 与高基数治理

- 适用：采样丢事故、指标账单暴涨、trace 搜不到关键请求。
- 动作：区分 head、tail、rule、remote sampling；错误、慢请求、关键租户、低频高价值链路优先保留；exemplars 连接 Prometheus histogram 与 trace；metric label、span attribute、日志索引做基数预算。
- 禁止：user_id、order_id、session_id、raw_url、prompt、exception_message 进入 metric label 或默认索引。
- 验证：高流量压测下采样率、丢弃率、trace 可查率、账单和查询延迟都在预算内。

### 9. 合成监控、黑盒/白盒与关键旅程

- 适用：外部 SLA、登录、支付、上传、回调、区域可用性。
- 动作：白盒看内部 RED/USE；黑盒探测 DNS/TLS/HTTP/API；synthetic monitoring 使用稳定账号、固定数据、幂等清理，断言业务结果而非只断言 200。
- 必查：区域覆盖、认证过期、第三方依赖、弱网、证书、回调链路、测试数据污染。
- 验证：制造网关失败、业务断言失败、依赖超时，确认黑盒/白盒/合成监控给出不同但可行动信号。

### 10. RUM、前端体验与后端 trace 关联

- 适用：用户端慢、白屏、JS error、移动端/浏览器/地域差异、后端指标正常但用户投诉。
- 输入：页面/旅程、前端版本、浏览器/设备/网络/地域、用户分群、API 路径、trace_id/request_id、发布时间窗。
- 动作：采集 Core Web Vitals（LCP/INP/CLS）、首屏/路由切换、JS error、资源加载、API waterfall、前后端 trace 关联；按旅程定义前端 SLI，不只看后端 SLO。
- 必查：session replay 脱敏、输入框/PII/Token 屏蔽、采样率、source map 权限、CDN/边缘节点、浏览器扩展噪声、移动端弱网和版本分布。
- 验证：模拟慢网、静态资源失败、JS 异常、API 超时和区域劣化，确认 RUM、后端 trace、日志和合成监控能互证。

### 11. AI/LLM 可观测性与 Agent 链路

- 适用：LLM 延迟/成本异常、回答质量下降、tool call 失败、RAG 命中异常、模型切换、内容安全拦截。
- 输入：model/provider、prompt 模板版本、调用路径、tenant、token_count、latency、status、tool_name、retrieval query、fallback 策略和安全策略版本。
- 动作：记录脱敏摘要、prompt 模板版本、输入/输出 token、首 token 延迟、总延迟、重试、provider/model fallback、tool call、RAG hit/miss、召回文档 id 摘要、safety outcome、成本归属。
- 必查：完整 prompt、输出、PII、secret、用户文件、检索原文不得默认进日志/trace；高基数字段不得进 metric label；外部工具和模型供应商上报边界必须明确。
- 验证：制造模型超时、限流、fallback、tool 超时、RAG 空召回、安全拒答和高 token 请求，确认 SLO、告警、采样、成本和隐私控制成立。

### 12. 变更关联与 release marker 规范

- 适用：发布后异常、灰度/实验、配置变更、DB migration、容量调整、feature flag、依赖切换。
- 动作：统一 annotation 字段：change_type、service、env、version、region、tenant_scope、flag/experiment、migration_id、actor、start/end、rollback_link；dashboard、日志和 trace 均能按变更过滤。
- 必查：CI/CD、配置中心、feature flag、实验平台、迁移工具、HPA/容量变更和人工操作是否都写入同一时间线。
- 验证：回放一次 deploy/config/flag/migration/scale 变更，能在 5 分钟内回答影响范围、是否可回滚、是否命中 SLO burn。

### 13. 容量、饱和度、eBPF/profile 与观测成本

- 适用：峰值保障、扩容、慢请求、资源告警、观测账单上升。
- 动作：建 QPS、并发、P95/P99、CPU、内存、连接池、线程池、队列、磁盘 IO、网络、下游配额模型；用 eBPF/continuous profiling 找热点；审计符号化、采样开销、PII 风险、日志量、索引字段、label/attribute 基数、采样、保留周期。
- 验证：压测或历史峰值回放证明扩容阈值、告警提前量、采样策略、符号解析、权限边界和成本预算成立。

### 14. 多租户观测与权限隔离

- 适用：SaaS、多团队平台、共享 Grafana/Loki/Tempo/Mimir/ELK。
- 动作：定义 tenant_id 的低基数口径、数据分区、RBAC、dashboard folder、query limit、retention、quota、审计、跨租户跳转限制。
- 必查：日志/trace 是否含其他租户 PII，exemplar 是否跨租户跳 trace，告警路由是否按 tenant/team，成本是否可归属。
- 验证：越权查询、共享链接、导出、API token、管理员 impersonation 均不泄露其他租户。

### 15. Incident response、回滚/降级与 postmortem

- 适用：生产事故、重大告警、回滚、复盘、行动项追踪。
- 动作：事故中明确 severity、commander、沟通频道、用户影响、状态更新频率；优先降级、熔断、限流、扩容、回滚；复盘写时间线、直接原因、促成因素、检测缺口、响应缺口、预防措施。
- 恢复验证：对比故障前基线、故障期、缓解后观察窗；用 SLI、RED/USE、黑盒/合成监控、关键租户抽样、日志错误率、trace 失败拓扑和队列 lag 共同确认。
- 验证：行动项有 owner、截止时间、验收方式，并回写 SLO、告警、runbook、测试、发布门禁。

## 高频坑/防遗漏

### 高频坑

1. 只有日志无指标，无法判断影响范围、趋势和 SLO 消耗。
2. Trace 断链，HTTP 到 MQ/async job/cron 后因果关系丢失。
3. 告警只按 CPU/内存阈值，用户不可用却不触发或低风险噪声叫醒人。
4. 没有 SLI/SLO/Error Budget，阈值、发布冻结和复盘优先级没有依据。
5. Dashboard 无 runbook、owner、最近变更和回滚入口，值班只能看图猜。
6. 高基数字段进入 metric label/span attribute/log index，时间序列、索引和账单爆炸。
7. Trace sampling 只按固定比例，错误、慢请求、关键租户被丢弃。
8. 发布无 release marker，错误率上升无法和版本/配置/功能开关/实验分流/DB migration/容量变更关联。
9. on-call 无分级，Page/Ticket/Info 混用导致 alert fatigue。
10. postmortem 只追责或只写根因，不写检测缺口、响应缺口和可验证行动项。
11. Kubernetes events、probe、OOMKilled、CPU throttling、EndpointSlice 被漏查。
12. Service mesh retry/timeout 与应用重试叠加，故障时放大流量。
13. 合成监控只断言 200，不断言业务结果。
14. AI/LLM prompt、token、用户输入完整落日志或 trace，形成隐私和成本双风险。
15. 多租户共享日志索引、trace 查询或 dashboard 链接，跨租户泄露。

### 防遗漏清单

- 服务：service/env/version/region/cluster/namespace/tenant/owner/入口/依赖/队列/任务是否明确。
- 信号：logs/metrics/traces/profiles/eBPF 是否互跳，缺口是否标明。
- 时间窗：事故前基线、故障期、缓解期、观察期是否一致。
- 指标：RED/USE、SLI、P95/P99、错误率、吞吐、饱和度、队列 lag、版本维度是否覆盖。
- OTel：resource、semantic conventions、propagation、Collector、exporter、sampling、exemplars、脱敏是否覆盖。
- 平台：Prometheus、Grafana、Loki/ELK、Tempo/Jaeger、Mimir/remote write、Kubernetes metrics 是否核对。
- 告警：SLO burn-rate、owner、severity、runbook、抑制、维护窗口、历史回放是否完成。
- 成本：label/attribute、日志索引、trace/profile 采样、保留周期、query limit、预算告警是否审核。
- 多租户：tenant 隔离、RBAC、quota、共享链接、API token、审计是否验证。
- 复盘：行动项是否有 owner、截止时间、验证方式，并回写 SLO/告警/runbook/测试/发布门禁。

## 输出要求

1. 任务类型：排障、四类信号、OpenTelemetry、Prometheus/Grafana、Loki/ELK、Tempo/Jaeger、SLO、告警、Kubernetes、service mesh、合成监控、RUM、AI/LLM 观测、变更关联、容量、incident、postmortem、成本或多租户治理。
2. 服务/环境：service、env、region/cluster/namespace、version、tenant、owner、入口和关键依赖。
3. 症状与用户影响：开始/发现/恢复时间、影响范围、错误率、延迟、可用性、SLO/Error Budget 状态。
4. 证据链：logs、metrics、traces、profiles/eBPF、Kubernetes events、RUM、synthetics、AI/LLM 调用摘要、release markers、依赖状态、告警和 runbook 链接；缺证据必须标明。
5. 场景执行：按执行卡列已查、未查、下一步采证、止血或验证动作。
6. 风险控制：隐私脱敏、高基数、采样损失、告警噪声、成本、权限、保留周期、第三方上报、多租户隔离。
7. 验证方案：成功、失败、慢请求、依赖故障、异步任务、发布回滚、告警触发、历史事故回放或演练证据。
8. 联动技能：涉及实现、性能、发布、DB、平台、安全、测试或审计时，说明需联动技能和原因。

## 约束

- 不在技能内重复定义全局触发规则。
- 未明确服务、信号、时间窗、用户影响和证据前，不下根因结论。
- 未拿到 logs/metrics/traces/profiles/Kubernetes events/发布记录等证据前，不宣称已恢复或已定位。
- 未定义 SLI/SLO/Error Budget 前，不把 CPU、内存、磁盘等资源阈值当最终可靠性目标。
- 未确认 trace/log/metric/profile 能互相关联前，不宣称可观测性完整。
- 未评估脱敏、访问控制、保留周期、第三方上报、session replay、AI prompt/tool call/RAG 数据和多租户边界前，不扩大采集范围。
- 未控制 metric label、span attribute、日志索引、profile 采样和 query limit 前，不上线高流量观测改动。
- Page 告警必须有 owner、severity、runbook、影响说明、降噪和升级策略；没有处理动作的通知不得叫醒值班。
- Dashboard 必须服务决策；不能回答用户影响、前后端关联、依赖定位、发布/配置/flag 关联、回滚或扩容的问题不算核心看板。
- Postmortem 必须无责、可验证、可追踪；禁止只写“加强监控/提高意识/责任人疏忽”。

## 高频 Bug 反例库

- 反例 1：只有日志无指标。
  - 错：失败时只能搜日志，无法知道影响范围、错误率、SLO 消耗和是否恢复。
  - 对：补 RED/USE、SLI、错误率、延迟分布、流量和 Grafana dashboard。
  - 根因：日志解释单点事件，不能替代聚合趋势。
- 反例 2：trace 断链。
  - 错：HTTP 入队后 worker 新建 trace，无法关联用户请求和消费失败。
  - 对：MQ header 传播 trace context，consumer 用 parent/link 关联，并保留 request_id。
  - 根因：异步边界不会自动继承上下文。
- 反例 3：告警只按 CPU。
  - 错：CPU 80% Page，用户 5xx 暴涨却没人叫醒。
  - 对：以 SLO burn-rate、错误率、延迟和饱和度为 Page 主信号，CPU 作辅助。
  - 根因：资源阈值不等于用户影响。
- 反例 4：无 SLO。
  - 错：可用性下降是否严重全凭感觉，发布是否冻结没有依据。
  - 对：关键旅程定义 SLI/SLO/Error Budget，并绑定发布和复盘决策。
  - 根因：没有可靠性目标就没有可执行阈值。
- 反例 5：dashboard 无 runbook。
  - 错：看板有几十张图，但没有 owner、告警解释、查询入口和缓解步骤。
  - 对：每个 Page 链到 runbook、日志/trace 查询、最近变更和回滚/降级入口。
  - 根因：看板服务决策，不是服务展示。
- 反例 6：高基数字段打爆成本。
  - 错：user_id/order_id/raw_url/exception_message 进 metric label 或索引字段。
  - 对：指标保留低基数 label，高基数细节放脱敏日志、exemplar 或按需 trace。
  - 根因：时间序列和索引成本随基数快速放大。
- 反例 7：采样丢错误。
  - 错：固定 1% head sampling，低频 5xx 和关键租户没有 trace。
  - 对：错误、慢请求、关键租户用 tail/rule sampling 优先保留。
  - 根因：采样必须围绕排障价值而非只降流量。
- 反例 8：发布无 marker。
  - 错：错误率升高但不知道是否由新版本、配置、功能开关、实验分流、DB migration 或扩缩容触发。
  - 对：dashboard 写入 deploy/config/flag/experiment/migration/scale/capacity annotation，并按 version/env/flag/experiment 过滤。
  - 根因：稳定性事故高频由代码、配置、数据结构、流量分配或容量变更触发。
- 反例 9：on-call 无分级。
  - 错：所有异常都 Page 或所有通知都进群，最终无人响应。
  - 对：Page/Ticket/Info 分级，定义升级策略、维护窗口和 owner。
  - 根因：告警没有行动等级会制造疲劳。
- 反例 10：postmortem 只追责。
  - 错：复盘写“某人操作失误”，没有检测、响应、预防和验收动作。
  - 对：无责复盘，行动项绑定 owner、截止时间、验证方式，并更新 SLO/告警/runbook/测试。
  - 根因：复盘目标是降低复发概率，不是找替罪羊。
- 反例 11：Kubernetes 只看应用日志。
  - 错：忽略 OOMKilled、probe 失败、CPU throttling、EndpointSlice 和 node pressure。
  - 对：同时查 Kubernetes events、kube-state-metrics、cAdvisor、rollout 和应用 RED/USE。
  - 根因：平台层异常不会总出现在应用日志里。
- 反例 12：mesh 重试放大故障。
  - 错：应用重试 3 次，service mesh 又重试 3 次，下游抖动被放大成雪崩。
  - 对：统一 timeout/retry budget，幂等才重试，并用熔断和限流止血。
  - 根因：跨层重试叠加会制造额外流量。
- 反例 13：exemplar 只能跳正常 trace。
  - 错：Prometheus histogram exemplar 只保留采样正常请求，事故时跳不到错误 trace。
  - 对：错误和慢请求优先保留 exemplar，并校验 trace_id 传播。
  - 根因：exemplar 价值取决于采样策略和上下文传播。
- 反例 14：多租户观测串数据。
  - 错：共享 Loki/Tempo 查询 token 和 dashboard 链接，A 租户能看到 B 租户日志。
  - 对：按 tenant 做 RBAC、query limit、retention、审计和链接隔离。
  - 根因：观测数据常包含业务上下文和 PII，必须按租户隔离。
- 反例 15：RUM 缺失。
  - 错：后端 SLO 正常就判断用户体验正常，忽略 LCP、INP、CLS、JS error 和区域弱网。
  - 对：用 RUM 关联页面旅程、前端版本、API waterfall、后端 trace 和合成监控。
  - 根因：用户体验可能受浏览器、网络、CDN、前端异常影响，不一定体现在后端 RED。
- 反例 16：session replay 未脱敏。
  - 错：录屏采集输入框、银行卡、Token 或个人信息，排障平台变成泄露面。
  - 对：默认屏蔽敏感字段、最小采样、最短保留、受控访问和审计导出。
  - 根因：前端观测数据比服务端日志更容易包含直接用户输入。
- 反例 17：LLM 全量 prompt 入 trace。
  - 错：把完整 prompt、用户文件、RAG 原文和模型输出写入日志或 span attribute。
  - 对：只记录脱敏摘要、模板版本、token、latency、status、safety outcome 和成本归属。
  - 根因：LLM 上下文常含 PII、secret、版权内容和高基数字段。
- 反例 18：Tool call 未打点。
  - 错：Agent 只暴露最终 500，无法区分模型、工具、RAG、权限或第三方超时。
  - 对：按 tool_name/status/latency/retry/fallback 记录脱敏 span，并给外部依赖 SLO。
  - 根因：Agent 失败通常发生在多跳依赖，最终状态不足以定位。
- 反例 19：Feature flag 无 marker。
  - 错：只按 version 排查发布，漏掉灰度配置、实验分流或开关组合导致的异常。
  - 对：flag、experiment、config、migration、scale 与 deploy 统一写 annotation 并可过滤。
  - 根因：现代变更不只来自代码版本。
- 反例 20：Serverless 冷启动未区分。
  - 错：把 P99 抖动直接归因于下游慢，忽略 cold start、edge region 和并发初始化。
  - 对：在 trace/metrics 中区分 cold_start、region、runtime、init latency 和 provider 限流。
  - 根因：serverless/edge 的运行时生命周期会改变延迟分布。
- 反例 21：时间窗不一致。
  - 错：Grafana 用本地时间看 30 分钟，日志用 UTC 搜 10 分钟，trace 因采样延迟晚到，最后把无关错误当根因。
  - 对：统一时区、窗口、env/region/version/tenant 过滤，标注 ingestion delay 和 clock skew。
  - 根因：跨系统时间不对齐会制造假相关。
- 反例 22：恢复只看服务重启。
  - 错：Pod 重新 Ready 就宣布恢复，但关键租户仍 5xx，队列还在堆积，合成监控仍失败。
  - 对：恢复必须通过 SLI、RED/USE、队列 lag、黑盒/合成监控和关键租户抽样观察窗。
  - 根因：进程存活不等于用户旅程恢复。
- 反例 23：Page 告警没有 owner/runbook。
  - 错：新告警直接叫醒值班，但没有影响说明、查询入口、降级步骤或升级联系人。
  - 对：Page 必须绑定 owner、severity、runbook、SLO、dashboard、log/trace 查询、降噪和升级链路。
  - 根因：没有可执行动作的 Page 会放大 alert fatigue。
- 反例 24：观测数据泄露 PII。
  - 错：把手机号、地址、Token、prompt、session replay 输入框和异常堆栈原文写入日志、trace 或第三方平台。
  - 对：默认脱敏、字段白名单、最小采样、最短保留、RBAC、导出审计和第三方上报边界。
  - 根因：观测平台通常权限更广，泄露半径比业务库更难控制。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] fenced code block = 0，正文不出现三个反引号。
- [ ] 必需章节齐全：快速总则、强制门禁、场景执行卡、高频坑/防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例不少于 10 条，并且每条标题能被“反例 数字”命中。
- [ ] 覆盖 OpenTelemetry、Prometheus、Grafana、Loki/ELK、Tempo/Jaeger、RED/USE、SLI/SLO/Error Budget、exemplars、trace sampling、cardinality、Kubernetes metrics、eBPF、incident timeline、runbook、alert fatigue、RUM、AI/LLM observability、release markers、multi-service tracing、multi-tenant observability。
- [ ] 输出口径包含服务、信号、时间窗、证据、用户影响、SLO/告警门禁、恢复验证方案和剩余风险。
- [ ] 相邻技能边界清楚，未把实现、性能、发布、安全、AI 应用、平台、测试、审计职责混入本技能。

## 2024-2026 新坑速查

- OpenTelemetry stable signals：logs/metrics/traces/profiles 稳定性等级和 semantic conventions 仍会随 SDK/Collector 版本漂移；升级前做字段兼容、双写或看板对比。
- OTel Collector backpressure：后端不可用时队列、memory_limiter、retry、drop policy 会影响业务和证据完整性；必须压测失败模式。
- eBPF continuous profiling：低侵入但缺业务语义、租户和 SLO；必须关联 service/env/version/tenant、trace 和 release marker。
- Prometheus native histograms：bucket、remote write、查询函数和存储成本会影响 P95/P99 与 burn-rate；迁移期并行旧 histogram 对比。
- Exemplars：指标到 trace 的跳转依赖采样和 trace_id 传播；高流量下优先保留错误、慢请求和关键租户 exemplar。
- Grafana/Tempo/Loki/Mimir：跨信号查询强，但 label/index 设计错误会拖垮查询与账单；统一 tenant、service、env、version、trace_id 口径。
- ELK 数据流与索引生命周期：动态字段和高基数 message 会放大 shard、mapping 和存储成本；上线前定义 index template、ILM 和脱敏。
- Service mesh telemetry：sidecar、ambient mesh、mTLS、retry、timeout、circuit breaking 会改变流量和延迟；排障必须比较 mesh telemetry 与应用信号。
- Kubernetes metrics：cgroup v2、CPU throttling、OOM、ephemeral storage、HPA 指标延迟和 events 短保留会影响判断；事故中及时抓取。
- Cloud provider managed metrics：云厂商指标有聚合延迟、维度限制和采样口径；不能直接替代应用 SLI，需标 region/zone/resource id。
- AI/LLM observability：执行卡已规定 model、token_count、latency、tool call、RAG、safety、fallback、成本和脱敏；速查重点是供应商字段差异、模型版本漂移和第三方上报边界。
- High cardinality cost：user_id、session_id、raw_url、prompt、exception_message 放进 label/index 会快速放大账单；上线前做基数审计和预算告警。
- Burn-rate alerts：多窗口多燃速减少误报；快烧 Page、慢烧 Ticket，必须绑定 SLO 窗口和 Error Budget 决策。
- RUM 与 session replay：Core Web Vitals、JS error、API waterfall 要与后端 trace 关联；录屏和用户输入默认脱敏、限采样、限保留。
- SLO-as-code：SLO、告警、dashboard、runbook 进入版本管理和 review；避免 UI 手改导致口径漂移、无法审计和无法回滚。
- Multi-tenant observability：共享后端需隔离数据、查询、告警、成本、retention、API token 和导出；共享链接也要做租户校验。

## 与相邻技能的边界

- observability-sre 负责：生产症状分诊、观测证据链、SLI/SLO/Error Budget、告警降噪、dashboard、runbook、on-call、incident response、postmortem、容量观测、多租户观测和成本治理。
- be 负责：服务实现、健康接口、日志/trace/metrics SDK 落地、超时、熔断、限流、幂等与运行时配置。
- cld 负责：Kubernetes/GitOps/Ingress/Gateway/Service Mesh/Secret/RBAC/HPA/PVC/镜像等平台对象事实与声明式变更。
- dso 负责：Secrets、供应链、SBOM/SLSA、CI/CD 安全门禁、扫描误报、权限和合规安全基线。
- pfe 负责：性能 baseline、profile/flamegraph/eBPF 深度归因、压测、容量模型和优化收益验证。
- rls 负责：发布单元、release marker、feature flag/实验/迁移/容量变更治理、灰度、回滚、发布冒烟、监控告警和审计证据总控。
- plt 负责：IDP、Service Catalog、Golden Path、scorecard、guardrails、多租户平台治理和开发者体验。
- aie 负责：LLM/RAG/Agent 设计、评测、提示词与工具链实现；本技能只定义观测口径、SLO、隐私和排障证据。
- wsec 负责：前端采集、session replay、日志、第三方上报和访问控制的安全审查；本技能只标出观测风险与证据需求。
- tst 负责：场景矩阵、原 bug 复现、回归、CI 证据、冒烟与覆盖充分性。
- aud 负责：改动后需求对账、影响面、安全质量和证据边界最终收口。
- 协作原则：本技能给出观测目标、证据口径和 SRE 闭环；涉及代码、配置、迁移、发布、安全、测试或平台实现时，必须切相邻技能实施与收口。
