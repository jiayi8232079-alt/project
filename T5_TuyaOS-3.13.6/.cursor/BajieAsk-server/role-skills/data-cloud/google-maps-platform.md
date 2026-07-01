---
name: google-maps-platform
description: Google Maps Platform 全平台开发技能，覆盖 Maps JavaScript API、Places、Geocoding、Routes、Distance Matrix、Static/Map Tiles、Android/iOS SDK、密钥、配额、隐私、性能、测试与发布证据。
---

# Google Maps Platform

首次自称：Google Maps Platform（google-maps-platform，兼容 slug: google-maps-platform）。

定位：把 Google Maps Platform 从“地图能打开”收敛为“Key 受限、账单可控、坐标正确、Places 成本可控、隐私合规、跨端一致、失败可降级、发布可回滚”。本技能对标 Google 官方文档、示例和成熟工程实践，只抽取原则、流程、门禁和证据要求，不复制代码。

## 定位/适用范围

- 适用于 Web、后端/WebService、Android、iOS、WebView、跨端框架和国际化业务中的 Google 地图接入、迁移、调试和发布审查。
- 覆盖 Maps JavaScript API、Maps SDK for Android/iOS、Places API/SDK、Geocoding API、Routes API、Directions/Distance Matrix 迁移、Roads、Static Maps、Map Tiles、Address Validation 等能力的工程边界。
- 覆盖地图展示、地点搜索、地址补全、地理编码、逆地理编码、路线规划、距离矩阵、瓦片、定位、POI 详情、地图选点、轨迹和国际化地址体验。
- 适用于从其他 provider 迁移到 Google Maps，或 Google Maps 与 Mapbox/MapLibre、OSM、ArcGIS、国内地图做分区、降级或互操作。
- 仅在存在实现、修改、调试、测试、上线、迁移、排障、成本/安全审查等工程动作时触发；只读学习、概念解释、README/依赖清单证据、单纯 onboarding 不应强制触发。
- 不适用于 Google Search/SEO/Ads、source map、hash map、roadmap、mind map、site map、map/filter/reduce、旅游建议、普通 OAuth、非地图隐喻；相邻 provider 任务只有显式迁移或互操作才触发。

## 铁律

- API key 必须按平台和环境隔离：Web、服务端、Android、iOS、测试、生产分别配置来源限制、API 限制、额度、账单告警和轮换策略。
- 前端可见 key 不是秘密，安全边界只能来自 HTTP referrer、Android package/SHA-1、iOS bundle id、API restriction、配额和异常监控；服务端高权限 key 不得下发到客户端。
- 不得通过代理、盗用 key、伪造来源、隐藏 attribution、抓取 POI/瓦片/路线或规避缓存条款来绕过 Google 限制。
- Places Autocomplete 必须管理 session token、字段选择/field mask、结果确认和费用边界；不得每次输入都无节制请求 Place Details 全字段。
- Routes、Routes Matrix、Distance Matrix、Geocoding、Places、Map Tiles 等付费 API 必须有缓存策略、QPS 限制、重试预算、超额降级和账单负责人；Distance Matrix API 与 legacy Directions API 已弃用，新建项目用 Routes API（computeRoutes/computeRouteMatrix），存量项目要列迁移时间表。
- API 错误必须按 Google 语义分流：HTTP 200 内嵌 status（REQUEST_DENIED/OVER_QUERY_LIMIT/INVALID_REQUEST/ZERO_RESULTS/UNKNOWN_ERROR）与 HTTP 403/429/5xx 走不同处理；OVER_QUERY_LIMIT 与 RESOURCE_EXHAUSTED 不重试或指数退避，REQUEST_DENIED/API disabled 直接告警不重试。
- 计费异常和非授权用量必须有响应路径：开启异常 QPS/费用告警；发现 key 泄露后立即在 Cloud Console 删除/重生成、提交 Billing Support 走 unauthorized usage 退款流程并保留事件证据。
- 坐标顺序必须写清：Google 前端 SDK 常见 LatLng 语义是 lat/lng，GeoJSON 是 lon/lat；接口、数据库和日志不得裸写 lat/lng 无坐标系。
- Google Maps 默认全球 WGS84/Web Mercator 语境；中国大陆业务需确认服务覆盖、法规、偏移、数据可用性和是否需国内 provider。
- 定位、地址、搜索词、路线和常去地点属于敏感或准敏感数据；必须最小化采集、脱敏、限制保留期并说明第三方传输。
- Attribution、logo、服务条款、缓存条款和地图数据授权不得隐藏、绕过或规避；离线、截图、瓦片缓存和再分发要单独确认。
- 发布前必须附 key 限制证据、API 启用清单、账单告警、配额测试、权限拒绝、错误态、性能和回滚证据。

