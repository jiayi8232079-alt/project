---
name: reverse-engineering-automation
description: 授权逆向自动化与批量证据流水线技能，用于编排 IDA、Ghidra、rizin、objdump、readelf、nm、strings 等工具，产出可复现的元数据、符号、字符串、导入、反编译、差异和三角验证报告。
---

# 逆向自动化与批量证据流水线

## 定位 / 适用范围

逆向自动化与批量证据流水线（reverse-engineering-automation，兼容 slug: revauto）只处理已授权样本上的离线、只读、可复现逆向自动化。它的目标不是替代人工逆向，而是把重复性抽取、批量分流、差异对比、证据归档和复验流程做成稳定 pipeline。

适用：

- 对授权二进制、库、固件内样本、崩溃关联文件、补丁前后版本或内部交付物做批量 triage。
- 编排 IDA/IDAPython、Ghidra Headless/PyGhidra、rizin/r2pipe、objdump、readelf、nm、strings、capa、YARA、BinDiff/Diaphora 类工具。
- 批量抽取文件身份、SHA256、格式、架构、入口点、节区、符号、字符串、导入导出、编译器痕迹、打包迹象、反编译片段和规则命中。
- 生成可复验的 JSON/JSONL/CSV/SARIF、证据索引、差异报告、失败样本清单、工具版本矩阵和人工复核记录。
- 为 binrev、asmrev、diffrev、crashrev、fwrev、malrev、linuxrev、winrev、macrev 等子技能提供证据包。

不适用：

- 只读学习、概念解释、项目上手、单样本手工分析或普通 CI/脚本流水线。
- 没有授权主体、样本来源、合法目的、允许动作和停止条件的请求。
- 自动化攻击、漏洞利用流水线、真实目标扫描、规避检测、绕过保护、凭据收集、恶意样本执行或联网回连。
- 泛用数据清洗、普通构建部署、普通测试脚本、普通日志分析和不涉及逆向工具/样本的自动化。

## 铁律

1. 授权先行：未确认授权主体、样本来源、允许动作、禁止动作、隔离要求、数据留存、共享对象和停止条件，不写也不运行 pipeline。
2. 目标清单先行：必须先有目标清单、样本清单、工具清单、输出清单和排除清单；清单外样本、工具、网络和动作一律不跑。
3. 只读默认：输入样本只读挂载；脚本不得 patch、改写、执行样本、联网探测、连接真实目标或调用外部未知服务。
4. 禁止攻击化：不得把 pipeline 做成自动化攻击、扫描、爆破、漏洞利用、绕过保护、规避检测、凭据收集、数据窃取或真实目标交互工具。
5. 版本固定：工具、插件、规则、容器镜像、脚本、schema 和操作系统基线都要锁定并记录；diff 前必须解释版本漂移风险。
6. 证据可追溯：每条结果必须绑定样本 SHA256、工具名称、工具版本、脚本版本、参数、运行环境、时间戳和证据编号。
7. 失败显式化：unsupported、timeout、tool-crash、decode-error、decompile-failed、corrupt、skipped 都是结果，不得吞成“无发现”。
8. 缓存可解释：缓存键至少包含样本 SHA256、工具版本、规则版本、脚本版本和关键参数；缓存命中也要可审计。
9. 审计日志不可省：入队、去重、跳过、缓存命中、工具运行、重试、人工复核、报告生成和归档都要有 actor、时间、原因和证据编号。
10. 去武器化输出：自动化产物只给防御证据、阻塞原因、复验路径和脱敏上下文，不给批量攻击、绕防护、利用链、规避检测或凭据使用步骤。
11. 三角验证：高影响结论至少用第二工具、人工抽样、fixture、版本 diff、原始字节证据或运行日志补证。
12. 安全收敛：遇到攻击自动化、漏洞利用、规避检测、凭据提取、未授权扫描、保护绕过或真实目标交互，停止并拒绝。
13. 真实验收门禁：没有 fixture/golden、schema 校验、沙箱断网、并发/重试上限、审计日志、归档校验和去武器化检查的通过证据，不得宣称流水线可用。

## 快速总则

