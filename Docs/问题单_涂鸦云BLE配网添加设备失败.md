# 问题单：涂鸦云 BLE 配网失败导致 Smart Life 添加设备失败

> **说明**：本文档按常见飞书「问题单 / 缺陷单」结构整理，用于存档与对外（如涂鸦工单）同步。  
> 模版参考链接（需登录打开）：[飞书模版](https://vcn6kw1hyga4.feishu.cn/wiki/IODbwvCXDi5r1YkAQ80cOSqznCg)  
> 若与贵司模版字段不一致，可将模版目录或截图发来，再对齐增删小节。

---

## 1. 元信息

| 字段 | 内容 |
|------|------|
| **问题单标题** | BLE 配网首包后 `ble recv data len err`，Smart Life「添加设备」失败 |
| **状态** | 待提交 / 待涂鸦侧回复（自行维护） |
| **优先级** | P1（配网阻塞新用户绑定） |
| **产品 PID** | `5rkngypnnu9k3qdq` |
| **应用/固件** | `tuyaos_demo_wukong_ai`，应用版本 `0.0.2`（以当前编译为准） |
| **TuyaOS** | `3.13.6` |
| **硬件** | BK7258（T5 / 悟空 AI 类开发板） |
| **设备序列号（日志）** | `00337a715700` |
| **MAC（日志，以实物为准）** | `00:33:7a:71:57:00` |
| **国家码** | `CN`（日志：`kv has ccode CN`） |
| **提出日期** | 2026-05-14 |
| **关联日志** | 仓库 `Docs/` 或根目录 `uart_log.txt`（请随工单上传完整抓包） |

---

## 2. 问题摘要（一句话）

手机 Smart Life / 涂鸦智能在添加设备流程中失败；串口显示 BLE 已连接且收到首包后，设备侧 `tuya_ble_data_handler` 报 **`ble recv data len err`**，随后 BLE 断开，配网无法完成。

---

## 3. 背景与影响

- **背景**：自研固件基于 TuyaOS `tuyaos_demo_wukong_ai`，使用官方配网能力（含 Smart+AP 并发、`nc_tp:10` 等，以实际日志为准）。
- **影响**：新用户无法正常完成「添加设备」；与云端业务无关时仍阻塞绑定与联网。
- **范围**：当前复现集中在 **BLE 配网信令** 路径；**AP 纯热点配网** 可作为对比验证路径。

---

## 4. 复现步骤

1. 设备上电，进入配网态（含 `Reset ctrl data!` / `fast_unactive` 触发后的 Smart+AP 并发配网等）。
2. 手机打开 Smart Life（中国区与设备 `ccode` 一致），选择对应产品，执行「添加设备」。
3. 按 App 引导完成蓝牙授权、靠近设备等步骤。
4. 观察手机端提示「设备添加失败」或等价文案。

**复现率**：高（多次尝试均失败）。

---

## 5. 预期结果 vs 实际结果

| 项目 | 预期 | 实际 |
|------|------|------|
| BLE 配网 | 首包后正常组包，下发 Wi‑Fi 凭据或进入下一状态 | 首包 `total_len:33` 后立即 **`ble recv data len err`**（异常大长度，如 `56414`、`9376`、`59017` 等，数值不稳定） |
| 链路 | 保持连接至配网完成或明确业务错误码 | 约 1～2 秒内 **`BLE_GAP_EVENT_DISCONNECT(0x213)`**，`Ble Disonnected` |
| 手机 | 添加设备成功 | **添加设备失败** |
| Wi‑Fi 统计（同段日志） | 配网阶段应有有效下行/后续 STA 行为 | 常见 **`WIFI_RX` 为 0**，未见完整「收齐凭据 → 连路由 → MQTT」链路 |

---

## 6. 关键日志摘录（证据）

以下摘自 `uart_log.txt` 典型片段（**提交涂鸦工单时请附带完整原始日志文件**）。

```
Ble Connected
Dev Rev BT Package
recive sub_pkg desc:3, no:1, pack_len:33, total_len:33
ble recv data len err:56414
BLE_GAP_EVENT_DISCONNECT(0x213)
Ble Disonnected
```

另一次复现示例：

```
ble recv data len err:9376
...
BLE_GAP_EVENT_DISCONNECT(0x213)
Ble Disonnected
```

---

## 7. 已做排查（结论摘要）

| 排查项 | 结果 |
|--------|------|
| 手机端各账号删除历史设备 | 已做，**仍失败** |
| 设备侧换网 / 重新进配网（`tuya_iot_wf_gw_fast_unactive`，日志见 `Reset ctrl data!`） | 已做，**BLE 错误仍出现** |
| 与「仅云端未解绑」关系 | 当前日志显示失败发生在 **BLE 解析阶段**，**早于**稳定 STA/MQTT 成功，不能单独用「未删绑定」解释 |

**说明**：三次上电 / 长按触发的 `fast_unactive` 主要为 **清 WiFi + 进配网**；若需 **整机去激活** 需 `tuya_iot_wf_gw_unactive()` 等路径（如 `linkpolicy reset` 等，以工程配置为准），与本次 BLE 首包错误可并行排查。

---

## 8. 初步原因分析（供内部与厂商讨论）

1. **BLE 应用层组包/长度校验异常**：头字段 `total_len:33` 与后续计算出的「数据长度」严重矛盾，疑似 **粘包、错位、缓冲区未初始化或协议版本不匹配** 等。  
2. **射频共存**：配网阶段 SoftAP + BLE 并发时，BLE 链路更易受干扰（需结合 `nc_tp` 与芯片侧共存策略验证）。  
3. **App / SDK 版本**：需涂鸦侧对照 PID 与 **BLE 配网协议版本** 是否匹配。

---

## 9. 期望支持 / 下一步

**对涂鸦工单（可复制）：**

1. 根据 PID `5rkngypnnu9k3qdq`、固件 `0.0.2`、TuyaOS `3.13.6`，确认 **Smart Life 与设备 BLE 配网协议是否匹配**，是否有已知缺陷或建议升级的 SDK/组件版本。  
2. 协助解读 **`tuya_ble_data_handler.c:785` `ble recv data len err`** 在 `total_len:33` 首包后的典型根因与规避手段。  
3. 若建议 **纯 AP 配网** 绕过 BLE，请给出 Smart Life 侧推荐操作路径及产品能力要求。

**本地验证建议：**

- 手机系统 WLAN 直连设备热点 `SmartLife-xxxx`，走 **AP 配网** 对比是否仍失败。  
- 换机、升级 App、2.4G-only、关 VPN、近距离复测。

---

## 10. 附件清单

| 附件 | 说明 |
|------|------|
| `uart_log.txt` | 从设备上电到一次完整「添加失败」的串口原始日志 |
| 本问题单 | `Docs/问题单_涂鸦云BLE配网添加设备失败.md`（可导入飞书或复制为 Wiki 子页面） |
| 飞书云文档（存档） | [问题单：涂鸦云 BLE 配网添加设备失败](https://vcn6kw1hyga4.feishu.cn/docx/YiDmd5rtDoboh3x9uOWcVDjBnjW)（`document_id`: `YiDmd5rtDoboh3x9uOWcVDjBnjW`） |

---

## 11. 对外工单链接（自行填写）

- 涂鸦服务与支持（提交后填写）：`https://service.console.tuya.com/8/3/list?source=support_center`

---

## 12. 修订记录

| 日期 | 修订人 | 说明 |
|------|--------|------|
| 2026-05-14 | — | 首版：根据串口现象与排查过程整理 |
| 2026-05-14 | — | 已通过飞书 CLI 创建云文档并回填链接（见 §10 附件清单） |
