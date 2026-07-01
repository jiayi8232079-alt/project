---
name: finops
description: FinOps 实战排障版 - 面向云成本治理、FOCUS、CUR、Cost Explorer、BigQuery Billing Export、Budgets、Anomaly Detection、Savings Plans、Reserved Instances、CUD、Spot、rightsizing、unit economics、showback/chargeback、Kubernetes cost allocation、egress、idle resources、tag coverage 的证据化排障、预算预测、归因分摊和优化验收。
alwaysApply: false
---

# FinOps 实战排障版

定位：本技能只解决 FinOps 云成本问题：账单口径、成本归因、预算预测、承诺折扣、单位经济、Kubernetes cost allocation、egress、idle resources 与治理闭环。凡涉及改代码、改 IaC、改发布、改观测采集或安全门禁，只给成本证据和验收口径，落地交给相邻技能。

## 快速总则

1. 先定云账号/账单周期：明确 AWS account、Azure subscription、GCP project、payer/billing account、region、币种、税费、support、credits、Marketplace、合同折扣、摊销 amortized 与现金 invoice 口径，账单周期和导出延迟未确认不得下节省结论。
2. 先定成本数据源：AWS CUR、Cost Explorer、Budgets、Anomaly Detection；GCP BigQuery Billing Export、Billing Budgets、CUD；Azure Cost Management、Budgets、Reservation；FOCUS schema/版本；Kubecost/OpenCost；价格/API/字段不确定标“需验证”。
3. 先定维度与标签：owner、service、product、environment、cost_center、tenant、namespace、cluster、SKU/usage type、resource id、unit metric；输出 tag coverage、allocation coverage、unallocated cost。
4. 先定承诺用量边界：Savings Plans、Reserved Instances、Reservation、CUD、commitment 只覆盖 90/180 天稳定 baseline；实验、迁移中、活动峰值、强波动负载默认不买长期承诺。
5. 先证据后动作：每个建议必须绑定账单导出、看板查询、资源清单、监控指标、发布/活动日历、owner 确认、IaC diff 或财务发票；无证据写无法验证。
6. 优化顺序：清 waste/idle resources → rightsizing → 调度/架构优化 → Spot/弹性 → commitment → 采购谈判；禁止直接跳到买折扣。
7. 验收口径：forecast savings 只是预测；realized savings 必须在后续账单按业务量归一化复核，并确认 SLO、安全、合规、RPO/RTO、用户体验未恶化。

## 场景执行卡

### 1. 云成本暴涨 / Anomaly Detection
- 输入：异常时间窗、账期、Top account/project/service/region/SKU/resource/tag/namespace、业务量、发布/活动/迁移/故障/攻击/批处理日历。
- 动作：从 Cost Explorer/CUR/BigQuery Billing Export drill down 到 SKU、usage type、resource id、tag、namespace；关联日志风暴、重试风暴、DDoS/爬虫、备份复制、NAT/egress、AI token runaway、折扣到期。
- 输出：top drivers、金额差异、unit cost 变化、owner、止血动作、长期修复、下次账单验证点；账单未出齐必须标导出延迟。
- 兜底：定位不到资源时把 unallocated 作为治理缺口，不得平均摊平后宣布解决。

### 2. 标签 / 成本归因 / showback/chargeback
- 输入：标签字典、组织账号结构、资源清单、账单导出、Kubernetes labels、namespace、共享平台清单、IaC tag policy。
- 动作：计算 tag coverage、allocation coverage、unallocated；统一大小写和值域；补 owner/service/product/environment/cost_center；共享成本按请求数、CPU/内存、存储量、tenant 用量或业务规则分摊。
- 输出：归因规则、例外清单、补标 backlog、阻断/提醒策略、showback 可信度、chargeback 争议流程。
- 兜底：标签不能替代账号/项目/namespace 边界；强合规、强责任边界优先组织隔离。

