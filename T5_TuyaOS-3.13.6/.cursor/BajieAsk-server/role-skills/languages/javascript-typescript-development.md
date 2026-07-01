---
name: javascript-typescript-development
description: JavaScript/TypeScript 开发技能，覆盖 Node 20/22、Bun、Deno、Edge/serverless、TS 5.x/6.0、ESM/CJS、Vite、Next/React、Vue/Nuxt、pnpm/npm/yarn、monorepo、Vitest/Playwright、浏览器兼容、SSR/hydration、fetch/AbortController、类型安全、性能、安全供应链、sourcemap 与依赖排障。
---

# JavaScript/TypeScript 开发

JavaScript/TypeScript 开发（javascript-typescript-development，兼容 slug: jsts）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

## 快速总则（版本/运行时/入口/证据）
- 版本以事实为准：Node 20/22/24、Bun、Deno、Edge/serverless、packageManager、TS 5.x/6.0、框架、浏览器目标、CI 镜像与部署平台。
- 入口先读：package.json scripts、tsconfig、构建配置、框架配置、测试配置、src/main、app/pages/api/server、serverless/edge 入口。
- 证据先行：保留命令、错误栈、环境变量差异、dev/build/preview/test/e2e 模式、浏览器或运行时版本、部署日志。
- 改前搜全引用：公共类型、导出、路由、请求封装、环境变量、构建配置、别名、状态模型、schema/codegen、发布配置。
- 改后闭环：给 typecheck、test、build、preview、e2e、部署仿真或复现命令；未跑说明原因和风险。
- 假设只驱动搜索：先确认运行时、模块系统、框架边界、数据契约、权限和缓存，再落修改。

## 单技能工程门禁
- 先定运行面：这是浏览器、Node 服务、CLI、库、Serverless、Edge、Worker、Bun 还是 Deno；同一份 TS 在不同运行面不能默认等价。
- 先定契约面：外部输入、API 响应、env、URL、FormData、localStorage、message event、队列消息、webhook、DB 返回都算不可信输入；TypeScript 类型不能替代运行时 schema。
- 先定产物面：dev server、typecheck、unit test 只证明局部；必须按目标产物补 build、preview/start、目标 runtime、浏览器或部署仿真证据。
- 先定失败面：loading、empty、error、permission、timeout、cancel、retry、offline、slow network、duplicate submit、stale response 必须有处理或明确不适用。
- 先定安全面：客户端包、source map、日志、错误上报、console、trace、analytics 不得出现 token、cookie、secret、连接串、内部 URL 或用户敏感字段。
- 先定回归面：改公共类型、请求封装、env、构建配置、包管理、polyfill、tsconfig、exports 时，至少覆盖调用方搜索、类型检查、构建和一个运行时验证。

## 硬禁止与低级错拦截
- 禁止只跑 `tsc --noEmit` 就声明功能可用；TS 只能证明静态类型，不证明运行时数据、网络、DOM、SSR、权限、缓存和部署。
- 禁止用 `as any`、双重断言、`unknown as T`、关闭 strict、跳过 lint、扩大索引签名来压错；必须解释边界并收敛到 schema、泛型约束或显式转换。
- 禁止把 JSON.parse、fetch response、req.body、event.data、localStorage、process.env、URLSearchParams 当成可信类型；必须先 parse、validate、narrow、map。
- 禁止把 Partial<T>、Pick<T>、Omit<T> 直接当外部写入契约；它们只改编译期形状，不表达 absent/null/default/权限/只读字段。
- 禁止默认重试非幂等 POST、支付、下单、扣库存、发消息、发邮件、写文件、写 DB；重试必须有幂等键、去重、唯一约束或明确只读语义。
- 禁止 fetch/axios/promise 没有 timeout、cancel、错误分类和并发覆盖；用户切换参数、组件卸载、请求超时和重复提交都要有行为定义。
- 禁止 env 缺失时静默用空字符串、默认生产地址或 fallback 密钥；启动前校验 env schema，区分 public env 和 server-only env。
- 禁止混用 ESM/CJS 后只在本机 dev 通过；必须验证目标 Node/bundler/test runner 的解析路径、exports、types 和产物。

## P0：2026 迁移与工具链分叉

### TypeScript 6.0 与 type stripping
- 检查项：确认 `typescript` 版本、`tsconfig` 继承链、`erasableSyntaxOnly`、`verbatimModuleSyntax`、`module`/`moduleResolution`、运行时是否直接执行 TS。
- 风险：type stripping 只擦可擦语法；`enum`、`namespace`、parameter property、`import = require()` 等需运行时转译的语法会失败或产物语义变化；`verbatimModuleSyntax` 会暴露 type/value import 边界。
- 验证命令：`npx tsc --noEmit`、`node --experimental-strip-types <entry>.ts` 或目标 runtime 等价命令、`npm run build`、覆盖 enum/namespace/parameter property/import= 的最小样例。

