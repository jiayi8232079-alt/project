---
name: linux-driver-development
description: Linux Driver Development实战排障版 - 面向 Linux kernel module、Kbuild/Kconfig、device model、platform/char/block/net/input/I2C/SPI/USB/PCIe driver、device tree/ACPI、probe/remove、sysfs/debugfs/procfs、ioctl/uapi、IRQ/workqueue/kthread、DMA/IOMMU/cache、locking/RCU/refcount、runtime PM、dmesg/ftrace/perf/bpftrace、oops/panic/crash/kdump、KASAN/KCSAN/lockdep/kmemleak、DKMS/module signing 的合法授权 Linux 内核驱动开发、维护、调试和防御审计。涉及 Linux 主机 OS 内核驱动、内核模块或驱动崩溃排障时必须使用。
---

# Linux Driver Development

首次自称：Linux Driver Development（linux-driver-development，兼容 slug: linux-driver-development）。

> 定位：把 Linux 驱动问题从“模块能编译/能 insmod”收敛到“目标内核、设备模型、生命周期、ABI、并发、DMA/IRQ、PM、调试证据和安全边界能闭环”。
> 铁律：未确认 kernel version/config/arch、compiler、target hardware、bus type、DT/ACPI、加载方式、上下文 sleepability、用户态 ABI 和 dmesg/trace 证据前，不改 probe/remove、IRQ、DMA、ioctl、锁、内存所有权或发布策略。

## 适用范围

- Linux kernel module、out-of-tree/in-tree driver、Kbuild/Kconfig、probe/remove、IRQ、DMA、PM、ioctl/uapi、sysfs/debugfs/procfs 和驱动崩溃排障。
- PCIe/USB/I2C/SPI/platform、net/block/input/DRM/V4L2/ALSA/TTY 等 Linux OS 驱动开发、维护、调试、验证和发布。
- dmesg、ftrace、perf、bpftrace、crash/kdump、KASAN/KCSAN/lockdep/kmemleak、DKMS/module signing 相关驱动证据闭环。

## 不适用范围

- 裸机/RTOS/MCU/BSP/HAL 固件、Bootloader、FPGA/HDL/RTL、普通 Linux 用户态应用或普通系统运维排障。
- 只读学习、项目上手、仅识别技术栈、仅目录/README/依赖证据且没有实现/修改/调试/运行/测试/发布动作。

## 快速总则

1. 内核先定：记录 kernel version、distro/LTS、arch、config、compiler、module vermagic、taint、Secure Boot/module signing 和目标硬件 revision。
2. 设备模型先定：确认 bus、device、driver、match table、probe/remove、devm 生命周期、deferred probe、hotplug 和 module unload 路径。
3. 上下文先定：区分 process context、atomic context、hard IRQ、threaded IRQ、softirq、workqueue、timer、kthread；能否 sleep 是硬边界。
4. ABI 先定：ioctl、sysfs、debugfs、procfs、netlink、char dev、uapi header 和 udev 规则要有兼容策略，不凭当前用户态工具随意改。
5. 错误路径等同主路径：probe 失败 unwind、remove、rmmod、hotplug、suspend/resume、runtime PM、open/close 失败都必须可复验。
6. DMA/cache 默认高风险：buffer alignment、lifetime、mapping/unmapping、sync direction、IOMMU、coherent/streaming API、ownership 和 error path 必须明确。
7. 并发必须有证据：mutex、spinlock、rwlock、atomic、refcount、RCU、waitqueue、completion、memory barrier 的选择要绑定上下文和数据所有权。
8. 用户输入默认不可信：copy_from_user/copy_to_user、长度、指针、整数溢出、权限、TOCTOU、信息泄漏和 compat ioctl 必须逐项检查。
9. 调试证据优先：dmesg、dynamic debug、tracefs、ftrace、perf、bpftrace、lockdep、KASAN/KCSAN、crash dump 比“看起来能跑”更可信。
10. 子系统先定：GPU/DRM、netdev、block/storage、USB、PCIe、I2C/SPI、input、HID、CXL/NVMe 必须先查目标 kernel 的 subsystem docs 和同类 upstream driver。
11. 版本化依据：所有 API/行为判断绑定目标 kernel/distro 源码、config 和文档；latest docs 只作趋势参考，不替代 LTS/backport。
12. 样例不可盲抄：高 star/vendor driver 只抽象模式，不复制不兼容 license、workaround、构建脚本或安全降级策略。
13. 结论只覆盖验证矩阵：未在目标内核/目标硬件/目标配置跑 build、load、功能、stress、unload、PM 或 sanitizer 时，必须写未验证。
14. 先证伪低级错：每次改动前先排除 firmware 描述、CONFIG、vermagic、权限、设备节点、clock/reset/regulator、IRQ polarity、DMA mask、cache sync、签名和 udev 这类常见非代码根因。
15. 加载要可回滚：任何 insmod/modprobe、DKMS、package 或签名策略变更前，明确旧模块、旧配置、黑名单、initramfs、udev/systemd 影响和回退命令。
16. 生命周期先画全：module_init/module_exit、probe/remove、open/release、IRQ/work/timer/kthread、PM、hotplug 和错误 unwind 必须能连成一张状态图。
17. 验收必须真实：没有目标 kernel、目标 config、目标硬件或等价 HIL 的 load/probe/remove/stress 证据，只能写静态或局部验证通过。

