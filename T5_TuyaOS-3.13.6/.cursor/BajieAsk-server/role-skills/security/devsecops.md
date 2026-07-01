---
name: devsecops
description: DevSecOps 实战排障版 - 安全左移、CI/CD 安全门禁、资产/流水线/策略/证据闭环，覆盖 SAST/DAST/SCA/secret scanning、SBOM、SLSA、Sigstore/cosign、OIDC workload identity、容器镜像扫描、IaC policy OPA/Conftest、最小权限、依赖混淆、制品签名与 provenance、CVE triage 和供应链风险治理。涉及依赖漏洞、许可证、镜像、密钥、CI 权限、制品可信、发布门禁或交付安全证据时使用。
alwaysApply: false
---

# DevSecOps实战排障版

> 定位：只做授权防御与交付安全，把代码到制品到发布前的风险收敛为“资产清楚、流水线受控、策略可执行、证据可复核”。
> 铁律：未授权不主动扫描；未核资产、版本、配置、可达性不判命中；不输出完整 Secrets、token、admin key、私钥、cookie 或连接串；不为过门禁而降级、绕过、伪造或扩大豁免。

## 快速总则：资产 / 流水线 / 策略 / 证据

1. 资产：先列仓库、分支、commit、包管理器、lockfile、镜像、artifact、IaC root、CI runner、registry、云账号、环境、owner 和授权边界。
2. 流水线：梳理 commit → dependency install → test → SAST/DAST/SCA/secret scanning → build → SBOM → image scan → sign/provenance → attest → release gate。
3. 策略：把规则分成阻断、告警、baseline、例外；阻断只给高确信新增风险、有效密钥、恶意包、未签名生产制品、provenance 缺失、关键策略违规。
4. 证据：结论绑定文件/行号、规则 ID、CVE/GHSA、包版本、依赖路径、license、image digest、workflow run、SARIF/JSON、SBOM、signature、attestation、provenance。
5. 复现：漏洞先核 affected versions、配置、启用模块、依赖路径、打包范围、运行环境和利用条件；工具命中不等于真实可利用。
6. 分级：按可利用性、资产敏感度、暴露面、是否 KEV/公开利用、是否打入生产制品、修复复杂度和补偿控制排序。
7. 最小权限：CI 默认 read-only；发布 job 单独授权；优先 OIDC workload identity 短期凭证；不可信 PR、fork、第三方脚本不接触生产 secret。
8. 可追溯：生产 artifact/image 必须能回链 commit、builder、workflow、materials、SBOM、signature、provenance、digest 和审批记录。
9. 渐进门禁：首次接入先 baseline 现存噪声；只阻断新增 Critical/High、高置信 Secrets、恶意包、禁止许可证、未签名或无 provenance 的生产制品。
10. 安全不替代测试/发布：修复和门禁调整仍需 test-engineering 给验证矩阵、release-engineering 给发布证据、code-audit 最终收口。

## 场景执行卡

### 1. SAST 静态应用安全测试
- 适用：注入、XSS、SSRF、RCE、路径穿越、反序列化、权限绕过、硬编码凭证、危险依赖 API。
- 动作：识别语言/框架/入口，建立 source→validator→sink 数据流，启用框架感知规则，导出 SARIF/JSON，人工核可达性和已有防护。
- 证据：规则 ID、文件行号、source/sink、调用链、认证状态、修复 commit、同类入口搜索结果。
- 门禁：新增可达 Critical/High、认证绕过、RCE、SQL 注入、SSRF 内网可达、任意文件读写阻断。

### 2. DAST / API 安全验证
- 适用：授权环境的动态 Web/API 扫描、认证后扫描、OpenAPI/GraphQL、接口 fuzz、发布前安全冒烟。
- 动作：确认资产授权、时间窗口、速率、测试账号和角色；导入 API 规格；先 baseline/被动，再定向验证高风险接口。
- 证据：脱敏请求/响应摘要、角色矩阵、扫描配置、运行时间、发现摘要、复现条件、影响范围。
- 门禁：未授权访问、越权、认证绕过、敏感数据泄露、可利用注入在授权范围内阻断。

### 3. SCA 依赖漏洞、许可证与恶意包
- 适用：npm/pnpm/yarn、PyPI、Maven/Gradle、Go、Cargo、Composer、NuGet、RubyGems、系统包。
- 动作：读 manifest、lockfile、registry 配置和 install script；区分直接/传递、runtime/dev/build/test；核 CVE/GHSA、KEV、EPSS、修复版本、许可证。
- 证据：包名版本、依赖路径、scope、purl、license、affected range、fixed version、是否打入 artifact/image。
- 门禁：恶意包、依赖混淆、禁止许可证、生产可达 Critical/High 且 KEV/公开利用阻断。

