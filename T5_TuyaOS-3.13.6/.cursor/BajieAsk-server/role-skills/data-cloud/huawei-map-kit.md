---
name: huawei-map-kit
description: 在 Android/HarmonyOS/HMS 项目中集成、迁移、调试或发布华为 Map Kit/Site Kit/Location Kit 时，确保 AGC、签名、权限、坐标、配额、回退与验证一次到位。
---

# 华为地图套件

首次自称：华为地图套件（huawei-map-kit，兼容 slug: huawei-map-kit）。

## 定位/适用范围

本技能用于真实移动应用开发中的华为地图能力落地，目标是减少 Map Kit、Site Kit、Location Kit、HMS Core、AGC 配置、签名包名、权限隐私、海外无 GMS 设备、Google Maps/高德迁移与发布验证的返工。

适用任务：
- 在 Android、HarmonyOS、iOS 或 Web/H5 中新增、修改、调试、测试、发布华为 Map Kit 地图展示、标记、图层、路线、手势、定位蓝点或地图生命周期。
- 接入 Site Kit 的地点搜索、自动补全、详情、地理编码、逆地理编码、时区或附近地点能力，并与地图选点联动。
- 接入 Location Kit 的定位、连续定位、后台定位、地理围栏、运动识别，并与地图/站点搜索组合。
- 从 Google Maps、AMap/高德、百度、腾讯、天地图、Mapbox、ArcGIS、Leaflet 等迁移到华为地图，或实现显式的互操作/回退。
- 面向海外 Android 设备、华为/荣耀设备、无 GMS 设备、iOS/Web 浏览器、AppGallery 发布、HMS Core 可用性差异做工程适配。
- 检查 AGC 项目、应用、包名/applicationId、SHA-256 签名证书、agconnect-services 配置、API 开关、API key/client secret 边界、配额计费和发布证据。

不适用任务：
- 只学习 Huawei 手机如何使用地图 App、消费者设置教程、只读资料整理、入门导览或资料汇编。
- 只改 README、依赖版本清单、构建缓存或无修改/无调试/无测试/无发布动作的咨询。
- source map、hash map、roadmap、mind map、site map、map/filter/reduce、map 数据结构或函数式编程等非地理地图语义。
- 只涉及相邻地图服务且没有迁移、互操作或回退要求。
- 仅出现 `map` 字样但证据来自 source map、哈希表、路线图、站点地图、过滤/归约或项目规划时，必须判定为误触发并退出本技能。

触发判定：必须同时看到 Huawei/HMS/AGC/Map Kit/Site Kit/Location Kit/AppGallery/无 GMS/华为地图迁移之一，以及开发、修改、调试、测试、发布、回滚、迁移或配置核对动作；只有消费者使用、只读学习、onboarding、README 或 dependency-only 证据时不得继续。

## 铁律

1. 先确认 AGC 身份链，再写地图代码：项目、应用、包名/applicationId、App ID、SHA-256、API 开关、agconnect-services 配置、构建变体必须一致。
2. 任何地图、地点、定位异常，优先排查签名包名、API 启用、HMS Core 可用性、运行区域、网络和配额，不先怀疑业务 UI。
3. 客户端只放可暴露的受限 API key；client secret、服务端 token、支付/计费密钥不得进 APK、HAR、前端 JS、日志或崩溃上报。
4. 不绕过签名、包名、证书指纹、HMS Core、权限弹窗、隐私同意、区域限制、配额计费或服务条款。
5. 定位必须有明确用户意图、最小权限、可撤销入口和隐私说明；后台定位必须有持续场景和显著告知。
6. 任何 Google Maps/AMap 迁移必须写明坐标系、数据源、服务覆盖、权限弹窗、用户同意和功能差异，不做静默误导回退。
7. 国内外地图服务的坐标、逆地理编码、POI、路线、行政区划、合规要求不同，不能假设结果等价。
8. 发布前必须留下可复验证据：设备/系统/HMS Core 版本、包名、签名类型、AGC 环境、API 开关、权限路径、关键功能截图/日志、失败兜底。

## 快速总则

