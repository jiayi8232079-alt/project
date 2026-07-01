---
name: fuzzing-reverse-engineering
description: Fuzzing 与逆向联动技能 - 面向授权本地/隔离目标的 AFL++、libFuzzer、honggfuzz、harness、corpus、coverage、crash 去重、parser/协议/文件格式定位、最小化和回归证据；拒绝未授权目标、真实服务 fuzz、DoS 滥用和漏洞武器化。
---

# Fuzzing 与逆向联动

## 定位与适用范围

Fuzzing 与逆向联动（fuzzing-reverse-engineering，兼容 slug: fuzzrev）负责把 fuzzing 和逆向分析合在一个可复核流程里：先用逆向定位 parser、decoder、协议状态、文件格式和可控输入，再用 AFL++、libFuzzer、honggfuzz 或 grammar/model-based fuzzing 建 harness、语料、覆盖率和崩溃证据，最后完成 crash 去重、最小化、字段归因、修复回归和交付证据链。

适用场景：

- 自有或已授权库、SDK、CLI、parser、协议实现、文件格式解析器的 fuzzing。
- 闭源组件在明确授权下做入口定位、输入结构还原、harness 设计和 crash 复现。
- AFL++ forkserver/persistent mode、libFuzzer in-process harness、honggfuzz 资源隔离与覆盖采集。
- corpus seed、字典、grammar、fixtures、coverage profile、crash/hang/OOM triage 和 CI 回归门禁。
- CTF、教学、内部防御质量提升、供应链组件防御测试和修复验证。

不适用场景：

- 未授权第三方目标、线上服务、生产系统、互联网扫描和真实用户流量。
- 以 DoS、漏洞利用、绕过防护、批量攻击、规避检测或武器化 exploit 为目标的 fuzzing。
- 只读学习、普通测试工程、普通单元测试补充，或单纯 crash dump 分析。

## 铁律

- 没有授权主体、目标版本、隔离环境、资源预算和停止条件，不启动 fuzz，只能给防御性设计建议。
- 不对生产环境、第三方真实服务、真实用户流量或有副作用系统运行 fuzz。
- 不把 crash、hang、OOM 直接升级成漏洞结论；必须先完成复现、去重、最小化和证据分级。
- 不输出可直接攻击真实目标的 payload、利用链、绕过步骤、批量请求脚本或 DoS 放大方法。
- fuzzrev 的交付必须保留 harness、corpus、coverage、crash triage 和 CI 回归证据，缺项要写明未验证。

## 目标授权与范围门禁

开始前必须把 fuzz 任务写成可核对边界，不满足就先停：

- 授权主体：谁拥有目标、谁批准测试、授权覆盖源码/二进制/协议/样本/环境中的哪一部分。
- 目标指纹：仓库、commit、release、二进制哈希、依赖版本、编译器、架构、运行系统和构建开关。
- 禁测对象：生产域名、第三方地址、真实用户数据、共享数据库、外部 SaaS、支付/短信/邮件/推送等有副作用服务。
- 资源预算：CPU 核数、内存、磁盘、最大输入大小、单样本超时、总运行时长、最大连接数、速率和并发。
- 停止条件：触发 crash/hang/OOM、覆盖长期无增长、资源阈值命中、授权窗口结束、发现敏感数据或无法证明隔离。
- 证据边界：只保存最小复现输入、脱敏 corpus、工具摘要、覆盖与栈证据；不保留真实凭据、生产流量、攻击链或可直接滥用材料。
- 输出降级：授权不完整时，只能给本地 harness 设计、隔离方案、语料结构和防御性测试计划。

## 快速规则

- 授权先行：没有授权范围、目标版本、运行环境、资源上限和停止条件，不启动 fuzz。
- 本地优先：默认只在本地、隔离、测试、仿真或专用 staging 环境 fuzz，不碰真实服务。
- 逆向定位：先找输入入口、格式边界、状态机、校验逻辑和副作用，再写 harness。
- 证据闭环：每个 crash 都要能回到工具版本、target commit、harness、seed、最小输入、栈和复现结论。
- 安全降级：用户要求攻击性 fuzz、DoS 放大、线上压测或 exploit 链时，拒绝并转为防御验证建议。

## 强制流程

