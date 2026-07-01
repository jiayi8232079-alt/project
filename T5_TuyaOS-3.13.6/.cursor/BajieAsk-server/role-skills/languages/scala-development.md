---
name: scala-development
description: Scala Dev实战排障版 - 负责 Scala 2/3、sbt/Mill/Scala CLI、JDK 8/11/17/21、Akka/Pekko、Cats Effect/ZIO、Play、Spark/Flink、Scala.js/Native、macro/TASTy、binary/schema/API 兼容、测试、性能、安全与发布排障。涉及 .scala、build.sbt、scalaVersion、crossScalaVersions、given/using、effect runtime、Play routes、Spark Dataset/Encoder/UDF、MiMa、Metals/BSP、Scalafmt/Scalafix 时必须使用。
---

# Scala 开发

Scala 开发（scala-development，兼容 slug: sca）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

> 定位：只处理 Scala 语言、JVM 工具链、Scala 生态框架、数据/流处理和发布兼容中的实战排障；不替代 Java、测试、发布、DB、API、安全技能，但必须把它们需要的 Scala 证据准备完整。
> 铁律：未确认 Scala/JDK/构建入口/运行入口不改；未搜调用方和消费方不改 public API、case class、sealed ADT、given/implicit、wire schema；未跑最小验证不报通过；不把 Java/Kotlin/纯 FP 经验直接套到 Scala 项目。

## P0 入口卡：生态、坐标、健康度

首次介入依赖/框架/版本/发布前，先补齐生态入口卡：

- 官方入口：官方 docs、migration guide、release notes、compatibility matrix、security advisories。
- 社区入口：Scaladex、awesome-scala、GitHub/GitLab repo、issue/PR、discussion、StackOverflow/Discord/论坛只作线索不作结论。
- Repo health：最近 release、commit 活跃度、未合并 PR/关键 issue、CI 状态、维护者数量、bus factor、release cadence。
- 维护状态：active/maintenance/deprecated/archived/forked；Akka/Pekko 必查 license 与迁移路线。
- 坐标证据：organization、artifactId、`%%`/`%`、Scala binary suffix、versionScheme、模块拆分、transitive dependencies、repository/resolver。
- 支持矩阵：Scala 2.12/2.13/3.x、JDK 8/11/17/21、sbt 1/2、Mill、Scala.js/Native、Spark/Play/Akka/Pekko/Cats Effect/ZIO/Flink 版本。
- 合规：license、NOTICE、CVE/SBOM、签名/provenance、企业仓库镜像和凭据来源。

## P0 版本矩阵模板

| 维度 | 当前 | 目标 | 风险/证据 | 验证 |
| --- | --- | --- | --- | --- |
| Scala | 2.12 / 2.13 / 3.x 精确版本 | 目标版本 | source/binary/TASTy | compile + downstream sample |
| Scala binary | `_2.12` / `_2.13` / `_3` | 目标 suffix | `%%`/artifact 坐标 | dependencyTree/pom |
| JDK | 8 / 11 / 17 / 21 | 目标 JDK | 强封装/GC/容器/virtual threads | test + container smoke |
| Build | sbt 1.x / early sbt 2 / Mill / Scala CLI | 目标 | 插件/BSP/cache | clean compile/test/package |
| Platform | JVM / Scala.js / Native | 目标 | linker/facade/native toolchain | fullOptJS/nativeLink |
| Spark | 3.5 / 4.x | 目标 | Scala binary/JDK/Connect/API | local sample + cluster dry run |
| Play | 2.9/3.x + Java 17/21 | 目标 | routes/JSON/EC/security | route/API tests |
| Akka/Pekko | Akka 2.6/2.7+/Pekko | 目标 | license/package/config | serialization + rolling smoke |
| Effect | Future / Cats Effect 3 / ZIO 2 | 目标 | runtime/cancel/blocking | unit + timeout/cancel/leak |
| Compat | MiMa / codec / schema / API | baseline | source/binary/wire/data | MiMa + roundtrip |

## P0 可执行验证模板

按项目实际取最小闭环；未执行必须写阻塞原因。

- sbt：`sbt clean compile test package publishLocal mimaReportBinaryIssues`；跨版本用 `sbt +compile +test +publishLocal`。
- Mill：`mill __.compile __.test __.publishLocal`，并用 `mill show __.resolvedIvyDeps` 记录依赖证据。
- Scala CLI：`scala-cli compile . && scala-cli test . && scala-cli package .`。
- Play：运行项目内 route 或 integration test；如需启动服务，记录 `sbt run` 的端口、日志和退出方式。
- Spark：用本地 `spark-submit --master local[2]` 跑最小样本，并保留 driver/executor classpath、event log、checkpoint/state schema 证据。
- Effect runtime：覆盖 timeout、retry、cancel、blocking pool、resource release、fiber dump 相关测试。
- 兼容：跑 MiMa、JSON/Avro/Proto/Spark Encoder roundtrip、`publishLocal` 和 downstream sample compile/test。

