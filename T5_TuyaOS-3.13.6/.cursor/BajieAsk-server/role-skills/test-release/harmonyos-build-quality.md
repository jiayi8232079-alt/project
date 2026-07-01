---
name: harmonyos-build-quality
description: HarmonyOS/OpenHarmony 构建与质量技能，覆盖 DevEco/Hvigor 构建、HAP/APP 产物、签名配置、ohpm 依赖、废弃 API 清理、SDK/API 升级和发布前质量验收。
---

# HarmonyOS Build Quality

## 定位

HarmonyOS Build Quality 负责把 HarmonyOS / OpenHarmony 项目从“代码看起来能写”收敛到“ArkTS/ETS 诊断、依赖、构建、签名、产物和废弃 API 迁移都有证据”。

核心对象：

- ArkTS / ETS 源码：`.ets`、`.arkts`、`.ts`、声明文件、页面、Ability、组件、服务、工具模块。
- 项目配置：`build-profile.json5`、模块级 `build-profile.json5`、`module.json5`、`oh-package.json5`、`hvigorfile.ts`、`hvigorw`、`hvigorw.bat`、`code-linter.json5`。
- 构建链路：DevEco Studio、Hvigor wrapper、`ohpm install`、HAP、APP、debug/release、product、module、target。
- 质量信号：ArkTS/ETS 编译错误、类型错误、导入错误、资源错误、未使用符号、异常处理建议、废弃 API 诊断、SDK 版本兼容。
- 发布前证据：签名配置、证书/profile 路径存在性、signed/unsigned 产物、checksum、构建日志、未验证项。

铁律：

1. 先识别项目根和真实构建入口，再运行命令；不要在子模块目录里误把局部配置当完整项目。
2. 未读 `build-profile.json5`、`module.json5`、`oh-package.json5` 和构建日志，不判断构建、签名或产物结论。
3. 不把 MCP 或 IDE 专用检查器作为硬依赖；项目已有专用检查工具时，只把它作为可选证据源，并记录工具名、版本、输入、输出摘要。
4. 不凭诊断码盲改；先定位根因，再按 P0/P1/P2 分级处理，连续两次同类修复无效时停手复盘。
5. 不输出证书密码、私钥、token、完整 profile 内容、签名证书原文或开发者账号敏感信息。

## 触发边界

必须使用本技能：

- 用户要求检查、修复、编译、构建、打包、发布前验收 HarmonyOS / OpenHarmony 项目。
- 用户提到 HarmonyOS、OpenHarmony、鸿蒙、DevEco、Hvigor、`hvigorw`、`ohpm`、HAP、APP、签名、`build-profile.json5`、`module.json5`、`oh-package.json5`，并要求检查、修复、编译、构建、打包、验收或定位失败。仅提到 ArkTS/ETS 语言、并发或运行时问题时交给 `harmonyos-arkts`。
- 用户要清理废弃 API、升级 HarmonyOS API 版本、处理 `@ohos.*` 到 `@kit.*` 迁移、处理 `deprecated` / 诊断码 `6387`。
- 用户给出 `.ets` 编译错误、资源找不到、依赖缺失、签名失败、产物路径找不到、DevEco 构建失败日志。
- CI/CD 或发布前需要确认 HAP/APP 产物、签名状态、SDK 版本、兼容版本和构建可复现性。

可与相邻技能协作：

- 需要真实发布、渠道、灰度、回滚、SBOM、不可变制品时，交给 release-engineering 处理发布闸门。
- 涉及登录、权限、证书泄露、隐私权限声明、密钥管理时，交给 security / legal / mobile-security 方向补审。
- 涉及后端接口、协议、数据迁移、支付、地图 SDK 等业务域时，调用对应业务技能，本技能只处理 HarmonyOS 端构建质量。
- 项目是纯 TypeScript / Vue / React / Node，不含 HarmonyOS 配置与 ArkTS/ETS 承载时，使用对应前端或 TypeScript 技能。

Anti 场景：

