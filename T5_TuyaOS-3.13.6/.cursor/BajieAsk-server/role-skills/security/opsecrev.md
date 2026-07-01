---
name: reverse-engineering-opsec
description: 逆向工程操作安全。样本隔离 / 分析环境反指纹 / 在线沙箱 OPSEC / 安全处理 / 网络隔离 / 痕迹清理 / 团队规范 / 法律合规。配合 revlab / malrev 用。
---

# 逆向工程 OpSec / 操作安全

## 适用场景
- 搭建安全的逆向分析环境。
- 处理可能有害的样本。
- 评估在线沙箱提交的 OPSEC 风险。
- 制定团队逆向操作安全规范。

## 不适用
- 实验室基础设施搭建 → `revlab`。
- 恶意样本分析 → `malrev`。

---

## 样本处理

```text
收到样本时:
  1. 不要在日常系统上打开 / 双击
  2. 计算 hash: sha256sum sample
  3. 密码压缩: zip -e -P infected sample.zip sample
  4. 文件名用 hash, 不用原始名 (避免社工)
  5. 传输: 加密通道 (Signal / PGP email / SFTP)
  6. 存储: 专用加密分区 / vault

命名规范:
  {sha256_prefix}_{date}_{brief}.{ext}.malz
  例: a1b2c3d4_20260523_agent_loader.exe.malz
  后缀 .malz 防止意外执行
```

## VM 隔离

```text
最小隔离 (个人):
  1. VM 快照 (分析前快照 → 分析后还原)
  2. 网络: Host-only 或断网
  3. 共享文件夹: 禁用或只读
  4. 剪贴板: 禁用双向共享
  5. USB: 禁止 passthrough

推荐配置:
  ┌─────────────────────────────────────┐
  │ 宿主机 (不接触样本)                   │
  │   ├── 分析 VM (REMnux / FLARE-VM)  │
  │   │     └── 断网 / Host-only        │
  │   └── 网络模拟 VM (inetsim/fakenet)  │
  │         └── 内部网络, 模拟互联网     │
  └─────────────────────────────────────┘

反虚拟机检测:
  恶意样本常检测 VM:
  - CPUID hypervisor bit
  - VM 特征文件 (vmtoolsd / VBoxGuest)
  - MAC 地址前缀 (00:0C:29 / 08:00:27)
  - 注册表 (HKLM\SYSTEM\...\SystemBiosVersion)
  - 低分辨率 / 少 CPU / 少内存

  对策:
  - 修改 VM 配置 (MAC / BIOS / CPUID)
  - 增加 CPU / 内存 / 分辨率
  - 安装常见用户软件 (Office / Browser)
  - VBoxHardenedLoader / pafish 检测验证
```

## 在线沙箱 OPSEC

```text
提交到公开沙箱的风险:
  VirusTotal:
    - 上传后全球安全厂商可下载分析
    - 样本永久保留, 无法删除
    - 如果是 APT 样本 → 攻击者监控 VT → 知道被发现
    - 如果含客户数据 / 内部 IOC → 泄漏

  any.run / Hybrid Analysis / Joe Sandbox:
    - 动态分析报告公开 (除非付费私有)
    - 类似风险

  建议:
    ✗ 不要上传: 含客户数据 / 内部工具 / APT 样本
    ✓ 可以上传: 已知通用恶意软件 / 已公开 hash
    ✓ 只查 hash: VT search by hash (不上传文件)
    ✓ 私有沙箱: CAPE / Cuckoo / 自建
```

## 网络隔离

```text
方案 1: 完全断网
  最安全, 但某些恶意样本不行为

方案 2: 模拟网络
  inetsim (Linux): 模拟 HTTP/HTTPS/DNS/SMTP/FTP
  FakeNet-NG (Windows): 类似 inetsim
  INetSim + REMnux: 标准方案

方案 3: 受控联网 (高风险)
  VPN / Tor → 通过隔离网络出去
  仅用于: 需要联网行为的样本 (C2 通信分析)
  必须: 独立 IP / 独立身份 / 流量监控
  风险: 样本可能 DDoS / 传播 / 回连

DNS Sinkhole:
  所有 DNS 请求指向本地 (inetsim)
  记录域名作为 IOC
```

## 痕迹管理

```text
分析环境:
  - VM 快照还原 (每次分析后)
  - 不在分析 VM 中登录个人账号
  - 不在分析 VM 中打开个人文件

宿主机:
  - 禁用 VM 共享文件夹
  - 不在宿主机上解压恶意样本
  - 宿主机防火墙限制 VM 网络

报告:
  - 不在公开报告中泄漏内部基础设施
  - 脱敏: 客户名 / 内部 IP / 域名
  - hash 可公开 (如果已公开)

团队:
  - 共享存储加密
  - 访问控制: 需要知道才给权限
  - 样本传输: 加密 + 密码保护
  - 操作日志: 谁在何时分析了什么
```

## 法律合规

```text
关键法律:
  CFAA (Computer Fraud and Abuse Act, 美国)
  计算机犯罪法 (中国 刑法第285/286条)
  GDPR (欧盟数据保护)
  DMCA (美国反规避法, DRM 相关)

要求:
  - 授权: 所有分析必须有书面授权
  - 范围: 不超出授权范围
  - 数据保护: 分析中获得的个人数据需保护
  - 报告: 发现漏洞需负责任披露
  - 记录: 保留分析过程证据 (法律需要时)

证书:
  OSCP / OSCE / GREM / CREA / ECES / CEH 等
  证书证明专业能力和职业规范
```

## 实战入口
- **revlab** — 实验室搭建细节。
- **REMnux + FLARE-VM** — 标准分析环境。
- **inetsim / FakeNet-NG** — 网络模拟。
- **SANS FOR610** — 恶意软件逆向课程。
- **Malware Analyst Cookbook** — 安全处理章节。

## 自检
1. 分析环境隔离？(VM / 快照 / 断网)
2. 在线沙箱策略？(hash only / 私有 / 公开)
3. 样本存储加密？
4. 授权文档？
5. 报告脱敏？

## 相邻技能
- `revlab` — 实验室基础设施。
- `malrev` — 恶意软件分析。
- `memrev` — 内存取证。