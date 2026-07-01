---
name: typescript-development
description: TypeScript 实战开发技能 - 聚焦 TS 5.x/6.0、tsconfig、strict 类型建模、type narrowing、泛型、async/Promise、运行时 schema、声明文件、module/build/test、monorepo/project references、typed API/env、库发布类型、低级错禁止、类型回归和真实开发验收闭环。用于新增或修改 TypeScript 代码、类型、tsconfig、声明、泛型、类型错误、typed API 或 TS 工具链时。
---

# TypeScript 实战开发

TypeScript 实战开发（typescript-development，兼容 slug: ts）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

## 定位 / 适用范围

定位：把 TypeScript 从“让编译器不报错”收敛为“类型模型、异步控制流、运行时输入、构建产物、消费者和发布证据一致”。本技能专注 TS 类型系统、tsconfig、type narrowing、泛型、async/Promise、声明文件、类型生成、类型安全迁移和 TS 工具链闭环。

适用：新增或修改 TS/TSX 代码、修类型错误、设计公共类型、调整 tsconfig、声明文件、泛型工具类型、async API、typed env、API DTO、SDK 类型、运行时 schema、monorepo project references、库发布 types、Node 直接运行 TS、类型回归测试。

不适用：纯 JavaScript 无 TS 约束、只学习 TS 概念不改项目、普通前端视觉/UI 决策、API 语义设计、测试体系设计、安全渗透、发布编排、仅阅读目录/README/package.json 且无修改或调试动作。

## 铁律

1. 外部输入先按 unknown 进入运行时校验，再收窄为业务类型；TS 类型不能证明 API、env、storage、URL、postMessage、文件、队列消息或数据库结果可信。
2. 不用 any、as、non-null assertion、ts-ignore、关闭 strict 或跳过类型检查来压错；除非有边界证据、局部注释理由和替代验证。
3. 改公共类型、导出、DTO、schema、env 名、路径别名、tsconfig 或声明文件前，必须搜生产方、消费方、测试、生成物和发布入口。
4. 类型通过不等于运行通过；tsc、bundler、test runner、runtime、IDE、API codegen、库消费者可能走不同解析链路。
5. 先确认 TypeScript 版本、运行时、模块系统、moduleResolution、strict flags、包管理器、CI 命令，再决定修法。
6. 类型修复必须保持运行时语义不变或明确说明行为变化；不要为了类型好看重构业务流程。
7. Node/Bun/Deno/Edge 直接执行 TS 时，只能把目标 runtime 支持的 TS 语法当可运行事实；type stripping 不做类型检查。
8. 发布库或 SDK 时，types、exports、typesVersions、declaration、source map、CJS/ESM 入口和消费者编译必须一起验证。
9. 低级错禁止：不得用 `as unknown as`、宽 `Record<string, any>`、隐式 any、随手 `Partial<T>`、乱加 `!`、遗漏 exhaustiveness、错误 optional/null 语义来换绿灯。
10. build 通过不等于 typecheck 通过；Vite/esbuild/swc/tsx/ts-node/bundler 可能只转译不检查类型，必须确认命令是否真的跑 tsc 或等价类型检查。
11. async 类型必须同时看成功值、拒绝路径、取消/超时、并发顺序和错误类型；Promise<T> 只说明 resolve 值，不说明业务一定成功。
12. 真实开发验收必须覆盖编辑时、编译时、测试时、构建时和目标运行时的差异；不能用单一绿灯替代闭环。

## 快速总则

