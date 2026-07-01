---
name: cpp-development
description: C++ Dev实战排障版 - 面向 C/C++17/20/23/26、GCC/Clang/MSVC、libstdc++/libc++/MSVC STL、CMake Presets/toolchain、vcpkg/Conan、.clang-tidy/.clang-format/compile_commands.json、CTest/add_test、gtest/Catch2、toolchain/triplet/profile/lockfile/baseline、链接符号、ABI/FFI、extern C/opaque handle/native addon、生命周期、并发、ASan/UBSan/TSan/MSan/LSan、C++23/26 feature-test macro 的定位与最小修复。当涉及 .c/.h/.cc/.cpp/.cxx/.hh/.hpp/.hxx、CMakeLists.txt、CMakePresets.json、conanfile、vcpkg.json 或 C/C++ 编译/链接/ABI/内存/并发/跨平台问题时必须使用。
---

# C/C++ 开发

C/C++ 开发（cpp-development，兼容 slug: cpd）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

> 定位：只解决 C++ 语言、工具链、ABI、构建入口和运行时证据能落地的问题；发布、性能、安全、测试、后端架构只做边界联动，不在本技能内泛化接管。
> 铁律：未确认标准/编译器、ABI/平台、构建入口、失败证据前，不改源码语义、构建参数、依赖版本或二进制边界。

## 索引 / 模板 / 矩阵（先填事实，再选场景卡）

### P0 规则索引

- 编译：先拿 compile command、第一条有效诊断、标准/feature-test macro、include 与宏展开；不要用关 warning 代替修复。
- 链接：先看完整 link command、库顺序、符号表、RPATH/RUNPATH/install_name/PATH；undefined symbol 不是 include 问题。
- ABI：记录 stdlib/CRT、_GLIBCXX_USE_CXX11_ABI、/MD /MT、visibility、exception/RTTI、calling convention、Debug iterator、glibc baseline。
- 生命周期：owner/borrow/view/span/iterator/lambda/coroutine frame 必须有生命周期证明；资源默认 RAII。
- 并发：先写 happens-before、shutdown 顺序和 protected invariant；relaxed 不发布数据，TSan 绿灯不证明无竞态。
- CMake：以 target 和 preset 为事实入口；PUBLIC/PRIVATE/INTERFACE 按消费者关系，禁止全局 flags 掩盖局部 target 问题。
- 包管理：vcpkg triplet/baseline/overlay、Conan profile/options/lockfile 决定 ABI；改后 clean configure。
- 测试：先区分单测/集成/ABI/回归/跨平台矩阵；测试命令与关键输出必须可复跑。
- 静态分析：clang-tidy/IWYU/MSVC /analyze/cppcheck 只能补证据，不替代编译、测试、sanitizer。
- sanitizer：ASan/UBSan/TSan/MSan/LSan 按平台分开跑；正源是 LLVM/Clang/compiler-rt，google/sanitizers 仅归档参考。
- FFI：跨语言边界优先 C ABI；extern "C"、opaque handle、create/destroy、异常不穿边界、allocator 成对。
- 低级错门禁：裸 new/delete、悬垂引用、memcpy 非平凡对象、忽略返回码、C API 资源泄漏、全局初始化顺序依赖，一律先拦截再开发。
- 完整开发：新增功能必须同时给 ownership/lifetime、错误路径、构建 target、测试入口、sanitizer/静态分析可跑口径，不能只交业务 happy path。

### 最小事实表（缺项先补证据）

| 事实 | 必填证据 |
|---|---|
| 标准 | `-std=`/`/std:`、`target_compile_features`、C++23/26 feature-test macro |
| 编译器 | GCC/Clang/MSVC 版本、目标架构、生成器、CI lane |
| stdlib | libstdc++/libc++/MSVC STL 版本、GLIBCXX/libc++ deployment/CRT |
| ABI | `_GLIBCXX_USE_CXX11_ABI`、`/MD`/`/MT`、exception/RTTI、visibility、calling convention |
| preset | configure/build/test preset 名称、生成器、cache 清理口径 |
| toolchain | `CMAKE_TOOLCHAIN_FILE`、sysroot、target triple、find root |
| triplet/profile | vcpkg triplet/baseline/overlay，Conan 2 profile/options/settings |
| lock/baseline | `vcpkg.json` baseline、`vcpkg-lock.json`、Conan lockfile/revisions |
| link command | 完整链接命令、库顺序、导出符号、RPATH/RUNPATH/install_name/PATH |
| 测试命令 | CTest/框架命令、sanitizer/debugger 命令、关键输出 |

### 工具矩阵

