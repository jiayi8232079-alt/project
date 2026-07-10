# 涂鸦 AI 陪伴硬件接入「陪了个伴」完整开发清单

> 目标：自研一款 AI 陪伴硬件（基于涂鸦 TuyaOS / Wukong AI 框架），全程只用「你自己的 App」（Flutter）+ 你现有的 NestJS 后端，通过涂鸦云打通。
> 结论分级：本清单基于涂鸦官方文档实证核验（developer.tuya.com）。涉及价格/认证以涂鸦商务与当地法规最新口径为准。

---

## 0. 总览架构

```
[AI 陪伴硬件]  ← Wukong/TuyaOS 固件(C)，本地烧录+授权
     ↕ 设备联网（Wi-Fi/4G）
[涂鸦云 IoT 平台]  ← 产品(PID)+功能点(DP)+资产/用户+消息队列+AI大模型
     ↕ App SDK 配网 / OpenAPI + 消息订阅
[你的代码]  Flutter App（内嵌涂鸦SDK桥接） + NestJS 后端(OpenAPI) + 管理后台
```

三层各写各的，**唯一连接点是涂鸦云**；你的 App/后端代码不与固件合并。

### 团队角色（至少需要）
- 固件工程师：TuyaOS / Wukong（C 语言、嵌入式）
- 原生工程师：写 Flutter↔涂鸦 SDK 的 Android(Kotlin)+iOS(Swift) 桥接
- 后端工程师：NestJS 接 OpenAPI + 消息订阅（你现有团队）
- App 工程师：Flutter（你现有团队）

---

## 1. 阶段一：账号与平台准备

- [ ] 注册**涂鸦开发者账号**（建议企业认证，量产/商用必需）
- [ ] 注册 **PMS 生产管理账号**（量产烧录授权用）
- [ ] 费用预案（重要）：
  - 智能生活 App SDK：开发版**免费**（限 100 注册用户 + 100 万次/月请求，**仅调试不可商用**）；正式版**按年收费**，首年约 ¥33500（$5000），次年约 ¥13000（$2000）
  - AI 大模型调用费（按 token/次）
  - 模组采购 + 量产授权码费用 + 认证费用

---

## 2. 阶段二：涂鸦云端配置（无需 Linux，浏览器即可）

### 2.1 创建产品
- [ ] 涂鸦 IoT 平台「产品开发」→ 创建产品 → 选品类（AI 硬件/其他电工）
- [ ] 选择**联网方案/模组**（带音频的 Wi-Fi 或 4G 模组；Wukong AI 需音频能力）
- [ ] 拿到 **PID**（产品唯一 ID）
- [ ] 定义**功能点 DP**：语音对话、SOS 报警、电量、提醒播报、定位、（健康数据需对应传感器）等

### 2.2 创建云开发项目（自定义开发）
- [ ] 「云开发」→ 创建项目 → 拿 **Access ID / Access Secret**
- [ ] 建**资产树**（最多 5 层空间结构）
- [ ] 创建**用户**并**授权到资产节点**（权限隔离）
- [ ] 关联 **PID** 到云项目
- [ ] 开通所需 API 产品：IoT Core、设备控制、行业通用 API、**消息订阅（消息队列/Pulsar）**

### 2.3 创建 App SDK 应用（给你自己的 App 用）
- [ ] 「App SDK」→ 创建 App → 选「智能生活 App SDK」
- [ ] 填：应用名 + **安卓包名**(applicationId) + **iOS BundleID**
- [ ] 拿 **AppKey / AppSecret**
- [ ] Android：绑定 **SHA256** 密钥（v3.29.5+ 必需；4.0.0+ 包名必须与工程一致，否则 ILLEGAL_CLIENT_ID）
- [ ] iOS：下载**安全图片 `t_s.bmp`**，BundleID 必须匹配
- [ ] 配置 **PID↔App 双向绑定**：PID 允许该 App 绑 + App 允许该 PID 接入（两边都配才能配网）

---

## 3. 阶段三：开发环境（仅固件编译需要）

- [ ] **Tuya Wind IDE**（VS Code 插件，图形界面，非裸终端）
- [ ] **Linux 环境**：Ubuntu 20.04+（本地免费虚拟机 VirtualBox/VMware，建议 8G 内存/50G 磁盘；或腾讯云 Ubuntu 当编译机；macOS 可用 TuyaOpen）
  - 依赖：`sudo apt install openssh-server openssh-client build-essential lib32stdc++6`
