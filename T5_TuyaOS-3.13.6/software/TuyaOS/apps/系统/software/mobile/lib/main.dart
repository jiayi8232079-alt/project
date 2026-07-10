import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'src/app.dart';
import 'src/core/auth/auth_controller.dart';
import 'src/core/config/app_config.dart';
import 'src/core/network/api_client.dart';
import 'src/core/realtime/realtime_service.dart';
import 'src/core/storage/token_store.dart';
import 'src/data/repositories/alert_repository.dart';
import 'src/data/repositories/companion_repository.dart';
import 'src/data/repositories/content_repository.dart';
import 'src/data/repositories/dialog_repository.dart';
import 'src/data/repositories/family_repository.dart';
import 'src/data/repositories/medication_repository.dart';
import 'src/data/repositories/membership_repository.dart';
import 'src/data/repositories/order_repository.dart';
import 'src/data/repositories/service_repository.dart';
import 'src/data/repositories/service_target_repository.dart';
import 'src/data/repositories/user_repository.dart';
import 'src/data/repositories/withkin_repository.dart';
import 'src/features/device/data/mock_device_repository.dart';
import 'src/features/device/domain/device_repository.dart';
import 'src/theme/accessibility_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const tokenStore = TokenStore();
  final apiClient = ApiClient(tokenStore: tokenStore);
  final authController = AuthController(
    apiClient: apiClient,
    tokenStore: tokenStore,
  );
  await authController.bootstrap();

  final accessibility = AccessibilityController();
  await accessibility.bootstrap();

  // 实时推送：登录后连接、登出后断开（监听 auth 状态变化）。
  final realtimeService = RealtimeService(
    baseUrl: AppConfig.baseUrl,
    tokenStore: tokenStore,
  );
  var wasAuthenticated = authController.isAuthenticated;
  if (wasAuthenticated) {
    unawaited(realtimeService.connect());
  }
  authController.addListener(() {
    final now = authController.isAuthenticated;
    if (now == wasAuthenticated) return;
    wasAuthenticated = now;
    if (now) {
      unawaited(realtimeService.connect());
    } else {
      realtimeService.disconnect();
    }
  });

  final DeviceRepository deviceRepository = MockDeviceRepository();

  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: apiClient),
        ChangeNotifierProvider.value(value: authController),
        ChangeNotifierProvider.value(value: accessibility),
        Provider<DeviceRepository>.value(value: deviceRepository),
        Provider<RealtimeService>.value(value: realtimeService),
        Provider(create: (_) => OrderRepository(apiClient)),
        Provider(create: (_) => MedicationRepository(apiClient)),
        Provider(create: (_) => AlertRepository(apiClient)),
        Provider(create: (_) => DialogRepository(apiClient)),
        Provider(create: (_) => ServiceTargetRepository(apiClient)),
        Provider(create: (_) => ServiceRepository(apiClient)),
        Provider(create: (_) => FamilyRepository(apiClient)),
        Provider(create: (_) => MembershipRepository(apiClient)),
        Provider(create: (_) => UserRepository(apiClient)),
        Provider(create: (_) => WithKinRepository(apiClient)),
        Provider(create: (_) => CompanionRepository(apiClient)),
        Provider(create: (_) => ContentRepository(apiClient)),
      ],
      child: const QiaoguoApp(),
    ),
  );
}
