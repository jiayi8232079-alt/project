---
name: ruby-development
description: Ruby开发技能 - Ruby 3.3/3.4、Ruby 3.5 preview/Ruby 4.0、Rails 7.1/7.2/8.1、Zeitwerk、Bundler/RubyGems 4.0、rbenv/asdf、YJIT、Ractor/Fiber scheduler、ActiveRecord/N+1、Sidekiq 8、Puma 8、Hotwire/Turbo、RSpec Rails 8、RuboCop 1.86、Brakeman 8、dry-rb 输入契约、Gem native extension 与 Apple Silicon 实战排障。涉及 .rb、Gemfile、Rails、Rack、ActiveRecord、Sidekiq、Ruby 测试或部署实现时必须使用。
---

# Ruby 开发

Ruby 开发（ruby-development，兼容 slug: rb）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

定位：只处理 Ruby 语言、Rails 框架与 Ruby 生态实现排障；目标是用版本、入口、调用链、运行证据和最小验证闭环，避免 Rails 约定、Gem 依赖和运行环境差异造成误判。

## 快速总则

1. 先定事实：读取 Ruby、Rails、Bundler/RubyGems、Rack、数据库 adapter、Puma、Sidekiq、Redis、RSpec Rails/Minitest、RuboCop、Brakeman、dry-rb、OS/CPU、Gemfile.lock 与部署平台；Ruby 3.5 preview、Ruby 4.0、Rails 8.1 等新版本不确定时标“需验证”。
2. 先定入口：route/controller/action、Rack middleware、model callback、ActiveJob/Sidekiq worker、rake task、initializer、engine、console 脚本、gem executable。
3. 先复现再改：保留请求样本、job 参数、request_id/job id、SQL 日志、异常栈、环境变量、bundle env、平台信息。
4. 改 route/model/job/migration/initializer/Gemfile 前搜生产方、消费方、测试、部署脚本和定时任务；未搜全不改公共接口。
5. Controller 只编排协议、鉴权、参数和返回；业务进 service/domain；复杂查询进 scope/query object；callback 不承载跨系统流程。
6. ActiveRecord 一致性由数据库约束兜底，validation 只改善错误体验；并发写必须考虑唯一索引、锁、事务和幂等。
7. Sidekiq 默认至少一次执行；job 参数只传 JSON 简单类型和 ID；重试、重复执行、部分成功必须安全。
8. Zeitwerk 按路径推导常量；文件名、namespace、inflector、autoload/eager_load、initializer reload 边界必须验证。
9. Hotwire/Turbo 是服务端渲染交互层，不替代服务端鉴权、CSRF、状态码和无 JS 降级。
10. Bundler/Gemfile.lock 是依赖事实源；禁止用本机全局 gem、临时删 lockfile、混用 rbenv/asdf/system ruby 解释问题。
11. Rails 8/8.1 默认栈先辨事实：Solid Queue、Solid Cache、Solid Cable、Propshaft、Kamal、authentication generator 是否启用，不能按新项目默认反推旧项目。
12. 类型与供应链只作实现证据：Sorbet/RBS/Steep/TypeProf、lockfile checksum、trusted sources、yanked/CVE/MFA 状态必须实际跑或查到再引用。
13. 性能先拿证据：SQL 数、APM/profile、P95/P99、RSS、GC.stat、heap dump、YJIT、DB/Redis pool、队列积压；不凭感觉开线程或 worker。
14. 涉 API 契约、DB 设计、Web 安全、发布、测试、观测或最终审计时读取相邻技能并按边界联动，不在 ruby-dev 内替它们下最终方案。
15. Rails 写接口默认按字段契约处理：Strong Parameters、form object 或 dry-schema 必须列出允许字段；禁止 `permit!`、`update(params)`、`assign_attributes(params)` 和把原始 `params` 直接传入 model/service。
16. PATCH/部分更新必须区分 absent、null、空字符串和空数组；需要用 `params.key?` 或等价契约判断调用方是否真的传了字段，不能用 truthy/blank? 把“未传”和“清空”混成一种语义。
17. ActiveRecord 写入保护优先于写法省事：`update/update!`、`update_all`、`delete_all`、`destroy_all`、`increment!`、`touch_all` 都要核对 validation/callback/tenant/权限/锁/审计是否被绕过。

## 单技能工程门禁

1. 接到 Ruby/Rails 开发需求后，先画清请求或任务闭环：入口、输入契约、授权、业务对象、持久化、事务、副作用、返回、异步任务、测试和发布验证；缺任一环节只能标风险，不能报“完整实现”。
2. Controller/Job/Rake task 不直接承载业务状态机；复杂逻辑至少落到 service/form/query/policy 等项目既有层，ActiveRecord model 只保留实体约束、关联和局部领域行为。
3. 外部输入进入 ActiveRecord 前必须经过 Strong Parameters、form object、dry-schema 或等价 DTO；DTO/Form object 与 ActiveRecord 分离，禁止把 params、request body、JSON hash 当内部实体到处传。
4. validation、authorization、business rule、database constraint 四层要分清：validation 不替代授权，policy 不替代数据库约束，数据库异常要转稳定错误，不允许 rescue 后返回成功。
5. 每次写库都说明事务边界、锁策略、affected rows、幂等键和失败回滚；跨系统副作用只能在 commit 后触发，callback/callbacks 里不得发 HTTP、邮件、支付、消息队列或长耗时任务。
6. ActiveJob/Sidekiq 默认重复执行和乱序到达；job 必须能从 ID 重建状态、能安全重试、能处理旧 payload、能记录幂等冲突和部分成功。
7. 时间字段统一确认 time zone、数据库存储、展示转换、DST、Time.zone 与 Time.now 边界；测试必须冻结时间并清理 time travel。
8. nil、false、0、空字符串、空数组、blank?、presence 的语义必须按字段契约决定；不得用 Rails helper 偷懒改写业务含义。
9. Migration 必须有 migration rollback 或不可回滚说明；schema migration 与 data migration 分离，大表变更要给锁风险、批量回填、可重入和旧新代码兼容证据。
10. secret、token、cookie、authorization header、credentials/master key、private source token 必须进入 logging 过滤和脱敏；禁止生产 debug、verbose query log 或 request body 原文日志泄露敏感信息。
11. Bundler lock 是交付物：改 Gemfile 必须带 Gemfile.lock、platform、checksum/source、CVE/yanked/license 和 CI/生产 Ruby 版本证据；禁止本机 bundle 状态当验证。
12. 验收证据按改动面给出：model spec 覆盖规则，request spec 覆盖 HTTP 契约，system spec 覆盖 Hotwire/浏览器流，job spec 覆盖重试和幂等，migration status/rollback 覆盖 schema 变更。

