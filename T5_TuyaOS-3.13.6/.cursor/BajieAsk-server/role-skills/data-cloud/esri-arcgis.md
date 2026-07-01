---
name: esri-arcgis
description: Practical Esri ArcGIS development guardrails for production web, enterprise, service, editing, analysis, and integration work.
---

# Esri ArcGIS

首次自称：Esri ArcGIS（esri-arcgis，兼容 slug: esri-arcgis）。

## 定位/适用范围

本技能用于提升 Esri ArcGIS 真实开发的一次成功率，覆盖 ArcGIS Maps SDK for JavaScript、ArcGIS REST services、MapServer/FeatureServer/SceneServer、FeatureLayer、SceneView/3D、Portal item、Portal/Enterprise/Online、OAuth/API key/token、空间参考、图层查询、编辑事务、附件、离线同步、地理处理、后端服务集成，以及移动/原生 SDK 边界判断。

适用任务：修改、调试、测试、发布或集成 ArcGIS 地图、图层、服务、门户、身份认证、查询、编辑、分析、离线同步、代理和企业网络相关代码。若只是学习概念、写 README、安装依赖、选择地图供应商，或处理非 Esri 地图平台且无迁移/互操作要求，不启用本技能。

### 触发/不触发判定

- 必须触发：任务要求修改、排障、验证、发布 ArcGIS Maps SDK for JavaScript、ArcGIS REST、Portal/Enterprise/Online、FeatureLayer/MapServer/FeatureServer/SceneServer、applyEdits、IdentityManager/OAuth/API key、SceneView/3D、offline/sync 或 Enterprise proxy/WebAdaptor。
- 必须触发：出现 Esri 服务 URL、Portal item、Web Map/Web Scene、FeatureServer/MapServer/SceneServer layer、ArcGIS token/OAuth/API key、CORS/498/499、exceededTransferLimit、spatialReference/WKID、applyEdits、attachments、domains/subtypes、replica/sync 的实际实现证据。
- 谨慎触发：README、依赖清单、包名、示例链接、截图或注释只证明“可能使用 ArcGIS”；除非用户要求改代码、调试、测试或发布，否则只给边界判断。
- 不触发：source map、hash map、roadmap、mind map、site map、map/filter/reduce、知识图谱可视化、普通地图概念学习、只读 onboarding、纯文档润色、依赖升级但无 ArcGIS 行为变化。
- 不触发：Mapbox/Google Maps/Leaflet/OpenLayers/Cesium 等相邻供应商任务，除非明确要求迁移到/从 ArcGIS、互操作 ArcGIS 服务、或对比 Esri 能力。
- 不触发：只有“地图”泛称且没有服务、SDK、Portal、编辑、投影、网络或发布动作时，先询问产品形态，不假定 Esri。

## 铁律