1. 明确授权与边界：记录目标所有者、授权范围、样本来源、版本、环境、CPU/内存/磁盘/时间预算、禁测对象、停止条件和敏感数据处理方式。
2. 建立目标档案：确认文件形态、架构、构建方式、依赖、符号、sanitizer 可用性、目标函数、输入类型和副作用面。
3. 逆向入口定位：从字符串、导入导出、调用图、协议包、文件样本、日志、崩溃栈或源码线索定位 parse/decode/load/deserialize/verify 等入口。
4. 定义 target harness 契约：写清目标入口、输入映射、初始化/清理、状态重置、资源上限、禁用副作用和复现命令摘要。
5. 设计 harness：保持最小入口、确定性、可重放、无网络和持久化副作用；隔离随机数、时间、全局状态、线程、文件系统和外部服务。
6. 准备 corpus：收集合规 seed，脱敏真实样本，覆盖合法、边界、版本差异和历史 crash；补字典、grammar、状态序列或字段模板。
7. 选择引擎：根据 target 形态选择 AFL++、libFuzzer、honggfuzz 或组合运行；记录编译参数摘要、coverage 模式、sanitizer、超时和资源限制。
8. 运行与监控：跟踪 exec/s、coverage、queue 增长、crash、hang、OOM、超时、去重率、磁盘增长和环境稳定性。
9. Triage 收敛：对 crash 做 dedup、稳定复现、minimize、栈归一、sanitizer 分类、输入字段定位和根因假设分层。
10. 生成 reproducer：为每个保留 crash 记录最小输入、目标版本、harness 版本、工具版本、环境摘要、复现步骤和失败签名。
11. 分流联动：crash dump 深挖和影响评级转 crashrev；文件格式字段/容器/checksum 模型转 fmtrev；协议帧/状态机/握手模型转 protrev；fuzzrev 保留 harness、coverage、corpus 和 crash 证据链。
12. 修复与回归：把最小 crash、合法 seed 和边界样本进入 fixtures；修复前后复跑，保留覆盖、复现和失败消失证据。
13. 交付结论：区分已证实、推测、未验证；不输出可直接攻击真实目标的 payload、利用链或 DoS 步骤。

## 验证门禁

以下门禁统一用于执行中自检和最终汇报。没有证据的项目写“未验证”或“待补证”，不能用运行时长、单次 crash 或工具默认输出替代验证结论。

### Harness 设计

- 输入映射要单一明确：字节流、文件路径、frame、message、AST 或结构化对象只能选主入口，不在同一 harness 混入多个不相关路径。
- target harness 必须能回答：目标函数是谁、输入如何进入、依赖如何 mock、状态何时 reset、失败如何归档、单样本资源如何限制。
- 初始化只做一次，单轮只解析输入；清理要覆盖堆对象、临时文件、全局缓存、线程、句柄、环境变量和日志输出。
- 禁止默认连网、写真实数据库、调用真实支付/短信/邮件/推送、读用户目录、修改系统配置或依赖 wall clock 结果。
- 随机、时间、路径、locale、线程调度和外部回调要固定或 mock；无法固定时标注 flaky 风险并降低结论等级。
- 输入大小、递归深度、容器层数、解压后大小、对象数量和循环次数必须有上限；避免 harness 自己制造资源耗尽。
- 闭源目标要记录调用约定、初始化/释放对、结构体假设、错误码和崩溃时加载模块；假设不明时先做最小 smoke，不扩大 fuzz。
- harness smoke 至少覆盖空输入、最小合法 seed、最大允许大小、非法 header、清理后重复调用和 sanitizer 启动成功。

### Corpus 与 Coverage

- seed 来源必须合法：项目测试样本、公开规范样本、用户授权样本、合成样本、历史 crash；真实样本先脱敏和裁剪。
- corpus 至少覆盖合法最小样本、常见版本、边界长度、空字段、重复字段、截断样本、嵌套/压缩/container 层和历史兼容样本。
- 字典和 grammar 只表达格式 token、magic、关键字段和值域；不放真实凭据、真实服务地址、个人数据或可攻击 payload。
- coverage 指标不能只写运行时长；至少记录边覆盖/块覆盖/函数覆盖中的一种、queue 或 corpus 增长、关键入口到达、未覆盖原因。
- 覆盖长期无增长时先检查 harness 是否被 header/checksum/length/握手挡住，再决定字典、custom mutator、grammar 或逆向补模型。
- sanitizer 默认优先 ASAN/UBSAN，按目标补 MSAN/TSAN/LSAN/CFI；记录 sanitizer 组合、误报限制、性能影响和不可用原因。
- sanitizer 报告必须保留类型、栈顶、分配/释放线索、输入哈希、复现概率和目标二进制/库版本；只截一段日志不能替代复现证据。
- coverage 下降要先区分修复导致路径收敛、harness 退化、seed 丢失、编译插桩变化和环境差异；不明原因下降不得作为通过结论。