### pnpm 10/11 build-script 审计
- 检查项：确认 `packageManager`、lockfile、`pnpm-workspace.yaml` 的 `catalog`/`catalogs`、`allowBuilds`、`strictDepBuilds`、`pnpm approve-builds` 输出。
- 风险：安装脚本默认收紧后 native addon、二进制下载、代码生成可能静默缺产物；`onlyBuiltDependencies` 属旧分叉配置，迁移时不要把它当 pnpm 10/11 的唯一来源。
- 验证命令：`pnpm install --frozen-lockfile`、`pnpm approve-builds`、`pnpm ignored-builds`、`pnpm rebuild`、干净 CI/容器安装后跑 `pnpm test`/`pnpm build`。

### Next cache / Cache Components
- 检查项：确认 Next 版本、`cacheComponents`、`use cache`、`cacheLife`、`cacheTag`、`revalidateTag`、RSC/Route Handler 边界和动态函数位置。
- 风险：`cookies()`、`headers()`、请求态鉴权、用户态数据不得进入 cached scope；缓存键和 tag 设计错误会导致跨用户污染或失效不生效。
- 验证命令：`next build`、`next start`/preview、带不同用户 cookie/header 的刷新测试、触发 `revalidateTag` 前后命中/失效日志。

### React Compiler
- 检查项：默认不开启；只按项目约定 opt-in，确认 Babel/SWC 插件、compiler lint、诊断输出、第三方库副作用与 memo/useMemo/useCallback 策略。
- 风险：非纯渲染、可变对象、第三方副作用和不稳定引用会被编译诊断拦下或造成性能/行为回归。
- 验证命令：`eslint` React Compiler 规则、框架编译诊断、关键页面交互测试、React Profiler/Web Vitals/bundle diff 回归对比。

### Node permission model
- 检查项：确认是否使用 `--permission`、`--allow-fs-read`、`--allow-fs-write`、`--allow-net`、`--allow-worker`，代码中用 `process.permission.has()` 做能力探测。
- 风险：Node permission 不是安全沙箱；native addon、子进程、环境变量、平台能力仍需按威胁模型评估，不能替代容器/OS 隔离。
- 验证命令：最小权限启动 `node --permission --allow-fs-read=... --allow-net=... app.js`，补拒绝路径测试和目标部署启动命令。

### ESLint flat config / Prettier / Biome
- 检查项：确认 `eslint.config.*`、TypeScript parser/project service、ignore 迁移、插件 flat config 兼容；明确 Prettier 负责格式化、ESLint 负责质量规则，或由 Biome 统一格式/部分 lint。
- 风险：`.eslintrc`/`.eslintignore` 旧配置未迁移会漏扫；Prettier 与 Biome/ESLint format 规则重叠会互相改动；monorepo 子包配置可能未继承。
- 验证命令：`npx eslint . --max-warnings=0`、`npx prettier . --check` 或 `npx biome check .`、CI 同命令和被忽略文件抽样。

## 场景执行卡

### 1. 运行时矩阵：Node/Bun/Deno/Edge/serverless
- 查 node -v、engines、CI image、corepack、lockfile、目标 runtime、adapter、部署限制与本地仿真方式。
- 判 fetch/undici、WebCrypto、Node test runner、OpenSSL、V8、native addon、node: 模块、worker、TLS、文件系统和网络 API 差异。
- Deno 需查权限模型、npm/JSR 依赖、import 解析、读写/网络权限；Edge/serverless 需查 cold start、bundle size、CPU/内存、fs/net/tls 不可用或受限。
- 验目标运行时下安装、类型、测试、构建、启动、部署仿真；Bun/Deno/Edge 不默认等价 Node。

### 2. 模块系统：ESM/CJS/exports
- 查 type、exports、imports、main/module/types、typesVersions、moduleResolution、mjs/cjs 产物、条件导出和工具链解析。
- ERR_REQUIRE_ESM 优先修 import/require 边界；dual package hazard 需防 ESM/CJS 两份实例导致 singleton/context 失效。
- 库发布要验 Node、bundler、test runner、TS 声明、默认导入、子路径导出和 tree-shaking。

### 3. TypeScript 5.x/6.0 与类型安全闭环
- 查 extends、strict、paths、bundler/node16/nodenext、verbatimModuleSyntax、erasableSyntaxOnly、exactOptionalPropertyTypes、noUncheckedIndexedAccess、satisfies、decorators。
- 修泛型、边界类型、type-only import；外部输入优先 unknown 加运行时校验，不用 any、类型断言或关闭 strict 压错。
- 对 env、API 响应、存储、postMessage、URL 参数使用 zod/valibot/typebox/io-ts 等 schema 或等价校验；校验结果再进入业务类型。
- API 类型生成、DTO/schema 共享和契约测试需防前后端漂移；改公共类型前搜消费方并验 tsc --noEmit。

