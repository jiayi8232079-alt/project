---
name: script-bytecode-reverse-engineering
description: 脚本、字节码与宏逆向技能 - 面向授权 JavaScript/Python pyc/Lua/LuaJIT/.NET IL/Java bytecode/PowerShell/VBScript/BAT/VBA 样本的混淆还原、AST/CFG/bytecode 分析、loader/dropper 防御证据、配置/IOC 提取和报告交付；拒绝反爬绕过、凭据窃取、恶意复用和 payload 改造。
---

# 脚本与字节码逆向

## 定位

脚本与字节码逆向（script-bytecode-reverse-engineering，兼容 slug: scriptrev）负责授权场景下的脚本、字节码和已提取宏代码逆向。目标是把可读性差、被编码/压缩/混淆/打包的脚本样本，还原成可复核的结构、入口、配置、行为、置信度和防御证据。

覆盖范围：

- JavaScript / Node.js：混淆脚本、loader、eval、dynamic import、source map、npm 依赖归属、AST/CFG 和运行时拼接；Web 应用 bundle 专项只做初筛后转 `webrev`。
- Python / pyc：`.py`、`.pyc`、zipapp、PyInstaller、py2exe、cx_Freeze、Nuitka 产物中的入口、资源、依赖、marshal/code object 和字节码线索。
- PowerShell / VBScript / BAT / CMD / WSF / JScript：编码命令、拼接执行、下载器、注册表/计划任务/环境探测。
- VBA / Office 宏代码：已提取宏模块、自动执行入口、表单代码、字符串表、Shell/COM/网络/文件行为；容器提取和文档漏洞归 `docrev`。
- Lua / LuaJIT：源码、`.luac`、LuaJIT bytecode、游戏/插件/嵌入式脚本的入口、常量、调用链和配置。
- .NET / Java bytecode：`.dll`、`.exe`、`.class`、`.jar`、`.dex` 中的 IL/JVM/Dalvik 字节码、metadata、常量池、反射加载、资源和依赖归属；原生二进制壳或 VM 保护转相邻逆向技能。
- 通用脚本逆向：AST、bytecode、字符串表、控制流、配置/IOC 提取、行为证据、检测建议。

不覆盖：

- 只读学习、项目上手、普通脚本开发、脚本重构和业务自动化实现。
- Web 前端 bundle、浏览器扩展、WASM、Electron/Tauri 应用专项，优先 `webrev`。
- Office/PDF/LNK 等文档容器、宏提取链路、OLE 结构和漏洞载体专项，优先 `docrev`；`scriptrev` 只分析已提取的宏代码。
- 无授权样本、反爬绕过、凭据窃取、恶意脚本复用、payload 改造、规避检测和批量滥用。

## 铁律

1. 没有书面或等价授权、样本来源、目标范围、允许动作、禁止动作和停止条件，不进入逆向或动态执行。
2. 未知脚本、宏、字节码和打包产物默认不直接运行；先静态建档，再决定是否隔离观察。
3. 去混淆只服务理解、审计、兼容和防御，不把还原结果改造成可复用攻击脚本。
4. 反爬参数、Cookie、Token、账号、密钥、设备标识、个人数据和业务敏感配置必须脱敏。
5. 对下载执行、持久化、凭据访问、横向移动、规避检测等高风险行为，只做定位、证据和缓解建议。
6. 每个结论必须能回到文件、哈希、偏移/行号、AST 节点、字节码指令、宏模块、日志或沙箱证据。
7. 区分“已证实、推测、未验证”；不得把解码猜测、函数名猜测、单次沙箱现象写成定论。
8. 不提供绕过反爬、规避检测、恢复攻击链、二次投递、凭据提取和 payload 改造步骤。
9. 还原输出必须带置信度：高=多证据交叉一致；中=静态或动态单侧可信；低=命名、语义或路径仍依赖推断。
10. AST、反编译伪码和 bytecode 不一致时，以原始字节码/宏模块/执行证据为准，并保留差异说明。
11. 未通过验证门禁前，不把还原文本、IOC、配置字段或动态行为写成最终结论。
12. loader/dropper 分析只输出防御画像、入口条件、行为证据和阻断点，不补全下载、执行、持久化、规避或投递链。

