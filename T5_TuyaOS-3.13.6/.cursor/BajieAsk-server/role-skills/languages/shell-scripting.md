---
name: shell-scripting
description: Shell脚本实战排障版 - Bash/Zsh/POSIX sh、deploy/build/CI 脚本、cron/systemd、文本处理、curl/jq/yq、ssh/scp/rsync、权限、并发锁、secret 与破坏性操作排障。涉及 .sh/.bash/.zsh、命令编排、自动化部署、运维脚本或非交互 shell 失败时必须使用。
---

# Shell Scripting实战排障版

> 定位：把 Shell 任务从“本机能跑”收口到“Shell 明确、平台差异明确、入口可复现、证据可验证、失败可回滚”。本技能只负责脚本语义、命令编排、运行环境、文本/JSON/YAML 处理、远程命令、权限、并发、危险操作和泄密风险。
> 铁律：未确认 Shell、平台、入口、证据前不改；未复现不下结论；破坏性命令先边界校验和 dry-run；secret 不进日志、不进命令行、不进提交。

## 快速总则：Shell / 平台 / 入口 / 证据

1. Shell：先确认 shebang、实际调用方式和语法目标，是 bash、zsh 还是 POSIX sh；bash 才能用数组、[[ ]]、进程替换、pipefail，POSIX sh 禁止 bashism，zsh 脚本不要依赖交互 setopt、alias、.zshrc。
2. 平台：记录 macOS / Linux / Alpine / BusyBox / CI 镜像差异；GNU/BSD 的 sed、grep、awk、date、stat、readlink、xargs、timeout 参数不能裸跨平台。
3. 入口：确认从终端、CI、cron、systemd、ssh、sudo、make/npm、Docker ENTRYPOINT 哪个入口执行；同步工作目录、PATH、env、umask、用户、权限、tty、stdin、锁和日志。
4. 证据：改前必须保留原命令、退出码、stdout/stderr、运行用户、pwd、env 关键项、输入样本、目标平台版本；改后用同入口复验，未跑写“无法验证”。
5. 输入默认不可信：参数、文件名、URL、分支名、JSON/YAML 字段、远端主机、环境变量、LLM 输出都可能触发分词、通配、注入或删除事故。
6. 严格模式不是银弹：set -euo pipefail 只在确认 bash 语义时使用；条件、管道、命令替换、后台任务、ERR trap、可预期失败都要显式处理。
7. 文本/结构化数据优先用工具：JSON 用 jq --arg/--argjson，YAML 用 yq 且固定实现版本；禁止把结构化数据用 grep/sed 拼接后当可信配置。
8. 远程和网络默认超时：curl/ssh/scp/rsync 必须有连接/总超时、状态码/退出码检查、重试边界、部分失败汇总和可诊断日志。
9. 临时文件、权限、secret 一起看：mktemp、trap、umask、chmod/chown/install、原子 rename 成组处理；set -x、ps、history、artifact、journal 中不能泄露 token。
10. 并发默认收口：后台 &、xargs、parallel、flock、锁文件、共享输出都要有并发上限、失败聚合、空输入处理和可重入策略。
11. 危险操作先证明目标：rm、mv 覆盖、chmod/chown -R、rsync --delete、远端 sudo、批量 kill 必须校验非空、前缀、存在性、符号链接、dry-run 和回滚路径。
12. 静态检查只作证据之一：shellcheck、shfmt、bash -n、dash -n、目标容器内试跑不能互相替代；格式通过不等于业务通过。

## 场景执行卡

### 1. 新脚本 / 参数解析 / 入口契约

- 先查：目标 Shell、调用方、必选参数、默认值、依赖命令、是否非交互、是否要 dry-run/help/version。
- 执行：shebang 与语法一致；main 函数收口；参数用 case 循环；未知参数失败；空字符串和缺参分开；日志函数不打印 secret。
- 验证：--help、缺参、未知参数、含空格/换行参数、重复执行、CI/cron 最小环境、bash/zsh/dash 目标解释器。
- 易漏：用 /bin/sh 跑 bash 数组；脚本靠当前目录；把 zsh alias/function 当脚本依赖；帮助文本与实际参数漂移。