- [ ] **USB 转串口驱动**（识别开发板串口）
- [ ] Wind IDE 登录涂鸦账号 → 下载 **Wukong AI 硬件开发框架**

> 注意：云/App/小程序对接**完全不用** Linux；只有固件编译需要。

---

## 4. 阶段四：固件开发 + 编译 + 烧录（精细）

### 4.1 获取框架与填授权
- [ ] Wind IDE「Tuya Home」→ 下载/导入 Wukong AI 开发框架
- [ ] 基于 `tuyaos_demo_wukong_ai` demo 修改
- [ ] **开发期授权**：打开 `tuya_app_main.c`，填入宏 `UUID` 和 `AUTHKEY`（用申请的授权码替换），程序运行时自动把授权写入模组
  - 开发期可领**免费调试授权额度**；特点是「授权一次，重复烧录」

### 4.2 编译固件
- [ ] 资源管理器找到 `software/TuyaOS/apps/tuyaos_demo_wukong_ai`
- [ ] 右键 → **Build Project** → 输入版本号（x.x.x）回车
- [ ] 首次编译会拉工具链 + 建虚拟编译环境，耗时较长
- [ ] 产物：`software/TuyaOS/apps/tuyaos_demo_wukong_ai/output/<版本>/tuyaos_demo_wukong_ai_QIO_<版本>.bin`

### 4.3 烧录固件（开发期，仅 Windows 主机操作）
- [ ] **硬件连线**（USB 转 TTL）：`TX→RX`、`RX→TX`、`GND→GND`、`3.3V→3.3V`
- [ ] 开发板用 Type-C 连 PC；若用虚拟机，把串口映射到 Linux：
  - VMware：菜单「虚拟机 > 可移动设备 > 选 QinHeng USB Dual_Serial > 连接」
  - 首次需 `sudo usermod -aG dialout $USER` 然后**重启虚拟机**再连接
- [ ] 右键生成的 `*_QIO_*.bin` → **Flash App**
- [ ] 选串口（一般 `ttyACM0`）
- [ ] 若终端停在 `Waiting Reset ...` → **手动按开发板 RST 复位键**（部分芯片不支持自复位）
- [ ] 终端出现「烧录完成」即成功
- **Flash App** = 只擦**用户区**（日常更新代码用）；**Flash Prod** = 擦**所有区域**

### 4.4 量产烧录授权（发布阶段）
- [ ] **注释掉** `tuya_app_main.c` 里的授权宏（避免多设备共用同一授权码）
- [ ] 编译固件 → **上传涂鸦开发者平台** → 上架
- [ ] 下单/领取授权（两种交付）：
  - **生产凭证(Token)**：一串字母，用涂鸦**云模组烧录授权工具**解析写入；分「生产凭证(固件+授权)」与「生产凭证-仅授权」；下单需提供正确 **PID + 固件Key + 版本号**
  - **授权码清单**：Excel(UUID+AuthKey)，自己写脚本逐个写入设备
- [ ] 工具：安装**涂鸦生产解决方案**软件 → 进入**云模组**烧录授权工具（需 PMS 账号）
- [ ] 烧录授权操作：云模组工具输入生产凭证 → 选工位/串口 → 单击「运行」→ **立即给模组断电再上电或按复位** → 开始烧录授权
- [ ] 一体方案：云模组工具同时烧固件+授权码；分立方案：原厂工具烧固件 + 云模组工具「只授权」
- [ ] 权限报错 → 登录 PMS「生产管理 > 工单管理」确认生产凭证

---

## 5. 阶段五：App 集成（Flutter 原生桥接）

> 涂鸦 App SDK **只有 iOS/Android 原生版，无官方 Flutter SDK** → 需自建 Flutter plugin 桥接（参考官方 demo `tuya/tuya_flutter_login_plugin_demo`）。

