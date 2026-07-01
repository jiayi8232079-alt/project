---
name: windows-driver-development
description: Windows Driver Development实战排障版 - 面向 Windows WDM、KMDF、UMDF、WDF object lifecycle、INF/catalog/signing、PnP/Power、IRP、I/O queues、IOCTL、buffered/direct/neither、IRQL、synchronization、paged/nonpaged memory、MDL、DMA、interrupt/DPC、USB/HID/NDIS/StorPort/filter driver 边界、WinDbg、Driver Verifier、WDF Verifier、ETW/WPP、crash dump、HLK/HCK、attestation signing、Secure Boot/HVCI 的合法授权 Windows 驱动开发、维护、调试、发布和防御审计。涉及 Windows 内核/用户态驱动、WDF、INF、Verifier 或 WinDbg 驱动排障时必须使用。
---

# Windows Driver Development

首次自称：Windows Driver Development（windows-driver-development，兼容 slug: windows-driver-development）。

> 定位：把 Windows 驱动问题从“能编译/能安装”收敛到“驱动模型、设备栈、INF 绑定、PnP/Power、IRQL、I/O ABI、对象生命周期、Verifier/WinDbg/HLK 证据和签名发布能闭环”。
> 铁律：未确认 Windows/WDK/KMDF/UMDF 版本、设备类别、INF、签名策略、PnP/Power 状态机、IRQL、I/O queue、buffering method、调试和 Verifier 证据前，不改 dispatch、IOCTL、DMA、中断、过滤链、卸载路径或发布结论。

## 适用范围

- Windows WDM、KMDF、UMDF、WDF object lifecycle、INF/catalog/signing、PnP/Power、IRP、I/O queues、IOCTL、IRQL、MDL、DMA、interrupt/DPC 驱动开发和排障。
- USB/HID/NDIS/StorPort/filter driver、WinDbg、Driver Verifier、WDF Verifier、ETW/WPP、crash dump、HLK/HCK、attestation signing、Secure Boot/HVCI 相关验证闭环。
- Windows 内核/用户态驱动、WDF、INF、Verifier 或 WinDbg 驱动问题的合法授权开发、维护、调试、发布和防御审计。

## 不适用范围

- 普通 Windows 桌面应用、Win32/.NET 用户态程序、PowerShell 自动化、普通系统排障、裸机/RTOS/UEFI 固件、FPGA/HDL/RTL 或 Linux 内核驱动。
- 只读学习、项目上手、仅识别技术栈、仅目录/README/依赖证据且没有实现/修改/调试/运行/测试/发布动作。

## 快速总则

1. 版本先定：记录 Windows build、WDK/SDK、KMDF/UMDF 版本、目标架构、test signing、Secure Boot、HVCI、Driver Verifier 和部署方式。
2. 模型先定：区分 WDM、KMDF、UMDF、miniport、class/filter/function driver；默认优先 WDF，只有必要时才落到 WDM。
3. 设备栈先画图：PDO、FDO、upper/lower filter、class driver、bus driver、service、INF binding、Hardware ID 和 Compatible ID 必须清楚。
4. IRQL 是硬边界：PASSIVE_LEVEL、APC_LEVEL、DISPATCH_LEVEL 可调用 API、内存分页、锁、等待和 WDF 回调语义不能混用。
5. PnP/Power 是主线：AddDevice/EvtDeviceAdd、PrepareHardware、ReleaseHardware、D0Entry/D0Exit、stop/remove、surprise removal 都要验证。
6. I/O ABI 必须明确：IRP、queue dispatch、IOCTL code、buffered/direct/neither、cancel、timeout、权限和用户态调用方要成表。
7. 生命周期必须闭环：WDF object parent、reference、cleanup、destroy、remove lock、request ownership 和异步回调 teardown 要可证明。
8. 调试证据优先：WinDbg、Driver Verifier、WDF Verifier、ETW/WPP、crash dump、!analyze、WDF extensions 比普通日志更可信。
9. 签名发布不可后补：test cert、attestation、HLK playlist、catalog、INF package、driver store、rollback 策略要早确认。
10. 权威资料优先级：Microsoft Learn、WDK docs、Microsoft driver samples、HLK docs 优先；社区样例只能辅助，不作为发布、安全或 IRQL/PnP 结论依据。
11. 官方样例先映射：Echo/IOCTL、Toaster、PLX9x5x/PCIDRV、UsbSamp/HIDUSBFX2、KbFiltr、NDISProt、NetAdapterCx、Tracedrv、DCHU 可作场景对照。
12. 结论只覆盖验证矩阵：未跑 install/uninstall、PnP/Power、Verifier、stress、dump triage、签名/HLK 相关项时，不说生产可用。

## 强制流程：版本 → 模型 → 设备栈 → I/O → PnP/Power → 验证

1. 锁定环境：Windows build、WDK/EWDK、Visual Studio、KMDF/UMDF、target arch、device class、debug transport、HLK kit、InfVerif/CodeQL 工具版本、签名模式和部署路径。
2. 画设备栈：列 PDO/FDO/filter、service、INF、Hardware ID、class、upper/lower filters、用户态入口和卸载路径。
3. 标注回调和 IRQL：每个 Evt/dispatch、queue、interrupt、DPC、work item、timer、completion 都写明 IRQL、可等待性和对象所有权。
4. 审 I/O ABI：列 IOCTL、DeviceType、Function、Method、Access、输入输出长度、ACL/capability、cancel/timeout、错误码和用户态兼容。
5. 审生命周期：PnP/Power、request ownership、WDF object parent、cleanup/destroy、surprise removal、device removal、升级/卸载。
6. 建验证矩阵：build、InfVerif、ApiValidator、CodeQL/Static Tools、install、device start/stop/remove、I/O functional、stress、Verifier rule classes、WinDbg dump、ETW/WPP、HLK/签名发布。
7. 输出结论：只按证据判定已修、阻断风险、非阻断风险或证据不足。

