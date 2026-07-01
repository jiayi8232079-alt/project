---
name: elixir-erlang-development
description: Elixir / Erlang OTP 实战排障版技能 - Elixir、BEAM、OTP 26/27/28/29、supervisor、GenServer、Task/async_stream、Phoenix 1.8、LiveView 1.1、Ecto 3.13、Repo.transaction、Oban、Broadway、Nerves、Credo、Dialyxir、Telemetry、BEAM scheduler、mailbox、NIF、release、config/runtime.exs、Hex.pm。涉及 .ex/.exs、mix.exs、Phoenix/LiveView、Ecto、OTP 并发、后台任务、队列、可观测和 BEAM 发布时必须使用。
---

# Elixir/Erlang 开发

Elixir/Erlang 开发（elixir-erlang-development，兼容 slug: exr）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

定位：把 Elixir 任务从“能跑”收敛为“BEAM/OTP 语义正确、故障可恢复、并发可控、生产可观测”。先确认 Elixir/OTP/Phoenix/Ecto/Oban 版本、监督树入口、消息/进程拓扑和证据，再按场景卡执行；无版本、无复现、无影响面时先停下补证据。

## 快速总则：版本 / 监督树 / 消息拓扑 / 证据

1. 版本先行：记录 Elixir、Erlang/OTP 26/27/28/29、Phoenix、Phoenix LiveView、Ecto、Oban、Broadway、Nerves、Ash、数据库、CI 镜像、release 镜像和 `mix.lock`；不凭本机版本判断线上行为。
2. 入口先行：找到 Application supervisor、Endpoint、Repo、Oban、Broadway、Registry、DynamicSupervisor、Task.Supervisor、Telemetry handler、release 启动命令和 `config/runtime.exs`。
3. 拓扑先行：画清请求、消息、process、GenServer、Task/async_stream、PubSub、queue、mailbox、Registry key、外部 broker、DB transaction 的生产方和消费方。
4. 证据先行：保留错误原文、stacktrace、PID、process_info、message_queue_len、BEAM scheduler 利用率、Telemetry event、Phoenix request_id、Ecto SQL log、Oban job state、release boot log。
5. 语义先行：区分同步 call、异步 cast/send、Task、Oban job、Broadway message、Repo.transaction、Ecto.Multi、外部副作用和可重试边界。
6. 风险先行：进程泄漏、mailbox 堆积、supervisor 级联、NIF 阻塞、事务内慢 I/O、任务重复副作用、LiveView 状态漂移、runtime config 冻结都要显式排查。
7. 边界先行：umbrella、多 context、多 Repo、多 Endpoint 项目先画 app/context 依赖方向；禁止跨 context 直接操作 schema/Repo 私有细节，公共入口以函数契约、事件或 job 为准。
8. 集群先行：启用 distribution、libcluster、PubSub 集群、Presence、global/pg/Registry、远程节点调用时，必须说明节点发现、netsplit、滚动升级、消息重复/丢失和跨版本兼容语义。
9. 收口先行：涉 API 契约补 api；涉表/索引/SQL/迁移补 db；涉安全/CORS/SSRF/上传/会话补 wsec/dso；涉性能补 pfe；涉观测/SLO/告警补 obs；涉 release/CI/回滚补 rls；实现完成按风险补 tst 和 aud。
10. 低级错禁行：不裸 spawn 业务进程、不用 cast 表达必须成功的写操作、不把 preload 当权限校验、不在 transaction/LiveView/GenServer callback 内做无超时外部 I/O、不把本地 `iex -S mix` 成功当 release 证据。
11. 验收先行：每次结论必须绑定真实命令、日志、Telemetry、SQL、PID、版本、release artifact 或测试输出；没有落地证据只能写“未验证”。
12. 顺序先行：涉及多发送方、多消费者、PubSub、Broadway、Task 或跨节点消息时，必须说明是否要求全局顺序、分区内顺序、最终一致或可乱序幂等。

## 场景执行卡

### 1. Mix / 版本 / 依赖 / 编译配置

- 输入：`mix.exs`、`mix.lock`、umbrella、Elixir/OTP、Hex 源、编译警告、compile/runtime config、CI/release 镜像。
- 动作：核对 Elixir requirement、OTP 26/27/28/29 兼容、umbrella app 依赖方向、依赖锁、Hex retired/vulnerability、Hex.pm 与 GitHub tag/mix.exs 版本差异、许可证、warnings-as-errors、formatter、Credo、Dialyxir、compile-time config 是否误进 release。
- 证据：版本命令、`mix deps`、`mix compile --warnings-as-errors`、lockfile diff、CI job、release boot log。
- 防遗漏：本地 OTP 可用不代表容器可用；`config/config.exs` 编译期读取 secret 会冻结到 release。

### 2. BEAM process / mailbox / scheduler

