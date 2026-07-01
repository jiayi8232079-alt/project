---
name: data-engineering
description: 数据工程实战排障版 - 面向数据来源接入、数据模型、时序语义、证据链闭环，覆盖 CDC/Debezium、Kafka/Pulsar、Flink/Spark/Beam、Lakehouse Iceberg/Delta/Hudi、dbt、Airflow/Dagster、数据质量、schema evolution、watermark、exactly-once、回填幂等、分区小文件、血缘权限 PII、实时特征和向量数据的实战排障。
alwaysApply: false
---

# Data Engineering实战排障版

> 定位：把数据工程从“任务能跑”收敛到“来源可信、模型清楚、时序正确、证据可复核”。所有结论必须绑定数据来源、数据模型、事件时序、运行证据和消费方影响。
> 铁律：来源不明不接入；模型口径不清不发布；时序语义不明不增量；证据不足不下结论；无幂等不回填；无血缘不宣称零影响。

## 快速总则：来源 / 模型 / 时序 / 证据

1. 来源：先确认系统 owner、表/topic/API、主键、事件时间、更新/删除语义、CDC offset/LSN、schema 版本、权限、PII、retention、重放窗口和 data contract；不把 raw dump 当可信来源。
2. 模型：先确认 grain、主键、唯一性、字段口径、维表慢变、事实修正、消费者、SLA、质量门禁、血缘和发布层级；不把 SQL 能跑当数据产品可用。
3. 时序：先区分 event time、processing time、ingestion time、data interval、watermark、late events、offset、checkpoint、snapshot version、backfill window；不按单 timestamp 增量漏 tie-breaker。
4. 证据：以 run_id、DAG run、query_id、Spark/Flink UI、Kafka/Pulsar lag、checkpoint、dbt artifacts、Great Expectations/Soda 报告、OpenLineage、对账样本、文件清单和账单为准。
5. 版本环境：记录 Kafka/Pulsar、Debezium、Flink/Spark/Beam、Airflow/Dagster、dbt、Iceberg/Delta/Hudi、Parquet/ORC/Avro、catalog、connector、JDK/Python/Scala、云 runtime、region、tenant、时区和权限。
6. 处理语义：exactly-once 必须同时核 source 可重放、state/checkpoint、sink 事务或幂等、offset 提交、重试、回填和消费方去重；单个组件承诺不等于端到端承诺。
7. 验证底线：正常跑、失败重试、重复执行、late events、schema evolution、delete/tombstone、回填幂等、质量失败阻断、权限/PII、成本和下游消费至少说明已验或无法验证。

## 场景执行卡

### 1. 来源接入 / CDC / Debezium / Data Contract
- 输入：源 owner、主键、事件时间、binlog/WAL/LSN、snapshot 策略、delete/tombstone、schema registry、权限、PII、retention、重放能力。
- 动作：版本化 data contract；snapshot 与 incremental 分层；保存 offset/LSN；delete 映射软删/有效期/物理删；Debezium heartbeat、transaction metadata、schema history 单独纳入恢复方案。
- 证据：契约、源样本、schema 版本、CDC 水位、删除样本、重放演练、权限审计、下游确认。
- 兜底：无稳定主键、无事件时间或无删除语义时，只能进隔离区探索表，不发布可信数据产品。

### 2. Kafka / Pulsar / Streaming 摄取
- 输入：topic、key、partition、ordering、retention、consumer group/subscription、schema、ACL、DLQ、backpressure。
- 动作：按业务实体设 key；offset/ack 与 sink 写入绑定；处理重复、乱序、late events、DLQ；Kafka transaction/idempotent producer 或 Pulsar subscription 语义只按边界声明。
- 证据：lag、partition skew、consumer commits/acks、重复样本、DLQ、schema compatibility、回放演练、ACL 审计。
- 兜底：retention 不足、无 key 或 sink 非幂等时，不承诺可重放、顺序正确或 exactly-once。

### 3. 批处理 / Airflow / Dagster 编排
- 输入：DAG/asset、data interval、依赖、pool/queue、资源、补数范围、重试、告警、owner。
- 动作：Airflow/Dagster 只编排和编目，不在 worker/op 内做无边界重计算；task/asset 原子化、幂等、可重跑；parse 阶段避免重 I/O；backfill 先 dry-run。
- 证据：DAG run、asset materialization、task logs、data interval、retry、quality gate、pool/queue、补数记录。
- 验证：正常调度、失败重试、重复执行、依赖缺失、质量失败阻断、手动回填。

