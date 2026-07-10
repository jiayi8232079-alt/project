import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../shared/glass.dart';
import '../../theme/app_tokens.dart';

/// Tab「伴聊 AI」聚合页：人格名片 + 彩色功能入口 + 主动惦记 + 最近陪聊气泡。
class AiHubPage extends StatelessWidget {
  const AiHubPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('伴聊 AI')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.md,
          glassNavClearance(context),
        ),
        children: [
          const _PersonaCard(
            nickname: '小宝',
            archetype: '像自家孙辈',
            mood: '今天有点想您',
            intimacy: 62,
            stage: '熟络期',
          ),
          const SizedBox(height: AppSpacing.md),
          const _FeatureGrid(),
          const SizedBox(height: AppSpacing.sm),
          _ProactiveRow(),
          const SizedBox(height: AppSpacing.sm),
          _RecentChat(),
        ],
      ),
    );
  }
}

class _PersonaCard extends StatelessWidget {
  const _PersonaCard({
    required this.nickname,
    required this.archetype,
    required this.mood,
    required this.intimacy,
    required this.stage,
  });

  final String nickname;
  final String archetype;
  final String mood;
  final int intimacy;
  final String stage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: AppGradients.hero,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: Colors.white.withValues(alpha: 0.6), width: 2),
                ),
                child: const CircleAvatar(
                  radius: 26,
                  backgroundColor: Colors.white24,
                  child: Icon(Icons.smart_toy, color: Colors.white, size: 28),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('「$nickname」',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800)),
                    Text(archetype,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 13)),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(AppRadius.round),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.favorite, size: 12, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(mood,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Text('$stage · 亲密度',
                  style: const TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.round),
                  child: LinearProgressIndicator(
                    value: intimacy / 100,
                    minHeight: 8,
                    backgroundColor: Colors.white24,
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text('$intimacy',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }
}

class _FeatureGrid extends StatelessWidget {
  const _FeatureGrid();

  @override
  Widget build(BuildContext context) {
    const purple = Color(0xFF7C6CF0);
    const purpleBg = Color(0xFFEDEAFB);
    const warm = Color(0xFFEA8C66);
    const warmBg = Color(0xFFFCECE2);
    const a = _Feat(Icons.face_retouching_natural, '人格', '起名 · 性格 · 亲密度',
        AppColors.primary, AppColors.primarySoft, '/ai/persona');
    const b = _Feat(Icons.psychology_outlined, '记忆', '它记住了什么', purple,
        purpleBg, '/ai/memory');
    const c = _Feat(Icons.volunteer_activism_outlined, '远程投喂', '替我关心 TA',
        warm, warmBg, '/ai/feed');
    const d = _Feat(Icons.library_music_outlined, '内容点播', '戏曲 · 评书 · 老歌',
        AppColors.mint, AppColors.mintSoft, '/ai/content');
    return Column(
      children: [
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _FeatCard(feat: a)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _FeatCard(feat: b)),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _FeatCard(feat: c)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _FeatCard(feat: d)),
            ],
          ),
        ),
      ],
    );
  }
}

class _FeatCard extends StatelessWidget {
  const _FeatCard({required this.feat});
  final _Feat feat;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push(feat.route),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration:
                BoxDecoration(color: feat.tintBg, shape: BoxShape.circle),
            child: Icon(feat.icon, color: feat.tint, size: 22),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(feat.title,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 2),
          Text(feat.desc,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.onSurfaceMuted)),
        ],
      ),
    );
  }
}

class _Feat {
  const _Feat(
      this.icon, this.title, this.desc, this.tint, this.tintBg, this.route);
  final IconData icon;
  final String title;
  final String desc;
  final Color tint;
  final Color tintBg;
  final String route;
}

class _ProactiveRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push('/ai/proactive'),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
                color: AppColors.warningSoft, shape: BoxShape.circle),
            child: const Icon(Icons.notifications_active_outlined,
                color: AppColors.warning),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('主动惦记',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text('晨问候 · 回访 · 纪念日 · 久未联系',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.onSurfaceMuted)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.onSurfaceMuted),
        ],
      ),
    );
  }
}

class _RecentChat extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push('/ai-dialogs'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('最近陪聊',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const Spacer(),
              Text('查看全部',
                  style: TextStyle(fontSize: 12, color: AppColors.primary)),
              const Icon(Icons.chevron_right,
                  size: 16, color: AppColors.primary),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const _Bubble(
              text: '奶奶，今早的小米粥香不香呀？膝盖还疼不疼？', fromRobot: true),
          const SizedBox(height: AppSpacing.xs),
          const _Bubble(text: '今天不疼啦，粥也香，就是有点想孙子。', fromRobot: false),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.text, required this.fromRobot});
  final String text;
  final bool fromRobot;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: fromRobot ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.66),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        decoration: BoxDecoration(
          color: fromRobot ? AppColors.primarySoft : AppColors.mintSoft,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(AppRadius.md),
            topRight: const Radius.circular(AppRadius.md),
            bottomLeft: Radius.circular(fromRobot ? 2 : AppRadius.md),
            bottomRight: Radius.circular(fromRobot ? AppRadius.md : 2),
          ),
        ),
        child: Text(text,
            style: const TextStyle(fontSize: 13, height: 1.4)),
      ),
    );
  }
}