- 输入：进程数、PID、mailbox、heap、reductions、links、monitors、Registry/pg/global、PubSub/Presence、Node/distribution/libcluster、CPU quota。
- 动作：用 process_info/observer/etop/Telemetry 查 message_queue_len、heap、GC、reductions、binary memory、run queue、BEAM scheduler；设计发送方、接收方、超时、取消、背压和过载丢弃策略；跨节点 Registry/pg/global/PubSub/Presence 要定义节点上下线、重复订阅、消息顺序、幂等和降级；远程 call 必须有 timeout、重试和熔断边界。
- 证据：PID、process_info 摘要、observer/etop/recon、错误日志、过载测试、scheduler utilization、mailbox 增长曲线、节点发现和滚动升级样本。
- 防遗漏：无限 send、未处理 `:DOWN`、孤儿 process、外部输入转 atom、large binary 被 process 长期引用、跨节点消息无重试语义、netsplit 后双主写入、滚动升级期间 payload 版本不兼容、容器未开放 epmd/distribution 端口。

### 3. OTP supervisor / DynamicSupervisor / fault tolerance

- 输入：监督树、child_spec、restart、shutdown、max_restarts、故障域、状态恢复来源、外部连接。
- 动作：长生命周期进程必须进 supervisor；临时任务用 Task.Supervisor；DynamicSupervisor 限制容量、分区和注册名；按 one_for_one/rest_for_one/one_for_all 设计故障影响；状态恢复来源必须是 DB/event/job/cache 可重建路径之一。
- 证据：Supervisor.which_children、崩溃重启日志、故障注入、恢复测试、max_restarts 触发样本、状态重建样本。
- 防遗漏：临时任务被 `:permanent` 重启；init 做慢 I/O；监督树过大导致级联重启；restart intensity 掩盖 crash loop；重启后丢内存状态；Registry 名称冲突导致进程启动失败；把 supervision tree 当目录清单而不定义故障域、shutdown 超时和恢复来源。

### 4. GenServer / Agent / ETS / NIF

- 输入：状态所有权、同步/异步 API、callback 耗时、调用者超时、ETS owner、Cachex/Nebulex、persistent_term、NIF 调用、dirty scheduler 使用。
- 动作：GenServer callback 快进快出；慢 HTTP/DB/CPU 交 Task.Supervisor 或 job；公共 API 包装 call/cast 并写清返回语义；状态版本、迁移和恢复路径明确；ETS owner 和恢复明确；ETS 表必须定义 owner、read/write_concurrency、protected/public 边界、重启重建、快照或失效策略；ETS/Cachex/Nebulex/persistent_term 必须说明 owner、TTL、失效、预热、缓存击穿、跨节点一致性和降级，persistent_term 只放低频更新配置；NIF 必须确认阻塞、内存和崩溃边界。
- 证据：单测、超时测试、mailbox 观测、crash 恢复、缓存命中/失效样本、状态升级/重建样本、NIF profile 或供应方说明。
- 防遗漏：GenServer 自己 call 自己死锁；cast 丢失败；忘记 reply 或错误吞掉 caller timeout；ETS 表随 owner 崩溃消失；缓存 key 不含 tenant；无 TTL 导致脏读；批量更新 persistent_term 触发全局 GC；缓存回源压垮 Repo pool；NIF 卡住 BEAM scheduler。

### 5. Phoenix HTTP / Channel / PubSub

- 输入：Endpoint、Router、Plug 顺序、session/csrf、认证、rate limit、socket assigns、PubSub topic、tenant。
- 动作：controller 只做协议转换；context 处理业务并作为跨模块唯一公共入口；JSON/API 必须有稳定 DTO/view、错误结构、状态码、版本兼容和 request_id；Plug 覆盖认证、body/upload size、csrf、secure headers、session/cookie same_site/secure/http_only、续期、CORS、rate limit、SSRF 出口和文件类型校验；Channel topic 服务端授权；PubSub topic 低基数且含租户边界。
- 证据：ConnCase、请求样本、状态码矩阵、越权测试、Phoenix request_id 日志、上传/CORS/session/rate limit 样本。
- 防遗漏：controller 直调 Repo 绕过 context；页面隐藏按钮但接口不验权；topic 泄露跨租户；直接 Jason.encode schema 泄露字段；CORS `*` 搭配凭证；上传文件只信 MIME；外部 URL 由用户控制导致 SSRF；生产错误返回 stacktrace；错误结构随异常漂移。

### 6. Phoenix LiveView / LiveComponent

- 输入：disconnected/connected mount、params/session、assigns、streams、temporary_assigns、uploads、JS hooks、PubSub、handle_info、导航权限。
- 动作：disconnected mount 只做轻量工作；connected mount 再订阅；handle_event 重跑服务端校验；大列表用 streams/temporary_assigns；async assign 要有 loading/error/取消语义；handle_params 管 URL 状态；PubSub/Presence 订阅按租户和资源建 topic，terminate/reconnect 后不重复订阅。
- 证据：LiveViewTest、事件测试、权限测试、断线重连、Telemetry mount/render/handle_event 指标、PubSub 广播样本、upload 清理样本。
- 防遗漏：敏感数据放 assigns；未取消订阅；大列表全量 assign；stream id 不稳定导致重复行；客户端 hook 绕过服务端校验；上传临时文件残留；重连后状态漂移。