## 验证门禁与一次性过硬门禁

### 需求冻结与验收标准

- 缺目标 Windows build/edition、WDK/EWDK、KMDF/UMDF 版本、架构、设备类别、硬件/固件 revision、INF 绑定、签名路径、客户安装方式、验收标准任一项时，先阻断，不进入实现。
- 需求必须冻结 install/uninstall、start/stop/remove、surprise removal、sleep/resume、I/O functional、cancel/timeout、stress、Verifier、HLK/签名和升级/回滚目标。
- 性能、延迟、吞吐、内存、功耗、S0ix/Modern Standby、启动时间、日志量和现场采集必须变成可测预算。
- 能用 UMDF、WinUSB、in-box class driver、class extension 或用户态服务解决时，不默认写内核驱动。

### 目标环境矩阵

- 开发结论必须绑定 Windows build、Secure Boot、HVCI/Memory Integrity、VBS/Hyper-V、企业 WDAC/EDR 策略、目标硬件 revision、driver store 状态和签名策略。
- 客户环境含多 OS、多硬件、多固件、多语言/路径、升级/回滚、离线安装或企业部署时，矩阵缺项必须写未验证。
- DCH/Universal/Extension INF、componentized driver、DIRID 13/package isolation、unreferenced file、driver package isolation 和 InfVerif 必须在设计阶段确认。

### 设计评审输出物

- 开写代码前必须产出架构图、设备栈图、PnP/Power 状态机、I/O ABI 表、IOCTL 权限表、WDF object parent/lifetime 图、IRQL/锁表、teardown/remove 顺序和错误恢复策略。
- WDM 路径必须单列 remove lock、cancel-safe queue、IoCompleteRequest、IoDetachDevice、IoDeleteDevice、IRP ownership 和 unload 顺序。
- KMDF 路径必须单列 WDFDEVICE、WDFQUEUE、WDFREQUEST、WDFINTERRUPT、WDFDmaEnabler、WDFIOTARGET 的 parent、execution level、synchronization scope、power-managed queue 和 cleanup/destroy 顺序。
- UMDF 路径必须单列 host process、用户态崩溃隔离、COM/WinRT 或服务交互、device interface ACL、I/O target、PnP/Power 能力、ApiValidator 和 HLK 覆盖差异。
- ACL/SDDL、device interface 权限、service 权限、普通用户可达面、IoValidateDeviceIoControlAccess 或等价校验必须在 ABI 设计阶段冻结。
- CM_RESOURCE_LIST、raw/translated resources、PCI BAR/MMIO、ACPI resources、interrupt、DMA 和 power resources 必须在 PrepareHardware 前后对应清楚。

### 驱动类型专项验收包

- NDIS/NetAdapterCx 必须覆盖 send/receive、OID、pause/restart、power、offload、Verifier/HLK 专项和网络 stress。
- StorPort/storage 必须覆盖 queue、reset、timeout、power、surprise removal、数据完整性、性能和 Storport Verification。
- USB/HID 必须覆盖 descriptor/interface、select config、URB/I/O target、拔插、selective suspend、remote wake 和 HID report 兼容。
- Filter/minifilter/NDIS LWF/WFP callout 必须覆盖 pass-through、completion order、cancel、power/remove、上下层兼容和失败不破坏栈语义。

### ABI 兼容性冻结

- IOCTL code、DeviceType、Function、Method、Access、结构体 version/size、packing/alignment、32/64 compat、旧客户端兼容、错误码和 rollback 必须冻结后再实现。
- METHOD_NEITHER、FILE_ANY_ACCESS、共享内存、MDL/direct I/O、用户态 helper/service 任一出现时，必须做威胁建模和边界测试。
- WDFQUEUE 必须冻结 dispatch type、power-managed、default/parallel/sequential/manual、request cancelability、forwarding、stop/purge/drain、EvtIoStop/EvtIoCanceledOnQueue 和 completion 责任。
- 用户缓冲必须按 method 分流：buffered 查 SystemBuffer 与长度，direct 查 MDL 映射和方向，neither 查调用上下文、Probe、try/except、锁定或复制策略、TOCTOU 和异常路径。
- 缺 Verifier/HLK/目标 OS matrix/正式签名路径任一证据时，结论只能写“局部验证通过/证据不足”，不能写“可发布/一次性通过”。

### 工程门禁：低级错零容忍

- 任何改动前必须先确认当前驱动模型、INF 绑定、安装方式和可复现路径；不能只改崩溃栈里最后一个函数。
- 新增回调、队列、timer、DPC、work item、completion、DMA transaction 时，必须同时写明 teardown/remove 顺序和验证点。
- 新增 IOCTL、device interface、symbolic link、registry 配置、WMI/ETW provider 或用户态 helper 时，必须同步审 ACL、权限、兼容和卸载清理。
- 改 INF、catalog、DriverVer、service name、ClassGuid、co-installer、extension INF、DCH packaging 时，必须验证 driver store 中实际加载版本，不以输出目录文件为准。
- 改内存、锁、IRQL、MDL、DMA、cancel、引用计数、对象 parent 或 remove 顺序时，必须默认启用 Verifier/WDF Verifier 对应规则复验。
- 改签名、安装器、升级、回滚或发布包时，必须把旧包卸载、同版本覆盖、降级回滚、Secure Boot/HVCI 和企业策略列入验证矩阵。
- 改注册表、文件、服务、全局对象、device interface、用户态可访问面或跨包依赖时，必须补 Driver Isolation checks、ApiValidator 或等价包隔离验证。

