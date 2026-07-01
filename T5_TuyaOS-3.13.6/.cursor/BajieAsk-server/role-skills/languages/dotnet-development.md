---
name: dotnet-development
description: .NET Dev实战排障版 - 面向 C#/.NET 8/9/10、ASP.NET Core Minimal APIs、EF Core、DI、IHostedService、HttpClientFactory、Kestrel/YARP、Blazor/WASM、MAUI 边界、NuGet、AOT/trimming、source generators、OpenTelemetry、跨平台证书/时区/编码的实现侧排障技能。涉及 .cs/.csproj/.sln、global.json、Directory.Packages.props、NuGet.config、dotnet CLI、ASP.NET Core、EF Core、AutoMapper、MediatR、Serilog、BenchmarkDotNet、Polly v8、Microsoft.Extensions.Resilience、AddResilienceHandler、运行时诊断、构建发布或 .NET 安全实现时必须使用。
---
# .NET 开发

.NET 开发（dotnet-development，兼容 slug: dnet）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

定位：本技能只负责 .NET/C# 语言、运行时、框架实现侧排障与改动护栏。核心是先锁定 TFM/SDK、Host/运行时、入口、证据，再按 ASP.NET Core、EF Core、NuGet、DI、AOT/trimming、Blazor/MAUI、CLR/GC 等场景最小修复；API 契约、数据库设计、安全审计、发布编排、测试策略只做联动边界，不搬运其职责。

## 快速总则：TFM/SDK / Host/运行时 / 入口 / 证据

- TFM/SDK：先确认 TargetFramework/TargetFrameworks、LangVersion、Nullable、ImplicitUsings、global.json、dotnet --info、SDK feature band、workload、RID、Configuration、Directory.Build.props/targets、Directory.Packages.props、NuGet.config、packages.lock.json。
- Host/运行时：明确 dotnet/apphost/IIS in-process/out-of-process/Kestrel/Windows Service/systemd/container/MAUI/Blazor WASM；确认 runtime/aspnet image、RID、CPU 架构、GC 模式、线程池、文化区、时区、证书存储、编码和文件系统大小写。
- 入口：定位触发点是 restore/build/test/publish/run、Program.cs/minimal API endpoint、middleware、controller、IHostedService、HttpClient、EF Core migration/query、Blazor lifecycle、MAUI handler、source generator、AOT/trimming、CLR diagnostics。
- 证据：必须保留完整 exception 与 inner exception、请求/响应样本、traceId/spanId、结构化日志、生成 SQL、MSBuild binlog、NuGet 依赖树、ILLink/AOT warning、dotnet-counters/trace/dump、退出码和目标平台日志。
- 改动前先搜生产方/消费方：public API、DTO、Options、路由、endpoint metadata、DI 注册、DbContext、迁移、包版本、配置 key、source generator 输入输出、发布参数都要全量查引用。
- 性能、安全、兼容结论必须有可复核证据；证据不足先不改，列缺失的版本、日志、SQL、配置、命令或目标平台。

## 单技能工程门禁：少犯低级错的闭环

- 先定边界再写代码：每个 .NET 改动必须明确输入 DTO、Domain model、EF Entity、Response DTO、Options、配置源、异常映射、日志字段、验证命令和回滚点；缺一项就先补证据，不靠“能编译”报完成。
- DTO/Entity 分离是硬门槛：Controller、Minimal API、SignalR hub、gRPC service、message consumer 都禁止直接接收或返回 EF Entity；映射必须检查导航属性、tenant/user id、并发字段、secret、PII、只读字段和默认值穿透。
- Validation 不是装饰：DataAnnotations、IValidatableObject、FluentValidation、endpoint filter、ModelState、TryValidateModel、自定义 BindAsync/TryParse 都必须把失败路径映射为稳定 ProblemDetails；禁止 validation 失败后继续执行业务。
- Binding 不能靠猜：Minimal API 的 primitive/complex/body/form/header/service 绑定来源必须显式核对；多个 body、隐式服务注入、AsParameters、IFormFile、route token、enum/date/decimal culture 都要有请求样本和失败样本。
- EF Core 写入必须有结果证据：Add/Update/Remove、SaveChanges/SaveChangesAsync、ExecuteUpdate/Delete、raw SQL、Dapper、outbox/inbox 都要检查 affected rows、concurrency token、事务边界、tenant/scope 和异常路径；0 行、超预期或并发冲突不能静默成功。
- 生命周期不能混：DbContext 禁止 singleton/static/跨线程复用；Scoped 服务禁止被 Singleton 捕获；IHostedService 和 fire-and-forget 工作必须创建 scope、传 CancellationToken、记录异常、支持停机 drain。
- 外部调用必须可控：IHttpClientFactory/typed client 必须定义 base address、timeout、per-request cancellation、retry/backoff、circuit/hedging 边界、幂等条件和认证 header 来源；非幂等 POST 默认不重试。
- 配置与 secret 必须启动即失败：Options 必须绑定来源、ValidateDataAnnotations/自定义 Validate、ValidateOnStart；生产禁止默认空 secret、开发 signing key、明文连接串、日志 token、Authorization、cookie、refresh token、PII。
- 异常不能伪成功：禁止 catch Exception 后返回 OK/default/空集合；OperationCanceledException、Timeout、validation、auth、not found、conflict、DbUpdateConcurrencyException、DbUpdateException、HttpRequestException 必须分层映射并保留 traceId。
- 构建和运行证据要成套：restore/build/test/publish/run 至少覆盖目标 TFM/RID/Configuration；涉及 AOT/trimming/source generator/nullable/analyzer 时，warning 逐条处理或在输出中标明未验证。

## 场景执行卡

### 1. SDK / csproj / MSBuild / NuGet
- 适用：本地与 CI 不一致、restore/build/test/publish 失败、包冲突、workload、central package management、lock file、source mapping、供应链告警。
- 先查：dotnet --info、global.json、csproj/sln、props/targets、Directory.Packages.props、NuGet.config、packages.lock.json、CI image、错误全文和 binlog。
- 动作：核对 TFM 与 SDK feature band；检查 LangVersion/Nullable/analyzer/TreatWarningsAsErrors；固定 floating/range；确认 package source mapping、transitive advisory、RID-specific asset、workload manifest。
- 证据：restore/build 退出码、NU/MSB/CS warning-error、冲突包路径、锁文件 diff、binlog 关键节点。
- 防漏：不要只改顶层 PackageReference；Directory.Packages.props 和 transitive 可能才是根因。

