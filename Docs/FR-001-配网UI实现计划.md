# FR-001 配网 UI 实现计划（修订版 · 无二维码）

> **版本**：与 Cursor 计划同步（2026-05）  
> **适用**：`apps/tuyaos_jiajia` + `T5AI_BOARD` + `ENABLE_T5AI_BOARD_UI_DESKTOP`  
> **状态**：待实现

---

## 一、需求摘要（已确认）

| 项 | 结论 |
|----|------|
| 扫码绑设备 | **取消**，屏上不展示配网 QR、`active_shorturl` 不参与首配网 |
| 配网方式 | **保持现有 SDK**：`WF_START_AP_FIRST` + BLE（`TUYA_BLE_ABILITY_NETCFG`），智能生活 App 完成 WiFi/激活 |
| UI | **随配网状态变化**；未激活时**不得** Welcome 1s 后直接进 Home |
| 完成条件 | **三门禁全满足** 后才「配网成功」→ 约 4s → Home；否则**一直显示配网中** |
| 蜂窝 | **无**；应用侧不注册 `active_shorturl`，`CELLULAR_DONGLE` 保持关闭 |
| 参考 | DESKTOP `desk_startup` / `desk_event_handle`；wechat 的 `TY_DISPLAY_TP_STAT_NETCFG` |

---

## 二、现有代码已具备（无需改 SDK）

```
tuya_app_main.c
  tuya_iot_wf_soc_dev_init(WF_START_AP_FIRST)
  tuya_ble_set_startup_attr(TUYA_BLE_ABILITY_NETCFG)

tuya_ai_toy.c
  STAT_UNPROVISION → TY_DISPLAY_TP_STAT_NETCFG + LED 闪
  STAT_CLOUD_CONN  → TY_DISPLAY_TP_STAT_NET + LED 亮
  EVENT_AI_CLIENT_RUN → wukong_ai_mode_dispatch(AI_MODE_OP_CLIENT)

配置：CONFIG_ENABLE_BT_SERVICE=y，CONFIG_ENABLE_CELLULAR_DONGLE=n
```

**缺口**：`ui_home.c` 无条件进 Home；`desktop_ui_msg_handler` 未处理 `TY_DISPLAY_TP_STAT_NETCFG`。

---

## 三、目标 UI 状态机

```
上电 → Welcome(1s)
  ├─ 已激活且已就绪 → Home
  └─ 未激活 → 引导屏（智能生活 + 蓝牙）
        → 配网中（可长时间停留）
        → [三门禁全满足] → 配网成功(约4s) → Home
```

### 屏文案（建议）

| 屏 | 内容 |
|----|------|
| 引导 | 打开「智能生活」→ 添加设备 → 打开蓝牙；可选：热点 `SmartLife-xxxx`（`tuya_iot_get_dev_ap_if`） |
| 配网中 | 「配网中，请稍候…」 |
| 成功 | 「配网成功」→ 4s → Home |

---

## 四、「完全就绪」门禁（核心）

**一直停留在「配网中」**，直到以下 **同时** 成立：

| # | 条件 | 代码 |
|---|------|------|
| 1 | 已激活绑定 | `get_gw_active() >= ACTIVATED` |
| 2 | WiFi 已连云 | `get_wf_gw_nw_status() >= STAT_CLOUD_CONN` |
| 3 | 云端 AI 就绪 | 已收到 `EVENT_AI_CLIENT_RUN` |

- 封装：`ui_provision_is_device_ready()`
- 多入口调用：`EVENT_AI_CLIENT_RUN`、`TY_DISPLAY_TP_STAT_NET`（`net_stat==1`）、`try_finish_provision()`
- **禁止**仅 WiFi/MQTT 连上就进 Home
- **P1 可选**：再等 default session 创建成功（`ENABLE_DEFAULT_SESSION`）
- **时序补偿**：`ui_provision_init()` 末尾若已就绪则直接成功/Home（参考 `tuya_p2p_app.c`）

---

## 五、实现任务清单

| # | 任务 | 文件 |
|---|------|------|
| 1 | 新建 `ui_provision.c/h`、`ui_provision_event.c` | `src/boards/T5AI_BOARD/ui/desktop/` |
| 2 | Welcome 分支：`get_gw_active` → 引导或 Home | `ui_home.c` |
| 3 | 扩展 `UI_SCR_PROVISION_*`，`ui_nav` | `ui_private.h`, `ui_nav.c` |
| 4 | 处理 `TY_DISPLAY_TP_STAT_NETCFG`；`ui_provision_init` | `app_ui.c` |
| 5 | 去掉 `active_shorturl` 注册 | `tuya_app_main.c` |
| 6 | `make app APP_NAME=tuyaos_jiajia` 联调 | — |

### 关键代码片段

**ui_home.c — Welcome 定时器**

```c
if (get_gw_active() >= ACTIVATED && ui_provision_is_device_ready()) {
    ui_nav_to(UI_SCR_HOME);
} else if (get_gw_active() >= ACTIVATED) {
    ui_provision_show_progress();  /* 已激活但 AI 未就绪 */
} else {
    ui_provision_show_guide();
}
```

**app_ui.c**

```c
case TY_DISPLAY_TP_STAT_NETCFG:
    ui_provision_show_progress();
    break;
case TY_DISPLAY_TP_STAT_NET:
    if (msg->data[0]) ui_provision_try_finish();
    break;
```

---

## 六、验收用例

1. 出厂未激活：Welcome → 引导 → 配网中（直至三门禁满足）→ 成功 4s → Home  
2. 已激活冷启动：Welcome → 直接 Home（或短暂配网中直至 AI 就绪）  
3. `fast_unactive` 后重启：再走引导流程  
4. 全程无二维码  
5. 未激活提示音仍播放（与 UI 并存）

---

## 七、风险与待办

| 问题 | 建议 |
|------|------|
| `EVENT_NETCFG_DATA` 不一定覆盖 BLE 路径 | 以 `TY_DISPLAY_TP_STAT_NETCFG` 为主 |
| 事件顺序乱序 | 组合判断 + `try_finish_provision()` |
| Home 可左滑进聊天（未激活） | P1 可禁手势 |
| 对照文档仍写「二维码」 | 更新 `Docs/六六AI陪伴机器人-软件功能与代码能力对照.md` FR-001 |

---

## 八、工作量

约 **1.5 人日**（无 QR / shortUrl 联调）。

---

## 九、实现 todos

- [ ] 新增 ui_provision 三屏（无 lv_qrcode）
- [ ] ui_home Welcome 分支 + ui_provision_init
- [ ] ui_nav 扩展 + NETCFG 消息
- [ ] 就绪门禁 + 事件订阅
- [ ] tuya_app_main 去掉 active_shorturl
- [ ] make app 联调验收
