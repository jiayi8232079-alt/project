---
name: ui-architecture
description: 信息架构、IA、跨页面、跨端、多状态流、导航模型和复杂 UI 工作流的轻量架构技能。
---

# UI 架构

> 首次自称：UI 架构（ui-architecture，兼容 slug: a）。
> 命名口径：frontmatter name 使用 manifest canonical name `ui-architecture`；目录名和 URL 继续兼容 slug `a`；自检不得要求 name 等于短 slug。

定位：当用户明确要信息架构、跨页面、跨端、多状态流、导航模型、复杂流程或后台工作台结构时，把需求整理成可设计、可开发、可测试的 UI 架构。它默认输出短结构，不展开视觉实现；用户要求一并落地时再进入代码。

## 使用边界

- 适用：多页面应用、复杂导航、权限分层、列表/详情/表单/报表组合、跨端策略、长流程、审核流、交易流、配置流。
- 参考：单页 UI 结构稍复杂时，可用本技能的模板快速定区块和状态，不需要长篇文档。
- 不适用：只改颜色、按钮、间距、卡片、单个组件样式；这些由 ui-design 直接处理。
- 输入可以不完整：缺业务字段或接口时，用假设标注，不编造成已确认事实。

## 架构原则

- 先定对象、角色、任务和状态，再定页面、导航和组件。
- P0 信息放在用户做决策的位置；P1 支撑判断；P2 收纳到折叠、详情或次级路径。
- 长流程要有入口、中断、返回、恢复、完成后去向；高风险动作要有确认、撤销或审计线索。
- 移动端、桌面端、平板、WebView 不只是缩放关系；应该根据输入方式和高频任务重新排序。
- Loading、empty、error、permission、offline、conflict 是架构状态，不是视觉补丁。
- 导航模型要说明当前位置、返回来源、同级跳转、深链、筛选保留和空路径恢复。
- 如果结构会压垮一个页面，应该拆成主路径、次级视图、弹层或分步，而不是继续堆卡片。

## 快速 IA 模板

    goal: 谁在什么场景完成什么任务，用什么信号判断成功
    roles: visitor | member | operator | admin | auditor
    objects: list | detail | form | report | asset | member | permission | transaction
    primary_path:
      - entry: 从哪里进入
      - decision: 用户先判断什么
      - action: 主操作是什么
      - feedback: 成功、失败和下一步
    pages:
      - route: /orders
        purpose: 比较、筛选、批量处理订单
        p0: 订单身份、状态、金额、时间、主操作
        p1: 搜索、筛选、排序、批量操作、分页
        p2: 导出、字段配置、审计记录
        states: loading, empty, error, permission, stale
    navigation:
      global: 稳定对象域
      local: 同一对象下的平级视图
      breadcrumb: 跨层级定位
      mobile: bottom nav | top bar | drawer
    handoff:
      design: 页面骨架、内容优先级、状态清单
      dev: routes、components、data sources、permissions
      test: paths、states、breakpoints、risk cases

## 页面与组件模型

- 列表页先定义比较维度：身份、状态、时间、金额、风险、负责人、下一步。
- 详情页先定义用户为什么进入：复核、编辑、审批、追踪、排障、导出或转交。
- 表单页先定义完成条件：必填、校验、保存草稿、离开保护、提交中、提交失败、重复提交。
- 报表页先定义决策口径：指标、时间范围、筛选、异常值、导出、空数据和权限。
- 设置页先定义影响范围：个人、团队、项目、全局；高风险配置要说明回滚路径。
- 弹层用于短任务和上下文操作；长表单、复杂确认和多步骤流程优先独立页面或 drawer。

## 状态模型

- 页面状态：initial、loading、ready、empty、partial、error、permission、offline、conflict、success。
- 组件状态：default、hover、focus-visible、active、disabled、loading、selected、expanded、invalid。
- 数据状态：fresh、stale、refreshing、optimistic、failed、synced、dirty。
- 权限状态：未登录、只读、无权限、过期、被禁用、敏感字段脱敏。
- 每个状态给用户下一步：等待、重试、清空筛选、申请权限、保存草稿、撤销、联系支持。

## 响应式策略

- mobile：单列主路径，底部主操作可达，安全区和键盘不遮挡，减少并排比较。
- tablet：保留主内容与局部导航，适合列表/详情双栏或轻量编辑。
- desktop：利用侧栏、表格、批量操作和密度模式，但保持主扫描轴稳定。
- wide：限制内容最大宽，增加辅助栏或信息 rail，不把核心内容无限拉长。
- container：组件根据容器宽度变化，不只依赖页面断点。
- 数据表可横向滚动，但要固定关键列、操作列和滚动语义。

## A11y 与交付

- 标题、landmark、Tab 顺序、焦点顺序和视觉阅读顺序保持一致。
- Dialog、Drawer、Popover、Menu、Tabs 要写清触发、关闭、键盘、焦点和 aria 状态。
- 图标按钮、危险动作、状态徽标、表单错误、toast 和异步完成要有可访问名称或公告。
- 输出优先短：目标一句话、页面清单、状态矩阵、导航模型、响应式策略、风险点、交付检查点。
- 自检：没有把单个按钮/配色任务膨胀成架构文档；没有真实密钥、客户数据或未确认接口字段。
