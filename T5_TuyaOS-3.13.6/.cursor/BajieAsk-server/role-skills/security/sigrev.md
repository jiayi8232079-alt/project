---
name: rf-signal-reverse-engineering
description: 无线电与 RF 信号逆向工程。SDR 硬件（HackRF / RTL-SDR / USRP / LimeSDR / PlutoSDR）；GNU Radio / SDR# / GQRX 信号采集与分析；调制解调识别（AM / FM / FSK / GFSK / OFDM / LoRa CSS）；协议逆向（Bluetooth / BLE / Zigbee / Z-Wave / NFC / RFID / Wi-Fi / GPS / ADS-B / TPMS / 遥控 / 无钥匙进入）；信号录制回放（replay attack）；频谱分析 + 瀑布图解读；Inspectrum / Universal Radio Hacker (URH) 自动化分析；Sub-GHz / 433/868/915 MHz 遥控协议逆向。配合 hwrev / iotrev / carrev / protrev 用。
---

# 无线电 / SDR / RF 信号逆向

## 适用场景

- 用 SDR 捕获 + 分析未知无线信号的调制方式与协议。
- 逆向 Bluetooth / BLE / Zigbee / Z-Wave 设备通信协议。
- 分析 NFC / RFID 卡片协议 + 克隆 / 模拟研究。
- 对汽车无钥匙进入 / TPMS / 遥控器做 RF 信号分析。
- 用 GNU Radio / URH 构建自定义解调 + 解码管道。
- LoRa / LoRaWAN / Sigfox 等 LPWAN 协议逆向。
- ADS-B / AIS / NOAA / POCSAG / P25 等开放协议接收与解码。

## 不适用

- 只想配置 Wi-Fi / Bluetooth 连接。
- TCP/IP 网络协议分析 → `protrev`。
- 纯软件无线电开发（非逆向）。

---

## SDR 硬件

```text
设备                频率范围              带宽        TX    价格     备注
RTL-SDR v3/v4      24 MHz – 1.8 GHz     2.4 MHz     ✗     $25      入门首选
HackRF One         1 MHz – 6 GHz        20 MHz      ✓     $300     半双工, 万能
YARD Stick One     300-348/391-464/      ISM band    ✓     $100     Sub-GHz 专用
                   868-915 MHz
Flipper Zero       Sub-GHz + NFC +       内置        ✓     $170     便携多功能
                   RFID + IR + BLE
LimeSDR            100 kHz – 3.8 GHz    61.44 MHz   ✓     $300     全双工
PlutoSDR (ADALM)   325 MHz – 3.8 GHz    20 MHz      ✓     $150     全双工, 教育
USRP B200/B210     70 MHz – 6 GHz       56 MHz      ✓     $1500+   研究级
BladeRF 2.0        47 MHz – 6 GHz       56 MHz      ✓     $480     全双工

选择建议:
  入门:        RTL-SDR v4 ($25) → 只收不发, 够用
  Sub-GHz:     YARD Stick One / Flipper Zero
  全功能:      HackRF One (半双工) / LimeSDR (全双工)
  研究级:      USRP B210

天线:
  宽带:        Telescopic / Discone antenna
  定向:        Yagi (特定频段)
  Sub-GHz:     433/868/915 MHz 专用天线
  GPS:         有源 GPS 天线
  ADS-B:       1090 MHz 专用
```

---

## 软件工具

### GNU Radio

```bash
# 安装
# Ubuntu: sudo apt install gnuradio
# macOS:  brew install gnuradio
# conda:  conda install -c conda-forge gnuradio

# GNU Radio Companion (GUI)
gnuradio-companion                         # 拖拽式信号处理图

# 基本流程图:
# Source (RTL-SDR/HackRF/File) → Filter → Demod → Sink (Audio/File/Network)

# Python API
import numpy as np
from gnuradio import gr, blocks, analog, filter

class MyReceiver(gr.top_block):
    def __init__(self):
        gr.top_block.__init__(self)
        # RTL-SDR source
        src = osmosdr.source(args="rtl=0")
        src.set_center_freq(433.92e6)
        src.set_sample_rate(2e6)
        src.set_gain(40)
        # 低通滤波
        lpf = filter.low_pass_filter(
            decimation=1, gain=1, cutoff_freq=100e3,
            transition_width=20e3, window=filter.firdes.WIN_HAMMING)
        # FM 解调
        demod = analog.fm_demod_cf(channel_rate=2e6, audio_decim=10,
                                    deviation=5e3, audio_pass=5e3, audio_stop=10e3)
        # 输出
        sink = blocks.wavfile_sink("output.wav", 1, 200000)
        self.connect(src, lpf, demod, sink)

if __name__ == '__main__':
    tb = MyReceiver()
    tb.run()
```