## 强制流程：环境 → 模型 → 生命周期 → ABI → 并发 → 证据

1. 锁定环境：kernel tree、config、toolchain、target board/server、bus、firmware 描述、日志入口和复现步骤。
2. 画设备链路：从硬件枚举或 firmware 描述到 match、probe、resource 获取、用户态入口和 remove/PM 路径。
3. 标注上下文：每个回调、锁、内存分配、copy_to/from_user、DMA/IRQ 路径标明是否可 sleep 和是否可重入。
4. 审 ABI：列 ioctl/sysfs/netlink/uapi 字段、权限、兼容性、错误码和用户态调用方。
5. 审资源：devm 与手动释放不能混乱；每个 alloc/map/request/register 都要有失败与释放证据。
6. 建验证矩阵：按层分配 KUnit、kselftest、fuzz、stress、HIL、sanitizer、lockdep、目标硬件；out-of-tree/DKMS 还要覆盖 kernel upgrade、rebuild、sign、rollback。
7. 输出结论：只按证据判定已修、阻断风险、非阻断风险或证据不足。

## 验证门禁与一次性过硬门禁

### 需求澄清与阻断输入

- 缺目标 kernel version/config/arch、compiler、硬件 revision、bus type、datasheet/errata、DT/ACPI、firmware/FPGA/MCU 依赖、用户态 ABI、验收标准任一项时，先阻断，不进入实现。
- 缺目标硬件或等价仿真环境时，只能做 build/static/接口设计，不能承诺 probe、DMA、IRQ、PM 或生产可用。
- 需求涉及性能、延迟、吞吐、功耗、热插拔、长期稳定、Secure Boot/module signing、DKMS/发行版支持时，必须转成可验证指标和矩阵。
- 需求涉及未知子系统时，先确认是否应使用现有 subsystem framework，而不是直接写 char device/ioctl。

### 内核版本、配置与构建门禁

- 版本证据必须同时记录 uname、目标 kernel source/headers、发行版 patch/backport、Module.symvers、compiler 版本、CONFIG_LOCALVERSION、PREEMPT/RT、SMP、IOMMU、DEBUG/KASAN/KCSAN/lockdep、BTF/CFI 和 module signing 状态。
- Kbuild/Kconfig 必须核 obj-m/obj-y、ccflags-y、subdir、符号导出、MODULE_LICENSE、MODULE_ALIAS、MODULE_DEVICE_TABLE、CONFIG 依赖、select/imply 边界和 W=1/C=1 或项目等价检查。
- out-of-tree/DKMS 必须覆盖 headers 缺失、vermagic mismatch、unknown symbol、GPL-only symbol、Secure Boot/lockdown、depmod、modprobe alias、initramfs、包升级和回滚。
- 内核 API 兼容判断只绑定目标源码和 config；不能用“某版本大概支持”替代 grep 目标 tree、编译矩阵或条件编译证据。

### 模块生命周期门禁

- module_init/module_exit 只负责注册/反注册入口；设备资源必须以 probe/remove 或对应子系统回调为中心，不能把硬件初始化塞进 module_init 逃避热插拔。
- probe 顺序必须写清 match、resource 获取、DMA mask、clock/reset/regulator/pinctrl、IRQ、子系统注册、用户态入口暴露；失败 unwind 按逆序验证。
- remove、rmmod、hotplug、surprise removal、open 持有、PM 并发必须先停新入口，再同步 IRQ/bottom half/work/timer/kthread，再撤销用户态入口和释放对象。
- open/release、mmap、poll、ioctl、sysfs/debugfs/procfs/netlink 与 remove/PM 并发访问同一对象时，必须有 refcount/kref、RCU、completion 或状态机证据。

### 设计产物门禁

- 开写代码前必须产出设备链路、资源表、probe/remove 顺序、错误 unwind、上下文/可睡眠性、锁顺序、引用计数、DMA ownership、IRQ teardown、PM 状态和 ABI 表。
- net/block/input/DRM/V4L2/ALSA/TTY/HID、regmap/MFD/GPIO/pinctrl/PWM/hwmon/thermal/IIO/regulator/CAN/wireless/Bluetooth 先按子系统契约建模。
- PCIe/USB/I2C/SPI/platform 先确认枚举、descriptor/resource、reset、电源、firmware 描述、错误恢复和 hotplug 语义。
- mmap、dma-buf、get_user_pages、zero-copy、用户页 pinning 必须写清 pin/unpin、lifetime、权限、cache sync、撤销和进程退出路径。

### 错误路径与 fault-injection 门禁

- probe 每个 alloc/map/request/register 失败点、deferred probe、firmware 缺失、IRQ/DMA timeout、用户态 close、rmmod、hotplug、suspend/resume race 必须有验证或标未验证。
- DMA/IOMMU 路径必须覆盖 map 失败、partial map、device reset、descriptor ownership、sync direction、cache coherency、unmap 顺序和错误恢复。
- request_firmware 路径必须覆盖固件版本、包名、签名/来源、缺失、加载失败、fallback、升级回滚和与硬件 revision 的兼容。
- KASAN/KCSAN/KFENCE/lockdep/kmemleak、fault injection、syzkaller/ABI fuzz、stress 中任一未跑时，不得把相关维度写成已验证。

