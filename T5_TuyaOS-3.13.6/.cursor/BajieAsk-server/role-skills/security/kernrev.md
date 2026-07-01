---
name: kernel-reverse-engineering
description: Linux / Windows / macOS 内核逆向。EPROCESS / task_struct / vfs / vnode / proc_struct 内部数据；driver / kext / sys 通信（IOCTL / IRP / ioring / syscall）；内核 hook 点（SSDT / IDT / inline / KPP/PG bypass）；kernel panic / kdump / KASAN/KMSAN/KCSAN 日志解读；vmlinux / ntoskrnl 符号还原；kgdb / WinDbg kd / lldb-kernmode 联机调试；syzkaller / Pwn2Own 内核题方法论。配合 winrev / linuxrev / macrev / rktrev / hvrev 用。
---

# 内核 / 驱动 / Rootkit 逆向

## 适用场景

- 对授权内核模块 / 驱动 / kext 做逆向分析，定位 IOCTL handler、漏洞点与特权操作。
- 解读 Linux kernel oops / panic / KASAN / KMSAN / KCSAN 报告，反推 root cause。
- WinDbg kd 调试内核驱动 + IRP/FastIo 路径还原。
- lldb / kdk 调试 macOS / iOS XNU kext。
- syzkaller / kAFL 跑内核 fuzz + 处理 crash → 写最小复现 + 评估可利用性。
- 检测与分析 rootkit / bootkit 内核级后门。

## 不适用

- 只想查 syscall 文档 → man pages / MSDN / Apple KDK headers。
- 用户态程序逆向 → `binrev`。
- 完整 LPE exploit chain 构造 → 不在本技能。
- 纯网络协议栈分析 → `protrev`。

---

## Linux 内核核心数据结构

```text
task_struct (进程)
  ├── mm_struct (内存空间)
  │   ├── pgd         (page global directory)
  │   ├── vm_area_struct 链表 (VMA: mmap / brk / stack / file)
  │   └── mmap_lock (rw_semaphore)
  ├── files_struct (文件描述符表)
  │   └── fdtable → file → f_op (file_operations)
  ├── cred (权限)
  │   ├── uid / gid / euid / egid
  │   ├── cap_effective / cap_permitted / cap_inheritable
  │   └── security (LSM blob: SELinux / AppArmor)
  ├── nsproxy (namespace)
  │   ├── mnt_ns / pid_ns / net_ns / user_ns / uts_ns / ipc_ns / cgroup_ns / time_ns
  │   └── 容器逃逸关注: user_ns + pid_ns + mount_ns 组合
  ├── signal_struct / sighand_struct
  ├── thread_info / thread_struct (架构相关)
  └── sched_entity (调度)

关键查看:
  crash> task_struct.cred <addr>
  crash> files_struct.fdt <addr>
  gdb: p ((struct task_struct *)0xffff...)->cred->uid
```

### VFS 层

```text
超级块 (super_block)
  └── inode
      └── dentry (目录项)
          └── file
              └── file_operations {
                    .open .read .write .ioctl .mmap .release .llseek .poll .fasync
                  }

驱动注册路径:
  misc_register(&misc_dev)  → /dev/my_dev
  register_chrdev(major, "name", &fops)
  cdev_add(&cdev, devno, 1)
  platform_driver_register(&plat_drv)
  pci_register_driver(&pci_drv)
  usb_register(&usb_drv)

逆向时找:
  .unlocked_ioctl / .compat_ioctl  →  用户空间 ioctl 入口
  .mmap                            →  用户空间 mmap 入口
  .write                           →  用户空间 write 入口
  copy_from_user / copy_to_user    →  数据搬运边界
  __user 标注                      →  稀疏检查（sparse）
```

### 内核安全机制

