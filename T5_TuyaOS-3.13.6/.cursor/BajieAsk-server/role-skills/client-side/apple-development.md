---
name: apple-development
description: Apple原生开发实战排障版 - iOS 17/iOS 18/iOS 19/macOS/watchOS、Swift 5.9/Swift 6、SwiftUI/UIKit/AppKit、Xcode、SPM/CocoaPods、签名证书、Provisioning Profile、Info.plist/entitlements、Privacy Manifest、MainActor/async/await、Keychain/APNs/StoreKit 2、TestFlight/App Store Review/App Store 审核、Crash/MetricKit 排障。操作 .swift/.xib/.storyboard/Info.plist/.entitlements 或 Apple 平台原生能力时必须使用。
alwaysApply: false
---

# Apple 开发实战排障版

定位：把 Apple 原生开发任务收敛成可落地、可验证、可审计的排障流程。覆盖 iOS 17、iOS 18、iOS 19、macOS、watchOS，Swift 5.9、Swift 6，SwiftUI、UIKit、AppKit，Xcode、SPM、CocoaPods，签名、权限、隐私、StoreKit 2、APNs、Push、BackgroundTasks、Keychain、Crash Organizer、Crashlytics、MetricKit、TestFlight、App Store Review。

## 快速总则：版本 / 平台 / 入口 / 证据

1. 版本先定：明确最低系统、目标系统、Xcode、Swift 语言模式、SDK 版本；新 API 必须写 iOS/macOS/watchOS 可用性与 fallback。
2. 平台先分：iOS、macOS、watchOS 生命周期、权限、后台、沙盒、UI 框架不混用；macOS 额外核 sandbox、notarization、菜单/窗口；watchOS 额外核扩展限制、耗电、连接时序。
3. 入口先搜：改页面、权限、Info.plist、entitlements、配置、StoreKit、APNs、Keychain 前，全量搜调用方、消费方、扩展 target、脚本和 CI 配置。
4. 证据先拿：编译错误、运行日志、Crash 堆栈、MetricKit、Crashlytics、Instruments、Console、Device Logs、TestFlight 反馈、App Store Review 拒信必须作为结论依据。
5. UI 默认主线程：SwiftUI/UIKit/AppKit 状态更新默认 MainActor；跨 actor、callback、delegate 回 UI 必须显式收口。
6. 并发默认结构化：新代码优先 async/await，避免 Task.detached 滥用；共享可变状态用 actor、锁或主线程隔离，不靠“看起来串行”。
7. 安全默认最小化：Token、密钥、会话只进 Keychain；日志禁 Authorization、cookie、手机号、身份证、支付凭证；ATS 不能粗暴关闭。
8. 权限三件套：运行时代码、Info.plist Usage Description、entitlements/Provisioning Profile 必须一致；拒绝态、受限态、设置页回流必须处理。
9. 购买不信客户端：StoreKit 2 客户端负责体验，权益真相源按业务风险放服务端验证；必须处理恢复、退款、撤权、finish、交易监听。
10. 结论分四档：已验证、部分验证、无法验证、需补证据；未跑真机/Release/TestFlight/审核链路不能说全通过。

## 场景执行卡

### 1. SwiftUI 页面、导航、状态

- 输入：最低系统、目标设备、状态源、导航栈、数据加载入口、是否桥接 UIKit/AppKit。
- 动作：核 @State/@Binding/@StateObject/@ObservedObject/Observable 所有权；ForEach 使用稳定 id；body 禁副作用；.task 绑定生命周期；新 API 加 availability。
- 证据：预览不算完成，至少真机或 Simulator 跑主路径；截图/录屏、日志、无障碍检查结果。
- 易炸点：把传入模型写成 @State、重复创建 ViewModel、嵌套 NavigationStack、sheet 状态竞争、刷新后任务回写已销毁视图。

### 2. UIKit / AppKit / SwiftUI 混合