- 先清单后工具：先建立样本 manifest，再选择工具链；没有样本清单就没有批量结论。
- 先轻后重：file/readelf/objdump/nm/strings 先跑；只有需要 CFG、交叉引用、类型和伪代码时才上 IDA/Ghidra/rizin。
- 先 schema 后脚本：先定义字段、错误码、证据编号、脱敏策略、去重键、缓存键和报告结构。
- 先 fixture 后批量：用 3 到 10 个代表性样本验证字段完整性、超时、异常路径、资源峰值和可复现性。
- 先证据后判断：工具标签是线索，不是事实；报告必须区分已验证、推测和无法验证。
- 先隔离后并发：重型反编译必须有 CPU/内存/磁盘限制、并发上限、超时和重试上限。
- 先队列后执行：样本必须从冻结 manifest 进入队列；队列状态、优先级、重试次数和跳过原因都要落日志。
- 先去重后分析：以 SHA256 为主键，必要时补 size、file_type、container_path、build_id 或 code section hash；重复样本复用证据但保留来源映射。
- 先验收后扩容：CI 或小批验收通过后再扩大批量；验收失败只修 pipeline，不扩大样本规模。

## 强制流程

### 1. 授权与范围确认

- 记录授权主体、样本来源、合法目的、允许工具、允许动作、禁止动作、网络策略、数据留存、共享对象和停止条件。
- 写出目标清单：输入根目录、允许扩展名、最大样本数、最大单样本大小、平台/架构范围、排除路径、输出目录、报告受众和验收口径。
- 写出边界清单：禁止执行样本、禁止联网、禁止扫描真实目标、禁止收集凭据、禁止上传未知服务、禁止 patch 绕过、禁止把规则命中当漏洞利用入口。
- 明确是否允许动态执行。revauto 默认不执行样本；若确需动态行为，转 debugrev/malrev/revlab，并保留隔离和授权门禁。
- 无授权或授权模糊时，只能给通用防御流程和证据结构，不处理具体样本。

### 2. 样本 manifest 建档

- 每个样本至少记录：sample_id、path、sha256、size、mtime、file_type、platform、arch、source、scope、status、evidence_dir。
- 原始样本与工作副本分离；原始样本只读，所有工具输出写入独立 evidence 目录。
- 对重复样本、损坏样本、超大样本、加密/压缩容器和不支持格式单列状态。
- 样本队列字段至少包含 queue_id、sample_id、priority、state、attempt、max_attempts、next_action、blocked_reason、assigned_tool、created_at、updated_at。
- 队列状态限定为 queued、running、cached、done、skipped、failed、quarantined、manual_review；禁止用自由文本替代状态机。
- 队列入口必须可重放：入队来源、授权批次、过滤规则、去重决策、优先级来源和隔离原因都要落入 queue.jsonl 或 audit.jsonl。
- 哈希去重先按 SHA256 合并；容器内文件、fat binary、多架构切片和重打包样本要补 container_path、slice_id、offset、length 或 secondary_hash，避免误合并。
- 去重不等于丢证据：重复样本仍记录所有来源、路径、提交批次、授权范围和引用到的 canonical_sample_id。

### 3. Pipeline 设计

- 明确目标：批量分流、符号/字符串/导入抽取、反编译索引、规则命中、版本 diff、补丁比较、崩溃关联、供应链组件识别或证据归档。
- 选择最小工具链：轻量 CLI 负责基础元数据；IDA/Ghidra/rizin 只负责需要深层程序结构的字段。
- 定义输出：JSONL 适合批量明细，CSV 适合矩阵，SARIF 适合审计集成，Markdown/HTML 适合人工报告。
- 定义错误码：success、skipped、unsupported、timeout、tool_error、parse_error、decompile_missing、verification_failed。
- 定义重试策略：timeout 最多一次降并发重跑，tool_error 最多一次重建临时工作区，网络或外部服务默认禁止，parse_error 和 unsupported 不盲目重试。
- 定义并发策略：按工具、样本大小和内存预算分队列；全局并发、单工具并发、单样本超时、批次超时和失败熔断阈值都要写入配置。
- 定义复现目录：inputs、work、cache、logs、raw、normalized、reports、indexes、fixtures、quarantine 分离；原始样本只读，派生物不得回写输入目录。
- 定义报告索引：每条发现必须有 finding_id、sample_id、evidence_id、tool_run_id、confidence、status、reviewer、复核路径和附件相对路径。
- 定义审计日志：audit.jsonl 至少记录 event_id、event_type、actor、sample_id、tool_run_id、decision、reason、input_hash、output_hash、timestamp。
- 定义归档策略：每个批次冻结 manifest、配置、工具版本、脚本哈希、schema、日志、报告和校验和；归档包必须可按 batch_id 重放或解释不可重放原因。
- 定义工具版本矩阵：tool_name、tool_version、build_id、plugin/rule_version、container_digest、os_base、runtime_version、license_mode、script_hash、collected_at 和 verified_by 缺一项就标 incomplete。
- 定义真实验收门禁：fixture 覆盖、golden 输出、schema 校验、队列状态机、去重映射、沙箱策略、并发限制、失败重试、误报复核、审计日志、归档校验和去武器化输出都要有可查证结果。

