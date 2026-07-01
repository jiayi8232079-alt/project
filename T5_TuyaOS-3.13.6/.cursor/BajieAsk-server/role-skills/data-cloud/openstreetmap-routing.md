---
name: openstreetmap-routing
description: Build and operate OSM-based geocoding, routing, tiles, matrix, isochrone, map matching, and Overpass features safely across web, mobile, and backend services.
---

# OpenStreetMap Routing

首次自称：OpenStreetMap Routing（openstreetmap-routing，兼容 slug: openstreetmap-routing）。

## 定位/适用范围

本技能用于在真实项目中一次性做好 OpenStreetMap 生态相关功能，覆盖 Web、移动端、后端服务与内部平台：

- 数据底座：OpenStreetMap 数据、ODbL 许可、署名、数据导入、区域抽取、增量更新与数据新鲜度。
- 地理编码：Nominatim 正向/反向地理编码、搜索、去重、缓存、隐私与公共端点限制。
- 路由与导航：OSRM、Valhalla、GraphHopper 的路径规划、步行/骑行/驾车/多模式、备选路线、步骤指引、通行成本。
- 批量计算：matrix/table、isochrone、map matching、nearest/snap、trip/optimization 等服务能力。
- OSM 查询：Overpass 面向小到中等范围、带空间/标签约束的只读查询。
- 地图瓦片：公共 tile.openstreetmap.org 的合规使用、商业/高流量替代、矢量/栅格瓦片自托管。
- 边界拆分：geocoding、routing、tiles、Overpass、traffic 是不同服务面，不能用一个端点、缓存/cache 或许可证判断互相替代；自托管/self-hosting 也要按服务面分别设计。
- 交付目标：让功能能上线、可压测、可回滚、可替换供应商，且不滥用公共端点。

不用于仅解释地图概念、纯旅游路线推荐、只改 Leaflet/OpenLayers UI、只接 Google/高德/百度/腾讯/天地图/Mapbox/ArcGIS 的项目，除非任务明确涉及 OSM 迁移、互操作或替代方案。

触发与误触排除：

- 应触发：用户要实现、修改、调试、测试、部署或审计 OSM/Nominatim/OSRM/Valhalla/GraphHopper/Overpass/瓦片/自托管导入更新相关代码、配置、数据管道、配额、缓存、监控或发布门禁。
- 应触发：项目证据显示正在调用 nominatim.openstreetmap.org、tile.openstreetmap.org、overpass-api.de、router.project-osrm.org、Valhalla/GraphHopper API，或存在 osm2pgsql、osmium、osmosis、osrm-backend、valhalla、graphhopper、Overpass、Nominatim 配置。
- 谨慎触发：README、依赖、示例配置或 onboarding 文档只有 OSM 词汇但用户没有要求修改、调试、测试或发布时，先按只读分析处理，不扩大到实现。
- 不触发：source map、hash map、roadmap、mind map、site map、map/filter/reduce 等非地理地图语义；旅行建议、消费出行路线推荐、学习概念问答；只读浏览资料；只改 README 或依赖说明且没有 OSM 行为变更；只接相邻商业地图供应商且无迁移/互操作/许可混用。

## 铁律

