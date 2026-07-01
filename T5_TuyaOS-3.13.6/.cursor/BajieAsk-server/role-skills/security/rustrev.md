---
name: rust-binary-reverse-engineering
description: Rust 编译产物逆向工程。Rust name mangling (v0 / legacy) 与 demangle；enum / Result / Option 内存布局；trait object / vtable / dyn dispatch；async/await 状态机；panic / unwinding；Rust std 模式识别；所有权模型在二进制中的体现；Rust 恶意软件趋势。配合 binrev / malrev / abirev 用。
---

# Rust 二进制逆向

## 适用场景
- 反编译 Rust binary 还原逻辑 (函数名极长 + 泛型展开)。
- 分析 Rust 编写的恶意软件 / 勒索软件 (BlackCat/ALPHV / Hive / RustBucket)。
- 理解 Rust enum / Option / Result 的二进制布局。
- 逆向 Rust async 代码的状态机。
- Rust wasm 模块逆向 (配合 `wasmrev`)。

## 不适用
- Rust 源码开发。
- 通用 ELF/PE 逆向 → `binrev`。
- Go 二进制 → `gorev`。

---

## 识别 Rust Binary

```bash
strings <bin> | grep -E 'rustc|panic_abort|rust_begin_unwind|\.rs:[0-9]+'
strings <bin> | grep 'rust-call'
# Rust panic 信息通常含完整文件路径:
# "thread 'main' panicked at 'xxx', src/main.rs:42:5"

# 编译器版本
strings <bin> | grep 'rustc '
# 如: "rustc 1.76.0 (07dca489a 2024-02-04)"

# Rust 目标三元组
strings <bin> | grep -E 'x86_64-unknown-linux|aarch64-apple-darwin|x86_64-pc-windows'
```

## Name Mangling

```text
Rust v0 mangling (Rust 1.x):
  _RNvNtCs...N...E       → crate::module::function
  _R = Rust
  N = namespace
  C = crate
  v = value (function)

  demangle:
  rustfilt '_RNvNtCsfE5gx4BWKLS_5hello4main'
  → hello::main

Legacy mangling:
  _ZN5hello4mainE         → hello::main (类似 C++ Itanium)

工具:
  rustfilt                 # cargo install rustfilt
  c++filt                  # 也能处理 legacy 格式
  IDA: Options → Demangled names → Rust
  Ghidra: 自动识别 Rust mangling
```

## 数据结构布局

```text
Option<T> / Result<T,E>:
  Rust 编译器做 niche optimization:
  Option<&T>      → 1 pointer (NULL = None, 非NULL = Some)
  Option<bool>    → 1 byte (0=false, 1=true, 2=None)
  Option<NonZeroU32> → 4 bytes (0=None)
  Result<T, E>    → max(size_of::<T>(), size_of::<E>()) + discriminant

  在二进制中:
  - 判断 discriminant (通常在结构体开头或末尾)
  - if discriminant == 0 → Ok/Some, == 1 → Err/None (或反过来)

enum (tagged union):
  enum Msg {
      Quit,                    // discriminant only
      Move { x: i32, y: i32 },
      Write(String),
      Color(u8, u8, u8),
  }
  布局: [discriminant (u8/u16/...)] [padding] [largest variant data]
  Rust 会优化 discriminant 大小 + 字段排序

String / &str:
  String = {ptr: *u8, len: usize, cap: usize}  (堆分配, 类似 Vec<u8>)
  &str   = {ptr: *u8, len: usize}              (胖指针)

Vec<T>:
  {ptr: *T, len: usize, cap: usize}

Box<T>:
  就是 *T (单指针, 编译器保证非 NULL)

Arc<T> / Rc<T>:
  指向堆上 {strong_count, weak_count, data: T}

HashMap:
  hashbrown (SwissTable):
  - 控制字节数组 (每字节表示一个槽的状态: empty/deleted/occupied + hash7)
  - 键值对数组
  - 不同于 Go/Java 的链式哈希
```