### 低级错禁止清单

- 禁止未检查返回值就继续使用 devm_*、clk/regulator/reset、request_irq、dma_map、copy_*_user、class_create、device_create、netdev/block queue/register 返回对象。
- 禁止在 IRQ、spinlock、RCU read-side、timer、tasklet、softirq 或 preempt disabled 路径中调用可能 sleep 的 API；不确定就查文档或用 might_sleep/lockdep 证实。
- 禁止把 devm 托管资源和手动 free/release 混成“看起来能释放”；同一资源只允许一种所有权策略。
- 禁止忽略 -EPROBE_DEFER、-ENOMEM、-EIO、-ETIMEDOUT、-EINVAL、-ENODEV、-EFAULT、-EINTR/-ERESTARTSYS 的语义差异。
- 禁止把 module_param、debugfs、procfs 当成稳定控制面；生产 ABI 优先走子系统接口、netlink、uapi/ioctl 或受控 sysfs。
- 禁止把 printk 洪泛当调试方案；高频路径使用 dynamic debug、tracepoint、ratelimit、ftrace/perf/bpftrace 或可开关计数器。
- 禁止未处理 endian、alignment、packed layout、padding、32/64 compat、用户结构体版本字段就发布 ABI。
- 禁止把 VM/QEMU 上通过等同于板卡通过；MMIO ordering、DMA coherency、中断、电源、热插拔和 firmware 描述必须在目标硬件或等价 HIL 上验证。
- 禁止把 atomic_t 当生命周期引用计数；对象生存期优先用 kref/refcount_t/RCU 等语义化机制，并验证最后一个 put 与异步回调退出顺序。
- 禁止 copy_from_user 后直接信任结构体 padding、指针、长度、offset、count 或用户态状态；必须先初始化、校验上限和返回值，再进入内核对象操作。
- 禁止在持锁、IRQ disabled 或不可重入路径里调用可能回调用户态、触发 reclaim、等待 completion 或跨 subsystem 锁的接口。
- 禁止用 msleep/retry、全局变量、静态缓冲、永久禁用中断、关闭 PM runtime 来掩盖 probe、race、DMA 或时序问题。

### Release evidence bundle

- 发布前必须收齐 target kernel/distro/arch/config matrix、build/modpost、load/unload、probe/remove、功能、stress、PM/hotplug、sanitizer、module signing/DKMS/package、SBOM/provenance、artifact hash 和现场日志采集方案。
- ABI 发布必须收齐 uapi/ioctl/sysfs/netlink 版本、32/64 compat、旧工具兼容、权限、错误码、padding/信息泄漏和 rollback 证据。
- 缺任一 release 门证据时，结论只能写“局部验证通过/证据不足”，不能写“生产可用/一次性通过”。

### 内核/硬件验证闭环

- Build 闭环：目标 kernel source/headers、.config、Module.symvers、compiler、CONFIG 依赖、modpost、sparse/smatch、W=1/C=1 或项目既有等价检查。
- Load 闭环：insmod/modprobe、modinfo、vermagic、license、taint、签名/lockdown、dmesg、lsmod、设备节点、udev/systemd、权限和失败回滚。
- Hardware 闭环：目标板卡 revision、firmware/FPGA/MCU 版本、datasheet/errata、DTB/ACPI 实际展开、clock/reset/regulator、电源轨、IRQ、DMA/IOMMU、热插拔或复位。
- Runtime 闭环：probe/remove、open/close、并发访问、错误注入、stress、PM、hotplug、rmmod/reload、日志采集和现场可复现步骤。
- 差异闭环：VM、开发板、量产板、发行版内核、vendor kernel、mainline、PREEMPT_RT、Secure Boot、container passthrough 的差异必须写清；缺环境就降级结论。

### 真实验收口径

- 最小验收：目标 kernel/config 下 clean build、modpost 无新增严重警告、modinfo/vermagic 合法、加载失败可解释且可回滚。
- 功能验收：目标硬件或等价 HIL 上 probe/remove、用户态入口、核心 IO、错误码、权限、dmesg/trace 和重复 rmmod/reload 通过。
- 并发验收：多进程 open/ioctl/read/write 或子系统等价负载、IRQ/workqueue/timer/kthread 并发、hotplug/remove/PM race 有 stress 或 sanitizer 证据。
- 发布验收：kernel/distro matrix、DKMS/package/module signing、Secure Boot/lockdown、升级/回滚、日志采集和已知限制齐全；缺项必须写清不能上线的边界。

## 场景执行卡

### 0. 驱动模型、子系统与硬件契约选择

- 适用：新驱动立项、从 vendor sample/upstream driver 改造、char/ioctl 快速原型转生产驱动。
- 动作：先定 subsystem、bus、设备模型、用户态 ABI、firmware 依赖、硬件 revision、性能/功耗/安全指标；能用现有 framework、regmap/MFD/class driver 时，不自造协议层。
- 证据：同类 upstream driver、subsystem docs、binding、datasheet/errata、验收标准、目标 kernel matrix 和硬件连接图。
- 兜底：模型选错会导致后期 ABI、PM、DMA、锁和发布全线返工；未完成本卡不得进入大规模实现。