```text
SMEP (Supervisor Mode Execution Prevention)
  CPU 禁止 ring0 执行用户页。CR4.SMEP=1。
  绕过: ret2dir / physmap spray (前提: 映射物理内存到 direct map)

SMAP (Supervisor Mode Access Prevention)
  CPU 禁止 ring0 读写用户页。CR4.SMAP=1。
  绕过: copy_from/to_user wrapper + stac/clac

KASLR (Kernel Address Space Layout Randomization)
  内核基址随机化 (~9 bit entropy, 512 slots, 2MB align on x86_64)
  泄漏: /proc/kallsyms (root) / dmesg / syslog / side-channel
  CONFIG_RANDOMIZE_BASE=y

KPTI (Kernel Page Table Isolation / Meltdown 缓解)
  用户态 → 内核态切换时切换页表
  开销 ~5%

Stack Canary (CC_STACKPROTECTOR)
  __stack_chk_fail

CFI (Control Flow Integrity)
  kCFI / FineIBT (x86) / Clang CFI (-fsanitize=cfi)
  CONFIG_CFI_CLANG=y (5.13+)

FORTIFY_SOURCE
  编译期 + 运行时 memcpy/strcpy 长度检查

Lockdown (LSM)
  integrity / confidentiality 模式
  阻止: kexec / hibernation / ioport / mmiotrace / debugfs

SELinux / AppArmor / Smack
  MAC 强制访问控制
  avc: denied → 策略问题

Secure Boot + Signed Modules
  模块签名验证: CONFIG_MODULE_SIG_FORCE=y
  MOK (Machine Owner Key) 链
```

---

## Windows 内核核心数据结构

```text
EPROCESS (进程)
  ├── ObjectTable (HANDLE_TABLE → 句柄表)
  ├── Peb (Process Environment Block → 用户态)
  ├── Token (安全令牌: SID / 特权 / Integrity Level)
  ├── VadRoot (Virtual Address Descriptor → 内存布局)
  ├── ActiveProcessLinks (LIST_ENTRY → 进程链)
  ├── ThreadListHead → ETHREAD
  └── SectionObject (EXE/DLL 映射)

ETHREAD (线程)
  ├── Tcb (KTHREAD)
  ├── Win32Thread (GUI 线程对象)
  ├── StartAddress
  ├── Teb (Thread Environment Block → 用户态)
  └── IrpList (pending I/O)

DRIVER_OBJECT
  ├── MajorFunction[28] (IRP dispatch table)
  │   ├── IRP_MJ_CREATE          = 0x00
  │   ├── IRP_MJ_READ            = 0x03
  │   ├── IRP_MJ_WRITE           = 0x04
  │   ├── IRP_MJ_DEVICE_CONTROL  = 0x0e  ← IOCTL 入口
  │   ├── IRP_MJ_INTERNAL_DEVICE_CONTROL = 0x0f
  │   └── IRP_MJ_PNP / IRP_MJ_POWER
  ├── DeviceObject (链表)
  └── DriverUnload

WinDbg 常用:
  !process 0 0                    列所有进程
  !process <EPROCESS> 7           详细信息
  dt nt!_EPROCESS <addr>          偏移
  dt nt!_DRIVER_OBJECT <addr>     驱动对象
  !devobj <addr>                  设备对象
  !irp <addr>                     IRP
  !devstack <device>              设备栈
  !drvobj <name> 2                MajorFunction 表
```

### Windows 内核安全机制

```text
PatchGuard (KPP - Kernel Patch Protection)
  监控关键结构: SSDT / IDT / GDT / MSR / Cr0/Cr4 / 内核代码段
  检测到篡改 → BSOD: CRITICAL_STRUCTURE_CORRUPTION (0x109)
  绕过研究: HyperGuard 时代越来越难

VBS (Virtualization-Based Security)
  Credential Guard / HVCI (Hypervisor-Enforced Code Integrity)
  Secure Kernel (VTL 1) vs Normal Kernel (VTL 0)
  W^X 强制: 内核页面不可同时 RWX

DSE (Driver Signature Enforcement)
  必须 WHQL / EV 签名 (Win10+)
  绕过: 漏洞驱动 BYOVD / 测试签名模式

kASLR (Kernel ASLR)
  每次启动随机化 ntoskrnl / HAL / 驱动基址
  泄漏: NtQuerySystemInformation(SystemModuleInformation) → 中等 integrity

SMEP / SMAP / CET-IBT / Shadow Stack
  Win11 22H2+ 强制 CET

Cfg (Control Flow Guard)
  检查间接调用目标合法性
  bitmap at nt!guard_check_icall_fptr
```