### 4. 工具编排规则

- IDA/IDAPython：固定 IDA 版本、license/批处理模式、处理器、分析选项、加载参数、插件版本和脚本哈希；记录数据库路径、函数数、失败函数、日志和退出码。
- Ghidra/PyGhidra：固定 Ghidra/JDK 版本、project 目录、analyzer 选项、language/compiler spec、headless 参数、project 清理策略和 import 日志。
- rizin/r2pipe：固定 rizin 版本、分析深度、命令序列、JSON 输出模式、超时和退出码；输出保留原始 JSON 片段和标准化字段。
- readelf/objdump/nm/strings：记录 binutils 或 LLVM 版本、目标格式、编码策略、字符串长度阈值、节区过滤、demangle 选项和 strip 降级逻辑。
- capa/YARA/自研规则：记录规则版本、规则 ID、命中地址、上下文、适用平台和误报风险；命中只作为 triage 线索。
- diff 工具：先比较元数据、符号、字符串和导入，再升级到函数匹配、CFG、伪代码片段或 BinDiff/Diaphora 结果。
- 工具链顺序默认是 sha256/file 基线、readelf/objdump/nm/strings 轻量抽取、rizin 结构化补强、Ghidra/IDA 深层索引、规则命中、diff、报告索引；任一阶段失败都要保留 stage 状态。

### 5. 批量执行

- 批次维度记录 batch_id、输入清单版本、工具链版本、脚本版本、开始/结束时间、并发数、超时、缓存命中率和资源峰值。
- 对每个阶段输出 stage 状态，避免“整体成功”掩盖局部失败。
- 执行前创建只读输入挂载和无外网沙箱；临时目录、cache、project、日志和报告目录分开限额，批次结束后按留存策略清理。
- 沙箱隔离必须可验证：记录网络策略、挂载模式、用户权限、临时目录配额、CPU/内存/磁盘上限、外部服务白名单和违规事件处置；默认白名单为空。
- 入队前执行去重、授权范围过滤、大小/类型过滤和路径排除；过滤结果必须进 failures 或 skipped 明细。
- 重试必须有限制；同一错误多次出现时停止扩大批量，先修 schema、超时、编码或工具配置。
- 失败重试必须按错误分类：timeout 可降并发或延长一次，tool_error 可重建临时 project 一次，parse_error 不盲目重试，unsupported 直接归档，corrupt 进入隔离清单。
- 每个工具都有 wall-clock timeout、CPU/内存/磁盘上限、最大日志大小、最大输出文件大小和硬停止策略；超限时保留部分输出并标记不完整。
- 并发策略按工具分层：轻量 CLI 可高并发，IDA/Ghidra/rizin 低并发并限制内存和磁盘。
- 缓存必须分层：raw 工具输出缓存、normalized 字段缓存、report/index 缓存分开；schema、脚本或工具版本变化时只复用可证明兼容的层。
- 熔断条件必须明确：授权范围异常、沙箱逃逸迹象、样本试图联网、失败率超过阈值、日志出现敏感数据、工具版本漂移或输出 schema 破坏时停止批次。

### 6. 三角验证

- 元数据字段用至少两种来源交叉：file/readelf/objdump、loader 记录、工具数据库或人工抽样。
- 反编译结论用地址、函数名、伪代码片段、反汇编片段、调用关系或原始字节证据补证。
- 规则命中用命中位置、上下文、导入/字符串/调用链或人工复核说明验证。
- diff 结论要区分真实变化、符号漂移、编译器噪声、优化级别、LTO/PGO、strip、packer 和工具版本差异。
- 三角验证最小组合：基础元数据用 readelf/objdump/rizin 三选二；字符串/导入用 CLI 与反编译器数据库互证；高风险规则命中必须加人工抽样或原始字节证据。