- 只问 HarmonyOS 概念、学习路线、市场信息、设备推荐，不涉及项目构建或代码质量。
- 只出现 Huawei、HMS、Map Kit、AGC 等词，但任务是地图、账号、云服务或普通 Android 集成。
- 只处理 Android Gradle、Flutter、UniApp、小程序、iOS、Web，不含 ArkTS/ETS 或 Hvigor 构建链。
- 用户明确要求只写产品方案、UI 文案、设计稿，不检查本地 HarmonyOS 项目。
- 用户要求安装、配置或强制依赖某个 MCP/IDE 插件；本技能不提供安装配置，只说明可选证据边界。

## 起手画像

先收集事实，不急着改：

- 项目根：从当前目录向上查找 `build-profile.json5`、`oh-package.json5`、`hvigorw`、`.hvigor`、`entry/src/main/module.json5`。
- 模块列表：读取项目级 `build-profile.json5` 的 `modules`、`products`、`signingConfigs`，再读每个模块的 `module.json5`。
- SDK 与产品：记录 `compileSdkVersion`、`compatibleSdkVersion`、`runtimeOS`、product、target、module、buildMode。
- 依赖状态：读取 `oh-package.json5`、`oh-package-lock.json5`、`oh_modules` 是否存在；缺依赖时优先建议或运行 `ohpm install`。
- 构建入口：优先使用项目自带 `./hvigorw` 或 `hvigorw.bat`；没有 wrapper 时再查 DevEco Studio/CI 日志中的真实命令。
- 源码范围：搜索 `**/*.ets`、`**/*.arkts`、必要的 `**/*.ts`，排除 `oh_modules`、`build`、`.preview`、`.hvigor`、生成目录。
- 产物范围：记录 `entry/build/**/outputs/**/*.hap`、`build/outputs/**/*.app`、signed/unsigned、mtime、size、checksum。

常用本地命令思路：

- 用 `pwd`、`find .. \( -name build-profile.json5 -o -name oh-package.json5 -o -name hvigorw \)` 确认根目录和 wrapper。
- 用 `rg --files -g '*.ets' -g '*.arkts' -g '*.ts' -g '!oh_modules/**' -g '!build/**' -g '!.preview/**'` 取源码清单。
- 用 `rg -n "Deprecated|deprecated|@ohos\\.|@kit\\.|px2vp|vp2px|fileio|AbilityContext|compileSdkVersion|compatibleSdkVersion|signingConfig"` 做初筛。
- 依赖缺失或 lock 与模块不一致时，先确认是否允许，再运行 `ohpm install`。
- 先跑 `./hvigorw --help` 或项目已有 CI 命令确认任务名；再选择 HAP/APP、debug/release、product/module 对应构建。
- 构建后用 `find . -path '*/build/*/outputs/*' \( -name '*.hap' -o -name '*.app' \)` 定位产物，并记录大小、时间和 checksum。

## 诊断分级

P0 必须修复，阻断编译或产物可信度：

- ArkTS/ETS 语法错误、括号不匹配、导入不存在、类型不匹配、未定义符号、资源引用不存在。
- `oh-package.json5` 依赖缺失、`ohpm install` 未跑或失败、模块名/target/product 对不上。
- `build-profile.json5` / 模块 `build-profile.json5` 格式错误，`compileSdkVersion`、`compatibleSdkVersion`、module、target、product 缺失或冲突。
- Hvigor 任务失败、DevEco 构建失败、HAP/APP 未生成、构建输出只有旧产物。
- release 构建签名失败、签名配置引用不存在、证书/profile 文件路径缺失或过期。

P1 强烈建议处理，影响兼容、质量或发布风险：

- 废弃 API 诊断，例如 `6387`、`deprecatedSymbol`、`@Deprecated`、日志中的 deprecated signature。
- `@ohos.*` 老模块向 `@kit.*` 或新模块迁移时有明确替代路径，但需要确认最低 API 版本。
- debug 构建能过但 release/signing/product 构建失败。
- signed/unsigned 产物混用，或验收未记录 build mode、product、module、checksum。
- 旧客户端兼容、最低 API 版本、设备能力、权限声明和迁移影响没有说明。

P2 可选优化，不阻断本轮构建：

- 未使用变量/导入，例如诊断码 `6133`。
- 异常处理建议，例如需要 try-catch、async catch。
- 代码风格、lint 建议、日志噪声、可维护性清理。
- 没有直接替代方案且风险低的废弃 API，可记录迁移计划和兼容理由。

## ArkTS / ETS 检查流程

