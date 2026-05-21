# 六六 AI 陪伴机器人 — 软件功能与代码能力对照

> **版本**：v1.1（合并修订）  
> **日期**：2026-05-19  
> **适用固件**：`apps/tuyaos_jiajia`（佳佳/六六产品，基于 TuyaOS 3.13.6 Wukong AI）  
> **默认板型**：`T5AI_BOARD`（320×480 + DVP 摄像头）  
> **来源文档**：  
> - `Docs/六六AI陪伴机器人 — 软件功能详细开发文档.docx`（v1.0 需求初稿）  
> - `Docs/智能纪要：机器人情感交流功能规划 2026年5月19日.docx`（微信情感纽带设想）  
> - 项目组补充：**T5 负责 AI 聊天 + P2P 视频；ESP32 仅做视频跌倒检测，经 GPIO + UART 通知 T5**

---

## 一、硬件与软件分工（项目组确认）

```text
┌─────────────────────────────────────────────────────────────────┐
│  ESP32（协处理器）                                                │
│  · 独立运行跌倒检测模型（视频侧）                                  │
│  · 判定「可能跌倒」后：GPIO（可选快速中断）+ UART JSON 通知 T5      │
└────────────────────────────┬────────────────────────────────────┘
                             │ UART（如 115200）+ GPIO
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  T5 / BK7258（主控，tuyaos_jiajia）                               │
│  · AI 闲聊 / 唤醒 / MCP / TTS                                     │
│  · P2P 实时视频（App 拉流）                                       │
│  · 收到 ESP32 告警 → DVP 抓拍 JPEG → 上传云端二次确认是否真跌倒    │
│  · 确认后：语音询问 / UI / APP·微信推送（产品定义）                  │
└─────────────────────────────────────────────────────────────────┘
```

**与 SDK 内置「侦测模式」的区别**（勿混淆）：

| 项目 | 本项目（ESP32 + T5） | SDK `wukong_ai_mode_detection.c` |
|------|----------------------|----------------------------------|
| 检测算力 | ESP32 本地模型 | T5 摄像头 YUV + `tuya_ipc_motion` 动检 |
| 触发 | UART/GPIO 协议 | 画面变动自动抓拍 |
| 云端 | **确认是否跌倒** 后再告警 | 默认文案「帮我检测下这张图片」 |
| 工程现状 | **T5 侧协议与业务未实现** | 代码有，但 T5AI 默认未编入，且缺 `md_jpeg` 板级接口 |

---

## 二、能力成熟度图例

| 等级 | 标记 | 含义 |
|------|------|------|
| **A — 现成可用** | 🟢 | 仓库已有实现，当前或稍作配置即可用 |
| **B — 有参考需改** | 🟡 | 有相近模块/官方示例，需移植、改协议或拼流程 |
| **C — 从零开发** | 🔴 | 应用目录内无业务实现，需新建模块并注册 `local.mk` |

---

## 三、功能需求总表（含代码能力分析）

> 当前配置基准：`apps/tuyaos_jiajia/build/tuya_app.config`（`T5AI_BOARD`，`ENABLE_AI_MODE_P2P=y`，`ENABLE_TOOLKITS_TM=n`）。

