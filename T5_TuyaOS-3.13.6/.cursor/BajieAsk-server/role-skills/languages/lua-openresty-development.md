---
name: lua-openresty-development
description: Lua 资深开发与自动化实战排障版。覆盖 Lua 5.1/5.2/5.3/5.4、Lua 5.5 开发分支前瞻兼容警示、LuaJIT、OpenResty/Kong/Nginx phases、Redis Lua/Functions、Neovim/Hammerspoon/wezterm、love2d/游戏/嵌入式宿主、C API/ABI、LuaJIT FFI、coroutine 协程、table/nil/metatable、require/package.path/package.cpath、LuaRocks/rockspec/rocktree、GC/内存/性能、热更新、沙箱、合法自动化脚本、错误处理、日志、兼容性与发布回滚风险。
triggers:
  - .lua
  - init.lua
  - wezterm.lua
  - nginx.conf
  - rockspec
  - hererocks
  - lua-language-server
  - love2d
  - kong plugin
  - lapis
  - luau
  - lazy.nvim
  - vim.pack
  - test-nginx
  - OpenResty
  - LuaJIT
  - Redis Lua
---

# Lua/OpenResty 开发

Lua/OpenResty 开发（lua-openresty-development，兼容 slug: luad）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

> 定位：把 Lua 语言、运行时、宿主环境和发布风险串成可复核闭环：版本/环境/入口/证据 → 场景执行卡 → 高频坑/防遗漏 → 输出要求 → 约束 → 高频 Bug 反例库 → 提交前自检清单 → 2024-2026 新坑速查 → 与相邻技能边界。
> 铁律：Lua 问题先判运行时和宿主；未确认 Lua/LuaJIT/OpenResty/Redis/Neovim/嵌入式环境前，不改语法、不判兼容、不宣称已修复。

## 快速总则（版本 / 宿主 / 入口 / 证据）

1. 版本先行：记录 Lua 5.1/5.2/5.3/5.4、Lua 5.5 开发分支/前瞻兼容状态、LuaJIT 2.x、Redis Lua 5.1、OpenResty LuaJIT、Neovim LuaJIT、Hammerspoon/wezterm 版本；确认 `_VERSION`、`jit.version`、宿主构建参数。Lua 5.5 只作开发分支观察和兼容预警，不默认作为生产基线。
2. 宿主先行：记录标准 lua/luajit、OpenResty worker、Redis standalone/cluster/functions、Neovim/Hammerspoon/wezterm、Unity/XLua、Unreal/Slua、Cocos、Roblox/Luau、固件/嵌入式、C/C++ embedding，以及平台、CPU 架构、LuaRocks tree、C 编译器和动态库路径。
3. 入口先行：列清脚本入口、require 模块入口、Nginx phase、Redis EVAL/FCALL、Neovim init.lua、嵌入式 host 回调、热更新加载器、定时任务和发布脚本。
4. 证据先行：必须有复现命令、日志、traceback、错误堆栈、Nginx error.log/access.log、Redis SLOWLOG、内存曲线、性能基线或最小复现；无证据只能标“需验证”。
5. 兼容先行：同一段 Lua 代码不能默认跨 5.1/5.3/5.4/LuaJIT 可跑；整数、浮点、位运算、utf8、`goto`、`<const>`、`<close>`、`table.unpack/unpack`、`bit/bit32` 必核。
6. 副作用隔离：IO、网络、文件、FFI、C API、设备、Redis/Nginx 调用必须有错误处理、超时、日志和可回滚路径。合法自动化只处理自有设备、自有账号、授权测试/运维；绕过风控、批量养号、未授权采集或隐私侵犯需求停止并联动安全/法务。
7. 模块隔离：默认 local；模块 return table；禁止污染 `_G`/`_ENV`；热更新必须说明 package.loaded、状态迁移和回滚策略。
8. 数据安全：nil、table 稀疏数组、metatable、协程状态、共享字典、Redis key、沙箱白名单都要按数据流审计。

## 场景执行卡

### 1. Lua 版本与兼容性排障

- 适用：语法报错、线上只在某宿主失败、LuaJIT 与标准 Lua 行为差异、跨平台兼容。
- 输入：报错文本、Lua 版本、宿主版本、平台、入口、依赖模块、最小复现。
- 动作：先跑版本探针；再核语法特性、标准库差异、字节码兼容、C 模块 ABI、package.path/package.cpath；最后给兼容垫片或版本锁定。
- 证据：版本输出、复现片段位置、兼容矩阵、失败与修复后日志。
- 兜底：无法确认运行时就不改语法；只给待验证清单。

### 2. 版本差异决策卡

- Lua 5.1/LuaJIT/Redis Lua/多数 OpenResty/Neovim：禁用 5.3+ 整数语义、原生位运算、utf8 默认库、`<const>`、`<close>`；优先兼容写法或宿主提供库。
- Lua 5.2：核 `_ENV`、load 环境参数、__pairs、__len 行为；迁移 5.1 时确认 setfenv/getfenv 替代。
- Lua 5.3：核整数/浮点边界、`//`、按位运算、string.pack/unpack；避免让 5.1/LuaJIT 路径误用。
- Lua 5.4：核 generational/incremental GC 切换、to-be-closed 变量、`__close` 资源释放顺序、`<const>` 只读局部和 finalizer 时机。
- Lua 5.5：按开发分支/前瞻兼容处理；只用于提前发现语法、标准库、C API、GC 或构建变化，不把 5.5 当默认生产基线，生产建议锁定稳定版并保留回退。
- LuaJIT：按 5.1 语义处理，确认 bit/ffi/jit 可用性、GC64、ARM64、NYI 和宿主禁用 JIT 情况。
- 决策：目标宿主固定时锁版本；多宿主发布时列“可用语法/库、兼容垫片、禁止项、测试矩阵”。

### 3. 模块、require 与路径加载

