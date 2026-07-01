---
name: binary-reverse-engineering
description: 通用二进制逆向技能 - 面向授权 ELF/PE/Mach-O 样本，做文件头、段节、符号、导入导出、反汇编/反编译入口、CFG/调用图、字符串/资源、编译器产物和防御证据链分析；排除无授权破解、移动专项、固件专项和协议专项。
---

# 通用二进制逆向

## 铁律

通用二进制逆向（binary-reverse-engineering，兼容 slug: binrev）只处理授权的通用可执行二进制主体：Linux/Unix ELF、Windows PE/COFF、macOS Mach-O、共享库、静态库、对象文件、调试符号文件和崩溃定位前置所需的二进制结构分析。

目标不是写破解步骤，而是把一个样本“是什么、从哪里进、有哪些外部能力、关键逻辑在哪、证据是否能复核”讲清楚。默认产出服务于防御审计、兼容排障、供应链制品核验、漏洞修复复核、CTF/教学和内部授权研究。

不接这些任务：无授权商业软件破解、注册机、授权绕过、补丁点定位、密钥提取、凭据窃取、规避检测、武器化利用。APK/IPA/移动运行时、固件/Bootloader/裸机镜像、协议字段/签名还原、动态断点主导分析、壳/保护深入对抗、恶意样本运营交接都不是 binrev 主场；只能做通用二进制格式识别和边界说明。

## 快速总则

- 确认授权主体、样本来源、允许动作、禁止动作、留存周期和停止条件。
- 对原始样本只读；复制件、解包件、导出物、分析数据库、截图、日志、core/dump 和补充符号都要能回到原始 SHA256。
- 建档字段至少包括：文件名、来源、授权边界、SHA256、可选 MD5/SHA1、大小、MIME/魔数、格式、架构、位数、端序、ABI/子系统、入口点、装载基址、时间戳线索、签名状态、工具版本和分析时间。
- 未确认授权时，只能做低风险元数据识别，不运行、不 patch、不脱壳、不提取秘密、不输出绕过路径。
- 涉及 token、私钥、证书、用户路径、账号、设备标识时，输出掩码、哈希或证据编号，不贴明文。
- 样本来自未知来源或疑似恶意时，默认隔离目录、无网络或受控网络、最小权限、只读挂载；先说明风险，再继续。
- 用户只给截图、文件名、目录名或“帮我看看这个 exe”时，先要求样本路径、授权范围和目标问题；不能靠扩展名下结论。

## 文件类型判断

- 先看魔数和容器，再看扩展名；扩展名只能做候选，不能做事实。
- 区分 raw executable、object、static library、import library、debug symbol、core dump、fat/universal、压缩包、安装器、自解压 stub、脚本包装层和资源文件。
- 交叉确认至少两类证据：file/xxd 魔数、readelf/objdump/otool/dumpbin、节区/段结构、导入导出、签名、字符串、资源或工具加载日志。
- 发现格式与扩展名不一致时，优先相信魔数和结构；报告里写明“扩展名声称”和“结构证明”。
- 无法识别时，不硬塞 ELF/PE/Mach-O；记录未知格式证据、熵、头部字节、容器线索和下一步需要的样本上下文。

## 强制流程

1. 样本建档：先固定哈希、来源、授权、工具版本和原始路径，避免后续证据漂移。
2. 格式结构：先看头、段/节、装载命令、导入导出、重定位、签名、资源和依赖，建立“能不能装载、怎么装载、依赖谁”。
3. 静态索引：strings、symbols、imports/exports、资源、错误码、日志文本、配置路径、URL、magic、常量表、证书和第三方库指纹。
4. 入口定位：entrypoint、main、init/fini、CRT startup、TLS callback、DllMain、导出函数、插件注册、回调表、异常处理入口。
5. 目标子图：围绕用户问题建立 CFG、调用图、xref、数据流、关键基本块、间接调用、source/sink 和失败路径。
6. 编译器产物归类：识别 MSVC/GCC/Clang/LLVM、Go/Rust/Swift/ObjC/C++ runtime、RTTI、vtable、panic/exception、thunk、tail call、inline、LTO/PGO、栈保护和 sanitizer 线索。
7. 崩溃证据归档：若任务涉及 crash/core/dump，记录触发输入、异常码/信号、fault address、寄存器、栈回溯、模块基址、符号匹配和样本哈希。
8. 结论分级：已验证、强推断、弱推断、无法验证分开写；每条结论绑定偏移、函数、基本块、字符串、导入、资源、工具输出、崩溃证据或截图编号。
9. 报告闭环：结论必须能被复核；剩余缺口、不可验证原因、转交边界、修复/缓解方向和禁止展开项都要收口。

