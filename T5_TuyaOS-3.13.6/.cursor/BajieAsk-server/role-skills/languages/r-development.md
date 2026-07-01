---
name: r-development
description: R 语言开发闭环 - R 4.4/4.5、R 脚本、tidyverse/dplyr/tidyselect、data.table、NA/NaN/factor/timezone、Shiny、Quarto/RMarkdown、renv/pak、R 包工程、devtools/testthat/usethis/lintr、targets、Rcpp、Arrow/DuckDB/DBI、统计建模、reticulate、CI 与部署运行时。涉及 DESCRIPTION/NAMESPACE/Roxygen/testthat/usethis/devtools/lintr/pkgdown/revdepcheck/cran-comments、targets/_targets.R、Shiny module/reactlog、DBI/dbplyr 或 R 侧可复现验证时必须使用。
---
# R 语言开发

R 语言开发（r-development，兼容 slug: rdev）负责本技能描述范围内的定位、执行、验证和交接边界；旧短 slug 仅作兼容 alias/URL 主键，不作为规范技能名。

> 定位：把 R 分析、报告、应用、DAG 和包工程从“本机能跑”收口到“环境可复现、入口可重跑、数据/统计证据可复核、发布风险可回滚”。
> 铁律：未确认 R 版本、包库、入口、输入数据、随机性、timezone/locale、互操作环境和日志证据，不判断根因；未执行验证，不声称修复。

## 触发词

R、Rscript、RStudio、Rproj、DESCRIPTION、NAMESPACE、Roxygen、roxygen2、testthat、usethis、devtools、lintr、pkgdown、revdepcheck、cran-comments、CRAN、Bioconductor、renv、pak、targets、_targets.R、tar_target、dplyr、tidyselect、across、pick、if_any、if_all、join_by、relationship、unmatched、vctrs、data.table、setindex、setkey、Shiny、Shiny module、moduleServer、reactlog、profvis、bslib、bindCache、Quarto、RMarkdown、Rcpp、Arrow、DuckDB、DBI、dbplyr、reticulate、Plumber、Posit Connect。

## 快速总则

1. 版本先固定：记录 R 4.4/4.5 或目标 R、RStudio/Posit IDE、RTools/Xcode/gfortran、OS/arch、CRAN/Bioconductor 源、包版本、renv/packrat/pak 状态。
2. 环境先隔离：从干净 R session、项目根、固定 timezone/locale/encoding、.Rprofile/.Renviron、环境变量、Python/系统库差异开始。
3. 入口先唯一：脚本、Quarto/RMarkdown、Shiny、Plumber、targets、R package、cron、CI、Posit Connect 必须能一条命令重跑。
4. 数据先验明：schema、行数、主键、hash、列类型、factor levels、Date/POSIXct、NA/NaN/Inf、编码、小数点、分隔符先查再改。
5. 语义先分清：dplyr/tidyverse 返回新对象；data.table 的 :=、set、setDT、setnames、setkey/setindex 可原地修改；函数边界必须说明副作用。
6. 向量化先审计：逐元素、逐行、循环、recycling、长度 0、长度 1、list-column、matrix/array、S3 向量类和 vctrs coercion 必须确认语义后再优化。
7. 随机性先落证：set.seed、RNGkind、并行 RNG、抽样/重采样分层、训练/验证拆分和外部模型 seed 必须记录；未固定随机性，不比较指标。
8. 统计先锁口径：样本定义、纳入排除、缺失策略、公式、随机种子、假设诊断、效应量/指标、置信区间、限制必须可追溯。
9. 性能先测量：bench、system.time、profvis、Rprof、lobstr、gc、DB query plan 先定位 CPU、内存、I/O、下推、并行或图形设备瓶颈。
10. 安全先降敏：凭证、PII/PHI、原始明细不得进入 .Rhistory、.RData、日志、HTML、Shiny session、测试 fixture、外部 AI/LLM 服务。
11. 修改先复现：未复现原错误或未构造最小数据，不硬改分析逻辑；连续两次无效必须回到入口、数据、版本和调用方复盘。
12. 收口先证据：原路径、相邻路径、render/check/test/smoke、产物 hash、日志和回滚风险必须明确；缺口写“未验证”。