- 事实：读取 package.json、tsconfig 继承链、lockfile、脚本、构建配置、测试配置、运行时版本和 CI 命令，不凭记忆假设。
- 边界：区分编译期类型、运行时校验、序列化边界、模块解析边界、包发布边界和跨仓库消费者边界。
- 严格：优先保留或提高 strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes、verbatimModuleSyntax、isolatedModules 等约束；降低约束必须有风险接受。
- 建模：类型表达业务不变量，但不要把不可证明的运行时事实编码成假确定类型。
- 生成：OpenAPI/GraphQL/Proto/DB schema/env schema 生成的类型必须与源 schema 同步，不能手写漂移副本。
- 证据：每个类型结论绑定 tsc/typecheck、lint、test、build、消费者编译、类型测试或运行样本；未跑写原因。
- 裁剪：低风险局部类型可用 typecheck + 相关测试；公共类型、库发布、API DTO、配置和运行时边界需加消费者和构建证据。
- 收口：完成前输出改动面、影响面、验证命令、未验证项和需联动技能。
- 版本：TS/Node/框架/构建器升级要先看 breaking changes、目标 lib、moduleResolution、类型包兼容和 CI 镜像版本。
- 差异：IDE 红、tsc 绿、test 红、runtime 红时，优先对比它们使用的 tsconfig、cwd、环境变量、loader、alias 和依赖版本。
- 异步：区分 Promise 成功值、Result/Error union、throw/reject、AbortSignal、竞态、并发池和重试副作用；不要让类型掩盖时序风险。
- API：请求/响应类型、错误体、分页、鉴权上下文、租户字段和版本兼容要和运行时 schema 或契约同源。

## 强制流程

1. 锁定任务：明确是修类型错误、设计类型、改 tsconfig、接外部数据、async/API 边界、库发布、迁移版本、改 TSX，还是类型/运行时不一致排障。
2. 读取事实：查 TS 版本、tsconfig extends、compilerOptions、include/exclude/references、module/moduleResolution、jsx、declaration、emit、package exports/types、运行时和脚本。
3. 判定边界：标出外部输入、公共导出、异步错误路径、跨包引用、生成代码、声明文件、runtime 直接执行 TS、server/client 或 node/browser/edge 边界。
4. 搜全引用：对被改类型、接口、枚举、联合成员、泛型工具、路径别名、env key、schema 名和导出名做生产方/消费方/测试方搜索。
5. 选择修法：优先修真实类型模型或运行时校验；其次局部收窄、泛型约束、discriminated union、satisfies、类型守卫；最后才是断言，并说明证据。
6. 运行验证：至少跑项目等价 typecheck；按风险补 lint、unit/integration、build、type tests、API/schema diff、消费者编译、runtime smoke 和失败路径样本。
7. 查低级错：搜索新增 any/as/!/ts-ignore/expect-error/skipLibCheck/Partial/Record/string index、外部输入直 cast、枚举/union 新成员未覆盖、type/value import 混用。
8. 证据降级：只跑 IDE、只看 tsc、只靠断言、skipLibCheck 掩盖、生成物未更新、消费者未编译、运行时输入未校验时，不得报完全通过。
9. 交接收口：涉 API 契约、测试策略、安全、发布、JS 运行时、前端框架或最终审计时，明确交给相邻技能的触发原因和收口标准。

## 场景执行卡

### 1. 修 TypeScript 类型错误

- 输入：完整错误、文件位置、TS 版本、触发命令、最近改动、相关 tsconfig、调用方和运行路径。
- 动作：先判断是模型错误、依赖声明错误、模块解析错误、生成物过期、TS 版本差异，还是运行时事实缺校验。
- 修法优先级：修真实类型或数据流；补 narrowing/type guard/schema；调整泛型约束；更新声明或生成物；最后才局部断言。
- 验证：原命令绿灯、相关测试或 build 通过；若仅局部修复，说明未覆盖的其他 package 或消费者。

### 2. tsconfig / strict 迁移

- 输入：tsconfig 继承链、workspace references、include/exclude、build/test/IDE 使用的配置、CI 命令和目标运行时。
- 动作：逐项评估 strict、noImplicitAny、strictNullChecks、noUncheckedIndexedAccess、exactOptionalPropertyTypes、verbatimModuleSyntax、isolatedModules、skipLibCheck、moduleResolution。
- 迁移：分批按错误类别收敛，先修边界类型和生成物，再修业务空值/索引/可选属性，避免一次性关闭约束。
- 验证：tsc --noEmit 或项目等价命令、增量 build、关键测试、CI 配置一致性。

### 3. 外部输入与运行时 schema

