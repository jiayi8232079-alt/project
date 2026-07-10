import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../data/repositories/user_repository.dart';
import '../../shared/section_card.dart';
import '../../theme/app_tokens.dart';

class ProfileEditPage extends StatefulWidget {
  const ProfileEditPage({super.key});

  @override
  State<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends State<ProfileEditPage> {
  late final TextEditingController _nicknameCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthController>();
    _nicknameCtrl = TextEditingController(
      text: auth.displayName == '陪了个伴用户' ? '' : auth.displayName,
    );
  }

  @override
  void dispose() {
    _nicknameCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final nickname = _nicknameCtrl.text.trim();
    if (nickname.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入昵称')),
      );
      return;
    }
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final userRepo = context.read<UserRepository>();
    final auth = context.read<AuthController>();
    try {
      await userRepo.updateMe(nickname: nickname);
      await auth.refreshProfile(silent: true);
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('已保存')));
      router.pop();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return Scaffold(
      appBar: AppBar(title: const Text('编辑资料')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          SectionCard(
            title: '基本信息',
            children: [
              TextField(
                controller: _nicknameCtrl,
                decoration: const InputDecoration(labelText: '昵称'),
                maxLength: 20,
              ),
              const SizedBox(height: AppSpacing.xs),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('手机号'),
                trailing: Text(
                  auth.phone?.isNotEmpty == true ? auth.phone! : '未绑定',
                  style: const TextStyle(color: AppColors.onSurfaceMuted),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('保存'),
          ),
        ],
      ),
    );
  }
}
