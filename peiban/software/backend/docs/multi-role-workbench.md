# 多角色工作台抽象 · 第 1 期（MVP）

> 版本：2026-04-22
> 覆盖：在已有 `ServiceStaffRole` / `ProfessionalService` 基础上接通"订单 → 派单 → SOP → 方案模板"整条链路。

## 1. 本期交付

| 模块 | 文件 / 路径 | 说明 |
|---|---|---|
| 数据 | `20260422_order_professional_service.sql` | `orders` 加 `professional_service_id` 外键 |
| 数据 | `20260422_service_plan_templates.sql` | 新建 `service_plan_templates` + `order_service_plans` |
| 订单派单 | `AttendantService.getGrabOrders` | 按 `professional_service.category → role.matchCategories → attendant.professionalRoles` 过滤；管理员免过滤 |
| 订单创建 | `OrderService.resolveProfessionalServiceId` | 支持 DTO 里的 `professionalServiceId` 和 `professionalServiceCode` 两种入参 |
| 订单详情 | `OrderService.findOne` | 顺带 JOIN `professionalService`，供小程序取 SOP |
| SOP 打勾 | `POST /orders/:id/sop-progress` | 服务者勾选每一步，存 `order.completionData.sopProgress[idx]` |
| 方案模板 | `ServicePlanModule` | `/service-plans/templates/*` CRUD + `/service-plans/order/:id/*` 挂到订单 |
| 小程序 · workbench | `onQuickLinkTap` | `meal_plan / training_plan / care_log` 三个 quickLink 统一跳 `/pages/workbench/service-plan/service-plan?kind=...` |
| 小程序 · 通用方案页 | `pages/workbench/service-plan` | 列表 + 新建 + 编辑 + 删除；按 `kind` 自适应字段集 |
| 小程序 · SOP | `pages/workbench/service-timeline` | 服务时间线顶部渲染 SOP 任务清单 + 打勾持久化 |

## 2. 业务链路（打通）

```
用户下单
 ├─ admin 选 ProfessionalService → 提交 professionalServiceCode
 │   OrderService 解析为 professional_service_id 存入 orders
 │
 └─ 派单
     ├─ admin 后台指派（走原路径）
     └─ 陪诊员 / 营养师 / 康复师等抢单
         AttendantService.getGrabOrders 过滤：
         订单 PS.category ∈ 自己的 roles 对应的 matchCategories
             
服务中
 ├─ service-timeline 顶部显示 PS.sopSteps
 │   服务者逐步打勾 → POST /orders/:id/sop-progress
 │
 └─ 快捷入口（工作台按角色变装显示）：
     ├─ 营养师 → 食谱模板 (kind=meal_plan)
     ├─ 康复师 → 训练方案 (kind=training_plan)
     └─ 月嫂/居家护理员 → 育护日志 (kind=care_log)
         都是 pages/workbench/service-plan/service-plan 单页复用
             
服务后
 └─ SOP 打勾数据留在 order.completionData.sopProgress
     完成订单时的补资料校验可选扩展为"必须勾满必填步骤"
```

## 3. 上线步骤

1. 按顺序执行 migration：
   - `20260422_order_professional_service.sql`
   - `20260422_service_plan_templates.sql`
2. 无需清数据；老订单 `professional_service_id` 为 null，派单逻辑对老订单仍按"所有陪诊员可抢"处理。
3. 重启后端服务（TypeORM `synchronize: true` 也会自动补表，但生产环境请先跑 migration 再关闭 synchronize）。
4. admin 后台「订单 → 创建订单 → 选择"专业服务"」即可开始产生第 1 条绑定 category 的订单。

## 4. 角色 / 类别映射表（便于运营配置）

| 角色 | matchCategories | 快捷入口额外页 |
|---|---|---|
| 陪诊员 ATTENDANT | — | — |
| 营养师 NUTRITIONIST | NUTRITION | 食谱模板（meal_plan） |
| 康复师 REHABILITATOR | REHABILITATION | 训练方案（training_plan） |
| 护士 NURSE | NURSING | — |
| 居家护理员 CAREGIVER | NURSING | 育护日志（care_log） |
| 月嫂 MATERNAL_CARE | MATERNAL_CHILD | 育护日志（care_log） |
| 心理咨询师 PSYCHOLOGIST | PSYCHOLOGY | — |

> 陪诊员 `matchCategories=[]` 故意为空：陪诊员只能抢到"没绑 PS"的老陪诊订单，
> 不会误抢到营养师 / 康复师的专业订单。
> 如果要让一个人同时能接陪诊 + 营养，就在后台把他的 `professionalRoles`
> 同时勾选 ATTENDANT + NUTRITIONIST。

## 5. 下一期预告（第 2 期 · 家政 / 保姆 / 产后康复 / 儿科）

- `ServiceStaffRole` 新增：DOMESTIC_HELPER（家政）、LIVE_IN_NANNY（住家保姆）、POSTPARTUM_REHAB（产后康复师）、PEDIATRIC_CARE（儿科专项）
- `ProfessionalServiceCategory` 新增：DOMESTIC（家政类）
- `orders` 新增 `service_mode` ENUM(single_visit / hourly / daily / weekly / monthly)
- 预置若干服务目录种子：全日制家政、住家保姆 26 天包、产后康复 8 次套餐等
