---
name: java-jvm-reverse-engineering
description: Java / JVM 逆向工程。.class / .jar / .war / .dex 反编译（JD-GUI / CFR / Procyon / Fernflower / JADX）；字节码指令集（aload / invokevirtual / invokedynamic）；ASM / Javassist / ByteBuddy 字节码改写；ProGuard / R8 / Allatori / ZKM 混淆还原；JNI native 方法桥接分析；Kotlin / Scala / Groovy 编译产物特征；ClassLoader 动态加载 + agent attach；GraalVM Native Image / AOT 逆向。配合 mrev / binrev / packrev 用。
---

# Java / JVM / Kotlin 字节码逆向

## 适用场景

- 反编译 Java .class / .jar / .war 还原源码逻辑。
- 分析 Android APK 中 Java/Kotlin 层（配合 `mrev`）。
- 还原 ProGuard / R8 / 商业混淆器处理后的代码。
- 分析 JNI native 方法与 Java 层的调用关系。
- 对 Java 服务端应用（Spring / Tomcat / JBoss）做安全审计。
- 理解 Kotlin / Scala / Groovy 编译到 JVM 的产物差异。

## 不适用

- Android Native (.so) 逆向 → `binrev` + `mrev`。
- .NET / CLR 逆向 → `dotnetrev`。
- Python / JS / PHP 脚本逆向 → `scriptrev`。

---

## JVM 字节码基础

### Class 文件格式

```text
ClassFile {
    u4             magic;                  // 0xCAFEBABE
    u2             minor_version;
    u2             major_version;          // 52=Java8, 55=Java11, 61=Java17, 65=Java21
    u2             constant_pool_count;
    cp_info        constant_pool[];        // 常量池: 字符串/类名/方法签名/字面量
    u2             access_flags;           // ACC_PUBLIC ACC_FINAL ACC_SUPER ACC_ABSTRACT
    u2             this_class;             // → constant_pool index
    u2             super_class;
    u2             interfaces_count;
    u2             interfaces[];
    u2             fields_count;
    field_info     fields[];
    u2             methods_count;
    method_info    methods[];              // 每个方法含 Code attribute → 字节码
    u2             attributes_count;
    attribute_info attributes[];           // SourceFile / InnerClasses / BootstrapMethods
}

版本号对应:
  Java 8  → 52.0    Java 11 → 55.0    Java 17 → 61.0
  Java 21 → 65.0    Java 22 → 66.0    Java 23 → 67.0
```

### 关键字节码指令

```text
加载/存储:
  aload_0          加载 this (实例方法)
  iload / lload / fload / dload / aload   加载 int/long/float/double/ref
  istore / astore   存储
  iconst_0 .. iconst_5 / bipush / sipush / ldc   常量压栈

算术:
  iadd / isub / imul / idiv / irem
  ladd / lsub / ...
  i2l / i2f / l2d / ...                  类型转换

对象:
  new              分配对象 (不调构造器)
  dup              复制栈顶 (new + dup + invokespecial <init> 三连)
  getfield / putfield                    实例字段
  getstatic / putstatic                  静态字段
  instanceof / checkcast                 类型检查

调用:
  invokevirtual    虚方法 (多态 dispatch)
  invokeinterface  接口方法
  invokespecial    构造器 <init> / super / private
  invokestatic     静态方法
  invokedynamic    动态调用 (lambda / 字符串拼接 / Groovy/Kotlin)

控制流:
  ifeq / ifne / iflt / ifge / ifgt / ifle
  if_icmpeq / if_acmpeq
  goto / goto_w
  tableswitch / lookupswitch
  athrow           抛异常
  *return          返回

数组:
  newarray / anewarray / multianewarray
  aaload / aastore / iaload / iastore
  arraylength
```

### invokedynamic 与 Lambda

```text
invokedynamic 是 Java 7+ 最重要的新指令:
  - Java 8 lambda: 编译为 invokedynamic → LambdaMetafactory.metafactory()
  - 字符串拼接 (Java 9+): "a" + b → invokedynamic → StringConcatFactory
  - Kotlin: 协程 / 委托 / companion
  - Groovy: 所有方法调用都走 invokedynamic

逆向关注:
  BootstrapMethods attribute → 包含 bootstrap method 引用
  lambda 真正的实现在 synthetic 方法: lambda$methodName$0

反编译器对 invokedynamic 的处理:
  CFR / Procyon / Fernflower 都能还原为 lambda 表达式
  但混淆器可能篡改 BootstrapMethods → 需要手动跟踪
```

---

## 反编译工具

### 命令行反编译