## Trait Object / dyn Dispatch

```text
trait object (&dyn Trait / Box<dyn Trait>):
  {data: *void, vtable: *VTable}

VTable 布局:
  [0] drop_in_place 析构函数
  [1] size_of::<T>
  [2] align_of::<T>
  [3+] trait 方法指针 (按声明顺序)

逆向时:
  - 看到两个指针传递 → 可能是 trait object
  - vtable 在 .rodata
  - vtable[0] = destructor
  - vtable[3+] = 方法
  - 通过 vtable 方法可推断实际类型
```

## Async/Await 状态机

```text
async fn 编译为 state machine:

  async fn fetch() -> String {
      let resp = client.get(url).await;
      resp.text().await
  }

编译后:
  enum FetchFuture {
      State0 { client, url },
      State1 { resp_future },
      State2 { text_future },
      Done,
  }

  impl Future for FetchFuture {
      fn poll(self: Pin<&mut Self>, cx: &mut Context) -> Poll<String> {
          match self.state {
              State0 => { /* 发起请求, 转 State1 */ }
              State1 => { /* poll resp_future */ }
              State2 => { /* poll text_future */ }
          }
      }
  }

逆向时:
  - 看到大型 match/switch + 状态字段 → async 状态机
  - 每个分支对应一个 await 点
  - poll 函数被频繁调用
  - tokio / async-std runtime 驱动执行
```

## Panic / Unwinding

```text
panic 路径:
  std::panicking::begin_panic → rust_begin_unwind → 打印信息 → abort/unwind

panic 信息在二进制中:
  - 包含文件路径 + 行号 + 列号
  - 即使 strip 也可能保留 (在 .rodata)
  - 可用于推断源码结构

  strings <bin> | grep '\.rs:' | sort -u
  # 输出:
  # src/main.rs:42:5
  # src/network/client.rs:128:17
  # → 还原项目目录结构

unwinding vs abort:
  - panic=unwind (默认): 栈展开, 调用 drop, 类似 C++ exception
  - panic=abort: 直接 abort, 更小更快
  - release 模式常用 abort → 看不到 catch_unwind
```

## Rust 恶意软件

```text
趋势:
  - BlackCat/ALPHV: 首个 Rust 勒索软件, 跨平台
  - Hive: 部分变种用 Rust 重写
  - RustBucket: macOS 后门 (APT38/Lazarus)
  - Buer Loader: Rust 重写版
  - 原因: 跨平台 + 难分析 + AV 签名库覆盖差

分析流程:
  1. 识别 Rust (strings / panic 路径 / mangling)
  2. demangle 函数名: rustfilt
  3. 找配置: 搜索嵌入字符串 / 环境变量 / 命令行参数
  4. 定位加密: 搜索 aes / chacha / rsa 相关函数
  5. C2 通信: reqwest / hyper / tokio-tungstenite
  6. 文件操作: std::fs / walkdir / glob
```

## 实战入口
- **rustfilt** — Rust demangle 工具。
- **Ghidra + Rust type recovery** — 自动分析。
- **IDA Rust plugin** — 函数签名还原。
- **Mandiant / CrowdStrike Rust malware blogs**。
- **Rust Reference (内存布局章节)** — 官方文档。

## 自检
1. Rust 版本？(影响 mangling / ABI)
2. stripped？(panic 信息是否保留)
3. panic=abort 还是 unwind？
4. 有 FFI / unsafe？
5. async runtime？(tokio / async-std)
6. 恶意样本？(配合 malrev)
7. wasm？(配合 wasmrev)

## 相邻技能
- `binrev` — 通用二进制逆向。
- `malrev` — Rust 恶意软件分析。
- `abirev` — 调用约定 / vtable。
- `wasmrev` — Rust → wasm。
- `gorev` — Go 类比 (现代编译型)。