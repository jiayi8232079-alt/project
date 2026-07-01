---
name: uniapp-development
description: uni-app 跨端开发实战排障版 - 按端、运行时、入口、证据定位 Vue2/Vue3、Vite/HBuilderX、App-Plus、H5、微信/支付宝/抖音小程序、uni-app x、nvue/uvue/uts、条件编译、manifest.json/pages.json、manifest.config.ts/pages.config.ts、多环境 appid/base、分包、原生插件、权限、桥接、CSS 安全区、uniCloud、发行包差异。涉及 uni-app/UniApp/uniapp 多端、小程序、App、H5 开发与排障时必须使用。
---

# UniApp 开发

UniApp 开发（uniapp-development，兼容 slug: unap）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

定位：本技能只负责 uni-app 跨端框架内的实现、定位、排障与交付口径。目标不是复述 Vue、小程序或原生 App 百科，而是把问题先落到端、运行时、入口、证据，再决定交给 jsts、wcmp、almp、dymp、andr、appl、u、api、db、rls、tst 或 aud。

## 快速总则：端 / 运行时 / 入口 / 证据

1. 端：先声明主端和必保端，至少区分 App-Plus、H5、微信小程序、支付宝小程序、抖音小程序；Android/iOS、真机/模拟器、体验版/发行包分别标结论。
2. 运行时：先确认 Vue2 或 Vue3、HBuilderX 或 CLI/Vite、uni-app x、nvue、uvue、uts、App 基座、WebView、目标小程序基础库和插件版本。
3. 入口：先列 pages.json、manifest.json、manifest.config.ts、pages.config.ts、tabBar、分包、分享/扫码/scheme、登录回跳、支付回跳、web-view、wgt、离线包、uniCloud 云函数入口。
4. 证据：开发工具预览只算弱证据；优先构建日志、真机调试、Network、console、原生日志、体验版、发行包、云打包日志、包体报告和平台审核反馈。
5. 条件编译：平台私有能力优先编译期隔离；模板、script、style、配置要一起查，不能只隔离 JS API。
6. 配置联动：改 pages.json、manifest.json、manifest.config.ts、pages.config.ts、uni_modules、权限、原生插件、分包、发行配置、uniCloud 绑定时，同步查调用方、产物和目标端配置。
7. 生命周期分层：App 生命周期、页面 onLoad/onShow/onUnload、Vue mounted/unmounted、组件缓存、tabBar 返回、登录刷新要分工，onShow 默认防重复请求。
8. 多环境：CLI/Vite 必查 loadEnv、--mode、process/env 注入、platform scripts、appid、base、域名、云环境、证书和 source map 是否按端隔离。
9. 请求与代理：H5 proxy 只服务开发态；生产 baseUrl、uni.addInterceptor、request/upload/download 拦截、token、超时、错误码、跨域和平台白名单要统一验。
10. 组件生态：uView/uView Plus、uni-ui、uni_modules、easycom、组件插件矩阵、externalClasses、CSS 变量、主题、暗色、国际化要按版本和目标端验证，不把 H5 样式当全端结论。
11. 状态缓存：Vuex/Pinia、token、storage、tabBar 多页状态、页面栈缓存、离线数据要有刷新、失效、清理和恢复策略。
12. 发布前置：隐私合规、权限说明、SDK 清单、wgt 兼容、离线包路径、包体、灰度、回滚、审核材料必须在开发期建证据。

## 工程门禁：真实开发闭环

1. 需求落地先过六件事：目标端、页面入口、接口契约、状态归属、权限/审核、验收证据；任一未知都写需验证，不把猜测写成结论。
2. 每个新功能至少闭环页面、路由、请求、状态、错误态、权限态、构建产物和主端真机/体验版；跨端需求必须列逐端通过/未验证。
3. 平台私有 API、组件、样式、权限、支付、订阅消息和分享能力必须有条件编译或适配层边界；禁止裸用宿主专有对象污染公共代码。
4. pages.json、manifest.json、manifest.config.ts、pages.config.ts、uni_modules、easycom、环境变量和发行配置必须与代码同查；只改页面文件视为未完成。
5. 请求字段必须对齐后端契约：必填/可选、null/空串、数字/字符串、时间格式、分页字段、错误码、旧字段兼容和灰度字段都要标明证据。
6. 登录态必须覆盖冷启动、热启动、过期、续期、切号、退出、401 并发、tabBar 缓存和 storage 清理；禁止把 token、手机号、openid、订单密钥打到日志。
7. 上传、下载、预览、分享文件必须覆盖大小限制、扩展名/MIME、临时路径、持久化、权限拒绝、取消、超时、断点/重试、CDN 缓存和清理。
8. 弱网和旧版本必须成为默认验收项：超时、重试、重复提交、接口乱序、页面销毁后回包、基础库低版本、旧 App 基座、旧小程序体验版都要有处理口径。
9. 支付、订阅消息、手机号、定位、相机、相册、蓝牙、通知、剪贴板等敏感能力只在明确业务动作下接入；审核权限文案、拒绝态、取消态和测试账号同步准备。
10. UI 交付必须同时看安全区、键盘、滚动容器、长列表、空态、错误态、加载态、暗色、国际化和低端机；禁止只看 H5 或模拟器截图。
11. 产物交付必须留下构建命令、目标端、appid/base/baseUrl、版本号、包体、source map、权限声明、隐私弹窗、SDK 清单和回滚路径。
12. 无法完成真机、体验版、发行包、平台后台或审核验证时，结论必须降级为“代码侧已处理，目标端未验证”，不得报全端通过。

## 场景执行卡

### 1. 新页面 / 新模块 / 多端迁移
- 输入：目标端、Vue2/Vue3、HBuilderX/CLI/Vite、页面入口、主包/分包、是否 nvue/uvue/uni-app x、是否依赖登录/分享/支付。
- 动作：先定 pages.json/pages.config.ts 路径、subPackages、tabBar、分包预加载、路由守卫、分享落地；再写页面与组件。
- 证据：pages.json 或 pages.config.ts diff、跳转/分享/扫码引用搜索、目标端构建日志、至少主端真机或体验版证据。
- 兜底：端范围或入口不清时只给方案和待确认项，不直接改路径。

