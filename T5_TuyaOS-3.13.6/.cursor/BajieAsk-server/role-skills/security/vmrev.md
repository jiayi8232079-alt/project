---
name: vm-bytecode-reverse-engineering
description: 虚拟机、字节码与自定义解释器逆向。识别 dispatch loop / opcode / handler table / VM state、还原 opcode 语义、构建反汇编器、对付 VMProtect / Themida / Code Virtualizer / OLLVM virtualization / 自家反爬 VM / WebAssembly / EVM / mruby / Lua / .NET IL / DEX 等字节码。
---

# 自实现 VM / 字节码逆向

## 适用场景

- 反编译看到一个庞大 switch / 大跳表 / 寄存器轮转的循环 + 一组短小 handler 函数 → 大概率自实现 VM。
- 拿到 VMProtect / Themida / Code Virtualizer 保护的 PE，要还原虚拟化的关键函数。
- 反爬 / 反挂 / DRM 把签名 / 风控逻辑编进自家 opcode（移动端 + Web + 桌面常见）。
- 标准字节码（.NET IL / DEX / WASM / EVM / mruby / Lua / Hermes / pyc）需要反汇编与还原。

## 不适用

- 反编译伪 C 还原 native 代码 → `binrev`。
- 单条机器指令语义 → `asmrev`。
- 加壳但不带 VM 的样本（UPX/MPRESS 等） → `packrev`。
- IR 与符号执行框架 → `irrev`（vmrev 用 IR 工具，但语义还原任务在这里）。

## 自家 VM 识别

### 典型外形

```text
1) 大 dispatch loop
   while (running) {
       opcode = bytecode[pc++];
       switch (opcode) {
           case 0x01: handler_01(); break;
           ...
           case 0xff: handler_ff(); break;
       }
   }

2) 或 handler 表 + 间接跳
   typedef void (*handler_t)(VMState*);
   static handler_t handlers[256] = { h_00, h_01, ..., h_ff };
   while (running) {
       opcode = *pc++;
       handlers[opcode](state);
   }

3) 或 token threading（更隐蔽）
   每个 handler 末尾自己跳到下一条 handler，不回 dispatcher
   handler_xx:
       ; ... 处理 ...
       movzx eax, byte [pc]
       inc pc
       jmp [handler_table + rax*8]
```

### 反汇编里的特征

```text
- 一个函数里寄存器轮转极其规律（通常 2-4 个寄存器扮演 vIP / vSP / vREG / vFLAGS）
- 出现一个 256/512/1024 字节的 jump table 或函数指针表（可能在 .data 或 .rodata）
- handler 函数普遍很短（10-50 字节），数量 50-300 之间
- 很多 handler 末尾都跳回同一个 dispatcher 标签 / 或都跳到下一条 handler
- VMProtect: 多达 1000+ handler，每个 handler 约 5-15 条指令，全靠 RIP-relative + xor 解密 vIP
- Themida: handler 散落在多个段，运行时解密一段 mov 一段
```

### 找 vIP / vSP / vREG / 字节码区

```text
1) 入口（VMEnter）：通常先 push 一组寄存器到自家栈 → 找 VMState 结构
2) VMState 结构常见字段:
       uint8_t *vip;          // 虚拟指令指针
       uint64_t vregs[N];     // 虚拟寄存器
       uint64_t vstack[M];    // 虚拟栈
       uint32_t vflags;
3) 字节码区:
       vIP 指向的内存通常在 .rodata / .data / .vmp* / 自家段
       打印起始地址附近 256 字节 → 看分布是不是 0..N 范围内的 byte（或 short/int 多字节 opcode）
4) handler 调度公式:
       handler = base + opcode * scale
       或: handler = decode_xor(opcode_raw, key) → table_lookup
```

## VMProtect / Themida / Code Virtualizer

### VMProtect