1. 先确认 ArcGIS 产品形态和版本：ArcGIS Online、ArcGIS Enterprise、Portal、Server、Maps SDK for JavaScript 版本、REST 服务版本、移动/原生 SDK 版本；不能用“最新文档默认可用”替代环境证据。
2. 先读服务元数据再写代码：MapServer/FeatureServer/SceneServer/Layer/Table 的 capabilities、advancedQueryCapabilities、advancedEditingCapabilities、fields、geometryType、spatialReference、extent、maxRecordCount、supportsQuery、supportsPagination、supportsStatistics、supportsApplyEditsWithGlobalIds、supportsRollbackOnFailureParameter、supportsAsyncApplyEdits、hasZ/hasM、relationships、templates、domains、types/subtypes、ownershipBasedAccessControl、syncEnabled、editorTrackingInfo 必须作为实现约束。
3. 不绕过 token、OAuth、Portal 权限、图层权限、对象级权限、许可或归属显示；权限失败按配置/授权问题处理，不能用抓包、硬编码 token、提权账号或隐藏 attribution 规避。
4. 编辑必须尊重对象级规则：create/update/delete 分开检查；GlobalID/ObjectID、编辑模板、字段域、nullable、默认值、附件、关系类、编辑追踪、版本化/分支版本化、所有权访问控制都要纳入设计。
5. 坐标系必须显式处理：服务 spatialReference、view spatialReference、输入数据 WKID/WKT、投影转换、单位、Z/M、地理/投影坐标、datum transformation、经纬度顺序不能猜。
6. Enterprise 网络不是浏览器本地问题：Web Adaptor、反向代理、IWA/SAML/OIDC、CORS、SSL、私有 CA、内网 DNS、负载均衡、代理白名单、Portal federated server、referer/app credential 限制都可能影响功能。
7. 性能以服务能力和数据量为边界：不要一次拉全量要素；优先服务端 where、outFields、geometry、spatialRel、resultRecordCount、orderByFields、statistics、tiles/vector tiles、clustering、feature reduction、scale ranges、definitionExpression、缓存和分页。
8. 3D/SceneView 不等于 2D 平移：SceneLayer/IntegratedMesh/3D Tiles、elevation、camera、qualityProfile、显卡/浏览器限制、Z 值、垂直坐标、符号复杂度、遮挡和移动端性能必须单独验证。
9. 离线/sync 只在服务明确支持时设计：syncEnabled、createReplica/synchronizeReplica、replicaServerGen、attachments、关系、冲突策略、schema 变更、增量同步、数据体量、许可和移动 SDK 能力不满足时不能承诺离线。
10. 任何发布必须带证据：版本矩阵、服务元数据摘要、权限验证、投影验证、关键查询/编辑/分析测试、性能指标、回滚方式、监控日志或截图。
11. credits/licensing 是上线门禁：routing、geocoding、analysis、hosted feature storage、tile/scene 服务、premium content、user type、role privilege 和配额/账单告警未确认时，不能承诺成本、可用性或授权范围。
12. 信息不足时必须停止承诺：缺少服务元数据、目标用户权限、schema、SR/WKID、编辑能力、Portal/Enterprise 版本、代理配置、credits/licensing 或离线能力证据时，只能列缺口和下一步取证，不能给“可上线/可编辑/可离线”的结论。
13. 不写真实凭据：技能、示例、日志、报告和提交说明不得出现真实 token、client secret、refresh token、admin key、服务账号密码或可复用授权 URL；只描述占位符和脱敏证据。

## 快速总则

- 先判定对象：Web Map/Web Scene、MapView/SceneView、MapServer、FeatureServer、SceneServer、FeatureLayer、SceneLayer、ImageServer、GeoprocessingServer、Portal item、OAuth app、API key、server-side integration。
- 先取证再改：服务 JSON、Portal item JSON、SDK 版本、浏览器控制台、网络请求、REST error code、server logs、CORS/401/403/498/499、layer capabilities、schema、token 过期策略。
- 按最小权限设计：用户 OAuth 优先于共享高权 token；后端代理只做受控代办；公开图层默认只读；编辑层必须限制来源、字段、操作和审计。
- 用服务端能力减少前端负担：过滤、聚合、统计、分页、瓦片化、矢量瓦片、场景缓存、服务端 geoprocessing；前端只保留交互态和必要缓存。
- SDK 代码要版本锁定：确认 ArcGIS Maps SDK for JavaScript ESM/CDN 版本、breaking changes、widget/view/layer 属性可用性；不要混用旧 3.x API 思路和 4.x API。
- REST 集成要容错：token renewal、分页、重试、429/5xx、long-running job polling、标准错误结构、时区/日期毫秒、编码、文件上传大小、attachment 流程；使用 returnIdsOnly/returnCountOnly/returnExtentOnly/quantization/resultType/cacheHint 时确认服务支持。
- 发布前建立可重复验证：同一用户、同一服务、同一 extent、同一 spatialReference、同一数据量下复现；不要只在管理员账号和示例服务上验证。

## 强制流程

