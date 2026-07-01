---
name: document-macro-reverse-engineering
description: 文档与宏样本逆向技能 - 面向授权 Office/OLE/OOXML、VBA macro、PDF JavaScript、LNK/CHM/MSI/OneNote、嵌入对象、自动执行入口、解包结构证据、IOC/行为提取、静态优先、隔离动态观察和脱敏报告；拒绝宏武器化、钓鱼 payload、规避检测、凭据窃取和真实目标投递。
---

# 文档与宏样本逆向

## 定位 / 适用范围

文档与宏样本逆向（document-macro-reverse-engineering，兼容 slug: docrev）负责授权文档载体和宏样本的防御逆向。核心目标不是写宏或复现攻击，而是把文档容器、嵌入对象、自动执行入口、宏/脚本片段、解包结构、IOC、行为假设、隔离观察、去武器化摘要和脱敏报告做成可复核证据链。

适用对象：

- Office 复合文档与 OOXML：doc/docm/xls/xlsm/xlam/ppt/pptm/rtf、OLE CFB、VBA project、Excel 4.0 macro sheet、关系文件、外链、模板引用和嵌入对象。
- PDF：xref、object stream、incremental update、OpenAction、AA、Names/JavaScript、AcroForm、Launch、EmbeddedFiles、RichMedia 和附件。
- Windows 文档载体：LNK、CHM、MSI、OneNote、HTA/MHTML 作为附件或投递容器时的结构、脚本入口和外部调用线索。
- 交付目标：授权安全研究、SOC/IR 样本 triage、EDR 告警复核、邮件网关样本复盘、供应链文档审计、兼容排障和教学/CTF。

不适用：

- 只读学习文档格式、普通 Word/Excel/PDF 编辑、SDK 文档校验、普通文档自动化处理。
- 已提取出的通用 PowerShell/JS/Python/VBA 代码深度去混淆，优先 scriptrev。
- 恶意样本家族归因、YARA/Sigma 检测体系和事故响应总交接，优先 malrev。
- 通用未知文件格式建模、checksum/offset/TLV 深挖，优先 fmtrev。
- 无授权、攻击性请求、宏武器化、钓鱼 payload、规避检测、凭据窃取、真实目标投递。

## 铁律

1. 授权主体、样本来源、允许动作、禁止动作、隔离策略、网络策略和停止条件不清，不分析、不执行、不上传第三方服务。
2. 授权边界必须落到书面或工单证据：谁授权、分析哪一份样本、可否解包、可否动态触发、可否联网仿真、可否导出 IOC、可否共享报告；缺任一项按未知处理。
3. 原始样本只读保存；解包目录、ole stream、宏模块、PDF object、LNK 属性、MSI 表、日志和截图都要绑定样本 hash 与证据编号。
4. 静态优先：先做文件类型、容器层、嵌入对象、入口和 IOC 候选；动态只用于补证，并且必须在隔离快照中最小触发。
5. 不把工具标签、AV 名称、单个字符串、文件名或扩展名当定论；结论分为已验证、推测、无法验证。
6. 对宏、脚本、命令行、URL、账号、token、内网路径、客户名和个人数据先脱敏再交付。
7. 去武器化是默认交付形态：保留证据位置、行为角色、检测字段和阻断点，移除可直接执行的宏体、完整命令链、真实回连地址、绕过参数、投递话术和凭据材料。
8. 拒绝宏武器化、钓鱼 payload、下载执行链补全、规避检测、沙箱逃逸、凭据窃取、持久化增强和真实目标投递。
9. 误报控制是交付门禁：每个高风险判断都要有结构位置、入口关系、行为上下文和替代解释；正常模板、业务外链、合法插件、安装脚本和用户自建宏不能仅凭关键词判恶意。

## 快速总则