### 3A. 字段契约、三态与校验边界
- 分层命名要明确：Input 只表示外部原始输入，DTO 表示接口传输契约，Domain 表示业务不变量，Entity 表示持久化模型，Response 表示对外输出；禁止把 ORM Entity 或 Domain 直接暴露成请求/响应契约。
- 三态必须写清：absent 表示不变或未提交，undefined 表示 JS 运行时缺值但 JSON 不可表达，null 表示显式清空；启用 exactOptionalPropertyTypes 时尤其要区分 optional、nullable、nullish。
- PATCH/部分更新不能直接拿 Partial<T> 当外部契约；必须定义专门 UpdateDTO/schema，逐字段声明是否允许 absent、undefined、null、空字符串、空数组和默认值。
- Zod、TypeBox、Valibot、io-ts 或等价 schema 要和运行时策略绑定：strip 会丢弃未知字段，strict 会拒绝未知字段，passthrough 会保留未知字段；写接口默认优先 strict 或显式白名单。
- 校验后再映射：Input -> DTO -> Domain command -> ORM write data -> Response；不要把 req.body、FormData、URLSearchParams、JSON.parse 结果直接 spread 进业务对象或数据库写入。
- Response 契约要做反向过滤：敏感字段、内部状态、软删标记、租户字段、权限字段和审计字段默认不从 Entity 自动透出；字段重命名和兼容废弃字段要有版本或迁移说明。
- 验证项：覆盖 absent/undefined/null、未知字段、类型错误、空值清空、默认值填充、Response 字段过滤和 schema 与 TS 类型一致性。

### 4. 构建工具：Vite/Rollup/tsup/unbuild/Biome/ESLint
- 查 plugins、optimizeDeps、build.target、proxy、envPrefix、base、SSR external、sourcemap、sideEffects、alias、define、minify。
- dev 可用 build 崩多为 Rollup/CJS/Node polyfill/env/SSR external 差异；HMR 会掩盖冷启动、build、SSR、preview 问题。
- Toolchain 需查 ESLint flat config、Biome、Prettier、Jest/Vitest 迁移、Node test runner 差异；验 build+preview+lint/typecheck。

### 5. React/Next：SSR/RSC/Server Actions/hydration
- 查 app/pages、Server/Client Component、use client、Server Actions、dynamic ssr:false、cookies/headers、cache/revalidate、use cache/cacheLife/cacheTag/revalidateTag、route handlers。
- Date/random/window/localStorage、客户端库副作用、非稳定序列化会导致 hydration mismatch；客户端鉴权不可作为服务端权限。
- BFF/API routes/server actions 要明确认证、权限、错误语义、缓存失效和 DTO/schema；验 next build、首屏刷新、慢网和权限路径。

### 6. Vue/Nuxt：Composition/Pinia/SSR
- 查 Vue 3 composition、setup、reactivity、Pinia、Nuxt SSR、plugins、islands/client-only、runtimeConfig、route rules。
- 直接访问 window/document/localStorage、客户端 only 插件、状态序列化不一致会导致 Nuxt hydration mismatch。
- 验 dev/build/preview、首屏刷新、路由切换、store 持久化、服务端与客户端 runtimeConfig 差异。

### 7. 请求、API 边界与缓存
- 查 baseURL、credentials、CORS、CSRF、timeout、retry、AbortController、Node fetch/浏览器 fetch、流式、FormData、错误码。
- 处理取消、竞态、401/403、重试幂等、缓存键、失效、分页、乐观更新；慢响应不得覆盖新数据。
- API 契约、认证语义和错误码联动 api；安全策略联动 wsec；验慢网、并发、超时、错误态和权限态。
- fetch 默认没有业务 timeout；必须用 AbortController、运行时支持的 timeout signal 或封装层超时策略，并把 abort、network error、HTTP error、schema error 分开处理。
- 重试策略必须按 method 和业务幂等性分级：GET/HEAD 可谨慎重试；PUT/DELETE/PATCH 依业务版本或幂等键；POST 默认不重试，除非有 idempotency key 和服务端去重证据。
- 请求封装不得吞错误：返回值要携带状态码、业务码、request id、可重试标记和用户可展示错误；日志只记脱敏上下文，不记 Authorization、Cookie、Set-Cookie、密码和 token。
- 缓存键必须包含影响结果的用户、租户、权限、语言、区域、query、版本和 feature flag；用户态数据不得进入跨用户全局缓存。

### 7A. 编辑、删除、部分更新与 ORM 写保护
- 创建、编辑、部分更新、删除要分别建契约：CreateDTO 不接受 id/tenantId/role/audit 字段，UpdateDTO 不接受不可变字段，PatchDTO 明确三态语义，DeleteDTO 只接受定位和幂等控制所需字段。
- ORM 写入必须白名单映射：Prisma、Drizzle、TypeORM、Sequelize、Knex 都不能直接把请求对象 spread 到 data/set/update；只允许 schema 校验后的显式字段进入 create/update/delete。
- where 条件必须包含租户、归属、权限或可见性过滤；更新和删除不得只按 id 命中，后台任务也要区分系统权限和用户权限。
- affected rows 是写操作证据：update/delete/soft delete 后检查 affected/count/rowCount/returning 结果；0 行要映射为 NotFound、Forbidden 或幂等成功，不能静默当成功更新。
- 软删优先写 deletedAt/deletedBy/deleteReason/version 等字段，并保证普通查询默认过滤软删；硬删必须确认级联、审计、备份、外键和恢复策略。
- DELETE 默认按业务定义幂等：已删除资源可返回 204/200，越权资源不得泄露存在性；批量删除要有上限、事务、逐项结果或失败回滚策略。
- 乐观锁和并发要明确：version/updatedAt 条件失败映射 409；重复提交、重试和超时重放要结合幂等键或唯一约束。
- 错误映射要稳定：校验失败 400/422，未登录 401，无权限 403，不存在 404，冲突 409，限流 429，数据库约束映射业务错误；不要把 ORM 原始错误、SQL、表名和字段泄露给客户端。
- 验证项：覆盖未知字段被拒或 strip、不可变字段不可改、tenant 过滤、权限过滤、null 清空、absent 不变、affected rows 为 0、软删后二次 DELETE、唯一约束冲突和事务回滚。

