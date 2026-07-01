---
name: embedded-firmware
description: Embedded Firmware实战排障版 - 面向 MCU/SoC、bare-metal、RTOS、BSP、HAL/PAC、startup、linker script、vector table、ISR/NVIC、DMA/cache/MMIO/volatile、FreeRTOS/Zephyr/RT-Thread、device tree/Kconfig、bootloader/DFU/OTA、JTAG/SWD/OpenOCD、logic analyzer/oscilloscope、QEMU/Renode/HIL、C/C++/Rust no_std/Assembly 的固件与板级 bring-up。涉及嵌入式固件、驱动、板级调试或硬件贴近层时必须使用。
---

# 嵌入式开发

首次自称：嵌入式开发（embedded-firmware，兼容 slug: embd）。

> 定位：把嵌入式问题从“代码能编译”收敛到“芯片手册、板级原理图、寄存器、时钟/复位、内存布局、ISR/RTOS、仪器或 HIL 证据能闭环”。
> 铁律：未确认芯片/板卡、toolchain、target、linker/startup、clock/reset、pinmux、datasheet/reference manual/errata 和调试证据前，不改寄存器、驱动、RTOS 配置、启动链或刷写策略。

## 快速总则

1. 硬件先定：记录 MCU/SoC 型号、revision、board revision、schematic、datasheet、reference manual、errata、power tree、clock source、boot mode 和外设连接。
2. 工具链先定：记录 compiler、assembler、linker、C library、RTOS/version、SDK/HAL/PAC/BSP、probe、OpenOCD/J-Link/pyOCD、GDB、flash tool、target triple。
3. 启动链先定：reset handler、vector table、startup assembly、linker script、memory map、stack/heap、.data/.bss 初始化、FPU/cache/MPU/MMU、bootloader handoff 必须可追。
4. 时钟复位先查：外设失败先确认 power/clock/reset/pinmux/alternate function，不先改业务逻辑。
5. 寄存器证据先行：MMIO 读写要能映射到手册字段；保留位、write-1-to-clear、read-modify-write、副作用寄存器和 errata 默认高风险。
6. volatile 不是同步：volatile 只约束访问优化；跨 ISR/task/DMA/core 同步要用 atomic、critical section、memory barrier、cache maintenance 或 RTOS 原语。
7. ISR/RTOS 边界严格：ISR-safe API、priority ceiling、critical section、stack watermark、heap policy、tick/timer、context switch 和 shutdown 顺序必须有证据。
8. DMA/cache 默认危险：buffer alignment、cache clean/invalidate、memory barrier、ownership、lifetime、burst、descriptor、bounce buffer 和 non-cacheable region 必须明确。
9. 板级证据优先：UART log、GDB 寄存器、scope、logic analyzer、JTAG/SWD trace、bus decode、HIL artifact 比主机单测更能证明硬件路径。
10. 结论只覆盖目标板和固件版本：host test、QEMU/Renode 或 dev board 通过不等于量产板通过；未上板/未仿真要写未验证。

## 工程门禁

1. 目标画像门禁：未写清目标板/芯片/封装、silicon revision、板卡 revision、SDK/HAL/PAC/BSP、RTOS、toolchain、probe、flash tool 和固件 hash，不进入实现结论。
2. 资料门禁：未读 datasheet、reference manual、errata、schematic/board manual、SDK release note 和启动/链接脚本，不改 clock、pinmux、寄存器、bootloader、flash layout、DMA/cache 或 RTOS 配置。
3. 影响面门禁：任何改动先列受影响的 power/clock/reset、pinmux、IRQ、DMA、cache/MPU、RTOS priority/stack/heap、boot slot、watchdog、日志和量产烧录项。
4. 最小可观测门禁：bring-up 或疑难问题先建立 UART/GPIO/probe/fault dump/trace 中至少一种可靠观测路径；无观测路径只允许补观测，不做大重构。
5. 实时资源门禁：新增任务、ISR、buffer、queue、heap、log 或通信重试时，必须给 stack/heap/latency/binary size/power 预算和退化策略。
6. OTA/安全门禁：动 flash layout、bootloader、DFU、OTA、签名、安全启动、anti-rollback、debug lock 或密钥生命周期时，必须先定义失败路径、断电场景、回滚策略和量产隔离。
7. HIL 证据门禁：声明“板级已验证”必须包含目标板 ID、固件 hash、刷写日志、串口/trace/仪器或 HIL artifact；只跑 host/QEMU/Renode 一律最多写“部分验证”。
8. 发布门禁：交付固件前必须绑定 build id、artifact checksum、map/size、版本号、目标板范围、升级路径、回滚条件、已知 errata/workaround 和日志开关状态。