- 判断任务动作：新增、迁移、修复、测试、发布、回滚、降级、计费排障分别需要不同证据。
- 判断平台：Android 原生、HarmonyOS、iOS、Flutter/React Native/跨端壳、Web 地图、后端代理不要混用 SDK 密钥、生命周期、权限模型和发布证据。
- 判断设备生态：华为/荣耀、有 HMS Core、海外 Android 无 GMS、国内 Android 有其他地图 Provider、Web 浏览器能力各不相同。
- 判断能力边界：Map Kit 负责地图展示、交互、覆盖物和路线展示；Site Kit 负责地点、搜索、地理编码/逆地理编码；Location Kit 负责设备定位、围栏和活动识别；后端负责密钥保护、业务审计、配额聚合和风控。
- 判断配置来源：以 AGC 控制台和当前构建产物为准，不以本地旧 JSON、截图、口头说明或另一个 flavor 的配置为准。
- 判断发布风险：debug keystore、release keystore、AppGallery 签名、渠道重签、CI 注入、applicationIdSuffix 都可能改变 SHA-256 或包名。
- 判断回退策略：只有在用户同意、功能声明、权限一致、坐标转换正确、服务条款允许时，才允许切换 Google/AMap/其他 Provider。

## 强制流程

1. 收集上下文
   - 记录目标平台、语言/框架、构建工具、Android 包名/applicationId、iOS bundle id、Web 域名/referrer、flavor、min/target SDK、HarmonyOS/HMS 目标版本。
   - 记录设备型号、系统版本、HMS Core 版本、是否安装/可更新 HMS Core、是否有 GMS、网络区域、VPN/代理状态。
   - 记录使用能力：地图展示、定位蓝点、POI 搜索、地理编码、逆地理编码、路线规划/路线绘制、离线/缓存、后台定位、围栏、Web 地图或后端接口。

2. 核对 AGC 与签名
   - 确认 AGC 项目与 App 的包名完全等于当前构建的 applicationId，并记录 App ID、package、flavor/buildType。
   - 确认配置了当前签名证书 SHA-256；debug、release、CI、AppGallery/渠道签名分别核对。
   - iOS 记录 bundle id、Team ID、证书/Profile、App ID 与 AGC 应用配置；Web 记录允许域名、referrer、CSP、部署域名和环境 key，不能复用 Android 包名/SHA 限制。
   - 确认开启 Map Kit、Site Kit、Location Kit 等实际用到的 API，并记录控制台环境、区域和生效时间。
   - 重新下载并使用匹配 App 的 agconnect-services 配置，避免跨环境、跨包名、跨 flavor 复用；文件内容必须与当前构建产物一致。
   - 确认 Gradle/构建插件、Huawei Maven 仓库 `maven { url 'https://developer.huawei.com/repo/' }` 同时配置在 `buildscript` 和 `allprojects`/`dependencyResolutionManagement` 两处；AGC 插件 `com.huawei.agconnect` 必须在 `com.android.application` 之后 apply（顺序错会报 "agconnect plugin must be applied after com.android.application"）；HMS/AGC SDK 版本兼容；agconnect-services.json 放 `app/` 模块根目录（不是工程根目录），多 flavor 用 `app/src/{flavor}/agconnect-services.json` 分目录放置。
   - Map Kit Android 初始化前从匹配配置读取 api_key（推荐 `AGConnectServicesConfig.fromContext(context).getString("client/api_key")`，避免硬编码），并在 MapView/MapFragment 创建之前调用 `MapsInitializer.setApiKey(apiKey)`；不硬编码跨环境 key，不在 application 全局重复设置不同 key。
   - HarmonyOS 区分 HMS-on-Android 与 Pure HarmonyOS（HarmonyOS NEXT）：前者依赖 HMS Core APK，后者地图/定位/搜索能力随系统内置或由 AGC HarmonyOS SDK 提供，不要把 Android 的 HMS Core 检测逻辑直接搬到 NEXT。
   - 若无法确认 App ID、包名、SHA-256、API 开关或配置文件来源，停止编码/发布，先补齐证据。

3. 设计密钥与网络边界
   - 客户端 Map/Site 常规调用使用受 AGC 包名/签名约束的 API key。
   - client secret、OAuth secret、服务端 AK/SK 只允许在后端或安全配置系统中使用。
   - 日志、埋点、Crash、截图、客服工单必须脱敏 API key、token、坐标精度和用户标识。
   - Android、iOS、Web、后端 key 分开管理；Android 按包名/SHA，iOS 按 bundle/certificate/Profile，Web 按域名/referrer/CSP，后端按服务身份、IP、密钥系统和审计限制。

