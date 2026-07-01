---
name: ebpf-reverse-engineering
description: eBPF 逆向与安全分析。eBPF 字节码反汇编与反编译；verifier 限制与绕过；map / helper / kfunc；bpftool / llvm-objdump / Ghidra；恶意 eBPF 检测；eBPF rootkit；合法安全用途 (Falco / Tetragon)。配合 kernrev / linuxrev / edrrev 用。
---

# eBPF 程序逆向与安全分析

## 适用场景
- 逆向 eBPF 字节码程序。
- 检测恶意 eBPF 程序 (pamspy / boopkit / ebpfkit)。
- 分析 eBPF 安全工具 (Falco / Tetragon / Cilium)。
- 研究 eBPF verifier 限制与绕过漏洞。

## 不适用
- eBPF 开发 / tracing。
- 通用内核分析 → `kernrev`。

---

## eBPF 基础

```text
eBPF = 内核中的沙箱虚拟机
  - 11 个 64-bit 寄存器 (r0-r10)
  - r0: 返回值
  - r1-r5: 函数参数
  - r6-r9: callee-saved
  - r10: 栈帧指针 (只读)
  - 512 字节栈

程序类型:
  kprobe / kretprobe          — 内核函数 hook
  tracepoint                  — 静态跟踪点
  raw_tracepoint              — 原始跟踪点
  XDP                         — 网络数据面 (最快)
  TC (traffic control)        — 网络流量控制
  socket_filter               — 套接字过滤
  LSM                         — Linux Security Module hook
  cgroup/*                    — cgroup 级控制
  struct_ops                  — 内核结构体操作替换

Map 类型:
  BPF_MAP_TYPE_HASH / ARRAY / PERF_EVENT_ARRAY /
  RINGBUF / LRU_HASH / STACK_TRACE / ...
```

## 字节码分析

```bash
# bpftool (最重要的工具)
bpftool prog list                          # 列出已加载程序
bpftool prog dump xlated id <id>           # 反汇编 (翻译后)
bpftool prog dump jited id <id>            # JIT 后的原生代码
bpftool prog dump xlated id <id> visual > cfg.dot  # 控制流图

bpftool map list                           # 列出 map
bpftool map dump id <id>                   # dump map 内容

# llvm-objdump (从 .o 文件)
llvm-objdump -d program.bpf.o             # 反汇编 ELF 中的 eBPF

# readelf
readelf -S program.bpf.o                  # 查看 section (每个 section 可能是一个程序)
readelf -s program.bpf.o                  # 符号

# BTF (BPF Type Format)
bpftool btf dump file program.bpf.o       # 类型信息
bpftool btf dump id <id>                  # 内核 BTF
```

## eBPF 指令集

```text
ALU:
  BPF_ADD / BPF_SUB / BPF_MUL / BPF_DIV / BPF_MOD
  BPF_AND / BPF_OR / BPF_XOR / BPF_LSH / BPF_RSH / BPF_ARSH
  BPF_NEG / BPF_MOV

内存:
  BPF_LDX  加载 (从内存到寄存器)
  BPF_STX  存储 (从寄存器到内存)
  BPF_ST   存储立即数
  BPF_LD   特殊加载 (packet data / map)

跳转:
  BPF_JEQ / BPF_JNE / BPF_JGT / BPF_JGE / BPF_JLT / BPF_JLE
  BPF_JSGT / BPF_JSGE / BPF_JSLT / BPF_JSLE (有符号)
  BPF_JA   无条件跳转
  BPF_CALL 调用 helper / kfunc
  BPF_EXIT 返回

示例:
  r1 = *(u32 *)(r6 + 0)    # BPF_LDX_MEM(BPF_W, r1, r6, 0)
  if r1 == 0 goto +5       # BPF_JMP_IMM(BPF_JEQ, r1, 0, 5)
  call bpf_map_lookup_elem # BPF_CALL(BPF_FUNC_map_lookup_elem)
  r0 = 0                   # BPF_MOV64_IMM(r0, 0)
  exit                     # BPF_EXIT_INSN()
```

## 恶意 eBPF

```text
已知恶意 eBPF:
  pamspy:        hook pam_get_authtok → 窃取 SSH/sudo 密码
  boopkit:       eBPF rootkit (隐藏进程/文件/网络连接)
  ebpfkit:       eBPF 攻击框架 (网络劫持 / 进程隐藏 / 数据窃取)
  TripleCross:   eBPF rootkit (后门 + rootkit + library injection)
  BPFDoor:       实战中发现的 BPF 后门 (Red Menshen APT)

攻击能力:
  kprobe hook: 劫持内核函数 (读取/修改参数和返回值)
  XDP: 网络层数据窃取/修改
  tc: 流量重定向/隐藏
  LSM: 权限检查修改
  bpf_override_return: 修改系统调用返回值 (需要 CONFIG_BPF_KPROBE_OVERRIDE)

检测:
  bpftool prog list → 检查异常程序
  bpftool prog dump → 分析字节码行为
  /sys/kernel/debug/tracing/kprobe_events
  检查 CAP_BPF / CAP_SYS_ADMIN 权限

  安全工具:
  Tracee (Aqua): 检测恶意 eBPF 行为
  bpf-lsm: 限制 eBPF 程序加载
```

## Verifier 安全

```text
eBPF verifier 检查:
  - 无无界循环 (DAG 验证)
  - 无越界内存访问
  - 所有分支都有 exit
  - 寄存器类型追踪 (pointer / scalar / not-init)
  - 辅助函数参数类型检查

Verifier 绕过 (漏洞利用):
  CVE-2021-3490: ALU32 边界追踪错误 → 越界写
  CVE-2021-31440: 指针越界 → 内核读写
  CVE-2022-23222: 寄存器类型混淆 → 任意地址读写
  CVE-2023-2163: verifier 剪枝错误 → 任意读写

  模式:
  1. 构造特殊 eBPF 程序绕过 verifier 类型检查
  2. 获得一个"值域过宽"的寄存器
  3. 用该寄存器做越界内存访问
  4. → 内核任意读写 → 提权
```

## 实战入口
- **bpftool** — eBPF 分析核心工具。
- **Tracee (Aqua Security)** — 运行时检测。
- **ebpfkit / TripleCross source** — 学习攻击技术。
- **Brendan Gregg BPF Performance Tools**。
- **kernel.org eBPF docs**。

## 自检
1. 目标？(已加载程序 / .o 文件 / 恶意样本)
2. 程序类型？(kprobe / XDP / LSM / tc)
3. 有 BTF 信息？
4. verifier 绕过？
5. 检测还是分析？

## 相邻技能
- `kernrev` — 内核结构。
- `linuxrev` — Linux 生态。
- `edrrev` — eBPF 安全工具分析。
- `rktrev` — eBPF rootkit。