## 场景执行卡

### 1. 新板 bring-up 与最小可观测路径

- 适用：新板点亮、无串口、无法 halt、外设全不通、偶发 reset。
- 动作：按 power、clock、reset、boot strap、SWD/JTAG、flash、vector table、UART/LED、watchdog 顺序二分；先建立最小 log 或 GPIO toggle。
- 证据：schematic/board manual、power rail、clock waveform、reset pin、boot mode、probe log、GDB PC/SP、串口日志、scope/logic capture。
- 兜底：没有可观测路径时，不做大范围驱动重构。

### 2. Startup、linker script 与内存布局

- 适用：HardFault、上电跑飞、全局变量异常、栈溢出、bootloader 跳转失败。
- 动作：核 vector table address、VTOR、SP/PC 初值、.data copy、.bss zero、heap/stack 边界、section placement、RAM/FLASH region、alignment、overlay、NOLOAD。
- 证据：linker map、objdump/readelf/nm/size、GDB memory/register、fault frame、startup source、bootloader contract。
- 兜底：不要通过随意增大栈/heap 掩盖内存布局或递归/中断栈问题。

### 3. MMIO、HAL/PAC/BSP 与外设驱动

- 适用：GPIO/UART/SPI/I2C/CAN/USB/ETH/ADC/PWM/Timer/RTC/Watchdog 等驱动。
- 动作：确认 clock enable、reset deassert、pinmux、IO voltage、DMA/IRQ、FIFO、timeout、error flag、clear sequence、保留位和 readback。
- 证据：reference manual 字段、寄存器 dump、logic analyzer bus decode、scope、外设日志、driver state、错误计数。
- 兜底：HAL 返回 OK 不等于硬件正确；必须核寄存器和总线波形。

### 4. Interrupt、NVIC、优先级与并发

- 适用：中断不进、丢中断、死锁、RTOS assert、偶发数据损坏。
- 动作：检查 vector mapping、enable/clear、priority grouping、preemption/subpriority、ISR-safe API、critical section、shared state、atomic/barrier 和 reentrancy。
- 证据：NVIC/PLIC/GIC register、ISR hit counter、trace、RTOS assert、stack watermark、race 最小复现。
- 兜底：ISR 中不做长耗时、阻塞 IO、非 ISR-safe RTOS API 或 malloc/free。

### 5. DMA、cache、MPU/MMU 与内存一致性

- 适用：DMA 数据错乱、ETH/USB/SDIO 偶发、cache 开启后失败、descriptor 异常。
- 动作：检查 buffer alignment、cache line、clean/invalidate 方向、descriptor ownership、memory barrier、non-cacheable region、MPU attribute、lifetime 和 interrupt completion。
- 证据：descriptor dump、cache maintenance 位置、MPU/MMU config、logic/bus capture、CRC/error counter、stress test。
- 兜底：关闭 cache 只能定位问题，不能作为生产修复，除非有性能/功耗/一致性评审。

### 6. RTOS：FreeRTOS、Zephyr、RT-Thread

- 适用：任务调度、队列、信号量、timer、tickless、低功耗、Zephyr driver/devicetree、RT-Thread device model。
- 动作：核 config、heap、stack、priority、ISR API、tick rate、time slicing、mutex priority inheritance、watchdog、idle hook、shutdown 和 tracing。
- 证据：RTOS config、thread list、stack watermark、heap stats、trace、assert log、Zephyr Kconfig/devicetree/build output。
- 兜底：RTOS 通过编译不代表配置正确；device tree/Kconfig 的最终展开结果必须看 build artifact。

