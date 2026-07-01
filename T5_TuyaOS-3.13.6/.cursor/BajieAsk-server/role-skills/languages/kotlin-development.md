---
name: kotlin-development
description: Kotlin 资深开发技能实战排障版。覆盖 Kotlin 1.9/2.x/2.3.x、K2、JVM/Android/Native/JS/Wasm、coroutines/Flow、structured concurrency、Gradle Kotlin DSL、KSP/KAPT、Compose/Android、KMP、Spring/Ktor、serialization、nullability、Java interop、R8/ProGuard、ABI/inline/value class 排障，并强化 K2 迁移、KMP 平台适配、服务端协程上下文、Gradle 8/9、AGP 9、KSP/KAPT、detekt/ktlint、main-safe、repeatOnLifecycle、测试与性能证据。
---

# Kotlin 开发

Kotlin 开发（kotlin-development，兼容 slug: kt）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

> 定位：只负责 Kotlin 语言、编译器、协程/Flow、KMP、Kotlin 构建与 Kotlin 框架适配的实战排障；Android 系统行为、Java/JVM 基建、API/DB/发布/测试/审计按边界联动。
> 铁律：版本、运行时、入口、证据先齐；未复现不改关键链路，未跑 target 不报兼容，未查 ABI/生成源/消费方不改公共契约。

## 快速总则（版本 / 运行时 / 入口 / 证据）

1. 版本先定：Kotlin 1.9/2.0/2.1/2.2/2.3.x、languageVersion、apiVersion、K2 开关、JDK、Gradle、AGP 8/9、Compose Compiler、coroutines、serialization、KSP/KAPT、Ktor、detekt、ktlint、Spring Boot、Native、Xcode/iOS。
2. 运行时先分：JVM、Android、KMP common、Native/iOS、JS/Wasm、CI、本地、Debug/Release、R8/ProGuard、GraalVM、JDK toolchain，不混用结论。
3. 入口先列：用户/API/route、suspend 调用链、CoroutineScope owner、Flow collect 点、Gradle task、KMP source set、Java caller、Swift caller、生成代码、混淆后入口。
4. 证据先拿：完整 stacktrace、编译任务、dependencyInsight、generated sources、bytecode/javap、thread dump、协程 job 树、Flow 事件序列、target build、测试命令和 CI job。
5. 改公共 Kotlin 符号先查 ABI：data class 构造、default args、inline/value class、sealed hierarchy、enum、serializer、expect/actual、@JvmName/@JvmOverloads 都可能破坏调用方。
6. 协程先查 owner 和取消：业务禁 GlobalScope；catch CancellationException 必须重抛；runBlocking 只限 main/test/边界桥接，禁 UI、controller、route、热路径。
7. Flow 先判冷热和背压：状态用 StateFlow，事件用 SharedFlow/Channel；flowOn 只影响上游；callbackFlow 必须 awaitClose；shareIn/stateIn 必须写清 started/replay。
8. KMP 先查 source set：commonMain 禁 java.*、android.*、JVM-only library；平台能力用 expect/actual 或分 source set，all targets build 才能报兼容。
9. 构建先锁矩阵：Gradle Kotlin DSL、pluginManagement、version catalog、compilerOptions、JDK toolchain、KSP/KAPT、Compose Compiler、AGP 必须成套升级/回滚。
10. 安全与发布只讲 Kotlin 特有风险：nullability、反射序列化、协程泄漏、Java/Swift interop、Native 二进制、R8 keep、ABI、inline 变更、配置泄露。
11. 升级先拆阶段：先锁 toolchain/Gradle/AGP/Compose/KSP，再分模块打开 languageVersion/apiVersion/K2，再比对生成源、二进制兼容、IDE/CI 差异。
12. 服务端 Kotlin 先查上下文传播：事务、MDC、SecurityContext、ThreadLocal、阻塞 JDBC/HTTP、WebFlux/Servlet 或 Ktor pipeline，不能只看 suspend 编译通过。
13. 服务端契约先分层：Request DTO、Patch DTO、Response DTO、Entity/Record、Domain model 不互绑；controller/route 禁直接接收或返回 JPA Entity、Exposed Row、jOOQ Record。
14. 部分更新先定三态：absent 表示不改，explicit null 只在字段允许清空时生效，default value 不等同客户端传值；Kotlin PATCH 用 OptionalProperty、field mask 或等价 sealed wrapper 表达。

## 单技能开发闭环门禁

- 开发前先列 Kotlin 落地点：入口 route/controller/command、Request/Patch/Response DTO、Domain、Entity/Record、serializer、repository、transaction、dispatcher、test target、Release/R8 或 KMP target。
- 写功能时必须同步处理正常、空值、字段缺失、显式 null、权限失败、校验失败、并发冲突、取消、超时、下游异常、旧客户端和回滚路径；只写 happy path 不算完成。
- Kotlin 类型不能替代业务契约：non-null 只代表本进程内约束，外部 JSON、DB、Java platform type、Swift/JS 调用方都要有运行样本或边界校验。
- DTO 到 Domain 到 Entity/Record 必须显式映射；默认参数只允许表达 create/full replace 的默认值，禁止把默认参数当 PATCH 未传字段。
- 错误映射必须稳定：Ktor StatusPages、Spring ControllerAdvice/Problem Details、Result/exception 边界要统一 code/status/body/log level，不能让异常类型随机暴露到公网。
- 所有 suspend/Flow 写法必须有 owner、取消传播、超时、dispatcher、资源释放和测试证据；没有 owner 的后台任务必须上升到应用级生命周期和关闭钩子。
- 交付前必须给出最小验收证据：编译或 target build、关键测试、JSON absent/null/default 样本、错误响应样本、并发或取消样本、Release/R8 或 all targets 中与本次改动相关的证据。

## 硬禁止与低级错拦截