```bash
# javap (JDK 自带)
javap -c -p -v MyClass.class              # -c 字节码 -p 含 private -v 详细
javap -c -p -s MyClass.class              # -s 显示内部签名

# CFR (最强通用反编译器)
curl -L -o cfr.jar https://github.com/leibnitz27/cfr/releases/latest/download/cfr.jar
java -jar cfr.jar target.jar --outputdir output/
java -jar cfr.jar MyClass.class
# 特殊选项:
java -jar cfr.jar target.jar --decodelambdas true --decodestringswitch true
java -jar cfr.jar target.jar --removeboilerplate false  # 保留样板代码

# Procyon
java -jar procyon-decompiler.jar target.jar -o output/
java -jar procyon-decompiler.jar MyClass.class

# Fernflower (IntelliJ IDEA 内置, 可独立用)
java -jar fernflower.jar target.jar output/

# JADX (Android DEX + Java, GUI + CLI)
jadx -d output/ target.apk
jadx -d output/ target.jar
jadx-gui target.apk                       # GUI
# JADX 优势: 自动处理 DEX → Java, 支持资源反编译

# Krakatau (精确字节码级)
python3 Krakatau/decompile.py -out output/ -path rt.jar target.jar

# 批量反编译 jar
mkdir -p output
for f in lib/*.jar; do
    echo "==> $f"
    java -jar cfr.jar "$f" --outputdir "output/$(basename $f .jar)/"
done
```

### GUI 工具

```text
JD-GUI:           经典, 速度快, 但对新 Java 特性支持弱
Bytecode Viewer:  集成多反编译器 (CFR/Procyon/FernFlower/JD/Krakatau)
Recaf:            现代 Java 字节码编辑器 + 反编译器
JADX-GUI:         最佳 Android 分析 GUI
IntelliJ IDEA:    自带 Fernflower, 直接打开 .class/.jar
Eclipse:          Enhanced Class Decompiler plugin
```

---

## JAR / WAR / EAR 分析

```bash
# JAR 就是 ZIP
unzip -l target.jar                        # 列出内容
unzip target.jar -d extracted/

# 关键文件
# META-INF/MANIFEST.MF        — 元信息 / Main-Class / Class-Path
# META-INF/*.SF / *.RSA / *.DSA — 签名
# WEB-INF/web.xml              — WAR servlet 配置
# WEB-INF/classes/             — class 文件
# WEB-INF/lib/                 — 依赖 jar

# 找 Main-Class
unzip -p target.jar META-INF/MANIFEST.MF | grep Main-Class

# 搜索特定字符串
unzip -p target.jar '*.class' | strings | grep -i password
# 更精确:
for class in $(unzip -l target.jar | grep '\.class' | awk '{print $4}'); do
    result=$(unzip -p target.jar "$class" | strings | grep -i 'password\|secret\|key\|token')
    [ -n "$result" ] && echo "=== $class ===" && echo "$result"
done

# 依赖分析
jdeps target.jar                           # JDK 自带依赖分析
jdeps -s target.jar                        # 汇总
jdeps --multi-release 17 target.jar        # Multi-Release JAR

# 找安全相关类
jar tf target.jar | grep -iE 'crypto|cipher|key|auth|login|password|token|jwt|session'
```

---

## 混淆还原

### ProGuard / R8

```text
ProGuard 混淆特征:
  - 类名 / 方法名 / 字段名重命名为 a, b, c, ...
  - 但保留:
    * Android Activity / Service / BroadcastReceiver (AndroidManifest 引用)
    * native 方法名
    * Serializable 字段 (serialVersionUID)
    * 反射调用的类 (如果 keep 了)

mapping.txt 格式:
  com.example.MyClass -> a.b.c:
      void myMethod() -> a
      int myField -> b

还原工具:
  - proguard-retrace: 用 mapping.txt 还原栈回溯
  - jadx: 可导入 mapping.txt 自动重命名
  - Recaf: GUI 重命名 + mapping
```

```bash
# 用 mapping.txt 还原
java -jar retrace.jar mapping.txt stacktrace.txt

# JADX 加载 mapping
jadx-gui --deobf --deobf-cfg-file mapping.txt target.apk

# 手动还原思路:
# 1. 从字符串常量推断功能
# 2. 从 API 调用推断 (如 HttpURLConnection → 网络, Cipher → 加密)
# 3. 从 Android Manifest 找未混淆入口
# 4. 从异常信息找原始类名 (有些混淆器保留)
# 5. 从调试信息 / LineNumberTable (如果未 strip)
```

### 商业混淆器

```text
常见商业混淆器:
  Allatori:    字符串加密 + 流程混淆 + 水印
  ZKM (Zelix): 最强: 流程混淆 + 异常混淆 + 引用混淆
  DashO:       PreEmptive Solutions
  Stringer:    字符串加密专项

识别:
  - 类名模式: a.a.a / ㄖㄖ (Unicode 同形字) / 非法标识符 (Kotlin metadata)
  - 字符串解密方法: 所有字符串被 static byte[] → decrypt → new String()
  - 控制流: switch + goto 交错 / 假条件 / 不透明谓词

字符串解密通用方法:
  1. 找到解密方法 (通常是 static String xxx(int) 或 static String xxx(byte[]))
  2. 写 Java agent hook 该方法, 打印入参 + 返回值
  3. 或: 提取解密方法, 用同一 JVM 执行
```

