---
name: terraform-iac
description: Terraform/IaC 实战排障版 - 面向 Terraform 1.6、Terraform 1.7、Terraform 1.8、OpenTofu、provider lock、remote backend、state locking、drift、import blocks、moved blocks、for_each key stability、lifecycle prevent_destroy、plan JSON、Sentinel/OPA、tfsec/checkov、module versioning、multi-account、ephemeral credentials 的基础设施变更、排障、审计、回滚与跨团队协作。涉及 .tf/.tfvars/backend/provider/module/state/plan/apply/import/move/drift/IaC 扫描时使用。
---

# IaC/Terraform

首次自称：IaC/Terraform（terraform-iac，兼容 slug: itf）。
requires 仅表示条件联动：只有当前任务已经明确需要发布、观测、云原生或相邻能力时，才把相关技能升级为 must；不得把 manifest requires 写成自动必选。

> 定位：只负责 Terraform/OpenTofu 与 IaC 生命周期内的配置来源、backend/state、provider/module 版本、plan/apply 证据、漂移、导入、重构、安全策略和成本影响；不替代云原生运行时、发布工程、FinOps 成本归因、DevSecOps 安全专项或后端应用实现。
> 铁律：未确认环境、workspace/backend、state/lock、provider lock、plan/apply 证据前，不得修改或宣称 IaC 变更完成。

## 快速总则：IaC 定制版本 / 环境 / backend / state / 证据

1. 版本先行：记录 Terraform 1.6、Terraform 1.7、Terraform 1.8 或 OpenTofu 版本，确认 provider 版本、module versioning、CLI flags、CI runner 镜像。
2. 环境先行：确认 account/subscription/project、region、workspace、root module、backend config、变量来源、tfvars、环境覆盖关系。
3. backend 先行：remote backend、state locking、加密、锁表、权限、state key、workspace 映射必须读实；禁止凭目录名判断环境。
4. state 先行：变更前确认 state owner、serial、lineage、资源地址、import/moved 历史、敏感字段暴露、并发 apply 风险。
5. 证据先行：输出 plan 摘要、plan JSON 风险项、provider lock 差异、apply 结果、state lock 记录、drift 证据；未跑不报。
6. 破坏性先挡：delete/replace/destroy、lifecycle prevent_destroy、force_new、name 变更、for_each key stability、依赖链必须单独列出。
7. 导入重构分离：import blocks、moved blocks、terraform state mv/import 与业务变更分 PR/步骤，避免一份 plan 同时重构和改资源。
8. 安全门禁：Sentinel/OPA、tfsec/checkov、密钥扫描、provider 权限、ephemeral credentials、最小权限必须与 plan 证据绑定。
9. 多账号谨慎：multi-account、多区域、多 workspace、跨 state remote data source 必须列出调用关系和 blast radius。
10. 可回滚：Terraform 无通用一键回滚；必须给出 roll-forward、反向 plan、state 备份、锁释放和人工兜底方案。

## 硬门禁：从 init 到验收的最小顺序

1. 进入前门禁：确认 root module、目标环境、workspace、backend state key、账号/区域、provider alias、变量来源、凭据来源；任一未知则只读排查，不 init/apply。
2. 初始化门禁：只允许在确认过的 backend 上 init；禁止临时切 local backend、复制 state、删除 lock 文件或用错误 workspace 试跑。
3. 锁与并发门禁：apply 前确认 state lock 机制、CI concurrency group、当前无活跃 job；stale lock 必须有 state 备份、锁 ID、操作者和云审计证据。
4. provider/module 门禁：`.terraform.lock.hcl`、required_providers、module source/ref 必须可复现；生产禁止浮动分支、latest、未审 lock diff。
5. plan 门禁：保存二进制 plan artifact，再用 plan JSON 审 create/update/replace/delete/no-op/unknown/sensitive；文本摘要只作辅助。
6. 破坏性门禁：replace/delete/destroy、force_new、target、解除 prevent_destroy、数据面资源、跨账号资源必须单独审批和备份，不得混在普通 apply 里带过。
7. apply 门禁：apply 必须消费同一 commit、同一变量、同一 backend、同一身份生成并审批过的 plan artifact；重新 plan 后必须重新审。
8. 验收门禁：apply 后必须核对 state serial/lineage、关键资源实际属性、策略扫描、drift/no-op plan、日志和成本标签；只看到 apply exit 0 不算完成。
9. 回退门禁：先准备 roll-forward、反向变更、备份恢复、state restore、锁释放和旧入口停用/恢复路径；Terraform 回退默认是工程流程，不是单条命令。

