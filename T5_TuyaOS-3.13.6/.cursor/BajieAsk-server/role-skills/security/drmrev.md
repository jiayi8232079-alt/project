---
name: drm-content-protection-reverse-engineering
description: DRM 与内容保护逆向。Widevine / FairPlay / PlayReady / HDCP；EME / CDM；视频流加密；游戏 DRM (Denuvo)；软件许可系统；水印技术；TEE 在 DRM 中的角色。配合 cryptrev / webrev / gamerev / packrev 用。
---

# DRM / 内容保护逆向

## 适用场景
- 分析 DRM 系统架构与安全边界 (授权安全研究)。
- 研究 Widevine / FairPlay / PlayReady 安全模型。
- 逆向软件许可系统 (FlexLM / 自研)。
- 分析游戏反盗版保护 (Denuvo)。
- 数字水印检测与分析。

## 不适用
- 实施盗版 (不在本技能范畴)。
- 通用加密分析 → `cryptrev`。
- 游戏反作弊 → `gamerev`。

---

## 视频 DRM

```text
三大 DRM 系统:
  Widevine (Google):
    L1: TEE (TrustZone) 内解密, 最高清 4K
    L3: 软件 CDM (Chrome / Android), 最高 720p
    → 安全研究: L3 CDM 在用户空间, 可分析
    → CDM: libwidevinecdm.so / widevinecdm.dll

  FairPlay (Apple):
    仅 Apple 设备 (Safari / iOS / tvOS)
    TEE: Secure Enclave
    FPS (FairPlay Streaming): HLS + SAMPLE-AES

  PlayReady (Microsoft):
    Windows / Xbox / Smart TV
    SL150 (软件) / SL2000 (硬件 TEE) / SL3000 (最高)

EME (Encrypted Media Extensions):
  浏览器标准 API:
  navigator.requestMediaKeySystemAccess('com.widevine.alpha', config)
    → MediaKeys → MediaKeySession → generateRequest(initData)
    → license server → update(license)
    → CDM 解密 → 解码 → 渲染

  CDM 与浏览器隔离: Chrome CDM 在沙箱进程中

加密格式:
  CENC (Common Encryption): AES-128-CTR, 多 DRM 共用
  SAMPLE-AES: Apple HLS, AES-128-CBC per sample
  CBCS: AES-128-CBC with subsample encryption
```

## 软件许可系统

```text
FlexLM / FlexNet:
  - 最广泛的商业许可系统
  - 组件: lmgrd (daemon) + vendor daemon + license file
  - License 类型: node-locked / floating / counted
  - 逆向: 找 lm_checkout() / lm_checkin() 调用
  - License 文件: INCREMENT ... SIGN=xxx
  - 签名验证 → 公钥在二进制中

Sentinel (Thales/Gemalto):
  - HASP HL (硬件 dongle) / SL (软件)
  - Envelope: 加壳保护
  - API: hasp_login / hasp_get_info / hasp_encrypt

CodeMeter (WIBU):
  - 硬件 (CmDongle) / 软件 (CmActLicense)
  - 加壳: AxProtector
  - 虚拟化: 关键代码在 CodeMeter 内执行

自研许可:
  常见模式:
  1. 读取 license file / registry / 网络验证
  2. 解密 / 验证签名
  3. 提取 expiry / features / machine binding
  4. 检查点散布在代码中

  逆向:
  1. 搜索 "license" / "expired" / "trial" / "registration" 字符串
  2. 找 license 读取 + 解析函数
  3. 找验证函数 (通常返回 bool)
  4. 分析 machine fingerprint 生成 (MAC / disk serial / CPUID)
  5. 分析加密/签名算法
```

## 游戏 DRM

```text
Denuvo:
  - 最广泛的游戏 DRM
  - 基于 VMProtect 技术
  - 运行时检查: 定期联网验证 + 虚拟机检测
  - 逆向难度: 极高 (代码虚拟化 + 反调试 + 完整性检查)
  - 性能影响争议
  → 详见 packrev (VMProtect) + gamerev

Steam DRM:
  - SteamStub: 简单加壳
  - Steamworks DRM: API 检查
  - 通常与 Denuvo 叠加使用

Epic Games:
  - 在线验证
  - 较弱 DRM (相比 Denuvo)
```

## 水印技术

```text
Forensic Watermarking:
  - 每个用户/设备获得微妙不同的内容
  - 泄漏时可追溯来源
  - 类型:
    视频: 不可见水印嵌入帧中 (空域/频域)
    音频: 回声/扩频水印
    文本: 零宽字符 / 同形字 / 微调空格

检测:
  - 两份内容 diff → 找水印区域
  - 频域分析 (DCT / DWT)
  - 统计分析

分析:
  - 提取 CDM 输出前后的视频 → diff 找水印注入点
  - 分析水印鲁棒性 (转码 / 裁剪 / 降质后是否存活)
```

## 实战入口
- **EME Logger (Chrome extension)** — 抓取 DRM 握手。
- **Widevine L3 Decryptor (研究)** — L3 CDM 分析参考。
- **FlexLM documentation** — 许可系统理解。
- **Denuvo analysis blogs** — 逆向分析文章。
- **DRM 学术论文** — ACM / IEEE 安全会议。

## 自检
1. DRM 类型？(Widevine / FairPlay / PlayReady / 许可系统 / 游戏 DRM)
2. 安全级别？(软件 / TEE / 硬件)
3. 分析目标？(架构理解 / 绕过研究 / 水印分析)
4. 法律合规？(研究豁免 / 授权测试)

## 相邻技能
- `cryptrev` — 加密算法分析。
- `webrev` — 浏览器端 DRM (EME)。
- `gamerev` — 游戏 DRM / 反作弊。
- `packrev` — 加壳 / VMProtect (Denuvo 基础)。
- `hwrev` — 硬件 dongle / TEE。