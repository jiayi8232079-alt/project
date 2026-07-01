---
name: design-system
description: 对标 Open Design DESIGN.md 9-section 与 Impeccable PRODUCT/DESIGN register 的设计系统构建技能。用于从品牌、页面、截图、Figma、design tokens、semantic tokens、组件库、状态矩阵和验收证据生成或更新可被 Agent 消费的 DESIGN.md；不凭空发明规范。
---

# 设计系统规范

> 首次自称：设计系统规范（design-system，兼容 slug: m）。
> 命名口径：frontmatter name 使用 manifest canonical name `design-system`；目录名和 URL 继续兼容 slug `m`；自检不得要求 name 等于短 slug。

定位：把稳定设计证据沉淀成 Agent 可读、人可复核、可版本化的 DESIGN.md。它不是视觉创作技能，而是规范生成与治理技能，目标是让真实项目不会因为 token、component、state、spacing、breakpoint、dark mode、a11y 或 Figma/code 不一致而返工。

## 铁律
- 证据优先：必须区分已确认规范、候选规范、截图推测、Figma 证据、代码 token、组件实现、用户口头偏好、待验证；证据不足只能写候选和缺口。
- 旧稿优先：更新既有 DESIGN.md 时先读旧稿，不无脑覆盖；保留仍有效的约束，标注新增、修改、废弃和冲突。
- 可执行优先：每条规范必须能指导 Agent 写 UI 代码或审查 UI；空泛形容词必须落到 token、组件、状态、布局或反例。
- 一致性优先：Figma variables/styles、代码 token、CSS variables、Tailwind/theme、Storybook 和实际页面冲突时，不私自裁决，列冲突和 owner。
- 低返工优先：必须覆盖 token、组件 anatomy、variants/states、density、breakpoints、dark mode、a11y、icon、content、migration、governance、visual QA。
- 不把设计系统写成品牌散文、组件清单或一次性审美建议；它必须是长期维护的系统契约。

## 9-section schema
1. Visual Theme & Atmosphere：气质、场景、情绪、禁用风格；必须连接到色彩、排版、密度、动效和组件语气。
2. Color Palette & Roles：background、surface、foreground、muted、accent、semantic、chart、overlay；含 light、dark、high contrast。
3. Typography Rules：display、heading、body、caption、mono、numeric；含 scale、line-height、weight、letter-spacing、CJK/Latin fallback、截断和换行。
4. Component Stylings：button、input、select、checkbox、radio、switch、card、dialog、table、tabs、nav、toast、form、chart；必须写 anatomy、variant、state。
5. Layout Principles：grid、max-width、spacing、density、responsive/container、safe-area、scroll、empty/loading/error 布局。
6. Depth & Elevation：shadow、border、z-index、overlay、scrim、glass/blur 是否允许；含焦点层、弹层层级和遮挡规则。
7. Do's and Don'ts：明确可做/禁做，尤其 anti-AI-slop、同质化渐变、过圆卡片、文字溢出、低对比和无证据装饰。
8. Responsive Behavior：desktop、tablet、phone、wide、foldable；含 breakpoint、container query、dynamic viewport、RTL、触控目标。
9. Agent Prompt Guide：给 Agent 的硬约束、优先级、示例、反例、验收命令、缺口提问和变更记录格式。

## Design Tokens
- primitive tokens：只记录原始值，如 color、space、radius、shadow、font、duration、easing、opacity、z-index；不得直接给业务语义。
- semantic tokens：表达用途，如 bg.canvas、surface.card、text.primary、border.subtle、status.error、chart.series.1；必须覆盖 light/dark/high-contrast。
- component tokens：绑定组件部位，如 button.primary.bg、input.border.focus、table.row.hover、dialog.scrim、nav.item.active。
- alias tokens：用于兼容旧名、品牌迁移或跨平台桥接；必须写迁移目标和废弃时间。
- motion tokens：duration、easing、delay、reduced-motion fallback；必须区分 micro interaction、page transition、loading。
- density tokens：comfortable、cozy、compact 的 spacing、height、padding、font-size、row height、hit target 差异。
- breakpoints tokens：phone、tablet、desktop、wide 和 container size；必须写用途，不只写数值。
- token 输出要包含名称、值、用途、证据来源、适用模式、禁用场景、代码位置或 Figma 节点。

