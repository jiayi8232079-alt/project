---
name: electron-development
description: Electron 开发实战排障增强版 - 聚焦 main/preload/renderer 三进程边界、contextIsolation/sandbox 安全隔离、ipcMain/ipcRenderer 与 contextBridge 契约、asar 资源、electron-builder/electron-forge 打包、code signing/notarization、autoUpdater、系统权限、deep links、Chromium/Node ABI 与 native modules 兼容、Crashpad/GPU/窗口生命周期、Electron Fuses 与 Security 20 的桌面端真实失败模式。
---
# Electron 桌面应用

Electron 桌面应用（electron-development，兼容 slug: elct）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

定位：只处理 Electron 桌面应用的独特问题，把 Chromium、Node、Electron 三套运行时叠加后的进程、安全、打包、签名、自动更新、原生模块、系统权限、协议深链和系统集成风险收敛成可复现、可验证、可发布的闭环。纯 Web UI 交给 u / jsts；通用发布流水线交给 rls；漏洞通用方法交给 wsec；最终代码改动仍由 aud 收口。

## 快速总则：版本 / 进程 / 平台 / 证据

- 单技能工程门禁：只要任务进入 Electron 实现或修复，就必须先列 main/preload/renderer trust boundary、窗口与 session、IPC schema、文件/外链/protocol 权限、打包签名更新、目标平台差异、验收证据；缺任一项只能标“待补”，不能当完成。
- 开发闭环：需求必须落到入口清单、权限清单、失败态、日志、安装态验证和回滚点；不能只改 renderer UI 或只跑 dev server 就声称 Electron 功能可用。
- 低级错先拦：发现 renderer 直接 Node、IPC 任意命令、preload 暴露 fs/shell/path/child_process、debug 开关进生产、openExternal 无校验、protocol 任意读文件、autoUpdater 未签名或未验证旧版升级，先停止并修边界。
- 版本先行：每次定位先记录 Electron、Chromium、Node、V8、操作系统、CPU 架构、包管理器、electron-builder/electron-forge、autoUpdater 渠道；涉及 native modules 必须确认 Chromium/Node ABI、N-API、prebuild 与 rebuild 结果。
- 三进程分界：main 负责窗口、系统能力、文件、菜单、托盘、更新、签名相关入口；preload 只通过 contextBridge 暴露最小白名单；renderer 只做 UI 和业务交互，不直接接触 Node/Electron 原生对象。
- 安全默认：BrowserWindow 默认 contextIsolation:true、sandbox:true、nodeIntegration:false、webSecurity:true；任何关闭都必须给出窗口、URL、替代隔离、风险边界和回滚方案。
- 禁止默认放宽高危开关：allowRunningInsecureContent、experimentalFeatures、enableBlinkFeatures、allowpopups 只允许在已登记窗口、来源、业务理由、替代控制、验证证据和回滚方案后临时启用。
- IPC 是接口不是通道名：ipcMain/ipcRenderer 必须有调用方、handler、参数 schema、权限判断、senderFrame origin 校验、返回/错误契约、超时、日志、rate limit 和兼容策略；禁止把 ipcRenderer、shell、fs、path 原样桥接给 renderer。
- 平台拆开验证：macOS、Windows、Linux 的路径、权限、窗口关闭、托盘、通知、协议注册、code signing、notarization、autoUpdater、卸载残留必须分别取证。
- 系统权限矩阵先列清：macOS TCC、Windows 安装/企业策略、Linux portal/PipeWire/Wayland/X11、通知、屏幕共享、剪贴板、全局快捷键、开机启动、后台常驻都要按平台确认。
- 发布证据不足则不宣称完成：未跑安装包、未验证签名/公证/更新、未看 Crashpad 或应用日志、未覆盖 dev/prod 差异，只能报告“开发态通过”。

## 场景执行卡

### 1. 新建或重整 Electron 项目
- 输入：前端栈、目标平台、最低系统版本、窗口模型、是否离线、是否自动更新、是否含 native modules、企业签名/商店发布要求。
- 动作：拆 main/preload/renderer/shared；确定 BrowserWindow 安全基线、CSP、日志、单实例、崩溃采集、协议、资源路径、打包工具和更新渠道；先构建最小安装包而不是只跑 dev server。
- 证据：进程入口清单、webPreferences、preload API 列表、打包配置、首个安装包路径、安装后启动日志。
- 停止条件：无法确认目标平台、签名要求或更新渠道时，不继续承诺发布能力。

