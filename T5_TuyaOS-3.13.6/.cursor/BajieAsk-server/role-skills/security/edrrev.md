---
name: edr-av-reverse-engineering
description: EDR / AV 产品逆向与对抗分析。用户态 hook / 内核回调 / ETW / AMSI / PPL / 签名规则逆向 / EDR 绕过技术研究 / Linux EDR。配合 winrev / linuxrev / malrev / kernrev 用。
---

# EDR / AV 产品逆向与对抗分析

## 适用场景
- 逆向 EDR/AV 产品的 hook 与监控机制。
- 分析 EDR 用户态 hook (ntdll unhooking / direct syscall)。
- 研究内核回调注册与 minifilter。
- 评估 EDR 检测能力与绕过面 (授权红队测试)。
- 分析 Linux EDR (Falco / Tetragon / CrowdStrike / SentinelOne)。

## 不适用
- 写恶意软件 (不在本技能范畴)。
- 常规恶意软件分析 → `malrev`。
- 内核开发 → `kernrev`。

---

## Windows EDR 架构

```text
用户态:
  ┌────────────────────────────────────────────┐
  │ 应用程序 (恶意/正常)                         │
  │   → kernel32.dll → ntdll.dll → syscall     │
  │          ↑              ↑                   │
  │      IAT hook       Inline hook             │
  │   (EDR user-mode DLL 注入到每个进程)         │
  └─────────────────────┬──────────────────────┘
                        │ syscall
  ┌─────────────────────▼──────────────────────┐
  │ 内核态                                      │
  │   内核回调:                                  │
  │     PsSetCreateProcessNotifyRoutineEx       │
  │     PsSetCreateThreadNotifyRoutine          │
  │     PsSetLoadImageNotifyRoutine             │
  │     ObRegisterCallbacks (进程/线程句柄)      │
  │     CmRegisterCallbackEx (注册表)            │
  │   Minifilter:                               │
  │     FltRegisterFilter (文件系统 I/O)         │
  │   网络:                                      │
  │     WFP (Windows Filtering Platform)        │
  │     NDIS filter                             │
  │   ETW:                                      │
  │     Microsoft-Windows-Threat-Intelligence   │
  │   驱动签名 + PatchGuard                      │
  └─────────────────────────────────────────────┘
```

## 用户态 Hook 分析

```text
EDR 注入方式:
  1. 远程线程注入 (CreateRemoteThread)
  2. APC 注入
  3. AppInit_DLLs / Image File Execution Options
  4. 内核回调 → 进程创建时注入

Hook 类型:
  IAT Hook:
    修改 Import Address Table entry → 指向 EDR hook function
    检测: 比较 IAT 与 on-disk PE 的导入表

  Inline Hook (Trampoline):
    函数开头写 JMP → EDR handler
    EDR handler: 记录参数 → 调用原始函数 → 记录结果
    典型: NtAllocateVirtualMemory / NtWriteVirtualMemory / NtCreateThread

  检测 hook:
    ReadProcessMemory 读 ntdll.dll 内存
    与磁盘上 C:\Windows\System32\ntdll.dll 对比
    diff → 找到被修改的字节

常见被 hook 的 API:
  NtAllocateVirtualMemory    内存分配
  NtWriteVirtualMemory       内存写入
  NtProtectVirtualMemory     内存权限修改
  NtCreateThread(Ex)         线程创建
  NtOpenProcess              进程打开
  NtQueueApcThread           APC 注入
  NtMapViewOfSection         节映射
  NtCreateFile               文件操作
  NtDeviceIoControlFile      IOCTL
```

```python
# 检测 ntdll hook (Python + pefile)
import pefile, ctypes

# 1. 从磁盘读取干净 ntdll
disk_pe = pefile.PE(r"C:\Windows\System32\ntdll.dll")
disk_text = None
for s in disk_pe.sections:
    if b".text" in s.Name:
        disk_text = s.get_data()
        break

# 2. 从内存读取当前 ntdll
ntdll = ctypes.windll.ntdll
base = ctypes.cast(ntdll._handle, ctypes.c_void_p).value
# 读取 .text section 对应内存区域
# 比较 disk_text vs memory_text → 找差异

# 差异位置 = hook 点
# 通常在函数开头看到: mov r10, rcx; mov eax, SSN → jmp <edr>
```

## 内核回调