### 4. dbt / Analytics Engineering
- 输入：sources、staging、marts、semantic layer/metrics、exposures、owner、target、contracts。
- 动作：source freshness、unique/not null/relationships/accepted values；incremental model 必须有 unique_key、strategy、late data 窗口、全量重建策略和消费者兼容窗口。
- 证据：manifest、run_results、catalog、tests、source freshness、docs、exposures、compiled SQL、merge plan。
- 兜底：无 unique_key、无 late data 策略、测试失败或 exposures 未确认时，不发布增量 mart。

### 5. Spark / Flink / Beam 流批计算
- 输入：bounded/unbounded、state、checkpoint、watermark、trigger、window、key skew、sink、资源、版本。
- 动作：Spark Structured Streaming 配 checkpoint、watermark、output mode、state TTL；Flink 用 durable checkpoint/savepoint 与 backpressure 监控；Beam 明确 runner 差异、windowing、trigger、allowed lateness。
- 证据：Spark UI/query progress、Flink checkpoint/backpressure/savepoint、Beam runner job、state size、watermark lag、shuffle、失败恢复演练。
- 兜底：state schema 或 checkpoint 不兼容时，先测试表/新 checkpoint/受控重放，不直接复用生产状态。

### 6. Lakehouse / Iceberg / Delta / Hudi / Parquet
- 输入：表格式、catalog、partition spec、file size、delete/merge、schema evolution、snapshot、retention、多引擎读写。
- 动作：控制分区与小文件；验证 Iceberg/Delta/Hudi 的 merge/delete/vacuum/clean/compaction；Parquet schema、timestamp、case sensitivity、type widening 按 reader/writer 双向验证。
- 证据：table version/snapshot、manifest/file count、query plan、scan bytes、compaction 记录、retention 配置、回滚/Time Travel 演练。
- 兜底：多引擎兼容、catalog、delete file 或 retention 未验证时，不跨引擎发布。

### 7. 数据仓库 / 湖仓模型与物理布局
- 输入：查询模式、写入模式、并发、增长率、保留周期、权限、成本预算、消费者 SLA。
- 动作：按生命周期和过滤设计 partition；按查询谓词/连接/排序做 clustering/Z-order/sort；冷热分层；避免高基数 partition；列级权限和 PII 脱敏。
- 证据：query plan、bytes scanned、partition pruning、file count、表版本、权限策略、账单、消费者延迟。
- 兜底：无 workload 证据不盲目分区/物化/缓存。

### 8. 数据质量 / Great Expectations / Soda / 对账
- 输入：关键字段、业务约束、freshness、阈值、源目标对账、失败处理、owner。
- 动作：覆盖 schema、not null、unique、accepted values、referential integrity、row count、distribution drift、freshness、duplicate、late events；关键表 quality gate 阻断发布。
- 证据：GE/Soda/dbt tests、失败样本、趋势、告警、豁免记录、对账报告。
- 兜底：质量失败不可静默发布；豁免必须有 owner、期限、影响面和补偿计划。

### 9. Schema Evolution / Contract 变更
- 输入：新增/改名/改类型/删除字段、默认值、兼容策略、reader/writer、BI/ML/API 消费方。
- 动作：兼容矩阵覆盖 Avro/Protobuf/JSON/Parquet、schema registry、dbt contracts、Iceberg/Delta/Hudi evolution、字段级血缘；先 expand 后 contract。
- 证据：schema diff、兼容检查、reader 回归、消费者确认、字段级 lineage、回滚窗口。
- 兜底：只验证 writer 成功不算兼容；下游未确认时不删字段、不改语义。

### 10. 回填 / 重跑 / Incremental Load
- 输入：范围、窗口、分区、批大小、依赖拓扑、下游影响、回滚/补偿、成本上限。
- 动作：先 dry-run；限定 partition/window；merge/upsert 幂等；记录 batch_id/run_id；按血缘拓扑重跑；checksum/row count 对账后发布。
- 证据：dry-run、目标差异、row count、hash/checksum、失败重试、回滚或补偿计划、下游确认。
- 兜底：无法限定范围、无法幂等或无法对账时，先不执行生产回填。

