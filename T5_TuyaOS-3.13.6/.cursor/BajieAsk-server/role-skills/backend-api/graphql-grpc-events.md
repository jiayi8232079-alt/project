---
name: graphql-grpc-events
description: GraphQL/gRPC/事件契约实战排障版 - 专管 GraphQL schema/resolver/N+1/DataLoader/persisted queries/federation/@defer/@stream，gRPC proto3/buf breaking/grpc-web/deadline/cancellation/status codes，以及 Kafka/Pulsar/NATS/schema registry/outbox/idempotency/DLQ/consumer lag/OpenTelemetry 的契约兼容、真实失败模式和发布回滚证据。
---

# GraphQL/gRPC/事件契约实战排障版

定位：本技能只处理 GraphQL、gRPC、事件流的“协议契约与跨消费者兼容”。目标不是通用 API 模板，而是把 schema/proto/topic 从能跑收敛为可 diff、可回放、可观测、可回滚、可审计。

## 快速总则：契约定制：协议/版本、schema/proto/topic、兼容策略、证据

1. 协议先定制：GraphQL 看 schema、resolver、operation、query plan；gRPC 看 proto3、service、method、stream、metadata、status codes；事件看 topic/subject/key/schema/consumer group。
2. 版本先锁定：记录 GraphQL server/client/federation gateway、protoc/runtime/gencode、buf、grpc-web proxy、Kafka/Pulsar/NATS/broker、schema registry、OpenTelemetry semantic convention 版本。
3. schema/proto/topic 是契约：字段可空性、enum、protobuf tag、oneof、topic 分区键、routing key、subject、retention、DLQ、replay 规则都要写入契约，不当实现细节。
4. 兼容策略默认保守：删字段、收紧 nullability、改 enum 语义、复用 tag、改 status code、改 topic key、改事件含义、改顺序边界默认 breaking change。
5. 消费者先于实现：前端、App、BFF、SDK、批任务、BI、旧 consumer group、第三方未查清，不得判兼容。
6. 证据闭环：结论绑定 schema diff、proto/buf breaking、registry compatibility、operation 回放、golden sample、consumer-driven contract、trace/log/metric、consumer lag、DLQ 和灰度回滚证据。
7. 性能需场景证据：GraphQL N+1、DataLoader、federation fan-out、gRPC streaming 背压、consumer lag、DLQ 风暴必须用负载、trace 和失败样本验证。
8. 安全默认逐层验：introspection、persisted queries、字段级授权、gRPC metadata、topic key、CloudEvents attributes、headers、日志、DLQ 禁止泄露 PII/secret。
9. 发布必须可回退：deprecation、双写/双读、schema/proto/topic 门禁、消费者灰度、DLQ 回灌、replay 开关、回滚点齐全才收口。

## 场景执行卡

### 1. GraphQL schema / resolver / mutation
- 输入：schema SDL、operationName、query/mutation/subscription、消费者版本、字段敏感性、nullable、enum、auth、cache、deprecation 窗口。
- 动作：公共 schema 按业务契约建模；新增字段优先可选；删除/改名/改类型/收紧 nullability 走 deprecation；mutation 写幂等键、权限和错误结构。
- 验证：schema diff、旧 operation 回放、未知 enum、null/缺失、字段级授权、错误 path、缓存 key、旧客户端兼容。

### 2. GraphQL N+1 / DataLoader / persisted queries
- 输入：resolver 树、列表规模、下游调用数、loader key、租户/权限上下文、query cost、persisted query 清单。
- 动作：resolver 只编排；列表关联用 DataLoader/batcher；loader 实例请求级，key 含租户、权限、过滤和版本；生产优先 persisted queries + complexity/depth 限制。
- 验证：1/10/100 项调用不线性爆炸；trace 有 operationName、field path、resolver latency、batch size、cache hit；非法 alias/fragment/深度查询被阻断。

### 3. GraphQL federation / @defer / @stream / subscription
- 输入：subgraph schema、composition 结果、entity key、owner、query plan、defer/stream 支持矩阵、subscription broker、重连策略。
- 动作：federation 变更先跑 composition；entity key 和 resolver owner 不漂移；@defer/@stream 标明客户端降级；subscription 定义顺序、重放、权限和心跳。
- 验证：gateway/subgraph 版本矩阵、query plan fan-out、部分响应兼容、断线重连、旧客户端不识别增量响应、跨 subgraph 授权。

