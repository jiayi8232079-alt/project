---
name: mapbox-maplibre
description: Mapbox GL JS 与 MapLibre GL JS 地图渲染、style spec、sources/layers、瓦片、3D、移动端、后端瓦片和 deck.gl 互操作的安全、性能与发布门禁。
---

# Mapbox / MapLibre

首次自称：Mapbox / MapLibre（mapbox-maplibre，兼容 slug: mapbox-maplibre）。

## 定位/适用范围

- 触发本技能必须同时满足：任务涉及 Mapbox GL JS、MapLibre GL JS、Mapbox/MapLibre 移动 SDK、style spec、tile/vector tile/glyph/sprite/source/layer、地图 token/provider/attribution/offline/cache、地图 WebGL/deck.gl 叠加，且用户要求设计、修改、调试、迁移、测试、发布或安全评审之一。
- 明确不触发：source map、hash map、roadmap、mind map、site map、map/filter/reduce、知识导览、入门学习、只读解释、README/依赖清单中仅出现 mapbox/maplibre 名称但无修改/调试/测试/部署动作。
- 相邻 provider 任务默认不触发：仅讨论 Google Maps、AMap、高德、百度、Leaflet、Cesium、OpenLayers、通用 GIS 或纯后端 API 时，由对应技能处理；只有迁移、替换、互操作或同一页面并存涉及 Mapbox/MapLibre 时才触发。
- 适用于 Web 端 Mapbox GL JS、MapLibre GL JS、React/Vue/原生前端地图、WebView 地图、管理后台 GIS 可视化和用户端地理交互。
- 适用于 style JSON、vector tiles、raster tiles、GeoJSON sources、sprites、glyphs、sources/layers、terrain、3D buildings、custom layers、controls、markers、popups、feature state 与表达式样式。
- 适用于 camera、fitBounds、flyTo/easeTo、交互事件、hover/select、cluster、queryRenderedFeatures、feature-state、promoteId 和局部状态渲染。
- 适用于 Mapbox、MapLibre、自建 TileServer、Martin、Tegola、Tippecanoe、PMTiles、CDN 瓦片、对象存储、边缘缓存、后端瓦片代理和权限网关。
- 适用于 deck.gl、luma.gl、nebula.gl、three.js custom layer、MapboxOverlay、MapLibre interop 等 WebGL 叠加渲染场景。
- 适用于 Android/iOS Mapbox Maps SDK、MapLibre Native、Flutter/React Native 地图库选型和 WebView 嵌入时的生命周期、授权、缓存、隐私与性能评估。
- 不替代地图数据授权、测绘审图、隐私法务、采购合同、商用计费确认；涉及 license、offline、缓存、再分发、遥测和数据出口必须由责任人确认。

## 铁律

- Token、密钥和瓦片签名不得硬编码进仓库、移动包、前端源码、日志、Sentry、埋点或可逆配置；客户端可见 token 必须最小权限、域名或包名限制、URL scope 限制、限额、轮换和泄露告警。
- Mapbox 与 MapLibre 不是同一授权和服务模型：Mapbox GL JS v2+、Mapbox 服务、Mapbox 移动 SDK、MapLibre GL JS、MapLibre Native、自建瓦片和第三方 provider 的 license、计费、遥测、离线和缓存条款必须逐项核对。
- 不能把 Mapbox token 用在不受控的第三方 style、tile URL、glyph URL 或 sprite URL 中；任何 style JSON 外链都要审查协议、host、鉴权、CORS、缓存和供应商条款。
- 公开地图必须显示合法 attribution、logo 或版权声明；不得通过 CSS、Canvas 覆盖或自定义控件隐藏 provider 要求的版权信息。
- style JSON、tile URL、source URL、sprite/glyph URL 视为配置入口和供应链入口；禁止直接加载用户可控 URL，必须做 allowlist、签名、CSP、超时和大小限制。
- style spec 不是“能显示就通过”：version、source 类型、source-layer、layer type、filter/expression、sprite、glyphs、terrain、projection、metadata、minzoom/maxzoom 和 attribution 都必须逐项验证。
- 坐标系与瓦片协议必须明确：Mapbox/MapLibre 默认经纬度为 WGS84 lon/lat，显示投影通常为 Web Mercator；国内底图叠加、GCJ-02/BD-09 数据和业务坐标不得盲叠。
- camera 与交互不能破坏业务语义：fitBounds padding、bearing、pitch、maxBounds、scrollZoom、boxZoom、dragPan、touchZoomRotate、gesture 冲突和移动端手势拦截必须实机验证。
- WebGL 性能是发布门禁：低端机、移动浏览器、集成显卡、长会话、tab 切换、GPU context lost、内存增长和帧率下降必须验证。
- 地图实例必须按框架生命周期创建、resize、暂停、恢复和销毁；不得在路由切换、弹窗开关、KeepAlive 或热更新后遗留 WebGL context、事件监听和 worker。
- CORS、glyph、sprite、tile、style、RTL text、font stack 任一失败都必须有可观测错误、用户降级或运营兜底；不能只在控制台报错。
- 离线包、瓦片缓存、sprite/glyph 缓存、业务矢量数据缓存和用户定位缓存必须符合 provider 条款、隐私政策、保留期和清理策略。
- 发布必须附官方文档/规格核对结论、版本与 license 选择理由、token 限制证据、失败截图、性能数据、兼容矩阵和回滚方案。
- 发现用户意图只是学习、资料整理、依赖识别或命名误触发时，停止进入实现流程，只输出“不适用本技能”的边界说明和应转交技能。
- 任何一处授权、token、attribution、用户定位隐私、SSRF 代理、瓦片抓取或离线缓存证据缺失，必须先阻断上线或合并，不得用“后续补充”放行。