---

## macOS / iOS 内核 (XNU)

```text
proc_struct (进程)
  ├── task (Mach task → 内存 / 线程 / 端口)
  ├── p_ucred (权限)
  ├── p_fd (文件描述符)
  └── p_textvp (可执行文件 vnode)

vnode (VFS)
  ├── v_type (VREG / VDIR / VCHR / VBLK / VLNK / VSOCK / VFIFO)
  ├── v_op (vnodeop_desc → 操作表)
  └── v_mount (mount)

IOKit 驱动 (C++ 继承)
  IOService → IOUserClient → externalMethod()
  externalMethod dispatch table: IOExternalMethodDispatch[]
  逆向目标: 找 IOConnectCallMethod 对应的 selector → externalMethod handler

关键安全:
  Apple PAC (Pointer Authentication Code)
    ARMv8.3 指令: paciasp / autiasp / retab
    A/B key: IA/IB/DA/DB
    绕过: signing gadget / key reuse / PAC oracle

  PPL (Page Protection Layer)
    XNU 子系统保护页表页, 防 kernel 自身篡改
    仅 ppl_* 函数可修改

  KTRR / AMCC / APRR (硬件寄存器锁定)
    只读内核代码/数据 region
    不可软件绕过

  SIP (System Integrity Protection)
    csrutil / rootless
    保护 /System /usr /bin

  AMFI (Apple Mobile File Integrity)
    代码签名 + entitlement 检查

调试:
  lldb + KDK (Kernel Debug Kit) / development kernel
  boot-args="debug=0x44 kdp_match_name=en0 -v kcsuffix=development"
  (lldb) kdp-remote <ip>
  (lldb) showallvnodes / showalltasks / showallprocs
```

---

## 内核调试实战

### Linux kgdb / QEMU

```bash
# QEMU 调试 (最常用)
qemu-system-x86_64 \
    -kernel bzImage \
    -initrd rootfs.cpio.gz \
    -append "console=ttyS0 nokaslr root=/dev/sda rw" \
    -drive file=rootfs.img,format=raw \
    -nographic \
    -s -S                                # -s = gdb stub on :1234, -S = 暂停等待连接

# GDB 连接
gdb vmlinux
(gdb) target remote :1234
(gdb) hbreak start_kernel                # 硬件断点 (kgdb 只支持 hbreak)
(gdb) c

# 带 KASAN 的调试内核
./scripts/config --enable CONFIG_KASAN
./scripts/config --enable CONFIG_KASAN_INLINE
./scripts/config --enable CONFIG_DEBUG_INFO
./scripts/config --enable CONFIG_GDB_SCRIPTS
make -j$(nproc)

# kgdb over serial (物理机 / VM)
# 目标机:
echo ttyS0 > /sys/module/kgdboc/parameters/kgdboc
echo g > /proc/sysrq-trigger             # 进入调试状态

# 主机:
gdb vmlinux
(gdb) target remote /dev/ttyS0

# LKML + GDB Python 脚本
(gdb) lx-dmesg                           # dmesg
(gdb) lx-ps                              # 进程列表
(gdb) lx-lsmod                           # 模块
(gdb) lx-symbols                         # 加载模块符号
(gdb) p $lx_current().comm               # 当前进程名
```

### Windows WinDbg kd