## 快速总则

1. 先建档：样本哈希、文件树、语言/运行时版本、编码、打包器、入口、来源、授权范围。
2. 先分层：容器、压缩、编码、加密、混淆、打包器、loader、业务逻辑、配置和第三方库。
3. 先找入口：主模块、自动执行宏、PowerShell 参数、BAT 标签、Lua chunk、pyc magic、JS bootstrap。
4. 先抽证据：字符串、常量池、导入/依赖、命令 sink、网络 sink、文件 sink、注册表/计划任务、IOC。
5. 先对照：源码/AST/CFG、反编译伪码、bytecode、运行日志和配置输出要互相标注，不让单一工具决定结论。
6. 先静后动：静态无法确认时才在 sandbox 中最小触发，并记录输入、网络策略、时间、行为和清理方式。
7. 先脱敏再交付：保留证据编号和复核路径，不直接暴露真实密钥、令牌、账号或可复用攻击材料。

## 三轮加固执行法

第一轮：样本面补全。

- 每个样本必须有来源、授权范围、接收时间、原始文件名、大小、hash、容器层级、语言候选和分析副本 hash。
- 多文件包必须建立文件树和主从关系：入口、依赖、资源、配置、source map、loader、远端下发占位和第三方库分开编号。
- 样本来源不清、hash 缺失、分析对象不是原始副本时，只能做初筛，不能输出最终结论。
- 发现源码、字节码、打包器、宏模块、shell 脚本混合时，先拆层再下结论；不得把最外层文件类型当真实语言。

第二轮：证据面补全。

- JavaScript 必须对照源码/AST、bundle wrapper、source map、eval/new Function、dynamic import、loader 链和 Node/Web 上下文。
- Python 必须对照源码、pyc magic、code object、marshal、import graph、打包器 TOC、资源和运行时临时目录。
- Lua/LuaJIT 必须对照 chunk 头、常量表、upvalue、闭包、宿主 API、require 路径和自定义 opcode 风险。
- PowerShell/VBS/BAT/CMD/Shell 必须对照编码链、变量展开、别名、管道、子解释器、环境探测和持久化触点。
- source map 只能作为映射证据，不能单独证明真实源码；必须保留 map 来源、hash、映射覆盖率和缺失段。
- loader 链必须按阶段记录：入口、解码、依赖加载、环境判断、配置读取、动态执行、外部资源和退出路径。

第三轮：验收面补全。

- 端到端验收必须能从样本来源一路追到 hash、入口、层级、AST/bytecode/source map、行为证据、配置/IOC、脱敏交付。
- 去混淆结果必须标注“可还原、部分还原、不可还原、存在多解”，不能把整理后的伪源码包装成原始源码。
- 动态执行只用于补证，必须在隔离 sandbox、最小输入、无真实凭据、无真实外联、可回滚快照和退出条件下执行。
- 每个关键结论至少需要两类证据交叉；只有单类证据时降级为推测，证据冲突时降级为未证实项。
- 交付前回扫敏感信息：token、cookie、密钥、账号、内网地址、客户数据、设备标识和可复用 payload 必须脱敏或改用证据编号。

## 强制流程

### 1. 授权与样本建档

- 记录来源、授权人、允许动作、禁止动作、分析目标、交付对象和停止条件。
- 计算哈希，记录文件名、大小、时间戳、MIME/魔数、压缩层、编码层和目录结构。
- 标注语言、运行时版本、字节码版本、打包器/混淆器线索和可疑入口。
- 准备隔离环境、只读原件、工作副本、证据目录、网络策略、快照回滚点和敏感数据脱敏规则。
- 授权边界必须明确：允许静态分析、允许/禁止动态触发、可访问网络范围、可导出证据类型、保密等级和何时停止。
- 来源链必须包含谁提供、从哪里取得、何时取得、是否允许外发、是否含客户/个人/生产敏感数据；缺任何一项都标记 custody 不完整。
- hash 至少记录原始样本和工作副本；解包、解码、反编译、source map 还原和配置导出结果也要记录派生 hash 或证据编号。