## 硬禁止与低级错拦截

- 禁止直接信任 params、session、cookie、headers、query string、signed id 或 hidden field；所有用户可控值必须进入 allowlist、类型转换、授权 scope 和 sink 白名单。
- 禁止 `rescue StandardError`、`rescue nil`、空 rescue 或吞异常后返回 200/success；异常必须分类、记录 request_id/job id，并映射稳定错误或重试策略。
- 禁止生产环境打开 debug、better_errors、web_console、详细异常页、SQL bind 原文、request body 全量日志和 token/cookie 日志。
- 禁止 callback 做外部请求、跨聚合写入、发送邮件、enqueue 未提交数据或依赖执行顺序；需要副作用时用 after_commit、outbox 或幂等 job。
- 禁止只测 controller happy path；涉及写入、权限、异步、migration、N+1、Hotwire、timezone、nil/blank? 的改动必须给失败路径证据。

## 2026 版本事实表（P0）

| 组件 | 2026 口径 | 核验动作 |
| --- | --- | --- |
| Ruby 3.5 | preview，不按稳定版承诺 | 查 release notes、CI matrix、stdlib gem 化、ABI/native extension |
| Ruby 4.0 | 新大版本假设一律需证据 | 查 release notes、CI matrix、stdlib gem 化、ABI/native extension、生产镜像 |
| Rails 8.1 | 需确认 new_framework_defaults 与默认栈 | 查升级指南、Gemfile.lock、生成器/initializer、CI |
| Sidekiq 8.1 | 需确认 Redis/重试/序列化/监控兼容 | 查 changelog、队列 payload、drain/rollback |
| Puma 8.0 | 需确认 Rack/Rails/线程/worker/信号兼容 | 查 changelog、pool 预算、phased restart、health check |
| RSpec Rails 8.0 | 需确认 Rails 8.1、system/request spec 与异步语义 | 查 Gemfile.lock、CI、失败样本 |
| RuboCop 1.86 | 自动修复可能改语义 | 查项目配置、只修相关文件、跑测试 |
| Brakeman 8.0 | 规则/误报基线需更新 | 查 report、忽略理由、wsec 复核项 |
| RubyGems/Bundler 4.0 | 供应链与解析行为需实测 | 查 lockfile checksum、trusted source、MFA、平台、私有源 |
| dry-validation 1.11 / dry-schema 1.16 | 输入契约需分层 | 查 coercion、business rules、错误映射、Rails params 边界 |

## 场景执行卡

### 1. Ruby 版本、运行时与环境漂移
- 先查：ruby -v、which ruby、bundle env、Gemfile.lock RUBY VERSION、rbenv/asdf 配置、CI 与生产镜像、macOS/Linux、x86_64/arm64。
- 必做：确认 Ruby 3.3/3.4 小版本；Ruby 3.5 只能按 preview 口径处理，Ruby 4.0 只能按目标 release notes/CI matrix/生产镜像证据处理；必须核验 ABI、stdlib gem 化、native extension、Prism/parser、keyword arguments、pattern matching、frozen string、时区与编码。
- 排障：本机能跑但 CI/生产失败时，优先比对解释器、Bundler 版本、platform、native extension、openssl/readline/libyaml/yaml、环境变量。
- 验证：干净 shell、bundle exec、CI 同平台、关键命令复跑。

### 2. Rails 请求链路与分层
- 先查：routes、controller、before_action、middleware、format、view/serializer、消费方、认证授权、CSRF。
- 必做：Strong Parameters 或 schema 过滤输入；对象级授权服务端校验；HTML/JSON/Turbo 分支状态码一致；生产错误只暴露稳定错误和 request_id。
- 字段契约：create/update/patch 必须有明确 allowlist、required/optional、nullable、default、readonly、server-owned 字段边界；server-owned 字段如 tenant_id、user_id、role、status、price、deleted_at 只能由服务端上下文赋值。
- 强参数红线：禁止 `permit!` 放行整包参数；禁止 `update(params)`、`assign_attributes(params)`、`Model.new(params)` 接收未过滤输入；嵌套数组/hash 必须逐层列字段，未知字段要忽略或返回契约错误。
- 部分更新：PATCH 只改调用方显式提供的字段；用 `params.key?` 区分 absent/null，null 是否允许清空必须由契约声明；布尔 false、数字 0、空数组不能被 blank? 误判为未传。
- 排障：按钮隐藏不等于授权；before_action 顺序、skip、namespace、engine mount、format fallback 都要查。
- 验证：未登录、无权限、越权、参数错、HTML/JSON/Turbo、旧客户端兼容。