```text
# 设置 (VM)
bcdedit /debug on
bcdedit /dbgsettings net hostip:<host_ip> port:50000 key:<auto_generated>

# 或 serial (VirtualBox / VMware)
bcdedit /dbgsettings serial debugport:1 baudrate:115200

# WinDbg 连接
File → Kernel Debug → Net → Port 50000, Key ...

# 关键命令
!analyze -v                               # BSOD 自动分析
!process 0 0                              # 进程列表
dt nt!_EPROCESS @$proc                    # 偏移
!object \Device                           # 设备对象
!drvobj \Driver\MyDriver 2                # MajorFunction 表
!irpfind                                  # 查找 pending IRP
!pool <addr>                              # 池信息
!poolused 2                               # 池分配统计

# 驱动逆向
bp MyDriver!DriverEntry                   # 断驱动入口
bp MyDriver!DeviceIoControl               # 断 IOCTL handler
.reload /f MyDriver.sys                   # 强制加载符号
x MyDriver!*                              # 列出所有符号
dt MyDriver!_DEVICE_EXTENSION <addr>      # 自定义扩展

# 内核对象操作
!handle 0 f <pid>                         # 进程句柄表
!token <addr>                             # 安全令牌
!sd <addr>                                # 安全描述符
!acl <addr>                               # ACL
```

### macOS lldb + KDK

```bash
# 准备
# 1. 下载 KDK: developer.apple.com/download → Kernel Debug Kit
# 2. 安装后得到 /Library/Developer/KDKs/KDK_<version>.kdk/
# 3. 目标机 (VM / 物理机通过 USB-C debug probe):
sudo nvram boot-args="debug=0x44 kdp_match_name=en0 -v kcsuffix=development"
sudo kextcache -invalidate /

# 触发 NMI
# VM: 菜单 → Send NMI
# 物理: Cmd+Opt+Ctrl+Shift+Esc

# lldb 连接
xcrun lldb /Library/Developer/KDKs/KDK_*.kdk/System/Library/Kernels/kernel.development
(lldb) kdp-remote <target_ip>
(lldb) showallprocs
(lldb) showalltasks
(lldb) showallvnodes
(lldb) showregistry                       # IOKit registry
(lldb) zprint                             # zone allocator 统计
(lldb) paniclog                           # 最近 panic
```

---

## 内核模块 / 驱动逆向

### Linux .ko 逆向

```bash
# 基本信息
modinfo target.ko                          # 版本 / 依赖 / 参数 / 签名
file target.ko                             # ELF relocatable

# 符号
readelf -s target.ko | grep -E 'FUNC|OBJECT'
nm target.ko

# 反编译 (Ghidra)
# File → Import → target.ko (ELF)
# 搜索: init_module / cleanup_module
# 搜索: register_chrdev / misc_register / file_operations 结构体
# 搜索: ioctl / read / write / mmap handler
# 搜索: copy_from_user / copy_to_user (数据边界)
# 搜索: kmalloc / kfree / vmalloc / kzalloc (内存分配)

# 关注漏洞模式
# 1. copy_from_user 后 size 未校验 → OOB
# 2. ioctl cmd 没有 default case → 缺失输入验证
# 3. kmalloc(user_size) → 整数溢出
# 4. 全局变量无锁 → race condition
# 5. use-after-free: kfree 后仍有指针引用
# 6. 信息泄漏: copy_to_user 未初始化的栈变量 → leak kernel addr

# IDA + Linux struct 导入
# 用 ida-kern-tools 或手动导入 vmlinux DWARF
# 导入后 F5 反编译质量大幅提升
```

### Windows .sys 逆向