```text
- 多个版本 (1.x → 3.x)，每版 handler 表布局不同
- handler 间用 polymorphic mutation：插无意义指令 + 等价替换
- vIP 单字节 + 解码 key (per-VM 实例随机)
- 每条虚拟指令 ≈ 多个 handler 串接，模拟一条 native 指令
- 手段: 已知工具 VMPDump / VTIL / NoVmp / VMUnprotect
```

### Themida

```text
- mutation 更激进，加入大量 dead code 与 anti-patch
- 多 VM 引擎可选 (FISH / TIGER / DOLPHIN 等)，每个 VM 不同 opcode 集
- handler 解密在运行时：xor / sub / rol-rotate
- 工具: WinLicense Inspector / Themida Unpackers (老版本) / 手工 + Frida
```

### Code Virtualizer (Oreans)

```text
- 比 Themida 旧、目前 Themida 用的相同核心
- 类似手段
```

### 通用还原步骤

1. **定位 VM 入口/出口**：找一段 push 大量 reg + jmp 表的代码 = VMEnter；对应 pop 大量 reg + ret = VMExit。
2. **识别 dispatcher**：跑一遍样本，trace 出哪个块被反复跳到（频率最高）= dispatcher。
3. **抓字节码起点**：dispatcher 第一次取 vIP 的位置，观察 vIP 初始值 → 字节码区起点。
4. **handler 扫描**：dispatcher 跳到的所有目标 = handler 池。给每个 handler 编号。
5. **opcode 扫描**：依次让 vIP 指向 0..255，trace 每个 opcode 触发的 handler，建立 opcode → handler 映射。
6. **handler 语义还原**：对每个 handler 反编译，写出对应的 native 等价（"vADD: vREG[A] = vREG[B] + vREG[C]"）。
7. **写反汇编器**：用映射输出可读字节码序列，识别 vMOV / vADD / vJMP / vCALL / vRET 等基本块结构。
8. **写反编译器（可选）**：把虚拟指令组装成 IR / 伪 C。

## 标准字节码

### .NET IL (CIL)

```bash
# 反编译
dnSpyEx target.exe                     # GUI，最常用
dotPeek                                 # JetBrains
ILSpy / Avalonia ILSpy
ikdasm target.exe                       # CLI dump

# 反混淆
de4dot --strtok target.exe                          # 自动识别 ConfuserEx / SmartAssembly / Eazfuscator / DeepSea / ... 数十种
de4dot -p ssa target.exe                            # 显式 SmartAssembly
ConfuserEx-Static-Unpacker
osu!framework.Resources / costura 解嵌入资源
```

IL opcode 速查：

```text
ldarg.0..3 / ldarg s <n>          load argument
ldloc.0..3 / ldloc s <n>          load local
stloc.0..3 / stloc s <n>          store local
ldc.i4.0..8 / ldc.i4 <imm>        push int 常量
ldstr "..."                        push string
ldfld <field> / stfld              字段
call / callvirt <method>           调用
ret
br / br.s / brtrue / brfalse / beq / bne.un / blt / bge / ...
add / sub / mul / div / rem / and / or / xor / shl / shr / shr.un
conv.i4 / conv.i8 / conv.r4        类型转换
newobj <ctor>                      创建对象
newarr <type>                      创建数组
ldelem.i4 / stelem.i4              数组元素
throw / leave / endfinally         异常
```

### DEX (Android Dalvik bytecode)

```bash
# 反编译
jadx-gui app.apk                                # 最常用，dex → Java
apktool d app.apk                               # → smali
baksmali d classes.dex -o smali_out             # 直接 smali
smali a smali_out -o classes.dex                # 反向

# DEX 文件结构
dexdump -d -l xml classes.dex                   # Android SDK 自带
```

DEX 寄存器 + 字节码：

```text
.method public static foo(II)I
    .registers 4               # 总寄存器数
    .param p0, "a"             # 参数从最后几个寄存器开始
    .param p1, "b"
    add-int v0, p0, p1
    return v0
.end method
```

