---
name: file-format-reverse-engineering
description: 文件格式与私有格式逆向技能 - 面向授权互操作、兼容排障、防御审计和取证辅助，覆盖授权边界、样本 corpus、magic/header/footer/version/length/flags/endianness、TLV/varint/chunk、offset table、CRC/checksum、compression/encryption indicators、parser differential、fuzz corpus、schema/recovery、010 Editor/Kaitai 风格建模、fixtures、round-trip、报告验收和安全边界。
---

# 文件格式与私有格式逆向

## 定位 / 适用范围

文件格式与私有格式逆向（file-format-reverse-engineering，兼容 slug: fmtrev）负责在授权边界内还原文件格式、私有二进制格式、容器格式、存档格式、序列化片段和离线载荷结构，并把结论沉淀成可复核的字段字典、010 Editor/Kaitai 风格模型、样本 corpus、fixtures、parser differential、schema/recovery、round-trip 验证、兼容排障和取证辅助证据。

适用：授权互操作、旧文件迁移、私有格式兼容、文件导入导出排障、parser 行为审计、防御性质量验证、取证辅助、教学和内部工具开发前的格式建模。

不适用：网络协议状态机和重放归 protrev；加密算法、签名参数、密钥路径归 cryptrev；普通公开格式解析开发归对应语言/后端技能；只读学习归 project-learning；攻击性 fuzz、漏洞武器化、绕过格式保护、攻击载荷生成和恶意样本传播不属于本技能。

## 铁律

1. 授权主体、样本来源、允许动作、禁止动作、数据留存、取证链路和停止条件未确认，不开始解析、改写、批量跑样本或生成 fixtures。
2. 原始样本只读；所有派生样本、裁剪样本、修复样本、fuzz 种子和 fixtures 必须有编号、哈希、来源、生成方式和脱敏说明。
3. 字段结论分为已验证、推测、未知；未知字段只命名为 unknown/reserved，不猜业务语义。
4. 每个字段假设必须绑定偏移、长度、端序、样本编号、版本、成功/失败对照、工具输出、边界计算或 round-trip 结果。
5. magic、header、version、length、flags、endianness、offset table、TLV/varint、checksum、压缩、容器和加密线索必须分层表达，不混成一类。
6. 仅限防御互操作、兼容排障、质量验证和取证辅助；拒绝利用 parser 漏洞武器化、恶意样本传播、攻击性 fuzz、攻击载荷、绕过 DRM/许可证/授权格式保护、凭据提取、未授权解密和私有数据窃取。

## 快速总则

1. 先选 corpus 再建账本：覆盖 good、bad、edge、versioned、minimized 中至少两类，记录 SHA256、大小、来源、版本、生成程序、平台、是否成功打开、敏感字段、脱敏规则和证据编号。
2. 先外层后内层：magic/header/footer/version/length/flags/endianness，再 section/chunk/offset table，再 TLV/varint/数组，再 payload、checksum、压缩、容器和签名线索。
3. 先边界后语义：用长度、偏移、计数、保留位、对齐、尾部校验和失败样本确定结构，再谨慎命名字段。
4. 先多样本后结论：至少使用成功/失败、多版本、不同大小、边界值或不同生成程序样本之一做对照；单样本只能给候选结构和补样本计划。
5. 先模型后实现：优先产出字段表、Kaitai/010 Editor 风格结构描述、fixtures 和验证门禁，再让开发技能实现 parser/writer。
6. 所有结论必须能被 round-trip、checksum、原程序打开、parser differential、解析器日志、二进制 diff 或 corpus 回归之一复核。

## 强制流程