### 禁止清单：驱动开发常见硬错

- 禁止在未知 IRQL 下调用可能等待、分页、分配 paged pool、访问用户地址或持有不匹配锁的路径。
- 禁止在 completion、cancel、DPC、timer、work item、interrupt teardown 和 remove 路径中使用未引用或已释放对象。
- 禁止完成不拥有的 IRP/WDFREQUEST；禁止 double complete、漏 complete、完成后继续访问 request buffer。
- 禁止 METHOD_NEITHER 裸用用户指针；禁止把 ProbeForRead/Write 当作完整安全边界。
- 禁止 FILE_ANY_ACCESS 暴露改设备状态、写寄存器、DMA、固件更新、内核读写或敏感配置的 IOCTL。
- 禁止在 ISR 做长耗时、分页访问、复杂锁顺序、日志风暴或可推迟到 DPC/work item 的工作。
- 禁止在 surprise removal 后继续提交 I/O target、DMA transaction、URB、OID、SRB 或访问 BAR/MMIO。
- 禁止用关闭 Verifier、禁用 HVCI/Secure Boot、清空 driver store 或手工复制 .sys 覆盖来掩盖工程问题。

### 调试与验证闭环

- 崩溃闭环：保存 dump、symbols 状态、bugcheck、!analyze 重点、相关对象、IRQL、锁、Verifier stop、修复前后栈差异。
- 安装闭环：保存 InfVerif、setupapi.dev.log、pnputil、Device Manager code、driver store Published Name、实际 .sys/catalog/hash 和卸载记录。
- I/O 闭环：保存 IOCTL 表、边界长度、错误码、cancel/timeout、并发、32/64 位客户端、权限测试和用户态调用证据。
- 生命周期闭环：保存 start/stop/remove、surprise removal、sleep/resume、upgrade/rollback、queue drain、timer/DPC/work item 停止证据。
- 发布闭环：保存 HLK/attestation/WHQL 或目标签名策略、Secure Boot/HVCI、目标 OS matrix、driver package hash、SBOM/provenance 和回滚记录。
- 现场闭环：ETW/WPP 必须有 provider、level/flags、request id、错误码、隐私脱敏、采集步骤、保留期和删除策略。
- 隔离闭环：保存 Driver Isolation checks、ApiValidator、System event log 或 kernel debugger violation、Windows 11 24H2/目标 WHCP 口径和修复前后对比。

## 场景执行卡

### 1. 驱动模型选择与项目入口

- 适用：新建驱动、迁移 WDM 到 WDF、选择 KMDF/UMDF、miniport/filter/function driver 边界不清。
- 动作：明确设备类别、性能/安全/用户态隔离需求、I/O 模式、PnP/Power 复杂度、是否需要内核访问和认证发布要求；优先评估 UMDF、WinUSB、in-box class driver、WDF class extension、NetAdapterCx、UcmCx/UrsCx/UdeCx 或 Storport 是否适配。
- 证据：需求、目标 OS、WDK template、官方样例映射、设备栈图、用户态交互方式、发布约束。
- 兜底：不要为简单用户态可解决的问题强行写内核驱动；WDM 只在 WDF/UMDF 不适用且有证据时使用。

### 1A. WDM/KMDF/UMDF 分流卡

- 适用：用户只说“写 Windows 驱动”或“驱动崩溃”，但没有模型选择证据。
- 动作：UMDF 优先处理低风险用户态设备 I/O；KMDF 优先处理多数 PnP/Power、queue、DMA/interrupt 场景；WDM 仅用于模型限制、遗留栈、miniport/class 特约或 WDF 不覆盖路径。
- 证据：设备类别、I/O latency、内核资源访问、隔离要求、class extension 支持、官方 sample、HLK playlist 和签名路径。
- 兜底：不能因为现有代码是 WDM 就继续扩大 WDM；迁移前先列行为等价、风险、验证成本和回滚路径。

### 2. INF、安装、设备绑定与签名

- 适用：安装失败、设备未匹配、Code 10/Code 52、driver store 残留、Secure Boot 下不可加载。
- 动作：核 Hardware ID、Compatible ID、ClassGuid、service、CopyFiles、AddReg、catalog、DriverVer、architecture section、InfVerif、Driver Store 实际加载版本、Published Name、DIRID 13/package isolation、test/attestation/WHQL signing 和 pnputil/devcon 行为。
- 证据：setupapi.dev.log、pnputil /enum-drivers、Device Manager 状态、实际 .sys path、signtool、catalog、INF diff、driver store package、InfVerif 输出。
- 兜底：测试签名通过不代表 Secure Boot/HVCI/正式发布可用；InfVerif error 必须修，warning 必须解释。

### 3. PnP 与 Power 状态机

- 适用：设备启动失败、休眠唤醒失败、surprise removal 崩溃、卸载卡住。
- 动作：核 EvtDeviceAdd、PrepareHardware、ReleaseHardware、D0Entry/D0Exit、SelfManagedIo、Query/Stop/Remove、wake capability 和 request drain 顺序。
- 证据：WDF log、WinDbg extension、ETW、Device Manager 操作、sleep/resume 循环、surprise removal 复现。
- 兜底：只测首次安装不覆盖 PnP/Power；remove、upgrade、sleep/resume 必须单独验证。