### 2. Vue2 / Vue3 / Vite / HBuilderX 差异
- 输入：Vue 版本、编译模式、script setup、Composition API、插件、Pinia/Vuex、Vite 插件、HBuilderX 版本。
- 动作：按实际版本处理 this、refs、生命周期、响应式解构、插件安装、全局属性和构建 alias；HBuilderX 与 CLI 分别留构建证据。
- 证据：package/manifest/HBuilderX 版本、CLI 命令、构建错误、运行端日志。
- 兜底：只在 HBuilderX 运行成功不能判 CI/Vite/发行成功。

### 3. CLI / CI / 多环境构建
- 输入：HBuilderX 版本、CLI/Vite 命令、Node 版本、lockfile、loadEnv、--mode、环境变量、manifest 多环境、云打包、本地打包、渠道配置。
- 动作：锁依赖和构建命令；区分 dev/test/prod 的 appid、base、域名、证书、云环境、source map；manifest.config.ts/pages.config.ts 要确认生成产物和目标端差异。
- 证据：CI 日志、lockfile、platform scripts、构建命令、manifest/pages 产物 diff、云打包日志、产物校验清单。
- 兜底：HBuilderX 手工发行不能替代 CI 可复现；环境变量缺证据时标需验证。

### 4. 条件编译 / 平台适配层
- 输入：差异端、差异 API、模板/脚本/样式/配置位置、是否影响产物。
- 动作：用条件编译隔离 App-Plus、H5、微信/支付宝/抖音小程序、nvue/uvue/uts；公共差异进入 adapter，轻量差异才运行时判断。
- 证据：各端编译产物不含私有 API，目标端真机关键路径日志。
- 兜底：无法编译某端时标该端未验证，不用运行时 if 假装覆盖。

### 5. pages.json / manifest.json / 配置生成 / 路由
- 输入：首页、tabBar、custom tabBar、subPackages root、preloadRule、页面栈、旧跳转、分享路径、scheme、manifest.config.ts/pages.config.ts。
- 动作：改路径前全量搜 navigateTo、redirectTo、reLaunch、switchTab、open-type、分享、二维码、web-view 回跳；tabBar 只用 switchTab；自定义 tabBar 必核 selectedIndex/index 同步。
- 证据：路由引用清单、生成后 pages.json/manifest.json、主包/分包体积、目标端打开证据。
- 兜底：旧入口未搜全禁止改路径；主包超限先拆资源或分包。

### 6. 生命周期 / 请求 / 登录态 / 拦截器
- 输入：onLaunch、onLoad、onShow、mounted、activated、onUnload、页面返回、tabBar、登录续期、请求封装、uni.addInterceptor。
- 动作：onLoad 管参数，onShow 管回显刷新且防重；请求层统一 token、401 单飞、超时、取消、loading、错误提示；页面销毁丢弃过期响应；拦截 request/upload/download/navigate/switchTab 时要核递归和白名单。
- 证据：重复进入、返回刷新、登录过期、弱网、取消请求、页面销毁后的日志、拦截命中日志。
- 兜底：无法复现重复请求时保留埋点和日志，不宣称已修复。

### 7. H5 / WebView / 浏览器兼容
- 输入：部署 base、history/hash、CDN、Cookie、跨域、H5 proxy、第三方登录、内嵌 WebView、移动浏览器。
- 动作：检查 publicPath/base、刷新 fallback、授权回跳、SameSite、Storage Partitioning、WebView 宿主限制、键盘和安全区；开发代理与生产 baseUrl 不得混用。
- 证据：生产同路径刷新、Network、浏览器矩阵、WebView 真机日志、代理与生产请求地址对账。
- 兜底：本地 dev server 和 H5 proxy 通过不能判 H5 发行通过。

### 8. App-Plus / uni-app x / nvue / uvue / uts / 原生插件
- 输入：运行基座、自定义基座、正式包、uni-app x、HBuilderX 5.0+、插件版本、uts 目标、Android/iOS 权限、离线包策略。
- 动作：原生能力进适配层；确认组件插件矩阵、插件支持平台、权限声明、打包方式、降级路径；nvue/uvue 不按普通 Web DOM/CSS 假设。
- 证据：自定义基座或正式包日志、Android Logcat、iOS device log、崩溃日志、权限弹窗、真机结果、HBuilderX 版本。
- 兜底：插件缺平台支持时给降级，不把 App 能力误判为 H5/小程序能力。

### 9. 微信 / 支付宝 / 抖音小程序差异
- 输入：目标平台、基础库、开发者工具、登录、支付、订阅消息、分享、隐私接口、插件、审核材料。
- 动作：平台 API、返回字段、错误码、授权时机、域名白名单、审核材料逐端确认；复杂平台深水区切相邻原生小程序技能。
- 证据：开发者工具、真机、体验版、平台后台配置、请求响应、审核反馈。
- 兜底：微信通过不代表支付宝、抖音通过；uni API 统一形态不统一宿主规则。

### 10. 权限 / 支付 / 登录 / 分享 / 审核
- 输入：平台、账号体系、openid/unionid/user_id、手机号、定位、相机、相册、支付渠道、分享场景、Android permissions。
- 动作：权限声明、隐私协议、弹窗时机、后端签名、回调、拒绝态、取消态、重复态、审核测试账号逐端覆盖；Android 权限遵循最小化，只声明实际调用的定位、相机、相册、蓝牙、通知等能力。
- 证据：请求/响应样本、平台回调、权限弹窗、审核配置、异常码处理、manifest 权限 diff。
- 兜底：前端 success 不等于支付或订单最终成功。