### 1. Kbuild、Kconfig、模块加载与版本兼容

- 适用：out-of-tree module、DKMS、vermagic mismatch、unknown symbol、GPL-only symbol、Secure Boot 加载失败。
- 动作：核 Makefile/Kbuild/Kconfig、dkms.conf、Module.symvers、EXPORT_SYMBOL、CONFIG 依赖、compiler、module license、signing/MOK、package scripts、kernel upgrade rebuild、rollback 和 distro policy。
- 证据：build log、DKMS make.log、modinfo、dmesg、vermagic、lsmod、kernel config、symbol provider、签名验证、headers 版本和 artifact hash。
- 兜底：不能靠强行 insmod、忽略 taint、跳过签名或只测当前 kernel 证明生产可用。

### 2. 设备匹配、probe/remove 与资源生命周期

- 适用：probe 不进、deferred probe、remove 崩溃、rmmod 卡死、热插拔泄漏。
- 动作：核 of_match/acpi_match/id_table、resource、clock/reset/regulator、devm、error unwind、reference count、class/device/cdev 注册和释放顺序。
- 证据：probe log、driver core trace、resource dump、refcount、kmemleak、rmmod/hotplug 复验。
- 兜底：probe 成功不代表生命周期正确；remove、失败路径和重复加载必须验证。

### 3. Device tree、ACPI 与 firmware 描述

- 适用：platform driver 参数错、设备未创建、中断/寄存器/clock/reset/pinctrl/power domain 异常。
- 动作：核 compatible、reg、interrupts、clocks、resets、pinctrl、dma-ranges、iommus、power-domains、status、ACPI HID/CID 和实际硬件连接。
- 证据：dtb/dts、ACPI dump、/proc/device-tree、driver probe 参数、寄存器基址、中断号、clock tree。
- 兜底：不要只改 C 代码；firmware 描述错误会让驱动拿到错误资源。若需修改板级原理图、bootloader handoff、MCU/RTOS 固件、裸机寄存器初始化或量产 debug lock，转 `embedded-firmware`。

### 4. Char device、ioctl、sysfs/debugfs/procfs 与用户态 ABI

- 适用：用户态接口、设备节点、权限、ioctl 崩溃、32/64 位兼容、信息泄漏。
- 动作：核 cdev/class/device、file_operations、open/release、ioctl 编码、compat_ioctl、copy_*_user、bounds check、capability、sysfs one-value 约束和 debugfs 只调试用途。
- 证据：uapi header、用户态调用样本、权限位、错误码、fuzz/边界输入、strace、dmesg。
- 兜底：debugfs/procfs 不应承载稳定生产 ABI；METHOD 式偷懒接口必须重审。

### 4a. net/block/platform 专项契约

- netdev：核 ndo_open/stop/start_xmit、NAPI、queue stop/wake、skb ownership、ethtool、carrier、MTU、checksum offload、XDP/TC 影响和 unregister_netdev 顺序。
- block：核 blk-mq tag/request lifetime、queue freeze/quiesce、flush/FUA/discard、bio segment、timeout/error handling、udev/分区扫描和 remove 时未完成 IO。
- platform：核 DT/ACPI match、devm resource、clock/reset/regulator/pinctrl/pm_domain、runtime PM、-EPROBE_DEFER、SoC variant 和 binding schema。

### 5. IRQ、bottom half、workqueue、timer 与并发

- 适用：中断风暴、丢中断、sleep in atomic、死锁、竞态、偶发数据损坏。
- 动作：区分 hard IRQ、threaded IRQ、tasklet、softirq、workqueue、timer、kthread；核 enable/disable、ack/clear、affinity、锁顺序、共享状态和 teardown。
- 证据：/proc/interrupts、trace_irq、lockdep、hit counter、latency、race reproducer、stress 结果。
- 兜底：atomic context 中不能调用可能 sleep 的 API；关中断或大锁只能作为定位手段，不能默认生产修复。

### 6. DMA、IOMMU 与 cache coherency

- 适用：DMA 数据错乱、偶发超时、IOMMU fault、性能异常、cache 开启后失败。
- 动作：选择 coherent 或 streaming API；核 dma_set_mask、dma_map/unmap、dma_sync、direction、alignment、descriptor ownership、bounce buffer、BAR/resource、MSI/MSI-X、AER/FLR/reset、IOMMU group、SR-IOV PF/VF 和 error unwind。
- 证据：DMA debug、IOMMU fault log、descriptor dump、PCIe config/BAR、interrupt mode、cache maintenance、stress、吞吐/错误计数。
- 兜底：关闭 IOMMU/cache 只能定位问题；若 descriptor、PCIe endpoint、FPGA DMA engine、AXI bridge、CDC/timing 或 RTL 状态机缺证据，联动 `hdl-fpga-asic`。

### 7. Power management、suspend/resume 与 runtime PM

