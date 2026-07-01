---
name: cloud-native
description: Cloud Native实战排障版 - 聚焦 Kubernetes 1.27-1.32、containerd/CRI、CNI/CoreDNS/Ingress/Gateway API、HPA/VPA/KEDA、PodSecurity/NetworkPolicy/RBAC、Helm/Kustomize/GitOps、多集群/服务网格、节点压力/驱逐/探针/滚动发布、云厂商 LB/CSI 差异和 kubectl describe/events/logs/metrics/audit 证据链。处理 K8s 平台配置、运行时排障、云原生发布风险、托管集群差异时使用。
alwaysApply: false
---

# Cloud Native实战排障版

定位：只处理云原生平台面与运行时事实，目标是把 Kubernetes / 容器运行时 / 网络 / 存储 / 入口 / 弹性 / 安全策略 / GitOps / 网格问题收敛到可验证证据、可执行修复、可回滚边界。未读目标集群事实、声明式来源、Events/conditions/diff/logs/metrics/audit，不得下已完成结论。

## 快速总则

1. 先定版本：记录 Kubernetes 1.27-1.32 具体小版本、托管发行版、containerd/CRI、CNI、CoreDNS、CSI、Ingress Controller、Gateway API、Helm/Kustomize/GitOps、Service Mesh 版本；版本未知写需验证。
2. 先定入口：把用户症状映射到 DNS/LB、Ingress/Gateway、Service、EndpointSlice、Pod、Node、PVC、HPA/KEDA、Mesh、GitOps/Helm/Kustomize 源，不直接改 live 对象冒充完成。
3. 先取证据：至少读取 kubectl describe、Events、controller conditions、相关 Pod logs、metrics、rollout history、diff；权限/准入问题补 audit log 或 admission webhook 结果。
4. 先看控制器：同一 YAML 在 EKS/GKE/AKS/ACK/TKE/自建、NGINX/ALB/GCLB/Traefik/Envoy Gateway、Calico/Cilium/VPC CNI 上语义不同，不能跨云复制注解。
5. 先查声明式来源：Helm values、Kustomize overlay、Argo CD/Flux Application、Operator CR、Terraform 输出入口必须定位；hotfix 必须回写源或记录 owner、过期时间、回滚方案。
6. 生产最小门槛：固定镜像 tag/digest；有 requests、readiness、滚动策略、回滚路径；独立 ServiceAccount；RBAC 最小化；Secret 不明文；PodSecurity/NetworkPolicy 不靠默认放开。
7. 故障证据分层：用户入口看 LB/网关，接流看 readiness/EndpointSlice，重启看 kubelet/containerd/Events，扩缩容看 metrics/HPA/KEDA，权限看 RBAC/audit，存储看 PVC/CSI/Node 拓扑。
8. 结论分级：已验证、部分验证、无法验证；无法访问集群、日志、监控、审计或声明式源时必须列缺口，不补脑。

## 场景执行卡

### 1. Kubernetes 版本与 API 迁移
- 适用：1.27-1.32 升级、弃用 API、旧 chart、托管集群版本差异。
- 动作：确认 server/client 版本、API resources、CRD conversion webhook、admission policy、PSA label、节点镜像/cgroup v2、containerd 版本。
- 证据：api-resources、deprecation scan、CRD served/storage versions、upgrade notes、Events、webhook 失败日志。
- 失败模式：只看 kubectl apply 成功，忽略控制器不识别字段、conversion webhook 超时、PSA 拒绝 privileged workload。

### 2. Workload、探针、滚动发布
- 适用：Deployment/StatefulSet/DaemonSet/Job/CronJob 异常、CrashLoop、卡发布、冷启动。
- 动作：检查 startup/readiness/liveness 分工、preStop、terminationGracePeriodSeconds、maxSurge/maxUnavailable、PDB、topologySpread、PriorityClass、Job backoffLimit、StatefulSet ordinal/PVC。
- 证据：rollout status/history、describe pod、Events、container lastState、probe 日志、EndpointSlice 接流变化、SLO 指标。
- 失败模式：liveness 依赖 DB、readiness 缺失导致未预热接流、PDB 与 maxUnavailable 互锁、preStop 短于 LB drain。