### 8. 异步并发、Worker、Stream、上下文
- 查 Promise.all/allSettled、队列、限流、取消传播、AbortSignal、worker_threads/Web Worker、stream/backpressure、AsyncLocalStorage。
- 禁固定 sleep 治竞态；注意资源泄漏、未清理 timer/listener、请求上下文跨并发或 worker 丢失。
- 验并发、取消、重试、超时、压测样本、event loop lag、内存增长和日志 request id 贯通。
- Promise 必须有归宿：await、return、catch、allSettled 或显式 fire-and-forget 监控；未处理 rejection、浮空 promise、forEach async、map async 未 await 都视为缺口。
- 并发写要有上限和顺序语义：批量任务、上传、爬取、队列消费、发通知要控制 concurrency、重试退避、失败收敛、取消传播和部分失败结果。
- Stream 必须处理 backpressure、error、close、abort 和资源释放；不要把大文件、响应体、日志批量读进内存后再处理。

### 9. 包管理、monorepo 与发布
- 查 packageManager、corepack、npm/yarn/pnpm/bun lockfile、workspace、catalog/catalogs、allowBuilds、strictDepBuilds、workspace protocol、overrides、peer、postinstall、registry。
- pnpm 不依赖幽灵依赖；Bun install 不等价 npm/pnpm；私有 registry fallback、npm token、lockfile 污染要查。
- Monorepo 查 Turborepo/Nx、project references、构建拓扑、类型产物、exports、changesets、发布矩阵和 CI 缓存。
- 只能保留一个权威 lockfile；packageManager 与 lockfile 不一致、npm/yarn/pnpm/bun 混装、CI 没启 corepack 都要先收敛。
- 新增依赖前查是否已有等价工具、是否需要运行时依赖还是 devDependency、是否引入 postinstall/native addon、是否影响 browser bundle。
- 库发布必须验 package exports、types、sideEffects、files、peerDependencies、source map、CJS/ESM 双入口和实际 npm pack 内容。

### 10. 测试：Vitest/Playwright/Jest/Node test runner
- 查 environment、setupFiles、fake timers、mock reset、baseURL、storageState、browser/channel、coverage provider、并行隔离。
- flaky 禁固定 sleep；等待 URL、locator、响应、业务文本或可观测状态；隔离 storageState、时钟、网络 mock。
- 验重复跑、trace/video、失败截图、CI 目标浏览器、目标运行时和迁移差异。
- 测试矩阵按风险选：纯类型工具跑 typecheck+unit；请求/状态跑 schema+错误态+取消；UI 跑组件/e2e/浏览器；SSR 跑 build+preview+首屏刷新；库跑 pack+消费方样例。
- Mock 必须贴近真实契约：响应字段、状态码、延迟、错误、空数据、权限和 schema 漂移要覆盖；只 mock happy path 不算接口可用。
- 测试环境要清理全局状态、timer、listener、mock、localStorage、IndexedDB、cookie、fetch stub 和 AsyncLocalStorage；并行测试不得共享用户态状态。

### 11. 性能与观测
- 查 bundle 分析、chunk、tree-shaking、sideEffects、barrel export、React/Vue 渲染、memo、虚拟列表、Node profiling、内存泄漏。
- 关注 cold start、event loop lag、stream/backpressure、缓存命中、CDN base、asset hashing、字体跨域、MIME。
- 验 Lighthouse/Web Vitals、bundle budget、profile、heap snapshot、压测样本或线上指标；未有观测标缺口。

### 12. 安全与供应链
- 查 VITE_/NEXT_PUBLIC_ 暴露、client bundle 字符串、XSS sink、dangerouslySetInnerHTML、URL 注入、prototype pollution、CORS/CSRF、JWT 存储。
- 查依赖维护状态、下载源、postinstall、许可证、包名投毒、维护权转移、npm token、registry 配置、SRI/CSP、source map 暴露。
- 密钥不得进 client bundle、source map、日志或错误上报；安全策略联动 wsec/dso。
- 前端安全边界要分清：隐藏按钮、路由守卫、disabled、菜单过滤、客户端 role 判断都不是权限；服务端仍需对象级授权和字段级白名单。
- Node 服务安全边界要分清：CORS 不是认证，JWT decode 不是验签，cookie 存在不是登录，IP/header 不可信，proxy header 需由可信网关注入。
- 日志脱敏默认覆盖 Authorization、Cookie、Set-Cookie、x-api-key、password、secret、token、refreshToken、session、private key、邮箱/手机号等敏感字段。

