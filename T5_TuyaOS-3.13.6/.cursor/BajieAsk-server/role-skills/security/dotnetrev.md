---
name: dotnet-clr-reverse-engineering
description: .NET 逆向工程。CIL 字节码分析；dnSpy / ILSpy / dotPeek 反编译；de4dot / ConfuserEx / .NET Reactor 去混淆；Assembly 结构（PE + CLI metadata + IL）；Mono / .NET Core / NativeAOT 差异；P/Invoke / COM Interop 桥接；Harmony / dnlib 字节码改写。配合 binrev / winrev / javarev / scriptrev 用。
---

# .NET / CLR / IL 逆向

## 适用场景
- 反编译 .NET Assembly (.dll / .exe) 还原 C# / VB.NET / F# 源码。
- 分析 .NET 恶意样本 / 混淆 loader / 商业软件。
- 去除 ConfuserEx / .NET Reactor / Eazfuscator / Dotfuscator 混淆。
- 审计 ASP.NET / Blazor / WPF / MAUI 应用后端逻辑。
- 分析 Unity Mono 层 (配合 `gamerev`)。

## 不适用
- Java / JVM → `javarev`。
- Unity IL2CPP 原生层 → `binrev` + `gamerev`。
- PowerShell / VBA 脚本 → `scriptrev`。

---

## Assembly 结构

```text
.NET Assembly = PE 文件 + CLI Header + Metadata + IL Code

PE Header
  └── CLI Header (IMAGE_COR20_HEADER)
      ├── MetaData RVA → #~ stream (tables)
      │   ├── TypeDef / TypeRef / MethodDef / Field / MemberRef
      │   ├── AssemblyRef / ModuleRef
      │   └── CustomAttribute (Obfuscator 水印常在此)
      ├── #Strings stream → 名称
      ├── #US stream → 用户字符串
      ├── #Blob stream → 签名 / 常量
      ├── #GUID stream
      └── EntryPoint Token → Main 方法

关键:
  - Token: 0x06000001 = MethodDef 表第 1 行
  - RVA → IL method body → method header + IL bytes
  - .NET 5+ 单文件: 多个 Assembly 打包在一个 PE 中 (bundle marker)
  - ReadyToRun (R2R): IL + 预编译原生代码并存
  - NativeAOT (.NET 7+): 纯原生, 无 IL → 需用 binrev
```

## 反编译工具

```bash
# dnSpy (最强, 支持调试 + 编辑 + 重编译)
# https://github.com/dnSpyEx/dnSpy (社区维护)
# GUI: 打开 .dll/.exe → 自动反编译为 C#
# 支持: 设断点 / 修改 IL / 重新保存

# ILSpy (开源, 跨平台)
# https://github.com/icsharpcode/ILSpy
# GUI + CLI:
ilspycmd assembly.dll -o output/
ilspycmd assembly.dll -t MyNamespace.MyClass  # 指定类型

# dotPeek (JetBrains 免费)
# Windows GUI, 质量高, 支持 symbol server

# dnlib (编程式 .NET metadata 读写)
# NuGet: dnlib
# Python: pythonnet + dnlib 或 dnfile (纯 Python)
pip install dnfile
python3 -c "
import dnfile
pe = dnfile.dnPE('sample.dll')
for row in pe.net.mdtables.TypeDef:
    print(f'{row.TypeNamespace}.{row.TypeName}')
for row in pe.net.mdtables.MethodDef:
    print(f'  {row.Name} RVA=0x{row.Rva:08x}')
"

# ildasm (SDK 自带)
ildasm /out=output.il assembly.dll
# 输出完整 IL 文本

# monodis (Mono 工具)
monodis --method assembly.dll
```

## CIL 指令速查