| ID | 功能 | 优先级 | 能力 | 说明与主要代码/参考 |
|----|------|--------|------|---------------------|
| **FR-001** | 首次上电配网（二维码 + 智能生活） | P0 | 🟡 B | IoT 配网：`tuya_app_main.c` → `tuya_iot_wf_soc_dev_init`；UI 上 T5AI desktop 仅 `Welcome` 短屏（`ui_home.c`），完整二维码流参考 **DESKTOP** `desk_startup.c` |
| **FR-002** | WiFi 写入 KV 持久化 | P0 | 🟢 A | 涂鸦 SDK 默认行为，无需自研 |
| **FR-003** | 基础聊天（天气/时间/美食/百科） | P0 | 🟢 A | `wukong_ai_agent` + `wukong_ai_mode_*`；内容靠云端 LLM，无单独 `query_weather` MCP |
| **FR-004** | 语音唤醒 | P0 | 🟢 A | `wukong_kws` + `ifly_kws.c`；词资源为 **nihaotuya/heytuya** 等，文档写「涂鸦」需与产品话术对齐 |
| **FR-005** | 多轮对话 | P0 | 🟢 A | `ENABLE_AI_MODE_FREE/WAKEUP` 等；**无操作退出**：固件 `TOY_IDLE_TIMEOUT=30s`（`tuya_ai_toy.c`），非文档暂定 10s |
| **FR-006** | MCP 闹钟/提醒 | P0 | 🟡 B | 实现：`mcp_tool_tm.c`（`device_schedule_set`、`device_countdown_timer_set` 等）；**当前配置 TM 关闭**，需 `ENABLE_TOOLKITS_TM=y` + `make app_config` |
| **FR-007** | UI 状态随对话变化 | P0 | 🟡 B | 显示：`TY_DISPLAY_TP_CHAT_STAT` / `TY_DISPLAY_TP_EMOJI`（`tuya_ai_display.h`）；字库有「待命/聆听/思考/说话」（`puhui_robot.c`）。**无**文档级耳/眼/嘴分屏 UI |
| **FR-008** | 表情 + 舵机动作 | P0 | 🔴 C / N/A | **T5AI_BOARD 无舵机**；`servo_ctrl` 仅 `T5AI_BOARD_ROBOT`。表情 GIF 可参考 DESKTOP `desk_home.c`，需产品定制 |
| **FR-009** | 跌倒检测与告警（ESP32→T5→云确认） | P0 | 🟡 B + 🔴 | 见 **第六章**；T5 抓拍/上行有参考，UART/GPIO/确认态/推送为 **新开发** |
| **FR-010** | 主动聊天（定时播报） | P1 | 🟡 B | 定时底座：`wukong_tm` + `wukong_cron`；**无**「有人再播」、早 7 点播报业务 |
| **FR-011** | 定时提醒/早间新闻场景 | P1 | 🟡 B | 同 FR-006/010；需 TM + 云端主动会话方案 |
| **FR-012** | 小游戏（成语接龙等） | P2 | 🔴 C | 无 `play_game` MCP；纯云端上下文可部分模拟，无专用模式 |
| **FR-013** | APP 远程控制 / 设备在线 | P0 | 🟢 A | `tuya_iot_*`、DP 回调 `tuya_ai_toy_dp_process` |
| **FR-014** | OTA | P1 | 🟢 A | SDK OTA + `tuya_ai_toy` 订阅 `EVENT_OTA_*` |
| **FR-015** | P2P 视频通话 | P0 | 🟢 A | `ENABLE_AI_MODE_P2P` + `tuya_p2p_app.c` + `tuya_ai_toy_camera.c`；**App 拉流**，按键不控视频 |
| **FR-016** | 微信情感交流（子女↔老人） | P1（纪要） | 🔴 C | 纪要设想；SDK 有 `mcp_tool_imm`（含 `IMM_PLATFORM_WECHAT`）但 **未开启**；端到端方案未定 |

---

## 四、开机绑定与用户交互（需求文档 §2–3）

### 4.1 开机绑定

| 需求要点 | 能力 | 分析 |
|----------|------|------|
| 扫码配网、KV 存 WiFi | 🟢 A | 标准 SOC WiFi 设备流程 |
| 首屏二维码 + 文案 | 🟡 B | 资源 `icon_tuya_app_qr` 已有；T5AI 启动页未接完整配网 UI |
| 绑定后 IDLE + P2P/聊天 | 🟡 B | 聊天就绪依赖 `EVENT_AI_CLIENT_RUN`；P2P 已编开关，需 App 侧发起 |

### 4.2 基础聊天与唤醒

| 需求要点 | 能力 | 分析 |
|----------|------|------|
| 云端 ASR/LLM/TTS | 🟢 A | `wukong_ai_agent.c` |
| 唤醒词「涂鸦」 | 🟡 B | 资源为英文标识 **nihaotuya**；定制「小六小六」需换 KWS 资源或涂鸦流程 |
| 多轮 session | 🟢 A | 云端 session；子模式见 `AI_CHAT_SUB_MODE_E` |
| 10s 无操作退出 | 🟡 B | 需产品确认：改 `TOY_IDLE_TIMEOUT` 或 VAD/云端超时策略 |

**推荐默认子模式**：长按 `hold`（`TUYA_AI_CHAT_DEFAULT_MODE=0`），与会议「老人友好」一致；唤醒/自由模式可配置开启。