### 3. containerd / CRI / 镜像拉取
- 适用：ImagePullBackOff、RunContainerError、Exec format error、沙箱创建失败、私有仓库。
- 动作：确认 image digest、架构 amd64/arm64、imagePullSecret、registry mirror、containerd snapshotter、RuntimeClass、seccomp/AppArmor、节点磁盘与 inode。
- 证据：Pod Events、kubelet 日志、containerd 日志、镜像 digest、节点架构、registry 返回码。
- 失败模式：latest 漂移、多架构 manifest 缺失、节点镜像切 containerd 后 Docker socket 依赖失效。

### 4. CNI、CoreDNS、NetworkPolicy
- 适用：Pod 间不通、DNS 慢、egress 失败、跨 namespace 访问、双栈问题。
- 动作：确认 CNI 类型和策略支持，检查 NetworkPolicy 默认 deny、DNS egress、kube-dns/CoreDNS、EndpointSlice、Service selector、SNAT/ENI/IPAM、MTU、IPv6/dual-stack。
- 证据：NetworkPolicy 清单、CoreDNS logs/metrics、Pod 内解析结果、CNI agent logs、conntrack/MTU 线索、拒绝链路与允许链路对照。
- 失败模式：只放应用端口忘 DNS、VPC CNI IP 耗尽、Cilium/Calico 策略语义差异、CoreDNS 上游超时。

### 5. Ingress、Gateway API、云 LB
- 适用：404/502/503、TLS、路径重写、WebSocket/SSE、跨 namespace route、健康检查。
- 动作：检查 DNS、LB、IngressClass/GatewayClass、Gateway Listener、HTTPRoute/GRPCRoute、ReferenceGrant、TLS Secret、Service port/targetPort、health check、proxy timeout/body size。
- 证据：Gateway/Route conditions、Ingress controller logs、LB target health、证书链、EndpointSlice、请求 ID、后端日志。
- 失败模式：HTTPRoute Accepted=False 被忽略、targetPort 写错、云 LB 健康检查路径和 readiness 不一致、跨云注解失效。

### 6. Helm、Kustomize、CRD、GitOps
- 适用：环境漂移、Argo CD/Flux 不一致、hook/wave 乱序、CRD 升级。
- 动作：渲染 helm template/kustomize build，核对 values/overlay、schema、CRD 与 CR 时序、sync wave/hook、prune/self-heal、ignoreDifferences、shared resource owner。
- 证据：渲染结果、live diff、Argo/Flux health/sync、CRD conversion 日志、rollback revision、commit SHA。
- 失败模式：手工 kubectl edit 被 GitOps 覆盖，prune 删除共享 PVC/Secret/CRD，生产 overlay 漏配。

### 7. HPA、VPA、KEDA、容量
- 适用：不扩容、扩容抖动、Pending、成本突增、队列积压。
- 动作：确认 metrics-server/custom metrics/external metrics、HPA behavior、VPA mode、KEDA ScaledObject、min/maxReplicas、ResourceQuota、LimitRange、PDB、cluster autoscaler/Karpenter、节点 IP/CPU/内存/磁盘余量。
- 证据：HPA/KEDA conditions、metrics 查询、Quota 命中、Pod Pending Events、节点池扩容记录、业务队列指标。
- 失败模式：用 CPU 扩队列消费者、HPA 被 Quota/PDB/节点容量卡住、VPA 与 HPA 同改 CPU requests 导致震荡。