```python
# IDA 加载 .sys
# 自动识别 DriverEntry(PDRIVER_OBJECT, PUNICODE_STRING)
# 找 MajorFunction 赋值:
#   DriverObject->MajorFunction[IRP_MJ_DEVICE_CONTROL] = DispatchIoctl;

# IOCTL 派发 (典型模式)
# switch (IoControlCode) {
#   case IOCTL_XXX:
#     inBuf = Irp->AssociatedIrp.SystemBuffer;
#     inLen = IrpSp->Parameters.DeviceIoControl.InputBufferLength;
#     outLen = IrpSp->Parameters.DeviceIoControl.OutputBufferLength;
#     ...
# }

# IOCTL code 解码 (CTL_CODE macro)
# DeviceType [31:16] | Access [15:14] | Function [13:2] | Method [1:0]
# Method: 0=BUFFERED 1=IN_DIRECT 2=OUT_DIRECT 3=NEITHER

# IDA Python 解码
def decode_ioctl(code):
    device = (code >> 16) & 0xFFFF
    access = (code >> 14) & 0x3
    func   = (code >> 2)  & 0xFFF
    method = code & 0x3
    methods = ['BUFFERED','IN_DIRECT','OUT_DIRECT','NEITHER']
    print(f"Device=0x{device:04X} Function=0x{func:03X} "
          f"Access={access} Method={methods[method]}")

# 漏洞模式
# 1. METHOD_NEITHER: 用户直接传内核指针 → 任意读写
# 2. InputBufferLength 未校验 → 堆溢出
# 3. ProbeForRead/Write 缺失 → ring3 传 ring0 地址
# 4. MmMapIoSpace 映射物理内存 → BYOVD primitive
# 5. ZwCreateFile / ZwWriteFile → 任意文件写
```

### macOS .kext / IOKit 逆向

```bash
# kext 信息
kextstat | grep -v apple                   # 列出第三方 kext
kextutil -nt target.kext                   # 验证 + 符号

# 反编译
# IOUserClient::externalMethod 是关键入口
# 找 IOExternalMethodDispatch 数组:
#   { &handler_func, checkScalarInputCount, checkStructInputSize,
#     checkScalarOutputCount, checkStructOutputSize }

# IOKit 通信 (用户态)
io_connect_t conn;
IOServiceOpen(service, mach_task_self(), 0, &conn);
IOConnectCallMethod(conn, selector, scalarInput, scalarInputCnt,
                    structInput, structInputSize,
                    scalarOutput, &scalarOutputCnt,
                    structOutput, &structOutputSize);

# macOS kext 常见漏洞
# 1. externalMethod bounds check 缺失 → OOB dispatch
# 2. structInput size 未校验 → 堆溢出
# 3. race: 两个 IOConnectCallMethod 并发 → UAF
# 4. 信息泄漏: 输出结构体含未初始化内核指针
# 5. Mach port 引用计数错误 → UAF
```

---

## Kernel Panic / Crash 分析

### Linux KASAN / KMSAN / KCSAN

```text
KASAN (Kernel Address Sanitizer)
  检测: OOB / UAF / double-free / stack-out-of-bounds
  日志格式:
    BUG: KASAN: slab-out-of-bounds in <function>+0xXX/0xYY
    Read of size N at addr ffff... by task <name>/<pid>
    ...
    Allocated by task <name>/<pid>:
      <stack trace>
    Freed by task <name>/<pid>:        # (如果是 UAF)
      <stack trace>

  解读:
    1. "slab-out-of-bounds" → 堆越界
    2. "slab-use-after-free" → UAF
    3. "stack-out-of-bounds" → 栈越界
    4. "global-out-of-bounds" → 全局变量越界
    5. 看 Allocated 和 Freed 栈回溯，定位分配和释放路径

KMSAN (Kernel Memory Sanitizer)
  检测: 使用未初始化内存
  日志:
    BUG: KMSAN: uninit-value in <function>
    Uninit was stored to memory at:
      <stack trace>
    Uninit was created at:
      <stack trace>

KCSAN (Kernel Concurrency Sanitizer)
  检测: data race
  日志:
    BUG: KCSAN: data-race in <func1> / <func2>
    write to 0xffff... of N bytes by task ... on cpu ...
      <stack trace>
    read to 0xffff... of N bytes by task ... on cpu ...
      <stack trace>
```

### Linux crash dump 分析

```bash
# kdump 配置
# /etc/default/grub: GRUB_CMDLINE_LINUX="crashkernel=256M"
# systemctl enable kdump

# 分析
crash vmlinux /var/crash/<timestamp>/vmcore
crash> bt                                 # 当前线程 backtrace
crash> bt -a                              # 所有 CPU backtrace
crash> log                                # dmesg
crash> ps                                 # 进程列表
crash> files <pid>                        # 打开的文件
crash> vm <pid>                           # 内存映射
crash> kmem -s                            # slab 统计
crash> rd <addr> <count>                  # 读内存
crash> struct task_struct <addr>          # 任意结构体
crash> dis <func>                         # 反汇编
crash> mod                                # 已加载模块

# 快速定位
crash> bt -l                              # 带行号
crash> sym <addr>                         # 地址 → 符号
crash> whatis <symbol>                    # 类型
```

