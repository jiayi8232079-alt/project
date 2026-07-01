---
name: windows-reverse-engineering
description: Windows 运行生态逆向。PE 加载链 / ntdll-KernelBase-kernel32 三层 API、syscall stub、TLS callback、IAT/EAT/inline hook、注入面（CreateRemoteThread / APC / SetWindowsHook / ProcessHollowing / DLL hijack / KnownDLLs）、持久化面（Run keys / Services / Tasks / WMI / IFEO / AppInit_DLLs）、ETW/AMSI/PPL 边界、PEB/TEB/KUSER_SHARED_DATA、WoW64、x64dbg/WinDbg/TTD 工作流。
---

# Windows 运行生态逆向

## 适用场景

- Windows 上的 PE/EXE/DLL/SYS，要回答："启动后调了哪些 API？哪些注入手法？持久化点在哪？签名如何？走哪个 syscall？"
- 注入面 / 持久化面 / EDR 检测面识别（ETW、AMSI、PPL、Code Integrity、WDAC）。
- 用户态 + 内核态 调试：x64dbg / WinDbg / TTD（Time-Travel Debugging）。
- WoW64（32 位进程跑在 64 位 Windows）行为差异。
- 服务、计划任务、COM、WMI、PowerShell 触发链识别。

## 不适用

- PE 头 / 节区 / 函数 / 反编译 → `binrev`。
- 内存 dump 取证 → `memrev` / `crashrev`。
- .NET IL 反编译 → `scriptrev`。
- 老 16 位 DOS exe / NE 头 → 罕见，需要专门工具（DOSBox/Ghidra MS-DOS loader）。

## PE 加载链速记

```text
CreateProcess / NtCreateUserProcess
  └─ kernel: 解析 PE → 建立映射 → 装 ntdll 进新进程
       └─ ntdll!LdrInitializeThunk
            ├─ 处理 IMAGE_LOAD_CONFIG（CFG bitmap、Security cookie 初始化）
            ├─ 装载静态依赖（按 IMPORT Directory）
            │    └─ KnownDLLs 优先（kernel32 / KernelBase / user32 / advapi32 / ...）
            ├─ TLS callback（IMAGE_TLS_DIRECTORY → AddressOfCallbacks，逐个跑）
            ├─ DllMain 链（DLL_PROCESS_ATTACH，按 init 顺序）
            └─ 跳 EntryPoint（exe 的 mainCRTStartup → main / WinMain）
```

API 三层结构：

```text
应用层 → kernel32!CreateFileW
         └─ KernelBase!CreateFileW                    （Win7+ 大量 API 移到 KernelBase）
              └─ ntdll!NtCreateFile                   （转发到 syscall stub）
                   └─ syscall <ssn> ; ret             （per-build 编号变化）
```

WoW64 子系统（32 位进程在 64 位 Windows）：`wow64.dll` + `wow64cpu.dll` + `wow64win.dll` 在 32→64 切换；syscall 走 `Wow64Transition` 指针 → 切到 64bit ntdll。

## 进程视角

```bash
# Sysinternals 套件（Microsoft 自家，必备）
procexp.exe                                    # 进程树 + 句柄 + 符号 + DLL 视图
procmon.exe                                    # 实时 file/registry/network/process event；filter 收口必学
autoruns.exe                                   # 持久化面一键扫描
sigcheck.exe -h -s -e -accepteula <path>       # 签名 + 哈希 + 元数据
strings.exe -accepteula sample.exe
listdlls.exe sample.exe
psloggedon.exe / psinfo.exe / psexec.exe / pskill.exe / psloglist.exe / pipelist.exe / accesschk.exe
handle.exe -p <pid>
```

PowerShell / cmd 内置：

```powershell
Get-Process | Sort-Object PM -Descending | Select -First 20
Get-CimInstance Win32_Process | Where-Object Name -eq 'sample.exe' | fl *
Get-Process -Id $pid | Select-Object -ExpandProperty Modules | ft Modulename, FileVersion, FileName
Get-Service | Where-Object Status -eq 'Running'
Get-WmiObject win32_startupcommand
```

## 调试器三件套

### x64dbg（用户态首选）

