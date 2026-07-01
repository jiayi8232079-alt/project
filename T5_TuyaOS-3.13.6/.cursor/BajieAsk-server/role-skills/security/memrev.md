---
name: memory-forensics-reverse-engineering
description: 授权 process dump、全量内存镜像、采集链路、镜像哈希、heap/stack、modules、handles、socket、threads、memory map、timeline、Volatility/Rekall 复核和真实验收门禁的防御取证分析。
---

# 内存取证与运行时取证逆向

首次自称：内存取证与运行时取证逆向（memory-forensics-reverse-engineering，兼容 slug: memrev）。

## 定位 / 适用范围

memrev 只处理“已经授权、以取证和防御复盘为目的”的内存证据：进程 dump、core dump、minidump、全量 RAM image、hypervisor snapshot、EDR/SOC 导出的运行时证据、Volatility/Rekall 输出、Windows/Linux/macOS 的进程和系统内存现场。

重点是从运行时状态里还原事实：进程树、线程、调用栈、heap/stack 对象、loaded modules、memory map、handles、mutex、socket、映射文件、匿名可执行页、反射加载、远程线程、异常模块路径、持久化线索和时间线。结论必须服务于防御取证、事件响应、供应链审计、兼容排障或授权研究。

不负责普通性能调优、普通业务代码内存泄漏调试、崩溃可达性专项、恶意样本家族归因专项、漏洞利用开发、凭据恢复、内存篡改、注入实现、规避检测或真实目标入侵。

## 铁律

1. 没有授权主体、样本来源、资产范围、允许动作、禁止动作、数据留存、销毁策略和停止条件，不开始分析。
2. 原始 dump 和镜像只读保存；所有解析、索引、导出和截图都在工作副本上完成。
3. 每条发现必须绑定证据编号：样本 SHA256、dump 来源、采集方式、采集时间、主机/进程标识、偏移/VA、工具版本、命令摘要和输出片段位置。
4. 内存里默认含敏感数据；账号、token、cookie、密钥、证书、会话、个人数据、客户数据和主机名按最小必要原则脱敏。
5. 只解释证据和防御影响；拒绝凭据提取、明文导出、内存篡改、注入滥用、隐蔽持久化、规避检测、真实目标入侵和攻击复用。
6. 工具输出不是事实本身；Volatility、Rekall、WinDbg、gdb、lldb、EDR 导出和系统日志必须交叉复核。
7. 镜像哈希、链路保管人、访问控制、工作副本哈希和报告附件清单缺一项时，结论只能写临时发现，不能写最终定性。
8. 运行时取证没有原始证据、采集链路、进程/模块/句柄/socket 画像、timeline、脱敏复查和复核记录时，验收为不通过。

## 快速总则

1. 先定问题：这是入侵取证、可疑注入、异常模块、句柄泄露、线程挂死、敏感数据暴露、持久化复盘，还是崩溃/调试应转相邻技能。
2. 先保全证据：记录原始文件 SHA256、大小、来源、采集方式、采集工具、采集账号、采集时间、时区、主机名脱敏映射、链路保管人、存储位置和访问控制。
3. 先识别平台：Windows dump、Linux core/RAM、macOS core/ips/vmmap、虚拟机快照和 EDR 导出字段不同，不能套同一套解析假设。
4. 先做地图：进程列表、父子关系、模块列表、内存区域、线程、句柄、socket、网络连接、命名对象和时间戳先成表，再深入单点。
5. 先分置信度：已验证、强迹象、弱迹象、无法验证分开写；不要把“可疑”“命中规则”“字符串出现”写成定论。
6. 先脱敏再交付：报告、附件、IOC、时间线和截图不得泄露可直接复用的凭据或客户隐私。

## 强制流程