## 场景执行卡

- 识别“这是什么文件”：先走文件类型判断、架构/ABI/端序、格式专属头部和装载结构；只给扩展名、截图、目录或 README 时，先补样本和授权问题。
- 找入口或关键逻辑：从 entrypoint/main/init/fini/DllMain/TLS callback/导出函数/字符串引用/导入 API 建根节点，再收敛到目标子图。
- 分析闭源库兼容：优先核对 ABI、调用约定、架构 slice、符号版本、导入导出、重定位、装载基址和依赖，不把源码层错误归到 binrev。
- 复核反编译结论：把伪代码返回到指令、基本块、xref、寄存器/栈/内存数据流和地址类型；变量名、类型和结构体布局都默认可错。
- 处理 stripped 或符号缺失：用导入、字符串、资源、常量、错误路径、函数大小、重定位、RTTI/vtable、pclntab、Swift/ObjC metadata 和库指纹恢复候选。
- 遇到壳、混淆或保护：只写识别证据、阻塞范围、静态结论降级和需要的授权补证；不要展开脱壳、绕过、补丁和规避检测。
- 复盘崩溃或兼容问题：先把 crash 地址映射回模块、基址、函数、基本块和输入条件；没有复现条件时只写可疑范围，不写确定漏洞结论。

## 架构、ABI 与端序

- 每次分析先确认 CPU、位数、端序、ABI、调用约定、浮点 ABI、对象格式变体和装载平台；错误架构会导致反汇编全错。
- ELF 关注 e_machine、EI_CLASS、EI_DATA、ABI、interpreter、relocation 类型和 symbol version。
- PE 关注 Machine、PE32/PE32+、Subsystem、calling convention、WOW64 线索、CLR header 和 ARM64EC/混合架构可能性。
- Mach-O 关注 fat/universal slices、CPU subtype、LC_BUILD_VERSION、平台、最小系统版本、Objective-C/Swift runtime 线索。
- 多架构样本必须按 slice/architecture 分别出证据；不能把 x86_64 的入口、arm64 的符号和通用资源混成一个结论。
- 端序不确定时，先用头字段、重定位、常量表和工具识别交叉确认；不要直接按本机端序读整数或结构体。

## ELF 要点

- 先区分 executable、PIE、shared object、relocatable object、core dump。
- 把 program header 和 section header 分开看；运行时映射以 PT_LOAD、PT_DYNAMIC、PT_INTERP、PT_TLS、GNU_RELRO、GNU_STACK 为准。
- 关注动态链接线索：DT_NEEDED、RPATH/RUNPATH、SONAME、PLT/GOT、relocation、symbol version、IFUNC。
- stripped 样本不要停止：用导入函数、字符串引用、常量、错误分支、syscall、日志路径、异常表、重定位和 CFG 建入口。
- Go/Rust/C++ 样本要先识别 runtime 边界，避免把 runtime 初始化、panic、allocator、模板实例化误判成业务逻辑。
- PIE/ASLR 样本要区分文件偏移、虚拟地址、运行时地址和重定位后地址；报告字段必须标明地址类型。
- 静态链接样本要先做库指纹和 runtime 归类，避免把 libc/libstdc++/Go runtime 当业务模块。

## PE 要点

