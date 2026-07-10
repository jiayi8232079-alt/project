import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/repositories/family_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../theme/app_tokens.dart';

/// 通过邀请码加入家庭。先查询确认家庭，再选择与家庭的关系后加入。
class JoinFamilyPage extends StatefulWidget {
  const JoinFamilyPage({super.key});

  @override
  State<JoinFamilyPage> createState() => _JoinFamilyPageState();
}

class _JoinFamilyPageState extends State<JoinFamilyPage> {
  final _codeCtrl = TextEditingController();
  final _nicknameCtrl = TextEditingController();
  String _relation = '子女';
  FamilyPreview? _preview;
  bool _loadingPreview = false;
  bool _submitting = false;
  String? _error;

  static const _relations = ['子女', '父母', '配偶', '孙辈', '亲属', '其他'];

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nicknameCtrl.dispose();
    super.dispose();
  }

  Future<void> _previewCode() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) {
      setState(() => _error = '请输入邀请码');
      return;
    }
    setState(() {
      _error = null;
      _loadingPreview = true;
      _preview = null;
    });
    try {
      final preview = await context.read<FamilyRepository>().previewByInviteCode(code);
      if (!mounted) return;
      if (preview == null) {
        setState(() => _error = '邀请码无效或已过期');
      } else {
        setState(() => _preview = preview);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loadingPreview = false);
    }
  }

  Future<void> _join() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) {
      setState(() => _error = '请输入邀请码');
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      await context.read<FamilyRepository>().joinByInviteCode(
            code: code,
            relation: _relation,
            nickname: _nicknameCtrl.text.trim(),
          );
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('已加入家庭')));
      router.go('/family');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('加入家庭')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          SectionCard(
            title: '邀请码',
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codeCtrl,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: '输入家属分享的邀请码',
                        prefixIcon: Icon(Icons.key_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  SizedBox(
                    height: 56,
                    child: OutlinedButton(
                      onPressed: _loadingPreview ? null : _previewCode,
                      child: _loadingPreview
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('查询'),
                    ),
                  ),
                ],
              ),
              if (_preview != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.home_outlined, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          '将加入「${_preview!.name}」'
                          '${_preview!.memberCount != null ? '（${_preview!.memberCount}位成员）' : ''}',
                          style: const TextStyle(
                            color: AppColors.primaryDark,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '我的身份',
            children: [
              DropdownButtonFormField<String>(
                initialValue: _relation,
                decoration: const InputDecoration(labelText: '与家庭的关系'),
                items: _relations
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (v) => setState(() => _relation = v ?? _relation),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _nicknameCtrl,
                decoration: const InputDecoration(labelText: '家庭内昵称（选填）'),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ],
          const SizedBox(height: AppSpacing.lg),
          ElevatedButton(
            onPressed: _submitting ? null : _join,
            child: _submitting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('加入家庭'),
          ),
        ],
      ),
    );
  }
}

/// 家庭内代建长辈（被服务人）。需要先有家庭群组。
class AddElderPage extends StatefulWidget {
  const AddElderPage({super.key});

  @override
  State<AddElderPage> createState() => _AddElderPageState();
}

class _AddElderPageState extends State<AddElderPage> {
  late Future<String?> _familyIdFuture;

  final _nameCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _relation = '父亲';
  String _gender = '男';
  bool _submitting = false;
  String? _error;

  static const _relations = [
    '父亲',
    '母亲',
    '祖父',
    '祖母',
    '外祖父',
    '外祖母',
    '配偶',
    '其他',
  ];

  @override
  void initState() {
    super.initState();
    _familyIdFuture = context.read<FamilyRepository>().firstFamilyId();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ageCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  String _delegatorRelation() {
    switch (_relation) {
      case '父亲':
      case '母亲':
        return 'child';
      case '配偶':
        return 'spouse';
      default:
        return 'other';
    }
  }

  Future<void> _submit(String groupId) async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = '请填写长辈姓名');
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      await context.read<FamilyRepository>().createElder(
            groupId: groupId,
            name: name,
            relation: _relation,
            delegatorRelation: _delegatorRelation(),
            gender: _gender,
            age: int.tryParse(_ageCtrl.text.trim()),
            phone: _phoneCtrl.text.trim(),
          );
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('已添加长辈')));
      router.go('/');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('添加长辈')),
      body: AsyncView<String?>(
        future: _familyIdFuture,
        onRetry: () => setState(
          () => _familyIdFuture =
              context.read<FamilyRepository>().firstFamilyId(),
        ),
        builder: (context, groupId) {
          if (groupId == null) {
            return EmptyState(
              icon: Icons.home_outlined,
              title: '还没有家庭',
              message: '请先在“家属圈”创建家庭，再添加需要守护的长辈。',
              actionLabel: '去创建家庭',
              onAction: () => context.go('/family'),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionCard(
                title: '长辈信息',
                children: [
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(labelText: '姓名 *'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  DropdownButtonFormField<String>(
                    initialValue: _relation,
                    decoration: const InputDecoration(labelText: '与您的关系'),
                    items: _relations
                        .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _relation = v ?? _relation),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _gender,
                          decoration: const InputDecoration(labelText: '性别'),
                          items: const [
                            DropdownMenuItem(value: '男', child: Text('男')),
                            DropdownMenuItem(value: '女', child: Text('女')),
                          ],
                          onChanged: (v) =>
                              setState(() => _gender = v ?? _gender),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: TextField(
                          controller: _ageCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: '年龄'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: '联系电话（选填）'),
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: _submitting ? null : () => _submit(groupId),
                child: _submitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('保存'),
              ),
            ],
          );
        },
      ),
    );
  }
}