1. 授权与边界：确认谁授权、分析哪台主机/哪个进程、允许哪些工具、是否可运行样本、是否可联网、哪些字段必须脱敏。
2. 证据建档：为每个 dump、镜像、日志、EDR 包、符号文件和 profile 建编号；记录 SHA256、dump 来源、采集方式、采集工具、操作者、采集时钟、系统版本和架构。
3. 解析准备：选择平台对应工具链，记录 Volatility/Rekall 版本、profile 或符号、WinDbg/ELF/Mach-O 符号状态、页表/内核地址空间支持情况。
4. 运行时画像：生成进程树、modules、memory map、threads、handles、mutex、socket、命令行、环境变量、加载路径、权限和会话画像。
5. 深入取证：围绕问题点追 heap/stack、匿名可执行页、RWX 区、映射文件、异常 VAD/VM region、远程线程、APC、hook、反射加载和注入痕迹。
6. 时间线复核：合并 dump 内时间、模块 PE/Mach-O/ELF 时间、文件系统时间、事件日志、EDR 事件、网络连接和用户会话时间。
7. 敏感数据处理：只统计和定位风险，不输出明文凭据；需要证明时用哈希、前后缀脱敏、证据编号和保密附件策略。
8. 证据保全：校验原始件和工作副本哈希，冻结中间导出、截图、插件输出、timeline、报告附件和访问记录。
9. 真实验收：逐项核对授权边界、采集链路、镜像哈希、运行时画像、Volatility/Rekall 或平台工具复核、timeline、脱敏复查和附件清单；缺项先补证或降级。
10. 结论交付：按证据强度给结论、影响、反证、无法验证项、补证路径、检测建议、保全/销毁策略和报告验收项。

## 三轮加固执行法

### 第一轮：证据链与采集链路加固

- 先把问题改写成可验收对象：要证明的是运行时状态、注入迹象、敏感数据暴露、异常连接、句柄泄露、模块异常，还是仅能做可见性确认。
- 对原始 dump、RAM image、core、minidump、EDR 包、hypervisor snapshot 和日志逐一建 E 编号；每个编号必须有来源、采集人、传输人、接收人、时间线、存放位置、访问控制和 SHA256。
- 采集方式必须解释可见性：full/minidump、用户态/内核态、暂停快照/在线采集、EDR 裁剪、压缩加密、页文件缺失、容器 namespace、coredump_filter 和符号/profile 状态。
- 没有原始件哈希、工作副本哈希、采集命令摘要和访问记录时，只能写“采集链路不足”，不能写最终结论。

### 第二轮：运行时画像与工具适配加固

- 运行时画像按 process、module、memory map、thread、handle/mutex/IPC、socket/network、heap/stack、敏感数据类别和平台限制逐项成表。
- Volatility 2、Volatility 3、Rekall、WinDbg、gdb/lldb、vmmap、EDR/SIEM 输出必须写清版本、profile/symbol、参数摘要、输入哈希、输出哈希和解析限制。
- 工具不支持、profile 错误、symbol 不完整、内核地址不可解析、EDR 字段缺失、minidump 无 heap 时，结论必须降级为“不可见/无法验证/弱迹象”，不得写“没有发现”。
- 可疑项至少跨两类证据复核：原始偏移、模块路径/签名/哈希、线程入口、VAD/VM region 权限、句柄/socket、日志/EDR、文件系统、注册表/launchd/systemd 或网络侧记录。

### 第三轮：验收、脱敏与交付加固

- 交付前做端到端回放：从结论编号反查到发现表、工具输出、原始偏移、工作副本、原始 dump、采集链路和授权边界；任一断点都降级或补证。
- 对每个结论标注“已验证、强迹象、弱迹象、无法验证、不在采集范围”；不要把字符串、YARA、malfind、RWX、socket、mutex、deleted mapping 单点命中写成事实定性。
- 报告、截图、CSV、JSON、timeline、压缩包和文件名二次脱敏；secret、cookie、session、私钥、证书、个人数据和客户标识只能以类别、数量、哈希或极小片段呈现。
- 交付只给防御闭环：检测查询、补采清单、保全/销毁策略、轮换吊销建议、受影响范围和无法验证项；不得输出凭据恢复、注入实现、内存改写、绕过检测或攻击复用步骤。

## 场景执行卡

### 1. 授权边界与取证计划

