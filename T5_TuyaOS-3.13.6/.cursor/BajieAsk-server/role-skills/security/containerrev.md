---
name: container-artifact-reverse-engineering
description: 面向授权容器镜像、OCI layers、manifest/config/history、entrypoint/cmd、包清单、SBOM、OCI artifact/referrers、secrets 脱敏、rootfs、runtime evidence、capabilities/seccomp、Helm/manifests、provenance、离线镜像验证和 registry 授权边界的防御逆向分析。
---

# 容器镜像与运行时制品逆向

## 定位 / 适用范围

容器镜像与运行时制品逆向（container-artifact-reverse-engineering，兼容 slug: containerrev）负责授权容器镜像和云原生交付制品的防御逆向、证据复核、离线验证、registry 授权核查、运行时证据复验和供应链风险交接。

必须覆盖的对象包括：OCI image layers、image manifest、config、history、entrypoint、cmd、env、labels、包清单、SBOM、OCI artifact/referrers、secrets 证据、distroless/rootfs、init scripts、sidecar、Helm chart、Kubernetes manifests、securityContext、capabilities、seccomp、AppArmor、签名/provenance/attestation、离线 tar/oci-archive/docker-archive 证据。

适用场景：授权镜像安全审计、供应链事件复盘、离线镜像取证、registry 拉取授权复核、SBOM 对账、可疑 entrypoint 排查、distroless 镜像还原、Helm/manifests 风险解释、运行时启动链路复验、runtime evidence 对账、CI/CD 交付物 provenance 核验。

不适用场景：只读学习容器概念、普通 Dockerfile 开发、普通镜像构建部署、云 agent/endpoint agent 逆向、恶意样本分析、未授权 registry 访问、真实目标攻击、窃取 secrets、容器逃逸、供应链投毒、绕过扫描。

## 铁律

1. 未确认授权主体、样本来源、允许动作、禁止动作、联网边界、数据留存和停止条件，不开始分析。
2. 原始镜像和导出包只读保存；任何 unpack、mount、run、scan、diff 都在工作副本或隔离环境中进行。
3. 每个结论必须绑定 image digest、layer digest、config digest、文件路径、偏移/mtime、工具版本、命令摘要或证据编号。
4. secrets 只做存在性、位置、类型、泄露路径和轮换建议；不得提取、还原、验证、使用或传播明文凭据。
5. 不提供供应链投毒、恶意层植入、扫描绕过、真实 registry 攻击、逃逸利用、持久化或攻击集群的步骤。
6. 离线证据优先；需要访问 registry、Kubernetes 集群、CI/CD 或云平台时，必须先确认账号权限、只读范围、审计留痕、允许的 namespace/repository/tag/digest 和凭据处理方式。
7. registry 凭据、pull secret、镜像仓库 token 和 CI/CD 令牌只用于确认授权边界和只读拉取条件；不得打印、复用、横向尝试或验证额外权限。
8. 运行时复验只验证防御证据：实际 user、capabilities、seccomp/AppArmor、mount、network、pid/ipc、readOnlyRootFilesystem、runtimeClass 和 admission 结果；不得给出逃逸、提权、横向移动或规避检测步骤。

## 快速总则

1. 先识别制品形态：registry reference、image digest、docker save tar、OCI layout、Helm chart、Kubernetes manifest、SBOM、attestation 或混合包。
2. 先建证据台账：来源、获取方式、SHA256、大小、平台/架构、created、repoTags、digest、签名、扫描报告和工具版本。
3. 先静态后动态：优先解析 manifest/config/layers/rootfs；只有授权明确时才运行容器或访问真实 registry。
4. 先启动链路再风险点：entrypoint/cmd、shell wrapper、init script、supervisor、sidecar、env/config/secret mount、网络端口和 volume 逐层对齐。
5. 先包清单再漏洞结论：OS 包、语言包、静态二进制、vendored 文件和 SBOM 对账；不要把扫描器标签直接写成事实。
6. 先脱敏再交付：凭据、token、私钥、证书、内部域名、客户标识和路径中的敏感信息必须脱敏并保留证据编号。
7. 先 artifact 再策略结论：OCI referrers、signature、attestation、SBOM artifact、provenance 和 admission policy 要按 digest 绑定，不能只按 tag 或文件名绑定。
8. 结论分级写：已验证、推测、无法验证、需要授权补证分开；不要用“疑似”替代证据。
9. 先验收再定稿：没有原始制品、digest 台账、工具版本、证据编号、误报复核和无法验证项，不输出“通过”。