- 禁止用 `!!`、`lateinit`、空 catch、`TODO()`、宽泛 `Any`、裸 Map JSON、反射复制对象来掩盖契约不清；必须改成显式校验、显式模型或明确失败。
- 禁止 `GlobalScope`、无 owner 的 `CoroutineScope()`、生产入口 `runBlocking`、吞 `CancellationException`、catch Throwable 后继续写库或继续发外部请求。
- 禁止在 Ktor/Spring handler 内直接阻塞 JDBC/HTTP/文件 IO 而不隔离 dispatcher/连接池；禁止把 suspend 包一层就宣称非阻塞。
- 禁止 nullable data class、默认值 data class 或 Entity 原样接 PATCH；必须使用 OptionalProperty、field mask、sealed wrapper 或项目等价三态结构。
- 禁止 Entity/DAO/jOOQ Record 暴露公网或直接绑定请求体；禁止客户端可写 id、tenantId、ownerId、role、status、version、deletedAt、createdAt。
- 禁止配置和 secret 散落：token、密码、DSN、private key、用户隐私、Authorization、Cookie、Set-Cookie 不得进入日志、异常、测试快照和默认配置。
- 禁止只测 JVM 或 H5/Debug 后宣称 KMP/Native/iOS/JS/Wasm/Release 兼容；每个被影响 target 必须有 build/run/test 或明确未验证。

## 2026 版本矩阵（P0）

- Kotlin 2.3.x：升级时记录 Kotlin 编译器、languageVersion/apiVersion、K2、JDK toolchain 与 IDE/CI 差异。
- Ktor：Kotlin 2.3.21 / coroutines 1.10.2 / serialization 1.9.0；服务端升级同时验证 pipeline、JSON、错误映射、MDC/SecurityContext 和阻塞隔离。
- 静态检查：detekt Kotlin 2.3.21 / ktlint 1.8.0 / AGP 9.2.1；K2 下先确认插件与规则集兼容，再跑生成源和 lint 任务。
- Android 样板：Now in Android Kotlin 2.3.0 / KSP 2.3.4 / Lifecycle 2.10.0；迁移需验证 kapt/ksp 生成源、repeatOnLifecycle、viewModelScope 与 Release/R8。
- Gradle：7.6.3–9.0.0；AGP：8.2.2–8.13.0；跨区间升级必须分阶段锁版本、保留回滚点并验证 configuration cache / isolated projects。


## 场景执行卡

### 1. Kotlin/JVM 类型、ABI 与 Java interop

- 适用：nullability、platform type、sealed/data/enum、inline/value class、泛型、默认参数、扩展函数、反射、bytecode、Java 调用异常。
- 动作：Java platform type 默认按 nullable；改 data class 主构造等同改 ABI；sealed 新子类全搜 when；value class 查装箱、泛型、nullable、反射、序列化和 Java 边界；公共 API 明确 @JvmName/@JvmOverloads/@JvmStatic/@Throws。
- nullability 补强：JSpecify、JSR-305、Spring @NonNullApi、Jackson Kotlin module 的默认参数与 nullable 组合必须按编译配置和运行样本验证；配置变化可让 warning/strict/ignore 语义漂移。
- 证据：Kotlin/JDK/JVM target、Java caller 编译、序列化样本、when 覆盖、javap/反射证据、旧二进制或 SDK 兼容验证。

### 2. K2 / compiler plugin / 语言版本升级

- 适用：Kotlin 2.x、K2、languageVersion、apiVersion、Compose Compiler、KSP2、KAPT、detekt/ktlint、all-open/no-arg、Spring plugin。
- 动作：先查插件矩阵；K2 下优先 KSP 兼容版本，KAPT 只在处理器不支持 KSP 时保留；compilerOptions 替换旧 kotlinOptions；生成源失败先查 task 输出和版本，不先改业务。
- 迁移顺序：冻结当前构建与回滚点；锁 JDK toolchain、Gradle、AGP、Compose Compiler、KSP/KAPT、serialization、coroutines；先单模块试开 languageVersion/apiVersion/K2，再扩到依赖模块；最后验证 IDE/CI 一致。
- 验收证据：编译任务、generated source diff、binary compatibility 检查、Java/Swift 调用方、detekt/ktlint、annotation processor 日志、configuration cache、回滚版本。

### 2.1 AGP 9 / Kotlin 2.3+ 迁移专项卡

- 适用：Kotlin 2.3+、AGP 9、K2、KSP/KAPT、detekt/ktlint、KMP Android target、Apple target、Lifecycle/Flow 生命周期收集。
- 版本动作：languageVersion 1.8 退场，先定位仍强制 1.8 的 convention plugin、buildSrc、freeCompilerArgs 和子模块覆盖；升级 Kotlin/AGP/Gradle/KSP/serialization/coroutines/detekt/ktlint 时按矩阵成套提交。
- KMP 动作：Android target 迁移到新 DSL/target 口径，Apple target 提升最低版本时列 iOS/macOS/tvOS/watchOS 影响；commonMain 禁平台 API，all targets build 后再报兼容。
- 协程/UI 动作：生产代码保持 main-safe，Dispatcher 通过注入或上下文边界提供，业务禁 GlobalScope；Android Flow 收集使用 repeatOnLifecycle 或 collectAsStateWithLifecycle 并验证取消/重订阅。
- 验收证据：languageVersion/apiVersion task 输出、AGP/Kotlin/KSP 版本、generated source diff、Android Debug/Release、KMP all targets、detekt/ktlint、repeatOnLifecycle 取消重订阅测试、回滚点。


### 3. coroutines / suspend / structured concurrency

