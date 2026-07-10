import 'package:dio/dio.dart';

/// 归一化的接口异常 —— 把 Dio 的各种底层错误转成对用户友好的中文提示。
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;

  /// 是否为登录态失效（401），UI 可据此跳登录页。
  bool get isUnauthorized => statusCode == 401;

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;

    // 后端通常返回 { message, error, statusCode }，优先取 message。
    final data = error.response?.data;
    String? backendMessage;
    if (data is Map) {
      final msg = data['message'];
      if (msg is List && msg.isNotEmpty) {
        backendMessage = msg.first.toString();
      } else if (msg != null) {
        backendMessage = msg.toString();
      }
    } else if (data is String && data.trim().isNotEmpty) {
      backendMessage = data.trim();
    }

    final message = switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        '网络超时，请检查网络后重试',
      DioExceptionType.connectionError => '无法连接服务器，请检查网络或接口地址',
      DioExceptionType.badResponse => backendMessage ?? _statusMessage(status),
      DioExceptionType.cancel => '请求已取消',
      _ => backendMessage ?? '请求失败，请稍后重试',
    };

    return ApiException(message, statusCode: status);
  }

  static String _statusMessage(int? status) {
    return switch (status) {
      400 => '请求参数有误',
      401 => '登录已过期，请重新登录',
      403 => '没有访问权限',
      404 => '请求的数据不存在',
      429 => '操作太频繁，请稍后再试',
      500 || 502 || 503 => '服务器开小差了，请稍后重试',
      _ => '请求失败，请稍后重试',
    };
  }
}
