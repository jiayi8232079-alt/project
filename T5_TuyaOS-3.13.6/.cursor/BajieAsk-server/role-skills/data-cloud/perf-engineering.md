---
name: perf-engineering
description: 性能工程技能实战排障版 - 用于慢接口、慢查询、N+1、缓存击穿/雪崩/一致性、CPU/内存/GC、锁竞争、队列背压、CDN/Core Web Vitals、Kubernetes autoscaling、eBPF profiling、flamegraph、load test、p95/p99、吞吐/延迟、基准对比与回滚证据。
---
# 性能工程技能实战排障版

> 定位：把“慢、卡、抖、占用高、容量不够、回归了”收敛成可复核闭环：基线 → 瓶颈 → 负载 → 证据 → 最小优化 → 同口径复测 → 回滚证据。
> 铁律：没有 baseline 不谈收益；没有 p95/p99 不谈体验；没有 profiling/flamegraph/trace/EXPLAIN/waterfall/heap/eBPF 不下瓶颈结论；没有同口径 load test 或生产灰度数据不宣称完成。

## 快速总则：基线 / 瓶颈 / 负载 / 证据

1. 基线先行：记录优化前版本、环境、数据量、缓存状态、预热策略、流量模型、样本量、P50/P95/P99、错误率、吞吐、CPU/内存/IO/网络/DB/缓存/队列指标。
2. 瓶颈归一：先判断主因属于 CPU、内存/GC、DB 慢查询、网络/CDN、渲染/Core Web Vitals、缓存、锁竞争、队列背压、Kubernetes autoscaling、下游依赖还是负载模型错误。
3. 负载可信：区分 benchmark、load test、stress、spike、soak、线上灰度；写明并发数、RPS/QPS、think time、热点分布、数据规模、限流和第三方依赖替身。
4. 证据分层：trace 看链路，profiling/flamegraph/JFR/pprof/eBPF 看 CPU/内存/锁/内核，EXPLAIN/慢日志看 DB，waterfall/Lighthouse/RUM 看前端，heap snapshot 看泄漏，监控曲线看饱和。
5. 先改最大贡献项：一次只动主瓶颈；异步化、缓存、索引、连接池、扩容、HPA/VPA、CDN 都不是万能药，必须说明收益来源和正确性风险。
6. 尾延迟优先：性能验收默认看 p95/p99、错误率和吞吐下限；平均值只能辅助，不能代表用户体验和容量风险。
7. 正确性红线：权限、金额、幂等、排序、分页、一致性、缓存隔离、回放安全和降级语义不得为性能让路。
8. 收口证据：给同环境同数据同负载复测、回滚方案、监控/告警、灰度指标和未验证项；未跑只能写“需验证”。

## 场景执行卡

### 1. 性能分诊与证据建模

- 适用：只有“慢/卡/CPU 高/内存涨/偶发抖动/容量不够”。
- 输入：影响范围、时间窗口、SLO、版本、环境规格、数据量、流量峰值、最近发布/配置/依赖变更。
- 动作：画入口、应用、DB、缓存、队列、下游、网络/CDN、端侧渲染、Kubernetes 调度与扩缩容链路；按耗时和饱和度排序。
- 证据：trace span、APM、profiling、flamegraph、metrics、日志、RUM、EXPLAIN、heap、eBPF、发布标记。
- 输出：主瓶颈、次瓶颈、基线、证据缺口、最小修复顺序、回滚证据要求。

### 2. 慢接口 / 慢查询 / N+1 / 深分页

- 先查：trace 总耗时拆分、SQL 次数、慢查询日志、EXPLAIN、扫描行数、索引选择、锁等待、连接池等待、返回体积、序列化耗时。
- 常见错因：循环内 IO/N+1、SELECT *、深 OFFSET、排序/聚合临时表、缺失覆盖索引、事务过长、下游慢被误判成 DB 慢。
- 优先动作：批量查询、预加载、字段裁剪、游标分页、减少事务范围、连接池上限与超时预算；索引/表结构细节切 db-design。
- 验证：SQL 次数、扫描行数、DB CPU/IO、锁等待、连接等待、p95/p99、错误率、吞吐和结果一致性。

### 3. CPU 热点 / 算法复杂度 / 主线程长任务

- 先查：profile、flamegraph、JFR/pprof、Performance Long Task、采样窗口、符号化、热点函数累计占比。
- 常见错因：大 JSON、正则回溯、重复排序过滤、加解密/压缩、图片处理、同步 IO、过度序列化、低复杂度输入掩盖高复杂度算法。
- 优先动作：降复杂度、减少分配、缓存纯计算、批处理、Worker/后台线程、分片让出主线程、SIMD/原生扩展需有收益和维护边界。
- 验证：CPU 利用率、单次耗时、热点占比、INP/输入延迟、吞吐、功耗和低端机表现。