### 3. dry-rb 输入契约：Strong Parameters、ActiveModel、dry-schema、dry-validation
- 分层：Strong Parameters 只做 Rails mass assignment 白名单；ActiveModel validations 处理模型持久化体验；dry-schema 处理输入 coercion/shape/type；dry-validation 处理跨字段业务规则。
- 先查：controller params、form object/service、错误返回格式、i18n、nil/空字符串、数组/hash 嵌套、旧客户端兼容。
- 必做：外部输入先过滤再 coercion；业务规则不塞进 controller；错误映射保持 API/HTML/Turbo 一致；dry-validation 1.11/dry-schema 1.16 升级查 changelog。
- 通用字段契约：每个输入字段标明来源、类型、是否必填、是否可为 null、是否可部分更新、默认值、只读/服务端写、枚举范围和错误码；契约变化要同步 request spec、serializer/view、OpenAPI 或等价文档。
- 错误映射：ActiveModel validation、数据库唯一索引冲突、外键/非空/check 约束、dry-validation errors 要映射为稳定字段路径和业务错误；不能把数据库异常栈直接暴露给 API/HTML/Turbo。
- 验证：缺字段、空字符串、类型错、嵌套数组、未知字段、业务规则冲突、旧 payload。

### 4. Rack / middleware / request lifecycle
- 先查：Rack 2/3 版本、middleware 顺序、env、body 读写、header 规范、proxy headers、上传上限。
- 必做：Rack app 返回 status/headers/body；body 可迭代并可关闭；读取 request body 后 rewind 或安全 buffer；forwarded headers 只信任可信代理。
- 排障：CORS/session/auth 顺序、HEAD/streaming、大 body、multipart 和异常关闭资源常是隐藏根因。
- 验证：Rack::Lint 或 request spec，GET/POST/HEAD、异常、上传、代理头。

### 5. ActiveRecord 查询、N+1 与批处理
- 先查：SQL 日志、访问点、view/partial/serializer/job、关联、索引、分页、默认 scope、租户条件、数据量。
- 必做：按访问模式选 includes/preload/eager_load；必要时 strict_loading；大表用 find_each/find_in_batches；动态 where/order/select 用绑定或白名单；LIKE 用 sanitize_sql_like。
- 多租户/权限：所有读取、更新、删除和批处理必须从当前租户/当前用户授权范围起 query；`where(id: params[:id])`、bulk scope、restore scope 不能丢 tenant/account/org/policy 条件。
- 排障：N+1 常藏在 partial、mailer、serializer、policy、job；pluck/select 漏字段会触发二次加载。
- 验证：SQL 条数、EXPLAIN、分页边界、空数据、非法排序、生产级数据量。

### 6. 事务、锁、callback 与一致性
- 先查：事务边界、唯一索引、锁策略、状态机、外部副作用、after_commit、重试路径、旧数据。
- 必做：事务内只做本地原子写；外部 HTTP/邮件/Redis/job 放提交后；并发写用 unique index、lock_version、with_lock 或原子 SQL；callback 小而局部。
- 单行写：`update/update!` 前确认对象来自授权 scope；需要并发保护时使用 `lock_version`、`with_lock`、唯一索引或条件更新，并校验 affected rows，0 行要映射为版本冲突、权限失败或记录不存在。
- 批量写删：`update_all`、`delete_all`、`destroy_all` 默认高风险；必须写明是否绕过 validation/callback/touch/audit/counter cache，必须带租户/权限/状态条件，必须记录 affected rows，必要时分批、事务、dry-run 和可回滚方案。
- 软删恢复：使用 `deleted_at`、discard/paranoia 类软删时，默认 scope、唯一索引、关联计数、审计和恢复语义必须核对；`with_deleted`、restore、hard delete 只能在明确权限和租户 scope 内执行。
- 唯一性：应用层 uniqueness validation 只能改善体验；必须有匹配唯一索引或 partial unique index，软删场景要确认 `deleted_at` 是否进入唯一约束，数据库冲突要转成字段级校验错误。
- 排障：先查后写、after_save 二次 save、throw :abort 未处理、bulk write 绕过 validation/callback 都是高频坑。
- 验证：重复请求、并发、回滚、锁冲突、callback abort、bulk 写、job 重试。

### 7. Migration、schema 与 Rails model 漂移
- 先查：数据库类型、表大小、锁风险、旧代码读写路径、schema.rb/structure.sql、部署顺序、回滚需求、是否有 strong_migrations 或同类规则。
- 必做：已共享 migration 不编辑；复杂变更写 up/down 或 reversible；schema 变更与大规模 data migration 拆开；关键约束落 DB；迁移内避免调用会随版本变化的业务 model。
- 零停机：大表按 expand-contract；新增可空列、双写/回填/切读/加约束/删旧分步；索引优先并发创建；NOT NULL、默认值和外键先评估锁与批量校验。
- 排障：普通 add_index、带默认值加列、长事务回填、删字段、枚举变更、旧新代码不兼容最易锁表或发布失败；具体 SQL/窗口交 db。
- 验证：migrate、rollback、旧数据、空值/重复值、schema dump、旧新代码兼容、批量回填可重入、锁等待和发布顺序。

### 8. Zeitwerk、autoload、reload 与 engine
- 先查：路径/常量名、autoload paths、autoload once paths、inflector、lib、initializer、STI、engine namespace、eager_load。
- 必做：文件名匹配常量；缩写配置 inflector；Rails 7.1+ lib 用 config.autoload_lib 或明确 ignore/require；initializer 不缓存 reloadable class，必要时用 to_prepare 且幂等。
- 排障：APIClient/ApiClient、concern 命名、engine 隔离、console reload、production eager load 与 development lazy load 差异常导致线上才炸。
- 验证：bin/rails zeitwerk:check、test eager load、development reload、production boot。

