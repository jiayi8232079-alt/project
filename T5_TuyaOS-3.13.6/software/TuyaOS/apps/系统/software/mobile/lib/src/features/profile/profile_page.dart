import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../shared/glass.dart';
import '../../shared/section_card.dart';
import '../../theme/accessibility_controller.dart';
import '../../theme/app_tokens.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('我的'),
        actions: [
          IconButton(
            tooltip: '编辑资料',
            onPressed: () => context.push('/profile/edit'),
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.md,
          glassNavClearance(context),
        ),
        children: [
          SectionCard(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: AppColors.primarySoft,
                    child: Text(
                      auth.displayName.isNotEmpty
                          ? auth.displayName[0]
                          : '我',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          auth.displayName,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          auth.phone?.isNotEmpty == true
                              ? auth.phone!
                              : '手机号未绑定',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '设备与服务',
            children: [
              _MenuTile(Icons.favorite_outline, '健康档案', () => context.push('/health')),
              _MenuTile(Icons.smart_toy_outlined, '我的设备', () => context.push('/devices')),
              _MenuTile(Icons.receipt_long_outlined, '我的订单', () => context.push('/orders')),
              _MenuTile(Icons.people_outline, '家属圈', () => context.push('/family')),
              _MenuTile(Icons.hub_outlined, '家庭协同', () => context.push('/withkin')),
              _MenuTile(Icons.chat_bubble_outline, 'AI 对话记录', () => context.push('/ai-dialogs')),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '账户',
            children: [
              _MenuTile(Icons.card_membership_outlined, '会员与订阅',
                  () => context.push('/membership')),
              _MenuTile(Icons.settings_outlined, '设置',
                  () => context.push('/settings')),
              _MenuTile(Icons.help_outline, '帮助与客服',
                  () => context.push('/about')),
              _MenuTile(Icons.privacy_tip_outlined, '隐私与用户协议',
                  () => context.push('/privacy')),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            children: [
              Text(
                '接口环境：${AppConfig.baseUrl}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton(
                onPressed: () => context.read<AuthController>().logout(),
                child: const Text('退出登录'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  static const _storage = FlutterSecureStorage();
  static const _kAlert = 'notif_alert';
  static const _kService = 'notif_service';

  bool _alertNotif = true;
  bool _serviceNotif = true;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final alert = await _storage.read(key: _kAlert);
    final service = await _storage.read(key: _kService);
    if (!mounted) return;
    setState(() {
      _alertNotif = alert != 'false';
      _serviceNotif = service != 'false';
    });
  }

  Future<void> _setAlert(bool v) async {
    setState(() => _alertNotif = v);
    await _storage.write(key: _kAlert, value: v.toString());
  }

  Future<void> _setService(bool v) async {
    setState(() => _serviceNotif = v);
    await _storage.write(key: _kService, value: v.toString());
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = context.watch<AccessibilityController>();

    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          SectionCard(
            title: '适老化',
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('老人模式'),
                subtitle: const Text('放大字号与按钮，更适合长辈使用'),
                value: accessibility.elderlyMode,
                onChanged: (v) => accessibility.setElderlyMode(v),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('字号大小'),
                subtitle: Slider(
                  value: accessibility.textScale,
                  min: 0.9,
                  max: 1.5,
                  divisions: 6,
                  label: accessibility.textScale.toStringAsFixed(2),
                  onChanged: (v) => accessibility.setTextScale(v),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '通知',
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('告警推送'),
                subtitle: const Text('跌倒、SOS、用药提醒等'),
                value: _alertNotif,
                onChanged: _setAlert,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('服务进展通知'),
                value: _serviceNotif,
                onChanged: _setService,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile(this.icon, this.title, this.onTap);

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: AppColors.primary),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