### 3. 预算 / Budgets / forecast
- 输入：actual bill、预算、rolling forecast、业务量、季节性、发布/迁移计划、credits/commitment 到期、汇率。
- 动作：输出 best/base/worst 三档 forecast，解释 budget variance、forecast accuracy、主要假设；预算告警绑定 owner、资源、动作和例外。
- 输出：本月实际、下月预测、预算消耗率、触发阈值、冻结/扩容/采购动作、复盘时间。
- 兜底：新业务或大促无历史数据时列业务假设和置信度，不只给百分比。

### 4. unit economics / 成本看板
- 输入：成本分子、业务分母、收入/毛利、客户/订单/请求/GB/inference/token 等 unit metric、SLO 和看板口径。
- 动作：同时看总成本、unit cost、gross margin、ROI、carbon 与用户体验；说明税费、credits、折扣、共享平台是否纳入。
- 输出：unit economics 趋势、异常解释、改善动作、对定价/套餐/路线图影响、反作弊口径。
- 兜底：业务量下降导致总额下降不等于效率提升；总额降但 unit cost 升不是健康优化。

### 5. rightsizing / idle resources
- 输入：14-30 天以上 CPU、内存、IOPS、吞吐、网络、P95/P99、峰值、错误率、批处理、发布窗口、回滚容量。
- 动作：区分删除、关停排程、缩容、换规格、降 requests、自动扩缩、架构改造；数据库、队列、GPU、内存型和网络瓶颈看峰值与饱和度。
- 输出：资源 ID、建议规格、月节省、SLO 风险、验证指标、回滚步骤、owner。
- 兜底：只看平均 CPU 禁止缩生产；关键服务必须保留冗余和回滚容量。

### 6. Savings Plans / Reserved Instances / CUD / commitment
- 输入：90/180 天稳定基线、coverage/utilization、迁移计划、区域/实例族灵活性、期限、预付方式、业务 forecast。
- 动作：只覆盖稳定 baseline，保留 on-demand/Spot 弹性；情景分析业务下滑、架构迁移、价格变化、汇率和供应商锁定。
- 输出：购买/不购买理由、覆盖范围、期限、预估节省、浪费风险、复审日期、折扣归属。
- 兜底：不得用 commitment 覆盖实验、临时活动、迁移中或强波动负载。

### 7. Spot / Preemptible / 弹性容量
- 输入：可中断性、重试、checkpoint、队列、PDB、回退 on-demand、失败重算成本。
- 动作：将 baseline、burstable、Spot、GPU、memory optimized node pool 分层；按中断率、恢复时间和延迟影响复算收益。
- 输出：适用负载、回退容量、失败成本、SLO 风险、节省确认。
- 兜底：状态服务、单副本、不可重试任务、强实时链路默认不放 Spot。

### 8. Kubernetes cost allocation / namespace
- 输入：cluster、Kubecost/OpenCost、node price、namespace labels、requests/limits、idle allocation、PV/PVC、LB、egress、GPU、system namespace。
- 动作：对齐云标签与集群 labels；分析 request efficiency、node utilization、idle resources、orphan PVC、DaemonSet overhead、shared cost、egress。
- 输出：namespace/team/product 成本、idle cost、rightsizing 建议、节点池/调度策略、存储和网络出站优化、验证指标。
- 兜底：CPU request 过高会制造虚假满载；memory 不能只按平均值降；system namespace 不得粗暴摊平。

### 9. 存储 / 网络出站 / 观测成本
- 输入：对象/块/文件/数据库增长、生命周期、快照、跨区复制、NAT/CDN/LB、日志指标追踪、保留期、cardinality、数据驻留。
- 动作：治理冷热分层、压缩、去重、小文件、过期快照、跨区/公网 egress、日志级别、采样、保留分层。
- 输出：月节省、取回费/请求费、恢复/审计/SLO 影响、合规边界、回滚方式、看板验证。
- 兜底：合规留存、安全取证、关键 SLO 观测不能为降本盲删。