### Windows BSOD dump 分析

```text
WinDbg:
  File → Open Crash Dump → MEMORY.DMP / minidump

  !analyze -v                             # 自动分析 (最先跑)
    → BugCheck code
    → Faulting module
    → Stack trace
    → 可能原因

  常见 BugCheck:
    0x0A  IRQL_NOT_LESS_OR_EQUAL          # 高 IRQL 访问分页内存
    0x50  PAGE_FAULT_IN_NONPAGED_AREA     # 访问无效内核地址
    0x7E  SYSTEM_THREAD_EXCEPTION_NOT_HANDLED
    0x7F  UNEXPECTED_KERNEL_MODE_TRAP     # double fault / stack overflow
    0xC5  DRIVER_CORRUPTED_EXPOOL         # 池损坏
    0xD1  DRIVER_IRQL_NOT_LESS_OR_EQUAL   # 驱动高 IRQL 访问
    0x109 CRITICAL_STRUCTURE_CORRUPTION   # PatchGuard 触发
    0x133 DPC_WATCHDOG_VIOLATION          # DPC 超时
    0x139 KERNEL_SECURITY_CHECK_FAILURE   # GS cookie / CFG / 安全检查
    0x1A  MEMORY_MANAGEMENT               # 内存管理器错误
```

---

## 内核 Hook 点 (攻防视角)

```text
Linux Hook 点:
  syscall table:     sys_call_table[] → 可被 rootkit 替换
  kprobes/kretprobes: 动态插桩 (合法用途: tracing)
  ftrace:            function tracer → 可被 hijack
  LSM hooks:         security_* 函数指针
  Netfilter hooks:   NF_INET_PRE_ROUTING / LOCAL_IN / FORWARD / LOCAL_OUT / POST_ROUTING
  VFS:               file_operations / inode_operations 替换
  module notifier:   模块加载通知
  interrupt:         IDT (Interrupt Descriptor Table)
  eBPF:              attach to kprobe / tracepoint / XDP / cgroup (合法 + 恶意皆可)

检测:
  # 检查 syscall table 完整性
  cat /proc/kallsyms | grep sys_call_table
  # eBPF + bpftool
  bpftool prog list
  bpftool map list
  # 模块完整性
  cat /proc/modules
  # ftrace
  cat /sys/kernel/debug/tracing/enabled_functions

Windows Hook 点:
  SSDT (System Service Descriptor Table):
    KeServiceDescriptorTable → KiServiceTable
    PatchGuard 监控 → 直接 hook 会 BSOD

  IDT (Interrupt Descriptor Table):
    PatchGuard 监控

  IRP Hook:
    替换 DriverObject->MajorFunction[]
    Filter Driver (合法: minifilter)

  Object Callbacks:
    ObRegisterCallbacks → 进程/线程操作回调 (合法: AV)
    PsSetCreateProcessNotifyRoutineEx → 进程创建通知

  DKOM (Direct Kernel Object Manipulation):
    ActiveProcessLinks 断链 → 隐藏进程
    PatchGuard 不直接监控，但 ETW 可检测

  Callback 注册 (合法 API → rootkit 也用):
    CmRegisterCallbackEx → 注册表
    FltRegisterFilter → 文件系统 minifilter
    PsSetLoadImageNotifyRoutine → 模块加载

macOS Hook 点:
  Mach trap table:   mach_trap_table
  BSD syscall table: sysent[]
  kauth:             kauth_listen_scope (文件 / vnode / process)
  IOKit:             IOServiceMatching → kext 注入
  EndpointSecurity:  es_new_client → 合法安全框架 (10.15+)
  MACF (MAC Framework): mac_policy_register → TCC / sandbox
```