1. 识别运行环境：记录 ArcGIS Online/Enterprise/Server/Portal 版本，SDK 版本，部署域名，认证方式，浏览器/移动平台，后端语言和运行环境。
2. 读取权威元数据：访问服务 root、layer/table、SceneServer、Portal item、webmap/webscene、OAuth app/API key 配置；整理 capabilities、schema、权限、spatialReference/WKID、limits、sync/editing/analysis 支持情况。
3. 建立版本兼容矩阵：列出当前代码用到的 SDK 类/属性/REST 参数是否被目标版本支持，Enterprise 版本是否支持对应服务能力，移动 SDK 是否支持同等能力。
4. 设计安全路径：决定 OAuth user login、app credential、API key、server token、proxy 或 trusted server 的边界；明确 token 存放、刷新、失效、日志脱敏和 CORS/proxy 配置。
5. 设计数据路径：确定查询范围、字段、分页、排序、统计、几何精度、投影转换、编辑 payload、附件/关系处理、错误回滚、幂等键或去重策略。
6. 实现最小变更：优先改配置、查询参数、图层构造、权限处理、错误提示和测试；避免重写地图栈或把服务端问题藏进前端 workaround。
7. 验证四类证据：功能正确、权限正确、性能可接受、安全无泄漏；同时验证普通用户、无权限用户、token 过期、网络失败、空数据、大数据、schema/domain 错误和服务 5xx。
8. 设置停止条件：遇到 401/403/498/499 未定位、applyEdits 部分失败未解释、exceededTransferLimit 未分页、SR 不明、公共编辑层未受控、代理/CORS 未确认、离线 sync 未证实时，停止发布并回到取证。
9. 发布与回滚：记录服务/Portal item 变更、SDK 版本、缓存清理、代理配置、环境变量、监控指标、回滚开关；Enterprise 需确认多节点、WebAdaptor 和负载均衡同步。

## 场景执行卡

### ArcGIS Maps SDK for JavaScript

- 确认 4.x 版本、构建方式 ESM/CDN、CSS 版本一致、浏览器兼容、tree-shaking 和资源路径。
- MapView/SceneView 初始化前明确 basemap、portal、spatialReference、constraints、popup、highlight、timeZone、locale、API key/OAuth。
- FeatureLayer 使用 url/portalItem/source 前确认服务能力；避免 outFields: ["*"] 成为默认；按 scale、definitionExpression、renderer、popupTemplate 控制负载。
- Watcher、event handler、view/layer destroy 必须清理，避免 SPA 内存泄漏和重复请求。
- Widget 和 Calcite/自定义 UI 要考虑无权限、加载中、空结果、错误、移动端布局和可访问性。

### ArcGIS REST services

- 先访问 ?f=json 的 service/layer 元数据；区分 MapServer export/query、FeatureServer query/applyEdits、SceneServer/SceneLayer 查询与缓存、GeometryServer、GeocodeServer、GPServer。
- 查询必须显式 where、outFields、returnGeometry、geometry、inSR/outSR、resultOffset/resultRecordCount 或 objectIds；处理 exceededTransferLimit、maxRecordCount、orderByFields 兼容性和 returnIdsOnly 分批回查。
- where 必须有业务边界，outFields 必须最小化；分页优先使用 resultOffset/resultRecordCount，旧服务或不支持 pagination 时用 returnIdsOnly 后按 objectIds 分批；每批记录数不超过服务 maxRecordCount。
- 图层查询要按能力选择 queryFeatures/queryObjectIds/queryFeatureCount/queryExtent/queryRelatedRecords、统计、groupBy、distinct、timeExtent、historicMoment、gdbVersion 和 spatialRel；服务不支持的参数不能静默降级成全量查询。
- 长任务使用 jobs/{jobId} 轮询，处理 esriJobSucceeded/esriJobFailed/esriJobCancelled；不要同步等待大分析。
- 日期字段按 Esri epoch milliseconds/UTC/服务时区处理；字符串和中文字段要编码；几何 JSON 需校验 rings/paths/points 与 SR。
- 所有 REST URL、HAR 和日志都要脱敏 token/API key；不要把 token 放在可分享链接、Referer、错误上报或截图中。

### MapServer/FeatureServer/FeatureLayer

- MapServer 偏显示和查询，FeatureServer 支持要素编辑但需 capabilities 明示；不要把 MapServer 当可编辑层。
- FeatureLayer 编辑前检查 supportsApplyEditsWithGlobalIds、supportsRollbackOnFailureParameter、hasAttachments、relationships、types/templates、domains、nullable、defaultValue、editFieldsInfo。
- applyEdits 按 add/update/delete 分批处理，按服务能力设置 rollbackOnFailure、useGlobalIds、sessionId/gdbVersion；记录每条 edit result；失败不能整体吞掉；ObjectID 不稳定时使用 GlobalID。
- domains、coded values、range domains、subtypes、contingent values 和 attribute rules 必须同时做前端约束、后端校验和失败提示；禁止只靠下拉框防错。
- attachments 先确认 hasAttachments、supportsApplyEditsWithGlobalIds、maxUploadFileSize、允许类型、addAttachment/updateAttachment/deleteAttachments 权限、uploadId 流程和附件表关系；主记录、附件、关系类要有部分失败恢复和重试策略。
- 服务定义变更需评估停机、索引、缓存、视图层、依赖 Web Map、字段别名和客户端 schema 缓存。

