# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

本项目是基于 **TuyaOS 3.13.6** 的嵌入式 IoT/AI 固件工程，目标硬件为 **T5 悟空 AI 开发板**（BK7258/T5 芯片）。适用于 AI 玩具、AI 机器人、AI 家电等场景，核心能力包括：KWS 关键词唤醒、AEC/VAD 音频前端、云端大模型对话、LVGL GUI、摄像头及涂鸦 IoT 云连接。

主应用为 `tuyaos_demo_wukong_ai`，参考示例在 `apps/tuyaos_demo_examples/` 和 `apps/tuyaos_demo_quickstart/`。

**所有 Make 命令必须在以下目录执行：**
```
T5_TuyaOS-3.13.6/software/TuyaOS/
```

## 构建命令

```bash
# 首次使用或切换板型：从 build/appconfig/ 选择目标板型并加载默认配置
make app_config_choice APP_NAME=tuyaos_demo_wukong_ai

# 通过交互式 menuconfig 微调功能开关
make app_menuconfig APP_NAME=tuyaos_demo_wukong_ai

# 根据当前 tuya_app.config 重新生成 tuya_app_config.h
make app_config APP_NAME=tuyaos_demo_wukong_ai

# 编译应用代码（日常开发主要用这个）
make app APP_NAME=tuyaos_demo_wukong_ai

# 编译 SDK 组件（耗时较长，仅在 SDK 本身变更时需要）
make os APP_NAME=tuyaos_demo_wukong_ai

# 清理应用编译产物
make clean APP_NAME=tuyaos_demo_wukong_ai

# 清理全部，包括 SDK 静态库
make os_clean APP_NAME=tuyaos_demo_wukong_ai
```

编译产物输出目录：`output/T5_tuyaos_demo_wukong_ai/`

## 配置体系

**修改功能时，仅改 C 代码是不够的**，以下关键位置必须保持同步：

| 修改目的 | 对应文件 |
|---|---|
| 控制哪些 `.c` 参与编译、include 路径、宏定义 | `apps/tuyaos_demo_wukong_ai/local.mk` |
| 应用级功能开关 | `apps/tuyaos_demo_wukong_ai/build/tuya_app.config` |
| 全局 IoT / 音频子系统开关 | `build/tuya_iot.config` |
| 各板型默认配置快照 | `apps/tuyaos_demo_wukong_ai/build/appconfig/<板型>` |
| Kconfig 定义与默认值 | `apps/tuyaos_demo_wukong_ai/build/APPconfig` |

**Windows/macOS 注意：** `build/appconfig/`（目录）与 `build/APPconfig`（文件）仅大小写不同，在大小写不敏感的文件系统上会产生冲突，请在 Linux/WSL 环境下开发。

## 支持的板型

| 板型 | 显示屏 | 摄像头 | 备注 |
|---|---|---|---|
| T5AI_BOARD | 320×480 ILI9488 | DVP | 标准开发板 |
| T5AI_BOARD_EVB | 240×240 ST7789 | 无 | 评估板，带电池 |
| T5AI_BOARD_EVB_PRO | 240×240 ST7789 | DVP | 评估板 Pro，带摄像头 |
| T5AI_BOARD_EYES | 128×128 ST7735S | DVP | 眼睛表情板 |
| T5AI_BOARD_ROBOT | 320×172 ST7789P3 | UVC | 机器狗，含舵机/手势模块 |
| T5AI_BOARD_DESKTOP | 320×240 ST7789V2 | DVP | 桌面设备，翻译/录音/检测/IMU 默认开启 |
| LE270AI_BOARD | 无 | 无 | UART 外接语音芯片方案 |
| WUKONG_BOARD_UBUNTU | 无 | 无 | PC 端模拟调试 |

> 说明：代码中仍保留 `T2AI_BOARD` 配置（见 `build/APPconfig` 与 `local.mk`），如需启用请以对应板级目录实现为准。

## 软件架构

### 分层结构