## Semantic Tokens
- 语义 token 必须优先于硬编码颜色和尺寸；组件规范只能引用 semantic/component token，避免写死 primitive。
- 状态语义必须覆盖 default、hover、active、focus-visible、disabled、loading、selected、expanded、pressed、invalid、success、warning、danger。
- 前景/背景配对必须记录对比度门槛；正文文本不低于 WCAG AA，关键操作和错误信息优先更高对比。
- dark mode 不允许简单反相；必须分别定义 canvas、surface、elevated、border、overlay、shadow、focus、chart、status 的暗色语义。
- high contrast 要写可替代 token，不得只依赖颜色表达状态。
- chart tokens 必须覆盖序列色、状态色、网格线、阈值线、tooltip、legend 和色盲安全说明。

## Component Anatomy
- 每个核心组件必须写 anatomy：root、container、label、icon、content、control、helper、error、prefix/suffix、badge、actions、overlay。
- Button：size、variant、intent、icon-only、loading、disabled、pressed、destructive、full-width、alignment、min hit target。
- Form controls：label、required、description、placeholder、value、validation、helper、error、focus ring、disabled/read-only、input height。
- Card：header、media、body、metadata、actions、selection、clickable area、empty/loading/error、nested card 禁用规则。
- Dialog/Drawer/Popover：trigger、scrim、surface、title、body、actions、close、focus trap、escape、scroll locking、z-index。
- Table/List：density、row height、header、sorting、filtering、selection、bulk action、pagination、sticky、empty、skeleton、overflow。
- Navigation：active、hover、collapsed、responsive、breadcrumb、tabs、side nav、bottom nav、badge、keyboard focus。
- Feedback：toast、alert、banner、inline error、progress、skeleton、empty state；必须说明何时使用哪一种。
- Chart/Data viz：axis、legend、tooltip、label、annotation、empty/error/loading、responsive、print/export。

## Variants And States
- variant 必须来自用户目标和信息层级：primary、secondary、ghost、link、destructive、success、warning、neutral；禁止只按视觉喜好新增。
- state 必须成矩阵：variant x size x interaction x validation x theme x density；缺项写“未验证”。
- loading 状态必须避免布局跳动；保留按钮宽度、表格列宽、卡片比例和可预期高度。
- disabled 不等于低对比不可读；必要时提供 reason、tooltip 或 inline explanation。
- focus-visible 是必填；不得用 hover 样式替代键盘焦点。
- error 状态必须同时有视觉、文案、aria 或可访问反馈，不只改红色。
- destructive action 必须写二次确认、撤销、危险色 token 和内容规则。

## Spacing, Density, Layout
- spacing 必须基于 scale，如 2/4/8/12/16/24/32/48；偏离 scale 要写证据。
- 组件内部 spacing、组件之间 spacing、页面 section spacing、grid gutter 必须分层，不混用。
- density 必须写适用场景：数据密集后台、内容消费页、移动触控、营销页、编辑器。
- 每种 density 至少定义控件高度、行高、padding、gap、图标尺寸、触控目标、表格行高。
- 页面布局必须写 max-width、grid columns、sidebar width、content rail、sticky 区域、滚动容器。
- 固定格式元素如 board、grid、toolbar、counter、tile 必须有稳定尺寸或 aspect-ratio，避免 hover/label 导致抖动。
- 文本不得溢出按钮、卡片、表格单元格和导航；必须定义换行、截断、最小宽度和长词处理。

## Breakpoints And Responsiveness
- breakpoint 必须说明行为：列数变化、导航形态、密度切换、工具栏折叠、表格转卡片、弹层转 drawer。
- 优先使用 container-aware 规则描述组件响应；页面级 breakpoint 只处理全局布局。
- mobile 必须覆盖 safe-area、虚拟键盘、dynamic viewport、横屏、触控目标、滚动锁定。
- desktop 必须覆盖宽屏留白、内容最大宽、可扫描密度、hover affordance、键盘操作。
- 不同断点要验证首屏信息、主要操作可见性、文本不遮挡、弹层不超屏、图表可读。

