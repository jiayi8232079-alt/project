---
name: project-learning
description: 项目学习实战排障版 - 面向陌生项目、陌生模块和修 Bug 前上下文补齐，建立入口识别、调用链、数据流、配置/路由/权限/测试基线、monorepo 依赖边界、架构漂移、AI 生成代码痕迹和证据索引的只读心智模型。当需要学习项目、接手模块、理解功能链路、定位影响面或先补证据再改代码时必须使用。
---

# Project Learning实战排障版

> 定位：project-learning 只负责把陌生项目从“看过一些文件”收敛为可复核证据地图：范围、入口、调用链、数据流、配置、路由、测试基线、依赖边界、风险和未知项。
> 铁律：学习阶段默认只读；未找到真实入口、producer/consumer、配置来源、测试入口和证据索引前，不宣称已理解影响面。

## 快速总则

1. 先定目标：全项目上手、单功能理解、修 Bug 前补上下文、影响面评估、架构漂移识别、测试基线确认或风险边界建立。
2. 先定范围：仓库、服务、端、模块、分支、环境、版本、部署形态、用户路径、入口类型和明确不覆盖范围。
3. 先找真实入口：entrypoint 包含启动命令、路由/API、页面、CLI、定时任务、队列消费者、事件订阅、配置加载、测试入口和部署入口。
4. 先建证据索引：每条结论绑定 file:line、命令输出、路由、配置 key、表/字段、队列 topic、测试名、日志字段或外部依赖名。
5. 先追 producer 再追 consumer：函数、字段、枚举、配置、事件、缓存 key、DB 表、文件、SDK 和导出物都要看写入方、读取方、序列化和测试断言。
6. 先看运行事实再看文档：README、注释、目录名和旧设计文档只能作线索，必须用代码、脚本、CI、部署、配置和测试互证。
7. 先识别边界再实现：学习输出只给证据地图、风险和下一步技能；不替代语言技能、api-design、db-design、test-engineering 或 code-audit 写实现。
8. 影响面必须全量搜：改函数、字段、枚举、路由、权限、配置 key、feature flag、cache、queue、topic、SDK 或公开契约前必须查引用和消费方。
9. 大项目允许分层抽样，但入口、认证、权限、写路径、状态机、配置、测试和公共中间件不能跳。
10. 证据不足就停：生成代码源头不可见、私有依赖缺失、环境不可复现、路由不可达或资料冲突时，输出“需补证据”。

## 场景执行卡

### 1. 新项目快速读图

- 输入：仓库路径、目标服务/端、业务目标、运行环境、当前分支、已有文档和用户要解决的问题。
- 动作：读根目录说明、CLAUDE/AGENTS、包管理/构建文件、启动脚本、CI、部署配置、目录结构和测试目录；画出模块职责和入口地图。
- 必查：entrypoint、依赖图、workspace/monorepo、环境变量、配置层级、外部服务、DB/缓存/队列、生成代码、测试命令。
- 输出：项目地图、关键入口、运行/测试方式、主要风险、未知项和需要切换的相邻技能。

### 2. 功能链路理解

- 输入：用户动作、URL/API/页面、命令、事件、报错、关键词或需求点。
- 动作：从用户入口追到 handler/controller/page、service/usecase、repository/store、DB/cache/queue/file、外部 API、返回结构和副作用。
- 必查：call graph、data flow、auth、permission、状态机、事务、幂等、错误处理、日志/埋点、测试覆盖和旧入口。
- 输出：调用链、数据流、状态流、producer/consumer 矩阵、验证入口和影响面。

### 3. 修 Bug 前补上下文

- 输入：bug 描述、复现步骤、日志/堆栈、环境、版本、账号/角色、数据样本、最近变更。
- 动作：先定位失败点和真实入口；查同类实现、旧路径、配置差异、数据状态、缓存、异步任务、权限链路和测试基线。
- 必查：原 bug 可复现性、错误传播、消费方、历史兼容、并发/重试、feature flag、灰度和观测证据。
- 失败兜底：没有复现或没有证据时只列候选根因和缺口，不直接改。