1. 授权确认：记录资产归属、样本范围、允许动作、禁止动作、第三方边界、取证链路、敏感数据、留存周期和停止条件。
2. 样本建档：建立 corpus 清单，标记 good/bad/edge/versioned/minimized，记录哈希、大小、来源、生成器、平台、敏感性、脱敏方式和备注。
3. 结构初识别：定位 magic、header、footer、version、length、flags、endianness、对齐、section、chunk、offset table、CRC/checksum、压缩层、加密/签名 indicators 和容器边界。
4. 字段假设：按偏移、长度、类型、端序、编码、默认值、版本约束、置信度、证据编号和敏感性建字段字典。
5. 分层验证：分别验证长度/计数、offset table、TLV/varint/chunk 解码、checksum 覆盖范围、压缩/容器解包、加密线索、未知字段保留策略和版本分支。
6. 模型沉淀：用 010 Editor/Kaitai 风格描述表达结构、枚举、条件字段、数组、嵌套、版本分支和校验字段。
7. Differential：用至少两个 parser、原程序、版本差异或只读工具链对照字段解释、错误码、容错行为、恢复路径和未知字段保留。
8. Round-trip：读取样本后重写等价文件，比较结构 diff、payload diff、checksum、原程序打开结果和 parser 日志。
9. 交付收口：输出字段字典、样本矩阵、fixtures、模型草案、schema/recovery、验证结果、未知项、报告验收、风险边界和相邻技能联动建议。

## Corpus 选择门禁

1. good 样本用于确认正常路径；bad 样本用于确认 parser 错误码、截断、checksum mismatch 和越界行为；edge 样本用于确认空数组、最大计数、最短 header、奇数对齐和尾部垃圾；versioned 样本用于确认版本分支；minimized 样本用于可分享回归。
2. corpus 不足时先写缺口：缺少失败样本、缺少旧版本、缺少大文件、缺少压缩字典、缺少原程序打开证据时，不得承诺格式完整。
3. fixtures 必须最小化、可复现、可脱敏；禁止把客户原始文件、真实个人数据、凭据或商业载荷直接提交为 fixture。
4. fuzz corpus 只允许防御性 parser 质量验证：限定本地授权目标、最小 seed、资源上限、crash 去重、最小化、脱敏和回归修复；不输出 DoS 放大、利用链、攻击载荷、堆布局、喷射或绕过步骤。

## 边界计算规则

1. offset/length/count 必须做 file_size、section_size、base、alignment、integer overflow、underflow、截断和重叠区间检查。
2. 相对 offset 必须说明 base；绝对 offset 必须说明文件起点或容器起点；长度单位必须说明字节、元素数、块数、字符数或压缩后长度。
3. TLV/varint 必须验证 tag 范围、type 映射、length 上限、continuation bit、zigzag、重复字段、unknown field 保留和截断失败路径。
4. chunk 必须验证 chunk id、size、flags、payload offset、footer/index 指向、重复块、空洞、对齐填充和未知块保留策略。
5. checksum/CRC 必须区分存储端序、覆盖范围、初值、poly、reflect in/out、xorout、是否包含 checksum 字段本身和压缩前后位置。
6. compression/encryption indicators 必须分清 outer container、compressed stream、encoded blob、encrypted/signature-protected payload；高熵、固定块长、nonce/salt、认证 tag、签名尾部和字典需求只能作为线索，无法合法解包时交付外层模型和内层证据，不伪造 payload 字段。

## Parser Differential 与 Schema/Recovery

1. differential 必须说明对照对象：原程序、旧版 parser、新版 parser、第三方只读工具、Kaitai/010 草案、导入导出日志或取证工具；不能把单一工具输出当真相。
2. 对照维度包括字段解释、错误码、容错策略、截断处理、unknown field 保留、checksum 报错、版本降级、恢复成功率和日志差异。
3. schema/recovery 必须把已知字段、未知字段、可恢复字段、不可恢复字段、依赖外部字典/密钥/签名的字段分开；恢复建议只能用于合法互操作、数据迁移、修复损坏文件和取证解释。
4. recovery 输出必须保留原始样本哈希和只读证据；任何修复样本都写明派生关系、变更字段、校验重算方式、原程序打开结果和不可逆风险。
5. 发现 parser crash 时可建立最小安全复现和回归用例，但不得扩散可武器化 crash 样本、攻击载荷、利用链、绕过步骤或第三方攻击说明。

## 版本兼容规则

1. 建立版本矩阵：格式版本、生成器版本、平台、feature flags、字段新增/删除、默认值、保留位、兼容行为和失败模式。
2. 新版本字段默认 unknown/reserved 保留，writer 不得丢弃未知字段；旧版本 writer 的降级策略必须有原程序打开或 parser 回归证据。
3. 兼容结论必须绑定样本编号和验证结果；未覆盖的版本、平台、压缩参数、字典或签名策略必须列为无法验证。