- 适用：module not found、加载错版本、循环依赖、热更新后旧代码仍生效。
- 动作：检查 require 名称到文件路径映射、package.path、package.cpath、LUA_PATH、LUA_CPATH、工作目录、package.loaded 缓存、LuaRocks tree、rockspec 安装位置、C 模块架构/ABI；循环依赖拆成纯数据或延迟加载。
- 包管理：rockspec 必查 dependencies、build_dependencies、test_dependencies、external_dependencies；记录 rocktree、LUA_PATH、LUA_CPATH、私有 rocks server、lock/vendor、离线包、交叉编译与 hererocks/asdf/luaver 版本。
- 证据：实际搜索路径、命中模块绝对路径、rockspec 依赖解析、rocktree、lock/vendor 产物、package.loaded 状态、热更新前后版本号。
- 高频风险：本地开发路径优先级高于发布路径；LuaRocks C 模块后缀、Lua ABI、glibc/musl、macOS arm64/x86_64 架构不匹配；package 搜索路径投毒。

### 4. nil、table、metatable 与数据结构

- 适用：attempt to index nil、序列化空数组/对象错、缓存穿透、元方法异常。
- 动作：区分 nil、false、空字符串、ngx.null、cjson.null；数组必须连续，稀疏 table 禁用 `#t` 判断长度；metatable 修改要查 __index/__newindex/__pairs/__len/__gc/__close；弱表缓存需说明 GC 语义。
- 证据：输入样本、table dump、序列化前后、元表链路、边界测试。
- 兜底：不要用默认值掩盖上游数据缺口；先追 source。

### 5. coroutine 协程与异步宿主

- 适用：coroutine already dead、yield across C-call boundary、OpenResty cosocket、任务调度卡死。
- 动作：用 coroutine.create/resume 明确 ok/err；少用 coroutine.wrap；确认 yield 是否允许穿过 C API/宿主回调；OpenResty phase 中只在允许位置使用 cosocket；调度器要有超时、取消和日志。
- 版本差异：C API 的 lua_resume 参数和返回语义随版本变化；跨 C 边界错误要转成 Lua 错误对象或宿主日志，不能丢栈。
- 证据：协程状态、resume 返回值、traceback、phase、超时日志。
- 兜底：吞错的协程先改日志和错误传播，再谈业务修复。

### 6. OpenResty / Nginx Lua

- 适用：鉴权、限流、WAF、缓存、灰度、网关脚本、Nginx 内联 Lua。
- 动作：核 phase：init_by_lua、init_worker_by_lua、ssl_certificate/ssl_session、set/rewrite/access/content/header_filter/body_filter/log、balancer_by_lua、timer、stream_lua；Kong/OpenResty 插件核 PRIORITY、VERSION、init_worker、configure、rewrite、access、header_filter、body_filter、log、certificate 生命周期与 PDK phase 限制；cosocket 只在允许 phase；跨 worker 状态用 lua_shared_dict 或 Redis，不用 Lua 全局。
- phase 门禁：init/init_worker 只做预加载、字典初始化、timer 注册和只读配置；rewrite/access 做路由、鉴权、限流和 upstream 选择；content 可生成响应；header_filter/body_filter 不发 cosocket、不读请求体、不做阻塞 IO；log 只做轻量日志或投递队列；balancer 只处理连接选择、重试和 upstream 状态；ssl/certificate 只做证书和握手相关逻辑。
- 请求级状态：ngx.ctx 只保存当前请求内可复用的鉴权结果、路由决策、trace id 和计时点；不得跨请求复用，不得在 timer、init_worker 或全局模块缓存里读取；subrequest、internal redirect、rewrite 跳转会影响 ctx 生命周期，必须验证。
- 共享状态：lua_shared_dict 适合限流计数、短 TTL token、熔断状态和 worker 间协调；必须定义容量、key 命名、TTL、incr/add/set 语义、过期策略、forcible 驱逐处理和指标；需要互斥时用 resty.lock 或原子 add，不用 sleep 轮询。
- timer 与 worker lifecycle：timer 只在 init_worker 注册，必须用 premature 参数退出，设置并发上限、失败退避和日志；reload 时新旧 worker 并存，timer、连接池、shared_dict、JIT trace 和模块缓存会同时存在，发布验证必须覆盖 reload 前后。
- cosocket 与客户端库：resty.http、resty.redis、resty.mysql、resty.grpc 等必须设置 connect/read/send timeout、连接池名、pool size、backlog、set_keepalive/close、错误分类、重试上限和降级；禁止无超时请求、无限重试和把连接对象放进 ngx.ctx 跨阶段误用。
- DNS 与 upstream：动态域名必须配置 resolver、valid、ipv6、resolver_timeout 和失败降级；确认域名解析缓存、upstream keepalive、SNI、TLS 校验、balancer_by_lua 重试语义和灰度权重；不要把本机 hosts 或开发 DNS 当生产证据。
- 请求/响应体：读取请求体先确认 client_body_buffer_size、read_body、temp file、streaming 和大 body 限制；body_filter 必须按 chunk/eof 处理，不能假设一次拿到完整响应；压缩、分块、HTTP/2 和大响应要单独测。
- 路径与依赖：lua_package_path、lua_package_cpath、LUA_PATH、LUA_CPATH、opm/LuaRocks/vendor、容器工作目录和动态库路径必须由 nginx -T 或启动日志证明；reload 后确认新代码实际命中，不把本地路径成功当生产成功。
- 安全与网关：鉴权、签名、限流、WAF、IP/UA/设备指纹、灰度 header、cookie、token、request body、Redis key 和 upstream 响应日志必须脱敏；默认拒绝 fail-open，除非业务明确批准并有审计记录。
- 证据：nginx -T、openresty -V/nginx -V、OpenResty/lua-nginx-module/resty 库版本、error.log/access.log、request id、shared_dict 容量和驱逐数、连接池命中、DNS resolver、p95/p99、压测参数、灰度比例、reload 结果。
- 发布风险：reload、worker 退出、shared_dict 容量、连接池、resolver、lua_package_path、灰度、回滚配置归 release/backend 协同；远端开关、旧 worker 排空和回滚后版本命中必须验证。