### 2. 分层与入口识别

- 判断是源码、字节码、打包产物、宏模块、loader、dropper、配置脚本还是混合形态。
- 识别入口：`main`、bootstrap、IIFE、eval 链、`if __name__`、pyc code object、PowerShell begin/process/end、BAT label、VBA AutoOpen/Document_Open、Lua chunk。
- 区分业务代码、第三方库、打包器 runtime、混淆 runtime、资源文件、loader/dropper 逻辑和真实载荷边界。
- 识别打包器/混淆器：PyInstaller、py2exe、cx_Freeze、Nuitka、zipapp、pkg/nexe、webpack/rollup/esbuild、PS2EXE、VBE/JSE 编码、LuaJIT bytecode、.NET packer/obfuscator、Java shrinker/obfuscator、常见 JS obfuscator。
- 记录每一层的提取方式、工具版本、输出文件和不可逆操作。
- 依赖归属要分清标准库、第三方包、项目私有模块、运行时解包模块、远端下发模块和动态加载模块。

### 3. 静态还原

- 先格式化和安全解码，再做变量重命名、字符串表恢复、控制流整理和依赖归属。
- 使用 AST、CFG 或反编译结果识别函数边界、调用图、危险 sink、配置对象、状态机、异常边和不可达块。
- 对 pyc/LuaJIT/.NET IL/JVM/Dalvik 等字节码，先确认 magic/version/metadata，再分析常量池、名称表、导入、跳转、异常表、反射调用和动态加载。
- 对 PowerShell/VBS/BAT，拆分编码、压缩、拼接、环境变量展开、命令别名和嵌套解释器。
- 对宏代码，枚举模块、类模块、表单、自动执行入口、Shell/COM/WMI/网络/文件访问。
- 建立 AST/CFG/bytecode 对照表：函数/过程、基本块、常量、导入、危险调用、跳转分支、异常路径和配置读取点至少要能追溯一侧原始证据。
- 静态还原必须保留原文摘要、转换链、工具版本、失败分支和人工判断点；不可逆步骤要能回放或说明不能回放的原因。
- 标注解混淆置信度：每个字符串、函数名、控制流块和配置字段都要说明高/中/低及依据，低置信字段不得进入最终 IOC 表。
- AST 与 bytecode/source map/运行日志不一致时，先保留冲突，再判断是工具误差、混淆诱导、版本不匹配、死代码还是环境门控。
- loader 或动态执行链不得只画“入口到载荷”的单线图；必须标注未触发分支、环境条件、失败路径和阻断点。
- 去混淆脚本、格式化器、反编译器和字节码工具的版本必须记录；工具输出不可复现时，相关结论降级。

### 4. 行为与配置提取

- 提取 URL、域名、IP、路径、注册表键、计划任务名、互斥体、服务名、进程名、User-Agent、错误码、开关、规则名和日志字段。
- 标注下载、执行、写文件、删除、压缩、解压、进程启动、凭据访问、持久化、注入、loader/dropper 阶段和防分析线索。
- 把配置分成已验证字段、推测字段和敏感字段；敏感字段只交脱敏值、哈希或证据编号。
- 对 IOC 给出来源位置、上下文、置信度、是否需要二次验证和检测建议。
- 配置/IOC 提取要保留字段路径：变量名、常量池索引、宏过程、JSON/YAML/registry 路径、环境变量名、运行时拼接来源和是否来自远端下发。
- IOC 和配置必须拆分为静态提取、动态确认、外部情报匹配和仍未验证四类；无法确认用途的值只放入待复核项。
- 行为证据要能串成时间线：触发入口、依赖加载、动态执行、文件/网络/进程/注册表行为、失败分支、清理动作和未触发路径。

