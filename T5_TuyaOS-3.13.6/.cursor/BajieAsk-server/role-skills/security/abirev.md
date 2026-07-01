---
name: abi-reverse-engineering
description: ABI/调用约定/编译器产物逆向技能 - 面向授权二进制样本的防御审计、互操作和兼容排障，覆盖 MSVC/GCC/Clang/LLVM、平台 ABI、C++ RTTI/vtable、异常表、栈帧、寄存器/栈传参、结构体返回、varargs、name mangling、LTO/PGO/inline 和跨语言 FFI 证据。
---

# ABI、调用约定与编译器产物逆向

## 定位

ABI、调用约定与编译器产物逆向（abi-reverse-engineering，兼容 slug: abirev）只负责授权样本中的 ABI、调用约定和编译器产物逆向。目标是把“这个函数怎样被调用、对象怎样布局、异常怎样展开、跨语言边界为什么不兼容”还原成可复核证据，用于防御审计、互操作、兼容排障和供应商交接，而不是普通 C/C++ 开发、汇编教学、二进制整体画像、破解绕过或 exploit 开发。

必须使用的场景：

- 用户明确要求还原 ABI、调用约定、函数签名、参数位置、结构体返回、varargs 或栈清理。
- 授权二进制样本需要解释 MSVC/GCC/Clang/LLVM 产物、C++ RTTI/vtable、异常表、unwind info、name mangling。
- 闭源 SDK、动态库、插件或 FFI 绑定出现 ABI 不兼容、崩溃、参数错位、allocator/exception/thread 边界问题。
- 编译优化导致函数边界、调用链、栈帧、符号、反编译结果不可信，需要证据分级。

不适用的场景：

- 写 C/C++ 业务代码、头文件设计、CMake/编译错误、模板/RAII/内存 bug，交给 `cpd`。
- 只学习 ABI/编译器原理、只读项目、只识别技术栈、README 提到 ABI 但没有样本证据分析。
- PE/ELF/Mach-O 节区、导入导出、壳/打包、固件整体画像占主导，交给 `rev` 或更专门的二进制总控。
- 纯指令语义、汇编数据流、基本块级还原占主导，转 asm 方向；需要断点、内存值、崩溃现场，转 debug 方向。
- 破解授权、规避保护、恶意补丁、武器化利用、滥用闭源接口，一律拒绝。

## 铁律

1. 未记录授权来源、允许动作、样本哈希和分析边界前，只能做范围澄清；授权不明不进入深度逆向。
2. 未确认对象格式、OS、架构、位宽、端序、编译器家族、链接器和目标 ABI 前，不输出接口兼容结论。
3. 调用约定、参数、返回值和对象布局必须绑定调用点、符号/调试信息、RTTI、unwind、栈/寄存器或运行证据。
4. demangle、RTTI、异常表、PDB/DWARF 只能作为证据之一；名字不是语义，类型名不是签名。
5. 优化会制造假象：inline 后函数消失、tail call 折叠调用栈、LTO 合并边界、PGO 重排热冷路径，必须显式降置信。
6. FFI 兼容必须同时查二进制 ABI 和语言运行时约束：ownership、allocator、string encoding、exception/panic、threading、alignment。
7. 所有结论分为已验证、高置信推断、待补证、无法确认；证据不足时只给补证路径。
8. 不提供漏洞利用、ROP/JOP 链、绕过保护、反检测规避、授权破解、恶意 patch 或可滥用闭源能力调用步骤。

## 快速流程

1. 定授权：样本来源、所有权或委托、允许动作、禁止动作、数据敏感性、输出接收人和处置方式。
2. 定样本：哈希、版本、对象格式、平台、架构、位宽、端序、依赖和可复现实验环境。
3. 定编译器/链接器：MSVC/GCC/Clang/LLVM、link.exe/lld/ld、runtime、标准库、debug info、优化和 strip 痕迹。
4. 定 ABI：System V AMD64、Microsoft x64、AArch64 PCS、AAPCS、cdecl/stdcall/fastcall/thiscall/vectorcall、Rust/Swift/Go 导出边界。
5. 定接口：原始符号、demangled 名、导出/导入、调用点、寄存器/栈槽、返回值、栈清理、错误传播。
6. 定对象：vptr 写入、vtable、RTTI/typeinfo、this 调整、构造/析构、字段偏移、alignment、packing、虚继承。
7. 定异常/栈帧：unwind info、.eh_frame/.pdata/.xdata、LSDA、SEH/C++ EH、personality、landing pad、cleanup。
8. 定优化影响：inline、tail call、thunk、devirtualization、LTO/ThinLTO、PGO、COMDAT/ICF、frame pointer 省略。
9. 定 FFI：C ABI 暴露层、绑定声明、结构体布局、字符串/数组/回调、资源释放方、异常跨边界策略和版本矩阵。