### 2. IPC / preload / contextBridge
- 输入：业务能力、调用页面、参数、返回值、权限来源、是否跨窗口/跨 session。
- 动作：优先 ipcMain.handle + invoke；handler 做 schema 校验、senderFrame origin 校验、窗口/会话权限校验、一次性授权、超时、取消、幂等、rate limit、错误归一；preload 暴露具名函数；renderer 调用只依赖稳定契约。
- 动作：为每个通道维护 IPC schema：通道名、方向、调用方、输入/输出类型、错误码、敏感级别、权限来源、频率上限、兼容版本和废弃策略。
- 证据：IPC 通道表、schema 文件或等价契约、preload 暴露面、renderer 调用点、异常样本、结构化克隆兼容清单、旧通道兼容或删除清单。
- 停止条件：未搜全 ipcMain.on/handle、ipcRenderer.send/invoke、contextBridge.exposeInMainWorld 调用方时，不改通道名和返回结构。

### 3. BrowserWindow / webContents / 多窗口
- 输入：窗口用途、父子关系、是否隐藏到托盘、多显示器、会话隔离、外链行为、权限弹窗。
- 动作：统一安全 webPreferences；show:false + ready-to-show；拦截 will-navigate、setWindowOpenHandler、permissionRequestHandler；外链走 shell.openExternal whitelist 且校验协议和域名；webContents 崩溃后记录并恢复。
- 动作：多窗口必须定义权限模型、session partition、cookie 隔离、父子窗口关系和释放策略；远程登录/支付/帮助页不得污染主应用 session。
- 证据：窗口配置、生命周期日志、导航拦截日志、session/partition 清单、shell.openExternal whitelist、macOS close/hide/quit 与 Windows/Linux 托盘行为截图或日志。
- 停止条件：窗口引用未释放、session 混用、外链未限制或 allowpopups 未登记时，不增加新窗口能力。

### 4. 远程内容 / CSP / webview / BrowserView
- 输入：远程域名、登录/支付/帮助页、是否需要本地能力、第三方脚本、iframe/webview 需求。
- 动作：优先默认浏览器打开不可信页面；必须内嵌时隔离 session、禁用 Node、限制 preload、设置 CSP、拦截跳转和下载；webview 需要额外审批边界。
- 动作：CSP 生产态优先 nonce/hash 和明确白名单；区分 dev sourcemap/热更新需要与安装态策略；跟踪 Chromium 第三方 Cookie、证书、混合内容、OAuth 内嵌限制变化。
- 动作：远程内容不得启用 allowRunningInsecureContent；experimentalFeatures/enableBlinkFeatures 需逐项说明 Chromium 行为、业务依赖、可替代方案和回滚。
- 证据：允许域名、CSP、webSecurity 状态、跳转/弹窗/下载拦截日志、第三方页面失败兜底。
- 停止条件：远程内容需要本地能力但无法证明可信来源时，不桥接任何敏感 API。

### 5. 文件、路径、存储、权限
- 输入：读写目录、文件类型、用户选择还是后台写入、隐私数据、迁移要求。
- 动作：使用 app.getPath、dialog、safeStorage 或系统 keychain；区分 asar 内资源与 userData；路径做规范化和越权校验；大文件走流式与取消。
- 动作：列平台权限矩阵：macOS TCC 相机/麦克风/屏幕录制/辅助功能/文件夹访问；Windows 安装目录、AppContainer/企业策略/杀软；Linux portal/PipeWire/Wayland/X11、文件选择、截图、托盘、通知。
- 证据：路径矩阵、权限提示、entitlements/声明、失败日志、升级前后数据迁移结果、卸载/重装行为。
- 停止条件：把可写数据放进 app.asar 或安装目录时，必须先改设计；系统权限未声明或无用户引导时，不宣称功能可用。

### 6. 打包 / asar / 资源 / native modules
- 输入：目标平台、架构、资源类型、是否含 sqlite/usb/serialport/sharp 等 native modules、是否需要 unpack。
- 动作：核 electron-builder/electron-forge 配置；区分 files、extraResources、asarUnpack；执行 electron-rebuild 或等价流程；验证 arm64/x64；检查 require.resolve 和运行时路径。
- 动作：建立 files/asarUnpack native .node 白名单，只 unpack 必需的 .node、外部二进制或运行态不可压缩资源；禁止用宽泛 glob 把源码、测试、凭据或无关资源带入发布包。
- 动作：验证 asar integrity 或平台等价完整性；asar 内资源只读，运行态写入必须落 userData、cache、temp 或用户选择目录。
- 证据：产物目录、asar 列表、asar integrity 结果、unpack 列表、native .node 白名单、native modules 加载日志、安装后真实路径。
- 停止条件：只在源码目录能加载资源或 .node 文件时，不认定打包修复完成。