## 强制流程

1. 授权门禁：记录委托方、资产范围、样本来源、允许动作、禁止动作、是否允许联网、是否允许运行、是否允许拉取 registry、registry 授权主体、repository/digest 范围、停止条件。
2. 样本建档：记录 tar/layout/reference、SHA256、image digest、manifest digest、config digest、platform、created、history、repoTags、签名/attestation 状态。
3. 结构解析：枚举 manifest、config、layers、whiteout、文件系统变更、mtime、owner、mode、file capability、symlink、setuid/setgid、workdir、user、exposed ports、volumes、OCI annotations 和 artifact 关系。
4. 启动链路：还原 entrypoint/cmd/env/labels、shell wrapper、init scripts、supervisor、healthcheck、sidecar 注入、Kubernetes command/args/envFrom/volumeMounts/configMap/secret 引用。
5. 软件成分：提取 OS release、包管理数据库、语言依赖锁文件、二进制版本、静态链接痕迹、SBOM、licenses，并与扫描报告和镜像层文件互证。
6. secrets 证据：定位可疑凭据、私钥、证书、token、历史层残留、build args、env、配置文件和日志；只输出脱敏片段、哈希、路径、层 digest 和轮换建议。
7. distroless 处理：不要假设无 shell 就无风险；从 rootfs、ELF interpreter、CA bundle、passwd/group、nss、timezone、证书、应用二进制和启动参数还原运行条件。
8. Registry 授权复核：只在授权范围内解析 WWW-Authenticate、repository scope、pull/push 权限、镜像 digest、签名和访问日志线索；发现权限过宽只报告最小证据和收敛建议，不做越权枚举。
9. 供应链复核：核对 tag/digest 漂移、base image、构建时间、history 指令、provenance、签名、SLSA/in-toto attestation、SBOM 生成时间和 CI/CD 证据。
10. 运行时证据：仅在授权允许运行或读取集群对象时，记录实际容器 user、effective caps、seccomp/AppArmor profile、SELinux、mount、namespace、网络、env、pid 1、open ports、process tree 和 Kubernetes status/events；无法运行时列为补证。
11. 交叉验证：关键结论至少用两类证据互证，例如 layer 文件 + config history、SBOM + 包数据库、Helm manifest + image config、扫描报告 + rootfs 证据、runtime state + rendered manifest。
12. 误报复核：对扫描器、SBOM、history、secret scanning、capability 和 runtime 发现逐条标注证据强度、反证、业务上下文、是否可复验和误报/真阳性结论。
13. 交付收口：输出风险、影响面、触发条件、修复建议、补证需求、无法验证项、脱敏说明、附件索引和验收门禁。

## 场景执行卡

### 1. OCI layers / manifest / config / history

- 先记录 manifest digest、config digest、layer digest、mediaType、platform、created、author、history.created_by 和 empty_layer。
- 分析层时关注新增、删除、whiteout、权限变化、owner 变化、setuid/setgid、capability、symlink、异常 mtime、压缩包内嵌压缩包。
- history 只能作为线索，不等同 Dockerfile 真相；要与实际 layer diff、config env/labels、rootfs 文件互证。
- 报告写清 tag 与 digest 的关系；tag 可漂移，digest 才能复验。
- 对 multi-arch manifest list/index，要逐平台记录 digest、os/architecture/variant、层差异、SBOM 覆盖范围和策略适用范围。

### 2. Entrypoint / CMD / init scripts / sidecar

- 还原 Docker config 的 Entrypoint、Cmd、Env、WorkingDir、User、StopSignal、Healthcheck、ExposedPorts、Volumes。
- 追踪 shell wrapper、tini/dumb-init/supervisord/s6、cron、startup.d、docker-entrypoint.d、init container、sidecar 注入逻辑。
- Kubernetes/Helm 覆盖 command/args/env/envFrom/volumeMounts 时，以最终 manifest 渲染结果为运行证据，不只看镜像 config。
- 判断风险时写触发条件：默认启动即触发、特定 env 触发、mounted secret 触发、sidecar 配置触发，或无法验证。
- 动态下载、二阶段解包、脚本拼接、远程配置拉取只能描述防御风险、证据位置、阻断点和补证方式；不得写成攻击复现步骤。

