import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../storage/token_store.dart';
import 'realtime_event.dart';

/// 实时推送服务 —— 基于 socket.io 与后端 RealtimeGateway 对接。
///
/// 连接：携带 JWT（auth.token），自动重连；登录后 connect、登出后 disconnect。
/// 订阅：监听服务端 `realtime:event`，统一转成 [RealtimeEvent] 广播给页面。
class RealtimeService {
  RealtimeService({required this.baseUrl, required TokenStore tokenStore})
      : _tokenStore = tokenStore;

  final String baseUrl;
  final TokenStore _tokenStore;

  io.Socket? _socket;
  final StreamController<RealtimeEvent> _controller =
      StreamController<RealtimeEvent>.broadcast();

  /// 全局事件流（多页面可同时订阅）。
  Stream<RealtimeEvent> get events => _controller.stream;

  /// 仅告警类事件，便于告警相关页面订阅。
  Stream<RealtimeEvent> get alertEvents =>
      _controller.stream.where((e) => e.isAlert);

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    final token = await _tokenStore.readToken();
    if (token == null || token.isEmpty) return;

    // 已连接则不重复创建。
    if (_socket != null) {
      _socket!.connect();
      return;
    }

    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setAuth({'token': token})
          .build(),
    );

    socket.onConnect((_) {
      if (kDebugMode) debugPrint('[realtime] connected');
    });
    socket.onConnectError((err) {
      if (kDebugMode) debugPrint('[realtime] connect_error: $err');
    });
    socket.on('realtime:event', (data) {
      final map = _asMap(data);
      if (map == null) return;
      _controller.add(RealtimeEvent.fromJson(map));
    });

    socket.connect();
    _socket = socket;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  void dispose() {
    disconnect();
    _controller.close();
  }

  Map<String, dynamic>? _asMap(dynamic data) {
    if (data is Map) return Map<String, dynamic>.from(data);
    return null;
  }
}