### 4. 内存 / GC / 泄漏 / 资源释放

- 先查：RSS/heap 曲线、heap snapshot diff、引用链、GC pause、对象分配速率、线程/goroutine/timer/observer/句柄、容器 OOMKill。
- 常见错因：把缓存/预热误判泄漏，订阅/定时器未释放，对象池保留大对象，闭包引用大上下文，流式场景全量加载。
- 优先动作：生命周期释放、缓存容量和淘汰、流式处理、减少大对象复制、图片降采样、连接/文件句柄关闭、GC 参数只在证据明确时调整。
- 验证：多轮进入退出、峰值回落、GC pause、OOM/ANR、句柄数量、容器 memory limit 与 request。

### 5. 缓存 / HotKey / 缓存击穿 / 缓存雪崩 / 一致性

- 先查：命中率、key 分布、BigKey/HotKey、TTL 分布、容量、淘汰、穿透率、回源 QPS、身份隔离、失效路径。
- 常见错因：缓存无 TTL/容量/命名空间，热点同时过期，负缓存缺失，写后读一致性没定义，缓存污染越权，BigKey 阻塞 Redis。
- 优先动作：请求合并、互斥重建、随机 TTL、预热、负缓存、限流降级、热点拆分、本地缓存边界、失效事件和最终一致性说明。
- 验证：命中率、回源峰值、尾延迟、Redis CPU/内存/网络、BigKey/HotKey、数据一致性和回滚清缓存方案。

### 6. 并发 / 锁竞争 / 队列背压 / 重试风暴

- 先查：线程池/连接池、队列长度、消费速率、锁等待、死锁、重试次数、超时预算、下游错误率、限流丢弃率。
- 常见错因：无界队列、同步锁包住 IO、失败立即重试、消费者慢无背压、批量任务无幂等、连接池放大下游压力。
- 优先动作：有界队列、背压、限流、熔断、指数退避+jitter、减少锁粒度、批处理、幂等键、死信队列、降级策略。
- 验证：队列堆积时间、p95/p99、锁等待、下游 QPS、错误率、丢弃/降级数量和恢复时间。

### 7. 前端加载 / CDN / Core Web Vitals / 渲染

- 先查：RUM、Lighthouse、waterfall、bundle analyzer、LCP 资源、INP 长任务、CLS 来源、缓存命中、CDN hit ratio、TTFB、字体和图片体积。
- 常见错因：只看实验室首屏不看真实用户，CDN 缓存键错误，图片未响应式，hydration 长任务，全量 rerender，虚拟列表缺失，布局抖动。
- 优先动作：CDN 缓存策略、资源裁剪、code splitting、预加载关键资源、图片压缩/懒加载/响应式、减少 JS 主线程、虚拟列表、稳定占位。
- 验证：LCP/INP/CLS、TTFB、资源体积、CDN 命中率、弱网、低端机、真实浏览器矩阵和回滚到旧资源策略。

### 8. Kubernetes / 容器 / autoscaling / 网络

- 先查：requests/limits、CPU throttling、OOMKill、HPA/VPA 指标、pod 启动、探针、连接耗尽、DNS、service mesh、节点饱和、冷启动。
- 常见错因：CPU limit 触发 throttling 却误判代码慢，HPA 指标滞后，扩容慢于流量尖峰，探针过重，跨区网络和 mesh sidecar 放大延迟。
- 优先动作：修正 request/limit、HPA 指标和冷却窗口、预扩容、连接复用、探针瘦身、节点池容量、灰度与回滚指标交 cloud-native/release-engineering。
- 验证：pod ready 时间、扩容时延、throttling、p95/p99、错误率、节点饱和度、回滚后指标恢复。

### 9. 压测 / benchmark / 性能回归门槛

- 先查：目标是 micro benchmark、单接口 load test、整链路容量、spike、soak、回归冒烟还是发布前基线。
- 动作：固定环境、数据量、热点分布、预热、采样窗口、第三方 stub、限流、监控；记录 p50/p95/p99、错误率、吞吐、CPU/内存/IO、DB/缓存/队列。
- 门槛：关键接口 p95/p99 上限、吞吐下限、错误率上限、资源上限；前端 CWV budget；移动启动/掉帧；K8s 扩缩容恢复时间。
- 失败兜底：无 think time、无真实数据、无热点、无生产限流口径时，只能写“压测结论有限”。