### 3. Package list / SBOM / vulnerability evidence

- 包清单优先从 dpkg/rpm/apk、language lock、site-packages、node_modules、jar/war、go version info、ELF strings 和 SBOM 多源对账。
- SBOM 要记录格式、生成工具、生成时间、覆盖对象、是否含 layer/package/file/license 级证据。
- 漏洞结论必须包含组件名、版本来源、证据路径、固定版本或缓解条件；扫描器 ID 只是索引，不是最终证据。
- 对 distroless、scratch、静态二进制和多阶段构建残留，要说明包数据库缺失带来的盲区。
- 对 SBOM artifact 要绑定 subject digest、mediaType、predicateType、generator、created、签名状态和与 rootfs/package DB 的差异；无法绑定 digest 的 SBOM 只能作为外部线索。

### 4. Secrets evidence / history residue

- 证据对象包括 env、labels、build args、history.created_by、配置文件、日志、证书、私钥、npm/pip/docker/kube 凭据、历史层已删除文件。
- 只输出类型、脱敏值、路径、layer digest、mtime、来源链路和轮换建议；不得验证 token、连接服务、下载私有资源或扩大读取范围。
- 已删除文件仍可能在底层 layer 中存在；报告必须区分“当前 rootfs 可见”和“历史层残留”。
- 发现真实密钥时立即降噪、停止扩散、保留最小证据，并建议按组织流程吊销和轮换。
- secret scanning 结果要去重和分级：测试样例、占位符、公开证书、真实候选、历史层残留和当前 rootfs 可见分别标注；不得把扫描器置信度当作可用凭据。

### 5. Distroless / scratch / minimal runtime

- 检查应用二进制、动态链接器、共享库、CA bundle、passwd/group、证书路径、timezone、locale、DNS/NSS 依赖。
- 缺少 shell、包管理器或调试工具不代表不可分析；通过 rootfs、ELF、config、SBOM、manifest 和运行参数重建。
- 需要运行验证时使用隔离网络、只读文件系统、无真实 secret、最小 capability、资源限制和可销毁环境。
- 报告写清哪些结论来自静态 rootfs，哪些需要运行时证据补充。
- rootfs 审查要覆盖 device node、socket、fifo、setuid/setgid、file capabilities、world-writable、CA trust、passwd/group、cron/systemd 残留、包数据库缺失和应用目录写权限。

### 6. Helm / Kubernetes manifests / sidecar provenance

- 对 Helm chart 记录 chart version、appVersion、values、rendered manifests、image repository/tag/digest、hook、CRD、annotation 和 provenance。
- 关注 securityContext、serviceAccount、RBAC、hostPath、hostNetwork、privileged、capabilities、initContainers、sidecars、secret/configMap 引用。
- 不能把 chart 默认值当生产状态；必须说明使用的 values 来源和渲染命令摘要。
- 对 sidecar 注入或 admission 结果，区分静态模板、渲染 manifest、集群实际对象和运行时状态。
- provenance/attestation 只做真实性、完整性、构建来源和策略匹配核验；不得提供伪造、替换、绕过 admission 或隐藏变更的做法。
- securityContext 结论必须写明 runAsUser/runAsGroup/runAsNonRoot、allowPrivilegeEscalation、readOnlyRootFilesystem、capabilities add/drop、seccompProfile、appArmorProfile、SELinux、host namespaces 和 runtimeClass 的实际来源。

### 7. Offline image evidence / air-gapped review

- 离线包必须记录文件 SHA256、导出工具、导出时间、目录结构、manifest.json/index.json、blobs、repositories 和缺失项。
- 不依赖公网 registry 的 tag 查询作为事实；能从离线包证明的只写已验证，不能证明的列为补证。
- 对比多个离线版本时，以 digest、layer diff、config diff、SBOM diff 和 manifest diff 建立时间线。
- 若用户只给截图、文件名或扫描摘要，先要求原始离线包或最小可复验证据，不补写确定结论。

