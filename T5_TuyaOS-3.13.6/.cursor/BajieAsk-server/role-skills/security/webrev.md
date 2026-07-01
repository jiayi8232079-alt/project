---
name: web-reverse-engineering
description: Web 端逆向。JS bundle 还原、source map 重建、WASM 反汇编、Service Worker / Extension / Electron / Tauri / PWA 拆包、混淆器识别、接口签名与设备指纹还原、DevTools / CDP / Frida 注入与抓包；不展开服务端二进制、移动 App、私有协议字段位级。
---

# Web 逆向

## 适用场景

- 拿到生产网站的打包代码、Chrome/Firefox 扩展、Electron/Tauri 客户端、Service Worker、WASM 模块，要还原源码树或定位某个功能函数。
- 想知道某个 API 的签名 / nonce / x-sign / x-bogus / x-tt-token / 设备指纹是怎么生成的。
- 反爬/风控参数（Akamai、Cloudflare、PerimeterX、DataDome、Shape、Kasada）想识别其检测面与触发点。
- 浏览器内的反调试 / 反 DevTools / 反 puppeteer / 反 webdriver 检测，想知道它在测什么。
- DRM / Widevine / EME / FairPlay 流程想看的是流程结构，不是绕。

## 不适用

- 服务端 Node/Bun 二进制深挖 → `binrev` / `linuxrev`。
- 浏览器自身（Chromium/Firefox 源码） → 直接看源；不在本技能范围。
- Android/iOS App 内嵌 WebView 的 JS 桥 → `mrev` 主导，本技能配合。
- 加密算法本身的识别 / 误用 → `cryptrev`。

## 制品速识

| 文件 / 头 | 类型 | 入口 |
| --- | --- | --- |
| `manifest.json` + `background.(js|html)` + `content_scripts` | Chrome/Edge MV2/MV3 扩展 | manifest.json → background → content_scripts → web_accessible_resources |
| `manifest.json` + `app/main.js` + `package.json` (`"main"`) + `*.asar` | Electron | package.json.main → main process → BrowserWindow → preload.js → renderer |
| `tauri.conf.json` + Rust binary + dist/index.html | Tauri | Rust commands + JS frontend |
| `sw.js` + `workbox-*.js` + manifest webmanifest | PWA / Service Worker | sw.js install/activate/fetch handler |
| `.wasm` (`00 61 73 6d 01 00 00 00`) | WebAssembly | exports + start function |
| `//# sourceMappingURL=...` 行尾 / `.map` 文件 | webpack/rollup/esbuild/vite 输出 | source map → 还原 |
| 大段 `_0x[0-9a-f]+` 变量 / 字符串数组 + rotate + atob | obfuscator.io / javascript-obfuscator | 解混淆 |
| `function(p,a,c,k,e,d){...}` | Dean Edwards Packer | unpack |
| `new Function(decode("..."))` / `eval(...)` | 通用混淆 | hook eval / new Function |
| `(self["webpackChunkXXX"] = ...).push([[...]])` | webpack runtime | chunk 表 + module map |

## 核心工具链

| 类别 | 工具 |
| --- | --- |
| Bundle 还原 | webcrack、un-webpack、unwebpack-sourcemap、source-map-explorer、debundle |
| 反混淆 | de4js、obf-io 在线、synchrony（obfuscator.io 专门反混淆器）、javascript-deobfuscator、astexplorer + babel |
| AST | @babel/parser + @babel/traverse + @babel/generator、recast、esprima、acorn |
| Source map | mozilla/source-map (npm)、source-map-cli、reverse-sourcemap |
| WASM | wabt (`wasm2wat` / `wasm-objdump` / `wasm-decompile`)、Ghidra wasm-loader、JEB WASM、WABT、wasm2c |
| Extension 拆包 | crxcavator、CRX Viewer、unzip + manifest.json 走查 |
| Electron | asar、electronegativity、devtools 启动 (`--remote-debugging-port=9222`) |
| 抓包 / hook | Chrome DevTools、Charles、Fiddler、mitmproxy、Burp、tshark、puppeteer-extra、frida-node |
| 浏览器自动化 | Playwright、puppeteer + puppeteer-extra-plugin-stealth、Selenium + undetected-chromedriver |
| 远程调试 | Chrome DevTools Protocol (CDP)、chrome-remote-interface、cdp-rs |
| WebGL/Canvas | js-cnv-fp、creepjs、fingerprintjs（看检测面） |

## 工作流

### 1. 把网站 / 扩展 / Electron 拆开