## 专项门禁：必须逐项过线

- State/lock：任何会写 state 的动作前，必须确认 backend、workspace、state key、serial、lineage、锁机制、当前锁持有者和备份点；force-unlock 只允许在证明锁已 stale 后执行。
- Import/move：接管存量资源先写 import mapping，导入后追求 no-op plan；地址重构先用 moved blocks 或受控 state mv，禁止和业务字段变更混在同一审批里。
- Plan/apply：plan 必须产出可追溯 artifact 和 JSON 审计结果；apply 必须消费同一 artifact，同一 commit、变量、backend、workspace、账号、角色、provider lock，不满足则重新审批。
- Provider pin：required_providers、provider source、version constraint、`.terraform.lock.hcl`、多平台 hash、provider alias 都要审；生产禁止 latest、未锁定 provider、未说明 lock diff 的升级。
- Module 边界：root module 只做环境编排，子 module 只暴露稳定输入输出；module source 必须 pin 到 tag/commit/version，跨 state output 和 remote state data source 必须标消费者和发布顺序。
- 变量/secret：变量来源按 default、tfvars、env、CI secret、workspace variable、remote state 逐层列出；secret 只走受控系统和临时凭证，禁止明文 tfvars、敏感 output、日志和 artifact 泄露。
- 环境隔离：dev/stage/prod、account/subscription/project、region、workspace、state key、角色链、审批门必须可区分；禁止用目录名或 branch 名替代环境证据。
- Drift：drift 先归因再收敛，区分控制台手改、外部 controller、provider 读模型、云默认值、策略回写；ignore_changes 必须有 owner、字段、过期日和复查条件。
- Policy-as-code：Sentinel/OPA、tfsec/checkov、tflint、密钥扫描和成本门禁要绑定资源地址、规则 ID、例外 owner、到期日和补偿控制；禁止只贴通过率。
- 销毁保护：delete/replace/destroy、target、解除 prevent_destroy、数据面资源、全量 destroy 都是 break-glass；必须分级、备份、恢复演练、审批、复跑全量 plan。
- 回滚与恢复：Terraform 默认没有一键 rollback；必须写 roll-forward、反向配置、state 备份恢复、旧入口恢复、DNS/路由/权限切回和人工兜底。
- 审计留存：保留 manifest/commit、CLI/provider/module 版本、plan artifact digest、审批记录、apply job、runner 身份、state serial/lineage、云审计事件、验收结果。
- 真实验收闭环：完成态必须同时有 apply 结果、state 核对、云侧实物核对、no-op 或 refresh-only 解释、策略扫描、drift 结果、成本/标签检查和回滚路径；缺一项就写未完成项。

## 场景执行卡

### 1. 新增或修改 root module
- 输入：目标环境、root module、backend、workspace、provider/module 版本、变量来源、期望资源清单。
- 动作：读 versions/providers/backend、锁文件、module source/ref、变量默认值、CI init/plan/apply 流程；生成 plan 并标破坏性动作。
- 证据：Terraform/OpenTofu 版本、provider lock diff、plan 摘要、plan JSON 高风险资源、影响账号/区域。
- 失败兜底：缺 backend 或环境映射时先停；禁止新建本地 state 当作生产入口。

### 2. remote backend、state 与 lock 排障
- 输入：backend 类型、state key、workspace、锁 ID、失败日志、操作者、最近 apply。
- 动作：确认 remote backend 权限、加密、锁表/对象、state lineage/serial、并发任务、workspace 到 state key 映射；先备份 state，再处理 stale lock。
- 证据：锁记录、state serial/lineage、workspace/backend 映射、CI job、操作者、解锁原因、备份位置。
- 失败兜底：无法确认锁是否存活时不 force-unlock；先找 CI 和云审计日志。

### 3. plan/apply 变更审计
- 输入：代码 diff、变量 diff、provider lock diff、plan 文件、审批要求。
- 动作：用 plan JSON 分类 create/update/replace/delete/no-op；标 force_new、computed unknown、sensitive、depends_on、destroy、target、replace_triggered_by。
- 证据：资源地址、动作、原因、风险级别、审批人、plan artifact digest/路径、apply 时间窗口。
- 失败兜底：plan 与 apply 不是同一 commit/变量/backend 时必须重跑。

