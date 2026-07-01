---
name: uefi-bootloader-reverse-engineering
description: UEFI 固件与引导链逆向工程。UEFI PI / DXE / SMM 架构解析；UEFITool / UEFIExtract 固件提取；efiXplorer (IDA plugin) / Ghidra efi 分析；NVRAM 变量解析；Secure Boot 签名链验证与绕过研究；GRUB / Windows Boot Manager / shim 引导加载器分析；Coreboot / LinuxBoot / U-Boot 开源固件逆向；Chipsec 硬件安全检查；Bootkit / UEFI rootkit 检测（LoJax / MosaicRegressor / BlackLotus / CosmicStrand）；Intel ME / AMD PSP 固件分析。配合 fwrev / rktrev / hwrev / kernrev 用。
---

# UEFI / Bootloader / Secure Boot 逆向

## 适用场景

- 提取 + 分析 UEFI 固件镜像（BIOS update / SPI flash dump）。
- 逆向 DXE driver / SMM handler / PEI module 找漏洞。
- 验证 Secure Boot 签名链完整性 / 研究绕过方法。
- 检测 UEFI bootkit / rootkit（BlackLotus / CosmicStrand / MosaicRegressor / LoJax）。
- 分析 Intel ME / AMD PSP / Apple T2 固件。
- 逆向 GRUB / Windows Boot Manager / shim / systemd-boot。
- Coreboot / LinuxBoot / U-Boot 开源固件安全审计。

## 不适用

- BIOS 设置调整 / 常规刷写。
- 操作系统内核逆向 → `kernrev`。
- 嵌入式 MCU 固件（非 x86 UEFI）→ `fwrev`。

---

## UEFI 架构

### 启动阶段

```text
x86 UEFI 启动流程:

  ┌─────────────────────────────────────────────────────────────────┐
  │ SEC (Security Phase)                                           │
  │   CPU 复位 → 0xFFFFFFF0 (reset vector)                        │
  │   CAR (Cache-As-RAM) 初始化                                    │
  │   切换到保护模式                                                │
  │   验证 PEI 完整性 (如果有 Verified Boot)                        │
  └────────────────────────────┬────────────────────────────────────┘
                               ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ PEI (Pre-EFI Initialization)                                   │
  │   内存初始化 (MRC / memory training)                            │
  │   PEIM (PEI Module) 执行                                       │
  │   发现 DXE Foundation                                          │
  │   通过 HOB (Hand-Off Block) 传递信息给 DXE                     │
  └────────────────────────────┬────────────────────────────────────┘
                               ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ DXE (Driver Execution Environment)                             │
  │   DXE Core → 加载 DXE Driver                                   │
  │   Protocol 机制 (类似 COM 接口)                                 │
  │   Boot Services (BS) + Runtime Services (RT)                    │
  │   SMM 初始化 (如果有 SMM driver)                                │
  └────────────────────────────┬────────────────────────────────────┘
                               ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ BDS (Boot Device Selection)                                    │
  │   枚举启动设备                                                  │
  │   加载 OS Loader (GRUB / Windows Boot Manager / shim)          │
  │   ExitBootServices() → 结束 UEFI Boot Services                 │
  └────────────────────────────┬────────────────────────────────────┘
                               ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ OS Runtime                                                     │
  │   仅保留 Runtime Services (GetTime / SetVariable / ResetSystem)│
  │   SMM 仍然活跃 (SMI handler)                                   │
  └─────────────────────────────────────────────────────────────────┘
```

### DXE Protocol 机制

```text
UEFI Protocol ≈ 接口 (类似 COM / IUnknown)
  - 每个 Protocol 有一个 GUID
  - Driver 通过 InstallProtocolInterface() 注册
  - Consumer 通过 LocateProtocol() / HandleProtocol() 获取

重要 Protocol:
  EFI_SIMPLE_FILE_SYSTEM_PROTOCOL  → 文件系统访问
  EFI_BLOCK_IO_PROTOCOL            → 块设备
  EFI_LOADED_IMAGE_PROTOCOL        → 已加载镜像信息
  EFI_GRAPHICS_OUTPUT_PROTOCOL     → 显示
  EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL  → 控制台输出
  EFI_FIRMWARE_VOLUME2_PROTOCOL    → 固件卷
  EFI_SMM_ACCESS2_PROTOCOL         → SMM 内存访问
  EFI_SMM_BASE2_PROTOCOL           → SMM 基础
  EFI_SECURITY2_ARCH_PROTOCOL      → Secure Boot 验证
```

### SMM (System Management Mode)