## 快速总则

### 单技能工程门禁

- 先锁定 Mapbox 还是 MapLibre、自建还是托管、Web 还是移动、在线还是离线、商业还是内部使用；未确定 provider/license/token/cache/attribution 前不得写接入代码。
- 所有坐标输入必须标明 WGS84 lon/lat、WebMercator/EPSG:3857、GCJ-02 或 BD-09；GeoJSON 默认 lon/lat，国内底图叠加必须先做坐标系验收。
- 每个 style/source/layer 变更必须写清 source id、layer id、字段 schema、zoom 范围、数据量、更新频率、失败态、性能预算和回滚 style。
- 客户端 token 必须是最小权限、域名/包名限制、配额/告警和可轮换；自建 tile/glyph/sprite 代理必须有 allowlist、限流、防 SSRF 和缓存策略。
- 上线前必须做失败注入：style 404、tile 403/429/5xx、glyph/sprite 404、WebGL context lost、低端机、移动端弱网、provider 中断和 token 失效。

### 低级错禁止清单

- 禁止把 Mapbox token、secret token、tile 签名或自建代理高权限 token 写入前端包、移动包、日志或截图。
- 禁止 MapLibre 直接加载需要 Mapbox 授权的 mapbox:// style、glyph、sprite 或 tile URL 后宣称可替代 Mapbox。
- 禁止隐藏 attribution/logo，或用截图/Canvas 覆盖版权信息。
- 禁止把 lat/lng 和 lon/lat 混用，尤其 GeoJSON、bbox、fitBounds、后端 API 和业务 DB 字段之间必须显式转换。
- 禁止未限制用户输入的 style/tile/glyph/sprite URL；任何开放代理都必须先按 SSRF 风险处理。
- 禁止大规模数据全量 GeoJSON setData 高频刷新；达到规模边界必须改 MVT、聚合、分块或服务端裁剪。
- 禁止只在高配开发机验证 3D、deck.gl、terrain、大量 layer 和移动 WebView。
- 禁止无 provider 条款确认就离线缓存、批量预热、抓取、再分发瓦片、字体、影像或 POI。
- 禁止把 cluster 当后端权限或统计真相；cluster 只是一种视口/zoom 渲染聚合，服务端导出、搜索和审计必须使用后端权威查询。
- 禁止把 feature-state 当持久数据；刷新 style、切 source、重载 tile 或重新 setData 后必须能恢复 hover/select/编辑状态。
- 禁止 raster、DEM、影像、字体和 sprite 只看可视效果；必须分别核授权、缓存、DPR、CORS、色彩、透明度、重采样和离线边界。

### 服务差异速查

- Mapbox GL JS：重点核 Mapbox 服务条款、账号 token、style URL、Mapbox-hosted tilesets、billing、telemetry、logo/attribution、Standard Style slot 和版本兼容。
- MapLibre GL JS：重点核开源渲染内核版本、MapLibre Style Spec 兼容、自建或第三方 provider 授权、glyph/sprite/tile endpoint、插件兼容和无 Mapbox token 运行证据。
- Mapbox-hosted tilesets：重点核 tileset id、source-layer 名、字段 schema、上传/更新链路、缓存刷新、配额、账单、数据授权和回滚版本。
- 自建 vector/raster/DEM tiles：重点核 z/x/y 范围、tilematrix、MVT layer name、extent/buffer、压缩、cache-control、CORS、CDN purge、空瓦片语义和非法 tile 防护。
- PMTiles/对象存储：重点核 range request、索引大小、CDN 对 Range 的支持、版本化路径、缓存失效、离线授权和客户端内存峰值。
- 移动 SDK 与 WebView：重点核包名/bundle id 限制、离线 region、磁盘缓存清理、定位权限、后台生命周期、隐私清单和商店审核材料。