### Crash 去重、最小化与回归

- dedup 维度至少包含 signal/exception、sanitizer 类型、栈归一、模块版本、输入哈希、复现稳定性和触发字段。
- minimize 先用引擎工具收缩，再按字段/offset/状态序列手工收缩；最小输入必须仍能稳定触发同类 crash。
- reproducer 必须可离线执行，且不依赖生产地址、真实账号、真实用户样本、随机时序或机器私有路径。
- hang/OOM 单独分层：确认输入大小、超时、内存上限、算法复杂度、环境噪声和复现概率，不把一次超时直接当漏洞。
- triage 结论分三档：已证实根因、强假设、未验证；未验证项不能进入修复结论或风险评级。
- 回归用例要同时加入最小 crash、相邻合法样本、边界 fixtures 和短时 fuzz smoke；CI 要有固定预算、超时和失败归档。
- 修复后必须证明：原最小样本不再触发、历史 seed 仍通过、coverage 无明显倒退、相关 sanitizer 仍开启。
- CI 回归失败归档要包含最小输入、失败签名、sanitizer 摘要、目标版本和运行预算；禁止无限 fuzz、污染 corpus 或上传敏感样本。

## 场景执行卡

### AFL++ 二进制或源码 fuzz

- 先确认目标是否适合 forkserver、persistent mode、QEMU/FRIDA mode 或源码插桩。
- harness 要避免每轮重启昂贵初始化；解析器入口尽量变成单输入、单返回、无外部依赖。
- corpus 从最小合法样本开始，逐步加入边界字段、历史样本和反序列化路径。
- coverage 证据至少记录 queue 增长、路径变化、目标版本、插桩方式和运行时长。
- 典型误区：把无法到达 parser 的无效样本跑很久，最后只得到浅覆盖和重复 hang。

### libFuzzer in-process harness

- 适合源码可编译、目标函数可直接调用、初始化可内存内完成的库/API。
- harness 必须处理长度边界、异常返回、全局状态清理、线程残留和 sanitizer 报告。
- 对复杂格式先拆 header、length、checksum、payload，再决定字典或结构化 mutator。
- 复现时固定 target commit、编译器、sanitizer、最小输入和相关环境变量摘要。
- 典型误区：忽略状态污染，导致同一输入时好时坏，crash 无法稳定复现。

### honggfuzz 与资源敏感目标

- 适合需要严格进程隔离、硬超时、信号处理、资源限制或多模式覆盖反馈的目标。
- 先设置 CPU、内存、文件大小、超时和输出目录策略，避免 fuzz 本身压垮机器。
- hang 和 OOM 先按资源配置、输入大小、目标复杂度和环境噪声分层复核。
- 交付时不要把“耗时很长”直接写成漏洞，必须证明异常路径、资源增长和输入触发关系。

### 文件格式、parser 与序列化 fuzz

- 先联动 fmtrev 识别 magic、version、length、offset、endianness、checksum、compression 和 container 层。
- seed 要覆盖真实版本差异、合法最小样本、字段边界、截断样本和历史兼容样本。
- 对 checksum/CRC/长度字段要决定是保留合法修复、定制 mutator，还是刻意测试错误处理。
- crash 字段定位要回到最小输入的具体字段、偏移、长度和解析分支。
- 典型误区：不理解格式层次就随机变异，覆盖率停在 header 校验前。
- 修复验证要复跑历史 crash、合法 round-trip 样本、错误 checksum/length 样本和 container 嵌套边界，证明 parser 没被修窄。

### 协议与状态机 fuzz

- 只允许在授权测试服务、仿真服务、本地 mock、离线解析器或实验环境中执行。
- 先联动 protrev 梳理握手、版本协商、frame、length、序列号、ACK、心跳、重放字段和状态迁移。
- 优先 fuzz 离线 decoder、message parser、状态机函数或本地仿真实例，避免真实服务 DoS。
- 必须设置速率、连接数、超时、资源上限和停止条件；生产域名、第三方地址和真实用户数据禁止作为目标。
- 典型误区：把协议 fuzz 变成线上压测或批量请求，越过授权和安全边界。
- 如果必须经过网络栈，只能使用本地隔离 loopback、mock server 或授权测试环境；所有外部依赖要可关闭、可限速、可审计。