### 4. 数据流 / 状态 / 字段 / 枚举映射

- 输入：字段、枚举、状态、缓存 key、topic、文件名、响应结构或数据库对象。
- 动作：全量搜索定义、写入、读取、校验、序列化、反序列化、迁移、前端展示、导入导出、报表、任务和测试断言。
- 必查：默认值、null/empty、未知枚举、旧数据、权限过滤、缓存失效、队列重放、状态机非法跳转。
- 输出：数据血缘、producer/consumer 表、兼容风险和要交给 api-design/db-design/test-engineering 的验证点。

### 5. 配置 / 环境 / 路由 / 部署入口识别

- 输入：环境名、服务、配置 key、路由、域名、部署目标或启动失败现象。
- 动作：追 configuration 定义、默认值、覆盖优先级、secret 来源、运行用户、容器/进程入口、网关/反代、健康检查和回滚入口。
- 必查：dev/staging/prod 差异、feature flag、热加载/重启、CI 注入、Kubernetes/systemd/compose、Nginx/CDN、证书和回调地址。
- 输出：配置链路、环境差异、真实路由入口、发布/回滚风险。

### 6. 认证 / 权限 / 安全边界学习

- 输入：用户角色、资源类型、入口、token/session 来源、管理端或 webhook。
- 动作：追 auth 来源、middleware、scope、租户、owner 校验、批量操作、服务间身份、审计日志和错误语义。
- 必查：BOLA/IDOR、跨租户、批量逐项验权、可信 header、CSRF/SSRF、文件路径、Webhook 签名和重放。
- 输出：权限链路、资源边界、明显缺口和需要 code-audit/web-security 的风险点。

### 7. 测试和质量基线学习

- 输入：目标功能、语言栈、CI、测试目录、历史失败、原 bug 路径。
- 动作：识别单测、集成、契约、E2E、冒烟、性能、安全、可观测性测试；查 fixtures、mock、testcontainers、CI job、跳过测试和覆盖率口径。
- 必查：原 bug 红灯、关键链路、旧入口、flaky、环境依赖、测试数据隔离和手工验证入口。
- 输出：最小验证地图和缺口；测试策略与执行交给 test-engineering。

### 8. Monorepo / 依赖边界 / 生成代码

- 输入：workspace、包名、模块、SDK、schema、生成目录或构建失败。
- 动作：查 workspace graph、package exports、lockfile、构建产物、代码生成命令、schema 源、内部包版本和跨包消费方。
- 必查：Nx/Turborepo/Bazel/Gradle multi-project、pnpm workspace、OpenAPI/GraphQL/protobuf/ORM 生成、私有 registry、循环依赖。
- 输出：依赖边界、可改源头、不可直接改的生成物、构建/发布影响。

### 9. 架构漂移与 AI 生成代码痕迹识别

- 输入：新增模块、异常风格代码、重复实现、迁移中目录、AI 生成嫌疑或历史债务。
- 动作：对比同类实现的分层、命名、错误处理、权限、日志、测试、配置和依赖方向；识别伪 API、伪字段、无调用代码、模板残留和未接入入口。
- 必查：真实调用路径、框架约定、已废弃目录、生成/脚手架来源、lint/CI 规则和架构边界。
- 输出：架构漂移证据、不能照搬的差异、需切语言技能或 code-audit 的风险。

## 高频坑 / 防遗漏

### 高频坑