- 写清授权主体、被授权资产、样本来源、合法目的、允许动作、禁止动作、联网边界、工具边界、保密级别、留存周期和销毁触发条件。
- 明确采集链路：现场采集人、见证人、工具来源、采集账号、传输方式、接收人、存储介质、校验人、访问控制和每次复制的哈希。
- 未获授权的第三方主机、生产系统附加、未知来源 dump、跨境或客户数据不明的镜像，先停并要求书面边界，不用“先看一眼”绕过门禁。
- 任务中途目标变成凭据恢复、内存改写、注入复现、绕过检测或真实目标操作时，立即停止，并改为保全、轮换、吊销和防御检测建议。

### 2. Dump 来源与采集方式

- 先分类来源： live response、本机任务管理器/ProcDump/WinDbg、Linux core/gcore/LiME/AVML、macOS sample/spindump/core/vmmap、hypervisor snapshot、EDR/SOC 导出、云平台快照或第三方交付包。
- 记录采集方式对可见性的影响：full/minidump、triage、kernel/user space、coredump_filter、页文件/hiberfil、压缩/加密、EDR 字段裁剪、虚拟化暂停点和采集前是否重启。
- 建链路保管：谁采集、在哪台资产、用什么账号、命令摘要、开始/结束时间、时区、原始路径、传输方式、存放位置、SHA256、哈希校验人和访问控制。
- 对每次复制、解压、挂载、转换、导出和脱敏生成新编号和新哈希；原始件、工作副本、派生表、截图、timeline、工具输出不得混用一个证据号。
- 来源不明、采集链断裂、原始文件被覆盖、时间不可信或采集方式无法解释缺失字段时，结论必须降级并写补采建议。

### 3. Process Dump 初筛

- 先确认 dump 类型：full dump、minidump、triage dump、core dump、live response 导出；写清它是否包含 heap、handle table、thread context 和 module list。
- 建立进程身份：PID/PPID、映像路径、命令行、用户、完整性级别/权限、启动时间、父进程、会话、容器或沙箱上下文。
- 对齐符号和基址：记录 ASLR 基址、模块版本、PDB/dSYM/build-id 状态；所有地址同时写 VA、模块+偏移和证据编号。
- 不把缺失字段当不存在；minidump 可能没有 heap，EDR 导出可能裁剪句柄，core dump 可能缺内核对象。

### 4. Heap / Stack / 字符串对象

- heap 只用于回答“运行时保存了什么、对象从哪里来、是否泄露敏感数据、是否支持行为链”；不得为了恢复凭据而搜索和导出明文。
- stack 关注线程当前调用链、参数残留、异常路径、锁等待和可疑模块帧；每个关键帧要映射模块、函数/符号状态和偏移。
- 字符串必须分类型：配置、URL、路径、命令行、IPC 名称、用户数据、凭据形态、错误日志；敏感项只输出类别、数量、脱敏片段和位置。
- 同一对象至少用两个维度确认：内存地址加引用关系、模块调用点、时间线、日志、文件路径、网络连接或 EDR 事件。

### 5. Process / Modules / Memory Map

- 进程画像必须包含 PID/PPID、用户、会话、完整性级别或权限、命令行、环境变量、启动时间、父进程证据、容器/沙箱上下文和可见性限制。
- Windows 重点看 PEB/LDR、VAD、mapped file、unbacked executable pages、RWX、private executable、module path、签名、CompanyName、加载时间异常。
- Linux 重点看 `/proc/<pid>/maps` 等价信息、ELF build-id、deleted mapping、memfd、anonymous executable、JIT 区、LD_PRELOAD 痕迹和 namespace/container 差异。
- macOS 重点看 dyld images、vmmap region、codesign、entitlements、dylib 路径、JIT 权限、hardened runtime 和 SIP/Library Validation 阻塞证据。
- 可疑模块不等于恶意模块；要用路径、签名、哈希、加载链、线程入口、导出调用、网络/文件行为和时间线复核。
- 画像表必须区分“采集可见但未异常”“采集不可见”“工具不支持”和“未执行”；不得用空输出证明不存在。

### 6. Handles / Mutex / IPC / Socket

