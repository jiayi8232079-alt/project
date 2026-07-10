import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/realtime/realtime_event.dart';
import '../../core/realtime/realtime_service.dart';
import '../../data/models/alert_item.dart';
import '../../data/models/enums.dart';
import '../../data/models/medication.dart';
import '../../data/models/service_target.dart';
import '../../data/repositories/alert_repository.dart';
import '../../data/repositories/medication_repository.dart';
import '../../data/repositories/service_target_repository.dart';
import '../../features/device/domain/device.dart';
import '../../features/device/domain/device_repository.dart';
import '../../shared/glass.dart';
import '../../theme/app_tokens.dart';

/// Tab「看护」首页：一眼安心 + 温度。头像状态环 + 一句话总结 +
/// 情绪/用药/陪聊微状态 + 今日暖心瞬间；在线进探视、离线给兜底。
class CareHomePage extends StatefulWidget {
  const CareHomePage({super.key});

  @override
  State<CareHomePage> createState() => _CareHomePageState();
}

class _CareHomePageState extends State<CareHomePage> {
  late Future<_CareData> _future;
  StreamSubscription<RealtimeEvent>? _sub;

  @override
  void initState() {
    super.initState();
    _future = _load();
    _sub = context.read<RealtimeService>().alertEvents.listen((_) {
      if (mounted) _refresh();
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<_CareData> _load() async {
    final targets = context.read<ServiceTargetRepository>();
    final alerts = context.read<AlertRepository>();
    final meds = context.read<MedicationRepository>();
    final devices = context.read<DeviceRepository>();

    final results = await Future.wait([
      targets.listMine().then<List<ServiceTarget>>((v) => v).catchError(
            (_) => <ServiceTarget>[],
          ),
      alerts.list().then<List<AlertItem>>((v) => v).catchError(
            (_) => <AlertItem>[],
          ),
      meds.todayDoses().then<List<MedicationDose>>((v) => v).catchError(
            (_) => <MedicationDose>[],
          ),
      devices
          .watchDevices()
          .first
          .timeout(const Duration(seconds: 6))
          .then<List<Device>>((v) => v)
          .catchError((_) => <Device>[]),
    ]);

    return _CareData(
      elders: results[0] as List<ServiceTarget>,
      alerts: results[1] as List<AlertItem>,
      doses: results[2] as List<MedicationDose>,
      devices: results[3] as List<Device>,
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('看护'),
        actions: [
          IconButton(
            tooltip: '通知',
            onPressed: () => context.push('/alerts'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_CareData>(
          future: _future,
          builder: (context, snapshot) {
            final data = snapshot.data ?? const _CareData.empty();
            final elder = data.elders.isNotEmpty ? data.elders.first : null;
            final device =
                data.devices.isNotEmpty ? data.devices.first : null;
            final online = device?.online ?? false;
            final hasAlert = data.pendingAlertCount > 0;
            return ListView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                glassNavClearance(context),
              ),
              children: [
                _StatusHero(
                  elderName: elder?.name ?? '家人',
                  online: online,
                  hasAlert: hasAlert,
                  deviceId: device?.deviceId,
                ),
                const SizedBox(height: AppSpacing.md),
                _MiniStats(
                  medsDue: data.medsDueCount,
                  online: online,
                ),
                const SizedBox(height: AppSpacing.md),
                const _WarmMoment(),
                if (hasAlert || data.medsDueCount > 0) ...[
                  const SizedBox(height: AppSpacing.md),
                  _TodoCard(
                    pendingAlerts: data.pendingAlertCount,
                    medsDue: data.medsDueCount,
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                _ElderEntry(elder: elder),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// 状态英雄卡：浅色玻璃 + 头像状态环，减少大片重蓝。
class _StatusHero extends StatelessWidget {
  const _StatusHero({
    required this.elderName,
    required this.online,
    required this.hasAlert,
    required this.deviceId,
  });

  final String elderName;
  final bool online;
  final bool hasAlert;
  final String? deviceId;

  String get _route => deviceId != null ? '/companion/$deviceId' : '/companion';
  String get _headline => hasAlert
      ? '有事需要您关注'
      : (online ? '$elderName 一切安好' : '$elderName 暂时离线');
  String get _summary => hasAlert
      ? '检测到待处理告警，请尽快查看处理。'
      : (online
          ? '今早 7:20 起床 · 已服药 · 和「小宝」聊了 8 分钟，情绪不错。'
          : '机器人当前不在线，最近一次在线约 12 分钟前。');

  @override
  Widget build(BuildContext context) {
    final accent = hasAlert ? AppColors.danger : AppColors.primary;
    return GlassCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _RingAvatar(
                  text: elderName.isNotEmpty ? elderName[0] : '亲',
                  online: online && !hasAlert),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_headline,
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: hasAlert
                                ? AppColors.danger
                                : AppColors.onSurface)),
                    const SizedBox(height: 4),
                    _StatusChip(online: online, hasAlert: hasAlert),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(_summary,
              style: const TextStyle(
                  height: 1.6, color: AppColors.onSurface, fontSize: 14)),
          const SizedBox(height: AppSpacing.md),
          if (online)
            _CtaButton(
              icon: Icons.videocam_rounded,
              label: '看 TA 现在',
              accent: accent,
              onTap: () => context.push(_route),
            )
          else
            Row(
              children: [
                Expanded(
                  child: _CtaButton(
                    icon: Icons.volunteer_activism_outlined,
                    label: '留言',
                    accent: accent,
                    outlined: true,
                    onTap: () => context.push('/ai/feed'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _CtaButton(
                    icon: Icons.phone_outlined,
                    label: '呼叫',
                    accent: accent,
                    onTap: () => context.push(_route),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _RingAvatar extends StatelessWidget {
  const _RingAvatar({required this.text, required this.online});
  final String text;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final ring = online ? AppColors.success : AppColors.onSurfaceMuted;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: ring, width: 2.5),
      ),
      child: CircleAvatar(
        radius: 26,
        backgroundColor: AppColors.primarySoft,
        child: Text(text,
            style: const TextStyle(
                color: AppColors.primary,
                fontSize: 22,
                fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.online, required this.hasAlert});
  final bool online;
  final bool hasAlert;

  @override
  Widget build(BuildContext context) {
    final (color, bg, text) = hasAlert
        ? (AppColors.danger, AppColors.dangerSoft, '需关注')
        : online
            ? (AppColors.success, AppColors.successSoft, '在线 · 守护中')
            : (AppColors.onSurfaceMuted, AppColors.surfaceVariant, '离线');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.round),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 8, color: color),
          const SizedBox(width: 5),
          Text(text,
              style: TextStyle(
                  color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _CtaButton extends StatelessWidget {
  const _CtaButton({
    required this.icon,
    required this.label,
    required this.accent,
    required this.onTap,
    this.outlined = false,
  });

  final IconData icon;
  final String label;
  final Color accent;
  final VoidCallback onTap;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    if (outlined) {
      return SizedBox(
        height: 48,
        child: OutlinedButton.icon(
          onPressed: onTap,
          icon: Icon(icon, size: 20),
          label: Text(label,
              style: const TextStyle(fontWeight: FontWeight.w700)),
          style: OutlinedButton.styleFrom(
            foregroundColor: accent,
            side: BorderSide(color: accent),
          ),
        ),
      );
    }
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: AppGradients.primary,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            onTap: onTap,
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Text(label,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 16)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 情绪 / 用药 / 陪聊 三个微状态。
class _MiniStats extends StatelessWidget {
  const _MiniStats({required this.medsDue, required this.online});
  final int medsDue;
  final bool online;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatPill(
            icon: Icons.sentiment_satisfied_alt,
            tint: AppColors.mint,
            tintBg: AppColors.mintSoft,
            label: '情绪',
            value: '愉快',
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: _StatPill(
            icon: Icons.medication_outlined,
            tint: medsDue > 0 ? AppColors.warning : AppColors.success,
            tintBg: medsDue > 0 ? AppColors.warningSoft : AppColors.successSoft,
            label: '用药',
            value: medsDue > 0 ? '待 $medsDue 次' : '已完成',
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: _StatPill(
            icon: Icons.forum_outlined,
            tint: AppColors.primary,
            tintBg: AppColors.primarySoft,
            label: '今日陪聊',
            value: online ? '8 分钟' : '—',
          ),
        ),
      ],
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.icon,
    required this.tint,
    required this.tintBg,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color tint;
  final Color tintBg;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.sm, horizontal: AppSpacing.xs),
      child: Column(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: tintBg, shape: BoxShape.circle),
            child: Icon(icon, color: tint, size: 20),
          ),
          const SizedBox(height: 6),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 1),
          Text(label,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.onSurfaceMuted)),
        ],
      ),
    );
  }
}

/// 今日暖心瞬间：让家属感到陪伴在发生。
class _WarmMoment extends StatelessWidget {
  const _WarmMoment();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFF4EC), Color(0xFFFDEFF4)],
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: const Color(0xFFF6E0D6)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFFFE2D2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.favorite, color: Color(0xFFEA8C66)),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('今日暖心瞬间',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 14)),
                    const Spacer(),
                    Text('14:30',
                        style: TextStyle(
                            fontSize: 11, color: AppColors.onSurfaceMuted)),
                  ],
                ),
                const SizedBox(height: 4),
                const Text('「奶奶今天念叨想孙子了，我陪她翻了会儿老照片，她笑了好几次。」',
                    style: TextStyle(height: 1.6, color: AppColors.onSurface)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TodoCard extends StatelessWidget {
  const _TodoCard({required this.pendingAlerts, required this.medsDue});
  final int pendingAlerts;
  final int medsDue;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('今日待办',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: AppSpacing.sm),
          if (pendingAlerts > 0)
            _TodoLine(
              icon: Icons.warning_amber_rounded,
              color: AppColors.danger,
              text: '$pendingAlerts 条告警待处理',
              onTap: () => context.push('/alerts'),
            ),
          if (pendingAlerts > 0 && medsDue > 0)
            const SizedBox(height: AppSpacing.xs),
          if (medsDue > 0)
            _TodoLine(
              icon: Icons.medication_outlined,
              color: AppColors.warning,
              text: '$medsDue 次用药待确认',
              onTap: () => context.push('/medications'),
            ),
        ],
      ),
    );
  }
}

class _TodoLine extends StatelessWidget {
  const _TodoLine(
      {required this.icon,
      required this.color,
      required this.text,
      required this.onTap});

  final IconData icon;
  final Color color;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(text, style: const TextStyle(fontSize: 15))),
            const Icon(Icons.chevron_right, color: AppColors.onSurfaceMuted),
          ],
        ),
      ),
    );
  }
}