### 4. Secret scanning 与密钥处置
- 适用：代码、历史提交、CI 日志、artifact、镜像层、IaC state、移动包、前端 bundle、LLM/调试日志。
- 动作：确认类型和有效性；立即撤销/轮换；清理历史、artifact、镜像、日志、cache；查访问审计；改用 OIDC 或短期凭证。
- 证据：Secret 类型、位置、指纹、掩码、撤销记录、暴露面、访问日志摘要、补救 PR。
- 门禁：任何有效生产 Secret、云密钥、签名密钥、数据库凭证、admin token、私钥阻断。

### 5. SBOM 生成、重扫与交付
- 适用：CycloneDX/SPDX、发布制品、容器镜像、客户合规交付、事故响应、漏洞批量重扫。
- 动作：在依赖解析后和镜像构建后生成 SBOM；包含 purl、hash、license、supplier、组件关系；绑定 commit、artifact/image digest 和生成工具版本。
- 证据：SBOM 文件或 attestation、digest、tool version、CI artifact、制品库元数据、重扫记录。
- 门禁：生产制品缺 SBOM、SBOM 无 digest 绑定、无法重扫或生成失败无审批例外时阻断。

### 6. Container image scanning 与镜像基线
- 适用：Dockerfile、基础镜像、OS 包、语言包、镜像层 Secrets、多架构、Kubernetes securityContext。
- 动作：基础镜像固定 digest；扫描 OS/语言漏洞、EOL、root、privileged、capabilities、seccomp、readOnlyRootFilesystem、.git、包管理缓存和凭证。
- 证据：image digest、base image digest、扫描报告、Dockerfile 行号、运行用户、签名状态、准入策略结果。
- 门禁：镜像含有效 Secrets、未授权 privileged/hostPath/hostNetwork、可修复 Critical/High 生产可达、EOL 基础镜像无治理计划阻断。

### 7. CI/CD 权限、runner 与 artifact 安全
- 适用：GitHub Actions、GitLab CI、Jenkins、Buildkite、self-hosted runner、cache、artifact、registry。
- 动作：permissions 最小化；fork PR 不注入 secret；pull_request_target 不执行不可信代码；关键 action 固定 SHA；artifact digest 校验；runner 隔离和清理。
- 证据：workflow 文件、permissions、environment protection、OIDC subject、runner 类型、cache key、artifact digest、审计日志。
- 门禁：生产 secret 暴露给不可信上下文、默认写权限、发布 job 未审批、未受信 artifact 进入 release 阻断。

### 8. OIDC workload identity 与最小权限
- 适用：CI 到云账号、registry、package publish、Kubernetes deploy、签名服务、短期凭证替代长期 key。
- 动作：限定 issuer、audience、subject、repo、ref、workflow、environment；发布权限和合并权限分离；token TTL 短；审计 role trust。
- 证据：OIDC trust policy、role policy、subject pattern、environment protection、审计日志、权限差异。
- 门禁：通配 subject、管理员权限、长期云密钥继续用于发布、测试环境可取生产凭证阻断或升级审批。

### 9. SLSA、Sigstore/cosign、签名与 provenance
- 适用：keyless signing、Fulcio/Rekor、in-toto、SLSA provenance、GitHub Artifact Attestations、包/镜像/二进制发布。
- 动作：签名 artifact、image、SBOM、provenance；验签必须校验证书 identity、issuer、repo、workflow/ref、digest、builder、materials，不只验证“有签名”。
- 证据：artifact digest、signature bundle、Rekor entry、certificate identity、buildType、materials、resolvedDependencies、attestation policy。
- 门禁：生产制品无签名、身份不匹配、provenance 缺失、materials 与 commit/lockfile 不一致阻断。

### 10. IaC policy OPA / Conftest / Checkov / tfsec
- 适用：Terraform/OpenTofu、Kubernetes YAML、Helm/Kustomize、CloudFormation、Dockerfile、Nginx、云策略。
- 动作：关键策略优先评估 plan JSON 或渲染后 YAML；检查公网管理口、公开存储、IAM 通配、未加密、日志缺失、特权容器、Terraform state 敏感输出。
- 证据：资源地址、文件行号、plan 摘要、策略 ID、环境、例外范围、owner 和到期日。
- 门禁：0.0.0.0/0 管理口、公开 bucket/数据库、生产未加密、管理员通配、特权容器默认阻断。

