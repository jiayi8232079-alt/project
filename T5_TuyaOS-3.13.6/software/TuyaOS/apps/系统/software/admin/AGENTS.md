# AGENTS.md · 管理后台（Vue3）

> 先读 [`../AGENTS.md`](../AGENTS.md)。深度文档：`../开发说明/05`（后台视图）、`../开发说明/10`（多租户三门户）。

## 技术栈
Vue 3.5 + Element Plus 2.13 + Vite 5 + Pinia 3 + vue-router 4 + ECharts / echarts-gl（含三门户数据大屏）。

## 本地启动
```bash
cd software/admin
npm install
npm run dev            # 开发模式
npm run build          # vue-tsc 类型检查 + 构建
```

## 约定
- 视图按业务域分组在 `src/views/*`；平台门户 + 政府 / 社区 / 企业三门户同一工程
- API 走 `axios` 封装；注意租户与数据范围（见 `../开发说明/10`）
- 用 `unplugin-auto-import` + `unplugin-vue-components`，多数 Element 组件 / API 可自动按需引入