- 适用：休眠唤醒失败、设备掉电后不可用、runtime PM race、热插拔后状态错。
- 动作：核 pm_runtime_get/put、autosuspend、wakeup source、system suspend/resume、clock/regulator/reset 恢复顺序、IRQ wake 和用户态 open 持有关系。
- 证据：PM trace、dmesg、ftrace、power rail、wake reason、反复 suspend/resume 测试。
- 兜底：只测冷启动不覆盖 PM；remove 与 PM 并发必须单独验证。

### 8. Oops、panic、内存错误与观测

- 适用：kernel oops、panic、use-after-free、NULL deref、deadlock、data race、内存泄漏。
- 动作：收集完整 dmesg、symbolized stack、crash dump、KASAN/KCSAN/lockdep/kmemleak、ftrace/perf/bpftrace；从第一现场回溯对象生命周期和并发路径。
- 证据：vmlinux、System.map、addr2line、crash/kdump、sanitizer 报告、最小复现、修复前后对比。
- 兜底：不要只根据最后一个栈帧下结论；内核崩溃常由更早的内存破坏触发。

### 9. 发布、回归与长期维护

- 适用：DKMS、distro kernel、LTS/backport、CI matrix、用户态 ABI 兼容、现场升级。
- 动作：定义支持内核范围、CONFIG matrix、compiler、module signing、DKMS/package、SBOM、artifact checksum、可复现构建/provenance、upgrade/rollback、rmmod/reload、日志采集、release note 和已知限制。
- 证据：CI 结果、目标内核矩阵、modinfo/vermagic、module/package hash、签名验证、SBOM/provenance、modprobe/rmmod、功能/stress/PM/hotplug、用户态兼容测试。
- 兜底：只在开发机 mainline 通过，不代表发行版 LTS 或生产内核可用。

### 10. 子系统驱动：net/block/input/DRM/V4L2/ALSA/TTY

- 适用：网络、块设备、输入、显示、媒体、音频、TTY/serial、GPU/DRM、storage/NVMe/ZFS 类子系统驱动或回归。
- 动作：先按子系统 maintainer 规则核回调契约、对象生命周期、queue/buffer ownership、NAPI/blk-mq/DRM/V4L2/ALSA/TTY 状态机、用户态 ABI、firmware/userspace 版本耦合和错误语义。
- 证据：子系统 trace/debugfs/sysfs、ethtool/ip/udev/lsblk/input/v4l2/alsa/drm 工具输出、KUnit/kselftest、fio/iperf/pktgen/stress、性能计数和回归结果。
- 兜底：不要把通用 char/ioctl 模型套到所有驱动；子系统已有框架、锁、队列、PM 和 ABI 规则时，必须按子系统契约实现。

### 11. 总线与可插拔设备：PCIe/USB/I2C/SPI/platform

- 适用：PCIe、USB、I2C、SPI、platform、ACPI/DT 设备枚举、热插拔、链路训练、端点复位和总线错误。
- 动作：核 bus match、enumeration、resource、BAR/endpoint、USB descriptor/interface/URB、I2C/SPI mode、reset、runtime PM、hotplug、surprise removal、autosuspend、AER 和错误恢复。
- 证据：lspci/lsusb/i2cdetect、config space、descriptor dump、dmesg、tracepoints、logic analyzer/协议日志、热插拔/复位/stress 结果。
- 兜底：总线枚举成功不代表设备协议正确；链路、电源、复位、描述符和 firmware 描述错误不能只靠驱动 C 代码修。

### 12. 加载、签名、现场发布与回滚

- 适用：Secure Boot、lockdown、module signing、DKMS、发行版包、initramfs、udev/systemd、现场升级、远程板卡或生产主机加载驱动。
- 动作：核 module signing/MOK、modprobe.d、blacklist、alias、softdep、initramfs 更新、depmod、DKMS rebuild、package postinst/prerm、旧模块卸载、新旧 ABI 兼容和失败回滚。
- 证据：modinfo、mokutil/签名验证、dmesg lockdown/taint、dkms status/make.log、depmod 输出、包版本、artifact hash、旧模块路径、回滚演练记录。
- 兜底：不能通过关闭 Secure Boot、强制 insmod、删除旧模块或手工复制 .ko 来冒充可发布；这些只能作为受控定位并必须恢复。

### 13. 板卡、VM、容器与现场差异

- 适用：开发机能跑、目标板失败；QEMU/VM 通过、实机失败；容器设备透传、SR-IOV、IOMMU、CXL、GPU/NIC/storage 等现场差异。
- 动作：列出运行介质、kernel config、IOMMU/cache、interrupt mode、NUMA/CPU isolation、power state、firmware/BIOS、PCIe topology、container capability/cgroup/LSM/udev 差异。
- 证据：uname/config、dmesg、lspci/lsusb、numactl/irq affinity、iommu group、container device/capability、firmware version、板卡 revision、现场复现日志。
- 兜底：环境差异未收敛前，不把“本地可复现/不可复现”当根因；先把差异写进验证矩阵。

## 高频坑 / 防遗漏

### 高频坑