### 10. LLM / 向量检索 / serverless / GPU

- LLM：拆首 token、总延迟、吞吐、上下文长度、工具调用、RAG、缓存、批量、流式、并发限额、成本和降级。
- 向量检索：查 HNSW/IVFFlat、维度、过滤条件、topK、召回率、VACUUM/ANALYZE、冷热数据；延迟不能脱离质量。
- Serverless：冷/热启动分开报，包体、依赖初始化、连接复用、地域、预热和并发限制都要入基线。
- GPU/图形：关注 shader warmup、纹理尺寸、管线编译、Impeller/Skia、设备温控和驱动差异。

## 高频坑 / 防遗漏

### 高频坑

1. 无 baseline 或换环境对比，宣称优化成功。
2. 只看平均值，不看 p95/p99、错误率、样本量和吞吐。
3. 用 benchmark 代替生产 load test，把缓存预热当优化收益。
4. 循环内查库/HTTP/文件 IO 形成 N+1。
5. 深分页 OFFSET、SELECT *、过大响应体、过度序列化。
6. 缓存无 TTL、容量、失效、隔离，导致击穿、雪崩、污染或不一致。
7. 重试无超时预算、退避和 jitter，放大下游故障。
8. 无界队列和锁包 IO，没有背压和降级。
9. CPU limit throttling、GC pause、连接池等待被误判成业务代码慢。
10. 只优化 LCP，不看 INP/CLS、CDN 命中和真实用户低端机。
11. HPA 指标滞后或冷启动慢，扩容赶不上 spike。
12. 上线无回滚证据、监控阈值和性能回归门槛。

### 防遗漏清单

- 慢接口/DB：trace、SQL 次数、EXPLAIN、慢日志、扫描行数、锁等待、连接池、N+1、分页、响应体。
- CPU/GC：profiling、flamegraph、采样窗口、热点累计占比、分配速率、GC pause、JIT/PGO、符号化。
- 内存：heap diff、引用链、缓存上限、timer/observer/goroutine/thread、句柄、多轮复现、OOMKill。
- 缓存：TTL、容量、key 设计、BigKey/HotKey、穿透/击穿/雪崩、回源、隔离、一致性、清缓存回滚。
- 并发/队列：锁等待、连接池、线程池、队列长度、消费速率、背压、限流、熔断、死信、幂等。
- 前端/CDN：waterfall、bundle、LCP、INP、CLS、TTFB、CDN hit ratio、图片、字体、hydration、弱网低端机。
- K8s/网络：requests/limits、throttling、HPA/VPA、pod ready、DNS、mesh、跨区、探针、节点饱和。
- 压测：负载模型、think time、热点分布、数据量、预热、采样、错误率、吞吐、资源、回归门槛。

## 输出要求

性能工程输出必须极简但可复核，至少包含：

1. 问题类型：慢接口/慢查询/CPU/内存/GC/IO/网络/CDN/渲染/启动/缓存/并发/队列/锁/Kubernetes/LLM/回归。
2. 症状指标：影响范围、时间窗口、p50/p95/p99、错误率、吞吐、CPU/内存/IO、DB/缓存/队列、CWV/FPS/启动。
3. 环境与基线：版本、规格、地域、数据量、缓存状态、预热、流量模型、样本量、优化前口径。
4. 定位证据：trace、profiling、flamegraph、EXPLAIN、慢日志、waterfall、heap、JFR/eBPF、RUM、监控曲线。
5. 瓶颈归因：主因、次因、证据链、排除项和证据缺口。
6. 优化方案：最小改动、收益来源、正确性风险、观测项、回滚方式。
7. 验证门槛：同口径复测、load test/benchmark/CI/灰度结果、性能预算、上线监控和剩余风险。
8. 联动技能：DB/索引切 db-design；后端链路切 backend-engineering；K8s/发布切 cloud-native/release-engineering；前端实现切 js-ts-dev；验证切 test-engineering；最终 code-audit 收口。

## 约束

- 不凭体感、平均值、单次本地结果或无预热 benchmark 下结论。
- 不在缺少数据量、流量模型、样本量和环境说明时承诺容量。
- 不把缓存、索引、异步、连接池、扩容、HPA、CDN 当默认答案；每项必须绑定证据。
- 不为性能牺牲权限、幂等、一致性、排序、事务、可恢复性和可维护性。
- 不把测试环境绿、压测绿包装成线上绿；必须说明与生产差距。
- 涉及 SQL/索引/迁移必须联动 db-design；涉及实现联动对应语言/端；涉及验证联动 test-engineering；涉及发布/灰度/回滚联动 release-engineering 或 cloud-native；改动完成前用 code-audit 收口。

