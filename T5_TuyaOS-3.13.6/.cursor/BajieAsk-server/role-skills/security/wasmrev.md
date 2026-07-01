---
name: webassembly-reverse-engineering
description: WebAssembly 逆向工程。wasm 二进制格式解析 + WAT 文本格式互转（wasm2wat / wat2wasm）；wasm-decompile / Ghidra wasm plugin / JEB wasm 反编译；线性内存模型 + table indirect call + import/export 分析；Emscripten / Rust wasm-pack / AssemblyScript / Go wasm 编译产物特征识别；WASI 系统调用接口；浏览器 DevTools wasm 调试；wasm 混淆 / 加密 / 反调试对抗；服务端 wasm (Cloudflare Workers / Fastly Compute) 逆向。配合 webrev / binrev / cryptrev 用。
---

# WebAssembly 逆向

## 适用场景

- 反编译 .wasm 二进制还原算法逻辑。
- 分析浏览器端 wasm 模块的加密 / 授权 / 反作弊 / DRM 实现。
- 调试 wasm 运行时行为（Chrome DevTools / wasmtime / wasm3）。
- 识别 wasm 编译来源（C/C++ Emscripten / Rust wasm-pack / Go / AssemblyScript）。
- 分析 Cloudflare Workers / Fastly Compute 等服务端 wasm 应用。
- WebAssembly 安全审计（内存安全 / import 权限 / 沙箱逃逸）。

## 不适用

- 普通 JavaScript 混淆逆向 → `scriptrev` / `webrev`。
- 原生 ELF / PE 二进制 → `binrev`。
- 想学 wasm 开发 / 编译。

---

## wasm 二进制格式

### 模块结构

```text
wasm module:
  magic:   0x00 0x61 0x73 0x6D  ("\0asm")
  version: 0x01 0x00 0x00 0x00  (version 1)

  sections (按 ID 排序):
    0  Custom    自定义 (name section / debug info / producers)
    1  Type      函数类型签名 (参数 + 返回值)
    2  Import    导入 (env.memory / wasi_snapshot_preview1.fd_write / ...)
    3  Function  函数索引 → type index 映射
    4  Table     间接调用表 (funcref / externref)
    5  Memory    线性内存声明 (initial / max pages, 1 page = 64KB)
    6  Global    全局变量 (i32 / i64 / f32 / f64)
    7  Export    导出 (memory / functions / tables)
    8  Start     启动函数 (可选)
    9  Element   table 初始化数据
    10 Code      函数体 (locals + instructions)
    11 Data      内存初始化数据 (字符串常量 / 静态数据)
    12 DataCount 数据段计数 (bulk memory ops)

关键:
  - 函数索引 = import 函数数 + 本地函数数
  - 间接调用: call_indirect → table[index] → 实际函数
  - 线性内存: 一块连续字节数组, 所有指针都是偏移量
```

### 指令集

```text
数值:
  i32.const / i64.const / f32.const / f64.const
  i32.add / i32.sub / i32.mul / i32.div_u / i32.div_s
  i32.and / i32.or / i32.xor / i32.shl / i32.shr_u / i32.shr_s
  i32.eq / i32.ne / i32.lt_u / i32.lt_s / i32.gt_u / i32.gt_s

内存:
  i32.load / i32.store / i32.load8_u / i32.load16_u
  i64.load / i64.store
  memory.size / memory.grow

控制流:
  block ... end           块
  loop ... end            循环
  if ... else ... end     条件
  br / br_if / br_table   跳转 (到 block/loop label)
  call <funcidx>          直接调用
  call_indirect <typeidx> 间接调用 (从 table)
  return
  unreachable

局部变量:
  local.get / local.set / local.tee

全局变量:
  global.get / global.set

表:
  table.get / table.set

引用:
  ref.null / ref.is_null / ref.func
```

---

## 反编译工具

### wasm2wat (WABT)

```bash
# 安装
# brew install wabt  或  apt install wabt

# 二进制 → 文本
wasm2wat module.wasm -o module.wat

# 文本 → 二进制
wat2wasm module.wat -o module.wasm

# 验证
wasm-validate module.wasm

# 反汇编 (比 WAT 更接近原始)
wasm-objdump -d module.wasm                # 反汇编
wasm-objdump -x module.wasm                # section 信息
wasm-objdump -h module.wasm                # 头信息
wasm-objdump -s module.wasm                # section 内容 (含 data)
```

### wasm-decompile (WABT)

```bash
# 比 WAT 更可读的伪代码
wasm-decompile module.wasm -o module.dcmp

# 输出类似:
# function add(a:int, b:int):int {
#   return a + b;
# }
```

### Ghidra wasm

```text
Ghidra + wasm plugin:
  1. 安装: https://github.com/nicklashall/ghidra-wasm-plugin
  2. File → Import → module.wasm
  3. 自动分析后可查看反编译 (C-like)
  4. 优势: 完整 Ghidra 分析能力 (交叉引用 / 重命名 / 类型推断)
```

### JEB wasm

```text
JEB Decompiler:
  - 商业工具, 支持 wasm 反编译
  - 质量高, 支持 Emscripten 特征识别
  - 可导入 source map (如果有)
```

