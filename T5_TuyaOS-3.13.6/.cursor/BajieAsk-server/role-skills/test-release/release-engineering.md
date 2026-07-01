---
name: release-engineering
description: 发布工程实战排障版；聚焦 CI/CD、制品、SBOM、签名、SLSA、OCI、Helm/K8s、灰度回滚、迁移编排、feature flag、provenance、缓存污染、secret 与供应链 attestation 的发布证据链和变更闸门。
---

# Release Engineering实战排障版

## 快速总则

1. 发布工程只对“可发布、可追溯、可回滚、可审计”的变更放行；不替后端写业务实现，不替云/IaC 设计资源拓扑，不替 SRE 运营长期告警。
2. 每次先锁定版本、提交、分支、tag、构建号、runner、镜像 digest、artifact checksum、环境、发布窗口、回滚入口；证据不足先补证据，不靠“应该没问题”。
3. 同一发布只允许一个不可变制品贯穿 dev、staging、prod；禁止 prod 重新 build、重新打包、重新 npm install、重新渲染未锁定依赖。
4. 变更闸门必须覆盖构建、测试、安全扫描、SBOM、签名、provenance、审批、迁移、灰度、监控、回滚演练；缺任一关键证据需标风险。
5. 发布排障按“入口差异 → 制品差异 → 配置差异 → 权限/secret → 网络/registry → 编排策略 → 健康信号 → 回滚路径”收敛。
6. CI/CD 失败先看第一失败点、runner 镜像、缓存命中、凭证来源、权限 scope、并发取消策略；不要只重跑。
7. 发布成功不等于业务成功；必须有 smoke、synthetic、关键 SLI、错误预算、用户路径、回滚验证共同闭环。

## 场景执行卡

### 1. CI/CD 流水线事实读取

- 读取 workflow/pipeline 文件、触发条件、branch/tag 过滤、matrix、needs、environment、protected deployment、manual approval、concurrency、timeout。
- GitHub Actions 重点核对 permissions 最小化、OIDC subject、environment secret、reusable workflow pin、action pin 到 SHA、artifact retention、cache key。
- GitLab CI 重点核对 stages、rules/only/except、needs、resource_group、protected variables、runner tags、interruptible、manual job、child pipeline。
- 输出必须列出构建号、提交 SHA、触发人/触发源、runner 镜像、失败 job、第一错误、重跑是否改变输入。

### 2. 不可变制品与 artifact 管理

- 发布前确认 artifact 名称、版本、checksum、digest、签名、SBOM、provenance、构建日志、依赖锁文件一致。
- Docker/OCI 必须用 digest 部署；tag 只能作为人类标签，不能作为唯一发布依据。
- 多平台镜像核对 manifest list、架构、base image digest、cosign 签名、registry replication 状态。
- Maven/npm/pip/go/cargo 等制品需核对 lock、registry、私服代理、缓存策略、重试是否引入漂移。

### 3. SBOM / 签名 / SLSA / provenance 闸门

- SBOM 至少说明生成工具、格式、生成阶段、绑定 artifact digest、是否包含 transitive dependencies。
- 签名验证要绑定 identity、issuer、cert subject、 Rekor / transparency log、keyless OIDC 策略或 key rotation 记录。
- SLSA/provenance 需证明 builder、source、materials、invocation、predicateType 与 artifact digest 对上。
- 发现 attestation 缺失、签名和 digest 不匹配、SBOM 来自源码而非最终制品时，不应放行生产发布。

### 4. Docker / OCI 构建排障

- 读取 Dockerfile、build context、.dockerignore、BuildKit、build args、secrets mount、target、cache-from/cache-to、base image。
- 排查缓存污染：错误 cache key、跨分支共享 layer、未纳入 lockfile、ARG 变化未触发、remote cache 被旧主分支覆盖。
- 排查镜像拉取：registry auth、rate limit、镜像策略、digest 不存在、多区域复制延迟、平台架构不匹配。
- 禁止在镜像层写入 secret、token、npmrc、pip.conf；构建期 secret 必须走临时 mount 或 OIDC 短凭证。

### 5. Helm / Kubernetes 发布闸门

- 发布前核对 chart version、appVersion、values 来源、render 后 YAML、image digest、namespace、serviceAccount、RBAC、CRD 顺序。
- Helm upgrade 必须明确 atomic、timeout、wait、history-max、rollback 命令、hook 权重和 hook delete policy。
- K8s rollout 排障先看 events、replicas、readiness、startupProbe、资源限额、PDB、HPA、node selector、tolerations。
- CRD、webhook、Job hook、数据库迁移 Job 与主服务 rollout 必须分阶段验证，避免 hook 卡死导致半发布。