- 适用：超时失效、任务泄漏、线程池阻塞、异常传播、取消未释放、并发限流。
- 动作：用 coroutineScope 管同生共死，supervisorScope 隔离子失败；CPU 用 Default，阻塞 IO 用 IO 或 limitedParallelism；withContext 只切边界；suspend API 不吞异常；跨 Java/回调桥接要传播取消。
- 结构化门禁：并发子任务必须说明失败策略、取消策略、超时策略和资源释放；fire-and-forget 只能放在有 owner 的 application scope，且要有 shutdown 和失败日志。
- 测试口径：runTest 要说明虚拟时间推进；区分 StandardTestDispatcher 与 UnconfinedTestDispatcher；替换 Dispatchers.Main 必须恢复；超时、取消和资源释放要有断言。
- 证据：runTest、父取消子取消、子失败传播、超时释放、线程 dump、资源 close、压力下线程数和队列。

### 4. Flow / StateFlow / SharedFlow / Channel

- 适用：事件丢失、重复 collect、背压、UI 状态、数据库流、SSE/WebSocket、callback API、hot stream 取消。
- 动作：cold flow 多 collect 会重启；stateIn/shareIn 写清 scope、started、replay；catch 只捕上游；buffer/conflate/debounce 需说明丢弃语义；callbackFlow awaitClose 注销监听；Channel 不当状态容器。
- 测试口径：Turbine/runTest 断言顺序、背压、取消和重复 collect；hot stream 必须验证订阅取消后 upstream/监听器释放，避免测试只消费首个值假绿。
- 证据：Turbine/runTest 顺序断言、取消断言、背压断言、重复 collect 证据、Android collectAsStateWithLifecycle 或 repeatOnLifecycle 证据。

### 5. Android / Compose 的 Kotlin 语言层

- 适用：ViewModel、viewModelScope、Compose state、LaunchedEffect、collectAsState、Hilt/Koin Kotlin 注入、Compose Multiplatform 共享 UI。
- 动作：ViewModel 暴露只读 StateFlow；事件不要塞 StateFlow；Effect key 稳定；remember 不包可变外部对象；KMP shared 层不依赖 Android DI；Compose Compiler 与 Kotlin 版本成套。
- 证据：旋转、后台恢复、重组计数、target 编译、Release/R8 关键链路。
- 边界：Activity/Fragment/Service/Manifest/权限/厂商 ROM/系统 API 归 andr。

### 6. 服务端 Kotlin：Ktor / Spring / 协程上下文

- 适用：Ktor route、Spring controller/service、suspend controller、事务、JSON、错误映射、线程池混用、MDC/SecurityContext/ThreadLocal 丢失、WebFlux/Servlet 差异。
- 动作：Ktor 用 ContentNegotiation、StatusPages、Authentication 收口并确认 pipeline 顺序；Spring suspend controller 不用 runBlocking；事务与协程上下文匹配；Jackson module kotlin 与 kotlinx.serialization 不混写同一 DTO 契约；响应契约联动 api。
- 契约分层：Ktor/Spring 入参 DTO、PATCH DTO、Response DTO、Entity/Domain 必须分离；禁止用 Entity 作为公网 JSON 契约；错误映射用 StatusPages、ControllerAdvice 或 Problem Details 收口，字段校验、业务错误、权限错误、乐观锁冲突要有稳定 code/status/body。
- Result/exception：领域失败用稳定业务错误或 Result 边界，系统异常保留 cause 和 traceId；禁止把 `Result.failure` 当 HTTP 200，禁止 `getOrNull()` 后静默降级，禁止公开 stacktrace。
- 编辑/删除：PUT 是完整替换，PATCH 是部分更新，DELETE 默认幂等但必须说明软删/硬删；编辑删除接口必须有鉴权主体、资源归属、版本条件或状态条件，不能只靠 id 直接写。
- 上下文补强：@Transactional、SecurityContext、MDC、request id、tenant id、ThreadLocal 在协程切换后必须有传播方案；阻塞 JDBC/HTTP 隔离到专用 dispatcher/连接池并压测；WebFlux 与 Servlet 运行模型分开验证。
- 证据：MockK/集成测试、并发请求、事务提交/回滚、错误响应样本、traceId/主体一致性、线程池与阻塞证据、压力下吞吐和队列。
- 边界：服务分层、配置、部署、观测、容量归 be/jv。

### 7. Kotlin Multiplatform / Native / iOS / JS/Wasm

- 适用：commonMain 编译失败、expect/actual、iOS framework、Swift interop、Native crash、Compose Multiplatform、JS/Wasm target。
- 动作：commonMain 只依赖 multiplatform API；平台 IO/crypto/time/UUID/locale/Decimal/BigDecimal/file/network 用 expect/actual 或 multiplatform library；iOS 暴露 API 避免复杂泛型、异常和不清晰 nullability；Native 新内存模型仍要验证线程边界、C interop、二进制体积。
- 平台模板：同一 common API 必须列 Android/JVM、iOS/Native、JS browser、Node、WasmJs/WasmWasi 的可用性、精度、时区/locale、异常、资源释放和降级策略。
- Native/C interop：cinterop def、稳定 ABI、内存所有权、pin/free、回调生命周期、ObjC/Swift NSError/exception 映射必须有符号化或崩溃证据。
- JS/Wasm：确认 npm 依赖、ESM/CJS、DOM/Node API、source map、wasmJs/wasmWasi、bundle 运行环境，不把浏览器结论套到 Node 或 Wasm。
- 证据：all target build、commonTest、iOS framework/SPM/CocoaPods 集成、Swift 调用样本、Native crash symbols、JS/Wasm bundle 运行。
- 边界：SwiftUI/UIKit、签名、entitlements、上架归 appl。

### 8. Gradle Kotlin DSL / KSP / KAPT / 构建