- 先判定端点属性：公共演示/公益端点只用于低频开发、演示或小规模非关键用途；生产、高频、商业、批量、离线、预取、自动补全、平台核心能力必须使用付费供应商或自托管。
- 不把 public endpoint 当后台基础设施：禁止用公共 Nominatim、OSM 瓦片、Overpass 或 OSRM demo 承载业务 SLA、批处理、批量用户流量或代理转售。
- Nominatim 公共端点最大 1 req/s 按应用整体计（绝对硬上限，不是建议值）；必须设置可识别应用的 User-Agent 或 HTTP Referer（库默认值如 `python-requests/2.x`、`Java/1.8`、`okhttp/4.x`、`curl/8.x` 视为违规，会被封禁）；结果展示必须给出 https://osm.org/copyright 链接；必须缓存；长期或重复批处理按更严限速与自托管处理；禁止客户端自动补全、系统性采集、网格反查、POI 抽取、详情页自动下载。
- tile.openstreetmap.org 必须使用 https://tile.openstreetmap.org/{z}/{x}/{y}.png；必须设置可识别应用的 User-Agent（通用库默认值会被封）；最大 zoom 19，禁止请求 z>19；必须显示 OpenStreetMap 署名（含 https://osm.org/copyright 链接），遵守缓存头；禁止批量下载、预取、离线包、区域预热、高效转发分发和隐藏 Referer/User-Agent。
- Overpass 公共实例（overpass-api.de）经验软上限约 10000 查询/日、1GB/日下载；默认 `[timeout:25][maxsize:1073741824]`（25 秒、1GB），调高需有理由；只做有边界、有标签、有目的的只读查询；不要用它做国家级下载、POI 大规模抓取、复制数据库或无限重试；生产/重复批量必须自托管 Overpass 或换 Geofabrik extract + PostGIS。
- ODbL 与署名不可后补：任何展示、导出、缓存、派生数据库、报表、截图、移动离线包都必须在设计阶段确认署名与许可证义务。
- 经纬度顺序必须逐服务确认：OSRM HTTP 路径参数为 `lon,lat`（`/route/v1/{profile}/{lon1,lat1};{lon2,lat2}`，常见坑），多数前端库和 GeoJSON 也用 `lon,lat`；Valhalla/Nominatim/GraphHopper JSON 用 `{lat,lon}` 字段名；很多业务表单和地理编码响应常以 `lat/lon` 命名，转换必须有测试。
- ODbL 区分两层：从 OSM 派生的“数据库/数据集”（derivative database，如导入的 PostGIS、自家 POI 库、地理编码索引）必须以 ODbL 公开或在公开服务中按 ODbL 处理；“产出物”（produced work，如渲染瓦片图、单条路线 JSON、截图、PDF 报表）可用其他许可证但必须保留 OSM 署名；导出/分发派生数据库前必须明确许可证传递。
- OSM 原始数据不提供实时交通：OSRM/Valhalla/GraphHopper 默认使用静态道路图和 profile 成本；traffic、拥堵、封路、事件、限行、道路施工必须来自授权外部 feed 或内部运营数据，并写明更新时间、覆盖范围、许可、回退和“不含实时交通”的用户文案。
- geocoding、routing、tiles 不可混用：地理编码返回的是地址/POI 与坐标候选；路由返回沿道路网络的路径、耗时和指引；瓦片只是地图底图渲染。不能用瓦片截图解析道路，不能用地理编码结果代替 snap to road，不能用 route geometry 反推可再分发道路数据库。
- 位置数据默认敏感：不要把精确住址、实时轨迹、家庭/工作点、儿童/医疗/宗教/政治等敏感位置发送到不受控公共服务；日志默认脱敏、降精度、限期保留。
- 所有外部服务调用必须有超时、重试上限、退避、熔断、配额、监控、降级文案和可切换 provider 配置。
- 绝不实现开放代理：任何 OSM 生态后端代理都必须有鉴权、来源校验、应用级配额、租户隔离、日志脱敏和滥用封禁。
- 没有数据版本、导入时间、端点政策、压测和回归样例的变更，不准发布到生产。
- 证据不足立即停止：无法确认端点政策、流量规模、许可证署名、公共/自托管属性、位置隐私或回滚路径时，不继续编码上线方案，先要求补齐信息或降级为安全默认。

## 快速总则

1. 先问“谁承担流量与责任”：前端直连只适合低风险公开调用；生产通常应通过后端网关统一鉴权、限流、缓存、审计与 provider 切换。
2. 先问“是否能用公共端点”：只要有批量、核心业务、商业 SLA、自动补全、高并发、离线、预取、爬取、坐标轨迹隐私，就默认不能用公共端点。
3. 先问“要什么能力”：搜索用 Nominatim/商业 geocoder；路径用 OSRM/Valhalla/GraphHopper；等时圈用 Valhalla/GraphHopper；矩阵用 OSRM table、Valhalla matrix 或 GraphHopper matrix；道路匹配用 OSRM match、Valhalla trace 或 GraphHopper map matching；POI/标签查询用 Overpass 或离线 OSM 数据库。
4. 先问“数据多久更新”：地图展示、路线、地理编码、Overpass 查询可能来自不同更新时间的数据源；页面与运维必须能暴露或记录 planet/extract/import timestamp。
5. 先问“许可如何传递”：UI 署名、API 响应中的 license 字段、导出文件说明、缓存/派生库元数据、第三方图层署名都要一致。
6. 先问“失败时怎么退”：无路由、无匹配、限流、配额耗尽、外部 5xx、数据过旧、跨境不可达都要有用户可理解的降级。
7. 先问“是否需要实时路况”：若要 traffic-aware ETA、避堵、封路绕行或动态限行，必须单独设计 traffic provider、融合策略和测试；没有 traffic feed 时只能交付静态 OSM 路网估算。