---

## 五、MCP 工具（需求文档 §4）

### 5.1 流程（文档描述）

用户语音 → 云端判工具 → 参数下发 → 设备执行 → TTS 反馈 — **与 `mcp_server.c` / `wukong_ai_mcp.c` 一致** 🟢 A。

### 5.2 文档工具名 vs 工程实际

| 文档中的名称 | 工程实际（TM 开启时） | 能力 |
|--------------|----------------------|------|
| set_alarm | `device_schedule_set` / alarm 相关 op | 🟡 B |
| set_reminder | `device_schedule_set`（带 `message`） | 🟡 B |
| query_weather | 无专用 MCP | 🔴 C（靠 LLM，非设备工具） |
| query_news / query_history | 无 | 🔴 C |
| play_game | 无 | 🔴 C |

### 5.3 落地检查清单

1. `make app_menuconfig` → 打开 **`ENABLE_TOOLKITS_TM`**  
2. `make app_config && make app`  
3. 串口确认 MCP 注册：`device_schedule_set`、`device_countdown_timer_set` 等  
4. 提醒语 TTS：必须用 **schedule + message**，倒计时多为提示音（见 `wukong/tm/README_*.md`）

---

## 六、跌倒检测与告警（更新架构 · 重点）

### 6.1 目标流程（产品 + 项目组确认）

```text
ESP32 本地判定「可能跌倒」
    │  GPIO（可选：边沿中断） + UART JSON，例：{"cmd":"fall_detect",...}
    ▼
T5 业务线程（禁止在 GPIO/UART 回调里阻塞）
    │  1. 进入 FALL_PENDING / ALARM 产品状态（新建）
    │  2. DVP 抓拍 JPEG（勿与 P2P 推流长期抢资源，需互斥策略）
    │  3. wukong_ai_agent_set_scode(产品确认用 scode)
    │  4. wukong_ai_agent_send_image + send_text（确认提示语）
    ▼
云端二次判别「是否真跌倒」
    │  否 → 恢复 IDLE，记录日志
    │  是 → TTS「您还好吗…」+ UI 关心页 + 启动 10s 等待用户回复
    ▼
超时无回复 / 用户确认危险
    → APP 推送（DP）+ 微信（若平台接通）+ 可选紧急联系人（产品/云配置）
```

### 6.2 分模块能力分析

| 模块 | 能力 | 代码/参考 | 工作量判断 |
|------|------|-----------|------------|
| ESP32 跌倒模型 | （协处理器固件） | **不在本仓库** | 硬件/算法团队 |
| UART 收 JSON | 🟡 B | `tal_uart`：`tuya_app_main.c`（产测 UART0）、`miscs/motion/tuya_motion_ctrl.c`（UART2 收发帧）；示例 `driver_gpio` + `system_thread` | 新建 `fall_detect_uart.c`：独立线程 + 环形缓冲 + `ty_cJSON` 解析 |
| GPIO 中断 | 🟡 B | `apps/tuyaos_demo_examples/.../driver_gpio/example_driver_gpio.c`（`tkl_gpio_irq_init`） | 选定空闲 GPIO，与 ESP32 协议对齐 |
| JPEG 抓拍 | 🟡 B | `tuya_device_camera_get_jpeg_frame()`（`T5AI_BOARD/tuya_device_camera.c`）；`mcp_tool_camera.c`；侦测模式 `__md_capture_jpeg`（DESKTOP 板） | T5AI 可直接调板级 JPEG；需处理与 **P2P 摄像头占用** 互斥 |
| 图片上传 + 云端确认 | 🟡 B | `wukong_ai_agent_send_image()` + `tuya_ai_input_start/stop`；参考 `wukong_ai_mode_detection.c` 上传段 | 改 **prompt/scode/解析云端返回**，非动检逻辑 |
| 询问语音 + 10s 倒计时 | 🟡 B | TTS：`WUKONG_AI_EVENT_*`；定时：`tal_sw_timer`（`tuya_ai_toy.c` idle 定时器模式） | 新产品状态机，建议放 `src/` 新目录或 `mode/` 扩展 |
| UI 关心/告警页 | 🟡 B | `tuya_ai_display_msg`；DESKTOP `desk_func_detection` 仅 **消息列表**，非跌倒 UI | 在 `T5AI_BOARD/ui/desktop/` 增页或全屏 overlay |
| APP 推送 | 🟡 B | `tuya_ai_toy_dp_process` / IoT DP；具体 DP ID 需云平台定义 | 与产品经理定 DP |
| 微信推送 | 🔴 C | `ENABLE_TOOLKITS_IMM` + 微信生态对接；纪要亦称「实现未定」 | 云侧 + 商务能力为主 |
| SDK 动检模式替代方案 | 🟡 B | `wukong_ai_mode_detection.c` | **不建议**代替 ESP32 方案；可作为「无 ESP32 时」备选，且 T5AI 缺 `tuya_device_camera_md_*` |

