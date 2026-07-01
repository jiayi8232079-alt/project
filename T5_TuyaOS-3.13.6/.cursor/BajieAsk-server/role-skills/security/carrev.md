---
name: automotive-security-reverse-engineering
description: 汽车安全逆向。CAN / CAN FD / LIN / FlexRay / Automotive Ethernet；UDS / OBD-II；ECU 固件；T-Box / IVI / OTA；ADAS；V2X；无钥匙进入 / TPMS RF；Autosar / QNX / Linux 车载 OS。配合 sigrev / hwrev / fwrev / protrev / icsrev 用。
---

# 汽车安全逆向

## 适用场景
- 分析 CAN bus 流量与 ECU 通信。
- 逆向 ECU 固件 (提取 + 分析)。
- 评估车载 T-Box / IVI 安全。
- 研究无钥匙进入 / TPMS RF 安全。
- 汽车安全渗透测试 (授权)。

## 不适用
- 汽车维修 / OBD 故障码读取。
- RF 信号基础 → `sigrev`。
- 通用固件逆向 → `fwrev`。

---

## CAN Bus

```text
CAN 2.0:
  速率: 最高 1 Mbit/s
  帧格式: [Arbitration ID (11/29 bit)] [DLC (0-8)] [Data (0-8 bytes)] [CRC]
  无认证、无加密、广播式
  任何节点都能发送任意 ID

CAN FD:
  数据段最大 64 bytes
  数据段可达 8 Mbit/s
  帧格式兼容 CAN 2.0

总线拓扑:
  ECU ──┬── CAN-H ──┬── ECU
        │           │
  ECU ──┴── CAN-L ──┴── ECU
  (所有 ECU 共享同一总线)
```

### CAN 嗅探

```bash
# Linux SocketCAN
sudo ip link set can0 up type can bitrate 500000
candump can0                               # 嗅探所有帧
candump can0 -l                            # 保存日志
cansniffer can0                            # 实时变化高亮

# 发送
cansend can0 123#DEADBEEF                  # 发送 ID=0x123 Data=DEADBEEF
cangen can0                                # 生成随机流量

# 回放
canplayer -I logfile.log

# Python
import can
bus = can.interface.Bus(channel='can0', interface='socketcan')
for msg in bus:
    print(f"ID=0x{msg.arbitration_id:03X} Data={msg.data.hex()}")

# 硬件:
# OBD-II 接口 + ELM327 (便宜但有限)
# CANable / PEAK PCAN / Kvaser / Vector CANalyzer (专业)
# Comma.ai Panda ($100, 推荐)
```

### CAN 逆向

```text
方法论:
  1. 被动嗅探: 录制正常行驶 + 各种操作 (转向/刹车/灯/窗)
  2. 差分分析: 操作前后对比 → 找到对应 CAN ID
  3. DBC 数据库: 已知车型 → OpenDBC / commaai/opendbc
  4. UDS 扫描: 主动探测 ECU 支持的诊断服务

工具:
  SavvyCAN:        GUI CAN 分析 (candump + DBC + scripting)
  Kayak:           Java CAN 分析
  CANToolz:        Python CAN 安全测试框架
  caringcaribou:   汽车安全测试 (UDS / XCP / ISO-TP)
  scapy:           can layer 支持
```

## UDS (Unified Diagnostic Services)

```text
ISO 14229 标准:
  用途: ECU 诊断 / 编程 / 配置
  传输: CAN (ISO 15765) / DoIP (Ethernet) / K-Line

关键服务:
  0x10  DiagnosticSessionControl     切换诊断模式
  0x11  ECUReset                     重启 ECU
  0x14  ClearDiagnosticInformation   清故障码
  0x19  ReadDTCInformation           读故障码
  0x22  ReadDataByIdentifier         读数据
  0x23  ReadMemoryByAddress          读内存 (!)
  0x27  SecurityAccess               安全认证 (seed-key)
  0x2E  WriteDataByIdentifier        写数据
  0x31  RoutineControl               执行例程
  0x34  RequestDownload              请求下载 (固件刷写)
  0x36  TransferData                 传输数据
  0x37  RequestTransferExit          结束传输
  0x3D  WriteMemoryByAddress         写内存 (!)
  0x3E  TesterPresent                保持会话

安全认证 (0x27 SecurityAccess):
  1. Tester → ECU: SecurityAccess(requestSeed, level)
  2. ECU → Tester: seed (随机数)
  3. Tester: key = f(seed, secret)  ← 逆向目标!
  4. Tester → ECU: SecurityAccess(sendKey, key)
  5. ECU: 验证 key → 解锁高权限服务

  逆向 seed-key 算法:
  - ECU 固件中找 SecurityAccess handler
  - 通常是简单的异或/位移/查表
  - 有些厂商用 AES/RSA (新车)
```