```text
加载:
  ldarg.0 .. ldarg.3 / ldarg.s    加载参数 (ldarg.0 = this)
  ldloc.0 .. ldloc.3 / ldloc.s    加载局部变量
  ldc.i4.0 .. ldc.i4.8 / ldc.i4.s / ldc.i4  加载常量
  ldstr "..."                      加载字符串
  ldnull                           null
  ldfld / ldsfld                   实例/静态字段

存储:
  starg.s / stloc.0 .. stloc.3 / stloc.s
  stfld / stsfld

调用:
  call          静态调用 / 非虚实例调用
  callvirt      虚方法调用 (即使目标非虚, C# 编译器也常用)
  newobj        构造器调用
  ldftn / ldvirtftn + calli    间接调用

控制流:
  br / br.s     无条件跳转
  brfalse / brtrue / beq / bne.un / blt / bgt / ble / bge
  switch        跳转表
  ret           返回
  throw         抛异常
  leave         离开 try/catch
  endfinally

对象:
  newarr        创建数组
  ldelem / stelem  数组元素
  castclass / isinst  类型转换/检查
  box / unbox   装箱/拆箱
```

## 混淆与去混淆

```text
常见混淆器:
  ConfuserEx:      开源, 最常见, 控制流 + 字符串加密 + 反调试 + 水印
  .NET Reactor:    商业, 混合模式 + 原生 stub + 许可系统
  Eazfuscator:     商业, 代码虚拟化 + 字符串加密
  Dotfuscator:     微软自带 (Community Edition), 重命名为主
  Babel:           商业, 字符串加密 + 资源加密
  Crypto Obfuscator: 商业, 较老
  Agile.NET:       商业
  SmartAssembly:   RedGate, 字符串加密 + 流程混淆

识别:
  - dnSpy: 查看 CustomAttribute (ConfuserEx 留水印 "ConfusedBy")
  - 类/方法名: 不可打印字符 / Unicode / 单字符
  - 字符串解密: 所有字符串被替换为 static 方法调用
  - 控制流: switch(跳转表) 嵌套, goto 混乱
  - Proxy call: 方法调用被替换为 delegate

去混淆工具:
  de4dot:           最强通用去混淆
    de4dot sample.dll -o clean.dll
    de4dot sample.dll --un-name "!^[a-zA-Z]" -o clean.dll

  ConfuserEx 专项:
    ConfuserExStringDecryptor / ConfuserExSwitchKiller
    cex-deobfuscator

  .NET Reactor:
    .NETReactorSlayer
    de4dot -p dr (detect reactor)

  手动去混淆:
    1. dnSpy 打开 → 找字符串解密方法 (通常 static string xxx(int))
    2. 在 dnSpy 中设断点 → 运行 → 断在解密方法 → 看返回值
    3. 或: 写 C# 脚本调用解密方法
    4. 或: dnlib + Reflection 批量解密
```

```csharp
// dnlib 批量字符串解密示例
using dnlib.DotNet;
using dnlib.DotNet.Emit;
using System.Reflection;

var mod = ModuleDefMD.Load("obfuscated.dll");
var asm = Assembly.LoadFrom("obfuscated.dll");

foreach (var type in mod.Types) {
    foreach (var method in type.Methods) {
        if (method.Body == null) continue;
        for (int i = 0; i < method.Body.Instructions.Count; i++) {
            var inst = method.Body.Instructions[i];
            if (inst.OpCode == OpCodes.Call && inst.Operand is MethodDef callee
                && callee.ReturnType.FullName == "System.String"
                && callee.Parameters.Count == 1) {
                // 找前面的 ldc.i4
                if (i > 0 && method.Body.Instructions[i-1].IsLdcI4()) {
                    int key = method.Body.Instructions[i-1].GetLdcI4Value();
                    try {
                        var mi = asm.GetType(callee.DeclaringType.FullName)
                            .GetMethod(callee.Name, BindingFlags.Static | BindingFlags.NonPublic);
                        string decrypted = (string)mi.Invoke(null, new object[]{key});
                        Console.WriteLine($"[{method.FullName}] {key} => \"{decrypted}\"");
                    } catch {}
                }
            }
        }
    }
}
```

## P/Invoke 与 Mixed-Mode