### 5. Sandbox 动态补证

- 仅当静态证据不足时，在隔离环境用最小输入触发目标路径。
- 禁止连接真实受害者服务、提交真实凭据、执行持久化、扩散、二次下载或破坏性命令。
- 记录进程、文件、网络、注册表/启动项、环境变量、日志、异常和时间线。
- 动态补证要预设观察目标、触发输入、网络隔离策略、DNS/HTTP sinkhole、回滚快照和退出条件；只采集验证静态疑点所需的最小证据。
- 动态发现必须回填到静态入口，说明触发条件、未触发路径、环境差异、复核方式和不能复现时的解释。
- 对依赖安装、模块导入、反射加载、eval/exec、child process 和宏自动入口，只做受控观察；禁止为了“跑通”而补齐真实凭据、真实 C2 或攻击参数。
- sandbox 边界必须写清 CPU/OS/解释器版本、网络策略、DNS/HTTP 模拟、时间窗口、允许文件系统范围、监控点和回滚方式。
- 若样本试图持久化、提权、横向移动、禁用日志、读取凭据或连接真实服务，立即停止动态路径，改用静态证据和阻断建议。
- 动态执行不能改变原始样本；所有触发输入、环境变量、假配置、模拟服务响应都必须记录为测试夹具，避免把人为输入误写成样本真实配置。

### 6. 验证门禁

- 静态门禁：样本哈希、入口、层级、关键转换、AST/CFG/bytecode/宏模块证据和置信度已记录；工具失败或版本不匹配已写明。
- 动态门禁：只有静态不足时才执行；动态行为已回填到入口链，且没有真实外联、持久化、扩散、破坏或凭据提交。
- IOC/配置门禁：每个值都有来源、上下文、角色、置信度、脱敏方式和复核状态；敏感值不得以原文交付。
- 边界门禁：宏容器/文档漏洞已转 `docrev`，Web bundle/前端供应链已转 `webrev`，独立脚本/字节码/已提取宏逻辑才继续。
- 交付门禁：报告只含防御证据、检测点、缓解建议和可复核摘要；不得包含可直接复用的攻击链、绕过步骤或 payload 改造细节。
- 报告验收门禁：结论、证据编号、置信度、脱敏状态、复核命令摘要、未证实项、拒绝项和相邻技能转交理由齐全。
- 端到端门禁：任一结论必须能按“来源/hash -> 层级 -> 入口 -> 证据 -> 行为/配置 -> 置信度 -> 脱敏交付”回放；断链则降级。
- 降级门禁：命名猜测、单次 sandbox 现象、source map 缺段、反编译失败、字节码版本不匹配、loader 分支未触发时，必须进入推测或未证实项。

### 7. 收口交付

- 按“样本档案、入口链、还原步骤、核心行为、配置/IOC、证据表、风险、建议、未证实项”交付。
- 所有高风险内容只给防御视角，不给复用脚本、绕过步骤或 payload 改造建议。
- 给出检测/加固建议时，优先使用行为特征、日志规则、最小化阻断点和复核命令摘要。
- 交付前执行验证门禁；不满足的结论降级为未证实项或待补证项。
- 未能完成反编译时仍要交付原始证据：hash、magic/version、常量池、导入、字符串、跳转、入口候选、失败原因和下一步补证路径。
- 报告必须区分：可公开摘要、内部防御细节、敏感证据索引和禁止外发内容；交付物不得包含可运行恶意载荷或绕过步骤。

## 场景执行卡

### JavaScript / Node.js 混淆与 bundle

