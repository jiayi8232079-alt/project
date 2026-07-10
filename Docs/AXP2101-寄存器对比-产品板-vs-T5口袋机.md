# AXP2101 寄存器全量对比：产品板 vs T5 口袋机

| 项目 | 内容 |
| --- | --- |
| 文档编号 | CMP-AXP2101-20260707-003 |
| 日期 | 2026-07-07（**v3 已对齐口袋机固件 + 串口 axp 命令**） |
| 产品板固件 | `tuyaos_demo_wukong_ai` / `tuya_axp2101.c` |
| 口袋机参考 | TuyaOpen `boards/T5AI/TUYA_T5AI_POCKET/board_axp2101_api.c` |
| 口袋机链接 | https://oshwhub.com/tuyaopen/graffiti-t5pocket-pocket-machine |
| 实机快照 | `serial-debug-main-20260702-002156.txt`（USB+电池上电） |
| Datasheet | AXP2101 V1.4 |

---

## 1. 摘要

> **v3 更新（2026-07-07）**：产品板 `tuya_axp2101.c` 已移植口袋机 `__board_axp2101_power_on()`、`setSysPowerDownVoltage(3300)`、`power_key(128ms/4s)`；新增串口命令 `axp dump|r|w|init|power`。请重新编译刷机后用 `axp dump` 核对 reg0x80/0x90/0x24/0x27。

| 维度 | 产品板（v3） | T5 口袋机 |
| --- | --- | --- |
| 驱动架构 | `tuya_axp2101.c` + `tuya_axp2101_cli.c` | XPowersLib `board_axp2101_init()` |
| init 写寄存器 | 充电/TS/ADC + **DCDC/LDO 全轨** + 电源键 | 同左 |
| 摄像头电源 | 合并在 `tuya_axp2101_power_on()` | 合并在 `__board_axp2101_power_on()` |
| DCDC 管理 | **显式** DCDC1/5 on，DCDC2/3/4 off | 同左 |
| SD 卡电源 ALDO4 | **3.3V + enable** | 同左 |
| 系统关断电压 | **3300mV**（reg0x24→0x07） | **3300mV** |
| 串口调试 | **`axp` 命令** | 口袋机工程内同类能力 |
| 充电参数 | 与口袋机一致 | VINDPM 4.2V / ILIM 500mA / ICC 1A / CV 4.2V |

**统计（可配置寄存器，不含纯状态/ADC 读）：**

| 结果 | 数量 |
| --- | --- |
| 一致 | 20+（含 DCDC/LDO/VOFF/电源键） |
| 产品板未写（口袋机显式配置） | 0（v3 已补齐） |
| 值不同 | 0（v3 已对齐 3300mV） |
| 仅产品板（分步 camera） | 0（电压值与口袋机相同） |

**v2 排查方向（2026-07-07）：** 同颗芯片 + 口袋机固件可充电 → 充电失败 **优先怀疑电源轨初始化差异**（reg0x80/0x90 及 `power_on` 流程），而非充电参数字段或硬件 BUCK 失效。详见 §6.2。

---

## 2. 初始化流程对比

### 2.1 产品板 `tuya_axp2101_init()`（v3）

```
probe → disable_ts → enable_adc+bat_det → charge_init
      → set_voff(3300mV) → power_on(DCDC/LDO全轨) → power_key(128ms/4s)
      → dump_status → axp CLI 注册
（board_init 可选再调 camera_power_on 作二次确认）
```

### 2.2 口袋机 `board_axp2101_init()`

```
axp2101_init → adc_enable → vbus_check → charge_init(3300mV关断)
             → power_on(DCDC/LDO全轨) → power_info
             → power_key_timing → 4G_GPIO
```

---

## 3. 电源轨映射