### 7. code signing / notarization / autoUpdater
- 输入：证书类型、Team ID、bundleId/appId、更新服务、渠道、差分包、企业代理、是否商店分发。
- 动作：macOS 做 code signing、hardened runtime、entitlements、notarization 和 stapler 验证；Windows 做签名、SmartScreen 风险说明；autoUpdater 校验签名、feed URL、渠道、版本递增、回滚策略。
- 动作：覆盖证书轮换、更新服务迁移、staged rollout、差分包损坏、代理/离线/缓存、断点失败、更新中断恢复、降级阻断和紧急止血策略。
- 证据：codesign/spctl/stapler 或平台等价结果、更新日志、旧版升级新版、失败恢复记录、签名失败时的错误码。
- 停止条件：未验证已安装旧版本升级路径时，不宣称自动更新可用；证书或 appId/bundleId 变化未评估旧版识别时，不发布。

### 8. Crashpad / 日志 / 性能 / GPU
- 输入：崩溃栈、卡顿场景、设备 GPU、窗口数量、内存曲线、是否后台常驻。
- 动作：区分 main 崩溃、renderer crashed、GPU process crash、OOM、native crash；接入 crashReporter 或 Crashpad；定位 preload 同步阻塞、IPC 洪泛、无界 webContents、devtools 残留。
- 动作：建立指标基线：冷启动、白屏时间、主进程 CPU、renderer 内存、窗口数量、IPC 调用频率、GPU fallback、后台常驻电量/CPU；异常先保留设备与版本矩阵。
- 证据：crash dump、主进程日志、renderer 控制台、任务管理器/Activity Monitor、复现脚本或操作步骤、性能采样结果。
- 停止条件：只有用户描述“卡/闪退”但无日志和复现路径时，先补证据。

### 9. 测试 / CI / 回归
- 输入：变更进程、目标平台、关键路径、安装包类型、是否影响更新或签名。
- 动作：单测覆盖纯逻辑；Playwright Electron 或等价方案覆盖窗口与 renderer；安装包冒烟覆盖首次启动、重启、更新、卸载、离线；CI 分平台保存 artifact 和日志。
- 动作：三平台 CI 必须拆 macOS、Windows、Linux job，分别保存安装包、asar 列表、asarUnpack 列表、签名/公证或说明、首次启动日志、Crashpad 路径和安装态冒烟证据。
- 动作：补 mock autoUpdater、崩溃注入、native module matrix、签名/公证命令证据、旧版升级和新版回滚；影响系统权限时增加真实 OS 权限授权/拒绝路径。
- 证据：测试命令、三平台 CI 矩阵、artifact、失败截图、安装后日志、Crashpad dump、签名/公证结果、日志路径。
- 停止条件：影响打包/签名/更新但只跑 yarn test 或 npm test，不足以收口。

### 10. 协议处理 / Deep Links / 单实例
- 输入：协议名、URL schema、来源、参数、是否打开文件/执行动作、旧 appId/bundleId 或协议迁移要求。
- 动作：用 app.setAsDefaultProtocolClient 或平台等价注册；处理 macOS open-url、Windows/Linux second-instance；单实例转发到既有窗口；URL 解码、schema 校验、危险 scheme 拦截、防命令注入。
- 证据：协议注册状态、启动参数样本、参数校验失败样本、单实例转发日志、升级/卸载后残留验证、旧版兼容策略。
- 停止条件：deep link 参数可触发文件打开、命令执行、导航或 IPC 但无 schema/权限校验时，不上线。

### 11. Custom protocol / Deep Links / 内容加载
- 输入：custom protocol 名称、权限选项、是否标准协议、是否支持 fetch/CORS、资源根目录、deep link 与内容协议是否复用。
- 动作：custom protocol 只映射受控只读资源根；协议名固定后评估升级兼容；URL path 规范化并限制根目录；禁止把外部输入直接映射到任意文件、网络转发或敏感 IPC。
- 动作：app:// 等内容协议与 deep link action 协议分离；需要 secure/standard/supportFetchAPI/corsEnabled 时说明原因、来源边界、CSP 与测试样本。
- 证据：protocol 注册代码、URL schema、允许资源根、拒绝样本、CSP、安装态 file/app 协议加载结果。
- 停止条件：custom protocol 可访问用户可控路径、远程 URL 或敏感动作但无 schema/权限校验时，不上线。