### 闭源组件逆向辅助 fuzz

- 先用 binrev/debugrev/irrev 定位导出函数、调用约定、结构体布局、错误码、初始化和释放路径。
- harness 要隔离动态库加载、路径依赖、license 检查、线程池、回调和资源清理。
- 如果只能黑盒运行，至少保留样本哈希、版本、命令摘要、输入目录、崩溃日志和最小复现输入。
- 不绕过商业保护、不提取密钥、不制作补丁绕过；授权不清时停止并要求补授权。

### Crash 去重、最小化与归因

- 先按崩溃类型、信号、sanitizer、栈顶、可控输入、目标版本和复现稳定性去重。
- 用最小化工具和手工字段收缩并行推进；最小样本不能破坏触发条件和复现性。
- 对 flaky crash 标注触发概率、环境噪声、线程/时序因素和未证实项。
- 栈只能作为入口线索，根因要结合输入字段、解析状态、内存诊断和源码/反编译证据。
- 单纯 crash dump 深挖、可达性和影响评级交给 crashrev 负责，fuzzrev 只保留 fuzz 产出链路。
- 不把最小输入包装成利用样例；reproducer 只用于防御复现、修复验证和 CI 回归。

### 回归证据与 CI 门禁

- 修复前保留能稳定触发的最小输入、命令摘要、栈和 sanitizer 结果。
- 修复后复跑最小 crash、原始 seed、边界 fixtures 和短时 fuzz smoke。
- CI 门禁设置固定预算、超时、语料目录、失败归档和去重策略，避免无限跑或污染仓库。
- 报告必须写清：哪些 crash 已消失，哪些仍不稳定，coverage 是否变化，哪些路径未覆盖。
- CI 只跑防御回归预算：短时 smoke、历史 crash fixtures、核心 corpus 和 sanitizer lane；长时探索应进入隔离任务而不是阻塞主流水线。

## 输出要求

- 授权与范围：目标、所有者、版本、样本来源、环境、资源预算、停止条件和禁止项。
- 工具与配置：AFL++/libFuzzer/honggfuzz 版本、插桩/覆盖方式、sanitizer、超时、seed、运行时长和命令摘要。
- Harness 证据：入口函数、输入映射、初始化/清理、隔离策略、副作用处理和可重放方式。
- Corpus 证据：seed 来源、脱敏状态、字典/grammar、合法样本、边界样本、历史 crash 和版本差异。
- Coverage 证据：覆盖摘要、queue 增长、关键路径到达情况、未覆盖入口和探索限制。
- Crash 证据：去重规则、最小输入、复现稳定性、栈、sanitizer 分类、字段/偏移定位、已证实和推测。
- 回归证据：修复前后对比、fixtures、CI 门禁、剩余风险和无法验证项。
- 分流证据：哪些问题留在 fuzzrev，哪些应交 crashrev/fmtrev/protrev，交接所需输入、栈、样本、字段和覆盖证据。

## 安全边界

- 拒绝未授权目标 fuzz、第三方真实服务 fuzz、生产环境 fuzz、互联网扫描和批量请求。
- 拒绝 DoS 滥用、资源耗尽放大、漏洞武器化、exploit 编写、绕过检测、绕过授权和规避防护。
- 不在输出中提供可直接用于攻击真实目标的 payload、服务地址、批量脚本、绕过步骤或利用链。
- 发现敏感数据、凭据、密钥、用户样本或生产流量时，立即脱敏、最小留存，并暂停高风险操作。
- 可提供防御替代：本地复现、隔离 harness、最小 crash、修复建议、回归 fixtures 和安全测试边界。
- 用户坚持线上目标、放大资源消耗、绕过限流、扩大攻击面或索要 exploit 时，直接拒绝，并只保留授权测试替代方案。
- 防御测试与修复验证可以说明验证思路、证据字段和门禁条件；不得输出 weaponization、真实目标攻击流程或可复用攻击自动化。

## 高频 Bug 反例库