### 6. 环境变量、secret 与权限

- 列清配置来源优先级：repository variable、environment secret、runner env、ConfigMap、Secret、Helm values、runtime override。
- secret 轮换要验证消费者重载方式、旧版本 Pod 是否仍持有旧 secret、审计日志是否暴露、失败回滚是否依赖已撤销凭证。
- OIDC 联邦凭证需核对 audience、subject、repo/ref/environment 绑定，避免 PR fork 或非保护分支获得发布权限。
- 输出时禁止泄露 secret 值，只能报告变量名、来源、scope、是否存在、是否过期、权限是否越界。

### 7. 灰度 / 金丝雀 / 蓝绿 / feature flag

- 发布策略必须说明流量比例、目标人群、持续时间、观测指标、自动/手动晋级条件、暂停条件、回滚条件。
- canary 核对路由层、Service mesh、Ingress、LB、header/cookie、sticky session、缓存命中是否真的命中新版本。
- feature flag 核对默认值、离线降级、服务端/客户端缓存 TTL、实验平台分桶、跨服务兼容、回滚时的 flag 顺序。
- 蓝绿发布核对数据库兼容、后台任务幂等、队列消费者唯一性、定时任务是否双跑。

### 8. 数据迁移编排

- 只负责发布编排与闸门：expand-contract、迁移 job 顺序、锁表风险、超时、备份、回滚点、业务开关；具体 SQL 设计交给 db-design。
- 迁移前确认 schema 兼容、旧新代码共存窗口、回填速率、批大小、重试幂等、监控指标、失败中断策略。
- contract 阶段必须晚于旧版本完全下线和数据验证；禁止同一发布同时删字段、改语义、切读写。
- 回滚计划要说明代码回滚、flag 回滚、迁移回滚是否独立，哪些迁移只能 roll-forward。

### 9. 回滚 / roll-forward / 事故止血

- 先判定是否数据破坏、制品破坏、配置破坏、依赖破坏、流量破坏；不同类型回滚入口不同。
- 回滚命令必须提前验证：Helm revision、Argo/Rollouts、GitOps commit revert、registry digest、DB 迁移状态、feature flag 状态。
- 回滚后必须验证旧版本镜像 digest、Pod 重建、流量恢复、关键 SLI、错误率、队列积压、数据写入兼容。
- roll-forward 仅适用于根因明确且修复制品已通过同等闸门；禁止线上热改绕过 provenance。

### 10. 发布后验证与审计

- smoke 覆盖登录/核心写路径/支付或订单等关键业务、静态资源、后台任务、外部依赖、权限边界。
- 观测窗口至少包含 deploy marker、日志错误、RED/USE、APM trace、业务指标、synthetic、告警状态。
- 审计记录包含谁批准、发布什么、发布到哪里、证据链接、例外审批、风险接受、回滚结果。

## 高频坑 / 防遗漏

- tag 漂移：同名镜像 tag 被覆盖，生产实际 digest 与测试 digest 不同。
- cache 污染：主分支和 PR 共用缓存，旧依赖或旧构建产物混入 release。
- secret 错域：repo secret 覆盖 environment secret，或 protected env 未限制部署分支。
- approval 形同虚设：人工审批发生在构建前，不在部署前，无法审制品证据。
- Helm hook 悬挂：迁移 Job 未设置超时和删除策略，阻塞后续发布和回滚。
- readiness 误判：探针只测进程不测依赖，流量提前打入未就绪版本。
- feature flag 顺序错：先下线旧代码再关 flag，导致旧客户端或异步任务读到未知状态。
- SBOM 不可信：源码 SBOM 与最终镜像不一致，未绑定 digest。
- provenance 断链：签名的是 tag，不是 digest；attestation builder 身份无法匹配。
- 回滚未演练：保留镜像被 registry retention 清理，旧 chart values 不可恢复。
- DB contract 过早：删列与代码切换同批发布，回滚时旧代码启动失败。
- GitOps 漂移：手工 kubectl hotfix 未回写 Git，下一次同步覆盖线上状态。

## 输出要求