| 工具 | 用途 | 必查口径 |
|---|---|---|
| CMake | 构建入口/target 关系 | `cmake --preset`、`cmake --build --preset`、cache 关键项 |
| Conan | 二进制依赖 | Conan 2 profile、lockfile、CMakeDeps/CMakeToolchain |
| vcpkg | manifest 依赖 | triplet、baseline、overlay、manifest mode、lockfile |
| clang-tidy | 语义/现代化静态分析 | 分层配置、compile_commands、NOLINT 理由 |
| clang-format | 格式一致性 | 只按项目 `.clang-format`，禁无关大格式化 |
| IWYU | include 边界 | public/private header、导出包 include 泄漏 |
| ASan | OOB/UAF/double free/scope | 与 TSan 分开，注意 allocator/ABI 改变 |
| UBSan | UB 证据 | signed overflow、alignment、vptr、shift 等 |
| TSan | data race 证据 | 不证明无死锁/ABA/逻辑竞态 |
| MSan | 未初始化读取 | 依赖平台和全链路 instrumented runtime |
| LSan | 泄漏 | 进程退出路径、抑制项与平台支持 |
| gdb/lldb | 崩溃/运行时 | backtrace、frame、thread、watchpoint、加载库 |
| CTest | 测试编排 | `ctest --preset`、labels、fixtures、失败日志 |

### CMakePresets / CI preset 模板

- 本地与 CI 共用 `CMakePresets.json`：`configurePresets` 固化 generator、binaryDir、toolchain、cacheVariables；`buildPresets` 绑定 configure；`testPresets` 绑定 CTest 输出。
- CI 必须打印 `cmake --list-presets`、configure/build/test preset 名称、编译器版本、stdlib/CRT、triplet/profile/lockfile。
- 修改 preset/toolchain/triplet/profile/BUILD_SHARED_LIBS/PIC/LTO/sanitizer 后，必须删除旧 build dir 或 clean configure。

### clang-tidy 配置分层

- 根 `.clang-tidy` 放项目基线；子目录只收窄或补充，避免不同 target 隐式冲突。
- checks 分层：bugprone/performance/readability/modernize/cppcoreguidelines 分开启用；禁止为了过 CI 全局 `-*` 或大范围 NOLINT。
- 运行以 `compile_commands.json` 为准；第三方、generated、迁移遗留目录要有明确 exclude 或单独 profile。

### 包管理决策树

- 需要可复现二进制、跨平台 CI、版本锁定：优先 vcpkg manifest + baseline/lockfile 或 Conan 2 profile + lockfile。
- 需要 recipe/options/package id、私有二进制仓库或复杂 ABI 变体：优先 Conan。
- 依赖以 CMake config 包生态、manifest mode、triplet/overlay 管理为主：优先 vcpkg。
- 小型 header-only 或项目内强绑定源码：可用 FetchContent，但必须 pin commit/hash，避免下载时漂移。
- 系统包只适合发行版基线明确场景；必须记录包版本、glibc/libc++/OpenSSL 等 ABI 约束。

### 测试框架选择

- GoogleTest：团队熟悉、mock/fixture/参数化/CI 生态强，适合中大型 C++ 项目。
- Catch2：单头或轻量表达式断言友好，适合库和快速用例；注意编译时间与版本差异。
- doctest：嵌入式/头文件库/低开销用例友好，适合快速单测和示例即测试。
- Boost.Test：已有 Boost 生态或老项目可延续；新项目需权衡依赖重量。
- 不论选择：必须接入 CTest `add_test`、labels、失败日志和 sanitizer/多编译器矩阵。

### C/C++ 混合与 FFI 边界模板

- C header 只暴露稳定 C ABI：`extern "C"`、固定宽度类型、opaque handle、显式 `create/destroy` 或 `alloc/free` 对。
- C++ 异常、STL、template、引用、span/string_view、allocator ownership 不穿 C/FFI 边界；错误转为错误码或 out-param。
- 跨 DLL/so/dylib/语言的分配释放必须同模块成对；调用约定、符号可见性、线程 attach/GIL/运行时版本要写入契约。

### 单技能开发闭环门禁

- 需求入口：先确认要改的是库、服务、CLI、插件、native addon、嵌入式组件还是 FFI shim；不同产物的 ABI、线程、异常和资源边界不能混用。
- 设计入口：先写清 owner/borrow/view、错误模型、线程模型、公共 header/符号影响、构建 target、测试目标；缺任何一项，先补事实而不是直接写实现。
- 实现入口：默认 rule of zero；确有资源所有权才写析构/拷贝/移动，写任一 special member 就复核 rule of five、noexcept move、swap 和异常安全。
- C API 入口：每个 acquire/open/create/init 必须有匹配 release/close/destroy/deinit；失败路径、早返回、异常路径也必须释放。
- 变更入口：改 public header、inline、模板、宏、layout、序列化、导出符号、CMake install/export 前，必须搜消费者并说明 ABI/ODR 影响。
- 并发入口：先定义 protected invariant、锁顺序、happens-before、线程退出和回调注销；禁止先写线程再靠 TSan 碰运气。
- 构建入口：所有 include、compile definition、link library、warning、sanitizer、PIC/LTO/visibility 都落到 target；禁止用目录级全局状态污染无关 target。
- 验收入口：至少给编译、CTest 或等价测试、关键 sanitizer/静态分析、目标平台差异说明；未跑项必须明示未验证。