1. 建立文件清单：只检查项目源码和必要本地库，不扫 `oh_modules`、构建产物、预览缓存。
2. 先做文本初筛：定位废弃模块、明显导入错误、重复符号、资源引用、Ability/页面入口。
3. 再用真实工具验证：优先使用项目已有 lint、DevEco/Hvigor 编译、CI 脚本或本地 `hvigorw` 日志。
4. 如果项目已有专用检查工具，可选择调用；记录它的输入文件、诊断数、版本和关键输出，但缺失时不能终止任务。
5. 对每条诊断写清文件、行列、类型、证据、优先级、修复策略和是否已验证。
6. 自动修复只覆盖根因明确的小范围问题；批量替换前必须确认 API 版本、行为差异和测试入口。

常见处理：

- 类型错误：优先修正类型声明、空值处理、泛型约束或转换点，不用 `any` 压掉诊断。
- 导入错误：核对导出名、路径大小写、模块 alias、ohpm 包名和 SDK 模块迁移。
- 资源错误：核对 `resources` 目录、media/base/profile 路径、string/color 名称和 `module.json5` 引用。
- 未定义符号：先查作用域、生命周期、组件状态、Ability 上下文，不随手创建同名变量掩盖逻辑缺口。
- 异步错误：补 catch/try-catch 时保留错误日志、用户反馈和失败返回，不吞异常。

## DevEco / Hvigor 构建流程

1. 读构建配置：项目级 `build-profile.json5` 决定 product、modules、signingConfigs；模块级配置决定 targets。
2. 读模块配置：`module.json5` 里确认 `type`、`name`、abilities、pages、requestPermissions、deviceTypes、extensionAbilities。
3. 读依赖配置：`oh-package.json5` 和 lockfile 决定 ohpm 依赖；缺失、版本漂移或 `oh_modules` 不存在时先补依赖证据。
4. 选构建目标：HAP 用于模块包和调试验证；APP 用于应用级包和发布前验证。
5. 选构建模式：debug 可用于快速定位；release 必须单独验证签名、混淆、资源和产物路径。
6. 运行构建：优先使用项目 wrapper 和项目已有脚本；命令、工作目录、product、module、target、mode 都要写入输出。
7. 分析失败：先看第一失败点，再看依赖、配置、资源、ArkTS 编译、签名、产物路径，不用“重跑成功”代替根因。
8. 验证产物：确认 mtime 在本次构建之后，记录路径、size、checksum、signed/unsigned、build mode、product/module。

构建命令选择原则：

- 不知道任务名时，先跑 `./hvigorw --help` 或查看 CI/DevEco 日志，不硬猜任务。
- 如果项目脚本已定义 HAP/APP 构建命令，优先复用脚本。
- 如果只做语法修复，先用最小模块构建缩小反馈；发布前必须补 APP/release 或用户指定目标。
- 构建失败后最多做两轮同类修复；仍失败时输出剩余诊断、已试方案和下一步证据。

## 签名与产物

签名检查只做证据化判断，不泄露 secret：

- 读取 `build-profile.json5` 中 `signingConfigs`、`products[].signingConfig`、profile、certpath、keyAlias 等字段名和路径存在性。
- 不打印证书密码、私钥、profile 全文、开发者账号、token 或完整敏感环境变量。
- debug 构建可以无发布签名；release / APP / 商店提交必须确认签名配置绑定到目标 product。
- 签名失败先分清路径不存在、密码/alias 错误、profile 不匹配、证书过期、bundleName 不匹配、设备类型不匹配。
- 输出 signed/unsigned 状态时，以文件名、构建日志和配置证据共同判断；不只看路径字符串。

产物验收：

- HAP 常见位置：模块 `build/.../outputs/.../*.hap`，记录模块名、target、是否 signed。
- APP 常见位置：项目 `build/outputs/.../*.app`，记录 product、mode、是否 signed。
- 旧产物风险：每次构建后核对 mtime 和 checksum，避免把历史文件当本次成功。
- 多 product 风险：`default`、渠道 product、debug/release 可能生成不同路径，输出必须标清。
- 发布风险：如果只是本地构建通过，必须写明未做设备安装、真机 smoke、商店审核、渠道发布。

## 废弃 API 检查与迁移

先识别，再迁移：