## P0 执行卡

### P0-1. R 包日常闭环：devtools / testthat / usethis / lintr

- 适用：DESCRIPTION、NAMESPACE、Roxygen、testthat、usethis、devtools、lintr、pkgdown、revdepcheck、cran-comments 或 CRAN 发布相关改动。
- 流程：create_package/use_* 建结构与依赖边界；roxygen2::roxygenise 或 devtools::document 生成 NAMESPACE/Rd；testthat 覆盖 API、错误和边界；lintr/style 收口；devtools::check 或 R CMD check --as-cran；release 前核 cran-comments、NEWS、revdepcheck、pkgdown 和反向兼容。
- 先查：Imports/Suggests/LinkingTo、Config/testthat/edition、Encoding、License、SystemRequirements、native routine 注册、S3/S4 方法导出、示例是否联网/写用户目录/耗时、跳过项理由。
- 验证：check 目标 0 ERROR 0 WARNING；NOTE 逐条解释；跨 OS/R 版本矩阵按风险跑；testthat 失败要给最小输入；未跑 release/revdepcheck 不声称可上 CRAN。

### P0-2. targets DAG / cache / 动态分支 / 远端存储 / 并行

- 适用：_targets.R、tar_target、tarchetypes、动态分支、云/共享存储、并行执行、缓存命中异常、产物过期或不可重跑。
- 先查：tar_manifest/tar_visnetwork、target 依赖、format、cue、seed、resources、storage/repository、packages/imports、全局对象与文件输入 hash。
- 动作：目标函数化且无隐式全局状态；动态分支声明 pattern/map/cross；大对象用合适 format 与 repository；并行记录 crew/future backend、workers、RNG 和资源上限；远端存储核权限、版本和清理策略。
- 验证：tar_make/tar_make_future、tar_outdated、tar_meta、关键 target hash/行数/类型；从干净 session 重跑；缓存命中/失效理由可解释。

### P0-3. Shiny：bslib / moduleServer / reactlog / profvis / bindCache

- 适用：Shiny UI/server/module、bslib 主题、moduleServer、reactive 循环、首屏慢、bindCache、部署后串数据或权限错误。
- 先查：module id/namespace、reactive 图、observeEvent/eventReactive 边界、全局变量、session 生命周期、连接池、上传/下载路径、HTML/SQL/文件输入、缓存 key、日志脱敏。
- 动作：业务逻辑抽纯函数；模块用 moduleServer/testServer；req/validate/need 给用户可理解错误；reactlog 定位依赖环和无效失效；profvis 定位首屏/交互瓶颈；bindCache key 包含用户、权限、参数和数据版本；bslib token 不破坏 a11y。
- 验证：testServer/shinytest2 覆盖关键交互、错误态、权限、并发会话、上传下载、缓存失效；生产日志不暴露堆栈、路径、凭证；部署 smoke 验证多用户不串 session。

### P0-4. dplyr/tidyselect：across / pick / if_any / if_all / join_by / relationship / unmatched / vctrs

- 适用：select/mutate/summarise/filter/join/group_by 后口径错、行数暴涨、字段丢失、dplyr 1.1+ 升级告警或包内 tidy evaluation NOTE。
- 先查：每步输入输出列、grouped_df 状态、rowwise 状态、tidyselect 范围、across/pick 返回类型、if_any/if_all NA 语义、join key 唯一性、join_by 条件、relationship、unmatched、multiple、vctrs coercion。
- 动作：包内用 .data[[col]]、{{ arg }}、all_of/any_of；join 前后写行数断言并声明 relationship/unmatched/multiple；离开分组显式 ungroup；类型合并用 vctrs 规则或显式转换；复杂 pipeline 拆函数，避免把 tidyverse 语义套到 data.table 原地对象。
- 验证：最小数据覆盖重复 key、缺失 key、NA、NaN、Inf、空分组、类型变化、边界日期、异常枚举；断言列名、行数、类型和 group 状态。

