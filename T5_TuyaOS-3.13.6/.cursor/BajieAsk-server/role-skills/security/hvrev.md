---
name: hypervisor-vmm-reverse-engineering
description: Hypervisor / VMM 逆向。Intel VT-x / AMD-V / ARM VHE；VMCS / VMCB；VM Exit / Entry；EPT / NPT；Hyper-V / KVM / Xen / VMware 逆向；VBS / Secure Kernel / Credential Guard；VM escape 研究。配合 kernrev / winrev / bootrev 用。
---

# Hypervisor / VMM 逆向

## 适用场景
- 逆向 Hypervisor 实现 (KVM / Hyper-V / Xen / VMware / VirtualBox)。
- 分析 VM escape 漏洞。
- 理解 VBS / Secure Kernel / Credential Guard。
- 检测 hypervisor-based rootkit (Blue Pill / SubVirt)。
- 硬件辅助虚拟化机制分析。

## 不适用
- VM 管理 / 部署 → devops。
- 非虚拟化内核逆向 → `kernrev`。
- UEFI/Bootloader → `bootrev`。

---

## 硬件虚拟化基础

```text
Intel VT-x:
  VMX root mode    = Hypervisor (Ring -1)
  VMX non-root mode = Guest (Ring 0-3)

  关键指令:
    VMXON           进入 VMX 模式
    VMXOFF          退出 VMX 模式
    VMLAUNCH        首次进入 Guest
    VMRESUME        恢复 Guest 执行
    VMREAD/VMWRITE  读写 VMCS
    VMCALL          Guest → Host (hypercall)
    INVEPT/INVVPID  TLB 刷新

  VMCS (Virtual Machine Control Structure):
    Guest-state area:     Guest 寄存器 / MSR / 段 / CR
    Host-state area:      Host 寄存器 / 返回点
    VM-execution control: 控制哪些操作触发 VM Exit
    VM-exit control:      Exit 行为配置
    VM-entry control:     Entry 行为配置
    VM-exit information:  Exit 原因 + 详情

AMD-V (SVM):
  VMRUN           进入 Guest
  VMSAVE/VMLOAD   保存/恢复 Guest 状态
  VMCB (Virtual Machine Control Block) = AMD 版 VMCS
  嵌套分页表 (NPT) = AMD 版 EPT

ARM:
  VHE (Virtualization Host Extensions, ARMv8.1):
    EL2 (hypervisor) 可直接运行 host kernel
    Stage-2 page table = ARM 版 EPT/NPT
```

## EPT / NPT (二级地址翻译)

```text
Guest Virtual → Guest Physical → Host Physical
              (Guest page table)  (EPT/NPT)

EPT 结构 (Intel):
  4 级页表: PML4 → PDPT → PD → PT → Physical Page
  每个 entry: PA + R/W/X 权限 + Memory Type

EPT 攻击面:
  - EPT violation → VM Exit → Hypervisor 处理
  - 恶意 Guest 通过 EPT miss 触发大量 VM Exit (DoS)
  - EPT 配置错误 → Guest 读写 Host 内存 (VM escape)

逆向时:
  - 找 EPT 初始化代码 (设置 EPTP)
  - 分析 EPT violation handler
  - 检查 EPT 权限设置 (R/W/X)
```

## VM Exit 处理

```text
常见 VM Exit 原因:
  0  Exception (NMI / #PF / #GP)
  1  External interrupt
  7  Interrupt window
  10 CPUID
  12 HLT
  18 VMCALL (hypercall)
  28 CR access
  30 I/O instruction
  31 RDMSR
  32 WRMSR
  48 EPT violation
  49 EPT misconfiguration
  52 VMX preemption timer

逆向 VM Exit handler:
  1. 找到 VMLAUNCH/VMRESUME 调用点
  2. Exit 后跳转到 Host RIP (VMCS host-state)
  3. 读取 VM Exit reason: VMREAD(0x4402)
  4. switch/if-else 分发到具体 handler
  5. 每个 handler 处理后 VMRESUME 返回 Guest
```

## Hyper-V 逆向

