---
name: android-development
description: Android 原生开发实战排障技能。用于 Kotlin/Java、Gradle/AGP、Compose、Activity/Fragment、Lifecycle、Coroutines/Flow、Room、Retrofit/OkHttp、权限/后台限制、Android 14/15/16 行为变更、Play targetSdk、R8/ProGuard、ANR/Crash/Perfetto/Logcat 的定位、修改、验证与发布前收口。
---

# Android 开发

Android 开发（android-development，兼容 slug: andr）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

## 快速总则

- 先钉证据：真机品牌/型号/ABI/RAM/屏幕形态、Android API、targetSdk/minSdk/compileSdk、厂商 ROM、安全补丁、Play services/WebView、权限和电池策略状态。
- 先读链路：入口 Activity/Fragment/Composable、ViewModel、Repository、Room/Retrofit/OkHttp、WorkManager/Service、Manifest、Gradle/AGP、R8/ProGuard、测试与发布配置。
- 先复现再改：最小步骤、账号/角色、冷/热启动、横竖屏、分屏/折叠屏、前后台、升级安装、清数据、弱网、release/debug 差异必须记录。
- 日志不缺席：Logcat 按 pid/tag 过滤，Crash 堆栈、ANR traces、tombstone、StrictMode、Perfetto/FrameTimeline、Room migration、OkHttp EventListener、WorkManager diagnostics 按场景补齐。
- Android 端结论只覆盖端侧实现和端侧契约消费；接口语义、服务端状态机、支付风控、云端推送可达率、运营策略必须转相邻技能。
- 无复现路径、无关键日志、无版本矩阵时，只能输出补证清单和风险判断，不能宣称已修复。

## 单技能工程门禁

- 需求落地前先画端侧闭环：入口、UI 状态、ViewModel 事件、Repository、网络/本地缓存、权限/后台、错误态、空态、重试、埋点、测试和 release 验证缺一项就标风险。
- 任何 Android 改动都要说明是否影响 Manifest、权限、Activity/Fragment/Composable 生命周期、协程 scope、Room schema、R8、flavor、签名、旧系统和厂商 ROM。
- 涉及用户数据、文件、位置、相机、蓝牙、通知、后台任务时，必须同时给授权拒绝态、设置页关闭态、升级安装态、清数据态和低端真机证据。
- 涉及网络或登录态时，必须同时检查 timeout、取消、401 刷新互斥、重试幂等、错误分类、token/PII 日志脱敏和 release 日志开关。
- 涉及 Compose 或 ViewModel 时，必须确认状态所有权、单向数据流、一次性事件、配置变更恢复、进程重建恢复和页面离开后的异步取消。
- 涉及数据库或缓存时，必须确认旧版本迁移、默认值、索引、事务、降级策略、低存储、脏数据和 Room migration test；只测新装不算通过。
- 涉及构建发布时，必须确认 debug/release、minify/R8、resource shrink、flavor、ABI、mapping/native symbols、签名来源和低端/旧系统安装运行。
- 如果无法拿到真机、release 或旧系统证据，最终结论只能写“未完成 Android 发布级验证”，不能写“已上线级可用”。

## 硬禁止与低级错拦截

- 禁止只测 emulator/debug 后宣称 Android 端完成；至少按风险补真机、release 或 profile 构建证据。
- 禁止 Activity/Fragment context 被单例、Repository、Adapter、静态对象、长生命周期协程或第三方 SDK 回调持有。
- 禁止在 Composable 正文里直接做网络、DB、IO、注册监听、写全局状态或启动不可控协程；副作用必须放到合适 Effect 或 ViewModel。
- 禁止裸 collect Flow、GlobalScope、runBlocking 主线程、吞掉 CancellationException、页面退出后继续回调 UI。
- 禁止权限只写 Manifest 或只弹请求框；必须处理拒绝、永久拒绝、设置页关闭、系统版本差异和用户可理解兜底。
- 禁止通知只建渠道不请求 POST_NOTIFICATIONS；Android 13+ 必须验证权限拒绝和渠道关闭，Android 8+ 必须验证 channel 行为。
- 禁止后台任务绕过系统限制硬拉 Service；FGS、WorkManager、exact alarm、厂商后台策略必须按用户可见性和系统语义选择。
- 禁止直接读写公共路径、滥用 MANAGE_EXTERNAL_STORAGE、暴露 file://；用户选文件走 SAF/Photo Picker，共享走 FileProvider/content://。
- 禁止 release 打印 Authorization、Cookie、token、手机号、身份证、精确定位、文件路径敏感片段、签名配置和 keystore 信息。
- 禁止 Room 生产使用 destructive migration；禁止只改 Entity 不补 Migration、旧库样本和 DAO/Repository 调用方验证。
- 禁止 R8 失败后全包 keep 或关闭 minify 逃避问题；必须定位反射、序列化、DI、Room、Retrofit、JNI、WebView bridge 的最小 keep。
- 禁止 flavor/buildType 只改当前开发变体；多渠道、mock/prod、debug/release、applicationId、manifestPlaceholders 和资源覆盖要查全。