### 8. Registry authorization / access boundary

- 访问 registry 前确认 registry 域名、账号主体、repository 范围、允许动作、允许 tag/digest、是否允许联网拉取和凭据留存规则。
- 只做只读 manifest/config/blob 拉取、digest 复核、签名/attestation 查询和访问边界说明；不得枚举无关 repository、测试 push/delete、撞 scope 或复用凭据。
- 报告 registry 问题时写清授权主体、期望权限、实际可见证据、最小复现条件和收敛建议；不要贴出 token、Authorization header、cookie 或 pull secret 明文。
- 离线镜像已足够验证时，不把 registry 在线查询作为必须步骤；在线结果只能补充 tag 当前状态，不能覆盖离线样本事实。

### 9. OCI artifact / referrers / signature / attestation

- 对 OCI artifact 记录 artifactType、mediaType、subject digest、annotations、created、issuer、identity、certificate chain、transparency log 和验证工具版本。
- referrers 只查询授权 subject digest 相关对象；不得枚举无关 repository 或利用 referrers 发现未授权资产。
- signature、provenance、SBOM、vex、policy result 要分开写：签名证明发布者或构建身份，SBOM 描述成分，provenance 描述构建过程，VEX 描述漏洞适用性，不能互相替代。
- 发现签名缺失、过期、不匹配、identity 异常、builder 不可信、subject digest 不一致或 transparency log 缺口时，输出阻断证据和治理建议，不提供绕过策略。

### 10. Runtime evidence / capabilities / seccomp

- 运行时证据来源包括容器 inspect、Kubernetes Pod spec/status/events、admission mutation 结果、runtimeClass、process tree、mountinfo、effective capabilities、seccomp/AppArmor/SELinux 标记和网络监听。
- 静态镜像 config 不能代表生产运行状态；最终结论必须区分 image default、rendered manifest、admission 后对象、node runtime 观察和无法验证项。
- capabilities 审查记录 add/drop、effective/permitted/bounding、file capability 与 privileged/allowPrivilegeEscalation 的关系；只给最小权限建议，不给提权利用路径。
- seccomp/AppArmor/SELinux 审查记录 profile 名称、来源、是否 RuntimeDefault、是否 Unconfined、策略缺口和兼容性风险；不得指导如何绕过 profile。
- 若需运行容器复验，使用隔离网络、只读 rootfs、无真实 secret、最小权限、资源限制、临时环境和审计日志；运行后销毁环境并记录清理证据。

### 11. Supply-chain risk triage

- 风险分类至少覆盖完整性、来源可信、可复现性、成分透明、凭据暴露、运行时权限、registry 授权、部署覆盖、扫描盲区和证据缺失。
- 每个风险写清证据、影响对象、触发条件、可被策略阻断的位置、修复 owner、短期缓解、长期治理和需要转交的相邻技能。
- 不把“镜像能运行”当作供应链可信，也不把“扫描无漏洞”当作安全结论；必须结合 digest、签名、provenance、SBOM、rootfs 和运行时边界。

### 12. False-positive review / real acceptance gate

- 每条发现必须判定：已验证、真阳性但影响受限、误报、无法验证或需补证；判定依据要写证据编号和反证来源。
- digest/SBOM 类发现要核对 subject digest、manifest digest、config digest、layer digest、包数据库、rootfs 路径、扫描器匹配规则和生成时间。
- layer/history 类发现要区分可见 rootfs、历史层残留、whiteout 删除、empty layer、构建元数据和压缩包嵌套证据。
- entrypoint/cmd 类发现要核对 image config、Helm/Kubernetes 覆盖、admission 变更和实际 pid 1；无法运行时不能写成已触发。
- secret scanning 类发现要复核测试样例、占位符、公开材料、低熵字符串、脱敏片段、历史层残留和当前可见性；禁止验证凭据有效性。
- capabilities/seccomp/AppArmor 类发现要核对 securityContext、admission 后对象、runtime effective 值、file capability 和 privileged 关系，不能只看模板字段。
- OCI artifact/referrers 类发现要确认 subject digest 绑定、artifactType、mediaType、签名身份、证书链、透明日志和授权查询范围。
- runtime evidence 类发现要记录观察来源、时间、namespace/node、runtimeClass、mount、namespace、network 和清理证据；无运行授权则列补证。
- 供应链风险结论必须写策略阻断点：固定 digest、签名校验、SBOM 准入、secret 轮换、最小权限、RuntimeDefault、只读 rootfs、registry scope 收敛或监控告警。