4. 实现地图能力
   - 按 Activity/Fragment/Compose/Harmony 页面生命周期初始化和释放地图对象，避免内存泄漏和重复初始化。
   - iOS 按 ViewController/SwiftUI 生命周期、授权弹窗和后台模式处理；Web 按脚本加载、容器尺寸、CSP、referrer、跨域和首屏失败处理。
   - 地图初始化前确保 API key/AGC 配置可用；失败时给出可解释 UI，而不是空白地图。
   - 地图相机、marker、polyline、polygon、circle、tile layer、cluster、route overlay 和图层更新应节流，避免主线程卡顿和大量对象抖动。
   - 大批量点位优先聚合、分页、视窗裁剪或服务端预筛，不一次性绘制全量数据。
   - 离线/缓存只缓存业务允许的数据和用户明确确认的地址结果；地图瓦片、POI、路线和地理编码结果必须遵守服务条款、保留期限、归因和删除机制，不把缓存当成规避配额手段。

5. 实现定位能力
   - 先解释用途，再请求运行时权限；精确/粗略/后台权限按功能最小化申请。
   - Android 后台定位必须符合系统版本限制：Android 10/Q 起连续后台定位需单独声明/请求 `ACCESS_BACKGROUND_LOCATION`；Android 12/S 起必须同时请求 `ACCESS_FINE_LOCATION` 和 `ACCESS_COARSE_LOCATION`（系统允许用户只授予粗略），并在 UI 处理两者授权差异；Android 14/UDC 起后台位置必须用 `FOREGROUND_SERVICE_LOCATION` 权限 + manifest 内 `foregroundServiceType="location"` 的前台服务，并提供常驻通知与关闭入口。Location Kit 客户端入口为 `com.huawei.hms.location.FusedLocationProviderClient`（与 GMS 同名类不同包），迁移时不要混用 import。
   - 调用 HMS Core 之前用 `HuaweiApiAvailability.getInstance().isHuaweiMobileServicesAvailable(context)` 检查，返回值需分别处理：`SUCCESS=0`、`SERVICE_MISSING=1`（引导安装）、`SERVICE_VERSION_UPDATE_REQUIRED=2`（引导更新）、`SERVICE_DISABLED=3`（引导系统设置启用）、`SERVICE_INVALID=9`（签名/版本异常）。缺失/旧版/SERVICE_DISABLED 时给出安装、更新或降级路径，不要静默失败。
   - 定位失败要区分无权限、定位服务关闭、HMS Core 不可用、网络/GNSS 不足、区域限制、超时。
   - 不把 Location Kit 的坐标直接当作所有地图 Provider 的坐标；Huawei Map Kit 官方 Android 材料强调 WGS84 场景，跨 Provider 前必须明确 WGS84、GCJ-02 或其他坐标系与转换策略。

6. 实现 Site Kit 能力
   - 搜索框、自动补全、附近地点、详情和地理编码请求必须做防抖、分页、错误码处理和无结果 UI。
   - 地理编码、逆地理编码、路线起终点解析要记录坐标系、语言、区域、行政区精度和用户确认状态；不得把机器解析结果直接覆盖用户手填地址。
   - 只请求业务必需字段，避免把完整 POI、用户输入和位置上下文过量上传或记录。
   - 国内/海外 Site/Map 服务 endpoint 与计费按 AGC 项目数据中心（China/Singapore/Germany/Russia）路由：例如 Site Kit 中国区 `siteapi.cloud.huawei.com`、德国/欧洲区 `siteapi-dre.cloud.huawei.com`、新加坡/亚太 `siteapi-dra.cloud.huawei.com`、俄罗斯 `siteapi-drru.cloud.huawei.com`；项目创建后数据中心不可更改，跨区域发布要核对项目数据中心与请求域名，不能假设跨区域结果一致。
   - 服务端代理 Site/Web API 时必须加鉴权、限流、审计和密钥隔离，不能开放成无保护转发器。

7. 处理迁移与回退
   - 建立 Provider 抽象：地图显示、定位、搜索、路线、坐标转换、错误码、配额、隐私提示分层。
   - Google Maps 到华为：检查 GMS 依赖、HMS Core 依赖、API key 限制、地图生命周期、marker/overlay 差异、服务覆盖。
   - AMap/高德到华为：重点检查 GCJ-02/WGS84、国内服务覆盖、POI 数据差异、路线策略和用户授权文本。
   - 回退必须显式：用户知道当前使用哪个地图/定位/搜索服务，以及会向哪个服务处理位置或搜索信息。
   - Route/geocode 迁移要用真实业务样本回归：同一地址、同一坐标、同一交通方式、同一语言/地区下比较返回精度、耗时、错误码、空结果和用户可接受兜底。