## 场景执行卡

### 架构 / 模块化 / DI

- 查：模块依赖方向、feature/data/domain/ui 边界、Repository 职责、状态容器、Hilt/Dagger/Koin scope、KSP/KAPT 生成、测试替换入口、循环依赖。
- 做：UI 不持有数据源和业务规则；跨模块只依赖稳定接口；DI scope 与 Activity/ViewModel/Singleton 生命周期一致；Worker、Receiver、EntryPoint 注入路径显式；生成代码和 R8 keep 有 release 验证。
- 验：单模块 assemble、clean release、进程重建、重复进入退出、测试 fake 注入、minify 后启动和关键链路。

### Activity / Fragment / Navigation / Lifecycle

- 查：launchMode、taskAffinity、deep link、Fragment transaction 时机、savedState、ViewModel scope、onNewIntent、配置变更、进程重建。
- 做：UI 状态进 ViewModel/SavedStateHandle；监听、Adapter、binding、launcher 注册释放成对；Fragment 事务只在安全生命周期提交；返回栈和 deep link 有回归。
- 验：旋转、分屏、折叠屏、低内存杀进程、快速返回、重复进入退出、通知或外链拉起。

### Compose / View UI / Adaptive UI / 状态

- 查：state hoisting、remember/rememberSaveable key、LazyColumn stable key、LaunchedEffect/DisposableEffect key、View/Compose 混用、WindowInsets、IME、TalkBack、动态色。
- 查：WindowSizeClass、WindowLayoutInfo、NavigationSuite、list-detail、自适应网格、fold posture、resizeableActivity、ChromeOS/平板键鼠、predictive back、edge-to-edge、IME/insets。
- 做：Composable 禁主线程 IO/网络/数据库；Flow 使用 lifecycle-aware collect；列表有稳定 key；ViewModel 暴露只读 state；Compose BOM、Compiler、Kotlin、AGP 版本匹配；需要性能证据时开启 Compose compiler metrics。
- 做：布局按窗口尺寸、WindowLayoutInfo 和 fold posture 分支，不按设备名分支；状态不绑定单一 Activity 实例；大屏/折叠屏导航和详情区有降级；返回手势、系统栏、输入法统一处理。
- 验：重组、滚动插删、输入法、edge-to-edge、手机/平板/折叠屏、多窗口、外接键盘鼠标、字体缩放、深色模式、RTL、TalkBack、低端机 jank。

### Coroutines / Flow / 并发

- 查：scope 归属、Dispatcher、取消传播、异常处理、共享流重放、冷/热流、背压、并发刷新 token、数据库观察者。
- 做：生命周期内收集；IO/CPU 分发明确；SupervisorJob 只在明确隔离失败时用；网络/DB 错误分层；Flow 去抖、distinct、缓存策略可解释。
- 验：离开页面取消、重复进入不重复请求、弱网超时、并发点击、后台恢复、异常不吞。

### Retrofit / OkHttp / 登录态 / 上传下载

- 查：baseUrl、OkHttp application interceptor 与 network interceptor 顺序、EventListener 埋点、超时、retry、redirect、TLS/证书链、明文 HTTP、代理、DNS、cache、token 刷新互斥、日志脱敏。
- 查：response.body.close 是否成对、连接池耗尽、MockWebServer 覆盖、缓存头与离线策略、重试幂等边界、重定向跨域和协议降级风险。
- 做：网络错误、HTTP 错误、业务错误分层；401 刷新单飞并处理失败退出；release 不打印 Authorization、Cookie、PII；大文件进后台任务并有通知/取消/断点策略。
- 做：用 EventListener 区分 DNS、connect、TLS、request、response 阶段；只对幂等或明确可重放请求 retry；redirect 必须校验 scheme/host；所有 response body 必须关闭。
- 验：断网、弱网、超时、证书失败、代理、401 并发、cache 命中/过期、redirect、retry、MockWebServer 契约、前后台切换、Android 9+ 明文限制。

### 图片 / Coil / 内存与流畅度