## 强制流程

1. 任务定界
   - 明确功能：geocoding、reverse geocoding、routing、matrix、isochrone、map matching、nearest、Overpass 查询、tile rendering、自托管导入或迁移。
   - 明确平台：Web、iOS、Android、后端 API、批处理、内部工具、CI、数据管道。
   - 明确规模：QPS、日请求量、用户数、区域、峰值、批量任务、缓存命中率目标、离线需求。
   - 明确数据更新：PBF 来源、diff 更新频率、route graph rebuild 策略、tile cache 失效、geocoder import lag、traffic feed 是否存在。
   - 明确数据敏感性：是否包含个人地址、实时定位、轨迹、配送/出行订单、精确家庭位置或受监管数据。

2. 端点与许可证决策
   - 标注每个调用是公共端点、商业服务、自托管还是内部缓存。
   - 对公共 Nominatim、OSM tiles、Overpass、OSRM demo 写明“开发/低频/非 SLA”限制和替换计划。
   - 写出 OSM/ODbL 署名位置、导出文本、数据缓存生命周期、派生数据库 share-alike 风险。
   - 若用户要求绕过署名、批量抓取、隐藏来源、伪装 UA、规避限流，直接拒绝并给合规替代。

3. 架构设计
   - 后端统一 provider adapter：请求模型、响应归一化、错误码、超时、限流、缓存键、版本标识。
   - 缓存分层：浏览器/移动端遵守 HTTP 缓存；服务端缓存 geocode 和 route 结果时设置 TTL、区域粒度、key hash 与失效策略。
   - 可观测性：记录 provider、endpoint、status、latency、cache_hit、rate_limited、data_version、import_timestamp，不记录原始敏感地址或完整轨迹。
   - 配置化：endpoint、API key、profile、locale、region、timeout、max_locations、max_route_distance、matrix size、isoline ranges 必须可配置。

4. 实现
   - 坐标、距离、时间、时区、语言、国家/区域过滤、道路侧 approach/curbside、车辆/模式 costing 都要显式建模。
   - 对所有数组参数做数量上限和一一对应校验，例如 OSRM bearings/radiuses/approaches 与坐标数量匹配。
   - 对 oneway、turn restrictions、access、barrier、maxspeed、height/weight、surface、bicycle/foot/private 等 OSM tag 的支持范围做 profile 级声明；profile 不支持的限制不得在 UI 中承诺。
   - 对用户输入做规范化：地址去空格、国家/城市 bias、bbox/viewbox 限制、语言 Accept-Language、重复请求合并。
   - 对轨迹和矩阵做降采样、分块、排队和背压；禁止把一次大请求拆成并发风暴打向公共服务。

5. 验证与发布
   - 用固定样例覆盖成功、无结果、无路、跨水域/跨国、地址歧义、坐标顺序错误、限流、超时、provider 切换。
   - 用区域抽样验证 OSM 数据新鲜度、路由 profile、限制道路、单行线、turn restrictions、步行/骑行差异、不可达点和禁行/限高/限重边界。
   - 必测错误：Nominatim 403/429/5xx 与 policy hit；OSRM InvalidUrl/InvalidService/InvalidVersion/InvalidOptions/NoRoute/NoTable/NoMatch/TooBig；Valhalla/GraphHopper 参数错误、额度耗尽、不可达、trace 无匹配；Overpass timeout/maxsize/too many requests；瓦片 403/429/5xx 与缓存失效。
   - 发布前提供端点政策符合性、许可证/署名截图、压测结果、缓存命中率、隐私日志审计和回滚方案。
   - 停止条件：任一公共端点会承担生产/批量/自动补全/离线/预取/高并发；任一敏感位置未脱敏外发；任一 matrix/map matching/isochrone 缺少尺寸上限；任一自托管数据缺少 extract timestamp 或 replication freshness；任一 provider 无降级/回滚。