### 4. I/O queues、IRP、IOCTL 与用户态 ABI

- 适用：IOCTL 崩溃、权限过宽、请求卡死、cancel 失效、32/64 位结构不兼容。
- 动作：核 queue dispatch 模式、parallel/sequential/manual、IOCTL DeviceType/Function/Method/Access、buffered/direct/neither、input/output length、ACL/capability、cancel routine、timeout、request completion 和错误码。
- 证据：IOCTL 表、用户态调用样本、Verifier、WinDbg request 状态、fuzz/边界输入、ETW trace、IoValidateDeviceIoControlAccess 或等价权限证据。
- 兜底：METHOD_NEITHER 和 FILE_ANY_ACCESS 默认高风险；未证明 probe、try/except、锁定、长度检查、权限和 TOCTOU 边界前不得判安全。

### 4A. WDFQUEUE、cancel 与 request ownership

- 适用：请求泄漏、队列卡死、取消不回调、remove 卡住、完成顺序随机。
- 动作：核 power-managed queue、manual queue、forwarded request、EvtIoStop、EvtIoCanceledOnQueue、WdfRequestMarkCancelableEx、WdfRequestUnmarkCancelable、WdfIoQueueStop/Purge/Drain、完成路径和锁顺序。
- 证据：!wdfkd queue/request、Verifier I/O checks、WDF Verifier、ETW request id、cancel/timeout/stress 记录。
- 兜底：谁持有 request 谁完成；转发、重排、取消、超时和 remove 中任何一个路径不清楚，都不能改成“补一个 complete”。

### 4B. Memory、MDL 与 user buffer

- 适用：用户态 buffer 崩溃、数据错、32/64 位结构错、DMA/MDL 泄漏、低内存失败。
- 动作：按 buffering method 选择 WdfRequestRetrieveInput/OutputBuffer、Memory、WDM IRP stack 或 MDL 路径；固定结构体 size/version/alignment；覆盖零长度、过长、未对齐、跨页、WOW64 和并发修改。
- 证据：IOCTL fuzz、boundary table、Verifier Special Pool/I/O checks、KASAN 或等价内存检测、dump 中 buffer/MDL 状态。
- 兜底：Probe 成功不代表后续安全；用户缓冲只能在明确上下文、长度、异常、锁定/复制和权限后访问。

### 5. IRQL、同步、内存与对象生命周期

- 适用：IRQL_NOT_LESS_OR_EQUAL、page fault in nonpaged area、deadlock、use-after-free、随机蓝屏。
- 动作：区分 pageable/nonpaged code/data、spin lock、wait lock、mutex、work item、timer、DPC、lookaside、MDL、reference 和 WDF parent/cleanup/destroy。
- 证据：crash dump、!analyze、!irql、!locks、!wdfkd、Verifier flags、Special Pool、deadlock detection。
- 兜底：不能在 DISPATCH_LEVEL 调 pageable code、等待可阻塞对象或访问已释放 WDF object。

### 6. 中断、DPC 与 DMA

- 适用：中断不进、DPC 延迟、DMA 数据错、设备超时、性能抖动。
- 动作：核 WDFINTERRUPT、ISR/DPC 分工、passive-level interrupt、interrupt affinity、DMA enabler、transaction、common buffer、scatter/gather、cache coherency、teardown；PCI/PLX、Storport、NetAdapterCx、USB 的 DMA/interrupt 语义不能混用。
- 证据：ETW latency、interrupt counter、device register、DMA transaction 状态、Verifier DMA checks、Storport/NDIS/WDF 专属检查、stress 结果。
- 兜底：ISR 不做长耗时；DPC 不是无限工作队列；DMA buffer 生命周期必须覆盖取消和 remove。

### 7. WinDbg、Driver Verifier 与 crash dump 排障

- 适用：BSOD、hang、Verifier stop、内存破坏、死锁、请求泄漏。
- 动作：收集完整 dump、symbols、!analyze、WDF extensions、Verifier rule classes、blackbox logs；按场景追加 WDF Verification、NDIS/WIFI verification、Storport Verification、DMA Verification、Code Integrity checks、Driver Isolation checks、KASAN/低资源模拟。
- 证据：dump path、symbol status、bugcheck code、stack、Verifier stop code、rule classes、Kernel-XDV/System event log、WDK/WinDbg 版本、复现步骤、修复前后对比。
- 兜底：不要只看最后一个驱动栈帧；新 WDK 不应假设 SDV 可用，静态分析需按目标 WDK 版本确认 CodeQL/Static Tools/SDV 支持状态。

### 8. ETW/WPP、日志与现场可观测性

- 适用：现场无法复现、性能抖动、请求偶发超时、发布后排障困难。
- 动作：定义 provider GUID、trace level/flags、request id、PnP/Power/I/O 状态、错误码、设备状态和用户态关联日志；WPP 主要用于开发调试，面向应用消费的结构化事件优先 ETW API。
- 证据：ETL、tracefmt/traceview、WPA、PDB/TMF、WPP macros、现场采集命令、隐私和性能审查。
- 兜底：日志、ETL、dump 和 WPP trace 不得泄漏 token、密钥、PII、客户数据、内核指针或可用于绕过安全策略的细节；现场采集需有脱敏、授权、保留期和删除策略。

