---
name: vulnerability-research-reverse-engineering
description: 漏洞研究与可达性逆向。源码审计（Semgrep / CodeQL / Joern / CodeChecker / Coverity）+ 二进制审计（IDA / Ghidra + capa + 自家 sink 库）+ 数据流 taint（Triton / angr / Pin）+ Patch Tuesday 1-day 复现 + CWE / OWASP Top 25 模式库 + Source/Sink 模型 + 利用原语识别（任意读写 / heap shaping / ROP/JOP）。配合 fuzzrev / crashrev / diffrev / binrev / irrev 用。
---

# 漏洞研究 / 可达性逆向

## 适用场景

- 拿到一个目标（源码 / 二进制 / 服务端 API / 嵌入式固件），系统化挖洞。
- Patch Tuesday 后做 1-day：bindiff 找补丁点 → 反推漏洞 → 写 PoC。
- 从 `crashrev` 拿到 root cause 后做可利用性评估 + 利用原语清单。
- 大型代码库回归扫描：每次 PR 自动跑 Semgrep / CodeQL，阻塞引入新漏洞。
- 商业 SaaS / 闭源应用黑盒研究：fuzz + 逆向 + 复现 + 报洞。

## 不适用

- 找 crash 本身 → `fuzzrev`。
- 利用链构造 / shellcode / ROP gadget 完整 exploit → 不在本技能。
- 静态函数级反编译 → `binrev`。
- 二进制差分 → `diffrev`（本技能与之联动）。

## 漏洞类型速查（按 sink 模式分）

| 类别 | sink 函数 / 模式 | CWE |
| --- | --- | --- |
| **栈溢出** | `strcpy / strcat / sprintf / gets / scanf("%s") / 自家 memcpy 边界不查` | CWE-121 |
| **堆溢出** | `malloc + memcpy(dst, src, len)` len 来自外部 | CWE-122 |
| **格式串** | `printf(user_input) / fprintf / syslog / sd_journal_print` | CWE-134 |
| **整数溢出 → buf** | `malloc(n * size)`、`alloca(len + 8)`、`if (len > MAX - 8)` 缺失 | CWE-190 |
| **off-by-one** | 循环 `<=` 错写 `<`，长度 +1 缺失 | CWE-193 |
| **UAF** | `free + 之后 use` / 双 free / 销毁后回调 | CWE-416 |
| **Type confusion** | `dynamic_cast` 缺失 / union 读错字段 / JIT 类型猜错 | CWE-843 |
| **OOB read** | `arr[idx]` idx 来自外部 + 缺范围检查 | CWE-125 |
| **OOB write** | 同上但写 | CWE-787 |
| **Race / TOCTOU** | `stat + open` / 检查文件时被改 | CWE-367 |
| **空指针 deref** | `ptr->field` ptr 可能 NULL | CWE-476 |
| **命令注入** | `system / exec / popen / Runtime.exec / subprocess.shell=True` 拼用户输入 | CWE-78 |
| **SQL 注入** | 字符串拼接 SQL，不用 prepared statement | CWE-89 |
| **XSS** | `innerHTML / document.write / dangerouslySetInnerHTML` 含用户输入 | CWE-79 |
| **SSRF** | `requests.get(user_url) / fetch(user_url)` 无 allowlist | CWE-918 |
| **Path traversal** | `open("/var/" + name)`，name 含 `../` | CWE-22 |
| **XXE** | XML 解析未禁用 external entity | CWE-611 |
| **Deserialization** | `pickle.loads / Java ObjectInputStream / unserialize() / fastjson` | CWE-502 |
| **SSTI** | 模板引擎 `render(user_input)` | CWE-1336 |
| **认证 / 授权缺失** | 路由表 / IDOR | CWE-862 / CWE-639 |
| **加密误用** | `MD5 / SHA1 + 自家随机 / ECB / 静态 IV / 短 nonce` | CWE-327 / CWE-329 |
| **JWT 漏洞** | `alg=none / HS256-RS256 confusion / 弱 secret / kid 注入` | CWE-347 |
| **侧信道 timing** | `strcmp / memcmp` 用于秘密对比 | CWE-208 |
| **Cookie/Session** | predictable session / no HttpOnly / no SameSite | CWE-330 |
| **Web cache** | Web cache poisoning / smuggling (HTTP/2 desync) | CWE-444 |
| **逻辑漏** | 业务流程缺验证（如不验证 token owner） | CWE-840 |

## 源码静态审计