- 输入：宿主控制器/窗口、delegate/dataSource、生命周期、状态同步方向、线程边界。
- 动作：桥接层只做必要适配；明确 coordinator 所有权；observer、Notification、Timer、KVO、delegate 成对释放；AppKit 核窗口关闭、菜单、快捷键、坐标系。
- 证据：多次打开关闭、前后台、多窗口、主副屏、不同缩放比例验证。
- 易炸点：UIViewControllerRepresentable 重复创建、AppKit window 被提前释放、delegate 强引用循环、UIKit callback 非主线程更新 SwiftUI。

### 3. 权限、Info.plist、entitlements、签名

- 输入：权限类型、target 列表、capability、bundle id、team、certificate、Provisioning Profile、Info.plist、entitlements。
- 动作：Usage Description 写清真实用途；capability 与 entitlement 与代码三方一致；Debug/Release/TestFlight profile 分开核；扩展 target 逐个核。
- 证据：首次授权、拒绝、受限、系统设置关闭后回流、真机签名安装、导出 archive 日志。
- 易炸点：主 App 有 entitlement 但 Extension 没有；profile 未刷新；证书过期；权限文案与审核说明不一致。

### 4. 网络、登录态、Keychain、安全

- 输入：URLSession 封装、认证 header、刷新 token、证书策略、ATS、日志、Keychain access group。
- 动作：HTTP 状态码和业务错误都检查；超时、取消、重试、401 刷新、并发刷新去重；敏感数据进 Keychain；Keychain 访问组与 entitlements 对齐。
- 证据：弱网、离线、超时、401/403、token 过期、重装/升级、设备锁定态测试。
- 易炸点：UserDefaults 存 token、日志打印 header、ATS 全局放开、Keychain item 因 access group 或 accessibility 读不到。

### 5. 本地数据、SwiftData/Core Data、迁移

- 输入：模型版本、旧数据样本、迁移路径、线程/actor、共享容器、敏感字段。
- 动作：Codable 默认值与兼容解码；Core Data context 不跨线程；SwiftData 变更准备迁移；App Group 路径和文件保护级别明确。
- 证据：首次安装、覆盖安装、老版本升级、异常数据、清缓存、低存储空间。
- 易炸点：新增非可选字段导致旧数据崩溃、后台 context 回主线程对象混用、watch/iOS 共享数据同步时序错误。

### 6. 并发、MainActor、后台任务

- 输入：任务生命周期、取消点、共享状态、主线程需求、后台能力、BGTask identifier。
- 动作：UI 入口标 MainActor 或主线程跳转；长任务支持取消；跨 await 后重检状态；BGTask 配 Info.plist、调度、过期处理；GCD 与 async/await 混用要有边界。
- 证据：快速进出页面、重复点击、取消、后台切前台、低电量、系统杀进程后恢复。
- 易炸点：Task.detached 读写 UI、actor 隔离被 nonisolated 绕开、Swift 6 strict concurrency 报错被关闭。

### 7. StoreKit 2、订阅、TestFlight、审核

- 输入：商品 id、订阅组、权益源、服务端验真、Sandbox/TestFlight 账号、退款/撤权策略。
- 动作：监听 Transaction.updates；验证 transaction；处理 finish、restore、pending、revoked、expired、billing retry；恢复购买入口可见；价格/条款与 App Store Connect 一致。
- 证据：Sandbox、TestFlight、购买、恢复、续费、退款、跨设备、断网恢复、审核账号。
- 易炸点：只测 StoreKit Configuration，不测 Sandbox/TestFlight；不 finish；退款后不撤权；App Store Review 找不到恢复入口。

### 8. APNs、通知、后台、Live Activities、Widget/Extension

- 输入：APNs 环境、topic、device token、entitlements、推送 payload、后台模式、App Group、Extension target。
- 动作：开发/生产证书和 topic 区分；token 上报去重；静默推送按系统预算设计；Live Activities 生命周期与更新源明确；Widget 用快照思维。
- 证据：真机推送、前台/后台/杀进程、权限拒绝、低电量、锁屏、扩展内存限制。
- 易炸点：APNs sandbox/prod 混用、payload 超限、content-available 期望实时、扩展直接复用主 App 重逻辑。