### 交互与状态专项

- Camera：每个 flyTo/easeTo/fitBounds/jumpTo 都要写明触发来源、目标坐标、zoom/pitch/bearing、动画时长、padding、maxBounds、取消条件和可访问性降级。
- Interactions：click、mousemove、mouseenter、mouseleave、touch、drag、box select、scroll zoom、popup、marker 和 deck.gl picking 要明确事件归属、冒泡、节流、防重复注册和销毁。
- Feature state：使用前必须有稳定 id 或 promoteId；状态只放 hover/select/temporary UI，不放权限、价格、库存等业务真相；style reload 后要有恢复策略。
- Cluster：必须明确 cluster radius、maxZoom、聚合字段、展开逻辑、spiderfy/分页策略、跨 zoom 一致性和与后端统计的差异提示。
- Query：queryRenderedFeatures 是渲染结果查询，受 zoom、filter、visibility、symbol collision 和 tile 加载影响；不能替代数据库查询、权限校验或导出。
- Editing：绘制、拖拽、吸附、撤销、保存前必须明确 CRS、精度、几何合法性、跨 tile 边界、并发冲突、后端校验和失败回滚。

- 先选渲染内核和 provider，再定 style、tiles、glyphs、sprites、token、缓存、attribution、遥测、离线、移动端策略和回滚方案。
- Mapbox GL JS 偏向 Mapbox 托管服务生态和商业能力；MapLibre GL JS 偏向开源渲染内核和自建/多 provider 瓦片，但仍要核对底图与数据授权。
- style JSON 是地图产品的运行时契约：version、sources、layers、sprite、glyphs、terrain、projection、metadata、zoom 范围和外链 host 都要审查。
- sources 决定数据加载和缓存边界，layers 决定渲染顺序和性能；任何新增图层都要说明 source 类型、数据量、zoom 范围、filter、paint/layout 表达式和可见性。
- vector tiles 要控制属性字段、几何简化、extent、buffer、tile size、maxzoom、minzoom、layer name 和 schema 兼容；样式表达式不得依赖不稳定字段。
- sprites 和 glyphs 要按字体、语言、主题、DPR、CDN、缓存、CORS 和 fallback 设计；中文、阿拉伯语、RTL、emoji、缺字和 404 要测试。
- terrain/3D 要评估 DEM 来源、夸张系数、fill-extrusion 数量、阴影、相机 pitch、深度排序、移动端帧率和可访问性。
- deck.gl 互操作要明确谁拥有 WebGL context、相机同步、事件冒泡、pick 逻辑、图层重建频率和资源释放责任。
- 后端 tiles 要默认带缓存、限流、范围限制、鉴权、观测、schema 版本和灰度；禁止无上限 bbox、全量 GeoJSON 或未裁剪 MVT 直出。
- 移动 SDK 要额外核对包体、ABI、离线 region、磁盘缓存、定位权限、生命周期、电量、后台限制、隐私清单和平台商店要求。
- 验收必须按资源类型拆开：style、vector tile、raster tile、DEM、glyph、sprite、image、worker、RTL text、deck.gl layer、business API 各自有成功、失败、超时和降级证据。

## 强制流程

0. 触发校验：先排除 source map、hash map、roadmap、mind map、site map、map/filter/reduce、只读学习和 provider-only 误触发；缺少修改/调试/测试/发布/迁移动作时停止。
1. 需求定界：确认平台、地区、底图 provider、地图数据来源、是否商用、是否离线、是否 3D、是否定位、是否用户可上传地理数据、是否需要 deck.gl 或移动端。
2. 规范对照：按当前官方文档概念核对 Mapbox GL JS、MapLibre GL JS、Mapbox Style Specification、Vector Tile Specification、移动 SDK、offline/cache/token 条款和 deck.gl 互操作实践；记录版本差异，不照搬未验证示例。
3. 授权对照：列出 Mapbox、MapLibre、自建瓦片、第三方数据、字体、图标、DEM、卫星影像、离线缓存和遥测条款；给出可用、受限、禁止的结论。
4. Token 设计：定义 token 类型、scope、域名/包名/IP 限制、URL 限制、环境隔离、轮换周期、限额、告警、泄露响应和代理策略。
5. Style 审查：审查 style JSON 外链、sources、layers、glyphs、sprite、terrain、metadata、attribution、表达式复杂度、zoom 范围和 fallback。
6. 数据契约：为 GeoJSON、MVT、raster、DEM、sprite、glyph、PMTiles 或 API source 定义 CRS、字段、schema 版本、大小限制、缓存头、错误码和兼容策略。
7. 生命周期设计：按框架确定 map 实例创建、container resize、事件订阅、worker、image/icon 注册、source/layer 更新、路由切换和 destroy 时机。
8. Camera/交互设计：定义初始视口、fitBounds、动画、pitch/bearing、maxBounds、手势、popup/marker、query、hover/select、cluster 和编辑流程。
9. 性能预算：设定首屏时间、style load 时间、tile 请求数、并发、内存、FPS、source 数、layer 数、feature 数、deck.gl layer 数、移动端温升和降级阈值。
10. 安全隐私评估：确认 CSP、CORS、URL allowlist、反向代理、日志脱敏、定位授权、精度降级、保留期、第三方传输、遥测开关和用户删除路径。
11. 实现与观测：接入 load/error/sourcedata/styledata/webglcontextlost 等关键事件，记录 provider、style version、source id、tile URL host、错误码和性能指标。
12. 验证门禁：执行授权、token、CORS、tile、glyph、sprite、样式、camera、交互、cluster、feature-state、性能、内存、移动端、离线、隐私、兼容、回滚测试；证据不足不得发布。
13. 发布闭环：灰度、监控、告警、账单保护、CDN 回源保护、provider 状态页、feature flag、旧 style 保留和回滚步骤齐备后上线。