### SDR# / GQRX / CubicSDR

```text
SDR# (Windows):
  - 插件生态丰富
  - DSD+ 插件: 数字语音 (P25 / DMR / D-STAR)
  - 频谱 + 瀑布图 实时显示

GQRX (Linux/macOS):
  - GNU Radio 后端
  - 简单易用的频谱分析
  - gqrx --reset

CubicSDR (跨平台):
  - 现代 UI
  - 支持多设备
```

### Universal Radio Hacker (URH)

```bash
# 最强协议逆向工具
pip install urh
urh                                        # 启动 GUI

# 工作流:
# 1. Record: 录制信号 (RTL-SDR / HackRF / file)
# 2. Interpretation: 自动识别调制 (ASK/OOK/FSK/PSK)
# 3. Analysis: 比特级协议分析
#    - 自动找 preamble / sync word
#    - 自动区分不同消息
#    - 支持 Manchester / differential 编码
# 4. Generator: 构造自定义信号
# 5. Simulation: 回放 / 发送 (需要 TX 硬件)

# CLI 模式
urh-cli --device HackRF --freq 433920000 --sample-rate 2000000 \
    --bandwidth 2000000 --gain 40 --output capture.complex
```

### Inspectrum

```bash
# 信号可视化 + 手动分析
sudo apt install inspectrum
inspectrum capture.cfile

# 功能:
# - 高质量瀑布图
# - 手动选择区域 → 提取符号
# - 支持 AM/FM/cursor 测量
# - 导出选区为 bits
```

---

## 调制识别

```text
常见调制方式:

OOK (On-Off Keying) — 最简单:
  有信号 = 1, 无信号 = 0
  用途: 433 MHz 遥控器, 车库门, 简单传感器
  识别: 瀑布图上看到方波 burst

ASK (Amplitude Shift Keying):
  振幅变化编码
  OOK 是 ASK 的特例
  用途: RFID (125 kHz), 简单遥控

FSK (Frequency Shift Keying):
  频率变化编码 (高频 = 1, 低频 = 0)
  用途: TPMS, 气象站, 部分遥控
  识别: 瀑布图上看到两条频率交替

GFSK (Gaussian FSK):
  FSK + 高斯滤波 (平滑过渡)
  用途: Bluetooth / BLE / Zigbee / Z-Wave / DECT
  识别: FSK 但过渡更平滑

MSK / GMSK:
  连续相位 FSK
  用途: GSM / AIS

PSK / QPSK / BPSK:
  相位变化编码
  用途: Wi-Fi / LTE / DVB-S

OFDM:
  多载波正交复用
  用途: Wi-Fi / LTE / DVB-T

LoRa CSS (Chirp Spread Spectrum):
  线性调频扩频
  用途: LoRa / LoRaWAN
  识别: 瀑布图上看到斜线 (chirp)
  工具: gr-lora (GNU Radio LoRa decoder)

自动识别:
  URH: 自动检测 ASK/FSK/PSK
  GNU Radio: 手动配置解调器
  SigDigger: 实时调制分析
```

---

## 协议逆向

### Sub-GHz (433/868/915 MHz)

```text
常见协议:
  433.92 MHz (ISM band):
    - 遥控器 (车库 / 窗帘 / 灯)
    - 气象站 (温湿度传感器)
    - 门铃
    - 汽车 TPMS (部分)
    - 安防传感器

  编码方式:
    PT2262/PT2264:  固定码, 三态编码 (0/1/Float)
    EV1527:         20-bit 地址 + 4-bit 数据, OOK
    HCS301 (Keeloq): 滚动码, 加密
    Nice FLO:       固定码
    CAME:           固定码
    Princeton:      24-bit OOK

分析流程:
  1. SDR 录制: hackrf_transfer -r capture.raw -f 433920000 -s 2000000
  2. URH 打开 → 自动检测调制 (通常 OOK/ASK)
  3. 找 preamble + sync word
  4. 解码 bit pattern
  5. 多次录制对比:
     - 固定码: 每次相同 → 可 replay
     - 滚动码: 每次不同 → 需要分析算法

Replay Attack (固定码):
  # 录制
  hackrf_transfer -r signal.raw -f 433920000 -s 2000000 -n 4000000
  # 回放
  hackrf_transfer -t signal.raw -f 433920000 -s 2000000
  # 或用 Flipper Zero / YARD Stick One

rtl_433 (自动解码 200+ 设备):
  rtl_433 -f 433920000 -R all              # 所有已知协议
  rtl_433 -f 433920000 -A                  # 分析模式
  rtl_433 -f 868000000 -R all              # 868 MHz 设备
```