- 查：Coil ImageLoader 生命周期、memory cache、disk cache、key 策略、原图尺寸、downsample、Bitmap config、硬件位图、列表预取、占位图、失败图、Compose/RecyclerView 生命周期取消。
- 做：按容器尺寸 downsample，禁止在列表加载超大原图；memory/disk cache 大小与清理策略可解释；页面离开和 item 复用时取消请求；OOM 与 jank 用 heap、Perfetto/FrameTimeline、滚动 benchmark 取证。
- 验：低 RAM、快速滚动、重复进出、网络失败、磁盘低空间、深色模式资源、GIF/视频封面、OOM、GC 抖动、掉帧和占位回退。

### Room / SQLite / DataStore / 文件

- 查：schema version、Migration、索引、事务、DAO 慢查询、Flow 观察、历史数据、并发写、私有目录、MediaStore、SAF、Photo Picker、FileProvider。
- 做：生产禁 destructive migration；迁移覆盖所有旧版本；复杂写入包事务；主线程禁 DB；配置优先 DataStore；分享只用 content://；公共媒体走 MediaStore/Photo Picker。
- 验：旧包跨版本升级、异常脏数据、低存储、权限拒绝、URI 持久授权、卸载/覆盖安装、缓存清理。

### 权限 / Manifest / 后台限制

- 查：运行时权限、永久拒绝、组件 exported、queries、PendingIntent mutability、Receiver exported flag、FGS type、exact alarm、通知权限、厂商后台策略。
- 做：允许/拒绝/永久拒绝/设置页关闭全处理；Android 13+ 通知和媒体权限拆分；Android 14+ FGS type、动态 Receiver 标记准确；后台启动 Activity/Service 有兜底。
- 验：新装、升级、清权限、设置页关闭、锁屏、待机桶、省电模式、国内 ROM 冻结、一键清理。
- 门禁：权限相关需求必须输出权限状态矩阵；只说“已申请权限”无效，必须覆盖拒绝态 UI、再次触发策略、永久拒绝设置页路径、渠道关闭或系统开关关闭后的业务降级。
- 禁止：为省事降低 targetSdk、扩大 exported、放宽 queries、滥用后台启动、绕过通知权限、把厂商后台限制当成“用户环境问题”直接关闭。

### WorkManager / Foreground Service / 通知推送

- 查：任务是否即时、constraints、唯一任务名、重试退避、stopReason、通知渠道 importance、POST_NOTIFICATIONS、FCM/厂商 token、PendingIntent。
- 做：可延迟任务用 WorkManager；用户可感知持续任务才用 FGS；通知渠道语义不可随意改；token 刷新回传可重试；点击链路安全。
- 验：后台、锁屏、断网重连、重启、低电量、权限拒绝、渠道关闭、杀进程、厂商推送差异。
- 门禁：后台链路必须说明“为何不用/为何使用 FGS、为何不用/为何使用 WorkManager、用户是否可感知、失败如何重试、系统杀进程如何恢复”。
- 禁止：把 WorkManager 当即时任务或精确定时器，把 FGS 当无限后台，把通知点击 PendingIntent 做成可被篡改入口。

### 端侧安全 / 隐私 / WebView

- 查：Keystore、加密存储、backup rules、FLAG_SECURE、剪贴板、截图录屏、WebView file access、mixed content、Safe Browsing、JS bridge、Cookie、证书 pinning、第三方 SDK 数据采集。
- 做：token/密钥不进明文 SharedPreferences、日志、Intent、截图；WebView 默认最小权限，JS bridge 只暴露白名单方法；外链和 deep link 做 scheme/host/path 校验；隐私权限与数据安全声明一致。
- 验：root/备份/日志导出风险、WebView 恶意 URL、证书失败、跨域跳转、release 混淆、隐私开关关闭、第三方 SDK 初始化前后数据流。

### 媒体 / 相机 / 蓝牙 / 位置 / 传感器

- 查：CameraX/Media3/Location/BLE/NFC/Sensor API、运行时权限、后台限制、音频焦点、生命周期释放、厂商兼容、功耗和隐私声明。
- 做：硬件能力先做 feature detection；相机/播放器/蓝牙扫描与页面生命周期成对；后台定位/录音/扫描必须有用户可见理由和通知；失败路径可降级。
- 验：权限拒绝、后台/锁屏、来电/音频打断、旋转、低电量、省电模式、无硬件设备、厂商 ROM、长时间运行功耗。

### Android 测试 / Benchmark / Baseline Profile

