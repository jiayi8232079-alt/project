# TuyaOS Wukong AI：Board type（板型）选项说明

> **适用范围**：`T5_TuyaOS-3.13.6/software/TuyaOS/apps/tuyaos_demo_wukong_ai`  
> **菜单路径**：`make app_menuconfig APP_NAME=tuyaos_demo_wukong_ai` → **Board type**

本文说明 menuconfig 里每个 **Board type** 选项会牵动哪些配置，以及如何对照源码与文档自查。

---

## 一、Board type 在工程里代表什么？

板型不是单独改一个字符串，而是通过 Kconfig 的 **互斥选项（choice）** 选定目标硬件，从而：

1. **打开一组默认功能开关**（`select ENABLE_AI_MODE_*`、`TUYA_MODULE_T5`、`TUYA_DMA2D_SHARE` 等）  
2. **决定参与编译的板级源码目录**（`src/boards/<板型>/`）以及额外模块（舵机、IMU、motion 等）  
3. **影响显示与 UI 分支**（不同分辨率 / RGB vs SPI / 不同 LCD 驱动符号）

关键文件：

| 作用 | 路径 |
|------|------|
| 板型与默认 `select` | `apps/tuyaos_demo_wukong_ai/build/APPconfig` |
| 按板型追加源码与头文件 | `apps/tuyaos_demo_wukong_ai/local.mk` |
| LCD 设备分支示例 | `apps/tuyaos_demo_wukong_ai/src/drivers/app_tuya_display/tdd_lcd_driver/src/lcd_common.h` |
| 选型表与流程说明 | `apps/tuyaos_demo_wukong_ai/build/README_CN.md` |

---

## 二、`APPconfig` 里各板型默认勾选了哪些能力？

以下为 **choice「Board type」** 中与编译开关相关的摘要（完整请以源码为准）。

| 板型 | `TUYA_MODULE_T5` | `TUYA_DMA2D_SHARE` | 默认 AI 模式相关（节选） |
|------|------------------|------------------|---------------------------|
| **T5AI_BOARD** | ✓ | ✓ | HOLD / ONESHOT / WAKEUP / FREE / **PICTURE** |
| **T5AI_BOARD_EYES** | ✓ | — | HOLD / ONESHOT / WAKEUP / FREE（无 PICTURE、无 DMA2D_SHARE） |
| **T5AI_BOARD_EVB** | ✓ | — | HOLD / ONESHOT / WAKEUP / FREE |
| **T5AI_BOARD_EVB_PRO** | ✓ | — | HOLD / ONESHOT / WAKEUP / FREE |
| **T5AI_BOARD_ROBOT** | ✓ | — | HOLD / ONESHOT / WAKEUP / FREE |
| **T5AI_BOARD_DESKTOP** | ✓ | ✓ | 上述基础上另有 **TRANSLATE / RECORD / DETECTION / PICTURE** |
| **T2AI_BOARD** | — | — | HOLD / ONESHOT / WAKEUP / FREE |
| **LE270AI_BOARD** | — | — | HOLD / ONESHOT / WAKEUP / FREE |

说明：**P2P 等能力**通常还依赖在 menuconfig 中单独开启摄像头等选项，参见 `build/README_CN.md`。

---

## 三、`local.mk`：选了板型会多编哪些目录？

原理：`CONFIG_<板型>=y` 时 inclusion：

- **`T5AI_BOARD`**：`src/boards/T5AI_BOARD/` + UI 相关路径，`tuya_device_board.c` / 可选 `tuya_device_camera.c`
- **`T5AI_BOARD_EVB` / `EVB_PRO` / `EYES` / `ROBOT` / `DESKTOP`**：各自对应 `src/boards/<板型>/` 下同名字 `.c`
- **`T5AI_BOARD_ROBOT`**：额外 `miscs/servo_ctrl`、`miscs/gesture`
- **`T5AI_BOARD_DESKTOP`**：额外 `miscs/motion`、`drivers/app_tuya_imu` 下源码
- **`T2AI_BOARD`**：`src/boards/T2AI_BOARD/`
- **`WUKONG_BOARD_UBUNTU`（UBUNTU）**：`src/boards/Ubuntu/`（若需在 PC 上模拟）

详细列表见：`apps/tuyaos_demo_wukong_ai/local.mk` 中各 `ifeq ($(CONFIG_...) , y)` 块。

---

## 四、屏 / 驱动层面的典型差异（`lcd_common.h`）

在同一套「多类型 LCD」前提下，板型宏会走到不同的屏设备符号分支，例如：

- **T5AI_BOARD**：与 RGB / ILI9488 等设备路径相关（与模块宏组合使用）
- **T5AI_BOARD_EVB / DESKTOP / EVB_PRO**：SPI ST7789 一类路径
- **T5AI_BOARD_ROBOT**：SPI ST7789P3 一类路径
- **T5AI_BOARD_EYES**：SPI ST7735S 一类路径