```text
核心组件:
  hvix64.exe / hvax64.exe   — Hypervisor 二进制 (Intel/AMD)
  seckernel.exe             — Secure Kernel (VBS)
  hvloader.efi              — Hypervisor 加载器

VBS (Virtualization-Based Security):
  └── Secure Kernel (VTL1)
      ├── Credential Guard (lsaiso.exe)
      ├── HVCI (Hypervisor-protected Code Integrity)
      ├── System Guard Runtime Monitor
      └── Secure Enclave
  └── Normal Kernel (VTL0)
      └── ntoskrnl.exe + drivers

VTL (Virtual Trust Level):
  VTL0: 普通 OS (ntoskrnl)
  VTL1: Secure Kernel (seckernel.exe)
  Hypervisor 隔离 VTL0 和 VTL1 的内存

逆向:
  - hvix64.exe: 在 C:\Windows\System32 (需要内核调试获取)
  - Ghidra / IDA 加载为 PE64
  - 搜索 VMREAD/VMWRITE 指令定位 VMCS 操作
  - Hypercall 接口: HvCallXxx 系列
  - seckernel.exe: Secure Kernel 系统调用分析
```

## KVM 逆向

```text
KVM = Linux 内核模块 (kvm.ko + kvm-intel.ko / kvm-amd.ko)

源码可读 (开源):
  arch/x86/kvm/vmx/vmx.c     — Intel VT-x
  arch/x86/kvm/svm/svm.c     — AMD-V
  arch/x86/kvm/x86.c         — 通用
  virt/kvm/kvm_main.c        — 核心

关键函数:
  vmx_vcpu_run()             — 进入 Guest
  vmx_handle_exit()          — VM Exit 处理
  kvm_emulate_cpuid()        — CPUID 模拟
  handle_ept_violation()     — EPT 违规处理
  kvm_mmu_page_fault()       — MMU 故障

ioctl 接口 (/dev/kvm):
  KVM_CREATE_VM / KVM_CREATE_VCPU / KVM_RUN
  KVM_SET_REGS / KVM_GET_REGS
  KVM_SET_CPUID2 / KVM_SET_MSRS

安全研究:
  - QEMU + KVM: 设备模拟代码是主要攻击面
  - virtio 设备: 共享内存 + ring buffer
  - VM escape: QEMU 设备处理漏洞 → Host 代码执行
```

## VMware / VirtualBox

```text
VMware:
  vmx (进程) → vmmon.ko/vmmon.sys (内核模块) → VT-x/AMD-V
  vmware-vmx: 用户态 VM 进程
  vmnet: 网络虚拟化
  攻击面: 虚拟设备 (USB / 显卡 / SCSI / 网卡)
  Pwn2Own 历史: 多次 VM escape

VirtualBox:
  VBoxDD.dll/so: 虚拟设备实现
  VBoxVMM: VMM 核心
  开源 (OSE): 可审计
  3D 加速 / 共享文件夹 / 剪贴板: 高风险攻击面
```

## VM Escape 方法论

```text
攻击面:
  1. 虚拟设备 (最常见):
     - 网卡 (e1000 / virtio-net)
     - USB (xHCI / EHCI)
     - 显卡 (QXL / virtio-gpu / SVGA)
     - 存储 (IDE / AHCI / virtio-blk / SCSI)
     - 串口 / 并口
     - 声卡 (AC97 / HDA)

  2. Hypercall 接口:
     - VMCALL / VMMCALL 参数处理
     - 信息泄漏 / 越界访问

  3. 共享内存:
     - virtio ring / vhost
     - 共享文件夹
     - 剪贴板

  4. 中断/异常处理:
     - 嵌套异常
     - 虚拟 APIC

研究工具:
  - 源码审计 (QEMU / VirtualBox OSE / KVM)
  - Fuzzing: 自定义 virtio fuzzer / kAFL
  - 调试: 宿主 GDB attach 到 QEMU 进程
```

## 实战入口
- **Intel SDM Vol. 3C** — VT-x 规范。
- **AMD APM Vol. 2** — AMD-V 规范。
- **KVM source** — 开源 Hypervisor。
- **Microsoft Hyper-V internals (Alex Ionescu / Andrea Allievi)**。
- **Pwn2Own VM escape writeups**。
- **virtio specification** — OASIS。

## 自检
1. 目标 Hypervisor？(KVM / Hyper-V / VMware / Xen / VirtualBox)
2. CPU 虚拟化？(VT-x / AMD-V / ARM VHE)
3. 攻击面？(虚拟设备 / hypercall / 共享内存)
4. VBS / VTL？
5. 源码可用？(KVM / VirtualBox OSE)
6. 嵌套虚拟化？

## 相邻技能
- `kernrev` — 内核逆向基础。
- `winrev` — Windows 平台 (Hyper-V/VBS)。
- `bootrev` — UEFI + Hypervisor 加载链。
- `rktrev` — Hypervisor rootkit。