### 2. C# / nullable reference types / source generators
- 适用：nullable warning、required/init/record、泛型约束、Span/ref struct、incremental generator、analyzer、System.Text.Json source generation。
- 先查：LangVersion、Nullable、.editorconfig、生成文件、AnalyzerConfigOptions、public API 调用方、序列化/反序列化入口、AOT/trimming 目标。
- 动作：修真实输入契约，不用 ! 清屏；public API 标注 nullable attributes；source generator 用 incremental pattern，避免静态缓存 Compilation；生成代码声明 nullable context；反射路径改 source-generated JSON/Regex/DI metadata。
- 证据：警告号清单、生成输出、API 签名 diff、调用方覆盖、编译输出。
- 防漏：source generator 在 IDE、CLI、CI、不同 SDK 下可能输出不同诊断。
- DTO/NRT 卡：输入 DTO、Domain model、EF Entity、Response DTO 必须分离；NRT 只表达编译期可空契约，不能区分请求字段 absent、显式 null、默认值和未绑定。PATCH/局部更新必须用 JSON Patch、Optional/Maybe 包装、field mask、显式 has-value 标记或 ModelState/JsonNode 原始字段证据，不允许用 string?、int?、default 或 required 直接推断用户意图。

### 3. async / await / Task / CancellationToken / 资源释放
- 适用：死锁、吞异常、线程池饥饿、取消无效、超时、后台任务、HTTP/DB I/O、IAsyncDisposable。
- 先查：调用链、同步阻塞点、Task 生命周期、CancellationToken 来源、HttpClient/DbContext 生命周期、threadpool counters/trace。
- 动作：I/O 用 async API；ASP.NET Core 请求链禁 .Result/.Wait；传递 cancellation；await using 释放异步资源；CPU 密集才 Task.Run；并发加限流和超时。
- 证据：成功/异常/取消/超时四类日志或测试、trace、before/after counters。
- 防漏：async void 只限事件；fire-and-forget 必须有异常观测和生命周期归属。
- 取消传播卡：Controller/Minimal API、service、repository、HttpClient、EF Core、streaming、BackgroundService 都要把 CancellationToken 传到底；不能只在入口声明 token。取消要映射为可解释的日志/状态，不把客户端断开、业务超时和下游超时混成 500。
- 并发归属卡：Task.WhenAll、Parallel.ForEachAsync、Channel、TPL Dataflow、Timer、queue consumer 必须有限流、异常聚合、scope 创建、DbContext 独占和停机取消；禁止 fire-and-forget 无 owner、无日志、无重试边界。

### 4. ASP.NET Core Minimal APIs / middleware / Kestrel / YARP
- 适用：404/405、binding/validation、TypedResults、ProblemDetails、endpoint filters、auth、CORS、Kestrel limits、反代头、YARP 转发异常。
- 先查：Program.cs、MapGroup/MapGet/MapPost、endpoint metadata、UseRouting/UseCors/UseAuthentication/UseAuthorization 顺序、请求样本、响应、OpenAPI、Kestrel/YARP 配置、ForwardedHeaders。
- 动作：Minimal API 显式绑定来源；统一 validation 和 ProblemDetails；保证 auth scheme/policy 与 endpoint metadata 一致；Kestrel limits、HTTPS/HSTS、client cert、proxy headers 按部署事实验证；YARP 区分路由匹配、transform、destination health。
- 证据：2xx/4xx/5xx 样本、endpoint 命中日志、OpenAPI diff、集成测试、端口/证书/反代日志。
- 防漏：API 设计归 api；本技能只证明 ASP.NET Core 实现与运行证据。
- Binding/DTO 卡：Minimal API 参数必须明确 FromRoute、FromQuery、FromHeader、FromBody、FromForm、AsParameters 或 BindAsync/TryParse 来源；Controller 必须核 ApiController 推断、FromBody 单一 body 限制、复杂类型来源、route token 和 model binding error。禁止把 EF Entity 或 Domain object 直接作为输入 DTO 或响应 DTO 暴露。
- Error mapping 卡：validation、binding、NotFound、Conflict、Unauthorized/Forbidden、DbUpdateConcurrencyException、DbUpdateException、OperationCanceledException 和外部依赖错误必须映射到稳定 ProblemDetails/type/title/status/detail/extensions；生产 detail 不泄露堆栈、SQL、连接串、token、PII；OpenAPI 和实际 ProblemDetails 样本要一致。

### 5. DI / Options / configuration / logging
- 适用：服务解析失败、scope 泄漏、配置漂移、Options 不生效、日志缺上下文或泄密。
- 先查：注册列表、构造函数、lifetime、appsettings/env/user-secrets/Key Vault、Options class、ValidateScopes/ValidateOnBuild、日志样本。
- 动作：Singleton 不捕获 Scoped；禁止 root provider 解析 scoped/disposable transient；避免 BuildServiceProvider 双容器；Options ValidateOnStart；IOptionsSnapshot/IOptionsMonitor 按生命周期选；结构化日志用占位符并脱敏。
- 证据：启动校验输出、配置来源链、scope validation、日志字段。
- 防漏：配置分隔符、大小写、数组覆盖在 Linux/container 与本地可能不同。
- Options 门禁卡：每个强业务配置都要有 Options class、section 名、默认值策略、ValidateOnStart 证据和测试覆盖；禁止在业务代码散落 Configuration["Key"]、空字符串 fallback、生产缺配置仍启动成功。
- Logging 门禁卡：ILogger 使用 message template，不拼接敏感对象；日志 scope 必须包含 traceId、tenant/user/job/correlation 这类可控字段；禁止记录 Authorization、Cookie、Set-Cookie、access/refresh token、连接串、证书私钥、完整身份证/手机号/邮箱。

### 6. IHostedService / BackgroundService / timers / queues
- 适用：后台任务不启动、启动阻塞、优雅停机失败、重复消费、Timer 重入、队列堆积。
- 先查：Host lifetime、StartAsync/ExecuteAsync/StopAsync、CancellationToken、scope factory、异常处理、队列幂等键、health check、日志。
- 动作：StartAsync 不做长阻塞；循环必须 await delay 并接 cancellation；每次工作创建 scope；异常可观测；Timer 防重入；StopAsync 有超时和 drain 策略。
- 证据：启动/停止日志、取消路径测试、重复消费测试、队列指标。
- 防漏：后台任务里的 DbContext/HttpClient lifetime 和 Web 请求不同，不能复用请求作用域假设。