opcode 速查：

```text
const/4 v0, #int N           const v0,#imm
move vA, vB                  move
move-result-object v0
invoke-virtual {v0, v1}, Lpkg/Cls;->method(I)V
invoke-static {p0}, Lpkg/Cls;->bar(I)Ljava/lang/String;
iput-object v0, p0, Lpkg/Cls;->field:Ljava/lang/String;
iget-int v0, p0, Lpkg/Cls;->n:I
goto :label
if-eqz v0, :label / if-eq vA, vB, :label
new-instance v0, Lpkg/Cls;
invoke-direct {v0}, Lpkg/Cls;-><init>()V
throw v0
```

### WASM

```bash
wasm2wat target.wasm -o target.wat              # 文本格式
wasm-objdump -x target.wasm                     # sections
wasm-decompile target.wasm                      # 类 C 伪代码
# Ghidra wasm-loader 插件 / Binary Ninja 原生 / JEB Pro
```

```text
WASM 基本指令:
local.get / local.set $i
i32.const / i64.const / f32.const / f64.const
i32.add / .sub / .mul / .div_s / .rem_s / .and / .or / .xor / .shl / .shr_s
i32.eqz / .eq / .ne / .lt_s / .gt_s
call $func / call_indirect (type $sig)
br $label / br_if / br_table
return
memory.size / memory.grow
i32.load / .store / .load8_u / .store8 / ...
```

### EVM (Ethereum bytecode)

```bash
# 反编译
ethersplay (Binary Ninja 插件)
panoramix / panoramix.surge.sh
mythril analyze target.bin
ethereum-dasm / evm-dis
# 字节码 = .bin 文件 (hex) 或链上 codehash

# CTF / 安全审计常用：
solc --asm --bin --abi target.sol
slither target.sol
echidna-test target.sol --contract Foo
manticore target.sol
```

EVM 特点：栈机，1024 深度栈；32 字节 word；存储 (storage) / memory / calldata 三段；gas 计费。

### mruby / Lua / Python pyc

```bash
# Python pyc → py
uncompyle6 target.pyc          # Python 2 / 3.x ≤ 3.8
decompyle3 target.pyc          # Python 3.7+
pycdc target.pyc               # zrax fork，3.10+ 较好
xdis target.pyc                # 反汇编

# Python 字节码原生
python3 -c 'import dis; dis.dis(open("target.py").read())'

# Lua 5.x
luadec target.luac             # 反编译
unluac target.luac
ChunkSpy-5.1                   # 反汇编

# mruby
mruby-bin-mirb / mrbc -B   target.mrb     # 装载
```

### Hermes (React Native 新版默认)

```bash
hbcdump target.hbc -o raw.txt           # 反汇编
hermes-dec / hbctool                     # 第三方
```

### JVM bytecode

```bash
javap -p -c -v target.class             # JDK 自带
cfr target.class                         # 反编译 → Java
fernflower / procyon
recaf                                    # GUI

# 全 jar
jadx-gui target.jar
```

## 工作流：拆一个自家 VM

