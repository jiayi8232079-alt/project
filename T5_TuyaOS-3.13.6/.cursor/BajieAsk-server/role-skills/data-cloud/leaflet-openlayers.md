---
name: leaflet-openlayers
description: Leaflet/OpenLayers Web GIS 地图开发与瓦片服务集成实践技能。
---

# Leaflet / OpenLayers

首次自称：Leaflet / OpenLayers（leaflet-openlayers，兼容 slug: leaflet-openlayers）。

## 定位/适用范围

本技能用于 Web/open-source GIS 项目中，基于 Leaflet 或 OpenLayers 实现地图展示、交互、图层管理、空间数据接入与后端瓦片/服务集成。

适用场景：

- Web 前端地图组件：底图、业务图层、标注、弹窗、绘制、测量、筛选、空间查询。
- 开源 GIS 服务接入：OSM、XYZ/TMS、WMS、WMTS、WFS、GeoJSON、KML、GPX、矢量瓦片等。
- 后端地图服务集成：GeoServer、MapServer、Tegola、TileServer、Martin、PostGIS、对象存储/CDN 瓦片发布。
- 多端边界判断：桌面浏览器、移动浏览器、WebView、Electron、PWA、服务端渲染、Node 后端代理、测试环境。
- 选型判断：轻量交互优先 Leaflet；投影/多源图层/OGC 能力/复杂渲染优先 OpenLayers。

不适用或只做边界说明：

- 原生 iOS/Android 地图 SDK 的具体实现。
- 商业闭源地图 SDK 的密钥、计费、合规策略细节。
- 未授权地图数据采集、破解、批量下载或规避服务限制。
- 深度空间算法实现，优先交给 jsts、PostGIS 或专用 GIS 引擎。

触发与误触发控制：

- 命中：用户要求开发、修改、调试、测试或发布 Leaflet/OpenLayers 地图、OGC 服务接入、瓦片服务、GeoJSON/KML/GPX、投影叠加、地图性能或地图安全问题。
- 命中：虽未点名 Leaflet/OpenLayers，但代码依赖、组件名、图层配置、WMS/WMTS/WFS/XYZ/TileLayer/VectorLayer/GeoJSON 证据表明正在做 Web GIS 地图实现。
- 谨慎：只出现“map”但语境是 source map、hash map、roadmap、mind map、site map、map/filter/reduce、数据结构映射时不得触发本技能。
- 跳过：只读学习、概念解释、入门咨询、README/依赖清单中仅提到库名，且没有修改、调试、测试、部署或代码审查动作。
- 跳过：只做相邻供应商 SDK、后端数据库、通用前端组件、通用安全或通用性能任务；除非明确涉及 Leaflet/OpenLayers 迁移、互操作或地图服务契约。
- 证据不足时先定位代码和需求，不要因“地图”一词直接套用 GIS 门禁。

## 铁律

- 禁止抓取、批量爬取、镜像或预缓存第三方瓦片，除非许可证和服务条款明确允许。
- 禁止隐藏、裁剪、遮挡或淡化数据源要求展示的 attribution、版权、署名和许可证信息。
- 禁止为绕过 CORS、限流、鉴权、计费或许可而搭建任意代理。
- 禁止实现可访问任意 URL 的地图代理；代理必须有 allowlist、协议限制、域名限制、路径限制、大小限制、超时和审计日志。
- 禁止把用户输入直接拼接进 WMS/WFS/瓦片 URL、CQL_FILTER、SQL、文件路径或代理目标。
- 禁止在前端泄露私有服务密钥、长期 token、数据库连接串、内网地址或管理接口。
- 禁止默认使用 OSM 公共瓦片承担生产高流量业务；生产环境必须评估自建、商业或获授权的瓦片服务。
- 禁止跨平台承诺“一套逻辑全端无差异”；必须说明浏览器、WebView、SSR、移动端性能和安全边界。
- 禁止在无测试、无授权、无发布证据的情况下声称地图服务可上线。

## 快速总则