## 场景执行卡

### Nominatim 地理编码

- 适用：低频搜索、地址标准化、反向地理编码、开发验证；生产高流量或自动补全使用商业服务或自托管。
- 必做：设置唯一可识别应用的 User-Agent/Referer（禁止使用 `python-requests`、`okhttp`、`Java/1.x`、`curl/*`、空 UA、伪造浏览器 UA 等通用值，必须包含应用名+联系方式或域名）；应用级限速不超过公共政策（绝对 1 req/s）；缓存结果；在 UI 或 API 响应中暴露 `https://osm.org/copyright` 链接与 `license` 字段；支持 provider 切换；持续超过一天或重复批处理不要走公共端点，确有小型一次性任务也要单线程、单机器、可中断。
- 公共政策证据：交付时写明公共端点是否使用、全应用 1 req/s 如何落实、缓存 TTL、UA/Referer 文案、联系邮箱或项目标识、禁止 autocomplete 与批量采集的实现证据。
- 查询设计：用 countrycodes、viewbox、bounded、accept-language 降低歧义；保存 place_id/osm_type/osm_id/display_name/lat/lon/license；不要只按文本盲搜。
- 隐私：避免把个人完整地址和精确坐标发往公共端点；批量清洗地址必须走自托管或合规供应商。
- 禁止：客户端自动补全、网格 reverse、POI 抽取、详情页批量下载、把公共 API 包装成自家收费 geocoder。

### OSRM 路由与矩阵

- 适用：高速道路图上的低延迟 route、nearest、table、match、trip；适合自托管车行/步行/骑行 profile。
- 必做：确认坐标 `lon,lat`（路径形如 `/route/v1/driving/lon1,lat1;lon2,lat2`，profile 通常为 `driving|walking|cycling`）；按需指定 `geometries=polyline|polyline6|geojson`、`overview=full|simplified|false`、`steps=true|false`、`alternatives`、`continue_straight`；限制坐标数、距离、profile；处理 `NoRoute`、`NoTable`、`NoMatch`、`NoSegment`、`TooBig`、`InvalidOptions`；可用 `hints` 复用 snap 结果但必须在同一后端版本内（图重建/contract 后 hint 全部失效，必须丢弃缓存）。
- table/matrix：限制 sources/destinations 尺寸（公共 demo 通常 ≤100 点）；对批量矩阵排队；明确 `durations` 单位秒、`distances` 单位米，距离是最快路上的距离而非最短路；缺失对返回 `null`，必须处理。
- map matching：传 `timestamps`（Unix 秒）、`radiuses`（每点 GPS 误差米，默认 5，城市峡谷/隧道需放大到 20-50）；处理 `gaps=split|ignore`、`tidy=true` 抖动去噪、outlier `null`、低采样和大时间间隔会触发 `NoMatch`；不要把高频实时轨迹原样长期存日志。
- snap/nearest：只用于把点吸附到当前 graph 的候选道路，不能当成地址解析或道路合法性证明；限制半径、候选数、profile 和距离阈值，超过阈值必须返回“未匹配”而不是强行落到最近道路。
- 自托管：记录 extract/contract/customize 时间和 data_version；profile 变更、PBF diff 累积异常或 turn restriction 处理器变更必须重新处理数据；内存和磁盘容量按区域评估。
- 发布证据：提供真实错误响应映射、坐标顺序测试、table 尺寸上限、match 点数/时间跨度上限、公共 demo 禁用或只开发使用的配置证明。

### Valhalla 路由、等时圈与多模式