### 6.3 与需求文档原 §6 的差异

| 原稿描述 | 修订后 |
|----------|--------|
| ESP32 UART `fall_detect` | ✅ 与项目组一致 |
| T5 立即 ALARM + 先问用户再推送 | ✅ 保留；**中间增加云端看图确认** |
| 微信/AP P 推送 | 仍为 🟡/🔴，依赖云与 IMM |

---

## 七、UI 状态机与表情（需求文档 §5）

| UI/状态（文档） | 固件近似 | 能力 | 备注 |
|-----------------|----------|------|------|
| IDLE | `AI_CHAT_IDLE` + `TY_DISPLAY_TP_STAT_IDLE` | 🟡 B | desktop 首页偏时钟，非「呼吸灯表情」 |
| LISTENING | `AI_CHAT_LISTEN` | 🟡 B | 需接 `TY_DISPLAY_TP_STAT_LISTEN` 到 LVGL |
| THINKING | `AI_CHAT_THINK` | 🟡 B | 上传/思考阶段 |
| SPEAKING | `AI_CHAT_SPEAK` | 🟡 B | 流式字幕已有 `TY_DISPLAY_TP_AI_CHAT_*` |
| 跌倒询问/告警 | 无 | 🔴 C | 新建 |
| 舵机 | 无（本板） | N/A | 若硬件无舵机，文档 FR-008 标 **不适用** |

**线程安全**：UI 更新通过 `tuya_ai_display_msg` 到 GUI 线程，**禁止**在 UART/GPIO 回调中直接 LVGL 操作。

---

## 八、主动聊天与定时场景（需求文档 §7、§9 FR-010/011）

| 需求 | 能力 | 分析 |
|------|------|------|
| 每日 7:00 查天气/新闻并播报 | 🟡 B | `wukong_cron` + TM；**主动发起会话**需 Agent API 或云端下发 TTS |
| 有人（PIR/摄像头）才播 | 🔴 C | 无 PIR 驱动；摄像头「有人」需自研或云端，纪要亦未定 |
| 暴雨等优先播报 | 🔴 C | 规则引擎 + 天气数据源，无现成模块 |

---

## 九、小游戏（需求文档 §8、FR-012）

| 需求 | 能力 | 分析 |
|------|------|------|
| 成语接龙 / 猜谜等 | 🔴 C | 无 `play_game`、无游戏状态机；可仅用 **云端多轮对话** 演示，非设备侧能力 |
| 游戏 UI | 🔴 C | 无 `UI_010` 实现 |

---

## 十、智能纪要：微信情感交流（2026-05-19）

> 来源：`智能纪要：机器人情感交流功能规划 2026年5月19日.docx`  
> 会议结论：**有价值，实现路径未明**，先留存设想。

### 10.1 纪要需求摘要

| 方向 | 描述 |
|------|------|
| 子女 → 老人 | 子女经 **微信入口** 问机器人「老人身体状况如何」；机器人经大模型与老人交流，将回复 **推回微信** |
| 老人 → 子女 | 老人问「儿子是否回家吃饭」等，机器人向子女侧询问后再 **转述** |
| 产品价值 | 「互相不打扰，但把关心问到」 |

### 10.2 代码能力分析

| 能力点 | 等级 | 说明 |
|--------|------|------|
| 设备侧与大模型对话 | 🟢 A | 已有 Agent |
| 微信消息收发 | 🔴 C | `mcp_tool_imm.h` 定义 `IMM_PLATFORM_WECHAT`，**未编入**（`ENABLE_TOOLKITS_IMM=n`）；无微信 OpenAPI 业务 |
| 子女账号绑定 / 家庭关系 | 🔴 C | 需云产品 + 微信生态，不在固件仓库 |
| 「代问老人」编排 | 🟡 B | 可用云端 Agent 工作流；设备仅作执行端（TTS/显示） |
| 纪要状态「待研究」 | ✅ 准确 | 与代码现状一致 |