1. 先建档：SHA256/MD5/SHA1、大小、MIME/魔数、扩展名、来源、投递路径、接收时间、工具版本和样本编号。
2. 先分容器：OLE CFB、OOXML ZIP、PDF、LNK shell link、CHM HTML Help、MSI database、OneNote section/package、RTF 和嵌套层分开记录。
3. 先找入口：AutoOpen、Document_Open、Workbook_Open、Auto_Close、Worksheet_Change、AutoExec、Excel 4.0 macro sheet、OpenAction、AA、Launch、CustomAction、CHM script 和 LNK arguments。
4. 先抽结构证据：stream 名称、relationship、content type、VBA module、form、OLE ObjectPool、external link、PDF object id、MSI table、LNK data block。
5. 先提行为假设：进程、命令行、文件、注册表、网络、COM/WMI、PowerShell、URL、域名、IP、路径、User-Agent、互斥体和落地文件名。
6. 先判外链角色：模板、图片、样式、OLE 关系、表单提交、更新检查、下载器、C2 候选和普通业务引用要分开，不把“存在 URL”直接当下载执行。
7. 先做哈希链：原件、工作副本、每层嵌入对象、导出宏模块、PDF 附件、解包脚本和动态日志分别记录 hash，报告中的证据编号能反查父子关系。
8. 先脱敏再报告：IOC 标注来源、角色、置信度和脱敏方式；敏感值只保留哈希、掩码或证据编号。

## 强制流程

### 1. 授权与隔离确认

- 记录授权人、分析目的、样本来源、允许动作、禁止动作、是否允许动态执行、是否允许联网仿真、数据留存和停止条件。
- 准备只读原件、工作副本、隔离 VM、快照、无真实凭据环境、网络黑洞/仿真策略和证据目录。
- 任何外部查杀、云沙箱、在线解包或情报查询都必须确认样本可上传边界。
- 授权不覆盖的动作不得“顺手做”：包括打开远程链接、回放表单、启用宏、提交附件、解密受保护内容、导出客户数据、上传样本和扩大到相邻系统。

### 2. 样本建档与容器识别

- 计算 hash，记录大小、时间戳、文件头、MIME、签名、扩展名和实际容器，不被伪扩展误导。
- Office 先区分 OLE CFB 与 OOXML ZIP；PDF 记录版本、xref 形态和增量更新；LNK/CHM/MSI/OneNote 记录原生结构和嵌套附件。
- 画出外层到内层的结构树：容器、嵌入对象、脚本/宏、附件、外链、压缩层和高熵块。

### 3. 解包与结构证据

- OLE/Office：枚举 Storage/Stream、VBA/dir/project、module、UserForm、ObjectPool、ActiveX、SummaryInformation、custom properties、template 和外部链接。
- OOXML：检查 content types、rels、vbaProject.bin、embeddings、activeX、externalLinks、customXml、docProps、sharedStrings、worksheets、charts 和 media。
- PDF：枚举 catalog、pages、Names、JavaScript、OpenAction、AA、AcroForm、Launch、EmbeddedFiles、RichMedia、object stream、xref 差异和隐藏增量。
- LNK：提取 target、arguments、working directory、icon location、relative path、environment variables、TrackerDataBlock、machine id、timestamps 和 drive/network hints。
- CHM/MSI/OneNote：检查 CHM topic/script/HHK/HHC/HHP、MSI CustomAction/Binary/Property/InstallSequence、OneNote attachments/embedded files/links。
- 对所有解包产物保留父子路径、hash、提取工具版本和是否原样可复现；不得在报告里贴出可直接投递的完整附件、宏或命令链。
- 元数据要单列：作者、公司、模板、LastSavedBy、创建/修改时间、应用版本、PDF Producer、签名、文档属性、路径痕迹和语言区域；只能作为线索，不单独归因。

### 4. 自动执行入口定位

- Office 宏：枚举 AutoOpen、Document_Open、Workbook_Open、Auto_Close、Workbook_Activate、Worksheet_Change、UserForm 初始化、AutoExec、Auto_Open、Excel 4.0 macro sheet 和事件绑定。
- 文档特性：检查 DDE/field/update link、template injection、external relationship、ActiveX/OLE verb、packager object、embedded package 和远程模板。
- PDF：定位 OpenAction、AA、page/action、annotation/action、submitForm、launch、JavaScript name tree 和附件打开路径。
- MSI/CHM/LNK：定位 CustomAction 序列、hh.exe 可触发脚本、LNK 命令行参数和环境变量展开。
- 每个入口都要写清对象路径、模块/对象 id、触发条件、用户交互需求和是否已静态验证。