- 先看 package 元数据、入口、bundle wrapper、source map、动态 import、eval/new Function、字符串数组和解码器。
- AST 侧重点：调用图、危险 sink、网络/文件/child_process、环境变量、原型污染、动态属性访问。
- CFG 侧重点：条件分发、异常分支、死代码、控制流扁平化、解码器循环和 loader 阶段切换。
- 证据要落到文件、行号/节点、解码前后片段摘要、依赖归属和触发条件。
- JS 差异点：重点验证运行上下文是浏览器、Node、Worker、扩展、Electron 还是嵌入式 JS；同名 API 在不同宿主下行为不同。
- source map 差异点：只用于定位原始模块候选、函数边界和构建路径；若 map 与 bundle hash、版本或覆盖段不匹配，所有源码命名降级。
- 如果目标是 Web 应用 bundle、浏览器扩展、WASM、service worker、前端供应链或框架路由，只完成边界识别并转 `webrev`；`scriptrev` 只继续分析独立脚本、loader 或 Node 样本逻辑。
- `package.json`、`.map`、chunk 名和 source map 只能作为候选信号；若核心问题是路由、构建、供应链或浏览器运行上下文，停止深挖并转 `webrev`。
- 遇到反爬、签名参数、Cookie/Token 滥用请求时，只说明合法风险和证据，拒绝绕过实现。

### Python / pyc / 打包器

- 先确认 Python 版本、pyc magic、marshal/code object、入口模块、依赖、资源和临时解包路径。
- PyInstaller/py2exe/cx_Freeze/Nuitka 要区分 bootloader、第三方库、业务模块和内置资源。
- bytecode 侧重点：常量池、names、imports、call、jump、异常处理、动态 exec/eval/import。
- 入口要覆盖 `__main__`、console_scripts、PyInstaller toc、archive manifest、zipapp shebang、动态 import 和反射加载。
- 输出必须说明反编译可靠性、版本不匹配风险、AST/bytecode 差异和无法还原的控制流。
- Python 差异点：源码、pyc、zipapp、冻结产物和 Nuitka 原生化产物证据层不同；不能用源码级 AST 结论覆盖 pyc 指令或打包器 runtime。
- 对 `exec`、`eval`、`compile`、`marshal.loads`、动态 import 和临时目录解包，只给触发条件、证据编号和防御建议，不补齐真实执行链。

### .NET / Java bytecode

- .NET 先看 assembly metadata、manifest、resources、IL、P/Invoke、reflection、dynamic method、config 和 NuGet 依赖归属。
- Java/JVM 先看 class version、constant pool、method descriptor、invokedynamic、reflection、classloader、resource、manifest 和 Maven/Gradle 依赖归属。
- Android DEX/JAR 只做字节码、资源、权限和动态加载证据；APK 容器、签名、移动平台安全专项转 `mobile-security` 或相邻逆向技能。
- 反混淆要保留原始 token/class/method 映射、控制流差异、异常表和低置信命名；不得把重命名伪源码当原始源码。
- 涉及 loader/dropper、反射加载或远端下发时，只给入口条件、阶段证据、IOC、日志点和阻断建议，不补齐可复用加载链。

### PowerShell / VBScript / BAT / CMD / WSF

- 先拆编码参数、Base64、gzip/deflate、字符串拼接、变量替换、别名、管道和嵌套解释器。
- 检查下载执行、IEX、反射加载、WMI、COM、计划任务、注册表、服务、凭据访问和环境探测。
- BAT/CMD 要注意 delayed expansion、FOR/FINDSTR 解析、标签跳转、临时文件和外部工具调用。
- PowerShell 要识别 profile、module manifest、begin/process/end、scriptblock logging 线索、AMSI/ETW 绕过意图和编码链，但只给防御证据。
- 只输出行为链、IOC、检测点和阻断建议，不复用命令链。
- Shell 差异点：Bash/Zsh/sh/fish 语法、alias/function、here-doc、process substitution、IFS、glob、trap、sudo/systemctl/cron 行为要分开验证。
- PowerShell 差异点：Windows PowerShell 与 PowerShell Core、ExecutionPolicy、ConstrainedLanguage、profile、module autoload 和 transcript/logging 环境不同，动态观察要注明版本。