- 先核对 Machine、Subsystem、Characteristics、ImageBase、entrypoint、section alignment、timestamp、checksum 和 Authenticode。
- 导入导出要结合 delayed import、forwarder、ordinal import、API set、manifest、COM/CLR header、PDB path 和资源版本信息。
- 入口前后区分 CRT startup、TLS callback、DllMain、service main、COM registration、installer stub、packed stub。
- 看安全与兼容线索：ASLR/DEP/CFG、SafeSEH、GS cookie、load config、签名、manifest requestedExecutionLevel、side-by-side 依赖。
- 不把 PDB 路径、资源公司名或 timestamp 单独当归因证据。
- DLL 先按导出函数、DllMain、TLS callback、COM 注册和服务入口拆开；不要只分析 AddressOfEntryPoint。
- .NET/CLR 样本只在 PE 包装层做识别；IL、混淆器、反射调用和托管逻辑深入分析应转交更合适技能或另开范围。

## Mach-O 要点

- 先识别 magic、fat/universal 架构、filetype、CPU subtype、PIE、LC_MAIN 或 LC_UNIXTHREAD。
- load commands 是主证据：LC_SEGMENT_64、LC_LOAD_DYLIB、LC_RPATH、LC_CODE_SIGNATURE、LC_DYLD_INFO、LC_FUNCTION_STARTS、LC_DATA_IN_CODE、LC_BUILD_VERSION。
- 对 Objective-C/Swift 样本，先看 class/protocol/selector、Swift metadata、mangled symbols、reflection 和桥接 runtime。
- 关注签名、entitlements、hardened runtime、notarization 线索，但不输出绕过签名或沙箱的步骤。
- universal binary 必须声明当前分析的是哪个 slice；跨 slice 差异要分别列证据。
- iOS/macOS 应用包中的 Info.plist、entitlements、资源和二进制主体要分层写；不要把包元数据当函数级证据。

## 反汇编与反编译入口

- 反汇编是证据底座；反编译只作为理解辅助。
- 函数边界、类型恢复、switch 恢复、间接调用、异常边、tail call、inline、栈变量和结构体布局都要准备被工具误判。
- IDA、Ghidra、Binary Ninja、radare2/Rizin、objdump/llvm-objdump、readelf、otool、dumpbin 之间结果冲突时，记录工具版本、基址、加载方式和手工判断。
- 关键路径必须回到指令、寄存器/栈/内存数据流、基本块跳转、xref 或最小动态证据。
- 不把“反编译里看起来像”写成定论；报告里标注伪代码片段对应的地址范围和原始指令证据。
- 反编译变量名、类型、结构体、数组长度、signedness、虚函数和 switch case 都默认可错；至少用多处读写、调用约定、常量边界或动态值校验。
- 工具自动创建的函数、不可达块和错误函数边界要用 xref、prologue、call target、异常表、函数表或手工拆分复核。

## CFG 与调用图

- 先为目标问题选根节点：entry/main、导出 API、可疑字符串引用、导入 API、资源处理函数、错误码分支、崩溃地址或补丁差异点。
- 调用图要标明直接调用、间接调用、虚表调用、回调注册、异常路径、线程入口、动态加载和反射/运行时分发。
- CFG 要关注条件分支、失败路径、权限检查、解析边界、长度校验、解密/解压前后、日志路径和错误返回。
- 对不可达判断保持保守：优化、异常边、回调、dlopen/LoadLibrary/dlopen-like 机制会隐藏真实路径。
- 只输出与问题相关的子图；全量巨图通常不可审计。
- 对间接调用、虚表、函数指针表、jump table、回调注册和反射/运行时分发，要写明解析依据和置信度。
- source/sink 必须绑定到实际输入来源、解析边界、状态条件和到达路径；不能只列危险 API。

## 字符串、资源与依赖

- strings 不是事实，只是索引。每个关键字符串都要找到引用函数、使用方式和可达路径。
- 资源要看 PE VERSIONINFO/manifest/icon/dialog/string table、Mach-O plist/entitlements/asset、ELF embedded config、压缩/打包资源和证书。
- URL、路径、注册表、权限名、日志 tag、错误文本、magic number、协议名、算法名和许可证文本都要区分“存在于样本”和“运行时会使用”。
- 第三方库归属要靠符号、字符串、版本文本、函数特征、导入依赖、许可证和编译器布局交叉确认。
- 高熵数据、压缩块、加密常量、证书和资源 blob 要先归类为“数据存在”，只有找到引用、解码路径或运行证据后才能写能力结论。