## P0 真实验收门禁

验收不是“编译过”一句话；必须把场景证据、失败边界和未覆盖项说清。

- 最小闭环：按实际构建工具跑 clean compile + 相关 test；跨版本或库发布必须跑 `+compile`/`+test`/`publishLocal` 或说明替代验证。
- 差异闭环：Scala 2/3、JDK、Spark/Play/Akka/Pekko、Cats Effect/ZIO 的版本差异必须有矩阵，不允许只写“兼容”。
- 契约闭环：case class、sealed ADT、enum、given/implicit、codec、schema、public API 改动必须有调用方搜索、旧数据/旧客户端 roundtrip 或明确阻塞。
- 运行闭环：Future/Effect/Akka/Spark/Flink 改动必须覆盖 timeout、cancel、resource release、dispatcher/thread pool、driver/executor 或 state/checkpoint 证据。
- 发布闭环：artifact suffix、pom/ivy、MiMa/TASTy/Java ABI、license/SBOM/signing、回滚路径至少取与变更风险匹配的一项可执行证据。
- 性能闭环：性能结论必须有 before/after、JFR/GC/thread dump、Spark UI/event log、Flink Web UI 或基准数据；没有数据只能说“未验证性能”。
- 失败闭环：命令失败、flaky、环境缺失、集群未跑、下游 sample 缺失时，必须报告未通过/未覆盖，不得换成口头推断。

## P0 低级错闸门

动手前先过这组闸门；任何一项不明，先补证据，不靠经验猜。

- 不知道 Scala binary suffix 时，不改依赖坐标；`%%`、`%`、`_2.12/_2.13/_3` 必须对齐运行环境。
- 不知道 JDK 与目标镜像时，不改 GC、JVM flags、Akka/Play/Spark 版本；本机 JDK 结论不能外推到容器/集群。
- 不知道构建入口时，不改 `build.sbt`、`project/plugins.sbt`、`build.sc`、CI cache、publish 设置。
- 不知道调用方时，不改 public API、case class 参数顺序、默认值、sealed hierarchy、enum 编码、given/implicit。
- 不知道 runtime 时，不把 Future、IO、ZIO、Akka Streams 随意互转；互操作只能在边界层集中封装。
- 不知道数据兼容时，不改 Spark/Flink state、checkpoint、schema、Encoder、Avro/Proto/JSON codec。
- 不知道回滚路径时，不发布 artifact、配置、序列化格式或数据格式变更。

## 快速总则：Scala/JVM 四要素

1. 版本矩阵：先记录 Scala 2/3 精确版本、Scala binary suffix、JDK、sbt/Mill/Scala CLI、插件、框架、依赖、crossScalaVersions、CI matrix；版本不明先补证据。
2. 编译与运行入口：区分 compile/test/run/package/publish、multi-module、macro 编译阶段、Spark driver/executor、Flink JobManager/TaskManager、Akka/Pekko actor system、Play route、Scala.js/Native target。
3. 语义边界：显式确认 implicit/given 解析、extension/enum/opaque type、lazy/eager effect、cancel/timeout、blocking pool、classloader、serialization、binary/source/TASTy/Java ABI/wire/schema compatibility。
4. 排障证据：保留完整命令、错误、堆栈、dependency tree/eviction、TASTy/bytecode/MiMa、thread dump/JFR/GC log、Spark UI/event log、Flink checkpoint/savepoint、codec roundtrip、最小复现。
5. 改类型或契约前全量搜：case class 构造/复制/解构、默认参数、pattern match、JSON/Avro/Proto/DB/Spark Encoder、Java/Kotlin 调用、反射、配置 key、旧数据、发布 artifact。
6. Future、Cats Effect、ZIO、Akka/Pekko 不混用默认假设：先确认 runtime、ExecutionContext、dispatcher、supervision、resource lifecycle、fiber/green thread/virtual thread 边界。
7. Scala 2/3 迁移必须写差异：implicit vs given/using、implicit class vs extension、macro paradise/blackbox vs inline/quotes、TASTy、eta-expansion、collections、enum、opaque type、derivation。
8. 发布与回滚必须绑定：MiMa、versionScheme/semantic version、cross build、artifact 坐标、Scala binary suffix、SBOM/CVE、Akka license/Pekko 迁移、配置兼容、数据兼容和回滚命令。
9. 安全与观测默认纳入核心链路：Play 输入校验、反序列化、SSRF、secret/log 泄露、serializer 白名单、依赖仓库投毒、指标/日志/trace/fiber dump 证据。