### 6.1 OpenResty 网关开发闭环

- 开发前：画出 phase 流程、请求状态流、外部依赖、共享字典、限流/鉴权/灰度/回滚开关；列出 fail-open/fail-close 决策和用户影响。
- 实现中：每个外部调用都有 timeout、错误分类、降级和结构化日志；每个共享 key 有 TTL、容量预算和命名空间；每个 phase 只使用该 phase 允许的 ngx API。
- 测试中：用 test-nginx 或最小 Nginx 配置覆盖命中、未命中、超时、上游 5xx、DNS 失败、Redis/MySQL 失败、shared_dict 满、body 分片、reload、新旧 worker 并存。
- 发布前：跑 nginx -t/nginx -T、openresty -V、依赖路径核验、压测基线、错误日志扫描、敏感日志扫描、灰度比例确认、回滚脚本或开关演练。
- 发布后：观察 p95/p99、5xx、upstream connect/read timeout、worker exiting、lua shared dict no memory、timer premature、resolver failed、JIT/GC/RSS、限流误杀和鉴权拒绝率。
- 兜底：phase 能力、外部依赖、reload 或 shared_dict 未验证时，只能报“本地语义通过/需网关验证”，不能报生产可用。

### 6.2 限流、缓存与状态一致性

- 限流：先确定维度、窗口、精度、突发、白名单、灰度和误杀处理；单机 worker 内限流用 lua_shared_dict 原子 incr/add，跨机房或多节点用 Redis/网关层；禁止用 Lua 全局变量、文件锁或 sleep 轮询。
- 缓存：区分请求级 ngx.ctx、worker 级模块缓存、跨 worker shared_dict、跨实例 Redis/CDN；每层必须写清 key、TTL、容量、失效、回源、击穿保护、脏数据容忍和回滚开关。
- shared_dict：所有写入都处理 no memory、forcible、nil value、过期和并发；缓存对象要估算大小，记录命中率、驱逐、容量水位和热点 key；复杂更新用 resty.lock 或 add CAS 语义。
- timer 缓存刷新：只在 init_worker 注册；必须处理 premature、重复注册、失败退避、并发上限、旧 worker 残留、reload 期间双写和外部依赖不可用。
- 防击穿：热点 key 用本地短 TTL、锁、stale-while-revalidate 或异步刷新；不得让所有请求同时打到 Redis/MySQL/HTTP 上游。
- 验证：构造冷启动、热 key、shared_dict 满、外部依赖超时、reload、旧 worker 退出、灰度回滚和多 worker 并发压测；没有这些证据不得报“限流/缓存稳定”。

### 7. Redis Lua / Redis Functions

- 适用：EVAL/EVALSHA/FCALL、限流、库存、锁、排行榜、原子多键操作。
- 动作：KEYS/ARGV 必须静态传入；cluster 多 key 必须同 hash slot；脚本不做大集合全量遍历，不阻塞 Redis；预加载 SCRIPT LOAD 或 Functions；错误用 redis.error_reply/status_reply；返回值类型对客户端兼容。
- 证据：Redis 版本、cluster 模式、SLOWLOG、p99、调用方参数样本、回滚脚本或禁用开关。
- 安全：脚本参数视为不可信，避免拼命令式动态 key 和敏感日志。

### 8. LuaJIT、FFI、JIT 诊断

- 适用：FFI cdata 泄漏、JIT 路径变慢、trace abort、ARM64/GC64 差异。
- 动作：FFI 声明核 ABI、调用约定、结构体对齐、动态库路径；C 分配内存明确释放或 ffi.gc；JIT 热路径用 -jv/-jdump 看 trace、side trace、NYI、类型不稳定和 hot loop。
- 必查：jit.status、jit.version、GC64、目标架构、发行版补丁、宿主是否禁 JIT、FFI C 库生命周期。
- 证据：JIT 日志、trace abort 原因、前后 profile、RSS/GC 指标、崩溃 backtrace。
- 兜底：不要把 trace abort 直接判成业务慢；先做最小复现和版本锁定。

### 9. C API / Embedding / 宿主生命周期

- 适用：C 模块崩溃、宿主嵌入 Lua、线程隔离、panic、loader、native 资源泄漏。
- 动作：每个 C API 入口记录 lua_gettop 前后；lua_pcall 错误对象必须取出并记录；panic handler、allocator、自定义 module loader、registry/upvalue 生命周期、lua_State 归属、线程模型和锁策略必须明确。
- 边界：错误不能直接跨 C++ 析构/异常边界丢失；C 回调重入、lua_resume 版本差异、luaL_ref/luaL_unref、userdata __gc/__close 和宿主退出顺序要核。
- 证据：栈高度、ASAN/UBSAN/valgrind 或平台等价证据、崩溃 backtrace、allocator 统计、目标设备版本。
- 兜底：C 边界问题先最小复现，禁止用 Lua 层 pcall 掩盖 native 崩溃。

### 10. 性能、GC 与内存

- 适用：吞吐下降、GC 抖动、内存增长、CPU 飙高、Nginx/Redis 慢。
- 动作：先测基线；循环字符串拼接改 table.concat；table 预分配按宿主支持；避免热路径创建闭包和大临时 table；区分 Lua GC、LuaJIT GC、C/FFI 内存、shared_dict、Redis 内存；调 GC 前先定位对象来源。
- Lua 5.4：区分 generational/incremental GC；调整前要有对象来源、停顿时间和吞吐数据。
- 证据：基线、profile、collectgarbage 指标、RSS、火焰图、Redis/Nginx 指标、压测命令。
- 兜底：不凭“优化感觉”改；性能改动必须有前后数据。

### 11. 热更新、沙箱与脚本安全