### 硬禁止与低级错拦截

- 禁止业务代码直接裸 new/delete、malloc/free、fopen/fclose、pthread_create/pthread_join 后散落释放；除非封装 RAII wrapper 并覆盖失败路径。
- 禁止返回或保存指向局部对象、临时对象、moved-from 对象、reallocated 容器、栈 coroutine frame 的引用、指针、string_view、span、iterator。
- 禁止对非 trivially copyable 对象用 memcpy/memmove/memset 做拷贝、移动、清零或序列化；先查 type trait、构造析构和 padding。
- 禁止忽略系统调用、C API、IO、线程、锁、内存分配、编码转换、解析器返回码；错误必须进入日志、返回值、异常或恢复路径。
- 禁止跨 DLL/so/dylib/CRT/语言传递 ownership 不明裸指针；分配释放必须同模块成对，或用显式 opaque handle 契约。
- 禁止全局对象初始化依赖另一个 translation unit 的初始化顺序；改用函数局部静态、显式 init/shutdown 或依赖注入。
- 禁止把 debug 构建、单平台、单编译器、无优化、无 sanitizer 的结果当成发布结论；Release/O2/LTO/目标架构至少列验证状态。
- 禁止为通过 CI 关闭 warning、扩大 NOLINT、suppress sanitizer、跳过 tests、复制动态库或改 PATH；先定位根因。
- 禁止在持锁期间调用未知回调、外部 IO、跨语言调用、析构复杂对象；先缩小锁范围并写明不变量。
- 禁止把 C struct layout、enum size、bitfield、padding、endianness 当网络/文件/共享内存稳定协议；必须显式编码 schema。

### 版本与平台矩阵（结论只覆盖已验证格）

| 维度 | 最小记录 |
|---|---|
| GCC | major.minor、libstdc++、GLIBCXX symbol version、dual ABI |
| Clang | major.minor、libc++/libstdc++、compiler-rt、deployment target |
| MSVC | toolset 版本、MSVC STL、CRT `/MD`/`/MT`、Windows SDK |
| CMake | 最低版本、Presets schema、生成器、modules/BMI 支持 |
| Conan | Conan 2 版本、profile、lockfile、settings/options/revisions |
| vcpkg | baseline、triplet、overlay、manifest/lockfile、binary cache |
| sanitizer 平台 | Linux/macOS/Windows 支持差异；ASan/UBSan/TSan/MSan/LSan 分开标可用性 |

## 快速总则：标准/编译器 / ABI/平台 / 构建入口 / 证据

1. 标准/编译器先行：记录 -std 或 /std、GCC/Clang/MSVC 版本、libstdc++/libc++/MSVC STL、feature-test macro、warning/error 原文；C++20 默认可用，C++23/26 必须逐特性验证实现进度。
2. ABI/平台先行：记录 Windows/Linux/macOS、x86_64/arm64、glibc/musl/UCRT、/MD /MT、_GLIBCXX_USE_CXX11_ABI、exception/RTTI、visibility、calling convention、Debug/Release 和优化级别。
3. 构建入口先行：以 CMakePresets.json、toolchain file、vcpkg triplet、Conan 2 profile/lockfile、CMake target、生成器、link command 为事实入口；禁止只看 IDE 面板或本机 cache。
4. 证据先行：结论绑定编译诊断、完整构建命令、符号表、loader 日志、core dump、ASan/UBSan/TSan、gdb/lldb、最小复现或测试输出；未跑不报。
5. 改 public header、template、inline、宏、enum、constexpr、module interface、导出符号前，先搜全量源码调用方和二进制消费者。
6. 资源默认 RAII；裸指针、引用、string_view、span、iterator、lambda 捕获、coroutine frame、回调注册都必须证明 owner 与 lifetime。
7. 并发默认先写 happens-before；atomic memory_order、condition_variable 谓词、jthread stop_token、析构 shutdown 顺序必须可解释。
8. UB、ODR、ABI drift、data race、iterator invalidation、strict aliasing、alignment、signed overflow、跨 DLL 分配释放默认高风险。
9. 构建默认 target-based CMake；PUBLIC/PRIVATE/INTERFACE 按消费者关系给，禁止用全局 flags 掩盖局部 target 问题。
10. C++ 结论只覆盖已验证平台和工具链；跨平台、跨标准库、跨包管理器必须列未验证项。

## 场景执行卡

### 1. 标准、编译器与库实现差异