```java
// Java Agent: hook 字符串解密
// agent/StringDecryptHook.java
import java.lang.instrument.*;
import javassist.*;

public class StringDecryptHook {
    public static void premain(String args, Instrumentation inst) {
        inst.addTransformer((loader, name, cls, domain, bytecode) -> {
            if (name == null || !name.startsWith("com/target")) return null;
            try {
                ClassPool pool = ClassPool.getDefault();
                CtClass cc = pool.makeClass(new java.io.ByteArrayInputStream(bytecode));
                for (CtMethod m : cc.getDeclaredMethods()) {
                    // hook 返回 String 的 static 方法
                    if (m.getReturnType().getName().equals("java.lang.String")
                        && Modifier.isStatic(m.getModifiers())) {
                        m.insertAfter(
                            "System.out.println(\"[DECRYPT] \" + $_ );"
                        );
                    }
                }
                return cc.toBytecode();
            } catch (Exception e) { return null; }
        });
    }
}
// java -javaagent:agent.jar -jar target.jar
```

---

## JNI 分析

```text
JNI 方法定位:
  Java 端: native void doSomething(byte[] data);
  Native 端函数名规则:
    Java_com_example_MyClass_doSomething(JNIEnv*, jobject, jbyteArray)

  动态注册 (更常见于混淆场景):
    JNI_OnLoad → RegisterNatives(env, clazz, methods, count)
    methods 数组: {name, signature, fnPtr}

逆向流程:
  1. 在 Java 层找 System.loadLibrary("mylib") → libmylib.so
  2. IDA/Ghidra 打开 .so
  3. 搜索 Java_ 前缀导出函数 (静态注册)
  4. 或找 JNI_OnLoad → RegisterNatives (动态注册)
  5. JNIEnv* 方法表偏移:
     GetStringUTFChars = 0x29C (64-bit)
     NewByteArray = 0x2F0
     GetByteArrayElements = 0x2F8
     CallObjectMethod = 0x1C8
     ...
  6. 导入 jni.h 类型 → 提升反编译可读性
```

```python
# IDA Python: 自动标注 JNI 函数
# 导入 JNI 函数表
jni_funcs = {
    0x18: "GetVersion",
    0x20: "DefineClass",
    0x28: "FindClass",
    0x30: "FromReflectedMethod",
    # ... (完整表 ~230 个偏移)
    0x298: "GetStringUTFLength",
    0x29C: "GetStringUTFChars" if ida_ida.inf_is_64bit() else None,
    0x2A0: "ReleaseStringUTFChars",
}

# 在 IDA 中, JNIEnv* 是第一个参数 (arg0)
# env->FindClass(env, "com/example/MyClass")
# 编译为: call [rdi + 0x28]  (x86_64)
```

---

## 字节码改写

```java
// ASM 框架 (底层, 最灵活)
import org.objectweb.asm.*;
import java.io.*;

public class PatchClass {
    public static void main(String[] args) throws Exception {
        byte[] original = Files.readAllBytes(Path.of("Target.class"));
        ClassReader cr = new ClassReader(original);
        ClassWriter cw = new ClassWriter(cr, ClassWriter.COMPUTE_FRAMES);

        cr.accept(new ClassVisitor(Opcodes.ASM9, cw) {
            @Override
            public MethodVisitor visitMethod(int access, String name,
                    String desc, String sig, String[] exs) {
                MethodVisitor mv = super.visitMethod(access, name, desc, sig, exs);
                if (name.equals("checkLicense")) {
                    // 替换方法体: 直接返回 true
                    return new MethodVisitor(Opcodes.ASM9, mv) {
                        @Override
                        public void visitCode() {
                            mv.visitInsn(Opcodes.ICONST_1);  // push true
                            mv.visitInsn(Opcodes.IRETURN);    // return
                            mv.visitMaxs(1, 1);
                            mv.visitEnd();
                        }
                    };
                }
                return mv;
            }
        }, 0);

        Files.write(Path.of("Target.class"), cw.toByteArray());
    }
}
```

```java
// Javassist (更高层, 可以写 Java 源码)
import javassist.*;

CtClass cc = ClassPool.getDefault().get("com.example.Target");
CtMethod m = cc.getDeclaredMethod("checkLicense");
m.setBody("{ return true; }");            // 直接写 Java
cc.writeFile("output/");

// ByteBuddy (最现代, 类型安全)
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.implementation.FixedValue;
new ByteBuddy()
    .redefine(Target.class)
    .method(named("checkLicense"))
    .intercept(FixedValue.value(true))
    .make()
    .saveIn(new File("output/"));
```

