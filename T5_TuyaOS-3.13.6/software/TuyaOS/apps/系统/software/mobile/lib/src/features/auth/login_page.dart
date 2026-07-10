import 'dart:async';
import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/glass.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _tokenController = TextEditingController();

  String? _error;
  bool _sending = false;
  int _countdown = 0;
  Timer? _timer;

  bool get _appleAvailable =>
      !kIsWeb && (Platform.isIOS || Platform.isMacOS);

  @override
  void dispose() {
    _timer?.cancel();
    _phoneController.dispose();
    _codeController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  bool _isValidPhone(String v) => RegExp(r'^1\d{10}$').hasMatch(v.trim());

  void _startCountdown() {
    setState(() => _countdown = 60);
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_countdown <= 1) {
        t.cancel();
        if (mounted) setState(() => _countdown = 0);
      } else if (mounted) {
        setState(() => _countdown -= 1);
      }
    });
  }

  Future<void> _sendCode() async {
    final phone = _phoneController.text.trim();
    if (!_isValidPhone(phone)) {
      setState(() => _error = '请输入正确的 11 位手机号');
      return;
    }
    setState(() {
      _error = null;
      _sending = true;
    });
    try {
      final res = await context.read<AuthController>().sendSmsCode(phone);
      _startCountdown();
      // 开发环境后端会回显 devCode，自动填入便于联调。
      final devCode = res['devCode']?.toString();
      if (devCode != null && devCode.isNotEmpty) {
        _codeController.text = devCode;
        _toast('测试验证码已自动填入：$devCode');
      } else {
        _toast('验证码已发送');
      }
    } on DioException catch (e) {
      setState(() => _error = _dioMessage(e) ?? '验证码发送失败');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _loginByPhone() async {
    final phone = _phoneController.text.trim();
    final code = _codeController.text.trim();
    if (!_isValidPhone(phone)) {
      setState(() => _error = '请输入正确的 11 位手机号');
      return;
    }
    if (code.isEmpty) {
      setState(() => _error = '请输入验证码');
      return;
    }
    setState(() => _error = null);
    try {
      await context.read<AuthController>().loginWithPhone(phone, code);
    } on DioException catch (e) {
      setState(() => _error = _dioMessage(e) ?? '登录失败');
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _loginByApple() async {
    setState(() => _error = null);
    final auth = context.read<AuthController>();
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final idToken = credential.identityToken;
      if (idToken == null || idToken.isEmpty) {
        setState(() => _error = 'Apple 未返回身份令牌');
        return;
      }
      final fullName = [credential.givenName, credential.familyName]
          .whereType<String>()
          .where((e) => e.isNotEmpty)
          .join(' ');
      await auth.loginWithApple(
        identityToken: idToken,
        fullName: fullName.isEmpty ? null : fullName,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) return;
      setState(() => _error = 'Apple 登录失败：${e.message}');
    } on DioException catch (e) {
      setState(() => _error = _dioMessage(e) ?? 'Apple 登录失败');
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _loginByToken() async {
    setState(() => _error = null);
    try {
      await context.read<AuthController>().loginWithToken(_tokenController.text);
    } on DioException catch (e) {
      setState(() => _error = _dioMessage(e) ?? '登录失败，请检查 token 或接口环境');
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  String? _dioMessage(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      return m is List ? m.first?.toString() : m.toString();
    }
    return data?.toString();
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final theme = Theme.of(context);
    final canSend = _countdown == 0 && !_sending;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: [
            Text(
              '陪了个伴',
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '陪诊服务、健康档案与家人协同的一站式移动端。',
              style: theme.textTheme.bodyLarge
                  ?.copyWith(color: const Color(0xFF58635D)),
            ),
            const SizedBox(height: 32),
            GlassCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '手机号登录',
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    const Text('未注册的手机号将自动创建账号'),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      maxLength: 11,
                      decoration: const InputDecoration(
                        labelText: '手机号',
                        prefixIcon: Icon(Icons.phone_iphone),
                        counterText: '',
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _codeController,
                            keyboardType: TextInputType.number,
                            maxLength: 6,
                            decoration: const InputDecoration(
                              labelText: '验证码',
                              prefixIcon: Icon(Icons.sms_outlined),
                              counterText: '',
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 116,
                          height: 52,
                          child: OutlinedButton(
                            onPressed: canSend ? _sendCode : null,
                            child: _sending
                                ? const SizedBox.square(
                                    dimension: 16,
                                    child:
                                        CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Text(_countdown > 0
                                    ? '${_countdown}s'
                                    : '获取验证码'),
                          ),
                        ),
                      ],
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: auth.isLoading ? null : _loginByPhone,
                      child: auth.isLoading
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('登录 / 注册'),
                    ),
                  ],
                ),
            ),
            if (_appleAvailable) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: auth.isLoading ? null : _loginByApple,
                icon: const Icon(Icons.apple),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                label: const Text('通过 Apple 登录'),
              ),
            ],
            const SizedBox(height: 24),
            Theme(
              data: theme.copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text(
                  '开发登录（粘贴 JWT）',
                  style: TextStyle(fontSize: 13, color: Color(0xFF8A938D)),
                ),
                children: [
                  TextField(
                    controller: _tokenController,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'JWT token',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: auth.isLoading ? null : _loginByToken,
                    child: const Text('用 token 进入'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