- 适用：build.gradle.kts、settings.gradle.kts、libs.versions.toml、compilerOptions、version catalog、annotation processing、Compose Compiler、CI 缓存、Gradle 8/9、convention plugin、buildSrc/included build。
- 动作：版本集中到 catalog；pluginManagement 锁插件；toolchain 固定；KSP/KAPT 按 Kotlin 矩阵升级；生成源纳入 source set；Release/R8/GraalVM 反射和 serializer keep 单独验证。
- 排障路径：先看 settings/pluginManagement/version catalog，再看 convention plugin、buildSrc 或 included build 注入的 compilerOptions，最后查子模块重复配置、configuration cache、isolated projects 和 CI 缓存差异。
- 证据：gradle build/test、dependencyInsight、generated source、configuration cache、local/CI JDK 一致、Release 构建和运行。

### 9. serialization / JSON / 兼容与安全

- 适用：kotlinx.serialization、Jackson Kotlin module、多态、默认值、字段改名、枚举新增、敏感数据。
- 动作：@Serializable 与 @SerialName 稳定；新增字段给默认值或 nullable；sealed 多态 discriminator 固定；unknown keys 和枚举新增按旧端策略验证；敏感 token 不进日志；反射依赖在 R8/Native/GraalVM 下单独测。
- nullability 组合：Jackson/Kotlin 默认参数、缺字段、显式 null、非空字段、@JsonSetter 或 coercion 策略必须用样本覆盖，不能只看编译。
- absent/default/null：Jackson Kotlin module、kotlinx.serialization 对“字段缺失、字段显式 null、Kotlin 默认参数、nullable/non-null、NullIsSameAsDefault、coerceInputValues、explicitNulls”的组合必须逐项样本验证；PATCH DTO 禁靠 data class 默认值推断用户意图。
- 证据：新旧 JSON 双向样本、错误码、旧客户端、混淆后运行、API/DB 影响联动。

### 9.1 配置 / secret / 日志门禁

- 适用：application.conf/yaml、Spring properties、Ktor config、Gradle properties、env、feature flag、日志、异常、测试 snapshot。
- 动作：配置读取要有 schema/default/required 校验；secret 只能从受控环境或密钥管理进入运行时；日志字段白名单化，Authorization、Cookie、token、password、private key、PII 默认脱敏。
- 运行差异：本地、CI、staging、prod、KMP target、Docker、native image 的配置来源要分开说明；Debug 默认值不得悄悄进入 Release。
- 证据：缺配置启动失败样本、脱敏日志样本、错误响应无 secret、测试 fixture 无真实凭据、Release/native image 配置读取样本。

### 9.2 服务端持久化：JPA / Exposed / jOOQ 写入门禁

- 适用：Spring Data/JPA/Hibernate、Exposed DAO/DSL、jOOQ Record/DSLContext、Ktor/Spring 服务端写接口、编辑、删除、PATCH、软删、乐观锁。
- 动作：写入字段必须白名单映射 DTO -> command -> Entity/Record，禁止反射/BeanUtils/自动 merge 整对象覆盖；id、ownerId、tenantId、createdAt、deletedAt、version、role/status 等敏感字段只能服务端生成或按显式规则变更。
- PATCH 三态：OptionalProperty、field mask 或 sealed wrapper 必须区分 absent、set null、set value；只更新 mask/Present 字段，nullable 清空要业务允许，默认值只用于 create 或 full replace，不用于 partial update。
- JPA：merge/save 前查 owner/tenant/status/version；@Version 或显式 version 条件处理乐观锁；bulk update/delete 要避开一级缓存假象并校验 affected rows；软删用 deletedAt/deletedBy/status 条件过滤，唯一约束和查询 scope 要同步。
- Exposed：update/delete 必须带 where、tenant/owner/status 条件和字段白名单；检查返回 affected rows；事务内避免吞协程取消，阻塞 JDBC 放到受控 dispatcher/连接池。
- jOOQ：只 set 白名单字段，不把客户端 Record 原样 store；update/delete 绑定 where、version、tenant/owner 条件；execute 后校验 affected rows，0 行映射 404/409，>1 行按风险处理。
- 证据：生成 SQL 或日志、事务提交/回滚样本、并发版本冲突测试、软删后查询不可见且审计字段存在、affected rows 断言、错误映射样本。

### 10. Kotlin 性能 / 分配 / 体积

- 适用：inline/value class 优化、Sequence vs Collection、Flow 链路分配、serialization 反射/生成式性能、Native/iOS framework 体积、协程调度开销。
- 动作：性能结论必须有 benchmark 或 profiler；value class 查泛型、nullable、接口、反射边界装箱；Sequence 不默认快于 List；Flow 长链路查分配、context 切换和 buffer；Native 体积查导出符号和依赖。
- 证据：benchmark 结果、allocation profiler、bytecode/IR/javap、Release 构建、Native framework size、回归阈值和对照组。
- 边界：系统容量、缓存、慢 SQL、JVM GC/JFR 深挖联动 pfe/jv。

## 高频坑 / 防遗漏

### 高频坑

