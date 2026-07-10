import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../shared/glass.dart';
import '../../../theme/app_tokens.dart';
import '../../device/domain/device.dart';
import '../../device/domain/device_repository.dart';

/// Tab「陪伴」= 机器人列表（一个家庭可有多台）。
/// 每台显示画面预览，点预览进入「实时探视」（云台/抓拍/通话）；可添加新机器人。
class CompanionHome extends StatelessWidget {
  const CompanionHome({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<DeviceRepository>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('陪伴'),
        actions: [
          IconButton(
            tooltip: '添加机器人',
            onPressed: () => _addRobot(context),
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: StreamBuilder<List<Device>>(
        stream: repo.watchDevices(),
        builder: (context, snap) {
          final devices = snap.data ?? const <Device>[];
          if (devices.isEmpty) {
            return _EmptyRobots(onAdd: () => _addRobot(context));
          }
          return ListView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              glassNavClearance(context),
            ),
            children: [
              for (final d in devices) ...[
                _RobotCard(
                  device: d,
                  battery: _battery(repo, d.deviceId),
                  onEnter: () => context.push('/companion/${d.deviceId}'),
                  onSettings: () => context.push('/device/${d.deviceId}'),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              _AddRobotTile(onAdd: () => _addRobot(context)),
            ],
          );
        },
      ),
    );
  }

  int _battery(DeviceRepository repo, String id) {
    try {
      return repo.currentState(id).battery;
    } catch (_) {
      return 0;
    }
  }

  void _addRobot(BuildContext context) {
    context.push('/companion/add');
  }
}

class _RobotCard extends StatelessWidget {
  const _RobotCard({
    required this.device,
    required this.battery,
    required this.onEnter,
    required this.onSettings,
  });

  final Device device;
  final int battery;
  final VoidCallback onEnter;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    final online = device.online;
    return GlassCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 画面预览：点这里进入实时探视
          GestureDetector(
            onTap: onEnter,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF1B2A3A), Color(0xFF0E1722)],
                        ),
                      ),
                    ),
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              online ? Icons.play_arrow_rounded : Icons.cloud_off,
                              color: Colors.white,
                              size: 30,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(online ? '点击查看实时画面' : '设备离线',
                              style: const TextStyle(
                                  color: Colors.white60, fontSize: 12)),
                        ],
                      ),
                    ),
                    if (online)
                      Positioned(
                        left: 10,
                        top: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.danger,
                            borderRadius:
                                BorderRadius.circular(AppRadius.round),
                          ),
                          child: const Text('LIVE',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1)),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor:
                    online ? AppColors.mintSoft : AppColors.surfaceVariant,
                child: Icon(Icons.smart_toy,
                    size: 18,
                    color:
                        online ? AppColors.mint : AppColors.onSurfaceMuted),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(device.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                    Text(
                      online ? '在线 · 电量 $battery%' : '离线',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.onSurfaceMuted),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: onSettings,
                icon: const Icon(Icons.tune, size: 18),
                label: const Text('设置'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AddRobotTile extends StatelessWidget {
  const _AddRobotTile({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onAdd,
      child: const Row(
        children: [
          Icon(Icons.add_circle_outline, color: AppColors.primary),
          SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text('添加新机器人',
                style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          Icon(Icons.chevron_right, color: AppColors.onSurfaceMuted),
        ],
      ),
    );
  }
}

class _EmptyRobots extends StatelessWidget {
  const _EmptyRobots({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.smart_toy_outlined,
                size: 72, color: AppColors.primary),
            const SizedBox(height: AppSpacing.md),
            Text('还没有绑定陪伴机器人',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            const Text('添加后即可远程查看实时画面、控制云台、语音陪伴。',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.onSurfaceMuted)),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add),
              label: const Text('添加机器人'),
            ),
          ],
        ),
      ),
    );
  }
}