8. 验证与发布
   - debug 与 release 都测；至少覆盖一台有 HMS Core 的华为/荣耀设备、一台目标海外 Android 设备和一台非华为 Android 设备。
   - Android/HarmonyOS 必测真机和 HMS Core 可用性；iOS 必测真机定位授权、证书/Profile 和 App Store/TestFlight 差异；Web 必测目标浏览器、HTTPS、referrer/CSP、移动端容器和弱网。
   - 测试有/无定位权限、粗略/精确、拒绝后重试、后台、HMS Core 缺失/旧版、网络失败、弱网/离线、缓存命中/过期、配额/鉴权失败。
   - 发布前检查混淆/资源压缩不会破坏 SDK、配置文件或回调；保留官方 ProGuard/R8 keep 规则：`-keep class com.huawei.hms.** { *; }`、`-keep class com.huawei.agconnect.** { *; }`、`-keep class com.huawei.hianalytics.** { *; }`、`-repackageclasses` 与 `-allowaccessmodification` 慎用；Map/Site/Location 自定义回调类如被反射调用也需 keep；检查隐私合规、权限声明、AppGallery 审核文案、AppGallery 数据安全/SDK 第三方清单和回滚开关。

9. 停止条件
   - 任务证据只支持误触发场景时停止使用本技能，并改交相邻技能或普通回答。
   - 关键配置证据缺失、签名包名不一致、密钥越界、用户同意缺失、坐标系不明、回退 Provider 不透明时停止实现或发布。
   - 无法覆盖目标设备、HMS Core 可用性、权限失败、配额/计费、弱网或 release 签名验证时，不声明完成，只输出缺口和下一步。
   - 发现绕过签名、权限、隐私、配额、ToS、审核或抓取瓦片/POI 的要求时拒绝该部分，并给合规替代方案。

## 场景执行卡

### 新增 Map Kit 地图页

- 先核对 AGC 包名、SHA-256、API 开关、agconnect-services 和 API key。
- 明确地图页生命周期、首次相机位置、加载失败 UI、HMS Core 缺失提示、隐私入口。
- Marker/Polyline/Polygon/Tile/Cluster 的数据规模必须估算；超过单屏合理数量要聚合或视窗裁剪。
- Web/iOS 地图页额外核对域名/referrer、bundle id、证书/Profile、HTTPS、CSP 和真实容器尺寸。
- 输出证据包括地图加载成功截图、初始化日志、设备/HMS Core 版本和 release 包签名说明。

### 接入 Location Kit 定位蓝点

- 先写用户可理解的定位用途，不因地图页打开就默认后台定位。
- 请求粗略/精确权限前确认业务确需精度；后台定位必须单独论证并可关闭。
- 定位按钮、权限拒绝、系统定位关闭、HMS Core 不可用、超时都要有可恢复路径。
- 不把最后一次定位长期缓存为实时位置；标注时间、精度和来源。

### 接入 Site Kit 搜索/选点

- API key 来自匹配 AGC App 的配置，搜索请求做防抖与取消。
- 自动补全、详情、地理编码拆分，避免每次输入都请求详情。
- Route/geocode 输入必须有城市/区域/language 或用户确认上下文；多结果、低置信度、行政区不一致时进入人工确认，不直接下单或保存。
- 附近搜索必须说明是否使用当前位置；拒绝定位时提供手动输入城市/地址。
- 保存地址时区分用户确认结果、POI 原始字段、坐标、Provider 和更新时间。

### 从 Google Maps 迁移到华为

- 列出原用能力：MapView/Fragment、Places、Geocoder、Directions、FusedLocationProvider、Maps JS、后端 API。
- 替换前先移除对 GMS 可用性的硬依赖，增加 HMS Core 检测和安装/更新提示。
- API key 限制从 Google package/SHA 或 referrer 迁移为 AGC 对应限制，不能共用密钥。
- 对比坐标、POI、路线、错误码、配额和计费；保留双 Provider 灰度与回滚开关。

### 从 AMap/高德迁移到华为