```text
# 启动 + 命令栏（类似 OllyDbg）
init "C:\samples\sample.exe", "arg1 arg2"
bp CreateFileW
bp ntdll.NtAllocateVirtualMemory
bp .text:401050
log "called CreateFileW: filename={s:[esp+4]}"
SetHardwareBP rcx, 1, 0                        # HBP read 1B at rcx

# 反反调试
PEB.IsBeingDebugged = 0
PEB.NtGlobalFlag &= ~0x70
KdHelp.IsDebuggerPresent return 0
ScyllaHide 插件                                  # 一键过 IsDebuggerPresent / CheckRemoteDebuggerPresent / NtQueryInformation / NtSetInformationThread / OutputDebugString
```

### WinDbg（内核 + 用户 + minidump 全能）

```text
# 用户态 attach
windbg -p <pid>

# 内核态（VM + named pipe）
bcdedit /debug on; bcdedit /dbgsettings serial debugport:1 baudrate:115200
windbg -k com:port=\\.\pipe\com_1,baud=115200,pipe

# 必备命令
.symfix; .reload                                # 加载 Microsoft 符号
lm                                              # 加载模块
!process 0 0                                    # 全部进程（内核态）
!process 0 7 sample.exe                         # 详情
!handle 0 7                                     # 句柄
!peb / !teb
!analyze -v                                     # 崩溃自动分析
~* k                                            # 所有线程的栈
.ttdfind  / !tt 0x...                           # TTD 时间旅行调试
.fpo                                            # FPO 帧指针忽略
ba w 4 0x12345678                               # 写硬件断点
ed esp+0x4 0xdeadbeef                           # 改栈
sxe ld kernel32.dll                             # DLL 加载断点
dt nt!_PEB @$peb                                # 类型化 dump
dx -r1 (*((nt!_LIST_ENTRY*)0xfff...))           # JS 表达式
```

### TTD（Time-Travel Debugging）

```bash
# 录制
TTD.exe -out C:\trace -children sample.exe
# 在 WinDbg Preview / x64dbgX64 / Visual Studio 回放
# !tt 100                  跳到指令序号 100
# !position                当前位置
# g-                       反向运行
```

TTD 是 Windows 上对付反调试样本的杀器：录一遍后离线慢慢倒带分析。

## 注入面（识别 + 测试）

| 手法 | API 链 | 检测点 |
| --- | --- | --- |
| **CreateRemoteThread + LoadLibrary** | `OpenProcess` → `VirtualAllocEx` → `WriteProcessMemory` → `CreateRemoteThread(LoadLibraryA)` | 经典，被全民检测；ETW Threat-Intelligence 直接命中 |
| **NtCreateThreadEx** | ntdll 直接 syscall，绕一些 hook | EDR 看 thread start address ≠ image |
| **APC inject** | `NtQueueApcThread` / `NtAlertResumeThread` 把 APC 入队，等线程 alertable | 仅 alertable wait 时触发 |
| **SetWindowsHookEx** | 装 WH_GETMESSAGE 等钩子，DLL 自动注入到所有有窗口的进程 | 必须 DLL 落盘，AV 易扫 |
| **Process Hollowing** | `CreateProcess(SUSPENDED)` → `NtUnmapViewOfSection` → `WriteProcessMemory` → `SetThreadContext` → `ResumeThread` | 创建 suspended → 内存被替换；ETW 易标记 |
| **Process Doppelgänging** | TxF 事务 + `NtCreateSection` + image 替换 | 用 TxF（已弃用），新 Windows 收紧 |
| **Process Ghosting** | `NtCreateFile(DELETE_ON_CLOSE)` + image section + delete file | 文件 unlink 后仍能 map |
| **Reflective DLL** | 自实现 PE loader 从内存加载 DLL | 无 LoadLibrary 调用，只有 VirtualAlloc + 内存 PE |
| **Module Stomping** | 合法 DLL 加载后，覆盖其内存执行段 | 模块名匹配但内存修改 |
| **Manual Mapping** | 完全自实现 LoadLibrary，从未走 ntdll 加载链 | 无 LDR_DATA_TABLE_ENTRY 项 |
| **AtomBombing** | 全局 atom 表传 shellcode | 已被 EDR 全面覆盖 |
| **EarlyBird** | 创建挂起线程，APC 在 main 之前跑 | 启动序列异常 |
| **DLL Sideloading / Hijack** | 利用搜索顺序：当前目录 > System32 > ... | 合法签名进程加载未签名 DLL |
| **COM Hijack** | 改 HKCU\Software\Classes\CLSID\{...}\InprocServer32 | RegMon 易看到 |
| **Hell's Gate / Halo's Gate** | 直接 syscall 不走 ntdll stub | 看不到 ntdll 调用，看到 syscall 指令直接执行 |