### P0-5. data.table 二级索引 / setkey / by-reference 副作用审计

- 适用：大数据清洗、join 变慢、函数调用后对象意外改变、setindex/setkey 优化、二级索引或 key 影响排序/结果。
- 先查：对象是否被 setDT、:=、set、setnames、setcolorder、setkey、setindex 原地修改；key/index、排序副作用、线程数、allow.cartesian、nomatch、mult、滚动/非等值 join。
- 动作：函数承诺无副作用时先 copy；需要副作用时在函数名/文档/测试中声明；setindex 保留原顺序但影响查询计划，setkey 会重排数据；批量合并用 rbindlist；fread/fwrite 显式类型、encoding、na.strings、integer64 和 nThread。
- 验证：记录 key/index 前后、地址/副本行为、行数变化、排序、峰值内存、耗时；小样本和全量各跑一次；测试顺序随机化或重建 fixture 防穿透。

### P0-6. 可复现分析闭环：seed / renv / session / 报告证据

- 适用：抽样、仿真、bootstrap、交叉验证、模型训练、报告重跑、同事/CI/生产结果不一致。
- 先查：set.seed 位置、RNGkind、并行 RNG、train/test split、sessionInfo、renv.lock、系统库、timezone、locale、BLAS/OpenMP 线程、输入数据 hash。
- 动作：把随机性、依赖、参数和输入版本写进入口日志或报告 appendix；renv restore 后再跑测试或 render；训练集预处理不能偷看验证/测试集。
- 验证：同一入口至少重跑两次对关键指标、图表数据、模型对象摘要、产物 hash 或容差断言；不能复现时明确漂移来源。

### P0-7. data.frame / tibble / 向量化 / 缺失与因子语义

- 适用：基础 data.frame、tibble、matrix/list-column、apply/map/vectorize、ifelse/case_when、factor/ordered factor、NA/NaN/Inf 处理或旧脚本循环改写。
- 先查：对象 class、dim、names、row.names、列类型、list-column、长度、recycling、缺失哨兵值、factor levels/order、contrasts、units、Date/POSIXct timezone、attributes 和 S3 方法。
- 动作：向量化前先写等价小样本断言；避免 apply 把 data.frame 隐式转 matrix；ifelse 易丢 class，优先按类型显式处理；case_when 保持类型一致；factor 先保留原字符值再重编码；缺失策略区分未知、未适用、空字符串、NaN、Inf 和业务哨兵值。
- 验证：覆盖空数据、单行、长度 0/1/n、部分 recycling、未知 level、缺失 level、全 NA、NaN/Inf、日期时区、list-column 和 attribute 保留；结果断言 class、长度、列顺序、levels、attributes、行数和 hash。

## 主链路执行卡

### 1. R 脚本 / RStudio Project / 项目入口

- 适用：RStudio 能跑、命令行/CI/同事环境失败，路径、全局对象或交互状态导致漂移。
- 先查：Rproj、工作目录、here/rprojroot、source 顺序、.RData、.Rhistory、.Rprofile、.Renviron、参数文件、入口命令。
- 动作：流程拆为配置读取、数据导入、校验、转换、统计/模型、可视化、导出、日志；删除对交互对象、绝对路径和手工产物的隐式依赖。
- 验证：关闭 workspace 保存，从新 R session 执行入口；记录 R 版本、OS、locale、timezone、命令、输出 hash 或关键断言。

### 2. 数据导入 / tibble / factor / NA / timezone

- 适用：CSV/Excel/Parquet/数据库导入、类型漂移、乱码、缺失异常、行数不一致、时间偏移。
- 先查：文件 hash、编码、分隔符、小数点、NA 字符、col_types/colClasses、factor levels、ordered factor、Date/POSIXct 时区、主键、schema、行数。
- 动作：生产读取显式类型；字符 ID 禁转 numeric；factor 转换前保留原值和 levels；NA/NaN/Inf/空字符串/哨兵值策略写入日志；导出声明字段顺序、编码和 timezone。
- 验证：比较导入前后行数、主键唯一性、缺失率、枚举值、时间范围、时区往返；抽样核对原始记录。