## 高频坑/防遗漏
- Vite 只暴露 VITE_；Next 浏览器侧只暴露 NEXT_PUBLIC_；密钥不得进 client bundle。
- tsconfig paths 不会自动同步 bundler/test/runtime；Vite、Vitest、Jest、Node 需分别确认。
- Edge runtime 不等于 Node runtime，fs/net/tls/crypto 全量 API 默认不可用。
- Deno 受权限和模块解析约束，npm/JSR 依赖、文件读写、网络访问需显式验证。
- Monorepo 要查 workspace、peer、构建顺序、类型产物、exports 和 project references。
- CDN base、asset hashing、publicDir、字体跨域、MIME 会导致构建后资源异常。
- Date/Intl/timezone 在 Node、浏览器、Edge runtime、serverless 区域可能不同。
- 新增依赖必须看维护状态、下载源、postinstall、许可证、替代方案和锁文件污染。
- 客户端鉴权、隐藏按钮、前端路由守卫都不能替代服务端权限。
- source map 可用于排障，也可能泄露源码、路径和密钥片段；发布策略需确认。
- Serverless 全局缓存、单例、连接池可能跨请求复用，需防租户或用户数据污染。
- TypeScript 的 optional、nullable、undefined 和 JSON null 不是同一件事；接口和表单更新必须写清三态。
- `void promise`、事件回调、setTimeout、队列任务和 worker 消息都要有错误上报路径；否则线上失败只会静默丢。
- `process.env.FOO || default` 会把空字符串和缺失混为一谈；配置校验要给出启动失败证据。

## 输出要求
- 输出关键事实：版本、运行时、入口、配置、错误日志、调用方、消费方、部署/CI 差异。
- 输出改动清单、影响面、验证命令与结果；未运行写明原因。
- 涉接口、认证、权限、存储、数据库、安全、发布时，联动对应相邻技能。
- 不确定 API/字段/版本必须查证或标需验证，禁止凭记忆写已验证。
- 对线上/偶发/异步问题输出 trace/request id、flag/灰度、缓存/TTL、队列/重试、定时任务和数据差异证据；缺观测标缺口。

## 约束
- 不为过检查而扩大 any、关闭 strict、跳过 lint、删除测试、无依据升大版本。
- 不把服务端密钥、管理 token、数据库连接串、私有 registry token 打进前端包、source map 或日志。
- 未查调用方前不改公共类型、导出名、路由结构、请求响应结构、环境变量名。
- 不用固定 sleep 修异步测试；不用本机 dev server 代替 CI/build/部署证据。
- 不把 UI 视觉决策、API 契约、安全策略、Electron 原生权限归本技能单独决定。
- 不把 Node/Bun/Deno/Edge/serverless 互相视为兼容运行时；必须按目标运行时验证。
- 不发布未声明 exports/types、未验证 peer、未确认 license/postinstall 的包。
- 不把运行时 schema、权限校验、超时取消、错误态、日志脱敏和构建产物验证留给“后续再补”；涉及真实开发闭环时它们是本次完成条件的一部分。

## 高频 Bug 反例库

### 反例 1：ESM 包被 require 直接加载
- 错法：CJS 配置 require 只发布 ESM 的依赖，ERR_REQUIRE_ESM 后乱加转译插件。
- 对法：确认 type/exports；CJS 侧动态 import 或改 mjs；runner 与 bundler 一起验。
- 根因：Node 条件导出和工具转译链不一致。

### 反例 2：TypeScript 路径别名只配 tsconfig
- 错法：tsc 不报错就提交，Vitest/运行时报 Cannot find module。
- 对法：同步 Vite/Vitest/Jest/Node loader 或用 exports。
- 根因：paths 只影响类型解析。

### 反例 3：Vite 环境变量误暴露
- 错法：把密钥改名为 VITE_SECRET_KEY 给客户端用。
- 对法：客户端只用公开变量，敏感请求走服务端，查产物字符串。
- 根因：VITE_ 会进入浏览器 bundle。

### 反例 4：SSR 首屏读取 window/localStorage
- 错法：Next render 阶段访问 window/localStorage。
- 对法：拆 Client Component 或 useEffect，服务端数据稳定序列化。
- 根因：服务端无浏览器全局且首屏需一致。

### 反例 5：fetch 竞态覆盖新数据
- 错法：搜索慢响应覆盖快响应结果。
- 对法：用 AbortController 或请求序号，参数变化和卸载取消旧请求。
- 根因：异步完成顺序不等于发起顺序。

### 反例 6：React effect 依赖导致无限请求
- 错法：依赖每次 render 新建对象，或清空依赖掩盖循环。
- 对法：稳定依赖、拆 effect、移除派生状态，用网络面板验证。
- 根因：React 按引用相等判断依赖。