### 4. drift 检测与收敛
- 输入：线上异常、云控制台变更、refresh-only plan、审计日志、资源 owner。
- 动作：区分真实 drift、provider 读模型变化、默认值噪声、外部 controller 修改；决定导回代码、忽略、import 或人工修复。
- 证据：drift 资源、字段、来源、首次出现时间、收敛策略。
- 失败兜底：不得用 ignore_changes 掩盖未知 drift；必须写明过期条件。

### 5. import blocks 与接管存量资源
- 输入：存量资源 ID、目标地址、provider alias、账号/区域、现有命名和标签。
- 动作：先 import blocks 或受控 import，生成 no-op plan；补齐必填字段和 lifecycle prevent_destroy；再做后续改造。
- 证据：import mapping、state 地址、no-op plan 或差异解释、资源保护项。
- 失败兜底：导入后出现 replace/delete 时停止，先补配置或 moved blocks。

### 6. moved blocks 与地址重构
- 输入：旧地址、新地址、count/for_each 变更、module 拆分、历史 state。
- 动作：保持 for_each key stability；用 moved blocks 或 state mv 映射；先验证 no-op plan，再合并业务变更。
- 证据：旧新地址映射、plan 无删除、module versioning 变更、回退方案。
- 失败兜底：count 改 for_each 未给稳定 key 时不改。

### 7. provider、module 与 lock 升级
- 输入：required_providers、lock file、module source/ref、CHANGELOG、兼容矩阵。
- 动作：逐级升级 provider/module；审查 deprecation、默认值变化、API 行为变化；重跑 init -upgrade 和 plan。
- 证据：升级前后版本、lock diff、计划差异、回归结果。
- 失败兜底：禁止浮动 main/master/latest module；生产必须 pin 版本或 commit。

### 8. multi-account 与 ephemeral credentials
- 输入：账号清单、角色链、provider alias、OIDC/STS、CI 权限、目标资源。
- 动作：核对每个 provider alias 的账号/区域；使用 ephemeral credentials；限制 apply role 权限；防止 default provider 漏配。
- 证据：调用身份、账号 ID、权限范围、plan 资源归属。
- 失败兜底：无法证明账号归属时不 apply。

### 9. 安全策略与合规门禁
- 输入：策略集、tfsec/checkov 报告、Sentinel/OPA 结果、例外单、密钥扫描结果。
- 动作：把扫描问题映射到资源地址；区分误报、例外、必须修复；例外必须有 owner、到期日、风险说明。
- 证据：规则 ID、资源地址、处理结论、例外有效期。
- 失败兜底：安全扫描失败不得只改 CI 阈值绕过。

### 10. 成本、发布与回滚协作
- 输入：资源规格、标签、预算、发布窗口、回滚路径、成本预估。
- 动作：标大规格、NAT/LB/日志/存储/跨区流量、预留实例/承诺消费影响；与 FinOps 确认成本归因，与 rls 确认窗口。
- 证据：成本影响、tagging、预算 gate、审批、回滚或 roll-forward plan、备份/restore 验证。
- 失败兜底：涉及 destroy/replace 数据资源时必须有备份和恢复演练证据。

### 11. CI/CD 受控执行与审计留存
- 输入：CI 流程、runner 身份、plan artifact、审批门、环境保护、并发组、run task、手工 apply 规则。
- 动作：固定 init/validate/fmt/tflint/scan/plan JSON/apply 顺序；保存不可变 plan artifact；apply 必须消费同一 commit、同一变量、同一 backend、同一身份生成的已审批 plan；设置环境保护、并发锁和审计留存。
- 证据：CI job、artifact digest/路径、审批记录、并发组、runner 身份、apply 使用的 plan 文件、失败恢复记录。
- 失败兜底：plan artifact 缺失、重新 plan 后直接 apply、手工绕过审批、并发 apply 未隔离时停止；禁止为赶发布关闭锁、扫描或环境保护。

### 12. Secrets 与 state 敏感数据治理
- 输入：敏感变量来源、tfvars、环境变量、KMS/Secret Manager/Vault、outputs、state backend 权限、日志与 artifact 保留策略。
- 动作：敏感值走受控 secret 系统和临时凭证；审查 state/outputs/plan artifact 是否含敏感数据；限制 state 读写权限、加密、审计访问；日志脱敏并设置保留期。
- 证据：secret 来源、state 加密与访问策略、敏感 output 清单、artifact 可见范围、审计日志、脱敏规则。
- 失败兜底：发现密码/token/私钥写入 state、output、tfvars、日志或长期公开 artifact 时先止血轮换；不得把敏感 state 片段贴到报告。