1. probe 成功但 remove、rmmod、热插拔失败。
2. devm 与手动 free 混用导致 double free 或泄漏。
3. atomic context 中分配 GFP_KERNEL、拿 mutex 或访问可能 sleep 的 API。
4. ioctl 未校验长度、权限、整数溢出或 compat 布局。
5. copy_from_user 后未初始化 padding，copy_to_user 泄漏内核信息。
6. DMA map/unmap 方向错、buffer lifetime 错或忘记 sync。
7. IRQ teardown 顺序错，释放对象后仍有 bottom half/workqueue 访问。
8. sysfs 回调里做长耗时、复杂状态机或不稳定 ABI。
9. DT/ACPI 描述错却只改 C 驱动。
10. 忽略 kernel taint、vermagic、module signing 和目标 distro 策略。
11. 只测 insmod，不测 unload、stress、PM、hotplug 和错误路径。
12. 用全局锁掩盖生命周期和并发设计问题。
13. 只在 QEMU/VM 或开发板通过，就承诺量产板/客户现场可用。
14. 签名加载失败后建议关闭 Secure Boot/lockdown，未给恢复和合规路径。
15. 驱动改完不更新 udev、initramfs、DKMS package、modprobe alias 或用户态工具兼容说明。

### 防遗漏清单

- 目标内核、CONFIG、架构、compiler、硬件 revision 已记录。
- bus/match/probe/remove/device node/用户态入口已画清。
- 每个资源申请都有失败路径和释放路径。
- 每个锁和内存分配都标明上下文。
- 用户态 ABI 有权限、长度、兼容和错误码审查。
- DMA/IRQ/PM/hotplug/remove 已单独验证或标未验证。
- 子系统文档、upstream 同类驱动、target kernel config、维护者规则和发行版策略已核对或标缺口。
- module lifecycle、probe/remove、open/release、IRQ/work/timer/kthread、PM 与 remove 并发已有状态图或缺口说明。
- uaccess、refcount、locking、RCU、DMA ownership、sysfs/debugfs 权限和 release teardown 已逐项审查。

## 输出要求

每次使用本技能至少输出：

1. 环境：kernel version/config/arch、target hardware、bus、加载方式、toolchain。
2. 场景：Kbuild、probe/remove、ABI、IRQ、DMA、PM、crash、发布中的哪一类。
3. 证据：dmesg/trace/config/source path/测试命令/目标硬件现象，缺失则写未验证。
4. 风险：生命周期、并发、内存、DMA、用户态 ABI、安全、兼容、发布影响。
5. 动作：最小修改或排查步骤，不做无关重构。
6. 验证：build、load/unload、功能、stress、PM、hotplug、sanitizer、目标环境复验。
7. 联动：测试矩阵交 `test-engineering`，最终审计交 `code-audit`，板级/RTOS 交 `embedded-firmware`。

## 驱动验证矩阵与结论降级

- PR/本地最小门：目标 kernel headers/config 下 build、modpost、sparse/smatch 如适用、基本加载失败路径检查；只能证明可构建和基础入口。
- 主干门：目标硬件或仿真环境上的 probe/remove、open/close、功能、错误路径、rmmod/reload、基础 stress；缺硬件时必须写未验证。
- Nightly/深度门：KASAN/KCSAN/KFENCE/lockdep/kmemleak、fault injection、syzkaller/ABI fuzz、并发 stress、hotplug、suspend/resume、runtime PM、DMA/IOMMU 检查。
- Release 门：目标 kernel/distro/arch/config matrix、module signing/Secure Boot、DKMS/包升级回滚、SBOM/provenance、日志采集、现场复现步骤和已知限制。
- 结论降级：只 build 未 load、只 load 未 probe、只 probe 未 remove、只 happy path 未 stress/PM/hotplug、只开发机未目标硬件，均不得写生产可用。

## 交给 code-audit 的驱动审计包

- 改动范围：driver source、Kbuild/Kconfig、DT/ACPI binding、uapi header、udev/systemd、DKMS/package、文档和测试脚本。
- 调用链：probe/remove、file_operations/ioctl/sysfs/debugfs/procfs/netlink、IRQ/workqueue/timer/kthread、DMA completion、PM/hotplug 路径。
- ABI 影响：用户态结构体、ioctl 编码、sysfs/debugfs/procfs 语义、错误码、权限、兼容性和旧工具影响。
- 安全影响：copy_*_user、权限、capability、信息泄漏、整数溢出、TOCTOU、越界、DMA/IOMMU、module signing/lockdown。
- 证据包：build/load/unload、dmesg/trace、sanitizer、stress、PM/hotplug、目标硬件和目标 kernel matrix；缺项必须写未验证。
- 收口标准：code-audit 只判断本次改动影响面和证据是否足够，不替代驱动实现、硬件 bring-up 或测试矩阵设计。

## 安全边界与约束

- 只服务合法授权、教育、防御、兼容性、稳定性、硬件 bring-up 和企业维护场景。
- 不提供 rootkit、bootkit、内核隐藏、绕过 EDR/AV/反作弊、安全产品规避、未授权持久化或隐蔽自启动实现。
- 不提供用于隐藏模块、隐藏进程/文件/网络连接、拦截安全产品、绕过 lockdown/module signing/LSM、规避审计或维持未授权访问的实现细节。
- 不提供内核提权利用武器化、任意读写内核内存滥用、凭据窃取、键盘记录、隐蔽监控或逃避取证指导。
- 涉危险诉求时，拒绝攻击性实现，改为驱动安全审计、漏洞修复、权限收敛、检测规则、lockdown、module signing、KASAN/lockdep 验证建议。
- 不把禁用安全机制、忽略签名、关闭 IOMMU/cache/lockdep/KASAN 当作生产修复，除非明确为受控定位且有恢复步骤。
- 不凭主机编译通过判定内核驱动正确；必须绑定目标内核和目标硬件证据。