### 5. 宏 / 脚本 / 命令线索提取

- 对 VBA 记录模块名、过程名、调用链、字符串表、解码层、COM 对象、Shell/WScript.Shell、XMLHTTP、ADODB.Stream、WMI、文件和注册表访问。
- 对 PDF JS 记录 object id、action 字典、API 调用、URL、表单提交、附件调用和 reader 版本依赖。
- 对 LNK/CHM/MSI 记录命令行、参数拼接、环境变量、外部程序、脚本文件、嵌入 binary 和执行序列。
- 复杂脚本只做入口、上下文和风险摘录；深度去混淆或语言级 AST/bytecode 交给 scriptrev。
- 下载器线索只交防御摘要：触发入口、URL/域名脱敏值、落地文件角色、调用 API、检测字段和阻断点；不补齐缺失 payload、不还原可执行下载命令、不提供绕过或投递参数。
- 宏样本逆向只允许输出伪代码级摘要、调用关系、解码层说明、证据编号和检测点；禁止输出可粘贴运行的恶意宏、绕过检测步骤、逃逸条件或 payload 拼装细节。

### 6. IOC 与行为证据提取

- IOC 包括 hash、URL、domain、IP、email、路径、文件名、注册表键、mutex、进程名、命令行、User-Agent、证书、模板 URL 和嵌入对象 hash。
- 每个 IOC 标注来源位置、上下文角色、是否动态观测、强/弱级别、是否环境噪声、脱敏方式和复验状态。
- 行为链按入口、解码、落地、执行、联网、持久化迹象、清理动作和失败分支组织；不补全攻击链可复用步骤。
- 误报控制要列出正常解释和排除证据：企业模板、插件更新、合法安装 CustomAction、签名供应商、内部文件共享、表单提交、PDF 附件工作流和用户业务宏都要单独判断。
- 置信度分层：已验证必须有静态位置或隔离动态证据；推测必须写触发条件和缺口；弱 IOC 不进入阻断建议，除非有多源证据。

### 7. 隔离动态观察

- 仅当静态证据无法确认触发路径时，才在隔离快照里用最小交互观察。
- 禁止连接真实 C2、提交真实凭据、打开真实客户环境、允许外发邮件、真实投递或绕过保护。
- 记录进程树、命令行、文件变化、注册表、网络/DNS、Office/PDF reader 日志、Sysmon/Procmon/EDR 事件、截图和时间线。
- 动态发现必须回填到静态入口，说明触发条件、版本依赖、未触发原因和清理方式。
- 若观察到外联、落地或执行迹象，只记录去武器化命令摘要、进程父子关系、目标角色、脱敏网络指标和阻断点；不复现可投递链路。

### 8. 收口交付

- 输出样本档案、结构树、自动入口、宏/脚本摘要、嵌入对象、IOC、行为链、动态补证、风险、脱敏说明和无法验证项。
- 对高风险内容只给防御证据、检测字段、阻断建议和复验路径；不交付可复用宏、payload、绕过步骤或投递方案。

## 场景执行卡

### Office / OLE / OOXML

- 先判断 CFB、OOXML ZIP、RTF、MHTML 还是伪装容器，列出 VBA、embeddings、activeX、externalLinks、rels、customXml、docProps、template 和 ObjectPool。
- 宏证据必须落到模块名、过程名、入口事件、调用对象、字符串来源和解码前后摘要。
- OOXML 外链要区分模板、图片、worksheet link、OLE object、remote relationship、DDE/update link、packager object 和用户正常引用。
- OLE 要检查 VBA project、dir stream、project stream、UserForm、ActiveX、ObjectPool、SummaryInformation、存储时间戳和嵌入包；VBA 为空不能判定无风险。
- 不直接运行宏；需动态时只在隔离环境观察最小入口。

