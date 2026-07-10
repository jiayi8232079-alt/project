import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models/membership_info.dart';
import '../../data/repositories/membership_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../theme/app_tokens.dart';

class MembershipPage extends StatefulWidget {
  const MembershipPage({super.key});

  @override
  State<MembershipPage> createState() => _MembershipPageState();
}

class _MembershipPageState extends State<MembershipPage> {
  late Future<MembershipInfo> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<MembershipInfo> _load() => context.read<MembershipRepository>().me();

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('会员与订阅')),
      body: AsyncView<MembershipInfo>(
        future: _future,
        onRetry: _refresh,
        builder: (context, info) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              _MembershipCard(info: info),
              const SizedBox(height: AppSpacing.md),
              if (info.benefits.isNotEmpty)
                SectionCard(
                  title: '会员权益',
                  children: info.benefits
                      .map(
                        (b) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading:
                              Icon(Icons.verified, color: AppColors.primary),
                          title: Text(b),
                        ),
                      )
                      .toList(),
                ),
              if (!info.hasMembership)
                SectionCard(
                  children: [
                    const Text('您还不是会员。开通孝心年卡，享受更多陪护权益。'),
                    const SizedBox(height: AppSpacing.md),
                    FilledButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('在线开通即将上线，请联系客服办理')),
                        );
                      },
                      child: const Text('了解会员权益'),
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}

class _MembershipCard extends StatelessWidget {
  const _MembershipCard({required this.info});

  final MembershipInfo info;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primaryDark, AppColors.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.card_membership, color: Colors.white),
              const SizedBox(width: AppSpacing.xs),
              Text(
                info.hasMembership
                    ? (info.levelName ?? (info.isAnnualMember ? '孝心年卡会员' : '会员'))
                    : '普通用户',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (info.expireAt != null)
            Text(
              '有效期至 ${info.expireAt}',
              style: const TextStyle(color: Colors.white70),
            ),
          if (info.points != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '积分 ${info.points}',
                style: const TextStyle(color: Colors.white70),
              ),
            ),
          if (!info.hasMembership)
            const Text(
              '开通会员享受专属权益',
              style: TextStyle(color: Colors.white70),
            ),
        ],
      ),
    );
  }
}