## 工具链治理

- Metals/BSP：确认 `.bsp/` 来源、sbt/Mill/Scala CLI BSP 差异、IDE compile 与 CI compile 是否一致；IDE 绿不代表 CI 绿。
- Scalafmt/Scalafix：读 `.scalafmt.conf`、`.scalafix.conf`、semanticdb flags；迁移用 scalafix 必须 review rewrite diff。
- Scala Steward/dependency updates：升级 PR 必须带版本矩阵、release notes、eviction、MiMa/codec/downstream 证据；自动合并仅限低风险补丁。
- versionScheme：库发布必须声明并验证 eviction 行为；跨 Scala 2.13/3 不能只靠语义版本口头约定。
- semanticdb：用于引用、重写、代码导航；生成失败时不要基于 IDE 索引做影响面结论。

## 场景执行卡

### 1. Scala 2 / Scala 3 迁移与 cross build

- 输入：scalaVersion、crossScalaVersions、JDK、sbt/Mill、宏/编译器插件、依赖支持矩阵、CI 命令、发布坐标、下游 sample。
- 动作：先列 Scala 2-only 语法、宏、kind-projector、silencer、implicit conversion、existential、eta-expansion、collection 兼容；再做最小模块迁移。
- 迁移路线：盘点阻塞依赖与插件；启用 scalafix/scalafmt；分阶段使用 `-source:future`、`-source:3`、`-rewrite`；拆分宏重写、API facade、跨版本源码；最后 cross build 与下游编译。
- 版本细节：2.12 重点看 Spark/老宏/Java 8；2.13 重点看 collections、并行集合、SAM/eta；3.x 重点看 given/using、export、opaque、enum、derivation、TASTy 与宏生态。
- 宏策略：macro paradise/blackbox 先隔离调用面；能用 inline/quotes/derives/Mirror 替换的分层替换；无法替换时保持 Scala 2 模块或提供 Java/Scala facade。
- 验证：分别跑 Scala 2 与 Scala 3 compile/test/publishLocal；检查 generated sources、TASTy、Java facade、二进制 suffix、pom 依赖和下游解析。
- 停止线：宏、插件或依赖无 Scala 3 版本时，先给替代方案与影响面，不硬改业务代码。

### 2. sbt / Mill / Scala CLI 构建、依赖和发布

- 输入：build.sbt、project/plugins.sbt、build.sc、scala-cli config、settings、resolvers、lockfile、CI 缓存、publish 配置、企业仓库策略。
- 动作：用 dependencyTree/evicted、Mill resolve 或 Scala CLI dependency 证据定位冲突；区分 `%%` 与 `%`、Provided/Test/Runtime、shading、assembly merge strategy、Coursier 缓存污染。
- sbt：检查 sbt 1.10+/early sbt 2 插件二进制、remote cache、thin client、BSP/IDE 差异、`versionScheme`、`crossScalaVersions`。
- sbt 低级错：改 plugin 先看 sbt binary；改 `ThisBuild` 先看 multi-module 继承；改 test 设置先区分 Test/IntegrationTest；改 assembly 先保护 `reference.conf`、service loader、module-info。
- Mill：检查 module graph、BSP、publish target、跨平台 target；不要套 sbt plugin 假设。
- 发布：publishLocal 后检查 pom/ivy 坐标、artifact 内容、source/javadoc jar、license/NOTICE、签名和仓库路径。
- 边界：构建产物、CI、签名、镜像和回滚交给 rls 收口。

### 3. typeclass、implicit、given、macro、TASTy 与类型推断

- 输入：报错全文、import 列表、given/implicit 定义、extension 作用域、derivation/macro 调用点、编译器 flags、semanticdb/TASTy 证据。
- 动作：先缩小到最小表达式；检查优先级、shadowing、ambiguous、summon/implicitly、opaque type companion、export、inline 展开和跨版本 TASTy。
- Scala 3 专项：检查 `given/using`、export、derives、Mirror、match types、transparent inline、opaque type 边界；必要时用编译器解释/调试参数和最小复现定位 implicit search。
- 设计准则：优先让实例靠近类型 companion 或显式 import；避免把低优先级兜底 given 放进通用包对象；新增 typeclass instance 必须说明 orphan、优先级和二义性风险。
- 验证：compile + 目标调用方测试；改 public given/implicit 必须搜全仓库和二进制下游。
- 停止线：不能用更宽泛的 implicit 兜底掩盖类型错误；不能为过编译移除类型约束或绕过领域校验。

