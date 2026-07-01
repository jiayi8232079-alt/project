---
name: platform-engineering
description: 平台工程技能实战排障版 - 处理 Internal Developer Platform、Developer Experience、Backstage、Golden Path、self-service、Service Catalog、scorecard、guardrails、RBAC、多租户、Kubernetes 平台、GitOps、CI/CD 模板、平台产品化、FinOps、SLO、模板漂移和认知负担。涉及 IDP/开发者门户/平台治理/服务目录/自助交付时使用。
---

# 平台工程技能实战排障版

> 定位：把平台工程从“装门户/堆工具”拉回平台产品：用户是谁、能力边界是什么、入口如何闭环、证据能否证明 DevEx 与治理同时改善。
> 铁律：没有用户旅程、服务目录事实、执行面链路、权限/租户模型和指标基线，不得宣布 IDP、Golden Path 或 self-service 成熟。

## 快速总则（用户 / 能力 / 入口 / 证据）

1. 用户：先分清应用开发、SRE、平台团队、安全、FinOps、合规、管理者；每类用户的目标、痛点、权限和支持路径不同。
2. 能力：区分 Portal、Service Catalog、templates、workflow/orchestrator、CI/CD、GitOps、IaC、Kubernetes 平台、policy、observability、FinOps；不要把入口当能力。
3. 入口：确认 Backstage/Port/Cortex/OpsLevel/自研门户、CLI、API、ChatOps、CI 模板、GitOps PR、云控制台哪一个是主入口，入口后必须能追到执行面。
4. 证据：结论绑定 adoption、onboarding time、lead time、change failure rate、MTTR、工单量、满意度、scorecard 趋势、catalog drift、成本标签覆盖率。
5. 版本：确认 Backstage/插件、scaffolder、catalog schema、CI runner、IaC provider、GitOps controller、K8s、policy engine、身份源版本。
6. 环境：确认组织/团队/租户、云账号/project/namespace、RBAC、网络隔离、Secret、制品库、日志索引、成本中心、合规等级。
7. 复现：按用户旅程复现创建服务、首次部署、申请资源、发布、观测、扩缩容、故障定位、回滚、清理资源。
8. Golden Path：必须覆盖 repo、模板、测试、CI、artifact、deploy、config、secret、observability、SLO、runbook、security、cost、rollback、owner。
9. Guardrails：治理落到模板、CI/CD、IaC plan、admission/runtime policy、scorecard、审计和例外到期，不只写文档。
10. 平台即产品：必须有 roadmap、用户反馈、支持 SLO、release notes、迁移计划、弃用策略和 adoption funnel。

## 场景执行卡

### 1. 平台现状评估与路线图
- 适用：从零建设 IDP、平台没人用、工具碎片化、交付慢、治理靠人工。
- 输入：用户访谈、工单、DORA、onboarding 时间、服务创建步骤、发布频率、MTTR、owner/成本标签缺失率。
- 动作：画能力地图：Portal、catalog、templates、CI/CD、GitOps、IaC、K8s/cloud runtime、Secret、observability、安全、FinOps、文档、支持。
- 证据：top 3 摩擦点、北极星指标、MVP 范围、90 天路线图、迁移批次、风险与依赖。
- 兜底：没有访谈/指标基线时，只能给调研计划和假设，不能给工具采购结论。

### 2. IDP 分层架构
- 适用：设计 Internal Developer Platform、平台编排器、门户与执行面集成。
- 动作：分清体验层 Portal/Backstage、控制层 workflow、执行层 CI/CD/GitOps/IaC/cloud API、治理层 policy/scorecard/audit、数据层 catalog/metadata/events。
- 验证：状态单一事实源、幂等、重试、回滚、审计、最小权限、correlation id、失败可定位。
- 高频坑：Portal 直接用平台管理员权限调云 API，绕过策略、审计、GitOps 和回滚。