### 11. CVE triage 与例外治理
- 适用：扫描结果爆量、误报分级、修复 SLA、客户或审计问询、重大供应链事件响应。
- 动作：分类 True Positive、False Positive、Accepted Risk、Duplicate、Needs Evidence；按 KEV/EPSS、可达性、资产敏感度、生产打包、补偿控制排序。
- 证据：不可达证明、版本/配置核对、修复版本、owner、SLA、suppress 范围、审批、到期日、复验结果。
- 门禁：禁止全局关闭规则；高危 suppress 必须限定包/路径/资源/CVE，有 owner、补偿控制和过期时间。

### 12. 供应链事件与恶意包应急
- 适用：xz 后门、npm/PyPI typosquatting、maintainer 接管、postinstall 恶意行为、registry/cache 投毒、依赖混淆。
- 动作：冻结相关版本；查 lockfile、缓存、CI logs、artifact、SBOM、运行镜像；轮换可能暴露凭证；验证制品是否包含受影响包；补 registry allowlist。
- 证据：包版本、hash、来源 registry、安装时间、workflow run、artifact digest、受影响资产清单、清理与重建记录。
- 门禁：确认恶意包或受影响制品进入生产链路时阻断发布并启动轮换/重建。

## 高频坑 / 防遗漏

- SAST：同步查 source/sink、框架自动防护、认证前后、同类入口和 suppress 范围。
- DAST：同步查授权、速率、测试账号、角色矩阵、环境边界、token/cookie 脱敏。
- SCA：同步查 lockfile、registry、传递路径、scope、KEV/EPSS、许可证、install script、打包范围。
- Secrets：同步查代码历史、CI 日志、artifact、镜像层、IaC state、撤销、轮换、访问记录。
- SBOM：同步查格式、purl、hash、license、digest 绑定、存储位置、重扫流程。
- 镜像：同步查 base digest、EOL、OS 包、语言包、root、Secrets、.git、多架构、签名。
- CI/CD：同步查 permissions、OIDC、fork PR、pull_request_target、cache、artifact、runner、environment protection。
- 签名：同步查 identity、issuer、repo、workflow/ref、Rekor、provenance materials、attestation policy。
- IaC：同步查 plan JSON、渲染 YAML、公网、加密、IAM、日志、K8s securityContext、state 敏感输出。
- 例外：同步查审批、owner、到期日、补偿控制、复验方式，禁止永久全局 suppress。
- 修复：同步跑构建、测试、扫描、镜像启动、验签、门禁和原路径复验。

## 输出要求

DevSecOps 输出必须包含：
1. 范围：仓库、目录、镜像、artifact、IaC、workflow、commit、环境、owner、授权边界和未覆盖资产。
2. 版本/环境：语言、包管理器、lockfile、CI 平台、runner、registry、镜像 digest、扫描工具、签名/provenance 方案。
3. 流水线入口：触发事件、job、权限、secret 注入、构建命令、artifact/SBOM/sign/provenance 产生点。
4. 证据：规则 ID、文件行号、包版本、CVE/GHSA、license、SARIF/JSON、SBOM、signature、attestation、workflow run、digest。
5. 结论：按 Critical/High/Medium/Low 或 P0/P1/P2/P3 分组，标 True Positive/False Positive/Accepted Risk/Needs Evidence。
6. 门禁：通过/阻断，阻断原因、解除条件、baseline 或例外范围。
7. 修复：最小修复、影响面、验证命令、回滚/重建、轮换、复扫和残余风险。
8. 联动：Web/API 风险交 web-security；K8s 运行时交 cloud-native；IaC state/plan 交 iac-terraform；发布总控交 release-engineering；观测证据交 observability-sre；测试交 test-engineering；最终收口交 code-audit。

## 约束

- 只服务授权防御、交付安全、供应链治理和合规证据；拒绝恶意利用、绕过检测、批量攻击、凭证滥用、隐蔽持久化和破坏性操作。
- 禁止对未授权目标执行 DAST、爆破、漏洞利用、高流量扫描、云资源枚举或镜像/仓库批量拉取。
- 禁止编造扫描结果、CVE、许可证结论、签名、provenance、SBOM 或合规证明。
- 禁止为了过门禁删除扫描、跳过测试、降级规则、伪造报告、扩大 suppress 或关闭审计日志。
- 禁止输出完整 Secrets、token、admin key、私钥、cookie、连接串、个人敏感数据或第三方敏感数据。
- 禁止把工具无发现说成“无漏洞”；必须说明覆盖范围、版本、规则集和未验证缺口。
- 禁止依赖升级不查 lockfile、调用方、运行环境、构建链路、回滚路径和兼容测试。
- 不搬运 web-security 的渗透细节，不替 cloud-native 做运行时运维，不替 release-engineering 做发布步骤，不替 test-engineering 下测试充分结论。
- 代码或技能正文改动完成前按 code-audit 口径复核需求、影响面、证据、缺口。