### 13. Destroy 防护与 break-glass
- 输入：destroy/replace/delete 动作、target 参数、数据资源、依赖链、prevent_destroy、备份、审批、break-glass 申请。
- 动作：按普通删除、replacement destroy、targeted destroy、全量 destroy、数据面 destroy 分级；数据资源先备份和恢复演练；解除 prevent_destroy 必须单独审批；target 只用于受控修复并复跑全量 plan；destroy 结束后必须验 state 与云侧实物。
- 证据：资源地址、动作原因、分级、审批人、备份与恢复验证、target 范围、解除保护理由、回补全量 plan、destroy 后验收。
- 失败兜底：workspace 批量误删风险、依赖链不明、无备份、无 break-glass 审批、target 会隐藏后续变化时停止。

### 14. 迁移与生态分叉
- 输入：Terraform/OpenTofu 版本、provider registry/namespace、lock file、backend 类型、state lineage/serial、TFC/E 或自管 CI 迁移目标、批量 import/moved 计划。
- 动作：迁移前备份 state 并冻结 apply；逐项验证 CLI、registry、backend、provider lock、workspace、变量和凭证；backend 迁移后校验 lineage/serial 和 no-op plan；批量 state mv/import 用映射表分批执行。
- 证据：迁移前后版本、state 备份、lineage/serial、registry/namespace 映射、CI 变量映射、no-op plan、旧入口停用记录。
- 失败兜底：Terraform 与 OpenTofu 混用同一 state/lock、旧 CI 仍会 apply、backend 迁移未校验、provider namespace 解析不一致时停止。

### 15. Module 契约与发布兼容
- 输入：root/module 职责、输入输出契约、provider alias、remote state 依赖、版本语义、测试矩阵、弃用策略。
- 动作：root module 负责环境编排，子 module 保持可复用边界；输入加 validation/precondition/postcondition；输出按兼容策略演进；显式传 provider alias；限制跨 state data source 强耦合；发布前跑 module 示例和兼容 plan。
- 证据：module version、契约变更、provider 映射、输出消费者、兼容性说明、测试/plan 结果、弃用期限。
- 失败兜底：输出改名影响下游、provider alias 透传不明、module 依赖 remote state 形成隐式发布顺序、浮动版本发布到生产时停止。

### 16. 持续漂移、策略与成本门禁
- 输入：定时 refresh-only、云审计事件、controller-managed 字段、策略分层、例外生命周期、Infracost/成本估算、标签和预算 gate。
- 动作：建立 drift 定时检测与告警去噪；把 drift 关联审计事件和 owner；区分组织强制、环境差异和临时例外；成本扫描标 NAT/LB/日志/存储/跨区流量和规格 diff；标签/预算超阈值需审批。
- 证据：refresh-only 记录、drift SLO、审计事件、策略规则 ID、例外 owner/到期日、成本 diff、预算审批、tagging 结果。
- 失败兜底：长期无 owner drift、controller 字段未白名单、策略例外无到期日、成本 gate 缺失或预算超阈值未批时停止。

## 高频坑 / 防遗漏

### 高频坑
- backend key/workspace 混用导致 plan 指向错误环境。
- provider lock 未提交，CI 与本地解析到不同 provider。
- module versioning 使用浮动分支，生产 plan 不可复现。
- for_each key 使用可变名称，重命名触发批量 destroy/create。
- moved blocks 缺失，重构被 Terraform 识别为删除再新建。
- import blocks 后未补全配置，下一次 plan 试图替换资源。
- lifecycle prevent_destroy 未加在关键数据资源，误 destroy 无硬挡。
- ignore_changes 长期存在，drift 被永久遮蔽。
- multi-account provider alias 漏传到 module，资源落到默认账号。
- ephemeral credentials 过期，plan/apply 身份不一致。
- Sentinel/OPA、tfsec/checkov 只看通过率，不看资源地址和例外。
- plan JSON 未审 destroy/replace，只凭人读彩色输出审批。
- CI apply 未消费已审批 plan artifact，而是重新 plan 后自动 apply。
- 两个 CI 并发 apply 共用 state lock，异常后误 force-unlock。
- state output 暴露数据库密码，plan artifact 被长期公开保存。
- terraform destroy 或 target 参数为修单点问题误删依赖资源。
- Terraform 与 OpenTofu 混用同一 lock/backend，provider registry 解析不一致。
- backend 迁移未校验 lineage/serial，旧 state 仍被定时任务使用。
- module 输出被多个 state 强耦合，改名触发下游失败。
- policy 例外无到期日，长期绕过加密或公网暴露规则。
- 缺少成本估算，NAT、日志、跨区流量导致预算爆炸。