## 编译器与语言产物

- C/C++：关注 ABI、调用约定、name mangling、RTTI、vtable、exception tables、static constructors、模板膨胀。
- Go：识别 pclntab、moduledata、goroutine/runtime、panic 路径、interface dispatch，不把 runtime 调度当业务。
- Rust：识别 panic、trait object、monomorphization、mangled v0 symbols、bounds check、Result/Option 编译形态。
- Swift/ObjC：识别 selector、class metadata、Swift symbol、protocol conformance、ARC retain/release。
- .NET/CLR 或 JVM 字节码不作为 binrev 主场，除非只是 PE/Mach-O 包装层识别；深入交给更精确技能。

## strip、符号缺失与调试信息

- stripped、无 PDB、无 dSYM、无 DWARF、符号裁剪不是停止条件，只是置信度下降。
- 先用导入/导出、字符串 xref、资源引用、常量、错误路径、函数大小、调用扇入扇出、异常表、RTTI/vtable、pclntab、Swift/ObjC metadata、重定位和库指纹恢复候选模块。
- 有 PDB/dSYM/DWARF/map 文件时，记录符号文件哈希、匹配依据、GUID/build-id/UUID 和加载方式；不匹配的符号不能直接套用。
- 函数名来自符号、工具推断、人工命名还是用户给定，要在证据字段里区分。

## 混淆、壳与保护转交

- 疑似壳/混淆的识别证据包括：入口落在异常节区、高熵可执行节、导入极少、运行时解码、异常控制流、反调试字符串、TLS 先执行、节名异常、overlay 或自修改迹象。
- binrev 只写保护识别、阻塞范围、哪些静态结论不可靠、需要的授权和下一步证据；不写可复用脱壳、绕过、补丁或规避检测流程。
- 反混淆只允许做防御审计级归纳：控制流异常形态、字符串/导入延迟解析迹象、不可达块比例、间接跳转密度、符号/调试信息缺失对结论的影响。
- 若需要还原逻辑，只输出局部语义、证据编号和置信度；不输出可复用解混淆脚本、密钥提取路径、补丁点或保护绕过步骤。
- 若用户目标变成脱壳、反调试绕过、RASP/EDR 规避、商业保护规避或补丁点定位，停止 binrev 范围并要求重新确认合法授权和技能边界。
- 对 CTF/教学样本也要保持证据链写法；可以解释思路，但不把现实目标可复用绕过步骤包装成教学。

## 动态证据何时需要

- 默认静态优先。只有静态证据无法回答目标问题，或需要确认真实可达性、动态加载、解密/解压、配置拼接、回调顺序、崩溃现场、间接调用目标、环境触发差异时，才补最小动态观察。
- 动态观察优先无修改运行、日志、文件/注册表/系统调用/网络的受控记录；再考虑断点、trace、watchpoint 或内存快照。
- 动态证据必须记录环境、命令/交互摘要、输入、时间点、触发条件、观察值、地址映射和与静态地址的对应关系。
- 不运行未知高风险样本，除非授权、隔离和停止条件明确；不把单次运行现象当完整能力边界。

## 崩溃证据与可达性

- 崩溃分析先绑定样本 SHA256、输入样本或操作步骤、运行环境、命令摘要、异常码/信号、崩溃线程、fault address、寄存器、栈回溯和模块列表。
- 地址必须标明运行时地址、模块基址、RVA、文件偏移和重定位关系；ASLR/PIE/多 slice 未处理前，不把 crash 地址直接当文件偏移。
- 栈回溯要区分可靠帧、符号推断帧、栈损坏帧和第三方库帧；符号文件必须记录 GUID/build-id/UUID 和哈希匹配。
- 可达性结论至少需要输入来源、解析边界、条件分支、到达路径和最小动态观察；不能只凭崩溃存在宣称可利用。
- 防御报告只写影响、触发条件、受影响版本、最小复现摘要和修复/缓解方向；不写 exploit、ROP、shellcode、绕过 ASLR/DEP/CFG 或 weaponization 细节。

