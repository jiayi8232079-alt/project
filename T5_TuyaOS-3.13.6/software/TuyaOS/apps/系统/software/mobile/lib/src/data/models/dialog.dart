import 'enums.dart';
import 'parsing.dart';

/// AI 对话会话（对应 /ai-dialogs）。
class DialogSession {
  const DialogSession({
    required this.id,
    required this.startedAt,
    required this.durationMin,
    required this.summary,
    required this.hasCrisisWords,
    required this.messageCount,
  });

  final String id;
  final String startedAt;
  final int durationMin;
  final String summary;
  final bool hasCrisisWords;
  final int messageCount;

  factory DialogSession.fromJson(Map<String, dynamic> json) {
    final started = asDateTime(pick(json, ['startedAt', 'started_at']));
    final ended = asDateTime(pick(json, ['endedAt', 'ended_at']));
    final duration = (started != null && ended != null)
        ? ended.difference(started).inMinutes
        : 0;
    final crisisScore = asInt(pick(json, ['crisisScore', 'crisis_score'])) ?? 0;
    final crisisWords = asStringList(pick(json, ['crisisWords', 'crisis_words']));

    return DialogSession(
      id: pickString(json, ['id'], fallback: ''),
      startedAt: _formatDateTime(pick(json, ['startedAt', 'started_at'])),
      durationMin: duration < 0 ? 0 : duration,
      summary: pickString(json, ['summary'], fallback: '（暂无摘要）'),
      hasCrisisWords: crisisScore > 0 || crisisWords.isNotEmpty,
      messageCount: asInt(pick(json, ['totalTurns', 'total_turns', 'messageCount'])) ?? 0,
    );
  }
}

/// 单条对话消息。
class DialogMessage {
  const DialogMessage({
    required this.role,
    required this.text,
    required this.time,
  });

  final DialogRole role;
  final String text;
  final String time;

  factory DialogMessage.fromJson(Map<String, dynamic> json) {
    final direction = pickString(json, ['direction', 'role'], fallback: 'assistant');
    return DialogMessage(
      role: direction == 'user' ? DialogRole.user : DialogRole.assistant,
      text: pickString(json, ['text', 'content', 'message'], fallback: ''),
      time: _formatTime(pick(json, ['createdAt', 'created_at', 'time'])),
    );
  }
}

/// 会话详情（会话 + 全部消息）。
class DialogDetail {
  const DialogDetail({required this.messages});

  final List<DialogMessage> messages;

  factory DialogDetail.fromJson(Map<String, dynamic> json) {
    final logs = pick(json, ['logs', 'messages', 'items']);
    return DialogDetail(
      messages: asMapList(logs).map(DialogMessage.fromJson).toList(),
    );
  }
}

String _formatDateTime(Object? value) {
  final dt = asDateTime(value);
  if (dt == null) return asString(value) ?? '—';
  final local = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} '
      '${two(local.hour)}:${two(local.minute)}';
}

String _formatTime(Object? value) {
  final dt = asDateTime(value);
  if (dt == null) return asString(value) ?? '';
  final local = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)}';
}