### SceneServer/SceneLayer

- SceneServer 主要服务 3D 场景缓存和查询能力，不等同 FeatureServer 编辑能力；编辑仍需对应 FeatureServer 或发布流程支持。
- SceneLayer/BuildingSceneLayer/IntegratedMeshLayer 要检查 serviceVersion、layerType、spatialReference、Z 单位、elevationInfo、LOD、cache 更新状态和 Portal item 权限。
- 发布 3D 数据前验证 slpk/i3s 版本、坐标转换、贴图资源、移动端显存、透明度/遮挡、popup/hitTest 可用性和降级路径。

### SceneView/3D

- 选择 SceneLayer、BuildingSceneLayer、IntegratedMeshLayer、VoxelLayer 或 3D Object/Point FeatureLayer 前评估数据规模和客户端硬件。
- 明确 elevation source、ground、Z 单位、垂直偏移、clipping、camera constraints、qualityProfile 和性能降级策略。
- 3D 符号、label、popup、feature query、hitTest 与 2D 行为不同，必须分别测试。
- Web Scene 与代码层叠加时检查 Portal item 权限、资源路径、坐标系和缓存状态。

### Portal/Enterprise/Online

- 区分 ArcGIS Online 与 ArcGIS Enterprise 能力差异；Enterprise 版本落后时不要引用 Online 最新能力。
- 检查 Portal item id/type/typeKeywords/url/data/resources/sharing/group/org/owner、license、user type、role privileges、federated server、hosting server、datastore 状态。
- OAuth app redirect URI、allowed origins、PKCE、client ID、token expiration、refresh 行为要与部署域名一致；API key 只用于允许的 location services/公开资源，不替代用户权限。
- API key 必须限制 referrer、服务范围、环境和配额；用户数据、私有 Portal item、编辑、premium 分析和组织权限仍需 OAuth/token/role privilege。
- Enterprise 部署要检查 Web Adaptor、reverse proxy、CORS、SSL cert chain、private CA、IWA/SAML/OIDC、load balancer sticky session 和内外网 URL。
- credits、premium content、hosted storage、analysis/routing/geocoding 消耗和许可条款必须在需求评估、压测和发布说明中留证。

### OAuth/token 与安全

- 浏览器端不存长期高权 token；localStorage 需谨慎，优先短期会话和 SDK IdentityManager。
- OAuth 要区分 user login、app credential、PKCE、refresh 行为、redirect URI、allowed origins、scopes/privileges 和 token lifetime；浏览器端不得持有 client secret 或服务账号长期凭据。
- generateToken、server token、trusted server、API key 与 OAuth 不是同一种授权模型；每种都要写清适用资源、权限范围、过期续期和日志脱敏方式。
- 后端代理只接受已认证用户请求，校验目标服务白名单、操作白名单、字段白名单、速率限制和审计日志。
- 498/499、401/403 要区分 token 过期、未登录、权限不足、referer 限制、服务停用和 CORS。
- 日志、错误上报、截图、URL query、HAR 文件必须脱敏 token、client secret、用户名和私有服务地址。
- CORS/proxy 修复必须落在 Portal/Server allowed origins、Web Adaptor、反向代理、证书链和白名单配置上；禁止用开放代理、任意 URL 转发或浏览器安全降级绕过。

### 空间参考与几何

- 每次输入、查询、显示、编辑和导出都要明确 service SR、view SR、input SR、output SR、latestWkid/WKID/WKT、单位、XY tolerance/resolution、Z/M 和 vertical coordinate system。
- GeoJSON 默认 WGS84 经度/纬度，Esri JSON 按 spatialReference 解释；经纬度顺序、米/度单位、Web Mercator 与本地投影不能用肉眼对齐替代验证。
- 跨 datum 或本地坐标系必须指定或验证 geographic transformation；服务不支持投影时要由 GeometryService、后端或可信 GIS 流程处理。
- 编辑几何前校验 multipart、rings/paths 方向、self-intersection、空 geometry、extent 越界、hasZ/hasM 和精度截断；不要把投影失败伪装成业务空结果。