## 场景执行卡

### 1. Mapbox GL JS 接入

- 证据：SDK 版本、license、Mapbox 账号与项目、token scope、域名限制、style URL、服务用量、attribution、遥测设置和浏览器矩阵。
- 动作：只暴露受限 public token；生产 style 与 token 分环境；错误和计费事件接入监控；不得把高权限 token 放入前端。
- 验证：token 缺失、域名不匹配、超限、style 404、tiles 403、账单异常、浏览器 WebGL 不可用、attribution 展示和回滚 style。

### 2. MapLibre GL JS 接入

- 证据：MapLibre 版本、自建或第三方 tile provider、style spec 兼容性、plugin 兼容性、字体与 sprite 来源、license 和 CDN 策略。
- 动作：确认 style 是否使用 Mapbox 专有 URL 或不兼容字段；替换为可授权的 tile/glyph/sprite endpoint；处理 CSP、CORS 和字体 fallback。
- 验证：无 Mapbox token 情况、第三方瓦片 403、glyph 404、sprite 缺图标、样式表达式兼容、插件版本和低端设备性能。

### 3. Style JSON 与主题切换

- 证据：style 版本、source/layer 列表、主题变量、图标集、字体栈、语言策略、projection、terrain、外部 URL 和 schema 变更记录。
- 动作：把 style 当成可版本化资产；主题切换保留业务 source/layer 的重挂载策略；用户配置不得直接拼接到 style URL。
- 验证：深浅色切换、语言切换、缺图标、缺字体、图层顺序、业务图层重建、旧 style 回滚和缓存失效。

### 4. Sources 与 Layers

- 证据：source 类型、数据规模、更新频率、zoom 范围、filter、cluster、promoteId、feature-state、layer 顺序和交互需求。
- 动作：按 viewport/zoom 加载；大数据优先 MVT 或聚合；频繁状态变化用 feature-state 或局部更新；避免整量 setData 高频调用。
- 验证：万级/百万级要素、快速缩放拖拽、频繁筛选、hover/select、图层隐藏显示、内存增长和事件解绑。

### 5. Vector Tiles 与 MVT

- 证据：瓦片生成工具、schema、layer name、字段白名单、maxzoom、extent、buffer、简化策略、压缩、缓存和数据授权。
- 动作：服务端裁剪和简化；属性最小化；schema 版本化；热点瓦片预热；错误瓦片返回明确状态；敏感字段不得进入 MVT。
- 验证：边界瓦片、跨 tile 线面连续性、label 去重、字段缺失、旧 schema、缓存穿透、超大 tile、gzip/brotli 和 CDN 命中率。

### 5.1 Raster、Tileset 与 PMTiles

- 证据：raster/DEM/影像来源、tile size、scheme、min/maxzoom、bounds、tilematrix、DPR、颜色空间、透明度、缓存头、Range 支持和授权条款。
- 动作：raster 与 vector 分 source 管理；tileset schema 版本化；PMTiles 使用版本化 URL；CDN 支持 range、etag、immutable 或可控 purge；空瓦片和过期瓦片有语义。
- 验证：Retina、透明叠加、深浅主题、跨 zoom 重采样、CDN 命中、Range 失败、对象存储 403、离线包、缓存 purge、旧 tileset 回滚和授权边界。

### 6. Sprites、Glyphs 与多语言

- 证据：sprite 生成链路、icon 命名、DPR、font stack、glyph range、RTL 插件、中文字体、CDN、缓存和授权。
- 动作：图标和字体做版本化；字体缺失有 fallback；CORS 和 cache-control 正确；不要把未授权商业字体打进 glyph 服务。
- 验证：Retina、暗色主题、中文/英文/阿拉伯文、缺字、emoji、sprite 404、glyph 404、缓存旧版本和弱网加载。