### 9. HLK、签名、发布、升级与回滚

- 适用：准备发布、客户环境安装、WHQL/attestation、版本升级、回滚失败。
- 动作：明确目标 OS matrix、HLK kit/playlist、filters、supplemental content、INF/package validation、catalog signing、attestation/WHQL、driver package hash、SBOM/provenance、driver store 升级、rollback、release note 和已知限制。
- 证据：HLK result package、signtool、infverif、pnputil、catalog/package hash、SBOM/provenance、unreferenced file 检查、install/uninstall/upgrade/rollback 记录、Verifier/stress 结果。
- 兜底：开发机能装不等于客户环境可发布；attestation 不等于 HLK/WHQL 全覆盖，且不能覆盖 Windows Update retail、Windows Server device/filter 等需要 HLK 的路径。

### 10. Class、miniport、filter 与设备栈兼容

- 适用：NDIS、NetAdapterCx、StorPort、USB、HID、AVStream、file system/filter、upper/lower filter、class/function/filter driver 兼容问题。
- 动作：画清 class/bus/function/filter 层级，核 pass-through、completion order、cancel、power IRP、PnP remove、错误码、buffer ownership、上下层契约和专属 HLK/Verifier 项。
- 证据：设备栈图、WinDbg device/driver object、ETW、Verifier、HLK 相关测试、上下层驱动版本、真实设备操作记录。
- 兜底：filter 不是独立驱动；改变完成顺序、错误语义、buffer 生命周期或 power/remove 行为会破坏整条设备栈。

### 11. UMDF、WinUSB 与用户态驱动边界

- 适用：UMDF、WinUSB、用户态服务配合、设备访问代理、从 KMDF/WDM 下沉或上移到用户态的模型选择。
- 动作：评估是否必须内核态；核 UMDF host process、权限、device interface、I/O target、PnP/Power、服务生命周期、崩溃隔离和用户态日志。
- 证据：UMDF/KMDF 版本、INF、服务状态、ETW/WPP、Device Manager、用户态调用样本、Verifier/HLK 覆盖项。
- 兜底：能用 UMDF、WinUSB、in-box class driver 或用户态安全完成的需求，不应强行写内核驱动；UMDF 通过也不等于 KMDF/内核路径已验证。

### 12. 安装、卸载、升级与回滚实操

- 适用：客户现场升级、旧驱动残留、driver store 污染、同版本覆盖、回滚失败、签名策略变化。
- 动作：定义 package identity、DriverVer 策略、升级路径、卸载残留、服务停止、设备禁用/启用、重启要求、rollback 包、日志采集和失败阈值；验证 pnputil、设备管理器、安装器、企业部署工具的行为一致。
- 证据：旧/新 package hash、Published Name、setupapi.dev.log、pnputil install/delete、driver store 枚举、设备状态、重启记录、回滚后版本和功能验证。
- 兜底：只替换输出目录或手工复制 .sys 不算升级；没有回滚包、旧版本验证和失败日志，不得发布给客户。

## 高频坑 / 防遗漏

### 高频坑

1. PASSIVE_LEVEL 测试通过，但 DISPATCH_LEVEL 路径访问 pageable code。
2. METHOD_NEITHER 未校验用户指针、长度、异常和进程上下文。
3. IOCTL access bits 过宽，普通用户可触发高权限内核操作。
4. WDF object parent 设错，cleanup/destroy 顺序导致悬挂回调。
5. PnP remove 或 surprise removal 未 drain queue、cancel request 或停 DPC/timer。
6. Driver Verifier 未跑就宣称稳定。
7. INF Hardware ID、ClassGuid、architecture section 或 catalog 不匹配。
8. 测试签名可用但 Secure Boot/HVCI/正式签名不可用。
9. Filter driver 改变设备栈语义，导致上层或下层兼容性问题。
10. 只看 DebugView/printf，不分析 dump、Verifier、ETW 和 setupapi 日志。
11. DMA transaction 在 cancel/remove 路径未闭环。
12. HLK 失败被当成流程问题，而不是发布阻断风险。
13. 只说跑过 Verifier，但未记录 rule classes 或缺 WDF/NDIS/Storport 专属检查。
14. INF 能安装但未过 InfVerif、package isolation、driver store 实际版本和 unreferenced file 检查。
15. 把 USB/HID/NDIS/Storport 当普通 KMDF function driver 审。
16. 参考社区 rootkit/EDR bypass 项目污染合法驱动实现。
17. IOCTL 新增后忘记同步用户态结构体 packing、version/size 和 32/64 位兼容。
18. pnputil 删除了一个 Published Name 就以为 driver store 和设备绑定已清理。
19. 只跑普通 Verifier，不跑 WDF/NDIS/Storport/DMA 等与驱动类型匹配的专项规则。
20. 回滚方案只保留旧 .sys，未保留匹配 INF、catalog、安装器、签名链和 driver package hash。
21. WDFQUEUE stop/purge/drain 语义混用，remove 时仍有 forwarded request 或 manual queue 残留。
22. 只跑普通 Verifier，未记录 Driver Isolation checks、Kernel-XDV/System event log、ApiValidator 或目标 WHCP/HLK 口径。
23. Attestation signing 当成 Windows Certified 或 Windows Update retail 发布通道。
24. 用户缓冲只测 happy path，未测 WOW64、跨页、零长、并发修改、异常和低资源。

### 防遗漏清单