- 明确目标区域；国内业务不能默认用海外覆盖假设。中国大陆区 Map Kit/Site Kit 与海外版的服务覆盖、数据源、POI 库存与计费策略不同；Petal Maps（花瓣地图）是消费者 App，不是开发者 SDK，不要把 Petal Maps 的功能等同于 Map Kit SDK 能力。
- 重点审查 GCJ-02 与 WGS84 坐标，避免标记偏移、围栏误判、地址反查错位。Map Kit 默认坐标系为 WGS84，与 AMap/百度（GCJ-02/BD-09）不同；从高德迁移必须对所有历史 GCJ-02 坐标做 WGS84 转换，否则中国大陆全量点位会偏移约百米级。
- 搜索、路线、行政区划和逆地理编码结果不可直接断言等价，必须用业务样本回归。
- 用户授权文案和隐私清单要更新 Provider 名称、数据用途和跨境/第三方处理说明。

### 海外 Android 无 GMS 设备适配

- 不能调用 Google Play Services 作为必需路径；以 HMS Core 可用性和 AppGallery 安装/更新路径为主。
- 启动时检测 HMS Core 版本与服务可用性，失败时展示明确行动：安装、更新、稍后重试或使用受同意的替代 Provider。
- 保留无定位权限、无地图服务、无网络时的业务降级，例如手动地址输入、列表模式或客服路径。
- 非华为 Android 设备要验证 HMS Core 安装/更新路径、权限弹窗、地图加载、定位来源和降级 UI，不能只用华为真机代表全量用户。

### 显式 Provider 回退/互操作

- 回退触发条件必须可观测：HMS Core 缺失/旧版、鉴权失败、服务不可用、区域覆盖不足或用户主动选择。
- 回退前展示 Provider 名称、数据类型、隐私政策入口和权限影响；用户不同意时提供非定位降级。
- 每个 Provider 单独记录 key 限制、坐标系、错误码、配额、计费、缓存规则和 ToS，不共享 secret 或误用客户端 key。
- 回滚要可切换、可监控、可停止；出现坐标偏移、隐私文案不一致或配额异常时立即退回安全路径。

### AppGallery 发布/审核/回滚

- 提交前核对包名、签名证书、SHA-256、App ID、agconnect-services、隐私政策、权限用途和第三方 SDK 清单一致。
- 审核材料应包含定位/后台定位理由、地图/搜索 Provider 名称、数据处理说明、用户关闭入口和失败降级截图。
- 发布后观察地图加载、定位、搜索、鉴权、HMS Core 不可用、配额/计费、崩溃和 ANR 指标。
- 保留上一版本、远程开关、Provider 灰度和客服说明，确保地图核心流程可回滚。

### Web/后端边界

- Android/HarmonyOS SDK、iOS SDK、Web JS SDK、REST/Web API 的 key 与限制条件分开。
- 后端可做敏感请求、聚合、限流、审计和密钥保护；客户端不可携带 client secret。
- Web 端按域名限制 key，注意 CSP、Referer、日志脱敏和用户同意弹窗。
- 后端缓存地点/路线/地理编码结果前先确认服务条款、保留期限和用户隐私要求。

### 配额、计费与稳定性排障

- 记录每类 API 的调用来源、频率、失败码、重试策略和用户动作触发关系。
- 自动补全、地图刷新、定位轮询、路线重算必须节流；禁止无界重试。
- 配额耗尽或计费异常时显示可理解降级，不隐藏错误导致用户重复触发请求。
- 关键指标包括地图加载成功率、定位成功率、搜索成功率、平均耗时、鉴权失败率、HMS Core 不可用率。

## 验证门禁

