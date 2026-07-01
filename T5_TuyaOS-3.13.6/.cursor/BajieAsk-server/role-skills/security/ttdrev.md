---
name: time-travel-debugging-reverse-engineering
description: 时间旅行调试。WinDbg TTD 录制回放；rr (record & replay)；QIRA；TTD trace 查询；回溯数据流；与 taint analysis 结合。配合 debugrev / crashrev / vulnrev 用。
---

# Time Travel Debugging 逆向

## 适用场景
- 用 WinDbg TTD 录制并回放程序执行。
- 用 rr 录制 Linux 程序用于回溯分析。
- 从 crash 点反向追踪到 root cause。
- TTD trace 上做数据流查询。
- 难以复现的 bug / 竞态条件分析。

## 不适用
- 常规调试 → `debugrev`。
- 崩溃分析 (无录制) → `crashrev`。
- 符号执行 → `irrev`。

---

## WinDbg TTD

```text
TTD (Time Travel Debugging):
  - 录制程序完整执行 (指令级)
  - 可以前进和后退
  - 录制 → .run 文件 + .idx 索引
  - WinDbg Preview 内置

录制:
  方法 1: WinDbg → File → Launch executable (advanced) → ✓ Record
  方法 2: TTD.exe -launch <executable>  (命令行)
  方法 3: WinDbg → File → Attach to process → ✓ Record
  方法 4: TTDService.exe (远程录制)

限制:
  - 仅 Windows x64 / WoW64 (x86 on x64)
  - 用户态 (不录制内核)
  - 性能: 10-100x 慢
  - 文件大小: 数百 MB ~ 数 GB

回放:
  打开 .run 文件 → 自动加载 trace
  前进: g / p / t (正常调试命令)
  后退: g- / p- / t- (反向!)
  跳到位置: !tt <position>
  跳到开头: !tt 0
  跳到结尾: !tt 100
```

### TTD 数据查询 (dx)

```text
WinDbg dx 命令 = TTD 上的 LINQ 查询

// 所有 API 调用
dx @$cursession.TTD.Calls("kernel32!CreateFileW")
dx @$cursession.TTD.Calls("ntdll!NtAllocateVirtualMemory")

// 带过滤
dx @$cursession.TTD.Calls("kernel32!CreateFileW")
    .Where(c => c.Parameters[0].ToDisplayString().Contains("secret"))

// 内存访问
dx @$cursession.TTD.Memory(0x7ff`12340000, 0x7ff`12340100, "w")
// → 谁在何时写了这段内存

// 所有异常
dx @$cursession.TTD.Events.Where(e => e.Type == "Exception")

// 寄存器值在某个时间点
!tt <position>
r

// 线程
dx @$cursession.TTD.Threads

// 模块加载
dx @$cursession.TTD.Events.Where(e => e.Type == "ModuleLoaded")

// 综合: 找到写入特定地址的位置 → 跳过去 → 看上下文
dx @$cursession.TTD.Memory(<addr>, <addr>+4, "w").First().TimeStart
!tt <TimeStart>
kb    // 看调用栈 → root cause
```

### TTD 回溯分析模式

```text
典型工作流 (从 crash 回溯):
  1. 录制 crash 复现
  2. WinDbg 打开 trace → 自动停在 crash 点
  3. 查看: 哪个内存地址非法？
     0:000> !analyze -v
  4. 反向查询: 谁最后写了这个地址？
     dx @$cursession.TTD.Memory(<crash_addr>, <crash_addr>+8, "w").Last()
  5. 跳到该时间点:
     !tt <写入时间>
  6. 看调用栈: kb → 理解写入上下文
  7. 继续反向: 这个值从哪来？
  8. 重复直到找到 root cause
```

## rr (Record & Replay, Linux)

```bash
# 安装
# Ubuntu: sudo apt install rr
# 或从源码编译: https://github.com/rr-debugger/rr

# 录制
rr record ./program arg1 arg2
# 输出: ~/.local/share/rr/<program>-<N>/

# 回放
rr replay
# 进入 gdb-like 界面

# 反向执行
(rr) reverse-continue                      # 反向运行到上一个断点
(rr) reverse-step                          # 反向单步
(rr) reverse-next                          # 反向 next
(rr) reverse-finish                        # 反向到函数入口

# 典型工作流 (segfault 回溯):
(rr) run                                   # 运行到 crash
# → SIGSEGV at 0x...
(rr) watch -l *0x<crash_addr>              # 监控该地址
(rr) reverse-continue                      # 反向运行到最近的写入
# → 找到写入该地址的代码 → root cause

# Checkpoint
(rr) checkpoint                            # 保存当前位置
(rr) restart <N>                           # 恢复到 checkpoint

# 特点:
# - 确定性回放 (线程调度完全重现)
# - 对竞态条件极其有用
# - 低开销录制 (~1.2x)
# - 仅单线程录制性能好; 多线程录制串行化
```

## QIRA / Tenet

```text
QIRA (QEMU Interactive Runtime Analyser):
  - 基于 QEMU 的 trace 录制
  - 每条指令级状态记录
  - Web UI: 代码 + 寄存器 + 内存 实时联动
  - 适合 CTF / 小程序

  qira ./program
  # 浏览器: http://localhost:3002

Tenet (IDA plugin):
  - IDA 中加载 execution trace
  - 前进/后退浏览
  - 支持 Intel Pin trace
  - 类似 TTD 但在 IDA 中

  使用:
  # 1. Pin 录制
  pin -t tenet-tracer.so -- ./program
  # 2. IDA: Tenet → Load Trace
```

## 与 Taint Analysis 结合

```text
TTD/rr trace + taint analysis:
  1. 录制执行
  2. 标记输入为 taint source (文件/网络/用户输入)
  3. 前向传播: 追踪 taint 数据流
  4. 在 crash/vuln 点: 检查哪些数据受 taint 影响
  5. 回溯: taint 从哪条路径到达 sink

工具:
  - Triton + TTD: 符号执行 + trace
  - PANDA (QEMU): 录制 + taint
  - DynamoRIO + Dr.Memory: 内存 taint
```

## 实战入口
- **WinDbg TTD docs** — learn.microsoft.com。
- **rr project** — rr-project.org。
- **QIRA** — github.com/geohot/qira。
- **Tenet (IDA)** — github.com/gaasedelen/tenet。
- **0xFFFF TTD blog series** — 实战教程。

## 自检
1. 平台？(Windows → TTD / Linux → rr)
2. 可以录制吗？(性能/权限/大小)
3. 目标？(crash 回溯 / 数据流追踪 / 竞态)
4. 多线程？(rr 多线程串行化)
5. 需要 taint？

## 相邻技能
- `debugrev` — 常规调试。
- `crashrev` — 崩溃分析。
- `vulnrev` — 漏洞研究。
- `irrev` — 符号执行 / 数据流。