1. 只看 README 或目录名，不看脚本、CI、部署和真实入口。
2. 只追入口文件，不追数据写入、异步副作用和消费方。
3. 只看后端，漏前端、移动端、SDK、报表、导出、任务和测试夹具。
4. 学习阶段顺手改代码，导致证据和假设混在一起。
5. 把 legacy/demo/mock/生成产物当线上链路。
6. 忽略环境差异和 feature flag，本地路径不等于生产路径。
7. 不查权限中间件和资源 owner，只看业务 service。
8. 不查测试入口，最后无法证明理解可验证。
9. 同名函数、同名路由、同名配置未验证可达性就下结论。
10. 漏 monorepo/workspace/package exports，改一个包影响多个端。
11. 直接修改 generated code，不找 schema 或生成命令。
12. AI 生成代码看似完整，实际 API、字段、异常和权限分支不存在。
13. 架构漂移未识别，把迁移中旧模式继续复制到新功能。
14. 依赖边界未确认，跨层 import、循环依赖或私有包版本污染构建。
15. 只建调用链不建证据索引，后续审计无法复核。

### 防遗漏清单

- 范围：仓库、服务、端、模块、分支、环境、版本、用户路径、不覆盖范围是否明确。
- 入口：启动、路由、页面、API、CLI、任务、事件、队列、配置、测试和部署入口是否找到。
- 链路：call graph、data flow、producer、consumer、外部依赖、返回、副作用和错误传播是否追完。
- 数据：字段、枚举、状态机、DB、cache、queue、topic、文件、SDK、导入导出是否覆盖。
- 配置：configuration、environment、feature flag、secret、覆盖优先级、回滚方式是否识别。
- 权限：auth、permission、租户、owner、批量、可信边界、审计日志是否追到。
- 依赖：monorepo、workspace、lockfile、package exports、generated code、私有包和构建产物是否确认。
- 验证：test entry、CI job、fixture、mock、原 bug 复现、手工验证入口是否明确。
- 风险：架构漂移、AI 生成代码痕迹、废弃链路、环境差异、观测缺口和未知项是否列明。

## 输出要求

1. 学习目标与范围：项目、模块、环境、版本、用户路径、入口类型和不覆盖范围。
2. 证据索引：列已读文件/命令/路由/配置/表/测试/日志入口；每个关键结论能回到证据。
3. 入口地图：启动、路由/API/页面/CLI/任务/事件/队列、配置、部署和测试入口。
4. 调用链：关键函数/文件、call graph、producer、consumer、外部依赖、异步副作用和旧入口。
5. 数据/状态链：data flow、字段、枚举、表、cache、queue、topic、state machine、权限、事务、错误处理和日志。
6. 依赖与架构边界：monorepo/workspace、generated code 源头、包边界、公共层约定、架构漂移和 AI 生成代码痕迹。
7. 测试基线：现有测试入口、可复现路径、缺失验证、flaky/跳过测试和需交给 test-engineering 的场景。
8. 风险与未知：证据不足、环境差异、权限/安全、兼容、发布、观测、私有依赖和需确认项。
9. 下一步技能：实现切对应语言/端；外部资料切 research；API 切 api-design；DB 切 db-design；验证切 test-engineering；发布切 release-engineering；最终收口切 code-audit。

## 约束

- 学习阶段只读；未获明确实现任务前不修改代码、配置、依赖、数据库或远端资源。
- 不凭 README、目录名、注释、训练记忆、旧文档或 AI 摘要下结论。
- 未追 producer/consumer 和影响面，不说“只影响这里”。
- 未识别配置、环境、feature flag 和部署差异，不说“本地等于线上”。
- 未确认 test entry 和验证路径，不说“可验证/已覆盖”。
- 不把 legacy、demo、mock、generated code、脚手架模板当真实链路，除非证据证明可达。
- 不替代语言技能写实现；不替代 api-design 定契约；不替代 db-design 设计 schema；不替代 test-engineering 做测试；不替代 code-audit 下最终通过结论。
- 涉安全、DB 写、发布、外部资料、观测和性能时，只输出触发原因和证据，切相邻技能继续。
- 证据不足时必须列阻塞项和下一步采证，禁止硬改。

## 高频 Bug 反例库

- 反例 1：README 当事实。
  - 错法：README 写 npm start，就认定生产入口也是它。
  - 对法：核 package、Dockerfile、CI、systemd/Kubernetes、部署变量和现网启动命令。
  - 根因：文档常滞后于真实运行链路。