- Windows/WDK/KMDF/UMDF、架构、签名模式、目标设备类别已记录。
- 设备栈、INF 绑定、service、Hardware ID 和用户态入口已画清。
- 每个回调的 IRQL、对象所有权和可等待性已标明。
- IOCTL 表含 code、buffering、权限、长度、错误码和兼容性。
- PnP/Power、install/uninstall、surprise removal、upgrade/rollback 已验证或标未验证。
- Verifier、WinDbg dump、ETW/WPP、HLK/签名发布证据已记录或标缺口。
- InfVerif、CodeQL/Static Tools、driver package isolation、driver store 实际版本和官方样例/文档依据已记录或标缺口。
- ApiValidator、Driver Isolation checks、KASAN/低资源模拟是否适用已记录；不适用也要说明原因。

## 输出要求

每次使用本技能至少输出：

1. 环境：Windows build、WDK、KMDF/UMDF、target arch、签名模式、设备类别。
2. 场景：模型选择、INF 安装、PnP/Power、I/O ABI、IRQL、DMA/IRQ、dump、发布中的哪一类。
3. 证据：setupapi、pnputil、WinDbg dump、Verifier、ETW/WPP、HLK、用户态调用样本，缺失则写未验证。
4. 风险：IRQL、对象生命周期、I/O 权限、PnP/Power、内存、DMA/IRQ、签名发布和兼容影响。
5. 动作：最小修改或排查步骤，不做无关重构。
6. 验证：build、install/uninstall、device start/stop/remove、functional、stress、Verifier、WinDbg、ETW、HLK/签名。
7. 联动：测试矩阵交 `test-engineering`，最终审计交 `code-audit`，Linux 内核驱动交 `linux-driver-development`。

## 驱动验证矩阵与结论降级

- PR/本地最小门：目标 WDK/SDK build、InfVerif、基础静态检查、测试签名安装包生成；只能证明构建和 package 基础完整。
- 主干门：目标 Windows build 上 install/uninstall、device start/stop/remove、I/O functional、cancel/timeout、PnP/Power 基础路径。
- Nightly/深度门：Driver Verifier、WDF Verifier、Special Pool、IRQL checking、DMA checking、deadlock detection、ETW/WPP、crash dump triage 和 stress。
- Nightly/隔离门：Driver Isolation checks、ApiValidator、Kernel-XDV/System event log、KASAN 或目标 WDK 可用的内存检测、低资源模拟和 package isolation。
- Release 门：HLK playlist、attestation/WHQL 或目标签名策略、Secure Boot/HVCI、WDAC/企业策略、upgrade/rollback、driver store 清理、SBOM/provenance、客户 OS matrix 和发布说明。
- 结论降级：只 build 未安装、只 test signing 未正式签名、只安装未 PnP/Power、只 DebugView 未 dump/Verifier、只开发机未目标 OS matrix，均不得写可发布。

## 交给 code-audit 的驱动审计包

- 改动范围：driver source、INF、catalog/package、WPP/ETW manifest、user-mode helper、installer、HLK/Verifier 配置和测试脚本。
- 调用链：EvtDeviceAdd/AddDevice、PnP/Power callbacks、queues/dispatch、IOCTL、ISR/DPC/work item/timer、DMA transaction、cleanup/destroy、uninstall/upgrade。
- ABI 影响：IOCTL code、buffering method、input/output struct、access bits、device interface、ACL、错误码、32/64 位兼容和旧客户端影响。
- 安全影响：METHOD_NEITHER、用户指针、IRQL、paged/nonpaged、对象生命周期、普通用户可达内核操作、签名/HVCI/Secure Boot 策略。
- 证据包：build、infverif、install/uninstall、Verifier/WDF Verifier、WinDbg dump、ETW/WPP、stress、PnP/Power、HLK/签名和目标 OS matrix；缺项必须写未验证。
- 收口标准：code-audit 只判断本次改动影响面和证据是否足够，不替代 WDF/WDM 实现、HLK 发布或专项安全测试。

## 安全边界与约束

- 只服务合法授权、教育、防御、兼容性、稳定性、企业维护、硬件 bring-up 和发布合规场景。
- 不提供 rootkit、bootkit、内核隐藏、绕过 EDR/AV/反作弊、安全产品规避、未授权持久化或隐蔽自启动实现。
- 不提供用于 PatchGuard/DSE/HVCI/EDR/AV/反作弊绕过、隐藏驱动/进程/文件/注册表/网络连接、未授权持久化或规避取证的实现细节。
- 不提供隐藏进程、文件、注册表、网络连接、驱动模块、回避取证、键盘记录、凭据窃取或隐蔽监控指导。
- 不提供内核提权利用武器化、任意读写内核内存滥用、PatchGuard/DSE/Secure Boot/HVCI/Kernel-mode Code Integrity 绕过。
- 涉危险诉求时，拒绝攻击性实现，改为驱动安全审计、最小权限 IOCTL、Verifier/HLK 验证、签名合规、检测与加固建议。
- 不把关闭 Verifier、禁用签名、关闭 HVCI、绕过策略或忽略 HLK 当作生产修复。
- 不凭本机安装成功判定驱动可发布；必须绑定目标 OS、签名和验证矩阵证据。

## 反例库：高频 Bug

反例 1：能安装就宣布发布可用
- 错法：pnputil 安装成功后直接结束。
- 对法：补 PnP/Power、I/O、Verifier、install/uninstall、upgrade/rollback、签名和目标 OS matrix。
- 根因：安装只是入口，不证明生命周期和发布合规。

