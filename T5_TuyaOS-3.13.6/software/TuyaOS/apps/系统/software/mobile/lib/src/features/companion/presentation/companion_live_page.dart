import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../theme/app_tokens.dart';
import '../../device/application/device_controller.dart';
import '../../device/domain/device_repository.dart';
import '../../device/domain/device_state.dart';
import '../../device/presentation/widgets/ptz_pad.dart';

/// A1 · 实时探视：影院式 16:9 播放器 + 独立云台 + 一键对讲 + 常驻 SOS。
/// 由「陪伴」列表点机器人画面进入（pushed detail）。全屏 = 横屏看电影。
class CompanionLivePage extends StatelessWidget {
  const CompanionLivePage(
      {super.key, required this.deviceId, this.startFullscreen = false});

  final String deviceId;
  final bool startFullscreen;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<DeviceRepository>();
    return ChangeNotifierProvider(
      create: (_) => DeviceController(repository: repo, deviceId: deviceId),
      child: _LiveView(deviceId: deviceId, startFullscreen: startFullscreen),
    );
  }
}

class _LiveView extends StatefulWidget {
  const _LiveView({required this.deviceId, this.startFullscreen = false});

  final String deviceId;
  final bool startFullscreen;

  @override
  State<_LiveView> createState() => _LiveViewState();
}

class _LiveViewState extends State<_LiveView> {
  bool _talking = false;
  late bool _fullscreen = widget.startFullscreen;

  @override
  void initState() {
    super.initState();
    if (widget.startFullscreen) {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  void _enterFullscreen() {
    SystemChrome.setPreferredOrientations(
        [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    setState(() => _fullscreen = true);
  }

  void _exitFullscreen() {
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    setState(() => _fullscreen = false);
  }

  @override
  void dispose() {
    // 离开页面恢复竖屏。
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctl = context.watch<DeviceController>();
    final online = ctl.device?.online ?? false;

    if (_fullscreen) {
      return _FullscreenPlayer(
        online: online,
        talking: _talking,
        onExit: _exitFullscreen,
        onTalkStart: () => setState(() => _talking = true),
        onTalkEnd: () => setState(() => _talking = false),
        onPtz: ctl.ptzMove,
        onPtzStop: ctl.ptzStop,
        onCenter: ctl.ptzReturnCenter,
      );
    }

    final ptzSize =
        (MediaQuery.of(context).size.width * 0.42).clamp(130.0, 168.0);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.xs, AppSpacing.md, 0),
          child: Column(
            children: [
              _TopBar(
                name: ctl.device?.name ?? '陪伴机器人',
                online: online,
                battery: ctl.state.battery,
                onSettings: () => context.push('/device/${widget.deviceId}'),
              ),
              const SizedBox(height: AppSpacing.xs),
              _VideoCard(online: online, onFullscreen: _enterFullscreen),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _PtzPanel(
                      online: online,
                      size: ptzSize,
                      onPtz: ctl.ptzMove,
                      onPtzStop: ctl.ptzStop,
                      onCenter: ctl.ptzReturnCenter,
                    ),
                    _ActionRow(
                      online: online,
                      talking: _talking,
                      onTalkStart: () {
                        setState(() => _talking = true);
                        _toast('正在对讲…（示意）');
                      },
                      onTalkEnd: () => setState(() => _talking = false),
                      onSnapshot: () => _toast('已抓拍当前画面（示意）'),
                      onCall: () => _toast('发起视频通话…（待接入涂鸦 WebRTC）'),
                    ),
                  ],
                ),
              ),
              _SosBar(onPressed: () => _confirmSos(ctl)),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmSos(DeviceController ctl) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('模拟 SOS'),
        content: const Text('将向后端推送一条 mock SOS 事件，用于联调来电式紧急流程，确认继续？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              Navigator.pop(ctx);
              ctl.triggerSosTest();
            },
            child: const Text('确认触发'),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────── 顶部状态条 ─────────────────────────

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.name,
    required this.online,
    required this.battery,
    required this.onSettings,
  });

  final String name;
  final bool online;
  final int battery;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          tooltip: '返回',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
        const SizedBox(width: AppSpacing.sm),
        CircleAvatar(
          radius: 16,
          backgroundColor:
              online ? AppColors.mintSoft : AppColors.surfaceVariant,
          child: Icon(Icons.smart_toy,
              size: 18,
              color: online ? AppColors.mint : AppColors.onSurfaceMuted),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w700)),
              Row(
                children: [
                  Icon(online ? Icons.circle : Icons.circle_outlined,
                      size: 8,
                      color:
                          online ? AppColors.success : AppColors.onSurfaceMuted),
                  const SizedBox(width: 4),
                  Text(online ? '在线 · 信号良好 · $battery%' : '离线',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.onSurfaceMuted)),
                ],
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: '设备设置',
          onPressed: onSettings,
          icon: const Icon(Icons.tune),
        ),
      ],
    );
  }
}