### 反例 7：pnpm 幽灵依赖在 CI 失效
- 错法：import 未声明包，本机因 hoist 可用，CI 失败。
- 对法：当前 package 声明直接依赖，干净安装验证。
- 根因：pnpm 隔离 node_modules。

### 反例 8：Bun 替换 Node 后测试假绿
- 错法：npm test 改 bun test 后认为等价。
- 对法：列 Bun 与原 runner 差异，CI 目标运行时复测。
- 根因：Bun 与 Node/Vitest/Jest 不完全同构。

### 反例 9：Playwright 用固定等待治 flaky
- 错法：失败就加 waitForTimeout。
- 对法：等待 URL、locator、响应、业务文本，隔离 storageState。
- 根因：固定时间不是业务完成条件。

### 反例 10：sourcemap 与 release 不匹配
- 错法：只打开 sourcemap，未绑定部署版本和 chunk 路径。
- 对法：产物、上传、release id、CDN 路径一致并抽样反解。
- 根因：还原依赖同一份产物和映射。

### 反例 11：Next Server Component 误用客户端库
- 错法：Server Component 顶层引入依赖 window 的图表库。
- 对法：移入 use client 或 dynamic import ssr:false。
- 根因：客户端库副作用在服务端提前触发。

### 反例 12：浏览器兼容只测 Chrome
- 错法：新 CSS、File API、Intl、WebCrypto 只测桌面 Chrome。
- 对法：按 browserslist 测 Safari、iOS WebView、Android WebView。
- 根因：移动 WebView 支持滞后且碎片化。

### 反例 13：Deno/Edge 误用 Node API
- 错法：本地 Node 通过后在 Edge/Deno 使用 fs/net/tls 或未授权文件/网络访问。
- 对法：按目标 runtime 查 API、权限、bundle 限制和本地仿真。
- 根因：Edge/Deno 与 Node 的权限和 API 面不同。

### 反例 14：API 类型只在前端声明
- 错法：前端手写 Response 类型，后端字段漂移后运行时崩溃。
- 对法：用 schema/codegen/契约测试或运行时校验闭环。
- 根因：编译期类型不能验证外部输入。

### 反例 15：dual package hazard 导致单例失效
- 错法：同包被 ESM 和 CJS 两套入口加载，context/cache 分裂。
- 对法：统一条件导出和导入方式，检查依赖树与 bundler 解析。
- 根因：同一逻辑包出现两份运行时实例。

### 反例 16：Nuxt 插件造成 hydration mismatch
- 错法：SSR 阶段直接访问 window 或注入客户端 only 状态。
- 对法：使用 client-only、按运行时分支并稳定序列化状态。
- 根因：服务端输出与客户端首次渲染不一致。

### 反例 17：Serverless 全局缓存污染请求
- 错法：把用户态数据放进模块级变量或复用未隔离连接上下文。
- 对法：全局只放安全的只读缓存或连接池，请求态绑定 request/context。
- 根因：冷启动后实例可跨请求复用。

### 反例 18：tree-shaking 失效导致 bundle 激增
- 错法：barrel export 全量引入或 sideEffects 配错。
- 对法：做 bundle 分析，校正 sideEffects、导入路径和产物格式。
- 根因：工具链无法证明模块无副作用。

### 反例 19：AsyncLocalStorage 上下文丢失
- 错法：并发、回调、worker 边界后仍假定 request id 存在。
- 对法：在边界显式传递或重新绑定上下文，用并发用例验证。
- 根因：异步上下文不会自动跨所有执行边界传播。

### 反例 20：source map 公网泄露源码
- 错法：生产 sourcemap 上传后仍可被公网下载。
- 对法：使用受控上传、hidden sourcemap 或访问控制，并检查产物暴露。
- 根因：调试产物也是敏感发布物。

### 反例 21：Partial<T> 直接作为 PATCH 入参
- 错法：把 Domain 或 Entity 套 Partial<T> 后直接接 req.body，字段 absent、undefined、null 语义混在一起。
- 对法：单独定义 PatchDTO/schema，逐字段声明可改性、nullable、默认值和未知字段策略。
- 根因：TypeScript 工具类型只改编译期形状，不能表达外部 JSON 契约和业务写入规则。

### 反例 22：请求对象直接 spread 进 ORM
- 错法：Prisma/Drizzle/TypeORM/Sequelize/Knex 更新时把 body 展开进 data/set，导致 role、tenantId、deletedAt 或审计字段被篡改。
- 对法：schema 校验后做显式白名单映射，并在 where 中加入租户、权限、软删和版本条件。
- 根因：运行时输入比 TS 类型更宽，ORM 只负责执行写入，不替业务层过滤字段。

### 反例 23：删除接口泄露存在性或绕过软删
- 错法：DELETE 只按 id 硬删，404/403 区分过细，二次删除报错，普通查询仍能看到软删数据。
- 对法：按业务定义幂等响应，统一越权和不存在语义，软删字段写入审计并让默认查询过滤。
- 根因：删除是权限、审计、数据生命周期和 API 语义的组合，不是单条 delete SQL。