### 7. Zephyr/device tree/Kconfig 与板级描述

- 适用：Zephyr board/overlay、driver binding、设备未 ready、外设 pinctrl/clock 错误。
- 动作：读 DTS/overlay/binding/Kconfig/defconfig/prj.conf；核 status、compatible、reg、interrupts、clocks、pinctrl、chosen、aliases 和 generated headers。
- 证据：devicetree_unfixed、zephyr.dts、.config、build log、device init level、driver probe log。
- 兜底：不要只改 C 驱动；硬件描述错误会让驱动参数全部错。

### 8. Bootloader、DFU、OTA 与安全启动

- 适用：bootloader 跳转、分区、升级失败、回滚、安全启动、签名校验。
- 动作：明确 flash layout、vector relocation、image header、version、slot、CRC/hash/signature、rollback state、key storage、watchdog 和 power-fail 场景。
- 证据：partition table、boot log、image metadata、签名/校验结果、flash dump、升级中断测试、回滚日志。
- 兜底：不要跳过签名/回滚/断电测试直接发布 OTA；密钥和私有固件不得外传。

### 9. 低功耗、时钟、复位和 watchdog

- 适用：休眠唤醒失败、功耗超标、时钟漂移、brown-out、看门狗 reset。
- 动作：检查 clock tree、PLL、RTC/LSE/LSI、power mode、wakeup source、retention RAM、peripheral reinit、BOR/POR、watchdog feed policy。
- 证据：current measurement、reset reason、clock register、wake log、scope、watchdog counter、power profiler。
- 兜底：低功耗必须有仪器数据；不要用禁用 watchdog 掩盖卡死。

### 10. Cross compile、CI、仿真与 HIL

- 适用：交叉编译失败、CI 无硬件、回归不可复现、板级冒烟。
- 动作：固定 target triple、sysroot、toolchain file、SDK、container；分层使用 host unit、QEMU/Renode、emulator、hardware-in-loop、golden board。
- 证据：compiler -v、link map、firmware hash、emulator log、HIL board id、fixture version、power supply setting、flash log、test artifact、串口输出。
- 兜底：QEMU/Renode 不模拟全部外设和时序；HIL flaky 要记录环境、板卡和电源条件。

### 10.1 板级/HIL 验证闭环

- 适用：准备合入固件改动、修复偶发问题、升级 SDK/RTOS/toolchain、发布 OTA 或量产镜像。
- 动作：定义 test matrix，至少区分 host unit、static analysis、emulator、single-board smoke、HIL regression、soak、power-cycle、brown-out、OTA power-fail 和量产烧录抽测；每项写清能证明什么和不能证明什么。
- 证据：board serial、fixture serial、probe serial、firmware hash、test run id、instrument capture、flash log、reset reason、pass/fail threshold、失败样本编号和保留的原始 artifact。
- 兜底：HIL 通过但没有板卡/夹具/固件 hash，不算可复现证据；HIL flaky 不允许简单 rerun 到绿，必须记录失败率、环境和判定阈值。

### 11. Rust no_std 与 C/C++/Assembly 边界

- 适用：Rust embedded、C HAL 调用、FFI、startup/interrupt、unsafe MMIO。
- 动作：确认 panic handler、allocator、critical-section、cortex-m-rt/embassy/RTIC、bindgen/cbindgen、repr(C)、interrupt attribute、ownership 和 aliasing。
- 证据：Cargo target、memory.x/linker map、unsafe SAFETY、probe log、miri/host tests 可用边界、板级运行证据。
- 兜底：Rust 类型安全不自动覆盖 MMIO、DMA、ISR 和 FFI；unsafe 契约必须写清。

### 12. 生产诊断、日志和现场问题

