---
name: llm-eval
description: LLM/agent/RAG/prompt/model 评测技能，覆盖 hallucination、tool-call accuracy、faithfulness、judge prompt、eval dataset、A/B 模型对比和 CI gate；涉及模型或智能体效果评估时使用。
---

# LLM Eval

LLM Eval 负责评估 LLM、Agent、RAG、prompt 和模型变更的效果与风险。目标是把“感觉更好”变成可复验的数据集、指标、评审标准、误差分析和上线门禁。

## 适用范围

- LLM、Agent、RAG、prompt、model eval、hallucination、faithfulness、tool-call accuracy 和 answer quality。
- judge prompt、golden dataset、rubric、human review、pairwise comparison、A/B 模型对比和回归集。
- RAG 检索命中、引用一致性、上下文利用、拒答、越权、工具调用、计划执行和多轮任务成功率。
- CI gate、离线评测、线上抽样、漂移监控、成本/延迟/质量 tradeoff 和发布评估报告。

## 不适用范围

- 普通软件单元测试、接口测试、E2E、覆盖率和回归测试；这些走 test-engineering。
- 普通 AI 工程实现、RAG 后端、向量库、Agent 工具开发和模型服务接入；这些走 ai-engineering。
- 纯 prompt 文案润色、营销文案或单次回答优化，没有评测数据和指标。
- 只读学习、项目上手、仅了解 LLM eval 概念，没有评估、设计、运行或上线门禁动作。

## 铁律

1. Eval 必须先定义任务、用户、失败代价、基线、候选、数据集和上线阈值。
2. 不能只靠一个 judge 分数；关键任务要结合规则指标、人工抽样、误差标签和案例复盘。
3. Judge prompt 本身要评测：一致性、偏置、位置偏差、长度偏差、泄漏、可解释性和复判样本。
4. RAG 评测必须拆开检索、重排、上下文利用、引用真实性和最终回答，不能只看总分。
5. Tool-call eval 必须检查工具选择、参数、调用顺序、错误恢复、权限边界和最终状态。
6. 数据集必须去重、分层、版本化；不能把训练/调参样本当最终验收集。
7. A/B 对比必须固定输入、模型配置、温度、工具、知识库版本和评分口径。
8. CI gate 要有可解释失败样本和豁免流程；不能让随机波动直接阻断所有发布。

## 强制流程

1. 锁定目标：确认要评估的产品任务、模型/agent/RAG/prompt 版本、用户场景和失败代价。
2. 建数据集：收集真实样本、合成边界样本、负例、权限样本、长尾样本和回归样本；记录来源和版本。
3. 定指标：选择准确性、完整性、faithfulness、citation、tool accuracy、refusal、latency、cost、safety 和 UX 指标。
4. 设计判分：为每个指标写 rubric、可接受答案、拒答规则、证据要求和人工复核策略。
5. 运行评测：固定模型参数、工具版本、知识库版本、随机种子或重复次数；保存输入、输出、评分和日志。
6. 误差分析：按 hallucination、retrieval miss、bad context use、wrong tool、bad parameter、policy miss、format fail 分类。
7. 决策门禁：对比基线和候选，给出通过、回滚、继续调参或扩大人工评审的结论。
8. 持续监控：把关键 eval 进 CI 或定期任务，定义漂移报警、样本补充和阈值调整。

## 场景执行卡

## 安全与门禁补强

- 安全 eval 必须覆盖 direct/indirect prompt injection、malicious retrieved docs、tool poisoning、data exfiltration、jailbreak、policy bypass 和越权工具调用。
- Gate 要写清最低样本量、重复次数、基线 delta、波动容忍、flaky 豁免、人工复核和回滚触发条件；不能只给一个平均分。
- 评测证据至少包含 run_id、dataset_version、prompt/model/tool/corpus/scorer version、运行时间、脱敏输入输出、trace/log 链接和失败样本 topN。
- 指标要可计算：tool exact match、schema validity、citation support、faithfulness、judge agreement、p95 latency、cost/sample 和 refusal accuracy。
- Judge 需要 gold set、防泄漏、inter-judge agreement、人工仲裁和边界样本复判；不能让单个 judge 自证正确。
- 调参集、开发集和最终验收集必须分离；若复用样本，必须标记污染风险并降低结论等级。

### RAG Faithfulness

- 查：query、retrieved docs、chunk、rerank、引用、答案句子和不可回答样本。
- 做：分别评估检索命中、上下文相关性、答案是否被证据支持、引用是否指向正确片段。
- 验：无证据拒答、相似文档干扰、过期文档、引用错配和长上下文丢失。

### Agent Tool-call Accuracy

- 查：任务目标、可用工具、权限、参数 schema、预期调用序列和最终状态。
- 做：记录每次工具选择、参数、返回、重试、错误恢复和是否越权。
- 验：错误工具、漏调工具、参数错、顺序错、无权限调用、失败后胡编和最终状态不一致。

### Judge Prompt

- 查：评分维度、样例、rubric、输出格式、tie-break、偏置和人工 gold。
- 做：用 gold set 评估 judge 一致性；对边界样本做人工复判。
- 验：位置偏差、长度偏差、过度惩罚拒答、偏好华丽语言、解释与分数不一致。

### A/B 模型对比

- 查：基线模型、候选模型、温度、工具、知识库、prompt、成本和延迟。
- 做：固定输入和环境，做 paired comparison；输出胜负、显著样本和失败类别。
- 验：质量提升是否抵消成本/延迟，关键场景是否退化，CI 阈值是否通过。

## 报告模板

- Eval target：任务、用户场景、失败代价、基线版本、候选版本。
- Dataset：来源、版本、分层、去重、负例、安全样本、污染风险。
- Run config：模型、温度、工具、知识库、scorer、重复次数、成本和延迟。
- Result：核心指标、阈值、delta、失败分类、代表样本、是否通过 gate。
- Decision：通过、回滚、扩大人工评审、继续调参或补样本。

## 输出要求

- 输出 eval 目标、数据集版本、指标、rubric、运行设置、结果、误差分类、门禁结论和复现路径。
- 未实际运行 eval 时，必须写未运行，并只给设计方案。
- 不输出敏感用户样本、私有文档全文、真实凭据、完整系统提示词或可绕过安全门禁的细节。

## 反例

- 普通接口测试或前端 E2E。
- 只实现一个 RAG/Agent 功能，不评估效果。
- 只改一段 prompt 文案，没有数据集、指标和对比。
- 只读学习 LLM eval 概念。