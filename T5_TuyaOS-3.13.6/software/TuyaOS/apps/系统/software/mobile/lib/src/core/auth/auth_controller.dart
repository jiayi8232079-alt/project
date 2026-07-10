import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../network/api_client.dart';
import '../storage/token_store.dart';

class AuthController extends ChangeNotifier {
  AuthController({required ApiClient apiClient, required TokenStore tokenStore})
    : _apiClient = apiClient,
      _tokenStore = tokenStore;

  final ApiClient _apiClient;
  final TokenStore _tokenStore;

  bool _isBootstrapped = false;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _displayName;
  String? _phone;

  bool get isBootstrapped => _isBootstrapped;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String get displayName =>
      _displayName?.isNotEmpty == true ? _displayName! : '陪了个伴用户';
  String? get phone => _phone;

  Future<void> bootstrap() async {
    final token = await _tokenStore.readToken();
    _isAuthenticated = token != null && token.isNotEmpty;
    if (_isAuthenticated) {
      await refreshProfile(silent: true);
    }
    _isBootstrapped = true;
    notifyListeners();
  }

  Future<void> loginWithToken(String token) async {
    final nextToken = token.trim();
    if (nextToken.isEmpty) {
      throw ArgumentError('请输入 JWT token');
    }
    _isLoading = true;
    notifyListeners();
    try {
      await _tokenStore.saveToken(nextToken);
      _isAuthenticated = true;
      await refreshProfile(silent: true);
    } catch (_) {
      await _tokenStore.clear();
      _isAuthenticated = false;
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// 下发短信验证码；返回响应体（非生产环境含 devCode 便于联调）。
  Future<Map<String, dynamic>> sendSmsCode(String phone) {
    return _apiClient.postObject(
      '/auth/send-sms-code',
      data: {'phone': phone.trim()},
    );
  }

  /// 手机号 + 验证码登录（账号不存在时后端自动注册）。
  Future<void> loginWithPhone(String phone, String code) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _apiClient.postObject(
        '/auth/phone-login',
        data: {'phone': phone.trim(), 'code': code.trim()},
      );
      await _applyLoginResult(res);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// 通过 Apple 登录（identityToken 由原生 Apple 授权返回）。
  Future<void> loginWithApple({
    required String identityToken,
    String? fullName,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _apiClient.postObject(
        '/auth/apple-login',
        data: {
          'identityToken': identityToken,
          if (fullName != null && fullName.trim().isNotEmpty)
            'fullName': fullName.trim(),
        },
      );
      await _applyLoginResult(res);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _applyLoginResult(Map<String, dynamic> res) async {
    final token = res['token']?.toString();
    if (token == null || token.isEmpty) {
      throw Exception('登录失败：服务端未返回令牌');
    }
    await _tokenStore.saveToken(token);
    _isAuthenticated = true;
    final user = res['user'];
    if (user is Map) {
      final u = Map<String, dynamic>.from(user);
      _displayName = (u['nickname'] ?? u['name'] ?? u['realName'])?.toString();
      _phone = u['phone']?.toString();
    }
  }

  Future<void> refreshProfile({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      notifyListeners();
    }
    try {
      final profile = await _apiClient.getProfile();
      final user = profile['user'] is Map
          ? Map<String, dynamic>.from(profile['user'] as Map)
          : profile;
      _displayName = (user['nickname'] ?? user['name'] ?? user['realName'])
          ?.toString();
      _phone = user['phone']?.toString();
    } on DioException {
      await _tokenStore.clear();
      _isAuthenticated = false;
      _displayName = null;
      _phone = null;
      rethrow;
    } finally {
      if (!silent) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> logout() async {
    await _tokenStore.clear();
    _isAuthenticated = false;
    _displayName = null;
    _phone = null;
    notifyListeners();
  }
}