- 适用：偶发死机、HardFault、数据损坏、现场无法复现、量产差异、RMA/售后授权诊断。
- 动作：保留 reset reason、fault frame、PC/LR/SP/xPSR、build id、firmware hash、ring buffer、crash dump、telemetry、board revision、环境条件、RMA 授权、临时解锁窗口、审计日志、重新锁定和 secure erase 状态。
- 证据：core/fault dump、symbolized backtrace、watchdog log、温度/电压、生产批次、仪器捕获、复现脚本、授权单、脱敏诊断包、解锁/重锁/擦除日志。
- 兜底：无 build id 和符号表时不能下精确根因；无授权、脱敏、重锁或擦除证据时，不开放现场 debug 通道。

### 13. 固件制品、量产安全与供应链

- 适用：量产烧录、secure boot、OTA 发布、客户交付、工厂密钥注入、debug 口管控、SBOM/签名/provenance 要求。
- 动作：绑定 firmware hash、build id、SBOM、签名、provenance/attestation、image digest、anti-rollback counter、debug lock、RDP/fuse、secure erase、密钥生成/托管/HSM/审批/注入/轮换/撤销/销毁、per-device identity、烧录站 attestation、返工/失败品隔离、灰度/暂停/回滚阈值和量产烧录日志。
- 证据：artifact checksum、SBOM、签名验签输出、provenance、flash/OTA manifest、fuse/RDP 状态、JTAG/SWD lock 读回、key ceremony/rotation/revoke 记录、设备证书、station attestation、返工审计、release marker、现场版本遥测、回滚拒绝日志。
- 兜底：未验证 debug lock、anti-rollback、签名链、密钥吊销、工厂站点可信或制品来源时，不宣称可量产或安全交付；密钥材料只列证据状态，不外传内容。

### 14. 实时性、资源、体积与性能回归

- 适用：硬实时/软实时任务、ISR 抖动、性能退化、功耗回归、栈/堆风险、binary size 超预算、O0/O2/LTO/PGO 或链接优化变化。
- 动作：记录 WCET、interrupt latency、jitter、最大关中断时长、critical section、stack high-water、heap peak、fragmentation、leak/soak、fault injection、power baseline、binary size budget、map/size diff、优化等级和 HIL stress 阈值。
- 证据：trace/logic capture、cycle counter、RTOS trace、stack/heap report、长稳 soak 曲线、功耗同口径复测、firmware size diff、compiler/linker flags、HIL/CI regression artifact。
- 兜底：性能、功耗、内存和体积结论只覆盖同板卡、同工具链、同优化配置；未设预算或阈值时只能写“需验证”。

## 高频坑 / 防遗漏

- 编译通过就认为板子能跑。
- 未查 errata，踩中芯片已知问题。
- clock/pinmux/reset 没开就改驱动状态机。
- volatile 被当作线程/中断同步。
- DMA buffer 未对齐或 cache 未维护。
- ISR 调用非 ISR-safe API 或优先级超过 RTOS 允许范围。
- linker script section 放错导致 .data/.bss/stack/heap 覆盖。
- bootloader 跳转未重定位 vector table 或未清中断。
- 读改写寄存器破坏保留位或 write-1-to-clear 位。
- HAL 层吞掉错误码，未查看底层 flag。
- QEMU 通过就宣布真实硬件通过。
- 禁用 watchdog/cache/中断作为长期修复。
- 未记录板卡 revision、firmware hash 和 probe/tool 版本。
- OTA image、firmware hash、SBOM、签名和 provenance 没绑定就交付。
- 量产 debug lock、RDP/fuse、anti-rollback 和 secure erase 未验证就宣称安全。
- RMA/现场诊断解锁无授权、无脱敏、无审计、无重锁/擦除证据。
- 未设 WCET、interrupt latency、stack/heap、功耗和 binary size 预算就给性能结论。
- O0/O2/LTO/PGO 或链接优化变化后不复测实时性、体积和寄存器访问路径。
- SDK/HAL 升级后不看 release note、startup、linker script、clock tree、默认中断优先级和外设初始化顺序差异。
- 改 pinmux 只看代码宏，不核 datasheet alternate function、封装脚位、板级复用、电平域和外设冲突。
- 新增日志不评估 ISR 可重入、串口阻塞、DMA ring buffer、丢包策略、功耗和隐私/密钥泄露风险。
- OTA 只测正常升级，不测断电、低电量、坏包、旧版本回滚、anti-rollback 拒绝和 watchdog 重启。
- 量产烧录只看烧录成功率，不记录镜像 hash、设备身份、校准数据、失败品隔离、工站版本和抽检策略。