```text
EDR 驱动注册的回调:

进程:
  PsSetCreateProcessNotifyRoutineEx(callback, FALSE)
  → 每个进程创建/退出时调用
  → 可阻止进程创建 (STATUS_ACCESS_DENIED)

线程:
  PsSetCreateThreadNotifyRoutine(callback)
  → 每个线程创建时调用

镜像加载:
  PsSetLoadImageNotifyRoutine(callback)
  → 每个 DLL/EXE 加载时调用
  → 可用于检测 reflective DLL 注入

句柄:
  ObRegisterCallbacks(...)
  → 过滤进程/线程句柄操作
  → 可阻止 OpenProcess(PROCESS_ALL_ACCESS, ...)
  → Lsass 保护常用此机制

注册表:
  CmRegisterCallbackEx(callback, ...)
  → 过滤所有注册表操作

文件:
  FltRegisterFilter(driver, registration, &filter)
  → Minifilter: 过滤所有文件 I/O
  → EDR 用于: 文件扫描 / 行为监控 / 勒索软件防护

枚举已注册回调 (需要内核权限):
  WinDbg: !callback
  Volatility: windows.callbacks
  工具: ObjectExplorer / WinObjEx64
```

## ETW (Event Tracing for Windows)

```text
ETW Provider 对 EDR 的价值:
  Microsoft-Windows-Threat-Intelligence:
    → 内核级 memory 操作监控
    → 需要 PPL (Protected Process Light) 才能注册
    → 最强: 能看到 NtAllocateVirtualMemory / NtProtectVirtualMemory

  Microsoft-Windows-Kernel-Process:
    → 进程创建/退出
  Microsoft-Windows-Kernel-File:
    → 文件操作
  Microsoft-Windows-Kernel-Network:
    → 网络连接
  Microsoft-Windows-DotNETRuntime:
    → .NET Assembly 加载 (Assembly.Load 检测)
  Microsoft-Windows-PowerShell:
    → PowerShell 命令日志

ETW 攻击:
  ETW patching: 修改 EtwEventWrite → ret (禁用 ETW)
  → 对策: Threat-Intelligence provider 在内核, 难 patch
  → PPL 保护: 用户态进程无法修改 PPL 进程内存
```

## AMSI (Antimalware Scan Interface)

```text
AMSI 流程:
  PowerShell / .NET / VBA / JScript / WMI
    → AmsiScanBuffer(buffer) / AmsiScanString(string)
      → 发送到注册的 AV/EDR provider
      → 返回: AMSI_RESULT_CLEAN / AMSI_RESULT_DETECTED

分析:
  amsi.dll 导出:
    AmsiInitialize / AmsiOpenSession / AmsiScanBuffer / AmsiScanString

  绕过研究 (红队测试):
    1. amsi.dll 内存 patch (AmsiScanBuffer → ret)
    2. 反射加载绕过 AMSI
    3. 混淆 payload 避免签名匹配
    4. CLR hooking

  检测绕过:
    ETW + Threat-Intelligence 可检测 AMSI patch
    内存完整性检查
```

## Linux EDR

```text
架构:
  内核层:
    eBPF (kprobe / tracepoint / LSM hook)
    audit subsystem
    fanotify (文件监控)
    netfilter / iptables

  用户层:
    Agent daemon (收集 + 上报)
    YARA 扫描
    行为分析引擎

  产品:
    Falco:       eBPF + syscall 规则引擎 (开源)
    Tetragon:    eBPF 运行时安全 (Cilium/Isovalent)
    Wazuh:       开源 HIDS
    CrowdStrike: Falcon sensor (内核模块)
    SentinelOne: Agent (eBPF + 内核模块)

  分析:
    - Agent 二进制逆向 (通常 Go → gorev)
    - eBPF 程序逆向 (→ ebpfrev)
    - 检测规则提取
    - 通信协议分析 (→ protrev)
```

## 实战入口
- **elastic/protections-artifacts** — 开源检测规则。
- **SyscallExtractor** — 提取 EDR hook 的 syscall 编号。
- **InlineHookDetector** — 检测用户态 inline hook。
- **Volatility callbacks plugin** — 内核回调枚举。
- **EDR Internals (blog series)** — 各大 EDR 内部机制分析。
- **Red Team Operator courses** — 授权对抗测试。

## 自检
1. 目标 EDR？(CrowdStrike / SentinelOne / Defender / Carbon Black / 其他)
2. 平台？(Windows / Linux / macOS)
3. 分析目标？(hook 机制 / 检测规则 / 绕过面)
4. 内核访问？(调试器 / Volatility)
5. 授权测试？
6. 红队还是蓝队视角？

## 相邻技能
- `winrev` — Windows 内部结构。
- `linuxrev` — Linux 内部结构。
- `kernrev` — 内核回调 / 驱动分析。
- `malrev` — 恶意软件分析 (EDR 视角)。
- `mitirev` — 安全缓解机制。
- `ebpfrev` — eBPF 安全程序分析。