## 场景执行卡

### 1. Magic / Header / Version 识别

- 动作：比较文件头、版本字段、固定字节、feature flags、长度字段、header size、保留位和对齐规则。
- 证据：样本编号、偏移范围、十六进制摘要、版本矩阵、原程序兼容结果。
- 兜底：header 内字段冲突时只标候选，不把常量误写成协议语义。

### 2. Length / Flags / Endianness 排障

- 动作：用总长度、section 长度、数组计数、offset 指向、边界样本和失败样本验证端序和单位。
- 证据：多样本计算表、越界/截断日志、字段覆盖范围、解析前后长度一致性。
- 兜底：无法解释所有样本时标记版本分支或未知 flag，不强行统一。

### 3. TLV / Varint / 嵌套结构

- 动作：识别 tag/type/length/value、varint 编码、zigzag、嵌套对象、重复字段、unknown field、保留字段和扩展策略。
- 证据：字段号、偏移、解码值、边界条件、成功/失败样本、未知字段保留测试。
- 兜底：只知道类型不知道业务含义时写 field_N/unknown_N，不伪造名称。

### 4. Offset Table / Section / Chunk 容器

- 动作：定位目录表、chunk id、section size、entry count、相对/绝对偏移、对齐、footer index、重复块和空洞。
- 证据：offset 解析表、指向范围、重排/裁剪样本、容器树、chunk 校验结果。
- 兜底：offset 指向压缩或加密 payload 时只完成外层模型，内层转相邻技能或标无法验证。

### 5. CRC / Checksum / Signature 线索

- 动作：区分 CRC、checksum、hash、MAC、数字签名和业务完整性字段；定位覆盖范围、初值、反射、异或、大小端和尾部布局。
- 证据：算法候选、覆盖区间、成功/失败样本、单字节变更实验、原程序错误码。
- 边界：只做合法完整性验证和兼容排障；签名伪造、密钥提取、未授权解密转拒绝。

### 6. 压缩 / 编码 / 容器识别

- 动作：识别 gzip/zlib/brotli/zstd/lz4/snappy、Base64/hex、tar/zip/pak/自定义容器、Protobuf/CBOR/MessagePack 等嵌套层。
- 证据：magic、熵、content hint、解包日志、解压后长度、字典需求、嵌套结构图。
- 兜底：高熵不等于加密；压缩参数或字典缺失时写清不可验证项。

### 7. Compression / Encryption Indicators

- 动作：区分压缩、编码、加密、签名保护和认证封装，记录高熵区、nonce/salt、认证 tag、签名/footer、块大小、字典需求和错误码。
- 证据：熵分布、magic、块边界、压缩库返回、原程序日志、签名/校验失败模式和外层字段引用。
- 边界：只做格式层识别和合法验证；未授权解密、密钥提取、签名伪造、保护绕过和攻击载荷直接拒绝。

### 8. Parser Differential / Schema Recovery

- 动作：对照原程序、多个 parser、版本差异或只读工具链，提炼 schema、恢复策略、容错行为和 unknown field 保留规则。
- 证据：工具版本、样本编号、字段差异、错误码、恢复前后哈希、原程序打开结果、不可恢复字段和风险说明。
- 兜底：对照工具冲突时列冲突矩阵，不以单个 parser 覆盖样本事实。

### 9. Corpus / Fixtures / Round-trip / Fuzz 回归

- 动作：建立 good、bad、edge、versioned、minimized corpus；为每类保留最小 fixtures；执行 read-only parse、parse-write-parse、原程序打开、diff 验证和授权 fuzz corpus 回归。
- 证据：样本哈希、fixture 说明、round-trip 结果、结构 diff、checksum 变化、兼容矩阵。
- 兜底：无法 round-trip 时至少说明阻塞字段、不可重算校验、未知压缩参数或原程序限制。

### 10. 兼容排障和迁移

- 动作：建立版本矩阵、字段新增/删除/默认值、保留位策略、旧客户端行为、容错规则和回滚样本。
- 证据：多版本文件、导入导出日志、字段 diff、失败模式、最小复现样本。
- 兜底：未覆盖旧版本或边界文件时不得承诺全量兼容。

## 010 Editor / Kaitai 风格建模要求