1. CancellationException 被 catch(Exception) 吞掉。
2. GlobalScope 或裸 CoroutineScope 逃逸生命周期。
3. runBlocking 放在 UI、controller、Ktor/Spring route。
4. StateFlow 发一次性事件，同值事件丢失。
5. flowOn 写错位置，以为切了 collect 线程。
6. callbackFlow 忘 awaitClose，监听器泄漏。
7. data class 主构造或可变字段破坏 ABI、equals、hashCode。
8. sealed 新增子类，statement when 没有穷尽失败。
9. Java platform type 当非空导致线上 NPE。
10. inline/value class 跨泛型、nullable、Java/反射边界装箱或破 ABI。
11. KMP commonMain 引 JVM/Android API，iOS/Native 才炸。
12. K2/KSP/KAPT/Compose Compiler 版本错位，生成代码消失。
13. compilerOptions、toolchain、JAVA_HOME、CI 镜像不一致。
14. kotlinx.serialization 与 Jackson 注解混用，字段名/默认值漂移。
15. Native/iOS framework 暴露复杂泛型、异常、nullable 语义，Swift 侧崩。
16. R8/ProGuard/GraalVM 反射或 serializer keep 缺失，Release 才炸。
17. suspend 跨 Java/CompletableFuture/回调桥接丢取消和异常。
18. Ktor/Spring 阻塞 JDBC/HTTP 在协程入口里无隔离，吞吐假异步。
19. Spring suspend 事务、MDC、SecurityContext 在协程切换后丢上下文。
20. runTest 未推进虚拟时间或 dispatcher 选择不当，测试假绿或 CI 挂死。
21. Kotlin/JS ESM/CJS、DOM/Node、WasmJs/WasmWasi 被错误消费。
22. Native C interop 内存所有权不清导致 crash 或泄漏。
23. DTO/Entity/Response 混用，导致公网 JSON 泄露内部字段或写入覆盖服务端字段。
24. PATCH 用 nullable/default data class 表示，无法区分字段缺失、显式 null 和默认值。
25. JPA merge、Exposed update、jOOQ store 未做字段白名单，客户端可改 ownerId、tenantId、role、deletedAt、version。
26. update/delete 不检查 affected rows，0 行被当成功，或缺 where/租户条件误改多行。
27. 软删只写 deletedAt 但查询、唯一约束、恢复、审计和权限判断未同步。
28. 协程取消被事务层 catch 后吞掉，导致请求取消后仍继续写库。
29. Result 被当成万能错误处理，失败被 getOrNull 静默吞掉。
30. 默认参数覆盖用户数据，PATCH 未传字段被写成空串、false 或 0。
31. Ktor/Spring 错误映射漂移，同一业务错误有时 400、有时 500、有时 HTTP 200。
32. Dispatcher 写死，测试无法替换，runTest 假绿，生产线程池被阻塞。
33. secret 打进 logger、异常 message、测试 snapshot 或 CI artifact。
34. KMP 只跑 JVM commonTest，就宣称 iOS/JS/Wasm 可用。

### 防遗漏清单

- 版本：Kotlin/K2、JDK、Gradle、AGP、Compose Compiler、coroutines、Ktor/Spring、KSP、serialization 已记录。
- 平台：JVM、Android、KMP、Native、iOS、JS/Wasm、CI、Release/R8 已分开验证。
- 入口：API、UI、Flow collect、suspend 链、Gradle task、source set、Java/Swift caller、generated code 已列。
- 协程：scope owner、取消、异常传播、Dispatcher、阻塞、limitedParallelism、资源释放已查。
- Flow：冷热、状态/事件、replay/buffer、flowOn、awaitClose、生命周期、hot stream 取消已查。
- 类型/ABI：nullability、JSpecify/JSR-305、sealed when、data class、enum、inline/value class、默认参数、@Jvm* 已查。
- 构建：version catalog、pluginManagement、compilerOptions、convention plugin、toolchain、KSP/KAPT、Compose Compiler、configuration cache 已查。
- 兼容：serialization 默认值、字段名、多态、旧客户端、API/DB/Swift/Java 消费方已查。
- 服务端：事务、MDC、SecurityContext、ThreadLocal、阻塞隔离、WebFlux/Servlet、Ktor pipeline 已查。
- 契约：DTO/Entity/Response 分离、错误映射、PUT/PATCH/DELETE 语义、OptionalProperty 或 field mask 三态、Jackson/kotlinx absent/default/null 样本已查。
- 写库：JPA/Exposed/jOOQ 白名单、tenant/owner/version 条件、affected rows、乐观锁、软删 scope、事务取消传播已查。
- 错误：Result/exception 边界、CancellationException 重抛、业务 code/status/body、日志级别、traceId 已查。
- 配置：schema、required/default、secret 来源、日志脱敏、Debug/Release 差异、CI artifact 泄露已查。
- 发布：Release/R8、Native/iOS framework、GraalVM、回滚、监控中 Kotlin 相关风险已列。

## 输出要求

Kotlin 任务输出至少包含：

1. 场景卡：命中语言/ABI、K2、协程、Flow、Android/Compose、Ktor/Spring、KMP、Gradle、serialization、性能哪些卡。
2. 版本与运行时：Kotlin、languageVersion/apiVersion、JDK、Gradle、target、Debug/Release、CI/本地差异。
3. 入口与复现：入口路径、输入、步骤、原失败证据；无法复现标证据缺口。
4. 影响面：调用方、消费方、source set、generated code、Java/Swift interop、API/DB/发布边界。
5. 风险点：取消泄漏、线程阻塞、上下文传播、nullability、ABI、序列化兼容、构建错位、Native/iOS、JS/Wasm、R8/ProGuard、回滚。
6. 验证路径：编译/test/task/target build、Flow/coroutine 测试、Java caller、Swift/iOS、JS/Wasm、Release 混淆、旧样本兼容、性能基准。
7. 联动技能：说明 andr、jv、be、api、tst、aud 等为何需要，且必须真实读取。
8. 结论：已验证、部分验证、无法验证；每项绑定命令或证据。
9. API 契约：DTO/Entity/Response 是否分离，Jackson/kotlinx absent/default/null 样本，PATCH 三态表达方式，错误映射 code/status/body。
10. DB 写入：JPA/Exposed/jOOQ 字段白名单、where 条件、affected rows、乐观锁、软删、事务取消传播和并发冲突证据。
11. 低级错拦截：说明是否出现 `!!`、GlobalScope、runBlocking、吞取消、Entity 暴露、nullable PATCH、secret 日志、只测 Debug/JVM 等风险。

## 约束