- 适用：升级 C++20/23/26、CI 与本地不同、模板错误、标准库 API 不存在。
- 输入：-std 或 /std、编译器版本、stdlib、feature-test macro、目标平台、CMake compile_features、失败诊断。
- 动作：区分语言特性与标准库特性；查 __cpp_* 宏和库版本；C++23 的 print/format/ranges/mdspan/expected、C++26 的 constexpr 扩展和 contracts 草案状态必须逐项验证。
- 证据：compiler --version、预处理宏、最小复现、CI lane、CMake target_compile_features 输出。
- 兜底：实现进度不明时保留旧语义或加 feature gate，不直接全局升标准。

### 2. CMake Presets、toolchain、vcpkg、Conan

- 适用：找不到依赖、链接错库、交叉编译失败、Debug/Release 依赖混用。
- 输入：CMakePresets.json、CMakeUserPresets.json、toolchain file、vcpkg.json/triplet、conanfile、profile、lockfile、cache、生成器。
- 动作：确认 configure 与 build preset；检查 CMAKE_TOOLCHAIN_FILE、CMAKE_PREFIX_PATH、find_package config/module 模式、Conan CMakeDeps/CMakeToolchain、vcpkg manifest mode。
- 证据：cmake --preset、cmake --build --preset、CMakeCache.txt 关键项、依赖 lock/profile/triplet、实际 imported target。
- 兜底：改 triplet/profile/toolchain/BUILD_SHARED_LIBS/PIC/LTO/sanitizer 后必须 clean configure，禁止复用旧 cache 得结论。

### 3. 编译、模板、concepts、constexpr 诊断

- 先分预处理、编译、汇编、归档、链接、运行时加载；不要把 undefined symbol 当 include 问题修。
- 模板错误从第一条有效诊断和最小复现入手；检查 dependent name、ADL、SFINAE、requires、concepts、CTAD、隐式转换。
- constexpr/consteval/constinit 问题要区分常量求值规则、生命周期、动态分配限制、ODR-use 和编译器 bug。
- warning policy 要保留项目约定；不得为通过编译直接关闭 -Wall/-Wextra/-Werror 或 /WX。

### 4. 链接符号、ODR、ABI 与动态加载

- 输入完整 link command、库顺序、静态/动态库、符号表、导出表、RPATH/RUNPATH、install_name、PATH、LD_LIBRARY_PATH、DYLD_*。
- libstdc++ 关注 dual ABI、GLIBCXX symbol version、visibility、PIC；libc++ 关注 deployment target 与 dylib；MSVC 关注 /MD /MT、/EH、/GR、PDB、__declspec。
- 公共 ABI 不暴露 STL、模板、异常、allocator、inline 布局；跨边界分配释放必须同模块或成对 C API。
- ODR 排查看重复对象、inline 变量、template 实例化、宏导致结构体布局差异、LTO 合并后的符号变化。

### 5. 生命周期、RAII、移动语义与异常安全

- 明确 owner：unique_ptr 独占，shared_ptr 仅真实共享，weak_ptr 断环，引用/指针/view/span 默认借用不延寿。
- 移动后对象只保证可析构和可赋值；接口不得依赖 moved-from 业务值。
- lambda 捕获 this、引用、iterator、string_view、span 进入异步、线程、回调、coroutine 前必须证明生命周期覆盖。
- 异常安全按 no-throw/basic/strong commit 语义说明；析构、move、swap、deallocator 不得抛异常破坏容器或边界。

### 6. STL、ranges、views、modules 与头文件边界

- vector/string/deque/unordered_map 的扩容、erase、rehash 会让 iterator/reference/pointer 失效；输出需说明具体容器规则。
- ranges/views 常是惰性借用；filter/transform/take、subrange、string_view 不能保存指向临时或被修改容器的 view。
- modules/header units 仍受编译器、CMake、BMI cache、宏和包管理器影响；公共迁移先小 target 试点。
- 头文件要最小 include、稳定宏边界、extern "C" 只用于 C ABI；不要让 private 依赖泄漏到安装包。

### 7. 协程、异步与线程内存模型

- coroutine 不是线程；必须确认 executor、恢复线程、promise_type、exception、cancellation、frame ownership。
- co_await 前后的 this、引用、栈对象、view、锁、事务必须证明不会悬垂、死锁或跨线程非法访问。
- condition_variable 必须 while 谓词；atomic relaxed 不发布数据；release/acquire/seq_cst 要写明保护的不变量。
- TSan 能抓部分 data race，不证明无死锁、无 ABA、无逻辑竞态；ASan 与 TSan 分开跑。

### 8. sanitizer、debugger、core 与最小复现