- 适用：多交通方式、turn-by-turn、matrix、isochrone、map matching/trace、elevation、locate、带 costing 的复杂路线。
- 必做：`locations` 用 `[{"lat":..,"lon":..,"type":"break|via|through|break_through"}, ...]`（注意是 `lon` 不是 `lng`，type 默认 `break`，决定是否产生 maneuver）；`costing` 取值限于 `auto|bicycle|pedestrian|motorcycle|motor_scooter|truck|bus|taxi|multimodal`，并配套 `costing_options.{costing}`（如 `auto.use_highways`、`pedestrian.walking_speed`、`bicycle.bicycle_type`）；为 mode、avoid_locations/polygons、units（`kilometers|miles`）、language、`date_time.type` 建模型；限制 locations、contours、trace 点数和范围。
- 等时圈：`isochrone` 一次最多约 4 个 contours，`contours: [{"time":15}|{"distance":5}]`（time 单位分钟、distance 单位千米，不可混用），返回 GeoJSON Polygon/MultiPolygon 或 LineString；限制时间阈值、轮廓数量、区域大小；结果用于近似可达性分析，不当成法定边界或安全承诺。
- 多模式：GTFS/公交数据是额外输入，不等于 OSM 自带；必须记录 GTFS 版本、服务日历和过期策略。
- map matching/trace：`trace_route|trace_attributes`，`shape_match=edge_walk|map_snap|walk_or_snap`，每点可带 `time`、`accuracy`（米，类似 OSRM radius），`search_radius` 控制 snap 半径；trace 点数有上限（默认 ~16k，单次请求建议 <3000 点）。
- traffic：Valhalla 可接入实时或预测交通数据，但这不是 OSM 自带能力；必须验证 traffic archive/tiles 的来源、时间窗口、覆盖区域、过期策略和与静态 graph 的版本兼容。
- 自托管：维护 tiles/graph build、OSM extract、timezone/admin/elevation/transit 数据版本；暴露 status 给健康检查。
- 发布证据：isochrone contour 上限、matrix locations 上限、trace 点数上限、错误码归一化、GTFS 过期检测和 graph build 时间必须可查。

### GraphHopper 路由、矩阵、等时圈与匹配

- 适用：商业 API 或自托管开源引擎上的 route、matrix、isochrone、map matching；适合需要运营配额和 SLA 的项目。
- 必做：区分 GraphHopper Directions API 与自托管开源能力；按套餐/credits/limits 设计配额，注意各端点 credits 消耗差异（`route`≈1 credit/请求、`matrix` 按 NxN 累计、`isochrone` 按返回的等时圈数量、`map-matching` 按轨迹点数/距离），矩阵和等时圈很容易把每日配额一次打爆；处理 profile、vehicle、locale、points、snap prevention 等参数差异。
- 生产：把 API key 放后端；监控 credits 消耗、4xx/429/5xx、延迟和配额预警；不可在移动端硬编码可滥用密钥。
- 迁移：与 OSRM/Valhalla 对齐单位、polyline 精度、错误码、路线指引字段和 matrix 尺寸限制。
- traffic：确认套餐或自托管版本是否真的支持 traffic-aware routing；没有明确 traffic 数据源时，不要把静态 ETA 包装成实时 ETA。
- 发布证据：套餐/credits/限额、429/402/403/5xx 处理、matrix/isochrone/map matching 配额、API key 后端隔离和异常消费告警必须有测试或配置截图。

### Overpass 查询

- 适用：按区域、标签、对象类型获取 OSM 元素，例如某 bbox 内 amenity、highway、building 的小到中等规模查询。
- 必做：先用 Overpass Turbo 验证；`[out:json][timeout:25][maxsize:1073741824]` 是公共实例默认，写明显式值且 timeout 不要盲调到上百秒；限制 bbox/area/tag；读取响应中 `osm3s.timestamp_osm_base` 判断数据新鲜度（通常 1-3 分钟前）。
- 频率：遵守实例政策；overpass-api.de 经验安全线约为 <10000 查询/日、<1GB/日下载，并发实例建议 ≤2；超出或关键业务应自托管 Overpass 或换 Geofabrik extracts。
- 性能：避免递归全量、国家级 bbox、无限 around、按网格扫全国；失败后退避，不立即重复昂贵查询。
- 替代：批量/大范围/重复 POI 数据用 planet/Geofabrik extracts、PostGIS/osm2pgsql、自己的 Overpass 或商业数据。
- 发布证据：查询 bbox/area/tag、timeout/maxsize、osm_base 时间、最大返回量、退避策略和失败降级必须固定；不能把 Overpass 结果当永久同步源。

