import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../shared/glass.dart';
import '../../../theme/app_tokens.dart';
import '../domain/device.dart';
import '../domain/device_repository.dart';

class DeviceListPage extends StatelessWidget {
  const DeviceListPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<DeviceRepository>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('我的设备'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: '添加设备',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('配网功能待接入涂鸦 IoT App SDK'),
                ),
              );
            },
          ),
        ],
      ),
      body: StreamBuilder<List<Device>>(
        stream: repo.watchDevices(),
        builder: (context, snap) {
          final devices = snap.data ?? const <Device>[];
          if (devices.isEmpty) {
            return const Center(child: Text('暂无设备'));
          }
          return ListView.separated(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              glassNavClearance(context),
            ),
            itemCount: devices.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, i) {
              final d = devices[i];
              return GlassCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                onTap: () => context.push('/device/${d.deviceId}'),
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: d.online
                        ? AppColors.mintSoft
                        : AppColors.surfaceVariant,
                    child: Icon(
                      Icons.smart_toy,
                      color: d.online ? AppColors.mint : AppColors.onSurfaceMuted,
                    ),
                  ),
                  title: Text(d.name),
                  subtitle: Text(
                    '${d.online ? "在线" : "离线"} · 固件 ${d.firmwareVersion ?? "未知"}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