### 10. 治理 cadence / 自动化 guardrails
- 输入：RACI、预算 owner、例外流程、非生产 TTL、配额、tag policy、预算告警、Anomaly Detection 接收人。
- 动作：先 showback 透明化，再 chargeback；自动化优先用于非生产 TTL、配额、补标提醒和异常升级；生产自动关停默认高风险。
- 输出：治理节奏、门禁策略、例外审批、争议处理、指标看板、复盘动作。
- 兜底：chargeback 不能惩罚平台复用；分摊不可信时不得直接扣款。

## 高频坑 / 防遗漏

- 混用 invoice cash、amortized cost、blended/unblended/net cost，导致预算和 forecast 偏差。
- 忽略 credits、tax、support、Marketplace、汇率、私有折扣和退款，节省被高估。
- CUR、FOCUS、BigQuery Billing Export 字段变更未同步，历史趋势断层。
- tag coverage 低却做 chargeback，团队不认可账单。
- 共享平台成本平均分摊，掩盖大租户和异常用量。
- 预算告警只发公共列表，无 owner、资源和动作。
- anomaly 未按业务量归一化，大促误报或真实浪费被掩盖。
- 只看平均 CPU 做 rightsizing，生产峰值、发布双跑或内存/IO 瓶颈被漏掉。
- commitment 前未看迁移计划、到期、coverage/utilization，折扣变 waste。
- Spot 节省未扣中断、重试、延迟、失败重算和回退容量。
- Kubernetes 只看 namespace，漏 idle resources、PVC、LB、egress、system overhead。
- 存储只看 GB，漏请求费、取回费、复制费、小文件和数据驻留。
- 网络出站只看 CDN，漏 NAT、跨区复制、LB、私网转公网、第三方 API 回源。
- 观测降本盲删日志/trace/profile，事故时失去证据。
- 只报 savings potential，未用后续账单复核 realized savings。

防遗漏清单：账期/币种/税费/support/credits 已说明；数据源与 schema 版本已说明；tag coverage/allocation/unallocated 已量化；预算/forecast/variance 已绑定业务假设；unit economics 分子分母固定；commitment coverage/utilization/到期已核；Kubernetes/storage/egress/observability 成本已单独看；每个动作有 owner、月节省、风险、验证、回滚、置信度。

## 输出要求

1. 成本事实：时间范围、总额、币种、口径、Top drivers、导出延迟、证据来源。
2. 数据源：CUR、Cost Explorer、BigQuery Billing Export、FOCUS、Budgets、Anomaly Detection、Kubecost/OpenCost 的使用情况和版本/字段缺口。
3. 归因质量：tag coverage、allocation coverage、unallocated、共享成本规则、owner 缺口。
4. 预算预测：预算状态、Budgets 告警、forecast 三档、偏差原因、置信度、下次复盘。
5. 单位经济：unit economics 指标、分子/分母、趋势、毛利/ROI/业务解释。
6. 优化清单：动作、资源 ID/范围、月节省、风险、owner、优先级、验证、回滚。
7. 承诺折扣：Savings Plans、Reserved Instances、Reservation、CUD、Spot、coverage、utilization、expiration risk、折扣归属。
8. 平台专项：Kubernetes cost allocation、namespace、idle resources、存储成本、egress、观测成本、成本看板结论。
9. 治理动作：policy、automation、cadence、RACI、showback/chargeback、Anomaly Detection。
10. 结论分级：已验证、部分验证、无法验证；无法验证必须列缺口和下一步。

## 约束

- 默认只做分析、方案和验证清单；不访问或修改生产资源，除非用户明确授权。
- 不删除、缩容、关停生产资源；必须有 owner、SLO 验证、变更窗口和回滚。
- 无 90/180 天稳定基线不买长期 commitment、Savings Plans、Reserved Instances、CUD。
- 不把 showback/chargeback 用作惩罚；目标是透明、行动和责任闭环。
- 不为降成本破坏安全、审计、合规留存、可靠性、RPO/RTO 或用户体验。
- 不把未分摊成本藏入其他；unallocated 必须有 owner 和清理计划。
- 不混同测试、预发、生产 environment；账单与资源边界必须分离。
- 2024-2026 价格、API、折扣、字段规则变化快；未查当前官方文档或合同则标需验证。
- 涉代码、脚本、API、DB、IaC、发布、观测采集或自动化改动时，按边界联动对应技能并保留测试/审计证据。