## 输出要求

- 必须给：芯片/板卡、toolchain/target、SDK/RTOS 版本、启动链、硬件资料、证据、影响面、改动清单、验证命令和关键输出。
- Bring-up：列 power/clock/reset/boot/probe/UART 或 GPIO 最小证据。
- 启动/内存：列 linker map、vector table、SP/PC、section、fault frame 和符号化结果。
- 外设驱动：列 clock/pinmux/register、总线波形、超时/错误路径和仪器或 HIL 证据。
- ISR/RTOS：列 priority、ISR-safe API、stack/heap、trace/assert、race 或压力测试证据。
- DMA/cache：列 buffer ownership、alignment、barrier/cache maintenance、descriptor 和 stress 证据。
- OTA/bootloader：列 flash layout、image metadata、签名/回滚、断电/失败路径证据。
- HIL/板级：列 board id、fixture id、probe id、firmware hash、flash log、run id、仪器 artifact、阈值和失败样本编号。
- 固件交付：列 artifact checksum、SBOM、签名验签、provenance、OTA manifest、anti-rollback、debug lock/RDP/fuse、密钥生命周期、per-device identity、station attestation、灰度/暂停/回滚阈值和现场版本遥测。
- 实时/资源：列 WCET、interrupt latency、jitter、stack high-water、heap peak/fragmentation、leak/soak、power baseline、binary size budget、优化等级和 HIL stress 证据。
- 结论分级只用：已验证、部分验证、未验证、证据不足；未上板、未仿真、未读手册、缺 schematic/errata 时必须写“未验证”。

## 约束

- 禁止无手册/原理图/寄存器证据修改硬件贴近层。
- 禁止把 host unit、QEMU/Renode、编译通过包装成真实板级验证。
- 禁止把 volatile 当同步原语，禁止在 ISR 中调用不安全 API。
- 禁止泄露私有固件、密钥、芯片 NDA 文档、客户原理图、量产日志和安全启动材料。
- 禁止用禁用 cache/watchdog/中断、增大延时或无限重试替代根因修复。
- 禁止在缺签名链、provenance、anti-rollback 或量产 debug lock 证据时宣称安全交付。
- 禁止用无限重试、忙等、无界队列或无预算堆分配替代实时性和资源根因修复。

## 高频 Bug 反例库