- 先确认业务目标：浏览、编辑、分析、检索、导航、监控、离线或打印，不同目标决定库、数据格式和服务形态。
- 先确认坐标系：常见 Web 地图使用 EPSG:3857，地理数据常为 EPSG:4326；任何叠加异常先查投影、轴序和单位。
- 先确认坐标顺序：GeoJSON、WGS84 数据和 OpenLayers transform 通常用 lon/lat；Leaflet 的 LatLng、setView、marker 常用 lat/lng；二者转换必须显式写清。
- Leaflet 适合轻量、插件生态、简单瓦片和矢量叠加；OpenLayers 适合复杂投影、OGC 服务、多源图层和高控制度。
- 底图、业务图层、交互控件、数据加载、状态管理、鉴权和错误处理必须分层设计，不要混在组件生命周期里。
- 地图服务 URL、图层名、样式名、token、最大缩放、attribution、投影和跨域策略应配置化。
- GeoJSON 优先用于 Web 业务数据交换；KML/GPX 多见于兼容导入导出，需明确字段损失和坐标约定。
- WMS 用于按地图图像渲染图层；WMTS/XYZ/TMS 用于切片；WFS 用于要素查询与编辑；不要把三者职责混用。
- 大数据量矢量渲染优先聚合、分页、视窗裁剪、简化、瓦片化或服务端过滤，不要一次性塞进浏览器。
- Marker clustering 是视觉和交互优化，不是数据权限控制，也不是服务端分页替代品。
- 任何地图上线都必须保留 attribution、错误态、加载态、重试边界、监控和回滚方案。

## 强制流程

1. 需求澄清：确认地图用途、用户量、数据敏感度、授权来源、目标平台、离线需求和性能指标。
2. 选型：在 Leaflet、OpenLayers、矢量瓦片方案、后端渲染方案之间说明取舍，不能只因熟悉而选型。
3. 数据盘点：列出每个图层的数据源、格式、坐标系、更新频率、许可证、attribution、权限和预计体量。
4. 服务契约：为 XYZ/WMS/WMTS/WFS/GeoJSON/KML/GPX 明确 URL 模板、参数、鉴权、CORS、缓存、错误码和超时。
5. 投影验证：用已知坐标点、边界框和叠加底图检查 EPSG、轴序、单位、bounds 和 zoom/resolution。
6. 安全设计：评估 CORS、代理、token、SSRF、XSS、CQL/SQL 注入、上传解析和私有网络暴露风险。
7. 性能设计：确定加载策略、图层可见级别、聚合阈值、简化策略、缓存策略、渲染模式和内存上限。
8. 实现：封装地图初始化、图层工厂、数据适配器、事件桥接、清理销毁和错误处理。
9. 测试：覆盖单元、组件、集成、视觉回归、跨浏览器、移动端、慢网、无网、服务异常和授权失败。
10. 发布：提交许可证/attribution 证据、服务容量证据、性能指标、监控告警、回滚步骤和变更记录。

一遍成功停止条件：

- 若缺少数据授权、服务契约、CRS/轴序、attribution、CORS/鉴权或回滚路径任一关键证据，停止声称可上线，只能输出待补证据清单。
- 若发现瓦片 scraping、任意代理、许可证绕过、私钥前端化、未清理上传内容或位置隐私泄露风险，停止实现并先给安全修正方案。
- 若真实服务无法访问，必须用 GetCapabilities、固定响应样本、契约 mock 或环境说明替代，并标注哪些结论不能外推到生产。
- 若性能指标未覆盖目标数据量、低端设备和移动浏览器，停止扩大范围，先降级为聚合、分页、瓦片化或服务端过滤设计。

## 场景执行卡

### Leaflet 轻量业务地图

- 使用场景：简单底图、点线面叠加、弹窗、少量交互、插件驱动功能。
- 核心动作：初始化地图容器；配置 CRS、中心点、缩放范围；添加 tile layer；添加业务 vector layer；绑定事件；销毁实例。
- 插件策略：优先选择维护活跃、许可证清晰、无全局污染、支持当前 Leaflet 版本的插件。
- 坐标策略：Leaflet API 入参多为 lat/lng；读取 GeoJSON、后端 API 或 bbox 时常为 lon/lat，必须在适配层统一转换，禁止在业务组件里散落交换数组下标。
- 图层策略：tileLayer 必须配置 maxZoom/minZoom、bounds 或 noWrap 边界、errorTile/fallback 策略和 attribution；自定义 pane/zIndex 要记录遮挡关系。
- 风险点：插件冲突、移动端触摸事件、marker 过多、CSS 污染、容器尺寸变化导致渲染错位。
- 必验项：attribution 展示、resize 后地图正常、组件卸载释放监听器、聚合阈值生效。