### 3.1 case class / ADT / enum 契约变更

- 输入：构造点、copy/伴生 apply、unapply/pattern match、默认参数、JSON/Avro/Proto/DB/Spark Encoder、Java/Kotlin 调用、旧数据样本和发布版本。
- 动作：先判断是内部模型、API DTO、持久化 schema、消息协议还是 Spark/Flink state；不同层不能混为一个“模型改动”。
- case class：新增字段优先兼容读写和默认值；重排、删除、改类型、改默认值必须视为 source/binary/wire/schema 风险。
- sealed ADT/enum：新增分支要查 exhaustive match、codec discriminator、数据库枚举、前端客户端、Java facade；删除/重命名分支必须提供迁移和回滚策略。
- 兼容策略：可双写/双读时先保留旧字段、alias codec、adapter 或 facade；破坏性变更必须绑定版本、迁移、feature flag 和旧数据回放。
- 验证：compile/test 不够；补 pattern match 覆盖、codec roundtrip、旧样本回放、MiMa/TASTy/downstream sample、Spark Encoder 或 schema evolution 测试。
- 停止线：禁止只为让编译通过给字段塞 `Option`/`null`/假默认值；禁止不搜消费方就改 constructor 顺序、sealed hierarchy 或 enum 编码。

### 4. Future / Cats Effect / ZIO / 并发资源

- 输入：runtime、ExecutionContext、dispatcher、blocking 区域、timeout/retry、cancel 语义、资源生命周期、线程池配置、观测入口。
- 动作：区分 Future eager 与 IO/ZIO lazy；阻塞 IO 放专用 blocking pool；跨 runtime 边界集中封装；检查 unsafeRun、fork、race、bracket/Scope、Resource、Layer。
- 运行时决策：Future 适合已有 JVM API 边界但不承诺取消；Cats Effect/ZIO 适合资源、取消、结构化并发；Akka/Pekko Streams 适合背压流；互操作必须集中在边界层。
- ExecutionContext：显式标注 CPU/IO/blocking/dispatcher；检查 MDC/ThreadLocal 传播；禁止在默认全局池跑 JDBC、文件、HTTP 阻塞和大批量 CPU 任务。
- Effect 低级错：`timeout` 不等于资源释放；`retry` 不能包住已启动 Future；`parTraverse` 必须限并发；`Resource/Scope` 必须覆盖失败、取消和超时路径。
- JDK 21/虚拟线程：先确认库是否阻塞友好、ThreadLocal/MDC/dispatcher 是否兼容；虚拟线程不能替代 effect 取消和资源生命周期。
- 验证：单元 + 并发/超时/取消/泄漏场景；必要时跑 stress、test clock、资源释放断言。
- 停止线：不在 request/actor/fiber 热路径里直接 Await/result/sleep；不在全局 EC 上跑阻塞 JDBC/HTTP 文件 IO；不在业务层分散 unsafeRun。

### 4.1 错误处理、恢复与可观测性

- Future：区分 failed future、throw、recover/recoverWith、fallbackTo、transform；retry 包 Future 工厂，不包已启动 Future。
- Cats Effect：错误进入 `IO.raiseError`/`attempt`/`handleErrorWith`，资源用 `Resource`/`bracket`；取消路径必须释放资源，日志不要吞掉 fiber 失败。
- ZIO：错误通道、defect、interruption 分开处理；`catchAll`、`catchSome`、`ensuring`、`Scope`/`Layer` 必须匹配语义，不把 defect 当业务错误。
- Akka/Pekko：区分 actor supervision、stream failure、ask timeout、dead letters；恢复策略必须说明 resume/restart/stop/backoff 对状态的影响。
- Spark/Flink：区分 driver error、executor task failure、shuffle/data skew、state/checkpoint 恢复；不要用 catch-all 跳过坏数据而不记录 dead-letter 或计数。
- 输出：错误模型要包含用户可见错误、日志字段、指标/trace、重试幂等、告警和降级；安全边界内脱敏 stack、token、SQL 和 payload。
- 停止线：禁止 `catch { case _: Throwable => ... }` 静默吞错；禁止把 InterruptedException/cancel 当普通失败；禁止用无限 retry 或 sleep 掩盖背压/资源耗尽。

### 5. Akka / Apache Pekko / Streams / Cluster