- 适用：动态加载用户脚本、插件系统、在线热修、配置脚本。
- 动作：热更新要拆代码、状态和资源；明确 package.loaded 清理、回滚版本、幂等初始化；沙箱用白名单环境，不暴露 os.execute/io/debug/package/loadfile；限制 CPU、内存、执行时间和输出大小；日志脱敏。
- 攻击面矩阵：load/loadstring 环境、字节码加载、debug.getregistry、metatable 逃逸、package 搜索路径投毒、FFI 启用、资源耗尽、输出放大、文件/网络侧信道。
- 禁止项：不可信脚本禁二进制 chunk、debug、ffi、package、io、os、loadfile、dofile；需要动态加载时必须验签/校验、白名单 API、超时和配额。
- 证据：热更新版本号、加载日志、回滚演练、沙箱逃逸样本、权限清单。
- 安全边界：不可信脚本执行需联动 wsec/aud。

### 12. Neovim / Hammerspoon / wezterm / 自动化脚本

- 适用：init.lua、插件配置、快捷键、桌面自动化、脚本任务。
- 动作：Neovim 按 LuaJIT 5.1 兼容处理；0.10/0.11 核 vim.lsp、vim.diagnostic、vim.keymap、treesitter API；lazy.nvim 仍识别并核 lock，但 kickstart 趋势转向 vim.pack；lockfile、healthcheck、stable/nightly 差异、parser 版本、plenary.nvim 测试、异步 job/channel、remote plugin 入口必须入证据。
- Hammerspoon/wezterm：按宿主 Lua 版本确认；自动化脚本必须有入口、断点、幂等、日志、权限和失败截图。
- 合规：自动化仅用于自有设备、自有账号、合法运维/测试/辅助；绕过平台风控、批量账号操控、未授权采集、隐私侵犯或攻击脚本必须停止并联动 legal/security。

### 13. love2d、游戏与嵌入式宿主

- 适用：love2d/love.run/love.load/love.update/love.draw、游戏引擎脚本、固件脚本、设备自动化、Lua 扩展宿主。
- 动作：确认 love2d、Unity/XLua、Unreal/Slua、Cocos、Roblox/Luau 或自研宿主；Luau、宿主扩展和标准 Lua 不得混同；核 love.run/load/update/draw 生命周期、事件循环、帧预算、移动端输入/权限/包体/后台、只读文件系统、低内存、时钟和回调重入。
- 证据：宿主版本、脚本绑定层、设备/引擎日志、帧耗时、内存上限、桌面与移动端 smoke、失败截图或录屏。
- 兜底：桌面 Lua 跑通不代表游戏/嵌入式可用。

### 14. 测试与回归

- 单元：按项目约定使用 busted、luaunit、luassert 或宿主内置测试；覆盖 nil/false/null、稀疏 table、metatable、协程错误和版本垫片。
- 宿主：OpenResty 用 test-nginx 或最小 Nginx 配置；Redis 脚本做 standalone/cluster 集成测试；Neovim 用 plenary.nvim 或 headless smoke；C API 用 sanitizer/valgrind 或平台等价工具。
- 压测：OpenResty/Kong 网关至少记录工具、并发、QPS、连接复用、请求体大小、上游延迟注入、错误率、p95/p99、RSS、shared_dict 水位、worker 数和 error.log；性能结论必须有前后对比。
- 发布：补 Nginx reload、Redis SCRIPT/Functions 预加载、插件 lock、设备固件、性能基线、回滚开关。
- 禁止：未跑不得报“已验证”；缺宿主环境必须标“需验证”。

### 15. 真实验收门禁

- 最小验收：本地语法检查或单元测试通过，只能证明 Lua 语义；OpenResty 任务还必须有 nginx -t 或 openresty -t、nginx -T、目标 phase 命中日志、error.log 无新增错误和最小请求 smoke。
- 网关验收：鉴权、限流、缓存、灰度、upstream、DNS、TLS、body_filter、timer 或 balancer 相关改动，必须覆盖正常、拒绝、超时、上游 5xx、shared_dict 满、reload、回滚和压测。
- 版本验收：多 Lua 版本或 LuaJIT 兼容改动，必须给 `_VERSION`、jit.version、目标宿主版本、依赖路径和至少一个失败前后对照。
- 数据验收：nil/table/metatable/coroutine 修复要有边界样本、traceback、序列化前后或协程状态证据，不接受“看起来没报错”。
- 安全验收：热加载、沙箱、FFI、C API、外部命令、日志字段和动态路径必须做危险库、敏感日志、资源限制、验签/校验和回滚检查。
- 读回验收：远端技能或规则更新后必须 raw readback，比对 local_remote，并记录 raw_lines、fences、version、updated_at；未读回不得报远端完成。

### 16. 低级错禁止

- 禁止把 OpenResty phase 名称写错或漏掉 by_lua 后缀后就设计方案；必须对应真实 nginx 配置或插件生命周期。
- 禁止把 `nil` 当空字符串、把 false 当缺失、把 ngx.null/cjson.null 当 nil；每个 null 语义必须归属到输入 schema。
- 禁止用全局变量保存请求、用户、token、连接、协程、FFI 指针或跨 worker 限流状态。
- 禁止无超时 cosocket、无限重试、吞掉 err、只打印 err 不带 request id、把连接对象跨 phase 复用。
- 禁止把 reload、热更新、package.loaded 清理、timer 注册和 shared_dict 清空混为一谈。
- 禁止输出或落盘真实 key、token、cookie、Authorization、Redis 密码、证书私钥、用户隐私或可复用签名材料。

## 高频坑 / 防遗漏

### 高频坑