### 11. uniCloud / 云函数 / 云对象 / 数据权限
- 输入：云服务商、环境、云函数/云对象、数据库权限、schema、上传存储、定时任务、客户端调用点。
- 动作：前端只传可信最小输入；云函数校验身份、角色、资源归属；区分本地云函数、测试环境、正式环境；日志脱敏。
- 证据：云函数日志、环境 ID、请求样本、权限配置、错误码、回滚路径。
- 兜底：客户端校验不算安全边界；涉表结构/权限联动 db/api。

### 12. CSS / rpx / vh / 安全区 / 键盘 / 多窗口
- 输入：目标端、屏幕尺寸、导航栏、tabBar、leftWindow/topWindow/rightWindow、状态栏、safeAreaInsets、键盘、横竖屏、nvue/uvue。
- 动作：rpx、px、vh/dvh/svh、env(safe-area-inset-*)、getWindowInfo、safeAreaInsets、状态栏高度、键盘弹起、滚动容器逐端处理；nvue/uvue 使用支持的样式集。
- 证据：320/375/折叠屏/低端 Android/iPhone 真机截图或录屏、键盘和安全区证据、多窗口布局截图。
- 兜底：H5 样式正常不代表 App 和小程序真机正常。

### 13. 组件生态 / 样式系统 / easycom / 插件矩阵
- 输入：uView/uView Plus、uni-ui、uni_modules 版本、easycom 规则、Vue2/Vue3、主题、暗色、国际化、图标字体、设计稿尺寸、externalClasses、CSS 变量。
- 动作：先锁组件库与 uni_modules 版本，确认 Vue/uni-app x/uvue 支持；查 easycom 命名冲突、本地组件覆盖、自动引入产物；小程序 externalClasses、CSS 变量、主题和暗色按端验证。
- 证据：package 或 uni_modules 版本、组件插件矩阵、easycom 配置、构建日志、目标端截图、暗色/语言切换证据。
- 兜底：组件库示例通过不等于项目多端通过；自动升级、样式变量和命名冲突未验证时禁止扩大结论。

### 14. 状态管理 / 缓存 / 页面栈恢复
- 输入：Vuex/Pinia、持久化插件、token、用户资料、tabBar 多页共享状态、storage、页面栈、离线数据、退出登录。
- 动作：token 刷新单飞，状态分内存/持久化/服务端事实；登录态过期、切号、退出登录要清理 storage、页面缓存和 tabBar 展示；离线数据标版本、租户、用户和 TTL。
- 证据：冷启动、热启动、tabBar 切换、切号、过期、隐私模式、不同小程序端 storage 限制和容量证据。
- 兜底：storage 可用不代表安全或一致；客户端缓存只作体验优化，不能替代服务端鉴权。

### 15. 性能 / 包体 / 低端机 / uni.scss
- 输入：首屏、长列表、图片、字体、source map、主包/分包、preloadRule、setData 或响应式大对象、低端 Android、弱网、uni.scss。
- 动作：压主包资源，图片懒加载/压缩/占位，长列表分页或虚拟化，避免大对象深响应；检查分包预加载、Tree-shaking、source map、字体、uni.scss 全局样式和未用资源进入产物。
- 证据：包体报告、首屏耗时、低端真机 FPS/内存、Network、体验版或发行包加载日志、uni.scss 影响范围。
- 兜底：开发工具流畅不代表低端真机；主包未超限不代表审核包、体验版或渠道包都合格。

### 16. 自动化测试 / 截图基线
- 输入：uni-automator、Jest、目标端、页面路径、测试账号、截图 baseline、CI 环境、模拟器/真机。
- 动作：核心链路用 uni-automator 做启动、跳转、点击、表单、权限拒绝和关键提交；纯函数/适配层用 Jest；UI 回归保留 screenshot baseline 并按端更新阈值。
- 证据：测试命令、CI 日志、失败截图、baseline diff、设备和端版本。
- 兜底：只跑 Jest 不能证明跨端 UI 和宿主能力；只看截图不能证明业务状态正确。

### 17. 发布审核 / 平台材料
- 输入：App Store/应用市场、微信/支付宝/抖音小程序、H5 域名、备案、类目、资质、隐私协议、SDK 清单、测试账号。
- 动作：App 检查权限说明、SDK 采集说明、隐私政策、第三方插件、iOS Privacy Manifest 影响；小程序检查后台域名、类目资质、隐私接口、体验版、审核账号；H5 检查备案、CORS、OAuth 回跳和 WebView 限制。
- 证据：平台后台配置截图或记录、审核反馈、权限弹窗、隐私协议版本、测试账号、发行包或体验版结果。
- 兜底：拒审先定位条款、页面、接口、权限和复现路径；涉及合规的能力变更必须走正常审核与发布流程。

### 18. 平台开放能力矩阵
- 输入：登录、手机号、支付、订阅消息、分享、定位、相机、相册、蓝牙、剪贴板、web-view、scheme/universal link/app link。
- 动作：逐端记录字段、错误码、授权时机、后台配置、回调路径、取消/拒绝/超时/重复态；敏感参数不进分享路径或二维码。
- 证据：请求/响应样本、平台后台配置、真机或体验版日志、异常态截图、后端回调或订单状态。
- 兜底：成功回调不等于最终业务成功；微信字段和流程不得直接外推到支付宝、抖音、H5 或 App-Plus。

### 19. 上传 / 下载 / 文件预览
- 输入：文件来源、大小、扩展名、MIME、临时路径/持久路径、上传签名、下载域名、预览方式、权限、弱网和清理策略。
- 动作：统一 uploadFile/downloadFile 拦截、进度、取消、超时、重试、错误码、大小限制和脱敏日志；App/H5/小程序分别处理临时文件路径、沙盒、相册/文件权限和预览能力。
- 证据：成功、取消、超限、断网、超时、重复上传、权限拒绝、后台返回异常、下载后预览和缓存清理证据。
- 兜底：H5 Blob、File、URL.createObjectURL、a.download 不能外推到 App-Plus 或小程序。