## 验证门禁

- 授权、样本来源、允许动作、联网/运行边界、停止条件齐全。
- 原始样本 SHA256、image digest、manifest/config/layer digest 和工具版本已记录。
- 关键发现至少两类证据互证，或明确标为推测/无法验证。
- entrypoint/cmd、package/SBOM、secrets 证据、Helm/manifests/provenance 的结论都能追到路径或 digest。
- OCI artifact/referrers、signature、attestation、SBOM、VEX 和 policy result 都已绑定 subject digest，或明确为外部线索。
- capabilities、seccomp/AppArmor/SELinux、securityContext、runtimeClass、mount、namespace、network 和 readOnlyRootFilesystem 已说明来源：镜像默认、渲染 manifest、admission 后对象、运行时观察或无法验证。
- secret scanning、vulnerability scanning、SBOM mismatch、history residue 和 runtime permission 发现已做误报复核，且真阳性/误报/无法验证标签清楚。
- registry 授权、repository scope、tag/digest 查询和在线拉取都在明确只读范围内，且未输出任何真实凭据。
- 所有 secrets、内部标识和客户数据已脱敏；未尝试验证、使用或扩大访问。
- 输出不包含供应链投毒、扫描绕过、真实 registry 攻击、逃逸、持久化或攻击集群步骤。
- 报告可以被第三方按 digest、路径、工具版本和证据编号复验；不能复验的结论已列入补证清单。

## 输出要求

1. 范围：授权主体、资产、样本来源、允许动作、禁止动作、联网/运行边界和停止条件。
2. 样本：文件 SHA256、image digest、manifest/config/layer digest、platform、created、tag/digest 关系、工具版本。
3. 证据索引：编号、路径、layer digest、config/history 字段、manifest 字段、OCI artifact/referrer、SBOM 条目、Helm/manifests 位置、runtime evidence、截图或日志编号。
4. 发现：按已验证、推测、无法验证分组，写影响面、触发条件、置信度、修复建议、补证动作和可阻断策略位置。
5. 敏感处理：脱敏规则、secrets 类型、暴露位置、历史层残留、轮换建议、留存/清理策略和未扩散声明。
6. 运行边界：entrypoint/cmd、user、capabilities、seccomp/AppArmor/SELinux、mount、namespace、network、readOnlyRootFilesystem、runtimeClass 和 admission 变化。
7. 验收：列出复验命令摘要、工具版本、digest 绑定、脱敏状态、无法验证项、转交 owner 和报告通过/未通过门禁。
8. 交接：需要转 cloudrev、malrev、dso、tst、code-audit 或发布团队处理的事项和最小输入。

## 报告验收门禁

- 必须有授权边界、样本台账、digest 台账、证据索引、风险分级、补证清单、脱敏说明、工具版本和复验路径。
- 至少覆盖用户明确要求的对象；如果缺少镜像包、SBOM、Helm 渲染结果、registry 授权或运行时权限，必须写入无法验证而不是补结论。
- 关键高风险项必须有两类证据或明确单证据限制；仅有扫描报告、截图、tag、文件名或口头描述不能通过验收。
- 每条扫描器或自动化工具发现必须有误报复核状态；无法复核时不能作为阻断事实，只能作为待补证线索。
- 报告不得包含明文密钥、真实 token、可复用凭据、未脱敏客户数据、容器逃逸步骤、绕过扫描步骤或供应链投毒路径。
- 交付前复查每条建议是否防御导向：加固、最小权限、轮换、固定 digest、补签名、补 SBOM、准入阻断、监控告警、补证或转交。

## 安全边界

