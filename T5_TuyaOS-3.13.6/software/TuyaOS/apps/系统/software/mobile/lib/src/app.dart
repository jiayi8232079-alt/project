import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/auth/auth_controller.dart';
import 'shared/glass.dart';
import 'features/ai/ai_companion_pages.dart';
import 'features/ai_dialog/ai_dialog_pages.dart';
import 'features/ai/ai_hub_page.dart';
import 'features/alerts/alert_pages.dart';
import 'features/auth/login_page.dart';
import 'features/companion/presentation/companion_add_page.dart';
import 'features/companion/presentation/companion_home_page.dart';
import 'features/companion/presentation/companion_live_page.dart';
// caregiver_dashboard 已并入「看护」首页（CareHomePage），移除重复页。
import 'features/device/presentation/device_control_page.dart';
import 'features/device/presentation/device_list_page.dart';
import 'features/family/family_actions_pages.dart';
import 'features/family/family_page.dart';
import 'features/health/health_page.dart';
import 'features/medication/medication_page.dart';
import 'features/membership/membership_page.dart';
import 'features/orders/order_detail_page.dart';
import 'features/orders/orders_page.dart';
import 'features/profile/profile_edit_page.dart';
import 'features/profile/profile_page.dart';
import 'features/profile/static_pages.dart';
import 'features/services/hospitals_page.dart';
import 'features/services/service_detail_page.dart';
import 'features/shell/app_shell.dart';
import 'features/withkin/withkin_page.dart';
import 'theme/accessibility_controller.dart';
import 'theme/app_theme.dart';

class QiaoguoApp extends StatefulWidget {
  const QiaoguoApp({super.key});

  @override
  State<QiaoguoApp> createState() => _QiaoguoAppState();
}

class _QiaoguoAppState extends State<QiaoguoApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthController>();
    _router = GoRouter(
      initialLocation: '/',
      refreshListenable: auth,
      redirect: (context, state) {
        // 本地调试可通过 --dart-define=DEBUG_SKIP_AUTH=true 跳过登录。
        final kDebugSkipAuth = bool.fromEnvironment('DEBUG_SKIP_AUTH');
        final onLogin = state.matchedLocation == '/login';
        if (kDebugSkipAuth) return onLogin ? '/' : null;
        if (!auth.isAuthenticated && !onLogin) return '/login';
        if (auth.isAuthenticated && onLogin) return '/';
        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (context, state) => const AppShell()),
        GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
        GoRoute(
          path: '/devices',
          builder: (context, state) => const DeviceListPage(),
        ),
        GoRoute(
          path: '/device/:id',
          builder: (context, state) =>
              DeviceControlPage(deviceId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/companion',
          builder: (context, state) => const CompanionHome(),
        ),
        GoRoute(
          path: '/companion/add',
          builder: (context, state) => const CompanionAddPage(),
        ),
        GoRoute(
          path: '/companion/:id',
          builder: (context, state) => CompanionLivePage(
            deviceId: state.pathParameters['id']!,
            startFullscreen: state.uri.queryParameters['fs'] == '1',
          ),
        ),
        GoRoute(
          path: '/orders',
          builder: (context, state) => const OrdersPage(),
        ),
        GoRoute(
          path: '/orders/:id',
          builder: (context, state) =>
              OrderDetailPage(orderId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/services/:code',
          builder: (context, state) =>
              ServiceDetailPage(code: state.pathParameters['code']!),
        ),
        GoRoute(
          path: '/services/:code/book',
          builder: (context, state) =>
              ServiceBookingPage(code: state.pathParameters['code']!),
        ),
        GoRoute(
          path: '/hospitals',
          builder: (context, state) => const HospitalsPage(),
        ),
        GoRoute(
          path: '/health',
          builder: (context, state) => const HealthPage(),
        ),
        GoRoute(
          path: '/health/:id',
          builder: (context, state) =>
              HealthProfilePage(targetId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/medications',
          builder: (context, state) => const MedicationPage(),
        ),
        GoRoute(
          path: '/alerts',
          builder: (context, state) => const AlertListPage(),
        ),
        GoRoute(
          path: '/alerts/:id',
          builder: (context, state) =>
              AlertDetailPage(alertId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/ai-dialogs',
          builder: (context, state) => const AiDialogListPage(),
        ),
        GoRoute(
          path: '/ai-dialogs/:id',
          builder: (context, state) => AiDialogDetailPage(
            sessionId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/ai',
          builder: (context, state) => const AiHubPage(),
        ),
        GoRoute(
          path: '/ai/persona',
          builder: (context, state) => const AiPersonaPage(),
        ),
        GoRoute(
          path: '/ai/memory',
          builder: (context, state) => const AiMemoryPage(),
        ),
        GoRoute(
          path: '/ai/feed',
          builder: (context, state) => const FamilyFeedPage(),
        ),
        GoRoute(
          path: '/ai/content',
          builder: (context, state) => const ContentLibraryPage(),
        ),
        GoRoute(
          path: '/ai/proactive',
          builder: (context, state) => const ProactiveSettingsPage(),
        ),
        GoRoute(
          path: '/family',
          builder: (context, state) => const FamilyPage(),
        ),
        GoRoute(
          path: '/withkin',
          builder: (context, state) => const WithKinPage(),
        ),
        GoRoute(
          path: '/family/join',
          builder: (context, state) => const JoinFamilyPage(),
        ),
        GoRoute(
          path: '/family/add-elder',
          builder: (context, state) => const AddElderPage(),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) => const SettingsPage(),
        ),
        GoRoute(
          path: '/membership',
          builder: (context, state) => const MembershipPage(),
        ),
        GoRoute(
          path: '/profile/edit',
          builder: (context, state) => const ProfileEditPage(),
        ),
        GoRoute(
          path: '/privacy',
          builder: (context, state) => const PrivacyPage(),
        ),
        GoRoute(
          path: '/about',
          builder: (context, state) => const AboutPage(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = context.watch<AccessibilityController>();
    return MaterialApp.router(
      title: '陪了个伴',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(elderlyMode: accessibility.elderlyMode),
      routerConfig: _router,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(accessibility.textScale),
          ),
          // 全局浅蓝白渐变 + 光晕背景，所有页面共用。
          child: AppBackground(child: child ?? const SizedBox.shrink()),
        );
      },
    );
  }
}
