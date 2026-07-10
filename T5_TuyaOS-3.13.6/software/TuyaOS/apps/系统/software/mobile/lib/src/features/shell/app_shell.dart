import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/realtime/realtime_event.dart';
import '../../core/realtime/realtime_service.dart';
import '../../shared/glass.dart';
import '../../theme/app_tokens.dart';
import '../ai/ai_hub_page.dart';
import '../care/care_home_page.dart';
import '../companion/presentation/companion_home_page.dart';
import '../profile/profile_page.dart';
import '../services/services_page.dart';

/// 主导航壳：以「机器人交互」为中心的 5 Tab。
/// 索引：0 看护 · 1 服务 · 2 陪伴 · 3 伴聊AI · 4 我的
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  StreamSubscription<RealtimeEvent>? _alertSub;

  static const _pages = [
    CareHomePage(),
    ServicesPage(),
    CompanionHome(),
    AiHubPage(),
    ProfilePage(),
  ];

  @override
  void initState() {
    super.initState();
    _alertSub = context.read<RealtimeService>().alertEvents.listen(_onAlert);
  }

  void _onAlert(RealtimeEvent event) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null || !mounted) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(event.summary),
        backgroundColor: event.isCritical ? AppColors.danger : null,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 6),
        action: SnackBarAction(
          label: '查看',
          textColor: Colors.white,
          onPressed: () => context.push('/alerts'),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _alertSub?.cancel();
    super.dispose();
  }

  void _select(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: _DockNav(currentIndex: _index, onTap: _select),
    );
  }
}

/// 简洁统一的悬浮玻璃底栏（Material 3 胶囊风格）：
/// 5 项同一视觉语言，选中=主色实心图标 + 柔和胶囊底 + 主色标签，避免异类色块。
class _DockNav extends StatelessWidget {
  const _DockNav({required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _items = <_NavData>[
    _NavData(0, Icons.home_outlined, Icons.home_rounded, '看护'),
    _NavData(1, Icons.medical_services_outlined, Icons.medical_services, '服务'),
    _NavData(2, Icons.videocam_outlined, Icons.videocam_rounded, '陪伴'),
    _NavData(3, Icons.auto_awesome_outlined, Icons.auto_awesome, '伴聊'),
    _NavData(4, Icons.person_outline_rounded, Icons.person_rounded, '我的'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
        child: GlassSurface(
          radius: AppRadius.round,
          blur: AppGlass.blurStrong,
          fill: AppGlass.fillStrong,
          shadow: AppShadows.floating,
          padding:
              const EdgeInsets.symmetric(vertical: 10, horizontal: AppSpacing.xs),
          child: Row(
            children: [
              for (final it in _items)
                _NavItem(
                  data: it,
                  selected: currentIndex == it.index,
                  onTap: () => onTap(it.index),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavData {
  const _NavData(this.index, this.icon, this.activeIcon, this.label);
  final int index;
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.data,
    required this.selected,
    required this.onTap,
  });

  final _NavData data;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.onSurfaceMuted;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              height: 32,
              width: 60,
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.primarySoft.withValues(alpha: 0.95)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(AppRadius.round),
              ),
              alignment: Alignment.center,
              child: Icon(selected ? data.activeIcon : data.icon,
                  color: color, size: 23),
            ),
            const SizedBox(height: 4),
            Text(
              data.label,
              style: TextStyle(
                fontSize: 11,
                height: 1.0,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