1. 发布对象：服务/组件、版本、commit、tag、artifact、digest、环境、发布窗口。
2. 证据链：CI/CD run、测试报告、安全扫描、SBOM、签名、provenance、审批、变更单、制品校验。
3. 风险判断：阻断项、可接受风险、需人工确认项、跨技能移交项。
4. 执行步骤：发布、灰度、验证、晋级、暂停、回滚、roll-forward，每步给可验证信号。
5. 排障结论：第一失败点、根因证据、影响范围、是否需要重跑、重跑输入是否变化。
6. 最终状态：已发布/未发布/部分发布/已回滚；附 smoke、SLI、告警、审计证据。
7. 不输出 secret 值、私钥、token、完整环境变量内容；只输出脱敏字段与权限判断。

## 约束

- 不替 backend-engineering 修改业务启动、接口语义、任务幂等实现；只定义发布闸门和证据。
- 不替 cloud-native 设计集群网络、控制面、调度策略；只核对发布所需 K8s/Helm 证据。
- 不替 iac-terraform 管理 state、module、provider 漂移；只消费 IaC 输出和发布依赖清单。
- 不替 devsecops 做漏洞定级和安全策略豁免；只把扫描、签名、SBOM、attestation 纳入放行门禁。
- 不替 observability-sre 运营 SLO；只要求发布窗口的验证信号和事故时间线。
- 不替 shell-scripting 重写复杂脚本；发布脚本异常需移交 shell-scripting 做健壮性修复。
- 不把“重跑成功”当根因；必须说明为什么第一次失败、第二次输入是否相同。
- 不允许为赶发布关闭测试、扫描、签名、审批、provenance 或回滚验证，除非有显式风险接受。

## 高频 Bug 反例库

反例 1：错法：生产部署 latest tag。对法：部署 immutable digest，并记录 checksum、签名和 provenance。根因：tag 可变导致测试制品和生产制品不是同一个对象。

反例 2：错法：CI 失败后直接 rerun until green。对法：先锁定第一失败点、runner、缓存、外部依赖和输入差异。根因：重跑掩盖竞态、缓存污染和供应链抖动。

反例 3：错法：SBOM 在源码 checkout 后生成就放行镜像。对法：对最终 OCI image 生成或关联 SBOM，并绑定 digest。根因：最终镜像包含 base layer、系统包和构建产物，源码 SBOM 不完整。

反例 4：错法：cosign verify 只看签名存在。对法：校验 issuer、subject、identity、Rekor 记录、artifact digest 与策略匹配。根因：签名存在不代表签名者、来源和制品可信。

反例 5：错法：GitHub Actions 给 workflow 默认 write-all 权限。对法：按 job 设置最小 permissions，部署 job 才授予 OIDC 和 package 权限。根因：过大权限扩大 supply-chain 入侵影响面。

反例 6：错法：PR、main、release 共用同一个依赖和构建缓存 key。对法：cache key 纳入 OS、lockfile、工具链、分支/信任域，并限制 restore 范围。根因：跨信任域缓存会污染发布制品。

反例 7：错法：Helm upgrade 不设置 wait/timeout/atomic，以为命令返回就是发布成功。对法：开启等待、超时、原子回滚或明确人工回滚，并检查 rollout 和事件。根因：K8s 异步调度导致 CLI 成功不等于工作负载健康。

反例 8：错法：迁移和删字段与代码切换同一批完成。对法：expand-contract 分多阶段发布，先兼容写入和回填，最后 contract。根因：回滚窗口内旧代码和新 schema 不兼容。

反例 9：错法：灰度只看 Pod ready。对法：看新版本真实流量、错误率、延迟、业务指标、日志、trace 和 canary 分桶。根因：ready 只能证明容器接受探针，不能证明用户路径成功。

反例 10：错法：feature flag 默认开启，新版本失败后只回滚镜像。对法：flag 默认保守，定义关闭顺序、缓存 TTL 和旧客户端兼容。根因：配置状态独立于镜像，回滚代码不一定回滚行为。

反例 11：错法：secret 轮换后立即删除旧 secret。对法：确认所有 Pod、Job、runner、外部系统完成重载，再撤销旧凭证。根因：长生命周期进程和排队任务可能仍依赖旧凭证。

反例 12：错法：蓝绿切流后忘记暂停旧环境定时任务和消费者。对法：发布计划列明 scheduler、queue consumer、cron、webhook 的单活策略。根因：双写、重复消费和重复回调会造成业务副作用。

反例 13：错法：registry retention 清理旧镜像但保留 Helm revision。对法：回滚依赖的镜像 digest、chart、values、secret 版本都设保留策略。根因：Helm revision 只能指向旧配置，不能保证旧制品仍可拉取。