- 输入：API response、request body、env、URL query、localStorage、postMessage、文件、数据库 row、队列消息或第三方 SDK 返回。
- 动作：外部输入类型使用 unknown 或框架 raw 类型；用项目既有 zod/valibot/typebox/io-ts/JSON Schema/手写 validator 校验后收窄。
- 建模：校验 schema 与业务类型同源；错误信息、默认值、nullable/optional、未知枚举、版本兼容要显式处理。
- 推导：优先 schema 推导类型或从权威契约生成类型；禁止 schema、接口类型、mock、fixture 四套手写副本各自漂移。
- 验证：合法/非法样本、缺字段/null/unknown enum、schema/type 生成一致性、错误分支测试。

### 4. 公共类型、DTO 和 API 类型

- 输入：生产方、消费者、OpenAPI/GraphQL/Proto/SDK、Mock、fixture、缓存、旧客户端、网关/鉴权上下文和发布版本。
- 动作：改字段名、可空性、枚举、联合成员、错误体、分页结构、租户字段和鉴权派生字段前判兼容；新增枚举和 union 分支要检查 exhaustive switch。
- 边界：API 语义、状态码、幂等和兼容策略交 api；本技能负责 request/response DTO、错误体类型、codegen、运行时 schema 与消费者编译闭环。
- 验证：schema/codegen 更新、typecheck、contract/schema diff、合法/非法样本、至少一个真实消费方编译或测试。

### 5. 泛型、工具类型和类型建模

- 输入：业务不变量、调用样例、错误样例、可推断性、公共 API 稳定性和 IDE 可读性。
- 动作：优先简单对象/联合/重载；复杂 conditional/mapped/template literal 类型只在能显著防错时使用。
- 约束：泛型必须有清楚输入输出关系；不要用类型魔法隐藏运行时分支、扩大编译耗时或牺牲可维护性。
- 收窄：优先 discriminated union、`in`/`typeof`/`instanceof`、自定义 type predicate、assertion function 和 exhaustive never；不要把 narrowing 责任丢给调用方。
- 验证：正例/反例类型测试、tsd/expect-type 或项目等价方式、编译耗时变化、调用方可读性。

### 6. 声明文件与第三方类型

- 输入：依赖版本、@types 版本、包 exports/types、声明来源、真实运行 API、ESM/CJS 入口和 bundler 行为。
- 动作：优先升级匹配声明、修 module augmentation、贡献局部声明；不要把错误声明全局 any 化。
- 风险：skipLibCheck 只能临时止血；全局声明污染、错误 namespace、默认导入差异会传染整个项目。
- 验证：依赖调用样本、typecheck、build、运行 smoke；库发布需消费者项目编译。

### 7. 模块解析、路径别名与 ESM/CJS

- 输入：type、exports、imports、main/module/types、moduleResolution、paths、baseUrl、bundler/test/runtime alias、mjs/cjs/cts/mts。
- 动作：确认 tsconfig paths 是否同步到 Vite/Vitest/Jest/ts-node/tsx/Node loader；导入 type/value 边界用 import type 和 verbatimModuleSyntax 验证。
- 风险：tsc 过但运行找不到模块、dual package hazard、默认导入只在某工具链可用、type-only import 被误保留或误擦除。
- 决策：NodeNext/Node20 按真实 Node ESM 规则，Bundler 按前端打包器规则；不要为了消掉错误把 moduleResolution 改到与运行时不一致。
- 验证：typecheck、build、test runner、目标 runtime 启动、库消费者导入样本。

### 8. Node 直接运行 TS / type stripping

- 输入：Node/Bun/Deno/Edge 版本、是否直接执行 .ts、loader/tsx/ts-node、tsconfig erasableSyntaxOnly、verbatimModuleSyntax、module node20/nodenext。
- 动作：只使用目标 runtime 支持的可擦除 TS 语法；enum、parameter property、runtime namespace、import equals 等需转译语义的语法要避开或加构建步骤。
- 风险：Node type stripping 不做类型检查；开发能跑不代表 CI typecheck 通过，运行能擦除不代表 bundler 产物一致。
- 验证：目标 runtime 启动命令、tsc --noEmit、build 或发布产物 smoke。