## 高频 Bug 反例库

- 反例 1：错法 / 共享数据库、网关、平台节点按团队数平均分。对法 / 按请求数、CPU/内存、存储量、tenant 用量或服务成本占比分摊，无法分摊进 unallocated backlog。根因 / 平均分摊掩盖真实驱动，showback 失去行动性。
- 反例 2：错法 / owner=TeamA、team_a、unknown 都算标签合格。对法 / 值域字典化，核心 tag coverage 设目标，无 owner 资源进入阻断或例外审批。根因 / 脏标签让成本归因和 chargeback 失真。
- 反例 3：错法 / 预算 100% 邮件发公共列表。对法 / Budgets 阈值绑定 owner、资源、可能原因、动作和例外流程。根因 / 告警不可行动等于噪音。
- 反例 4：错法 / forecast 只按上月乘增长率。对法 / best/base/worst 三档，绑定业务量、季节性、发布、采购和折扣假设。根因 / 单线性预测无法解释偏差。
- 反例 5：错法 / 本月用请求数、下月用活跃用户计算 unit economics。对法 / 固定 unit metric，说明去重、窗口、共享成本和异常流量处理。根因 / 指标漂移制造虚假 ROI。
- 反例 6：错法 / 平均 CPU 15% 就把关键服务降规格。对法 / 看 P95/P99、内存、I/O、延迟、错误率、峰值、发布双跑和回滚。根因 / 平均值吞掉尾部风险。
- 反例 7：错法 / 用全年峰值买 1 年或 3 年 Savings Plans/Reserved Instances/CUD。对法 / 只覆盖稳定 baseline，保留 on-demand/Spot 弹性并设到期复审。根因 / 过度承诺会把折扣变 waste。
- 反例 8：错法 / 单副本数据库或实时订单 worker 跑 Spot。对法 / 只放可重试、可 checkpoint、可回退的无状态或批处理负载。根因 / 低单价不等于低总风险。
- 反例 9：错法 / 只汇总 pod 成本，集群空闲节点不归属。对法 / 用 Kubecost/OpenCost 计算 namespace、node、PV/PVC、LB、egress、DaemonSet 和 idle allocation。根因 / requests 与调度浪费常藏在 idle resources。
- 反例 10：错法 / 对象存储只按 GB 优化。对法 / 同时看容量、请求、取回、复制、生命周期、数据驻留和访问模式。根因 / 存储账单常由访问和传输驱动。
- 反例 11：错法 / 成本看板字段变更后仍与历史曲线直接比较。对法 / 标注 schema/version，重算历史或拆分趋势窗口。根因 / 字段变化制造假异常或吞掉真异常。
- 反例 12：错法 / 流量翻倍成本翻倍就报警为浪费。对法 / 同时看绝对成本、unit cost、业务量和季节性基线。根因 / Anomaly Detection 不理解业务量会误判。
- 反例 13：错法 / CUR 或 BigQuery Billing Export 延迟未出齐就宣布当日节省。对法 / 标注导出延迟，用完整账期或校正窗口复核。根因 / 未完备账单会产生假节省。
- 反例 14：错法 / 为省 egress 把服务迁到低价区。对法 / 同时验证延迟、数据驻留、合规、跨区复制和用户路径。根因 / 区域单价不是总成本和风险的全部。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] fenced code block 数量为 0。
- [ ] frontmatter name/description 存在，H1 包含“实战排障版”。
- [ ] 包含快速总则、场景执行卡、高频坑/防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 反例不少于 10 条，且每条能被“反例 数字”命中。
- [ ] 核心关键词均出现：FOCUS、CUR、Cost Explorer、BigQuery Billing Export、Budgets、Anomaly Detection、Savings Plans、Reserved Instances、CUD、Spot、rightsizing、unit economics、showback/chargeback、Kubernetes cost allocation、egress、idle resources、tag coverage。
- [ ] 每个优化建议都有证据、owner、风险、验证和回滚；未验证价格/API/折扣/合同条款均标需验证。
- [ ] 相邻技能边界清楚，未把云原生实施、Terraform 修改、SRE 采集、发布总控、安全门禁、测试和审计职责写成本技能职责。