### 7. Ecto schema / changeset / Ecto.Multi / Repo.transaction

- 输入：schema、embedded schema、changeset、constraint、Repo 调用、Ecto.Multi、Repo.transaction、锁、旧数据、外部副作用。
- 动作：外部输入走 cast/validate；唯一性靠 unique index + unique_constraint；复杂写用 Ecto.Multi；Repo.transaction 内只做短 DB 操作；外部调用用 outbox 或事务后任务；preload 只加载展示/业务所需关联且不得替代授权；并发写优先用 unique/foreign/check constraint、optimistic_lock、upsert/on_conflict 或 advisory lock；分页优先 cursor/keyset；多租户、read replica、分片必须显式传递租户/前缀/一致性语义。
- 证据：changeset 错误断言、constraint 测试、transaction 回滚测试、SQL log、EXPLAIN、preload 查询数、并发/租户/分页样本。
- 防遗漏：validate_required 当 NOT NULL；先查后插竞态；事务内 HTTP；preload N+1 或越权加载；金额用 float；offset 深分页拖垮查询；读写分离读到旧数据；tenant prefix 漏传；on_conflict 静默吞掉业务冲突。

### 8. Ecto migration / release migrations

- 输入：迁移文件、表大小、索引、锁、回填、旧版本兼容、release 启动流程、回滚。
- 动作：expand/backfill/contract；大表索引并发或低峰受控；release migration 与应用启动解耦或受控；旧代码读写兼容。
- 证据：dry-run、锁风险说明、回填批次、旧版本兼容测试、迁移 runner 日志、回滚/roll-forward 方案。
- 防遗漏：生产 auto migrate；长事务 DDL；删除字段无窗口；默认值回填锁全表；回滚后旧 release 读不了新数据；migration 成功但应用启动失败。

### 9. Oban jobs / queues / cron

- 输入：worker、args、queue、unique、max_attempts、backoff、timeout、cron、plugins、Repo pool、幂等键。
- 动作：args 小而可序列化；perform 幂等；unique 绑定业务键和窗口；关键/耗时队列隔离；失败可重试、可补偿、可告警。
- 证据：Oban.Testing、drain_queue、job state、attempt errors、Telemetry、重复投递样本。
- 防遗漏：任务参数塞大对象；重试二次扣款；队列并发耗尽 Repo pool；cron 多实例重复；discard 未告警。

### 10. Broadway / GenStage / Task.async_stream

- 输入：producer、processor、batcher、ack、max_demand、batch_size、concurrency、partition、ordering、async_stream timeout、外部 broker 语义。
- 动作：用 backpressure 控制入口；processor 幂等；batcher 处理部分失败；ack/nack 对齐 broker；Task.async_stream 设置 max_concurrency、timeout、on_timeout 和消费策略；Registry/Task.Supervisor 组合必须有唯一 key、重复启动处理、任务取消和结果回收。
- 证据：pipeline metrics、积压、处理延迟、失败重试、broker ack、吞吐 baseline、超时样本。
- 防遗漏：只加 concurrency；批处理失败全量重试；顺序要求未 partition；async_stream 默认超时杀任务却未处理副作用；Registry 查到 PID 后进程已死却未重试；Task 结果未被枚举消费导致异常被延后或吞掉；backpressure 只看应用层不看 broker、Repo pool 和下游限流。

### 11. Telemetry / Logger / OpenTelemetry

- 输入：Phoenix/Ecto/LiveView/Oban/Broadway events、Logger metadata、OTel exporter、指标 label、采样、脱敏。
- 动作：统一 service/env/version/request_id/trace_id；指标低基数；错误和慢请求保留 trace；日志脱敏；自定义 Telemetry event 命名稳定并有 measurements/metadata 契约。
- 证据：handler 测试、metrics 查询、trace/log 互跳、敏感字段抽查、采样规则。
- 防遗漏：user_id/order_id 进 metric label；span attribute 放完整 payload；采样丢错误；event 名漂移。

### 12. Performance / profiling / capacity

- 输入：SLO、吞吐、延迟、Repo pool、HTTP client pool、scheduler、mailbox、binary memory、LiveView render、N+1、benchmark 数据。
- 动作：先定性能预算和瓶颈假设；用 Telemetry、recon/observer、Benchee、profiling、EXPLAIN 验证；调 concurrency 时同时核对 Repo pool、下游限流和容器 CPU quota。
- 证据：baseline、profile、指标查询、变更前后对比、回滚阈值。
- 防遗漏：只看平均值；只加并发；忽略 large binary 引用；LiveView 大 assigns 导致 diff/render 放大；Repo pool 和 HTTP pool 互相拖死。

### 13. ExUnit / Mox / SQL Sandbox