```
L7  产品业务逻辑         → 在 src/ 新建模块，或扩展 mode/ / skills/
L6  AI 编排层            → src/wukong/wukong_ai_agent.c、src/wukong/mcp/、src/mode/
L5  多媒体管线           → src/wukong/audio/、src/tuya_ai_toy_camera.c、src/wukong/video/
L4  设备抽象（TAL/TDD）  → src/drivers/**、tal_* API
L3  板级 BSP             → src/boards/<板型>/tuya_device_board.c
L2  Tuya IoT 设备模型    → src/tuya_app_main.c（仅注册回调，不改协议栈内部）
L1  RTOS / TuyaOS 内核   → vendor/（禁止修改）
```

### 关键源文件

| 文件 | 职责 |
|---|---|
| `src/tuya_app_main.c` | 应用总入口：IoT 初始化、网络、授权、板级与 AI toy 启动 |
| `src/tuya_ai_toy.c` | AI 总控：事件订阅、模式调度、音频链路、idle/lowpower 定时器 |
| `src/tuya_ai_toy_key.c` | 按键处理、上电复位配网 |
| `src/tuya_ai_toy_camera.c` | 摄像头初始化、帧回调、LCD 桥接、P2P 视频推流 |
| `src/wukong/wukong_ai_agent.c` | 云端 AI 会话、多媒体上行、对话管理 |
| `src/mode/` | 对话模式状态机（长按/单次/唤醒/自由/P2P/翻译…） |
| `src/wukong/audio/` | 音频管线：AEC、VAD、KWS、播放器 |
| `src/miscs/gui/` | LVGL 封装、页面路由、资源加载 |
| `src/boards/<板型>/` | 各板型 BSP 与 UI 页面 |
| `src/drivers/` | LCD、摄像头、按键、LED、IMU、触摸屏驱动 |

### 运行时事件流

主循环在 `__ai_toy_task()` 中每 20 ms 调用一次 `wukong_ai_mode_dispatch(AI_MODE_OP_TASK, ...)`，所有其他事件也汇入同一调度入口：

- KWS 唤醒 → `EVENT_WUKONG_KWS_WAKEUP` → `AI_MODE_OP_WAKEUP`
- VAD 变化 → `EVENT_AUDIO_VAD` → `AI_MODE_OP_VAD`
- 云端 AI 下行 → `__on_ai_toy_wukong_ai_event` → `AI_MODE_OP_EVENT`
- 网络就绪 → `EVENT_AI_CLIENT_RUN` → `AI_MODE_OP_CLIENT`
- 按键 → `AI_MODE_OP_KEY`

音频链路：`wukong_audio_input` → `__on_ai_toy_mic_data` → `wukong_audio_frontend_*` → `wukong_kws_feed_with_vad` → KWS 事件 或 上行云端。

## 扩展开发规范

**新增业务逻辑的位置：** 对话模式扩展在 `src/mode/`，AI 技能在 `src/wukong/skills/`，MCP 工具在 `src/wukong/mcp/tools/`。新增 `.c` 文件后必须在 `local.mk` 中注册。

**禁止修改：** TuyaOS 内核（`vendor/`）、TCP/IP 栈内部、`tuya_iot_*` 协议栈内部、DP/MQTT 封包层。这些属于闭源或 SDK 管理范围，擅自修改会导致 OTA 升级失败和认证不合规。

**线程安全：** 严禁在麦克风数据回调（`__on_ai_toy_mic_data`）中执行耗时操作。重型推理任务须使用 `tal_workq` 或专用线程，帧数据通过无锁环形队列传递。

## 参考文档

- `apps/tuyaos_demo_wukong_ai/README_CN.md` — 模块索引与入口说明
- `apps/tuyaos_demo_wukong_ai/build/README_CN.md` — 配置指南
- `apps/tuyaos_demo_wukong_ai/docs/QUICKSTART_CN.md` — 快速开始
- `src/wukong/README_CN.md` — Agent / 技能 / MCP 说明
- `src/wukong/audio/README_CN.md` — 音频管线与 KWS
- `src/boards/README_CN.md` — 板级移植指南
- `Docs/T5-Wukong-AI-架构与开发指南.md` — 架构深度解析
- `Docs/T5-Wukong-AI-Board类型说明.md` — 板型详细对照表
