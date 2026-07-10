import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/parsing.dart';
import '../../data/repositories/family_repository.dart';
import '../../data/repositories/withkin_repository.dart';
import '../../shared/section_card.dart';
import '../../theme/app_tokens.dart';

class WithKinPage extends StatefulWidget {
  const WithKinPage({super.key});

  @override
  State<WithKinPage> createState() => _WithKinPageState();
}

class _WithKinPageState extends State<WithKinPage> {
  final _familyIdCtrl = TextEditingController(text: '1');
  final _elderIdCtrl = TextEditingController(text: '1');
  final _deviceIdCtrl = TextEditingController(text: '1');
  final _messageCtrl = TextEditingController(text: '爸，记得喝水。');
  final _taskTitleCtrl = TextEditingController(text: '提醒喝水');

  late Future<_WithKinState> _future;
  bool _submitting = false;
  int _volume = 70;
  int _brightness = 80;
  bool _communityContentEnabled = true;

  @override
  void initState() {
    super.initState();
    _future = _load();
    _bootstrapFamilyId();
  }

  @override
  void dispose() {
    _familyIdCtrl.dispose();
    _elderIdCtrl.dispose();
    _deviceIdCtrl.dispose();
    _messageCtrl.dispose();
    _taskTitleCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrapFamilyId() async {
    final id = await context.read<FamilyRepository>().firstFamilyId();
    if (!mounted || id == null || id.isEmpty) return;
    _familyIdCtrl.text = id;
    _refresh();
  }

  Future<_WithKinState> _load() async {
    final repo = context.read<WithKinRepository>();
    final familyId = _familyIdCtrl.text.trim();
    final deviceId = _deviceIdCtrl.text.trim();
    final results = await Future.wait<dynamic>([
      repo.communityContent(),
      repo.familyTasks(familyId),
      repo.voiceprints(familyId),
      repo.deviceSettings(deviceId).catchError((_) => <String, dynamic>{}),
    ]);
    final settings = Map<String, dynamic>.from(results[3] as Map);
    _volume = asInt(pick(settings, ['volume'])) ?? _volume;
    _brightness = asInt(pick(settings, ['screenBrightness'])) ?? _brightness;
    _communityContentEnabled = asBool(
      pick(settings, ['communityContentEnabled']),
      fallback: _communityContentEnabled,
    );
    return _WithKinState(
      communityContent: List<Map<String, dynamic>>.from(results[0] as List),
      familyTasks: List<Map<String, dynamic>>.from(results[1] as List),
      voiceprints: List<Map<String, dynamic>>.from(results[2] as List),
      deviceSettings: settings,
    );
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  Future<void> _run(Future<void> Function() action, String message) async {
    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(message)));
      _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _sendMessage() {
    return _run(() async {
      await context.read<WithKinRepository>().sendFamilyMessage(
            familyId: _familyIdCtrl.text.trim(),
            elderId: _elderIdCtrl.text.trim(),
            message: _messageCtrl.text.trim(),
          );
    }, '已发送给机器人和家属圈');
  }

  Future<void> _createTask() {
    return _run(() async {
      await context.read<WithKinRepository>().createFamilyTask(
            familyId: _familyIdCtrl.text.trim(),
            elderId: _elderIdCtrl.text.trim(),
            title: _taskTitleCtrl.text.trim(),
            message: _messageCtrl.text.trim(),
          );
    }, '家庭任务已创建');
  }

  Future<void> _saveDevice() {
    return _run(() async {
      await context.read<WithKinRepository>().saveDeviceSettings(
            deviceId: _deviceIdCtrl.text.trim(),
            volume: _volume,
            screenBrightness: _brightness,
            communityContentEnabled: _communityContentEnabled,
          );
    }, '设备设置已下发');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('家庭协同')),
      body: FutureBuilder<_WithKinState>(
        future: _future,
        builder: (context, snapshot) {
          final data = snapshot.data ?? _WithKinState.empty();
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                _HeroCard(
                  familyIdCtrl: _familyIdCtrl,
                  elderIdCtrl: _elderIdCtrl,
                  deviceIdCtrl: _deviceIdCtrl,
                  onRefresh: _refresh,
                ),
                const SizedBox(height: AppSpacing.md),
                _CommunityContentCard(items: data.communityContent),
                const SizedBox(height: AppSpacing.md),
                _FamilyActionCard(
                  messageCtrl: _messageCtrl,
                  taskTitleCtrl: _taskTitleCtrl,
                  submitting: _submitting,
                  onSendMessage: _sendMessage,
                  onCreateTask: _createTask,
                ),
                const SizedBox(height: AppSpacing.md),
                _TaskCard(items: data.familyTasks),
                const SizedBox(height: AppSpacing.md),
                _DeviceSettingsCard(
                  volume: _volume,
                  brightness: _brightness,
                  communityContentEnabled: _communityContentEnabled,
                  submitting: _submitting,
                  onVolumeChanged: (v) => setState(() => _volume = v.round()),
                  onBrightnessChanged: (v) =>
                      setState(() => _brightness = v.round()),
                  onCommunityChanged: (v) =>
                      setState(() => _communityContentEnabled = v),
                  onSave: _saveDevice,
                ),
                const SizedBox(height: AppSpacing.md),
                _VoiceprintCard(items: data.voiceprints),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.all(AppSpacing.lg),
                    child: Center(child: CircularProgressIndicator()),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _WithKinState {
  const _WithKinState({
    required this.communityContent,
    required this.familyTasks,
    required this.voiceprints,
    required this.deviceSettings,
  });

  factory _WithKinState.empty() => const _WithKinState(
        communityContent: [],
        familyTasks: [],
        voiceprints: [],
        deviceSettings: {},
      );

  final List<Map<String, dynamic>> communityContent;
  final List<Map<String, dynamic>> familyTasks;
  final List<Map<String, dynamic>> voiceprints;
  final Map<String, dynamic> deviceSettings;
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.familyIdCtrl,
    required this.elderIdCtrl,
    required this.deviceIdCtrl,
    required this.onRefresh,
  });

  final TextEditingController familyIdCtrl;
  final TextEditingController elderIdCtrl;
  final TextEditingController deviceIdCtrl;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      children: [
        Text(
          '家庭 · 社区 · 机器人',
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: AppSpacing.xs),
        const Text('把社区通知、家属提醒、设备偏好和声纹成员统一放在一个协同入口。'),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(child: _SmallField(label: '家庭ID', controller: familyIdCtrl)),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: _SmallField(label: '老人ID', controller: elderIdCtrl)),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: _SmallField(label: '设备ID', controller: deviceIdCtrl)),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton.icon(
          onPressed: onRefresh,
          icon: const Icon(Icons.refresh),
          label: const Text('刷新协同数据'),
        ),
      ],
    );
  }
}