测试 hook：用 `Frida-Windows` 或 `Detours` 库在自己的进程内 hook `CreateFileW` 验证：

```js
// frida hook 测试
const f = Module.findExportByName('kernel32.dll', 'CreateFileW');
Interceptor.attach(f, {
  onEnter(args){ console.log('CreateFileW', args[0].readUtf16String()); }
});
```

## 持久化面（Autoruns 几乎覆盖；这是清单）

```text
[Run keys]
HKCU\Software\Microsoft\Windows\CurrentVersion\Run
HKLM\Software\Microsoft\Windows\CurrentVersion\Run
HKLM\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Run
HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce
HKLM\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders\Startup

[Services]
HKLM\System\CurrentControlSet\Services\<name>\ImagePath
sc.exe / Get-Service / Get-CimInstance Win32_Service

[Scheduled Tasks]
schtasks /query /fo LIST /v
%WINDIR%\System32\Tasks\*

[WMI Subscription]
__EventFilter / __EventConsumer / __FilterToConsumerBinding
Get-WmiObject -Namespace root\subscription -Class __EventFilter

[Image File Execution Options]
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\<exe>\Debugger
   ; 经典 sticky-keys / accessibility 替换

[AppInit_DLLs]
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Windows\AppInit_DLLs   (Win7-, 已废弃)
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Windows\LoadAppInit_DLLs

[AppCertDlls]
HKLM\System\CurrentControlSet\Control\Session Manager\AppCertDlls

[Winlogon]
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon\Userinit / Shell / Notify

[BHO / Office Add-In / Outlook]
HKCU\Software\Microsoft\Internet Explorer\Extensions
HKCU\Software\Microsoft\Office\Outlook\Addins
HKLM\Software\Microsoft\Office\<App>\Addins

[COM Hijack]
HKCU\Software\Classes\CLSID\{...}\InprocServer32

[Print Provider / Driver]
HKLM\System\CurrentControlSet\Control\Print\Providers
HKLM\System\CurrentControlSet\Control\Print\Monitors

[Driver / Service kernel]
HKLM\System\CurrentControlSet\Services\<svc>\ImagePath  (REG_EXPAND_SZ \??\C:\...)

[Time Provider / Network Provider / NetSh helper]
HKLM\System\CurrentControlSet\Services\W32Time\TimeProviders
HKLM\System\CurrentControlSet\Services\NetShell\Helpers
```

一键扫：`autorunsc.exe -accepteula -a * -c -h -s -t -nobanner > autoruns.csv`

## EDR 边界 / 反检测面（识别）

```text
ETW (Event Tracing for Windows)
  Microsoft-Windows-Threat-Intelligence    # 高价值，要 PPL 才能订阅
  Microsoft-Windows-Kernel-File / Process / Network
  绕路: PatchETW（patch ntdll!EtwEventWrite 头部 4 字节为 ret）

AMSI (Antimalware Scan Interface)
  amsi.dll!AmsiScanBuffer → COM → 已注册 AV
  绕路: patch AmsiScanBuffer 入口 / AmsiContext->Signature 改

PPL (Protected Process Light)
  EDR 进程 (MsMpEng, MsSense) 跑在 PPL，普通 admin OpenProcess(PROCESS_ALL_ACCESS) 拿不到
  Mimikatz!misc::skeleton 类思路：内核 driver 绕

WDAC / AppLocker / Code Integrity
  策略级阻止未签名/未授权 dll/exe 加载

CFG (Control Flow Guard)
  IMAGE_LOAD_CONFIG.GuardCFCheckFunction 表
  间接调用前必须查 bitmap

CET (Control-flow Enforcement Technology, Win10 20H1+)
  shadow stack（硬件）+ IBT
```

测试时这些都是合法研究范畴 — 知道它们在测什么，是为了在授权环境精确触发或排除。

## 系统结构速查