- 支持授权防御分析、供应链审计、事件响应、兼容排障、离线取证、CTF/教育和合法互操作。
- 拒绝窃取、提取、验证或使用 secrets、token、cookie、私钥、证书、registry 凭据、云凭据或用户数据。
- 拒绝供应链投毒、恶意 layer 注入、tag 劫持、镜像篡改、绕过扫描、规避准入、伪造 provenance、污染 SBOM/attestation 或攻击真实 registry。
- 拒绝指导如何隐藏恶意文件、清理审计痕迹、篡改 layer/history、制造误导性 package list、绕过镜像扫描器或准入策略。
- 拒绝容器逃逸、主机攻击、横向移动、持久化、C2、真实集群攻击和破坏性 payload。
- 对保护机制、访问控制、扫描器、签名校验和 admission policy，只做风险解释、阻塞证据和合法补证路径。
- 对 capability、seccomp、namespace、mount、cgroup、runtime 和 kernel attack surface，只允许给最小权限、隔离、检测和补证建议；不得描述利用链、逃逸条件组合、payload 或规避路径。

## 高频 Bug 反例库

- 反例 1：只看 tag 不看 digest。错法：报告写 nginx:latest。对法：记录 image digest、manifest digest 和 tag 获取时间。根因：tag 可漂移。
- 反例 2：把 history 当 Dockerfile。错法：按 created_by 复原全部构建逻辑。对法：用 layer diff、config 和 rootfs 交叉验证。根因：history 可被压缩、改写或缺失。
- 反例 3：扫描器结果孤证。错法：直接复制 CVE 列表。对法：核对包数据库、文件路径、版本来源和修复版本。根因：扫描器有误报和盲区。
- 反例 4：忽略历史层 secrets。错法：当前 rootfs 不见就判定无泄露。对法：检查底层 layer、whiteout、history、build args。根因：删除文件仍可能留在 layer。
- 反例 5：distroless 误判安全。错法：没有 shell 就说风险低。对法：分析二进制、库、证书、启动参数和运行依赖。根因：攻击面不等于 shell 数量。
- 反例 6：Helm 默认值当生产配置。错法：只读 values.yaml。对法：记录实际 values 和 rendered manifests。根因：部署时覆盖才是运行证据。
- 反例 7：贴出明文 key。错法：把 token 放进报告。对法：脱敏、编号、说明位置和轮换建议。根因：防御分析不能制造新泄露。
- 反例 8：离线包证据不足还下结论。错法：只凭截图判断镜像安全。对法：要求 tar/layout/SBOM 或标为无法验证。根因：缺少可复验样本。
- 反例 9：把普通 Docker 开发当逆向。错法：用户要改 Dockerfile 也触发本技能。对法：转后端、部署或 Docker 开发流程。根因：containerrev 只处理镜像/运行时制品证据分析。
- 反例 10：云 agent 样本误路由。错法：endpoint agent 二进制和遥测协议都放 containerrev。对法：云 agent/sidecar 客户端逻辑转 cloudrev，容器镜像外壳证据留本技能。根因：对象边界不同。
- 反例 11：拿到 registry token 后扩大枚举。错法：尝试列出所有 repository 或测试 push。对法：只验证授权范围内的 digest/tag，只输出 scope 风险和收敛建议。根因：防御审计不能变成越权探测。
- 反例 12：教用户绕过扫描。错法：说明如何拆层、改 history 或藏依赖避开扫描器。对法：只解释扫描盲区、阻断证据和修复路线。根因：技能目标是发现和修复，不是规避控制。
- 反例 13：忽略 OCI artifact 绑定。错法：拿任意 SBOM 或签名文件证明镜像安全。对法：核对 subject digest、mediaType、签名身份和生成时间。根因：artifact 不绑定 digest 就不能复验。
- 反例 14：把 Kubernetes securityContext 当实际运行。错法：只看模板里的 runAsNonRoot。对法：对比 rendered manifest、admission 后对象和 runtime evidence。根因：准入和默认值会改写运行状态。
- 反例 15：capabilities 只看 add/drop。错法：看到 drop ALL 就判定最小权限。对法：核对 privileged、allowPrivilegeEscalation、effective caps、file capabilities 和 runtimeClass。根因：权限来源不止一个字段。
- 反例 16：seccomp/AppArmor 空白不处理。错法：没写 profile 就跳过。对法：确认 RuntimeDefault、Unconfined、节点默认和 admission 策略。根因：默认策略因运行时和集群而异。
- 反例 17：运行容器时挂真实 secret。错法：为复现启动链路挂生产 secret。对法：隔离网络、假数据、只读 rootfs、最小权限并记录清理。根因：审计复验不能制造新暴露。
- 反例 18：报告只有风险没有验收。错法：列十条问题但无 digest、路径、工具版本和补证项。对法：每条发现绑定证据编号和通过/未通过门禁。根因：不可复验的报告无法落地。
- 反例 19：误报不复核。错法：把 secret scanner、CVE scanner 或 SBOM mismatch 全量当真阳性。对法：逐条核对路径、版本来源、熵值、上下文、digest 和反证，标注真阳性/误报/无法验证。根因：自动化工具只能提供线索。
- 反例 20：运行时证据和静态模板混写。错法：把 image config、Helm template、admission 后对象和容器实际状态混成一个结论。对法：按来源分层记录，并说明最终判断采用哪一层证据。根因：容器运行边界会被部署链路改写。