### 20. API 字段 / 旧版本兼容 / 灰度
- 输入：接口文档或抓包、字段类型、必填/可选、默认值、错误码、旧版本 App/小程序、灰度开关、后端兼容窗口。
- 动作：DTO/adapter 层统一字段映射；新增字段保持旧端可忽略，删除/改名要有兼容转换；关键提交加幂等、防重复点击和服务端最终态校验。
- 证据：新旧字段样本、错误码样本、旧版本真机或体验版、灰度开关、回滚后表现、重复提交和乱序回包日志。
- 兜底：只看当前开发版接口成功不能判旧版本、灰度用户或审核包安全。

## 高频坑 / 防遗漏

### 高频坑
1. HBuilderX 能跑，CLI/Vite 或 CI 失败，未锁编译器和依赖版本。
2. Vue2 项目按 Vue3 setup 改，或 Vue3 代码沿用 Vue2 this/$refs 时序。
3. 条件编译只隔离 script，模板/样式/配置仍含端私有能力。
4. manifest.json 权限、scheme、App-Plus 模块、隐私描述、原生插件漏配。
5. pages.json 改路径但跳转、分享、tabBar、subPackages 未同步。
6. manifest.config.ts/pages.config.ts 生成后产物未验，导致手写配置和发行配置不一致。
7. loadEnv、--mode、platform scripts、appid、base、域名混用，开发包连正式环境或反向污染。
8. uni.addInterceptor 拦截 navigate/request 后递归、漏白名单或吞错误。
9. H5 proxy 只在本地生效，生产 baseUrl、CORS、白名单未配。
10. nvue/uvue 当普通 Web Vue 写，CSS、DOM、滚动、层级假设错误。
11. uni-app x/uvue/uts 与 HBuilderX 5.0+ 版本、插件矩阵未核，单端通过就外推。
12. uts 或原生插件只测 Android，iOS 未构建或反过来。
13. Android permissions 过量声明，隐私弹窗、上架材料和实际调用不一致。
14. onShow 重复请求覆盖状态，登录刷新与页面回显互相打架。
15. 自定义 tabBar index、selectedIndex、页面栈和权限态不同步。
16. 微信小程序 API 直接平移到支付宝/抖音/H5/App-Plus。
17. H5 本地正常，发行后 base、history、Cookie、跨域或 WebView 登录失败。
18. 离线包路径、资源 hash、CDN 缓存和宿主版本不一致导致白屏。
19. uniCloud 本地云函数通过，正式环境权限、环境 ID、schema 不一致。
20. CSS 只测 H5，App/小程序安全区、键盘、导航栏、rpx 换算翻车。
21. leftWindow/topWindow/rightWindow、getWindowInfo、safeAreaInsets 在不同端返回和布局策略不同。
22. 真机调试缺日志，只凭开发工具模拟器结论。
23. uView/uView Plus、uni-ui 或 uni_modules 自动升级，引发 Vue 版本不兼容、样式变量失效或构建失败。
24. externalClasses、CSS 变量、主题、暗色在小程序/App/H5 产物表现不一致。
25. easycom 命名冲突，本地组件与 uni_modules 组件在不同端解析不一致。
26. Pinia/Vuex 持久化登录态过期，tabBar 多页仍显示旧用户信息。
27. storage 在 H5 隐私模式、App、不同小程序端容量、同步和清理行为不同。
28. 图片、字体、source map、uni.scss 全局样式或未用资源进入产物，体验版、审核包或渠道包超限。
29. 长列表在开发工具流畅，低端 Android App-Plus 掉帧、白屏或内存上涨。
30. 分享路径携带登录态、token、手机号等敏感参数，导致审核或安全问题。
31. App 新增三方 SDK 或原生插件，隐私政策、权限说明、SDK 清单未同步导致拒审。
32. uni-automator 只测 H5 或只测模拟器，未覆盖主端真机/体验版；Jest 通过不代表宿主能力通过。
33. screenshot baseline 未锁设备、主题、字体和安全区，导致假阳性或漏报。
34. 平台私有 API 写进公共 adapter 外层，导致其它端编译产物含不可用调用。
35. request 成功只按 HTTP 200 判断，忽略业务 code、旧字段、空数组、null 和错误提示一致性。
36. uploadFile/downloadFile 未接统一 token、超时、取消、进度和错误码，线上弱网重复提交。
37. 临时文件路径当长期路径保存，App 重启或小程序清缓存后图片/附件丢失。
38. 订阅消息、手机号、定位等权限文案临上线才补，审核材料、弹窗和实际调用不一致。
39. token、openid、手机号、支付参数、上传签名进入 console、埋点、错误上报或截图。
40. 旧版本 App 基座、小程序基础库或已发布体验版未测，新增 API 在旧端白屏。
41. 键盘弹起只测 iPhone，低端 Android、WebView、小程序输入框被按钮或安全区遮挡。
42. 关键提交不防重复点击、不做幂等、不查服务端最终态，支付/下单/报名出现重复记录。
43. 灰度开关只在前端判断，后端字段、权限和菜单未兼容，回滚后旧页面读取新缓存崩溃。