- 输入：Akka/Pekko 版本、license 约束、classic/typed、dispatcher、supervision、serialization、remote/cluster/sharding、config。
- 动作：先确认 Akka 商业许可风险或 Pekko 迁移；检查 actor path、ask timeout、backpressure、materializer、serializer binding、split brain、rolling upgrade。
- Streams：检查 source/sink 生命周期、materialized value、buffer/overflowStrategy、mapAsync 并发、ordered/unordered、kill switch、restart/backoff、completion/failure 传播；背压不能靠 sleep 或无限 buffer 伪装。
- 安全基线：remote/cluster serializer 必须显式白名单与绑定；禁用不安全 Java 反序列化；检查 secret/config 日志泄露、management 端口和 ACL。
- 验证：actor/stream 测试、serialization roundtrip、cluster 本地多节点或 staging rolling；记录 dead letters、mailbox、dispatcher 指标。
- 边界：发布、灰度、许可证和镜像交给 rls；Java interop 问题联动 jv。

### 6. Play / HTTP / API 边界

- 输入：routes、Action/Filter、body parser、ExecutionContext、JSON format/codec、错误模型、认证上下文、超时、输入来源。
- 动作：区分 sync/async action；阻塞操作换 dedicated dispatcher；JSON 字段新增/重命名先确认默认值、兼容读、旧客户端、OpenAPI/契约。
- Java 17/21：Play 版本、JDK runtime、Akka/Pekko 底座、依赖强封装和容器 JVM flags 必须进入矩阵。
- 安全：校验 body size、content type、CSRF/CORS、认证授权、多租户隔离、SSRF URL allowlist、反序列化类型边界、secret/token 日志脱敏。
- 验证：route test、错误响应、认证/权限、多租户、超时、body size、旧客户端兼容；API 契约交给 api 收口。
- 停止线：不能只改 case class 字段不改 JSON codec、API 文档、客户端兼容和迁移策略。

### 7. Spark / Flink / 数据工程 Scala 链路

- 输入：Spark/Flink 版本、Scala binary version、JDK、提交命令、集群模式、依赖分发、checkpoint/savepoint、schema、数据样本。
- Spark 精确口径：区分 Core、SQL、DataFrame、Dataset、Structured Streaming、Spark Connect；分别确认 API、encoder、UDF、state、proto 和 server/client 边界。
- Driver/Executor：定位错误发生在 driver 还是 executor；保留 executor stderr、classloader/classpath、广播变量、closure serialization、shuffle、Kryo/Java serializer 证据。
- Scala binary/classpath：Spark 3.5/4.x 必查 Scala suffix、JDK 支持、provided dependencies、assembly/shading、submit `--jars/--packages` 与集群预装冲突。
- Schema/null：显式确认 nullable、case class Option/null、Encoder、Catalyst schema、Parquet/Avro/Delta/Iceberg schema evolution；不能把 Scala 类型非空当作数据源非空。
- Shuffle/性能：先看 physical plan、partition count、skew、broadcast threshold、AQE、cache/persist 生命周期、UDF 黑盒化；性能结论必须有 Spark UI 或 event log 证据。
- Structured Streaming：checkpoint、state schema、watermark、state TTL、trigger、sink exactly-once/at-least-once 语义必须写明；改 state schema 前做旧 checkpoint 恢复演练。
- Spark Connect：区分 client API/proto/server capability；proto/API 兼容不能用普通 Scala compile 代替。
- Flink：区分 JobManager/TaskManager；state serializer、savepoint、watermark、connector 版本和 classloader 是升级主线。
- 表格式：Delta/Iceberg/Hudi 变更检查 catalog、schema evolution、partition、time travel/rollback、并发写、依赖冲突和权限。
- 验证：本地小样本 + 集群 dry run；保留 Spark UI/event log、Flink Web UI、checkpoint/savepoint、失败 task stderr。
- 停止线：不能在闭包里捕获不可序列化连接/Logger/大对象；不能无 savepoint/checkpoint 演练改有状态算子 schema。

### 8. Java/Kotlin interop、serialization、schema 与 binary compatibility

- 输入：Java/Kotlin 调用方、public API、annotations、nullability、SAM、varargs、overload、case class/ADT、codec/schema、MiMa baseline。
- 动作：为 Java/Kotlin 暴露稳定 facade；检查 Option/null、scala.jdk.CollectionConverters、Lombok/records、JPMS、Serializable、Jackson/Circe/Play JSON、Avro/Proto、Spark Encoder。
- 兼容矩阵：同时判断 source、binary、TASTy、Java ABI、wire/schema、配置和数据兼容；case class 默认参数、字段顺序、sealed hierarchy、enum 编码必须列出影响。
- 版本策略：破坏 binary/source/wire 时必须主版本或双发兼容；可兼容读写时保留旧字段/默认值/adapter；MiMa 只覆盖 JVM binary，不替代 schema 与 TASTy 验证。
- 验证：Java/Kotlin 编译测试、codec roundtrip、旧数据回放、MiMa、TASTy/下游 sample project。
- 停止线：public method 签名、case class 参数顺序、sealed hierarchy、enum 编码变化必须先出兼容方案。