### OpenLayers 复杂 GIS 地图

- 使用场景：多投影、多 OGC 服务、多图层控制、复杂交互、栅格与矢量混合、精细样式控制。
- 核心动作：定义 View、Projection、Source、Layer、Interaction、Control；按分辨率与范围控制图层显示。
- OGC 策略：WMS 用 Image/Tile source，WMTS 使用能力文档或明确 tile matrix，WFS 用要素请求并解析格式；版本和轴序必须写进契约。
- 坐标策略：OpenLayers View 默认常用 EPSG:3857；业务经纬度进入 View 前用 fromLonLat/transform，导出给 API 前用 toLonLat/transformExtent，禁止把 lon/lat 数组直接当投影坐标。
- 渲染策略：大量要素优先 VectorTile、WebGL/Canvas renderer、declutter、style cache、分辨率级别显示和服务端裁剪；避免 pointermove 每帧遍历全量 feature。
- 风险点：EPSG 定义缺失、轴序错误、resolution/zoom 不一致、style 函数过重、feature 过多。
- 必验项：坐标转换正确、图层顺序正确、服务异常可见、交互可取消、内存不随路由切换增长。

### OSM 与公共瓦片

- 使用场景：开发、低流量演示、符合政策的公开地图展示。
- 核心动作：阅读并遵守 OSM tile usage policy；提供清晰应用标识（代理/脚本可控 User-Agent，浏览器保留合法 Referer）；保留 OpenStreetMap attribution；限制请求量并尊重缓存头。
- attribution 策略：OSM、商业底图、政府数据、遥感影像和业务数据的署名必须逐层记录；切换底图、暗色主题、全屏、打印和移动端时仍须可见。
- 生产策略：高流量、商业、批处理、离线或大量缓存场景应使用自建瓦片、商业供应商或获授权镜像。
- 禁止动作：批量下载瓦片、隐藏署名、绕过限流、伪装客户端、用公共瓦片跑压测、把缓存当作规避授权或计费手段。
- 必验项：请求量评估、缓存策略合规、署名可见、替代服务方案明确。

### WMS/WMTS/WFS 与切片服务集成

- WMS：适合服务端渲染地图图像和 GetFeatureInfo 查询；重点检查 LAYERS、STYLES、FORMAT、TRANSPARENT、CRS/SRS、BBOX、WIDTH、HEIGHT。
- WMTS：适合标准瓦片矩阵；重点检查 TileMatrixSet、matrixIds、origin、resolutions、extent、format 和缓存头。
- WFS：适合要素数据读取或编辑；重点检查版本、typeName/typeNames、outputFormat、filter、分页、坐标系和权限。
- XYZ：常见模板为 z/x/y；重点检查 zoom 范围、tileSize、retina、subdomains、bounds、缓存头、跨域和 attribution。
- TMS：常见模板与 XYZ 的 y 轴方向不同；接入前必须确认服务是否需要反转 y，禁止把 TMS 当 XYZ 直接替换 URL。
- WMTS vs XYZ：WMTS 依赖 TileMatrixSet 和 matrixIds；XYZ 依赖约定模板；不要用 XYZ 参数猜 WMTS 矩阵，也不要忽略官方能力文档。
- GeoServer/MapServer：能力文档、图层名、样式名、版本、输出格式、空间参考、最大要素数和错误格式必须进入契约；不要依赖管理后台临时配置记忆。
- 安全动作：过滤用户参数；限制图层名、样式名、字段名、操作符和排序字段；限制 bbox 面积、返回数量、响应大小和请求频率。
- 注入防护：CQL_FILTER、FILTER、viewparams、SLD、SQL view、propertyName、sortBy 等动态参数必须白名单化或服务端参数化，禁止直接拼接用户输入。
- 必验项：GetCapabilities 解析或人工契约记录、WMS 1.1.1/1.3.0 轴序差异、WMTS matrix 对齐、TMS y 翻转、异常响应处理、CORS/鉴权通过、慢查询不会拖垮前端。