### Bluetooth / BLE

```bash
# Bluetooth Classic 嗅探 (需要 Ubertooth One)
ubertooth-btbb -t <bd_addr>               # 跟踪特定设备
ubertooth-btbb -l                          # 扫描

# BLE 嗅探
# 方法 1: Ubertooth
ubertooth-btle -f -t <bd_addr>

# 方法 2: nRF Sniffer (nRF52840 Dongle)
# Wireshark + nRF Sniffer 插件
# 最推荐: 稳定 + 便宜 (~$10)

# 方法 3: HCI (需要配对)
sudo btmon                                 # 监控 HCI 流量
sudo hcitool lescan                        # 扫描 BLE 设备
sudo gatttool -b <addr> -I                 # 交互式 GATT 操作
  > primary                                # 列出 service
  > characteristics                        # 列出 characteristic
  > char-read-hnd <handle>                 # 读取
  > char-write-req <handle> <value>        # 写入

# BLE 协议逆向
# 1. 扫描 → 找到目标设备
# 2. 连接 → 枚举 GATT service + characteristic
# 3. 嗅探 → 录制通信
# 4. 分析 → 对比不同操作对应的数据包

# 工具:
# nRF Connect (手机 App) — BLE 调试
# Wireshark + BLE 解码 — 协议分析
# bettercap — 中间人
bettercap -eval "ble.recon on"
```

### NFC / RFID

```text
RFID 频段:
  125 kHz (LF): EM4100 / HID ProxCard / T5577 / AWID
  13.56 MHz (HF): MIFARE Classic / DESFire / NTAG / ISO 14443 / ISO 15693
  860-960 MHz (UHF): EPC Gen2 / ISO 18000-6C

工具:
  Proxmark3:  最强 RFID/NFC 研究工具 ($200+)
  ACR122U:    便宜 NFC 读写器 ($30)
  Flipper Zero: 内置 125 kHz + NFC
  ChameleonMini/Ultra: NFC 模拟卡

Proxmark3 常用:
  # LF (125 kHz)
  lf search                                # 自动识别 LF 卡
  lf em 410x_read                          # 读 EM4100
  lf hid read                              # 读 HID ProxCard
  lf t55xx detect                          # T5577 检测
  lf em 410x_clone --id <id>               # 克隆到 T5577

  # HF (13.56 MHz)
  hf search                                # 自动识别 HF 卡
  hf mf info                               # MIFARE 信息
  hf mf autopwn                            # 自动破解 MIFARE Classic 密钥
  hf mf dump                               # dump 卡数据
  hf mf restore                            # 写入数据
  hf mf sim --1k                           # 模拟 MIFARE 1K

MIFARE Classic 破解:
  - 默认密钥: FFFFFFFFFFFF / A0A1A2A3A4A5 / D3F7D3F7D3F7
  - Nested attack: 已知一个扇区密钥 → 推算其他扇区
  - Darkside attack: 零知识 → 获取第一个密钥
  - Hardnested: 改进版 nested (对某些卡必需)
```

### Zigbee

```bash
# 嗅探 (需要 CC2531 USB dongle 或 HackRF + gr-ieee802-15-4)
# CC2531 + Wireshark:
sudo zbdump -c 11 | wireshark -k -i -
# channel 11-26 (2.4 GHz band)

# 攻击工具:
# KillerBee (最经典)
pip install killerbee
zbstumbler                                 # 扫描 Zigbee 网络
zbdump -c <channel> -w capture.pcap        # 抓包
zbgoodfind                                 # 搜索加密密钥
zbreplay                                   # 重放

# Zigbee 安全:
# Network key: AES-128, 通常在入网时明文传输
# Trust Center Link Key: 预共享 (默认: ZigBeeAlliance09 = 全零问题)
# 如果抓到入网过程 → 获得 network key → 解密所有流量
```

---

## 汽车 RF