### 3. Developer Experience 诊断
- 适用：开发者抱怨平台难用、认知负担高、支持工单多、团队绕平台。
- 动作：拆 onboarding、inner loop、review、deploy、observe、operate、incident、cleanup；结合指标和访谈。
- 证据：首次服务创建/部署时间、文档查找时间、失败率、错误可理解度、满意度、支持响应时间。
- 高频坑：只数按钮和自动化步骤，不看排障、文档、错误提示、等待时间和支持质量。

### 4. Golden Path / paved road 设计
- 适用：服务创建、API、批处理、前端、数据管道、模型服务、基础设施申请。
- 动作：定义适用边界、参数 schema、默认安全、测试、CI/CD 模板、Secret、观测、SLO、runbook、scorecard、成本、回滚、升级策略。
- 验证：端到端走通、生成物可测试、可升级、可注册 catalog、可回滚、可受控逃逸。
- 高频坑：只生成 repo，不生成运行时、观测、告警、runbook、生产准入和迁移路径。

### 5. Backstage / Developer Portal
- 适用：开发者门户、Service Catalog、Software Templates、TechDocs、插件集成。
- 动作：确认 auth、permission framework、catalog provider、entity model、scaffolder actions、TechDocs 存储、插件维护状态。
- 验证：catalog-info owner/system/lifecycle/type/API/resource/dependency 完整，scaffolder 权限可审计，TechDocs 与 repo 同源。
- 高频坑：把 Backstage 当万能 workflow 引擎，在模板里塞长时间高权限且不可回滚的动作。

### 6. Service Catalog 治理
- 适用：owner 不清、依赖不明、资产重复、故障找不到人、scorecard 不可信。
- 动作：定义 entity 标准：owner、system、component、API、resource、dependency、lifecycle、tier、SLO、on-call、repo、runtime、data classification。
- 验证：从 repo、CI、K8s/APM、云资源自动同步；owner 必填；orphan entity 和 drift 检测。
- 高频坑：人工注册目录后无人 reconcile，三个月后与真实环境漂移。

### 7. Self-service 工作流
- 适用：自助创建服务、环境、数据库、队列、域名、发布版本、preview env。
- 动作：按风险定义 allow/warn/block/exception；设计状态、幂等、日志、重试、回滚、审批、通知、TTL、清理、成本标签。
- 验证：低风险自动完成，中风险策略校验，高风险审批；每一步有审计、失败恢复和用户可理解错误。
- 高频坑：只做创建，不做更新、删除、过期回收、成本归属和失败补偿。

### 8. Templates 与 CI/CD 模板治理
- 适用：服务模板、CI/CD 模板、IaC 模块、运行时配置、组织基线升级。
- 动作：锁语言/框架版本、参数 schema、默认测试/lint/SCA/SBOM、Dockerfile、健康检查、OpenTelemetry、readiness、runbook。
- 验证：模板版本化、自动测试、生成后验证、批量升级、弃用计划、catalog 自动注册、漂移检测。
- 高频坑：模板生成即遗留，无法批量升级安全、可观测、CI/CD 和依赖基线。

### 9. Scorecard 与质量门禁
- 适用：生产准入、服务健康度、治理推动、持续改进。
- 动作：按 tier 定 ownership、SLO、漏洞、依赖 freshness、runtime support、backup、runbook、成本标签、incident readiness。
- 验证：数据源自动采集，红项有修复路径，例外有 owner/到期日，趋势能追踪。
- 高频坑：scorecard 只排名羞辱团队，不提供修复指引、例外机制和自动修复入口。

### 10. Guardrails 与合规内建
- 适用：安全、合规、成本和审计要求平台化。
- 动作：把策略放进 templates、CI、IaC plan、admission control、runtime policy、scorecard；区分 allow/warn/block/exception。
- 验证：审计证据、例外流程、修复链接、自动修复、告警路由、例外到期清理。
- 高频坑：平台为了自助绕过安全，最后又退回人工审批和线下例外。