### 3. Quarto / RMarkdown

- 适用：报告不可重跑、缓存错、参数漏、HTML 泄露、PDF 字体或 Quarto freeze 差异。
- 先查：YAML、params、execute/cache/freeze、chunk label、工作目录、资源路径、外链、敏感明细、浏览器/PDF/LaTeX 工具链。
- 动作：新项目优先 Quarto；旧 RMarkdown 保持兼容；参数化时间窗和输出路径；关键 chunk 禁危险缓存或绑定输入 hash/mtime。
- 验证：无交互 render；记录命令、参数、输出文件、warning/message/error 策略；检查 HTML widget 体积和隐私。

### 4. renv / pak / CRAN / Bioconductor

- 适用：本地能跑 CI 不能跑、restore 失败、包升级回归、CRAN/Bioconductor check 不通过。
- 先查：R 版本、renv.lock、renv profile、pak lock/metadata、Repositories、Bioconductor 版本、GitHub 包 SHA、系统库、user library、cache 路径、二进制/源码安装差异。
- 动作：安装或升级后跑测试再 snapshot；不提交本地 library；锁定包源和 Bioconductor 版本；Rcpp/编译包记录系统工具链；CRAN 兼容需无网络、无写用户目录、示例可跳耗时外部依赖。
- 验证：renv::status 干净、从空库 restore 可重现、R CMD check 0 ERROR 0 WARNING，NOTE 逐条解释；必要时联动 SBOM/许可证扫描。

### 5. R 包 / Rcpp / 原生扩展

- 适用：R package API、Rcpp/C/C++/Fortran、ALTREP/long vector/OpenMP、跨平台编译失败。
- 先查：DESCRIPTION/NAMESPACE/Roxygen、注册表、PROTECT、随机数、NA/NaN、长度 0、越界、Windows UCRT/macOS arm64/Linux 工具链。
- 动作：导出 API 最小化；错误信息稳定；示例不联网；Rcpp 边界校验类型、长度、NA、越界；跨平台避免硬编码编译参数。
- 验证：devtools::check 或 R CMD check --as-cran；必要时矩阵跑 Windows/macOS/Linux 与 R 4.4/4.5，revdepcheck 风险逐条说明。

### 6. Arrow / DuckDB / DBI / dbplyr

- 适用：Parquet/Arrow/DuckDB/dbplyr 下推、DBI 查询/写入、collect 后结果变、timezone/factor/category 漂移、内存突然暴涨。
- 先查：后端版本、schema、lazy query、collect 边界、SQL 翻译、timestamp timezone、factor/category、整数位宽、NULL/NA 语义、文件分区、连接池、事务和权限。
- 动作：能下推的过滤/聚合留在后端；R 自定义函数前显式 collect 并限量；跨引擎读写固定 schema 和 timezone；DBI 外部输入参数化，不拼 SQL；批量写先 dry-run/SELECT 影响面并包事务。
- 验证：比较执行计划、行数、hash、关键列类型、时间范围、内存峰值、连接释放、事务回滚和抽样明细。

### 7. 统计 / 模型 / 可视化结论

- 适用：统计检验、回归、分类/预测、时间序列、生存分析、tidymodels、ggplot2/htmlwidgets 报告结论。
- 先查：目标变量、样本定义、纳入排除、时间窗、混杂因素、权重、重复测量、factor 基准、缺失机制、数据泄漏、假设适用性、绘图尺度和二次聚合。
- 动作：预处理只 fit 训练集；公式、对照组、假设和替代方案写清；模型诊断、稳健性、校准、偏差/公平性、交叉验证或滚动验证按风险选择；图表函数化并固定尺寸、DPI、字体、设备，交互图只暴露最小字段。
- 验证：报告效应量/指标、置信区间、样本量、诊断结果、限制；随机性固定，浮点断言使用容差；绘图数据行数、分组、尺度和导出文件可断言。

### 8. 内存 / 性能 / 并行