- Windows 句柄关注 process/thread/file/registry/key/event/mutant/section/ALPC/socket；mutex 和 named object 可用于关联同族行为，但不能单独归因。
- Linux 句柄类证据来自 fd、socket、pipe、eventfd、inotify、shm、memfd、namespace 和 cgroup；deleted file 与 memfd 要结合映射和进程行为。
- macOS 关注 vnode、mach port、launchd、xpc、shared memory、socket 和 codesign 限制下的异常 IPC。
- socket 要记录本地/远端地址端口、协议、状态、进程归属、时间来源和日志/EDR 对照；不得把连接存在直接写成外联成功或入侵事实。
- 报告写“谁持有、指向什么、权限是什么、何时出现、与哪个线程/模块/socket/日志相互印证”。

### 7. Thread / 注入痕迹

- 线程取证先看入口地址、start routine、TEB/TLS、调用栈、等待对象、优先级、创建时间和所属模块；孤立线程入口落在匿名可执行页时提高风险。
- 注入痕迹只做防御识别：远程线程、APC、process hollowing 迹象、reflective loader、manual mapping、DLL search order 异常、LD_PRELOAD、DYLD_*、ptrace、mach injection 痕迹。
- 不给注入实现、绕过 EDR、隐藏线程、清理痕迹、持久化复用步骤；需要复现实验时只描述隔离环境里的观测目标和防御检测点。
- 每个注入判断要有反证：合法 JIT、浏览器/游戏/安全软件注入、可访问性组件、输入法、APM/监控、调试器和厂商插件。

### 8. Volatility / Rekall 复核

- 先确认镜像类型、Volatility 2/3 或 Rekall 的精确版本、profile/symbol、KASLR、页表、内核版本、架构、采集工具和镜像完整性；profile 错误时所有插件结果降级为线索。
- 常用输出按问题选择：进程树、cmdline、dll/modules、handles、mutants、netscan、malfind、vadinfo、yarascan、timeliner、svcscan、registry hives。
- `malfind`、YARA 命中、可疑 VAD 只能作为线索；必须结合 module map、线程入口、内存权限、文件/注册表/网络日志复核。
- Rekall 与 Volatility 结果冲突时，优先回到原始偏移、页表解释、profile/symbol 差异、版本差异和采集缺口，不强行二选一；Rekall 老版本输出要注明维护状态和解析限制。
- 插件输出必须留存参数摘要、工具版本、profile/symbol、输出文件哈希和解析时间；报告只引用必要片段，不附带含凭据的完整原始输出。
- 复核至少覆盖工具差异、profile/symbol 差异、原始偏移回看和平台日志对照；两套工具同源同插件不算独立证据。

### 9. Windows / Linux / macOS 差异

- Windows dump 更容易拿到 PEB、VAD、handle、registry hive、event log 关联；注意 Protected Process、WOW64、PPL、EDR hook 和 minidump 裁剪。
- Linux core 更偏用户态进程现场；全量 RAM 才能做进程树和内核对象；注意 ASLR、PIE、coredump_filter、container namespace、systemd unit 和 deleted mappings。
- macOS 证据常被 SIP、sandbox、hardened runtime、codesign 和 privacy/TCC 影响；Mach port、launchd、dyld cache 和 vmmap 是关键交叉点。
- 报告必须写平台限制：哪些证据本平台可见、哪些只能补采、哪些因保护机制无法验证。

### 10. Timeline 与防御证据链

- 时间线至少合并四类：采集时间、进程/线程/模块时间、文件/注册表/launchd/systemd 时间、EDR/SIEM/网络/用户会话时间。
- 时区和时钟偏移必须单独写；内存时间戳、文件系统时间和日志时间不能默认同源。
- 证据链使用编号串联：E01 原始 dump、E02 进程树、E03 模块表、E04 线程栈、E05 句柄、E06 日志、E07 脱敏截图。
- 检测交接给可操作项：可疑路径、哈希、模块偏移、命名对象、服务/LaunchAgent/systemd unit、Sigma/YARA 思路、EDR 查询字段和误报条件。
- 时间线验收要能回答“先发生什么、证据来自哪里、时钟是否可信、哪些事件只能说明共现、哪些事件可以说明因果链”。

### 11. 敏感数据与凭据处理