- 输入：ExUnit、DataCase、ConnCase、LiveViewTest、Ecto SQL Sandbox、Mox、Oban.Testing、Broadway test producer。
- 动作：changeset/domain 单测；Repo 集成测；ConnCase/LiveViewTest 测权限和事件；Mox 只 mock 外部边界；async 测试确认 sandbox 和全局状态安全；核心纯函数和协议边界补 property/contract 测试；并发、重试、幂等、netsplit/节点上下线、时间相关逻辑用可控时钟或故障注入。
- 证据：`mix test`、目标用例、失败前红灯、flaky 产物、覆盖缺口。
- 防遗漏：async 共享进程名/ETS；mock 核心逻辑；固定 sleep 等消息；Mox 未 verify。

### 14. release / runtime.exs / containers

- 输入：release 命令、config/runtime.exs、secret、migration runner、remote console、health check、SIGTERM、CPU/memory limit、epmd/distribution。
- 动作：运行时读取配置；缺关键配置直接 fail fast；release smoke 覆盖启动、迁移、health、remote console、graceful shutdown、集群发现、滚动升级兼容；容器核对 scheduler 数和内存限制；依赖/NIF/镜像需有漏洞、许可证、SBOM 或等效供应链证据；发布结论必须包含回滚命令、旧版本兼容和观察窗口。
- 证据：release boot log、版本接口、health 响应、remote console、SIGTERM 日志、容器资源指标、迁移/回滚演练或未演练说明。
- 防遗漏：secret 编译进 release；runtime.exs 依赖 build-time 环境；无 remote console；SIGTERM 粗暴杀进程；CPU quota 下 scheduler 与本地不同；只有 mix test 没有 artifact smoke。

## 真实验收矩阵

- OTP supervision：必须给出 supervisor tree 入口、child_spec/restart/shutdown、故障注入、重启日志和状态恢复证据；只贴模块名不算验收。
- GenServer：必须验证 call/cast 返回语义、timeout、mailbox、`:DOWN`/monitor、callback 耗时和崩溃恢复；只测 happy path 不算验收。
- Task / async_stream：必须验证 max_concurrency、timeout、on_timeout、异常传播、取消、结果消费和副作用幂等；只跑并发成功样本不算验收。
- ETS / cache：必须验证 owner 崩溃、表重建、TTL/失效、并发读写、租户 key、缓存击穿和降级路径；只看命中率不算验收。
- Ecto transaction：必须验证回滚、constraint、并发冲突、外部副作用移出事务、read-after-write 一致性和 SQL log；只看 Repo.transaction 返回 ok 不算验收。
- Phoenix / LiveView：必须验证 Plug/认证/授权、ConnCase 或 LiveViewTest、handle_event 服务端校验、断线重连、PubSub topic 隔离、uploads 清理和错误结构；只看页面能点不算验收。
- 消息顺序：必须说明顺序模型、partition key、重复/乱序处理、跨节点语义和幂等键；只说 BEAM 消息有序不算验收。
- Backpressure：必须验证入口限流、max_demand、queue depth、Repo/HTTP pool、下游限流、丢弃/降级策略和 Telemetry 指标；只提高 concurrency 不算验收。
- Release / config：必须用真实 release artifact 验证 runtime.exs、缺配置 fail fast、migration runner、health、remote console、SIGTERM、rollback 和观察窗口；只跑 `iex -S mix` 不算验收。
- Telemetry / Logger：必须验证 event 名、measurements/metadata 契约、低基数 label、trace/log 关联、采样和脱敏；只打印日志不算验收。
- 测试：必须覆盖单元、集成、并发/幂等、权限、异常、release smoke 或说明无法验证原因；没有命令输出、失败前红灯或场景矩阵，不写“通过”。

## 低级错禁止清单

- 禁止把临时脚本、未监督 process、裸 `spawn`、匿名 Task 当长期业务进程。
- 禁止用 `cast`、PubSub 或裸 `send` 承载必须确认成功的扣费、库存、授权、发货或状态转换。
- 禁止在 GenServer/LiveView callback 或 Repo.transaction 内做无超时 HTTP、文件、CPU 密集、外部支付、邮件、LLM 或第三方 SDK 调用。
- 禁止把 ETS、process dictionary、Agent、本地 cache 当跨节点或重启后可靠状态源。
- 禁止只凭 preload、assigns、隐藏按钮、topic 名或客户端参数判断权限。
- 禁止把本机 mix 编译、单测、console 成功包装成 release、容器、迁移、回滚或生产可用结论。
- 禁止记录 secret、token、Cookie、完整请求体、PII、支付参数、用户 prompt 或外部响应原文；日志和 Telemetry 默认脱敏。
- 禁止未说明顺序、幂等、重试和补偿就引入并发、队列、Task、Oban、Broadway 或 PubSub。

## 高频坑 / 防遗漏