具体条件编译见：`src/drivers/app_tuya_display/tdd_lcd_driver/src/lcd_common.h`（及对应的 `.c`）。

---

## 五、官方文档中的「硬件 + 场景」对照表（摘录）

下列内容与 `build/README_CN.md` 中板型说明一致，便于与实物对齐：

| 板型 | 模组 | 显示屏 | 摄像头 | 电池 | 使用场景 |
|------|------|--------|--------|------|----------|
| **T5AI_BOARD** | T5 | 320×480 ILI9488 | DVP | ❌ | 标准开发 |
| **T5AI_BOARD_EVB** | T5 | 240×240 ST7789 | ❌ | ✅ | 白盒评估板 |
| **T5AI_BOARD_EVB_PRO** | T5 | 240×240 ST7789 | DVP | ✅ | 评估板 Pro（支持摄像头） |
| **T5AI_BOARD_EYES** | T5 | 128×128 ST7735S | DVP | ❌ | 眼睛表情板 |
| **T5AI_BOARD_ROBOT** | T5 | 320×172 ST7789P3 | UVC | ✅ | 机器狗 |
| **T5AI_BOARD_DESKTOP** | T5 | 320×240 ST7789V2 | DVP | ✅ | 桌面设备 |
| **LE270AI_BOARD** | — | — | ❌ | ❌ | UART 外接语音芯片 |

**T2AI_BOARD**：文档中以独立板型出现（源码在 `src/boards/T2AI_BOARD/`）；选型时请以自己 PCB 与官方 BOM 为准。

---

## 六、menuconfig 选项一览（含义小结）

| 选项 | 侧重说明 |
|------|-----------|
| **T5AI_BOARD** | 主流 T5 开发板；含「画图」等能力；DMA2D 共享；大屏桌面/微信 UI 策略见 `APPconfig` |
| **T5AI_BOARD_EYES** | 小屏表情机；无 PICTURE / 无 DMA2D_SHARE（相对默认 T5AI_BOARD） |
| **T5AI_BOARD_EVB** | 小屏 EVB；文档：**无摄像头** |
| **T5AI_BOARD_EVB_PRO** | EVB 增强：**DVP 摄像头** |
| **T5AI_BOARD_ROBOT** | 机器狗：**UVC**；电池；工程内含舵机/手势相关编译单元 |
| **T5AI_BOARD_DESKTOP** | 桌面形态：**翻译 / 录音 / 检测 / 画图**等默认更全；**IMU + motion** |
| **T2AI_BOARD** | **未选用 `TUYA_MODULE_T5`**；走 T2 板级目录 |
| **LE270AI_BOARD** | **UART 外接语音芯片**方案（音频 Kconfig 中大量 LE270 默认值） |

若做「养老机器人」类产品：**硬件接近机器狗**可优先考虑 **ROBOT**；需要 **IMU / 姿态类扩展**时多看 **DESKTOP** 的差异，并与实际 PCB 核对屏与摄像头接口。

---

## 七、推荐操作方式（避免配置不一致）

官方说明：**切换板型优先使用 `app_config_choice`**，从 `build/appconfig/` 加载对应默认配置；仅长期在 menuconfig 里改 Board type，可能与已有 `.config` 不同步。

```bash
make app_config_choice APP_NAME=tuyaos_demo_wukong_ai   # 选板型、载入预设
make app_menuconfig APP_NAME=tuyaos_demo_wukong_ai      # 再微调开关
make app_config APP_NAME=tuyaos_demo_wukong_ai          # 生成头文件等
```

更细的菜单项说明仍以 **`apps/tuyaos_demo_wukong_ai/build/README_CN.md`** 与 **`src/boards/README_CN.md`**（若有）为准。

---

## 八、源码索引（自查用）

| 内容 | 路径 |
|------|------|
| Board choice 与 `select` | `apps/tuyaos_demo_wukong_ai/build/APPconfig`（Layer 1: Board Selection） |
| 编译进工程的 board 源文件 | `apps/tuyaos_demo_wukong_ai/local.mk` |
| 各板 `board_init` / 摄像头等 | `apps/tuyaos_demo_wukong_ai/src/boards/<BOARD>/` |
| LCD 类型分支 | `.../tdd_lcd_driver/src/lcd_common.h`、`lcd_common.c` |
| UI 分辨率与板型分支示例 | `.../miscs/gui/display/tuya_ai_display.c` |

---

*文档由仓库当前内容与 `build/README_CN.md` 整理，若涂鸦 SDK 升级请以当期 `APPconfig` / `README_CN.md` 为准。*