1. 未确认 Lua/LuaJIT 版本就使用 5.3/5.4 语法。
2. package.path/package.cpath 与发布环境不同，require 加载错模块。
3. 全局变量污染导致脚本、OpenResty worker 或 Neovim 插件互相覆盖。
4. nil 与 false 混淆，或 table 稀疏数组仍用 `#t`。
5. metatable __index 链过深或 __newindex 吞写入，导致状态不可见。
6. coroutine.wrap 吞错，或 yield 穿过不允许的 C API 边界。
7. OpenResty 在错误 phase 使用 cosocket，或用 Lua 全局跨 worker 共享。
8. Redis Lua 动态拼 KEYS，cluster hash slot 错位。
9. LuaJIT FFI cdata 未绑定释放，C API 栈不平衡。
10. 循环字符串拼接、热路径创建大量 table/闭包导致 GC 抖动。
11. 热更新只替换代码不迁移状态，package.loaded 仍缓存旧模块。
12. 沙箱暴露 os/io/debug/package/load/bytecode/FFI，形成命令执行、文件读取或逃逸。
13. 日志打印 token、cookie、Redis key 参数、用户隐私或设备标识。
14. 发布只重启脚本不验证 Nginx reload、Redis SCRIPT 缓存、Neovim 插件锁。
15. LuaRocks C 模块在 macOS arm64、Linux musl、容器最小镜像中 ABI 或动态库路径失配。
16. 游戏/嵌入式宿主的帧预算、只读文件系统、低内存和回调重入未验证。
17. 把绕过风控、批量账号操控、未授权采集包装成“Lua 自动化”。
18. Lua 5.4 `<close>`/`__close` 释放顺序误判，导致文件、锁或连接泄漏。
19. LuaJIT trace abort、NYI 或类型不稳定被误判为业务代码慢。
20. OpenResty timer、balancer、ssl 或 body_filter phase 误用 request API 或状态。
21. Neovim 0.10/0.11 LSP 配置迁移仍套旧 API，插件 lock/parser 未固定。
22. OpenResty reload 后新旧 worker 并存，模块缓存、timer 和连接池状态不一致。
23. lua_shared_dict 未设容量预算、TTL、驱逐处理和 resty.lock，导致限流、鉴权缓存或熔断误判。
24. resty.http/resty.redis/resty.mysql 未设超时、连接池和降级，单个依赖抖动拖垮 worker。
25. 动态域名没配 resolver/SNI/TLS 校验或只在 hosts 中可解析，生产 upstream 随机失败。

### 防遗漏清单

- 版本：Lua、LuaJIT、宿主、平台、CPU 架构、编译参数已记录吗？
- 入口：脚本入口、require、Nginx phase、Redis EVAL/FCALL、宿主回调、定时任务已列全吗？
- 路径：package.path、package.cpath、LUA_PATH、LUA_CPATH、工作目录、LuaRocks tree、rockspec、动态库路径已核吗？
- 数据：nil/false/ngx.null/cjson.null、table 连续性、metatable、序列化兼容已测吗？
- 错误：pcall/xpcall、traceback、coroutine resume、C API lua_pcall、日志关联 id 已覆盖吗？
- 并发：OpenResty worker、Redis 单线程阻塞、协程调度、嵌入式回调重入、C 线程隔离已查吗？
- 内存：Lua GC、LuaJIT GC、Lua 5.4 GC 模式、FFI/C 内存、shared_dict、Redis 内存已区分吗？
- 网关：phase 能力、cosocket 限制、ngx.ctx 生命周期、shared_dict/lock、timer premature、resty.http/redis/mysql、resolver、reload、新旧 worker 并存已测吗？
- 安全：沙箱、权限、敏感日志、脚本来源、字节码/FFI/debug 禁用、热更新签名或校验已查吗？
- 发布：灰度、回滚、reload、脚本预加载、压测基线、错误日志扫描、插件 lock、设备固件、兼容旧数据和旧客户端已验证吗？

## 输出要求

Lua 任务输出必须极简且可复核，至少包含：

1. 运行时与版本：Lua/LuaJIT/OpenResty/Redis/Neovim/嵌入式宿主版本、平台和工具链。
2. 入口与影响面：脚本入口、模块、Nginx phase、Redis 脚本、C API/FFI、热更新、调用方和消费方。
3. 复现与证据：命令、日志、traceback、最小复现、性能/内存指标或无法验证原因。
4. 根因判断：绑定具体语法、API、数据结构、协程、路径、权限、GC、内存或兼容性证据。
5. 修复策略：最小改动、兼容垫片、错误处理、日志、回滚方案和风险。
6. 验证路径：单元/集成/宿主 smoke、busted/luaunit、test-nginx、nginx -t/-T、reload、压测、Redis SLOWLOG、Neovim health/plenary、C API sanitizer、嵌入式设备验证、性能对比。
7. 联动技能：需要 rsch、pl、be、wsec、tst、aud、rls 的原因。
8. 剩余风险：未覆盖平台、未跑宿主、未验证发布或第三方依赖。

## 约束

- 不在未确认版本/宿主/入口时修改 Lua 语法或 API。
- 不把 Lua 5.1、5.3、5.4、LuaJIT、Redis Lua、OpenResty Lua、Luau 当成同一环境。
- 不污染 `_G`/`_ENV`；不依赖隐式全局；模块必须边界清楚。
- 不用 `#t` 判断稀疏 table；不混淆 nil、false、ngx.null、cjson.null。
- 不在循环热路径做无证据的字符串拼接和大对象分配。
- 不在 OpenResty 禁止 phase 使用 cosocket；不靠 Lua 全局跨 worker 共享状态。
- 不在 Redis Lua 内动态拼未声明 KEYS；不写长时间阻塞脚本。
- 不让 FFI/C API 内存生命周期不明；不忽略 C 栈平衡、panic、allocator、registry 和线程隔离。
- 不执行不可信脚本；沙箱默认白名单；禁 bytecode/debug/FFI/package/io/os；敏感权限需显式审批。
- 不把本地脚本跑通包装成发布可用；发布/回滚必须有环境证据。
- 不协助绕过平台风控、批量养号、未授权抓取、隐私侵犯或攻击自动化。

## 高频 Bug 反例库