### 4. gRPC proto3 / buf breaking / grpc-web
- 输入：proto package、service/method、message、field tag、oneof、optional、JSON mapping、buf.yaml、跨语言生成代码、grpc-web 网关。
- 动作：tag 发布即冻结；删除字段 reserved name/tag；enum 0 用 UNKNOWN/UNSPECIFIED；presence 用 optional/oneof 明确；CI 接 buf breaking；grpc-web 单独验证 header/trailer/stream 限制。
- 验证：新旧生产者/消费者互读、未知字段、默认值、未知 enum、序列化 golden sample、buf breaking 输出、浏览器代理错误映射。

### 5. gRPC deadline / cancellation / status codes / streaming
- 输入：SLO、客户端 deadline、服务端 cancellation、retry/hedging、stream 类型、背压、心跳、恢复点、LB/mesh HTTP/2 行为。
- 动作：每个调用设置 deadline；服务端尊重 context cancellation；业务错误映射 canonical status codes；streaming 定义半关闭、offset、限速、最大消息和最终 trailers。
- 验证：INVALID_ARGUMENT、NOT_FOUND、PERMISSION_DENIED、UNAUTHENTICATED、FAILED_PRECONDITION、RESOURCE_EXHAUSTED、DEADLINE_EXCEEDED、CANCELLED、断线重连、慢消费者。

### 6. Kafka / Pulsar / NATS 事件建模
- 输入：事件事实/命令、topic/subject/stream、partition/routing/ordering key、consumer group/subscription、retention、ack、redelivery、ordering 范围。
- 动作：事件名表达已发生事实；key 选择业务顺序维度；不同消费者隔离 group/subscription；Kafka/Pulsar/NATS 的顺序、ack、retention、compaction 写进契约。
- 验证：同 key 顺序、跨分区无全局顺序、partition skew、rebalance、ack deadline、redelivery、consumer lag、DLQ、重放。

### 7. schema registry / AsyncAPI / CloudEvents
- 输入：Avro/Protobuf/JSON Schema、subject 命名、compatibility level、event type/version、CloudEvents source/type/id/subject/dataschema、AsyncAPI channel。
- 动作：跨团队事件必须接 schema registry；默认 backward compatibility；结构兼容不等于语义兼容；语义变化新增 event type/topic/version。
- 验证：registry compatibility、旧 schema 互读、示例消息、AsyncAPI 与真实 topic 一致、CloudEvents 信封和 data schema 同时校验。

### 8. outbox / CDC / idempotency / DLQ / replay
- 输入：事务边界、event_id、business_id+version、outbox 表、CDC offset、retry backoff、DLQ 分类、回灌和 replay 副作用策略。
- 动作：DB 变更与事件发布用 outbox/事务性方案；消费者按 event_id 或业务版本幂等；retry 区分临时/永久错误；DLQ 可诊断、可限速回灌。
- 验证：事务回滚、发送失败、重复发送、消费者崩溃、乱序、CDC 快照重复、tombstone、schema 变更、历史 replay、副作用隔离。

### 9. OpenTelemetry / 契约观测
- 输入：trace_id、span_id、operationName、service/method、topic/partition/offset/group、schema version、error/status、lag、DLQ 指标。
- 动作：GraphQL/gRPC/Event 统一 trace propagation；指标按协议维度拆；日志只存脱敏摘要；dashboard 覆盖端到端延迟和消费者完成率。
- 验证：跨协议 trace 串联、resolver span、grpc status、consumer lag、DLQ rate、replay 标记、schema version 标签、告警与 runbook。

### 10. 契约测试 / 发布回滚
- 输入：消费者清单、旧样本、错误样本、CI、registry、测试 broker、灰度策略、回滚和废弃窗口。
- 动作：schema/proto/topic diff、consumer-driven contract、golden sample、compatibility matrix、failure injection、load/replay test；发布前跑门禁。
- 验证：CI job、命令输出、报告、trace/span、dashboard、灰度比例、回滚开关、DLQ 回灌演练。

## 高频坑 / 防遗漏