### 防遗漏清单
- 已确认 Terraform/OpenTofu 版本、provider lock、backend、workspace、账号、区域。
- 已确认 plan 与 apply 使用同一 commit、同一变量、同一 backend、同一身份，apply 消费同一已审批 plan artifact。
- 已列出 create/update/replace/delete/destroy、replacement destroy、target 使用和 force_new 原因。
- 已审 import blocks、moved blocks、for_each key stability、prevent_destroy、ignore_changes。
- 已审 remote state data source、跨账号 provider alias、module 版本和锁文件。
- 已审策略扫描、例外生命周期、成本影响、标签/预算 gate、回滚路径、state 备份和锁处理。
- 已审 secrets/state 敏感数据、outputs、日志/artifact 脱敏与访问审计。
- 已审迁移场景中的 CLI/registry/backend/lineage/serial、旧入口停用和 no-op plan。

## 输出要求

1. 必须给：目标 slug/模块、环境、workspace、backend、账号/区域、Terraform/OpenTofu 版本、provider/module 版本。
2. 必须给：plan/apply 证据；未执行时写“未跑”，不得写已验证。
3. 必须给：资源动作表，至少包含地址、动作、原因、风险、是否破坏性、是否需审批。
4. 必须给：state/lock 影响，包含是否改 state、是否解锁、是否备份、serial/lineage 是否变化。
5. 必须给：CI/CD 证据，包含 plan artifact、审批、并发锁、runner 身份、apply 是否消费同一 plan。
6. 必须给：安全/合规/成本结果，包含 Sentinel/OPA、tfsec/checkov、tagging、预算/成本估算或例外。
7. 必须给：secrets/state 敏感数据处理，包含输出脱敏、artifact 可见范围、state 访问审计。
8. 必须给：destroy 分级、target 使用、prevent_destroy 解除条件、备份和 break-glass 审批。
9. 必须给：迁移验证字段，包含 CLI/registry/backend、lineage/serial、旧入口停用、no-op plan。
10. 必须给：回滚或 roll-forward 步骤，说明 Terraform 无通用自动回滚时的人工兜底。

## 约束

- 禁止未读 backend/state/workspace 就改 Terraform。
- 禁止把 plan 当 apply 结果；禁止把 refresh-only plan 当业务变更验证。
- 禁止在同一变更里混合 import、moved、provider 大升级和业务资源变更，除非拆步骤并逐步给证据。
- 禁止把密钥、token、私钥、明文 tfvars 提交到仓库或输出到报告。
- 禁止无 WHERE/无确认地改远端 DB；Terraform 外的数据修复交给 db 或后端链路。
- 禁止绕过 prevent_destroy、策略门禁、审批流程来追求一次 apply 通过。
- 禁止 apply 未消费同一已审批 plan artifact；禁止并发 apply 未隔离；禁止用重新 plan 掩盖审批差异。
- 禁止把敏感 state、plan、output、tfvars、日志 artifact 公开或长期无审计保存。
- 禁止无分级、无备份、无审批地执行全量 destroy、targeted destroy 或解除 prevent_destroy。
- 禁止迁移后旧 CI/backend 入口继续可写；必须证明旧入口停用和新入口 no-op。
- 禁止本地 state 操作生产资源；必须使用受控 remote backend 和审计身份。

## 高频 Bug 反例库