### 11. Multi-tenant / RBAC 平台治理
- 适用：多团队共享门户、K8s、云账号、runner、日志、制品库、FinOps 数据。
- 动作：设计 identity、RBAC/ABAC、namespace/account/project、quota、network、secret、runner、artifact、observability data、cost、audit 隔离。
- 验证：越权测试、noisy neighbor、配额、成本归属、日志可见性、应急隔离、break-glass 审计。
- 高频坑：只做 UI 权限，底层 token、runner、Secret、日志索引和制品发布权限共享。

### 12. 平台运营与采用率
- 适用：平台建成但没人用、旧路绕行、迁移阻力大、认知负担上升。
- 动作：建立 adoption funnel、office hour、champion、迁移工具、release notes、弃用期限、支持 SLO、反馈闭环。
- 验证：采用率、失败率、支持工单下降、满意度、旧路收口、成本趋势、异常绕行原因。
- 高频坑：用强制门禁替代产品运营，导致团队复制旧脚本绕平台。

## 高频坑 / 防遗漏

- 做 IDP：同步查 Portal、orchestrator、CI/CD、GitOps、IaC、runtime、policy、catalog、observability、FinOps、support。
- 做 Golden Path：同步查 repo、template、pipeline、deploy、secret、config、SLO、runbook、scorecard、rollback、升级。
- 做 Backstage：同步查 auth、permission、catalog provider、entity schema、scaffolder action、TechDocs、插件维护。
- 做 Catalog：同步查 owner、system、lifecycle、tier、dependency、SLO、on-call、runtime、data classification、drift。
- 做 Self-service：同步查 RBAC、审批、策略、幂等、状态、日志、回滚、通知、TTL、清理、成本标签。
- 做 CI/CD 模板：同步查 runner 权限、缓存、制品签名、SBOM、环境保护、回滚、模板版本漂移。
- 做 Scorecard：同步查数据源、自动采集、tier 差异、修复链接、例外、趋势、误报处理。
- 做 Multi-tenant：同步查 identity、quota、network、secret、runner、artifact、observability、cost、audit。
- 做平台运营：同步查 adoption、满意度、支持 SLO、roadmap、迁移工具、弃用策略、认知负担。

## 输出要求

平台工程任务输出必须包含：
1. 平台目标：要解决的 Developer Experience、交付、治理、合规、成本或可靠性问题。
2. 用户与能力：目标用户、平台能力边界、入口、执行面和不负责事项。
3. 版本/环境：Portal/Backstage、CI/CD、GitOps、IaC、runtime、policy、catalog schema、身份和租户模型。
4. 入口与复现：用户旅程、触发入口、失败步骤、错误提示、correlation id、工单/指标证据。
5. 现状证据：服务目录、工具链、交付链路、治理缺口、指标基线、成本/owner 覆盖。
6. 推荐方案：IDP 分层架构、Golden Path、Service Catalog、templates、self-service、guardrails、scorecard。
7. Multi-tenant：身份、RBAC、隔离、配额、成本、审计和应急隔离。
8. 度量：adoption、onboarding time、lead time、change failure rate、MTTR、工单量、满意度、scorecard 趋势。
9. 落地计划：MVP、90 天路线图、迁移批次、风险、依赖、回滚和弃用。
10. 未确认点：组织权限、云账号、合规要求、运行时版本、owner、支持模型。

## 约束

- 禁止把平台工程简化为安装 Backstage、门户链接集合或 CI 模板仓库。
- 禁止没有用户旅程和指标基线就规划大而全平台。
- 禁止把 Golden Path 做成不可逃逸的 Golden Cage；例外必须可见、可审计、有到期。
- 禁止 self-service 绕过安全、合规、成本、审计、回滚和清理。
- 禁止只靠文档治理；guardrails 必须进入自动化执行点。
- 禁止 templates 硬编码组织密钥、个人权限、环境 ID 或不可迁移路径。
- 禁止平台抽象吞掉底层错误；错误要追踪到 workflow、CI、IaC、GitOps、runtime、cloud API。
- 禁止 scorecard 只排名不赋能；失败项必须有 owner、修复路径和例外机制。
- 禁止多租户共享高权限凭证、未隔离 runner、敏感日志索引或制品发布权限。
- 禁止把 FinOps 只做账单展示；必须落到标签、quota、TTL、预算告警和回收。
- 涉具体实现、测试和审计时，按边界联动对应技能。

