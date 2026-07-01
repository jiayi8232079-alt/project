---
name: ai-image-prompt
description: AI 生图提示词实战排障版 - 把一句粗需求改写成可执行、可控、可复验的 AI image prompt，覆盖 composition、style reference、mood board、negative prompt、aspect ratio、lighting、camera angle、depth of field、color palette、brand consistency、logo、typography、product render、character consistency、seed、variation、inpainting、outpainting、reference image、safety、copyright、IP 等关键问题。
alwaysApply: false
---

# AI 生图提示词实战排障版

> 定位：把“帮我生成一张图”变成可执行闭环：目标 / 画面 / 约束 / 证据 → 场景执行卡 → 高频坑 / 防遗漏 → 输出要求 → 约束 → 高频 Bug 反例库 → 2024-2026 新坑速查 → 与相邻技能的边界。
> 铁律：prompt 不是形容词堆叠，而是视觉导演说明；未确认用途、画面变量、模型能力和复验标准时，必须标“需验证”，不能包装成稳定可用。

## 快速总则

- 先定目标：用途、受众、载体、平台、商业/非商业、是否后期排版、是否要保留空白安全区。
- 再定画面：主体、composition、空间层级、camera angle、lighting、depth of field、材质、color palette、情绪和审美边界。
- 再定约束：aspect ratio、尺寸、是否使用 reference image、是否锁定 seed、是否需要 inpainting / outpainting、是否禁文字、logo 或人物。
- 最后给证据：每条 prompt 都要说明适用模型、关键变量、negative prompt / exclude、参数、迭代方式和审图清单。
- 默认输出正向 prompt、negative prompt、参数建议、variation 方案、复验点；用户只要中文也可给中英双语。
- 不确定模型能力、平台政策、版权授权、商标可用性时，写“需验证”，不擅自承诺可商用。
- 真实品牌、产品、人物、logo、typography、IP 资产优先用 reference image 和人工复核；AI image 只负责生成或编辑视觉，不替代法务与品牌审批。

## 场景执行卡

### 1. 一句话需求升级为可执行 prompt

- 适用：用户只说“高级感海报 / 科技感背景 / 更现代的图”。
- 先查：用途、受众、平台、模型、比例、是否有素材、禁止风格。
- 动作：把抽象词拆成主体、composition、材质、lighting、camera angle、color palette、约束和负向排除。
- 证据：给 2-3 个方向，每个方向说明适合模型、关键变量和审图标准。
- 失败兜底：需求模糊时先列假设；不要只翻译成英文。

### 2. App 图标 / logo / 品牌符号

- 适用：App icon、品牌 mark、logo 概念、启动图标。
- 先查：品牌名、行业、核心隐喻、小尺寸可读性、是否需要字标和商标注册。
- 动作：只保留 1 个主隐喻；强调 clear silhouette、vector-like clarity、balanced negative space、brand consistency。
- 约束：不要让模型生成关键文字；typography 和正式字标后期设计；logo 相似性、copyright、IP 风险需人工复核。
- 复验：16/32/64px 预览、单色版、深浅背景、负空间、可注册性线索。

### 3. 宣传图 / 海报 / 社媒封面

- 适用：产品海报、App Store 素材、官网 hero、活动 KV、小红书/Instagram 封面。
- 先查：卖点、文案区、平台裁切、横竖版、品牌色、是否后期排字。
- 动作：定义 foreground / midground / background，留 safe area for typography，不让模型生成关键文案。
- 约束：画面焦点单一，低噪声背景，避免满屏元素和库存图审美。
- 复验：裁切后主体是否完整，文字区是否干净，移动端缩略图是否可读。

### 4. 接收营销首图 brief

- 适用：project-promo-writer 已给平台、比例、安全区、目标用户、主钩子、封面大字、项目类型、必出界面/实物/证据、禁用文字、授权/AIGC 风险。
- 动作：扩成模型 prompt、negative prompt、参数、2-3 个变体和审图清单；画面服务点击和信任，不追求花哨 AI 感。
- 约束：关键中文标题、logo、价格、法律承诺后期排版；不让模型生成不可复核的案例、评价和收益证明。
- 复验：移动端缩略图、裁切安全区、证据真实性、品牌/IP/肖像/字体授权、AIGC 标识风险。

### 5. 产品摄影 / product render / 商业质感

- 适用：电商主图、产品广告、3D 产品概念、包装渲染、真实产品场景增强。
- 先查：真实外观、材质、logo、尺寸比例、参考图、是否允许夸张表现。
- 动作：写清 lens / focal length / lighting setup / camera angle / surface reflection / product render style。
- 约束：真实商品与品牌元素用 reference image；禁止凭空改产品结构、材质、接口和标识。
- 复验：比例、材质、logo、包装文字、阴影、反射、与品牌图册的一致性。