---

## GraalVM Native Image 逆向

```text
GraalVM Native Image = Java AOT 编译为原生二进制
  - 不再是 .class 字节码, 而是 ELF / Mach-O / PE
  - 标准反编译器 (CFR/JADX) 无效
  - 需要 IDA / Ghidra 做原生逆向

特征识别:
  - 字符串: "com.oracle.svm" / "SubstrateVM" / "GraalVM"
  - 入口: 非标准 main, 经过 SubstrateVM 初始化
  - 元数据: reflection-config.json / resource-config.json (如果随附)

分析:
  1. Ghidra / IDA 加载为 ELF/PE
  2. 搜索 Java 类名字符串 → 定位对应编译后的函数
  3. 注意: inlined 方法、编译优化、GC safepoint
  4. 符号: 如果是 debug build, 保留大量 Java 方法签名
```

---

## Kotlin 特殊处理

```text
Kotlin → JVM 编译产物特征:
  - @kotlin.Metadata 注解 (含序列化的类信息)
  - companion object → MyClass$Companion.class
  - data class → copy() / componentN() / toString() / hashCode() / equals()
  - coroutine → ContinuationImpl / BaseContinuationImpl / state machine
  - inline function → 调用点展开, 无独立方法
  - extension function → 静态方法, 第一个参数是 receiver
  - null safety → Intrinsics.checkNotNullParameter() 检查

反编译:
  JADX + Kotlin metadata → 可还原 Kotlin 语法
  CFR: --kotlinstylecolls true
  IntelliJ: 自动识别 Kotlin 类 + 还原
```

---

## 动态分析

```bash
# Java Agent attach (运行时)
# 1. 找目标 PID
jps -v

# 2. attach
# 预编译 agent jar (含 agentmain 方法)
java -cp tools.jar com.sun.tools.attach.VirtualMachine \
    <pid> agent.jar

# jcmd (JDK 自带)
jcmd <pid> VM.flags
jcmd <pid> Thread.print
jcmd <pid> GC.heap_info
jcmd <pid> VM.class_hierarchy

# JFR (Java Flight Recorder)
jcmd <pid> JFR.start duration=60s filename=recording.jfr
jcmd <pid> JFR.dump name=1 filename=dump.jfr
# 分析: JDK Mission Control (jmc)

# 远程 debug
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 -jar target.jar
# IDE: attach to remote JVM :5005

# Frida (hook Java 方法 — Android / Desktop)
# Android:
frida -U -f com.target.app -l hook.js
# hook.js:
# Java.perform(function() {
#     var cls = Java.use("com.target.CryptoUtil");
#     cls.decrypt.implementation = function(data) {
#         console.log("decrypt input: " + data);
#         var result = this.decrypt(data);
#         console.log("decrypt output: " + result);
#         return result;
#     };
# });
```

---

## 实战入口

- **CFR / Procyon / Fernflower** — 三大反编译器对比使用。
- **JADX** — Android Java/Kotlin 逆向首选。
- **Recaf** — 现代字节码编辑器 + 插件生态。
- **Bytecode Viewer** — 多引擎对比。
- **ASM Guide** — asm.ow2.io 官方文档。
- **JVM Specification** — docs.oracle.com/javase/specs/jvms。
- **Inside the JVM** — Artima / Bill Venners。
- **Reverse Engineering for Beginners (RE4B)** — 含 Java 章节。
- **Android RE** — 配合 `mrev` + Frida + Xposed。

## 自检（接到目标 30 分钟内回答）

1. 目标格式？（.class / .jar / .war / .apk / .dex / Native Image）
2. Java 版本？（8 / 11 / 17 / 21）
3. 混淆器？（ProGuard / R8 / Allatori / ZKM / DashO / 无）
4. 有 mapping.txt 吗？
5. 有 JNI native 层吗？
6. 框架？（Spring / Android / 自定义）
7. Kotlin / Scala / Groovy 产物？
8. 动态加载 / 反射 / ClassLoader 技巧？
9. 需要改写 / patch？（ASM / Javassist / Agent）
10. 配合 `mrev`（Android）还是独立分析？

## 相邻技能

- `mrev` — Android 逆向（DEX + Native + 资源）。
- `binrev` — JNI .so 原生库逆向。
- `packrev` — Java 打包 / 加壳分析。
- `dotnetrev` — .NET / CLR 类比技能。
- `scriptrev` — Groovy / Kotlin Script / JSR 223。
- `webrev` — Java Web 应用（Spring / Servlet）安全。
- `vulnrev` — Java 框架漏洞（Log4j / Fastjson / Deserialization）。