```text
P/Invoke (Platform Invoke):
  [DllImport("kernel32.dll")]
  static extern IntPtr VirtualAlloc(IntPtr addr, uint size, uint type, uint protect);

  逆向时:
  - 搜索 DllImport attribute → 找所有原生调用
  - 常见恶意用途: VirtualAlloc + Marshal.Copy + CreateThread = shellcode
  - dnSpy: 搜索 "DllImport" 或 "extern"

COM Interop:
  - [ComImport] + GUID → COM 对象调用
  - 恶意用途: 通过 COM 绕过检测

Mixed-Mode Assembly:
  - 同时含 IL + 原生代码 (C++/CLI)
  - dnSpy 只能看 IL 部分, 原生部分需要 IDA/Ghidra
  - .NET Reactor 常用此技术保护关键代码
```

## .NET 恶意样本常见模式

```text
1. 多阶段加载:
   Stage 1: .NET dropper (可能混淆)
   Stage 2: Assembly.Load(byte[]) → 内存加载第二阶段
   Stage 3: 反射调用 → 最终 payload

2. 字符串加密:
   所有敏感字符串 (C2 / URL / key) → 加密存储
   运行时调用解密函数还原

3. 资源嵌入:
   加密 payload 在 .resx / embedded resource
   Assembly.GetManifestResourceStream() → 解密 → Assembly.Load()

4. Reflection 滥用:
   Type.GetType() / Activator.CreateInstance() / MethodInfo.Invoke()
   绕过静态分析

5. 混淆 + 反调试:
   Environment.GetEnvironmentVariable("COR_ENABLE_PROFILING")
   Debugger.IsAttached
   DateTime 检查 (沙箱时间加速)

分析流程:
  1. de4dot 去混淆
  2. dnSpy 打开 → 找 Main / EntryPoint
  3. 搜索 Assembly.Load / Activator.CreateInstance
  4. 设断点在 Assembly.Load → dump 第二阶段
  5. 递归分析直到 final payload
```

## 调试

```bash
# dnSpy 调试 (最强)
# 1. 打开 exe → Debug → Start Debugging
# 2. 在 C# 源码视图中设断点
# 3. 支持修改变量值 / 步进 / 条件断点

# Visual Studio
# 1. Attach to Process → 选目标 .NET 进程
# 2. Debug → Windows → Modules → 右键 → Decompile Source

# WinDbg + SOS (低层)
.loadby sos clr                            # .NET Framework
.loadby sos coreclr                        # .NET Core
!dumpheap -stat                            # 堆统计
!dumpobj <addr>                            # 对象详情
!clrstack                                  # 托管栈
!dso                                       # 栈上对象
!eeheap -gc                                # GC 堆
!name2ee * MyClass                         # 找类
!dumpmt -md <MethodTable>                  # 方法表
!dumpil <MethodDesc>                       # IL 代码
!savemodule <addr> dump.dll                # dump 模块
```

## 实战入口
- **dnSpyEx** — 最强 .NET 逆向工具 (反编译 + 调试 + 编辑)。
- **ILSpy** — 开源跨平台反编译器。
- **de4dot** — 通用去混淆器。
- **dnlib** — .NET metadata 编程式读写。
- **ECMA-335 Standard** — CLI 规范。
- **Malware Analysis: .NET** — 大量 .NET 恶意样本分析文章。

## 自检（接到目标 30 分钟内回答）
1. .NET 版本？(Framework 4.x / Core / 5+ / NativeAOT)
2. 混淆器？(ConfuserEx / .NET Reactor / Eazfuscator / 无)
3. 单文件发布？(Self-contained / R2R / NativeAOT)
4. P/Invoke / COM Interop？
5. 反调试？(Debugger.IsAttached / 环境检查)
6. 内存加载？(Assembly.Load / Reflection)
7. 需要 patch / 修改？(dnSpy 编辑 / dnlib)
8. Unity Mono？(配合 gamerev)
9. 恶意样本？(配合 malrev)
10. 相邻技能？(javarev / scriptrev / binrev / winrev)

## 相邻技能
- `javarev` — JVM 字节码类比。
- `scriptrev` — PowerShell / VBA 等 .NET 生态脚本。
- `binrev` — NativeAOT / Mixed-Mode 原生部分。
- `winrev` — Windows 平台生态。
- `packrev` — .NET 加壳 / 保护。
- `malrev` — .NET 恶意样本分析。
- `gamerev` — Unity Mono 层。