## 高频 Bug 反例库

- 反例 1：CVE 标题直接判命中
  - 错法：看到 Critical 就要求升级，未核 affected versions、配置、启用模块和可达性。
  - 对法：核依赖路径、运行环境、利用条件、是否打入制品、修复版本和补偿控制。
  - 根因：漏洞公告是线索，不是资产命中证据。
- 反例 2：Secrets 只删除代码
  - 错法：删掉 token 字符串就宣布修复。
  - 对法：撤销/轮换，清理历史、镜像、artifact、日志和 cache，并查访问审计。
  - 根因：凭证泄露后副本和使用痕迹分布在整条交付链。
- 反例 3：DAST 扫未授权生产
  - 错法：直接对公网生产主动 fuzz 或高频扫描。
  - 对法：确认授权、窗口、速率、账号和环境，优先测试/预发或低影响样本。
  - 根因：动态验证可能影响可用性和第三方资产。
- 反例 4：fork PR 注入生产密钥
  - 错法：pull_request_target checkout 不可信代码并暴露生产 secret。
  - 对法：不可信上下文不注入 secret，PR job 与发布 job 分离，environment 审批后再取密钥。
  - 根因：CI 事件上下文和代码来源被混淆。
- 反例 5：cosign 只验“有签名”
  - 错法：验签命令通过就放行，未校验证书 identity、issuer、repo、ref 和 digest。
  - 对法：用策略校验身份、OIDC issuer、workflow/ref、artifact digest、Rekor 和 provenance materials。
  - 根因：签名存在不代表签名者和构建来源可信。
- 反例 6：SBOM 与制品不绑定
  - 错法：发布附一个 SBOM，但无法证明属于该 image digest 或 artifact。
  - 对法：SBOM/provenance 绑定 digest，作为 attestation 归档并可重扫。
  - 根因：没有主体绑定的清单无法支持审计和应急。
- 反例 7：SCA 忽略依赖混淆
  - 错法：只看 CVE，私有包 registry 优先级、scope 和 token 权限未查。
  - 对法：锁 registry、scope、lockfile、包来源和发布权限，CI 禁止默认公共源抢先解析私有包。
  - 根因：供应链攻击常利用解析规则而非已知 CVE。
- 反例 8：镜像扫描只看 OS CVE
  - 错法：忽略镜像层里的 .npmrc、pip.conf、.git、云凭证和语言包。
  - 对法：扫描 OS/语言包/Secrets/文件层，重建镜像并清理 registry 旧层。
  - 根因：镜像是可复制的制品，不只是操作系统包集合。
- 反例 9：IaC policy 只扫 HCL
  - 错法：模块变量渲染后暴露 0.0.0.0/0，但静态 HCL 没命中就放行。
  - 对法：关键策略评估 plan JSON 或渲染 YAML，并绑定资源地址和环境。
  - 根因：真实风险常由变量、默认值和 provider 计算后出现。
- 反例 10：全局永久 suppress
  - 错法：为了减少噪音关闭整类 SSRF/SCA/secret 规则。
  - 对法：限定到文件/行/CVE/包/资源，写 owner、理由、补偿控制、到期日和复验。
  - 根因：降噪变成失明会吞掉新增真实风险。
- 反例 11：GitHub Actions token 默认写权限
  - 错法：所有 job 继承 contents:write，第三方 action 用浮动 tag。
  - 对法：顶层 permissions read-only，发布 job 最小写权限，关键 action 钉 SHA，环境保护审批。
  - 根因：CI token 是供应链攻击后的放大器。
- 反例 12：Artifact attestations 不验 subject
  - 错法：看到 GitHub Artifact Attestations 存在就放行。
  - 对法：校验 subject digest、repo、workflow、ref、builder、environment 和发布 artifact 一致。
  - 根因：attestation 只有和目标制品精确匹配才有证明力。
- 反例 13：xz 事件只按包名搜索
  - 错法：只 grep xz，未查基础镜像、系统包、构建镜像、缓存和历史 artifact。
  - 对法：用 SBOM、镜像扫描和制品 digest 追踪所有构建/运行材料，必要时重建并轮换凭证。
  - 根因：供应链事件影响的是构建材料图，不只是源码依赖名。