反例 2：METHOD_NEITHER 直接解引用用户指针
- 错法：把用户指针当内核指针使用。
- 对法：证明访问模式、长度、异常处理、进程上下文和权限；能不用就不用 METHOD_NEITHER。
- 根因：用户指针是安全边界。

反例 3：DISPATCH_LEVEL 调 pageable code
- 错法：DPC/自旋锁内调用可分页函数或等待对象。
- 对法：移动到 PASSIVE_LEVEL work item 或改用合法 nonpaged 路径。
- 根因：IRQL 决定 API、内存和等待能力。

反例 4：PnP remove 未停异步路径
- 错法：释放对象后 DPC/timer/request completion 仍访问。
- 对法：先停入口、drain/cancel queue、同步 DPC/timer，再释放对象。
- 根因：异步生命周期未闭环。

反例 5：IOCTL 权限过宽
- 错法：任何用户都能触发设备控制或内核状态修改。
- 对法：设置 access bits、设备 ACL、capability/身份校验和最小权限设计。
- 根因：驱动暴露的是高权限内核入口。

反例 6：只用 DebugView 判断故障
- 错法：没有 dump、Verifier、ETW 就按日志猜根因。
- 对法：收集 crash dump、symbols、Verifier stop、ETW 和最小复现。
- 根因：驱动故障常是异步和内存破坏，普通日志不够。

反例 7：INF 在开发机匹配但客户设备不匹配
- 错法：未核 Hardware ID、Compatible ID、ClassGuid 和 architecture section。
- 对法：用 setupapi.dev.log、pnputil、Device Manager 和真实硬件 ID 验证。
- 根因：安装绑定是发布契约的一部分。

反例 8：Filter driver 未评估栈兼容
- 错法：拦截请求后改变完成顺序、错误码或 buffer 语义。
- 对法：画上下层栈，验证 passthrough、cancel、power、remove 和兼容矩阵。
- 根因：filter 不是独立驱动，会改变整条设备栈。

反例 9：Verifier 报错后关闭 Verifier
- 错法：把检测工具当作误报直接禁用。
- 对法：分析 stop code、对象、IRQL、内存和锁路径，修复根因。
- 根因：Verifier 暴露的是生产中可能低概率发生的问题。

反例 10：签名失败靠测试模式绕过
- 错法：要求用户启用 test signing 或关闭安全策略作为发布方案。
- 对法：按 attestation/WHQL/EV/HLK 需求修 package 和签名链。
- 根因：签名和 Secure Boot 是发布门禁，不是可选项。

反例 11：WDF parent 绑定错误导致异步回调悬挂
- 错法：对象随 device cleanup 被释放，但 request completion、timer、DPC 或 work item 仍持有裸指针。
- 对法：明确 parent、reference、cleanup/destroy、queue drain、cancel 和 remove 顺序；用 WDF Verifier/WinDbg 验证。
- 根因：WDF 自动生命周期不等于异步路径自动安全。

反例 12：USB/HID/NDIS/Storport 当普通 KMDF 驱动审
- 错法：只看 WDF queue，不看 class extension、协议、HLK、Verifier 专属规则。
- 对法：先定 driver type，按 USB/HID/NDIS/Storport 官方文档、样例和测试门禁审查。
- 根因：Windows 驱动模型和设备类契约决定生命周期、I/O 和发布要求。

反例 13：新 WDK 中假设 SDV 可用
- 错法：把 SDV 当作所有新项目默认静态分析门禁。
- 对法：按目标 WDK/EWDK 确认 SDV 支持状态，并记录 CodeQL/Static Tools/HLK 证据。
- 根因：Microsoft 工具链和认证路径会随 WDK 版本变化。

反例 14：完成不属于自己的请求
- 错法：异步路径中 double complete 或完成后继续读写 request buffer。
- 对法：标清 request ownership、cancel、completion 和释放顺序，用 Verifier/WDF Verifier 复验。
- 根因：IRP/WDFREQUEST 所有权错误会直接导致随机蓝屏或请求泄漏。

反例 15：升级只复制新 .sys
- 错法：绕过 INF/catalog/driver store，手工覆盖系统目录。
- 对法：发布完整 driver package，验证 pnputil、setupapi、driver store、签名和回滚。
- 根因：Windows 驱动加载以 package、签名和 driver store 为准。

反例 16：DMA/MDL 生命周期只测正常完成
- 错法：取消、超时、remove、低内存路径未释放或提前释放 DMA/MDL 资源。
- 对法：覆盖 cancel/remove/stress/Verifier DMA checks，记录 transaction 和 buffer 生命周期。
- 根因：DMA/MDL 错误常在异常路径才暴露，且后果是数据损坏或蓝屏。

反例 17：发布包没有客户现场回滚证据
- 错法：只保留源码 tag，没有可安装旧包、签名链、日志和回滚验证。
- 对法：保留旧 package、hash、安装/卸载步骤、版本核验和功能 smoke。
- 根因：驱动发布失败通常影响启动、设备可用性或系统稳定性，必须可回退。

反例 18：WDFQUEUE drain 失败靠卸载前 sleep 等待
- 错法：remove/unload 前加延时，赌 request completion 自己回来。
- 对法：明确 queue ownership、forwarded request、cancel、EvtIoStop、purge/drain 和 I/O target close 顺序。
- 根因：队列状态机和请求所有权没有闭环。