- GraphQL schema 不是 DB/ORM 镜像；resolver 调用数要按列表放大验证；DataLoader 必须请求级、租户级、权限级隔离。
- persisted queries 不等于授权；federation composition 通过不等于字段 owner、entity key、query plan 性能正确。
- @defer/@stream 和 subscription 会改变响应时序，旧客户端、网关、缓存和监控必须单独验。
- gRPC proto3 默认值、presence、oneof、JSON mapping、gencode/runtime 版本差异会制造静默兼容问题。
- buf breaking 只能防部分结构破坏，不能证明业务语义、状态码、deadline 和重试策略正确。
- grpc-web 受浏览器、代理、trailers、streaming 能力限制，不等同原生 gRPC。
- Kafka/Pulsar/NATS 的 topic/subject、key、partition、subscription、ack、retention 是契约，不是运维细节。
- outbox、CDC、replay 默认重复、乱序、延迟和副作用重放；idempotency 不是可选项。
- schema registry 不验证业务语义；CloudEvents 只管信封；AsyncAPI 不是运行时契约测试。
- producer 成功不代表业务成功；必须看 consumer lag、DLQ、端到端 trace 和业务状态。

## 输出要求

1. 契约对象：GraphQL schema/resolver/operation、gRPC proto/service/message、Kafka/Pulsar/NATS topic/subject、CloudEvents type、schema registry subject。
2. 版本环境：GraphQL/gateway/client、protoc/runtime/buf/grpc-web、broker/registry/client、OpenTelemetry 版本和环境差异。
3. 入口复现：请求或消息样本、旧版本样本、失败条件、operationName/service/method/topic/group、最小复现范围。
4. 兼容结论：兼容、breaking change、高风险兼容或需验证，并列 schema/proto/buf/registry/消费者证据。
5. 影响面：生产者、消费者、SDK、缓存、网关、broker、registry、监控、测试、发布、回滚、DLQ/replay。
6. 风险点：N+1、DataLoader、persisted queries、federation、@defer/@stream、deadline/cancellation、status codes、ordering key、idempotency、consumer lag。
7. 测试证据：contract test、golden sample、新旧矩阵、failure injection、load/replay test、CI job 和命令结果。
8. 观测证据：OpenTelemetry trace/span、resolver latency、grpc status、topic/partition/offset/group、lag、DLQ、dashboard、告警。
9. 发布方案：灰度、双写/双读、deprecation、迁移窗口、schema/proto/topic 门禁、回滚点、DLQ 回灌策略。
10. 缺口：未查消费者、未跑 CI、未拿 registry、未验证旧版本、未覆盖安全/发布时显式标“无法验证”。

## 约束

- 不把 GraphQL 当万能 BFF；强事务命令、高吞吐流、批处理不默认走 GraphQL。
- 不用“GraphQL/gRPC/Kafka 高性能”替代证据；必须看查询形态、消息大小、下游调用和消费能力。
- 不复用 protobuf tag，不把 UNKNOWN/INTERNAL 当业务错误垃圾桶，不给非幂等 gRPC 方法开自动重试。
- 不把 Kafka/Pulsar/NATS 当 RPC；需要同步结果时重评交互模型。
- 不承诺 Exactly-once 业务效果；broker 事务不覆盖外部副作用。
- 不把 schema registry、CloudEvents、AsyncAPI 当完整契约测试。
- 不让 GraphQL error、gRPC metadata、topic key、headers、CloudEvents attributes、logs、DLQ 承载敏感明文。
- 不跨相邻技能边界；DB、Web 安全、测试、SRE、后端实现、最终审计必须联动对应技能。

## 高频 Bug 反例库