## Dark Mode And Themes
- dark mode 必须有独立证据或候选 token；没有证据时写待验证，不臆造完整暗色主题。
- 主题切换必须覆盖 surface hierarchy、border visibility、shadow 替代、overlay、focus ring、chart、status、disabled。
- brand theme 与 system theme 要分开：品牌色不应覆盖错误/警告/成功等语义色。
- high contrast 或 accessibility theme 要避免仅靠透明度和细边框表达层级。
- 图片、图标、插画、Logo 在 dark mode 下必须记录替换、描边、背景或反色规则。

## A11y Rules
- 必须写颜色对比、键盘导航、focus order、focus-visible、aria label、role、name/value/state、reduced motion。
- 交互目标最小尺寸、错误提示、表单关联、状态公告、弹层 focus trap、escape 关闭和返回焦点必须可验收。
- 图标按钮必须有可访问名称；仅装饰图标要标记装饰性，不参与朗读。
- 禁止只用颜色表达状态；必须有文案、形状、图标、aria 或布局辅助。
- 动效必须支持 prefers-reduced-motion；loading 和 skeleton 不得造成眩晕或阅读阻断。
- 内容顺序必须适配屏幕阅读器，不因视觉网格破坏语义顺序。

## Icon Rules
- 优先使用项目既有图标库，如 Lucide、Material、SF Symbols 或品牌图标；禁止混搭多套视觉重量。
- 规定 size、stroke width、filled/outline、corner、optical alignment、hit area、tooltip、aria name。
- icon-only button 必须有 tooltip 和 aria label；危险、保存、删除、上传、下载等命令优先用熟悉图标。
- 图标颜色必须引用 semantic token；状态图标必须与状态文案一致。
- 自定义 SVG 只在库没有合适图标或品牌资产要求时使用；必须记录 viewBox、stroke、currentColor 和暗色适配。
- 禁止把文字放进圆角矩形伪装成图标；能用通用符号时优先用符号。

## Content Rules
- 文案规则必须覆盖按钮动词、表单 label、helper、error、empty、loading、success、warning、destructive confirmation。
- UI 文案要短、具体、可操作；错误文案要说明原因和下一步，不推卸给用户。
- 组件内标题不得使用 hero 级字号；紧凑面板、表格、侧栏使用适配密度的小标题。
- 禁止在产品界面写“这里展示功能”“点击这里使用”等说明型废话；除非是 onboarding 或空状态。
- 多语言、CJK/Latin 混排、数字、日期、货币、单位、截断和复数规则要写清。
- 内容 tone 要与产品域匹配：后台工具安静高效，消费/游戏/品牌页可更有表现力但仍受系统约束。

## Figma And Code Sync
- 必须列 Figma 来源：file、page、frame、component、variant、variables、styles、last checked。
- 必须列代码来源：token 文件、theme config、CSS variables、component path、Storybook story、visual test。
- Figma 变量与代码 token 要建立映射表：Figma name、code token、mode、owner、状态、差异。
- 组件同步要记录 anatomy、props、variants、states、slots、default values、deprecated props。
- 发现 Figma 有而代码无、代码有而 Figma 无、命名不一致、值不一致时，输出冲突表和建议 owner。
- 不用截图替代 token；截图只能辅助确认视觉结果和缺口。
- 生成给 Agent 的规范时，优先引用 code token；Figma-only 规则标注待落地。

## Migration And Versioning
- 每次更新必须写 version/date/change_note/owner/source/affected consumers/rollback。
- breaking change 必须说明影响组件、影响页面、迁移步骤、兼容 alias、废弃日期和验证范围。
- token 重命名必须提供 old -> new 映射；禁止只删除旧 token。
- 组件 variant 合并或废弃必须提供替代方案和代码搜索关键词。
- 迁移计划要区分立即修复、兼容期、后续治理，不把所有问题塞进一次改动。
- 回滚路径必须能恢复旧 DESIGN.md 或旧 token 映射；远端/仓库/设计文件各自写清。