### 7. Terrain、3D 与相机

- 证据：DEM 来源、terrain exaggeration、3D building 数据、fill-extrusion 数量、光照、pitch/bearing 交互、移动端目标 FPS 和降级方案。
- 动作：限制 3D 图层可见 zoom；低端机关闭阴影/地形/抗锯齿；相机动画节流；限制 pitch/bearing 边界；避免 3D 与大量透明图层叠加。
- 验证：低端移动端、集显电脑、长时间旋转、pitch 最大值、DEM 缺 tile、建筑穿插、深度排序、眩晕可用性和截图基线。

### 7.1 Camera、Controls 与交互

- 证据：初始视口、用户定位、fitBounds 输入、maxBounds、控件列表、手势策略、popup/marker、hover/select、编辑工具和键盘/触屏可访问性。
- 动作：相机状态与业务状态分离；动画可取消；移动端禁用冲突手势；事件统一注册和解绑；marker 大量场景改 symbol layer；popup 内容做 XSS/长度控制。
- 验证：快速点击、拖拽缩放、双指旋转、键盘导航、弹窗遮挡、路由切换、重复进入页面、触屏滚动冲突、坐标边界和动画中断。

### 7.2 Feature State、Cluster 与查询

- 证据：feature id/promoteId、cluster 配置、聚合字段、queryRenderedFeatures 场景、选中态恢复、style reload 行为和后端权威查询接口。
- 动作：hover/select 用 feature-state；筛选和权限走 source/filter 或后端；cluster 展开和详情查询走稳定 id；导出和统计不依赖渲染查询。
- 验证：style reload、source 更新、tile unload/reload、快速 hover、批量选中、cluster 展开、跨 zoom 数量、symbol collision、隐藏图层和后端统计一致性。

### 8. deck.gl 互操作

- 证据：deck.gl 版本、MapboxOverlay 或 MapLibreOverlay 方式、图层数量、pick 需求、事件优先级、坐标系、数据更新频率和 shader/custom layer。
- 动作：统一相机和 WebGL context 管理；避免重复渲染循环；大数据用 binary attributes 或分块；路由销毁时释放 deck 和 buffers。
- 验证：hover/click 冲突、地图拖拽、tooltip、图层重建、context lost、内存释放、SSR 禁用、热更新和截图对比。

### 9. 后端瓦片与代理

- 证据：TileServer/Martin/Tegola/自研服务、PostGIS/对象存储、PMTiles、CDN、鉴权、缓存、QPS、bbox/zoom 限制和租户隔离。
- 动作：服务端校验 z/x/y、范围、租户和权限；热点预生成或缓存；冷门异步生成；错误分桶；禁止代理任意外部 URL。
- 验证：越权瓦片、非法 z/x/y、爬取、缓存击穿、回源洪峰、慢 SQL、空瓦片、schema 灰度、CDN purge 和降级底图。

### 10. 移动 SDK 与 WebView

- 证据：Android/iOS SDK 名称与版本、license、包名/bundle id 限制、离线条款、磁盘缓存、定位权限、隐私清单、包体和设备矩阵。
- 动作：按生命周期暂停/恢复/销毁 map；定位权限最小化；缓存可清理；WebView bridge 不传高权限 token；离线区域遵守授权。
- 验证：冷启动、后台恢复、旋转、低内存、权限拒绝、仅大致位置、离线包过期、磁盘清理、崩溃日志和商店隐私审核。

### 11. CORS、CSP 与资源失败

- 证据：style、tile、sprite、glyph、API、worker、WASM、image、font 的 host、协议、响应头、鉴权和重试策略。
- 动作：CSP allowlist 精确到需要的域；跨域头按资源类型配置；4xx 不无限重试；错误 UI 和监控要区分资源类型。
- 验证：CORS 预检、Referer 限制、403/404/429/5xx、证书过期、HTTP/HTTPS 混用、CDN 旧缓存和第三方服务中断。

### 12. 离线、缓存与隐私

- 证据：provider 条款、缓存范围、TTL、用户位置数据、瓦片授权、离线包分发、清理入口、加密和审计。
- 动作：只缓存被授权资源；敏感位置按最小精度和最短保留；离线数据按账号/租户隔离；提供清理和撤回路径。
- 验证：离线启动、缓存过期、账号切换、退出登录清理、设备丢失、未授权区域、条款变更和隐私导出/删除请求。

### 13. Provider 迁移与互操作