- 反例 2：只追生产方。
  - 错法：看到字段写入就改名，没查前端、SDK、导出和测试。
  - 对法：全量搜 producer/consumer、序列化、Mock、报表、旧入口和断言。
  - 根因：数据契约会跨层传播。
- 反例 3：学习时顺手改。
  - 错法：边读边修，最后无法区分证据、假设和改动影响。
  - 对法：先输出证据地图和风险，进入实现阶段再切对应技能。
  - 根因：学习目标是建立心智模型，不是直接落代码。
- 反例 4：误认废弃链路。
  - 错法：按 old/legacy 目录里的 handler 定位当前业务。
  - 对法：验证路由注册、构建入口、引用、部署配置和流量入口。
  - 根因：仓库常保留历史残留和迁移中代码。
- 反例 5：漏权限链路。
  - 错法：只看 service 逻辑，没看 middleware、scope 和 owner 校验。
  - 对法：追 auth、permission、租户、资源归属、批量操作和审计日志。
  - 根因：权限通常分散在公共层和业务层。
- 反例 6：环境差异漏查。
  - 错法：本地 SQLite 通过就认为生产 MySQL/PostgreSQL 也安全。
  - 对法：查 prod configuration、DB 类型、迁移、驱动、feature flag 和部署事实。
  - 根因：环境差异会改变行为和风险。
- 反例 7：忽略异步副作用。
  - 错法：API 返回正常就认为链路完成。
  - 对法：追 queue、定时任务、回调、通知、cache、审计日志和补偿任务。
  - 根因：业务副作用常在异步链路。
- 反例 8：同名函数误导。
  - 错法：搜到同名 handler 就开始分析。
  - 对法：从真实路由、调用引用、构建入口和运行配置确认可达性。
  - 根因：同名代码不等于线上路径。
- 反例 9：测试入口不查。
  - 错法：理解完才发现没有环境、fixture 或命令可验证。
  - 对法：学习时同步识别 test entry、CI、mock、fixture 和手测路径。
  - 根因：无法验证的理解不能支撑改动。
- 反例 10：monorepo 边界错。
  - 错法：只改当前 package，漏 workspace 依赖、exports 和构建产物。
  - 对法：查 workspace graph、lockfile、内部包版本、生成命令和消费者。
  - 根因：大型仓库影响面跨包传播。
- 反例 11：直接改生成代码。
  - 错法：在 generated SDK/ORM 文件里修字段。
  - 对法：找到 OpenAPI/GraphQL/protobuf/schema 源和生成命令，再评估消费者。
  - 根因：生成产物会被覆盖，源头契约才是事实。
- 反例 12：AI 生成代码未验事实。
  - 错法：接受 AI 写出的 API、字段、异常类和权限判断。
  - 对法：用项目既有用法、官方资料或最小运行验证每个关键点。
  - 根因：AI 代码常语法正确但语义不存在。
- 反例 13：架构漂移未识别。
  - 错法：复制迁移前旧模块的分层和依赖方向到新功能。
  - 对法：比较当前主路径、近期模块、lint/CI 规则和架构约束。
  - 根因：项目约定会演进，旧模式可能已废弃。
- 反例 14：配置 key 只搜代码。
  - 错法：改默认值后不查 CI secret、Helm、配置中心和启动脚本。
  - 对法：追配置定义、覆盖优先级、环境差异、重启/热加载和回滚版本。
  - 根因：实际配置值常在运行环境而不在源码。
- 反例 15：证据索引缺失。
  - 错法：输出“链路大概是 A 到 B”，没有 file:line 或命令证据。
  - 对法：每个结论绑定文件行、命令输出、路由、配置、测试或日志入口。
  - 根因：不可复核的学习结果无法支持审计和交接。

## 提交前自检清单