```text
SMM = CPU 最高特权级 (Ring -2):
  - 不可被 OS / Hypervisor 访问
  - SMRAM: 专用内存区域, 对 OS 不可见
  - SMI (System Management Interrupt) 触发进入
  - 用途: 电源管理 / 硬件监控 / 安全功能

SMM 攻击面 (高价值目标):
  - SMI handler 漏洞 → 从 Ring 0 提权到 Ring -2
  - SMRAM 验证绕过 (race condition)
  - SMM callout: SMI handler 调用 UEFI BS/RT 函数 (已不在 SMRAM 内)
  - TOCTOU: 验证缓冲区后被 OS 修改

逆向:
  - 在固件中找 EFI_SMM_SW_DISPATCH2_PROTOCOL 注册
  - SMI handler 接收 CommBuffer (可能来自 OS)
  - 重点审计 CommBuffer 指针验证 / 长度检查
```

---

## 固件提取

### SPI Flash Dump

```bash
# 硬件提取 (最可靠)
# 工具: CH341A + SOIC8 clip / Dediprog SF100 / FlashROM + SPI adapter
flashrom -p ch341a_spi -r firmware.bin
flashrom -p dediprog -r firmware.bin

# 软件读取 (需要 root)
# Linux:
flashrom -p internal -r firmware.bin
# 需要内核支持 + 可能被锁定 (SPI Protected Range)

# Intel ME 区域
# SPI flash 布局:
# ┌──────────────────┐
# │ Flash Descriptor  │  (通常前 4KB)
# │ Intel ME          │  (最大区域)
# │ GbE               │  (网卡 NVM)
# │ Platform Data     │
# │ BIOS Region       │  (UEFI 固件)
# └──────────────────┘

# ifdtool (coreboot 工具)
ifdtool -x firmware.bin
# 输出: flashregion_0_flashdescriptor.bin
#        flashregion_1_bios.bin
#        flashregion_2_me.bin
```

### UEFI 固件解析

```bash
# UEFITool (GUI, 最好用)
# https://github.com/LongSoft/UEFITool
# 打开 firmware.bin → 树形展示所有模块
# 右键 → Extract body / Extract as-is

# UEFIExtract (CLI)
UEFIExtract firmware.bin
# 输出: firmware.bin.dump/ 目录, 每个模块单独提取

# UEFIFind (搜索)
UEFIFind firmware.bin header <GUID>

# UEFI Firmware Parser (Python)
pip install uefi-firmware-parser
uefi-firmware-parser -b -e firmware.bin
# -b: brute force 搜索固件卷
# -e: 提取所有模块

# 识别关键模块 (通过 GUID)
# SecureBoot:         DB / DBX / KEK / PK 变量
# Intel ME:           ME firmware
# Microcode:          CPU microcode update
# ACPI:               DSDT / SSDT 表
```

---

## 逆向分析

### efiXplorer (IDA Plugin)

```text
安装: https://github.com/binarly-io/efiXplorer
功能:
  - 自动识别 UEFI Protocol GUID
  - 自动标注 Boot Services / Runtime Services 调用
  - 识别 SMI handler
  - 自动设置函数参数类型 (EFI_SYSTEM_TABLE* / EFI_BOOT_SERVICES*)
  - 生成依赖图

使用:
  1. IDA 打开 DXE driver (PE32+ / TE)
  2. Edit → Plugins → efiXplorer
  3. 自动分析完成后:
     - 查看 Bookmarks: 标注了所有 Protocol 使用
     - 查看 efiXplorer 侧栏: GUID / Protocol / SMI handler

手动分析要点:
  - 入口: DxeDriverEntryPoint(EFI_HANDLE ImageHandle, EFI_SYSTEM_TABLE *SystemTable)
  - SystemTable->BootServices->LocateProtocol(&gGuid, NULL, &Interface)
  - SystemTable->BootServices->InstallProtocolInterface(...)
  - 找 IOCTL-like 处理: Protocol 的 callback 函数
```

### Ghidra UEFI

```text
Ghidra + uefi_retool / efiSeek:
  1. 导入为 PE (DXE driver 是 PE32+) 或 TE (Terse Executable)
  2. 导入 UEFI 类型 (edk2 头文件 → GDT)
  3. 手动标注 EFI_SYSTEM_TABLE / EFI_BOOT_SERVICES / EFI_RUNTIME_SERVICES
  4. 从入口函数开始追踪 Protocol 使用

  Ghidra 脚本:
  - ghidra-firmware-utils: 自动识别 UEFI 二进制
  - efiSeek: 类 efiXplorer 功能
```

### 关键分析目标

