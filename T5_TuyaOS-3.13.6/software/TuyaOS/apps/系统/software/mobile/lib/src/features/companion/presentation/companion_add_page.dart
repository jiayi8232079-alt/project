import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/glass.dart';
import '../../../theme/app_tokens.dart';

/// A4 · 配网向导：通电 → 找设备 → 连 Wi-Fi → 绑定长辈 → 完成。
/// 示意流程（接入涂鸦 IoT App SDK 后替换为真实配网）。
class CompanionAddPage extends StatefulWidget {
  const CompanionAddPage({super.key});

  @override
  State<CompanionAddPage> createState() => _CompanionAddPageState();
}

class _CompanionAddPageState extends State<CompanionAddPage> {
  int _step = 0;
  final _wifiCtrl = TextEditingController(text: 'Home-5G');
  final _pwdCtrl = TextEditingController();
  String _elder = '张奶奶';

  static const _elders = ['张奶奶', '李爷爷', '+ 添加新长辈'];

  @override
  void dispose() {
    _wifiCtrl.dispose();
    _pwdCtrl.dispose();
    super.dispose();
  }

  void _next() {
    if (_step < 4) {
      setState(() => _step++);
    } else {
      context.go('/companion');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('添加机器人')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
              child: _StepBar(current: _step, total: 5),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: _buildStep(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _next,
                  child: Text(_step == 4 ? '完成' : '下一步',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return _StepBody(
          icon: Icons.power_settings_new,
          tint: AppColors.primary,
          title: '给机器人通电',
          desc: '插上电源，长按机器人头顶按钮约 3 秒，听到「叮」并看到蓝灯闪烁，即进入配网模式。',
        );
      case 1:
        return _StepBody(
          icon: Icons.wifi_find,
          tint: AppColors.mint,
          title: '正在搜索附近的机器人',
          desc: '请确保手机与机器人靠近。发现后点击选择。',
          extra: GlassCard(
            onTap: () {},
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: AppColors.mintSoft,
                  child: Icon(Icons.smart_toy, color: AppColors.mint),
                ),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('客厅小陪（T5-E1）',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      Text('信号良好 · 待配网',
                          style: TextStyle(
                              fontSize: 12, color: AppColors.onSurfaceMuted)),
                    ],
                  ),
                ),
                const Icon(Icons.check_circle, color: AppColors.success),
              ],
            ),
          ),
        );
      case 2:
        return _StepBody(
          icon: Icons.wifi,
          tint: AppColors.primary,
          title: '连接家里的 Wi-Fi',
          desc: '机器人需要联网才能远程陪伴。请选择 2.4G/5G Wi-Fi 并输入密码。',
          extra: Column(
            children: [
              TextField(
                controller: _wifiCtrl,
                decoration: const InputDecoration(
                  labelText: 'Wi-Fi 名称',
                  prefixIcon: Icon(Icons.wifi),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _pwdCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Wi-Fi 密码',
                  prefixIcon: Icon(Icons.lock_outline),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        );
      case 3:
        return _StepBody(
          icon: Icons.elderly,
          tint: AppColors.mint,
          title: '绑定要陪护的长辈',
          desc: '这台机器人将专属陪伴这位长辈，记忆与人格也归属于 TA。',
          extra: GlassCard(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _elder,
                items: _elders
                    .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                    .toList(),
                onChanged: (v) => setState(() => _elder = v ?? _elder),
              ),
            ),
          ),
        );
      default:
        return _StepBody(
          icon: Icons.check_circle,
          tint: AppColors.success,
          title: '添加成功！',
          desc: '「客厅小陪」已绑定给 $_elder，现在就可以远程查看实时画面、控制云台、语音陪伴啦。',
        );
    }
  }
}

class _StepBar extends StatelessWidget {
  const _StepBar({required this.current, required this.total});
  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < total; i++) ...[
          _Dot(done: i < current, active: i == current, index: i),
          if (i < total - 1)
            Expanded(
              child: Container(
                height: 3,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: i < current
                      ? AppColors.primary
                      : AppColors.outline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.done, required this.active, required this.index});
  final bool done;
  final bool active;
  final int index;

  @override
  Widget build(BuildContext context) {
    final filled = done || active;
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? AppColors.primary : AppColors.surfaceVariant,
      ),
      alignment: Alignment.center,
      child: done
          ? const Icon(Icons.check, size: 15, color: Colors.white)
          : Text('${index + 1}',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: filled ? Colors.white : AppColors.onSurfaceMuted)),
    );
  }
}

class _StepBody extends StatelessWidget {
  const _StepBody({
    required this.icon,
    required this.tint,
    required this.title,
    required this.desc,
    this.extra,
  });

  final IconData icon;
  final Color tint;
  final String title;
  final String desc;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: AppSpacing.lg),
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            color: tint.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 48, color: tint),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(title,
            textAlign: TextAlign.center,
            style:
                const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: AppSpacing.sm),
        Text(desc,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: AppColors.onSurfaceMuted, height: 1.6)),
        if (extra != null) ...[
          const SizedBox(height: AppSpacing.xl),
          extra!,
        ],
      ],
    );
  }
}
