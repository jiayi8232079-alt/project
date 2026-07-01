---
name: icon-design
description: 图标设计实战排障版 - SVG viewBox、stroke alignment、optical size、pixel grid、24px/20px/16px 多尺寸、filled/outlined/duotone 风格、Lucide/Material/SF Symbols/Iconify 图标库治理、Figma variables、SVGO、currentColor、accessibility label、maskable icon、favicon/app icon、dark mode contrast、图标按钮、组件库接入、品牌/应用图标和导出排障。当任务涉及画图标、改 SVG、图标组件、图标库替换、应用图标、favicon、可访问性标签、暗色模式图标或图标视觉一致性时使用。
---

# 图标设计实战排障版

> 定位：只负责图标作为符号资产的语义、网格、轮廓、视觉重量、导出、平台适配和验收证据；页面布局、完整 UI、品牌战略、设计系统文档、AI 生图提示词分别交给相邻技能。
> 铁律：图标定制必须先定目标/尺寸网格、风格系统、输出格式/平台、证据；未看入口截图、相邻图标、SVG 源和平台预览，不得判定通过。

## 快速总则：图标定制目标 / 尺寸网格 / 风格系统 / 输出格式平台 / 证据

1. 目标：先确认图标是操作、导航、状态、品牌、应用入口、空态装饰还是营销符号；不同角色决定是否需要文字、accessibility label、点击态和版权证据。
2. 尺寸网格：默认从 24px 基准画板开始，同时验 20px 和 16px；必须检查 SVG viewBox、画板、safe area、stroke alignment、pixel grid 和 optical size。
3. 风格系统：明确 filled/outlined/duotone、线宽、端点、圆角、拐角、负空间、视觉重量；禁止 Lucide/Material/SF Symbols/Iconify 与自绘风格混用后不做统一。
4. 输出格式/平台：确认交付 SVG、React/Vue Icon component、Iconify JSON、PNG、PDF、favicon/app icon、maskable icon、iOS/Android/桌面/PWA/浏览器扩展中的哪一种。
5. 主题颜色：功能图标默认 currentColor；状态色和品牌色走 token 或 Figma variables；必须验 dark mode contrast、高对比、disabled、hover、active。
6. 可访问性：装饰图标 aria-hidden；传达动作或状态的图标必须有 accessibility label 或可见文字；纯图标按钮要验键盘焦点和读屏语义。
7. 导出证据：保留 Figma/Sketch/AI 画板截图、SVG 源、SVGO 前后差异、浏览器/真机截图、相邻图标并排图、平台预览图。
8. 停止条件：隐喻不明、授权不明、入口不明、平台尺寸不明、SVG 源不可见、仅有口头审美偏好时，先补证据，不凭感觉改。

## 场景执行卡

### 1. 单个 SVG 图标手写/修改

- 输入：用途、入口截图、目标尺寸、相邻图标、现有 SVG、Figma 画板或失败截图。
- 动作：先定隐喻，再校 SVG viewBox 与画板；按 24px/20px/16px 验证 stroke alignment、端点、圆角、负空间、光学居中、pixel grid；小尺寸必要时重绘而非等比缩放。
- 证据：SVG 源片段说明、三尺寸截图、明暗主题截图、与相邻图标并排截图。
- 失败兜底：看不懂或与业务语义冲突时，改为图标+文字或回到产品/设计确认。

### 2. 一组图标风格统一

- 输入：页面截图、图标清单、来源库、线宽/圆角基准、品牌规范、替换范围。
- 动作：建立风格矩阵：filled/outlined/duotone、线宽、端点、圆角、画板留白、视觉重量、optical size、命名；统一 Lucide/Material/SF Symbols/Iconify 或自绘来源。
- 证据：替换前后矩阵、影响入口、截图对比、图标库版本和授权来源。
- 失败兜底：第三方品牌图标不能擅自重绘；只能按授权资产接入或转 research/legal-counsel。

### 3. Figma / Sketch / Illustrator 导出排障