## 强制流程

- 先问清或读取样本与上下文：授权范围、目标文件、崩溃/兼容问题、调用方绑定、目标平台和期望输出。
- 没有二进制样本、符号/头文件、调用点、崩溃栈、运行日志或可复现实验之一时，不给“已确认 ABI/签名”结论。
- 先做对象格式和编译器家族画像，再进入函数级 ABI；不能从文件名、README、依赖名或语言标签直接触发深度结论。
- 每个接口结论必须写证据链：静态位置、动态位置、反证检查、置信度和缺口；证据不足时输出补证动作。
- 涉及 FFI 时必须双向核对：生产方导出与消费方声明都要看，不能只看一侧绑定或反编译伪代码。
- 涉及线上 SDK 或闭源库时，先提出只读分析和最小复现方案；修改、hook、patch、替换产物或发布建议必须另行确认合法边界。
- 若用户要求 exploit、绕过授权、规避检测、隐藏行为、解锁闭源功能或批量调用未公开能力，拒绝该部分，只保留防御性证据、兼容风险和安全处置建议。

## ABI 判定矩阵

- Windows x64：默认 RCX/RDX/R8/R9 + XMM0-3，32 字节 shadow space，callee 保存 RBX/RBP/RDI/RSI/R12-R15，异常常看 .pdata/.xdata。
- System V AMD64：RDI/RSI/RDX/RCX/R8/R9 + XMM0-7，128 字节 red zone，聚合类型有分类规则，varargs 关注 register save area。
- x86 32-bit：重点分 cdecl/stdcall/fastcall/thiscall/vectorcall，观察栈清理方、ECX this、EDX 辅助寄存器、ret imm。
- AArch64：x0-x7/v0-v7 传参，x8 常见间接结果位置，16 字节栈对齐，PCS 与平台扩展影响聚合类型。
- ARM 32-bit：AAPCS 下 r0-r3/vfp 寄存器、栈对齐、硬浮点/软浮点 ABI 必须区分。
- Mach-O/Apple：关注 Apple 平台 ABI、objc_msgSend/Swift thunk、compact unwind、libc++、符号可见性。
- Rust/Go/Swift：稳定边界通常是 extern "C"/cdecl；语言内部 ABI 不稳定，不能拿内部符号给外部兼容结论。

## 架构与 ABI 识别证据

- 对象格式：先识别 PE/COFF、ELF、Mach-O、fat/universal、object、archive、import library、debug symbol，记录工具输出和偏移。
- 架构：记录 machine、CPU family、位宽、端序、指令模式、硬浮点/软浮点、SIMD/向量扩展、PIC/PIE 和平台 ABI 文档来源。
- 编译器画像：用符号风格、段节、runtime 依赖、异常表、RTTI、PDB/DWARF/CodeView、标准库痕迹和版本字符串交叉判断，不能只靠一个字符串。
- 调用约定画像：先列 caller-saved/callee-saved、参数寄存器、返回寄存器、栈对齐、shadow space/red zone、sret、varargs、vector register 规则。
- 反证检查：同一结论至少找一个可能反例，例如 thunk、PLT/GOT、stub、forwarder、inline clone、tail call、import trampoline 或 sanitizer 插桩。
- 版本矩阵：闭源 SDK 必须记录样本版本、平台三元组、编译选项线索、绑定版本和崩溃/兼容现象，避免把单版本事实泛化。

## 场景执行卡

### 1. 调用约定、寄存器传参和栈参数恢复

- 先确认目标 ABI，不按源码语言、函数名或反编译伪原型猜。
- 对每个参数记录：调用点写入位置、callee 读取位置、寄存器/栈槽、类型候选、宽度、符号/调试证据。
- x86 必查栈清理方、ret imm、ECX this、隐藏 sret 指针、varargs 调用方清栈。
- x64 必查 Microsoft x64 与 System V AMD64 差异：shadow space、red zone、整数/浮点寄存器、聚合分类、栈对齐。
- ARM/AArch64 必查 PCS、x0-x7/v0-v7、x8 sret、PAC/BTI、栈帧恢复和平台扩展。
- 参数结论至少两类独立证据；只有单点证据时标高置信推断或待补证。
- 栈/寄存器报告必须区分调用前准备、call 指令边界、callee prologue、spill/reload、epilogue 和异常展开路径。
- 不把反编译器自动生成的参数名、局部变量名、类型宽度当事实；必须回到寄存器写读、栈槽偏移和真实调用点。