### VBA Macro / Excel 4.0 Macro

- 枚举 auto entry、event handler、UserForm、隐藏 sheet、defined name、formula macro、API declare 和 COM 创建。
- 检查 Shell、CreateObject、WMI、XMLHTTP、ADODB.Stream、PowerShell、cmd、文件写入、注册表和环境探测。
- 给出行为摘要和证据编号，不重写宏、不补全 downloader、不优化混淆和免杀。

### PDF JavaScript / EmbeddedFiles

- 检查 Catalog、OpenAction、AA、Names/JavaScript、AcroForm、annot action、Launch、RichMedia、EmbeddedFiles 和 incremental update。
- object stream 和增量更新要保留 object id、xref 差异、隐藏/覆盖对象和工具版本。
- PDF JS 只输出 API 调用、触发位置、reader 依赖、IOC 和防御建议，不提供利用 payload。

### LNK / CHM / MSI / OneNote

- LNK 关注 target、arguments、working dir、icon、environment block、TrackerDataBlock、machine id 和 timestamps。
- CHM 关注 HHP/HHC/HHK、topic HTML、script、ActiveX、外链和 hh.exe 触发路径。
- MSI 关注 CustomAction、Binary、Property、Directory、File、InstallExecuteSequence 和条件表达式。
- OneNote 关注附件、嵌入文件、超链接、对象元数据和用户交互入口。
- 分支结论要写清“自动执行、用户点击、安装阶段、帮助页打开、附件双击、仅存储不可执行”中的哪一种；不要把所有嵌入或外链都升级为自动执行。

### 嵌入对象与多层载体

- 对 OLE object、packager object、ActiveX、embedded package、nested ZIP、MHTML、RTF object 和 embedded PE/Script 分层编号。
- 每层记录 hash、大小、容器路径、提取方式、父子关系、是否可执行、是否需要相邻技能。
- 发现 PE/脚本/协议/私有格式时，只交最小输入给 binrev/scriptrev/protrev/fmtrev，不把本技能扩成全栈逆向。

### IOC / 行为 / 脱敏报告

- IOC 表必须包含值、类型、来源位置、上下文、强弱、置信度、脱敏方式和复验状态。
- 行为链必须能回到入口和结构证据；动态现象不能脱离静态入口单独下结论。
- 报告面向防御：检测字段、阻断点、用户交互条件、受影响版本、误报风险、替代解释、排除证据和补证清单。
- 脱敏默认保留可复验性：域名可分段掩码，URL 保留 scheme/host/path 角色，邮箱保留域或 hash，内网路径保留共享层级，命令行保留工具名和参数角色，不保留真实 token、cookie、key、客户名或投递对象。

## 验证门禁

- 授权、样本来源、允许动作、禁止动作、隔离策略、网络策略和停止条件齐全。
- 样本 hash、容器类型、结构树、解包产物、工具版本和证据编号齐全。
- Office/PDF/LNK/CHM/MSI/OneNote 的自动入口已检查或明确不适用。
- 嵌入对象、外链、宏/脚本、IOC 和行为假设有来源位置；无法验证项单独列出。
- 外链、下载器、嵌入对象和自动入口已做误报控制，正常业务解释、排除证据和置信度齐全。
- 动态观察仅在隔离环境进行，并记录快照、输入、触发条件、日志和清理方式。
- 报告已脱敏，不包含宏武器化、钓鱼 payload、规避检测、凭据窃取或真实投递步骤。
- 报告验收必须能回答：样本是什么、入口在哪里、行为证据来自哪、IOC 是否可复验、哪些结论只是推测、哪些动作被授权、哪些内容已去武器化。

## 二轮加固验收门禁