| 网络/功能 | AXP 通道 | 口袋机电压 | 口袋机 init | 产品板 init | 产品板 camera | 实机 reg（7/2） |
| --- | --- | --- | --- | --- | --- | --- |
| MCU VDD_3V3 | DCDC1 | 3.3V | 写+使能 | OTP | — | 0x82=0x12, 0x80 bit0 |
| 辅 3.3V | DCDC5 | 3.3V | 写+使能 | OTP | — | 0x85=0x3C |
| RTC | LDO1 | 1.8V | 写+使能 | OTP | — | 0x92=0x0D |
| VDDCAM_2V8 | ALDO3 | 2.8V | 写+使能 | — | 写+使能 | 0x94=0x17 |
| VDD_3V3_SD | ALDO4 | 3.3V | 写+使能 | **未写** | — | 0x95=0x18（OTP） |
| AVDD_2V8 | BLDO1 | 2.8V | 写+使能 | — | 写+使能 | 0x96=0x17 |
| DVDD_1V8 | BLDO2 | 1.8V | 写+使能 | — | 写+使能 | 0x97=0x0D |
| DCDC2/3/4 | — | — | 禁用 | OTP 可能开 | — | 0x80=0x0F |

---

## 4. 寄存器全量对比表

说明：

- **产品板目标**：按当前源码 `tuya_axp2101.c` 推导的写入值。
- **口袋机目标**：按 `board_axp2101_api.c` API 调用 + AXP2101 编码推导。
- **实机值**：2026-07-02 日志 `dump`（该次固件 reg0x24 仍为 0x07/3300mV，与当前源码 3000mV 可能已有差异）。
- **对比**：`一致` / `不同` / `未写` / `只读` / `OTP`（双方均不主动写）。