- 反例 1：错法：UART 没输出就重写驱动；对法：先查 power、clock、reset、pinmux、baud、TX pin 波形；根因：硬件路径未建立前软件逻辑无法判断。
- 反例 2：错法：volatile bool 在线程和 ISR 间同步；对法：使用 atomic、critical section 或 RTOS primitive；根因：volatile 不建立原子性和内存顺序。
- 反例 3：错法：DMA 完成后直接读 buffer；对法：确认 ownership、cache invalidate、barrier 和 alignment；根因：CPU cache 与 DMA 视图可能不一致。
- 反例 4：错法：HardFault 只看最后日志；对法：抓 fault frame、CFSR/HFSR/BFAR/MMFAR、PC/LR 并符号化；根因：崩溃点需要寄存器证据。
- 反例 5：错法：RTOS assert 后降低中断优先级随机试；对法：按官方 priority rule 和 ISR-safe API 审查；根因：优先级编码和临界区规则容易错。
- 反例 6：错法：启动失败就改 main；对法：核 vector table、SP/PC、.data/.bss、clock/FPU/cache 初始化；根因：main 前链路失败常被忽略。
- 反例 7：错法：bootloader 跳 app 不清外设和中断；对法：定义 handoff contract、VTOR、MSP、pending IRQ 和 clock state；根因：残留状态会污染 app。
- 反例 8：错法：QEMU 通过就发布；对法：补目标板或 HIL 冒烟，标明 emulator 覆盖边界；根因：模拟器不覆盖电气和完整外设时序。
- 反例 9：错法：I2C/SPI timeout 靠加 delay；对法：用 logic analyzer 查时序、pull-up、mode、clock stretching 和错误 flag；根因：延时掩盖总线配置或电气问题。
- 反例 10：错法：低功耗只看寄存器配置；对法：用电流仪/power profiler 和唤醒日志验证；根因：功耗是硬件测量事实。
- 反例 11：错法：errata 不查就怀疑编译器；对法：按芯片 revision 查 errata 和 workaround；根因：芯片已知缺陷常表现为偶发软件问题。
- 反例 12：错法：禁用 watchdog 修现场重启；对法：记录 reset reason、喂狗策略、死锁/阻塞点和 crash dump；根因：watchdog 是症状捕获，不是根因。
- 反例 13：错法：只签 OTA 包不记录 firmware hash/SBOM/provenance；对法：把 image digest、签名、SBOM、build id 和发布 manifest 绑定；根因：无法追溯的制品不能安全回滚或定位供应链风险。
- 反例 14：错法：量产后保留 JTAG/SWD 调试口开放；对法：验证 debug lock、RDP/fuse、secure erase 和授权解锁流程；根因：调试通道会绕过固件权限边界。
- 反例 15：错法：RMA 为排障长期开放 debug unlock；对法：使用授权窗口、脱敏诊断包、审计、重锁和 secure erase 证据；根因：现场诊断会扩大攻击面和数据泄露面。
- 反例 16：错法：只看平均响应时间就说实时性达标；对法：测 WCET、interrupt latency、jitter、最大关中断时间和 HIL stress；根因：实时系统失败常发生在最坏路径。
- 反例 17：错法：打开 LTO 后只看编译通过；对法：复核 map/size、栈深、符号、MMIO 访问、时序和板级回归；根因：优化会改变 inline、dead stripping、可观测性和资源占用。
- 反例 18：错法：换 SDK 后只修编译错误；对法：审 release note、startup、linker、clock/pinmux 默认值、HAL timeout 和 RTOS config diff；根因：SDK 默认行为变化常在板上才暴露。
- 反例 19：错法：SPI/I2C/CAN 不通就改协议解析；对法：先用逻辑分析仪确认 pinmux、电平、mode、bitrate、termination/pull-up 和错误 flag；根因：总线物理层错误会伪装成协议 bug。
- 反例 20：错法：ISR 里直接打印日志；对法：用 lock-free/ring buffer、defer 到 task 或 trace，评估丢日志和背压；根因：阻塞日志会改变实时性甚至死锁。
- 反例 21：错法：OTA 只测试一次成功升级；对法：覆盖断电、坏包、签名失败、版本回退、slot 切换失败、watchdog reset 和恢复路径；根因：升级失败路径才决定设备是否变砖。
- 反例 22：错法：HIL 失败 rerun 到通过就合入；对法：记录失败率、板卡/夹具/电源/温度、原始 artifact 和判定阈值；根因：flaky 往往是时序、电源或未初始化状态问题。
- 反例 23：错法：量产烧录成功就放行；对法：记录镜像 hash、设备身份、校准区、fuse/debug lock、工站版本、失败品隔离和抽检日志；根因：量产问题需要可追溯边界。
- 反例 24：错法：增加重试次数修外设超时；对法：先定位 clock/reset、FIFO/IRQ、DMA ownership、电气和错误清除顺序；根因：无界重试会掩盖硬件路径或状态机缺陷。
- 反例 25：错法：只在开发板验证后声明客户板通过；对法：按目标板 revision、BOM、外设连接、电源和固件 hash 分开结论；根因：开发板与量产板的时钟、电源和 pinmux 差异足以改变行为。

## 外部资料基线