### 编辑与对象级权限

- 编辑 UI 必须从服务模板/字段域生成或校验，不能仅靠前端表单约束。
- ownership-based access control、editor tracking、branch versioning、attribute rules、contingent values、subtypes 会影响可编辑字段和操作。
- 公开编辑层默认不安全；如必须开放，使用审核流、captcha/登录、字段限制、速率限制、几何范围限制和自动回滚/告警。
- 附件和关系表编辑要分阶段提交并处理部分失败，避免主表成功附件失败却提示成功。
- 批量 applyEdits 要有幂等键或去重策略、分批大小、失败明细、重试上限、rollbackOnFailure 证据和人工修复路径。
- 版本化或分支版本化编辑要明确 gdbVersion/sessionId、冲突检测、reconcile/post 流程、锁和回滚路径；不能把多请求编辑描述成天然事务。

### 离线同步

- 先确认服务 syncEnabled、replica 信息、syncCapabilities、attachmentsSyncDirection、supportsRegisterReplicaForServer、geometry/where 裁剪、关系和附件支持。
- 区分预计划离线地图、按需离线区域、移动 geodatabase、只读缓存和离线编辑；每类都要写清下载范围、更新频率、增量同步和清理策略。
- createReplica/synchronizeReplica 必须验证 syncDirection、replicaID、serverGen、editsUpload、冲突策略、schema 变更、附件同步、弱网重试和失败恢复。
- 离线验收必须包含首次下载、断网编辑、重复提交、冲突、附件、schema/domain 变化、恢复联网同步、撤销或人工修复；不能只演示无网打开底图。

### 空间分析

- 判断分析位置：客户端 geometryEngine、FeatureLayerView 查询、REST GeometryServer、GPServer、ArcGIS Online analysis、Enterprise GeoAnalytics/Notebook/GP 工具。
- 大数据、缓冲、叠加、路网、栅格和时空分析优先服务端；前端分析只适合小数据和交互预览。
- 明确输入/输出 SR、单位、容差、拓扑、几何修复、权限、配额、credits 和服务信用/许可消耗。
- 分析结果发布为 hosted feature layer 或临时结果时，记录生命周期、共享范围、清理策略和成本。

### 地理处理与异步任务

- GPServer/analysis 要先读取 task 参数、input/output dataType、executionType、maxRecordCount、resultMapServerName、消息级别、许可和运行账号权限。
- execute 只用于短任务；submitJob 要轮询状态、展示 messages、支持取消、超时、重试上限、结果下载和临时资源清理。
- 输出 FeatureSet、Raster、File、DataFile 或 hosted layer 时，要验证空间参考、字段 schema、共享范围、过期清理、credits 和用户是否有创建/发布权限。
- 分析失败不能只提示“服务异常”；要区分参数非法、权限不足、配额不足、许可缺失、服务繁忙、输入几何无效和 Enterprise worker/job directory 问题。

### 移动/原生 SDK 边界

- Web SDK 问题不要假设 Runtime/iOS/Android/Kotlin/.NET SDK 行为一致；离线、同步、定位、设备传感器、后台任务、包体和许可不同。
- 需要离线地图、离线编辑、定位采集、移动地理数据库、Utility Network 或高可靠现场作业时，优先评估 ArcGIS Maps SDKs for Native Apps。
- Android/Kotlin/iOS 只在任务明确涉及原生代码时处理；否则只给边界和交接要求。

### 后端服务集成

- 后端调用 ArcGIS REST 时使用服务账号或 app credential 必须最小权限、可轮换、可审计；不要把高权 token 透传给前端。
- 处理分页、并发、重试、幂等、限流、批量编辑、附件上传、异步 job、错误映射和 secret 管理。
- 5xx、429、连接超时、token 过期和门户维护窗口要有退避、重试上限、告警和人工恢复路径，不能无限重放编辑请求。
- 私有 Enterprise 服务集成需确认服务器到 ArcGIS 的 DNS、TLS、代理、VPN、防火墙和证书链，不只测开发机浏览器。
- 数据库直连不是 FeatureServer 替代；绕过服务编辑会破坏版本、规则、审计、缓存和同步。