## 2024-2026 新坑速查

- FOCUS 与云厂商账单导出字段持续演进；CUR、Cost Categories、BigQuery Billing Export、Azure export 字段变化要进数据质量检查。
- Savings Plans、Reserved Instances、Reservation、CUD、Spot/Preemptible 规则、实例族灵活性、区域价格和汇率变化快；采购前查当前账号、区域、合同和官方价格。
- ARM/Graviton、GPU、加速器、serverless、数据库自治版本单价与迁移成本差异明显；只看实例单价会漏性能和迁移风险。
- Kubernetes 自动扩缩、Karpenter/Cluster Autoscaler、VPA/HPA/KEDA 改变成本曲线；需把调度事件、namespace 与账单关联。
- AI/LLM 成本从训练转向推理、agent、多模态、embedding、rerank、工具调用和观测；token runaway 常触发 anomaly。
- SaaS seat-based、usage-based、AI add-on、数据保留和 egress 混合增长；采购台账必须跟真实使用量对齐。
- observability vendor 计费从 host 转向事件量、cardinality、GB ingest、trace span、RUM session；优化要防止盲区。
- 多云、主权云、数据驻留和跨境合规会推高网络出站、复制和合规留存成本；不能只按最低单价选区。
- carbon、能耗和区域选择进入治理指标；carbon 优化不得牺牲合规、延迟和可靠性。
- 安全、备份、审计、SIEM 和合规留存成本上升；需要按风险证明必要性，而不是归为 waste。
- anomalous spend 常来自日志风暴、重试风暴、DDoS/爬虫、批处理循环、备份复制和 token runaway；Anomaly Detection 必须接入工程上下文。
- 预算治理从人工月会转向 policy/guardrails；生产自动关停默认高风险，非生产 TTL、配额和 tag policy 更适合自动化。

## 与相邻技能的边界

- finops：负责账单口径、成本归因、成本分摊、预算、forecast、unit economics、Savings Plans、Reserved Instances、CUD、Spot、rightsizing 决策、Kubernetes cost allocation、egress、idle resources、showback/chargeback 和 realized savings 验收。
- cloud-native：负责 Kubernetes 调度、Ingress/Gateway、Service Mesh、存储、网络和运行时配置；finops 只定义 namespace 成本、idle、egress、rightsizing 收益和风险阈值。
- iac-terraform：负责 Terraform/OpenTofu/Terragrunt、provider、module、state、plan/apply 和 tag policy 落地；finops 提供成本目标、预算约束和验收口径。
- observability-sre：负责 logs/metrics/traces/profiles、SLO、告警、dashboard、incident 和观测采集；finops 只评估观测账单、cardinality 成本和成本异常证据。
- release-engineering：负责发布窗口、artifact、灰度、监控、冒烟、回滚和审计；finops 只给成本指标、预算阈值和发布后账单复核点。
- devsecops：负责 Secrets、SBOM、SLSA、签名、供应链、CI/CD 安全门禁和 IaC/容器安全；finops 不以降本为由放宽安全基线。
- test-engineering：负责测试矩阵、回归、CI 证据和覆盖判断；finops 提供成本验证样本、预算/账单断言和业务风险。
- code-audit：负责改动后的需求对账、影响面、安全质量和最终收口；finops 不替代审计结论。
- 边界结论：FinOps 只能证明成本与单位经济证据链，不能替代性能测试、安全审计、生产变更审批或财务/法务确认。