- 凭据形态只做风险分类：password、token、cookie、API key、私钥、证书、Kerberos/LSA/Keychain、浏览器会话、OAuth refresh token 和客户个人数据。
- 不搜索、恢复、导出或拼接明文凭据；不得给 hashcat、mimikatz、LSASS dump 提取、keychain 导出、浏览器 cookie 复用或 session hijack 步骤。
- 需要证明暴露时，用证据编号、字段类别、长度、哈希、前后缀极小脱敏、地址范围和访问限制说明；附件单独加密留存并写销毁条件。
- 如果用户目标转向“拿密码、导出 token、改内存、复用会话”，停止执行并改给保全、轮换、吊销、影响评估和检测查询建议。

### 12. 证据保全与报告验收

- 原始件、工作副本、导出表、截图、timeline、工具输出和报告附件分别编号；每次复制、解压、转换、脱敏和交付都记录操作者、时间、哈希和存放位置。
- 原始 dump 不做字符串清洗、裁剪、重压缩或重命名覆盖；必须处理时先复制工作副本，并保留处理前后 SHA256。
- 报告验收必须包含：授权边界、采集链路、镜像哈希、工具版本、进程/模块/句柄/socket 画像、关键发现证据、timeline、脱敏策略、无法验证项、补证路径和安全边界声明。
- 交付前做泄露复查：报告正文、截图、CSV、JSON、timeline、压缩包和文件名不得包含明文凭据、完整 token、私钥、客户数据或可直接攻击复用的细节。

### 13. 运行时取证真实验收门禁

- 必须有 E01 原始证据、E02 工作副本、E03 采集链路、E04 运行时画像、E05 工具输出、E06 timeline、E07 脱敏交付件；缺任一类就写“不满足最终验收”。
- 采集链路必须能从授权人追到采集人、传输人、接收人、校验人、存储位置、访问控制和每次哈希；链路断点必须进入结论限制。
- 运行时画像必须最少覆盖 process、module、memory map、thread、handle/mutex/IPC、socket/network、heap/stack 可见性和平台限制；没有对应对象也要说明采集可见性。
- Volatility/Rekall、平台调试器、EDR/SIEM、文件/注册表/launchd/systemd、网络日志之间至少两类证据相互支撑；只有单一工具输出时只能写线索。
- timeline 必须标明统一时区、时钟来源、偏移假设、事件来源和因果/共现边界；不能把同一快照内的共现写成先后因果。
- 凭据和个人数据只保留类别、数量、哈希或极小脱敏片段；任何可直接复用的 secret、cookie、session、私钥、证书材料都不得进入正文、截图、文件名或附件索引。
- 结论分级用“已验证、强迹象、弱迹象、无法验证、不在采集范围”；缺哈希、缺链路、profile 错误、时间线冲突、工具冲突或样本来源不清时必须降级。
- 交付前二次检查：无明文凭据、无注入实现、无绕过检测、无内存改写、无隐藏痕迹、无真实目标攻击步骤；发现越界内容先删除并改写成防御建议。

## 验证门禁

- 三轮加固已完成：证据链/采集链路、运行时画像/工具适配、验收/脱敏/交付均有明确记录。
- 授权、样本来源、允许动作、禁止动作、停止条件、脱敏规则齐全。
- 原始 dump/镜像哈希、dump 来源、采集方式、采集工具、采集时间、系统版本、架构和工具版本齐全。
- 至少完成进程树、模块表、内存映射、线程、句柄/IPC/socket、heap/stack 可见性和时间线的基础画像；缺失项说明采集不可见、工具不支持还是未执行。
- 采集链路、镜像哈希、工作副本哈希、工具输出哈希、附件清单和访问控制可复验。
- Volatility/Rekall 或平台工具复核已记录版本、profile/symbol、参数摘要、冲突处理和降级依据。
- 关键结论至少有两类独立证据，或明确降级为线索/推测/无法验证。
- 所有地址带模块+偏移或原始偏移；所有截图、日志、导出文件有证据编号。
- 报告通过验收项：授权边界可复核、采集链可追踪、哈希可校验、timeline 可解释、凭据已脱敏、反证和限制已写明。
- 输出不包含明文凭据、注入实现、绕过检测、内存篡改、隐蔽持久化或真实目标攻击步骤。