- 从编译/检查日志里收集 `deprecated`、`6387`、`deprecatedSymbol`、`@Deprecated`、`@ohos.*` 老模块。
- 从源码里初筛 `@ohos.fileio`、`AbilityContext`、`px2vp`、`vp2px`、旧 HTTP/文件/UI/状态管理接口。
- 读取 `compileSdkVersion` 和 `compatibleSdkVersion`，确认替代 API 的最低支持版本。
- 查项目封装层：优先在工具类、adapter、service 层做集中迁移，避免页面里散落替换。
- 对每个迁移项写清旧 API、新 API、行为差异、最低 API、影响文件、测试入口和回退方案。

迁移策略：

- 有直接替代 API：小范围替换后构建验证，并补相关调用测试或 smoke。
- 替代 API 行为不同：先写适配层或兼容分支，保留旧版本兼容说明。
- 没有直接替代 API：标 P1/P2 风险，给重构方案和后续验证入口，不做猜测式替换。
- 涉及权限、文件、网络、后台任务、相机、位置、支付等能力时，额外核对 `module.json5` 权限和运行时授权。
- 大规模迁移前先做样例文件验证；确认编译和行为后再批量。

## 写操作门禁

- 只读审计、学习、影响面分析：不写盘，只输出诊断和建议。
- 修复代码前必须先定位根因，并说明会改哪些文件；不要跨出用户指定范围。
- 签名证书、profile、密钥、bundleName、发布 product、权限声明属于高风险改动，需用户确认。
- 删除文件、清缓存、重装依赖、变更 SDK 版本、改 package 名、改发布签名都需确认。
- 构建命令可能修改 `build/`、`.hvigor/`、`oh_modules/`，运行前说明副作用；必要时只读检查。

## 输出要求

每次使用本技能，输出按真实证据组织：

- 结论：能否构建、能否生成指定 HAP/APP、是否存在阻断项。
- 项目画像：项目根、模块、product、target、build mode、SDK 版本、依赖状态。
- 检查范围：扫描了哪些 `.ets/.arkts/.ts` 文件，排除了哪些目录。
- 命令与结果：执行的 `ohpm`、`hvigorw`、lint、DevEco/CI 命令，退出码和第一失败点。
- 诊断分级：P0/P1/P2 数量和代表问题，逐条绑定文件行号或日志片段。
- 废弃 API：旧 API、替代 API、最低 API、迁移风险、是否已验证。
- 签名与产物：签名配置名、敏感字段脱敏状态、HAP/APP 路径、size、mtime、checksum、signed/unsigned。
- 改动点：改了哪些文件、为什么改、没有改哪些高风险项。
- 验证：跑了什么，结果如何；没跑就写未跑和原因。
- 剩余风险：未验证设备、未跑 release/APP、未做安装 smoke、签名资料缺失、迁移待人工确认。

## 反例

- 错法：MCP 工具不可用就终止。对法：用本地文件、`ohpm`、`hvigorw`、DevEco/CI 日志继续建立证据；专用工具只是可选证据。
- 错法：看到 `6387` 就全局替换。对法：确认替代 API、最低 API、行为差异和测试入口，再小步迁移。
- 错法：debug HAP 生成就说发布可用。对法：release APP、签名、product、checksum、安装/smoke 分别验收。
- 错法：签名失败时打印证书配置全文。对法：只输出字段名、路径存在性、匹配关系和脱敏错误。
- 错法：构建失败后反复重跑。对法：锁定第一失败点、输入差异、依赖状态和配置变更。
- 错法：把旧产物路径当本次结果。对法：核对 mtime、size、checksum 和构建日志。

## 提交前自检

- [ ] frontmatter 只有 `name` 和 `description`。
- [ ] 已确认项目根、模块、product、SDK、依赖和构建入口。
- [ ] 没有把专用 MCP/IDE 检查工具写成硬依赖或安装前置。
- [ ] P0/P1/P2 诊断有证据和处理状态。
- [ ] HAP/APP 产物路径、mtime、size、checksum 已核对，或明确未生成。
- [ ] 签名信息已脱敏，没有泄露密码、私钥、token、profile 全文。
- [ ] 废弃 API 迁移说明包含最低 API、行为差异和验证入口。
- [ ] 未跑的命令、未验证的设备/发布路径和剩余风险已明确写出。
