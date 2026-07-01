---
name: flutter-development
description: Flutter 开发实战排障技能：覆盖 Flutter 3.x、Dart 3、Widget rebuild、状态管理、Navigator 2.0/go_router、PlatformView、MethodChannel、Gradle/Kotlin、CocoaPods、Xcode signing、Firebase、Impeller/Skia、shader jank、deferred components、测试与打包。触发于 .dart、pubspec.yaml、Flutter 页面/路由/状态/插件/跨端/打包/性能问题。
alwaysApply: false
---

# Flutter 开发实战排障版

## 快速总则

1. 先锁证据：必须确认 Flutter 3.x/Dart 3 版本、目标平台、设备/模拟器、Android API、iOS 版本、Gradle/Kotlin、Xcode、CocoaPods、Firebase 与关键插件版本。
2. 先定入口：确认 main/flavor、MaterialApp/CupertinoApp、路由入口、Navigator 2.0/go_router、初始化顺序、目标页面与状态所有者。
3. 先判平台：同一 Dart 代码在 Android/iOS/Web/Desktop 表现可能不同；PlatformView、MethodChannel、权限、后台、键盘、insets 必须按平台验证。
4. 先抓现象：截图/录屏、完整日志、最小复现路径、预期/实际、偶发频率；卡顿必须有 DevTools frame/rebuild/raster 证据。
5. 先查影响面：改 Widget、Provider/Bloc、路由、插件、pubspec、Gradle、Podfile、Info.plist、AndroidManifest 前搜调用方和生成物。
6. build 只渲染：禁止在 build 中网络、IO、注册监听、创建 Future、请求权限、启动动画或写全局状态。
7. 状态统一：Riverpod/Bloc/Provider/GetX 以项目既有方案为准，不为单点问题引入第二套状态模型。
8. 交付闭环：说明改动、影响面、验证命令、真机/模拟器矩阵、未覆盖风险；涉及逻辑/数据/权限后续交给 test-engineering 与 code-audit 收口。

## 场景执行卡

### 1. Widget rebuild / 布局溢出 / 黑屏白屏
- 查父约束、Expanded/Flexible、Intrinsic、ListView/Column 嵌套、Sliver 层级、SafeArea、MediaQuery、键盘 insets。
- 查 rebuild 来源：setState 范围、Consumer/BlocBuilder selector、ValueListenable、AnimationController、StreamBuilder、FutureBuilder 创建位置。
- 证据：报错栈、Widget tree 关键父子、DevTools rebuild 视图、目标设备截图。

### 2. Riverpod/Bloc 状态错乱
- 查 provider/bloc 生命周期、autoDispose、keepAlive、context.read/watch/select、事件去重、异步取消、缓存失效。
- await 后更新 UI 必看 mounted、路由仍在前台、请求序号或 token 是否过期。
- 不把业务状态塞进局部 State，也不把局部输入态提升成全局缓存。

### 3. Navigator 2.0/go_router 路由异常
- 查 redirect 循环、ShellRoute/嵌套路由、deep link、登录态初始化、pop 返回值、页面 key、browser history。
- 鉴权状态未加载完成时不得直接跳登录再跳回，需区分 unknown/authenticated/unauthenticated。
- 输出需列出入口路由、触发路径、重定向条件和回退行为。

### 4. MethodChannel / EventChannel / Pigeon / FFI
- 查 channel name、方法名、参数类型、线程、Activity/Fragment 生命周期、iOS main thread、错误码、超时、重复注册。
- 原生异常必须带 Android logcat 或 Xcode console；Dart 端只看到 PlatformException 不足以定责。
- 涉 BLE、相机、定位、通知、支付时同步检查权限、后台能力和插件版本。

### 5. PlatformView / WebView / Map / Camera
- 查 hybrid composition、Texture、手势竞争、z-order、键盘遮挡、透明背景、页面复用和 dispose。
- iOS 查 UIViewController 层级、WKWebView 配置、相册/相机权限；Android 查 Activity、Fragment、Surface/Texture、混淆。
- 性能问题区分 Dart UI thread、raster thread、平台 view 合成成本。

### 6. Impeller / Skia / shader jank / 动画卡顿
- 确认渲染后端：iOS 默认 Impeller，Android 可能切换；记录 Flutter 版本和启动参数。
- 首帧/转场/列表卡顿用 DevTools frame chart、raster time、shader compilation、图片解码、overdraw 证据定位。
- 不用“加 const”当万能优化；要说明 rebuild、layout、paint、raster、IO 哪一段变好。

### 7. Gradle/Kotlin / CocoaPods / Xcode signing 打包失败
- Android 查 AGP/Gradle/JDK/Kotlin 版本矩阵、namespace、minSdk/compileSdk、NDK、R8、插件 Gradle 配置。
- iOS 查 Xcode、CocoaPods、Podfile platform、deployment target、Swift 版本、Info.plist、entitlements、Team、Provisioning Profile。
- 先读完整错误第一处 root cause，不用清缓存代替分析；清理命令只作为验证步骤。