- [ ] frontmatter name/description 存在，H1 为 Project Learning实战排障版或等价技能名实战排障版。
- [ ] 行数 < 500，fenced code block 数为 0，正文不出现三个反引号。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例不少于 10 条，且每条能被“反例 数字”命中，并包含错法、对法、根因。
- [ ] 关键词覆盖：entrypoint、call graph、data flow、consumer、producer、configuration、environment、permission、auth、state machine、cache、queue、feature flag、monorepo、workspace、generated code、test entry、impact map、AI 生成代码痕迹、架构漂移、依赖边界、证据索引。
- [ ] 已覆盖陌生项目读图、入口识别、调用链/数据流/配置/路由/测试基线、monorepo、AI 生成代码、架构漂移、依赖边界和风险边界。
- [ ] 输出要求包含证据索引、入口地图、调用链、数据/状态链、项目约定、测试基线、风险未知和下一步技能。
- [ ] 边界清楚：只读学习，不替代实现、测试、审计、发布、DB/API 设计、观测或外部资料查证。

## 2024-2026 新坑速查

- Monorepo / workspace：pnpm、Nx、Turborepo、Bazel、Gradle multi-project、package exports 和 workspace protocol 会让 impact map 跨包传播。
- Generated code：OpenAPI、GraphQL、protobuf、ORM、SDK、AI scaffold 生成文件不可直接当源头；必须找到 schema、模板和生成命令。
- AI 生成代码痕迹：伪 API、伪字段、弱异常处理、缺权限/并发/测试、重复模板和不存在的配置 key 要逐项用项目证据验证。
- 架构漂移：迁移中目录、新旧分层并存、双框架、旧状态管理、废弃中间件会让同类实现不可直接照搬。
- Feature flag / 实验：真实链路可能由 flag、灰度、租户、地区、账号套餐和远端配置控制。
- Serverless / edge：入口、环境变量、冷启动、区域、日志和回滚与传统服务不同。
- RSC / SSR / hydration：前端项目要区分 server/client boundary、路由层、数据获取位置和缓存层。
- Platform engineering：IDP、模板、golden path、service catalog 和 scorecard 可能隐藏部署、权限和观测约定。
- Supply chain：lockfile、postinstall、私有 registry、包签名、provenance、package exports 会影响运行与构建。
- Observability as code：dashboard、alert、SLO、runbook、release marker 可能在独立仓库或平台，不一定在服务代码旁。
- Policy as code：OPA、Kyverno、云 IAM、GitHub rulesets、CODEOWNERS 会影响权限、发布和合规边界。
- LLM / AI 集成：prompt、tool call、vector store、model version、token cost、safety filter 和日志脱敏是独立数据流。

## 与相邻技能的边界

- 本技能负责：陌生项目读图、真实入口识别、call graph、data flow、producer/consumer、configuration/environment、permission/auth、test entry、monorepo/workspace、generated code、架构漂移、AI 生成代码痕迹、依赖边界、impact map 和证据索引。
- research：负责外部事实、官方资料、版本口径、资料冲突和引用；project-learning 只读项目内部事实，外部行为不确定时切 research。
- api-design：负责 API 契约、状态码、认证授权、幂等、分页、OpenAPI/SDK 和兼容策略；project-learning 只找现有 API 入口、消费者和契约证据。
- db-design：负责 schema、索引、SQL、事务、迁移、数据修复和 DB 写安全；project-learning 只识别表/字段/读写路径和数据影响面。
- test-engineering：负责测试策略、场景矩阵、自动化、CI 证据、flaky 和覆盖结论；project-learning 只识别测试基线、可验证入口和缺口。
- release-engineering：负责构建产物、环境、CI/CD、灰度、回滚、冒烟和发布证据；project-learning 只识别部署入口、配置差异和发布风险线索。
- observability-sre：负责 logs/metrics/traces、SLI/SLO、告警、incident、runbook 和观测治理；project-learning 只识别日志/指标/trace 入口和排障证据位置。
- code-audit：负责代码改动后的需求对账、影响面、安全质量和证据最终收口；project-learning 是改动前的证据地图输入，不能替代最终审计。
