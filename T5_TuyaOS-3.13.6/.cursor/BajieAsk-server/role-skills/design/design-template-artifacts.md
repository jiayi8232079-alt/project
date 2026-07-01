---
name: design-template-artifacts
description: 对标 Open Design design-templates / artifact protocol 的设计产物模板技能。用于定义页面、原型、deck、dashboard、mobile screen、marketing artifact 的输入、输出、预览、文件契约、data-od-id、验收和导出边界；不替代具体 UI 设计。
---

# 设计模板/原型产物

> 首次自称：设计模板/原型产物（design-template-artifacts，兼容 slug: t）。
> 命名口径：frontmatter name 使用 manifest canonical name `design-template-artifacts`；目录名和 URL 继续兼容 slug `t`；自检不得要求 name 等于短 slug。

定位：产物形态协议。它定义要生成什么、放在哪、如何预览、如何被评论/局部编辑/导出/验收；具体审美由 b/u 决定。它同时承接 Impeccable 的 shape/craft/harden gate，确保产物不是跳过设计门禁的裸模板。

## 适用边界
- 适用：HTML 原型、landing 模板、dashboard 模板、deck 模板、mobile screen、海报/banner 模板、可评论 artifact、可导出预览包。
- 不适用：后端模板引擎、邮件模板接口、CI artifact、纯视觉审美判断、只读学习、没有生成或修改产物的讨论。
- 用户只说“做个页面/模板/原型/海报/banner/deck”时，本技能负责产物契约；视觉方向仍要回 b/u，产物审计回 q。
- 目标不是写一份漂亮说明，而是让后续编辑、评论、导出、验收和 handoff 不缺字段。

## Artifact 类型
- prototype：单屏或多状态交互原型，主输出 `index.html` 或组件文件。
- landing：营销页，包含 hero、proof、features、pricing/CTA、footer 和转化状态。
- dashboard：数据密集界面，包含指标、图表、表格、空/错/加载/权限态。
- mobile-screen：移动端页面，包含安全区、底部操作、触控状态和窄屏溢出策略。
- deck：多页演示，包含 slide 数据、导航、演讲者备注和导出策略。
- poster/banner：固定画幅宣传图，包含画布尺寸、出血、安全区、导出倍率。
- design-system-sample：DESIGN.md 样例组件预览，绑定 token、组件状态和使用边界。

## Artifact Contract
每个 artifact brief 必须声明并在交付中可追踪：
- mode：prototype、page、component、deck、template、design-system。
- platform：desktop、mobile、responsive、iOS、Android、小程序。
- frame：画幅、断点、容器宽度、设备安全区、导出尺寸或 slide ratio。
- preview：html/jsx/markdown/pptx/image；入口文件、启动方式、可用 URL 或截图路径。
- export：目标格式、倍率、分页、透明背景、字体嵌入、文件命名和不可导出项。
- inputs：title、audience、content、brand、data、states、constraints、locale。
- design_system：是否需要 DESIGN.md，读取哪些章节。
- craft：需要哪些 c：typography、color、anti-ai-slop、state、a11y。
- outputs：primary、secondary、assets、manifest、handoff notes。
- assets：图片、字体、图标、视频、Lottie、CSV/JSON 数据源的路径、授权和 fallback。
- anchors：`data-od-id`、comment anchor、editable region、section id 的命名规则。
- version：版本号、change note、生成来源、兼容旧版本的迁移说明。
- capabilities_required：file_write、browser_preview、surgical_edit、screenshot_diff。

## 交付契约
- 主产物必须有稳定入口：单文件优先；多文件必须有根目录、入口文件、资源相对路径和启动说明。
- 预览必须能被真实打开：HTML 用浏览器验证，deck 用渲染/导出验证，图片用实际尺寸检查。
- export 不能只写“可导出”：要说明格式、命名、画幅、倍率、分页、压缩、字体和依赖限制。
- 所有资源引用必须可追踪：相对路径存在；外链要有用途、降级和授权说明；禁止幽灵资源。
- 固定画幅产物必须声明尺寸、safe area、bleed、裁切策略和多倍率导出。
- 响应式产物必须声明至少 mobile/tablet/desktop 或指定容器帧；不能只看首屏桌面。

## 可编辑与评论锚点
- 可评论/可局部编辑元素必须有稳定 `data-od-id` 或等价锚点，命名应语义化且跨版本稳定。
- `data-od-id` 不用随机串；用区域、角色、序号组合，如 hero-title、pricing-card-pro。
- editable region 要标明可改范围：text、image、chart-data、theme-token、layout-slot、state-copy。
- comment anchor 要覆盖 section、component、copy、asset、chart、interaction、export issue。
- 锚点不能因为样式重排、卡片顺序变化、响应式断点而失效；必要时给容器和关键子元素双锚点。
- 删除或合并锚点要在 version notes 里列出迁移关系，避免评论和局部编辑断链。

## 生成纪律
1. 先有 brief，再选 template；不能先套模板。
2. 先读 DESIGN.md/c，再写 artifact。
3. 输出必须有真实内容；禁止 lorem、假指标、假 logo、假评价。
4. 可评论/可局部编辑元素必须有稳定 data-od-id 或等价锚点。
5. 单文件预览优先；复杂项目才拆分。
6. 产物必须有状态覆盖和响应式策略，不只首屏。
7. 不把页面 section 包成层层卡片；页面区块应是全宽带或清晰布局，卡片只用于重复项、工具面板、弹窗。
8. 不做模板污染：标题、结构、配色、三段文案不能在不同主题间可互换。
9. 不用说明文替代功能；产物里不写“这里可以点击/这是功能介绍/用于展示”这类自曝文本。
10. 不把截图、外链、远程字体、CDN 资源当成已验证；必须检查加载和 fallback。

