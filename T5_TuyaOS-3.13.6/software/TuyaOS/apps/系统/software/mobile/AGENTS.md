# AGENTS.md · Flutter App（mobile/）

> 先读 [`../AGENTS.md`](../AGENTS.md)。深度文档：`../开发说明/07-移动App说明.md`。

## 技术栈
Flutter 3.10（Dart 3.10）+ go_router 17 + Provider 6 + Dio 5；secure_storage、socket_io_client、sign_in_with_apple。

## 本地启动
```bash
cd software/mobile
flutter pub get
flutter run            # 选择目标设备 / 模拟器
```

## 约定
- 路由表（go_router）+ Repository 模式 + Provider 状态管理；适老化 UI
- C 端核心闭环已通（登录 / 下单 / 订单 / 用药 / 告警 / AI对话 / 家属 / 健康 / 会员）；设备 / 支付待接
- 实时走 `socket_io_client`，对齐后端 realtime 事件