1. 模型必须表达 magic、meta/version、endianness、seq/section、instances/offset table、repeat/count、switch-on、conditional field、TLV/varint、checksum 字段和 unknown/reserved 字段。
2. 字段命名优先结构含义，不足证据时使用 header_len、flags、entry_count、offset_N、payload_N、unknown_N。
3. 每个枚举值必须有样本证据；未见值写 reserved 或 unknown，不写猜测业务枚举。
4. 模型必须能标出边界检查：offset 是否越界、length 是否截断、count 是否溢出、checksum 覆盖范围和版本条件。
5. 模型必须标注 footer/index、chunk、压缩层、加密/签名 indicator、schema/recovery 状态和 parser differential 分歧。
6. 模型草案要能指导 parser 实现，但不替代生产代码；生产实现转对应语言技能并由测试/审计收口。

## 验证门禁

- 授权、样本来源、允许动作、禁止动作、停止条件和敏感数据处理齐全。
- corpus 至少覆盖 good/bad/edge/versioned 中两类；不足时明确样本不足。
- 字段字典覆盖偏移、长度、类型、端序、编码、证据、置信度和敏感性。
- offset/length/count 已完成越界、重叠、截断、整数溢出和 base/alignment 校验。
- magic/header/version/length/flags/endianness、TLV/varint、offset table、CRC/checksum、压缩/容器已验证或标无法验证。
- magic/header/footer、TLV/varint/chunk、compression/encryption indicators、parser differential、schema/recovery 已验证、标冲突或标无法验证。
- fixtures 有哈希、来源、用途、脱敏说明和复现步骤；原始样本不被破坏。
- fuzz corpus 只用于授权本地 parser 质量验证，有 seed 来源、资源上限、crash 去重、最小化、脱敏和回归修复记录。
- round-trip、原程序打开、结构 diff、checksum 校验、parser differential、parser 日志或 corpus 回归至少完成一种。
- 报告验收包含结论等级、证据编号、无法验证项、剩余样本缺口、复现步骤、风险边界和拒绝项。
- 输出不包含 parser 漏洞武器化、恶意样本传播、DRM/许可证绕过、凭据提取、未授权解密、攻击性 fuzz、攻击载荷或 crash 扩散指令。

## 真实验收门禁

1. 通过条件必须是真实样本、真实工具、真实日志和可复现步骤；只写“已识别”“应为”“看起来像”不能算通过。
2. 文件格式验收至少包含一种机器可复核产物：字段表、010 Editor/Kaitai 草案、解析日志、结构 diff、fixture、round-trip 记录、parser differential 表或 corpus 回归结果。
3. 私有格式逆向验收必须有样本矩阵，至少列 good/bad/edge/versioned/minimized 的覆盖与缺口；样本不足时交付补样本清单，不给完整兼容结论。
4. magic/header/footer、endianness、TLV/varint/chunk、offset table、checksum、compression/encryption indicators 每项必须标为已验证、冲突、无法验证或不适用，禁止空白跳过。
5. parser differential 至少记录对照对象、版本、输入样本、差异字段、错误码/日志和最终取舍；单 parser、单版本、单样本只能支撑候选结论。
6. fuzz corpus 验收只看防御性质量证据：授权范围、seed 来源、资源上限、crash 去重、最小化、脱敏、修复回归；任何攻击载荷、利用链或扩散样本都不得输出。
7. schema/recovery 验收必须保留原始哈希、派生关系、变更字段、校验重算、原程序打开结果和不可逆风险；恢复失败也要写明不可恢复字段和依赖条件。
8. 安全验收必须确认输出没有密钥、凭据、客户原始数据、可武器化 crash、攻击 payload、绕过 DRM/许可证/签名/授权格式保护步骤。

## 结论降级规则

1. 只有字段被多样本、边界计算、工具输出、原程序行为或 round-trip 之一支撑，才可写“已验证”。
2. 只有单样本、单工具、单版本、不可重算 checksum、缺少原程序打开证据、缺少失败样本或缺少压缩字典时，结论降为“候选结构”或“推测字段”。
3. endian、offset base、length unit、TLV length、chunk size、checksum 覆盖范围任一无法闭合时，相关下游字段同步降级。
4. 高熵、固定块长、nonce/salt、认证 tag、签名/footer 只证明 indicator；没有授权解包或合法验证证据时，不得声称 payload schema 已还原。
5. parser differential 冲突未解决时，输出冲突矩阵和下一步补证，不用优先级、工具名气或单个 parser 结果压过样本事实。
6. 涉及安全、取证、迁移或生产 parser 时，未完成回归和审计门禁只能给风险提示和交接输入，不能写“可上线”“可恢复全部文件”。