- 适用：内存不足、速度慢、并行结果不一致、CI 超时、Shiny 雪崩。
- 先查：对象大小、复制次数、vector 化机会、I/O、数据库 collect、线程数、BLAS、parallel/future/furrr backend、fork/PSOCK 平台差异、RNG、容器/CI 内存上限。
- 动作：减少复制、预分配、按列读取、分块、数据库下推、Arrow/DuckDB、data.table、缓存；避免一次 collect 全表；并行先保证 RNG、错误日志和资源上限。
- 验证：优化前后同一数据规模、硬件、线程、命令、耗时、峰值内存；确认结果等价而非只变快；大数据只抽样验证时必须说明全量未跑。

### 9. R/Python 互操作

- 适用：reticulate、basilisk、conda/venv/uv、pandas/pyarrow 往返、R 模型调用 Python 或 Python 调 R。
- 先查：Python 发现顺序、RETICULATE_PYTHON、环境锁文件、Python 包版本、系统库、Arrow/pandas 类型映射、factor/category、NA/NaN/None、POSIXct timezone、随机种子。
- 动作：固定 R 与 Python 双端环境；跨语言交换优先显式 schema；factor/category levels、时区、整数位宽和缺失语义写入转换层；随机性分别配置并记录。
- 验证：双端 session info、样本抽查、行数/hash、关键列类型、预测/指标容差、时区往返和 CI 中 Python 选择结果。

### 10. 测试 / CI / 部署运行时

- 适用：testthat、snapshot/vdiffr、shinytest2、render、R CMD check、Plumber、Posit Connect、Shiny Server/ShinyProxy、container、cron。
- 先查：测试入口、fixture 来源与脱敏、随机性、字体/设备、外部依赖、CI OS/R 版本/包源矩阵、bundle 内容、系统依赖、secrets 注入、健康检查、资源限额、日志位置、回滚版本和数据版本。
- 动作：testthat 3e 组织单元/集成；统计断言用容差；最小脱敏 fixture 或合成数据覆盖边界；发布包包含 renv.lock、系统依赖说明、配置样例、只读/写路径分离、请求体限制、参数校验、healthcheck、资源上限和回滚命令。
- 验证：记录 R CMD check、testthat、render、shinytest2、vdiffr、Plumber/Shiny smoke、远端环境重跑、敏感日志、产物可访问性和旧版本回滚路径。

## 高频坑 / 防遗漏

- dplyr 1.1+ join 未声明 relationship/unmatched/multiple，升级后告警或行数口径变化。
- tidyselect 选择范围和 vctrs 类型合并在包内/升级后变化，需用 all_of/any_of/.data/显式转换。
- group_by 后忘记 ungroup，后续 mutate/summarise/比例/排名继续按组计算。
- NA 在 filter 中不是 FALSE；NaN/Inf/空字符串/哨兵值不是同一种缺失；ifelse、if_else、case_when 对 NA、类型、长度行为不同。
- factor 直接 as.numeric 得到 level code，字符 ID 自动转数值会丢前导零，POSIXct 未指定 timezone 会跨环境漂移。
- data.table 原地修改穿透函数边界，setkey 重排数据，setindex 改查询计划，测试顺序改变后结果漂移。
- RStudio 交互环境有对象，命令行或 CI 从干净 session 失败。
- Quarto cache/freeze 或 RMarkdown cache 让旧图旧表混入新代码结果。
- renv.lock 未同步，pak/CRAN 源、系统库、R 小版本或 Bioconductor 版本差异导致 restore/编译失败。
- set.seed 只写在脚本末尾或并行前未设 RNG，模型指标、bootstrap 或分支 target 结果不可复现。
- targets 隐式全局对象、文件输入未入 DAG、动态分支 seed/资源未锁，导致缓存错误或不可重跑。
- Shiny 全局变量、连接、缓存、临时文件跨用户共享，bindCache key 漏用户/权限/数据版本会串数据。
- Rcpp 漏 PROTECT、越界、NA 类型处理错误，本地小样本不暴露，CRAN/生产崩溃。
- Arrow/DuckDB/dbplyr 未核 SQL 下推和 collect 边界，结果口径或内存用量与本地 tibble 不同。
- DBI 拼接 SQL、忘记参数化/事务/影响面 SELECT，既有注入风险也容易误写全表。
- reticulate 在本机和 CI 选择不同 Python，导致包版本、数值结果或模型路径漂移。
- plotly/htmlwidgets tooltip 或嵌入数据把脱敏前字段带入 HTML。
- Docker/运行时缺系统库或 BLAS/OpenMP 线程失控，本地快、生产慢。