### 5.1 桥接工程
- [ ] 建 Flutter plugin，Android 用 Kotlin、iOS 用 Swift 各包一层涂鸦 SDK
- [ ] Android：配置 AppKey/AppSecret（AndroidManifest `THING_SMART_APPKEY`/`THING_SMART_SECRET`）、SHA256；`minSdkVersion>=21`
- [ ] iOS：BundleID 对齐、放入安全图片 `t_s.bmp`、CocoaPods 集成、iOS>=11
- [ ] 注意：原生 .so 仅 arm（x86 模拟器跑不了，用真机/arm 模拟器）

### 5.2 需桥接的方法清单
- [ ] SDK 初始化（init）
- [ ] 账号：注册 / 登录 / 登出（与你自有账号做映射）
- [ ] 家庭管理：创建家庭、获取 homeId
- [ ] 配网：EZ 快连 / AP 热点 / 蓝牙 / 扫码（`ThingSmartActivator`，从云端取配网 Token，需在线且已建家庭）
- [ ] 设备：设备列表、设备详情、下发控制
- [ ] 回调：配网结果（onActiveSuccess/onError/onBind/onFind）、设备状态变更

### 5.3 配网流程（用户在你的 App 内完成）
1. 用户登录（你的账号 → 映射涂鸦账号）→ 确保已建家庭
2. App 取配网 Token（SDK 内部向云端申请，10 分钟有效）
3. 输入 Wi-Fi SSID/密码 → SDK 广播 → 设备激活上云 → 绑定到该用户家庭/资产
4. 注意**绑定模式**（强/中/弱）影响换人/二次绑定

---

## 6. 阶段六：后端集成（NestJS）

### 6.1 新增 `tuya` 模块
- [ ] 鉴权：Access ID/Secret + **HMAC-SHA256 签名** 换 access_token（带刷新/时钟同步）
- [ ] 设备控制：`POST /v1.0/devices/{device_id}/commands`
- [ ] 设备状态/历史：查设备在线、DP 值、日志
- [ ] 用户/资产：创建用户、授权资产、绑定设备（自定义开发模型）
- [ ] 配网令牌：`POST /v1.0/device/paring/token` / 查询 `GET /v1.0/device/paring/tokens/{token}`

### 6.2 消息订阅（实时数据）
- [ ] 订阅涂鸦**消息队列（Pulsar）**：设备上下线、DP 变更、SOS、健康数据
- [ ] 落库（MySQL）→ 复用你现有 **Socket.io** 实时推给家属/陪护端 + 触发工单

### 6.3 数据表（建议）
- [ ] `tuya_user_map`（你的 userId ↔ 涂鸦 uid）
- [ ] `tuya_device`（devId、PID、归属用户、状态、绑定模式）
- [ ] `device_event`（SOS/健康/对话事件流水）

---

## 7. 阶段七：联调与测试

- [ ] 端到端：固件烧录 → 配网上云 → App 控制 → 后端拉数据 → 推送闭环
- [ ] 负向：弱网配网、配网超时、Token 过期、解绑/换绑、设备离线
- [ ] 账号映射一致性（多端同一账号同一设备）
- [ ] 安全：密钥不进前端/日志；健康/隐私数据脱敏

---

## 8. 阶段八：量产 / 认证 / 上线

- [ ] 模组采购 + 打样 + 小批量验证（先做原型，别直接铺量产）
- [ ] **认证**：3C、无线电型号核准 **SRRC**（含无线模块必需）、其他品类认证
- [ ] **App SDK 正式版**年费开通（上架商用必需）
- [ ] App 上架（应用商店）+ 隐私合规（个人信息保护法：老人健康/摄像头隐私）
- [ ] 量产授权码备货 + 产测工艺路线

---

## 9. 关键坑 / 检查清单

- [ ] 配网激活**只能**用涂鸦 App SDK / 涂鸦系 App / 小程序 SDK——纯后端无法配网
- [ ] PID 与 App **双向绑定**没配 → 配网失败
- [ ] 包名/BundleID/SHA256/AppKey/AppSecret/安全图片 任一不匹配 → SDK 直接不可用
- [ ] 量产忘了注释授权宏 → 多设备共用一个授权码
- [ ] 用 x86 模拟器跑涂鸦 SDK → .so 找不到（UnsatisfiedLinkError）
- [ ] 开发版 SDK 拿去商用 → 违反协议且有用户数上限
- [ ] 健康数据无对应传感器模组 → 功能做不出来