### 浏览器 DevTools

```text
Chrome DevTools:
  1. Sources → wasm 文件
  2. 如果有 DWARF / source map: 可直接看源码
  3. 断点: 在 WAT 视图设断点
  4. Memory Inspector: 查看线性内存
  5. Scope: 查看局部变量 / 全局变量

  启用 wasm DWARF 调试:
  chrome://flags/#enable-webassembly-debugging
  安装扩展: C/C++ DevTools Support (Chrome)

Firefox:
  类似功能, debugger 支持 wasm source map
```

---

## 编译来源识别

### Emscripten (C/C++)

```text
特征:
  - Import: "env" namespace (memory / table / __memory_base / __table_base)
  - 函数名: _main / _malloc / _free / _strlen / _memcpy / _printf
  - Export: _main / _malloc / _free / stackSave / stackRestore / stackAlloc
  - 大量 libc 函数在 wasm 中 (不是 import)
  - Data section 含 C 字符串常量
  - 附带 .js glue code (Module.ccall / Module.cwrap)

  识别命令:
  wasm-objdump -x module.wasm | grep -E '_main|emscripten|_malloc'
  strings module.wasm | grep -i emscripten

  Custom section "producers":
  wasm-objdump -s -j producers module.wasm
  # → "C" / "C++" / "Emscripten" + 版本号
```

### Rust (wasm-pack / wasm-bindgen)

```text
特征:
  - Import: "__wbindgen_*" 函数族
  - Export: "__wbindgen_*" / "__wbg_*"
  - 函数名含: "_ZN" (Rust mangled name) 如果未 strip
  - panic 相关字符串: "panicked at" / "rust-begin-unwind"
  - wasm-bindgen glue: 生成 JS wrapper

  识别:
  strings module.wasm | grep -E 'panicked|rust_begin_unwind|wbindgen'
  wasm-objdump -x module.wasm | grep '__wbindgen'
```

### Go

```text
特征:
  - 非常大的 wasm 文件 (10MB+ 常见, Go runtime 全打包)
  - Import: "go" namespace (go.runtime.wasmExit / go.runtime.wasmWrite / ...)
  - 附带 wasm_exec.js
  - 函数极多 (Go 标准库大量打包)

  识别:
  wasm-objdump -x module.wasm | grep 'go\.'
  strings module.wasm | grep 'runtime.goexit\|runtime.main'
```

### AssemblyScript

```text
特征:
  - 类 TypeScript 语法编译
  - 函数名保留 (通常不 strip)
  - Import: "env.abort" (AssemblyScript runtime)
  - 较小体积

  识别:
  strings module.wasm | grep 'assemblyscript\|~lib/'
```

---

## 静态分析

### 字符串提取

```bash
# 从 data section 提取
wasm-objdump -s -j Data module.wasm | xxd | less
strings module.wasm
# 更精确: 从 data segment 偏移解析
python3 -c "
import struct
with open('module.wasm', 'rb') as f:
    data = f.read()
    # 搜索可打印 ASCII 序列
    import re
    for m in re.finditer(rb'[\x20-\x7e]{4,}', data):
        print(f'0x{m.start():06x}: {m.group().decode()}')
"
```

### Import / Export 分析

```bash
# 列出所有 import
wasm-objdump -j Import -x module.wasm
# 关注:
# - env.memory          → 共享内存
# - wasi_snapshot_preview1.*  → WASI 系统调用
# - env.__stack_pointer → 全局栈指针
# - 自定义 import      → JS 胶水函数

# 列出所有 export
wasm-objdump -j Export -x module.wasm
# 关注:
# - memory              → 可从 JS 访问的内存
# - _start / main       → 入口
# - malloc / free       → 内存管理 (可用于构造输入)
# - 业务函数            → 直接调用目标
```

### 控制流图

```bash
# Heimdall (也支持 wasm)
# 或: 自己解析 block/loop/if/br 层级

# wasm-cfg (如果可用)
# 或在 Ghidra 中查看 Function Graph
```

---

## 动态分析

### wasmtime / wasmer CLI

```bash
# wasmtime (Bytecode Alliance)
wasmtime module.wasm                       # 执行 (需 WASI)
wasmtime run --invoke my_func module.wasm 42  # 调用特定函数

# wasmer
wasmer run module.wasm
wasmer inspect module.wasm                 # 查看 import/export

# wasm3 (解释器, 轻量)
wasm3 module.wasm
```

### Hook / Instrumentation

```javascript
// 浏览器中 hook wasm import
const originalInstantiate = WebAssembly.instantiateStreaming;
WebAssembly.instantiateStreaming = async function(source, importObj) {
    // 拦截 import
    const original = importObj.env || {};
    importObj.env = new Proxy(original, {
        get(target, prop) {
            const orig = target[prop];
            if (typeof orig === 'function') {
                return function(...args) {
                    console.log(`[wasm import] ${prop}(${args})`);
                    return orig.apply(this, args);
                };
            }
            return orig;
        }
    });

    const result = await originalInstantiate.call(this, source, importObj);

    // 拦截 export
    const exports = result.instance.exports;
    for (const [name, exp] of Object.entries(exports)) {
        if (typeof exp === 'function') {
            const orig = exp;
            exports[name] = function(...args) {
                console.log(`[wasm export] ${name}(${args})`);
                const ret = orig(...args);
                console.log(`[wasm export] ${name} => ${ret}`);
                return ret;
            };
        }
    }
    return result;
};
```