class _ElderEntry extends StatelessWidget {
  const _ElderEntry({required this.elder});

  final ServiceTarget? elder;

  @override
  Widget build(BuildContext context) {
    if (elder == null) {
      return GlassCard(
        onTap: () => context.push('/family/add-elder'),
        child: const Row(
          children: [
            Icon(Icons.person_add_alt_1_outlined, color: AppColors.primary),
            SizedBox(width: AppSpacing.sm),
            Expanded(
                child: Text('添加被守护的长辈',
                    style: TextStyle(fontWeight: FontWeight.w600))),
            Icon(Icons.chevron_right, color: AppColors.onSurfaceMuted),
          ],
        ),
      );
    }
    return GlassCard(
      onTap: () => context.push('/health/${elder!.id}'),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppColors.primarySoft,
            child: Text(elder!.name.isNotEmpty ? elder!.name[0] : '?',
                style: const TextStyle(
                    color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(elder!.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
                const Text('健康档案 · 用药 · 情绪',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.onSurfaceMuted)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.onSurfaceMuted),
        ],
      ),
    );
  }
}

class _CareData {
  const _CareData({
    required this.elders,
    required this.alerts,
    required this.doses,
    required this.devices,
  });

  const _CareData.empty()
      : elders = const [],
        alerts = const [],
        doses = const [],
        devices = const [];

  final List<ServiceTarget> elders;
  final List<AlertItem> alerts;
  final List<MedicationDose> doses;
  final List<Device> devices;

  int get pendingAlertCount =>
      alerts.where((a) => a.status == AlertStatus.pending).length;
  int get medsDueCount => doses.where((d) => !d.taken).length;
}