### 11. 血缘 / Catalog / 权限 / PII
- 输入：dataset、job、run、字段映射、owner、敏感分级、访问方、删除/撤回要求。
- 动作：用 OpenLineage、dbt manifest、平台 catalog 记录 job/run/dataset/column lineage；变更前查下游；PII 最小化、脱敏、列级权限、访问审计、retention、删除链路贯通到 raw、logs、feature、vector。
- 证据：lineage graph、run id、dataset version、column mapping、access audit、审批、删除演练。
- 兜底：血缘不完整时，影响面标需验证，不得宣称零影响。

### 12. 实时特征 / 向量数据 / AI 数据产品
- 输入：feature freshness、训练/推理一致性、point-in-time join、embedding 版本、向量索引、权限、删除同步、质量指标。
- 动作：实时特征核 event time、late events、dedupe、TTL、backfill；向量数据核来源、chunk/embedding 版本、metadata filter、删除传播、PII 脱敏和召回质量。
- 证据：feature lineage、training-serving skew、online/offline 对账、embedding version、index build、权限过滤样本、删除同步记录。
- 兜底：未证明 point-in-time correctness、权限隔离或删除同步时，不供模型训练/线上检索。

### 13. 成本 / 性能 / 容量 / 监控
- 输入：扫描量、资源、并发、SLA、保留期、预算、增长率、FinOps 归属。
- 动作：分区裁剪、增量计算、压缩列式格式、compaction、资源队列、自动伸缩、预算告警；优化前后同口径复测。
- 证据：scanned bytes、slot/warehouse usage、Spark/Flink metrics、Kafka/Pulsar throughput、存储增长、账单、告警。
- 兜底：未证明瓶颈前不重构；不为单次查询牺牲主链路正确性和恢复能力。

## 高频坑 / 防遗漏

### 高频坑
1. 只看任务 success，不看 freshness、row count、lag、duplicate、quality gate 和消费者结果。
2. incremental load 只按 timestamp，无 tie-breaker，毫秒相同、时钟回拨或源修正导致漏数。
3. CDC 忽略 delete/tombstone，目标表只增不删。
4. 回填 append 重复，overwrite 又误删非目标分区。
5. Airflow/Dagster task 有副作用，重试重复发消息、导出文件或扣费用。
6. dbt incremental 无 unique_key、late data 策略或全量重建路径。
7. Kafka/Pulsar 无业务 key，实体更新乱序或跨 partition/subscription 语义被误读。
8. Spark/Flink/Beam checkpoint/savepoint/state schema 不兼容仍强行复用。
9. schema drift 只让 writer 通过，下游 BI、reader、质量测试全挂。
10. high-cardinality partition 造成 small files 和 metadata 成本暴涨。
11. Iceberg/Delta/Hudi retention/vacuum/clean 破坏 time travel、审计和回填。
12. 血缘只到表级，字段改名或口径改动后下游静默错。
13. PII 进入 raw/log/vector/feature/export 后无限保留、无限可见。
14. 向量数据或实时特征未记录版本与事件时间，训练/推理口径漂移。

### 防遗漏清单
- 来源：owner、主键、事件时间、更新/删除、schema、contract、PII、CDC 水位、重放窗口是否确认？
- 模型：grain、字段口径、唯一性、质量、血缘、消费者、SLA、发布层级是否确认？
- 时序：data interval、event time、watermark、late events、offset、checkpoint、snapshot、时区是否确认？
- 增量：tie-breaker、幂等、dedupe、merge key、schema evolution、delete 语义是否确认？
- 流处理：Kafka/Pulsar key、lag、retention、DLQ、ack/commit、state、sink 事务是否确认？
- 湖仓：Iceberg/Delta/Hudi catalog、partition evolution、compaction、retention、多引擎读写是否确认？
- 回填：dry-run、范围、分区、批大小、依赖拓扑、回滚、对账、成本上限是否确认？
- 治理：Great Expectations/Soda/dbt tests、OpenLineage/catalog、权限、PII、删除链路、审计是否确认？

## 输出要求