### 7. 批量误报控制

- 规则命中默认是候选，不是结论；报告字段必须包含 confidence、evidence_count、triangulated、false_positive_reason 和 needs_manual_review。
- 对 packer、strip、混淆、LTO/PGO、跨编译器、第三方库和测试样本单独标记噪声来源，避免把环境差异写成业务变化。
- 批量统计必须显示覆盖率：总样本、成功、失败、跳过、超时、不支持、待人工复核、已确认误报、无法验证。
- 高影响发现按抽样策略复核：每类规则至少抽样，关键样本全量复核；抽样比例、样本选择和复核人写入报告索引。
- 人工复核必须产生 review_state：unreviewed、confirmed、false_positive、needs_more_evidence、out_of_scope；复核意见不得覆盖原始工具证据。
- 误报库按 rule_id、tool_version、sample_family、noise_source、false_positive_reason 和修正规则记录；同类误报再次出现时先引用历史复核，再决定是否升级。

### 8. 报告与归档

- 交付机器可读明细、人工摘要、报告索引、证据索引、失败清单、复验摘要、环境矩阵、限制说明和下一步分流建议。
- 报告索引至少包含 samples.jsonl、queue.jsonl、tool_runs.jsonl、findings.jsonl、evidence.jsonl、failures.jsonl、reviews.jsonl、audit.jsonl、triage.csv、summary.md 和 replay.md。
- 敏感字符串、token、cookie、私钥、账号、客户路径和个人数据必须脱敏、哈希化或以证据编号引用。
- 报告不能只写统计数；关键发现必须能跳回样本、地址、工具输出、日志和复核记录。
- 去武器化报告必须删除可直接复用的攻击步骤、批量扫描参数、绕防护细节、payload、真实目标标识和可用凭据；保留防御性描述、影响范围、证据编号和合法补证路径。
- 长期归档必须包含 hash manifest、SBOM/工具版本矩阵、schema 版本、批次配置、验收记录、复核记录和清理/共享限制；归档包不得包含明文敏感数据。
- 归档读回必须验证：归档包清单、文件校验和、schema 版本、报告索引、工具版本矩阵、审计日志尾记录和脱敏扫描结果必须能从 batch_id 找回。

### 9. 真实验收门禁

- 验收只能在离线 fixture 或授权小批样本上做；不得为了验收连接真实目标、执行样本、扫描网络、更新规则云端或上传未知服务。
- fixture 至少覆盖 success、cached、timeout、unsupported、corrupt、tool_error、parse_error、manual_review 和 sensitive_redaction；缺场景要写明未覆盖。
- golden 输出至少覆盖 samples、queue、tool_runs、findings、evidence、failures、reviews、audit 和 summary；字段漂移必须失败，不得自动兼容后继续扩容。
- 批量门禁必须检查总样本数、去重前后数量、跳过/失败原因、重试次数、并发峰值、资源峰值、缓存命中率、误报复核覆盖率和归档校验和。
- 安全门禁必须检查无外网、只读输入、无样本执行、无 patch 绕过、无 exploit/payload、无绕防护步骤、无明文凭据和无真实目标标识。
- 失败门禁必须保留失败样本、错误码、最后一次日志、重试决策、熔断原因和下一步人工动作；不能只给“失败 N 个”。
- 验收通过才允许扩大批量；任一门禁失败时只能修 schema、队列、隔离、资源、重试、脱敏或报告，不得继续扩大样本规模。

## 场景执行卡

### 批量元数据 triage

- 目标：快速建立授权样本集合的结构化索引。
- 工具：file、sha256sum、readelf、objdump、nm、strings、rizin、签名/证书解析器。
- 必查：重复样本、平台架构、入口点、节区、导入导出、符号状态、打包迹象、异常文件和失败状态。
- 输出：样本矩阵、字段覆盖率、失败列表、分流建议和证据目录。

### 符号 / 字符串 / 导入流水线