### 8. Firebase / 推送 / deep link / 远程配置
- 查 firebase_options.dart、GoogleService-Info.plist、google-services.json、bundleId/applicationId/flavor 对齐。
- 推送查前后台/terminated、APNs token、通知权限、Android channel、iOS capabilities、消息 payload。
- deep link 查 universal links/assetlinks、路由初始化时序和冷启动 intent。

### 9. deferred components / 动态特性 / 资源体积
- 查 pubspec deferred components 配置、Android bundle、Play delivery、资源路径、首包/延迟包边界。
- 延迟加载失败要区分下载失败、install 失败、路由提前访问、资源未声明。
- 体积优化需给 APK/AAB/IPA 分析证据，不凭感觉删资源。

### 10. 测试与回归
- Widget test 验状态和布局边界，integration_test 验路由/权限/插件主链路，原生插件需真机验证。
- golden test 必须锁字体、屏幕尺寸、平台差异和 Material 3 主题。
- 涉异步必须测加载、成功、失败、取消、重试、离开页面后返回。

## 高频坑 / 防遗漏

- Material 3 默认主题、颜色、按钮高度、NavigationBar、Dialog、TextField 与旧 Material 行为不同。
- Dart 3 null safety、records/patterns/sealed class 迁移会影响序列化、泛型和 exhaustive switch。
- pubspec 改 assets/fonts 后必须重跑构建；路径大小写在 iOS/Android/macOS 上可能表现不同。
- 图片大图、透明 PNG、Lottie、blur、clip、shadow 容易造成 raster 压力，不等于 Dart 代码慢。
- keyboard insets、SafeArea、系统手势、刘海屏、折叠屏、平板横屏必须单独看。
- iOS 后台、通知、相机、相册、定位、蓝牙权限不只在 Dart 插件配置，还在 Info.plist/entitlements/capabilities。
- Android 13+ 通知权限、Android 14 前台服务/精确闹钟/照片权限变化会让旧插件静默失败。
- Hot reload 不等于冷启动；初始化、路由、Firebase、插件注册问题必须 cold restart 或重装验证。
- 不在多个 Provider/Bloc 间复制同一业务字段，避免刷新一处、展示另一处。
- 生成文件、Pod、Gradle cache、pub cache 可清理验证，但不能把“清缓存”当根因。

## 输出要求

- 必报：Flutter/Dart 版本、目标平台、设备、入口文件/路由、涉及状态方案、插件/原生配置、复现路径。
- 必报：改动文件、关键行、调用方/消费方、影响面、验证命令和结果。
- 性能必报：baseline、工具、关键指标、优化前后对比、未覆盖设备。
- 打包必报：flavor、签名、bundleId/applicationId、构建命令、失败 root cause、最终产物或失败日志。
- 未验证必须标“未验证”，不得把未跑的 flutter test/build/analyze 写成已通过。

## 约束

- 不改与目标无关的架构、状态方案、主题系统、路由系统和插件版本。
- 不在证据不足时升级 Flutter、Dart、AGP、Kotlin、Xcode、CocoaPods 或大版本插件。
- 不绕过签名、权限、审核、隐私提示；不删除平台配置来“让编译过”。
- 不把 Android/iOS 原生问题完全归入 Flutter；跨边界时调用对应相邻技能。
- 不新增本地文档总结，交付信息直接写在回复中。

## 高频 Bug 反例库

- 反例 1：错法 / 在 build 里创建 FutureBuilder 的 future 并请求接口；对法 / future 在 initState 或状态层创建并可取消；根因 / Widget rebuild 会重复触发副作用。
- 反例 2：错法 / setState 后直接认为全局列表已刷新；对法 / 用 Riverpod/Bloc 统一刷新事件和缓存失效；根因 / 局部 State 与业务状态源分裂。
- 反例 3：错法 / go_router redirect 未等登录态加载完就跳登录；对法 / 增加 unknown 状态和 refreshListenable；根因 / 初始化竞态导致重定向循环。
- 反例 4：错法 / await 请求后无 mounted 检查就 Navigator.pop；对法 / 检查 mounted、当前路由和请求序号；根因 / 页面销毁后仍操作 context。
- 反例 5：错法 / ListView 放 Column 里只加 shrinkWrap 解决；对法 / 重构为 Expanded 或 CustomScrollView/Sliver；根因 / 无界约束与高成本布局被掩盖。
- 反例 6：错法 / 卡顿只批量加 const；对法 / 用 DevTools 区分 Widget rebuild、layout、paint、raster、shader jank；根因 / 性能瓶颈不一定在 Dart rebuild。
- 反例 7：错法 / MethodChannel 只看 Dart PlatformException；对法 / 同步读 logcat/Xcode console 和原生栈；根因 / 原生线程、权限或生命周期才是 root cause。
- 反例 8：错法 / PlatformView 黑屏就换插件版本；对法 / 查 hybrid composition、Texture、z-order、页面复用和 dispose；根因 / 平台视图合成链路与普通 Widget 不同。
- 反例 9：错法 / iOS Pod 报错直接删 Podfile.lock；对法 / 对齐 Xcode/CocoaPods/deployment target/Swift 版本后再 pod install；根因 / 依赖矩阵冲突不是锁文件本身。
- 反例 10：错法 / Android 构建失败就降 compileSdk；对法 / 查 AGP/Gradle/JDK/Kotlin/namespace/minSdk 矩阵；根因 / 新插件依赖新版 Android 构建约束。
- 反例 11：错法 / Firebase 推送收不到只改 Dart 监听；对法 / 校验 APNs、Android channel、权限、flavor 配置和 payload；根因 / 推送链路跨 Firebase、系统权限和原生配置。
- 反例 12：错法 / Material 3 迁移后用固定高度硬压旧样式；对法 / 调整 ThemeData、ColorScheme、组件主题和设计确认；根因 / 组件默认 token 与交互规范变了。
- 反例 13：错法 / deferred components 加载失败就把资源移回首包；对法 / 查 Play delivery 配置、路由访问时机和资源声明；根因 / 延迟模块下载/安装/引用边界未闭合。
- 反例 14：错法 / shader jank 靠预热所有动画资源；对法 / 先定位 shader compilation、图片解码、过度裁剪或平台视图合成；根因 / 盲目预热可能增加启动和内存压力。