### Semgrep（最快上手）

```bash
pip install semgrep
# 跑社区规则集
semgrep --config=auto src/                                  # 自动选 ruleset
semgrep --config=p/security-audit src/
semgrep --config=p/owasp-top-ten src/
semgrep --config=p/cwe-top-25 src/
semgrep --config=p/secrets src/                             # 找硬编码 secret

# 多语言 sink 模式（自家规则）
cat > rules/dangerous_exec.yaml <<'EOF'
rules:
  - id: subprocess-shell-true
    pattern: subprocess.$F(..., shell=True, ...)
    message: subprocess with shell=True is dangerous
    languages: [python]
    severity: ERROR
  - id: format-string-on-user-input
    patterns:
      - pattern: printf($X, ...)
      - pattern-not: printf("...", ...)
    message: printf with non-constant format string
    languages: [c]
    severity: ERROR
EOF
semgrep --config=rules/ src/

# JSON 输出 + CI 阻塞
semgrep --config=p/security-audit --json -o sem.json src/
semgrep --config=p/security-audit --error src/              # 任何命中 exit non-zero

# Semgrep Pro（含污点 + 跨函数）
semgrep ci --pro                                            # 商业版功能
```

### CodeQL（GitHub 出品，最强）

```bash
# 装
brew install codeql                                         # mac
# linux: 下 zip
codeql --version

# 建数据库
codeql database create my-db --language=cpp --source-root=./src --command="make"
codeql database create my-db --language=python --source-root=./src
codeql database create my-db --language=javascript --source-root=./src
codeql database create my-db --language=java --source-root=./src --command="mvn clean install -DskipTests"
codeql database create my-db --language=go --source-root=./src

# 跑社区 query
codeql database analyze my-db --format=sarif-latest \
    -o results.sarif \
    --download codeql/cpp-queries codeql/python-queries
# 或一键 suite
codeql database analyze my-db codeql/cpp-queries:codeql-suites/cpp-security-extended.qls -o cpp.sarif
codeql database analyze my-db codeql/python-queries:codeql-suites/python-security-and-quality.qls -o py.sarif

# 看结果
codeql bqrs decode --format=csv results.bqrs

# 自家 query
cat > my-query.ql <<'EOF'
import cpp
import semmle.code.cpp.security.FlowSources
import semmle.code.cpp.security.dataflow.FlowSinks

from FunctionCall fc
where fc.getTarget().getName() = "strcpy"
   or fc.getTarget().getName() = "strcat"
   or fc.getTarget().getName() = "gets"
   or fc.getTarget().getName() = "sprintf"
select fc, fc.getTarget(), "Dangerous function call"
EOF
codeql query run my-query.ql -d my-db -o my.bqrs
codeql bqrs decode --format=csv my.bqrs
```

### Joern（开源跨语言 + Code Property Graph）

```bash
# 装
curl -L https://github.com/joernio/joern/releases/latest/download/joern-cli.zip -o joern.zip
unzip joern.zip && cd joern-cli
./joern

joern> importCode("../src", "myproject")
joern> cpg.method.name(".*memcpy.*").l                      // 列所有 memcpy 调用
joern> cpg.call("memcpy").argument(2).l                     // memcpy 第 3 参数(size)
// 找 user input → strcpy 路径
joern> def src = cpg.call("recv").argument(2)
joern> def sink = cpg.call("strcpy").argument(2)
joern> sink.reachableByFlows(src).l                         // 数据流可达
joern> save                                                 // 保存为 .bin
joern> exit
```

### 自家专项扫描器

```bash
# C/C++ 静态分析
cppcheck --enable=all --xml src/ 2> cppcheck.xml
clang-tidy -checks='*,-llvmlibc-*' src/*.c
scan-build --use-cc=clang make                              # Clang Static Analyzer
infer run -- make                                           # Facebook Infer
splint src/*.c                                              # 老牌 lint
flawfinder src/                                             # 简单但好用
rats src/

# Python
bandit -r src/                                              # 安全 lint
pylint --load-plugins pylint.extensions.security src/
prospector src/

# JavaScript / Node
npm audit
npm install -g eslint @microsoft/eslint-plugin-sdl
eslint --ext .js --rulesdir security-rules/ src/
nodejsscan -d src/
retire --js src/                                            # 老依赖漏洞

# Go
gosec ./...
nancy sleuth                                                # 依赖漏洞
govulncheck ./...                                           # Go 官方

# Rust
cargo audit                                                 # 依赖
cargo clippy -- -D warnings
cargo geiger                                                # unsafe 代码统计

# Java
spotbugs / findsecbugs
checkstyle
PMD
SonarQube

# 商业
Checkmarx / Veracode / Fortify / Snyk Code / Sonar Cloud / Coverity / Klocwork
```