### 12. Electron 安全强化 / Fuses / Session
- 输入：目标 Electron 版本、是否需要调试能力、是否有远程内容、是否多 session、是否商店分发。
- 动作：评估 Electron Fuses，关闭发布包不需要的调试或 Node 相关能力；最小化 session 权限、缓存、cookie、下载与权限持久化；审查 remote 迁移到 IPC + contextBridge。
- 动作：发布包 Fuses 至少检查 RunAsNode、EnableNodeOptionsEnvironmentVariable、EnableNodeCliInspectArguments、OnlyLoadAppFromAsar、EnableEmbeddedAsarIntegrityValidation、EnableCookieEncryption；例外必须记录业务理由和替代控制。
- 动作：维护 sandbox ledger，逐窗口登记 sandbox/contextIsolation/nodeIntegration/webSecurity/preload、加载 URL、session partition、权限、例外、owner、过期时间和验证证据。
- 证据：Fuses 配置与验证结果、sandbox ledger、发布包验证结果、session partition 清单、权限持久化策略、remote 依赖清除或隔离说明。
- 停止条件：发布包仍保留无业务必要的调试/Node 扩展面、远程内容共享主 session 或 sandbox ledger 缺失时，先降风险。

## Security 20：Electron 安全基线

1. 仅从官方或可信镜像获取 Electron，锁定版本、校验 lockfile 与供应链告警。
2. 及时跟进 Electron/Chromium/Node 安全更新；升级前读 breaking changes，升级后做安装态回归。
3. 禁用 nodeIntegration，保留 contextIsolation:true 和 sandbox:true；例外写入 sandbox ledger。
4. 启用 webSecurity，不启用 allowRunningInsecureContent；混合内容只允许在隔离测试窗口临时验证。
5. 不启用 experimentalFeatures 和 enableBlinkFeatures，确需启用时逐项登记 Chromium feature、风险与回滚。
6. 对所有远程内容设置严格 CSP，生产态使用 nonce/hash 或明确白名单，禁止把 dev 策略带入发布包。
7. 远程内容默认外部浏览器打开；必须内嵌时隔离 session、权限、下载、弹窗与 preload。
8. setWindowOpenHandler 默认 deny；allowpopups 仅限白名单窗口和白名单来源。
9. shell.openExternal whitelist 必须限制 protocol、host、path 规则，并记录拒绝样本。
10. 拦截 will-navigate、new-window 等导航入口，阻止未登记来源进入应用上下文。
11. IPC schema 覆盖输入、输出、错误、权限、版本；main 侧校验 senderFrame origin、窗口身份和 session。
12. IPC 加入 rate limit、超时、取消、幂等和审计日志，避免 renderer 洪泛阻塞 main。
13. preload 只暴露具名最小 API，不透传 ipcRenderer、remote、fs、path、shell 或任意原生对象。
14. custom protocol 只服务受控资源；URL schema、路径规范化、CSP 和拒绝样本必须齐全。
15. Deep link 是外部输入：校验 protocol、host、path、query、编码和动作权限。
16. Fuses 发布态最小化：RunAsNode、NodeOptions、NodeCliInspect、OnlyLoadAppFromAsar、EmbeddedAsarIntegrity、CookieEncryption 必须检查并留证。
17. asar integrity 必须验证；files/asarUnpack native .node 白名单只包含必需运行态资源。
18. 使用 safeStorage 或系统 keychain 保护敏感本地数据；CookieEncryption 开启状态需验证。
19. 三平台 CI 覆盖 macOS、Windows、Linux 的安装包、签名/公证或等价说明、首次启动、卸载/重装和日志 artifact。
20. 安全例外必须有 owner、过期时间、风险、替代控制、验证证据和回滚步骤；过期例外不得发布。

## 硬禁止与低级错拦截

- 禁止 renderer 直接调用 Node/Electron/system API；发现 import/require fs、path、shell、child_process、ipcRenderer、remote 时，必须改为 preload 白名单加 main 侧校验。
- 禁止 IPC 设计成任意命令、任意文件路径、任意 URL、任意 SQL、任意 shell 参数的转发器；每个 channel 必须有 schema、allowlist、权限来源、origin/session/window 校验和拒绝样本。
- 禁止 preload 暴露通用对象或动态函数名；window.api 只能暴露稳定具名方法，返回值必须可结构化克隆，错误必须归一成可兼容契约。
- 禁止 shell.openExternal、setWindowOpenHandler、will-navigate、download、custom protocol、deep link 只做字符串拼接或正则粗判；必须校验 protocol、host、path、编码、动作权限和默认拒绝。
- 禁止把 debug、devtools、inspect、NODE_OPTIONS、RunAsNode、宽 CSP、unsafe-eval、source map、测试菜单、测试证书带入生产包；发布包必须有对应扫描或人工证据。
- 禁止把 secret、token、license、更新私钥、证书密码、用户路径、崩溃 dump 中的隐私写进 renderer console、main 日志、更新日志或上传 payload；日志必须分级和脱敏。
- 禁止只验证 macOS 或只验证当前开发机；影响窗口、权限、协议、更新、签名、托盘、文件路径时，必须标明 Windows/macOS/Linux 已验、未验和不可验原因。
- 禁止用“配置看起来正确”替代安装态证据；签名、公证、autoUpdater、protocol handler、asar/native modules、权限弹窗必须读真实产物、真实日志或真实命令结果。