### 9. Monorepo / project references

- 输入：workspace 包、references、composite、declarationMap、paths、exports、turbo/nx 缓存、包发布顺序和消费者包。
- 动作：公共包改类型要更新声明产物、依赖拓扑和消费者；避免依赖未声明的 workspace 幽灵类型。
- 风险：本包 typecheck 绿但下游包红、缓存复用旧 d.ts、paths 绕过 package exports、CI 增量构建漏包。
- 验证：根 typecheck、受影响包 build、至少一个下游消费者编译、缓存 key/lockfile 证据。

### 10. 库 / SDK 类型发布

- 输入：目标消费者、Node/browser/bundler、CJS/ESM、exports、types、typesVersions、declaration、source map、peer dependencies、semver。
- 动作：types 与运行入口对齐；导出公共类型稳定；破坏类型变更按 semver；generated SDK 记录 schema 和生成器版本。
- 产物：检查 dist 中 d.ts、d.ts.map、package exports/types、sideEffects、peer 类型、默认导入/命名导入和 subpath export；不要只看源码 typecheck。
- 验证：npm pack 或等价打包、干净消费者安装、tsc 编译、Node/bundler 导入、CJS/ESM 两侧 smoke、声明文件检查。

### 11. 类型质量与低级错门禁

- 输入：新增 diff、类型错误修复点、公共导出、外部输入、断言和配置变更。
- 动作：逐项审查 any/unknown 使用边界、断言理由、可选/nullable 语义、索引访问、union exhaustive、type-only import、schema 同源和生成物同步。
- 红线：`as any`、`as unknown as T`、`@ts-ignore`、批量 `@ts-expect-error`、关闭 strict、扩大入参、吞掉错误分支、客户端暴露 server env，默认判为未完成。
- 验证：typecheck 加针对性反例；公共类型加消费者编译；外部输入加非法样本；配置变更加 build/test/runtime 解析一致性。

### 12. Async / Promise / 并发类型边界

- 输入：异步 API、Promise 返回值、Result/Error union、catch 分支、AbortSignal、重试、并发池、队列任务和调用顺序假设。
- 动作：确认函数是 throw/reject 还是返回错误联合；catch 中 error 先按 unknown 收窄；取消、超时、重试和幂等副作用要显式建模。
- 风险：Promise<T> 不代表业务成功；Promise.all 会短路，allSettled 会改变错误模型；并发下闭包状态和缓存类型可能与运行时顺序不一致。
- 验证：成功、失败、取消/超时、并发顺序和重试样本；相关测试必须能证明错误分支未被类型吞掉。

### 13. 构建、测试与真实开发验收闭环

- 输入：typecheck、lint、unit、integration、build、preview、runtime smoke、CI job、package manager、lockfile、workspace filter 和缓存策略。
- 动作：先确认每个命令实际做什么；区分转译、类型检查、测试执行、声明生成、bundle 校验和目标 runtime 启动。
- 风险：IDE 绿但 CI 红、build 绿但 typecheck 没跑、测试 mock 绕过 schema、缓存复用旧 d.ts、workspace filter 漏下游。
- 验收：记录原失败命令、修复后命令、未跑原因、降级结论和下一步；公共类型/API/库发布不得只用本包本地绿灯收口。

### 14. TSX / React / Vue 类型边界

- 输入：jsx 配置、框架版本、server/client boundary、组件 props、事件类型、children、ref、CSS modules、路由和数据加载。
- 动作：props 体现可空/受控/非受控语义；Server Component 与 Client Component、SSR 与浏览器 API 分界清楚。
- 风险：把前端类型当服务端权限、window/localStorage 在 SSR 直接访问、事件类型 any 化、组件库声明与运行 props 不一致。
- 验证：typecheck、组件相关测试、build/preview；UI 交互归前端/测试技能补浏览器证据。

### 15. 性能与编译耗时