## 输出要求

1. 场景和授权：授权主体、资产范围、样本来源、采集方式、允许动作、禁止项、停止条件、脱敏规则。
2. 证据目录：编号、文件名、SHA256、大小、来源、采集工具、采集账号、采集时间、平台、架构、Volatility/Rekall/调试器版本、符号/profile 状态。
3. 运行时画像：进程树、PID/PPID、用户、命令行、modules、memory map、threads、handles/mutex/IPC、socket、网络和关键时间。
4. 发现表：证据编号、发现、置信度、地址/偏移、关联线程/模块/对象、支持证据、反证、风险。
5. 时间线：统一时区、时钟偏移、进程事件、模块/映射变化、文件/注册表/launchd/systemd、EDR/SIEM/网络事件。
6. 敏感数据处理：哪些字段已脱敏、哪些仅保留哈希或类别、附件访问限制、留存和销毁建议。
7. 防御交接：检测建议、补采建议、受影响资产、无法验证项、需要 debugrev/crashrev/malrev/aud/code-audit 联动的最小动作。

## 安全边界

- 允许：授权 dump 分析、内存镜像取证、事件响应复盘、检测验证、供应链制品运行时核查、隔离实验室教学和防御报告。
- 拒绝：凭据提取、token/cookie/私钥恢复、明文导出、内存 patch、进程注入实现、hook 滥用、EDR/AV 规避、隐藏线程/模块、隐蔽持久化、真实目标入侵、利用链开发。
- 遇到攻击性请求时，只能给合法替代：授权范围确认、证据保全、脱敏分析、检测规则思路、隔离环境观测点和安全上报路径。
- 遇到真实第三方目标、生产系统附加或未知来源 dump，先停并要求授权证明和数据处理边界。

## 高频 Bug 反例库

- 反例 1：把 minidump 当 full dump。错法：因为没看到 heap 对象就说不存在。对法：先确认 dump 类型和采集字段。根因：采集范围决定可见证据。
- 反例 2：只贴 Volatility 命中。错法：`malfind` 出现就定性注入。对法：复核 VAD、线程入口、模块路径、权限和日志。根因：插件输出只是线索。
- 反例 3：搜索到 token 就交付明文。错法：把内存取证变成凭据提取。对法：只写类别、数量、脱敏位置和泄露风险。根因：分析不能制造二次泄露。
- 反例 4：忽略 ASLR 和符号。错法：报告只写裸地址。对法：写模块+偏移、基址、符号状态和原始偏移。根因：裸地址不可复验。
- 反例 5：把 JIT/RWX 全定恶意。错法：浏览器、运行时、游戏和安全软件正常行为被误报。对法：结合签名、线程、调用链和产品上下文。根因：内存权限需要语境。
- 反例 6：跨平台套模板。错法：用 Windows handle 思路解释 Linux core。对法：按平台对象模型列可见项和不可见项。根因：dump 结构和内核对象差异很大。
- 反例 7：只做当前快照不做时间线。错法：发现可疑模块但无法说明先后关系。对法：合并日志、文件、模块、线程和采集时间。根因：事件响应需要顺序证据。
- 反例 8：为了证明注入写复现代码。错法：提供远程线程或 hook 实现。对法：描述防御检测点、证据模式和隔离复核条件。根因：技能边界是取证不是武器化。
- 反例 9：来源不清仍硬下结论。错法：不知道 dump 怎么采的却说“没有句柄/没有线程”。对法：先写采集方式和可见性限制。根因：采集范围决定证据边界。
- 反例 10：把脱敏当可选。错法：报告附完整 cookie、token、用户名和主机名。对法：先分类、哈希、极小片段脱敏和附件隔离。根因：内存证据天然高敏。
- 反例 11：只给报告不给保全链。错法：结论里有发现但没有原始哈希、工作副本哈希、工具版本和附件编号。对法：每个结论都能追到证据目录和链路保管记录。根因：不可复验的取证结论不能验收。
- 反例 12：把 socket 当攻击证据。错法：看到远端连接就写已被 C2 控制。对法：结合进程归属、时间线、DNS/EDR/防火墙日志、协议特征和反证。根因：网络连接只是运行时状态，不等于行为定性。
- 反例 13：profile 错了仍引用插件结果。错法：Volatility 输出进程表就直接用。对法：先校验 OS/build、symbol/profile、页表和原始偏移。根因：解析层错了会系统性误判。
- 反例 14：把 EDR 导出当原始内存。错法：EDR 没导出句柄就写无异常句柄。对法：写清字段裁剪和补采路径。根因：二手证据不能替代原始 dump 可见性。
- 反例 15：时间线只用采集时间。错法：把同一快照里的模块、socket、线程写成先后因果。对法：合并日志和多源时间并标注共现/因果边界。根因：内存快照本身不自动表达顺序。
- 反例 16：把 memfd/deleted mapping 一概定恶意。错法：Linux 看到 deleted mapping 就报警。对法：结合容器、更新、JIT、临时文件和进程行为复核。根因：运行时对象需要业务语境。
- 反例 17：为证明风险导出完整附件。错法：把含 token 的字符串表随报告发送。对法：正文只留类别、计数、哈希和受控附件说明。根因：取证报告不能制造二次泄露。
- 反例 18：结论无法从报告回到原始偏移。错法：截图里有命中但没有 evidence id、offset、工具版本和输出哈希。对法：每个发现都可反查到 E 编号和原始证据。根因：不可回放就不可验收。

