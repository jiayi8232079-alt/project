import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/medication.dart';
import '../../data/repositories/medication_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../theme/app_tokens.dart';

class MedicationPage extends StatefulWidget {
  const MedicationPage({super.key});

  @override
  State<MedicationPage> createState() => _MedicationPageState();
}

class _MedicationPageState extends State<MedicationPage> {
  late Future<List<MedicationDose>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<MedicationDose>> _load() =>
      context.read<MedicationRepository>().todayDoses();

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future.catchError((_) => <MedicationDose>[]);
  }

  Future<void> _checkIn(MedicationDose dose) async {
    if (_submitting || dose.taken || dose.time == '—') return;
    setState(() => _submitting = true);
    final repo = context.read<MedicationRepository>();
    final messenger = ScaffoldMessenger.of(context);
    try {
      await repo.checkIn(
        reminderId: dose.reminderId,
        scheduledDate: repo.today,
        scheduledTime: dose.time,
      );
      messenger.showSnackBar(
        const SnackBar(content: Text('已打卡')),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('用药计划')),
      body: AsyncView<List<MedicationDose>>(
        future: _future,
        onRetry: _refresh,
        builder: (context, doses) {
          if (doses.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.medication_outlined,
                    title: '今日暂无用药计划',
                    message: '医生或家属为老人创建用药提醒后，会在这里显示并支持打卡。',
                  ),
                ],
              ),
            );
          }
          final done = doses.where((d) => d.taken).length;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                SectionCard(
                  children: [
                    Text(
                      '今日进度 $done / ${doses.length}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    LinearProgressIndicator(
                      value: doses.isEmpty ? 0 : done / doses.length,
                      backgroundColor: AppColors.surfaceVariant,
                      color: AppColors.primary,
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(AppRadius.round),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                ...doses.map(
                  (dose) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: SectionCard(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${dose.time} · ${dose.medicineName}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                                  if (dose.dosage.isNotEmpty) Text(dose.dosage),
                                ],
                              ),
                            ),
                            FilledButton.tonal(
                              onPressed: dose.taken || _submitting
                                  ? null
                                  : () => _checkIn(dose),
                              child: Text(dose.taken ? '已服用' : '确认服用'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