- 反例 1：GraphQL schema 直接暴露 ORM。错法：把 DB 字段全量映射到公共 GraphQL schema。对法：按业务契约建模，敏感字段默认不暴露。根因：内部模型不是公共契约。
- 反例 2：GraphQL 字段直接删除。错法：服务端没引用就删字段。对法：deprecate、监控 operation/field、通知消费者、窗口后删除。根因：消费者常在客户端 query 中。
- 反例 3：resolver 触发 N+1。错法：订单 100 条逐条查用户和商品。对法：DataLoader/batcher 批量加载，key 含租户和权限。根因：执行树掩盖调用放大。
- 反例 4：DataLoader 全局缓存。错法：loader 单例跨请求复用。对法：请求级实例，key 含租户/权限/过滤。根因：缓存边界错会串数据。
- 反例 5：persisted queries 当安全边界。错法：只允许白名单 query 就不做字段授权。对法：persisted queries 配合对象/字段级授权和 complexity。根因：查询白名单不等于数据授权。
- 反例 6：federation 只看 composition 通过。错法：subgraph 字段 owner 变更后直接发。对法：查 query plan、entity key、旧 gateway 和消费者。根因：组合成功不代表运行时兼容。
- 反例 7：@defer/@stream 无降级。错法：服务端开启增量响应，旧客户端解析失败。对法：按客户端能力协商并保留非增量路径。根因：响应时序也是契约。
- 反例 8：protobuf tag 复用。错法：删除 old_status 后把 tag 7 给 new_status。对法：reserved 7 和 old_status，新字段用新 tag。根因：wire format 按编号解析，会静默误读。
- 反例 9：proto3 presence 误判。错法：把缺失和显式默认值当同一语义。对法：用 optional/oneof 或版本字段表达 presence，做跨语言样本。根因：生成代码语义受版本和语言影响。
- 反例 10：buf breaking 未进 CI。错法：本地改 proto 只跑单测。对法：CI 跑 buf breaking 与 golden sample。根因：破坏性变更常在消费者侧爆炸。
- 反例 11：grpc-web 等同原生 gRPC。错法：浏览器端照搬 bidi streaming 和 trailers 处理。对法：验证代理、header/trailer、stream 支持和错误映射。根因：Web 传输能力受限。
- 反例 12：gRPC 无 deadline/cancellation。错法：客户端无限等待，服务端不处理取消。对法：客户端设置 deadline，服务端尊重 context cancellation。根因：局部慢会扩散成资源耗尽。
- 反例 13：gRPC status codes 滥用 UNKNOWN。错法：权限、参数、未找到全返回 UNKNOWN。对法：映射 UNAUTHENTICATED、PERMISSION_DENIED、INVALID_ARGUMENT、NOT_FOUND。根因：客户端无法稳定重试和告警分组。
- 反例 14：streaming 当队列用。错法：无背压、无心跳、无恢复点。对法：定义 offset/sequence、keepalive、限速、重连和最终 status。根因：stream 是连接语义，不是持久队列。
- 反例 15：Kafka partition key 随机。错法：同订单事件落不同分区。对法：按业务实体选 partition key 并记录顺序边界。根因：Kafka 只保证同分区顺序。
- 反例 16：Pulsar subscription 模式误选。错法：需要按 key 有序却用 Shared。对法：按 Key_Shared/Failover 等语义选择并压测。根因：订阅模式决定并发和顺序。
- 反例 17：NATS ack/redelivery 未设计。错法：消费者超时后重复副作用。对法：设置 ack、max deliver、幂等键和 DLQ。根因：至少一次投递会重复。
- 反例 18：消费者无 idempotency。错法：rebalance 后重复扣款/发短信。对法：event_id 或 business_id+version 唯一约束，副作用可去重。根因：异步交付不保证只处理一次。
- 反例 19：DLQ 不可回灌。错法：只把失败消息丢到死信队列。对法：记录错误分类、schema version、trace、回灌限速和副作用开关。根因：DLQ 是排障与恢复契约。
- 反例 20：schema registry subject 选错。错法：本地 schema 通过，生产 subject 兼容检查失效。对法：统一 subject 策略并在 CI 连接 registry。根因：兼容性绑定 subject。
- 反例 21：事件语义悄悄改变。错法：OrderPaid 从支付成功改为授权成功，event type 不变。对法：新增 event type/version，旧语义保留迁移窗口。根因：结构兼容不等于业务语义兼容。
- 反例 22：consumer lag 未告警。错法：producer 发送成功就判链路成功。对法：看 lag、DLQ、端到端延迟、业务状态和 OpenTelemetry trace。根因：异步成功发生在消费者完成后。

## 提交前自检清单