### GeoJSON/KML/GPX 数据接入

- GeoJSON：默认使用 WGS84 经度/纬度顺序；检查 geometry 类型、FeatureCollection、属性字段和空几何。
- 坐标顺序：GeoJSON 坐标数组是 lon/lat，不是 Leaflet LatLng；转换到 Leaflet marker、polyline、bounds 前必须经过适配层，回写 GeoJSON 时也要转回 lon/lat。
- KML：关注样式、文件夹层级、网络链接、图标资源、坐标顺序和潜在 HTML 内容。
- GPX：关注轨迹点、时间、高程、分段、采样密度和隐私信息。
- 上传解析：限制文件大小、类型、压缩深度、外链资源和解析耗时；展示前清理 HTML，禁止脚本、事件属性、危险 URL 和未授权外链资源，防止 XSS 与资源探测。
- 大 GeoJSON：优先使用 bbox 查询、属性筛选、几何简化、分块加载、矢量瓦片、worker 解析或服务端预处理；记录 feature 数、顶点数、属性体积和内存峰值。
- 必验项：投影转换、字段映射、异常文件、超大文件、空数据、恶意 HTML/外链样本和导入导出一致性。

### 投影与坐标问题排查

- 先问数据原始 CRS，再问服务声明 CRS，最后问前端 View CRS。
- 检查 lon/lat 与 lat/lng 是否反了、米与度是否混用、EPSG:4326 与 EPSG:3857 是否直接叠加。
- EPSG:4326 是经纬度坐标系，EPSG:3857 是 Web Mercator 米制投影；任何距离、面积、bbox 和缓冲分析都要确认单位，不能用度数当米。
- 检查 WMS 1.3.0 对部分 CRS 的轴序变化，避免 BBOX 参数顺序错误。
- transformExtent 要使用正确源/目标 CRS；只转换 bbox 四角可能低估曲线边界，跨日期变更线、高纬度和大范围数据要额外验证。
- 对地方坐标系、工程坐标、GCJ-02/BD-09 等平台坐标必须明确合法来源与转换边界。
- 非内置 EPSG（如 4490、4547、本地 CGCS2000 带号）必须通过 proj4 注册定义并在 OpenLayers 中 register（ol/proj/proj4），Leaflet 通过 proj4leaflet 提供 CRS，禁止默认 EPSG:3857 假设。
- 用已知控制点、城市边界、bbox 和比例尺交叉验证，不能只凭视觉“差不多”。

### Marker clustering 与大规模点

- 适用：成百上千至数万点的浏览与概览，具体阈值取决于设备和样式复杂度。
- 前端聚合：适合中小数据量和低频更新；必须视窗加载、节流事件、降低 DOM marker 数量。
- 服务端聚合：适合大数据量、高并发、动态筛选、多租户权限或统计口径固定的场景。
- 聚合工具：Leaflet 可评估 markercluster/supercluster/canvas marker；OpenLayers 可用 Cluster source 或服务端聚合；选择依据必须包含数据量、更新频率、样式复杂度和移动端表现。
- 风险点：聚合后误导数量、权限泄露、点击展开卡顿、频繁重算、移动端内存高。
- 必验项：缩放切换流畅、筛选后数量一致、权限过滤先于聚合、低端设备可用。

### 点击、选择与 hit detection

- Leaflet：区分 marker、path、GeoJSON layer 和自定义 pane 的点击事件；弹窗数据必须来自 feature id 或后端查询，不能信任前端隐藏属性。
- OpenLayers：使用 forEachFeatureAtPixel 或 getFeaturesAtPixel 时配置 hitTolerance、layerFilter 和交互状态；透明填充、多图层叠加和 declutter 会影响命中结果。
- WMS GetFeatureInfo：点击查询必须携带正确 CRS/SRS、BBOX、WIDTH、HEIGHT、I/J 或 X/Y、QUERY_LAYERS；跨版本轴序和高 DPI 会影响命中位置。
- 性能边界：pointermove hover、框选、绘制吸附和高亮要节流；大图层命中优先空间索引、后端查询或矢量瓦片属性查询。
- 必验项：重叠要素、多图层、移动端触摸、高 DPI、地图旋转或缩放动画期间命中一致，且权限过滤先于详情展示。