- 反例 1：错法 / 对法 / 根因：只看 .tf diff 就说安全 / 必须读 backend、workspace、plan JSON、provider lock / Terraform 结果由变量、状态和 provider 共同决定。
- 反例 2：错法 / 对法 / 根因：本地 init 默认 backend 后 plan 生产 / 必须确认 remote backend 和 state key / backend 错就是对错环境动刀。
- 反例 3：错法 / 对法 / 根因：provider lock 不提交 / 必须提交并审查 lock diff / provider 小版本会改变默认值、读模型和 ForceNew。
- 反例 4：错法 / 对法 / 根因：for_each key 用显示名 / 必须用不可变业务 ID 并维护 for_each key stability / key 变化等同地址变化。
- 反例 5：错法 / 对法 / 根因：重命名 module 不写 moved blocks / 必须写旧地址到新地址映射并验证 no-op plan / Terraform 无法自动理解重构意图。
- 反例 6：错法 / 对法 / 根因：import blocks 后立即改规格 / 必须先导入到 no-op 再分步变更 / 接管与改造混在一起会误 replace。
- 反例 7：错法 / 对法 / 根因：state lock 卡住就 force-unlock / 必须确认锁来源、CI 状态、操作者和 state 备份 / 活跃 apply 被解锁会损坏 state。
- 反例 8：错法 / 对法 / 根因：drift 一律 ignore_changes / 必须确认 drift 来源、owner、过期时间 / ignore_changes 会长期掩盖真实风险。
- 反例 9：错法 / 对法 / 根因：关键数据库未加 lifecycle prevent_destroy / 必须对数据资源加 prevent_destroy 并列审批 / 误 destroy 不是普通回滚能恢复。
- 反例 10：错法 / 对法 / 根因：module source 指向 main / 必须 pin module versioning 到 tag/commit / 浮动 module 让 plan 不可复现。
- 反例 11：错法 / 对法 / 根因：multi-account module 未传 provider alias / 必须显式 providers 映射并核对账号 ID / 默认 provider 会把资源建错账号。
- 反例 12：错法 / 对法 / 根因：ephemeral credentials plan 后过期再 apply / 必须同一身份窗口内执行或重跑 plan / 身份变化会改变权限和数据源结果。
- 反例 13：错法 / 对法 / 根因：只看 terraform plan 文本 / 必须解析 plan JSON 标 destroy/replace/unknown / 文本易漏嵌套动作和敏感变化。
- 反例 14：错法 / 对法 / 根因：tfsec/checkov 报告只贴通过 / 必须列规则 ID、资源地址、例外 owner / 安全门禁没有可追溯证据。
- 反例 15：错法 / 对法 / 根因：OpenTofu 与 Terraform 混用 state / 必须确认 CLI、provider registry、backend 兼容策略 / fork 后生态和锁文件语义可能分化。
- 反例 16：错法 / 对法 / 根因：审批 plan 后 apply 重新生成 plan / 必须保存不可变 plan artifact 并让 apply 消费同一文件 / 变量、身份、数据源会在两次 plan 间变化。
- 反例 17：错法 / 对法 / 根因：两个 CI 同时 apply 后手工 force-unlock / 必须确认并发组、锁来源、CI 状态和 state 备份 / 活跃写入被打断会损坏 state。
- 反例 18：错法 / 对法 / 根因：把敏感 output 给下游和日志 / 必须用 secret 系统传递并限制 state/artifact 访问 / Terraform state 不是密钥分发系统。
- 反例 19：错法 / 对法 / 根因：用 terraform destroy 或 target 快速修复单点 / 必须分级审批、备份并复跑全量 plan / target 和 destroy 会隐藏依赖影响。
- 反例 20：错法 / 对法 / 根因：backend 迁移只改配置 / 必须校验 lineage/serial、no-op plan 并停用旧入口 / 双写或旧定时任务会让 state 分叉。
- 反例 21：错法 / 对法 / 根因：module 输出随意改名 / 必须做版本语义、消费者盘点和弃用窗口 / 跨 state 输出是发布契约。
- 反例 22：错法 / 对法 / 根因：policy 例外永久放行 / 必须记录 owner、到期日和补偿控制 / 例外失控等同策略失效。
- 反例 23：错法 / 对法 / 根因：只审资源数量不审成本 / 必须估算 NAT、日志、存储、跨区流量和规格 diff / IaC 小 diff 也可能造成持续账单风险。

## 提交前自检清单

