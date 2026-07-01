---
name: rootkit-bootkit-reverse-engineering
description: Rootkit 与 Bootkit 逆向。用户态/内核态/UEFI/Hypervisor 四层 rootkit 分析；hook 机制；隐藏技术；检测方法；已知家族分析。配合 kernrev / bootrev / malrev / memrev 用。
---

# Rootkit / Bootkit 深度分析

## 适用场景
- 分析内核级 rootkit 的 hook 与隐藏机制。
- 检测 UEFI bootkit / SPI flash 篡改。
- 使用 Volatility / 内存取证检测 rootkit。
- 分析 Linux / Windows / macOS rootkit 样本。
- 研究检测与防御方法。

## 不适用
- 用户态恶意软件 → `malrev`。
- 常规内核分析 → `kernrev`。
- UEFI 固件分析 → `bootrev`。

---

## Rootkit 分类

```text
层级               持久性    隐蔽性    示例
───────────────────────────────────────────────────
用户态 (Ring 3)    低        低       LD_PRELOAD / DLL injection / IAT hook
内核态 (Ring 0)    中        高       LKM / sys driver / DKOM / syscall hook
UEFI (Ring -2)     极高      极高     BlackLotus / CosmicStrand / LoJax
Hypervisor (Ring -1) 极高    极高     Blue Pill / SubVirt
固件               极高      极高     Hacking Team UEFI / Equation Group HDD fw
```

## 用户态 Rootkit

```text
Linux:
  LD_PRELOAD hook:
    - 劫持 libc 函数 (readdir / open / stat / getdents)
    - 隐藏文件/进程/网络连接
    - 检测: ldd / LD_DEBUG=all / /etc/ld.so.preload
    - 绕过: 直接 syscall (不经过 libc)

  ptrace inject:
    - PTRACE_ATTACH + 注入 shellcode
    - 修改 GOT 表

Windows:
  IAT hook:
    - 修改 Import Address Table → 重定向 API
    - 检测: 比较 IAT entry 与 on-disk PE

  Inline hook:
    - 在函数开头写 JMP → hook handler
    - 检测: 比较内存与磁盘代码段

  DLL injection:
    - CreateRemoteThread + LoadLibrary
    - APC injection / NtQueueApcThread
    - 检测: 枚举进程模块列表

  AppInit_DLLs / ShimEngine:
    - 注册表持久化注入
```

## 内核态 Rootkit

```text
Linux:
  Loadable Kernel Module (LKM):
    - 替换 syscall table 函数指针
    - 修改 proc 文件系统处理函数
    - DKOM: 修改 task_struct 链表 (隐藏进程)
    - 修改 VFS: 隐藏文件

  已知家族:
    Diamorphine:  经典 LKM rootkit (GitHub 上开源)
    Reptile:      高级 LKM + 用户态
    Drovorub:     GRU (APT28) Linux rootkit
    Adore-ng:     经典
    Azazel:       LD_PRELOAD + anti-debug

  检测:
    - 比较 /proc/modules 与 /sys/module
    - 比较 syscall table 与 System.map
    - Volatility: linux.check_syscall / linux.hidden_modules
    - rkhunter / chkrootkit / AIDE

Windows:
  Kernel Driver (.sys):
    - SSDT hook (旧, PatchGuard 之前)
    - DKOM: 修改 EPROCESS 链表
    - Minifilter: 文件系统过滤
    - Callback: PsSetCreateProcessNotifyRoutine / ObRegisterCallbacks
    - NDIS filter: 网络隐藏

  已知家族:
    TDL4/Alureon:  MBR bootkit + kernel driver
    ZeroAccess:    kernel rootkit + P2P botnet
    Necurs:        kernel rootkit + spam botnet
    Turla:         APT kernel driver

  检测:
    - GMER (经典)
    - Volatility: windows.ssdt / windows.callbacks
    - PatchGuard 限制: SSDT/IDT 修改会 BSOD
    - Driver Signature Enforcement (DSE)
```

## UEFI Bootkit

```text
已知:
  LoJax (2018):           APT28, SPI flash 写入恶意 DXE driver
  MosaicRegressor (2020): 亚太 APT, SPI flash 级
  FinSpy UEFI (2021):     商业间谍软件
  ESPecter (2021):        修改 EFI System Partition
  CosmicStrand (2022):    中国 APT, 固件 implant
  BlackLotus (2023):      首个绕过 Secure Boot 的野外 bootkit

机制:
  1. SPI Flash 修改:
     - 在 UEFI 固件中植入恶意 DXE driver
     - 每次启动自动执行, OS 重装无效
     - 需要 SPI write 权限 (通过漏洞或物理访问)

  2. ESP 修改:
     - 替换 bootmgfw.efi / grubx64.efi
     - 或添加额外 .efi 到启动链
     - 相对容易 (只需管理员权限)

  3. Bootloader 漏洞:
     - BootHole: GRUB2 配置解析溢出
     - 利用合法但有漏洞的旧 bootloader

检测:
  - Chipsec: SPI flash 保护检查
  - ESP 完整性: 验证 .efi 签名
  - Measured Boot: TPM PCR 值验证
  - UEFI 固件 hash 与 vendor 对比
  详见 bootrev
```

## 检测工具

```bash
# Linux
rkhunter --check                           # 经典 rootkit 检测
chkrootkit                                 # 经典
AIDE                                       # 文件完整性

# Volatility (内存取证)
vol3 -f memory.dmp linux.check_syscall     # syscall table 完整性
vol3 -f memory.dmp linux.hidden_modules    # 隐藏内核模块
vol3 -f memory.dmp linux.check_idt        # IDT 完整性
vol3 -f memory.dmp windows.ssdt           # Windows SSDT
vol3 -f memory.dmp windows.callbacks      # 内核回调

# Windows
GMER                                       # 内核 rootkit 检测
Windows Defender Offline                   # 离线扫描

# UEFI
chipsec_main -m common.bios_smi           # SPI 保护
chipsec_main -m common.spi_lock           # SPI 锁定
chipsec_main -m common.secureboot.variables # Secure Boot
```

## 实战入口
- **Volatility** — 内存级 rootkit 检测。
- **Chipsec** — UEFI/固件安全。
- **GMER** — Windows 内核 rootkit 检测。
- **Diamorphine / Reptile source** — 学习 Linux rootkit 技术。
- **ESET / Kaspersky bootkit research**。

## 自检
1. 疑似层级？(用户态 / 内核 / UEFI / Hypervisor)
2. 平台？(Linux / Windows / macOS)
3. 有内存 dump？(Volatility 分析)
4. 有固件镜像？(UEFI bootkit 检查)
5. 有已知 IOC？
6. 持久化机制？

## 相邻技能
- `kernrev` — 内核结构 (理解 hook 目标)。
- `bootrev` — UEFI bootkit 分析。
- `malrev` — 恶意软件行为分析。
- `memrev` — 内存取证检测。
- `hvrev` — Hypervisor rootkit。