- ASan：越界、UAF、double free、use-after-scope；UBSan：未定义行为；TSan：data race；MSan/HWASan/LSan 按平台可用性决定。
- gdb/lldb 证据至少包括 backtrace、frame、thread、watchpoint 或 disassemble 中的关键输出；core dump 要保留符号和加载库列表。
- sanitizer 构建改变 ABI、优化、allocator、时序；生产性能或竞态结论必须在非 sanitizer 构建复测。
- Valgrind 主要用于 Linux 内存证据；macOS/Windows/新指令集支持有限，不能把工具不可用当无泄漏。

### 9. 跨平台路径、编码、文件系统与交叉编译

- Windows 路径、宽字符、UTF-16、大小写、MAX_PATH、DLL 搜索路径与 POSIX 差异要单独验证。
- Linux 关注 glibc baseline、musl、rpath、container runtime；macOS 关注 universal binary、deployment target、install_name、codesign。
- filesystem、locale、time zone、endianness、word size、alignment、SIMD、thread scheduling 都可能改变结果。
- 交叉编译用 toolchain file、sysroot、target triple、find root；try_run 不可用时要改为可复核的 try_compile 口径。

### 10. LTO、PGO、优化级别与可观测性边界

- -O0 通过 -O2 崩溃优先查 UB、未初始化、aliasing、lifetime、data race、ODR 和 ABI；不先 blame 编译器。
- LTO/ThinLTO/PGO 会改变 inline、visibility、dead stripping、符号、栈和调试体验；插件/反射/动态加载需额外验证。
- 性能优化只交给 pfe 做指标与 benchmark；本技能只确认 C++ 语义、编译参数和 UB 风险。


### 11. FFI、Native Addon 与跨语言边界

- 适用：pybind11/CPython、JNI、Rust/Go/C# FFI、Node addon、C SDK、plugin ABI、第三方二进制 SDK。
- 输入：边界签名、调用约定、ownership transfer、allocator/deallocator、异常/错误码策略、线程 attach/GIL、生命周期图和目标语言运行时版本。
- 动作：跨语言边界优先收敛为 C ABI 或稳定 shim；异常不得穿越 FFI；STL/template/view/span/引用默认不跨边界；释放函数必须与分配模块成对。
- 证据：导出符号、header/def/module map、最小跨语言调用、崩溃栈、运行时加载路径和 sanitizer/debugger 输出。

### 12. Allocator、PMR、对齐与 SIMD

- custom allocator、std::pmr、重载 new/delete、jemalloc/tcmalloc/mimalloc、aligned allocation 必须说明分配/释放配对、alignment、线程安全和模块边界。
- SIMD/硬件 intrinsic 先确认 ISA、编译 flag、运行时 CPU dispatch、对齐要求和 fallback；禁止把开发机指令集当生产全集。
- 跨 DLL/so/dylib、跨 CRT、跨语言传递 ownership 时，必须提供同模块 destroy/free API 或显式 no-ownership 契约。

### 13. 序列化、协议与持久化兼容

- 禁止直接把 C++ struct layout 当稳定文件/网络协议；padding、endianness、alignment、enum size、bitfield、compiler packing 都必须验证。
- protobuf/flatbuffers/capnproto/thrift 等 schema 变更先查兼容策略、字段编号、默认值、未知字段、版本迁移和回滚读写。
- 修改持久化或线协议前，必须列老数据、老客户端、灰度双写双读和回滚验证；C++ 技能只给布局和解析安全证据，发布策略联动 rls。

### 14. 静态分析、格式化与生成代码

- clang-tidy、MSVC /analyze、cppcheck、PVS-Studio、CodeQL/Semgrep C++ 可作为补充证据，但不得替代编译、测试、sanitizer 或最小复现。
- clang-format/include-what-you-use 只按项目既有配置执行；不得为单点修复大面积格式化无关代码。
- generated、protobuf/thrift/openapi、Qt moc/uic/rcc、Bison/Flex、ANTLR、CMake custom command 输出默认禁直改；先找 schema、模板、生成命令、BYPRODUCTS/depfile 和构建图依赖。

### 15. Fuzz、ABI 演进与库维护

- 解析器、压缩/图片/音视频、协议、反序列化、正则/表达式、跨信任边界输入必须考虑 libFuzzer/AFL++/honggfuzz 或既有 corpus；未跑标未验证。
- 公共库改 header、inline、symbol、布局、异常规格、allocator、namespace、visibility 前，补 ABI diff 或消费者重编译证据。
- 对外二进制兼容优先使用 PIMPL、C shim、symbol version、deprecation window 和 ABI compatibility CI；破坏性变更必须给回滚边界。

### 16. Hardening、嵌入式/实时与崩溃产物

- C++ 内存安全输入面需记录 hardening 状态：stack protector、FORTIFY、PIE/RELRO、CFI/CET/CFG、SafeSEH、visibility 和 strip/debug symbol 策略；漏洞归 dso 联动。
- embedded/RTOS/游戏/实时场景先确认 exceptions/RTTI/heap/threading 可用性、frame budget、determinism、cross toolchain、MISRA/AUTOSAR 或引擎约束。
- 生产崩溃需保留 dSYM/PDB/split DWARF、build-id、symbol server、minidump/Crashpad/Breakpad、source path remap；无符号栈不得下根因结论。