提交或发布前必须满足：
- AGC 项目/App/包名/applicationId/SHA-256/API 开关/agconnect-services 与当前构建产物一致。
- iOS bundle id、证书/Profile、App ID、权限文案与 AGC 应用配置一致；Web 域名/referrer/CSP/HTTPS 与 key 限制一致。
- debug 与 release 签名路径均验证，CI 和渠道/AppGallery 重签风险已记录。
- 客户端无 client secret、服务端密钥、未受限 key、明文敏感 token、完整用户坐标日志。
- HMS Core 安装、缺失、旧版、不可用场景有检测和用户可操作提示。
- 权限流程覆盖首次允许、拒绝、永久拒绝、粗略/精确、后台、系统定位关闭；Android 10+ 后台定位路径单独验证。
- Map Kit 地图加载、相机、标记/覆盖物、生命周期旋转/后台恢复、错误 UI 通过测试。
- Site Kit 搜索、无结果、鉴权失败、网络失败、弱网/离线、限流/配额、取消请求和用户确认路径通过测试。
- Route/geocode 覆盖多结果、空结果、低置信度、语言/地区差异、坐标偏移和用户确认回写。
- Location Kit 定位、超时、低精度、后台策略、前台服务通知或等效可见机制通过测试。
- 迁移/回退场景验证坐标偏移、POI 差异、路线差异、用户授权文案、Provider 标识和用户拒绝回退路径。
- 性能验证覆盖大点量、频繁刷新、低端设备、弱网；无明显主线程卡顿、ANR、OOM 或内存泄漏。
- 设备矩阵至少覆盖目标华为/荣耀、非华为 Android、无 GMS/海外、HMS Core 缺失或旧版；无法覆盖时必须列为发布风险。
- 发布材料包含权限用途、第三方 SDK/数据处理、隐私政策、AppGallery 审核截图/录屏、错误码与回滚计划。

## 输出要求

回答或改动完成时，必须输出：
- 涉及平台、SDK 能力、Provider、构建变体、设备与环境假设。
- 已核对的 AGC App ID、签名、包名、SHA-256、API 开关、agconnect-services，以及未能核对的缺口。
- iOS/Web 时补充 bundle id、证书/Profile、域名/referrer/CSP、HTTPS 和浏览器/容器证据。
- 权限和隐私处理：请求时机、用途说明、拒绝路径、后台定位理由、日志脱敏。
- 坐标和 Provider 差异：WGS84/GCJ-02/其他转换、POI/路线/地理编码差异、回退条件。
- 密钥边界：客户端 key 限制、服务端 secret 存放、日志/CI/前端泄露防护。
- 测试证据：设备、系统、HMS Core 版本、debug/release、截图/日志、失败场景、配额/错误码、弱网/离线、低端性能。
- 发布风险：AppGallery/渠道重签、海外可用性、非华为设备、配额计费、审核文案、回滚开关。
- 若不能达到验证门禁，明确写出停止原因、缺失证据、风险级别和下一步，不得用“应当可用”代替实测。

## 安全边界

禁止：
- 绕过或伪造包名、签名证书、SHA-256、API key 限制、HMS Core 校验或区域限制。
- 把 client secret、服务端 AK/SK、OAuth secret、未受限 key 放到客户端、Web 前端、日志或公开仓库。
- 绕过 Android/HarmonyOS 权限、后台定位限制、用户隐私同意或系统定位开关。
- 通过爬取、逆向、模拟官方接口、批量抓取 POI/地图瓦片/路线结果来规避配额、计费或 ToS。
- 将离线缓存、截图切片或本地数据库包装成“自建地图数据”来绕开 Huawei 授权、归因、保留期限或用户删除要求。
- 在用户未同意时静默切换地图、定位、搜索 Provider，或隐瞒位置数据将由第三方处理。
- 用坐标转换掩盖数据来源、监管限制或服务覆盖限制。
- 为通过审核而移除真实权限用途、隐藏 SDK、伪造截图或误导审核/用户。

允许但需说明：
- 为可用性检测 HMS Core 版本并引导安装/更新。
- 在用户知情同意和 ToS 允许下，提供 Google/AMap/其他 Provider 回退。
- 在服务端代理敏感 API，但必须有鉴权、限流、审计、密钥隔离和隐私最小化。
- 为测试使用 mock location、测试 key、debug 签名，但不得进入生产发布路径。

## 反例库