```text
PEB (Process Environment Block) @ FS:[0x30] (x86) / GS:[0x60] (x64)
  +0x002 BeingDebugged
  +0x00C Ldr (PEB_LDR_DATA → InLoadOrderModuleList → LDR_DATA_TABLE_ENTRY)
  +0x010 ProcessParameters (RTL_USER_PROCESS_PARAMETERS)
  +0x020 KernelCallbackTable
  +0x068 NtGlobalFlag

TEB (Thread Environment Block) @ FS:[0x18] (x86) / GS:[0x30] (x64)
  +0x000 NT_TIB.ExceptionList (SEH chain, x86 only)
  +0x030 PEB
  +0x048 ThreadId
  +0x058 TLS slots

KUSER_SHARED_DATA @ 0x7FFE0000 (R/O)
  +0x300 SystemCall (syscall instruction selector hint)
  +0x008 TickCountMultiplier 等

LDR module list 遍历（无 GetModuleHandle）：
  PEB->Ldr->InLoadOrderModuleList->Flink ... 找 BaseDllName
```

## syscall 速查

```text
ntdll!NtXxx 是 user-mode stub:
   mov r10, rcx
   mov eax, <SSN>     ; per-build syscall number
   syscall
   ret

获取 SSN（不走 ntdll）：
1) Hell's Gate: 解析 ntdll 内存里的 NtXxx prologue 抓 mov eax, imm32
2) Halo's Gate: 被 hook 时跨过去取相邻 NtXxx 编号 ± 1
3) Tartarus' Gate: combined
4) SysWhispers / SysWhispers2 / SysWhispers3: 编译期生成 stub

公开 SSN 列表: 
  github.com/j00ru/windows-syscalls
  github.com/RtlDallas/SyscallTable
```

## .NET / IL 速查

```text
PE 里 .NET 标志: COR20 header (IMAGE_COR20_HEADER), 入口在 mscoree.dll!_CorExeMain
工具:
  dnSpy / dnSpyEx          反编译 + 动态调试
  ILSpy / Avalonia ILSpy   反编译
  de4dot                   去 ConfuserEx / SmartAssembly / Eazfuscator
  dotPeek                  JetBrains 反编译
ScriptRev 接力做 IL 字节码深挖
```

## 实战入口

- **HackTheBox / OffensiveSecurity OSEP / OSED / OSEE** — Windows 内网 + AV/EDR 实战。
- **Flare-On 历年 PE 题** — 反调试 + 反沙箱 + 自定义 packer 综合训练。
- **MalwareBazaar Windows 标签** — 真实样本，VM。
- **看雪 / 52pojie 中文论坛** — 大量 Windows 逆向 writeup。
- **OALabs Patreon / MalwareTech / Vector35 stream** — 系统化视频。
- **Windows Internals 7e (Russinovich)** — 必读底层书。

## 自检（拿到 PE 30 分钟内回答）

1. PE32 / PE32+ / .NET / 驱动 (.sys)？编译器与 PDB 路径？签名状态？
2. ASLR / DEP / SafeSEH / CFG / GS cookie / Authenticode？子系统（GUI / Console / Driver）？
3. 导入表关键 API：注入 / 网络 / 加密 / 反调试家族都有哪些命中？
4. 是否有 TLS callback？数量？做了什么？
5. 主线程入口前的所有副作用（导入解析、TLS、DllMain 链）有没有异常？
6. 持久化面：autorunsc 一键扫，是否落盘 + 注册？
7. 是否走 direct syscall（绕 ntdll）？SSN 表对得上当前 build 吗？

## 相邻技能

- `binrev` / `asmrev` / `abirev` — PE 结构、x86_64 指令、Microsoft x64 ABI / SEH unwind。
- `crashrev` / `memrev` / `debugrev` — minidump、内存证据、TTD 分析。
- `malrev` — Windows 恶意样本检测规则与 IOC。
- `packrev` — UPX / Themida / VMProtect / Enigma / ASPack 识别与脱壳。
- `cryptrev` — BCrypt / CNG / CryptoAPI / OpenSSL on Windows 调用流。
- `protrev` — RPC / DCOM / SMB / RDP 协议层。
- `sdkrev` — 闭源 SDK 在 Windows 上的形态（DLL + import lib）。
- `scriptrev` — .NET IL / PowerShell / VBScript / JScript / WMI 字节码。
- `vmrev` — Themida / VMProtect / Code Virtualizer 自带 VM。