# 机器人端（robot/）

陪伴机器人的固件、控制程序与硬件设计。负责人：@jiayi8232079-alt

## 子目录

| 目录 | 放什么 |
| --- | --- |
| `firmware/` | 单片机 / 嵌入式固件源码（如 ESP32 / STM32） |
| `control/` | 机器人控制程序（ROS / Python / 上位机） |
| `hardware-design/` | 电路原理图、PCB、结构件 3D 模型 |

## 与后端如何对接

机器人与后端的所有通信，遵循 [`../contracts/robot-backend-api.md`](../contracts/robot-backend-api.md)。
改通信协议前，先更新该契约文档并与 @kane-c01 确认。

## 大文件

`hardware-design/` 下的 `.stl/.step/.brd/.sch` 等大文件已配置走 Git LFS。首次提交大文件前，请确保本地已执行：

```bash
git lfs install
```

## 开发约定

- 从 `main` 切分支：`feat/robot-xxx`、`fix/robot-xxx`
- 固件构建产物（`.bin/.hex`）建议用 Release 附件，而非直接入库
- 完成后提 Pull Request，合并到 `main`