### 17. 真实开发交付与验收证据

- 新增模块必须同时落地：target、public/private header 边界、错误处理、资源释放、测试注册、sanitizer 可配置入口和安装/导出影响说明。
- 修改业务逻辑必须覆盖：正常路径、错误路径、边界输入、资源失败、并发 shutdown、跨平台差异；解析器和外部输入要补 fuzz 或 corpus 说明。
- 修改构建依赖必须覆盖：lock/baseline/profile/triplet、clean configure、Debug/Release、静态/动态、目标平台 loader 路径。
- 修改 ABI/FFI 必须覆盖：导出符号、calling convention、ownership transfer、allocator pairing、异常/错误码转换、最小跨语言调用。
- 发布前输出必须能让审计者复跑：命令、target、preset、编译器版本、关键日志、失败/成功摘要、未验证矩阵。

## 高频坑 / 防遗漏

- 未记录 -std、编译器、stdlib、平台和 preset 就改代码。
- 只有业务实现，没有 owner/lifetime、错误路径、构建 target、测试和 sanitizer 证据。
- 裸 new/delete、C API handle、FILE/socket/thread/mutex 分散在多个 return 分支里。
- 函数返回引用、string_view、span、iterator，却没证明 owner 活得更久。
- 对有构造/析构/虚表/指针成员的对象 memcpy 或 memset。
- 忽略 errno、GetLastError、返回码、短读短写和 partial write。
- 全局单例互相依赖初始化顺序，测试正常、生产随机崩。
- 持锁调用用户回调、插件、FFI、日志 sink 或网络 IO。
- 用本机 CMake cache 推断 CI 入口。
- C++23 语法能编过，但标准库组件在目标 stdlib 不可用。
- include 顺序变化掩盖宏污染、ADL 或 ODR 问题。
- PUBLIC/PRIVATE/INTERFACE 写错，导致消费者缺 include、宏或 link flags。
- /MD /MT、_GLIBCXX_USE_CXX11_ABI、Debug iterator、visibility 变化导致 ABI 漂移。
- string_view/span/ranges view 指向临时或被 reallocate 的容器。
- moved-from 对象被当作仍含业务值。
- relaxed atomic 被当成发布同步。
- sanitizer 绿灯被当作生产无风险，TSan 绿灯被当作无并发 bug。
- Makefile/CMake 并行构建偶现，实际是生成文件依赖漏写。
- Windows 路径编码和 DLL 搜索路径只在用户机器爆炸。

## 输出要求

- 必须给：标准/编译器、ABI/平台、构建入口、证据、影响面、改动清单、验证命令和关键输出；涉及 FFI/allocator/序列化/生成代码/公共 ABI/生产崩溃时，追加边界契约、兼容策略、生成来源或符号产物证据。
- 新增/修改功能：必须给 owner/lifetime、错误路径、资源释放、thread/shutdown、target/test/sanitizer 入口和未验证项。
- 编译问题：列第一条有效诊断、最小复现、目标 target、compile command、相关宏和 include/feature 结论。
- 链接/ABI：列 link command、符号证据、库顺序、导出/加载路径、stdlib/CRT、兼容结论和回滚边界。
- 生命周期/并发：列 owner、borrow、happens-before、shutdown、sanitizer/debugger/测试证据。
- 构建依赖：列 preset、toolchain、profile/triplet/lockfile、cache 清理口径、实际 imported target。
- 未验证项必须写“未验证”，不得包装成已完成。

## 约束

- 禁止无证据升级 C++ 标准、替换编译器/stdlib、切 ABI、换包管理器或全局改 flags。
- 禁止裸 new/delete、悬垂引用、memcpy 非平凡对象、忽略返回码、C API 资源泄漏、全局初始化顺序依赖进入最终方案。
- 禁止用关闭 warning、suppress sanitizer、复制动态库到目录来替代根因定位。
- 禁止跨 ABI 传 STL/template/异常/ownership 不明裸指针，禁止跨模块错配分配释放。
- 禁止凭“本机复现不了”降低 UB、ODR、data race、ABI 问题优先级。
- 禁止把发布工程、性能工程、安全审计、测试工程职责搬入本技能；只给 C++ 风险证据和联动条件。

## 高频 Bug 反例库

