---
name: go-binary-reverse-engineering
description: Go 编译产物逆向工程。stripped Go binary 符号还原（GoReSym / redress / go_parser）；goroutine / channel / interface 内部结构；Go runtime 数据结构（g / m / p / sudog / hmap / slice / string）；Go 函数调用约定（寄存器 ABI Go 1.17+）；Go 反编译（Ghidra + go_parser / IDA）；CGO 桥接分析。配合 binrev / cloudrev / malrev 用。
---

# Go 二进制逆向

## 适用场景
- 反编译 stripped Go binary 还原函数名与逻辑。
- 分析 Go 编写的恶意软件 / C2 / 后门 (Cobalt Strike / Sliver / Merlin)。
- 逆向 Go 编写的云原生工具 / Agent / CLI 应用。
- 理解 Go runtime (goroutine / GC / scheduler / channel)。
- 从 Go binary 提取嵌入资源 / 配置 / 证书。

## 不适用
- Go 源码开发。
- 通用 ELF/PE 逆向基础 → `binrev`。

---

## Go 编译特征

```text
识别 Go binary:
  strings <bin> | grep -E 'runtime\.gopanic|runtime\.goexit|go\.buildid'
  file <bin>                               # Go 通常静态链接, 体积大
  readelf -p .go.buildinfo <bin>           # Go 1.18+ buildinfo section
  GoReSym <bin>                            # 直接解析

特征:
  - 静态链接 (通常 5-30 MB 即使简单程序)
  - 大量 runtime.* 函数
  - 字符串不以 NULL 结尾 (Go string = {ptr, len})
  - 函数名极长: main.(*Server).handleRequest
  - 即使 stripped, 仍保留 pclntab (Go < 1.20)
```

## 符号还原

```bash
# GoReSym (Mandiant, 最推荐)
# https://github.com/mandiant/GoReSym
GoReSym -t -d -p <binary>
# -t: 输出类型信息
# -d: 输出标准库也列出
# -p: 输出 pclntab 信息
# 输出 JSON: 函数名 + 文件路径 + 行号 + 类型

# redress (Go Reverse Engineering)
# https://github.com/goretk/redress
redress -src <binary>                      # 源码布局
redress -pkg <binary>                      # 包列表
redress -type <binary>                     # 类型信息
redress -interface <binary>                # 接口信息
redress -string <binary>                   # 字符串

# IDA go_parser
# https://github.com/praydog/IDAGolangHelper 或 AlphaGolang
# IDA → File → Script → go_parser.py
# 自动重命名函数 + 标注类型

# Ghidra
# https://github.com/getCUJO/ThreatFox/tree/main/tools/ghidra_scripts
# 或 GolangAnalyzerExtension
# 自动解析 pclntab → 还原函数名

# go-unstrip (重建符号表)
# go tool objdump <binary>                # Go 自带反汇编 (需要未 strip)
```

## Go Runtime 数据结构

```text
goroutine (runtime.g):
  stack:     lo, hi          // 栈边界
  stackguard0               // 栈增长检查点
  goid:      int64           // goroutine ID
  status:    uint32          // _Grunning / _Gwaiting / _Gsyscall / ...
  sched:     gobuf           // sp, pc, g, ctxt, ret, lr, bp
  gopc:      uintptr         // 创建此 goroutine 的 go 语句 PC

调度器:
  runtime.m  → OS 线程
  runtime.p  → 逻辑处理器 (GOMAXPROCS)
  g ↔ m ↔ p  调度三角

string (StringHeader):
  Data: *byte               // 指向 UTF-8 字节
  Len:  int                 // 长度 (非 NULL 终止!)

slice (SliceHeader):
  Data: *T
  Len:  int
  Cap:  int

map (runtime.hmap):
  count:     int
  B:         uint8           // log2(bucket 数)
  buckets:   *bmap           // 桶数组
  oldbuckets: *bmap          // 扩容时的旧桶

interface:
  空接口 (interface{}): {type *_type, data unsafe.Pointer}
  非空接口: {tab *itab, data unsafe.Pointer}
  itab: {inter *interfacetype, _type *_type, hash uint32, fun [1]uintptr}

channel (runtime.hchan):
  qcount:    uint
  dataqsiz:  uint           // 环形缓冲区大小
  buf:       unsafe.Pointer
  closed:    uint32
  sendq/recvq: waitq        // 等待队列 (sudog 链表)
```