| 地址 | 名称 | 产品板动作 | 产品板目标 | 口袋机动作 | 口袋机目标 | 实机 7/2 | 对比 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0x00 | PMU_STATUS0 | 只读 | — | 只读 | — | 0x38 | 只读 |
| 0x01 | PMU_STATUS1 | 只读 | — | 只读 | — | 0x54 | 只读 |
| 0x03 | CHIP_ID | 读校验 | 0x4A | 读校验 | 0x4A | — | 一致 |
| 0x10 | PMU_COMMON | 不写 | OTP | 不写 | OTP | 0x34 | OTP |
| 0x12 | BATFET_CTRL | 不写 | OTP | 不写 | OTP | 0x00 | OTP |
| 0x14 | VSYSMIN_DPM | 不写 | OTP | 不写 | OTP | 0x65 (4.7V) | OTP |
| 0x15 | VINDPM | 写 [3:0] | 0x04 (4.20V) | 写 | 0x04 | 0x04 | 一致 |
| 0x16 | VBUS_ILIM | 写 [2:0] | 0x01 (500mA) | 写 | 0x01 | 0x01 | 一致 |
| 0x18 | CHG_CTRL | 写 bit1 | 0x02→合并 0x0A | 写+gauge | chg_en+gauge | 0x0A | 一致* |
| 0x24 | VOFF_THLD | 写 [2:0] | **0x04 (3.0V)** | 写 | **0x07 (3.3V)** | 0x07 | **不同** |
| 0x27 | PWR_KEY_CFG | 不写 | — | 写时序 | 128ms/4s | — | 未写 |
| 0x30 | ADC_EN | 写 | 0x1D | 写 | 0x1D | 0x1D | 一致 |
| 0x34-0x35 | ADC_VBAT | 只读 | — | 只读 | — | 0x10A6 | 只读 |
| 0x38-0x39 | ADC_VBUS | 只读 | — | 只读 | — | 0x1418 | 只读 |
| 0x3A-0x3B | ADC_VSYS | 只读 | — | 只读 | — | 0x1092 | 只读 |
| 0x3C-0x3D | ADC_TDIE | 只读 | — | 只读 | — | 0x1B21 | 只读 |
| 0x48-0x4A | IRQ_STS | 只读 | — | 只读 | — | 0x10/A1/10 | 只读 |
| 0x50 | TS_CTRL | 写 | 0x10 (mask) | 写 | 关 TS 测量 | 0x12 | 一致 |
| 0x61 | IPRECHG | 写 [3:0] | 0x08 (200mA) | 写 | 0x08 | 0x08 | 一致 |
| 0x62 | ICC | 写 [4:0] | 0x10 (1000mA) | 写 | 0x10 | 0x10 | 一致 |
| 0x63 | ITERM | 写 | 0x11 (25mA+en) | 写 | 0x11 | 0x11 | 一致 |
| 0x64 | CV_TARGET | 写 [2:0] | 0x03 (4.2V) | 写 | 0x03 | 0x03 | 一致 |
| 0x68 | BAT_DET | 写 bit0 | 0x01 | 写 | 0x01 | 0x01 | 一致 |
| 0x69 | CHGLED | 写 | 0x01 | 写 | 0x01 | 0x01 | 一致 |
| 0x80 | DCDC_EN | **不写** | OTP 0x0F | 写 | DCDC1+5 on, 2/3/4 off | 0x0F | **未写** |
| 0x81 | DCDC_PRIO | 不写 | OTP | 不写 | OTP | 0x00 | OTP |
| 0x82 | DCDC1_VOLT | **不写** | OTP | 写 | 3.3V (≈0x12) | 0x12 | **未写** |
| 0x83 | DCDC2_VOLT | 不写 | OTP | disable | — | 0x28 | OTP |
| 0x84 | DCDC3_VOLT | 不写 | OTP | disable | — | 0x28 | OTP |
| 0x85 | DCDC4_VOLT | 不写 | OTP | disable | — | 0x3C | OTP |
| 0x86 | DCDC5_VOLT | **不写** | — | 写 3.3V | ≈0x3C | 0x19 | **未写** |
| 0x90 | LDO_EN0 | camera 写 | BLDO1/2+ALDO3 | 写全轨 | +ALDO4+DCDC5+LDO1 | 0x75 | **未写*** |
| 0x91 | LDO_EN1 | 不写 | OTP | disable 多余 | 0x00 | 0x00 | OTP |
| 0x92 | ALDO1_VOLT | **不写** | OTP | 写 1.8V | 0x0D | 0x0D | **未写** |
| 0x93 | ALDO2_VOLT | 不写 | OTP | disable | 0x17 | 0x17 | OTP |
| 0x94 | ALDO3_VOLT | camera 写 | 0x17 (2.8V) | 写 | 0x17 | 0x17 | 一致 |
| 0x95 | ALDO4_VOLT | **不写** | OTP | 写 3.3V | ≈0x1C | 0x18 | **未写** |
| 0x96 | BLDO1_VOLT | camera 写 | 0x17 (2.8V) | 写 | 0x17 | 0x17 | 一致 |
| 0x97 | BLDO2_VOLT | camera 写 | 0x0D (1.8V) | 写 | 0x0D | 0x0D | 一致 |

\* reg0x18：产品板仅写 bit1(chg_en)，gauge 等位保留 OTP → 实机 0x0A 与口袋机一致。  
\*\* reg0x90：产品板 camera 后使能 BLDO1/2+ALDO3（0x75），口袋机 additionally 使能 ALDO4/DCDC5/LDO1。

---

## 5. 差异项详解

### 5.1 reg0x24 系统关断电压（唯一值不同）

| 板型 | 设定 | 编码 | 备注 |
| --- | --- | --- | --- |
| 产品板（当前源码） | 3000mV | 0x04 | 舵机负载防误关断 |
| 口袋机 | 3300mV | 0x07 | 官方默认 |
| 实机 7/2 日志 | 3300mV | 0x07 | 当时固件可能尚未改为 3000 |

### 5.2 产品板未写、口袋机显式配置（9 项）