## 自检清单

- [ ] frontmatter `name` 使用 canonical `memory-forensics-reverse-engineering`；目录和兼容 slug 保持 `memrev`。
- [ ] 行数小于 500，正文无 fenced code block。
- [ ] 章节齐全：定位、铁律、快速总则、强制流程、场景执行卡、验证门禁、输出要求、安全边界、反例库、自检、相邻技能边界。
- [ ] 覆盖授权边界、采集链路、镜像哈希、dump 来源/采集方式、process dump、heap/stack、loaded modules、handles、mutex、socket、thread、memory map、injection traces、Volatility/Rekall 版本、Windows/Linux/macOS 差异、timeline、证据保全、报告验收、脱敏和防御证据链。
- [ ] 明确拒绝凭据提取、明文导出、内存篡改、注入滥用、隐蔽持久化、规避检测和真实目标入侵。
- [ ] manifest triggers 是授权 dump/内存取证 + 分析动作，不靠宽泛“内存”“dump”“调试”触发。
- [ ] anti_triggers 覆盖只读学习、普通内存调试/性能、debugrev/crashrev/malrev 更适合、无授权和攻击性请求。

## 相邻技能边界

- 逆向工程总控（reverse-engineering，兼容 slug: rev）：逆向总控、授权 intake、任务分流和跨技能证据编排；不替代 memrev 的 dump 逐项取证。
- 动态调试与运行时观察逆向（debugrev，兼容 slug: debugrev）：活体动态调试、断点、寄存器、参数追踪和非破坏观察更适合；memrev 只在 dump/内存证据为中心时触发。
- 崩溃分析与漏洞可达性逆向（crashrev，兼容 slug: crashrev）：crash dump、core dump 的崩溃栈复原、漏洞可达性和修复验证更适合；memrev 只处理取证画像和运行时证据链。
- 恶意样本防御逆向（malware-defense-reverse-engineering，兼容 slug: malrev）：恶意样本行为画像、IOC、YARA/Sigma/capa、ATT&CK 映射和检测交接更适合；memrev 只提供内存层证据。
- Windows 逆向（winrev，兼容 slug: winrev）/ Linux ELF 运行生态逆向（linux-elf-reverse-engineering，兼容 slug: linuxrev）/ macOS/Mach-O 逆向审计（macos-macho-reverse-engineering，兼容 slug: macrev）：平台专项逆向、系统机制和制品分析更适合；memrev 引用平台差异但不扩展成通用系统逆向。
- 性能工程（perf-engineering，兼容 slug: pfe）：内存泄漏、CPU、延迟、容量和性能 profiling 更适合；memrev 不做普通性能优化。
- 代码审计（code-audit，兼容 slug: aud）：最终风险审计、代码证据和整改闭环更适合；memrev 交付可复核的取证证据和限制。