### 9. Xcode、SPM、CocoaPods、构建与依赖

- 输入：Xcode 版本、Package.resolved、Podfile.lock、build settings、schemes、CI、架构、deployment target。
- 动作：锁依赖版本；SPM/CocoaPods 二选一冲突要清楚；检查 arm64/x86_64、Debug/Release、签名配置、隐私清单打包；清理 DerivedData 只作诊断不当修复。
- 证据：xcodebuild 命令、archive/export 日志、CI job、依赖锁文件 diff。
- 易炸点：本地 Xcode 与 CI 不一致、SPM binary target 缓存坏、Pods 脚本相位顺序、模拟器可编真机不可编。

### 10. Crash、性能、MetricKit、Crashlytics、Instruments

- 输入：crash log、dSYM、设备、系统、版本、操作路径、MetricKit payload、Crashlytics issue、内存图。
- 动作：先符号化；按主线程阻塞、内存泄漏、OOM、启动、掉帧、线程竞争分类；性能用真机 Release 和 Instruments；修复后回原路径复验。
- 证据：符号化堆栈、os.Logger、signpost、Time Profiler、Leaks、Allocations、Thread Sanitizer、MetricKit 指标对比。
- 易炸点：未上传 dSYM、只看模拟器、凭体感说优化、闭包/Timer/Task/observer 强引用导致泄漏。

### 11. App Store Review、Privacy Manifest、发布

- 输入：审核拒信、隐私政策、Privacy Manifest、Required Reason API、SDK 隐私清单、账号、IAP、登录、权限、加密出口。
- 动作：核实际行为与 App Privacy、Info.plist 文案、PrivacyInfo.xcprivacy、第三方 SDK 声明一致；TestFlight 冒烟；审核账号和恢复购买可用。
- 证据：拒信条款、截图/录屏、App Store Connect 配置、archive 内容、隐私清单扫描结果。
- 易炸点：SDK Required Reason API 漏声明、权限用途夸大、登录墙无必要、IAP 恢复不可见、测试账号不可用。

## 高频坑 / 防遗漏

- 改权限只改代码，漏 Info.plist、entitlements、Provisioning Profile、审核文案。
- 改 target 只看主 App，漏 Widget、Watch App、Share Extension、Notification Extension。
- SwiftUI 状态所有权错，把外部状态复制成本地状态。
- UIKit/AppKit delegate、observer、Timer、Task 没释放。
- Swift 6 并发错误靠降级语言模式或 unchecked Sendable 压掉。
- async/await 回来后对象已销毁仍写 UI。
- Keychain access group、iCloud Keychain、ThisDeviceOnly、锁屏可用性未区分。
- APNs 开发/生产环境、topic、bundle id、证书/密钥混用。
- StoreKit 2 不处理 pending、revoked、expired、refund、restore。
- App Store Review 只按开发者路径测，没测审核账号、无账号、拒绝权限、恢复购买。
- Xcode 本地绿但 CI 红，原因是 Xcode、Ruby、CocoaPods、SPM 缓存或签名环境不一致。
- Privacy Manifest 只写自家 API，漏第三方 SDK 和 Required Reason API。
- dSYM 未上传导致 Crashlytics/MetricKit 无法定位。
- macOS sandbox、notarization、hardened runtime、文件访问权限漏配。
- watchOS 把 iOS 后台/网络/传感器假设直接套用，导致耗电或被系统挂起。

## 输出要求

每次 Apple 原生任务输出必须包含：