## 模板选择
- 信息不清：回 s。
- 方向不清：回 b。
- 结构复杂：先 a。
- 视觉落地：u。
- 产物审计：q。
- 上线前补状态：h。

## 响应式 Frames
- desktop：至少验证主内容、导航、CTA、表格/图表、模态层和横向溢出。
- tablet：检查栅格重排、卡片密度、触控目标、图表标签和插图裁切。
- mobile：检查安全区、键盘遮挡、底部操作、长词换行、滚动边界和图片焦点。
- fixed canvas：检查设计尺寸、导出倍率、边缘裁切、文字最小字号和关键内容安全区。
- deck：检查 16:9/4:3 或指定 ratio、页码、导航、备注、图表可读性和导出分页。
- dashboard：检查小屏横向滚动策略、表格列冻结/折叠、空态和权限态。

## Render Verification
- 生成后必须打开或渲染主入口；无法打开时不能报“已完成预览”。
- HTML/React/Vue artifact：检查控制台错误、资源 404、首屏非空、关键交互、断点截图。
- 图片/poster/banner：检查像素尺寸、导出倍率、透明背景、裁切、安全区和文字溢出。
- deck：检查每页渲染、字体替换、图片缺失、分页、备注和导出文件。
- 数据型产物：检查数据为空、异常、长文本、极值、无权限和加载中。
- 验证结果要绑定文件路径、命令、截图或失败原因；未跑就写未跑。

## 验收
- 文件契约：主输出存在，预览入口正确，资源不缺。
- 内容契约：真实文本、真实字段、无 placeholder。
- 设计契约：符合 DESIGN.md 和 c。
- 状态契约：关键状态有落点。
- 响应式契约：至少手机/平板/桌面或指定容器。
- 可访问契约：语义、焦点、标签、对比度。
- 编辑契约：`data-od-id`、editable region 和 comment anchor 稳定。
- 导出契约：目标格式、尺寸、倍率、字体、资源和不可导出项明确。
- 版本契约：version、change note、迁移关系和兼容风险可追踪。
- 变更契约：能说明来源、输入、生成过程、未验证项和 handoff 风险。

## Handoff
- 交付时说明 artifact 类型、入口、预览方式、导出方式、资源目录、版本和已验证项。
- 说明哪些区域可局部编辑、哪些区域只能整体重生成、哪些依赖外部素材或数据。
- 说明已知限制：字体授权、图片授权、浏览器兼容、动态图表、导出损失、移动端裁切。
- 说明后续修改策略：改文案、换图、改数据、换主题、扩展新断点分别走哪个入口。
- 不把“看起来对”当 handoff；handoff 必须让下一位接手者能复现预览和导出。

## 输出
- artifact 类型和理由。
- 输入 schema 与缺口。
- 输出文件、预览和导出契约。
- 需要注入的 DESIGN.md/craft 技能。
- 状态、断点、a11y、comment target、editable region 清单。
- asset refs、version notes、handoff notes。
- render verification 结果。
- 不适用项、未验证项和风险。

## 反例库
- 反例 1：只交 HTML，不说明 preview/export。对法：写入口、启动方式、截图/导出格式和验证结果。根因：文件存在不等于可交付。
- 反例 2：`data-od-id` 用随机 hash。对法：语义化稳定命名并记录迁移。根因：评论和局部编辑依赖稳定锚点。
- 反例 3：所有内容塞进大卡片。对法：页面 section 用布局和层级组织，卡片只用于重复项/弹窗/工具面板。根因：嵌套卡片会让模板廉价且难响应。
- 反例 4：三个行业模板只换标题。对法：重写信息架构、证据、数据和视觉节奏。根因：模板污染来自可互换结构。
- 反例 5：只验证桌面首屏。对法：至少查 mobile/tablet/desktop 或指定 frame。根因：artifact 交付常坏在断点和溢出。
- 反例 6：资源路径写了但文件不存在。对法：逐个检查 asset refs、授权和 fallback。根因：缺资源会让预览/导出失真。
- 反例 7：导出写“支持 PNG/PDF”。对法：说明命令、尺寸、倍率、字体、分页和失败项。根因：导出是交付契约，不是口头能力。
- 反例 8：评论锚点只到 section。对法：关键文案、图表、资产和交互都有 anchor。根因：粗锚点无法做精确反馈。
- 反例 9：deck 只看编辑态。对法：渲染每页并验证导出分页、备注和字体替换。根因：编辑态与交付态不同。
- 反例 10：版本只写 latest。对法：记录 version、change note、旧锚点迁移和兼容风险。根因：可追踪性断了就无法回滚或复审。
- 反例 11：用说明文字解释功能。对法：做真实控件、状态和内容，不在 UI 内解释“此处展示”。根因：产物不是教学占位。
- 反例 12：真实 key、token、客户数据进入样例。对法：用占位符和脱敏样本，交付前做敏感扫描。根因：模板会被复制扩散。

## 自检
- [ ] frontmatter `name` 为 canonical `design-template-artifacts`；兼容 slug 为 `t`。
- [ ] 正文小于 500 行，fenced code block 为 0。
- [ ] 已覆盖 artifact contract、preview/export、asset refs、responsive frames 和 render verification。
- [ ] 已覆盖 `data-od-id`、editable regions、comment anchors、versioning 和 handoff。
- [ ] 已禁止 nested cards、template pollution、placeholder、假数据和幽灵资源。
- [ ] 已扫描真实 key、token、密钥、客户数据和不可公开素材。
- [ ] 输出能说明文件、预览、导出、验证、未验证项和下一步。