- 真实样本门禁：没有原始样本 hash、来源链路、授权范围、只读原件和工作副本 hash，不得输出“已确认恶意”“已触发”“已提取完整 IOC”等完成性结论。
- 格式分支门禁：必须按实际容器写明 OLE、OOXML、PDF、LNK、CHM、MSI、OneNote、RTF/MHTML 中哪些适用、哪些不适用；只用扩展名或工具标签不能通过验收。
- Office/OLE 门禁：必须覆盖 CFB storage/stream、VBA project、dir/project stream、module、UserForm、ObjectPool、ActiveX、SummaryInformation、模板、外链和嵌入包；缺工具能力时列为未验证。
- OOXML 门禁：必须覆盖 content types、rels、vbaProject.bin、externalLinks、embeddings、activeX、customXml、docProps、media、worksheet/chart 引用和 remote relationship 角色；外链必须分业务引用、模板、图片、对象和下载器候选。
- PDF 门禁：必须覆盖 Catalog、xref、object stream、incremental update、OpenAction、AA、Names/JavaScript、AcroForm、Launch、EmbeddedFiles、RichMedia 和附件路径；未解析 object stream 时不得判定无 JS 或无附件。
- VBA/macro 门禁：必须列入口事件、模块/过程、调用链摘要、字符串来源、COM/API 角色、解码层和用户交互条件；报告只能给伪代码级行为摘要和证据编号。
- 嵌入对象门禁：每层 embedded object、packager、ActiveX、附件、嵌套压缩包、嵌入 PE/脚本都要有父子路径、hash、大小、提取方式、可执行性和相邻技能交接判断。
- Metadata 门禁：作者、公司、模板、LastSavedBy、Producer、签名、路径和语言区域只能作线索；没有投递链、签名和行为证据时必须降级为“元数据线索”。
- IOC 门禁：IOC 必须带来源位置、上下文角色、强弱、置信度、脱敏方式、复验状态和误报解释；弱 IOC 只进补证清单，不直接进入阻断清单。
- 隔离动态门禁：动态只允许在快照、无真实凭据、网络黑洞或仿真环境中最小触发；必须记录输入、工具版本、进程树、文件/注册表/网络/DNS、截图或日志和清理方式。
- 行为证据门禁：行为链必须能回填到静态入口和结构对象；只有动态现象但找不到入口时，结论降级为“隔离观察到的现象，入口未验证”。
- 结论降级门禁：证据不足、工具不支持、样本损坏、加密未授权、外联未触发、版本不匹配、用户交互缺失时，必须降级为推测或无法验证，并写明下一步补证。
- 去武器化门禁：交付物不得包含完整宏体、完整命令链、真实回连地址、绕过参数、投递话术、可复用 payload、凭据、token、cookie、私钥或客户敏感数据。

## 输出要求

1. 边界摘要：授权主体、样本来源、允许动作、禁止动作、隔离/网络策略、停止条件和脱敏规则。
2. 样本档案：SHA256/MD5/SHA1、大小、类型、签名、来源链路、投递路径、接收时间、工具版本、原件/工作副本/派生产物 hash。
3. 结构证据：容器树、解包路径、OLE/OOXML/PDF/LNK/CHM/MSI/OneNote 关键对象、嵌入对象、外链和元数据线索。
4. 入口证据：自动执行入口、对象路径、模块/过程/object id、触发条件、用户交互和版本依赖。
5. 行为与 IOC：脱敏 IOC、来源位置、上下文角色、强弱级别、行为链、动态补证、去武器化处理和置信度。
6. 误报控制：正常解释、排除证据、置信度、弱 IOC 处理、未验证假设和不能下结论的原因。
7. 风险与建议：影响范围、检测/阻断字段、误报风险、补证计划、相邻技能交接和无法验证项。
8. 验收附录：样本 hash 对账、证据编号索引、工具版本、动态环境摘要、脱敏映射说明和不交付攻击复用材料声明。

## 安全边界

允许：

- 授权防御分析、邮件/网关样本复盘、EDR/SOC 告警复核、供应链文档审计、兼容排障、教学/CTF 和脱敏报告。
- 提供结构证据、入口定位、脱敏 IOC、行为链、检测字段、阻断建议、复验路径和相邻技能交接。

拒绝：

- 宏武器化、恶意文档生成、钓鱼 payload、真实目标投递、下载执行链补全、持久化、规避检测、沙箱逃逸、凭据窃取、token/cookie/私钥提取滥用。
- 编写或优化可复用攻击宏、PDF exploit、LNK 投递链、CHM/MSI 执行链、绕过安全产品或社会工程内容。

