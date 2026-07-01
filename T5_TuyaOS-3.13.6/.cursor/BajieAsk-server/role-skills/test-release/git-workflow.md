---
name: git-workflow
description: Git 工作流实战排障版 - 面向仓库状态审查、分支/远端安全、精确暂存、提交、push、PR、merge/rebase/cherry-pick/stash/worktree、冲突恢复、签名、分支保护、CODEOWNERS、GitHub Actions checks、LFS/submodule 和历史事故止血。当任务涉及 git status/diff/add/commit/push/PR/merge/rebase/revert/cherry-pick/stash/worktree 时必须使用。
alwaysApply: false
---

# Git 工作流实战排障版

定位：把 Git 操作从“执行命令”收敛为可审计的仓库事实链。核心不是替代代码审查、测试或发布，而是保护工作区、历史、分支、远端和协作证据，避免误提交、误推送、误改历史、误删用户改动。

## 快速总则：仓库 / 分支 / 远端 / 证据

1. 先读事实：路径、是否 git repo、当前分支、upstream、remote、status、staged diff、unstaged diff、untracked、recent log 必须清楚。
2. 先定意图：本地 commit、选择性 commit、push、PR、同步主干、冲突处理、revert、cherry-pick、stash、worktree、submodule 还是 LFS 问题。
3. merge-base 是比较基准：PR diff、回归范围、分支是否落后，要用 base...HEAD 或 merge-base 思维，不用工作区文件名猜影响。
4. 精确暂存：优先 git add 具体路径；避免 git add . 把 .env、密钥、日志、构建产物、大文件、临时调试带入。
5. hooks 不绕过：pre-commit、lint、test、secret scan、signed commits 失败先定位；除非用户明确要求，不用 --no-verify 或跳签。
6. 远端操作需授权：push、force-with-lease、branch delete、tag delete、protected branches 相关操作必须确认目标 remote/branch。
7. 历史改写高风险：amend、rebase、reset、filter-repo、force-with-lease 前先给回退点；reflog 是事故恢复入口。
8. 保护用户工作：未知改动、冲突、未跟踪文件、stash、submodule dirty、LFS pointer 异常时先停下，不覆盖。
9. PR 证据要完整：commit 范围、base、title/body、test plan、CODEOWNERS、GitHub Actions checks、review 状态要可追溯。
10. 完成只报事实：分支、commit hash、是否推送、远端状态、检查结果、剩余未提交改动和风险。

## 场景执行卡

### 1. 提交前工作区审查

- 适用：任何 commit、push、PR、stash、rebase、merge 前。
- 输入：用户目标、期望提交范围、当前目录。
- 动作：查 status；查 staged/unstaged diff；查 untracked；查最近 log；识别密钥、大文件、生成物、锁文件、迁移、CI 配置。
- 证据：列出将提交文件、剩余未提交文件、是否有敏感/无关文件。
- 停止条件：范围不清、存在他人/用户未知改动、冲突未解、submodule dirty、LFS 文件异常。

### 2. 精确暂存与 commit

- 适用：用户明确要求提交。
- 动作：按文件路径 stage；复查 staged diff；按仓库风格写 1-2 句 commit message；运行正常 hooks。
- 禁止：未看 diff 就 commit；把未授权文件一起 add；hook 失败后 amend 到旧提交。
- 输出：commit hash、分支、message、hook/检查结果、剩余改动。

### 3. push 与远端同步

- 适用：用户明确要求 push、创建 PR 或同步远端。
- 动作：查 upstream/ahead/behind；必要时 fetch；确认 remote/branch；普通 push 优先；被拒先读错误。
- protected branches：main/master/release 分支拒绝直推时，不绕规则，改走分支和 PR。
- force-with-lease：只在明确要求改写远端历史且已确认远端未被他人推进时使用；禁止裸 force。

### 4. 创建 PR / PR stack

- 适用：用户要求开 PR、更新 PR、堆叠 PR。
- 动作：用 merge-base 查看 base...HEAD；检查提交是否只含目标范围；title/body/test plan 写真实变更；确认 CODEOWNERS 与 GitHub Actions checks。
- PR stack：说明每层 base、依赖顺序、需要先合并哪一层；避免把下层未合并提交混入上层说明。
- 输出：PR URL、base/head、核心 diff、测试计划、待通过 checks。

### 5. rebase / merge / 冲突处理

- 适用：同步主干、整理历史、解决冲突。
- 动作：先 fetch；记录当前 HEAD；确认目标 base；优先理解冲突双方语义；解决后运行相关测试/构建。
- rebase：适合个人分支线性化；公共分支或多人共享分支需确认。
- merge：适合保留协作历史或发布分支；不得为“看起来干净”强行 rebase。
- 失败兜底：可用 rebase --abort、merge --abort、reflog 恢复；不硬 reset 用户改动。