1. 场景卡：命中来源/CDC、Kafka/Pulsar、批处理、流处理、Airflow/Dagster、dbt、Spark/Flink/Beam、Lakehouse、质量、血缘、回填、特征/向量、成本中的哪类。
2. 来源证据：源、目标、owner、主键、事件时间、schema、contract、增量水位、更新/删除语义、PII、消费者。
3. 模型证据：grain、字段口径、唯一性、分层、质量测试、血缘、SLA、发布边界。
4. 时序证据：data interval、event time、processing time、watermark、late events、offset、checkpoint、snapshot、时区。
5. 处理语义：批/流、exactly-once/at-least-once、幂等、重试、DLQ、回填、重跑、sink 事务或去重。
6. 影响面：下游表、BI、ML、实时特征、向量检索、导出、API、权限、catalog、监控、告警、成本和回滚风险。
7. 验证：dry-run、样本对账、全量/增量一致性、失败重试、late events、回填、quality gate、lineage、权限/PII、成本复测。
8. 证据：命令、日志、run_id、query_id、DAG/asset run、dbt artifacts、Spark/Flink/Beam UI、Kafka/Pulsar lag、GE/Soda 报告、OpenLineage、账单。
9. 结论：已验证、部分验证、无法验证、需回滚；必须列缺口和下一步。

## 约束

- 不拿任务成功替代数据正确；必须看 freshness、对账、质量门禁和消费者结果。
- 不把 DB schema 设计、SRE 告警平台、AI 建模、测试工程职责搬进本技能；只给数据工程证据和联动条件。
- 不把 exactly-once 当工具开关；必须覆盖 source、state、sink、offset、事务、重试、回填和消费方。
- 不在无 owner、无 SLA、无质量测试、无血缘的情况下发布核心数据产品。
- 不把 raw zone 当永久垃圾桶；raw 也要权限、保留、PII 分类和生命周期。
- 不为单一查询盲目加 partition、物化或缓存；优化必须绑定 workload、query plan 和成本证据。
- 不在 Airflow/Dagster worker 内做重计算；不在 dbt 中做跨系统长任务；不把 Kafka/Pulsar 当长期唯一事实源而无落地策略。
- 不在未确认下游消费方时改字段、topic、表名、DAG/task/asset id、分区列、契约、权限或保留策略。
- 涉 DB 表结构/SQL/迁移交 db-design；涉平台告警/incident 交 observability-sre；涉性能专项交 perf-engineering；涉 AI/RAG/模型交 ai-engineering；涉后端服务交 backend-engineering；验证矩阵交 test-engineering；最终收口交 code-audit。

## 高频 Bug 反例库

- 反例 1：批处理增量漏数
  - 错法：updated_at > last_run_time，同一毫秒多行或源时钟回拨时漏数。
  - 对法：用 updated_at + primary_key tie-breaker、LSN/offset 或 snapshot version，目标侧 merge 保证幂等。
  - 根因：timestamp 不是稳定全序 watermark。
- 反例 2：流处理迟到数据被丢
  - 错法：watermark 设得过短，late events 直接丢弃且无告警。
  - 对法：按业务延迟分布设 watermark/allowed lateness，迟到侧路输出并对账。
  - 根因：低延迟目标不能替代完整性设计。
- 反例 3：CDC 删除语义缺失
  - 错法：Debezium 只消费 insert/update，忽略 delete/tombstone，目标表长期虚高。
  - 对法：映射删除、软删或有效期，保留 delete 样本和源目标对账。
  - 根因：增量包含新增、更正和删除。
- 反例 4：Kafka exactly-once 误读
  - 错法：开启 idempotent producer 就宣称数据库 sink exactly-once。
  - 对法：核 producer transaction、consumer offset、sink transaction/幂等；否则声明 at-least-once + 去重。
  - 根因：Kafka 内部语义不自动覆盖外部 sink。
- 反例 5：Pulsar ack 与落库脱节
  - 错法：消息处理开始就 ack，落库失败后无法重放。
  - 对法：成功持久化后 ack，失败 negative ack/DLQ，并用业务键幂等。
  - 根因：消息确认点就是恢复边界。