- 查：local unit、Robolectric、instrumentation、Compose UI test、Macrobenchmark、Baseline Profile、fake server、Test Orchestrator、managedDevices、Roborazzi、Paparazzi、MockWebServer、设备矩阵和 flaky 记录。
- 做：业务规则优先单测；端侧生命周期/权限/Room/导航用 instrumentation 或 Robolectric；Compose 关键交互有语义选择器；截图回归按场景选 Roborazzi 或 Paparazzi；性能问题用 Macrobenchmark/Perfetto，不用主观体感替代。
- 做：CI 需明确 managedDevices API/locale/字体缩放/深色模式矩阵；视觉基线变更必须有设计或需求证据；MockWebServer 覆盖错误码、弱网、重定向和缓存语义。
- 验：debug 与 release/profile 构建、minify、冷启动、滚动、弱网、权限拒绝、覆盖升级、managedDevices、Roborazzi/Paparazzi diff；未跑测试必须说明原因和残余风险。
- 门禁：新增功能至少覆盖业务规则单测或可替代证据、关键 UI/导航/权限路径、错误态/空态/加载态、弱网/超时/取消、release/minify 冒烟；条件不具备时必须写未覆盖风险。
- 禁止：只跑 assemble、只看 emulator、只点 happy path、只测新装、只测当前 flavor、只测 debug 后交付。

### Crash / ANR / 性能 / R8 / 发布 / 可观测性

- 查：release/profileable、主线程阻塞、Binder/锁等待、大图、启动初始化、内存泄漏、电量、baseline profile、mapping、native symbols、R8 keep、资源压缩。
- 查：Crash-free、ANR rate、启动耗时、关键路径 breadcrumb、feature flag、用户操作序列、前后台状态、网络质量、版本/build/渠道/设备分布、mapping/native symbols 上传状态。
- 做：主线程只做轻量 UI；耗时初始化延迟或异步；崩溃按线程/版本/设备聚合；R8 规则按反射/序列化/JS bridge/DI 精准保留；发布保留 mapping 和符号。
- 做：端侧日志结构化并脱敏；崩溃和关键错误带业务场景、request id、页面、实验分组；性能指标区分冷/温/热启动和低端机；线上告警阈值与版本灰度联动。
- 验：Perfetto/FrameTimeline、Macrobenchmark、ANR traces、Crash 堆栈、冷启动、低端机、release minify、Play 预发布报告、灰度聚合、日志脱敏抽样、线上指标一致性。
- 门禁：release 问题必须使用同版本 mapping/native symbols、同 flavor、同 minify/resource shrink、同 ABI 或可解释差异；没有这些证据只能定位到候选原因。
- 禁止：用 debug 堆栈推断 release 崩溃、关闭 R8 当修复、只在高端机测性能、忽略低 RAM/低存储/老 WebView/厂商 ROM。

### Play 合规 / 第三方 SDK / 构建治理

- 查：target API、Data safety、SDK Index、广告 ID、Billing、In-App Update/Review、动态功能模块、version catalog、convention plugins、configuration cache、build cache、CI 缓存。
- 查：Gradle wrapper-validation、spotlessCheck、lint、DependencyGuard、BOM 对齐、binary-compatibility-validator、签名配置来源、signing secrets、依赖锁、许可证和供应链风险。
- 做：依赖升级先查政策和兼容矩阵；隐私数据采集与声明一致；构建逻辑收敛到 convention plugin；KAPT/KSP、R8、资源压缩、签名、mapping 上传在 CI 可复现。
- 做：wrapper-validation 防止 wrapper 被篡改；spotlessCheck 与 lint 阻断格式和静态问题；DependencyGuard 固化依赖漂移；BOM 管理 Compose/Firebase/OkHttp 等族版本；binary-compatibility-validator 守住公开 API；signing secrets 只从受控密钥库或 CI secret 注入且不落库。
- 验：Play pre-launch/report、依赖许可证和 SDK 风险、clean release、配置缓存、增量构建、wrapper-validation、spotlessCheck、lint、DependencyGuard、BOM、binary-compatibility-validator、渠道包、回滚包、灰度指标、签名产物可追溯。

## 高频坑 / 防遗漏