---

## Rootkit 分析方法论

```text
分析步骤:
  1. 获取内存 dump (LiME / DumpIt / osxpmem / winpmem)
  2. Volatility 3 分析:
     vol -f dump.raw linux.pslist         # 进程
     vol -f dump.raw linux.lsmod          # 内核模块
     vol -f dump.raw linux.check_syscall  # syscall table 对比
     vol -f dump.raw linux.check_idt      # IDT 检查
     vol -f dump.raw linux.hidden_modules # 隐藏模块
     vol -f dump.raw linux.tty_check      # TTY hook
     vol -f dump.raw linux.check_afinfo   # netfilter hook
     vol -f dump.raw linux.malfind        # 恶意代码注入

     # Windows
     vol -f dump.raw windows.pslist
     vol -f dump.raw windows.psscan       # 对比 pslist 找隐藏进程
     vol -f dump.raw windows.callbacks    # 内核回调
     vol -f dump.raw windows.ssdt         # SSDT hook
     vol -f dump.raw windows.driverirp    # IRP hook
     vol -f dump.raw windows.modules
     vol -f dump.raw windows.modscan      # 隐藏模块
     vol -f dump.raw windows.malfind

  3. 对比分析:
     - pslist vs psscan → 隐藏进程
     - lsmod vs modules 目录 → 隐藏模块
     - syscall table vs vmlinux 原始值 → hook 检测
     - SSDT 当前值 vs ntoskrnl.exe 原始值 → hook 检测

  4. 提取 + 逆向:
     - vol extract 可疑模块二进制
     - Ghidra / IDA 反编译
     - 看 init_module 做了什么 hook
     - 看 file_operations / ioctl 后门
```

---

## 内核 Fuzz (syzkaller / kAFL)

### syzkaller

```bash
# 安装
go install github.com/google/syzkaller/...@latest

# 准备内核 (启用 debug + coverage + sanitizer)
cat >> .config <<'EOF'
CONFIG_KCOV=y
CONFIG_KCOV_INSTRUMENT_ALL=y
CONFIG_KASAN=y
CONFIG_KASAN_INLINE=y
CONFIG_DEBUG_INFO=y
CONFIG_DEBUG_INFO_DWARF4=y
CONFIG_CONFIGFS_FS=y
CONFIG_SECURITYFS=y
EOF
make olddefconfig
make -j$(nproc)

# 准备 image
# create-image.sh (来自 syzkaller/tools)
./create-image.sh                          # 得到 stretch.img + stretch.id_rsa

# syz-manager 配置
cat > my.cfg <<'JSON'
{
    "target": "linux/amd64",
    "http": "127.0.0.1:56741",
    "workdir": "/tmp/syzkaller-workdir",
    "kernel_obj": "/path/to/linux",
    "image": "/path/to/stretch.img",
    "sshkey": "/path/to/stretch.id_rsa",
    "syzkaller": "/path/to/gopath/src/github.com/google/syzkaller",
    "procs": 8,
    "type": "qemu",
    "vm": {
        "count": 4,
        "kernel": "/path/to/bzImage",
        "cpu": 2,
        "mem": 2048
    }
}
JSON

syz-manager -config=my.cfg

# 处理 crash
# workdir/crashes/<hash>/
#   repro.prog     ← syzkaller 程序 (syscall 序列)
#   repro.cprog    ← C reproducer (最有用)
#   repro.report   ← kernel log
#   log*           ← 完整日志

# 最小化 reproducer
syz-repro -config=my.cfg workdir/crashes/<hash>

# C reproducer → 验证
gcc -o repro repro.cprog -lpthread -static
# 在 QEMU 内执行验证
```

### kAFL (基于 Intel PT)

```bash
# kAFL: kernel-level AFL using Intel PT hardware tracing
# https://github.com/IntelLabs/kAFL

pip install kafl-fuzzer
kafl fuzz \
    --kernel bzImage \
    --initrd rootfs.cpio.gz \
    --agent agent.bin \
    --work-dir /tmp/kafl-workdir \
    --seed-dir seeds/ \
    -p 4                                   # 4 parallel VMs
```