转向：

- 越界请求改为提供隔离分析流程、检测规则设计思路、脱敏 IOC 交接、用户防护建议和安全处置路径。

## 高频 Bug 反例库

- 反例 1：凭扩展名定类型。错法：看到 .doc 就按 Word 处理。对法：先查魔数、MIME 和容器。根因：文档投递常伪装扩展名。
- 反例 2：只看宏不看容器。错法：导出 VBA 后忽略 rels、embeddings 和外链。对法：容器树和宏入口一起交付。根因：真实入口可能在对象、模板或关系文件。
- 反例 3：遗漏 Excel 4.0 宏。错法：VBA 为空就判无宏。对法：检查 macro sheet、defined name 和公式入口。根因：宏不只存在 vbaProject。
- 反例 4：PDF 只 grep JavaScript。错法：没搜到 /JS 就结束。对法：检查 OpenAction、AA、Names、AcroForm、Launch、EmbeddedFiles 和增量更新。根因：入口可能藏在 action 或覆盖对象里。
- 反例 5：LNK 只看 target。错法：忽略 arguments、environment block 和 tracker。对法：完整解析 shell link data blocks。根因：关键执行信息常在参数和环境变量里。
- 反例 6：MSI 只看文件表。错法：不查 CustomAction 和序列表。对法：检查 Binary、Property、InstallExecuteSequence 和条件。根因：执行逻辑常由安装序列触发。
- 反例 7：动态双击样本。错法：在办公机打开文档看弹窗。对法：静态先行，隔离快照最小触发。根因：样本可能外联、落地或污染证据。
- 反例 8：IOC 裸贴。错法：报告直接贴出 token、内网路径或客户邮箱。对法：脱敏并保留证据编号。根因：防御报告不能制造二次泄露。
- 反例 9：行为分析变 payload 教程。错法：补全宏下载器或 LNK 命令链。对法：只写已观测行为、影响和检测。根因：docrev 不交付攻击复用材料。
- 反例 10：相邻技能边界不清。错法：对嵌入 PE 做完整反汇编。对法：提 hash、容器路径和最小证据后转 binrev/malrev。根因：docrev 的主责是文档载体与入口链。
- 反例 11：外链即恶意。错法：看到 remote relationship 或 URL 就判下载器。对法：结合关系类型、入口、调用 API、用户交互、业务上下文和动态补证。根因：模板、图片、表单和企业链接常见且可能合法。
- 反例 12：忽略脱敏粒度。错法：把完整 URL、邮箱、客户名和命令行贴进报告。对法：按复验需求分级掩码，敏感值用 hash 或证据编号。根因：逆向报告也可能造成二次泄露。
- 反例 13：授权边界口头带过。错法：只写“客户授权”就动态触发。对法：写清允许动作、禁止动作、网络策略、上传边界和停止条件。根因：文档样本容易触发外联和数据泄露。
- 反例 14：只记录原件 hash。错法：派生宏模块、嵌入对象和动态日志没有 hash。对法：原件、工作副本、每层对象和日志分别建 hash 链。根因：报告证据无法复验会削弱结论。
- 反例 15：元数据直接归因。错法：看到作者或 Company 字段就判定攻击者。对法：把元数据列为线索，结合投递链、签名、模板和行为证据。根因：元数据可伪造、继承或由模板污染。
- 反例 16：去武器化不足。错法：报告附上完整宏体、下载命令或绕过参数方便复现。对法：只给证据编号、行为摘要、检测字段和阻断点。根因：防御报告不能变成攻击说明书。
- 反例 17：样本 hash 缺层级。错法：只写原件 SHA256，不给工作副本、嵌入对象、导出宏和动态日志 hash。对法：每个派生产物建父子 hash 链。根因：二次分析无法证明证据来自同一份样本。
- 反例 18：OOXML rels 一概当下载器。错法：看到 external relationship 就写恶意外联。对法：区分模板、图片、worksheet link、OLE 对象、业务链接和下载器候选。根因：OOXML 正常业务外链很多。
- 反例 19：PDF object stream 未解析就下结论。错法：grep 文件没看到关键字就判无入口。对法：解析 object stream、xref 和 incremental update 后再判断。根因：PDF 入口可能在压缩对象或增量覆盖里。
- 反例 20：动态现象脱离静态证据。错法：沙箱里看到进程或网络就直接写样本行为。对法：回填到入口、对象 id、模块和触发条件；回填失败则降级。根因：环境噪声和相邻样本污染会误导结论。
- 反例 21：IOC 没有上下文。错法：把所有 URL、IP、路径、邮箱都列进阻断建议。对法：按来源、角色、强弱、置信度和误报解释分层。根因：弱 IOC 直接阻断会造成业务误伤。
- 反例 22：安全边界被报告绕开。错法：为证明风险补齐宏、命令链或规避参数。对法：保留证据编号、行为角色、检测字段和阻断点，不交付可复用攻击材料。根因：防御交付不能变成复现教程。