### 7. HttpClientFactory / resilience / 外部调用
- 适用：socket exhaustion、DNS 不刷新、超时失控、重试放大、认证头串租户、代理/证书问题。
- 先查：AddHttpClient 注册、handler lifetime、timeout、Polly/resilience pipeline、base address、headers、DNS/代理、证书链、日志和 trace。
- 动作：用 IHttpClientFactory/typed client；区分全局 timeout 与 per-request cancellation；重试只覆盖幂等或可重试错误；认证头按请求设置；证书 pinning/自签只按环境证据处理。
- 证据：请求日志、trace span、超时/重试计数、DNS/证书错误全文。
- 防漏：不要把 HttpClient 注册成每请求 new，也不要把带用户态 header 的 client 做 singleton 状态容器。
- Resilience 卡：Polly v8 或 Microsoft.Extensions.Resilience 必须列 retry/timeout/circuit/hedging 策略、适用 status/exception、幂等依据、最大耗时预算和日志指标；认证、支付、下单、扣库存等非幂等请求必须有 idempotency key 或明确禁重试。
- Header 隔离卡：tenant、user、Authorization、correlation header 按请求设置，不写入 DefaultRequestHeaders 的用户态状态；typed client 只保存无用户状态配置，避免跨请求串租户。

### 8. EF Core migrations / query splitting / transactions
- 适用：迁移失败、慢查询、N+1、笛卡尔爆炸、并发冲突、事务不一致、provider 差异。
- 先查：EF Core/provider 版本、DbContext lifetime、migration diff、生成 SQL、query plan、tracking/no-tracking、split/single query、transaction boundary、旧数据样本。
- 动作：读查询优先投影 + AsNoTracking；Include 爆炸时用 AsSplitQuery 但验证往返和一致性；Raw SQL 参数化；迁移破坏性变更交 db；并发用 rowversion/concurrency token；真实 provider/Testcontainers 验证。
- 证据：SQL、migration script、explain、事务日志、集成测试、回滚方案。
- 防漏：SQLite/InMemory 不能证明 SQL Server/PostgreSQL/MySQL 的翻译、约束、事务和并发行为。
- 写保护卡：ExecuteUpdate、ExecuteDelete、FromSql/ExecuteSql/raw SQL、Dapper 和批量写入必须有明确 WHERE、租户/权限/soft delete scope、并发条件、事务边界和 affected rows 断言；affected rows 为 0、超过预期或不等于请求目标数时要进入 ProblemDetails/审计日志/告警路径，不能静默成功。
- Soft delete 卡：HasQueryFilter、tenant filter、soft delete filter、named query filters 和 IgnoreQueryFilters 必须列出绕过入口、调用方、权限门禁和测试负例；管理端、后台任务、报表、恢复/硬删路径使用 IgnoreQueryFilters 时必须显式加 tenant/id/scope 条件，禁止全表无界更新或删除。
- Tracking 卡：默认 tracking、AsNoTracking、AsNoTrackingWithIdentityResolution、Attach/Update、ChangeTracker.Clear、AutoDetectChangesEnabled 必须按读写意图选择；禁止把前端 DTO 直接 Attach/Update 成 Entity 造成 mass assignment。
- Migration 卡：新增非空列、改枚举/长度/精度、删列、拆表、索引并发创建、默认值、backfill 都必须验证旧数据、锁表、回滚、幂等和真实 provider；migration 生成成功不等于可上线。

### 9. LINQ / 集合 / streaming
- 适用：重复查库、客户端过滤、内存飙升、排序分页错、IAsyncEnumerable、deferred execution。
- 先查：IQueryable/IEnumerable/IAsyncEnumerable 来源、枚举次数、数据量、SQL/log、排序键、provider。
- 动作：避免过早 ToList；分页必须稳定排序；深分页优先 keyset；大结果集用 streaming 但注意 DbContext 生命周期；Task 序列先固化再并发控制。
- 证据：生成 SQL、枚举点、内存/耗时指标、边界数据测试。
- 防漏：把 IEnumerable 扩展方法接在 IQueryable 后可能把服务端过滤变客户端过滤。

### 10. AOT / trimming / single-file / runtime diagnostics
- 适用：Native AOT、PublishTrimmed、single-file、自包含、启动崩溃、反射/序列化、动态代理、GC/线程池/内存问题。
- 先查：PublishAot/PublishTrimmed、RID、IL2xxx/IL3xxx warning、IsAotCompatible/IsTrimmable、依赖列表、runtimeconfig、counters/trace/dump。
- 动作：警告逐条消除或解释；优先 source-generated JSON/Regex；避免 Reflection.Emit、Assembly.Load、动态代理；按目标 RID publish 并运行关键路径；诊断用 dotnet-counters/trace/dump 定位而非猜。
- 证据：publish 输出、warning 清单、目标平台启动和关键路径测试、体积/启动/GC/threadpool 指标。
- 防漏：Debug 能跑不代表 trimmed/AOT/single-file 能跑。
- AOT 兼容卡：System.Text.Json、Regex、configuration binding、DI、reflection、dynamic proxy、EF Core、AutoMapper、MediatR、logging provider、serializer 都要查 trim/AOT warning；只要有 IL2xxx/IL3xxx/RequiresUnreferencedCode/RequiresDynamicCode，就不能声称发布通过。
- Source generator 卡：JSON/Regex/options validation/OpenAPI/analyzer generator 要验证生成文件、diagnostic、增量输入和 CI 输出；禁止只看 IDE 无红线。

### 11. Blazor / WASM / MAUI 边界
- 适用：Blazor Server/WASM/Hybrid、静态资源、JS interop、WASM AOT、MAUI Android/iOS/MacCatalyst/Windows、平台权限、handler lifecycle。
- 先查：Hosting model、target platform、workload、RID、browser/device logs、static web assets、linker/AOT warning、权限声明、生命周期入口。
- 动作：Blazor Server 关注连接和 circuit；WASM 关注下载、浏览器 API、AOT 和 trimming；Hybrid 关注 WebView bridge；MAUI 只处理 .NET 实现边界，原生签名/上架/平台深水区联动 appl/andr/rls。
- 证据：目标浏览器/设备日志、平台构建/运行日志、权限声明、关键交互测试。
- 防漏：开发机可用不等于目标 OS/浏览器/设备可用。