- 反例 1：错法：编译通过就认为没有 UB；对法：用 UBSan/ASan、优化级别和最小复现验证；根因：C++ UB 可被优化器放大且不保证稳定表现。
- 反例 2：错法：ASan 绿灯就认为内存安全；对法：补路径覆盖、UBSan/TSan/Valgrind 或代码审查；根因：ASan 不覆盖所有路径、data race 和 ABI。
- 反例 3：错法：atomic relaxed 当作线程间发布；对法：建立 release/acquire 或锁保护的不变量；根因：relaxed 只保证单对象原子性，不建立 happens-before。
- 反例 4：错法：shared_ptr 管理对象就线程安全；对法：对象状态仍用锁、atomic 或消息传递；根因：控制块线程安全不等于对象内部状态安全。
- 反例 5：错法：返回 string_view/span 指向临时更高效；对法：返回 owning string/vector 或保证 owner 外部存活；根因：view/span 不延长生命周期。
- 反例 6：错法：vector push_back 后旧指针仍可用；对法：扩容后重新获取 iterator/reference/pointer；根因：reallocation 使旧地址失效。
- 反例 7：错法：moved-from 对象继续按业务值使用；对法：只析构、赋新值或按文档允许状态使用；根因：移动后状态有效但未指定。
- 反例 8：错法：CMake include_directories 全局加路径最快；对法：target_include_directories 按 PUBLIC/PRIVATE/INTERFACE 声明；根因：目录级污染会改变无关 target 和消费者 ABI。
- 反例 9：错法：Conan/vcpkg 只是下载依赖；对法：锁定 profile、triplet、options、toolchain 和 lockfile；根因：这些输入决定 ABI、链接和二进制兼容。
- 反例 10：错法：TSan 没报就没有并发 bug；对法：补 happens-before 推导、压力测试和 shutdown 覆盖；根因：TSan 覆盖有限且不证明无死锁/ABA/逻辑竞态。
- 反例 11：错法：undefined symbol 通过加 include 修；对法：看 link command、库顺序、导出符号和 ABI；根因：链接失败发生在符号解析，不是编译可见性问题。
- 反例 12：错法：只改 private struct 不影响 ABI；对法：查 header、inline、sizeof、layout、序列化、PIMPL 边界；根因：布局和 inline 可被消费者编译进二进制。
- 反例 13：错法：动态库找不到就复制到可执行目录；对法：定位 RPATH/RUNPATH、install_name、PATH、loader policy；根因：运行时加载路径是发布契约的一部分。
- 反例 14：错法：C++23 在本机能编就全项目开启；对法：按编译器和 stdlib 支持矩阵 feature gate；根因：语言模式与标准库实现进度不同步。
- 反例 15：错法：ranges view 保存下来等同容器；对法：只在 owner 生命周期内消费或 materialize；根因：view 多为惰性借用，易悬垂。
- 反例 16：错法：协程里捕获引用跨 co_await；对法：复制值或让 owner 覆盖 frame 生命周期；根因：恢复点之后栈/对象可能已销毁或换线程。
- 反例 17：错法：新增对象直接裸 new 后多处分支 delete；对法：用 RAII、unique_ptr 或专门 handle wrapper 收口；根因：异常、早返回和错误路径会漏释放或 double free。
- 反例 18：错法：为了性能返回局部 string 的 string_view；对法：返回 owning string 或要求 caller 传入稳定 buffer；根因：局部对象离开作用域后 view 立刻悬垂。
- 反例 19：错法：memcpy 一个含 std::string/vector/虚函数的结构体；对法：使用构造、赋值、序列化函数或 trivially copyable 校验；根因：对象内部指针和不变量被字节复制破坏。
- 反例 20：错法：C API open/init 失败只打印日志继续跑；对法：检查返回码并转换为明确错误路径；根因：未初始化 handle 后续会变成 UB、崩溃或数据损坏。
- 反例 21：错法：跨 DLL 返回 STL 容器并由调用方 delete；对法：改为 opaque handle、C API buffer 或同模块 destroy；根因：CRT、allocator、ABI 和异常模型可能不一致。
- 反例 22：错法：全局 logger/config/socket 构造时访问另一个全局对象；对法：函数局部静态或显式 init 顺序；根因：跨 translation unit 初始化顺序未定义。
- 反例 23：错法：CMake 为了修一个 target 全局 add_definitions/add_compile_options；对法：落到目标 target 并标明 PUBLIC/PRIVATE/INTERFACE；根因：全局状态会污染依赖、ABI 和 CI。
- 反例 24：错法：TSan 报告 data race 后只加一把大锁；对法：定义保护不变量、锁顺序和 shutdown，再用测试验证；根因：症状补锁可能引入死锁或隐藏生命周期问题。
- 反例 25：错法：catch (...) 后吞掉异常让 C ABI 看起来成功；对法：转错误码、记录边界错误并释放资源；根因：跨 FFI 的错误语义丢失会导致上层继续使用坏状态。
- 反例 26：错法：只在 Linux GCC Debug 验证就声明跨平台完成；对法：列 Windows/MSVC、macOS/Clang、Release/O2、sanitizer 支持矩阵；根因：CRT、stdlib、路径、loader 和优化都会改变结果。
- 反例 27：错法：解析器新增分支只跑一个样例；对法：补边界样本、旧 corpus、fuzz 或最小回归集；根因：C/C++ 解析入口最容易出现 OOB、整数溢出和未初始化读取。
- 反例 28：错法：忽略 write/send/read 的短读短写和 EINTR/EAGAIN；对法：循环处理 partial result、错误码和超时；根因：系统调用成功不等于完成全部业务字节。