- Kotlin/Java 混编：空安全平台类型、SAM、默认参数、sealed/enum 序列化、Java 反射与 R8 keep 互相影响。
- 架构：模块循环依赖、UI 下沉业务规则、Repository 过胖、DI scope 错配会引发测试困难、重复实例、泄漏或 release 构建失败。
- Gradle/AGP：AGP、Gradle、JDK、Kotlin、KSP/KAPT、Compose Compiler、BOM、binary-compatibility-validator 版本矩阵不匹配会表现为编译、运行或 R8 阶段不同错误。
- Compose：remember key、Lazy item key、Effect key、Snapshot state、ViewModel scope、Compose compiler metrics 任一缺口都会影响状态、性能或定位精度。
- Lifecycle：Fragment view 生命周期和 Fragment 生命周期不同；Activity context 不能被 Repository、单例、Adapter 长持有。
- 权限：targetSdk 升级会改变默认行为；Manifest 声明不等于运行时授权；永久拒绝必须引导设置页但不能循环弹窗。
- 后台限制：WorkManager 不是精确定时器；FGS 不等于无限后台；国内 ROM 的自启动、电池、通知开关必须单独取证。
- Room：只测新装不测升级等于没测；默认值、非空列、索引、外键、触发器和降级路径都要覆盖。
- 网络：OkHttp interceptor 顺序、EventListener 缺失、response.body.close 泄漏、cache/redirect/retry/TLS 边界、并发 token 刷新和日志脱敏常导致 release 才炸。
- 图片：Coil 不做 downsample、memory/disk cache 无边界、页面销毁不取消请求，会放大 OOM、GC 抖动和列表 jank。
- WebView：file access、mixed content、Cookie、JS bridge、外链跳转和下载上传任一放宽都可能扩大攻击面或登录态串用。
- R8/ProGuard：debug 正常不代表 release 正常；反射、序列化、Parcelable、Room、Retrofit、JNI、WebView JS bridge 都可能被混淆影响。
- ANR/Crash：只看 Java 堆栈不够；Binder、锁、IO、native tombstone、主线程同步等待和系统回调超时都要查。
- 硬件媒体：Camera、Media、BLE、Location、Sensor、NFC 要同时验证权限、生命周期释放、设备能力缺失、后台限制和功耗。
- Play/SDK：第三方 SDK 数据采集、广告 ID、Billing、动态功能模块、target API 和 SDK Index 风险必须有依赖清单与数据流证据。
- 构建治理：wrapper-validation、spotlessCheck、lint、DependencyGuard、BOM、managedDevices、签名和 signing secrets 任一缺失都会削弱 CI 可复现性和发布审计。

## 输出要求

- 必报：设备/API/targetSdk/AGP/Gradle/Kotlin/JDK/构建类型、复现步骤、关键 Logcat/Crash/ANR/Perfetto/OkHttp EventListener 证据、影响范围、修改点、验证矩阵。
- 涉代码改动：列出文件、函数/类、调用方/消费方、Manifest/Gradle/R8/资源/测试配置影响；说明为何不会破坏旧 API、旧数据、旧设备。
- 涉网络：列出 application/network interceptor、EventListener、MockWebServer、response.body.close、cache、redirect、retry、TLS/证书和日志脱敏证据。
- 涉图片性能：列出 Coil memory cache、disk cache、downsample、生命周期取消、OOM、jank、Perfetto/FrameTimeline 或 benchmark 证据。
- 涉权限/后台/发布：列出 Android 版本差异、厂商差异、Play targetSdk 或 policy 风险、用户可见兜底。
- 涉构建/发布：列出 wrapper-validation、spotlessCheck、lint、DependencyGuard、BOM、binary-compatibility-validator、managedDevices、signing secrets 来源和产物追溯。
- 涉安全/隐私/WebView/第三方 SDK：列出本地存储、日志、Intent、剪贴板/截图、backup、网络证书、JS bridge、数据采集与开关状态；无数据流证据不得下合规结论。
- 涉测试：列出 local unit、Robolectric、instrumentation、Compose UI、Roborazzi/Paparazzi、Macrobenchmark/Baseline Profile、真机手测、release 构建、R8/minify、升级安装、弱网/前后台/权限拒绝结果；未跑必须标明原因。
- 不确定项：明确写“需补证”，给最短补证命令或操作，不用经验替代证据。

## 约束

- 禁止未读 Manifest、Gradle、调用方、生命周期链路、权限路径、发布配置就改 Android 核心链路。
- 禁止只在模拟器或 debug 上验证后宣称线上修复；Crash/ANR/R8/权限/后台问题至少要 release 或接近 release 构建证据。
- 禁止把接口字段、服务端状态机、DB 迁移、支付规则、推送服务稳定性直接归因于 Android；先用端侧证据定位边界。
- 禁止为了规避 targetSdk 行为变更而降低 targetSdk；Play 要求、隐私权限、后台限制必须正面处理。
- 禁止输出敏感日志、token、Cookie、个人信息、签名密钥、keystore 密码；signing secrets 只描述来源和控制面，不输出值；日志和截图必须脱敏。
- 禁止未经证据把隐私合规、第三方 SDK 风险、证书 pinning 策略、发布灰度结论完全归于 Android；端侧只给实现与取证边界。
- 禁止把截图测试或 managedDevices 结果等同于真机全覆盖；折叠屏、低端机、厂商 ROM、release minify 仍需按风险补证。

