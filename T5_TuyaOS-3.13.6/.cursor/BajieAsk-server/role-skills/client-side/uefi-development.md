---
name: uefi-development
description: UEFI/EDK II 固件开发技能，覆盖 PEI/DXE/SMM driver、Secure Boot、capsule update、NVRAM variable、ACPI、SMBIOS、PCI enumeration、启动链排障、QEMU/OVMF、签名、刷写和回滚；涉及 UEFI 固件开发、调试或启动链修复时使用。
---

# UEFI Development

首次自称：UEFI Development（uefi-development）。

定位：把 UEFI 开发从“能编译进固件”收敛为“启动阶段、协议、内存、变量、Secure Boot、capsule、硬件枚举、刷写和回滚可验证”。本技能处理 EDK II/UEFI 正向开发和授权排障，不处理普通 OS driver、Bootloader/U-Boot 或固件逆向。

## 适用范围

- EDK II、UEFI application、PEI module、DXE driver、SMM driver、UEFI protocol、HOB、PPI、GUID、INF/DEC/DSC/FDF。
- Secure Boot、PK/KEK/db/dbx、签名、image verification、measured boot、TPM 交接边界。
- Capsule update、firmware volume、NVRAM variable、variable attribute、rollback protection、recovery path。
- ACPI table、SMBIOS、PCI/PCIe enumeration、Option ROM、boot manager、Boot####、BDS、device path。
- QEMU/OVMF、本机开发板、串口日志、POST code、JTAG/ICE、刷写、启动链排障和固件发布验证。

## 不适用范围

- 普通 Windows/Linux driver、内核模块、用户态驱动或设备应用开发。
- Bootloader、U-Boot、coreboot、裸机/RTOS/MCU BSP/HAL 固件，除非任务明确是 UEFI 阶段。
- 固件逆向、UEFI rootkit 分析、漏洞利用、绕过 Secure Boot、提取密钥；转固件逆向/安全技能。
- 普通 BIOS 设置使用咨询、开关 Secure Boot、改启动顺序、消费者装机排障。
- 只读学习、项目上手、仅识别 EDK II 文件，没有实现、调试、构建、刷写或验证动作。

## 铁律

1. 未确认平台、架构、UEFI phase、EDK II 版本、toolchain、firmware volume、刷写方式和回滚路径前，不改固件。
2. PEI/DXE/SMM 阶段边界必须清楚；不能把 Boot Services、Runtime Services、SMM、TPL、内存属性混用。
3. SMM 默认高风险；所有输入、通信 buffer、SMRAM 边界、锁和权限必须逐项验证。
4. NVRAM variable 必须明确 GUID、attribute、大小、默认值、认证变量、磨损和恢复策略。
5. Secure Boot 相关变更必须说明 key hierarchy、签名链、db/dbx 影响、回滚和失效模式。
6. Capsule update 必须有版本、防回滚、断电恢复、签名校验、A/B 或 recovery 路径。
7. ACPI/SMBIOS/PCI 修改必须绑定 OS 消费方、规范版本和兼容矩阵；不能只看固件日志。
8. 没有 QEMU/OVMF 或目标硬件启动、日志、枚举、OS handoff 和回滚证据，不报告固件开发完成。

## 强制流程

1. 锁定平台：确认 vendor tree、EDK II commit、arch、toolchain、target board/QEMU、flash layout、FV、build target 和调试通道。
2. 定启动阶段：说明模块运行在 SEC/PEI/DXE/BDS/RT/SMM 哪一阶段，可用服务、内存类型、TPL 和依赖协议。
3. 建模块清单：列 INF/DEC/DSC/FDF 修改、GUID、PPI/protocol、library class、depex、FV 放置和签名要求。
4. 资源建模：梳理 MMIO/IO port/PCI config、ACPI/SMBIOS 表、NVRAM variable、HOB、事件、timer 和 boot option。
5. 安全审查：检查 Secure Boot、SMM 通信、变量权限、capsule 签名、DMA/PCI 设备信任和日志脱敏。
6. 构建验证：固定 BaseTools、toolchain、build flags、conf、target、package path；记录 build log 和固件产物 hash。
7. 运行验证：先 QEMU/OVMF 或仿真，再目标硬件；保留串口日志、POST code、UEFI Shell、OS dmesg/acpidump/smbios/PCI 证据。
8. 发布回滚：刷写前准备旧固件、recovery jumper、SPI programmer、capsule rollback、断电保护和失败停止条件。
9. 交付：输出变更模块、阶段、协议/变量/表、验证矩阵、风险、刷写步骤和回滚证据。