## 高频坑 / 防遗漏

- dev server 可用不代表 file:// 或 app:// 打包后可用，必须验证生产协议、base path、CSP 和资源路径。
- preload 在 sandbox:true 下可用能力受限，不能按旧版 Node 全能力假设写桥接。
- contextIsolation:false 修 bug 是高风险绕过，优先修 contextBridge 契约与序列化数据。
- asar 内不能写入；需要执行、动态加载或 .node 的内容必须 unpack 或放 extraResources。
- native modules 不是 npm install 成功就可用，Electron 运行时 ABI 与系统架构必须匹配。
- allowRunningInsecureContent、experimentalFeatures、enableBlinkFeatures、allowpopups 是发布前必须解释的高风险例外。
- shell.openExternal 不等于安全外链，必须有 whitelist、拒绝日志和默认拒绝策略。
- custom protocol 与 deep link 不应复用同一语义；内容加载和外部动作入口要分离。
- Fuses 配置缺失会保留不必要生产攻击面；RunAsNode/NodeOptions/NodeCliInspect/OnlyLoadAppFromAsar/EmbeddedAsarIntegrity/CookieEncryption 要逐项验。
- files/asarUnpack 使用宽泛 glob 会把源码、测试、凭据或无关资源打进包；native .node 必须白名单。
- autoUpdater 在未签名、版本未递增、feed URL 错误、渠道不一致时会静默或半失败。
- autoUpdater 还会被证书轮换、差分包损坏、代理/离线、缓存、灰度策略和服务迁移影响，必须验证失败恢复。
- macOS notarization 通过不等于可运行，还要验证 stapler、Gatekeeper、entitlements、TCC 权限和首次打开。
- Windows 路径、杀毒、SmartScreen、安装目录权限、企业策略会放大开发机不可见问题。
- Linux AppImage/deb/rpm、Flatpak/Snap 的 sandbox、桌面文件、协议注册、依赖库、portal/PipeWire 要按发行版验证。
- IPC 返回 Error、Buffer、Date、Map、class 实例时可能被结构化克隆改变，契约要写明序列化形态。
- deep link 是外部输入入口，必须校验协议、host、path、query、编码和动作权限。
- 多窗口复用 session 会导致 cookie、权限和远程内容互相污染。
- Electron Fuses、remote 迁移、Chromium third-party cookie/OAuth 策略变化要纳入升级检查。

## 输出要求

- 必报：Electron/Chromium/Node 版本、目标平台与架构、变更涉及 main/preload/renderer 哪些入口、打包工具、是否影响签名/更新/native modules/系统权限/deep links。
- 必报证据：读过的关键文件或配置、全量引用搜索范围、执行命令与结果、安装包/签名/更新/Crashpad/日志/系统权限证据；未跑则标“未验证”。
- 涉 IPC 输出：通道名、调用方、handler、IPC schema、参数校验、senderFrame origin、权限来源、错误契约、rate limit、兼容策略。
- 涉发布输出：产物、签名、公证、更新、安装后启动、旧版升级、新版回滚或止血方案。
- 涉安全输出：BrowserWindow webPreferences、CSP、外链/导航拦截、shell.openExternal whitelist、远程内容边界、暴露给 renderer 的 API 面、Fuses/session 策略、sandbox ledger。
- 涉协议输出：协议名、注册方式、open-url/second-instance 处理、custom protocol URL schema、危险参数拒绝样本、卸载残留。
- 涉打包输出：files、asarUnpack、native .node 白名单、asar integrity、安装态真实路径和三平台 CI artifact。

## 约束

