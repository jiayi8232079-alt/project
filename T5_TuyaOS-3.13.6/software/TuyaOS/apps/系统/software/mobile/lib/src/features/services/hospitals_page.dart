import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/parsing.dart';
import '../../data/repositories/withkin_repository.dart';
import '../../shared/section_card.dart';
import '../../theme/app_tokens.dart';

/// 合作医院展示（对齐 23 篇 APP-P1-17）。
/// 仅展示平台有效协议内的合作医院资源，明确「不替代诊疗」。
class HospitalsPage extends StatefulWidget {
  const HospitalsPage({super.key});

  @override
  State<HospitalsPage> createState() => _HospitalsPageState();
}

class _HospitalsPageState extends State<HospitalsPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final list =
          await context.read<WithKinRepository>().hospitalPartnerships();
      if (mounted) setState(() => _items = list);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('合作医院')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  const SectionCard(
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info_outline,
                              size: 18, color: AppColors.primary),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                                '以下为平台合作医院资源，供转诊、复诊与陪诊衔接参考，不替代诊疗。',
                                style:
                                    TextStyle(color: AppColors.onSurfaceMuted)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (_items.isEmpty)
                    const SectionCard(children: [Text('暂无合作医院。')])
                  else
                    for (final h in _items) ...[
                      SectionCard(
                        children: [
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const CircleAvatar(
                              backgroundColor: AppColors.primarySoft,
                              child: Icon(Icons.local_hospital_outlined,
                                  color: AppColors.primary),
                            ),
                            title: Text(
                              pickString(h, ['hospitalName', 'name'],
                                  fallback: '合作医院'),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              pickString(h, ['partnershipType', 'type'],
                                  fallback: '合作'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                ],
              ),
            ),
    );
  }
}