## 二进制审计（找 sink）

```python
# IDA 脚本: 全二进制扫 dangerous functions
import idautils, idc, ida_funcs
sinks = ['strcpy','strcat','sprintf','gets','scanf','memcpy','strncpy','strncat',
         'system','popen','exec','syscall','recv','recvfrom','read']

for sink in sinks:
    # 在导入表 / 函数名找
    for ea in idautils.Functions():
        name = idc.get_func_name(ea)
        if sink in name.lower():
            # 列所有 xref
            for xref in idautils.XrefsTo(ea):
                from_func = ida_funcs.get_func(xref.frm)
                if from_func:
                    print(f"[{sink}] called from {idc.get_func_name(from_func.start_ea)} @ {hex(xref.frm)}")
```

```bash
# Ghidra headless 同思路
analyzeHeadless ./proj p1 -import sample.exe \
    -postScript FindSinks.java \
    -scriptPath ./scripts

# capa（直接给行为标签）
capa sample.exe -j > capa.json
jq '.rules | keys[]' capa.json | grep -iE 'inject|persist|exfil|shell|exec'

# Binary Ninja headless
python3 - <<'PY'
import binaryninja as bn
with bn.load('sample.exe') as bv:
    bv.update_analysis_and_wait()
    sinks = ['strcpy','sprintf','system','popen','exec']
    for sym in bv.get_symbols():
        for s in sinks:
            if s in sym.name.lower():
                for ref in bv.get_code_refs(sym.address):
                    f = bv.get_functions_containing(ref.address)[0]
                    print(f"{sym.name} <- {f.name} @ {hex(ref.address)}")
PY

# 自家 yara 找 sink call pattern (PE 直接搜)
yara -r dangerous-patterns.yar sample.exe
```

## 数据流 taint analysis

```python
# Triton DBA + taint
from triton import TritonContext, ARCH, MemoryAccess, Instruction
ctx = TritonContext(ARCH.X86_64)
ctx.enableTaintEngine(True)

# 标记输入为 tainted
ctx.taintRegister(ctx.registers.rax)
ctx.taintMemory(MemoryAccess(0x1000, 8))

# 单步走
for inst_bytes in code:
    inst = Instruction(inst_bytes)
    ctx.processing(inst)
    if inst.isTainted():
        print(f"tainted exec: {inst}")
        # 检查是否进了 sink
        if inst.getDisassembly().startswith('call') and is_sink(inst.getOperands()[0]):
            print(f"!! taint reaches sink at {inst.getAddress():#x}")
```

```python
# angr 数据流 + 符号执行
import angr, claripy
proj = angr.Project('sample', auto_load_libs=False)

# 标记 read 返回为 symbolic
state = proj.factory.entry_state()
state.options.add(angr.options.LAZY_SOLVES)

class TaintHook(angr.SimProcedure):
    def run(self, fd, buf, n):
        sym = claripy.BVS('user_input', n.concrete_value() * 8)
        self.state.memory.store(buf, sym)
        self.state.globals.setdefault('tainted', []).append(buf)
        return n

proj.hook_symbol('read', TaintHook())
simgr = proj.factory.simgr(state)
simgr.explore(find=lambda s: 'strcpy' in str(s.solver.eval(s.regs.pc)))
```

```bash
# Pin / DynamoRIO taint tool
pin -t taint_tool.so -- ./target

# libdft (Pin-based)
# Sage / Mayhem (商业)
```

## CVE 复现工作流

```text
1) 拿到 CVE 编号 (CVE-2024-XXXXX)
   - 看 advisory：vendor 公告 / NVD / MITRE
   - 读 CVSS、CWE、影响版本

2) 找补丁
   - github.com/<vendor>/<repo>/commits/main
   - 找含 "CVE-2024-XXXX" 或 "security" 字样的 commit
   - 看 diff：哪些行被改

3) 反推漏洞
   - 补丁加 if/边界 → 漏洞是缺这个检查
   - 补丁改类型 → 类型混淆
   - 补丁改 alloc 大小 → 整数溢出
   - 补丁加锁 → race

4) 找 PoC
   - exploit-db.com search CVE-2024-XXXX
   - github 搜 "CVE-2024-XXXX poc"
   - vulhub.org（容器化漏洞环境）
   - HackTricks（含历史 CVE）
   - 官方 PoC（Project Zero 公开 0day 提供）

5) 复现
   - vulhub: docker-compose up
   - 自家搭建漏洞版 + 跑 PoC

6) 写检测规则
   - Suricata / Snort 网络层
   - Sigma 进程 / 文件层
   - YARA 二进制层
   - 自家 EDR 行为规则
```