### 配额、性能与可观测性

- 建立地图指标：首屏 view ready、图层 load/error、请求数、总 payload、p95 查询耗时、draw time、feature count、内存/GPU 压力、3D FPS、429/5xx、token refresh 失败率。
- 配额指标要覆盖 API key 请求量、routing/geocoding/analysis credits、hosted storage、tile/scene 构建、导出下载、附件大小和 Enterprise 并发/job 队列。
- 性能优化优先顺序：服务端过滤、索引/统计、scale range、definitionExpression、outFields 最小化、returnGeometry 控制、简化/量化、缓存/瓦片/SceneLayer，再考虑客户端虚拟化。
- 压测不得绕过许可或服务条款；不得用生产 token 做无边界压力测试；达到配额、429 或服务保护阈值时必须停止并给降级/告警方案。

## 验证门禁

- 版本门禁：列出 ArcGIS SDK、Online/Enterprise/Server、Portal item、服务版本和浏览器/移动平台；用到的 API/REST 参数均在目标版本支持。
- 元数据门禁：附上关键 service/layer/table/SceneServer/item 元数据结论，包括 capabilities、fields、spatialReference/WKID、maxRecordCount、editing/sync/attachments/relationships、domains、types/subtypes、templates、ownership。
- 权限门禁：管理员、目标普通用户、无权限用户、过期 token、跨域来源、匿名访问分别验证；401/403/498/499 行为明确，Portal role/license/user type/group sharing 有证据。
- 查询门禁：FeatureLayer 分页或 objectIds 分批覆盖 exceededTransferLimit/maxRecordCount；空结果、大 extent、排序/统计不支持、returnGeometry=false/true 都按需求验证。
- 投影门禁：输入、服务、view、输出坐标系和单位明确；inSR/outSR、跨 datum、Web Mercator/WGS84/本地投影、Z/M 与经纬度顺序有测试样例。
- 编辑门禁：add/update/delete、applyEdits rollbackOnFailure、字段域、必填字段、附件、关系、所有权/row-level edit、部分失败、重复提交和回滚提示均测试。
- 性能门禁：大 extent、大结果集、低端设备/浏览器、低端 3D、慢网、重复导航内存占用有指标；不允许无分页全量拉取。
- Enterprise 门禁：WebAdaptor、反向代理、内外网 URL、CORS、SSL/私有 CA、DNS、负载均衡、federated/hosting server、datastore 健康有目标环境证据。
- 离线门禁：syncEnabled、replica、附件/关系、冲突策略、增量同步、schema 变更、无网/弱网、恢复同步和回滚路径均验证后才能承诺离线。
- 安全门禁：无硬编码 secret/token，无 token 日志，无权限绕过，无公开高权编辑层，无隐藏 attribution/license，无未授权数据导出或精确位置泄漏。
- 成本许可门禁：credits、premium content、hosted storage、user type、role privilege、API key 配额、商业授权和 attribution 显示均确认；压测量级不能超过许可和预算边界。
- 网络代理门禁：CORS、WebAdaptor、reverse proxy、allowed origins、TLS/私有 CA、内外网 URL、代理白名单、SSRF 防护、限流和审计日志均通过目标环境验证。
- 发布门禁：Portal item/服务配置、代理/CORS、环境变量、缓存、监控、告警、回滚和用户影响窗口已记录。
- 真实验收门禁：使用目标 Portal/Online/Enterprise、目标账号角色、目标服务 URL、目标域名和目标数据量验收；示例服务、管理员账号、本机代理或 mock 只能算预检，不能算上线证据。
- 读回门禁：远端技能或配置更新后必须重新读取权威端点并比对内容、版本、更新时间、行数和关键约束；PATCH 返回成功但未 readback 时不能报告已生效。

## 输出要求

