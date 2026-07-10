import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../core/realtime/realtime_event.dart';
import '../../core/realtime/realtime_service.dart';
import '../../data/models/alert_item.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/alert_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/status_chip.dart';
import '../../theme/app_tokens.dart';

class AlertListPage extends StatefulWidget {
  const AlertListPage({super.key});

  @override
  State<AlertListPage> createState() => _AlertListPageState();
}

class _AlertListPageState extends State<AlertListPage> {
  late Future<List<AlertItem>> _future;
  StreamSubscription<RealtimeEvent>? _alertSub;

  @override
  void initState() {
    super.initState();
    _future = _load();
    // 新告警实时到达时自动刷新列表。
    _alertSub =
        context.read<RealtimeService>().alertEvents.listen((_) => _refresh());
  }

  @override
  void dispose() {
    _alertSub?.cancel();
    super.dispose();
  }

  Future<List<AlertItem>> _load() => context.read<AlertRepository>().list();

  Future<void> _refresh() async {
    if (!mounted) return;
    setState(() => _future = _load());
    await _future.catchError((_) => <AlertItem>[]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('告警中心')),
      body: AsyncView<List<AlertItem>>(
        future: _future,
        onRetry: _refresh,
        builder: (context, alerts) {
          if (alerts.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.notifications_none,
                    title: '暂无告警',
                    message: '一切正常。出现跌倒、SOS、用药漏服等情况时会在这里提醒您。',
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: alerts.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                final alert = alerts[index];
                return SectionCard(
                  children: [
                    InkWell(
                      onTap: () async {
                        await context.push('/alerts/${alert.id}');
                        if (context.mounted) _refresh();
                      },
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      child: Padding(
                        padding:
                            const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    alert.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                                AlertSeverityChip(severity: alert.severity),
                              ],
                            ),
                            if (alert.summary.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.xs),
                              Text(alert.summary),
                            ],
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              [alert.targetName, alert.occurredAt]
                                  .where((e) => e != null && e.isNotEmpty)
                                  .join(' · '),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class AlertDetailPage extends StatefulWidget {
  const AlertDetailPage({super.key, required this.alertId});

  final String alertId;

  @override
  State<AlertDetailPage> createState() => _AlertDetailPageState();
}

class _AlertDetailPageState extends State<AlertDetailPage> {
  late Future<AlertItem> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AlertItem> _load() =>
      context.read<AlertRepository>().detail(widget.alertId);

  void _refresh() => setState(() => _future = _load());

  Future<void> _acknowledge() async {
    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<AlertRepository>().acknowledge(widget.alertId);
      messenger.showSnackBar(const SnackBar(content: Text('已确认知悉')));
      _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('告警详情')),
      body: AsyncView<AlertItem>(
        future: _future,
        onRetry: _refresh,
        builder: (context, alert) {
          final canAck = alert.status == AlertStatus.pending;
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionCard(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          alert.title,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      AlertSeverityChip(severity: alert.severity),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (alert.summary.isNotEmpty) Text(alert.summary),
                  const SizedBox(height: AppSpacing.sm),
                  if (alert.targetName != null)
                    Text('服务对象：${alert.targetName}'),
                  Text('发生时间：${alert.occurredAt}'),
                  Text('状态：${_statusLabel(alert.status)}'),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: (!canAck || _submitting) ? null : _acknowledge,
                child: Text(canAck ? '确认知悉' : '已处理'),
              ),
            ],
          );
        },
      ),
    );
  }

  String _statusLabel(AlertStatus status) => switch (status) {
        AlertStatus.pending => '待处理',
        AlertStatus.acknowledged => '已确认',
        AlertStatus.closed => '已关闭',
      };
}