### 8. PodSecurity、RBAC、Secret、准入
- 适用：Forbidden、准入拒绝、Secret 轮换、镜像拉取、权限过大。
- 动作：检查 namespace PSA label、securityContext、runAsNonRoot、capabilities、hostPath/hostNetwork、ServiceAccount、Role/ClusterRole verbs/resources、automount token、External Secrets/Secrets Store CSI、admission webhook。
- 证据：Forbidden 错误、audit log、SubjectAccessReview、admission webhook response、Secret 引用与轮换时间、PodSecurity warnings。
- 失败模式：为读一个 Secret 授予 list/watch 全 namespace，旧 chart privileged 被 PSA 拒绝，Secret 更新后应用不热加载。

### 9. 存储、CSI、StatefulSet
- 适用：PVC Pending、挂载失败、跨 AZ、扩容、快照恢复、有状态升级。
- 动作：确认 StorageClass、provisioner、volumeBindingMode、reclaimPolicy、accessModes、fsGroup、拓扑/AZ、snapshot/backup、StatefulSet partition、数据格式兼容。
- 证据：PVC/PV describe、CSI controller/node logs、VolumeAttachment、节点拓扑、快照/恢复记录、应用写入验证。
- 失败模式：WaitForFirstConsumer 与节点选择冲突，单 AZ PV 调度到其他 AZ，回滚应用但数据 schema 已升级。

### 10. 多集群、服务网格、东西向流量
- 适用：Istio/Linkerd/Consul/Kuma、多集群服务发现、mTLS、流量拆分、熔断。
- 动作：确认注入方式、sidecar/ambient 模式、mTLS、AuthorizationPolicy、DestinationRule/VirtualService、retry/timeout/circuit breaker、east-west gateway、证书信任域。
- 证据：proxy config、mesh telemetry、sidecar logs、mTLS 状态、trace、跨集群 endpoint、策略命中结果。
- 失败模式：网格 retry 叠加应用 retry、ambient/sidecarless 按 sidecar 经验排障、跨集群证书信任域不一致。

### 11. 节点压力、驱逐、调度
- 适用：OOMKilled、Evicted、NodeNotReady、磁盘压力、CPU throttling、调度失败。
- 动作：检查 node conditions、taints/tolerations、requests/limits、ephemeral-storage、image GC、PID pressure、cgroup v2、topologySpread、affinity、PriorityClass、preemption。
- 证据：Node describe、kubelet Events、metrics、Pod QoS、eviction threshold、container lastState、调度器事件。
- 失败模式：只加 replicas 不加节点资源，忽略 ephemeral-storage requests，BestEffort Pod 在压力下优先被驱逐。

### 12. 可观测与审计证据
- 适用：线上事故、变更验证、根因定位、权限与准入追踪。
- 动作：关联 kubectl describe/events/logs、metrics、traces、Ingress/Gateway logs、mesh telemetry、HPA/KEDA metrics、audit log、release markers、GitOps commit。
- 证据：按时间线列症状、变更、控制器动作、用户影响、恢复动作；保留对象名、namespace、UID、版本。
- 失败模式：只看应用日志忽略 Events，Events 已过期未及时导出，指标无 namespace/pod/version 标签无法关联发布。

## 高频坑 / 防遗漏

