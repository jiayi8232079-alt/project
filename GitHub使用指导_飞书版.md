# GitHub 使用指导（飞书版）

## 1. 目标与适用范围
- 适用对象：第一次把本地项目接入 GitHub，或日常使用 Cursor / 终端 / GitHub Desktop 管理代码。
- 目标：减少“提交卡住、发布失败、权限报错、文件异常变更”等常见问题。

---

## 2. 核心概念（先记住这 6 个）
- **工作区（Working Tree）**：你当前磁盘上的文件。
- **暂存区（Staging Area）**：下一次提交要打包的文件清单。
- **提交（commit）**：把暂存区内容写入本地历史。
- **分支（branch）**：一条提交历史线（如 `main`）。
- **远程（origin）**：GitHub 仓库地址。
- **推送（push）**：把本地提交上传到远程。

补充：
- `U` = Untracked（未跟踪，Git 里还没出现过）
- `A` = Added（已加入暂存区，等待提交）
- `M` = Modified（已跟踪文件被修改）

---

## 3. 首次配置（每台机器做一次）

### 3.1 Git 身份配置
```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

校验：
```bash
git config --global --list | grep user
```

### 3.2 推荐使用 SSH（比 HTTPS 更稳）
1) 生成密钥（若已有可跳过）
```bash
ssh-keygen -t ed25519 -C "你的邮箱"
```

2) 加载私钥
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

3) 复制公钥并添加到 GitHub
```bash
cat ~/.ssh/id_ed25519.pub
```
GitHub 路径：头像 -> Settings -> SSH and GPG keys -> New SSH key。

4) 验证
```bash
ssh -T git@github.com
```
看到 `You've successfully authenticated` 即成功。

---

## 4. 新项目从 0 到可推送

### 4.1 初始化仓库（若未初始化）
```bash
cd /path/to/project
git init
```

### 4.2 添加忽略规则
在根目录准备 `.gitignore`（忽略编译产物、缓存、密钥等）。

### 4.3 首次提交
```bash
git add -A
git commit -m "Initial import"
```

### 4.4 绑定远程并推送
```bash
git remote add origin git@github.com:<用户名>/<仓库名>.git
git push -u origin main
```

---

## 5. 日常高频操作（最实用）

### 5.1 每天开始前（先同步）
```bash
git fetch origin
git pull origin main
```

### 5.2 改完代码后（提交并上传）
```bash
git add -A
git commit -m "描述本次改动"
git push
```

### 5.3 查看状态/历史
```bash
git status
git log --oneline --graph --decorate -20
```

---

## 6. fetch / pull / push 区别
- `fetch`：只更新远程信息到本地，不改当前代码。
- `pull`：`fetch + merge/rebase`，会改当前分支内容。
- `push`：把本地提交发到远程。

口诀：**先 fetch 看，再 pull 合，最后 push 发。**

---

## 7. Cursor / GitHub Desktop 按钮对照情况
- `提交` = `git commit`
- `发布 Branch` = 首次 `git push -u origin <branch>`（并可能创建远程仓库）
- `Fetch origin` = `git fetch origin`
- `Pull origin` = `git pull origin <当前分支>`
- `Push origin` = `git push origin <当前分支>`

---

## 8. 常见问题与处理

### 8.1 提交卡住很久
现象：点提交后 3-10 分钟无结果。
处理：
1) 先看是否有锁
```bash
ls .git/index.lock
```
2) 若有且确认没有 git 进程在跑：
```bash
rm -f .git/index.lock
```
3) 改用终端提交（通常更稳）
```bash
git add -A
git commit -m "..."
```

### 8.2 发布分支报 TLS/443 网络错误
典型报错：
- `TLS connection was non-properly terminated`
- `Couldn't connect to github.com port 443`

优先方案：改 SSH 远程。
```bash
git remote set-url origin git@github.com:<用户名>/<仓库名>.git
ssh -T git@github.com
git push -u origin main
```

### 8.3 `Permission denied (publickey)`
说明 SSH key 未被 GitHub 信任或未加载。
- 检查：`ls ~/.ssh`
- 加载：`ssh-add ~/.ssh/id_ed25519`
- 添加 `id_ed25519.pub` 到 GitHub 后再 `ssh -T git@github.com`

### 8.4 明明没改，Desktop 里却有 Changes
可能原因：大小写冲突（Linux 区分大小写，Windows 默认不区分）。
示例：`appconfig/`（目录）与 `APPconfig`（文件）共存时，Windows 可能异常显示删除。
建议：
- 在 Linux / WSL2（非 `/mnt/c`）开发该仓库；
- 或启用目录大小写敏感后重新克隆。

---

## 9. 提交信息规范（简版）
推荐格式：
- `feat: 增加 xxx`
- `fix: 修复 xxx`
- `chore: 调整构建/配置`
- `docs: 更新文档`

示例：
- `chore: add .gitignore for TuyaOS artifacts`
- `feat: add camera frame callback for T5 board`

---

## 10. 安全建议（务必执行）
- 不要提交密钥、口令、证书私钥。
- `.gitignore` 中应包含敏感配置（如 `*secrets*`）。
- 推公开仓库前，先确认许可证和第三方代码授权范围。

---

## 11. 三条命令版（极简流程）
```bash
# 拉最新
git pull origin main

# 提交改动
git add -A && git commit -m "你的改动说明"

# 推送
git push
```