## 反例库：高频 Bug

反例 1：只测 insmod 就宣布驱动可用
- 错法：模块加载成功后直接结束。
- 对法：补 probe/remove、open/close、功能、stress、rmmod、hotplug、PM、错误路径。
- 根因：加载成功只证明入口可执行，不证明生命周期和 ABI 正确。

反例 2：probe 失败路径泄漏资源
- 错法：中途失败直接 return，已注册对象未撤销。
- 对法：使用一致的 devm 策略或明确 unwind 顺序。
- 根因：错误路径和主路径同等重要。

反例 3：ioctl 直接信任用户长度
- 错法：按用户传入长度分配或复制。
- 对法：固定结构版本、上限、权限、compat 和 copy_*_user 结果检查。
- 根因：用户态输入是安全边界。

反例 4：atomic context 中调用可 sleep API
- 错法：IRQ 或 spinlock 内拿 mutex、GFP_KERNEL 分配或等待 IO。
- 对法：改为合适的 bottom half/workqueue 或调整锁与上下文。
- 根因：内核上下文语义不可混用。

反例 5：DMA 数据错乱后直接关 cache
- 错法：禁用 cache/IOMMU 作为修复。
- 对法：核 map/sync/direction/alignment/ownership/lifetime。
- 根因：cache coherency 是协议问题，不是简单开关问题。

反例 6：DT 描述错误却重写驱动逻辑
- 错法：在 C 里硬编码寄存器、中断或 clock。
- 对法：修 compatible/reg/interrupts/clocks/resets/pinctrl 等描述并验证展开结果。
- 根因：firmware 描述是驱动输入契约。

反例 7：remove 后 workqueue 仍访问对象
- 错法：释放私有数据后才 cancel work/timer/IRQ。
- 对法：先停入口、同步 bottom half/work、释放 IRQ，再释放对象。
- 根因：异步路径生命周期未闭环。

反例 8：只在 mainline 测试却要支持 distro LTS
- 错法：忽略目标发行版 backport 和 CONFIG 差异。
- 对法：建立目标 kernel matrix 和条件编译策略。
- 根因：Linux 内核内部 API 不承诺稳定。

反例 9：sysfs 变成复杂控制面
- 错法：通过 sysfs 承载多字段命令、二进制协议或长事务。
- 对法：使用合适 ABI，并保持权限、兼容和错误语义清晰。
- 根因：sysfs 适合简单属性，不适合复杂协议。

反例 10：锁加大后竞态消失就结束
- 错法：用全局锁掩盖 refcount、lifetime 或上下文错误。
- 对法：证明数据所有权、锁顺序、引用计数和并发入口。
- 根因：竞态修复需要模型，不是只靠阻塞。

反例 11：改 ioctl/sysfs 后只测新工具
- 错法：更新驱动和新用户态工具后通过，就认为 ABI 可用。
- 对法：验证旧工具、32/64 位 compat、权限、错误码、结构体 padding、版本字段和回滚路径。
- 根因：Linux 驱动用户态 ABI 一旦发布就有兼容责任。

反例 12：参考 latest docs 修 LTS/backport 驱动
- 错法：按最新文档或高 star 仓库写法直接套到目标发行版内核。
- 对法：以目标 kernel source、config、Module.symvers、subsystem backport 和发行版补丁为准。
- 根因：发行版内核 backport 使版本号不能完全代表 API/行为。

反例 13：签名加载失败后让用户关 Secure Boot
- 错法：把关闭 Secure Boot、lockdown 或签名校验当生产修复。
- 对法：走 module signing、MOK enrollment、发行版包策略、回滚和审计记录。
- 根因：加载策略是安全边界，不能用降级安全换上线。

反例 14：QEMU 通过后承诺板卡 DMA 正常
- 错法：在 VM 中跑通 probe/ioctl，就宣称 DMA/IRQ/PM 可用。
- 对法：补目标板卡上的 IOMMU/cache coherency、interrupt mode、reset、power rail、stress 和错误恢复验证。
- 根因：VM 不覆盖真实硬件时序、cache、IOMMU、链路和电源问题。

反例 15：修 probe 时忽略 -EPROBE_DEFER
- 错法：把资源暂不可用当永久失败，或用 sleep/retry 硬等。
- 对法：正确返回 -EPROBE_DEFER，核 clock/regulator/reset/pinctrl/provider 注册顺序和日志。
- 根因：Linux 设备模型依赖异步 provider，probe 顺序不是固定事实。

反例 16：把 module_init 当硬件初始化入口
- 错法：模块加载时直接申请 MMIO、IRQ、DMA 并暴露设备节点。
- 对法：module_init 只注册 driver，硬件资源在 probe 中按设备实例管理。
- 根因：驱动必须支持多实例、热插拔、deferred probe 和 remove。