## ECU 固件

```text
提取:
  1. UDS 0x23 ReadMemoryByAddress (需要安全认证)
  2. UDS 0x34/0x36 RequestDownload (dump)
  3. JTAG/SWD (硬件接入)
  4. SPI flash 直读
  5. OTA 更新包截获

常见芯片:
  Renesas RH850 / RL78
  NXP S32K / MPC5748
  Infineon Aurix TC3xx
  STM32 (ARM Cortex-M)
  TI TMS570

分析:
  1. 识别架构 (RH850 / ARM / PowerPC / TriCore)
  2. Ghidra / IDA 加载 (需要正确 processor + base address)
  3. 找 UDS handler: 搜索 0x10 / 0x27 / 0x22 服务号
  4. 找 seed-key 算法
  5. 找 OTA 验证逻辑
  6. 找 CAN ID → 功能映射表

文件格式:
  S-Record (.s19 / .srec): Motorola hex
  Intel HEX (.hex): Intel hex
  Binary (.bin): raw
  A2L (.a2l): ECU 描述文件 (变量地址 + 名称)
  ODX/PDX (.odx): 诊断描述
```

## T-Box / IVI

```text
T-Box (Telematics Box):
  - 连接蜂窝网络 (4G/5G) + CAN bus
  - 功能: 远程启动/解锁 / OTA / 车辆状态上报
  - 攻击面: 蜂窝接口 / USB / BLE / Wi-Fi / CAN 网关

IVI (In-Vehicle Infotainment):
  - 操作系统: QNX / Android Automotive / Linux / WinCE
  - 攻击面: USB / BLE / Wi-Fi / 浏览器 / App Store / CAN 网关
  - 逆向: 类似嵌入式 Linux/Android (→ fwrev / mrev)

OTA (Over-The-Air):
  - 更新流程: 下载 → 验证签名 → 刷写
  - 攻击: 拦截 + 降级 / 篡改 / 重放
  - 分析: HTTPS 流量 → 更新包格式 → 验证逻辑
```

## 安全测试

```text
授权测试清单:
  □ CAN bus 嗅探与逆向
  □ UDS 服务扫描与安全认证
  □ ECU 固件提取与分析
  □ T-Box 蜂窝 / Wi-Fi / BLE 接口测试
  □ IVI 应用安全 / 浏览器
  □ OTA 更新流程分析
  □ 无钥匙进入 RF 分析 (→ sigrev)
  □ V2X 通信安全
  □ CAN 网关 / 域分离检查

工具:
  Vector CANoe / CANalyzer:  商业 (行业标准)
  PCAN-Explorer:             PEAK 系列
  SavvyCAN:                  开源
  caringcaribou:             开源安全测试
  Comma.ai Panda + openpilot: 研究平台
  Scapy + python-can:        自定义脚本
```

## 实战入口
- **OpenDBC (commaai)** — 开源 CAN 数据库。
- **caringcaribou** — 汽车安全测试框架。
- **SavvyCAN** — CAN 分析 GUI。
- **Charlie Miller & Chris Valasek** — Jeep hack 经典。
- **Car Hacker's Handbook (Craig Smith)**。
- **Auto-ISAC / SAE J3061** — 汽车网络安全标准。

## 自检
1. 有物理访问？(OBD / CAN / ECU / T-Box)
2. CAN 嗅探硬件？(Panda / PCAN / CANable)
3. 目标 ECU？(架构 / 芯片)
4. UDS 可用？
5. 有 DBC / A2L 文件？
6. 需要 RF 分析？(→ sigrev)
7. 授权范围？

## 相邻技能
- `sigrev` — 无钥匙进入 / TPMS RF。
- `hwrev` — ECU 硬件 / JTAG / SPI。
- `fwrev` — ECU 固件逆向。
- `protrev` — CAN / UDS 协议。
- `icsrev` — 工控类比。
- `cryptrev` — seed-key / OTA 签名。