- 改 workload：同步查 Service selector、EndpointSlice、readiness、PDB、HPA/KEDA、PDB、SA、PodSecurity、Events、rollout history。
- 改入口：同步查 DNS、云 LB、Ingress/GatewayClass、TLS、Route conditions、health check、Service targetPort、EndpointSlice、controller logs。
- 改网络：同步查 CNI、CoreDNS、NetworkPolicy 默认态、DNS egress、外部 API、监控采集、MTU、IPAM、双栈。
- 改扩缩容：同步查 metrics 来源、HPA behavior、KEDA trigger、VPA mode、Quota/LimitRange、PDB、节点池、冷启动。
- 改安全：同步查 PSA、securityContext、RBAC verbs/resources、audit、admission、Secret 来源/轮换、imagePullSecret。
- 改存储：同步查 StorageClass、CSI、AZ 拓扑、VolumeAttachment、reclaimPolicy、扩容、快照恢复、StatefulSet 数据兼容。
- 改 GitOps/Helm：同步查渲染、diff、sync wave/hook、CRD 顺序、prune、ignoreDifferences、rollback revision。
- 改 mesh：同步查注入、mTLS、AuthorizationPolicy、retry/timeout、sidecar/ambient、telemetry、trace。
- 改节点：同步查 node pressure、taints、requests、ephemeral-storage、image GC、cgroup v2、RuntimeClass。
- 改多云：同步查 IAM/Workload Identity、LB 注解、CNI/IPAM、CSI/AZ、私有镜像、托管控制面限制。

## 输出要求

1. 场景：明确属于版本/API、workload、containerd/CRI、网络/DNS、Ingress/Gateway、GitOps、弹性、RBAC/PodSecurity、存储、网格、节点压力、观测审计、多云哪类。
2. 环境：Kubernetes 小版本、云厂商/发行版、namespace、CNI/CSI/Ingress/Gateway/Mesh、container runtime、声明式来源；未读写需验证。
3. 影响面：列 DNS/LB、Gateway/Ingress、Service/EndpointSlice、Pod/Node、PVC、HPA/KEDA/PDB、RBAC/NetworkPolicy、GitOps/Helm/Kustomize、Secret。
4. 证据：列命令或系统证据摘要，包括 describe、Events、logs、metrics、diff、render、audit、controller conditions、镜像 digest。
5. 风险：接流、回滚、权限、密钥、网络隔离、存储持久化、节点容量、探针、漂移、多云差异。
6. 验证：dry-run/render/diff、连通性、权限最小化、扩缩容触发、存储恢复、灰度 SLO、告警、回滚演练。
7. 联动：涉及 Terraform、CI/CD、应用代码、安全门禁、测试矩阵、最终审计时说明切换对应技能，不在本技能越权完成。
8. 结论：标已验证/部分验证/无法验证；列剩余缺口和下一步。

## 约束

- 未确认声明式来源，不得把 kubectl edit、scale、patch 作为最终完成；只能作为带过期时间的止血。
- 未确认 Kubernetes/控制器/云厂商版本，不得复用 Ingress、Gateway、LB、CSI、CNI、IAM 注解或默认值。
- 禁止生产 latest、默认 ServiceAccount、cluster-admin、明文 Secret、无 requests/readiness/rollback 的 workload。
- 禁止为排障直接关闭 NetworkPolicy、PSA、mTLS、admission 或扩大 RBAC；必须写最小例外、证据、回滚和过期时间。
- 禁止把 Helm/GitOps diff 干净说成运行时健康；必须读 conditions、Events、logs/metrics。
- 禁止把应用健康接口、业务重试、DB 迁移、CI/CD 发布编排、安全扫描、测试矩阵、最终审计写成本技能职责。
- 禁止输出 Secret、token、admin key、完整 kubeconfig、私有镜像凭据、审计日志中的敏感字段。
- 所有建议必须区分可直接执行与需目标集群验证。

## 高频 Bug 反例库

- 反例 1：liveness 查询数据库
  - 错法：数据库抖动时 liveness 失败，kubelet 批量重启 Pod，连接风暴放大故障。
  - 对法：liveness 只验证进程存活；readiness 反映下游依赖和接流；冷启动用 startupProbe。
  - 根因：把存活性、就绪性、依赖健康三种信号混成一个探针。
- 反例 2：readiness 缺失仍滚动发布
  - 错法：新 Pod 未预热就进入 EndpointSlice，LB 立即打流量导致 5xx。
  - 对法：readiness 覆盖启动缓存、连接池、关键依赖；发布观察 EndpointSlice 与 SLO。
  - 根因：只看容器 Running，没看服务是否可接流。