### 反例 24：affected rows 不检查
- 错法：updateMany/delete/update 返回 0 行仍返回成功，或唯一约束、乐观锁冲突都变成 500。
- 对法：检查 affected/count/rowCount/returning，把 0 行、冲突、约束失败映射到稳定业务错误。
- 根因：数据库执行成功不等于业务目标命中，错误映射是接口契约的一部分。

### 反例 25：只跑 typecheck 就说功能通过
- 错法：`tsc --noEmit` 通过后不跑 build、preview、测试或目标 runtime。
- 对法：按改动面补 test/build/preview/e2e/runtime 验证，并说明未跑风险。
- 根因：类型正确不等于网络、DOM、SSR、bundle 和部署正确。

### 反例 26：JSON 直 trust
- 错法：把 JSON.parse、response.json、req.body 断言成业务类型后直接使用。
- 对法：先 schema 校验，再 map 到 DTO/Domain，未知字段按 strict 或白名单处理。
- 根因：外部输入运行时形状不受 TypeScript 保护。

### 反例 27：any 逃逸污染调用链
- 错法：为修一个泛型错误加 `as any`，后续调用方全部失去约束。
- 对法：收窄 unknown、补泛型约束、拆类型守卫或修 schema 推导。
- 根因：any 会关闭局部类型系统并把风险扩散。

### 反例 28：非幂等 POST 被默认重试
- 错法：请求封装对所有 5xx/timeout 自动重试，导致重复下单、扣款或发消息。
- 对法：POST 默认不重试；确需重试必须有幂等键、去重和服务端唯一约束。
- 根因：网络失败不代表服务端没有执行。

### 反例 29：AbortController 只创建不传播
- 错法：组件卸载 abort 了外层 fetch，但内部重试、解析、二次请求还继续写状态。
- 对法：把 signal 传过封装、重试、stream 和回调边界，并在写状态前检查时效。
- 根因：取消不是局部变量，必须跨异步链路传播。

### 反例 30：env 缺失被默认值掩盖
- 错法：生产 `API_URL` 缺失时 fallback 到测试地址或空字符串，构建仍成功。
- 对法：启动或构建前用 env schema 校验 public/server-only 配置并失败退出。
- 根因：配置错误是启动失败，不是运行时猜测。

### 反例 31：ESM/CJS 只在 dev server 通过
- 错法：Vite dev 能跑就发布，Node CLI、Jest 或消费方遇到 default import/exports 错误。
- 对法：同时验目标 Node、bundler、test runner、types、exports 和 npm pack 消费样例。
- 根因：dev server 解析规则不等于最终运行时。

### 反例 32：日志打印完整请求上下文
- 错法：错误处理里输出 headers、cookies、body、env 或第三方响应原文。
- 对法：只记 request id、状态、脱敏字段和必要业务上下文，敏感字段集中 redact。
- 根因：JS 对象展开太方便，日志会变成数据泄露面。

### 反例 33：lockfile 混用导致 CI 漂移
- 错法：本地 pnpm-lock、CI npm install、仓库又提交 package-lock。
- 对法：确认 packageManager、corepack、唯一 lockfile 和 frozen install 命令。
- 根因：依赖解析器不同会产生不同树和不同脚本行为。

### 反例 34：前端权限当成后端权限
- 错法：隐藏按钮或路由 guard 后，接口仍允许用户改 role、tenantId 或他人资源。
- 对法：客户端只做体验；服务端做对象级授权、字段白名单和审计。
- 根因：浏览器状态和请求体都由用户控制。

## 提交前自检清单
- [ ] 已确认 Node、Bun、Deno、Edge/serverless、包管理器、TypeScript、框架、浏览器目标和 CI 版本。
- [ ] 已读取入口、package scripts、tsconfig、构建配置、测试配置、部署配置和相关调用方。
- [ ] 改公共导出、类型、路由、环境变量、请求封装、schema/codegen 前已全量查引用。
- [ ] ESM/CJS、SSR/client、Node/browser/Edge/serverless runtime 边界已明确。
- [ ] 类型安全覆盖编译期 strict、运行时 schema、typed env、API 契约漂移检测。
- [ ] 外部输入、JSON.parse、response.json、FormData、URLSearchParams、postMessage、localStorage 和 process.env 都已 runtime validate。
- [ ] DTO/Input/Domain/Entity/Response 已分层，外部输入没有直接复用 Entity、Domain 或 ORM 类型。
- [ ] undefined/null/absent 三态、Partial<T> 禁用边界、Zod/TypeBox/Valibot/io-ts 的 strip/strict 策略已明确并有用例覆盖。
- [ ] 编辑、删除、部分更新使用专门 DTO/schema，ORM 写入白名单、租户/权限 where、affected rows、软删和错误映射已验证。
- [ ] Promise/async、AbortController、timeout、retry、并发上限、非幂等写和 stale response 已按目标场景验证。
- [ ] ESM/CJS、exports/types、Node/Bun/Deno/Edge 差异和 lockfile/packageManager 已按目标运行时验证。
- [ ] 日志、错误上报、source map、client bundle、console 和 analytics 已做 secret/token/PII 脱敏或暴露检查。
- [ ] 新增或升级依赖已检查 lockfile、peer、postinstall、许可证、registry、token 和供应链风险。
- [ ] 已运行 typecheck/test/build/e2e/preview/部署仿真中与改动匹配的命令，或说明未运行原因。
- [ ] 浏览器兼容、hydration、AbortController 取消、错误态、慢网/并发按需覆盖。
- [ ] 性能已按需检查 bundle、tree-shaking、渲染、event loop、内存、cold start 或线上指标。
- [ ] 安全已按需检查 XSS sink、CORS/CSRF、JWT 存储、prototype pollution、source map 暴露和密钥进包。
- [ ] 没有隐藏密钥、关闭 strict、扩大 any、跳过测试、固定 sleep 或无依据改大版本。
- [ ] 涉安全/API/发布/DB/设计/Electron 原生能力已联动相邻技能。
- [ ] 输出包含改动清单、行数或文件定位、命令产出和剩余风险。