### 12. OpenTelemetry / diagnostics / observability hooks
- 适用：日志无 traceId、指标缺失、分布式追踪断链、性能证据不足、生产排障不可观测。
- 先查：ILogger scope、ActivitySource、Meter、OpenTelemetry SDK/exporter、sampling、resource attributes、HttpClient/ASP.NET Core/EF instrumentation。
- 动作：保留 trace/span correlation；关键业务边界加 Activity/metrics；日志结构化并脱敏；采样和 exporter 交 obs；本技能只补 .NET instrumentation 实现。
- 证据：日志字段、trace waterfall、metrics 名称、采样配置、before/after 诊断输出。
- 防漏：不要为排障临时打印 token、连接串、PII。

### 13. Docker / publish / runtime host
- 适用：容器启动失败、镜像过大、端口/ENV、runtime mismatch、non-root、只读文件系统、SDK container publish。
- 先查：Dockerfile 或 dotnet publish container 参数、base image tag/digest、TFM/RID、ASPNETCORE_URLS/HTTP_PORTS、ENV、health check、entrypoint、日志。
- 动作：SDK 镜像构建、aspnet/runtime 镜像运行；TFM 与 runtime 对齐；生产 Release；非 root/只读文件系统验证 diagnostics/temp/data protection keys；健康检查覆盖依赖。
- 证据：build/run 日志、镜像大小、端口、env、health check、启动日志、smoke 输出。
- 防漏：发布编排、灰度、回滚交 rls；本技能只给 .NET publish/runtime 证据。

### 14. .NET test projects / WebApplicationFactory / Testcontainers
- 适用：测试本地过 CI 失败、集成测试不稳定、并行污染、WebApplicationFactory 启动失败、Testcontainers 数据库/消息队列不一致、覆盖率或测试平台配置漂移。
- 先查：xUnit/NUnit/MSTest/TUnit、Microsoft.NET.Test.Sdk 或 Microsoft.Testing.Platform、TargetFramework、RunSettings、并行配置、fixture 生命周期、测试日志、CI OS/容器权限。
- 动作：集成测试用真实 provider/Testcontainers；WebApplicationFactory 覆盖配置、认证、环境名和外部依赖替身；时间/随机数/Guid/外部 I/O 注入可控；共享 fixture 必须隔离状态；flaky 先定位时序/并发/外部依赖，不默认加重试。
- 证据：dotnet test 退出码、失败用例日志、容器启动日志、覆盖率输出、关键 2xx/4xx/5xx/异常/取消路径。
- 防漏：EF InMemory、mock HttpClient、内存认证不能证明生产 provider、DNS/TLS、授权策略和序列化行为；测试策略仍联动 tst。

### 15. ASP.NET Core security implementation hooks
- 适用：认证/授权失效、cookie 登录、JWT/OAuth、CSRF、CORS、限流、Data Protection key 丢失、敏感配置泄漏。
- 先查：AddAuthentication/AddAuthorization、default scheme、policy、claims mapping、UseAuthentication/UseAuthorization 顺序、cookie/JWT options、DataProtection key ring、CORS/rate limiter/headers 配置。
- 动作：endpoint policy 与认证 scheme 明确绑定；cookie 设置 Secure/HttpOnly/SameSite 并验证反代 HTTPS；状态变更端点验证 anti-forgery/CSRF 方案；Data Protection keys 在多实例和容器重启间持久且受保护；限流按用户/IP/租户维度留观测。
- 证据：401/403/CSRF/CORS/限流样本、key ring 存储位置、反代 scheme 日志、敏感日志脱敏检查。
- 防漏：不要用 AllowAnyOrigin+AllowCredentials、关闭证书校验、临时 bypass policy、开发 signing key 进入生产；安全建模和漏洞优先级联动 wsec。

### 16. multi-tenant / request context isolation
- 适用：串租户、缓存污染、后台任务缺租户、审计日志缺上下文、外部调用带错租户 header。
- 先查：tenant 来源、claims/header/host 解析、DbContext query filter、缓存 key、日志 scope、HttpClient header 设置、BackgroundService job payload。
- 动作：租户上下文必须请求级/任务级显式传递；缓存和分布式锁 key 包含 tenant；全局 query filter 与管理端绕过路径可审计；HttpClient 用户态 header 按请求设置；后台任务 payload 持久化 tenant/idempotency key。
- 证据：跨租户负例测试、日志 scope 字段、SQL filter、缓存 key 样本、后台任务重放样本。
- 防漏：不要把 tenant 存在 singleton/static/AsyncLocal 后跨请求复用而无清理；权限和隔离风险联动 wsec/aud。

### 17. gRPC / SignalR / streaming endpoints
- 适用：gRPC 调用失败、SignalR 掉线/串用户、SSE/流式接口取消无效、消息过大、反代不支持 HTTP/2/WebSocket。
- 先查：proto/生成代码、service/hub 注册、HTTP/2/WebSocket、auth、message size、keepalive、backplane、反代配置、客户端日志。
- 动作：streaming 传递 cancellation；hub 不保存用户状态到 singleton；分布式部署验证 backplane/affinity；gRPC status 与 exception mapping 明确；反代支持 HTTP/2/WebSocket/timeout。
- 证据：连接/断开日志、status code、客户端重连日志、反代日志、跨实例测试。
- 防漏：本地直连成功不代表经网关、TLS、LB、HTTP/2 downgrade 后可用；契约设计联动 gge。

### 18. ADO.NET / Dapper / raw SQL
- 适用：连接池耗尽、SQL 注入、timeout、事务不一致、reader 未释放、类型/时区映射错误、批量写入失败。
- 先查：connection string、provider 版本、DbConnection/DbTransaction 生命周期、CommandTimeout、参数绑定、SQL 文本、pool counters、目标数据库日志。
- 动作：SQL 必须参数化；connection/command/reader 用 await using/using 释放；同一业务事务显式传递 DbTransaction；大结果集 streaming 时约束连接生命周期；批量操作验证锁、超时、回滚。
- 证据：SQL 与参数样本、连接池指标、事务日志、超时堆栈、目标 provider 集成测试。
- 防漏：不要把 Dapper/raw SQL 当作绕过 db、安全和事务证据的捷径。
- Dapper 写保护卡：UPDATE/DELETE/MERGE/UPSERT 必须记录 SQL 模板、参数样本、WHERE/scope、tenant、soft delete、affected rows、事务和回滚证据；禁止字符串拼接动态列/表/排序进入 SQL，白名单映射仍需参数化值和审计日志。