- 反例 3：Gateway API 跨 namespace 缺 ReferenceGrant
  - 错法：HTTPRoute 引用其他 namespace Service/TLS，Route Accepted=False 或 backend 无效。
  - 对法：补 ReferenceGrant，检查 Gateway/Route conditions 和 controller logs。
  - 根因：Gateway API 明确要求跨 namespace 引用授权。
- 反例 4：Service targetPort 与容器端口漂移
  - 错法：Deployment 改端口后 Service targetPort 未改，Ingress 502/503。
  - 对法：联查 Service、EndpointSlice、Pod ports、Ingress/Gateway backend health。
  - 根因：只改 workload，未追踪入口到 Pod 的完整链路。
- 反例 5：NetworkPolicy 默认 deny 忘放 DNS
  - 错法：只放业务端口，Pod 无法解析域名，外部依赖全失败。
  - 对法：显式放行 CoreDNS/kube-dns egress，再按依赖放行外部 API。
  - 根因：DNS 是运行时依赖，不是应用端口的一部分。
- 反例 6：HPA 指标不对应瓶颈
  - 错法：队列积压但 CPU 不高，HPA 不扩；或 CPU 抖动导致无效扩缩。
  - 对法：用 custom/external metrics 或 KEDA 绑定队列长度、延迟、吞吐等瓶颈指标。
  - 根因：把资源利用率误当业务负载信号。
- 反例 7：HPA 被 Quota/PDB/节点容量卡住
  - 错法：HPA DesiredReplicas 增长但 Pod Pending 或无法驱逐，误判为 HPA 失效。
  - 对法：同时查 HPA conditions、ResourceQuota、PDB、scheduler Events、cluster autoscaler/Karpenter。
  - 根因：扩容是控制器、调度、配额、节点池共同结果。
- 反例 8：VPA 与 HPA 同时控制 CPU
  - 错法：VPA 调 requests，HPA 又按 CPU 利用率扩缩，副本震荡。
  - 对法：明确 VPA recommendation/off 或仅管内存；HPA 使用稳定业务指标。
  - 根因：两个控制器改同一控制变量。
- 反例 9：GitOps prune 删除共享资源
  - 错法：从应用目录移除共享 Secret/PVC/CRD，自动同步把共享资源删掉。
  - 对法：共享资源独立 owner，prune 加门禁，删除前列消费者和备份/回滚。
  - 根因：资源所有权与应用目录边界混乱。
- 反例 10：Helm values 本地通过生产漏配
  - 错法：本地 values 有 imagePullSecret/limits，生产 overlay 漏掉导致 ImagePullBackOff 或 OOM。
  - 对法：对目标环境渲染并 diff，绑定 release revision 和 commit SHA。
  - 根因：验证了错误的声明式输入。
- 反例 11：PDB 与滚动策略互锁
  - 错法：replicas 少、maxUnavailable=0、PDB minAvailable 过高，rollout 或节点维护卡死。
  - 对法：联合校验 replicas、PDB、maxSurge/maxUnavailable、节点 drain 和 SLO。
  - 根因：可用性约束没有与发布/维护动作共同建模。
- 反例 12：containerd 后 Docker socket 依赖失效
  - 错法：节点从 dockershim 迁移到 containerd 后，CI/sidecar 仍挂 /var/run/docker.sock。
  - 对法：改用兼容 CRI 的构建/运行方案或隔离构建节点；验证 RuntimeClass 和节点镜像。
  - 根因：把 Docker daemon 当成 Kubernetes 运行时标准接口。
- 反例 13：镜像架构不匹配
  - 错法：amd64 镜像调度到 arm64 节点，容器 Exec format error。
  - 对法：发布 multi-arch manifest 或用 nodeSelector/affinity 固定架构，并记录 digest。
  - 根因：只固定 tag，未验证镜像 manifest 与节点架构。