### OSM 瓦片与自托管

- 公共瓦片：只用于合规低流量展示；公共政策不承诺固定额度或 SLA；必须显示“© OpenStreetMap contributors”并链接到 https://www.openstreetmap.org/copyright；遵守 `Cache-Control/Expires/ETag`，不支持缓存头时至少缓存 7 天；不能 no-cache；最大 zoom 19，禁止请求或拼接 z>19；禁止预取、离线下载、批量抓取、跨服务转发。
- 前端：不要通过自家 CDN 伪装、去 Referer 或绕过缓存；移动端设置稳定可识别 UA；地图控件的 attribution 不能被遮挡。
- 自托管：选择栅格或矢量方案；记录 planet/extract、style、fonts、sprites、tile schema、min/max zoom、更新周期；为 metatile/renderd、PostGIS、缓存和 CDN 设容量。
- 性能：热区缓存、限并发、慢渲染队列、过期策略、磁盘清理和 CDN purge 要可控；不要在发布当天全量预热全球瓦片。
- 与 route 区分：tile server 的 freshness 只证明底图新鲜，不证明 OSRM/Valhalla/GraphHopper graph 已更新；route graph 的 build timestamp 必须单独验证。
- 发布证据：attribution 可见截图、HTTP 缓存行为、Referer/UA、CDN 不隐藏来源、tile server 容量、z/x/y 或矢量 tile 范围限制和 purge/rollback 策略必须可审计。

### 自托管 OSM 数据管道

- 导入：选定 planet（planet.osm.org 完整 PBF 约 80-150GB，解压后 TB 级，导入需 数百GB-数 TB SSD）或区域 extract（Geofabrik 按大洲/国家/省切片，BBBike 支持自定义 bbox）；记录下载源、时间、checksum（md5/sha256）、PBF 大小；导入工具版本固定。
- 导入工具选型：`osm2pgsql` 适合 Nominatim、通用 PostGIS、保留全标签、支持 flex/lua 配置，重导入慢但 schema 灵活；`imposm3` 适合矢量瓦片/精简业务表、按 mapping.yml 选标签、支持 diff 增量，schema 不如 osm2pgsql 通用；`osmium`/`osmosis` 用于 PBF 切片、过滤、合并和 replication diff 应用；选错工具会导致重建一次需数小时到数天。
- 更新：设计 replication diff、全量重建或蓝绿切换；更新失败不能污染生产索引；保留上一个可用数据集。
- PBF 更新：区域 extract 要固定 provider、URL、timestamp、sequence/checksum；minutely/hourly/daily replication 要记录 sequence id、lag、失败重试和断点续传；diff 长期失败或 schema/profile 变化时触发全量重建而不是继续叠加坏状态。
- 新鲜度：记录 extract timestamp、import start/end、replication sequence、lag、失败次数和最近成功更新；超过业务阈值自动降级或提示数据过旧。
- 数据库：PostGIS、osm2pgsql、imposm、Nominatim、OSRM、Valhalla、GraphHopper 的 schema 和索引要分开管理，不混用未验证表。
- 运维：容量估算包含 RAM、SSD IOPS、CPU、临时文件、索引构建时间、备份恢复时间；导入任务必须有监控和告警。
- 发布证据：checksum、工具版本、schema migration、索引构建日志、replication lag、蓝绿切换检查和回滚到上一数据集的演练结果必须齐全。

## 验证门禁

发布前必须同时满足：

