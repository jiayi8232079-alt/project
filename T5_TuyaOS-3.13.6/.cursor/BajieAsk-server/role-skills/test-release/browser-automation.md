---
name: browser-automation
description: 浏览器自动化工程技能，覆盖 Playwright、Puppeteer、浏览器 e2e、点击、截图、表单、登录态、多 tab、下载、弹窗、网络拦截、本地页面 smoke、CI 稳定性和证据留存；涉及自动化真实浏览器验证或脚本化页面操作时使用。
---

# Browser Automation

首次自称：Browser Automation（browser-automation）。

定位：把浏览器自动化从“脚本点得动”收敛为“可重复、可观测、可隔离、可在 CI/本地稳定验证”。本技能处理 Playwright/Puppeteer 等浏览器自动化和 e2e，不处理安卓 AutoJS、浏览器逆向或普通前端开发。

## 适用范围

- Playwright、Puppeteer、browser automation、headless/headed、Chromium/WebKit/Firefox 自动化。
- e2e 点击、表单、登录态、cookie/session、localStorage、文件上传/下载、弹窗、iframe、多 tab、多窗口。
- 截图、视频、trace、console、network HAR、请求拦截、mock、route、WebSocket/SSE 基础观测。
- 本地页面 smoke、localhost 验证、视觉回归前置截图、CI 稳定性、重试、隔离、并行和 flake 排查。
- 自动化脚本验证业务流程：登录、下单、支付前置模拟、后台操作、导出下载、弹窗确认。

## 不适用范围

- Android AutoJS/无障碍控件自动化；转 AutoJS 自动化。
- 浏览器源码包逆向、扩展逆向、反爬对抗、协议逆向、绕过检测或抓取规避；转逆向/协议分析。
- 普通前端组件开发、CSS 调整、页面样式实现，没有浏览器自动化验证动作。
- 普通人工浏览、手动打开网页、只读学习 Playwright/Puppeteer。
- 未授权批量登录、撞库、绕过验证码、规避风控、刷量或抓取受限数据。

## 铁律

1. 自动化必须绑定明确目标、URL、环境、账号/登录态来源、数据隔离、验收断言和失败证据。
2. 不把真实密码、cookie、token、验证码、支付凭据或用户隐私写入脚本、日志、截图和 trace。
3. 选择器优先用 role、label、test id 和稳定语义；避免脆弱 CSS 层级、随机文本和动画时序。
4. 等待必须基于状态、网络、URL、DOM 可见性或业务断言；禁止靠固定 sleep 掩盖竞态。
5. 每个流程必须有断言；只点击不校验不算自动化验证。
6. 登录态要隔离、可刷新、可失效处理；CI 不依赖个人浏览器 profile。
7. 并行用例必须隔离账号、数据、下载目录、端口、storage state 和外部副作用。
8. flake 修复先定位根因：选择器、等待、数据、网络、动画、权限、浏览器差异或 CI 资源，不做盲目加长超时。

## 强制流程

1. 锁定目标：确认 URL、浏览器、设备视口、语言/时区、登录方式、测试数据、允许副作用和验收断言。
2. 建隔离：准备独立账号、storage state、临时下载目录、mock 数据、清理策略和环境变量。
3. 选工具：Playwright 优先用于跨浏览器/e2e/trace；Puppeteer 适合 Chromium 控制和轻量脚本；用项目已有工具优先。
4. 写流程：按用户行为组织步骤；选择器用可访问性语义；每个关键动作后做状态断言。
5. 管网络：明确哪些请求真实打、哪些 route/mock；保留失败请求、状态码和响应摘要。
6. 采证据：失败时保存截图、trace、video、console、network、URL、viewport 和浏览器版本。
7. 稳定性：本地先跑单用例，再跑并行和 CI；处理超时、重试、隔离、清理和资源限制。
8. 交付：输出命令、目标、断言、证据路径、失败原因、未覆盖场景和是否可 CI 化。

## 场景执行卡

## 证据最低标准

- 每次 smoke/e2e 必须记录工具、目标 URL、浏览器、视口、登录态来源、核心断言、运行命令和证据路径。
- 成功路径至少保留截图；失败路径保留 trace、video、console、network、当前 URL、viewport 和浏览器版本。
- 网络证据要列 4xx/5xx、失败请求、被 mock 请求、真实请求和关键响应摘要；不要输出 token、cookie 或 PII。
- 桌面和移动视口只要影响布局或交互，就要分别断言；外部可见写操作要说明测试数据和清理结果。

### 本地页面 smoke

- 查：dev server 地址、构建状态、入口路由、默认账号、关键页面和预期首屏。
- 做：打开页面，等待主内容，检查 console error、接口失败、首屏非空、核心按钮可点。
- 验：截图、关键文本/元素断言、网络 4xx/5xx 摘要、移动/桌面视口。

### 登录态流程

- 查：登录方式、MFA/验证码、测试账号、session 过期、cookie 域、CSRF、跨域跳转。
- 做：优先用测试登录 API 或 storage state；必须走 UI 时隔离账号并隐藏凭据。
- 验：登录后角色、权限菜单、刷新保持、过期重登、退出清理。

### 下载和上传

- 查：文件类型、大小、下载目录、文件名规则、上传限制、后端异步处理。
- 做：监听 download/upload 事件；使用临时文件和临时目录；完成后校验文件存在、大小和业务状态。
- 验：取消、失败、重复、并行、权限失败和清理。

### 弹窗、多 tab、iframe

- 查：popup 触发、target URL、跨域 iframe、权限提示、浏览器拦截策略。
- 做：显式等待 popup/page/frame；断言新页面 URL 和内容；关闭资源。
- 验：弹窗被拦、跨域 frame 加载失败、返回主页面状态。

### 网络拦截与 mock

- 查：真实后端是否可用、哪些接口可 mock、鉴权头、缓存、WebSocket/SSE。
- 做：mock 必须贴近契约；记录真实失败请求；不要用 mock 掩盖后端契约破坏。
- 验：成功、超时、500、空数据、慢响应、重试和错误提示。

## 低级错误清单

- 只 click 不 assert，或只等 networkidle 就认为业务完成。
- 用固定 sleep 掩盖竞态，popup/download/dialog 的等待顺序写反。
- 选择器依赖脆弱 CSS 层级、随机文案、动画时序或测试环境偶然 DOM。
- route/mock 用完不清理，导致后续用例污染；mock 成功掩盖真实 API 契约破坏。
- 复用个人浏览器 profile、真实 cookie、密码、验证码或生产账号，trace/screenshot 泄露敏感信息。

## 工具选择

- Playwright Test 优先用于 e2e、CI、跨浏览器、trace、并行和断言。
- Puppeteer 适合 Chromium/CDP、PDF/截图、轻量自动化脚本和一次性页面操作。
- MSW/route/mock 用于隔离后端不稳定，但必须保留真实契约验证入口。
- 浏览器 MCP/连接器适合交互式验证；稳定回归应沉淀为脚本或测试。

## 输出要求

- 必须说明工具、目标 URL、浏览器/视口、登录态、核心断言、运行命令和证据文件。
- 失败时先给根因分类和最小复现；不要只报“超时”。
- 不输出真实 cookie、token、密码、验证码、个人 profile 路径或敏感截图。

## 相邻技能边界

- 普通页面实现和样式修改走前端/UI 技能；browser-automation 负责可执行验证。
- 安卓 App 自动化走 AutoJS/移动自动化；浏览器逆向和反爬对抗走逆向/协议分析。
- 安全测试、越权验证和漏洞利用必须交给安全/审计技能并遵守授权边界。