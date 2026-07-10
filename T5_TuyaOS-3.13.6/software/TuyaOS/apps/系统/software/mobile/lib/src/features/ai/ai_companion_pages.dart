import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/parsing.dart';
import '../../data/repositories/companion_repository.dart';
import '../../data/repositories/content_repository.dart';
import '../../data/repositories/family_repository.dart';
import '../../data/repositories/withkin_repository.dart';
import '../../shared/section_card.dart';
import '../../theme/app_tokens.dart';

void _toast(BuildContext context, String msg) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
  );
}

// ───────────────────────── B2 人格管理 ─────────────────────────

class AiPersonaPage extends StatefulWidget {
  const AiPersonaPage({super.key});

  @override
  State<AiPersonaPage> createState() => _AiPersonaPageState();
}

class _AiPersonaPageState extends State<AiPersonaPage> {
  final _nameCtrl = TextEditingController(text: '小伴');
  final _catchphraseCtrl = TextEditingController();
  String _personality = 'warm';
  double _speechRate = 1.0;

  String _familyId = '1';
  bool _loading = true;
  bool _saving = false;

  static const _personalities = <String, String>{
    'warm': '温暖',
    'lively': '活泼',
    'calm': '沉稳',
  };

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _catchphraseCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final id = await context.read<FamilyRepository>().firstFamilyId();
    if (id != null && id.isNotEmpty) _familyId = id;
    await _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final persona =
          await context.read<CompanionRepository>().getPersona(_familyId);
      _nameCtrl.text = pickString(persona, ['nickname'], fallback: '小伴');
      _personality = pickString(persona, ['personality'], fallback: 'warm');
      _speechRate = asDouble(pick(persona, ['speechRate'])) ?? 1.0;
      _catchphraseCtrl.text =
          pickString(persona, ['catchphrase'], fallback: '');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await context.read<CompanionRepository>().upsertPersona(
            familyId: _familyId,
            nickname: _nameCtrl.text.trim(),
            personality: _personality,
            speechRate: _speechRate,
            catchphrase: _catchphraseCtrl.text.trim(),
          );
      if (mounted) _toast(context, '已保存人格设置');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('人格管理')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                SectionCard(
                  title: '它的名字',
                  children: [
                    TextField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(
                        labelText: '老人给它起的名',
                        prefixIcon: Icon(Icons.badge_outlined),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '性格',
                  children: [
                    Wrap(
                      spacing: AppSpacing.xs,
                      children: _personalities.entries
                          .map((e) => ChoiceChip(
                                label: Text(e.value),
                                selected: _personality == e.key,
                                onSelected: (_) =>
                                    setState(() => _personality = e.key),
                              ))
                          .toList(),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '语速',
                  children: [
                    Slider(
                      value: _speechRate,
                      min: 0.5,
                      max: 2.0,
                      divisions: 15,
                      label: _speechRate.toStringAsFixed(1),
                      onChanged: (v) => setState(() => _speechRate = v),
                    ),
                    Text('当前语速：${_speechRate.toStringAsFixed(1)} 倍',
                        style:
                            const TextStyle(color: AppColors.onSurfaceMuted)),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '口头禅',
                  children: [
                    TextField(
                      controller: _catchphraseCtrl,
                      decoration: const InputDecoration(
                        labelText: '可选，例如「我在呢」',
                        prefixIcon: Icon(Icons.chat_bubble_outline),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? '保存中…' : '保存'),
                ),
              ],
            ),
    );
  }
}

// ───────────────────────── B3 记忆管理 ─────────────────────────

class AiMemoryPage extends StatefulWidget {
  const AiMemoryPage({super.key});

  @override
  State<AiMemoryPage> createState() => _AiMemoryPageState();
}

class _AiMemoryPageState extends State<AiMemoryPage> {
  String _familyId = '1';
  bool _loading = true;
  List<Map<String, dynamic>> _memories = const [];

  static const _scopeLabels = <String, String>{
    'member_identity': '身份',
    'member_private': '个人',
    'family_shared': '家庭',
    'health_fact': '健康',
    'robot_relation': '关系',
  };

  static const _scopeIcons = <String, IconData>{
    'member_identity': Icons.person_outline,
    'member_private': Icons.lock_outline,
    'family_shared': Icons.family_restroom_outlined,
    'health_fact': Icons.favorite_outline,
    'robot_relation': Icons.smart_toy_outlined,
  };

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final id = await context.read<FamilyRepository>().firstFamilyId();
    if (id != null && id.isNotEmpty) _familyId = id;
    await _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final list = await context.read<CompanionRepository>().recall(_familyId);
      if (mounted) setState(() => _memories = list);
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _correct(Map<String, dynamic> memory) async {
    final id = asInt(pick(memory, ['id']));
    if (id == null) return;
    final repo = context.read<CompanionRepository>();
    final ctrl = TextEditingController(
      text: pickString(memory, ['content'], fallback: ''),
    );
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('纠正记忆'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (result == null || result.isEmpty) return;
    try {
      await repo.correct(id, result);
      if (mounted) _toast(context, '已纠正');
      await _load();
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    }
  }

  Future<void> _forget(Map<String, dynamic> memory) async {
    final id = asInt(pick(memory, ['id']));
    if (id == null) return;
    final repo = context.read<CompanionRepository>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除记忆'),
        content: const Text('确认让机器人遗忘这条记忆吗？（遵循 PIPL，可删除）'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await repo.forget(id);
      if (mounted) _toast(context, '已遗忘该记忆');
      await _load();
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('它记住了什么'),
        actions: [
          IconButton(
            tooltip: '刷新',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
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
                                '这些是机器人记住的事，记错可纠正、可删除（遵循 PIPL）。默认不展示成员私密记忆。',
                                style:
                                    TextStyle(color: AppColors.onSurfaceMuted)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (_memories.isEmpty)
                    const SectionCard(children: [Text('暂无记忆。')])
                  else
                    for (final m in _memories) ...[
                      SectionCard(
                        children: [
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(
                              backgroundColor: AppColors.primarySoft,
                              child: Icon(
                                _scopeIcons[pickString(m, ['scope'])] ??
                                    Icons.notes_outlined,
                                color: AppColors.primary,
                              ),
                            ),
                            title: Text(
                              pickString(m, ['content'], fallback: '—'),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              _scopeLabels[pickString(m, ['scope'])] ??
                                  pickString(m, ['scope'], fallback: '记忆'),
                            ),
                            trailing: PopupMenuButton<String>(
                              onSelected: (v) {
                                if (v == '纠正') _correct(m);
                                if (v == '删除') _forget(m);
                              },
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: '纠正', child: Text('纠正')),
                                PopupMenuItem(value: '删除', child: Text('删除')),
                              ],
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

// ───────────────────────── B4 远程投喂 ─────────────────────────

class FamilyFeedPage extends StatefulWidget {
  const FamilyFeedPage({super.key});

  @override
  State<FamilyFeedPage> createState() => _FamilyFeedPageState();
}

class _FamilyFeedPageState extends State<FamilyFeedPage> {
  final _ctrl = TextEditingController();
  static const _templates = [
    '提醒我妈今天多喝水',
    '替我跟我爸说生日快乐',
    '这周末我回去看他',
    '最近多陪她聊聊天',
  ];

  String _familyId = '1';
  bool _loading = true;
  bool _submitting = false;
  List<Map<String, dynamic>> _tasks = const [];

  static const _statusLabels = <String, String>{
    'pending': '待转达',
    'sent': '已下发',
    'broadcasted': '已转达',
    'responded': '老人已回应',
    'cancelled': '已取消',
  };

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final id = await context.read<FamilyRepository>().firstFamilyId();
    if (id != null && id.isNotEmpty) _familyId = id;
    await _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final list =
          await context.read<WithKinRepository>().familyTasks(_familyId);
      if (mounted) setState(() => _tasks = list);
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) {
      _toast(context, '请输入要转达的话');
      return;
    }
    final repo = context.read<WithKinRepository>();
    setState(() => _submitting = true);
    try {
      final title = text.length > 12 ? '${text.substring(0, 12)}…' : text;
      await repo.createFamilyTask(
        familyId: _familyId,
        elderId: '1',
        title: title,
        message: text,
      );
      _ctrl.clear();
      if (mounted) _toast(context, '已下发，机器人会替您转达');
      await _load();
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  bool _isDone(String status) =>
      status == 'broadcasted' || status == 'responded';

  String _statusText(Map<String, dynamic> task) {
    final status = pickString(task, ['status'], fallback: 'pending');
    final reply = pickString(task, ['elderResponse'], fallback: '');
    final base = _statusLabels[status] ?? status;
    return reply.isEmpty ? base : '$base · 老人回应「$reply」';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('远程投喂')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          SectionCard(
            title: '替我关心 TA',
            children: [
              TextField(
                controller: _ctrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: '输入想让机器人替您转达 / 提醒的话…',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: _templates
                    .map((t) => ActionChip(
                          label: Text(t),
                          onPressed: () => setState(() => _ctrl.text = t),
                        ))
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.sm),
              ElevatedButton.icon(
                onPressed: _submitting ? null : _send,
                icon: const Icon(Icons.send),
                label: Text(_submitting ? '下发中…' : '下发给机器人'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '转达回执',
            children: [
              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_tasks.isEmpty)
                const Text('暂无转达记录。')
              else
                for (var i = 0; i < _tasks.length && i < 8; i++) ...[
                  if (i > 0) const Divider(height: AppSpacing.lg),
                  _FeedReceipt(
                    text: pickString(_tasks[i], ['title'], fallback: '转达'),
                    status: _statusText(_tasks[i]),
                    time: pickString(_tasks[i], ['updatedAt', 'createdAt'],
                        fallback: ''),
                    done: _isDone(
                        pickString(_tasks[i], ['status'], fallback: '')),
                  ),
                ],
            ],
          ),
        ],
      ),
    );
  }
}

class _FeedReceipt extends StatelessWidget {
  const _FeedReceipt(
      {required this.text,
      required this.status,
      required this.time,
      required this.done});

  final String text;
  final String status;
  final String time;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(done ? Icons.check_circle : Icons.schedule,
            color: done ? AppColors.success : AppColors.warning),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(text,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(status,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.onSurfaceMuted)),
              Text(time,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.onSurfaceMuted)),
            ],
          ),
        ),
      ],
    );
  }
}

// ───────────────────────── B5 内容点播 ─────────────────────────

class ContentLibraryPage extends StatefulWidget {
  const ContentLibraryPage({super.key});

  @override
  State<ContentLibraryPage> createState() => _ContentLibraryPageState();
}

class _ContentLibraryPageState extends State<ContentLibraryPage> {
  static const _categories = <(String, String)>[
    ('全部', ''),
    ('戏曲', 'xiqu'),
    ('评书', 'pingshu'),
    ('老歌', 'song'),
    ('新闻', 'news'),
    ('健康科普', 'health'),
    ('广播剧', 'drama'),
    ('故事', 'story'),
  ];

  String _category = '';
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
      final list = await context
          .read<ContentRepository>()
          .list(category: _category.isEmpty ? null : _category);
      if (mounted) setState(() => _items = list);
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _play(Map<String, dynamic> item) async {
    final id = asInt(pick(item, ['id']));
    if (id == null) return;
    final title = pickString(item, ['title'], fallback: '内容');
    try {
      await context.read<ContentRepository>().play(id);
      if (mounted) _toast(context, '已让机器人播放：$title');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('内容点播'),
        actions: [
          IconButton(
            tooltip: '刷新',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              itemCount: _categories.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
              itemBuilder: (_, i) {
                final cat = _categories[i];
                return ChoiceChip(
                  label: Text(cat.$1),
                  selected: _category == cat.$2,
                  onSelected: (_) {
                    setState(() => _category = cat.$2);
                    _load();
                  },
                );
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? const Center(child: Text('该分类暂无内容。'))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          children: [
                            for (final it in _items) ...[
                              SectionCard(
                                children: [
                                  ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: const CircleAvatar(
                                      backgroundColor: AppColors.primarySoft,
                                      child: Icon(Icons.music_note,
                                          color: AppColors.primary),
                                    ),
                                    title: Text(
                                      pickString(it, ['title'], fallback: '内容'),
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: Text(
                                      pickString(it, ['description', 'duration'],
                                          fallback: ''),
                                    ),
                                    trailing: IconButton(
                                      icon: const Icon(Icons.play_circle_fill,
                                          color: AppColors.primary, size: 34),
                                      onPressed: () => _play(it),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────── B6 主动惦记 ─────────────────────────

class ProactiveSettingsPage extends StatefulWidget {
  const ProactiveSettingsPage({super.key});

  @override
  State<ProactiveSettingsPage> createState() => _ProactiveSettingsPageState();
}

class _ProactiveSettingsPageState extends State<ProactiveSettingsPage> {
  bool _morning = true;
  bool _meals = false;
  bool _night = true;
  bool _anniversary = true;
  bool _longTime = true;
  double _frequency = 2;

  String _familyId = '1';
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic> _traits = {};

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final id = await context.read<FamilyRepository>().firstFamilyId();
    if (id != null && id.isNotEmpty) _familyId = id;
    await _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final persona =
          await context.read<CompanionRepository>().getPersona(_familyId);
      _traits = asMap(pick(persona, ['traits'])) ?? {};
      final p = asMap(_traits['proactive']) ?? {};
      _morning = asBool(p['morning'], fallback: _morning);
      _meals = asBool(p['meals'], fallback: _meals);
      _night = asBool(p['night'], fallback: _night);
      _anniversary = asBool(p['anniversary'], fallback: _anniversary);
      _longTime = asBool(p['longTime'], fallback: _longTime);
      _frequency = asDouble(p['frequency']) ?? _frequency;
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final merged = Map<String, dynamic>.from(_traits);
      merged['proactive'] = {
        'morning': _morning,
        'meals': _meals,
        'night': _night,
        'anniversary': _anniversary,
        'longTime': _longTime,
        'frequency': _frequency.round(),
      };
      await context
          .read<CompanionRepository>()
          .upsertPersona(familyId: _familyId, traits: merged);
      _traits = merged;
      if (mounted) _toast(context, '已保存主动惦记设置');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('主动惦记')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                SectionCard(
                  title: '让它主动开口',
                  children: [
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('早安问候'),
                      value: _morning,
                      onChanged: (v) => setState(() => _morning = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('三餐提醒'),
                      value: _meals,
                      onChanged: (v) => setState(() => _meals = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('睡前关怀'),
                      value: _night,
                      onChanged: (v) => setState(() => _night = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('纪念日 / 生日'),
                      value: _anniversary,
                      onChanged: (v) => setState(() => _anniversary = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('久未联系主动惦记'),
                      subtitle: const Text('几天没聊会主动说「有点想您」'),
                      value: _longTime,
                      onChanged: (v) => setState(() => _longTime = v),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '打扰频率（每天上限）',
                  children: [
                    Slider(
                      value: _frequency,
                      min: 1,
                      max: 6,
                      divisions: 5,
                      label: '${_frequency.round()} 次',
                      onChanged: (v) => setState(() => _frequency = v),
                    ),
                    const Text('勿扰时段（22:00 - 07:00）不打扰；老人说「别老叫我」会自动降频。',
                        style: TextStyle(color: AppColors.onSurfaceMuted)),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? '保存中…' : '保存'),
                ),
              ],
            ),
    );
  }
}
