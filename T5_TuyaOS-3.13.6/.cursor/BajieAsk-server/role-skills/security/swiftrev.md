---
name: swift-binary-reverse-engineering
description: Swift 编译产物逆向。Swift metadata / witness table / protocol conformance / name mangling / class-struct-enum 布局 / async-await-actor / runtime / ObjC interop / PAC。配合 macrev / mrev / binrev / abirev 用。
---

# Swift 二进制逆向

## 适用场景
- 反编译 Swift binary 还原类 / 方法 / 协议。
- 分析 iOS / macOS Swift 应用安全。
- 理解 Swift metadata 与 witness table。
- Swift async / actor 模型逆向。
- ObjC ↔ Swift 混编分析。

## 不适用
- 纯 ObjC 逆向 → `macrev` / `mrev`。
- Swift 开发 / SwiftUI。
- 通用 Mach-O 逆向 → `binrev`。

---

## 识别 Swift Binary

```bash
otool -L binary | grep swift                # libswiftCore.dylib / libswiftFoundation.dylib
strings binary | grep -E 'swift_|Swift\.'
nm binary | grep '_$s'                      # Swift mangled symbols start with _$s
# Swift version:
strings binary | grep 'swiftlang-'          # Swift compiler version
```

## Name Mangling

```text
Swift mangling 前缀: $s (Swift 5+) / _T (Swift 4-)

结构:
  $s  ModuleName  TypeName  MethodName  TypeSignature

demangle:
  swift demangle '$s4main6ServerC13handleRequestySSSgF'
  → main.Server.handleRequest(Swift.Optional<Swift.String>) -> ()

  xcrun swift-demangle '_$s...'

IDA / Ghidra: 自动 demangle Swift 符号
Hopper: 优秀的 Swift demangle 支持
```

## Metadata 系统

```text
Swift Type Metadata (每个类型一个):
  在 __swift5_types section
  TypeDescriptor:
    - Kind (class=0, struct=1, enum=2, protocol=3...)
    - Name (类型名)
    - AccessFunction (获取 metadata 指针)
    - Fields (字段描述符)
    - Number of fields
    - Field offsets

  在运行时: swift_getTypeMetadata() → 返回 metadata 指针

Protocol Witness Table:
  当类型遵循 protocol 时, 编译器生成 witness table
  包含 protocol 每个 requirement 的实现函数指针
  存储在 __swift5_proto section

  struct WitnessTable {
      ProtocolConformanceDescriptor *conformance;
      void *witnesses[];  // 每个 protocol requirement 一个函数指针
  }

Protocol Dispatch:
  existential container = { value_buffer[3], metadata*, witness_table* }
  调用: witness_table->method(value_ptr, metadata)

Class VTable:
  Swift class 有类似 C++ 的 vtable
  存储在 metadata 结构中
  vtable entries 按声明顺序

  注意: final / @objc / dynamic 影响 dispatch 方式
  - final: 直接调用 (static dispatch)
  - @objc: ObjC msgSend dispatch
  - dynamic: ObjC msgSend (即使纯 Swift class)
  - 默认: vtable dispatch
```

## 数据布局

```text
struct: 值类型, 内存中直接存储
  按字段顺序排列, 编译器可能重排以优化对齐
  sizeof = 所有字段 + padding

class: 引用类型, 堆分配
  [isa pointer] [refcount] [field1] [field2] ...
  isa → metadata → vtable
  refcount: Swift 使用 inline refcount (不同于 ObjC side table)

enum:
  无关联值: 单字节 discriminator (0, 1, 2, ...)
  有关联值: [payload] [extra inhabitants / discriminator]
  Optional<T>: 利用 extra inhabitants (如 Optional<Class> 用 NULL 表示 .none)

String:
  小字符串优化: ≤15 bytes ASCII 存在 String 结构体本身 (tagged pointer)
  大字符串: 堆分配, 引用计数
  sizeof(String) = 16 bytes (两个 word)

Array / Dictionary / Set:
  Copy-on-Write (CoW): 共享存储直到修改
  _ContiguousArrayStorage (数组) / _NativeDictionary (字典)
```

## Async / Actor

```text
async 函数编译为协程:
  - 函数被拆分为多个 continuation
  - 每个 await 点是一个 suspend point
  - 状态存储在 async frame (堆分配)

actor:
  - 有自己的 executor (串行队列)
  - 跨 actor 调用自动切换到目标 actor 的 executor
  - 在二进制中: swift_task_enqueue / swift_task_switch

逆向时:
  - 看到 swift_task_create / swift_continuation_* → async 代码
  - 状态机类似 Rust async (match state → 执行 → 挂起)
  - Hopper / IDA 难以还原完整 async 逻辑
```

## ObjC Interop

```text
@objc 标记的 Swift 类:
  - 有 ObjC metadata (class_ro_t)
  - 方法通过 objc_msgSend dispatch
  - 可被 ObjC runtime API 枚举

Bridging:
  NSString ↔ String (zero-copy for constants)
  NSArray ↔ Array (lazy bridging)
  NSDictionary ↔ Dictionary

逆向时:
  - ObjC 方法: 在 __objc_methname / __objc_selrefs 可找到
  - Swift 方法: 在 __swift5_types / witness table
  - 混编: 同一个类可能有 ObjC 和 Swift 两套入口
```

## PAC (Pointer Authentication)

```text
ARMv8.3 PAC (Apple Silicon):
  - 函数指针 / 返回地址带签名 (PAC)
  - vtable entries 签名
  - Swift witness table 指针签名

对逆向的影响:
  - 不能随意修改函数指针 (PAC 验证失败 → crash)
  - IDA / Ghidra 需要 strip PAC bits 才能正确解析地址
  - PACDA / PACDB / PACIA / PACIB 指令

绕过研究: 需要找到 signing gadget 或 PAC oracle
```

## 工具

```text
Hopper Disassembler:  最佳 Swift 支持 (demangle + metadata 解析)
IDA + swift_demangle:  Swift demangle 插件
Ghidra:               需要手动导入 Swift 类型
class-dump (swift):   class-dump-swift 提取 ObjC + Swift 声明
dsdump:               dump Swift metadata (https://github.com/DerekSelander/dsdump)
Frida:                hook Swift 方法 (需要 mangled name)
```

## 实战入口
- **Hopper** — macOS/iOS Swift 逆向首选。
- **dsdump** — Swift metadata dump。
- **swift demangle** — 符号还原。
- **Apple Swift ABI Stability Manifesto**。
- **Swift Runtime source (apple/swift)**。

## 自检
1. Swift 版本？(5.0+ / 5.5+ async / 5.9+ macro)
2. 纯 Swift 还是 ObjC 混编？
3. iOS / macOS / 其他？
4. ARM64 / ARM64e (PAC)？
5. 有 async/await？
6. 有 actor？
7. 需要 Frida hook？

## 相邻技能
- `macrev` — macOS 生态。
- `mrev` — iOS 应用逆向。
- `binrev` — Mach-O 结构。
- `abirev` — 调用约定。