### 防遗漏清单
- 版本：uni-app、Vue2/Vue3、HBuilderX、HBuilderX 5.0+、CLI/Vite、基础库、App SDK、uni_modules、组件库、原生插件是否记录？
- 端：App-Plus、H5、微信小程序、支付宝小程序、抖音小程序、Android/iOS 是否逐端声明通过/未验证？
- 入口：冷启动、热启动、分享、扫码、scheme、登录回跳、支付回跳、tabBar、自定义 tabBar index、分包、web-view、wgt、离线包是否列齐？
- 配置：manifest.json、pages.json、manifest.config.ts、pages.config.ts、easycom、uni_modules、权限、隐私、原生插件、云环境、发行配置是否同步？
- 环境：loadEnv、--mode、platform scripts、appid、base、baseUrl、域名、证书、source map 是否按端隔离？
- 路由：navigateTo、redirectTo、reLaunch、switchTab、分享路径、二维码参数是否全量搜？
- 拦截：uni.addInterceptor、请求封装、H5 proxy、生产 baseUrl、错误码、401 单飞和白名单是否有证据？
- 生命周期：onLoad/onShow/mounted/unmounted/onUnload、页面栈缓存、tabBar 状态是否分工明确并防重？
- 状态：Vuex/Pinia、token、storage、离线数据、退出登录、切号和 TTL 是否有清理与恢复策略？
- 窗口样式：leftWindow/topWindow/rightWindow、getWindowInfo、safeAreaInsets、rpx/vh、安全区、键盘是否逐端验？
- 组件：uView/uView Plus、uni-ui、easycom、uni_modules、组件插件矩阵、externalClasses、CSS 变量、主题、暗色、国际化是否锁版本和验产物？
- 性能：首屏、长列表、图片、字体、uni.scss、source map、主包/分包、低端机是否有证据？
- 权限：Android permissions 是否最小化；App、小程序隐私接口、权限弹窗、审核材料是否一致？
- 测试：uni-automator、Jest、screenshot baseline、CI 日志、失败截图是否覆盖主链路？
- 发布：wgt、离线包、灰度、回滚、包体、审核材料、SDK 清单、测试账号是否有证据？
- 调试：真机调试、构建日志、Network、原生日志、云函数日志是否至少覆盖主链路？
- API：字段类型、null/空值、错误码、旧字段、灰度字段、重复提交和服务端最终态是否有样本？
- 文件：上传/下载/预览的成功、取消、超限、断网、超时、权限拒绝、缓存清理是否有证据？
- 安全：token、openid、手机号、支付参数、上传签名、定位和身份证号是否确认未进日志、分享、二维码、埋点和截图？
- 兼容：旧 App 基座、低版本小程序基础库、旧体验版、灰度用户和回滚包是否声明通过/未验证？

## uni-app 专属最小回归模板

- 端矩阵：主端必须真机或体验版；必保端至少构建通过并标明未跑项；App 分 Android/iOS，H5 分生产同路径与 WebView，小程序分工具/真机/体验版。
- 链路矩阵：冷启动、登录、切号、tabBar 切换、自定义 tabBar index、分享进入、扫码进入、支付或关键提交、返回刷新、弱网、权限拒绝、退出登录。
- 产物矩阵：appid、base、baseUrl、主包/分包体积、source map、资源 hash、权限声明、隐私弹窗、SDK 清单、manifest/pages 配置、云环境和版本号。
- 接口矩阵：正常、空值、null、旧字段、错误码、401、403、5xx、超时、重复提交、乱序回包、页面销毁后回包和灰度字段。
- 文件矩阵：上传、下载、预览、取消、超限、断网、重试、临时路径失效、权限拒绝、缓存清理和 CDN 旧资源。
- 样式矩阵：rpx/vh、safeAreaInsets、getWindowInfo、leftWindow/topWindow/rightWindow、键盘弹起、暗色、国际化、externalClasses、CSS 变量。
- 自动化矩阵：uni-automator 跑跨端核心链路，Jest 跑适配层和纯函数，screenshot baseline 跑关键 UI 状态并记录设备与阈值。
- 证据矩阵：构建日志、Network、console、原生日志、云函数日志、平台后台配置、审核反馈；未跑必须写未验证。

## 输出要求

1. 场景卡：说明命中哪张卡和原因。
2. 端/运行时证据：列 uni-app、Vue2/Vue3、HBuilderX/CLI/Vite、HBuilderX 5.0+、uni-app x/uvue/uts、目标端基础库/SDK、插件版本；未知写需验证。
3. 入口链路：列页面、pages.json、manifest.json、pages.config.ts、manifest.config.ts、分包、分享/扫码/scheme/登录/支付/web-view/wgt/离线包/uniCloud 入口。
4. 构建环境：列 loadEnv、--mode、platform scripts、appid、base、baseUrl、域名、证书、source map 和生成产物证据。
5. 改动策略：条件编译边界、适配层位置、运行时轻差异、配置联动、相邻技能切分。
6. 请求与状态：列 uni.addInterceptor、H5 proxy、request 封装、Vuex/Pinia、token 刷新、storage、页面栈、tabBar 状态、离线数据的影响和清理策略。
7. 组件与样式：列 uView/uView Plus、uni-ui、easycom、uni_modules、组件插件矩阵、externalClasses、CSS 变量、主题、暗色、国际化、图标字体、rpx/vh/safeAreaInsets/getWindowInfo 的验证证据。
8. 性能与产物：列首屏、长列表、图片、uni.scss、包体、分包预加载、source map、低端机、发行包差异。
9. 权限与审核：列 Android permissions 最小化、隐私弹窗、SDK 清单、平台后台配置、测试账号和拒审反馈。
10. 风险与证据：每个结论绑定构建日志、真机调试、Network、截图、原生日志、云函数日志、产物或代码位置；未跑写未验证。
11. 测试建议：按 tst 给正常、边界、异常、权限、兼容、回归、发行包矩阵，包含 uni-automator、Jest、screenshot baseline。
12. 审计收口：按 aud 给影响面、调用方/消费方、剩余风险和是否需补相邻技能。
13. 验收证据：列主端真机/体验版、必保端构建、弱网、旧版本、权限拒绝、上传下载、接口异常和审核材料的通过/未验证状态。

## 约束

