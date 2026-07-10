# AGENTS.md · 后端（NestJS）

> 先读 [`../AGENTS.md`](../AGENTS.md) 与仓库根 AGENTS。深度文档：`../开发说明/03,04,10,12,18`。

## 技术栈
NestJS 11 + TypeORM 0.3 + MySQL 8 + Redis(ioredis) + BullMQ + socket.io。TypeScript 5.7（ESM）。

## 本地启动
```bash
cd software/backend
npm install
npm run start:dev      # 热重载（需先配 .env：DB / Redis 等）
```
常用：`npm run lint`、`npm run build`、`npm test`。

## 必须复用的横切层（别另起炉灶）
- 请求上下文 ALS：`common/contexts/request-context.ts`（`currentUser()` / `currentTenantId()`）
- 多租户：`TenantAwareEntity` + `TenantSubscriber`（写自动注入 `tenant_id`）+ `applyTenantFilter`
- 审计：`AuditInterceptor`（写操作全落 `audit_logs`）
- 限流：Redis 后端 `ThrottlerGuard`
- JWT：identity 缓存在 Redis（改密即时失效），载荷含 `tenantId`

## 红线
- 生产 `synchronize=false`：改表只能走 `../deployment/` 迁移 SQL，禁止靠实体自动改表
- 跌倒 / SOS 等安全事件走 `alert` 规则引擎，**不经 LLM**
- 新查询默认带租户过滤；改字段 / 枚举 / 接口前先全局搜引用

## 新增模块步骤
见 `../开发说明/12-开发指南与规范.md`（控制器路由前缀、DTO 校验、实体注册、迁移）。
模块清单与路由前缀见 `../开发说明/03`，数据模型见 `../开发说明/04`，API 全量见 `../开发说明/18`。