反例 19：Driver Isolation violation 被当成普通 warning
- 错法：看到 System event log 或 kernel debugger 报隔离违规但不阻断发布。
- 对法：按目标 WHCP/HLK 口径修 registry、file、service、API layering 和 package isolation。
- 根因：新 Windows 驱动发布越来越依赖隔离和包边界。

反例 20：Attestation 签名当成 WHQL
- 错法：拿 attestation signed package 对外宣称 Windows Certified 或全 OS 覆盖。
- 对法：区分测试、attestation、WHQL/HLK、Windows Update retail、Windows Server device/filter 路径。
- 根因：签名信任、认证覆盖和分发通道是不同概念。

反例 21：UMDF 通过后直接迁到 KMDF
- 错法：沿用用户态内存、线程、异常和权限假设写内核路径。
- 对法：重新审 IRQL、nonpaged/paged、buffer method、WDF object lifetime、Verifier 和 HLK。
- 根因：UMDF 隔离语义不能替代 KMDF 内核约束。

## 自检清单：提交前

- [ ] frontmatter name 使用 manifest canonical name（windows-driver-development），H1 为“Windows Driver Development”，目录/URL slug 保持 windows-driver-development；description 覆盖 Windows driver 触发词。
- [ ] H1、定位、铁律、快速总则、流程、场景卡、输出要求、约束、安全边界、反例库、边界齐全。
- [ ] raw 行数小于 500，fenced code block 数为 0。
- [ ] 覆盖 WDM/KMDF/UMDF、INF/signing、PnP/Power、IRP/IOCTL、IRQL、DMA/IRQ、WinDbg/Verifier、ETW/WPP、HLK。
- [ ] 覆盖 WDFQUEUE、WDFREQUEST、user buffer、MDL、Driver Isolation、ApiValidator、KASAN/低资源和签名分发限制。
- [ ] 明确拒绝 rootkit、绕过、隐藏、持久化、提权武器化等恶意内容。
- [ ] 与 linux-driver-development、embedded-firmware、test-engineering、code-audit 边界清楚。

## 2024-2026 新坑速查

- HVCI、Kernel-mode Code Integrity、Secure Boot、attestation/WHQL 签名要求影响加载和发布路径。
- Windows 11 与新硬件平台下，HLK playlist、驱动隔离、内存完整性、DMA remapping、WDAC/企业 EDR 策略和驱动阻止列表更常见。
- WDF 版本、WDK/SDK 与目标 OS matrix 不一致会造成开发机通过、客户环境失败。
- ETW/WPP 与现场采集越来越重要；没有可观测性会放大偶发驱动问题。
- UMDF 能覆盖更多设备场景时，内核驱动需要证明必要性和安全收益。
- Verifier、Special Pool、IRQL checking、DMA checking、deadlock detection 应成为回归门禁的一部分。
- 供应链要求签名、可追溯构建、SBOM、发布 artifact、driver package hash 和版本回滚记录。
- 虚拟化、VBS、Hyper-V、USB/PCIe 透传和企业安全策略会改变驱动调试与部署路径。
- WDK with Visual Studio 版本、HLK 25H2/26H1、driver isolation、InfVerif、HLK unreferenced file checks 和 CodeQL/Static Tools 路径需要随目标 OS 更新。
- Windows Rust driver 仍偏实验/评估，不默认生产推荐；生产采用需额外证明 WDK/EWDK、Rust toolchain、FFI、panic/alloc、签名/HLK 和 OS matrix。

## 外部资料基线

- Microsoft Learn Windows Hardware/Drivers、WDK headers、KMDF/UMDF/WDM 文档、Microsoft driver samples、目标 Windows build release notes 是驱动模型、IRQL、PnP/Power 和 WDF 对象语义的一手口径。
- INF/SetupAPI、Driver Store、catalog/signing、HLK/playlist、attestation/WHQL、HVCI/Secure Boot 策略是安装、签名和发布的一手口径。
- WinDbg、public/private symbols、Driver Verifier/WDF Verifier、ETW/WPP、setupapi.dev.log、HLK result package 和 crash dump 是排障证据；DebugView/printf 只能辅助。
- 设备规范、bus/class 规范、Hardware ID/Compatible ID、ACPI/USB/PCIe/HID/NDIS/StorPort 资料是设备绑定和协议边界证据。
- OSR、社区 GitHub、kernel security 资源只能作背景和安全审计线索，不得引入 rootkit、EDR bypass、隐藏、绕过或攻击性实现模式。
- 未能访问目标 Windows build、WDK/KMDF 版本、INF/package、Verifier/HLK 证据或真实设备栈时，只能列证据缺口，不能宣称可发布。

## 相邻技能边界

- `windows-driver-development` 负责 Windows WDM/KMDF/UMDF、INF、PnP/Power、IRQL、IOCTL、WinDbg、Verifier、ETW/WPP、HLK 和签名发布。
- `linux-driver-development` 负责 Linux kernel module、Kbuild/Kconfig、device model、DT/ACPI、Linux DMA/IRQ/PM、oops/panic 和 Linux 发布兼容。
- `embedded-firmware` 负责 MCU/SoC、bare-metal、RTOS、BSP/HAL/PAC、板级 bring-up、外设寄存器和固件 OTA。
- `hdl-fpga-asic` 负责 RTL、FPGA、ASIC、时序、综合、CDC/RDC、SVA/UVM 和硬件签核。
- `test-engineering` 负责测试矩阵、HIL/CI、HLK 之外的系统回归、flaky 和证据包设计。
- `code-audit` 负责驱动改动后的最终影响面、风险、证据和结论收口。