- 反例 6：回填重复或误删
  - 错法：backfill append 产生双份事实，overwrite 又覆盖非目标分区。
  - 对法：限定 window/partition，dry-run 后用业务主键 + batch_id merge/upsert，并 checksum 对账。
  - 根因：回填默认会重跑，必须幂等且可限定范围。
- 反例 7：dbt incremental 口径漂移
  - 错法：mart 改字段含义但 contracts、tests、docs、exposures 和 BI 未更新。
  - 对法：契约版本化，更新测试和文档，通知消费者并保留兼容窗口。
  - 根因：模型发布是数据产品变更，不只是 SQL 变更。
- 反例 8：schema drift 静默破坏下游
  - 错法：writer 自动接收新增/改类型字段，下游 SELECT *、BI 或 reader 错位。
  - 对法：schema compatibility gate、字段级血缘、reader 回归和发布审批。
  - 根因：写入兼容不等于读取兼容。
- 反例 9：Spark checkpoint 复用
  - 错法：改 query/state schema 后沿用旧 checkpoint，恢复失败或产出错乱。
  - 对法：升级前 savepoint/测试表演练，必要时新 checkpoint 并规划重放。
  - 根因：状态是数据契约的一部分。
- 反例 10：Flink sink 非事务却宣称端到端一致
  - 错法：source checkpoint 成功就认为外部 sink 无重复。
  - 对法：确认两阶段提交、幂等 upsert 或外部去重；保存 savepoint 回滚路径。
  - 根因：checkpoint 只覆盖 Flink 状态，不自动覆盖外部系统。
- 反例 11：Beam runner 差异未验证
  - 错法：本地 DirectRunner 通过就推断 Dataflow/Flink/Spark runner 的 trigger 和 state 行为一致。
  - 对法：按目标 runner 验证 window、trigger、allowed lateness、state 和 sink。
  - 根因：Beam 是模型抽象，runner 才是生产语义。
- 反例 12：partition 过细制造 small files
  - 错法：按 user_id 或分钟分区，产生海量小文件和慢 metadata scan。
  - 对法：按日期/租户等生命周期与查询模式分区，高基数字段用 clustering/sort/Z-order。
  - 根因：分区是物理生命周期边界，不是所有过滤字段。
- 反例 13：Iceberg/Delta/Hudi retention 误删可恢复版本
  - 错法：为省存储缩短 vacuum/expire/clean retention，破坏 time travel、审计和回填。
  - 对法：按 SLA、审计、回滚和 backfill 窗口设置 retention，并演练恢复。
  - 根因：存储成本不能压过恢复能力。
- 反例 14：Iceberg REST catalog 跨引擎配置不一致
  - 错法：Spark、Trino、Flink 使用不同 catalog/warehouse/namespace 配置，看到的表版本不一致。
  - 对法：统一 REST catalog、权限、warehouse、branch/tag 和引擎版本，跨引擎读写回归。
  - 根因：catalog 是表格式一致性的控制面。
- 反例 15：PII 扩散到日志、特征和向量库
  - 错法：失败样本、raw、feature、export、embedding metadata 原样保存手机号/邮箱/身份证。
  - 对法：分类分级、脱敏/哈希、列级权限、访问审计、retention、删除/撤回链路。
  - 根因：数据管道复制面广，PII 一旦扩散难治理。
- 反例 16：实时特征训练/推理穿越
  - 错法：训练用未来修正后的维表或特征，线上推理用实时近似，离线指标虚高。
  - 对法：point-in-time join、event time watermark、online/offline 对账和版本化 feature view。
  - 根因：特征正确性首先是时序正确性。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] fenced code block 数量为 0。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 快速总则体现数据工程四要素：来源 / 模型 / 时序 / 证据。
- [ ] 反例不少于 10 条，且每条可被 反例 数字 命中并含错法、对法、根因。
- [ ] 核心关键词覆盖：CDC/Debezium、Kafka/Pulsar、Flink/Spark/Beam、Iceberg/Delta/Hudi、dbt、Airflow/Dagster、Great Expectations/Soda、schema evolution、watermark/late events、exactly-once、回填幂等、分区小文件、血缘/权限/PII、Iceberg REST catalog、向量数据、实时特征。
- [ ] 已明确与 db-design、observability-sre、perf-engineering、ai-engineering、backend-engineering、test-engineering、code-audit 的边界。
- [ ] 未读取、创建或修改本地 skills/ 文件，未使用本地 SQLite；远端 raw 是唯一事实源。