- [ ] Terraform 1.6、Terraform 1.7、Terraform 1.8 或 OpenTofu 版本已记录，CI 与本地一致或差异已说明。
- [ ] remote backend、state locking、workspace、state key、账号/区域、provider alias 已确认。
- [ ] provider lock、module versioning、变量来源、tfvars、环境覆盖已审。
- [ ] plan JSON 已审 create/update/replace/delete/destroy/unknown/sensitive，破坏性动作、target 和 destroy 分级已单列。
- [ ] import blocks、moved blocks、for_each key stability、lifecycle prevent_destroy、ignore_changes 已审。
- [ ] drift 来源、state 备份、lock 处理、apply 身份、ephemeral credentials 已审。
- [ ] Sentinel/OPA、tfsec/checkov、密钥扫描、成本估算、标签 gate、预算影响已审。
- [ ] CI plan artifact、审批门、并发锁、apply 同 plan、runner 身份和审计留存已审。
- [ ] secrets/state 敏感数据、outputs、tfvars、日志/artifact 脱敏与访问审计已审。
- [ ] 迁移场景的 CLI/registry/backend、lineage/serial、旧入口停用和 no-op plan 已审。
- [ ] 回滚/roll-forward、审批、发布窗口、人工兜底已写清。

## 2024-2026 新坑速查

- Terraform 1.6/1.7/1.8 与 OpenTofu 并存：CLI、provider registry、lock file、backend、CI 镜像必须固定，避免团队混用。
- import blocks 常态化后，接管资源要先 no-op，再改业务字段；不要把 import 当一次性命令日志丢失。
- moved blocks 是模块重构首选证据；没有 moved blocks 的地址变化默认按删除/新建处理。
- provider lock 在多平台 CI 中可能出现 platform hash 差异；升级必须审 lock diff。
- for_each key stability 是资源地址稳定性核心；可变名称、排序列表、拼接环境名都可能导致批量替换。
- ephemeral credentials/OIDC 普及后，plan/apply 跨 job 身份可能不同；必须记录账号 ID 和角色。
- plan JSON 是自动审计、策略门禁和审批机器可读入口；只贴文本不够。
- Sentinel/OPA 与 tfsec/checkov 分工不同：前者偏组织策略，后者偏静态 IaC 风险，不能互相替代。
- drift 可能来自云厂商默认值、Kubernetes controller、手工控制台、provider 读模型变化；先归因再收敛。
- remote backend state locking 在对象存储、表锁、云原生 backend 上语义不同；force-unlock 前必须确认锁仍在。
- module versioning 与供应链风险绑定；私有 module 要有 tag、review、checksum 或可信来源。
- multi-account landing zone 中 default provider 是高危隐患；module 必须显式传 alias。
- CI/CD 中 plan artifact 是审批边界；apply 重新 plan、手工 apply、并发 apply 都会破坏证据链。
- state 与 plan artifact 可能包含敏感值；加密、最小权限、脱敏、保留期和访问审计必须一起设计。
- destroy、target、解除 prevent_destroy 都属于 break-glass 范畴；必须分级、备份、审批、复盘。
- Terraform/OpenTofu、provider namespace、backend 或 TFC/E 迁移后，要验证 no-op plan 并停用旧写入口。
- 成本门禁要进入 plan 审批；标签缺失、预算超阈值、大规格和跨区流量应阻断或升级审批。

## 与相邻技能的边界

- 云原生 / cloud-native（cld）：Kubernetes/Helm/GitOps 运行时、Events、Pod、Ingress、Service Mesh 归 cld；用 Terraform 管理集群/IAM/addon/backend/state 归 iac-terraform，运行时异常需联动。
- DevSecOps / devsecops（dso）：SAST/DAST/SBOM/供应链/安全治理归 dso；Terraform 中 Sentinel/OPA、tfsec/checkov、IAM 最小权限和策略例外证据归 iac-terraform，重大安全风险联动。
- 发布部署 / release-engineering（rls）：发布窗口、灰度、artifact、CI/CD 编排和回滚指挥归 rls；Terraform plan artifact、apply 同 plan、state lock、基础设施变更证据归 iac-terraform，流水线制度需联动。
- FinOps 云成本 / finops（fop）：预算、归因、showback/chargeback、unit economics 归 fop；Terraform 资源规格、标签、成本估算、预算 gate 和变更前成本影响归 iac-terraform，成本模型需联动。
- 后端工程 / backend-engineering（be）：应用 API、业务状态机、DB 事务、服务代码归 be；应用依赖的云资源、网络、IAM、Secrets 引用和 IaC 输出归 iac-terraform。
- 代码审计 / code-audit（aud）：最终代码风险收口归 aud；Terraform 领域内的 state/backend/plan/provider/module 特有风险先由 iac-terraform 给证据。
- 测试验证 / test-engineering（tst）：测试矩阵、回归和 CI 证据归 tst；Terraform 的 plan JSON、drift、策略扫描、no-op plan 是输入证据。