## 高频 Bug 反例库

- 反例 1：错法：Fragment 在异步回调里直接 commit。对法：检查 lifecycle state，使用 viewLifecycleOwner 和安全导航事件。根因：状态保存后提交事务会触发状态丢失或崩溃。
- 反例 2：错法：Composable 内直接发起 Retrofit 请求。对法：请求放 ViewModel/repository，UI 只收集状态。根因：重组会重复执行副作用并打爆网络。
- 反例 3：错法：LazyColumn 不写 stable key。对法：用业务唯一 id 作为 key。根因：插删排序后 slot 复用导致状态串行。
- 反例 4：错法：Flow 在 onCreate/onViewCreated 裸 collect。对法：repeatOnLifecycle 或 collectAsStateWithLifecycle。根因：页面停止后仍收集，导致泄漏、重复请求和 UI 越界。
- 反例 5：错法：Room 升级用 destructiveMigration。对法：补齐每个历史版本 Migration 并用旧库样本验证。根因：生产用户数据会被清空且只在覆盖升级暴露。
- 反例 6：错法：401 每个请求各自刷新 token。对法：OkHttp/Repository 层做单飞互斥和失败退出。根因：并发刷新会覆盖新 token、形成风暴或死循环。
- 反例 7：错法：只在 Manifest 写 POST_NOTIFICATIONS。对法：Android 13+ 运行时请求并处理拒绝/关闭渠道。根因：Manifest 声明不产生授权，用户看不到通知。
- 反例 8：错法：Android 14 前台服务不声明 foregroundServiceType。对法：按用途声明权限和 type，非即时任务改 WorkManager。根因：targetSdk 行为收紧会直接抛异常或被系统停止。
- 反例 9：错法：release 崩溃只看源码堆栈。对法：上传 mapping/native symbols，用版本对应文件反混淆。根因：R8 混淆后类名方法名不可读，容易误判。
- 反例 10：错法：ProGuard 为了省事 keep 全包。对法：只对反射、序列化、注解处理、JNI、JS bridge 精准 keep。根因：全量 keep 会放大包体、暴露面和优化损失。
- 反例 11：错法：把 WorkManager 当分钟级定时器。对法：按系统调度语义设计可延迟任务，必要时说明 exact alarm 权限和用户可见理由。根因：Doze、待机桶、厂商策略会合并或延迟任务。
- 反例 12：错法：用 file:// 分享图片或 APK。对法：使用 FileProvider 暴露 content:// 并授予临时权限。根因：Android 7+ FileUriExposedException 且跨应用权限不可控。
- 反例 13：错法：主线程解析大 JSON、读库或解码大图。对法：IO/CPU Dispatcher、分页、采样解码，并用 Perfetto/StrictMode 验证。根因：主线程阻塞导致 jank 或 ANR。
- 反例 14：错法：升级 AGP/Kotlin/Compose 只改一个版本号。对法：按 AGP-Gradle-JDK-Kotlin-Compose Compiler/BOM 矩阵升级并跑 clean release。根因：编译器插件和字节码工具链强耦合。
- 反例 15：错法：Hilt scope 全部标 Singleton。对法：按 ActivityRetained/ViewModel/Activity/Fragment/Singleton 生命周期分层。根因：状态串用、内存泄漏、测试替换困难。
- 反例 16：错法：WebView JS bridge 暴露通用执行方法。对法：白名单方法、来源校验、最小权限、混淆和恶意 URL 验证。根因：H5 可变输入会扩大本地能力暴露面。
- 反例 17：错法：平板适配按设备型号写 if。对法：用窗口尺寸、WindowLayoutInfo、fold posture 和能力分支。根因：多窗口、折叠姿态、ChromeOS 和外接输入会打破设备名假设。
- 反例 18：错法：性能优化只凭肉眼顺滑。对法：Macrobenchmark、Perfetto、FrameTimeline、Compose compiler metrics、线上指标联动。根因：主观体感无法定位冷启动、掉帧、低端机和回归。
- 反例 19：错法：OkHttp response 未关闭或只看业务回调。对法：使用 use/close 并用 EventListener/MockWebServer 验证连接释放。根因：连接池耗尽会表现为偶发超时。
- 反例 20：错法：Coil 列表加载原图且不取消。对法：按目标尺寸 downsample、设置缓存策略并绑定生命周期取消。根因：大图解码会触发 OOM、GC 和 jank。
- 反例 21：错法：CI 只跑 assemble。对法：补 wrapper-validation、spotlessCheck、lint、DependencyGuard、managedDevices 和 release 验证。根因：格式、静态、依赖漂移、设备行为和发布问题会漏检。
- 反例 22：错法：把签名密码写在仓库或日志。对法：signing secrets 只从 CI secret/密钥库注入并校验产物指纹。根因：签名凭据暴露会导致发布链路不可控。
- 反例 23：错法：Repository 保存 Activity context 做 Toast、资源读取或启动页面。对法：只传 Application context 或把 UI 动作上抛给界面层。根因：长生命周期对象持有 Activity 会泄漏窗口和用户数据。
- 反例 24：错法：权限被拒绝后继续走相机/定位/通知 happy path。对法：权限状态驱动 UI，提供降级、设置页入口和再次触发边界。根因：拒绝态才是线上高频路径，忽略会造成空白页、崩溃或误导。
- 反例 25：错法：后台上传用无限 Service 并隐藏通知。对法：按用户可见性选择 WorkManager 或 FGS，通知、取消、重试和 stopReason 都可观测。根因：后台限制和厂商策略会杀任务，用户也无法理解耗电。
- 反例 26：错法：为兼容存储直接申请 MANAGE_EXTERNAL_STORAGE。对法：优先 Photo Picker、SAF、MediaStore、App 私有目录和 FileProvider。根因：权限过宽会触发审核风险，也破坏用户授权预期。
- 反例 27：错法：debug 正常后直接发多 flavor release。对法：逐一验证 prod/mock、渠道资源、manifestPlaceholders、applicationId、签名和 R8。根因：变体覆盖常让真实包指向错环境或缺配置。
- 反例 28：错法：接口失败时 UI 永远 loading 或静默失败。对法：为 loading/error/empty/permission/offline/timeout/token 过期都建状态并回归。根因：端侧状态机不完整会让功能看似已做但用户不可用。
- 反例 29：错法：Room 新增非空字段只改 Entity。对法：Migration 写默认值、索引/外键策略，并用旧库样本跑 migration test。根因：覆盖升级会在真实用户数据上崩溃，新装测不出来。
- 反例 30：错法：release 日志打开 BODY 级别网络日志。对法：按 buildType/flavor 限制日志级别并脱敏 header/body。根因：token、Cookie、手机号、地址和业务数据会进入日志平台或用户导出文件。
- 反例 31：错法：Composable 使用 rememberCoroutineScope 启动长任务且不取消。对法：业务任务进 ViewModel，UI 副作用用 LaunchedEffect/DisposableEffect 并绑定 key。根因：重组和离屏会制造重复任务、错页回调和泄漏。
- 反例 32：错法：低端设备卡顿只减少动画。对法：先用 Perfetto/FrameTimeline/Macrobenchmark 定位主线程、绘制、IO、GC 或图片问题。根因：没有性能证据的修改容易掩盖真正瓶颈。