## 输出要求

1. 授权边界：主体、范围、样本来源、允许动作、禁止动作、停止条件、敏感数据和脱敏规则。
2. 样本账本：SHA256、大小、版本、生成程序、平台、good/bad/edge/versioned 分类和证据编号。
3. 格式结构：magic、header、footer、version、length、flags、endianness、section、chunk、offset table、TLV/varint、payload、CRC/checksum、压缩/容器层和加密/签名 indicators。
4. 字段字典：名称、偏移、长度、类型、端序、编码、默认值、版本约束、证据、置信度、敏感性和 unknown 策略。
5. 模型草案：010 Editor/Kaitai 风格结构说明、数组/条件/枚举/offset/chunk/footer/校验字段和限制。
6. Parser differential：对照对象、版本、字段差异、错误码差异、容错差异、恢复差异和冲突结论。
7. Schema/recovery：已知字段、未知字段、可恢复字段、不可恢复字段、依赖外部字典/密钥/签名字段、修复样本派生关系和不可逆风险。
8. 验证结果：fixtures、round-trip、结构 diff、原程序打开、checksum、兼容矩阵、fuzz corpus 回归、失败样本解释和无法验证项。
9. 报告验收：结论等级、证据编号索引、复现步骤、残留风险、样本缺口、安全边界、拒绝项和下一步交接。
10. 漏洞处理：如发现 parser crash，只输出安全复现、触发字段、影响范围、修复建议和回归门禁，不输出利用链、攻击载荷或可扩散 crash 样本。
11. 联动建议：需要 protrev、cryptrev、binrev、fuzzrev、test-engineering、code-audit 或语言开发技能时写清最小交接输入。

## 安全边界

- 允许：授权互操作、兼容排障、防御审计、数据迁移、内部工具开发前建模、parser 质量验证、取证辅助和教学样本分析。
- 拒绝：利用 parser 漏洞武器化、崩溃样本扩散、恶意样本传播、绕过授权格式保护、绕过 DRM/许可证、签名伪造、密钥提取、未授权解密、凭据提取、私有数据窃取、攻击第三方产品或服务、生成攻击载荷。
- 遇到 parser crash：只交付触发字段、边界条件、影响、最小安全复现和修复验证建议；不提供利用链、绕过、喷射、堆布局、攻击 payload 或可用于扩散的 crash 样本。
- 遇到加密/签名：只识别格式层证据和合法验证路径；算法、参数、密钥路径或签名规范转 cryptrev，绕过请求直接拒绝。

## 高频 Bug 反例库