- 政策合规：列出所有 OSM/Nominatim/OSRM/Valhalla/GraphHopper/Overpass/tile 端点、用途、流量、限速、缓存、User-Agent/Referer、公共或自托管属性。
- 许可证合规：UI、PDF、截图、导出、API 响应、离线包都有 OSM/ODbL attribution 与第三方图层署名；没有隐藏或移除署名。
- 隐私合规：请求、日志、指标、错误上报不包含未脱敏的完整地址、精确轨迹或用户身份绑定位置；保留期明确。
- 性能证据：压测覆盖峰值 QPS、并发矩阵、等时圈、地图瓦片热区、缓存命中率、外部 429/5xx；有背压和熔断。
- 正确性证据：固定 golden cases 包含坐标顺序、国际化地址、无结果、无路、道路限制、单行线、turn restrictions、限高/限重、跨区域、近似匹配、数据过期。
- 可替换性：provider adapter 测试通过；endpoint/API key/profile/region 可配置；公共端点被要求停用时无需发版或可快速回滚。
- 数据新鲜度：记录 OSM extract/import/build timestamp；用户或运维能判断路线/搜索/瓦片是否过旧。
- traffic 证据：如声明实时或动态路况，必须提供 traffic feed 来源、许可、更新时间、覆盖范围、过期回退、静态 ETA fallback 和用户文案；否则明确“基于静态 OSM 路网估算”。
- 发布证据：变更说明、风险评估、回滚计划、监控面板、告警阈值、运行手册更新完成。
- 一票否决：任何门禁缺少可检查证据时标记为未就绪，不用“后续补充”“上线观察”“流量很小”替代；只能缩小范围、切换自托管/商业服务、移除公共端点依赖或暂缓发布。

## 输出要求

给用户或审查者的交付说明必须包含：

- 采用的能力与供应商/引擎：例如 Nominatim 自托管、OSRM driving、自托管 Valhalla、GraphHopper Directions API、Overpass 公共开发端点、私有 tile server。
- 端点与规模：endpoint、QPS/日量、批量大小、超时、重试、限流、缓存 TTL、是否经过后端代理。
- 数据与许可证：OSM extract 版本、导入时间、第三方数据源、署名文案与展示位置、ODbL/派生数据库风险判断。
- 隐私处理：发送字段、脱敏方式、日志字段、保留期、是否含精确轨迹或个人地址。
- 验证结果：单元/集成/E2E/压测/回归样例、失败场景、截图或监控证据。
- 运行与回滚：配置项、开关、provider 切换、降级文案、告警和回滚步骤。

## 安全边界

必须拒绝或改写为合规方案：

- 用公共 Nominatim、Overpass、OSM tiles、OSRM demo 做批量采集、商业核心服务、隐藏来源代理、自动补全或高并发生产调用。
- 伪造 User-Agent/Referer、绕过缓存、绕过限流、轮换 IP/key、分布式拆分任务以逃避政策。
- 瓦片、POI、地址、邮编、行政区、道路或详情页的大规模抓取、预热、离线包生成或转售。
- 移除、隐藏、模糊或延迟展示 OSM/ODbL/第三方署名；把 OSM 派生数据库伪装成无许可限制数据。
- 将敏感位置、用户轨迹、家庭/工作地址批量发给公共端点，或在日志/监控/崩溃上报中保存原始精确坐标。
- 搭建无鉴权开放代理，让外部用户任意调用 Nominatim/Overpass/routing/tile 服务。
- 把等时圈、路线耗时或地图数据用于生命安全、紧急救援、执法、航空航海等高风险决策而无专业验证与免责声明。

## 反例库