## 高频 Bug 反例库

- 反例 1：无基线宣称优化
  - 错：改完说“快了很多”，没有优化前 p95/p99、吞吐、CPU、数据量和样本量。
  - 对：固定环境、数据量、负载模型和采样窗口，保存优化前后同口径指标。
  - 根因：没有基线就无法排除缓存预热、环境漂移和噪声。
- 反例 2：只看平均延迟
  - 错：平均耗时下降就上线，p99、错误率和超时重试变差未发现。
  - 对：同时比较 p50/p95/p99、错误率、吞吐、资源和样本量。
  - 根因：用户体验和容量风险主要由尾延迟决定。
- 反例 3：benchmark 冒充 load test
  - 错：本地 micro benchmark 快 30%，就承诺生产容量提升。
  - 对：补真实负载、热点分布、think time、数据量、下游限流和线上灰度验证。
  - 根因：单点基准不能覆盖排队、锁、网络、DB 和下游饱和。
- 反例 4：循环内 IO / N+1
  - 错：列表每行查库、发 HTTP 或读文件，小数据正常，大数据 p99 爆炸。
  - 对：批量查询、预加载、请求合并、字段裁剪或异步批处理。
  - 根因：调用次数随数据量线性增长，尾延迟被放大。
- 反例 5：慢查询只加缓存
  - 错：SQL 扫描百万行却先加缓存，失效时数据库被打穿。
  - 对：先用 EXPLAIN、慢日志、扫描行数定位；索引/分页/表结构交 db-design，同时设计缓存失效。
  - 根因：缓存掩盖主瓶颈，不能替代查询结构优化。
- 反例 6：缓存击穿/雪崩
  - 错：热点 key 同一 TTL 同时过期，无互斥重建、随机 TTL、请求合并和降级。
  - 对：随机 TTL、预热、互斥重建、负缓存、限流降级，并验证回源 QPS。
  - 根因：缓存失效瞬间把全部流量转移到下游。
- 反例 7：缓存一致性和隔离缺失
  - 错：缓存 key 不带租户/权限维度，写后读旧数据或串用户数据。
  - 对：定义 key 命名空间、失效事件、写后读策略、TTL、清理和回滚方案。
  - 根因：性能优化改变了数据可见性和安全边界。
- 反例 8：重试风暴
  - 错：下游超时后立即并发重试，连接池占满，故障扩大。
  - 对：超时预算、最大次数、指数退避、jitter、熔断、限流和幂等。
  - 根因：重试是额外负载，不受控会压垮依赖。
- 反例 9：锁竞争包住 IO
  - 错：全局锁内查库/HTTP，低并发正常，高并发线程全部等待。
  - 对：缩小临界区、拆锁、无锁/分段、IO 移出锁外，并用 profile/JFR/eBPF 验证锁等待。
  - 根因：串行化热点把吞吐上限压到单线程。
- 反例 10：无界队列无背压
  - 错：生产速度大于消费速度仍无限入队，内存上涨、延迟失真、最终 OOM。
  - 对：有界队列、背压、限流、死信、丢弃策略、消费扩容和堆积告警。
  - 根因：队列隐藏失败，把延迟转成内存和恢复时间。
- 反例 11：GC/内存泄漏误判
  - 错：看到 RSS 不降就改 GC 参数，没看 heap diff、引用链、缓存和容器限制。
  - 对：多轮复现、heap snapshot、分配速率、GC pause、OOMKill 和资源释放验证。
  - 根因：内存占用高、缓存保留、碎片化和真实泄漏是不同问题。
- 反例 12：Core Web Vitals 只看首屏
  - 错：只压 LCP，主线程 hydration 和大 JSON 让 INP 变差，CLS 来源未修。
  - 对：同时看 LCP/INP/CLS、RUM、长任务、低端机、弱网和 CDN 命中。
  - 根因：真实用户性能由加载、交互和视觉稳定共同决定。
- 反例 13：Kubernetes 扩容误判
  - 错：代码没变 p99 升高，忽略 CPU throttling、HPA 滞后、pod cold start 和节点饱和。
  - 对：检查 requests/limits、HPA/VPA、pod ready、throttling、节点资源和发布标记。
  - 根因：平台层容量和调度会直接改变应用尾延迟。