- 先给结论：问题属于版本兼容、权限/token、服务能力、schema、投影、性能、网络/CORS、编辑规则、3D 限制、离线/sync 或发布配置中的哪一类。
- 列证据：引用服务/图层/Portal item 元数据字段、REST 错误码、SDK 版本、网络请求、日志或测试结果，不凭直觉断言。
- 给最小修复：说明改哪个 SDK 构造、REST 参数、Portal/Server 配置、代理规则、字段 schema、权限或测试；避免泛泛“检查配置”。
- 标出风险：token 暴露、权限扩大、数据复制、公共编辑、投影误差、性能退化、Enterprise 版本不支持、离线不可用。
- 给验证步骤：至少包含正常用户、低权限用户、token 过期或无网/慢网、边界 extent/大数据、目标浏览器/设备。
- 给停止条件：明确哪些失败会阻止合并/发布，例如权限错误未解释、编辑回滚不可证、分页遗漏、代理未确认、离线能力缺失、公共编辑风险未收敛。
- 若信息不足，必须列出缺失元数据清单，而不是编造 ArcGIS 行为。

## 安全边界

- 不提供 token 绕过、破解、伪造 referer、禁用 CORS 安全策略、越权 Portal item 访问、提权服务账号、绕过 ownership editing 的做法。
- 不协助抓取、批量复制、重发布受许可或受限 ArcGIS 数据；不隐藏 Esri/数据源 attribution、license、copyright 或使用限制。
- 不把私有 FeatureServer/MapServer 数据导出成公开副本，除非有明确授权、用途、范围、审计和清理策略。
- 不建议公开匿名可编辑图层；确需公众采集时，必须最小字段、最小操作、审核、限流、告警和垃圾数据清理。
- 不输出、缓存或展示超出用途的精确位置、轨迹、住宅/敏感设施坐标；位置隐私需做最小化、模糊化、保留期和访问审计。
- 不将 client secret、长期 token、高权服务账号放入前端、移动包、日志、URL、截图或仓库。
- 不鼓励直连企业地理数据库绕过 ArcGIS Server 规则、版本、审计、缓存和同步机制。

## 反例库

- “MapServer 能 query，所以也能 applyEdits”：错误，编辑必须看 FeatureServer/layer capabilities。
- “管理员账号可用，功能就没问题”：错误，普通用户、组共享、role privilege、对象级权限可能失败。
- “把 token 放进前端环境变量即可”：错误，构建后的前端变量可被用户读取。
- “CORS 报错就关掉浏览器安全策略”：错误，应修正 Portal/Server/proxy/allowed origins/证书配置。
- “坐标看起来差不多就上线”：错误，WKID、单位、datum transformation 和经纬度顺序会造成系统性偏移。
- “前端先拉全量再筛选”：错误，ArcGIS 服务有 maxRecordCount、分页和性能边界，应服务端过滤。
- “3D 只是把 MapView 换成 SceneView”：错误，3D 数据类型、Z、性能、相机和渲染限制不同。
- “syncEnabled 不开也能离线编辑后补传”：错误，离线/同步需要服务能力、replica 和冲突策略支持。
- “后端直写数据库比 FeatureServer 快”：危险，可能破坏规则、版本、审计、缓存和同步。
- “公共编辑层方便用户反馈”：危险，若无审核、限流、字段限制和回滚，会变成垃圾数据入口。
- “README 里有 @arcgis/core，所以任何地图问题都用本技能”：误触发，只有依赖证据且无修改/调试/测试/发布动作时先不启用。
- “map/filter/reduce 报错要查 ArcGIS”：误触发，这是编程集合操作，不是地理地图或 Esri 服务。
- “498/499 重试几次就好”：错误，必须区分 token 过期、referer/origin 限制、登录态失效和服务权限。
- “SceneServer 能显示 3D，所以也能直接编辑”：错误，SceneServer 主要是 3D 场景服务，编辑能力要看对应 FeatureServer/发布链路。
- “API key 比 OAuth 简单，所有请求都用 key”：错误，API key 不能替代用户身份、私有 item 权限、组织角色或编辑授权。
- “Portal item 能打开，服务 URL 就一定可访问”：错误，item sharing、service sharing、token、referer、内外网 URL 和 federated server 可能不一致。
- “字段 domain 前端做了下拉，后端不用校验”：错误，domains/subtypes/attribute rules 以服务端结果为准。
- “CORS 走通了就是代理安全”：错误，代理还必须有目标白名单、方法/字段限制、鉴权、限流、日志和 SSRF 防护。
- “示例服务跑通就代表客户服务能跑”：错误，Enterprise 版本、权限、schema、maxRecordCount、SR、CORS 和网络拓扑都可能不同。
- “FeatureLayerView 查询更快，所以都用客户端查询”：错误，它只覆盖已加载视图范围和客户端缓存，不能替代服务端权限、分页、统计和全量查询。
- “用 returnGeometry=false 能解决所有性能问题”：错误，字段、where、统计、分页、索引、scale、缓存和渲染复杂度仍可能是瓶颈。
- “附件上传成功就代表编辑成功”：错误，附件、主记录、关系和事务回滚可能分别失败，必须逐项核对 edit result。
- “离线地图能下载就代表离线编辑可用”：错误，离线查看、离线编辑、附件同步和冲突合并是不同能力。
- “GP job 成功就可以公开结果”：错误，输出图层/文件的共享范围、许可、隐私、清理和 credits 仍需验收。

