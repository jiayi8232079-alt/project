# AGENTS.md · 陪了个伴（peiban）

> 给所有 AI 编码助手（Cursor / Claude / Codex / Copilot 等）与人类协作者的**项目总入口**。
> 开工前请先读完本文件，再按指引进入对应子目录。

## 这是什么

「陪了个伴」是面向**居家养老 / 慢病老人 / 陪诊陪护**的综合服务平台：
**医疗陪诊调度 + 老人健康管理 + AI 陪护机器人 + 分层多租户三门户**。
核心原则：**一套后端，多个前端 + 一台机器人。**

## 仓库地图（Monorepo）

```
peiban/
├── software/     # 软件端（负责人 @kane-c01）
│   ├── backend/    NestJS 11 后端（38 模块 / 66 实体，四端共用）
│   ├── admin/      Vue3 + Element Plus 管理后台（三门户）
│   ├── UniApp/     微信小程序（用户/老人/家属/护工/机构）
│   ├── mobile/     Flutter App（C 端）
│   ├── deployment/ 数据库 SQL / 迁移脚本
│   └── 开发说明/    ★ 21 篇「单一文档源」（最重要，先读它）
├── robot/        # 机器人端（负责人 @jiayi8232079-alt）
│   ├── firmware/        涂鸦 T5-E1 固件（待开发）
│   ├── control/         控制 / 上位机程序
│   └── hardware-design/ 电路 / PCB / 结构件（大文件走 Git LFS）
└── contracts/    # 机器人 ↔ 后端 接口契约（改通信先改这里）
```

## AI 必读顺序（重要）

1. **本文件**（全局规矩）
2. 进你要动的子目录，读它的 `AGENTS.md`
3. 软件深度文档全在 `software/开发说明/`，**从它的 [README](./software/开发说明/README.md) 进**（含 21 篇导航 + 按角色推荐的阅读顺序）
4. 机器人方向从 [`robot/AGENTS.md`](./robot/AGENTS.md) 进（已索引所有机器人文档）

## 技术栈与启动速查

| 模块 | 技术 | 本地启动 |
|---|---|---|
| backend | NestJS 11 + TypeORM + MySQL8 + Redis | `cd software/backend && npm i && npm run start:dev` |
| admin | Vue3 + Element Plus + Vite | `cd software/admin && npm i && npm run dev` |
| UniApp | 微信小程序原生 + TS | 用微信开发者工具打开 `software/UniApp` |
| mobile | Flutter 3.10 | `cd software/mobile && flutter pub get && flutter run` |
| robot | 涂鸦 TuyaOS + Wukong AI 3.0（C） | 见 `robot/AGENTS.md` |

## 全局协作规范

- **不直推 `main`**：切分支（软件 `feat/sw-*`、机器人 `feat/robot-*`）→ Pull Request → 评审 → 合并
- 改 `software/` 自动请 @kane-c01 评审；改 `robot/` 自动请 @jiayi8232079-alt（见 `.github/CODEOWNERS`）
- **接口先行**：机器人 ↔ 后端任何通信改动，先改 `contracts/robot-backend-api.md`，再写代码
- 改完跑该模块的 lint / 构建自检后再提交

## 关键约束（不要违反）

- **安全双链路**：跌倒 / SOS / 心率异常走**规则引擎**，**绝不经 LLM**；只有陪聊 / 查询才走 AI（见 `开发说明/09`、`08`）
- **多租户隔离**：后端实体多带 `tenant_id`，写操作自动注入；新查询要带租户过滤（见 `开发说明/02` 横切层）
- **数据脱敏 + 合规**：健康 / 身份证 / 手机号字段级加密；AI 写操作需二次确认
- **生产 DB 不自动改表**：`synchronize=false`，改表走 `software/deployment/` 迁移脚本
- 设备接入当前是 **mock**，接真涂鸦只新增 service、不动业务层（见 `开发说明/09`）

## 想动手前看这里

- 软件做到哪了 / 缺什么 → `software/开发说明/13-功能清单与开发状态.md`
- 机器人先做什么 → `software/开发说明/20-陪伴机器人·功能路线图与待开发清单.md`