### VBA 宏代码

- 适用前提：宏代码或模块已经被提取；若任务是解析文档容器、OLE、PDF/LNK 或漏洞载体，转 `docrev`。
- 枚举 AutoOpen、Document_Open、Workbook_Open、AutoClose、Worksheet_Change、UserForm 事件和隐藏模块。
- 检查 Shell、WScript.Shell、CreateObject、URLDownloadToFile、XMLHTTP、ADODB.Stream、PowerShell、文件/注册表操作。
- 宏边界要写清：提取、解密、OLE 流、文档漏洞、DDE/模板注入归 `docrev`；已提取 VBA/VBScript 逻辑、字符串和自动入口归 `scriptrev`。
- `.docm`、`.xlsm`、OLE stream、vbaProject、模板注入和容器加密只作为转交信号；没有已提取宏模块时不继续做脚本级定论。
- 证据要包含模块名、过程名、自动入口、关键调用和脱敏后的 IOC。

### Lua / LuaJIT

- 先确认 Lua 版本、LuaJIT bytecode、chunk 头、常量表、upvalue、闭包、require 路径和宿主程序。
- 关注游戏/插件/嵌入式脚本中的配置、权限、网络、文件、反调试、热更新和动态加载。
- Lua/LuaJIT 要区分 PUC Lua chunk、LuaJIT bytecode、宿主自定义 op 和资源封包；反编译失败时用字节码指令、常量池和调用关系交付证据，不强行生成伪源码定论。
- Lua 差异点：同一脚本在游戏引擎、OpenResty、嵌入式固件和插件宿主中的全局对象、权限、路径和热更新机制不同，必须标明宿主。
- 自定义 opcode、加密 chunk 或宿主 API 缺失时，结论只到字节码/常量/调用图层，不编造业务语义。

### 混淆还原

- 先识别编码、压缩、加密、字符串表、控制流扁平化、死代码、动态执行和环境绑定。
- 每次转换保留输入摘要、输出摘要、工具/脚本版本和证据编号。
- 还原命名以语义和调用关系为依据，不凭猜测编造业务含义。
- 对不可逆或多解部分标注置信度，并把“为什么不能更高置信”写入未证实项。
- 对字符串解密器、虚假分支、环境绑定、反沙箱判断和动态执行门控，只记录防御证据和触发条件，不提供绕过方法。
- 降级规则：无法复现的解密器、缺 source map 覆盖、分支依赖真实环境、工具反编译冲突、控制流多解、字节码版本不匹配，都不能写成已证实。
- 还原产物必须保持“原始片段摘要 -> 转换步骤 -> 还原片段摘要 -> 置信度”的映射，避免后续审计无法追溯。

### Loader / Dropper 防御分析

- 先分阶段：初始入口、解码/解包、依赖加载、环境探测、配置读取、网络准备、二阶段获取、执行/落地和清理。
- 每一阶段只输出证据、目的推断、置信度、可观测日志、阻断点和误报风险。
- 若用户要求补全下载地址、修复失效载荷、绕过环境检测、提高成功率或改造成可运行链路，立即拒绝并改交防御摘要。

### 配置 / IOC / 防御证据

- IOC 不只列值，还要列来源位置、上下文、行为角色、置信度、首次/末次出现和脱敏方式。
- 配置提取要区分默认值、运行时拼接值、远端下发值、测试值和真实生产值。
- 配置字段要保留层级路径、拼接来源、解码链、是否静态可得、是否动态确认和是否包含敏感数据。
- 防御证据优先包括：入口条件、行为链、日志点、阻断点、检测字段、误报风险和复核路径。

## 输出要求

每次使用本技能，至少输出：