- 反例 1：版本未确认就写 5.3 语法
  - 错：在 Lua 5.1/LuaJIT/Redis Lua 中使用 `//`、原生位运算或 utf8 库。
  - 对：先确认 `_VERSION` 和 `jit.version`，5.1/LuaJIT 使用兼容写法或 bit 库并锁运行时。
  - 根因：Lua 生态版本分裂，宿主常长期停在 5.1。
- 反例 2：require 找错模块
  - 错：本地能跑，发布后 module not found 或加载旧 rock。
  - 对：输出 package.path/package.cpath、LUA_PATH/LUA_CPATH 和实际命中文件；发布时锁依赖路径。
  - 根因：Lua 模块解析依赖环境和工作目录，路径漂移常见。
- 反例 3：nil/table 边界错误
  - 错：稀疏 table 用 `#t` 得到随机长度，nil 字段序列化后丢失。
  - 对：显式维护 count，区分 nil/false/null，序列化前定义 schema。
  - 根因：nil 既是空值也是删除，table 同时承担数组和 map。
- 反例 4：metatable 隐式副作用
  - 错：__index 返回默认对象，掩盖上游缺字段，__newindex 吞写入。
  - 对：关键数据禁静默默认；元方法写日志或断言；调试时打印 metatable 链。
  - 根因：metatable 会改变读写语义，错误常不在报错点。
- 反例 5：coroutine.wrap 吞错
  - 错：协程内部异常只在外层表现为任务丢失或状态卡死。
  - 对：使用 create/resume 检查 ok/err，或 xpcall 加 traceback 后上报。
  - 根因：协程错误传播与普通调用不同，宿主调度器更容易吞掉。
- 反例 6：OpenResty 跨 worker 用 Lua 全局
  - 错：模块顶层 cache 期望所有 worker 共享，限流计数不准。
  - 对：跨 worker 用 lua_shared_dict 或 Redis；请求级用 ngx.ctx；worker 级才用模块缓存。
  - 根因：Nginx 多 worker 是多进程，每个 worker 独立 Lua VM。
- 反例 7：OpenResty phase 用错
  - 错：在 init_by_lua、header_filter_by_lua、log_by_lua、timer 等禁止场景发 cosocket 或读 request API。
  - 对：按 phase 能力选择 access/content、balancer、timer/队列，并隔离请求级状态。
  - 根因：OpenResty cosocket 和 request API 受 Nginx phase 限制。
- 反例 8：Redis Lua 动态拼 KEYS
  - 错：脚本内用 ARGV 拼 key 再 GET/SET，cluster 下跨 slot 失败。
  - 对：所有 key 由 KEYS[] 静态传入，并使用 hash tag 保证同 slot。
  - 根因：Redis Cluster 根据声明 KEYS 路由，不知道脚本内动态 key。
- 反例 9：FFI/C API 内存泄漏
  - 错：C malloc 返回 cdata 后不 free，或 lua_push 后不核栈高度。
  - 对：ffi.gc 绑定释放，C API 每个入口记录 lua_gettop 前后差异。
  - 根因：Lua GC 不自动管理所有 C 资源，栈不平衡会污染宿主。
- 反例 10：GC 调参代替定位
  - 错：内存涨就调 collectgarbage 参数，未区分 Lua 对象、C 内存、shared_dict。
  - 对：先 profile 和内存分类，再按对象来源修复分配或生命周期。
  - 根因：GC 参数只能改变回收节奏，不能修复泄漏。
- 反例 11：热更新不处理 package.loaded
  - 错：替换文件后 require 仍返回旧模块，或新代码读旧状态崩溃。
  - 对：设计版本号、状态迁移、package.loaded 清理和回滚；先灰度加载。
  - 根因：Lua 模块有进程内缓存，热更新是代码和状态双问题。
- 反例 12：沙箱暴露危险库
  - 错：把 os、io、debug、package、loadfile、bytecode 或 ffi 暴露给用户脚本。
  - 对：白名单环境、禁二进制 chunk、资源限额、禁危险库、审计日志和超时中断。
  - 根因：Lua 动态执行能力强，默认环境不适合不可信脚本。
- 反例 13：LuaRocks C 模块 ABI 失配
  - 错：把 x86_64/glibc 编译的 so 放到 arm64/musl 或不同 Lua ABI 环境。
  - 对：按目标架构、Lua ABI、动态库后缀和 package.cpath 重新构建并验证。
  - 根因：C 扩展绑定 Lua ABI、libc、架构和编译选项。
- 反例 14：游戏/嵌入式宿主忽略帧预算和资源限制
  - 错：把桌面 Lua 脚本直接放进游戏帧回调或固件脚本，产生卡顿或 OOM。
  - 对：按宿主事件循环、帧预算、只读文件系统、低内存和权限模型重测。
  - 根因：宿主生命周期和资源限制决定 Lua 代码可用边界。
- 反例 15：自动化越界
  - 错：把绕过风控、批量账号操控、未授权采集写成 Lua 脚本需求。
  - 对：只支持自有设备/账号的合法测试、运维和辅助自动化；越界停止。
  - 根因：自动化能力容易被用于违反平台规则或侵犯隐私。
- 反例 16：Lua 5.4 `<close>` 释放顺序误判
  - 错：以为 __close 立即或按业务顺序释放锁、文件、连接，异常路径泄漏。
  - 对：用最小复现验证作用域退出顺序、错误传播和回滚路径。
  - 根因：to-be-closed 变量受作用域、错误和 finalizer 时机影响。
- 反例 17：C API 错误对象和栈泄漏
  - 错：lua_pcall 失败后不取错误对象，循环调用后栈持续增长。
  - 对：失败路径记录错误、弹栈、恢复栈高度并测试多次调用。
  - 根因：Lua C API 栈由调用方维护，错误对象也占栈位。
- 反例 18：沙箱 debug/metatable 逃逸
  - 错：白名单漏掉 debug.getregistry 或允许改共享 metatable。
  - 对：禁 debug、禁共享可变 metatable，加入逃逸用例和资源预算测试。
  - 根因：Lua 反射和元表可绕过表面白名单。