### 9. Scala.js / Scala Native

- 输入：target、Scala.js/Native 版本、linker mode、facade、JS bundler、native toolchain、平台库、CI runner。
- 动作：区分 JVM-only API、java.nio/reflect/thread 支持、facade 类型、dead code elimination、module kind、native GC/linker。
- 验证：fastOpt/fullOpt 或 nativeLink；浏览器/Node/目标平台 smoke；检查 bundle size、source map、native crash log。
- 停止线：不能把 JVM 反射、动态 classloading、阻塞线程模型默认带到 JS/Native。

### 10. 测试、性能、安全与发布收口

- 输入：变更风险、原 Bug 复现、基准/指标、CI、发布计划、回滚方案、安全边界。
- 测试矩阵：ScalaTest/MUnit/Weaver 按项目栈选择；ScalaCheck 覆盖代数/序列化性质；discipline law test 覆盖 typeclass；Testcontainers 覆盖外部依赖；effect test clock 覆盖时间与重试；stress 覆盖并发。
- 性能/JVM：性能改动记录 before/after、JFR/GC log、alloc、thread dump、heap/native memory、线程池、dispatcher、Spark/Flink UI 指标；容器内存必须核对 MaxRAMPercentage、direct memory、metaspace、GC 和 OOM killer。
- 安全发布：检查 Play 输入、serializer 白名单、secret/log 扫描、CVE/SBOM/signing/provenance、Akka/Pekko license、依赖仓库与凭据来源。
- 部署：Scala 技能只给 JLink/Jib/Docker JVM flags、JDK 21 容器内存/GC smoke、GraalVM Native Image 可行性证据；发布流水线交给 rls。
- 发布/回滚：记录 artifact 坐标、git sha、配置版本、migration/schema 版本、feature flag、回滚命令和不可回滚点；滚动发布前验证序列化、配置、Akka/Pekko cluster、旧新版本共存。
- 验证：命令输出和关键日志；性能改动保留 before/after 数据；发布改动联动 rls，最终 aud 收口。
- 停止线：无测试或命令失败时只能报未通过；不能把 flaky 当通过；不能把本地 JVM 通过当作容器、集群或发布通过。

### 11. 一次性开发闭环

- 进入：用 manifest/需求/代码证据确认本技能确实是 must；只读学习时只给证据和切换条件。
- 定位：写清 Scala/JDK/构建/框架/运行入口、最小复现、错误堆栈和影响面；修复两次无效后停止复盘。
- 修改：小步改动，先保兼容；跨 API、schema、runtime、发布边界时同步触发相邻技能。
- 验证：至少跑 compile/test 中的最小闭环；涉及并发、stream、Spark、codec、binary 兼容时补专项验证。
- 交付：报告改动文件、版本矩阵、调用方复核、验证结果、未验证项、回滚路径；禁止只说“已修复”。

## 高频坑 / 防遗漏

- 用本地 IDE 绿色代替 CI clean compile，漏掉 semanticdb、插件、BSP、JDK 或缓存差异。
- `%%` 与 `%` 用错导致 Scala binary 版本不匹配，运行期才 ClassNotFound/NoSuchMethod。
- sbt incremental、Coursier 缓存或 remote cache 污染，clean CI 环境复现才暴露。
- 改 `scalaVersion` 忘改 `crossScalaVersions`、CI matrix、Docker/JDK、Spark/Play/Akka 兼容表。
- Scala 3 given 作用域变化导致实例不再命中或命中更宽泛实例。
- opaque type 运行期零成本但编译期边界丢失，JSON/DB/Java facade 未显式 codec。
- Scala 3 inline macro/TASTy 对 patch 版本敏感，下游不同编译器版本才失败。
- 给 public API 加默认参数后以为 binary compatible，实际 Java/Scala 下游或反射调用失败。
- Future 默认 eager，放进 retry/timeout 组合后实际已启动或无法取消。
- Cats Effect/ZIO unsafeRun 分散在业务层，资源泄漏和取消语义不可控。
- Akka/Pekko dispatcher 混用，阻塞 IO 吃光 actor/fiber 线程。
- Akka Streams 用无限 buffer 或 sleep 掩盖背压，生产只会延迟爆内存。
- sbt assembly merge strategy 吞掉 reference.conf，生产 serializer/dispatcher 配置失效。
- 容器内存只看 heap，漏 direct/metaspace/thread stack，JDK 17/21 GC 行为变化后被 OOM killer 杀。
- Spark 闭包捕获 this、连接池或非序列化对象，executor 端失败。
- Spark schema nullable 与 Scala Option/null 认知不一致，UDF/Encoder/Parquet 读写出现脏数据或 NPE。
- Spark shuffle 分区、skew、broadcast 只凭代码猜，未看 plan/UI/event log 就调参。
- Spark Structured Streaming 或 Flink 有状态算子改 schema 未处理 checkpoint/savepoint 兼容，恢复失败或状态错读。
- case class 新增/重排字段只改模型，漏旧 JSON/Avro/DB/Spark Encoder、默认参数和 Java 构造方。
- Play JSON 新增必填字段未兼容旧客户端，OpenAPI 与 codec 脱节。
- Scala.js/Native 引入 JVM-only 依赖，本地 JVM 测试绿但 link 失败。
- JDK 21 强封装、虚拟线程、GC/容器内存差异让本地 JDK 17 结果不可复用。
- 发布跨 Scala 2.13/3 artifact 时 versionScheme/MiMa 缺失，下游 eviction 选择错误版本。