1. 授权边界：来源、目标、允许动作、禁止动作和停止条件。
2. 样本档案：哈希、文件树、语言/运行时、字节码版本、打包器/混淆器、入口。
3. 还原过程：解层顺序、AST/CFG/bytecode/宏模块证据、工具版本和不可确认项。
4. 行为链：文件、网络、进程、命令、注册表/计划任务、凭据访问、持久化和防分析线索。
5. 配置与 IOC：脱敏值、来源位置、上下文、置信度、检测/阻断建议。
6. 结论分级：已证实、推测、无法验证、需要补证。
7. 验证门禁：静态、动态、IOC/配置、边界和脱敏交付是否通过；未通过项如何降级。
8. 相邻技能联动：是否应转 `webrev`、`docrev`、`malrev`、`prot`、`tst` 或 `aud`，以及原因。
9. 拒绝项记录：若用户目标触及反爬、凭据、恶意复用或 payload 改造，说明拒绝范围，并给允许的防御替代输出。
10. 报告验收：列明报告版本、证据清单、置信度矩阵、敏感数据处理、复核摘要、遗留风险和禁止外发内容。

## 安全边界

允许：

- 授权防御分析、内部审计、兼容排障、恶意脚本 triage、CTF/教学、检测规则取证。
- 提供脱敏 IOC、行为证据、风险说明、修复/加固建议、检测字段和复核路径。

拒绝：

- 反爬绕过、验证码/风控规避、Cookie/Token 滥用、接口签名滥用。
- 凭据窃取、密钥提取滥用、会话接管、批量账号攻击。
- 恶意脚本复用、下载执行链补全、持久化增强、规避检测、payload 改造、恶意宏修复成可运行版本。
- 无授权目标分析、真实受害者环境连接、破坏性执行和扩散验证。
- 为 loader/dropper 补齐二阶段载荷、有效 C2、反沙箱绕过、免杀配置、自动化投递、真实凭据或真实环境触发参数。

## 反例库

- 反例：把 Base64 当作加密结论。修正：先区分编码、压缩、加密和混淆层。
- 反例：未知 PowerShell 直接运行。修正：先静态解码，在隔离环境最小触发。
- 反例：pyc 反编译失败就改用猜测源码。修正：交付 magic、常量池、指令和置信度。
- 反例：把 PyInstaller bootloader 当业务恶意逻辑。修正：先区分 runtime、库和业务模块。
- 反例：宏只查 Sub Main。修正：枚举自动执行入口、事件和隐藏模块。
- 反例：混淆还原后贴出真实 token。修正：脱敏并保留证据编号。
- 反例：反爬参数分析变成绕过教程。修正：只写风险、证据和合法修复建议。
- 反例：IOC 只有域名列表。修正：补来源位置、上下文、行为角色和置信度。
- 反例：把第三方 npm 包误判为自研 payload。修正：做依赖归属和版本比对。
- 反例：LuaJIT 反编译失败就放弃。修正：用 bytecode、常量和调用关系建立证据链。
- 反例：把 Webpack 业务 bundle 当独立恶意脚本深挖。修正：确认 Web 应用上下文后转 `webrev`。
- 反例：拿到 `.docm` 就直接做宏逆向。修正：容器提取与文档漏洞先转 `docrev`，只分析已提取模块。
- 反例：只给“疑似混淆”结论。修正：列出混淆层、还原步骤、证据编号和置信度。
- 反例：动态沙箱看到一次外联就写死 C2。修正：回填静态入口、触发条件、网络证据和复核状态。
- 反例：配置表原样交付真实 key。修正：脱敏、哈希或证据编号交付，并说明字段角色。
- 反例：只看反编译伪码不看 CFG。修正：补基本块、异常边、跳转来源和字节码对照。
- 反例：把 .NET/Java 混淆类名当业务含义。修正：保留 token/constant pool/descriptor 证据和低置信命名。
- 反例：为了验证 loader 而补齐真实下载链。修正：用 sinkhole、阻断点和日志证据验证阶段意图。
- 反例：动态执行前先安装未知依赖。修正：先做依赖归属和 hash，必要时在 sandbox 内离线镜像观察。
- 反例：报告只写行为结论没有验收表。修正：补证据编号、置信度、脱敏状态、复核摘要和未证实项。
- 反例：只有文件名和扩展名就判定语言。修正：用 magic、shebang、AST/bytecode 特征、宿主和入口交叉确认。
- 反例：把 source map 还原出的路径当真实源码证据。修正：校验 map 来源、hash、覆盖率和缺失段，命名不足时降级。
- 反例：loader 链只写最后的二阶段行为。修正：按入口、解码、环境判断、配置读取、动态执行和失败路径分阶段编号。
- 反例：PowerShell 沙箱跑通后贴出完整命令链。修正：只交脱敏行为链、日志点、阻断点和复核摘要。
- 反例：Shell 脚本未考虑 IFS、glob、alias、trap 和 sudo 上下文。修正：按解释器与宿主环境复核。
- 反例：LuaJIT 字节码反编译成伪源码后直接命名业务函数。修正：保留常量、upvalue、调用关系和低置信命名。
- 反例：Python pyc 版本不匹配仍输出源码级定论。修正：退回 magic、code object、指令和未证实项。
- 反例：沙箱里用真实 token 触发远端接口。修正：使用模拟服务、假配置和阻断网络，敏感字段只存证据编号。
- 反例：把低置信 IOC 放入最终阻断清单。修正：拆成已验证、推测、外部情报匹配和待复核四类。
- 反例：报告没有端到端回放链。修正：补来源/hash、层级、入口、证据、行为、置信度和脱敏交付路径。