## 安全边界

- 可以分析：许可证校验的位置、输入输出、服务端参与度、本地缓存、错误路径、日志和安全影响。
- 必须避免：注册机、补丁点、绕过分支、密钥提取、商业保护规避、可复用脱壳教程、真实目标攻击链。
- 对保护/混淆/壳只写识别证据、影响范围、哪些结论被阻塞、需要什么授权补证。
- 对安全发现写可达性、触发条件、影响、置信度、受影响版本和最小修复/缓解方向；不要给武器化利用步骤。
- 许可证、授权、完整性、签名和防篡改相关分析只做防御审计和修复建议；不得输出绕过路径、补丁地址、密钥派生细节或可复用自动化。
- 普通开发任务不因出现 exe、dll、so、dylib、ELF、PE、Mach-O 文件名就触发 binrev；必须有明确二进制分析动作和样本证据。
- 普通源码审计、Web/API 安全测试、依赖升级、构建报错、符号链接错误、系统命令排障，优先交给对应开发、审计或运维技能。

## 反例库

- 把 entrypoint 当 main：入口常是 CRT、loader、stub 或壳。
- 把 strip 当无法分析：无符号时仍可用 imports、strings、xref、CFG、资源和动态最小证据。
- 把第三方库当业务逻辑：先做库指纹和编译器产物归类。
- 把反编译类型当真实类型：结构体、类和参数要靠读写偏移、调用约定和多处使用确认。
- 把高熵节区直接定性为加壳或恶意：还要看入口跳转、熵分布、导入异常、节属性和资源形态。
- 把签名存在当安全：签名只证明发布身份和完整性链索，不证明逻辑安全。
- 把单个字符串当能力：字符串必须有引用、路径和运行条件。
- 把时间戳当构建时间：可能被清零、伪造、复用或由链接器默认生成。
- 把架构猜错后继续分析：endianness、位数、ABI、slice、基址错了，后面偏移和伪代码都不可信。
- 把安装器、loader、stub、第三方 SDK 或 runtime 当核心业务：先归类，再追目标路径。
- 把“疑似混淆/壳”当万能解释：必须列阻塞证据和还能确认的事实。
- 把 crash 当 exploit：崩溃只证明异常发生；可达性、控制性、影响和修复证据要分开写，且不展开利用细节。
- 把运行时地址当文件偏移：PIE/ASLR、重定位、多架构 slice 和模块基址没对齐前，地址证据不能混用。
- 把导入危险 API 当漏洞：必须有调用路径、输入边界、状态条件和失败处理证据。

## 输出要求

交付时按证据强度写，不要只给结论：

- 样本档案：证据编号、文件名、SHA256、大小、来源、授权边界、格式、架构、位数、端序、ABI/子系统、签名、版本和时间戳线索。
- 工具与环境：工具名、版本、加载基址、地址类型、分析数据库名、隔离环境、分析时间和动态观察条件。
- 结构摘要：文件头、段/节、导入导出、符号、资源、依赖、入口、异常入口、调试信息和保护迹象。
- 目标路径：根节点、调用链、CFG 关键分支、字符串/资源引用、数据流、偏移、虚拟地址、文件偏移和置信度。
- 崩溃证据：异常码/信号、fault address、模块基址、RVA、栈回溯、寄存器摘要、触发输入、可达性和不可验证项。
- 结论分级：已验证、推断、无法验证；每项绑定证据编号。
- 风险与边界：影响范围、触发条件、兼容/安全/供应链意义、敏感数据处理、剩余缺口。
- 复核路径：如何用同一样本、同一工具版本和同一证据编号复核。
- 转交建议：当任务超出 binrev，写清触发原因、已确认事实、未确认项和不要继续展开的高风险内容。
- 闭环状态：回答最后给出已确认、未确认、需要用户补充、建议转交和安全禁止项，避免让结论悬空。