- BEAM：把 process 当线程池、无限创建 process、忽略 mailbox、外部输入转 atom、binary 引用导致内存不释放、NIF 阻塞 scheduler。
- OTP：无 supervisor、restart 策略错误、init 慢 I/O、DynamicSupervisor 无容量限制、Registry key 冲突。
- GenServer：callback 阻塞、自调用死锁、cast 丢失败、未处理 `:DOWN`、状态版本不可迁移、内存状态不可恢复。
- Phoenix/LiveView：Plug 顺序错误、context 被绕过、资源归属不验、topic 泄露、大 assigns、重连状态漂移、hook 绕过权限。
- Ecto：changeset 不覆盖 DB 约束、先查后插、N+1、preload 越权、Repo.transaction 内外部调用、migration 不向前兼容。
- Oban/Broadway：job 不幂等、unique 维度错误、retry 放大副作用、queue 并发压垮 Repo pool、ack/backpressure 错配。
- Telemetry：高基数 label、日志泄敏、trace 断链、采样丢错误、event 契约漂移。
- 安全/API：schema 直出、CORS 凭证误配、上传/SSRF 未控、session/cookie 策略漂移、错误结构不稳定。
- 性能/缓存：只加并发、Repo pool 饥饿、binary 引用泄漏、cache stampede、persistent_term 高频更新。
- Testing：async 污染全局状态、sandbox owner 错误、固定 sleep、Mox 没 verify、只测成功路径。
- Release：compile-time secret、runtime config 漂移、迁移与启动耦合、无 graceful shutdown、无回滚/remote console。

## 输出要求

涉及 Elixir 任务至少输出：

1. 场景卡：命中 Mix、BEAM/process/cluster、OTP/supervisor、GenServer/cache/NIF、Phoenix/API/security、LiveView、Ecto/data、Oban、Broadway、Telemetry、performance、testing、release 哪几类。
2. 版本证据：Elixir、Erlang/OTP、Phoenix、LiveView、Ecto、Oban、Broadway、Ash、数据库、CI/release；未查标未验证。
3. 复现证据：请求/消息/job、PID/topic/queue、错误原文、日志/Telemetry/trace、最小复现或无法复现原因。
4. 影响面：调用方、context、schema、changeset、migration、LiveView event/assign、worker、pipeline、supervisor tree、配置、测试、部署。
5. 风险点：process 泄漏、mailbox 堆积、supervisor 级联、竞态、事务、幂等、权限、迁移锁、队列积压、观测缺口、release 回滚。
6. 修改摘要：改了哪些文件/模块/函数/配置；仅远端/API 更新时明确无本地文件改动。
7. 验证命令：mix format、mix compile、mix test、credo/dialyzer、目标测试、Telemetry/observer/benchmark/release smoke；未跑不得报通过。
8. 联动技能：已读取并遵守的 api/db/obs/rls/tst/aud；未读取说明原因。
9. 发布证据：本地测试、CI、artifact/release、migration、health、rollback、观察窗口分别是否已跑；缺哪一项就标“未验证”，禁止写“已上线可用”。

## 约束

- 不凭记忆判断版本特性；以项目 lockfile、CI/release 镜像和官方文档为准。
- 不裸 spawn 长生命周期 process；不让无监督 process 承担业务关键状态。
- 不在 GenServer callback、LiveView callback、Repo.transaction 中执行无超时慢 I/O。
- 不把外部输入转 atom；不记录 token、Cookie、PII、支付参数、完整请求体或敏感 prompt。
- 不用先查后插替代数据库唯一约束；不把 validate_required 当数据库约束。
- 不在生产做无窗口破坏性 migration；不删除字段/改类型而无兼容期和回滚方案。
- 不让 Oban/Broadway/Task.async_stream 重试产生重复副作用；任务和消息默认幂等。
- 不用高基数 Telemetry label；不把 user_id/order_id/raw_url 放 metric label。
- 不把测试通过包装成可上线；release、灰度、回滚和生产观察需 rls 收口。
- 不引入宏/DSL/依赖来炫技；优先项目既有约定和可诊断性。

## 高频 Bug 反例库