- 反例 14：安全升级不跑回归
  - 错法：扫描绿了就合并，运行时 API 或 ABI breaking 导致生产故障。
  - 对法：最小升级，跑构建、单测、集成、镜像启动、关键路径和回滚验证。
  - 根因：安全修复仍是功能变更，必须验证兼容性。

## 提交前自检清单

- [ ] 行数 < 500，fenced code block 数量为 0，正文不包含反引号围栏。
- [ ] frontmatter name/description 存在，H1 精确为“DevSecOps实战排障版”。
- [ ] 快速总则体现资产 / 流水线 / 策略 / 证据。
- [ ] 覆盖 SAST、DAST、SCA、secret scanning、SBOM、container image scanning、IaC policy、CI/CD、OIDC、签名/provenance、CVE triage。
- [ ] 覆盖 SLSA、Sigstore/cosign、GitHub Actions token、Artifact Attestations、依赖混淆、npm/PyPI typosquatting、xz 供应链事件。
- [ ] 反例不少于 10 条，且每条可被“反例 数字”命中并含错法/对法/根因。
- [ ] 输出要求、约束、2024-2026 新坑速查、与相邻技能的边界齐全。
- [ ] 未输出完整凭证、token、admin key、cookie、私钥或连接串。

## 2024-2026 新坑速查

- xz 供应链事件：要按 SBOM/materials/digest 查构建镜像、基础镜像、系统包、缓存和历史 artifact；只查应用依赖会漏。
- GitHub Actions token：新项目也可能因 job 级 permissions、pull_request_target、workflow_run、environment 继承导致权限超预期。
- GitHub Artifact Attestations：接入成本降低，但必须验证 subject digest、repo、workflow、ref、builder 和环境保护。
- Sigstore keyless 普及：Fulcio/Rekor 提供身份线索，放行策略必须绑定 OIDC identity、issuer、repo、ref 和 digest。
- SLSA provenance：materials、builder、buildType 与 lockfile/commit 不一致暴露构建漂移，发布门禁需检查。
- npm/PyPI typosquatting：相似包名、maintainer 变更、异常 postinstall、短期高频发布和新建账号要进入恶意包 triage。
- Dependency confusion：私有 scope、registry 优先级、包名保留、lockfile、CI token 和 publish 权限必须一起核对。
- Container base image EOL：Debian/Alpine/Ubuntu EOL 会让 CVE 无法修复；基础镜像生命周期要纳入门禁。
- SBOM 合规交付：客户和监管更看重可重扫、可绑定制品、可解释例外，而不是只生成文件。
- AI/LLM 进入交付链：生成代码、自动修复 PR、日志/trace/prompt 可能泄密；仍需 SAST/SCA/secret scanning 和人工 triage。
- OIDC workload identity：短期凭证降低泄露风险，但 subject/audience/ref/environment 通配会变成横向移动入口。
- Cache poisoning：CI cache、package manager cache、Docker layer cache 必须绑定 lockfile、平台、分支信任级别和权限边界。
- Policy-as-code 漂移：CI 的 OPA/Conftest、K8s admission、云组织策略若口径不同，会出现 CI 绿生产拒绝或生产放行 CI 阻断。

## 与相邻技能的边界

- devsecops 负责：交付安全控制、SAST/DAST/SCA/secret scanning、SBOM、签名/provenance、CI/CD 权限、供应链、CVE triage、制品可信、门禁和例外治理。
- web-security 负责：Web/API/浏览器漏洞复现、认证授权、会话、CSRF/XSS/SSRF/注入、修复验证；devsecops 只把这些规则接入扫描和门禁。
- cloud-native 负责：Kubernetes 运行时事实、控制器、网络、存储、RBAC、准入和排障；devsecops 只管镜像、策略、准入证据和供应链控制。
- iac-terraform 负责：Terraform/OpenTofu state、backend、plan/apply、provider/module、drift 和回滚；devsecops 只管 IaC policy、OIDC、secret 和安全门禁。
- release-engineering 负责：发布窗口、唯一产物、灰度、冒烟、监控、回滚和审计；devsecops 提供发布前安全门禁、签名、SBOM、provenance 证据。
- observability-sre 负责：logs/metrics/traces/profiles、SLO、告警、incident 和观测成本；devsecops 只要求安全门禁和事件响应证据可追踪、可脱敏。
- backend-engineering 负责：服务实现、配置、依赖交互、健康检查和后端运行风险；devsecops 只审交付链路与供应链安全。
- test-engineering 负责：验证矩阵、回归、CI 证据和覆盖结论；devsecops 提供安全风险样本和门禁失败场景。
- code-audit 负责：最终需求对账、影响面追踪、安全/质量复盘和证据边界；devsecops 改动完成后必须按其口径收口。