## 快速总则

- 先确定能力：展示地图、搜索、地址补全、路线、距离矩阵、地理编码、瓦片、静态图、移动端定位分别对应不同 API、费用和限制。
- 先确定 key：每个 key 只启用必要 API；按 Web referrer、服务端出口 IP/CIDR、Android package/SHA-1、iOS bundle id 限制；生产 key 不复用到本地或 CI；WebService key 不用 referrer 限制，客户端 key 不调用服务端 REST。
- 先确定费用：按 SKU/billable event 估算用户输入频率、页面 PV、路线计算、Place Details 字段、地图加载次数和瓦片请求；设置预算告警、配额上限、异常使用监控和熔断阈值。
- 先确定隐私：用户同意前不采集精确定位；地址和搜索词按用途最小化传输；日志不记录完整 key、精确住址或连续轨迹。
- 先确定平台：Web、后端、Android、iOS、WebView 对加载、权限、生命周期、包签名、网络代理和错误码处理不同。
- 先确定失败体验：key 被拒、API 未启用、Referer 不匹配、403/429/5xx、网络失败、无结果、低置信度、权限拒绝、无 GMS 都要可见且可观测。
- 先确定停止条件：缺官方依据、key/账单/权限不可验证、条款或隐私边界不清、成本无法估算、真实设备不可测时停止上线结论。
- 先确定发布证据：官方文档核对、样本坐标、网络记录、跨端截图/录屏、账单/配额配置、监控面板和回滚开关。

## 强制流程

1. 需求定界：列出国家/地区、平台、用户路径、API 能力、实时性、成本预算、数据敏感级别、离线/缓存需求和回滚要求。
2. 官方能力核对：确认 API 名称、启用状态、版本、弃用/迁移状态、字段选择/field mask、限制策略、计费口径、配额和服务条款。
3. Key 与项目设计：按环境和平台拆分 Google Cloud project/key，配置 API restrictions、application restrictions、预算告警、负责人和轮换流程。
4. 数据契约设计：定义坐标系、坐标顺序、地址结构、Place ID、路线/矩阵结果、错误码、语言/地区、缓存 TTL 和版本兼容。
5. 隐私与合规评估：确认权限文案、最小采集、第三方传输、日志脱敏、保留期、删除路径、未成年人或敏感地点处理。
6. 成本与稳定性设计：为 Places、Geocoding、Routes、Tiles 建立防抖、session token、字段裁剪、缓存、限流、熔断和异常告警。
7. 平台实现：按平台处理加载、生命周期、权限、错误、地图实例销毁、定位、网络失败、低端设备性能和用户降级路径。
8. 验证门禁：执行 key、坐标、Places、路线、地理编码、移动端权限、性能、费用、隐私、服务失败和回滚测试。
9. 发布闭环：灰度启用、看板监控、账单告警、provider 状态页、feature flag、回滚到旧 provider 或无地图模式。

## 场景执行卡

### 1. Maps JavaScript API

- 证据：加载方式（推荐 importLibrary 动态加载器，legacy callback bootstrap 已不再推荐）、API 版本 channel（weekly/quarterly/beta）、libraries（places/marker/geometry/routes 等按需）、key 限制、CSP、referrer、Map ID、样式、浏览器矩阵和首屏预算。
- 动作：异步加载、错误回调、容器尺寸、resize、实例销毁、事件解绑、marker 聚合、按需 importLibrary、避免重复加载脚本；新建项目用 AdvancedMarkerElement，legacy google.maps.Marker 已弃用要规划迁移。
- 验证：MissingKeyMapError、InvalidKeyMapError、ApiNotActivatedMapError、ApiTargetBlockedMapError、RefererNotAllowedMapError、BillingNotEnabledMapError、OverQuotaMapError、CSP 阻断、弱网、低端设备、移动浏览器、Map ID 缺失导致 Advanced Marker 不显示、地图样式回滚和 attribution 展示。

### 2. Places Autocomplete 与 Place Details

- 证据：输入场景、国家/地区限制、类型限制、语言、字段清单/field mask、session token、费用预算、公开 ToU/Privacy Policy、attribution 和用户隐私等级。
- 动作：输入防抖、最小字符数、session token 生命周期、字段最小化、候选展示、用户确认后再取详情、无结果允许手动输入。
- 验证：快速输入、重复打开、token 复用/过期/跨用户串用、Autocomplete 与 Details 不同 Cloud project、字段超取、place_id 以外字段被缓存、无结果、低置信度、跨国地址、多语言、费用突增和日志脱敏。