- 输入：tsc 耗时、IDE 卡顿、复杂类型、project references、incremental、skipLibCheck、生成代码规模和 CI 缓存。
- 动作：定位慢在类型复杂度、巨型 union、深递归 conditional、生成文件、声明检查还是项目引用；优先减小类型复杂度和边界暴露。
- 约束：不要为省时关闭关键 strict 或跳过真实消费者；避免引入会让 IDE/CI 卡死的类型体操。
- 验证：前后 typecheck 耗时、内存、CI job、IDE 可用性或拆分 references 证据。

## 验证门禁

- 低风险局部实现：项目等价 typecheck + 相关 unit/test 或 build 中至少一项。
- 修类型错误：原失败命令必须从红到绿；若不能复现原错误，只能写“无法验证原问题”。
- 外部输入：运行时校验样本 + 类型收窄 + 错误分支测试；只改 TS 类型不合格。
- 公共类型/API DTO：typecheck + schema/codegen/contract 或消费者编译；旧端/未知枚举/nullable 风险需说明。
- tsconfig/strict：根 typecheck、受影响 package build、CI 同命令或差异说明；不允许用 ts-ignore 批量盖错。
- async/API 边界：成功值、错误值、throw/reject、取消/超时和并发样本至少覆盖高风险分支；只验证 happy path 不合格。
- build/test 闭环：确认 build 是否包含 typecheck，确认测试是否覆盖真实 schema/生成物，确认 runtime smoke 使用目标 loader/alias/env。
- 库发布/SDK：打包产物、声明文件、exports/types、干净消费者编译、CJS/ESM 或目标运行时 smoke。
- Node type stripping：目标 runtime 启动 + tsc --noEmit；非可擦除语法必须有构建转译证据。
- Monorepo：受影响包和下游消费者编译；缓存命中旧结果必须降级。
- 性能敏感：记录 typecheck/build 耗时或内存变化，避免 CPU 卡顿和内存溢出。
- 低级错扫描：新增 any/as/!/ts-ignore/expect-error/skipLibCheck/Record<string, any>/Partial 泛化必须逐条解释或移除。

## 输出要求

1. 关键事实：TS 版本、tsconfig、strict flags、运行时、模块系统、包管理器、入口命令和 CI 差异。
2. 改动范围：类型、实现、schema、生成物、声明、tsconfig、公共导出和消费者影响面。
3. 边界判断：哪些是编译期类型，哪些有运行时校验，哪些仍是外部不可信输入。
4. 验证证据：命令、结果、失败到通过、消费者编译、build/test/type tests、未运行原因。
5. 剩余风险：断言、skipLibCheck、未覆盖消费者、旧端兼容、运行时差异、发布证据缺口。
6. 关键词证据：列出触发本技能的用户原话、文件/配置/命令和实际命中点，避免只因 `.ts` 文件名误触发。
7. 联动：需要 jsts、api、tst、wsec、rls、aud 等相邻技能时写触发原因。

## 安全边界

- 不把用户输入、API 响应、env、localStorage、postMessage、文件、JWT payload、LLM 输出或第三方 SDK 返回当可信类型。
- 不让类型断言绕过鉴权、租户隔离、字段白名单、mass assignment、SSRF URL、文件上传、SQL/NoSQL 参数或日志脱敏。
- 客户端 TS 类型和隐藏按钮不能替代服务端权限；涉及权限、敏感数据、外部 URL、富文本、文件上传、token 存储时联动 wsec。
- 不把 secret 写入 NEXT_PUBLIC_/VITE_ 类型声明或 client env；typed env 必须区分 server/client 可见性。
- 生成类型或 SDK 时不得包含真实 token、Cookie、PII、生产样本或私有 endpoint；样本需脱敏。
- 类型修复不得扩大输入可接受范围、吞掉错误语义或把未知字段透传到危险写操作。

## 高频反例库

