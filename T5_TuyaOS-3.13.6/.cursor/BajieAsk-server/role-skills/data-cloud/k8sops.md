---
name: kubernetes-operations
description: Kubernetes 运维。Pod/Deploy/Service/Ingress/RBAC/HPA/Helm/故障排查/GitOps/监控。配合 cld / containerrev / rls 用。
---

# Kubernetes 运维

## 适用场景
- K8s 集群应用部署与管理。
- 故障排查 (CrashLoop / Pending / OOMKilled)。
- Helm chart 编写与管理。
- RBAC / NetworkPolicy 安全配置。
- GitOps (ArgoCD / Flux)。

## 不适用
- 容器镜像安全逆向 → `containerrev`。
- Docker 基础 → `cld`。
- 云 IaC → `terraform`。

---

## 核心概念速查

```text
Workloads:
  Pod           最小调度单元 (1+ 容器)
  Deployment    无状态应用 (ReplicaSet 管理)
  StatefulSet   有状态应用 (稳定网络ID + 持久卷)
  DaemonSet     每节点一个 Pod (日志/监控 agent)
  Job/CronJob   一次性/定时任务

Networking:
  Service       Pod 集合的稳定入口 (ClusterIP/NodePort/LoadBalancer)
  Ingress       L7 HTTP(S) 路由 (nginx/traefik/istio)
  Gateway API   下一代 Ingress (更灵活)
  NetworkPolicy Pod 间网络防火墙

Storage:
  PV/PVC        持久卷声明
  StorageClass  动态卷分配 (cloud provider)
  ConfigMap     配置 (明文)
  Secret        敏感配置 (base64, 非加密!)

Security:
  RBAC          Role/ClusterRole + RoleBinding
  ServiceAccount Pod 身份
  PodSecurity   Pod 安全标准 (restricted/baseline/privileged)
  NetworkPolicy 网络隔离
```

## 常用命令

```bash
# 查看
kubectl get pods -A                        # 所有 namespace
kubectl get pods -o wide                   # 显示节点/IP
kubectl describe pod <name>                # 详细状态+事件
kubectl logs <pod> [-c container] [-f]     # 日志
kubectl logs <pod> --previous              # 上次 crash 日志
kubectl top pods                           # 资源使用

# 调试
kubectl exec -it <pod> -- /bin/sh          # 进入容器
kubectl debug <pod> --image=busybox -it    # ephemeral 调试容器
kubectl port-forward svc/<name> 8080:80    # 本地端口转发
kubectl get events --sort-by=.metadata.creationTimestamp  # 事件时间线

# 操作
kubectl apply -f manifest.yaml             # 声明式部署
kubectl rollout status deploy/<name>       # 等待部署完成
kubectl rollout undo deploy/<name>         # 回滚
kubectl scale deploy/<name> --replicas=3   # 手动扩缩
kubectl delete pod <name>                  # 删除 (Deployment 会重建)
```

## 故障排查

```text
Pod 状态:
  Pending:
    → describe: 看 Events
    → 常见: 资源不足 / nodeSelector 不匹配 / PVC pending
  CrashLoopBackOff:
    → logs --previous: 看 crash 前日志
    → 常见: 配置错误 / 启动命令错 / 依赖不可达 / OOM
  ImagePullBackOff:
    → describe: 看 image 名和 registry 认证
    → 常见: 镜像不存在 / registry 需要认证 / tag 错误
  OOMKilled:
    → describe: 看 Last State → Reason: OOMKilled
    → 增加 resources.limits.memory
  Evicted:
    → 节点磁盘/内存压力 → 被驱逐
    → 检查节点 conditions

Service 不通:
  kubectl get endpoints <svc>              # endpoint 是否有 Pod IP?
  → 没有: label selector 不匹配 / Pod 不 Ready
  kubectl exec <client-pod> -- curl <svc>:<port>  # 从集群内测试
```

## Helm

```bash
# 基本操作
helm repo add bitnami https://charts.bitnami.com/bitnami
helm search repo postgres
helm install mydb bitnami/postgresql -f values.yaml -n db
helm upgrade mydb bitnami/postgresql -f values.yaml
helm rollback mydb 1                       # 回滚到 revision 1
helm uninstall mydb

# 创建 chart
helm create mychart
# mychart/
#   Chart.yaml      元数据
#   values.yaml     默认值
#   templates/      Go templates
#     deployment.yaml
#     service.yaml
#     _helpers.tpl

# values.yaml 覆盖
helm install myapp ./mychart \
  --set image.tag=v2.0 \
  --set replicas=3 \
  -f production-values.yaml
```

## RBAC

```yaml
# Role (namespace 级)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: app
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  namespace: app
  name: read-pods
subjects:
- kind: ServiceAccount
  name: app-sa
  namespace: app
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io

---
# ClusterRole (集群级)
# 用于跨 namespace 或集群资源 (nodes/PV 等)
```

## GitOps (ArgoCD)

```bash
# ArgoCD 安装
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Application CRD
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/k8s-manifests.git
    targetRevision: main
    path: apps/myapp
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true

# 工作流:
# git push manifest 变更 → ArgoCD 检测 → 自动 sync → 集群状态=git 状态
```

## HPA (自动伸缩)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 实战入口
- **kubernetes.io/docs** — 官方文档。
- **kubectl cheatsheet** — 命令速查。
- **Helm docs** — chart 开发。
- **ArgoCD docs** — GitOps。
- **Lens / k9s** — K8s GUI/TUI。
- **KillerCoda / Killercoda** — 交互实验。

## 自检
1. 集群在哪？(cloud managed / self-hosted)
2. 问题类型？(部署 / 故障 / 扩缩 / 安全)
3. Helm 还是 Kustomize？
4. GitOps？(ArgoCD / Flux)
5. 监控？(Prometheus / Grafana)
6. 多集群？

## 相邻技能
- `cld` — 云 / 容器基础。
- `containerrev` — 容器安全。
- `terraform` — 基础设施 IaC。
- `rls` — 发布工程。
- `plt` — 平台工程。