- Arm CMSIS-Core、芯片 datasheet/reference manual/errata、board manual/schematic 是寄存器和启动链一手口径。
- FreeRTOS、Zephyr、RT-Thread 官方文档和源码是 RTOS API、ISR、device model、Kconfig/devicetree 的一手口径。
- GNU ld、LLVM/GCC、OpenOCD、probe-rs、Renode/QEMU 官方文档是 toolchain、linker、调试和仿真能力边界的一手证据。
- Embedded Rust Book、cortex-m-rt、Embassy/RTIC 官方资料是 Rust no_std/startup/异步嵌入式的口径线索；板级结论仍以目标硬件证据为准。

## 提交前自检清单

- [ ] frontmatter name 使用 manifest canonical name（embedded-firmware），H1 为“嵌入式开发”，目录/URL slug 保持 embd。
- [ ] 快速总则覆盖硬件、工具链、启动链、时钟复位、寄存器、volatile、ISR/RTOS、DMA/cache、板级证据和验证边界。
- [ ] 工程门禁覆盖目标画像、资料、影响面、最小观测、实时资源、OTA/安全、HIL 证据和发布交付。
- [ ] 场景执行卡覆盖 bring-up、startup/linker、MMIO、ISR、DMA/cache、RTOS、Zephyr、bootloader/OTA、低功耗、CI/HIL、板级/HIL 闭环、Rust no_std、现场诊断、固件交付安全、实时性、资源、体积和性能回归。
- [ ] 输出要求包含芯片/板卡、toolchain、SDK/RTOS、硬件资料、仪器/HIL、board/fixture/probe id、firmware hash、SBOM、签名/provenance、密钥生命周期、WCET、interrupt latency、stack/heap、功耗、binary size、验证命令和结论分级。
- [ ] 约束明确禁止无手册/原理图/寄存器证据硬改、禁止把仿真当板级验证、禁止泄露密钥/NDA/客户资料、禁止无界资源策略和无预算性能结论。
- [ ] 高频坑和反例覆盖 errata、clock/pinmux/reset、volatile、DMA/cache、ISR-safe API、linker、bootloader handoff、debug lock、RMA 解锁、SDK 升级、OTA 失败路径、HIL flaky、量产烧录、LTO/优化和供应链制品。
- [ ] 相邻技能边界覆盖语言、HDL、逆向/移动安全、release、test、dso/wsec、observability/perf 和 aud。

## 与相邻技能的边界

- C / C++ 开发 / cpp-development（cpd） / Rust 开发 / rust-development（rs）：负责通用语言、ABI、内存和并发；本技能只处理嵌入式约束、寄存器、RTOS、启动链和板级证据。
- 硬件 / FPGA / ASIC / fpga-asic-hdl（hfa）：负责 Verilog/SystemVerilog/VHDL、FPGA/ASIC RTL、时序、约束和 EDA flow；本技能负责 MCU/SoC 固件、外设驱动和板级调试。
- 逆向工程总控 / reverse-engineering（rev） / 移动安全 / mobile-security（msec）：负责固件逆向、漏洞分析和移动安全；本技能负责授权开发/调试和防御性固件工程。
- 发布部署 / release-engineering（rls）：负责制品、刷写、版本、灰度、回滚和发布流水线；本技能提供固件启动/OTA/硬件验证要求。
- dso / Web 安全 / web-security（wsec）：负责 SBOM/SCA/secrets、供应链门禁、应用/API 安全和漏洞专项；本技能只处理固件制品、debug 口、secure boot、anti-rollback 和密钥生命周期的板级证据线索。
- 可观测性 / observability（obs）：负责线上日志、指标、trace、告警和 incident 复盘；本技能提供 reset reason、fault dump、build id、telemetry 和现场硬件证据要求。
- 性能工程 / perf-engineering（pfe）：负责系统级性能、容量和基准方法；本技能只处理 MCU/SoC 时钟、低功耗、实时性、DMA/cache 和板级测量证据。
- 测试验证 / test-engineering（tst）：负责测试矩阵、HIL/CI 策略和回归结论；本技能提供可验证入口和硬件证据标准。
- 代码审计 / code-audit（aud）：负责改动后的需求对账、影响面、安全质量和证据收口；本技能不替代最终审计。