## 高频 Bug 反例库

- 反例 1：Backstage = IDP
  - 错法：装门户和链接后宣布平台工程完成。
  - 对法：Portal 背后接 CI/CD、IaC、runtime、policy、observability、FinOps 和 audit。
  - 根因：把入口误认为能力，忽略执行面与治理闭环。
- 反例 2：Golden Path 只有脚手架
  - 错法：模板只生成目录、README 和示例代码。
  - 对法：覆盖构建、测试、部署、Secret、观测、SLO、runbook、scorecard 和回滚。
  - 根因：只优化创建瞬间，没有覆盖生产生命周期。
- 反例 3：Scorecard 羞辱团队
  - 错法：全公司统一排名，红项无修复链接。
  - 对法：按 tier 定规则，红项给自动修复、owner、例外流程和到期日。
  - 根因：把治理当考核，没有把平台当赋能产品。
- 反例 4：Self-service 无清理
  - 错法：自助创建 preview env/DB/队列，但没有 TTL、成本标签和销毁。
  - 对法：每个资源有 owner、purpose、cost center、TTL、审计和删除路径。
  - 根因：只设计 happy path，漏掉资源生命周期与 FinOps。
- 反例 5：多租户只做 namespace
  - 错法：namespace 分开但共享 cluster-admin token、runner、Secret、日志索引。
  - 对法：身份、RBAC、网络、Secret、runner、artifact、observability、cost 全链路隔离。
  - 根因：只看 Kubernetes 名称空间，没做端到端租户威胁模型。
- 反例 6：平台强推无采用
  - 错法：直接关停旧路要求迁移。
  - 对法：先让新路更快更稳，提供迁移工具、支持和期限，再逐步收口。
  - 根因：忽略开发者体验和认知负担，用行政命令替代产品运营。
- 反例 7：模板不可升级
  - 错法：服务生成后永远停在旧依赖、旧 CI 和旧可观测基线。
  - 对法：模板版本化，提供迁移脚本、弃用策略、批量 PR 和 scorecard 追踪。
  - 根因：把模板当一次性脚手架，没有设计模板漂移治理。
- 反例 8：Portal 高权限直连云 API
  - 错法：用户点击按钮即用平台管理员权限创建资源，无审计和回滚。
  - 对法：通过受控 workflow、策略、最小权限、GitOps/IaC 变更和环境审批执行。
  - 根因：追求低摩擦时绕过 guardrails 和职责分离。
- 反例 9：Catalog 全靠人工维护
  - 错法：手填 owner 和依赖，运行时变化后目录失真。
  - 对法：repo、CI、APM、K8s、云资源自动 reconcile，orphan entity 自动标红。
  - 根因：没有把 catalog 当数据产品维护，缺少同步源和漂移检测。
- 反例 10：平台抽象遮蔽错误
  - 错法：用户只看到“创建失败”，不知道是 IAM、quota、policy 还是 GitOps。
  - 对法：错误带 correlation id，能追到 workflow、CI、IaC、GitOps 和 cloud API。
  - 根因：抽象层只包装成功路径，缺少可观测性和错误分类。
- 反例 11：RBAC 只做门户菜单
  - 错法：Portal 隐藏按钮，但 API、runner、K8s RoleBinding 和云 IAM 仍可越权。
  - 对法：统一身份映射，端到端权限校验，定期做越权测试和审计。
  - 根因：权限模型停在 UI 层，没有覆盖执行面凭证链。
- 反例 12：FinOps 只展示账单
  - 错法：门户展示团队成本图，但资源没有标签、quota、预算告警和回收。
  - 对法：self-service 默认写入成本标签，配 quota/TTL/预算告警，scorecard 暴露浪费项。
  - 根因：把成本治理当报表，没有嵌入资源申请和生命周期。

## 提交前自检清单