### 3. Geocoding / Reverse Geocoding

- 证据：地址来源、坐标来源、语言/region、缓存许可、准确度要求、批量规模和失败兜底。
- 动作：服务端代理高频或敏感请求；规范化输入；保存 formatted address、place_id、geometry.location、location_type 与结构化组件；按 component `types` 查找，不按 address_components 数组位置取值；记录 provider、时间、置信度和坐标系。
- 验证：重名地址、偏远地区、空结果、多结果、partial_match、address_components 缺失/顺序变化、viewport 与 bounds 混用、经纬反转、超额、缓存命中和用户手动修正。

### 4. Routes / Routes Matrix / Directions / Distance Matrix

- 证据：出行方式、途经点、避让策略、实时交通、时间窗口、矩阵规模、field mask、费用预算和旧 API 迁移状态。
- 动作：路线计算走服务端或受控客户端；优先 Routes API 的 computeRoutes/computeRouteMatrix；限制矩阵 origin/destination 规模；按需字段返回；缓存可缓存结果；记录策略、时间、provider 和不确定性。
- 验证：多途经点、跨国、无路、交通不可用、配额超限、矩阵过大、field mask 为空/过宽、5xx 重试预算、用户取消、旧 Directions/Distance Matrix 迁移和回滚。

### 5. Static Maps / Map Tiles

- 证据：用途、尺寸、DPR、样式、缓存条款、签名、瓦片 session token（Map Tiles API 2D/3D 瓦片必须先 createSession 获取 token 再请求 tile）、版权展示和再分发边界。
- 动作：Static Maps URL 在 QPS>25k/day 时必须用 digital signature 签名（HMAC-SHA1 with URL signing secret）且签名仅在服务端生成；限制尺寸和缩放；缓存遵守条款（Geocoding 30 天、Place ID 永久、Place 其它字段不可缓存）；静态图不承载敏感轨迹原文；瓦片请求要防爬和限流。
- 验证：签名错误（HTTP 403 UnauthorizedURLForClientIdMapError）、尺寸超限、缓存过期、瓦片/session token 403/429、attribution、CDN 回源、截图合规和替代图展示。

### 6. Android Maps / Places SDK

- 证据：package name、SHA-1、API key、target SDK、定位权限、Play services 版本、隐私政策、设备矩阵和地区覆盖。
- 动作：运行时权限、精确/大致位置、生命周期释放、debug/release/upload/app signing 指纹分环境、低电量策略、错误 UI、无 GMS 设备兜底；不要用 Android 限制 key 直接调用后端 WebService API。
- 验证：debug/release 签名、包名/SHA-1 不匹配、拒绝权限、仅大致位置、无网络/弱网、Play services 异常、无 GMS 设备、后台恢复、低端机、崩溃和商店隐私说明。

### 7. iOS Maps / Places SDK

- 证据：bundle id、API key、Info.plist 文案、iOS 版本、精确位置策略、隐私清单、TestFlight/生产包和设备矩阵。
- 动作：权限请求时机、临时精确位置、delegate 生命周期、内存释放、错误态、bundle id key 分环境和 App Store 隐私说明一致；不要用 iOS 限制 key 直接调用后端 WebService API。
- 验证：bundle id 不匹配、TestFlight/生产 key 混用、拒绝权限、仅大致位置、临时精确失败、后台恢复、key 不匹配、弱网、低内存、崩溃和隐私审核证据。

### 8. WebView / 跨端 / 小程序边界

- 证据：宿主平台、WebView 域名、bridge、合法域名、包签名、CSP、网络代理和是否可用原生 SDK 替代。
- 动作：WebView 不传高权限 key；宿主权限与 Web 权限分开；小程序若无 Google Maps 合规能力，应走服务端或替代 provider。
- 验证：域名限制、bridge 泄露、授权拒绝、弱网、宿主生命周期、页面销毁、目标地区不可用和 provider 切换。

### 9. 迁移与多 provider 降级

- 证据：旧 provider、坐标系、字段映射、Place ID 不兼容、路线策略差异、费用差异、地区覆盖和回滚路径。
- 动作：建立 provider adapter；保存 provider 字段；不要混用 Place ID；坐标和地址结果双写或灰度对比；保留旧 provider 回滚。
- 验证：同一地址/POI/路线样本对比、坐标偏移、费用对比、无结果差异、用户反馈和灰度回滚。

## 验证门禁