反例 14：错法：GitLab protected variable 允许非保护分支 pipeline 读取。对法：核对 protected refs、environment scope、runner tag 和 manual approval。根因：变量 scope 错误会把生产凭证暴露给低信任流水线。

反例 15：错法：GitOps 紧急 kubectl patch 后不记录。对法：临时变更必须回写 Git 或登记漂移，下一轮 sync 前确认差异。根因：声明式控制器会把手工状态覆盖，导致问题复现。

## 提交前自检清单

- 已读取发布配置、workflow/pipeline、Dockerfile/OCI 构建、Helm/K8s/GitOps 配置、制品仓库、变更单和回滚入口。
- 已确认 artifact digest、checksum、签名、SBOM、SLSA/provenance 与同一制品绑定。
- 已确认测试、安全扫描、审批、环境保护、secret scope、OIDC subject、runner 权限满足发布策略。
- 已确认部署用 digest 而非可变 tag，缓存 key 不跨信任域污染。
- 已确认迁移顺序、feature flag、灰度策略、健康检查、晋级/暂停/回滚条件。
- 已确认发布后 smoke、SLI、日志、trace、业务指标和告警窗口。
- 已列出相邻技能移交项，未越界替代云、IaC、后端、安全、SRE 或脚本实现。
- 已准备用户可执行的发布/回滚结论，且没有泄露 secret。

## 2024-2026 新坑速查

- GitHub Actions artifact attestation 与 npm/package provenance 已普及，但必须校验 subject digest、builder identity 和环境保护，不是生成了就可信。
- SLSA v1.x provenance、in-toto predicate、keyless signing 常见字段名相似，排障时必须核对 artifact digest 和 materials。
- Sigstore/cosign keyless 依赖 OIDC，issuer/subject 绑定过宽会让 fork、tag、非保护分支获得伪可信签名。
- Docker BuildKit remote cache、GitHub cache v4、GitLab distributed cache 会因 key 过宽造成 release 污染。
- OCI registry 多区域复制和镜像扫描异步化，digest 已推送不代表所有集群区域可拉取或已扫描完成。
- Kubernetes 1.25+ PodSecurityPolicy 移除后，发布失败可能来自 PSA/准入策略，而不是 Helm chart 本身。
- Kubernetes server-side apply、CRD schema、webhook timeout 与 Helm hook 顺序组合后，回滚可能卡在准入层。
- npm trusted publishing、PyPI trusted publishers、GitHub OIDC 减少长期 token，但 subject/audience 错配会造成发布中断或越权。
- SLSA、SBOM、VEX、license policy 被纳入企业门禁后，临时豁免必须记录过期时间和风险接受人。
- GitHub environment deployment protection rules、GitLab protected environments 可能让同一 pipeline 在 staging 成功、prod 卡审批或权限。
- Argo Rollouts、Flagger、service mesh canary 会让“Deployment ready”与“真实用户流量”脱钩。
- 供应链攻击常通过 dependency confusion、typosquat、action takeover、base image 替换进入发布链，必须 pin 和验证来源。

## 与相邻技能的边界

- backend-engineering：负责服务启动、接口、任务幂等、兼容性实现；release-engineering 负责把这些实现纳入发布窗口、smoke、回滚和变更闸门。
- devsecops：负责漏洞定级、安全策略、密钥处置和合规豁免；release-engineering 负责阻断缺扫描、缺签名、缺 SBOM、缺 attestation 的发布。
- cloud-native：负责 K8s 控制面、网络、调度、存储、准入策略设计；release-engineering 负责 Helm/K8s 发布证据、rollout、rollback、canary 与制品绑定。
- iac-terraform：负责 Terraform state、module、provider、drift 和资源变更；release-engineering 只消费 IaC 输出，确认环境依赖已就绪且变更顺序正确。
- observability-sre：负责 SLO、告警体系、incident 管理和长期可观测性；release-engineering 负责发布窗口 deploy marker、smoke、SLI 和回滚判据。
- shell-scripting：负责脚本健壮性、参数、并发、错误处理和跨平台细节；release-engineering 负责要求发布脚本可审计、幂等、可回滚、无 secret 泄露。
- code-audit：负责最终代码变更面、调用链、风险和遗漏审计；release-engineering 提供发布链路证据供其收口。
- test-engineering：负责测试矩阵、复现、回归、契约和自动化质量；release-engineering 负责把测试结果作为发布闸门并核验证据可追溯。