- 反例：移动端输入框每次击键直接请求 nominatim.openstreetmap.org。修正：本地防抖也不够；使用合规商业 autocomplete 或自托管服务，经后端限流和缓存。
- 反例：后端按 100 米网格 reverse geocode 全城生成地址库。修正：这是系统性采集；使用授权数据、自托管 Nominatim 或已有开放数据集并遵守许可证。
- 反例：上线前用脚本下载城市所有 z0-z18 OSM 公共瓦片做离线包。修正：禁止；改用自托管瓦片或有离线授权的供应商。
- 反例：Overpass 轮询全国 amenity=* 作为 POI 数据源。修正：用 planet/Geofabrik extract 导入自己的 PostGIS/搜索索引。
- 反例：OSRM table 一次提交数千坐标，失败后并发拆分重试。修正：自托管并设置队列、分块、配额、退避；公共服务不得承载。
- 反例：把用户完整轨迹、手机号和订单号一起写入路由错误日志。修正：只记录 trace_id、降精度 bbox、点数、耗时和错误码。
- 反例：地图截图报告只保留公司 logo，去掉 OSM attribution。修正：在截图、PDF 和导出物中保留可见署名与许可证链接。
- 反例：自托管 Nominatim 导入一次后长期不更新，还宣称实时准确。修正：标明导入时间，建立更新/重建流程和 freshness 告警。
- 反例：把 GraphHopper API key 放进 App 包，由客户端直接请求。修正：后端代理、鉴权、配额、密钥轮换和异常消耗告警。
- 反例：只测试城市中心路线，没有测试无路、跨河、单行线、步行禁行和坐标顺序。修正：建立 golden cases 和回归门禁。
- 反例：页面显示“实时避堵”，实际只有 OSM PBF 和 OSRM driving profile。修正：去掉实时承诺，或接入授权 traffic feed 并验证过期回退。
- 反例：用 reverse geocode 最近 POI 作为车辆吸附道路结果。修正：用 route engine nearest/match，并限制半径、profile 和匹配置信度。
- 反例：只更新 tile server 的 PBF，却认为路线也同步更新。修正：单独重建 route graph/geocoder index，并暴露各自 data_version。

## 自检清单

- 是否明确公共端点、商业服务、自托管实例和内部缓存的边界？
- 是否为 Nominatim、tiles、Overpass 等公共服务设置了合规 User-Agent/Referer、限速、缓存与禁用场景？
- 是否避免公共端点承担自动补全、批量、离线、高并发、商业核心或 SLA？
- 是否在 UI、导出、截图和 API 元数据中保留 OSM/ODbL 与第三方署名？
- 是否确认经纬度顺序、单位、polyline 精度、语言、时区和 profile/costing 参数？
- 是否验证 oneway、turn restrictions、access、barrier、限高/限重、步行/骑行禁行与 profile 实际支持一致？
- 是否限制 matrix、isochrone、map matching、Overpass 查询的大小、并发、范围与重试？
- 是否记录 OSM extract/import/build/data_version，并能判断数据新鲜度？
- 是否区分 geocoding、routing、tiles、Overpass、traffic 的端点、缓存、数据版本和许可证？
- 是否对敏感地址和轨迹做最小化、脱敏、降精度、加密、限期保留？
- 是否有 provider adapter、配置化 endpoint、密钥保护、熔断、降级和回滚？
- 是否有覆盖失败、限流、无结果、无路、过期数据、坐标错误和 provider 切换的测试？
- 是否验证 403/429/5xx、Overpass timeout/maxsize、matrix/map-matching/isochrone 上限、公共端点 fallback 与禁用开关？
- 是否能证明没有 tile/POI scraping、批量地址采集、开放代理、署名绕过和精确位置 PII 泄漏？
- 是否提供压测、缓存命中率、监控告警、发布证据和运行手册？

## 相邻技能边界

- 地图 GIS 核心开发 / map-gis-core（map-gis-core）：通用 GIS 数据模型、投影、GeoJSON、空间索引、PostGIS 设计优先用它；涉及 OSM 公共政策、Nominatim/OSRM/Valhalla/GraphHopper/Overpass/tiles 才用本技能。
- Leaflet / OpenLayers / leaflet-openlayers（leaflet-openlayers）：只改地图 UI、图层交互、控件、样式、前端事件时用它；涉及 OSM 端点、署名、瓦片政策或路线服务集成时联用本技能。
- mapbox-maplibre 、 Google Maps Platform / google-maps-platform（google-maps-platform） 、 amap-gaode 、 baidu-map 、 tencent-map 、 tianditu-map 、 esri-arcgis：仅接对应商业地图 SDK/API 时用对应技能；从这些供应商迁移到 OSM、与 OSM 数据混用、比较替换或许可冲突时联用本技能。
- api-design：需要设计统一 provider adapter、错误码、限流、缓存和后端 API 合约时联用。
- db-design：自托管 OSM 数据、PostGIS、导入索引、派生数据库和数据保留策略时联用。
- test-engineering：构建 golden cases、E2E、压测、mock provider 和回归门禁时联用。
- code-audit、web-security、performance-engineering、release-engineering、observability：分别用于审计合规/安全、密钥与代理风险、性能容量、发布回滚、监控告警。