- 不重复全局触发规则；只给 Kotlin 执行口径。
- 未读版本、未复现、未跑命令，不得宣称已修复、已兼容、可上线。
- 不用 GlobalScope 处理业务；不吞 CancellationException；不在生产入口 runBlocking。
- 不滥用 !!；Java platform type 默认按 nullable 处理；JSpecify/JSR-305/Spring nullability 配置不明时先查配置。
- 不在 KMP commonMain 使用平台专属 API；必须 expect/actual 或分 source set，并跑相关 target。
- 不散落 Gradle 版本；优先 version catalog、plugin DSL、convention plugin、JDK toolchain。
- 不把 KSP/KAPT 生成源当黑盒；生成失败要查 task、版本矩阵和生成目录。
- 不把测试通过包装成发布通过；Release、R8、Native、iOS、JS/Wasm、回滚需单独证据。
- 不把性能优化当猜测；inline/value class、Sequence、Flow、serialization、Native 体积必须有对照证据。
- 不用 Entity/Record 充当公网 DTO/Response；不让客户端字段直接覆盖 Entity/Record；不把 nullable/default data class 当 PATCH 三态。
- 不执行无 where、无 tenant/owner/status/version 条件、无 affected rows 校验的更新/删除；软删必须同步查询 scope、审计字段和恢复策略。
- 不吞协程取消后继续写库；catch Throwable/Exception 包事务时必须先重抛 CancellationException，再做业务错误映射。
- 不把 Result/nullable/default 当错误处理；失败必须有稳定语义、日志和调用方可判断的输出。
- 不在日志、异常、配置、测试 fixture、构建产物中写入 secret 或用户隐私；脱敏和缺配置失败必须可验证。
- 涉 API 契约联动 api；涉服务端运行联动 be/jv；涉 Android 系统行为联动 andr；涉验证联动 tst；完成前 aud 收口。

## 高频 Bug 反例库