- 反例 19：LuaJIT trace abort 误判
  - 错：只看业务日志认为数据库慢，未检查 NYI、side trace 或类型不稳定。
  - 对：采集 -jv/-jdump、profile 和输入类型分布后再优化。
  - 根因：LuaJIT 性能取决于 trace 是否稳定生成。
- 反例 20：Neovim LSP 迁移套旧 API
  - 错：升级 0.10/0.11 后仍用旧 lspconfig/diagnostic 写法，启动无报错但功能失效。
  - 对：核 Neovim 版本、healthcheck、:messages、插件 lock 和新 API 迁移说明。
  - 根因：Neovim Lua API 与插件生态迭代快。
- 反例 21：OpenResty reload 误判生效
  - 错：PATCH 文件后只跑 nginx -s reload，未验证新旧 worker、timer、连接池和模块缓存。
  - 对：记录 reload 时间、worker exiting、版本命中日志、timer premature、连接池和回滚后命中。
  - 根因：reload 是平滑切换，新旧 worker 会并存，Lua 模块和 JIT trace 是进程内状态。
- 反例 22：shared dict 当无限缓存
  - 错：限流、鉴权缓存和熔断状态都塞 shared_dict，不设 TTL 和 no memory 处理。
  - 对：按业务拆 key 命名、容量、TTL、incr/add 原子语义、驱逐指标和 resty.lock。
  - 根因：shared_dict 是固定共享内存，满了会驱逐或写入失败，跨 worker 竞争需要原子化。
- 反例 23：resty 客户端无超时
  - 错：resty.http/redis/mysql 没有 connect/read/send timeout、连接池和降级。
  - 对：每个依赖定义超时、pool、keepalive、错误分类、重试上限和 fail-open/fail-close。
  - 根因：cosocket 非阻塞不等于无风险，慢依赖会放大到 worker 资源耗尽。
- 反例 24：DNS resolver 只在本机可用
  - 错：动态 upstream 域名靠 hosts 或系统解析，Nginx worker 中偶发 no resolver defined。
  - 对：配置 resolver、resolver_timeout、SNI/TLS 校验和 DNS 失败降级，并在 nginx -T 中留证。
  - 根因：OpenResty 动态域名解析依赖 Nginx resolver，不等同于 shell 能解析。
- 反例 25：限流维度写错
  - 错：只按 IP 限流，代理、NAT、内网调用和登录用户混在一起，误杀或漏放。
  - 对：按业务选择 user、token、tenant、route、IP、设备或组合 key，灰度验证误杀率和绕过路径。
  - 根因：限流 key 是业务语义，不是随手拼字符串。
- 反例 26：缓存击穿无保护
  - 错：shared_dict miss 后所有请求同时回源 Redis/MySQL/HTTP，上游被打爆。
  - 对：使用短 TTL、resty.lock、stale 数据、异步刷新或熔断降级，并压测冷启动和热 key。
  - 根因：缓存 miss 是并发事件，不是单请求事件。
- 反例 27：timer 重复注册
  - 错：每次 reload 或每个 worker 都注册无上限 timer，旧 worker 未退完时重复刷新和重复写日志。
  - 对：init_worker 内注册，处理 premature、worker id、并发上限、失败退避和 reload 期间双跑。
  - 根因：Nginx reload 会让新旧 worker 并存，timer 生命周期不是全局唯一。
- 反例 28：body_filter 假设完整响应
  - 错：在 body_filter 里按完整 JSON 解析 chunk，遇到分片、gzip 或大响应就损坏内容。
  - 对：按 chunk/eof 聚合或改到上游/content 阶段处理；单测覆盖分块、压缩、空 body 和大响应。
  - 根因：Nginx filter phase 处理的是流式片段。
- 反例 29：FFI 声明靠猜
  - 错：照抄 C 函数名，未核 struct alignment、enum 大小、调用约定和库版本。
  - 对：以头文件、编译参数、目标架构和最小调用验证为准，必要时改 C wrapper。
  - 根因：FFI 错误常表现为随机崩溃或数据污染，不一定立刻报错。
- 反例 30：远端更新未 raw readback
  - 错：PATCH 返回成功就报告远端已生效，未读取 raw、version、updated_at 和行数。
  - 对：PATCH 后重新 GET raw 与本地比对，并记录 raw_lines、fences、local_remote、version、updated_at。
  - 根因：写入成功不等于读取路径、缓存和内容一致。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] fenced code block 数量为 0。
- [ ] frontmatter 含 name 和 description。
- [ ] H1 等于 manifest title（Lua/OpenResty 开发）。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例能被 `反例\s*\d+` 命中且不少于 15 条。
- [ ] 关键词齐全：Lua 5.1、Lua 5.3、Lua 5.4、Lua 5.5、LuaJIT、JIT、FFI、OpenResty、Kong、Nginx phases、cosocket、ngx.ctx、lua_shared_dict、resty.lock、timer、worker lifecycle、resty.http、resty.redis、resty.mysql、DNS resolver、reload、lua_package_path、lua_package_cpath、限流、鉴权、日志脱敏、压测、灰度、回滚、Redis Lua、Neovim、love2d、游戏、嵌入式、LuaRocks、rockspec、rocktree、LUA_PATH、LUA_CPATH、协程、coroutine、metatable、table、nil、全局变量、require、package.path、package.cpath、C API、ABI、GC、内存、性能、热更新、沙箱、脚本、模块、错误处理、日志、兼容性。
- [ ] 已覆盖 Lua 5.1-5.4/LuaJIT 主链、Lua 5.5 前瞻警示、OpenResty/Kong/Nginx、Redis Lua、Neovim、love2d/游戏脚本、embedding/C API、FFI、协程、模块系统、性能、沙箱安全、测试、包管理。
- [ ] 已覆盖版本/平台/工具链/运行环境差异，入口/复现/证据/验证路径。
- [ ] 已覆盖 Lua 相关安全、权限、数据、兼容、发布或回滚风险。
- [ ] 已说明与 rsch、pl、be、wsec、tst、aud、rls 的边界。