- 目标：稳定抽取供应链、组件识别、攻击面枚举或回归对比所需字段。
- 工具：nm、readelf、objdump、strings、rizin、Ghidra、IDA。
- 必查：编码、长度阈值、去重、脱敏、动态导入与静态符号区分、strip 样本降级策略。
- 输出：标准化数据、原始证据引用、过滤规则、误报风险和抽样复核记录。

### IDA / Ghidra / rizin 反编译证据

- 目标：批量索引函数、交叉引用、调用图、伪代码片段、类型线索和失败函数。
- 工具：IDAPython、Ghidra Headless、PyGhidra、rizin/r2pipe。
- 必查：工具版本、分析参数、数据库缓存、反编译失败、地址映射、函数重命名和脚本异常。
- 输出：函数级明细、伪代码证据编号、失败原因、抽样准确率和复验步骤摘要。

### 差异报告 pipeline

- 目标：比较补丁前后、版本变更、平台构建、供应链组件或崩溃关联样本。
- 工具：元数据 diff、符号/字符串/import diff、BinDiff、Diaphora、Ghidra Version Tracking。
- 必查：样本是否可比、工具版本是否一致、编译器噪声、优化级别、unmatched function 和低置信匹配。
- 输出：变化矩阵、关键函数/导入/字符串差异、可信度、无法归因项和 diffrev 入口。

### 规则命中复核

- 目标：把 capa/YARA/自研规则命中转为可审计线索。
- 工具：capa、YARA、内部规则引擎、反汇编/反编译证据。
- 必查：规则版本、命中地址、上下文、适用平台、packer/混淆影响和高影响误报。
- 输出：命中矩阵、证据引用、误报风险、人工复核项和规则改进建议。

### 可复现归档

- 目标：让同一输入在同一环境下能重放，换环境时能解释漂移。
- 工具：容器/VM、锁定依赖、版本清单、日志、manifest、hash 校验和报告生成器。
- 必查：工具版本、插件版本、JDK/Python/binutils 版本、脚本哈希、schema 版本、缓存键、输入哈希、输出哈希和清理策略。
- 输出：复验包、环境矩阵、不可复现项、漂移风险和长期留存说明。

### CI / 批量验收

- 目标：在不接触真实目标、不执行样本、不联网的前提下验证 pipeline 可重复、可审计、可失败。
- 工具：小型授权 fixture、golden JSONL、schema 校验、hash 校验、沙箱策略检查、资源限制检查、版本矩阵检查、误报库回归和报告索引检查。
- 必查：0 明文敏感数据、0 未授权路径、0 schema 漂移、0 未分类失败、0 fenced 攻击步骤、0 绕防护步骤、输出可从 finding 追到 evidence、tool_run、queue 和 audit。
- 输出：CI 摘要、fixture 覆盖率、失败路径样例、资源峰值、并发上限、重试统计、归档校验和和人工复核抽样结果。

## 验证门禁

交付前必须满足：

- 授权、样本来源、允许动作、禁止动作、隔离、留存、共享和停止条件已记录。
- 目标清单、边界清单、样本清单、工具清单、输出清单和排除清单已冻结。
- 样本 manifest 完整，所有结果绑定 SHA256、工具版本、脚本版本、参数、环境和时间戳。
- 输出 schema、错误码、缓存键、去重键、证据编号和脱敏规则已定义。
- 至少一轮 fixture 或小批样本试运行完成，失败路径、超时和资源峰值可见。
- 高影响结论有第二证据源或人工抽样；孤证必须标为推测。
- 批量误报控制已执行，规则命中、diff 变化和反编译推断都有可信度和人工复核状态。
- 报告索引可从 finding_id 追到 sample_id、tool_run_id、evidence_id、原始输出、标准化结果和复验命令。
- 审计日志可追踪入队、去重、执行、缓存、重试、失败、人工复核、归档和共享动作。
- CI 或小批验收已覆盖 schema、队列状态、并发限制、失败重试、沙箱策略、去武器化输出和敏感数据脱敏。
- 日志、报告和结构化输出不含未脱敏凭据、私钥、token、cookie、个人数据或客户敏感数据。
- pipeline 不包含样本执行、真实目标扫描、联网回连、保护绕过、exploit 生成、规避检测或凭据收集。
- 已列出失败样本、无法验证项、工具限制、性能边界和后续子技能入口。

## 输出要求

最小交付包括：

