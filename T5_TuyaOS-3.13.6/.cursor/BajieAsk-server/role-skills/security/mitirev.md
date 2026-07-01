---
name: mitigation-reverse-engineering
description: 安全缓解机制逆向与评估。ASLR / DEP / Canary / RELRO / CFG / CET / PAC / MTE / Sandbox / WDAC / SIP / TCC。评估缓解覆盖度与已知绕过。配合 vulnrev / binrev / kernrev 用。
---

# 安全缓解机制逆向

## 适用场景
- 评估二进制的安全缓解覆盖度 (checksec / winchecksec)。
- 研究特定缓解机制的绕过方法。
- 分析 sandbox 配置与逃逸面。
- 评估 CFI / CET / PAC 对漏洞利用的影响。
- 理解平台安全模型 (Windows / Linux / macOS)。

## 不适用
- 只想启用缓解 → 编译器/OS 文档。
- 完整 exploit chain → 不在本技能。
- 漏洞挖掘 → `vulnrev`。

---

## 缓解机制速查

### 编译级

```text
缓解             编译器选项                    检查方法                    绕过难度
──────────────────────────────────────────────────────────────────────────────
Stack Canary     -fstack-protector-strong     checksec / readelf          中 (info leak)
                 /GS (MSVC)

FORTIFY_SOURCE   -D_FORTIFY_SOURCE=2          objdump | grep __chk       低 (只防简单溢出)

PIE/ASLR         -fPIE -pie                   checksec / file             中 (info leak)
                 /DYNAMICBASE (MSVC)

RELRO            -Wl,-z,relro,-z,now          checksec                    高 (Full RELRO)
                 (Full: GOT readonly)

NX/DEP           默认启用                      checksec / readelf          低 (ROP/JOP)
                 /NXCOMPAT (MSVC)

CFI              -fsanitize=cfi (Clang)        看是否有 cfi-icall/vcall   高
                 /guard:cf (MSVC → CFG)

SafeSEH          /SAFESEH (MSVC x86)           dumpbin /LOADCONFIG        中

Shadow Stack     CET-SS (Intel) / -fcf-protection=full   看 ENDBR 指令   高
                 PAC (ARM) / -mbranch-protection=standard

MTE              -fsanitize=memtag (ARM)       看 memtag 指令             高 (概率性)
```

### checksec 一键检查

```bash
# Linux
checksec --file=binary
# 输出: RELRO / Stack Canary / NX / PIE / RPATH / RUNPATH / Symbols / FORTIFY

# Windows
winchecksec.exe binary.exe
# 输出: ASLR / DEP / CFG / SafeSEH / GS / RFG / Authenticode

# macOS
codesign -dvvv binary                      # 签名 + entitlements
# PIE: file binary → "position independent executable"
# 无 checksec, 手动: otool -hv → MH_PIE flag
```

### 运行时

```text
ASLR 实现:
  Linux:   /proc/sys/kernel/randomize_va_space (0=off, 1=partial, 2=full)
           随机化: stack / mmap / heap / PIE base / vDSO
  Windows: DYNAMICBASE + High Entropy ASLR + ForceASLR
           随机化: image base / stack / heap / PEB/TEB
  macOS:   总是启用, 无法关闭 (用户态)

ASLR 绕过:
  - 信息泄漏 (最常见): format string / OOB read → 泄漏地址
  - 部分覆盖: 12-bit page offset 不变
  - JIT spray: 大量 JIT 代码喷射
  - ret2plt: PLT 地址不受 ASLR 影响 (non-PIE)
  - brute force: 32-bit 下可行 (fork server)
```

## CFI / CFG / CET