- 反例 1：错法 / 对法 / 根因：用 spawn 启动消费循环，崩溃后静默停止 / 放入 supervisor 或 DynamicSupervisor，定义 restart、shutdown 和恢复状态 / fault tolerance 来自 OTP 结构，不是 process 天然可靠。
- 反例 2：错法 / 对法 / 根因：GenServer handle_call 内慢 HTTP，所有调用者排队超时 / callback 快进快出，交 Task.Supervisor 并处理结果、超时和 `:DOWN` / GenServer 是串行边界，阻塞会放大到 mailbox。
- 反例 3：错法 / 对法 / 根因：扣款用 cast，调用方无法知道失败 / 需要确认、背压或错误语义时用 call、事务记录或 job 状态 / 异步消息没有业务确认。
- 反例 4：错法 / 对法 / 根因：Task.async_stream 不设 timeout/on_timeout，副作用中途被杀 / 设置 max_concurrency、timeout、on_timeout，并让处理幂等可补偿 / 并发工具不等于业务完成语义。
- 反例 5：错法 / 对法 / 根因：LiveView 只隐藏按钮，handle_event 不验权限 / 事件处理重跑服务端鉴权、资源归属和 changeset 校验 / 客户端状态可伪造。
- 反例 6：错法 / 对法 / 根因：插入前 Repo.get_by 查唯一值，并发下重复 / unique index + changeset unique_constraint，必要时 upsert / 唯一性必须由数据库原子约束保证。
- 反例 7：错法 / 对法 / 根因：Repo.transaction 内调用支付 HTTP，失败后外部副作用不可回滚 / 事务只写本地状态和 outbox，事务后异步执行外部调用 / 数据库事务不能回滚外部世界。
- 反例 8：错法 / 对法 / 根因：生产大表一次加 NOT NULL 并回填 / expand/backfill/contract，小批回填，锁风险可观测 / DDL 是发布风险，不是普通代码改动。
- 反例 9：错法 / 对法 / 根因：Oban 重试重复发券或扣款 / 业务幂等键、唯一约束、终态跳过和补偿查询 / 后台任务至少一次执行是常态。
- 反例 10：错法 / 对法 / 根因：Broadway 积压只翻倍 concurrency / 同时看 max_demand、batch、ack、Repo pool、下游限流和 Telemetry / 吞吐受整条 pipeline 约束。
- 反例 11：错法 / 对法 / 根因：metric label 放 user_id/order_id / 指标只保留 route/status/queue/env 等低基数，诊断 ID 放日志/trace / Metrics 是聚合信号，不是逐请求存储。
- 反例 12：错法 / 对法 / 根因：config.exs 读取 SECRET_KEY，release 后环境变量变化不生效 / config/runtime.exs 或启动时读取，缺关键配置 fail fast / Mix 编译配置和 release 运行配置生命周期不同。
- 反例 13：错法 / 对法 / 根因：NIF 做长 CPU/IO 且无 dirty scheduler / 换纯 BEAM/Port/dirty NIF，压测 scheduler 和崩溃边界 / NIF 崩溃或阻塞会拖垮整个 VM。
- 反例 14：错法 / 对法 / 根因：PubSub topic 不带 tenant，跨租户收到消息 / topic 命名含 tenant/resource，订阅和广播都验权 / PubSub 是服务端共享通道，隔离要显式建模。
- 反例 15：错法 / 对法 / 根因：global name 进程在 netsplit 两侧都写订单 / 用数据库约束、幂等键或单主写入边界，恢复后 reconcile / BEAM 集群不是天然一致性数据库。
- 反例 16：错法 / 对法 / 根因：API 直接 Jason.encode schema 且 CORS 放开凭证 / DTO/view 白名单输出，CORS、cookie、错误结构按入口测试 / Web 边界要显式契约和安全策略。
- 反例 17：错法 / 对法 / 根因：Cachex 无 TTL 且 key 不含 tenant，回源峰值打满 Repo pool / key 带租户和版本，设置 TTL/jitter/锁或预热，监控回源 / 缓存是数据一致性和容量边界。
- 反例 18：错法 / 对法 / 根因：read replica 查询刚写入的数据导致用户看不到新状态 / 标记强一致读走主库或引入读后写一致性窗口 / 读写分离要暴露一致性语义。
- 反例 19：错法 / 对法 / 根因：Phoenix context 已有授权入口却在 controller/LiveView 里直接 Repo.update / 只调用 context 公共函数并补权限测试 / context 是业务边界，不是目录装饰。
- 反例 20：错法 / 对法 / 根因：preload 后用关联是否存在判断访问权 / 单独执行资源归属/tenant 校验并限制 preload 字段 / preload 是加载策略，不是授权策略。
- 反例 21：错法 / 对法 / 根因：Registry lookup 后直接 send，目标进程刚退出导致消息丢失 / monitor 或通过 GenServer.call/任务状态确认，失败重试或补偿 / PID 是瞬时引用。
- 反例 22：错法 / 对法 / 根因：LiveView async assign 只处理成功态 / 明确 loading、error、cancel、reconnect 和权限重验 / UI 异步状态也是服务端状态机。
- 反例 23：错法 / 对法 / 根因：release 只跑 mix test 就发布 / 用真实 artifact 跑启动、迁移、health、remote console、SIGTERM 和回滚 smoke / 测试环境不等于 release 行为。
- 反例 24：错法 / 对法 / 根因：observer 看到 mailbox 高就扩大 Repo pool / 先定位生产者、消费者、下游和背压，再调并发/池子 / mailbox 是症状，根因在拓扑。
- 反例 25：错法 / 对法 / 根因：DynamicSupervisor 不限 child 数，流量尖峰把 VM 拖死 / 增加容量、分区、拒绝策略和 Telemetry 告警 / supervision 管恢复，也要管入口容量。
- 反例 26：错法 / 对法 / 根因：Task.async_stream 结果未消费完就返回 / 完整枚举结果、处理异常和超时，副作用写幂等键 / Task 只有被消费才形成可靠结果语义。
- 反例 27：错法 / 对法 / 根因：ETS owner 是临时进程，崩溃后缓存表消失 / owner 放入监督树并定义重建、预热和降级 / ETS 生命周期跟 owner 绑定。
- 反例 28：错法 / 对法 / 根因：依赖单进程 mailbox 顺序保证业务全局顺序 / 按业务 key partition，写幂等和乱序丢弃规则 / BEAM 只保证同一发送方到同一接收方的局部顺序。
- 反例 29：错法 / 对法 / 根因：LiveView connected mount 反复订阅同一 topic，重连后重复消息 / 订阅放在 connected 条件并防重复，terminate/reconnect 回归 / LiveView 生命周期不是一次性页面加载。
- 反例 30：错法 / 对法 / 根因：Repo.transaction 里执行 Ecto.Multi 后再发邮件，回滚却已通知用户 / 事务只写 outbox，事务后 job 消费并幂等 / 数据库原子性不覆盖外部系统。
- 反例 31：错法 / 对法 / 根因：release 读取 config.exs 的编译期 env，线上改 env 不生效 / runtime.exs 读取运行时 env，缺项 fail fast 并跑 artifact smoke / Mix 配置有编译期和运行期边界。
- 反例 32：错法 / 对法 / 根因：Telemetry event metadata 放完整请求 payload / 只放低基数、脱敏字段，详情进受控日志或 trace / 指标和事件契约必须可聚合且不泄密。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] 无 fenced code block。
- [ ] 已确认 Elixir、Erlang/OTP、mix、依赖、CI/release 版本。
- [ ] 已记录复现输入、错误原文、日志/trace/Telemetry 或无法复现原因。
- [ ] 已搜索调用方、context、schema、changeset、migration、LiveView、worker、pipeline、supervisor tree、配置和测试。
- [ ] umbrella/context 边界、多 Repo/Endpoint、跨 app 依赖方向和公共入口已明确。
- [ ] supervisor、GenServer、Task/async_stream、process、mailbox、message passing、cluster/distribution 的生命周期、背压、超时和故障语义已明确。
- [ ] Phoenix LiveView 服务端鉴权、参数校验、assigns 生命周期和 PubSub 边界已检查。
- [ ] Ecto.Multi、Repo.transaction、changeset、constraint、preload、migration 兼容和旧数据已检查。
- [ ] Oban job、Broadway message 具备幂等、重试、ack/backpressure 和 Telemetry 证据。
- [ ] API DTO/错误结构、session/cookie、CORS、上传、SSRF、atom exhaustion、PII/secret 脱敏已按入口检查。
- [ ] 缓存 TTL/失效/击穿、multi-tenancy/read replica/分页/锁、性能 baseline/profile/容量预算已检查。
- [ ] BEAM scheduler、NIF、binary memory、Repo pool、release/runtime config、依赖/NIF/镜像供应链风险已检查。
- [ ] 最终按风险联动 tst 与 aud；涉 API/DB/观测/发布补对应技能。