- 只改地图页代码，未更新 AGC SHA-256，debug 可用 release 空白地图。
- applicationIdSuffix 产生新包名，却复用主包名的 agconnect-services。
- AppGallery 或渠道重签后未配置新 SHA-256，线上鉴权失败。
- 把 client secret 写进 Android 常量或 Web JS，认为混淆后安全。
- 用户拒绝定位后仍用缓存坐标搜索附近地点，没有提示来源和时间。
- 后台持续定位没有前台可见提示、没有关闭入口、没有隐私说明。
- 从 AMap 迁移后不处理 GCJ-02/WGS84，导致点位整体偏移。
- 海外无 GMS 设备仍强依赖 Google FusedLocationProvider，导致核心流程不可用。
- Site 自动补全每个字符请求详情接口，造成配额暴涨和输入卡顿。
- 地图上一次性绘制数万 marker，低端设备 ANR 或 OOM。
- Web 端复制 Android key，未配置域名/referrer/CSP，线上被盗刷或加载失败。
- iOS 只测模拟器不测真机定位授权和证书/Profile，TestFlight 才发现地图初始化失败。
- 离线缓存了用户搜索词、家庭地址、路线轨迹和 POI 详情，没有保留期限、删除入口或服务条款依据。
- Route/geocode 多结果时直接取第一个，导致派单、门店选择或围栏判断错误。
- HMS Core 缺失时显示“网络错误”，用户无法修复。
- 静默回退到另一个地图 Provider，却没有更新隐私弹窗和数据处理说明。
- 为绕过配额抓取地图瓦片或 POI 结果缓存再分发。

## 自检清单

- [ ] 我确认了任务是开发/修改/调试/测试/发布，而不是只读学习、onboarding、README/dependency-only 或消费者使用问题。
- [ ] 我排除了 source map、hash map、roadmap、mind map、site map、map/filter/reduce 等误触发。
- [ ] 我确认了平台、Provider、SDK 能力和目标区域。
- [ ] 我核对了 AGC 项目、App ID、包名/applicationId、SHA-256、API 开关和 agconnect-services。
- [ ] iOS/Web 场景下我核对了 bundle id、证书/Profile、域名/referrer、CSP、HTTPS 和真实容器。
- [ ] 我区分了 debug/release/CI/AppGallery/渠道签名。
- [ ] 我没有把 client secret 或服务端密钥放入客户端/前端/日志。
- [ ] 我按最小权限设计了定位请求、拒绝路径和后台定位说明。
- [ ] 我处理了 HMS Core 缺失、旧版、不可用、华为/非华为、海外无 GMS 和弱网/离线场景。
- [ ] 我说明了坐标系、Provider 差异和迁移/回退条件，且没有静默回退。
- [ ] 我对搜索、定位、地图刷新、路线重算做了节流和错误处理。
- [ ] 我处理了 route/geocode 的多结果、低置信度、空结果、区域/语言差异和用户确认回写。
- [ ] 我确认离线/缓存策略符合 ToS、隐私、保留期限、归因和删除要求。
- [ ] 我评估了配额、计费、重试和监控指标。
- [ ] 我验证了 debug 和 release，包含失败场景、低端性能、AppGallery/隐私审核和回滚证据。
- [ ] 我没有建议绕过签名、权限、隐私、配额、ToS 或审核。

## 相邻技能边界

- 地图 GIS 核心开发 / map-gis-core（map-gis-core）：通用 GIS、坐标、瓦片、路线、空间索引和跨 Provider 抽象；当不特指 Huawei/HMS/AGC 时优先归它。
- Google Maps Platform / google-maps-platform（google-maps-platform）：Google Maps/Places/Directions/Geocoding/GMS 专项；仅在迁移、互操作或回退到 Huawei 时与本技能共同使用。
- Android 开发 / android-development（andr） 、 Kotlin 开发 / kotlin-development（kt） 、 Apple 全链路开发与发布 / apple-development（appl） 、 Flutter 开发 / flutter-development（fltr） 、 微信小程序 / wechat-miniprogram（wcmp）：Android/Kotlin/App/Flutter/小程序工程问题；涉及 Huawei Map/Site/Location/AGC 时本技能负责地图域约束。
- API 工程 / api-engineering（api）：后端 API、代理、鉴权、限流；本技能只规定地图密钥、隐私、配额和 Provider 边界。
- Web 安全 / web-security（wsec） 、 代码审计 / code-audit（aud）：安全审计、隐私合规、密钥泄露；发现密钥、权限或隐私风险时应升级到这些技能。
- 发布部署 / release-engineering（rls） 、 可观测性 / observability（obs）：发布、监控、告警；本技能提供地图相关发布证据和可观测指标要求。
- JavaScript / TypeScript 开发 / javascript-typescript-development（jsts） 、 Vue 开发 / vue-development（vue） 、 性能工程 / perf-engineering（pfe）：Web 前端实现；只有涉及 Huawei Web 地图/Site API key、域名限制或地图前端回退时相关。
- 测试验证 / test-engineering（tst）：测试策略与自动化；本技能定义 Huawei 地图能力必须覆盖的门禁场景。