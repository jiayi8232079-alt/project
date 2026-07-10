import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/models/dialog.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/dialog_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../theme/app_tokens.dart';

class AiDialogListPage extends StatefulWidget {
  const AiDialogListPage({super.key});

  @override
  State<AiDialogListPage> createState() => _AiDialogListPageState();
}

class _AiDialogListPageState extends State<AiDialogListPage> {
  late Future<List<DialogSession>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<DialogSession>> _load() =>
      context.read<DialogRepository>().list();

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future.catchError((_) => <DialogSession>[]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI 对话记录')),
      body: AsyncView<List<DialogSession>>(
        future: _future,
        onRetry: _refresh,
        builder: (context, sessions) {
          if (sessions.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.smart_toy_outlined,
                    title: '暂无对话记录',
                    message: '老人与陪护机器人的对话会自动留存在这里，方便家属查看与回顾。',
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: sessions.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                final session = sessions[index];
                return SectionCard(
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primarySoft,
                        child: Icon(Icons.smart_toy, color: AppColors.primary),
                      ),
                      title: Text(session.summary),
                      subtitle: Text(
                        '${session.startedAt} · ${session.durationMin} 分钟 · ${session.messageCount} 条',
                      ),
                      trailing: session.hasCrisisWords
                          ? const Icon(Icons.warning_amber,
                              color: AppColors.danger)
                          : const Icon(Icons.chevron_right),
                      onTap: () => context.push('/ai-dialogs/${session.id}'),
                    ),
                  ],
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class AiDialogDetailPage extends StatefulWidget {
  const AiDialogDetailPage({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<AiDialogDetailPage> createState() => _AiDialogDetailPageState();
}

class _AiDialogDetailPageState extends State<AiDialogDetailPage> {
  late Future<DialogDetail> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<DialogDetail> _load() =>
      context.read<DialogRepository>().detail(widget.sessionId);

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('对话详情')),
      body: AsyncView<DialogDetail>(
        future: _future,
        onRetry: _refresh,
        builder: (context, detail) {
          if (detail.messages.isEmpty) {
            return const EmptyState(
              icon: Icons.chat_bubble_outline,
              title: '暂无对话内容',
              message: '该会话没有可显示的消息记录。',
            );
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: detail.messages.map((msg) {
              final isUser = msg.role == DialogRole.user;
              return Align(
                alignment:
                    isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.78,
                  ),
                  decoration: BoxDecoration(
                    color: isUser ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    boxShadow: isUser ? null : AppShadows.cardSoft,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        msg.text,
                        style: TextStyle(
                          color: isUser ? Colors.white : AppColors.onSurface,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        msg.time,
                        style: TextStyle(
                          fontSize: 11,
                          color:
                              isUser ? Colors.white70 : AppColors.onSurfaceMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}