### 9. Bundler、RubyGems、Gem native extension 与供应链
- 先查：Gemfile、Gemfile.lock、bundle config、source、groups、platform、Ruby ABI、RubyGems/Bundler 4.0 兼容、Apple Silicon、Linux 目标平台、私有源、CVE、yanked gem、license、checksum/lockfile 校验。
- 必做：Gemfile 与 lock 同步；应用命令用 bundle exec；新增/升级 gem 读 changelog、security advisory 和 Ruby/Rails 兼容；native extension 确认编译工具、系统库、预编译 gem、目标 platform。
- 供应链：只信任 trusted source；私有源 token 不进仓库/日志；校验 lockfile checksum；关注 typosquatting、yanked 版本、RubyGems MFA/发布权限、bundle audit 或项目等价审计、许可证、私有源权限最小化。
- 排障：Apple Silicon arm64-darwin、x86_64-linux、aarch64-linux platform 漂移；nokogiri/pg/mysql2/grpc/ffi/psych 常因系统库、ABI 或 Ruby 3.5 preview/Ruby 4.0 stdlib gem 化失败。
- 验证：bundle install/check/pristine、bundle audit 或等价扫描、lockfile platform/checksum、目标平台 boot、CI、依赖审计、私有源凭据最小化。

### 10. Sidekiq / ActiveJob / Redis / Rails 8 Solid Queue
- 先查：队列后端是 Sidekiq 8.1、Solid Queue 还是混用；队列名、并发数、retry/dead set、Redis/DB、job 参数、事务提交时机、连接池、限流、唯一键、幂等状态。
- 必做：只传 ID 和 JSON 简单值；job 内重新读取当前状态；外部 IO 设置 timeout 和错误分类；重复执行安全；enqueue 在 commit 后；迁移队列后端时明确重试语义、监控、drain 和回滚。
- Rails 8.1：Solid Queue 使用数据库存储时核算 DB pool、表增长、清理、锁等待和 worker 部署；不要让 Sidekiq 8.1 与 Solid Queue 对同一业务重复消费。
- 排障：Time/Symbol/AR 对象序列化、Redis/DB ACK 边界、进程崩溃、重试重复副作用、队列积压无告警、旧 job payload 不兼容。
- 验证：重复执行、失败重试、并发、rollback、Redis/DB 短故障、队列积压、dead/failed job、worker drain。

### 11. Hotwire / Turbo / Stimulus
- 先查：响应 format、status code、frame id、stream target、DOM id、CSRF、无 JS 路径、浏览器历史、缓存。
- 必做：Turbo Frame 返回匹配 frame 或明确跳转；Turbo Stream target 稳定唯一；失败表单返回 4xx；Stimulus controller 小而聚焦，connect/disconnect 可重复；自定义 fetch 带 CSRF。
- 排障：HTML 与 turbo_stream 分支漏鉴权、target 不存在、重复绑定全局事件、frame 嵌套导航异常。
- 验证：成功、validation 失败、刷新/返回、无 JS、权限、frame 缺失、stream target。

### 12. 测试、RuboCop / RSpec、类型与质量门禁
- 先查：Minitest 还是 RSpec/rspec-rails，RSpec Rails 8.0 与 Rails 8.1 兼容，factory/fixture、system driver、transactional tests、parallel tests、RuboCop 1.86 配置、CI 命令、是否启用 Sorbet/RBS/Steep/TypeProf。
- 必做：先写原 bug 红灯，再写修复绿灯；request spec 覆盖 HTTP 契约；system test 覆盖关键 Hotwire 流；异步等待业务信号不 sleep；rubocop 只按项目规则修相关文件。
- 类型：用 RBI/RBS/签名定位动态调用、接口漂移和 nil/枚举边界；生成文件不是验证，必须跑项目实际 typecheck；metaprogramming、ActiveRecord 动态方法和 monkey patch 要保留运行时测试。
- 排障：Rails 8 与旧 rspec-rails、Sidekiq fake/inline 语义差异、time travel 未还原、factory callback 外部副作用、测试 DB schema 未同步、system spec 本地过 CI flaky。
- 验证：相关 test/rspec、request/system/job/mailer、Hotwire system、Sidekiq fake/inline 目标场景、time travel、rubocop、typecheck、CI 产出；契约/变异/smoke 交 tst 定矩阵。

### 13. 安全、性能与部署实现
- 先查：输入 source 与 sink、session/cookie、signed/encrypted cookies、credentials/master key、filter_parameters、CSP、redirect、upload、ActionCable、Puma 8.0 threads/workers、DB/Redis pool、YJIT、GC、assets、health check、Brakeman 8.0 规则与误报基线。
- 必做：SQL/LIKE/order/shell/path/redirect/模板按 sink 参数化或白名单；secret 不进日志；mass assignment 只走强参数；ActiveStorage 校验服务端类型/大小；禁止反序列化不可信 YAML/Marshal。
- 性能：Puma 8/Sidekiq 8/Solid Queue/DB/Redis 连接池统一核算；YJIT 结合 RSS/P95/P99/GC.stat 验证；必要时用 stackprof、rbspy、rack-mini-profiler、heap dump、ActiveSupport notifications 采证。
- 部署：Rails 8 Propshaft/Sprockets 资产链、Solid Cache、Solid Cable、Kamal/Docker multi-arch、Heroku/Fly/Render/systemd、Puma phased restart、worker drain 与回滚顺序要按平台核实。
- 排障：GVL 不是业务锁；YJIT 提吞吐也可能涨内存；Bootsnap/cache invalidation、CDN digest、assets、worker restart、rollback 顺序常是发布后故障点。
- 验证：安全 payload、boot、assets precompile/404、migrate/rollback、smoke、P95/P99、RSS、pool、queue drain、health check。