### 5. 角色 / 人像 / IP 形象

- 适用：角色设定、头像、虚拟人、连续故事图、品牌吉祥物。
- 先查：年龄段、服装、发型、表情、动作、禁区、是否有角色参考图。
- 动作：建立 character consistency：固定面部特征、服装锚点、色彩锚点、姿态范围和 seed / reference image。
- 约束：真实人物、名人、未成年人、肖像权、IP 形象必须走 safety、copyright 和授权复核。
- 复验：脸、手、身份特征、服饰、比例、跨 variation 一致性。

### 6. 参考图改写 / inpainting / outpainting

- 适用：保留主体换背景、扩图、局部重绘、风格统一、同款多角度。
- 先查：哪些必须保留，哪些允许变化，mask 区域、输出比例、边缘衔接。
- 动作：把 reference image 分成 keep / change / avoid；inpainting 只改局部，outpainting 明确延展方向和空白内容。
- 约束：不要用语言要求模型“完全不变”却不给参考图；复杂品牌或产品必须人工审图。
- 复验：边缘接缝、透视、光影、纹理重复、主体身份漂移。

### 7. 模型格式适配

- DALL-E / GPT Image / OpenAI Images：自然语言结构化说明；适合复杂约束、编辑、参考图和短文字相对可控场景，但关键 typography、中文长文案和品牌 logo 仍建议后期排版。
- Midjourney：画面说明在前，参数如 --ar、--no、--sref、--stylize、--seed 放末尾；style reference 与 mood board 要分清。
- SDXL / ComfyUI：positive、negative prompt、size、sampler、CFG、steps、seed 分离；不要臆造用户没有的 LoRA/checkpoint。
- Flux / FLUX Kontext：强调自然语言、主体关系、reference image、keep/change/avoid 和编辑约束；复杂场景用字段化描述。
- Imagen：偏自然语言高质量出图与生态内使用；具体参数、地区和产品入口差异必须按当前平台验证。
- 兜底：不确定参数是否支持时标“需验证”，不要跨模型混用语法；交付证据至少包含模型/版本假设、画面变量、构图理由、参数和审图结论。

### 8. 出图复盘与二次迭代

- 适用：用户说“不高级、不像、跑偏、AI 味重、细节错”。
- 先查：失败属于目标、composition、style reference、材质、lighting、camera、比例、文字、人物、产品还是安全合规。
- 动作：一次只改 2-4 个变量；保留 seed 或保留主 prompt 做 A/B；输出 variation 方案和复验标准。
- 证据：指出失败原因、修正项、negative prompt 变化、预期改善点。
- 禁止：把所有词一次性换掉，导致无法判断哪项有效。

## 高频坑 / 防遗漏

### 高频坑

- 反例 1：只写“高级感、科技感、电影感”，没有主体、composition、材质和 lighting。
- 反例 2：把图标、logo、海报、背景、product render 当同一种 prompt 写。
- 反例 3：style reference、mood board、reference image 混用，导致模型不知保留什么。
- 反例 4：negative prompt 过长或跨模型复制，压掉目标风格。
- 反例 5：aspect ratio 未写，平台裁切后主体或 typography 安全区丢失。
- 反例 6：camera angle、depth of field、焦段和光源冲突，画面像拼贴。
- 反例 7：logo、文字、包装和手部细节不复验，直接当成可发布素材。
- 反例 8：brand consistency 只写品牌名，不给色板、材质、版式、参考资产。
- 反例 9：seed 固定后又大改 prompt，以为还能保持稳定对比。
- 反例 10：inpainting / outpainting 没写 keep / change / avoid，边缘和身份漂移。
- 反例 11：追热门玻璃、霓虹、过度锐化，得到同质化 AI image。
- 反例 12：safety、copyright、IP、肖像、商标没有边界说明。

### 防遗漏清单

- 目标：用途、载体、平台、受众、商业风险是否明确？
- 画面：主体、composition、空间层级、lighting、camera angle、depth of field、材质、color palette 是否齐？
- 约束：aspect ratio、尺寸、空白区、文字、logo、reference image、seed、variation 是否写清？
- 模型：是否按 GPT Image、Midjourney、SDXL、FLUX/ComfyUI 区分格式？
- 复验：是否列出手、脸、文字、产品、品牌一致性、版权与安全检查？

## 输出要求