## 搜索与影响面清单

- 构建：`build.sbt`、`project/plugins.sbt`、`build.sc`、`scalaVersion`、`crossScalaVersions`、`ThisBuild`、`%%`、sbt plugin、Mill target、CI matrix、versionScheme、lockfile。
- 语义：public API、case class、sealed、enum、given、implicit、extension、opaque、macro、codec、Encoder、schema、默认参数、Java facade。
- 并发：Await、unsafeRun、blocking、global ExecutionContext、dispatcher、ask、timeout、retry、Resource、Scope、Layer、MDC、ThreadLocal。
- 数据：Spark/Flink closure、checkpoint/savepoint、serializer、Kryo、Encoder、UDF、Dataset、nullable、shuffle、watermark、state TTL、table format、catalog。
- 互操作：Java/Kotlin 调用方、反射、Jackson/Play JSON/Circe、Avro/Proto、DB migration、OpenAPI、配置 key。
- 发布：MiMa、TASTy、artifact suffix、pom 依赖、license、SBOM、签名、provenance、feature flag、回滚。
- 安全：输入校验、反序列化、SSRF、serializer 白名单、secret/log 脱敏、仓库凭据。

## 输出要求

- 必报：Scala/JDK/构建工具/框架版本、入口命令、影响面、验证命令、结果、未验证项。
- 改动后必报：修改文件与行号、调用方/消费方复核、测试/编译输出；未跑写“未跑”并说明阻塞。
- Bug 修复必报：根因、最小复现、错误写法/正确写法、为何覆盖相邻场景。
- 发布或兼容改动必报：binary/source/TASTy/Java ABI/wire/schema compatibility、MiMa 或替代证据、回滚路径。
- 涉 Spark/Flink 必报：driver/executor 或 JM/TM 证据、数据样本、UI/event/checkpoint/savepoint 证据。
- 涉安全必报：输入来源、trust boundary、serializer/codec、secret/log、依赖仓库与凭据证据；安全专项交给 wsec/dso。

## 约束

- 禁止未读 build.sbt/build.sc/CI 就改依赖、Scala 版本、插件或发布坐标。
- 禁止未搜全量引用就改 public API、case class 参数、sealed hierarchy、given/implicit、codec、配置 key。
- 禁止用 Await、Thread.sleep、global EC、unsafeRun 分散调用来“快速修复”并发问题。
- 禁止只在本地 JVM 绿就声称 Scala.js/Native、Spark/Flink 集群、容器或发布通过。
- 禁止只用 MiMa 代表全部兼容；TASTy、Java ABI、wire/schema、source compatibility 需按风险补证据。
- 禁止把 API/DB/发布/测试/安全职责吞掉；Scala 技能只输出 Scala 证据和实现边界，最终按触发链交接。
- 禁止为压过编译器错误添加超宽泛 given/implicit、`.asInstanceOf`、`.get`、`null` 或吞异常兜底。
- 禁止把 Spark/Flink 小样本通过等同于集群通过；必须声明 driver/executor、checkpoint/savepoint、classloader 与数据规模差异。

## 2024-2026 新坑速查