## Governance
- 必须写 owner、reviewer、approver、更新频率、决策记录位置、例外审批方式。
- 新 token、新 component、新 variant、新 breakpoint、新 theme 必须有准入条件和命名规则。
- 禁止一次性为假想需求膨胀组件库；新增必须来自真实页面、可复用需求或明确产品方向。
- 例外规则必须记录范围、期限、替代计划和风险，不能成为永久旁路。
- 设计债要分级：blocker、major、minor、watch；每级对应处理时机。
- 相邻技能边界：视觉创作用 ui-design/ui-craft；页面结构用 ui-architecture；审计用 design-audit；本技能沉淀系统规范。

## Visual QA
- QA 必须覆盖 light/dark、breakpoints、density、主要组件、关键状态、a11y、loading/empty/error。
- 使用截图、Storybook、Playwright、Chromatic、Percy 或人工标注时，要记录视口、数据状态、浏览器和证据路径。
- 必查：文本溢出、重叠、对比度、focus、hover/active、disabled、长文案、多语言、图标对齐、布局抖动。
- 图表和表格要检查空数据、极端数据、长标签、排序筛选、滚动、导出/打印。
- 移动端要检查 safe-area、键盘遮挡、弹层高度、触控目标、横竖屏。
- QA 输出要给结论、证据、阻塞项、非阻塞项、未测项和下一步。

## 更新流程
1. 读取旧 DESIGN.md、Figma/token/CSS variables/Storybook/截图/现有页面；不得无脑覆盖。
2. 建立证据表：来源、时间、owner、可信度、覆盖对象、冲突。
3. 补齐 9-section schema；每节标注已确认、候选、缺口、反例。
4. 建立 token/component/state/density/breakpoint/theme/a11y 覆盖矩阵。
5. 冲突不裁决，交给业务方或 owner；给出可选方案和影响面。
6. 输出变更记录、影响消费者、迁移步骤、回滚路径和 visual QA 清单。
7. 自检行数、fenced code block、敏感信息、无证据断言和关键关键词覆盖。

## 输出要求
- DESIGN.md 正文或 diff 建议。
- 证据清单和覆盖率：Token/组件/状态/density/breakpoints/dark mode/a11y/icon/content/Figma/code/visual QA。
- token 映射表、组件 anatomy 表、state 矩阵、冲突表、反例库。
- 适用范围、不适用范围、owner、版本、迁移、回滚。
- 给 Agent 的硬约束：必须引用哪些 token、禁用哪些 UI 模式、遇到缺口如何提问。
- 未验证项必须单列，不得混进已确认规范。

## 反例库
- 只有“高级、现代、科技感”，没有 token、组件、状态和证据。
- 只写颜色板，不写 semantic token、dark mode、状态色和对比度。
- 只列组件名，不写 anatomy、variant、state、density 和使用边界。
- Figma 与代码冲突时私自选一个，未记录 owner 和迁移计划。
- 把截图推测写成已确认规范。
- 暗色模式简单反相，导致 surface、border、shadow、chart 不可读。
- 新增一堆 token 或 variant，但没有真实页面、组件或迁移需求。
- 图标混用多套库，stroke、size、视觉重量不一致。
- 文案规则缺失，错误、空状态、危险操作只能靠默认文案。
- 没有 visual QA，导致移动端溢出、焦点不可见、长文本遮挡或布局抖动。

## 自检
- 行数 <= 500，fenced code block = 0。
- frontmatter name 为 `design-system`，兼容 slug `m` 只出现在说明中。
- 必含关键词：design tokens、semantic tokens、component anatomy、variants/states、density、breakpoints、dark mode、a11y、icon rules、content rules、Figma/code sync、migration/versioning、governance、visual QA、反例库。
- 每个新增规范都有证据、适用范围或候选标注。
- 没有真实密钥、个人 token、内部 URL、客户数据或不可公开截图路径。
