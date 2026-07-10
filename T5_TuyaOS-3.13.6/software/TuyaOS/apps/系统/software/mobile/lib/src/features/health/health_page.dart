import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/models/medication.dart';
import '../../data/models/service_target.dart';
import '../../data/repositories/medication_repository.dart';
import '../../data/repositories/service_target_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../theme/app_tokens.dart';

class HealthPage extends StatefulWidget {
  const HealthPage({super.key});

  @override
  State<HealthPage> createState() => _HealthPageState();
}

class _HealthPageState extends State<HealthPage> {
  late Future<_HealthData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HealthData> _load() async {
    final targets = context.read<ServiceTargetRepository>().listMine();
    final doses = context
        .read<MedicationRepository>()
        .todayDoses()
        .catchError((_) => <MedicationDose>[]);
    final results = await Future.wait([targets, doses]);
    return _HealthData(
      targets: results[0] as List<ServiceTarget>,
      doses: results[1] as List<MedicationDose>,
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future.catchError(
      (_) => const _HealthData(targets: [], doses: []),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('健康')),
      body: AsyncView<_HealthData>(
        future: _future,
        onRetry: _refresh,
        builder: (context, data) {
          if (data.targets.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.favorite_outline,
                    title: '还没有健康档案',
                    message: '添加家中老人后，可在这里管理档案、用药与体征。',
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                SectionCard(
                  title: '家人健康档案',
                  children: data.targets
                      .map(
                        (target) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: AppColors.primarySoft,
                            child: Text(
                              target.name.isNotEmpty ? target.name[0] : '?',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          title: Text(
                            [
                              target.name,
                              if (target.relation != null) '（${target.relation}）',
                            ].join(),
                          ),
                          subtitle: Text(
                            [
                              if (target.age != null) '${target.age} 岁',
                              if (target.chronicTags.isNotEmpty)
                                target.chronicTags.join(' · '),
                            ].join(' · '),
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push('/health/${target.id}'),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '今日用药',
                  action: TextButton(
                    onPressed: () => context.push('/medications'),
                    child: const Text('全部计划'),
                  ),
                  children: data.doses.isEmpty
                      ? [
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                            child: Text(
                              '今日暂无用药计划',
                              style: TextStyle(color: AppColors.onSurfaceMuted),
                            ),
                          ),
                        ]
                      : data.doses
                          .map(
                            (dose) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                dose.taken
                                    ? Icons.check_circle
                                    : Icons.radio_button_unchecked,
                                color: dose.taken
                                    ? AppColors.success
                                    : AppColors.warning,
                              ),
                              title: Text('${dose.time} · ${dose.medicineName}'),
                              subtitle:
                                  dose.dosage.isEmpty ? null : Text(dose.dosage),
                            ),
                          )
                          .toList(),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HealthData {
  const _HealthData({required this.targets, required this.doses});

  final List<ServiceTarget> targets;
  final List<MedicationDose> doses;
}

class HealthProfilePage extends StatefulWidget {
  const HealthProfilePage({super.key, required this.targetId});

  final String targetId;

  @override
  State<HealthProfilePage> createState() => _HealthProfilePageState();
}

class _HealthProfilePageState extends State<HealthProfilePage> {
  late Future<ServiceTarget> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ServiceTarget> _load() =>
      context.read<ServiceTargetRepository>().detail(widget.targetId);

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('健康档案')),
      body: AsyncView<ServiceTarget>(
        future: _future,
        onRetry: _refresh,
        builder: (context, target) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionCard(
                title: '基础信息',
                children: [
                  _Row('姓名', target.name),
                  if (target.age != null) _Row('年龄', '${target.age} 岁'),
                  if (target.gender != null) _Row('性别', target.gender!),
                  if (target.relation != null) _Row('关系', target.relation!),
                  _Row('过敏史', target.allergy ?? '无'),
                  _Row('紧急联系人', target.emergencyContact ?? '未填写'),
                ],
              ),
              if (target.chronicTags.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '慢病标签',
                  children: [
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: target.chronicTags
                          .map(
                            (tag) => Chip(
                              label: Text(tag),
                              backgroundColor: AppColors.primarySoft,
                              side: BorderSide.none,
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(label,
                style: const TextStyle(color: AppColors.onSurfaceMuted)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
