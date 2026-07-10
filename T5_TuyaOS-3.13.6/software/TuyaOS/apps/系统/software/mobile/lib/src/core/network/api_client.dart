import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({required TokenStore tokenStore})
    : _tokenStore = tokenStore,
      dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.baseUrl,
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 20),
          headers: {'Accept': 'application/json'},
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStore.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio dio;
  final TokenStore _tokenStore;

  // ─────────────── 通用请求封装（统一异常归一化）───────────────

  /// GET 返回原始 body（可能是数组/对象）。
  Future<dynamic> getRaw(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await dio.get(
        path,
        queryParameters: _clean(query),
      );
      return response.data;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  /// GET 返回对象（map）。
  Future<Map<String, dynamic>> getObject(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final data = await getRaw(path, query: query);
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> postObject(
    String path, {
    Object? data,
  }) async {
    try {
      final response = await dio.post(path, data: data);
      final body = response.data;
      if (body is Map) return Map<String, dynamic>.from(body);
      return <String, dynamic>{};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> putObject(
    String path, {
    Object? data,
  }) async {
    try {
      final response = await dio.put(path, data: data);
      final body = response.data;
      if (body is Map) return Map<String, dynamic>.from(body);
      return <String, dynamic>{};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> getProfile() => getObject('/auth/profile');

  /// 去掉 null 的查询参数，避免后端收到字面量 "null"。
  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final cleaned = <String, dynamic>{};
    query.forEach((key, value) {
      if (value != null) cleaned[key] = value;
    });
    return cleaned.isEmpty ? null : cleaned;
  }
}