## 低级错禁止

- 禁止只看最后一行结果就改 pipeline；必须记录关键节点行数、列名、类型和分组状态。
- 禁止把 warning 当噪音吞掉；dplyr join、factor coercion、timezone、partial recycling、NAs introduced by coercion 都要判定影响。
- 禁止在包函数中依赖全局 option、工作目录、.GlobalEnv、交互选择、系统 locale 或当前日期；必须参数化或显式记录。
- 禁止测试只覆盖 happy path；最少覆盖空数据、单行、重复 key、缺失 key、NA/NaN/Inf、未知 factor level、时区边界和大于内存预期的样本。
- 禁止为跑快而提前 collect 全表、丢弃 NA、改统计公式、跳过权限过滤或把真实明细塞进快照/HTML。

## 反例库

- “本地 RStudio 能跑，所以 CI 失败是环境问题”：反例，先用干净 session、入口命令、renv restore 和 sessionInfo 证明差异。
- “join 后只多几行不重要”：反例，先声明 relationship/unmatched/multiple 并解释重复 key 业务含义。
- “factor 转数字很方便”：反例，先转字符再按业务规则解析，并验证 levels 和异常值。
- “向量化就是把 for 循环换成 apply”：反例，apply 可能改类型、丢属性或触发回收，先用小样本断言等价。
- “NA、NaN、空字符串和 0 都算缺失”：反例，缺失语义必须按业务来源分层，统计和模型前要保留处理日志。
- “Shiny cache 只按参数即可”：反例，缓存 key 必须包含用户、权限、数据版本和影响输出的输入。
- “统计显著就能写结论”：反例，必须给样本定义、假设诊断、效应量/置信区间、限制和可复现随机性。
- “R CMD check 有 NOTE 可以忽略”：反例，NOTE 要逐条解释；CRAN/发布相关 NOTE 未解释不能报可发布。

## 真实验收矩阵

- 基础脚本/数据：从干净 session 跑唯一入口；记录命令、R 版本、sessionInfo、输入 hash、schema、行数、缺失率、factor levels、timezone 和输出 hash。
- tidyverse/data.table：对关键 pipeline 写最小 fixture；断言列名、行数、类型、group 状态、join relationship/unmatched/multiple、key/index、排序和副作用。
- 统计/模型：固定 seed/RNGkind；断言样本量、公式、预处理拟合边界、指标/效应量容差、诊断结果、限制和两次重跑一致性。
- RMarkdown/Quarto/Shiny：无交互 render 或 testServer/shinytest2；检查参数、缓存/freeze、HTML 敏感字段、错误态、权限、并发、上传下载和 smoke 日志。
- 包工程/发布：devtools::document、testthat、lintr、R CMD check 或 devtools::check；0 ERROR 0 WARNING，NOTE 逐条解释，未跑 revdep/CRAN 矩阵就不得报可发布。
- 性能/大数据：同一数据规模、硬件、线程和命令做优化前后对比；记录耗时、峰值内存、下推计划、collect 边界和结果等价断言。

## 输出要求

- 必给：结论、证据、改动/建议清单、验证命令与结果、未覆盖风险。
- 环境类：给 R/RStudio/OS/工具链/CRAN/Bioconductor/renv/pak/Python/运行入口差异和复现路径。
- 数据类：给 schema、行数、主键、缺失、类型、factor levels、timezone、hash、样本脱敏口径和导入导出参数。
- 统计/模型类：给样本定义、公式/方法、假设诊断、效应量/指标、随机性控制和限制。
- 图表/报告类：给绘图数据行数、分组、尺度、坐标轴、导出设备、尺寸、DPI、字体、输出文件和隐私检查。
- Shiny/Plumber/安全类：给输入来源、危险点、权限边界、脱敏、日志、并发、资源限制和发布面。
- 发布/回滚类：给环境锁定、系统依赖、配置、监控、smoke test、回滚版本和剩余风险。