```bash
# vulhub: 一键漏洞环境
git clone https://github.com/vulhub/vulhub
cd vulhub/log4j/CVE-2021-44228
docker-compose up -d
# 跑 PoC：
python3 poc.py http://localhost:8983

# OffensiveCon / RealWorldCTF 收录
# CISA Known Exploited Vulnerabilities (KEV) catalog
# https://www.cisa.gov/known-exploited-vulnerabilities-catalog

# CVE-2024-X 时间线建议:
# Day 0: 厂商公告
# Day 1-3: 看 commit + bindiff
# Day 3-7: PoC 公开 / 自家复现
# Day 7-14: 写检测规则 / EDR 升级 / 客户通报
```

## 1-day 拓荒（patch diff + reach）

```text
工作流 (与 diffrev 联动):

1) 拿到补丁文件
   .msu / .msp / deb / rpm / git commit / GitHub release

2) 提取前后版本二进制
   expand -F:* KB.msu C:\out\        (Windows)
   winbindex.m417z.com               (查未补版本)
   dpkg-deb -x old.deb / new.deb     (Debian)
   rpm2cpio old.rpm | cpio -id       (RHEL)

3) Diaphora / BinDiff
   v1.idb vs v2.idb → 找 partial matches
   特别看 ratio 0.6-0.95 的函数

4) 关注模式
   - 新加 if/check
   - 新加 NULL 判
   - 新加 alloc size 校验
   - 改 type / cast
   - 改 locking
   - 删 alloca → 改 malloc + bound check
   - 改递归 → 迭代（防 stack exhaust）

5) 验证可达性
   - 从 RPC / Web / file parse / IPC 入口能否走到补丁点
   - 输入控制度：完全 / 部分 / 不可控

6) 编写 PoC
   - 看 crashrev / fuzzrev 章节构造输入
   - 不到 RCE 也至少能 trigger crash / DoS

7) 报告
   - 与 rev-report 联动出 advisory
```

## 利用原语识别（不构造，只看）

```text
拿到 crash 后，识别它给攻击者提供了什么原语：

任意写 (arbitrary write):
  - "what" 可控？(value 是否来自用户)
  - "where" 可控？(目标地址是否来自用户)
  - 大小？(1 字节 / 4 字节 / 任意)
  - 次数？(一次 / 可重复)
  - 形态：
    * AAW: arbitrary address write
    * RAW: relative address write
    * NULL pointer dereference write → 多数现代系统 mmap NULL 失败

任意读 (arbitrary read):
  - 用于 leak: ASLR/PIE 基址、栈/堆 canary、libc base、heap layout
  - 形态：AAR / RAR

任意调用 (arbitrary call):
  - 控 RIP/EIP / 控 vtable / 控函数指针
  - 与 CFI / CET 配合度
  - 现代:
    * Win: CFG (Control Flow Guard) + XFG (Extended Flow Guard) + CET-IBT
    * Linux: kCFI / FineIBT
    * macOS: Apple PAC

堆 shaping 原语:
  - chunk overlap / unsafe unlink / tcache poisoning
  - 现代 glibc:
    * safe-linking (2.32+) 防 single-linked list 任意指针
    * tcache_perthread_struct 加密
    * malloc hook 移除
  - Windows segment heap (Win10+) → low-fragmentation heap 不同利用模型

Type confusion → call gadget:
  - C++ vtable / Java JIT inline cache / V8 hidden class

Use-After-Free → leak/control:
  - 喷射 (heap spray) 让 freed 块被 attacker 重分配
  - 大小匹配 → 控制 size class

工具:
  - pwntools: Python exploit dev framework (识别 + 演示用)
  - one_gadget: glibc 一行调到 execve("/bin/sh") 的 gadget
  - ROPgadget / ropper: 找 ROP gadgets
  - angrop: angr 上的 ROP 自动化
```

## CWE / OWASP / KEV 等参考体系