// ───────────────────────── 影院式视频卡（16:9）─────────────────────────

class _VideoCard extends StatelessWidget {
  const _VideoCard({required this.online, required this.onFullscreen});

  final bool online;
  final VoidCallback onFullscreen;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const _VideoSurface(),
            _VideoCenter(online: online),
            if (online)
              const Positioned(left: 10, top: 10, child: _LiveBadge()),
            Positioned(
              right: 10,
              bottom: 10,
              child: _GlassPill(
                icon: Icons.fullscreen,
                label: '全屏',
                onTap: online ? onFullscreen : () {},
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoSurface extends StatelessWidget {
  const _VideoSurface();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B2A3A), Color(0xFF0E1722)],
        ),
      ),
    );
  }
}

class _VideoCenter extends StatelessWidget {
  const _VideoCenter({required this.online});
  final bool online;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(online ? Icons.videocam : Icons.cloud_off,
              size: 40, color: Colors.white24),
          const SizedBox(height: 6),
          Text(online ? '实时画面（示意）' : '设备离线，暂无法查看',
              style: const TextStyle(color: Colors.white38, fontSize: 12)),
        ],
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.danger,
        borderRadius: BorderRadius.circular(AppRadius.round),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 8, color: Colors.white),
          SizedBox(width: 4),
          Text('LIVE',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1)),
        ],
      ),
    );
  }
}

class _GlassPill extends StatelessWidget {
  const _GlassPill(
      {required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.38),
      borderRadius: BorderRadius.circular(AppRadius.round),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.round),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: Colors.white),
              const SizedBox(width: 5),
              Text(label,
                  style: const TextStyle(color: Colors.white, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

// ───────────────────────── 独立云台控制区 ─────────────────────────

class _PtzPanel extends StatelessWidget {
  const _PtzPanel({
    required this.online,
    required this.size,
    required this.onPtz,
    required this.onPtzStop,
    required this.onCenter,
  });

  final bool online;
  final double size;
  final void Function(PtzDirection) onPtz;
  final VoidCallback onPtzStop;
  final VoidCallback onCenter;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('云台控制 · 按住方向键转动镜头',
            style: TextStyle(fontSize: 12, color: AppColors.onSurfaceMuted)),
        const SizedBox(height: AppSpacing.sm),
        PtzPad(
          enabled: online,
          size: size,
          onPressed: onPtz,
          onReleased: onPtzStop,
          onCenter: onCenter,
        ),
      ],
    );
  }
}

