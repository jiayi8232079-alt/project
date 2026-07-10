import 'enums.dart';
import 'parsing.dart';

/// 健康预警领域模型（对应 /alerts）。
class AlertItem {
  const AlertItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.severity,
    required this.status,
    required this.occurredAt,
    this.targetName,
  });

  final String id;
  final String title;
  final String summary;
  final AlertSeverity severity;
  final AlertStatus status;
  final String occurredAt;
  final String? targetName;

  factory AlertItem.fromJson(Map<String, dynamic> json) {
    final target = asMap(json['serviceTarget'] ?? json['service_target']);
    final category = pickString(json, ['category'], fallback: '');

    return AlertItem(
      id: pickString(json, ['id'], fallback: ''),
      title: pickString(json, ['title', 'ruleName', 'rule_code'],
          fallback: _categoryLabel(category)),
      summary: pickString(json, ['message', 'summary', 'content', 'description'],
          fallback: ''),
      severity: _severity(pickString(json, ['severity', 'level'])),
      status: _status(pickString(json, ['status'])),
      occurredAt: _formatDateTime(
        pick(json, ['triggeredAt', 'triggered_at', 'createdAt', 'created_at']),
      ),
      targetName: asString(target?['name']),
    );
  }

  static AlertSeverity _severity(String raw) {
    final value = raw.toLowerCase();
    if (value.contains('high') || value.contains('critical') || value.contains('urgent')) {
      return AlertSeverity.high;
    }
    if (value.contains('medium') || value.contains('warn')) {
      return AlertSeverity.medium;
    }
    return AlertSeverity.low;
  }

  static AlertStatus _status(String raw) {
    switch (raw) {
      case 'acknowledged':
        return AlertStatus.acknowledged;
      case 'closed':
      case 'ignored':
      case 'resolved':
        return AlertStatus.closed;
      default:
        return AlertStatus.pending;
    }
  }

  static String _categoryLabel(String category) {
    return const {
      'medication_miss': '用药漏服预警',
      'follow_up_overdue': '复诊逾期预警',
      'timeline_keyword': '服务关键词预警',
      'service_exception': '服务异常预警',
      'manual': '人工预警',
    }[category] ??
        '健康预警';
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