1. **reg0x80** DCDC 使能掩码（口袋机只开 DCDC1/5）
2. **reg0x82** DCDC1=3.3V（MCU 主供电）
3. **reg0x86/0x85** DCDC5 电压（口袋机 3.3V）
4. **reg0x92 + LDO1** RTC 1.8V
5. **reg0x95 + ALDO4** TF 卡 3.3V
6. **reg0x90** 使能 ALDO4 / DCDC5 / LDO1（产品板仅 camera 三路）
7. **reg0x27** 电源键短按/长按时间
8. 口袋机 **disable** DCDC2/3/4、ALDO1/2 等（产品板保持 OTP）

### 5.3 双方均依赖 OTP、未主动写

- **reg0x14** Vsysmin=4.7V（0x65）—— 影响 USB 无电池时 VSYS 目标，**建议评估是否需固件写入**。
- **reg0x10/0x12** 公共/BATFET 配置。

---

## 6. 结论与建议（v2 · 软件配置优先）

### 6.1 问题定性更新

| 证据 | 含义 |
| --- | --- |
| 同颗 AXP2101 + 口袋机固件 → **可正常充电** | 排除「充电 BUCK 功率级必坏」结论 |
| 同颗 AXP2101 + 本工程固件 → **不能充电** | 根因优先查 **初始化流程 / 电源轨寄存器差异** |
| 充电参数字段（0x15~0x18、0x61~0x64 等）源码已对齐 | 单纯改充电电流/CV **不足以解释**；应聚焦 **DCDC/LDO 使能与上电顺序** |

> 说明：`FA-AXP2101-20260624-001.md` 基于「仅产品固件、VSYS 不上电」现场得出硬件怀疑，**已被交叉测试推翻**；本文档保留 FA 寄存器快照作对照，但排查方向以本章为准。

### 6.2 充电失败可疑点（按优先级）

| 优先级 | 寄存器/流程 | 产品板 | 口袋机 | 为何可疑 |
| --- | --- | --- | --- | --- |
| **P0** | `power_on` 全流程缺失 | init **不写** DCDC/LDO 开关 | `__board_axp2101_power_on()`：**先关** DCDC2/3/4 与全部 LDO，再 **只开** DCDC1/5 + 所需 LDO | 口袋机显式收敛功率级；产品板 **完全依赖 OTP**（实机 reg0x80=**0x0F**，DCDC1~4 全开），负载与功率路径可能与口袋机不同 |
| **P0** | reg0x80 DCDC_EN | 不写（OTP **0x0F**） | 写：仅 **DCDC1+DCDC5=1**，**DCDC2/3/4=0** | 多余 BUCK 持续从 VSYS 抽电流，可能导致 VSYS 长期贴近 VBAT、充电功率级无法把 VSYS 抬到 Vsysmin 以上 |
| **P0** | reg0x90 LDO_EN0 | camera 后 **0x75**（BLDO1/2+ALDO3+OTP 残留 ALDO1） | 写：**ALDO3/4 + BLDO1/2 + DCDC5 + RTC LDO** 全使能 | 口袋机保证 SD/辅 3.3V/RTC 与摄像头轨同步就绪；产品板 **未使能 ALDO4（SD 3.3V）**、**未按口袋机方式使能 DCDC5** |
| **P1** | reg0x82/0x86 DCDC1/5 电压 | 不写（OTP） | 显式 **DCDC1=3.3V、DCDC5=3.3V** 后再 enable | 先设压再使能可避免上电毛刺；产品板实机 0x86=**0x19**（需与口袋机目标 3.3V 编码核对） |
| **P1** | reg0x95 ALDO4 | 不写 | 显式 **3.3V + enable** | 直接影响 `VDD_3V3_SD`；若 SD/外设从该轨取电，会影响 VSYS 负载分配 |
| **P1** | reg0x24 VOFF | 源码 **3000mV**（0x04） | **3300mV**（0x07） | 充电/大负载时 VSYS 更容易触及关断阈值；**建议 A/B 对齐 3300mV** 排除误关断 |
| **P2** | reg0x14 VSYSMIN_DPM | 不写（OTP **0x65→4.7V**） | 不写（同依赖 OTP） | 双方均未写，**单独不足以解释**口袋机可充、产品板不可充；仍建议良品板上 **显式写入** 作对照 |
| **P2** | reg0x50 TS_CTRL | 目标 0x10，实机常 **0x12** | 同关 TS 流程 | 低位可能残留 OTP；通常不阻充电，优先级低 |
| **低** | 0x15~0x18、0x61~0x64、0x68/0x69、0x30 | 已与口袋机一致 | 同左 | 实机 dump 与 FA 一致，**暂不作为首要怀疑** |