```text
阶段 0: 准备
- 找入口（用户函数 → VMEnter）
- 拷一份样本到工作副本
- 用 IDA / Ghidra 标 VMState 结构 + 字段（先用 unknown_struct + 后来精修）

阶段 1: dispatcher 定位
- 在 VMEnter 之后单步若干条，找到一个被反复跳进来的块 = dispatcher
- 在 dispatcher 末尾的间接跳前下断点，trace `target_addr` 的全部值 → handler 集合

阶段 2: opcode → handler 映射
- 写一个 hook（gdb breakpoint / x64dbg trace / Frida Stalker / Pin tool）记录每个被跳转到的 handler，对应当前 vIP 上的 byte
- 跑足够多输入触发不同 handler；建表 opcode → handler_ea

阶段 3: handler 语义化
- 对每个 handler 反编译，写一行注释：
    h_01: vREG[A] = vREG[B] + vREG[C]
    h_02: vREG[A] = imm32; pc += 4
    h_03: branch_if_zero vREG[A], target=imm16
    ...
- 在 IDA / Ghidra 给每个 handler 改名 vADD / vMOV_IMM / vBRZ

阶段 4: 反汇编器
- 写脚本读字节码区，按 opcode 解码：
    while pc < end:
        op = code[pc]
        h = OPCODE_TABLE[op]
        print(f"{pc:04x}: {h.name} {h.format(code, pc)}")
        pc += h.size

阶段 5: 反编译（可选）
- 把虚拟指令翻成 LLVM IR / 自家 IR，复用现成反编译器
- 或手动还原成伪 C

阶段 6: 验证
- 对一个已知输入跑一遍 native + VM，对比输出
- 写若干个单元测试覆盖每个 opcode
```

### 用 Frida Stalker 自动 trace handler

```js
// trace.js
Process.enumerateModules().forEach(m => console.log(m.name, m.base));
const handlers = new Set();
Stalker.follow(Process.getCurrentThreadId(), {
  events: { call: true, ret: true, exec: false, block: true, compile: true },
  onCallSummary(summary) {
    Object.keys(summary).forEach(addr => handlers.add(addr));
  }
});
// 过段时间 dump
setTimeout(() => {
  console.log(JSON.stringify([...handlers].map(a => ({ addr: a, count: 1 }))));
}, 10000);
```

或用 Pin tool / DynamoRIO 插件做 instruction-granular trace。

### 用 Triton 直接做"VM 解释器辨识"

```python
# 喂给 Triton 一段，让它 trace 每条 native 指令对应符号变量；
# 重复出现的 dispatcher 模式会让 Triton 的 SE 路径数指数增长 → 也是识别信号
```

## 实战入口

- **Tigress C Diversifier 的 virtualization pass** — 自家做样本练手。
- **OLLVM / O-MVLL 的 virtualization** — 开源 LLVM 混淆器（含 VM 模式）。
- **VMProtect demo / VMP devirt 论文 + NoVmp / VTIL / VMPDump** — 业界已有方案。
- **CodeBreakers / Tigress challenges** — 学术 + CTF 公开题。
- **DEFCON / GoogleCTF / Real World CTF Reversing** — 历年大量自家 VM 题。
- **mruby / WAT playground / EVM Playground / Hermes Playground** — 各标准字节码的训练。

## 自检（拿到一段疑似 VM 30 分钟内回答）

1. 大 switch 还是 handler table？
2. dispatcher 块的入口地址？handler 数量？handler 平均长度？
3. vIP / vSP / vREG 各自在 VMState 的什么偏移？
4. 字节码区起点 + 长度？是否分段（多 VM 实例）？
5. opcode 编码 = 1 字节 / 2 字节 / 含立即数？是否有 per-instance key 解码？
6. 已识别的 opcode 总数？覆盖率多少（10%? 50%? 100%?)
7. 能否对一个简单输入完整 trace 字节码并对照 native 行为复现？

## 相邻技能

- `binrev` — VM handler 是普通函数，反编译用 binrev。
- `asmrev` — 单 handler 内的指令语义。
- `irrev` — 把字节码翻成 IR 后符号执行 / 优化 / 反编译。
- `packrev` — VM 通常作为 packer 的一部分（VMP/Themida = packer + VM）。
- `cryptrev` — 反爬 VM 经常嵌入加密内核作为 opcode。
- `webrev` — 浏览器内自家 VM（高强度反爬）。
- `mrev` — 移动端自家 VM（梆梆 / 爱加密 / Bangcle 加固）。
- `scriptrev` — 标准字节码（.NET IL / DEX / Lua / pyc / Hermes）反汇编。