---

## 符号还原

```bash
# Linux vmlinux
# 1. 从发行版包提取
apt download linux-image-$(uname -r)-dbg   # Debian/Ubuntu
rpm -ivh kernel-debuginfo-*.rpm             # RHEL/Fedora
# 2. /usr/lib/debug/boot/vmlinux-*
# 3. /proc/kallsyms (root, 需要 kptr_restrict=0)
cat /proc/kallsyms | head

# 压缩 vmlinuz → vmlinux
./scripts/extract-vmlinux /boot/vmlinuz-* > vmlinux
# 或 vmlinux-to-elf (自动)
pip install vmlinux-to-elf
vmlinux-to-elf bzImage vmlinux.elf

# Windows ntoskrnl
# Microsoft Symbol Server
_NT_SYMBOL_PATH=srv*C:\Symbols*https://msdl.microsoft.com/download/symbols
symchk /r C:\Windows\System32\ntoskrnl.exe /s SRV*C:\Symbols*https://msdl.microsoft.com/download/symbols

# macOS
# KDK 包含带符号的 kernel + kext
# /Library/Developer/KDKs/KDK_<version>.kdk/
```

---

## 实战入口

- **Linux Kernel Exploitation** — 搜 "kernel pwn ctf writeup" / "linux kernel exploit tutorial"。
- **Windows Internals 7th Ed (Yosifovich / Russinovich)** — EPROCESS / IRP / 内核对象权威。
- **macOS Internals (Jonathan Levin)** — XNU / IOKit / PAC。
- **syzkaller dashboard** — syzbot.appspot.com — 已知内核 bug 持续更新。
- **Project Zero blog** — 内核 0-day 深度分析。
- **j00ru / Alex Ionescu / @i41nbeer / Brandon Azad** — 顶级内核研究者。
- **CTF 练习** — pwn.college kernel module / hxp kernel / HITCON kernel。
- **BYOVD 研究** — loldrivers.io — 已知漏洞驱动列表。
- **Volatility / Rekall** — 内存取证 + rootkit 分析。
- **LiME / AVML / DumpIt / winpmem / osxpmem** — 内存采集工具。

## 自检（接到目标 30 分钟内回答）

1. 目标是什么操作系统内核？(Linux / Windows / macOS / RTOS / Hypervisor)
2. 有内核源码还是只有二进制？有调试符号吗？
3. 调试环境就绪？(QEMU+gdb / WinDbg kd / lldb+KDK / JTAG)
4. 目标模块的通信接口？(ioctl / read / write / mmap / Mach port / IRP)
5. 安全机制？(KASLR / SMEP / SMAP / CFI / PatchGuard / VBS / PAC / PPL)
6. 用什么 sanitizer？(KASAN / KMSAN / KCSAN / HWASan)
7. Fuzzer 选型？(syzkaller / kAFL / 手动 harness)
8. Rootkit 指标？(隐藏进程 / hook / 异常模块)
9. 报告交付格式？(crash report / 漏洞报告 / 检测规则)
10. 相邻技能联动？(vulnrev / fuzzrev / crashrev / rktrev / hvrev)

## 相邻技能

- `vulnrev` — 漏洞研究方法论 + 可达性证明。
- `fuzzrev` — 内核 fuzz 细节 (syzkaller / kAFL)。
- `crashrev` — crash dump 深度分析。
- `linuxrev` — Linux 用户态逆向（与内核态衔接）。
- `winrev` — Windows 用户态逆向（与内核态衔接）。
- `macrev` — macOS 用户态逆向（与内核态衔接）。
- `rktrev` — Rootkit / Bootkit 专项深度分析。
- `hvrev` — Hypervisor / VMM 逆向 (VT-x / AMD-V / Hyper-V)。
- `diffrev` — 补丁差分（内核补丁 1-day）。
- `debugrev` — 通用调试方法论。