- 禁止把 window、document、localStorage、vue-router、axios 当跨端默认能力。
- 禁止未确认目标端就写条件编译或平台私有 API。
- 禁止只改页面文件不查 pages.json、manifest.json、pages.config.ts、manifest.config.ts、路由引用、分包、权限、云环境和发行配置。
- 禁止用模拟器、开发工具或 HBuilderX 运行结论替代真机、体验版、发行包证据。
- 禁止把微信、支付宝、抖音、H5、App-Plus 的登录、支付、分享、权限当等价能力。
- 禁止引入原生插件、uts、uni_modules 新依赖而不说明版本、平台支持、构建方式和降级。
- 禁止在未验证组件插件矩阵时宣称 uni-app x、uvue、uts、HBuilderX 5.0+ 全端可用。
- 禁止组件库、uni_modules、easycom 自动升级后不记录版本、不验证 Vue2/Vue3 和目标端产物。
- 禁止忽略 externalClasses、CSS 变量、主题、暗色、国际化在各端的产物差异。
- 禁止把 storage、Pinia/Vuex 持久化或客户端缓存当作安全边界。
- 禁止分享路径、二维码、scheme 携带 token、手机号、身份证号、订单密钥等敏感参数。
- 禁止把 token、openid、手机号、定位、支付参数、上传签名、身份证号写入 console、埋点、错误上报、截图或审核材料。
- 禁止 Android permissions 过量声明或与实际调用、隐私政策、权限弹窗不一致。
- 禁止只跑 Jest 或只跑截图就宣称跨端核心链路通过。
- 禁止只测 H5、只测开发者工具、只测成功态、只测当前版本，就宣称跨端、旧版本、弱网、审核包全部通过。
- 禁止用平台专有 API、专有组件、H5 文件能力或浏览器对象处理公共逻辑而不做条件编译和降级。
- 禁止改接口字段、缓存结构、路由参数或权限动作时不验证旧版本兼容、灰度开关和回滚表现。
- 涉 JS/TS/Vue 语言细节联动 jsts；涉平台原生小程序深水区联动对应小程序技能；涉 Android/iOS 原生联动 andr/appl；涉 UI 联动 u；涉接口联动 api；涉数据权限联动 db；涉发布链路联动 rls；涉测试联动 tst；最终代码改动用 aud 收口。

## 高频 Bug 反例库

- 反例 1：Vue2/Vue3 生命周期混用。错法：Vue2 页面照搬 Vue3 setup，或 Vue3 依赖 this/$refs 同步可用。对法：先确认 Vue2/Vue3 与编译模式，再分页面生命周期和组件生命周期。根因：uni-app 语法兼容不等于运行时时序一致。
- 反例 2：HBuilderX/CLI 构建差异。错法：HBuilderX 运行成功就提交，CI 的 CLI/Vite 构建失败。对法：锁编译器、依赖、环境变量和命令，保留两边日志。根因：工具链、插件解析和产物处理不同。
- 反例 3：manifest.config.ts/pages.config.ts 生成漂移。错法：只看源配置，未看生成后的 manifest.json/pages.json。对法：对账生成产物、平台配置和发行包。根因：构建期配置才是运行事实。
- 反例 4：loadEnv/--mode 混用。错法：dev 包使用 prod appid/baseUrl 或生产包带测试域名。对法：按 platform scripts、appid、base、域名和云环境逐端验。根因：环境变量注入与平台构建链不一致。
- 反例 5：uni.addInterceptor 递归。错法：拦截 navigate/request 后内部再次触发同类 API，无白名单。对法：加幂等标记、白名单和错误透传。根因：拦截器改变全局 API 行为。
- 反例 6：H5 proxy 外推。错法：本地代理通了就判接口可用。对法：生产 baseUrl、CORS、Cookie、平台域名白名单单独验证。根因：dev server 代理不进入发行产物。
- 反例 7：manifest.json 权限漏配。错法：调用定位/相机/蓝牙后只改页面，不补 App-Plus 权限和隐私描述。对法：同步 manifest.json、系统权限、隐私协议、真机弹窗和审核材料。根因：App 能力由代码、系统权限、打包配置共同生效。
- 反例 8：Android permissions 过量。错法：模板默认权限全保留。对法：按实际调用最小声明并验拒绝态。根因：权限声明会影响隐私弹窗、审核和用户信任。
- 反例 9：pages.json 分包路径漂移。错法：移动页面后只改 navigateTo，未改 subPackages root、分享路径和预下载。对法：页面文件、pages.json、跳转、分享、二维码、preload 一起验证。根因：路由注册与文件路径不会自动全量同步。
- 反例 10：自定义 tabBar index 错位。错法：页面权限变化或 switchTab 后 selectedIndex 未同步。对法：统一 tabBar 状态源，覆盖切换、回退、登录态变化。根因：自定义 tabBar 不等同原生 tabBar 自动状态。
- 反例 11：微信/支付宝/抖音 API 等价误判。错法：微信登录、支付、订阅消息代码直接复制到支付宝或抖音。对法：抽平台适配层，分别处理字段、错误码、授权、后台配置和审核材料。根因：uni API 统一形态，不统一宿主规则。
- 反例 12：nvue/uvue 按 Web 写。错法：使用普通 DOM、复杂 CSS、vh 计算和 Web 滚动假设。对法：按 nvue/uvue 支持集重写布局，Android/iOS 真机验证。根因：渲染模型不是浏览器 DOM。
- 反例 13：uts/原生插件单端通过。错法：Android 自定义基座通过后宣布 App 全端可用。对法：分别构建 Android/iOS，确认插件版本、权限、降级和崩溃日志。根因：原生桥接与插件平台支持不对称。
- 反例 14：uni-app x/HBuilderX 5.0+ 兼容误判。错法：只看文档示例，不核项目插件矩阵。对法：锁 HBuilderX、uni-app x、uvue、uts 和插件版本，跑目标端构建。根因：新运行时能力随版本快速变化。
- 反例 15：组件样式跨端漂移。错法：externalClasses、CSS 变量、主题、暗色只在微信或 H5 验。对法：按端截图和产物检查。根因：样式隔离和变量机制受宿主影响。
- 反例 16：窗口安全区误判。错法：只用 vh 固定底部按钮，忽略 safeAreaInsets 和 leftWindow/topWindow/rightWindow。对法：getWindowInfo 加真机截图验证。根因：多窗口、导航栏、手势区和键盘改变可用视口。
- 反例 17：onShow 重复请求覆盖状态。错法：返回页面就刷新列表、重置表单或覆盖支付结果。对法：用首次加载、脏标记、参数版本、请求取消和过期响应丢弃。根因：onShow 触发频繁，返回不是首次进入。
- 反例 18：H5 刷新或授权回跳失败。错法：本地路由正常就判 H5 通过。对法：检查 base、history/hash、服务器 fallback、Cookie、跨域和回跳参数。根因：发行环境和 dev server 路由处理不同。
- 反例 19：支付/登录/分享只测成功态。错法：只测微信支付成功，不测取消、失败、重复、超时、未授权、无网络。对法：逐端覆盖成功、取消、失败、超时、重复、权限拒绝和后端回调。根因：平台能力异常态更容易线上翻车。
- 反例 20：离线包缓存白屏。错法：只测首次下载，未测宿主版本、base path、CDN 缓存和资源清理。对法：覆盖冷启动、升级、回滚、弱网和旧缓存。根因：离线包受宿主、路径、hash、缓存策略共同约束。
- 反例 21：uni.scss 包体膨胀。错法：全局引入大字体、背景图和未用 mixin。对法：查产物包体报告，拆资源并按端裁剪。根因：全局样式和静态资源可能进入多个端产物。
- 反例 22：自动化证据不足。错法：Jest 通过后宣称登录支付全端通过。对法：uni-automator 覆盖宿主链路，截图 baseline 覆盖关键 UI。根因：单元测试不能替代跨端运行证据。
- 反例 23：截图基线漂移。错法：不同设备、主题、字体下直接比对失败。对法：固定设备、主题、字体、安全区和阈值。根因：跨端渲染存在宿主差异。
- 反例 24：审核材料滞后。错法：App 加 SDK 或原生插件后不更新隐私政策、权限说明和 SDK 清单。对法：开发期同步材料、弹窗、测试账号和拒审整改记录。根因：平台审核看代码、包体、权限、行为和材料的一致性。
- 反例 25：字段兼容漏测。错法：新增接口字段后只测当前开发版，旧体验版读取 undefined 白屏。对法：adapter 保留默认值和旧字段映射，跑旧版本样本。根因：uni-app 多端常有已发布旧包同时在线。
- 反例 26：上传下载弱网翻车。错法：只测 Wi-Fi 成功上传，未处理取消、超时、重试和进度。对法：统一 upload/download 门禁，覆盖断网、超限、重复和清理。根因：文件 API 受宿主、网络、路径和权限共同影响。
- 反例 27：日志泄露 token。错法：调试 request、分享参数、上传签名时直接 console 输出。对法：日志脱敏，敏感字段禁止进埋点和截图。根因：跨端调试日志常被真机、平台工具、错误上报长期保存。
- 反例 28：权限拒绝态缺失。错法：相机/定位/相册只测授权成功，用户拒绝后页面卡死。对法：拒绝、取消、再次授权、系统设置回跳逐端处理。根因：权限由宿主控制，失败态比成功态更分散。
- 反例 29：旧基础库未验。错法：使用新 API 后只在最新版开发者工具通过。对法：声明最低基础库和降级策略，体验版真机验证。根因：用户端宿主版本不可由代码即时升级。
- 反例 30：重复提交。错法：按钮 loading 只改视觉，弱网连点仍发多次下单。对法：前端防重、请求取消、服务端幂等和最终态查询一起做。根因：UI 状态不是事务边界。
- 反例 31：键盘安全区遮挡。错法：底部按钮 fixed 加 vh，只在 H5 预览正常。对法：结合 safeAreaInsets、键盘事件和滚动容器逐端截图。根因：输入法、导航栏、手势区和 WebView 尺寸各端不同。
- 反例 32：审核权限文案滞后。错法：开发完才发现隐私说明、订阅消息用途、相册权限文案不匹配。对法：需求阶段列敏感能力和审核材料，开发期同步弹窗与后台配置。根因：平台审核按包体、行为和材料一致性判断。
- 反例 33：灰度回滚缓存崩溃。错法：新版本写入新 storage 结构，回滚后旧页面直接读取崩溃。对法：缓存加版本、TTL、迁移和清理，回滚包验证。根因：客户端缓存生命周期长于一次发布。