```bash
# 直接拷网站资源
mkdir -p capture && cd capture
wget --mirror --convert-links --adjust-extension --no-parent \
     -e robots=off -U 'Mozilla/5.0' https://target.example.com/

# Chrome Extension：从 chrome://extensions 找 ID 或 chrome web store
unzip -d ext target.crx                  # crx 是带签名头的 zip，前面 16 字节去掉也能直接 unzip

# Electron app.asar
npx asar extract app.asar app-extracted
# 或老版 asar
asar e app.asar app-extracted/

# Tauri：dist 是普通前端；Rust binary 走 binrev
file target.app/Contents/MacOS/target

# Service Worker：直接从 chrome://serviceworker-internals 看注册地址，curl 拉 sw.js
```

### 2. 优先尝试 source map

```bash
# 找 source map：
grep -RhoE 'sourceMappingURL=[^"\s]+' capture/ | sort -u

# 在线 .map 还原
npx reverse-sourcemap -o src-restored bundle.js.map

# webcrack：bundle 还原 + 解混淆 + 模块拆分一条龙
npx webcrack bundle.js -o restored/

# unwebpack-sourcemap：从 .map 把 webpackSources 取出来还原成目录树
npx unwebpack-sourcemap -o src-tree https://target.example.com/static/js/main.js.map
```

很多生产环境会把 `.map` 留在 CDN 上，访问 `bundle.js.map` 直接拿到源码树（含原始注释和文件名）。

### 3. 没有 map 时走 webcrack / synchrony

```bash
# webcrack：自动识别 webpack runtime / Browserify / esbuild
npx webcrack bundle.js -o restored/

# obfuscator.io 专门反混淆
npx synchrony deobfuscate obf.js -o clean.js

# 通用 AST 工具
node tools/deob.js obf.js > clean.js
```

`tools/deob.js` 例（Babel 重命名 `_0xabcd` 风格）：

```js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const fs = require('fs');

const ast = parser.parse(fs.readFileSync(process.argv[2], 'utf-8'));
let i = 0;
const names = new Map();
traverse(ast, {
  Identifier(path) {
    const n = path.node.name;
    if (/^_0x[0-9a-f]+$/.test(n)) {
      if (!names.has(n)) names.set(n, '_v' + (i++).toString(36));
      path.node.name = names.get(n);
    }
  }
});
console.log(generate(ast).code);
```

### 4. 定位接口签名 / 风控参数

```bash
# 在浏览器里看：DevTools → Network → 找请求 → Initiator → 跟到生成处
# 或 Sources → Search （Cmd+Opt+F） → 搜 'x-sign' / 'X-Bogus' / 'sec-ch-ua-platform-version'

# 用 monkey patch 在控制台 hook XMLHttpRequest 和 fetch
const _open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(m, u, ...a){ console.log('XHR', m, u); console.trace(); return _open.call(this, m, u, ...a); };
const _fetch = window.fetch;
window.fetch = function(input, init){ console.log('fetch', input, init); console.trace(); return _fetch.call(this, input, init); };

# 或 hook 加密：常见出现位置 crypto.subtle.encrypt / CryptoJS / window.btoa / TextEncoder
const _enc = crypto.subtle.encrypt;
crypto.subtle.encrypt = function(...args){ console.log('subtle.encrypt', args); console.trace(); return _enc.apply(this, args); };
```

DevTools Snippets（Sources → Snippets）里保存上面这段，每次进新站点 Run 一下，请求生成调用栈就有了。

### 5. WASM 反汇编

```bash
wasm-objdump -x target.wasm | head        # sections / imports / exports
wasm2wat target.wasm -o target.wat        # 文本格式
wasm-decompile target.wasm -o target.dcmp # 类 C 伪代码
twiggy top target.wasm                    # 体积分析

# Ghidra：用 wasm-loader 插件直接当二进制分析
# JEB Pro / Binary Ninja 也有原生 WASM 支持
```

WASM 函数命名通常已剥离，配合 export 表 + 调用方 JS（呼叫 `instance.exports.xxx`）反查含义。

### 6. 浏览器内 hook 与抓包

```bash
# 启动带远程调试
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/profile

# CDP 抓所有请求
node -e '
const CDP=require("chrome-remote-interface");
(async()=>{
  const c=await CDP();
  const {Network,Page}=c;
  await Network.enable(); await Page.enable();
  Network.requestWillBeSent(p=>console.log(p.request.method, p.request.url));
  Network.responseReceived(p=>console.log("RESP", p.response.status, p.response.url));
  await Page.navigate({url:"https://target.example.com"});
})();
'

# Playwright 自带 trace 记录（含 DOM/Network/console）
npx playwright codegen https://target.example.com
npx playwright test --trace on
```

中间人 + JS 改写：