- 输入：原文件、画板尺寸、导出设置、Figma variables、SVGO 配置、导出 SVG、预览失败截图。
- 动作：检查画板与 viewBox、clipPath/mask、transform 嵌套、style/id 冲突、长小数、栅格嵌入、fill-rule、stroke 转 outline 后是否变形；SVGO 后必须视觉复核。
- 证据：导出前后 diff 摘要、浏览器预览、Figma 画板截图、SVGO 配置摘要。
- 失败兜底：文件变短不等于正确；任何 mask/clipPath 清理都要复看透明区和裁切边。

### 4. 图标组件和 Design Token 接入

- 输入：组件 API、size/color/title/aria-hidden 参数、token 命名、主题路径、构建方式、tree-shaking 结果。
- 动作：默认 currentColor；size 映射 16/20/24；状态色走 token/Figma variables；title 与 accessibility label 可控；Iconify 或库图标按需导入，避免整包进产物。
- 证据：组件文档、Storybook/预览、构建体积、明暗主题截图、无障碍检查结果。
- 失败兜底：涉及代码实现、构建失败、tree-shaking、类型错误时切 js-ts-dev 或对应端，再由 code-audit 收口。

### 5. 图标按钮、导航、状态和可访问性

- 输入：用户角色、动作风险、是否有文字、状态含义、键盘路径、读屏语义、对比要求。
- 动作：高风险动作不只用图标；状态图标不只靠颜色；纯图标按钮必须有 accessibility label、focus ring、hover/active/disabled；dark mode contrast 不低于项目要求。
- 证据：键盘路径、无障碍树/检查截图、明暗主题截图、状态矩阵。
- 失败兜底：用户无法 1 秒内理解时加文字或 tooltip，不用“极简”掩盖可用性问题。

### 6. favicon/app icon/maskable icon/PWA/商店资产

- 输入：平台目标、尺寸矩阵、safe area、圆角规则、透明背景、品牌授权、manifest 或配置路径。
- 动作：分别校 favicon/app icon、maskable icon、iOS/Android/PWA 图标；检查安全区、裁切、透明底、深浅背景、低分辨率缩放、缓存刷新。
- 证据：平台预览、manifest/配置摘要、导出文件清单、缓存清理后截图。
- 失败兜底：商标、授权、仿冒、应用商店规则不明时停止，转 legal-counsel/research。

### 7. 图标库迁移或治理

- 输入：当前库、目标库、包版本、授权、使用频率、命名映射、bundle 报告。
- 动作：核 Lucide/Material/SF Symbols/Iconify 差异；建立 old->new 映射；逐入口验语义、线宽、optical size、tree-shaking；保留回滚表。
- 证据：映射表、影响面搜索结果、构建体积、关键页面截图。
- 失败兜底：迁移涉及 API、组件或构建时必须串 js-ts-dev/test-engineering/code-audit。

## 高频坑 / 防遗漏

### 高频坑

1. 只改 path，不看入口截图和相邻图标，导致风格漂移。
2. SVG viewBox 与画板不一致，stroke 被裁切或图标偏心。
3. 24px 好看但 16px 糊成黑块，未按 pixel grid 重绘小尺寸。
4. stroke alignment 未校，1px 线落在半像素上导致发虚。
5. filled/outlined/duotone 混用，视觉重量不一致。
6. currentColor 没用，硬编码 #000/#fff，dark mode contrast 和主题失效。
7. Figma variables/token 与代码 token 名称不一致，交付后颜色断链。
8. SVGO 清掉必要 id、mask、clipPath、fill-rule，图标预览变形。
9. Iconify 或图标库整包导入，bundle 体积暴涨。
10. accessibility label 缺失，纯图标按钮读屏只读“button”。
11. maskable icon 忽略安全区，Android/PWA 被裁脸。
12. favicon/app icon 缓存未清，误判线上未更新。

### 防遗漏清单