- JDK 21：强封装、虚拟线程、容器内存、GC 默认值影响 Scala 运行；先在目标镜像验证，不用本地 JDK 17 结论替代。
- Scala 3.3/3.4/3.5：given、export、opaque type、derivation、inline macro、TASTy 兼容要用下游 sample 编译验证。
- sbt 1.10+ / early sbt 2：插件二进制、Coursier、remote cache、thin client 行为要在 CI clean 环境确认。
- Mill 0.12/0.13+：BSP、module graph、publish target 和跨平台 target 变化不能套 sbt 经验。
- Akka 2.7+ license 与 Apache Pekko 迁移：包名、配置、serialization、cluster rolling、商业合规必须明确。
- Cats Effect 3 / ZIO 2：structured concurrency、Scope/Resource、blocking、Runtime/Layer 边界是事故高发点。
- Spark 3.5/4.x：Core/SQL/DataFrame/Dataset/Structured Streaming/Spark Connect、Scala binary、JDK、Kryo/Encoder/UDF、ANSI SQL、Python/Scala 混合作业依赖分发要逐项确认。
- Flink 1.19/2.x：Scala API 依赖、状态 schema、checkpoint/savepoint、watermark 和 connector 版本是升级风险点。
- Scala.js 1.16+：ES module、linker、facade、dead code elimination、Node/browser 差异需 fullOptJS smoke。
- Scala Native 0.5+：GC、linker、C interop、平台库和线程限制需目标平台验证。
- Supply chain：Sonatype Central、签名、SBOM、CVE、license、artifact provenance 与组织仓库策略要在发布链确认。

## 反例库：看到就停

- “只是加个字段”：实际是 public case class / API DTO / Spark Encoder / JSON codec；未搜调用方和旧数据就改。
- “MiMa 通过所以兼容”：实际改了 TASTy、source、wire/schema、JSON 字段、enum discriminator 或 Java facade。
- “Future 加 retry 就行”：Future 已 eager 启动，retry 只重复同一个失败结果，资源和取消没有覆盖。
- “Cats/ZIO 都是 IO”：跨 runtime 到处 unsafeRun、丢失 cancel/scope/layer/MDC，最终泄漏线程或连接。
- “Spark 本地样本过了”：executor classpath、closure serialization、checkpoint/state、数据倾斜和集群依赖没有验证。
- “Akka Streams 加 buffer”：无限 buffer 或 sleep 伪装背压，生产延迟和内存一起爆。
- “Scala 3 只是语法升级”：given 搜索、opaque type、derivation、macro/TASTy、enum 编码和下游编译器版本都可能变。
- “sbt 插件升个小版本”：sbt binary、Scala binary、Coursier/remote cache、BSP、CI clean 环境没验证。
- “加 `.get`/`asInstanceOf` 快速过编译”：把类型错误、空值、codec 和兼容问题延后到运行期。
- “性能优化凭经验”：没 JFR/GC/thread dump/plan/event log/基准数据，只是移动瓶颈。

## 与相邻技能的边界

- Java/JVM 开发/java-jvm-development（jv）：Java/JVM、Spring、Maven/Gradle、JPA、virtual threads、GraalVM 细节由 Java/JVM 开发/java-jvm-development（jv） 主导；Scala 开发/scala-development（sca） 只提供 Scala facade、interop、ABI 和调用证据。
- 发布部署/release-engineering（rls）：CI/CD、artifact、签名、SBOM、镜像、灰度、回滚、许可证发布门禁由 发布部署/release-engineering（rls） 主导；Scala 开发/scala-development（sca） 提供 sbt/Mill/cross build/MiMa/JVM flags 证据。
- 测试验证/test-engineering（tst）：测试矩阵、flaky、契约、性能专项由 测试验证/test-engineering（tst） 主导；Scala 开发/scala-development（sca） 提供 ScalaTest/MUnit/Weaver、ScalaCheck、law test、effect/concurrency/codec roundtrip 场景。
- 代码审计/code-audit（aud）：所有代码改动最终由 代码审计/code-audit（aud） 收口；Scala 开发/scala-development（sca） 提供影响面、版本矩阵、调用方和验证证据。
- API 工程/api-engineering（api）：Play/HTTP/DTO/错误模型/认证/版本化由 API 工程/api-engineering（api） 主导；Scala 开发/scala-development（sca） 只处理 Scala 实现、JSON codec 和兼容读写。
- 数据库工程/database-engineering（db）：Schema、迁移、事务、索引由 数据库工程/database-engineering（db） 主导；Scala 开发/scala-development（sca） 只处理 Slick/Doobie/Quill/JDBC 边界、case class 映射和旧数据 roundtrip。
- Web 安全/web-security（wsec）/DevSecOps/devsecops（dso）：OWASP、安全测试、供应链门禁、密钥治理由安全技能主导；Scala 开发/scala-development（sca） 提供 Play、serializer、依赖与构建证据。
- Python 开发/python-development（pyd） / JavaScript/TypeScript 开发/javascript-typescript-development（jsts）：Spark PySpark 混合、Scala.js 前端、Node bundler 或跨语言 SDK 边界由对应技能主导；Scala 开发/scala-development（sca） 提供 Scala artifact、schema 和 target 证据。