- [ ] 行数 < 500，且 fenced code block = 0。
- [ ] frontmatter 含 name、description，H1 为“GraphQL/gRPC/事件契约实战排障版”。
- [ ] 快速总则覆盖协议/版本、schema/proto/topic、兼容策略、证据。
- [ ] GraphQL schema、resolver、N+1、DataLoader、persisted queries、federation、@defer/@stream 已覆盖。
- [ ] gRPC proto3、buf breaking、grpc-web、deadline/cancellation、status codes、streaming 已覆盖。
- [ ] Kafka/Pulsar/NATS、schema registry、outbox、idempotency、DLQ、consumer lag 已覆盖。
- [ ] 契约测试、consumer-driven contract、golden sample、新旧消费者矩阵、失败注入有证据。
- [ ] OpenTelemetry trace/log/metric/dashboard/runbook 与协议维度一致。
- [ ] 发布、灰度、deprecation、回滚、DLQ 回灌和 replay 风险已说明。
- [ ] 与 api-design、db-design、web-security、observability-sre、backend-engineering、test-engineering、code-audit 边界无重复职责。

## 2024-2026 新坑速查

- 2024-2026 GraphQL federation 更常见；坑是 subgraph composition 通过但 query plan fan-out 爆炸，修法是把 query plan 和 resolver latency 纳入门禁。
- 2024-2026 persisted queries 普及；坑是只控 query 不控字段权限和复杂度，修法是白名单、复杂度预算、字段级授权并用。
- 2024-2026 @defer/@stream 支持不一致；坑是旧客户端、网关、缓存无法处理增量响应，修法是能力协商和降级路径。
- 2024-2026 GraphQL 安全治理聚焦 introspection、alias 批量、fragment 递归；坑是登录后无限查，修法是 depth/complexity/rate limit。
- 2024-2026 Protobuf Editions 与 proto2/proto3 并存；坑是 presence、默认值、生成代码不一致，修法是锁 protoc/runtime/gencode 矩阵。
- 2024-2026 buf breaking 成为 proto 门禁；坑是只跑结构 diff 不跑语义样本，修法是 buf breaking + golden sample + 消费者矩阵。
- 2024-2026 grpc-web 和移动网关增多；坑是 trailers、streaming、CORS、代理超时差异，修法是真实网关链路压测。
- 2024-2026 gRPC retry/hedging 平台化；坑是非幂等方法自动重试放大副作用，修法是 method 级幂等声明和重试白名单。
- 2024-2026 Kafka/Pulsar/NATS 混用增加；坑是把三者顺序和 ack 语义套用，修法是按 broker 写清契约和失败注入。
- 2024-2026 schema registry 同管 Avro/Protobuf/JSON Schema；坑是 subject 策略混乱，修法是统一命名并进 CI。
- 2024-2026 outbox/CDC 普及；坑是快照重复、tombstone、源 schema 变更、replay 乱序，修法是 event_id、source offset、version 和幂等消费。
- 2024-2026 OpenTelemetry semantic conventions 迭代；坑是 attribute 漂移导致 dashboard 断，修法是锁版本并统一命名。
- 2024-2026 隐私审计覆盖事件流；坑是 PII 进入 topic key、metadata、CloudEvents subject、DLQ，修法是最小化路由属性和脱敏。
- 2024-2026 AI 生成 schema/proto 增多；坑是命名好看但兼容错误，修法是机器 diff、registry check、人工审查三件套。

## 与相邻技能的边界

- 与 api-design：REST/OpenAPI/HTTP 资源、URL、状态码、认证语义归 api-design；GraphQL schema、gRPC proto、事件 schema/topic 的兼容与排障归本技能。
- 与 db-design：表、索引、SQL、迁移、锁、事务归 db-design；outbox/CDC 事件语义、schema evolution、消费者幂等归本技能协作。
- 与 web-security：漏洞验证、攻击面审计、授权测试归 web-security；本技能负责把 introspection、字段级权限、metadata/headers/topic key/PII 泄露写入契约。
- 与 observability-sre：SLO、告警、值班、容量、事故流程归 observability-sre；本技能定义 GraphQL/gRPC/Event 必备协议维度、trace 字段、lag/DLQ 指标。
- 与 backend-engineering：后端分层、运行时、配置、队列任务实现归 backend-engineering；本技能约束跨服务协议契约和消费者兼容。
- 与 test-engineering：测试体系、场景矩阵、自动化落地归 test-engineering；本技能提供 contract/golden/replay/failure injection 的验证口径。
- 与 code-audit：最终改动对账、安全质量和证据收口归 code-audit；本技能提供协议/事件风险清单与兼容证据。