- 用途定位：图标、logo、背景、海报、封面、产品图、角色图、参考图编辑或其他。
- 视觉方向：现代感来自 composition、材质、lighting、color palette、camera angle 还是品牌系统，而不是空泛形容词。
- 模型格式：说明目标模型、prompt 正文、negative prompt / exclude、参数和需验证项。
- 正向 prompt：可直接复制，包含主体、环境、构图、材质、光线、色彩、风格边界、质量要求。
- negative prompt：只排除会破坏目标的元素；按模型能力输出，不贴万能长串。
- 参数建议：aspect ratio、尺寸、seed、variation、style strength、reference image、inpainting / outpainting 说明。
- 变体方案：至少 2 个方向或 A/B 变量；每轮只改少量关键变量。
- 审图清单：列已覆盖、部分覆盖、无法验证；指出下一轮怎么改。

## 约束

- 不承诺一次出图即终稿；必须按结果迭代。
- 不承诺 AI 生成内容天然可商用；copyright、IP、商标、肖像、字体、平台审核需另行复核。
- 不默认模仿在世艺术家、具体品牌、受保护角色或未授权 style reference。
- 不让模型生成关键法律文本、品牌名、中文长文案；必要文字后期排版。
- 不混用模型参数；Midjourney、SDXL、Flux、DALL-E、Imagen、GPT Image/OpenAI Images 的版本、字段、平台政策和编辑能力变化快，不确定必须标“需验证”。
- 不输出工具百科；优先给 prompt、参数、negative prompt、审图和迭代证据。
- 涉营销发布、真实 SVG、UI 系统、法务合规、API 接入时，切到相邻技能。

## 高频 Bug 反例库

- 反例 1：composition 空泛
   - 错法：高端科技海报，未来感，很多光效。
   - 对法：single hero product centered in foreground, layered background, generous negative space for typography, clear visual hierarchy。
   - 根因：没有构图层级，模型只能堆素材。

- 反例 2：style reference 误用
   - 错法：照着这个品牌风格画一张一模一样的图。
   - 对法：use the reference image only for color palette and material mood, create an original composition, avoid copying protected elements。
   - 根因：参考图用途不清会带来侵权和过拟合。

- 反例 3：negative prompt 万能粘贴
   - 错法：所有任务都加 bad anatomy, lowres, jpeg artifacts, deformed hands, text。
   - 对法：产品海报只排除 watermark、clutter、incorrect logo、distorted packaging、dated stock-photo look。
   - 根因：过长负面词会抢注意力，并且模型支持差异很大。

- 反例 3A：模型语法混用
   - 错法：给 Flux / DALL-E / Imagen prompt 追加 Midjourney --sref、SDXL sampler、CFG、steps。
   - 对法：按目标平台拆格式：Midjourney 写 --ar/--no/--sref；SDXL 写 positive/negative/sampler/CFG；Flux、DALL-E、Imagen 写自然语言约束和 keep/change/avoid。
   - 根因：模型和版本能力不同，混用参数会失效、误导或降低可复验性。

- 反例 4：aspect ratio 漏写
   - 错法：生成小红书封面，高级感。
   - 对法：vertical 3:4 aspect ratio, central subject kept within safe crop, empty upper third for typography。
   - 根因：平台裁切会破坏主体和文案区。

- 反例 5：lighting 冲突
   - 错法：自然阳光、暗黑棚拍、霓虹、柔光、强硬阴影同时出现。
   - 对法：single large softbox from upper left, subtle rim light, controlled reflections, no harsh neon。
   - 根因：光源逻辑冲突会造成拼贴感。

- 反例 6：camera 参数互相打架
   - 错法：wide angle macro portrait with telephoto compression。
   - 对法：85mm portrait lens, eye-level camera angle, shallow depth of field, clean background separation。
   - 根因：镜头语言不一致会破坏空间真实性。

- 反例 7：brand consistency 只写品牌名
   - 错法：做成 Apple 风格，保持品牌一致。
   - 对法：use provided brand color palette, rounded geometry, matte glass material, restrained typography safe area; no copied brand assets。
   - 根因：品牌一致性来自资产规则，不是借名。

- 反例 8：logo/text 直接交给模型
   - 错法：生成清晰中文标题、包装细字和准确 logo，可直接商用。
   - 对法：leave blank typography area, no generated Chinese long copy, no logo generation; place final logo and typography in design software。
   - 根因：中文文字、商标、字体授权和品牌安全仍是高风险交付点。

- 反例 9：hands/face 未约束
   - 错法：人物拿产品微笑，细节自然。
   - 对法：hands visible but relaxed, correct finger count, natural skin texture, face symmetry, avoid waxy skin and distorted eyes。
   - 根因：人像高风险细节需要单独审图。

- 反例 10：product render 失真
   - 错法：按想象生成一台新手机，带真实品牌标识。
   - 对法：use reference image for exact product shape and logo placement, preserve proportions, update only lighting and background。
   - 根因：产品结构和标识不能靠模型脑补。