// ───────────────────────── 底部动作行 ─────────────────────────

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.online,
    required this.talking,
    required this.onTalkStart,
    required this.onTalkEnd,
    required this.onSnapshot,
    required this.onCall,
  });

  final bool online;
  final bool talking;
  final VoidCallback onTalkStart;
  final VoidCallback onTalkEnd;
  final VoidCallback onSnapshot;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _RoundAction(
            icon: Icons.photo_camera_outlined,
            label: '抓拍',
            onTap: online ? onSnapshot : null),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: GestureDetector(
            onTapDown: online ? (_) => onTalkStart() : null,
            onTapUp: online ? (_) => onTalkEnd() : null,
            onTapCancel: online ? onTalkEnd : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              height: 48,
              decoration: BoxDecoration(
                gradient: online && !talking ? AppGradients.primary : null,
                color: !online
                    ? AppColors.surfaceVariant
                    : (talking ? AppColors.primaryDark : null),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                boxShadow: online ? AppShadows.card : null,
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(talking ? Icons.mic : Icons.mic_none,
                      size: 20,
                      color: online ? Colors.white : AppColors.onSurfaceMuted),
                  const SizedBox(width: 8),
                  Text(talking ? '正在说话…' : '按住对讲',
                      style: TextStyle(
                          color:
                              online ? Colors.white : AppColors.onSurfaceMuted,
                          fontWeight: FontWeight.w700,
                          fontSize: 15)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        _RoundAction(
            icon: Icons.videocam_outlined,
            label: '通话',
            onTap: online ? onCall : null),
      ],
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction(
      {required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.glassFill.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.outline),
            ),
            child: Icon(icon,
                size: 22,
                color: enabled ? AppColors.primary : AppColors.onSurfaceMuted),
          ),
          const SizedBox(height: 3),
          Text(label,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.onSurfaceMuted)),
        ],
      ),
    );
  }
}

class _SosBar extends StatelessWidget {
  const _SosBar({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 46,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.emergency_share, color: AppColors.danger, size: 20),
        label: const Text('紧急求助 SOS',
            style: TextStyle(
                color: AppColors.danger, fontWeight: FontWeight.w700)),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: AppColors.danger, width: 1.5),
          backgroundColor: AppColors.dangerSoft,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg)),
        ),
      ),
    );
  }
}

// ───────────────────────── 全屏（横屏看电影）播放器 ─────────────────────────

class _FullscreenPlayer extends StatelessWidget {
  const _FullscreenPlayer({
    required this.online,
    required this.talking,
    required this.onExit,
    required this.onTalkStart,
    required this.onTalkEnd,
    required this.onPtz,
    required this.onPtzStop,
    required this.onCenter,
  });

  final bool online;
  final bool talking;
  final VoidCallback onExit;
  final VoidCallback onTalkStart;
  final VoidCallback onTalkEnd;
  final void Function(PtzDirection) onPtz;
  final VoidCallback onPtzStop;
  final VoidCallback onCenter;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final ptz = (size.height * 0.5).clamp(120.0, 168.0);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) onExit();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            const _VideoSurface(),
            _VideoCenter(online: online),
            // 顶部：LIVE + 退出全屏
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  children: [
                    if (online) const _LiveBadge(),
                    const Spacer(),
                    _GlassPill(
                        icon: Icons.fullscreen_exit,
                        label: '退出全屏',
                        onTap: onExit),
                  ],
                ),
              ),
            ),
            // 右下：云台（深色样式、紧凑）
            if (online)
              Positioned(
                right: 20,
                bottom: 16,
                child: PtzPad(
                  enabled: online,
                  size: ptz,
                  onDark: true,
                  onPressed: onPtz,
                  onReleased: onPtzStop,
                  onCenter: onCenter,
                ),
              ),
            // 左下：对讲
            Positioned(
              left: 20,
              bottom: 28,
              child: GestureDetector(
                onTapDown: online ? (_) => onTalkStart() : null,
                onTapUp: online ? (_) => onTalkEnd() : null,
                onTapCancel: online ? onTalkEnd : null,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  decoration: BoxDecoration(
                    color: talking ? AppColors.primaryDark : AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadius.round),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(talking ? Icons.mic : Icons.mic_none,
                          color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      Text(talking ? '正在说话…' : '按住对讲',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