```text
权威分类:
  CWE (Common Weakness Enumeration):   cwe.mitre.org
  CVE:                                  cve.org / nvd.nist.gov
  CVSS v3.1 / v4.0:                     first.org/cvss

应用层:
  OWASP Top 10:                         owasp.org/Top10
  OWASP API Security Top 10:            owasp.org/API-Security
  OWASP MASVS (Mobile):                 mas.owasp.org
  OWASP ASVS (App Security Verif):      asvs

二进制 / 系统层:
  CWE Top 25:                           cwe.mitre.org/top25
  SANS Top 25:                          sans.org

威胁情报:
  KEV Catalog (CISA):                   cisa.gov/kev
  ExploitDB:                            exploit-db.com
  Vulncheck KEV / EPSS:                 vulncheck.com
  Vulhub:                               vulhub.org
  HackTricks:                           book.hacktricks.xyz

bug bounty 平台:
  HackerOne / Bugcrowd / Intigriti / Synack / Open Bug Bounty
  Zero Day Initiative (ZDI):            zerodayinitiative.com

研究机构:
  Google Project Zero:                  googleprojectzero.blogspot.com
  Microsoft Security Response Center:   msrc.microsoft.com
  Apple Security Research:              security.apple.com
  Quarkslab / Doyensec / NCC Group:     深度技术 blog
```

## CI/CD 集成（防回归）

```yaml
# .github/workflows/security.yml
name: Security
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: p/security-audit p/owasp-top-ten
      - uses: github/codeql-action/init@v3
        with:
          languages: cpp,python,javascript
      - run: make
      - uses: github/codeql-action/analyze@v3
      - run: gosec ./...
      - run: bandit -r .
      - run: govulncheck ./...
      - run: trivy fs --severity HIGH,CRITICAL --exit-code 1 .
      - uses: actions/upload-artifact@v4
        with:
          name: sarif
          path: '*.sarif'
```

## 实战入口

- **OWASP Cheat Sheet Series** — 每种漏洞类型一份速查。
- **CWE Top 25 + SANS Top 25** — 系统化分类。
- **PortSwigger Web Security Academy** — Web 漏洞免费课。
- **pwn.college / picoCTF / HackTheBox / RealWorldCTF / Pwn2Own writeups**。
- **Project Zero blog / MSRC / Apple Security Research / Quarkslab / Doyensec / SectorB**。
- **The Tangled Web (Michal Zalewski) / The Art of Software Security Assessment (Mark Dowd)**。
- **Practical Reverse Engineering (Bruce Dang) / Hacking: The Art of Exploitation (Erickson)**。
- **vulhub / exploitdb / KEV catalog** — 现成靶场 + 已知 PoC。
- **Bug Bounty Hunter / NahamCon talks**。
- **OffSec OSWE / OSCE3 / OSEE** — 培训认证体系。

## 自检（接到目标 30 分钟内回答）

1. 目标边界（一个 binary / 一个 repo / 一个 API / 一个域名 / 一台主机）？
2. 静态扫工具组合（Semgrep / CodeQL / Joern / 商业）？规则集？
3. 二进制 sink 函数清单（按目标语言定）？
4. Source / Sink 模型：哪些函数是 source（recv / parse / readFile / 用户输入）？sink 是哪些？
5. 数据流路径有几条？哪条最可达？
6. 缓解机制：ASLR / DEP / CFG / CET / Stack canary / Fortify / RELRO / Sanitizer？
7. 已知 CVE 历史 + KEV / EPSS 评分参考？
8. 1-day diff 思路 + 验证可达性方法？
9. 报告 + 检测规则（YARA / Sigma / Suricata）路径？
10. 复现环境（vulhub / 自家 lab / 客户授权环境）？

## 相邻技能

- `fuzzrev` — 找 crash → 喂回本技能做 root cause。
- `crashrev` — 拿到 crash dump → 评估可利用性。
- `diffrev` — 1-day 补丁差分 → 反推漏洞。
- `binrev` — 二进制函数级反编译。
- `irrev` — IR / 数据流 / 符号执行底层。
- `mitirev` — 缓解机制详查（与本技能配合）。
- `kernrev` — 内核漏洞专项。
- `webrev` — Web 漏洞静态 / 动态。
- `mrev` — 移动 App 漏洞研究。
- `cryptrev` — 加密 / 协议漏洞专项。
- `protrev` — 协议层漏洞（如 HTTP smuggling）。
- `rev-report` — 报告交付与 CVE 报洞流程。