import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/family_member.dart';
import '../../data/repositories/family_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../theme/app_tokens.dart';

class FamilyPage extends StatefulWidget {
  const FamilyPage({super.key});

  @override
  State<FamilyPage> createState() => _FamilyPageState();
}

class _FamilyPageState extends State<FamilyPage> {
  late Future<List<FamilyMember>> _future;
  bool _loadingInvite = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<FamilyMember>> _load() =>
      context.read<FamilyRepository>().members();

  void _refresh() => setState(() => _future = _load());

  Future<void> _showInviteCode() async {
    setState(() => _loadingInvite = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final code = await context.read<FamilyRepository>().inviteCode();
      if (!mounted) return;
      if (code == null || code.isEmpty) {
        messenger.showSnackBar(
          const SnackBar(content: Text('暂未获取到邀请码，请先创建家庭群组')),
        );
        return;
      }
      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('家属邀请码'),
          content: Text(
            code,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('知道了'),
            ),
          ],
        ),
      );
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _loadingInvite = false);
    }
  }

  Future<void> _createFamily() async {
    final nameCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('创建家庭'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(labelText: '家庭名称，如“张家”'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('创建'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<FamilyRepository>().createFamily(name);
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('家庭已创建')));
      _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('家属圈')),
      body: AsyncView<List<FamilyMember>>(
        future: _future,
        onRetry: _refresh,
        builder: (context, members) {
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                SectionCard(
                  title: '已绑定家属',
                  children: members.isEmpty
                      ? [
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                            child: Text(
                              '还没有其他家属加入，生成邀请码邀请家人吧。',
                              style: TextStyle(color: AppColors.onSurfaceMuted),
                            ),
                          ),
                        ]
                      : members
                          .map(
                            (m) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                child: Text(m.name.isNotEmpty ? m.name[0] : '?'),
                              ),
                              title: Text('${m.name}（${m.relation}）'),
                              subtitle: Text(
                                [m.phone, m.role]
                                    .where((e) => e != null && e.isNotEmpty)
                                    .join(' · '),
                              ),
                            ),
                          )
                          .toList(),
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '邀请新家属',
                  children: [
                    const Text('生成邀请码，让家人输入或扫码加入家属圈。'),
                    const SizedBox(height: AppSpacing.md),
                    OutlinedButton(
                      onPressed: _loadingInvite ? null : _showInviteCode,
                      child: _loadingInvite
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('生成邀请码'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '家庭管理',
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.add_home_outlined,
                          color: AppColors.primary),
                      title: const Text('创建家庭'),
                      subtitle: const Text('还没有家庭？先创建一个'),
                      onTap: _createFamily,
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.group_add_outlined,
                          color: AppColors.primary),
                      title: const Text('加入家庭'),
                      subtitle: const Text('输入家人分享的邀请码'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/family/join'),
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.elderly_outlined,
                          color: AppColors.primary),
                      title: const Text('添加长辈'),
                      subtitle: const Text('为需要守护的长辈建立档案'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/family/add-elder'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