- 证据：源 provider 与目标 provider、style spec 差异、URL scheme、token 模型、attribution、tile schema、字体图标、插件、移动 SDK、离线/cache 条款和回滚目标。
- 动作：逐项替换 style/tile/glyph/sprite endpoint；保留旧 style/provider feature flag；不要把相邻 provider-only 需求误改成 Mapbox/MapLibre 方案。
- 验证：双栈灰度、相同视口截图对比、图层顺序、坐标偏移、token 401/403、429/配额、provider 5xx、旧 provider 回滚和账单监控。

## 验证门禁

- 停止条件：触发校验不成立、license/attribution/offline/cache/token 结论不明、生产 token 无限制、用户可控 URL 未加 allowlist、代理存在 SSRF、定位隐私未评审、性能预算无法达成、回滚路径缺失时必须停止实现或发布。
- 证据要求：每个门禁至少保留版本号、配置截图或配置路径、网络/控制台错误截图、设备与浏览器信息、复现步骤、监控指标和责任人结论；没有证据等同未通过。
- 官方对照：至少记录 Mapbox GL JS 或 MapLibre GL JS 版本、对应 style spec/source/layer 文档、Vector Tile/tileset 规格、deck.gl interop 文档和 provider token/license 条款的核对日期。
- 授权门禁：确认 Mapbox/MapLibre/provider/license/attribution/offline/cache/telemetry 条款已评审并记录结论。
- Token 门禁：生产 token 最小权限、域名/包名/IP 限制、限额、告警、轮换和泄露演练证据齐备。
- 资源门禁：style、tile、sprite、glyph、DEM、font、image 全部 host allowlist、CORS、缓存头、错误态和 fallback 通过。
- 样式门禁：style JSON 版本化、schema 审查、外链审查、图层顺序、表达式性能、主题切换和回滚测试通过。
- 性能门禁：首屏、交互 FPS、tile 请求数、内存、CPU/GPU、长会话、移动端温升和低端设备降级达到预算。
- 生命周期门禁：路由切换、弹窗、tab、resize、KeepAlive、热更新、destroy、context lost 和事件解绑无泄漏。
- 交互门禁：camera、controls、hover/select、popup/marker、cluster、feature-state、queryRenderedFeatures、编辑流程和移动端手势均有真实设备或浏览器证据。
- 数据门禁：坐标顺序、CRS、MVT schema、GeoJSON 大小、敏感字段、属性白名单和矢量瓦片简化策略通过。
- 安全门禁：CSP、URL allowlist、代理防 SSRF、日志脱敏、用户 URL 禁止直连、越权瓦片和租户隔离测试通过。
- 隐私门禁：定位授权、精度最小化、第三方传输、遥测、保留期、删除路径和移动商店隐私说明通过。
- 发布门禁：灰度、监控、账单告警、错误分桶、provider 状态页、feature flag、回滚 style 和回滚 provider 方案齐备。
- 失败注入门禁：必须分别覆盖 style 加载失败、tile 403/404/429/5xx、glyph 404、sprite 404、font 缺失、WebGL context lost、移动端低内存、权限拒绝、离线包过期和 provider 中断。
- 一次成功门禁：上线前必须能用同一份证据包回答“为什么选这个内核/provider、哪些资源会失败、如何降级、如何控费、如何保护位置隐私、如何回滚、如何证明交互和状态不丢失”。

## 输出要求

- 输出任何方案前先给触发结论：说明为何属于 Mapbox/MapLibre 地图任务；若只是 source map/hash map/roadmap/mind map/site map/map-filter-reduce 或只读学习，必须明确转出而非套用本技能。
- 输出接入方案时必须说明：Mapbox 还是 MapLibre、provider、SDK 版本、style 来源、tile 来源、glyph/sprite 来源、token 策略、license 结论和 attribution 要求。
- 输出技术设计时必须列出：sources/layers 清单、数据量级、zoom 范围、更新频率、性能预算、失败态、缓存策略和安全边界。
- 输出问题排查时必须给出：浏览器/设备、SDK 版本、style URL 或版本、source id、layer id、tile/glyph/sprite host、错误码、网络截图、坐标样本和复现步骤。
- 输出迁移方案时必须比较：API 兼容、style spec 差异、token/provider 差异、插件兼容、移动 SDK 差异、离线/缓存条款、性能风险和回滚路径。
- 输出发布报告时必须附：官方文档/规格核对摘要、license/provider 决策、token 限制截图或配置证据、性能测试、失败截图、隐私结论和监控面板。
- 输出修复结论时必须列出已验证资源失败类型、性能设备矩阵、移动权限/离线/cache 证据、token 错误处理、403/429/5xx 处理和 style/provider 回滚方式。
- 不输出可直接泄露 token 的示例 URL；如需展示 URL，必须脱敏 token、签名、租户、用户坐标和内部域名。

## 安全边界