- 是否确认图标角色、入口、用户动作风险和平台目标。
- 是否核 SVG viewBox、画板、safe area、stroke alignment、pixel grid。
- 是否按 24px/20px/16px 验 optical size 和视觉重量。
- 是否明确 filled/outlined/duotone、线宽、端点、圆角、负空间。
- 是否验证 currentColor、Figma variables、token、dark mode contrast。
- 是否给功能图标 accessibility label，装饰图标 aria-hidden。
- 是否记录来源库 Lucide/Material/SF Symbols/Iconify、版本和授权。
- 是否跑 SVGO 后复看实际图形，而非只看 diff。
- 是否保留截图、源码、导出清单、影响入口和回滚路径。

## 输出要求

- 结论：通过/不通过/先不改，并说明缺哪类证据。
- 输入证据：列入口截图、相邻图标、SVG 源、Figma/导出设置、平台预览、图标库版本。
- 设计决策：说明图标语义、尺寸网格、风格系统、颜色主题、可访问性策略。
- 改动说明：列影响图标、文件/组件/平台、替换映射和回滚方式；若未改，列阻塞项。
- 验收证据：三尺寸截图、明暗主题、无障碍、SVGO/构建/平台预览、相邻对比。
- 联动技能：涉及页面布局转 ui-design/ui-architect；涉及代码转对应语言；涉及测试转 test-engineering；提交前由 code-audit 收口。

## 约束

- 不替代 design-director 做品牌战略和创意方向审批。
- 不替代 ui-architect 做信息架构、导航结构、状态流和页面骨架。
- 不替代 ui-design 做整页视觉、布局、间距、组件样式和视觉层级。
- 不替代 design-md-builder 写完整设计系统文档；只给图标规范要点和证据。
- 不替代 ai-image-prompt 生成位图/宣传图 prompt；只定义可转 SVG/图标资产的符号要求。
- 不替代 test-engineering 设计完整测试矩阵；只列图标验收证据。
- 不替代 code-audit 做代码安全、影响面和提交前审计；图标代码改完仍需审计。
- 不在授权不明、品牌仿冒、平台规范不明时继续交付。

## 高频 Bug 反例库

反例 1：错法 / 只把 24px SVG 等比缩成 16px。对法 / 为 16px 单独简化路径并贴 pixel grid 验截图。根因 / optical size 与小尺寸识别不是几何缩放问题。

反例 2：错法 / viewBox 写 0 0 20 20 但组件按 24px 渲染。对法 / 统一 SVG viewBox、画板和 size 映射，必要时重导。根因 / 坐标系不一致造成裁切和偏心。

反例 3：错法 / stroke-width 1 的线落在半像素还说浏览器渲染问题。对法 / 校 stroke alignment 和 pixel grid，改坐标或线宽。根因 / 矢量坐标未对齐物理像素。

反例 4：错法 / Lucide 线性图标旁放 Material filled 图标。对法 / 统一 filled/outlined/duotone 与线宽圆角，或全组替换。根因 / 图标库风格语法不同。

反例 5：错法 / SVG fill 固定 #000。对法 / 功能图标用 currentColor，状态和品牌色走 token/Figma variables。根因 / 主题系统和暗色模式未接入。

反例 6：错法 / 纯图标删除按钮没有文字和 accessibility label。对法 / 加 aria-label/title 或可见文字，并验读屏和 focus。根因 / 把视觉简洁误当可访问。

反例 7：错法 / SVGO 默认配置清掉 mask id，图标局部消失。对法 / 保留必要 id/mask/clipPath/fill-rule，压缩后逐图预览。根因 / 优化器不了解图形语义。

反例 8：错法 / app icon 直接复用方形 logo。对法 / 按平台 safe area、圆角、maskable icon 规则导出。根因 / 应用入口图标与普通品牌图标规范不同。

反例 9：错法 / favicon 已替换但浏览器仍旧图就继续改文件。对法 / 清缓存、改版本参数或核 manifest/link 指向。根因 / favicon/app icon 有多层缓存。

反例 10：错法 / Iconify 动态拼字符串导入所有图标。对法 / 静态映射常用图标并验 bundle。根因 / 构建器无法 tree-shaking 动态全集。

反例 11：错法 / 暗色模式只换背景不看图标对比。对法 / 验 dark mode contrast、disabled、hover、active 全状态。根因 / 图标颜色依赖主题 token 而非单色资产。