- 反例 1：用 any 压掉 API 响应错误。错法：fetch 返回直接 as User。对法：unknown + schema 校验 + 错误分支。根因：外部数据不受 TS 编译器约束。
- 反例 2：非空断言掩盖空值。错法：user!.id 通过编译。对法：按加载态、未登录态、错误态建模。根因：null 是运行时状态，不是类型噪音。
- 反例 3：手写前端 DTO 漂移。错法：后端字段改名，前端类型还旧。对法：schema/codegen/contract 同源并编译消费者。根因：类型副本会变成谎言。
- 反例 4：tsconfig paths 只配 tsc。错法：编译通过，Vitest/Node 运行找不到模块。对法：同步 bundler/test/runtime alias 或改 package exports。根因：paths 只影响 TS 解析。
- 反例 5：exactOptionalPropertyTypes 后把可选都改成 undefined。错法：为省事写 prop?: T | undefined。对法：区分缺失、显式 undefined 和 null 语义。根因：可选属性是契约语义。
- 反例 6：noUncheckedIndexedAccess 报错后断言数组必有值。错法：items[0]!.id。对法：检查长度或建模 NonEmptyArray。根因：索引访问可能不存在。
- 反例 7：verbatimModuleSyntax 下混淆 type/value import。错法：普通 import 只用于类型或 import type 用到运行时值。对法：按 type/value 边界拆分。根因：类型擦除会改变运行时代码。
- 反例 8：Node 直接跑 TS 却使用 enum。错法：node app.ts 依赖 enum 语义。对法：用 const object/union 或构建转译。根因：type stripping 只能擦可擦语法。
- 反例 9：库发布 types 指向错入口。错法：exports 运行入口和 types 不一致。对法：打包后在干净消费者编译 CJS/ESM 导入。根因：发布边界由消费者工具链验证。
- 反例 10：skipLibCheck 长期掩盖声明冲突。错法：升级依赖后只开 skipLibCheck。对法：定位 @types/依赖版本/重复声明并最小修复。根因：声明冲突会在消费者侧爆炸。
- 反例 11：泛型工具类型过度复杂。错法：深递归 conditional 让 IDE 和 CI 卡顿。对法：用显式类型或较浅抽象。根因：类型系统也有性能成本。
- 反例 12：枚举新增没查 exhaustive switch。错法：新增 union member 后只改生产方。对法：搜索 switch/if/map/文案/测试并覆盖 unknown fallback。根因：类型扩展会破坏消费者假设。
- 反例 13：typed env 泄露客户端密钥。错法：为了前端类型方便把 secret 加到 NEXT_PUBLIC_/VITE_。对法：server/client env 分 schema，敏感操作走服务端。根因：公开前缀会进入浏览器包。
- 反例 14：类型测试只测正例。错法：expectType 只有 happy path。对法：加应失败样例和边界样例。根因：类型防错能力需要反例证明。
- 反例 15：生成类型未提交或未重跑。错法：改 schema 后手改消费类型。对法：重跑 codegen 并记录生成器版本和 diff。根因：生成物是契约证据的一部分。
- 反例 16：把 unknown 立刻双重断言成业务类型。错法：payload as unknown as Order。对法：先 schema 校验，再返回收窄后的 Order。根因：unknown 是边界提示，不是免检通行证。
- 反例 17：只跑 vite build 就报类型通过。错法：构建器只转译，没跑 tsc/vue-tsc/tsc -b。对法：确认 typecheck 脚本并执行。根因：转译器不承担完整类型检查。
- 反例 18：monorepo 下 paths 绕过包边界。错法：直接 import 其他包 src 内部类型。对法：经 package exports/public types 引用并编译下游。根因：源码路径会破坏发布和缓存边界。
- 反例 19：把 `@ts-expect-error` 当永久注释。错法：没有 issue、原因和删除条件。对法：修类型或加精确反例测试，临时豁免必须可追踪。根因：预期错误也会腐烂。
- 反例 20：声明文件只为当前调用方补最小 happy path。错法：declare module 后返回 any。对法：按真实运行 API 建模关键分支并加 smoke。根因：错误声明会污染全项目。
- 反例 21：async 函数只建模成功值。错法：Promise<User> 里吞掉 401/timeout。对法：错误 union、throw 策略、取消和重试语义统一并测试。根因：异步失败是业务路径。
- 反例 22：catch error 直接当 Error。错法：catch(e) 后 e.message。对法：按 unknown 收窄或用项目错误封装。根因：JavaScript 可以 throw 任意值。
- 反例 23：Promise.all 用错错误模型。错法：其中一个失败导致整体短路却按部分成功处理。对法：按 all/allSettled 明确结果类型和补偿逻辑。根因：并发组合会改变控制流。
- 反例 24：测试只跑转译链路。错法：tsx/vitest 能跑就说类型通过。对法：补 tsc/vue-tsc/tsc -b 或项目等价 typecheck。根因：运行测试不等于类型检查。
- 反例 25：API 错误体没有类型契约。错法：只给成功 response 写 DTO。对法：错误体、状态码映射、未知错误和版本兼容一起建模。根因：消费者依赖失败语义。
- 反例 26：workspace filter 漏掉真实下游。错法：只跑当前包 typecheck。对法：按依赖拓扑跑受影响下游或消费者样本。根因：公共类型的破坏常在下游暴露。

