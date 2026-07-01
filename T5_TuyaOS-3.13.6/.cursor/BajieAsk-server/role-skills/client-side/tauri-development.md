---
name: tauri-development
description: Tauri桌面与移动应用实战排障技能，覆盖 Tauri v1/v2、Rust commands、IPC、capabilities/permissions、WebView2/WKWebView/WebKitGTK、sidecar、updater、签名公证、entitlements、CSP、deep link、tray、多窗口、移动端与打包发布边界。
---

# Tauri 桌面应用

Tauri 桌面应用（tauri-development，兼容 slug: taur）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

## 快速总则：版本 / 权限 / 窗口 / 风险 / 证据

1. 版本先行：先确认 Tauri v1 还是 v2，同时列出 tauri、tauri-build、tauri-cli、插件、Rust toolchain、前端构建器和目标 OS；v1 allowlist 与 v2 capabilities/permissions 不得混用。
2. 权限先行：每个 filesystem、shell、dialog、http、sql、window、updater、deep-link、notification、global-shortcut、clipboard、os 能力都必须落到 capability、permission、窗口 label、路径/域名/命令白名单和插件初始化证据。
3. 窗口先行：先分清 main window、子窗口、tray 创建窗口、deep link 唤起窗口、远程 URL 窗口、移动端 WebView；权限、CSP、事件监听、菜单、焦点和生命周期都按窗口验证。
4. 风险先行：凡涉及 shell/fs/updater/deep-link/remote URL/签名/移动端权限，必须给风险等级、影响面、失败模式、回滚或禁用开关。
5. 证据先行：结论必须绑定 Cargo.toml、package.json、tauri.conf.json、capabilities/*.json、permissions/*.json、src-tauri 代码、前端 invoke 调用、构建日志、运行日志、平台产物或签名/公证输出；未跑平台标“未验证”。
6. 改 command 前先搜全部 invoke、generate_handler、参数类型、serde rename、返回类型、错误映射和前端类型声明；改权限前先搜 capability、plugin、窗口 label、CSP 与调用入口。
7. 安全默认拒绝：远程内容窗口默认不能拥有本地高权限；sidecar/shell/updater/deep link/文件系统必须最小化授权并校验参数来源。
8. 发布不是最后一步：identifier、bundle id、证书、entitlements、notarization、WebView2 runtime、Linux WebKitGTK/AppIndicator 依赖、updater 公钥和回滚策略必须在开发期纳入检查。
9. Tauri v2 移动端单独建矩阵：iOS/Android 支持不代表桌面插件、文件路径、窗口、tray、全局快捷键、sidecar、updater 行为可复用。
10. 远程网页封装先判红旗：出现 remote.urls、withGlobalTauri、csp:null、shell:allow-execute 或 devtools 面向生产环境时，默认 P0/P1，先隔离窗口与能力再谈放行。
11. 发布阻断先于功能验收：cargo-vet、cargo-audit、pnpm audit、权限最小化、签名/updater 校验任一未闭环时，不能声明可发布。

## 单技能工程门禁

- 需求落地门禁：先把用户需求拆成窗口、前端入口、Rust command、插件能力、文件/网络/进程/更新/签名边界、目标平台、验证产物；缺任一项不得直接写“已完成”。
- IPC schema 门禁：每个 invoke 必须有 command 名称、参数结构、serde rename/camelCase 对照、返回结构、错误枚举、前端类型和失败分支；禁止用 loose any 或字符串拼 payload 混过。
- Command 边界门禁：Rust command 只接受业务必要字段；禁止把前端传入的路径、URL、命令、环境变量、文件名、shell 参数直接送入 fs/shell/process/sidecar/updater。
- Capability 门禁：新增能力必须写窗口 label、permission identifier、scope allow/deny、拒绝路径和最小授权理由；禁止用 all、recursive、任意 URL、任意命令、任意目录兜底。
- Frontend trust boundary 门禁：前端只是非可信调用方；所有鉴权、路径归一化、扩展名/协议白名单、大小限制、租户/用户边界、危险操作确认必须在 Rust command 或后端复核。
- 文件路径门禁：所有用户可控路径必须 canonicalize 后验证 base directory、符号链接、父目录跳转、移动端沙盒、Windows UNC/盘符、macOS bookmark/entitlement；禁止字符串 contains 判断路径安全。
- Shell/sidecar 门禁：只允许固定命令和固定参数模板；URL open 只允许白名单 scheme/host；sidecar 必须验证 bundle 内路径、签名、权限位、退出码和 stdout/stderr 脱敏。
- Updater 门禁：release 前必须验证 public key、latest.json、artifact signature、版本递增、下载域名、CSP/connect-src、relaunch、回滚/禁用更新策略；禁止只看 HTTP 200。
- Release 权限门禁：debug/devtools、宽 capability、测试证书、未脱敏日志、开发 API、debug entitlement、未签名 sidecar 不得进入 release 产物。
- 验收门禁：至少给 dev 运行、release build、安装包首次启动、核心 invoke 成功/失败、权限拒绝、目标平台 WebView、日志路径、构建产物 hash 或签名状态；未跑平台必须列缺口。

## 任务分层与风险量化

### 风险等级
- P0 阻断：可导致远程代码执行、任意文件读写、签名/updater 投毒、用户数据丢失、全平台无法启动；必须停下补证据，修复后做红绿验证和回滚演练。
- P1 高风险：影响登录、支付、自动更新、核心 command、关键数据目录、证书/公证、移动端权限；必须覆盖主平台与失败路径。
- P2 中风险：影响单窗口功能、特定插件、特定系统 WebView、非关键 sidecar；至少覆盖命中平台、拒绝路径和降级行为。
- P3 低风险：文案、纯 UI、非关键菜单或开发体验；可轻量验证，但仍需说明未覆盖平台。

### 影响面检查
- 平台：Windows、macOS、Linux、iOS、Android，目标外平台标不适用或未验证。
- 窗口：main、settings、oauth、remote、tray、hidden、mobile webview，逐一核 label 与 capability。
- 能力：command、event、plugin、fs、shell、http、sql、updater、deep-link、notification、global-shortcut、clipboard、sidecar。
- 插件平台矩阵：每个插件按 Windows、macOS、Linux、iOS、Android 标注 supported、unsupported、partial、unknown，并写明替代路径。
- 发布：dev、debug build、release build、安装包、首次启动、升级、回滚、卸载后重装。
- 数据：配置目录、缓存目录、应用数据目录、用户选择路径、移动端沙盒、迁移和备份。

## 场景执行卡

### 1. 版本识别与 v1/v2 迁移
- 输入：Cargo.toml、package.json、tauri.conf.json、capabilities/permissions 目录、plugins 列表、构建日志、目标平台。
- 动作：列版本矩阵；识别 v1 allowlist、v2 capabilities、插件 API 差异；逐项验证 command、plugin、bundle、updater、窗口权限。
- 风险：权限模型误迁移按 P1；涉及 shell/fs/updater 升 P0/P1。
- 输出证据：版本号、迁移差异清单、失败报错原文、通过的平台与未验证的平台。
- 防遗漏：只 build 成功不等于迁移完成；必须跑实际 invoke、权限拒绝路径和打包产物。

### 2. command / invoke / IPC 排障
- 输入：Rust command 函数、generate_handler、前端 invoke 调用、参数 payload、错误日志、DevTools console。
- 动作：核 command 名称、参数 camelCase/snake_case、serde 类型、async Send 边界、State 管理、错误序列化、前端 await/catch。
- 风险：读写用户数据、执行外部命令、鉴权绕过按 P1/P0；普通查询按 P2。
- 输出证据：调用链位置、参数样例、Rust 日志、前端错误、修复前后响应。
- 防遗漏：不要只改前端参数；同时核 Rust 签名、handler 注册、插件命名空间和权限。
- 低级错拦截：禁止 command 返回裸字符串错误、panic、unwrap、expect 给前端；错误必须映射成稳定 code/message/detail，并覆盖超时、取消、权限拒绝、资源不存在、平台不支持。
- Schema 证据：参数新增/改名必须同步前端类型、测试样例、旧调用兼容或迁移说明；涉及 PATCH/部分更新时区分 absent、null、empty、value。

### 3. v2 capabilities / permissions 排障
- 输入：capabilities/*.json、permissions/*.json、tauri.conf.json、窗口 label、插件权限文档、运行时报错。
- 动作：确认 capability 是否启用、窗口 label 是否匹配、permission identifier 是否正确、allow/deny 范围是否最小、移动端权限是否另配。
- 风险：扩大 fs/shell/http/sql/updater 权限默认 P1；远程窗口获本地高权限默认 P0。
- 输出证据：具体 capability 文件、permission 条目、窗口 label、拒绝日志、最小授权理由。
- 防遗漏：v2 不是“装插件即可用”；未绑定窗口的权限等于运行时不可用。
- Release 对照：同一 capability 必须检查 dev/debug/release 差异；禁止 debug 权限、测试窗口、devtools、宽 scope 被 release 继承。

### 4. CSP / remote URL / Web 安全
- 输入：frontend dist、tauri.conf CSP、asset protocol、自定义协议、remote URL、remote.urls、withGlobalTauri、csp:null、DevTools 安全报错。
- 动作：核 default-src、script-src、connect-src、img-src、media-src、style-src；区分本地 asset、http API、WebSocket、updater、OAuth/deep link；禁止宽泛 unsafe 策略。
- 红旗：remote.urls 面向不受控域名、withGlobalTauri 暴露给远程页面、csp:null、shell:allow-execute、生产 devtools、远程窗口绑定 fs/shell/updater/http 高权限，默认先停。
- 风险：remote URL + 本地高权限、unsafe-inline/unsafe-eval 泛化、任意 connect 默认 P0/P1。
- 输出证据：CSP 规则、被拦截 URL、业务必须的域名、最小放行范围、远程窗口 label 与 capability 隔离证据。
- 防遗漏：远程页面不承接 shell/fs/updater 高权限；跨域问题优先改 API/CSP 证据，不用全局关安全。

### 5. WebView 平台差异
- 输入：Windows WebView2、macOS WKWebView、Linux WebKitGTK 版本、Android System WebView、用户系统版本、渲染/下载/媒体/证书报错。
- 动作：按平台复现；核 runtime 安装、系统 WebView bug、GPU/代理/证书、Linux 包依赖、macOS ATS/entitlements。
- macOS/iOS：关注 WKScriptMessageHandler 注入、消息命名、导航拦截、ATS、证书、scheme handler 与脚本隔离。
- Windows：关注 WebView2 runtime、企业 proxy、证书、data_directory、additional_browser_args、GPU/沙盒参数与用户数据目录权限。
- Android：关注 Android System WebView 版本、Chromium 差异、网络安全配置、文件选择、返回键、Activity 生命周期。
- Linux：关注 webkit2gtk-4.1、WebKitGTK 发行版差异、代理、证书、媒体、cookie、GPU 和系统依赖。
- 风险：目标平台白屏或无法联网按 P1；单媒体/下载异常按 P2。
- 输出证据：平台版本、WebView 版本、复现矩阵、依赖安装或系统限制说明。
- 防遗漏：浏览器正常不代表系统 WebView 正常；必须在目标平台 Tauri 容器中验证。

### 6. sidecar / shell / 外部进程
- 输入：sidecar 配置、二进制路径、权限、签名、参数来源、stdout/stderr、打包产物。
- 动作：核 sidecar 命名、target triple、可执行权限、bundle include、macOS 签名/公证、Windows 杀软、Linux chmod；对参数做白名单。
- 风险：参数可控、路径可控、执行敏感命令默认 P0；固定只读工具按 P1/P2。
- 输出证据：打包内路径、执行日志、退出码、签名状态、参数校验点。
- 防遗漏：开发期能跑不代表打包后能跑；sidecar 必须随产物验证。
- Shell open：外部打开 URL 必须限制 scheme、host、path 规则并拒绝 file/javascript/data/custom 未授权协议；禁止把前端传入 URL 直接 open。
- 输出处理：stdout/stderr 进入前端或日志前必须限长、结构化、脱敏和错误码化；禁止把 secret、token、路径全量、用户文件内容写入 release 日志。

### 7. updater / 签名 / 公证 / entitlements
- 输入：bundle identifier、证书、notary 日志、updater endpoint、公钥、latest.json、signature、安装包、entitlements、relaunch 日志。
- 动作：核签名链、hardened runtime、notarization、staple、Windows 签名、Linux 包元数据、updater 签名与版本递增。
- 桌面边界：Tauri updater 按 desktop only 处理；iOS/Android 通过商店或平台渠道更新，不能套用桌面 updater 结论。
- 更新闭环：latest.json、artifact URL、signature、公钥、版本递增、CSP/connect-src、下载代理、安装后 relaunch 与 process plugin 生命周期逐项验证。
- 风险：updater 签名、公钥、下载源、版本回退默认 P0；单平台公证失败按 P1。
- 输出证据：codesign/notary/updater 验证输出、下载地址来源、签名错误、relaunch 结果、回滚方案。
- 防遗漏：updater 失败常是签名/公钥/版本/URL/CSP/代理组合问题，不只看 HTTP 200。

### 8. deep link / tray / 多窗口生命周期
- 输入：协议注册、单实例策略、tray 事件、多窗口 label、focus/close/hide 逻辑、OS 日志。
- 动作：核协议声明、启动参数解析、已有实例转发、窗口创建时机、事件重复监听、macOS Dock/activation、Windows registry。
- 风险：deep link 携带 token/命令/路径按 P1/P0；普通聚焦异常按 P2。
- 输出证据：协议注册位置、唤起日志、窗口 label、事件次数、目标 OS 行为。
- 防遗漏：deep link 冷启动与热启动是两条路径；tray hide 不等于窗口销毁。

### 9. Rust async / 状态 / 线程边界
- 输入：State、Mutex/RwLock、tokio runtime、长任务、事件 emit、死锁日志、CPU/内存曲线。
- 动作：核阻塞任务是否进 spawn_blocking、锁粒度、Send/Sync、事件频率、取消路径、窗口关闭后的任务清理。
- 风险：核心 command 卡死、数据竞争、状态丢失按 P1；局部卡顿按 P2。
- 输出证据：阻塞点、锁持有范围、任务生命周期、性能数据。
- 防遗漏：不要在 command 中持锁 await；不要让高频 emit 压垮 WebView。

### 10. 打包发布与 CI
- 输入：tauri build 日志、runner OS、系统依赖、签名密钥注入、产物目录、安装验证记录、cargo-vet、cargo-audit、pnpm audit。
- 动作：核 Rust target、Node 包管理器锁文件、前端 dist、Linux apt 依赖、Windows WebView2、macOS keychain、环境变量和缓存。
- 供应链阻断：cargo-vet 未覆盖关键依赖、cargo-audit 存在未处置漏洞、pnpm audit 存在未接受风险、权限未最小化时，发布结论必须标阻断。
- 风险：产物无法安装、签名缺失、密钥泄露、错误渠道发布默认 P1/P0。
- 输出证据：CI job、关键日志、产物哈希、审计结果、安装/启动结果、失败平台。
- 防遗漏：CI 绿色不等于安装包可用；必须至少验证安装、启动、核心 invoke、更新或禁用更新路径。
- 只测 dev server 禁止：`tauri dev`、浏览器预览、Vite dev server 只能证明开发态；发布结论必须来自 release build、安装包启动、打包后的 dist 路径、真实 WebView 和目标平台日志。

### 11. 真实开发闭环
- 入口：先列前端页面/组件、invoke/event/plugin 调用、Rust command、State、持久化、外部进程、系统权限、发布产物的完整链路。
- 实现：每条链路同时补成功、失败、拒绝、取消、超时、平台不支持和旧版本兼容；不要只补 happy path。
- 数据：本地配置、缓存、SQLite、用户文件、下载目录、移动端沙盒必须有迁移、备份/回滚、损坏恢复和权限拒绝策略。
- 安全：command 入参统一做 schema 校验、长度限制、路径/URL/命令白名单、租户/用户边界、日志脱敏和审计点。
- 验证：dev 运行、release build、安装包、目标平台 WebView、权限拒绝、离线/弱网、首次启动、升级/回滚或禁用更新必须按命中场景给证据。
- 交付：输出改动点时同时列能力变化、capability diff、用户可见影响、失败兜底、未验证平台和回滚开关。

## 硬禁止与低级错拦截

- 禁止前端任意 invoke 危险 command；危险 command 必须有固定命令名、强类型参数、Rust 侧白名单、权限检查和审计日志。
- 禁止 capability 过宽：fs/shell/http/dialog/updater/sql/window 不得用全局 all、任意路径、任意 URL、任意命令、所有窗口共享高权限。
- 禁止 shell open 任意 URL；必须拒绝 javascript/data/file 未授权协议、内网跳转、命令注入式 URL、用户可控自定义 scheme。
- 禁止路径穿越：任何 ../、符号链接、UNC、盘符切换、大小写绕过、URL decode 二次解析都必须归一化后验证 base directory。
- 禁止 debug 权限进 release：devtools、debug entitlement、开发证书、测试 API、verbose body log、panic backtrace、mock updater 都必须在 release 前清理。
- 禁止把 remote URL、withGlobalTauri、csp:null、shell/fs/updater 高权限放进同一窗口；必须隔离窗口和能力。
- 禁止只测 dev server；必须验证打包后的 dist、release WebView、安装包和目标平台系统依赖。
- 禁止把浏览器正常当 Tauri 正常；系统 WebView、CSP、asset protocol、权限模型、文件路径和签名链都不同。
- 禁止 unwrap/panic 作为 command 错误处理；禁止把 Rust 内部错误、路径、secret、token、stack trace 原样给前端或日志。
- 禁止 updater 只换 latest.json 或 artifact 不重签；禁止不验证 relaunch 和回滚策略就声明更新可用。

### 12. Tauri v2 移动端验证
- 输入：iOS/Android 工程配置、移动端插件支持情况、权限声明、沙盒路径、设备/模拟器日志、真机限制。
- 动作：区分桌面可用与移动可用；核移动端初始化、权限弹窗、文件/媒体/网络策略、后台/恢复、深链、屏幕旋转和键盘遮挡。
- 风险：移动端数据丢失、权限拒绝崩溃、商店审核阻断按 P1；单机型 UI 异常按 P2/P3。
- 输出证据：设备型号、系统版本、构建类型、权限弹窗、关键日志、未支持插件清单。
- 防遗漏：不要用桌面测试替代移动端；模拟器通过不等于真机通过。

## 测试矩阵

### 最小回归矩阵
- 开发运行：启动、主窗口加载、DevTools 无关键错误、核心 command 成功与失败路径。
- 权限拒绝：fs/shell/http/sql/updater 等能力至少验证允许路径和拒绝路径。
- 多窗口：main 与至少一个子窗口或设置窗口验证 label、权限、事件监听清理。
- 打包产物：安装、首次启动、核心 invoke、退出重启、日志位置、卸载残留。
- 安全边界：remote URL 不持有本地高权限，CSP 最小放行，外部参数白名单。

### 桌面平台矩阵
- Windows：WebView2 runtime、安装器、签名、企业 proxy/证书、路径空格、杀软影响、自动更新、data_directory、additional_browser_args。
- macOS：WKWebView、WKScriptMessageHandler、bundle id、hardened runtime、entitlements、notarization、staple、Gatekeeper 首启。
- Linux：WebKitGTK、webkit2gtk-4.1、GTK/AppIndicator 依赖、包格式、desktop entry、权限位、发行版差异。
- 每个平台均记录：OS 版本、架构、安装包类型、构建命令、启动日志、失败截图或日志片段。

### 移动端矩阵
- iOS：模拟器与真机分开；核 Info.plist 权限、ATS、深链、沙盒路径、WKScriptMessageHandler、前后台切换、签名配置。
- Android：模拟器与真机分开；核 manifest 权限、Android System WebView、网络安全配置、文件选择、返回键、Activity 生命周期、ABI。
- 插件兼容：逐个标注 supported、unsupported、partial、unknown、需替代方案、未验证；不得假设桌面插件自动可用。
- 发布前闭环：安装包安装、首次启动、权限授权/拒绝、核心 command、离线/弱网、升级或清数据重装。

## 高频坑 / 防遗漏

- v1/v2 混用：看到 allowlist、capabilities、permissions、plugin 权限时先判版本，不按记忆迁移。
- 窗口 label 错配：权限绑定到 main，但实际调用来自 child/oauth/settings 窗口会被拒绝。
- command 未注册：函数存在但未进 generate_handler，前端 invoke 只能得到 handler not found。
- 参数大小写错：前端 camelCase 与 Rust snake_case/serde rename 不一致会被反序列化拒绝。
- CSP 漏 connect-src：API/WebSocket/updater/deep link 回调被 CSP 拦截，表现像网络失败。
- WebView 差异：Chrome 正常不能证明 WebView2/WKWebView/WebKitGTK 正常。
- sidecar 路径：开发路径存在，bundle 内命名、权限、签名或 target triple 错导致发布版失败。
- updater 签名：latest.json、artifact、signature、公钥、版本号任何一个不匹配都会失败。
- macOS 权限：麦克风、摄像头、文件访问、网络、Apple Events、hardened runtime 需 Info.plist/entitlements/签名链同时成立。
- Linux 依赖：WebKitGTK、libayatana-appindicator、webkit2gtk 版本缺失会让安装包或运行时崩溃。
- Windows WebView2：企业环境可能缺 runtime、代理或证书，需安装器策略或明确前置条件。
- 移动端差异：tray、全局快捷键、多窗口、sidecar、路径语义在 iOS/Android 不能照搬桌面。
- 移动端生命周期：前后台切换、权限拒绝、系统回收、旋转和键盘遮挡会暴露桌面没有的问题。
- 远程网页红旗：remote.urls、withGlobalTauri、csp:null、shell:allow-execute、生产 devtools 任一出现都要先做窗口隔离和权限收缩。
- updater 桌面限定：latest.json、signature、relaunch、process plugin 只证明桌面更新链路，不能替代移动端发布验证。
- WebView 参数差异：proxy、data_directory、additional_browser_args、Android System WebView、webkit2gtk-4.1 都可能改变线上表现。

## 高频 Bug 反例库

- 反例 1：写错法：Tauri v2 项目继续在 tauri.conf.json 写 allowlist.fs.all=true；对法：改为 capabilities/permissions 中按窗口和路径授权；根因：v2 权限模型从全局 allowlist 变为 capability 驱动。
- 反例 2：写错法：只安装 tauri-plugin-fs 就在前端读任意目录；对法：同时初始化插件、声明 fs 权限、限定 base directory/路径并绑定窗口；根因：插件存在不等于运行时授权。
- 反例 3：写错法：前端 invoke('get_user', { user_id: 1 }) 对 Rust 参数 userId；对法：统一参数名或用 serde rename 并加调用样例；根因：IPC 参数反序列化按字段名匹配。
- 反例 4：写错法：新增 Rust command 但忘记加入 generate_handler；对法：注册 handler 并运行前端实际 invoke；根因：宏函数不会自动暴露给 IPC。
- 反例 5：写错法：给远程 URL 窗口授予 shell:allow-execute；对法：远程窗口无本地高权限，必要操作经受控 command 白名单转发；根因：远程内容与本地能力同窗会扩大 RCE 影响面。
- 反例 6：写错法：CSP 直接加 default-src * 'unsafe-inline'；对法：只为必要 API/WebSocket/asset/updater 增加精确源；根因：用宽 CSP 掩盖资源加载问题会破坏桌面安全边界。
- 反例 7：写错法：sidecar 使用开发机绝对路径 /usr/local/bin/tool；对法：配置 bundle sidecar、按 target triple 命名并验证安装包内执行；根因：发布环境没有开发路径。
- 反例 8：写错法：macOS build 成功就发布 dmg；对法：检查 signing identity、hardened runtime、entitlements、notarization、staple 和首次启动；根因：构建成功不等于 Gatekeeper 放行。
- 反例 9：写错法：updater latest.json 指向新包但沿用旧 signature；对法：每个 artifact 重新签名并确保公钥、版本、URL、CSP 同时匹配；根因：Tauri updater 校验签名和版本而非只下载文件。
- 反例 10：写错法：在 command 中持有 MutexGuard 后 await 网络请求；对法：缩小锁范围或复制数据后 await，长阻塞放 spawn_blocking；根因：Rust async 锁跨 await 易死锁或阻塞 IPC。
- 反例 11：写错法：deep link 只测应用未启动时打开；对法：分别验证冷启动、热启动、已有实例转发、窗口聚焦和参数去重；根因：OS 协议唤起与单实例生命周期不同。
- 反例 12：写错法：tray 点击每次 create_window 且复用 label；对法：先查 get_webview_window，存在则 show/focus，不存在再创建；根因：窗口 label 唯一且生命周期未区分隐藏/销毁。
- 反例 13：写错法：Linux CI 缺 webkitgtk 仍只看 Rust 编译错误；对法：安装并记录 WebKitGTK/AppIndicator/GTK 依赖版本；根因：Tauri Linux 运行和打包依赖系统库。
- 反例 14：写错法：Windows 用户报白屏就改前端路由；对法：先采集 WebView2 runtime、GPU、证书、代理、DevTools console；根因：系统 WebView 环境差异会伪装成前端问题。
- 反例 15：写错法：把桌面文件路径逻辑原样用于 iOS/Android；对法：按移动端沙盒、权限声明和插件支持矩阵重写；根因：Tauri v2 移动端不是桌面 API 的完全子集。
- 反例 16：写错法：iOS 模拟器通过就声明移动端完成；对法：补真机、权限拒绝、前后台切换和签名包安装；根因：模拟器缺少真实权限、性能和系统策略约束。
- 反例 17：写错法：Android 只测首次授权；对法：覆盖拒绝、永久拒绝、系统设置改权限、清数据重装；根因：移动端权限状态会改变插件调用路径。
- 反例 18：写错法：为远程网页窗口同时配置 remote.urls、withGlobalTauri、csp:null 与 shell:allow-execute；对法：远程窗口无本地高权限，必要动作经最小 command 转发并记录审计点；根因：远程内容和本地能力同窗会放大攻击面。
- 反例 19：写错法：latest.json 更新后未重新生成 signature 就发布；对法：每个产物重新签名，验证 signature、公钥、版本、URL、CSP、relaunch 与 process plugin；根因：updater 校验链是组合条件。
- 反例 20：写错法：桌面插件在移动端直接标 supported；对法：维护 plugin platform matrix，逐平台标 supported、unsupported、partial 或 unknown；根因：插件支持与平台能力不等价。
- 反例 21：写错法：前端把任意 command 名称和参数从配置下发后直接 invoke；对法：前端只调用固定 API，Rust command 再做权限和参数白名单；根因：前端不是可信边界。
- 反例 22：写错法：capability 给所有窗口 fs:allow-read-recursive 整个 home；对法：按窗口 label、base directory 和业务子路径授权；根因：桌面本地权限一旦扩大就是数据泄露面。
- 反例 23：写错法：shell open 直接打开用户输入 URL；对法：限制 https、可信 host 和路径，再拒绝 file/javascript/data/custom scheme；根因：URL 也是命令与本地资源入口。
- 反例 24：写错法：用字符串 contains('/safe') 判断文件路径安全；对法：canonicalize 后校验 base directory、符号链接和平台路径语义；根因：路径穿越和链接绕过不会被字符串包含挡住。
- 反例 25：写错法：release 包保留 devtools、测试 capability 和详细 body 日志；对法：release profile 单独审计权限、日志、证书和 API 环境；根因：开发便利项会变成线上攻击面。
- 反例 26：写错法：tauri dev 正常就宣布功能完成；对法：补 tauri build、安装包首次启动、核心 invoke、目标 WebView 和日志证据；根因：dev server 与打包 dist/系统 WebView 不是同一运行环境。
- 反例 27：写错法：command 入参直接传给 sidecar 参数数组；对法：枚举允许动作、固定参数模板、限制长度和字符集，并记录退出码；根因：外部进程是命令注入和权限提升边界。
- 反例 28：写错法：updater endpoint 支持版本回退和未签名测试包；对法：校验版本递增、signature、公钥、渠道、relaunch 与回滚开关；根因：更新链路是远程代码分发通道。
- 反例 29：写错法：把 secret 存在前端 localStorage 或打进 dist；对法：secret 留在 Rust/系统钥匙串/后端，前端只拿短期状态；根因：前端资源可被用户读取和篡改。
- 反例 30：写错法：Windows/macOS/Linux 共用同一文件路径和权限判断；对法：分别验证 UNC/盘符、sandbox/bookmark、权限位、大小写和系统目录；根因：桌面平台路径与权限语义不同。

## 2024-2026 新坑速查

- Tauri v2 稳定后，capabilities/permissions 是权限排障中心；旧 allowlist 经验只能作为迁移线索，不能作为修复方案。
- 插件权限 identifier 与插件版本强绑定；升级插件后要复核 permission 名称、scope 格式和初始化 API。
- 移动端支持提升后，桌面插件生态与移动支持矩阵不一致，必须标注 unsupported 而非硬兼容。
- WebView2 evergreen/runtime、企业代理、证书拦截导致的白屏和网络失败增多，需要采集 runtime 与系统策略。
- macOS notarization、hardened runtime、entitlements 与自动更新链路强耦合，未公证产物可能安装后或更新后才失败。
- Linux 发行版 WebKitGTK 版本差异影响 cookie、media、download、GPU 和 TLS，不能只以 Ubuntu CI 代表全部。
- CSP 与自定义协议、asset protocol、remote URL、OAuth/deep link 回调同时存在时，connect-src/default-src 容易漏项。
- sidecar 被签名、公证、杀软、chmod、target triple、bundle include 共同影响，需把开发运行和打包运行分开验证。
- Rust async 长任务和高频 event emit 容易造成 UI 卡顿，必须设计取消、节流和窗口关闭清理。
- 多窗口、tray、single-instance、deep link 组合会出现重复监听、隐藏窗口误判、焦点丢失和参数重复消费。
- 移动端前后台、权限拒绝、网络切换、系统回收和商店审核会形成桌面没有的发布风险。
- 远程网页封装的高危组合是 remote.urls、withGlobalTauri、csp:null、shell:allow-execute、devtools 与本地权限同窗出现。
- updater 必须明确 desktop only；latest.json、signature、relaunch、process plugin 需要同一次发布链路验证。
- WebView 排障新增关注 WKScriptMessageHandler、proxy、data_directory、additional_browser_args、Android System WebView、webkit2gtk-4.1。
- 供应链与权限发布门禁要包含 cargo-vet、cargo-audit、pnpm audit 和权限最小化结果。

## 与相邻技能的边界

- Rust 开发/rust-development（rs）：负责 Rust 语言、所有权、trait、async、错误类型和性能细节；Tauri 桌面应用/tauri-development（taur） 负责这些 Rust 代码如何暴露为 command/plugin/state、如何被窗口和 IPC 调用。
- JavaScript/TypeScript 开发/javascript-typescript-development（jsts）：负责前端框架、TypeScript、构建器、路由和状态；Tauri 桌面应用/tauri-development（taur） 负责前端与 Tauri invoke/event/plugin API、CSP、WebView 容器和打包 dist 的边界。
- Apple 全链路开发与发布/apple-development（appl）：负责原生 Apple 平台、证书、Info.plist、entitlements、notarization 深水区；Tauri 桌面应用/tauri-development（taur） 负责 Tauri bundle/updater/窗口/WebView 与这些 Apple 约束的交叉证据。
- Android 开发/android-development（andr）：负责 Android 原生工程、Gradle、Manifest、系统权限和发布细节；Tauri 桌面应用/tauri-development（taur） 负责 Tauri v2 Android 容器、插件能力、WebView 与移动端验证矩阵。
- Web 安全/web-security（wsec）：负责通用 Web 安全、XSS、CSP、供应链和鉴权；Tauri 桌面应用/tauri-development（taur） 负责 Web 安全策略与本地高权限 IPC、remote URL 窗口、shell/fs/updater 的桌面边界。
- 发布部署/release-engineering（rls）：负责 CI/CD、版本、制品、发布流程和回滚；Tauri 桌面应用/tauri-development（taur） 负责 Tauri 特有打包、签名、公证、WebView/runtime、updater 和安装验证。
- API 工程/api-engineering（api）：只在改后端 API、鉴权、响应契约时介入；Tauri 本地 command 不是 HTTP API，但若对外暴露服务或远程接口需联动。
- 数据库工程/database-engineering（db）：只在改本地 SQLite、插件 SQL、迁移、缓存长期存储时介入；单纯窗口/权限/打包不转交。

## 输出要求

- 必报：Tauri v1/v2、目标平台、窗口 label、权限/capability 文件、command/invoke 链、CSP/remote URL、风险等级、构建或运行证据、未验证平台。
- 修复类输出：改动清单、影响面、验证命令及结果、失败模式覆盖、回滚/降级方案。
- 发布类输出：产物、签名/公证/updater 证据、latest.json/signature/relaunch/process plugin、cargo-vet/cargo-audit/pnpm audit、安装启动验证、平台依赖、已知限制。
- 安全类输出：最小权限理由、拒绝路径、远程内容隔离、参数校验、敏感能力清单、remote.urls/withGlobalTauri/csp:null/shell:allow-execute/devtools 红旗结论。
- 移动端输出：设备/模拟器、系统版本、权限授权与拒绝结果、plugin platform matrix、前后台/弱网/重装验证。
- 不得把“前端浏览器可用”“Rust 编译通过”“CI 绿色”“桌面通过”单独报为 Tauri 或移动端通过。

## 约束

- 不凭记忆套 Tauri API；版本、插件、权限 identifier、配置字段不确定必须查项目或官方证据。
- 不扩大权限救火；新增 shell/fs/http/sql/updater/deep-link 能力必须说明窗口、scope、参数和拒绝路径。
- 不把远程 URL 与本地高权限放在同一无隔离窗口；remote.urls、withGlobalTauri、csp:null、shell:allow-execute、生产 devtools 任一命中必须先列红旗和隔离方案。
- 不跳过目标平台验证；未覆盖 Windows/macOS/Linux/iOS/Android 任一目标必须显式标“未验证”。
- 不把打包、签名、公证、updater、WebView runtime 留到最后；涉及发布必须联动 发布部署/release-engineering（rls），并把 cargo-vet、cargo-audit、pnpm audit、权限最小化纳入发布阻断。
- 不用桌面验证替代移动端验证；iOS/Android 必须分别覆盖权限、沙盒、生命周期、真机或明确未验证。
- 不修改相邻领域深层职责：Rust 语言重构归 Rust 开发/rust-development（rs），前端架构归 JavaScript/TypeScript 开发/javascript-typescript-development（jsts），Apple 原生签名细节归 Apple 全链路开发与发布/apple-development（appl），Android 原生深水区归 Android 开发/android-development（andr），通用安全归 Web 安全/web-security（wsec）。

## 提交前自检清单

- [ ] 已确认 Tauri v1/v2、tauri/cli/plugin/Rust/Node 版本。
- [ ] 已核 capabilities/permissions/allowlist 与窗口 label 匹配。
- [ ] 已搜 command、invoke、generate_handler、State、事件监听和前端类型引用。
- [ ] 已验证 CSP、remote URL、自定义协议、asset、WebSocket/API/updater 需要的源，并检查 remote.urls、withGlobalTauri、csp:null、shell:allow-execute、devtools 红旗。
- [ ] 已按目标平台核 WebView2/WKWebView/WebKitGTK、WKScriptMessageHandler、proxy、data_directory、additional_browser_args、Android System WebView、webkit2gtk-4.1、系统依赖和权限声明。
- [ ] 已确认无前端任意 invoke 危险命令、无 capability 过宽、无 shell open 任意 URL、无路径穿越、无 debug 权限进 release、无只测 dev server 冒充发布验证。
- [ ] 涉 sidecar/shell 已验证打包内路径、签名/权限、参数白名单和退出码。
- [ ] 涉 updater 已验证 desktop only、公钥、latest.json、signature、版本递增、URL、CSP、relaunch、process plugin、回滚策略。
- [ ] 涉 macOS 发布已验证 hardened runtime、entitlements、notarization、staple、首次启动。
- [ ] 涉 iOS/Android 已验证权限声明、沙盒路径、plugin platform matrix、前后台、弱网、清数据重装。
- [ ] 涉 tray/deep link/多窗口已验证冷/热启动、单实例、focus、hide/close、重复监听。
- [ ] 涉 Rust async 已验证锁不跨 await、阻塞任务不占 IPC、事件有节流和清理。
- [ ] 已列风险等级、影响面、验证命令/日志/产物证据，未跑平台已标缺口；发布前已核 cargo-vet、cargo-audit、pnpm audit 与权限最小化。
- [ ] 已按需要联动 Rust 开发/rust-development（rs）、JavaScript/TypeScript 开发/javascript-typescript-development（jsts）、Apple 全链路开发与发布/apple-development（appl）、Android 开发/android-development（andr）、Web 安全/web-security（wsec）、发布部署/release-engineering（rls）、测试验证/test-engineering（tst）、代码审计/code-audit（aud）。