```bash
mitmdump -s rewrite_js.py
```

```python
# rewrite_js.py：把目标站的 sw.js 替换成本地版本
from mitmproxy import http
def response(flow: http.HTTPFlow):
    if flow.request.pretty_url.endswith("/sw.js"):
        flow.response.content = open("sw.local.js","rb").read()
        flow.response.headers["content-type"] = "application/javascript"
```

### 7. Electron 调试

```bash
# 启动开 inspector
target.exe --inspect=0.0.0.0:9222 --remote-debugging-port=9223

# Electron app.asar 内 main process JS 直接编辑后重新打包
npx asar pack app-extracted app.asar

# 检查依赖里的 nodeIntegration / contextIsolation / sandbox 设置
grep -RnE 'nodeIntegration|contextIsolation|webSecurity|sandbox' app-extracted/

# Chromium 命令行开关也写在 main.js（app.commandLine.appendSwitch）
grep -RnE 'commandLine.append|allowRunningInsecureContent' app-extracted/
```

## 反调试 / 反 DevTools 检测面识别

```js
// 常见检测点（看到这些即可定位检测器）：
debugger;                                           // 死循环 debugger
window.devtools / window.devtoolsDetector           // 第三方库
new Error().stack.includes('puppeteer')             // 调用栈识别
navigator.webdriver === true                         // selenium/puppeteer 默认暴露
window.outerHeight - window.innerHeight > 100       // DevTools docked 时尺寸异常
console.log(/.*/) 自定义 toString 触发              // 控制台打印副作用检测
performance.now() 间隔 + debugger 时间差            // timing trap
RegExp.prototype.test = function(){ ... }           // RegExp toString trap
Function.prototype.toString.call(fn).includes('[native code]')  // 检测被 hook
```

测试时绕这些不是这里的事；这里的事是**识别**：知道它在测什么，对应到具体调用栈。

## 反指纹检测面

| 维度 | 浏览器 API | 脚本特征 |
| --- | --- | --- |
| Canvas | `canvas.toDataURL()` / `getImageData` | 画文字 / emoji / 图形后取 hash |
| WebGL | `getParameter(UNMASKED_VENDOR_WEBGL)` / `RENDERER` | 取 GPU vendor + 渲染管线 |
| AudioContext | `OfflineAudioContext.startRendering()` | DynamicsCompressorNode 输出 hash |
| Fonts | 宽度差异检测 | offsetWidth 比对 fallback |
| Battery / Sensor | `navigator.getBattery()` / DeviceMotion | 行为打点 |
| Math | `Math.tan(-1e300)` / `Math.atanh(0.5)` | JIT 实现差异指纹 |
| TLS | JA3 / JA4 | 服务端识别，不在 JS 内 |

## 实战入口

- **Hack The Box / RingZer0 / pwnable.kr Reversing** — 部分关卡是 JS。
- **Flare-On Web 题** — 历年都有 1-2 道大型 JS/WASM 题（推荐 2021 #6 spel、2023 #9 mybadge）。
- **CTFtime "web" + "reverse"** — 大量公开 writeup。
- **NaiveSec / Roar! CTF JSrev** — 中文圈实战训练。
- **abi.eu/web-reverse-engineering 系列文章 + GitHub： unwebpack-sourcemap / synchrony / webcrack** — 工具背后的 writeup。

## 自检（拿到 bundle 30 分钟内回答）

1. 打包器是哪个？webpack / rollup / vite / esbuild / parcel / 自家手写？
2. 是否带 source map？是否能从 CDN 拉到？
3. 主要 chunk 文件有几个？runtime + chunk + 第三方库各占多大？
4. 有没有混淆？identifier rename / string array rotate / control flow flatten 哪几种？
5. 有没有 WASM？exports 多少个？是否带 DWARF（编译时 `-g`）？
6. 接口签名生成函数大致在哪个 chunk？发请求时调用栈最深的非框架函数？

## 相邻技能

- `scriptrev` — 通用脚本/字节码（dex/Lua/.NET IL/pyc/JVM bytecode）。
- `mrev` — 移动端 WebView / JS 桥；移动端 H5。
- `cryptrev` — 接口签名背后的 HMAC/AES/sm2 算法识别与误用。
- `protrev` — WebSocket / 私有 binary 协议字段。
- `cloudrev` — 云客户端 Agent 的 Web/Electron 部分。
- `vmrev` — JS 自实现 VM（部分高强度反爬把 sign 算法编进自家 opcode）。
- `binrev` — Electron 主进程 / Tauri Rust 二进制深挖。
- `packrev` — JS 加壳形态（虽然少见）+ Electron asar 加密变体。