### 6.3 建议验证顺序（最小改动 A/B）

1. **第一步（最高收益）**：在产品板 `tuya_axp2101_init()` 末尾移植口袋机 `__board_axp2101_power_on()` 等价逻辑（disable DCDC2/3/4 → 设 DCDC1/5 电压 → enable DCDC1/5/ALDO3/4/BLDO1/2/RTC）。
2. **第二步**：将 reg0x24 临时改为 **3300mV** 与口袋机一致，观察充电电流与 STATUS1 `chg_stage`。
3. **第三步**：充电仍异常时，对 reg0x14 显式写入口袋机/原理图目标 Vsysmin，并对比 USB-only / USB+电池 两种条件下 VSYS ADC。
4. **每步必做**：`dump_status` 对比 reg0x80/0x90/0x82/0x86/0x95 与 STATUS0/1、VBAT/VBUS/VSYS ADC。

### 6.4 与旧结论的关系

- 充电参数字段对齐 → **仍成立**（无 VERIFY FAIL）。
- 「寄存器对齐仍失败 ⇒ 硬件 BUCK 坏」→ **不再成立**（口袋机配置可充）。
- 当前最可行动假设：**产品板最小驱动未执行口袋机 `power_on` 电源轨收敛，导致功率路径/负载态与可充电参考态不一致**。

---

## 7. 参考文件

| 文件 | 路径 |
| --- | --- |
| 产品板驱动 | `apps/tuyaos_demo_wukong_ai/src/drivers/app_axp2101/src/tuya_axp2101.c` |
| 板级调用 | `apps/tuyaos_demo_wukong_ai/src/boards/T5AI_BOARD/tuya_device_board.c` |
| 口袋机 API | TuyaOpen `boards/T5AI/TUYA_T5AI_POCKET/board_axp2101_api.c` |
| FA 报告 | `Docs/FA-AXP2101-20260624-001.md` |

---

## 8. 串口调试命令（v3 新增）

> **BK7258 双核说明**：调试串口 CLI 由 **CP** 解析；AXP 驱动与 `axp` 子命令在 **AP** 执行。CP 侧 `tuya_axp2101_cli_cp.c` 注册同名 `axp` 并通过 mailbox 转发到 AP（与 `info` 在 CP/AP 各注册同理）。启动日志应见 `[axp2101] CLI ready: ...`（AP 侧）。

| 命令 | 说明 |
| --- | --- |
| `axp dump` / `axp status` | 关键寄存器 + ADC + PMU 状态 |
| `axp r <reg>` | 读寄存器，十六进制，如 `axp r 80` |
| `axp w <reg> <val>` | 写寄存器，如 `axp w 90 3d` |
| `axp init` | 重新执行 `tuya_axp2101_init()` |
| `axp power` | 仅执行 `tuya_axp2101_power_on()` |

| 文件 | 职责 |
| --- | --- |
| `tuya_axp2101_cli.c` | AP：寄存器读写 / dump / init |
| `tuya_axp2101_cli_cp.c` | CP：串口入口 + 转发到 AP |

---  
**审核：** _待填写_