### 10.3 建议路线（供排期）

1. **短期**：App / 涂鸦云消息能力代替微信，验证「代问代传」话术。  
2. **中期**：云平台接通微信后再开 `ENABLE_TOOLKITS_IMM`，评估 `mcp_tool_imm.c`。  
3. **固件**：仅需保证联网、会话、TTS 稳定；**不必**在 T5 上实现微信协议栈。

---

## 十一、技术不确定性（需求文档 §10）— 对照结论

| 不确定项 | 文档优先级 | 当前结论 |
|----------|------------|----------|
| 方言 ASR | 高 | 依赖涂鸦云端，固件无开关 |
| 自定义唤醒「小六小六」 | 高 | 🟡 B，需 KWS 资源与授权 |
| MCP 完整列表 | 高 | 以 `mcp_tool_*.c` + 云平台文档为准；与文档假名不同 |
| 跌倒阈值与交互 | 高 | ESP32 侧调参；T5 侧新建确认态 |
| 有人检测（PIR/摄像头） | 高 | 🔴 C |
| TTS 与嘴型同步 | 中 | 🔴 C |
| 微信推送格式 | 高 | 🔴 C，云侧为主 |

---

## 十二、推荐实施顺序（结合现网能力）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **P0-a** | 配网/聊天/P2P 联调稳定；打开 `ENABLE_TOOLKITS_TM` 验证提醒 | 现网 🟢 |
| **P0-b** | **ESP32↔T5** 协议 + GPIO/UART 驱动 + 抓拍上传云确认 + DP 告警 | 🟡+🔴 |
| **P0-c** | 跌倒相关 UI + 询问 TTS + 10s 超时逻辑 | 🟡 |
| **P1** | UI 状态与表情增强；主动播报（cron） | 🟡 |
| **P1** | 微信情感交流（云方案优先） | 🔴 |
| **P2** | 小游戏 | 🔴 |

---

## 十三、关键代码索引（`tuyaos_jiajia`）

| 主题 | 路径 |
|------|------|
| 应用入口 / IoT | `src/tuya_app_main.c` |
| AI 总控 / 定时器 | `src/tuya_ai_toy.c` |
| 模式调度 | `src/mode/wukong_ai_mode.c`、`wukong_ai_mode.h` |
| P2P | `src/mode/wukong_ai_mode_p2p.c`、`src/miscs/p2p/tuya_p2p_app.c` |
| 摄像头 JPEG | `src/boards/T5AI_BOARD/tuya_device_camera.c`、`src/tuya_ai_toy_camera.c` |
| Agent 上图 | `src/wukong/wukong_ai_agent.c` |
| MCP 时间/提醒 | `src/wukong/mcp/tools/mcp_tool_tm.c` |
| MCP 微信（未开） | `src/wukong/mcp/tools/mcp_tool_imm.h` |
| 显示消息 | `src/miscs/gui/display/tuya_ai_display.h` |
| T5AI UI | `src/boards/T5AI_BOARD/ui/desktop/` |
| UART 参考（桌面板运动） | `src/miscs/motion/tuya_motion_ctrl.c` |
| GPIO 中断示例 | `apps/tuyaos_demo_examples/src/examples/driver_gpio/` |
| UART 示例 | `apps/tuyaos_demo_examples/src/examples/service_mf_test/` |
| 配置 | `build/tuya_app.config`、`build/APPconfig`、`local.mk` |
| 架构说明 | `Docs/T5-Wukong-AI-架构与开发指南.md` |

---

## 十四、文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-19 | 源 Word：功能需求初稿 |
| v1.1 | 2026-05-19 | 合并智能纪要；补充 T5+ESP32 跌倒架构；增加逐项代码能力等级（A/B/C） |

---

**说明**：本文档用于 **产品、硬件、固件、云端** 对齐范围与工作量，不作为「功能已全部实现」的验收依据。验收请以具体 FR 的测试用例 + 配置快照（`tuya_app.config` / `tuya_app_config.h`）为准。