1. 场景卡：命中哪一类，为什么。
2. 版本/平台：iOS 17/iOS 18/iOS 19/macOS/watchOS、Xcode、Swift 5.9/Swift 6、真机/模拟器/TestFlight 条件；不确定写需验证。
3. 入口与影响面：已查 target、文件、调用方、消费方、配置、扩展；未查写缺口。
4. 证据：编译、测试、日志、Crash、Instruments、MetricKit、Crashlytics、截图/录屏、审核拒信；未跑不得说通过。
5. 风险点：权限、签名、隐私、并发、生命周期、存储、购买、推送、审核、兼容中的具体风险。
6. 修改/建议：最小必要动作；不借机重构无关模块。
7. 验证方案：正常、异常、拒绝权限、弱网、后台、升级、旧系统、真机、Release/TestFlight。
8. 联动技能：涉及测试/发布/API/性能/安全/设计时说明已联动或需联动；代码改动完成前由 code-audit 收口。

## 约束

- 不把 WWDC/博客记忆当证据；版本、API、审核规则不确定必须查官方或标需验证。
- 不读、不改无关模块；改接口、字段、配置、target、entitlement 前必须搜全量引用。
- 不用 UserDefaults、日志、剪贴板、URL query 存敏感凭证。
- 不粗暴关闭 ATS、并发检查、沙盒、签名校验、App Transport/Privacy 要求。
- 不把 Simulator 结果当真机结论；不把 Debug 当 Release/TestFlight 结论。
- 不把 StoreKit 本地配置通过当生产购买链路通过。
- 不把代码审计通过包装成 App Store 可过审；审核、发布、线上监控需单独证据。
- 不默认引入第三方库；优先 Apple 原生 API，确需引入时说明 SPM/CocoaPods、隐私、体积、维护风险。
- 不输出 admin key、证书私钥、profile 内容、token、崩溃日志中的敏感数据。

## 高频 Bug 反例库

- 反例 1：iOS SwiftUI 状态错位
  - 错法：把父级传入模型复制到 @State，保存后列表和详情不一致。
  - 对法：用 @Binding、Observable 或单一 ViewModel 作为状态源。
  - 根因：SwiftUI 视图可重建，状态所有权错会制造旧快照。
- 反例 2：UIKit 回调后台线程更新 UI
  - 错法：URLSession completion 里直接 reloadData 或改 SwiftUI state。
  - 对法：把 UI 更新收口到 MainActor，再处理生命周期取消。
  - 根因：UIKit/SwiftUI/AppKit UI 线程约束一致，异步回调线程不保证。
- 反例 3：AppKit 窗口和 observer 泄漏
  - 错法：window controller、Notification observer、KVO、Timer 无释放路径。
  - 对法：明确 owner，deinit/关闭窗口时成对移除或 invalidate。
  - 根因：macOS 多窗口生命周期比 iOS 页面栈更长，引用环更隐蔽。
- 反例 4：Swift 6 并发报错被关闭
  - 错法：把 Swift 6 strict concurrency 降级或 unchecked Sendable 全局糊上。
  - 对法：按 MainActor、actor、Sendable、不可变数据拆隔离边界。
  - 根因：编译器报的是潜在数据竞争，不是格式问题。
- 反例 5：Xcode/SPM/CocoaPods 依赖漂移
  - 错法：只改 Package.swift 或 Podfile，不提交 Package.resolved/Podfile.lock，不核 CI Xcode。
  - 对法：锁版本、核 archive、记录 xcodebuild/CI 证据。
  - 根因：本地缓存和 CI 环境差异会让构建不可复现。
- 反例 6：签名证书链不一致
  - 错法：certificate、Provisioning Profile、bundle id、entitlements 有一项不匹配还反复清缓存。
  - 对法：从 target capability 到导出 archive 逐项核对。
  - 根因：签名是证书、profile、team、entitlement 的组合约束。
- 反例 7：Info.plist 与 entitlements 漏 target
  - 错法：主 App 配了相机或 App Group，Extension/watchOS target 未配。
  - 对法：逐 target 核 Info.plist、entitlements、capability、运行时代码。
  - 根因：每个 target 独立签名和权限声明。