## 2026 生态矩阵 / P0

- Elixir 1.20：改动前核对项目 `elixir` requirement、CI image、release image 和依赖支持矩阵；遇到 Elixir 1.19 并发编译已知问题，先固定复现、清理 `_build`/PLT 缓存并查依赖编译期宏/协议，不直接升级掩盖。
- Erlang/OTP：生产主线按 OTP 27+ 评估，兼容窗口覆盖 OTP 28，前瞻检查 OTP 29；Nerves 已要求 OTP 26+，不要再新增 OTP 25 兼容承诺。
- Phoenix 1.8.7：1.8.6 修复 LongPoll 内存耗尽 CVE，1.8.7 补 token masking；升级/回退必须回归 LongPoll、WebSocket、session/cookie、token 日志脱敏和安全扫描。
- Phoenix LiveView：稳定线以项目 lockfile 为准；截至本次核对 Hex 最新含 1.2.0-rc.2，RC/预发布必须单独标注，不把 RC 当稳定默认；回归 streams、uploads、async assign、hooks、reconnect 和 LiveViewTest。
- Ecto 3.13：Hex/CHANGELOG 可见 3.13.6，而 GitHub `mix.exs` 可能仍显示 3.13.3；版本冲突时以项目 `mix.lock`、Hex.pm package、CHANGELOG 和 tag/release 证据并列，不只引用 GitHub 默认分支。
- Oban 2.22.1：核对 queue/unique/plugins/testing helpers 与 Repo pool；后台任务升级要做幂等、重复投递、discard/ retry 告警和 Telemetry 回归。
- Broadway 1.3.0：核对 GenStage/backpressure、producer demand、batcher、ack/nack 和 Telemetry；容量调整必须同时看 broker、Repo pool 和下游限流。
- Nerves 1.14.1：按 OTP 26+、target/toolchain、firmware/release、runtime config、网络和 OTA 回滚验证；删除 OTP 25 旧假设。
- CI 强门禁：Credo 与 Dialyxir 作为 merge/release gate，至少包含 `mix compile --warnings-as-errors`、`mix format --check-formatted`、Credo、Dialyxir、`mix test`；PLT/cache 命中不能替代真实 CI 证据。
- Hex/GitHub 不一致：遇到版本、CHANGELOG、tag、`mix.exs` 不一致，先记录来源和时间，优先以 Hex.pm 发布包和 lockfile 决策，GitHub 默认分支仅作开发态线索。

## 2024-2026 新坑速查