1. 任务摘要：目标、授权范围、样本集合、允许/禁止动作、隔离策略、网络策略和停止条件。
2. 样本 manifest：sample_id、SHA256、大小、类型、平台、架构、来源、状态和证据目录。
3. Pipeline 说明：阶段图、样本队列、哈希去重、工具链、版本、脚本版本、参数、并发、超时、缓存、schema 和脱敏策略。
4. 结果摘要：成功/失败/跳过数量、关键发现、异常样本、规则命中、diff 重点和分流建议。
5. 证据索引：原始输出、标准化结果、日志、审计日志、截图、人工抽样、失败记录和复验路径。
6. 三角验证：每个关键结论的证据源、可信度、误报复核、推测项和无法验证项。
7. 报告索引：samples、tool_runs、findings、evidence、failures、triage、summary、replay 的路径和字段说明。
8. 安全留存：敏感数据处理、清理策略、共享限制、去武器化处理和已拒绝的高风险动作。
9. 后续入口：需要 rev、binrev、asmrev、diffrev、crashrev、fwrev、malrev、debugrev、rev-report 等继续处理的最小任务。

## 安全边界

允许：

- 对授权样本做离线、只读、可复现的元数据、符号、字符串、导入导出、反汇编/反编译索引、规则命中和 diff 证据抽取。
- 编写防御性脚本，提高批量分流、证据一致性、报告生成和回归复验效率。
- 记录保护、混淆、打包、反调试或权限机制造成的分析阻塞证据。
- 在 CI 或离线 fixture 中验证队列、去重、资源限制、失败重试、审计日志、归档和脱敏，不接触真实第三方目标。

拒绝：

- 未授权样本、第三方资产、互联网目标或真实生产系统的自动化扫描、枚举、连接、执行和探测。
- 自动化攻击、漏洞利用流水线、payload 构造、持久化、横向移动、C2、数据窃取或破坏性流程。
- 规避检测、免杀、反沙箱、反调试绕过、授权/DRM/许可检查绕过、二进制 patch 绕过。
- 凭据、token、cookie、私钥、会话、个人数据、客户数据的提取、还原、批量整理或使用。
- 将恶意样本自动执行、联网回连、上传未知云服务或与真实目标交互。
- 以批量化为名输出扫描模板、绕防护参数、漏洞利用步骤、规避检测策略或可直接攻击真实目标的流水线。

安全替代：

- 改为说明合法授权流程、隔离环境要求、可观察指标、阻塞证据和脱敏证据结构。
- 对保护机制只记录存在位置、影响范围、阻塞原因、合法补证路径，不写绕过步骤。
- 对敏感字符串只输出类型、位置、哈希/截断值和证据编号。
- 对用户要求批量攻击或绕防护流水线时，改给授权边界、离线 fixture、沙箱验收、检测规则复核和防御报告模板。

## 反例库

- 把普通 CI 脚本当 revauto：没有逆向样本、逆向工具和证据复验目标时，应转普通开发或 test-engineering。
- 单样本手工分析套批量 pipeline：用户只要读一个函数或一个 ELF 细节时，应转 binrev/asmrev/debugrev 等子技能。
- 先跑上千样本再想 schema：会导致字段漂移、失败不可见和报告不可合并；必须先 fixture。
- 只保存汇总计数：没有 SHA256、地址、工具版本和证据编号，无法复验。
- capa/YARA 命中直接写成事实：规则命中只能是线索，必须补上下文和人工/第二工具验证。
- 超时样本静默跳过：统计会被污染；必须显式输出 timeout 和失败原因。
- 为了提高成功率自动 patch 反调试或授权检查：这越过防御证据边界，应拒绝。
- 敏感字符串原样入库：批量自动化会放大泄露；必须脱敏或哈希化。
- 不锁工具版本做 diff：IDA/Ghidra/rizin/binutils 漂移会制造假变化。
- 报告只有图表没有证据索引：审计者无法复验，交付不合格。
- 队列状态用备注字段随手写：后续无法区分失败、跳过、缓存和人工复核，批量统计不可信。
- SHA256 去重后丢来源：同一个样本来自不同授权批次或客户路径时，审计链断裂。
- 沙箱里允许默认联网：工具插件、规则更新或样本行为可能触达真实目标，必须默认断网并显式白名单。
- 重试无限制：工具崩溃会放大资源消耗和日志污染；必须分类、限次、熔断。
- CI 只跑 happy path：没有 timeout、unsupported、corrupt、schema drift 和敏感数据样例，批量上线必漏。
- 误报复核覆盖原始命中：应新增 review_state 和 false_positive_reason，不能改写 raw evidence。
- 把绕防护细节写进复验步骤：复验只能验证防御证据和阻塞原因，不能变成可复用绕过手册。
- 工具版本矩阵只写“latest”：无法解释 diff 漂移、规则变化和反编译器行为差异，必须记录精确版本、规则版本、脚本哈希和环境基线。
- 队列失败后手工改状态为 done：会污染覆盖率和失败率，必须保留 failed/manual_review 状态和复核动作。
- 批量验收跳过脱敏扫描：日志和字符串表可能泄露凭据或客户路径，验收必须把敏感数据样例放进 fixture。