- 禁止为图省事开启 nodeIntegration、关闭 contextIsolation/sandbox/webSecurity 后不说明风险和替代控制。
- 禁止启用 allowRunningInsecureContent、experimentalFeatures、enableBlinkFeatures、allowpopups 后不登记风险、owner、过期时间和回滚。
- 禁止把 ipcRenderer、remote、fs、child_process、shell、path 等原生能力整体暴露给 renderer。
- 禁止 shell.openExternal 无 whitelist，禁止 custom protocol 无 schema 与资源根限制。
- 禁止未搜全调用方就改 IPC 通道、preload API、窗口生命周期、资源路径、更新 URL、协议名、appId 或 bundleId。
- 禁止把通用 Web 构建通过当作 Electron 发布完成；必须验证安装包运行态。
- 禁止在签名、公证、自动更新、native modules、asar 路径、系统权限、deep links、Fuses 问题上凭配置猜结论。
- 禁止把 Electron 专属问题推给 jsts、rls 或 wsec 后停止；本技能必须先给桌面端证据清单和边界。

## 高频 Bug 反例库

- 反例 1：错法 / renderer 直接 import fs 读取本地文件；对法 / main 通过 ipcMain.handle 暴露受控读文件能力，preload 用 contextBridge 暴露具名函数；根因 / 混淆 renderer 与 main 权限边界，破坏 contextIsolation。
- 反例 2：错法 / 为让旧代码跑通设置 nodeIntegration:true、contextIsolation:false；对法 / 改 preload 桥接和序列化契约，保留 sandbox 与隔离；根因 / 用全局降级掩盖 IPC 设计缺陷。
- 反例 3：错法 / 把 ipcRenderer 原样挂到 window.api；对法 / 只暴露白名单方法并在 main 侧校验参数和权限；根因 / 把 IPC 当内部总线，导致 renderer 可调用任意敏感通道。
- 反例 4：错法 / dev server 下资源路径可用就合并；对法 / 打包后验证 file:// 或自定义 app://、asar、extraResources 路径；根因 / 忽略开发态与安装态协议和目录差异。
- 反例 5：错法 / 将数据库或配置写入 app.asar 或安装目录；对法 / 写入 app.getPath('userData') 并做迁移和权限处理；根因 / 不理解 asar 只读和系统安装目录权限。
- 反例 6：错法 / native modules 安装成功就认为可发布；对法 / 按 Electron ABI、arm64/x64、目标系统执行 rebuild/prebuild 验证；根因 / 混淆 Node ABI 与 Chromium/Node ABI。
- 反例 7：错法 / macOS 只完成 code signing 就发布；对法 / 同时验证 hardened runtime、entitlements、notarization、stapler、Gatekeeper 首次打开；根因 / 把签名、公证、门禁当同一件事。
- 反例 8：错法 / autoUpdater 在开发机触发一次检查就算完成；对法 / 用已签名旧版安装包验证 feed、渠道、版本递增、下载、安装、重启；根因 / 自动更新依赖签名、渠道和安装态，开发态不等价。
- 反例 9：错法 / webContents.setWindowOpenHandler 直接 allow；对法 / 校验协议和域名，外部链接走 shell.openExternal whitelist，内部白名单窗口隔离 session；根因 / 忽略远程导航可获得桌面上下文入口。
- 反例 10：错法 / preload 里做大文件同步读取或重计算；对法 / main 流式处理、可取消、进度回传，renderer 只展示状态；根因 / preload 阻塞会放大启动慢和白屏。
- 反例 11：错法 / 崩溃只看 renderer 控制台；对法 / 分别采集 main 日志、renderer crashed、GPU crash、Crashpad dump、native crash 栈；根因 / Electron 崩溃来源跨多个进程。
- 反例 12：错法 / 只在 macOS 验证窗口关闭和托盘；对法 / 分平台验证 macOS close/hide/quit、Windows/Linux tray、single instance、后台常驻；根因 / 桌面生命周期语义不是 Web 生命周期。
- 反例 13：错法 / 修改 appId 或 publish URL 后不兼容旧版；对法 / 评估自动更新识别、安装目录、协议注册、用户数据路径和回滚；根因 / 发布身份字段参与更新和系统注册。
- 反例 14：错法 / CSP 报错就加 unsafe-eval 或放开所有源；对法 / 区分 bundler dev sourcemap、生产 CSP、远程域名白名单和 preload 能力；根因 / 用 Web 宽松策略破坏桌面壳安全边界。
- 反例 15：错法 / deep link 参数直接拼路径或命令；对法 / URL schema 校验、路径规范化、动作白名单和权限确认；根因 / 把外部协议入口当可信内部调用。
- 反例 16：错法 / macOS 屏幕录制或辅助功能只在开发机验证；对法 / 声明 entitlements、设计授权/拒绝引导、在干净用户环境复测；根因 / 忽略 TCC 与首次授权状态。
- 反例 17：错法 / 证书轮换后只验证新版自更新；对法 / 用旧证书签名的已安装旧版升级到新证书新版；根因 / autoUpdater 信任链跨版本。
- 反例 18：错法 / 多窗口共用默认 session 加载远程登录页；对法 / 为远程页使用隔离 partition 并限制权限和下载；根因 / session 污染主应用 cookie 与权限。
- 反例 19：错法 / renderer 循环 invoke 无限制；对法 / main 侧增加 rate limit、取消、幂等和队列背压；根因 / IPC 洪泛会阻塞主进程。
- 反例 20：错法 / Wayland 下仍按 X11 验证托盘、截图、屏幕共享；对法 / 分别验证 Wayland/X11、portal/PipeWire 与发行版差异；根因 / Linux 桌面能力依赖会话与发行版。
- 反例 21：错法 / 发布包未配置 Electron Fuses，保留调试或 Node 扩展面；对法 / 按业务关闭不必要 Fuse 并验证发布包；根因 / 默认能力面大于生产需要。
- 反例 22：错法 / asarUnpack 使用 **/*；对法 / files/asarUnpack native .node 白名单并审计产物；根因 / 打包边界过宽导致敏感或无关文件进入发布包。
- 反例 23：错法 / 只测本机打包；对法 / 三平台 CI 分别保存 artifact、安装态日志和冒烟证据；根因 / Electron 桌面行为强依赖 OS、签名和发行格式。
- 反例 24：错法 / IPC 暴露 runCommand(command,args) 给 renderer；对法 / 每个能力单独 channel、参数 enum allowlist、main 侧权限和审计；根因 / 把桌面系统能力做成任意命令代理。
- 反例 25：错法 / preload 暴露 fs.readFile 和 shell.openExternal 方便前端复用；对法 / 暴露 readUserSelectedFile、openTrustedExternalLink 等业务语义 API；根因 / 暴露原语会绕过权限模型和输入校验。
- 反例 26：错法 / protocol handler 把 app:// 路径直接映射到用户传入路径；对法 / 固定资源根、normalize 后校验仍在根内、拒绝 ../ 和编码绕过；根因 / custom protocol 是本地文件攻击面。
- 反例 27：错法 / deep link query 直接触发打开文件、导航或 IPC 动作；对法 / URL schema、动作白名单、用户确认和权限复核；根因 / deep link 来源不可控。
- 反例 28：错法 / 生产包保留 devtools、inspect、测试菜单和宽 CSP；对法 / 发布前扫描环境变量、Fuses、菜单、CSP、source map 和日志级别；根因 / dev 便利项泄漏到生产攻击面。
- 反例 29：错法 / autoUpdater 只验证 latest.yml 可访问；对法 / 用已安装旧版验证签名链、版本递增、下载、安装、重启、失败恢复和回滚；根因 / 更新成功依赖安装态和信任链。
- 反例 30：错法 / shell.openExternal 允许任意 URL；对法 / 只允许 https 且 host/path 白名单，拒绝 file/javascript/data/custom scheme；根因 / 外链入口可变成本地能力跳板。
- 反例 31：错法 / 日志上传 renderer console 和 crash dump 原文；对法 / token、路径、邮箱、license、cookie、更新 URL 参数脱敏后再落盘/上传；根因 / 桌面日志常带本地隐私和凭据。
- 反例 32：错法 / Windows/macOS 验过就认为 Linux 正常；对法 / 单列 AppImage/deb/rpm/Flatpak/Snap、Wayland/X11、portal/PipeWire、桌面文件和协议注册证据；根因 / Linux 分发形态决定权限和集成行为。

## 提交前自检清单

- 是否列出 Electron/Chromium/Node、OS、架构、打包工具和变更涉及的 main/preload/renderer 入口。
- 是否搜全 ipcMain/ipcRenderer/contextBridge/BrowserWindow/webContents/autoUpdater/native modules/asar/protocol/session/Fuses 相关调用方。
- 是否保持 contextIsolation:true、sandbox:true、nodeIntegration:false，并说明任何例外。
- 是否拒绝或登记 allowRunningInsecureContent、experimentalFeatures、enableBlinkFeatures、allowpopups。
- 是否验证 shell.openExternal whitelist、导航拦截、custom protocol schema、deep link 参数校验和拒绝样本。
- 是否维护 IPC schema、senderFrame origin 校验、权限来源、rate limit、错误契约和兼容策略。
- 是否维护 sandbox ledger，列出每个窗口的 webPreferences、URL、session、权限和例外。
- 是否验证 dev 与打包安装态差异，包括资源路径、CSP、协议、asar integrity、asarUnpack 和用户数据目录。
- 是否按平台验证 code signing、notarization、autoUpdater、托盘、通知、权限和卸载/重装。
- 是否覆盖 macOS TCC、Windows 企业策略/安装权限、Linux portal/PipeWire/Wayland/X11 的关键系统能力。
- 是否验证 deep links 注册、单实例转发、参数校验、危险输入拒绝、升级和卸载残留。
- 是否覆盖 autoUpdater 签名、渠道、旧版升级、证书轮换、灰度、失败恢复与回滚。
- 是否保存安装包、日志、Crashpad、签名/公证、更新和回归测试证据。
- 是否明确哪些由 jsts、wsec、rls、u、tst、aud 继续处理。

## 2024-2026 新坑速查

- Electron 新版本持续收紧默认安全与 Chromium 行为，升级前必须查 Electron release notes 中 BrowserWindow、sandbox、permission、protocol、webContents breaking changes。
- Node 20/22、V8 与 Electron ABI 变化会影响 sqlite、sharp、serialport、usb、keytar 等 native modules，arm64/x64 要分别验证。
- macOS notarization、hardened runtime、entitlements、quarantine、Gatekeeper、TCC 对下载来源和首次授权更敏感，CI 签名成功不等于用户首次打开成功。
- Windows 11、SmartScreen、企业杀软、代码签名信誉、安装权限会导致安装或 autoUpdater 失败，必须保留安装日志和签名链证据。
- Wayland、X11、PipeWire、portal、sandbox 在 Linux 桌面分发中表现不同，截图、屏幕共享、文件选择和托盘要按发行版验证。
- Vite/webpack 生产 base、dynamic import、CSP hash/nonce、source map 与 file:// 或自定义协议组合容易造成白屏。
- Electron remote 已不应作为新实现依赖；旧项目迁移要落到 ipcMain/ipcRenderer + contextBridge 的最小 API。
- ASAR 与 ESM/CJS、动态 require、worker、wasm、.node、外部二进制组合时，必须验证真实安装路径而不是源码路径。
- 自动更新服务迁移、渠道拆分、差分包缓存、证书轮换、灰度发布会造成“能下载不能安装”或“旧版永远收不到新版”。
- Chromium 权限、第三方 Cookie、跨域、证书、混合内容策略变化会影响内嵌登录、支付、OAuth 和企业代理环境。
- Electron Fuses、商店沙箱、Flatpak/Snap、Mac App Store、Microsoft Store 的签名、权限和更新机制与普通安装包不同，必须另列边界。

## 与相邻技能的边界

- JavaScript/TypeScript 开发/javascript-typescript-development（jsts）：负责 TypeScript、bundler、React/Vue、ESM/CJS、Web 运行时逻辑；Electron 桌面应用/electron-development（elct） 负责这些代码进入 Electron 后的 main/preload/renderer 分层、CSP、协议、安装态路径和桌面权限。
- Web 安全/web-security（wsec）：负责通用 Web 漏洞、认证授权、XSS/CSRF/SSRF 方法论；Electron 桌面应用/electron-development（elct） 负责 BrowserWindow webPreferences、contextIsolation、sandbox、preload 暴露面、IPC 权限、远程内容获得桌面能力的特殊风险。
- 发布部署/release-engineering（rls）：负责通用 CI/CD、artifact、灰度、回滚和发布门禁；Electron 桌面应用/electron-development（elct） 负责 electron-builder/electron-forge、asar、code signing、notarization、autoUpdater、安装包、三平台 CI 和桌面分发证据。
- UI 设计实现/ui-design（u）：负责视觉、布局、组件、动效、可访问性表达；Electron 桌面应用/electron-development（elct） 只处理窗口壳、系统菜单、托盘、通知、多窗口生命周期、DPI/多显示器造成的桌面显示问题。
- 测试验证/test-engineering（tst）：负责测试矩阵、回归策略、CI 证据格式；Electron 桌面应用/electron-development（elct） 提供 Electron 专属测试入口：安装包冒烟、旧版升级、签名/公证、Crashpad、IPC、preload、窗口生命周期。
- 代码审计/code-audit（aud）：负责所有代码改动后的最终审计；Electron 桌面应用/electron-development（elct） 在提交前必须把 Electron 专属证据、影响面和未验证项交给 代码审计/code-audit（aud） 收口。