### 19. message consumers / outbox / idempotency
- 适用：重复消费、消息丢失、无限重试、DLQ 堆积、事件顺序错、分布式事务不一致。
- 先查：broker/客户端库、consumer lifetime、ack/nack、retry/backoff、DLQ、outbox/inbox、幂等键、trace context、payload schema。
- 动作：业务成功后再 ack；不可恢复错误进 DLQ 并带原因；消费者必须幂等；本地事务与事件发布用 outbox 或明确补偿；重试区分瞬时/永久错误；traceId/correlationId 贯穿日志和消息头。
- 证据：重复投递测试、DLQ 样本、outbox 状态迁移、consumer lag、trace 串联。
- 防漏：不要在 handler 中吞异常后 ack，也不要无上限并发打爆 DbContext/HttpClient/下游；事件契约联动 gge，数据一致性联动 db。

### 20. IIS / Windows Service / enterprise Windows host
- 适用：IIS 502.5/500.30、启动后秒退、权限不足、证书找不到、Windows Service 路径/账户问题、EventLog 无日志。
- 先查：web.config、ANCM stdout/EventLog、app pool identity、hosting bundle、process bitness、service account、working directory、cert store、文件/注册表权限。
- 动作：区分 in-process/out-of-process；stdout 仅临时开启且避免泄密；服务用明确 content root/working directory；证书按 CurrentUser/LocalMachine 和账户验证；权限最小化。
- 证据：EventLog/ANCM 日志、app pool/service account、证书 thumbprint 与 store、启动命令和退出码。
- 防漏：开发者管理员权限可用不代表 app pool identity 或服务账户可用。

### 21. .NET Aspire / service defaults / local orchestration
- 适用：AppHost 本地编排失败、服务发现/配置注入错误、dashboard 无 trace、health check 与依赖状态不一致。
- 先查：AppHost、ServiceDefaults、launch profiles、resource bindings、health checks、OTel exporter、配置来源、容器日志。
- 动作：区分本地编排与生产发布；service discovery/config/health/OTel 必须在目标环境验证；依赖 resource readiness 不等于业务可用；secret 不写入源码或普通 appsettings。
- 证据：AppHost 启动日志、dashboard trace、health endpoint、配置来源、依赖容器日志。
- 防漏：不要把 Aspire 本地成功等同于 K8s/云环境发布成功，发布编排仍联动 rls/cld。

### 22. library / SDK / NuGet package authoring
- 适用：公共库破坏兼容、multi-targeting 失败、包缺运行时资产、消费者 restore/build 失败、analyzer/source generator 打包错误。
- 先查：TargetFrameworks、Public API、PackageId/Version、SemVer、ref/lib/runtimes/analyzers/buildTransitive、PackageValidation、XML docs、symbols/source link。
- 动作：公共 API 变更必须标 breaking；多 TFM 分别 build/test/pack；analyzer/source generator 使用正确包路径；启用 package validation/API compat；包内容用 dotnet pack 产物检查。
- 证据：nupkg 内容、API diff、pack 日志、消费者样例项目 restore/build/test。
- 防漏：本仓库测试通过不代表 NuGet 消费者能 restore、AOT/trim 或多 TFM 使用。
- 库级边界速查：AutoMapper 启动/测试用 AssertConfigurationIsValid，Queryable 投影用 ProjectTo 且作为 LINQ 链最后一步，v15 关注 license 与 ILoggerFactory；MediatR 默认 transient 注册，显式核对 behavior、pre/post processor 与 pipeline 顺序，商业/企业场景关注 license；Serilog 使用 message template 和结构化属性，LogContext 只放可控上下文，敏感值先脱敏，退出前 CloseAndFlushAsync；BenchmarkDotNet 必须 Release、无调试器、按目标多环境跑，避免 DCE，记录环境噪声；Polly v8 / Microsoft.Extensions.Resilience 从 Policy 迁移到 ResiliencePipeline/Strategy，HttpClient 优先核 AddResilienceHandler 与 Microsoft.Extensions.Http.Resilience 注册边界。

## 高频坑 / 防遗漏

- 低级错硬禁止：DbContext singleton/static、Controller/Minimal API 直接绑定 Entity、async void 业务方法、fire-and-forget 无 owner、catch Exception 返回 OK、日志 token/连接串/PII、关闭 nullable/analyzer/trim warning、全局 AllowAnyOrigin+AllowCredentials、非幂等请求自动重试、无 WHERE 批量写。
- TFM/SDK 漂移：global.json、CI image、Docker SDK/runtime、workload manifest 不一致会改变 analyzer、生成器、运行时行为。
- Host 漂移：IIS、Kestrel、systemd、Windows Service、container、Blazor WASM、MAUI 的配置、路径、证书、日志入口不同。
- Nullable：用 ! 压警告；required 未覆盖反序列化/EF；DTO 与 OpenAPI 可空性漂移。
- NRT/DTO：把 nullable reference type 当成请求 patch 语义；用 Entity 同时承载输入、领域、持久化和响应；无法区分 absent/null/default 导致误清空字段。
- ModelState/validation：ApiController 自动 400、Minimal API validation、endpoint filter、FluentValidation 和业务校验路径不一致，容易出现一条路径校验一条路径直写。
- Source generators：IDE 正常但 CI 不生成；增量生成器缓存错误；生成代码没声明 nullable；AOT/trimming 仍走反射。
- Minimal APIs：参数来源歧义；TypedResults/Produces 与实际响应不一致；endpoint filter 顺序漏 auth/validation。
- ProblemDetails：异常直接返回字符串或堆栈；validation/binding/concurrency/DB 错误映射不稳定；OpenAPI 错误体与实际响应漂移。
- DI：Singleton 捕获 DbContext；root provider 解析 scoped；BuildServiceProvider 双容器；IOptionsMonitor 被当快照用。
- IHostedService：StartAsync 长阻塞；Timer 重入；异常退出无日志；StopAsync 不 drain；后台 scope 泄漏。
- HttpClientFactory：每次 new HttpClient；静态 client DNS 不刷新；重试非幂等 POST；默认 header 串用户态。
- EF Core：lazy loading N+1；Include 笛卡尔爆炸；split query 未验证一致性；深 Skip/Take；Raw SQL 拼接；迁移破坏旧数据。
- EF 写操作：ExecuteUpdate/ExecuteDelete 缺 WHERE 或缺 tenant/soft delete scope；IgnoreQueryFilters 后未补权限和范围；raw SQL/Dapper 未检查 affected rows。
- EF 并发：缺 rowversion/concurrency token，SaveChanges 0 行或 DbUpdateConcurrencyException 被吞掉，导致覆盖他人更新或误报成功。
- LINQ：IEnumerable 后过滤导致客户端执行；延迟执行重复查库；IAsyncEnumerable 生命周期超过 DbContext。
- NuGet：floating/range/pre-release 进生产；lock file 未更新；package source mapping 缺失；transitive advisory 被忽略。
- AOT/trimming：IL warning 当普通 warning；动态代理/反射/序列化运行时才炸；只在 Debug 验证。
- CLR/GC：只看平均耗时，不看 allocation、LOH、GC pause、threadpool queue、container memory limit。
- Kestrel/YARP：反代头未启用；HTTPS/HSTS 与代理冲突；request body limit、timeout、client cert 在生产才失败。
- Blazor/WASM/MAUI：静态资源、浏览器限制、linker、平台权限、handler 生命周期未按目标平台验证。
- 跨平台：证书 store、时区数据库、默认编码、路径大小写、文件锁、换行、ICU/globalization invariant 造成线上差异。