## 高频坑 / 防遗漏

- 版本漂移：rbenv/asdf/system ruby、Bundler、Gemfile.lock、CI/生产镜像不一致。
- 依赖漂移：Gemfile 改了 lock 未变，或 lockfile platform 缺 Linux/arm64。
- 分层漂移：Controller、callback、helper、view 分散业务规则，无法完整回归。
- 权限漂移：只隐藏 UI，不做服务端鉴权和对象级授权。
- 查询漂移：N+1 出现在 partial/serializer/job，不在 controller 明面代码。
- 一致性漂移：validation 代替唯一索引/外键/非空/check。
- 参数漂移：`permit!`、`update(params)`、`assign_attributes(params)` 让调用方覆盖只读字段、租户字段、状态字段或软删字段。
- 部分更新漂移：未用 `params.key?` 区分 absent/null，导致 PATCH 漏改、误清空或无法清空。
- 批量写漂移：`update_all/delete_all/destroy_all` 绕过 callback、validation、审计和租户权限，且未检查 affected rows。
- 软删漂移：默认 scope 隐藏 `deleted_at` 数据，`with_deleted`/restore 漏租户条件或唯一索引未覆盖软删语义。
- 迁移漂移：编辑旧 migration、迁移依赖当前 model、schema 与 data 混在一个长事务。
- 事务漂移：事务内 HTTP/邮件/enqueue，锁等待放大故障。
- 加载漂移：Zeitwerk 路径常量不匹配，development lazy load 掩盖 production eager load。
- 队列漂移：Sidekiq 参数不可 JSON 序列化，job 非幂等，重试重复副作用。
- UI 漂移：Turbo frame/stream target、status、CSRF、无 JS 降级不一致。
- 性能漂移：Puma threads、Sidekiq/Solid Queue concurrency、DB pool、Redis pool、YJIT 内存互相打架。
- 类型漂移：只生成 RBI/RBS 不跑 typecheck，动态调用和 nil 边界仍在线上爆。
- 供应链漂移：source/token/yanked/checksum/platform 未核，CI 与生产不可复现。
- 资产漂移：Propshaft/Sprockets digest、预编译、CDN 缓存和 Docker 架构不一致。

防遗漏清单：
1. 改 route/controller：查 auth、CSRF、params、对象级授权、format、view/serializer、客户端。
2. 改 model/query：查 validation、callback、DB 约束、scope、关联、N+1、索引、租户、bulk write、affected rows、lock_version、软删/恢复。
3. 改 migration：查 rollback、旧数据、锁、schema dump、部署先后、旧新代码兼容。
4. 改 job/callback：查 commit 时机、幂等、重试、队列、连接池、外部副作用。
5. 改 Gemfile/Ruby：查 lock、platform、native extension、CVE、CI、生产镜像、bundle exec。
6. 改 Hotwire：查 HTML/Turbo 双分支、status、target、CSRF、无 JS、重复绑定。
7. 改性能部署：查 Puma/Sidekiq/Solid Queue pool、YJIT/RSS、assets、health、worker restart、rollback。
8. 改类型/依赖：查 Sorbet/RBS/Steep/TypeProf、lockfile checksum、source、CVE/yanked、platform、私有源凭据。
9. 改 Rails 8 默认栈：查 Solid Queue/Cache/Cable、Propshaft、Kamal、auth generator、旧项目兼容和回滚路径。

## 输出要求

1. 场景卡：说明命中的 Ruby/Rails/Rack/ActiveRecord/migration/Zeitwerk/Sidekiq/Hotwire/Bundler/测试/性能安全场景。
2. 版本证据：列 Ruby、Rails、Bundler、Rack、Gemfile.lock、DB adapter、Sidekiq/Redis、Puma、测试框架、OS/CPU；未查到标“需验证”。
3. 复现与根因证据：请求/job/命令、日志、SQL、堆栈、file:line、配置、release note 或 changelog 证据。
4. 影响面：route/controller/view/serializer/model/callback/migration/job/rake/initializer/Gemfile/test/deploy。
5. 风险点：鉴权、对象级授权、N+1、事务锁、migration、callback 副作用、Sidekiq 幂等、Zeitwerk、Hotwire、secret、性能。
6. 联动技能：实际读取的 api/db/wsec/rls/tst/obs/aud 及原因。
7. 验证结果：bundle、rails test/rspec、rubocop、zeitwerk:check、migrate/rollback、request/system/job、smoke、性能或无法验证原因。

## 约束

- 不重复定义全局触发规则；只给 Ruby/Rails 领域执行约束。
- 不凭“约定优于配置”猜事实；版本、配置、入口、调用方、数据规模不确定必须查。
- 优先项目已有 gem 和 Rails 内建能力；不得为单点问题引入新架构或新 gem。
- 不编辑已共享 migration；不把大规模 data migration 塞进 schema migration。
- 不把 validation/callback 当数据库一致性的唯一保障。
- 不在事务内做外部 IO；Sidekiq job 必须幂等且参数可 JSON 序列化。
- 不把授权、CSRF、敏感字段过滤交给前端、Turbo 或 Stimulus。
- 不用 `permit!`、`update(params)`、`assign_attributes(params)` 或未过滤 params 做 mass assignment；Strong Parameters/dry-schema/form object 必须先收窄字段。
- 不用 blank?/presence? 代替部分更新契约；需要明确 absent/null 时用 `params.key?` 或等价 schema 语义。
- 不在缺少租户/权限/状态条件、affected rows 检查和回滚说明时执行 `update_all`、`delete_all`、`destroy_all`。
- 不绕过乐观锁、唯一索引、软删 scope 或审计日志去“快速修数据”；需要绕过时必须写明原因、范围、验证和恢复方案。
- 禁止拼接 SQL、LIKE wildcard、order、shell、path、redirect、模板和不可信反序列化。
- 不在 ruby-dev 内代替 api/db/wsec/rls/tst/obs/aud 下最终结论。