```text
DXE Driver 审计清单:
  □ 入口函数参数类型标注 (ImageHandle / SystemTable)
  □ Protocol 注册与消费
  □ SMI handler (SmmSwDispatch / SmmIoTrapDispatch / SmmPeriodic)
  □ NVRAM 变量读写 (GetVariable / SetVariable)
  □ 内存操作: CopyMem / SetMem 边界检查
  □ 指针验证: CommBuffer 是否在 SMRAM 外
  □ Runtime Services 回调
  □ PCI / MMIO 直接操作

SMI Handler 漏洞模式:
  1. CommBuffer 指针未验证 → 指向 SMRAM 内
  2. CommBufferSize 未检查 → 越界读写
  3. TOCTOU: 先验证后使用, 中间被篡改
  4. SMM Callout: 调用 BS/RT 函数 (已不在 SMRAM 保护下)
  5. 整数溢出: buffer size 计算
  6. 嵌套指针: CommBuffer 内含指针, 指向 OS 内存
```

---

## Secure Boot

### 签名链

```text
信任链:
  PK (Platform Key)           → OEM 根密钥 (通常 1 个)
    └── KEK (Key Exchange Key)  → 允许更新 db/dbx 的密钥
        └── db (Authorized DB)  → 允许执行的签名/哈希
        └── dbx (Forbidden DB)  → 禁止执行的签名/哈希

验证流程:
  UEFI 加载 .efi → 验证 Authenticode 签名 → 查 db/dbx
  通过 → 执行
  失败 → 拒绝

  OS Loader 链:
  shim.efi (Microsoft 签名) → GRUB/systemd-boot (distro 签名) → kernel (distro 签名)
  Windows: bootmgfw.efi (Microsoft 签名) → winload.efi → ntoskrnl.exe
```

```bash
# 查看 Secure Boot 状态
mokutil --sb-state

# 导出 Secure Boot 变量
# Linux:
efi-readvar                                # 需要 efitools
# 或:
ls /sys/firmware/efi/efivars/
cat /sys/firmware/efi/efivars/SecureBoot-* | xxd

# 解析 db/dbx
sig-list-to-certs db.esl certs/            # efitools

# Windows:
powershell Get-SecureBootUEFI -Name PK
powershell Get-SecureBootUEFI -Name KEK
powershell Get-SecureBootUEFI -Name db

# 验证 EFI 签名
sbverify --cert db.crt shimx64.efi
pesign -S -i shimx64.efi                   # 查看签名信息
osslsigncode verify shimx64.efi

# Chipsec
pip install chipsec
sudo chipsec_main -m common.secureboot.variables
sudo chipsec_main -m common.uefi.access_uefispec
```

### Secure Boot 绕过研究

```text
历史绕过:
  1. BlackLotus (2023): 利用 CVE-2022-21894 (baton drop)
     - 用合法但有漏洞的 bootloader 加载未签名代码
     - 加入 dbx 后通过降级攻击重新利用

  2. BootHole (2020): CVE-2020-10713
     - GRUB2 grub.cfg 解析缓冲区溢出
     - grub.cfg 不在签名保护范围内

  3. Shim 漏洞 (多个 CVE):
     - HTTP boot 解析漏洞
     - PE 加载漏洞

  4. dbx 更新缺失:
     - 很多系统从不更新 dbx
     - 旧的有漏洞 bootloader 仍可使用

当前研究方向:
  - UEFI 应用漏洞 (PE 解析 / Protocol 滥用)
  - SMM 提权后绕过 Secure Boot
  - 供应链: 篡改固件镜像 (需要 SPI flash 物理访问)
  - 利用 MOK (Machine Owner Key) 注册自签名
```

---

## Bootkit 检测

```text
已知 UEFI Bootkit:
  LoJax (2018)        — 第一个野外 UEFI rootkit (APT28)
  MosaicRegressor (2020) — SPI flash 级持久化
  FinSpy UEFI (2021)  — 商业间谍软件
  ESPecter (2021)     — ESP (EFI System Partition) 级
  CosmicStrand (2022) — 中国 APT, 修改固件镜像
  BlackLotus (2023)   — 首个绕过 Secure Boot 的野外 bootkit

检测方法:
  1. 固件完整性验证:
     - 从 vendor 网站下载原始固件 → hash 对比
     - Intel Boot Guard: 硬件级验证 (OTP fuse)
     - Chipsec: sudo chipsec_main -m common.bios_smi
                sudo chipsec_main -m common.spi_lock

  2. ESP 检查:
     - 挂载 ESP: mount /dev/sda1 /boot/efi
     - 验证 EFI 文件签名
     - 对比已知 hash
     - 检查 .efi 文件修改时间

  3. 内存取证:
     - DMA 采集 UEFI Runtime 内存区域
     - 检查 Runtime Services 函数指针是否指向合法代码

  4. UEFI 日志:
     - TCG Event Log (TPM 度量)
     - 检查 PCR 值是否与预期一致

工具:
  Chipsec:           Intel 开源固件安全检查框架
  LVFS / fwupd:      Linux 固件更新 + 完整性
  Binarly FwHunt:    固件漏洞检测规则
  UEFITool:          固件分析
  HBFA:              UEFI 固件 fuzzing (Binarly)
```

