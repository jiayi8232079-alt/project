# 陪了个伴（peiban）· 软硬件一体仓库

陪伴机器人项目的统一代码仓库（Monorepo），**软件端**与**机器人端**同仓协作。

> 🧭 **AI 助手 / 新成员从这里进**：先读 [`AGENTS.md`](./AGENTS.md)（全局规矩 + 各端入口），软件深度文档见 [`software/开发说明/`](./software/开发说明/README.md)（21 篇单一文档源）。

## 目录结构

| 目录 | 负责人 | 说明 |
| --- | --- | --- |
| `software/` | @kane-c01 | 软件端：后端 API、管理后台、小程序、移动端 |
| `robot/` | @jiayi8232079-alt | 机器人端：固件、控制程序、硬件设计 |
| `contracts/` | 双方共同维护 | 机器人 ↔ 后端 的接口协议（通信契约） |

### software/（软件端）
- `backend/`　后端 API 服务
- `admin/`　管理后台
- `UniApp/`　微信小程序
- `mobile/`　移动端
- `deployment/`　部署脚本
- 内含独立 `.gitignore`（`node_modules`、`dist`、`uploads` 等已忽略）

### robot/（机器人端）
- `firmware/`　单片机 / 嵌入式固件
- `control/`　机器人控制程序（ROS / Python 等）
- `hardware-design/`　电路图、PCB、结构件（大文件走 Git LFS）

## 协作流程

1. **不要直接推 `main`**：从 `main` 切分支开发
   - 软件：`feat/sw-xxx`、`fix/sw-xxx`
   - 机器人：`feat/robot-xxx`、`fix/robot-xxx`
2. 开发完成 → 提 **Pull Request** → 评审 → 合并
3. 改到某目录会通过 **CODEOWNERS** 自动请求对应负责人评审
4. **接口先行**：机器人与后端的通信改动，先更新 `contracts/robot-backend-api.md`，双方确认后再写代码

## 大文件（Git LFS）

机器人 3D 模型 / PCB / 固件 bin 等大文件已在 `.gitattributes` 配好走 Git LFS。首次使用前执行一次：

```bash
git lfs install
```

## 快速开始

```bash
git clone https://github.com/kane-c01/peiban.git
cd peiban
# 软件端见 software/ 内各子项目说明
# 机器人端见 robot/README.md
```