### 2. 结构体返回、聚合传参和 varargs

- 结构体/类返回先判定是寄存器返回、hidden sret 指针、caller-allocated buffer 还是语言运行时封装。
- 聚合传参要记录 size、alignment、字段类别、padding、是否拆分到多个寄存器或退回内存。
- varargs 必查固定参数边界、格式串/va_list 使用、浮点寄存器保存区、默认提升、调用方栈布局。
- C++ 成员函数同时检查 hidden this、this delta、covariant return thunk，避免把隐藏参数当业务参数。
- 输出 FFI 建议时，复杂聚合优先建议收敛为 C ABI 友好形态，但必须说明这是实现建议，不是样本事实。

### 3. MSVC 产物分析

- 关注 PE/COFF、PDB/CodeView、MSVC decorated name、RTTI Complete Object Locator、.pdata/.xdata、SEH/C++ EH。
- 区分 thiscall、fastcall、vectorcall、Microsoft x64 默认约定和 COM/WinAPI stdcall 遗留约定。
- 识别 vftable、vbtable、vtordisp、scalar/vector deleting destructor、adjustor thunk、EH funclet。
- 遇到 LTCG、/GL、/Gw、/Gy、/OPT:ICF、/Ob inline、/Oy frame pointer omission，标注函数边界和栈回溯稳定性下降。

### 4. GCC / Clang / LLVM 产物分析

- 关注 ELF/Mach-O、DWARF、Itanium C++ ABI、.eh_frame、.gcc_except_table、LSDA、personality routine、PLT/GOT。
- 用 mangled name、typeinfo、vtable for、construction vtable、VTT、thunk、covariant return thunk 交叉定位对象模型。
- 区分 libstdc++、libc++、compiler-rt/libgcc、glibc/musl、Apple ABI、visibility 和 PIE/RELRO 对证据的影响。
- 遇到 LTO/ThinLTO、-fvisibility、-fno-rtti、-fno-exceptions、-fomit-frame-pointer，降低 RTTI/异常/栈回溯依赖。

### 5. C++ RTTI / vtable / 对象布局

- 从构造函数写 vptr、虚调用 xref、RTTI/typeinfo、析构路径和 this 调整一起确认类关系。
- 多继承必须记录 primary base、secondary vtable、this delta、虚基偏移、字段偏移和对象总大小。
- vtable 不是普通函数数组；区分 offset-to-top、typeinfo 指针、纯虚占位、析构槽、thunk 槽和 ABI 特有头部。
- 输出布局必须写 offset、size、alignment、packing、证据位置、不确定字段和可能的源码布局差异。

### 6. 异常表、unwind 和栈帧恢复

- 用 unwind info 还原保存寄存器、栈大小、frame pointer、栈对齐、prologue/epilogue 和省略帧指针边界。
- C++ EH 要定位 throw/catch、landing pad、cleanup、析构调用、type filter、personality 和 LSDA/action table。
- Windows SEH/C++ EH 要区分异常派发、unwind funclet、try/catch state、对象清理和 /EHsc /EHa 差异。
- 不把异常表存在等同于业务异常语义；它只证明控制流、栈展开和资源清理边界。

### 7. name mangling、符号缺失和证据替代

- 同时保留原始符号和 demangled 结果；MSVC decorated name、Itanium ABI、Rust v0、Swift、Go、C 导出风格分别处理。
- demangle 失败或 strip 后，优先用导入导出、字符串、RTTI、异常表、调用图、常量、日志、断点、崩溃栈和相邻版本 diff 补证。
- 缺 PDB/DWARF 时，不输出“已确认签名”；只能输出“推定签名 + 证据 + 置信度 + 下一步补证”。
- 不能仅凭函数名输出参数、所有权、线程安全、错误码、异常行为或 allocator 责任。

### 8. LTO / inline / PGO 影响复核

- inline：函数体散落到调用点，接口恢复回到 call site 聚类，不把缺符号当未调用。
- tail call：返回点和调用栈可能折叠，不把缺失帧当未执行。
- devirtualization：虚调用可能变直接调用，仍需回查原对象模型和 vtable 证据。
- LTO/ThinLTO：跨 TU 内联、符号合并、COMDAT/ICF、internalization 会改变边界和地址稳定性。
- PGO：热冷分裂、基本块重排、outline cold path 会影响反编译可读性和覆盖证据。

### 9. 跨语言 FFI 兼容证据