- 反例 1：吞掉 CancellationException。错法：catch Exception 后返回默认值，withTimeout 取消信号被吃掉；对法：先 catch CancellationException 并 throw，再处理业务异常；根因：取消是协程控制流，不是普通失败。
- 反例 2：GlobalScope 逃逸生命周期。错法：ViewModel 或 Ktor route 中 GlobalScope.launch 写库；对法：用 viewModelScope、request scope、coroutineScope 或有 owner 的 application scope；根因：无 owner 的协程无法跟入口结束同步取消。
- 反例 3：runBlocking 阻塞生产线程。错法：Spring/Ktor handler 为调用 suspend service 包 runBlocking；对法：入口改 suspend，或在边界异步桥接并限制线程池；根因：runBlocking 会占住当前线程，压垮 server 或 UI。
- 反例 4：StateFlow 发 Toast 事件。错法：MutableStateFlow(Event.Toast("x")) 连发同值，第二次不触发；对法：事件用 SharedFlow/Channel，状态才用 StateFlow；根因：StateFlow 表达当前状态并合并相同值。
- 反例 5：callbackFlow 不释放监听器。错法：注册 callback 后没有 awaitClose 注销；对法：awaitClose 中 unregister，测试 collect 取消后资源释放；根因：桥接回调 API 时取消不会自动清外部监听器。
- 反例 6：flowOn 误解下游线程。错法：在链尾写 flowOn(IO)，以为 collect 在 IO；对法：flowOn 只管上游，下游用 withContext 或调整 collect scope；根因：Flow 上下文保存规则常被误读。
- 反例 7：data class 破 ABI。错法：公共 data class 主构造加字段，旧 Java/Kotlin 二进制调用方运行时报错；对法：评估二进制兼容，提供过渡构造/工厂或升版本；根因：主构造、componentN、copy、默认参数都会进入调用契约。
- 反例 8：sealed when 漏新分支。错法：新增 sealed 子类，旧 statement when 没 else 也没编译失败；对法：用表达式 when 或全量搜索并补分支测试；根因：不是所有 when 用法都会强制穷尽。
- 反例 9：Java platform type 当非空。错法：Java SDK 返回 String!，Kotlin 直接 length，线上 NPE；对法：按 String? 处理，requireNotNull 要带业务错误；根因：Java interop 没有 nullability 保证。
- 反例 10：KMP commonMain 用 java.util。错法：commonMain import java.util.UUID 或 java.time/BigDecimal；对法：用 multiplatform 库或 expect/actual，并验证 Android/iOS/JS/Wasm；根因：commonMain 只能依赖跨平台 API，平台精度和语义也可能不同。
- 反例 11：KSP 与 K2 版本错位。错法：Kotlin 升 2.x 后 KSP/处理器没升，生成类消失；对法：按 Kotlin-KSP 矩阵同步升级，检查 generated source 和 task 输出；根因：编译器插件强依赖 Kotlin 编译器版本。
- 反例 12：serialization 默认值破坏兼容。错法：新增非空无默认字段，旧 JSON 反序列化失败；对法：新增字段给默认值或 nullable，保留 SerialName 并补旧样本测试；根因：数据契约演进必须兼容旧生产者/消费者。
- 反例 13：value class 假性能优化。错法：把 ID 包成 value class 后跨泛型、nullable、反射边界仍大量装箱；对法：用基准和 bytecode 证据确认收益，公共 ABI 谨慎发布；根因：value class 只在特定边界避免分配，不是全局零成本。
- 反例 14：R8 混淆 serializer 崩溃。错法：Debug JSON 正常，Release 找不到 serializer 或反射字段；对法：验证 Release 包，补 serialization/reflect keep 或避免反射；根因：编译期生成与运行时反射在混淆后行为不同。
- 反例 15：Spring suspend 事务上下文丢失。错法：@Transactional suspend 内切 dispatcher 后仍假设同一事务；对法：验证事务提交/回滚与上下文传播，必要时调整边界或隔离阻塞调用；根因：事务常依赖 ThreadLocal，协程切换会改变执行线程。
- 反例 16：MDC/SecurityContext 不随协程传播。错法：日志 traceId 或鉴权主体只在入口线程存在；对法：显式安装上下文传播并用并发请求验证；根因：ThreadLocal 默认不等于 coroutine context。
- 反例 17：JSpecify/JSR-305 配置漂移。错法：升级依赖或编译参数后 nullable 从 warning 变 strict；对法：锁编译配置并补 Java/Kotlin 调用样本；根因：nullability 注解解释依赖编译配置和库元数据。
- 反例 18：Gradle convention plugin 覆盖子模块。错法：buildSrc/included build 与子模块重复写 compilerOptions，CI 与本地参数不同；对法：集中到 convention plugin/catalog 并输出 task 配置证据；根因：Kotlin DSL 配置时机和覆盖顺序不直观。
- 反例 19：runTest 虚拟时间假绿。错法：没有推进 scheduler 或错误使用 UnconfinedTestDispatcher，延迟任务未真正执行；对法：明确 Standard/Unconfined 选择，推进虚拟时间并断言取消；根因：测试调度器不等同真实时间。
- 反例 20：Kotlin/JS ESM/CJS 消费错误。错法：Node 用 CJS 消费 ESM bundle 或浏览器代码引用 Node API；对法：按目标环境分别构建运行并检查 source map；根因：JS/Wasm target 与运行环境不是一回事。
- 反例 21：Native C interop 内存所有权不清。错法：C 指针跨回调生命周期后继续用或忘 free；对法：明确 owner、pin/free、回调注销并符号化 crash；根因：Kotlin/Native 不替 C API 自动管理所有权。
- 反例 22：PATCH 三态丢失。错法：用 nullable data class 默认值接 PATCH，字段缺失被当成清空或默认覆盖；对法：用 OptionalProperty、field mask 或 sealed wrapper，只更新 Present/mask 字段；根因：JSON absent、explicit null、Kotlin default 是三种不同契约。
- 反例 23：Entity 直接暴露。错法：Ktor/Spring controller 直接接收并返回 JPA Entity、Exposed DAO 或 jOOQ Record；对法：Request DTO、Patch DTO、Response DTO、Entity/Domain 分离并显式映射；根因：持久化模型含内部字段、懒加载、循环引用和写入面。
- 反例 24：无保护写库。错法：BeanUtils/merge/store 把客户端对象整包写回，update/delete 不查 affected rows；对法：白名单 set 字段，where 带 tenant/owner/version/status，校验 affected rows 并映射 404/409；根因：ORM/DSL 只保证执行 SQL，不保证业务授权和并发语义。
- 反例 25：软删半套。错法：DELETE 只写 deletedAt，列表详情仍能查到或唯一约束阻塞重建；对法：统一 query scope、审计字段、恢复策略、唯一约束和权限判断；根因：软删是业务状态，不是单字段技巧。
- 反例 26：Result 静默吞错。错法：service 返回 Result 后 controller 用 getOrNull 给空响应；对法：在边界统一映射业务错误、系统异常和 traceId；根因：Result 只是载体，不是错误契约。
- 反例 27：默认参数污染 PATCH。错法：PatchUser(name: String = "", enabled: Boolean = false) 导致未传字段被覆盖；对法：三态字段或 field mask，只处理 Present 字段；根因：Kotlin 默认值无法表达 JSON absent。
- 反例 28：错误响应随机。错法：Ktor 抛 IllegalArgumentException 是 500，Spring Validation 是 400，自定义错误又是 200；对法：StatusPages/ControllerAdvice 统一 code/status/body；根因：异常类型不是稳定 API 契约。
- 反例 29：Dispatcher 写死。错法：repository 内直接 Dispatchers.IO，测试无法控制，生产连接池被压满；对法：注入 dispatcher 或封装执行边界，并用 runTest/压力证据验证；根因：调度策略是运行时资源，不是业务常量。
- 反例 30：secret 泄露。错法：登录失败把 Authorization、Cookie 或 DSN 打进 logger 和 CI artifact；对法：日志字段白名单、脱敏、测试快照扫描；根因：Kotlin data class/toString 和异常 message 很容易带出敏感字段。
- 反例 31：KMP 假兼容。错法：commonMain 新增 Decimal/UUID/time API 后只跑 JVM test；对法：Android/iOS/JS/Wasm 受影响 target build/run；根因：common 编译通过不代表平台语义一致。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] fenced code block 数量为 0，正文不出现三反引号。
- [ ] frontmatter 含 name/description，H1 等于 manifest title（Kotlin 开发）。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑/防遗漏、输出要求、约束、反例库、提交前自检、2024-2026 新坑速查、相邻技能边界。
- [ ] 反例不少于 16 条，且能被“反例 数字”命中，每条有错法/对法/根因。
- [ ] 覆盖 Kotlin 1.9/2.x、K2、Gradle/KSP/KAPT、coroutines/Flow、structured concurrency、Compose/Android、JVM backend、nullability、serialization、Multiplatform、Spring/Ktor、R8/ProGuard、ABI/inline/value class。
- [ ] 已列 K2 迁移顺序、KMP 平台适配、服务端协程上下文、Gradle 8/9、测试虚拟时间、性能证据。
- [ ] 已列版本、运行时、入口、证据、影响面、验证路径和无法验证口径。
- [ ] 已覆盖 DTO/Entity/Response 分离、OptionalProperty/field mask PATCH 三态、Jackson/kotlinx absent/default/null、JPA/Exposed/jOOQ 写入白名单、affected rows、乐观锁、软删、协程取消和错误映射。
- [ ] 已明确 andr、jv、be、api、tst、aud 边界。

## 2024-2026 新坑速查