## 提交前自检清单

- 已确认 Flutter 3.x、Dart 3、Gradle/Kotlin、Xcode、CocoaPods、插件版本与目标平台。
- 已列出入口、路由、状态所有者、目标页面、调用方和消费方。
- build 中无新副作用；controller/focusNode/animation/stream/timer/subscription 已释放。
- Riverpod/Bloc 刷新、取消、错误、重试、离开页面后返回已覆盖。
- Navigator 2.0/go_router 深链、鉴权、返回栈、嵌套路由已检查。
- PlatformView/MethodChannel 涉及原生日志、权限、生命周期和线程证据已齐。
- Material 3、SafeArea、键盘、横屏/平板、暗色模式未被破坏或已声明未测。
- Impeller/Skia、shader jank、Widget rebuild 性能结论有 DevTools 或构建产物证据。
- Android/iOS 打包签名、flavor、Firebase 配置、deferred components 未被误改。
- 已运行或明确未运行 flutter analyze、flutter test、目标平台 build/integration test。

## 2024-2026 新坑速查

- Flutter 3.x 持续升级带来 Material 3 默认行为、Android edge-to-edge、Impeller 默认路径和插件 API 变化，先看当前版本 breaking changes。
- Dart 3 records/patterns/sealed/final class 与旧 json/泛型/反射式代码可能冲突，迁移时重点看序列化和 switch 覆盖。
- Android Gradle Plugin 8+ 强制 namespace、JDK 17、Kotlin/Gradle 矩阵更严格，旧插件常在构建期暴露。
- Android 13/14/15 权限、通知、照片、前台服务、精确闹钟、后台启动限制会影响 Flutter 插件表现。
- iOS 17/18、Xcode 15/16、隐私清单、签名、最低系统版本、Swift 编译设置会让旧 Pod 或二进制插件失败。
- CocoaPods CDN、Ruby、arm64 simulator、static/dynamic framework 配置会导致同一 Pod 在 CI 和本机结果不同。
- Impeller 与 Skia 对 shader、滤镜、裁剪、PlatformView 的性能特征不同，不能用一个平台结论覆盖全部。
- go_router 新版本 redirect、ShellRoute、StatefulShellRoute、browser history 变化会影响登录态和 Tab 栈。
- Firebase 多 flavor 需要每个平台配置文件、bundleId/applicationId、初始化 options 和 CI 注入一致。
- deferred components 与 Play Feature Delivery、资源声明、路由懒加载强绑定，调试包通过不代表商店包通过。

## 与相邻技能的边界

- design-director：负责产品视觉方向、品牌调性、设计取舍；flutter-development 只落实 Flutter 技术可行性和实现风险。
- ui-architect：负责页面结构、多端布局信息架构、组件层级方案；flutter-development 负责 Widget、状态、路由和平台差异实现。
- ui-design：负责颜色、间距、字体、图标、Material 3 视觉规范；flutter-development 负责主题落地、约束、适配和渲染问题。
- android-dev：负责 Android 原生 Manifest、Activity、Service、Gradle/Kotlin、权限、签名、插件原生实现；flutter-development 负责 Dart 侧调用、插件接入和跨端联调。
- apple-development：负责 Info.plist、entitlements、Xcode signing、CocoaPods、Swift/ObjC、iOS capabilities；flutter-development 负责 Dart 侧、Pod 集成触发点和 Flutter 构建链路。
- api-design：负责接口契约、状态码、鉴权、分页、错误模型；flutter-development 负责端侧请求、解析、缓存、重试、UI 状态呈现。
- test-engineering：负责测试矩阵、自动化策略、回归覆盖和验收；flutter-development 提供 Flutter 场景、风险点和本地验证证据。
- code-audit：负责改动后全局质量、安全、影响面收口；flutter-development 不替代最终审计。