## 自检清单

- [ ] frontmatter name 使用规范 canonical `container-artifact-reverse-engineering`，兼容 slug 仍为 `containerrev`。
- [ ] 行数小于 500，正文无 fenced code block。
- [ ] 必需章节齐全：定位、铁律、快速总则、强制流程、场景执行卡、验证门禁、输出要求、安全边界、反例库、自检、相邻技能边界。
- [ ] 明确覆盖 OCI layers、manifest/config/history、entrypoint/cmd、package list、SBOM、secrets 证据、distroless、init scripts、sidecar、Helm/manifests/provenance、离线镜像证据。
- [ ] 明确覆盖 OCI artifact/referrers、subject digest、signature、attestation、VEX/policy result 和 artifact 与镜像 digest 的绑定关系。
- [ ] 明确覆盖 rootfs、file capabilities、setuid/setgid、capabilities add/drop/effective、seccomp、AppArmor、SELinux、runtimeClass、mount、namespace、network 和运行时证据。
- [ ] 明确覆盖 registry 授权、repository scope、离线镜像验证和在线 digest/tag 只读补证边界。
- [ ] 明确覆盖供应链风险分级、报告验收门禁、证据索引、脱敏说明、无法验证项和转交 owner。
- [ ] 明确覆盖误报复核、真实验收门禁、扫描器线索分级和运行时证据分层。
- [ ] 明确拒绝窃取 secrets、供应链投毒、绕过扫描、真实 registry 攻击、逃逸、持久化和攻击集群。
- [ ] manifest 触发词需要“容器镜像/OCI/Helm/SBOM/provenance 对象 + 分析/逆向/取证/审计动作”，不能靠 Docker、Kubernetes、image、manifest 单词误触发。

## 相邻技能边界

- 逆向工程总控/reverse-engineering（slug: rev）：逆向任务总控、授权门禁、样本接收和跨子技能路由；具体容器镜像证据分析交给容器镜像与运行时制品逆向。
- 云客户端、Agent 与边缘组件逆向/cloud-client-reverse-engineering（slug: cloudrev）：云客户端、endpoint agent、sidecar 客户端逻辑、遥测、更新通道和 API 签名路径；容器镜像与运行时制品逆向只处理其镜像/manifest/运行时制品证据。
- 恶意样本防御逆向/malrev（slug: malrev）：恶意样本行为、IOC、YARA/Sigma/capa、沙箱和 ATT&CK 映射；容器镜像与运行时制品逆向只处理镜像供应链和容器制品证据，发现恶意行为要转恶意样本防御逆向。
- DevSecOps/devsecops（slug: dso）：供应链治理、CI/CD 流程、签名策略、准入和发布制度；容器镜像与运行时制品逆向提供镜像/provenance/SBOM 证据输入。
- 测试验证/test-engineering（slug: tst）：测试矩阵、复验用例、回归验证和隔离运行验证；容器镜像与运行时制品逆向给出需要复验的最小场景。
- 代码审计/code-audit（slug: aud）：源码级修复和代码 review；容器镜像与运行时制品逆向只从镜像和交付制品反推证据，不替代源码审计。