## 提交前自检清单

- 已拉齐调用方/消费方：Activity、Fragment、Composable、ViewModel、Repository、DAO、Service/Worker、Manifest、Gradle、R8、测试配置。
- 已确认版本矩阵：minSdk、targetSdk、compileSdk、Android 14/15/16、AGP、Gradle、Kotlin、JDK、Compose BOM/Compiler、KSP/KAPT、Hilt/Dagger/Koin。
- 已验证关键路径：新装、覆盖升级、清数据、权限拒绝/永久拒绝、前后台、旋转/分屏、大屏/折叠屏、弱网、release minify、低端真机。
- 已完成单技能闭环：需求入口、UI 状态、ViewModel 事件、Repository、网络/缓存、权限/后台、错误态、空态、重试、日志脱敏、测试和 release 验证都有结论。
- 已排除硬禁止：无 Activity context 长持有、无 Composable 正文副作用、无裸 Flow collect、无 GlobalScope、无明文 token 日志、无 destructive migration、无 file:// 分享。
- 已保留交付证据：Logcat、Crash/ANR 堆栈、Perfetto 或 benchmark 摘要、OkHttp EventListener、测试命令输出、截图/录屏、mapping/native symbols 状态、线上 breadcrumb/版本维度。
- 已检查网络与图片：MockWebServer、cache/redirect/retry/TLS、response.body.close、Coil memory/disk cache、downsample、生命周期取消、OOM/jank 证据齐全。
- 已检查构建治理：wrapper-validation、spotlessCheck、lint、DependencyGuard、BOM、binary-compatibility-validator、managedDevices、signing secrets、签名产物和依赖锁。
- 已做边界确认：接口契约、后端状态、DB 设计、安全评估、发布灰度、SRE 指标、UI 规范需要相邻技能时已移交。
- 已检查端侧隐私安全：本地敏感存储、日志脱敏、WebView/JS bridge、backup、剪贴板/截图、第三方 SDK 初始化和数据流。

