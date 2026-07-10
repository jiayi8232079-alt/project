# AGENTS.md · 微信小程序（UniApp/）

> 先读 [`../AGENTS.md`](../AGENTS.md)。深度文档：`../开发说明/06-小程序说明.md`。

## 技术栈
微信小程序原生 + TypeScript + Skyline 渲染；自定义 tabBar + 22 分包，≈79 页。

## 开发
用**微信开发者工具**打开 `software/UniApp`（配置见 `project.config.json`）。
接口前缀对照后端见 `../开发说明/03` 与 `../开发说明/06`。

## 约定
- 4 类角色入口（用户 / 老人 / 家属 / 护工）；`workbench` 分包是护工端
- 改页面先确认所在分包；公共能力放主包 `utils`
- 私密配置 `project.private.config.json` 已被忽略，不入库
