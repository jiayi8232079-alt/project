# 陪了个伴移动端

Flutter Android/iOS 客户端，复用现有 NestJS 后端。

## 运行

```bash
cd mobile
flutter pub get
flutter run
```

默认接口为：

```text
http://localhost:3000
```

覆盖接口地址：

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

Android 模拟器访问电脑本机后端时使用：

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

真机访问本地后端时，将 `localhost` 换成电脑局域网 IP，例如：

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.10.104:3000
```

## 当前状态

- 已创建 Android/iOS Flutter 工程。
- 已接入 `dio`、`go_router`、`provider`、`flutter_secure_storage`。
- 已搭建登录页、底部 Tab、首页、服务、订单、健康、我的页面骨架。
- API 客户端默认连接 `http://localhost:3000`，可通过 `API_BASE_URL` 覆盖。
- 目前后端只有微信小程序登录，移动端正式登录还需要新增手机号验证码登录和 Apple 登录接口。

## 下一步后端接口

```text
POST /auth/sms/send-code
POST /auth/sms-login
POST /auth/apple-login
POST /auth/logout
POST /auth/delete-account
POST /app/device-token
```