## 自检清单

- [ ] frontmatter name 等于 canonical name（typescript-development），旧 slug 只作兼容 alias/URL 主键。
- [ ] 已确认 TS 版本、tsconfig 继承链、strict flags、module/moduleResolution、运行时和 CI 命令。
- [ ] 已区分外部输入、内部可信数据、公共类型、生成物、声明文件和发布边界。
- [ ] 已覆盖 async 成功/失败/取消/并发、API 成功/错误体和运行时 schema 边界。
- [ ] 已搜被改类型/导出/schema/env/路径别名的生产方、消费方、测试方。
- [ ] 已扫描新增 any/as/!/ts-ignore/expect-error/skipLibCheck/Partial 泛化、索引访问和 exhaustive switch 缺口。
- [ ] 未用 any、as、non-null、ts-ignore、skipLibCheck 或降低 strict 掩盖真实问题；若用了已说明边界和证据。
- [ ] 外部输入有运行时校验或明确未验证风险。
- [ ] 公共类型/API DTO/SDK 类型有消费者或契约验证。
- [ ] tsconfig、paths、exports、types 和 bundler/test/runtime 解析一致性已验证或标缺口。
- [ ] build/test/typecheck/runtime smoke 的职责已区分，未把单一命令当完整闭环。
- [ ] Node type stripping、Bun/Deno/Edge 目标运行时差异已按需验证。
- [ ] Monorepo/project references 已覆盖受影响下游包和缓存风险。
- [ ] 库发布已验证打包产物、声明文件、exports/types 和干净消费者编译。
- [ ] 性能敏感改动已关注 typecheck/build 耗时、内存和 IDE 卡顿。
- [ ] 输出包含验证命令、结果、未运行原因、剩余风险和需联动技能。

## 相邻技能边界

- JavaScript/TypeScript 开发/javascript-typescript-development（jsts）：负责 JavaScript/TypeScript 综合运行时、Node/Bun/Deno/Edge、前端框架、构建工具、请求、包管理和 JS 生态排障；TypeScript 实战开发/typescript-development（ts） 专注 TypeScript 类型系统、tsconfig、声明和类型安全闭环。
- API 工程/api-engineering（api）：负责 API 资源、状态码、错误模型、幂等、版本兼容和契约语义；TypeScript 实战开发/typescript-development（ts） 负责 DTO 类型、codegen、运行时 schema 与消费者编译。
- 测试验证/test-engineering（tst）：负责测试策略、场景矩阵、CI gate、flaky 和覆盖结论；TypeScript 实战开发/typescript-development（ts） 只要求类型测试、typecheck 和与类型改动匹配的验证证据。
- Web 安全/web-security（wsec）：负责 Web/API 安全威胁、漏洞复现和修复验证；TypeScript 实战开发/typescript-development（ts） 只保证类型修复不绕过运行时校验、鉴权、敏感数据和输入边界。
- 发布部署/release-engineering（rls）：负责发布制品、SBOM、签名、灰度、回滚和环境门禁；TypeScript 实战开发/typescript-development（ts） 提供 types、声明、构建和消费者编译证据。
- 代码审计/code-audit（aud）：负责代码改动最终收口、调用链、影响面和证据结论；TypeScript 实战开发/typescript-development（ts） 改动完成后由 代码审计/code-audit（aud） 做最终审计。