## 提交前自检清单

- [ ] 标准/编译器、ABI/平台、构建入口、失败/成功证据已记录。
- [ ] public header、template、inline、宏、enum、module interface、符号和二进制消费者已搜全。
- [ ] CMake preset、toolchain、Conan/vcpkg profile/triplet/lockfile 与 cache 清理口径明确。
- [ ] ownership、lifetime、RAII、move、exception safety、ranges/view、coroutine frame 已复核。
- [ ] link command、库顺序、stdlib/CRT、RPATH/RUNPATH、导出符号、ABI 兼容已说明。
- [ ] ASan/UBSan/TSan、gdb/lldb、core、最小复现或测试有真实命令产出；未跑项已标未验证。
- [ ] 裸 new/delete、悬垂引用、memcpy 非平凡对象、忽略返回码、C API 资源泄漏、全局初始化顺序依赖已逐项排除或说明。
- [ ] FFI/native addon/plugin 边界的 ownership、allocator、calling convention、异常转换、线程 attach 和 destroy/free 契约已写清。
- [ ] Windows/Linux/macOS、GCC/Clang/MSVC、Debug/Release、sanitizer 支持差异已列验证矩阵或未验证项。
- [ ] 性能、发布、安全、测试只保留 C++ 证据，并按边界联动相邻技能。

## 2024-2026 新坑速查

- C++23/26 支持呈“编译器语法先行、标准库滞后”；expected、print、format、mdspan、flat_*、generator、constexpr 容器能力必须按目标 stdlib 查宏和 CI。
- GCC 14/15、Clang 18/19、MSVC 19.4x 的 modules、coroutines、ranges、constexpr 诊断差异仍大；不要跨编译器复用单一结论。
- CMake Presets 成为 IDE/CI 事实入口；CMake 3.28+ modules 扫描、Ninja/MSBuild 生成器和 BMI cache 对 public modules 影响大。
- Conan 2 recipe/profile/lockfile 与 vcpkg manifest/baseline/triplet/overlay 共同决定二进制；缺 lock/baseline 会让 CI 非确定。
- Apple Silicon、Windows ARM64、Linux glibc baseline/musl 差异更常见；发布前要验证目标架构而非只验证开发机。
- Sanitizer 支持矩阵继续分裂：Windows ASan 可用但 TSan/MSan 受限，Apple TSan/ASan 行为与 Linux 不同，HWASan 依赖平台。
- LTO/ThinLTO/PGO 与 CFI/CET/hardening 会改变符号、inline、栈、插件 ABI 和崩溃可观测性。
- libstdc++ dual ABI、GLIBCXX symbol version、MSVC CRT、libc++ deployment target 仍是预编译包常见炸点。
- UTF-8 源码、char8_t、filesystem path、Windows 控制台/宽字符边界在跨平台项目中更易暴露。
- AI 生成 C++ 常漏 lifetime、exception safety、ODR、allocator 和 memory_order；必须按证据复核而非按语法可读性接受。

## 与相邻技能的边界

- cmake-build：manifest 中缺失；若未来存在，CMake 架构、preset 组织、包导出策略归其负责，本技能保留 C++ target/ABI/符号证据。
- 测试验证/test-engineering（tst）：测试矩阵、回归策略、CI lane、flaky、覆盖率、fuzz 编排归测试工程；本技能提供 sanitizer、ABI、lifetime、并发风险点。
- 代码审计/code-audit（aud）：最终需求对账、影响面、安全质量复核和上线边界归代码审计；本技能输出可审计的 C++ 证据。
- 发布部署/release-engineering（rls）：artifact、签名、SBOM、灰度、回滚、线上验证归发布工程；本技能只说明 ABI、runtime、符号和包管理风险。
- 性能工程/perf-engineering（pfe）：benchmark、profile、容量、性能回归门槛归性能工程；本技能只排除 UB、优化级别、LTO/PGO 与编译参数误伤。
- 后端工程/backend-engineering（be）：服务分层、API/DB/cache/queue、可观测性归后端工程；本技能处理 native addon、C++ 服务进程内资源和 ABI。
- Web 安全/web-security（wsec）：授权范围、OWASP、漏洞复现与安全验收归 Web 安全；本技能只处理 C++ 输入解析、内存安全、FFI 和 native 边界证据。