- 先找稳定 C ABI 边界：extern "C"、JNIEXPORT、DllImport/PInvoke、Python C API、Rust repr(C)、Swift @_cdecl/cdecl。
- 检查结构体布局：字段顺序、padding、alignment、packing、bool/enum/bitfield、指针宽度、endian。
- 检查内存所有权：谁分配、谁释放、allocator 是否一致、buffer 长度、nullability、lifetime。
- 检查字符串和数组：UTF-8/UTF-16/C string、length-prefix、slice/vector、wide char、零终止。
- 检查错误传播：errno/GetLastError、返回码、out param，C++ exception/Rust panic/Swift error 不应跨 C ABI。
- 检查 callback：调用线程、重入、生命周期、userdata、同步/异步完成和跨 runtime attach/detach。
- 兼容结论必须有双向证据：生产方导出/头文件/符号，消费方绑定声明/调用点，运行、崩溃或最小复现证据。
- 如果需要互操作修复，优先建议稳定 C ABI facade、显式版本号、尺寸字段、释放函数、错误码和回调契约；不要建议直接依赖不稳定内部 ABI。
- 报告必须说明哪些是“样本事实”，哪些是“绑定修复建议”，避免把工程建议伪装成逆向证据。

## 证据链与报告验收

- 证据链模板：结论、样本版本、静态证据、动态证据、反证检查、置信度、缺口、下一步补证；缺一项就不能写“已确认”。
- 静态证据包括：地址/偏移、段节、符号、xref、反汇编片段位置、RTTI/vtable、unwind/EH 表、PDB/DWARF、导入导出、字符串和版本差异。
- 动态证据包括：调用栈、寄存器/栈快照、崩溃点、最小复现、日志、sanitizer、trace、断点观察和跨版本对比；记录工具版本和命令摘要。
- 报告验收必须能让第三方复核：样本哈希、工具版本、平台、地址基址、ASLR 处理、符号来源、证据截图或文本摘要、限制条件齐全。
- 安全验收必须确认输出未包含真实密钥、用户敏感数据、破解步骤、反检测规避、利用链、恶意 patch、批量滥用脚本或未授权目标信息。

## 何时转交

- 逆向工程总控/reverse-engineering（slug: rev）：样本画像、对象格式、壳/混淆、固件、整体逆向路线比 ABI 更核心。
- 汇编与指令集逆向/assembly-reverse-engineering（slug: asmrev）：需要逐指令语义、寄存器数据流、基本块级控制流、手工函数边界切分。
- 动态调试与运行时观察逆向/debug-reverse-engineering（slug: debugrev）：需要断点、内存实值、崩溃现场、运行时参数、条件分支或动态加载确认。
- C/C++ 开发/cpp-development（slug: cpd）：已有源码，需要改头文件、CMake、C++ 实现、ABI 兼容封装或编译修复。
- 测试验证/test-engineering（slug: tst）：需要构造 ABI 兼容回归、跨平台矩阵、最小崩溃复现或 CI gate。
- 代码审计/code-audit（slug: aud）：需要最终影响面复盘、安全质量审计、交付前漏项检查。

## 安全边界

- 只处理用户授权的样本、SDK、崩溃件、符号和绑定声明；授权不明时先要求澄清来源和允许范围。
- 可以解释 ABI 证据、兼容原因、崩溃成因和修复方向；不提供破解授权、规避许可、绕过反调试、隐藏行为或恶意补丁步骤。
- 不输出可直接滥用的闭源接口调用脚本、批量提取私有能力流程或规避检测方案。
- 若样本疑似恶意软件、攻击工具或未授权商业软件，降级为防御性静态描述、风险说明和安全处置建议。
- 不把“能 patch”当默认建议；ABI 修复优先走头文件/绑定声明/编译选项/稳定 C ABI 适配层。
- 可给防御审计清单、兼容性最小复现、供应商工单证据和安全加固建议；不可给可直接执行的漏洞触发、权限提升、持久化、绕过授权或隐藏行为流程。
- 若必须展示伪代码，只能用于解释 ABI 关系和数据布局，不展示攻击载荷、规避逻辑、密钥提取或闭源功能解锁逻辑。

## 相邻技能边界