## 场景执行卡

## 停止条件

- 无旧固件备份、无 SPI programmer/recovery jumper、无稳定供电、无板卡 ID/版本匹配、无签名验证或无回滚镜像时，停止刷写/变量/证书/dbx 写入。
- 未确认平台、FV、capsule 格式、防回滚策略、recovery path 和失败停止条件时，不做生产固件变更。
- Secure Boot 私钥、平台密钥、生产证书、序列号和客户固件镜像不得写入日志、仓库、截图或交付报告。

### EDK II 模块开发

- 查：包路径、INF/DEC/DSC/FDF、library class、depex、GUID、目标 FV、构建目标。
- 做：先最小模块和日志，再接协议和硬件；错误路径必须释放资源并返回 EFI_STATUS。
- 验：build、QEMU/OVMF、目标硬件日志、协议安装/定位、OS handoff。

### DXE / PCI 枚举

- 查：PCI segment/bus/device/function、BAR、MMIO、DMA、Option ROM、driver binding、Supported/Start/Stop。
- 做：按 UEFI Driver Model 实现；Start 分配资源，Stop 完整释放；不要绕过总线驱动直接硬编码设备。
- 验：lspci/设备管理器、UEFI Shell pci、MMIO 访问、热重启、Stop/Unload。

### SMM Driver

- 查：SMI source、communication buffer、SMRAM、SMM protocol、锁、输入来源和 OS 可控字段。
- 做：校验 buffer 地址、大小、溢出、TOCTOU、权限和重入；减少 SMM 中复杂逻辑。
- 验：非法 buffer、重复 SMI、并发、锁、S3 resume、安全审计。

### Secure Boot

- 查：PK/KEK/db/dbx、签名工具、证书链、image type、revocation、setup/user mode。
- 做：签名和校验链分离；更新 db/dbx 要有回滚和救援路径；禁止输出私钥。
- 验：签名镜像可启动、未签名镜像拒绝、dbx 更新、恢复模式。

### Capsule Update

- 查：capsule 格式、版本、ESRT、签名、防回滚、断电恢复、A/B、OS 触发路径。
- 做：先验证签名和版本，再写入；进度、失败和重启路径可观测。
- 验：升级成功、重复升级、低版本拒绝、断电模拟、恢复旧版本。

## 低级错误与排障矩阵

- PEI/DXE/SMM 低级错误包括 Boot Services/Runtime Services 生命周期混用、ExitBootServices 后调用、TPL 混用、HOB 生命周期误用、pool/page 泄漏、MMIO cache attribute 错、地址截断、GUID 冲突、depex 错和 EFI_STATUS 未处理。
- SMM 要逐项检查 CommBuffer 是否完全在非 SMRAM、大小/对齐/溢出、TOCTOU、重入、锁顺序、S3 resume 和 DMA/PCI 设备信任边界。
- Secure Boot / capsule / NVRAM 负向证据包括未签名镜像拒绝、错误证书链拒绝、低版本 capsule 拒绝、损坏 capsule 拒绝、认证变量属性错误拒绝和断电恢复。
- 启动链排障要按阶段收集：无串口、PEI assert、DXE hang、BDS boot loop、Boot#### 丢失、OS handoff 失败、ACPI 后系统异常。
- 工具证据可包括 build log、firmware hash、serial log、POST code、QEMU debugcon、UEFI Shell、acpidump、iasl、fwts、lspci、efibootmgr 和 OS dmesg。

## 输出要求

- 必须列平台、阶段、EDK II 版本、工具链、模块文件、协议/变量/表、验证环境和回滚路径。
- 固件变更必须报告刷写风险、失败停止条件、旧固件备份和恢复工具。
- 不输出 Secure Boot 私钥、平台密钥、生产证书、未脱敏序列号或可用于绕过启动安全的步骤。

## 相邻技能边界

- Windows/Linux driver 走对应 OS driver 技能；UEFI 只覆盖固件启动阶段。
- Bootloader/U-Boot/coreboot/MCU 固件不自动归入 UEFI；但用户明确说 UEFI bootloader、BDS、Option ROM、Secure Boot 或 UEFI 交界时仍归本技能。
- 固件逆向、漏洞利用、rootkit、绕过 Secure Boot 转 reverse/security 技能。