- 反例：用户只说“帮我 fuzz 这个线上接口”。对法：拒绝真实服务 fuzz，要求授权测试环境或离线 parser。根因：fuzz 天然可能造成 DoS。
- 反例：harness 每轮写数据库、连外网或改全局配置。对法：替换为本地 mock、临时目录和确定性清理。根因：副作用会污染证据并扩大风险。
- 反例：直接把所有 crash 交给开发。对法：先去重、最小化、复现和分类。根因：重复 crash 会掩盖真实修复优先级。
- 反例：coverage 只写“跑了 24 小时”。对法：记录覆盖模式、路径增长、关键入口到达和未覆盖原因。根因：时间不是探索质量。
- 反例：文件格式没有处理 length/checksum。对法：先逆向字段，再定制字典或 mutator。根因：样本会被早期校验拦截。
- 反例：协议 fuzz 直接打生产域名。对法：改为离线 decoder、本地仿真或授权 staging。根因：真实服务 fuzz 可能影响用户和业务。
- 反例：hang 直接定性为漏洞。对法：复核资源预算、输入大小、超时阈值和环境噪声。根因：hang 的误报率高。
- 反例：把 crash 继续写成 exploit。对法：只交防御修复、最小复现和回归证据。根因：武器化越过技能边界。
- 反例：seed 直接来自生产流量包。对法：停止运行，确认授权、脱敏、裁剪和最小化后只在隔离环境使用。根因：corpus 可能包含敏感数据。
- 反例：harness 为了通过 checksum 直接访问真实服务补字段。对法：本地实现 checksum 或 custom mutator。根因：真实服务依赖破坏隔离边界。
- 反例：只保留原始 crash 文件，不保存最小 reproducer。对法：生成离线最小复现并记录目标版本。根因：无法回归也无法判断修复是否有效。
- 反例：dedup 只按文件哈希分组。对法：结合栈、signal、sanitizer、模块版本和触发字段。根因：同根因可有多输入，同输入也可能有多失败。
- 反例：修复后只跑单个最小 crash。对法：同时跑合法 seed、边界 fixtures、历史 crash 和短时 fuzz smoke。根因：局部修复可能破坏兼容或覆盖。
- 反例：CI fuzz 没有预算和归档。对法：固定时间、输入上限、失败 artifact 和敏感样本过滤。根因：不受控 fuzz 会拖垮流水线并泄露数据。
- 反例：sanitizer 关闭后声称通过。对法：记录关闭原因并降级结论，优先恢复 ASAN/UBSAN 或替代检测。根因：测试信号被削弱。

## 自检清单

- [ ] frontmatter `name` 使用规范 canonical `fuzzing-reverse-engineering`，兼容 slug 仍为 `fuzzrev`。
- [ ] 正文 500 行以内，优先 0 fenced code block。
- [ ] 覆盖 AFL++、libFuzzer、honggfuzz、harness、corpus、coverage、crash 去重、最小化和回归证据。
- [ ] 覆盖 target harness、sanitizer、dedup、minimize、crash triage、reproducer、CI 回归和修复验证门禁。
- [ ] 覆盖 parser、协议、文件格式、闭源组件和逆向定位。
- [ ] 覆盖目标授权、禁测范围、真实服务/生产 DoS 防护、资源预算、sanitizer、CI 回归和分流联动。
- [ ] 明确拒绝未授权目标、真实服务 fuzz、DoS 滥用、漏洞武器化和攻击性 fuzz。
- [ ] 输出中区分已证实、推测、未验证，且每个结论有复核证据。

## 相邻技能边界

- 逆向工程总控/reverse-engineering（slug: rev）：通用逆向总入口；Fuzzing 与逆向联动只在需要构建 fuzz 流程和证据链时接手。
- 通用二进制逆向/binary-reverse-engineering（slug: binrev）/ 动态调试与运行时观察逆向/debug-reverse-engineering（slug: debugrev）/ IR 与数据流高级静态分析逆向/irrev（slug: irrev）：负责二进制入口、调试轨迹和中间表示定位；Fuzzing 与逆向联动使用这些结论设计 harness。
- 文件格式与私有格式逆向/file-format-reverse-engineering（slug: fmtrev）：负责文件格式字段、容器、checksum 和 round-trip 模型；Fuzzing 与逆向联动用其结果提高 parser fuzz 覆盖。
- 授权私有协议逆向/protrev（slug: protrev）：负责协议帧、状态机、握手、序列和字段模型；Fuzzing 与逆向联动只在授权隔离环境做协议 fuzz。
- 崩溃分析与漏洞可达性逆向/crash-reverse-engineering（slug: crashrev）：负责 crash dump 深挖、可达性和影响判断；Fuzzing 与逆向联动负责 fuzz 产生的 crash 去重、最小化和复现证据。
- 代码审计/code-audit（slug: aud）：负责最终需求落地复盘、安全审查和修复质量确认。