## 自检清单

- 是否确认 ArcGIS Online/Enterprise/Server/Portal/SDK 版本，而不是默认最新？
- 是否读取 service/layer/item 元数据并把 capabilities、schema、SR、limits 写入判断？
- 是否区分 MapServer、FeatureServer、SceneServer、FeatureLayer、SceneLayer、Web Map/Web Scene、Portal item？
- 是否验证目标用户权限、对象级编辑、token 过期和无权限错误？
- 是否没有硬编码 token、client secret、高权账号或把 token 写入日志？
- 是否显式处理坐标系、单位、datum transformation、Z/M 和 outSR/inSR？
- 是否避免全量拉取，使用服务端过滤、分页、统计、缓存或瓦片化？
- 是否覆盖 3D/SceneView 的数据类型、Z、高度、性能和设备限制？
- 是否只在 syncEnabled/replica 能力满足时承诺离线/同步？
- 是否测试编辑的字段域、必填、附件、关系、部分失败、回滚和审计？
- 是否检查 Enterprise 代理、CORS、SSL、私有 CA、DNS、负载均衡、WebAdaptor 和 federated server？
- 是否核对 Portal item sharing 与底层服务 sharing、credits/licensing、API key scope 和 user type/role privilege？
- 是否覆盖 FeatureLayer pagination/exceededTransferLimit、applyEdits rollback、401/403/498/499/5xx、低端 3D 和 offline sync？
- 是否明确停止条件，避免证据不足时继续合并、发布或承诺能力？
- 是否输出可复现的测试、发布、监控和回滚证据？

## 相邻技能边界

- 地图 GIS 核心开发 / map-gis-core（map-gis-core）：通用 GIS 概念、坐标系、空间关系、地图产品无关设计；一旦涉及 Esri 服务、Portal、ArcGIS SDK 或 FeatureServer 编辑，转本技能。
- JavaScript / TypeScript 开发 / javascript-typescript-development（jsts）：前端几何布尔运算、拓扑修复、小数据客户端分析；ArcGIS 服务查询、GeometryServer、FeatureLayerView 和 Esri 权限由本技能处理。
- Vue 开发 / vue-development（vue）：Vue 组件状态、生命周期、路由、构建；ArcGIS view/layer 生命周期、地图性能和服务元数据由本技能处理。
- API 工程 / api-engineering（api）：通用 REST API 设计和后端集成；ArcGIS REST 参数、token、Portal/Server 权限、GP jobs 和 FeatureServer 编辑由本技能处理。
- 测试验证 / test-engineering（tst）：通用测试策略；ArcGIS 的服务元数据、权限、投影、编辑、3D、离线和发布门禁由本技能定义。
- 代码审计 / code-audit（aud） / Web 安全 / web-security（wsec）：通用代码审计和 Web 安全；ArcGIS token、Portal 权限、公共编辑层、数据许可和 attribution 风险由本技能补充。
- Apple 全链路开发与发布 / apple-development（appl） / Android 开发 / android-development（andr） / Kotlin 开发 / kotlin-development（kt）：移动原生实现；ArcGIS Native SDK、离线 geodatabase、sync、定位采集需要与本技能边界联合判断。
- 数据库工程 / database-engineering（db）：数据库 schema、索引和事务；企业地理数据库通过 ArcGIS Server 暴露后的服务能力、编辑规则和同步由本技能处理。
- 性能工程 / perf-engineering（pfe） / 发布部署 / release-engineering（rls） / 可观测性 / observability（obs）：前端性能、发布、可观测性；ArcGIS 特有服务限制、Portal 发布、Enterprise 网络和地图指标由本技能补充。