- 反例 8：Privacy Manifest 漏 Required Reason API
  - 错法：用了 UserDefaults、文件时间戳、磁盘空间或三方 SDK，却没声明 Privacy Manifest。
  - 对法：扫描自研和 SDK API，补 PrivacyInfo.xcprivacy 与用途说明。
  - 根因：App Store Review 会按二进制和 SDK 隐私清单核对。
- 反例 9：权限拒绝态崩溃或卡死
  - 错法：相机/定位/通知被拒后继续走成功路径。
  - 对法：覆盖首次、拒绝、受限、设置页关闭后回流。
  - 根因：权限状态不是布尔成功/失败，系统可随时改变。
- 反例 10：App Store Review 找不到恢复购买
  - 错法：订阅页只放购买按钮，恢复入口隐藏或依赖登录后才出现。
  - 对法：恢复购买入口清晰可达，审核账号可完成验证。
  - 根因：IAP 审核要求用户能恢复既有权益。
- 反例 11：StoreKit 2 只信客户端
  - 错法：客户端验证通过就永久发权益，不处理退款、撤权、跨设备同步。
  - 对法：监听交易更新，处理 revoked/expired，按业务风险服务端验真。
  - 根因：客户端状态可滞后，权益需要可追溯真相源。
- 反例 12：APNs 环境混用
  - 错法：TestFlight/生产用 sandbox token 或 topic 不匹配，推送随机失败。
  - 对法：按环境区分 APNs endpoint、topic、bundle id、token、证书/密钥。
  - 根因：APNs token 与环境、topic、bundle 强绑定。
- 反例 13：后台任务当定时器
  - 错法：期望 BGTask 或静默推送按分钟准时执行。
  - 对法：按系统预算设计可恢复任务，提供前台兜底和过期处理。
  - 根因：iOS/watchOS 后台执行由系统调度，不保证实时。
- 反例 14：Keychain 升级后读不到
  - 错法：改 bundle id、access group、accessibility 后不迁移旧 item。
  - 对法：核 access group、同步策略、锁屏态、升级迁移和错误码。
  - 根因：Keychain item 受访问组和保护级别约束。
- 反例 15：Crash 无法符号化
  - 错法：Crashlytics 有崩溃但没 dSYM，靠地址猜原因。
  - 对法：上传 dSYM，结合 MetricKit、设备日志和符号化堆栈定位。
  - 根因：无符号表只能看到地址，无法可靠归因。
- 反例 16：MetricKit 只看均值
  - 错法：只看平均启动时间，忽略 hang、OOM、p95 和设备分布。
  - 对法：按版本、设备、系统、p95/p99、MXCrashDiagnostic/MXHangDiagnostic 分析。
  - 根因：性能和稳定性问题常集中在尾部和特定设备。
- 反例 17：watchOS 套 iOS 假设
  - 错法：把 iOS 网络轮询、后台刷新、动画复杂度搬到 watchOS。
  - 对法：按 watchOS 电量、连接、交互短时性设计。
  - 根因：watchOS 资源和后台限制更严格。
- 反例 18：macOS 沙盒文件访问漏安全书签
  - 错法：文件选择后只保存 path，下次启动直接读失败。
  - 对法：使用 security-scoped bookmark 并处理失效更新。
  - 根因：macOS sandbox 文件授权不是永久路径权限。

## 提交前自检清单