- Elixir 1.17-1.20：类型、编译诊断、并发编译和 stdlib 持续演进；库若声明旧 requirement，不能直接使用新语法或新 API。
- OTP 26/27/28/29：JIT、SSL、logger、distribution、process/GC 与 BEAM scheduler 行为持续变化；生产排障必须核对实际 OTP release。
- Phoenix 1.7/1.8：Verified Routes、HEEx、function components 是主线；1.8.6/1.8.7 安全修复涉及 LongPoll 内存和 token masking，路由/组件/模板改动要回归编译期校验和旧入口。
- Phoenix LiveView 1.0/1.1/1.2 RC：streams、uploads、async assign、Telemetry、JS interop 更常用；先看 lockfile 和 Hex 包版本，大列表、异步状态和重连状态必须按生命周期设计。
- Ecto 3.12/3.13：changeset、migration、SQL sandbox、adapter 和 Telemetry 字段以锁定版本为准；注意 Hex/CHANGELOG 3.13.6 与 GitHub mix.exs 3.13.3 差异，看板和测试同步更新。
- Oban 2.18-2.22：unique jobs、queue partitioning、plugins、testing helpers 更成熟；2.22.1 场景仍要求业务幂等和队列隔离。
- Broadway 1.2/1.3：GenStage backpressure、producer demand、batch telemetry 是调优核心；1.3.0 场景不要用单一 concurrency 判断容量。
- BEAM in containers：CPU quota、scheduler 数、memory limit、epmd/distribution、SIGTERM graceful shutdown 会改变生产表现；release smoke 必须覆盖容器。
- NIF / Rustler / ports：NIF 性能收益伴随 VM 崩溃和 scheduler 阻塞风险；优先确认 dirty scheduler、超时、内存所有权和降级方案。
- OpenTelemetry：自动 instrumentation 不等于观测完整；Phoenix/Ecto/Oban/Broadway 事件需统一 resource、低基数属性、采样和脱敏。
- Runtime config：config/runtime.exs 是 release 运行配置边界；compile-time env、provider、secret 缺失和热更新能力必须逐项验证。
- AI 生成 Elixir：常漏 supervisor、错误用 cast、事务内外部调用、LiveView 权限和测试证据；按真实 OTP 拓扑复核，不信“看起来能跑”。

## 与相邻技能的边界

- `API 工程/api-engineering（api）`：负责 Phoenix API 路由、HTTP 方法、请求/响应 DTO、状态码、错误结构、认证授权契约、OpenAPI/GraphQL/Absinthe 触发口径、幂等键和消费者兼容；Elixir/Erlang 开发/elixir-erlang-development（exr） 只负责 controller/context/plug/socket 的 Elixir 实现语义。
- `数据库工程/database-engineering（db）`：负责表结构、索引、SQL、迁移锁、事务隔离、数据修复、Redis/缓存一致性；Elixir/Erlang 开发/elixir-erlang-development（exr） 只负责 Ecto changeset、Ecto.Multi、Repo.transaction、migration 文件写法和调用影响。
- `可观测性/observability（obs）`：负责 SLI/SLO、告警、dashboard、OpenTelemetry 采样、incident、runbook 和观测成本；Elixir/Erlang 开发/elixir-erlang-development（exr） 只负责 Telemetry event、Logger metadata、trace_id 在代码中的正确接入。
- `Web 安全/web-security（wsec）`/`DevSecOps/devsecops（dso）`：负责 CORS/CSRF/SSRF/session/upload/secret/PII/依赖漏洞/SBOM/许可证等安全策略和供应链结论；Elixir/Erlang 开发/elixir-erlang-development（exr） 只保留 Phoenix/BEAM/Ecto 侧落地检查点。
- `性能工程/perf-engineering（pfe）`：负责容量模型、压测、profiling 方法、SLO 和性能回归结论；Elixir/Erlang 开发/elixir-erlang-development（exr） 只负责 BEAM/Phoenix/Ecto/Oban/Broadway 侧性能证据入口。
- `发布部署/release-engineering（rls）`：负责唯一 artifact、CI/CD、release、runtime config、灰度、健康检查、回滚、SBOM/签名和发布证据；Elixir/Erlang 开发/elixir-erlang-development（exr） 只负责 Mix/release 配置、runtime.exs 和启动行为的语言侧正确性。
- `测试验证/test-engineering（tst）`：负责场景矩阵、测试分层、CI 证据、flaky 和发布冒烟；Elixir/Erlang 开发/elixir-erlang-development（exr） 只负责 ExUnit/Mox/Sandbox/LiveViewTest/Oban 测试实现口径。
- `代码审计/code-audit（aud）`：负责改动后需求对账、影响面、安全质量和证据边界最终收口；Elixir/Erlang 开发/elixir-erlang-development（exr） 不替代最终审计结论。
- 组合链：纯 Elixir 内部修复用 Elixir/Erlang 开发/elixir-erlang-development（exr） → 测试验证/test-engineering（tst） → 代码审计/code-audit（aud）；涉 API 加 API 工程/api-engineering（api）；涉 Ecto 结构/迁移加 数据库工程/database-engineering（db）；涉观测加 可观测性/observability（obs）；涉 release/runtime/CI 加 发布部署/release-engineering（rls）。