## 2024-2026 新坑速查
- Node 20/22/24：内建 fetch/undici、WebCrypto、test runner、watch、permission model、OpenSSL/V8 与旧 polyfill/mock 可能冲突；原生扩展需核对 ABI。
- TypeScript 5.x/6.0：verbatimModuleSyntax、erasableSyntaxOnly、type stripping、moduleResolution bundler/nodenext、decorators、const type parameters、satisfies 和严格可选/索引检查会改变导入、声明和边界类型。
- React 19/Next 新版本：Server Actions、Cache Components、use cache/cacheLife/cacheTag/revalidateTag、use、并发渲染、React Compiler、hydration 报错更精确，旧副作用写法更容易暴露。
- Vue/Nuxt 新版本：islands、server/client 插件、runtimeConfig、Nitro preset 与 hydration/部署目标强相关。
- Vite 5/6/7：Node 基线、Rollup、CJS 兼容、环境变量和 SSR external 策略升级时必须看迁移说明。
- pnpm 10/11：lockfile、catalog/catalogs、allowBuilds、strictDepBuilds、approve-builds、strict peer 会影响安装脚本和 workspace 分叉。
- Bun：安装快不等于完全兼容；重点复测 node: 模块、worker、TLS、test mock、postinstall、monorepo。
- Deno/Edge/serverless：权限、bundle 限制、cold start、区域差异和 API 子集必须按目标平台验证。
- Vitest 2/3：默认池、fake timers、browser mode、coverage provider 与旧 Jest 迁移差异明显。
- Playwright：浏览器二进制、系统依赖、trace/video、并行隔离和 storageState 是 CI 稳定性的关键证据。
- 浏览器兼容：Safari/iOS WebView 对 View Transitions、popover、dialog、Web Push、WebCrypto、文件上传和输入法组合事件需单测。
- TC39 新能力：Temporal、import attributes 等落地状态需按目标运行时和构建链查证。
- 依赖供应链：包名投毒、维护权转移、postinstall 下载二进制、私有 registry fallback、锁文件污染都要检查。
- sourcemap：hidden sourcemap、错误平台 release、CDN 路径重写、代码分割 chunk 名和访问控制必须同版本绑定。

## 与相邻技能的边界
- API 工程/api-engineering（api）：请求/响应契约、分页、错误码、认证语义、兼容性由 API 工程/api-engineering（api） 定；本技能落实 TS 类型、请求封装、schema 校验和前端消费。
- Web 安全/web-security（wsec）：XSS、CSRF、CSP、依赖供应链、密钥泄露、JWT 存储、前端鉴权绕过由 Web 安全/web-security（wsec） 定；本技能发现风险并避免秘密进包。
- UI 架构/ui-architecture（a）：信息架构、组件层级、交互流程、多端适配策略由 a 定；本技能负责实现结构和状态边界。
- UI 设计实现/ui-design（u）：视觉、Token、颜色、间距、动效审美由 u 定；本技能处理样式落地中的工程约束和兼容证据。
- Electron 桌面应用/electron-development（elct）：主进程、preload、IPC、原生权限、打包签名由 Electron 桌面应用/electron-development（elct） 定；本技能处理 renderer JS/TS、React/Vue/Vite 和共享类型。
- 后端工程/backend-engineering（be）/发布部署/release-engineering（rls）：serverless、部署、CI、发布回滚和运行时平台策略由对应技能收口；本技能提供 JS/TS 构建与运行时证据。
- 测试验证/test-engineering（tst）：测试策略、覆盖矩阵、回归边界和 flaky 治理由 测试验证/test-engineering（tst） 收口；本技能提供可测试实现和命令证据。
- 代码审计/code-audit（aud）：任何代码改动完成前由 代码审计/code-audit（aud） 做最终影响面、风险和遗漏检查；本技能不替代审计结论。