反例 12：错法 / Figma 导出含嵌入 png，却按 SVG 矢量交付。对法 / 检查 image 标签和资源引用，重建矢量路径。根因 / 资产来源混入栅格，缩放和主题都失效。

反例 13：错法 / SF Symbols 图标照搬到非 Apple 平台还保留平台特定隐喻。对法 / 核平台语义，跨平台改为通用符号或替换库。根因 / 图标语义受平台习惯影响。

反例 14：错法 / 图标按钮 hover 态只改背景不改图标色。对法 / 建状态矩阵并截图验证 currentColor 继承。根因 / 组件状态和图标状态未绑定。

## 提交前自检清单

- [ ] 已拉取/读取需求、入口截图、相邻图标、SVG 源或 Figma 证据。
- [ ] 已确认图标目标、平台、尺寸网格、风格系统和输出格式。
- [ ] 已检查 SVG viewBox、stroke alignment、pixel grid、optical size。
- [ ] 已覆盖 24px/20px/16px、明暗主题、dark mode contrast。
- [ ] 已确认 filled/outlined/duotone、Lucide/Material/SF Symbols/Iconify 来源和授权。
- [ ] 已检查 currentColor、Figma variables、token、accessibility label。
- [ ] 已验证 SVGO 前后无变形、无错误裁切、无栅格混入。
- [ ] favicon/app icon/maskable icon 已按平台预览并处理缓存。
- [ ] 涉代码/构建/测试/提交已串对应端、test-engineering、code-audit。
- [ ] 输出中有证据、影响面、回滚路径；无证据项标未验证。

## 2024-2026 新坑速查

- Figma variables 与代码 token 双向同步不稳：交付时必须列变量名、token 名和默认值。
- 多主题 currentColor 继承链变长：Icon 组件不要内部硬编码色值，状态色从父级或 token 注入。
- Iconify/图标库动态图标名影响 tree-shaking：需要静态白名单或构建插件验证。
- SVGO v3/v4 配置差异会改变 id、prefix、floatPrecision、removeViewBox 行为：升级后逐图回归。
- PWA maskable icon 安全区被更多启动器裁切：核心符号不要贴边，至少做平台预览。
- 浏览器 favicon 缓存更顽固：验证时清 cache、换文件名或加版本参数。
- 高 DPI 与 1px stroke 发虚仍常见：半像素坐标和 stroke alignment 必查。
- AI 生成 logo 常混栅格/伪矢量：要查 image 标签、路径可编辑性和授权来源。
- WCAG 2.2/平台无障碍审查更重视纯图标按钮名称：必须保留 accessibility label。
- iOS/Android/Web 对 optical size 和圆角观感不同：不能只看桌面浏览器截图。
- 暗色模式不仅是黑白反转：需要验 warning/success/error/disabled 与品牌色对比。
- SF Symbols、Material Symbols 可变轴/填充等级不同：跨库替换要锁定 weight/fill/grade/optical size。

## 与相邻技能的边界

- design-director：负责品牌定位、创意方向、受众和质量标准；icon-design 只把已定方向落到图标符号、网格、风格和交付验收。
- ui-architect：负责信息架构、页面结构、导航/状态流；icon-design 只判断图标是否承担了正确入口语义和状态表达。
- ui-design：负责整页视觉、组件样式、布局、间距、色彩层级；icon-design 只处理图标本体、一组图标一致性和图标状态。
- design-md-builder：负责沉淀设计系统 Markdown；icon-design 只提供图标规范、命名、尺寸、证据和反例，不写完整系统文档。
- ai-image-prompt：负责 AI 生图/宣传图/logo prompt；icon-design 负责 SVG/矢量图标能否工程化、可访问、可主题化。
- js-ts-dev / 对应语言技能：负责 Icon 组件、导入、类型、构建、路由中的代码实现；icon-design 给视觉和资产验收标准。
- test-engineering：负责回归矩阵、自动化、视觉测试和 CI 证据；icon-design 给必须覆盖的图标场景和手工验收点。
- code-audit：负责最终影响面、安全、提交前审计；icon-design 提供图标修改证据，不能替代审计收口。
