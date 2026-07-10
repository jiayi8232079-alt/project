import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:qiaoguo_companion/src/app.dart';
import 'package:qiaoguo_companion/src/core/auth/auth_controller.dart';
import 'package:qiaoguo_companion/src/core/config/app_config.dart';
import 'package:qiaoguo_companion/src/core/network/api_client.dart';
import 'package:qiaoguo_companion/src/core/realtime/realtime_service.dart';
import 'package:qiaoguo_companion/src/core/storage/token_store.dart';
import 'package:qiaoguo_companion/src/data/repositories/alert_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/dialog_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/family_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/medication_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/membership_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/order_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/service_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/service_target_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/user_repository.dart';
import 'package:qiaoguo_companion/src/data/repositories/withkin_repository.dart';
import 'package:qiaoguo_companion/src/features/device/data/mock_device_repository.dart';
import 'package:qiaoguo_companion/src/features/device/domain/device_repository.dart';
import 'package:qiaoguo_companion/src/theme/accessibility_controller.dart';

void main() {
  testWidgets('shows login page when unauthenticated', (tester) async {
    const tokenStore = TokenStore();
    final apiClient = ApiClient(tokenStore: tokenStore);
    final authController = AuthController(
      apiClient: apiClient,
      tokenStore: tokenStore,
    );
    final realtimeService = RealtimeService(
      baseUrl: AppConfig.baseUrl,
      tokenStore: tokenStore,
    );
    final DeviceRepository deviceRepository = MockDeviceRepository();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider.value(value: apiClient),
          ChangeNotifierProvider.value(value: authController),
          ChangeNotifierProvider(create: (_) => AccessibilityController()),
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
        ],
        child: const QiaoguoApp(),
      ),
    );

    expect(find.text('陪了个伴'), findsOneWidget);
    expect(find.text('手机号登录'), findsOneWidget);
  });
}
