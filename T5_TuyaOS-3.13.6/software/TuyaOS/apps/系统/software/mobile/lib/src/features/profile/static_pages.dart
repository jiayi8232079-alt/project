import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../shared/section_card.dart';
import '../../theme/app_tokens.dart';

class PrivacyPage extends StatelessWidget {
  const PrivacyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('隐私与用户协议')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: const [
          SectionCard(
            title: '隐私政策摘要',
            children: [
              _Para('我们非常重视您与家人的隐私与健康数据安全。本应用仅在为您提供陪护、陪诊、健康管理服务所必需的范围内收集和使用信息。'),
              _Para('• 收集信息：账号信息、服务对象（老人）基础档案、用药与健康记录、设备与告警数据。'),
              _Para('• 使用目的：订单履约、用药提醒、健康预警、家属协同与客服支持。'),
              _Para('• 数据共享：除法律法规要求或为完成服务所必需（如指派陪诊员），不会向第三方提供您的个人信息。'),
              _Para('• 数据安全：传输加密、最小化留存、按层级脱敏；您可随时申请导出或删除个人数据。'),
            ],
          ),
          SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '用户协议要点',
            children: [
              _Para('使用本应用即表示您同意遵守平台服务规则，并对在本应用中提交的信息真实性负责。'),
              _Para('医疗健康相关内容仅供参考，不能替代专业医生的诊断与治疗建议。'),
            ],
          ),
          SizedBox(height: AppSpacing.md),
          SectionCard(
            children: [
              _Para('如对隐私政策有任何疑问，请通过“帮助与客服”联系我们。'),
            ],
          ),
        ],
      ),
    );
  }
}

class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('帮助与关于')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Center(
            child: Column(
              children: [
                const SizedBox(height: AppSpacing.lg),
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.primarySoft,
                  child: Icon(Icons.favorite,
                      color: AppColors.primary, size: 36),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  AppConfig.appName,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const Text('版本 1.0.0',
                    style: TextStyle(color: AppColors.onSurfaceMuted)),
                const SizedBox(height: AppSpacing.lg),
              ],
            ),
          ),
          const SectionCard(
            title: '常见问题',
            children: [
              _FaqTile('如何为家人添加健康档案？', '在“健康”页可添加服务对象（老人），填写基础信息与慢病标签。'),
              _FaqTile('收不到告警怎么办？', '请确认已开启通知权限并保持登录；跌倒/SOS 等会实时推送到家属端。'),
              _FaqTile('如何预约陪诊服务？', '在“服务”页选择服务后点击预约，选择服务对象与时间即可下单。'),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: '联系我们',
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.phone, color: AppColors.primary),
                title: const Text('客服热线'),
                subtitle: const Text('400-000-0000（9:00–21:00）'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Para extends StatelessWidget {
  const _Para(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Text(text, style: const TextStyle(height: 1.6)),
    );
  }
}

class _FaqTile extends StatelessWidget {
  const _FaqTile(this.question, this.answer);

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: AppSpacing.sm),
        title: Text(question,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(answer,
                style: const TextStyle(color: AppColors.onSurfaceMuted)),
          ),
        ],
      ),
    );
  }
}