## 输出要求

1. 现场证据：TFM/SDK、Host/运行时、OS/容器/RID/CPU、关键包版本、命令、日志、SQL、trace/dump。
2. 入口与影响面：入口文件/endpoint/service/job、被改 API/DTO/Options/配置/迁移/包版本/路由/权限的生产方、消费方、测试覆盖。
3. 改动清单：文件、行数、原因；只做目标相关最小改动。
4. 验证命令：restore/build/test/publish/run/diagnostics 的退出码与关键输出；未跑必须写未验证。
5. 风险与回滚：尤其 EF Core migration、NuGet 升级、auth/config、AOT/trimming、container runtime、跨平台行为。
6. 联动说明：需要 api、db、be、wsec、rls、tst、aud 的具体边界原因。

## 约束

- 不凭训练知识断言 2024-2026 版本/API 行为；版本敏感结论必须查官方 docs、release notes 或源码并标版本。
- 不在缺少复现、日志、SQL、配置来源、运行时事实的情况下修改核心链路。
- 不用 !、catch-all、禁用 analyzer、关闭 nullable/trim warning 作为默认修复。
- 不把 EF InMemory/SQLite 替代真实 provider 的事务、约束、并发、SQL 翻译证据。
- 不用 NRT、required、默认值或可空类型推断 PATCH absent/null/default；必须有 JSON Patch、Optional/Maybe、field mask 或原始字段存在性证据。
- 不把 Entity 同时当输入 DTO、Domain、EF Entity 和 Response DTO；跨边界必须显式映射并验证可空性、敏感字段和 OpenAPI 输出。
- 不提交 secret、连接串、证书、token、生产 appsettings；日志不得输出 PII/token。
- 不把 API 设计、DB schema、安全审计、发布编排、测试策略写成本技能职责。
- 不为顺手升级大版本、替换框架、重写架构；包升级必须有 advisory/兼容/锁文件证据。
- 不把 AOT/trimming warning、nullable warning、analyzer warning 当可忽略噪声。
- 不把 ModelState、validation exception、DbUpdateConcurrencyException、HttpRequestException、TimeoutException、OperationCanceledException 捕获后返回 200/空集合/default。
- 不把 DbContext、IServiceScope、HttpContext、ClaimsPrincipal、tenant context、IOptionsSnapshot 放进 singleton/static 缓存。
- 不把 Testcontainers、真实 provider、xUnit/NUnit/MSTest、WebApplicationFactory、dotnet build/test/publish 证据替换成“我看代码没问题”。
- 不跨 slug 修改其他技能；本技能完成后需 tst 证据与 aud 收口。

## 高频 Bug 反例库