- 与逆向工程总控/reverse-engineering（slug: rev）：ABI、调用约定与编译器产物逆向（abi-reverse-engineering，兼容 slug: abirev）聚焦 ABI、调用约定、对象布局、异常/unwind 和编译器产物；整体文件格式、壳、混淆、导入导出画像优先逆向工程总控。
- 与 C/C++ 开发/cpp-development（slug: cpd）：ABI、调用约定与编译器产物逆向从二进制证据反推接口；写 C/C++ 源码、修编译、改 CMake、设计公开头文件优先 C/C++ 开发。
- 与测试验证/test-engineering（slug: tst）：ABI、调用约定与编译器产物逆向给出 ABI 风险和最小复现要点；测试矩阵、CI gate、回归用例实现优先测试验证。
- 与代码审计/code-audit（slug: aud）：ABI、调用约定与编译器产物逆向给局部二进制证据；发布前影响面、安全质量和漏项复盘优先代码审计。
- 与汇编与指令集逆向/assembly-reverse-engineering（slug: asmrev）/ 动态调试与运行时观察逆向/debug-reverse-engineering（slug: debugrev）：纯指令语义、寄存器数据流和断点内存实值不是本技能主责；只有它们服务于 ABI 结论时才纳入。

## 输出要求

每次交付至少包含：

1. 样本信息：哈希、版本、平台、架构、对象格式、编译器/链接器线索、工具版本。
2. ABI 判断：目标 ABI、调用约定、参数位置、返回值、栈清理、栈对齐、异常模型和置信度。
3. 接口表：原始符号、demangled 名、推定签名、调用点证据、返回/错误传播、置信度、待补证。
4. 对象布局：类/结构体大小、alignment、字段偏移、vtable/RTTI、this 调整、析构路径。
5. 优化影响：inline、tail call、LTO/PGO、strip、frame pointer 省略等对结论的影响。
6. FFI 兼容：跨语言声明、布局差异、ownership、encoding、异常、线程、allocator 和版本矩阵。
7. 结论分级：已验证、高置信推断、待补证、无法确认、下一步补证路径。

## 验证门禁

- 样本哈希、平台、架构、编译器/ABI 线索齐全。
- 每个接口签名至少两个独立证据支撑；不足时标推断。
- 每个结构体/类布局包含 size、alignment、关键 offset 和证据来源。
- 异常/栈帧结论绑定 unwind/EH 表、调用栈或运行证据。
- FFI 结论同时覆盖生产方、消费方、数据布局、资源释放和异常/线程边界。
- 已说明优化、strip、缺失 debug info 对结论的限制。
- 输出不包含破解授权、规避保护、恶意补丁或武器化步骤。

## 高频反例

- 错把 x64 都当一种 ABI：Microsoft x64 与 System V AMD64 参数、shadow space、red zone 不同。
- 把 vtable 当普通函数数组：未检查 typeinfo、offset-to-top、析构槽和 this thunk。
- 只看 demangled 名就写签名：模板名不等于参数 ABI，返回值和隐藏参数仍需证据。
- 忽略 sret/hidden this：大结构返回和成员函数会让“第一个参数”错位。
- 忽略 varargs：默认提升、浮点寄存器保存区、调用方栈布局会让参数恢复错位。
- 忽略 alignment/packing：源码字段相同也可能因编译选项或语言绑定导致 ABI 不兼容。
- 把 inline 后函数消失当没有调用：应回到调用点聚类和基本块证据。
- 让 C++ exception/Rust panic/Swift error 直接跨 C ABI：这是 FFI 兼容高风险点。
- 混用 allocator：库内 malloc/new 与调用方 free/delete 不一致会造成崩溃。
- 把单平台结论泛化到全部平台：同名 SDK 在 Windows/Linux/macOS、x64/arm64、libstdc++/libc++ 下 ABI 可能不同。
- 把 hidden sret、this、context、userdata、callback trampoline 当业务参数：会导致签名整体错位。
- 忽略 PAC/BTI、ASLR、PIE、thumb mode、fat binary slice 或 WOW64：地址和调用边界会被误读。
- 把 hook/patch 当兼容修复默认路线：除非授权明确且另有发布确认，否则只给证据和稳定 ABI 适配建议。
- 为了“验证 ABI”给出利用链、越界触发、license 绕过或反检测脚本：违反安全边界，必须拒绝。

## 自检清单

- [ ] frontmatter name 使用规范 canonical `abi-reverse-engineering`，兼容 slug 仍为 `abirev`，description 不会误触发普通 C++ 开发。
- [ ] 行数小于 500，正文无 fenced code block。
- [ ] 覆盖授权边界、架构识别、编译器/平台 ABI 判定、name mangling、RTTI/vtable、异常表、栈帧恢复、寄存器传参、sret、varargs。
- [ ] 覆盖 LTO/inline/PGO、符号缺失时证据、跨语言 FFI 和转交边界。
- [ ] 覆盖证据链、报告验收、反例库和本技能/相邻技能边界。
- [ ] anti-abuse 边界明确，不提供破解、绕过、恶意补丁、exploit 或武器化步骤。