class _CommunityContentCard extends StatelessWidget {
  const _CommunityContentCard({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: '社区消息',
      children: items.isEmpty
          ? const [Text('暂无社区内容。')]
          : items.take(5).map((item) {
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.campaign_outlined,
                    color: AppColors.primary),
                title: Text(pickString(item, ['title'], fallback: '社区通知')),
                subtitle: Text(pickString(item, ['body', 'summary'], fallback: '')),
              );
            }).toList(),
    );
  }
}

class _FamilyActionCard extends StatelessWidget {
  const _FamilyActionCard({
    required this.messageCtrl,
    required this.taskTitleCtrl,
    required this.submitting,
    required this.onSendMessage,
    required this.onCreateTask,
  });

  final TextEditingController messageCtrl;
  final TextEditingController taskTitleCtrl;
  final bool submitting;
  final VoidCallback onSendMessage;
  final VoidCallback onCreateTask;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: '家属投喂与任务',
      children: [
        TextField(
          controller: taskTitleCtrl,
          decoration: const InputDecoration(labelText: '任务标题'),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: messageCtrl,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(labelText: '想对长辈说的话'),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: submitting ? null : onSendMessage,
                child: const Text('发送留言'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: FilledButton(
                onPressed: submitting ? null : onCreateTask,
                child: const Text('创建提醒'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: '家庭任务',
      children: items.isEmpty
          ? const [Text('暂无家庭任务。')]
          : items.take(5).map((item) {
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.task_alt, color: AppColors.mint),
                title: Text(pickString(item, ['title'], fallback: '家庭任务')),
                subtitle: Text(
                  [
                    pickString(item, ['status'], fallback: ''),
                    pickString(item, ['elderResponse'], fallback: ''),
                  ].where((e) => e.isNotEmpty).join(' · '),
                ),
              );
            }).toList(),
    );
  }
}

class _DeviceSettingsCard extends StatelessWidget {
  const _DeviceSettingsCard({
    required this.volume,
    required this.brightness,
    required this.communityContentEnabled,
    required this.submitting,
    required this.onVolumeChanged,
    required this.onBrightnessChanged,
    required this.onCommunityChanged,
    required this.onSave,
  });

  final int volume;
  final int brightness;
  final bool communityContentEnabled;
  final bool submitting;
  final ValueChanged<double> onVolumeChanged;
  final ValueChanged<double> onBrightnessChanged;
  final ValueChanged<bool> onCommunityChanged;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: '机器人设置',
      children: [
        Text('音量：$volume'),
        Slider(value: volume.toDouble(), min: 0, max: 100, onChanged: onVolumeChanged),
        Text('屏幕亮度：$brightness'),
        Slider(
          value: brightness.toDouble(),
          min: 0,
          max: 100,
          onChanged: onBrightnessChanged,
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('允许社区内容播报'),
          value: communityContentEnabled,
          onChanged: onCommunityChanged,
        ),
        FilledButton(
          onPressed: submitting ? null : onSave,
          child: const Text('保存并下发到设备'),
        ),
      ],
    );
  }
}

class _VoiceprintCard extends StatelessWidget {
  const _VoiceprintCard({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: '声纹成员',
      children: items.isEmpty
          ? const [Text('暂无声纹成员。')]
          : items.take(6).map((item) {
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.record_voice_over_outlined,
                    color: AppColors.primary),
                title: Text('成员 ${pickString(item, ['memberId'], fallback: '-')}'),
                subtitle: Text(pickString(item, ['status'], fallback: '待录入')),
              );
            }).toList(),
    );
  }
}

class _SmallField extends StatelessWidget {
  const _SmallField({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label),
    );
  }
}