## 自检清单

- [ ] frontmatter `name: reverse-engineering-automation` 为 canonical；兼容 slug 为 `revauto`，自检不得要求 name 等于短 slug。
- [ ] 全文 500 行以内，优先 0 fenced code block。
- [ ] 授权、来源、允许/禁止动作、隔离、留存和停止条件已确认。
- [ ] 目标清单、工具清单、输出清单、排除清单和授权边界已冻结。
- [ ] pipeline 默认只读，不执行样本，不联网扫描，不 patch 绕过，不生成 exploit，不提取凭据。
- [ ] 样本 manifest 包含 SHA256、大小、来源、平台、架构、状态和证据目录。
- [ ] 工具版本、脚本版本、参数、环境、缓存键、schema 和错误码已记录。
- [ ] 样本队列、哈希去重、并发上限、失败重试、熔断条件、沙箱隔离和审计日志已定义。
- [ ] fixture 或小批试运行已完成，失败和超时可见。
- [ ] 关键结论完成三角验证或标为推测，批量误报控制和人工复核状态已写入报告索引。
- [ ] CI 或批量验收已覆盖 schema、资源限制、失败路径、去武器化输出、归档校验和敏感数据脱敏。
- [ ] 敏感字段已脱敏，报告和日志不含完整秘密或客户敏感数据。
- [ ] 输出包含机器可读明细、人工摘要、证据索引、复验路径、限制和后续分流。

## 相邻技能边界

- 逆向工程总控（reverse-engineering，slug: rev）：逆向总控、授权门禁和子技能路由；revauto 只负责自动化证据流水线。
- 二进制逆向（binary-reverse-engineering，slug: binrev）：单样本二进制结构和 ABI 细节深挖；revauto 只批量抽取入口证据。
- 汇编与指令集逆向（assembly-reverse-engineering，slug: asmrev）：指令级语义、手工追踪和汇编判断；revauto 不替代人工语义分析。
- 动态调试逆向（debug-reverse-engineering，slug: debugrev）：隔离授权动态调试、断点和运行时观察；revauto 默认不执行样本。
- 差分逆向（differential-reverse-engineering，slug: diffrev）：补丁 diff 和版本语义差异；revauto 可生成候选 diff 数据和复验证据。
- 崩溃逆向（crash-reverse-engineering，slug: crashrev）：崩溃 dump、栈和触发路径；revauto 可组织崩溃关联样本元数据。
- 固件逆向（firmware-reverse-engineering，slug: fwrev）：固件拆解和设备上下文；revauto 可批量索引固件内二进制。
- 恶意样本逆向（malware-reverse-engineering，slug: malrev）：恶意样本防御分析语义；revauto 只做授权、隔离、只读证据准备。
- packrev：打包、混淆和保护识别；revauto 记录阻塞证据，不提供绕过自动化。
- linuxrev / winrev / macrev：平台特定加载、导入、权限和符号机制；revauto 提供批量证据。
- protrev / cryptrev / abirev / irrev：协议、密码、ABI、IR 深度分析；revauto 提供候选位置和索引。
- scriptrev：脚本/字节码逆向；revauto 只在其进入批量证据流水线时介入。
- rev-report：最终报告包装和审阅；revauto 负责原始证据、验证矩阵和复验路径。
- code-audit / test-engineering：源码审计和测试验证；revauto 提供证据，不替代风险裁决。