### 6. cherry-pick / revert / 事故止血

- cherry-pick：先看原提交 diff、父提交、依赖提交和目标分支是否已有等价改动；冲突后验证语义。
- revert：适合已推送历史的回滚；merge commit revert 必须明确 mainline；不要用 reset 改写共享历史。
- 输出：原始提交、目标分支、新提交、冲突/测试结果、是否需后续补丁。

### 7. stash / worktree / sparse checkout

- stash：只适合临时保护工作区；stash 前说明包含 tracked/untracked 与否；恢复后查冲突和遗漏。
- worktree：适合并行修复、隔离分支、避免污染当前工作区；创建前确认同一分支不可重复 checkout 的限制。
- sparse checkout：适合大仓局部工作；提交前确认 diff 不因稀疏视图漏看跨目录影响。

### 8. submodule / LFS / 大仓异常

- submodule：确认父仓指针和子仓提交都正确；不要只提交子仓改动忘记父仓指针。
- LFS：确认提交的是 pointer 还是真实大文件；push 前检查 LFS 对象上传；避免把二进制绕过 LFS 进 Git 历史。
- 大仓：遇到 partial clone、shallow clone、sparse checkout 时，先补足历史或说明验证限制。

### 9. 签名、权限与安全门禁

- signed commits：签名失败先查 GPG/SSH signing key、邮箱、agent、仓库规则；不要跳过签名。
- secret scanning：发现密钥入库风险先停止，要求撤销密钥并清理历史方案。
- GitHub Actions checks：失败先看具体 job/log；不要把 CI 红灯当作已完成。

## 高频坑 / 防遗漏

- 未看 staged diff，只看 status 就提交。
- git add . 带入 .env、截图、日志、node_modules、dist、coverage、数据库文件。
- untracked 文件未加入导致“本地能跑、提交缺文件”。
- rebase 中断后继续 commit，产生半解决历史。
- pull 默认 merge/rebase 与仓库策略不一致。
- PR diff 用双点误判，应关注 merge-base/base...HEAD。
- cherry-pick 漏依赖提交，编译或运行时才爆。
- revert merge commit 未指定正确 mainline。
- stash 未包含 untracked，切分支后丢上下文。
- worktree 中忘记当前路径，提交到错误分支。
- submodule 只改子仓未提交父仓指针。
- LFS 对象未上传，别人拉取只有 pointer 或失败。
- protected branches、CODEOWNERS、required checks 未过就尝试直推。
- force-with-lease 未先 fetch，覆盖他人新提交风险上升。
- signed commits 本地通过但远端邮箱/签名身份不匹配。

## 输出要求

- 操作前：列出仓库、分支、upstream、ahead/behind、目标文件范围、风险点。
- commit 后：列出 commit hash、message、分支、是否推送、剩余未提交改动。
- push/PR 后：列出 remote/head/base、PR URL、GitHub Actions checks 状态、review/CODEOWNERS 阻塞。
- 冲突/恢复后：列出冲突文件、采用策略、验证命令、reflog/abort/回滚路径。
- 若未验证：明确写“未跑/未验证”，不要把计划说成结果。

## 约束

- 用户未明确要求，不 push、不创建 PR、不 force push、不删除分支、不改写已共享历史。
- 禁止默认使用 --no-verify、--no-gpg-sign、git reset --hard、git clean -fd、git checkout .、裸 git push --force。
- 修改提交范围前必须重查 diff；提交失败后创建新提交，不默认 amend 旧提交。
- 涉密文件已进入历史时，不只删除工作区文件；需走密钥吊销、历史清理、远端同步和审计。
- 不替代代码质量、测试、发布或安全技能；Git 只负责版本控制动作和协作证据。

## 高频 Bug 反例库

反例 1：错法：未看 diff 直接 git add . && commit / 对法：先 status、staged diff、unstaged diff，再精确 add / 根因：Git 暂存区是显式边界，不是任务范围自动识别器。

反例 2：错法：hook 失败后用 --no-verify 赶紧提交 / 对法：读取 hook 输出，修复或明确用户授权后再处理 / 根因：hook 往往承载格式、测试、secret scan 和签名门禁。

反例 3：错法：push 被拒后直接 git push --force / 对法：fetch、确认远端新增提交，再按需 force-with-lease / 根因：裸 force 会覆盖他人历史，force-with-lease 也必须基于新远端事实。