- 反例 1：错法：编译错就改业务逻辑。对法：先核 dotnet --info、TFM/SDK、restore/build 日志、source generator 输出。根因：SDK/TFM/NuGet 漂移会改变编译和生成结果。
- 反例 2：错法：Nullable warning 全用 ! 压掉。对法：修 DTO/Options/entity 可空契约、required/guard、nullable attributes。根因：NRT 是调用契约证据，不是格式噪声。
- 反例 2.1：错法：PATCH DTO 用 string? 判断 null 就清空，不为 null 就更新。对法：用 JSON Patch、Optional/Maybe、field mask 或字段存在性记录区分 absent/null/default。根因：NRT 和 CLR 默认值不能表达请求字段是否出现。
- 反例 3：错法：Minimal API 只测 200。对法：覆盖 binding、validation、TypedResults/Produces、401/403/404/5xx 与 OpenAPI diff。根因：endpoint metadata 与运行响应容易漂移。
- 反例 3.1：错法：把 EF Entity 直接作为 Controller/Minimal API 输入和响应。对法：输入 DTO、Domain、Entity、Response 分离并显式映射。根因：持久化字段、导航属性、并发字段、租户字段和敏感字段会穿透 API 边界。
- 反例 4：错法：EF 慢查询直接加 Include。对法：看 SQL/plan，按投影、索引、AsSplitQuery/AsNoTracking/keyset 选择。根因：Include 可能制造笛卡尔爆炸和更多 roundtrip。
- 反例 4.1：错法：ExecuteUpdate/ExecuteDelete 或 Dapper UPDATE 只拼业务条件，不查 affected rows。对法：强制 WHERE、tenant/scope、soft delete filter、并发条件和 affected rows 断言。根因：批量写绕过 change tracker，错误范围会直接写坏数据。
- 反例 4.2：错法：IgnoreQueryFilters 后直接查询或删除。对法：列明绕过理由、权限、tenant/id 条件和负例测试。根因：soft delete/tenant filter 是隔离边界，绕过后必须重建范围证据。
- 反例 5：错法：迁移能生成就直接上线。对法：审 migration script、旧数据、锁表、回滚和真实 provider 测试。根因：EF migration 是数据库变更，不等于安全 schema 设计。
- 反例 6：错法：AOT/trim 能 publish 就算通过。对法：目标 RID 运行关键路径，逐条处理 IL2xxx/IL3xxx。根因：反射/动态代理/序列化常在运行期失败。
- 反例 7：错法：I/O 卡顿就包 Task.Run。对法：改真正 async API，传 cancellation，限制并发。根因：Task.Run 会消耗线程池并放大饥饿。
- 反例 8：错法：DI 报 scoped 错就改 singleton。对法：修 lifetime、scope factory、ValidateScopes。根因：DbContext/Scoped 服务跨请求复用会污染状态并引发并发错误。
- 反例 9：错法：后台任务在 StartAsync 里 while true。对法：用 BackgroundService ExecuteAsync，循环 await delay，接 cancellation，StopAsync drain。根因：Host 启动被阻塞且无法优雅停机。
- 反例 10：错法：HttpClient 每次 new 或把用户 header 放 singleton client。对法：用 IHttpClientFactory/typed client，请求级 header，配置 handler lifetime。根因：连接池/DNS/用户态状态生命周期混乱。
- 反例 11：错法：NuGet 升级只看顶层包。对法：查 transitive、lock file、source mapping、advisory、breaking changes。根因：实际运行资产由依赖闭包和包源共同决定。
- 反例 12：错法：CORS 报错就 AllowAnyOrigin/AllowCredentials。对法：按域名白名单、方法/头、预检和凭证策略验证。根因：浏览器错误被误当连通性问题，实为认证边界。
- 反例 13：错法：LINQ 错误补 ToList。对法：确认 IQueryable/IEnumerable 边界、SQL 翻译、枚举次数和数据量。根因：延迟执行与 provider 翻译边界不清。
- 反例 14：错法：GC 高就加缓存。对法：用 counters/trace/dump 找分配源、LOH、线程池、容器内存限制。根因：缓存可能增加驻留内存并掩盖泄漏。
- 反例 15：错法：Kestrel 本地可用就报生产可用。对法：验证反代头、端口、证书、limits、timeouts、health check。根因：Host 与代理改变 scheme、client IP、body size 和 TLS 行为。
- 反例 16：错法：Blazor/MAUI 开发机通过就报跨平台完成。对法：按目标浏览器/设备/OS 验证 WASM AOT、静态资源、权限、handler 生命周期。根因：linker、平台 API 和资源路径差异只在目标平台暴露。
- 反例 17：错法：容器启动就算发布成功。对法：目标镜像 smoke、端口/env/health、非 root、只读 FS、diagnostics/temp/data protection keys。根因：dotnet host 与容器文件系统/权限/配置入口不同。
- 反例 18：错法：跨平台乱码/时间错只改业务格式化。对法：确认 encoding provider、CultureInfo、TZ/ICU、证书 store、路径大小写。根因：运行时全球化和 OS 基础设施不是业务层格式问题。
- 反例 19：错法：Controller 直接接收 EF Entity，前端传什么就 Update。对法：输入 DTO、Domain、Entity、Response DTO 分离，白名单映射并验证敏感字段。根因：mass assignment 会改 tenant、role、status、concurrency、导航属性等内部字段。
- 反例 20：错法：Minimal API 参数绑定没声明来源，测试只发正常 JSON。对法：验证 route/query/header/body/form/service 绑定、ModelState/validation、错误 ProblemDetails 和 OpenAPI。根因：隐式绑定会因类型、顺序、版本和请求格式变化而跑偏。
- 反例 21：错法：SaveChanges 没抛异常就算成功。对法：检查 affected rows、concurrency token、DbUpdateConcurrencyException、事务提交和审计日志。根因：0 行、并发冲突、软删除/租户过滤都可能让业务未生效却返回成功。
- 反例 22：错法：DbContext 注册 singleton 解决 scope 报错。对法：保持 scoped，用 scope factory 处理后台任务，避免跨线程复用。根因：DbContext 不是线程安全对象，状态跟踪会串请求并造成脏写。
- 反例 23：错法：async void 或 fire-and-forget 发消息/扣款/写库。对法：返回 Task、await、传 cancellation，并给后台工作明确 owner、重试、DLQ 和异常日志。根因：异常不可观测，进程停机或请求结束会丢工作。
- 反例 24：错法：catch Exception 后记录一句日志并返回 OK。对法：按 validation/auth/not found/conflict/concurrency/db/downstream/cancel/timeout 分类映射 ProblemDetails。根因：伪成功会污染客户端状态、审计和重试判断。
- 反例 25：错法：IHttpClientFactory 配了 retry，所有请求都自动重试。对法：只对幂等请求或带 idempotency key 的写请求重试，并限制总耗时。根因：非幂等 POST 重试会重复下单、扣款、发券或发消息。
- 反例 26：错法：Options 缺配置就用空字符串或默认地址。对法：ValidateOnStart 启动失败，列配置来源并测生产 profile。根因：默认值会把请求发到错环境或用弱 secret 运行。
- 反例 27：错法：AOT/trimming warning 不影响 Debug，就忽略。对法：目标 RID publish 后运行关键路径，逐条处理 source generator、reflection 和 serializer 警告。根因：Debug/JIT 成功不能证明裁剪或 Native AOT 运行成功。
- 反例 28：错法：集成测试用 EF InMemory 证明数据库功能。对法：用 Testcontainers/真实 provider 覆盖 migration、约束、事务、并发、SQL 翻译和 N+1。根因：InMemory 不是关系数据库，无法暴露 provider 行为。

## 提交前自检清单