## 提交前自检清单

- [ ] 行数 < 500，fenced code block 数为 0。
- [ ] H1 等于 manifest title（UniApp 开发）。
- [ ] 已覆盖快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例库不少于 10 条，且每条包含错法、对法、根因。
- [ ] 核心关键词齐全：Vue2、Vue3、Vite、HBuilderX、nvue、uvue、uts、App-Plus、微信小程序、支付宝小程序、抖音小程序、条件编译、manifest.json、pages.json、manifest.config.ts、pages.config.ts、loadEnv、--mode、appid、base、platform scripts、分包、subPackages、原生插件、权限、桥接、rpx、vh、安全区、uniCloud、发行包差异。
- [ ] 已覆盖 uni.addInterceptor、H5 proxy、baseUrl、uni-automator、Jest、screenshot baseline、uni-app x、HBuilderX 5.0+、组件插件矩阵、externalClasses、CSS 变量、leftWindow、topWindow、rightWindow、getWindowInfo、safeAreaInsets、Android permissions、自定义 tabBar index、uni.scss package size。
- [ ] 已覆盖 uView/uView Plus、uni-ui、easycom、uni_modules、主题、暗色、国际化、Vuex/Pinia、storage、性能、包体、发布审核和平台开放能力矩阵。
- [ ] 已覆盖工程门禁、API 字段兼容、上传下载、弱网、旧版本、日志脱敏、权限拒绝、审核权限文案、灰度回滚和服务端最终态。
- [ ] 输出口径已按 tst 保留测试矩阵、证据分级和无法验证声明。
- [ ] 收口口径已按 aud 保留需求对账、影响面、调用方/消费方和剩余风险。
- [ ] 未把相邻技能内容扩写成越界百科。
- [ ] 未引用本地 skills 文件或本地 SQLite 作为依据。

## 2024-2026 新坑速查