反例 4：错法：在 main 上直接修完 push / 对法：识别 protected branches，新建分支走 PR / 根因：分支保护、required checks、CODEOWNERS 是协作策略，不是 Git 错误。

反例 5：错法：rebase 冲突时随手接受 ours/theirs / 对法：理解两边语义、逐文件解决、运行相关验证 / 根因：rebase 中 ours/theirs 视角容易反转，机械选择会丢逻辑。

反例 6：错法：用 reset 回滚已推送线上提交 / 对法：共享历史优先 revert，必要时说明影响和审批 / 根因：reset 改写历史，其他协作者和 CI 引用会断裂。

反例 7：错法：cherry-pick 单个修复提交不看依赖 / 对法：检查原 PR、父提交、相关迁移/配置/测试 / 根因：提交粒度可能不是功能依赖边界。

反例 8：错法：stash 后直接切分支，默认所有东西都保存了 / 对法：确认是否需要 include-untracked，恢复后查 status / 根因：stash 默认不含未跟踪文件，容易漏新增文件。

反例 9：错法：worktree 里忘记分支，把修复提交到错误 head / 对法：每次提交前报当前路径、分支、upstream / 根因：worktree 隔离目录但不隔离人的上下文误判。

反例 10：错法：submodule 内提交后只 push 子仓 / 对法：父仓提交 submodule 指针并说明两边 hash / 根因：父仓记录的是子仓提交指针，缺父仓指针别人不会同步。

反例 11：错法：大文件直接进 Git，之后只从最新提交删除 / 对法：使用 LFS 或历史清理，并确认远端对象和密钥风险 / 根因：Git 历史仍保留对象，仓库体积和泄密风险不消失。

反例 12：错法：PR stack 上层 PR 混入下层未合并提交却不说明 / 对法：明确每层 base/head，用 merge-base/base...HEAD 校验范围 / 根因：堆叠 PR 的评审边界来自分支基线，不是标题描述。

## 提交前自检清单

- 已确认当前目录是目标仓库，分支和 upstream 正确。
- 已读取 status、staged diff、unstaged diff、untracked、recent log。
- staged 只包含目标文件；无密钥、日志、构建产物、大文件误入。
- commit message 与实际 diff 一致；未夸大范围。
- hook、签名、测试或用户要求的检查已跑；失败有结论。
- push/PR 已获授权；remote、base、head、protected branches 已确认。
- rebase/merge/cherry-pick/revert 有回退方案，必要时记录 reflog/原始 hash。
- submodule、LFS、sparse checkout、shallow/partial clone 的验证限制已说明。

## 2024-2026 新坑速查

- GitHub required status checks 更严格：GitHub Actions checks 名称变更、matrix job 重命名会阻塞 protected branches。
- signed commits 从可选变强制：SSH signing、GPG agent、邮箱不匹配会导致远端拒绝。
- CODEOWNERS 与 rulesets 叠加：路径命中后需要指定 owner review，管理员也可能不能绕过。
- PR stack 常态化：base 选错会把下层提交混进上层 PR，必须用 merge-base 校验。
- force-with-lease 不是万能保险：本地 remote ref 过旧时仍可能基于陈旧认知操作，先 fetch。
- LFS 配额和对象上传失败更常见：CI checkout 失败不一定是代码错，可能是 LFS 对象缺失。
- sparse checkout/partial clone 普及：局部视图可能漏掉跨目录 CODEOWNERS、生成物或测试影响。
- submodule 与 Dependabot/安全更新交织：父仓指针、子仓分支和安全 PR 可能不同步。
- 默认分支重命名和 rulesets：master/main 假设会导致 push、PR base、自动化脚本错指。
- AI 生成提交易混入无关格式化：提交前必须用 diff 证明范围，不用“模型说改了什么”作依据。

## 与相邻技能的边界

- code-audit：负责代码正确性、调用链、风险结论；git-workflow 只负责把待审 diff、提交边界和版本历史证据准备准确。
- test-engineering：负责测试策略、用例和回归充分性；git-workflow 只记录哪些检查被触发、通过或失败。
- release-engineering：负责发布、灰度、回滚和 artifact；git-workflow 只负责 tag/branch/commit/PR 与发布分支历史安全。
- devsecops：负责 SAST/SCA/secret scanning/SBOM/供应链策略；git-workflow 只在提交和远端门禁阶段阻止密钥、签名和权限误操作。
- project-learning：负责陌生项目结构、模块和约定学习；git-workflow 只在 Git 操作前要求补足仓库事实和协作规则。
- backend-engineering：负责服务、API、DB、运行时问题；git-workflow 只管理后端改动进入历史、PR 和分支的安全流程。