- 反例 1：单样本定格式。错法：一个文件推全量结构。对法：至少用成功/失败、多版本或边界样本对照。根因：常量、字段和偶然值容易混淆。
- 反例 2：端序猜错。错法：看到合理数字就定 little-endian。对法：用长度、offset、count 和总文件大小交叉验证。根因：端序会连锁污染全部偏移。
- 反例 3：把 offset 当 length。错法：字段能指向区域就写成长度。对法：分别验证基址、单位、对齐和指向范围。根因：目录表常混合 offset、size、flags。
- 反例 4：varint 按固定宽度读。错法：直接按 uint32 切字段。对法：验证 continuation bit、zigzag、重复字段和截断样本。根因：边界错位会破坏后续字段。
- 反例 5：压缩误判加密。错法：高熵就写加密。对法：查 magic、窗口、字典、解包错误和明文 hint。根因：压缩、编码、容器、加密是不同层。
- 反例 6：checksum 不验证。错法：只标 checksum 字段不测覆盖范围。对法：单字节变更、裁剪样本和失败日志定位覆盖区间。根因：完整性字段决定 writer 能否兼容。
- 反例 7：未知字段乱命名。错法：按业务猜字段含义。对法：写 unknown/reserved、证据缺口和补样本计划。根因：格式语义需要样本或业务证据。
- 反例 8：round-trip 只比文件字节。错法：字节不同就判失败，或字节相同就判成功。对法：同时比较结构、payload、checksum、原程序行为和日志。根因：合法 writer 可能重排字段，非法 writer 也可能保留错误。
- 反例 9：fixtures 泄露业务数据。错法：直接提交原始客户文件。对法：最小化、脱敏、哈希登记并说明来源。根因：格式样本常包含真实业务或个人数据。
- 反例 10：把 parser crash 写成 exploit。错法：输出利用路径和攻击样本传播步骤。对法：只写安全复现、触发字段、修复验证和回归门禁。根因：防御审计不能升级为武器化。
- 反例 11：只跑一个 parser。错法：把单工具错误码当格式真相。对法：用原程序、旧版/新版 parser、只读工具或 Kaitai/010 草案做 differential。根因：parser 容错会掩盖真实 schema。
- 反例 12：schema 恢复覆盖原始证据。错法：直接修坏文件并丢掉原件关系。对法：保留原始哈希、派生样本、变更字段和打开结果。根因：恢复链路必须可取证复核。
- 反例 13：高熵就尝试解密。错法：要求找密钥或绕过签名。对法：只写 compression/encryption indicators、外层边界和合法验证路径。根因：格式识别不等于授权解密。
- 反例 14：报告只给结论。错法：写“格式已还原”但没有证据编号、样本缺口和复现步骤。对法：交付结论等级、字段字典、样本矩阵、无法验证项和验收门禁。根因：逆向报告必须能被复核。

## 自检清单

- [ ] frontmatter name 使用规范 canonical `file-format-reverse-engineering`，兼容 slug 仍为 `fmtrev`，不再要求 name 等于目录 slug。
- [ ] 行数小于 500，正文 0 fenced code block。
- [ ] 覆盖 magic/header/version/length/flags/endianness、TLV/varint、offset table、CRC/checksum、压缩/容器。
- [ ] 覆盖 footer、chunk、compression/encryption indicators、parser differential、fuzz corpus、schema/recovery 和报告验收。
- [ ] 覆盖 010 Editor/Kaitai 风格建模、corpus、fixtures、round-trip 和兼容排障。
- [ ] 每个结论都有样本、偏移、长度、版本、工具或验证结果支撑。
- [ ] 真实验收门禁已覆盖样本矩阵、机器可复核产物、parser differential、schema/recovery、fuzz corpus 和安全输出检查。
- [ ] 证据不足、单样本、单工具、checksum 不闭合、压缩/加密线索不足或 differential 冲突时，结论已降级。
- [ ] 安全边界明确限定防御互操作/取证辅助，拒绝 parser 漏洞武器化、攻击载荷、恶意样本传播、绕过授权格式保护、未授权解密和凭据提取。
- [ ] 相邻技能边界清楚，普通文件解析开发、协议逆向、加密逆向和攻击性 fuzz 不误触发。

## 相邻技能边界

- 授权私有协议逆向/protrev（slug: protrev）：网络协议、状态机、握手、心跳、重放边界、pcap 和在线交互样本。
- 加密算法识别与实现审计逆向/cryptographic-reverse-engineering（slug: cryptrev）：加密算法识别、签名参数、KDF、MAC、密钥路径、随机数和合法密码学审计。
- 通用二进制逆向/binary-reverse-engineering（slug: binrev）：解析器二进制实现、反汇编、函数调用图、patch 分析和闭源程序内部逻辑。
- Fuzzing 与逆向联动/fuzzing-reverse-engineering（slug: fuzzrev）：授权 fuzz harness、coverage、crash 去重、corpus 最小化和回归 fuzz；攻击性 exploit 或 DoS 请求拒绝。
- 测试验证/test-engineering（slug: tst）：parser/writer 的单元测试、fixtures 回归、兼容矩阵和 CI 门禁。
- 后端工程/backend-engineering（slug: be）/ JavaScript/TypeScript 开发/javascript-typescript-development（slug: jsts）/ Python 开发/python-development（slug: pyd）/ Go 开发/go-development（slug: godv）：根据项目语言实现生产 parser、writer、迁移脚本或导入导出功能。
- 代码审计/code-audit（slug: aud）：实现完成后的安全、兼容、边界和测试覆盖审计。