- 不协助绕过 Mapbox、第三方 tile provider、字体、影像、离线包或商业数据的授权、计费、attribution、反爬、缓存和再分发限制。
- 不把服务端高权限 token 下发到前端、移动端、WebView 或日志；需要受控访问时使用后端代理、短期签名或最小 scope token。
- 不接受用户输入任意 style/tile/glyph/sprite URL 直接加载；必须经过 allowlist、协议限制、大小限制、超时、CSP 和审计。
- 不实现开放式瓦片转发、截图导出、批量下载或预热任务来规避 provider 配额、反爬、授权、attribution 或账单；所有高 QPS 入口必须有限流、熔断、预算告警和租户隔离。
- 不把精确定位、家庭/公司地址、轨迹、搜索地点和敏感 POI 作为普通日志、崩溃报告或第三方遥测字段上传。
- 不在未经授权的情况下离线缓存、批量抓取、转存、切片、再分发商业底图、卫星影像、POI、字体或地形数据。
- 不以 WebGL benchmark 单机高配结果代表真实用户；低端机和移动端必须有降级和关闭重特效能力。
- 不用全量 GeoJSON 承载大规模动态数据；达到性能边界时必须改为 MVT、聚合、服务端裁剪或分层加载。
- 不把 Mapbox 与 MapLibre 的 API、license、插件、style URL、移动 SDK 行为默认等价；迁移必须逐项验证。

## 反例库

- 反例：把 Mapbox secret token 写进前端环境变量并打包发布。正确：前端只用受限 public token，高权限操作走后端代理并加审计。
- 反例：MapLibre 直接加载 mapbox:// style，线上发现 token、glyph 和 sprite 全部 401。正确：迁移 style 外链到授权 provider 或自建资源。
- 反例：新增 200 个 symbol/fill/line layer 后只在开发机验证。正确：设置 layer/source 预算，在低端机和移动浏览器测 FPS、内存和交互。
- 反例：每次筛选都对 5 万点 GeoJSON 高频 setData。正确：服务端切片、聚合、feature-state 或局部数据更新。
- 反例：隐藏 attribution 让 UI 更干净。正确：按 provider 要求展示版权和 logo，设计上预留位置。
- 反例：只测试 style load，不测试 glyph/sprite 404。正确：分别模拟 style、tile、glyph、sprite、DEM、font 失败并验证降级。
- 反例：Web 路由离开后不 remove map，返回页面越来越卡。正确：统一生命周期释放 map、deck、worker、事件和 WebGL buffer。
- 反例：把用户轨迹点原样写入前端日志。正确：脱敏、采样、最小化、限定保留期，敏感定位不上报第三方。
- 反例：自建瓦片代理接受任意 url 参数转发。正确：只允许固定 provider 和路径模板，校验 z/x/y、租户、权限和速率。
- 反例：采购允许在线展示就默认允许离线包。正确：离线、缓存、再分发和移动端条款单独确认。
- 反例：GeoJSON 用 lat,lng 顺序导致点位落海。正确：GeoJSON 和 Mapbox/MapLibre 坐标数组使用 lon,lat，并在 API 边界写转换测试。
- 反例：MapLibre 迁移只替换 npm 包，不替换 style/glyph/sprite/tile host。正确：逐项核对外链 host、授权、CORS、style spec 兼容和 attribution。
- 反例：把 20MB GeoJSON 直接塞进前端 source。正确：按 zoom/viewport 切片、聚合、简化或改 MVT/PMTiles。
- 反例：离线缓存瓦片用于客户二次分发。正确：先确认 provider 条款、授权范围、缓存期限、清理和审计。
- 反例：WebGL context lost 后只刷新页面。正确：监听 context lost/restored，释放资源，提供降级底图和错误上报。
- 反例：用 queryRenderedFeatures 导出“当前城市全部门店”。正确：导出走后端权限查询，渲染查询只服务当前视口交互。
- 反例：cluster 数字被当成全局统计。正确：cluster 只解释当前 source、zoom 和视口聚合，统计口径由后端返回。
- 反例：hover 选中态写入业务数据库。正确：feature-state 只放临时 UI 状态，持久状态走后端事务和权限校验。
- 反例：fitBounds 只传两个点，移动端被面板遮住。正确：按安全区和面板设置 padding，并验证旋转、横竖屏和小屏。
- 反例：PMTiles 上线后 CDN 不支持 Range，首屏整包下载。正确：上线前验证 Range、缓存头、对象存储 403 和首屏请求瀑布。
- 反例：Mapbox Standard Style 迁移到 MapLibre 后图层插入位置错乱。正确：核 slot/beforeId 兼容策略和目标 style 的真实 layer id。

## 自检清单

