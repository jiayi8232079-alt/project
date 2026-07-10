import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../shared/glass.dart';
import '../../../shared/section_card.dart';
import '../../../theme/app_tokens.dart';
import '../application/device_controller.dart';
import '../domain/device_repository.dart';
import '../domain/device_state.dart';
import 'widgets/battery_indicator.dart';
import 'widgets/volume_slider.dart';

/// A3 · 设备设置：真·设备配置（声音/适老/勿扰/能力/维护）。
/// 表情与动作由 AI 根据对话自动调节，此处仅只读展示，不提供手动设置。
/// SOS 在「实时探视」常驻，本页不再重复。
class DeviceControlPage extends StatelessWidget {
  const DeviceControlPage({super.key, required this.deviceId});

  final String deviceId;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<DeviceRepository>();
    return ChangeNotifierProvider(
      create: (_) => DeviceController(repository: repo, deviceId: deviceId),
      child: const _SettingsView(),
    );
  }
}

class _SettingsView extends StatefulWidget {
  const _SettingsView();

  @override
  State<_SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<_SettingsView> {
  // 以下为端侧/适老设置（示意：接入涂鸦 SDK 后改为真实下发）。
  double _speechRate = 1.0;
  String _dialect = '普通话';
  double _brightness = 0.7;

  static const _dialects = ['普通话', '四川话', '粤语', '上海话', '东北话'];

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ctl = context.watch<DeviceController>();
    final state = ctl.state;
    final online = ctl.device?.online ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('设备设置')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          _StatusHeader(state: state, online: online),
          const SizedBox(height: AppSpacing.md),

          // 声音
          SectionCard(
            title: '声音',
            children: [
              VolumeSlider(
                value: state.volume,
                mute: state.mute,
                onChanged: ctl.setVolume,
                onMuteToggle: ctl.toggleMute,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // 适老
          SectionCard(
            title: '适老',
            children: [
              _SliderRow(
                label: '语速',
                value: _speechRate,
                min: 0.5,
                max: 1.5,
                divisions: 10,
                display: '${_speechRate.toStringAsFixed(1)}x',
                onChanged: (v) => setState(() => _speechRate = v),
              ),
              const Divider(height: AppSpacing.lg),
              Row(
                children: [
                  const Text('方言', style: TextStyle(fontSize: 15)),
                  const Spacer(),
                  DropdownButton<String>(
                    value: _dialect,
                    underline: const SizedBox.shrink(),
                    items: _dialects
                        .map((d) =>
                            DropdownMenuItem(value: d, child: Text(d)))
                        .toList(),
                    onChanged: (v) => setState(() => _dialect = v ?? _dialect),
                  ),
                ],
              ),
              const Divider(height: AppSpacing.lg),
              _SliderRow(
                label: '屏幕亮度',
                value: _brightness,
                min: 0.1,
                max: 1.0,
                divisions: 9,
                display: '${(_brightness * 100).round()}%',
                onChanged: (v) => setState(() => _brightness = v),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // 勿扰
          SectionCard(
            title: '勿扰',
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('勿扰模式'),
                subtitle: const Text('开启后仅紧急/SOS 可穿透'),
                value: state.doNotDisturb,
                onChanged: (_) => ctl.toggleDoNotDisturb(),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('勿扰时段'),
                subtitle: const Text('22:00 - 07:00'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _toast('勿扰时段设置（示意）'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // 能力（表情/动作为 AI 自动，仅展示）
          SectionCard(
            title: '能力',
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('人脸追踪'),
                subtitle: const Text('对话时镜头自动跟随老人'),
                value: state.faceTracking,
                onChanged: (_) => ctl.toggleFaceTracking(),
              ),
              const Divider(height: AppSpacing.lg),
              _AiDrivenRow(currentExpression: state.expression.label),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // 维护
          SectionCard(
            title: '维护',
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.system_update_outlined,
                    color: AppColors.primary),
                title: const Text('固件升级 OTA'),
                subtitle: const Text('当前已是最新版本'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _toast('检查更新…（示意）'),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.restart_alt, color: AppColors.warning),
                title: const Text('重启设备'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _confirm(
                    title: '重启设备',
                    body: '设备将重启约 1 分钟，期间无法陪伴与探视，确认继续？',
                    onOk: () => _toast('重启指令已下发（示意）')),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.link_off, color: AppColors.danger),
                title: const Text('解绑设备',
                    style: TextStyle(color: AppColors.danger)),
                subtitle: const Text('解绑将清除该机器人的人格与陪伴记忆'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _confirm(
                    title: '解绑设备',
                    body: '解绑后，这台机器人记住的称呼、爱好、默契等陪伴记忆将被清除且不可恢复，确认解绑？',
                    danger: true,
                    onOk: () => _toast('已解绑（示意）')),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          const Center(
            child: Text('当前为开发联调阶段（mock 数据）；接入涂鸦 IoT SDK 后无需改 UI',
                style: TextStyle(fontSize: 12, color: AppColors.onSurfaceMuted)),
          ),
        ],
      ),
    );
  }

  void _confirm({
    required String title,
    required String body,
    required VoidCallback onOk,
    bool danger = false,
  }) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(
            style: danger
                ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
                : null,
            onPressed: () {
              Navigator.pop(ctx);
              onOk();
            },
            child: const Text('确认'),
          ),
        ],
      ),
    );
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.state, required this.online});

  final DeviceState state;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final statusColor = online ? AppColors.mint : AppColors.onSurfaceMuted;
    return GlassCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor:
                online ? AppColors.mintSoft : AppColors.surfaceVariant,
            child: Icon(Icons.smart_toy, color: statusColor, size: 26),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(online ? Icons.cloud_done : Icons.cloud_off,
                        size: 16, color: statusColor),
                    const SizedBox(width: 4),
                    Text(online ? '在线' : '离线',
                        style: TextStyle(
                            color: statusColor, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 6),
                BatteryIndicator(
                    battery: state.battery, chargeState: state.chargeState),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 表情/动作由 AI 自动驱动，只读展示。
class _AiDrivenRow extends StatelessWidget {
  const _AiDrivenRow({required this.currentExpression});

  final String currentExpression;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.auto_awesome, size: 18, color: AppColors.primary),
            const SizedBox(width: 6),
            const Text('表情与动作', style: TextStyle(fontSize: 15)),
            const Spacer(),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadius.round),
              ),
              child: const Text('由 AI 自动',
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('当前表情：$currentExpression · 机器人会根据对话情绪自动切换表情与点头/摇头等动作',
            style: const TextStyle(
                fontSize: 12, color: AppColors.onSurfaceMuted, height: 1.5)),
      ],
    );
  }
}

class _SliderRow extends StatelessWidget {
  const _SliderRow({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.divisions,
    required this.display,
    required this.onChanged,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final int divisions;
  final String display;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(width: 64, child: Text(label, style: const TextStyle(fontSize: 15))),
        Expanded(
          child: Slider(
            value: value,
            min: min,
            max: max,
            divisions: divisions,
            label: display,
            onChanged: onChanged,
          ),
        ),
        SizedBox(
          width: 44,
          child: Text(display,
              textAlign: TextAlign.right,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.onSurfaceMuted)),
        ),
      ],
    );
  }
}