- [ ] 行数 < 500，且无 fenced code block。
- [ ] 已覆盖用户、能力、入口、证据。
- [ ] 已覆盖版本、环境、复现、服务目录事实和指标基线。
- [ ] 已区分 IDP、Portal、Backstage、PaaS、CI/CD、GitOps、IaC、runtime 和 cloud console。
- [ ] 已覆盖 Developer Experience、Golden Path、Service Catalog、self-service、templates、scorecard、guardrails。
- [ ] 已覆盖 RBAC、multi-tenant、Kubernetes 平台、平台产品化、FinOps、SLO、模板漂移和认知负担。
- [ ] 已列反例不少于 10 条，且每条有错法/对法/根因。
- [ ] 已说明输出要求、约束、2024-2026 新坑和相邻技能边界。
- [ ] 已标明 K8s/安全/发布/观测/后端/测试/审计需联动技能。

## 2024-2026 新坑速查

- AI 模板膨胀：LLM 生成脚手架若无测试、锁文件、SBOM 和扫描，会批量制造供应链风险。
- Portal 工具泛滥：Backstage、Port、Cortex、OpsLevel、自研门户选型要回到数据模型、权限、插件维护和执行面集成。
- 平台编排器边界不清：workflow、GitOps、IaC、CI/CD 状态双写会形成漂移，必须定义单一事实源。
- Golden Path 变 Golden Cage：治理压力容易把推荐路径变强制唯一道路，需保留受控例外。
- Scorecard 数据质量：catalog drift 会误判服务健康，需自动同步、owner 确认和误报处理。
- 平台成本黑洞：preview env、DB、队列、日志索引、runner 自助创建后必须有 TTL、quota、FinOps 标签。
- 多云多租户权限漂移：云 IAM、K8s RBAC、Portal 权限、CI token 不一致会越权。
- 开发者体验局部优化：只优化创建服务，不优化 inner loop、调试、故障定位和升级，会让平台被绕开。
- 合规左移变阻塞：policy 只有 block 没解释和自动修复会制造绕平台行为。
- Backstage 插件风险：插件维护、权限模型和内部 API 变化会让关键路径脆弱，核心 action 要有测试和回滚。
- 平台 SLO 缺失：门户、CI、模板、GitOps 成为关键路径后，没有 SLO 会放大全组织停摆。
- 模板漂移放大：语言版本、CI runner、基础镜像、OTel SDK 和安全扫描基线不同步，会批量形成隐性遗留。
- 认知负担转移：平台把云/K8s 复杂度换成门户表单复杂度，需默认值、分层参数和渐进披露。

## 与相邻技能的边界

- 本技能负责：平台工程方法、IDP 抽象、DevEx、Golden Path、Service Catalog、self-service、scorecard、guardrails、RBAC/multi-tenant、平台运营和度量。
- cloud-native：负责 Kubernetes/GitOps 控制器、集群能力、运行时 YAML/Helm/Kustomize 细节；本技能只定义平台抽象与边界。
- iac-terraform：负责 Terraform/OpenTofu 模块、状态、plan/apply 和 provider 细节；本技能只定义自助入口、策略和生命周期。
- devsecops：负责供应链、安全扫描、策略规则和漏洞治理细节；本技能只定义 guardrails 落点和例外机制。
- observability-sre：负责指标、日志、链路、告警、SLO 实现和事故流程；本技能只要求 Golden Path 默认接入和证据闭环。
- release-engineering：负责发布策略、流水线、制品、回滚和上线窗口；本技能只管 CI/CD 模板体验与治理要求。
- finops：负责成本模型、预算、分摊和优化；本技能只确保标签、quota、TTL、成本反馈进入 self-service。
- backend-engineering：负责应用架构、API、代码和运行时行为；本技能只定义服务模板与平台契约。
- test-engineering：负责测试矩阵、回归、质量门禁验证；平台改动涉及模板/工作流/权限时必须联动。
- code-audit：负责最终审计改动影响面、风险和遗漏；远端技能更新完成前必须收口。