- [ ] 已确认 TFM/SDK、global.json、LangVersion、Nullable、RID、NuGet lock/central package、CI image。
- [ ] 已确认 Host/运行时：Kestrel/IIS/systemd/Windows Service/container/Blazor WASM/MAUI、OS、CPU、GC、文化区、时区、证书、编码。
- [ ] 已定位入口：Program.cs、endpoint、middleware、service、IHostedService、EF query/migration、generator、publish/run。
- [ ] 已全量搜索改动对象的调用方、消费方、测试、配置、路由、迁移、包版本和部署参数。
- [ ] nullable/analyzer/source generator/AOT-trim warning 已逐条处理或说明。
- [ ] 输入 DTO、Domain、EF Entity、Response DTO 已分离；PATCH/局部更新已区分 absent/null/default，不依赖 NRT 推断。
- [ ] ASP.NET Core Minimal API、middleware、Kestrel/YARP、auth、validation、ProblemDetails、OpenAPI 已按证据验证。
- [ ] Minimal API/Controller 参数绑定来源已显式核对；ProblemDetails 对 validation、binding、auth、concurrency、DB 和取消路径已稳定映射。
- [ ] ModelState/endpoint filter/FluentValidation/业务校验路径已覆盖成功、失败、缺字段、类型错误、越权字段和旧客户端样本。
- [ ] EF Core SQL、migration、provider、transaction、N+1、split query、concurrency、旧数据已验证。
- [ ] ExecuteUpdate/ExecuteDelete/raw SQL/Dapper 写操作已验证 WHERE、tenant/scope、soft delete、affected rows、事务和回滚路径。
- [ ] async 成功/异常/取消/超时路径、IHostedService 停机、HttpClientFactory 生命周期已覆盖。
- [ ] DbContext、Scoped service、HttpClient、IOptions、tenant context、ILogger scope 生命周期未跨 singleton/static/request/job 边界泄漏。
- [ ] IHttpClientFactory timeout/retry/circuit/hedging 策略已证明幂等、总耗时、取消传播、header 隔离和敏感日志脱敏。
- [ ] NuGet 可重复 restore、source mapping、transitive advisory、lock file 已检查。
- [ ] CLR/GC/threadpool/memory 性能结论已有 counters/trace/dump/压测证据。
- [ ] AOT/trimming/single-file 已按目标 RID publish 并运行关键路径。
- [ ] Options validation、secret 来源、生产 appsettings、日志脱敏、Authorization/Cookie/token/连接串检查已完成。
- [ ] xUnit/NUnit/MSTest、WebApplicationFactory、Testcontainers 或等价真实 provider 验证已跑；无法跑时明确缺口。
- [ ] Blazor/WASM/MAUI/跨平台任务已在目标平台或明确标未验证。
- [ ] restore/build/test/publish/run/diagnostics 命令、退出码、关键输出已记录。
- [ ] 未留下 secret、宽 CORS、鉴权绕过、敏感日志、生产配置泄漏。
- [ ] 涉测试/回归已联动 tst；所有代码改动最终用 aud 收口。

## 2024-2026 新坑速查

- .NET 8 LTS：ASP.NET Core Native AOT 支持扩大但仍是功能子集；Minimal API、source-generated JSON、trim-safe libraries 更适合 AOT。
- .NET 9 STS：云原生、性能、ASP.NET Core OpenAPI、静态资源 fingerprint、diagnostics、AOT/trimming 行为需按 release notes 核实。
- .NET 10 LTS：C# 14、ASP.NET Core 10、EF Core 10、MAUI 10、SDK 测试平台和生成链变化都可能影响 CI、OpenAPI、migration、AOT。
- C# 13/14：new lock、params collections、partial properties、field-backed properties、extension blocks 等语法需确认 LangVersion 与目标 SDK。
- Minimal APIs：typed results、endpoint filters、built-in validation、OpenAPI 生成口径在 8/9/10 间存在版本差异，不能跨版本套结论。
- System.Text.Json：source generation、nullable annotations、schema/strict/duplicate property、PipeReader 支持会改变输入输出和 AOT 兼容性。
- Source generators：incremental generator、options validation、Regex/JSON generator 可改善性能和 AOT，但必须把诊断和生成文件纳入证据。
- AOT/trimming：IsAotCompatible/IsTrimmable metadata、ILLink warnings、动态代理/反射/序列化库兼容性是发布前硬门槛。
- EF Core 8/9/10：ExecuteUpdate/Delete、complex types、JSON/primitive collections、named query filters、split query 行为需按 provider 验证 SQL。
- NuGet：central package management、lock file、package source mapping、SemVer 2、transitive vulnerability audit 共同决定可重复和供应链风险。
- OpenTelemetry：ASP.NET Core、HttpClient、EF instrumentation 容易重复注册或丢 resource attributes；采样策略影响排障证据完整性。
- Containers：SDK container publish 与 Dockerfile 并存；chiseled/distroless/non-root 镜像会暴露 globalization、cert、diagnostics、temp 路径问题。
- 跨平台：Linux ICU/globalization invariant、TZ data、证书 store、默认编码、路径大小写、文件锁差异仍是 .NET 线上常见坑。
- Blazor/WASM：WASM AOT、静态资源 fingerprint、浏览器限制和 trimming 组合问题需要浏览器控制台与网络面板证据。
- MAUI：.NET 9/10 workload、AOT/trimming、平台权限、handler lifecycle、原生依赖签名都必须按目标平台验证，超出 .NET 实现边界时联动移动端技能。

## 与相邻技能的边界

- API 工程/api-engineering（api）：负责资源建模、URL/method、状态码、版本、错误体、认证授权语义和 OpenAPI 契约；dotnet-dev 只负责 ASP.NET Core endpoint、binding、metadata、middleware、ProblemDetails 的实现证据。
- 数据库工程/database-engineering（db）：负责 schema、索引、迁移策略、SQL、事务模型、Redis 和数据一致性；dotnet-dev 只负责 EF Core/ADO.NET 实现、provider SQL、DbContext lifetime、migration 执行证据。
- 后端工程/backend-engineering（be）：负责后端架构、服务拆分、中间件选型、配置传播、运行平台协同；dotnet-dev 只负责 .NET Host、DI、Options、Kestrel、IHostedService、runtime 行为。
- Web 安全/web-security（wsec）：负责 Web 风险建模、OWASP、漏洞验证和修复优先级；dotnet-dev 只负责 ASP.NET Core auth/CORS/CSRF/headers/secret/logging 的实现侧修复证据。
- 发布部署/release-engineering（rls）：负责发布流程、灰度、回滚、制品替换、生产验证；dotnet-dev 只负责 dotnet publish、AOT/trimming、runtime image、container entrypoint 的技术证据。
- 测试验证/test-engineering（tst）：负责测试矩阵、回归策略、覆盖判断、CI gate；dotnet-dev 只提供 xUnit/NUnit/MSTest、WebApplicationFactory、Testcontainers、dotnet test 等 .NET 测试实现证据。
- 代码审计/code-audit（aud）：负责最终需求对账、影响面、安全质量和风险收口；dotnet-dev 完成任何非纯 UI 代码/配置/接口/数据/安全改动后必须交其复核。
- 研究调研/research（rsch）：负责查官方 docs、release notes、CVE/advisory、版本敏感行为；dotnet-dev 不凭记忆断言 .NET 8/9/10 或 2024-2026 新 API。
- 项目学习/project-learning（pl）：陌生 .NET 项目先用它梳理模块、入口、构建、部署和约定；dotnet-dev 接手具体 .NET 实现排障。
- 可观测性/observability（obs）：负责 SLI/SLO、采样、告警、仪表盘和事故复盘；dotnet-dev 只负责 ILogger、ActivitySource、Meter、OpenTelemetry instrumentation 的代码侧证据。