- 反例 14：上线无回滚证据
  - 错：只给优化代码，不给回滚条件、监控阈值、清缓存方案和灰度对比。
  - 对：定义回滚触发、旧版本指标、缓存/配置回退、灰度窗口和告警。
  - 根因：性能改动常跨缓存、容量和依赖，无法回退就无法安全发布。

## 提交前自检清单

- [ ] frontmatter 含 name/description，H1 为“性能工程技能实战排障版”。
- [ ] 行数 < 500，正文无 fenced code block，正文不出现反引号围栏。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑/防遗漏、输出要求、约束、反例库、自检、新坑速查、相邻边界。
- [ ] 已覆盖 profiling、flamegraph、load test、p95/p99、吞吐/延迟、DB 慢查询、N+1、锁竞争、队列背压。
- [ ] 已覆盖缓存击穿/雪崩/一致性、CPU/内存/GC、CDN/Core Web Vitals、Kubernetes autoscaling、eBPF、基准对比和回滚证据。
- [ ] 每个性能结论都有证据、基线、负载口径和同口径复测要求。
- [ ] 反例不少于 10 条，且每条包含错法、对法、根因。
- [ ] 已明确 db-design、backend-engineering、observability-sre、cloud-native、js-ts-dev、test-engineering、code-audit 的边界。

## 2024-2026 新坑速查

- [Chrome INP] INP 替代 FID 成为 Core Web Vitals 关键指标；只优化首屏会漏交互长任务，必须结合 RUM p75/p95。
- [OpenTelemetry profiling] trace 只能解释链路，profiling 才解释 CPU/内存热点；采样率、符号化和 span 关联要写清。
- [eBPF] 线上低侵入 profiling 适合查锁、内核、网络和 off-CPU，但受内核版本、权限、符号和采样偏差影响。
- [Go PGO] PGO/AutoFDO 会改变热路径表现；优化前后记录 Go 版本、PGO 是否启用和 profile 来源。
- [Java virtual threads] 虚拟线程不消除 DB、锁、连接池瓶颈；JFR 仍要看 pinning、锁等待、分配和 GC。
- [Node/V8] Node 20/22/24、V8 优化层、GC、fetch/stream 行为变化会让热点漂移；升级后必须重建基线。
- [Redis 7.4 field TTL] Hash field TTL 改变缓存拆分策略，但 BigKey、HotKey、淘汰和过期风暴仍要验证。
- [HTTP/3/QUIC/CDN] 弱网可能改善握手与队头阻塞，但连接迁移、负载均衡、观测、回退和 CDN 缓存键要验证。
- [Kubernetes autoscaling] HPA/VPA、KEDA、CPU throttling、pod cold start 和 metrics lag 会影响 p99；扩容不是立即生效。
- [Serverless] 冷/热启动必须分开报；包体、依赖初始化、连接复用、地域和预热决定尾延迟。
- [LLM latency/cost] 首 token、总 token、上下文长度、工具调用、RAG、重试、批量和并发限额共同决定延迟与成本。
- [Vector DB] HNSW/IVFFlat、过滤条件、topK、召回率、VACUUM/ANALYZE、冷热数据会影响延迟，不能只看毫秒。
- [GPU/渲染] shader warmup、纹理尺寸、管线编译、Impeller/Skia、驱动和温控会改变 jank 来源。
- [Cache stampede] 热点 key 同时失效会击穿下游；互斥重建、随机 TTL、请求合并、预热、限流和降级必须成套验证。

## 与相邻技能的边界

- perf-engineering：负责性能症状量化、基线、负载模型、证据链、瓶颈归因、优化优先级、性能预算、回归门槛和回滚证据。
- backend-engineering：负责后端具体实现、API 中间件、连接池、限流熔断、任务队列和运行时配置；本技能只给性能证据和目标。
- db-design：负责 SQL、索引、表结构、事务、迁移、Redis 数据模型与一致性细节；本技能只指出慢查询证据和性能目标。
- observability-sre：负责监控、日志、trace、profile 接入、SLO、告警、incident 和 dashboard 治理；本技能消费并要求这些证据。
- cloud-native：负责 Kubernetes、HPA/VPA、Ingress、service mesh、资源配额、探针、灰度和集群容量配置；本技能判断其对 p95/p99 的影响。
- js-ts-dev：负责前端/Node 具体代码、bundle、SSR/CSR、hydration 和运行时实现；本技能定义 CWV、主线程和资源预算。
- test-engineering：负责测试矩阵、性能回归自动化、CI 证据、E2E/负载脚本质量；本技能定义性能验收指标。
- code-audit：负责改动后的影响面、安全/正确性/回归证据收口；性能改动完成前必须最终审计。