- Kotlin 2.x/2.3.x/K2：前端变化会暴露推断、插件、KAPT、KSP、detekt/ktlint、Compose Compiler 兼容问题；升级必须跑 generated sources、二进制兼容和全量 target。
- KSP2/KAPT：KAPT 在 K2 时代更易成为瓶颈和兼容风险；迁移 KSP 要确认处理器支持、增量编译和生成目录。
- compilerOptions：Gradle 新版推荐 compilerOptions；旧 kotlinOptions、freeCompilerArgs 散落会造成模块差异，convention plugin 覆盖顺序要查 task 配置。
- Compose Compiler：与 Kotlin 强绑定；Compose Multiplatform、Android Compose、AGP、BOM 不是一套版本概念，需矩阵验证。
- Gradle 7.6.3–9.0.0 与 AGP 8.2.2–8.13.0/9：configuration cache、toolchain、isolated projects、插件声明更严格；自定义 build logic 要先 dry-run。
- JDK 21/22/23/24/25：toolchain、字节码目标、虚拟线程、非法反射、GraalVM/native image 与协程混用需证据。
- coroutines 1.8/1.9/1.10.2：test scheduler、Dispatchers.Main、dispatcher 注入、limitedParallelism、main-safe、Flow share 策略要用 runTest/Turbine 回归。
- Ktor 3：插件、包名、ContentNegotiation、Client/Server API、pipeline 顺序和 2.x 差异明显；升级需请求/响应/错误映射样本。
- Spring Boot 3.x/4：Jakarta、AOT/GraalVM、Kotlin reflection、suspend controller、事务/MDC/SecurityContext、WebFlux/Servlet 差异需单独验证。
- Jackson Kotlin module 与 kotlinx.serialization：Kotlin 默认参数、explicit null、缺字段、coerce/strict 配置会改变契约；编辑/部分更新必须用样本锁定 absent/default/null。
- JPA/Exposed/jOOQ：Kotlin data class/DSL 写法容易让“复制对象”变成“全字段覆盖”；批量 update/delete、软删、乐观锁和 affected rows 必须作为写入门禁。
- Kotlin/Native 新内存模型：并发更易写但 C interop、异常、冻结旧假设、二进制体积、符号化仍需 target 证据。
- iOS/Xcode/Swift interop：KMP framework、SPM/CocoaPods、nullable、泛型、Objective-C 命名、NSError/exception 跨边界必须真机/Xcode 构建。
- Android 14/15/16 与 AGP 8/9：权限、后台限制、R8、desugaring、Compose、Lifecycle repeatOnLifecycle、JDK toolchain 变化常导致 Debug 绿 Release 红。
- serialization 1.6+：sealed polymorphism、默认值、unknown keys、枚举新增值与旧客户端兼容要有样本。
- WASM/JS target：浏览器 API、Node API、npm、ESM/CJS、bundle、source map、dynamic import、wasmJs/wasmWasi 与 commonMain 假设常不一致。

## 与相邻技能的边界

- Android 开发/android-development（andr）：Activity、Fragment、Service、Manifest、权限、存储、后台限制、厂商 ROM、logcat、签名发布等 Android 系统行为由其负责；Kotlin 开发/kotlin-development（kt） 只处理 Kotlin/Compose/协程语言层。
- Java/JVM 开发/java-jvm-development（jv）：JDK、Maven/Gradle JVM 依赖、Spring/ORM、JFR/GC、虚拟线程、GraalVM 等 JVM 基建由其负责；Kotlin 开发/kotlin-development（kt） 处理 Kotlin interop、suspend、compiler plugin 和 Kotlin ABI。
- 后端工程/backend-engineering（be）：Ktor/Spring 服务分层、配置、部署、观测、容量、外部依赖、健康检查由其负责；Kotlin 开发/kotlin-development（kt） 只处理 Kotlin 框架适配、协程语义和上下文传播风险。
- API 工程/api-engineering（api）：Ktor/Spring 接口契约、状态码、鉴权语义、OpenAPI、幂等、兼容版本由其负责；Kotlin 开发/kotlin-development（kt） 只处理 DTO/serializer/nullability 的 Kotlin 风险。
- 测试验证/test-engineering（tst）：场景矩阵、原 bug 复现、协程/Flow 测试、KMP 多 target 回归、CI 证据由其负责；Kotlin 开发/kotlin-development（kt） 提供 Kotlin 特有验证点。
- 代码审计/code-audit（aud）：代码改动后的需求对账、影响面、安全质量、证据收口由其负责；Kotlin 开发/kotlin-development（kt） 不替代最终审计。
- 数据库工程/database-engineering（db）：实体变更影响表字段、迁移、SQL、事务、Redis 时由其负责；Kotlin 开发/kotlin-development（kt） 只提示 data class/serializer/transaction coroutine 风险。
- 数据库工程/database-engineering（db）：JPA/Exposed/jOOQ 写入触及表结构、索引、唯一约束、软删 scope、批量 SQL、迁移或数据修复时必须联动；Kotlin 开发/kotlin-development（kt） 只给 Kotlin DTO 映射、事务取消和 ORM/DSL 写入门禁。
- 发布部署/release-engineering（rls）：Gradle 产物、灰度、回滚、Release/R8/Native/iOS 发布策略由其负责；Kotlin 开发/kotlin-development（kt） 提供 Kotlin 构建、ABI 和 target 风险清单。
- Apple 全链路开发与发布/apple-development（appl）：KMP iOS 产物被 Swift/SwiftUI/UIKit 消费、签名、entitlements、上架由其负责；Kotlin 开发/kotlin-development（kt） 只管 exported API 与 Native/KMP 编译证据。
- 性能工程/perf-engineering（pfe）：容量、吞吐、缓存、慢查询、系统级压测由其负责；Kotlin 开发/kotlin-development（kt） 只处理 Kotlin 分配、装箱、Flow/serialization 和 Native 体积证据。
- 研究调研/research（rsch）：版本矩阵、官方兼容表、K2/AGP/Compose/KSP 行为不确定时联动；未查不得凭记忆下结论。