- Key 门禁：所有 key 均有 API restrictions、application restrictions、环境隔离、负责人、预算告警、轮换、泄露响应和 API disabled 证据。
- 成本门禁：Places session token、字段裁剪/field mask、Routes/Routes Matrix 规模限制、Geocoding 缓存、Tiles 请求限制和异常流量告警通过。
- 坐标门禁：lat/lng 与 lon/lat 边界、WGS84/Web Mercator、GeoJSON、数据库字段、国内业务坐标偏移、固定 golden samples 全部验证。
- 平台门禁：Web、后端、Android、iOS、WebView/跨端的加载、权限、错误、生命周期、无 GMS/弱网和发布包证据齐备。
- 隐私门禁：定位授权、搜索词/地址脱敏、日志最小化、第三方传输、保留期、删除路径和移动商店声明通过。
- 失败门禁：API 未启用、key 被拒、403/429/5xx、无结果、弱网/离线、超时、provider 故障、低端性能和回滚 UI 均验证。
- 性能门禁：首屏地图、脚本加载、marker 数量、路线渲染、移动端帧率、内存、电量和低端设备降级达标。
- 停止门禁：缺 key 限制证据、缺账单告警、无法复现错误、无法跑真实坐标样本、条款/隐私不确定、无回滚路径时不得给可发布结论。
- 发布门禁：官方文档核对、配置截图、版本号、网络样本、截图/录屏、监控面板、账单告警、fallback/rollback 方案齐备。

## 输出要求

- 输出方案必须说明平台、API、key 类型、启用服务、限制策略、费用模型、坐标系、隐私影响和回滚路径。
- 输出代码审查意见必须按阻断、必须修、建议修、观察项分级，优先指出 key、费用、隐私、坐标和服务条款风险。
- 输出排障结论必须包含浏览器/设备、SDK 版本、API 名称、key 限制、请求错误、坐标样本、网络证据和复现步骤。
- 输出测试证据必须覆盖 key 错误、API disabled、403/429/5xx、Places 成本路径、坐标 golden samples、权限拒绝、无 GMS/弱网/离线、低端性能和回滚。
- 输出迁移方案必须列字段映射、provider 差异、坐标差异、Place ID 不兼容、缓存策略、费用差异和灰度验证。
- 不确定 API 可用性、计费、条款或地区覆盖时，必须标注未确认并要求查官方控制台或文档，不凭记忆承诺。

## 安全边界

- 不协助绕过 Google API key 限制、配额、账单、服务条款、attribution、反爬或地图数据授权。
- 不提供批量抓取 Places、POI、瓦片、路线、街景、地理编码结果，或规避缓存/再分发限制的方案。
- 不隐藏、裁剪或覆盖 Google attribution、logo、版权、服务状态提示和必要警示。
- 不把服务端 key、签名密钥、内部代理 token、用户精确位置、轨迹或完整地址写入前端包、公开日志或测试报告。
- 不建议在用户未授权时采集定位、后台追踪、推断家庭/工作地点或上传敏感地点到第三方。
- 不把 Google Maps 结果作为救援、执法、医疗、金融风控等高风险决策的唯一依据。
- EEA 账单地址、儿童导向产品、敏感地点、健康/执法/高风险用途、用户可下游分发地图内容时，必须先做 ToS、Privacy Policy、attribution、Road Safety/地区功能差异和法务确认；未确认前不得给上线结论。

## 反例库

- 反例：所有环境共用一个 unrestricted API key。正确：按平台和环境拆 key，并启用 API 与应用限制。
- 反例：Autocomplete 每次输入后立即请求 Place Details 全字段。正确：使用 session token、用户确认后请求、字段最小化。
- 反例：把服务端 Routes key 打包到移动端。正确：高风险调用走后端代理或受限客户端 key。
- 反例：只判断 HTTP 200，不处理 Google API status/error_message。正确：按 API 错误语义映射业务错误和重试边界。
- 反例：GeoJSON 坐标 lon/lat 传给 LatLng API 后地图点位漂移。正确：在契约和字段名中显式区分坐标顺序。
- 反例：按 address_components[0] 当城市或邮编。正确：按 `types` 找 locality/postal_code/administrative_area，并允许缺失和顺序变化。
- 反例：把 viewport 当行政边界做围栏。正确：viewport 只用于展示取景，bounds 才可能表达包含范围且仍需核对语义。
- 反例：地图上线后没有预算告警。正确：设置预算、配额、异常 QPS 告警和紧急禁用开关。
- 反例：移动端用户拒绝定位后页面空白。正确：允许手动输入、城市默认、粗定位或无地图模式。
- 反例：从国内 provider 迁移后继续使用旧坐标纠偏逻辑。正确：建立坐标账本并用样本点验证。
- 反例：Android/iOS 客户端 key 直接请求 Geocoding、Routes 或 Distance Matrix REST。正确：移动 SDK 用平台受限 key；WebService 走服务端 IP/OAuth/受控代理。
- 反例：保存 Places 全量详情或照片作为本地 POI 库。正确：遵守缓存限制，通常仅 place_id 可长期保存，其它字段按条款和许可最小化。
- 反例：把“roadmap、source map、SEO sitemap、map/filter/reduce”误判为 Google Maps 开发。正确：只有真实 Google Maps Platform 工程动作才触发。