## 自检清单

- [ ] frontmatter `name` 为 canonical `script-bytecode-reverse-engineering`；兼容 slug 为 `scriptrev`，自检不得要求 name 等于短 slug。
- [ ] 行数小于 500，正文无 fenced code block。
- [ ] 覆盖 JavaScript、Python/pyc、Lua/LuaJIT、.NET IL、Java/JVM/Dalvik bytecode、PowerShell、VBScript、BAT/CMD、VBA。
- [ ] 覆盖 AST/CFG/bytecode 对照、打包器识别、自动执行入口、依赖/动态执行、反混淆置信度、配置/IOC、防御证据。
- [ ] 覆盖 source map、loader 链、样本来源/hash、动态 sandbox 边界、敏感信息脱敏和去混淆结论降级。
- [ ] 能区分 JS、Lua、Python、PowerShell、Shell 的宿主、运行时、入口和证据差异。
- [ ] 独立验证门禁覆盖静态还原、动态补证、IOC/配置、边界判断和脱敏交付。
- [ ] 明确拒绝反爬绕过、凭据窃取、恶意脚本复用、loader/dropper 补链、payload 改造和无授权分析。
- [ ] 输出要求能支撑复核：样本、入口、证据、行为、结论、补证路径、报告验收齐全。
- [ ] 相邻技能边界写清，避免只读学习、普通开发、webrev/docrev 场景误触发。

## 相邻技能边界

- Web 逆向（web-reverse-engineering，slug: webrev）：Web bundle、浏览器扩展、WASM、Electron/Tauri、前端供应链专项。
- 文档逆向（document-reverse-engineering，slug: docrev）：Office/PDF/LNK 容器、宏提取、OLE 结构、文档漏洞载体专项；提取后的宏代码可回到 `scriptrev`。
- 恶意样本逆向（malware-reverse-engineering，slug: malrev）：恶意样本家族归因、沙箱行为画像、检测规则体系和应急交接。
- 协议分析（protocol-analysis，slug: prot）：网络协议、签名字段、抓包还原和协议兼容专项。
- API 工程（api-engineering，slug: api）：后端 API 契约、接口设计和业务实现。
- 测试验证（test-engineering，slug: tst）：多环境复现矩阵、回归验证和检测规则测试。
- 代码审计（code-audit，slug: aud）：改动完成后的覆盖审计、安全复盘和交付收口。