### CORS、代理与后端服务

- 优先让地图服务正确配置 CORS、鉴权和缓存头，而不是前端绕过。
- 必须代理时，只代理明确 allowlist 的地图服务；禁止任意 URL 参数代理。
- 代理应限制方法、协议、域名、路径、查询参数、响应大小、内容类型、超时和重定向。
- 对内网服务、元数据地址、本机地址、云厂商凭据地址必须默认拒绝。
- 后端应记录请求方、目标服务、耗时、状态码、响应大小和拒绝原因，便于审计。

### 性能、离线 offline 与缓存 cache 稳定性

- 控制图层数量、feature 数、顶点数、DOM marker 数、样式计算、重绘频率和图片资源大小。
- 对 move、zoom、pointermove、draw 等高频事件做节流、防抖或按需启用；style 函数不得在每帧做重 IO、复杂计算或创建大量对象。
- 使用 bbox、zoom、filter、pagination、simplification、tiling、vector tiles、clustering、worker 或服务端预处理降低前端负担。
- 矢量瓦片适合大规模只读展示和样式化渲染；必须验证 tile extent、buffer、坐标转换、样式层级、点击查询误差和服务端权限过滤。
- 离线/缓存只用于已授权场景；Service Worker、IndexedDB、Cache Storage、MBTiles/PMTiles 或本地包必须有容量上限、过期策略、版本清理、署名保留和撤权方案。
- 路由切换、弹窗关闭、图层移除时必须解绑事件、取消请求、清理 source 和释放对象引用。
- 对慢网、离线、瓦片 403/429/5xx、空图层、token 过期、CORS 失败提供明确 UI 状态、退避策略和用户可理解错误。

### 测试与发布证据

- 单元测试：图层配置、URL 参数、投影转换、数据适配、权限过滤、错误处理。
- 组件测试：地图容器初始化、图层切换、弹窗、绘制、聚合、销毁和 resize。
- 集成测试：真实或契约化 WMS/WMTS/WFS/瓦片/GeoJSON 服务，覆盖 GetCapabilities、鉴权、CORS、axis-order CRS、空数据、异常 XML/JSON 和超时。
- 瓦片测试：覆盖 XYZ/TMS/WMTS 的 200、204/空瓦片、403、404、429、5xx、慢响应、缓存命中、token 过期、跨域失败、y 轴翻转和 fallback 图层。
- 视觉回归：关键 zoom、bbox、底图、业务图层、attribution、图例、主题样式、移动屏幕和高 DPI。
- 交互测试：覆盖 hit detection、GetFeatureInfo、重叠要素、hover 高亮、绘制编辑、框选、触摸和权限过滤后的详情展示。
- 性能证据：首屏时间、瓦片请求数、feature/顶点数、marker clustering 阈值、hit detection 延迟、交互帧率、内存曲线、低端设备和移动浏览器结果。
- 发布证据：许可证、署名截图、服务容量、监控面板、告警、provider/layer 回滚、变更记录和已知限制。

## 验收/验证门禁

上线或合并前必须满足：

- 已记录所有地图和数据源的许可证、attribution、服务条款和使用限制。
- OSM 或第三方瓦片使用方式符合政策，没有批量抓取、隐藏署名或违规缓存。
- 所有外部地图服务 URL、图层、字段和过滤参数有 allowlist 或严格校验。
- CORS 策略明确；若使用代理，已通过 SSRF、开放代理和响应大小限制检查。
- 坐标系、投影、bbox、zoom/resolution 已用控制点和边界测试验证。
- WMS/WMTS/WFS/GeoJSON/KML/GPX 至少覆盖成功、空数据、异常响应、超时和鉴权失败。
- XYZ/TMS/WMTS 切片坐标、缩放级别、matrix、y 轴方向、缓存策略和 fallback 已验证。
- Leaflet lat/lng 与 GeoJSON/OpenLayers lon/lat 的转换边界有测试覆盖。
- hit detection、GetFeatureInfo 和详情查询在重叠图层、移动端、高 DPI 和权限过滤下可追溯。
- 地图组件卸载后无明显事件监听器、请求、定时器和对象引用泄漏。
- 高数据量场景已提供聚合、裁剪、分页、瓦片化或服务端过滤策略。
- 离线包、缓存、预取和 CDN 策略符合数据源授权、署名、撤权和容量限制。
- 移动端、WebView、SSR 禁用或降级路径已验证，不假设 DOM、window 或 WebGL 一定存在。
- 测试、性能、许可证和发布证据可追溯。