## 约束

- 未拉取或读取必要输入、schema、日志、入口和调用方，不得判断根因或修改分析逻辑。
- 未复现原 bug，不得宣称已修复；只能列证据缺口和下一步。
- 未固定随机性、timezone、locale、依赖和互操作环境，不得声称统计结果、模型指标或报告可重复。
- 未跑 render/check/test/smoke，不得声称 Quarto、RMarkdown、Shiny、Plumber 或 R package 已验证。
- 不得把敏感数据、凭证、原始明细发给外部服务、LLM、公开 issue 或无授权包服务。
- 不得为性能牺牲统计口径、缺失处理、权限隔离和数据安全。
- 不把通用数据平台、Python 迁移、DB schema、CI/CD 发布或 SRE 告警职责混入 R 侧；只写 R 端证据与联动边界。

## 提交前自检清单

- [ ] R 4.4/4.5 或目标版本、RStudio、OS、CRAN/Bioconductor 源、工具链、renv/pak 状态已记录。
- [ ] 入口可从干净 session 重跑，不依赖全局对象、绝对路径或手工产物。
- [ ] data.frame/tibble/data.table、vector、factor、NA、日期时区、编码和 schema 已验证。
- [ ] dplyr/tidyselect join/group/filter/mutate/summarise 行为、relationship/unmatched 和行数变化已断言。
- [ ] data.table 原地修改、key/index、线程和内存副作用已说明。
- [ ] targets DAG、cache、动态分支、远端存储和并行 RNG/资源已验证。
- [ ] Shiny moduleServer/reactlog/profvis/bindCache、权限、并发、上传下载和错误态已覆盖。
- [ ] Arrow/DuckDB/dbplyr 的下推、collect、timezone、factor/category 边界已验证。
- [ ] R/Python 互操作环境、类型映射、随机性、hash 和抽样核对已覆盖。
- [ ] Quarto/RMarkdown 可无交互 render，缓存/freeze 和敏感输出已检查。
- [ ] renv.lock、pak、CRAN/Bioconductor、R CMD check、Rcpp/系统依赖风险已处理。
- [ ] 统计模型有假设、诊断、验证、复现性、校准/偏差检查和限制说明。
- [ ] 测试矩阵含 testthat、lintr、snapshot/vdiffr、shinytest2、render、R CMD check、fixture 脱敏和 CI 版本策略。
- [ ] 日志、隐私、部署、资源限制、回滚、tst 和 aud 收口证据齐全。

## 相邻技能边界

- 数据工程/data-engineering（de） 负责 CDC/Kafka/Flink/Spark/dbt/湖仓表设计；R 语言开发/r-development（rdev） 只负责 R 读取、转换、校验、Arrow/DuckDB/dbplyr collect 边界和统计证据。
- Python 开发/python-development（pyd） 负责 Python 端实现；R 语言开发/r-development（rdev） 负责 reticulate 选择证据、R 端类型/factor/NA/timezone 和跨语言数据一致性。
- 发布部署/release-engineering（rls） 负责 CI/CD、artifact、运行时发布、监控和回滚流程；R 语言开发/r-development（rdev） 提供 R 版本、依赖锁、系统依赖、入口命令、render/check/smoke 要求。
- 代码审计/code-audit（aud） 负责最终需求对账、diff 影响面、安全质量收口和证据缺口；R 语言开发/r-development（rdev） 提供 R 侧实现、数据、统计和验证证据。
- 测试验证/test-engineering（tst） 负责测试矩阵、回归策略、CI 证据、flaky 判断和发布冒烟覆盖；R 语言开发/r-development（rdev） 提供 testthat、shinytest2、vdiffr、render、R CMD check、统计容差和脱敏 fixture 口径。