```text
CFG (Control Flow Guard, Windows):
  - 间接调用前检查目标是否合法
  - _guard_check_icall / _guard_dispatch_icall
  - 合法目标记录在 CFG bitmap
  - 绕过: 找到一个合法但可利用的目标 (call target confusion)

CET (Control-flow Enforcement Technology, Intel):
  Shadow Stack:
    - 硬件维护的返回地址栈
    - RET 时比较 shadow stack 与 real stack
    - 不匹配 → #CP exception
    - 绕过: 需要写入 shadow stack (极难)

  IBT (Indirect Branch Tracking):
    - 间接跳转/调用目标必须以 ENDBR64/ENDBR32 开头
    - 没有 ENDBR → #CP exception
    - 绕过: 跳到有 ENDBR 的 gadget

PAC (Pointer Authentication, ARM):
  - 指针高位存储签名 (PAC)
  - PACIA / PACDA: 签名
  - AUTIA / AUTDA: 验证
  - 函数返回: RETAA / RETAB (验证 + 返回)
  - 绕过: PAC oracle / signing gadget / key reuse

kCFI (Linux kernel):
  - Clang 实现的 kernel CFI
  - 每个间接调用前检查函数类型 hash
  - 不匹配 → panic

FineIBT (Linux):
  - CET IBT + kCFI 结合
  - ENDBR → 紧跟类型 hash 检查
```

## Sandbox

```text
Linux:
  seccomp:
    - 限制可用 syscall (白名单/黑名单)
    - prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &bpf_prog)
    - Chrome / Firefox / Docker 都用
    - 分析: seccomp-tools dump ./binary
    - 绕过: 找到未被过滤的 syscall

  namespaces:
    - pid / net / mount / user / uts / ipc / cgroup
    - 容器隔离基础
    - 逃逸: 内核漏洞 / 配置不当

  AppArmor / SELinux:
    - MAC (Mandatory Access Control)
    - 限制文件/网络/能力
    - aa-status / sestatus 检查

Windows:
  AppContainer:
    - UWP 应用 / Edge / Chrome sandbox
    - 极低权限 integrity level
    - 限制文件/注册表/网络访问

  Win32k lockdown:
    - 禁止 sandbox 进程调用 win32k.sys
    - Chrome renderer 启用

  WDAC (Windows Defender Application Control):
    - 应用白名单 (代替 AppLocker)
    - 基于签名 / hash / 路径

macOS:
  Sandbox (Seatbelt):
    - 基于 TrustedBSD MAC framework
    - .sb 文件定义策略
    - codesign -d --entitlements :- binary

  SIP (System Integrity Protection):
    - 保护系统文件 + 内核扩展
    - 即使 root 也不能修改 /System

  TCC (Transparency, Consent, and Control):
    - 控制对隐私数据的访问 (相机/麦克风/联系人/位置)
    - 数据库: ~/Library/Application Support/com.apple.TCC/TCC.db

  Gatekeeper:
    - 应用签名 + 公证验证
    - 首次打开检查
```

## 评估流程

```text
1. 静态检查:
   checksec / winchecksec → 编译级缓解覆盖

2. 运行时检查:
   ASLR 状态 / seccomp 策略 / sandbox 配置
   /proc/<pid>/maps → 地址随机化验证

3. 缓解绕过可行性评估:
   - 有信息泄漏原语？→ ASLR 可绕
   - 有任意写原语？→ stack canary / CFG / CET 可能绕
   - 有 JIT？→ W^X 可能绕
   - Sandbox 限制？→ 检查 syscall 过滤

4. 输出:
   缓解覆盖度报告 + 已知绕过 + 残余风险
```

## 实战入口
- **checksec / winchecksec** — 一键检查。
- **gef / pwndbg** — 调试时查看缓解状态。
- **seccomp-tools** — seccomp 策略分析。
- **Intel CET whitepaper / ARM PAC docs**。
- **Project Zero blog** — 缓解绕过研究。
- **CTF pwn challenges** — 实战练习缓解绕过。

## 自检
1. 目标平台？(Linux / Windows / macOS)
2. checksec 结果？
3. 有 CFI/CFG/CET/PAC？
4. Sandbox？(seccomp / AppContainer / macOS Sandbox)
5. 需要评估绕过可行性？
6. 有信息泄漏/任意写？

## 相邻技能
- `vulnrev` — 漏洞研究。
- `binrev` — 二进制分析。
- `kernrev` — 内核安全机制。
- `winrev` / `linuxrev` / `macrev` — 平台安全模型。