## 输出要求

每次给出方案或变更时，输出应包含：

- 选型结论：Leaflet、OpenLayers、服务端渲染、矢量瓦片或组合方案，以及选择理由。
- 数据清单：图层、格式、CRS、来源、许可证、attribution、权限、更新频率和数据量。
- 服务契约：XYZ/WMS/WMTS/WFS/API URL 形态、鉴权、CORS、缓存、超时、错误处理。
- 坐标契约：EPSG、轴序、lon/lat 与 lat/lng 适配点、bbox 单位、transform 位置和控制点验证结果。
- 安全说明：禁止项确认、代理限制、输入校验、密钥处理、SSRF/XSS/注入防护。
- 性能方案：加载边界、聚合/简化/分页/瓦片化、hit detection、事件节流、内存释放和设备边界。
- 验收证据：测试范围、截图或日志、性能指标、署名截图、发布和回滚证据。
- 风险与取舍：尚未验证的服务、数据授权、投影疑点、浏览器限制和后续补强项。

## 安全边界

- 地图数据可能包含住址、轨迹、设备位置、敏感设施或个人信息；默认按敏感数据处理，采集和展示精度必须最小化。
- 用户当前位置、轨迹回放、设备点位和敏感设施不得无提示采集、长期保存、公开分享或写入可被第三方读取的日志。
- 前端地图权限只用于展示控制，真实权限必须在后端查询、瓦片生成或要素服务层执行。
- KML/GPX/GeoJSON 上传可能携带恶意 HTML、外链、超大几何、压缩炸弹或隐私轨迹，必须限制并清理。
- WFS、CQL_FILTER、SQL view、动态样式和图层参数必须防注入，字段和操作符要白名单化。
- 代理不得访问 file、localhost、内网网段、云元数据服务、管理接口或未授权第三方服务。
- 不帮助规避许可证、流量限制、token 校验、Referer 限制、署名要求或付费墙。
- 不提供批量下载公共瓦片、去水印、去署名、破解坐标偏移、绕过审计的实现方案。
- 对跨境地图、国家边界、敏感地理信息和测绘合规问题，只提示需要法律与合规审查，不替代专业意见。

## 反例库

- 反例：直接把 OSM 公共瓦片用于高流量生产业务。修正：评估自建、商业服务或明确授权的瓦片源。
- 反例：为了界面干净隐藏 attribution。修正：按数据源要求持续可见展示署名和许可证。
- 反例：后端提供 /proxy?url= 任意转发地图请求。修正：改为 allowlist、限制参数、拒绝内网和记录审计。
- 反例：用户输入直接拼接 CQL_FILTER。修正：字段、操作符和值分别白名单和编码，必要时服务端参数化。
- 反例：一次加载 20 万 GeoJSON feature 到浏览器。修正：服务端过滤、瓦片化、分页、聚合或简化。
- 反例：只在本机 Chrome 看地图正常就上线。修正：补跨浏览器、移动端、慢网、异常服务、授权失败验证。
- 反例：把 EPSG:4326 坐标当 EPSG:3857 渲染。修正：明确 View CRS 和数据 CRS，并做转换验证。
- 反例：把 Leaflet marker 的 lat/lng 直接写回 GeoJSON。修正：写回前转成 GeoJSON lon/lat，并用控制点测试。
- 反例：把 TMS URL 当 XYZ URL 接入。修正：确认 y 轴方向、TileMatrixSet 或服务文档，再做 y 翻转测试。
- 反例：Marker 聚合前端完成权限过滤。修正：后端先做租户和权限过滤，再返回可聚合数据。
- 反例：pointermove 每次遍历 10 万 feature 做 hover。修正：节流、空间索引、按 zoom 加载或服务端查询。
- 反例：离线包缓存第三方瓦片但未确认授权。修正：改用获授权数据、自建瓦片或禁用离线缓存。
- 反例：把私有 tile token 写进前端仓库。修正：使用短期 token、后端签发、域名限制和最小权限。
- 反例：导入 KML 时直接渲染 balloon HTML。修正：清理 HTML、禁用脚本和外链，限制资源加载。