- [ ] 已确认远端 raw 为唯一来源，未读取/创建/修改本地 skills 文件，未使用本地 SQLite。
- [ ] 行数 < 500，且无 fenced code block。
- [ ] H1 为“Apple 开发实战排障版”，且已覆盖快速总则、场景执行卡、高频坑/防遗漏、输出要求、约束、反例库、2024-2026 新坑速查、边界。
- [ ] 高频 Bug 反例库不少于 10 条，覆盖 iOS、macOS、watchOS。
- [ ] 已覆盖 Swift 5.9、Swift 6、SwiftUI、UIKit、AppKit、Xcode、SPM、CocoaPods。
- [ ] 已覆盖 Info.plist、entitlements、Provisioning Profile、certificate、签名和证书链。
- [ ] 已覆盖 Privacy Manifest、权限/隐私、App Store Review、TestFlight。
- [ ] 已覆盖 MainActor、async/await、内存/生命周期、后台任务、APNs、Keychain、StoreKit 2。
- [ ] 已覆盖 Crashlytics、MetricKit、Crash/性能证据。
- [ ] 输出要求包含版本/平台/入口/证据，未验证项必须显式标缺口。
- [ ] 涉测试或回归按 test-engineering 口径给场景与证据；最终按 code-audit 口径收口。

## 2024-2026 新坑速查

- iOS 17：SwiftData、Observation、TipKit、Widget/StandBy 等能力易与最低系统混淆；新 API 必须 availability + fallback。
- iOS 18：权限、隐私、App Intents、Control/Widget、StoreKit 和系统 UI 变化需按目标 SDK 复核；不要把 beta/新系统行为外推到 iOS 17。
- iOS 19：新 SDK、审核规则、隐私/权限、AI/Intents/Widget/StoreKit 行为在未查官方前一律标需验证，不凭 beta 记忆定案。
- macOS：sandbox、notarization、hardened runtime、security-scoped bookmark、菜单/窗口生命周期仍是高频审核和运行坑。
- Swift 5.9 到 Swift 6：strict concurrency、Sendable、actor isolation 把数据竞争前移到编译期；不要靠降级绕过。
- Xcode 15/16：目标 SDK、签名导出、模拟器 runtime、SPM 缓存、Privacy Manifest 打包口径变化会造成“本地绿 CI 红”。
- Privacy Manifest：Required Reason API、自研代码、SPM/CocoaPods SDK、binary framework 都要核；缺声明可能直接审核失败。
- App Store Review：账号、恢复购买、隐私政策、权限用途、外部支付、内容审核、登录墙和 IAP 条款必须与实际行为一致。
- StoreKit 2：pending、refund、revocation、subscription status、transaction updates 与服务端通知需要一起设计。
- APNs：HTTP/2/3、token auth、topic、push type、collapse id、sandbox/prod 环境混用仍常见。
- BackgroundTasks：BGTaskScheduler 不是定时器；identifier、Info.plist、后台模式、过期处理、系统预算和前台兜底都要证据。
- MetricKit/Crashlytics：dSYM、版本号、build number、采样窗口、用户路径缺失会让 crash/卡顿无法闭环。
- SPM/CocoaPods：binary target 签名、隐私清单、post_install、架构 slice、lockfile 漂移影响可复现构建。
- TestFlight：IAP、推送、签名、后台、权限弹窗与本地 Debug 不同；发布前必须单独冒烟。

## 与相邻技能的边界

- apple-development 负责：Apple 平台原生实现、排障、签名、权限、隐私、StoreKit、APNs、Keychain、Crash/MetricKit、Xcode 构建线索。
- design-director/ui-architect/ui-design 负责：产品视觉方向、信息架构、复杂交互、设计系统；Apple 技能只落实原生约束和可实现性。
- api-design/backend-engineering 负责：接口契约、认证语义、服务端验真、推送服务、订阅通知、配置与后端发布。
- db-design 负责：服务端表结构、迁移、事务、一致性；本技能只处理本地数据和 Apple 客户端存储约束。
- perf-engineering 负责：跨端性能策略、SLO、系统性优化；本技能提供 Instruments、MetricKit、真机证据。
- release-engineering 负责：CI/CD、灰度、回滚、监控、发版；本技能提供 archive、TestFlight、签名、审核侧证据。
- test-engineering 负责：测试矩阵、覆盖结论、CI 证据；本技能提供 Apple 场景风险输入。
- code-audit 负责：改动后的需求对账、影响面、安全质量复盘；任何非纯 UI 代码改动完成前必须最终收口。