## 自检清单

- [ ] 是否明确使用 Maps、Places、Geocoding、Routes、Static、Tiles、Android SDK、iOS SDK 中哪些能力？
- [ ] 是否所有 key 都按平台/环境隔离，并配置 API restrictions 与 application restrictions？
- [ ] 是否估算调用量、费用、配额、QPS、告警阈值和超额降级？
- [ ] 是否使用 Places session token、field mask、字段裁剪、防抖和用户确认？
- [ ] 是否明确 lat/lng、lon/lat、WGS84、GeoJSON、国内坐标偏移和数据库字段命名？
- [ ] 是否处理权限拒绝、弱网/离线、API 未启用、403、429、5xx、无结果和低置信度？
- [ ] 是否有 Web、后端、Android、iOS、WebView/跨端、无 GMS、低端设备的真实验证证据？
- [ ] 是否完成隐私政策、权限文案、日志脱敏、第三方传输和保留期核对？
- [ ] 是否保留旧 provider、旧 style、旧 key、feature flag 或无地图模式的回滚路径？
- [ ] 是否识别并跳过 Google Search/SEO、source map、roadmap、mind map、site map、map-filter-reduce、旅游建议等误触发？
- [ ] 是否输出官方文档核对、成熟实践缺口、测试证据、停止条件和发布证据？

## 相邻技能边界

- 地图 GIS 核心开发 / map-gis-core（map-gis-core）：负责通用 GIS 坐标、瓦片、空间数据、跨 provider 方法论；本技能聚焦 Google Maps Platform 的 API、key、费用和平台限制。
- Mapbox / MapLibre / mapbox-maplibre（mapbox-maplibre）：负责 Mapbox/MapLibre style、WebGL、MVT、token 和渲染栈；只有迁移或互操作时与本技能联合。
- OpenStreetMap Routing / openstreetmap-routing（openstreetmap-routing）：负责 OSM、Nominatim、OSRM、Valhalla、GraphHopper、自建路线和开源数据条款；不处理 Google Places/Routes 专项。
- JavaScript / TypeScript 开发 / javascript-typescript-development（jsts）：负责几何拓扑、缓冲、相交、简化等算法；本技能只定义 Google 地图消费这些结果的门禁。
- Vue 开发 / vue-development（vue）：负责 Vue 组件生命周期和状态；Google Maps 组件的 GIS、key、费用和隐私门禁由本技能定义。
- API 工程 / api-engineering（api）：负责后端 API 契约、鉴权、错误模型和限流；Google WebService 代理需同时满足本技能的费用和 key 要求。
- 测试验证 / test-engineering（tst）：负责测试体系；本技能提供 Google Maps 专项样本、失败态和发布证据。
- 代码审计 / code-audit（aud）：负责代码审计；本技能提供 key 泄露、费用、隐私、坐标和服务条款审计点。
- Web 安全 / web-security（wsec）：负责 Web 安全；Google key、CSP、代理、防滥用和日志脱敏需联合使用。
- Apple 全链路开发与发布 / apple-development（appl） 、 Android 开发 / android-development（andr） 、 Kotlin 开发 / kotlin-development（kt） 、 Flutter 开发 / flutter-development（fltr） 、 微信小程序 / wechat-miniprogram（wcmp）：负责各平台工程实现；本技能定义 Google Maps SDK/权限/key/隐私的领域门禁。
- 数据库工程 / database-engineering（db）：负责数据建模和迁移；坐标字段、Place ID、地址结构、空间索引需与本技能联合。
- 性能工程 / perf-engineering（pfe）：负责前端性能；地图首屏、marker、脚本、移动端帧率需叠加本技能门禁。
- 发布部署 / release-engineering（rls）：负责发布灰度和回滚；Google key、账单、provider 切换和监控发布证据需满足本技能。
- 可观测性 / observability（obs）：负责可观测性；Google API 错误、配额、账单、定位失败率、地图加载耗时和用户降级需纳入观测。