## 2024-2026 新坑速查

- Iceberg REST catalog：多引擎共享 catalog 后，OAuth/credential vending、namespace、warehouse、branch/tag、commit conflict 和权限缓存会成为一致性故障源。
- Lakehouse 表格式竞争：Iceberg/Delta/Hudi 在 delete、merge、schema evolution、partition evolution、time travel、retention、multi-engine 语义上不可互相套经验。
- Spark 4.x Structured Streaming：transformWithState、state schema、checkpoint、Parquet timestamp 和旧 checkpoint 兼容必须演练。
- Flink 2.x / 1.20 LTS：state backend、checkpoint、savepoint、connector delivery 语义和升级兼容需按版本验证。
- Beam runner 差异：DirectRunner 不能代表 Dataflow、Flink、Spark runner；window/trigger/state/timer/sink 语义要按生产 runner 复核。
- Kafka 3.9+/4.x：KRaft、producer idempotence、transactions、consumer group protocol、client/broker 兼容和 tiered storage 行为需核对。
- Pulsar 3.x/4.x：subscription、ack timeout、retry letter、DLQ、schema、tiered storage 和 geo-replication 会改变恢复边界。
- Debezium 2.x/3.x：incremental snapshot、signal table、schema history、transaction metadata、heartbeat 和 connector offset 恢复必须纳入演练。
- Airflow 3 / Task SDK：DAG authoring、provider 兼容、scheduler 行为、dataset-aware scheduling 和动态 DAG 稳定性需按目标版本复核。
- Dagster asset 化：asset partition、freshness policy、sensor、backfill daemon 和 materialization lineage 要与数据产品 owner 对齐。
- dbt Mesh / Semantic Layer：跨团队模型依赖、contracts、exposures、owner、deprecation 和指标口径版本化更关键。
- Great Expectations 1.x / Soda：配置模型、checkpoint、validation definition、scan 口径与旧版本不同；质量失败是否阻断要在编排层验证。
- OpenLineage 1.x：Airflow/Spark/dbt/Flink 集成覆盖不同，字段级 lineage、自定义 operator 和 dataset namespace 需实测。
- Iceberg/Delta/Hudi 小文件治理：流式 upsert、delete file、compaction、clustering、Z-order 会改变读写放大和回滚窗口。
- 向量数据与实时特征：embedding 版本、metadata 权限、删除同步、feature freshness、point-in-time correctness、training-serving skew 是 2024-2026 高频新坑。
- PII / AI 数据集：LLM、向量库、特征工程、日志和导出都可能复制敏感字段，删除、审计、retention 必须贯通。

## 与相邻技能的边界

- data-engineering 负责：数据来源契约、CDC、Kafka/Pulsar 摄取、ETL/ELT、批处理、流处理、Airflow/Dagster、dbt、Spark/Flink/Beam、Lakehouse、质量、血缘、回填、重跑、PII 和数据成本证据。
- db-design 负责：OLTP/OLAP 表结构、字段、索引、SQL、事务、迁移、DB 写安全和数据库级数据修复；数据工程只消费其结构证据和迁移边界。
- observability-sre 负责：服务 SLI/SLO、告警、incident、logs/metrics/traces/profiles、Kubernetes/service mesh；数据工程只定义数据质量、freshness、lag 和 lineage 证据。
- perf-engineering 负责：性能 baseline、profile、瓶颈归因、压测和回归门槛；数据工程只提供扫描量、shuffle、file count、lag、state size、成本等数据链路证据。
- ai-engineering 负责：LLM/RAG/embedding/vector database/agent/eval 安全质量；数据工程只负责向量数据来源、权限、PII、删除同步、特征/训练数据时序正确性。
- backend-engineering 负责：后端服务实现、API/DB/cache/MQ/task/deploy 运行证据；数据工程只处理数据管道、数据产品和批流作业边界。
- test-engineering 负责：测试矩阵、自动化、CI 证据、回归和发布冒烟；数据工程提供应覆盖的数据场景、质量门禁和回填演练要求。
- code-audit 负责：需求对账、影响面、安全质量最终收口和剩余风险判断；数据工程更新完成后按其口径自检证据和边界。