- 反例 14：PVC 单 AZ 绑定后跨 AZ 调度
  - 错法：Pod 被调到另一个 AZ，VolumeAttachment 失败或 Pending。
  - 对法：检查 StorageClass volumeBindingMode、PV node affinity、拓扑约束和节点池 AZ。
  - 根因：存储拓扑与调度拓扑未一起验证。
- 反例 15：Secret 轮换后应用不热加载
  - 错法：External Secrets 已更新，应用进程仍用旧连接串，重启后才恢复。
  - 对法：确认 Secret 投递方式、刷新延迟、应用 reload 机制和滚动重启策略。
  - 根因：K8s Secret 更新不等于应用内存配置已刷新。
- 反例 16：PSA 拒绝旧 chart
  - 错法：升级 namespace 到 restricted 后，旧 chart 的 privileged、hostPath、runAsRoot 被拒。
  - 对法：先 dry-run/admission 验证，改 securityContext 或设最小例外并限期移除。
  - 根因：PodSecurity Admission 替代 PSP 后，准入从部署时直接拦截。
- 反例 17：Service mesh retry 放大故障
  - 错法：Envoy/Istio retry 与应用 retry 叠加，下游抖动时请求倍增。
  - 对法：统一 retry/timeout budget，查 mesh telemetry 与应用日志，限制幂等请求重试。
  - 根因：多层重试没有共享超时和容量预算。
- 反例 18：节点 ephemeral-storage 未设 requests
  - 错法：日志/临时文件涨满磁盘，Pod 被 Evicted，但 CPU/内存看起来正常。
  - 对法：设置 ephemeral-storage requests/limits，检查 kubelet eviction、日志轮转和 emptyDir。
  - 根因：忽略磁盘和 inode 是 kubelet 驱逐信号。
- 反例 19：云 LB 健康检查与 readiness 不一致
  - 错法：Pod readiness 通过但云 LB target unhealthy，或 LB 仍向 terminating Pod 打流量。
  - 对法：对齐 health check path/port/protocol、preStop、terminationGracePeriod 和 drain 时间。
  - 根因：Kubernetes 接流与云 LB 接流是两个控制面。
- 反例 20：只看应用日志忽略 Events
  - 错法：日志无报错就断言应用问题，漏掉 OOMKilled、FailedMount、FailedScheduling、ProbeFailed。
  - 对法：describe Pod/Node/PVC，导出 Events 并按时间线关联日志、指标、发布记录。
  - 根因：Kubernetes 故障常发生在应用进程外。

## 提交前自检清单

- [ ] frontmatter 含 name/description，H1 为 Cloud Native实战排障版。
- [ ] 行数 < 500，正文不含 fenced code block。
- [ ] 覆盖 Kubernetes 1.27-1.32、containerd/CRI、CNI/CoreDNS、Ingress/Gateway API。
- [ ] 覆盖 HPA/VPA/KEDA、PodSecurity/NetworkPolicy/RBAC、Helm/Kustomize/GitOps。
- [ ] 覆盖多集群/服务网格、节点压力/驱逐/探针/滚动发布、云厂商 LB/CSI 差异。
- [ ] 证据要求含 kubectl describe、Events、logs、metrics、audit、diff、controller conditions。
- [ ] 高频 Bug 反例库不少于 10 条，且每条含错法、对法、根因。
- [ ] 边界没有把 Terraform、CI/CD、应用代码、安全审计、测试工程职责搬进本技能。
- [ ] 涉测试/回归联动 test-engineering；最终改动由 code-audit 收口。
- [ ] 不输出 Secret、admin key、kubeconfig、token 或敏感审计字段。

## 2024-2026 新坑速查