## 2024-2026 新坑速查

- Android 14：FGS type、后台启动限制、动态 Receiver exported flag、exact alarm 审核、照片/视频权限路径、非 SDK 接口继续收紧。
- Android 15：edge-to-edge 默认体验、后台启动和 FGS 限制继续收紧、通知/隐私/媒体访问更强调用户可见性，targetSdk 升级必须真机回归。
- Android 16：以开发者预览/正式文档为准核对行为变更；不要凭旧 targetSdk 经验判断权限、后台、窗口、安全策略。
- Play targetSdk：每年 target API 要求会影响新发版和更新；升级前列出权限、后台、存储、通知、SDK 依赖、政策声明风险。
- AGP/Gradle/JDK：AGP 8+ 对 namespace、BuildConfig、资源压缩、JDK、配置缓存、wrapper-validation、DependencyGuard、binary-compatibility-validator 更敏感；老插件和 transform API 可能失效。
- Kotlin/KSP/KAPT：K2、KSP、Room、Hilt、Compose Compiler 组合要看兼容矩阵；注解处理失败不一定是业务代码错。
- Compose：Material3、WindowInsets、predictive back、adaptive layout、baseline profile、Compose compiler metrics 都会影响体验和性能判断。
- 网络：OkHttp EventListener、application/network interceptor、MockWebServer、response.body.close、cache、redirect、retry、TLS 是弱网和 release 问题的关键证据。
- 图片：Coil memory cache、disk cache、downsample、生命周期取消直接影响 OOM、jank、低端机和列表体验。
- 截图测试：Roborazzi/Paparazzi 适合视觉回归，但必须处理字体、locale、深色模式、动态色和基线审核。
- R8：full mode、枚举优化、反射裁剪、泛型签名、序列化字段保留需用 release 构建验证。
- 隐私安全：广告 ID、照片选择器、后台定位、蓝牙/Wi-Fi、通知、剪贴板、无障碍权限都可能触发政策和系统弹窗变化。
- 可观测性：线上 Crash/ANR 要带版本、build number、mapping、设备分布、启动来源、前后台状态和关键 breadcrumb。

## 与相邻技能的边界

- 代码审计/code-audit（aud）：Android 改动完成后用于全量影响面、回归证据、风险清单收口；Android 开发/android-development（andr） 负责端侧定位和实现细节。
- 测试验证/test-engineering（tst）：详细测试矩阵、用例设计、自动化覆盖和回归策略归它；Android 开发/android-development（andr） 保留 Android 特有最低验证和设备/API/场景风险点。
- 移动安全/mobile-security（msec）：加固、逆向、证书 pinning 策略、敏感数据、Root/Hook/Frida、隐私合规证据归它；Android 开发/android-development（andr） 只处理端侧安全实现配合与取证边界。
- API 工程/api-engineering（api）：接口字段、错误码、幂等、分页、认证刷新契约归它；Android 开发/android-development（andr） 只验证 Retrofit/OkHttp 消费和端侧兼容。
- UI 设计实现/ui-design（u）：视觉规范、布局策略、文案、可访问性标准归它；Android 开发/android-development（andr） 负责 View/Compose 落地和设备差异验证。
- 发布部署/release-engineering（rls）：签名、渠道包、CI/CD、Play 发布、灰度、回滚、mapping/symbol 上传归它；Android 开发/android-development（andr） 提供构建和运行证据。
- AutoJS 自动化/autojs-automation（ajs）：通过无障碍/脚本做黑盒自动化、批量设备操作归它；Android 开发/android-development（andr） 不把 Auto.js 当应用内实现方案。
- 后端工程/backend-engineering（be）：服务端逻辑、队列、推送服务、存储、鉴权实现归它；Android 开发/android-development（andr） 只界定端侧请求、缓存和错误处理。
- 可观测性/observability（obs）：线上指标、告警、SLO、日志管线、Crash/ANR 聚合平台治理归它；Android 开发/android-development（andr） 提供端侧埋点、breadcrumb 和版本维度需求。