```javascript
// 内存 dump
// 获取 wasm 线性内存
const memory = wasmInstance.exports.memory;
const buf = new Uint8Array(memory.buffer);

// dump 特定区域
function hexdump(offset, length) {
    const slice = buf.slice(offset, offset + length);
    let hex = '';
    for (let i = 0; i < slice.length; i++) {
        hex += slice[i].toString(16).padStart(2, '0') + ' ';
        if ((i + 1) % 16 === 0) hex += '\n';
    }
    console.log(hex);
}

// 监控内存写入 (通过 SharedArrayBuffer + Atomics 或定时 diff)
let snapshot = new Uint8Array(memory.buffer.slice(0));
setInterval(() => {
    const current = new Uint8Array(memory.buffer);
    for (let i = 0; i < current.length; i++) {
        if (current[i] !== snapshot[i]) {
            console.log(`[mem write] 0x${i.toString(16)}: ${snapshot[i]} → ${current[i]}`);
        }
    }
    snapshot = new Uint8Array(memory.buffer.slice(0));
}, 100);
```

---

## wasm 安全

```text
安全模型:
  - 沙箱: wasm 不能直接访问宿主内存/文件/网络
  - 所有能力通过 import 显式授予
  - 线性内存有边界检查 (trap on OOB)
  - 没有 exec/JIT (除非宿主提供)

攻击面:
  1. wasm → JS 桥接:
     - import 函数的参数可能被恶意构造
     - 内存共享: JS 可读写 wasm linear memory

  2. 逻辑漏洞:
     - 加密算法可被逆向 → 密钥提取
     - 授权检查可被 patch (改 wasm 重新加载)
     - 反作弊逻辑可被理解 + 规避

  3. 原生溢出 (在 wasm 内部):
     - C/C++ 编译的 wasm 仍可能有 buffer overflow
     - 但在 wasm 内, 溢出被限制在 linear memory 内
     - 不能逃逸 wasm 沙箱 (除非宿主 bug)

  4. WASI 权限:
     - fd_read / fd_write / path_open 等
     - 宿主控制可访问的文件 / 目录
     - 配置不当 → 文件读写

  5. wasm 运行时漏洞:
     - V8 wasm JIT bug → 沙箱逃逸 (浏览器级)
     - wasmtime / wasmer 漏洞 → 服务端逃逸
     - 这些是高价值目标 (Pwn2Own / Project Zero)

Patching wasm:
  # 修改 wasm 绕过检查
  wasm2wat module.wasm -o module.wat
  # 编辑 WAT: 将检查函数改为直接返回 1
  # (func $check_license (result i32)
  #   i32.const 1)
  wat2wasm module.wat -o patched.wasm
  # 替换网页中的 wasm 文件 (mitmproxy / local override)
```

---

## 实战入口

- **wasm binary toolkit (WABT)** — 官方工具集: wasm2wat / wasm-objdump / wasm-decompile。
- **Ghidra + wasm plugin** — 最强免费反编译。
- **Chrome DevTools wasm debugging** — 浏览器内调试。
- **Emscripten docs** — 理解 C/C++ → wasm 编译。
- **WebAssembly Specification** — webassembly.github.io/spec。
- **WebAssembly Security (Nicklaus)** — 安全研究论文集。
- **wasm CTF challenges** — picoCTF / HackTheBox / CTFtime wasm 题。
- **mitmproxy** — 拦截替换 wasm 文件做动态测试。

## 自检（接到目标 30 分钟内回答）

1. wasm 来源？（网页 / 服务端 / 嵌入式 / 游戏）
2. 编译语言？（C/C++ Emscripten / Rust / Go / AssemblyScript / 其他）
3. 有 source map / DWARF 吗？
4. Import 分析？（WASI / 自定义 JS 胶水 / 环境依赖）
5. Export 分析？（入口函数 / 内存 / table）
6. 目标？（算法还原 / 密钥提取 / 逻辑绕过 / 安全审计）
7. 需要 patch 吗？
8. 运行时？（浏览器 / wasmtime / wasmer / Node.js）
9. 混淆 / 反调试？
10. 相邻技能？（webrev / binrev / cryptrev / gamerev）

## 相邻技能

- `webrev` — Web 前端安全（wasm 常嵌入 Web 应用）。
- `binrev` — 原生二进制逆向基础（wasm 类似简化 ISA）。
- `scriptrev` — JavaScript 逆向（wasm + JS 胶水代码）。
- `cryptrev` — 加密算法还原（wasm 常用于浏览器端加密）。
- `gamerev` — 游戏反作弊（Unity WebGL / Unreal wasm）。
- `drmrev` — DRM 实现分析（视频 / 音频 wasm DRM）。