---

## Intel ME / AMD PSP

```text
Intel ME (Management Engine):
  - 独立处理器 (ARC / x86) 运行在 PCH 内
  - 始终运行 (甚至关机状态)
  - 访问所有内存 / 网络 / 存储
  - 攻击价值极高 (Ring -3)

分析:
  # ME 固件提取
  python3 MEAnalyzer.py firmware.bin        # ME Analyzer
  python3 me_unpack.py firmware.bin         # 解包 ME 区域

  # Intel ME 11+ (Minix-based)
  # 利用 CVE-2017-5705 等已知漏洞研究
  # JTAG 调试 (需要特殊硬件)

  # me_cleaner: 裁减 ME 固件 (去除非必要模块)
  python3 me_cleaner.py -S firmware.bin

AMD PSP (Platform Security Processor):
  - ARM Cortex-A5 / TrustZone
  - AMD 等价于 Intel ME
  - PSPTool: 解析 PSP 固件
  python3 psptool.py firmware.bin
```

---

## 开源固件

```text
Coreboot:
  - 开源 x86 固件 (替代 UEFI/BIOS)
  - 支持: ThinkPad / Chromebook / 部分服务器
  - 审计: 源码可读, 关注 romstage / ramstage / payload

LinuxBoot:
  - 用 Linux kernel 替代 DXE/BDS 阶段
  - 更快启动 + 更可审计
  - Google 服务器使用

U-Boot:
  - 嵌入式 / ARM 最常见 bootloader
  - 通过 UART / 网络 / USB 交互
  - 常见漏洞: 命令注入 / 认证绕过 / 缓冲区溢出

  逆向:
  strings u-boot.bin | grep -E 'U-Boot|version|boot'
  binwalk u-boot.bin                       # 查找嵌入文件
  # Ghidra: 导入为 ARM binary, 设置正确 base address
```

---

## 实战入口

- **Chipsec** — Intel 开源固件安全框架 (github.com/chipsec/chipsec)。
- **UEFITool** — 最佳固件分析 GUI (github.com/LongSoft/UEFITool)。
- **efiXplorer** — IDA UEFI 分析插件 (github.com/binarly-io/efiXplorer)。
- **Binarly blog** — UEFI 漏洞研究领先团队。
- **UEFI Specification** — uefi.org。
- **EDK II** — 开源 UEFI 参考实现 (github.com/tianocore/edk2)。
- **Sentinel One / ESET blog** — Bootkit 检测研究。
- **BlackHat / OffensiveCon UEFI talks** — 年度新研究。
- **me_cleaner / MEAnalyzer** — Intel ME 分析工具。
- **Coreboot docs** — doc.coreboot.org。

## 自检（接到目标 30 分钟内回答）

1. 目标平台？（x86 UEFI / ARM UEFI / U-Boot / Coreboot）
2. 有固件镜像吗？（SPI dump / BIOS update 文件 / 在线下载）
3. 目标模块？（DXE driver / SMM handler / PEI / ME / PSP）
4. Secure Boot 状态？（启用 / 禁用 / 自定义密钥）
5. 物理访问？（SPI flash / JTAG / UART / 仅远程）
6. 攻击模型？（本地提权 / 持久化 / 供应链 / 检测）
7. 已知 CVE / bootkit IOC？
8. 工具准备？（UEFITool / efiXplorer / Chipsec / Ghidra）
9. 合规需求？（NIST SP 800-147 / 193 / TCG）
10. 相邻技能？（fwrev / rktrev / hwrev / kernrev / malrev）

## 相邻技能

- `fwrev` — 通用固件逆向（嵌入式 / IoT）。
- `rktrev` — Rootkit / Bootkit 深度分析。
- `hwrev` — 硬件安全（SPI flash / JTAG / 侧信道）。
- `kernrev` — 内核逆向（UEFI → OS 衔接）。
- `malrev` — 恶意软件分析（bootkit 检测）。
- `hvrev` — Hypervisor（VBS / Secure Kernel 与 UEFI 交互）。