## 调用约定

```text
Go 1.17 之前 (栈传参):
  所有参数和返回值都在栈上
  caller 分配空间, callee 使用
  没有 callee-saved 寄存器 (全部 caller-saved)

Go 1.17+ (寄存器 ABI, amd64):
  整数参数: RAX RBX RCX RDI RSI R8 R9 R10 R11
  浮点: X0..X14
  返回值: 同寄存器
  栈参数: 溢出到栈
  特殊:
    R14 = 当前 goroutine (g)
    R15 = GOT 基址 (PIE)
    BP  = frame pointer (Go 1.7+)

  识别: 看函数开头是否有 MOVQ g(R14), ... 或 CMPQ SP, stackguard

栈增长检查 (几乎每个函数开头):
  CMPQ SP, 16(R14)          // SP vs g.stackguard0
  JLS  morestack            // 如果栈不够 → 调用 runtime.morestack
```

## 反编译技巧

```text
Ghidra:
  1. 安装 GolangAnalyzerExtension
  2. 导入后运行分析
  3. 自动还原函数名 + pclntab
  4. 注意: Go 字符串是 {ptr, len}, 不是 char*
     Ghidra 可能误判 → 手动创建 GoString 结构体

IDA:
  1. 加载 go_parser.py / AlphaGolang
  2. 自动重命名 + 类型标注
  3. F5 反编译质量取决于 ABI 识别

Binary Ninja:
  1. golang-analyzer plugin
  2. 自动 pclntab 解析

通用技巧:
  - Go 字符串在 .rodata, 不以 NULL 结尾
  - 从 buildinfo 提取 Go 版本 + module path
  - 从 pclntab 提取函数名 + 源文件路径
  - interface 调用 = 间接调用, 看 itab.fun[offset]
  - goroutine 创建: runtime.newproc(fn, args)
  - 错误处理: 返回值第二个通常是 error interface
```

## Go 恶意软件

```text
Go 恶意软件趋势:
  - 跨平台: 同源码编译 Linux/Windows/macOS
  - 大体积: 天然免杀 (静态特征库覆盖差)
  - 难分析: stripped + 大量 runtime 代码
  - 常见家族: Sliver C2 / Cobalt Strike (beacon) / BazarLoader /
              GoBruteforcer / Kaiji / Chaos / IPStorm / Glupteba

分析流程:
  1. GoReSym 还原符号
  2. 提取 buildinfo (Go 版本 / module)
  3. 搜索 C2 配置:
     strings | grep -E 'http|ws://|:443|:8080'
     搜索加密密钥: AES key / RSA / x509
  4. 识别 C2 框架 (Sliver 特征: sliverpb / mtls / wg)
  5. 网络行为: DNS / HTTP(S) / mTLS / WireGuard tunnel
```

## 实战入口
- **GoReSym (Mandiant)** — Go 符号还原首选。
- **redress (goretk)** — Go 二进制分析套件。
- **GolangAnalyzerExtension (Ghidra)** — Ghidra Go 分析。
- **AlphaGolang (IDA)** — IDA Go 分析。
- **Go Internals book** — Go runtime 深入。
- **Mandiant / SentinelOne Go malware blog** — 实战分析。

## 自检
1. Go 版本？(影响 ABI / pclntab 格式)
2. stripped？(pclntab 是否被删)
3. 静态链接？(通常是)
4. CGO？(有原生代码)
5. 恶意样本？(配合 malrev)
6. 目标平台？(Linux / Windows / macOS)
7. 嵌入资源？(go:embed / 配置)
8. C2 框架？(Sliver / Cobalt / 自研)

## 相邻技能
- `binrev` — 通用二进制逆向基础。
- `cloudrev` — Go 云 Agent 逆向。
- `malrev` — Go 恶意软件分析。
- `rustrev` — Rust 类比 (现代编译型语言)。
- `abirev` — Go ABI 细节。