## 自检清单

- [ ] frontmatter name 使用规范 canonical `document-macro-reverse-engineering`，兼容 slug 仍为 `docrev`。
- [ ] 行数小于 500，正文 0 fenced code block。
- [ ] 覆盖 Office/OLE/OOXML、VBA macro、PDF JavaScript、LNK、CHM、MSI、OneNote、嵌入对象和自动执行入口。
- [ ] 覆盖解包/结构证据、IOC/行为提取、静态优先、隔离动态观察和脱敏报告。
- [ ] 覆盖授权边界、样本 hash 链、metadata、去武器化、报告验收和行为证据回填。
- [ ] 覆盖二轮加固门禁：真实样本验收、样本 hash 分层、OLE/OOXML/PDF 分支、VBA/macro、embedded objects、IOC、隔离动态、结论降级和安全边界。
- [ ] 覆盖误报控制、外链/下载器角色区分、弱 IOC 分层和正常业务解释排除。
- [ ] 反例和场景卡是 docrev 专属，不是通用逆向模板。
- [ ] 明确拒绝宏武器化、钓鱼 payload、规避检测、凭据窃取和真实目标投递。
- [ ] 相邻技能边界能排除只读学习、普通文档编辑、SDK 文档校验、scriptrev/malrev/fmtrev 更适合场景和无授权请求。

## 相邻技能边界

- 逆向工程总控/reverse-engineering（slug: rev）：授权逆向总控、样本接收、证据链门禁和跨技能路由；文档与宏样本逆向负责文档载体专项。
- 脚本与字节码逆向/scriptrev（slug: scriptrev）：已提取的 VBA/PowerShell/JS/Python/VBS/BAT/Lua 深度去混淆、AST/bytecode 和脚本配置；文档与宏样本逆向负责文档容器、宏提取、入口和嵌入对象。
- 恶意样本防御逆向/malrev（slug: malrev）：恶意样本家族研判、沙箱报告复核、YARA/Sigma/capa、ATT&CK/MBC/MAEC、SOC/IR 总交接；文档与宏样本逆向提供文档入口和 IOC 证据。
- 文件格式与私有格式逆向/file-format-reverse-engineering（slug: fmtrev）：未知文件格式字段建模、checksum、offset table、TLV/varint、round-trip 和 parser 兼容；文档与宏样本逆向只做已知文档容器层取证。
- 通用二进制逆向/binary-reverse-engineering（slug: binrev）：嵌入 PE/DLL/shellcode 的二进制逆向；文档与宏样本逆向只提取 hash、容器路径、落地关系和最小行为线索。
- 授权私有协议逆向/protrev（slug: protrev）：pcap、HTTP/DNS/TLS 交互、协议字段和网络时间线；文档与宏样本逆向只交文档内 URL、命令行和初始网络 IOC。
- 测试验证/test-engineering（slug: tst）/ 代码审计/code-audit（slug: aud）：检测规则、报告、修复或工具改动完成后的验证矩阵和质量收口。