## 2024-2026 新坑速查

- Lua 5.4：generational GC、to-be-closed 变量、`<const>` 和 __close 元方法改变资源释放时机；不要假设 finalizer 立即执行。
- LuaJIT 2.1：发行版补丁、ARM64、GC64、NYI trace、side trace 和 hot loop 差异会影响性能；关键路径锁版本并保留 -jv 证据。
- OpenResty/Nginx 1.25-1.27 与 Kong：HTTP/2、QUIC 周边、ssl/balancer/body_filter/timer、插件 PRIORITY/VERSION、configure、certificate、PDK phase 限制、lua-nginx-module 与 resty 库版本组合要核；升级前跑 reload、test-nginx、压测和 error.log 检查。
- OpenResty 网关：AI 生成 Lua 片段常漏 phase/cosocket/ngx.ctx/shared_dict/resolver/reload 约束；必须用 nginx -T、test-nginx、压测、灰度和回滚证据把“能跑”提升为“网关可上线”。
- Redis 7.x：Functions 仍使用 Lua 5.1 语义；从 EVAL 迁移到 FCALL 要验证库名、权限、复制和回滚。
- Neovim 0.10-0.12：vim.lsp、vim.diagnostic、treesitter、lazy.nvim、vim.pack、plenary.nvim 和 parser 版本变化频繁；lockfile、healthcheck、stable/nightly 必须入证据。
- macOS arm64/Linux musl：LuaRocks C 模块、FFI 动态库、package.cpath 后缀和 ABI 容易不一致；CI 覆盖目标架构。
- 容器最小镜像：缺 ca-certificates、tzdata、编译器、动态库或 locale 会让脚本只在本地可跑。
- 沙箱安全：AI 生成脚本和用户插件增多，os/io/debug/load/package/ffi/bytecode 暴露会变成 RCE、数据泄露或资源耗尽。
- 供应链：LuaRocks rockspec dependencies/build_dependencies/test_dependencies/external_dependencies、Git submodule、插件管理器下载源需锁版本和校验；发布时记录 rocktree、LUA_PATH/LUA_CPATH、lockfile/vendor/private rocks server。
- 可观测性：无结构化日志、request id、Redis slowlog、Nginx error.log 关联时，协程和异步问题很难复盘。
- 热更新：长进程缓存 module、JIT trace、连接池和状态；只替换文件不等于代码生效。
- love2d/游戏/嵌入式宿主：love.run/load/update/draw、移动端包体/权限、固件升级、文件系统只读、时钟漂移、低内存、帧预算、回调重入和权限模型变化会破坏原脚本假设；至少做 smoke。

## 资料源边界

- awesome-lua、awesome-resty 只可作为生态分类索引或找候选库入口，不作为权威 API、兼容性或安全结论；最终以官方手册、宿主文档、源码、release notes 和本地复现为准。

## 与相邻技能的边界

- 本技能负责：Lua 语言、LuaJIT、OpenResty/Nginx Lua、Redis Lua、Neovim/Hammerspoon/wezterm、游戏/嵌入式 Lua、C API/FFI、协程、metatable/table/nil、LuaRocks、模块加载、GC/内存/性能、热更新、沙箱、合法自动化脚本工程化、错误处理、日志和兼容性排障。
- 研究调研/research（rsch）：用于查官方文档、版本发布说明、CVE、宿主 API 变化；查资料后仍由 Lua/OpenResty 开发/lua-openresty-development（luad） 落地 Lua 侧判断。
- 项目学习/project-learning（pl）：陌生项目先读结构、入口、运行方式和现有约定；不能跳过项目学习直接套 Lua 通用模板。
- Shell 脚本/shell-scripting（shx）：负责 Shell 入口、curl/jq、发布脚本、cron/systemd、环境变量、权限和命令安全；Lua/OpenResty 开发/lua-openresty-development（luad） 只定义 Lua 侧验证点。
- 后端工程/backend-engineering（be）：Nginx/OpenResty 部署、进程模型、服务拓扑、Redis 部署、容器和服务治理归后端；Lua 代码与 phase 语义归本技能。
- Web 安全/web-security（wsec）：不可信脚本、沙箱逃逸、RCE、SSRF、鉴权、敏感数据暴露等安全验证归安全；Lua 侧提供 source/sink 和最小修复。
- 性能工程/perf-engineering（pfe）：性能指标、baseline、profile、压测和回归门槛归性能；Lua GC/JIT/table/FFI 优化点由本技能提供。
- C/C++ 开发/cpp-development（cpd）：C/C++ 编译、链接、ABI、sanitizer、native 扩展和嵌入宿主归 C/C++；Lua C API 调用约束和脚本边界由本技能协同。
- 测试验证/test-engineering（tst）：场景矩阵、回归、性能基线、CI 证据和发布冒烟验证归测试；Lua 侧提供可测入口和断言点。
- 代码审计/code-audit（aud）：任何代码改动完成前做需求对账、影响面、安全质量和证据收口；本技能不能替代最终审计。
- 发布部署/release-engineering（rls）：灰度、reload、回滚、监控、告警、配置发布、脚本预加载和生产验证归发布；Lua 侧提供兼容和回滚注意项。
- 数据库工程/database-engineering（db）：Redis 数据结构、cluster、持久化、事务模型和容量设计归数据；Redis Lua 的脚本语义、KEYS/ARGV 和返回兼容归本技能。
- 移动安全/mobile-security（msec） / 逆向工程总控/reverse-engineering（rev） / 协议分析/protocol-analysis（prot） / 法务合规/legal-counsel（law）：系统注入、抓包、Hook、越狱/root、协议逆向、平台规则和合规争议不归本技能；仅处理合法 Lua 脚本和宿主集成。