- 反例 11：seed / variation 误解
   - 错法：固定 seed 后把主体、风格、比例全改，还要求一致。
   - 对法：keep seed and core prompt, change only color palette or lighting in each variation。
   - 根因：seed 只帮助对比，不保证大改后身份稳定。

- 反例 12：copyright / IP 越界
   - 错法：画一个迪士尼同款角色，用某在世艺术家风格。
   - 对法：create an original friendly mascot, avoid protected characters, no living artist imitation, mark copyright/IP review required。
   - 根因：受保护风格和角色不能当快捷提示词。

- 反例 13：safety 漏判
   - 错法：生成逼真证件、医疗前后对比、投资收益截图。
   - 对法：avoid deceptive documents, medical claims, financial proof; add safety review before publishing。
   - 根因：平台安全与误导性内容会影响发布。

- 反例 14：迭代评估不可追踪
   - 错法：不满意就重写完整 prompt。
   - 对法：record current output issue, modify composition and lighting only, compare A/B against original seed。
   - 根因：没有变量控制，就没有可复验改进。

## 提交前自检清单

- [ ] 行数 < 500。
- [ ] 无 fenced code block。
- [ ] 必需章节齐全：快速总则、场景执行卡、高频坑 / 防遗漏、输出要求、约束、高频 Bug 反例库、提交前自检清单、2024-2026 新坑速查、与相邻技能的边界。
- [ ] 高频 Bug 反例库不少于 10 条，且覆盖 composition、style reference、negative prompt、aspect ratio、lighting、camera、brand consistency、logo/text、hands/face、product render、seed/variation、copyright/IP、安全、迭代评估。
- [ ] 核心关键词齐全：AI image、prompt、positive prompt、negative prompt、Midjourney、SDXL、Flux、DALL-E、Imagen、composition、style reference、mood board、aspect ratio、lighting、camera angle、depth of field、color palette、brand consistency、logo、typography、product render、character consistency、seed、variation、inpainting、outpainting、reference image、safety、copyright、IP。
- [ ] 已按目标模型拆格式，未混用参数。
- [ ] 已列审图证据和无法验证项。

## 2024-2026 新坑速查

- 版本坑：Midjourney、SDXL、Flux、DALL-E、Imagen、GPT Image 的参数名、编辑入口、文字能力和安全策略在 2024-2026 持续变化；不确定时必须标“需验证”并转 research 查证。

- 参考图能力增强：GPT Image、DALL-E、Flux Kontext、Imagen 等更依赖 reference image 语义；必须写 keep / change / avoid，否则身份和产品会漂移。
- 审美同质化：玻璃、霓虹、粒子、过度锐化泛滥；修法是回到 composition、真实材质、克制 lighting 和明确用途。
- 文字能力提升但不等于可交付：DALL-E/GPT Image/Imagen 短字可能可用，品牌 logo、中文长文案、法律文本、包装细字仍需人工 typography。
- style reference 风险上升：平台和客户更关注版权、IP、在世艺术家、品牌近似；必须改成原创方向和 mood board 级别参考。
- 产品图监管加强：虚假外观、夸大功能、错误包装、未授权商标更易触发 safety 与广告合规问题。
- 角色一致性仍不稳定：character consistency 需要参考图、固定锚点、seed、分轮 variation 和人工筛选。
- outpainting 接缝常见：扩图时注意透视、阴影、纹理重复和边缘连续性。
- negative prompt 不是越长越好：现代模型对自然语言排除更敏感，长串旧 SD 负面词可能伤害质量。
- 平台比例碎片化：小红书、Instagram、短视频封面、App Store/Google Play 商店素材和官网 hero 需要不同 aspect ratio 与安全区。
- 合成图可识别性：过度平滑皮肤、塑料材质、重复纹理、错误手指和伪文字仍是 AI image 常见破绽。

## 与相邻技能的边界

- 本技能负责：AI 生图 prompt、positive prompt、negative prompt、模型格式、composition、style reference、mood board、reference image、审图、seed / variation、inpainting / outpainting 策略和生成到编辑闭环。
- 不负责：营销定位、平台文案、标题和获客链路 → project-promo-writer / product-marketing；营销发布与平台运营 → ai-content-marketing / social-media-ops；真实 SVG 与图标系统 → icon-design；UI 视觉规范 → design-director / ui-design；法律合规、商标、copyright、IP、肖像 → legal-counsel；生图 API、ComfyUI 工作流、模型路由、评测和自动化 → ai-engineering / 对应开发技能；外部模型版本和平台政策不确定 → research。
- 协作：本技能只给提示词和复验标准；涉及商业发布、品牌资产、真实产品、人物肖像或工程落地时，必须联动相邻技能并以实际生成结果复验。