### 2. 文件 / 路径 / 删除 / 幂等

- 先查：路径来源、是否可为空、是否含空格/换行/通配符、是否符号链接、是否跨文件系统、权限和 umask。
- 执行：变量和命令替换默认双引号；危险目录做非空、绝对路径、前缀和存在性校验；临时文件用 mktemp；写文件先临时文件再原子替换；删除先列目标再 dry-run。
- 验证：空路径、根目录、上级目录、文件不存在、权限不足、符号链接、只读文件系统、重复运行、中途失败后清理。
- 易漏：rm -rf $dir/* 在 dir 空时炸；chmod -R 追到软链；install/cp 保留权限不符合预期；mv 跨文件系统非原子。

### 3. 文本处理 / grep / sed / awk / jq / yq

- 先查：输入格式是否稳定、编码、换行、NUL 字符、字段是否可空、GNU/BSD/BusyBox 工具版本、jq/yq 实现版本。
- 执行：逐行读取保留 IFS 并用 -r；文件名列表优先 NUL 分隔；jq 用 --arg/--argjson 并检查 null；yq 先确认 mikefarah yq 还是 python yq；sed -i 做平台分支或临时文件。
- 验证：空文件、非法 JSON/YAML、缺字段、字段为 null、制表符、文件名含换行、macOS/Linux/Alpine 目标环境。
- 易漏：for f in $(ls)；grep 成功等于业务成功；jq -r null 变字符串 null；BSD xargs 无 -r；sed -i 在 macOS 需要备份参数。

### 4. curl / API / 下载 / 状态码

- 先查：认证方式、token 来源、代理、TLS、重定向、超时、重试策略、响应是否可能不是 JSON、是否允许部分成功。
- 执行：设置 connect-timeout 和 max-time；同时检查 curl 退出码、HTTP 状态、响应体 schema；失败日志脱敏；下载校验大小/hash；token 避免命令行参数。
- 验证：DNS 失败、超时、401/403/404/429/5xx、非 JSON 响应、空响应、重定向、代理/TLS 失败、限流重试。
- 易漏：curl 0 但 HTTP 500；管道到 jq 后丢原始 body；重试非幂等 POST；set -x 打出 Authorization。

### 5. ssh / scp / rsync / 远程批量执行

- 先查：host key 策略、用户、sudo、远端 Shell、远端 PATH、目标主机列表、网络超时、失败是否阻断。
- 执行：ssh/scp 设置连接超时；远端命令区分本地展开与远端展开；批量执行逐台记录退出码；rsync --delete 前先 dry-run 并校验源/目标尾斜杠语义。
- 验证：host key 变化、单台失败、远端无命令、远端路径含空格、scp SFTP 语义差异、rsync 双端版本差异、网络中断。
- 易漏：ssh "cmd $var" 被本地展开；scp 通配符在错误端展开；rsync 源目录尾斜杠含义写反；部分主机失败被最后一台成功覆盖。

### 6. 并发 / xargs / parallel / 后台任务 / 锁

- 先查：并发上限、共享资源、输出顺序、失败策略、是否可重入、锁粒度、空输入语义。
- 执行：后台任务保存 PID 并 wait 全部；xargs 用 -0 或显式空输入保护；parallel 标 job 数和 halt 策略；共享写用 flock 或分片合并；输出不要被并发日志破坏解析。
- 验证：单任务失败、部分失败、空输入、大输入、文件名含换行、并发写冲突、重复触发、锁残留。
- 易漏：set -e 捕不到后台失败；wait 只等最后一个；BSD xargs 无 -r；flock 在 macOS 不预装；锁文件不随异常清理。

### 7. sudo / 权限 / umask / secret

- 先查：运行用户、sudoers、tty 要求、HOME/PATH 变化、文件 owner/group/mode、secret 来源、日志采集位置。
- 执行：sudo 只包必要命令；固定绝对路径和环境；创建文件前定 umask 或 install -m；敏感值走 stdin/受控 env/文件描述符；调试输出前关闭 xtrace 并脱敏。
- 验证：无 sudo 权限、密码提示、非交互 sudo 失败、权限不足、owner 错误、日志/journal/artifact/ps 不泄露 secret。
- 易漏：整段脚本 sudo 导致 HOME/PATH 漂移；chmod 过宽；umask 在 CI 和 systemd 不同；token 出现在 curl 参数、shell history 或报错栈。

### 8. cron / systemd / CI / 非交互 shell

- 先查：Shell、PATH、WorkingDirectory、env 文件、umask、用户、stdin/tty、日志、锁、重启策略、CI 默认 shell 和 working-directory。
- 执行：命令用绝对路径；显式导入 env；cron 加互斥；systemd unit 变更后 daemon-reload；CI 分步脚本不要依赖上一步 shell 状态，除非通过文件/环境机制传递。
- 验证：env -i 最小环境、定时重复触发、服务启动失败、journal 日志、机器重启后、CI macOS/Linux/Windows runner 差异。
- 易漏：终端能跑 cron 失败；systemd 不读用户 shell 配置；GitHub Actions 默认 bash 行为和本地不同；管道错误被 CI 包装吞掉。

### 9. 调试 / 线上排障 / 回滚

- 先查：失败时间、原命令、退出码、最近变更、输入样本、环境差异、是否已被连续试错污染。
- 执行：先只读诊断；最小复现；加可控 debug；破坏性修复先 dry-run；准备 rollback、备份或恢复命令；连续两次无效停下复盘。
- 验证：原错误消失、相邻入口不回归、失败分支可诊断、日志无敏感信息、回滚路径可执行或已说明无法验证。
- 易漏：只改 symptom 不查调用方；现场证据被覆盖；修复脚本本身引入权限或删除风险。

## 高频坑 / 防遗漏

- 改解释器：同步查 shebang、调用命令、CI shell、cron/systemd、Docker ENTRYPOINT、Makefile/package scripts、远端 ssh 命令。
- 改参数：同步查 --help、默认值、环境变量、调用方、定时任务、远端命令、文档片段和错误提示。
- 改路径：同步查空值、引号、glob、符号链接、权限、umask、跨文件系统、清理逻辑、幂等性。
- 改文本处理：同步查 GNU/BSD/BusyBox 差异、编码、NUL/换行、jq/yq null、sed -i、xargs 空输入。
- 改网络/远程：同步查超时、重试、状态码、host key、TLS/代理、部分失败汇总、token 脱敏。
- 改并发：同步查 wait、退出码、锁、共享输出、空输入、失败策略、重复触发、资源上限。
- 改权限/secret：同步查 sudo PATH/HOME、umask、owner/mode、set -x、ps、history、journal、CI artifact。
- 改 cron/systemd/CI：同步查 env、PATH、工作目录、日志、锁、daemon-reload、runner shell、重启后状态。
- 改删除/覆盖：同步查 dry-run、目标前缀、非空、符号链接、rsync 尾斜杠、备份和 rollback。

## 输出要求

1. 场景卡：说明命中哪张卡，涉及 bash/zsh/POSIX sh、macOS/Linux/Alpine、cron/systemd/CI、远程、并发、权限、secret 中哪些。
2. 证据：列已读文件或远端内容、关键行/命令、原始失败现象、退出码/日志；未读未跑必须标“无法验证”。
3. 改动：给文件路径、行数范围、改了什么、为什么；远端技能更新给 slug、版本、行数、结构指标。
4. 风险：明确 quoting、globbing、IFS、subshell、trap、sudo、secret、command injection、删除、网络挂起、并发失败是否相关。
5. 验证：列 shellcheck/shfmt/bash -n/dash -n/目标入口复现/测试命令及关键输出；未执行说明原因。
6. 剩余缺口：缺平台、缺权限、缺 CI、缺生产日志、缺目标主机、缺密钥权限等必须明示。

## 约束

- 禁止未确认解释器就套 bash 写法；POSIX sh、bash、zsh 必须按不同语言处理。
- 禁止 eval、source 不可信文件、shell -c 拼接用户输入；确需动态执行必须白名单化并说明注入防护。
- 禁止裸 rm -rf、裸 rsync --delete、裸 chmod/chown -R、裸覆盖生产文件；必须有目标校验、dry-run 或 rollback。
- 禁止硬编码 secret、token、密码、私钥、主机凭据；禁止在日志、set -x、错误输出、进程参数、history、artifact 中泄露。
- 禁止忽略 curl/ssh/scp/rsync 超时、状态码、host key、部分失败和下载校验。
- 禁止并发 fire-and-forget；后台任务、xargs、parallel、锁都要收口退出码和失败策略。
- 禁止把 shellcheck/shfmt 通过包装成业务通过；它们只证明静态/格式层面。
- 不在本技能重复发布策略、服务架构、测试体系、最终审计、安全渗透或可观测性职责；命中边界时切相邻技能。

## 高频 Bug 反例库

- 反例 1：Shell 选错。错法：脚本写 #!/bin/sh 却使用数组、[[ ]]、source、pipefail。对法：改为 bash shebang 并用 bash 调用，或改写成 POSIX sh。根因：sh/bash/zsh 不是同一语言。
- 反例 2：macOS bash 版本假设。错法：在 macOS 系统 bash 3.2 用关联数组、mapfile、globstar。对法：确认 bash --version，改兼容语法或固定新 bash 路径。根因：macOS 默认 bash 长期落后。
- 反例 3：set -e 误判。错法：以为 set -e 会捕获 if、管道、命令替换、后台任务中的所有失败。对法：关键命令显式判断，管道检查各阶段，后台 wait 聚合。根因：errexit 有大量上下文例外。
- 反例 4：nounset 打断合法空值。错法：set -u 后直接读可选变量或空数组。对法：用默认值、必填校验和参数错误提示分开处理。根因：未定义、空字符串、空集合语义不同。
- 反例 5：IFS/read 破坏输入。错法：read line 或 for f in $(ls) 处理文件名。对法：IFS= read -r，文件名列表用 find -print0 配合 NUL 读取。根因：默认分词会吞空格、tab、反斜杠和换行。
- 反例 6：quoting 缺失。错法：rm -rf $dir/*、cp $src $dst、curl -H Authorization:$token。对法：变量、命令替换、路径默认双引号，危险路径先校验。根因：展开后会发生分词和 glob。
- 反例 7：globbing 注入。错法：把用户输入的 *、[abc]、? 当普通字符串参与命令。对法：按数据传参，必要时关闭 glob 或白名单。根因：Shell 会把未引用模式扩成文件集合。
- 反例 8：subshell 丢状态。错法：管道 while read 中累加计数，循环外读不到。对法：改用重定向、进程替换或显式输出结果。根因：管道阶段常在子进程执行。
- 反例 9：trap 覆盖。错法：多处 trap EXIT 互相覆盖，cleanup 失败又触发 errexit。对法：集中 cleanup，清理命令容忍不存在，新增 trap 前合并旧逻辑。根因：trap 不自动叠加且退出路径复杂。
- 反例 10：临时文件竞态。错法：写死 /tmp/app.tmp 或用 $$ 拼路径。对法：mktemp 创建、限制权限、trap 清理、写完原子 rename。根因：可预测路径会冲突、被抢占或泄密。
- 反例 11：sed -i 跨平台。错法：Linux 上可用的 sed -i 在 macOS 直接失败或备份行为不同。对法：按平台分支或用临时文件替换。根因：GNU/BSD sed 参数不兼容。
- 反例 12：jq/yq 假成功。错法：jq -r .id 得到 null 仍继续；yq 命令在不同实现下语义不同。对法：检查字段存在、类型、退出码和 yq 版本。根因：结构化工具成功不等于业务字段有效。
- 反例 13：curl 只看退出码。错法：curl 成功连接但 HTTP 500/404 仍被当成功。对法：检查 HTTP 状态、响应 schema、curl 退出码和失败 body。根因：网络成功、协议成功、业务成功是三层结果。
- 反例 14：ssh 双层展开。错法：ssh host "rm -rf $target" 让本地先展开变量和通配符。对法：明确本地/远端边界，传参、引用或 here-doc，远端也做目标校验。根因：命令经过本地和远端两次 Shell 解析。
- 反例 15：scp/OpenSSH 9 语义变化。错法：依赖旧 scp 远端通配展开。对法：改 rsync/sftp 或显式兼容策略。根因：新版 scp 默认 SFTP，远端 shell 行为变化。
- 反例 16：rsync --delete 目标写反。错法：源目录尾斜杠误用导致删除目标大量文件。对法：打印源/目标、先 dry-run、校验前缀和目录存在。根因：rsync 尾斜杠和 delete 语义高危。
- 反例 17：xargs 空输入。错法：无输入时仍执行一次危险命令，或 BSD 没有 -r。对法：执行前判断输入，或使用兼容空输入保护。根因：xargs 默认行为和平台参数不同。
- 反例 18：并发失败被吞。错法：后台任务 & 后不 wait，最后一个任务成功就整体成功。对法：保存全部 PID，wait 汇总失败并输出失败项。根因：Shell 不会自动传播后台子进程失败。
- 反例 19：sudo 环境漂移。错法：整段 sudo 后依赖用户 PATH、HOME、umask。对法：最小 sudo，固定 PATH/HOME/umask 和绝对命令。根因：提权会改变环境和权限边界。
- 反例 20：secret 泄露。错法：set -x、echo、curl 参数、ps、CI artifact 暴露 token。对法：敏感值走受控 stdin/env/文件描述符，日志脱敏，调试时临时关闭 xtrace。根因：调试和进程元数据会被采集。
- 反例 21：cron/systemd 环境差异。错法：终端可跑就放进定时任务或 unit。对法：显式 PATH、WorkingDirectory、env、umask、日志和锁。根因：非交互环境不加载用户配置。
- 反例 22：CI 分步状态丢失。错法：一步 export 变量，下一步 shell 直接使用。对法：用 CI 官方 env/output 文件传递。根因：CI 每步通常是新 shell。
- 反例 23：command injection。错法：把分支名、文件名、URL、JSON 字段拼进 eval、ssh 或 sh -c。对法：数组/参数传递、白名单、拒绝 shell 拼接。根因：数据被当代码执行。
- 反例 24：锁不可移植。错法：Linux 用 flock，本地 macOS 没装导致脚本无锁运行。对法：确认目标平台锁工具，缺失时用可移植 mkdir 锁或安装依赖。根因：并发原语不是所有平台内置。

## 提交前自检清单

- [ ] 已确认 Shell：bash、zsh、POSIX sh 与 shebang、调用方式、CI/cron/systemd 入口一致。
- [ ] 已确认平台：macOS/Linux/Alpine/BusyBox/容器镜像和 GNU/BSD 工具差异已覆盖。
- [ ] 已确认入口：pwd、PATH、env、umask、用户、sudo、tty、stdin、日志、锁已记录。
- [ ] 严格模式、errexit/nounset/pipefail、ERR trap、命令替换、后台任务的例外已检查。
- [ ] 变量、路径、命令替换默认加引号；IFS/globbing/NUL/换行风险已处理。
- [ ] 临时文件用 mktemp，清理用 trap，权限/owner/mode/umask 可复核。
- [ ] curl、jq、yq、ssh、scp、rsync 有超时、状态检查、失败分支和部分失败汇总。
- [ ] xargs、parallel、后台任务、锁有并发上限、空输入处理、wait/退出码收口。
- [ ] cron/systemd/CI 已检查绝对路径、日志、锁、daemon-reload、runner shell、最小环境。
- [ ] 删除、覆盖、chmod/chown -R、rsync --delete 已有 dry-run、边界校验和 rollback。
- [ ] secret、token、私钥不会出现在日志、set -x、错误输出、进程参数、history、artifact 或提交内容。
- [ ] 已运行可用的 shellcheck、shfmt、bash -n/dash -n/目标入口复现；未跑原因已记录。
- [ ] 无 fenced code block；行数 < 500；反例不少于 10 条；关键词完整。

## 2024-2026 新坑速查

- macOS 12-15 默认 zsh 交互、系统 bash 仍常见 3.2：脚本不要依赖 .zshrc，也不要默认可用 bash 4+ 特性。
- Ubuntu 24.04 / Debian 系 /bin/sh 常为 dash：sh script.sh 会绕过 bash shebang 语义，bashism 直接失败。
- Alpine/BusyBox 镜像精简：grep/sed/awk/date/stat/readlink/xargs 参数缺失，发布脚本必须在目标镜像内验证。
- GitHub Actions、GitLab CI、Bitbucket Pipelines 默认 shell、pipefail、working-directory、分步环境传递方式不同；显式声明并留证据。
- curl 8.x、OpenSSL/LibreSSL、代理和 HTTP/2 行为更严格：旧 TLS、证书链、重定向和代理脚本更容易暴露隐患。
- OpenSSH 9.x scp 默认走 SFTP：旧式远端通配、引号和 shell 展开语义变化，必要时用 rsync/sftp 明确策略。
- rsync 3.3+ 与远端旧版本组合：参数兼容、校验和 delete 行为需记录双端版本。
- coreutils/BSD 差异持续存在：timeout/gtimeout、date -d、stat -c、readlink -f、sed -i、xargs -r 都不能裸跨平台。
- jq/yq 版本漂移：jq 1.6/1.7、mikefarah yq/python yq 语法不同，CI 镜像升级会改变解析结果。
- systemd sandbox 普及：ProtectSystem、NoNewPrivileges、DynamicUser、PrivateTmp 会改变写路径、权限和 /tmp 可见性。
- secret 扫描和供应链审计更严：CI trace、artifact、shell history、process list、journal、debug log 都可能成为泄露证据。
- 并发与锁工具差异：GNU parallel/flock 未必预装，BSD xargs 无 -r，跨平台脚本需显式依赖或降级方案。

## 与相邻技能的边界

- shell-scripting 负责：Shell 语义、命令编排、脚本入口、平台差异、文本/JSON/YAML 处理、远程命令、权限、并发锁、危险操作、secret 泄露风险的排障和自检。
- test-engineering 负责：测试矩阵、复现/回归策略、CI 证据设计、多场景验收口径；本技能只给 Shell 维度验证点。
- code-audit 负责：最终 diff 对账、调用链、影响面、安全质量收口和证据是否足够；本技能不替代最终审计结论。
- release-engineering 负责：发布策略、灰度、回滚演练、上线窗口、制品和发布编排；Shell 只处理发布脚本执行层和失败证据。
- backend-engineering 负责：服务拓扑、运行时架构、nginx/systemd/容器服务边界；Shell 只处理脚本和命令层实现。
- devsecops 负责：CI/CD 平台权限、供应链、镜像、凭据治理、策略落地；Shell 只处理脚本中 secret、权限和命令注入 sink。
- observability-sre 负责：监控、告警、SLI/SLO、日志指标追踪和事故复盘体系；Shell 只保证脚本输出可诊断、退出码可信、日志不泄密。