## 高频 Bug 反例库

- 反例 1：N+1 藏在 partial
  - 错法：controller 只 includes 第一层关联，partial 又访问深层关联。
  - 对法：按实际渲染路径补 preload/includes，启用 strict_loading 或 SQL 计数测试。
  - 根因：N+1 发生在关联访问点，不一定在查询定义处。
- 反例 2：validation 当唯一性保障
  - 错法：只写 uniqueness validation，并发注册产生重复 email。
  - 对法：加唯一索引，捕获数据库冲突并映射业务错误。
  - 根因：应用层先查后写无法防竞争。
- 反例 3：事务里发外部请求
  - 错法：订单事务内请求支付、发邮件或调用 HTTP。
  - 对法：事务内只写本地状态，after_commit/job/outbox 处理副作用。
  - 根因：数据库锁与外部延迟耦合会放大故障。
- 反例 4：Sidekiq 传对象且非幂等
  - 错法：perform_async(user)、Time、Symbol，重试重复发券。
  - 对法：只传 ID/字符串等 JSON 简单值，任务内查当前状态并用幂等键。
  - 根因：Sidekiq 至少一次执行且 JSON 序列化会丢 Ruby 对象语义。
- 反例 5：编辑已提交 migration
  - 错法：线上跑过的 migration 被修改，本地新库正常但旧环境漂移。
  - 对法：新增 migration，写清 up/down、兼容和回滚。
  - 根因：migration 是历史事件，不是当前 schema 草稿。
- 反例 6：Zeitwerk 命名不匹配
  - 错法：api_client.rb 定义 APIClient，开发可用但生产 eager load 报错。
  - 对法：改 ApiClient 或配置 inflector，并跑 zeitwerk:check。
  - 根因：Zeitwerk 根据路径推导常量，缩写不声明就不稳定。
- 反例 7：Turbo 失败响应状态错误
  - 错法：表单验证失败仍 200，frame/stream target 不匹配。
  - 对法：HTML/Turbo 分支返回匹配 target 和 422 等合适状态。
  - 根因：Turbo 依赖 HTTP 状态和 DOM target 判断更新语义。
- 反例 8：Rack middleware 读 body 不 rewind
  - 错法：日志 middleware 读取 request body 后下游 controller 收到空 body。
  - 对法：读取后 rewind 或安全 buffering，并限制大小。
  - 根因：Rack input 是流，读取会改变后续消费位置。
- 反例 9：Bundler 部署依赖系统 gem
  - 错法：生产全局 gem 恰好存在，换容器或用户后启动失败。
  - 对法：提交 Gemfile.lock，bundle install/check，命令用 bundle exec。
  - 根因：应用依赖必须由 Bundler 固定，不应来自机器状态。
- 反例 10：Puma threads 与 DB pool 不匹配
  - 错法：RAILS_MAX_THREADS=10，database pool=5，高峰连接超时。
  - 对法：按每进程线程、worker、Sidekiq 并发和连接池上限统一核算。
  - 根因：Ruby 并发最终受 DB/Redis 等有限连接约束。
- 反例 11：Apple Silicon native extension 本地过 CI 挂
  - 错法：arm64-darwin lockfile 只在 Mac 可装，Linux x86_64/aarch64 部署缺平台或系统库。
  - 对法：为目标平台更新 lockfile，CI 在生产相同平台 bundle check，并固定 libpq/openssl 等系统依赖。
  - 根因：Gem native extension 受 Ruby ABI、CPU 架构和系统库共同约束。
- 反例 12：YJIT 只看吞吐不看内存
  - 错法：打开 YJIT 后 QPS 升了，但 RSS/P99/重启频率恶化。
  - 对法：生产相似压测记录 P50/P95/P99、RSS、GC、DB pool，再决定开关和内存参数。
  - 根因：YJIT 用内存换执行速度，容器限制下会触发抖动。
- 反例 13：Solid Queue 与 Sidekiq 混用无边界
  - 错法：同一业务既保留 Sidekiq worker 又接入 Solid Queue，监控只看一边。
  - 对法：迁移前冻结入口、drain 旧队列、明确重试语义、监控与回滚。
  - 根因：队列后端语义、存储和可观测不同，混用会重复消费或漏告警。
- 反例 14：大表 migration 锁表
  - 错法：高峰期直接 add_index 或加 NOT NULL/default 并同步回填。
  - 对法：expand-contract、并发索引、分批回填、先校验旧新代码兼容再切读删旧。
  - 根因：DDL 锁、长事务和旧代码写入会把发布窗口变成线上故障。
- 反例 15：类型检查只生成不执行
  - 错法：生成 Sorbet RBI 或 RBS 后不跑 typecheck，动态方法变更线上才炸。
  - 对法：CI 跑项目实际 typecheck，并用运行时测试覆盖 metaprogramming 和 ActiveRecord 动态方法。
  - 根因：签名文件是输入证据，不是接口正确性的验证结果。
- 反例 16：ActiveStorage 只信前端 MIME
  - 错法：前端限制图片上传，服务端直接展示用户文件。
  - 对法：服务端校验 content type、大小、扩展名和处理器结果，下载/预览走安全响应头。
  - 根因：客户端 MIME 可伪造，上传文件会进入浏览器、存储和后台处理多个 sink。
- 反例 17：YAML/Marshal 反序列化不可信输入
  - 错法：从参数、旧缓存或队列 payload 直接 YAML.load/Marshal.load。
  - 对法：只解析可信格式，使用安全加载和白名单，并为旧缓存对象设计失效/迁移。
  - 根因：Ruby 反序列化可触发对象构造副作用，旧类变更也会导致启动或运行失败。