- Kubernetes 1.27-1.32：PSP 已移除，PodSecurity Admission、ValidatingAdmissionPolicy、sidecar containers、Job/Indexed Job、API 弃用和 CRD conversion 行为需按目标小版本验证。
- containerd/CRI：dockershim 迁移后的 Docker socket、日志路径、镜像 GC、snapshotter、RuntimeClass 和节点镜像差异会改变排障入口。
- Gateway API：conformance profile 不等于实现一致；HTTPRoute filters、GRPCRoute、TLSRoute、ReferenceGrant、跨 namespace 引用和云厂商 LB 集成要读 conditions。
- Cilium/eBPF：NetworkPolicy、L7 policy、Hubble、kube-proxy replacement、MTU/IPAM 能力强但与 Calico/VPC CNI 语义不同。
- CoreDNS：上游 DNS、NodeLocal DNSCache、缓存、loop、rewrite、stub domain 会把网络问题伪装成应用超时。
- HPA/KEDA：external metrics 延迟、scale-to-zero 冷启动、触发器认证、fallback、cooldownPeriod 会影响队列类工作负载。
- VPA/HPA 协同：VPA 自动改 requests 可能改变 HPA 利用率分母；同一资源维度不要无边界双控。
- Cluster autoscaler/Karpenter：快速节点替换会放大 PDB、拓扑、PVC、镜像预热、DaemonSet overhead 和 Spot 中断问题。
- cgroup v2/节点 OS：CPU throttling、OOM、memory pressure、ephemeral-storage、PID pressure 指标口径变化会影响告警和扩缩容判断。
- Secrets Store CSI/External Secrets：外部密钥同步、权限、轮换延迟、应用热加载和审计链路要单独验证。
- Mesh ambient/sidecarless：mTLS、AuthorizationPolicy、telemetry、流量捕获不再完全等同 sidecar 模式。
- Multi-cluster：多集群 DNS、证书信任域、服务发现、东西向网关、故障域和配置漂移必须逐项验证。
- IPv6/dual-stack：Service、Pod CIDR、NetworkPolicy、DNS、Ingress、云 LB 健康检查和客户端源地址保留都可能变。
- Supply chain admission：SBOM、SLSA provenance、Sigstore/cosign、镜像 digest 与 admission policy 要绑定制品，不只看 tag。
- 托管云差异：EKS/GKE/AKS/ACK/TKE 的 IAM/Workload Identity、LB controller、CSI 拓扑、CNI IPAM、控制面日志和审计开关默认不同。

## 与相邻技能的边界

- 本技能负责：Kubernetes 对象、容器运行时、CNI/CoreDNS、Ingress/Gateway、Service Mesh、HPA/VPA/KEDA、PodSecurity/RBAC/NetworkPolicy、CSI/PVC、节点压力、多集群和运行时证据链。
- iac-terraform：Terraform state、provider、plan/apply、云资源创建归 iac-terraform；Terraform 输出的集群/Helm/K8s 对象进入运行时排障后由本技能接手。
- devsecops：SAST/DAST/SCA/SBOM、签名策略、CI 安全门禁、漏洞优先级归 devsecops；K8s admission、PodSecurity、RBAC、NetworkPolicy 的运行时命中证据由本技能提供。
- release-engineering：发布窗口、晋级、制品唯一性、灰度总控、回滚决策归 release-engineering；K8s rollout、Gateway 权重、HPA/PDB/Events 证据由本技能提供。
- backend-engineering：应用健康接口、业务重试、DB/队列依赖、日志字段由 backend-engineering；探针如何接流、Service/Mesh/Gateway 如何影响运行由本技能判断。
- observability-sre：SLI/SLO、告警、dashboard、incident/postmortem 归 observability-sre；K8s Events、controller conditions、mesh telemetry、HPA/KEDA 指标作为本技能证据输入。
- test-engineering：测试矩阵、回归、CI 证据、冒烟结论归 test-engineering；本技能只列云原生风险点和目标集群验证项。
- code-audit：任何技能正文或配置改动完成前由 code-audit 收口，核对需求、影响面、证据、缺口和是否越界。