```text
频段:
  315 MHz / 433 MHz: 无钥匙进入 (RKE) / TPMS
  125 kHz: LF 唤醒 (PKES 近场)
  2.4 GHz: BLE key (Tesla / 部分新车)

无钥匙进入 (PKES - Passive Keyless Entry & Start):
  1. 车辆发 LF 唤醒 (125 kHz, 1-2m)
  2. 钥匙收到后发 UHF 响应 (315/433 MHz)
  3. 车辆验证 → 解锁

  Relay Attack (中继攻击):
  - 攻击者 A 在车旁 → 中继 LF 信号 → 远程
  - 攻击者 B 在钥匙旁 → 接收 LF → 钥匙响应
  - 钥匙以为在车旁 → 发 UHF → 通过 A 传回车
  - 车辆解锁 + 启动

  防御: UWB 测距 (Apple / Samsung 新方案) / 运动检测

RKE 滚动码 (KeeLoq):
  - HCS301 / HCS200 chip
  - 64-bit key + 滚动码
  - 历史攻击: RollJam (Samy Kamkar)
    1. 干扰 + 录制第一次按键
    2. 车未收到 → 用户再按
    3. 干扰 + 录制第二次, 回放第一次
    4. 保留第二次 → 下次使用

TPMS:
  - 315 MHz (美) / 433 MHz (欧)
  - 通常无认证
  - 可 spoof 假数据 (温度 / 压力告警)
  rtl_433 -f 315000000 -R 60              # TPMS 解码
```

---

## 频谱分析

```text
关键概念:
  频率:      信号中心频率 (Hz)
  带宽:      信号占用的频率范围
  调制:      数据如何编码到载波上
  采样率:    ADC 采集速率 (Nyquist: ≥2× 信号带宽)
  增益:      接收放大 (dB)
  FFT:       时域 → 频域变换
  瀑布图:    频率 (x) × 时间 (y) × 功率 (颜色)

解读瀑布图:
  - 窄带连续信号: FM 广播 / 对讲机
  - 脉冲 burst: 遥控器 / 传感器
  - 宽带跳频: Bluetooth / Wi-Fi
  - 斜线 chirp: LoRa / 雷达
  - 周期性 burst: TPMS / 气象站

关键频率:
  27 MHz:      CB 无线电
  87.5-108 MHz: FM 广播
  118-137 MHz: 航空通信
  144-146 MHz: 业余 2m
  315 MHz:     美国 ISM (遥控/TPMS)
  433.92 MHz:  欧洲 ISM (遥控/传感器)
  868 MHz:     欧洲 ISM (LoRa/Sigfox)
  915 MHz:     美国 ISM (LoRa)
  1090 MHz:    ADS-B (飞机)
  1575.42 MHz: GPS L1
  2.4 GHz:     Wi-Fi / Bluetooth / Zigbee / 微波炉
  5 GHz:       Wi-Fi 5/6
```

---

## 实战入口

- **RTL-SDR blog** — rtl-sdr.com — SDR 项目教程。
- **GNU Radio tutorials** — wiki.gnuradio.org。
- **Universal Radio Hacker (URH)** — 最佳协议逆向工具。
- **Flipper Zero docs** — docs.flipper.net — 便携 RF 工具。
- **Proxmark3 wiki** — RFID/NFC 研究圣经。
- **Michael Ossmann (Great Scott Gadgets)** — HackRF 作者, SDR 教程。
- **rtl_433** — 自动解码 200+ 无线设备。
- **Samy Kamkar talks** — RollJam / MagSpoof / Combo Breaker。
- **YARD Stick One + RfCat** — Sub-GHz Python 交互。
- **KillerBee** — Zigbee 安全研究框架。

## 自检（接到目标 30 分钟内回答）

1. 目标频段？（Sub-GHz / 2.4 GHz / 5 GHz / LF / HF / UHF）
2. SDR 硬件？（RTL-SDR / HackRF / USRP / Flipper / Proxmark）
3. 需要发射吗？（仅接收 / 需要 TX / 需要全双工）
4. 信号类型？（连续 / 脉冲 / 跳频）
5. 调制方式？（OOK / FSK / GFSK / PSK / OFDM / CSS）
6. 协议？（已知 / 未知 / 专有）
7. 加密？（无 / 固定码 / 滚动码 / AES / 专有）
8. 攻击目标？（嗅探 / 解码 / 重放 / 中继 / 注入）
9. 法律合规？（仅接收合法 / 发射需要授权）
10. 相邻技能？（hwrev / iotrev / carrev / protrev / cryptrev）

## 相邻技能

- `hwrev` — 硬件安全（PCB / JTAG / SPI / UART）。
- `iotrev` — IoT 设备逆向（固件 + 通信）。
- `carrev` — 汽车安全（CAN bus + RF）。
- `protrev` — 协议分析（数据链路层以上）。
- `cryptrev` — 加密分析（RF 协议中的密码学）。
- `fwrev` — 固件逆向（RF 芯片固件）。