- 反例 18：Propshaft/Sprockets 发布资产漂移
  - 错法：迁移资产链后没验证 digest、precompile 和 CDN 缓存，发布后 404。
  - 对法：按目标环境跑 assets precompile、检查 manifest/digest、CDN 刷新和回滚资产版本。
  - 根因：Rails 8 默认资产选择与旧项目配置可能不同，构建产物和缓存必须成对验证。
- 反例 19：Strong Parameters 放开整包
  - 错法：为了省事用 `permit!` 或把 controller `params` 直接传给 `update(params)`。
  - 对法：按 create/update/patch 场景列 allowlist，只允许调用方可写字段，租户、角色、状态、价格、deleted_at 由服务端写。
  - 根因：Rails mass assignment 会把未授权字段一并写入，前端隐藏和表单缺省都不是安全边界。
- 反例 20：PATCH 把未传字段当清空
  - 错法：用 blank?/presence? 判断字段，false、0、空数组、null 和 absent 被混在一起。
  - 对法：用 `params.key?` 或 schema presence 信息判断字段是否传入，再按契约决定 null 是否代表清空。
  - 根因：部分更新的核心语义是“只改显式字段”，不是“把参数归一成真假值”。
- 反例 21：bulk update 绕过保护
  - 错法：`update_all(status: "archived")` 直接扫表，没有 tenant scope、callback、validation、审计或 affected rows 校验。
  - 对法：从授权 scope 起步，补状态条件，预估和记录 affected rows；需要 callback/审计时逐批加载或写专门审计记录。
  - 根因：ActiveRecord bulk API 走 SQL 快路径，会绕过很多模型层保护。
- 反例 22：软删恢复越权
  - 错法：`with_deleted.find(params[:id]).restore` 没有限定当前租户或当前用户权限。
  - 对法：在 tenant/account/org scope 内使用 `with_deleted`，restore 前校验权限、唯一索引冲突和关联状态。
  - 根因：软删记录仍是业务数据，默认 scope 只是隐藏，不会自动提供授权边界。
- 反例 23：rescue 后返回成功
  - 错法：`rescue StandardError` 后记录一行日志并返回 success，调用方以为状态已更新。
  - 对法：按异常类型返回稳定错误、触发重试或回滚，并保留 request_id/job id 与失败状态。
  - 根因：Ruby 宽泛异常捕获会吞掉数据库、授权、网络和代码错误，破坏真实业务状态。
- 反例 24：validation 和 authorization 混在一起
  - 错法：在 model validation 里判断 current_user，或只校验字段合法就允许更新他人资源。
  - 对法：授权放 policy/service scope，validation 只处理对象自身约束，数据库约束兜底一致性。
  - 根因：数据合法不等于用户有权操作，Rails model 也不天然知道请求身份。
- 反例 25：callback 里发外部请求
  - 错法：after_save 直接调用支付、短信或第三方 API，失败时事务和外部状态互相卡住。
  - 对法：事务提交后入幂等 job 或 outbox，外部调用有 timeout、重试、去重和补偿。
  - 根因：callback 隐蔽且自动触发，副作用会被重试、批处理、测试和控制台操作误触发。
- 反例 26：timezone 漂移
  - 错法：业务截止时间用 Time.now 和 Date.today，本地正常，跨时区或 DST 当天错单。
  - 对法：统一 Time.zone、数据库存储和展示转换，测试冻结时间覆盖边界日。
  - 根因：Ruby/Rails/数据库/浏览器各有时区语义，默认值不一致会变成生产数据错乱。
- 反例 27：nil 和 blank? 偷换业务语义
  - 错法：用 presence 合并参数，false、0、空数组和用户清空字段被当成未传。
  - 对法：按字段契约区分 absent、nil、空值和 false，部分更新用 key? 或 schema 元信息。
  - 根因：Rails 便利方法服务展示和表单，不适合替代持久化契约。
- 反例 28：migration 不可回滚
  - 错法：删除列、改枚举或回填数据没有 down/reversible，发布失败只能手工修库。
  - 对法：拆 expand-contract，写 rollback 或明确不可回滚原因、备份、验证和恢复步骤。
  - 根因：Rails migration 是线上发布动作，不是只给本地 schema 看的脚本。
- 反例 29：生产日志泄露 token
  - 错法：debug 打开后把 Authorization、cookie、params、credentials 或第三方 token 打进日志。
  - 对法：配置 filter_parameters、日志分级和结构化脱敏，只保留 request_id 与必要业务字段。
  - 根因：Rails 日志会流入 APM、对象存储和客服排障链路，一次泄露会扩散。
- 反例 30：RSpec 只测 model 不测请求
  - 错法：model spec 全绿，但 controller 参数、授权、status、serializer、Turbo 分支全漏。
  - 对法：按改动面补 request spec、system spec、job spec 和 migration 验证，至少覆盖失败路径。
  - 根因：Rails 真实故障常发生在框架边界，单层测试不能证明端到端契约正确。

## 提交前自检清单