- uni-app x / uts / uvue：语法、插件、平台支持仍快速变化；落地前必须核目标版本、HBuilderX 5.0+、组件插件矩阵和 Android/iOS 构建证据。
- Vue3 默认化：新项目常用 Vue3，但旧项目仍大量 Vue2；Composition API、this、生命周期、插件生态迁移要逐项确认。
- Vite 与 HBuilderX 差异：插件解析、loadEnv、--mode、platform scripts、依赖锁、云打包和本地构建可能不同；发布以实际构建命令和产物为准。
- 配置工程化：manifest.config.ts/pages.config.ts 可以减少多环境重复，但必须验生成后的 manifest.json/pages.json、appid、base、权限和分包。
- 微信小程序：隐私接口、手机号、订阅消息、Skyline/virtualHost、externalClasses、CSS 变量、基础库能力按版本和配置核验。
- 支付宝小程序：授权、会员、商家能力、订阅消息、支付回跳和审核材料不可套用微信口径。
- 抖音小程序：开放能力、分享/挂载、支付、审核和宿主版本要单独验证，不把微信结论外推。
- App-Plus 隐私合规：权限弹窗、Android permissions 最小化、SDK 列表、隐私政策、第三方插件采集说明影响上架。
- iOS Privacy Manifest 与三方 SDK 清单：App-Plus 引入原生插件或 SDK 时需同步材料和包内声明，实际要求按目标平台后台与审核反馈验证。
- HarmonyOS/鸿蒙生态：宿主、市场审核、系统能力和兼容层差异需单独留构建、真机和审核证据，不能由 Android 结论外推。
- nvue/uvue 原生渲染：样式支持、组件行为、滚动、层级和事件与普通 Vue 页面不同，必须真机验证。
- uni_modules 依赖漂移：插件自动升级、平台支持声明不完整、原生依赖冲突会导致构建或运行时失败。
- easycom 与组件库：自动引入、同名组件、主题变量、暗色和国际化在不同端产物可能不一致。
- 状态持久化：H5 隐私模式、小程序 storage 限制、App 缓存清理、tabBar 页面缓存会影响登录态一致性。
- 离线包缓存：宿主版本、资源 hash、base path、CDN 缓存和回滚策略不一致会造成白屏。
- H5 浏览器隐私变化：第三方 Cookie、Storage Partitioning、SameSite、内嵌 WebView、H5 proxy 与生产 baseUrl 差异会影响登录和埋点。
- CSS 视口变化：dvh/svh/lvh、safeAreaInsets、getWindowInfo、leftWindow/topWindow/rightWindow、软键盘、折叠屏、状态栏和导航栏会影响 rpx/vh 布局判断。
- 真机调试限制：低端机、厂商 ROM、系统 WebView、安全区、键盘、弱网和权限弹窗是模拟器高频漏项。
- 自动化回归：uni-automator、Jest、screenshot baseline 要固定端、设备、主题、字体和阈值，否则证据不可复用。
- 包体治理：uni.scss、字体、图片、source map、未用资源和组件库主题包会影响 package size，必须看产物报告。
- 长久在线旧包：App、体验版、小程序审核包和灰度包会同时存在；字段、缓存、路由、权限和接口必须保留兼容窗口。
- 平台隐私收紧：手机号、定位、相册、相机、剪贴板、订阅消息、通知和 SDK 采集要提前准备用途说明、弹窗证据和拒绝态。
- 文件能力差异：H5、App-Plus、小程序的临时文件、沙盒、预览、下载域名、相册权限和缓存清理不同，不能复用单端判断。

## 与相邻技能的边界

- UniApp 开发/uniapp-development（unap） 负责：uni-app 跨端框架、Vue2/Vue3 在 uni-app 内的运行差异、HBuilderX/CLI/Vite 构建入口、loadEnv、--mode、platform scripts、manifest.config.ts/pages.config.ts、App-Plus、H5、小程序适配、uni-app x、nvue/uvue、uts、条件编译、manifest.json、pages.json、uni_modules、easycom、生命周期、分包、subPackages、原生插件、真机调试、离线包、uniCloud 的定位与排障口径。
- JavaScript/TypeScript 开发/javascript-typescript-development（jsts）：负责 JavaScript/TypeScript/Vue 通用语法、类型、状态、异步、构建脚本和前端安全细节。
- 微信小程序/wechat-miniprogram（wcmp）：负责微信小程序原生 app.json/wxml/wxss/Page/Component/setData、基础库、开放能力、externalClasses、审核和灰度深水区。
- 支付宝小程序/alipay-miniprogram（almp）：负责支付宝小程序 AXML/ACSS/my API、授权、商家能力、my.tradePay、体验版和审核深水区。
- 抖音小程序/douyin-miniprogram（dymp）：负责抖音小程序原生配置、开放能力、分享挂载、支付、宿主版本和审核深水区。
- Android 开发/android-development（andr）：负责 Android 原生权限、Manifest、Gradle、Logcat、R8、ANR/Crash、厂商 ROM、targetSdk 行为和 permissions 最小化证据。
- Apple 全链路开发与发布/apple-development（appl）：负责 iOS/macOS/watchOS 原生签名、Info.plist、entitlements、Privacy Manifest、APNs、StoreKit、TestFlight 和审核证据。
- UI 设计实现/ui-design（u）：负责视觉层级、间距、排版、颜色、组件状态、响应式、暗色、安全区视觉与可访问性；UniApp 开发/uniapp-development（unap） 只处理跨端落地约束。
- API 工程/api-engineering（api）：负责接口契约、认证语义、错误码、幂等和版本兼容。
- 数据库工程/database-engineering（db）：负责表结构、SQL、迁移、缓存、事务和服务端数据权限。
- 发布部署/release-engineering（rls）：负责构建发布、灰度、回滚、渠道包、云打包、监控和上线节奏。
- 测试验证/test-engineering（tst）：负责测试矩阵、uni-automator、Jest、screenshot baseline、回归、CI 证据、真机/体验版/发行包验证口径。
- 代码审计/code-audit（aud）：负责最终需求对账、影响面追踪、安全质量收口和剩余风险判断。