## 自检清单

- 是否明确 Leaflet 与 OpenLayers 的选型理由，而不是混用 API？
- 是否确认每个图层的数据源、授权、署名和服务条款？
- 是否避免 OSM 或第三方瓦片被批量抓取、压测、镜像或违规缓存？
- 是否保留并验证 attribution 在所有主题、尺寸和平台下可见？
- 是否明确 EPSG、轴序、bbox、zoom/resolution 和投影转换？
- 是否区分 WMS、WMTS、WFS、XYZ、TMS、GeoJSON、KML、GPX 的职责？
- 是否测试 Leaflet lat/lng、GeoJSON lon/lat、OpenLayers projection transform 的转换点？
- 是否为 CORS 和代理设计了安全边界，而不是任意转发？
- 是否处理大数据量、低端设备、移动端和 WebView 的性能限制？
- 是否验证 hit detection、WMS GetFeatureInfo、重叠图层、触摸和高 DPI 场景？
- 是否在组件卸载、路由切换、图层关闭时释放资源？
- 是否覆盖服务异常、空数据、超时、token 过期、CORS 失败、瓦片 403/429/5xx、缓存过期和离线状态？
- 是否验证 GetCapabilities、WMS 轴序、WMTS matrix、WFS 分页/过滤和 GeoServer/MapServer 错误响应？
- 是否有 marker clustering、大 GeoJSON、低端设备、移动浏览器、provider/layer 回滚和许可证证据？
- 是否拒绝许可证绕过、署名隐藏、SSRF、任意代理、未清理 HTML/外链和瓦片 scraping 请求？

## 相邻技能边界

- 地图 GIS 核心开发 / map-gis-core（map-gis-core）：规划中的通用 GIS 概念、CRS、OGC、空间数据治理基础；本技能聚焦 Leaflet/OpenLayers 落地。
- JavaScript / TypeScript 开发 / javascript-typescript-development（jsts）：复杂几何运算、拓扑判断、缓冲、相交、合并等交给 jsts；本技能只定义何时调用与如何验证。
- Vue 开发 / vue-development（vue）：Vue 组件生命周期、响应式状态、路由缓存和组件封装由 vue 技能处理；本技能只强调地图实例清理和事件边界。
- API 工程 / api-engineering（api）：后端地图 API、鉴权、分页、缓存、错误契约由 api 技能处理；本技能定义 GIS 服务契约需求。
- 测试验证 / test-engineering（tst）：测试框架、mock、端到端测试和覆盖率策略由 tst 技能处理；本技能列出地图相关测试门禁。
- 代码审计 / code-audit（aud）：许可证、归因、合规审计和发布证据审查由 aud 技能处理；本技能提供地图数据审计输入。
- Web 安全 / web-security（wsec）：SSRF、XSS、CORS、token、上传解析和代理安全由 wsec 技能深入处理；本技能给出地图特有风险触发点。
- 数据库工程 / database-engineering（db）：PostGIS、空间索引、空间查询和数据建模由 db 技能处理；本技能只说明前后端服务边界。
- 性能工程 / perf-engineering（pfe）：前端性能、内存、渲染、资源加载由 pfe 技能深入处理；本技能给出地图性能约束。
- 发布部署 / release-engineering（rls）：发布流程、回滚、变更记录和环境门禁由 rls 技能处理；本技能要求地图发布证据。
- 可观测性 / observability（obs）：日志、指标、告警、追踪和仪表盘由 obs 技能处理；本技能定义地图服务监控信号。