- [ ] frontmatter name 等于 canonical name（ruby-development），旧 slug 只作兼容 alias/URL 主键。
- [ ] 正文少于 500 行，fenced code block 数为 0，正文不含三反引号。
- [ ] 章节齐全：快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例不少于 30 条，且每条有错法、对法、根因。
- [ ] 覆盖 Ruby 3.3/Ruby 3.4/Ruby 3.5 preview/Ruby 4.0、Rails 7.1/Rails 7.2/Rails 8.1、Zeitwerk、Bundler、rbenv/asdf、YJIT、Ractor、Fiber scheduler、ActiveRecord/N+1、Sidekiq/Solid Queue、Hotwire/Turbo、rubocop/rspec、Sorbet/RBS/Steep/TypeProf、Gem native extension、Apple Silicon。
- [ ] 已核对 migration、callback、Sidekiq/Solid Queue、Zeitwerk、Hotwire、Bundler/RubyGems 供应链、dry-rb 输入契约、Puma/DB/Redis pool 均有失败兜底。
- [ ] 已核对 api、db、wsec、rls、tst、obs、aud 边界，不越权替相邻技能下最终结论。
- [ ] 更新后用 no-cache 远端 raw 验证 X-Skill-Version、X-Backend、章节、关键词、反例数和本地文件无修改。

## 2024-2026 新坑速查

- Ruby 3.3：YJIT 更常进入生产默认评估，Prism、GC、标准库 gem 化与 native extension 兼容需用 release notes 和目标平台验证。
- Ruby 3.4：默认 gem/bundled gem 变化、warning、parser 与 C extension 兼容可能让旧 gem 在 CI 才失败；先 bundle update 目标 gem 并跑完整测试。
- Ruby 3.5：按 preview 处理；未确认项目实际支持前不得假设语法、ABI 或 gem 兼容；升级方案必须先查 release notes、CI matrix、stdlib gem 化、native extension、生产镜像。
- Ruby 4.0：按大版本升级处理；必须核验 release notes、CI matrix、stdlib gem 化、ABI/native extension、parser/Prism、生产镜像和回滚。
- Rails 7.1：config.autoload_lib、Dockerfile 默认、异步查询、加密与默认配置变化会影响旧 initializer 和部署。
- Rails 7.2：更现代的默认值、YJIT/Kamal/Solid 生态联动增强，升级前查 new_framework_defaults、deprecations 和 gem compatibility。
- Rails 8.1：Solid Queue/Cache/Cable、Kamal、Propshaft、authentication generator 等默认选择会影响队列、缓存、部署、资产链路和认证入口；升级旧项目必须先确认启用状态、替代关系、回滚与监控。
- Rack 3：旧 middleware/server/body/header 规范可能不兼容；自定义 middleware 要用 Rack::Lint/request specs 验证。
- Zeitwerk strictness：development lazy load 掩盖 production eager load，initializer 缓存 reloadable class 会产生旧对象。
- Hotwire/Turbo：多格式响应让状态码、target、权限分支容易漂移；HTML/Turbo/request/system 都要覆盖关键路径。
- Sidekiq 8.1：exactly-once 是误解；Redis ACK、进程崩溃、重试都会导致完成后重跑，升级查 changelog、payload、middleware、监控与 drain，必须靠幂等和约束兜底。
- Bundler platform drift：Apple Silicon、本地 macOS、Linux 容器、x86_64/arm64 lockfile platform 不一致会造成部署失败。
- Ractor/Fiber scheduler：不要把 Ractor 当普通线程池；Fiber scheduler 只对支持的非阻塞 IO 有效，gem 不兼容时会退化或阻塞。
- RuboCop 1.86 / RSpec Rails 8.0：自动修复可能改变语义；request/system 与 Rails 8.1 兼容、异步等待和 factory callback 副作用要单独验证。
- Puma 8.0：Rack/Rails 兼容、threads/workers、phased restart、信号处理、DB/Redis pool 和 health check 需在目标平台验证。
- Brakeman 8.0：规则变化和忽略基线需复查；高危项交 wsec 复核。
- dry-validation 1.11 / dry-schema 1.16：coercion、业务规则和错误映射需与 Strong Parameters、ActiveModel validations 分层。
- Sorbet/RBS/Steep/TypeProf：类型生成只能作为线索；CI typecheck、运行时测试和动态调用证据缺一不可。
- RubyGems 供应链：trusted source、checksum、yanked/CVE、私有源 token、MFA/发布权限和许可证风险必须与 lockfile 一起核对。

## 与相邻技能的边界

- API 工程/api-engineering（api）：Ruby 开发/ruby-development（rb） 只实现 Rails endpoint、参数过滤和返回组装；API 资源模型、状态码、错误码、版本化、OpenAPI、Webhook 契约由 API 工程/api-engineering（api） 决定。
- 数据库工程/database-engineering（db）：Ruby 开发/ruby-development（rb） 只识别 ActiveRecord/migration 实现风险；表结构、索引策略、SQL 优化、迁移窗口、大表 DDL、数据修复由 数据库工程/database-engineering（db） 决定。
- Web 安全/web-security（wsec）：Ruby 开发/ruby-development（rb） 处理 Rails 侧安全实现；威胁建模、漏洞评级、跨栈安全策略、渗透复验由 Web 安全/web-security（wsec） 决定。
- 发布部署/release-engineering（rls）：Ruby 开发/ruby-development（rb） 提供 Ruby/Rails 启动、assets、migrate、worker restart、bundle 的实现证据；灰度、回滚、发布门禁由 发布部署/release-engineering（rls） 决定。
- 测试验证/test-engineering（tst）：Ruby 开发/ruby-development（rb） 给出 rspec/Minitest/rubocop/zeitwerk 相关验证点；完整测试矩阵、CI 策略、回归分层由 测试验证/test-engineering（tst） 决定。
- 可观测性/observability（obs）：Ruby 开发/ruby-development（rb） 提供 Rails logs、SQL、Sidekiq、Puma、YJIT 等信号位置；SLI/SLO、告警、trace/metrics/logs 治理由 可观测性/observability（obs） 决定。
- 代码审计/code-audit（aud）：Ruby 开发/ruby-development（rb） 完成实现自检；所有代码改动最终由 代码审计/code-audit（aud） 对需求、影响面、安全、验证证据收口。