- 是否先排除了 source map、hash map、roadmap、mind map、site map、map-filter-reduce、只读学习、README/依赖-only 和相邻 provider-only 误触发？
- 是否明确 Mapbox、MapLibre、自建或第三方 provider 的选择理由、license、计费、离线、缓存、遥测和 attribution？
- 是否所有 token 都有最小权限、环境隔离、域名/包名/IP 限制、限额、告警、轮换和泄露响应？
- 是否审查 style JSON 的外链、sources、layers、glyphs、sprite、terrain、projection、metadata 和表达式复杂度？
- 是否为 CORS、CSP、403、404、429、5xx、glyph 缺失、sprite 缺失、tile 空白和 WebGL 不可用准备了降级？
- 是否定义 sources/layers 数量、feature 数量、tile 请求数、内存、FPS、CPU/GPU、移动端温升和长会话预算？
- 是否验证路由切换、resize、tab 切换、KeepAlive、destroy、context lost、deck.gl 释放和 worker 清理？
- 是否明确 GeoJSON/MVT/PMTiles/DEM 的 CRS、schema、字段白名单、敏感字段、缓存头和版本兼容？
- 是否覆盖单技能工程门禁、低级错禁止清单、lon/lat 坐标顺序、token 限制、失败注入和离线授权？
- 是否覆盖 camera、controls、interactions、feature-state、cluster、queryRenderedFeatures、popup/marker 和编辑状态恢复？
- 是否覆盖 raster、DEM、PMTiles、tileset 版本、Range/CDN、缓存失效、透明叠加、DPR 和授权边界？
- 是否测试中文、多语言、RTL、Retina、暗色主题、字体授权、glyph range 和 sprite DPR？
- 是否评估 terrain/3D 对低端机、移动端、电量、可访问性、深度排序和截图基线的影响？
- 是否验证移动 SDK 的权限、生命周期、离线 region、磁盘缓存、包体、隐私清单、崩溃和商店审核？
- 是否有发布证据：官方文档/规格核对、成熟实践对照、性能报告、安全隐私结论、监控和回滚方案？
- 是否能在一次交付中给出停止条件、失败注入结果、设备矩阵、token/provider/style 回滚和账单/配额保护证据？

## 相邻技能边界

- 地图 GIS 核心开发 / map-gis-core（map-gis-core）：负责通用 GIS、坐标系、OGC、POI、路线、定位、空间数据和跨平台地图总门禁；本技能聚焦 Mapbox/MapLibre 渲染栈、style spec、WebGL、token/provider 和瓦片资源链路。
- JavaScript / TypeScript 开发 / javascript-typescript-development（jsts）：负责前端/后端几何拓扑、缓冲、相交、简化等空间计算；本技能只规定 Mapbox/MapLibre 展示层如何消费和验证结果。
- Vue 开发 / vue-development（vue）：负责 Vue 组件、组合式 API、生命周期和状态管理；本技能只规定在 Vue 中地图实例、DOM 容器、事件和销毁的地图专属要求。
- API 工程 / api-engineering（api）：负责后端 API 契约、鉴权、错误码和限流；本技能只覆盖瓦片、style、glyph、sprite、GeoJSON/MVT endpoint 的地图语义。
- 测试验证 / test-engineering（tst）：负责测试策略和自动化体系；本技能提供地图渲染、资源失败、性能、隐私和发布证据的专项门禁。
- 代码审计 / code-audit（aud）：负责代码审计和工程质量；本技能提供地图 token、URL、license、生命周期和 WebGL 泄漏的审计关注点。
- Web 安全 / web-security（wsec）：负责 Web 安全；本技能聚焦地图资源 URL、CSP/CORS、token、代理 SSRF、用户可控 style 和定位隐私。
- Apple 全链路开发与发布 / apple-development（appl） 、 Android 开发 / android-development（andr） 、 Kotlin 开发 / kotlin-development（kt） 、 Flutter 开发 / flutter-development（fltr）：负责 Apple、Android、Kotlin、Flutter 平台实现；本技能只规定 Mapbox/MapLibre 移动 SDK 的授权、生命周期、缓存、离线和隐私边界。
- 微信小程序 / wechat-miniprogram（wcmp）：负责小程序/Web 组件平台差异；本技能只覆盖 WebView 或组件中嵌入地图的 token、域名、生命周期和性能风险。
- 性能工程 / perf-engineering（pfe）：负责前端性能体系；本技能提供 WebGL、tile、layer、source、worker、内存和 FPS 的地图专项预算。
- 发布部署 / release-engineering（rls）：负责发布与回滚流程；本技能要求地图 style/provider/token/CDN/监控/账单的发布证据和回滚门禁。
- 可观测性 / observability（obs）：负责可观测性；本技能定义地图资源错误、性能指标、provider 状态、账单和用户体验的埋点维度。