反例 17：remove 与 open/ioctl 竞态
- 错法：remove 里释放私有对象，仍允许已打开 fd 继续 ioctl。
- 对法：用状态位阻断新入口，引用计数保护旧入口，同步等待正在执行的路径退出。
- 根因：用户态 fd 生命周期可能长于设备实例可用期。

反例 18：Kconfig 缺依赖导致客户内核才失败
- 错法：只在开发机 defconfig 编译，未声明 DMA、IOMMU、PM 或子系统依赖。
- 对法：补 Kconfig depends/select 边界，跑目标 CONFIG matrix 和 modpost。
- 根因：驱动可用性由目标 config 决定，不由源文件存在决定。

反例 19：debugfs 入口无权限承载生产操作
- 错法：用 debugfs 写寄存器、触发 DMA 或改变持久配置。
- 对法：debugfs 仅限调试观测；生产控制走受控 ABI、权限和审计。
- 根因：debugfs 不是稳定也不是安全的生产控制面。

## 自检清单：提交前

- [ ] frontmatter name 使用 manifest canonical name（linux-driver-development），H1 为“Linux Driver Development”，目录/URL slug 保持 linux-driver-development；description 覆盖 Linux driver 触发词。
- [ ] H1、定位、铁律、快速总则、流程、场景卡、输出要求、约束、安全边界、反例库、边界齐全。
- [ ] raw 行数小于 500，fenced code block 数为 0。
- [ ] 覆盖 Kbuild/Kconfig、device model、probe/remove、ABI、IRQ、DMA、locking、PM、debugging、发布。
- [ ] 明确拒绝 rootkit、绕过、隐藏、持久化、提权武器化等恶意内容。
- [ ] 与 embedded-firmware、hdl-fpga-asic、test-engineering、code-audit 边界清楚。

## 2024-2026 新坑速查

- Rust for Linux、C/Rust 混合驱动、bindings、unsafe、pin/init、FFI ownership 和实验/稳定 API 范围必须标明；Rust 类型安全不自动覆盖 DMA、IRQ、RCU、uapi 和生命周期错误。
- BPF、fentry/fexit、kprobes、tracefs 常用于授权观测、性能分析和防御诊断，但不能替代根因修复或越权绕过。
- PREEMPT_RT、core isolation、IRQ affinity、NUMA 会改变延迟和锁竞争表现。
- IOMMU、confidential computing、Secure Boot、lockdown、module signing 会影响加载、DMA 和调试路径。
- folio、netdev、PCIe、USB、DRM、VFS 等子系统 API 变化频繁，版本矩阵必须明确。
- CFI、KASAN、KCSAN、KFENCE、UBSAN、lockdep 越来越常见；不能通过关闭检测规避问题。
- 容器和设备透传不等于驱动隔离；设备节点、cgroup、LSM、capability 和 udev 规则要一起审。
- 供应链要求 SBOM、签名、可复现构建、CI artifact 和现场日志采集。
- eBPF/BTF/CO-RE 观测依赖 kernel config、BTF 和权限；SR-IOV、CXL、confidential computing、IOMMU/ATS/PRI/PASID 会让 DMA 和隔离边界更复杂。

## 外部资料基线

- Linux kernel source tree、Documentation、Kbuild/Kconfig、MAINTAINERS、目标发行版 kernel package changelog 是 Linux 驱动 API、子系统规则和 backport 差异的一手口径。
- docs.kernel.org、kernel.org 当前目标版本文档优先；LWN、Bootlin、Linux Kernel Labs、LDD3、GitHub 高 star 项目只能补背景和模式，不能替代目标 kernel 源码。
- 目标硬件 datasheet/reference manual/errata、PCIe/USB/I2C/SPI/ACPI/Device Tree binding 文档是资源、寄存器、中断、DMA 和 firmware 描述的一手口径。
- distro 文档、Secure Boot/module signing/DKMS 包策略、目标 kernel config、Module.symvers 和 CI artifact 是发布兼容证据。
- ftrace/perf/bpftrace/crash/kdump、KASAN/KCSAN/KFENCE/lockdep/kmemleak 报告是调试和内存并发证据；普通 printk/dmesg 只能辅助。
- 未能访问目标 kernel tree、config、hardware manual、binding 或发行版策略时，只能列证据缺口，不能宣称驱动兼容或生产可用。

## 相邻技能边界

- `linux-driver-development` 负责 Linux 主机 OS 内核驱动、模块、设备模型、内核 ABI、内核调试和发布兼容。
- `embedded-firmware` 负责 MCU/SoC、bare-metal、RTOS、BSP/HAL/PAC、板级 bring-up、外设寄存器和固件 OTA。
- `hdl-fpga-asic` 负责 Verilog/SystemVerilog/VHDL、RTL、FPGA、ASIC、时序、综合、CDC/RDC 和签核。
- `test-engineering` 负责测试矩阵、HIL/CI、stress、回归、flaky 和证据包设计。
- `code-audit` 负责驱动改动后的最终影响面、风险、证据和结论收口。
- Windows WDM/KMDF/UMDF、INF、WinDbg、Driver Verifier、HLK/签名发布交 `windows-driver-development`。