## 验证门禁

- 每个结论都能回到样本 SHA256、工具版本、地址类型、偏移/函数/基本块/字符串/导入/资源/日志/截图编号之一。
- 文件格式、架构、位数、端序、ABI、基址和 slice 未确认前，不做函数级或能力级结论。
- 反编译、strings、资源、PDB 路径、timestamp、签名和工具标签不能单独作为定论；至少要有结构、引用、路径或最小动态证据交叉确认。
- 动态观察必须记录环境、输入、触发条件、时间点、地址映射和停止条件；未知高风险样本默认不运行。
- 崩溃结论必须同时绑定样本哈希、输入/触发、异常现场、地址映射和符号匹配状态；否则只能写“疑似”或“待复核”。
- 输出前确认没有明文 token、私钥、证书、账号、设备标识、真实攻击路径、绕过步骤或可复用破解细节。

## 相邻技能边界

- 逆向工程总控/reverse-engineering（slug: rev）更适合逆向任务总控、授权核验、样本接收、证据链框架和多类型任务分流；通用二进制逆向（binary-reverse-engineering，兼容 slug: binrev）只在明确 ELF/PE/Mach-O 或通用二进制样本分析时执行。
- 壳、加固与保护识别逆向/packrev（slug: packrev）更适合壳、加固、保护和反调试识别专项；通用二进制逆向只记录保护迹象和降级影响，不做脱壳或绕过。
- 动态调试与运行时观察逆向/debug-reverse-engineering（slug: debugrev）更适合断点、单步、寄存器、内存、trace、崩溃现场和动态调试主导任务；通用二进制逆向只补最小动态证据。
- 移动端 Android/iOS 逆向/mobile-reverse-engineering（slug: mrev）更适合 APK/IPA、DEX/smali、Frida、移动运行时和移动加固；通用二进制逆向只处理移动包内 native so/dylib 的通用结构边界。
- 固件与 IoT 固件逆向/fwrev（slug: fwrev）更适合固件、Bootloader、裸机、RTOS、MCU、BSP/HAL 和镜像拆分；通用二进制逆向只分析其中已抽出的通用 ELF/PE/Mach-O 主体。
- 协议分析/protocol-analysis（slug: prot）或授权私有协议逆向/protrev（slug: protrev）更适合抓包、协议字段、签名算法、TLS pinning 和重放窗口；通用二进制逆向只把协议字符串或导入当二进制证据索引。
- 恶意样本防御逆向/malrev（slug: malrev）更适合恶意样本行为画像、IOC/YARA/Sigma、家族归因和运营交接；通用二进制逆向只做授权样本的结构和函数级证据分析。
- 补丁 Diff 与版本差异逆向/diff-reverse-engineering（slug: diffrev）更适合补丁前后二进制差分、函数匹配和版本回归；通用二进制逆向只在单样本结构分析或局部差异证据时使用。

## 自检

- frontmatter name 使用规范 canonical `binary-reverse-engineering`，兼容 slug 仍为 `binrev`。
- 正文没有 fenced code block，行数小于 500。
- 覆盖 ELF、PE、Mach-O、文件头、段节、符号、导入导出、反汇编/反编译、CFG、调用图、字符串、资源、编译器产物。
- 覆盖样本 intake、文件类型判断、架构/端序、strip/符号缺失、反混淆边界、混淆/壳转交、动态证据触发条件、崩溃证据和反编译误判。
- 每个高风险结论都有偏移、地址类型、函数/基本块、工具输出、日志、截图或动态证据编号。
- 已明确拒绝无授权、破解授权、绕过保护、凭据窃取、武器化利用和规避检测。
- 输出有报告闭环：已确认、未确认、复核路径、转交边界和安全禁止项齐全。
- manifest 触发必须是明确二进制样本 + 分析动作 + ELF/PE/Mach-O 或工具/证据语境；单独文件名、语言名、开发任务、安全泛问不能 must 触发。